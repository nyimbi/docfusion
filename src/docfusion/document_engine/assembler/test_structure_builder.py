"""
Comprehensive test suite for StructureBuilder Module

Tests all components of the StructureBuilder including template engine,
structure management, TOC generation, and outline creation.
"""

import asyncio
import json
from datetime import datetime
from typing import Any

import pytest

from .structure_builder import (
	StructureBuilder,
	TemplateEngine,
	StructureManager,
	TOCGenerator,
	OutlineBuilder,
	DocumentTemplate,
	DocumentStructure,
	DocumentSection,
	TOCConfiguration,
	TOCEntry,
	TableOfContents,
	DocumentOutline,
	SectionDefinition,
	TemplateVariable,
	CompiledTemplate,
	ValidationResult,
	NumberingSystem,
	TemplateCache,
	TemplateNotFound,
	TemplateInvalid,
	HierarchyInvalid,
	create_mock_content_blocks
)
from .content_assembler import ContentBlock


class TestNumberingSystem:
	"""Test NumberingSystem functionality"""
	
	def test_decimal_numbering(self):
		"""Test decimal numbering system (1.2.3)"""
		numbering = NumberingSystem()
		
		section = DocumentSection(
			title="Test Section",
			section_type="content",
			level=1,
			sibling_order=0
		)
		
		number = numbering.generate_section_number(section, "", "1.2.3")
		assert number == "1"
		
		number = numbering.generate_section_number(section, "1", "1.2.3")
		assert number == "1.1"
		
		section.sibling_order = 2
		number = numbering.generate_section_number(section, "1.2", "1.2.3")
		assert number == "1.2.3"
	
	def test_roman_alpha_numbering(self):
		"""Test Roman-Alpha numbering system (I.A.1)"""
		numbering = NumberingSystem()
		
		# Level 1 - Roman numerals
		section = DocumentSection(
			title="Test Section",
			section_type="content",
			level=1,
			sibling_order=0
		)
		
		number = numbering.generate_section_number(section, "", "I.A.1")
		assert number == "I"
		
		section.sibling_order = 2
		number = numbering.generate_section_number(section, "", "I.A.1")
		assert number == "III"
		
		# Level 2 - Alpha characters
		section.level = 2
		section.sibling_order = 0
		number = numbering.generate_section_number(section, "I", "I.A.1")
		assert number == "I.A"
		
		section.sibling_order = 2
		number = numbering.generate_section_number(section, "I", "I.A.1")
		assert number == "I.C"
	
	def test_alpha_roman_numbering(self):
		"""Test Alpha-Roman numbering system (a.i.1)"""
		numbering = NumberingSystem()
		
		section = DocumentSection(
			title="Test Section",
			section_type="content",
			level=1,
			sibling_order=0
		)
		
		number = numbering.generate_section_number(section, "", "a.i.1")
		assert number == "a"
		
		section.level = 2
		number = numbering.generate_section_number(section, "a", "a.i.1")
		assert number == "a.i"
		
		section.level = 3
		number = numbering.generate_section_number(section, "a.i", "a.i.1")
		assert number == "a.i.1"


class TestTemplateCache:
	"""Test template caching functionality"""
	
	def test_cache_storage_and_retrieval(self):
		"""Test storing and retrieving templates from cache"""
		cache = TemplateCache(max_size=3)
		
		template = DocumentTemplate(
			template_name="test_template",
			template_type="proposal"
		)
		
		# Store template
		cache.store_template(template)
		
		# Retrieve template
		retrieved = cache.get_template("test_template")
		assert retrieved is not None
		assert retrieved.template_name == "test_template"
		
		# Non-existent template
		missing = cache.get_template("missing_template")
		assert missing is None
	
	def test_cache_eviction(self):
		"""Test LRU cache eviction when max size exceeded"""
		cache = TemplateCache(max_size=2)
		
		template1 = DocumentTemplate(template_name="template1", template_type="proposal")
		template2 = DocumentTemplate(template_name="template2", template_type="report")
		template3 = DocumentTemplate(template_name="template3", template_type="technical")
		
		# Store three templates (should evict oldest)
		cache.store_template(template1)
		cache.store_template(template2)
		cache.store_template(template3)
		
		# template1 should be evicted
		assert cache.get_template("template1") is None
		assert cache.get_template("template2") is not None
		assert cache.get_template("template3") is not None
	
	def test_cache_invalidation(self):
		"""Test template cache invalidation"""
		cache = TemplateCache()
		
		template = DocumentTemplate(
			template_name="test_template",
			template_type="proposal"
		)
		cache.store_template(template)
		
		# Verify template is cached
		assert cache.get_template("test_template") is not None
		
		# Invalidate template
		cache.invalidate_template("test_template")
		
		# Verify template is removed
		assert cache.get_template("test_template") is None


class TestTemplateEngine:
	"""Test TemplateEngine functionality"""
	
	@pytest.fixture
	def template_engine(self):
		"""Create TemplateEngine instance for testing"""
		return TemplateEngine()
	
	async def test_load_built_in_template(self, template_engine):
		"""Test loading built-in templates"""
		template = await template_engine.load_template("proposal")
		
		assert template is not None
		assert template.template_name == "proposal"
		assert template.template_type == "proposal"
		assert len(template.section_definitions) > 0
		assert "executive_summary" in [s.name for s in template.section_definitions]
	
	async def test_load_nonexistent_template(self, template_engine):
		"""Test error handling for nonexistent templates"""
		with pytest.raises(TemplateNotFound):
			await template_engine.load_template("nonexistent_template")
	
	async def test_compile_template(self, template_engine):
		"""Test template compilation with variables"""
		template = await template_engine.load_template("proposal")
		
		variables = {
			"client_name": "ACME Corporation",
			"rfp_number": "RFP-2024-001",
			"submission_date": "2024-01-15"
		}
		
		compiled = await template_engine.compile_template(template, variables)
		
		assert isinstance(compiled, CompiledTemplate)
		assert compiled.template_id == template.template_id
		assert len(compiled.compiled_sections) > 0
		assert "client_name" in compiled.resolved_variables
		assert compiled.resolved_variables["client_name"] == "ACME Corporation"
	
	async def test_template_validation(self, template_engine):
		"""Test template validation"""
		template = await template_engine.load_template("proposal")
		
		result = await template_engine.validate_template(template)
		
		assert isinstance(result, ValidationResult)
		assert result.valid
		assert len(result.errors) == 0
	
	async def test_template_validation_with_errors(self, template_engine):
		"""Test template validation with invalid template"""
		invalid_template = DocumentTemplate(
			template_name="invalid",
			template_type="proposal",
			section_definitions=[
				SectionDefinition(name="section1", section_type="content", level=10),  # Invalid level
				SectionDefinition(name="section1", section_type="content", level=1)   # Duplicate name
			],
			required_sections=["missing_section"],  # Section doesn't exist
			max_depth=3
		)
		
		result = await template_engine.validate_template(invalid_template)
		
		assert isinstance(result, ValidationResult)
		assert not result.valid
		assert len(result.errors) >= 2  # Should have multiple errors


class TestStructureManager:
	"""Test StructureManager functionality"""
	
	@pytest.fixture
	def structure_manager(self):
		"""Create StructureManager instance for testing"""
		return StructureManager()
	
	@pytest.fixture
	async def compiled_template(self):
		"""Create compiled template for testing"""
		engine = TemplateEngine()
		template = await engine.load_template("proposal")
		variables = {"client_name": "Test Client", "rfp_number": "TEST-001"}
		return await engine.compile_template(template, variables)
	
	@pytest.fixture
	async def mock_content_blocks(self):
		"""Create mock content blocks for testing"""
		return await create_mock_content_blocks()
	
	async def test_build_structure(self, structure_manager, compiled_template, mock_content_blocks):
		"""Test building document structure from template and content"""
		structure = await structure_manager.build_structure(
			compiled_template,
			mock_content_blocks,
			"test_document_001"
		)
		
		assert isinstance(structure, DocumentStructure)
		assert structure.document_id == "test_document_001"
		assert len(structure.sections) > 0
		assert structure.structure_hash != ""
		assert structure.compilation_time > 0
		
		# Verify sections are properly created
		section_titles = [s.title for s in structure.sections]
		assert any("Executive Summary" in title for title in section_titles)
	
	async def test_section_numbering(self, structure_manager, compiled_template, mock_content_blocks):
		"""Test automatic section numbering"""
		structure = await structure_manager.build_structure(
			compiled_template,
			mock_content_blocks,
			"test_document_002"
		)
		
		# Check that sections have proper numbering
		numbered_sections = [s for s in structure.sections if s.section_number]
		assert len(numbered_sections) > 0
		
		# Check numbering format
		for section in numbered_sections:
			if section.level > 0:  # Skip title pages
				assert section.section_number != ""
				# Should be decimal format for default
				assert all(c.isdigit() or c == '.' for c in section.section_number)
	
	async def test_content_block_mapping(self, structure_manager, compiled_template, mock_content_blocks):
		"""Test mapping content blocks to sections"""
		structure = await structure_manager.build_structure(
			compiled_template,
			mock_content_blocks,
			"test_document_003"
		)
		
		# Verify content blocks are mapped to sections
		assert len(structure.content_block_mapping) > 0
		
		# Check that all content blocks are mapped
		block_ids = {block.block_id for block in mock_content_blocks}
		mapped_block_ids = set(structure.content_block_mapping.keys())
		
		# At least some blocks should be mapped
		assert len(mapped_block_ids & block_ids) > 0


class TestTOCGenerator:
	"""Test TOC generation functionality"""
	
	@pytest.fixture
	def toc_generator(self):
		"""Create TOCGenerator instance for testing"""
		return TOCGenerator()
	
	@pytest.fixture
	async def sample_structure(self):
		"""Create sample document structure for testing"""
		builder = StructureBuilder()
		content_blocks = await create_mock_content_blocks()
		
		return await builder.create_document_structure(
			template_name="proposal",
			document_id="test_doc",
			content_blocks=content_blocks,
			template_variables={"client_name": "Test Client", "rfp_number": "TEST-001"}
		)
	
	async def test_generate_toc(self, toc_generator, sample_structure):
		"""Test basic TOC generation"""
		toc = await toc_generator.generate_toc(sample_structure)
		
		assert isinstance(toc, TableOfContents)
		assert toc.document_id == sample_structure.document_id
		assert len(toc.entries) > 0
		assert toc.total_entries == len(toc.entries)
		
		# Verify entries have required fields
		for entry in toc.entries:
			assert entry.title != ""
			assert entry.level > 0
			assert entry.section_id != ""
	
	async def test_toc_with_custom_config(self, toc_generator, sample_structure):
		"""Test TOC generation with custom configuration"""
		config = TOCConfiguration(
			max_depth=2,
			min_depth=1,
			title="Custom Table of Contents",
			numbering_style="decimal"
		)
		
		toc = await toc_generator.generate_toc(sample_structure, config)
		
		assert toc.title == "Custom Table of Contents"
		assert toc.configuration.max_depth == 2
		
		# Verify depth filtering
		for entry in toc.entries:
			assert 1 <= entry.level <= 2
	
	def test_format_toc_latex(self, toc_generator):
		"""Test LaTeX TOC formatting"""
		toc = TableOfContents(
			title="Test TOC",
			entries=[
				TOCEntry(
					section_id="sec1",
					title="Introduction",
					level=1,
					section_number="1",
					anchor_id="sec-intro"
				),
				TOCEntry(
					section_id="sec2",
					title="Background",
					level=2,
					section_number="1.1",
					anchor_id="sec-background",
					indent_level=1
				)
			]
		)
		
		latex_output = toc_generator.format_toc_latex(toc)
		
		assert isinstance(latex_output, str)
		assert "\\section*{Test TOC}" in latex_output
		assert "\\textbf{1} Introduction" in latex_output
		assert "\\textbf{1.1} Background" in latex_output
	
	def test_format_toc_markdown(self, toc_generator):
		"""Test Markdown TOC formatting"""
		toc = TableOfContents(
			title="Test TOC",
			entries=[
				TOCEntry(
					section_id="sec1",
					title="Introduction",
					level=1,
					section_number="1",
					anchor_id="sec-intro"
				),
				TOCEntry(
					section_id="sec2",
					title="Background",
					level=2,
					section_number="1.1",
					anchor_id="sec-background",
					indent_level=1
				)
			],
			configuration=TOCConfiguration(clickable_links=True)
		)
		
		markdown_output = toc_generator.format_toc_markdown(toc)
		
		assert isinstance(markdown_output, str)
		assert "# Test TOC" in markdown_output
		assert "- [1 Introduction](#sec-intro)" in markdown_output
		assert "  - [1.1 Background](#sec-background)" in markdown_output


class TestOutlineBuilder:
	"""Test document outline creation"""
	
	@pytest.fixture
	def outline_builder(self):
		"""Create OutlineBuilder instance for testing"""
		return OutlineBuilder()
	
	@pytest.fixture
	async def sample_structure(self):
		"""Create sample document structure for testing"""
		builder = StructureBuilder()
		content_blocks = await create_mock_content_blocks()
		
		return await builder.create_document_structure(
			template_name="proposal",
			document_id="test_doc",
			content_blocks=content_blocks,
			template_variables={"client_name": "Test Client", "rfp_number": "TEST-001"}
		)
	
	async def test_create_outline(self, outline_builder, sample_structure):
		"""Test basic outline creation"""
		outline = await outline_builder.create_outline(sample_structure)
		
		assert isinstance(outline, DocumentOutline)
		assert outline.document_id == sample_structure.document_id
		assert len(outline.sections) > 0
		assert outline.total_sections > 0
		
		# Verify outline sections have required fields
		for section in outline.sections:
			assert "id" in section
			assert "title" in section
			assert "level" in section
			assert "type" in section
	
	async def test_create_detailed_outline(self, outline_builder, sample_structure):
		"""Test detailed outline creation"""
		outline = await outline_builder.create_outline(
			sample_structure,
			detail_level="detailed"
		)
		
		# Detailed outline should have additional fields
		for section in outline.sections:
			assert "template_section" in section
			assert "anchor_id" in section
			assert "priority" in section
			assert "created_at" in section
	
	async def test_generate_section_summaries(self, outline_builder, sample_structure):
		"""Test section summary generation"""
		content_blocks = await create_mock_content_blocks()
		content_dict = {block.block_id: block for block in content_blocks}
		
		summaries = await outline_builder.generate_section_summaries(
			sample_structure,
			content_dict
		)
		
		assert isinstance(summaries, dict)
		assert len(summaries) > 0
		
		# Verify summaries are strings
		for section_id, summary in summaries.items():
			assert isinstance(summary, str)
			assert len(summary) > 0
	
	def test_export_outline_json(self, outline_builder):
		"""Test JSON outline export"""
		outline = DocumentOutline(
			document_id="test_doc",
			title="Test Outline",
			sections=[
				{
					"id": "sec1",
					"title": "Introduction",
					"level": 1,
					"type": "content"
				}
			],
			total_sections=1
		)
		
		json_output = outline_builder.export_outline_json(outline)
		
		assert isinstance(json_output, str)
		
		# Verify it's valid JSON
		parsed = json.loads(json_output)
		assert parsed["document_id"] == "test_doc"
		assert parsed["title"] == "Test Outline"
		assert len(parsed["sections"]) == 1
	
	def test_export_outline_markdown(self, outline_builder):
		"""Test Markdown outline export"""
		outline = DocumentOutline(
			document_id="test_doc",
			title="Test Outline",
			sections=[
				{
					"id": "sec1",
					"title": "Introduction",
					"level": 1,
					"type": "content",
					"number": "1",
					"summary": "This section introduces the topic.",
					"content_blocks": 2
				}
			],
			total_sections=1
		)
		
		markdown_output = outline_builder.export_outline_markdown(outline)
		
		assert isinstance(markdown_output, str)
		assert "# Test Outline" in markdown_output
		assert "**1 Introduction**" in markdown_output
		assert "This section introduces the topic." in markdown_output
		assert "*Content blocks: 2*" in markdown_output


class TestStructureBuilder:
	"""Test main StructureBuilder class"""
	
	@pytest.fixture
	def structure_builder(self):
		"""Create StructureBuilder instance for testing"""
		return StructureBuilder()
	
	@pytest.fixture
	async def mock_content_blocks(self):
		"""Create mock content blocks for testing"""
		return await create_mock_content_blocks()
	
	async def test_create_document_structure(self, structure_builder, mock_content_blocks):
		"""Test complete document structure creation"""
		structure = await structure_builder.create_document_structure(
			template_name="proposal",
			document_id="test_proposal_001",
			content_blocks=mock_content_blocks,
			template_variables={
				"client_name": "ACME Corporation",
				"rfp_number": "RFP-2024-TEST-001",
				"submission_date": "2024-01-15"
			}
		)
		
		assert isinstance(structure, DocumentStructure)
		assert structure.document_id == "test_proposal_001"
		assert structure.template_name != ""
		assert len(structure.sections) > 0
		assert len(structure.generated_toc) > 0
		
		# Verify template variables are applied
		assert "client_name" in structure.template_variables
		assert structure.template_variables["client_name"] == "ACME Corporation"
	
	async def test_generate_table_of_contents(self, structure_builder, mock_content_blocks):
		"""Test TOC generation with different formats"""
		structure = await structure_builder.create_document_structure(
			template_name="proposal",
			document_id="test_toc_doc",
			content_blocks=mock_content_blocks
		)
		
		# Test LaTeX format
		latex_toc = await structure_builder.generate_table_of_contents(
			structure,
			output_format="latex"
		)
		assert isinstance(latex_toc, str)
		assert "\\section*{Table of Contents}" in latex_toc
		
		# Test Markdown format
		markdown_toc = await structure_builder.generate_table_of_contents(
			structure,
			output_format="markdown"
		)
		assert isinstance(markdown_toc, str)
		assert "# Table of Contents" in markdown_toc
		
		# Test JSON format
		json_toc = await structure_builder.generate_table_of_contents(
			structure,
			output_format="json"
		)
		assert isinstance(json_toc, str)
		parsed_toc = json.loads(json_toc)
		assert "title" in parsed_toc
		assert "entries" in parsed_toc
	
	async def test_create_document_outline(self, structure_builder, mock_content_blocks):
		"""Test document outline creation and export"""
		structure = await structure_builder.create_document_structure(
			template_name="proposal",
			document_id="test_outline_doc",
			content_blocks=mock_content_blocks
		)
		
		content_dict = {block.block_id: block for block in mock_content_blocks}
		
		# Test JSON export
		json_outline = await structure_builder.create_document_outline(
			structure,
			content_blocks=content_dict,
			export_format="json"
		)
		assert isinstance(json_outline, str)
		parsed_outline = json.loads(json_outline)
		assert "document_id" in parsed_outline
		assert "sections" in parsed_outline
		
		# Test Markdown export
		markdown_outline = await structure_builder.create_document_outline(
			structure,
			content_blocks=content_dict,
			export_format="markdown"
		)
		assert isinstance(markdown_outline, str)
		assert "# Outline for" in markdown_outline
	
	async def test_validate_document_structure(self, structure_builder, mock_content_blocks):
		"""Test document structure validation"""
		structure = await structure_builder.create_document_structure(
			template_name="proposal",
			document_id="test_validation_doc",
			content_blocks=mock_content_blocks
		)
		
		result = await structure_builder.validate_document_structure(structure)
		
		assert isinstance(result, ValidationResult)
		assert result.valid
		assert len(result.errors) == 0
		assert result.validation_time > 0
	
	async def test_validate_invalid_structure(self, structure_builder):
		"""Test validation of invalid document structure"""
		# Create invalid structure with circular dependencies
		invalid_structure = DocumentStructure(
			document_id="invalid_doc",
			template_name="test",
			sections=[
				DocumentSection(
					section_id="sec1",
					title="Section 1",
					section_type="content",
					level=10,  # Exceeds max depth
					parent_id="sec2"
				),
				DocumentSection(
					section_id="sec2",
					title="Section 2",
					section_type="content",
					level=1,
					parent_id="sec1"  # Circular dependency
				)
			],
			max_depth=3
		)
		
		result = await structure_builder.validate_document_structure(invalid_structure)
		
		assert isinstance(result, ValidationResult)
		assert not result.valid
		assert len(result.errors) > 0
	
	def test_performance_stats(self, structure_builder):
		"""Test performance statistics tracking"""
		stats = structure_builder.get_performance_stats()
		
		assert isinstance(stats, dict)
		assert "total_operations" in stats
		assert "average_response_time" in stats
		assert "structures_created" in stats
	
	def test_clear_caches(self, structure_builder):
		"""Test cache clearing functionality"""
		# This should not raise any exceptions
		structure_builder.clear_caches()
		
		# Verify caches are cleared by checking they're empty
		assert len(structure_builder.template_engine.template_cache.templates) == 0
		assert len(structure_builder.structure_manager.structure_cache) == 0


class TestIntegrationScenarios:
	"""Test real-world integration scenarios"""
	
	@pytest.fixture
	def structure_builder(self):
		"""Create StructureBuilder instance for testing"""
		return StructureBuilder()
	
	async def test_proposal_document_workflow(self, structure_builder):
		"""Test complete proposal document creation workflow"""
		# Create comprehensive content blocks
		content_blocks = [
			ContentBlock(
				block_type="text",
				content="ACME Corporation seeks a comprehensive solution for digital transformation.",
				title="Executive Summary",
				metadata={"section": "executive_summary", "priority": "high"}
			),
			ContentBlock(
				block_type="text",
				content="Our approach leverages cloud-native architecture with microservices.",
				title="Technical Approach",
				metadata={"section": "technical_approach", "priority": "high"}
			),
			ContentBlock(
				block_type="table",
				content="Phase 1: Requirements Analysis (4 weeks), Phase 2: Development (12 weeks), Phase 3: Testing (4 weeks), Phase 4: Deployment (2 weeks)",
				title="Project Timeline",
				metadata={"section": "project_timeline", "priority": "medium"}
			),
			ContentBlock(
				block_type="text",
				content="Our team includes certified architects, developers, and project managers.",
				title="Team Qualifications",
				metadata={"section": "team_qualifications", "priority": "medium"}
			),
			ContentBlock(
				block_type="table",
				content="Development: $250,000, Infrastructure: $75,000, Testing: $40,000, Project Management: $35,000",
				title="Budget Analysis",
				metadata={"section": "budget", "priority": "high"}
			)
		]
		
		# Create document structure
		structure = await structure_builder.create_document_structure(
			template_name="proposal",
			document_id="acme_digital_transformation_proposal",
			content_blocks=content_blocks,
			template_variables={
				"client_name": "ACME Corporation",
				"rfp_number": "RFP-2024-DIGITAL-001",
				"submission_date": "2024-03-15"
			},
			toc_config=TOCConfiguration(
				max_depth=3,
				title="Table of Contents",
				clickable_links=True
			)
		)
		
		# Verify structure creation
		assert structure.document_id == "acme_digital_transformation_proposal"
		assert len(structure.sections) >= 5
		assert len(structure.generated_toc) > 0
		
		# Generate TOC in LaTeX format
		latex_toc = await structure_builder.generate_table_of_contents(
			structure,
			output_format="latex"
		)
		assert "Table of Contents" in latex_toc
		assert "Executive Summary" in latex_toc
		
		# Create comprehensive outline
		content_dict = {block.block_id: block for block in content_blocks}
		outline = await structure_builder.create_document_outline(
			structure,
			content_blocks=content_dict,
			detail_level="detailed",
			export_format="json"
		)
		
		# Verify outline completeness
		parsed_outline = json.loads(outline)
		assert len(parsed_outline["sections"]) >= 5
		assert parsed_outline["total_sections"] >= 5
		
		# Validate final structure
		validation = await structure_builder.validate_document_structure(structure)
		assert validation.valid
		assert len(validation.errors) == 0
	
	async def test_report_document_workflow(self, structure_builder):
		"""Test complete research report creation workflow"""
		content_blocks = [
			ContentBlock(
				block_type="text",
				content="This study examines the impact of AI on modern business operations.",
				title="Abstract",
				metadata={"section": "abstract", "priority": "high"}
			),
			ContentBlock(
				block_type="text",
				content="Artificial Intelligence has transformed business landscapes globally.",
				title="Introduction",
				metadata={"section": "introduction", "priority": "high"}
			),
			ContentBlock(
				block_type="text",
				content="We employed mixed-methods research including surveys and interviews.",
				title="Methodology",
				metadata={"section": "methodology", "priority": "high"}
			),
			ContentBlock(
				block_type="table",
				content="Survey responses: 1,200 participants, Interview subjects: 50 executives",
				title="Results Summary",
				metadata={"section": "results", "priority": "high"}
			),
			ContentBlock(
				block_type="text",
				content="The findings indicate significant productivity improvements with AI adoption.",
				title="Discussion",
				metadata={"section": "discussion", "priority": "high"}
			),
			ContentBlock(
				block_type="text",
				content="AI adoption is essential for competitive advantage in modern business.",
				title="Conclusion",
				metadata={"section": "conclusion", "priority": "high"}
			)
		]
		
		# Create report structure
		structure = await structure_builder.create_document_structure(
			template_name="report",
			document_id="ai_business_impact_report",
			content_blocks=content_blocks,
			template_variables={
				"report_title": "The Impact of Artificial Intelligence on Business Operations",
				"author": "Dr. Sarah Johnson",
				"organization": "Business Research Institute"
			}
		)
		
		# Verify report structure
		assert structure.document_id == "ai_business_impact_report"
		section_titles = [s.title for s in structure.sections]
		assert any("Abstract" in title for title in section_titles)
		assert any("Introduction" in title for title in section_titles)
		assert any("Methodology" in title for title in section_titles)
		
		# Generate markdown TOC for web display
		markdown_toc = await structure_builder.generate_table_of_contents(
			structure,
			output_format="markdown"
		)
		assert "# Table of Contents" in markdown_toc
		
		# Validate report structure
		validation = await structure_builder.validate_document_structure(structure)
		assert validation.valid
	
	async def test_performance_benchmarks(self, structure_builder):
		"""Test performance benchmarks for large documents"""
		# Create large number of content blocks
		large_content_blocks = []
		for i in range(100):
			block = ContentBlock(
				block_type="text",
				content=f"This is content block number {i} with substantial text content for testing performance.",
				title=f"Section {i}",
				metadata={"section": f"section_{i}", "priority": "medium"}
			)
			large_content_blocks.append(block)
		
		# Measure structure creation time
		start_time = datetime.now()
		
		structure = await structure_builder.create_document_structure(
			template_name="proposal",
			document_id="large_document_performance_test",
			content_blocks=large_content_blocks,
			template_variables={
				"client_name": "Large Scale Client",
				"rfp_number": "PERF-TEST-001"
			}
		)
		
		creation_time = (datetime.now() - start_time).total_seconds()
		
		# Verify performance benchmarks
		assert creation_time < 5.0  # Should complete within 5 seconds
		assert len(structure.sections) > 0
		assert structure.compilation_time < 3.0  # Internal compilation under 3 seconds
		
		# Test TOC generation performance
		start_time = datetime.now()
		toc = await structure_builder.generate_table_of_contents(structure)
		toc_time = (datetime.now() - start_time).total_seconds()
		
		assert toc_time < 1.0  # TOC generation under 1 second
		assert len(toc) > 0
		
		# Test outline generation performance
		start_time = datetime.now()
		content_dict = {block.block_id: block for block in large_content_blocks}
		outline = await structure_builder.create_document_outline(
			structure,
			content_blocks=content_dict
		)
		outline_time = (datetime.now() - start_time).total_seconds()
		
		assert outline_time < 2.0  # Outline generation under 2 seconds
		
		# Verify performance stats tracking
		stats = structure_builder.get_performance_stats()
		assert stats["structures_created"] > 0
		assert stats["average_response_time"] > 0


if __name__ == "__main__":
	# Run tests if executed directly
	pytest.main([__file__, "-v"])