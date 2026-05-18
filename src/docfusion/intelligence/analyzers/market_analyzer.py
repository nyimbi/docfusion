"""Compatibility market analyzer for legacy specialist agents."""

from __future__ import annotations

from typing import Any


class MarketAnalyzer:
	"""Minimal analyzer that reports unavailable market intelligence."""

	async def analyze_market_conditions(
		self,
		industry: str = "technology",
		region: str = "global",
		timeframe: str = "current",
	) -> dict[str, Any]:
		return {
			"status": "unavailable",
			"industry": industry,
			"region": region,
			"timeframe": timeframe,
			"market_size": {},
			"trends": [],
			"competitors": [],
			"opportunities": [],
		}


__all__ = ["MarketAnalyzer"]
