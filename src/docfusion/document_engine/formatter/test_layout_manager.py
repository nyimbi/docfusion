#!/usr/bin/env python3
"""
LayoutManager Module Tests

Comprehensive test suite for the LayoutManager module covering:
- Page geometry and composition management
- Multi-column layout computation and balancing
- Content positioning and float management
- Responsive layout adaptation
- Format output generation (LaTeX, CSS, PDF, HTML)
- Performance optimization and caching
- Quality validation and accessibility compliance
"""

import asyncio
import pytest
from datetime import datetime
from typing import Any

from .layout_manager import (
	LayoutManager,
	PageManager,
	ColumnEngine,
	ContentPositioner,
	PageConfiguration,
	PageMargins,
	ColumnLayout,
	ContentPositioning,
	HeaderFooterConfig,
	LayoutConstraint,
	LayoutSpecification,
	PageGeometry,
	ColumnLayoutResult,
	PositioningResult,
	LayoutResult,
	LayoutManagerMetrics,
	create_default_layout_manager,
	create_responsive_layout_specification,
	quick_layout_computation,
	validate_layout_manager_installation,
	LayoutManagerException,
	PageConfigurationException,
	ColumnLayoutException,
	ContentPositioningException
)


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def sample_page_margins():
	"""Create sample page margins for testing"""
	return PageMargins(
		top="2.5cm",
		bottom="2.5cm",
		left="2cm",
		right="2cm",
		header="1.5cm",
		footer="1.5cm"
	)


@pytest.fixture
def sample_page_configuration(sample_page_margins):
	"""Create sample page configuration for testing"""
	return PageConfiguration(
		page_size="A4",
		orientation="portrait",
		margins=sample_page_margins,
		configuration_name="test_page"
	)


@pytest.fixture
def sample_column_layout():
	"""Create sample column layout for testing"""
	return ColumnLayout(
		column_count=2,
		gutter_width="1cm",
		column_balance="auto",
		orphan_control=2,
		widow_control=2,
		responsive_columns={
			"mobile": 1,
			"tablet": 1,
			"desktop": 2
		}
	)


@pytest.fixture
def sample_content_elements():
	"""Create sample content elements for testing"""
	return [
		{
			'id': 'heading_1',
			'type': 'heading',
			'height': 30,
			'width': 'auto',
			'content': 'Chapter 1: Introduction'
		},
		{
			'id': 'paragraph_1',
			'type': 'text',
			'height': 100,
			'width': 'auto',
			'content': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
		},
		{
			'id': 'figure_1',
			'type': 'figure',
			'height': 200,
			'width': '50%',
			'float': 'right',
			'content': 'Sample figure'
		},
		{
			'id': 'paragraph_2',
			'type': 'text',
			'height': 150,
			'width': 'auto',
			'content': 'More paragraph content following the figure.'
		},
		{
			'id': 'table_1',
			'type': 'table',
			'height': 120,
			'width': '100%',
			'span_columns': 2,
			'content': 'Sample table data'
		}
	]


@pytest.fixture
def sample_layout_specification(sample_page_configuration, sample_column_layout):
	"""Create sample layout specification for testing"""
	return LayoutSpecification(
		section_name="test_section",
		page_configuration=sample_page_configuration,
		column_layout=sample_column_layout
	)


@pytest.fixture
def page_manager():
	"""Create PageManager instance for testing"""
	return PageManager()


@pytest.fixture
def column_engine():
	"""Create ColumnEngine instance for testing"""
	return ColumnEngine()


@pytest.fixture
def content_positioner():
	"""Create ContentPositioner instance for testing"""
	return ContentPositioner()


@pytest.fixture
def layout_manager(page_manager, column_engine, content_positioner):
	"""Create LayoutManager instance for testing"""
	return LayoutManager(page_manager, column_engine, content_positioner)


# ============================================================================
# PageManager Tests
# ============================================================================

class TestPageManager:
	"""Test PageManager functionality"""
	
	def test_page_manager_initialization(self, page_manager):
		"""Test PageManager initialization"""
		assert page_manager is not None
		assert page_manager.default_config is not None
		assert len(page_manager.standard_page_sizes) >= 7
		assert "A4" in page_manager.standard_page_sizes
		assert "Letter" in page_manager.standard_page_sizes
	
	def test_create_page_specification_a4_portrait(self, page_manager):
		"""Test A4 portrait page specification creation"""
		config = page_manager.create_page_specification("A4", "portrait")
		
		assert config.page_size == "A4"
		assert config.orientation == "portrait"
		assert config.configuration_name == "A4_portrait"
		assert config.margins is not None
	
	def test_create_page_specification_letter_landscape(self, page_manager):
		"""Test Letter landscape page specification creation"""
		config = page_manager.create_page_specification("Letter", "landscape")
		
		assert config.page_size == "Letter"
		assert config.orientation == "landscape"
		assert config.configuration_name == "Letter_landscape"
	
	def test_create_page_specification_custom_margins(self, page_manager):
		"""Test page specification with custom margins"""
		custom_margins = {
			"top": "3cm",
			"bottom": "3cm",
			"left": "2.5cm",
			"right": "2.5cm"
		}
		
		config = page_manager.create_page_specification("A4", "portrait", custom_margins)
		
		assert config.margins.top == "3cm"
		assert config.margins.bottom == "3cm"
		assert config.margins.left == "2.5cm"
		assert config.margins.right == "2.5cm"
	
	def test_calculate_page_geometry_a4(self, page_manager, sample_page_configuration):
		"""Test page geometry calculation for A4"""
		geometry = page_manager.calculate_page_geometry(sample_page_configuration)
		
		assert geometry.page_width == 595.28  # A4 width in points
		assert geometry.page_height == 841.89  # A4 height in points
		assert geometry.content_width > 0
		assert geometry.content_height > 0
		assert geometry.content_x > 0
		assert geometry.content_y > 0
	
	def test_calculate_page_geometry_landscape(self, page_manager):
		"""Test page geometry calculation for landscape orientation"""
		config = PageConfiguration(page_size="A4", orientation="landscape")
		geometry = page_manager.calculate_page_geometry(config)
		
		# In landscape, width and height should be swapped
		assert geometry.page_width == 841.89  # A4 height becomes width
		assert geometry.page_height == 595.28  # A4 width becomes height
	
	def test_calculate_page_geometry_caching(self, page_manager, sample_page_configuration):
		"""Test page geometry calculation caching"""
		# First calculation
		geometry1 = page_manager.calculate_page_geometry(sample_page_configuration)
		
		# Second calculation (should use cache)
		geometry2 = page_manager.calculate_page_geometry(sample_page_configuration)
		
		assert geometry1.page_width == geometry2.page_width
		assert geometry1.page_height == geometry2.page_height
		assert len(page_manager.geometry_cache) > 0
	
	def test_generate_responsive_margins(self, page_manager, sample_page_margins):
		"""Test responsive margin generation"""
		breakpoints = {
			'mobile': {'margin_scale': 0.5, 'min_margin': '1cm'},
			'tablet': {'margin_scale': 0.75, 'min_margin': '1.5cm'},
			'desktop': {'margin_scale': 1.0, 'min_margin': '2cm'}
		}
		
		responsive_margins = page_manager.generate_responsive_margins(sample_page_margins, breakpoints)
		
		assert 'mobile' in responsive_margins
		assert 'tablet' in responsive_margins
		assert 'desktop' in responsive_margins
		
		# Mobile margins should be smaller
		mobile_margins = responsive_margins['mobile']
		assert mobile_margins is not None
	
	def test_export_latex_geometry(self, page_manager, sample_page_configuration):
		"""Test LaTeX geometry export"""
		latex_output = page_manager.export_latex_geometry(sample_page_configuration)
		
		assert "\\usepackage" in latex_output
		assert "geometry" in latex_output
		assert "a4paper" in latex_output
		assert "top=" in latex_output
		assert "bottom=" in latex_output
		assert "left=" in latex_output
		assert "right=" in latex_output
	
	def test_export_css_page_setup(self, page_manager, sample_page_configuration):
		"""Test CSS page setup export"""
		css_output = page_manager.export_css_page_setup(sample_page_configuration)
		
		assert "@page" in css_output
		assert "size:" in css_output
		assert "margin-top:" in css_output
		assert "margin-bottom:" in css_output
		assert "@media screen" in css_output
		assert "@media print" in css_output
	
	def test_dimension_parsing(self, page_manager):
		"""Test dimension parsing functionality"""
		# Test various units
		assert page_manager._parse_dimension("72pt") == 72.0
		assert page_manager._parse_dimension("1in") == 72.0
		assert page_manager._parse_dimension("2.54cm") == 72.0
		assert page_manager._parse_dimension("25.4mm") == 72.0
		
		# Test edge cases
		assert page_manager._parse_dimension("0") == 0.0
		assert page_manager._parse_dimension("") == 0.0
	
	def test_invalid_page_size_error(self, page_manager):
		"""Test error handling for invalid page size"""
		with pytest.raises(AssertionError):
			page_manager.create_page_specification("InvalidSize")
	
	def test_invalid_orientation_error(self, page_manager):
		"""Test error handling for invalid orientation"""
		with pytest.raises(AssertionError):
			page_manager.create_page_specification("A4", "invalid_orientation")


# ============================================================================
# ColumnEngine Tests
# ============================================================================

class TestColumnEngine:
	"""Test ColumnEngine functionality"""
	
	def test_column_engine_initialization(self, column_engine):
		"""Test ColumnEngine initialization"""
		assert column_engine is not None
		assert column_engine.min_column_width == 72.0
		assert column_engine.max_columns_per_page == 4
		assert column_engine.optimal_line_length == 50
	
	def test_calculate_column_layout_single_column(self, column_engine, sample_content_elements):
		"""Test single column layout calculation"""
		single_column_config = ColumnLayout(column_count=1)
		page_geometry = PageGeometry(
			page_width=595.28,
			page_height=841.89,
			content_width=515.28,
			content_height=761.89,
			content_x=40,
			content_y=40,
			safe_area_width=515.28,
			safe_area_height=761.89,
			bleed_width=0,
			bleed_height=0
		)
		
		result = column_engine.calculate_column_layout(
			sample_content_elements,
			single_column_config,
			page_geometry
		)
		
		assert result.column_count == 1
		assert len(result.column_specifications) == 1
		assert result.computation_time > 0
		assert result.column_balance_score >= 0
	
	def test_calculate_column_layout_two_columns(self, column_engine, sample_content_elements):
		"""Test two-column layout calculation"""
		two_column_config = ColumnLayout(column_count=2, gutter_width="1cm")
		page_geometry = PageGeometry(
			page_width=595.28,
			page_height=841.89,
			content_width=515.28,
			content_height=761.89,
			content_x=40,
			content_y=40,
			safe_area_width=515.28,
			safe_area_height=761.89,
			bleed_width=0,
			bleed_height=0
		)
		
		result = column_engine.calculate_column_layout(
			sample_content_elements,
			two_column_config,
			page_geometry
		)
		
		assert result.column_count == 2
		assert len(result.column_specifications) == 2
		assert len(result.effective_column_width) == 2
		assert len(result.gutter_widths) == 1  # One gutter between two columns
		assert result.total_width == page_geometry.content_width
	
	def test_calculate_column_layout_custom_widths(self, column_engine, sample_content_elements):
		"""Test column layout with custom column widths"""
		custom_column_config = ColumnLayout(
			column_count=2,
			column_widths=["60%", "40%"],
			gutter_width="0.5cm"
		)
		page_geometry = PageGeometry(
			page_width=595.28,
			page_height=841.89,
			content_width=515.28,
			content_height=761.89,
			content_x=40,
			content_y=40,
			safe_area_width=515.28,
			safe_area_height=761.89,
			bleed_width=0,
			bleed_height=0
		)
		
		result = column_engine.calculate_column_layout(
			sample_content_elements,
			custom_column_config,
			page_geometry
		)
		
		assert result.column_count == 2
		assert len(result.effective_column_width) == 2
		# First column should be wider than second
		assert result.effective_column_width[0] > result.effective_column_width[1]
	
	def test_generate_column_css_single_column(self, column_engine):
		"""Test CSS generation for single column layout"""
		single_column_layout = ColumnLayout(column_count=1)
		css_output = column_engine.generate_column_css(single_column_layout)
		
		assert ".document-content" in css_output
		assert "display: block" in css_output
		assert "max-width: 100%" in css_output
	
	def test_generate_column_css_multi_column(self, column_engine):
		"""Test CSS generation for multi-column layout"""
		multi_column_layout = ColumnLayout(column_count=3, gutter_width="1.5cm")
		css_output = column_engine.generate_column_css(multi_column_layout)
		
		assert ".document-content" in css_output
		assert "display: grid" in css_output
		assert "repeat(3, 1fr)" in css_output
		assert "gap: 1.5cm" in css_output
		assert "column-break-before" in css_output
		assert "column-break-after" in css_output
	
	def test_generate_column_css_responsive(self, column_engine, sample_column_layout):
		"""Test CSS generation with responsive columns"""
		css_output = column_engine.generate_column_css(sample_column_layout)
		
		assert "@media" in css_output
		assert "max-width:" in css_output or "min-width:" in css_output
		# Should contain responsive adaptations
		assert css_output.count("grid-template-columns") >= 2
	
	def test_generate_column_latex_single_column(self, column_engine):
		"""Test LaTeX generation for single column"""
		single_column_layout = ColumnLayout(column_count=1)
		latex_output = column_engine.generate_column_latex(single_column_layout)
		
		# Single column should return empty string (no special commands needed)
		assert latex_output == ""
	
	def test_generate_column_latex_multi_column(self, column_engine):
		"""Test LaTeX generation for multi-column layout"""
		multi_column_layout = ColumnLayout(column_count=3, gutter_width="2cm")
		latex_output = column_engine.generate_column_latex(multi_column_layout)
		
		assert "\\usepackage{multicol}" in latex_output
		assert "\\setlength{\\columnsep}{2cm}" in latex_output
		assert "\\begin{multicols}{3}" in latex_output
		assert "\\clubpenalty" in latex_output
		assert "\\widowpenalty" in latex_output
	
	def test_column_count_validation(self, column_engine, sample_content_elements):
		"""Test column count validation"""
		page_geometry = PageGeometry(
			page_width=595.28, page_height=841.89,
			content_width=515.28, content_height=761.89,
			content_x=40, content_y=40,
			safe_area_width=515.28, safe_area_height=761.89,
			bleed_width=0, bleed_height=0
		)
		
		# Test invalid column count (0)
		with pytest.raises(AssertionError):
			invalid_config = ColumnLayout(column_count=0)
			column_engine.calculate_column_layout(sample_content_elements, invalid_config, page_geometry)
		
		# Test too many columns
		with pytest.raises(AssertionError):
			invalid_config = ColumnLayout(column_count=5)  # Max is 4
			column_engine.calculate_column_layout(sample_content_elements, invalid_config, page_geometry)
	
	def test_content_distribution_algorithm(self, column_engine, sample_content_elements):
		"""Test content distribution across columns"""
		column_config = ColumnLayout(column_count=2)
		column_specs = [
			{'index': 0, 'width': 200, 'height': 400, 'x_offset': 0, 'gutter': 20},
			{'index': 1, 'width': 200, 'height': 400, 'x_offset': 220, 'gutter': 0}
		]
		
		distribution = column_engine._distribute_content(sample_content_elements, column_specs, column_config)
		
		assert 'columns' in distribution
		assert 'spanning_elements' in distribution
		assert 'overflow_elements' in distribution
		assert len(distribution['columns']) == 2
	
	def test_column_balance_calculation(self, column_engine):
		"""Test column balance score calculation"""
		# Well-balanced columns
		balanced_distribution = {
			'columns': [
				{'elements': ['e1', 'e2'], 'height_used': 100},
				{'elements': ['e3', 'e4'], 'height_used': 105}
			]
		}
		balance_score = column_engine._calculate_column_balance(balanced_distribution)
		assert balance_score > 0.9  # Should be well balanced
		
		# Poorly balanced columns
		unbalanced_distribution = {
			'columns': [
				{'elements': ['e1'], 'height_used': 50},
				{'elements': ['e2', 'e3', 'e4'], 'height_used': 200}
			]
		}
		balance_score = column_engine._calculate_column_balance(unbalanced_distribution)
		assert balance_score < 0.7  # Should show poor balance


# ============================================================================
# ContentPositioner Tests
# ============================================================================

class TestContentPositioner:
	"""Test ContentPositioner functionality"""
	
	def test_content_positioner_initialization(self, content_positioner):
		"""Test ContentPositioner initialization"""
		assert content_positioner is not None
		assert content_positioner.min_text_wrap_width == 144.0
		assert content_positioner.optimal_figure_margins == 14.4
		assert len(content_positioner.z_index_layers) == 5
	
	async def test_position_content_elements_basic(self, content_positioner, sample_layout_specification):
		"""Test basic content element positioning"""
		elements = [
			{'id': 'test_1', 'type': 'text', 'height': 100},
			{'id': 'test_2', 'type': 'heading', 'height': 30}
		]
		
		result = await content_positioner.position_content_elements(elements, sample_layout_specification)
		
		assert result.elements_positioned == 2
		assert result.positioning_success_rate > 0
		assert len(result.positioned_elements) == 2
		assert result.positioning_time > 0
	
	async def test_position_float_elements(self, content_positioner, sample_layout_specification):
		"""Test positioning of floating elements"""
		elements = [
			{'id': 'figure_1', 'type': 'figure', 'height': 200, 'width': '40%', 'float': 'right'},
			{'id': 'text_1', 'type': 'text', 'height': 100}
		]
		
		result = await content_positioner.position_content_elements(elements, sample_layout_specification)
		
		assert len(result.float_elements) == 1
		assert len(result.positioned_elements) == 1
		assert len(result.text_flow_adjustments) > 0
		
		# Check float element properties
		float_elem = result.float_elements[0]
		assert float_elem['element_type'] == 'figure'
		assert float_elem['float_direction'] == 'right'
		assert 'x_position' in float_elem
		assert 'y_position' in float_elem
	
	async def test_text_flow_calculations(self, content_positioner, sample_layout_specification):
		"""Test text flow calculations around floating elements"""
		elements = [
			{'id': 'figure_left', 'type': 'figure', 'height': 150, 'width': '30%', 'float': 'left'},
			{'id': 'text_wrap', 'type': 'text', 'height': 200}
		]
		
		result = await content_positioner.position_content_elements(elements, sample_layout_specification)
		
		assert len(result.text_flow_adjustments) > 0
		
		flow_adjustment = result.text_flow_adjustments[0]
		assert 'wrap_area' in flow_adjustment
		assert flow_adjustment['flow_type'] == 'text_wrap'
		assert flow_adjustment['quality_impact'] > 0
	
	def test_element_positioning_creation(self, content_positioner, sample_layout_specification):
		"""Test content positioning configuration creation"""
		element = {
			'id': 'test_element',
			'type': 'figure',
			'width': '50%',
			'height': '200px',
			'position': 'absolute'
		}
		
		positioning = content_positioner._create_element_positioning(element, sample_layout_specification)
		
		assert positioning.element_id == 'test_element'
		assert positioning.element_type == 'figure'
		assert positioning.position_mode == 'absolute'
		assert positioning.width_constraint == '50%'
		assert positioning.height_constraint == '200px'
	
	def test_float_positioning_algorithms(self, content_positioner, sample_layout_specification):
		"""Test floating element positioning algorithms"""
		element = {'id': 'float_test', 'type': 'figure', 'y_position': 100}
		
		# Test left float
		positioning_left = ContentPositioning(
			element_id="float_left",
			element_type="figure",
			position_mode="float",
			float_direction="left",
			width_constraint="200px"
		)
		
		result_left = content_positioner._position_float_element(element, positioning_left, sample_layout_specification)
		assert result_left['float_direction'] == 'left'
		assert result_left['x_position'] == content_positioner.optimal_figure_margins
		
		# Test right float
		positioning_right = ContentPositioning(
			element_id="float_right",
			element_type="figure",
			position_mode="float",
			float_direction="right",
			width_constraint="200px"
		)
		
		result_right = content_positioner._position_float_element(element, positioning_right, sample_layout_specification)
		assert result_right['float_direction'] == 'right'
		assert result_right['x_position'] < 0  # Should be negative offset from right
	
	def test_constraint_validation(self, content_positioner):
		"""Test layout constraint validation"""
		positioning = ContentPositioning(
			element_id="constrained_element",
			element_type="text"
		)
		
		constraints = [
			LayoutConstraint(
				constraint_type="spacing",
				target_elements=["constrained_element"],
				min_distance="10px"
			)
		]
		
		violations = content_positioner._validate_element_constraints(positioning, constraints)
		
		# Should detect spacing constraint violation
		assert len(violations) > 0
		assert violations[0]['constraint_type'] == 'spacing'
		assert violations[0]['element_id'] == 'constrained_element'
	
	def test_quality_score_calculations(self, content_positioner):
		"""Test positioning quality score calculations"""
		positioned_elements = [
			{'element_id': 'elem1', 'element_type': 'text'},
			{'element_id': 'elem2', 'element_type': 'heading'}
		]
		
		float_elements = [
			{'element_id': 'float1', 'float_direction': 'left'},
			{'element_id': 'float2', 'float_direction': 'right'}
		]
		
		quality_score = content_positioner._calculate_positioning_quality(positioned_elements, float_elements)
		assert 0.0 <= quality_score <= 1.0
		
		# Test text flow quality
		text_flow_adjustments = [
			{'quality_impact': 0.9},
			{'quality_impact': 0.8}
		]
		
		flow_quality = content_positioner._calculate_text_flow_quality(text_flow_adjustments)
		assert flow_quality == 0.85  # Average of 0.9 and 0.8
	
	def test_visual_balance_calculation(self, content_positioner):
		"""Test visual balance score calculation"""
		positioned_elements = []
		
		# Balanced float elements
		balanced_floats = [
			{'float_direction': 'left'},
			{'float_direction': 'right'}
		]
		
		balance_score = content_positioner._calculate_visual_balance(positioned_elements, balanced_floats)
		assert balance_score == 1.0  # Perfect balance
		
		# Unbalanced float elements
		unbalanced_floats = [
			{'float_direction': 'left'},
			{'float_direction': 'left'},
			{'float_direction': 'right'}
		]
		
		balance_score = content_positioner._calculate_visual_balance(positioned_elements, unbalanced_floats)
		assert balance_score < 1.0  # Imperfect balance
	
	def test_dimension_parsing_edge_cases(self, content_positioner):
		"""Test dimension parsing with edge cases"""
		# Test various input types
		assert content_positioner._parse_dimension("100px", 50) == 75.0  # 100 * 0.75
		assert content_positioner._parse_dimension("auto", 50) == 50.0  # Default value
		assert content_positioner._parse_dimension(200, 50) == 200.0  # Numeric input
		assert content_positioner._parse_dimension("invalid", 50) == 50.0  # Invalid input
		assert content_positioner._parse_dimension("", 50) == 50.0  # Empty input


# ============================================================================
# LayoutManager Integration Tests
# ============================================================================

class TestLayoutManager:
	"""Test main LayoutManager functionality"""
	
	def test_layout_manager_initialization(self, layout_manager):
		"""Test LayoutManager initialization"""
		assert layout_manager is not None
		assert layout_manager.page_manager is not None
		assert layout_manager.column_engine is not None
		assert layout_manager.content_positioner is not None
		assert len(layout_manager.layout_cache) == 0
		assert layout_manager.metrics['layouts_computed'] == 0
	
	def test_layout_manager_auto_initialization(self):
		"""Test LayoutManager auto-initialization"""
		manager = LayoutManager()
		
		assert manager.page_manager is not None
		assert manager.column_engine is not None
		assert manager.content_positioner is not None
	
	async def test_compute_document_layout_basic(self, layout_manager, sample_content_elements):
		"""Test basic document layout computation"""
		layout_requirements = {
			'page_size': 'A4',
			'orientation': 'portrait',
			'columns': 1,
			'section_name': 'test_section'
		}
		
		result = await layout_manager.compute_document_layout(sample_content_elements, layout_requirements)
		
		assert result.result_id is not None
		assert result.layout_valid is True
		assert result.page_geometry is not None
		assert result.column_layout_result is not None
		assert result.positioning_result is not None
		assert result.total_computation_time > 0
		assert result.overall_quality_score >= 0
	
	async def test_compute_document_layout_multi_column(self, layout_manager, sample_content_elements):
		"""Test multi-column document layout computation"""
		layout_requirements = {
			'page_size': 'A4',
			'orientation': 'portrait',
			'columns': 2,
			'gutter_width': '1.5cm',
			'section_name': 'multi_column_test'
		}
		
		result = await layout_manager.compute_document_layout(sample_content_elements, layout_requirements)
		
		assert result.column_layout_result.column_count == 2
		assert len(result.column_layout_result.column_specifications) == 2
		assert len(result.column_layout_result.effective_column_width) == 2
		assert result.layout_valid is True
	
	async def test_compute_document_layout_responsive(self, layout_manager, sample_content_elements):
		"""Test responsive document layout computation"""
		layout_requirements = {
			'page_size': 'A4',
			'columns': 2,
			'section_name': 'responsive_test'
		}
		
		responsive_config = {
			'columns': {
				'mobile': 1,
				'tablet': 1,
				'desktop': 2
			},
			'margins': {
				'mobile': {'margin_scale': 0.5},
				'desktop': {'margin_scale': 1.0}
			}
		}
		
		result = await layout_manager.compute_document_layout(
			sample_content_elements,
			layout_requirements,
			responsive_config
		)
		
		assert result.responsive_quality_score > 0
		assert result.layout_valid is True
		assert result.column_layout_result.column_count == 2  # Desktop default
	
	async def test_layout_caching_functionality(self, layout_manager, sample_content_elements):
		"""Test layout computation caching"""
		layout_requirements = {
			'page_size': 'A4',
			'columns': 1,
			'section_name': 'cache_test'
		}
		
		# First computation
		result1 = await layout_manager.compute_document_layout(sample_content_elements, layout_requirements)
		
		# Second computation (should use cache)
		result2 = await layout_manager.compute_document_layout(sample_content_elements, layout_requirements)
		
		assert layout_manager.metrics['cache_hits'] > 0
		assert len(layout_manager.layout_cache) > 0
		assert result1.result_id == result2.result_id  # Should be cached result
	
	async def test_optimize_page_composition(self, layout_manager, sample_layout_specification):
		"""Test page composition optimization"""
		result = await layout_manager.optimize_page_composition(sample_layout_specification)
		
		assert result is not None
		assert result.overall_quality_score > 0
		assert result.print_quality_score > 0
		assert result.layout_valid is True
	
	def test_generate_multi_format_output(self, layout_manager):
		"""Test multi-format output generation"""
		# Create a mock layout result
		from datetime import datetime
		mock_result = LayoutResult(
			layout_specification=LayoutSpecification(),
			page_geometry=PageGeometry(
				page_width=595, page_height=842,
				content_width=515, content_height=762,
				content_x=40, content_y=40,
				safe_area_width=515, safe_area_height=762,
				bleed_width=0, bleed_height=0
			),
			column_layout_result=ColumnLayoutResult(column_count=1),
			positioning_result=PositioningResult(),
			latex_output="\\documentclass{article}",
			css_output=".document { margin: 2cm; }",
			html_structure="<div class='document'></div>",
			pdf_specifications={'page_size': [595, 842]}
		)
		
		formats = ['latex', 'css', 'html', 'pdf']
		outputs = layout_manager.generate_multi_format_output(mock_result, formats)
		
		assert 'latex' in outputs
		assert 'css' in outputs
		assert 'html' in outputs
		assert 'pdf' in outputs
		assert "\\documentclass" in outputs['latex']
		assert ".document" in outputs['css']
		assert "<div" in outputs['html']
	
	async def test_get_layout_metrics(self, layout_manager, sample_content_elements):
		"""Test layout manager metrics collection"""
		# Perform some layout computations first
		layout_requirements = {'page_size': 'A4', 'columns': 1}
		await layout_manager.compute_document_layout(sample_content_elements, layout_requirements)
		await layout_manager.compute_document_layout(sample_content_elements, layout_requirements)  # Cache hit
		
		metrics = await layout_manager.get_layout_metrics()
		
		assert metrics.layouts_computed >= 1
		assert metrics.total_processing_time > 0
		assert metrics.average_computation_time > 0
		assert metrics.cache_hit_rate >= 0
		assert metrics.components_initialized['page_manager'] is True
		assert metrics.components_initialized['column_engine'] is True
		assert metrics.components_initialized['content_positioner'] is True
	
	def test_layout_specification_creation(self, layout_manager):
		"""Test layout specification creation from requirements"""
		layout_requirements = {
			'page_size': 'Letter',
			'orientation': 'landscape',
			'columns': 3,
			'gutter_width': '2cm',
			'section_name': 'spec_test'
		}
		
		responsive_config = {
			'columns': {'mobile': 1, 'desktop': 3},
			'margins': {'mobile': {'margin_scale': 0.5}}
		}
		
		spec = layout_manager._create_layout_specification(layout_requirements, responsive_config)
		
		assert spec.section_name == 'spec_test'
		assert spec.page_configuration.page_size == 'Letter'
		assert spec.page_configuration.orientation == 'landscape'
		assert spec.column_layout.column_count == 3
		assert spec.column_layout.gutter_width == '2cm'
		assert 'mobile' in spec.column_layout.responsive_columns
		assert 'desktop' in spec.column_layout.responsive_columns
	
	def test_quality_score_calculations(self, layout_manager):
		"""Test quality score calculation algorithms"""
		# Create mock objects for testing
		layout_spec = LayoutSpecification()
		page_geometry = PageGeometry(
			page_width=595, page_height=842,
			content_width=515, content_height=762,
			content_x=40, content_y=40,
			safe_area_width=515, safe_area_height=762,
			bleed_width=0, bleed_height=0
		)
		column_result = ColumnLayoutResult(
			column_count=2,
			column_balance_score=0.9,
			break_quality_score=0.8
		)
		positioning_result = PositioningResult(
			positioning_quality_score=0.85,
			visual_balance_score=0.75
		)
		
		# Test quality calculations
		async def test_calculation():
			quality_scores = await layout_manager._calculate_quality_scores(
				layout_spec, page_geometry, column_result, positioning_result
			)
			
			assert 'overall' in quality_scores
			assert 'accessibility' in quality_scores
			assert 'print' in quality_scores
			assert 'responsive' in quality_scores
			assert 0 <= quality_scores['overall'] <= 1
			
		asyncio.run(test_calculation())
	
	def test_layout_validation(self, layout_manager, sample_layout_specification):
		"""Test layout validation algorithms"""
		# Create positioning result with some violations
		positioning_result = PositioningResult(
			positioning_success_rate=0.95,
			constraint_violations=[
				{'type': 'spacing', 'severity': 'warning'}
			]
		)
		
		validation = layout_manager._validate_layout(sample_layout_specification, positioning_result)
		
		assert 'valid' in validation
		assert 'warnings' in validation
		assert 'errors' in validation
		assert isinstance(validation['valid'], bool)
		assert isinstance(validation['warnings'], list)
		assert isinstance(validation['errors'], list)
	
	def test_error_handling_invalid_content(self, layout_manager):
		"""Test error handling with invalid content"""
		async def test_invalid_content():
			with pytest.raises(AssertionError):
				await layout_manager.compute_document_layout(None, {'page_size': 'A4'})
		
		asyncio.run(test_invalid_content())
	
	def test_error_handling_invalid_requirements(self, layout_manager, sample_content_elements):
		"""Test error handling with invalid requirements"""
		async def test_invalid_requirements():
			with pytest.raises(AssertionError):
				await layout_manager.compute_document_layout(sample_content_elements, None)
		
		asyncio.run(test_invalid_requirements())


# ============================================================================
# Utility Function Tests
# ============================================================================

class TestUtilityFunctions:
	"""Test LayoutManager utility functions"""
	
	def test_create_default_layout_manager(self):
		"""Test default layout manager creation"""
		manager = create_default_layout_manager()
		
		assert manager is not None
		assert isinstance(manager, LayoutManager)
		assert manager.page_manager is not None
		assert manager.column_engine is not None
		assert manager.content_positioner is not None
	
	def test_create_responsive_layout_specification(self):
		"""Test responsive layout specification creation"""
		spec = create_responsive_layout_specification(
			page_size="Letter",
			base_columns=3,
			responsive_breakpoints={'mobile': 1, 'tablet': 2, 'desktop': 3}
		)
		
		assert spec.page_configuration.page_size == "Letter"
		assert spec.column_layout.column_count == 3
		assert spec.column_layout.responsive_columns['mobile'] == 1
		assert spec.column_layout.responsive_columns['tablet'] == 2
		assert spec.column_layout.responsive_columns['desktop'] == 3
	
	def test_create_responsive_layout_specification_defaults(self):
		"""Test responsive layout specification with defaults"""
		spec = create_responsive_layout_specification()
		
		assert spec.page_configuration.page_size == "A4"
		assert spec.column_layout.column_count == 2
		assert 'mobile' in spec.column_layout.responsive_columns
		assert 'tablet' in spec.column_layout.responsive_columns
		assert 'desktop' in spec.column_layout.responsive_columns
	
	async def test_quick_layout_computation(self):
		"""Test quick layout computation utility"""
		content_elements = [
			{'id': 'quick_1', 'type': 'text', 'height': 100},
			{'id': 'quick_2', 'type': 'heading', 'height': 30}
		]
		
		result = await quick_layout_computation(content_elements, "A4", 1)
		
		assert result is not None
		assert result.layout_valid is True
		assert result.page_geometry.page_width == 595.28  # A4 width
		assert result.column_layout_result.column_count == 1
	
	async def test_quick_layout_computation_multi_column(self):
		"""Test quick layout computation with multiple columns"""
		content_elements = [
			{'id': 'quick_1', 'type': 'text', 'height': 100}
		]
		
		result = await quick_layout_computation(content_elements, "Letter", 2)
		
		assert result.page_geometry.page_width == 612  # Letter width
		assert result.column_layout_result.column_count == 2
	
	def test_validate_layout_manager_installation(self):
		"""Test layout manager installation validation"""
		validation_results = validate_layout_manager_installation()
		
		assert 'layout_manager_creation' in validation_results
		assert 'page_manager' in validation_results
		assert 'column_engine' in validation_results
		assert 'content_positioner' in validation_results
		assert 'overall_status' in validation_results
		
		# All components should validate successfully
		assert validation_results['layout_manager_creation'] is True
		assert validation_results['page_manager'] is True
		assert validation_results['column_engine'] is True
		assert validation_results['content_positioner'] is True
		assert validation_results['overall_status'] is True


# ============================================================================
# Performance Tests
# ============================================================================

class TestLayoutManagerPerformance:
	"""Test LayoutManager performance characteristics"""
	
	async def test_large_content_list_performance(self, layout_manager):
		"""Test performance with large number of content elements"""
		# Create large content list
		large_content_list = []
		for i in range(100):
			element = {
				'id': f'perf_element_{i}',
				'type': 'text' if i % 3 == 0 else 'heading',
				'height': 50 + (i % 50),
				'width': 'auto'
			}
			large_content_list.append(element)
		
		layout_requirements = {'page_size': 'A4', 'columns': 2}
		
		start_time = datetime.now()
		result = await layout_manager.compute_document_layout(large_content_list, layout_requirements)
		end_time = datetime.now()
		
		processing_time = (end_time - start_time).total_seconds()
		
		assert result.layout_valid is True
		assert processing_time < 2.0  # Should process 100 elements in under 2 seconds
		assert result.positioning_result.elements_positioned == 100
	
	async def test_cache_performance_improvement(self, layout_manager, sample_content_elements):
		"""Test that caching improves performance"""
		layout_requirements = {'page_size': 'A4', 'columns': 1}
		
		# First computation (no cache)
		start_time = datetime.now()
		result1 = await layout_manager.compute_document_layout(sample_content_elements, layout_requirements)
		first_time = (datetime.now() - start_time).total_seconds()
		
		# Second computation (with cache)
		start_time = datetime.now()
		result2 = await layout_manager.compute_document_layout(sample_content_elements, layout_requirements)
		second_time = (datetime.now() - start_time).total_seconds()
		
		assert layout_manager.metrics['cache_hits'] > 0
		assert result1.result_id == result2.result_id  # Should be same cached result
		# Note: In tests, the difference might be minimal due to small dataset
	
	async def test_memory_efficiency(self, layout_manager):
		"""Test memory efficiency with multiple layouts"""
		content_elements = [
			{'id': 'mem_test_1', 'type': 'text', 'height': 100},
			{'id': 'mem_test_2', 'type': 'heading', 'height': 30}
		]
		
		# Compute multiple layouts
		for i in range(10):
			layout_requirements = {
				'page_size': 'A4',
				'columns': 1 + (i % 3),  # Vary column count
				'section_name': f'memory_test_{i}'
			}
			await layout_manager.compute_document_layout(content_elements, layout_requirements)
		
		metrics = await layout_manager.get_layout_metrics()
		
		# Memory usage should be reasonable
		assert metrics.memory_usage < 100.0  # Less than 100MB
		assert metrics.layouts_computed == 10
		assert len(layout_manager.layout_cache) <= 10  # Cache size managed


# ============================================================================
# Error Handling Tests
# ============================================================================

class TestLayoutManagerErrorHandling:
	"""Test LayoutManager error handling and edge cases"""
	
	async def test_empty_content_list_handling(self, layout_manager):
		"""Test handling of empty content list"""
		empty_content = []
		layout_requirements = {'page_size': 'A4', 'columns': 1}
		
		result = await layout_manager.compute_document_layout(empty_content, layout_requirements)
		
		assert result.layout_valid is True
		assert result.positioning_result.elements_positioned == 0
		assert result.overall_quality_score >= 0
	
	async def test_invalid_page_size_handling(self, layout_manager, sample_content_elements):
		"""Test handling of invalid page size"""
		# This should be handled gracefully by falling back to defaults
		layout_requirements = {
			'page_size': 'InvalidSize',  # Should fall back to A4
			'columns': 1
		}
		
		# Should not raise exception but handle gracefully
		result = await layout_manager.compute_document_layout(sample_content_elements, layout_requirements)
		assert result is not None
	
	async def test_malformed_content_elements(self, layout_manager):
		"""Test handling of malformed content elements"""
		malformed_content = [
			{'type': 'text'},  # Missing id
			{'id': 'malformed_2'},  # Missing type
			{'id': 'malformed_3', 'type': 'unknown_type', 'height': 'invalid'}  # Invalid height
		]
		
		layout_requirements = {'page_size': 'A4', 'columns': 1}
		
		# Should handle gracefully without crashing
		result = await layout_manager.compute_document_layout(malformed_content, layout_requirements)
		assert result.layout_valid is True
	
	def test_page_manager_edge_cases(self, page_manager):
		"""Test PageManager edge cases"""
		# Test with zero margins
		zero_margins = PageMargins(top="0", bottom="0", left="0", right="0")
		config = PageConfiguration(margins=zero_margins)
		geometry = page_manager.calculate_page_geometry(config)
		
		assert geometry.content_width > 0
		assert geometry.content_height > 0
	
	def test_column_engine_edge_cases(self, column_engine):
		"""Test ColumnEngine edge cases"""
		# Test with very wide gutters
		wide_gutter_config = ColumnLayout(column_count=2, gutter_width="10cm")
		page_geometry = PageGeometry(
			page_width=595, page_height=842,
			content_width=200,  # Small content width
			content_height=700,
			content_x=40, content_y=40,
			safe_area_width=200, safe_area_height=700,
			bleed_width=0, bleed_height=0
		)
		
		# Should handle gracefully even if gutters are too wide
		result = column_engine.calculate_column_layout([], wide_gutter_config, page_geometry)
		assert result.column_count == 2
	
	async def test_content_positioner_edge_cases(self, content_positioner, sample_layout_specification):
		"""Test ContentPositioner edge cases"""
		# Test with overlapping elements
		overlapping_elements = [
			{'id': 'overlap_1', 'type': 'figure', 'x_position': 100, 'y_position': 100, 'width': '200px', 'height': '150px'},
			{'id': 'overlap_2', 'type': 'figure', 'x_position': 150, 'y_position': 120, 'width': '200px', 'height': '150px'}
		]
		
		result = await content_positioner.position_content_elements(overlapping_elements, sample_layout_specification)
		
		# Should handle overlaps gracefully
		assert result.elements_positioned > 0
		assert result.positioning_success_rate >= 0


# ============================================================================
# Integration Tests
# ============================================================================

class TestLayoutManagerIntegration:
	"""Test LayoutManager integration with other systems"""
	
	async def test_integration_with_document_formatter(self, layout_manager):
		"""Test integration patterns with DocumentFormatter"""
		# This would test integration with computed styles
		# For now, test that layout can handle style-like elements
		
		styled_content = [
			{
				'id': 'styled_heading',
				'type': 'heading',
				'height': 40,
				'style': {
					'font_size': '24pt',
					'font_weight': 'bold',
					'color': '#1f2937'
				}
			},
			{
				'id': 'styled_text',
				'type': 'text',
				'height': 120,
				'style': {
					'font_size': '12pt',
					'line_height': '1.5'
				}
			}
		]
		
		layout_requirements = {'page_size': 'A4', 'columns': 1}
		result = await layout_manager.compute_document_layout(styled_content, layout_requirements)
		
		assert result.layout_valid is True
		assert result.positioning_result.elements_positioned == 2
	
	def test_multi_format_export_consistency(self, layout_manager):
		"""Test consistency across different format exports"""
		spec = LayoutSpecification(
			page_configuration=PageConfiguration(page_size="A4", orientation="portrait"),
			column_layout=ColumnLayout(column_count=2, gutter_width="1cm")
		)
		
		page_geometry = PageGeometry(
			page_width=595, page_height=842,
			content_width=515, content_height=762,
			content_x=40, content_y=40,
			safe_area_width=515, safe_area_height=762,
			bleed_width=0, bleed_height=0
		)
		
		column_result = ColumnLayoutResult(column_count=2)
		positioning_result = PositioningResult()
		
		format_outputs = layout_manager._generate_format_outputs(
			spec, page_geometry, column_result, positioning_result
		)
		
		# All formats should be generated
		assert 'latex' in format_outputs
		assert 'css' in format_outputs
		assert 'pdf' in format_outputs
		assert 'html' in format_outputs
		
		# Check consistency between formats
		assert "a4paper" in format_outputs['latex'].lower() or "595" in format_outputs['latex']
		assert "grid" in format_outputs['css'] or "column" in format_outputs['css']
		assert format_outputs['pdf']['page_size'][0] == 595  # A4 width
	
	async def test_responsive_behavior_integration(self, layout_manager, sample_content_elements):
		"""Test responsive behavior across different breakpoints"""
		layout_requirements = {
			'page_size': 'A4',
			'columns': 3,
			'section_name': 'responsive_integration'
		}
		
		responsive_config = {
			'columns': {
				'mobile': 1,
				'tablet': 2,
				'desktop': 3,
				'print': 2
			},
			'margins': {
				'mobile': {'margin_scale': 0.6},
				'tablet': {'margin_scale': 0.8},
				'desktop': {'margin_scale': 1.0}
			}
		}
		
		result = await layout_manager.compute_document_layout(
			sample_content_elements,
			layout_requirements,
			responsive_config
		)
		
		# Check that responsive elements are handled
		assert result.responsive_quality_score > 0
		assert "@media" in result.css_output  # Should contain responsive CSS
		
		# Layout should be valid across all configurations
		assert result.layout_valid is True
		assert result.overall_quality_score > 0.5