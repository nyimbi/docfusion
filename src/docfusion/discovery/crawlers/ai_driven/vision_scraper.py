#!/usr/bin/env python3
"""
Vision-Based Web Scraper

Advanced computer vision scraper that analyzes webpage screenshots to:
- Detect UI elements and layout structures
- Identify tables, forms, and content blocks
- Extract text using OCR when needed
- Understand visual patterns and relationships
- Handle dynamic content and complex layouts
"""

import asyncio
import cv2
import numpy as np
import logging
import json
import time
from typing import Dict, List, Optional, Any, Tuple, NamedTuple
from datetime import datetime, timezone
from pathlib import Path
import tempfile
import base64
from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFont
import io

try:
	import pytesseract
	HAS_TESSERACT = True
except ImportError:
	HAS_TESSERACT = False
	pytesseract = None

from playwright.async_api import async_playwright, Page, Browser, BrowserContext

from ..generic.base_scraper import BaseScraper, ScrapingResult, ScrapingStatus, ScrapingConfiguration
from ....core.utils import uuid7str
from pydantic import BaseModel, Field


class BoundingBox(NamedTuple):
	"""Represents a bounding box in image coordinates"""
	x: int
	y: int
	width: int
	height: int
	
	@property
	def center(self) -> Tuple[int, int]:
		return (self.x + self.width // 2, self.y + self.height // 2)
	
	@property
	def area(self) -> int:
		return self.width * self.height


class UIElement(BaseModel):
	"""Represents a detected UI element"""
	element_id: str = Field(default_factory=uuid7str)
	element_type: str  # button, link, text, image, table, form, etc.
	bounding_box: BoundingBox
	confidence: float = 0.0
	
	# Content
	text_content: Optional[str] = None
	ocr_text: Optional[str] = None
	
	# Visual properties
	background_color: Optional[Tuple[int, int, int]] = None
	text_color: Optional[Tuple[int, int, int]] = None
	has_border: bool = False
	is_clickable: bool = False
	
	# Relationships
	parent_element: Optional[str] = None
	child_elements: List[str] = Field(default_factory=list)
	
	# Metadata
	css_selector: Optional[str] = None
	xpath: Optional[str] = None
	dom_attributes: Dict[str, str] = Field(default_factory=dict)


class VisualPattern(BaseModel):
	"""Represents a detected visual pattern"""
	pattern_id: str = Field(default_factory=uuid7str)
	pattern_type: str  # grid, list, table, card, form, navigation
	elements: List[str] = Field(default_factory=list)  # element IDs
	bounding_box: BoundingBox
	confidence: float = 0.0
	
	# Pattern properties
	repetition_count: int = 0
	spacing_consistency: float = 0.0  # 0-1, how consistent the spacing is
	alignment_quality: float = 0.0    # 0-1, how well aligned elements are
	
	# Content type hints
	likely_content_type: Optional[str] = None  # opportunities, navigation, etc.
	extraction_priority: int = 0  # Higher = more likely to contain opportunities


class VisionAnalysisResult(BaseModel):
	"""Result of vision-based analysis"""
	analysis_id: str = Field(default_factory=uuid7str)
	screenshot_path: Optional[str] = None
	
	# Detected elements
	ui_elements: List[UIElement] = Field(default_factory=list)
	visual_patterns: List[VisualPattern] = Field(default_factory=list)
	
	# Analysis metrics
	total_elements_detected: int = 0
	patterns_detected: int = 0
	ocr_regions_processed: int = 0
	
	# Content extraction
	opportunities_found: List[Dict[str, Any]] = Field(default_factory=list)
	
	# Quality metrics
	analysis_confidence: float = 0.0
	processing_time: float = 0.0
	
	# Errors and warnings
	errors: List[str] = Field(default_factory=list)
	warnings: List[str] = Field(default_factory=list)


class VisionScraper(BaseScraper):
	"""
	Computer vision-based web scraper that analyzes page layouts visually
	"""
	
	def __init__(self, config: Optional[ScrapingConfiguration] = None):
		super().__init__(config)
		self.logger = logging.getLogger(__name__)
		
		# Playwright components
		self.playwright = None
		self.browser: Optional[Browser] = None
		
		# Vision analysis components
		self.cascade_classifier = None  # For face/object detection if needed
		self.text_detector = None       # EAST text detector
		
		# OCR configuration
		self.tesseract_config = r'--oem 3 --psm 6'
		
		# Element detection parameters
		self.element_detection_params = {
			'min_contour_area': 100,
			'max_contour_area': 50000,
			'canny_lower': 50,
			'canny_upper': 150,
			'dilate_kernel_size': 3,
			'erode_kernel_size': 2
		}
		
		# Pattern recognition parameters
		self.pattern_params = {
			'min_pattern_elements': 3,
			'max_spacing_variance': 0.3,  # 30% variance allowed
			'min_alignment_score': 0.7,   # 70% alignment required
			'grid_detection_threshold': 0.8
		}
		
		# Performance tracking
		self.vision_stats = {
			'total_analyses': 0,
			'successful_analyses': 0,
			'elements_detected': 0,
			'patterns_recognized': 0,
			'ocr_operations': 0,
			'average_processing_time': 0.0
		}
	
	async def initialize(self):
		"""Initialize vision scraper components"""
		try:
			# Initialize Playwright
			self.playwright = await async_playwright().start()
			self.browser = await self.playwright.chromium.launch(
				headless=True,
				args=[
					'--no-sandbox',
					'--disable-blink-features=AutomationControlled',
					'--disable-extensions'
				]
			)
			
			# Initialize OpenCV components
			self._initialize_cv_components()
			
			self.logger.info("VisionScraper initialized successfully")
			
		except Exception as e:
			self.logger.error(f"Failed to initialize VisionScraper: {e}")
			raise
	
	def _initialize_cv_components(self):
		"""Initialize computer vision components"""
		try:
			# You can add more sophisticated CV models here
			# For now, we'll use basic OpenCV functionality
			pass
			
		except Exception as e:
			self.logger.warning(f"Some CV components failed to initialize: {e}")
	
	async def analyze_page_visually(
		self,
		url: str,
		full_page_screenshot: bool = True,
		detect_patterns: bool = True,
		perform_ocr: bool = False
	) -> Tuple[ScrapingResult, VisionAnalysisResult]:
		"""
		Perform comprehensive visual analysis of a webpage
		"""
		start_time = time.time()
		analysis_result = VisionAnalysisResult()
		
		context = None
		page = None
		
		try:
			# Create browser context with realistic settings
			context = await self.browser.new_context(
				viewport={'width': 1920, 'height': 1080},
				user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
			)
			
			page = await context.new_page()
			
			# Navigate to page
			response = await page.goto(url, wait_until='domcontentloaded', timeout=30000)
			await page.wait_for_load_state('networkidle', timeout=10000)
			
			# Take screenshot
			screenshot_bytes = await page.screenshot(
				full_page=full_page_screenshot,
				type='png'
			)
			
			# Save screenshot for analysis
			screenshot_path = await self._save_screenshot(screenshot_bytes, url)
			analysis_result.screenshot_path = screenshot_path
			
			# Convert to OpenCV format
			image = Image.open(io.BytesIO(screenshot_bytes))
			cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
			
			# Perform visual analysis
			await self._detect_ui_elements(cv_image, analysis_result)
			
			if detect_patterns:
				await self._detect_visual_patterns(analysis_result)
			
			if perform_ocr:
				await self._perform_ocr_analysis(cv_image, analysis_result)
			
			# Map visual elements to DOM elements
			dom_mapping = await self._map_visual_to_dom(page, analysis_result)
			
			# Extract opportunities based on visual analysis
			opportunities = await self._extract_opportunities_from_vision(
				analysis_result, dom_mapping, page
			)
			analysis_result.opportunities_found = opportunities
			
			# Calculate analysis confidence
			analysis_result.analysis_confidence = self._calculate_analysis_confidence(analysis_result)
			
			# Create scraping result
			html_content = await page.content()
			scraping_result = ScrapingResult(
				url=url,
				status=ScrapingStatus.SUCCESS,
				status_code=response.status if response else 200,
				html_content=html_content
			)
			
			# Update statistics
			self.vision_stats['total_analyses'] += 1
			if len(opportunities) > 0:
				self.vision_stats['successful_analyses'] += 1
			self.vision_stats['elements_detected'] += len(analysis_result.ui_elements)
			self.vision_stats['patterns_recognized'] += len(analysis_result.visual_patterns)
			
			analysis_result.processing_time = time.time() - start_time
			self.vision_stats['average_processing_time'] = (
				(self.vision_stats['average_processing_time'] * 
				 (self.vision_stats['total_analyses'] - 1) + analysis_result.processing_time) /
				self.vision_stats['total_analyses']
			)
			
			return scraping_result, analysis_result
			
		except Exception as e:
			self.logger.error(f"Vision analysis failed for {url}: {e}")
			analysis_result.errors.append(str(e))
			
			return ScrapingResult(
				url=url,
				status=ScrapingStatus.FAILED,
				error_message=str(e)
			), analysis_result
		
		finally:
			if page:
				await page.close()
			if context:
				await context.close()
	
	async def _save_screenshot(self, screenshot_bytes: bytes, url: str) -> str:
		"""Save screenshot to temporary file"""
		try:
			# Create temp file with meaningful name
			url_hash = abs(hash(url)) % 10000
			temp_file = tempfile.NamedTemporaryFile(
				suffix=f'_screenshot_{url_hash}.png',
				delete=False
			)
			
			temp_file.write(screenshot_bytes)
			temp_file.close()
			
			return temp_file.name
			
		except Exception as e:
			self.logger.warning(f"Failed to save screenshot: {e}")
			return ""
	
	async def _detect_ui_elements(self, cv_image: np.ndarray, analysis_result: VisionAnalysisResult):
		"""Detect UI elements using computer vision"""
		try:
			# Convert to grayscale for processing
			gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
			
			# Edge detection
			edges = cv2.Canny(
				gray,
				self.element_detection_params['canny_lower'],
				self.element_detection_params['canny_upper']
			)
			
			# Morphological operations to connect nearby edges
			kernel = np.ones((self.element_detection_params['dilate_kernel_size'], 
							self.element_detection_params['dilate_kernel_size']), np.uint8)
			dilated = cv2.dilate(edges, kernel, iterations=1)
			
			kernel = np.ones((self.element_detection_params['erode_kernel_size'],
							self.element_detection_params['erode_kernel_size']), np.uint8)
			processed = cv2.erode(dilated, kernel, iterations=1)
			
			# Find contours
			contours, _ = cv2.findContours(processed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
			
			# Process contours to identify UI elements
			for i, contour in enumerate(contours):
				area = cv2.contourArea(contour)
				
				# Filter by area
				if (self.element_detection_params['min_contour_area'] < area < 
					self.element_detection_params['max_contour_area']):
					
					# Get bounding rectangle
					x, y, w, h = cv2.boundingRect(contour)
					bounding_box = BoundingBox(x, y, w, h)
					
					# Classify element type based on shape and size
					element_type = self._classify_element_by_shape(w, h, area, contour)
					
					# Extract visual properties
					roi = cv_image[y:y+h, x:x+w]
					bg_color, text_color = self._analyze_colors(roi)
					has_border = self._detect_border(roi)
					
					# Create UI element
					ui_element = UIElement(
						element_type=element_type,
						bounding_box=bounding_box,
						confidence=self._calculate_element_confidence(contour, area),
						background_color=bg_color,
						text_color=text_color,
						has_border=has_border,
						is_clickable=self._is_likely_clickable(element_type, has_border)
					)
					
					analysis_result.ui_elements.append(ui_element)
			
			analysis_result.total_elements_detected = len(analysis_result.ui_elements)
			self.logger.debug(f"Detected {len(analysis_result.ui_elements)} UI elements")
			
		except Exception as e:
			analysis_result.errors.append(f"UI element detection failed: {str(e)}")
			self.logger.error(f"UI element detection failed: {e}")
	
	def _classify_element_by_shape(
		self, 
		width: int, 
		height: int, 
		area: int, 
		contour: np.ndarray
	) -> str:
		"""Classify UI element based on its shape and size characteristics"""
		aspect_ratio = width / height if height > 0 else 1
		
		# Calculate perimeter and compactness
		perimeter = cv2.arcLength(contour, True)
		compactness = 4 * np.pi * area / (perimeter * perimeter) if perimeter > 0 else 0
		
		# Button detection (rectangular, medium size, good compactness)
		if (0.2 < aspect_ratio < 5 and 
			1000 < area < 10000 and 
			compactness > 0.3):
			return "button"
		
		# Link detection (horizontal, small height)
		elif (aspect_ratio > 2 and 
			  height < 50 and 
			  500 < area < 5000):
			return "link"
		
		# Text block detection (wide, variable height)
		elif (aspect_ratio > 1.5 and 
			  area > 2000):
			return "text_block"
		
		# Image detection (more square, larger area)
		elif (0.3 < aspect_ratio < 3 and 
			  area > 5000):
			return "image"
		
		# Table cell detection (rectangular, medium size)
		elif (0.5 < aspect_ratio < 4 and 
			  compactness > 0.6):
			return "table_cell"
		
		# Form field detection (horizontal rectangle, consistent size)
		elif (1.5 < aspect_ratio < 8 and 
			  1000 < area < 8000 and
			  20 < height < 100):
			return "form_field"
		
		# Default classification
		else:
			return "container"
	
	def _analyze_colors(self, roi: np.ndarray) -> Tuple[Optional[Tuple[int, int, int]], Optional[Tuple[int, int, int]]]:
		"""Analyze dominant colors in a region of interest"""
		try:
			if roi.size == 0:
				return None, None
			
			# Calculate dominant background color
			roi_mean = np.mean(roi, axis=(0, 1))
			bg_color = tuple(int(c) for c in roi_mean)
			
			# Estimate text color (opposite of background)
			brightness = sum(bg_color) / 3
			text_color = (0, 0, 0) if brightness > 127 else (255, 255, 255)
			
			return bg_color, text_color
			
		except Exception as e:
			self.logger.warning(f"Failed to extract button colors: {e}")
			return None, None
	
	def _detect_border(self, roi: np.ndarray) -> bool:
		"""Detect if a region has a border"""
		try:
			if roi.size == 0:
				return False
			
			gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
			edges = cv2.Canny(gray_roi, 100, 200)
			
			# Check edges along the border
			top_edge = np.sum(edges[0:2, :])
			bottom_edge = np.sum(edges[-2:, :])
			left_edge = np.sum(edges[:, 0:2])
			right_edge = np.sum(edges[:, -2:])
			
			# If any edge has significant edge pixels, it likely has a border
			threshold = roi.shape[1] * 0.3  # 30% of width/height
			return any(edge > threshold for edge in [top_edge, bottom_edge, left_edge, right_edge])
			
		except Exception as e:
			self.logger.warning(f"Failed to detect border: {e}")
			return False
	
	def _calculate_element_confidence(self, contour: np.ndarray, area: int) -> float:
		"""Calculate confidence score for detected element"""
		try:
			# Base confidence on contour properties
			perimeter = cv2.arcLength(contour, True)
			if perimeter == 0:
				return 0.0
			
			# Compactness (how close to a perfect shape)
			compactness = 4 * np.pi * area / (perimeter * perimeter)
			compactness_score = min(1.0, compactness)
			
			# Solidity (how "filled" the shape is)
			hull = cv2.convexHull(contour)
			hull_area = cv2.contourArea(hull)
			solidity = area / hull_area if hull_area > 0 else 0
			
			# Size appropriateness (medium sizes are more likely to be UI elements)
			size_score = 1.0
			if area < 500:
				size_score = 0.5  # Too small
			elif area > 20000:
				size_score = 0.7  # Quite large
			
			# Combine scores
			confidence = (compactness_score * 0.4 + solidity * 0.4 + size_score * 0.2)
			return min(1.0, max(0.0, confidence))
			
		except Exception as e:
			self.logger.warning(f"Failed to calculate element confidence: {e}")
			return 0.5  # Default confidence
	
	def _is_likely_clickable(self, element_type: str, has_border: bool) -> bool:
		"""Determine if an element is likely clickable"""
		clickable_types = {'button', 'link', 'form_field'}
		return element_type in clickable_types or has_border
	
	async def _detect_visual_patterns(self, analysis_result: VisionAnalysisResult):
		"""Detect visual patterns in the UI elements"""
		try:
			elements = analysis_result.ui_elements
			if len(elements) < self.pattern_params['min_pattern_elements']:
				return
			
			# Group elements by type and spatial relationship
			patterns = []
			
			# Detect grid patterns
			grid_patterns = self._detect_grid_patterns(elements)
			patterns.extend(grid_patterns)
			
			# Detect list patterns
			list_patterns = self._detect_list_patterns(elements)
			patterns.extend(list_patterns)
			
			# Detect form patterns
			form_patterns = self._detect_form_patterns(elements)
			patterns.extend(form_patterns)
			
			# Detect navigation patterns
			nav_patterns = self._detect_navigation_patterns(elements)
			patterns.extend(nav_patterns)
			
			analysis_result.visual_patterns = patterns
			analysis_result.patterns_detected = len(patterns)
			
			self.logger.debug(f"Detected {len(patterns)} visual patterns")
			
		except Exception as e:
			analysis_result.errors.append(f"Pattern detection failed: {str(e)}")
			self.logger.error(f"Pattern detection failed: {e}")
	
	def _detect_grid_patterns(self, elements: List[UIElement]) -> List[VisualPattern]:
		"""Detect grid-like arrangements of elements"""
		patterns = []
		
		try:
			# Group elements by Y coordinate (rows)
			rows = {}
			tolerance = 20  # Pixel tolerance for alignment
			
			for element in elements:
				y_center = element.bounding_box.center[1]
				
				# Find existing row or create new one
				row_found = False
				for row_y in rows:
					if abs(row_y - y_center) <= tolerance:
						rows[row_y].append(element)
						row_found = True
						break
				
				if not row_found:
					rows[y_center] = [element]
			
			# Analyze rows for grid patterns
			for row_y, row_elements in rows.items():
				if len(row_elements) >= self.pattern_params['min_pattern_elements']:
					# Sort by X coordinate
					row_elements.sort(key=lambda e: e.bounding_box.x)
					
					# Check for consistent spacing
					if len(row_elements) > 1:
						spacings = []
						for i in range(1, len(row_elements)):
							spacing = (row_elements[i].bounding_box.x - 
									 (row_elements[i-1].bounding_box.x + row_elements[i-1].bounding_box.width))
							spacings.append(spacing)
						
						# Calculate spacing consistency
						if spacings:
							avg_spacing = sum(spacings) / len(spacings)
							spacing_variance = sum((s - avg_spacing) ** 2 for s in spacings) / len(spacings)
							spacing_std = (spacing_variance ** 0.5) if spacing_variance > 0 else 0
							consistency = 1.0 - min(1.0, spacing_std / (avg_spacing + 1))
							
							if consistency >= self.pattern_params['max_spacing_variance']:
								# Calculate bounding box for the pattern
								min_x = min(e.bounding_box.x for e in row_elements)
								max_x = max(e.bounding_box.x + e.bounding_box.width for e in row_elements)
								min_y = min(e.bounding_box.y for e in row_elements)
								max_y = max(e.bounding_box.y + e.bounding_box.height for e in row_elements)
								
								pattern_bbox = BoundingBox(min_x, min_y, max_x - min_x, max_y - min_y)
								
								pattern = VisualPattern(
									pattern_type="grid_row",
									elements=[e.element_id for e in row_elements],
									bounding_box=pattern_bbox,
									confidence=consistency,
									repetition_count=len(row_elements),
									spacing_consistency=consistency,
									alignment_quality=1.0,  # All in same row
									likely_content_type=self._infer_content_type(row_elements),
									extraction_priority=self._calculate_extraction_priority(row_elements)
								)
								
								patterns.append(pattern)
		
		except Exception as e:
			self.logger.debug(f"Grid pattern detection failed: {e}")
		
		return patterns
	
	def _detect_list_patterns(self, elements: List[UIElement]) -> List[VisualPattern]:
		"""Detect vertical list patterns"""
		patterns = []
		
		try:
			# Group elements by X coordinate (columns)
			columns = {}
			tolerance = 30
			
			for element in elements:
				x_center = element.bounding_box.center[0]
				
				# Find existing column or create new one
				col_found = False
				for col_x in columns:
					if abs(col_x - x_center) <= tolerance:
						columns[col_x].append(element)
						col_found = True
						break
				
				if not col_found:
					columns[x_center] = [element]
			
			# Analyze columns for list patterns
			for col_x, col_elements in columns.items():
				if len(col_elements) >= self.pattern_params['min_pattern_elements']:
					# Sort by Y coordinate
					col_elements.sort(key=lambda e: e.bounding_box.y)
					
					# Check for consistent vertical spacing
					if len(col_elements) > 2:
						y_spacings = []
						for i in range(1, len(col_elements)):
							spacing = (col_elements[i].bounding_box.y - 
									 (col_elements[i-1].bounding_box.y + col_elements[i-1].bounding_box.height))
							y_spacings.append(spacing)
						
						if y_spacings:
							avg_spacing = sum(y_spacings) / len(y_spacings)
							spacing_variance = sum((s - avg_spacing) ** 2 for s in y_spacings) / len(y_spacings)
							spacing_std = (spacing_variance ** 0.5) if spacing_variance > 0 else 0
							consistency = 1.0 - min(1.0, spacing_std / (avg_spacing + 1))
							
							if consistency >= 0.5:  # Lower threshold for lists
								# Calculate bounding box
								min_x = min(e.bounding_box.x for e in col_elements)
								max_x = max(e.bounding_box.x + e.bounding_box.width for e in col_elements)
								min_y = min(e.bounding_box.y for e in col_elements)
								max_y = max(e.bounding_box.y + e.bounding_box.height for e in col_elements)
								
								pattern_bbox = BoundingBox(min_x, min_y, max_x - min_x, max_y - min_y)
								
								pattern = VisualPattern(
									pattern_type="vertical_list",
									elements=[e.element_id for e in col_elements],
									bounding_box=pattern_bbox,
									confidence=consistency,
									repetition_count=len(col_elements),
									spacing_consistency=consistency,
									alignment_quality=0.8,  # Good vertical alignment assumed
									likely_content_type=self._infer_content_type(col_elements),
									extraction_priority=self._calculate_extraction_priority(col_elements)
								)
								
								patterns.append(pattern)
		
		except Exception as e:
			self.logger.debug(f"List pattern detection failed: {e}")
		
		return patterns
	
	def _detect_form_patterns(self, elements: List[UIElement]) -> List[VisualPattern]:
		"""Detect form-like patterns"""
		patterns = []
		
		try:
			# Look for groups of form_field elements
			form_elements = [e for e in elements if e.element_type == "form_field"]
			
			if len(form_elements) >= 2:
				# Group nearby form elements
				grouped_elements = self._group_nearby_elements(form_elements, max_distance=100)
				
				for group in grouped_elements:
					if len(group) >= 2:
						# Calculate bounding box
						min_x = min(e.bounding_box.x for e in group)
						max_x = max(e.bounding_box.x + e.bounding_box.width for e in group)
						min_y = min(e.bounding_box.y for e in group)
						max_y = max(e.bounding_box.y + e.bounding_box.height for e in group)
						
						pattern_bbox = BoundingBox(min_x, min_y, max_x - min_x, max_y - min_y)
						
						pattern = VisualPattern(
							pattern_type="form",
							elements=[e.element_id for e in group],
							bounding_box=pattern_bbox,
							confidence=0.8,  # High confidence for form detection
							repetition_count=len(group),
							likely_content_type="form",
							extraction_priority=5  # Forms are important for interaction
						)
						
						patterns.append(pattern)
		
		except Exception as e:
			self.logger.debug(f"Form pattern detection failed: {e}")
		
		return patterns
	
	def _detect_navigation_patterns(self, elements: List[UIElement]) -> List[VisualPattern]:
		"""Detect navigation-like patterns"""
		patterns = []
		
		try:
			# Look for groups of link elements in horizontal arrangements
			link_elements = [e for e in elements if e.element_type in ["link", "button"]]
			
			if len(link_elements) >= 3:
				# Group by Y coordinate (horizontal navigation)
				nav_groups = {}
				tolerance = 15
				
				for element in link_elements:
					y_center = element.bounding_box.center[1]
					
					# Find existing group or create new one
					group_found = False
					for group_y in nav_groups:
						if abs(group_y - y_center) <= tolerance:
							nav_groups[group_y].append(element)
							group_found = True
							break
					
					if not group_found:
						nav_groups[y_center] = [element]
				
				# Analyze groups for navigation patterns
				for group_y, group_elements in nav_groups.items():
					if len(group_elements) >= 3:
						# Sort by X coordinate
						group_elements.sort(key=lambda e: e.bounding_box.x)
						
						# Calculate bounding box
						min_x = min(e.bounding_box.x for e in group_elements)
						max_x = max(e.bounding_box.x + e.bounding_box.width for e in group_elements)
						min_y = min(e.bounding_box.y for e in group_elements)
						max_y = max(e.bounding_box.y + e.bounding_box.height for e in group_elements)
						
						pattern_bbox = BoundingBox(min_x, min_y, max_x - min_x, max_y - min_y)
						
						pattern = VisualPattern(
							pattern_type="navigation",
							elements=[e.element_id for e in group_elements],
							bounding_box=pattern_bbox,
							confidence=0.7,
							repetition_count=len(group_elements),
							likely_content_type="navigation",
							extraction_priority=3  # Navigation is moderately important
						)
						
						patterns.append(pattern)
		
		except Exception as e:
			self.logger.debug(f"Navigation pattern detection failed: {e}")
		
		return patterns
	
	def _group_nearby_elements(self, elements: List[UIElement], max_distance: int) -> List[List[UIElement]]:
		"""Group elements that are close to each other"""
		groups = []
		visited = set()
		
		for i, element in enumerate(elements):
			if i in visited:
				continue
			
			group = [element]
			visited.add(i)
			
			# Find nearby elements
			for j, other_element in enumerate(elements):
				if j in visited or i == j:
					continue
				
				# Calculate distance between element centers
				center1 = element.bounding_box.center
				center2 = other_element.bounding_box.center
				distance = ((center1[0] - center2[0]) ** 2 + (center1[1] - center2[1]) ** 2) ** 0.5
				
				if distance <= max_distance:
					group.append(other_element)
					visited.add(j)
			
			if len(group) > 1:
				groups.append(group)
		
		return groups
	
	def _infer_content_type(self, elements: List[UIElement]) -> str:
		"""Infer the likely content type of a pattern based on elements"""
		element_types = [e.element_type for e in elements]
		
		# Count element types
		type_counts = {}
		for element_type in element_types:
			type_counts[element_type] = type_counts.get(element_type, 0) + 1
		
		# Infer content type
		if type_counts.get("form_field", 0) > 0:
			return "form"
		elif type_counts.get("link", 0) >= len(elements) * 0.7:
			return "navigation"
		elif type_counts.get("text_block", 0) >= len(elements) * 0.5:
			return "content_list"
		else:
			return "mixed_content"
	
	def _calculate_extraction_priority(self, elements: List[UIElement]) -> int:
		"""Calculate priority for extracting content from this pattern"""
		base_priority = len(elements)  # More elements = higher priority
		
		# Adjust based on element types
		clickable_count = sum(1 for e in elements if e.is_clickable)
		text_count = sum(1 for e in elements if e.element_type == "text_block")
		
		priority = base_priority + (clickable_count * 2) + text_count
		
		return min(10, max(1, priority))  # Clamp to 1-10 range
	
	async def _perform_ocr_analysis(self, cv_image: np.ndarray, analysis_result: VisionAnalysisResult):
		"""Perform OCR on detected text regions"""
		try:
			# Convert to RGB for Tesseract
			rgb_image = cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB)
			pil_image = Image.fromarray(rgb_image)
			
			# Perform OCR on the entire image first
			try:
				full_text = pytesseract.image_to_string(pil_image, config=self.tesseract_config)
				analysis_result.ocr_regions_processed += 1
				
				# Store OCR text in a general way
				if full_text.strip():
					# We can process this full OCR text for opportunities
					pass
			except Exception as e:
				analysis_result.warnings.append(f"Full image OCR failed: {str(e)}")
			
			# Perform OCR on individual text elements
			for element in analysis_result.ui_elements:
				if element.element_type in ["text_block", "container"]:
					try:
						bbox = element.bounding_box
						roi = pil_image.crop((bbox.x, bbox.y, bbox.x + bbox.width, bbox.y + bbox.height))
						
						ocr_text = pytesseract.image_to_string(roi, config=self.tesseract_config)
						if ocr_text.strip():
							element.ocr_text = ocr_text.strip()
							analysis_result.ocr_regions_processed += 1
						
					except Exception as e:
						analysis_result.warnings.append(f"OCR failed for element {element.element_id}: {str(e)}")
			
			self.vision_stats['ocr_operations'] += analysis_result.ocr_regions_processed
			
		except Exception as e:
			analysis_result.errors.append(f"OCR analysis failed: {str(e)}")
			self.logger.error(f"OCR analysis failed: {e}")
	
	async def _map_visual_to_dom(
		self, 
		page: Page, 
		analysis_result: VisionAnalysisResult
	) -> Dict[str, Dict[str, Any]]:
		"""Map visual elements to DOM elements"""
		dom_mapping = {}
		
		try:
			# Get viewport size for coordinate mapping
			viewport = page.viewport_size
			
			for element in analysis_result.ui_elements:
				try:
					# Convert visual coordinates to page coordinates
					bbox = element.bounding_box
					center_x = bbox.x + bbox.width // 2
					center_y = bbox.y + bbox.height // 2
					
					# Try to find DOM element at this position
					dom_element = await page.locator(f'*').element_handle_at_position(center_x, center_y)
					
					if dom_element:
						# Get element properties
						tag_name = await dom_element.evaluate('el => el.tagName')
						text_content = await dom_element.evaluate('el => el.textContent')
						
						# Get CSS selector
						css_selector = await dom_element.evaluate('''
							el => {
								const path = [];
								while (el && el.nodeType === Node.ELEMENT_NODE) {
									let selector = el.nodeName.toLowerCase();
									if (el.id) {
										selector += '#' + el.id;
										path.unshift(selector);
										break;
									} else {
										let sib = el, nth = 1;
										while (sib = sib.previousElementSibling) {
											if (sib.nodeName.toLowerCase() == selector) nth++;
										}
										if (nth != 1) selector += ':nth-of-type(' + nth + ')';
									}
									path.unshift(selector);
									el = el.parentNode;
								}
								return path.join(' > ');
							}
						''')
						
						dom_mapping[element.element_id] = {
							'tag_name': tag_name,
							'text_content': text_content.strip() if text_content else '',
							'css_selector': css_selector,
							'element_handle': dom_element
						}
						
						# Update element with DOM information
						element.css_selector = css_selector
						element.text_content = text_content.strip() if text_content else ''
				
				except Exception as e:
					# Silently continue if mapping fails for this element
					self.logger.warning("Exception in unknown")
		
		except Exception as e:
			analysis_result.warnings.append(f"DOM mapping partially failed: {str(e)}")
		
		return dom_mapping
	
	async def _extract_opportunities_from_vision(
		self,
		analysis_result: VisionAnalysisResult,
		dom_mapping: Dict[str, Dict[str, Any]],
		page: Page
	) -> List[Dict[str, Any]]:
		"""Extract opportunities using vision analysis and DOM mapping"""
		opportunities = []
		
		try:
			# Process patterns in order of extraction priority
			sorted_patterns = sorted(
				analysis_result.visual_patterns,
				key=lambda p: p.extraction_priority,
				reverse=True
			)
			
			for pattern in sorted_patterns:
				if pattern.likely_content_type in ["content_list", "mixed_content"]:
					# Extract opportunities from this pattern
					pattern_opportunities = await self._extract_from_pattern(
						pattern, analysis_result.ui_elements, dom_mapping, page
					)
					opportunities.extend(pattern_opportunities)
			
			# Also extract from individual high-confidence elements
			for element in analysis_result.ui_elements:
				if (element.confidence > 0.7 and 
					element.element_type in ["text_block", "container"] and
					(element.text_content or element.ocr_text)):
					
					# Try to extract opportunity from this element
					opportunity = self._extract_opportunity_from_element_vision(element)
					if opportunity:
						opportunities.append(opportunity)
			
			# Remove duplicates based on title similarity
			unique_opportunities = self._remove_duplicate_opportunities(opportunities)
			
			return unique_opportunities
			
		except Exception as e:
			analysis_result.errors.append(f"Opportunity extraction from vision failed: {str(e)}")
			return []
	
	async def _extract_from_pattern(
		self,
		pattern: VisualPattern,
		all_elements: List[UIElement],
		dom_mapping: Dict[str, Dict[str, Any]],
		page: Page
	) -> List[Dict[str, Any]]:
		"""Extract opportunities from a visual pattern"""
		opportunities = []
		
		try:
			# Get elements in this pattern
			pattern_elements = [
				e for e in all_elements 
				if e.element_id in pattern.elements
			]
			
			# Group related elements (e.g., elements in same row/column)
			element_groups = self._group_pattern_elements(pattern_elements, pattern.pattern_type)
			
			for group in element_groups:
				# Try to extract an opportunity from this group
				opportunity = await self._extract_opportunity_from_group(group, dom_mapping, page)
				if opportunity:
					opportunities.append(opportunity)
		
		except Exception as e:
			self.logger.debug(f"Pattern extraction failed: {e}")
		
		return opportunities
	
	def _group_pattern_elements(self, elements: List[UIElement], pattern_type: str) -> List[List[UIElement]]:
		"""Group pattern elements into logical units"""
		if pattern_type == "grid_row":
			# Elements are already in a row, group by proximity
			return [elements]  # Simple approach: treat all as one group
		
		elif pattern_type == "vertical_list":
			# Each element is likely a separate opportunity
			return [[element] for element in elements]
		
		else:
			# Default: treat each element separately
			return [[element] for element in elements]
	
	async def _extract_opportunity_from_group(
		self,
		element_group: List[UIElement],
		dom_mapping: Dict[str, Dict[str, Any]],
		page: Page
	) -> Optional[Dict[str, Any]]:
		"""Extract an opportunity from a group of related elements"""
		try:
			# Combine text content from all elements in the group
			all_text = []
			
			for element in element_group:
				text_sources = [
					element.text_content,
					element.ocr_text,
					dom_mapping.get(element.element_id, {}).get('text_content', '')
				]
				
				for text in text_sources:
					if text and text.strip():
						all_text.append(text.strip())
			
			if not all_text:
				return None
			
			combined_text = ' '.join(all_text)
			
			# Extract opportunity from combined text
			opportunity = self._extract_opportunity_from_text_vision(combined_text)
			
			# Add visual metadata
			if opportunity:
				opportunity['source'] = 'vision_analysis'
				opportunity['element_count'] = len(element_group)
				opportunity['confidence'] = sum(e.confidence for e in element_group) / len(element_group)
			
			return opportunity
			
		except Exception as e:
			self.logger.debug(f"Group extraction failed: {e}")
			return None
	
	def _extract_opportunity_from_element_vision(self, element: UIElement) -> Optional[Dict[str, Any]]:
		"""Extract opportunity from a single visual element"""
		text_content = element.text_content or element.ocr_text
		if not text_content or len(text_content) < 20:
			return None
		
		return self._extract_opportunity_from_text_vision(text_content)
	
	def _extract_opportunity_from_text_vision(self, text: str) -> Optional[Dict[str, Any]]:
		"""Extract opportunity data from text content"""
		if len(text) < 10:
			return None
		
		# Use similar extraction logic as in UniversalScraper
		import re
		
		opportunity = {}
		
		# Extract title (first sentence or first 100 characters)
		sentences = text.split('. ')
		title = sentences[0].strip()
		if len(title) > 100:
			title = title[:100] + "..."
		
		opportunity['title'] = title
		opportunity['description'] = text[:500]
		
		# Extract deadline
		deadline_patterns = [
			r'(?i)(?:deadline|due date|closes?|ends?)[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})',
			r'(?i)(?:deadline|due date|closes?|ends?)[:\s]*([0-9]{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+[0-9]{2,4})',
			r'([0-9]{4}-[0-9]{2}-[0-9]{2})',
		]
		
		for pattern in deadline_patterns:
			match = re.search(pattern, text)
			if match:
				opportunity['deadline'] = match.group(1)
				break
		
		# Extract value/budget
		value_patterns = [
			r'(?i)(?:value|budget|amount)[:\s]*[$£€]?([0-9,]+(?:\.[0-9]{2})?)',
			r'(?:[$£€]\s?([0-9,]+(?:\.[0-9]{2})?))',
		]
		
		for pattern in value_patterns:
			match = re.search(pattern, text)
			if match:
				opportunity['value'] = match.group(1)
				break
		
		# Only return if we have meaningful content
		if len(opportunity.get('title', '')) < 5:
			return None
		
		return opportunity
	
	def _remove_duplicate_opportunities(self, opportunities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
		"""Remove duplicate opportunities based on title similarity"""
		if not opportunities:
			return []
		
		unique_opportunities = []
		seen_titles = set()
		
		for opp in opportunities:
			title = opp.get('title', '').strip().lower()
			if title and title not in seen_titles and len(title) > 5:
				seen_titles.add(title)
				unique_opportunities.append(opp)
		
		return unique_opportunities
	
	def _calculate_analysis_confidence(self, analysis_result: VisionAnalysisResult) -> float:
		"""Calculate overall confidence of the vision analysis"""
		try:
			factors = []
			
			# Elements detected factor
			if analysis_result.total_elements_detected > 0:
				avg_element_confidence = sum(e.confidence for e in analysis_result.ui_elements) / len(analysis_result.ui_elements)
				factors.append(avg_element_confidence * 0.3)
			
			# Patterns detected factor
			if analysis_result.patterns_detected > 0:
				avg_pattern_confidence = sum(p.confidence for p in analysis_result.visual_patterns) / len(analysis_result.visual_patterns)
				factors.append(avg_pattern_confidence * 0.4)
			
			# OCR success factor
			if analysis_result.ocr_regions_processed > 0:
				ocr_factor = min(1.0, analysis_result.ocr_regions_processed / 10)  # Up to 10 regions for full score
				factors.append(ocr_factor * 0.2)
			
			# Opportunities found factor
			if analysis_result.opportunities_found:
				opp_factor = min(1.0, len(analysis_result.opportunities_found) / 5)  # Up to 5 opportunities for full score
				factors.append(opp_factor * 0.1)
			
			return sum(factors) if factors else 0.0
			
		except Exception as e:
			self.logger.warning(f"Failed to calculate score factor: {e}")
			return 0.0
	
	async def extract_opportunities(self, result: ScrapingResult) -> List[Dict[str, Any]]:
		"""Extract opportunities from scraping result (implements BaseScraper abstract method)"""
		# For VisionScraper, we need to reprocess the page visually
		# This is a fallback implementation
		if not result.html_content:
			return []
		
		try:
			# Parse HTML and extract basic opportunities
			from bs4 import BeautifulSoup
			soup = BeautifulSoup(result.html_content, 'html.parser')
			
			opportunities = []
			# Look for common patterns in the HTML
			for element in soup.find_all(['div', 'tr', 'li'], limit=20):
				text_content = element.get_text(separator=' ', strip=True)
				if len(text_content) > 20:
					opportunity = self._extract_opportunity_from_text_vision(text_content)
					if opportunity:
						opportunities.append(opportunity)
			
			return opportunities[:10]  # Limit results
			
		except Exception as e:
			self.logger.error(f"Opportunity extraction failed: {e}")
			return []
	
	async def validate_opportunity(self, opportunity: Dict[str, Any]) -> bool:
		"""Validate an extracted opportunity (implements BaseScraper abstract method)"""
		# Basic validation
		if not opportunity.get('title'):
			return False
		
		title = str(opportunity['title']).strip()
		return len(title) >= 5
	
	def get_vision_stats(self) -> Dict[str, Any]:
		"""Get vision-specific statistics"""
		return self.vision_stats.copy()
	
	async def cleanup(self):
		"""Clean up resources"""
		await super().cleanup()
		
		if self.browser:
			await self.browser.close()
		
		if self.playwright:
			await self.playwright.stop()


# Factory function
def create_vision_scraper(
	requests_per_second: float = 0.2,  # Very conservative for vision analysis
	use_proxies: bool = False,
	max_retries: int = 2
) -> VisionScraper:
	"""Create a configured VisionScraper instance"""
	config = ScrapingConfiguration(
		requests_per_second=requests_per_second,
		max_retries=max_retries,
		enable_proxy_rotation=use_proxies,
		request_timeout=60,
		page_load_timeout=90
	)
	
	return VisionScraper(config)