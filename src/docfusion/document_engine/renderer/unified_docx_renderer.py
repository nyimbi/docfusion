#!/usr/bin/env python3
"""
Unified DOCX Renderer

DOCX renderer implementing the unified renderer interface for consistent developer experience.
Maintains all existing functionality while providing standardized API.

Features:
- Unified interface implementation with BaseRenderer
- Microsoft Word DOCX generation with python-docx
- Full backward compatibility with existing DOCXRenderer
- Enhanced error handling and metrics
- Standardized configuration and output
"""

import logging
logger = logging.getLogger(__name__)
import io
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Union


# Import unified interface
from .base_renderer import (
	BaseRenderer, 
	UnifiedRenderConfiguration, 
	UnifiedDocumentContent, 
	UnifiedRenderResult,
	RendererException,
	OutputGenerationException
)

# Import existing DOCX renderer components (with safe imports)
try:
	from .docx_renderer import (
		DOCXRenderer as LegacyDOCXRenderer,
		DOCXRenderConfiguration as LegacyDOCXRenderConfiguration,
		DOCXRenderResult,
		FormattedDocumentContent as LegacyFormattedDocumentContent,
	)
except ImportError:
	# Fallback classes if DOCX renderer is not available
	LegacyDOCXRenderer = None
	LegacyDOCXRenderConfiguration = None
	DOCXRenderResult = None
	
	# Create compatible LegacyFormattedDocumentContent
	class LegacyFormattedDocumentContent:
		def __init__(self, title="", content_html="", content_markdown="", content_text="", computed_styles=None):
			self.title = title
			self.content_html = content_html
			self.content_markdown = content_markdown
			self.content_text = content_text
			self.computed_styles = computed_styles or {}


# ============================================================================
# DOCX-Specific Configuration
# ============================================================================

class DOCXRenderConfiguration(UnifiedRenderConfiguration):
	"""DOCX-specific render configuration extending unified interface"""
	
	# Document settings
	template_path: Optional[str] = None  # Custom template file
	document_theme: str = "default"  # Theme name
	
	# Style settings
	default_font: str = "Calibri"  # Default font family
	default_font_size: int = 11  # Default font size in points
	heading_font: str = "Calibri"  # Heading font family
	
	# Layout settings
	page_width: float = 8.5  # Page width in inches
	page_height: float = 11.0  # Page height in inches (Letter size)
	margin_top: float = 1.0  # Top margin in inches
	margin_bottom: float = 1.0  # Bottom margin in inches
	margin_left: float = 1.0  # Left margin in inches
	margin_right: float = 1.0  # Right margin in inches
	
	# Content processing
	preserve_html_structure: bool = True  # Maintain HTML structure
	convert_tables: bool = True  # Convert HTML tables to Word tables
	convert_images: bool = True  # Convert and embed images
	process_hyperlinks: bool = True  # Process hyperlinks
	
	# Header/Footer
	include_header: bool = False
	include_footer: bool = False
	header_text: str = ""
	footer_text: str = ""
	page_numbers: bool = False
	
	# Advanced features
	track_changes: bool = False  # Enable track changes
	comments_enabled: bool = False  # Enable comments
	protection_enabled: bool = False  # Document protection
	password: str = ""  # Protection password
	
	# Compatibility
	compatibility_mode: str = "Word2016"  # Word version compatibility


# ============================================================================
# Unified DOCX Renderer
# ============================================================================

class UnifiedDOCXRenderer(BaseRenderer):
	"""
	DOCX renderer implementing unified interface.
	
	Provides consistent API while maintaining all Microsoft Word document
	generation capabilities including styling, tables, images, and formatting.
	"""
	
	def __init__(
		self, 
		config: Optional[DOCXRenderConfiguration] = None,
		enable_logging: bool = True
	):
		# Initialize with DOCX-specific config
		self.docx_config = config or DOCXRenderConfiguration()
		super().__init__(self.docx_config, enable_logging)
		
		# DOCX-specific version info
		self.version = "2.0.0"  # Unified interface version
	
	def _initialize_renderer(self):
		"""Initialize DOCX-specific components"""
		try:
			# Initialize legacy DOCX renderer for existing functionality
			if LegacyDOCXRenderer and LegacyDOCXRenderConfiguration:
				legacy_config = LegacyDOCXRenderConfiguration(
					default_font_family=self.docx_config.default_font,
					default_font_size=self.docx_config.default_font_size,
				)
				
				self.legacy_renderer = LegacyDOCXRenderer(legacy_config)
			else:
				self.legacy_renderer = None
			
		except Exception as e:
			if self.enable_logging:
				logger.warning(f"Warning: DOCX renderer initialization issue: {e}")
			# Create minimal fallback
			self.legacy_renderer = None
	
	async def render(
		self,
		content: UnifiedDocumentContent,
		output_path: Optional[Union[str, Path]] = None,
		custom_config: Optional[UnifiedRenderConfiguration] = None
	) -> UnifiedRenderResult:
		"""
		Render document to DOCX using unified interface.
		
		Args:
			content: Unified document content
			output_path: Optional output file path
			custom_config: Optional custom configuration
			
		Returns:
			Unified render result with DOCX output
		"""
		start_time = datetime.now()
		config = custom_config or self.config
		
		# Create result object
		result = UnifiedRenderResult(
			document_id=content.document_id,
			renderer_type="UnifiedDOCXRenderer",
			renderer_version=self.version,
			content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		)
		
		try:
			# Validate content
			validation_warnings = await self.validate_content(content)
			result.validation_warnings.extend(validation_warnings)
			
			# Convert unified content to legacy format for compatibility
			legacy_content = self._convert_to_legacy_content(content)
			
			# Generate DOCX document
			docx_data = await self._generate_docx(legacy_content, config)
			
			# Set output content
			result.rendered_content = docx_data
			result.file_size = len(docx_data)
			result.total_size = result.file_size
			
			# Save to file if path provided
			if output_path:
				output_file = Path(output_path)
				output_file.parent.mkdir(parents=True, exist_ok=True)
				
				# Ensure .docx extension
				if output_file.suffix.lower() != '.docx':
					output_file = output_file.with_suffix('.docx')
				
				output_file.write_bytes(docx_data)
				result.output_paths.append(output_file)
			
			# Calculate quality scores
			result.rendering_quality_score = self._calculate_quality_score(content, docx_data)
			result.accessibility_score = self._calculate_accessibility_score(content)
			
			# Set success status
			result.render_successful = True
			result.processing_notes.append("DOCX generated successfully")
			
		except Exception as e:
			result.render_successful = False
			result.validation_errors.append(f"DOCX generation failed: {str(e)}")
			
			if self.enable_logging:
				logger.error(f"DOCX rendering error: {e}")
		
		# Calculate processing time
		end_time = datetime.now()
		result.rendering_time = (end_time - start_time).total_seconds()
		
		# Update metrics
		self._update_metrics(result)
		
		return result
	
	async def _generate_docx(
		self,
		content: LegacyFormattedDocumentContent,
		config: UnifiedRenderConfiguration
	) -> bytes:
		"""Generate DOCX using python-docx"""
		
		try:
			if self.legacy_renderer:
				# Use legacy renderer for document generation
				legacy_result = await self.legacy_renderer.render_docx(content)
				return legacy_result.docx_content
			else:
				# Fallback: create minimal DOCX
				return await self._create_minimal_docx(content)
				
		except Exception as e:
			raise OutputGenerationException(f"DOCX generation failed: {e}") from e
	
	async def _create_minimal_docx(
		self,
		content: LegacyFormattedDocumentContent
	) -> bytes:
		"""Create minimal DOCX document as fallback"""
		try:
			from docx import Document
			
			# Create new document
			doc = Document()
			
			# Add title if available
			if content.title:
				doc.add_heading(content.title, level=1)
			
			# Add content
			if content.content_html:
				# Simple HTML to text conversion for fallback
				import re
				text_content = re.sub(r'<[^>]+>', '', content.content_html)
				doc.add_paragraph(text_content)
			elif content.content_text:
				doc.add_paragraph(content.content_text)
			else:
				doc.add_paragraph("Document content")
			
			# Save to bytes
			docx_buffer = io.BytesIO()
			doc.save(docx_buffer)
			return docx_buffer.getvalue()
			
		except ImportError:
			# python-docx not available, create empty bytes
			raise RendererException("python-docx library not available for DOCX generation")
	
	def _convert_to_legacy_content(
		self,
		content: UnifiedDocumentContent
	) -> LegacyFormattedDocumentContent:
		"""Convert unified content to legacy format for compatibility"""
		
		# Extract best available content formats
		html_content = self.get_content_for_format(content, "html")
		markdown_content = content.content_markdown
		text_content = content.content_text
		
		# Create legacy content object
		legacy_content = LegacyFormattedDocumentContent(
			title=content.title,
			content_html=html_content,
			content_markdown=markdown_content,
			content_text=text_content,
			computed_styles=content.computed_styles
		)
		
		return legacy_content
	
	def _calculate_quality_score(
		self,
		content: UnifiedDocumentContent,
		docx_data: bytes
	) -> float:
		"""Calculate rendering quality score based on content and output"""
		score = 0.8  # Base score
		
		# Content completeness
		if content.title:
			score += 0.05
		if content.content_html:
			score += 0.05
		if content.content_markdown:
			score += 0.03
		if content.sections:
			score += 0.04  # Structured content
		if content.computed_styles:
			score += 0.03  # Styling information
		
		# File size reasonableness (DOCX files are typically larger)
		file_size_kb = len(docx_data) / 1024
		if 15 < file_size_kb < 50000:  # 15KB - 50MB range
			score += 0.02
		
		return min(score, 1.0)
	
	def _calculate_accessibility_score(
		self,
		content: UnifiedDocumentContent
	) -> float:
		"""Calculate accessibility compliance score"""
		score = 0.7  # Base score for DOCX format (generally accessible)
		
		# Check for accessibility indicators
		if content.title:
			score += 0.1  # Document title
		if any(tag in content.content_html for tag in ["<h1>", "<h2>", "<h3>"]):
			score += 0.1  # Heading structure
		if "alt=" in content.content_html:
			score += 0.05  # Alt text present
		if "<table" in content.content_html and "th>" in content.content_html:
			score += 0.05  # Table headers
		
		return min(score, 1.0)
	
	async def _validate_format_specific(
		self,
		content: UnifiedDocumentContent
	) -> List[str]:
		"""DOCX-specific content validation"""
		warnings = []
		
		# Check for DOCX-suitable content
		if not content.content_html and not content.content_markdown and not content.content_text:
			warnings.append("No suitable content available for DOCX generation")
		
		# Check for complex HTML that might not convert well
		complex_elements = ["<canvas>", "<svg>", "<video>", "<audio>", "<iframe>"]
		for element in complex_elements:
			if element in content.content_html:
				warnings.append(f"Complex HTML element {element} may not convert well to DOCX")
		
		# Check for very long content
		total_content_length = len(content.content_html) + len(content.content_text)
		if total_content_length > 1000000:  # 1MB of text
			warnings.append("Very large document - may affect DOCX performance")
		
		return warnings
	
	def get_supported_formats(self) -> List[str]:
		"""Return supported output formats"""
		return ["docx"]
	
	def get_primary_extension(self) -> str:
		"""Return primary file extension"""
		return "docx"
	
	# ============================================================================
	# Backward Compatibility Methods
	# ============================================================================
	
	async def render_docx(
		self,
		formatted_content: Union[LegacyFormattedDocumentContent, UnifiedDocumentContent],
		output_path: Optional[str] = None,
		custom_config: Optional[DOCXRenderConfiguration] = None
	) -> Union[DOCXRenderResult, UnifiedRenderResult]:
		"""
		Backward compatibility method for existing code.
		"""
		
		# Convert legacy input to unified format if needed
		if isinstance(formatted_content, LegacyFormattedDocumentContent):
			unified_content = UnifiedDocumentContent(
				title=formatted_content.title,
				content_html=formatted_content.content_html,
				content_markdown=formatted_content.content_markdown,
				content_text=formatted_content.content_text,
				computed_styles=formatted_content.computed_styles
			)
		else:
			unified_content = formatted_content
		
		# Use unified render method
		unified_result = await self.render(unified_content, output_path, custom_config)
		
		# Convert back to legacy result format for compatibility
		legacy_result = DOCXRenderResult(
			render_successful=unified_result.render_successful,
			document_id=unified_result.document_id,
			docx_content=unified_result.rendered_content,
			file_size=unified_result.file_size,
			rendering_quality_score=unified_result.rendering_quality_score,
			processing_time=unified_result.rendering_time
		)
		
		return legacy_result


# ============================================================================
# Factory Function
# ============================================================================

def create_docx_renderer(
	config: Optional[DOCXRenderConfiguration] = None,
	unified_interface: bool = True
) -> Union[UnifiedDOCXRenderer, LegacyDOCXRenderer]:
	"""
	Factory function to create DOCX renderer.
	
	Args:
		config: DOCX render configuration
		unified_interface: Whether to use unified interface (default: True)
		
	Returns:
		DOCX renderer instance
	"""
	if unified_interface:
		return UnifiedDOCXRenderer(config)
	else:
		# Create legacy renderer with converted config
		if isinstance(config, DOCXRenderConfiguration):
			legacy_config = DOCXRenderConfiguration(
				template_path=config.template_path,
				default_font=config.default_font,
				default_font_size=config.default_font_size
			)
			return LegacyDOCXRenderer(legacy_config)
		else:
			return LegacyDOCXRenderer()


# ============================================================================
# Register with Unified Registry
# ============================================================================

# Auto-register the DOCX renderer with the global registry
from .base_renderer import renderer_registry

renderer_registry.register("docx", UnifiedDOCXRenderer)
