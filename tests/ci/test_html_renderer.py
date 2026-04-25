#!/usr/bin/env python3
"""
HTMLRenderer Module Tests

Comprehensive test suite for the HTMLRenderer module covering:
- Professional HTML5 generation with semantic markup
- Responsive design with mobile-first approach
- WCAG 2.1 accessibility compliance and validation
- Performance optimization and critical CSS
- Cross-browser compatibility and progressive enhancement
- SEO optimization and structured data
"""

import asyncio
import pytest
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

from docfusion.document_engine.renderer.html_renderer import (
	HTMLRenderer,
	SemanticHTMLBuilder,
	ResponsiveCSSGenerator,
	HTMLAccessibilityValidator,
	HTMLRenderConfiguration,
	HTMLRenderResult,
	FormattedDocumentContent,
	HTMLMetadata,
	create_default_html_configuration,
	quick_html_render,
	validate_html_renderer_installation,
	HTMLRendererException,
	HTMLRenderingException,
	HTMLValidationException,
	HTMLAccessibilityException,
	HTMLPerformanceException
)


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def sample_html_metadata():
	"""Create sample HTML metadata for testing"""
	return HTMLMetadata(
		title="Test HTML Document",
		description="HTML rendering test document with semantic markup",
		keywords=["test", "html", "rendering", "accessibility"],
		author="Test Author",
		language="en",
		og_title="Test HTML Document",
		og_description="HTML rendering test",
		og_type="article",
		schema_type="Article"
	)


@pytest.fixture
def sample_render_config(sample_html_metadata):
	"""Create sample HTML render configuration for testing"""
	return HTMLRenderConfiguration(
		document_type="html5",
		semantic_markup=True,
		accessibility_compliance=True,
		responsive_design=True,
		mobile_first=True,
		css_optimization=True,
		javascript_enabled=True,
		wcag_compliance_level="AA",
		document_metadata=sample_html_metadata,
		open_graph_tags=True,
		schema_org_markup=True
	)


@pytest.fixture
def sample_formatted_content():
	"""Create sample formatted document content for testing"""
	return FormattedDocumentContent(
		title="Sample HTML Document",
		content_html="""
		<section class="document-content">
			<h1>Sample Document Title</h1>
			<p>This is a sample paragraph with <strong>bold text</strong> and <em>italic text</em>.</p>
			<h2>Section Heading</h2>
			<p>Another paragraph with content for testing HTML rendering capabilities.</p>
			<ul>
				<li>List item one</li>
				<li>List item two</li>
				<li>List item three</li>
			</ul>
			<table>
				<caption>Sample Data Table</caption>
				<thead>
					<tr><th scope="col">Header 1</th><th scope="col">Header 2</th></tr>
				</thead>
				<tbody>
					<tr><td>Data 1</td><td>Data 2</td></tr>
					<tr><td>Data 3</td><td>Data 4</td></tr>
				</tbody>
			</table>
		</section>
		""",
		content_text="Sample Document Title\n\nThis is a sample paragraph with bold text and italic text.\n\nSection Heading\n\nAnother paragraph with content for testing HTML rendering capabilities.\n\n• List item one\n• List item two\n• List item three",
		computed_styles={
			"h1": {"font-size": "2.5rem", "font-weight": "700", "color": "#2c3e50"},
			"h2": {"font-size": "2rem", "font-weight": "600", "color": "#34495e"},
			"p": {"font-size": "1rem", "line-height": "1.6"},
			"strong": {"font-weight": "700"},
			"em": {"font-style": "italic"}
		},
		image_assets={
			"logo.svg": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDAiIGZpbGw9IiNmZjAwMDAiLz48L3N2Zz4=",
			"chart.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
		},
		sections=[
			{"title": "Introduction", "content": "Introduction content"},
			{"title": "Analysis", "content": "Analysis content"},
			{"title": "Conclusion", "content": "Conclusion content"}
		],
		metadata={"category": "test", "priority": "high"}
	)


@pytest.fixture
def semantic_html_builder():
	"""Create SemanticHTMLBuilder instance for testing"""
	return SemanticHTMLBuilder()


@pytest.fixture
def responsive_css_generator():
	"""Create ResponsiveCSSGenerator instance for testing"""
	return ResponsiveCSSGenerator()


@pytest.fixture
def html_accessibility_validator():
	"""Create HTMLAccessibilityValidator instance for testing"""
	return HTMLAccessibilityValidator()


@pytest.fixture
def html_renderer(sample_render_config, html_accessibility_validator):
	"""Create HTMLRenderer instance for testing"""
	return HTMLRenderer(
		render_config=sample_render_config,
		accessibility_field_validator=html_accessibility_validator
	)


# ============================================================================
# SemanticHTMLBuilder Tests
# ============================================================================

class TestSemanticHTMLBuilder:
	"""Test SemanticHTMLBuilder functionality"""
	
	def test_semantic_builder_initialization(self, semantic_html_builder):
		"""Test SemanticHTMLBuilder initialization"""
		assert 'article' in semantic_html_builder.element_hierarchy
		assert 'banner' in semantic_html_builder.aria_roles
		assert semantic_html_builder.build_metrics['documents_built'] == 0
	
	async def test_build_semantic_structure_success(self, semantic_html_builder, sample_formatted_content, sample_render_config):
		"""Test successful semantic structure building"""
		semantic_structure = await semantic_html_builder.build_semantic_structure(
			sample_formatted_content,
			sample_render_config
		)
		
		assert semantic_structure['doctype'] == '<!DOCTYPE html>'
		assert 'html_attributes' in semantic_structure
		assert semantic_structure['html_attributes']['lang'] == "en"
		assert 'head' in semantic_structure
		assert 'body' in semantic_structure
		assert semantic_structure['semantic_elements_count'] > 0
		assert semantic_structure['aria_attributes_count'] > 0
	
	async def test_build_document_head(self, semantic_html_builder, sample_formatted_content, sample_render_config):
		"""Test document head building"""
		head_data = await semantic_html_builder._build_document_head(
			sample_formatted_content,
			sample_render_config
		)
		
		assert head_data['meta_charset'] == "UTF-8"
		assert head_data['title'] == sample_formatted_content.title
		assert 'open_graph' in head_data
		assert 'twitter_cards' in head_data
		assert 'schema_org' in head_data
		assert head_data['schema_org']['@type'] == "Article"
	
	async def test_build_document_body(self, semantic_html_builder, sample_formatted_content, sample_render_config):
		"""Test document body building"""
		body_data = await semantic_html_builder._build_document_body(
			sample_formatted_content,
			sample_render_config
		)
		
		assert 'header' in body_data
		assert 'main' in body_data
		assert 'footer' in body_data
		assert body_data['header']['role'] == 'banner'
		assert body_data['main']['role'] == 'main'
		assert body_data['footer']['role'] == 'contentinfo'
	
	def test_create_content_sections(self, semantic_html_builder, sample_formatted_content, sample_render_config):
		"""Test content section creation"""
		sections = semantic_html_builder._create_content_sections(
			sample_formatted_content,
			sample_render_config
		)
		
		assert len(sections) == 3  # From sample_formatted_content.sections
		assert all('id' in section for section in sections)
		assert all('aria-labelledby' in section for section in sections)
		assert sections[0]['id'] == 'section-1'
	
	def test_extract_section_headings(self, semantic_html_builder, sample_formatted_content):
		"""Test section heading extraction"""
		headings = semantic_html_builder._extract_section_headings(sample_formatted_content)
		
		assert len(headings) == 3
		assert headings[0]['title'] == 'Introduction'
		assert headings[0]['anchor'] == 'section-1'
		assert headings[0]['level'] == 2
	
	def test_count_semantic_elements(self, semantic_html_builder):
		"""Test semantic element counting"""
		body_structure = {
			'header': {'role': 'banner'},
			'main': {'role': 'main'},
			'article': {'content': 'test'},
			'footer': {'role': 'contentinfo'}
		}
		
		count = semantic_html_builder._count_semantic_elements(body_structure)
		assert count == 4  # header, main, article, footer
	
	def test_count_aria_attributes(self, semantic_html_builder):
		"""Test ARIA attribute counting"""
		body_structure = {
			'header': {'role': 'banner', 'aria-label': 'Site header'},
			'main': {'role': 'main', 'aria-labelledby': 'main-heading'},
			'nav': {'role': 'navigation'}
		}
		
		count = semantic_html_builder._count_aria_attributes(body_structure)
		assert count == 5  # 3 roles + 1 aria-label + 1 aria-labelledby


# ============================================================================
# ResponsiveCSSGenerator Tests
# ============================================================================

class TestResponsiveCSSGenerator:
	"""Test ResponsiveCSSGenerator functionality"""
	
	def test_css_generator_initialization(self, responsive_css_generator):
		"""Test ResponsiveCSSGenerator initialization"""
		assert responsive_css_generator.css_cache == {}
		assert responsive_css_generator.generation_metrics['css_generated'] == 0
	
	async def test_generate_responsive_css_success(self, responsive_css_generator, sample_formatted_content, sample_render_config):
		"""Test successful responsive CSS generation"""
		css_result = await responsive_css_generator.generate_responsive_css(
			sample_formatted_content,
			sample_render_config
		)
		
		assert 'base_styles' in css_result
		assert 'responsive_styles' in css_result
		assert 'critical_css' in css_result
		assert 'print_styles' in css_result
		assert 'accessibility_styles' in css_result
		assert css_result['total_size'] > 0
		assert 0.0 < css_result['compression_ratio'] <= 1.0
	
	async def test_generate_base_styles(self, responsive_css_generator, sample_render_config):
		"""Test base CSS styles generation"""
		base_css = await responsive_css_generator._generate_base_styles(sample_render_config)
		
		assert ':root {' in base_css
		assert '--primary-color:' in base_css
		assert 'body {' in base_css
		assert 'font-family:' in base_css
		assert '.container {' in base_css
	
	async def test_generate_responsive_styles(self, responsive_css_generator, sample_formatted_content, sample_render_config):
		"""Test responsive styles generation"""
		responsive_css = await responsive_css_generator._generate_responsive_styles(
			sample_formatted_content,
			sample_render_config
		)
		
		assert '@media (min-width: 640px)' in responsive_css  # sm breakpoint
		assert '@media (min-width: 768px)' in responsive_css  # md breakpoint
		assert '@media (min-width: 1024px)' in responsive_css  # lg breakpoint
		assert 'grid-layout' in responsive_css
	
	async def test_extract_critical_css(self, responsive_css_generator, sample_formatted_content, sample_render_config):
		"""Test critical CSS extraction"""
		critical_css = await responsive_css_generator._extract_critical_css(
			sample_formatted_content,
			sample_render_config
		)
		
		assert 'Critical CSS for above-the-fold' in critical_css
		assert 'body {' in critical_css
		assert '.container {' in critical_css
		assert 'h1 {' in critical_css
	
	async def test_generate_print_styles(self, responsive_css_generator, sample_render_config):
		"""Test print styles generation"""
		print_css = await responsive_css_generator._generate_print_styles(sample_render_config)
		
		assert '@media print {' in print_css
		assert '.no-print' in print_css
		assert 'page-break-after: avoid' in print_css
		assert 'page-break-inside: avoid' in print_css
	
	async def test_generate_accessibility_styles(self, responsive_css_generator, sample_render_config):
		"""Test accessibility styles generation"""
		accessibility_css = await responsive_css_generator._generate_accessibility_styles(sample_render_config)
		
		assert ':focus {' in accessibility_css
		assert 'outline:' in accessibility_css
		assert '.skip-link' in accessibility_css
		assert '@media (prefers-contrast: high)' in accessibility_css
		assert '@media (prefers-reduced-motion: reduce)' in accessibility_css
		assert '.sr-only' in accessibility_css
	
	def test_calculate_compression_ratio(self, responsive_css_generator):
		"""Test CSS compression ratio calculation"""
		css_content = """
		body {
			margin: 0;
			padding: 0;
		}
		"""
		
		ratio = responsive_css_generator._calculate_compression_ratio(css_content)
		assert 0.0 < ratio <= 1.0
	
	def test_compression_ratio_empty_content(self, responsive_css_generator):
		"""Test compression ratio with empty content"""
		ratio = responsive_css_generator._calculate_compression_ratio("")
		assert ratio == 0.0


# ============================================================================
# HTMLAccessibilityValidator Tests
# ============================================================================

class TestHTMLAccessibilityValidator:
	"""Test HTMLAccessibilityValidator functionality"""
	
	def test_accessibility_validator_initialization(self, html_accessibility_validator):
		"""Test HTMLAccessibilityValidator initialization"""
		assert html_accessibility_validator.validation_rules['wcag_aa_requirements'] is True
		assert html_accessibility_validator.validation_rules['aria_validation'] is True
		assert html_accessibility_validator.validation_rules['color_contrast_ratio'] == 4.5
	
	async def test_validate_accessibility_success(self, html_accessibility_validator, sample_render_config):
		"""Test successful accessibility validation"""
		html_content = """
		<html>
		<body>
			<header role="banner">
				<h1>Test Document</h1>
			</header>
			<main role="main">
				<article>
					<h2>Section Title</h2>
					<p>Content with <a href="#test">link</a></p>
					<img src="test.jpg" alt="Test image">
				</article>
			</main>
			<nav role="navigation" aria-label="Main navigation">
				<ul>
					<li><a href="#section1">Section 1</a></li>
				</ul>
			</nav>
		</body>
		</html>
		"""
		css_content = "body { color: #000; background: #fff; }"
		
		accessibility_report = await html_accessibility_validator.validate_accessibility(
			html_content,
			css_content,
			sample_render_config
		)
		
		assert accessibility_report['overall_accessibility_score'] > 0.0
		assert accessibility_report['wcag_compliant'] is True
		assert accessibility_report['aria_implementation'] is True
		assert accessibility_report['keyboard_navigation'] is True
		assert accessibility_report['image_accessibility'] is True
		assert 'validation_details' in accessibility_report
	
	def test_count_semantic_elements(self, html_accessibility_validator):
		"""Test semantic element counting"""
		html_content = """
		<header>Header</header>
		<main>Main content</main>
		<nav>Navigation</nav>
		<aside>Sidebar</aside>
		<footer>Footer</footer>
		"""
		
		count = html_accessibility_validator._count_semantic_elements(html_content)
		assert count == 5
	
	def test_count_aria_attributes(self, html_accessibility_validator):
		"""Test ARIA attribute counting"""
		html_content = """
		<div role="banner" aria-label="Site header">
			<nav role="navigation" aria-labelledby="nav-title">
				<h2 id="nav-title">Navigation</h2>
			</nav>
		</div>
		"""
		
		count = html_accessibility_validator._count_aria_attributes(html_content)
		assert count >= 3  # At least role, aria-label, aria-labelledby
	
	def test_validate_heading_structure(self, html_accessibility_validator):
		"""Test heading structure validation"""
		valid_html = "<h1>Title</h1><h2>Subtitle</h2><h3>Sub-subtitle</h3>"
		invalid_html = "<h2>No H1</h2><h3>Subtitle</h3>"
		
		assert html_accessibility_validator._validate_heading_structure(valid_html) is True
		assert html_accessibility_validator._validate_heading_structure(invalid_html) is False
	
	def test_check_alt_text_coverage_full(self, html_accessibility_validator):
		"""Test alt text coverage with all images having alt text"""
		html_content = '''
		<img src="test1.jpg" alt="Test image 1">
		<img src="test2.jpg" alt="Test image 2">
		'''
		
		coverage = html_accessibility_validator._check_alt_text_coverage(html_content)
		assert coverage == 1.0
	
	def test_check_alt_text_coverage_partial(self, html_accessibility_validator):
		"""Test alt text coverage with some images missing alt text"""
		html_content = '''
		<img src="test1.jpg" alt="Test image 1">
		<img src="test2.jpg">
		'''
		
		coverage = html_accessibility_validator._check_alt_text_coverage(html_content)
		assert coverage == 0.5
	
	def test_check_alt_text_coverage_no_images(self, html_accessibility_validator):
		"""Test alt text coverage with no images"""
		html_content = "<p>No images here</p>"
		
		coverage = html_accessibility_validator._check_alt_text_coverage(html_content)
		assert coverage == 1.0  # 100% coverage when no images
	
	def test_has_keyboard_navigation_elements(self, html_accessibility_validator):
		"""Test keyboard navigation element detection"""
		html_with_nav = '<nav><a href="#test">Link</a></nav>'
		html_without_nav = '<div>No navigation</div>'
		
		assert html_accessibility_validator._has_keyboard_navigation_elements(html_with_nav) is True
		assert html_accessibility_validator._has_keyboard_navigation_elements(html_without_nav) is False


# ============================================================================
# HTMLRenderer Core Tests
# ============================================================================

class TestHTMLRenderer:
	"""Test HTMLRenderer core functionality"""
	
	def test_html_renderer_initialization(self, html_renderer):
		"""Test HTMLRenderer initialization"""
		assert html_renderer.render_config is not None
		assert html_renderer.accessibility_field_validator is not None
		assert html_renderer.semantic_builder is not None
		assert html_renderer.css_generator is not None
		assert html_renderer.metrics['documents_rendered'] == 0
	
	async def test_render_html_success(self, html_renderer, sample_formatted_content):
		"""Test successful HTML rendering"""
		result = await html_renderer.render_html(sample_formatted_content)
		
		assert result.render_successful is True
		assert result.document_id == sample_formatted_content.document_id
		assert len(result.html_content) > 0
		assert len(result.css_content) > 0
		assert result.file_size > 0
		assert result.rendering_time > 0
		assert result.rendering_quality_score > 0
		assert result.accessibility_score > 0
		assert result.semantic_elements_used > 0
		assert result.wcag_compliant is True
		assert result.html_valid is True
		assert result.mobile_optimized is True
	
	async def test_render_html_with_output_path(self, html_renderer, sample_formatted_content):
		"""Test HTML rendering with file output"""
		with tempfile.NamedTemporaryFile(suffix=".html", delete=False) as temp_file:
			output_path = temp_file.name
		
		try:
			result = await html_renderer.render_html(sample_formatted_content, output_path)
			
			assert result.render_successful is True
			assert result.temp_file_path == output_path
			assert Path(output_path).exists()
			assert Path(output_path).stat().st_size > 0
			
			# Check that CSS file was also created
			css_path = Path(output_path).with_suffix('.css')
			assert css_path.exists()
		finally:
			Path(output_path).unlink(missing_ok=True)
			Path(output_path).with_suffix('.css').unlink(missing_ok=True)
			Path(output_path).with_suffix('.js').unlink(missing_ok=True)
	
	async def test_render_responsive_html(self, html_renderer, sample_formatted_content):
		"""Test responsive HTML rendering with custom breakpoints"""
		custom_breakpoints = {
			"sm": "480px",
			"md": "768px",
			"lg": "1024px"
		}
		
		result = await html_renderer.render_responsive_html(
			sample_formatted_content,
			breakpoints=custom_breakpoints
		)
		
		assert result.render_successful is True
		assert result.responsive_breakpoints == 3
		assert '@media (min-width: 480px)' in result.css_content
		assert '@media (min-width: 768px)' in result.css_content
		assert '@media (min-width: 1024px)' in result.css_content
	
	async def test_batch_render_html(self, html_renderer):
		"""Test batch HTML rendering"""
		documents = [
			FormattedDocumentContent(
				title=f"Document {i}",
				content_html=f"<h1>Document {i}</h1><p>Content for document {i}</p>"
			)
			for i in range(1, 4)
		]
		
		with tempfile.TemporaryDirectory() as temp_dir:
			results = await html_renderer.batch_render_html(
				documents,
				temp_dir,
				"test_{document_id}.html"
			)
			
			assert len(results) == 3
			assert all(result.render_successful for result in results)
			assert all(result.file_size > 0 for result in results)
			
			# Check that files were created
			output_files = list(Path(temp_dir).glob("test_*.html"))
			assert len(output_files) == 3
	
	async def test_compile_html_output(self, html_renderer, sample_formatted_content, sample_render_config):
		"""Test HTML output compilation"""
		semantic_structure = await html_renderer.semantic_builder.build_semantic_structure(
			sample_formatted_content,
			sample_render_config
		)
		
		html_content = await html_renderer._compile_html_output(semantic_structure, sample_render_config)
		
		assert html_content.startswith('<!DOCTYPE html>')
		assert '<html lang="en"' in html_content
		assert '<head>' in html_content
		assert '<body>' in html_content
		assert sample_formatted_content.title in html_content
		assert 'role="banner"' in html_content
		assert 'role="main"' in html_content
		assert 'role="contentinfo"' in html_content
	
	async def test_generate_javascript_enabled(self, html_renderer, sample_formatted_content):
		"""Test JavaScript generation when enabled"""
		config = HTMLRenderConfiguration(
			javascript_enabled=True,
			progressive_enhancement=True,
			smooth_scrolling=True
		)
		
		javascript_content = await html_renderer._generate_javascript(sample_formatted_content, config)
		
		assert len(javascript_content) > 0
		assert 'IntersectionObserver' in javascript_content
		assert 'smooth' in javascript_content
	
	async def test_generate_javascript_disabled(self, html_renderer, sample_formatted_content):
		"""Test JavaScript generation when disabled"""
		config = HTMLRenderConfiguration(javascript_enabled=False)
		
		javascript_content = await html_renderer._generate_javascript(sample_formatted_content, config)
		
		assert javascript_content == ""
	
	async def test_get_html_renderer_metrics(self, html_renderer, sample_formatted_content):
		"""Test HTML renderer metrics collection"""
		# Render a document first to generate metrics
		await html_renderer.render_html(sample_formatted_content)
		
		metrics = await html_renderer.get_html_renderer_metrics()
		
		assert metrics['documents_rendered'] >= 1
		assert metrics['average_render_time'] >= 0
		assert metrics['average_file_size'] > 0
		assert metrics['accessibility_score_average'] > 0
		assert metrics['memory_usage'] > 0
		assert metrics['system_status'] == 'operational'
	
	def test_calculate_performance_score(self, html_renderer):
		"""Test performance score calculation"""
		css_result = {
			'compression_ratio': 0.7,
			'critical_css': 'body { color: #000; }'
		}
		file_size = 100000  # 100KB
		
		score = html_renderer._calculate_performance_score(css_result, file_size)
		assert 0.0 <= score <= 1.0
	
	def test_calculate_seo_score(self, html_renderer, sample_render_config):
		"""Test SEO score calculation"""
		semantic_structure = {
			'head': {
				'meta_description': 'Test description',
				'open_graph': {'og:title': 'Test'}
			},
			'semantic_elements_count': 5
		}
		
		score = html_renderer._calculate_seo_score(semantic_structure, sample_render_config)
		assert 0.0 <= score <= 1.0


# ============================================================================
# Error Handling Tests
# ============================================================================

class TestHTMLRendererErrorHandling:
	"""Test HTMLRenderer error handling and edge cases"""
	
	async def test_render_empty_content(self, html_renderer):
		"""Test rendering with empty content"""
		empty_content = FormattedDocumentContent(
			title="",
			content_html="",
			content_text=""
		)
		
		result = await html_renderer.render_html(empty_content)
		
		# Should still succeed with minimal content
		assert result.render_successful is True
		assert len(result.html_content) > 0
	
	async def test_render_with_malformed_html(self, html_renderer):
		"""Test rendering with malformed HTML"""
		malformed_content = FormattedDocumentContent(
			title="Malformed Document",
			content_html="<h1>Unclosed heading<p>Malformed paragraph<div>Missing close tags"
		)
		
		result = await html_renderer.render_html(malformed_content)
		
		# Should handle gracefully
		assert result.render_successful is True
	
	async def test_render_with_missing_metadata(self, html_renderer):
		"""Test rendering with minimal metadata"""
		minimal_content = FormattedDocumentContent(
			content_html="<p>Minimal content</p>"
		)
		
		result = await html_renderer.render_html(minimal_content)
		
		# Should render successfully with defaults
		assert result.render_successful is True
		assert len(result.html_content) > 0


# ============================================================================
# Performance Tests
# ============================================================================

class TestHTMLRendererPerformance:
	"""Test HTMLRenderer performance characteristics"""
	
	async def test_rendering_performance(self, html_renderer):
		"""Test rendering performance with reasonable content"""
		large_content = FormattedDocumentContent(
			title="Performance Test Document",
			content_html="""
			<h1>Performance Test</h1>
			""" + "\n".join([f"<p>Paragraph {i} with test content for performance evaluation.</p>" for i in range(100)]),
			content_text="Performance Test\n\n" + "\n\n".join([f"Paragraph {i} with test content." for i in range(100)])
		)
		
		start_time = datetime.now()
		result = await html_renderer.render_html(large_content)
		end_time = datetime.now()
		
		assert result.render_successful is True
		assert result.rendering_time < 3.0  # Should render within 3 seconds
		assert (end_time - start_time).total_seconds() < 5.0  # Including overhead
	
	async def test_memory_usage_estimation(self, html_renderer, sample_formatted_content):
		"""Test memory usage estimation"""
		# Render some documents to populate caches
		for i in range(5):
			await html_renderer.render_html(sample_formatted_content)
		
		initial_memory = html_renderer._estimate_memory_usage()
		
		# Render more documents
		for i in range(5):
			await html_renderer.render_html(sample_formatted_content)
		
		final_memory = html_renderer._estimate_memory_usage()
		
		assert initial_memory > 0
		assert final_memory >= initial_memory  # Should not decrease significantly
	
	async def test_concurrent_rendering(self, html_renderer):
		"""Test concurrent HTML rendering"""
		documents = [
			FormattedDocumentContent(
				title=f"Concurrent Doc {i}",
				content_html=f"<h1>Document {i}</h1><p>Content {i}</p>"
			)
			for i in range(5)
		]
		
		# Render documents concurrently
		tasks = [html_renderer.render_html(doc) for doc in documents]
		results = await asyncio.gather(*tasks)
		
		assert len(results) == 5
		assert all(result.render_successful for result in results)
		assert len(set(result.document_id for result in results)) == 5  # All unique


# ============================================================================
# Integration Tests
# ============================================================================

class TestHTMLRendererIntegration:
	"""Test HTMLRenderer integration scenarios"""
	
	async def test_end_to_end_html_generation(self, sample_formatted_content):
		"""Test complete end-to-end HTML generation workflow"""
		# Create custom configuration
		config = create_default_html_configuration(responsive=True, accessibility_level="AAA")
		config.document_metadata.title = "Integration Test Document"
		config.document_metadata.author = "Test Suite"
		
		# Create renderer with custom config
		renderer = HTMLRenderer(render_config=config)
		
		# Render HTML
		result = await renderer.render_html(sample_formatted_content)
		
		# Verify comprehensive results
		assert result.render_successful is True
		assert result.file_size > 0
		assert result.rendering_quality_score > 0.8
		assert result.accessibility_score > 0.8
		assert result.performance_score > 0.6
		assert result.seo_score > 0.6
		assert result.processing_efficiency > 0.0
	
	async def test_accessibility_aaa_workflow(self, sample_formatted_content):
		"""Test WCAG AAA accessibility compliance workflow"""
		config = HTMLRenderConfiguration(
			accessibility_compliance=True,
			wcag_compliance_level="AAA",
			aria_labels=True,
			keyboard_navigation=True,
			screen_reader_optimization=True,
			high_contrast_support=True
		)
		
		renderer = HTMLRenderer(render_config=config)
		result = await renderer.render_html(sample_formatted_content)
		
		assert result.render_successful is True
		assert result.wcag_compliant is True
		assert result.accessibility_score > 0.8
		assert result.aria_attributes_added > 0
	
	async def test_responsive_design_workflow(self, sample_formatted_content):
		"""Test responsive design generation workflow"""
		config = HTMLRenderConfiguration(
			responsive_design=True,
			mobile_first=True,
			breakpoints={
				"sm": "576px",
				"md": "768px",
				"lg": "992px",
				"xl": "1200px"
			}
		)
		
		renderer = HTMLRenderer(render_config=config)
		result = await renderer.render_html(sample_formatted_content)
		
		assert result.render_successful is True
		assert result.mobile_optimized is True
		assert result.responsive_breakpoints == 4
		assert '@media (min-width: 576px)' in result.css_content
	
	async def test_seo_optimization_workflow(self, sample_formatted_content):
		"""Test SEO optimization workflow"""
		config = HTMLRenderConfiguration(
			seo_optimization=True,
			open_graph_tags=True,
			twitter_cards=True,
			schema_org_markup=True,
			document_metadata=HTMLMetadata(
				title="SEO Test Document",
				description="Test document for SEO optimization",
				keywords=["seo", "html", "optimization"],
				og_title="SEO Test Document",
				og_description="SEO optimized test document"
			)
		)
		
		renderer = HTMLRenderer(render_config=config)
		result = await renderer.render_html(sample_formatted_content)
		
		assert result.render_successful is True
		assert result.seo_score > 0.8
		assert 'property="og:title"' in result.html_content
		assert 'application/ld+json' in result.html_content


# ============================================================================
# Utility Function Tests
# ============================================================================

class TestUtilityFunctions:
	"""Test HTMLRenderer utility functions"""
	
	def test_create_default_html_configuration(self):
		"""Test default HTML configuration creation"""
		responsive_config = create_default_html_configuration(responsive=True, accessibility_level="AA")
		non_responsive_config = create_default_html_configuration(responsive=False, accessibility_level="A")
		
		assert responsive_config.responsive_design is True
		assert responsive_config.wcag_compliance_level == "AA"
		assert len(responsive_config.breakpoints) > 0
		
		assert non_responsive_config.responsive_design is False
		assert non_responsive_config.wcag_compliance_level == "A"
		assert len(non_responsive_config.breakpoints) == 0
	
	async def test_quick_html_render(self):
		"""Test quick HTML rendering utility"""
		content = "<h1>Quick Test</h1><p>Quick rendering test content.</p>"
		title = "Quick Document"
		
		result = await quick_html_render(content, title)
		
		assert result.render_successful is True
		assert len(result.html_content) > 0
		assert title in result.html_content
	
	async def test_quick_html_render_plain_text(self):
		"""Test quick HTML rendering with plain text"""
		content = "This is plain text content for quick rendering."
		title = "Plain Text Document"
		
		result = await quick_html_render(content, title)
		
		assert result.render_successful is True
		assert len(result.html_content) > 0
		assert '<p>' in result.html_content  # Plain text should be wrapped in paragraphs
	
	def test_validate_html_renderer_installation(self):
		"""Test HTML renderer installation validation"""
		validation_results = validate_html_renderer_installation()
		
		assert "html5_support" in validation_results
		assert "css3_support" in validation_results
		assert "html_renderer_core" in validation_results
		assert "semantic_builder" in validation_results
		assert "css_generator" in validation_results
		assert "accessibility_field_validator" in validation_results
		assert "overall_status" in validation_results
		
		# Core components should always be available
		assert validation_results["html_renderer_core"] is True
		assert validation_results["semantic_builder"] is True
		assert validation_results["css_generator"] is True
		assert validation_results["accessibility_field_validator"] is True


# ============================================================================
# Exception Tests
# ============================================================================

class TestHTMLRendererExceptions:
	"""Test HTMLRenderer exception handling"""
	
	def test_exception_hierarchy(self):
		"""Test exception class hierarchy"""
		assert issubclass(HTMLRenderingException, HTMLRendererException)
		assert issubclass(HTMLValidationException, HTMLRendererException)
		assert issubclass(HTMLAccessibilityException, HTMLRendererException)
		assert issubclass(HTMLPerformanceException, HTMLRendererException)
	
	def test_exception_instantiation(self):
		"""Test exception instantiation"""
		base_exc = HTMLRendererException("Base error")
		render_exc = HTMLRenderingException("Rendering error")
		validation_exc = HTMLValidationException("Validation error")
		accessibility_exc = HTMLAccessibilityException("Accessibility error")
		performance_exc = HTMLPerformanceException("Performance error")
		
		assert str(base_exc) == "Base error"
		assert str(render_exc) == "Rendering error"
		assert str(validation_exc) == "Validation error"
		assert str(accessibility_exc) == "Accessibility error"
		assert str(performance_exc) == "Performance error"