"""Interface for discovery operations used by agents.

Provides a Protocol-based abstraction over the discovery module so that
agents can depend on a stable interface rather than importing concrete
scrapers, analyzers, and matchers directly.
"""

import logging
import hashlib
import os
from typing import Protocol, Any

logger = logging.getLogger(__name__)

DEFAULT_SEARXNG_URL = "https://search.lindela.io"


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
			logger.warning("Discovery module not available; service will return stubs")

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
