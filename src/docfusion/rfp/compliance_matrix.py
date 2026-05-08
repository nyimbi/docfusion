#!/usr/bin/env python3
"""
Compliance Matrix Generator

Maps RFP requirements to response sections and tracks coverage for proposal
compliance. Provides gap identification, progress tracking, and export
capabilities for compliance dashboards and reporting.

Features:
- Requirement-to-section mapping with status tracking
- Coverage percentage calculation
- Gap identification for unaddressed requirements
- Real-time update support for document integration
- Export to Excel/CSV formats
- Dashboard-ready data structures
"""

import asyncio
import csv
import json
import logging
from datetime import datetime, timezone
from enum import Enum
from io import BytesIO, StringIO
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .requirement_extractor import Requirement, RequirementModality, RequirementType
from ..core.utils import uuid7str

class ComplianceStatus(str, Enum):
	"""Status of requirement compliance in response"""

	NOT_ADDRESSED = "not_addressed"
	IN_PROGRESS = "in_progress"
	ADDRESSED = "addressed"
	VERIFIED = "verified"

class RequirementMapping(BaseModel):
	"""
	Mapping between a requirement and response section.

	Tracks the status of addressing a specific requirement within the
	proposal response, including confidence scores and notes.

	Attributes:
		id: Unique identifier for this mapping
		requirement_id: ID of the requirement being mapped
		requirement_text: Copy of the requirement text for reference
		section_id: ID of the response section addressing this requirement
		section_title: Title of the response section
		status: Current compliance status
		confidence: Confidence that section addresses requirement (0.0-1.0)
		notes: Additional notes about this mapping
		created_at: When this mapping was created
		updated_at: When this mapping was last updated
		category: Requirement category (mandatory/optional/conditional)
		requirement_type: Type of requirement (functional/technical/etc.)
	"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	id: str = Field(default_factory=uuid7str)
	requirement_id: str = Field(..., description="ID of the requirement being mapped")
	requirement_text: str = Field(default="", description="Copy of requirement text for reference")
	section_id: str | None = Field(default=None, description="ID of the response section")
	section_title: str | None = Field(default=None, description="Title of the response section")
	status: ComplianceStatus = Field(
		default=ComplianceStatus.NOT_ADDRESSED,
		description="Current compliance status"
	)
	confidence: float = Field(
		default=0.0, ge=0.0, le=1.0,
		description="Confidence that section addresses requirement"
	)
	notes: str = Field(default="", description="Additional notes about this mapping")
	created_at: datetime = Field(default_factory=datetime.now)
	updated_at: datetime = Field(default_factory=datetime.now)
	modality: RequirementModality = Field(
		default=RequirementModality.MANDATORY,
		description="Requirement category"
	)
	requirement_type: RequirementType = Field(
		default=RequirementType.UNKNOWN,
		description="Type of requirement"
	)
	source_section: str = Field(default="", description="Source section in RFP document")
	page_number: int | None = Field(default=None, description="Page number in RFP")

	def update_status(self, new_status: ComplianceStatus, confidence: float | None = None) -> None:
		"""
		Update the compliance status of this mapping.

		Args:
			new_status: New compliance status to set
			confidence: Optional new confidence score
		"""
		self.status = new_status
		if confidence is not None:
			self.confidence = confidence
		self.updated_at = datetime.now()

class ComplianceMatrix(BaseModel):
	"""
	Compliance matrix tracking requirement coverage.

	A comprehensive matrix that maps all RFP requirements to their
	compliance status within the proposal response, providing
	analytics, gap identification, and export capabilities.

	Attributes:
		id: Unique identifier for this matrix
		rfp_id: ID of the RFP document
		name: Human-readable name for this matrix
		description: Optional description
		mappings: List of requirement mappings
		created_at: When this matrix was created
		updated_at: When this matrix was last updated
		metadata: Additional metadata
	"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	id: str = Field(default_factory=uuid7str)
	rfp_id: str = Field(..., description="ID of the RFP document")
	name: str = Field(default="Compliance Matrix", description="Matrix name")
	description: str = Field(default="", description="Matrix description")
	mappings: list[RequirementMapping] = Field(
		default_factory=list,
		description="Requirement mappings"
	)
	created_at: datetime = Field(default_factory=datetime.now)
	updated_at: datetime = Field(default_factory=datetime.now)
	metadata: dict[str, Any] = Field(
		default_factory=dict,
		description="Additional metadata"
	)

	def get_coverage_percentage(self) -> float:
		"""
		Calculate overall compliance coverage percentage.

		Returns:
			Percentage of requirements that are addressed or verified (0.0-100.0)
		"""
		if not self.mappings:
			return 0.0

		addressed = sum(
			1 for m in self.mappings
			if m.status in (ComplianceStatus.ADDRESSED, ComplianceStatus.VERIFIED)
		)
		return round((addressed / len(self.mappings)) * 100, 2)

	def get_coverage_by_category(self) -> dict[str, float]:
		"""
		Calculate coverage percentage by requirement category.

		Returns:
			Dictionary mapping category names to coverage percentages
		"""
		if not self.mappings:
			return {}

		by_category: dict[str, dict[str, int]] = {}

		for mapping in self.mappings:
			cat = mapping.modality.value
			if cat not in by_category:
				by_category[cat] = {"addressed": 0, "total": 0}
			by_category[cat]["total"] += 1
			if mapping.status in (ComplianceStatus.ADDRESSED, ComplianceStatus.VERIFIED):
				by_category[cat]["addressed"] += 1

		return {
			cat: round((data["addressed"] / data["total"]) * 100, 2)
			for cat, data in by_category.items()
		}

	def get_coverage_by_type(self) -> dict[str, float]:
		"""
		Calculate coverage percentage by requirement type.

		Returns:
			Dictionary mapping type names to coverage percentages
		"""
		if not self.mappings:
			return {}

		by_type: dict[str, dict[str, int]] = {}

		for mapping in self.mappings:
			req_type = mapping.requirement_type.value
			if req_type not in by_type:
				by_type[req_type] = {"addressed": 0, "total": 0}
			by_type[req_type]["total"] += 1
			if mapping.status in (ComplianceStatus.ADDRESSED, ComplianceStatus.VERIFIED):
				by_type[req_type]["addressed"] += 1

		return {
			t: round((data["addressed"] / data["total"]) * 100, 2)
			for t, data in by_type.items()
		}

	def get_gaps(self) -> list[RequirementMapping]:
		"""
		Get unaddressed requirements (compliance gaps).

		Returns:
			List of mappings with NOT_ADDRESSED status
		"""
		return [
			m for m in self.mappings
			if m.status == ComplianceStatus.NOT_ADDRESSED
		]

	def get_in_progress(self) -> list[RequirementMapping]:
		"""
		Get requirements currently being addressed.

		Returns:
			List of mappings with IN_PROGRESS status
		"""
		return [
			m for m in self.mappings
			if m.status == ComplianceStatus.IN_PROGRESS
		]

	def get_addressed(self) -> list[RequirementMapping]:
		"""
		Get successfully addressed requirements.

		Returns:
			List of mappings with ADDRESSED or VERIFIED status
		"""
		return [
			m for m in self.mappings
			if m.status in (ComplianceStatus.ADDRESSED, ComplianceStatus.VERIFIED)
		]

	def get_verified(self) -> list[RequirementMapping]:
		"""
		Get verified requirements.

		Returns:
			List of mappings with VERIFIED status
		"""
		return [
			m for m in self.mappings
			if m.status == ComplianceStatus.VERIFIED
		]

	def get_summary(self) -> dict[str, Any]:
		"""
		Get a summary of compliance status.

		Returns:
			Dictionary with counts by status
		"""
		status_counts = {
			ComplianceStatus.NOT_ADDRESSED: 0,
			ComplianceStatus.IN_PROGRESS: 0,
			ComplianceStatus.ADDRESSED: 0,
			ComplianceStatus.VERIFIED: 0,
		}

		for mapping in self.mappings:
			status_counts[mapping.status] += 1

		return {
			"total_requirements": len(self.mappings),
			"not_addressed": status_counts[ComplianceStatus.NOT_ADDRESSED],
			"in_progress": status_counts[ComplianceStatus.IN_PROGRESS],
			"addressed": status_counts[ComplianceStatus.ADDRESSED],
			"verified": status_counts[ComplianceStatus.VERIFIED],
			"coverage_percentage": self.get_coverage_percentage(),
			"coverage_by_category": self.get_coverage_by_category(),
			"coverage_by_type": self.get_coverage_by_type(),
			"gap_count": len(self.get_gaps()),
		}

	def export_csv(self) -> str:
		"""
		Export matrix to CSV format.

		Returns:
			CSV string representation of the matrix
		"""
		output = StringIO()
		writer = csv.writer(output)

		# Header
		writer.writerow([
			"Requirement ID",
			"Requirement Text",
			"Category",
			"Type",
			"Source Section",
			"Page",
			"Section ID",
			"Section Title",
			"Status",
			"Confidence",
			"Notes",
			"Created",
			"Updated",
		])

		# Data rows
		for mapping in self.mappings:
			writer.writerow([
				mapping.requirement_id,
				mapping.requirement_text[:200] + "..." if len(mapping.requirement_text) > 200 else mapping.requirement_text,
				mapping.modality.value,
				mapping.requirement_type.value,
				mapping.source_section,
				mapping.page_number or "",
				mapping.section_id or "",
				mapping.section_title or "",
				mapping.status.value,
				f"{mapping.confidence:.2f}",
				mapping.notes,
				mapping.created_at.isoformat(),
				mapping.updated_at.isoformat(),
			])

		return output.getvalue()

	def export_excel(self) -> bytes:
		"""
		Export matrix to Excel format.

		Returns:
			Excel file bytes
		"""
		try:
			import openpyxl
			from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
			from openpyxl.utils import get_column_letter
		except ImportError:
			# Fallback to CSV if openpyxl not available
			return self.export_csv().encode('utf-8')

		wb = openpyxl.Workbook()
		ws = wb.active
		ws.title = "Compliance Matrix"

		# Styles
		header_font = Font(bold=True, color="FFFFFF")
		header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
		header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

		status_fills = {
			ComplianceStatus.NOT_ADDRESSED: PatternFill(start_color="FFCDD2", end_color="FFCDD2", fill_type="solid"),
			ComplianceStatus.IN_PROGRESS: PatternFill(start_color="FFF9C4", end_color="FFF9C4", fill_type="solid"),
			ComplianceStatus.ADDRESSED: PatternFill(start_color="C8E6C9", end_color="C8E6C9", fill_type="solid"),
			ComplianceStatus.VERIFIED: PatternFill(start_color="81C784", end_color="81C784", fill_type="solid"),
		}

		thin_border = Border(
			left=Side(style='thin'),
			right=Side(style='thin'),
			top=Side(style='thin'),
			bottom=Side(style='thin')
		)

		# Headers
		headers = [
			"Requirement ID",
			"Requirement Text",
			"Category",
			"Type",
			"Source Section",
			"Page",
			"Section ID",
			"Section Title",
			"Status",
			"Confidence",
			"Notes",
			"Created",
			"Updated",
		]

		for col, header in enumerate(headers, 1):
			cell = ws.cell(row=1, column=col, value=header)
			cell.font = header_font
			cell.fill = header_fill
			cell.alignment = header_alignment
			cell.border = thin_border

		# Data rows
		for row_idx, mapping in enumerate(self.mappings, 2):
			row_data = [
				mapping.requirement_id,
				mapping.requirement_text[:500],  # Limit text length
				mapping.modality.value,
				mapping.requirement_type.value,
				mapping.source_section,
				mapping.page_number or "",
				mapping.section_id or "",
				mapping.section_title or "",
				mapping.status.value,
				round(mapping.confidence, 2),
				mapping.notes,
				mapping.created_at.strftime("%Y-%m-%d %H:%M"),
				mapping.updated_at.strftime("%Y-%m-%d %H:%M"),
			]

			for col_idx, value in enumerate(row_data, 1):
				cell = ws.cell(row=row_idx, column=col_idx, value=value)
				cell.border = thin_border
				cell.alignment = Alignment(wrap_text=True, vertical="top")

				# Apply status-based fill
				if col_idx == 9:  # Status column
					cell.fill = status_fills.get(mapping.status, PatternFill())

		# Adjust column widths
		column_widths = {
			'A': 15,  # Requirement ID
			'B': 50,  # Requirement Text
			'C': 12,  # Category
			'D': 12,  # Type
			'E': 20,  # Source Section
			'F': 8,   # Page
			'G': 15,  # Section ID
			'H': 30,  # Section Title
			'I': 15,  # Status
			'J': 12,  # Confidence
			'K': 30,  # Notes
			'L': 18,  # Created
			'M': 18,  # Updated
		}

		for col_letter, width in column_widths.items():
			ws.column_dimensions[col_letter].width = width

		# Add summary sheet
		summary_ws = wb.create_sheet(title="Summary")
		summary = self.get_summary()

		summary_data = [
			["Metric", "Value"],
			["Total Requirements", summary["total_requirements"]],
			["Not Addressed", summary["not_addressed"]],
			["In Progress", summary["in_progress"]],
			["Addressed", summary["addressed"]],
			["Verified", summary["verified"]],
			["Coverage Percentage", f"{summary['coverage_percentage']}%"],
			["Gap Count", summary["gap_count"]],
		]

		for row_idx, row_data in enumerate(summary_data, 1):
			for col_idx, value in enumerate(row_data, 1):
				cell = summary_ws.cell(row=row_idx, column=col_idx, value=value)
				if row_idx == 1:
					cell.font = header_font
					cell.fill = header_fill
				cell.border = thin_border

		summary_ws.column_dimensions['A'].width = 20
		summary_ws.column_dimensions['B'].width = 15

		# Add coverage by category sheet
		category_ws = wb.create_sheet(title="Coverage by Category")
		coverage_by_cat = self.get_coverage_by_category()

		cat_headers = ["Category", "Coverage %"]
		for col_idx, header in enumerate(cat_headers, 1):
			cell = category_ws.cell(row=1, column=col_idx, value=header)
			cell.font = header_font
			cell.fill = header_fill
			cell.border = thin_border

		for row_idx, (cat, coverage) in enumerate(coverage_by_cat.items(), 2):
			category_ws.cell(row=row_idx, column=1, value=cat).border = thin_border
			category_ws.cell(row=row_idx, column=2, value=f"{coverage}%").border = thin_border

		category_ws.column_dimensions['A'].width = 15
		category_ws.column_dimensions['B'].width = 15

		# Write to bytes
		output = BytesIO()
		wb.save(output)
		output.seek(0)
		return output.read()

	def get_mapping_by_requirement(self, requirement_id: str) -> RequirementMapping | None:
		"""
		Get mapping for a specific requirement.

		Args:
			requirement_id: ID of the requirement

		Returns:
			Mapping if found, None otherwise
		"""
		for mapping in self.mappings:
			if mapping.requirement_id == requirement_id:
				return mapping
		return None

	def add_mapping(self, mapping: RequirementMapping) -> None:
		"""
		Add a new requirement mapping.

		Args:
			mapping: The mapping to add
		"""
		self.mappings.append(mapping)
		self.updated_at = datetime.now()

	def update_mapping_status(
		self,
		requirement_id: str,
		status: ComplianceStatus,
		confidence: float | None = None,
		section_id: str | None = None,
		section_title: str | None = None,
		notes: str | None = None,
	) -> bool:
		"""
		Update the status of a requirement mapping.

		Args:
			requirement_id: ID of the requirement to update
			status: New compliance status
			confidence: Optional new confidence score
			section_id: Optional section ID
			section_title: Optional section title
			notes: Optional notes

		Returns:
			True if mapping was found and updated, False otherwise
		"""
		mapping = self.get_mapping_by_requirement(requirement_id)
		if mapping:
			mapping.update_status(status, confidence)
			if section_id is not None:
				mapping.section_id = section_id
			if section_title is not None:
				mapping.section_title = section_title
			if notes is not None:
				mapping.notes = notes
			self.updated_at = datetime.now()
			return True
		return False

class ComplianceMatrixGenerator:
	"""
	Generator for compliance matrices from RFP requirements.

	Creates compliance matrices that map requirements to response sections,
	track coverage, and identify gaps. Supports real-time updates via
	callbacks and integrates with document engines.

	Features:
	- Generate matrix from extracted requirements
	- Real-time status updates
	- Coverage analytics
	- Gap identification
	- Dashboard data generation
	- Export capabilities
	"""

	def __init__(self, config: dict[str, Any] | None = None):
		"""
		Initialize the compliance matrix generator.

		Args:
			config: Optional configuration dictionary
		"""
		self.config = self._get_default_config()
		if config:
			self.config.update(config)
		self.logger = logging.getLogger(__name__)

		# Storage for matrices (in production, would use database)
		self._matrices: dict[str, ComplianceMatrix] = {}

		# Update callbacks for real-time notifications
		self._update_callbacks: list[callable] = []

		self._log_generator_initialized()

	def _get_default_config(self) -> dict[str, Any]:
		"""Get default configuration"""
		return {
			"auto_verify_threshold": 0.95,  # Confidence threshold for auto-verification
			"gap_alert_threshold": 0.3,    # Alert if gap rate exceeds this
			"min_confidence_for_addressed": 0.7,
			"track_update_history": True,
			"max_history_entries": 100,
		}

	def _log_generator_initialized(self) -> None:
		"""Log generator initialization"""
		self.logger.info("ComplianceMatrixGenerator initialized")

	def _log_matrix_created(self, rfp_id: str, count: int) -> None:
		"""Log matrix creation"""
		self.logger.info(f"Created compliance matrix for RFP {rfp_id} with {count} requirements")

	def _log_status_update(self, requirement_id: str, status: ComplianceStatus) -> None:
		"""Log status update"""
		self.logger.debug(f"Updated requirement {requirement_id} to {status.value}")

	async def generate_matrix(
		self,
		requirements: list[Requirement],
		rfp_id: str,
		name: str = "Compliance Matrix",
		description: str = "",
	) -> ComplianceMatrix:
		"""
		Generate a compliance matrix from extracted requirements.

		Args:
			requirements: List of extracted requirements
			rfp_id: ID of the RFP document
			name: Human-readable name for the matrix
			description: Optional description

		Returns:
			Generated ComplianceMatrix
		"""
		matrix = ComplianceMatrix(
			rfp_id=rfp_id,
			name=name,
			description=description,
		)

		# Create mappings from requirements
		for req in requirements:
			mapping = RequirementMapping(
				requirement_id=req.id,
				requirement_text=req.text,
				modality=req.modality,
				requirement_type=req.requirement_type,
				source_section=req.section,
				page_number=req.page_number,
				status=ComplianceStatus.NOT_ADDRESSED,
				confidence=req.confidence,
			)
			matrix.add_mapping(mapping)

		# Store the matrix
		self._matrices[matrix.id] = matrix

		self._log_matrix_created(rfp_id, len(requirements))
		return matrix

	async def generate_matrix_from_extraction_result(
		self,
		extraction_result: Any,  # RequirementExtractionResult
		rfp_id: str,
		name: str = "Compliance Matrix",
		description: str = "",
	) -> ComplianceMatrix:
		"""
		Generate compliance matrix from extraction result.

		Args:
			extraction_result: Result from RequirementExtractor
			rfp_id: ID of the RFP document
			name: Human-readable name for the matrix
			description: Optional description

		Returns:
			Generated ComplianceMatrix
		"""
		return await self.generate_matrix(
			requirements=extraction_result.requirements,
			rfp_id=rfp_id,
			name=name,
			description=description,
		)

	async def update_mapping(
		self,
		matrix_id: str,
		requirement_id: str,
		section_id: str | None = None,
		section_title: str | None = None,
		status: ComplianceStatus | None = None,
		confidence: float | None = None,
		notes: str | None = None,
	) -> bool:
		"""
		Update a requirement mapping in a matrix.

		Args:
			matrix_id: ID of the compliance matrix
			requirement_id: ID of the requirement to update
			section_id: Optional response section ID
			section_title: Optional response section title
			status: Optional new compliance status
			confidence: Optional new confidence score
			notes: Optional notes

		Returns:
			True if successful, False if matrix or requirement not found
		"""
		matrix = self._matrices.get(matrix_id)
		if not matrix:
			self.logger.warning(f"Matrix {matrix_id} not found")
			return False

		# Determine status if not provided
		if status is None and confidence is not None:
			if confidence >= self.config["auto_verify_threshold"]:
				status = ComplianceStatus.VERIFIED
			elif confidence >= self.config["min_confidence_for_addressed"]:
				status = ComplianceStatus.ADDRESSED
			else:
				status = ComplianceStatus.IN_PROGRESS

		result = matrix.update_mapping_status(
			requirement_id=requirement_id,
			status=status or ComplianceStatus.NOT_ADDRESSED,
			confidence=confidence,
			section_id=section_id,
			section_title=section_title,
			notes=notes,
		)

		if result:
			self._log_status_update(requirement_id, status or ComplianceStatus.NOT_ADDRESSED)
			await self._notify_callbacks(matrix_id, requirement_id, status)

		return result

	def register_update_callback(self, callback: callable) -> None:
		"""
		Register a callback for matrix updates.

		Args:
			callback: Async function to call on updates
		"""
		self._update_callbacks.append(callback)

	async def _notify_callbacks(
		self,
		matrix_id: str,
		requirement_id: str,
		status: ComplianceStatus,
	) -> None:
		"""Notify all registered callbacks of an update"""
		for callback in self._update_callbacks:
			try:
				if asyncio.iscoroutinefunction(callback):
					await callback(matrix_id, requirement_id, status)
				else:
					callback(matrix_id, requirement_id, status)
			except Exception as e:
				self.logger.error(f"Callback error: {e}")

	def get_matrix(self, matrix_id: str) -> ComplianceMatrix | None:
		"""
		Get a compliance matrix by ID.

		Args:
			matrix_id: ID of the matrix

		Returns:
			Matrix if found, None otherwise
		"""
		return self._matrices.get(matrix_id)

	def get_dashboard_data(self, matrix_id: str) -> dict[str, Any]:
		"""
		Get dashboard-ready data for a compliance matrix.

		Generates data structures suitable for visualization in
		compliance dashboards, including charts and progress indicators.

		Args:
			matrix_id: ID of the matrix

		Returns:
			Dictionary with dashboard-ready data
		"""
		matrix = self._matrices.get(matrix_id)
		if not matrix:
			return {"error": "Matrix not found", "matrix_id": matrix_id}

		summary = matrix.get_summary()

		# Prepare chart data
		status_distribution = {
			"not_addressed": summary["not_addressed"],
			"in_progress": summary["in_progress"],
			"addressed": summary["addressed"],
			"verified": summary["verified"],
		}

		# Gap analysis
		gaps = matrix.get_gaps()
		gap_details = [
			{
				"requirement_id": gap.requirement_id,
				"requirement_text": gap.requirement_text[:100] + "...",
				"category": gap.modality.value,
				"type": gap.requirement_type.value,
				"section": gap.source_section,
			}
			for gap in gaps[:20]  # Top 20 gaps
		]

		# Progress timeline (simulated - in production would use actual history)
		progress_timeline = {
			"current": summary["coverage_percentage"],
			"target": 100.0,
			"remaining": 100.0 - summary["coverage_percentage"],
		}

		# Critical requirements (mandatory + not addressed)
		critical_gaps = [
			{
				"requirement_id": gap.requirement_id,
				"requirement_text": gap.requirement_text[:100] + "...",
				"section": gap.source_section,
			}
			for gap in gaps
			if gap.modality == RequirementModality.MANDATORY
		]

		return {
			"matrix_id": matrix_id,
			"rfp_id": matrix.rfp_id,
			"name": matrix.name,
			"summary": summary,
			"charts": {
				"status_distribution": status_distribution,
				"coverage_by_category": summary["coverage_by_category"],
				"coverage_by_type": summary["coverage_by_type"],
			},
			"gaps": {
				"count": len(gaps),
				"details": gap_details,
				"critical": critical_gaps,
			},
			"progress": progress_timeline,
			"alerts": self._generate_alerts(summary),
			"last_updated": matrix.updated_at.isoformat(),
		}

	def _generate_alerts(self, summary: dict[str, Any]) -> list[dict[str, Any]]:
		"""Generate alerts based on compliance status"""
		alerts: list[dict[str, Any]] = []

		# Gap rate alert
		gap_rate = summary["gap_count"] / max(summary["total_requirements"], 1)
		if gap_rate > self.config["gap_alert_threshold"]:
			alerts.append({
				"type": "warning",
				"message": f"High gap rate: {gap_rate:.1%} of requirements not addressed",
				"severity": "medium" if gap_rate < 0.5 else "high",
			})

		# Mandatory requirements alert
		not_addressed_mandatory = sum(
			1 for m in self._matrices.values()
			for mapping in m.mappings
			if mapping.status == ComplianceStatus.NOT_ADDRESSED
			and mapping.modality == RequirementModality.MANDATORY
		)
		if not_addressed_mandatory > 0:
			alerts.append({
				"type": "critical",
				"message": f"{not_addressed_mandatory} mandatory requirements not addressed",
				"severity": "high",
			})

		# Low coverage alert
		if summary["coverage_percentage"] < 50:
			alerts.append({
				"type": "warning",
				"message": f"Low overall coverage: {summary['coverage_percentage']:.1f}%",
				"severity": "medium",
			})

		return alerts

	def list_matrices(self, rfp_id: str | None = None) -> list[ComplianceMatrix]:
		"""
		List all matrices, optionally filtered by RFP ID.

		Args:
			rfp_id: Optional RFP ID to filter by

		Returns:
			List of compliance matrices
		"""
		if rfp_id:
			return [m for m in self._matrices.values() if m.rfp_id == rfp_id]
		return list(self._matrices.values())

	def delete_matrix(self, matrix_id: str) -> bool:
		"""
		Delete a compliance matrix.

		Args:
			matrix_id: ID of the matrix to delete

		Returns:
			True if deleted, False if not found
		"""
		if matrix_id in self._matrices:
			del self._matrices[matrix_id]
			self.logger.info(f"Deleted matrix {matrix_id}")
			return True
		return False

	def get_gap_report(self, matrix_id: str) -> dict[str, Any]:
		"""
		Generate a detailed gap analysis report.

		Args:
			matrix_id: ID of the matrix

		Returns:
			Detailed gap analysis
		"""
		matrix = self._matrices.get(matrix_id)
		if not matrix:
			return {"error": "Matrix not found"}

		gaps = matrix.get_gaps()

		# Group gaps by category
		by_category: dict[str, list[RequirementMapping]] = {}
		for gap in gaps:
			cat = gap.modality.value
			if cat not in by_category:
				by_category[cat] = []
			by_category[cat].append(gap)

		# Group gaps by type
		by_type: dict[str, list[RequirementMapping]] = {}
		for gap in gaps:
			req_type = gap.requirement_type.value
			if req_type not in by_type:
				by_type[req_type] = []
			by_type[req_type].append(gap)

		# Group gaps by section
		by_section: dict[str, list[RequirementMapping]] = {}
		for gap in gaps:
			section = gap.source_section or "Unknown"
			if section not in by_section:
				by_section[section] = []
			by_section[section].append(gap)

		# Priority ranking (mandatory gaps first, then by confidence)
		priority_gaps = sorted(
			gaps,
			key=lambda m: (
				0 if m.modality == RequirementModality.MANDATORY else 1,
				-m.confidence  # Higher confidence first
			)
		)

		return {
			"matrix_id": matrix_id,
			"rfp_id": matrix.rfp_id,
			"total_gaps": len(gaps),
			"by_category": {
				cat: {"count": len(gaps_list), "requirements": [
					{"id": g.requirement_id, "text": g.requirement_text[:100]}
					for g in gaps_list[:10]  # Top 10 per category
				]}
				for cat, gaps_list in by_category.items()
			},
			"by_type": {
				t: {"count": len(gaps_list), "requirements": [
					{"id": g.requirement_id, "text": g.requirement_text[:100]}
					for g in gaps_list[:10]
				]}
				for t, gaps_list in by_type.items()
			},
			"by_section": {
				sec: {"count": len(gaps_list), "requirements": [
					{"id": g.requirement_id, "text": g.requirement_text[:100]}
					for g in gaps_list[:10]
				]}
				for sec, gaps_list in by_section.items()
			},
			"priority_gaps": [
				{
					"requirement_id": g.requirement_id,
					"requirement_text": g.requirement_text[:200],
					"category": g.modality.value,
					"type": g.requirement_type.value,
					"section": g.source_section,
					"confidence": g.confidence,
				}
				for g in priority_gaps[:20]  # Top 20 priority gaps
			],
		}

	def get_traceability_matrix(self, matrix_id: str) -> dict[str, Any]:
		"""
		Generate a traceability matrix showing requirement-to-section mappings.

		Args:
			matrix_id: ID of the compliance matrix

		Returns:
			Traceability matrix data
		"""
		matrix = self._matrices.get(matrix_id)
		if not matrix:
			return {"error": "Matrix not found"}

		# Build section-to-requirements mapping
		section_map: dict[str, dict[str, Any]] = {}

		for mapping in matrix.mappings:
			if mapping.section_id:
				if mapping.section_id not in section_map:
					section_map[mapping.section_id] = {
						"section_id": mapping.section_id,
						"section_title": mapping.section_title or "Untitled",
						"requirements": [],
						"total_requirements": 0,
						"addressed_count": 0,
					}

				section_map[mapping.section_id]["requirements"].append({
					"requirement_id": mapping.requirement_id,
					"requirement_text": mapping.requirement_text[:100],
					"status": mapping.status.value,
					"category": mapping.modality.value,
				})
				section_map[mapping.section_id]["total_requirements"] += 1
				if mapping.status in (ComplianceStatus.ADDRESSED, ComplianceStatus.VERIFIED):
					section_map[mapping.section_id]["addressed_count"] += 1

		# Unmapped requirements
		unmapped = [
			{
				"requirement_id": m.requirement_id,
				"requirement_text": m.requirement_text[:100],
				"category": m.modality.value,
				"status": m.status.value,
			}
			for m in matrix.mappings
			if not m.section_id
		]

		return {
			"matrix_id": matrix_id,
			"rfp_id": matrix.rfp_id,
			"sections": list(section_map.values()),
			"unmapped_requirements": unmapped,
			"coverage_by_section": {
				sec_id: {
					"coverage": (
						round(data["addressed_count"] / data["total_requirements"] * 100, 2)
						if data["total_requirements"] > 0 else 0
					),
					"total": data["total_requirements"],
					"addressed": data["addressed_count"],
				}
				for sec_id, data in section_map.items()
			},
		}

	# ------------------------------------------------------------------
	# Database persistence (asyncpg via SQLAlchemy AsyncSession)
	# ------------------------------------------------------------------

	async def save_to_db(self, session: Any, matrix: ComplianceMatrix) -> str:
		"""
		Persist a compliance matrix and its mappings to the database.

		Args:
			session: SQLAlchemy AsyncSession or asyncpg connection
			matrix: ComplianceMatrix to persist

		Returns:
			The matrix id (UUID string)
		"""
		from sqlalchemy import text

		matrix_id = matrix.id or uuid7str()
		now = datetime.now(timezone.utc)

		# Calculate counts for the matrix row
		status_counts: dict[str, int] = {}
		for m in matrix.mappings:
			status_counts[m.status.value] = status_counts.get(m.status.value, 0) + 1

		mandatory_count = sum(
			1 for m in matrix.mappings if m.modality == RequirementModality.MANDATORY
		)
		compliant_count = status_counts.get("addressed", 0) + status_counts.get("verified", 0)
		partial_count = status_counts.get("in_progress", 0)
		non_compliant_count = 0  # Not tracked by ComplianceStatus
		not_addressed_count = status_counts.get("not_addressed", 0)
		total = len(matrix.mappings)
		compliance_score = round(compliant_count / total, 3) if total > 0 else None
		mandatory_compliant = sum(
			1 for m in matrix.mappings
			if m.modality == RequirementModality.MANDATORY
			and m.status in (ComplianceStatus.ADDRESSED, ComplianceStatus.VERIFIED)
		)
		mandatory_score = round(mandatory_compliant / mandatory_count, 3) if mandatory_count > 0 else None

		# Upsert matrix
		await session.execute(
			text("""
				INSERT INTO compliance_matrices (
					id, opportunity_id, name, description, version, status,
					total_requirements, mandatory_count, compliant_count, partial_count,
					non_compliant_count, not_addressed_count,
					compliance_score, mandatory_compliance_score,
					metadata, created_by, created_at, updated_at
				) VALUES (
					:id, :opportunity_id, :name, :description, 1, 'draft',
					:total_requirements, :mandatory_count, :compliant_count, :partial_count,
					:non_compliant_count, :not_addressed_count,
					:compliance_score, :mandatory_compliance_score,
					CAST(:metadata AS JSONB), 'system', :created_at, :updated_at
				)
				ON CONFLICT (id) DO UPDATE SET
					name = EXCLUDED.name,
					description = EXCLUDED.description,
					status = EXCLUDED.status,
					total_requirements = EXCLUDED.total_requirements,
					mandatory_count = EXCLUDED.mandatory_count,
					compliant_count = EXCLUDED.compliant_count,
					partial_count = EXCLUDED.partial_count,
					non_compliant_count = EXCLUDED.non_compliant_count,
					not_addressed_count = EXCLUDED.not_addressed_count,
					compliance_score = EXCLUDED.compliance_score,
					mandatory_compliance_score = EXCLUDED.mandatory_compliance_score,
					metadata = EXCLUDED.metadata,
					updated_at = EXCLUDED.updated_at
			"""),
			{
				"id": matrix_id,
				"opportunity_id": matrix.rfp_id,
				"name": matrix.name,
				"description": matrix.description or None,
				"total_requirements": total,
				"mandatory_count": mandatory_count,
				"compliant_count": compliant_count,
				"partial_count": partial_count,
				"non_compliant_count": non_compliant_count,
				"not_addressed_count": not_addressed_count,
				"compliance_score": compliance_score,
				"mandatory_compliance_score": mandatory_score,
				"metadata": json.dumps(matrix.metadata),
				"created_at": now,
				"updated_at": now,
			},
		)

		# Replace entries atomically
		await session.execute(
			text("DELETE FROM compliance_entries WHERE matrix_id = :mid"),
			{"mid": matrix_id},
		)

		for mapping in matrix.mappings:
			await session.execute(
				text("""
					INSERT INTO compliance_entries (
						id, matrix_id, requirement_id,
						compliance_status, response_summary,
						reviewer_notes, assigned_to,
						metadata, sort_order, created_at, updated_at
					) VALUES (
						:id, :matrix_id, :requirement_id,
						:compliance_status, :response_summary,
						:reviewer_notes, :assigned_to,
						CAST(:metadata AS JSONB), :sort_order, :created_at, :updated_at
					)
				"""),
				{
					"id": mapping.id or uuid7str(),
					"matrix_id": matrix_id,
					"requirement_id": mapping.requirement_id,
					"compliance_status": mapping.status.value,
					"response_summary": mapping.section_title or None,
					"reviewer_notes": mapping.notes or None,
					"assigned_to": None,
					"metadata": json.dumps({
						"confidence": mapping.confidence,
						"category": mapping.modality.value,
						"requirement_type": mapping.requirement_type.value,
						"source_section": mapping.source_section,
						"page_number": mapping.page_number,
					}),
					"sort_order": 0,
					"created_at": now,
					"updated_at": now,
				},
			)

		await session.commit()
		return matrix_id

	@staticmethod
	async def load_from_db(matrix_id: str, session: Any) -> ComplianceMatrix:
		"""
		Load a compliance matrix and its mappings from the database.

		Args:
			matrix_id: UUID of the matrix to load
			session: SQLAlchemy AsyncSession or asyncpg connection

		Returns:
			Reconstructed ComplianceMatrix
		"""
		from sqlalchemy import text

		row = (await session.execute(
			text("SELECT * FROM compliance_matrices WHERE id = :id"),
			{"id": matrix_id},
		)).mappings().first()

		if row is None:
			raise ValueError(f"No compliance matrix with id {matrix_id}")

		entries_rows = (await session.execute(
			text("SELECT * FROM compliance_entries WHERE matrix_id = :mid ORDER BY sort_order, created_at"),
			{"mid": matrix_id},
		)).mappings().all()

		matrix = ComplianceMatrix(
			id=str(row["id"]),
			rfp_id=str(row["opportunity_id"]),
			name=row["name"],
			description=row.get("description") or "",
			metadata=row.get("metadata") or {},
			created_at=row["created_at"],
			updated_at=row["updated_at"],
		)

		for e in entries_rows:
			meta = e.get("metadata") or {}
			mapping = RequirementMapping(
				id=str(e["id"]),
				requirement_id=str(e["requirement_id"]),
				requirement_text="",
				section_id=None,
				section_title=e.get("response_summary") or None,
				status=ComplianceStatus(e["compliance_status"]),
				confidence=meta.get("confidence", 0.0),
				notes=e.get("reviewer_notes") or "",
				modality=RequirementModality(meta.get("category", "mandatory")),
				requirement_type=RequirementType(meta.get("requirement_type", "unknown")),
				source_section=meta.get("source_section", ""),
				page_number=meta.get("page_number"),
			)
			matrix.add_mapping(mapping)

		return matrix

def create_compliance_matrix_generator(config: dict[str, Any] | None = None) -> ComplianceMatrixGenerator:
	"""
	Create ComplianceMatrixGenerator instance with configuration.

	Args:
		config: Optional configuration dictionary

	Returns:
		Configured ComplianceMatrixGenerator instance
	"""
	return ComplianceMatrixGenerator(config)