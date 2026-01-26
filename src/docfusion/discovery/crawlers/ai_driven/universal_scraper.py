#!/usr/bin/env python3
"""
Universal AI-Driven Scraper

Advanced web scraper that combines multiple technologies:
- Crawl4AI for intelligent content extraction
- Playwright for browser automation with stealth
- CloudScraper for Cloudflare bypass
- Computer vision for layout analysis
- Machine learning for pattern recognition

This scraper can adapt to different website structures and circumvent blocking.
"""

import asyncio
import json
import logging
import time
import cv2
import numpy as np
from typing import Dict, List, Optional, Any, Union, Tuple
from datetime import datetime, timezone
from pathlib import Path
import tempfile
import base64
from urllib.parse import urljoin, urlparse
import re

# Optional AI and crawler dependencies - imported with fallbacks
try:
	from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode
	from crawl4ai.extraction_strategy import LLMExtractionStrategy, CosineStrategy
	HAS_CRAWL4AI = True
except ImportError:
	HAS_CRAWL4AI = False
	AsyncWebCrawler = None
	LLMExtractionStrategy = None
	CosineStrategy = None

try:
	from crawlee import PlaywrightCrawler, Request
	from crawlee.playwright_crawler import PlaywrightCrawlingContext
	HAS_CRAWLEE = True
except ImportError:
	HAS_CRAWLEE = False
	PlaywrightCrawler = None
	Request = None
	PlaywrightCrawlingContext = None

from playwright.async_api import async_playwright, Page, Browser, BrowserContext
import cloudscraper
from bs4 import BeautifulSoup
import requests
from PIL import Image
import io

from ..generic.base_scraper import BaseScraper, ScrapingResult, ScrapingStatus, ScrapingConfiguration, uuid7str
from pydantic import BaseModel, Field
from enum import Enum


class ExtractionStrategy(str, Enum):
	"""Available extraction strategies"""
	CRAWLEE = "crawlee"
	CLOUDSCRAPER = "cloudscraper"
	CRAWL4AI_LLM = "crawl4ai_llm"
	CRAWL4AI_COSINE = "crawl4ai_cosine"
	PLAYWRIGHT_STEALTH = "playwright_stealth"
	PLAYWRIGHT_CSS = "playwright_css"
	VISION_ANALYSIS = "vision_analysis"


class SiteStructure(BaseModel):
	"""Represents the learned structure of a website"""
	domain: str
	site_type: str = "unknown"  # government, corporate, marketplace, etc.
	
	# Navigation patterns
	main_navigation_selector: Optional[str] = None
	breadcrumb_selector: Optional[str] = None
	pagination_selector: Optional[str] = None
	
	# Content patterns
	opportunity_list_selector: Optional[str] = None
	opportunity_item_selector: Optional[str] = None
	title_selector: Optional[str] = None
	description_selector: Optional[str] = None
	deadline_selector: Optional[str] = None
	value_selector: Optional[str] = None
	category_selector: Optional[str] = None
	
	# Form patterns
	search_form_selector: Optional[str] = None
	search_input_selector: Optional[str] = None
	filter_selectors: Dict[str, str] = Field(default_factory=dict)
	
	# Authentication patterns
	login_required: bool = False
	login_form_selector: Optional[str] = None
	username_selector: Optional[str] = None
	password_selector: Optional[str] = None
	
	# Anti-bot measures detected
	has_captcha: bool = False
	has_cloudflare: bool = False
	has_rate_limiting: bool = False
	requires_javascript: bool = False
	
	# Performance characteristics
	average_load_time: Optional[float] = None
	requires_wait_after_load: bool = False
	wait_time_seconds: Optional[float] = None
	
	# Success patterns (learned from successful extractions)
	success_indicators: List[str] = Field(default_factory=list)
	failure_indicators: List[str] = Field(default_factory=list)
	
	# Metadata
	last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	confidence_score: float = 0.0  # 0-1, how confident we are in this structure
	extraction_success_rate: float = 0.0


class ExtractionResult(BaseModel):
	"""Result of content extraction"""
	opportunities: List[Dict[str, Any]] = Field(default_factory=list)
	structure_confidence: float = 0.0
	extraction_method: str = "unknown"  # llm, css, vision, hybrid
	
	# Metadata about extraction
	total_items_found: int = 0
	valid_items_found: int = 0
	extraction_time: float = 0.0
	
	# Quality metrics
	data_completeness: float = 0.0  # 0-1, how complete the extracted data is
	data_confidence: float = 0.0    # 0-1, how confident we are in the data
	
	# Errors and warnings
	errors: List[str] = Field(default_factory=list)
	warnings: List[str] = Field(default_factory=list)


class UniversalScraper(BaseScraper):
	"""
	Universal AI-driven scraper with multiple extraction strategies
	"""
	
	def __init__(self, config: Optional[ScrapingConfiguration] = None):
		super().__init__(config)
		self.logger = logging.getLogger(__name__)
		
		# Learned site structures
		self.site_structures: Dict[str, SiteStructure] = {}
		
		# Crawlee - primary robust crawler
		self.crawlee_crawler = None
		self.crawlee_results = []
		
		# Extraction strategies
		self.llm_strategy = None
		self.cosine_strategy = None
		
		# Browser automation (fallback)
		self.playwright = None
		self.browser: Optional[Browser] = None
		self.contexts: Dict[str, BrowserContext] = {}
		
		# CloudScraper for Cloudflare bypass
		self.cloudscraper_session = cloudscraper.create_scraper(
			browser={
				'browser': 'chrome',
				'platform': 'windows',
				'desktop': True
			}
		)
		
		# Computer vision components
		self.vision_initialized = False
		
		# Performance tracking
		self.extraction_stats = {
			'total_extractions': 0,
			'successful_extractions': 0,
			'crawlee_extractions': 0,
			'llm_extractions': 0,
			'css_extractions': 0,
			'vision_extractions': 0,
			'hybrid_extractions': 0
		}
	
	async def initialize(self):
		"""Initialize all components"""
		try:
			# Initialize Crawlee crawler - primary robust scraper
			if HAS_CRAWLEE:
				self.crawlee_crawler = PlaywrightCrawler(
					# Basic configuration
					max_requests_per_crawl=1,  # Single page for targeted scraping
					request_handler_timeout=30000,  # 30 seconds
					navigation_timeout=30000,
					
					# Browser settings
					browser_type='chromium',
					headless=True,
					
					# Anti-detection settings
					use_session_pool=True,
					persist_cookies_per_session=True,
					
					# Performance settings
					max_request_retries=3,
					min_concurrency=1,
					max_concurrency=self.config.max_concurrent
				)
			else:
				self.crawlee_crawler = None
			
			# Initialize Playwright (fallback)
			self.playwright = await async_playwright().start()
			self.browser = await self.playwright.chromium.launch(
				headless=True,
				args=[
					'--no-sandbox',
					'--disable-blink-features=AutomationControlled',
					'--disable-extensions',
					'--disable-plugins',
					'--disable-images',  # Faster loading
				]
			)
			
			# Initialize Crawl4AI strategies
			if HAS_CRAWL4AI:
				self.llm_strategy = LLMExtractionStrategy(
					provider="openai/gpt-4o-mini",
					api_key="your-api-key-here",  # Should be configured externally
					instruction="""
					Extract procurement opportunities from this webpage. For each opportunity, extract:
					- title: The title or name of the opportunity
					- description: Brief description of what's being procured
					- deadline: Any deadline or due date mentioned
					- value: Contract value or budget if mentioned
					- category: Type or category of procurement
					- organization: Procuring organization
					- reference_number: Any reference or ID number
					- requirements: Key requirements mentioned
					- contact_info: Contact information if available
					
					Return as JSON array of objects with these fields.
					"""
				)
				
				self.cosine_strategy = CosineStrategy(
					semantic_filter="procurement opportunity tender contract RFP RFQ bid",
					word_count_threshold=10,
					max_dist=0.2,
					linkage_method="ward"
				)
			else:
				self.llm_strategy = None
				self.cosine_strategy = None
			
			self.vision_initialized = True
			self.logger.info("UniversalScraper initialized successfully")
			
		except Exception as e:
			self.logger.error(f"Failed to initialize UniversalScraper: {e}")
			raise
	
	async def scrape_with_intelligence(
		self,
		url: str,
		use_learned_structure: bool = True,
		learn_structure: bool = True
	) -> Tuple[ScrapingResult, ExtractionResult]:
		"""
		Scrape a URL using AI-driven intelligence with multiple strategies
		"""
		domain = urlparse(url).netloc
		start_time = time.time()
		
		# Get or create site structure
		site_structure = None
		if use_learned_structure and domain in self.site_structures:
			site_structure = self.site_structures[domain]
			self.logger.info(f"Using learned structure for {domain} (confidence: {site_structure.confidence_score:.2f})")
		
		extraction_result = ExtractionResult()
		scraping_result = None
		
		try:
			# Try multiple extraction strategies in order of preference
			strategies = self._get_extraction_strategies(site_structure)
			
			for strategy in strategies:
				try:
					self.logger.info(f"Trying extraction strategy: {strategy}")
					
					if strategy == "crawlee":
						scraping_result, extraction_result = await self._extract_with_crawlee(url)
					elif strategy == "cloudscraper":
						scraping_result, extraction_result = await self._extract_with_cloudscraper(url)
					elif strategy == "crawl4ai_llm":
						scraping_result, extraction_result = await self._extract_with_crawl4ai_llm(url)
					elif strategy == "crawl4ai_cosine":
						scraping_result, extraction_result = await self._extract_with_crawl4ai_cosine(url)
					elif strategy == "playwright_stealth":
						scraping_result, extraction_result = await self._extract_with_playwright(url, stealth=True)
					elif strategy == "playwright_css":
						scraping_result, extraction_result = await self._extract_with_playwright_css(url, site_structure)
					elif strategy == "vision_analysis":
						scraping_result, extraction_result = await self._extract_with_vision(url)
					
					# Check if extraction was successful
					if extraction_result.valid_items_found > 0:
						extraction_result.extraction_method = strategy
						self.extraction_stats[f'{strategy.split("_")[0]}_extractions'] += 1
						break
						
				except Exception as e:
					self.logger.warning(f"Strategy {strategy} failed: {e}")
					extraction_result.errors.append(f"{strategy}: {str(e)}")
					continue
			
			# Update statistics
			self.extraction_stats['total_extractions'] += 1
			if extraction_result.valid_items_found > 0:
				self.extraction_stats['successful_extractions'] += 1
			
			# Learn/update site structure if enabled
			if learn_structure and scraping_result and extraction_result.valid_items_found > 0:
				await self._update_site_structure(domain, scraping_result, extraction_result)
			
			extraction_result.extraction_time = time.time() - start_time
			
			return scraping_result or ScrapingResult(
				url=url,
				status=ScrapingStatus.FAILED,
				error_message="All extraction strategies failed"
			), extraction_result
			
		except Exception as e:
			self.logger.error(f"Universal scraping failed for {url}: {e}")
			return ScrapingResult(
				url=url,
				status=ScrapingStatus.FAILED,
				error_message=str(e)
			), extraction_result
	
	def _get_extraction_strategies(self, site_structure: Optional[SiteStructure]) -> List[str]:
		"""Determine the best extraction strategies based on site characteristics"""
		strategies = []
		
		if site_structure:
			# Use learned patterns to optimize strategy selection
			if site_structure.has_cloudflare:
				strategies.extend(["cloudscraper", "playwright_stealth"])
			
			if site_structure.requires_javascript:
				strategies.extend(["playwright_css", "crawl4ai_llm"])
			
			if site_structure.opportunity_list_selector:
				strategies.append("playwright_css")
			
			# Add general strategies
			if site_structure.site_type == "government":
				strategies.extend(["crawl4ai_llm", "crawl4ai_cosine"])
		else:
			# Default strategy order for unknown sites
			strategies = [
				"crawlee",               # Primary robust crawler with anti-detection
				"cloudscraper",          # Fast, good for Cloudflare
				"crawl4ai_llm",         # AI-powered extraction
				"playwright_stealth",    # Stealth browser automation
				"crawl4ai_cosine",      # Semantic clustering
				"playwright_css",       # CSS-based extraction
				"vision_analysis"       # Computer vision fallback
			]
		
		return list(dict.fromkeys(strategies))  # Remove duplicates while preserving order
	
	async def _extract_with_cloudscraper(self, url: str) -> Tuple[ScrapingResult, ExtractionResult]:
		"""Extract using CloudScraper to bypass Cloudflare"""
		try:
			response = self.cloudscraper_session.get(url, timeout=30)
			
			scraping_result = ScrapingResult(
				url=url,
				status=ScrapingStatus.SUCCESS if response.status_code == 200 else ScrapingStatus.FAILED,
				status_code=response.status_code,
				html_content=response.text,
				response_headers=dict(response.headers)
			)
			
			if response.status_code != 200:
				return scraping_result, ExtractionResult(errors=[f"HTTP {response.status_code}"])
			
			# Extract opportunities using BeautifulSoup + NLP
			extraction_result = await self._extract_opportunities_from_html(response.text, "cloudscraper")
			
			return scraping_result, extraction_result
			
		except Exception as e:
			return ScrapingResult(
				url=url,
				status=ScrapingStatus.FAILED,
				error_message=str(e)
			), ExtractionResult(errors=[str(e)])
	
	async def _extract_with_crawlee(self, url: str) -> Tuple[ScrapingResult, ExtractionResult]:
		"""Extract using Crawlee - primary robust crawler with built-in anti-detection"""
		if not HAS_CRAWLEE or self.crawlee_crawler is None:
			return ScrapingResult(
				url=url,
				status=ScrapingStatus.FAILED,
				error_message="Crawlee not available"
			), ExtractionResult(errors=["Crawlee not available"])
		
		try:
			# Clear previous results
			self.crawlee_results = []
			
			async def request_handler(context: PlaywrightCrawlingContext):
				"""Handle the page once Crawlee has loaded it"""
				page = context.page
				request = context.request
				
				try:
					# Wait for page to fully load
					await page.wait_for_load_state('networkidle', timeout=15000)
					
					# Get page content
					content = await page.content()
					
					# Extract opportunities from the Crawlee-managed page
					extraction_result = await self._extract_opportunities_from_html(content, "crawlee")
					
					# Also try to extract using the page object directly for more dynamic content
					dynamic_opportunities = await self._extract_dynamic_opportunities(page)
					if dynamic_opportunities:
						extraction_result.opportunities.extend(dynamic_opportunities)
						extraction_result.valid_items_found += len(dynamic_opportunities)
					
					# Store results for return
					self.crawlee_results.append({
						'url': request.url,
						'content': content,
						'extraction_result': extraction_result,
						'success': True,
						'status_code': 200
					})
					
				except Exception as e:
					self.crawlee_results.append({
						'url': request.url,
						'error': str(e),
						'success': False
					})
					self.logger.error(f"Crawlee request handler failed: {e}")
			
			# Configure and run Crawlee
			await self.crawlee_crawler.add_requests([Request.from_url(url)])
			await self.crawlee_crawler.run(request_handler)
			
			# Process results
			if not self.crawlee_results:
				return ScrapingResult(
					url=url,
					status=ScrapingStatus.FAILED,
					error_message="No results from Crawlee"
				), ExtractionResult(errors=["Crawlee returned no results"])
			
			result = self.crawlee_results[0]
			
			if not result.get('success'):
				return ScrapingResult(
					url=url,
					status=ScrapingStatus.FAILED,
					error_message=result.get('error', 'Unknown Crawlee error')
				), ExtractionResult(errors=[result.get('error', 'Unknown error')])
			
			# Create successful scraping result
			scraping_result = ScrapingResult(
				url=url,
				status=ScrapingStatus.SUCCESS,
				status_code=result.get('status_code', 200),
				html_content=result.get('content', ''),
				method_used="crawlee"
			)
			
			extraction_result = result.get('extraction_result', ExtractionResult())
			extraction_result.extraction_method = "crawlee"
			
			self.logger.info(f"Crawlee extraction successful: {extraction_result.valid_items_found} opportunities found")
			
			return scraping_result, extraction_result
			
		except Exception as e:
			self.logger.error(f"Crawlee extraction failed: {e}")
			return ScrapingResult(
				url=url,
				status=ScrapingStatus.FAILED,
				error_message=str(e)
			), ExtractionResult(errors=[str(e)])
	
	async def _extract_dynamic_opportunities(self, page: Page) -> List[Dict[str, Any]]:
		"""Extract opportunities from dynamic content using Playwright page object"""
		opportunities = []
		
		try:
			# Common procurement opportunity selectors
			opportunity_selectors = [
				'[class*="opportunity"]',
				'[class*="tender"]', 
				'[class*="bid"]',
				'[class*="contract"]',
				'[class*="procurement"]',
				'[id*="opportunity"]',
				'[id*="tender"]',
				'.opportunity-item',
				'.tender-item',
				'.bid-item',
				'tbody tr',  # Common for tables
				'ul li',     # Common for lists
			]
			
			for selector in opportunity_selectors:
				try:
					elements = await page.query_selector_all(selector)
					
					if elements:
						for element in elements[:20]:  # Limit to avoid performance issues
							try:
								# Extract text content
								text_content = await element.text_content()
								if not text_content or len(text_content.strip()) < 10:
									continue
								
								# Try to extract structured data
								opportunity = await self._extract_opportunity_from_element(element)
								if opportunity and opportunity.get('title'):
									opportunities.append(opportunity)
								
							except Exception as e:
								continue
						
						# If we found opportunities with this selector, break
						if opportunities:
							self.logger.debug(f"Found {len(opportunities)} opportunities with selector: {selector}")
							break
				
				except Exception as e:
					continue
		
		except Exception as e:
			self.logger.warning(f"Dynamic extraction failed: {e}")
		
		return opportunities
	
	async def _extract_opportunity_from_element(self, element) -> Optional[Dict[str, Any]]:
		"""Extract opportunity data from a single page element"""
		try:
			# Get text content
			text_content = await element.text_content()
			if not text_content or len(text_content.strip()) < 10:
				return None
			
			# Try to find title (usually in headings or strong text)
			title = None
			title_selectors = ['h1', 'h2', 'h3', 'h4', 'strong', '.title', '[class*="title"]']
			
			for selector in title_selectors:
				try:
					title_element = await element.query_selector(selector)
					if title_element:
						title = await title_element.text_content()
						if title and len(title.strip()) > 5:
							break
				except:
					continue
			
			# If no title found in sub-elements, use first meaningful line
			if not title:
				lines = text_content.strip().split('\n')
				for line in lines:
					line = line.strip()
					if len(line) > 10 and len(line) < 200:  # Reasonable title length
						title = line
						break
			
			if not title:
				return None
			
			# Extract other fields using common patterns
			opportunity = {
				'title': title.strip(),
				'description': text_content.strip()[:500],  # First 500 chars
				'source_element_selector': await self._get_element_selector(element)
			}
			
			# Try to find deadline/date information
			deadline_patterns = [
				r'deadline[:\s]+([^\n\r]+)',
				r'due[:\s]+([^\n\r]+)', 
				r'closes[:\s]+([^\n\r]+)',
				r'expires[:\s]+([^\n\r]+)',
				r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
				r'(\d{4}-\d{2}-\d{2})'
			]
			
			for pattern in deadline_patterns:
				match = re.search(pattern, text_content, re.IGNORECASE)
				if match:
					opportunity['deadline'] = match.group(1).strip()
					break
			
			# Try to find value/amount information
			value_patterns = [
				r'value[:\s]+([^\n\r]+)',
				r'amount[:\s]+([^\n\r]+)',
				r'budget[:\s]+([^\n\r]+)',
				r'\$([0-9,]+)',
				r'([0-9,]+)\s*USD'
			]
			
			for pattern in value_patterns:
				match = re.search(pattern, text_content, re.IGNORECASE)
				if match:
					opportunity['estimated_value'] = match.group(1).strip()
					break
			
			return opportunity
			
		except Exception as e:
			self.logger.debug(f"Element extraction failed: {e}")
			return None
	
	async def _get_element_selector(self, element) -> str:
		"""Generate a CSS selector for an element"""
		try:
			# This is a simplified selector generation
			tag_name = await element.evaluate('el => el.tagName.toLowerCase()')
			class_attr = await element.get_attribute('class')
			id_attr = await element.get_attribute('id')
			
			if id_attr:
				return f"#{id_attr}"
			elif class_attr:
				classes = class_attr.split()[:2]  # First 2 classes
				return f"{tag_name}.{'.'.join(classes)}"
			else:
				return tag_name
		
		except:
			return "unknown"
	
	async def _extract_with_crawl4ai_llm(self, url: str) -> Tuple[ScrapingResult, ExtractionResult]:
		"""Extract using Crawl4AI with LLM strategy"""
		if not HAS_CRAWL4AI or self.llm_strategy is None:
			return ScrapingResult(
				url=url,
				status=ScrapingStatus.FAILED,
				error_message="Crawl4AI LLM strategy not available"
			), ExtractionResult(errors=["Crawl4AI LLM strategy not available"])
		
		try:
			async with AsyncWebCrawler(verbose=True) as crawler:
				config = CrawlerRunConfig(
					cache_mode=CacheMode.ENABLED,
					extraction_strategy=self.llm_strategy,
					js_code="window.scrollTo(0, document.body.scrollHeight);",  # Scroll to load content
					wait_for="css:body",
					page_timeout=30000,
					delay_before_return_html=2.0
				)
				
				result = await crawler.arun(url=url, config=config)
				
				scraping_result = ScrapingResult(
					url=url,
					status=ScrapingStatus.SUCCESS if result.success else ScrapingStatus.FAILED,
					html_content=result.cleaned_html,
					text_content=result.markdown
				)
				
				if not result.success:
					return scraping_result, ExtractionResult(errors=[result.error_message or "Crawl4AI extraction failed"])
				
				# Parse extracted data
				extraction_result = ExtractionResult(extraction_method="crawl4ai_llm")
				
				if result.extracted_content:
					try:
						extracted_data = json.loads(result.extracted_content)
						if isinstance(extracted_data, list):
							extraction_result.opportunities = extracted_data
							extraction_result.total_items_found = len(extracted_data)
							extraction_result.valid_items_found = len([
								item for item in extracted_data 
								if isinstance(item, dict) and item.get('title')
							])
						
						extraction_result.data_confidence = 0.8  # High confidence for LLM extraction
						
					except json.JSONDecodeError:
						extraction_result.errors.append("Failed to parse LLM extracted content as JSON")
				
				return scraping_result, extraction_result
				
		except Exception as e:
			return ScrapingResult(
				url=url,
				status=ScrapingStatus.FAILED,
				error_message=str(e)
			), ExtractionResult(errors=[str(e)])
	
	async def _extract_with_crawl4ai_cosine(self, url: str) -> Tuple[ScrapingResult, ExtractionResult]:
		"""Extract using Crawl4AI with Cosine clustering strategy"""
		if not HAS_CRAWL4AI or self.cosine_strategy is None:
			return ScrapingResult(
				url=url,
				status=ScrapingStatus.FAILED,
				error_message="Crawl4AI Cosine strategy not available"
			), ExtractionResult(errors=["Crawl4AI Cosine strategy not available"])
		
		try:
			async with AsyncWebCrawler(verbose=True) as crawler:
				config = CrawlerRunConfig(
					cache_mode=CacheMode.ENABLED,
					extraction_strategy=self.cosine_strategy,
					js_code="window.scrollTo(0, document.body.scrollHeight);",
					wait_for="css:body",
					page_timeout=30000
				)
				
				result = await crawler.arun(url=url, config=config)
				
				scraping_result = ScrapingResult(
					url=url,
					status=ScrapingStatus.SUCCESS if result.success else ScrapingStatus.FAILED,
					html_content=result.cleaned_html,
					text_content=result.markdown
				)
				
				if not result.success:
					return scraping_result, ExtractionResult(errors=[result.error_message or "Crawl4AI cosine extraction failed"])
				
				# Process clustered content
				extraction_result = ExtractionResult(extraction_method="crawl4ai_cosine")
				
				if result.extracted_content:
					try:
						clustered_data = json.loads(result.extracted_content)
						opportunities = await self._process_clustered_content(clustered_data)
						
						extraction_result.opportunities = opportunities
						extraction_result.total_items_found = len(opportunities)
						extraction_result.valid_items_found = len([
							opp for opp in opportunities if opp.get('title')
						])
						extraction_result.data_confidence = 0.6  # Medium confidence for clustering
						
					except json.JSONDecodeError:
						extraction_result.errors.append("Failed to parse cosine extracted content")
				
				return scraping_result, extraction_result
				
		except Exception as e:
			return ScrapingResult(
				url=url,
				status=ScrapingStatus.FAILED,
				error_message=str(e)
			), ExtractionResult(errors=[str(e)])
	
	async def _extract_with_playwright(self, url: str, stealth: bool = True) -> Tuple[ScrapingResult, ExtractionResult]:
		"""Extract using Playwright with stealth capabilities"""
		context = None
		page = None
		
		try:
			# Create stealth context
			context = await self.browser.new_context(
				user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
				viewport={'width': 1920, 'height': 1080},
				locale='en-US',
				timezone_id='America/New_York',
				ignore_https_errors=True
			)
			
			if stealth:
				# Add stealth measures
				await context.add_init_script("""
					// Remove webdriver property
					Object.defineProperty(navigator, 'webdriver', {
						get: () => undefined,
					});
					
					// Mock languages and plugins
					Object.defineProperty(navigator, 'languages', {
						get: () => ['en-US', 'en'],
					});
					
					Object.defineProperty(navigator, 'plugins', {
						get: () => [1, 2, 3, 4, 5],
					});
				""")
			
			page = await context.new_page()
			
			# Navigate with error handling
			response = await page.goto(url, wait_until='domcontentloaded', timeout=30000)
			
			# Wait for page to fully load and any dynamic content
			try:
				await page.wait_for_load_state('networkidle', timeout=10000)
			except:
				pass  # Continue even if networkidle times out
			
			# Check for Cloudflare or other blocking
			await self._handle_blocking_mechanisms(page)
			
			# Get page content
			html_content = await page.content()
			
			scraping_result = ScrapingResult(
				url=url,
				status=ScrapingStatus.SUCCESS,
				status_code=response.status if response else 200,
				html_content=html_content
			)
			
			# Extract opportunities from the loaded page
			extraction_result = await self._extract_opportunities_from_html(html_content, "playwright")
			
			return scraping_result, extraction_result
			
		except Exception as e:
			return ScrapingResult(
				url=url,
				status=ScrapingStatus.FAILED,
				error_message=str(e)
			), ExtractionResult(errors=[str(e)])
		
		finally:
			if page:
				await page.close()
			if context:
				await context.close()
	
	async def _extract_with_playwright_css(
		self, 
		url: str, 
		site_structure: Optional[SiteStructure]
	) -> Tuple[ScrapingResult, ExtractionResult]:
		"""Extract using Playwright with learned CSS selectors"""
		if not site_structure or not site_structure.opportunity_list_selector:
			return await self._extract_with_playwright(url)
		
		context = None
		page = None
		
		try:
			context = await self.browser.new_context()
			page = await context.new_page()
			
			await page.goto(url, wait_until='domcontentloaded')
			await page.wait_for_load_state('networkidle', timeout=10000)
			
			# Use learned selectors
			opportunities = []
			
			try:
				# Wait for opportunity list to load
				await page.wait_for_selector(site_structure.opportunity_list_selector, timeout=10000)
				
				# Extract opportunities using learned selectors
				opportunity_elements = await page.query_selector_all(site_structure.opportunity_item_selector)
				
				for element in opportunity_elements:
					opportunity = {}
					
					# Extract using learned selectors
					if site_structure.title_selector:
						title_element = await element.query_selector(site_structure.title_selector)
						if title_element:
							opportunity['title'] = await title_element.inner_text()
					
					if site_structure.description_selector:
						desc_element = await element.query_selector(site_structure.description_selector)
						if desc_element:
							opportunity['description'] = await desc_element.inner_text()
					
					if site_structure.deadline_selector:
						deadline_element = await element.query_selector(site_structure.deadline_selector)
						if deadline_element:
							opportunity['deadline'] = await deadline_element.inner_text()
					
					if site_structure.value_selector:
						value_element = await element.query_selector(site_structure.value_selector)
						if value_element:
							opportunity['value'] = await value_element.inner_text()
					
					if opportunity.get('title'):  # Only add if we have at least a title
						opportunities.append(opportunity)
				
			except Exception as e:
				self.logger.warning(f"CSS extraction failed: {e}")
			
			html_content = await page.content()
			
			scraping_result = ScrapingResult(
				url=url,
				status=ScrapingStatus.SUCCESS,
				html_content=html_content
			)
			
			extraction_result = ExtractionResult(
				opportunities=opportunities,
				extraction_method="playwright_css",
				total_items_found=len(opportunities),
				valid_items_found=len(opportunities),
				data_confidence=site_structure.confidence_score,
				structure_confidence=site_structure.confidence_score
			)
			
			return scraping_result, extraction_result
			
		except Exception as e:
			return ScrapingResult(
				url=url,
				status=ScrapingStatus.FAILED,
				error_message=str(e)
			), ExtractionResult(errors=[str(e)])
		
		finally:
			if page:
				await page.close()
			if context:
				await context.close()
	
	async def _extract_with_vision(self, url: str) -> Tuple[ScrapingResult, ExtractionResult]:
		"""Extract using computer vision analysis of page screenshots"""
		if not self.vision_initialized:
			return ScrapingResult(
				url=url,
				status=ScrapingStatus.FAILED,
				error_message="Vision components not initialized"
			), ExtractionResult(errors=["Vision not available"])
		
		context = None
		page = None
		
		try:
			context = await self.browser.new_context()
			page = await context.new_page()
			
			await page.goto(url, wait_until='domcontentloaded')
			await page.wait_for_load_state('networkidle', timeout=10000)
			
			# Take screenshot for vision analysis
			screenshot_bytes = await page.screenshot(full_page=True)
			
			# Analyze screenshot with computer vision
			opportunities = await self._analyze_screenshot_for_opportunities(screenshot_bytes, page)
			
			html_content = await page.content()
			
			scraping_result = ScrapingResult(
				url=url,
				status=ScrapingStatus.SUCCESS,
				html_content=html_content
			)
			
			extraction_result = ExtractionResult(
				opportunities=opportunities,
				extraction_method="vision_analysis",
				total_items_found=len(opportunities),
				valid_items_found=len(opportunities),
				data_confidence=0.4  # Lower confidence for vision-only extraction
			)
			
			return scraping_result, extraction_result
			
		except Exception as e:
			return ScrapingResult(
				url=url,
				status=ScrapingStatus.FAILED,
				error_message=str(e)
			), ExtractionResult(errors=[str(e)])
		
		finally:
			if page:
				await page.close()
			if context:
				await context.close()
	
	async def _handle_blocking_mechanisms(self, page: Page):
		"""Handle various anti-bot mechanisms"""
		try:
			# Check for Cloudflare
			if await page.locator('text=Checking your browser').count() > 0:
				self.logger.info("Cloudflare detected, waiting for bypass...")
				await page.wait_for_timeout(5000)  # Wait for Cloudflare to complete
			
			# Check for captcha
			if await page.locator('[class*="captcha"], [id*="captcha"]').count() > 0:
				self.logger.warning("CAPTCHA detected - manual intervention may be required")
			
			# Handle cookie banners
			try:
				accept_button = page.locator('button:has-text("Accept"), button:has-text("OK"), button:has-text("Agree")')
				if await accept_button.count() > 0:
					await accept_button.first.click()
					await page.wait_for_timeout(1000)
			except:
				pass
			
			# Handle "Show more" or pagination
			try:
				show_more = page.locator('button:has-text("Show more"), button:has-text("Load more"), a:has-text("Next")')
				if await show_more.count() > 0:
					await show_more.first.click()
					await page.wait_for_timeout(2000)
			except:
				pass
			
		except Exception as e:
			self.logger.debug(f"Error handling blocking mechanisms: {e}")
	
	async def _extract_opportunities_from_html(self, html_content: str, method: str) -> ExtractionResult:
		"""Extract opportunities from HTML using BeautifulSoup and NLP"""
		try:
			soup = BeautifulSoup(html_content, 'html.parser')
			opportunities = []
			
			# Remove script and style elements
			for element in soup(['script', 'style', 'nav', 'footer', 'header']):
				element.decompose()
			
			# Look for common procurement opportunity patterns
			opportunity_patterns = [
				# Common container classes/IDs
				'[class*="tender"], [class*="opportunity"], [class*="procurement"]',
				'[class*="bid"], [class*="rfp"], [class*="rfq"]',
				'[class*="contract"], [class*="award"]',
				'[id*="opportunity"], [id*="tender"], [id*="bid"]',
				
				# Table rows that might contain opportunities
				'tr:has(td:contains("deadline")), tr:has(td:contains("due date"))',
				'tr:has(td:contains("title")), tr:has(td:contains("description"))',
				
				# List items
				'li:has(a[href*="tender"]), li:has(a[href*="bid"])',
				'li:has(a[href*="opportunity"]), li:has(a[href*="procurement"])'
			]
			
			for pattern in opportunity_patterns:
				try:
					elements = soup.select(pattern)
					for element in elements[:20]:  # Limit to avoid too much data
						opportunity = self._extract_opportunity_from_element(element)
						if opportunity and opportunity.get('title'):
							opportunities.append(opportunity)
				except Exception as e:
					self.logger.debug(f"Pattern {pattern} failed: {e}")
			
			# Remove duplicates based on title
			seen_titles = set()
			unique_opportunities = []
			for opp in opportunities:
				title = opp.get('title', '').strip().lower()
				if title and title not in seen_titles:
					seen_titles.add(title)
					unique_opportunities.append(opp)
			
			return ExtractionResult(
				opportunities=unique_opportunities,
				extraction_method=method,
				total_items_found=len(opportunities),
				valid_items_found=len(unique_opportunities),
				data_confidence=0.5  # Medium confidence for HTML parsing
			)
			
		except Exception as e:
			return ExtractionResult(
				errors=[f"HTML extraction failed: {str(e)}"],
				extraction_method=method
			)
	
	def _extract_opportunity_from_element(self, element) -> Dict[str, Any]:
		"""Extract opportunity data from a BeautifulSoup element"""
		opportunity = {}
		
		try:
			# Get all text from element
			text_content = element.get_text(separator=' ', strip=True)
			
			# Extract title (usually the first link or heading)
			title_element = (
				element.find(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) or
				element.find('a') or
				element.find(['strong', 'b'])
			)
			
			if title_element:
				opportunity['title'] = title_element.get_text(strip=True)[:200]  # Limit length
			
			# Extract description (remaining text)
			if 'title' in opportunity:
				description = text_content.replace(opportunity['title'], '', 1).strip()
				if description:
					opportunity['description'] = description[:500]  # Limit length
			else:
				opportunity['description'] = text_content[:500]
				# If no title found, use first part of description as title
				if len(text_content) > 50:
					opportunity['title'] = text_content[:50] + "..."
			
			# Extract deadline using regex patterns
			deadline_patterns = [
				r'(?i)(?:deadline|due date|closes?|ends?)[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})',
				r'(?i)(?:deadline|due date|closes?|ends?)[:\s]*([0-9]{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+[0-9]{2,4})',
				r'([0-9]{4}-[0-9]{2}-[0-9]{2})',  # ISO format
			]
			
			for pattern in deadline_patterns:
				match = re.search(pattern, text_content)
				if match:
					opportunity['deadline'] = match.group(1)
					break
			
			# Extract value/budget
			value_patterns = [
				r'(?i)(?:value|budget|amount)[:\s]*[$£€]?([0-9,]+(?:\.[0-9]{2})?)',
				r'(?:[$£€]\s?([0-9,]+(?:\.[0-9]{2})?))',
			]
			
			for pattern in value_patterns:
				match = re.search(pattern, text_content)
				if match:
					opportunity['value'] = match.group(1)
					break
			
			# Extract reference number
			ref_patterns = [
				r'(?i)(?:ref|reference|id|number)[:\s#]*([A-Z0-9\-/]+)',
				r'([A-Z]{2,5}-[0-9]{4,})',
			]
			
			for pattern in ref_patterns:
				match = re.search(pattern, text_content)
				if match:
					opportunity['reference_number'] = match.group(1)
					break
			
			# Extract links
			links = element.find_all('a', href=True)
			if links:
				opportunity['links'] = [
					{
						'text': link.get_text(strip=True),
						'url': link['href']
					}
					for link in links[:3]  # Limit number of links
				]
			
			return opportunity
			
		except Exception as e:
			self.logger.debug(f"Error extracting opportunity from element: {e}")
			return {}
	
	async def _process_clustered_content(self, clustered_data: Any) -> List[Dict[str, Any]]:
		"""Process content from Cosine clustering strategy"""
		opportunities = []
		
		try:
			if isinstance(clustered_data, dict) and 'clusters' in clustered_data:
				for cluster in clustered_data['clusters']:
					if isinstance(cluster, dict) and 'content' in cluster:
						# Process cluster content to extract opportunity data
						content_items = cluster['content']
						for item in content_items:
							if isinstance(item, str) and len(item) > 20:
								# Extract opportunity from text content
								opportunity = self._extract_opportunity_from_text(item)
								if opportunity:
									opportunities.append(opportunity)
			
		except Exception as e:
			self.logger.debug(f"Error processing clustered content: {e}")
		
		return opportunities
	
	def _extract_opportunity_from_text(self, text: str) -> Dict[str, Any]:
		"""Extract opportunity data from plain text"""
		if len(text) < 20:
			return {}
		
		# Use first sentence or first 100 chars as title
		sentences = text.split('. ')
		title = sentences[0][:100] if sentences else text[:100]
		
		return {
			'title': title,
			'description': text[:500],
			'source': 'cosine_cluster'
		}
	
	async def _analyze_screenshot_for_opportunities(self, screenshot_bytes: bytes, page: Page) -> List[Dict[str, Any]]:
		"""Analyze screenshot using computer vision to identify opportunities"""
		try:
			# Convert screenshot to OpenCV format
			image = Image.open(io.BytesIO(screenshot_bytes))
			opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
			
			# Detect text regions using EAST or similar
			opportunities = []
			
			# Simple approach: detect rectangular regions that might be opportunity cards
			gray = cv2.cvtColor(opencv_image, cv2.COLOR_BGR2GRAY)
			
			# Find contours that might represent opportunity cards
			edges = cv2.Canny(gray, 50, 150)
			contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
			
			# Filter contours by size and aspect ratio
			for contour in contours:
				area = cv2.contourArea(contour)
				if 1000 < area < 50000:  # Reasonable size for opportunity cards
					x, y, w, h = cv2.boundingRect(contour)
					
					# Check aspect ratio (should be wider than tall for most cards)
					if w > h and w/h < 4:
						# This might be an opportunity card
						# Try to extract text from this region using page coordinates
						try:
							# Convert image coordinates to page coordinates
							viewport = page.viewport_size
							scale_x = viewport['width'] / opencv_image.shape[1]
							scale_y = viewport['height'] / opencv_image.shape[0]
							
							page_x = x * scale_x
							page_y = y * scale_y
							page_w = w * scale_x
							page_h = h * scale_y
							
							# Extract text from this region
							element = await page.locator(f'*').bounding_box()
							# This is simplified - in practice, you'd need more sophisticated
							# coordinate mapping and OCR
							
							opportunities.append({
								'title': f'Opportunity at ({x}, {y})',
								'description': 'Detected via computer vision',
								'confidence': 0.3
							})
							
						except Exception as e:
							self.logger.debug(f"Error extracting text from vision region: {e}")
			
			return opportunities[:5]  # Limit results
			
		except Exception as e:
			self.logger.error(f"Vision analysis failed: {e}")
			return []
	
	async def _update_site_structure(
		self, 
		domain: str, 
		scraping_result: ScrapingResult, 
		extraction_result: ExtractionResult
	):
		"""Learn and update site structure based on successful extractions"""
		if domain not in self.site_structures:
			self.site_structures[domain] = SiteStructure(domain=domain)
		
		structure = self.site_structures[domain]
		
		# Update confidence based on extraction success
		if extraction_result.valid_items_found > 0:
			structure.extraction_success_rate = (
				(structure.extraction_success_rate * 0.8) + 
				(extraction_result.valid_items_found / extraction_result.total_items_found * 0.2)
			)
			
			# Increase confidence
			structure.confidence_score = min(1.0, structure.confidence_score + 0.1)
		else:
			# Decrease confidence
			structure.confidence_score = max(0.0, structure.confidence_score - 0.05)
		
		# Learn about site characteristics
		if scraping_result.html_content:
			soup = BeautifulSoup(scraping_result.html_content, 'html.parser')
			
			# Detect Cloudflare
			if 'cloudflare' in scraping_result.html_content.lower():
				structure.has_cloudflare = True
			
			# Detect JavaScript requirements
			if len(soup.find_all('script')) > 5:
				structure.requires_javascript = True
			
			# Try to learn selectors (simplified)
			if extraction_result.extraction_method == "playwright_css":
				# Update selector learning logic here
				pass
		
		structure.last_updated = datetime.now(timezone.utc)
		self.logger.info(f"Updated structure for {domain} (confidence: {structure.confidence_score:.2f})")
	
	async def extract_opportunities(self, result: ScrapingResult) -> List[Dict[str, Any]]:
		"""Extract opportunities from scraping result (implements BaseScraper abstract method)"""
		if not result.html_content:
			return []
		
		extraction_result = await self._extract_opportunities_from_html(result.html_content, "base_method")
		return extraction_result.opportunities
	
	async def validate_opportunity(self, opportunity: Dict[str, Any]) -> bool:
		"""Validate an extracted opportunity (implements BaseScraper abstract method)"""
		# Basic validation - must have title and some content
		if not opportunity.get('title'):
			return False
		
		title = str(opportunity['title']).strip()
		if len(title) < 5:
			return False
		
		# Check for spam indicators
		spam_indicators = ['viagra', 'casino', 'lottery', 'click here']
		title_lower = title.lower()
		if any(indicator in title_lower for indicator in spam_indicators):
			return False
		
		return True
	
	def get_extraction_stats(self) -> Dict[str, Any]:
		"""Get statistics about extraction performance"""
		stats = self.extraction_stats.copy()
		
		if stats['total_extractions'] > 0:
			stats['success_rate'] = stats['successful_extractions'] / stats['total_extractions']
		
		stats['learned_sites'] = len(self.site_structures)
		stats['avg_site_confidence'] = sum(
			s.confidence_score for s in self.site_structures.values()
		) / len(self.site_structures) if self.site_structures else 0
		
		return stats
	
	async def cleanup(self):
		"""Clean up resources"""
		await super().cleanup()
		
		# Clean up Crawlee
		if self.crawlee_crawler:
			try:
				await self.crawlee_crawler.tear_down()
			except Exception as e:
				self.logger.warning(f"Crawlee cleanup failed: {e}")
		
		# Clean up Playwright
		if self.browser:
			await self.browser.close()
		
		if self.playwright:
			await self.playwright.stop()
		
		# Clean up CloudScraper
		if hasattr(self.cloudscraper_session, 'close'):
			self.cloudscraper_session.close()


# Factory function for easy instantiation
def create_universal_scraper(
	requests_per_second: float = 0.5,  # Conservative rate limiting
	use_proxies: bool = True,
	max_retries: int = 3
) -> UniversalScraper:
	"""Create a configured UniversalScraper instance"""
	config = ScrapingConfiguration(
		requests_per_second=requests_per_second,
		max_retries=max_retries,
		enable_proxy_rotation=use_proxies,
		request_timeout=45,
		page_load_timeout=60
	)
	
	return UniversalScraper(config)