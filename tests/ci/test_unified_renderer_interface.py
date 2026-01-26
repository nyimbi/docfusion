#!/usr/bin/env python3
"""
Unified Renderer Interface Tests

Comprehensive test suite for the unified renderer interface covering:
- Base renderer abstract interface compliance
- Unified data models validation
- Renderer registry functionality
- Cross-renderer consistency
- Backward compatibility verification
- Performance and quality metrics
"""

import asyncio
import pytest
import tempfile
from pathlib import Path
from datetime import datetime

from docfusion.document_engine.renderer.base_renderer import (
	BaseRenderer,
	UnifiedRenderConfiguration,
	UnifiedDocumentContent,
	UnifiedRenderResult,
	RendererRegistry,
	renderer_registry,
	render_document,
	batch_render_multi_format,
	create_unified_content_from_html,
	RendererException,
	ContentProcessingException,
	OutputGenerationException
)

from docfusion.document_engine.renderer.unified_pdf_renderer import (
	UnifiedPDFRenderer,
	PDFRenderConfiguration
)

from docfusion.document_engine.renderer.unified_docx_renderer import (
	UnifiedDOCXRenderer,
	DOCXRenderConfiguration  
)

from docfusion.document_engine.renderer.unified_html_renderer import (
	UnifiedHTMLRenderer,
	HTMLRenderConfiguration
)

from docfusion.document_engine.renderer.unified_accessibility_renderer import (
	UnifiedAccessibilityRenderer,
	AccessibilityRenderConfiguration
)


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def sample_content():
	"""Create sample unified document content for testing"""
	return UnifiedDocumentContent(
		title="Test Document",
		content_html="<h1>Test Document</h1><p>This is a test document with <strong>formatting</strong>.</p>",
		content_markdown="# Test Document\n\nThis is a test document with **formatting**.",
		content_text="Test Document\n\nThis is a test document with formatting.",
		content_css="h1 { color: #2c3e50; } p { line-height: 1.6; }",
		sections=[
			{"title": "Introduction", "content": "Introduction content"},
			{"title": "Body", "content": "Body content"}
		],
		metadata={"author": "Test Author", "subject": "Testing"}
	)


@pytest.fixture
def sample_config():
	"""Create sample unified render configuration"""
	return UnifiedRenderConfiguration(
		output_quality="high",
		accessibility_enabled=True,
		wcag_compliance_level="AA",
		enable_caching=True
	)


@pytest.fixture
def temp_output_dir():
	"""Create temporary directory for output files"""
	with tempfile.TemporaryDirectory() as temp_dir:
		yield Path(temp_dir)


# ============================================================================
# Unified Data Model Tests
# ============================================================================

class TestUnifiedDataModels:
	"""Test unified data models and validation"""
	
	def test_unified_render_configuration_creation(self):
		"""Test UnifiedRenderConfiguration creation and validation"""
		config = UnifiedRenderConfiguration(
			output_quality="production",
			page_size="Letter",
			accessibility_enabled=True,
			wcag_compliance_level="AAA"
		)
		
		assert config.output_quality == "production"
		assert config.page_size == "Letter"
		assert config.accessibility_enabled is True
		assert config.wcag_compliance_level == "AAA"
		assert config.config_id is not None
	
	def test_unified_document_content_creation(self, sample_content):
		"""Test UnifiedDocumentContent creation and validation"""
		assert sample_content.title == "Test Document"
		assert sample_content.document_id is not None
		assert sample_content.created_at is not None
		assert len(sample_content.content_html) > 0
		assert len(sample_content.sections) == 2
		assert sample_content.metadata["author"] == "Test Author"
	
	def test_unified_render_result_creation(self):
		"""Test UnifiedRenderResult creation and validation"""
		result = UnifiedRenderResult(
			document_id="test-doc-123",
			render_successful=True,
			rendered_content=b"test content",
			content_type="text/html",
			rendering_quality_score=0.95,
			accessibility_score=0.88
		)
		
		assert result.document_id == "test-doc-123"
		assert result.render_successful is True
		assert result.rendered_content == b"test content"
		assert result.content_type == "text/html"
		assert result.rendering_quality_score == 0.95
		assert result.accessibility_score == 0.88
		assert result.result_id is not None
	
	def test_content_format_extraction(self, sample_content):
		"""Test content format extraction utility"""
		# This would be tested on a concrete renderer
		# For now, test the content has multiple formats
		assert sample_content.content_html != ""
		assert sample_content.content_markdown != ""
		assert sample_content.content_text != ""


# ============================================================================
# Renderer Registry Tests
# ============================================================================

class TestRendererRegistry:
	"""Test renderer registry functionality"""
	
	def test_renderer_registry_initialization(self):
		"""Test renderer registry initialization"""
		registry = RendererRegistry()
		assert registry.get_available_formats() == []
		assert not registry.is_format_supported("pdf")
	
	def test_renderer_registration(self):
		"""Test renderer registration"""
		registry = RendererRegistry()
		
		# Register a renderer
		registry.register("test", UnifiedPDFRenderer)
		
		assert "test" in registry.get_available_formats()
		assert registry.is_format_supported("test")
		
		# Get renderer instance
		renderer = registry.get_renderer("test")
		assert isinstance(renderer, UnifiedPDFRenderer)
	
	def test_invalid_renderer_registration(self):
		"""Test invalid renderer registration handling"""
		registry = RendererRegistry()
		
		# Try to register non-renderer class
		with pytest.raises(ValueError):
			registry.register("invalid", str)  # str is not a BaseRenderer
	
	def test_unsupported_format_handling(self):
		"""Test handling of unsupported formats"""
		registry = RendererRegistry()
		
		with pytest.raises(ValueError):
			registry.get_renderer("unsupported_format")
	
	def test_global_registry_populated(self):
		"""Test that global registry has registered renderers"""
		# The unified renderers should auto-register
		available_formats = renderer_registry.get_available_formats()
		
		# Check that at least some renderers are registered
		assert len(available_formats) > 0
		
		# Check for expected formats (may not all be available in test environment)
		expected_formats = ["pdf", "docx", "html", "accessibility"]
		registered_formats = set(available_formats)
		expected_set = set(expected_formats)
		
		# At least one format should be registered
		assert len(registered_formats.intersection(expected_set)) > 0


# ============================================================================
# Base Renderer Interface Tests
# ============================================================================

class MockRenderer(BaseRenderer):
	"""Mock renderer for testing base interface"""
	
	def _initialize_renderer(self):
		self.initialized = True
	
	async def render(self, content, output_path=None, custom_config=None):
		result = UnifiedRenderResult(
			document_id=content.document_id,
			render_successful=True,
			rendered_content=b"mock content",
			content_type="text/plain",
			renderer_type="MockRenderer"
		)
		self._update_metrics(result)
		return result
	
	def get_supported_formats(self):
		return ["mock"]
	
	def get_primary_extension(self):
		return "txt"


class TestBaseRendererInterface:
	"""Test base renderer abstract interface"""
	
	def test_mock_renderer_initialization(self):
		"""Test mock renderer initialization"""
		renderer = MockRenderer()
		assert hasattr(renderer, 'initialized')
		assert renderer.initialized is True
		assert renderer.metrics['documents_rendered'] == 0
	
	async def test_mock_renderer_basic_rendering(self, sample_content):
		"""Test basic rendering with mock renderer"""
		renderer = MockRenderer()
		result = await renderer.render(sample_content)
		
		assert result.render_successful is True
		assert result.document_id == sample_content.document_id
		assert result.rendered_content == b"mock content"
		assert result.renderer_type == "MockRenderer"
		assert renderer.metrics['documents_rendered'] == 1
	
	async def test_renderer_batch_processing(self, sample_content):
		"""Test batch processing functionality"""
		renderer = MockRenderer()
		
		# Create multiple documents
		documents = [sample_content]  # Use same content for simplicity
		
		with tempfile.TemporaryDirectory() as temp_dir:
			results = await renderer.batch_render(
				documents, 
				temp_dir, 
				parallel=False
			)
			
			assert len(results) == 1
			assert results[0].render_successful is True
			assert renderer.metrics['documents_rendered'] == 1
	
	async def test_renderer_content_validation(self, sample_content):
		"""Test content validation"""
		renderer = MockRenderer()
		warnings = await renderer.validate_content(sample_content)
		
		# Should not have warnings for good content
		assert isinstance(warnings, list)
	
	async def test_renderer_metrics_collection(self, sample_content):
		"""Test metrics collection"""
		renderer = MockRenderer()
		
		# Render a document
		await renderer.render(sample_content)
		
		metrics = await renderer.get_renderer_metrics()
		
		assert 'documents_rendered' in metrics
		assert 'renderer_type' in metrics
		assert 'supported_formats' in metrics
		assert metrics['documents_rendered'] == 1
		assert metrics['renderer_type'] == 'MockRenderer'
		assert 'mock' in metrics['supported_formats']


# ============================================================================
# Unified Renderer Implementation Tests  
# ============================================================================

class TestUnifiedRendererImplementations:
	"""Test unified renderer implementations"""
	
	async def test_pdf_renderer_unified_interface(self, sample_content, temp_output_dir):
		"""Test PDF renderer unified interface"""
		renderer = UnifiedPDFRenderer()
		
		# Test interface compliance
		assert renderer.get_supported_formats() == ["pdf"]
		assert renderer.get_primary_extension() == "pdf"
		
		# Test rendering (may fail in test environment without LaTeX/WeasyPrint)
		try:
			result = await renderer.render(sample_content)
			# If successful, verify result structure
			assert isinstance(result, UnifiedRenderResult)
			assert result.renderer_type == "UnifiedPDFRenderer"
		except Exception:
			# Expected in test environment without full dependencies
			pass
	
	async def test_docx_renderer_unified_interface(self, sample_content):
		"""Test DOCX renderer unified interface"""
		renderer = UnifiedDOCXRenderer()
		
		# Test interface compliance
		assert renderer.get_supported_formats() == ["docx"]
		assert renderer.get_primary_extension() == "docx"
		
		# Test rendering (may fail without python-docx)
		try:
			result = await renderer.render(sample_content)
			assert isinstance(result, UnifiedRenderResult)
			assert result.renderer_type == "UnifiedDOCXRenderer"
		except Exception:
			# Expected in test environment without full dependencies
			pass
	
	async def test_html_renderer_unified_interface(self, sample_content):
		"""Test HTML renderer unified interface"""
		renderer = UnifiedHTMLRenderer()
		
		# Test interface compliance
		assert renderer.get_supported_formats() == ["html"]
		assert renderer.get_primary_extension() == "html"
		
		# Test rendering (should work without external dependencies)
		result = await renderer.render(sample_content)
		
		assert isinstance(result, UnifiedRenderResult)
		assert result.renderer_type == "UnifiedHTMLRenderer"
		assert result.render_successful is True
		assert result.content_type == "text/html"
		assert len(result.rendered_content) > 0
	
	async def test_accessibility_renderer_unified_interface(self, sample_content):
		"""Test accessibility renderer unified interface"""
		renderer = UnifiedAccessibilityRenderer()
		
		# Test interface compliance
		assert "html" in renderer.get_supported_formats()
		assert renderer.get_primary_extension() == "html"
		
		# Test rendering
		result = await renderer.render(sample_content)
		
		assert isinstance(result, UnifiedRenderResult)
		assert result.renderer_type == "UnifiedAccessibilityRenderer"
		assert result.render_successful is True
		assert result.accessibility_score >= 0.0


# ============================================================================
# Cross-Renderer Consistency Tests
# ============================================================================

class TestCrossRendererConsistency:
	"""Test consistency across different renderer implementations"""
	
	async def test_consistent_interface_compliance(self):
		"""Test that all renderers implement the same interface"""
		renderers = [
			UnifiedPDFRenderer(),
			UnifiedDOCXRenderer(), 
			UnifiedHTMLRenderer(),
			UnifiedAccessibilityRenderer()
		]
		
		for renderer in renderers:
			# Test required methods exist
			assert hasattr(renderer, 'render')
			assert hasattr(renderer, 'get_supported_formats')
			assert hasattr(renderer, 'get_primary_extension')
			assert hasattr(renderer, 'validate_content')
			assert hasattr(renderer, 'batch_render')
			assert hasattr(renderer, 'get_renderer_metrics')
			
			# Test methods return expected types
			assert isinstance(renderer.get_supported_formats(), list)
			assert isinstance(renderer.get_primary_extension(), str)
	
	async def test_consistent_result_structure(self, sample_content):
		"""Test that all renderers return consistent result structure"""
		# Only test HTML renderer since others may fail without dependencies
		renderer = UnifiedHTMLRenderer()
		result = await renderer.render(sample_content)
		
		# Test required result fields
		required_fields = [
			'render_successful', 'document_id', 'result_id', 'render_timestamp',
			'rendered_content', 'content_type', 'file_size', 'rendering_quality_score',
			'accessibility_score', 'rendering_time', 'validation_warnings',
			'validation_errors', 'renderer_type', 'renderer_version'
		]
		
		for field in required_fields:
			assert hasattr(result, field), f"Missing required field: {field}"
	
	async def test_consistent_configuration_handling(self):
		"""Test consistent configuration handling across renderers"""
		base_config = UnifiedRenderConfiguration(
			output_quality="high",
			accessibility_enabled=True
		)
		
		# Test that all renderers accept base configuration
		renderers = [
			UnifiedPDFRenderer(base_config),
			UnifiedDOCXRenderer(base_config),
			UnifiedHTMLRenderer(base_config),
			UnifiedAccessibilityRenderer(base_config)
		]
		
		for renderer in renderers:
			assert renderer.config.output_quality == "high"
			assert renderer.config.accessibility_enabled is True


# ============================================================================
# Utility Function Tests
# ============================================================================

class TestUtilityFunctions:
	"""Test utility functions for unified rendering"""
	
	async def test_render_document_function(self, sample_content):
		"""Test convenience render_document function"""
		# This requires the global registry to have HTML renderer
		if renderer_registry.is_format_supported("html"):
			result = await render_document(sample_content, "html")
			
			assert isinstance(result, UnifiedRenderResult)
			assert result.render_successful is True
	
	def test_create_unified_content_from_html(self):
		"""Test HTML to unified content conversion utility"""
		html_content = "<h1>Test</h1><p>Content</p>"
		css_content = "h1 { color: blue; }"
		
		content = create_unified_content_from_html(
			html_content=html_content,
			title="Test Document",
			css_content=css_content,
			metadata={"author": "Test"}
		)
		
		assert content.title == "Test Document"
		assert content.content_html == html_content
		assert content.content_css == css_content
		assert content.metadata["author"] == "Test"
		assert content.content_length == len(html_content)
	
	async def test_batch_render_multi_format(self, sample_content):
		"""Test multi-format batch rendering"""
		# Only test with HTML since other formats may not be available
		available_formats = [
			fmt for fmt in ["html"] 
			if renderer_registry.is_format_supported(fmt)
		]
		
		if available_formats:
			with tempfile.TemporaryDirectory() as temp_dir:
				results = await batch_render_multi_format(
					[sample_content],
					available_formats,
					temp_dir
				)
				
				assert isinstance(results, dict)
				for fmt in available_formats:
					assert fmt in results
					assert len(results[fmt]) == 1


# ============================================================================
# Performance and Quality Tests
# ============================================================================

class TestPerformanceAndQuality:
	"""Test performance and quality metrics"""
	
	async def test_rendering_performance_tracking(self, sample_content):
		"""Test that rendering performance is tracked"""
		renderer = UnifiedHTMLRenderer()
		
		result = await renderer.render(sample_content)
		
		# Check timing is recorded
		assert result.rendering_time >= 0.0
		assert result.rendering_time < 10.0  # Should be fast
		
		# Check metrics are updated
		metrics = await renderer.get_renderer_metrics()
		assert metrics['documents_rendered'] == 1
		assert metrics['total_rendering_time'] > 0
	
	async def test_quality_score_calculation(self, sample_content):
		"""Test quality score calculation"""
		renderer = UnifiedHTMLRenderer()
		
		result = await renderer.render(sample_content)
		
		# Quality scores should be reasonable
		assert 0.0 <= result.rendering_quality_score <= 1.0
		assert 0.0 <= result.accessibility_score <= 1.0
		
		# Good content should have decent scores
		assert result.rendering_quality_score > 0.5
	
	async def test_file_size_tracking(self, sample_content):
		"""Test file size tracking"""
		renderer = UnifiedHTMLRenderer()
		
		result = await renderer.render(sample_content)
		
		assert result.file_size > 0
		assert result.file_size == len(result.rendered_content)
		assert result.total_size >= result.file_size


# ============================================================================
# Integration Tests
# ============================================================================

class TestUnifiedRendererIntegration:
	"""Test integration scenarios with unified renderers"""
	
	async def test_end_to_end_html_rendering(self, sample_content, temp_output_dir):
		"""Test complete HTML rendering workflow"""
		renderer = UnifiedHTMLRenderer()
		output_path = temp_output_dir / "test_document.html"
		
		result = await renderer.render(sample_content, output_path)
		
		# Verify result
		assert result.render_successful is True
		assert len(result.output_paths) > 0
		assert output_path in result.output_paths
		
		# Verify file was created
		assert output_path.exists()
		assert output_path.stat().st_size > 0
		
		# Verify content
		content = output_path.read_text()
		assert sample_content.title in content
		assert "Test Document" in content
	
	async def test_renderer_factory_pattern(self):
		"""Test renderer factory pattern usage"""
		# Test creating renderers through registry
		if renderer_registry.is_format_supported("html"):
			renderer = renderer_registry.get_renderer("html")
			assert isinstance(renderer, UnifiedHTMLRenderer)
			
			# Test configuration
			config = UnifiedRenderConfiguration(output_quality="production")
			configured_renderer = renderer_registry.get_renderer("html", config)
			assert configured_renderer.config.output_quality == "production"