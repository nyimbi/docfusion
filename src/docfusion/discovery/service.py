"""Compatibility wrapper for the current discovery service abstraction."""

from __future__ import annotations

from typing import Any

from docfusion.services.discovery_service import (
	DefaultDiscoveryService,
	DiscoveryServiceInterface,
)


class OpportunityDiscoveryService(DefaultDiscoveryService):
	"""Backward-compatible name for legacy research-agent imports."""

	async def search_opportunities(
		self,
		query: str = "",
		filters: dict[str, Any] | None = None,
	) -> list[dict[str, Any]]:
		search_filters = dict(filters or {})
		if query:
			search_filters["query"] = query
		return await self.discover_opportunities(filters=search_filters)


__all__ = ["OpportunityDiscoveryService", "DefaultDiscoveryService", "DiscoveryServiceInterface"]
