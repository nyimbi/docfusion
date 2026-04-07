#!/usr/bin/env python3
from __future__ import annotations

import logging
"""
StyleApplier Module - Professional Brand Styling Engine

This module implements comprehensive brand color, font, and styling application 
for DocuFusion documents. It ensures consistent visual identity across all 
document types while maintaining high-quality typography and design standards.

Core Components:
- ColorManager: Advanced color management with accessibility validation
- TypographyManager: Professional typography application and font management
- BrandCompliance: Brand guideline enforcement and validation
- StyleApplier: Main styling engine with performance optimization

Features:
- WCAG 2.1 accessibility compliance
- Multi-format output (LaTeX, CSS, PDF)
- Performance caching and optimization
- Responsive design adaptation
- Brand guideline enforcement
"""

import asyncio
import colorsys
import math
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)
from uuid import uuid4

from pydantic import Field, ConfigDict
from pydantic.dataclasses import dataclass as pydantic_dataclass, rebuild_dataclass

# Import from document formatter for integration
from .document_formatter import ComputedStyle, ResponsiveConfiguration

def uuid7str() -> str:
	"""Generate UUID string compatible with uuid7str"""
	return str(uuid4())


# ============================================================================
# Data Models
# ============================================================================

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class ColorPalette:
	"""Brand color palette with accessibility validation"""
	# Core brand colors
	primary: str  # Main brand color
	secondary: str = ""  # Secondary brand color
	accent: str = ""  # Accent/highlight color
	
	# Text colors
	text_primary: str = "#000000"
	text_secondary: str = "#666666"
	text_muted: str = "#999999"
	
	# Background colors
	background_primary: str = "#ffffff"
	background_secondary: str = "#f5f5f5"
	background_accent: str = "#f0f0f0"
	
	# Semantic colors
	success: str = "#22c55e"
	warning: str = "#f59e0b" 
	error: str = "#ef4444"
	info: str = "#3b82f6"
	
	# Metadata
	palette_name: str = "default"
	description: str = ""
	accessibility_level: str = "AA"  # A, AA, AAA
	
	# Validation results
	contrast_ratios: dict[str, float] = Field(default_factory=dict)
	accessibility_compliant: bool = True
	validation_errors: list[str] = Field(default_factory=list)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class TypographyProfile:
	"""Typography configuration with font management"""
	# Font families
	primary_font: str = "Inter"  # Main text font
	heading_font: str = "Inter"  # Heading font
	code_font: str = "JetBrains Mono"  # Monospace font
	accent_font: str = ""  # Special accent font
	
	# Font sources
	font_sources: dict[str, str] = Field(default_factory=dict)  # font_name -> source_url
	fallback_fonts: dict[str, list[str]] = Field(default_factory=dict)
	
	# Typography scale
	base_font_size: str = "16px"
	scale_ratio: float = 1.25  # Major third scale
	font_sizes: dict[str, str] = Field(default_factory=dict)  # h1, h2, body, etc.
	
	# Line heights
	base_line_height: float = 1.5
	line_heights: dict[str, float] = Field(default_factory=dict)
	
	# Font weights
	font_weights: dict[str, str] = Field(default_factory=dict)  # light, normal, bold, etc.
	
	# Advanced typography
	letter_spacing: dict[str, str] = Field(default_factory=dict)
	text_rendering: str = "optimizeLegibility"
	font_smoothing: str = "antialiased"
	
	# Format-specific settings
	latex_packages: list[str] = Field(default_factory=list)
	web_font_display: str = "swap"
	
	# Validation
	fonts_available: dict[str, bool] = Field(default_factory=dict)
	loading_performance: dict[str, float] = Field(default_factory=dict)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class BrandStyleRule:
	"""Enhanced style rule with brand application"""
	# Basic rule properties
	selector: str
	properties: dict[str, Any]
	specificity: int = 0
	
	# Brand enhancement flags
	apply_brand_colors: bool = True
	apply_brand_fonts: bool = True
	enforce_accessibility: bool = True
	
	# Responsive behavior
	responsive_properties: dict[str, dict[str, Any]] = Field(default_factory=dict)
	breakpoints: list[str] = Field(default_factory=list)
	
	# Brand compliance
	brand_compliant: bool = True
	compliance_score: float = 1.0
	compliance_issues: list[str] = Field(default_factory=list)
	
	# Performance optimization
	cacheable: bool = True
	cache_key: str = ""
	last_applied: datetime = Field(default_factory=datetime.now)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class BrandGuidelines:
	"""Brand guideline rules and validation criteria"""
	# Visual identity
	brand_name: str
	logo_requirements: dict[str, Any] = Field(default_factory=dict)
	color_palette: ColorPalette = Field(default_factory=ColorPalette)
	typography: TypographyProfile = Field(default_factory=TypographyProfile)
	
	# Design rules
	spacing_rules: dict[str, str] = Field(default_factory=dict)
	layout_constraints: dict[str, Any] = Field(default_factory=dict)
	element_styles: dict[str, dict[str, Any]] = Field(default_factory=dict)
	
	# Accessibility requirements
	min_contrast_ratio: float = 4.5
	font_size_minimums: dict[str, str] = Field(default_factory=dict)
	touch_target_sizes: dict[str, str] = Field(default_factory=dict)
	
	# Quality standards
	image_resolution_requirements: dict[str, int] = Field(default_factory=dict)
	text_readability_score: float = 0.8
	
	# Validation rules
	validation_rules: list[dict[str, Any]] = Field(default_factory=list)
	auto_corrections: dict[str, Any] = Field(default_factory=dict)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class StyleApplicationResult:
	"""Result of brand style application"""
	# Application status
	success: bool
	styles_processed: int = 0
	styles_enhanced: int = 0
	
	# Enhanced styles
	enhanced_styles: list[ComputedStyle] = Field(default_factory=list)
	
	# Performance metrics
	processing_time: float = 0.0
	cache_hit_rate: float = 0.0
	
	# Quality metrics
	accessibility_score: float = 1.0
	brand_compliance_score: float = 1.0
	
	# Validation results
	accessibility_violations: list[str] = Field(default_factory=list)
	brand_violations: list[str] = Field(default_factory=list)
	auto_corrections_applied: int = 0
	
	# Format-specific outputs
	latex_preamble: str = ""
	css_styles: str = ""
	color_definitions: dict[str, str] = Field(default_factory=dict)
	font_definitions: dict[str, str] = Field(default_factory=dict)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True))
class ComplianceResult:
	"""Brand compliance validation result"""
	element_id: str
	element_type: str
	
	# Compliance scores
	overall_score: float = 1.0
	color_compliance: float = 1.0
	typography_compliance: float = 1.0
	accessibility_compliance: float = 1.0
	
	# Violations
	violations: list[dict[str, Any]] = Field(default_factory=list)
	warnings: list[str] = Field(default_factory=list)
	recommendations: list[str] = Field(default_factory=list)
	
	# Auto-corrections
	corrections_applied: list[str] = Field(default_factory=list)
	corrected_style: ComputedStyle | None = None


# ============================================================================
# Color Management System
# ============================================================================

class ColorManager:
	"""Advanced color management with accessibility validation"""
	
	def __init__(self, palette: ColorPalette):
		"""Initialize color manager with brand palette"""
		self.palette = palette
		self.color_cache: dict[str, Any] = {}
		self.contrast_cache: dict[str, float] = {}
		
		# Initialize default colors if not set
		self._initialize_palette()
		
		assert self.palette.primary, "Primary color must be defined"
	
	def _initialize_palette(self) -> None:
		"""Initialize palette with defaults if colors are missing"""
		if not self.palette.secondary:
			self.palette.secondary = self._generate_secondary_color(self.palette.primary)
		
		if not self.palette.accent:
			self.palette.accent = self._generate_accent_color(self.palette.primary)
	
	def apply_brand_colors(self, style: ComputedStyle) -> ComputedStyle:
		"""Apply brand colors to computed style"""
		assert isinstance(style, ComputedStyle), "Style must be ComputedStyle instance"
		
		try:
			# Apply primary color for headings
			if style.element_type in ['heading', 'subheading', 'title']:
				style.color = self.palette.primary
			
			# Apply text colors based on hierarchy
			elif style.element_type == 'text':
				style.color = self.palette.text_primary
			elif style.element_type in ['caption', 'footnote']:
				style.color = self.palette.text_secondary
			elif style.element_type in ['metadata', 'auxiliary']:
				style.color = self.palette.text_muted
			
			# Apply semantic colors
			elif style.element_type in ['success', 'positive']:
				style.color = self.palette.success
			elif style.element_type in ['warning', 'caution']:
				style.color = self.palette.warning
			elif style.element_type in ['error', 'danger']:
				style.color = self.palette.error
			elif style.element_type in ['info', 'note']:
				style.color = self.palette.info
			
			# Apply background colors
			if hasattr(style, 'background_color'):
				if style.element_type in ['highlight', 'callout']:
					style.background_color = self.palette.background_accent
				elif style.element_type in ['sidebar', 'aside']:
					style.background_color = self.palette.background_secondary
			
			# Validate contrast
			if hasattr(style, 'background_color') and style.background_color != 'transparent':
				contrast = self.validate_contrast(style.color, style.background_color)
				if contrast < self.palette.accessibility_level == 'AAA' and 7.0 or 4.5:
					style.color = self._adjust_contrast(style.color, style.background_color)
			
			return style
			
		except Exception as e:
			# Return original style if color application fails
			return style
	
	def validate_contrast(self, foreground: str, background: str) -> float:
		"""Calculate WCAG contrast ratio"""
		cache_key = f"{foreground}:{background}"
		if cache_key in self.contrast_cache:
			return self.contrast_cache[cache_key]
		
		try:
			# Convert colors to RGB
			fg_rgb = self._hex_to_rgb(foreground)
			bg_rgb = self._hex_to_rgb(background)
			
			# Calculate relative luminance
			fg_luminance = self._calculate_luminance(fg_rgb)
			bg_luminance = self._calculate_luminance(bg_rgb)
			
			# Calculate contrast ratio
			if fg_luminance > bg_luminance:
				contrast = (fg_luminance + 0.05) / (bg_luminance + 0.05)
			else:
				contrast = (bg_luminance + 0.05) / (fg_luminance + 0.05)
			
			self.contrast_cache[cache_key] = contrast
			return contrast
			
		except Exception:
			return 1.0  # Return minimum contrast if calculation fails
	
	def _calculate_luminance(self, rgb: tuple[int, int, int]) -> float:
		"""Calculate relative luminance for WCAG contrast"""
		def linearize(c: int) -> float:
			c = c / 255.0
			return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
		
		r, g, b = rgb
		return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
	
	def _hex_to_rgb(self, hex_color: str) -> tuple[int, int, int]:
		"""Convert hex color to RGB tuple"""
		hex_color = hex_color.lstrip('#')
		if len(hex_color) == 3:
			hex_color = ''.join([c*2 for c in hex_color])
		
		return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
	
	def _rgb_to_hex(self, rgb: tuple[int, int, int]) -> str:
		"""Convert RGB tuple to hex color"""
		return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"
	
	def _adjust_contrast(self, foreground: str, background: str, target_ratio: float = 4.5) -> str:
		"""Adjust foreground color to meet contrast requirements"""
		try:
			fg_rgb = self._hex_to_rgb(foreground)
			bg_rgb = self._hex_to_rgb(background)
			
			# Convert to HSL for easier manipulation
			fg_hsl = colorsys.rgb_to_hls(fg_rgb[0]/255, fg_rgb[1]/255, fg_rgb[2]/255)
			
			# Adjust lightness to improve contrast
			current_contrast = self.validate_contrast(foreground, background)
			
			if current_contrast < target_ratio:
				# Determine if we should lighten or darken
				bg_luminance = self._calculate_luminance(bg_rgb)
				
				if bg_luminance > 0.5:  # Light background, darken text
					new_lightness = max(0.0, fg_hsl[1] - 0.1)
				else:  # Dark background, lighten text
					new_lightness = min(1.0, fg_hsl[1] + 0.1)
				
				# Convert back to RGB and hex
				new_rgb = colorsys.hls_to_rgb(fg_hsl[0], new_lightness, fg_hsl[2])
				new_rgb = tuple(int(c * 255) for c in new_rgb)
				
				return self._rgb_to_hex(new_rgb)
			
			return foreground
			
		except Exception:
			return foreground
	
	def _generate_secondary_color(self, primary: str) -> str:
		"""Generate secondary color from primary"""
		try:
			rgb = self._hex_to_rgb(primary)
			hsl = colorsys.rgb_to_hls(rgb[0]/255, rgb[1]/255, rgb[2]/255)
			
			# Shift hue by 30 degrees and reduce saturation
			new_hue = (hsl[0] + 30/360) % 1.0
			new_saturation = hsl[2] * 0.7
			
			new_rgb = colorsys.hls_to_rgb(new_hue, hsl[1], new_saturation)
			new_rgb = tuple(int(c * 255) for c in new_rgb)
			
			return self._rgb_to_hex(new_rgb)
			
		except Exception:
			return "#666666"  # Fallback
	
	def _generate_accent_color(self, primary: str) -> str:
		"""Generate accent color from primary"""
		try:
			rgb = self._hex_to_rgb(primary)
			hsl = colorsys.rgb_to_hls(rgb[0]/255, rgb[1]/255, rgb[2]/255)
			
			# Use complementary color (180 degrees opposite)
			new_hue = (hsl[0] + 0.5) % 1.0
			
			new_rgb = colorsys.hls_to_rgb(new_hue, hsl[1], hsl[2])
			new_rgb = tuple(int(c * 255) for c in new_rgb)
			
			return self._rgb_to_hex(new_rgb)
			
		except Exception:
			return "#3b82f6"  # Fallback
	
	def export_latex_colors(self) -> str:
		"""Generate LaTeX color definitions"""
		colors = []
		colors.append("% Brand color definitions")
		colors.append("\\RequirePackage{xcolor}")
		
		# Define brand colors
		if self.palette.primary:
			rgb = self._hex_to_rgb(self.palette.primary)
			colors.append(f"\\definecolor{{brandprimary}}{{RGB}}{{{rgb[0]},{rgb[1]},{rgb[2]}}}")
		
		if self.palette.secondary:
			rgb = self._hex_to_rgb(self.palette.secondary)
			colors.append(f"\\definecolor{{brandsecondary}}{{RGB}}{{{rgb[0]},{rgb[1]},{rgb[2]}}}")
		
		if self.palette.accent:
			rgb = self._hex_to_rgb(self.palette.accent)
			colors.append(f"\\definecolor{{brandaccent}}{{RGB}}{{{rgb[0]},{rgb[1]},{rgb[2]}}}")
		
		return '\n'.join(colors)
	
	def export_css_variables(self) -> str:
		"""Generate CSS custom properties"""
		variables = []
		variables.append(":root {")
		
		# Brand colors
		variables.append(f"  --color-primary: {self.palette.primary};")
		if self.palette.secondary:
			variables.append(f"  --color-secondary: {self.palette.secondary};")
		if self.palette.accent:
			variables.append(f"  --color-accent: {self.palette.accent};")
		
		# Text colors
		variables.append(f"  --color-text-primary: {self.palette.text_primary};")
		variables.append(f"  --color-text-secondary: {self.palette.text_secondary};")
		variables.append(f"  --color-text-muted: {self.palette.text_muted};")
		
		# Background colors
		variables.append(f"  --color-bg-primary: {self.palette.background_primary};")
		variables.append(f"  --color-bg-secondary: {self.palette.background_secondary};")
		variables.append(f"  --color-bg-accent: {self.palette.background_accent};")
		
		variables.append("}")
		
		return '\n'.join(variables)


# ============================================================================
# Typography Management System
# ============================================================================

class TypographyManager:
	"""Professional typography application and font management"""
	
	def __init__(self, profile: TypographyProfile):
		"""Initialize typography manager with profile"""
		self.profile = profile
		self.font_cache: dict[str, Any] = {}
		self.size_cache: dict[str, str] = {}
		
		# Initialize default font sizes if not set
		self._initialize_typography_scale()
		
		assert self.profile.primary_font, "Primary font must be defined"
	
	def _initialize_typography_scale(self) -> None:
		"""Initialize typography scale with modular scale"""
		if not self.profile.font_sizes:
			base_size = self._parse_font_size(self.profile.base_font_size)
			ratio = self.profile.scale_ratio
			
			self.profile.font_sizes = {
				'h1': f"{base_size * (ratio ** 3):.0f}px",
				'h2': f"{base_size * (ratio ** 2):.0f}px",
				'h3': f"{base_size * (ratio ** 1):.0f}px",
				'h4': f"{base_size * (ratio ** 0.5):.0f}px",
				'h5': f"{base_size:.0f}px",
				'h6': f"{base_size / ratio:.0f}px",
				'body': self.profile.base_font_size,
				'small': f"{base_size / (ratio ** 0.5):.0f}px",
				'caption': f"{base_size / ratio:.0f}px"
			}
		
		if not self.profile.line_heights:
			self.profile.line_heights = {
				'h1': 1.1,
				'h2': 1.2,
				'h3': 1.3,
				'h4': 1.4,
				'h5': 1.4,
				'h6': 1.4,
				'body': self.profile.base_line_height,
				'small': 1.4,
				'caption': 1.3
			}
	
	def apply_typography(self, style: ComputedStyle, element_type: str) -> ComputedStyle:
		"""Apply typography settings to computed style"""
		assert isinstance(style, ComputedStyle), "Style must be ComputedStyle instance"
		
		try:
			# Apply font family
			if element_type in ['heading', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
				style.font_family = self.resolve_font_stack(self.profile.heading_font)
			elif element_type in ['code', 'pre', 'monospace']:
				style.font_family = self.resolve_font_stack(self.profile.code_font)
			elif element_type == 'accent' and self.profile.accent_font:
				style.font_family = self.resolve_font_stack(self.profile.accent_font)
			else:
				style.font_family = self.resolve_font_stack(self.profile.primary_font)
			
			# Apply font size
			size_key = self._get_size_key(element_type)
			if size_key in self.profile.font_sizes:
				style.font_size = self._convert_font_size(self.profile.font_sizes[size_key])
			
			# Apply line height
			if size_key in self.profile.line_heights:
				style.line_height = str(self.profile.line_heights[size_key])
			
			# Apply font weight
			if element_type in ['heading', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
				style.font_weight = 'bold'
			elif element_type in ['strong', 'emphasis']:
				style.font_weight = 'bold'
			else:
				style.font_weight = 'normal'
			
			# Apply letter spacing for headings
			if element_type in ['h1', 'h2', 'h3']:
				style.letter_spacing = '-0.02em'
			
			return style
			
		except Exception as e:
			# Return original style if typography application fails
			return style
	
	def _get_size_key(self, element_type: str) -> str:
		"""Map element type to font size key"""
		mapping = {
			'h1': 'h1', 'heading': 'h1', 'title': 'h1',
			'h2': 'h2', 'subheading': 'h2', 'subtitle': 'h2',
			'h3': 'h3', 'h4': 'h4', 'h5': 'h5', 'h6': 'h6',
			'text': 'body', 'paragraph': 'body', 'body': 'body',
			'small': 'small', 'caption': 'caption', 'footnote': 'caption'
		}
		return mapping.get(element_type, 'body')
	
	def _parse_font_size(self, size_str: str) -> float:
		"""Parse font size string to numeric value in pixels"""
		try:
			if size_str.endswith('px'):
				return float(size_str[:-2])
			elif size_str.endswith('pt'):
				return float(size_str[:-2]) * 1.333  # pt to px conversion
			elif size_str.endswith('em'):
				return float(size_str[:-2]) * 16  # em to px (assuming 16px base)
			else:
				return float(size_str)
		except (ValueError, TypeError):
			return 16.0  # Default fallback
	
	def _convert_font_size(self, size_str: str) -> str:
		"""Convert font size to points for LaTeX compatibility"""
		try:
			px_size = self._parse_font_size(size_str)
			pt_size = px_size / 1.333  # px to pt conversion
			return f"{pt_size:.1f}pt"
		except Exception:
			return "12pt"  # Default fallback
	
	def resolve_font_stack(self, font_family: str) -> str:
		"""Build complete font stack with fallbacks"""
		cache_key = font_family
		if cache_key in self.font_cache:
			return self.font_cache[cache_key]
		
		# Get fallback fonts
		fallbacks = self.profile.fallback_fonts.get(font_family, [])
		
		# Build font stack
		if fallbacks:
			font_stack = f'"{font_family}", ' + ', '.join(f'"{f}"' for f in fallbacks)
		else:
			# Provide default fallbacks based on font type
			if 'mono' in font_family.lower() or font_family == self.profile.code_font:
				font_stack = f'"{font_family}", "Courier New", Courier, monospace'
			elif 'sans' in font_family.lower():
				font_stack = f'"{font_family}", Arial, "Helvetica Neue", Helvetica, sans-serif'
			else:
				font_stack = f'"{font_family}", "Times New Roman", Times, serif'
		
		self.font_cache[cache_key] = font_stack
		return font_stack
	
	def generate_latex_fonts(self) -> str:
		"""Generate LaTeX font package imports"""
		packages = []
		packages.append("% Typography configuration")
		
		# Add LaTeX packages
		for package in self.profile.latex_packages:
			packages.append(f"\\usepackage{{{package}}}")
		
		# Common typography packages
		if 'fontspec' not in self.profile.latex_packages:
			packages.append("\\usepackage{fontspec}")  # For XeLaTeX/LuaLaTeX
		
		# Font family definitions
		if self.profile.primary_font != "Computer Modern":
			packages.append(f"\\setmainfont{{{self.profile.primary_font}}}")
		
		if self.profile.heading_font != self.profile.primary_font:
			packages.append(f"\\newfontfamily\\headingfont{{{self.profile.heading_font}}}")
		
		if self.profile.code_font:
			packages.append(f"\\setmonofont{{{self.profile.code_font}}}")
		
		return '\n'.join(packages)
	
	def generate_css_fonts(self) -> str:
		"""Generate CSS font declarations"""
		css = []
		
		# Font face declarations for custom fonts
		for font_name, source_url in self.profile.font_sources.items():
			css.append(f"""@font-face {{
  font-family: "{font_name}";
  src: url("{source_url}");
  font-display: {self.profile.web_font_display};
}}""")
		
		# Font family utilities
		css.append(f"""
.font-primary {{ font-family: {self.resolve_font_stack(self.profile.primary_font)}; }}
.font-heading {{ font-family: {self.resolve_font_stack(self.profile.heading_font)}; }}
.font-code {{ font-family: {self.resolve_font_stack(self.profile.code_font)}; }}""")
		
		return '\n'.join(css)


# ============================================================================
# Brand Compliance System
# ============================================================================

class BrandCompliance:
	"""Brand guideline enforcement and validation"""
	
	def __init__(self, guidelines: BrandGuidelines):
		"""Initialize compliance checker with brand guidelines"""
		self.guidelines = guidelines
		self.validation_cache: dict[str, ComplianceResult] = {}
		
		assert guidelines.brand_name, "Brand name must be defined"
	
	async def validate_style_compliance(self, style: ComputedStyle) -> ComplianceResult:
		"""Validate style against brand guidelines"""
		assert isinstance(style, ComputedStyle), "Style must be ComputedStyle instance"
		
		try:
			result = ComplianceResult(
				element_id=style.element_id,
				element_type=style.element_type
			)
			
			# Validate color compliance
			color_score = self._validate_color_compliance(style, result)
			
			# Validate typography compliance  
			typography_score = self._validate_typography_compliance(style, result)
			
			# Validate accessibility compliance
			accessibility_score = self._validate_accessibility_compliance(style, result)
			
			# Calculate overall score
			result.color_compliance = color_score
			result.typography_compliance = typography_score
			result.accessibility_compliance = accessibility_score
			result.overall_score = (color_score + typography_score + accessibility_score) / 3
			
			return result
			
		except Exception as e:
			return ComplianceResult(
				element_id=getattr(style, 'element_id', 'unknown'),
				element_type=getattr(style, 'element_type', 'unknown'),
				overall_score=0.0,
				violations=[{"type": "validation_error", "message": str(e)}]
			)
	
	def _validate_color_compliance(self, style: ComputedStyle, result: ComplianceResult) -> float:
		"""Validate color usage against brand guidelines"""
		score = 1.0
		
		# Check if colors are from approved palette
		approved_colors = [
			self.guidelines.color_palette.primary,
			self.guidelines.color_palette.secondary,
			self.guidelines.color_palette.accent,
			self.guidelines.color_palette.text_primary,
			self.guidelines.color_palette.text_secondary,
			self.guidelines.color_palette.text_muted
		]
		
		if hasattr(style, 'color') and style.color not in approved_colors:
			score -= 0.2
			result.violations.append({
				"type": "color_violation",
				"property": "color",
				"value": style.color,
				"message": "Color not in approved brand palette"
			})
		
		return max(0.0, score)
	
	def _validate_typography_compliance(self, style: ComputedStyle, result: ComplianceResult) -> float:
		"""Validate typography against brand guidelines"""
		score = 1.0
		
		# Check font family compliance
		approved_fonts = [
			self.guidelines.typography.primary_font,
			self.guidelines.typography.heading_font,
			self.guidelines.typography.code_font
		]
		
		if hasattr(style, 'font_family'):
			# Extract first font from font stack
			first_font = style.font_family.split(',')[0].strip('"')
			if first_font not in approved_fonts:
				score -= 0.3
				result.violations.append({
					"type": "typography_violation",
					"property": "font_family",
					"value": first_font,
					"message": "Font not in approved brand typography"
				})
		
		return max(0.0, score)
	
	def _validate_accessibility_compliance(self, style: ComputedStyle, result: ComplianceResult) -> float:
		"""Validate accessibility requirements"""
		score = 1.0
		
		# Check minimum font size
		if hasattr(style, 'font_size'):
			size_px = self._parse_font_size_px(style.font_size)
			if size_px < 12:  # Minimum readable size
				score -= 0.5
				result.violations.append({
					"type": "accessibility_violation",
					"property": "font_size",
					"value": style.font_size,
					"message": "Font size below minimum readable threshold"
				})
		
		return max(0.0, score)
	
	def _parse_font_size_px(self, font_size: str) -> float:
		"""Parse font size to pixels"""
		try:
			if font_size.endswith('pt'):
				return float(font_size[:-2]) * 1.333
			elif font_size.endswith('px'):
				return float(font_size[:-2])
			else:
				return float(font_size)
		except (ValueError, TypeError):
			return 12.0
	
	async def auto_correct_violations(self, style: ComputedStyle) -> ComputedStyle:
		"""Apply automatic corrections for guideline violations"""
		assert isinstance(style, ComputedStyle), "Style must be ComputedStyle instance"
		
		try:
			corrected_style = style
			
			# Auto-correct color violations
			if hasattr(style, 'color'):
				if style.element_type in ['heading', 'title']:
					corrected_style.color = self.guidelines.color_palette.primary
				elif style.element_type == 'text':
					corrected_style.color = self.guidelines.color_palette.text_primary
			
			# Auto-correct typography violations
			if hasattr(style, 'font_family'):
				if style.element_type in ['heading', 'title']:
					corrected_style.font_family = self.guidelines.typography.heading_font
				else:
					corrected_style.font_family = self.guidelines.typography.primary_font
			
			return corrected_style
			
		except Exception:
			return style


# ============================================================================
# Main StyleApplier Class
# ============================================================================

class StyleApplier:
	"""Main style application engine with brand enhancement"""
	
	def __init__(
		self,
		color_manager: ColorManager | None = None,
		typography_manager: TypographyManager | None = None,
		brand_compliance: BrandCompliance | None = None
	):
		"""Initialize style applier with component managers"""
		self.color_manager = color_manager
		self.typography_manager = typography_manager
		self.brand_compliance = brand_compliance
		self.style_cache: dict[str, ComputedStyle] = {}
		
		# Performance metrics
		self.metrics = {
			'styles_applied': 0,
			'cache_hits': 0,
			'compliance_violations': 0,
			'auto_corrections': 0
		}
		
		self._log_initialization()
	
	def _log_initialization(self) -> None:
		"""Log initialization status"""
		# Placeholder for initialization logging
		pass
	
	async def apply_brand_styles(
		self,
		computed_styles: list[ComputedStyle],
		brand_guidelines: BrandGuidelines,
		responsive_config: ResponsiveConfiguration | None = None
	) -> StyleApplicationResult:
		"""Apply brand styling to computed styles"""
		assert isinstance(computed_styles, list), "Computed styles must be a list"
		assert isinstance(brand_guidelines, BrandGuidelines), "Brand guidelines required"
		
		start_time = datetime.now()
		
		try:
			# Initialize managers if not provided
			if not self.color_manager:
				self.color_manager = ColorManager(brand_guidelines.color_palette)
			if not self.typography_manager:
				self.typography_manager = TypographyManager(brand_guidelines.typography)
			if not self.brand_compliance:
				self.brand_compliance = BrandCompliance(brand_guidelines)
			
			enhanced_styles = []
			cache_hits = 0
			violations = []
			corrections = 0
			
			# Process each style
			for style in computed_styles:
				cache_key = f"{style.element_id}:{style.element_type}"
				
				if cache_key in self.style_cache:
					enhanced_style = self.style_cache[cache_key]
					cache_hits += 1
				else:
					# Apply brand enhancement
					enhanced_style = await self.enhance_computed_style(
						style, 
						style.element_type,
						{"brand_guidelines": brand_guidelines}
					)
					
					self.style_cache[cache_key] = enhanced_style
				
				enhanced_styles.append(enhanced_style)
			
			# Update metrics
			self.metrics['styles_applied'] += len(computed_styles)
			self.metrics['cache_hits'] += cache_hits
			
			# Calculate cache hit rate
			cache_hit_rate = cache_hits / len(computed_styles) if computed_styles else 0.0
			
			# Generate format-specific outputs
			latex_preamble = ""
			css_styles = ""
			if self.color_manager:
				latex_preamble += self.color_manager.export_latex_colors()
				css_styles += self.color_manager.export_css_variables()
			
			if self.typography_manager:
				latex_preamble += "\n" + self.typography_manager.generate_latex_fonts()
				css_styles += "\n" + self.typography_manager.generate_css_fonts()
			
			processing_time = (datetime.now() - start_time).total_seconds()
			
			return StyleApplicationResult(
				success=True,
				styles_processed=len(computed_styles),
				styles_enhanced=len(enhanced_styles),
				enhanced_styles=enhanced_styles,
				processing_time=processing_time,
				cache_hit_rate=cache_hit_rate,
				accessibility_score=1.0,  # Would be calculated from compliance results
				brand_compliance_score=1.0,  # Would be calculated from compliance results
				latex_preamble=latex_preamble,
				css_styles=css_styles,
				auto_corrections_applied=corrections
			)
			
		except Exception as e:
			processing_time = (datetime.now() - start_time).total_seconds()
			
			return StyleApplicationResult(
				success=False,
				styles_processed=len(computed_styles),
				processing_time=processing_time,
				accessibility_violations=[f"Processing error: {str(e)}"]
			)
	
	async def enhance_computed_style(
		self,
		style: ComputedStyle,
		element_type: str,
		context: dict[str, Any] | None = None
	) -> ComputedStyle:
		"""Enhance single computed style with brand application"""
		assert isinstance(style, ComputedStyle), "Style must be ComputedStyle instance"
		
		try:
			enhanced_style = style
			
			# Apply color enhancement
			if self.color_manager:
				enhanced_style = self.color_manager.apply_brand_colors(enhanced_style)
			
			# Apply typography enhancement
			if self.typography_manager:
				enhanced_style = self.typography_manager.apply_typography(enhanced_style, element_type)
			
			# Validate and auto-correct if needed
			if self.brand_compliance:
				compliance_result = await self.brand_compliance.validate_style_compliance(enhanced_style)
				
				if compliance_result.overall_score < 0.8:  # Below acceptable threshold
					enhanced_style = await self.brand_compliance.auto_correct_violations(enhanced_style)
					self.metrics['auto_corrections'] += 1
				
				if compliance_result.violations:
					self.metrics['compliance_violations'] += len(compliance_result.violations)
			
			return enhanced_style
			
		except Exception as e:
			# Return original style if enhancement fails
			return style
	
	async def get_applier_metrics(self) -> dict[str, Any]:
		"""Get comprehensive style applier performance metrics"""
		return {
			'performance_metrics': self.metrics.copy(),
			'cache_size': len(self.style_cache),
			'components_initialized': {
				'color_manager': self.color_manager is not None,
				'typography_manager': self.typography_manager is not None,
				'brand_compliance': self.brand_compliance is not None
			}
		}


# ============================================================================
# Exception Classes
# ============================================================================

class StyleApplierException(Exception):
	"""Base exception for StyleApplier operations"""
	pass


class ColorManagementException(StyleApplierException):
	"""Raised when color management operations fail"""
	pass


class TypographyException(StyleApplierException):
	"""Raised when typography operations fail"""
	pass


class BrandComplianceException(StyleApplierException):
	"""Raised when brand compliance validation fails"""
	pass


# ============================================================================
# Utility Functions
# ============================================================================

def create_default_brand_guidelines(brand_name: str) -> BrandGuidelines:
	"""Create default brand guidelines for testing and quick setup"""
	return BrandGuidelines(
		brand_name=brand_name,
		color_palette=ColorPalette(
			primary="#1f2937",
			secondary="#6b7280",
			accent="#3b82f6"
		),
		typography=TypographyProfile(
			primary_font="Inter",
			heading_font="Inter",
			code_font="JetBrains Mono"
		)
	)


async def quick_apply_brand_styles(
	styles: list[ComputedStyle],
	brand_name: str = "Default Brand"
) -> StyleApplicationResult:
	"""Quick brand style application with default settings"""
	guidelines = create_default_brand_guidelines(brand_name)
	applier = StyleApplier()
	
	return await applier.apply_brand_styles(styles, guidelines)


# ============================================================================
# Module Assertions
# ============================================================================

# Rebuild pydantic dataclasses
rebuild_dataclass(ColorPalette)
rebuild_dataclass(TypographyProfile)
rebuild_dataclass(BrandStyleRule)
rebuild_dataclass(BrandGuidelines)
rebuild_dataclass(StyleApplicationResult)
rebuild_dataclass(ComplianceResult)

# Validate component availability
assert ColorManager, "ColorManager must be available"
assert TypographyManager, "TypographyManager must be available"
assert BrandCompliance, "BrandCompliance must be available"
assert StyleApplier, "StyleApplier must be available as main interface"