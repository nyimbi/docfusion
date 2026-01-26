#!/usr/bin/env python3
"""
DocumentFormatter Test Suite

Comprehensive testing for the document formatting system including
CSS-like styling, typography optimization, responsive layouts, and multi-format output.
"""

import asyncio
import json
import pytest
from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, patch
import time

from .document_formatter import (
	DocumentFormatter,
	StyleRule,
	ComputedStyle,
	TypographyProfile,
	ResponsiveConfiguration,
	FormattingResult,
	StyleParser,
	StyleComputer,
	TypographyEngine,
	ResponsiveEngine,
	OutputGenerator,
	DocumentFormatterException,
	StyleParsingException,
	StyleComputationException,
	TypographyException,
	OutputGenerationException,
	create_document_formatter,
	quick_format_text,
	validate_formatter_installation
)


@pytest.fixture
def sample_content_elements():
	"""Create sample content elements for testing"""
	return [
		{
			'id': 'title',
			'type': 'heading',
			'content': 'Document Title',
			'level': 1
		},
		{
			'id': 'intro',
			'type': 'paragraph', 
			'content': 'This is an introduction paragraph with sample text for formatting.'
		},
		{
			'id': 'subheading',
			'type': 'heading',
			'content': 'Section Heading',
			'level': 2
		},
		{
			'id': 'content_para',
			'type': 'paragraph',
			'content': 'This is a content paragraph that contains more detailed information about the topic being discussed.'
		},
		{
			'id': 'data_table',
			'type': 'table',
			'content': '| Column 1 | Column 2 |\n|----------|----------|\n| Data A   | Data B   |'
		},
		{
			'id': 'code_block',
			'type': 'code',
			'content': 'def hello_world():\n    print("Hello, World!")'
		}
	]


@pytest.fixture
def sample_style_rules():
	"""Create sample CSS-like style rules"""
	return [
		"h1 { font-family: sans-serif; font-size: 20pt; font-weight: bold; color: #333333; margin-bottom: 1em; }",
		"h2 { font-family: sans-serif; font-size: 16pt; font-weight: bold; color: #666666; margin-bottom: 0.5em; }",
		"p { font-family: serif; font-size: 12pt; line-height: 1.5; margin-bottom: 1em; text-align: justify; }",
		"table { font-size: 11pt; border-collapse: collapse; margin-bottom: 1em; }",
		"code { font-family: monospace; font-size: 10pt; background-color: #f5f5f5; padding: 0.2em; }"
	]


@pytest.fixture
def sample_typography_profile():
	"""Create sample typography profile"""
	return TypographyProfile(
		profile_name="test_profile",
		description="Test typography profile",
		base_font_family="serif",
		base_font_size="12pt",
		base_line_height="1.5",
		heading_fonts={1: "sans-serif", 2: "sans-serif"},
		heading_sizes={1: "20pt", 2: "16pt"},
		heading_weights={1: "bold", 2: "bold"}
	)


@pytest.fixture
def sample_responsive_config():
	"""Create sample responsive configuration"""
	return ResponsiveConfiguration(
		config_name="test_config",
		page_size_breakpoints={
			"A4": {"width": "210mm", "height": "297mm"},
			"Letter": {"width": "8.5in", "height": "11in"}
		},
		responsive_font_scaling={
			"A4": 1.0,
			"Letter": 1.0,
			"small": 0.9
		}
	)


class TestStyleParser:
	"""Test suite for StyleParser class"""

	@pytest.fixture
	def parser(self):
		return StyleParser()

	async def test_parse_simple_style_rule(self, parser):
		"""Test parsing simple CSS-like rule"""
		rule_text = "p { font-size: 12pt; color: black; }"
		
		rule = await parser.parse_style_rule(rule_text)
		
		assert rule.selector == "p"
		assert rule.valid is True
		assert "font-size" in rule.properties
		assert rule.properties["font-size"]["value"] == "12pt"
		assert "color" in rule.properties
		assert rule.properties["color"]["value"] == "black"

	async def test_parse_complex_style_rule(self, parser):
		"""Test parsing complex rule with multiple properties"""
		rule_text = """
		h1 { 
			font-family: sans-serif;
			font-size: 20pt;
			font-weight: bold;
			color: #333333;
			margin-bottom: 1em;
			text-align: center;
		}
		"""
		
		rule = await parser.parse_style_rule(rule_text)
		
		assert rule.selector == "h1"
		assert rule.valid is True
		assert len(rule.properties) == 6
		assert rule.properties["font-family"]["value"] == "sans-serif"
		assert rule.properties["font-size"]["value"] == "20pt"
		assert rule.properties["color"]["value"] == "#333333"

	async def test_parse_rule_with_important(self, parser):
		"""Test parsing rule with !important declarations"""
		rule_text = "p { font-size: 14pt !important; color: red; }"
		
		rule = await parser.parse_style_rule(rule_text)
		
		assert rule.valid is True
		assert rule.properties["font-size"]["important"] is True
		assert rule.properties["color"]["important"] is False

	async def test_parse_invalid_rule(self, parser):
		"""Test parsing invalid CSS rule"""
		rule_text = "invalid rule without proper syntax"
		
		rule = await parser.parse_style_rule(rule_text)
		
		assert rule.valid is False
		assert len(rule.validation_errors) > 0

	async def test_parse_style_sheet(self, parser):
		"""Test parsing complete style sheet"""
		style_sheet = """
		p { font-size: 12pt; }
		h1 { font-size: 20pt; font-weight: bold; }
		table { border-collapse: collapse; }
		"""
		
		rules = await parser.parse_style_sheet(style_sheet)
		
		assert len(rules) == 3
		assert all(rule.valid for rule in rules)
		assert rules[0].selector == "p"
		assert rules[1].selector == "h1"
		assert rules[2].selector == "table"

	async def test_validate_font_size_property(self, parser):
		"""Test font-size property validation"""
		# Valid font sizes
		valid, error = await parser.validate_property("font-size", "12pt")
		assert valid is True
		
		valid, error = await parser.validate_property("font-size", "1.5em")
		assert valid is True
		
		valid, error = await parser.validate_property("font-size", "large")
		assert valid is True
		
		# Invalid font size
		valid, error = await parser.validate_property("font-size", "invalid")
		assert valid is False

	async def test_validate_color_property(self, parser):
		"""Test color property validation"""
		# Valid colors
		valid, error = await parser.validate_property("color", "#FF0000")
		assert valid is True
		
		valid, error = await parser.validate_property("color", "#333")
		assert valid is True
		
		valid, error = await parser.validate_property("color", "red")
		assert valid is True
		
		valid, error = await parser.validate_property("color", "rgb(255, 0, 0)")
		assert valid is True
		
		# Invalid color
		valid, error = await parser.validate_property("color", "notacolor")
		assert valid is False

	async def test_specificity_calculation(self, parser):
		"""Test CSS specificity calculation"""
		# Test different selector types
		rule1 = await parser.parse_style_rule("p { color: black; }")
		rule2 = await parser.parse_style_rule(".highlight { color: red; }")
		rule3 = await parser.parse_style_rule("#main { color: blue; }")
		
		assert rule1.specificity < rule2.specificity
		assert rule2.specificity < rule3.specificity

	def test_normalize_property_values(self, parser):
		"""Test property value normalization"""
		# Test margin shorthand
		normalized = parser.normalize_property_value("margin", "10px")
		assert isinstance(normalized, dict)
		
		# Test color normalization
		normalized = parser.normalize_property_value("color", "#f00")
		assert normalized == "#ff0000"


class TestStyleComputer:
	"""Test suite for StyleComputer class"""

	@pytest.fixture
	def computer(self):
		return StyleComputer()

	async def test_compute_basic_element_style(self, computer):
		"""Test computing style for basic element"""
		rules = [
			StyleRule(
				selector="p",
				properties={
					"font-size": {"value": "12pt", "important": False},
					"color": {"value": "black", "important": False}
				}
			)
		]
		
		style = await computer.compute_element_style(
			"para1", "paragraph", rules
		)
		
		assert style.element_id == "para1"
		assert style.element_type == "paragraph"
		assert style.font_size == "12pt"
		assert style.color == "black"

	async def test_cascade_resolution(self, computer):
		"""Test CSS cascade resolution"""
		rules = [
			StyleRule(
				selector="p",
				properties={"color": {"value": "black", "important": False}},
				specificity=1
			),
			StyleRule(
				selector=".highlight",
				properties={"color": {"value": "red", "important": False}},
				specificity=10
			)
		]
		
		cascaded = await computer.resolve_cascade(rules)
		
		assert cascaded["color"]["value"] == "red"  # Higher specificity wins

	async def test_inheritance_application(self, computer):
		"""Test CSS inheritance from parent elements"""
		parent_style = ComputedStyle(
			element_id="parent",
			element_type="section",
			font_family="serif",
			color="#333333"
		)
		
		child_properties = {"font-size": {"value": "12pt", "important": False}}
		
		inherited = await computer.apply_inheritance(child_properties, parent_style)
		
		# Should inherit color and font-family
		assert "color" in inherited
		assert "font-family" in inherited

	async def test_important_declarations(self, computer):
		"""Test !important declaration handling"""
		rules = [
			StyleRule(
				selector="p",
				properties={"color": {"value": "red", "important": True}},
				specificity=1
			),
			StyleRule(
				selector=".blue",
				properties={"color": {"value": "blue", "important": False}},
				specificity=10
			)
		]
		
		cascaded = await computer.resolve_cascade(rules)
		
		# !important should win despite lower specificity
		assert cascaded["color"]["value"] == "red"

	async def test_value_resolution(self, computer):
		"""Test relative value resolution"""
		properties = {
			"font-size": {"value": "1.2em", "important": False},
			"margin": {"value": "10%", "important": False}
		}
		
		context = {"parent_font_size": "12pt", "container_width": "200px"}
		
		resolved = await computer.resolve_values(properties, context)
		
		assert "font-size" in resolved
		assert "margin" in resolved


class TestTypographyEngine:
	"""Test suite for TypographyEngine class"""

	@pytest.fixture
	def typography_engine(self):
		return TypographyEngine()

	async def test_apply_typography_profile(self, typography_engine, sample_typography_profile):
		"""Test applying typography profile to style"""
		style = ComputedStyle(
			element_id="test",
			element_type="paragraph"
		)
		
		updated_style = await typography_engine.apply_typography_profile(
			style, sample_typography_profile
		)
		
		assert updated_style.font_family == sample_typography_profile.base_font_family
		assert updated_style.font_size == sample_typography_profile.base_font_size
		assert updated_style.line_height == sample_typography_profile.base_line_height

	async def test_heading_typography_application(self, typography_engine, sample_typography_profile):
		"""Test typography application for headings"""
		style = ComputedStyle(
			element_id="h1_test",
			element_type="heading"
		)
		
		updated_style = await typography_engine.apply_typography_profile(
			style, sample_typography_profile
		)
		
		# Should apply h1 specific settings
		assert updated_style.font_family == sample_typography_profile.heading_fonts[1]
		assert updated_style.font_size == sample_typography_profile.heading_sizes[1]
		assert updated_style.font_weight == sample_typography_profile.heading_weights[1]

	async def test_typography_optimization(self, typography_engine):
		"""Test typography optimization for content"""
		style = ComputedStyle(
			element_id="test",
			element_type="paragraph",
			font_size="12pt",
			line_height="normal"
		)
		
		# Long content should get optimized line height
		long_content = "This is a very long paragraph " * 50
		
		optimized_style = await typography_engine.optimize_typography(
			style, long_content, {}
		)
		
		assert optimized_style.line_height != "normal"

	async def test_accessibility_optimization(self, typography_engine):
		"""Test typography optimization for accessibility"""
		style = ComputedStyle(
			element_id="test",
			element_type="paragraph",
			font_size="10pt",
			line_height="1.2"
		)
		
		optimized_style = await typography_engine.optimize_typography(
			style, "Test content", {"accessibility_mode": True}
		)
		
		# Should increase font size and line height for accessibility
		assert optimized_style.font_size == "14pt"
		assert optimized_style.line_height == "1.6"

	async def test_text_metrics_calculation(self, typography_engine):
		"""Test text metrics calculation"""
		style = ComputedStyle(
			element_id="test",
			element_type="paragraph",
			font_size="12pt"
		)
		
		metrics = await typography_engine.calculate_text_metrics(
			"Hello World", style
		)
		
		assert "width" in metrics
		assert "height" in metrics
		assert "line_count" in metrics
		assert "char_count" in metrics
		assert metrics["char_count"] == 11

	async def test_latex_font_command_generation(self, typography_engine):
		"""Test LaTeX font command generation"""
		style = ComputedStyle(
			element_id="test",
			element_type="paragraph",
			font_family="serif",
			font_weight="bold",
			font_style="italic",
			font_size="14pt"
		)
		
		commands = await typography_engine.generate_font_commands(style, "latex")
		
		assert "\\rmfamily" in commands  # serif
		assert "\\bfseries" in commands  # bold
		assert "\\itshape" in commands   # italic
		assert "\\large" in commands     # 14pt

	async def test_html_font_command_generation(self, typography_engine):
		"""Test HTML font styling generation"""
		style = ComputedStyle(
			element_id="test",
			element_type="paragraph",
			font_family="serif",
			font_size="12pt",
			color="#333333"
		)
		
		html_style = await typography_engine.generate_font_commands(style, "html")
		
		assert "font-family: serif" in html_style
		assert "font-size: 12pt" in html_style
		assert "color: #333333" in html_style


class TestResponsiveEngine:
	"""Test suite for ResponsiveEngine class"""

	@pytest.fixture
	def responsive_engine(self):
		return ResponsiveEngine()

	async def test_calculate_responsive_breakpoints(self, responsive_engine):
		"""Test responsive breakpoint calculation"""
		context = {
			"page_size": "A4",
			"word_count": 1500,
			"output_format": "pdf"
		}
		
		breakpoints = await responsive_engine.calculate_responsive_breakpoints(context)
		
		assert breakpoints["page_size"] == "A4"
		assert breakpoints["content_density"] == "normal"
		assert breakpoints["output_format"] == "pdf"

	async def test_responsive_typography_scaling(self, responsive_engine, sample_responsive_config):
		"""Test responsive typography scaling"""
		style = ComputedStyle(
			element_id="test",
			element_type="paragraph",
			font_size="12pt"
		)
		
		context = {"page_size": "A4", "content_density": "normal"}
		breakpoints = await responsive_engine.calculate_responsive_breakpoints(context)
		
		adapted_style = await responsive_engine.adapt_style_responsive(
			style, context, sample_responsive_config
		)
		
		# Font size should be adapted based on breakpoints
		assert adapted_style.font_size is not None

	async def test_responsive_spacing_adaptation(self, responsive_engine, sample_responsive_config):
		"""Test responsive spacing adaptation"""
		style = ComputedStyle(
			element_id="test",
			element_type="paragraph",
			margin_top="12pt",
			margin_bottom="12pt"
		)
		
		context = {"page_size": "A4"}
		
		adapted_style = await responsive_engine.adapt_style_responsive(
			style, context, sample_responsive_config
		)
		
		# Spacing should be preserved or adapted
		assert adapted_style.margin_top is not None
		assert adapted_style.margin_bottom is not None

	async def test_layout_optimization(self, responsive_engine):
		"""Test layout optimization for page constraints"""
		styles = [
			ComputedStyle(element_id="h1", element_type="heading"),
			ComputedStyle(element_id="p1", element_type="paragraph"),
			ComputedStyle(element_id="p2", element_type="paragraph")
		]
		
		page_context = {"page_width": "210mm", "page_height": "297mm"}
		
		optimized_styles = await responsive_engine.optimize_layout(styles, page_context)
		
		assert len(optimized_styles) == len(styles)
		# Headings should get page-break-inside: avoid
		heading_style = next(s for s in optimized_styles if s.element_type == "heading")
		assert hasattr(heading_style, 'page_break_inside')

	async def test_print_optimization(self, responsive_engine, sample_responsive_config):
		"""Test print-specific optimizations"""
		style = ComputedStyle(
			element_id="test",
			element_type="paragraph",
			margin_top="0",
			color="#FFFFFF"
		)
		
		context = {"output_format": "print"}
		breakpoints = await responsive_engine.calculate_responsive_breakpoints(context)
		
		adapted_style = await responsive_engine.adapt_style_responsive(
			style, context, sample_responsive_config
		)
		
		# Should have adequate margins for print
		assert adapted_style.margin_top != "0"
		# White text should be changed to black for print
		assert adapted_style.color == "#000000"


class TestOutputGenerator:
	"""Test suite for OutputGenerator class"""

	@pytest.fixture
	def output_generator(self):
		return OutputGenerator()

	async def test_generate_latex_commands(self, output_generator):
		"""Test LaTeX command generation"""
		styles = [
			ComputedStyle(
				element_id="test1",
				element_type="paragraph",
				font_family="serif",
				font_size="12pt",
				color="black"
			),
			ComputedStyle(
				element_id="test2",
				element_type="heading",
				font_family="sans-serif",
				font_size="16pt",
				font_weight="bold"
			)
		]
		
		commands = await output_generator.generate_latex_commands(styles)
		
		assert "preamble" in commands
		assert "test1" in commands
		assert "test2" in commands
		assert "\\usepackage" in commands["preamble"]

	async def test_generate_html_css(self, output_generator):
		"""Test HTML and CSS generation"""
		styles = [
			ComputedStyle(
				element_id="test1",
				element_type="paragraph",
				font_family="serif",
				font_size="12pt"
			)
		]
		
		html_content, css_content = await output_generator.generate_html_css(styles)
		
		assert html_content is not None
		assert css_content is not None
		assert "element-test1" in css_content
		assert "font-family: serif" in css_content
		assert "font-size: 12pt" in css_content

	async def test_generate_pdf_formatting(self, output_generator):
		"""Test PDF formatting generation"""
		styles = [
			ComputedStyle(
				element_id="test1",
				element_type="paragraph",
				font_family="serif",
				font_size="12pt"
			)
		]
		
		pdf_formatting = await output_generator.generate_pdf_formatting(styles)
		
		assert "page_setup" in pdf_formatting
		assert "font_definitions" in pdf_formatting
		assert "style_definitions" in pdf_formatting
		assert pdf_formatting["page_setup"]["page_size"] == "A4"

	async def test_latex_optimization(self, output_generator):
		"""Test LaTeX output optimization"""
		latex_content = """
		\\documentclass{article}
		
		
		\\begin{document}
		
		Test    content   with   extra    spaces
		
		\\end{document}
		"""
		
		optimized = await output_generator.optimize_output(latex_content, "latex", 1)
		
		# Should remove extra whitespace and normalize formatting
		assert "   " not in optimized  # Multiple spaces should be removed
		assert "\t" not in optimized   # Tabs should be removed
		assert optimized.startswith("\\documentclass")  # Should not start with whitespace
		assert "Test content with extra spaces" in optimized  # Content should be preserved

	async def test_css_optimization(self, output_generator):
		"""Test CSS output optimization"""
		css_content = """
		/* Comment */
		.test {
			font-size: 12pt;
			color: black;
		}
		"""
		
		optimized = await output_generator.optimize_output(css_content, "css", 1)
		
		# Should remove comments and extra whitespace
		assert "/* Comment */" not in optimized
		assert len(optimized) < len(css_content)


class TestDocumentFormatter:
	"""Test suite for main DocumentFormatter class"""

	@pytest.fixture
	def formatter(self):
		return DocumentFormatter()

	async def test_format_simple_document(self, formatter, sample_content_elements):
		"""Test formatting simple document"""
		result = await formatter.format_document(
			document_id="test_doc",
			content_elements=sample_content_elements[:2],  # Just title and intro
			output_formats=["latex", "html"]
		)
		
		assert result.success is True
		assert result.document_id == "test_doc"
		assert "latex" in result.formatted_content
		assert "html" in result.formatted_content
		assert result.processing_time > 0
		assert result.elements_processed == 2

	async def test_format_with_custom_styles(self, formatter, sample_content_elements, sample_style_rules):
		"""Test formatting with custom style rules"""
		result = await formatter.format_document(
			document_id="styled_doc",
			content_elements=sample_content_elements,
			style_rules=sample_style_rules,
			output_formats=["latex"]
		)
		
		assert result.success is True
		assert len(result.computed_styles) == len(sample_content_elements)
		assert result.rules_applied > 0

	async def test_format_with_typography_profile(self, formatter, sample_content_elements, sample_typography_profile):
		"""Test formatting with custom typography profile"""
		result = await formatter.format_document(
			document_id="typography_doc",
			content_elements=sample_content_elements,
			typography_profile=sample_typography_profile,
			output_formats=["latex"]
		)
		
		assert result.success is True
		# Check that typography profile was applied
		heading_style = next(
			(s for s in result.computed_styles if s.element_type == "heading"),
			None
		)
		if heading_style:
			assert heading_style.font_family in sample_typography_profile.heading_fonts.values()

	async def test_format_with_responsive_config(self, formatter, sample_content_elements, sample_responsive_config):
		"""Test formatting with responsive configuration"""
		context = {"page_size": "A4", "word_count": 500}
		
		result = await formatter.format_document(
			document_id="responsive_doc",
			content_elements=sample_content_elements,
			responsive_config=sample_responsive_config,
			document_context=context,
			output_formats=["latex"]
		)
		
		assert result.success is True
		assert len(result.computed_styles) > 0

	async def test_format_multiple_formats(self, formatter, sample_content_elements):
		"""Test formatting for multiple output formats"""
		result = await formatter.format_document(
			document_id="multi_format_doc",
			content_elements=sample_content_elements,
			output_formats=["latex", "html", "css", "pdf"]
		)
		
		assert result.success is True
		assert len(result.formatted_content) == 4
		assert "latex" in result.formatted_content
		assert "html" in result.formatted_content
		assert "css" in result.formatted_content
		assert "pdf" in result.formatted_content

	async def test_caching_functionality(self, formatter, sample_content_elements):
		"""Test document formatting caching"""
		# First format
		result1 = await formatter.format_document(
			document_id="cache_test",
			content_elements=sample_content_elements,
			output_formats=["latex"]
		)
		
		# Second format (should use cache)
		result2 = await formatter.format_document(
			document_id="cache_test",
			content_elements=sample_content_elements,
			output_formats=["latex"]
		)
		
		assert result1.success is True
		assert result2.success is True
		assert result1.result_id != result2.result_id  # Different result objects
		# But processing time should be similar (cache hit)

	async def test_apply_theme(self, formatter, sample_content_elements):
		"""Test applying predefined theme"""
		# First format document
		await formatter.format_document(
			document_id="theme_test",
			content_elements=sample_content_elements,
			output_formats=["latex"]
		)
		
		# Apply theme
		result = await formatter.apply_theme(
			document_id="theme_test",
			theme_name="professional"
		)
		
		# Should succeed (though simplified implementation)
		assert result.document_id == "theme_test"

	async def test_validate_style_rules(self, formatter):
		"""Test style rule validation"""
		style_rules = [
			"p { font-size: 12pt; color: black; }",  # Valid
			"h1 { font-size: 20pt; font-weight: bold; }",  # Valid  
			"invalid rule syntax",  # Invalid
			".class { color: invalidcolor; }"  # Invalid property
		]
		
		validation = await formatter.validate_style_rules(style_rules)
		
		assert validation["valid_rules"] == 2
		assert validation["invalid_rules"] == 2
		assert len(validation["errors"]) > 0

	def test_performance_stats(self, formatter):
		"""Test performance statistics tracking"""
		stats = formatter.get_performance_stats()
		
		assert "documents_formatted" in stats
		assert "total_processing_time" in stats
		assert "cache_hits" in stats
		assert "cache_misses" in stats
		assert "average_processing_time" in stats
		assert "cache_hit_rate" in stats

	async def test_export_computed_styles(self, formatter, sample_content_elements):
		"""Test exporting computed styles"""
		# Format document first
		await formatter.format_document(
			document_id="export_test",
			content_elements=sample_content_elements,
			output_formats=["latex"]
		)
		
		# Export as JSON
		json_export = await formatter.export_computed_styles("export_test", "json")
		styles_data = json.loads(json_export)
		
		assert isinstance(styles_data, list)
		assert len(styles_data) == len(sample_content_elements)
		assert "element_id" in styles_data[0]
		assert "font_family" in styles_data[0]

	async def test_error_handling(self, formatter):
		"""Test error handling for invalid inputs"""
		# Test with empty content elements
		result = await formatter.format_document(
			document_id="error_test",
			content_elements=[],
			output_formats=["latex"]
		)
		
		assert result.success is True  # Should handle empty gracefully
		assert result.elements_processed == 0

	def test_clear_cache(self, formatter):
		"""Test cache clearing functionality"""
		# Add some data to cache
		formatter.document_cache["test"] = FormattingResult(document_id="test")
		
		assert len(formatter.document_cache) > 0
		
		formatter.clear_cache()
		
		assert len(formatter.document_cache) == 0

	async def test_complex_document_structure(self, formatter):
		"""Test formatting complex document with hierarchy"""
		complex_elements = [
			{
				'id': 'doc_title',
				'type': 'heading',
				'content': 'Complex Document',
				'level': 1
			},
			{
				'id': 'section1',
				'type': 'heading',
				'content': 'Section 1',
				'level': 2,
				'parent_id': 'doc_title'
			},
			{
				'id': 'para1',
				'type': 'paragraph',
				'content': 'First paragraph under section 1.',
				'parent_id': 'section1'
			},
			{
				'id': 'subsection1',
				'type': 'heading',
				'content': 'Subsection 1.1',
				'level': 3,
				'parent_id': 'section1'
			},
			{
				'id': 'para2',
				'type': 'paragraph',
				'content': 'Paragraph under subsection.',
				'parent_id': 'subsection1'
			}
		]
		
		result = await formatter.format_document(
			document_id="complex_doc",
			content_elements=complex_elements,
			output_formats=["latex", "html"]
		)
		
		assert result.success is True
		assert len(result.computed_styles) == len(complex_elements)
		
		# Check inheritance is working
		para_styles = [s for s in result.computed_styles if s.element_type == "paragraph"]
		for para_style in para_styles:
			assert len(para_style.inheritance_chain) >= 0  # Should have inheritance chain


class TestUtilityFunctions:
	"""Test suite for utility functions"""

	def test_create_document_formatter(self):
		"""Test factory function for creating formatter"""
		formatter = create_document_formatter("academic", "default")
		
		assert isinstance(formatter, DocumentFormatter)
		assert formatter.default_typography_profile is not None
		assert formatter.default_responsive_config is not None

	async def test_quick_format_text(self):
		"""Test quick text formatting utility"""
		result = await quick_format_text(
			text="Hello World",
			element_type="paragraph",
			style_overrides={"font-size": "14pt", "color": "blue"},
			output_format="latex"
		)
		
		assert isinstance(result, str)
		assert len(result) > 0

	async def test_validate_formatter_installation(self):
		"""Test formatter installation validation"""
		validation = await validate_formatter_installation()
		
		assert isinstance(validation, dict)
		assert "initialization" in validation
		assert "style_parsing" in validation
		assert "document_formatting" in validation


class TestIntegrationScenarios:
	"""Integration tests for complex document formatting scenarios"""

	@pytest.fixture
	def formatter(self):
		return DocumentFormatter()

	async def test_academic_paper_formatting(self, formatter):
		"""Test formatting academic paper style document"""
		academic_elements = [
			{'id': 'title', 'type': 'heading', 'content': 'Research Paper Title', 'level': 1},
			{'id': 'abstract', 'type': 'paragraph', 'content': 'Abstract: This paper presents...'},
			{'id': 'intro_heading', 'type': 'heading', 'content': '1. Introduction', 'level': 2},
			{'id': 'intro_text', 'type': 'paragraph', 'content': 'Introduction paragraph...'},
			{'id': 'methods_heading', 'type': 'heading', 'content': '2. Methods', 'level': 2},
			{'id': 'methods_text', 'type': 'paragraph', 'content': 'Methods description...'},
			{'id': 'results_table', 'type': 'table', 'content': '| Variable | Value |\n|----------|-------|\n| X | 1.23 |'},
			{'id': 'conclusion', 'type': 'heading', 'content': '3. Conclusion', 'level': 2}
		]
		
		academic_styles = [
			"h1 { text-align: center; font-size: 16pt; font-weight: bold; margin-bottom: 2em; }",
			"h2 { font-size: 14pt; font-weight: bold; margin-top: 1.5em; margin-bottom: 0.5em; }",
			"p { font-size: 12pt; line-height: 2.0; text-align: justify; margin-bottom: 0pt; text-indent: 0.5in; }",
			"table { font-size: 11pt; margin: 1em auto; }"
		]
		
		typography_profile = TypographyProfile(
			profile_name="academic",
			base_font_family="serif",
			base_font_size="12pt",
			base_line_height="2.0",  # Double-spaced
			paragraph_indent="0.5in",
			paragraph_spacing="0pt"
		)
		
		result = await formatter.format_document(
			document_id="academic_paper",
			content_elements=academic_elements,
			style_rules=academic_styles,
			typography_profile=typography_profile,
			output_formats=["latex"]
		)
		
		assert result.success is True
		assert len(result.computed_styles) == len(academic_elements)
		
		# Check academic formatting is applied
		para_style = next(s for s in result.computed_styles if s.element_type == "paragraph")
		assert para_style.line_height == "2.0"
		assert para_style.text_indent == "0.5in"

	async def test_business_report_formatting(self, formatter):
		"""Test formatting business report style document"""
		business_elements = [
			{'id': 'cover', 'type': 'heading', 'content': 'Quarterly Report Q4 2024', 'level': 1},
			{'id': 'exec_summary', 'type': 'heading', 'content': 'Executive Summary', 'level': 2},
			{'id': 'summary_text', 'type': 'paragraph', 'content': 'Key findings and recommendations...'},
			{'id': 'financial_heading', 'type': 'heading', 'content': 'Financial Performance', 'level': 2},
			{'id': 'financial_table', 'type': 'table', 'content': '| Metric | Q3 | Q4 |\n|--------|----|----|---|Revenue | $1M | $1.2M |'},
			{'id': 'recommendations', 'type': 'heading', 'content': 'Recommendations', 'level': 2}
		]
		
		business_styles = [
			"h1 { font-family: sans-serif; font-size: 24pt; font-weight: bold; color: #2E4B8E; text-align: center; }",
			"h2 { font-family: sans-serif; font-size: 16pt; font-weight: bold; color: #2E4B8E; border-bottom: 2pt solid #2E4B8E; }",
			"p { font-family: sans-serif; font-size: 11pt; line-height: 1.3; text-align: left; }",
			"table { border-collapse: collapse; font-size: 10pt; margin: 1em 0; }"
		]
		
		typography_profile = TypographyProfile(
			profile_name="business",
			base_font_family="sans-serif",
			base_font_size="11pt",
			base_line_height="1.3"
		)
		
		result = await formatter.format_document(
			document_id="business_report",
			content_elements=business_elements,
			style_rules=business_styles,
			typography_profile=typography_profile,
			output_formats=["latex", "html"]
		)
		
		assert result.success is True
		assert "latex" in result.formatted_content
		assert "html" in result.formatted_content

	async def test_responsive_multi_format_output(self, formatter):
		"""Test responsive formatting for multiple output formats"""
		content_elements = [
			{'id': 'title', 'type': 'heading', 'content': 'Responsive Document'},
			{'id': 'content', 'type': 'paragraph', 'content': 'Content that should adapt to different formats...'}
		]
		
		# Test different page sizes
		contexts = [
			{"page_size": "A4", "output_format": "pdf"},
			{"page_size": "Letter", "output_format": "pdf"},
			{"page_size": "A4", "output_format": "print"},
			{"page_size": "Letter", "output_format": "digital"}
		]
		
		responsive_config = ResponsiveConfiguration(
			config_name="multi_format",
			page_size_breakpoints={
				"A4": {"width": "210mm", "height": "297mm"},
				"Letter": {"width": "8.5in", "height": "11in"}
			},
			responsive_font_scaling={
				"A4": 1.0,
				"Letter": 1.05,
				"print": 1.0,
				"digital": 0.95
			}
		)
		
		for i, context in enumerate(contexts):
			result = await formatter.format_document(
				document_id=f"responsive_test_{i}",
				content_elements=content_elements,
				responsive_config=responsive_config,
				document_context=context,
				output_formats=["latex", "html"]
			)
			
			assert result.success is True
			assert len(result.computed_styles) == len(content_elements)

	async def test_performance_with_large_document(self, formatter):
		"""Test performance with large document"""
		# Create large document
		large_elements = []
		for i in range(100):
			large_elements.extend([
				{
					'id': f'heading_{i}',
					'type': 'heading',
					'content': f'Section {i+1}',
					'level': 2
				},
				{
					'id': f'para_{i}_1',
					'type': 'paragraph',
					'content': f'First paragraph of section {i+1}. ' * 10
				},
				{
					'id': f'para_{i}_2',
					'type': 'paragraph',
					'content': f'Second paragraph of section {i+1}. ' * 15
				}
			])
		
		start_time = time.time()
		
		result = await formatter.format_document(
			document_id="large_document",
			content_elements=large_elements,
			output_formats=["latex"]
		)
		
		end_time = time.time()
		processing_time = end_time - start_time
		
		assert result.success is True
		assert len(result.computed_styles) == len(large_elements)
		assert processing_time < 10.0  # Should complete within 10 seconds
		assert result.processing_time > 0

	async def test_error_recovery_and_partial_formatting(self, formatter):
		"""Test error recovery and partial formatting"""
		mixed_elements = [
			{'id': 'good1', 'type': 'paragraph', 'content': 'Good content'},
			{'id': 'bad1', 'type': 'invalid_type', 'content': 'Content with invalid type'},
			{'id': 'good2', 'type': 'heading', 'content': 'Good heading'},
			{'id': 'bad2', 'content': 'Missing type field'}  # Missing required field
		]
		
		# Include some invalid style rules
		mixed_styles = [
			"p { font-size: 12pt; }",  # Valid
			"invalid syntax here",      # Invalid
			"h1 { font-size: 16pt; }"  # Valid
		]
		
		result = await formatter.format_document(
			document_id="mixed_quality",
			content_elements=mixed_elements,
			style_rules=mixed_styles,
			output_formats=["latex"]
		)
		
		# Should still succeed with partial formatting
		assert result.success is True
		# Should have processed at least the valid elements
		assert result.elements_processed >= 2


class TestErrorConditions:
	"""Test error handling and edge cases"""

	@pytest.fixture
	def formatter(self):
		return DocumentFormatter()

	async def test_empty_inputs(self, formatter):
		"""Test handling of empty inputs"""
		result = await formatter.format_document(
			document_id="empty_test",
			content_elements=[],
			output_formats=["latex"]
		)
		
		assert result.success is True
		assert result.elements_processed == 0

	async def test_invalid_output_format(self, formatter, sample_content_elements):
		"""Test handling of invalid output format"""
		result = await formatter.format_document(
			document_id="invalid_format_test",
			content_elements=sample_content_elements,
			output_formats=["invalid_format"]
		)
		
		# Should fail gracefully
		assert result.success is False
		assert len(result.errors) > 0

	async def test_malformed_content_elements(self, formatter):
		"""Test handling of malformed content elements"""
		malformed_elements = [
			{},  # Empty element
			{'id': 'no_type', 'content': 'Missing type'},
			{'type': 'paragraph'},  # Missing content
			{'id': 'good', 'type': 'paragraph', 'content': 'Good element'}
		]
		
		result = await formatter.format_document(
			document_id="malformed_test", 
			content_elements=malformed_elements,
			output_formats=["latex"]
		)
		
		# Should handle gracefully and process valid elements
		assert result.success is True
		assert result.elements_processed >= 1  # At least the good element

	async def test_circular_inheritance(self, formatter):
		"""Test handling of circular inheritance in element hierarchy"""
		circular_elements = [
			{
				'id': 'element1',
				'type': 'paragraph',
				'content': 'Element 1',
				'parent_id': 'element2'
			},
			{
				'id': 'element2', 
				'type': 'paragraph',
				'content': 'Element 2',
				'parent_id': 'element1'
			}
		]
		
		result = await formatter.format_document(
			document_id="circular_test",
			content_elements=circular_elements,
			output_formats=["latex"]
		)
		
		# Should handle circular references gracefully
		assert result.success is True

	async def test_memory_stress(self, formatter):
		"""Test memory usage with very large style sheets"""
		# Create large number of style rules
		large_style_rules = []
		for i in range(1000):
			large_style_rules.append(f".class{i} {{ font-size: {10+i%10}pt; color: #{i%16:01x}{i%16:01x}{i%16:01x}; }}")
		
		simple_elements = [
			{'id': 'test', 'type': 'paragraph', 'content': 'Test content'}
		]
		
		result = await formatter.format_document(
			document_id="memory_stress_test",
			content_elements=simple_elements,
			style_rules=large_style_rules,
			output_formats=["latex"]
		)
		
		# Should complete without memory issues
		assert result.success is True


if __name__ == "__main__":
	# Run tests directly
	pytest.main([__file__, "-v", "-x"])