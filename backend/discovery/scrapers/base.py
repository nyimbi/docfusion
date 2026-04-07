"""
TenderSourceMax Base Scraper
============================

Abstract base class for all tender/RFP scrapers.

Provides:
	- Async HTTP client with connection pooling
	- Rate limiting per source
	- Retry logic with exponential backoff
	- Proxy rotation support
	- User-agent rotation
	- Session management
	- Error logging and metrics collection

All scrapers must inherit from BaseScraper and implement:
	- source_id: str (class attribute)
	- source_name: str (class attribute)
	- base_url: str (class attribute)
	- async scrape() -> list[ScrapedOpportunity]

Example:
	class UNGMScraper(BaseScraper):
		source_id = "ungm"
		source_name = "UN Global Marketplace"
		base_url = "https://www.ungm.org"

		async def scrape(self) -> list[ScrapedOpportunity]:
			html = await self.fetch_page("/Public/Notice")
			return self.parse_notices(html)

Architecture:
	BaseScraper uses httpx for async HTTP with HTTP/2 support.
	For JavaScript-heavy sites, use PlaywrightScraper subclass.
"""

from __future__ import annotations

import asyncio
import logging
import random
import re
import time
from abc import ABC, abstractmethod
from datetime import datetime, date, timezone
from typing import Any, ClassVar
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from backend.discovery.models.opportunity import (
	ScrapedOpportunity,
	ScraperResult,
	ScrapeMetrics,
	ScraperStatus,
	OpportunityType,
	SourceType,
)
from backend.discovery.pipeline.categorizer import OpportunityCategorizer

# ============================================================================
# Configuration
# ============================================================================

# User agents to rotate (modern browsers)
USER_AGENTS = [
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
]

# Default request settings
DEFAULT_TIMEOUT = 30  # seconds
DEFAULT_RATE_LIMIT = 1.0  # requests per second
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2  # exponential backoff base

# Logging setup
logger = logging.getLogger(__name__)


# ============================================================================
# Date Parsing
# ============================================================================

DATE_FORMATS = [
	"%Y-%m-%d",
	"%d-%m-%Y",
	"%d/%m/%Y",
	"%m/%d/%Y",
	"%d %B %Y",
	"%d %b %Y",
	"%B %d, %Y",
	"%b %d, %Y",
	"%Y/%m/%d",
	"%d.%m.%Y",
	"%d-%b-%Y",
	"%d-%B-%Y",
	"%Y%m%d",
]


def parse_date(date_str: str | None) -> date | None:
	"""
	Parse various date formats to date object.

	Args:
		date_str: Date string to parse

	Returns:
		date object or None if parsing fails
	"""
	if not date_str:
		return None

	date_str = date_str.strip()

	for fmt in DATE_FORMATS:
		try:
			dt = datetime.strptime(date_str, fmt)
			return dt.date()
		except ValueError:
			continue

	# Try to extract date from text like "Deadline: 15 Feb 2026"
	month_pattern = r"(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{4})"
	match = re.search(month_pattern, date_str.lower())
	if match:
		day, month_str, year = match.groups()
		month_map = {
			"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
			"jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
		}
		try:
			return date(int(year), month_map[month_str[:3]], int(day))
		except (ValueError, KeyError):
			pass

	return None


# ============================================================================
# Base Scraper
# ============================================================================

class BaseScraper(ABC):
	"""
	Abstract base class for all tender scrapers.

	Provides common functionality for HTTP requests, rate limiting,
	error handling, and metrics collection.

	Subclasses must define:
		- source_id: Unique identifier for this source
		- source_name: Human-readable name
		- base_url: Base URL for the source
		- scrape(): Async method that returns list of opportunities

	Example:
		class MyPortalScraper(BaseScraper):
			source_id = "myportal"
			source_name = "My Portal"
			base_url = "https://myportal.gov"

			async def scrape(self) -> list[ScrapedOpportunity]:
				html = await self.fetch_page("/tenders")
				return self.parse_tenders(html)
	"""

	# Class attributes to be defined by subclasses
	source_id: ClassVar[str] = ""
	source_name: ClassVar[str] = ""
	base_url: ClassVar[str] = ""
	source_type: ClassVar[SourceType] = SourceType.AGGREGATOR

	# Scraping configuration
	rate_limit: float = DEFAULT_RATE_LIMIT  # requests per second
	timeout: int = DEFAULT_TIMEOUT  # seconds
	max_retries: int = MAX_RETRIES
	requires_javascript: bool = False

	def __init__(
		self,
		*,
		rate_limit: float | None = None,
		timeout: int | None = None,
		proxies: list[str] | None = None,
		headers: dict[str, str] | None = None,
	) -> None:
		"""
		Initialize scraper.

		Args:
			rate_limit: Override default rate limit (requests/second)
			timeout: Override default timeout (seconds)
			proxies: List of proxy URLs to rotate
			headers: Additional headers to include in requests
		"""
		self.rate_limit = rate_limit or self.rate_limit
		self.timeout = timeout or self.timeout
		self.proxies = proxies or []
		self.custom_headers = headers or {}

		# State
		self._client: httpx.AsyncClient | None = None
		self._last_request_time: float = 0
		self._request_count = 0
		self._bytes_downloaded = 0

		# Metrics
		self._metrics = ScrapeMetrics(
			source=self.source_id,
			started_at=datetime.now(timezone.utc),
		)
		self._errors: list[str] = []
		self._warnings: list[str] = []

		# Validate required attributes
		if not self.source_id:
			raise ValueError(f"{self.__class__.__name__} must define source_id")
		if not self.base_url:
			raise ValueError(f"{self.__class__.__name__} must define base_url")

	# =========================================================================
	# HTTP Client Management
	# =========================================================================

	async def _get_client(self) -> httpx.AsyncClient:
		"""Get or create HTTP client."""
		if self._client is None:
			self._client = httpx.AsyncClient(
				http2=True,
				follow_redirects=True,
				timeout=httpx.Timeout(self.timeout),
				headers=self._build_headers(),
			)
		return self._client

	async def close(self) -> None:
		"""Close HTTP client."""
		if self._client:
			await self._client.aclose()
			self._client = None

	def _build_headers(self) -> dict[str, str]:
		"""Build request headers with user-agent rotation."""
		headers = {
			"User-Agent": random.choice(USER_AGENTS),
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.9",
			"Accept-Encoding": "gzip, deflate, br",
			"DNT": "1",
			"Connection": "keep-alive",
			"Upgrade-Insecure-Requests": "1",
		}
		headers.update(self.custom_headers)
		return headers

	def _get_proxy(self) -> str | None:
		"""Get next proxy from rotation."""
		if not self.proxies:
			return None
		return random.choice(self.proxies)

	# =========================================================================
	# Rate Limiting
	# =========================================================================

	async def _wait_for_rate_limit(self) -> None:
		"""Wait if necessary to respect rate limit."""
		if self.rate_limit <= 0:
			return

		min_interval = 1.0 / self.rate_limit
		elapsed = time.time() - self._last_request_time

		if elapsed < min_interval:
			wait_time = min_interval - elapsed
			# Add small random jitter to avoid thundering herd
			wait_time += random.uniform(0.1, 0.5)
			logger.debug(f"[{self.source_id}] Rate limiting: waiting {wait_time:.2f}s")
			await asyncio.sleep(wait_time)

		self._last_request_time = time.time()

	# =========================================================================
	# HTTP Requests
	# =========================================================================

	async def fetch_page(
		self,
		url: str,
		*,
		method: str = "GET",
		params: dict[str, Any] | None = None,
		data: dict[str, Any] | None = None,
		json_data: dict[str, Any] | None = None,
		headers: dict[str, str] | None = None,
	) -> str:
		"""
		Fetch a web page with rate limiting and retry logic.

		Args:
			url: URL to fetch (relative or absolute)
			method: HTTP method
			params: Query parameters
			data: Form data
			json_data: JSON data
			headers: Additional headers

		Returns:
			Response text content

		Raises:
			httpx.HTTPError: If request fails after retries
		"""
		# Build absolute URL
		if not url.startswith(("http://", "https://")):
			url = urljoin(self.base_url, url)

		await self._wait_for_rate_limit()
		client = await self._get_client()

		last_error: Exception | None = None

		for attempt in range(self.max_retries):
			try:
				response = await client.request(
					method,
					url,
					params=params,
					data=data,
					json=json_data,
					headers=headers,
				)

				self._request_count += 1
				self._bytes_downloaded += len(response.content)

				response.raise_for_status()
				return response.text

			except httpx.HTTPStatusError as e:
				last_error = e
				status = e.response.status_code

				if status == 429:  # Rate limited
					self._metrics.rate_limit_hits += 1
					wait_time = 60 * (attempt + 1)  # Increasing backoff
					logger.warning(
						f"[{self.source_id}] Rate limited (429). "
						f"Waiting {wait_time}s before retry {attempt + 1}/{self.max_retries}"
					)
					await asyncio.sleep(wait_time)

				elif status in (500, 502, 503, 504):  # Server errors
					wait_time = RETRY_BACKOFF_BASE ** attempt
					logger.warning(
						f"[{self.source_id}] Server error ({status}). "
						f"Waiting {wait_time}s before retry {attempt + 1}/{self.max_retries}"
					)
					await asyncio.sleep(wait_time)

				else:
					# Don't retry client errors (4xx except 429)
					raise

			except httpx.RequestError as e:
				last_error = e
				wait_time = RETRY_BACKOFF_BASE ** attempt
				logger.warning(
					f"[{self.source_id}] Request error: {e}. "
					f"Waiting {wait_time}s before retry {attempt + 1}/{self.max_retries}"
				)
				await asyncio.sleep(wait_time)

		# All retries failed
		self._errors.append(f"Failed to fetch {url} after {self.max_retries} retries: {last_error}")
		raise last_error or Exception(f"Failed to fetch {url}")

	async def fetch_json(
		self,
		url: str,
		*,
		method: str = "GET",
		params: dict[str, Any] | None = None,
		data: dict[str, Any] | None = None,
		json_data: dict[str, Any] | None = None,
		headers: dict[str, str] | None = None,
	) -> dict[str, Any]:
		"""
		Fetch JSON data from URL.

		Args:
			url: URL to fetch
			method: HTTP method
			params: Query parameters
			data: Form data
			json_data: JSON request body
			headers: Additional headers

		Returns:
			Parsed JSON response
		"""
		if not url.startswith(("http://", "https://")):
			url = urljoin(self.base_url, url)

		await self._wait_for_rate_limit()
		client = await self._get_client()

		for attempt in range(self.max_retries):
			try:
				response = await client.request(
					method,
					url,
					params=params,
					data=data,
					json=json_data,
					headers=headers,
				)

				self._request_count += 1
				self._bytes_downloaded += len(response.content)

				response.raise_for_status()
				return response.json()

			except (httpx.HTTPStatusError, httpx.RequestError) as e:
				if attempt < self.max_retries - 1:
					wait_time = RETRY_BACKOFF_BASE ** attempt
					await asyncio.sleep(wait_time)
				else:
					self._errors.append(f"Failed to fetch JSON from {url}: {e}")
					raise

		return {}

	# =========================================================================
	# HTML Parsing Helpers
	# =========================================================================

	def parse_html(self, html: str) -> BeautifulSoup:
		"""Parse HTML content using BeautifulSoup."""
		return BeautifulSoup(html, "lxml")

	def clean_text(self, text: str | None) -> str:
		"""Clean and normalize text content."""
		if not text:
			return ""
		# Remove extra whitespace
		text = re.sub(r"\s+", " ", text)
		# Remove leading/trailing whitespace
		text = text.strip()
		return text

	def extract_text(self, element: Any, selector: str | None = None) -> str:
		"""
		Extract and clean text from BeautifulSoup element.

		Args:
			element: BeautifulSoup element
			selector: Optional CSS selector to find child element

		Returns:
			Cleaned text content
		"""
		if selector:
			element = element.select_one(selector)
		if not element:
			return ""
		return self.clean_text(element.get_text())

	def extract_link(self, element: Any, selector: str | None = None) -> str:
		"""
		Extract href link from element.

		Args:
			element: BeautifulSoup element
			selector: Optional CSS selector

		Returns:
			Absolute URL or empty string
		"""
		if selector:
			element = element.select_one(selector)
		if not element:
			return ""

		href = element.get("href", "")
		if href and not href.startswith(("http://", "https://", "mailto:")):
			href = urljoin(self.base_url, href)
		return href

	# Shared categorizer instance (class-level singleton to avoid recompiling
	# regex patterns for every scraper instance)
	_categorizer: ClassVar[OpportunityCategorizer | None] = None

	# =========================================================================
	# Category Detection
	# =========================================================================

	@classmethod
	def _get_categorizer(cls) -> OpportunityCategorizer:
		"""Lazily initialize and return the shared categorizer."""
		if cls._categorizer is None:
			cls._categorizer = OpportunityCategorizer()
		return cls._categorizer

	def detect_category(self, text: str) -> str:
		"""
		Detect opportunity category from text.

		Delegates to the canonical OpportunityCategorizer which uses primary,
		secondary, and exclusion keywords with regex-based matching.

		Override this method for source-specific category detection.

		Args:
			text: Text to analyze (title + description combined)

		Returns:
			Category name string (e.g. "IT Infrastructure", "Healthcare/HMIS")
		"""
		if not text:
			return "IT Infrastructure"

		categorizer = self._get_categorizer()
		result = categorizer.categorize(text)
		return result.primary_category.value

	# =========================================================================
	# Date Parsing
	# =========================================================================

	def parse_date(self, date_str: str | None) -> date | None:
		"""
		Parse date string to date object.

		Override this method for source-specific date formats.
		"""
		return parse_date(date_str)

	# =========================================================================
	# Opportunity Creation Helpers
	# =========================================================================

	def create_opportunity(
		self,
		source_id: str,
		title: str,
		**kwargs: Any,
	) -> ScrapedOpportunity:
		"""
		Create a ScrapedOpportunity with common defaults.

		Args:
			source_id: ID from source system
			title: Opportunity title
			**kwargs: Additional fields

		Returns:
			ScrapedOpportunity instance
		"""
		# Auto-detect category if not provided
		if "category" not in kwargs:
			text = f"{title} {kwargs.get('description', '')} {kwargs.get('scope', '')}"
			kwargs["category"] = self.detect_category(text)

		return ScrapedOpportunity(
			source_id=source_id,
			source=self.source_id,
			title=title,
			source_type=self.source_type,
			scraped_at=datetime.now(timezone.utc),
			**kwargs,
		)

	# =========================================================================
	# Scraping Execution
	# =========================================================================

	@abstractmethod
	async def scrape(self) -> list[ScrapedOpportunity]:
		"""
		Scrape opportunities from the source.

		Must be implemented by subclasses.

		Returns:
			List of scraped opportunities
		"""
		raise NotImplementedError

	async def run(self) -> ScraperResult:
		"""
		Execute the scraper and collect metrics.

		Returns:
			ScraperResult with opportunities and metrics
		"""
		self._metrics.started_at = datetime.now(timezone.utc)
		opportunities: list[ScrapedOpportunity] = []

		try:
			logger.info(f"[{self.source_id}] Starting scrape of {self.source_name}")
			opportunities = await self.scrape()

			self._metrics.status = ScraperStatus.SUCCESS
			self._metrics.opportunities_found = len(opportunities)
			logger.info(
				f"[{self.source_id}] Completed: found {len(opportunities)} opportunities"
			)

		except Exception as e:
			logger.error(f"[{self.source_id}] Scrape failed: {e}")
			self._metrics.status = ScraperStatus.FAILED
			self._errors.append(str(e))

		finally:
			await self.close()
			self._metrics.completed_at = datetime.now(timezone.utc)
			self._metrics.requests_made = self._request_count
			self._metrics.bytes_downloaded = self._bytes_downloaded
			self._metrics.errors = self._errors.copy()

		return ScraperResult(
			source=self.source_id,
			opportunities=opportunities,
			metrics=self._metrics,
			errors=self._errors,
			warnings=self._warnings,
		)

	# =========================================================================
	# Logging Helpers
	# =========================================================================

	def _log_info(self, message: str) -> None:
		"""Log info message with source prefix."""
		logger.info(f"[{self.source_id}] {message}")

	def _log_warning(self, message: str) -> None:
		"""Log warning and add to warnings list."""
		logger.warning(f"[{self.source_id}] {message}")
		self._warnings.append(message)

	def _log_error(self, message: str) -> None:
		"""Log error and add to errors list."""
		logger.error(f"[{self.source_id}] {message}")
		self._errors.append(message)
