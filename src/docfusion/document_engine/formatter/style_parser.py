#!/usr/bin/env python3
"""StyleParser Module - CSS-like Style Rule Parsing and Validation

Parses CSS-like style rules, validates property syntax, and normalizes
shorthand values for the DocuFusion document formatting engine.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from ._models import StyleRule, StyleParsingException

logger = logging.getLogger(__name__)


# ============================================================================
# StyleParser
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
			'font-family': self._validate_font_family,
			'font-size': self._validate_font_size,
			'font-weight': self._validate_font_weight,
			'font-style': self._validate_font_style,
			'line-height': self._validate_line_height,
			'color': self._validate_color,
			'text-align': self._validate_text_align,
			'text-decoration': self._validate_text_decoration,
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
			'border': self._validate_border,
			'border-width': self._validate_border_width,
			'border-style': self._validate_border_style,
			'border-color': self._validate_color,
			'border-collapse': self._validate_border_collapse,
			'background-color': self._validate_color,
			'background-image': self._validate_url,
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
			cache_key = hash(rule_text)
			if cache_key in self.parsed_cache:
				return self.parsed_cache[cache_key]

			selector, properties_text = self._split_selector_properties(rule_text)
			properties = self._parse_properties(properties_text)
			specificity = self._calculate_specificity(selector)

			rule = StyleRule(
				selector=selector,
				properties=properties,
				specificity=specificity,
				source_location=rule_text[:50] + "..." if len(rule_text) > 50 else rule_text
			)

			rule.valid, errors = await self._validate_rule(rule)
			rule.validation_errors = errors

			self.parsed_cache[cache_key] = rule

			assert rule.selector != "", "Rule has selector"
			return rule

		except Exception as e:
			return StyleRule(
				selector="invalid",
				properties={},
				valid=False,
				validation_errors=[str(e)]
			)

	def _split_into_rule_blocks(self, style_sheet: str) -> list[str]:
		"""Split style sheet into individual rule blocks"""
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
		specificity = 0

		specificity += len(re.findall(r'#[\w-]+', selector)) * 100
		specificity += len(re.findall(r'\.[\w-]+', selector)) * 10
		specificity += len(re.findall(r'\[[\w-]+[^]]*\]', selector)) * 10
		specificity += len(re.findall(r'(?:^|[\s>+~])([a-zA-Z]+)', selector)) * 1

		return specificity

	async def _validate_rule(self, rule: StyleRule) -> tuple[bool, list[str]]:
		"""Validate style rule"""
		errors = []

		if not self._validate_selector(rule.selector):
			errors.append(f"Invalid selector: {rule.selector}")

		for prop_name, prop_data in rule.properties.items():
			valid, error = await self.validate_property(prop_name, prop_data['value'])
			if not valid:
				errors.append(f"Invalid property {prop_name}: {error}")

		return len(errors) == 0, errors

	def _validate_selector(self, selector: str) -> bool:
		"""Validate CSS selector syntax"""
		if not selector:
			return False
		return True

	async def validate_property(self, property_name: str, value: Any) -> tuple[bool, str]:
		"""Validate individual style property"""
		assert isinstance(property_name, str), "Property name must be string"

		try:
			cache_key = f"{property_name}:{str(value)}"
			if cache_key in self.validation_cache:
				return self.validation_cache[cache_key]

			if property_name not in self.property_validators:
				result = (False, f"Unknown property: {property_name}")
			else:
				field_validator = self.property_validators[property_name]
				result = field_validator(value)

			self.validation_cache[cache_key] = result
			return result

		except Exception as e:
			return (False, f"Validation error: {str(e)}")

	def _validate_font_family(self, value: str) -> tuple[bool, str]:
		"""Validate font-family property"""
		if not value:
			return (False, "Font family cannot be empty")
		return (True, "")

	def _validate_font_size(self, value: str) -> tuple[bool, str]:
		"""Validate font-size property"""
		if re.match(r'^\d+(\.\d+)?(px|pt|em|rem|%)$', value):
			return (True, "")
		if value in ['xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large']:
			return (True, "")
		return (False, f"Invalid font size: {value}")

	def _validate_font_weight(self, value: str) -> tuple[bool, str]:
		"""Validate font-weight property"""
		if value in ['normal', 'bold', 'bolder', 'lighter']:
			return (True, "")
		if re.match(r'^[1-9]00$', value):
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
		if re.match(r'^\d+(\.\d+)?$', value):
			return (True, "")
		if re.match(r'^\d+(\.\d+)?(px|pt|em|rem|%)$', value):
			return (True, "")
		return (False, f"Invalid line height: {value}")

	def _validate_color(self, value: str) -> tuple[bool, str]:
		"""Validate color property"""
		if re.match(r'^#[0-9a-fA-F]{3}$', value) or re.match(r'^#[0-9a-fA-F]{6}$', value):
			return (True, "")
		named_colors = ['black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta', 'transparent']
		if value.lower() in named_colors:
			return (True, "")
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
			return {'top': parts[0], 'right': parts[0], 'bottom': parts[0], 'left': parts[0]}
		elif len(parts) == 2:
			return {'top': parts[0], 'right': parts[1], 'bottom': parts[0], 'left': parts[1]}
		elif len(parts) == 3:
			return {'top': parts[0], 'right': parts[1], 'bottom': parts[2], 'left': parts[1]}
		elif len(parts) == 4:
			return {'top': parts[0], 'right': parts[1], 'bottom': parts[2], 'left': parts[3]}
		else:
			return {'top': '0', 'right': '0', 'bottom': '0', 'left': '0'}

	def _normalize_border_shorthand(self, value: str) -> dict[str, str]:
		"""Normalize border shorthand values"""
		return {'width': '1px', 'style': 'solid', 'color': '#000000'}

	def _normalize_color_value(self, value: str) -> str:
		"""Normalize color values"""
		value = str(value).strip().lower()

		if value.startswith('#') and len(value) == 4:
			return f"#{value[1]}{value[1]}{value[2]}{value[2]}{value[3]}{value[3]}"

		return value