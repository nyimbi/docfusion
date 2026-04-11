"""
SearXNG Client

Client for SearXNG metasearch engine running on PJS infrastructure.
Aggregates results from Google, Bing, DuckDuckGo, and 70+ other sources.

Server: http://84.247.181.100:8888 (search.lindela.io)

Usage:
    client = SearXNGClient()
    results = await client.search("kenya conflict 2026", time_range="month")
    for result in results.results:
        logger.info(f"{result.title}: {result.url}")
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any

import httpx

from ..config.secrets import SecretsManager

logger = logging.getLogger(__name__)

# Configuration via SecretsManager
SEARXNG_URL = SecretsManager.get_searxng_url()
SEARXNG_TIMEOUT = SecretsManager.get_searxng_timeout()


class SearchCategory(str, Enum):
	"""SearXNG search categories."""
	GENERAL = "general"
	IMAGES = "images"
	VIDEOS = "videos"
	NEWS = "news"
	FILES = "files"
	IT = "it"
	SCIENCE = "science"
	SOCIAL_MEDIA = "social media"


class TimeRange(str, Enum):
	"""Time range filters."""
	DAY = "day"
	WEEK = "week"
	MONTH = "month"
	YEAR = "year"


@dataclass
class SearchResult:
	"""A single search result from SearXNG."""
	title: str
	url: str
	content: str = ""
	engine: str = ""
	score: float = 0.0
	category: str = "general"
	thumbnail: str | None = None
	published_date: datetime | None = None
	metadata: dict[str, Any] = field(default_factory=dict)

	@classmethod
	def from_dict(cls, data: dict[str, Any]) -> SearchResult:
		"""Create from SearXNG API response."""
		published_date = None
		if data.get("publishedDate"):
			try:
				published_date = datetime.fromisoformat(data["publishedDate"].replace("Z", "+00:00"))
			except (ValueError, TypeError):
				logger.warning("ValueError/TypeError in from_dict")

		return cls(
			title=data.get("title", ""),
			url=data.get("url", ""),
			content=data.get("content", ""),
			engine=data.get("engine", ""),
			score=data.get("score", 0.0),
			category=data.get("category", "general"),
			thumbnail=data.get("thumbnail"),
			published_date=published_date,
			metadata=data.get("metadata", {}),
		)


@dataclass
class SearchResponse:
	"""Response from SearXNG search."""
	query: str
	number_of_results: int
	results: list[SearchResult]
	suggestions: list[str] = field(default_factory=list)
	unresponsive_engines: list[str] = field(default_factory=list)
	answers: list[str] = field(default_factory=list)
	infoboxes: list[dict[str, Any]] = field(default_factory=list)


class SearXNGClient:
	"""
	Async client for SearXNG metasearch engine.

	SearXNG aggregates results from multiple search engines without tracking.
	Provides JSON API for programmatic search.

	Attributes:
		base_url: SearXNG server URL
		timeout: Request timeout in seconds
		client: Async HTTP client

	Example:
		async with SearXNGClient() as client:
			response = await client.search("RFP opportunities Kenya")
			for result in response.results:
				logger.info(f"{result.title}: {result.url}")
	"""

	def __init__(
		self,
		base_url: str | None = None,
		timeout: int | None = None,
	):
		self.base_url = (base_url or SEARXNG_URL).rstrip("/")
		self.timeout = timeout or SEARXNG_TIMEOUT
		self._client: httpx.AsyncClient | None = None

	async def __aenter__(self) -> "SearXNGClient":
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

	async def search(
		self,
		query: str,
		categories: list[SearchCategory | str] | None = None,
		engines: list[str] | None = None,
		language: str = "en",
		time_range: TimeRange | str | None = None,
		page: int = 1,
		safesearch: int = 0,
	) -> SearchResponse:
		"""
		Perform a web search using SearXNG.

		Args:
			query: Search query string
			categories: Filter by categories (general, news, images, etc.)
			engines: Specific search engines to use
			language: Language code (en, fr, sw, etc.)
			time_range: Filter by recency (day, week, month, year)
			page: Page number (1-indexed)
			safesearch: Safe search level (0=off, 1=moderate, 2=strict)

		Returns:
			SearchResponse with results and metadata

		Raises:
			httpx.HTTPError: On network/HTTP errors
		"""
		params = {
			"q": query,
			"format": "json",
			"language": language,
			"pageno": page,
			"safesearch": safesearch,
		}

		if categories:
			params["categories"] = ",".join(
				c.value if isinstance(c, SearchCategory) else c
				for c in categories
			)

		if engines:
			params["engines"] = ",".join(engines)

		if time_range:
			params["time_range"] = (
				time_range.value if isinstance(time_range, TimeRange) else time_range
			)

		try:
			response = await self.client.get(
				f"{self.base_url}/search",
				params=params,
				headers={"Accept": "application/json"},
			)
			response.raise_for_status()

			data = response.json()

			results = [
				SearchResult.from_dict(r)
				for r in data.get("results", [])
			]

			return SearchResponse(
				query=data.get("query", query),
				number_of_results=data.get("number_of_results", len(results)),
				results=results,
				suggestions=data.get("suggestions", []),
				unresponsive_engines=data.get("unresponsive_engines", []),
				answers=data.get("answers", []),
				infoboxes=data.get("infoboxes", []),
			)

		except httpx.HTTPError as e:
			logger.error(f"SearXNG search failed: {e}")
			raise

	async def search_documents(
		self,
		query: str,
		file_types: list[str] | None = None,
		time_range: TimeRange | str | None = None,
	) -> list[SearchResult]:
		"""
		Search for documents (PDFs, DOCX, etc.).

		Args:
			query: Search query
			file_types: File extensions to filter (pdf, docx, doc, xlsx)
			time_range: Filter by recency

		Returns:
			List of search results for documents
		"""
		file_types = file_types or ["pdf", "docx", "doc"]

		# Add filetype constraints to query
		filetype_query = " OR ".join(f"filetype:{ft}" for ft in file_types)
		full_query = f"{query} ({filetype_query})"

		response = await self.search(
			query=full_query,
			categories=[SearchCategory.FILES],
			time_range=time_range,
		)

		# Filter results by file extension
		filtered = []
		for result in response.results:
			url_lower = result.url.lower()
			if any(url_lower.endswith(f".{ft}") or f".{ft}?" in url_lower for ft in file_types):
				filtered.append(result)

		return filtered

	async def search_opportunities(
		self,
		keywords: list[str],
		organizations: list[str] | None = None,
		countries: list[str] | None = None,
		time_range: TimeRange | str | None = TimeRange.MONTH,
	) -> list[SearchResult]:
		"""
		Search for RFP/opportunity announcements.

		Args:
			keywords: Search keywords
			organizations: Issuing organizations to filter
			countries: Countries to filter
			time_range: Filter by recency

		Returns:
			List of opportunity-related search results
		"""
		# Build search query
		query_parts = list(keywords)

		# Add opportunity-specific terms
		query_parts.extend(["tender", "RFP", "RFQ", "EOI", "procurement", "bid"])

		# Add organization filters
		if organizations:
			for org in organizations[:3]:
				query_parts.append(f'"{org}"')

		# Add country filters
		if countries:
			for country in countries[:2]:
				query_parts.append(country)

		query = " ".join(query_parts)

		response = await self.search(
			query=query,
			categories=[SearchCategory.GENERAL, SearchCategory.NEWS],
			time_range=time_range,
		)

		return response.results

	async def search_multiple(
		self,
		queries: list[str],
		**kwargs,
	) -> dict[str, list[SearchResult]]:
		"""
		Execute multiple searches in parallel.

		Args:
			queries: List of search queries
			**kwargs: Additional search parameters

		Returns:
			Dictionary mapping queries to their results
		"""
		async def search_one(q: str) -> tuple[str, list[SearchResult]]:
			try:
				response = await self.search(q, **kwargs)
				return q, response.results
			except Exception as e:
				logger.error(f"Search failed for '{q}': {e}")
				return q, []

		results = await asyncio.gather(*[search_one(q) for q in queries])
		return dict(results)

	async def health_check(self) -> bool:
		"""
		Check if SearXNG is accessible.

		Returns:
			True if health check passes
		"""
		try:
			response = await self.client.get(
				f"{self.base_url}/health",
				timeout=5.0,
			)
			return response.status_code == 200
		except Exception:
			return False

	async def close(self) -> None:
		"""Close the HTTP client."""
		if self._client:
			await self._client.aclose()
			self._client = None


# Singleton instance for convenience
_default_client: SearXNGClient | None = None


async def get_searxng_client() -> SearXNGClient:
	"""Get or create the default SearXNG client."""
	global _default_client
	if _default_client is None:
		_default_client = SearXNGClient()
	return _default_client