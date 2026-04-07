#!/usr/bin/env python3
"""
Requirement Traceability Matrix

Provides bidirectional traceability between RFP requirements and proposal
response sections. Supports traceability analysis, coverage tracking, and
impact analysis for requirement changes.

Features:
- Forward traceability (requirements to sections)
- Backward traceability (sections to requirements)
- Coverage analysis
- Impact assessment for changes
- Orphan detection
"""

import logging
from datetime import datetime
from enum import Enum
from typing import Any

try:
	from uuid_extensions import uuid7str
except ImportError:
	from uuid import uuid4

	def uuid7str() -> str:
		return str(uuid4())


from pydantic import BaseModel, ConfigDict, Field


class TraceabilityDirection(str, Enum):
	"""Direction of traceability lookup"""

	FORWARD = "forward"  # Requirement -> Section
	BACKWARD = "backward"  # Section -> Requirement
	BIDIRECTIONAL = "bidirectional"  # Both directions


class TraceabilityLink(BaseModel):
	"""
	A link between a requirement and a response section.

	Attributes:
		id: Unique identifier for this link
		requirement_id: ID of the requirement
		section_id: ID of the response section
		section_title: Title of the section
		link_type: Type of traceability link
		confidence: Confidence in this link (0.0-1.0)
		created_at: When this link was created
		verified: Whether this link has been manually verified
		notes: Additional notes
	"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True)

	id: str = Field(default_factory=uuid7str)
	requirement_id: str = Field(..., description="ID of the requirement")
	section_id: str = Field(..., description="ID of the response section")
	section_title: str = Field(default="", description="Title of the section")
	link_type: str = Field(
		default="direct",
		description="Type of traceability link (direct, partial, derived)"
	)
	confidence: float = Field(
		default=1.0, ge=0.0, le=1.0,
		description="Confidence in this link"
	)
	created_at: datetime = Field(default_factory=datetime.now)
	verified: bool = Field(default=False, description="Whether manually verified")
	notes: str = Field(default="", description="Additional notes")


class TraceabilityMatrix(BaseModel):
	"""
	Complete traceability matrix for requirements.

	Attributes:
		id: Unique identifier for this matrix
		rfp_id: ID of the RFP document
		name: Human-readable name
		links: List of traceability links
		requirement_index: Index of requirement_id -> links
		section_index: Index of section_id -> links
		created_at: When this matrix was created
		updated_at: When this matrix was last updated
	"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True)

	id: str = Field(default_factory=uuid7str)
	rfp_id: str = Field(..., description="ID of the RFP document")
	name: str = Field(default="Traceability Matrix", description="Matrix name")
	links: list[TraceabilityLink] = Field(
		default_factory=list,
		description="Traceability links"
	)
	requirement_index: dict[str, list[str]] = Field(
		default_factory=dict,
		description="Index: requirement_id -> link IDs"
	)
	section_index: dict[str, list[str]] = Field(
		default_factory=dict,
		description="Index: section_id -> link IDs"
	)
	created_at: datetime = Field(default_factory=datetime.now)
	updated_at: datetime = Field(default_factory=datetime.now)

	def add_link(self, link: TraceabilityLink) -> None:
		"""
		Add a traceability link to the matrix.

		Args:
			link: The link to add
		"""
		self.links.append(link)

		# Update indices
		if link.requirement_id not in self.requirement_index:
			self.requirement_index[link.requirement_id] = []
		self.requirement_index[link.requirement_id].append(link.id)

		if link.section_id not in self.section_index:
			self.section_index[link.section_id] = []
		self.section_index[link.section_id].append(link.id)

		self.updated_at = datetime.now()

	def remove_link(self, link_id: str) -> bool:
		"""
		Remove a traceability link.

		Args:
			link_id: ID of the link to remove

		Returns:
			True if removed, False if not found
		"""
		for i, link in enumerate(self.links):
			if link.id == link_id:
				# Remove from indices
				if link.requirement_id in self.requirement_index:
					self.requirement_index[link.requirement_id] = [
						lid for lid in self.requirement_index[link.requirement_id]
						if lid != link_id
					]
				if link.section_id in self.section_index:
					self.section_index[link.section_id] = [
						lid for lid in self.section_index[link.section_id]
						if lid != link_id
					]

				# Remove from links
				self.links.pop(i)
				self.updated_at = datetime.now()
				return True
		return False

	def get_links_for_requirement(self, requirement_id: str) -> list[TraceabilityLink]:
		"""
		Get all links for a specific requirement.

		Args:
			requirement_id: ID of the requirement

		Returns:
			List of traceability links
		"""
		link_ids = self.requirement_index.get(requirement_id, [])
		return [link for link in self.links if link.id in link_ids]

	def get_links_for_section(self, section_id: str) -> list[TraceabilityLink]:
		"""
		Get all links for a specific section.

		Args:
			section_id: ID of the section

		Returns:
			List of traceability links
		"""
		link_ids = self.section_index.get(section_id, [])
		return [link for link in self.links if link.id in link_ids]

	def get_untraced_requirements(self) -> list[str]:
		"""
		Get requirement IDs that have no traceability links.

		Returns:
			List of untraced requirement IDs
		"""
		return [
			req_id for req_id, links in self.requirement_index.items()
			if not links
		]

	def get_untraced_sections(self) -> list[str]:
		"""
		Get section IDs that have no traceability links.

		Returns:
			List of untraced section IDs
		"""
		return [
			sec_id for sec_id, links in self.section_index.items()
			if not links
		]

	def get_coverage_stats(self) -> dict[str, Any]:
		"""
		Get traceability coverage statistics.

		Returns:
			Dictionary with coverage statistics
		"""
		total_requirements = len(self.requirement_index)
		traced_requirements = sum(1 for links in self.requirement_index.values() if links)
		total_sections = len(self.section_index)
		traced_sections = sum(1 for links in self.section_index.values() if links)

		return {
			"total_requirements": total_requirements,
			"traced_requirements": traced_requirements,
			"untraced_requirements": total_requirements - traced_requirements,
			"requirement_coverage": round(traced_requirements / total_requirements * 100, 2) if total_requirements > 0 else 0,
			"total_sections": total_sections,
			"traced_sections": traced_sections,
			"untraced_sections": total_sections - traced_sections,
			"section_coverage": round(traced_sections / total_sections * 100, 2) if total_sections > 0 else 0,
			"total_links": len(self.links),
			"verified_links": sum(1 for link in self.links if link.verified),
			"average_links_per_requirement": round(len(self.links) / total_requirements, 2) if total_requirements > 0 else 0,
		}


class TraceabilityAnalyzer:
	"""
	Analyzer for requirement traceability.

	Provides analysis capabilities for traceability matrices including
	impact analysis, coverage analysis, and orphan detection.

	Features:
	- Coverage analysis
	- Impact analysis for changes
	- Orphan detection
	- Completeness checking
	"""

	def __init__(self, config: dict[str, Any] | None = None):
		"""
		Initialize the traceability analyzer.

		Args:
			config: Optional configuration dictionary
		"""
		self.config = config or {}
		self.logger = logging.getLogger(__name__)

	def analyze_coverage(self, matrix: TraceabilityMatrix) -> dict[str, Any]:
		"""
		Analyze traceability coverage.

		Args:
			matrix: The traceability matrix to analyze

		Returns:
			Dictionary with coverage analysis
		"""
		stats = matrix.get_coverage_stats()

		# Find requirements with low link count
		low_link_requirements = [
			{
				"requirement_id": req_id,
				"link_count": len(links),
			}
			for req_id, links in matrix.requirement_index.items()
			if len(links) < self.config.get("min_links_per_requirement", 1)
		]

		# Find requirements with high link count (potential overloading)
		high_link_requirements = [
			{
				"requirement_id": req_id,
				"link_count": len(links),
			}
			for req_id, links in matrix.requirement_index.items()
			if len(links) > self.config.get("max_links_per_requirement", 10)
		]

		# Find sections with many requirements (potential overloading)
		overloaded_sections = [
			{
				"section_id": sec_id,
				"requirement_count": len(links),
			}
			for sec_id, links in matrix.section_index.items()
			if len(links) > self.config.get("max_requirements_per_section", 20)
		]

		return {
			"coverage_stats": stats,
			"low_link_requirements": low_link_requirements,
			"high_link_requirements": high_link_requirements,
			"overloaded_sections": overloaded_sections,
			"recommendations": self._generate_recommendations(
				stats,
				low_link_requirements,
				high_link_requirements,
				overloaded_sections,
			),
		}

	def analyze_impact(
		self,
		matrix: TraceabilityMatrix,
		requirement_ids: list[str],
	) -> dict[str, Any]:
		"""
		Analyze impact of changing requirements.

		Args:
			matrix: The traceability matrix
			requirement_ids: IDs of requirements being changed

		Returns:
			Dictionary with impact analysis
		"""
		affected_sections: dict[str, list[str]] = {}
		affected_links: list[TraceabilityLink] = []

		for req_id in requirement_ids:
			links = matrix.get_links_for_requirement(req_id)
			for link in links:
				if link.section_id not in affected_sections:
					affected_sections[link.section_id] = []
				affected_sections[link.section_id].append(req_id)
				affected_links.append(link)

		# Calculate impact severity
		total_sections_affected = len(affected_sections)
		total_links_affected = len(affected_links)

		if total_sections_affected == 0:
			severity = "none"
		elif total_sections_affected <= 3 and total_links_affected <= 5:
			severity = "low"
		elif total_sections_affected <= 10 and total_links_affected <= 20:
			severity = "medium"
		else:
			severity = "high"

		return {
			"changed_requirements": requirement_ids,
			"affected_sections": [
				{
					"section_id": sec_id,
					"affected_requirements": req_ids,
				}
				for sec_id, req_ids in affected_sections.items()
			],
			"total_sections_affected": total_sections_affected,
			"total_links_affected": total_links_affected,
			"severity": severity,
			"links": [
				{
					"link_id": link.id,
					"requirement_id": link.requirement_id,
					"section_id": link.section_id,
					"confidence": link.confidence,
				}
				for link in affected_links
			],
		}

	def find_orphans(
		self,
		matrix: TraceabilityMatrix,
		requirement_ids: list[str] | None = None,
		section_ids: list[str] | None = None,
	) -> dict[str, Any]:
		"""
		Find orphan requirements and sections.

		Args:
			matrix: The traceability matrix
			requirement_ids: All known requirement IDs (optional)
			section_ids: All known section IDs (optional)

		Returns:
			Dictionary with orphan analysis
		"""
		# Requirements in matrix but not traced
		untraced_requirements = matrix.get_untraced_requirements()

		# Sections in matrix but not traced
		untraced_sections = matrix.get_untraced_sections()

		# Requirements that should exist but don't (if IDs provided)
		missing_requirements = []
		if requirement_ids:
			matrix_req_ids = set(matrix.requirement_index.keys())
			missing_requirements = [rid for rid in requirement_ids if rid not in matrix_req_ids]

		# Sections that should exist but don't (if IDs provided)
		missing_sections = []
		if section_ids:
			matrix_sec_ids = set(matrix.section_index.keys())
			missing_sections = [sid for sid in section_ids if sid not in matrix_sec_ids]

		return {
			"untraced_requirements": untraced_requirements,
			"untraced_sections": untraced_sections,
			"missing_requirements": missing_requirements,
			"missing_sections": missing_sections,
			"total_orphans": len(untraced_requirements) + len(untraced_sections),
		}

	def check_completeness(
		self,
		matrix: TraceabilityMatrix,
		requirement_ids: list[str],
	) -> dict[str, Any]:
		"""
		Check traceability completeness.

		Args:
			matrix: The traceability matrix
			requirement_ids: All expected requirement IDs

		Returns:
			Dictionary with completeness check
		"""
		matrix_req_ids = set(matrix.requirement_index.keys())
		expected_ids = set(requirement_ids)

		# Requirements in matrix
		present = matrix_req_ids & expected_ids

		# Requirements missing from matrix
		missing = expected_ids - matrix_req_ids

		# Requirements in matrix but not expected
		extra = matrix_req_ids - expected_ids

		# Requirements without links
		no_links = [req_id for req_id in present if not matrix.get_links_for_requirement(req_id)]

		completeness_percentage = round(len(present) / len(expected_ids) * 100, 2) if expected_ids else 100

		return {
			"total_expected": len(expected_ids),
			"present_count": len(present),
			"missing_count": len(missing),
			"extra_count": len(extra),
			"no_links_count": len(no_links),
			"completeness_percentage": completeness_percentage,
			"missing_requirements": list(missing),
			"extra_requirements": list(extra),
			"requirements_without_links": no_links,
			"is_complete": len(missing) == 0 and len(extra) == 0,
		}

	def _generate_recommendations(
		self,
		stats: dict[str, Any],
		low_link_requirements: list[dict[str, Any]],
		high_link_requirements: list[dict[str, Any]],
		overloaded_sections: list[dict[str, Any]],
	) -> list[str]:
		"""Generate traceability recommendations"""
		recommendations: list[str] = []

		if stats["requirement_coverage"] < 100:
			recommendations.append(
				f"Traceability coverage is {stats['requirement_coverage']}%. "
				f"Add links for {stats['untraced_requirements']} untraced requirements."
			)

		if low_link_requirements:
			recommendations.append(
				f"{len(low_link_requirements)} requirements have fewer than expected links. "
				"Review and add additional traceability links."
			)

		if high_link_requirements:
			recommendations.append(
				f"{len(high_link_requirements)} requirements have many links. "
				"Consider splitting into smaller requirements."
			)

		if overloaded_sections:
			recommendations.append(
				f"{len(overloaded_sections)} sections have many requirements linked. "
				"Consider restructuring for clarity."
			)

		if stats["verified_links"] < stats["total_links"] * 0.5:
			recommendations.append(
				f"Only {stats['verified_links']} of {stats['total_links']} links are verified. "
				"Manual verification recommended."
			)

		return recommendations


class TraceabilityMatrixBuilder:
	"""
	Builder for creating traceability matrices.

	Provides a fluent interface for building traceability matrices
	from requirements and sections.

	Features:
	- Fluent API for building matrices
	- Automatic link creation
	- Confidence calculation
	"""

	def __init__(self, rfp_id: str, name: str = "Traceability Matrix"):
		"""
		Initialize the builder.

		Args:
			rfp_id: ID of the RFP document
			name: Name for the matrix
		"""
		self._matrix = TraceabilityMatrix(rfp_id=rfp_id, name=name)
		self._links: dict[tuple[str, str], TraceabilityLink] = {}

	def add_requirement(
		self,
		requirement_id: str,
		section_ids: list[str] | None = None,
	) -> "TraceabilityMatrixBuilder":
		"""
		Add a requirement with optional section links.

		Args:
			requirement_id: ID of the requirement
			section_ids: Optional list of section IDs to link

		Returns:
			self for chaining
		"""
		# Register requirement in index
		if requirement_id not in self._matrix.requirement_index:
			self._matrix.requirement_index[requirement_id] = []

		# Create links if sections provided
		if section_ids:
			for section_id in section_ids:
				self.add_link(requirement_id, section_id)

		return self

	def add_section(
		self,
		section_id: str,
		section_title: str = "",
	) -> "TraceabilityMatrixBuilder":
		"""
		Add a section to the matrix.

		Args:
			section_id: ID of the section
			section_title: Title of the section

		Returns:
			self for chaining
		"""
		# Register section in index
		if section_id not in self._matrix.section_index:
			self._matrix.section_index[section_id] = []

		return self

	def add_link(
		self,
		requirement_id: str,
		section_id: str,
		confidence: float = 1.0,
		link_type: str = "direct",
		notes: str = "",
	) -> "TraceabilityMatrixBuilder":
		"""
		Add a traceability link.

		Args:
			requirement_id: ID of the requirement
			section_id: ID of the section
			confidence: Confidence in the link (0.0-1.0)
			link_type: Type of link (direct, partial, derived)
			notes: Additional notes

		Returns:
			self for chaining
		"""
		key = (requirement_id, section_id)

		# Check if link already exists
		if key not in self._links:
			link = TraceabilityLink(
				requirement_id=requirement_id,
				section_id=section_id,
				confidence=confidence,
				link_type=link_type,
				notes=notes,
			)
			self._links[key] = link
			self._matrix.add_link(link)

		return self

	def verify_link(
		self,
		requirement_id: str,
		section_id: str,
	) -> "TraceabilityMatrixBuilder":
		"""
		Mark a link as verified.

		Args:
			requirement_id: ID of the requirement
			section_id: ID of the section

		Returns:
			self for chaining
		"""
		key = (requirement_id, section_id)
		if key in self._links:
			self._links[key].verified = True
			self._matrix.updated_at = datetime.now()
		return self

	def build(self) -> TraceabilityMatrix:
		"""
		Build and return the traceability matrix.

		Returns:
			The completed TraceabilityMatrix
		"""
		self._matrix.updated_at = datetime.now()
		return self._matrix


def create_traceability_matrix_builder(
	rfp_id: str,
	name: str = "Traceability Matrix",
) -> TraceabilityMatrixBuilder:
	"""
	Create a traceability matrix builder.

	Args:
		rfp_id: ID of the RFP document
		name: Name for the matrix

	Returns:
		TraceabilityMatrixBuilder instance
	"""
	return TraceabilityMatrixBuilder(rfp_id=rfp_id, name=name)


def create_traceability_analyzer(config: dict[str, Any] | None = None) -> TraceabilityAnalyzer:
	"""
	Create a traceability analyzer.

	Args:
		config: Optional configuration dictionary

	Returns:
		TraceabilityAnalyzer instance
	"""
	return TraceabilityAnalyzer(config)