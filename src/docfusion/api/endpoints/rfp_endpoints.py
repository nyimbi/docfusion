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
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import TenantContext, require_tenant
from ...core.database.session import get_async_db_session
from ...core.utils import uuid7str
from ...orchestration.proposal_orchestrator import ProposalOrchestrator
from ...rfp.compliance_matrix import ComplianceMatrixGenerator  # noqa: F401
from ...rfp.requirement_extractor import (
	RequirementCategory,
	RequirementExtractor,  # noqa: F401
	RequirementModality,
	RequirementType,
)
from ...rfp.rfp_analyzer import RFPAnalyzer

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


class ParseResponse(BaseModel):
	"""Response from RFP parse."""

	model_config = ConfigDict(extra="forbid")

	rfp_id: str
	requirements_extracted: int
	status: str


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


# Mapping from the pipeline's ``RequirementType`` enum to the small
# ``rfp_requirements.requirement_type`` vocabulary the schema enforces
# (shall/should/may/will). Any pipeline type not directly nameable as a
# verb falls back to ``shall`` because that is the conservative
# compliance read of an extracted requirement.
_REQ_TYPE_TO_VERB: dict[str, str] = {
	"functional": "shall",
	"technical": "shall",
	"performance": "shall",
	"security": "shall",
	"compliance": "shall",
	"deliverable": "shall",
	"evaluation": "shall",
	"contract": "shall",
	"administrative": "shall",
	"unknown": "shall",
}


def _requirement_type_to_verb(req_type: RequirementType) -> str:
	"""Coerce the analyzer's RequirementType to the schema's verb vocabulary."""
	return _REQ_TYPE_TO_VERB.get(req_type.value, "shall")


def _modality_to_priority(modality: RequirementModality) -> str:
	"""``mandatory`` -> ``mandatory``, ``optional`` -> ``optional``,
	``conditional`` -> ``preferred``. The schema only knows three
	priority levels; ``conditional`` collapses to ``preferred`` so a
	human reviewer still sees it as non-mandatory work."""
	if modality == RequirementModality.MANDATORY:
		return "mandatory"
	if modality == RequirementModality.OPTIONAL:
		return "optional"
	return "preferred"


@router.post("/{rfp_id}/parse", response_model=ParseResponse)
async def parse_rfp(
	rfp_id: str,
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
) -> ParseResponse:
	"""Parse an uploaded RFP and extract requirements.

	W3b: synchronous DB-backed pipeline.

	  1. SELECT the document row scoped by ``organization_id`` — 404 if
	     the row is missing or owned by a different tenant.
	  2. Load the staged bytes from local disk.
	  3. Run :class:`RequirementExtractor` over the bytes (PDF/DOCX go
	     through Docling, plain text goes straight through). The
	     resulting :class:`RFPAnalysisResult` carries the requirements.
	  4. INSERT each requirement into ``rfp_requirements`` with
	     ``organization_id`` and ``rfp_document_id`` set.
	  5. UPDATE the document row to ``parsing_status='completed'``.

	Async / queued execution is W3c's job — this synchronous pass keeps
	the contract honest until the Temporal worker lands.
	"""
	row = (
		await session.execute(
			text(
				"""
				SELECT id, organization_id, filename, file_type, storage_path
				FROM rfp_documents
				WHERE id = :rfp_id AND organization_id = :org_id
				"""
			),
			{"rfp_id": rfp_id, "org_id": ctx.organization_id},
		)
	).mappings().first()

	if row is None:
		# Either the document does not exist or it belongs to a different
		# tenant. Both look the same to the caller — we never leak the
		# distinction across the trust boundary.
		raise HTTPException(status_code=404, detail="RFP document not found")

	storage_path = row["storage_path"]
	file_type = (row["file_type"] or "").lower()
	local_path = _local_storage_path(storage_path)

	if not local_path.exists():
		# Bytes vanished between upload and parse. Returning 410 so the
		# client knows to re-upload rather than re-trying the parse.
		await _mark_parse_failed(session, rfp_id, ctx.organization_id, "stored bytes missing")
		raise HTTPException(status_code=410, detail="Staged RFP bytes are gone; re-upload required")

	contents = local_path.read_bytes()

	# Mark parsing as started so the UI can move out of "queued".
	now_started = datetime.now(timezone.utc)
	await session.execute(
		text(
			"""
			UPDATE rfp_documents
			SET parsing_status = 'processing',
				parsing_started_at = :started,
				updated_at = :started
			WHERE id = :rfp_id AND organization_id = :org_id
			"""
		),
		{"rfp_id": rfp_id, "org_id": ctx.organization_id, "started": now_started},
	)
	await session.commit()

	analyzer = RFPAnalyzer(config={"ai_enhancement": False})
	try:
		analysis = await _run_analysis(analyzer, contents, file_type)
	except Exception as exc:  # noqa: BLE001 — explicit broad catch to record failure
		logger.exception(
			"FastAPI /parse analyzer failure rfp_id=%s org=%s",
			rfp_id,
			ctx.organization_id,
		)
		await _mark_parse_failed(session, rfp_id, ctx.organization_id, str(exc))
		raise HTTPException(status_code=500, detail="RFP parse failed") from exc
	finally:
		await analyzer.close()

	if not analysis.success:
		joined = "; ".join(analysis.errors) or "unknown analyzer failure"
		await _mark_parse_failed(session, rfp_id, ctx.organization_id, joined)
		raise HTTPException(status_code=500, detail=f"RFP parse failed: {joined}")

	# Persist requirements. Each gets a fresh server-side UUID so the row
	# id is independent of whatever the in-memory pipeline picked.
	now_completed = datetime.now(timezone.utc)
	for index, req in enumerate(analysis.requirements, start=1):
		await session.execute(
			text(
				"""
				INSERT INTO rfp_requirements (
					id, organization_id, rfp_document_id,
					requirement_number, requirement_text, source_quote,
					source_page, source_section,
					category, requirement_type, priority,
					extraction_confidence,
					compliance_status,
					tags, clarification_questions, related_requirements, key_terms,
					created_at, updated_at
				) VALUES (
					:id, :organization_id, :rfp_document_id,
					:requirement_number, :requirement_text, :source_quote,
					:source_page, :source_section,
					:category, :requirement_type, :priority,
					:extraction_confidence,
					'not_addressed',
					CAST('[]' AS JSONB), CAST('[]' AS JSONB),
					CAST('[]' AS JSONB), CAST('[]' AS JSONB),
					:created_at, :updated_at
				)
				"""
			),
			{
				"id": uuid7str(),
				"organization_id": ctx.organization_id,
				"rfp_document_id": rfp_id,
				"requirement_number": f"REQ-{index:03d}",
				"requirement_text": req.text,
				"source_quote": req.text[:1000],
				"source_page": req.page_number,
				"source_section": req.section or None,
				"category": req.category.value if isinstance(req.category, RequirementCategory) else None,
				"requirement_type": _requirement_type_to_verb(req.requirement_type),
				"priority": _modality_to_priority(req.modality),
				"extraction_confidence": req.confidence,
				"created_at": now_completed,
				"updated_at": now_completed,
			},
		)

	await session.execute(
		text(
			"""
			UPDATE rfp_documents
			SET parsing_status = 'completed',
				parsing_progress = 100,
				parsing_completed_at = :completed,
				updated_at = :completed
			WHERE id = :rfp_id AND organization_id = :org_id
			"""
		),
		{"rfp_id": rfp_id, "org_id": ctx.organization_id, "completed": now_completed},
	)
	await session.commit()

	logger.info(
		"FastAPI /parse completed rfp_id=%s org=%s requirements=%d",
		rfp_id,
		ctx.organization_id,
		len(analysis.requirements),
	)
	return ParseResponse(
		rfp_id=rfp_id,
		requirements_extracted=len(analysis.requirements),
		status="completed",
	)


async def _run_analysis(
	analyzer: RFPAnalyzer,
	contents: bytes,
	file_type: str,
) -> Any:
	"""Pick the right analyzer entry point for the file type.

	Centralised so the synchronous parse handler stays readable, and so
	the future Temporal worker (W3c) can reuse the same dispatcher
	without copy-pasting the file-type table.
	"""
	if file_type == "pdf":
		return await analyzer.analyze_pdf(contents)
	if file_type == "docx":
		return await analyzer.analyze_docx(contents)
	# txt/html/bin — try to decode as text. Anything that survives
	# round-tripping through utf-8 is fed to ``analyze_text``.
	try:
		text_payload = contents.decode("utf-8", errors="replace")
	except Exception as exc:  # pragma: no cover — decode("...", errors="replace") cannot raise
		raise RuntimeError(f"Cannot decode RFP bytes as text: {exc}") from exc
	return await analyzer.analyze_text(text_payload)


async def _mark_parse_failed(
	session: AsyncSession,
	rfp_id: str,
	organization_id: str,
	error: str,
) -> None:
	"""Record a parse failure on the document row and commit.

	Keeps the error string under 4 KB so a stray analyzer traceback
	can't blow up the column. Always writes ``updated_at`` so list
	views still order correctly.
	"""
	now = datetime.now(timezone.utc)
	await session.execute(
		text(
			"""
			UPDATE rfp_documents
			SET parsing_status = 'failed',
				parsing_error = :err,
				updated_at = :now
			WHERE id = :rfp_id AND organization_id = :org_id
			"""
		),
		{
			"rfp_id": rfp_id,
			"org_id": organization_id,
			"err": (error or "unknown")[:4000],
			"now": now,
		},
	)
	await session.commit()


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
