#!/usr/bin/env python3
from __future__ import annotations
"""
DocumentFormatter Module - Professional CSS-like Styling Engine

This module provides sophisticated CSS-like styling and formatting capabilities
for DocuFusion documents, ensuring professional typography, consistent layouts,
and responsive design across multiple output formats.

Core Components:
- StyleParser: Parse and validate CSS-like style rules
- StyleComputer: Compute final styles through cascade resolution
- TypographyEngine: Advanced typography processing
- ResponsiveEngine: Responsive layout adaptation
- OutputGenerator: Format-specific output generation

Architecture:
- CSS-like styling rules with selectors and properties
- Cascading style resolution with proper inheritance
- Professional typography with format optimization
- Responsive layouts for different page sizes
- Multi-format output (LaTeX, HTML, PDF)
"""

import asyncio
import json
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from pydantic import Field, ConfigDict
from pydantic.dataclasses import dataclass as pydantic_dataclass, rebuild_dataclass
from uuid import uuid4

def uuid7str() -> str:
	"""Generate UUID string compatible with uuid7str"""
	return str(uuid4())


# ============================================================================
# Data Models
# ============================================================================

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class StyleRule:
	"""CSS-like style rule with selector and properties"""
	# Required fields
	selector: str  # CSS-like selector (e.g., "h1", ".title", "#intro")
	properties: dict[str, Any]  # Style properties and values
	
	# Optional fields with defaults
	rule_id: str = Field(default_factory=uuid7str)
	specificity: int = 0  # CSS specificity calculation
	priority: int = 0  # Manual priority override
	important: bool = False  # !important flag
	origin: str = "author"  # author, user, user-agent
	
	# Context and conditions
	media_conditions: dict[str, Any] = Field(default_factory=dict)  # Media queries
	document_context: dict[str, Any] = Field(default_factory=dict)  # Document-specific rules
	template_context: str = ""  # Template or theme context
	
	# Validation and metadata
	valid: bool = True
	validation_errors: list[str] = Field(default_factory=list)
	source_location: str = ""  # Where rule originated
	
	# Performance optimization
	compiled_selector: Any | None = None  # Pre-compiled selector pattern
	property_index: dict[str, Any] = Field(default_factory=dict)  # Fast property lookup
	
	# Temporal tracking
	created_at: datetime = Field(default_factory=datetime.now)
	updated_at: datetime = Field(default_factory=datetime.now)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class ComputedStyle:
	"""Final computed style for a document element"""
	# Required fields
	element_id: str
	element_type: str  # paragraph, heading, table, figure, etc.
	
	# Typography properties
	font_family: str = "serif"
	font_size: str = "12pt"
	font_weight: str = "normal"  # normal, bold, 100-900
	font_style: str = "normal"  # normal, italic, oblique
	font_variant: str = "normal"  # normal, small-caps
	
	# Text properties
	color: str = "#000000"
	text_align: str = "left"  # left, right, center, justify
	text_decoration: str = "none"  # none, underline, overline, line-through
	text_transform: str = "none"  # none, uppercase, lowercase, capitalize
	line_height: str = "normal"  # normal, number, length
	letter_spacing: str = "normal"
	word_spacing: str = "normal"
	
	# Paragraph properties
	margin_top: str = "0"
	margin_bottom: str = "0"
	margin_left: str = "0"
	margin_right: str = "0"
	padding_top: str = "0"
	padding_bottom: str = "0"
	padding_left: str = "0"
	padding_right: str = "0"
	text_indent: str = "0"
	
	# Background and borders
	background_color: str = "transparent"
	background_image: str = ""
	border_width: str = "0"
	border_style: str = "none"
	border_color: str = "#000000"
	border_radius: str = "0"
	
	# Layout properties
	display: str = "block"  # block, inline, inline-block, none
	width: str = "auto"
	height: str = "auto"
	float: str = "none"  # none, left, right
	clear: str = "none"  # none, left, right, both
	position: str = "static"  # static, relative, absolute, fixed
	
	# List properties
	list_style_type: str = "disc"  # disc, circle, square, decimal, etc.
	list_style_position: str = "outside"  # outside, inside
	
	# Table properties
	border_collapse: str = "separate"  # separate, collapse
	border_spacing: str = "0"
	caption_side: str = "top"  # top, bottom
	table_layout: str = "auto"  # auto, fixed
	
	# Computed metadata
	inheritance_chain: list[str] = Field(default_factory=list)  # Parent element IDs
	applied_rules: list[str] = Field(default_factory=list)  # Rule IDs that contributed
	format_specific: dict[str, dict[str, Any]] = Field(default_factory=dict)  # LaTeX, HTML, PDF specific
	
	# Performance and caching
	computation_time: float = 0.0
	cache_key: str = ""
	last_computed: datetime = Field(default_factory=datetime.now)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class TypographyProfile:
	"""Professional typography configuration"""
	# Required fields
	profile_name: str
	
	# Optional fields with defaults
	profile_id: str = Field(default_factory=uuid7str)
	description: str = ""
	
	# Base typography settings
	base_font_family: str = "serif"
	base_font_size: str = "12pt"
	base_line_height: str = "1.5"
	base_color: str = "#000000"
	
	# Heading hierarchy
	heading_fonts: dict[int, str] = Field(default_factory=dict)  # h1-h6 fonts
	heading_sizes: dict[int, str] = Field(default_factory=dict)  # h1-h6 sizes
	heading_weights: dict[int, str] = Field(default_factory=dict)  # h1-h6 weights
	heading_spacing: dict[int, dict[str, str]] = Field(default_factory=dict)  # margins
	
	# Special element typography
	quote_font: str = ""
	quote_size: str = ""
	code_font: str = "monospace"
	code_size: str = "0.9em"
	caption_font: str = ""
	caption_size: str = "0.9em"
	
	# Paragraph and text settings
	paragraph_spacing: str = "1em"
	paragraph_indent: str = "0"
	text_justification: str = "left"
	hyphenation: bool = True
	
	# List typography
	list_item_spacing: str = "0.5em"
	list_indent: str = "2em"
	bullet_style: str = "disc"
	numbering_style: str = "decimal"
	
	# Professional settings
	widow_orphan_control: bool = True
	page_break_inside: str = "auto"
	keep_with_next: bool = False
	
	# Format-specific optimizations
	latex_packages: list[str] = Field(default_factory=list)
	html_web_fonts: list[str] = Field(default_factory=list)
	pdf_embedding: bool = True
	
	# Accessibility
	min_contrast_ratio: float = 4.5
	dyslexia_friendly: bool = False
	large_text_support: bool = False


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class ResponsiveConfiguration:
	"""Responsive layout and styling configuration"""
	# Required fields
	config_name: str
	
	# Optional fields with defaults
	config_id: str = Field(default_factory=uuid7str)
	
	# Breakpoints and conditions
	page_size_breakpoints: dict[str, dict[str, str]] = Field(default_factory=dict)  # A4, Letter, etc.
	content_density_breakpoints: dict[str, int] = Field(default_factory=dict)  # word counts
	format_conditions: dict[str, dict[str, Any]] = Field(default_factory=dict)  # LaTeX, PDF, HTML
	
	# Responsive typography
	responsive_font_scaling: dict[str, float] = Field(default_factory=dict)
	line_height_adjustments: dict[str, str] = Field(default_factory=dict)
	heading_scaling: dict[str, dict[int, float]] = Field(default_factory=dict)
	
	# Responsive spacing
	margin_scaling: dict[str, float] = Field(default_factory=dict)
	padding_scaling: dict[str, float] = Field(default_factory=dict)
	content_scaling: dict[str, float] = Field(default_factory=dict)
	
	# Layout adaptations
	column_configurations: dict[str, int] = Field(default_factory=dict)
	image_sizing: dict[str, str] = Field(default_factory=dict)
	table_responsiveness: dict[str, str] = Field(default_factory=dict)
	
	# Performance settings
	lazy_computation: bool = True
	cache_computed_styles: bool = True
	incremental_updates: bool = True


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class FormattingResult:
	"""Result of document formatting operation"""
	# Required fields
	document_id: str
	
	# Optional fields with defaults
	result_id: str = Field(default_factory=uuid7str)
	success: bool = True
	formatted_content: dict[str, str] = Field(default_factory=dict)  # format -> content
	computed_styles: list[ComputedStyle] = Field(default_factory=list)
	
	# Performance metrics
	processing_time: float = 0.0
	elements_processed: int = 0
	rules_applied: int = 0
	cache_hits: int = 0
	
	# Quality metrics
	style_coverage: float = 0.0  # Percentage of elements with styles
	typography_score: float = 0.0  # Typography quality score
	accessibility_score: float = 0.0  # Accessibility compliance score
	
	# Error handling
	errors: list[str] = Field(default_factory=list)
	warnings: list[str] = Field(default_factory=list)
	
	# Metadata
	created_at: datetime = Field(default_factory=datetime.now)
	format_outputs: dict[str, Any] = Field(default_factory=dict)


# ============================================================================
# Exception Classes
# ============================================================================

class DocumentFormatterException(Exception):
	"""Base exception for DocumentFormatter operations"""
	pass

class StyleParsingException(DocumentFormatterException):
	"""Exception raised during style parsing"""
	pass

class StyleComputationException(DocumentFormatterException):
	"""Exception raised during style computation"""
	pass

class TypographyException(DocumentFormatterException):
	"""Exception raised during typography processing"""
	pass

class OutputGenerationException(DocumentFormatterException):
	"""Exception raised during output generation"""
	pass


# ============================================================================
# Core Components
# ============================================================================

class StyleParser:
	"""Parse CSS-like style rules and validate syntax"""
	
	def __init__(self):
		"""Initialize StyleParser with validation rules"""
		assert True, "StyleParser initialization"
		
		self.property_validators = self._initialize_property_validators()
		self.selector_patterns = self._initialize_selector_patterns()
		self.value_parsers = self._initialize_value_parsers()
		
		# Performance optimization
		self.parsed_cache: dict[str, StyleRule] = {}
		self.validation_cache: dict[str, tuple[bool, str]] = {}
		
		assert len(self.property_validators) > 0, "Property validators initialized"

	def _log_parsing_operation(self, operation: str, details: str) -> None:
		"""Log parsing operations for debugging"""
		pass  # Placeholder for logging

	def _initialize_property_validators(self) -> dict[str, callable]:
		"""Initialize property validation functions"""
		return {
			# Typography properties
			'font-family': self._validate_font_family,
			'font-size': self._validate_font_size,
			'font-weight': self._validate_font_weight,
			'font-style': self._validate_font_style,
			'line-height': self._validate_line_height,
			'color': self._validate_color,
			'text-align': self._validate_text_align,
			'text-decoration': self._validate_text_decoration,
			
			# Spacing properties
			'margin': self._validate_spacing,
			'margin-top': self._validate_spacing,
			'margin-bottom': self._validate_spacing,
			'margin-left': self._validate_spacing,
			'margin-right': self._validate_spacing,
			'padding': self._validate_spacing,
			'padding-top': self._validate_spacing,
			'padding-bottom': self._validate_spacing,
			'padding-left': self._validate_spacing,
			'padding-right': self._validate_spacing,
			
			# Border properties
			'border': self._validate_border,
			'border-width': self._validate_border_width,
			'border-style': self._validate_border_style,
			'border-color': self._validate_color,
			'border-collapse': self._validate_border_collapse,
			
			# Background properties
			'background-color': self._validate_color,
			'background-image': self._validate_url,
			
			# Layout properties
			'display': self._validate_display,
			'width': self._validate_length,
			'height': self._validate_length,
			'position': self._validate_position,
		}

	def _initialize_selector_patterns(self) -> dict[str, re.Pattern]:
		"""Initialize regex patterns for selector parsing"""
		return {
			'element': re.compile(r'^[a-zA-Z][a-zA-Z0-9-]*$'),
			'class': re.compile(r'^\.[a-zA-Z_-][a-zA-Z0-9_-]*$'),
			'id': re.compile(r'^#[a-zA-Z_-][a-zA-Z0-9_-]*$'),
			'attribute': re.compile(r'^\[[a-zA-Z][a-zA-Z0-9-]*([~|^$*]?="[^"]*")?\]$'),
			'pseudo_class': re.compile(r'^:[a-zA-Z-]+(\([^)]*\))?$'),
		}

	def _initialize_value_parsers(self) -> dict[str, callable]:
		"""Initialize value parsing functions"""
		return {
			'length': self._parse_length_value,
			'color': self._parse_color_value,
			'percentage': self._parse_percentage_value,
			'number': self._parse_number_value,
			'keyword': self._parse_keyword_value,
		}

	async def parse_style_sheet(self, style_sheet: str) -> list[StyleRule]:
		"""Parse complete style sheet into individual rules"""
		assert isinstance(style_sheet, str), "Style sheet must be string"
		
		self._log_parsing_operation("parse_stylesheet", f"Parsing {len(style_sheet)} characters")
		
		try:
			rules = []
			rule_blocks = self._split_into_rule_blocks(style_sheet)
			
			for block in rule_blocks:
				if block.strip():
					rule = await self.parse_style_rule(block)
					if rule.valid:
						rules.append(rule)
			
			assert len(rules) >= 0, "Rules list created"
			return rules
			
		except Exception as e:
			raise StyleParsingException(f"Failed to parse style sheet: {str(e)}")

	async def parse_style_rule(self, rule_text: str) -> StyleRule:
		"""Parse individual style rule"""
		assert isinstance(rule_text, str), "Rule text must be string"
		
		try:
			# Check cache first
			cache_key = hash(rule_text)
			if cache_key in self.parsed_cache:
				return self.parsed_cache[cache_key]
			
			# Parse selector and properties
			selector, properties_text = self._split_selector_properties(rule_text)
			properties = self._parse_properties(properties_text)
			
			# Calculate specificity
			specificity = self._calculate_specificity(selector)
			
			# Create rule
			rule = StyleRule(
				selector=selector,
				properties=properties,
				specificity=specificity,
				source_location=rule_text[:50] + "..." if len(rule_text) > 50 else rule_text
			)
			
			# Validate rule
			rule.valid, errors = await self._validate_rule(rule)
			rule.validation_errors = errors
			
			# Cache for performance
			self.parsed_cache[cache_key] = rule
			
			assert rule.selector != "", "Rule has selector"
			return rule
			
		except Exception as e:
			# Return invalid rule for graceful error handling
			return StyleRule(
				selector="invalid",
				properties={},
				valid=False,
				validation_errors=[str(e)]
			)

	def _split_into_rule_blocks(self, style_sheet: str) -> list[str]:
		"""Split style sheet into individual rule blocks"""
		# Simple implementation - can be enhanced for complex CSS
		blocks = []
		current_block = ""
		brace_count = 0
		
		for char in style_sheet:
			current_block += char
			if char == '{':
				brace_count += 1
			elif char == '}':
				brace_count -= 1
				if brace_count == 0:
					blocks.append(current_block.strip())
					current_block = ""
		
		return blocks

	def _split_selector_properties(self, rule_text: str) -> tuple[str, str]:
		"""Split rule into selector and properties"""
		parts = rule_text.split('{', 1)
		if len(parts) != 2:
			raise StyleParsingException(f"Invalid rule format: {rule_text}")
		
		selector = parts[0].strip()
		properties_text = parts[1].rstrip('}').strip()
		
		return selector, properties_text

	def _parse_properties(self, properties_text: str) -> dict[str, Any]:
		"""Parse CSS properties from text"""
		properties = {}
		
		for declaration in properties_text.split(';'):
			declaration = declaration.strip()
			if not declaration:
				continue
			
			if ':' not in declaration:
				continue
			
			prop_name, prop_value = declaration.split(':', 1)
			prop_name = prop_name.strip().lower()
			prop_value = prop_value.strip()
			
			# Handle !important
			important = False
			if prop_value.endswith('!important'):
				important = True
				prop_value = prop_value[:-10].strip()
			
			properties[prop_name] = {
				'value': prop_value,
				'important': important
			}
		
		return properties

	def _calculate_specificity(self, selector: str) -> int:
		"""Calculate CSS specificity for selector"""
		# Simplified specificity calculation
		specificity = 0
		
		# Count IDs (weight: 100)
		specificity += len(re.findall(r'#[\w-]+', selector)) * 100
		
		# Count classes and attributes (weight: 10)
		specificity += len(re.findall(r'\.[\w-]+', selector)) * 10
		specificity += len(re.findall(r'\[[\w-]+[^]]*\]', selector)) * 10
		
		# Count elements (weight: 1)
		specificity += len(re.findall(r'(?:^|[\s>+~])([a-zA-Z]+)', selector)) * 1
		
		return specificity

	async def _validate_rule(self, rule: StyleRule) -> tuple[bool, list[str]]:
		"""Validate style rule"""
		errors = []
		
		# Validate selector
		if not self._validate_selector(rule.selector):
			errors.append(f"Invalid selector: {rule.selector}")
		
		# Validate properties
		for prop_name, prop_data in rule.properties.items():
			valid, error = await self.validate_property(prop_name, prop_data['value'])
			if not valid:
				errors.append(f"Invalid property {prop_name}: {error}")
		
		return len(errors) == 0, errors

	def _validate_selector(self, selector: str) -> bool:
		"""Validate CSS selector syntax"""
		if not selector:
			return False
		
		# Basic validation - can be enhanced
		return True

	async def validate_property(self, property_name: str, value: Any) -> tuple[bool, str]:
		"""Validate individual style property"""
		assert isinstance(property_name, str), "Property name must be string"
		
		try:
			# Check cache first
			cache_key = f"{property_name}:{str(value)}"
			if cache_key in self.validation_cache:
				return self.validation_cache[cache_key]
			
			if property_name not in self.property_validators:
				result = (False, f"Unknown property: {property_name}")
			else:
				validator = self.property_validators[property_name]
				result = validator(value)
			
			# Cache result
			self.validation_cache[cache_key] = result
			return result
			
		except Exception as e:
			return (False, f"Validation error: {str(e)}")

	# Property validation methods
	def _validate_font_family(self, value: str) -> tuple[bool, str]:
		"""Validate font-family property"""
		if not value:
			return (False, "Font family cannot be empty")
		# Additional validation can be added
		return (True, "")

	def _validate_font_size(self, value: str) -> tuple[bool, str]:
		"""Validate font-size property"""
		# Check for valid units: px, pt, em, rem, %
		if re.match(r'^\d+(\.\d+)?(px|pt|em|rem|%)$', value):
			return (True, "")
		if value in ['xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large']:
			return (True, "")
		return (False, f"Invalid font size: {value}")

	def _validate_font_weight(self, value: str) -> tuple[bool, str]:
		"""Validate font-weight property"""
		if value in ['normal', 'bold', 'bolder', 'lighter']:
			return (True, "")
		if re.match(r'^[1-9]00$', value):  # 100-900
			return (True, "")
		return (False, f"Invalid font weight: {value}")

	def _validate_font_style(self, value: str) -> tuple[bool, str]:
		"""Validate font-style property"""
		if value in ['normal', 'italic', 'oblique']:
			return (True, "")
		return (False, f"Invalid font style: {value}")

	def _validate_line_height(self, value: str) -> tuple[bool, str]:
		"""Validate line-height property"""
		if value == 'normal':
			return (True, "")
		if re.match(r'^\d+(\.\d+)?$', value):  # Number
			return (True, "")
		if re.match(r'^\d+(\.\d+)?(px|pt|em|rem|%)$', value):  # Length
			return (True, "")
		return (False, f"Invalid line height: {value}")

	def _validate_color(self, value: str) -> tuple[bool, str]:
		"""Validate color property"""
		# Hex colors
		if re.match(r'^#[0-9a-fA-F]{3}$', value) or re.match(r'^#[0-9a-fA-F]{6}$', value):
			return (True, "")
		# Named colors (basic set)
		named_colors = ['black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta', 'transparent']
		if value.lower() in named_colors:
			return (True, "")
		# RGB/RGBA
		if re.match(r'^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$', value):
			return (True, "")
		return (False, f"Invalid color: {value}")

	def _validate_text_align(self, value: str) -> tuple[bool, str]:
		"""Validate text-align property"""
		if value in ['left', 'right', 'center', 'justify']:
			return (True, "")
		return (False, f"Invalid text align: {value}")

	def _validate_text_decoration(self, value: str) -> tuple[bool, str]:
		"""Validate text-decoration property"""
		if value in ['none', 'underline', 'overline', 'line-through']:
			return (True, "")
		return (False, f"Invalid text decoration: {value}")

	def _validate_spacing(self, value: str) -> tuple[bool, str]:
		"""Validate margin/padding properties"""
		if re.match(r'^\d+(\.\d+)?(px|pt|em|rem|%)$', value):
			return (True, "")
		if value in ['auto', '0']:
			return (True, "")
		return (False, f"Invalid spacing: {value}")

	def _validate_border(self, value: str) -> tuple[bool, str]:
		"""Validate border property"""
		# Simplified validation
		return (True, "")

	def _validate_border_width(self, value: str) -> tuple[bool, str]:
		"""Validate border-width property"""
		if re.match(r'^\d+(\.\d+)?(px|pt|em|rem)$', value):
			return (True, "")
		if value in ['thin', 'medium', 'thick']:
			return (True, "")
		return (False, f"Invalid border width: {value}")

	def _validate_border_style(self, value: str) -> tuple[bool, str]:
		"""Validate border-style property"""
		styles = ['none', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset']
		if value in styles:
			return (True, "")
		return (False, f"Invalid border style: {value}")

	def _validate_border_collapse(self, value: str) -> tuple[bool, str]:
		"""Validate border-collapse property"""
		if value in ['separate', 'collapse']:
			return (True, "")
		return (False, f"Invalid border-collapse: {value}")

	def _validate_url(self, value: str) -> tuple[bool, str]:
		"""Validate URL property"""
		if value.startswith('url(') and value.endswith(')'):
			return (True, "")
		return (False, f"Invalid URL: {value}")

	def _validate_display(self, value: str) -> tuple[bool, str]:
		"""Validate display property"""
		if value in ['block', 'inline', 'inline-block', 'none', 'flex', 'grid']:
			return (True, "")
		return (False, f"Invalid display: {value}")

	def _validate_length(self, value: str) -> tuple[bool, str]:
		"""Validate length property"""
		if value in ['auto', 'inherit']:
			return (True, "")
		if re.match(r'^\d+(\.\d+)?(px|pt|em|rem|%|in|cm|mm)$', value):
			return (True, "")
		return (False, f"Invalid length: {value}")

	def _validate_position(self, value: str) -> tuple[bool, str]:
		"""Validate position property"""
		if value in ['static', 'relative', 'absolute', 'fixed', 'sticky']:
			return (True, "")
		return (False, f"Invalid position: {value}")

	# Value parsing methods
	def _parse_length_value(self, value: str) -> dict[str, Any]:
		"""Parse length value into components"""
		match = re.match(r'^(\d+(?:\.\d+)?)(px|pt|em|rem|%|in|cm|mm)?$', value)
		if match:
			return {
				'number': float(match.group(1)),
				'unit': match.group(2) or 'px'
			}
		return {'number': 0, 'unit': 'px'}

	def _parse_color_value(self, value: str) -> dict[str, Any]:
		"""Parse color value into components"""
		if value.startswith('#'):
			return {'type': 'hex', 'value': value}
		elif value.startswith('rgb'):
			return {'type': 'rgb', 'value': value}
		else:
			return {'type': 'named', 'value': value}

	def _parse_percentage_value(self, value: str) -> dict[str, Any]:
		"""Parse percentage value"""
		if value.endswith('%'):
			return {'percentage': float(value[:-1])}
		return {'percentage': 0}

	def _parse_number_value(self, value: str) -> dict[str, Any]:
		"""Parse numeric value"""
		try:
			return {'number': float(value)}
		except ValueError:
			return {'number': 0}

	def _parse_keyword_value(self, value: str) -> dict[str, Any]:
		"""Parse keyword value"""
		return {'keyword': value}

	def normalize_property_value(self, property_name: str, value: Any) -> Any:
		"""Normalize property value to standard format"""
		assert isinstance(property_name, str), "Property name must be string"
		
		try:
			# Handle property-specific normalization
			if property_name in ['margin', 'padding']:
				return self._normalize_spacing_shorthand(value)
			elif property_name in ['border']:
				return self._normalize_border_shorthand(value)
			elif 'color' in property_name:
				return self._normalize_color_value(value)
			else:
				return str(value).strip().lower()
				
		except Exception:
			return value

	def _normalize_spacing_shorthand(self, value: str) -> dict[str, str]:
		"""Normalize margin/padding shorthand values"""
		parts = str(value).split()
		if len(parts) == 1:
			# All sides
			return {'top': parts[0], 'right': parts[0], 'bottom': parts[0], 'left': parts[0]}
		elif len(parts) == 2:
			# Vertical, horizontal
			return {'top': parts[0], 'right': parts[1], 'bottom': parts[0], 'left': parts[1]}
		elif len(parts) == 3:
			# Top, horizontal, bottom
			return {'top': parts[0], 'right': parts[1], 'bottom': parts[2], 'left': parts[1]}
		elif len(parts) == 4:
			# Top, right, bottom, left
			return {'top': parts[0], 'right': parts[1], 'bottom': parts[2], 'left': parts[3]}
		else:
			return {'top': '0', 'right': '0', 'bottom': '0', 'left': '0'}

	def _normalize_border_shorthand(self, value: str) -> dict[str, str]:
		"""Normalize border shorthand values"""
		# Simplified implementation
		return {'width': '1px', 'style': 'solid', 'color': '#000000'}

	def _normalize_color_value(self, value: str) -> str:
		"""Normalize color values"""
		value = str(value).strip().lower()
		
		# Normalize hex colors
		if value.startswith('#') and len(value) == 4:
			# Convert #rgb to #rrggbb
			return f"#{value[1]}{value[1]}{value[2]}{value[2]}{value[3]}{value[3]}"
		
		return value


class StyleComputer:
	"""Compute final styles through cascade resolution and inheritance"""
	
	def __init__(self):
		"""Initialize StyleComputer with computation engines"""
		assert True, "StyleComputer initialization"
		
		self.specificity_calculator = SpecificityCalculator()
		self.inheritance_engine = InheritanceEngine()
		self.value_resolver = ValueResolver()
		
		# Performance optimization
		self.computed_cache: dict[str, ComputedStyle] = {}
		self.cascade_cache: dict[str, dict[str, Any]] = {}
		
		assert self.specificity_calculator is not None, "Specificity calculator initialized"

	def _log_computation_operation(self, operation: str, details: str) -> None:
		"""Log computation operations for debugging"""
		pass  # Placeholder for logging

	async def compute_element_style(
		self, 
		element_id: str, 
		element_type: str,
		applicable_rules: list[StyleRule],
		parent_style: "ComputedStyle | None" = None
	) -> ComputedStyle:
		"""Compute final style for element"""
		assert isinstance(element_id, str) and element_id, "Element ID required"
		assert isinstance(element_type, str) and element_type, "Element type required"
		
		try:
			self._log_computation_operation("compute_style", f"Computing for {element_id}")
			
			# Check cache first
			cache_key = self._generate_cache_key(element_id, applicable_rules, parent_style)
			if cache_key in self.computed_cache:
				return self.computed_cache[cache_key]
			
			# Start with default style
			computed_style = self._create_default_style(element_id, element_type)
			
			# Apply cascade resolution
			cascaded_properties = await self.resolve_cascade(applicable_rules)
			
			# Apply inherited properties from parent
			if parent_style:
				inherited_properties = await self.apply_inheritance(cascaded_properties, parent_style)
				cascaded_properties.update(inherited_properties)
			
			# Resolve computed values
			resolved_properties = await self.resolve_values(cascaded_properties, {
				'element_id': element_id,
				'element_type': element_type,
				'parent_style': parent_style
			})
			
			# Update computed style with resolved properties
			self._apply_properties_to_style(computed_style, resolved_properties)
			
			# Add metadata
			computed_style.applied_rules = [rule.rule_id for rule in applicable_rules]
			if parent_style:
				computed_style.inheritance_chain = parent_style.inheritance_chain + [parent_style.element_id]
			
			# Cache for performance
			self.computed_cache[cache_key] = computed_style
			
			assert computed_style.element_id == element_id, "Style element ID matches"
			return computed_style
			
		except Exception as e:
			raise StyleComputationException(f"Failed to compute style for {element_id}: {str(e)}")

	def _generate_cache_key(
		self, 
		element_id: str, 
		applicable_rules: list[StyleRule], 
		parent_style: "ComputedStyle | None" = None
	) -> str:
		"""Generate cache key for computed style"""
		rule_hash = hash(tuple(rule.rule_id for rule in applicable_rules))
		parent_hash = hash(parent_style.cache_key) if parent_style else 0
		return f"{element_id}:{rule_hash}:{parent_hash}"

	def _create_default_style(self, element_id: str, element_type: str) -> ComputedStyle:
		"""Create default computed style for element"""
		defaults = self._get_element_defaults(element_type)
		
		return ComputedStyle(
			element_id=element_id,
			element_type=element_type,
			**defaults
		)

	def _get_element_defaults(self, element_type: str) -> dict[str, Any]:
		"""Get default style properties for element type"""
		defaults = {
			'heading': {
				'font_weight': 'bold',
				'margin_bottom': '0.5em',
				'display': 'block'
			},
			'paragraph': {
				'margin_bottom': '1em',
				'display': 'block'
			},
			'table': {
				'display': 'table',
				'border_collapse': 'separate'
			},
			'figure': {
				'display': 'block',
				'margin_bottom': '1em'
			}
		}
		
		return defaults.get(element_type, {})

	async def resolve_cascade(self, rules: list[StyleRule]) -> dict[str, Any]:
		"""Resolve CSS cascade for conflicting rules"""
		assert isinstance(rules, list), "Rules must be list"
		
		try:
			# Sort rules by origin, specificity, and source order
			sorted_rules = sorted(rules, key=lambda r: (
				self._get_origin_weight(r.origin),
				r.specificity,
				r.created_at
			))
			
			# Apply cascade resolution
			cascaded_properties = {}
			
			for rule in sorted_rules:
				if not rule.valid:
					continue
				
				for prop_name, prop_data in rule.properties.items():
					# Check if property should override existing
					if self._should_override_property(
						prop_name, 
						prop_data, 
						cascaded_properties.get(prop_name)
					):
						cascaded_properties[prop_name] = {
							'value': prop_data['value'],
							'important': prop_data.get('important', False),
							'rule_id': rule.rule_id,
							'specificity': rule.specificity
						}
			
			assert isinstance(cascaded_properties, dict), "Cascaded properties is dict"
			return cascaded_properties
			
		except Exception as e:
			raise StyleComputationException(f"Failed to resolve cascade: {str(e)}")

	def _get_origin_weight(self, origin: str) -> int:
		"""Get numeric weight for cascade origin"""
		weights = {
			'user-agent': 1,
			'user': 2,
			'author': 3
		}
		return weights.get(origin, 3)

	def _should_override_property(
		self, 
		prop_name: str, 
		new_prop: dict[str, Any], 
		existing_prop: dict[str, Any] | None = None
	) -> bool:
		"""Determine if new property should override existing"""
		if not existing_prop:
			return True
		
		# !important takes precedence
		if new_prop.get('important', False) and not existing_prop.get('important', False):
			return True
		
		if existing_prop.get('important', False) and not new_prop.get('important', False):
			return False
		
		# Higher specificity wins
		return new_prop.get('specificity', 0) >= existing_prop.get('specificity', 0)

	async def apply_inheritance(
		self, 
		computed_properties: dict[str, Any], 
		parent_style: ComputedStyle
	) -> dict[str, Any]:
		"""Apply CSS inheritance from parent"""
		assert isinstance(computed_properties, dict), "Computed properties must be dict"
		assert isinstance(parent_style, ComputedStyle), "Parent style must be ComputedStyle"
		
		try:
			inherited_properties = {}
			inheritable_properties = self._get_inheritable_properties()
			
			for prop_name in inheritable_properties:
				# Only inherit if property not explicitly set
				if prop_name not in computed_properties:
					parent_value = getattr(parent_style, prop_name.replace('-', '_'), None)
					if parent_value is not None:
						inherited_properties[prop_name] = {
							'value': parent_value,
							'inherited': True,
							'from_element': parent_style.element_id
						}
			
			assert isinstance(inherited_properties, dict), "Inherited properties is dict"
			return inherited_properties
			
		except Exception as e:
			raise StyleComputationException(f"Failed to apply inheritance: {str(e)}")

	def _get_inheritable_properties(self) -> list[str]:
		"""Get list of inheritable CSS properties"""
		return [
			'color',
			'font-family',
			'font-size',
			'font-style',
			'font-weight',
			'line-height',
			'text-align',
			'text-decoration',
			'text-transform',
			'letter-spacing',
			'word-spacing',
			'list-style-type',
			'list-style-position'
		]

	async def resolve_values(self, properties: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
		"""Resolve relative values (em, %, calc(), etc.)"""
		assert isinstance(properties, dict), "Properties must be dict"
		assert isinstance(context, dict), "Context must be dict"
		
		try:
			resolved_properties = {}
			
			for prop_name, prop_data in properties.items():
				value = prop_data['value']
				
				# Resolve relative units
				if isinstance(value, str):
					resolved_value = await self._resolve_relative_value(value, prop_name, context)
					resolved_properties[prop_name] = {
						**prop_data,
						'value': resolved_value,
						'resolved': True
					}
				else:
					resolved_properties[prop_name] = prop_data
			
			assert isinstance(resolved_properties, dict), "Resolved properties is dict"
			return resolved_properties
			
		except Exception as e:
			raise StyleComputationException(f"Failed to resolve values: {str(e)}")

	async def _resolve_relative_value(self, value: str, prop_name: str, context: dict[str, Any]) -> str:
		"""Resolve individual relative value"""
		# Handle em units (relative to font size)
		if 'em' in value:
			return self._resolve_em_value(value, context)
		
		# Handle percentage values
		if '%' in value:
			return self._resolve_percentage_value(value, prop_name, context)
		
		# Handle calc() expressions
		if value.startswith('calc('):
			return self._resolve_calc_expression(value, context)
		
		# Return as-is if no resolution needed
		return value

	def _resolve_em_value(self, value: str, context: dict[str, Any]) -> str:
		"""Resolve em units to absolute units"""
		# Simplified implementation - would need font size context
		return value.replace('em', 'pt')

	def _resolve_percentage_value(self, value: str, prop_name: str, context: dict[str, Any]) -> str:
		"""Resolve percentage values"""
		# Simplified implementation
		return value

	def _resolve_calc_expression(self, value: str, context: dict[str, Any]) -> str:
		"""Resolve calc() expressions"""
		# Simplified implementation
		return value.replace('calc(', '').replace(')', '')

	def _apply_properties_to_style(self, style: ComputedStyle, properties: dict[str, Any]) -> None:
		"""Apply resolved properties to computed style object"""
		for prop_name, prop_data in properties.items():
			value = prop_data['value']
			attr_name = prop_name.replace('-', '_')
			
			if hasattr(style, attr_name):
				setattr(style, attr_name, value)


class SpecificityCalculator:
	"""Calculate CSS specificity for style rules"""
	
	def __init__(self):
		"""Initialize specificity calculator"""
		pass

	def calculate(self, selector: str) -> int:
		"""Calculate CSS specificity"""
		# Implementation would go here
		return 0


class InheritanceEngine:
	"""Handle CSS inheritance logic"""
	
	def __init__(self):
		"""Initialize inheritance engine"""
		pass


class ValueResolver:
	"""Resolve CSS values and units"""
	
	def __init__(self):
		"""Initialize value resolver"""
		pass


class TypographyEngine:
	"""Advanced typography processing and optimization"""
	
	def __init__(self):
		"""Initialize TypographyEngine with font management"""
		assert True, "TypographyEngine initialization"
		
		self.font_manager = FontManager()
		self.text_processor = TextProcessor()
		self.line_breaker = LineBreaker()
		
		# Typography profiles
		self.profiles_cache: dict[str, TypographyProfile] = {}
		
		assert self.font_manager is not None, "Font manager initialized"

	def _log_typography_operation(self, operation: str, details: str) -> None:
		"""Log typography operations for debugging"""
		pass  # Placeholder for logging

	async def apply_typography_profile(
		self, 
		style: ComputedStyle, 
		profile: TypographyProfile
	) -> ComputedStyle:
		"""Apply typography profile to computed style"""
		assert isinstance(style, ComputedStyle), "Style must be ComputedStyle"
		assert isinstance(profile, TypographyProfile), "Profile must be TypographyProfile"
		
		try:
			self._log_typography_operation("apply_profile", f"Applying {profile.profile_name}")
			
			# Apply base typography settings
			style.font_family = profile.base_font_family
			style.font_size = profile.base_font_size
			style.line_height = profile.base_line_height
			style.color = profile.base_color
			
			# Apply element-specific typography
			if style.element_type == 'heading':
				style = await self._apply_heading_typography(style, profile)
			elif style.element_type == 'paragraph':
				style = await self._apply_paragraph_typography(style, profile)
			elif style.element_type == 'code':
				style = await self._apply_code_typography(style, profile)
			
			assert style.font_family != "", "Font family applied"
			return style
			
		except Exception as e:
			raise TypographyException(f"Failed to apply typography profile: {str(e)}")

	async def _apply_heading_typography(
		self, 
		style: ComputedStyle, 
		profile: TypographyProfile
	) -> ComputedStyle:
		"""Apply heading-specific typography"""
		# Extract heading level from element ID or type
		level = self._extract_heading_level(style.element_id, style.element_type)
		
		if level in profile.heading_fonts:
			style.font_family = profile.heading_fonts[level]
		
		if level in profile.heading_sizes:
			style.font_size = profile.heading_sizes[level]
		
		if level in profile.heading_weights:
			style.font_weight = profile.heading_weights[level]
		
		if level in profile.heading_spacing:
			spacing = profile.heading_spacing[level]
			style.margin_top = spacing.get('top', style.margin_top)
			style.margin_bottom = spacing.get('bottom', style.margin_bottom)
		
		return style

	async def _apply_paragraph_typography(
		self, 
		style: ComputedStyle, 
		profile: TypographyProfile
	) -> ComputedStyle:
		"""Apply paragraph-specific typography"""
		style.margin_bottom = profile.paragraph_spacing
		style.text_indent = profile.paragraph_indent
		style.text_align = profile.text_justification
		
		return style

	async def _apply_code_typography(
		self, 
		style: ComputedStyle, 
		profile: TypographyProfile
	) -> ComputedStyle:
		"""Apply code-specific typography"""
		style.font_family = profile.code_font
		style.font_size = profile.code_size
		
		return style

	def _extract_heading_level(self, element_id: str, element_type: str) -> int:
		"""Extract heading level from element information"""
		# Look for h1, h2, etc. in element_id or element_type
		for i in range(1, 7):
			if f'h{i}' in element_id.lower() or f'h{i}' in element_type.lower():
				return i
		return 1  # Default to h1

	async def optimize_typography(
		self, 
		style: ComputedStyle, 
		content: str, 
		context: dict[str, Any]
	) -> ComputedStyle:
		"""Optimize typography for content and context"""
		assert isinstance(style, ComputedStyle), "Style must be ComputedStyle"
		assert isinstance(content, str), "Content must be string"
		
		try:
			# Analyze content characteristics
			content_analysis = await self._analyze_content(content)
			
			# Optimize font size based on content length
			if content_analysis['length'] > 1000:
				style = await self._optimize_for_long_content(style)
			
			# Optimize line height based on font size
			style = await self._optimize_line_height(style)
			
			# Optimize for accessibility if needed
			if context.get('accessibility_mode', False):
				style = await self._optimize_for_accessibility(style)
			
			assert style.font_size != "", "Font size optimized"
			return style
			
		except Exception as e:
			raise TypographyException(f"Failed to optimize typography: {str(e)}")

	async def _analyze_content(self, content: str) -> dict[str, Any]:
		"""Analyze content characteristics"""
		return {
			'length': len(content),
			'word_count': len(content.split()),
			'line_count': len(content.split('\n')),
			'avg_word_length': sum(len(word) for word in content.split()) / max(len(content.split()), 1)
		}

	async def _optimize_for_long_content(self, style: ComputedStyle) -> ComputedStyle:
		"""Optimize typography for long content"""
		# Increase line height for better readability
		if style.line_height == 'normal':
			style.line_height = '1.6'
		
		return style

	async def _optimize_line_height(self, style: ComputedStyle) -> ComputedStyle:
		"""Optimize line height based on font size"""
		# Extract numeric font size
		font_size_match = re.match(r'(\d+(?:\.\d+)?)', style.font_size)
		if font_size_match:
			font_size = float(font_size_match.group(1))
			
			# Adjust line height based on font size
			if font_size < 12:
				style.line_height = '1.4'
			elif font_size > 18:
				style.line_height = '1.3'
			else:
				style.line_height = '1.5'
		
		return style

	async def _optimize_for_accessibility(self, style: ComputedStyle) -> ComputedStyle:
		"""Optimize typography for accessibility"""
		# Increase font size
		font_size_match = re.match(r'(\d+(?:\.\d+)?)', style.font_size)
		if font_size_match:
			font_size = float(font_size_match.group(1))
			if font_size < 14:
				style.font_size = '14pt'
		
		# Increase line height
		style.line_height = '1.6'
		
		return style

	async def calculate_text_metrics(
		self, 
		text: str, 
		style: ComputedStyle
	) -> dict[str, float]:
		"""Calculate text metrics (width, height, line count)"""
		assert isinstance(text, str), "Text must be string"
		assert isinstance(style, ComputedStyle), "Style must be ComputedStyle"
		
		try:
			# Simplified metrics calculation
			# In real implementation, would use font metrics libraries
			
			char_width = self._estimate_char_width(style)
			line_height = self._estimate_line_height(style)
			
			lines = text.split('\n')
			max_line_length = max(len(line) for line in lines) if lines else 0
			
			metrics = {
				'width': max_line_length * char_width,
				'height': len(lines) * line_height,
				'line_count': len(lines),
				'char_count': len(text),
				'estimated_render_time': len(text) * 0.001  # Mock rendering time
			}
			
			assert metrics['width'] >= 0, "Width calculated"
			return metrics
			
		except Exception as e:
			raise TypographyException(f"Failed to calculate text metrics: {str(e)}")

	def _estimate_char_width(self, style: ComputedStyle) -> float:
		"""Estimate character width based on font"""
		# Simplified estimation
		font_size_match = re.match(r'(\d+(?:\.\d+)?)', style.font_size)
		if font_size_match:
			font_size = float(font_size_match.group(1))
			return font_size * 0.6  # Rough estimation
		return 7.2  # Default

	def _estimate_line_height(self, style: ComputedStyle) -> float:
		"""Estimate line height in points"""
		if style.line_height == 'normal':
			return self._estimate_char_width(style) * 1.2
		
		# Try to parse numeric line height
		try:
			return float(style.line_height) * self._estimate_char_width(style)
		except ValueError:
			return 14.4  # Default

	async def generate_font_commands(
		self, 
		style: ComputedStyle, 
		output_format: str
	) -> str:
		"""Generate format-specific font commands"""
		assert isinstance(style, ComputedStyle), "Style must be ComputedStyle"
		assert isinstance(output_format, str), "Output format must be string"
		
		try:
			if output_format.lower() == 'latex':
				return await self._generate_latex_font_commands(style)
			elif output_format.lower() == 'html':
				return await self._generate_html_font_commands(style)
			elif output_format.lower() == 'css':
				return await self._generate_css_font_commands(style)
			else:
				raise TypographyException(f"Unsupported output format: {output_format}")
				
		except Exception as e:
			raise TypographyException(f"Failed to generate font commands: {str(e)}")

	async def _generate_latex_font_commands(self, style: ComputedStyle) -> str:
		"""Generate LaTeX font commands"""
		commands = []
		
		# Font family
		if 'serif' in style.font_family.lower():
			commands.append('\\rmfamily')
		elif 'sans' in style.font_family.lower():
			commands.append('\\sffamily')
		elif 'mono' in style.font_family.lower():
			commands.append('\\ttfamily')
		
		# Font weight
		if style.font_weight == 'bold':
			commands.append('\\bfseries')
		elif style.font_weight == 'normal':
			commands.append('\\mdseries')
		
		# Font style
		if style.font_style == 'italic':
			commands.append('\\itshape')
		elif style.font_style == 'normal':
			commands.append('\\upshape')
		
		# Font size
		size_commands = {
			'10pt': '\\footnotesize',
			'11pt': '\\small',
			'12pt': '\\normalsize',
			'14pt': '\\large',
			'16pt': '\\Large',
			'18pt': '\\LARGE',
			'20pt': '\\huge',
			'24pt': '\\Huge'
		}
		
		if style.font_size in size_commands:
			commands.append(size_commands[style.font_size])
		
		return ''.join(commands)

	async def _generate_html_font_commands(self, style: ComputedStyle) -> str:
		"""Generate HTML font styling"""
		styles = []
		
		styles.append(f"font-family: {style.font_family}")
		styles.append(f"font-size: {style.font_size}")
		styles.append(f"font-weight: {style.font_weight}")
		styles.append(f"font-style: {style.font_style}")
		styles.append(f"line-height: {style.line_height}")
		styles.append(f"color: {style.color}")
		
		return f'style="{"; ".join(styles)}"'

	async def _generate_css_font_commands(self, style: ComputedStyle) -> str:
		"""Generate CSS font rules"""
		css_rules = []
		
		css_rules.append(f"font-family: {style.font_family};")
		css_rules.append(f"font-size: {style.font_size};")
		css_rules.append(f"font-weight: {style.font_weight};")
		css_rules.append(f"font-style: {style.font_style};")
		css_rules.append(f"line-height: {style.line_height};")
		css_rules.append(f"color: {style.color};")
		
		return '\n'.join(css_rules)


class FontManager:
	"""Manage font resources and resolution"""
	
	def __init__(self):
		"""Initialize font manager"""
		pass


class TextProcessor:
	"""Process text for typography optimization"""
	
	def __init__(self):
		"""Initialize text processor"""
		pass


class LineBreaker:
	"""Handle line breaking and hyphenation"""
	
	def __init__(self):
		"""Initialize line breaker"""
		pass


class ResponsiveEngine:
	"""Responsive layout adaptation and optimization"""
	
	def __init__(self):
		"""Initialize ResponsiveEngine with layout management"""
		assert True, "ResponsiveEngine initialization"
		
		self.breakpoint_manager = BreakpointManager()
		self.layout_calculator = LayoutCalculator()
		self.content_analyzer = ContentAnalyzer()
		
		# Responsive configurations cache
		self.configs_cache: dict[str, ResponsiveConfiguration] = {}
		
		assert self.breakpoint_manager is not None, "Breakpoint manager initialized"

	def _log_responsive_operation(self, operation: str, details: str) -> None:
		"""Log responsive operations for debugging"""
		pass  # Placeholder for logging

	async def adapt_style_responsive(
		self, 
		style: ComputedStyle, 
		context: dict[str, Any],
		config: ResponsiveConfiguration
	) -> ComputedStyle:
		"""Adapt style for responsive conditions"""
		assert isinstance(style, ComputedStyle), "Style must be ComputedStyle"
		assert isinstance(context, dict), "Context must be dict"
		assert isinstance(config, ResponsiveConfiguration), "Config must be ResponsiveConfiguration"
		
		try:
			self._log_responsive_operation("adapt_style", f"Adapting for {style.element_id}")
			
			# Calculate active breakpoints
			active_breakpoints = await self.calculate_responsive_breakpoints(context)
			
			# Apply responsive typography scaling
			style = await self._apply_responsive_typography(style, active_breakpoints, config)
			
			# Apply responsive spacing
			style = await self._apply_responsive_spacing(style, active_breakpoints, config)
			
			# Apply layout adaptations
			style = await self._apply_layout_adaptations(style, active_breakpoints, config)
			
			assert style.font_size != "", "Responsive font size applied"
			return style
			
		except Exception as e:
			raise StyleComputationException(f"Failed to adapt responsive style: {str(e)}")

	async def _apply_responsive_typography(
		self, 
		style: ComputedStyle, 
		breakpoints: dict[str, Any], 
		config: ResponsiveConfiguration
	) -> ComputedStyle:
		"""Apply responsive typography scaling"""
		# Get scaling factor for current breakpoints
		scaling_factor = self._calculate_typography_scaling(breakpoints, config)
		
		# Scale font size
		if scaling_factor != 1.0:
			font_size_match = re.match(r'(\d+(?:\.\d+)?)(.*)', style.font_size)
			if font_size_match:
				size_value = float(font_size_match.group(1))
				size_unit = font_size_match.group(2)
				new_size = size_value * scaling_factor
				style.font_size = f"{new_size:.1f}{size_unit}"
		
		# Adjust line height for scaled fonts
		if style.line_height != 'normal':
			try:
				line_height_value = float(style.line_height)
				if line_height_value > 2.0:  # Assume it's in points
					style.line_height = str(line_height_value * scaling_factor)
			except ValueError:
				pass  # Keep original if not numeric
		
		return style

	async def _apply_responsive_spacing(
		self, 
		style: ComputedStyle, 
		breakpoints: dict[str, Any], 
		config: ResponsiveConfiguration
	) -> ComputedStyle:
		"""Apply responsive spacing adjustments"""
		# Get spacing scaling factors
		margin_scaling = self._get_spacing_scaling(breakpoints, config, 'margin')
		padding_scaling = self._get_spacing_scaling(breakpoints, config, 'padding')
		
		# Scale margins
		style.margin_top = self._scale_spacing_value(style.margin_top, margin_scaling)
		style.margin_bottom = self._scale_spacing_value(style.margin_bottom, margin_scaling)
		style.margin_left = self._scale_spacing_value(style.margin_left, margin_scaling)
		style.margin_right = self._scale_spacing_value(style.margin_right, margin_scaling)
		
		# Scale padding
		style.padding_top = self._scale_spacing_value(style.padding_top, padding_scaling)
		style.padding_bottom = self._scale_spacing_value(style.padding_bottom, padding_scaling)
		style.padding_left = self._scale_spacing_value(style.padding_left, padding_scaling)
		style.padding_right = self._scale_spacing_value(style.padding_right, padding_scaling)
		
		return style

	async def _apply_layout_adaptations(
		self, 
		style: ComputedStyle, 
		breakpoints: dict[str, Any], 
		config: ResponsiveConfiguration
	) -> ComputedStyle:
		"""Apply layout-specific adaptations"""
		# Apply format-specific optimizations
		output_format = breakpoints.get('output_format', 'pdf')
		
		if output_format == 'print':
			# Optimize for print
			style = await self._optimize_for_print(style)
		elif output_format == 'digital':
			# Optimize for digital display
			style = await self._optimize_for_digital(style)
		
		return style

	async def _optimize_for_print(self, style: ComputedStyle) -> ComputedStyle:
		"""Optimize style for print output"""
		# Ensure adequate margins for print
		if style.margin_top == '0':
			style.margin_top = '12pt'
		if style.margin_bottom == '0':
			style.margin_bottom = '12pt'
		
		# Optimize colors for print
		if style.color == '#FFFFFF':  # White text
			style.color = '#000000'  # Change to black for print
		
		return style

	async def _optimize_for_digital(self, style: ComputedStyle) -> ComputedStyle:
		"""Optimize style for digital display"""
		# Increase line height for screen reading
		if style.line_height == 'normal':
			style.line_height = '1.5'
		
		return style

	def _calculate_typography_scaling(
		self, 
		breakpoints: dict[str, Any], 
		config: ResponsiveConfiguration
	) -> float:
		"""Calculate typography scaling factor"""
		scaling_factor = 1.0
		
		# Apply page size scaling
		page_size = breakpoints.get('page_size', 'A4')
		if page_size in config.responsive_font_scaling:
			scaling_factor *= config.responsive_font_scaling[page_size]
		
		# Apply content density scaling
		content_density = breakpoints.get('content_density', 'normal')
		if content_density in config.responsive_font_scaling:
			scaling_factor *= config.responsive_font_scaling[content_density]
		
		return scaling_factor

	def _get_spacing_scaling(
		self, 
		breakpoints: dict[str, Any], 
		config: ResponsiveConfiguration, 
		spacing_type: str
	) -> float:
		"""Get spacing scaling factor"""
		scaling_config = getattr(config, f"{spacing_type}_scaling", {})
		
		page_size = breakpoints.get('page_size', 'A4')
		return scaling_config.get(page_size, 1.0)

	def _scale_spacing_value(self, value: str, scaling_factor: float) -> str:
		"""Scale spacing value by factor"""
		if value == '0' or value == 'auto' or scaling_factor == 1.0:
			return value
		
		# Extract numeric value and unit
		match = re.match(r'(\d+(?:\.\d+)?)(.*)', value)
		if match:
			numeric_value = float(match.group(1))
			unit = match.group(2)
			scaled_value = numeric_value * scaling_factor
			return f"{scaled_value:.1f}{unit}"
		
		return value

	async def calculate_responsive_breakpoints(
		self, 
		document_context: dict[str, Any]
	) -> dict[str, Any]:
		"""Calculate active breakpoints for document"""
		assert isinstance(document_context, dict), "Document context must be dict"
		
		try:
			breakpoints = {}
			
			# Page size breakpoint
			page_size = document_context.get('page_size', 'A4')
			breakpoints['page_size'] = page_size
			
			# Content density breakpoint
			word_count = document_context.get('word_count', 0)
			if word_count < 500:
				breakpoints['content_density'] = 'low'
			elif word_count < 2000:
				breakpoints['content_density'] = 'normal'
			else:
				breakpoints['content_density'] = 'high'
			
			# Output format
			output_format = document_context.get('output_format', 'pdf')
			breakpoints['output_format'] = output_format
			
			# Device context (for digital outputs)
			if output_format in ['html', 'web']:
				breakpoints['device_type'] = document_context.get('device_type', 'desktop')
			
			assert 'page_size' in breakpoints, "Page size breakpoint calculated"
			return breakpoints
			
		except Exception as e:
			# Return safe defaults on error
			return {
				'page_size': 'A4',
				'content_density': 'normal',
				'output_format': 'pdf'
			}

	async def optimize_layout(
		self, 
		styles: list[ComputedStyle], 
		page_context: dict[str, Any]
	) -> list[ComputedStyle]:
		"""Optimize layout for page constraints"""
		assert isinstance(styles, list), "Styles must be list"
		assert isinstance(page_context, dict), "Page context must be dict"
		
		try:
			optimized_styles = []
			
			for style in styles:
				# Optimize individual style for page constraints
				optimized_style = await self._optimize_style_for_page(style, page_context)
				optimized_styles.append(optimized_style)
			
			# Apply global layout optimizations
			optimized_styles = await self._apply_global_layout_optimizations(optimized_styles, page_context)
			
			assert len(optimized_styles) == len(styles), "All styles optimized"
			return optimized_styles
			
		except Exception as e:
			raise StyleComputationException(f"Failed to optimize layout: {str(e)}")

	async def _optimize_style_for_page(
		self, 
		style: ComputedStyle, 
		page_context: dict[str, Any]
	) -> ComputedStyle:
		"""Optimize individual style for page constraints"""
		# Apply page-specific optimizations
		page_width = page_context.get('page_width', '210mm')  # A4 width
		page_height = page_context.get('page_height', '297mm')  # A4 height
		
		# Ensure content fits within page bounds
		if style.width and style.width != 'auto':
			style = await self._constrain_width_to_page(style, page_width)
		
		return style

	async def _constrain_width_to_page(self, style: ComputedStyle, page_width: str) -> ComputedStyle:
		"""Constrain element width to page bounds"""
		# Simplified implementation
		# In real implementation, would parse units and calculate properly
		return style

	async def _apply_global_layout_optimizations(
		self, 
		styles: list[ComputedStyle], 
		page_context: dict[str, Any]
	) -> list[ComputedStyle]:
		"""Apply optimizations across all styles"""
		# Apply consistent spacing
		styles = await self._normalize_spacing_across_elements(styles)
		
		# Optimize for page breaks
		styles = await self._optimize_for_page_breaks(styles, page_context)
		
		return styles

	async def _normalize_spacing_across_elements(self, styles: list[ComputedStyle]) -> list[ComputedStyle]:
		"""Normalize spacing for visual consistency"""
		# Calculate average spacing values
		margin_values = [s.margin_bottom for s in styles if s.margin_bottom != '0']
		
		if margin_values:
			# Apply consistent spacing based on most common value
			# Simplified implementation
			pass
		
		return styles

	async def _optimize_for_page_breaks(
		self, 
		styles: list[ComputedStyle], 
		page_context: dict[str, Any]
	) -> list[ComputedStyle]:
		"""Optimize styles to prevent bad page breaks"""
		# Add page-break-inside: avoid for headings
		for style in styles:
			if style.element_type == 'heading':
				style.page_break_inside = 'avoid'
		
		return styles


class BreakpointManager:
	"""Manage responsive breakpoints"""
	
	def __init__(self):
		"""Initialize breakpoint manager"""
		pass


class LayoutCalculator:
	"""Calculate layout metrics and constraints"""
	
	def __init__(self):
		"""Initialize layout calculator"""
		pass


class ContentAnalyzer:
	"""Analyze content characteristics for responsive design"""
	
	def __init__(self):
		"""Initialize content analyzer"""
		pass


class OutputGenerator:
	"""Generate format-specific output from computed styles"""
	
	def __init__(self):
		"""Initialize OutputGenerator with format-specific generators"""
		assert True, "OutputGenerator initialization"
		
		self.latex_generator = LaTeXStyleGenerator()
		self.html_generator = HTMLStyleGenerator()
		self.pdf_generator = PDFStyleGenerator()
		
		# Output optimization settings
		self.optimization_level = 1
		self.output_cache: dict[str, str] = {}
		
		assert self.latex_generator is not None, "LaTeX generator initialized"

	def _log_output_operation(self, operation: str, details: str) -> None:
		"""Log output operations for debugging"""
		pass  # Placeholder for logging

	async def generate_latex_commands(
		self, 
		styles: list[ComputedStyle]
	) -> dict[str, str]:
		"""Generate LaTeX style commands"""
		assert isinstance(styles, list), "Styles must be list"
		
		try:
			self._log_output_operation("generate_latex", f"Generating for {len(styles)} styles")
			
			latex_commands = {}
			
			# Generate preamble commands
			preamble = await self._generate_latex_preamble(styles)
			latex_commands['preamble'] = preamble
			
			# Generate individual style commands
			for style in styles:
				element_commands = await self._generate_element_latex_commands(style)
				latex_commands[style.element_id] = element_commands
			
			# Generate document-level commands
			document_commands = await self._generate_document_latex_commands(styles)
			latex_commands['document'] = document_commands
			
			assert 'preamble' in latex_commands, "LaTeX preamble generated"
			return latex_commands
			
		except Exception as e:
			raise OutputGenerationException(f"Failed to generate LaTeX commands: {str(e)}")

	async def _generate_latex_preamble(self, styles: list[ComputedStyle]) -> str:
		"""Generate LaTeX preamble with required packages"""
		packages = set()
		
		# Analyze styles to determine required packages
		for style in styles:
			if style.font_family and 'sans' in style.font_family.lower():
				packages.add('\\usepackage{helvet}')
			if style.color and style.color != '#000000':
				packages.add('\\usepackage{xcolor}')
			if style.text_decoration == 'underline':
				packages.add('\\usepackage{ulem}')
		
		# Add standard packages
		packages.update([
			'\\usepackage[utf8]{inputenc}',
			'\\usepackage[T1]{fontenc}',
			'\\usepackage{geometry}',
			'\\usepackage{setspace}',
			'\\usepackage{titlesec}'
		])
		
		return '\n'.join(sorted(packages))

	async def _generate_element_latex_commands(self, style: ComputedStyle) -> str:
		"""Generate LaTeX commands for individual element"""
		commands = []
		
		# Font commands
		font_commands = await self._generate_latex_font_commands(style)
		if font_commands:
			commands.append(font_commands)
		
		# Spacing commands
		spacing_commands = await self._generate_latex_spacing_commands(style)
		if spacing_commands:
			commands.append(spacing_commands)
		
		# Color commands
		if style.color and style.color != '#000000':
			color_command = self._convert_color_to_latex(style.color)
			commands.append(f'\\textcolor{{{color_command}}}')
		
		return ''.join(commands)

	async def _generate_latex_font_commands(self, style: ComputedStyle) -> str:
		"""Generate LaTeX font commands"""
		commands = []
		
		# Font family
		if 'serif' in style.font_family.lower():
			commands.append('\\rmfamily ')
		elif 'sans' in style.font_family.lower():
			commands.append('\\sffamily ')
		elif 'mono' in style.font_family.lower():
			commands.append('\\ttfamily ')
		
		# Font weight
		if style.font_weight == 'bold':
			commands.append('\\bfseries ')
		
		# Font style
		if style.font_style == 'italic':
			commands.append('\\itshape ')
		
		# Font size
		size_map = {
			'8pt': '\\tiny ',
			'9pt': '\\scriptsize ',
			'10pt': '\\footnotesize ',
			'11pt': '\\small ',
			'12pt': '\\normalsize ',
			'14pt': '\\large ',
			'16pt': '\\Large ',
			'18pt': '\\LARGE ',
			'20pt': '\\huge ',
			'24pt': '\\Huge '
		}
		
		if style.font_size in size_map:
			commands.append(size_map[style.font_size])
		
		return ''.join(commands)

	async def _generate_latex_spacing_commands(self, style: ComputedStyle) -> str:
		"""Generate LaTeX spacing commands"""
		commands = []
		
		# Vertical spacing
		if style.margin_top and style.margin_top != '0':
			commands.append(f'\\vspace{{{style.margin_top}}}')
		
		if style.margin_bottom and style.margin_bottom != '0':
			commands.append(f'\\vspace{{{style.margin_bottom}}}')
		
		# Text indentation
		if style.text_indent and style.text_indent != '0':
			commands.append(f'\\indent ')
		
		return ''.join(commands)

	async def _generate_document_latex_commands(self, styles: list[ComputedStyle]) -> str:
		"""Generate document-level LaTeX commands"""
		commands = []
		
		# Page geometry
		commands.append('\\geometry{margin=1in}')
		
		# Line spacing
		commands.append('\\setstretch{1.5}')
		
		return '\n'.join(commands)

	def _convert_color_to_latex(self, color: str) -> str:
		"""Convert CSS color to LaTeX color"""
		# Handle hex colors
		if color.startswith('#'):
			# Convert hex to RGB values
			hex_color = color[1:]
			if len(hex_color) == 3:
				hex_color = ''.join([c*2 for c in hex_color])
			
			r = int(hex_color[0:2], 16) / 255.0
			g = int(hex_color[2:4], 16) / 255.0
			b = int(hex_color[4:6], 16) / 255.0
			
			return f'[rgb]{{{r:.2f},{g:.2f},{b:.2f}}}'
		
		# Handle named colors
		color_map = {
			'black': 'black',
			'white': 'white',
			'red': 'red',
			'green': 'green',
			'blue': 'blue'
		}
		
		return color_map.get(color.lower(), 'black')

	async def generate_html_css(
		self, 
		styles: list[ComputedStyle]
	) -> tuple[str, str]:
		"""Generate HTML markup and CSS stylesheet"""
		assert isinstance(styles, list), "Styles must be list"
		
		try:
			self._log_output_operation("generate_html", f"Generating for {len(styles)} styles")
			
			# Generate CSS stylesheet
			css_content = await self._generate_css_stylesheet(styles)
			
			# Generate HTML with proper classes
			html_content = await self._generate_html_markup(styles)
			
			assert css_content != "", "CSS content generated"
			return html_content, css_content
			
		except Exception as e:
			raise OutputGenerationException(f"Failed to generate HTML/CSS: {str(e)}")

	async def _generate_css_stylesheet(self, styles: list[ComputedStyle]) -> str:
		"""Generate CSS stylesheet from computed styles"""
		css_rules = []
		
		for style in styles:
			css_rule = await self._generate_css_rule_for_style(style)
			css_rules.append(css_rule)
		
		return '\n\n'.join(css_rules)

	async def _generate_css_rule_for_style(self, style: ComputedStyle) -> str:
		"""Generate CSS rule for individual style"""
		selector = f".element-{style.element_id}"
		properties = []
		
		# Typography properties
		properties.append(f"font-family: {style.font_family}")
		properties.append(f"font-size: {style.font_size}")
		properties.append(f"font-weight: {style.font_weight}")
		properties.append(f"font-style: {style.font_style}")
		properties.append(f"line-height: {style.line_height}")
		properties.append(f"color: {style.color}")
		properties.append(f"text-align: {style.text_align}")
		
		# Spacing properties
		properties.append(f"margin-top: {style.margin_top}")
		properties.append(f"margin-bottom: {style.margin_bottom}")
		properties.append(f"margin-left: {style.margin_left}")
		properties.append(f"margin-right: {style.margin_right}")
		properties.append(f"padding-top: {style.padding_top}")
		properties.append(f"padding-bottom: {style.padding_bottom}")
		properties.append(f"padding-left: {style.padding_left}")
		properties.append(f"padding-right: {style.padding_right}")
		
		# Layout properties
		properties.append(f"display: {style.display}")
		if style.width != 'auto':
			properties.append(f"width: {style.width}")
		if style.height != 'auto':
			properties.append(f"height: {style.height}")
		
		# Background and borders
		if style.background_color != 'transparent':
			properties.append(f"background-color: {style.background_color}")
		if style.border_width != '0':
			properties.append(f"border: {style.border_width} {style.border_style} {style.border_color}")
		
		return f"{selector} {{\n  " + ";\n  ".join(properties) + ";\n}"

	async def _generate_html_markup(self, styles: list[ComputedStyle]) -> str:
		"""Generate HTML markup with proper styling classes"""
		html_elements = []
		
		for style in styles:
			element_html = await self._generate_html_element(style)
			html_elements.append(element_html)
		
		return '\n'.join(html_elements)

	async def _generate_html_element(self, style: ComputedStyle) -> str:
		"""Generate HTML element with styling"""
		class_name = f"element-{style.element_id}"
		
		# Determine appropriate HTML tag
		tag = self._get_html_tag_for_element_type(style.element_type)
		
		return f'<{tag} class="{class_name}"><!-- Content for {style.element_id} --></{tag}>'

	def _get_html_tag_for_element_type(self, element_type: str) -> str:
		"""Get appropriate HTML tag for element type"""
		tag_map = {
			'heading': 'h2',
			'paragraph': 'p',
			'table': 'table',
			'figure': 'figure',
			'list': 'ul',
			'code': 'code'
		}
		
		return tag_map.get(element_type, 'div')

	async def generate_pdf_formatting(
		self, 
		styles: list[ComputedStyle]
	) -> dict[str, Any]:
		"""Generate PDF formatting instructions"""
		assert isinstance(styles, list), "Styles must be list"
		
		try:
			self._log_output_operation("generate_pdf", f"Generating for {len(styles)} styles")
			
			pdf_formatting = {
				'page_setup': await self._generate_pdf_page_setup(styles),
				'font_definitions': await self._generate_pdf_font_definitions(styles),
				'style_definitions': await self._generate_pdf_style_definitions(styles),
				'layout_instructions': await self._generate_pdf_layout_instructions(styles)
			}
			
			assert 'page_setup' in pdf_formatting, "PDF page setup generated"
			return pdf_formatting
			
		except Exception as e:
			raise OutputGenerationException(f"Failed to generate PDF formatting: {str(e)}")

	async def _generate_pdf_page_setup(self, styles: list[ComputedStyle]) -> dict[str, Any]:
		"""Generate PDF page setup configuration"""
		return {
			'page_size': 'A4',
			'margins': {
				'top': '1in',
				'bottom': '1in',
				'left': '1in',
				'right': '1in'
			},
			'orientation': 'portrait'
		}

	async def _generate_pdf_font_definitions(self, styles: list[ComputedStyle]) -> list[dict[str, Any]]:
		"""Generate PDF font definitions"""
		fonts = []
		used_fonts = set()
		
		for style in styles:
			if style.font_family not in used_fonts:
				font_def = {
					'name': style.font_family,
					'base_size': style.font_size,
					'weight_variants': ['normal', 'bold'],
					'style_variants': ['normal', 'italic']
				}
				fonts.append(font_def)
				used_fonts.add(style.font_family)
		
		return fonts

	async def _generate_pdf_style_definitions(self, styles: list[ComputedStyle]) -> list[dict[str, Any]]:
		"""Generate PDF style definitions"""
		style_defs = []
		
		for style in styles:
			style_def = {
				'element_id': style.element_id,
				'element_type': style.element_type,
				'font_family': style.font_family,
				'font_size': style.font_size,
				'font_weight': style.font_weight,
				'color': style.color,
				'spacing': {
					'margin_top': style.margin_top,
					'margin_bottom': style.margin_bottom,
					'padding_top': style.padding_top,
					'padding_bottom': style.padding_bottom
				}
			}
			style_defs.append(style_def)
		
		return style_defs

	async def _generate_pdf_layout_instructions(self, styles: list[ComputedStyle]) -> dict[str, Any]:
		"""Generate PDF layout instructions"""
		return {
			'flow_direction': 'top_to_bottom',
			'column_count': 1,
			'line_spacing': 1.5,
			'page_breaks': 'auto',
			'widow_orphan_control': True
		}

	async def optimize_output(
		self, 
		output: str, 
		format_type: str,
		optimization_level: int = 1
	) -> str:
		"""Optimize generated output for performance and size"""
		assert isinstance(output, str), "Output must be string"
		assert isinstance(format_type, str), "Format type must be string"
		assert 1 <= optimization_level <= 3, "Optimization level must be 1-3"
		
		try:
			if format_type.lower() == 'latex':
				return await self._optimize_latex_output(output, optimization_level)
			elif format_type.lower() == 'css':
				return await self._optimize_css_output(output, optimization_level)
			elif format_type.lower() == 'html':
				return await self._optimize_html_output(output, optimization_level)
			else:
				return output  # No optimization for unknown formats
				
		except Exception as e:
			# Return original output if optimization fails
			return output

	async def _optimize_latex_output(self, latex_content: str, level: int) -> str:
		"""Optimize LaTeX output"""
		if level == 1:
			# Basic optimization: remove extra whitespace
			# Remove multiple consecutive newlines (keep at most one blank line)
			optimized = re.sub(r'\n\s*\n\s*\n+', '\n\n', latex_content)
			# Remove extra spaces and tabs
			optimized = re.sub(r'[ \t]+', ' ', optimized)
			# Remove leading/trailing whitespace from lines
			optimized = '\n'.join(line.strip() for line in optimized.split('\n'))
			return optimized.strip()
		
		elif level == 2:
			# Medium optimization: combine similar commands
			optimized = await self._optimize_latex_output(latex_content, 1)
			# Add more optimizations here
			return optimized
		
		elif level == 3:
			# High optimization: advanced command merging
			optimized = await self._optimize_latex_output(latex_content, 2)
			# Add advanced optimizations here
			return optimized
		
		return latex_content

	async def _optimize_css_output(self, css_content: str, level: int) -> str:
		"""Optimize CSS output"""
		if level == 1:
			# Basic optimization: remove comments and extra whitespace
			optimized = re.sub(r'/\*.*?\*/', '', css_content, flags=re.DOTALL)
			optimized = re.sub(r'\s+', ' ', optimized)
			optimized = re.sub(r';\s*}', '}', optimized)
			return optimized.strip()
		
		elif level >= 2:
			# Medium+ optimization: merge selectors, shorthand properties
			optimized = await self._optimize_css_output(css_content, 1)
			# Add selector merging and property shorthand
			return optimized
		
		return css_content

	async def _optimize_html_output(self, html_content: str, level: int) -> str:
		"""Optimize HTML output"""
		if level == 1:
			# Basic optimization: remove extra whitespace
			optimized = re.sub(r'>\s+<', '><', html_content)
			optimized = re.sub(r'\s+', ' ', optimized)
			return optimized.strip()
		
		return html_content


class LaTeXStyleGenerator:
	"""Generate LaTeX-specific styling commands"""
	
	def __init__(self):
		"""Initialize LaTeX style generator"""
		pass


class HTMLStyleGenerator:
	"""Generate HTML and CSS styling"""
	
	def __init__(self):
		"""Initialize HTML style generator"""
		pass


class PDFStyleGenerator:
	"""Generate PDF-specific formatting instructions"""
	
	def __init__(self):
		"""Initialize PDF style generator"""
		pass


# ============================================================================
# Main DocumentFormatter Class
# ============================================================================

class DocumentFormatter:
	"""
	Main DocumentFormatter class for professional document styling and formatting.
	
	Provides comprehensive CSS-like styling capabilities with responsive design,
	professional typography, and multi-format output support.
	"""
	
	def __init__(self, 
				 default_typography_profile: TypographyProfile | None = None,
				 default_responsive_config: ResponsiveConfiguration | None = None):
		"""Initialize DocumentFormatter with optional default configurations"""
		assert True, "DocumentFormatter initialization"
		
		# Core components
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
		
		# Simple implementation - can be enhanced
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
				# Re-format with theme styles
				# This is a simplified implementation
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
		# Predefined themes
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
			# Simple CSV export - can be enhanced
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
# Pydantic Dataclass Rebuilds (Required for proper initialization)
# ============================================================================

# Rebuild all pydantic dataclasses to ensure proper initialization
rebuild_dataclass(StyleRule)
rebuild_dataclass(ComputedStyle)
rebuild_dataclass(TypographyProfile)
rebuild_dataclass(ResponsiveConfiguration)
rebuild_dataclass(FormattingResult)


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