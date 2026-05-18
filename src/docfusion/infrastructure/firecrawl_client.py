"""
Firecrawl Client

Client for self-hosted Firecrawl instance for web scraping.
Handles JavaScript-rendered pages via headless Chromium.

Server: Configured via FIRECRAWL_URL environment variable
Key: Configured via FIRECRAWL_KEY environment variable (use SecretsManager)

Usage:
    async with FirecrawlClient() as client:
        result = await client.scrape("https://example.com")
        print(result.markdown)

        # Extract structured data
        data = await client.scrape(
            "https://reliefweb.int/report",
            extract_schema={"title": "string", "date": "string"}
        )
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import httpx

# Import secrets manager for centralized configuration
from ..config.secrets import SecretsManager

logger = logging.getLogger(__name__)


class OutputFormat(str, Enum):
	"""Output formats for scraped content."""
	MARKDOWN = "markdown"
	HTML = "html"
	RAW_HTML = "rawHtml"
	SCREENSHOT = "screenshot"
	LINKS = "links"


def _get_default_timeout() -> int:
	"""Get default timeout via SecretsManager or return 60 seconds."""
	return SecretsManager.get_firecrawl_timeout()


@dataclass
class ScrapeResult:
	"""Result from scraping a single URL."""
	success: bool
	url: str = ""
	markdown: str = ""
	html: str = ""
	links: list[str] = field(default_factory=list)
	metadata: dict[str, Any] = field(default_factory=dict)
	extract: dict[str, Any] = field(default_factory=dict)
	error: str | None = None

	@property
	def title(self) -> str:
		"""Get page title from metadata."""
		return self.metadata.get("title", "")

	@property
	def description(self) -> str:
		"""Get page description from metadata."""
		return self.metadata.get("description", "")


@dataclass
class CrawlJob:
	"""Crawl job status."""
	id: str
	status: str  # scraping, completed, failed
	total: int = 0
	completed: int = 0
	data: list[ScrapeResult] = field(default_factory=list)
	error: str | None = None


@dataclass
class CrawlOptions:
	"""Options for website crawling."""
	max_depth: int = 2
	limit: int = 10
	exclude_paths: list[str] = field(default_factory=list)
	include_paths: list[str] = field(default_factory=list)
	allow_backward_links: bool = False
	allow_external_links: bool = False


@dataclass
class ScrapeOptions:
	"""Options for scraping a URL."""
	formats: list[OutputFormat | str] = field(default_factory=lambda: [OutputFormat.MARKDOWN])
	only_main_content: bool = True
	wait_for: int = 0  # milliseconds
	timeout: int = 30000  # milliseconds
	include_tags: list[str] = field(default_factory=list)
	exclude_tags: list[str] = field(default_factory=list)
	headers: dict[str, str] = field(default_factory=dict)
	extract_schema: dict[str, Any] | None = None
	extract_prompt: str | None = None


class FirecrawlClient:
	"""
	Async client for self-hosted Firecrawl.

	Firecrawl converts web pages to clean markdown and can extract
	structured data using LLM-based extraction.

	Attributes:
		base_url: Firecrawl server URL
		api_key: API key (optional for self-hosted)
		timeout: Request timeout in seconds

	Example:
		async with FirecrawlClient() as client:
			result = await client.scrape("https://example.com")
			if result.success:
				print(result.markdown)
	"""

	def __init__(
		self,
		base_url: str | None = None,
		api_key: str | None = None,
		timeout: int | None = None,
	):
		self.base_url = (base_url or SecretsManager.get_firecrawl_url()).rstrip("/")
		self.api_key = api_key or SecretsManager.get_firecrawl_key()
		self.timeout = timeout or _get_default_timeout()
		self._client: httpx.AsyncClient | None = None

	async def __aenter__(self) -> "FirecrawlClient":
		"""Async context manager entry."""
		self._client = httpx.AsyncClient(timeout=self.timeout)
		return self

	async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
		"""Async context manager exit."""
		if self._client:
			await self._client.aclose()
			self._client = None

	@property
	def client(self) -> httpx.AsyncClient:
		"""Get or create HTTP client."""
		if self._client is None:
			self._client = httpx.AsyncClient(timeout=self.timeout)
		return self._client

	def _get_headers(self) -> dict[str, str]:
		"""Get request headers with auth."""
		headers = {"Content-Type": "application/json"}
		if self.api_key:
			headers["Authorization"] = f"Bearer {self.api_key}"
		return headers

	async def scrape(
		self,
		url: str,
		options: ScrapeOptions | None = None,
	) -> ScrapeResult:
		"""
		Scrape a single URL.

		Args:
			url: URL to scrape
			options: Scraping options

		Returns:
			ScrapeResult with markdown/html content

		Raises:
			httpx.HTTPError: On network/HTTP errors
		"""
		options = options or ScrapeOptions()

		payload = {
			"url": url,
			"formats": [
				f.value if isinstance(f, OutputFormat) else f
				for f in options.formats
			],
			"onlyMainContent": options.only_main_content,
			"waitFor": options.wait_for,
			"timeout": options.timeout,
		}

		if options.include_tags:
			payload["includeTags"] = options.include_tags
		if options.exclude_tags:
			payload["excludeTags"] = options.exclude_tags
		if options.headers:
			payload["headers"] = options.headers
		if options.extract_schema:
			payload["extract"] = {
				"schema": options.extract_schema,
			}
			if options.extract_prompt:
				payload["extract"]["prompt"] = options.extract_prompt

		try:
			response = await self.client.post(
				f"{self.base_url}/v1/scrape",
				json=payload,
				headers=self._get_headers(),
			)
			response.raise_for_status()

			data = response.json()

			if not data.get("success", False):
				return ScrapeResult(
					success=False,
					url=url,
					error=data.get("error", "Unknown error"),
				)

			result_data = data.get("data", {})
			metadata = result_data.get("metadata", {})

			return ScrapeResult(
				success=True,
				url=url,
				markdown=result_data.get("markdown", ""),
				html=result_data.get("html", ""),
				links=result_data.get("links", []),
				metadata=metadata,
				extract=result_data.get("extract", {}),
			)

		except httpx.HTTPError as e:
			logger.error(f"Firecrawl scrape failed for {url}: {e}")
			return ScrapeResult(
				success=False,
				url=url,
				error=str(e),
			)

	async def crawl(
		self,
		url: str,
		options: CrawlOptions | None = None,
		scrape_options: ScrapeOptions | None = None,
	) -> str:
		"""
		Start a website crawl (async job).

		Args:
			url: Starting URL
			options: Crawl options
			scrape_options: Options for each page

		Returns:
			Crawl job ID

		Raises:
			httpx.HTTPError: On network/HTTP errors
		"""
		options = options or CrawlOptions()
		scrape_options = scrape_options or ScrapeOptions()

		payload = {
			"url": url,
			"limit": options.limit,
			"maxDepth": options.max_depth,
			"allowBackwardLinks": options.allow_backward_links,
			"allowExternalLinks": options.allow_external_links,
			"scrapeOptions": {
				"formats": [
					f.value if isinstance(f, OutputFormat) else f
					for f in scrape_options.formats
				],
				"onlyMainContent": scrape_options.only_main_content,
			},
		}

		if options.exclude_paths:
			payload["excludePaths"] = options.exclude_paths
		if options.include_paths:
			payload["includePaths"] = options.include_paths

		response = await self.client.post(
			f"{self.base_url}/v1/crawl",
			json=payload,
			headers=self._get_headers(),
		)
		response.raise_for_status()

		data = response.json()
		return data.get("id", "")

	async def get_crawl_status(self, crawl_id: str) -> CrawlJob:
		"""
		Get crawl job status.

		Args:
			crawl_id: Crawl job ID from crawl()

		Returns:
			CrawlJob with status and results
		"""
		response = await self.client.get(
			f"{self.base_url}/v1/crawl/{crawl_id}",
			headers=self._get_headers(),
		)
		response.raise_for_status()

		data = response.json()

		results = []
		for item in data.get("data", []):
			results.append(ScrapeResult(
				success=True,
				url=item.get("metadata", {}).get("sourceURL", ""),
				markdown=item.get("markdown", ""),
				html=item.get("html", ""),
				metadata=item.get("metadata", {}),
			))

		return CrawlJob(
			id=crawl_id,
			status=data.get("status", "unknown"),
			total=data.get("total", 0),
			completed=data.get("completed", 0),
			data=results,
			error=data.get("error"),
		)

	async def cancel_crawl(self, crawl_id: str) -> bool:
		"""
		Cancel a crawl job.

		Args:
			crawl_id: Crawl job ID

		Returns:
			True if cancelled successfully
		"""
		try:
			response = await self.client.delete(
				f"{self.base_url}/v1/crawl/{crawl_id}",
				headers=self._get_headers(),
			)
			return response.status_code == 200
		except Exception as e:
			logger.warning(f"Firecrawl crawl cancel failed for {crawl_id}: {e}")
			return False

	async def map_website(
		self,
		url: str,
		search: str | None = None,
		include_subdomains: bool = False,
		limit: int = 100,
	) -> list[str]:
		"""
		Map website URLs (fast, no content scraping).

		Args:
			url: Website URL
			search: Search query to filter URLs
			include_subdomains: Include subdomains
			limit: Maximum URLs to return

		Returns:
			List of URLs found on the website
		"""
		payload = {
			"url": url,
			"limit": limit,
			"includeSubdomains": include_subdomains,
		}
		if search:
			payload["search"] = search

		response = await self.client.post(
			f"{self.base_url}/v1/map",
			json=payload,
			headers=self._get_headers(),
		)
		response.raise_for_status()

		data = response.json()
		return data.get("links", [])

	async def extract_opportunities(
		self,
		url: str,
		extract_schema: dict[str, Any] | None = None,
	) -> list[dict[str, Any]]:
		"""
		Extract structured opportunity data from a URL.

		Args:
			url: URL to scrape
			extract_schema: Custom JSON schema for extraction

		Returns:
			List of extracted opportunities
		"""
		# Default opportunity extraction schema
		schema = extract_schema or {
			"type": "object",
			"properties": {
				"opportunities": {
					"type": "array",
					"items": {
						"type": "object",
						"properties": {
							"title": {"type": "string"},
							"organization": {"type": "string"},
							"deadline": {"type": "string"},
							"reference": {"type": "string"},
							"category": {"type": "string"},
							"location": {"type": "string"},
							"budget": {"type": "string"},
							"description": {"type": "string"},
							"url": {"type": "string"},
						},
					},
				},
			},
		}

		options = ScrapeOptions(
			formats=[OutputFormat.MARKDOWN],
			extract_schema=schema,
		)

		result = await self.scrape(url, options)

		if not result.success:
			return []

		opportunities = result.extract.get("opportunities", [])

		# Add source URL if not present
		for opp in opportunities:
			if "url" not in opp or not opp["url"]:
				opp["url"] = url
			opp["source_url"] = url

		return opportunities

	async def health_check(self) -> bool:
		"""
		Check if Firecrawl is accessible.

		Returns:
			True if health check passes
		"""
		try:
			# Try to scrape a simple URL
			response = await self.client.post(
				f"{self.base_url}/v1/scrape",
				json={"url": "https://example.com", "formats": ["markdown"]},
				headers=self._get_headers(),
				timeout=10.0,
			)
			return response.status_code == 200
		except Exception as e:
			logger.warning(f"Firecrawl health check failed: {e}")
			return False

	async def close(self) -> None:
		"""Close the HTTP client."""
		if self._client:
			await self._client.aclose()
			self._client = None


# Singleton instance
_default_client: FirecrawlClient | None = None


async def get_firecrawl_client() -> FirecrawlClient:
	"""Get or create the default Firecrawl client."""
	global _default_client
	if _default_client is None:
		_default_client = FirecrawlClient()
	return _default_client