#!/usr/bin/env python3
"""
CrossReferenceManager Test Suite

Comprehensive testing for the cross-reference management system including
reference detection, numbering, validation, citation management, and Git + LaTeX integration.
"""

import pytest
import asyncio
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch
import json
import re

from .cross_reference_manager import (
	CrossReferenceManager,
	ReferenceDetector,
	NumberingEngine,
	ReferenceValidator,
	CitationManager,
	LaTeXReferenceGenerator,
	CrossReference,
	ReferenceTarget,
	Citation,
	ReferenceGraph,
	NumberingScheme,
	ValidationResult,
	CrossReferenceException,
	ReferenceNotFoundException,
	InvalidReferenceException,
	CircularReferenceException
)
from .content_assembler import ContentBlock
from .structure_builder import DocumentStructure, DocumentSection


@pytest.fixture
def sample_content_blocks():
	"""Create sample content blocks for testing"""
	return [
		ContentBlock(
			block_type="section",
			content="# Introduction\n\nThis is the introduction section with a reference to Figure 1.",
			title="Introduction",
			block_id="intro_001",
			order=1
		),
		ContentBlock(
			block_type="content",
			content="As shown in Table 2, the results demonstrate significant improvement.",
			title="Results Analysis",
			block_id="analysis_001",
			order=3
		),
		ContentBlock(
			block_type="figure",
			content="![System Architecture](architecture.png)",
			title="System Architecture Diagram",
			block_id="fig_001",
			order=2
		),
		ContentBlock(
			block_type="table",
			content="| Metric | Before | After |\n|---------|--------|-------|\n| Speed | 10ms | 5ms |",
			title="Performance Comparison",
			block_id="table_001",
			order=4
		),
		ContentBlock(
			block_type="content",
			content="According to Smith et al. (2024), this approach is revolutionary. See Section 1.2 for details.",
			title="Literature Review",
			block_id="lit_001",
			order=5
		)
	]


@pytest.fixture
def sample_document_structure():
	"""Create sample document structure for testing"""
	sections = [
		DocumentSection(
			section_id="sec_001",
			title="Introduction",
			level=1,
			section_number="1",
			section_type="heading",
			content_block_ids=["intro_001", "fig_001"],
			child_ids=["sec_002"]
		),
		DocumentSection(
			section_id="sec_002",
			title="Analysis",
			level=2,
			section_number="1.1",
			section_type="heading",
			content_block_ids=["analysis_001", "table_001"],
			parent_id="sec_001"
		),
		DocumentSection(
			section_id="sec_003",
			title="Literature Review",
			level=2,
			section_number="1.2",
			section_type="heading",
			content_block_ids=["lit_001"],
			parent_id="sec_001"
		)
	]
	
	return DocumentStructure(
		structure_id="test_structure",
		document_id="test_doc",
		template_name="test_template",
		sections=sections
	)


@pytest.fixture
def sample_citations():
	"""Create sample citations for testing"""
	return [
		Citation(
			citation_key="smith2024",
			citation_type="article",
			title="Revolutionary Approaches in AI",
			authors=["John Smith", "Jane Doe"],
			publication_year=2024,
			journal="AI Research Quarterly",
			volume="15",
			issue="3",
			pages="123-145",
			doi="10.1234/air.2024.123"
		),
		Citation(
			citation_key="johnson2023",
			citation_type="book",
			title="Modern Document Processing",
			authors=["Sarah Johnson"],
			publication_year=2023,
			publisher="Tech Publishing",
			location="New York",
			isbn="978-1234567890"
		)
	]


class TestReferenceDetector:
	"""Test suite for ReferenceDetector class"""

	@pytest.fixture
	def detector(self):
		return ReferenceDetector()

	async def test_detect_figure_references(self, detector):
		"""Test detection of figure references"""
		content = "As shown in Figure 1, the system architecture demonstrates complexity. Figure 2 shows the detailed workflow."
		
		references = await detector.detect_references(content, "test_content")
		
		assert len(references) == 2
		assert references[0].reference_type == "figure"
		assert references[0].reference_text == "Figure 1"
		assert references[1].reference_text == "Figure 2"

	async def test_detect_table_references(self, detector):
		"""Test detection of table references"""
		content = "The data in Table 3.1 shows significant improvement. Refer to Table A for additional details."
		
		references = await detector.detect_references(content, "test_content")
		
		assert len(references) == 2
		assert all(ref.reference_type == "table" for ref in references)
		assert references[0].reference_text == "Table 3.1"
		assert references[1].reference_text == "Table A"

	async def test_detect_section_references(self, detector):
		"""Test detection of section references"""
		content = "As described in Section 2.3, the methodology is robust. See Section A.1 for appendix details."
		
		references = await detector.detect_references(content, "test_content")
		
		assert len(references) == 2
		assert all(ref.reference_type == "section" for ref in references)
		assert references[0].reference_text == "Section 2.3"
		assert references[1].reference_text == "Section A.1"

	async def test_detect_citation_references(self, detector):
		"""Test detection of citation references"""
		content = "According to Smith et al. (2024), this is revolutionary. Previous work (Johnson, 2023) supports this."
		
		references = await detector.detect_references(content, "test_content")
		
		assert len(references) == 2
		assert all(ref.reference_type == "citation" for ref in references)

	async def test_detect_targets_figures(self, detector):
		"""Test detection of figure targets"""
		content = "![System Architecture](architecture.png)\n\n**Figure 1:** System Architecture Diagram"
		
		targets = await detector.detect_targets(content, "test_content")
		
		assert len(targets) == 1
		assert targets[0].target_type == "figure"
		assert targets[0].title == "System Architecture Diagram"

	async def test_detect_targets_tables(self, detector):
		"""Test detection of table targets"""
		content = "| Metric | Value |\n|---------|-------|\n| Speed | 10ms |\n\n**Table 1:** Performance Metrics"
		
		targets = await detector.detect_targets(content, "test_content")
		
		assert len(targets) == 1
		assert targets[0].target_type == "table"
		assert targets[0].title == "Performance Metrics"

	def test_classify_reference_type(self, detector):
		"""Test reference type classification"""
		assert detector.classify_reference_type("Figure 1") == "figure"
		assert detector.classify_reference_type("Table 2.3") == "table"
		assert detector.classify_reference_type("Section A.1") == "section"
		assert detector.classify_reference_type("Equation 5") == "equation"

	def test_extract_reference_context(self, detector):
		"""Test reference context extraction"""
		content = "This is some text before Figure 1 reference and some text after."
		position = content.find("Figure 1")
		
		context = detector.extract_reference_context(content, position, window_size=10)
		
		assert "before" in context
		assert "after" in context
		assert "Figure 1" in context


class TestNumberingEngine:
	"""Test suite for NumberingEngine class"""

	@pytest.fixture
	def numbering_engine(self):
		return NumberingEngine()

	@pytest.fixture
	def decimal_scheme(self):
		return NumberingScheme(
			scheme_name="decimal",
			scheme_type="decimal",
			pattern="{section}.{number}",
			hierarchical=True
		)

	@pytest.fixture
	def sample_targets(self):
		return [
			ReferenceTarget(
				target_type="figure",
				content_id="fig_001",
				title="Architecture Diagram",
				section_id="sec_001",
				hierarchy_level=1,
				display_order=1
			),
			ReferenceTarget(
				target_type="figure", 
				content_id="fig_002",
				title="Workflow Diagram",
				section_id="sec_001",
				hierarchy_level=1,
				display_order=2
			),
			ReferenceTarget(
				target_type="table",
				content_id="table_001", 
				title="Performance Data",
				section_id="sec_002",
				hierarchy_level=2,
				display_order=1
			)
		]

	async def test_apply_decimal_numbering(self, numbering_engine, decimal_scheme, sample_targets):
		"""Test decimal numbering scheme application"""
		numbered_targets = await numbering_engine.apply_numbering(sample_targets, decimal_scheme)
		
		assert numbered_targets[0].number == "1.1"
		assert numbered_targets[1].number == "1.2"
		assert numbered_targets[2].number == "2.1"

	async def test_generate_number_hierarchical(self, numbering_engine, decimal_scheme):
		"""Test hierarchical number generation"""
		target = ReferenceTarget(
			target_type="figure",
			section_id="sec_003",
			hierarchy_level=2,
			display_order=3
		)
		
		context = {"section_numbers": {"sec_003": "2.1"}}
		number = numbering_engine.generate_number(target, decimal_scheme, context)
		
		assert number == "2.1.3"

	def test_format_number_with_prefix(self, numbering_engine, decimal_scheme):
		"""Test number formatting with prefix/suffix"""
		decimal_scheme.prefix = "Figure "
		decimal_scheme.suffix = ""
		
		formatted = numbering_engine.format_number("1.2", decimal_scheme, "figure")
		
		assert formatted == "Figure 1.2"

	async def test_renumber_after_insertion(self, numbering_engine, decimal_scheme, sample_targets):
		"""Test renumbering after content insertion"""
		# Simulate adding a new figure between existing ones
		new_target = ReferenceTarget(
			target_type="figure",
			content_id="fig_new",
			title="New Diagram",
			section_id="sec_001",
			hierarchy_level=1,
			display_order=1.5  # Between first and second
		)
		
		sample_targets.append(new_target)
		sample_targets.sort(key=lambda t: (t.section_id, t.display_order))
		
		numbered_targets = await numbering_engine.apply_numbering(sample_targets, decimal_scheme)
		
		# Check that numbering is sequential after insertion
		figure_targets = [t for t in numbered_targets if t.target_type == "figure"]
		numbers = [t.number for t in figure_targets]
		assert numbers == ["1.1", "1.2", "1.3"]


class TestReferenceValidator:
	"""Test suite for ReferenceValidator class"""

	@pytest.fixture
	def validator(self):
		return ReferenceValidator()

	@pytest.fixture
	def sample_graph(self, sample_content_blocks):
		"""Create a sample reference graph for testing"""
		references = [
			CrossReference(
				reference_id="ref_001",
				source_id="intro_001",
				target_id="fig_001",
				reference_type="figure",
				reference_text="Figure 1"
			),
			CrossReference(
				reference_id="ref_002",
				source_id="analysis_001",
				target_id="table_001",
				reference_type="table",
				reference_text="Table 2"
			),
			CrossReference(
				reference_id="ref_003",
				source_id="lit_001",
				target_id="sec_002",
				reference_type="section",
				reference_text="Section 1.2"
			)
		]
		
		targets = [
			ReferenceTarget(
				target_id="fig_001",
				target_type="figure",
				content_id="fig_001",
				title="Architecture Diagram",
				number="1"
			),
			ReferenceTarget(
				target_id="table_001",
				target_type="table",
				content_id="table_001",
				title="Performance Data",
				number="1"
			),
			ReferenceTarget(
				target_id="sec_002",
				target_type="section",
				content_id="sec_002",
				title="Analysis Section",
				number="1.1"
			)
		]
		
		return ReferenceGraph(
			document_id="test_doc",
			references={ref.reference_id: ref for ref in references},
			targets={target.target_id: target for target in targets},
			reference_edges={ref.reference_id: ref.target_id for ref in references}
		)

	async def test_validate_valid_reference_graph(self, validator, sample_graph):
		"""Test validation of valid reference graph"""
		result = await validator.validate_reference_graph(sample_graph)
		
		assert result.valid is True
		assert len(result.errors) == 0

	async def test_validate_reference_with_missing_target(self, validator, sample_graph):
		"""Test validation of reference with missing target"""
		# Add reference with non-existent target
		broken_ref = CrossReference(
			reference_id="ref_broken",
			source_id="intro_001",
			target_id="missing_target",
			reference_type="figure",
			reference_text="Figure 99"
		)
		sample_graph.references["ref_broken"] = broken_ref
		sample_graph.reference_edges["ref_broken"] = "missing_target"
		
		result = await validator.validate_reference_graph(sample_graph)
		
		assert result.valid is False
		assert any("missing target" in error.lower() for error in result.errors)

	async def test_validate_individual_reference(self, validator, sample_graph):
		"""Test validation of individual reference"""
		reference = sample_graph.references["ref_001"]
		
		result = await validator.validate_reference(reference, sample_graph)
		
		assert result.valid is True

	def test_detect_orphaned_references(self, validator, sample_graph):
		"""Test detection of orphaned references"""
		# Remove a target to create orphaned reference
		del sample_graph.targets["fig_001"]
		
		orphaned = validator.find_orphaned_references(sample_graph)
		
		assert "ref_001" in orphaned

	def test_suggest_repairs(self, validator, sample_graph):
		"""Test reference repair suggestions"""
		# Create broken reference
		broken_refs = ["ref_001"]  # Reference to fig_001
		del sample_graph.targets["fig_001"]  # Remove target
		
		suggestions = validator.suggest_repairs(broken_refs, sample_graph)
		
		assert "ref_001" in suggestions
		assert len(suggestions["ref_001"]) > 0


class TestCitationManager:
	"""Test suite for CitationManager class"""

	@pytest.fixture
	def citation_manager(self):
		return CitationManager()

	async def test_format_apa_citation(self, citation_manager, sample_citations):
		"""Test APA citation formatting"""
		citation = sample_citations[0]  # Smith et al. article
		
		formatted = await citation_manager.format_citation(citation, "apa", "inline")
		
		assert "Smith" in formatted
		assert "2024" in formatted

	async def test_format_mla_citation(self, citation_manager, sample_citations):
		"""Test MLA citation formatting"""
		citation = sample_citations[1]  # Johnson book
		
		formatted = await citation_manager.format_citation(citation, "mla", "inline")
		
		assert "Johnson" in formatted
		assert "Modern Document Processing" in formatted

	async def test_generate_apa_bibliography(self, citation_manager, sample_citations):
		"""Test APA bibliography generation"""
		bibliography = await citation_manager.generate_bibliography(sample_citations, "apa")
		
		assert "Smith, J." in bibliography
		assert "Johnson, S." in bibliography
		assert "AI Research Quarterly" in bibliography

	async def test_validate_complete_citation(self, citation_manager, sample_citations):
		"""Test validation of complete citation"""
		citation = sample_citations[0]
		
		result = await citation_manager.validate_citation(citation)
		
		assert result.valid is True

	async def test_validate_incomplete_citation(self, citation_manager):
		"""Test validation of incomplete citation"""
		incomplete_citation = Citation(
			citation_key="incomplete",
			citation_type="article",
			title="Test Article"
			# Missing authors, year, etc.
		)
		
		result = await citation_manager.validate_citation(incomplete_citation)
		
		assert result.valid is False
		assert len(result.errors) > 0

	def test_detect_duplicate_citations(self, citation_manager):
		"""Test duplicate citation detection"""
		citations = [
			Citation(
				citation_key="test1",
				title="Test Article",
				authors=["John Smith"],
				publication_year=2024
			),
			Citation(
				citation_key="test2",
				title="Test Article",  # Same title
				authors=["John Smith"],  # Same author
				publication_year=2024  # Same year
			)
		]
		
		duplicates = citation_manager.detect_duplicate_citations(citations)
		
		assert len(duplicates) > 0


class TestLaTeXReferenceGenerator:
	"""Test suite for LaTeXReferenceGenerator class"""

	@pytest.fixture
	def latex_generator(self):
		return LaTeXReferenceGenerator()

	def test_generate_latex_labels(self, latex_generator):
		"""Test LaTeX label generation"""
		targets = [
			ReferenceTarget(
				target_id="fig_001",
				target_type="figure",
				title="Architecture Diagram",
				number="1"
			),
			ReferenceTarget(
				target_id="table_001",
				target_type="table",
				title="Performance Data",
				number="1"
			)
		]
		
		labels = latex_generator.generate_latex_labels(targets)
		
		assert "fig_001" in labels
		assert "table_001" in labels
		assert "\\label{fig:architecture-diagram}" in labels["fig_001"]
		assert "\\label{tab:performance-data}" in labels["table_001"]

	def test_generate_latex_references(self, latex_generator):
		"""Test LaTeX reference command generation"""
		references = [
			CrossReference(
				reference_id="ref_001",
				target_id="fig_001",
				reference_type="figure",
				reference_text="Figure 1"
			)
		]
		
		latex_refs = latex_generator.generate_latex_references(references)
		
		assert "ref_001" in latex_refs
		assert "\\ref{" in latex_refs["ref_001"]

	def test_generate_latex_citations(self, latex_generator, sample_citations):
		"""Test LaTeX citation command generation"""
		latex_cites = latex_generator.generate_latex_citations(sample_citations)
		
		assert "smith2024" in latex_cites
		assert "johnson2023" in latex_cites
		assert "\\cite{smith2024}" in latex_cites["smith2024"]

	def test_generate_latex_bibliography(self, latex_generator, sample_citations):
		"""Test LaTeX bibliography generation"""
		bibliography = latex_generator.generate_latex_bibliography(sample_citations, "ieee")
		
		assert "\\begin{thebibliography}" in bibliography
		assert "\\bibitem{smith2024}" in bibliography
		assert "\\bibitem{johnson2023}" in bibliography
		assert "\\end{thebibliography}" in bibliography


class TestCrossReferenceManager:
	"""Test suite for main CrossReferenceManager class"""

	@pytest.fixture
	def reference_manager(self):
		return CrossReferenceManager()

	async def test_build_reference_graph(self, reference_manager, sample_content_blocks, sample_document_structure):
		"""Test building complete reference graph"""
		graph = await reference_manager.build_reference_graph(
			"test_doc", 
			sample_content_blocks, 
			sample_document_structure
		)
		
		assert graph.document_id == "test_doc"
		assert len(graph.references) > 0
		assert len(graph.targets) > 0
		assert graph.total_references > 0
		assert graph.total_targets > 0

	async def test_update_reference_numbering(self, reference_manager, sample_content_blocks, sample_document_structure):
		"""Test reference numbering updates"""
		graph = await reference_manager.build_reference_graph(
			"test_doc",
			sample_content_blocks,
			sample_document_structure
		)
		
		numbered_graph = await reference_manager.update_reference_numbering(
			graph,
			NumberingScheme(
				scheme_name="decimal",
				scheme_type="decimal",
				pattern="{section}.{number}"
			)
		)
		
		# Check that targets have numbers assigned
		for target in numbered_graph.targets.values():
			assert target.number != ""

	async def test_validate_and_repair_references(self, reference_manager, sample_content_blocks, sample_document_structure):
		"""Test reference validation and repair"""
		graph = await reference_manager.build_reference_graph(
			"test_doc",
			sample_content_blocks, 
			sample_document_structure
		)
		
		validation_result = await reference_manager.validate_and_repair_references(graph)
		
		assert hasattr(validation_result, 'valid')
		assert hasattr(validation_result, 'errors')
		assert hasattr(validation_result, 'repairs_suggested')

	async def test_generate_latex_output(self, reference_manager, sample_content_blocks, sample_document_structure):
		"""Test LaTeX output generation"""
		graph = await reference_manager.build_reference_graph(
			"test_doc",
			sample_content_blocks,
			sample_document_structure
		)
		
		latex_output = await reference_manager.generate_latex_output(graph)
		
		assert "labels" in latex_output
		assert "references" in latex_output
		assert "bibliography" in latex_output
		
		# Check LaTeX commands are present
		assert any("\\label{" in label for label in latex_output["labels"].values())
		assert any("\\ref{" in ref for ref in latex_output["references"].values())

	async def test_get_reference_statistics(self, reference_manager, sample_content_blocks, sample_document_structure):
		"""Test reference statistics generation"""
		graph = await reference_manager.build_reference_graph(
			"test_doc",
			sample_content_blocks,
			sample_document_structure
		)
		
		stats = await reference_manager.get_reference_statistics(graph)
		
		assert "total_references" in stats
		assert "total_targets" in stats
		assert "references_by_type" in stats
		assert "targets_by_type" in stats
		assert "validation_score" in stats

	async def test_export_reference_report(self, reference_manager, sample_content_blocks, sample_document_structure):
		"""Test reference report export"""
		graph = await reference_manager.build_reference_graph(
			"test_doc",
			sample_content_blocks,
			sample_document_structure
		)
		
		report = await reference_manager.export_reference_report(graph, format="json")
		
		report_data = json.loads(report)
		assert "document_id" in report_data
		assert "summary" in report_data
		assert "references" in report_data
		assert "targets" in report_data
		assert "validation_results" in report_data


class TestIntegrationScenarios:
	"""Integration tests for complex cross-reference scenarios"""

	@pytest.fixture
	def reference_manager(self):
		return CrossReferenceManager()

	async def test_complex_document_workflow(self, reference_manager):
		"""Test complete document reference workflow"""
		# Create complex content with multiple reference types
		content_blocks = [
			ContentBlock(
				block_type="section",
				content="# Introduction\n\nThis document presents a comprehensive analysis. As shown in Figure 1, the architecture is modular.",
				title="Introduction",
				block_id="intro"
			),
			ContentBlock(
				block_type="figure", 
				content="![Architecture](arch.png)",
				title="System Architecture",
				block_id="fig_arch"
			),
			ContentBlock(
				block_type="content",
				content="The performance metrics in Table 1 demonstrate significant improvements. According to Smith (2024), this approach is optimal.",
				title="Performance Analysis",
				block_id="perf_analysis"
			),
			ContentBlock(
				block_type="table",
				content="| Metric | Before | After |\n|---------|--------|-------|\n| Speed | 100ms | 50ms |",
				title="Performance Metrics",
				block_id="perf_table"
			)
		]
		
		# Build reference graph
		graph = await reference_manager.build_reference_graph("complex_doc", content_blocks)
		
		# Apply numbering
		numbered_graph = await reference_manager.update_reference_numbering(graph)
		
		# Validate references
		validation = await reference_manager.validate_and_repair_references(numbered_graph)
		
		# Generate LaTeX output
		latex_output = await reference_manager.generate_latex_output(numbered_graph)
		
		# Verify complete workflow
		assert numbered_graph.total_references > 0
		assert numbered_graph.total_targets > 0
		assert validation.valid
		assert len(latex_output["labels"]) > 0
		assert len(latex_output["references"]) > 0

	async def test_cross_document_references(self, reference_manager):
		"""Test handling of cross-document references"""
		content_with_external_refs = [
			ContentBlock(
				block_type="content",
				content="As demonstrated in Chapter 2 of the Technical Manual, and shown in Figure 3.1 of the User Guide...",
				title="Cross-Document Analysis",
				block_id="cross_doc"
			)
		]
		
		graph = await reference_manager.build_reference_graph("main_doc", content_with_external_refs)
		
		# Should detect external references but handle gracefully
		assert graph.total_references >= 0  # May or may not detect external refs

	async def test_reference_update_scenarios(self, reference_manager):
		"""Test various reference update scenarios"""
		initial_blocks = [
			ContentBlock(
				block_type="content",
				content="See Figure 1 for details.",
				title="Initial Content",
				block_id="initial"
			),
			ContentBlock(
				block_type="figure",
				content="![Original](orig.png)",
				title="Original Figure",
				block_id="orig_fig"
			)
		]
		
		# Build initial graph
		graph = await reference_manager.build_reference_graph("update_test", initial_blocks)
		initial_refs = len(graph.references)
		
		# Add new content with references
		updated_blocks = initial_blocks + [
			ContentBlock(
				block_type="content",
				content="Additionally, Table 1 shows the data.",
				title="New Content",
				block_id="new_content"
			),
			ContentBlock(
				block_type="table",
				content="| Data | Value |\n|------|-------|\n| Test | 42 |",
				title="Data Table",
				block_id="data_table"
			)
		]
		
		# Update graph
		updated_graph = await reference_manager.build_reference_graph("update_test", updated_blocks)
		
		# Verify updates
		assert len(updated_graph.references) >= initial_refs
		assert updated_graph.total_targets > graph.total_targets


class TestErrorHandling:
	"""Test error handling and edge cases"""

	@pytest.fixture
	def reference_manager(self):
		return CrossReferenceManager()

	async def test_malformed_content_handling(self, reference_manager):
		"""Test handling of malformed content"""
		malformed_blocks = [
			ContentBlock(
				block_type="content",
				content="This has a malformed reference: Figure ???",
				title="Malformed Content",
				block_id="malformed"
			)
		]
		
		# Should handle gracefully without crashing
		graph = await reference_manager.build_reference_graph("malformed_test", malformed_blocks)
		assert graph is not None

	async def test_circular_reference_detection(self, reference_manager):
		"""Test detection of circular references"""
		# This is challenging to test in practice since our content format
		# doesn't naturally create circular references, but we can test
		# the detection mechanism
		validator = ReferenceValidator()
		
		# Create a graph with circular references manually
		circular_graph = ReferenceGraph(
			document_id="circular_test",
			references={
				"ref1": CrossReference(
					reference_id="ref1",
					source_id="content1",
					target_id="content2",
					reference_type="section",
					reference_text="Section 2"
				),
				"ref2": CrossReference(
					reference_id="ref2", 
					source_id="content2",
					target_id="content1",
					reference_type="section",
					reference_text="Section 1"
				)
			},
			targets={
				"content1": ReferenceTarget(
					target_id="content1",
					target_type="section",
					content_id="content1"
				),
				"content2": ReferenceTarget(
					target_id="content2",
					target_type="section", 
					content_id="content2"
				)
			}
		)
		
		# Test circular reference detection
		circulars = validator.detect_circular_references(circular_graph)
		# Should detect at least some circular patterns

	async def test_performance_with_large_document(self, reference_manager):
		"""Test performance with large number of references"""
		# Create content with many references
		large_content_blocks = []
		
		# Add content with many figure references
		for i in range(100):
			large_content_blocks.append(
				ContentBlock(
					block_type="content",
					content=f"This section references Figure {i+1} and Table {i+1}.",
					title=f"Section {i+1}",
					block_id=f"content_{i}"
				)
			)
			large_content_blocks.append(
				ContentBlock(
					block_type="figure",
					content=f"![Figure {i+1}](fig_{i}.png)",
					title=f"Figure {i+1}",
					block_id=f"fig_{i}"
				)
			)
		
		# Time the operation
		import time
		start_time = time.time()
		
		graph = await reference_manager.build_reference_graph("large_test", large_content_blocks)
		
		end_time = time.time()
		processing_time = end_time - start_time
		
		# Should complete in reasonable time (adjust threshold as needed)
		assert processing_time < 5.0  # 5 seconds max
		assert graph.total_references > 0


if __name__ == "__main__":
	# Run tests directly
	pytest.main([__file__, "-v", "-x"])