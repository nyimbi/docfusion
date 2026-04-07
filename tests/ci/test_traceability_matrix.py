#!/usr/bin/env python3
"""
Tests for Traceability Matrix

Unit tests for the traceability matrix system including coverage analysis,
impact assessment, and orphan detection.
"""

import pytest
from datetime import datetime

from docfusion.rfp.traceability_matrix import (
	TraceabilityMatrix,
	TraceabilityLink,
	TraceabilityDirection,
	TraceabilityAnalyzer,
	TraceabilityMatrixBuilder,
	create_traceability_matrix_builder,
	create_traceability_analyzer,
)


class TestTraceabilityLink:
	"""Tests for TraceabilityLink model"""

	def test_link_creation(self):
		"""Test basic link creation"""
		link = TraceabilityLink(
			requirement_id="req-001",
			section_id="section-1",
			section_title="Introduction",
		)

		assert link.requirement_id == "req-001"
		assert link.section_id == "section-1"
		assert link.section_title == "Introduction"
		assert link.link_type == "direct"
		assert link.confidence == 1.0
		assert link.verified is False
		assert isinstance(link.id, str)
		assert isinstance(link.created_at, datetime)

	def test_link_with_custom_values(self):
		"""Test link with custom values"""
		link = TraceabilityLink(
			requirement_id="req-002",
			section_id="section-2",
			section_title="Technical Architecture",
			link_type="partial",
			confidence=0.8,
			verified=True,
			notes="Manually verified link",
		)

		assert link.link_type == "partial"
		assert link.confidence == 0.8
		assert link.verified is True
		assert link.notes == "Manually verified link"

	def test_link_validation(self):
		"""Test link validation"""
		# Valid confidence
		link = TraceabilityLink(
			requirement_id="req-003",
			section_id="section-3",
			confidence=0.5,
		)
		assert link.confidence == 0.5

		# Invalid confidence should raise
		with pytest.raises(Exception):
			TraceabilityLink(
				requirement_id="req-004",
				section_id="section-4",
				confidence=1.5,
			)


class TestTraceabilityMatrix:
	"""Tests for TraceabilityMatrix model"""

	def test_matrix_creation(self):
		"""Test basic matrix creation"""
		matrix = TraceabilityMatrix(rfp_id="rfp-001")

		assert matrix.rfp_id == "rfp-001"
		assert matrix.name == "Traceability Matrix"
		assert matrix.links == []
		assert matrix.requirement_index == {}
		assert matrix.section_index == {}

	def test_add_link(self):
		"""Test adding a link"""
		matrix = TraceabilityMatrix(rfp_id="rfp-001")
		link = TraceabilityLink(
			requirement_id="req-001",
			section_id="section-1",
		)

		matrix.add_link(link)

		assert len(matrix.links) == 1
		assert "req-001" in matrix.requirement_index
		assert "section-1" in matrix.section_index

	def test_remove_link(self):
		"""Test removing a link"""
		matrix = TraceabilityMatrix(rfp_id="rfp-001")
		link = TraceabilityLink(
			requirement_id="req-001",
			section_id="section-1",
		)

		matrix.add_link(link)
		result = matrix.remove_link(link.id)

		assert result is True
		assert len(matrix.links) == 0
		assert link.id not in matrix.requirement_index.get("req-001", [])

	def test_remove_nonexistent_link(self):
		"""Test removing non-existent link"""
		matrix = TraceabilityMatrix(rfp_id="rfp-001")
		result = matrix.remove_link("nonexistent")
		assert result is False

	def test_get_links_for_requirement(self):
		"""Test getting links for a requirement"""
		matrix = TraceabilityMatrix(rfp_id="rfp-001")

		matrix.add_link(TraceabilityLink(
			requirement_id="req-001",
			section_id="section-1",
		))
		matrix.add_link(TraceabilityLink(
			requirement_id="req-001",
			section_id="section-2",
		))
		matrix.add_link(TraceabilityLink(
			requirement_id="req-002",
			section_id="section-1",
		))

		links = matrix.get_links_for_requirement("req-001")
		assert len(links) == 2

		links = matrix.get_links_for_requirement("req-002")
		assert len(links) == 1

		links = matrix.get_links_for_requirement("nonexistent")
		assert len(links) == 0

	def test_get_links_for_section(self):
		"""Test getting links for a section"""
		matrix = TraceabilityMatrix(rfp_id="rfp-001")

		matrix.add_link(TraceabilityLink(
			requirement_id="req-001",
			section_id="section-1",
		))
		matrix.add_link(TraceabilityLink(
			requirement_id="req-002",
			section_id="section-1",
		))
		matrix.add_link(TraceabilityLink(
			requirement_id="req-003",
			section_id="section-2",
		))

		links = matrix.get_links_for_section("section-1")
		assert len(links) == 2

		links = matrix.get_links_for_section("section-2")
		assert len(links) == 1

	def test_get_untraced_requirements(self):
		"""Test getting untraced requirements"""
		matrix = TraceabilityMatrix(rfp_id="rfp-001")

		# Add to index without links
		matrix.requirement_index["req-001"] = []
		matrix.requirement_index["req-002"] = ["link-1"]  # Has link

		matrix.add_link(TraceabilityLink(
			requirement_id="req-002",
			section_id="section-1",
		))

		untraced = matrix.get_untraced_requirements()
		assert "req-001" in untraced
		assert "req-002" not in untraced

	def test_get_untraced_sections(self):
		"""Test getting untraced sections"""
		matrix = TraceabilityMatrix(rfp_id="rfp-001")

		# Add to index without links
		matrix.section_index["section-1"] = []
		matrix.section_index["section-2"] = ["link-1"]  # Has link

		matrix.add_link(TraceabilityLink(
			requirement_id="req-1",
			section_id="section-2",
		))

		untraced = matrix.get_untraced_sections()
		assert "section-1" in untraced
		assert "section-2" not in untraced

	def test_get_coverage_stats(self):
		"""Test coverage statistics"""
		matrix = TraceabilityMatrix(rfp_id="rfp-001")

		matrix.add_link(TraceabilityLink(
			requirement_id="req-001",
			section_id="section-1",
		))
		matrix.add_link(TraceabilityLink(
			requirement_id="req-002",
			section_id="section-2",
			verified=True,
		))

		stats = matrix.get_coverage_stats()

		assert stats["total_requirements"] == 2
		assert stats["traced_requirements"] == 2
		assert stats["requirement_coverage"] == 100.0
		assert stats["total_sections"] == 2
		assert stats["verified_links"] == 1


class TestTraceabilityAnalyzer:
	"""Tests for TraceabilityAnalyzer"""

	@pytest.fixture
	def analyzer(self):
		"""Create analyzer instance"""
		return create_traceability_analyzer()

	@pytest.fixture
	def sample_matrix(self):
		"""Create sample matrix for testing"""
		matrix = TraceabilityMatrix(rfp_id="test-rfp")

		matrix.add_link(TraceabilityLink(
			requirement_id="req-001",
			section_id="section-1",
			confidence=0.9,
		))
		matrix.add_link(TraceabilityLink(
			requirement_id="req-002",
			section_id="section-1",
			confidence=0.8,
		))
		matrix.add_link(TraceabilityLink(
			requirement_id="req-003",
			section_id="section-2",
			confidence=0.7,
		))

		return matrix

	def test_analyze_coverage(self, analyzer, sample_matrix):
		"""Test coverage analysis"""
		analysis = analyzer.analyze_coverage(sample_matrix)

		assert "coverage_stats" in analysis
		assert "low_link_requirements" in analysis
		assert "recommendations" in analysis

	def test_analyze_impact(self, analyzer, sample_matrix):
		"""Test impact analysis"""
		impact = analyzer.analyze_impact(
			matrix=sample_matrix,
			requirement_ids=["req-001", "req-002"],
		)

		assert "changed_requirements" in impact
		assert "affected_sections" in impact
		assert "total_sections_affected" in impact
		assert "severity" in impact

		# req-001 and req-002 both link to section-1
		assert impact["total_sections_affected"] == 1

	def test_analyze_impact_no_changes(self, analyzer):
		"""Test impact analysis with no changes"""
		matrix = TraceabilityMatrix(rfp_id="test-rfp")
		impact = analyzer.analyze_impact(matrix, [])

		assert impact["total_sections_affected"] == 0
		assert impact["severity"] == "none"

	def test_find_orphans(self, analyzer, sample_matrix):
		"""Test orphan detection"""
		# Add untraced items
		sample_matrix.requirement_index["req-004"] = []  # Untraced
		sample_matrix.section_index["section-3"] = []  # Untraced

		orphans = analyzer.find_orphans(sample_matrix)

		assert "untraced_requirements" in orphans
		assert "untraced_sections" in orphans
		assert "total_orphans" in orphans
		assert "req-004" in orphans["untraced_requirements"]

	def test_find_orphans_with_ids(self, analyzer, sample_matrix):
		"""Test orphan detection with expected IDs"""
		orphans = analyzer.find_orphans(
			matrix=sample_matrix,
			requirement_ids=["req-001", "req-002", "req-missing"],
			section_ids=["section-1", "section-missing"],
		)

		assert "missing_requirements" in orphans
		assert "missing_sections" in orphans
		assert "req-missing" in orphans["missing_requirements"]
		assert "section-missing" in orphans["missing_sections"]

	def test_check_completeness(self, analyzer, sample_matrix):
		"""Test completeness check"""
		requirement_ids = ["req-001", "req-002", "req-003", "req-004"]

		completeness = analyzer.check_completeness(
			matrix=sample_matrix,
			requirement_ids=requirement_ids,
		)

		assert "total_expected" in completeness
		assert "present_count" in completeness
		assert "missing_count" in completeness
		assert "completeness_percentage" in completeness
		assert "is_complete" in completeness

		# req-004 is missing from matrix
		assert completeness["missing_count"] == 1
		assert completeness["completeness_percentage"] == 75.0

	def test_check_completeness_empty_matrix(self, analyzer):
		"""Test completeness check with empty matrix"""
		matrix = TraceabilityMatrix(rfp_id="test-rfp")

		completeness = analyzer.check_completeness(
			matrix=matrix,
			requirement_ids=["req-001", "req-002"],
		)

		assert completeness["present_count"] == 0
		assert completeness["missing_count"] == 2
		assert completeness["completeness_percentage"] == 0.0


class TestTraceabilityMatrixBuilder:
	"""Tests for TraceabilityMatrixBuilder"""

	def test_builder_creation(self):
		"""Test builder creation"""
		builder = create_traceability_matrix_builder(rfp_id="rfp-001")

		assert builder is not None
		assert isinstance(builder, TraceabilityMatrixBuilder)

	def test_add_requirement(self):
		"""Test adding requirement"""
		builder = TraceabilityMatrixBuilder(rfp_id="rfp-001")
		builder.add_requirement("req-001")

		matrix = builder.build()
		assert "req-001" in matrix.requirement_index

	def test_add_requirement_with_sections(self):
		"""Test adding requirement with sections"""
		builder = TraceabilityMatrixBuilder(rfp_id="rfp-001")
		builder.add_requirement("req-001", section_ids=["section-1", "section-2"])

		matrix = builder.build()
		links = matrix.get_links_for_requirement("req-001")
		assert len(links) == 2

	def test_add_section(self):
		"""Test adding section"""
		builder = TraceabilityMatrixBuilder(rfp_id="rfp-001")
		builder.add_section("section-1", "Introduction")

		matrix = builder.build()
		assert "section-1" in matrix.section_index

	def test_add_link(self):
		"""Test adding link"""
		builder = TraceabilityMatrixBuilder(rfp_id="rfp-001")
		builder.add_link(
			requirement_id="req-001",
			section_id="section-1",
			confidence=0.9,
			link_type="direct",
			notes="Test link",
		)

		matrix = builder.build()
		links = matrix.get_links_for_requirement("req-001")
		assert len(links) == 1
		assert links[0].confidence == 0.9

	def test_verify_link(self):
		"""Test verifying link"""
		builder = TraceabilityMatrixBuilder(rfp_id="rfp-001")
		builder.add_link("req-001", "section-1")
		builder.verify_link("req-001", "section-1")

		matrix = builder.build()
		links = matrix.get_links_for_requirement("req-001")
		assert links[0].verified is True

	def test_fluent_interface(self):
		"""Test fluent interface chaining"""
		matrix = (
			TraceabilityMatrixBuilder(rfp_id="rfp-001")
			.add_requirement("req-001", section_ids=["section-1"])
			.add_section("section-1", "Introduction")
			.add_link("req-002", "section-2", confidence=0.8)
			.verify_link("req-001", "section-1")
			.build()
		)

		assert len(matrix.links) == 2
		assert "req-001" in matrix.requirement_index
		assert "req-002" in matrix.requirement_index

	def test_duplicate_link_handling(self):
		"""Test handling duplicate links"""
		builder = TraceabilityMatrixBuilder(rfp_id="rfp-001")
		builder.add_link("req-001", "section-1")
		builder.add_link("req-001", "section-1")  # Duplicate

		matrix = builder.build()
		links = matrix.get_links_for_requirement("req-001")
		assert len(links) == 1  # Only one link created


class TestTraceabilityMatrixIntegration:
	"""Integration tests for traceability matrix"""

	def test_full_workflow(self):
		"""Test complete workflow"""
		# Create builder
		builder = create_traceability_matrix_builder(
			rfp_id="rfp-workflow-test",
			name="Workflow Test Matrix",
		)

		# Build matrix
		matrix = (
			builder
			.add_section("section-1", "Introduction")
			.add_section("section-2", "Technical Requirements")
			.add_requirement("req-001", section_ids=["section-1"])
			.add_requirement("req-002", section_ids=["section-1", "section-2"])
			.add_requirement("req-003")
			.verify_link("req-001", "section-1")
			.build()
		)

		# Verify structure
		assert len(matrix.links) == 3  # req-001 + req-002 has 2 links
		assert len(matrix.get_untraced_requirements()) == 1  # req-003

		# Analyze
		analyzer = create_traceability_analyzer()
		coverage = analyzer.analyze_coverage(matrix)

		assert coverage["coverage_stats"]["total_requirements"] == 3
		assert coverage["coverage_stats"]["traced_requirements"] == 2

		# Check completeness
		completeness = analyzer.check_completeness(
			matrix=matrix,
			requirement_ids=["req-001", "req-002", "req-003", "req-004"],
		)

		assert completeness["missing_count"] == 1  # req-004 not in matrix

	def test_impact_analysis_workflow(self):
		"""Test impact analysis workflow"""
		builder = TraceabilityMatrixBuilder(rfp_id="rfp-impact-test")

		# Create matrix with multiple sections
		matrix = (
			builder
			.add_link("req-001", "section-1")
			.add_link("req-001", "section-2")
			.add_link("req-002", "section-2")
			.add_link("req-003", "section-3")
			.build()
		)

		# Analyze impact of changing req-001
		analyzer = create_traceability_analyzer()
		impact = analyzer.analyze_impact(matrix, ["req-001"])

		assert impact["total_sections_affected"] == 2  # section-1 and section-2
		assert impact["total_links_affected"] == 2
		assert impact["severity"] in ("low", "medium", "high")

	def test_orphan_detection_workflow(self):
		"""Test orphan detection workflow"""
		builder = TraceabilityMatrixBuilder(rfp_id="rfp-orphan-test")

		matrix = (
			builder
			.add_link("req-001", "section-1")
			.add_link("req-002", "section-2")
			.build()
		)

		# Add untraced items
		matrix.requirement_index["req-003"] = []  # Orphan requirement
		matrix.section_index["section-3"] = []  # Orphan section

		analyzer = create_traceability_analyzer()
		orphans = analyzer.find_orphans(matrix)

		assert "req-003" in orphans["untraced_requirements"]
		assert "section-3" in orphans["untraced_sections"]
		assert orphans["total_orphans"] == 2


class TestFactoryFunctions:
	"""Tests for factory functions"""

	def test_create_traceability_matrix_builder(self):
		"""Test traceability matrix builder factory"""
		builder = create_traceability_matrix_builder(rfp_id="test-rfp")
		assert isinstance(builder, TraceabilityMatrixBuilder)

	def test_create_traceability_matrix_builder_with_name(self):
		"""Test builder factory with name"""
		builder = create_traceability_matrix_builder(
			rfp_id="test-rfp",
			name="Custom Name",
		)
		matrix = builder.build()
		assert matrix.name == "Custom Name"

	def test_create_traceability_analyzer(self):
		"""Test analyzer factory"""
		analyzer = create_traceability_analyzer()
		assert isinstance(analyzer, TraceabilityAnalyzer)

	def test_create_traceability_analyzer_with_config(self):
		"""Test analyzer factory with config"""
		config = {
			"min_links_per_requirement": 2,
			"max_links_per_requirement": 20,
		}
		analyzer = create_traceability_analyzer(config)
		assert analyzer.config["min_links_per_requirement"] == 2


if __name__ == "__main__":
	pytest.main([__file__, "-v"])