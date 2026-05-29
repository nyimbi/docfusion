"""Interface for discovery operations used by agents.

Provides a Protocol-based abstraction over the discovery module so that
agents can depend on a stable interface rather than importing concrete
scrapers, analyzers, and matchers directly.
"""

import logging
import hashlib
import os
import re
from typing import Protocol, Any
from urllib.parse import urljoin, urlparse, urlunparse

logger = logging.getLogger(__name__)

DEFAULT_SEARXNG_URL = "https://search.lindela.io"
DEFAULT_SEARXNG_SPACE_INSTANCES_URL = "https://searx.space/data/instances.json"
DEFAULT_SEARXNG_PUBLIC_FALLBACK_LIMIT = 8
DEFAULT_FIRECRAWL_URL = "http://84.247.181.100:3002"
DEFAULT_FIRECRAWL_ENRICH_LIMIT = 3
MAX_SCRAPED_MARKDOWN_CHARS = 12_000


class DiscoveryServiceInterface(Protocol):
	"""Protocol defining the discovery operations contract.

	Any class implementing these methods can serve as a discovery
	service for agent consumption.
	"""

	async def discover_opportunities(
		self,
		sources: list[str] | None = None,
		filters: dict[str, Any] | None = None,
	) -> list[dict[str, Any]]:
		"""Discover new opportunities from configured sources.

		Args:
			sources: Optional list of source identifiers to crawl.
				If None, uses all configured sources.
			filters: Optional filters (sector, region, value range, etc.).

		Returns:
			List of discovered opportunity dictionaries.
		"""
		...

	async def get_opportunity_details(
		self,
		opportunity_id: str,
	) -> dict[str, Any] | None:
		"""Get full details for a specific opportunity.

		Args:
			opportunity_id: Unique identifier of the opportunity.

		Returns:
			Opportunity data dict, or None if not found.
		"""
		...

	async def analyze_opportunity(
		self,
		opportunity_id: str,
	) -> dict[str, Any]:
		"""Run discovery-side analysis on an opportunity.

		Includes classification, sector analysis, value estimation,
		and competitive landscape assessment.

		Args:
			opportunity_id: Unique identifier of the opportunity.

		Returns:
			Analysis results dictionary.
		"""
		...

	async def assess_qualification(
		self,
		opportunity_id: str,
		organizational_profile: dict[str, Any] | None = None,
	) -> dict[str, Any]:
		"""Assess organizational qualification for an opportunity.

		Args:
			opportunity_id: Unique identifier of the opportunity.
			organizational_profile: Org capabilities for matching.

		Returns:
			Qualification assessment with match scores and gaps.
		"""
		...

	async def list_sources(
		self,
		source_type: str | None = None,
		region: str | None = None,
	) -> list[dict[str, Any]]:
		"""List configured procurement sources.

		Args:
			source_type: Filter by source type (government, commercial, etc.).
			region: Filter by geographic region.

		Returns:
			List of source configuration dictionaries.
		"""
		...


class DefaultDiscoveryService:
	"""Default implementation backed by the discovery module.

	Gracefully degrades when the discovery module or its heavy
	dependencies (sklearn, playwright, etc.) are not installed.
	"""

	def __init__(self) -> None:
		self._engine: dict[str, Any] | None = None
		self._opportunity_analyzer = None
		self._qualification_analyzer = None
		self._global_db = None
		self._opportunity_cache: dict[str, dict[str, Any]] = {}
		self._searxng_url = (
			os.getenv("SEARXNG_URL")
			or os.getenv("SEARXNG_BASE_URL")
			or DEFAULT_SEARXNG_URL
		).rstrip("/")
		self._searxng_fallback_urls = self._parse_searxng_fallback_urls(
			os.getenv("SEARXNG_FALLBACK_URLS"),
			self._searxng_url,
		)
		self._searxng_public_fallbacks = os.getenv("SEARXNG_PUBLIC_FALLBACKS") != "0"
		self._searxng_public_fallback_limit = self._coerce_public_fallback_limit()
		self._searxng_space_instances_url = (
			os.getenv("SEARXNG_SPACE_INSTANCES_URL")
			or DEFAULT_SEARXNG_SPACE_INSTANCES_URL
		)
		self._firecrawl_url = (
			os.getenv("FIRECRAWL_URL")
			or os.getenv("FIRECRAWL_BASE_URL")
			or DEFAULT_FIRECRAWL_URL
		).rstrip("/")
		self._firecrawl_enrich_limit = self._coerce_limit(
			os.getenv("DISCOVERY_FIRECRAWL_ENRICH_LIMIT"),
			default=DEFAULT_FIRECRAWL_ENRICH_LIMIT,
		)

		try:
			from docfusion.discovery import _SCRAPERS_AVAILABLE
			if _SCRAPERS_AVAILABLE:
				from docfusion.discovery import create_discovery_engine
				self._engine = create_discovery_engine(
					enable_learning=False,
					enable_monitoring=False,
					enable_validation=False,
				)
				self._global_db = self._engine.get("global_db")
			logger.info("Discovery service initialized (scrapers_available=%s)", _SCRAPERS_AVAILABLE)
		except ImportError:
			logger.warning("Discovery module not available; service will use SearXNG fallback and honest unavailable states")

		try:
			from docfusion.discovery.analyzers.opportunity_analyzer import OpportunityAnalyzer
			self._opportunity_analyzer = OpportunityAnalyzer()
		except ImportError:
			logger.debug("Opportunity analyzer not available")

		try:
			from docfusion.discovery.analyzers.qualification_analyzer import QualificationAnalyzer
			self._qualification_analyzer = QualificationAnalyzer()
		except ImportError:
			logger.debug("Qualification analyzer not available")

	async def discover_opportunities(
		self,
		sources: list[str] | None = None,
		filters: dict[str, Any] | None = None,
	) -> list[dict[str, Any]]:
		filters = filters or {}
		query = self._build_search_query(filters)
		limit = self._coerce_limit(filters.get("limit"), default=20)

		try:
			opportunities = await self._discover_with_searxng(query, limit)
		except Exception as exc:
			logger.warning("SearXNG discovery failed: %s", exc)
			opportunities = []

		if self._should_enrich_with_firecrawl(filters):
			enrich_limit = self._coerce_limit(
				filters.get("enrich_limit"),
				default=getattr(
					self,
					"_firecrawl_enrich_limit",
					DEFAULT_FIRECRAWL_ENRICH_LIMIT,
				),
			)
			opportunities = await self._enrich_opportunities_with_firecrawl(
				opportunities,
				enrich_limit,
			)

		for opportunity in opportunities:
			self._opportunity_cache[opportunity["id"]] = opportunity
		return opportunities

	async def get_opportunity_details(
		self,
		opportunity_id: str,
	) -> dict[str, Any] | None:
		return self._opportunity_cache.get(opportunity_id)

	async def analyze_opportunity(
		self,
		opportunity_id: str,
	) -> dict[str, Any]:
		if not self._opportunity_analyzer:
			return {"error": "Opportunity analyzer unavailable", "opportunity_id": opportunity_id}
		opportunity = await self.get_opportunity_details(opportunity_id)
		if not opportunity:
			return {
				"opportunity_id": opportunity_id,
				"status": "unavailable",
				"error": "Opportunity details not found in discovery cache",
			}
		result = await self._opportunity_analyzer.analyze_opportunity(opportunity)
		return result.model_dump() if hasattr(result, "model_dump") else dict(result)

	async def assess_qualification(
		self,
		opportunity_id: str,
		organizational_profile: dict[str, Any] | None = None,
	) -> dict[str, Any]:
		if not self._qualification_analyzer:
			return {"error": "Qualification analyzer unavailable", "opportunity_id": opportunity_id}
		opportunity = await self.get_opportunity_details(opportunity_id)
		if not opportunity:
			return {
				"opportunity_id": opportunity_id,
				"status": "unavailable",
				"error": "Opportunity details not found in discovery cache",
			}

		from docfusion.discovery.analyzers.qualification_analyzer import OrganizationalCapabilities
		from docfusion.discovery.models.opportunity_models import OpportunityData

		capabilities = OrganizationalCapabilities(**(organizational_profile or {}))
		result = await self._qualification_analyzer.analyze_qualification(
			OpportunityData(**self._to_opportunity_data(opportunity)),
			capabilities,
		)
		return result.model_dump() if hasattr(result, "model_dump") else dict(result)

	async def list_sources(
		self,
		source_type: str | None = None,
		region: str | None = None,
	) -> list[dict[str, Any]]:
		sources = [{
			"id": "searxng",
			"name": "SearXNG metasearch",
			"type": "metasearch",
			"region": "global",
			"url": self._searxng_url,
		}, {
			"id": "firecrawl",
			"name": "Firecrawl page enrichment",
			"type": "scraper",
			"region": "global",
			"url": getattr(self, "_firecrawl_url", DEFAULT_FIRECRAWL_URL),
		}]
		if source_type:
			sources = [source for source in sources if source["type"] == source_type]
		if region and region != "global":
			sources = [source for source in sources if source["region"] == region]
		return sources

	def _build_search_query(self, filters: dict[str, Any]) -> str:
		query = str(filters.get("query") or "").strip()
		parts = [query] if query else ["software development RFP Africa"]
		for key in ("sector", "region", "country", "category"):
			value = filters.get(key)
			if value:
				parts.append(str(value))
		return " ".join(parts)

	def _coerce_limit(self, value: Any, default: int) -> int:
		try:
			return max(1, min(int(value), 50))
		except (TypeError, ValueError):
			return default

	def _coerce_public_fallback_limit(self) -> int:
		try:
			return max(0, min(int(os.getenv("SEARXNG_PUBLIC_FALLBACK_LIMIT", "")), 12))
		except ValueError:
			return DEFAULT_SEARXNG_PUBLIC_FALLBACK_LIMIT

	async def _discover_with_searxng(self, query: str, limit: int) -> list[dict[str, Any]]:
		import httpx

		async with httpx.AsyncClient(timeout=15.0) as client:
			primary_payload: dict[str, Any] | None = None
			primary_error: Exception | None = None
			try:
				primary_payload = await self._fetch_searxng_payload(
					client,
					self._searxng_url,
					query,
				)
			except Exception as exc:
				primary_error = exc
				logger.warning("Primary SearXNG search failed for %s: %s", self._searxng_url, exc)

			payloads: list[dict[str, Any]] = []
			if primary_payload and primary_payload.get("results"):
				payloads.append(primary_payload)

			if primary_payload is None or self._should_try_searxng_fallback(primary_payload):
				payloads.extend(await self._fetch_searxng_fallback_payloads(client, query))

			if not payloads:
				if primary_payload is not None:
					payloads.append(primary_payload)
				elif primary_error is not None:
					raise primary_error

		results = self._merge_searxng_results(payloads)
		opportunities = [
			self._normalize_search_result(result, query, index)
			for index, result in enumerate(results)
			if self._is_opportunity_result(result)
		]
		return opportunities[:limit]

	async def _fetch_searxng_payload(
		self,
		client: Any,
		base_url: str,
		query: str,
	) -> dict[str, Any]:
		response = await client.get(
			f"{base_url.rstrip('/')}/search",
			params={
				"q": query,
				"format": "json",
				"safesearch": 1,
			},
		)
		response.raise_for_status()
		return response.json()

	def _should_try_searxng_fallback(self, payload: dict[str, Any]) -> bool:
		return bool(payload.get("unresponsive_engines")) or not bool(payload.get("results"))

	async def _fetch_searxng_fallback_payloads(
		self,
		client: Any,
		query: str,
	) -> list[dict[str, Any]]:
		fallback_urls = await self._searxng_fallback_urls_for_client(client)
		if not fallback_urls:
			return []

		import asyncio

		async def fetch_fallback(base_url: str) -> dict[str, Any] | None:
			try:
				payload = await self._fetch_searxng_payload(client, base_url, query)
			except Exception as exc:
				logger.warning("SearXNG fallback search failed for %s: %s", base_url, exc)
				return None
			if not payload.get("results"):
				return None
			return payload

		results = await asyncio.gather(
			*(fetch_fallback(url) for url in fallback_urls),
		)
		return [payload for payload in results if payload is not None]

	async def _searxng_fallback_urls_for_client(self, client: Any) -> list[str]:
		limit = min(12, max(0, int(getattr(
			self,
			"_searxng_public_fallback_limit",
			DEFAULT_SEARXNG_PUBLIC_FALLBACK_LIMIT,
		))))
		configured = list(getattr(self, "_searxng_fallback_urls", []) or [])
		if len(configured) >= limit:
			return configured[:limit]

		public_urls = await self._public_searxng_fallback_urls(client)
		seen: set[str] = set()
		urls: list[str] = []
		for raw_url in [*configured, *public_urls]:
			url = self._normalize_base_url(raw_url)
			if not url or url == self._searxng_url or url in seen:
				continue
			seen.add(url)
			urls.append(url)
		return urls[:limit]

	async def _public_searxng_fallback_urls(self, client: Any) -> list[str]:
		if not getattr(self, "_searxng_public_fallbacks", True):
			return []
		try:
			response = await client.get(
				getattr(self, "_searxng_space_instances_url", DEFAULT_SEARXNG_SPACE_INSTANCES_URL),
				params={},
			)
			response.raise_for_status()
			payload = response.json()
		except Exception as exc:
			logger.warning("Could not refresh searx.space fallback instances: %s", exc)
			return []

		instances = payload.get("instances") or {}
		candidates = [
			(url, instance)
			for url, instance in instances.items()
			if self._is_usable_public_searxng_instance(instance)
		]
		candidates.sort(
			key=lambda item: (
				-(self._instance_search_success(item[1]) or 0),
				self._instance_search_median(item[1]),
			)
		)
		return [
			url
			for url, _instance in candidates
			if self._normalize_base_url(url)
		]

	def _parse_searxng_fallback_urls(self, raw: str | None, primary_url: str) -> list[str]:
		if not raw:
			return []
		urls: list[str] = []
		for value in raw.split(","):
			url = self._normalize_base_url(value)
			if url and url != primary_url and url not in urls:
				urls.append(url)
		return urls

	def _normalize_base_url(self, value: str | None) -> str | None:
		parsed = urlparse(str(value or "").strip())
		if parsed.scheme not in {"http", "https"} or not parsed.netloc:
			return None
		return urlunparse((parsed.scheme, parsed.netloc, parsed.path.rstrip("/"), "", "", "")).rstrip("/")

	def _is_usable_public_searxng_instance(self, instance: Any) -> bool:
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
		success = self._instance_search_success(instance)
		return success is None or success > 0

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

	def _merge_searxng_results(self, payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
		seen: set[str] = set()
		results: list[dict[str, Any]] = []
		for payload in payloads:
			for result in payload.get("results") or []:
				identity = self._search_result_identity(result)
				if identity in seen:
					continue
				seen.add(identity)
				results.append(result)
		return results

	def _search_result_identity(self, result: dict[str, Any]) -> str:
		url = str(result.get("url") or "").strip()
		if not url:
			return f"{result.get('engine')}:{result.get('title')}"
		parsed = urlparse(url)
		return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", parsed.query, ""))

	def _normalize_search_result(
		self,
		result: dict[str, Any],
		query: str,
		index: int,
	) -> dict[str, Any]:
		url = str(result.get("url") or "")
		title = str(result.get("title") or "Untitled opportunity")
		description = str(result.get("content") or result.get("description") or "")
		identity = hashlib.sha256((url or f"{query}:{title}:{index}").encode()).hexdigest()
		return {
			"id": f"searxng-{identity[:16]}",
			"title": title,
			"description": description,
			"requirements": description,
			"source": "searxng",
			"source_url": url,
			"engine": result.get("engine"),
			"score": result.get("score"),
			"query": query,
			"tags": ["external-discovery"],
		}

	def _is_opportunity_result(self, result: dict[str, Any]) -> bool:
		text = " ".join(
			str(result.get(key) or "").lower()
			for key in ("title", "content", "description", "url")
		)
		return any(keyword in text for keyword in (
			"rfp",
			"request for proposal",
			"tender",
			"bid",
			"procurement",
			"expression of interest",
			"eoi",
		))

	def _should_enrich_with_firecrawl(self, filters: dict[str, Any]) -> bool:
		value = filters.get("enrich")
		if value is None:
			return True
		if isinstance(value, str):
			return value.strip().lower() not in {"0", "false", "no", "off"}
		return bool(value)

	async def _enrich_opportunities_with_firecrawl(
		self,
		opportunities: list[dict[str, Any]],
		enrich_limit: int,
	) -> list[dict[str, Any]]:
		if not opportunities or enrich_limit <= 0:
			return opportunities

		try:
			from docfusion.infrastructure.firecrawl_client import (
				FirecrawlClient,
				OutputFormat,
				ScrapeOptions,
			)
		except ImportError as exc:
			logger.warning("Firecrawl client unavailable; returning SearXNG-only discovery results: %s", exc)
			return opportunities

		enriched = [dict(opportunity) for opportunity in opportunities]
		async with FirecrawlClient(base_url=getattr(self, "_firecrawl_url", DEFAULT_FIRECRAWL_URL)) as client:
			for index, opportunity in enumerate(enriched[:enrich_limit]):
				url = str(opportunity.get("source_url") or "")
				if not url.startswith(("http://", "https://")):
					opportunity["scrape_status"] = "skipped"
					opportunity["scrape_error"] = "No public HTTP source URL available"
					continue
				try:
					result = await client.scrape(
						url,
						ScrapeOptions(
							formats=[OutputFormat.MARKDOWN, OutputFormat.LINKS],
							only_main_content=True,
							timeout=30_000,
						),
					)
				except Exception as exc:  # FirecrawlClient should catch HTTP errors, but keep discovery resilient.
					logger.warning("Firecrawl enrichment failed for %s: %s", url, exc)
					opportunity["scrape_status"] = "failed"
					opportunity["scrape_error"] = str(exc)
					continue

				if not result.success:
					opportunity["scrape_status"] = "failed"
					opportunity["scrape_error"] = result.error or "Firecrawl scrape failed"
					continue

				self._apply_firecrawl_result(opportunity, result)
				opportunity["scrape_rank"] = index + 1

		return enriched

	def _apply_firecrawl_result(self, opportunity: dict[str, Any], scrape_result: Any) -> None:
		markdown = str(getattr(scrape_result, "markdown", "") or "")
		metadata = dict(getattr(scrape_result, "metadata", {}) or {})
		links = list(getattr(scrape_result, "links", []) or [])
		extract = dict(getattr(scrape_result, "extract", {}) or {})

		title = str(metadata.get("title") or opportunity.get("title") or "Untitled opportunity")
		description = self._first_non_empty(
			metadata.get("description"),
			self._summarize_markdown(markdown),
			opportunity.get("description"),
		)

		opportunity.update({
			"title": title,
			"description": description,
			"requirements": (
				markdown[:MAX_SCRAPED_MARKDOWN_CHARS]
				if markdown
				else opportunity.get("requirements") or description
			),
			"scrape_status": "success",
			"scraped_markdown": markdown[:MAX_SCRAPED_MARKDOWN_CHARS],
			"scraped_markdown_truncated": len(markdown) > MAX_SCRAPED_MARKDOWN_CHARS,
			"scraped_links": links[:100],
			"scrape_metadata": metadata,
			"extracted": extract,
			"document_links": self._extract_document_links(
				str(opportunity.get("source_url") or ""),
				markdown,
				links,
			),
			"tags": sorted(set((opportunity.get("tags") or []) + ["firecrawl-enriched"])),
		})

	def _first_non_empty(self, *values: Any) -> str:
		for value in values:
			text = str(value or "").strip()
			if text:
				return text
		return ""

	def _summarize_markdown(self, markdown: str) -> str:
		for line in markdown.splitlines():
			text = re.sub(r"\s+", " ", line).strip(" #*\t")
			if len(text) >= 40:
				return text[:500]
		return re.sub(r"\s+", " ", markdown).strip()[:500]

	def _extract_document_links(self, source_url: str, markdown: str, links: list[str]) -> list[dict[str, str]]:
		candidates = set(links)
		for match in re.finditer(r"https?://[^\s)\]\"']+", markdown):
			candidates.add(match.group(0))
		for match in re.finditer(r"\[[^\]]+\]\(([^)]+)\)", markdown):
			candidates.add(match.group(1))

		documents: list[dict[str, str]] = []
		for raw_url in candidates:
			url = urljoin(source_url, str(raw_url).strip())
			lower_url = url.lower()
			if not any(
				token in lower_url
				for token in (".pdf", ".doc", ".docx", ".zip", "download", "attachment")
			):
				continue
			if not any(
				token in lower_url
				for token in (
					"rfp",
					"tender",
					"bid",
					"proposal",
					"terms",
					"tor",
					"solicitation",
					".pdf",
					".doc",
					".docx",
				)
			):
				continue
			documents.append({
				"url": url,
				"source": "firecrawl-link",
			})
		return sorted(documents, key=lambda item: item["url"])[:20]

	def _to_opportunity_data(self, opportunity: dict[str, Any]) -> dict[str, Any]:
		return {
			"id": opportunity["id"],
			"title": opportunity.get("title") or "Untitled opportunity",
			"description": opportunity.get("description") or "",
			"requirements": opportunity.get("requirements") or opportunity.get("description") or "",
			"source": opportunity.get("source"),
			"source_url": opportunity.get("source_url"),
			"tags": opportunity.get("tags") or [],
		}
