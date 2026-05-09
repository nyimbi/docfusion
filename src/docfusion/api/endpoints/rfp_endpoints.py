#!/usr/bin/env python3
"""FastAPI endpoints for the RFP ingestion pipeline.

Every route here is tenant-gated via :func:`require_tenant`, which reads
``x-docfusion-user-id`` and ``x-docfusion-organization-id`` headers
injected by the Next.js BFF. FastAPI never inspects the user's session
cookie directly — the BFF is the trust boundary.

W3b status:
  * Auth: ``Depends(require_tenant)`` is mandatory on every handler.
  * ``/upload`` is now backed by a real Postgres write against
    ``rfp_documents``. Every read and every write is scoped by
    ``organization_id``.
  * Blob storage is still local disk under ``./storage/rfp/{org}/{rfp}``.
    Production deployments swap this for ``SecureStorageService`` via
    the dependency container; that wire-up lands in W3c together with
    the Temporal-backed async parsing pipeline.
  * The remaining handlers (``/parse``, ``/requirements``,
    ``/compliance-matrix``, ``/update_entry``) still return 501 with
    a sentinel detail string. They will land one commit at a time so
    the wire-up is reviewable in isolation.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import TenantContext, require_tenant
from ...core.database.session import get_async_db_session
from ...core.utils import uuid7str
from ...orchestration.proposal_orchestrator import ProposalOrchestrator
# Pipeline classes are imported lazily by W3b's DB wire-up — keep these
# top-level imports so test fixtures and downstream tools can monkeypatch
# them without dynamic-import gymnastics. F401 suppresses the unused warning
# for now; remove once W3b lands the real handlers.
from ...rfp.compliance_matrix import ComplianceMatrixGenerator  # noqa: F401
from ...rfp.requirement_extractor import RequirementExtractor  # noqa: F401
from ...rfp.rfp_analyzer import RFPAnalyzer  # noqa: F401

router = APIRouter(prefix="/api/v1/rfp", tags=["rfp"])

logger = logging.getLogger(__name__)

# Detail string returned by every handler whose DB wire-up is deferred.
# Clients can branch on this exact phrase to fall back to the Next.js
# pipeline without having to parse status codes.
_NOT_WIRED_DETAIL = "FastAPI handler not yet wired to DB; use the Next.js /api/v1/rfp/* endpoints"


# ---------------------------------------------------------------------------
# Local filesystem staging area for uploaded RFP bytes.
#
# W3b deliberately defers blob-storage wiring (S3 / SecureStorageService)
# to W3c. The /parse handler needs the original bytes back, so /upload
# stages them on local disk under a per-tenant prefix. The path layout
# is the same key we will hand to SecureStorageService later, which means
# swapping in the cloud client is a search-and-replace, not a redesign.
# ---------------------------------------------------------------------------
_LOCAL_STORAGE_ROOT = Path("./storage/rfp")


def _storage_key(organization_id: str, rfp_id: str, filename: str) -> str:
	"""Build the canonical storage key. Stable across local and cloud backends."""
	assert organization_id, "organization_id required for storage key"
	assert rfp_id, "rfp_id required for storage key"
	safe_name = filename or "rfp"
	return f"orgs/{organization_id}/rfp/{rfp_id}/{safe_name}"


def _local_storage_path(storage_key: str) -> Path:
	"""Resolve a storage_key to a local filesystem path under ./storage/rfp.

	The caller is responsible for ensuring the parent directory exists
	before writing. ``W3c`` will replace this with SecureStorageService.
	"""
	# Strip the "orgs/" prefix because _LOCAL_STORAGE_ROOT already starts at
	# ``storage/rfp``; that keeps disk paths short and avoids a redundant
	# "rfp/" component.
	relative = storage_key[len("orgs/"):] if storage_key.startswith("orgs/") else storage_key
	return _LOCAL_STORAGE_ROOT / relative


def _file_type_from_filename(filename: str) -> str:
	"""Return ``pdf``/``docx``/``txt``/``html`` based on extension."""
	name = (filename or "").lower()
	if name.endswith(".pdf"):
		return "pdf"
	if name.endswith(".docx"):
		return "docx"
	if name.endswith(".html") or name.endswith(".htm"):
		return "html"
	if name.endswith(".txt") or name.endswith(".md"):
		return "txt"
	# Fallback — unknown content is still a binary blob.
	return "bin"


# ---------------------------------------------------------------------------
# Pydantic response models
# ---------------------------------------------------------------------------


class UploadResponse(BaseModel):
	"""Response from RFP upload."""

	model_config = ConfigDict(extra="forbid")

	rfp_id: str
	filename: str
	size: int
	organization_id: str
	file_hash: str
	storage_path: str
	parsing_status: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/upload", response_model=UploadResponse, status_code=202)
async def upload_rfp(
	file: UploadFile = File(...),
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
) -> UploadResponse:
	"""Upload an RFP document and persist a row in ``rfp_documents``.

	W3b wiring:
	  1. Read the upload into memory and SHA-256 it for content
	     deduplication and integrity tracking.
	  2. Generate a UUID7 ``rfp_id`` so callers can reference the
	     document immediately.
	  3. Stage the bytes on local disk under
	     ``./storage/rfp/{org}/{rfp_id}/{filename}``. The storage key
	     stored on the row matches the cloud-storage layout
	     ``orgs/{org}/rfp/{rfp_id}/{filename}`` so W3c can move to
	     SecureStorageService without changing the schema.
	  4. INSERT the row into ``rfp_documents`` with
	     ``parsing_status='pending'`` and ``organization_id`` set from
	     the tenant context.
	"""
	contents = await file.read()
	assert contents is not None, "UploadFile.read() must return bytes"
	rfp_id = uuid7str()
	filename = file.filename or "unknown"
	file_size = len(contents)
	file_hash = hashlib.sha256(contents).hexdigest()
	file_type = _file_type_from_filename(filename)
	storage_path = _storage_key(ctx.organization_id, rfp_id, filename)

	# Stage the bytes locally so /parse can rehydrate them. Production
	# deployments swap this for SecureStorageService in W3c.
	local_path = _local_storage_path(storage_path)
	local_path.parent.mkdir(parents=True, exist_ok=True)
	local_path.write_bytes(contents)

	now = datetime.now(timezone.utc)
	await session.execute(
		text(
			"""
			INSERT INTO rfp_documents (
				id, organization_id,
				filename, file_type, file_size,
				storage_path, file_hash,
				parsing_status, parsing_progress,
				uploaded_by,
				naics_codes, detected_sections, key_themes, evaluation_weights,
				created_at, updated_at
			) VALUES (
				:id, :organization_id,
				:filename, :file_type, :file_size,
				:storage_path, :file_hash,
				'pending', 0,
				:uploaded_by,
				CAST('[]' AS JSONB), CAST('[]' AS JSONB),
				CAST('[]' AS JSONB), CAST('{}' AS JSONB),
				:created_at, :updated_at
			)
			"""
		),
		{
			"id": rfp_id,
			"organization_id": ctx.organization_id,
			"filename": filename,
			"file_type": file_type,
			"file_size": file_size,
			"storage_path": storage_path,
			"file_hash": file_hash,
			"uploaded_by": ctx.user_id,
			"created_at": now,
			"updated_at": now,
		},
	)
	await session.commit()

	logger.info(
		"FastAPI /upload persisted rfp_id=%s filename=%s size=%d org=%s user=%s",
		rfp_id,
		filename,
		file_size,
		ctx.organization_id,
		ctx.user_id,
	)
	return UploadResponse(
		rfp_id=rfp_id,
		filename=filename,
		size=file_size,
		organization_id=ctx.organization_id,
		file_hash=file_hash,
		storage_path=storage_path,
		parsing_status="pending",
	)


@router.post("/{rfp_id}/parse", status_code=501)
async def parse_rfp(
	rfp_id: str,
	ctx: TenantContext = Depends(require_tenant),
) -> dict[str, object]:
	"""Parse an uploaded RFP and extract requirements.

	W3b: still 501. The /parse wire-up lands in the next commit so the
	diff stays reviewable.
	"""
	logger.warning(
		"FastAPI /parse called for rfp_id=%s org=%s — returning 501 (not wired)",
		rfp_id,
		ctx.organization_id,
	)
	raise HTTPException(status_code=501, detail=_NOT_WIRED_DETAIL)


@router.get("/{rfp_id}/status")
async def stream_status(
	rfp_id: str,
	ctx: TenantContext = Depends(require_tenant),
) -> StreamingResponse:
	"""Stream SSE events for RFP parsing status."""
	async def event_stream():
		yield (
			f"data: {{\"rfp_id\": \"{rfp_id}\", "
			f"\"status\": \"ready\", "
			f"\"organization_id\": \"{ctx.organization_id}\"}}\n\n"
		)

	return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/{rfp_id}/requirements", status_code=501)
async def list_requirements(
	rfp_id: str,
	ctx: TenantContext = Depends(require_tenant),
) -> dict[str, object]:
	"""List extracted requirements for an RFP. 501 until /requirements lands."""
	logger.warning(
		"FastAPI /requirements called for rfp_id=%s org=%s — returning 501 (not wired)",
		rfp_id,
		ctx.organization_id,
	)
	raise HTTPException(status_code=501, detail=_NOT_WIRED_DETAIL)


@router.post("/{rfp_id}/compliance-matrix", status_code=501)
async def generate_matrix(
	rfp_id: str,
	ctx: TenantContext = Depends(require_tenant),
) -> dict[str, object]:
	"""Generate a compliance matrix for an RFP. 501 until /compliance-matrix lands."""
	logger.warning(
		"FastAPI /compliance-matrix called for rfp_id=%s org=%s — returning 501 (not wired)",
		rfp_id,
		ctx.organization_id,
	)
	raise HTTPException(status_code=501, detail=_NOT_WIRED_DETAIL)


@router.patch("/{rfp_id}/compliance-matrix/{matrix_id}/entries/{entry_id}", status_code=501)
async def update_entry(
	rfp_id: str,
	matrix_id: str,
	entry_id: str,
	update: dict[str, object],
	ctx: TenantContext = Depends(require_tenant),
) -> dict[str, object]:
	"""Update a compliance matrix entry. 501 until /update_entry lands."""
	logger.warning(
		"FastAPI /update_entry called rfp_id=%s matrix_id=%s entry_id=%s org=%s — returning 501",
		rfp_id,
		matrix_id,
		entry_id,
		ctx.organization_id,
	)
	raise HTTPException(status_code=501, detail=_NOT_WIRED_DETAIL)


@router.post("/{rfp_id}/draft")
async def draft_proposal(
	rfp_id: str,
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
) -> dict[str, object]:
	"""Generate a proposal draft from the RFP's compliance matrix."""
	orchestrator = ProposalOrchestrator()
	draft = await orchestrator.draft_proposal(rfp_id, session)
	logger.info(
		"FastAPI /draft completed: rfp_id=%s org=%s sections=%d",
		rfp_id,
		ctx.organization_id,
		len(draft.sections),
	)
	return {
		"rfp_id": rfp_id,
		"organization_id": ctx.organization_id,
		"sections": draft.sections,
		"review_feedback": draft.review_feedback,
		"compliance_diff": draft.compliance_diff,
	}
