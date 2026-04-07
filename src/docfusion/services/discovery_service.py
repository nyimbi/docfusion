"""Interface for discovery operations used by agents.

Provides a Protocol-based abstraction over the discovery module so that
agents can depend on a stable interface rather than importing concrete
scrapers, analyzers, and matchers directly.
"""

import logging
from typing import Protocol, Any

logger = logging.getLogger(__name__)


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
		if not self._engine:
			return []

		scraper = self._engine.get("universal_scraper")
		if not scraper:
			return []

		# Delegate to the universal scraper's discovery pipeline
		# Concrete implementation depends on source configuration
		return []

	async def get_opportunity_details(
		self,
		opportunity_id: str,
	) -> dict[str, Any] | None:
		# Would query storage integration for persisted opportunity data
		return None

	async def analyze_opportunity(
		self,
		opportunity_id: str,
	) -> dict[str, Any]:
		if not self._opportunity_analyzer:
			return {"error": "Opportunity analyzer unavailable", "opportunity_id": opportunity_id}
		return {"opportunity_id": opportunity_id, "status": "not_implemented"}

	async def assess_qualification(
		self,
		opportunity_id: str,
		organizational_profile: dict[str, Any] | None = None,
	) -> dict[str, Any]:
		if not self._qualification_analyzer:
			return {"error": "Qualification analyzer unavailable", "opportunity_id": opportunity_id}
		return {"opportunity_id": opportunity_id, "status": "not_implemented"}

	async def list_sources(
		self,
		source_type: str | None = None,
		region: str | None = None,
	) -> list[dict[str, Any]]:
		if not self._global_db:
			return []
		return []
