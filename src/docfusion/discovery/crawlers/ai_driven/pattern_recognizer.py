#!/usr/bin/env python3
"""
Procurement Pattern Recognition Engine

Specialized pattern recognizer that identifies common patterns in procurement websites.
Uses both traditional pattern matching and AI vision models (including Qwen2.5VL) to:
- Recognize procurement-specific UI patterns
- Identify opportunity listings, tables, and forms
- Understand site navigation structures
- Detect authentication requirements
- Recognize pagination and filtering mechanisms
"""

import asyncio
import json
import logging
import re
import cv2
import numpy as np
from typing import Dict, List, Optional, Any, Tuple, Set
from datetime import datetime, timezone
from pathlib import Path
import base64
import io
from urllib.parse import urlparse
from dataclasses import dataclass
from enum import Enum

import requests
from bs4 import BeautifulSoup
from PIL import Image

from pydantic import BaseModel, Field
from ..generic.base_scraper import uuid7str


class PatternType(str, Enum):
	"""Types of patterns we can recognize"""
	OPPORTUNITY_LIST = "opportunity_list"
	OPPORTUNITY_DETAIL = "opportunity_detail"
	SEARCH_FORM = "search_form"
	PAGINATION = "pagination"
	LOGIN_FORM = "login_form"
	NAVIGATION_MENU = "navigation_menu"
	FILTER_PANEL = "filter_panel"
	DATA_TABLE = "data_table"
	BREADCRUMB = "breadcrumb"
	FOOTER_INFO = "footer_info"


class PatternMatch(BaseModel):
	"""Represents a matched pattern"""
	pattern_id: str = Field(default_factory=uuid7str)
	pattern_type: PatternType
	confidence: float = 0.0
	
	# Location information
	css_selector: Optional[str] = None
	xpath: Optional[str] = None
	bounding_box: Optional[Tuple[int, int, int, int]] = None  # x, y, width, height
	
	# Content
	matched_text: Optional[str] = None
	matched_elements: List[str] = Field(default_factory=list)  # CSS selectors or element descriptions
	
	# Pattern-specific data
	pattern_data: Dict[str, Any] = Field(default_factory=dict)
	
	# Context
	surrounding_context: Optional[str] = None
	page_section: Optional[str] = None  # header, main, sidebar, footer
	
	# Metadata
	detection_method: str = "unknown"  # css, vision, ai, hybrid
	processing_time: float = 0.0


class ProcurementSite(BaseModel):
	"""Information about a procurement site"""
	domain: str
	site_type: str = "unknown"  # government, corporate, marketplace, portal
	country: Optional[str] = None
	language: Optional[str] = None
	
	# Recognized patterns
	patterns: List[PatternMatch] = Field(default_factory=list)
	
	# Site characteristics
	requires_login: bool = False
	has_search: bool = False
	has_filters: bool = False
	has_pagination: bool = False
	supports_rss: bool = False
	
	# Technical details
	framework_detected: Optional[str] = None  # wordpress, drupal, custom, etc.
	javascript_heavy: bool = False
	mobile_friendly: bool = False
	
	# Analysis metadata
	last_analyzed: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	analysis_confidence: float = 0.0
	opportunities_found_sample: int = 0


class PatternRecognizer:
	"""
	Advanced pattern recognition for procurement websites
	"""
	
	def __init__(self, ollama_base_url: str = "http://localhost:11434"):
		self.logger = logging.getLogger(__name__)
		self.ollama_base_url = ollama_base_url
		
		# Pattern definitions
		self.css_patterns = self._load_css_patterns()
		self.text_patterns = self._load_text_patterns()
		self.visual_patterns = self._load_visual_patterns()
		
		# Vision model configuration
		self.vision_model = "qwen2.5-vl:7b"
		
		# Performance tracking
		self.recognition_stats = {
			'total_analyses': 0,
			'patterns_recognized': 0,
			'css_matches': 0,
			'vision_matches': 0,
			'ai_matches': 0,
			'processing_time_total': 0.0
		}
		
		# Known procurement indicators
		self.procurement_keywords = {
			'english': [
				'tender', 'bid', 'rfp', 'rfq', 'procurement', 'contract', 'proposal',
				'opportunity', 'solicitation', 'invitation', 'award', 'quotation'
			],
			'spanish': [
				'licitación', 'concurso', 'contrato', 'propuesta', 'adjudicación'
			],
			'french': [
				'appel d\'offres', 'marché', 'contrat', 'soumission', 'adjudication'
			],
			'german': [
				'ausschreibung', 'vergabe', 'auftrag', 'angebot', 'zuschlag'
			]
		}
	
	def _load_css_patterns(self) -> Dict[PatternType, List[str]]:
		"""Load CSS selector patterns for different procurement elements"""
		return {
			PatternType.OPPORTUNITY_LIST: [
				# Generic opportunity containers
				'[class*="tender"], [class*="opportunity"], [class*="procurement"]',
				'[class*="bid"], [class*="rfp"], [class*="rfq"], [class*="contract"]',
				'[id*="opportunity"], [id*="tender"], [id*="bid"]',
				
				# Table-based listings
				'table[class*="tender"], table[class*="opportunity"]',
				'tbody tr:has(td:contains("tender")), tbody tr:has(td:contains("bid"))',
				
				# List-based structures
				'ul[class*="opportunity"] li, ol[class*="tender"] li',
				'div[class*="list"] > div:has(a[href*="tender"])',
				
				# Card/grid layouts
				'div[class*="card"]:has(a[href*="opportunity"])',
				'div[class*="item"]:has(span:contains("deadline"))',
			],
			
			PatternType.SEARCH_FORM: [
				'form[class*="search"], form[id*="search"]',
				'form:has(input[placeholder*="search"])',
				'form:has(button:contains("Search"))',
				'div[class*="search"] form',
				'[class*="filter"] form, [class*="search-form"]'
			],
			
			PatternType.PAGINATION: [
				'nav[class*="pagination"], div[class*="pagination"]',
				'ul.pagination, ol.pagination',
				'a:contains("Next"), a:contains("Previous")',
				'a:contains("»"), a:contains("«")',
				'[class*="pager"], [class*="page-nav"]'
			],
			
			PatternType.LOGIN_FORM: [
				'form[class*="login"], form[id*="login"]',
				'form:has(input[type="password"])',
				'form:has(input[name*="username"])',
				'div[class*="login"] form',
				'form:has(button:contains("Login"))'
			],
			
			PatternType.NAVIGATION_MENU: [
				'nav[class*="main"], nav[class*="primary"]',
				'ul[class*="menu"], ul[class*="nav"]',
				'div[class*="navigation"] ul',
				'header nav, nav[role="navigation"]'
			],
			
			PatternType.FILTER_PANEL: [
				'div[class*="filter"], aside[class*="filter"]',
				'div[class*="sidebar"]:has(select)',
				'form[class*="filter"], [class*="search-options"]',
				'div:has(input[type="checkbox"]):has(label:contains("category"))'
			],
			
			PatternType.DATA_TABLE: [
				'table[class*="data"], table[class*="list"]',
				'table:has(th:contains("Title")):has(th:contains("Date"))',
				'div[class*="table"], div[class*="grid"]',
				'table.table, table[class*="responsive"]'
			]
		}
	
	def _load_text_patterns(self) -> Dict[PatternType, List[str]]:
		"""Load text-based regex patterns"""
		return {
			PatternType.OPPORTUNITY_LIST: [
				r'(?i)\b(?:tender|rfp|rfq|bid|opportunity|procurement)\s*(?:no|number|#)?\s*:?\s*([A-Z0-9\-/]+)',
				r'(?i)(?:deadline|due date|closes?|ends?)\s*:?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})',
				r'(?i)(?:contract|tender)\s+value\s*:?\s*[$£€]?([0-9,]+(?:\.[0-9]{2})?)',
				r'(?i)(?:published|posted|issued)\s*:?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})'
			],
			
			PatternType.OPPORTUNITY_DETAIL: [
				r'(?i)(?:tender|rfp|rfq|bid)\s+(?:title|name)\s*:?\s*(.+)',
				r'(?i)(?:description|summary|overview)\s*:?\s*(.+)',
				r'(?i)(?:requirements|specifications|scope)\s*:?\s*(.+)',
				r'(?i)(?:contact|enquir(?:y|ies))\s*:?\s*(.+)'
			],
			
			PatternType.PAGINATION: [
				r'(?i)page\s+(\d+)\s+of\s+(\d+)',
				r'(?i)showing\s+(\d+)\s*-\s*(\d+)\s+of\s+(\d+)',
				r'(?i)results?\s+(\d+)\s*-\s*(\d+)',
				r'(?i)(?:next|previous)\s+(\d+)'
			]
		}
	
	def _load_visual_patterns(self) -> Dict[str, Any]:
		"""Load visual pattern recognition parameters"""
		return {
			'table_detection': {
				'min_rows': 3,
				'min_columns': 2,
				'header_threshold': 0.3,  # Fraction of cells that look like headers
			},
			'form_detection': {
				'min_input_fields': 2,
				'button_proximity': 50,  # pixels
				'label_association': True
			},
			'list_detection': {
				'min_items': 3,
				'vertical_alignment': 0.8,  # alignment threshold
				'consistent_spacing': 0.7
			}
		}
	
	async def analyze_procurement_site(
		self,
		url: str,
		html_content: Optional[str] = None,
		screenshot: Optional[bytes] = None,
		use_vision_ai: bool = True
	) -> ProcurementSite:
		"""
		Comprehensive analysis of a procurement site
		"""
		start_time = datetime.now()
		domain = urlparse(url).netloc
		
		site = ProcurementSite(domain=domain)
		patterns = []
		
		try:
			# CSS-based pattern recognition
			if html_content:
				css_patterns = await self._recognize_css_patterns(html_content, url)
				patterns.extend(css_patterns)
				site = await self._analyze_site_characteristics(site, html_content)
			
			# Vision-based pattern recognition
			if screenshot:
				vision_patterns = await self._recognize_visual_patterns(screenshot, html_content)
				patterns.extend(vision_patterns)
				
				# AI vision analysis using Qwen2.5VL
				if use_vision_ai:
					ai_patterns = await self._analyze_with_vision_ai(screenshot, url)
					patterns.extend(ai_patterns)
			
			# Text-based pattern recognition
			if html_content:
				text_patterns = await self._recognize_text_patterns(html_content)
				patterns.extend(text_patterns)
			
			# Consolidate and deduplicate patterns
			site.patterns = self._consolidate_patterns(patterns)
			
			# Calculate overall confidence
			site.analysis_confidence = self._calculate_site_confidence(site)
			
			# Update statistics
			processing_time = (datetime.now() - start_time).total_seconds()
			self.recognition_stats['total_analyses'] += 1
			self.recognition_stats['patterns_recognized'] += len(site.patterns)
			self.recognition_stats['processing_time_total'] += processing_time
			
			self.logger.info(f"Analyzed {domain}: {len(site.patterns)} patterns found")
			
		except Exception as e:
			self.logger.error(f"Site analysis failed for {url}: {e}")
			site.analysis_confidence = 0.0
		
		site.last_analyzed = datetime.now(timezone.utc)
		return site
	
	async def _recognize_css_patterns(self, html_content: str, url: str) -> List[PatternMatch]:
		"""Recognize patterns using CSS selectors"""
		patterns = []
		
		try:
			soup = BeautifulSoup(html_content, 'html.parser')
			
			for pattern_type, selectors in self.css_patterns.items():
				for selector in selectors:
					try:
						elements = soup.select(selector)
						
						if elements:
							# Create pattern match
							pattern = PatternMatch(
								pattern_type=pattern_type,
								css_selector=selector,
								confidence=self._calculate_css_confidence(elements, selector),
								matched_elements=[str(elem)[:200] for elem in elements[:3]],
								detection_method="css"
							)
							
							# Extract pattern-specific data
							pattern.pattern_data = self._extract_pattern_data(pattern_type, elements, soup)
							
							# Add context information
							if elements:
								pattern.matched_text = elements[0].get_text(strip=True)[:200]
								pattern.page_section = self._detect_page_section(elements[0])
							
							patterns.append(pattern)
							self.recognition_stats['css_matches'] += 1
							
					except Exception as e:
						self.logger.debug(f"CSS selector '{selector}' failed: {e}")
		
		except Exception as e:
			self.logger.error(f"CSS pattern recognition failed: {e}")
		
		return patterns
	
	async def _recognize_visual_patterns(
		self, 
		screenshot: bytes, 
		html_content: Optional[str] = None
	) -> List[PatternMatch]:
		"""Recognize patterns using computer vision"""
		patterns = []
		
		try:
			# Convert screenshot to OpenCV format
			image = Image.open(io.BytesIO(screenshot))
			cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
			
			# Detect tables
			table_patterns = await self._detect_table_patterns(cv_image)
			patterns.extend(table_patterns)
			
			# Detect forms
			form_patterns = await self._detect_form_patterns(cv_image)
			patterns.extend(form_patterns)
			
			# Detect navigation elements
			nav_patterns = await self._detect_navigation_patterns(cv_image)
			patterns.extend(nav_patterns)
			
			# Detect list structures
			list_patterns = await self._detect_list_patterns(cv_image)
			patterns.extend(list_patterns)
			
			self.recognition_stats['vision_matches'] += len(patterns)
			
		except Exception as e:
			self.logger.error(f"Visual pattern recognition failed: {e}")
		
		return patterns
	
	async def _analyze_with_vision_ai(self, screenshot: bytes, url: str) -> List[PatternMatch]:
		"""Analyze screenshot using Qwen2.5VL vision model"""
		patterns = []
		
		try:
			# Convert screenshot to base64
			screenshot_b64 = base64.b64encode(screenshot).decode('utf-8')
			
			# Prepare prompt for vision AI
			prompt = """
			Analyze this webpage screenshot and identify procurement-related patterns. Look for:
			
			1. Opportunity listings (tables, lists, cards showing tenders/bids)
			2. Search and filter forms
			3. Navigation menus
			4. Login forms
			5. Pagination controls
			6. Data tables with procurement information
			
			For each pattern found, provide:
			- Pattern type (opportunity_list, search_form, navigation_menu, etc.)
			- Confidence level (0.0 to 1.0)
			- Location description
			- Key content or text visible
			
			Focus on procurement-specific elements like tender numbers, deadlines, contract values, etc.
			
			Return your analysis as JSON with this structure:
			{
				"patterns": [
					{
						"type": "opportunity_list",
						"confidence": 0.85,
						"location": "center of page, main content area",
						"description": "Table showing tender opportunities with columns for title, deadline, and value",
						"key_content": ["Tender #2024-001", "Deadline: March 15, 2024", "$50,000"]
					}
				]
			}
			"""
			
			# Make request to Ollama
			response = requests.post(
				f"{self.ollama_base_url}/api/generate",
				json={
					"model": self.vision_model,
					"prompt": prompt,
					"images": [screenshot_b64],
					"stream": False,
					"options": {
						"temperature": 0.1,
						"top_k": 10
					}
				},
				timeout=60
			)
			
			if response.status_code == 200:
				result = response.json()
				ai_response = result.get('response', '')
				
				# Parse AI response
				ai_patterns = await self._parse_ai_vision_response(ai_response)
				patterns.extend(ai_patterns)
				
				self.recognition_stats['ai_matches'] += len(ai_patterns)
				
			else:
				self.logger.warning(f"Vision AI request failed: {response.status_code}")
			
		except Exception as e:
			self.logger.error(f"Vision AI analysis failed: {e}")
		
		return patterns
	
	async def _parse_ai_vision_response(self, ai_response: str) -> List[PatternMatch]:
		"""Parse AI vision model response into PatternMatch objects"""
		patterns = []
		
		try:
			# Try to extract JSON from response
			json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
			if json_match:
				ai_data = json.loads(json_match.group())
				
				for pattern_data in ai_data.get('patterns', []):
					pattern_type_str = pattern_data.get('type', 'unknown')
					
					# Map string to enum
					try:
						pattern_type = PatternType(pattern_type_str)
					except ValueError:
						pattern_type = PatternType.OPPORTUNITY_LIST  # Default
					
					pattern = PatternMatch(
						pattern_type=pattern_type,
						confidence=float(pattern_data.get('confidence', 0.0)),
						detection_method="ai_vision",
						pattern_data={
							'location': pattern_data.get('location', ''),
							'description': pattern_data.get('description', ''),
							'key_content': pattern_data.get('key_content', [])
						}
					)
					
					patterns.append(pattern)
			
		except Exception as e:
			self.logger.debug(f"Failed to parse AI vision response: {e}")
		
		return patterns
	
	async def _recognize_text_patterns(self, html_content: str) -> List[PatternMatch]:
		"""Recognize patterns using text analysis"""
		patterns = []
		
		try:
			soup = BeautifulSoup(html_content, 'html.parser')
			text_content = soup.get_text()
			
			for pattern_type, regex_patterns in self.text_patterns.items():
				for regex_pattern in regex_patterns:
					matches = re.finditer(regex_pattern, text_content)
					
					for match in matches:
						pattern = PatternMatch(
							pattern_type=pattern_type,
							confidence=0.7,  # Default confidence for text patterns
							matched_text=match.group()[:200],
							detection_method="text_regex",
							pattern_data={'regex_match': match.groups()}
						)
						patterns.append(pattern)
		
		except Exception as e:
			self.logger.error(f"Text pattern recognition failed: {e}")
		
		return patterns
	
	async def _detect_table_patterns(self, cv_image: np.ndarray) -> List[PatternMatch]:
		"""Detect table patterns using computer vision"""
		patterns = []
		
		try:
			gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
			
			# Detect horizontal and vertical lines
			horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
			vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
			
			horizontal_lines = cv2.morphologyEx(gray, cv2.MORPH_OPEN, horizontal_kernel)
			vertical_lines = cv2.morphologyEx(gray, cv2.MORPH_OPEN, vertical_kernel)
			
			# Combine lines to find table-like structures
			table_mask = cv2.addWeighted(horizontal_lines, 0.5, vertical_lines, 0.5, 0.0)
			
			# Find contours
			contours, _ = cv2.findContours(table_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
			
			for contour in contours:
				area = cv2.contourArea(contour)
				if area > 5000:  # Minimum table size
					x, y, w, h = cv2.boundingRect(contour)
					
					# Check if it looks like a table
					aspect_ratio = w / h
					if 1.2 < aspect_ratio < 10:  # Tables are usually wider than tall
						pattern = PatternMatch(
							pattern_type=PatternType.DATA_TABLE,
							confidence=0.6,
							bounding_box=(x, y, w, h),
							detection_method="vision_table",
							pattern_data={
								'area': int(area),
								'aspect_ratio': float(aspect_ratio)
							}
						)
						patterns.append(pattern)
		
		except Exception as e:
			self.logger.debug(f"Table detection failed: {e}")
		
		return patterns
	
	async def _detect_form_patterns(self, cv_image: np.ndarray) -> List[PatternMatch]:
		"""Detect form patterns using computer vision"""
		patterns = []
		
		try:
			gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
			
			# Detect rectangular shapes that might be input fields
			edges = cv2.Canny(gray, 50, 150)
			contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
			
			input_like_rects = []
			
			for contour in contours:
				area = cv2.contourArea(contour)
				if 500 < area < 8000:  # Typical input field size
					x, y, w, h = cv2.boundingRect(contour)
					aspect_ratio = w / h
					
					# Input fields are typically wide rectangles
					if 2 < aspect_ratio < 15 and h < 50:
						input_like_rects.append((x, y, w, h))
			
			# Group nearby input fields as potential forms
			if len(input_like_rects) >= 2:
				# Simple grouping: if multiple inputs are vertically aligned
				input_like_rects.sort(key=lambda r: r[1])  # Sort by y coordinate
				
				for i in range(len(input_like_rects) - 1):
					current = input_like_rects[i]
					next_rect = input_like_rects[i + 1]
					
					# If inputs are close vertically and similar x position
					if (abs(current[0] - next_rect[0]) < 50 and  # Similar x
						abs(current[1] - next_rect[1]) < 100):    # Close vertically
						
						# Create form pattern
						form_x = min(current[0], next_rect[0])
						form_y = current[1]
						form_w = max(current[0] + current[2], next_rect[0] + next_rect[2]) - form_x
						form_h = (next_rect[1] + next_rect[3]) - current[1]
						
						pattern = PatternMatch(
							pattern_type=PatternType.SEARCH_FORM,
							confidence=0.5,
							bounding_box=(form_x, form_y, form_w, form_h),
							detection_method="vision_form",
							pattern_data={
								'input_fields_detected': len(input_like_rects)
							}
						)
						patterns.append(pattern)
						break  # Only add one form pattern per group
		
		except Exception as e:
			self.logger.debug(f"Form detection failed: {e}")
		
		return patterns
	
	async def _detect_navigation_patterns(self, cv_image: np.ndarray) -> List[PatternMatch]:
		"""Detect navigation patterns using computer vision"""
		patterns = []
		
		try:
			height, width = cv_image.shape[:2]
			
			# Focus on top area of page where navigation usually is
			nav_area = cv_image[0:int(height * 0.2), :]
			gray_nav = cv2.cvtColor(nav_area, cv2.COLOR_BGR2GRAY)
			
			# Look for horizontal arrangements of text/links
			edges = cv2.Canny(gray_nav, 30, 100)
			contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
			
			horizontal_elements = []
			
			for contour in contours:
				area = cv2.contourArea(contour)
				if 200 < area < 2000:  # Navigation item size
					x, y, w, h = cv2.boundingRect(contour)
					aspect_ratio = w / h
					
					# Navigation items are often horizontal
					if aspect_ratio > 1.5:
						horizontal_elements.append((x, y, w, h))
			
			# If we have multiple horizontal elements in the nav area
			if len(horizontal_elements) >= 3:
				# Find bounding box of all elements
				min_x = min(elem[0] for elem in horizontal_elements)
				min_y = min(elem[1] for elem in horizontal_elements)
				max_x = max(elem[0] + elem[2] for elem in horizontal_elements)
				max_y = max(elem[1] + elem[3] for elem in horizontal_elements)
				
				pattern = PatternMatch(
					pattern_type=PatternType.NAVIGATION_MENU,
					confidence=0.4,
					bounding_box=(min_x, min_y, max_x - min_x, max_y - min_y),
					detection_method="vision_navigation",
					pattern_data={
						'nav_items_detected': len(horizontal_elements)
					}
				)
				patterns.append(pattern)
		
		except Exception as e:
			self.logger.debug(f"Navigation detection failed: {e}")
		
		return patterns
	
	async def _detect_list_patterns(self, cv_image: np.ndarray) -> List[PatternMatch]:
		"""Detect list patterns using computer vision"""
		patterns = []
		
		try:
			gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
			
			# Find rectangular regions that might be list items
			edges = cv2.Canny(gray, 40, 120)
			contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
			
			potential_items = []
			
			for contour in contours:
				area = cv2.contourArea(contour)
				if 1000 < area < 20000:  # List item size range
					x, y, w, h = cv2.boundingRect(contour)
					aspect_ratio = w / h
					
					# List items are typically wider than tall
					if 1.5 < aspect_ratio < 8:
						potential_items.append((x, y, w, h))
			
			# Group items that are vertically aligned
			potential_items.sort(key=lambda item: item[1])  # Sort by y coordinate
			
			if len(potential_items) >= 3:
				# Check for consistent spacing and alignment
				y_positions = [item[1] for item in potential_items]
				y_diffs = [y_positions[i+1] - y_positions[i] for i in range(len(y_positions)-1)]
				
				if y_diffs:
					avg_spacing = sum(y_diffs) / len(y_diffs)
					spacing_variance = sum((diff - avg_spacing) ** 2 for diff in y_diffs) / len(y_diffs)
					
					# If spacing is relatively consistent
					if spacing_variance < (avg_spacing * 0.5) ** 2:
						# Calculate bounding box for the list
						min_x = min(item[0] for item in potential_items)
						min_y = min(item[1] for item in potential_items)
						max_x = max(item[0] + item[2] for item in potential_items)
						max_y = max(item[1] + item[3] for item in potential_items)
						
						pattern = PatternMatch(
							pattern_type=PatternType.OPPORTUNITY_LIST,
							confidence=0.6,
							bounding_box=(min_x, min_y, max_x - min_x, max_y - min_y),
							detection_method="vision_list",
							pattern_data={
								'list_items_detected': len(potential_items),
								'spacing_consistency': float(1.0 - (spacing_variance / (avg_spacing ** 2)))
							}
						)
						patterns.append(pattern)
		
		except Exception as e:
			self.logger.debug(f"List detection failed: {e}")
		
		return patterns
	
	def _calculate_css_confidence(self, elements: List, selector: str) -> float:
		"""Calculate confidence for CSS pattern match"""
		base_confidence = 0.5
		
		# More elements found = higher confidence
		element_bonus = min(0.3, len(elements) * 0.05)
		
		# Specific selectors are more confident
		specificity_bonus = 0.0
		if '#' in selector:  # ID selector
			specificity_bonus = 0.2
		elif '.' in selector:  # Class selector
			specificity_bonus = 0.1
		
		# Procurement-specific terms boost confidence
		procurement_bonus = 0.0
		for lang, keywords in self.procurement_keywords.items():
			for keyword in keywords:
				if keyword in selector.lower():
					procurement_bonus = 0.2
					break
			if procurement_bonus > 0:
				break
		
		return min(1.0, base_confidence + element_bonus + specificity_bonus + procurement_bonus)
	
	def _extract_pattern_data(
		self, 
		pattern_type: PatternType, 
		elements: List, 
		soup: BeautifulSoup
	) -> Dict[str, Any]:
		"""Extract pattern-specific data from matched elements"""
		data = {}
		
		try:
			if pattern_type == PatternType.OPPORTUNITY_LIST:
				data['opportunity_count'] = len(elements)
				
				# Try to extract sample opportunity data
				sample_opportunities = []
				for elem in elements[:3]:  # Max 3 samples
					opp_data = {}
					text = elem.get_text(strip=True)
					
					# Extract title (first line or strong text)
					title_elem = elem.find(['h1', 'h2', 'h3', 'h4', 'strong', 'a'])
					if title_elem:
						opp_data['title'] = title_elem.get_text(strip=True)[:100]
					
					# Look for deadline
					deadline_match = re.search(
						r'(?i)(?:deadline|due|close[sd]?)[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})',
						text
					)
					if deadline_match:
						opp_data['deadline'] = deadline_match.group(1)
					
					# Look for reference number
					ref_match = re.search(r'(?i)(?:ref|no|number)[:\s#]*([A-Z0-9\-/]+)', text)
					if ref_match:
						opp_data['reference'] = ref_match.group(1)
					
					if opp_data:
						sample_opportunities.append(opp_data)
				
				data['sample_opportunities'] = sample_opportunities
			
			elif pattern_type == PatternType.SEARCH_FORM:
				form_elem = elements[0] if elements else None
				if form_elem and form_elem.name == 'form':
					inputs = form_elem.find_all('input')
					data['input_count'] = len(inputs)
					data['has_submit_button'] = bool(form_elem.find(['button', 'input[type="submit"]']))
					
					# Check for search-specific inputs
					for input_elem in inputs:
						if input_elem.get('type') == 'search' or 'search' in (input_elem.get('name', '') + input_elem.get('placeholder', '')).lower():
							data['is_search_form'] = True
							break
			
			elif pattern_type == PatternType.DATA_TABLE:
				table_elem = elements[0] if elements else None
				if table_elem and table_elem.name == 'table':
					rows = table_elem.find_all('tr')
					data['row_count'] = len(rows)
					
					headers = table_elem.find_all('th')
					data['column_count'] = len(headers)
					data['headers'] = [th.get_text(strip=True) for th in headers[:5]]  # Max 5 headers
			
		except Exception as e:
			self.logger.debug(f"Pattern data extraction failed: {e}")
		
		return data
	
	def _detect_page_section(self, element) -> str:
		"""Detect which section of the page an element belongs to"""
		try:
			# Walk up the DOM to find section indicators
			current = element
			while current and current.parent:
				if current.name in ['header', 'nav']:
					return 'header'
				elif current.name in ['main', 'article']:
					return 'main'
				elif current.name in ['aside', 'sidebar']:
					return 'sidebar'
				elif current.name in ['footer']:
					return 'footer'
				
				# Check class names
				classes = current.get('class', [])
				class_str = ' '.join(classes).lower()
				
				if any(term in class_str for term in ['header', 'top', 'nav']):
					return 'header'
				elif any(term in class_str for term in ['main', 'content', 'body']):
					return 'main'
				elif any(term in class_str for term in ['sidebar', 'aside', 'filter']):
					return 'sidebar'
				elif any(term in class_str for term in ['footer', 'bottom']):
					return 'footer'
				
				current = current.parent
		
		except:
			pass
		
		return 'main'  # Default
	
	async def _analyze_site_characteristics(self, site: ProcurementSite, html_content: str) -> ProcurementSite:
		"""Analyze general characteristics of the site"""
		try:
			soup = BeautifulSoup(html_content, 'html.parser')
			
			# Check for login requirements
			login_forms = soup.find_all('form', {'class': re.compile(r'login', re.I)})
			login_inputs = soup.find_all('input', {'type': 'password'})
			site.requires_login = len(login_forms) > 0 or len(login_inputs) > 0
			
			# Check for search functionality
			search_forms = soup.find_all('form', {'class': re.compile(r'search', re.I)})
			search_inputs = soup.find_all('input', {'type': 'search'})
			site.has_search = len(search_forms) > 0 or len(search_inputs) > 0
			
			# Check for pagination
			pagination_elements = soup.find_all(['nav', 'div'], {'class': re.compile(r'pag', re.I)})
			page_links = soup.find_all('a', string=re.compile(r'next|previous|page', re.I))
			site.has_pagination = len(pagination_elements) > 0 or len(page_links) > 0
			
			# Check for filters
			filter_elements = soup.find_all(['div', 'aside'], {'class': re.compile(r'filter', re.I)})
			select_elements = soup.find_all('select')
			site.has_filters = len(filter_elements) > 0 or len(select_elements) > 2
			
			# Detect framework
			site.framework_detected = self._detect_framework(html_content)
			
			# Check JavaScript dependency
			script_tags = soup.find_all('script')
			site.javascript_heavy = len(script_tags) > 10
			
			# Check mobile friendliness
			viewport_meta = soup.find('meta', {'name': 'viewport'})
			responsive_classes = soup.find_all(['div', 'container'], {'class': re.compile(r'responsive|mobile', re.I)})
			site.mobile_friendly = viewport_meta is not None or len(responsive_classes) > 0
			
			# Detect language and country
			html_lang = soup.find('html', {'lang': True})
			if html_lang:
				lang = html_lang['lang'].lower()
				site.language = lang[:2] if len(lang) >= 2 else None
				
				# Simple country detection from language codes
				if 'us' in lang or lang == 'en':
					site.country = 'US'
				elif 'gb' in lang or 'uk' in lang:
					site.country = 'GB'
				elif 'ca' in lang:
					site.country = 'CA'
				elif lang.startswith('de'):
					site.country = 'DE'
				elif lang.startswith('fr'):
					site.country = 'FR'
				elif lang.startswith('es'):
					site.country = 'ES'
			
			# Classify site type based on domain and content
			site.site_type = self._classify_site_type(site.domain, html_content)
			
		except Exception as e:
			self.logger.debug(f"Site characteristics analysis failed: {e}")
		
		return site
	
	def _detect_framework(self, html_content: str) -> Optional[str]:
		"""Detect web framework used"""
		html_lower = html_content.lower()
		
		if 'wp-content' in html_lower or 'wordpress' in html_lower:
			return 'WordPress'
		elif 'drupal' in html_lower or 'sites/default' in html_lower:
			return 'Drupal'
		elif 'joomla' in html_lower:
			return 'Joomla'
		elif 'bootstrap' in html_lower:
			return 'Bootstrap'
		elif 'react' in html_lower:
			return 'React'
		elif 'angular' in html_lower:
			return 'Angular'
		elif 'vue' in html_lower:
			return 'Vue.js'
		else:
			return None
	
	def _classify_site_type(self, domain: str, html_content: str) -> str:
		"""Classify the type of procurement site"""
		domain_lower = domain.lower()
		content_lower = html_content.lower()
		
		# Government site indicators
		if (any(gov in domain_lower for gov in ['.gov', 'government', 'municipal', 'city', 'state']) or
			any(gov in content_lower for gov in ['government', 'municipal', 'public sector'])):
			return 'government'
		
		# Procurement platform indicators
		if (any(plat in domain_lower for plat in ['tender', 'procurement', 'bid', 'contract']) or
			any(plat in content_lower for plat in ['tender platform', 'procurement portal'])):
			return 'procurement_platform'
		
		# Marketplace indicators
		if any(market in domain_lower for market in ['marketplace', 'market', 'trade']):
			return 'marketplace'
		
		# Corporate indicators
		if any(corp in content_lower for corp in ['corporate', 'company', 'business', 'enterprise']):
			return 'corporate'
		
		return 'unknown'
	
	def _consolidate_patterns(self, patterns: List[PatternMatch]) -> List[PatternMatch]:
		"""Consolidate and deduplicate similar patterns"""
		if not patterns:
			return patterns
		
		# Group by pattern type
		pattern_groups = {}
		for pattern in patterns:
			if pattern.pattern_type not in pattern_groups:
				pattern_groups[pattern.pattern_type] = []
			pattern_groups[pattern.pattern_type].append(pattern)
		
		consolidated = []
		
		for pattern_type, group in pattern_groups.items():
			if len(group) == 1:
				consolidated.append(group[0])
			else:
				# For multiple patterns of same type, keep the one with highest confidence
				# or merge them if appropriate
				best_pattern = max(group, key=lambda p: p.confidence)
				
				# Merge pattern data from other patterns
				for other_pattern in group:
					if other_pattern != best_pattern:
						# Merge pattern_data
						for key, value in other_pattern.pattern_data.items():
							if key not in best_pattern.pattern_data:
								best_pattern.pattern_data[key] = value
						
						# Update matched_elements
						if other_pattern.matched_elements:
							best_pattern.matched_elements.extend(other_pattern.matched_elements)
				
				# Increase confidence slightly for multiple detections
				best_pattern.confidence = min(1.0, best_pattern.confidence + 0.1 * (len(group) - 1))
				consolidated.append(best_pattern)
		
		return consolidated
	
	def _calculate_site_confidence(self, site: ProcurementSite) -> float:
		"""Calculate overall confidence in site analysis"""
		if not site.patterns:
			return 0.0
		
		# Base confidence from pattern confidences
		avg_pattern_confidence = sum(p.confidence for p in site.patterns) / len(site.patterns)
		
		# Bonus for procurement-specific patterns
		opportunity_patterns = [p for p in site.patterns if p.pattern_type == PatternType.OPPORTUNITY_LIST]
		opportunity_bonus = 0.2 if opportunity_patterns else 0.0
		
		# Bonus for multiple detection methods
		detection_methods = set(p.detection_method for p in site.patterns)
		method_bonus = 0.1 * (len(detection_methods) - 1)
		
		# Bonus for site characteristics that indicate procurement functionality
		feature_bonus = 0.0
		if site.has_search:
			feature_bonus += 0.05
		if site.has_filters:
			feature_bonus += 0.05
		if site.has_pagination:
			feature_bonus += 0.05
		
		total_confidence = avg_pattern_confidence + opportunity_bonus + method_bonus + feature_bonus
		return min(1.0, total_confidence)
	
	def get_recognition_stats(self) -> Dict[str, Any]:
		"""Get pattern recognition statistics"""
		stats = self.recognition_stats.copy()
		
		if stats['total_analyses'] > 0:
			stats['avg_patterns_per_site'] = stats['patterns_recognized'] / stats['total_analyses']
			stats['avg_processing_time'] = stats['processing_time_total'] / stats['total_analyses']
		
		return stats


# Factory function
def create_pattern_recognizer(ollama_base_url: str = "http://localhost:11434") -> PatternRecognizer:
	"""Create a PatternRecognizer instance"""
	return PatternRecognizer(ollama_base_url)