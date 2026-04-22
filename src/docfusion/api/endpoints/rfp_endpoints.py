#!/usr/bin/env python3
"""FastAPI endpoints for the RFP ingestion pipeline."""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from ...core.utils import uuid7str
from ...rfp.compliance_matrix import ComplianceMatrixGenerator
from ...rfp.requirement_extractor import RequirementExtractor
from ...rfp.rfp_analyzer import RFPAnalyzer

router = APIRouter(prefix="/api/v1/rfp", tags=["rfp"])

logger = logging.getLogger(__name__)


class UploadResponse(BaseModel):
	"""Response from RFP upload."""

	model_config = ConfigDict(extra="forbid")

	rfp_id: str
	filename: str
	size: int


class ParseResponse(BaseModel):
	"""Response from RFP parse."""

	model_config = ConfigDict(extra="forbid")

	rfp_id: str
	requirement_count: int
	analysis_id: str | None = None


@router.post("/upload", response_model=UploadResponse)
async def upload_rfp(file: UploadFile = File(...)) -> UploadResponse:
	"""Upload an RFP document for processing."""
	rfp_id = uuid7str()
	contents = await file.read()
	# Store via SecureStorageService in production;
	# for now return metadata so the client can call /parse next.
	logger.info(f"Uploaded RFP {rfp_id}: {file.filename} ({len(contents)} bytes)")
	return UploadResponse(rfp_id=rfp_id, filename=file.filename or "unknown", size=len(contents))


@router.post("/{rfp_id}/parse", response_model=ParseResponse)
async def parse_rfp(rfp_id: str) -> ParseResponse:
	"""Parse an uploaded RFP and extract requirements."""
	# In production this loads the stored bytes and runs DoclingService.
	# For the endpoint contract we accept the rfp_id and return counts.
	extractor = RequirementExtractor({"ai_enhancement": True})
	# Placeholder: real implementation would load document text from storage
	text = "The contractor shall provide 24/7 support. The system must support SSO."
	extraction = await extractor.extract_from_text(text)
	return ParseResponse(
		rfp_id=rfp_id,
		requirement_count=len(extraction.requirements),
	)


@router.get("/{rfp_id}/status")
async def stream_status(rfp_id: str) -> StreamingResponse:
	"""Stream SSE events for RFP parsing status."""
	async def event_stream():
		yield f"data: {{'rfp_id': '{rfp_id}', 'status': 'ready'}}\n\n"

	return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/{rfp_id}/requirements")
async def list_requirements(rfp_id: str) -> list[dict[str, Any]]:
	"""List extracted requirements for an RFP."""
	# In production this queries rfp_requirements table.
	return []


@router.post("/{rfp_id}/compliance-matrix")
async def generate_matrix(rfp_id: str) -> dict[str, Any]:
	"""Generate a compliance matrix for an RFP."""
	generator = ComplianceMatrixGenerator()
	# Placeholder: real implementation loads requirements and generates matrix
	return {"matrix_id": uuid7str(), "entry_count": 0, "rfp_id": rfp_id}


@router.patch("/{rfp_id}/compliance-matrix/{matrix_id}/entries/{entry_id}")
async def update_entry(
	rfp_id: str,
	matrix_id: str,
	entry_id: str,
	update: dict[str, Any],
) -> dict[str, Any]:
	"""Update a compliance matrix entry."""
	return {"ok": True, "entry_id": entry_id, "updated": update}
