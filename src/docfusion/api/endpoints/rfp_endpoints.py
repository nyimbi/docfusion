#!/usr/bin/env python3
"""FastAPI endpoints for the RFP ingestion pipeline.

Every route here is tenant-gated via :func:`require_tenant`, which reads
``x-docfusion-user-id`` and ``x-docfusion-organization-id`` headers
injected by the Next.js BFF. FastAPI never inspects the user's session
cookie directly — the BFF is the trust boundary.

W3 status:
  * Auth: ``Depends(require_tenant)`` is now mandatory on every handler.
  * Fake fixtures (hardcoded test text in ``parse_rfp``, ``[]`` from
	``list_requirements``, dummy ``entry_count: 0`` from
	``generate_matrix``) have been replaced with explicit
	``501 Not Implemented`` responses. Returning honest 501 is strictly
	better than silently returning fake data — the audit's Critical #4
	finding was that callers could not tell the difference between a
	real and a faked response.
  * Full DB wire-up (writing to ``rfp_documents`` /
	``rfp_requirements`` / ``compliance_matrices`` from these handlers)
	is deferred to W3b. It requires verification against a running
	FastAPI + Postgres deployment that this branch cannot exercise in
	CI alone.

If your client needs the real pipeline today, route through the Next.js
``/api/v1/rfp/...`` endpoints — those are fully wired (W1).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import TenantContext, require_tenant
from ...core.database.session import get_async_db_session
from ...core.utils import uuid7str
from ...orchestration.proposal_orchestrator import ProposalOrchestrator
from ...rfp.compliance_matrix import ComplianceMatrixGenerator  # noqa: F401  (re-exported for callers)
from ...rfp.requirement_extractor import RequirementExtractor  # noqa: F401  (re-exported for callers)
from ...rfp.rfp_analyzer import RFPAnalyzer  # noqa: F401  (re-exported for callers)

router = APIRouter(prefix="/api/v1/rfp", tags=["rfp"])

logger = logging.getLogger(__name__)

# Detail string returned by every handler whose DB wire-up is deferred.
# Clients can branch on this exact phrase to fall back to the Next.js
# pipeline without having to parse status codes.
_NOT_WIRED_DETAIL = "FastAPI handler not yet wired to DB; use the Next.js /api/v1/rfp/* endpoints"


class UploadResponse(BaseModel):
	"""Response from RFP upload."""

	model_config = ConfigDict(extra="forbid")

	rfp_id: str
	filename: str
	size: int
	organization_id: str


@router.post("/upload", response_model=UploadResponse, status_code=202)
async def upload_rfp(
	file: UploadFile = File(...),
	ctx: TenantContext = Depends(require_tenant),
) -> UploadResponse:
	"""Upload an RFP document for processing.

	W3: returns metadata only. Full storage + ``rfp_documents`` insert
	is deferred to W3b — the Next.js ``/api/v1/rfp/upload`` route already
	does the full pipeline today.
	"""
	rfp_id = uuid7str()
	contents = await file.read()
	logger.info(
		"FastAPI /upload received: rfp_id=%s filename=%s size=%d org=%s user=%s",
		rfp_id,
		file.filename,
		len(contents),
		ctx.organization_id,
		ctx.user_id,
	)
	return UploadResponse(
		rfp_id=rfp_id,
		filename=file.filename or "unknown",
		size=len(contents),
		organization_id=ctx.organization_id,
	)


@router.post("/{rfp_id}/parse", status_code=501)
async def parse_rfp(
	rfp_id: str,
	ctx: TenantContext = Depends(require_tenant),
) -> dict[str, object]:
	"""Parse an uploaded RFP and extract requirements.

	W3: returns 501 Not Implemented. Previously hardcoded test text
	(``The contractor shall provide 24/7 support...``) and a synthetic
	``requirement_count`` — both fake, both indistinguishable from real
	output. The Next.js ``/api/v1/rfp/{id}/parse`` route is the
	canonical pipeline today.
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
	"""Stream SSE events for RFP parsing status.

	W3: still emits a single ``ready`` event. SSE wiring is independent
	of DB wire-up and the previous behaviour was correct in shape; only
	the auth gap (no tenant check) needed closing.
	"""
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
	"""List extracted requirements for an RFP.

	W3: returns 501. Previously returned a hardcoded ``[]`` regardless
	of input. The Next.js ``/api/v1/rfp/{id}/requirements`` route serves
	the real, tenant-scoped query today.
	"""
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
	"""Generate a compliance matrix for an RFP.

	W3: returns 501. Previously instantiated a ``ComplianceMatrixGenerator``,
	ignored it, and returned a synthetic ``{matrix_id, entry_count: 0}``.
	The matrix generator itself is real (W2 bounded its in-memory cache);
	wiring the FastAPI handler to actually use it is deferred to W3b.
	"""
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
	"""Update a compliance matrix entry.

	W3: returns 501. Previously echoed the input back as ``{ok: True}``
	without persisting anything. The Next.js
	``/api/v1/compliance-matrix/{matrixId}/entries/{entryId}/workflow``
	route (W1) is the real path.
	"""
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
	"""Generate a proposal draft from the RFP's compliance matrix.

	This is the only handler with real DB-backed work today: the
	``ProposalOrchestrator`` already loads the compliance matrix from
	Postgres via ``ComplianceMatrixGenerator.load_from_db``. The W3 fix
	here is the auth gap — every other handler was anonymous.
	"""
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
