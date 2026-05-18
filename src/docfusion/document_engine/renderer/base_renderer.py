#!/usr/bin/env python3
"""
Unified Renderer Interface

This module provides a consistent interface for all document renderers in the DocuFusion
system. It defines base classes and common interfaces to ensure a uniform developer
experience across PDF, DOCX, HTML, and Accessibility renderers.

Key Benefits:
- Consistent API across all renderers
- Interchangeable renderer implementations
- Simplified testing and maintenance
- Standardized error handling and metrics
- Easy extensibility for new output formats
"""

import asyncio
import logging
logger = logging.getLogger(__name__)
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, ConfigDict
from ...core.utils import uuid7str

# ============================================================================
# Unified Data Models
# ============================================================================

class UnifiedRenderConfiguration(BaseModel):
	"""Base configuration for all renderers with common settings"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	# Configuration identification
	config_id: str = Field(default_factory=uuid7str)
	config_name: str = ""
	
	# Common output settings
	output_quality: str = "high"  # draft, medium, high, production
	output_path: Optional[Path] = None
	
	# Common document settings
	page_size: str = "A4"  # A4, A3, Letter, Legal, Custom
	page_orientation: str = "portrait"  # portrait, landscape
	
	# Common accessibility settings
	accessibility_enabled: bool = True
	wcag_compliance_level: str = "AA"  # A, AA, AAA
	
	# Performance settings
	enable_caching: bool = True
	enable_optimization: bool = True
	max_processing_time: float = 120.0  # seconds
	
	# Format-specific settings (overridden by subclasses)
	format_specific_settings: Dict[str, Any] = Field(default_factory=dict)

class UnifiedDocumentContent(BaseModel):
	"""Unified document content representation supporting multiple formats"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	# Document identification
	document_id: str = Field(default_factory=uuid7str)
	title: str = ""
	created_at: datetime = Field(default_factory=datetime.now)
	
	# Multiple content representations for maximum compatibility
	content_html: str = ""  # HTML5 semantic markup
	content_markdown: str = ""  # Markdown for simple formatting
	content_text: str = ""  # Plain text fallback
	content_latex: str = ""  # LaTeX for advanced PDF generation
	
	# Styling and layout information
	content_css: str = ""  # CSS styles
	computed_styles: Dict[str, Any] = Field(default_factory=dict)  # Computed styling rules
	
	# Assets and media
	assets_map: Dict[str, str] = Field(default_factory=dict)  # asset_id -> file_path
	image_assets: Dict[str, str] = Field(default_factory=dict)  # image_id -> base64 or path
	
	# Document structure and metadata
	sections: List[Dict[str, Any]] = Field(default_factory=list)  # Structured sections
	metadata: Dict[str, Any] = Field(default_factory=dict)  # Custom metadata
	
	# Content quality and validation
	content_length: int = 0  # Character count
	estimated_pages: int = 1  # Estimated page count
	complexity_score: float = 0.0  # Content complexity (0.0-1.0)

class UnifiedRenderResult(BaseModel):
	"""Base result class for all renderers with standardized output"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	# Core rendering status
	render_successful: bool = False
	document_id: str = Field(default_factory=uuid7str)
	result_id: str = Field(default_factory=uuid7str)
	render_timestamp: datetime = Field(default_factory=datetime.now)
	
	# Output content (format-specific)
	rendered_content: bytes = b""  # Primary output content
	content_type: str = ""  # MIME type of rendered content
	additional_files: Dict[str, bytes] = Field(default_factory=dict)  # CSS, JS, images, etc.
	
	# Output file information
	output_paths: List[Path] = Field(default_factory=list)  # Generated file paths
	file_size: int = 0  # Primary file size in bytes
	total_size: int = 0  # Total size including additional files
	
	# Quality and performance metrics
	rendering_quality_score: float = 0.0  # Overall rendering quality (0.0-1.0)
	accessibility_score: float = 0.0  # Accessibility compliance score (0.0-1.0)
	rendering_time: float = 0.0  # Rendering time in seconds
	optimization_applied: bool = False  # Whether optimizations were applied
	
	# Validation and error handling
	validation_warnings: List[str] = Field(default_factory=list)
	validation_errors: List[str] = Field(default_factory=list)
	processing_notes: List[str] = Field(default_factory=list)
	
	# Renderer-specific metadata
	renderer_type: str = ""  # Name of renderer used
	renderer_version: str = "1.0.0"  # Version of renderer
	render_config_used: Dict[str, Any] = Field(default_factory=dict)  # Config snapshot

# ============================================================================
# Renderer Exceptions
# ============================================================================

class RendererException(Exception):
	"""Base exception for all renderer-related errors"""
	pass

class RenderConfigurationException(RendererException):
	"""Exception raised for configuration-related errors"""
	pass

class ContentProcessingException(RendererException):
	"""Exception raised during content processing"""
	pass

class OutputGenerationException(RendererException):
	"""Exception raised during output generation"""
	pass

class ValidationException(RendererException):
	"""Exception raised during content validation"""
	pass

# ============================================================================
# Abstract Base Renderer
# ============================================================================

class BaseRenderer(ABC):
	"""
	Abstract base renderer class defining the unified interface.
	
	All concrete renderers (PDF, DOCX, HTML, Accessibility) must implement
	this interface to ensure consistent developer experience.
	"""
	
	def __init__(
		self, 
		config: Optional[UnifiedRenderConfiguration] = None,
		enable_logging: bool = True
	):
		self.config = config or UnifiedRenderConfiguration()
		self.enable_logging = enable_logging
		
		# Performance metrics tracking
		self.metrics = {
			'documents_rendered': 0,
			'total_rendering_time': 0.0,
			'average_render_time': 0.0,
			'average_file_size': 0.0,
			'success_rate': 0.0,
			'error_count': 0,
			'cache_hits': 0,
			'cache_misses': 0
		}
		
		# Initialize renderer-specific components
		self._initialize_renderer()
	
	@abstractmethod
	def _initialize_renderer(self):
		"""Initialize renderer-specific components and dependencies"""
		pass
	
	@abstractmethod
	async def render(
		self,
		content: UnifiedDocumentContent,
		output_path: Optional[Union[str, Path]] = None,
		custom_config: Optional[UnifiedRenderConfiguration] = None
	) -> UnifiedRenderResult:
		"""
		Main render method - must be implemented by all renderers.
		
		Args:
			content: Document content to render
			output_path: Optional path for output file
			custom_config: Optional custom configuration (overrides instance config)
			
		Returns:
			UnifiedRenderResult with rendering outcome and metrics
			
		Raises:
			RendererException: For any rendering-related errors
		"""
		pass
	
	@abstractmethod
	def get_supported_formats(self) -> List[str]:
		"""
		Return list of supported output formats for this renderer.
		
		Returns:
			List of format strings (e.g., ['pdf'], ['docx'], ['html'])
		"""
		pass
	
	@abstractmethod
	def get_primary_extension(self) -> str:
		"""
		Return primary file extension for this renderer.
		
		Returns:
			File extension string without dot (e.g., 'pdf', 'docx', 'html')
		"""
		pass
	
	async def validate_content(
		self,
		content: UnifiedDocumentContent
	) -> List[str]:
		"""
		Validate document content for this renderer.
		
		Args:
			content: Document content to validate
			
		Returns:
			List of validation warnings/errors
		"""
		warnings = []
		
		# Basic content validation
		if not content.title and not content.content_html and not content.content_text:
			warnings.append("Document has no title or content")
		
		if content.content_length == 0 and content.content_html:
			content.content_length = len(content.content_html)
		
		# Format-specific validation (implemented by subclasses)
		format_warnings = await self._validate_format_specific(content)
		warnings.extend(format_warnings)
		
		return warnings
	
	async def _validate_format_specific(
		self,
		content: UnifiedDocumentContent
	) -> List[str]:
		"""Format-specific validation - implemented by subclasses"""
		return []
	
	async def batch_render(
		self,
		documents: List[UnifiedDocumentContent],
		output_directory: Union[str, Path],
		naming_pattern: str = "{document_id}",
		parallel: bool = True
	) -> List[UnifiedRenderResult]:
		"""
		Standard batch rendering implementation with parallel support.
		
		Args:
			documents: List of documents to render
			output_directory: Directory for output files
			naming_pattern: Filename pattern (supports {document_id}, {title}, {timestamp})
			parallel: Whether to render in parallel
			
		Returns:
			List of render results
		"""
		results = []
		output_dir = Path(output_directory)
		output_dir.mkdir(parents=True, exist_ok=True)
		
		if parallel and len(documents) > 1:
			# Parallel rendering
			semaphore = asyncio.Semaphore(3)  # Limit concurrent renders
			
			async def render_with_semaphore(document):
				async with semaphore:
					output_path = self._generate_output_path(
						document, output_dir, naming_pattern
					)
					return await self.render(document, output_path)
			
			results = await asyncio.gather(
				*[render_with_semaphore(doc) for doc in documents],
				return_exceptions=True
			)
			
			# Handle exceptions in results
			for i, result in enumerate(results):
				if isinstance(result, Exception):
					# Create error result
					error_result = UnifiedRenderResult(
						document_id=documents[i].document_id,
						render_successful=False,
						validation_errors=[str(result)],
						renderer_type=self.__class__.__name__
					)
					results[i] = error_result
		else:
			# Sequential rendering
			for document in documents:
				try:
					output_path = self._generate_output_path(
						document, output_dir, naming_pattern
					)
					result = await self.render(document, output_path)
					results.append(result)
				except Exception as e:
					error_result = UnifiedRenderResult(
						document_id=document.document_id,
						render_successful=False,
						validation_errors=[str(e)],
						renderer_type=self.__class__.__name__
					)
					results.append(error_result)
		
		return results
	
	def _generate_output_path(
		self,
		document: UnifiedDocumentContent,
		output_dir: Path,
		naming_pattern: str
	) -> Path:
		"""Generate output file path using naming pattern"""
		timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
		filename = naming_pattern.format(
			document_id=document.document_id,
			title=self._sanitize_filename(document.title or "untitled"),
			timestamp=timestamp
		)
		return output_dir / f"{filename}.{self.get_primary_extension()}"
	
	def _sanitize_filename(self, filename: str) -> str:
		"""Sanitize filename for cross-platform compatibility"""
		import re
		# Remove invalid characters
		sanitized = re.sub(r'[<>:"/\\|?*]', '_', filename)
		# Limit length
		return sanitized[:50] if len(sanitized) > 50 else sanitized
	
	async def get_renderer_metrics(self) -> Dict[str, Any]:
		"""
		Get comprehensive renderer performance metrics.
		
		Returns:
			Dictionary containing performance and usage metrics
		"""
		return {
			**self.metrics,
			'renderer_type': self.__class__.__name__,
			'renderer_version': getattr(self, 'version', '1.0.0'),
			'supported_formats': self.get_supported_formats(),
			'primary_extension': self.get_primary_extension(),
			'configuration': {
				'accessibility_enabled': self.config.accessibility_enabled,
				'wcag_compliance_level': self.config.wcag_compliance_level,
				'output_quality': self.config.output_quality,
				'caching_enabled': self.config.enable_caching
			}
		}
	
	def _update_metrics(self, result: UnifiedRenderResult):
		"""Update performance metrics based on render result"""
		self.metrics['documents_rendered'] += 1
		self.metrics['total_rendering_time'] += result.rendering_time
		self.metrics['average_render_time'] = (
			self.metrics['total_rendering_time'] / self.metrics['documents_rendered']
		)
		
		if result.file_size > 0:
			current_avg = self.metrics['average_file_size']
			total_docs = self.metrics['documents_rendered']
			self.metrics['average_file_size'] = (
				(current_avg * (total_docs - 1) + result.file_size) / total_docs
			)
		
		if result.render_successful:
			success_count = getattr(self, '_success_count', 0) + 1
			setattr(self, '_success_count', success_count)
		else:
			self.metrics['error_count'] += 1
		
		self.metrics['success_rate'] = (
			getattr(self, '_success_count', 0) / self.metrics['documents_rendered']
		)
	
	def get_content_for_format(
		self,
		content: UnifiedDocumentContent,
		preferred_format: str = "html"
	) -> str:
		"""
		Extract content in the preferred format with fallbacks.
		
		Args:
			content: Document content
			preferred_format: Preferred content format (html, markdown, text, latex)
			
		Returns:
			Content string in the best available format
		"""
		format_priority = {
			"html": ["content_html", "content_markdown", "content_text"],
			"markdown": ["content_markdown", "content_html", "content_text"],
			"text": ["content_text", "content_markdown", "content_html"],
			"latex": ["content_latex", "content_html", "content_markdown", "content_text"]
		}
		
		priority_list = format_priority.get(preferred_format, ["content_html", "content_text"])
		
		for format_attr in priority_list:
			content_value = getattr(content, format_attr, "")
			if content_value.strip():
				return content_value
		
		# Final fallback
		return content.title if content.title else "Untitled Document"

# ============================================================================
# Renderer Factory and Registry
# ============================================================================

class RendererRegistry:
	"""Registry for managing available renderers"""
	
	def __init__(self):
		self._renderers: Dict[str, type] = {}
	
	def register(self, format_name: str, renderer_class: type):
		"""Register a renderer for a specific format"""
		if not issubclass(renderer_class, BaseRenderer):
			raise ValueError(f"Renderer must inherit from BaseRenderer")
		self._renderers[format_name.lower()] = renderer_class
	
	def get_renderer(
		self,
		format_name: str,
		config: Optional[UnifiedRenderConfiguration] = None
	) -> BaseRenderer:
		"""Get a renderer instance for the specified format"""
		format_name = format_name.lower()
		if format_name not in self._renderers:
			raise ValueError(f"No renderer registered for format: {format_name}")
		
		renderer_class = self._renderers[format_name]
		return renderer_class(config)
	
	def get_available_formats(self) -> List[str]:
		"""Get list of all available formats"""
		return list(self._renderers.keys())
	
	def is_format_supported(self, format_name: str) -> bool:
		"""Check if a format is supported"""
		return format_name.lower() in self._renderers

# Global renderer registry
renderer_registry = RendererRegistry()

# ============================================================================
# Utility Functions
# ============================================================================

async def render_document(
	content: UnifiedDocumentContent,
	format_name: str,
	output_path: Optional[Union[str, Path]] = None,
	config: Optional[UnifiedRenderConfiguration] = None
) -> UnifiedRenderResult:
	"""
	Convenience function to render a document in the specified format.
	
	Args:
		content: Document content to render
		format_name: Target format (pdf, docx, html, etc.)
		output_path: Optional output file path
		config: Optional render configuration
		
	Returns:
		Render result
	"""
	renderer = renderer_registry.get_renderer(format_name, config)
	return await renderer.render(content, output_path)

async def batch_render_multi_format(
	documents: List[UnifiedDocumentContent],
	formats: List[str],
	output_directory: Union[str, Path],
	config: Optional[UnifiedRenderConfiguration] = None
) -> Dict[str, List[UnifiedRenderResult]]:
	"""
	Render multiple documents in multiple formats.
	
	Args:
		documents: List of documents to render
		formats: List of target formats
		output_directory: Output directory
		config: Optional render configuration
		
	Returns:
		Dictionary mapping format names to lists of render results
	"""
	results = {}
	
	for format_name in formats:
		renderer = renderer_registry.get_renderer(format_name, config)
		format_results = await renderer.batch_render(
			documents, 
			Path(output_directory) / format_name
		)
		results[format_name] = format_results
	
	return results

def create_unified_content_from_html(
	html_content: str,
	title: str = "",
	css_content: str = "",
	metadata: Optional[Dict[str, Any]] = None
) -> UnifiedDocumentContent:
	"""
	Convenience function to create UnifiedDocumentContent from HTML.
	
	Args:
		html_content: HTML content
		title: Document title
		css_content: CSS styles
		metadata: Additional metadata
		
	Returns:
		UnifiedDocumentContent instance
	"""
	return UnifiedDocumentContent(
		title=title,
		content_html=html_content,
		content_css=css_content,
		content_length=len(html_content),
		metadata=metadata or {}
	)

# ============================================================================
# Example Usage
# ============================================================================

if __name__ == "__main__":
	async def main():
		"""Example usage of the unified renderer interface"""
		
		# Create sample content
		content = create_unified_content_from_html(
			html_content="<h1>Test Document</h1><p>This is a test document.</p>",
			title="Test Document",
			css_content="h1 { color: blue; }"
		)
		
		# Create configuration
		config = UnifiedRenderConfiguration(
			output_quality="high",
			accessibility_enabled=True,
			wcag_compliance_level="AA"
		)
		
		logger.info(f"Sample content created with ID: {content.document_id}")
		logger.info(f"Available formats: {renderer_registry.get_available_formats()}")
		logger.info(f"Configuration: {config.output_quality} quality, {config.wcag_compliance_level} compliance")
	
	# Run example
	asyncio.run(main())