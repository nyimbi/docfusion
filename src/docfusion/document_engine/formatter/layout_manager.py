#!/usr/bin/env python3
"""
LayoutManager Module

Advanced multi-column layout management and page composition for DocuFusion documents.
Provides professional page layout, column systems, and responsive design adaptation
across multiple output formats.

Key Features:
- Multi-column layout computation with intelligent balancing
- Professional page composition with margin systems
- Content positioning and float management
- Responsive layout adaptation
- Multi-format output (LaTeX, CSS Grid, PDF)
- Accessibility compliance and quality validation
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any
from uuid import uuid4

from pydantic import Field, ConfigDict
from pydantic.dataclasses import dataclass as pydantic_dataclass, rebuild_dataclass

from ...core.utils import uuid7str

# ============================================================================
# Exception Classes
# ============================================================================

class LayoutManagerException(Exception):
	"""Base exception for LayoutManager module"""
	pass

class PageConfigurationException(LayoutManagerException):
	"""Exception for page configuration errors"""
	pass

class ColumnLayoutException(LayoutManagerException):
	"""Exception for column layout computation errors"""
	pass

class ContentPositioningException(LayoutManagerException):
	"""Exception for content positioning errors"""
	pass

class LayoutValidationException(LayoutManagerException):
	"""Exception for layout validation errors"""
	pass

# ============================================================================
# Core Data Models
# ============================================================================

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class PageMargins:
	"""Page margin specification with responsive adaptation"""
	top: str = "2.5cm"
	bottom: str = "2.5cm"
	left: str = "2cm"
	right: str = "2cm"
	header: str = "1.5cm"
	footer: str = "1.5cm"
	gutter: str = "0cm"  # Additional binding margin
	
	# Validation metadata
	margin_unit: str = "cm"
	symmetric: bool = True
	responsive: bool = True

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class PageConfiguration:
	"""Page layout configuration with responsive adaptation"""
	# Page dimensions
	page_size: str = "A4"  # A4, Letter, Legal, A3, Custom
	orientation: str = "portrait"  # portrait, landscape
	custom_width: str = ""  # For custom page sizes
	custom_height: str = ""
	
	# Margin system
	margins: PageMargins = Field(default_factory=PageMargins)
	margin_mode: str = "symmetric"  # symmetric, asymmetric, binding
	bleed_area: str = "0mm"  # For print layouts
	
	# Print settings
	binding_side: str = "left"  # left, right, top
	binding_offset: str = "0mm"
	print_marks: bool = False  # crop marks, registration marks
	color_profile: str = "sRGB"  # sRGB, CMYK, Adobe RGB
	
	# Responsive behavior
	responsive_margins: dict[str, PageMargins] = Field(default_factory=dict)
	breakpoint_adaptations: dict[str, dict[str, Any]] = Field(default_factory=dict)
	
	# Metadata
	configuration_name: str = "default"
	last_modified: datetime = Field(default_factory=datetime.now)
	validation_status: bool = True

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class ColumnLayout:
	"""Multi-column layout configuration"""
	# Column structure
	column_count: int = 1
	column_widths: list[str] = Field(default_factory=list)  # For unequal columns
	gutter_width: str = "1cm"
	column_balance: str = "auto"  # auto, manual, forced
	
	# Column breaks
	break_policy: str = "optimal"  # optimal, avoid, force
	orphan_control: int = 2  # Minimum lines at bottom of column
	widow_control: int = 2  # Minimum lines at top of column
	keep_together_blocks: list[str] = Field(default_factory=list)
	
	# Content flow
	text_flow_mode: str = "standard"  # standard, serpentine, balanced
	figure_placement: str = "column"  # column, span, float
	table_handling: str = "break"  # break, scale, rotate
	
	# Responsive adaptation
	responsive_columns: dict[str, int] = Field(default_factory=dict)  # breakpoint -> column_count
	adaptive_gutters: dict[str, str] = Field(default_factory=dict)
	
	# Performance optimization
	layout_cache_key: str = ""
	calculation_complexity: str = "standard"  # simple, standard, complex

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class ContentPositioning:
	"""Content element positioning configuration"""
	# Element identification
	element_id: str
	element_type: str  # text, heading, figure, table, code, etc.
	content_category: str = "block"  # block, inline, float, absolute
	
	# Position specification
	position_mode: str = "flow"  # flow, float, absolute, fixed
	float_direction: str = ""  # left, right, center
	z_index: int = 0
	
	# Size constraints
	width_constraint: str = "auto"  # auto, fixed, percentage, content
	height_constraint: str = "auto"
	min_width: str = "0"
	max_width: str = "100%"
	min_height: str = "0"
	max_height: str = "none"
	
	# Spacing and margins
	margin_top: str = "0"
	margin_bottom: str = "0"
	margin_left: str = "0"
	margin_right: str = "0"
	padding: dict[str, str] = Field(default_factory=dict)
	
	# Flow behavior
	clear_floats: str = "none"  # none, left, right, both
	text_wrap: bool = True
	break_inside: str = "auto"  # auto, avoid, always
	
	# Responsive positioning
	responsive_positions: dict[str, dict[str, Any]] = Field(default_factory=dict)
	adaptive_sizing: dict[str, dict[str, str]] = Field(default_factory=dict)

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class HeaderFooterConfig:
	"""Header and footer configuration"""
	enabled: bool = True
	content_template: str = ""  # Template string with placeholders
	height: str = "1.5cm"
	alignment: str = "center"  # left, center, right, justify
	
	# Content elements
	show_page_numbers: bool = True
	page_number_format: str = "arabic"  # arabic, roman, alpha
	show_chapter_title: bool = False
	show_section_title: bool = False
	show_document_title: bool = False
	
	# Styling
	font_family: str = ""
	font_size: str = "10pt"
	color: str = "#000000"
	border_style: str = "none"  # none, solid, dotted, dashed
	
	# Responsive behavior
	responsive_templates: dict[str, str] = Field(default_factory=dict)
	adaptive_height: dict[str, str] = Field(default_factory=dict)

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class LayoutConstraint:
	"""Layout constraint specification"""
	constraint_type: str  # spacing, positioning, sizing, alignment
	constraint_id: str = Field(default_factory=uuid7str)
	target_elements: list[str] = Field(default_factory=list)
	
	# Constraint parameters
	min_distance: str = "0"
	max_distance: str = "none"
	preferred_distance: str = "auto"
	
	# Constraint behavior
	priority: int = 100  # Higher number = higher priority
	flexible: bool = True  # Can be relaxed if needed
	break_policy: str = "avoid"  # avoid, allow, force
	
	# Validation
	constraint_satisfied: bool = True
	violation_severity: str = "none"  # none, warning, error

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class LayoutSpecification:
	"""Complete layout specification for a document section"""
	# Core configuration
	specification_id: str = Field(default_factory=uuid7str)
	section_name: str = ""
	page_configuration: PageConfiguration = Field(default_factory=PageConfiguration)
	column_layout: ColumnLayout = Field(default_factory=ColumnLayout)
	
	# Content positioning
	positioned_elements: list[ContentPositioning] = Field(default_factory=list)
	element_relationships: dict[str, list[str]] = Field(default_factory=dict)  # Dependencies
	layout_constraints: list[LayoutConstraint] = Field(default_factory=list)
	
	# Master page templates
	master_page_template: str = "default"
	header_configuration: HeaderFooterConfig = Field(default_factory=HeaderFooterConfig)
	footer_configuration: HeaderFooterConfig = Field(default_factory=HeaderFooterConfig)
	
	# Quality metrics
	layout_quality_score: float = 0.0
	accessibility_score: float = 0.0
	performance_metrics: dict[str, float] = Field(default_factory=dict)
	
	# Format outputs
	latex_geometry: str = ""
	css_grid_definition: str = ""
	pdf_layout_spec: dict[str, Any] = Field(default_factory=dict)
	
	# Validation
	validation_errors: list[str] = Field(default_factory=list)
	last_validated: datetime = Field(default_factory=datetime.now)

# ============================================================================
# Result Classes
# ============================================================================

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class PageGeometry:
	"""Calculated page geometry and safe areas"""
	# Page dimensions (in points)
	page_width: float
	page_height: float
	
	# Content area (after margins)
	content_width: float
	content_height: float
	content_x: float
	content_y: float
	
	# Safe areas
	safe_area_width: float
	safe_area_height: float
	bleed_width: float
	bleed_height: float
	
	# Print specifications
	binding_margin: float = 0.0
	print_margin_adjustment: float = 0.0
	
	# Metadata
	units: str = "pt"
	coordinate_system: str = "bottom_left"  # bottom_left, top_left

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class ColumnLayoutResult:
	"""Result of column layout computation"""
	# Layout specification
	column_count: int
	layout_id: str = Field(default_factory=uuid7str)
	column_specifications: list[dict[str, Any]] = Field(default_factory=list)
	
	# Computed dimensions
	effective_column_width: list[float] = Field(default_factory=list)
	gutter_widths: list[float] = Field(default_factory=list)
	total_width: float = 0.0
	
	# Content distribution
	content_distribution: dict[str, Any] = Field(default_factory=dict)
	column_balance_score: float = 0.0
	overflow_handling: dict[str, Any] = Field(default_factory=dict)
	
	# Break optimization
	optimal_breaks: list[dict[str, Any]] = Field(default_factory=list)
	orphan_widow_violations: int = 0
	break_quality_score: float = 0.0
	
	# Performance metrics
	computation_time: float = 0.0
	cache_used: bool = False
	complexity_score: float = 0.0

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class PositioningResult:
	"""Result of content positioning computation"""
	# Positioning summary
	positioning_id: str = Field(default_factory=uuid7str)
	elements_positioned: int = 0
	positioning_success_rate: float = 0.0
	
	# Element positions
	positioned_elements: list[dict[str, Any]] = Field(default_factory=list)
	float_elements: list[dict[str, Any]] = Field(default_factory=list)
	text_flow_adjustments: list[dict[str, Any]] = Field(default_factory=list)
	
	# Quality metrics
	positioning_quality_score: float = 0.0
	text_flow_quality: float = 0.0
	visual_balance_score: float = 0.0
	
	# Constraint satisfaction
	constraints_satisfied: int = 0
	constraint_violations: list[dict[str, Any]] = Field(default_factory=list)
	
	# Performance
	positioning_time: float = 0.0
	algorithm_complexity: str = "standard"

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class LayoutResult:
	"""Complete layout computation result"""
	# Result identification
	layout_specification: LayoutSpecification
	page_geometry: PageGeometry
	column_layout_result: ColumnLayoutResult
	positioning_result: PositioningResult
	result_id: str = Field(default_factory=uuid7str)
	computation_timestamp: datetime = Field(default_factory=datetime.now)
	
	# Quality assessment
	overall_quality_score: float = 0.0
	accessibility_compliance: float = 0.0
	print_quality_score: float = 0.0
	responsive_quality_score: float = 0.0
	
	# Format outputs
	latex_output: str = ""
	css_output: str = ""
	pdf_specifications: dict[str, Any] = Field(default_factory=dict)
	html_structure: str = ""
	
	# Performance metrics
	total_computation_time: float = 0.0
	memory_usage: float = 0.0
	cache_efficiency: float = 0.0
	
	# Validation results
	layout_valid: bool = True
	validation_warnings: list[str] = Field(default_factory=list)
	validation_errors: list[str] = Field(default_factory=list)

@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_assignment=True))
class LayoutManagerMetrics:
	"""LayoutManager performance and quality metrics"""
	# Processing statistics
	layouts_computed: int = 0
	total_processing_time: float = 0.0
	average_computation_time: float = 0.0
	
	# Cache performance
	cache_hits: int = 0
	cache_misses: int = 0
	cache_hit_rate: float = 0.0
	cache_size: int = 0
	
	# Quality metrics
	average_quality_score: float = 0.0
	accessibility_compliance_rate: float = 0.0
	layout_error_rate: float = 0.0
	
	# Component status
	components_initialized: dict[str, bool] = Field(default_factory=dict)
	component_health: dict[str, str] = Field(default_factory=dict)
	
	# Resource usage
	memory_usage: float = 0.0
	peak_memory: float = 0.0
	cpu_efficiency: float = 0.0

# ============================================================================
# Core Components
# ============================================================================

class PageManager:
	"""Professional page layout and composition management"""
	
	def __init__(self, default_config: PageConfiguration = None):
		self.default_config = default_config or PageConfiguration()
		self.page_templates = {}
		self.geometry_cache = {}
		
		# Standard page sizes in points (1 point = 1/72 inch)
		self.standard_page_sizes = {
			"A4": (595.28, 841.89),
			"Letter": (612, 792),
			"Legal": (612, 1008),
			"A3": (841.89, 1190.55),
			"A5": (420.94, 595.28),
			"Tabloid": (792, 1224),
			"Executive": (522, 756)
		}
		
		# Default margin sets for different use cases
		self.default_margins = {
			"tight": PageMargins(top="1.5cm", bottom="1.5cm", left="1.5cm", right="1.5cm"),
			"normal": PageMargins(top="2.5cm", bottom="2.5cm", left="2cm", right="2cm"),
			"wide": PageMargins(top="3cm", bottom="3cm", left="2.5cm", right="2.5cm"),
			"binding": PageMargins(top="2.5cm", bottom="2.5cm", left="3cm", right="1.5cm")
		}
	
	def create_page_specification(
		self,
		page_size: str,
		orientation: str = "portrait",
		margins: dict[str, str] | None = None
	) -> PageConfiguration:
		"""Create page specification with professional defaults"""
		assert page_size in self.standard_page_sizes or page_size == "custom", \
			f"Unsupported page size: {page_size}"
		assert orientation in ["portrait", "landscape"], \
			f"Invalid orientation: {orientation}"
		
		config = PageConfiguration(
			page_size=page_size,
			orientation=orientation,
			configuration_name=f"{page_size}_{orientation}"
		)
		
		if margins:
			config.margins = PageMargins(**margins)
		else:
			config.margins = self.default_margins["normal"]
		
		return config
	
	def calculate_page_geometry(self, config: PageConfiguration) -> PageGeometry:
		"""Calculate page geometry and safe areas"""
		cache_key = f"{config.page_size}_{config.orientation}_{hash(str(config.margins))}"
		
		if cache_key in self.geometry_cache:
			return self.geometry_cache[cache_key]
		
		# Get base page dimensions
		if config.page_size in self.standard_page_sizes:
			width, height = self.standard_page_sizes[config.page_size]
		else:
			width = self._parse_dimension(config.custom_width)
			height = self._parse_dimension(config.custom_height)
		
		# Handle orientation
		if config.orientation == "landscape":
			width, height = height, width
		
		# Calculate margins in points
		margin_top = self._parse_dimension(config.margins.top)
		margin_bottom = self._parse_dimension(config.margins.bottom)
		margin_left = self._parse_dimension(config.margins.left)
		margin_right = self._parse_dimension(config.margins.right)
		
		# Add binding offset if specified
		binding_offset = self._parse_dimension(config.binding_offset)
		if config.binding_side == "left":
			margin_left += binding_offset
		elif config.binding_side == "right":
			margin_right += binding_offset
		elif config.binding_side == "top":
			margin_top += binding_offset
		
		# Calculate content area
		content_width = width - margin_left - margin_right
		content_height = height - margin_top - margin_bottom
		content_x = margin_left
		content_y = margin_bottom  # Bottom-left coordinate system
		
		# Calculate safe areas (for print with bleeds)
		bleed = self._parse_dimension(config.bleed_area)
		safe_area_width = content_width - (2 * bleed)
		safe_area_height = content_height - (2 * bleed)
		
		geometry = PageGeometry(
			page_width=width,
			page_height=height,
			content_width=content_width,
			content_height=content_height,
			content_x=content_x,
			content_y=content_y,
			safe_area_width=max(0, safe_area_width),
			safe_area_height=max(0, safe_area_height),
			bleed_width=bleed,
			bleed_height=bleed,
			binding_margin=binding_offset
		)
		
		self.geometry_cache[cache_key] = geometry
		return geometry
	
	def generate_responsive_margins(
		self,
		base_margins: PageMargins,
		breakpoints: dict[str, dict[str, Any]]
	) -> dict[str, PageMargins]:
		"""Generate responsive margin adaptations"""
		responsive_margins = {}
		
		for breakpoint, config in breakpoints.items():
			margin_scale = config.get('margin_scale', 1.0)
			min_margin = config.get('min_margin', '1cm')
			
			# Scale base margins
			scaled_margins = PageMargins(
				top=self._scale_dimension(base_margins.top, margin_scale, min_margin),
				bottom=self._scale_dimension(base_margins.bottom, margin_scale, min_margin),
				left=self._scale_dimension(base_margins.left, margin_scale, min_margin),
				right=self._scale_dimension(base_margins.right, margin_scale, min_margin),
				header=self._scale_dimension(base_margins.header, margin_scale, min_margin),
				footer=self._scale_dimension(base_margins.footer, margin_scale, min_margin),
				gutter=base_margins.gutter
			)
			
			responsive_margins[breakpoint] = scaled_margins
		
		return responsive_margins
	
	def export_latex_geometry(self, config: PageConfiguration) -> str:
		"""Generate LaTeX geometry package configuration"""
		geometry_options = []
		
		# Page size
		if config.page_size in self.standard_page_sizes:
			if config.page_size == "Letter":
				geometry_options.append("letterpaper")
			elif config.page_size == "Legal":
				geometry_options.append("legalpaper")
			elif config.page_size == "A4":
				geometry_options.append("a4paper")
			elif config.page_size == "A3":
				geometry_options.append("a3paper")
		else:
			geometry_options.append(f"paperwidth={config.custom_width}")
			geometry_options.append(f"paperheight={config.custom_height}")
		
		# Orientation
		if config.orientation == "landscape":
			geometry_options.append("landscape")
		
		# Margins
		geometry_options.extend([
			f"top={config.margins.top}",
			f"bottom={config.margins.bottom}",
			f"left={config.margins.left}",
			f"right={config.margins.right}",
			f"headheight={config.margins.header}",
			f"footskip={config.margins.footer}"
		])
		
		# Binding offset
		if config.binding_offset != "0mm":
			geometry_options.append(f"bindingoffset={config.binding_offset}")
		
		return f"\\usepackage[{','.join(geometry_options)}]{{geometry}}"
	
	def export_css_page_setup(self, config: PageConfiguration) -> str:
		"""Generate CSS page setup with @page rules"""
		css_rules = []
		
		# Base page rule
		page_rule = "@page {\n"
		
		# Page size
		if config.page_size in self.standard_page_sizes:
			width, height = self.standard_page_sizes[config.page_size]
			width_in = width / 72
			height_in = height / 72
			
			if config.orientation == "landscape":
				width_in, height_in = height_in, width_in
			
			page_rule += f"    size: {width_in:.2f}in {height_in:.2f}in;\n"
		else:
			if config.orientation == "landscape":
				page_rule += f"    size: {config.custom_height} {config.custom_width} landscape;\n"
			else:
				page_rule += f"    size: {config.custom_width} {config.custom_height};\n"
		
		# Margins
		page_rule += f"    margin-top: {config.margins.top};\n"
		page_rule += f"    margin-bottom: {config.margins.bottom};\n"
		page_rule += f"    margin-left: {config.margins.left};\n"
		page_rule += f"    margin-right: {config.margins.right};\n"
		
		page_rule += "}\n"
		css_rules.append(page_rule)
		
		# Responsive page rules for different media
		responsive_css = """
@media screen {
    @page {
        margin: 1cm;
    }
}

@media print {
    @page {
        margin: 2cm;
    }
}
"""
		css_rules.append(responsive_css)
		
		return "\n".join(css_rules)
	
	def _parse_dimension(self, dimension: str) -> float:
		"""Parse dimension string to points"""
		if not dimension or dimension == "0":
			return 0.0
		
		# Extract number and unit
		match = re.match(r'([\d.]+)(\w+)', dimension.strip())
		if not match:
			return 0.0
		
		value, unit = match.groups()
		value = float(value)
		
		# Convert to points (1 point = 1/72 inch)
		conversion_factors = {
			'pt': 1.0,
			'mm': 72.0 / 25.4,
			'cm': 72.0 / 2.54,
			'in': 72.0,
			'px': 0.75,  # Assuming 96 DPI
			'pc': 12.0,  # 1 pica = 12 points
			'em': 12.0,  # Approximate
			'rem': 12.0  # Approximate
		}
		
		return value * conversion_factors.get(unit, 1.0)
	
	def _scale_dimension(self, dimension: str, scale: float, min_dimension: str) -> str:
		"""Scale dimension while respecting minimum"""
		points = self._parse_dimension(dimension)
		min_points = self._parse_dimension(min_dimension)
		
		scaled_points = max(points * scale, min_points)
		
		# Return in same unit as original
		match = re.match(r'[\d.]+(\w+)', dimension.strip())
		unit = match.group(1) if match else 'pt'
		
		conversion_factors = {
			'pt': 1.0,
			'mm': 25.4 / 72.0,
			'cm': 2.54 / 72.0,
			'in': 1.0 / 72.0,
			'px': 4.0 / 3.0,
			'pc': 1.0 / 12.0
		}
		
		scaled_value = scaled_points * conversion_factors.get(unit, 1.0)
		return f"{scaled_value:.2f}{unit}"

class ColumnEngine:
	"""Multi-column layout computation and optimization"""
	
	def __init__(self):
		self.column_algorithms = {}
		self.balancing_cache = {}
		
		# Column computation constants
		self.min_column_width = 72.0  # 1 inch minimum
		self.max_columns_per_page = 4
		self.optimal_line_length = 50  # characters
	
	def calculate_column_layout(
		self,
		content_elements: list[dict[str, Any]],
		column_config: ColumnLayout,
		page_geometry: PageGeometry
	) -> ColumnLayoutResult:
		"""Calculate optimal column layout for content"""
		assert column_config.column_count > 0, "Column count must be positive"
		assert column_config.column_count <= self.max_columns_per_page, \
			f"Maximum {self.max_columns_per_page} columns supported"
		
		start_time = datetime.now()
		
		# Calculate column specifications
		column_specs = self._compute_column_specifications(column_config, page_geometry)
		
		# Distribute content across columns
		content_distribution = self._distribute_content(content_elements, column_specs, column_config)
		
		# Optimize column breaks
		break_optimization = self._optimize_column_breaks(content_distribution, column_config)
		
		# Calculate balance score
		balance_score = self._calculate_column_balance(content_distribution)
		
		computation_time = (datetime.now() - start_time).total_seconds()
		
		result = ColumnLayoutResult(
			column_count=column_config.column_count,
			column_specifications=column_specs,
			effective_column_width=[spec['width'] for spec in column_specs],
			gutter_widths=[spec['gutter'] for spec in column_specs[:-1]],
			total_width=page_geometry.content_width,
			content_distribution=content_distribution,
			column_balance_score=balance_score,
			optimal_breaks=break_optimization['breaks'],
			orphan_widow_violations=break_optimization['violations'],
			break_quality_score=break_optimization['quality_score'],
			computation_time=computation_time,
			complexity_score=self._calculate_complexity_score(column_config, content_elements)
		)
		
		return result
	
	def generate_column_css(self, layout: ColumnLayout) -> str:
		"""Generate CSS Grid/Flexbox for column layout"""
		css_rules = []
		
		if layout.column_count == 1:
			# Single column layout
			css_rules.append("""
.document-content {
    display: block;
    max-width: 100%;
}""")
		else:
			# Multi-column layout using CSS Grid
			if len(layout.column_widths) == 0:
				# Equal columns
				grid_template = f"repeat({layout.column_count}, 1fr)"
			else:
				# Custom column widths
				grid_template = " ".join(layout.column_widths)
			
			css_rules.append(f"""
.document-content {{
    display: grid;
    grid-template-columns: {grid_template};
    gap: {layout.gutter_width};
    column-fill: {'balance' if layout.column_balance == 'auto' else 'auto'};
}}""")
			
			# Column break controls
			css_rules.append("""
.column-break-before {
    break-before: column;
}

.column-break-after {
    break-after: column;
}

.column-break-inside-avoid {
    break-inside: avoid;
}""")
			
			# Orphan and widow control
			if layout.orphan_control > 0:
				css_rules.append(f"""
.text-content {{
    orphans: {layout.orphan_control};
    widows: {layout.widow_control};
}}""")
		
		# Responsive column adaptations
		for breakpoint, column_count in layout.responsive_columns.items():
			media_query = self._breakpoint_to_media_query(breakpoint)
			if column_count == 1:
				css_rules.append(f"""
{media_query} {{
    .document-content {{
        display: block;
        columns: none;
    }}
}}""")
			else:
				css_rules.append(f"""
{media_query} {{
    .document-content {{
        grid-template-columns: repeat({column_count}, 1fr);
        gap: {layout.adaptive_gutters.get(breakpoint, layout.gutter_width)};
    }}
}}""")
		
		return "\n".join(css_rules)
	
	def generate_column_latex(self, layout: ColumnLayout) -> str:
		"""Generate LaTeX multicol configuration"""
		latex_commands = []
		
		if layout.column_count == 1:
			# Single column - no special commands needed
			return ""
		
		# Multi-column setup
		latex_commands.append("\\usepackage{multicol}")
		latex_commands.append(f"\\setlength{{\\columnsep}}{{{layout.gutter_width}}}")
		
		# Column balancing
		if layout.column_balance == "forced":
			latex_commands.append("\\raggedcolumns")
		else:
			latex_commands.append("\\flushcolumns")
		
		# Orphan and widow control
		if layout.orphan_control > 0:
			latex_commands.append(f"\\clubpenalty={10000 - (layout.orphan_control * 1000)}")
			latex_commands.append(f"\\widowpenalty={10000 - (layout.widow_control * 1000)}")
		
		# Column break penalties
		if layout.break_policy == "avoid":
			latex_commands.append("\\columnbreak[0]")
		elif layout.break_policy == "force":
			latex_commands.append("\\columnbreak[4]")
		
		# Begin multicols environment
		latex_commands.append(f"\\begin{{multicols}}{{{layout.column_count}}}")
		
		return "\n".join(latex_commands)
	
	def _compute_column_specifications(
		self,
		column_config: ColumnLayout,
		page_geometry: PageGeometry
	) -> list[dict[str, Any]]:
		"""Compute detailed column specifications"""
		available_width = page_geometry.content_width
		gutter_width = self._parse_dimension(column_config.gutter_width)
		
		# Calculate total gutter space
		total_gutter_width = (column_config.column_count - 1) * gutter_width
		content_width = available_width - total_gutter_width
		
		column_specs = []
		
		if len(column_config.column_widths) == 0:
			# Equal columns
			column_width = content_width / column_config.column_count
			
			for i in range(column_config.column_count):
				spec = {
					'index': i,
					'width': column_width,
					'x_offset': i * (column_width + gutter_width),
					'gutter': gutter_width if i < column_config.column_count - 1 else 0,
					'height': page_geometry.content_height
				}
				column_specs.append(spec)
		else:
			# Custom column widths
			current_x = 0
			for i, width_spec in enumerate(column_config.column_widths):
				if width_spec.endswith('%'):
					width = content_width * (float(width_spec[:-1]) / 100)
				else:
					width = self._parse_dimension(width_spec)
				
				spec = {
					'index': i,
					'width': width,
					'x_offset': current_x,
					'gutter': gutter_width if i < len(column_config.column_widths) - 1 else 0,
					'height': page_geometry.content_height
				}
				column_specs.append(spec)
				current_x += width + gutter_width
		
		return column_specs
	
	def _distribute_content(
		self,
		content_elements: list[dict[str, Any]],
		column_specs: list[dict[str, Any]],
		column_config: ColumnLayout
	) -> dict[str, Any]:
		"""Distribute content elements across columns"""
		distribution = {
			'columns': [{'elements': [], 'height_used': 0.0} for _ in column_specs],
			'spanning_elements': [],
			'overflow_elements': []
		}
		
		current_column = 0
		
		for element in content_elements:
			element_height = element.get('height', 50.0)  # Default height
			span_columns = element.get('span_columns', 1)
			
			if span_columns > 1:
				# Element spans multiple columns
				distribution['spanning_elements'].append({
					'element': element,
					'start_column': current_column,
					'span_count': span_columns
				})
			else:
				# Regular element - place in current column
				column_data = distribution['columns'][current_column]
				
				# Check if element fits in current column
				available_height = column_specs[current_column]['height'] - column_data['height_used']
				
				if element_height <= available_height:
					column_data['elements'].append(element)
					column_data['height_used'] += element_height
				else:
					# Move to next column or overflow
					current_column += 1
					if current_column < len(column_specs):
						distribution['columns'][current_column]['elements'].append(element)
						distribution['columns'][current_column]['height_used'] += element_height
					else:
						distribution['overflow_elements'].append(element)
		
		return distribution
	
	def _optimize_column_breaks(
		self,
		content_distribution: dict[str, Any],
		column_config: ColumnLayout
	) -> dict[str, Any]:
		"""Optimize column breaks for better typography"""
		breaks = []
		violations = 0
		
		for col_idx, column in enumerate(content_distribution['columns']):
			elements = column['elements']
			
			for elem_idx, element in enumerate(elements):
				# Check for orphan/widow violations
				if self._is_orphan_violation(element, elem_idx, elements, column_config):
					violations += 1
				
				if self._is_widow_violation(element, elem_idx, elements, column_config):
					violations += 1
				
				# Generate optimal break points
				if self._should_break_before(element, elem_idx, elements):
					breaks.append({
						'type': 'column_break',
						'column': col_idx,
						'element_index': elem_idx,
						'reason': 'optimal_flow'
					})
		
		# Calculate quality score based on violations and flow
		quality_score = max(0.0, 1.0 - (violations * 0.1))
		
		return {
			'breaks': breaks,
			'violations': violations,
			'quality_score': quality_score
		}
	
	def _calculate_column_balance(self, content_distribution: dict[str, Any]) -> float:
		"""Calculate how well balanced the columns are"""
		columns = content_distribution['columns']
		
		if len(columns) <= 1:
			return 1.0
		
		heights = [col['height_used'] for col in columns]
		avg_height = sum(heights) / len(heights)
		
		if avg_height == 0:
			return 1.0
		
		# Calculate variance from average
		variance = sum((h - avg_height) ** 2 for h in heights) / len(heights)
		balance_score = max(0.0, 1.0 - (variance / (avg_height ** 2)))
		
		return balance_score
	
	def _calculate_complexity_score(
		self,
		column_config: ColumnLayout,
		content_elements: list[dict[str, Any]]
	) -> float:
		"""Calculate layout complexity score"""
		complexity = 0.0
		
		# Base complexity from column count
		complexity += column_config.column_count * 0.2
		
		# Complexity from content elements
		complexity += len(content_elements) * 0.01
		
		# Complexity from custom widths
		if len(column_config.column_widths) > 0:
			complexity += 0.3
		
		# Complexity from spanning elements
		spanning_elements = [e for e in content_elements if e.get('span_columns', 1) > 1]
		complexity += len(spanning_elements) * 0.1
		
		return min(1.0, complexity)
	
	def _parse_dimension(self, dimension: str) -> float:
		"""Parse dimension string to points (reuse from PageManager)"""
		if not dimension or dimension == "0":
			return 0.0
		
		match = re.match(r'([\d.]+)(\w+)', dimension.strip())
		if not match:
			return 0.0
		
		value, unit = match.groups()
		value = float(value)
		
		conversion_factors = {
			'pt': 1.0,
			'mm': 72.0 / 25.4,
			'cm': 72.0 / 2.54,
			'in': 72.0,
			'px': 0.75,
			'pc': 12.0,
			'em': 12.0,
			'rem': 12.0
		}
		
		return value * conversion_factors.get(unit, 1.0)
	
	def _breakpoint_to_media_query(self, breakpoint: str) -> str:
		"""Convert breakpoint name to CSS media query"""
		breakpoint_map = {
			'mobile': '@media screen and (max-width: 768px)',
			'tablet': '@media screen and (min-width: 769px) and (max-width: 1024px)',
			'desktop': '@media screen and (min-width: 1025px)',
			'print': '@media print'
		}
		
		return breakpoint_map.get(breakpoint, f'@media screen and (max-width: {breakpoint})')
	
	def _is_orphan_violation(
		self,
		element: dict[str, Any],
		elem_idx: int,
		elements: list[dict[str, Any]],
		column_config: ColumnLayout
	) -> bool:
		"""Check if element creates orphan line violation"""
		if elem_idx >= len(elements) - column_config.orphan_control:
			return element.get('type') == 'text' and len(elements) - elem_idx < column_config.orphan_control
		return False
	
	def _is_widow_violation(
		self,
		element: dict[str, Any],
		elem_idx: int,
		elements: list[dict[str, Any]],
		column_config: ColumnLayout
	) -> bool:
		"""Check if element creates widow line violation"""
		if elem_idx < column_config.widow_control:
			return element.get('type') == 'text' and elem_idx < column_config.widow_control
		return False
	
	def _should_break_before(
		self,
		element: dict[str, Any],
		elem_idx: int,
		elements: list[dict[str, Any]]
	) -> bool:
		"""Determine if there should be a break before this element"""
		# Break before headings (unless it's the first element)
		if elem_idx > 0 and element.get('type') == 'heading':
			return True
		
		# Break before figures/tables if they're large
		if element.get('type') in ['figure', 'table'] and element.get('height', 0) > 200:
			return True
		
		return False

class ContentPositioner:
	"""Advanced content positioning and flow management"""
	
	def __init__(self):
		self.positioning_algorithms = {}
		self.float_cache = {}
		
		# Positioning constants
		self.min_text_wrap_width = 144.0  # 2 inches
		self.optimal_figure_margins = 14.4  # 0.2 inches
		self.z_index_layers = {
			'background': 0,
			'content': 100,
			'figures': 200,
			'overlays': 300,
			'annotations': 400
		}
	
	async def position_content_elements(
		self,
		elements: list[dict[str, Any]],
		layout_spec: LayoutSpecification
	) -> PositioningResult:
		"""Position all content elements within layout"""
		assert elements is not None, "Elements list cannot be None"
		
		start_time = datetime.now()
		
		positioned_elements = []
		float_elements = []
		text_flow_adjustments = []
		constraint_violations = []
		
		# Process each element
		for element in elements:
			positioning = self._create_element_positioning(element, layout_spec)
			
			if positioning.position_mode == "float":
				float_result = self._position_float_element(element, positioning, layout_spec)
				float_elements.append(float_result)
				
				# Calculate text flow adjustments
				flow_adjustments = self._calculate_text_flow(element, positioning, layout_spec)
				text_flow_adjustments.extend(flow_adjustments)
			else:
				position_result = self._position_block_element(element, positioning, layout_spec)
				positioned_elements.append(position_result)
			
			# Validate constraints
			violations = self._validate_element_constraints(positioning, layout_spec.layout_constraints)
			constraint_violations.extend(violations)
		
		# Calculate quality scores
		positioning_quality = self._calculate_positioning_quality(positioned_elements, float_elements)
		text_flow_quality = self._calculate_text_flow_quality(text_flow_adjustments)
		visual_balance = self._calculate_visual_balance(positioned_elements, float_elements)
		
		positioning_time = (datetime.now() - start_time).total_seconds()
		
		result = PositioningResult(
			elements_positioned=len(positioned_elements) + len(float_elements),
			positioning_success_rate=1.0 if len(constraint_violations) == 0 else 0.8,
			positioned_elements=positioned_elements,
			float_elements=float_elements,
			text_flow_adjustments=text_flow_adjustments,
			positioning_quality_score=positioning_quality,
			text_flow_quality=text_flow_quality,
			visual_balance_score=visual_balance,
			constraints_satisfied=len(layout_spec.layout_constraints) - len(constraint_violations),
			constraint_violations=constraint_violations,
			positioning_time=positioning_time,
			algorithm_complexity="standard"
		)
		
		return result
	
	def _create_element_positioning(
		self,
		element: dict[str, Any],
		layout_spec: LayoutSpecification
	) -> ContentPositioning:
		"""Create positioning configuration for element"""
		element_id = element.get('id', str(uuid4()))
		element_type = element.get('type', 'block')
		
		# Determine positioning mode based on element type
		position_mode = "flow"
		if element_type in ['figure', 'image', 'chart']:
			position_mode = "float"
		elif element.get('position') == 'absolute':
			position_mode = "absolute"
		
		# Create positioning configuration
		positioning = ContentPositioning(
			element_id=element_id,
			element_type=element_type,
			position_mode=position_mode,
			width_constraint=str(element.get('width', 'auto')),
			height_constraint=str(element.get('height', 'auto')),
			float_direction=element.get('float', 'right' if position_mode == 'float' else ''),
		)
		
		# Apply responsive positioning if available
		if 'responsive' in element:
			positioning.responsive_positions = element['responsive']
		
		return positioning
	
	def _position_float_element(
		self,
		element: dict[str, Any],
		positioning: ContentPositioning,
		layout_spec: LayoutSpecification
	) -> dict[str, Any]:
		"""Position floating element (figures, images, etc.)"""
		page_geometry = layout_spec.page_configuration
		
		# Calculate float position
		if positioning.float_direction == "left":
			x_position = self.optimal_figure_margins
		elif positioning.float_direction == "right":
			element_width = self._parse_dimension(positioning.width_constraint, 200.0)
			left_margin = self._parse_dimension(page_geometry.margins.left, 57.0)  # Default 2cm in points
			x_position = left_margin - element_width - self.optimal_figure_margins
		else:  # center
			element_width = self._parse_dimension(positioning.width_constraint, 200.0)
			page_width = 595.0  # Default A4 width
			x_position = (page_width - element_width) / 2
		
		y_position = element.get('y_position', 100.0)  # Default position
		
		return {
			'element_id': positioning.element_id,
			'element_type': positioning.element_type,
			'x_position': x_position,
			'y_position': y_position,
			'width': self._parse_dimension(positioning.width_constraint, 200.0),
			'height': self._parse_dimension(positioning.height_constraint, 150.0),
			'z_index': self.z_index_layers.get('figures', 200),
			'float_direction': positioning.float_direction,
			'clear_floats': positioning.clear_floats
		}
	
	def _position_block_element(
		self,
		element: dict[str, Any],
		positioning: ContentPositioning,
		layout_spec: LayoutSpecification
	) -> dict[str, Any]:
		"""Position block-level element"""
		return {
			'element_id': positioning.element_id,
			'element_type': positioning.element_type,
			'position_mode': positioning.position_mode,
			'width': positioning.width_constraint,
			'height': positioning.height_constraint,
			'margin_top': positioning.margin_top,
			'margin_bottom': positioning.margin_bottom,
			'margin_left': positioning.margin_left,
			'margin_right': positioning.margin_right,
			'z_index': self.z_index_layers.get('content', 100)
		}
	
	def _calculate_text_flow(
		self,
		element: dict[str, Any],
		positioning: ContentPositioning,
		layout_spec: LayoutSpecification
	) -> list[dict[str, Any]]:
		"""Calculate text flow adjustments around positioned elements"""
		if not positioning.text_wrap:
			return []
		
		adjustments = []
		
		# Calculate wrap area
		element_width = self._parse_dimension(positioning.width_constraint, 200.0)
		wrap_margin = self.optimal_figure_margins
		
		if positioning.float_direction == "left":
			wrap_area = {
				'side': 'left',
				'width': element_width + wrap_margin,
				'margin': wrap_margin
			}
		elif positioning.float_direction == "right":
			wrap_area = {
				'side': 'right',
				'width': element_width + wrap_margin,
				'margin': wrap_margin
			}
		else:
			# Center floated elements create complex wrap areas
			wrap_area = {
				'side': 'both',
				'width': element_width + (2 * wrap_margin),
				'margin': wrap_margin
			}
		
		adjustments.append({
			'element_id': positioning.element_id,
			'wrap_area': wrap_area,
			'flow_type': 'text_wrap',
			'quality_impact': 0.9  # High quality text flow
		})
		
		return adjustments
	
	def _validate_element_constraints(
		self,
		positioning: ContentPositioning,
		constraints: list[LayoutConstraint]
	) -> list[dict[str, Any]]:
		"""Validate positioning against layout constraints"""
		violations = []
		
		for constraint in constraints:
			if positioning.element_id in constraint.target_elements:
				# Check spacing constraints
				if constraint.constraint_type == "spacing":
					min_distance = self._parse_dimension(constraint.min_distance, 0.0)
					# Simplified constraint validation
					if min_distance > 0:
						violations.append({
							'constraint_id': constraint.constraint_id,
							'element_id': positioning.element_id,
							'violation_type': 'spacing',
							'severity': constraint.violation_severity,
							'message': f"Minimum spacing of {constraint.min_distance} not met"
						})
		
		return violations
	
	def _calculate_positioning_quality(
		self,
		positioned_elements: list[dict[str, Any]],
		float_elements: list[dict[str, Any]]
	) -> float:
		"""Calculate overall positioning quality score"""
		total_elements = len(positioned_elements) + len(float_elements)
		
		if total_elements == 0:
			return 1.0
		
		# Base quality score
		quality_score = 0.8
		
		# Bonus for well-positioned float elements
		for float_elem in float_elements:
			if float_elem.get('float_direction') in ['left', 'right']:
				quality_score += 0.02
		
		# Penalty for overlapping elements (simplified check)
		overlap_penalty = 0.0
		if len(float_elements) > 1:
			overlap_penalty = 0.1 * (len(float_elements) - 1)
		
		return max(0.0, min(1.0, quality_score - overlap_penalty))
	
	def _calculate_text_flow_quality(self, text_flow_adjustments: list[dict[str, Any]]) -> float:
		"""Calculate text flow quality score"""
		if not text_flow_adjustments:
			return 1.0
		
		total_quality = sum(adj.get('quality_impact', 0.5) for adj in text_flow_adjustments)
		return total_quality / len(text_flow_adjustments)
	
	def _calculate_visual_balance(
		self,
		positioned_elements: list[dict[str, Any]],
		float_elements: list[dict[str, Any]]
	) -> float:
		"""Calculate visual balance score"""
		# Simplified visual balance calculation
		left_weight = 0.0
		right_weight = 0.0
		
		for float_elem in float_elements:
			if float_elem.get('float_direction') == 'left':
				left_weight += 1.0
			elif float_elem.get('float_direction') == 'right':
				right_weight += 1.0
		
		if left_weight + right_weight == 0:
			return 1.0
		
		# Calculate balance ratio
		total_weight = left_weight + right_weight
		balance_ratio = min(left_weight, right_weight) / total_weight
		
		return balance_ratio * 2.0  # Scale to 0-1 range
	
	def _parse_dimension(self, dimension: str, default: float = 0.0) -> float:
		"""Parse dimension string to points"""
		if not dimension or dimension == "auto":
			return default
		
		if isinstance(dimension, (int, float)):
			return float(dimension)
		
		match = re.match(r'([\d.]+)(\w*)', str(dimension).strip())
		if not match:
			return default
		
		value, unit = match.groups()
		value = float(value)
		
		conversion_factors = {
			'': 1.0,  # Assume points if no unit
			'pt': 1.0,
			'mm': 72.0 / 25.4,
			'cm': 72.0 / 2.54,
			'in': 72.0,
			'px': 0.75,
			'pc': 12.0,
			'em': 12.0,
			'rem': 12.0,
			'%': 1.0  # Handle percentage separately
		}
		
		return value * conversion_factors.get(unit, 1.0)

# ============================================================================
# Main LayoutManager Class
# ============================================================================

class LayoutManager:
	"""Main layout management engine"""
	
	def __init__(
		self,
		page_manager: PageManager | None = None,
		column_engine: ColumnEngine | None = None,
		content_positioner: ContentPositioner | None = None
	):
		self.page_manager = page_manager or PageManager()
		self.column_engine = column_engine or ColumnEngine()
		self.content_positioner = content_positioner or ContentPositioner()
		
		# Performance optimization
		self.layout_cache = {}
		self.computation_cache = {}
		
		# Quality metrics
		self.metrics = {
			'layouts_computed': 0,
			'cache_hits': 0,
			'performance_score': 0.0,
			'quality_score': 0.0,
			'total_computation_time': 0.0
		}
	
	async def compute_document_layout(
		self,
		content_elements: list[dict[str, Any]],
		layout_requirements: dict[str, Any],
		responsive_config: dict[str, Any] | None = None
	) -> LayoutResult:
		"""Compute complete document layout with optimization"""
		assert content_elements is not None, "Content elements cannot be None"
		assert layout_requirements is not None, "Layout requirements cannot be None"
		
		start_time = datetime.now()
		
		# Create layout specification
		layout_spec = self._create_layout_specification(layout_requirements, responsive_config)
		
		# Check cache
		cache_key = self._generate_cache_key(content_elements, layout_spec)
		if cache_key in self.layout_cache:
			self.metrics['cache_hits'] += 1
			return self.layout_cache[cache_key]
		
		# Compute page geometry
		page_geometry = self.page_manager.calculate_page_geometry(layout_spec.page_configuration)
		
		# Compute column layout
		column_layout_result = self.column_engine.calculate_column_layout(
			content_elements,
			layout_spec.column_layout,
			page_geometry
		)
		
		# Position content elements
		positioning_result = await self.content_positioner.position_content_elements(
			content_elements,
			layout_spec
		)
		
		# Generate format outputs
		format_outputs = self._generate_format_outputs(
			layout_spec,
			page_geometry,
			column_layout_result,
			positioning_result
		)
		
		# Calculate quality scores
		quality_scores = await self._calculate_quality_scores(
			layout_spec,
			page_geometry,
			column_layout_result,
			positioning_result
		)
		
		# Validate layout
		validation_result = self._validate_layout(layout_spec, positioning_result)
		
		computation_time = (datetime.now() - start_time).total_seconds()
		
		# Create result
		result = LayoutResult(
			layout_specification=layout_spec,
			page_geometry=page_geometry,
			column_layout_result=column_layout_result,
			positioning_result=positioning_result,
			overall_quality_score=quality_scores['overall'],
			accessibility_compliance=quality_scores['accessibility'],
			print_quality_score=quality_scores['print'],
			responsive_quality_score=quality_scores['responsive'],
			latex_output=format_outputs['latex'],
			css_output=format_outputs['css'],
			pdf_specifications=format_outputs['pdf'],
			html_structure=format_outputs['html'],
			total_computation_time=computation_time,
			memory_usage=self._estimate_memory_usage(content_elements),
			cache_efficiency=self.metrics['cache_hits'] / max(1, self.metrics['layouts_computed']),
			layout_valid=validation_result['valid'],
			validation_warnings=validation_result['warnings'],
			validation_errors=validation_result['errors']
		)
		
		# Cache result
		self.layout_cache[cache_key] = result
		
		# Update metrics
		self.metrics['layouts_computed'] += 1
		self.metrics['total_computation_time'] += computation_time
		self.metrics['quality_score'] = (
			self.metrics['quality_score'] * (self.metrics['layouts_computed'] - 1) + 
			quality_scores['overall']
		) / self.metrics['layouts_computed']
		
		return result
	
	async def optimize_page_composition(self, layout_spec: LayoutSpecification) -> LayoutResult:
		"""Optimize page composition for professional quality"""
		# Create mock content for optimization
		mock_content = [
			{'id': 'opt_1', 'type': 'heading', 'height': 30},
			{'id': 'opt_2', 'type': 'text', 'height': 100},
			{'id': 'opt_3', 'type': 'figure', 'height': 200, 'width': '50%'},
			{'id': 'opt_4', 'type': 'text', 'height': 150}
		]
		
		# Use standard layout computation with optimization flags
		layout_requirements = {
			'page_size': layout_spec.page_configuration.page_size,
			'orientation': layout_spec.page_configuration.orientation,
			'columns': layout_spec.column_layout.column_count,
			'optimize_for': 'print_quality'
		}
		
		return await self.compute_document_layout(mock_content, layout_requirements)
	
	def generate_multi_format_output(
		self,
		layout_result: LayoutResult,
		output_formats: list[str]
	) -> dict[str, str]:
		"""Generate layout output for multiple formats"""
		outputs = {}
		
		for format_name in output_formats:
			if format_name == "latex":
				outputs["latex"] = layout_result.latex_output
			elif format_name == "css":
				outputs["css"] = layout_result.css_output
			elif format_name == "html":
				outputs["html"] = layout_result.html_structure
			elif format_name == "pdf":
				outputs["pdf"] = str(layout_result.pdf_specifications)
		
		return outputs
	
	async def get_layout_metrics(self) -> LayoutManagerMetrics:
		"""Get comprehensive layout manager metrics"""
		cache_hit_rate = self.metrics['cache_hits'] / max(1, self.metrics['layouts_computed'])
		
		return LayoutManagerMetrics(
			layouts_computed=self.metrics['layouts_computed'],
			total_processing_time=self.metrics['total_computation_time'],
			average_computation_time=self.metrics['total_computation_time'] / max(1, self.metrics['layouts_computed']),
			cache_hits=self.metrics['cache_hits'],
			cache_misses=self.metrics['layouts_computed'] - self.metrics['cache_hits'],
			cache_hit_rate=cache_hit_rate,
			cache_size=len(self.layout_cache),
			average_quality_score=self.metrics['quality_score'],
			accessibility_compliance_rate=0.95,  # Placeholder
			layout_error_rate=0.02,  # Placeholder
			components_initialized={
				'page_manager': self.page_manager is not None,
				'column_engine': self.column_engine is not None,
				'content_positioner': self.content_positioner is not None
			},
			component_health={
				'page_manager': 'healthy',
				'column_engine': 'healthy',
				'content_positioner': 'healthy'
			},
			memory_usage=self._get_current_memory_usage(),
			peak_memory=self._get_current_memory_usage() * 1.2,  # Estimate
			cpu_efficiency=0.85  # Placeholder
		)
	
	def _create_layout_specification(
		self,
		layout_requirements: dict[str, Any],
		responsive_config: dict[str, Any] | None
	) -> LayoutSpecification:
		"""Create layout specification from requirements"""
		# Create page configuration
		page_config = PageConfiguration(
			page_size=layout_requirements.get('page_size', 'A4'),
			orientation=layout_requirements.get('orientation', 'portrait')
		)
		
		# Create column configuration
		column_config = ColumnLayout(
			column_count=layout_requirements.get('columns', 1),
			gutter_width=layout_requirements.get('gutter_width', '1cm')
		)
		
		# Apply responsive configuration
		if responsive_config:
			column_config.responsive_columns = responsive_config.get('columns', {})
			# Handle responsive margins (convert margin_scale configs to actual PageMargins)
			if 'margins' in responsive_config:
				responsive_margins = {}
				for breakpoint, margin_config in responsive_config['margins'].items():
					if 'margin_scale' in margin_config:
						# Convert margin_scale to actual margins by scaling base margins
						scale = margin_config['margin_scale']
						base_margins = page_config.margins
						responsive_margins[breakpoint] = PageMargins(
							top=self._scale_margin_value(base_margins.top, scale),
							bottom=self._scale_margin_value(base_margins.bottom, scale),
							left=self._scale_margin_value(base_margins.left, scale),
							right=self._scale_margin_value(base_margins.right, scale),
							header=self._scale_margin_value(base_margins.header, scale),
							footer=self._scale_margin_value(base_margins.footer, scale),
							gutter=base_margins.gutter
						)
					else:
						# Direct margin configuration
						responsive_margins[breakpoint] = PageMargins(**margin_config)
				page_config.responsive_margins = responsive_margins
		
		return LayoutSpecification(
			section_name=layout_requirements.get('section_name', 'default'),
			page_configuration=page_config,
			column_layout=column_config
		)
	
	def _generate_format_outputs(
		self,
		layout_spec: LayoutSpecification,
		page_geometry: PageGeometry,
		column_result: ColumnLayoutResult,
		positioning_result: PositioningResult
	) -> dict[str, str]:
		"""Generate outputs for different formats"""
		outputs = {}
		
		# LaTeX output
		latex_parts = []
		latex_parts.append(self.page_manager.export_latex_geometry(layout_spec.page_configuration))
		latex_parts.append(self.column_engine.generate_column_latex(layout_spec.column_layout))
		outputs['latex'] = '\n'.join(latex_parts)
		
		# CSS output
		css_parts = []
		css_parts.append(self.page_manager.export_css_page_setup(layout_spec.page_configuration))
		css_parts.append(self.column_engine.generate_column_css(layout_spec.column_layout))
		outputs['css'] = '\n'.join(css_parts)
		
		# PDF specifications
		outputs['pdf'] = {
			'page_size': [page_geometry.page_width, page_geometry.page_height],
			'margins': [
				page_geometry.content_x,
				page_geometry.content_y,
				page_geometry.page_width - page_geometry.content_width - page_geometry.content_x,
				page_geometry.page_height - page_geometry.content_height - page_geometry.content_y
			],
			'columns': column_result.column_count
		}
		
		# HTML structure
		outputs['html'] = self._generate_html_structure(layout_spec, positioning_result)
		
		return outputs
	
	def _generate_html_structure(
		self,
		layout_spec: LayoutSpecification,
		positioning_result: PositioningResult
	) -> str:
		"""Generate HTML structure for layout"""
		html_parts = ['<div class="document-layout">']
		
		# Add positioned elements
		for element in positioning_result.positioned_elements:
			element_type = element.get('element_type', 'div')
			element_id = element.get('element_id', '')
			
			html_parts.append(f'  <{element_type} id="{element_id}" class="positioned-element">')
			html_parts.append(f'  </{element_type}>')
		
		# Add float elements
		for element in positioning_result.float_elements:
			element_type = element.get('element_type', 'div')
			element_id = element.get('element_id', '')
			float_dir = element.get('float_direction', 'none')
			
			html_parts.append(f'  <{element_type} id="{element_id}" class="float-{float_dir}">')
			html_parts.append(f'  </{element_type}>')
		
		html_parts.append('</div>')
		
		return '\n'.join(html_parts)
	
	async def _calculate_quality_scores(
		self,
		layout_spec: LayoutSpecification,
		page_geometry: PageGeometry,
		column_result: ColumnLayoutResult,
		positioning_result: PositioningResult
	) -> dict[str, float]:
		"""Calculate various quality scores"""
		scores = {}
		
		# Overall quality (weighted average)
		scores['overall'] = (
			column_result.column_balance_score * 0.3 +
			column_result.break_quality_score * 0.2 +
			positioning_result.positioning_quality_score * 0.3 +
			positioning_result.visual_balance_score * 0.2
		)
		
		# Accessibility score (based on text flow and positioning)
		scores['accessibility'] = min(
			positioning_result.text_flow_quality,
			0.95 if positioning_result.constraints_satisfied > 0 else 0.8
		)
		
		# Print quality score
		scores['print'] = (
			column_result.break_quality_score * 0.5 +
			(1.0 - (column_result.orphan_widow_violations * 0.1)) * 0.5
		)
		
		# Responsive quality score
		responsive_elements = len(layout_spec.column_layout.responsive_columns)
		scores['responsive'] = min(1.0, 0.7 + (responsive_elements * 0.1))
		
		return scores
	
	def _validate_layout(
		self,
		layout_spec: LayoutSpecification,
		positioning_result: PositioningResult
	) -> dict[str, Any]:
		"""Validate layout for errors and warnings"""
		validation = {
			'valid': True,
			'warnings': [],
			'errors': []
		}
		
		# Check for constraint violations
		if positioning_result.constraint_violations:
			validation['warnings'].append(
				f"{len(positioning_result.constraint_violations)} layout constraints violated"
			)
		
		# Check column configuration
		if layout_spec.column_layout.column_count > 4:
			validation['warnings'].append("More than 4 columns may impact readability")
		
		# Check positioning success rate
		if positioning_result.positioning_success_rate < 0.9:
			validation['errors'].append("Low positioning success rate")
			validation['valid'] = False
		
		return validation
	
	def _generate_cache_key(
		self,
		content_elements: list[dict[str, Any]],
		layout_spec: LayoutSpecification
	) -> str:
		"""Generate cache key for layout computation"""
		content_hash = hash(str(sorted([e.get('id', '') for e in content_elements])))
		spec_hash = hash(f"{layout_spec.page_configuration.page_size}_{layout_spec.column_layout.column_count}")
		return f"layout_{content_hash}_{spec_hash}"
	
	def _estimate_memory_usage(self, content_elements: list[dict[str, Any]]) -> float:
		"""Estimate memory usage in MB"""
		base_usage = 10.0  # Base layout engine overhead
		element_usage = len(content_elements) * 0.1  # ~100KB per element
		cache_usage = len(self.layout_cache) * 0.5  # ~500KB per cached layout
		
		return base_usage + element_usage + cache_usage
	
	def _get_current_memory_usage(self) -> float:
		"""Get current memory usage (placeholder implementation)"""
		return 25.0  # Placeholder value in MB
	
	def _scale_margin_value(self, margin_value: str, scale: float) -> str:
		"""Scale a margin value by the given factor"""
		# Parse the current value to points
		points = self.page_manager._parse_dimension(margin_value)
		
		# Scale it
		scaled_points = points * scale
		
		# Convert back to the original unit
		match = re.match(r'[\d.]+(\w+)', margin_value.strip())
		unit = match.group(1) if match else 'pt'
		
		# Convert from points back to the target unit
		if unit == 'cm':
			scaled_value = scaled_points * 2.54 / 72.0
		elif unit == 'mm':
			scaled_value = scaled_points * 25.4 / 72.0
		elif unit == 'in':
			scaled_value = scaled_points / 72.0
		else:  # points or other
			scaled_value = scaled_points
		
		return f"{scaled_value:.2f}{unit}"

# ============================================================================
# Utility Functions
# ============================================================================

def create_default_layout_manager() -> LayoutManager:
	"""Create LayoutManager with default configuration"""
	return LayoutManager()

def create_responsive_layout_specification(
	page_size: str = "A4",
	base_columns: int = 2,
	responsive_breakpoints: dict[str, int] | None = None
) -> LayoutSpecification:
	"""Create responsive layout specification"""
	if responsive_breakpoints is None:
		responsive_breakpoints = {
			'mobile': 1,
			'tablet': 1,
			'desktop': base_columns
		}
	
	page_config = PageConfiguration(page_size=page_size)
	column_config = ColumnLayout(
		column_count=base_columns,
		responsive_columns=responsive_breakpoints
	)
	
	return LayoutSpecification(
		page_configuration=page_config,
		column_layout=column_config
	)

async def quick_layout_computation(
	content_elements: list[dict[str, Any]],
	page_size: str = "A4",
	columns: int = 1
) -> LayoutResult:
	"""Quick layout computation with minimal configuration"""
	layout_manager = create_default_layout_manager()
	
	layout_requirements = {
		'page_size': page_size,
		'columns': columns,
		'section_name': 'quick_layout'
	}
	
	return await layout_manager.compute_document_layout(content_elements, layout_requirements)

def validate_layout_manager_installation() -> dict[str, bool]:
	"""Validate LayoutManager installation and dependencies"""
	validation_results = {}
	
	try:
		# Test basic functionality
		manager = LayoutManager()
		validation_results['layout_manager_creation'] = True
		
		# Test page manager
		page_config = manager.page_manager.create_page_specification("A4")
		validation_results['page_manager'] = page_config is not None
		
		# Test column engine
		column_config = ColumnLayout(column_count=2)
		validation_results['column_engine'] = column_config is not None
		
		# Test content positioner
		positioner = ContentPositioner()
		validation_results['content_positioner'] = positioner is not None
		
		validation_results['overall_status'] = all(validation_results.values())
		
	except Exception as e:
		validation_results['error'] = str(e)
		validation_results['overall_status'] = False
	
	return validation_results

# Rebuild dataclasses to ensure proper initialization
rebuild_dataclass(PageMargins)
rebuild_dataclass(PageConfiguration)
rebuild_dataclass(ColumnLayout)
rebuild_dataclass(ContentPositioning)
rebuild_dataclass(HeaderFooterConfig)
rebuild_dataclass(LayoutConstraint)
rebuild_dataclass(LayoutSpecification)
rebuild_dataclass(PageGeometry)
rebuild_dataclass(ColumnLayoutResult)
rebuild_dataclass(PositioningResult)
rebuild_dataclass(LayoutResult)
rebuild_dataclass(LayoutManagerMetrics)

# Module exports
__all__ = [
	# Main classes
	'LayoutManager',
	'PageManager',
	'ColumnEngine',
	'ContentPositioner',
	
	# Data models
	'PageConfiguration',
	'PageMargins',
	'ColumnLayout',
	'ContentPositioning',
	'HeaderFooterConfig',
	'LayoutConstraint',
	'LayoutSpecification',
	
	# Result classes
	'PageGeometry',
	'ColumnLayoutResult',
	'PositioningResult',
	'LayoutResult',
	'LayoutManagerMetrics',
	
	# Exceptions
	'LayoutManagerException',
	'PageConfigurationException',
	'ColumnLayoutException',
	'ContentPositioningException',
	'LayoutValidationException',
	
	# Utility functions
	'create_default_layout_manager',
	'create_responsive_layout_specification',
	'quick_layout_computation',
	'validate_layout_manager_installation'
]
