#!/usr/bin/env python3
"""Shared Data Models for the Document Formatter Package

Centralizes all pydantic dataclass models used across the formatter
sub-modules to avoid isinstance() failures from duplicate class definitions.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import Field, ConfigDict
from pydantic.dataclasses import dataclass as pydantic_dataclass, rebuild_dataclass

from docfusion.core.utils import uuid7str


# ============================================================================
# Data Models
# ============================================================================

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class StyleRule:
	"""CSS-like style rule with selector and properties"""
	selector: str  # CSS-like selector (e.g., "h1", ".title", "#intro")
	properties: dict[str, Any]  # Style properties and values

	rule_id: str = Field(default_factory=uuid7str)
	specificity: int = 0
	priority: int = 0
	important: bool = False
	origin: str = "author"

	media_conditions: dict[str, Any] = Field(default_factory=dict)
	document_context: dict[str, Any] = Field(default_factory=dict)
	template_context: str = ""

	valid: bool = True
	validation_errors: list[str] = Field(default_factory=list)
	source_location: str = ""

	compiled_selector: Any | None = None
	property_index: dict[str, Any] = Field(default_factory=dict)

	created_at: datetime = Field(default_factory=datetime.now)
	updated_at: datetime = Field(default_factory=datetime.now)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class ComputedStyle:
	"""Final computed style for a document element"""
	element_id: str
	element_type: str

	font_family: str = "serif"
	font_size: str = "12pt"
	font_weight: str = "normal"
	font_style: str = "normal"
	font_variant: str = "normal"

	color: str = "#000000"
	text_align: str = "left"
	text_decoration: str = "none"
	text_transform: str = "none"
	line_height: str = "normal"
	letter_spacing: str = "normal"
	word_spacing: str = "normal"

	margin_top: str = "0"
	margin_bottom: str = "0"
	margin_left: str = "0"
	margin_right: str = "0"
	padding_top: str = "0"
	padding_bottom: str = "0"
	padding_left: str = "0"
	padding_right: str = "0"
	text_indent: str = "0"

	background_color: str = "transparent"
	background_image: str = ""
	border_width: str = "0"
	border_style: str = "none"
	border_color: str = "#000000"
	border_radius: str = "0"

	display: str = "block"
	width: str = "auto"
	height: str = "auto"
	float_position: str = "none"
	clear: str = "none"
	position: str = "static"

	list_style_type: str = "disc"
	list_style_position: str = "outside"

	border_collapse: str = "separate"
	border_spacing: str = "0"
	caption_side: str = "top"
	table_layout: str = "auto"

	inheritance_chain: list[str] = Field(default_factory=list)
	applied_rules: list[str] = Field(default_factory=list)
	format_specific: dict[str, dict[str, Any]] = Field(default_factory=dict)

	computation_time: float = 0.0
	cache_key: str = ""
	last_computed: datetime = Field(default_factory=datetime.now)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class TypographyProfile:
	"""Professional typography configuration"""
	profile_name: str

	profile_id: str = Field(default_factory=uuid7str)
	description: str = ""

	base_font_family: str = "serif"
	base_font_size: str = "12pt"
	base_line_height: str = "1.5"
	base_color: str = "#000000"

	heading_fonts: dict[int, str] = Field(default_factory=dict)
	heading_sizes: dict[int, str] = Field(default_factory=dict)
	heading_weights: dict[int, str] = Field(default_factory=dict)
	heading_spacing: dict[int, dict[str, str]] = Field(default_factory=dict)

	quote_font: str = ""
	quote_size: str = ""
	code_font: str = "monospace"
	code_size: str = "0.9em"
	caption_font: str = ""
	caption_size: str = "0.9em"

	paragraph_spacing: str = "1em"
	paragraph_indent: str = "0"
	text_justification: str = "left"
	hyphenation: bool = True

	list_item_spacing: str = "0.5em"
	list_indent: str = "2em"
	bullet_style: str = "disc"
	numbering_style: str = "decimal"

	widow_orphan_control: bool = True
	page_break_inside: str = "auto"
	keep_with_next: bool = False

	latex_packages: list[str] = Field(default_factory=list)
	html_web_fonts: list[str] = Field(default_factory=list)
	pdf_embedding: bool = True

	min_contrast_ratio: float = 4.5
	dyslexia_friendly: bool = False
	large_text_support: bool = False


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class ResponsiveConfiguration:
	"""Responsive layout and styling configuration"""
	config_name: str

	config_id: str = Field(default_factory=uuid7str)

	page_size_breakpoints: dict[str, dict[str, str]] = Field(default_factory=dict)
	content_density_breakpoints: dict[str, int] = Field(default_factory=dict)
	format_conditions: dict[str, dict[str, Any]] = Field(default_factory=dict)

	responsive_font_scaling: dict[str, float] = Field(default_factory=dict)
	line_height_adjustments: dict[str, str] = Field(default_factory=dict)
	heading_scaling: dict[str, dict[int, float]] = Field(default_factory=dict)

	margin_scaling: dict[str, float] = Field(default_factory=dict)
	padding_scaling: dict[str, float] = Field(default_factory=dict)
	content_scaling: dict[str, float] = Field(default_factory=dict)

	column_configurations: dict[str, int] = Field(default_factory=dict)
	image_sizing: dict[str, str] = Field(default_factory=dict)
	table_responsiveness: dict[str, str] = Field(default_factory=dict)

	lazy_computation: bool = True
	cache_computed_styles: bool = True
	incremental_updates: bool = True


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class FormattingResult:
	"""Result of document formatting operation"""
	document_id: str

	result_id: str = Field(default_factory=uuid7str)
	success: bool = True
	formatted_content: dict[str, str] = Field(default_factory=dict)
	computed_styles: list[ComputedStyle] = Field(default_factory=list)

	processing_time: float = 0.0
	elements_processed: int = 0
	rules_applied: int = 0
	cache_hits: int = 0

	style_coverage: float = 0.0
	typography_score: float = 0.0
	accessibility_score: float = 0.0

	errors: list[str] = Field(default_factory=list)
	warnings: list[str] = Field(default_factory=list)

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
# Pydantic Dataclass Rebuilds
# ============================================================================

rebuild_dataclass(StyleRule)
rebuild_dataclass(ComputedStyle)
rebuild_dataclass(TypographyProfile)
rebuild_dataclass(ResponsiveConfiguration)
rebuild_dataclass(FormattingResult)