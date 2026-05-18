"""Compatibility wrapper for the current discovery service abstraction."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from docfusion.services.discovery_service import (
	DefaultDiscoveryService,
	DiscoveryServiceInterface,
)


@dataclass
class OpportunitySearchResult:
	"""Legacy attribute-style opportunity result."""

	title: str
	value: Any = "N/A"
	deadline: Any = "N/A"
	data: dict[str, Any] | None = None

	@classmethod
	def from_mapping(cls, opportunity: dict[str, Any]) -> "OpportunitySearchResult":
		return cls(
			title=str(opportunity.get("title") or opportunity.get("name") or "Untitled opportunity"),
			value=opportunity.get("value", opportunity.get("estimated_value", "N/A")),
			deadline=opportunity.get("deadline", opportunity.get("due_date", "N/A")),
			data=opportunity,
		)


class OpportunityDiscoveryService(DefaultDiscoveryService):
	"""Backward-compatible name for legacy research-agent imports."""

	async def search_opportunities(
		self,
		query: str = "",
		filters: dict[str, Any] | None = None,
		limit: int = 20,
		**kwargs: Any,
	) -> list[OpportunitySearchResult]:
		search_filters = dict(filters or {})
		if query:
			search_filters["query"] = query
		search_filters.update(kwargs)

		opportunities = await self.discover_opportunities(filters=search_filters)
		results: list[OpportunitySearchResult] = []
		for opportunity in opportunities[:limit]:
			if isinstance(opportunity, OpportunitySearchResult):
				results.append(opportunity)
			elif isinstance(opportunity, dict):
				results.append(OpportunitySearchResult.from_mapping(opportunity))
			else:
				results.append(
					OpportunitySearchResult(
						title=str(getattr(opportunity, "title", "Untitled opportunity")),
						value=getattr(opportunity, "value", "N/A"),
						deadline=getattr(opportunity, "deadline", "N/A"),
						data={"raw": opportunity},
					)
				)
		return results


__all__ = [
	"OpportunityDiscoveryService",
	"OpportunitySearchResult",
	"DefaultDiscoveryService",
	"DiscoveryServiceInterface",
]
