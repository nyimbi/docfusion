#!/usr/bin/env python3
"""DocumentFormatter Module - Professional CSS-like Styling Engine

This module provides sophisticated CSS-like styling and formatting capabilities
for DocuFusion documents. The implementation is split across focused modules:

- style_parser: Parse and validate CSS-like style rules
- style_computer: Compute final styles through cascade resolution
- typography_engine: Advanced typography processing
- responsive_engine: Responsive layout adaptation
- output_generator: Format-specific output generation

This module re-exports all public APIs for backward compatibility.
The DocumentFormatter class serves as a facade that delegates to the
specialized modules.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

# Import shared data models and exceptions from centralized module
from ._models import (
	StyleRule,
	ComputedStyle,
	TypographyProfile,
	ResponsiveConfiguration,
	FormattingResult,
	DocumentFormatterException,
	StyleParsingException,
	StyleComputationException,
	TypographyException,
	OutputGenerationException,
)

# Import from split modules (engines only, no duplicated models)
from .style_parser import StyleParser
from .style_computer import (
	StyleComputer,
	SpecificityCalculator,
	InheritanceEngine,
	ValueResolver,
)
from .typography_engine import (
	TypographyEngine,
	FontManager,
	TextProcessor,
	LineBreaker,
)
from .responsive_engine import (
	ResponsiveEngine,
	BreakpointManager,
	LayoutCalculator,
	ContentAnalyzer,
)
from .output_generator import (
	OutputGenerator,
	LaTeXStyleGenerator,
	HTMLStyleGenerator,
	PDFStyleGenerator,
)

logger = logging.getLogger(__name__)


# ============================================================================
# All data models and exceptions are imported from ._models above.
# They are re-exported for backward compatibility via __all__ at the bottom.
# ============================================================================


# ============================================================================
# Main DocumentFormatter Class (Facade)
# ============================================================================

class DocumentFormatter:
	"""
	Main DocumentFormatter class for professional document styling and formatting.

	Provides comprehensive CSS-like styling capabilities with responsive design,
	professional typography, and multi-format output support.

	Delegates to specialized modules:
	- StyleParser: CSS-like rule parsing
	- StyleComputer: Cascade resolution and inheritance
	- TypographyEngine: Typography optimization
	- ResponsiveEngine: Responsive layout adaptation
	- OutputGenerator: Multi-format output generation
	"""

	def __init__(self,
				 default_typography_profile: TypographyProfile | None = None,
				 default_responsive_config: ResponsiveConfiguration | None = None):
		"""Initialize DocumentFormatter with optional default configurations"""
		assert True, "DocumentFormatter initialization"

		# Core components (delegated to split modules)
		self.style_parser = StyleParser()
		self.style_computer = StyleComputer()
		self.typography_engine = TypographyEngine()
		self.responsive_engine = ResponsiveEngine()
		self.output_generator = OutputGenerator()

		# Default configurations
		self.default_typography_profile = default_typography_profile or self._create_default_typography_profile()
		self.default_responsive_config = default_responsive_config or self._create_default_responsive_config()

		# Caching and performance
		self.document_cache: dict[str, FormattingResult] = {}
		self.style_cache: dict[str, list[ComputedStyle]] = {}

		# Performance metrics
		self.performance_stats = {
			'documents_formatted': 0,
			'total_processing_time': 0.0,
			'cache_hits': 0,
			'cache_misses': 0
		}

		assert self.style_parser is not None, "Style parser initialized"
		assert self.style_computer is not None, "Style computer initialized"

	def _log_formatter_operation(self, operation: str, details: str) -> None:
		"""Log formatter operations for debugging"""
		pass  # Placeholder for logging

	def _create_default_typography_profile(self) -> TypographyProfile:
		"""Create default typography profile"""
		return TypographyProfile(
			profile_name="default",
			description="Default professional typography profile",
			base_font_family="serif",
			base_font_size="12pt",
			base_line_height="1.5",
			heading_fonts={
				1: "sans-serif",
				2: "sans-serif",
				3: "serif",
				4: "serif",
				5: "serif",
				6: "serif"
			},
			heading_sizes={
				1: "20pt",
				2: "18pt",
				3: "16pt",
				4: "14pt",
				5: "12pt",
				6: "11pt"
			},
			heading_weights={
				1: "bold",
				2: "bold",
				3: "bold",
				4: "bold",
				5: "normal",
				6: "normal"
			}
		)

	def _create_default_responsive_config(self) -> ResponsiveConfiguration:
		"""Create default responsive configuration"""
		return ResponsiveConfiguration(
			config_name="default",
			page_size_breakpoints={
				"A4": {"width": "210mm", "height": "297mm"},
				"Letter": {"width": "8.5in", "height": "11in"},
				"Legal": {"width": "8.5in", "height": "14in"}
			},
			content_density_breakpoints={
				"low": 500,
				"normal": 2000,
				"high": 5000
			},
			responsive_font_scaling={
				"A4": 1.0,
				"Letter": 1.0,
				"Legal": 1.0,
				"low": 1.1,
				"normal": 1.0,
				"high": 0.9
			}
		)

	async def format_document(
		self,
		document_id: str,
		content_elements: list[dict[str, Any]],
		style_rules: list[str] | None = None,
		output_formats: list[str] | None = None,
		typography_profile: TypographyProfile | None = None,
		responsive_config: ResponsiveConfiguration | None = None,
		document_context: dict[str, Any] | None = None
	) -> FormattingResult:
		"""
		Format complete document with professional styling.

		Args:
			document_id: Unique identifier for document
			content_elements: List of content elements to format
			style_rules: Optional custom CSS-like style rules
			output_formats: Target output formats (latex, html, pdf)
			typography_profile: Typography configuration
			responsive_config: Responsive layout configuration
			document_context: Additional context for formatting decisions

		Returns:
			FormattingResult with formatted content and metadata
		"""
		assert isinstance(document_id, str) and document_id, "Document ID required"
		assert isinstance(content_elements, list), "Content elements must be list"

		try:
			start_time = datetime.now()
			self._log_formatter_operation("format_document", f"Formatting {document_id}")

			# Check cache first
			cache_key = self._generate_document_cache_key(document_id, content_elements, style_rules)
			if cache_key in self.document_cache:
				self.performance_stats['cache_hits'] += 1
				return self.document_cache[cache_key]

			self.performance_stats['cache_misses'] += 1

			# Use provided configurations or defaults
			typography_profile = typography_profile or self.default_typography_profile
			responsive_config = responsive_config or self.default_responsive_config
			document_context = document_context or {}
			output_formats = output_formats or ['latex', 'html']

			# Parse style rules
			parsed_rules = []
			if style_rules:
				for rule_text in style_rules:
					rule = await self.style_parser.parse_style_rule(rule_text)
					if rule.valid:
						parsed_rules.append(rule)

			# Add default style rules for elements
			default_rules = await self._generate_default_style_rules(content_elements)
			parsed_rules.extend(default_rules)

			# Compute styles for all elements
			computed_styles = await self._compute_document_styles(
				content_elements,
				parsed_rules,
				typography_profile,
				responsive_config,
				document_context
			)

			# Generate output formats
			formatted_content = {}
			for format_type in output_formats:
				content = await self._generate_format_output(computed_styles, format_type)
				formatted_content[format_type] = content

			# Calculate metrics
			end_time = datetime.now()
			processing_time = (end_time - start_time).total_seconds()

			# Create result
			result = FormattingResult(
				document_id=document_id,
				success=True,
				formatted_content=formatted_content,
				computed_styles=computed_styles,
				processing_time=processing_time,
				elements_processed=len(content_elements),
				rules_applied=len(parsed_rules),
				style_coverage=len(computed_styles) / len(content_elements) if content_elements else 0.0
			)

			# Cache result
			self.document_cache[cache_key] = result

			# Update performance stats
			self.performance_stats['documents_formatted'] += 1
			self.performance_stats['total_processing_time'] += processing_time

			assert result.success, "Document formatting successful"
			return result

		except Exception as e:
			# Return error result
			return FormattingResult(
				document_id=document_id,
				success=False,
				errors=[str(e)],
				processing_time=0.0
			)

	def _generate_document_cache_key(
		self,
		document_id: str,
		content_elements: list[dict[str, Any]],
		style_rules: list[str] | None = None
	) -> str:
		"""Generate cache key for document formatting"""
		elements_hash = hash(tuple(str(elem) for elem in content_elements))
		rules_hash = hash(tuple(style_rules)) if style_rules else 0
		return f"{document_id}:{elements_hash}:{rules_hash}"

	async def _generate_default_style_rules(self, content_elements: list[dict[str, Any]]) -> list[StyleRule]:
		"""Generate default style rules for content elements"""
		default_rules = []

		# Default paragraph styles
		paragraph_rule = StyleRule(
			selector="paragraph",
			properties={
				"font-family": {"value": "serif", "important": False},
				"font-size": {"value": "12pt", "important": False},
				"line-height": {"value": "1.5", "important": False},
				"margin-bottom": {"value": "1em", "important": False}
			}
		)
		default_rules.append(paragraph_rule)

		# Default heading styles
		heading_rule = StyleRule(
			selector="heading",
			properties={
				"font-family": {"value": "sans-serif", "important": False},
				"font-weight": {"value": "bold", "important": False},
				"margin-bottom": {"value": "0.5em", "important": False},
				"margin-top": {"value": "1em", "important": False}
			}
		)
		default_rules.append(heading_rule)

		# Default table styles
		table_rule = StyleRule(
			selector="table",
			properties={
				"font-size": {"value": "11pt", "important": False},
				"border-collapse": {"value": "collapse", "important": False},
				"margin-bottom": {"value": "1em", "important": False}
			}
		)
		default_rules.append(table_rule)

		return default_rules

	async def _compute_document_styles(
		self,
		content_elements: list[dict[str, Any]],
		style_rules: list[StyleRule],
		typography_profile: TypographyProfile,
		responsive_config: ResponsiveConfiguration,
		document_context: dict[str, Any]
	) -> list[ComputedStyle]:
		"""Compute styles for all document elements"""
		computed_styles = []
		element_hierarchy = self._build_element_hierarchy(content_elements)

		for element in content_elements:
			element_id = element.get('id', f"element_{len(computed_styles)}")
			element_type = element.get('type', 'paragraph')

			# Find applicable rules
			applicable_rules = await self._find_applicable_rules(element, style_rules)

			# Get parent style for inheritance
			parent_element_id = element_hierarchy.get(element_id)
			parent_style = None
			if parent_element_id:
				parent_style = next(
					(s for s in computed_styles if s.element_id == parent_element_id),
					None
				)

			# Compute base style
			computed_style = await self.style_computer.compute_element_style(
				element_id,
				element_type,
				applicable_rules,
				parent_style
			)

			# Apply typography profile
			computed_style = await self.typography_engine.apply_typography_profile(
				computed_style,
				typography_profile
			)

			# Apply responsive adaptations
			computed_style = await self.responsive_engine.adapt_style_responsive(
				computed_style,
				document_context,
				responsive_config
			)

			# Optimize typography for content
			content_text = element.get('content', '')
			computed_style = await self.typography_engine.optimize_typography(
				computed_style,
				content_text,
				document_context
			)

			computed_styles.append(computed_style)

		# Apply global layout optimizations
		computed_styles = await self.responsive_engine.optimize_layout(
			computed_styles,
			document_context
		)

		return computed_styles

	def _build_element_hierarchy(self, content_elements: list[dict[str, Any]]) -> dict[str, str]:
		"""Build element parent-child hierarchy"""
		hierarchy = {}

		for i, element in enumerate(content_elements):
			element_id = element.get('id', f"element_{i}")
			parent_id = element.get('parent_id')

			if parent_id:
				hierarchy[element_id] = parent_id

		return hierarchy

	async def _find_applicable_rules(
		self,
		element: dict[str, Any],
		style_rules: list[StyleRule]
	) -> list[StyleRule]:
		"""Find style rules applicable to element"""
		applicable_rules = []

		element_type = element.get('type', 'paragraph')
		element_id = element.get('id', '')
		element_classes = element.get('classes', [])

		for rule in style_rules:
			if await self._rule_matches_element(rule, element_type, element_id, element_classes):
				applicable_rules.append(rule)

		return applicable_rules

	async def _rule_matches_element(
		self,
		rule: StyleRule,
		element_type: str,
		element_id: str,
		element_classes: list[str]
	) -> bool:
		"""Check if style rule matches element"""
		selector = rule.selector.lower()

		# Element type selector
		if selector == element_type.lower():
			return True

		# ID selector
		if selector == f"#{element_id.lower()}":
			return True

		# Class selector
		for class_name in element_classes:
			if selector == f".{class_name.lower()}":
				return True

		# Universal selector
		if selector == "*":
			return True

		return False

	async def _generate_format_output(
		self,
		computed_styles: list[ComputedStyle],
		format_type: str
	) -> str:
		"""Generate output for specific format"""
		if format_type.lower() == 'latex':
			commands = await self.output_generator.generate_latex_commands(computed_styles)
			return self._combine_latex_commands(commands)

		elif format_type.lower() == 'html':
			html_content, css_content = await self.output_generator.generate_html_css(computed_styles)
			return f"<style>\n{css_content}\n</style>\n{html_content}"

		elif format_type.lower() == 'css':
			_, css_content = await self.output_generator.generate_html_css(computed_styles)
			return css_content

		elif format_type.lower() == 'pdf':
			pdf_instructions = await self.output_generator.generate_pdf_formatting(computed_styles)
			return json.dumps(pdf_instructions, indent=2)

		else:
			raise OutputGenerationException(f"Unsupported output format: {format_type}")

	def _combine_latex_commands(self, commands: dict[str, str]) -> str:
		"""Combine LaTeX commands into complete document"""
		parts = []

		# Add preamble
		if 'preamble' in commands:
			parts.append(commands['preamble'])

		# Add document setup
		if 'document' in commands:
			parts.append(commands['document'])

		# Add element-specific commands
		for key, value in commands.items():
			if key not in ['preamble', 'document']:
				parts.append(f"% Commands for {key}")
				parts.append(value)

		return '\n\n'.join(parts)

	async def apply_theme(
		self,
		document_id: str,
		theme_name: str,
		custom_overrides: dict[str, Any] | None = None
	) -> FormattingResult:
		"""Apply predefined theme to document"""
		assert isinstance(document_id, str) and document_id, "Document ID required"
		assert isinstance(theme_name, str) and theme_name, "Theme name required"

		try:
			# Load theme configuration
			theme_config = await self._load_theme_configuration(theme_name)

			# Apply custom overrides
			if custom_overrides:
				theme_config = self._apply_theme_overrides(theme_config, custom_overrides)

			# Convert theme to style rules
			style_rules = await self._convert_theme_to_style_rules(theme_config)

			# Get cached document or return error
			if document_id in self.document_cache:
				cached_result = self.document_cache[document_id]
				return cached_result
			else:
				return FormattingResult(
					document_id=document_id,
					success=False,
					errors=["Document not found in cache. Format document first."]
				)

		except Exception as e:
			return FormattingResult(
				document_id=document_id,
				success=False,
				errors=[f"Failed to apply theme: {str(e)}"]
			)

	async def _load_theme_configuration(self, theme_name: str) -> dict[str, Any]:
		"""Load theme configuration"""
		themes = {
			"professional": {
				"base_font": "serif",
				"heading_font": "sans-serif",
				"color_scheme": "monochrome",
				"spacing": "standard"
			},
			"modern": {
				"base_font": "sans-serif",
				"heading_font": "sans-serif",
				"color_scheme": "blue_accent",
				"spacing": "tight"
			},
			"academic": {
				"base_font": "serif",
				"heading_font": "serif",
				"color_scheme": "monochrome",
				"spacing": "loose"
			}
		}

		if theme_name in themes:
			return themes[theme_name]
		else:
			raise StyleParsingException(f"Unknown theme: {theme_name}")

	def _apply_theme_overrides(self, theme_config: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
		"""Apply custom overrides to theme configuration"""
		updated_config = theme_config.copy()
		updated_config.update(overrides)
		return updated_config

	async def _convert_theme_to_style_rules(self, theme_config: dict[str, Any]) -> list[StyleRule]:
		"""Convert theme configuration to style rules"""
		style_rules = []

		# Base font rule
		base_font_rule = StyleRule(
			selector="*",
			properties={
				"font-family": {"value": theme_config.get("base_font", "serif"), "important": False}
			}
		)
		style_rules.append(base_font_rule)

		# Heading font rule
		heading_font_rule = StyleRule(
			selector="heading",
			properties={
				"font-family": {"value": theme_config.get("heading_font", "sans-serif"), "important": False}
			}
		)
		style_rules.append(heading_font_rule)

		return style_rules

	def get_performance_stats(self) -> dict[str, Any]:
		"""Get performance statistics"""
		stats = self.performance_stats.copy()

		if stats['documents_formatted'] > 0:
			stats['average_processing_time'] = stats['total_processing_time'] / stats['documents_formatted']
		else:
			stats['average_processing_time'] = 0.0

		stats['cache_hit_rate'] = (
			stats['cache_hits'] / (stats['cache_hits'] + stats['cache_misses'])
			if (stats['cache_hits'] + stats['cache_misses']) > 0 else 0.0
		)

		return stats

	async def validate_style_rules(self, style_rules: list[str]) -> dict[str, Any]:
		"""Validate CSS-like style rules"""
		assert isinstance(style_rules, list), "Style rules must be list"

		validation_result = {
			'valid_rules': 0,
			'invalid_rules': 0,
			'errors': [],
			'warnings': []
		}

		for i, rule_text in enumerate(style_rules):
			try:
				rule = await self.style_parser.parse_style_rule(rule_text)
				if rule.valid:
					validation_result['valid_rules'] += 1
				else:
					validation_result['invalid_rules'] += 1
					validation_result['errors'].extend([
						f"Rule {i+1}: {error}" for error in rule.validation_errors
					])
			except Exception as e:
				validation_result['invalid_rules'] += 1
				validation_result['errors'].append(f"Rule {i+1}: {str(e)}")

		return validation_result

	def clear_cache(self) -> None:
		"""Clear all cached data"""
		self.document_cache.clear()
		self.style_cache.clear()
		self.style_parser.parsed_cache.clear()
		self.style_parser.validation_cache.clear()
		self.style_computer.computed_cache.clear()
		self.style_computer.cascade_cache.clear()

	async def export_computed_styles(
		self,
		document_id: str,
		export_format: str = "json"
	) -> str:
		"""Export computed styles for document"""
		assert isinstance(document_id, str) and document_id, "Document ID required"

		if document_id not in self.document_cache:
			raise StyleComputationException(f"Document {document_id} not found")

		result = self.document_cache[document_id]
		styles_data = []

		for style in result.computed_styles:
			style_data = {
				'element_id': style.element_id,
				'element_type': style.element_type,
				'font_family': style.font_family,
				'font_size': style.font_size,
				'font_weight': style.font_weight,
				'color': style.color,
				'margins': {
					'top': style.margin_top,
					'bottom': style.margin_bottom,
					'left': style.margin_left,
					'right': style.margin_right
				},
				'applied_rules': style.applied_rules,
				'inheritance_chain': style.inheritance_chain
			}
			styles_data.append(style_data)

		if export_format.lower() == 'json':
			return json.dumps(styles_data, indent=2)
		elif export_format.lower() == 'csv':
			lines = ['element_id,element_type,font_family,font_size,color']
			for style_data in styles_data:
				line = f"{style_data['element_id']},{style_data['element_type']},{style_data['font_family']},{style_data['font_size']},{style_data['color']}"
				lines.append(line)
			return '\n'.join(lines)
		else:
			raise OutputGenerationException(f"Unsupported export format: {export_format}")


# ============================================================================
# Module Exports and Factory Functions
# ============================================================================

def create_document_formatter(
	typography_profile_name: str = "default",
	responsive_config_name: str = "default"
) -> DocumentFormatter:
	"""Factory function to create DocumentFormatter with predefined configurations"""
	# Create appropriate profiles based on names
	typography_profile = None
	responsive_config = None

	if typography_profile_name == "academic":
		typography_profile = TypographyProfile(
			profile_name="academic",
			base_font_family="serif",
			base_font_size="12pt",
			base_line_height="2.0",  # Double-spaced
			paragraph_spacing="0pt",
			paragraph_indent="0.5in"
		)
	elif typography_profile_name == "business":
		typography_profile = TypographyProfile(
			profile_name="business",
			base_font_family="sans-serif",
			base_font_size="11pt",
			base_line_height="1.3",
			paragraph_spacing="6pt"
		)

	return DocumentFormatter(
		default_typography_profile=typography_profile,
		default_responsive_config=responsive_config
	)


async def quick_format_text(
	text: str,
	element_type: str = "paragraph",
	style_overrides: dict[str, str] | None = None,
	output_format: str = "latex"
) -> str:
	"""Quick utility function to format single text element"""
	formatter = DocumentFormatter()

	content_elements = [{
		'id': 'quick_element',
		'type': element_type,
		'content': text
	}]

	style_rules = []
	if style_overrides:
		properties = {
			prop: {"value": value, "important": False}
			for prop, value in style_overrides.items()
		}

		style_rule = f"{element_type} {{ " + "; ".join([
			f"{prop}: {data['value']}" for prop, data in properties.items()
		]) + " }"

		style_rules.append(style_rule)

	result = await formatter.format_document(
		document_id="quick_format",
		content_elements=content_elements,
		style_rules=style_rules,
		output_formats=[output_format]
	)

	if result.success:
		return result.formatted_content.get(output_format, "")
	else:
		raise DocumentFormatterException(f"Quick format failed: {result.errors}")


# ============================================================================
# Validation and Testing Utilities
# ============================================================================

async def validate_formatter_installation() -> dict[str, bool]:
	"""Validate DocumentFormatter installation and dependencies"""
	validation_results = {}

	try:
		# Test basic initialization
		formatter = DocumentFormatter()
		validation_results['initialization'] = True

		# Test style parsing
		test_rule = "p { font-size: 12pt; color: black; }"
		rule = await formatter.style_parser.parse_style_rule(test_rule)
		validation_results['style_parsing'] = rule.valid

		# Test style computation
		test_elements = [{'id': 'test', 'type': 'paragraph', 'content': 'Test'}]
		result = await formatter.format_document(
			document_id="validation_test",
			content_elements=test_elements,
			output_formats=['latex']
		)
		validation_results['document_formatting'] = result.success

		# Test output generation
		validation_results['latex_output'] = 'latex' in result.formatted_content

	except Exception as e:
		validation_results['error'] = str(e)

	return validation_results


# ============================================================================
# Pydantic Dataclass Rebuilds
# ============================================================================

# All pydantic dataclasses are rebuilt in _models.py.
# No rebuild needed here since all models are imported from _models.


# Export main classes and functions
__all__ = [
	'DocumentFormatter',
	'StyleRule',
	'ComputedStyle',
	'TypographyProfile',
	'ResponsiveConfiguration',
	'FormattingResult',
	'StyleParser',
	'StyleComputer',
	'TypographyEngine',
	'ResponsiveEngine',
	'OutputGenerator',
	'DocumentFormatterException',
	'StyleParsingException',
	'StyleComputationException',
	'TypographyException',
	'OutputGenerationException',
	'create_document_formatter',
	'quick_format_text',
	'validate_formatter_installation'
]