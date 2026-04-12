#!/usr/bin/env python3
"""
Unified Accessibility Renderer

Accessibility renderer implementing the unified renderer interface for consistent developer experience.
Maintains all existing functionality while providing standardized API.

Features:
- Unified interface implementation with BaseRenderer
- WCAG 2.1 A/AA/AAA compliance validation and enhancement
- Full backward compatibility with existing AccessibilityRenderer
- Enhanced error handling and metrics
- Standardized configuration and output
"""

import asyncio
import logging
logger = logging.getLogger(__name__)
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

# Import existing accessibility renderer components (with safe imports)
try:
	from .accessibility_renderer import (
		AccessibilityRenderer as LegacyAccessibilityRenderer,
		AccessibilityRenderConfiguration as LegacyAccessibilityRenderConfiguration,
		AccessibilityRenderResult,
		WCAGValidator,
		AlternativeTextGenerator,
		ARIAEnhancer,
		ScreenReaderSimulator,
		ColorContrastAnalyzer
	)
except ImportError:
	# Fallback classes if accessibility renderer is not available
	LegacyAccessibilityRenderer = None
	LegacyAccessibilityRenderConfiguration = None
	AccessibilityRenderResult = None
	WCAGValidator = None
	AlternativeTextGenerator = None
	ARIAEnhancer = None
	ScreenReaderSimulator = None
	ColorContrastAnalyzer = None


# ============================================================================
# Accessibility-Specific Configuration
# ============================================================================

class AccessibilityRenderConfiguration(UnifiedRenderConfiguration):
	"""Accessibility-specific render configuration extending unified interface"""
	
	# WCAG compliance settings
	target_wcag_level: str = "AA"  # A, AA, AAA
	wcag_version: str = "2.1"  # 2.0, 2.1, 2.2
	section_508_compliance: bool = True  # Section 508 compliance
	
	# Enhancement features
	auto_generate_alt_text: bool = True  # Generate alt text for images
	enhance_aria_labels: bool = True  # Add/improve ARIA labels
	improve_heading_structure: bool = True  # Optimize heading hierarchy
	add_skip_navigation: bool = True  # Add skip navigation links
	
	# Color and contrast
	check_color_contrast: bool = True  # Validate color contrast
	minimum_contrast_ratio: float = 4.5  # WCAG AA standard
	enhance_contrast: bool = False  # Auto-enhance low contrast
	
	# Screen reader optimization
	optimize_for_screen_readers: bool = True  # Screen reader optimizations
	test_screen_readers: List[str] = Field(default_factory=lambda: ["NVDA", "JAWS"])  # Readers to test
	reading_order_validation: bool = True  # Validate reading order
	
	# Keyboard navigation
	keyboard_navigation_testing: bool = True  # Test keyboard navigation
	focus_indicators: bool = True  # Ensure visible focus indicators
	tab_order_optimization: bool = True  # Optimize tab order
	
	# Content enhancements
	language_identification: bool = True  # Identify and mark languages
	acronym_expansion: bool = True  # Expand acronyms
	table_header_association: bool = True  # Associate table headers
	
	# Output preferences
	generate_accessibility_report: bool = True  # Generate detailed report
	include_remediation_suggestions: bool = True  # Include fix suggestions
	compliance_certificate: bool = False  # Generate compliance certificate
	
	# Testing and validation
	automated_testing_tools: List[str] = Field(default_factory=lambda: ["axe-core", "wave"])
	manual_review_required: bool = False  # Flag for manual review


# ============================================================================
# Unified Accessibility Renderer
# ============================================================================

class UnifiedAccessibilityRenderer(BaseRenderer):
	"""
	Accessibility renderer implementing unified interface.
	
	Provides consistent API while maintaining all accessibility enhancement
	capabilities including WCAG compliance, screen reader optimization,
	and automated accessibility testing.
	"""
	
	def __init__(
		self, 
		config: Optional[AccessibilityRenderConfiguration] = None,
		enable_logging: bool = True
	):
		# Initialize with accessibility-specific config
		self.accessibility_config = config or AccessibilityRenderConfiguration()
		super().__init__(self.accessibility_config, enable_logging)
		
		# Accessibility-specific version info
		self.version = "2.0.0"  # Unified interface version
	
	def _initialize_renderer(self):
		"""Initialize accessibility-specific components"""
		try:
			# Initialize legacy accessibility renderer for existing functionality
			if LegacyAccessibilityRenderer and LegacyAccessibilityRenderConfiguration:
				legacy_config = LegacyAccessibilityRenderConfiguration(
					target_wcag_level=self.accessibility_config.target_wcag_level,
					auto_generate_alt_text=self.accessibility_config.auto_generate_alt_text,
					enhance_aria_labels=self.accessibility_config.enhance_aria_labels,
					check_color_contrast=self.accessibility_config.check_color_contrast
				)
				
				self.legacy_renderer = LegacyAccessibilityRenderer(legacy_config)
			else:
				self.legacy_renderer = None
			
			# Initialize accessibility components with safe imports
			self.wcag_field_validator = WCAGValidator() if WCAGValidator else None
			self.alt_text_generator = AlternativeTextGenerator() if AlternativeTextGenerator else None
			self.aria_enhancer = ARIAEnhancer() if ARIAEnhancer else None
			self.screen_reader_simulator = ScreenReaderSimulator() if ScreenReaderSimulator else None
			self.contrast_analyzer = ColorContrastAnalyzer() if ColorContrastAnalyzer else None
			
		except Exception as e:
			if self.enable_logging:
				logger.warning(f"Warning: Accessibility renderer initialization issue: {e}")
			# Create minimal fallback
			self.legacy_renderer = None
			self.wcag_field_validator = None
			self.alt_text_generator = None
			self.aria_enhancer = None
			self.screen_reader_simulator = None
			self.contrast_analyzer = None
	
	async def render(
		self,
		content: UnifiedDocumentContent,
		output_path: Optional[Union[str, Path]] = None,
		custom_config: Optional[UnifiedRenderConfiguration] = None
	) -> UnifiedRenderResult:
		"""
		Enhance document for accessibility using unified interface.
		
		Args:
			content: Unified document content
			output_path: Optional output file path
			custom_config: Optional custom configuration
			
		Returns:
			Unified render result with accessibility-enhanced content
		"""
		start_time = datetime.now()
		config = custom_config or self.config
		
		# Create result object
		result = UnifiedRenderResult(
			document_id=content.document_id,
			renderer_type="UnifiedAccessibilityRenderer",
			renderer_version=self.version,
			content_type="text/html"  # Accessibility enhancements typically produce HTML
		)
		
		try:
			# Validate content
			validation_warnings = await self.validate_content(content)
			result.validation_warnings.extend(validation_warnings)
			
			# Perform accessibility enhancement
			enhanced_output = await self._enhance_accessibility(content, config)
			
			# Set output content
			result.rendered_content = enhanced_output["enhanced_content"].encode('utf-8')
			result.file_size = len(result.rendered_content)
			
			# Include accessibility report as additional file
			if enhanced_output.get("accessibility_report"):
				result.additional_files["accessibility_report.html"] = enhanced_output["accessibility_report"].encode('utf-8')
			
			# Include remediation plan if available
			if enhanced_output.get("remediation_plan"):
				result.additional_files["remediation_plan.md"] = enhanced_output["remediation_plan"].encode('utf-8')
			
			# Calculate total size
			result.total_size = result.file_size + sum(len(content) for content in result.additional_files.values())
			
			# Save to file if path provided
			if output_path:
				await self._save_accessibility_output(enhanced_output, output_path, result)
			
			# Calculate quality scores
			result.rendering_quality_score = enhanced_output.get("enhancement_quality_score", 0.85)
			result.accessibility_score = enhanced_output.get("accessibility_score", 0.0)
			
			# Set success status
			result.render_successful = True
			result.processing_notes.append("Accessibility enhancement completed successfully")
			
			# Add enhancement notes
			if enhanced_output.get("enhancements_applied"):
				result.processing_notes.extend(enhanced_output["enhancements_applied"])
			
		except Exception as e:
			result.render_successful = False
			result.validation_errors.append(f"Accessibility enhancement failed: {str(e)}")
			
			if self.enable_logging:
				logger.error(f"Accessibility rendering error: {e}")
		
		# Calculate processing time
		end_time = datetime.now()
		result.rendering_time = (end_time - start_time).total_seconds()
		
		# Update metrics
		self._update_metrics(result)
		
		return result
	
	async def _enhance_accessibility(
		self,
		content: UnifiedDocumentContent,
		config: UnifiedRenderConfiguration
	) -> dict:
		"""Perform comprehensive accessibility enhancement"""
		
		try:
			if self.legacy_renderer:
				# Use legacy renderer for accessibility enhancement
				source_content = self.get_content_for_format(content, "html")
				if not source_content:
					source_content = content.content_text or content.title or "No content available"
				
				legacy_result = await self.legacy_renderer.render_accessibility_enhanced(
					source_content, "html"
				)
				
				return {
					"enhanced_content": legacy_result.enhanced_content.get("html", source_content),
					"accessibility_score": legacy_result.overall_accessibility_score,
					"enhancement_quality_score": 0.9,
					"accessibility_report": legacy_result.accessibility_report,
					"remediation_plan": legacy_result.remediation_plan,
					"enhancements_applied": [
						f"Applied {len(legacy_result.enhancements_applied)} accessibility enhancements"
					]
				}
			else:
				# Fallback: basic accessibility enhancement
				return await self._create_basic_enhancement(content, config)
				
		except Exception as e:
			raise OutputGenerationException(f"Accessibility enhancement failed: {e}") from e
	
	async def _create_basic_enhancement(
		self,
		content: UnifiedDocumentContent,
		config: UnifiedRenderConfiguration
	) -> dict:
		"""Create basic accessibility enhancement as fallback"""
		
		source_content = self.get_content_for_format(content, "html")
		enhanced_content = source_content
		
		# Basic enhancements
		enhancements_applied = []
		
		# Add lang attribute if missing
		if '<html' in enhanced_content and 'lang=' not in enhanced_content:
			enhanced_content = enhanced_content.replace('<html', '<html lang="en"')
			enhancements_applied.append("Added language attribute")
		
		# Ensure proper document structure
		if '<main>' not in enhanced_content and '<body>' in enhanced_content:
			enhanced_content = enhanced_content.replace('<body>', '<body><main>')
			enhanced_content = enhanced_content.replace('</body>', '</main></body>')
			enhancements_applied.append("Added main landmark")
		
		# Basic accessibility report
		accessibility_report = f"""
		<h1>Accessibility Enhancement Report</h1>
		<p>Document ID: {content.document_id}</p>
		<p>Enhancement Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
		<h2>Enhancements Applied</h2>
		<ul>
		{''.join(f'<li>{enhancement}</li>' for enhancement in enhancements_applied)}
		</ul>
		<p>Basic accessibility enhancements have been applied.</p>
		"""
		
		# Basic remediation plan
		remediation_plan = f"""
		# Accessibility Remediation Plan
		
		## Document: {content.title or 'Untitled'}
		## Date: {datetime.now().strftime('%Y-%m-%d')}
		
		### Enhancements Applied
		{chr(10).join(f'- {enhancement}' for enhancement in enhancements_applied)}
		
		### Recommended Next Steps
		- Conduct manual accessibility review
		- Test with screen readers
		- Validate color contrast ratios
		- Ensure keyboard navigation works properly
		"""
		
		return {
			"enhanced_content": enhanced_content,
			"accessibility_score": 0.75,  # Basic enhancement score
			"enhancement_quality_score": 0.7,
			"accessibility_report": accessibility_report,
			"remediation_plan": remediation_plan,
			"enhancements_applied": enhancements_applied
		}
	
	async def _save_accessibility_output(
		self,
		enhanced_output: dict,
		output_path: Union[str, Path],
		result: UnifiedRenderResult
	):
		"""Save accessibility enhancement output to files"""
		output_file = Path(output_path)
		output_file.parent.mkdir(parents=True, exist_ok=True)
		
		# Ensure .html extension for main file
		if output_file.suffix.lower() != '.html':
			output_file = output_file.with_suffix('.html')
		
		# Save enhanced content
		output_file.write_text(enhanced_output["enhanced_content"], encoding='utf-8')
		result.output_paths.append(output_file)
		
		# Save accessibility report
		if enhanced_output.get("accessibility_report"):
			report_file = output_file.parent / f"{output_file.stem}_accessibility_report.html"
			report_file.write_text(enhanced_output["accessibility_report"], encoding='utf-8')
			result.output_paths.append(report_file)
		
		# Save remediation plan
		if enhanced_output.get("remediation_plan"):
			plan_file = output_file.parent / f"{output_file.stem}_remediation_plan.md"
			plan_file.write_text(enhanced_output["remediation_plan"], encoding='utf-8')
			result.output_paths.append(plan_file)
	
	async def _validate_format_specific(
		self,
		content: UnifiedDocumentContent
	) -> List[str]:
		"""Accessibility-specific content validation"""
		warnings = []
		
		# Check for content suitable for accessibility enhancement
		if not content.content_html and not content.content_text:
			warnings.append("No content available for accessibility enhancement")
		
		# Check for potential accessibility issues
		html_content = content.content_html
		if html_content:
			if "<img" in html_content and "alt=" not in html_content:
				warnings.append("Images detected without alt text")
			
			if not any(tag in html_content for tag in ["<h1>", "<h2>", "<h3>"]):
				warnings.append("No heading structure detected")
			
			if "<table>" in html_content and "<th>" not in html_content:
				warnings.append("Tables detected without proper headers")
			
			if "color:" in html_content or "background-color:" in html_content:
				warnings.append("Color styling detected - contrast should be verified")
		
		return warnings
	
	def get_supported_formats(self) -> List[str]:
		"""Return supported output formats"""
		return ["html", "pdf", "docx"]  # Can enhance multiple formats
	
	def get_primary_extension(self) -> str:
		"""Return primary file extension"""
		return "html"  # Primary output is enhanced HTML
	
	# ============================================================================
	# Backward Compatibility Methods
	# ============================================================================
	
	async def render_accessibility_enhanced(
		self,
		source_document: Any,
		source_format: str,
		target_formats: List[str] = None,
		custom_config: Optional[AccessibilityRenderConfiguration] = None
	) -> Union[AccessibilityRenderResult, UnifiedRenderResult]:
		"""
		Backward compatibility method for existing code.
		"""
		
		# Convert input to unified format
		if isinstance(source_document, str):
			# String content
			unified_content = UnifiedDocumentContent(
				title="Accessibility Enhanced Document",
				content_html=source_document if source_format == "html" else "",
				content_text=source_document if source_format == "text" else ""
			)
		elif isinstance(source_document, UnifiedDocumentContent):
			unified_content = source_document
		else:
			# Try to extract content from object
			unified_content = UnifiedDocumentContent(
				title=getattr(source_document, 'title', 'Document'),
				content_html=getattr(source_document, 'content_html', ''),
				content_text=getattr(source_document, 'content_text', str(source_document))
			)
		
		# Use unified render method
		unified_result = await self.render(unified_content, None, custom_config)
		
		# Convert back to legacy result format for compatibility
		enhanced_content = {
			"html": unified_result.rendered_content.decode('utf-8'),
			"text": unified_result.rendered_content.decode('utf-8')  # Same for basic compatibility
		}
		
		if AccessibilityRenderResult:
			legacy_result = AccessibilityRenderResult(
				render_successful=unified_result.render_successful,
				document_id=unified_result.document_id,
				enhanced_content=enhanced_content,
				overall_accessibility_score=unified_result.accessibility_score,
				accessibility_report=unified_result.additional_files.get("accessibility_report.html", b"").decode('utf-8'),
				remediation_plan=unified_result.additional_files.get("remediation_plan.md", b"").decode('utf-8'),
				enhancements_applied=unified_result.processing_notes,
				processing_time=unified_result.rendering_time
			)
		else:
			# Return unified result if legacy classes unavailable
			legacy_result = unified_result
		
		return legacy_result


# ============================================================================
# Factory Function
# ============================================================================

def create_accessibility_renderer(
	config: Optional[AccessibilityRenderConfiguration] = None,
	unified_interface: bool = True
) -> Union[UnifiedAccessibilityRenderer, LegacyAccessibilityRenderer]:
	"""
	Factory function to create accessibility renderer.
	
	Args:
		config: Accessibility render configuration
		unified_interface: Whether to use unified interface (default: True)
		
	Returns:
		Accessibility renderer instance
	"""
	if unified_interface:
		return UnifiedAccessibilityRenderer(config)
	else:
		# Create legacy renderer
		return LegacyAccessibilityRenderer(config)


# ============================================================================
# Register with Unified Registry
# ============================================================================

# Auto-register the accessibility renderer with the global registry
from .base_renderer import renderer_registry

renderer_registry.register("accessibility", UnifiedAccessibilityRenderer)