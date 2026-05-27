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
from urllib.parse import urljoin

logger = logging.getLogger(__name__)

DEFAULT_SEARXNG_URL = "https://search.lindela.io"
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

	async def _discover_with_searxng(self, query: str, limit: int) -> list[dict[str, Any]]:
		import httpx

		async with httpx.AsyncClient(timeout=15.0) as client:
			response = await client.get(
				f"{self._searxng_url}/search",
				params={
					"q": query,
					"format": "json",
					"safesearch": 1,
				},
			)
			response.raise_for_status()
			payload = response.json()

		results = payload.get("results", [])
		opportunities = [
			self._normalize_search_result(result, query, index)
			for index, result in enumerate(results)
			if self._is_opportunity_result(result)
		]
		return opportunities[:limit]

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
