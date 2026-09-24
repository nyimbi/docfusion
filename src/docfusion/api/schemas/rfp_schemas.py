"""Pydantic response schemas for FastAPI RFP endpoints."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RfpUploadResponse(BaseModel):
	"""Response returned after an RFP upload is accepted."""

	model_config = ConfigDict(extra="forbid")

	rfp_id: str
	filename: str
	size: int
	organization_id: str
	file_hash: str
	storage_path: str
	parsing_status: str


class AnalyzeJobResponse(BaseModel):
	"""Response returned after RFP analysis work is enqueued."""

	model_config = ConfigDict(extra="forbid")

	rfp_id: str
	workflow_id: str
	run_id: str
	status: str


class RfpMetadata(BaseModel):
	"""Metadata for a stored RFP document."""

	model_config = ConfigDict(extra="forbid")

	rfp_id: str
	organization_id: str
	filename: str
	file_type: str | None = None
	file_size: int | None = None
	storage_path: str | None = None
	file_hash: str | None = None
	parsing_status: str
	parsing_progress: int = 0
	parsing_error: str | None = None
	parsing_started_at: str | None = None
	parsing_completed_at: str | None = None
	uploaded_by: str | None = None
	opportunity_id: str | None = None
	created_at: str | None = None
	updated_at: str | None = None


class RfpStatusResponse(BaseModel):
	"""Current RFP parsing status."""

	model_config = ConfigDict(extra="forbid")

	rfp_id: str
	organization_id: str
	status: str
	progress: int = Field(ge=0, le=100)
	error: str | None = None
	started_at: str | None = None
	completed_at: str | None = None


class RequirementSummary(BaseModel):
	"""Requirement row returned by RFP requirement endpoints."""

	model_config = ConfigDict(extra="forbid")

	id: str
	requirement_number: str | None = None
	title: str | None = None
	requirement_text: str | None = None
	source_quote: str | None = None
	source_page: int | None = None
	source_section: str | None = None
	category: str | None = None
	subcategory: str | None = None
	requirement_type: str | None = None
	priority: str | None = None
	risk_level: str | None = None
	extraction_confidence: float | None = None
	ai_analysis: dict[str, Any] | None = None
	compliance_status: str | None = None
	response_strategy: str | None = None
	assigned_to: str | None = None
	due_date: str | None = None
	response_section: str | None = None
	notes: str | None = None
	created_at: str | None = None
	updated_at: str | None = None


class RequirementListResponse(BaseModel):
	"""List of requirements extracted from an RFP."""

	model_config = ConfigDict(extra="forbid")

	rfp_id: str
	organization_id: str
	count: int
	requirements: list[RequirementSummary]


class ComplianceMatrixResponse(BaseModel):
	"""Response returned after generating a compliance matrix."""

	model_config = ConfigDict(extra="forbid")

	matrix_id: str
	rfp_id: str
	organization_id: str
	entry_count: int


class ComplianceEntryUpdateResponse(BaseModel):
	"""Response returned after updating a compliance matrix entry."""

	model_config = ConfigDict(extra="forbid")

	entry_id: str
	matrix_id: str
	requirement_id: str
	organization_id: str
	status: str | None = None
	response: str | None = None
	notes: str | None = None
	assigned_to: str | None = None
	updated_at: str | None = None


class RfpResultResponse(BaseModel):
	"""Parsed RFP result summary."""

	model_config = ConfigDict(extra="forbid")

	rfp_id: str
	organization_id: str
	status: str
	metadata: RfpMetadata
	requirement_count: int
	requirements: list[RequirementSummary]
	analysis: dict[str, Any] | None = None
	download_pdf_url: str | None = None
	pdf_status: str | None = None
	pdf_errors: list[str] = Field(default_factory=list)


class DraftProposalResponse(BaseModel):
	"""Response returned after drafting a proposal from an RFP."""

	model_config = ConfigDict(extra="forbid")

	rfp_id: str
	organization_id: str
	sections: Any
	review_feedback: Any
	compliance_diff: Any


UploadResponse = RfpUploadResponse
ParseEnqueuedResponse = AnalyzeJobResponse
