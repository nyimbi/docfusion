"""
Layout Optimizer

Automatic layout optimization for visualizations with responsive design adaptation,
spacing optimization, and multi-screen compatibility.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import logging
import math
from typing import Any, Dict, List, Optional, Union, Tuple
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field

try:
	from uuid_extensions import uuid7str
except ImportError:
	import uuid
	def uuid7str() -> str:
		return str(uuid.uuid4())

from pydantic import BaseModel, Field, ConfigDict


class LayoutType(str, Enum):
	"""Layout optimization types"""
	GRID = "grid"
	FLEX = "flex"
	RESPONSIVE = "responsive"
	DASHBOARD = "dashboard"
	MASONRY = "masonry"
	ADAPTIVE = "adaptive"


class ScreenSize(str, Enum):
	"""Target screen sizes for optimization"""
	MOBILE = "mobile"        # < 768px
	TABLET = "tablet"        # 768px - 1024px
	DESKTOP = "desktop"      # 1024px - 1440px
	LARGE_DESKTOP = "large"  # > 1440px


class OptimizationLevel(str, Enum):
	"""Layout optimization levels"""
	BASIC = "basic"
	STANDARD = "standard"
	AGGRESSIVE = "aggressive"
	CUSTOM = "custom"


@dataclass
class LayoutConstraints:
	"""Layout constraint specifications"""
	min_width: int = 320
	max_width: int = 1920
	min_height: int = 240
	max_height: int = 1080
	
	# Spacing constraints
	min_margin: int = 10
	max_margin: int = 50
	min_padding: int = 5
	max_padding: int = 30
	
	# Aspect ratio constraints
	min_aspect_ratio: float = 0.5  # height/width
	max_aspect_ratio: float = 2.0
	
	# Content density
	max_items_per_row: int = 4
	min_item_spacing: int = 15


@dataclass
class LayoutElement:
	"""Individual layout element"""
	element_id: str
	element_type: str  # chart, diagram, text, image
	width: int
	height: int
	position: Tuple[int, int] = (0, 0)
	priority: int = 1  # Higher priority elements get better placement
	flexible: bool = True  # Can be resized
	metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LayoutConfiguration:
	"""Layout optimization configuration"""
	layout_type: LayoutType = LayoutType.RESPONSIVE
	target_screens: List[ScreenSize] = field(default_factory=lambda: [ScreenSize.DESKTOP])
	optimization_level: OptimizationLevel = OptimizationLevel.STANDARD
	
	# Layout settings
	container_width: int = 1200
	container_height: int = 800
	columns: int = 12  # Grid columns (like Bootstrap)
	
	# Spacing and alignment
	margin: int = 20
	padding: int = 15
	gap: int = 20
	
	# Responsive breakpoints
	mobile_breakpoint: int = 768
	tablet_breakpoint: int = 1024
	desktop_breakpoint: int = 1440
	
	# Optimization preferences
	maintain_aspect_ratios: bool = True
	allow_element_reordering: bool = True
	prioritize_important_content: bool = True
	minimize_whitespace: bool = False


class LayoutOptimizer:
	"""
	Advanced layout optimization engine
	
	Automatically optimizes visualization layouts for different screen sizes,
	ensures proper spacing, alignment, and responsive behavior.
	"""
	
	def __init__(self):
		# Responsive breakpoint definitions
		self.breakpoints = {
			ScreenSize.MOBILE: {"max_width": 767, "columns": 1, "margin": 10},
			ScreenSize.TABLET: {"max_width": 1023, "columns": 2, "margin": 15},
			ScreenSize.DESKTOP: {"max_width": 1439, "columns": 3, "margin": 20},
			ScreenSize.LARGE_DESKTOP: {"max_width": float('inf'), "columns": 4, "margin": 25}
		}
		
		# Layout algorithm implementations
		self.layout_algorithms = {
			LayoutType.GRID: self._apply_grid_layout,
			LayoutType.FLEX: self._apply_flex_layout,
			LayoutType.RESPONSIVE: self._apply_responsive_layout,
			LayoutType.DASHBOARD: self._apply_dashboard_layout,
			LayoutType.MASONRY: self._apply_masonry_layout,
			LayoutType.ADAPTIVE: self._apply_adaptive_layout
		}
		
		# Optimization strategies
		self.optimization_strategies = self._initialize_optimization_strategies()
		
		self.logger = logging.getLogger("layout_optimizer")

	async def optimize_layout(self, elements: List[LayoutElement], 
							  config: LayoutConfiguration) -> Dict[str, Any]:
		"""
		Optimize layout for given elements and configuration
		
		Args:
			elements: List of layout elements to optimize
			config: Layout configuration and constraints
			
		Returns:
			Optimized layout with element positions and responsive variants
		"""
		try:
			# Validate elements and configuration
			await self._validate_layout_inputs(elements, config)
			
			# Apply layout algorithm
			layout_func = self.layout_algorithms.get(config.layout_type, self._apply_responsive_layout)
			optimized_elements = await layout_func(elements, config)
			
			# Generate responsive variants
			responsive_layouts = await self._generate_responsive_variants(optimized_elements, config)
			
			# Apply optimization strategies
			if config.optimization_level != OptimizationLevel.BASIC:
				optimized_elements = await self._apply_optimization_strategies(optimized_elements, config)
			
			# Calculate layout metrics
			metrics = await self._calculate_layout_metrics(optimized_elements, config)
			
			result = {
				"layout_id": uuid7str(),
				"layout_type": config.layout_type.value,
				"optimized_elements": optimized_elements,
				"responsive_layouts": responsive_layouts,
				"metrics": metrics,
				"config": config,
				"generated_at": datetime.now().isoformat(),
				"success": True
			}
			
			self.logger.info(f"Layout optimized: {config.layout_type.value} with {len(elements)} elements")
			
			return result
			
		except Exception as e:
			self.logger.error(f"Layout optimization failed: {e}")
			return {
				"layout_id": uuid7str(),
				"error": str(e),
				"success": False
			}

	async def optimize_for_screen_size(self, elements: List[LayoutElement], 
									   target_screen: ScreenSize,
									   container_width: int = None) -> Dict[str, Any]:
		"""
		Optimize layout for specific screen size
		
		Args:
			elements: Layout elements to optimize
			target_screen: Target screen size
			container_width: Override container width
			
		Returns:
			Screen-optimized layout
		"""
		breakpoint_config = self.breakpoints[target_screen]
		
		config = LayoutConfiguration(
			layout_type=LayoutType.RESPONSIVE,
			target_screens=[target_screen],
			container_width=container_width or breakpoint_config.get("max_width", 1200),
			columns=breakpoint_config.get("columns", 3),
			margin=breakpoint_config.get("margin", 20)
		)
		
		return await self.optimize_layout(elements, config)

	async def generate_dashboard_layout(self, charts: List[Dict[str, Any]], 
										config: Optional[LayoutConfiguration] = None) -> Dict[str, Any]:
		"""
		Generate optimized dashboard layout for charts
		
		Args:
			charts: List of chart configurations
			config: Layout configuration
			
		Returns:
			Dashboard layout optimization
		"""
		if not config:
			config = LayoutConfiguration(layout_type=LayoutType.DASHBOARD)
		
		# Convert charts to layout elements
		elements = []
		for i, chart in enumerate(charts):
			element = LayoutElement(
				element_id=f"chart_{i}",
				element_type="chart",
				width=chart.get("width", 400),
				height=chart.get("height", 300),
				priority=chart.get("priority", 1),
				metadata=chart
			)
			elements.append(element)
		
		return await self.optimize_layout(elements, config)

	async def calculate_optimal_spacing(self, elements: List[LayoutElement], 
										container_width: int,
										container_height: int) -> Dict[str, Any]:
		"""
		Calculate optimal spacing between elements
		
		Args:
			elements: Layout elements
			container_width: Container width
			container_height: Container height
			
		Returns:
			Optimal spacing recommendations
		"""
		total_element_width = sum(elem.width for elem in elements)
		total_element_height = sum(elem.height for elem in elements)
		
		# Calculate spacing ratios
		width_utilization = total_element_width / container_width
		height_utilization = total_element_height / container_height
		
		# Determine optimal spacing based on density
		if width_utilization > 0.8:
			horizontal_spacing = max(10, container_width * 0.02)
		else:
			horizontal_spacing = max(20, container_width * 0.03)
		
		if height_utilization > 0.8:
			vertical_spacing = max(10, container_height * 0.02)
		else:
			vertical_spacing = max(20, container_height * 0.03)
		
		return {
			"horizontal_spacing": int(horizontal_spacing),
			"vertical_spacing": int(vertical_spacing),
			"margin": int(min(horizontal_spacing, vertical_spacing)),
			"width_utilization": width_utilization,
			"height_utilization": height_utilization,
			"density_score": (width_utilization + height_utilization) / 2
		}

	async def _apply_grid_layout(self, elements: List[LayoutElement], 
								 config: LayoutConfiguration) -> List[LayoutElement]:
		"""Apply grid-based layout"""
		if not elements:
			return []
		
		# Sort elements by priority
		sorted_elements = sorted(elements, key=lambda x: x.priority, reverse=True)
		
		# Calculate grid dimensions
		cols = config.columns
		cell_width = (config.container_width - (cols + 1) * config.gap) // cols
		
		# Place elements in grid
		for i, element in enumerate(sorted_elements):
			row = i // cols
			col = i % cols
			
			x = col * (cell_width + config.gap) + config.margin
			y = row * (element.height + config.gap) + config.margin
			
			element.position = (x, y)
			
			# Resize to fit grid cell if flexible
			if element.flexible:
				element.width = min(element.width, cell_width)
		
		return sorted_elements

	async def _apply_flex_layout(self, elements: List[LayoutElement], 
								 config: LayoutConfiguration) -> List[LayoutElement]:
		"""Apply flexible layout algorithm"""
		if not elements:
			return []
		
		# Sort by priority and size
		sorted_elements = sorted(elements, key=lambda x: (x.priority, x.width * x.height), reverse=True)
		
		current_row_width = 0
		current_row_height = 0
		current_y = config.margin
		row_elements = []
		
		for element in sorted_elements:
			# Check if element fits in current row
			if current_row_width + element.width + config.gap <= config.container_width - config.margin:
				# Add to current row
				element.position = (current_row_width + config.margin, current_y)
				current_row_width += element.width + config.gap
				current_row_height = max(current_row_height, element.height)
				row_elements.append(element)
			else:
				# Start new row
				current_y += current_row_height + config.gap
				current_row_width = element.width + config.gap
				current_row_height = element.height
				element.position = (config.margin, current_y)
				row_elements = [element]
		
		return sorted_elements

	async def _apply_responsive_layout(self, elements: List[LayoutElement], 
									   config: LayoutConfiguration) -> List[LayoutElement]:
		"""Apply responsive layout with breakpoint adaptation"""
		# Determine current screen category based on container width
		screen_size = self._determine_screen_size(config.container_width)
		breakpoint_config = self.breakpoints[screen_size]
		
		# Adjust configuration for screen size
		adapted_config = LayoutConfiguration(
			layout_type=LayoutType.GRID,
			container_width=config.container_width,
			container_height=config.container_height,
			columns=breakpoint_config["columns"],
			margin=breakpoint_config["margin"],
			gap=max(10, config.gap // 2) if screen_size == ScreenSize.MOBILE else config.gap
		)
		
		return await self._apply_grid_layout(elements, adapted_config)

	async def _apply_dashboard_layout(self, elements: List[LayoutElement], 
									  config: LayoutConfiguration) -> List[LayoutElement]:
		"""Apply dashboard-optimized layout"""
		if not elements:
			return []
		
		# Separate elements by priority and type
		high_priority = [e for e in elements if e.priority >= 3]
		medium_priority = [e for e in elements if e.priority == 2]
		low_priority = [e for e in elements if e.priority <= 1]
		
		positioned_elements = []
		current_y = config.margin
		
		# Place high priority elements first (larger, prominent positions)
		for element in high_priority:
			element.position = (config.margin, current_y)
			if element.flexible:
				element.width = min(element.width, config.container_width - 2 * config.margin)
			current_y += element.height + config.gap
			positioned_elements.append(element)
		
		# Place medium priority elements in a row
		current_x = config.margin
		max_height = 0
		
		for element in medium_priority:
			if current_x + element.width <= config.container_width - config.margin:
				element.position = (current_x, current_y)
				current_x += element.width + config.gap
				max_height = max(max_height, element.height)
				positioned_elements.append(element)
		
		if medium_priority:
			current_y += max_height + config.gap
		
		# Place remaining elements in grid
		remaining = low_priority
		cols = min(3, len(remaining))
		if cols > 0:
			cell_width = (config.container_width - (cols + 1) * config.gap) // cols
			
			for i, element in enumerate(remaining):
				row = i // cols
				col = i % cols
				
				x = col * (cell_width + config.gap) + config.margin
				y = current_y + row * (element.height + config.gap)
				
				element.position = (x, y)
				if element.flexible:
					element.width = min(element.width, cell_width)
				positioned_elements.append(element)
		
		return positioned_elements

	async def _apply_masonry_layout(self, elements: List[LayoutElement], 
									config: LayoutConfiguration) -> List[LayoutElement]:
		"""Apply masonry/Pinterest-style layout"""
		if not elements:
			return []
		
		cols = config.columns
		cell_width = (config.container_width - (cols + 1) * config.gap) // cols
		
		# Initialize column heights
		column_heights = [config.margin] * cols
		
		# Sort elements by priority
		sorted_elements = sorted(elements, key=lambda x: x.priority, reverse=True)
		
		for element in sorted_elements:
			# Find shortest column
			shortest_col = column_heights.index(min(column_heights))
			
			# Position element
			x = shortest_col * (cell_width + config.gap) + config.margin
			y = column_heights[shortest_col]
			
			element.position = (x, y)
			
			# Resize if flexible
			if element.flexible:
				element.width = min(element.width, cell_width)
			
			# Update column height
			column_heights[shortest_col] += element.height + config.gap
		
		return sorted_elements

	async def _apply_adaptive_layout(self, elements: List[LayoutElement], 
									 config: LayoutConfiguration) -> List[LayoutElement]:
		"""Apply adaptive layout that chooses best algorithm"""
		# Analyze elements to determine best layout approach
		analysis = await self._analyze_elements(elements)
		
		if analysis["has_varying_sizes"] and analysis["element_count"] > 6:
			return await self._apply_masonry_layout(elements, config)
		elif analysis["has_high_priority_elements"]:
			return await self._apply_dashboard_layout(elements, config)
		elif analysis["aspect_ratios_similar"]:
			return await self._apply_grid_layout(elements, config)
		else:
			return await self._apply_flex_layout(elements, config)

	async def _generate_responsive_variants(self, elements: List[LayoutElement], 
											config: LayoutConfiguration) -> Dict[str, List[LayoutElement]]:
		"""Generate layout variants for different screen sizes"""
		variants = {}
		
		for screen_size in [ScreenSize.MOBILE, ScreenSize.TABLET, ScreenSize.DESKTOP, ScreenSize.LARGE_DESKTOP]:
			if screen_size in config.target_screens:
				breakpoint_config = self.breakpoints[screen_size]
				
				# Create adapted configuration
				variant_config = LayoutConfiguration(
					layout_type=config.layout_type,
					container_width=breakpoint_config.get("max_width", config.container_width),
					columns=breakpoint_config.get("columns", config.columns),
					margin=breakpoint_config.get("margin", config.margin),
					gap=config.gap
				)
				
				# Apply layout for this screen size
				variant_elements = await self._apply_responsive_layout(elements.copy(), variant_config)
				variants[screen_size.value] = variant_elements
		
		return variants

	async def _apply_optimization_strategies(self, elements: List[LayoutElement], 
											 config: LayoutConfiguration) -> List[LayoutElement]:
		"""Apply layout optimization strategies"""
		if config.optimization_level == OptimizationLevel.BASIC:
			return elements
		
		# Strategy 1: Minimize overlaps
		elements = await self._eliminate_overlaps(elements)
		
		# Strategy 2: Optimize spacing
		if not config.minimize_whitespace:
			elements = await self._optimize_spacing(elements, config)
		
		# Strategy 3: Balance visual weight
		if config.optimization_level in [OptimizationLevel.AGGRESSIVE, OptimizationLevel.CUSTOM]:
			elements = await self._balance_visual_weight(elements, config)
		
		return elements

	async def _eliminate_overlaps(self, elements: List[LayoutElement]) -> List[LayoutElement]:
		"""Eliminate overlapping elements"""
		for i, elem1 in enumerate(elements):
			for j, elem2 in enumerate(elements[i+1:], i+1):
				if self._elements_overlap(elem1, elem2):
					# Move the lower priority element
					if elem1.priority >= elem2.priority:
						elem2.position = self._find_non_overlapping_position(elem2, elements[:j])
					else:
						elem1.position = self._find_non_overlapping_position(elem1, elements[:i])
		
		return elements

	async def _optimize_spacing(self, elements: List[LayoutElement], 
								config: LayoutConfiguration) -> List[LayoutElement]:
		"""Optimize spacing between elements"""
		# Calculate optimal spacing
		spacing_info = await self.calculate_optimal_spacing(
			elements, config.container_width, config.container_height
		)
		
		# Apply optimal spacing if significantly different
		if abs(spacing_info["horizontal_spacing"] - config.gap) > 5:
			# Re-layout with optimal spacing
			optimal_config = config
			optimal_config.gap = int(spacing_info["horizontal_spacing"])
			
			layout_func = self.layout_algorithms.get(config.layout_type, self._apply_responsive_layout)
			return await layout_func(elements, optimal_config)
		
		return elements

	async def _balance_visual_weight(self, elements: List[LayoutElement], 
									 config: LayoutConfiguration) -> List[LayoutElement]:
		"""Balance visual weight across the layout"""
		# Calculate visual weight for each quadrant
		quadrant_weights = self._calculate_quadrant_weights(elements, config)
		
		# If imbalanced, adjust positions
		max_weight = max(quadrant_weights.values())
		min_weight = min(quadrant_weights.values())
		
		if max_weight > min_weight * 2:  # Significant imbalance
			# Move elements from heavy to light quadrants
			elements = await self._redistribute_visual_weight(elements, quadrant_weights, config)
		
		return elements

	async def _calculate_layout_metrics(self, elements: List[LayoutElement], 
										config: LayoutConfiguration) -> Dict[str, Any]:
		"""Calculate layout quality metrics"""
		if not elements:
			return {"error": "No elements to analyze"}
		
		# Calculate coverage
		total_element_area = sum(elem.width * elem.height for elem in elements)
		container_area = config.container_width * config.container_height
		coverage = total_element_area / container_area if container_area > 0 else 0
		
		# Calculate alignment score
		alignment_score = await self._calculate_alignment_score(elements)
		
		# Calculate spacing consistency
		spacing_consistency = await self._calculate_spacing_consistency(elements)
		
		# Calculate visual balance
		balance_score = await self._calculate_visual_balance(elements, config)
		
		# Calculate overlap penalty
		overlap_penalty = await self._calculate_overlap_penalty(elements)
		
		# Overall quality score
		quality_score = (
			coverage * 0.25 + 
			alignment_score * 0.25 + 
			spacing_consistency * 0.2 + 
			balance_score * 0.2 + 
			(1 - overlap_penalty) * 0.1
		)
		
		return {
			"coverage": coverage,
			"alignment_score": alignment_score,
			"spacing_consistency": spacing_consistency,
			"balance_score": balance_score,
			"overlap_penalty": overlap_penalty,
			"quality_score": quality_score,
			"element_count": len(elements),
			"total_area": total_element_area,
			"container_utilization": coverage
		}

	async def _validate_layout_inputs(self, elements: List[LayoutElement], 
									  config: LayoutConfiguration):
		"""Validate layout inputs"""
		if not elements:
			raise ValueError("No elements provided for layout optimization")
		
		if config.container_width <= 0 or config.container_height <= 0:
			raise ValueError("Invalid container dimensions")
		
		for element in elements:
			if element.width <= 0 or element.height <= 0:
				raise ValueError(f"Invalid element dimensions for {element.element_id}")

	def _determine_screen_size(self, width: int) -> ScreenSize:
		"""Determine screen size category from width"""
		if width < 768:
			return ScreenSize.MOBILE
		elif width < 1024:
			return ScreenSize.TABLET
		elif width < 1440:
			return ScreenSize.DESKTOP
		else:
			return ScreenSize.LARGE_DESKTOP

	def _elements_overlap(self, elem1: LayoutElement, elem2: LayoutElement) -> bool:
		"""Check if two elements overlap"""
		x1, y1 = elem1.position
		x2, y2 = elem2.position
		
		return not (
			x1 + elem1.width <= x2 or
			x2 + elem2.width <= x1 or
			y1 + elem1.height <= y2 or
			y2 + elem2.height <= y1
		)

	def _find_non_overlapping_position(self, element: LayoutElement, 
									   existing_elements: List[LayoutElement]) -> Tuple[int, int]:
		"""Find a position where element doesn't overlap with existing ones"""
		x, y = element.position
		
		# Try positions in expanding spiral from current position
		for radius in range(1, 100, 10):
			for angle in range(0, 360, 30):
				new_x = x + int(radius * math.cos(math.radians(angle)))
				new_y = y + int(radius * math.sin(math.radians(angle)))
				
				# Check bounds
				if new_x < 0 or new_y < 0:
					continue
				
				# Create temporary element to test position
				test_element = LayoutElement(
					element_id="test",
					element_type=element.element_type,
					width=element.width,
					height=element.height,
					position=(new_x, new_y)
				)
				
				# Check for overlaps
				overlaps = any(self._elements_overlap(test_element, existing) 
							  for existing in existing_elements)
				
				if not overlaps:
					return (new_x, new_y)
		
		# If no position found, return original with offset
		return (x + 20, y + 20)

	def _calculate_quadrant_weights(self, elements: List[LayoutElement], 
									config: LayoutConfiguration) -> Dict[str, float]:
		"""Calculate visual weight in each quadrant"""
		mid_x = config.container_width / 2
		mid_y = config.container_height / 2
		
		quadrants = {"tl": 0, "tr": 0, "bl": 0, "br": 0}
		
		for element in elements:
			x, y = element.position
			weight = element.width * element.height * element.priority
			
			if x < mid_x and y < mid_y:
				quadrants["tl"] += weight
			elif x >= mid_x and y < mid_y:
				quadrants["tr"] += weight
			elif x < mid_x and y >= mid_y:
				quadrants["bl"] += weight
			else:
				quadrants["br"] += weight
		
		return quadrants

	async def _redistribute_visual_weight(self, elements: List[LayoutElement], 
										  quadrant_weights: Dict[str, float],
										  config: LayoutConfiguration) -> List[LayoutElement]:
		"""Redistribute elements for better visual balance"""
		# Find heaviest and lightest quadrants
		heaviest = max(quadrant_weights, key=quadrant_weights.get)
		lightest = min(quadrant_weights, key=quadrant_weights.get)
		
		# Move some elements from heaviest to lightest quadrant
		# This is a simplified implementation
		mid_x = config.container_width / 2
		mid_y = config.container_height / 2
		
		for element in elements:
			x, y = element.position
			current_quadrant = self._get_element_quadrant(element, mid_x, mid_y)
			
			if current_quadrant == heaviest and element.priority <= 2:
				# Move to lightest quadrant
				new_position = self._get_quadrant_position(lightest, mid_x, mid_y, element)
				element.position = new_position
				break  # Move one element at a time
		
		return elements

	def _get_element_quadrant(self, element: LayoutElement, mid_x: float, mid_y: float) -> str:
		"""Get quadrant of an element"""
		x, y = element.position
		
		if x < mid_x and y < mid_y:
			return "tl"
		elif x >= mid_x and y < mid_y:
			return "tr"
		elif x < mid_x and y >= mid_y:
			return "bl"
		else:
			return "br"

	def _get_quadrant_position(self, quadrant: str, mid_x: float, mid_y: float, 
							   element: LayoutElement) -> Tuple[int, int]:
		"""Get a position within specified quadrant"""
		if quadrant == "tl":
			return (int(mid_x * 0.25), int(mid_y * 0.25))
		elif quadrant == "tr":
			return (int(mid_x * 1.25), int(mid_y * 0.25))
		elif quadrant == "bl":
			return (int(mid_x * 0.25), int(mid_y * 1.25))
		else:  # br
			return (int(mid_x * 1.25), int(mid_y * 1.25))

	async def _calculate_alignment_score(self, elements: List[LayoutElement]) -> float:
		"""Calculate how well elements are aligned"""
		if len(elements) < 2:
			return 1.0
		
		# Check for common alignments (left, right, top, bottom)
		left_edges = [elem.position[0] for elem in elements]
		right_edges = [elem.position[0] + elem.width for elem in elements]
		top_edges = [elem.position[1] for elem in elements]
		bottom_edges = [elem.position[1] + elem.height for elem in elements]
		
		# Count aligned elements (within tolerance)
		tolerance = 10
		aligned_count = 0
		
		for edges in [left_edges, right_edges, top_edges, bottom_edges]:
			edge_groups = {}
			for edge in edges:
				group_key = edge // tolerance  # Group by tolerance range
				edge_groups[group_key] = edge_groups.get(group_key, 0) + 1
			
			# Add score for groups with multiple elements
			for count in edge_groups.values():
				if count > 1:
					aligned_count += count - 1
		
		# Normalize by maximum possible alignments
		max_alignments = len(elements) * 4  # 4 edges per element
		return min(1.0, aligned_count / max_alignments)

	async def _calculate_spacing_consistency(self, elements: List[LayoutElement]) -> float:
		"""Calculate consistency of spacing between elements"""
		if len(elements) < 2:
			return 1.0
		
		# Calculate all pairwise distances
		distances = []
		for i, elem1 in enumerate(elements):
			for elem2 in elements[i+1:]:
				x1, y1 = elem1.position
				x2, y2 = elem2.position
				distance = math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
				distances.append(distance)
		
		if not distances:
			return 1.0
		
		# Calculate coefficient of variation (lower is more consistent)
		mean_distance = sum(distances) / len(distances)
		variance = sum((d - mean_distance)**2 for d in distances) / len(distances)
		std_dev = math.sqrt(variance)
		
		if mean_distance == 0:
			return 1.0
		
		coefficient_of_variation = std_dev / mean_distance
		
		# Convert to score (0 to 1, where 1 is perfectly consistent)
		return max(0.0, 1.0 - min(1.0, coefficient_of_variation))

	async def _calculate_visual_balance(self, elements: List[LayoutElement], 
									   config: LayoutConfiguration) -> float:
		"""Calculate visual balance of the layout"""
		quadrant_weights = self._calculate_quadrant_weights(elements, config)
		
		if not any(quadrant_weights.values()):
			return 1.0
		
		# Calculate balance as inverse of weight variance
		weights = list(quadrant_weights.values())
		mean_weight = sum(weights) / len(weights)
		
		if mean_weight == 0:
			return 1.0
		
		variance = sum((w - mean_weight)**2 for w in weights) / len(weights)
		coefficient_of_variation = math.sqrt(variance) / mean_weight
		
		# Convert to balance score (0 to 1)
		return max(0.0, 1.0 - min(1.0, coefficient_of_variation))

	async def _calculate_overlap_penalty(self, elements: List[LayoutElement]) -> float:
		"""Calculate penalty for overlapping elements"""
		if len(elements) < 2:
			return 0.0
		
		overlap_count = 0
		total_pairs = 0
		
		for i, elem1 in enumerate(elements):
			for elem2 in elements[i+1:]:
				total_pairs += 1
				if self._elements_overlap(elem1, elem2):
					overlap_count += 1
		
		return overlap_count / total_pairs if total_pairs > 0 else 0.0

	async def _analyze_elements(self, elements: List[LayoutElement]) -> Dict[str, Any]:
		"""Analyze element characteristics for adaptive layout"""
		if not elements:
			return {}
		
		sizes = [(elem.width, elem.height) for elem in elements]
		aspect_ratios = [w/h for w, h in sizes if h > 0]
		priorities = [elem.priority for elem in elements]
		
		# Calculate variations
		size_variation = len(set(sizes)) / len(sizes) if sizes else 0
		aspect_ratio_variation = (max(aspect_ratios) - min(aspect_ratios)) if aspect_ratios else 0
		
		return {
			"element_count": len(elements),
			"has_varying_sizes": size_variation > 0.5,
			"aspect_ratios_similar": aspect_ratio_variation < 0.5,
			"has_high_priority_elements": max(priorities) >= 3 if priorities else False,
			"average_size": sum(w*h for w, h in sizes) / len(sizes) if sizes else 0
		}

	def _initialize_optimization_strategies(self) -> Dict[str, Any]:
		"""Initialize optimization strategies"""
		return {
			"minimize_overlaps": True,
			"optimize_spacing": True,
			"balance_visual_weight": True,
			"maintain_aspect_ratios": True,
			"prioritize_important_content": True,
			"responsive_breakpoints": True
		}