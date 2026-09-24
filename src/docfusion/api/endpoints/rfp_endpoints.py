#!/usr/bin/env python3
"""FastAPI endpoints for the RFP ingestion pipeline.

Every route here is tenant-gated via :func:`require_tenant`, which reads
HMAC-signed tenant headers injected by the Next.js BFF. FastAPI never
inspects the user's session cookie directly — the signed BFF context is
the trust boundary.

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
  * Blob storage is handled by ``SecureStorageService`` via the dependency
    container. It uses Linode E3 when configured and local disk as a
    development fallback.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import TenantContext, get_storage_service, require_tenant
from ..schemas.rfp_schemas import (
	AnalyzeJobResponse,
	ComplianceEntryUpdateResponse,
	ComplianceMatrixResponse,
	DraftProposalResponse,
	RequirementListResponse,
	RfpMetadata,
	RfpResultResponse,
	RfpStatusResponse,
	RfpUploadResponse,
)
from ...core.database.session import get_async_db_session
from ...core.utils import uuid7str
from ...rendering.latex import LaTeXService
from ...rendering.latex.service import LaTeXServiceError
from ...storage.blob_store import BlobStore, LocalBlobStore

router = APIRouter(prefix="/api/v1/rfp", tags=["rfp"])

logger = logging.getLogger(__name__)

_LOCAL_STORAGE_ROOT = Path("./storage/rfp")
_PDF_RESULT_ROOT = Path("storage") / "rfp_results"


@dataclass(frozen=True)
class _LatexResultBlock:
	block_id: str
	content: str


def _safe_filename(filename: str | None) -> str:
	"""Strip path components and reject obvious traversal attempts.

	``Path(name).name`` keeps only the final component, matching the
	cloud-storage layout where slashes have semantic meaning in the key.
	"""
	if not filename:
		return "rfp"
	stripped = Path(filename).name
	if not stripped or stripped in {".", ".."}:
		return "rfp"
	return stripped


def _storage_key(organization_id: str, rfp_id: str, filename: str) -> str:
	"""Build the canonical storage key. Stable across local and cloud backends."""
	assert organization_id, "organization_id required for storage key"
	assert rfp_id, "rfp_id required for storage key"
	return f"orgs/{organization_id}/rfp/{rfp_id}/{_safe_filename(filename)}"


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


def _safe_path_segment(value: str) -> str:
	"""Return a filesystem-safe path segment for local result artifacts."""
	return "".join(
		char if char.isalnum() or char in "._-" else "-"
		for char in value
	).strip(".-") or "item"


def _compiled_pdf_path(organization_id: str, rfp_id: str) -> Path:
	"""Return the generated-PDF path for an RFP result."""
	return (
		_PDF_RESULT_ROOT
		/ _safe_path_segment(organization_id)
		/ _safe_path_segment(rfp_id)
		/ "proposal.pdf"
	)


def get_latex_service() -> LaTeXService:
	"""FastAPI dependency factory for the LaTeX renderer."""
	return LaTeXService()


_LATEX_ESCAPE_CHARS = {
	"\\": r"\textbackslash{}",
	"&": r"\&",
	"%": r"\%",
	"$": r"\$",
	"#": r"\#",
	"_": r"\_",
	"{": r"\{",
	"}": r"\}",
	"~": r"\textasciitilde{}",
	"^": r"\textasciicircum{}",
}


def _latex_escape(value: Any) -> str:
	"""Escape text content before placing it in generated LaTeX blocks."""
	return "".join(_LATEX_ESCAPE_CHARS.get(char, char) for char in str(value or ""))


def _requirement_row_to_latex_block(row: Any, index: int) -> _LatexResultBlock:
	"""Render a persisted requirement row as a proposal LaTeX block."""
	number = row.get("requirement_number") or index
	title = row.get("title") or f"Requirement {number}"
	reference = row.get("source_section") or "RFP requirement"
	requirement_text = row.get("requirement_text") or ""
	response = row.get("response_strategy") or row.get("notes") or "Response pending."
	return _LatexResultBlock(
		block_id=f"requirement-{number}",
		content=(
			f"\\section{{{_latex_escape(title)}}}\n"
			f"\\textbf{{Reference:}} {_latex_escape(reference)}\n\n"
			f"{_latex_escape(requirement_text)}\n\n"
			f"\\textbf{{Response:}} {_latex_escape(response)}\n"
		),
	)


def _content_type_for_upload(file: UploadFile, file_type: str) -> str:
	if file.content_type:
		return file.content_type
	if file_type == "pdf":
		return "application/pdf"
	if file_type == "docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	if file_type == "html":
		return "text/html"
	if file_type == "txt":
		return "text/plain"
	return "application/octet-stream"


async def get_rfp_storage() -> Any:
	"""Use secure storage when initialized, with local storage as dev/test fallback."""
	try:
		return await get_storage_service()
	except RuntimeError:
		return LocalBlobStore(root=_LOCAL_STORAGE_ROOT)


async def _store_upload_bytes(
	storage: Any,
	key: str,
	contents: bytes,
	content_type: str,
) -> None:
	try:
		await storage.store(key, contents, content_type=content_type)
	except TypeError:
		await storage.store(key, contents)


def _request_id(request: Request) -> str:
	"""Return caller-supplied request id or generate a UUID for tracing."""
	return request.headers.get("X-Request-ID") or str(uuid.uuid4())


def _log_entry(route_name: str, request: Request, **fields: Any) -> str:
	"""Log route entry with a stable request id."""
	request_id = _request_id(request)
	logger.info(
		"RFP endpoint entry route=%s request_id=%s fields=%s",
		route_name,
		request_id,
		fields,
	)
	return request_id


def _iso(value: Any) -> str | None:
	return value.isoformat() if hasattr(value, "isoformat") else None


def _row_get(row: Any, key: str, default: Any = None) -> Any:
	if row is None:
		return default
	if hasattr(row, "get"):
		return row.get(key, default)
	return getattr(row, key, default)


def _validate_identifier(value: str, name: str) -> None:
	if not value or not value.strip():
		raise HTTPException(status_code=422, detail=f"{name} must not be empty")


def _document_row_to_metadata(row: Any) -> RfpMetadata:
	return RfpMetadata(
		rfp_id=str(_row_get(row, "id")),
		organization_id=str(_row_get(row, "organization_id")),
		filename=_row_get(row, "filename") or "rfp",
		file_type=_row_get(row, "file_type"),
		file_size=_row_get(row, "file_size"),
		storage_path=_row_get(row, "storage_path"),
		file_hash=_row_get(row, "file_hash"),
		parsing_status=_row_get(row, "parsing_status") or "pending",
		parsing_progress=_row_get(row, "parsing_progress") or 0,
		parsing_error=_row_get(row, "parsing_error"),
		parsing_started_at=_iso(_row_get(row, "parsing_started_at")),
		parsing_completed_at=_iso(_row_get(row, "parsing_completed_at")),
		uploaded_by=_row_get(row, "uploaded_by"),
		opportunity_id=_row_get(row, "opportunity_id"),
		created_at=_iso(_row_get(row, "created_at")),
		updated_at=_iso(_row_get(row, "updated_at")),
	)


async def _get_rfp_document_row(
	rfp_id: str,
	ctx: TenantContext,
	session: AsyncSession,
) -> Any:
	_validate_identifier(rfp_id, "rfp_id")
	row = (
		await session.execute(
			text(
				"""
				SELECT *
				FROM rfp_documents
				WHERE id = :rfp_id AND organization_id = :org_id
				"""
			),
			{"rfp_id": rfp_id, "org_id": ctx.organization_id},
		)
	).mappings().first()
	if row is None:
		raise HTTPException(status_code=404, detail="RFP document not found")
	return row


async def _enqueue_analysis_job(
	rfp_id: str,
	ctx: TenantContext,
	session: AsyncSession,
	request_id: str,
	route_name: str,
) -> AnalyzeJobResponse:
	from ...rfp.parse_pipeline import mark_parse_queued
	from ...workers.rfp_parse.client import (
		TemporalUnreachableError,
		WorkflowAlreadyEnqueuedError,
		enqueue_rfp_parse,
	)

	row = await _get_rfp_document_row(rfp_id, ctx, session)
	del row

	await mark_parse_queued(session, rfp_id, ctx.organization_id)

	try:
		workflow_id, run_id = await enqueue_rfp_parse(
			rfp_id=rfp_id,
			organization_id=ctx.organization_id,
			user_id=ctx.user_id,
		)
	except WorkflowAlreadyEnqueuedError as exc:
		logger.info(
			"FastAPI %s re-enqueue collided request_id=%s rfp_id=%s org=%s workflow_id=%s",
			route_name,
			request_id,
			rfp_id,
			ctx.organization_id,
			exc.workflow_id,
		)
		return AnalyzeJobResponse(
			rfp_id=rfp_id,
			workflow_id=exc.workflow_id,
			run_id=exc.run_id,
			status="queued",
		)
	except TemporalUnreachableError as exc:
		logger.exception(
			"FastAPI %s Temporal cluster unreachable request_id=%s rfp_id=%s org=%s",
			route_name,
			request_id,
			rfp_id,
			ctx.organization_id,
		)
		raise HTTPException(
			status_code=503,
			detail="RFP parse queue is unreachable; please retry",
		) from exc
	except HTTPException:
		raise
	except Exception as exc:  # noqa: BLE001 — last-resort guard
		logger.exception(
			"FastAPI %s enqueue unexpected failure request_id=%s rfp_id=%s org=%s",
			route_name,
			request_id,
			rfp_id,
			ctx.organization_id,
		)
		raise HTTPException(
			status_code=500,
			detail="Failed to enqueue RFP analysis",
		) from exc

	logger.info(
		"FastAPI %s enqueued request_id=%s rfp_id=%s org=%s workflow_id=%s run_id=%s",
		route_name,
		request_id,
		rfp_id,
		ctx.organization_id,
		workflow_id,
		run_id,
	)
	return AnalyzeJobResponse(
		rfp_id=rfp_id,
		workflow_id=workflow_id,
		run_id=run_id,
		status="queued",
	)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/upload", response_model=RfpUploadResponse, status_code=202)
async def upload_rfp(
	request: Request,
	file: UploadFile = File(...),
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
	storage_service: Any = Depends(get_rfp_storage),
) -> RfpUploadResponse:
	"""Upload an RFP document and persist a row in ``rfp_documents``.

	  1. Read the upload into memory and SHA-256 it for content
	     deduplication and integrity tracking.
	  2. Generate a UUID7 ``rfp_id`` so callers can reference the
	     document immediately.
	  3. Stage the bytes via ``SecureStorageService`` under the canonical key
	     ``orgs/{org}/rfp/{rfp_id}/{filename}``.
	  4. INSERT the row into ``rfp_documents`` with
	     ``parsing_status='pending'`` and ``organization_id`` set from
	     the tenant context.
	"""
	request_id = _log_entry("upload_rfp", request, organization_id=ctx.organization_id)
	contents = await file.read()
	assert contents is not None, "UploadFile.read() must return bytes"
	if not contents:
		raise HTTPException(status_code=422, detail="RFP upload file must not be empty")
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

	await _store_upload_bytes(
		storage_service,
		storage_path,
		contents,
		_content_type_for_upload(file, file_type),
	)

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
		"FastAPI /upload persisted request_id=%s rfp_id=%s filename=%s size=%d org=%s user=%s",
		request_id,
		rfp_id,
		filename,
		file_size,
		ctx.organization_id,
		ctx.user_id,
	)
	return RfpUploadResponse(
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
	response_model=AnalyzeJobResponse,
	status_code=202,
)
async def parse_rfp(
	rfp_id: str,
	request: Request,
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
) -> AnalyzeJobResponse:
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
	request_id = _log_entry(
		"parse_rfp",
		request,
		rfp_id=rfp_id,
		organization_id=ctx.organization_id,
	)
	return await _enqueue_analysis_job(rfp_id, ctx, session, request_id, "/parse")


@router.get("/{rfp_id}", response_model=RfpMetadata)
async def get_rfp(
	rfp_id: str,
	request: Request,
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
) -> RfpMetadata:
	"""Return tenant-scoped RFP document metadata."""
	_log_entry("get_rfp", request, rfp_id=rfp_id, organization_id=ctx.organization_id)
	try:
		row = await _get_rfp_document_row(rfp_id, ctx, session)
	except HTTPException:
		raise
	except Exception as exc:  # noqa: BLE001
		logger.exception("FastAPI /rfp metadata failed rfp_id=%s org=%s", rfp_id, ctx.organization_id)
		raise HTTPException(status_code=500, detail="Failed to load RFP metadata") from exc
	return _document_row_to_metadata(row)


@router.post(
	"/{rfp_id}/analyze",
	response_model=AnalyzeJobResponse,
	status_code=202,
)
async def analyze_rfp(
	rfp_id: str,
	request: Request,
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
) -> AnalyzeJobResponse:
	"""Enqueue RFP analysis using the same Temporal-backed parse pipeline."""
	request_id = _log_entry(
		"analyze_rfp",
		request,
		rfp_id=rfp_id,
		organization_id=ctx.organization_id,
	)
	return await _enqueue_analysis_job(rfp_id, ctx, session, request_id, "/analyze")


@router.get("/{rfp_id}/status", response_model=RfpStatusResponse)
async def get_rfp_status(
	rfp_id: str,
	request: Request,
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
) -> RfpStatusResponse:
	"""Return JSON parsing status for an RFP."""
	_log_entry("get_rfp_status", request, rfp_id=rfp_id, organization_id=ctx.organization_id)
	try:
		row = await _get_rfp_document_row(rfp_id, ctx, session)
	except HTTPException:
		raise
	except Exception as exc:  # noqa: BLE001
		logger.exception("FastAPI /status failed rfp_id=%s org=%s", rfp_id, ctx.organization_id)
		raise HTTPException(status_code=500, detail="Failed to load RFP status") from exc
	return RfpStatusResponse(
		rfp_id=rfp_id,
		organization_id=ctx.organization_id,
		status=_row_get(row, "parsing_status") or "pending",
		progress=_row_get(row, "parsing_progress") or 0,
		error=_row_get(row, "parsing_error"),
		started_at=_iso(_row_get(row, "parsing_started_at")),
		completed_at=_iso(_row_get(row, "parsing_completed_at")),
	)


@router.get("/{rfp_id}/requirements", response_model=RequirementListResponse)
async def list_requirements(
	rfp_id: str,
	request: Request,
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
) -> RequirementListResponse:
	"""List extracted requirements for an RFP, scoped to the caller's org.

	The 404 first checks that the document itself exists and belongs to
	the caller's tenant. That keeps cross-tenant probing from leaking a
	"this RFP exists, just not for you" signal — both states return 404.
	"""
	_log_entry("list_requirements", request, rfp_id=rfp_id, organization_id=ctx.organization_id)
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
					risk_level, extraction_confidence, ai_analysis,
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
	return RequirementListResponse(
		rfp_id=rfp_id,
		organization_id=ctx.organization_id,
		count=len(requirements),
		requirements=requirements,
	)


@router.get("/{rfp_id}/result", response_model=RfpResultResponse)
async def get_rfp_result(
	rfp_id: str,
	request: Request,
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
	latex_service: LaTeXService = Depends(get_latex_service),
) -> RfpResultResponse:
	"""Return parsed RFP result summary with PDF download metadata."""
	_log_entry("get_rfp_result", request, rfp_id=rfp_id, organization_id=ctx.organization_id)
	try:
		doc_row = await _get_rfp_document_row(rfp_id, ctx, session)
		rows = (
			await session.execute(
				text(
					"""
					SELECT
						id, requirement_number, title, requirement_text,
						source_quote, source_page, source_section,
						category, subcategory, requirement_type, priority,
						risk_level, extraction_confidence, ai_analysis,
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

		pdf_path = _compiled_pdf_path(ctx.organization_id, rfp_id)
		pdf_status = "compiled" if pdf_path.exists() else "not_compiled"
		pdf_errors: list[str] = []
		if rows and not pdf_path.exists():
			try:
				blocks = [
					_requirement_row_to_latex_block(row, index)
					for index, row in enumerate(rows, start=1)
				]
				pdf_bytes = await latex_service.compile_document(rfp_id, blocks)
				pdf_path.parent.mkdir(parents=True, exist_ok=True)
				pdf_path.write_bytes(pdf_bytes)
				pdf_status = "compiled"
			except LaTeXServiceError as exc:
				logger.warning(
					"FastAPI /result PDF compilation failed rfp_id=%s org=%s: %s",
					rfp_id,
					ctx.organization_id,
					exc,
				)
				pdf_status = "failed"
				pdf_errors = [str(exc)]
	except HTTPException:
		raise
	except Exception as exc:  # noqa: BLE001
		logger.exception("FastAPI /result failed rfp_id=%s org=%s", rfp_id, ctx.organization_id)
		raise HTTPException(status_code=500, detail="Failed to load RFP result") from exc

	requirements = [_requirement_row_to_dict(row) for row in rows]
	metadata = _document_row_to_metadata(doc_row)
	return RfpResultResponse(
		rfp_id=rfp_id,
		organization_id=ctx.organization_id,
		status=metadata.parsing_status,
		metadata=metadata,
		requirement_count=len(requirements),
		requirements=requirements,
		analysis=None,
		download_pdf_url=f"/api/v1/rfp/{rfp_id}/result.pdf" if pdf_path.exists() else None,
		pdf_status=pdf_status,
		pdf_errors=pdf_errors,
	)


@router.get("/{rfp_id}/result.pdf")
async def download_rfp_result_pdf(
	rfp_id: str,
	request: Request,
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
) -> FileResponse:
	"""Download the compiled RFP result PDF for the caller's tenant."""
	_log_entry("download_rfp_result_pdf", request, rfp_id=rfp_id, organization_id=ctx.organization_id)
	await _get_rfp_document_row(rfp_id, ctx, session)
	pdf_path = _compiled_pdf_path(ctx.organization_id, rfp_id)
	if not pdf_path.exists():
		raise HTTPException(status_code=404, detail="Compiled PDF not found")

	return FileResponse(
		pdf_path,
		media_type="application/pdf",
		filename=f"{rfp_id}-proposal.pdf",
	)


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
		"ai_analysis": row.get("ai_analysis"),
		"compliance_status": row.get("compliance_status"),
		"response_strategy": row.get("response_strategy"),
		"assigned_to": row.get("assigned_to"),
		"due_date": _iso(row.get("due_date")),
		"response_section": row.get("response_section"),
		"notes": row.get("notes"),
		"created_at": _iso(row.get("created_at")),
		"updated_at": _iso(row.get("updated_at")),
	}


def _row_to_requirement(row: Any) -> Any:
	"""Reconstruct an in-memory ``Requirement`` from a DB row.

	Used by ``/compliance-matrix`` to feed the matrix generator. The
	row's ``id`` is preserved so the resulting matrix entries reference
	the persisted requirement, not a regenerated UUID.
	"""
	from ...rfp.requirement_extractor import (
		Requirement,
		RequirementCategory,
		RequirementModality,
		RequirementType,
	)

	priority_to_modality = {
		"mandatory": RequirementModality.MANDATORY,
		"optional": RequirementModality.OPTIONAL,
		"preferred": RequirementModality.OPTIONAL,
	}
	priority = (row.get("priority") or "mandatory").lower()
	category_value = row.get("category") or "other"
	try:
		category_enum = RequirementCategory(category_value)
	except ValueError:
		category_enum = RequirementCategory.OTHER
	return Requirement(
		id=str(row["id"]),
		text=row.get("requirement_text") or "",
		modality=priority_to_modality.get(priority, RequirementModality.MANDATORY),
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


@router.post("/{rfp_id}/compliance-matrix", response_model=ComplianceMatrixResponse)
async def generate_matrix(
	rfp_id: str,
	request: Request,
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
) -> ComplianceMatrixResponse:
	"""Generate and persist a compliance matrix for the given RFP.

	Loads the requirements for the document (tenant-scoped), builds an
	in-memory ``ComplianceMatrix`` via ``ComplianceMatrixGenerator``,
	and writes it through ``save_to_db`` with the caller's org id.
	"""
	request_id = _log_entry("generate_matrix", request, rfp_id=rfp_id, organization_id=ctx.organization_id)
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

	from ...rfp.compliance_matrix import ComplianceMatrixGenerator

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
		"FastAPI /compliance-matrix persisted request_id=%s matrix_id=%s rfp_id=%s org=%s entries=%d",
		request_id,
		matrix_id,
		rfp_id,
		ctx.organization_id,
		len(matrix.mappings),
	)
	return ComplianceMatrixResponse(
		matrix_id=matrix_id,
		rfp_id=rfp_id,
		organization_id=ctx.organization_id,
		entry_count=len(matrix.mappings),
	)


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
_VALID_ENTRY_STATUSES = {
	"addressed",
	"compliant",
	"non_compliant",
	"not_addressed",
	"not_applicable",
	"partial",
	"pending",
}


@router.patch(
	"/{rfp_id}/compliance-matrix/{matrix_id}/entries/{entry_id}",
	response_model=ComplianceEntryUpdateResponse,
)
async def update_entry(
	rfp_id: str,
	matrix_id: str,
	entry_id: str,
	request: Request,
	update: dict[str, Any],
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
) -> ComplianceEntryUpdateResponse:
	"""Update a compliance matrix entry within the caller's org.

	Steps:
	  1. Validate the entry belongs to the caller's tenant **and** to
	     the requested matrix. Either mismatch returns 404.
	  2. Apply an allow-list to the update payload so unknown keys
	     (``organization_id``, ``matrix_id``, etc.) fail closed.
	  3. UPDATE the row and return its post-update state.
	"""
	_log_entry(
		"update_entry",
		request,
		rfp_id=rfp_id,
		matrix_id=matrix_id,
		entry_id=entry_id,
		organization_id=ctx.organization_id,
	)
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

	return ComplianceEntryUpdateResponse(
		entry_id=str(updated["id"]),
		matrix_id=str(updated["matrix_id"]),
		requirement_id=str(updated["requirement_id"]),
		organization_id=updated["organization_id"],
		status=updated["compliance_status"],
		response=updated.get("response_summary"),
		notes=updated.get("reviewer_notes"),
		assigned_to=updated.get("assigned_to"),
		updated_at=updated["updated_at"].isoformat() if updated.get("updated_at") else None,
	)


@router.post("/{rfp_id}/draft", response_model=DraftProposalResponse)
async def draft_proposal(
	rfp_id: str,
	request: Request,
	ctx: TenantContext = Depends(require_tenant),
	session: AsyncSession = Depends(get_async_db_session),
) -> DraftProposalResponse:
	"""Generate a proposal draft from the RFP's compliance matrix."""
	from ...orchestration.proposal_orchestrator import ProposalOrchestrator

	request_id = _log_entry("draft_proposal", request, rfp_id=rfp_id, organization_id=ctx.organization_id)
	orchestrator = ProposalOrchestrator()
	draft = await orchestrator.draft_proposal(rfp_id, session)
	logger.info(
		"FastAPI /draft completed: request_id=%s rfp_id=%s org=%s sections=%d",
		request_id,
		rfp_id,
		ctx.organization_id,
		len(draft.sections),
	)
	return DraftProposalResponse(
		rfp_id=rfp_id,
		organization_id=ctx.organization_id,
		sections=draft.sections,
		review_feedback=draft.review_feedback,
		compliance_diff=draft.compliance_diff,
	)
