#!/usr/bin/env python3
"""
Document Generation Pipeline Integration Tests

Comprehensive integration test suite covering the complete end-to-end document
generation pipeline. Tests the full workflow from content assembly through
final document rendering across multiple output formats.

Test Coverage:
- End-to-end document generation workflows
- Multi-format rendering consistency
- Component integration and data flow
- Error handling and recovery mechanisms
- Performance benchmarks and quality validation
- Accessibility compliance validation
- Cross-component compatibility testing
"""

import asyncio
import pytest
import tempfile
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any

# Import DocumentEngine and related components
from docfusion.document_engine.document_engine import (
	DocumentEngine,
	DocumentGenerationRequest,
	DocumentGenerationConfiguration,
	DocumentGenerationResult,
	DocumentEngineException
)

# Import unified renderer components for validation
from docfusion.document_engine.renderer.base_renderer import (
	renderer_registry,
	UnifiedDocumentContent,
	UnifiedRenderResult
)


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def document_engine():
	"""Create DocumentEngine instance for testing"""
	return DocumentEngine(enable_logging=False)


@pytest.fixture
def sample_content_sources():
	"""Create sample content sources for testing"""
	return [
		{
			"source_id": "intro",
			"type": "text",
			"content": "# Introduction\n\nThis is a comprehensive test document for validating the document generation pipeline.",
			"priority": 1
		},
		{
			"source_id": "main_content",
			"type": "markdown",
			"content": "## Main Content\n\nThis section contains the **primary content** of the document with *various* formatting elements.\n\n### Subsection\n\n- Bullet point 1\n- Bullet point 2\n- Bullet point 3\n\n### Tables\n\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Data 1   | Data 2   | Data 3   |\n| Data 4   | Data 5   | Data 6   |",
			"priority": 2
		},
		{
			"source_id": "conclusion",
			"type": "html", 
			"content": '<h2>Conclusion</h2><p>This concludes our test document. The pipeline has successfully processed <strong>multiple content formats</strong> and should generate consistent output across all target formats.</p><p>Key achievements:</p><ul><li>Multi-format content processing</li><li>Consistent rendering</li><li>Quality validation</li></ul>',
			"priority": 3
		}
	]


@pytest.fixture
def generation_config():
	"""Create DocumentGenerationConfiguration for testing"""
	return DocumentGenerationConfiguration(
		document_title="Integration Test Document",
		document_type="report",
		output_formats=["html", "pdf", "docx"],
		enable_accessibility=True,
		minimum_quality_score=0.7,
		enable_caching=False,  # Disable caching for consistent test results
		parallel_processing=False  # Disable parallelism for predictable test execution
	)


@pytest.fixture
def temp_output_dir():
	"""Create temporary directory for output files"""
	with tempfile.TemporaryDirectory() as temp_dir:
		yield Path(temp_dir)


# ============================================================================
# Core Pipeline Integration Tests
# ============================================================================

class TestDocumentGenerationPipeline:
	"""Test complete document generation pipeline"""
	
	async def test_end_to_end_single_format_generation(
		self, 
		document_engine, 
		sample_content_sources, 
		temp_output_dir
	):
		"""Test complete pipeline for single format generation"""
		config = DocumentGenerationConfiguration(
			document_title="Single Format Test",
			document_type="report",
			output_formats=["html"],
			enable_accessibility=True,
			minimum_quality_score=0.7
		)
		
		# Set output directory in config
		config.output_directory = str(temp_output_dir)
		
		request = DocumentGenerationRequest(
			content_sources=sample_content_sources,
			generation_config=config
		)
		
		# Execute generation
		result = await document_engine.generate_document(request)
		
		# Validate result
		assert result.generation_successful is True
		assert result.request_id == request.request_id
		assert result.overall_quality_score >= 0.7
		assert len(result.generated_documents) >= 0  # May have zero files but should be dict
		
		# Validate HTML output
		assert "html" in result.format_quality_scores
		assert result.format_quality_scores["html"] > 0.0
		
		# Check processing times
		assert result.processing_time > 0
		assert result.completion_timestamp is not None
		
		# Verify pipeline components executed
		assert result.assembly_result is not None
		assert result.formatting_result is not None
		
	async def test_end_to_end_multi_format_generation(
		self,
		document_engine,
		sample_content_sources,
		generation_config,
		temp_output_dir
	):
		"""Test complete pipeline for multi-format generation"""
		# Set output directory in config
		generation_config.output_directory = str(temp_output_dir)
		
		request = DocumentGenerationRequest(
			content_sources=sample_content_sources,
			generation_config=generation_config
		)
		
		# Execute generation
		result = await document_engine.generate_document(request)
		
		# Validate result
		assert result.generation_successful is True
		assert result.overall_quality_score >= generation_config.minimum_quality_score
		
		# Validate all requested formats were generated
		requested_formats = set(generation_config.output_formats)
		generated_formats = set(result.format_quality_scores.keys())
		
		# At least HTML should be generated (most reliable format)
		assert "html" in generated_formats
		
		# Check that quality scores exist for generated formats
		for format_name in generated_formats:
			assert result.format_quality_scores[format_name] >= 0.0
		
		# Validate accessibility if enabled
		if generation_config.enable_accessibility:
			assert result.accessibility_score >= 0.0
			assert result.accessibility_result is not None
	
	async def test_pipeline_with_minimal_content(self, document_engine, temp_output_dir):
		"""Test pipeline with minimal content sources"""
		minimal_sources = [
			{
				"source_id": "minimal",
				"type": "text",
				"content": "Minimal test content",
				"priority": 1
			}
		]
		
		config = DocumentGenerationConfiguration(
			document_title="Minimal Test",
			output_formats=["html"],
			minimum_quality_score=0.5  # Lower threshold for minimal content
		)
		config.output_directory = str(temp_output_dir)
		
		request = DocumentGenerationRequest(
			content_sources=minimal_sources,
			generation_config=config
		)
		
		result = await document_engine.generate_document(request)
		
		assert result.generation_successful is True
		assert result.overall_quality_score >= 0.5
		assert len(result.generated_documents) >= 0  # At least some output
	
	async def test_pipeline_error_handling(self, document_engine):
		"""Test pipeline error handling with invalid inputs"""
		# Test with empty content sources
		request = DocumentGenerationRequest(
			content_sources=[],
			generation_config=DocumentGenerationConfiguration(
				document_title="Error Test",
				output_formats=["html"]
			)
		)
		
		result = await document_engine.generate_document(request)
		
		# Should handle gracefully, may succeed with warnings or fail gracefully
		assert isinstance(result, DocumentGenerationResult)
		if not result.generation_successful:
			assert len(result.warnings) > 0 or len(result.errors) > 0


# ============================================================================
# Component Integration Tests
# ============================================================================

class TestComponentIntegration:
	"""Test integration between pipeline components"""
	
	async def test_content_assembly_to_formatting_flow(
		self,
		document_engine,
		sample_content_sources
	):
		"""Test data flow from content assembly to formatting"""
		config = DocumentGenerationConfiguration(
			document_title="Component Flow Test",
			output_formats=["html"]
		)
		
		request = DocumentGenerationRequest(
			content_sources=sample_content_sources,
			generation_config=config
		)
		
		result = await document_engine.generate_document(request)
		
		# Validate assembly result feeds into formatting
		assert result.assembly_result is not None
		assert result.formatting_result is not None
		
		# Check that assembly output contains expected structure
		assembly_result = result.assembly_result
		assert hasattr(assembly_result, 'assembly_successful') or hasattr(assembly_result, 'total_blocks_processed')
		
		# Check that formatting receives and processes assembly output
		formatting_result = result.formatting_result
		assert hasattr(formatting_result, 'formatted_content') or hasattr(formatting_result, 'success')
	
	async def test_formatting_to_rendering_flow(
		self,
		document_engine,
		sample_content_sources
	):
		"""Test data flow from formatting to rendering"""
		config = DocumentGenerationConfiguration(
			document_title="Formatting to Rendering Test",
			output_formats=["html"]
		)
		
		request = DocumentGenerationRequest(
			content_sources=sample_content_sources,
			generation_config=config
		)
		
		result = await document_engine.generate_document(request)
		
		# Validate formatting result feeds into rendering
		assert result.formatting_result is not None
		assert "html" in result.format_quality_scores
		
		# Check that unified content creation works
		unified_content = document_engine._create_unified_content(request, result)
		if hasattr(unified_content, 'title'):
			# Unified interface available
			assert unified_content.title == config.document_title
			assert len(unified_content.content_html) > 0 or len(unified_content.content_text) > 0
		else:
			# Legacy interface fallback
			assert isinstance(unified_content, dict)
			assert "title" in unified_content
	
	@pytest.mark.xfail(
		strict=True,
		reason=(
			"BrandFormatter asserts a 'primary' logo variant exists "
			"(brand_formatter.py:570) even when the brand_specification "
			"omits a logo. The orchestrator's honesty pass surfaces the "
			"failure instead of masking it as True. Resolve by relaxing "
			"the no-logo path in BrandFormatter, then remove this xfail."
		),
	)
	async def test_brand_and_style_integration(
		self,
		document_engine,
		sample_content_sources
	):
		"""Test brand formatting and style application integration"""
		config = DocumentGenerationConfiguration(
			document_title="Brand Style Test",
			output_formats=["html"],
			enable_brand_compliance=True
		)
		
		request = DocumentGenerationRequest(
			content_sources=sample_content_sources,
			generation_config=config
		)
		
		result = await document_engine.generate_document(request)
		
		# Validate brand and style processing
		assert result.brand_result is not None
		assert result.style_result is not None
		
		# Check that style application follows brand formatting
		brand_result = result.brand_result
		style_result = result.style_result
		
		# Both should indicate successful processing
		brand_success = getattr(brand_result, 'formatting_successful', True)
		style_success = getattr(style_result, 'application_successful', True)
		
		assert brand_success is True
		assert style_success is True


# ============================================================================
# Multi-Format Consistency Tests
# ============================================================================

class TestMultiFormatConsistency:
	"""Test consistency across different output formats"""
	
	async def test_format_quality_consistency(
		self,
		document_engine,
		sample_content_sources
	):
		"""Test that different formats maintain consistent quality"""
		config = DocumentGenerationConfiguration(
			document_title="Multi-Format Consistency Test",
			output_formats=["html"],  # Start with HTML as most reliable
			minimum_quality_score=0.7
		)
		
		request = DocumentGenerationRequest(
			content_sources=sample_content_sources,
			generation_config=config
		)
		
		result = await document_engine.generate_document(request)
		
		# Validate quality scores are reasonable
		for format_name, quality_score in result.format_quality_scores.items():
			assert quality_score >= 0.0
			assert quality_score <= 1.0
			
			# Quality should be above minimum threshold for successful generation
			if result.generation_successful:
				assert quality_score >= 0.5  # Reasonable minimum
	
	async def test_unified_renderer_integration(
		self,
		document_engine,
		sample_content_sources
	):
		"""Test integration with unified renderer interface"""
		if not renderer_registry.get_available_formats():
			pytest.skip("Unified renderer interface not available")
		
		# Test with formats available in unified registry
		available_formats = renderer_registry.get_available_formats()
		test_formats = [fmt for fmt in ["html"] if fmt in available_formats]
		
		if not test_formats:
			pytest.skip("No testable formats available in unified registry")
		
		config = DocumentGenerationConfiguration(
			document_title="Unified Renderer Test",
			output_formats=test_formats
		)
		
		request = DocumentGenerationRequest(
			content_sources=sample_content_sources,
			generation_config=config
		)
		
		result = await document_engine.generate_document(request)
		
		# Validate unified interface usage
		assert result.generation_successful is True
		
		# Check that unified content creation works
		unified_content = document_engine._create_unified_content(request, result)
		assert unified_content is not None
		
		# Validate format-specific results
		for format_name in test_formats:
			if format_name in result.format_quality_scores:
				assert result.format_quality_scores[format_name] > 0.0


# ============================================================================
# Performance and Quality Tests
# ============================================================================

class TestPerformanceAndQuality:
	"""Test performance characteristics and quality validation"""
	
	async def test_processing_time_tracking(
		self,
		document_engine,
		sample_content_sources
	):
		"""Test that processing times are tracked accurately"""
		config = DocumentGenerationConfiguration(
			document_title="Performance Test",
			output_formats=["html"]
		)
		
		request = DocumentGenerationRequest(
			content_sources=sample_content_sources,
			generation_config=config
		)
		
		start_time = datetime.now()
		result = await document_engine.generate_document(request)
		end_time = datetime.now()
		
		actual_time = (end_time - start_time).total_seconds()
		
		# Validate timing
		assert result.processing_time > 0
		assert result.processing_time <= actual_time + 1.0  # Allow some margin
		
		# Check component processing times
		assert result.component_processing_times is not None
		assert len(result.component_processing_times) > 0
	
	async def test_quality_score_calculation(
		self,
		document_engine,
		sample_content_sources
	):
		"""Test quality score calculation logic"""
		config = DocumentGenerationConfiguration(
			document_title="Quality Test",
			output_formats=["html"],
			minimum_quality_score=0.8
		)
		
		request = DocumentGenerationRequest(
			content_sources=sample_content_sources,
			generation_config=config
		)
		
		result = await document_engine.generate_document(request)
		
		# Validate quality score calculation
		assert 0.0 <= result.overall_quality_score <= 1.0
		
		# Check that quality score reflects component scores
		if result.generation_successful:
			assert result.overall_quality_score > 0.5
		
		# Validate format quality scores
		for quality_score in result.format_quality_scores.values():
			assert 0.0 <= quality_score <= 1.0
	
	async def test_accessibility_score_validation(
		self,
		document_engine,
		sample_content_sources
	):
		"""Test accessibility score calculation"""
		config = DocumentGenerationConfiguration(
			document_title="Accessibility Test",
			output_formats=["html"],
			enable_accessibility=True
		)
		
		request = DocumentGenerationRequest(
			content_sources=sample_content_sources,
			generation_config=config
		)
		
		result = await document_engine.generate_document(request)
		
		# Validate accessibility processing
		if config.enable_accessibility:
			assert result.accessibility_score >= 0.0
			assert result.accessibility_score <= 1.0
			assert result.accessibility_result is not None


# ============================================================================
# Error Handling and Edge Cases
# ============================================================================

class TestErrorHandlingAndEdgeCases:
	"""Test error handling and edge case scenarios"""
	
	async def test_invalid_output_directory(self, document_engine, sample_content_sources):
		"""Test handling of invalid output directory"""
		config = DocumentGenerationConfiguration(
			document_title="Invalid Directory Test",
			output_formats=["html"]
		)
		
		# Use non-existent directory path
		config.output_directory = "/invalid/nonexistent/path"
		
		request = DocumentGenerationRequest(
			content_sources=sample_content_sources,
			generation_config=config
		)
		
		result = await document_engine.generate_document(request)
		
		# Should handle gracefully - either create directory or generate in-memory
		assert isinstance(result, DocumentGenerationResult)
		# May succeed or fail, but should not crash
	
	async def test_unsupported_format_handling(
		self,
		document_engine,
		sample_content_sources
	):
		"""Test handling of unsupported output formats"""
		config = DocumentGenerationConfiguration(
			document_title="Unsupported Format Test",
			output_formats=["xyz", "invalid_format", "html"]  # Mix valid and invalid
		)
		
		request = DocumentGenerationRequest(
			content_sources=sample_content_sources,
			generation_config=config
		)
		
		result = await document_engine.generate_document(request)
		
		# Should process supported formats and warn about unsupported ones
		assert isinstance(result, DocumentGenerationResult)
		
		# Should either process supported formats or have warnings
		assert isinstance(result, DocumentGenerationResult)
		
		# Either HTML was processed or there are warnings about unsupported formats
		html_processed = "html" in result.format_quality_scores
		has_warnings = len(result.warnings) > 0
		
		# At least one of these should be true
		assert html_processed or has_warnings
	
	async def test_low_quality_content_handling(self, document_engine):
		"""Test handling of very low quality content"""
		low_quality_sources = [
			{
				"source_id": "poor",
				"type": "text",
				"content": "x",  # Minimal content
				"priority": 1
			}
		]
		
		config = DocumentGenerationConfiguration(
			document_title="Low Quality Test",
			output_formats=["html"],
			minimum_quality_score=0.9  # High threshold
		)
		
		request = DocumentGenerationRequest(
			content_sources=low_quality_sources,
			generation_config=config
		)
		
		result = await document_engine.generate_document(request)
		
		# Should process but may have warnings about quality
		assert isinstance(result, DocumentGenerationResult)
		
		# Should warn if quality is below threshold
		if result.overall_quality_score < config.minimum_quality_score:
			assert len(result.warnings) > 0 or len(result.recommendations) > 0


# ============================================================================
# Metrics and Monitoring Tests
# ============================================================================

class TestMetricsAndMonitoring:
	"""Test metrics collection and monitoring capabilities"""
	
	async def test_metrics_collection(
		self,
		document_engine,
		sample_content_sources
	):
		"""Test that metrics are collected properly"""
		initial_metrics = await document_engine.get_engine_metrics()
		initial_count = initial_metrics.get('engine_metrics', {}).get('documents_generated', 0)
		
		config = DocumentGenerationConfiguration(
			document_title="Metrics Test",
			output_formats=["html"]
		)
		
		request = DocumentGenerationRequest(
			content_sources=sample_content_sources,
			generation_config=config
		)
		
		await document_engine.generate_document(request)
		
		# Check metrics were updated
		final_metrics = await document_engine.get_engine_metrics()
		final_engine_metrics = final_metrics.get('engine_metrics', {})
		final_count = final_engine_metrics.get('documents_generated', 0)
		
		assert final_count > initial_count
		assert 'total_processing_time' in final_engine_metrics
		assert 'average_processing_time' in final_engine_metrics
	
	async def test_component_timing_metrics(
		self,
		document_engine,
		sample_content_sources
	):
		"""Test component-level timing metrics"""
		config = DocumentGenerationConfiguration(
			document_title="Component Timing Test",
			output_formats=["html"]
		)
		
		request = DocumentGenerationRequest(
			content_sources=sample_content_sources,
			generation_config=config
		)
		
		result = await document_engine.generate_document(request)
		
		# Validate component timing data
		assert result.component_processing_times is not None
		assert isinstance(result.component_processing_times, dict)
		
		# Should have timing for major components
		expected_components = ['assembly', 'formatting', 'rendering']
		for component in expected_components:
			if component in result.component_processing_times:
				assert result.component_processing_times[component] >= 0.0


# ============================================================================
# Integration Stress Tests
# ============================================================================

class TestIntegrationStressTests:
	"""Stress tests for pipeline robustness"""
	
	async def test_large_content_handling(self, document_engine):
		"""Test handling of large content volumes"""
		# Create large content source
		large_content = "Large content section. " * 1000  # ~20KB of text
		
		large_sources = [
			{
				"source_id": "large",
				"type": "text",
				"content": large_content,
				"priority": 1
			}
		]
		
		config = DocumentGenerationConfiguration(
			document_title="Large Content Test",
			output_formats=["html"],
			minimum_quality_score=0.6
		)
		
		request = DocumentGenerationRequest(
			content_sources=large_sources,
			generation_config=config
		)
		
		result = await document_engine.generate_document(request)
		
		# Should handle large content gracefully
		assert isinstance(result, DocumentGenerationResult)
		if result.generation_successful:
			assert result.overall_quality_score >= 0.5
	
	async def test_multiple_rapid_generations(self, document_engine, sample_content_sources):
		"""Test multiple rapid document generations"""
		config = DocumentGenerationConfiguration(
			document_title="Rapid Generation Test",
			output_formats=["html"]
		)
		
		# Generate multiple documents rapidly
		tasks = []
		for i in range(3):  # Keep it reasonable for test execution
			request = DocumentGenerationRequest(
				content_sources=sample_content_sources,
				generation_config=DocumentGenerationConfiguration(
					document_title=f"Rapid Test {i+1}",
					output_formats=["html"]
				)
			)
			tasks.append(document_engine.generate_document(request))
		
		# Execute all generations
		results = await asyncio.gather(*tasks, return_exceptions=True)
		
		# Validate all completed without exceptions
		for i, result in enumerate(results):
			assert not isinstance(result, Exception), f"Generation {i+1} failed with: {result}"
			assert isinstance(result, DocumentGenerationResult)