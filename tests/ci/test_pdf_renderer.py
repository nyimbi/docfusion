#!/usr/bin/env python3
"""
PDFRenderer Module Tests

Comprehensive test suite for the PDFRenderer module covering:
- High-quality PDF generation from HTML/CSS and formatted content
- WeasyPrint integration and fallback mechanisms
- Font embedding and asset optimization
- Quality validation and compliance checking
- Performance optimization and caching
- Batch processing and enterprise features
"""

import asyncio
import pytest
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

from docfusion.document_engine.renderer.pdf_renderer import (
	PDFRenderer,
	LaTeXCompiler,
	HTMLCSSGenerator,
	FontManager,
	PDFQualityValidator,
	PDFRenderConfiguration,
	PDFRenderResult,
	FormattedDocumentContent,
	PageMargins,
	PDFMetadata,
	PDFPermissions,
	create_default_pdf_configuration,
	quick_pdf_render,
	quick_pdf_render_latex,
	validate_pdf_renderer_installation,
	PDFRendererException,
	PDFRenderingException,
	PDFQualityException,
	FontEmbeddingException,
	PDFAccessibilityException
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
def sample_pdf_metadata():
	"""Create sample PDF metadata for testing"""
	return PDFMetadata(
		title="Test Document",
		author="Test Author",
		subject="PDF Rendering Test",
		keywords=["test", "pdf", "rendering"],
		document_type="report",
		language="en-US"
	)


@pytest.fixture
def sample_pdf_permissions():
	"""Create sample PDF permissions for testing"""
	return PDFPermissions(
		allow_printing=True,
		allow_copying=True,
		allow_editing=False,
		allow_annotations=True,
		allow_form_filling=True
	)


@pytest.fixture
def sample_render_config(sample_page_margins, sample_pdf_metadata, sample_pdf_permissions):
	"""Create sample PDF render configuration for testing"""
	return PDFRenderConfiguration(
		page_size="A4",
		page_orientation="portrait",
		page_margins=sample_page_margins,
		dpi=300,
		font_embedding=True,
		accessibility_compliance=True,
		document_metadata=sample_pdf_metadata,
		user_permissions=sample_pdf_permissions
	)


@pytest.fixture
def sample_formatted_content():
	"""Create sample formatted document content for testing"""
	return FormattedDocumentContent(
		title="Sample Document",
		# Primary LaTeX content
		content_latex="""
\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\title{Sample Document Title}
\\author{Test Author}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introduction}
This is a sample paragraph with \\textbf{bold text} and \\textit{italic text}.

\\section{Section Heading}
Another paragraph with some content for testing PDF rendering capabilities.

\\begin{itemize}
\\item List item one
\\item List item two  
\\item List item three
\\end{itemize}

\\end{document}
		""",
		# Fallback HTML content
		content_html="""
		<section class="document-content">
			<h1>Sample Document Title</h1>
			<p>This is a sample paragraph with <strong>bold text</strong> and <em>italic text</em>.</p>
			<h2>Section Heading</h2>
			<p>Another paragraph with some content for testing PDF rendering capabilities.</p>
			<ul>
				<li>List item one</li>
				<li>List item two</li>
				<li>List item three</li>
			</ul>
		</section>
		""",
		content_css="""
		body { font-family: 'Arial', sans-serif; }
		h1 { color: #2c3e50; }
		h2 { color: #34495e; }
		p { line-height: 1.6; }
		""",
		metadata={"category": "test", "priority": "high"}
	)


@pytest.fixture
def sample_latex_content():
	"""Create sample LaTeX content for testing"""
	return FormattedDocumentContent(
		title="LaTeX Test Document",
		content_latex="""
\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\title{LaTeX PDF Test}
\\begin{document}
\\maketitle
\\section{Test Section}
This is a LaTeX test document.
\\end{document}
		"""
	)


@pytest.fixture
def sample_html_content():
	"""Create sample HTML-only content for testing fallback"""
	return FormattedDocumentContent(
		title="HTML Test Document",
		content_html="<h1>HTML Test</h1><p>HTML fallback test.</p>",
		content_css="h1 { color: blue; }"
	)


@pytest.fixture
def html_css_generator():
	"""Create HTMLCSSGenerator instance for testing"""
	return HTMLCSSGenerator()


@pytest.fixture
def font_manager():
	"""Create FontManager instance for testing"""
	return FontManager()


@pytest.fixture
def pdf_quality_validator():
	"""Create PDFQualityValidator instance for testing"""
	return PDFQualityValidator()


@pytest.fixture
def latex_compiler():
	"""Create LaTeXCompiler instance for testing"""
	return LaTeXCompiler()


@pytest.fixture
def pdf_renderer(sample_render_config, pdf_quality_validator, font_manager, latex_compiler):
	"""Create PDFRenderer instance for testing"""
	return PDFRenderer(
		render_config=sample_render_config,
		quality_validator=pdf_quality_validator,
		font_manager=font_manager,
		latex_compiler=latex_compiler
	)


# ============================================================================
# LaTeXCompiler Tests
# ============================================================================

class TestLaTeXCompiler:
	"""Test LaTeXCompiler functionality"""
	
	def test_latex_compiler_initialization(self, latex_compiler):
		"""Test LaTeXCompiler initialization"""
		assert latex_compiler.latex_cache == {}
		assert latex_compiler.compile_timeout == 30
	
	async def test_compile_latex_to_pdf_success(self, latex_compiler):
		"""Test successful LaTeX compilation"""
		latex_content = """
\\documentclass{article}
\\begin{document}
Hello LaTeX!
\\end{document}
		"""
		
		pdf_content = await latex_compiler.compile_latex_to_pdf(latex_content)
		
		assert len(pdf_content) > 0
		assert pdf_content.startswith(b"%PDF-1.7")
		# Check for standard PDF structure elements instead of literal text
		assert b"%%EOF" in pdf_content
	
	async def test_compile_latex_with_assets(self, latex_compiler):
		"""Test LaTeX compilation with assets"""
		latex_content = """
\\documentclass{article}
\\begin{document}
\\includegraphics{test.png}
\\end{document}
		"""
		assets = {
			"test.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77mgAAAABJRU5ErkJggg=="
		}
		
		pdf_content = await latex_compiler.compile_latex_to_pdf(latex_content, assets)
		
		assert len(pdf_content) > 0
		assert pdf_content.startswith(b"%PDF-1.7")
	
	def test_validate_latex_syntax_valid(self, latex_compiler):
		"""Test LaTeX syntax validation with valid content"""
		valid_latex = """
\\documentclass{article}
\\begin{document}
Valid LaTeX content.
\\end{document}
		"""
		
		issues = latex_compiler.validate_latex_syntax(valid_latex)
		assert len(issues) == 0
	
	def test_validate_latex_syntax_invalid(self, latex_compiler):
		"""Test LaTeX syntax validation with invalid content"""
		invalid_latex = """
\\documentclass{article}
\\begin{document}
Missing end document and unbalanced {
		"""
		
		issues = latex_compiler.validate_latex_syntax(invalid_latex)
		assert len(issues) > 0
		assert any("Missing \\end{document}" in issue for issue in issues)
		assert any("Unbalanced braces" in issue for issue in issues)
	
	def test_validate_latex_syntax_missing_documentclass(self, latex_compiler):
		"""Test LaTeX syntax validation missing documentclass"""
		incomplete_latex = """
\\begin{document}
Content without documentclass.
\\end{document}
		"""
		
		issues = latex_compiler.validate_latex_syntax(incomplete_latex)
		assert len(issues) > 0
		assert any("Missing \\documentclass" in issue for issue in issues)


# ============================================================================
# HTMLCSSGenerator Tests
# ============================================================================

class TestHTMLCSSGenerator:
	"""Test HTMLCSSGenerator functionality"""
	
	async def test_html_css_generator_initialization(self, html_css_generator):
		"""Test HTMLCSSGenerator initialization"""
		assert html_css_generator.html_template is not None
		assert html_css_generator.css_base is not None
		assert "{title}" in html_css_generator.html_template
		assert "body" in html_css_generator.css_base
	
	async def test_generate_html_content(self, html_css_generator, sample_formatted_content, sample_render_config):
		"""Test HTML content generation"""
		html_content = await html_css_generator.generate_html_content(
			sample_formatted_content,
			sample_render_config
		)
		
		assert "Sample Document" in html_content
		assert "<!DOCTYPE html>" in html_content
		assert 'lang="en-US"' in html_content
		assert "Sample Document Title" in html_content
		assert "role=\"main\"" in html_content
	
	async def test_generate_css_content(self, html_css_generator, sample_formatted_content, sample_render_config):
		"""Test CSS content generation"""
		css_content = await html_css_generator.generate_css_content(
			sample_formatted_content,
			sample_render_config
		)
		
		assert "@page" in css_content
		assert "size: A4 portrait" in css_content
		assert "margin-top: 2.54cm" in css_content
		assert "font-family" in css_content
		assert "page-break" in css_content
	
	async def test_generate_html_with_assets(self, html_css_generator, sample_render_config):
		"""Test HTML generation with asset embedding"""
		content_with_assets = FormattedDocumentContent(
			title="Document with Assets",
			content_html='<img src="logo.png" alt="Logo">',
			html_assets={"logo.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="}
		)
		
		html_content = await html_css_generator.generate_html_content(
			content_with_assets,
			sample_render_config
		)
		
		assert "data:image/png;base64," in html_content
		assert "logo.png" not in html_content  # Should be replaced with data URL
	
	def test_mime_type_guessing(self, html_css_generator):
		"""Test MIME type guessing from file extensions"""
		assert html_css_generator._guess_mime_type("image.png") == "image/png"
		assert html_css_generator._guess_mime_type("document.pdf") == "application/pdf"
		assert html_css_generator._guess_mime_type("graphic.svg") == "image/svg+xml"
		assert html_css_generator._guess_mime_type("photo.jpg") == "image/jpeg"


# ============================================================================
# FontManager Tests
# ============================================================================

class TestFontManager:
	"""Test FontManager functionality"""
	
	def test_font_manager_initialization(self, font_manager):
		"""Test FontManager initialization"""
		assert font_manager.font_cache == {}
		assert hasattr(font_manager, 'font_config')
	
	async def test_load_fonts_success(self, font_manager):
		"""Test successful font loading"""
		font_specs = ["Arial", "Times New Roman", "Helvetica"]
		font_results = await font_manager.load_fonts(font_specs)
		
		assert len(font_results) == 3
		assert all(font_results.values())
		assert "Arial" in font_manager.font_cache
		assert font_manager.font_cache["Arial"]["loaded"] is True
	
	async def test_load_fonts_with_invalid_font(self, font_manager):
		"""Test font loading with invalid font names"""
		font_specs = ["NonExistentFont", "Arial"]
		font_results = await font_manager.load_fonts(font_specs)
		
		# All fonts should be marked as loaded in our mock implementation
		assert len(font_results) == 2
		assert font_results["Arial"] is True
	
	def test_validate_font_availability(self, font_manager):
		"""Test font availability validation"""
		required_fonts = ["Arial", "Times New Roman", "CustomFont"]
		availability = font_manager.validate_font_availability(required_fonts)
		
		assert availability["Arial"] is True
		assert availability["Times New Roman"] is True
		assert len(availability) == 3


# ============================================================================
# PDFQualityValidator Tests
# ============================================================================

class TestPDFQualityValidator:
	"""Test PDFQualityValidator functionality"""
	
	def test_quality_validator_initialization(self, pdf_quality_validator):
		"""Test PDFQualityValidator initialization"""
		assert pdf_quality_validator.validation_rules is not None
		assert "max_file_size" in pdf_quality_validator.validation_rules
		assert "min_resolution" in pdf_quality_validator.validation_rules
	
	async def test_validate_pdf_quality_success(self, pdf_quality_validator, sample_render_config):
		"""Test successful PDF quality validation"""
		mock_pdf_content = b"%PDF-1.7\nMock PDF content\n%%EOF"
		
		quality_report = await pdf_quality_validator.validate_pdf_quality(
			mock_pdf_content,
			sample_render_config
		)
		
		assert quality_report["overall_quality_score"] > 0.0
		assert quality_report["print_ready"] is True
		assert quality_report["file_size_optimized"] is True
		assert "validation_issues" in quality_report
	
	async def test_validate_pdf_quality_with_accessibility(self, pdf_quality_validator):
		"""Test PDF quality validation with accessibility requirements"""
		config = PDFRenderConfiguration(accessibility_compliance=True)
		mock_pdf_content = b"%PDF-1.7\nAccessible PDF content\n%%EOF"
		
		quality_report = await pdf_quality_validator.validate_pdf_quality(
			mock_pdf_content,
			config
		)
		
		assert quality_report["accessibility_compliant"] is True
	
	async def test_validate_empty_pdf(self, pdf_quality_validator, sample_render_config):
		"""Test validation of empty PDF content"""
		empty_pdf = b""
		
		quality_report = await pdf_quality_validator.validate_pdf_quality(
			empty_pdf,
			sample_render_config
		)
		
		assert quality_report["overall_quality_score"] == 0.0
		assert quality_report["print_ready"] is False


# ============================================================================
# PDFRenderer Core Tests
# ============================================================================

class TestPDFRenderer:
	"""Test PDFRenderer core functionality"""
	
	def test_pdf_renderer_initialization(self, pdf_renderer):
		"""Test PDFRenderer initialization"""
		assert pdf_renderer.render_config is not None
		assert pdf_renderer.quality_validator is not None
		assert pdf_renderer.font_manager is not None
		assert pdf_renderer.html_css_generator is not None
		assert pdf_renderer.metrics["documents_rendered"] == 0
	
	async def test_render_pdf_success(self, pdf_renderer, sample_formatted_content):
		"""Test successful PDF rendering"""
		result = await pdf_renderer.render_pdf(sample_formatted_content)
		
		assert result.render_successful is True
		assert result.document_id == sample_formatted_content.document_id
		assert len(result.pdf_content) > 0
		assert result.file_size > 0
		assert result.page_count >= 1
		assert result.rendering_time > 0
		assert result.rendering_quality_score > 0
	
	async def test_render_pdf_with_output_path(self, pdf_renderer, sample_formatted_content):
		"""Test PDF rendering with file output"""
		with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
			output_path = temp_file.name
		
		try:
			result = await pdf_renderer.render_pdf(sample_formatted_content, output_path)
			
			assert result.render_successful is True
			assert result.temp_file_path == output_path
			assert Path(output_path).exists()
			assert Path(output_path).stat().st_size > 0
		finally:
			Path(output_path).unlink(missing_ok=True)
	
	async def test_render_from_latex(self, pdf_renderer):
		"""Test rendering PDF directly from LaTeX (primary method)"""
		latex_content = """
\\documentclass{article}
\\begin{document}
\\title{Test Document}
\\maketitle
\\section{Introduction}
This is a test paragraph.
\\end{document}
		"""
		
		result = await pdf_renderer.render_from_latex(latex_content)
		
		assert result.render_successful is True
		assert len(result.pdf_content) > 0
		assert result.file_size > 0
		assert result.output_metadata.creation_method == "latex"
	
	async def test_render_from_html_css(self, pdf_renderer):
		"""Test rendering PDF directly from HTML and CSS (fallback method)"""
		html_content = """
		<html>
		<body>
			<h1>Test Document</h1>
			<p>This is a test paragraph.</p>
		</body>
		</html>
		"""
		css_content = """
		body { font-family: Arial, sans-serif; }
		h1 { color: #333; }
		"""
		
		result = await pdf_renderer.render_from_html_css(html_content, css_content)
		
		assert result.render_successful is True
		assert len(result.pdf_content) > 0
		assert result.file_size > 0
		assert result.output_metadata.creation_method == "weasyprint"
	
	async def test_batch_render_pdfs(self, pdf_renderer):
		"""Test batch PDF rendering"""
		documents = [
			FormattedDocumentContent(
				title=f"Document {i}",
				content_html=f"<h1>Document {i}</h1><p>Content for document {i}</p>"
			)
			for i in range(1, 4)
		]
		
		with tempfile.TemporaryDirectory() as temp_dir:
			results = await pdf_renderer.batch_render_pdfs(
				documents,
				temp_dir,
				"test_{document_id}.pdf"
			)
			
			assert len(results) == 3
			assert all(result.render_successful for result in results)
			assert all(result.file_size > 0 for result in results)
			
			# Check that files were created
			output_files = list(Path(temp_dir).glob("test_*.pdf"))
			assert len(output_files) == 3
	
	async def test_render_with_custom_config(self, pdf_renderer, sample_formatted_content):
		"""Test rendering with custom configuration"""
		custom_config = PDFRenderConfiguration(
			page_size="Letter",
			page_orientation="landscape",
			dpi=150,
			accessibility_compliance=False
		)
		
		result = await pdf_renderer.render_pdf(
			sample_formatted_content,
			custom_config=custom_config
		)
		
		assert result.render_successful is True
		assert result.accessibility_compliant is False
	
	async def test_get_pdf_renderer_metrics(self, pdf_renderer, sample_formatted_content):
		"""Test PDF renderer metrics collection"""
		# Render a document first to generate metrics
		await pdf_renderer.render_pdf(sample_formatted_content)
		
		metrics = await pdf_renderer.get_pdf_renderer_metrics()
		
		assert metrics["documents_rendered"] >= 1
		assert metrics["average_render_time"] >= 0
		assert metrics["average_file_size"] > 0
		assert metrics["quality_score_average"] >= 0
		assert metrics["memory_usage"] > 0
		assert metrics["system_status"] == "operational"
	
	def test_estimate_page_count(self, pdf_renderer):
		"""Test page count estimation"""
		small_pdf = b"%PDF-1.7\nSmall content\n%%EOF"
		large_pdf = b"%PDF-1.7\n" + b"Large content " * 10000 + b"\n%%EOF"
		
		small_count = pdf_renderer._estimate_page_count(small_pdf)
		large_count = pdf_renderer._estimate_page_count(large_pdf)
		
		assert small_count >= 1
		assert large_count > small_count
	
	def test_calculate_processing_efficiency(self, pdf_renderer):
		"""Test processing efficiency calculation"""
		result = PDFRenderResult(
			render_successful=True,
			rendering_time=1.5,
			file_size=1024 * 1024,  # 1MB
			rendering_quality_score=0.9
		)
		
		efficiency = pdf_renderer._calculate_processing_efficiency(result)
		
		assert 0.0 <= efficiency <= 1.0
		assert efficiency > 0  # Should be positive for successful render


# ============================================================================
# Error Handling Tests
# ============================================================================

class TestPDFRendererErrorHandling:
	"""Test PDFRenderer error handling and edge cases"""
	
	async def test_render_empty_content(self, pdf_renderer):
		"""Test rendering with empty content"""
		empty_content = FormattedDocumentContent(
			title="",
			content_html="",
			content_css=""
		)
		
		result = await pdf_renderer.render_pdf(empty_content)
		
		# Should still succeed with default content generation
		assert result.render_successful is True
		assert len(result.pdf_content) > 0
	
	async def test_render_malformed_html(self, pdf_renderer):
		"""Test rendering with malformed HTML"""
		malformed_content = FormattedDocumentContent(
			content_html="<h1>Unclosed heading<p>Malformed paragraph",
			content_css="body { font-family: Arial; }"
		)
		
		result = await pdf_renderer.render_pdf(malformed_content)
		
		# Should handle gracefully
		assert result.render_successful is True
	
	async def test_render_with_invalid_css(self, pdf_renderer):
		"""Test rendering with invalid CSS"""
		invalid_css_content = FormattedDocumentContent(
			content_html="<h1>Test</h1>",
			content_css="body { invalid-property: invalid-value; color: #invalid; }"
		)
		
		result = await pdf_renderer.render_pdf(invalid_css_content)
		
		# Should handle gracefully and still render
		assert result.render_successful is True
	
	async def test_render_with_missing_assets(self, pdf_renderer):
		"""Test rendering with missing asset references"""
		content_with_missing_assets = FormattedDocumentContent(
			content_html='<img src="missing-image.jpg" alt="Missing">',
			assets_map={}  # No assets provided
		)
		
		result = await pdf_renderer.render_pdf(content_with_missing_assets)
		
		# Should render but may have warnings
		assert result.render_successful is True
		# Missing assets should be handled gracefully
	
	def test_invalid_configuration_handling(self):
		"""Test handling of invalid PDF configurations"""
		# Test with invalid page size
		config = PDFRenderConfiguration(page_size="InvalidSize")
		renderer = PDFRenderer(render_config=config)
		
		# Should initialize without errors (validation happens during rendering)
		assert renderer.render_config.page_size == "InvalidSize"


# ============================================================================
# Performance Tests
# ============================================================================

class TestPDFRendererPerformance:
	"""Test PDFRenderer performance characteristics"""
	
	async def test_rendering_performance(self, pdf_renderer):
		"""Test rendering performance with reasonable content"""
		large_content = FormattedDocumentContent(
			title="Performance Test Document",
			content_html="""
			<h1>Performance Test</h1>
			""" + "\n".join([f"<p>Paragraph {i} with some test content for performance evaluation.</p>" for i in range(100)]),
			content_css="body { font-family: Arial, sans-serif; } p { margin: 10px 0; }"
		)
		
		start_time = datetime.now()
		result = await pdf_renderer.render_pdf(large_content)
		end_time = datetime.now()
		
		assert result.render_successful is True
		assert result.rendering_time < 10.0  # Should render within 10 seconds
		assert (end_time - start_time).total_seconds() < 15.0  # Including overhead
	
	async def test_memory_usage_estimation(self, pdf_renderer, sample_formatted_content):
		"""Test memory usage estimation"""
		# Render some documents to populate caches
		for i in range(5):
			await pdf_renderer.render_pdf(sample_formatted_content)
		
		initial_memory = pdf_renderer._estimate_memory_usage()
		
		# Load some fonts
		await pdf_renderer.font_manager.load_fonts(["Arial", "Times New Roman"])
		
		final_memory = pdf_renderer._estimate_memory_usage()
		
		assert initial_memory > 0
		assert final_memory >= initial_memory  # Should increase with more data
	
	async def test_concurrent_rendering(self, pdf_renderer):
		"""Test concurrent PDF rendering"""
		documents = [
			FormattedDocumentContent(
				title=f"Concurrent Doc {i}",
				content_html=f"<h1>Document {i}</h1><p>Content {i}</p>"
			)
			for i in range(5)
		]
		
		# Render documents concurrently
		tasks = [pdf_renderer.render_pdf(doc) for doc in documents]
		results = await asyncio.gather(*tasks)
		
		assert len(results) == 5
		assert all(result.render_successful for result in results)
		assert len(set(result.document_id for result in results)) == 5  # All unique


# ============================================================================
# Integration Tests
# ============================================================================

class TestPDFRendererIntegration:
	"""Test PDFRenderer integration scenarios"""
	
	async def test_end_to_end_pdf_generation(self, sample_formatted_content):
		"""Test complete end-to-end PDF generation workflow"""
		# Create custom configuration
		config = create_default_pdf_configuration("A4", "high")
		config.document_metadata.title = "Integration Test Document"
		config.document_metadata.author = "Test Suite"
		
		# Create renderer with custom config
		renderer = PDFRenderer(render_config=config)
		
		# Render PDF
		result = await renderer.render_pdf(sample_formatted_content)
		
		# Verify comprehensive results
		assert result.render_successful is True
		assert result.file_size > 0
		assert result.page_count >= 1
		assert result.rendering_quality_score > 0.5
		assert result.font_embedding_success is True
		assert result.image_optimization_success is True
		assert result.processing_efficiency > 0.0
	
	async def test_accessibility_compliance_workflow(self, sample_formatted_content):
		"""Test accessibility compliance validation workflow"""
		config = PDFRenderConfiguration(
			accessibility_compliance=True,
			pdf_ua_compliance=True,
			tagged_pdf=True,
			screen_reader_optimization=True
		)
		
		renderer = PDFRenderer(render_config=config)
		result = await renderer.render_pdf(sample_formatted_content)
		
		assert result.render_successful is True
		assert result.accessibility_compliant is True
	
	async def test_print_production_workflow(self, sample_formatted_content):
		"""Test print production quality workflow"""
		config = PDFRenderConfiguration(
			dpi=300,
			image_resolution=300,
			vector_quality="high",
			color_management=True,
			print_color_optimization=True
		)
		
		renderer = PDFRenderer(render_config=config)
		result = await renderer.render_pdf(sample_formatted_content)
		
		assert result.render_successful is True
		assert result.print_ready is True
		assert result.rendering_quality_score > 0.8
	
	async def test_multi_format_asset_handling(self):
		"""Test handling of multiple asset formats"""
		content_with_assets = FormattedDocumentContent(
			title="Multi-Asset Document",
			content_html="""
			<div>
				<img src="logo.svg" alt="SVG Logo">
				<img src="photo.jpg" alt="JPEG Photo">
				<img src="icon.png" alt="PNG Icon">
			</div>
			""",
			html_assets={
				"logo.svg": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDAiIGZpbGw9IiNmZjAwMDAiLz48L3N2Zz4=",
				"photo.jpg": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/iKCiA==",
				"icon.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
			}
		)
		
		renderer = PDFRenderer()
		result = await renderer.render_pdf(content_with_assets)
		
		assert result.render_successful is True
		assert len(result.embedded_assets) > 0


# ============================================================================
# Utility Function Tests
# ============================================================================

class TestUtilityFunctions:
	"""Test PDFRenderer utility functions"""
	
	def test_create_default_pdf_configuration(self):
		"""Test default PDF configuration creation"""
		high_config = create_default_pdf_configuration("A4", "high")
		draft_config = create_default_pdf_configuration("Letter", "draft")
		
		assert high_config.page_size == "A4"
		assert high_config.dpi == 300
		assert high_config.accessibility_compliance is True
		
		assert draft_config.page_size == "Letter"
		assert draft_config.dpi == 150
		assert draft_config.accessibility_compliance is False
	
	async def test_quick_pdf_render_latex(self):
		"""Test quick PDF rendering from LaTeX"""
		latex_content = """
\\documentclass{article}
\\begin{document}
\\title{Quick LaTeX Test}
\\maketitle
Quick LaTeX rendering test.
\\end{document}
		"""
		
		result = await quick_pdf_render_latex(latex_content)
		
		assert result.render_successful is True
		assert len(result.pdf_content) > 0
	
	async def test_quick_pdf_render(self):
		"""Test quick PDF rendering utility"""
		html_content = "<h1>Quick Test</h1><p>Quick rendering test content.</p>"
		css_content = "h1 { color: blue; }"
		
		result = await quick_pdf_render(html_content, css_content)
		
		assert result.render_successful is True
		assert len(result.pdf_content) > 0
	
	async def test_quick_pdf_render_html_only(self):
		"""Test quick PDF rendering with HTML only"""
		html_content = "<h1>HTML Only Test</h1>"
		
		result = await quick_pdf_render(html_content)
		
		assert result.render_successful is True
		assert len(result.pdf_content) > 0
	
	def test_validate_pdf_renderer_installation(self):
		"""Test PDF renderer installation validation"""
		validation_results = validate_pdf_renderer_installation()
		
		assert "pdflatex_available" in validation_results
		assert "weasyprint_available" in validation_results
		assert "latex_compiler" in validation_results
		assert "pdf_renderer_core" in validation_results
		assert "html_css_generator" in validation_results
		assert "font_manager" in validation_results
		assert "quality_validator" in validation_results
		assert "overall_status" in validation_results
		
		# Core components should always be available
		assert validation_results["pdf_renderer_core"] is True
		assert validation_results["latex_compiler"] is True
		assert validation_results["html_css_generator"] is True
		assert validation_results["font_manager"] is True
		assert validation_results["quality_validator"] is True


# ============================================================================
# Exception Tests
# ============================================================================

class TestPDFRendererExceptions:
	"""Test PDFRenderer exception handling"""
	
	def test_exception_hierarchy(self):
		"""Test exception class hierarchy"""
		assert issubclass(PDFRenderingException, PDFRendererException)
		assert issubclass(PDFQualityException, PDFRendererException)
		assert issubclass(FontEmbeddingException, PDFRendererException)
		assert issubclass(PDFAccessibilityException, PDFRendererException)
	
	def test_exception_instantiation(self):
		"""Test exception instantiation"""
		base_exc = PDFRendererException("Base error")
		render_exc = PDFRenderingException("Rendering error")
		quality_exc = PDFQualityException("Quality error")
		font_exc = FontEmbeddingException("Font error")
		access_exc = PDFAccessibilityException("Accessibility error")
		
		assert str(base_exc) == "Base error"
		assert str(render_exc) == "Rendering error"
		assert str(quality_exc) == "Quality error"
		assert str(font_exc) == "Font error"
		assert str(access_exc) == "Accessibility error"