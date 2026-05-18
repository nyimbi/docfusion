"""Compatibility financial analyzer for legacy specialist agents."""

from __future__ import annotations

from typing import Any


class FinancialAnalyzer:
	"""Minimal analyzer that reports unavailable financial intelligence."""

	async def analyze_financial_viability(self, project_data: dict[str, Any]) -> dict[str, Any]:
		return {
			"status": "unavailable",
			"project_data": project_data,
			"roi": {},
			"costs": {},
			"revenue": {},
			"risks": [],
		}


__all__ = ["FinancialAnalyzer"]
