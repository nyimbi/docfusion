"""
SearXNG Client

Client for SearXNG metasearch engine running on PJS infrastructure.
Aggregates results from Google, Bing, DuckDuckGo, and 70+ other sources.

Server: https://search.lindela.io

Usage:
    client = SearXNGClient()
    results = await client.search("kenya conflict 2026", time_range="month")
    for result in results.results:
        logger.info(f"{result.title}: {result.url}")
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import logging
import os
from typing import Any
from urllib.parse import urlparse, urlunparse

import httpx

from ..config.secrets import SecretsManager

logger = logging.getLogger(__name__)

# Configuration via SecretsManager
SEARXNG_URL = SecretsManager.get_searxng_url()
SEARXNG_TIMEOUT = SecretsManager.get_searxng_timeout()
DEFAULT_SEARXNG_SPACE_INSTANCES_URL = "https://searx.space/data/instances.json"
DEFAULT_SEARXNG_PUBLIC_FALLBACK_LIMIT = 8


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
	unresponsive_engines: list[Any] = field(default_factory=list)
	answers: list[str] = field(default_factory=list)
	infoboxes: list[dict[str, Any]] = field(default_factory=list)
	source_instance: str | None = None
	source_instances: list[str] = field(default_factory=list)
	fallback_from: str | None = None
	fallback_reason: str | None = None


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
		self.base_url = self._normalize_base_url(base_url or SEARXNG_URL) or SEARXNG_URL.rstrip("/")
		self.timeout = timeout or SEARXNG_TIMEOUT
		self._client: httpx.AsyncClient | None = None
		self._fallback_urls = self._parse_fallback_urls(os.getenv("SEARXNG_FALLBACK_URLS"))
		self._public_fallbacks_enabled = os.getenv("SEARXNG_PUBLIC_FALLBACKS") != "0"
		self._public_fallback_limit = self._coerce_public_fallback_limit()
		self._searxng_space_instances_url = (
			os.getenv("SEARXNG_SPACE_INSTANCES_URL")
			or DEFAULT_SEARXNG_SPACE_INSTANCES_URL
		)
		self._public_fallback_cache: dict[str, Any] | None = None

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
		limit: int | None = None,
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
			limit: Maximum results to return after merging fallbacks

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

		primary_payload: dict[str, Any] | None = None
		primary_error: Exception | None = None
		try:
			primary_payload = await self._fetch_search_payload(self.base_url, params)
		except Exception as exc:
			primary_error = exc
			logger.warning("Primary SearXNG search failed for %s: %s", self.base_url, exc)

		if primary_payload is not None and not self._should_try_fallback(primary_payload, engines):
			return self._payload_to_response(
				primary_payload,
				query=query,
				limit=limit,
				source_instances=[self.base_url],
			)

		fallback_payloads = await self._fetch_fallback_payloads(params, engines or [])
		usable_fallbacks = [
			(base_url, payload)
			for base_url, payload in fallback_payloads
			if payload.get("results")
		]

		if usable_fallbacks:
			payloads = []
			source_instances: list[str] = []
			if primary_payload is not None and primary_payload.get("results"):
				payloads.append(primary_payload)
				source_instances.append(self.base_url)
			payloads.extend(payload for _base_url, payload in usable_fallbacks)
			source_instances.extend(base_url for base_url, _payload in usable_fallbacks)
			fallback_reason = (
				self._describe_degradation(primary_payload, engines)
				if primary_payload is not None
				else str(primary_error or "primary SearXNG search failed")
			)
			logger.warning(
				"Used SearXNG fallback fanout after primary search degradation",
				extra={
					"primary_base_url": self.base_url,
					"fallback_base_urls": [base_url for base_url, _payload in usable_fallbacks],
					"fallback_reason": fallback_reason,
				},
			)
			return self._payload_to_response(
				self._merge_payloads(payloads, query),
				query=query,
				limit=limit,
				source_instances=source_instances,
				fallback_from=self.base_url,
				fallback_reason=fallback_reason,
			)

		if primary_payload is not None:
			return self._payload_to_response(
				primary_payload,
				query=query,
				limit=limit,
				source_instances=[self.base_url],
			)

		if primary_error is not None:
			logger.error(f"SearXNG search failed: {primary_error}")
			raise primary_error

		raise httpx.HTTPError("SearXNG search failed without a primary response")

	async def _fetch_search_payload(self, base_url: str, params: dict[str, Any]) -> dict[str, Any]:
		response = await self.client.get(
			f"{base_url}/search",
			params=params,
			headers={"Accept": "application/json"},
		)
		response.raise_for_status()
		return response.json()

	def _payload_to_response(
		self,
		data: dict[str, Any],
		*,
		query: str,
		limit: int | None,
		source_instances: list[str],
		fallback_from: str | None = None,
		fallback_reason: str | None = None,
	) -> SearchResponse:
		results = [
			SearchResult.from_dict(result)
			for result in data.get("results", [])
		]
		if limit is not None:
			results = results[:max(0, limit)]

		return SearchResponse(
			query=data.get("query", query),
			number_of_results=len(results),
			results=results,
			suggestions=data.get("suggestions", []),
			unresponsive_engines=data.get("unresponsive_engines", []),
			answers=data.get("answers", []),
			infoboxes=data.get("infoboxes", []),
			source_instance=source_instances[0] if source_instances else None,
			source_instances=source_instances,
			fallback_from=fallback_from,
			fallback_reason=fallback_reason,
		)

	def _should_try_fallback(self, payload: dict[str, Any], requested_engines: list[str] | None) -> bool:
		if not payload.get("results"):
			return True
		unresponsive = payload.get("unresponsive_engines") or []
		if unresponsive:
			if not requested_engines:
				return False
			return (
				self._has_requested_engine_degradation(payload, requested_engines)
				or bool(self._missing_requested_result_engines(payload, requested_engines))
			)
		return bool(self._missing_requested_result_engines(payload, requested_engines))

	def _describe_degradation(self, payload: dict[str, Any] | None, requested_engines: list[str] | None) -> str:
		if payload is None:
			return "primary SearXNG search failed"
		engines = ",".join(requested_engines or []) or "default engines"
		if not payload.get("results") and not payload.get("unresponsive_engines"):
			return f"{self.base_url} returned no results for {engines}; trying fallback fanout"
		degraded = "; ".join(
			self._describe_unresponsive_engine(engine)
			for engine in payload.get("unresponsive_engines") or []
		) or "unknown degradation"
		if (
			payload.get("results")
			and payload.get("unresponsive_engines")
			and self._has_requested_engine_degradation(payload, requested_engines)
		):
			return (
				f"{self.base_url} returned {len(payload.get('results') or [])} result(s) "
				f"but requested engine fanout degraded for {engines}; degraded engines: {degraded}"
			)
		missing_engines = self._missing_requested_result_engines(payload, requested_engines)
		if (
			payload.get("results")
			and missing_engines
			and len(missing_engines) == len(self._requested_search_engines(requested_engines))
		):
			observed = ", ".join(self._observed_result_engines(payload)) or "unknown engines"
			return (
				f"{self.base_url} returned {len(payload.get('results') or [])} result(s), "
				f"but none from requested engines {engines}; observed engines: {observed}"
			)
		if payload.get("results") and missing_engines:
			observed = ", ".join(self._observed_result_engines(payload)) or "unknown engines"
			return (
				f"{self.base_url} returned {len(payload.get('results') or [])} result(s), "
				f"but primary fanout missed requested engines {', '.join(missing_engines)}; "
				f"observed engines: {observed}"
			)
		return f"{self.base_url} degraded for {engines}: {degraded}"

	def _has_requested_engine_degradation(
		self,
		payload: dict[str, Any],
		requested_engines: list[str] | None,
	) -> bool:
		if not requested_engines:
			return False
		degraded = " ".join(
			self._describe_unresponsive_engine(engine)
			for engine in payload.get("unresponsive_engines") or []
		).lower()
		return any(engine.lower() in degraded for engine in requested_engines)

	def _has_requested_engine_mismatch(
		self,
		payload: dict[str, Any],
		requested_engines: list[str] | None,
	) -> bool:
		engines = self._requested_search_engines(requested_engines)
		missing = self._missing_requested_result_engines(payload, requested_engines)
		return bool(missing) and len(missing) == len(engines)

	def _requested_search_engines(self, requested_engines: list[str] | None) -> list[str]:
		engines: list[str] = []
		for engine in requested_engines or []:
			normalized = engine.strip().lower()
			if normalized and normalized not in engines:
				engines.append(normalized)
		return engines

	def _missing_requested_result_engines(
		self,
		payload: dict[str, Any],
		requested_engines: list[str] | None,
	) -> list[str]:
		engines = self._requested_search_engines(requested_engines)
		results = payload.get("results") or []
		if not engines or not results:
			return []
		missing: list[str] = []
		for engine in engines:
			has_result = False
			for result in results:
				result_engine = str(result.get("engine") or "").strip().lower()
				if result_engine == engine or result_engine.startswith(f"{engine} "):
					has_result = True
					break
			if not has_result:
				missing.append(engine)
		return missing

	def _observed_result_engines(self, payload: dict[str, Any]) -> list[str]:
		engines: list[str] = []
		seen: set[str] = set()
		for result in payload.get("results") or []:
			engine = str(result.get("engine") or "").strip()
			if not engine or engine in seen:
				continue
			seen.add(engine)
			engines.append(engine)
		return engines

	def _describe_unresponsive_engine(self, value: Any) -> str:
		if isinstance(value, (list, tuple)):
			return ": ".join(str(part) for part in value if part)
		if isinstance(value, dict):
			name = str(value.get("engine") or "unknown")
			reason = value.get("error") or value.get("message")
			return f"{name}: {reason}" if reason else name
		return str(value)

	async def _fetch_fallback_payloads(
		self,
		params: dict[str, Any],
		requested_engines: list[str],
	) -> list[tuple[str, dict[str, Any]]]:
		fallback_urls = await self._fallback_base_urls(requested_engines)
		if not fallback_urls:
			return []

		async def fetch_one(base_url: str) -> tuple[str, dict[str, Any]] | None:
			try:
				return base_url, await self._fetch_search_payload(base_url, params)
			except Exception as exc:
				logger.warning("SearXNG fallback search failed for %s: %s", base_url, exc)
				return None

		responses = await asyncio.gather(*(fetch_one(base_url) for base_url in fallback_urls))
		return [response for response in responses if response is not None]

	async def _fallback_base_urls(self, requested_engines: list[str]) -> list[str]:
		limit = self._public_fallback_limit
		if limit <= 0:
			return []
		configured = list(self._fallback_urls)
		if len(configured) >= limit:
			return configured[:limit]

		public_urls = await self._public_fallback_base_urls(requested_engines)
		seen: set[str] = set()
		urls: list[str] = []
		for raw_url in [*configured, *public_urls]:
			url = self._normalize_base_url(raw_url)
			if not url or url == self.base_url or url in seen:
				continue
			seen.add(url)
			urls.append(url)
		return urls[:limit]

	async def _public_fallback_base_urls(self, requested_engines: list[str]) -> list[str]:
		if not self._public_fallbacks_enabled:
			return []
		cache_key = ",".join(sorted(engine.strip().lower() for engine in requested_engines if engine.strip()))
		if (
			self._public_fallback_cache
			and self._public_fallback_cache.get("key") == cache_key
		):
			return list(self._public_fallback_cache.get("urls") or [])

		try:
			response = await self.client.get(
				self._searxng_space_instances_url,
				headers={"Accept": "application/json"},
			)
			response.raise_for_status()
			payload = response.json()
		except Exception as exc:
			logger.warning("Could not refresh searx.space fallback instances: %s", exc)
			self._public_fallback_cache = {"key": cache_key, "urls": []}
			return []

		candidates = [
			(url, instance)
			for url, instance in (payload.get("instances") or {}).items()
			if self._is_usable_public_instance(instance, requested_engines)
		]
		candidates.sort(
			key=lambda item: (
				-self._requested_engine_health_score(item[1], requested_engines),
				-(self._instance_search_success(item[1]) or 0),
				self._instance_search_median(item[1]),
			)
		)
		urls = [
			normalized
			for raw_url, _instance in candidates
			if (normalized := self._normalize_base_url(raw_url))
		]
		self._public_fallback_cache = {"key": cache_key, "urls": urls}
		return urls

	def _parse_fallback_urls(self, raw: str | None) -> list[str]:
		urls: list[str] = []
		for value in (raw or "").split(","):
			url = self._normalize_base_url(value)
			if url and url != self.base_url and url not in urls:
				urls.append(url)
		return urls

	def _coerce_public_fallback_limit(self) -> int:
		try:
			return max(
				0,
				min(
					int(os.getenv("SEARXNG_PUBLIC_FALLBACK_LIMIT", "")),
					12,
				),
			)
		except ValueError:
			return DEFAULT_SEARXNG_PUBLIC_FALLBACK_LIMIT

	def _normalize_base_url(self, value: str | None) -> str | None:
		parsed = urlparse(str(value or "").strip())
		if parsed.scheme not in {"http", "https"} or not parsed.netloc:
			return None
		return urlunparse((parsed.scheme, parsed.netloc, parsed.path.rstrip("/"), "", "", "")).rstrip("/")

	def _is_usable_public_instance(self, instance: Any, requested_engines: list[str]) -> bool:
		if not isinstance(instance, dict):
			return False
		http = instance.get("http") or {}
		if instance.get("error") or http.get("error"):
			return False
		if http.get("status_code") != 200:
			return False
		if instance.get("network_type") not in (None, "normal"):
			return False
		git_url = instance.get("git_url")
		if git_url and "searxng" not in str(git_url).lower():
			return False
		if self._instance_search_success(instance) == 0:
			return False
		return self._requested_engine_health_score(instance, requested_engines) >= 0

	def _requested_engine_health_score(self, instance: dict[str, Any], requested_engines: list[str]) -> float:
		normalized_engines = [engine.strip().lower() for engine in requested_engines if engine.strip()]
		if not normalized_engines:
			return 0
		error_rates = [
			rate
			for engine in normalized_engines
			if (rate := self._instance_engine_error_rate(instance, engine)) is not None
		]
		if not error_rates:
			return 0
		if all(rate >= 90 for rate in error_rates):
			return -1
		return 100 - (sum(error_rates) / len(error_rates))

	def _instance_engine_error_rate(self, instance: dict[str, Any], normalized_engine: str) -> float | None:
		for engine_name, engine in (instance.get("engines") or {}).items():
			if str(engine_name).strip().lower() != normalized_engine:
				continue
			try:
				return float((engine or {}).get("error_rate"))
			except (TypeError, ValueError):
				return None
		return None

	def _instance_search_success(self, instance: dict[str, Any]) -> float | None:
		value = (((instance.get("timing") or {}).get("search") or {}).get("success_percentage"))
		try:
			return float(value)
		except (TypeError, ValueError):
			return None

	def _instance_search_median(self, instance: dict[str, Any]) -> float:
		search_timing = ((instance.get("timing") or {}).get("search") or {})
		all_timing = search_timing.get("all") or {}
		value = all_timing.get("median", all_timing.get("value"))
		try:
			return float(value)
		except (TypeError, ValueError):
			return float("inf")

	def _merge_payloads(self, payloads: list[dict[str, Any]], query: str) -> dict[str, Any]:
		seen: set[str] = set()
		results: list[dict[str, Any]] = []
		for payload in payloads:
			for result in payload.get("results") or []:
				identity = self._search_result_identity(result)
				if identity in seen:
					continue
				seen.add(identity)
				results.append(result)
		return {
			"query": payloads[0].get("query", query) if payloads else query,
			"number_of_results": len(results),
			"results": results,
			"suggestions": self._merge_unique_strings(payloads, "suggestions"),
			"unresponsive_engines": [
				engine
				for payload in payloads
				for engine in (payload.get("unresponsive_engines") or [])
			],
			"answers": self._merge_unique_strings(payloads, "answers"),
			"infoboxes": [
				infobox
				for payload in payloads
				for infobox in (payload.get("infoboxes") or [])
			],
		}

	def _merge_unique_strings(self, payloads: list[dict[str, Any]], key: str) -> list[str]:
		values: list[str] = []
		seen: set[str] = set()
		for payload in payloads:
			for value in payload.get(key) or []:
				text = str(value).strip()
				if not text or text in seen:
					continue
				seen.add(text)
				values.append(text)
		return values

	def _search_result_identity(self, result: dict[str, Any]) -> str:
		url = str(result.get("url") or "").strip()
		if not url:
			return f"{result.get('engine')}:{result.get('title')}"
		parsed = urlparse(url)
		return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", parsed.query, ""))

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
		except Exception as e:
			logger.warning(f"SearXNG health check failed: {e}")
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
