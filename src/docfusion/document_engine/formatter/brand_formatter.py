#!/usr/bin/env python3
"""
BrandFormatter Module

Comprehensive brand identity management and visual consistency enforcement for DocuFusion documents.
Provides intelligent logo placement, brand guideline enforcement, and visual identity coordination
across multiple output formats.

Key Features:
- Intelligent logo placement with format-specific optimization
- Comprehensive brand guideline enforcement and compliance validation  
- Document type recognition and template selection
- Multi-format brand asset management (SVG, PNG, PDF)
- Cross-document brand consistency validation
- Enterprise-grade brand rule engine with automatic correction
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from pydantic import Field, ConfigDict
from pydantic.dataclasses import dataclass as pydantic_dataclass, rebuild_dataclass
from ...core.utils import uuid7str

logger = logging.getLogger(__name__)

# ============================================================================
# Exception Classes
# ============================================================================

class BrandFormatterException(Exception):
	"""Base exception for BrandFormatter module"""
	pass

class LogoManagementException(BrandFormatterException):
	"""Exception for logo management errors"""
	pass

class BrandComplianceException(BrandFormatterException):
	"""Exception for brand compliance validation errors"""
	pass

class DocumentTypeClassificationException(BrandFormatterException):
	"""Exception for document type classification errors"""
	pass

class BrandAssetException(BrandFormatterException):
	"""Exception for brand asset management errors"""
	pass

# ============================================================================
# Core Data Models
# ============================================================================

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class LogoDimensions:
	"""Logo dimension specifications"""
	width: float = 0.0
	height: float = 0.0
	aspect_ratio: float = 1.0
	units: str = "px"
	dpi: int = 72
	
	# Size constraints
	min_width: float = 20.0
	max_width: float = 400.0
	min_height: float = 20.0
	max_height: float = 400.0

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class LogoAsset:
	"""Individual logo asset specification"""
	# Asset identification
	asset_name: str
	variant_type: str  # primary, icon, horizontal, stacked, mono
	asset_id: str = Field(default_factory=uuid7str)
	
	# File specifications
	file_path: str = ""
	file_format: str = "svg"  # svg, png, pdf, eps
	file_size: int = 0
	dimensions: LogoDimensions = Field(default_factory=LogoDimensions)
	
	# Usage specifications
	min_size: str = "20px"
	max_size: str = "400px"
	clear_space: str = "1x logo height"
	
	# Color specifications
	color_mode: str = "full_color"  # full_color, monochrome, reversed
	background_requirements: list[str] = Field(default_factory=list)
	color_variations: dict[str, str] = Field(default_factory=dict)
	
	# Usage contexts
	usage_contexts: list[str] = Field(default_factory=list)  # header, footer, cover, watermark
	document_types: list[str] = Field(default_factory=list)  # proposal, report, presentation
	
	# Technical specifications
	dpi_requirements: dict[str, int] = Field(default_factory=dict)
	color_profile: str = "sRGB"
	transparency_support: bool = True
	
	# Metadata
	created_date: datetime = Field(default_factory=datetime.now)
	last_optimized: datetime = Field(default_factory=datetime.now)
	usage_count: int = 0

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class LogoAssetLibrary:
	"""Comprehensive logo asset management"""
	# Primary logo assets
	primary_logo: LogoAsset
	logo_variants: dict[str, LogoAsset] = Field(default_factory=dict)  # icon, horizontal, stacked
	
	# Format-specific versions
	vector_logos: dict[str, str] = Field(default_factory=dict)  # SVG, PDF, EPS
	raster_logos: dict[str, str] = Field(default_factory=dict)  # PNG, JPG at various resolutions
	
	# Specialized versions
	monochrome_logos: dict[str, str] = Field(default_factory=dict)
	reversed_logos: dict[str, str] = Field(default_factory=dict)  # For dark backgrounds
	
	# Usage metadata
	logo_usage_tracking: dict[str, dict[str, Any]] = Field(default_factory=dict)
	asset_optimization_cache: dict[str, dict[str, Any]] = Field(default_factory=dict)
	
	# Validation and compliance
	asset_validation_status: dict[str, bool] = Field(default_factory=dict)
	compliance_check_results: dict[str, dict[str, Any]] = Field(default_factory=dict)

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class BrandRule:
	"""Individual brand guideline rule"""
	# Rule identification
	rule_name: str
	rule_category: str  # logo, color, typography, spacing, layout
	rule_id: str = Field(default_factory=uuid7str)
	
	# Rule definition
	rule_type: str = "requirement"  # requirement, constraint, preference, prohibition
	rule_description: str = ""
	rule_validation_logic: str = ""  # Python expression or function name
	
	# Compliance specification
	severity: str = "warning"  # error, warning, suggestion
	enforcement_mode: str = "validate"  # validate, correct, ignore
	auto_correction: bool = True
	
	# Context and scope
	applicable_contexts: list[str] = Field(default_factory=list)
	document_types: list[str] = Field(default_factory=list)
	content_selectors: list[str] = Field(default_factory=list)
	
	# Violation handling
	violation_message: str = ""
	correction_suggestion: str = ""
	alternative_approaches: list[str] = Field(default_factory=list)
	
	# Performance
	rule_priority: int = 100  # Higher number = higher priority
	performance_weight: float = 1.0  # Computational cost multiplier
	
	# Metadata
	rule_version: str = "1.0"
	last_updated: datetime = Field(default_factory=datetime.now)
	usage_statistics: dict[str, Any] = Field(default_factory=dict)

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class BrandColorSystem:
	"""Brand color system specification"""
	# Primary brand colors
	primary_color: str = "#1f2937"
	secondary_color: str = "#6b7280"
	accent_color: str = "#3b82f6"
	
	# Extended color palette
	color_palette: dict[str, str] = Field(default_factory=dict)
	color_variations: dict[str, list[str]] = Field(default_factory=dict)
	
	# Usage rules
	color_usage_rules: dict[str, str] = Field(default_factory=dict)
	prohibited_combinations: list[tuple[str, str]] = Field(default_factory=list)
	
	# Accessibility requirements
	min_contrast_ratios: dict[str, float] = Field(default_factory=dict)
	accessibility_compliance: str = "AA"  # A, AA, AAA
	
	# Format specifications
	color_profiles: dict[str, str] = Field(default_factory=dict)  # format -> profile
	color_precision: int = 6  # Hex color precision

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class BrandTypographySystem:
	"""Brand typography system specification"""
	# Font specifications
	primary_font: str = "Inter"
	heading_font: str = "Inter"
	code_font: str = "JetBrains Mono"
	accent_font: str = ""
	
	# Typography hierarchy
	font_sizes: dict[str, str] = Field(default_factory=dict)
	font_weights: dict[str, str] = Field(default_factory=dict)
	line_heights: dict[str, float] = Field(default_factory=dict)
	
	# Spacing and layout
	letter_spacing: dict[str, str] = Field(default_factory=dict)
	text_alignment_rules: dict[str, str] = Field(default_factory=dict)
	
	# Usage rules
	typography_hierarchy_rules: list[str] = Field(default_factory=list)
	content_type_mappings: dict[str, str] = Field(default_factory=dict)
	
	# Technical specifications
	font_loading_strategy: str = "swap"
	fallback_fonts: dict[str, list[str]] = Field(default_factory=dict)
	web_font_optimizations: dict[str, Any] = Field(default_factory=dict)

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class BrandSpacingSystem:
	"""Brand spacing and layout system"""
	# Base spacing units
	base_unit: str = "1rem"
	spacing_scale: list[str] = Field(default_factory=list)
	
	# Element spacing rules
	section_spacing: dict[str, str] = Field(default_factory=dict)
	component_spacing: dict[str, str] = Field(default_factory=dict)
	text_spacing: dict[str, str] = Field(default_factory=dict)
	
	# Layout constraints
	margin_rules: dict[str, str] = Field(default_factory=dict)
	padding_rules: dict[str, str] = Field(default_factory=dict)
	grid_system: dict[str, Any] = Field(default_factory=dict)
	
	# Responsive spacing
	responsive_spacing: dict[str, dict[str, str]] = Field(default_factory=dict)
	breakpoint_adaptations: dict[str, dict[str, str]] = Field(default_factory=dict)

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class LogoPlacementRules:
	"""Logo placement rules and constraints"""
	# Placement preferences
	preferred_positions: list[str] = Field(default_factory=list)  # top_left, top_center, etc.
	prohibited_positions: list[str] = Field(default_factory=list)
	
	# Size constraints
	min_size_rules: dict[str, str] = Field(default_factory=dict)  # context -> min_size
	max_size_rules: dict[str, str] = Field(default_factory=dict)
	size_calculation_method: str = "responsive"  # fixed, responsive, content_aware
	
	# Clear space requirements
	clear_space_multiplier: float = 1.5  # Multiple of logo height
	clear_space_minimum: str = "10px"
	clear_space_exceptions: dict[str, str] = Field(default_factory=dict)
	
	# Context-specific rules
	header_placement_rules: dict[str, Any] = Field(default_factory=dict)
	footer_placement_rules: dict[str, Any] = Field(default_factory=dict)
	cover_placement_rules: dict[str, Any] = Field(default_factory=dict)
	
	# Multi-logo coordination
	multi_logo_spacing: str = "2x clear_space"
	logo_hierarchy_rules: dict[str, int] = Field(default_factory=dict)  # variant -> priority

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class ComplianceThresholds:
	"""Brand compliance scoring thresholds"""
	# Overall compliance thresholds
	excellent_threshold: float = 0.95
	good_threshold: float = 0.85
	acceptable_threshold: float = 0.70
	poor_threshold: float = 0.50
	
	# Category-specific thresholds
	logo_compliance_weight: float = 0.25
	color_compliance_weight: float = 0.25
	typography_compliance_weight: float = 0.25
	layout_compliance_weight: float = 0.25
	
	# Violation severity weights
	error_weight: float = 1.0
	warning_weight: float = 0.5
	suggestion_weight: float = 0.1
	
	# Performance thresholds
	max_processing_time: float = 5.0  # seconds
	max_memory_usage: float = 100.0  # MB

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class BrandSpecification:
	"""Complete brand specification with guidelines and assets"""
	# Brand identity (required fields first)
	brand_name: str
	logo_assets: LogoAssetLibrary
	
	# Brand identity (optional fields)
	brand_id: str = Field(default_factory=uuid7str)
	brand_version: str = "1.0"
	
	# Logo specifications
	logo_placement_rules: LogoPlacementRules = Field(default_factory=LogoPlacementRules)
	
	# Visual guidelines
	color_system: BrandColorSystem = Field(default_factory=BrandColorSystem)
	typography_system: BrandTypographySystem = Field(default_factory=BrandTypographySystem)
	spacing_system: BrandSpacingSystem = Field(default_factory=BrandSpacingSystem)
	
	# Compliance rules
	brand_rules: list[BrandRule] = Field(default_factory=list)
	compliance_thresholds: ComplianceThresholds = Field(default_factory=ComplianceThresholds)
	
	# Document type configurations
	document_templates: dict[str, dict[str, Any]] = Field(default_factory=dict)
	type_specific_rules: dict[str, list[BrandRule]] = Field(default_factory=dict)
	
	# Output configurations
	format_specifications: dict[str, dict[str, Any]] = Field(default_factory=dict)
	asset_optimizations: dict[str, dict[str, Any]] = Field(default_factory=dict)
	
	# Metadata
	created_date: datetime = Field(default_factory=datetime.now)
	last_modified: datetime = Field(default_factory=datetime.now)
	compliance_validated: bool = False

# ============================================================================
# Result Classes
# ============================================================================

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class LogoPlacement:
	"""Logo placement result specification"""
	# Required fields first
	logo_asset: LogoAsset
	placement_context: str  # header, footer, cover, watermark
	
	# Optional fields
	placement_id: str = Field(default_factory=uuid7str)
	
	# Position specification
	position: dict[str, str] = Field(default_factory=dict)  # x, y, alignment
	size: dict[str, str] = Field(default_factory=dict)  # width, height
	z_index: int = 100
	
	# Formatting specifications
	opacity: float = 1.0
	rotation: float = 0.0
	transformation: str = ""
	
	# Clear space validation
	clear_space_satisfied: bool = True
	clear_space_violations: list[str] = Field(default_factory=list)
	
	# Quality metrics
	placement_quality_score: float = 0.0
	visibility_score: float = 0.0
	accessibility_score: float = 0.0
	
	# Format outputs
	latex_placement: str = ""
	css_placement: str = ""
	html_placement: str = ""
	
	# Metadata
	placement_timestamp: datetime = Field(default_factory=datetime.now)
	optimization_applied: bool = False

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class BrandViolation:
	"""Brand guideline violation specification"""
	# Required fields first
	rule_violated: BrandRule
	violation_type: str  # logo, color, typography, spacing, layout
	severity: str  # error, warning, suggestion
	
	# Optional fields
	violation_id: str = Field(default_factory=uuid7str)
	description: str = ""
	location: str = ""  # Document location or element ID
	
	# Violation context
	current_value: str = ""
	expected_value: str = ""
	deviation_magnitude: float = 0.0
	
	# Correction information
	auto_correctable: bool = False
	correction_suggestion: str = ""
	correction_confidence: float = 0.0
	
	# Impact assessment
	compliance_impact: float = 0.0
	user_experience_impact: str = "low"  # low, medium, high
	brand_perception_impact: str = "low"
	
	# Metadata
	detected_timestamp: datetime = Field(default_factory=datetime.now)
	correction_applied: bool = False

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class BrandComplianceReport:
	"""Comprehensive brand compliance analysis report"""
	# Report identification
	report_id: str = Field(default_factory=uuid7str)
	document_id: str = ""
	analysis_timestamp: datetime = Field(default_factory=datetime.now)
	
	# Overall compliance scoring
	overall_compliance_score: float = 0.0
	logo_compliance_score: float = 0.0
	color_compliance_score: float = 0.0
	typography_compliance_score: float = 0.0
	layout_compliance_score: float = 0.0
	
	# Violation analysis
	total_violations: int = 0
	violations_by_severity: dict[str, int] = Field(default_factory=dict)
	violations_by_category: dict[str, int] = Field(default_factory=dict)
	detailed_violations: list[BrandViolation] = Field(default_factory=list)
	
	# Logo analysis
	logo_placements_analyzed: int = 0
	logo_placement_quality: float = 0.0
	logo_compliance_issues: list[str] = Field(default_factory=list)
	
	# Color analysis
	colors_analyzed: int = 0
	color_compliance_rate: float = 0.0
	non_brand_colors_detected: list[str] = Field(default_factory=list)
	
	# Typography analysis
	typography_elements_analyzed: int = 0
	typography_compliance_rate: float = 0.0
	typography_violations: list[str] = Field(default_factory=list)
	
	# Recommendations
	priority_recommendations: list[str] = Field(default_factory=list)
	quick_fixes: list[str] = Field(default_factory=list)
	long_term_improvements: list[str] = Field(default_factory=list)
	
	# Performance metrics
	analysis_duration: float = 0.0
	rules_evaluated: int = 0
	auto_corrections_available: int = 0

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class DocumentTypeClassification:
	"""Document type classification result"""
	# Classification results
	document_type: str = "unknown"
	confidence_score: float = 0.0
	alternative_types: list[tuple[str, float]] = Field(default_factory=list)
	
	# Analysis details
	content_indicators: dict[str, float] = Field(default_factory=dict)
	structure_indicators: dict[str, float] = Field(default_factory=dict)
	metadata_indicators: dict[str, float] = Field(default_factory=dict)
	
	# Brand template recommendations
	recommended_template: str = ""
	template_confidence: float = 0.0
	template_customizations: dict[str, Any] = Field(default_factory=dict)
	
	# Classification metadata
	classification_method: str = "hybrid"
	model_version: str = "1.0"
	classification_timestamp: datetime = Field(default_factory=datetime.now)

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class BrandFormattingResult:
	"""Complete brand formatting result"""
	# Result identification
	result_id: str = Field(default_factory=uuid7str)
	document_id: str = ""
	processing_timestamp: datetime = Field(default_factory=datetime.now)
	
	# Brand application results
	logo_placements: list[LogoPlacement] = Field(default_factory=list)
	brand_compliance_report: BrandComplianceReport = Field(default_factory=BrandComplianceReport)
	document_classification: DocumentTypeClassification = Field(default_factory=DocumentTypeClassification)
	
	# Applied formatting
	brand_styles_applied: dict[str, Any] = Field(default_factory=dict)
	template_customizations: dict[str, Any] = Field(default_factory=dict)
	auto_corrections_applied: list[dict[str, Any]] = Field(default_factory=list)
	
	# Quality metrics. Optional so "no measurement yet" can be expressed
	# directly — the document_engine quality aggregator skips None
	# contributors rather than averaging them in as 0.0. The successful
	# code path inside apply_brand_formatting still sets concrete floats
	# via _calculate_formatting_quality and brand_compliance_report.
	formatting_quality_score: Optional[float] = None
	brand_consistency_score: Optional[float] = None
	accessibility_compliance_score: Optional[float] = None
	
	# Format outputs
	latex_brand_output: str = ""
	css_brand_output: str = ""
	html_brand_output: str = ""
	
	# Performance metrics
	total_processing_time: float = 0.0
	cache_hit_rate: float = 0.0
	optimization_efficiency: float = 0.0
	
	# Status and validation
	formatting_successful: bool = True
	validation_warnings: list[str] = Field(default_factory=list)
	validation_errors: list[str] = Field(default_factory=list)

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class BrandFormatterMetrics:
	"""BrandFormatter performance and quality metrics"""
	# Processing statistics
	documents_processed: int = 0
	total_processing_time: float = 0.0
	average_processing_time: float = 0.0
	
	# Brand compliance statistics
	average_compliance_score: float = 0.0
	total_violations_detected: int = 0
	auto_corrections_applied: int = 0
	compliance_improvement_rate: float = 0.0
	
	# Logo management statistics
	logos_placed: int = 0
	logo_placement_success_rate: float = 0.0
	logo_optimization_efficiency: float = 0.0
	
	# Performance metrics
	cache_hit_rate: float = 0.0
	memory_usage: float = 0.0
	processing_efficiency: float = 0.0
	
	# Quality metrics
	formatting_success_rate: float = 0.0
	user_satisfaction_score: float = 0.0
	brand_consistency_improvement: float = 0.0

# ============================================================================
# Core Components
# ============================================================================

class LogoManager:
	"""Comprehensive logo management and placement system"""
	
	def __init__(self, asset_library: LogoAssetLibrary):
		self.asset_library = asset_library
		self.placement_cache = {}
		self.optimization_cache = {}
		
		# Logo processing capabilities
		self.supported_formats = {'svg', 'png', 'pdf', 'eps', 'jpg', 'jpeg'}
		self.optimization_strategies = {
			'web': self._optimize_for_web,
			'print': self._optimize_for_print,
			'mobile': self._optimize_for_mobile
		}
	
	def place_logo(
		self,
		logo_variant: str,
		placement_context: str,
		layout_constraints: dict[str, Any]
	) -> LogoPlacement:
		"""Intelligent logo placement with constraint satisfaction"""
		assert logo_variant in self.asset_library.logo_variants, f"Logo variant '{logo_variant}' not found"
		assert placement_context in ['header', 'footer', 'cover', 'watermark'], f"Invalid placement context: {placement_context}"
		
		logo_asset = self.asset_library.logo_variants[logo_variant]
		
		# Calculate optimal position
		position = self._calculate_optimal_position(logo_asset, placement_context, layout_constraints)
		
		# Calculate optimal size
		size = self._calculate_optimal_size(logo_asset, placement_context, layout_constraints)
		
		# Validate clear space requirements
		clear_space_validation = self._validate_clear_space(position, size, layout_constraints)
		
		# Generate format-specific output
		format_outputs = self._generate_placement_outputs(logo_asset, position, size, placement_context)
		
		placement = LogoPlacement(
			logo_asset=logo_asset,
			placement_context=placement_context,
			position=position,
			size=size,
			clear_space_satisfied=clear_space_validation['satisfied'],
			clear_space_violations=clear_space_validation['violations'],
			placement_quality_score=self._calculate_placement_quality(position, size, clear_space_validation),
			latex_placement=format_outputs['latex'],
			css_placement=format_outputs['css'],
			html_placement=format_outputs['html']
		)
		
		return placement
	
	def optimize_logo_for_format(
		self,
		logo_asset: LogoAsset,
		target_format: str,
		optimization_params: dict[str, Any] = None
	) -> dict[str, Any]:
		"""Format-specific logo optimization"""
		if optimization_params is None:
			optimization_params = {}
		
		cache_key = f"{logo_asset.asset_id}_{target_format}_{hash(str(optimization_params))}"
		
		if cache_key in self.optimization_cache:
			return self.optimization_cache[cache_key]
		
		if target_format in self.optimization_strategies:
			optimized_result = self.optimization_strategies[target_format](logo_asset, optimization_params)
		else:
			optimized_result = self._default_optimization(logo_asset, target_format, optimization_params)
		
		self.optimization_cache[cache_key] = optimized_result
		return optimized_result
	
	def validate_logo_compliance(
		self,
		logo_placement: LogoPlacement,
		brand_rules: list[BrandRule]
	) -> dict[str, Any]:
		"""Validate logo placement against brand guidelines"""
		compliance_results = {
			'compliant': True,
			'score': 1.0,
			'violations': [],
			'recommendations': []
		}
		
		logo_rules = [rule for rule in brand_rules if rule.rule_category == 'logo']
		
		for rule in logo_rules:
			violation = self._check_logo_rule_compliance(logo_placement, rule)
			if violation:
				compliance_results['violations'].append(violation)
				compliance_results['compliant'] = False
		
		# Calculate compliance score
		if compliance_results['violations']:
			violation_impact = sum(self._get_violation_impact(v) for v in compliance_results['violations'])
			compliance_results['score'] = max(0.0, 1.0 - violation_impact)
		
		return compliance_results
	
	def _calculate_optimal_position(
		self,
		logo_asset: LogoAsset,
		placement_context: str,
		layout_constraints: dict[str, Any]
	) -> dict[str, str]:
		"""Calculate optimal logo position based on context and constraints"""
		# Default positioning strategies by context
		default_positions = {
			'header': {'x': '20px', 'y': '20px', 'alignment': 'top_left'},
			'footer': {'x': 'center', 'y': '10px', 'alignment': 'bottom_center'},
			'cover': {'x': 'center', 'y': '100px', 'alignment': 'top_center'},
			'watermark': {'x': 'center', 'y': 'center', 'alignment': 'center'}
		}
		
		base_position = default_positions.get(placement_context, default_positions['header'])
		
		# Apply layout constraints
		if 'margins' in layout_constraints:
			margins = layout_constraints['margins']
			if base_position['x'] == '20px':
				base_position['x'] = margins.get('left', '20px')
			if base_position['y'] == '20px':
				base_position['y'] = margins.get('top', '20px')
		
		return base_position
	
	def _calculate_optimal_size(
		self,
		logo_asset: LogoAsset,
		placement_context: str,
		layout_constraints: dict[str, Any]
	) -> dict[str, str]:
		"""Calculate optimal logo size based on context and constraints"""
		# Default sizing strategies by context
		default_sizes = {
			'header': {'width': '120px', 'height': 'auto'},
			'footer': {'width': '80px', 'height': 'auto'},
			'cover': {'width': '200px', 'height': 'auto'},
			'watermark': {'width': '150px', 'height': 'auto', 'opacity': '0.1'}
		}
		
		base_size = default_sizes.get(placement_context, default_sizes['header'])
		
		# Apply asset constraints
		min_size = self._parse_size(logo_asset.min_size)
		max_size = self._parse_size(logo_asset.max_size)
		current_size = self._parse_size(base_size['width'])
		
		# Ensure size is within asset constraints
		if current_size < min_size:
			base_size['width'] = logo_asset.min_size
		elif current_size > max_size:
			base_size['width'] = logo_asset.max_size
		
		return base_size
	
	def _validate_clear_space(
		self,
		position: dict[str, str],
		size: dict[str, str],
		layout_constraints: dict[str, Any]
	) -> dict[str, Any]:
		"""Validate clear space requirements around logo"""
		validation_result = {
			'satisfied': True,
			'violations': []
		}
		
		# Basic clear space validation (simplified)
		required_clear_space = 20  # pixels
		
		# Check margins from edges
		x_pos = self._parse_size(position.get('x', '0px'))
		y_pos = self._parse_size(position.get('y', '0px'))
		
		if x_pos < required_clear_space:
			validation_result['satisfied'] = False
			validation_result['violations'].append('Insufficient left margin')
		
		if y_pos < required_clear_space:
			validation_result['satisfied'] = False
			validation_result['violations'].append('Insufficient top margin')
		
		return validation_result
	
	def _generate_placement_outputs(
		self,
		logo_asset: LogoAsset,
		position: dict[str, str],
		size: dict[str, str],
		placement_context: str
	) -> dict[str, str]:
		"""Generate format-specific placement code"""
		outputs = {}
		
		# LaTeX output
		latex_width = size.get('width', '120px').replace('px', 'pt')
		outputs['latex'] = f"\\includegraphics[width={latex_width}]{{{logo_asset.file_path}}}"
		
		# CSS output
		css_position = f"position: absolute; left: {position.get('x', '20px')}; top: {position.get('y', '20px')};"
		css_size = f"width: {size.get('width', '120px')}; height: {size.get('height', 'auto')};"
		outputs['css'] = f".logo-{placement_context} {{ {css_position} {css_size} }}"
		
		# HTML output
		alt_text = f"{logo_asset.asset_name} logo"
		outputs['html'] = f"<img src='{logo_asset.file_path}' alt='{alt_text}' class='logo-{placement_context}'>"
		
		return outputs
	
	def _calculate_placement_quality(
		self,
		position: dict[str, str],
		size: dict[str, str],
		clear_space_validation: dict[str, Any]
	) -> float:
		"""Calculate placement quality score"""
		base_score = 0.8
		
		# Penalize clear space violations
		if not clear_space_validation['satisfied']:
			violation_penalty = len(clear_space_validation['violations']) * 0.1
			base_score -= violation_penalty
		
		# Bonus for optimal positioning
		if position.get('alignment') in ['top_left', 'top_center', 'bottom_center']:
			base_score += 0.1
		
		return max(0.0, min(1.0, base_score))
	
	def _optimize_for_web(self, logo_asset: LogoAsset, params: dict[str, Any]) -> dict[str, Any]:
		"""Optimize logo for web usage"""
		return {
			'format': 'svg',
			'compression': 'gzip',
			'optimization_applied': ['svg_minification', 'path_optimization'],
			'performance_score': 0.9
		}
	
	def _optimize_for_print(self, logo_asset: LogoAsset, params: dict[str, Any]) -> dict[str, Any]:
		"""Optimize logo for print usage"""
		return {
			'format': 'pdf',
			'color_profile': 'CMYK',
			'resolution': '300dpi',
			'optimization_applied': ['vector_optimization', 'color_profile_conversion'],
			'performance_score': 0.95
		}
	
	def _optimize_for_mobile(self, logo_asset: LogoAsset, params: dict[str, Any]) -> dict[str, Any]:
		"""Optimize logo for mobile usage"""
		return {
			'format': 'png',
			'resolution': '2x',
			'compression': 'lossless',
			'optimization_applied': ['size_optimization', 'format_conversion'],
			'performance_score': 0.85
		}
	
	def _default_optimization(self, logo_asset: LogoAsset, target_format: str, params: dict[str, Any]) -> dict[str, Any]:
		"""Default optimization strategy"""
		return {
			'format': target_format,
			'optimization_applied': ['basic_optimization'],
			'performance_score': 0.7
		}
	
	def _parse_size(self, size_str: str) -> float:
		"""Parse size string to numeric value"""
		if not size_str or size_str == 'auto':
			return 100.0  # Default size
		
		# Extract numeric value
		match = re.match(r'([\d.]+)', str(size_str))
		if match:
			return float(match.group(1))
		
		return 100.0
	
	def _check_logo_rule_compliance(self, logo_placement: LogoPlacement, rule: BrandRule) -> dict[str, Any] | None:
		"""Check if logo placement complies with specific brand rule"""
		# Simplified rule checking
		if rule.rule_name == "minimum_logo_clear_space" and not logo_placement.clear_space_satisfied:
			return {
				'rule_id': rule.rule_id,
				'rule_name': rule.rule_name,
				'violation_type': 'clear_space',
				'severity': rule.severity,
				'description': 'Logo does not meet minimum clear space requirements'
			}
		
		return None
	
	def _get_violation_impact(self, violation: dict[str, Any]) -> float:
		"""Calculate impact of a violation on compliance score"""
		severity_weights = {
			'error': 0.3,
			'warning': 0.15,
			'suggestion': 0.05
		}
		
		return severity_weights.get(violation.get('severity', 'warning'), 0.15)

class BrandEnforcementEngine:
	"""Brand guideline enforcement and compliance validation"""
	
	def __init__(self, brand_specification: BrandSpecification):
		self.brand_spec = brand_specification
		self.compliance_cache = {}
		
		# Default brand rules if none specified
		if not self.brand_spec.brand_rules:
			self.brand_spec.brand_rules = self._create_default_brand_rules()
	
	async def analyze_brand_compliance(
		self,
		document_content: dict[str, Any],
		applied_formatting: dict[str, Any]
	) -> BrandComplianceReport:
		"""Comprehensive brand compliance analysis"""
		start_time = datetime.now()
		
		# Initialize compliance report
		compliance_report = BrandComplianceReport(
			document_id=document_content.get('id', 'unknown'),
			analysis_timestamp=start_time
		)
		
		# Analyze different compliance categories
		logo_compliance = await self._analyze_logo_compliance(document_content, applied_formatting)
		color_compliance = await self._analyze_color_compliance(document_content, applied_formatting)
		typography_compliance = await self._analyze_typography_compliance(document_content, applied_formatting)
		
		# Aggregate compliance scores
		compliance_report.logo_compliance_score = logo_compliance['score']
		compliance_report.color_compliance_score = color_compliance['score']
		compliance_report.typography_compliance_score = typography_compliance['score']
		compliance_report.layout_compliance_score = 0.85  # Placeholder
		
		# Calculate overall compliance score
		weights = self.brand_spec.compliance_thresholds
		compliance_report.overall_compliance_score = (
			logo_compliance['score'] * weights.logo_compliance_weight +
			color_compliance['score'] * weights.color_compliance_weight +
			typography_compliance['score'] * weights.typography_compliance_weight +
			0.85 * weights.layout_compliance_weight  # Placeholder layout score
		)
		
		# Collect violations
		all_violations = []
		all_violations.extend(logo_compliance.get('violations', []))
		all_violations.extend(color_compliance.get('violations', []))
		all_violations.extend(typography_compliance.get('violations', []))
		
		# Convert violations to BrandViolation objects
		for violation_data in all_violations:
			violation = self._create_brand_violation(violation_data)
			compliance_report.detailed_violations.append(violation)
		
		# Update violation statistics
		compliance_report.total_violations = len(compliance_report.detailed_violations)
		compliance_report.violations_by_severity = self._count_violations_by_severity(compliance_report.detailed_violations)
		compliance_report.violations_by_category = self._count_violations_by_category(compliance_report.detailed_violations)
		
		# Generate recommendations
		compliance_report.priority_recommendations = self._generate_priority_recommendations(compliance_report)
		compliance_report.quick_fixes = self._generate_quick_fixes(compliance_report)
		
		# Performance metrics
		compliance_report.analysis_duration = (datetime.now() - start_time).total_seconds()
		compliance_report.rules_evaluated = len(self.brand_spec.brand_rules)
		compliance_report.auto_corrections_available = len([v for v in compliance_report.detailed_violations if v.auto_correctable])
		
		return compliance_report
	
	async def enforce_brand_guidelines(
		self,
		content_elements: list[dict[str, Any]],
		enforcement_level: str = "strict"
	) -> dict[str, Any]:
		"""Apply brand guideline enforcement to content"""
		enforcement_result = {
			'success': True,
			'elements_processed': len(content_elements),
			'violations_detected': 0,
			'corrections_applied': 0,
			'enforcement_level': enforcement_level,
			'corrected_elements': [],
			'processing_time': 0.0
		}
		
		start_time = datetime.now()
		
		for element in content_elements:
			element_violations = await self._check_element_compliance(element)
			
			if element_violations:
				enforcement_result['violations_detected'] += len(element_violations)
				
				if enforcement_level in ['strict', 'moderate']:
					corrections = await self._apply_auto_corrections(element, element_violations)
					enforcement_result['corrections_applied'] += len(corrections)
					enforcement_result['corrected_elements'].append({
						'element_id': element.get('id', 'unknown'),
						'corrections': corrections
					})
		
		enforcement_result['processing_time'] = (datetime.now() - start_time).total_seconds()
		
		return enforcement_result
	
	def _create_default_brand_rules(self) -> list[BrandRule]:
		"""Create default brand rules if none are specified"""
		default_rules = []
		
		# Logo rules
		default_rules.append(BrandRule(
			rule_name="minimum_logo_clear_space",
			rule_category="logo",
			rule_type="requirement",
			rule_description="Logo must have minimum clear space around it",
			severity="warning",
			enforcement_mode="validate"
		))
		
		# Color rules
		default_rules.append(BrandRule(
			rule_name="brand_color_usage",
			rule_category="color",
			rule_type="requirement",
			rule_description="Only approved brand colors should be used",
			severity="warning",
			enforcement_mode="correct"
		))
		
		# Typography rules
		default_rules.append(BrandRule(
			rule_name="brand_font_usage",
			rule_category="typography",
			rule_type="requirement",
			rule_description="Only approved brand fonts should be used",
			severity="warning",
			enforcement_mode="correct"
		))
		
		return default_rules
	
	async def _analyze_logo_compliance(
		self,
		document_content: dict[str, Any],
		applied_formatting: dict[str, Any]
	) -> dict[str, Any]:
		"""Analyze logo compliance"""
		logo_analysis = {
			'score': 0.9,  # Placeholder
			'violations': [],
			'placements_analyzed': 0
		}
		
		# Look for logo placements in applied formatting
		logo_placements = applied_formatting.get('logo_placements', [])
		logo_analysis['placements_analyzed'] = len(logo_placements)
		
		# Check each logo placement
		for placement in logo_placements:
			if not placement.get('clear_space_satisfied', True):
				logo_analysis['violations'].append({
					'type': 'logo',
					'severity': 'warning',
					'description': 'Logo clear space requirements not met',
					'location': placement.get('placement_context', 'unknown')
				})
				logo_analysis['score'] -= 0.1
		
		logo_analysis['score'] = max(0.0, logo_analysis['score'])
		return logo_analysis
	
	async def _analyze_color_compliance(
		self,
		document_content: dict[str, Any],
		applied_formatting: dict[str, Any]
	) -> dict[str, Any]:
		"""Analyze color compliance"""
		color_analysis = {
			'score': 0.85,  # Placeholder
			'violations': [],
			'colors_analyzed': 0
		}
		
		# Simplified color compliance check
		brand_colors = set(self.brand_spec.color_system.color_palette.values())
		brand_colors.add(self.brand_spec.color_system.primary_color)
		brand_colors.add(self.brand_spec.color_system.secondary_color)
		
		# Check applied colors (simplified)
		applied_colors = applied_formatting.get('colors_used', [])
		color_analysis['colors_analyzed'] = len(applied_colors)
		
		for color in applied_colors:
			if color not in brand_colors:
				color_analysis['violations'].append({
					'type': 'color',
					'severity': 'warning',
					'description': f'Non-brand color used: {color}',
					'current_value': color,
					'expected_value': 'Use approved brand colors'
				})
				color_analysis['score'] -= 0.05
		
		color_analysis['score'] = max(0.0, color_analysis['score'])
		return color_analysis
	
	async def _analyze_typography_compliance(
		self,
		document_content: dict[str, Any],
		applied_formatting: dict[str, Any]
	) -> dict[str, Any]:
		"""Analyze typography compliance"""
		typography_analysis = {
			'score': 0.9,  # Placeholder
			'violations': [],
			'elements_analyzed': 0
		}
		
		# Check typography usage (simplified)
		brand_fonts = {
			self.brand_spec.typography_system.primary_font,
			self.brand_spec.typography_system.heading_font,
			self.brand_spec.typography_system.code_font
		}
		
		# Analyze text elements
		text_elements = applied_formatting.get('text_elements', [])
		typography_analysis['elements_analyzed'] = len(text_elements)
		
		for element in text_elements:
			font_family = element.get('font_family', '')
			if font_family and not any(brand_font in font_family for brand_font in brand_fonts):
				typography_analysis['violations'].append({
					'type': 'typography',
					'severity': 'warning',
					'description': f'Non-brand font used: {font_family}',
					'current_value': font_family,
					'expected_value': 'Use approved brand fonts'
				})
				typography_analysis['score'] -= 0.05
		
		typography_analysis['score'] = max(0.0, typography_analysis['score'])
		return typography_analysis
	
	def _create_brand_violation(self, violation_data: dict[str, Any]) -> BrandViolation:
		"""Create BrandViolation object from violation data"""
		# Find matching rule (simplified)
		matching_rule = None
		for rule in self.brand_spec.brand_rules:
			if rule.rule_category == violation_data.get('type'):
				matching_rule = rule
				break
		
		if not matching_rule:
			# Create a default rule
			matching_rule = BrandRule(
				rule_name=f"default_{violation_data.get('type', 'unknown')}_rule",
				rule_category=violation_data.get('type', 'unknown'),
				rule_type="requirement",
				rule_description=violation_data.get('description', 'Brand compliance violation')
			)
		
		return BrandViolation(
			rule_violated=matching_rule,
			violation_type=violation_data.get('type', 'unknown'),
			severity=violation_data.get('severity', 'warning'),
			description=violation_data.get('description', ''),
			location=violation_data.get('location', ''),
			current_value=violation_data.get('current_value', ''),
			expected_value=violation_data.get('expected_value', ''),
			auto_correctable=matching_rule.auto_correction,
			correction_suggestion=matching_rule.correction_suggestion
		)
	
	def _count_violations_by_severity(self, violations: list[BrandViolation]) -> dict[str, int]:
		"""Count violations by severity"""
		counts = {'error': 0, 'warning': 0, 'suggestion': 0}
		for violation in violations:
			counts[violation.severity] = counts.get(violation.severity, 0) + 1
		return counts
	
	def _count_violations_by_category(self, violations: list[BrandViolation]) -> dict[str, int]:
		"""Count violations by category"""
		counts = {}
		for violation in violations:
			counts[violation.violation_type] = counts.get(violation.violation_type, 0) + 1
		return counts
	
	def _generate_priority_recommendations(self, compliance_report: BrandComplianceReport) -> list[str]:
		"""Generate priority recommendations based on compliance analysis"""
		recommendations = []
		
		if compliance_report.logo_compliance_score < 0.8:
			recommendations.append("Review logo placement and clear space requirements")
		
		if compliance_report.color_compliance_score < 0.8:
			recommendations.append("Ensure all colors conform to brand guidelines")
		
		if compliance_report.typography_compliance_score < 0.8:
			recommendations.append("Update typography to use approved brand fonts")
		
		if compliance_report.overall_compliance_score < 0.7:
			recommendations.append("Comprehensive brand review recommended")
		
		return recommendations
	
	def _generate_quick_fixes(self, compliance_report: BrandComplianceReport) -> list[str]:
		"""Generate quick fix suggestions"""
		quick_fixes = []
		
		auto_correctable = [v for v in compliance_report.detailed_violations if v.auto_correctable]
		
		if auto_correctable:
			quick_fixes.append(f"Apply automatic corrections for {len(auto_correctable)} violations")
		
		color_violations = [v for v in compliance_report.detailed_violations if v.violation_type == 'color']
		if color_violations:
			quick_fixes.append("Replace non-brand colors with approved brand colors")
		
		return quick_fixes
	
	async def _check_element_compliance(self, element: dict[str, Any]) -> list[dict[str, Any]]:
		"""Check individual element compliance"""
		violations = []
		
		# Check color compliance
		if 'color' in element:
			color = element['color']
			brand_colors = {
				self.brand_spec.color_system.primary_color,
				self.brand_spec.color_system.secondary_color,
				self.brand_spec.color_system.accent_color
			}
			
			if color not in brand_colors:
				violations.append({
					'type': 'color',
					'severity': 'warning',
					'description': f'Non-brand color: {color}',
					'correctable': True
				})
		
		# Check typography compliance
		if 'font_family' in element:
			font = element['font_family']
			brand_fonts = {
				self.brand_spec.typography_system.primary_font,
				self.brand_spec.typography_system.heading_font
			}
			
			if not any(brand_font in font for brand_font in brand_fonts):
				violations.append({
					'type': 'typography',
					'severity': 'warning',
					'description': f'Non-brand font: {font}',
					'correctable': True
				})
		
		return violations
	
	async def _apply_auto_corrections(self, element: dict[str, Any], violations: list[dict[str, Any]]) -> list[dict[str, Any]]:
		"""Apply automatic corrections to element"""
		corrections = []
		
		for violation in violations:
			if not violation.get('correctable', False):
				continue
			
			if violation['type'] == 'color':
				# Replace with primary brand color
				old_color = element.get('color', 'unknown')
				element['color'] = self.brand_spec.color_system.primary_color
				corrections.append({
					'type': 'color_correction',
					'old_value': old_color,
					'new_value': element['color']
				})
			
			elif violation['type'] == 'typography':
				# Replace with primary brand font
				old_font = element.get('font_family', 'unknown')
				element['font_family'] = self.brand_spec.typography_system.primary_font
				corrections.append({
					'type': 'font_correction',
					'old_value': old_font,
					'new_value': element['font_family']
				})
		
		return corrections

class DocumentTypeClassifier:
	"""AI-powered document type recognition and brand template selection"""
	
	def __init__(self):
		self.classification_cache = {}
		
		# Document type indicators
		self.type_indicators = {
			'proposal': {
				'keywords': ['proposal', 'budget', 'timeline', 'deliverables', 'scope'],
				'structure': ['executive_summary', 'project_description', 'budget'],
				'length_range': (5, 50)  # pages
			},
			'report': {
				'keywords': ['analysis', 'findings', 'conclusions', 'methodology'],
				'structure': ['abstract', 'introduction', 'methodology', 'results'],
				'length_range': (10, 100)
			},
			'presentation': {
				'keywords': ['slides', 'agenda', 'overview', 'next_steps'],
				'structure': ['title_slide', 'agenda', 'content_slides'],
				'length_range': (5, 30)
			},
			'memo': {
				'keywords': ['memo', 'memorandum', 'notice', 'update'],
				'structure': ['header', 'body', 'action_items'],
				'length_range': (1, 5)
			}
		}
	
	async def classify_document_type(
		self,
		document_content: dict[str, Any],
		metadata_hints: dict[str, Any] = None
	) -> DocumentTypeClassification:
		"""Classify document type using multi-modal analysis"""
		if metadata_hints is None:
			metadata_hints = {}
		
		# Extract content for analysis
		text_content = self._extract_text_content(document_content)
		structure_info = self._analyze_document_structure(document_content)
		
		# Calculate type scores
		type_scores = {}
		
		for doc_type, indicators in self.type_indicators.items():
			score = 0.0
			
			# Text analysis score
			text_score = self._calculate_text_score(text_content, indicators['keywords'])
			score += text_score * 0.4
			
			# Structure analysis score
			structure_score = self._calculate_structure_score(structure_info, indicators['structure'])
			score += structure_score * 0.4
			
			# Length analysis score
			length_score = self._calculate_length_score(document_content, indicators['length_range'])
			score += length_score * 0.2
			
			type_scores[doc_type] = score
		
		# Determine best classification
		best_type = max(type_scores, key=type_scores.get)
		best_score = type_scores[best_type]
		
		# Create alternative types list
		sorted_types = sorted(type_scores.items(), key=lambda x: x[1], reverse=True)
		alternatives = [(doc_type, score) for doc_type, score in sorted_types[1:4]]
		
		classification = DocumentTypeClassification(
			document_type=best_type,
			confidence_score=best_score,
			alternative_types=alternatives,
			content_indicators={'text_analysis': text_score},
			structure_indicators={'structure_match': structure_score},
			recommended_template=f"{best_type}_template_v1",
			template_confidence=best_score * 0.9
		)
		
		return classification
	
	def select_brand_template(
		self,
		document_type: str,
		content_characteristics: dict[str, Any],
		brand_specification: BrandSpecification
	) -> dict[str, Any]:
		"""Select optimal brand template for document type"""
		# Check if brand specification has templates for this document type
		if document_type in brand_specification.document_templates:
			return brand_specification.document_templates[document_type]
		
		# Return default template configuration
		default_template = {
			'template_id': f"{document_type}_default",
			'logo_configuration': {
				'primary_placement': 'header',
				'secondary_placement': 'footer'
			},
			'typography_hierarchy': {
				'heading_levels': ['h1', 'h2', 'h3'],
				'body_styles': ['normal', 'emphasis']
			},
			'color_scheme': 'primary_brand',
			'layout_style': 'professional'
		}
		
		return default_template
	
	def _extract_text_content(self, document_content: dict[str, Any]) -> str:
		"""Extract text content for analysis"""
		text_parts = []
		
		# Extract from title
		if 'title' in document_content:
			text_parts.append(document_content['title'])
		
		# Extract from content elements
		if 'content_elements' in document_content:
			for element in document_content['content_elements']:
				if element.get('type') in ['text', 'heading'] and 'content' in element:
					text_parts.append(element['content'])
		
		return ' '.join(text_parts).lower()
	
	def _analyze_document_structure(self, document_content: dict[str, Any]) -> dict[str, Any]:
		"""Analyze document structure"""
		structure_info = {
			'has_title': 'title' in document_content,
			'section_count': 0,
			'heading_levels': set(),
			'content_types': set()
		}
		
		if 'content_elements' in document_content:
			for element in document_content['content_elements']:
				element_type = element.get('type', '')
				structure_info['content_types'].add(element_type)
				
				if element_type.startswith('heading'):
					structure_info['heading_levels'].add(element_type)
					structure_info['section_count'] += 1
		
		return structure_info
	
	def _calculate_text_score(self, text_content: str, keywords: list[str]) -> float:
		"""Calculate text analysis score based on keyword matching"""
		if not text_content:
			return 0.0
		
		keyword_matches = sum(1 for keyword in keywords if keyword in text_content)
		return min(1.0, keyword_matches / len(keywords))
	
	def _calculate_structure_score(self, structure_info: dict[str, Any], expected_structure: list[str]) -> float:
		"""Calculate structure analysis score"""
		structure_indicators = 0
		
		# Check for expected structural elements
		if structure_info['has_title']:
			structure_indicators += 1
		
		if structure_info['section_count'] >= 3:
			structure_indicators += 1
		
		if len(structure_info['heading_levels']) >= 2:
			structure_indicators += 1
		
		# Normalize score
		return min(1.0, structure_indicators / 3)
	
	def _calculate_length_score(self, document_content: dict[str, Any], length_range: tuple[int, int]) -> float:
		"""Calculate length-based score"""
		# Estimate document length based on content elements
		estimated_length = len(document_content.get('content_elements', []))
		
		min_length, max_length = length_range
		
		if min_length <= estimated_length <= max_length:
			return 1.0
		elif estimated_length < min_length:
			return max(0.0, estimated_length / min_length)
		else:
			return max(0.0, max_length / estimated_length)

# ============================================================================
# Main BrandFormatter Class
# ============================================================================

class BrandFormatter:
	"""Main brand formatting orchestration engine"""
	
	def __init__(
		self,
		brand_specification: BrandSpecification,
		logo_manager: LogoManager | None = None,
		enforcement_engine: BrandEnforcementEngine | None = None,
		type_classifier: DocumentTypeClassifier | None = None
	):
		self.brand_spec = brand_specification
		self.logo_manager = logo_manager or LogoManager(brand_specification.logo_assets)
		self.enforcement_engine = enforcement_engine or BrandEnforcementEngine(brand_specification)
		self.type_classifier = type_classifier or DocumentTypeClassifier()
		
		# Performance optimization
		self.brand_cache = {}
		self.template_cache = {}
		
		# Quality metrics
		self.metrics = {
			'documents_processed': 0,
			'brand_violations_detected': 0,
			'auto_corrections_applied': 0,
			'compliance_score_average': 0.0,
			'total_processing_time': 0.0
		}
	
	async def apply_brand_formatting(
		self,
		document_content: dict[str, Any],
		formatting_context: dict[str, Any],
		output_formats: list[str]
	) -> BrandFormattingResult:
		"""Apply comprehensive brand formatting to document"""
		assert document_content is not None, "Document content cannot be None"
		assert output_formats, "At least one output format must be specified"
		
		start_time = datetime.now()
		
		# Initialize result
		result = BrandFormattingResult(
			document_id=document_content.get('id', 'unknown'),
			processing_timestamp=start_time
		)
		
		try:
			# 1. Classify document type
			result.document_classification = await self.type_classifier.classify_document_type(
				document_content,
				formatting_context.get('metadata_hints', {})
			)
			
			# 2. Select and customize brand template
			brand_template = self.type_classifier.select_brand_template(
				result.document_classification.document_type,
				formatting_context.get('content_characteristics', {}),
				self.brand_spec
			)
			
			# 3. Apply logo placements
			result.logo_placements = await self._apply_logo_placements(
				document_content,
				brand_template,
				formatting_context
			)
			
			# 4. Analyze brand compliance
			applied_formatting = {
				'logo_placements': [placement.__dict__ for placement in result.logo_placements],
				'colors_used': formatting_context.get('colors_used', []),
				'text_elements': formatting_context.get('text_elements', [])
			}
			
			result.brand_compliance_report = await self.enforcement_engine.analyze_brand_compliance(
				document_content,
				applied_formatting
			)
			
			# 5. Apply brand enforcement
			content_elements = document_content.get('content_elements', [])
			enforcement_result = await self.enforcement_engine.enforce_brand_guidelines(
				content_elements,
				formatting_context.get('enforcement_level', 'moderate')
			)
			
			result.auto_corrections_applied = enforcement_result.get('corrected_elements', [])
			
			# 6. Generate format-specific outputs
			format_outputs = self._generate_brand_outputs(result, output_formats)
			result.latex_brand_output = format_outputs.get('latex', '')
			result.css_brand_output = format_outputs.get('css', '')
			result.html_brand_output = format_outputs.get('html', '')
			
			# 7. Calculate quality metrics
			result.formatting_quality_score = self._calculate_formatting_quality(result)
			result.brand_consistency_score = result.brand_compliance_report.overall_compliance_score
			result.accessibility_compliance_score = 0.9  # Placeholder
			
			# Update metrics
			self._update_metrics(result)
			
		except Exception as e:
			result.formatting_successful = False
			result.validation_errors.append(f"Brand formatting error: {str(e)}")
		
		# Performance metrics
		result.total_processing_time = (datetime.now() - start_time).total_seconds()
		result.cache_hit_rate = self._calculate_cache_hit_rate()
		result.optimization_efficiency = 0.85  # Placeholder
		
		return result
	
	async def generate_branded_template(
		self,
		document_type: str,
		customization_requirements: dict[str, Any] = None
	) -> dict[str, Any]:
		"""Generate branded document template for specific type"""
		if customization_requirements is None:
			customization_requirements = {}
		
		cache_key = f"{document_type}_{hash(str(customization_requirements))}"
		
		if cache_key in self.template_cache:
			return self.template_cache[cache_key]
		
		# Base template
		base_template = self.type_classifier.select_brand_template(
			document_type,
			customization_requirements,
			self.brand_spec
		)
		
		# Apply customizations
		customized_template = self._apply_template_customizations(base_template, customization_requirements)
		
		# Generate brand-specific styling
		brand_styling = self._generate_template_brand_styling(customized_template)
		customized_template['brand_styling'] = brand_styling
		
		# Cache result
		self.template_cache[cache_key] = customized_template
		
		return customized_template
	
	async def get_brand_formatter_metrics(self) -> BrandFormatterMetrics:
		"""Get comprehensive brand formatter metrics"""
		cache_hit_rate = self._calculate_cache_hit_rate()
		
		return BrandFormatterMetrics(
			documents_processed=self.metrics['documents_processed'],
			total_processing_time=self.metrics['total_processing_time'],
			average_processing_time=self.metrics['total_processing_time'] / max(1, self.metrics['documents_processed']),
			average_compliance_score=self.metrics['compliance_score_average'],
			total_violations_detected=self.metrics['brand_violations_detected'],
			auto_corrections_applied=self.metrics['auto_corrections_applied'],
			compliance_improvement_rate=0.15,  # Placeholder
			logos_placed=sum(len(result.get('logo_placements', [])) for result in self.brand_cache.values()),
			logo_placement_success_rate=0.95,  # Placeholder
			logo_optimization_efficiency=0.88,  # Placeholder
			cache_hit_rate=cache_hit_rate,
			memory_usage=self._estimate_memory_usage(),
			processing_efficiency=0.82,  # Placeholder
			formatting_success_rate=0.96,  # Placeholder
			user_satisfaction_score=0.89,  # Placeholder
			brand_consistency_improvement=0.25  # Placeholder
		)
	
	async def _apply_logo_placements(
		self,
		document_content: dict[str, Any],
		brand_template: dict[str, Any],
		formatting_context: dict[str, Any]
	) -> list[LogoPlacement]:
		"""Apply logo placements based on template and context.

		A brand template may declare placement intents (``primary_placement``,
		``secondary_placement``) regardless of whether the caller's
		``brand_specification`` actually ships logo assets. When the
		corresponding logo variant is missing from the asset library we
		skip the placement and log it, instead of letting LogoManager's
		assertion abort the whole brand-formatting phase.

		The caller still sees ``BrandFormattingResult.logo_placements``
		shrink to only the placements we could actually produce. The
		quality aggregator already weights compliance and classification
		alongside logo quality, so skipping a logo gracefully degrades the
		score rather than failing the phase outright.
		"""
		placements = []
		available_variants = self.logo_manager.asset_library.logo_variants

		logo_config = brand_template.get('logo_configuration', {})

		def _place_if_available(variant_name: str, placement_context: str) -> None:
			if variant_name not in available_variants:
				logger.info(
					f"Skipping {placement_context} logo placement: "
					f"variant '{variant_name}' not configured in asset_library."
				)
				return
			placement = self.logo_manager.place_logo(
				variant_name,
				placement_context,
				formatting_context.get('layout_constraints', {})
			)
			placements.append(placement)

		if 'primary_placement' in logo_config:
			_place_if_available('primary', logo_config['primary_placement'])

		if 'secondary_placement' in logo_config:
			_place_if_available('icon', logo_config['secondary_placement'])

		return placements
	
	def _generate_brand_outputs(
		self,
		formatting_result: BrandFormattingResult,
		output_formats: list[str]
	) -> dict[str, str]:
		"""Generate format-specific brand outputs"""
		outputs = {}
		
		for format_name in output_formats:
			if format_name == 'latex':
				outputs['latex'] = self._generate_latex_brand_output(formatting_result)
			elif format_name == 'css':
				outputs['css'] = self._generate_css_brand_output(formatting_result)
			elif format_name == 'html':
				outputs['html'] = self._generate_html_brand_output(formatting_result)
		
		return outputs
	
	def _generate_latex_brand_output(self, formatting_result: BrandFormattingResult) -> str:
		"""Generate LaTeX brand formatting output"""
		latex_parts = []
		
		# Add brand color definitions
		latex_parts.append("% Brand Colors")
		latex_parts.append("\\RequirePackage{xcolor}")
		color_system = getattr(self.brand_spec, 'color_system', None)
		primary_color = getattr(color_system, 'primary_color', '#000000') if color_system else '#000000'
		secondary_color = getattr(color_system, 'secondary_color', '#666666') if color_system else '#666666'
		latex_parts.append(f"\\definecolor{{brandprimary}}{{HTML}}{{{primary_color[1:]}}}")
		latex_parts.append(f"\\definecolor{{brandsecondary}}{{HTML}}{{{secondary_color[1:]}}}")
		
		# Add logo placements
		latex_parts.append("% Logo Placements")
		for placement in formatting_result.logo_placements:
			if getattr(placement, 'latex_placement', None):
				latex_parts.append(placement.latex_placement)
		
		# Add brand typography (pdflatex-safe by default)
		latex_parts.append("% Brand Typography")
		latex_parts.append("\\usepackage[T1]{fontenc}")
		latex_parts.append("\\usepackage{lmodern}")
		typography_system = getattr(self.brand_spec, 'typography_system', None)
		primary_font = getattr(typography_system, 'primary_font', '') if typography_system else ''
		if primary_font:
			latex_parts.append(f"\\renewcommand{{\\rmdefault}}{{{primary_font}}}")
		
		return '\n'.join(latex_parts)
	
	def _generate_css_brand_output(self, formatting_result: BrandFormattingResult) -> str:
		"""Generate CSS brand formatting output"""
		css_parts = []
		
		# Add brand color variables
		css_parts.append("/* Brand Colors */")
		css_parts.append(":root {")
		css_parts.append(f"  --brand-primary: {self.brand_spec.color_system.primary_color};")
		css_parts.append(f"  --brand-secondary: {self.brand_spec.color_system.secondary_color};")
		css_parts.append(f"  --brand-accent: {self.brand_spec.color_system.accent_color};")
		css_parts.append("}")
		
		# Add logo styles
		css_parts.append("/* Logo Styles */")
		for placement in formatting_result.logo_placements:
			if placement.css_placement:
				css_parts.append(placement.css_placement)
		
		# Add brand typography
		css_parts.append("/* Brand Typography */")
		css_parts.append(f"body {{ font-family: '{self.brand_spec.typography_system.primary_font}', sans-serif; }}")
		css_parts.append(f"h1, h2, h3, h4, h5, h6 {{ font-family: '{self.brand_spec.typography_system.heading_font}', sans-serif; }}")
		
		return '\n'.join(css_parts)
	
	def _generate_html_brand_output(self, formatting_result: BrandFormattingResult) -> str:
		"""Generate HTML brand formatting output"""
		html_parts = []
		
		# Add brand container
		html_parts.append('<div class="brand-container">')
		
		# Add logo elements
		for placement in formatting_result.logo_placements:
			if placement.html_placement:
				html_parts.append(f'  {placement.html_placement}')
		
		html_parts.append('</div>')
		
		return '\n'.join(html_parts)
	
	def _calculate_formatting_quality(self, formatting_result: BrandFormattingResult) -> float:
		"""Calculate overall formatting quality score"""
		# Base quality score
		quality_score = 0.8
		
		# Logo placement quality
		if formatting_result.logo_placements:
			logo_quality = sum(p.placement_quality_score for p in formatting_result.logo_placements)
			logo_quality /= len(formatting_result.logo_placements)
			quality_score = (quality_score + logo_quality) / 2
		
		# Brand compliance quality
		compliance_score = formatting_result.brand_compliance_report.overall_compliance_score
		quality_score = (quality_score + compliance_score) / 2
		
		# Document type classification confidence
		classification_confidence = formatting_result.document_classification.confidence_score
		quality_score = (quality_score + classification_confidence) / 2
		
		return max(0.0, min(1.0, quality_score))
	
	def _apply_template_customizations(
		self,
		base_template: dict[str, Any],
		customizations: dict[str, Any]
	) -> dict[str, Any]:
		"""Apply customizations to base template"""
		customized_template = base_template.copy()
		
		# Apply customizations
		for key, value in customizations.items():
			if key in customized_template:
				if isinstance(customized_template[key], dict) and isinstance(value, dict):
					customized_template[key].update(value)
				else:
					customized_template[key] = value
			else:
				customized_template[key] = value
		
		return customized_template
	
	def _generate_template_brand_styling(self, template: dict[str, Any]) -> dict[str, Any]:
		"""Generate brand-specific styling for template"""
		brand_styling = {
			'colors': {
				'primary': self.brand_spec.color_system.primary_color,
				'secondary': self.brand_spec.color_system.secondary_color,
				'accent': self.brand_spec.color_system.accent_color
			},
			'typography': {
				'primary_font': self.brand_spec.typography_system.primary_font,
				'heading_font': self.brand_spec.typography_system.heading_font,
				'code_font': self.brand_spec.typography_system.code_font
			},
			'spacing': {
				'base_unit': self.brand_spec.spacing_system.base_unit,
				'section_spacing': self.brand_spec.spacing_system.section_spacing
			}
		}
		
		return brand_styling
	
	def _update_metrics(self, formatting_result: BrandFormattingResult) -> None:
		"""Update internal metrics based on formatting result"""
		self.metrics['documents_processed'] += 1
		self.metrics['total_processing_time'] += formatting_result.total_processing_time
		
		# Update compliance score average
		current_avg = self.metrics['compliance_score_average']
		new_score = formatting_result.brand_compliance_report.overall_compliance_score
		doc_count = self.metrics['documents_processed']
		self.metrics['compliance_score_average'] = (current_avg * (doc_count - 1) + new_score) / doc_count
		
		# Update violation counts
		self.metrics['brand_violations_detected'] += formatting_result.brand_compliance_report.total_violations
		self.metrics['auto_corrections_applied'] += len(formatting_result.auto_corrections_applied)
	
	def _calculate_cache_hit_rate(self) -> float:
		"""Calculate cache hit rate"""
		total_requests = max(1, len(self.brand_cache) + len(self.template_cache))
		cache_hits = len(self.brand_cache) + len(self.template_cache)
		return cache_hits / total_requests if total_requests > 0 else 0.0
	
	def _estimate_memory_usage(self) -> float:
		"""Estimate memory usage in MB"""
		base_usage = 15.0  # Base brand formatter overhead
		cache_usage = (len(self.brand_cache) + len(self.template_cache)) * 0.5  # ~500KB per cache entry
		asset_usage = len(self.brand_spec.logo_assets.logo_variants) * 2.0  # ~2MB per logo asset
		
		return base_usage + cache_usage + asset_usage

# ============================================================================
# Utility Functions
# ============================================================================

def create_default_brand_specification(brand_name: str) -> BrandSpecification:
	"""Create default brand specification with professional defaults"""
	# Create default logo asset
	default_logo = LogoAsset(
		asset_name=f"{brand_name} Logo",
		variant_type="primary",
		file_path=f"assets/logos/{brand_name.lower()}_logo.svg",
		file_format="svg",
		usage_contexts=["header", "footer", "cover"],
		document_types=["proposal", "report", "presentation", "memo"]
	)
	
	# Create logo asset library
	logo_library = LogoAssetLibrary(
		primary_logo=default_logo,
		logo_variants={
			"primary": default_logo,
			"icon": LogoAsset(
				asset_name=f"{brand_name} Icon",
				variant_type="icon",
				file_path=f"assets/logos/{brand_name.lower()}_icon.svg",
				min_size="16px",
				max_size="64px"
			)
		}
	)
	
	# Create brand specification
	brand_spec = BrandSpecification(
		brand_name=brand_name,
		logo_assets=logo_library,
		color_system=BrandColorSystem(),
		typography_system=BrandTypographySystem(),
		spacing_system=BrandSpacingSystem()
	)
	
	return brand_spec

def create_logo_asset_from_file(
	file_path: str,
	asset_name: str,
	variant_type: str = "primary"
) -> LogoAsset:
	"""Create logo asset from file path with automatic format detection"""
	file_path_obj = Path(file_path)
	
	if not file_path_obj.exists():
		raise BrandAssetException(f"Logo file not found: {file_path}")
	
	# Detect file format
	file_format = file_path_obj.suffix.lower().lstrip('.')
	if file_format not in {'svg', 'png', 'pdf', 'eps', 'jpg', 'jpeg'}:
		raise BrandAssetException(f"Unsupported logo format: {file_format}")
	
	# Get file size
	file_size = file_path_obj.stat().st_size
	
	# Create logo asset
	logo_asset = LogoAsset(
		asset_name=asset_name,
		variant_type=variant_type,
		file_path=str(file_path),
		file_format=file_format,
		file_size=file_size,
		usage_contexts=["header", "footer", "cover"],
		document_types=["proposal", "report", "presentation"]
	)
	
	return logo_asset

async def quick_brand_formatting(
	document_content: dict[str, Any],
	brand_name: str,
	output_formats: list[str] = None
) -> BrandFormattingResult:
	"""Quick brand formatting with default brand specification"""
	if output_formats is None:
		output_formats = ['latex', 'css', 'html']
	
	# Create default brand specification
	brand_spec = create_default_brand_specification(brand_name)
	
	# Create brand formatter
	formatter = BrandFormatter(brand_spec)
	
	# Apply brand formatting
	formatting_context = {
		'enforcement_level': 'moderate',
		'layout_constraints': {},
		'metadata_hints': {}
	}
	
	result = await formatter.apply_brand_formatting(
		document_content,
		formatting_context,
		output_formats
	)
	
	return result

def validate_brand_formatter_installation() -> dict[str, bool]:
	"""Validate BrandFormatter installation and dependencies"""
	validation_results = {}
	
	try:
		# Test basic functionality
		brand_spec = create_default_brand_specification("Test Brand")
		validation_results['brand_specification_creation'] = True
		
		# Test logo manager
		logo_manager = LogoManager(brand_spec.logo_assets)
		validation_results['logo_manager'] = logo_manager is not None
		
		# Test enforcement engine
		enforcement_engine = BrandEnforcementEngine(brand_spec)
		validation_results['enforcement_engine'] = enforcement_engine is not None
		
		# Test document classifier
		classifier = DocumentTypeClassifier()
		validation_results['document_classifier'] = classifier is not None
		
		# Test main formatter
		formatter = BrandFormatter(brand_spec)
		validation_results['brand_formatter'] = formatter is not None
		
		validation_results['overall_status'] = all(validation_results.values())
		
	except Exception as e:
		validation_results['error'] = str(e)
		validation_results['overall_status'] = False
	
	return validation_results

# Rebuild dataclasses to ensure proper initialization
rebuild_dataclass(LogoDimensions)
rebuild_dataclass(LogoAsset)
rebuild_dataclass(LogoAssetLibrary)
rebuild_dataclass(BrandRule)
rebuild_dataclass(BrandColorSystem)
rebuild_dataclass(BrandTypographySystem)
rebuild_dataclass(BrandSpacingSystem)
rebuild_dataclass(LogoPlacementRules)
rebuild_dataclass(ComplianceThresholds)
rebuild_dataclass(BrandSpecification)
rebuild_dataclass(LogoPlacement)
rebuild_dataclass(BrandViolation)
rebuild_dataclass(BrandComplianceReport)
rebuild_dataclass(DocumentTypeClassification)
rebuild_dataclass(BrandFormattingResult)
rebuild_dataclass(BrandFormatterMetrics)

# Module exports
__all__ = [
	# Main classes
	'BrandFormatter',
	'LogoManager',
	'BrandEnforcementEngine',
	'DocumentTypeClassifier',
	
	# Data models
	'BrandSpecification',
	'LogoAsset',
	'LogoAssetLibrary',
	'BrandRule',
	'BrandColorSystem',
	'BrandTypographySystem',
	'BrandSpacingSystem',
	'LogoPlacementRules',
	'ComplianceThresholds',
	'LogoDimensions',
	
	# Result classes
	'LogoPlacement',
	'BrandViolation',
	'BrandComplianceReport',
	'DocumentTypeClassification',
	'BrandFormattingResult',
	'BrandFormatterMetrics',
	
	# Exceptions
	'BrandFormatterException',
	'LogoManagementException',
	'BrandComplianceException',
	'DocumentTypeClassificationException',
	'BrandAssetException',
	
	# Utility functions
	'create_default_brand_specification',
	'create_logo_asset_from_file',
	'quick_brand_formatting',
	'validate_brand_formatter_installation'
]
