#!/usr/bin/env python3
"""
Unified PDF Renderer

PDF renderer implementing the unified renderer interface for consistent developer experience.
Maintains all existing functionality while providing standardized API.

Features:
- Unified interface implementation with BaseRenderer
- LaTeX-first generation with WeasyPrint fallback
- Full backward compatibility with existing PDFRenderer
- Enhanced error handling and metrics
- Standardized configuration and output
"""

import asyncio
import base64
import io
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, List, Optional, Union

from pydantic import Field, ConfigDict
from pydantic.dataclasses import dataclass

# Import unified interface
from .base_renderer import (
	BaseRenderer, 
	UnifiedRenderConfiguration, 
	UnifiedDocumentContent, 
	UnifiedRenderResult,
	RendererException,
	ContentProcessingException,
	OutputGenerationException
)

# Import existing PDF renderer components (with safe imports)
try:
	from .pdf_renderer import (
		PDFRenderer as LegacyPDFRenderer,
		PDFRenderConfiguration as LegacyPDFRenderConfiguration,
		PDFRenderResult,
		PageMargins,
		PDFMetadata
	)
	# Try to import optional components
	try:
		from .pdf_renderer import LaTeXRenderer, WeasyPrintRenderer
	except ImportError:
		LaTeXRenderer = None
		WeasyPrintRenderer = None
		
	# Create compatible FormattedDocumentContent
	class LegacyFormattedDocumentContent:
		def __init__(self, title="", content_html="", content_css="", content_latex="", latex_assets=None):
			self.title = title
			self.content_html = content_html
			self.content_css = content_css
			self.content_latex = content_latex
			self.latex_assets = latex_assets or {}
			
except ImportError:
	# Fallback classes if PDF renderer is not available
	LegacyPDFRenderer = None
	LegacyPDFRenderConfiguration = None
	PDFRenderResult = None
	PageMargins = None
	PDFMetadata = None
	LaTeXRenderer = None
	WeasyPrintRenderer = None
	
	class LegacyFormattedDocumentContent:
		def __init__(self, title="", content_html="", content_css="", content_latex="", latex_assets=None):
			self.title = title
			self.content_html = content_html
			self.content_css = content_css
			self.content_latex = content_latex
			self.latex_assets = latex_assets or {}


# ============================================================================
# PDF-Specific Configuration
# ============================================================================

class PDFRenderConfiguration(UnifiedRenderConfiguration):
	"""PDF-specific render configuration extending unified interface"""
	
	# PDF-specific settings
	pdf_version: str = "1.7"  # PDF version
	pdf_a_compliance: bool = False  # PDF/A archival compliance
	compression_level: int = 6  # 0-9, higher = smaller files
	
	# LaTeX rendering settings
	latex_engine: str = "pdflatex"  # pdflatex, xelatex, lualatex
	latex_packages: List[str] = Field(default_factory=lambda: ["geometry", "graphicx", "hyperref"])
	enable_latex_fallback: bool = True  # Fall back to WeasyPrint if LaTeX fails
	
	# Page settings
	page_margins: PageMargins = Field(default_factory=PageMargins)
	header_enabled: bool = True
	footer_enabled: bool = True
	
	# Security settings
	password_protection: bool = False
	owner_password: str = ""
	user_password: str = ""
	allow_printing: bool = True
	allow_copying: bool = True
	allow_modification: bool = True
	
	# Quality settings
	dpi: int = 300  # Output DPI
	image_quality: int = 85  # JPEG quality 0-100
	font_embedding: bool = True
	
	# Metadata
	author: str = ""
	subject: str = ""
	keywords: List[str] = Field(default_factory=list)
	creator: str = "DocuFusion PDF Renderer"


# ============================================================================
# Unified PDF Renderer
# ============================================================================

class UnifiedPDFRenderer(BaseRenderer):
	"""
	PDF renderer implementing unified interface with LaTeX-first approach.
	
	Provides consistent API while maintaining all advanced PDF generation
	capabilities including LaTeX rendering, security features, and accessibility.
	"""
	
	def __init__(
		self, 
		config: Optional[PDFRenderConfiguration] = None,
		enable_logging: bool = True
	):
		# Initialize with PDF-specific config
		self.pdf_config = config or PDFRenderConfiguration()
		super().__init__(self.pdf_config, enable_logging)
		
		# PDF-specific version info
		self.version = "2.0.0"  # Unified interface version
	
	def _initialize_renderer(self):
		"""Initialize PDF-specific components"""
		try:
			# Initialize legacy PDF renderer for existing functionality
			legacy_config = PDFRenderConfiguration(
				pdf_version=self.pdf_config.pdf_version,
				compression_level=self.pdf_config.compression_level,
				dpi=self.pdf_config.dpi,
				image_quality=self.pdf_config.image_quality,
				font_embedding=self.pdf_config.font_embedding
			)
			
			self.legacy_renderer = LegacyPDFRenderer(legacy_config)
			
			# Initialize LaTeX and WeasyPrint renderers
			self.latex_renderer = LaTeXRenderer()
			self.weasyprint_renderer = WeasyPrintRenderer()
			
		except Exception as e:
			if self.enable_logging:
				print(f"Warning: PDF renderer initialization issue: {e}")
			# Create minimal fallback
			self.legacy_renderer = None
			self.latex_renderer = None
			self.weasyprint_renderer = None
	
	async def render(
		self,
		content: UnifiedDocumentContent,
		output_path: Optional[Union[str, Path]] = None,
		custom_config: Optional[UnifiedRenderConfiguration] = None
	) -> UnifiedRenderResult:
		"""
		Render document to PDF using unified interface.
		
		Args:
			content: Unified document content
			output_path: Optional output file path
			custom_config: Optional custom configuration
			
		Returns:
			Unified render result with PDF output
		"""
		start_time = datetime.now()
		config = custom_config or self.config
		
		# Create result object
		result = UnifiedRenderResult(
			document_id=content.document_id,
			renderer_type="UnifiedPDFRenderer",
			renderer_version=self.version,
			content_type="application/pdf"
		)
		
		try:
			# Validate content
			validation_warnings = await self.validate_content(content)
			result.validation_warnings.extend(validation_warnings)
			
			# Convert unified content to legacy format for compatibility
			legacy_content = self._convert_to_legacy_content(content)
			
			# Attempt PDF generation with LaTeX first, then WeasyPrint fallback
			pdf_data = await self._generate_pdf(legacy_content, config)
			
			# Set output content
			result.rendered_content = pdf_data
			result.file_size = len(pdf_data)
			result.total_size = result.file_size
			
			# Save to file if path provided
			if output_path:
				output_file = Path(output_path)
				output_file.parent.mkdir(parents=True, exist_ok=True)
				
				# Ensure .pdf extension
				if output_file.suffix.lower() != '.pdf':
					output_file = output_file.with_suffix('.pdf')
				
				output_file.write_bytes(pdf_data)
				result.output_paths.append(output_file)
			
			# Calculate quality scores
			result.rendering_quality_score = self._calculate_quality_score(content, pdf_data)
			result.accessibility_score = self._calculate_accessibility_score(content)
			
			# Set success status
			result.render_successful = True
			result.processing_notes.append("PDF generated successfully")
			
		except Exception as e:
			result.render_successful = False
			result.validation_errors.append(f"PDF generation failed: {str(e)}")
			
			if self.enable_logging:
				print(f"PDF rendering error: {e}")
		
		# Calculate processing time
		end_time = datetime.now()
		result.rendering_time = (end_time - start_time).total_seconds()
		
		# Update metrics
		self._update_metrics(result)
		
		return result
	
	async def _generate_pdf(
		self,
		content: LegacyFormattedDocumentContent,
		config: UnifiedRenderConfiguration
	) -> bytes:
		"""Generate PDF using LaTeX-first approach with WeasyPrint fallback"""
		
		# Try LaTeX first if content available and enabled
		if (content.content_latex and 
			isinstance(config, PDFRenderConfiguration) and 
			config.enable_latex_fallback and 
			self.latex_renderer):
			
			try:
				latex_result = await self.latex_renderer.render_latex_to_pdf(
					content.content_latex,
					assets=content.latex_assets
				)
				return latex_result.pdf_content
			except Exception as e:
				if self.enable_logging:
					print(f"LaTeX rendering failed, falling back to WeasyPrint: {e}")
		
		# Fallback to WeasyPrint using HTML content
		if self.weasyprint_renderer:
			try:
				weasyprint_result = await self.weasyprint_renderer.render_html_to_pdf(
					content.content_html,
					css_content=content.content_css
				)
				return weasyprint_result.pdf_content
			except Exception as e:
				if self.enable_logging:
					print(f"WeasyPrint rendering failed: {e}")
				raise ContentProcessingException(f"Both LaTeX and WeasyPrint rendering failed: {e}")
		
		# Final fallback: use legacy renderer if available
		if self.legacy_renderer:
			try:
				legacy_result = await self.legacy_renderer.render_pdf(content)
				return legacy_result.pdf_content
			except Exception as e:
				raise OutputGenerationException(f"All PDF rendering methods failed: {e}")
		
		# No renderers available
		raise RendererException("No PDF rendering engines available")
	
	def _convert_to_legacy_content(
		self,
		content: UnifiedDocumentContent
	) -> LegacyFormattedDocumentContent:
		"""Convert unified content to legacy format for compatibility"""
		
		# Extract best available content formats
		html_content = self.get_content_for_format(content, "html")
		latex_content = content.content_latex
		
		# Create legacy content object
		legacy_content = LegacyFormattedDocumentContent(
			title=content.title,
			content_html=html_content,
			content_css=content.content_css,
			content_latex=latex_content,
			latex_assets=content.assets_map
		)
		
		return legacy_content
	
	def _calculate_quality_score(
		self,
		content: UnifiedDocumentContent,
		pdf_data: bytes
	) -> float:
		"""Calculate rendering quality score based on content and output"""
		score = 0.8  # Base score
		
		# Content completeness
		if content.title:
			score += 0.05
		if content.content_html:
			score += 0.05
		if content.content_css:
			score += 0.03
		if content.content_latex:
			score += 0.07  # LaTeX content adds quality
		
		# File size reasonableness (not too small, not too large)
		file_size_kb = len(pdf_data) / 1024
		if 10 < file_size_kb < 10000:  # 10KB - 10MB range
			score += 0.02
		
		return min(score, 1.0)
	
	def _calculate_accessibility_score(
		self,
		content: UnifiedDocumentContent
	) -> float:
		"""Calculate accessibility compliance score"""
		score = 0.6  # Base score for PDF format
		
		# Check for accessibility indicators
		if content.title:
			score += 0.1  # Document title
		if "alt=" in content.content_html:
			score += 0.1  # Alt text present
		if any(tag in content.content_html for tag in ["<h1>", "<h2>", "<h3>"]):
			score += 0.1  # Heading structure
		if self.config.accessibility_enabled:
			score += 0.1  # Accessibility enabled in config
		
		return min(score, 1.0)
	
	async def _validate_format_specific(
		self,
		content: UnifiedDocumentContent
	) -> List[str]:
		"""PDF-specific content validation"""
		warnings = []
		
		# Check for PDF-suitable content
		if not content.content_html and not content.content_latex:
			warnings.append("No HTML or LaTeX content available for PDF generation")
		
		# Check for large images that might cause issues
		for asset_path in content.image_assets.values():
			if len(asset_path) > 100000:  # Base64 or very long path
				warnings.append("Large image assets detected - may affect PDF file size")
				break
		
		# Check for complex CSS that might not render well
		if "position: fixed" in content.content_css:
			warnings.append("Fixed positioning in CSS may not render correctly in PDF")
		
		return warnings
	
	def get_supported_formats(self) -> List[str]:
		"""Return supported output formats"""
		return ["pdf"]
	
	def get_primary_extension(self) -> str:
		"""Return primary file extension"""
		return "pdf"
	
	# ============================================================================
	# Backward Compatibility Methods
	# ============================================================================
	
	async def render_pdf(
		self,
		formatted_content: Union[LegacyFormattedDocumentContent, UnifiedDocumentContent],
		output_path: Optional[str] = None,
		custom_config: Optional[PDFRenderConfiguration] = None
	) -> Union[PDFRenderResult, UnifiedRenderResult]:
		"""
		Backward compatibility method for existing code.
		
		This method provides compatibility with the old PDFRenderer interface
		while leveraging the new unified implementation.
		"""
		
		# Convert legacy input to unified format if needed
		if isinstance(formatted_content, LegacyFormattedDocumentContent):
			unified_content = UnifiedDocumentContent(
				title=formatted_content.title,
				content_html=formatted_content.content_html,
				content_css=formatted_content.content_css,
				content_latex=formatted_content.content_latex,
				assets_map=formatted_content.latex_assets
			)
		else:
			unified_content = formatted_content
		
		# Use unified render method
		unified_result = await self.render(unified_content, output_path, custom_config)
		
		# Convert back to legacy result format for compatibility
		legacy_result = PDFRenderResult(
			render_successful=unified_result.render_successful,
			document_id=unified_result.document_id,
			pdf_content=unified_result.rendered_content,
			file_size=unified_result.file_size,
			rendering_quality_score=unified_result.rendering_quality_score,
			generation_method="unified_renderer",
			latex_compilation_successful=bool(unified_content.content_latex),
			processing_time=unified_result.rendering_time
		)
		
		return legacy_result


# ============================================================================
# Factory Function
# ============================================================================

def create_pdf_renderer(
	config: Optional[PDFRenderConfiguration] = None,
	unified_interface: bool = True
) -> Union[UnifiedPDFRenderer, LegacyPDFRenderer]:
	"""
	Factory function to create PDF renderer.
	
	Args:
		config: PDF render configuration
		unified_interface: Whether to use unified interface (default: True)
		
	Returns:
		PDF renderer instance
	"""
	if unified_interface:
		return UnifiedPDFRenderer(config)
	else:
		# Create legacy renderer with converted config
		if isinstance(config, PDFRenderConfiguration):
			legacy_config = PDFRenderConfiguration(
				pdf_version=config.pdf_version,
				compression_level=config.compression_level,
				dpi=config.dpi
			)
			return LegacyPDFRenderer(legacy_config)
		else:
			return LegacyPDFRenderer()


# ============================================================================
# Register with Unified Registry
# ============================================================================

# Auto-register the PDF renderer with the global registry
from .base_renderer import renderer_registry

renderer_registry.register("pdf", UnifiedPDFRenderer)