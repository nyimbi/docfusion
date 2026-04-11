#!/usr/bin/env python3
"""
Unified HTML Renderer

HTML renderer implementing the unified renderer interface for consistent developer experience.
Maintains all existing functionality while providing standardized API.

Features:
- Unified interface implementation with BaseRenderer
- Web-optimized HTML5 generation with responsive CSS
- Full backward compatibility with existing HTMLRenderer
- Enhanced error handling and metrics
- Standardized configuration and output
"""

import asyncio
import logging
logger = logging.getLogger(__name__)
import json
from datetime import datetime
from pathlib import Path
from typing import Any, List, Optional, Union

from pydantic import Field, ConfigDict

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

# Import existing HTML renderer components (with safe imports)
try:
	from .html_renderer import (
		HTMLRenderer as LegacyHTMLRenderer,
		HTMLRenderConfiguration as LegacyHTMLRenderConfiguration,
		HTMLRenderResult,
		FormattedDocumentContent as LegacyFormattedDocumentContent,
		HTMLGenerator,
		CSSProcessor,
		JavaScriptEnhancer,
		ResponsiveDesignProcessor
	)
except ImportError:
	# Fallback classes if HTML renderer is not available
	LegacyHTMLRenderer = None
	LegacyHTMLRenderConfiguration = None
	HTMLRenderResult = None
	HTMLGenerator = None
	CSSProcessor = None
	JavaScriptEnhancer = None
	ResponsiveDesignProcessor = None
	
	# Create compatible LegacyFormattedDocumentContent
	class LegacyFormattedDocumentContent:
		def __init__(self, title="", content_html="", content_text="", computed_styles=None):
			self.title = title
			self.content_html = content_html
			self.content_text = content_text
			self.computed_styles = computed_styles or {}


# ============================================================================
# HTML-Specific Configuration
# ============================================================================

class HTMLRenderConfiguration(UnifiedRenderConfiguration):
	"""HTML-specific render configuration extending unified interface"""
	
	# HTML generation settings
	html_version: str = "HTML5"  # HTML version
	semantic_markup: bool = True  # Use semantic HTML5 elements
	minify_html: bool = False  # Minify HTML output
	
	# CSS settings
	include_css: bool = True  # Include CSS in output
	inline_css: bool = False  # Inline CSS vs external file
	responsive_design: bool = True  # Generate responsive CSS
	css_framework: str = "custom"  # CSS framework (bootstrap, custom, none)
	
	# JavaScript settings
	include_javascript: bool = False  # Include JavaScript enhancements
	interactive_elements: bool = False  # Add interactive features
	analytics_code: str = ""  # Analytics tracking code
	
	# Responsive design
	mobile_optimized: bool = True  # Mobile optimization
	tablet_breakpoint: int = 768  # Tablet breakpoint in pixels
	desktop_breakpoint: int = 1024  # Desktop breakpoint in pixels
	
	# SEO and metadata
	include_meta_tags: bool = True  # Include SEO meta tags
	meta_description: str = ""  # Meta description
	meta_keywords: List[str] = Field(default_factory=list)  # Meta keywords
	open_graph_enabled: bool = True  # Open Graph meta tags
	
	# Accessibility enhancements
	aria_labels: bool = True  # Include ARIA labels
	skip_navigation: bool = True  # Skip navigation link
	high_contrast_support: bool = False  # High contrast mode support
	
	# Performance
	lazy_loading: bool = True  # Lazy load images
	compress_images: bool = True  # Compress embedded images
	preload_critical_resources: bool = True  # Preload critical CSS/fonts
	
	# Output structure
	single_file: bool = True  # Single HTML file vs multiple files
	external_assets_dir: str = "assets"  # Directory for external assets


# ============================================================================
# Unified HTML Renderer
# ============================================================================

class UnifiedHTMLRenderer(BaseRenderer):
	"""
	HTML renderer implementing unified interface.
	
	Provides consistent API while maintaining all web-optimized HTML generation
	capabilities including responsive design, accessibility, and SEO optimization.
	"""
	
	def __init__(
		self, 
		config: Optional[HTMLRenderConfiguration] = None,
		enable_logging: bool = True
	):
		# Initialize with HTML-specific config
		self.html_config = config or HTMLRenderConfiguration()
		super().__init__(self.html_config, enable_logging)
		
		# HTML-specific version info
		self.version = "2.0.0"  # Unified interface version
	
	def _initialize_renderer(self):
		"""Initialize HTML-specific components"""
		try:
			# Initialize legacy HTML renderer for existing functionality
			if LegacyHTMLRenderer and LegacyHTMLRenderConfiguration:
				legacy_config = LegacyHTMLRenderConfiguration(
					html_version=self.html_config.html_version,
					semantic_markup=self.html_config.semantic_markup,
					responsive_design=self.html_config.responsive_design,
					mobile_optimized=self.html_config.mobile_optimized
				)
				
				self.legacy_renderer = LegacyHTMLRenderer(legacy_config)
			else:
				self.legacy_renderer = None
			
			# Initialize processors with safe imports
			self.html_generator = HTMLGenerator() if HTMLGenerator else None
			self.css_processor = CSSProcessor() if CSSProcessor else None
			self.js_enhancer = JavaScriptEnhancer() if JavaScriptEnhancer else None
			self.responsive_processor = ResponsiveDesignProcessor() if ResponsiveDesignProcessor else None
			
		except Exception as e:
			if self.enable_logging:
				logger.warning(f"Warning: HTML renderer initialization issue: {e}")
			# Create minimal fallback
			self.legacy_renderer = None
			self.html_generator = None
			self.css_processor = None
			self.js_enhancer = None
			self.responsive_processor = None
	
	async def render(
		self,
		content: UnifiedDocumentContent,
		output_path: Optional[Union[str, Path]] = None,
		custom_config: Optional[UnifiedRenderConfiguration] = None
	) -> UnifiedRenderResult:
		"""
		Render document to HTML using unified interface.
		
		Args:
			content: Unified document content
			output_path: Optional output file path
			custom_config: Optional custom configuration
			
		Returns:
			Unified render result with HTML output
		"""
		start_time = datetime.now()
		config = custom_config or self.config
		
		# Create result object
		result = UnifiedRenderResult(
			document_id=content.document_id,
			renderer_type="UnifiedHTMLRenderer",
			renderer_version=self.version,
			content_type="text/html"
		)
		
		try:
			# Validate content
			validation_warnings = await self.validate_content(content)
			result.validation_warnings.extend(validation_warnings)
			
			# Convert unified content to legacy format for compatibility
			legacy_content = self._convert_to_legacy_content(content)
			
			# Generate HTML document and assets
			html_output = await self._generate_html(legacy_content, config)
			
			# Set output content
			result.rendered_content = html_output["html"].encode('utf-8')
			result.file_size = len(result.rendered_content)
			
			# Handle additional files (CSS, JS, images)
			if html_output.get("css"):
				result.additional_files["styles.css"] = html_output["css"].encode('utf-8')
			if html_output.get("javascript"):
				result.additional_files["scripts.js"] = html_output["javascript"].encode('utf-8')
			
			# Calculate total size
			result.total_size = result.file_size + sum(len(content) for content in result.additional_files.values())
			
			# Save to file if path provided
			if output_path:
				await self._save_html_output(html_output, output_path, result)
			
			# Calculate quality scores
			result.rendering_quality_score = self._calculate_quality_score(content, html_output)
			result.accessibility_score = self._calculate_accessibility_score(content, html_output)
			
			# Set success status
			result.render_successful = True
			result.processing_notes.append("HTML generated successfully")
			
		except Exception as e:
			result.render_successful = False
			result.validation_errors.append(f"HTML generation failed: {str(e)}")
			
			if self.enable_logging:
				logger.error(f"HTML rendering error: {e}")
		
		# Calculate processing time
		end_time = datetime.now()
		result.rendering_time = (end_time - start_time).total_seconds()
		
		# Update metrics
		self._update_metrics(result)
		
		return result
	
	async def _generate_html(
		self,
		content: LegacyFormattedDocumentContent,
		config: UnifiedRenderConfiguration
	) -> dict:
		"""Generate HTML document and associated assets"""
		
		try:
			if self.legacy_renderer:
				# Use legacy renderer for HTML generation
				legacy_result = await self.legacy_renderer.render_html(content)
				return {
					"html": legacy_result.html_content,
					"css": legacy_result.css_content,
					"javascript": legacy_result.javascript_content
				}
			else:
				# Fallback: create minimal HTML
				return await self._create_minimal_html(content, config)
				
		except Exception as e:
			raise OutputGenerationException(f"HTML generation failed: {e}") from e
	
	async def _create_minimal_html(
		self,
		content: LegacyFormattedDocumentContent,
		config: UnifiedRenderConfiguration
	) -> dict:
		"""Create minimal HTML document as fallback"""
		
		# Generate basic HTML structure
		html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{content.title or 'Document'}</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            margin: 40px;
            color: #333;
        }}
        h1, h2, h3 {{
            color: #2c3e50;
        }}
        .container {{
            max-width: 800px;
            margin: 0 auto;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{content.title or 'Document'}</h1>
        <div class="content">
            {content.content_html or content.content_text or 'No content available'}
        </div>
    </div>
</body>
</html>"""
		
		# Generate basic CSS
		css_content = """
/* Basic responsive styles */
body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    margin: 40px;
    color: #333;
}

.container {
    max-width: 800px;
    margin: 0 auto;
}

@media (max-width: 768px) {
    body {
        margin: 20px;
    }
    
    .container {
        max-width: 100%;
    }
}
"""
		
		return {
			"html": html_content,
			"css": css_content if not isinstance(config, HTMLRenderConfiguration) or not config.inline_css else "",
			"javascript": ""
		}
	
	async def _save_html_output(
		self,
		html_output: dict,
		output_path: Union[str, Path],
		result: UnifiedRenderResult
	):
		"""Save HTML output to files"""
		output_file = Path(output_path)
		output_file.parent.mkdir(parents=True, exist_ok=True)
		
		# Ensure .html extension
		if output_file.suffix.lower() != '.html':
			output_file = output_file.with_suffix('.html')
		
		# Save main HTML file
		output_file.write_text(html_output["html"], encoding='utf-8')
		result.output_paths.append(output_file)
		
		# Save additional files if not inlined
		if isinstance(self.config, HTMLRenderConfiguration) and not self.config.single_file:
			# Save CSS file
			if html_output.get("css"):
				css_file = output_file.with_suffix('.css')
				css_file.write_text(html_output["css"], encoding='utf-8')
				result.output_paths.append(css_file)
			
			# Save JavaScript file
			if html_output.get("javascript"):
				js_file = output_file.with_suffix('.js')
				js_file.write_text(html_output["javascript"], encoding='utf-8')
				result.output_paths.append(js_file)
	
	def _convert_to_legacy_content(
		self,
		content: UnifiedDocumentContent
	) -> LegacyFormattedDocumentContent:
		"""Convert unified content to legacy format for compatibility"""
		
		# Extract best available content formats
		html_content = self.get_content_for_format(content, "html")
		text_content = content.content_text
		
		# Create legacy content object
		legacy_content = LegacyFormattedDocumentContent(
			title=content.title,
			content_html=html_content,
			content_text=text_content,
			computed_styles=content.computed_styles
		)
		
		return legacy_content
	
	def _calculate_quality_score(
		self,
		content: UnifiedDocumentContent,
		html_output: dict
	) -> float:
		"""Calculate rendering quality score based on content and output"""
		score = 0.8  # Base score
		
		# Content completeness
		if content.title:
			score += 0.05
		if content.content_html:
			score += 0.05
		if html_output.get("css"):
			score += 0.05  # Has CSS styling
		
		# HTML quality indicators
		html_content = html_output.get("html", "")
		if "<!DOCTYPE html>" in html_content:
			score += 0.02  # Proper DOCTYPE
		if 'lang="' in html_content:
			score += 0.02  # Language specified
		if "viewport" in html_content:
			score += 0.02  # Mobile viewport
		if any(tag in html_content for tag in ["<header>", "<main>", "<article>", "<section>"]):
			score += 0.03  # Semantic HTML5
		
		return min(score, 1.0)
	
	def _calculate_accessibility_score(
		self,
		content: UnifiedDocumentContent,
		html_output: dict
	) -> float:
		"""Calculate accessibility compliance score"""
		score = 0.8  # Base score for HTML format (inherently accessible)
		
		html_content = html_output.get("html", "")
		
		# Check for accessibility indicators
		if content.title:
			score += 0.05  # Document title
		if "alt=" in html_content:
			score += 0.05  # Alt text present
		if any(tag in html_content for tag in ["<h1>", "<h2>", "<h3>"]):
			score += 0.05  # Heading structure
		if 'role="' in html_content or 'aria-' in html_content:
			score += 0.03  # ARIA attributes
		if "<nav>" in html_content:
			score += 0.02  # Navigation landmarks
		
		return min(score, 1.0)
	
	async def _validate_format_specific(
		self,
		content: UnifiedDocumentContent
	) -> List[str]:
		"""HTML-specific content validation"""
		warnings = []
		
		# Check for HTML-suitable content
		if not content.content_html and not content.content_text:
			warnings.append("No suitable content available for HTML generation")
		
		# Check for potentially problematic elements
		if "<script>" in content.content_html:
			warnings.append("Inline scripts detected - may be removed for security")
		
		# Check for external dependencies
		if "src=" in content.content_html and "http" in content.content_html:
			warnings.append("External resources detected - may not load in offline viewing")
		
		# Check for very large content
		if len(content.content_html) > 5000000:  # 5MB
			warnings.append("Very large HTML content - may affect browser performance")
		
		return warnings
	
	def get_supported_formats(self) -> List[str]:
		"""Return supported output formats"""
		return ["html"]
	
	def get_primary_extension(self) -> str:
		"""Return primary file extension"""
		return "html"
	
	# ============================================================================
	# Backward Compatibility Methods
	# ============================================================================
	
	async def render_html(
		self,
		formatted_content: Union[LegacyFormattedDocumentContent, UnifiedDocumentContent],
		output_path: Optional[str] = None,
		custom_config: Optional[HTMLRenderConfiguration] = None
	) -> Union[HTMLRenderResult, UnifiedRenderResult]:
		"""
		Backward compatibility method for existing code.
		"""
		
		# Convert legacy input to unified format if needed
		if isinstance(formatted_content, LegacyFormattedDocumentContent):
			unified_content = UnifiedDocumentContent(
				title=formatted_content.title,
				content_html=formatted_content.content_html,
				content_text=formatted_content.content_text,
				computed_styles=formatted_content.computed_styles
			)
		else:
			unified_content = formatted_content
		
		# Use unified render method
		unified_result = await self.render(unified_content, output_path, custom_config)
		
		# Convert back to legacy result format for compatibility
		legacy_result = HTMLRenderResult(
			render_successful=unified_result.render_successful,
			document_id=unified_result.document_id,
			html_content=unified_result.rendered_content.decode('utf-8'),
			css_content=unified_result.additional_files.get("styles.css", b"").decode('utf-8'),
			javascript_content=unified_result.additional_files.get("scripts.js", b"").decode('utf-8'),
			file_size=unified_result.file_size,
			rendering_quality_score=unified_result.rendering_quality_score,
			processing_time=unified_result.rendering_time
		)
		
		return legacy_result


# ============================================================================
# Factory Function
# ============================================================================

def create_html_renderer(
	config: Optional[HTMLRenderConfiguration] = None,
	unified_interface: bool = True
) -> Union[UnifiedHTMLRenderer, LegacyHTMLRenderer]:
	"""
	Factory function to create HTML renderer.
	
	Args:
		config: HTML render configuration
		unified_interface: Whether to use unified interface (default: True)
		
	Returns:
		HTML renderer instance
	"""
	if unified_interface:
		return UnifiedHTMLRenderer(config)
	else:
		# Create legacy renderer with converted config
		if isinstance(config, HTMLRenderConfiguration):
			legacy_config = HTMLRenderConfiguration(
				html_version=config.html_version,
				semantic_markup=config.semantic_markup,
				responsive_design=config.responsive_design
			)
			return LegacyHTMLRenderer(legacy_config)
		else:
			return LegacyHTMLRenderer()


# ============================================================================
# Register with Unified Registry
# ============================================================================

# Auto-register the HTML renderer with the global registry
from .base_renderer import renderer_registry

renderer_registry.register("html", UnifiedHTMLRenderer)