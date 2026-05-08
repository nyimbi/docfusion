#!/usr/bin/env python3
"""
Tests for Compliance Matrix Generator

Unit tests for the compliance matrix system including coverage tracking,
gap identification, and export functionality.
"""

import asyncio
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from docfusion.rfp.compliance_matrix import (
	ComplianceMatrix,
	ComplianceMatrixGenerator,
	ComplianceStatus,
	RequirementMapping,
	create_compliance_matrix_generator,
)
from docfusion.rfp.requirement_extractor import (
	Requirement,
	RequirementModality,
	RequirementType,
)


# Sample requirements for testing
SAMPLE_REQUIREMENTS = [
	Requirement(
		text="The system must support at least 1,000 concurrent users.",
		modality=RequirementModality.MANDATORY,
		requirement_type=RequirementType.PERFORMANCE,
		section="Technical Requirements",
		confidence=0.95,
	),
	Requirement(
		text="The platform shall provide real-time data synchronization.",
		modality=RequirementModality.MANDATORY,
		requirement_type=RequirementType.TECHNICAL,
		section="Technical Requirements",
		confidence=0.9,
	),
	Requirement(
		text="The solution should include a mobile application.",
		modality=RequirementModality.OPTIONAL,
		requirement_type=RequirementType.FUNCTIONAL,
		section="Scope of Work",
		confidence=0.85,
	),
	Requirement(
		text="Proposals must demonstrate GDPR compliance.",
		modality=RequirementModality.MANDATORY,
		requirement_type=RequirementType.COMPLIANCE,
		section="Compliance",
		confidence=0.92,
	),
	Requirement(
		text="Where applicable, the system should support legacy browsers.",
		modality=RequirementModality.CONDITIONAL,
		requirement_type=RequirementType.TECHNICAL,
		section="Technical Requirements",
		confidence=0.75,
	),
]


class TestComplianceStatus:
	"""Tests for ComplianceStatus enum"""

	def test_status_values(self):
		"""Test status enum values"""
		assert ComplianceStatus.NOT_ADDRESSED.value == "not_addressed"
		assert ComplianceStatus.IN_PROGRESS.value == "in_progress"
		assert ComplianceStatus.ADDRESSED.value == "addressed"
		assert ComplianceStatus.VERIFIED.value == "verified"

	def test_status_from_string(self):
		"""Test creating status from string"""
		assert ComplianceStatus("not_addressed") == ComplianceStatus.NOT_ADDRESSED
		assert ComplianceStatus("in_progress") == ComplianceStatus.IN_PROGRESS
		assert ComplianceStatus("addressed") == ComplianceStatus.ADDRESSED
		assert ComplianceStatus("verified") == ComplianceStatus.VERIFIED


class TestRequirementMapping:
	"""Tests for RequirementMapping model"""

	def test_mapping_creation(self):
		"""Test basic mapping creation"""
		mapping = RequirementMapping(
			requirement_id="req-001",
			requirement_text="The system must support concurrent users.",
			modality=RequirementModality.MANDATORY,
			requirement_type=RequirementType.PERFORMANCE,
		)

		assert mapping.requirement_id == "req-001"
		assert mapping.status == ComplianceStatus.NOT_ADDRESSED
		assert mapping.confidence == 0.0
		assert isinstance(mapping.id, str)
		assert isinstance(mapping.created_at, datetime)

	def test_mapping_default_values(self):
		"""Test mapping default values"""
		mapping = RequirementMapping(requirement_id="req-002")

		assert mapping.section_id is None
		assert mapping.section_title is None
		assert mapping.status == ComplianceStatus.NOT_ADDRESSED
		assert mapping.confidence == 0.0
		assert mapping.notes == ""
		assert mapping.modality == RequirementModality.MANDATORY
		assert mapping.requirement_type == RequirementType.UNKNOWN

	def test_mapping_update_status(self):
		"""Test updating mapping status"""
		mapping = RequirementMapping(requirement_id="req-003")

		mapping.update_status(ComplianceStatus.IN_PROGRESS, confidence=0.5)

		assert mapping.status == ComplianceStatus.IN_PROGRESS
		assert mapping.confidence == 0.5
		assert mapping.updated_at >= mapping.created_at

	def test_mapping_validation(self):
		"""Test mapping validation"""
		# Valid confidence
		mapping = RequirementMapping(requirement_id="req-004", confidence=0.75)
		assert mapping.confidence == 0.75

		# Invalid confidence should raise
		with pytest.raises(Exception):  # Pydantic validation error
			RequirementMapping(requirement_id="req-005", confidence=1.5)

		with pytest.raises(Exception):
			RequirementMapping(requirement_id="req-006", confidence=-0.1)


class TestComplianceMatrix:
	"""Tests for ComplianceMatrix model"""

	def test_matrix_creation(self):
		"""Test basic matrix creation"""
		matrix = ComplianceMatrix(rfp_id="rfp-001")

		assert matrix.rfp_id == "rfp-001"
		assert matrix.name == "Compliance Matrix"
		assert matrix.mappings == []
		assert isinstance(matrix.id, str)

	def test_matrix_with_mappings(self):
		"""Test matrix with mappings"""
		mappings = [
			RequirementMapping(
				requirement_id="req-001",
				requirement_text="Requirement 1",
				modality=RequirementModality.MANDATORY,
			),
			RequirementMapping(
				requirement_id="req-002",
				requirement_text="Requirement 2",
				modality=RequirementModality.OPTIONAL,
			),
		]

		matrix = ComplianceMatrix(
			rfp_id="rfp-001",
			mappings=mappings,
		)

		assert len(matrix.mappings) == 2

	def test_get_coverage_percentage(self):
		"""Test coverage percentage calculation"""
		matrix = ComplianceMatrix(rfp_id="rfp-001")

		# Empty matrix
		assert matrix.get_coverage_percentage() == 0.0

		# Add mappings with different statuses
		matrix.add_mapping(RequirementMapping(
			requirement_id="req-001",
			requirement_text="Req 1",
			status=ComplianceStatus.ADDRESSED,
		))
		matrix.add_mapping(RequirementMapping(
			requirement_id="req-002",
			requirement_text="Req 2",
			status=ComplianceStatus.VERIFIED,
		))
		matrix.add_mapping(RequirementMapping(
			requirement_id="req-003",
			requirement_text="Req 3",
			status=ComplianceStatus.NOT_ADDRESSED,
		))

		coverage = matrix.get_coverage_percentage()
		assert coverage == 66.67  # 2 out of 3 addressed

	def test_get_coverage_by_category(self):
		"""Test coverage by category"""
		matrix = ComplianceMatrix(rfp_id="rfp-001")

		# Add mandatory requirements
		matrix.add_mapping(RequirementMapping(
			requirement_id="req-001",
			requirement_text="Req 1",
			modality=RequirementModality.MANDATORY,
			status=ComplianceStatus.ADDRESSED,
		))
		matrix.add_mapping(RequirementMapping(
			requirement_id="req-002",
			requirement_text="Req 2",
			modality=RequirementModality.MANDATORY,
			status=ComplianceStatus.NOT_ADDRESSED,
		))

		# Add optional requirements
		matrix.add_mapping(RequirementMapping(
			requirement_id="req-003",
			requirement_text="Req 3",
			modality=RequirementModality.OPTIONAL,
			status=ComplianceStatus.ADDRESSED,
		))

		coverage = matrix.get_coverage_by_category()
		assert "mandatory" in coverage
		assert coverage["mandatory"] == 50.0  # 1 out of 2
		assert coverage["optional"] == 100.0  # 1 out of 1

	def test_get_gaps(self):
		"""Test gap identification"""
		matrix = ComplianceMatrix(rfp_id="rfp-001")

		matrix.add_mapping(RequirementMapping(
			requirement_id="req-001",
			requirement_text="Addressed req",
			status=ComplianceStatus.ADDRESSED,
		))
		matrix.add_mapping(RequirementMapping(
			requirement_id="req-002",
			requirement_text="Not addressed req",
			status=ComplianceStatus.NOT_ADDRESSED,
		))
		matrix.add_mapping(RequirementMapping(
			requirement_id="req-003",
			requirement_text="In progress req",
			status=ComplianceStatus.IN_PROGRESS,
		))

		gaps = matrix.get_gaps()
		assert len(gaps) == 1
		assert gaps[0].requirement_id == "req-002"

	def test_get_summary(self):
		"""Test summary generation"""
		matrix = ComplianceMatrix(rfp_id="rfp-001")

		matrix.add_mapping(RequirementMapping(
			requirement_id="req-001",
			requirement_text="Req 1",
			status=ComplianceStatus.ADDRESSED,
		))
		matrix.add_mapping(RequirementMapping(
			requirement_id="req-002",
			requirement_text="Req 2",
			status=ComplianceStatus.NOT_ADDRESSED,
		))

		summary = matrix.get_summary()
		assert summary["total_requirements"] == 2
		assert summary["addressed"] == 1
		assert summary["not_addressed"] == 1
		assert "coverage_percentage" in summary

	def test_export_csv(self):
		"""Test CSV export"""
		matrix = ComplianceMatrix(rfp_id="rfp-001")

		matrix.add_mapping(RequirementMapping(
			requirement_id="req-001",
			requirement_text="The system must support users.",
			modality=RequirementModality.MANDATORY,
			status=ComplianceStatus.ADDRESSED,
			confidence=0.9,
		))

		csv_output = matrix.export_csv()
		assert "Requirement ID" in csv_output
		assert "req-001" in csv_output
		assert "addressed" in csv_output

	def test_update_mapping_status(self):
		"""Test updating mapping status"""
		matrix = ComplianceMatrix(rfp_id="rfp-001")

		matrix.add_mapping(RequirementMapping(
			requirement_id="req-001",
			requirement_text="Req 1",
			status=ComplianceStatus.NOT_ADDRESSED,
		))

		result = matrix.update_mapping_status(
			requirement_id="req-001",
			status=ComplianceStatus.ADDRESSED,
			confidence=0.85,
		)

		assert result is True
		mapping = matrix.get_mapping_by_requirement("req-001")
		assert mapping.status == ComplianceStatus.ADDRESSED
		assert mapping.confidence == 0.85

	def test_get_mapping_by_requirement(self):
		"""Test getting mapping by requirement ID"""
		matrix = ComplianceMatrix(rfp_id="rfp-001")

		matrix.add_mapping(RequirementMapping(
			requirement_id="req-001",
			requirement_text="Req 1",
		))

		mapping = matrix.get_mapping_by_requirement("req-001")
		assert mapping is not None
		assert mapping.requirement_id == "req-001"

		# Non-existent
		assert matrix.get_mapping_by_requirement("nonexistent") is None


class TestComplianceMatrixGenerator:
	"""Tests for ComplianceMatrixGenerator"""

	@pytest.fixture
	def generator(self):
		"""Create generator instance"""
		return create_compliance_matrix_generator()

	def test_generator_creation(self, generator):
		"""Test generator creation"""
		assert generator is not None
		assert generator.config is not None

	def test_generator_custom_config(self):
		"""Test generator with custom config"""
		config = {
			"auto_verify_threshold": 0.9,
			"gap_alert_threshold": 0.2,
		}
		generator = create_compliance_matrix_generator(config)
		assert generator.config["auto_verify_threshold"] == 0.9

	@pytest.mark.asyncio
	async def test_generate_matrix(self, generator):
		"""Test matrix generation from requirements"""
		matrix = await generator.generate_matrix(
			requirements=SAMPLE_REQUIREMENTS,
			rfp_id="rfp-test-001",
			name="Test Matrix",
		)

		assert matrix is not None
		assert matrix.rfp_id == "rfp-test-001"
		assert matrix.name == "Test Matrix"
		assert len(matrix.mappings) == len(SAMPLE_REQUIREMENTS)

		# Check all mappings have correct status
		for mapping in matrix.mappings:
			assert mapping.status == ComplianceStatus.NOT_ADDRESSED

	@pytest.mark.asyncio
	async def test_generate_matrix_from_extraction_result(self, generator):
		"""Test matrix generation from extraction result"""
		# Mock extraction result
		extraction_result = MagicMock()
		extraction_result.requirements = SAMPLE_REQUIREMENTS

		matrix = await generator.generate_matrix_from_extraction_result(
			extraction_result=extraction_result,
			rfp_id="rfp-test-002",
		)

		assert matrix is not None
		assert len(matrix.mappings) == len(SAMPLE_REQUIREMENTS)

	@pytest.mark.asyncio
	async def test_update_mapping(self, generator):
		"""Test updating a mapping"""
		# Create matrix
		matrix = await generator.generate_matrix(
			requirements=SAMPLE_REQUIREMENTS[:1],
			rfp_id="rfp-test-003",
		)

		requirement_id = matrix.mappings[0].requirement_id

		# Update status
		result = await generator.update_mapping(
			matrix_id=matrix.id,
			requirement_id=requirement_id,
			status=ComplianceStatus.ADDRESSED,
			confidence=0.85,
		)

		assert result is True

		# Check updated status
		updated_matrix = generator.get_matrix(matrix.id)
		mapping = updated_matrix.get_mapping_by_requirement(requirement_id)
		assert mapping.status == ComplianceStatus.ADDRESSED
		assert mapping.confidence == 0.85

	@pytest.mark.asyncio
	async def test_update_nonexistent_matrix(self, generator):
		"""Test updating a non-existent matrix"""
		result = await generator.update_mapping(
			matrix_id="nonexistent",
			requirement_id="req-001",
			status=ComplianceStatus.ADDRESSED,
		)
		assert result is False

	@pytest.mark.asyncio
	async def test_update_nonexistent_requirement(self, generator):
		"""Test updating a non-existent requirement"""
		matrix = await generator.generate_matrix(
			requirements=SAMPLE_REQUIREMENTS[:1],
			rfp_id="rfp-test-004",
		)

		result = await generator.update_mapping(
			matrix_id=matrix.id,
			requirement_id="nonexistent",
			status=ComplianceStatus.ADDRESSED,
		)
		assert result is False

	def test_get_matrix(self, generator):
		"""Test getting matrix by ID"""
		async def _test():
			matrix = await generator.generate_matrix(
				requirements=SAMPLE_REQUIREMENTS[:1],
				rfp_id="rfp-test-005",
			)

			retrieved = generator.get_matrix(matrix.id)
			assert retrieved is not None
			assert retrieved.id == matrix.id

			# Non-existent
			assert generator.get_matrix("nonexistent") is None

		asyncio.run(_test())

	def test_get_dashboard_data(self, generator):
		"""Test dashboard data generation"""
		async def _test():
			matrix = await generator.generate_matrix(
				requirements=SAMPLE_REQUIREMENTS,
				rfp_id="rfp-test-006",
			)

			dashboard = generator.get_dashboard_data(matrix.id)

			assert dashboard["matrix_id"] == matrix.id
			assert "summary" in dashboard
			assert "charts" in dashboard
			assert "gaps" in dashboard
			assert "progress" in dashboard
			assert "alerts" in dashboard

		asyncio.run(_test())

	def test_get_dashboard_data_nonexistent(self, generator):
		"""Test dashboard data for non-existent matrix"""
		dashboard = generator.get_dashboard_data("nonexistent")
		assert "error" in dashboard

	def test_list_matrices(self, generator):
		"""Test listing matrices"""
		async def _test():
			# Create two matrices
			await generator.generate_matrix(
				requirements=SAMPLE_REQUIREMENTS[:1],
				rfp_id="rfp-test-007",
			)
			await generator.generate_matrix(
				requirements=SAMPLE_REQUIREMENTS[1:2],
				rfp_id="rfp-test-008",
			)

			# List all
			all_matrices = generator.list_matrices()
			assert len(all_matrices) >= 2

			# Filter by RFP
			filtered = generator.list_matrices(rfp_id="rfp-test-007")
			assert len(filtered) == 1

		asyncio.run(_test())

	def test_delete_matrix(self, generator):
		"""Test deleting matrix"""
		async def _test():
			matrix = await generator.generate_matrix(
				requirements=SAMPLE_REQUIREMENTS[:1],
				rfp_id="rfp-test-009",
			)

			# Delete
			result = generator.delete_matrix(matrix.id)
			assert result is True

			# Check deleted
			assert generator.get_matrix(matrix.id) is None

			# Delete non-existent
			assert generator.delete_matrix("nonexistent") is False

		asyncio.run(_test())

	def test_get_gap_report(self, generator):
		"""Test gap report generation"""
		async def _test():
			matrix = await generator.generate_matrix(
				requirements=SAMPLE_REQUIREMENTS,
				rfp_id="rfp-test-010",
			)

			report = generator.get_gap_report(matrix.id)

			assert report["matrix_id"] == matrix.id
			assert "total_gaps" in report
			assert "by_category" in report
			assert "by_type" in report
			assert "priority_gaps" in report

		asyncio.run(_test())

	def test_get_traceability_matrix(self, generator):
		"""Test traceability matrix generation"""
		async def _test():
			matrix = await generator.generate_matrix(
				requirements=SAMPLE_REQUIREMENTS,
				rfp_id="rfp-test-011",
			)

			# Update some mappings with section IDs
			await generator.update_mapping(
				matrix_id=matrix.id,
				requirement_id=matrix.mappings[0].requirement_id,
				section_id="section-1",
				section_title="Introduction",
				status=ComplianceStatus.ADDRESSED,
			)

			traceability = generator.get_traceability_matrix(matrix.id)

			assert traceability["matrix_id"] == matrix.id
			assert "sections" in traceability
			assert "unmapped_requirements" in traceability
			assert "coverage_by_section" in traceability

		asyncio.run(_test())

	def test_auto_status_determination(self, generator):
		"""Test automatic status determination based on confidence"""
		async def _test():
			matrix = await generator.generate_matrix(
				requirements=SAMPLE_REQUIREMENTS[:1],
				rfp_id="rfp-test-012",
			)

			req_id = matrix.mappings[0].requirement_id

			# High confidence -> verified
			await generator.update_mapping(
				matrix_id=matrix.id,
				requirement_id=req_id,
				confidence=0.96,  # Above auto_verify_threshold
			)

			updated = generator.get_matrix(matrix.id)
			mapping = updated.get_mapping_by_requirement(req_id)
			assert mapping.status == ComplianceStatus.VERIFIED

		asyncio.run(_test())

	def test_register_callback(self, generator):
		"""Test registering update callback"""
		callback_called = []

		async def callback(matrix_id, requirement_id, status):
			callback_called.append((matrix_id, requirement_id, status))

		generator.register_update_callback(callback)

		async def _test():
			matrix = await generator.generate_matrix(
				requirements=SAMPLE_REQUIREMENTS[:1],
				rfp_id="rfp-test-013",
			)

			await generator.update_mapping(
				matrix_id=matrix.id,
				requirement_id=matrix.mappings[0].requirement_id,
				status=ComplianceStatus.ADDRESSED,
			)

			# Callback should have been called
			assert len(callback_called) > 0

		asyncio.run(_test())


class TestComplianceMatrixExport:
	"""Tests for matrix export functionality"""

	@pytest.fixture
	def matrix_with_data(self):
		"""Create matrix with sample data"""
		matrix = ComplianceMatrix(rfp_id="rfp-export-test")

		matrix.add_mapping(RequirementMapping(
			requirement_id="req-001",
			requirement_text="The system must support 1000 users.",
			modality=RequirementModality.MANDATORY,
			requirement_type=RequirementType.PERFORMANCE,
			source_section="Technical Requirements",
			page_number=5,
			section_id="section-1",
			section_title="System Architecture",
			status=ComplianceStatus.ADDRESSED,
			confidence=0.9,
			notes="Addressed in Section 3.2",
		))

		matrix.add_mapping(RequirementMapping(
			requirement_id="req-002",
			requirement_text="Optional mobile app.",
			modality=RequirementModality.OPTIONAL,
			requirement_type=RequirementType.FUNCTIONAL,
			source_section="Scope",
			status=ComplianceStatus.NOT_ADDRESSED,
			confidence=0.8,
		))

		return matrix

	def test_export_csv(self, matrix_with_data):
		"""Test CSV export"""
		csv_output = matrix_with_data.export_csv()

		assert "Requirement ID" in csv_output
		assert "req-001" in csv_output
		assert "req-002" in csv_output
		assert "mandatory" in csv_output
		assert "optional" in csv_output
		assert "addressed" in csv_output
		assert "not_addressed" in csv_output

	def test_export_excel(self, matrix_with_data):
		"""Test Excel export"""
		excel_bytes = matrix_with_data.export_excel()

		# Should return bytes
		assert isinstance(excel_bytes, bytes)
		assert len(excel_bytes) > 0

		# If openpyxl not available, falls back to CSV
		# Still returns bytes


class TestComplianceMatrixIntegration:
	"""Integration tests for compliance matrix"""

	@pytest.mark.asyncio
	async def test_full_workflow(self):
		"""Test complete workflow"""
		generator = create_compliance_matrix_generator()

		# Generate matrix
		matrix = await generator.generate_matrix(
			requirements=SAMPLE_REQUIREMENTS,
			rfp_id="rfp-integration-test",
			name="Integration Test Matrix",
		)

		assert len(matrix.mappings) == len(SAMPLE_REQUIREMENTS)

		# Update some mappings
		await generator.update_mapping(
			matrix_id=matrix.id,
			requirement_id=matrix.mappings[0].requirement_id,
			status=ComplianceStatus.ADDRESSED,
			confidence=0.9,
		)

		await generator.update_mapping(
			matrix_id=matrix.id,
			requirement_id=matrix.mappings[1].requirement_id,
			status=ComplianceStatus.VERIFIED,
			confidence=0.95,
		)

		# Get dashboard data
		dashboard = generator.get_dashboard_data(matrix.id)
		assert dashboard["summary"]["coverage_percentage"] > 0

		# Get gap report
		report = generator.get_gap_report(matrix.id)
		assert report["total_gaps"] < len(SAMPLE_REQUIREMENTS)

	@pytest.mark.asyncio
	async def test_with_requirement_extraction(self):
		"""Test integration with requirement extraction"""
		from docfusion.rfp.requirement_extractor import create_requirement_extractor

		# This would require actual document parsing in real usage
		# For now, test with sample text
		extractor = create_requirement_extractor()
		generator = create_compliance_matrix_generator()

		# Extract requirements
		result = await extractor.extract_from_text(
			"The contractor shall provide all services. The system must be available 24/7."
		)

		# Generate compliance matrix
		matrix = await generator.generate_matrix(
			requirements=result.requirements,
			rfp_id="rfp-extraction-test",
		)

		assert matrix is not None
		assert len(matrix.mappings) == len(result.requirements)


class TestFactoryFunctions:
	"""Tests for factory functions"""

	def test_create_compliance_matrix_generator_default(self):
		"""Test default factory function"""
		generator = create_compliance_matrix_generator()
		assert generator is not None
		assert isinstance(generator, ComplianceMatrixGenerator)

	def test_create_compliance_matrix_generator_custom_config(self):
		"""Test factory with custom config"""
		config = {
			"auto_verify_threshold": 0.98,
			"gap_alert_threshold": 0.4,
		}
		generator = create_compliance_matrix_generator(config)
		assert generator.config["auto_verify_threshold"] == 0.98
		assert generator.config["gap_alert_threshold"] == 0.4


if __name__ == "__main__":
	pytest.main([__file__, "-v"])