#!/usr/bin/env python3
"""
DOCXRenderer Module Tests

Comprehensive test suite for the DOCXRenderer module covering:
- Professional DOCX generation with python-docx integration
- Style translation and preservation across Word versions
- Asset embedding and optimization
- Quality validation and compatibility checking
- Performance optimization and batch processing
- Enterprise features and Word compatibility
"""

import asyncio
import pytest
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

from docfusion.document_engine.renderer.docx_renderer import (
	DOCXRenderer,
	DocumentBuilder,
	StyleTranslator,
	AssetEmbedder,
	DOCXQualityValidator,
	DOCXRenderConfiguration,
	DOCXRenderResult,
	FormattedDocumentContent,
	PageMargins,
	DOCXMetadata,
	DOCXPermissions,
	create_default_docx_configuration,
	quick_docx_render,
	validate_docx_renderer_installation,
	DOCXRendererException,
	DOCXRenderingException,
	DOCXCompatibilityException,
	DOCXStyleException,
	DOCXAssetException
)


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def sample_page_margins():
	"""Create sample page margins for testing"""
	return PageMargins(
		top="2.54cm",
		right="2.54cm", 
		bottom="2.54cm",
		left="2.54cm",
		header_margin="1.27cm",
		footer_margin="1.27cm"
	)


@pytest.fixture
def sample_docx_metadata():
	"""Create sample DOCX metadata for testing"""
	return DOCXMetadata(
		title="Test DOCX Document",
		author="Test Author",
		subject="DOCX Rendering Test",
		keywords=["test", "docx", "rendering"],
		category="Business Document",
		company="Test Company"
	)


@pytest.fixture
def sample_docx_permissions():
	"""Create sample DOCX permissions for testing"""
	return DOCXPermissions(
		allow_editing=True,
		allow_commenting=True,
		allow_formatting=True,
		allow_reviewing=True,
		track_changes_enforced=False
	)


@pytest.fixture
def sample_render_config(sample_page_margins, sample_docx_metadata, sample_docx_permissions):
	"""Create sample DOCX render configuration for testing"""
	return DOCXRenderConfiguration(
		page_size="A4",
		page_orientation="portrait",
		page_margins=sample_page_margins,
		document_metadata=sample_docx_metadata,
		word_version_compatibility="2016",
		font_embedding=True,
		style_preservation=True,
		edit_restrictions=sample_docx_permissions
	)


@pytest.fixture
def sample_formatted_content():
	"""Create sample formatted document content for testing"""
	return FormattedDocumentContent(
		title="Sample DOCX Document",
		content_html="""
		<section class="document-content">
			<h1>Sample Document Title</h1>
			<p>This is a sample paragraph with <strong>bold text</strong> and <em>italic text</em>.</p>
			<h2>Section Heading</h2>
			<p>Another paragraph with content for testing DOCX rendering capabilities.</p>
			<ul>
				<li>List item one</li>
				<li>List item two</li>
				<li>List item three</li>
			</ul>
			<table>
				<tr><th>Header 1</th><th>Header 2</th></tr>
				<tr><td>Data 1</td><td>Data 2</td></tr>
			</table>
		</section>
		""",
		content_text="Sample Document Title\n\nThis is a sample paragraph with bold text and italic text.\n\nSection Heading\n\nAnother paragraph with content for testing DOCX rendering capabilities.\n\n• List item one\n• List item two\n• List item three",
		computed_styles={
			"h1": {"font-size": "24pt", "font-weight": "bold", "color": "#2c3e50"},
			"h2": {"font-size": "18pt", "font-weight": "bold", "color": "#34495e"},
			"p": {"font-size": "11pt", "line-height": "1.6"},
			"strong": {"font-weight": "bold"},
			"em": {"font-style": "italic"}
		},
		image_assets={
			"logo.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
		},
		metadata={"category": "test", "priority": "high"}
	)


@pytest.fixture
def sample_style_specifications():
	"""Create sample style specifications for testing"""
	return {
		"font-family": "Calibri",
		"font-size": "11pt",
		"color": "#000000",
		"text-align": "left",
		"line-height": "1.15"
	}


@pytest.fixture
def document_builder():
	"""Create DocumentBuilder instance for testing"""
	return DocumentBuilder()


@pytest.fixture
def style_translator():
	"""Create StyleTranslator instance for testing"""
	return StyleTranslator()


@pytest.fixture
def asset_embedder():
	"""Create AssetEmbedder instance for testing"""
	return AssetEmbedder()


@pytest.fixture
def docx_quality_validator():
	"""Create DOCXQualityValidator instance for testing"""
	return DOCXQualityValidator()


@pytest.fixture
def docx_renderer(sample_render_config, docx_quality_validator):
	"""Create DOCXRenderer instance for testing"""
	return DOCXRenderer(
		render_config=sample_render_config,
		quality_validator=docx_quality_validator
	)


# ============================================================================
# DocumentBuilder Tests
# ============================================================================

class TestDocumentBuilder:
	"""Test DocumentBuilder functionality"""
	
	def test_document_builder_initialization(self, document_builder):
		"""Test DocumentBuilder initialization"""
		assert document_builder.document_cache == {}
		assert document_builder.build_metrics['documents_built'] == 0
	
	async def test_build_document_success(self, document_builder, sample_formatted_content, sample_render_config):
		"""Test successful document building"""
		document_structure = await document_builder.build_document(
			sample_formatted_content,
			sample_render_config
		)
		
		assert document_structure['title'] == "Sample DOCX Document"
		assert 'metadata' in document_structure
		assert document_structure['metadata']['author'] == sample_render_config.document_metadata.author
		assert document_structure['metadata']['word_count'] > 0
		assert document_structure['styles_applied'] > 0
		assert document_structure['page_setup']['size'] == "A4"
	
	def test_create_paragraph(self, document_builder):
		"""Test paragraph creation"""
		paragraph = document_builder.create_paragraph("Test paragraph text", "Heading 1")
		
		assert paragraph['type'] == 'paragraph'
		assert paragraph['text'] == "Test paragraph text"
		assert paragraph['style'] == "Heading 1"
		assert 'formatting' in paragraph
	
	def test_create_table(self, document_builder):
		"""Test table creation"""
		table = document_builder.create_table(3, 4, "Table Professional")
		
		assert table['type'] == 'table'
		assert table['rows'] == 3
		assert table['columns'] == 4
		assert table['style'] == "Table Professional"
		assert len(table['cells']) == 3
		assert len(table['cells'][0]) == 4
	
	def test_add_image(self, document_builder):
		"""Test image addition"""
		image_data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
		image = document_builder.add_image(image_data, width=100.0, height=50.0)
		
		assert image['type'] == 'image'
		assert image['data'] == image_data
		assert image['width'] == 100.0
		assert image['height'] == 50.0
		assert image['positioning'] == 'inline'


# ============================================================================
# StyleTranslator Tests
# ============================================================================

class TestStyleTranslator:
	"""Test StyleTranslator functionality"""
	
	def test_style_translator_initialization(self, style_translator):
		"""Test StyleTranslator initialization"""
		assert style_translator.style_cache == {}
		assert 'font-family' in style_translator.translation_rules
		assert 'font-size' in style_translator.translation_rules
	
	async def test_translate_styles_success(self, style_translator):
		"""Test successful style translation"""
		css_styles = {
			'font-family': 'Arial',
			'font-size': '12pt',
			'font-weight': 'bold',
			'color': '#000000',
			'text-align': 'center'
		}
		
		docx_formatting = await style_translator.translate_styles(css_styles)
		
		assert 'font_name' in docx_formatting
		assert 'font_size' in docx_formatting
		assert 'bold' in docx_formatting
		assert docx_formatting['font_size'] == 12.0
		assert docx_formatting['bold'] is True
		assert docx_formatting['alignment'] == 'center'
	
	async def test_translate_font_sizes(self, style_translator):
		"""Test font size conversion"""
		# Test pt units
		result_pt = await style_translator.translate_styles({'font-size': '14pt'})
		assert result_pt['font_size'] == 14.0
		
		# Test px units
		result_px = await style_translator.translate_styles({'font-size': '16px'})
		assert result_px['font_size'] == 12.0  # 16px * 0.75 = 12pt
		
		# Test default
		result_default = await style_translator.translate_styles({'font-size': 'medium'})
		assert result_default['font_size'] == 11.0
	
	async def test_translate_text_alignment(self, style_translator):
		"""Test text alignment translation"""
		alignments = {
			'left': 'left',
			'center': 'center',
			'right': 'right',
			'justify': 'justify'
		}
		
		for css_align, expected_docx_align in alignments.items():
			result = await style_translator.translate_styles({'text-align': css_align})
			assert result['alignment'] == expected_docx_align
	
	def test_create_custom_style(self, style_translator):
		"""Test custom style creation"""
		formatting = {
			'font_name': 'Times New Roman',
			'font_size': 12.0,
			'bold': True
		}
		
		custom_style = style_translator.create_custom_style("Custom Heading", formatting)
		
		assert custom_style['name'] == "Custom Heading"
		assert custom_style['type'] == 'paragraph'
		assert custom_style['formatting'] == formatting
		assert custom_style['base_style'] == 'Normal'


# ============================================================================
# AssetEmbedder Tests
# ============================================================================

class TestAssetEmbedder:
	"""Test AssetEmbedder functionality"""
	
	def test_asset_embedder_initialization(self, asset_embedder):
		"""Test AssetEmbedder initialization"""
		assert asset_embedder.asset_cache == {}
		assert 'png' in asset_embedder.supported_formats
		assert 'jpg' in asset_embedder.supported_formats
	
	async def test_embed_images_success(self, asset_embedder):
		"""Test successful image embedding"""
		image_assets = {
			"logo.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
			"photo.jpg": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD//gAKRm9yIG1vcmUgaW5mbw=="
		}
		
		result = await asset_embedder.embed_images(image_assets)
		
		assert 'embedded_images' in result
		assert 'processing_results' in result
		assert result['processing_results']['total_processed'] == 2
		assert result['processing_results']['successful_embeddings'] == 2
		assert 'logo.png' in result['embedded_images']
		assert 'photo.jpg' in result['embedded_images']
	
	async def test_embed_images_with_optimization(self, asset_embedder):
		"""Test image embedding with optimization"""
		image_assets = {
			"optimized.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
		}
		
		result = await asset_embedder.embed_images(image_assets)
		
		embedded_image = result['embedded_images']['optimized.png']
		assert embedded_image['format'] == 'png'
		assert embedded_image['optimized'] is True
		assert embedded_image['embedding_method'] == 'base64'
	
	async def test_embed_svg_conversion(self, asset_embedder):
		"""Test SVG conversion during embedding"""
		image_assets = {
			"icon.svg": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDAiIGZpbGw9IiNmZjAwMDAiLz48L3N2Zz4="
		}
		
		result = await asset_embedder.embed_images(image_assets)
		
		embedded_image = result['embedded_images']['icon.svg']
		assert embedded_image['format'] == 'svg'
		assert embedded_image['converted'] is True  # SVG converted to PNG
		assert result['processing_results']['format_conversions'] == 1
	
	def test_create_table_from_data(self, asset_embedder):
		"""Test table creation from data"""
		table_data = [
			["Name", "Age", "City"],
			["John", "25", "New York"],
			["Jane", "30", "Los Angeles"]
		]
		
		table = asset_embedder.create_table_from_data(table_data, "Professional Table")
		
		assert table['type'] == 'table'
		assert table['rows'] == 3
		assert table['columns'] == 3
		assert table['style'] == "Professional Table"
		assert table['data'] == table_data
		assert table['formatting']['borders'] is True
		assert table['formatting']['header_row'] is True
	
	def test_create_table_empty_data(self, asset_embedder):
		"""Test table creation with empty data"""
		empty_table = asset_embedder.create_table_from_data([])
		assert empty_table == {}


# ============================================================================
# DOCXQualityValidator Tests
# ============================================================================

class TestDOCXQualityValidator:
	"""Test DOCXQualityValidator functionality"""
	
	def test_quality_validator_initialization(self, docx_quality_validator):
		"""Test DOCXQualityValidator initialization"""
		assert docx_quality_validator.validation_rules is not None
		assert 'max_file_size' in docx_quality_validator.validation_rules
		assert 'accessibility_requirements' in docx_quality_validator.validation_rules
	
	async def test_validate_docx_quality_success(self, docx_quality_validator, sample_render_config):
		"""Test successful DOCX quality validation"""
		mock_docx_content = b"PK\x03\x04Mock DOCX content\x00\x00"
		
		quality_report = await docx_quality_validator.validate_docx_quality(
			mock_docx_content,
			sample_render_config
		)
		
		assert quality_report['overall_quality_score'] > 0.0
		assert quality_report['document_integrity'] is True
		assert quality_report['word_compatibility'] is True
		assert 'validation_issues' in quality_report
		assert 'performance_metrics' in quality_report
	
	async def test_validate_large_file_warning(self, docx_quality_validator, sample_render_config):
		"""Test validation warning for large files"""
		# Create a file larger than 50MB limit (50 * 1024 * 1024 = 52,428,800 bytes)
		large_docx_content = b"PK\x03\x04" + b"Large content" * 5000000  # About 65MB
		
		quality_report = await docx_quality_validator.validate_docx_quality(
			large_docx_content,
			sample_render_config
		)
		
		# Should have lower quality score due to large file size
		assert len(quality_report['validation_issues']) > 0
		assert any("File size exceeds" in issue for issue in quality_report['validation_issues'])
	
	async def test_validate_empty_docx(self, docx_quality_validator, sample_render_config):
		"""Test validation of empty DOCX content"""
		empty_docx = b""
		
		quality_report = await docx_quality_validator.validate_docx_quality(
			empty_docx,
			sample_render_config
		)
		
		assert quality_report['overall_quality_score'] < 0.5
		assert quality_report['document_integrity'] is False
	
	def test_check_word_compatibility(self, docx_quality_validator):
		"""Test Word version compatibility checking"""
		target_versions = ['2013', '2016', '2019', '365']
		
		compatibility_results = docx_quality_validator.check_word_compatibility(target_versions)
		
		assert len(compatibility_results) == 4
		assert compatibility_results['word_2013'] is True
		assert compatibility_results['word_2016'] is True
		assert compatibility_results['word_2019'] is True
		assert compatibility_results['word_365'] is True
	
	def test_check_unsupported_word_version(self, docx_quality_validator):
		"""Test compatibility check with unsupported version"""
		target_versions = ['2007', '2003']
		
		compatibility_results = docx_quality_validator.check_word_compatibility(target_versions)
		
		assert compatibility_results['word_2007'] is False
		assert compatibility_results['word_2003'] is False
	
	def test_validate_accessibility(self, docx_quality_validator):
		"""Test accessibility validation"""
		accessibility_report = docx_quality_validator.validate_accessibility()
		
		assert accessibility_report['screen_reader_compatible'] is True
		assert accessibility_report['keyboard_navigation'] is True
		assert accessibility_report['alt_text_coverage'] > 0.9
		assert accessibility_report['accessibility_score'] > 0.8


# ============================================================================
# DOCXRenderer Core Tests
# ============================================================================

class TestDOCXRenderer:
	"""Test DOCXRenderer core functionality"""
	
	def test_docx_renderer_initialization(self, docx_renderer):
		"""Test DOCXRenderer initialization"""
		assert docx_renderer.render_config is not None
		assert docx_renderer.quality_validator is not None
		assert docx_renderer.document_builder is not None
		assert docx_renderer.style_translator is not None
		assert docx_renderer.asset_embedder is not None
		assert docx_renderer.metrics['documents_rendered'] == 0
	
	async def test_render_docx_success(self, docx_renderer, sample_formatted_content):
		"""Test successful DOCX rendering"""
		result = await docx_renderer.render_docx(sample_formatted_content)
		
		assert result.render_successful is True
		assert result.document_id == sample_formatted_content.document_id
		assert len(result.docx_content) > 0
		assert result.file_size > 0
		assert result.page_count >= 1
		assert result.word_count > 0
		assert result.rendering_time > 0
		assert result.rendering_quality_score > 0
	
	async def test_render_docx_with_output_path(self, docx_renderer, sample_formatted_content):
		"""Test DOCX rendering with file output"""
		with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as temp_file:
			output_path = temp_file.name
		
		try:
			result = await docx_renderer.render_docx(sample_formatted_content, output_path)
			
			assert result.render_successful is True
			assert result.temp_file_path == output_path
			assert Path(output_path).exists()
			assert Path(output_path).stat().st_size > 0
		finally:
			Path(output_path).unlink(missing_ok=True)
	
	async def test_render_from_structure(self, docx_renderer):
		"""Test rendering DOCX from document structure"""
		document_structure = {
			'title': 'Structured Document',
			'content': '<h1>Structure Test</h1><p>Content from structure.</p>',
			'sections': [{'name': 'Introduction', 'content': 'Intro content'}]
		}
		
		style_specifications = {
			'font-family': 'Arial',
			'font-size': '12pt'
		}
		
		result = await docx_renderer.render_from_structure(document_structure, style_specifications)
		
		assert result.render_successful is True
		assert len(result.docx_content) > 0
		assert result.word_count > 0
	
	async def test_batch_render_docx(self, docx_renderer):
		"""Test batch DOCX rendering"""
		documents = [
			FormattedDocumentContent(
				title=f"Document {i}",
				content_html=f"<h1>Document {i}</h1><p>Content for document {i}</p>"
			)
			for i in range(1, 4)
		]
		
		with tempfile.TemporaryDirectory() as temp_dir:
			results = await docx_renderer.batch_render_docx(
				documents,
				temp_dir,
				"test_{document_id}.docx"
			)
			
			assert len(results) == 3
			assert all(result.render_successful for result in results)
			assert all(result.file_size > 0 for result in results)
			
			# Check that files were created
			output_files = list(Path(temp_dir).glob("test_*.docx"))
			assert len(output_files) == 3
	
	async def test_render_with_custom_config(self, docx_renderer, sample_formatted_content):
		"""Test rendering with custom configuration"""
		custom_config = DOCXRenderConfiguration(
			page_size="Letter",
			page_orientation="landscape",
			default_font_family="Times New Roman",
			style_preservation=False
		)
		
		result = await docx_renderer.render_docx(
			sample_formatted_content,
			custom_config=custom_config
		)
		
		assert result.render_successful is True
		assert result.style_preservation_score > 0  # Still some preservation
	
	async def test_get_docx_renderer_metrics(self, docx_renderer, sample_formatted_content):
		"""Test DOCX renderer metrics collection"""
		# Render a document first to generate metrics
		await docx_renderer.render_docx(sample_formatted_content)
		
		metrics = await docx_renderer.get_docx_renderer_metrics()
		
		assert metrics['documents_rendered'] >= 1
		assert metrics['average_render_time'] >= 0
		assert metrics['average_file_size'] > 0
		assert metrics['compatibility_score_average'] > 0
		assert metrics['memory_usage'] > 0
		assert metrics['system_status'] == 'operational'
	
	async def test_render_with_styles_and_assets(self, docx_renderer):
		"""Test rendering with complex styles and assets"""
		content_with_assets = FormattedDocumentContent(
			title="Rich Document",
			content_html="""
			<div>
				<h1 style="color: #2c3e50; font-size: 24pt;">Rich Document</h1>
				<p style="font-family: Arial; font-size: 12pt;">Content with <strong>formatting</strong>.</p>
				<img src="chart.png" alt="Chart" width="300" height="200">
				<table>
					<tr><th>Column 1</th><th>Column 2</th></tr>
					<tr><td>Data A</td><td>Data B</td></tr>
				</table>
			</div>
			""",
			computed_styles={
				"h1": {"color": "#2c3e50", "font-size": "24pt", "font-weight": "bold"},
				"p": {"font-family": "Arial", "font-size": "12pt"},
				"table": {"border": "1px solid #000", "border-collapse": "collapse"}
			},
			image_assets={
				"chart.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
			}
		)
		
		result = await docx_renderer.render_docx(content_with_assets)
		
		assert result.render_successful is True
		assert result.styles_applied > 0
		assert result.images_embedded > 0
		assert len(result.embedded_images) > 0
		assert result.style_preservation_score > 0.8


# ============================================================================
# Error Handling Tests
# ============================================================================

class TestDOCXRendererErrorHandling:
	"""Test DOCXRenderer error handling and edge cases"""
	
	async def test_render_empty_content(self, docx_renderer):
		"""Test rendering with empty content"""
		empty_content = FormattedDocumentContent(
			title="",
			content_html="",
			content_text=""
		)
		
		result = await docx_renderer.render_docx(empty_content)
		
		# Should still succeed with minimal content
		assert result.render_successful is True
		assert len(result.docx_content) > 0
	
	async def test_render_with_invalid_html(self, docx_renderer):
		"""Test rendering with malformed HTML"""
		malformed_content = FormattedDocumentContent(
			title="Malformed Document",
			content_html="<h1>Unclosed heading<p>Malformed paragraph<div>Missing close tags"
		)
		
		result = await docx_renderer.render_docx(malformed_content)
		
		# Should handle gracefully
		assert result.render_successful is True
	
	async def test_render_with_missing_assets(self, docx_renderer):
		"""Test rendering with missing asset references"""
		content_with_missing_assets = FormattedDocumentContent(
			content_html='<img src="missing-image.jpg" alt="Missing">',
			image_assets={}  # No assets provided
		)
		
		result = await docx_renderer.render_docx(content_with_missing_assets)
		
		# Should render but may have warnings
		assert result.render_successful is True
		# Missing assets should be handled gracefully
	
	def test_invalid_configuration_handling(self):
		"""Test handling of invalid DOCX configurations"""
		# Test with invalid page size
		config = DOCXRenderConfiguration(page_size="InvalidSize")
		renderer = DOCXRenderer(render_config=config)
		
		# Should initialize without errors (validation happens during rendering)
		assert renderer.render_config.page_size == "InvalidSize"


# ============================================================================
# Performance Tests
# ============================================================================

class TestDOCXRendererPerformance:
	"""Test DOCXRenderer performance characteristics"""
	
	async def test_rendering_performance(self, docx_renderer):
		"""Test rendering performance with reasonable content"""
		large_content = FormattedDocumentContent(
			title="Performance Test Document",
			content_html="""
			<h1>Performance Test</h1>
			""" + "\n".join([f"<p>Paragraph {i} with test content for performance evaluation.</p>" for i in range(100)]),
			content_text="Performance Test\n\n" + "\n\n".join([f"Paragraph {i} with test content." for i in range(100)])
		)
		
		start_time = datetime.now()
		result = await docx_renderer.render_docx(large_content)
		end_time = datetime.now()
		
		assert result.render_successful is True
		assert result.rendering_time < 5.0  # Should render within 5 seconds
		assert (end_time - start_time).total_seconds() < 10.0  # Including overhead
	
	async def test_memory_usage_estimation(self, docx_renderer, sample_formatted_content):
		"""Test memory usage estimation"""
		# Render some documents to populate caches
		for i in range(5):
			await docx_renderer.render_docx(sample_formatted_content)
		
		initial_memory = docx_renderer._estimate_memory_usage()
		
		# Render more documents
		for i in range(5):
			await docx_renderer.render_docx(sample_formatted_content)
		
		final_memory = docx_renderer._estimate_memory_usage()
		
		assert initial_memory > 0
		assert final_memory >= initial_memory  # Should not decrease significantly
	
	async def test_concurrent_rendering(self, docx_renderer):
		"""Test concurrent DOCX rendering"""
		documents = [
			FormattedDocumentContent(
				title=f"Concurrent Doc {i}",
				content_html=f"<h1>Document {i}</h1><p>Content {i}</p>"
			)
			for i in range(5)
		]
		
		# Render documents concurrently
		tasks = [docx_renderer.render_docx(doc) for doc in documents]
		results = await asyncio.gather(*tasks)
		
		assert len(results) == 5
		assert all(result.render_successful for result in results)
		assert len(set(result.document_id for result in results)) == 5  # All unique


# ============================================================================
# Integration Tests
# ============================================================================

class TestDOCXRendererIntegration:
	"""Test DOCXRenderer integration scenarios"""
	
	async def test_end_to_end_docx_generation(self, sample_formatted_content):
		"""Test complete end-to-end DOCX generation workflow"""
		# Create custom configuration
		config = create_default_docx_configuration("A4", "high")
		config.document_metadata.title = "Integration Test Document"
		config.document_metadata.author = "Test Suite"
		
		# Create renderer with custom config
		renderer = DOCXRenderer(render_config=config)
		
		# Render DOCX
		result = await renderer.render_docx(sample_formatted_content)
		
		# Verify comprehensive results
		assert result.render_successful is True
		assert result.file_size > 0
		assert result.word_count > 0
		assert result.rendering_quality_score > 0.5
		assert result.style_preservation_score > 0.8
		assert result.compatibility_score > 0.8
		assert result.processing_efficiency > 0.0
	
	async def test_word_compatibility_workflow(self, sample_formatted_content):
		"""Test Word version compatibility validation workflow"""
		config = DOCXRenderConfiguration(
			word_version_compatibility="2016",
			compatibility_mode=True,
			style_preservation=True,
			font_embedding=True
		)
		
		renderer = DOCXRenderer(render_config=config)
		result = await renderer.render_docx(sample_formatted_content)
		
		assert result.render_successful is True
		assert result.word_compatibility is True
		assert result.compatibility_score > 0.9
	
	async def test_business_document_workflow(self, sample_formatted_content):
		"""Test business document production workflow"""
		config = DOCXRenderConfiguration(
			document_metadata=DOCXMetadata(
				title="Business Report",
				author="Business User",
				company="Test Corp",
				document_version="1.0",
				content_status="Final"
			),
			style_preservation=True,
			table_styles=True,
			header_footer_enabled=True,
			track_changes=False
		)
		
		renderer = DOCXRenderer(render_config=config)
		result = await renderer.render_docx(sample_formatted_content)
		
		assert result.render_successful is True
		assert result.style_preservation_score > 0.9
		assert result.word_compatibility is True
	
	async def test_multi_format_asset_handling(self):
		"""Test handling of multiple asset formats"""
		content_with_assets = FormattedDocumentContent(
			title="Multi-Asset Document",
			content_html="""
			<div>
				<img src="logo.svg" alt="SVG Logo">
				<img src="photo.jpg" alt="JPEG Photo">
				<img src="icon.png" alt="PNG Icon">
				<table>
					<tr><th>Name</th><th>Value</th></tr>
					<tr><td>Item 1</td><td>100</td></tr>
					<tr><td>Item 2</td><td>200</td></tr>
				</table>
			</div>
			""",
			image_assets={
				"logo.svg": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDAiIGZpbGw9IiNmZjAwMDAiLz48L3N2Zz4=",
				"photo.jpg": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/iKCiA=",
				"icon.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
			}
		)
		
		renderer = DOCXRenderer()
		result = await renderer.render_docx(content_with_assets)
		
		assert result.render_successful is True
		assert result.images_embedded > 0
		assert len(result.embedded_images) > 0


# ============================================================================
# Utility Function Tests
# ============================================================================

class TestUtilityFunctions:
	"""Test DOCXRenderer utility functions"""
	
	def test_create_default_docx_configuration(self):
		"""Test default DOCX configuration creation"""
		high_config = create_default_docx_configuration("A4", "high")
		draft_config = create_default_docx_configuration("Letter", "draft")
		
		assert high_config.page_size == "A4"
		assert high_config.image_quality == "high"
		assert high_config.font_embedding is True
		assert high_config.style_preservation is True
		
		assert draft_config.page_size == "Letter"
		assert draft_config.image_quality == "medium"
		assert draft_config.font_embedding is False
		assert draft_config.file_size_optimization is True
	
	async def test_quick_docx_render(self):
		"""Test quick DOCX rendering utility"""
		content = "<h1>Quick Test</h1><p>Quick rendering test content.</p>"
		title = "Quick Document"
		
		result = await quick_docx_render(content, title)
		
		assert result.render_successful is True
		assert len(result.docx_content) > 0
	
	async def test_quick_docx_render_plain_text(self):
		"""Test quick DOCX rendering with plain text"""
		content = "This is plain text content for quick rendering."
		title = "Plain Text Document"
		
		result = await quick_docx_render(content, title)
		
		assert result.render_successful is True
		assert len(result.docx_content) > 0
	
	def test_validate_docx_renderer_installation(self):
		"""Test DOCX renderer installation validation"""
		validation_results = validate_docx_renderer_installation()
		
		assert "python_docx_available" in validation_results
		assert "docx_renderer_core" in validation_results
		assert "style_translator" in validation_results
		assert "asset_embedder" in validation_results
		assert "quality_validator" in validation_results
		assert "document_builder" in validation_results
		assert "overall_status" in validation_results
		
		# Core components should always be available
		assert validation_results["docx_renderer_core"] is True
		assert validation_results["document_builder"] is True
		assert validation_results["style_translator"] is True
		assert validation_results["asset_embedder"] is True
		assert validation_results["quality_validator"] is True


# ============================================================================
# Exception Tests
# ============================================================================

class TestDOCXRendererExceptions:
	"""Test DOCXRenderer exception handling"""
	
	def test_exception_hierarchy(self):
		"""Test exception class hierarchy"""
		assert issubclass(DOCXRenderingException, DOCXRendererException)
		assert issubclass(DOCXCompatibilityException, DOCXRendererException)
		assert issubclass(DOCXStyleException, DOCXRendererException)
		assert issubclass(DOCXAssetException, DOCXRendererException)
	
	def test_exception_instantiation(self):
		"""Test exception instantiation"""
		base_exc = DOCXRendererException("Base error")
		render_exc = DOCXRenderingException("Rendering error")
		compat_exc = DOCXCompatibilityException("Compatibility error")
		style_exc = DOCXStyleException("Style error")
		asset_exc = DOCXAssetException("Asset error")
		
		assert str(base_exc) == "Base error"
		assert str(render_exc) == "Rendering error"
		assert str(compat_exc) == "Compatibility error"
		assert str(style_exc) == "Style error"
		assert str(asset_exc) == "Asset error"