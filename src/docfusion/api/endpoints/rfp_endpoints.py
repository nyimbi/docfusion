#!/usr/bin/env python3
"""FastAPI endpoints for the RFP ingestion pipeline.

Every route here is tenant-gated via :func:`require_tenant`, which reads
``x-docfusion-user-id`` and ``x-docfusion-organization-id`` headers
injected by the Next.js BFF. FastAPI never inspects the user's session
cookie directly — the BFF is the trust boundary.

W3c status:
  * Auth: ``Depends(require_tenant)`` is mandatory on every handler.
  * ``/upload``, ``/requirements``, ``/compliance-matrix``, and the
    entry PATCH route are backed by real Postgres writes against
    ``rfp_documents``, ``rfp_requirements``, ``compliance_matrices``
    and ``compliance_entries``. Every read and every write is scoped
    by ``organization_id``.
  * ``/parse`` no longer runs inline. The handler validates tenancy,
    flips the document to ``parsing_status='queued'``, and hands the
    work to a Temporal workflow on the ``rfp-parse`` task queue. The
    activity (see :mod:`docfusion.workers.rfp_parse.activities`) runs
    the same DB-backed pipeline the inline path used; clients poll
    ``/status`` until it transitions to ``completed``/``failed``.
  * Blob storage is still local disk under ``./storage/rfp/{org}/{rfp}``.
    Production deployments swap this for ``SecureStorageService`` via
    the dependency container.
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
from ...rfp.compliance_matrix import (
	ComplianceMatrixGenerator,
	ComplianceStatus,
)
from ...rfp.parse_pipeline import mark_parse_queued
from ...rfp.requirement_extractor import (
	Requirement,
	RequirementCategory,
	RequirementModality,
	RequirementType,
)
from ...workers.rfp_parse.client import (
	TemporalUnreachableError,
	WorkflowAlreadyEnqueuedError,
	enqueue_rfp_parse,
)

router = APIRouter(prefix="/api/v1/rfp", tags=["rfp"])

logger = logging.getLogger(__name__)


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


def _safe_filename(filename: str | None) -> str:
	"""Strip path components and reject obvious traversal attempts.

	The local-disk fallback writes via ``Path(...).write_bytes(...)``; an
	attacker-controlled ``../../etc/passwd`` would otherwise escape the
	per-tenant directory. ``Path(name).name`` keeps only the final
	component, matching the cloud-storage layout where slashes have
	semantic meaning in the key.
	"""
	if not filename:
		return "rfp"
	# Path(...).name drops everything before the last separator on either
	# platform, so "../etc/passwd" -> "passwd" and "C:\\boot.ini" -> "boot.ini".
	stripped = Path(filename).name
	# Reject anything that is still a separator-only or empty after strip.
	if not stripped or stripped in {".", ".."}:
		return "rfp"
	return stripped


def _storage_key(organization_id: str, rfp_id: str, filename: str) -> str:
	"""Build the canonical storage key. Stable across local and cloud backends."""
	assert organization_id, "organization_id required for storage key"
	assert rfp_id, "rfp_id required for storage key"
	return f"orgs/{organization_id}/rfp/{rfp_id}/{_safe_filename(filename)}"


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


class ParseEnqueuedResponse(BaseModel):
	"""Response from RFP parse enqueue.

	The parse pipeline now runs on a Temporal worker pool — this
	response confirms the work has been accepted and gives the client
	the workflow handle so it can poll ``/status`` (or, in the
	future, query the workflow directly) for progress.
	"""

	model_config = ConfigDict(extra="forbid")

	rfp_id: str
	workflow_id: str
	run_id: str
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
	filename = _safe_filename(file.filename)
	file_size = len(contents)
	file_hash = hashlib.sha256(contents).hexdigest()
	file_type = _file_type_from_filename(filename)
	storage_path = _storage_key(ctx.organization_id, rfp_id, filename)

	# Per-tenant SHA-256 dedup. Migration 0022 already enforces
	# UNIQUE (organization_id, file_hash) — we surface the conflict as 409
	# instead of letting it bubble up as a 500 IntegrityError.
	existing = await session.execute(
		text(
			"""
			SELECT id, filename, storage_path
			FROM rfp_documents
			WHERE organization_id = :organization_id
			  AND file_hash = :file_hash
			LIMIT 1
			"""
		),
		{"organization_id": ctx.organization_id, "file_hash": file_hash},
	)
	dup = existing.mappings().first()
	if dup is not None:
		raise HTTPException(
			status_code=409,
			detail={
				"error": "duplicate",
				"existing_rfp_id": dup["id"],
				"existing_filename": dup["filename"],
				"message": "An RFP with the same content has already been uploaded by this organization.",
			},
		)

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


@router.post(
	"/{rfp_id}/parse",
	response_model=ParseEnqueuedResponse,
	status_code=202,
)
async def parse_rfp(
	rfp_id: str,
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
) -> ParseEnqueuedResponse:
	"""Enqueue an RFP parse on the Temporal worker pool.

	W3c contract:

	  1. SELECT the document row scoped by ``organization_id`` — 404 if
	     the row is missing or owned by a different tenant. The 404 is
	     identical for "doesn't exist" and "belongs to another org" so
	     callers can't probe across the trust boundary.
	  2. Flip ``parsing_status`` to ``"queued"`` so polling clients
	     transition out of ``pending`` immediately. The activity
	     itself moves the row through ``processing`` ->
	     ``completed|failed``.
	  3. Hand the parse to a Temporal workflow on the ``rfp-parse``
	     task queue. ``workflow_id`` is derived from ``rfp_id`` so
	     duplicate enqueue attempts collapse onto the same execution.
	  4. Return 202 Accepted with the workflow handle.

	The actual parse work — bytes -> ``RFPAnalyzer`` -> persisted
	requirements — runs inside the activity in
	``docfusion.workers.rfp_parse.activities``. Both paths share the
	same :func:`docfusion.rfp.parse_pipeline.execute_parse_pipeline`
	implementation; there is no longer an inline analyzer call here.
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

	# Flip the row to ``queued`` *before* we hand off to Temporal so a
	# poller hitting ``/status`` between enqueue and worker pickup sees
	# the right state. The activity will move it to ``processing`` once
	# it actually starts, and to ``completed``/``failed`` at the end.
	await mark_parse_queued(session, rfp_id, ctx.organization_id)

	try:
		workflow_id, run_id = await enqueue_rfp_parse(
			rfp_id=rfp_id,
			organization_id=ctx.organization_id,
			user_id=ctx.user_id,
		)
	except WorkflowAlreadyEnqueuedError as exc:
		# Idempotent re-enqueue: a parse for this rfp_id is already in
		# flight. Return 200 with the existing handle so the caller can
		# poll /status against the live run rather than starting a fresh
		# one (which would re-INSERT requirements — the activity is not
		# upsert-safe).
		logger.info(
			"FastAPI /parse re-enqueue collided with in-flight workflow "
			"rfp_id=%s org=%s workflow_id=%s",
			rfp_id,
			ctx.organization_id,
			exc.workflow_id,
		)
		return ParseEnqueuedResponse(
			rfp_id=rfp_id,
			workflow_id=exc.workflow_id,
			run_id=exc.run_id,
			status="queued",
		)
	except TemporalUnreachableError as exc:
		# The cluster is down or misconfigured. Leave the row in ``queued``
		# so operators can re-drive once the cluster is back. 503 tells
		# the client to retry.
		logger.exception(
			"FastAPI /parse Temporal cluster unreachable rfp_id=%s org=%s",
			rfp_id,
			ctx.organization_id,
		)
		raise HTTPException(
			status_code=503,
			detail="RFP parse queue is unreachable; please retry",
		) from exc
	except Exception as exc:  # noqa: BLE001 — last-resort guard
		logger.exception(
			"FastAPI /parse enqueue unexpected failure rfp_id=%s org=%s",
			rfp_id,
			ctx.organization_id,
		)
		raise HTTPException(
			status_code=500,
			detail="Failed to enqueue RFP parse",
		) from exc

	logger.info(
		"FastAPI /parse enqueued rfp_id=%s org=%s workflow_id=%s run_id=%s",
		rfp_id,
		ctx.organization_id,
		workflow_id,
		run_id,
	)
	return ParseEnqueuedResponse(
		rfp_id=rfp_id,
		workflow_id=workflow_id,
		run_id=run_id,
		status="queued",
	)


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


@router.get("/{rfp_id}/requirements")
async def list_requirements(
	rfp_id: str,
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
) -> dict[str, Any]:
	"""List extracted requirements for an RFP, scoped to the caller's org.

	The 404 first checks that the document itself exists and belongs to
	the caller's tenant. That keeps cross-tenant probing from leaking a
	"this RFP exists, just not for you" signal — both states return 404.
	"""
	doc_row = (
		await session.execute(
			text(
				"""
				SELECT id FROM rfp_documents
				WHERE id = :rfp_id AND organization_id = :org_id
				"""
			),
			{"rfp_id": rfp_id, "org_id": ctx.organization_id},
		)
	).mappings().first()

	if doc_row is None:
		raise HTTPException(status_code=404, detail="RFP document not found")

	rows = (
		await session.execute(
			text(
				"""
				SELECT
					id, requirement_number, title, requirement_text,
					source_quote, source_page, source_section,
					category, subcategory, requirement_type, priority,
					risk_level, extraction_confidence,
					compliance_status, response_strategy, assigned_to,
					due_date, response_section, notes,
					created_at, updated_at
				FROM rfp_requirements
				WHERE rfp_document_id = :rfp_id AND organization_id = :org_id
				ORDER BY requirement_number ASC NULLS LAST, created_at ASC
				"""
			),
			{"rfp_id": rfp_id, "org_id": ctx.organization_id},
		)
	).mappings().all()

	requirements = [_requirement_row_to_dict(row) for row in rows]
	return {
		"rfp_id": rfp_id,
		"organization_id": ctx.organization_id,
		"count": len(requirements),
		"requirements": requirements,
	}


def _requirement_row_to_dict(row: Any) -> dict[str, Any]:
	"""Render a ``rfp_requirements`` row as a JSON-serialisable dict.

	Keeps timestamps as ISO-8601 strings; FastAPI's default encoder
	already does that for ``datetime`` but being explicit makes the
	contract diff-friendly.
	"""
	def _iso(value: Any) -> str | None:
		return value.isoformat() if hasattr(value, "isoformat") else None

	return {
		"id": str(row["id"]),
		"requirement_number": row.get("requirement_number"),
		"title": row.get("title"),
		"requirement_text": row.get("requirement_text"),
		"source_quote": row.get("source_quote"),
		"source_page": row.get("source_page"),
		"source_section": row.get("source_section"),
		"category": row.get("category"),
		"subcategory": row.get("subcategory"),
		"requirement_type": row.get("requirement_type"),
		"priority": row.get("priority"),
		"risk_level": row.get("risk_level"),
		"extraction_confidence": row.get("extraction_confidence"),
		"compliance_status": row.get("compliance_status"),
		"response_strategy": row.get("response_strategy"),
		"assigned_to": row.get("assigned_to"),
		"due_date": _iso(row.get("due_date")),
		"response_section": row.get("response_section"),
		"notes": row.get("notes"),
		"created_at": _iso(row.get("created_at")),
		"updated_at": _iso(row.get("updated_at")),
	}


# Mapping from the schema's modality vocabulary to the in-memory enum.
_PRIORITY_TO_MODALITY: dict[str, RequirementModality] = {
	"mandatory": RequirementModality.MANDATORY,
	"optional": RequirementModality.OPTIONAL,
	"preferred": RequirementModality.OPTIONAL,
}


def _row_to_requirement(row: Any) -> Requirement:
	"""Reconstruct an in-memory ``Requirement`` from a DB row.

	Used by ``/compliance-matrix`` to feed the matrix generator. The
	row's ``id`` is preserved so the resulting matrix entries reference
	the persisted requirement, not a regenerated UUID.
	"""
	priority = (row.get("priority") or "mandatory").lower()
	category_value = row.get("category") or "other"
	try:
		category_enum = RequirementCategory(category_value)
	except ValueError:
		category_enum = RequirementCategory.OTHER
	return Requirement(
		id=str(row["id"]),
		text=row.get("requirement_text") or "",
		modality=_PRIORITY_TO_MODALITY.get(priority, RequirementModality.MANDATORY),
		category=category_enum,
		# RequirementType is the in-memory enum (functional/technical/etc.).
		# The DB only knows the verb vocabulary, so we mark these as
		# UNKNOWN — the matrix only cares about modality + category for
		# section grouping.
		requirement_type=RequirementType.UNKNOWN,
		section=row.get("source_section") or "",
		page_number=row.get("source_page"),
		confidence=row.get("extraction_confidence") or 0.0,
	)


@router.post("/{rfp_id}/compliance-matrix")
async def generate_matrix(
	rfp_id: str,
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
) -> dict[str, Any]:
	"""Generate and persist a compliance matrix for the given RFP.

	Loads the requirements for the document (tenant-scoped), builds an
	in-memory ``ComplianceMatrix`` via ``ComplianceMatrixGenerator``,
	and writes it through ``save_to_db`` with the caller's org id.
	"""
	doc_row = (
		await session.execute(
			text(
				"""
				SELECT id FROM rfp_documents
				WHERE id = :rfp_id AND organization_id = :org_id
				"""
			),
			{"rfp_id": rfp_id, "org_id": ctx.organization_id},
		)
	).mappings().first()
	if doc_row is None:
		raise HTTPException(status_code=404, detail="RFP document not found")

	rows = (
		await session.execute(
			text(
				"""
				SELECT id, requirement_text, source_section, source_page,
					   category, priority, extraction_confidence
				FROM rfp_requirements
				WHERE rfp_document_id = :rfp_id AND organization_id = :org_id
				ORDER BY requirement_number ASC NULLS LAST, created_at ASC
				"""
			),
			{"rfp_id": rfp_id, "org_id": ctx.organization_id},
		)
	).mappings().all()

	if not rows:
		# Nothing to map. Returning 409 so the client knows to /parse
		# first; 200-with-empty would silently succeed.
		raise HTTPException(
			status_code=409,
			detail="No requirements found for RFP; run /parse before generating a matrix",
		)

	requirements = [_row_to_requirement(row) for row in rows]

	generator = ComplianceMatrixGenerator()
	matrix = await generator.generate_matrix(
		requirements=requirements,
		rfp_id=rfp_id,
		name=f"Compliance Matrix for {rfp_id}",
		description="Auto-generated by FastAPI /compliance-matrix",
	)
	matrix_id = await generator.save_to_db(
		session,
		matrix,
		organization_id=ctx.organization_id,
		rfp_document_id=rfp_id,
		created_by=ctx.user_id,
	)

	logger.info(
		"FastAPI /compliance-matrix persisted matrix_id=%s rfp_id=%s org=%s entries=%d",
		matrix_id,
		rfp_id,
		ctx.organization_id,
		len(matrix.mappings),
	)
	return {
		"matrix_id": matrix_id,
		"rfp_id": rfp_id,
		"organization_id": ctx.organization_id,
		"entry_count": len(matrix.mappings),
	}


# Allow-list for the entry update PATCH. Any field outside this set is
# rejected with a 400 — protects us from a client smuggling
# ``organization_id`` or ``matrix_id`` into the update payload and
# escaping the tenant scope.
_UPDATE_FIELD_TO_COLUMN: dict[str, str] = {
	"status": "compliance_status",
	"response": "response_summary",
	"notes": "reviewer_notes",
	"assigned_to": "assigned_to",
}

# A small status vocabulary check. The DB column is ``varchar(30)`` with
# no enum, so we enforce the contract here rather than relying on the
# Postgres layer.
_VALID_ENTRY_STATUSES = {s.value for s in ComplianceStatus} | {
	"compliant",
	"partial",
	"non_compliant",
	"not_applicable",
	"pending",
}


@router.patch("/{rfp_id}/compliance-matrix/{matrix_id}/entries/{entry_id}")
async def update_entry(
	rfp_id: str,
	matrix_id: str,
	entry_id: str,
	update: dict[str, Any],
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
) -> dict[str, Any]:
	"""Update a compliance matrix entry within the caller's org.

	Steps:
	  1. Validate the entry belongs to the caller's tenant **and** to
	     the requested matrix. Either mismatch returns 404.
	  2. Apply an allow-list to the update payload so unknown keys
	     (``organization_id``, ``matrix_id``, etc.) fail closed.
	  3. UPDATE the row and return its post-update state.
	"""
	if not isinstance(update, dict):
		raise HTTPException(status_code=400, detail="update payload must be an object")

	# 1. Verify the entry exists in this tenant + matrix.
	row = (
		await session.execute(
			text(
				"""
				SELECT id, matrix_id, organization_id
				FROM compliance_entries
				WHERE id = :entry_id
				  AND matrix_id = :matrix_id
				  AND organization_id = :org_id
				"""
			),
			{
				"entry_id": entry_id,
				"matrix_id": matrix_id,
				"org_id": ctx.organization_id,
			},
		)
	).mappings().first()

	if row is None:
		# rfp_id is not in the WHERE clause because the entry's tenancy
		# is enforced by org_id+matrix_id. Including rfp_id would be
		# incorrect — entries don't carry it directly. The path
		# parameter is still useful for logs.
		logger.warning(
			"FastAPI /update_entry 404: rfp_id=%s matrix_id=%s entry_id=%s org=%s",
			rfp_id,
			matrix_id,
			entry_id,
			ctx.organization_id,
		)
		raise HTTPException(status_code=404, detail="Compliance entry not found")

	# 2. Allow-list the payload.
	unknown = set(update.keys()) - set(_UPDATE_FIELD_TO_COLUMN.keys())
	if unknown:
		raise HTTPException(
			status_code=400,
			detail=f"Unsupported update fields: {sorted(unknown)}",
		)

	if not update:
		raise HTTPException(status_code=400, detail="update payload is empty")

	if "status" in update:
		status_val = update["status"]
		if not isinstance(status_val, str) or status_val not in _VALID_ENTRY_STATUSES:
			raise HTTPException(
				status_code=400,
				detail=f"invalid status value: {status_val!r}",
			)

	# 3. Build the UPDATE statement from the allow-listed keys.
	now = datetime.now(timezone.utc)
	set_fragments: list[str] = []
	params: dict[str, Any] = {
		"entry_id": entry_id,
		"matrix_id": matrix_id,
		"org_id": ctx.organization_id,
		"updated_at": now,
	}
	for key, value in update.items():
		column = _UPDATE_FIELD_TO_COLUMN[key]
		set_fragments.append(f"{column} = :{key}")
		params[key] = value
	set_fragments.append("updated_at = :updated_at")

	await session.execute(
		text(
			f"""
			UPDATE compliance_entries
			SET {', '.join(set_fragments)}
			WHERE id = :entry_id
			  AND matrix_id = :matrix_id
			  AND organization_id = :org_id
			"""
		),
		params,
	)
	await session.commit()

	# Re-read so the response reflects the persisted state, not the
	# request payload.
	updated = (
		await session.execute(
			text(
				"""
				SELECT id, matrix_id, requirement_id, organization_id,
					   compliance_status, response_summary, reviewer_notes,
					   assigned_to, sort_order, created_at, updated_at
				FROM compliance_entries
				WHERE id = :entry_id
				  AND matrix_id = :matrix_id
				  AND organization_id = :org_id
				"""
			),
			{
				"entry_id": entry_id,
				"matrix_id": matrix_id,
				"org_id": ctx.organization_id,
			},
		)
	).mappings().first()

	if updated is None:
		# Should be unreachable — we just confirmed the row exists in
		# step 1 and we hold the only handle on the session.
		raise HTTPException(status_code=500, detail="Compliance entry vanished mid-update")

	return {
		"entry_id": str(updated["id"]),
		"matrix_id": str(updated["matrix_id"]),
		"requirement_id": str(updated["requirement_id"]),
		"organization_id": updated["organization_id"],
		"status": updated["compliance_status"],
		"response": updated.get("response_summary"),
		"notes": updated.get("reviewer_notes"),
		"assigned_to": updated.get("assigned_to"),
		"updated_at": updated["updated_at"].isoformat() if updated.get("updated_at") else None,
	}


@router.post("/{rfp_id}/draft")
async def draft_proposal(
	rfp_id: str,
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
) -> dict[str, object]:
	"""Generate a proposal draft from the RFP's compliance matrix."""
	from ...orchestration.proposal_orchestrator import ProposalOrchestrator

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
