"""Behavior checks for legacy agent compatibility shims."""

from __future__ import annotations

from typing import Any

import pytest

from docfusion.agents.specialists.analysis_agent import AnalysisAgent, AnalysisTask
from docfusion.discovery.service import OpportunityDiscoveryService
from docfusion.intelligence.analyzers.financial_analyzer import FinancialAnalyzer
from docfusion.intelligence.analyzers.market_analyzer import MarketAnalyzer


class _DiscoveryWithRows(OpportunityDiscoveryService):
	def __init__(self) -> None:
		self.last_filters: dict[str, Any] | None = None

	async def discover_opportunities(
		self,
		sources: list[str] | None = None,
		filters: dict[str, Any] | None = None,
	) -> list[dict[str, Any]]:
		self.last_filters = filters
		return [
			{"title": "First", "estimated_value": 100, "due_date": "2026-06-01"},
			{"name": "Second", "value": 200, "deadline": "2026-07-01"},
		]


@pytest.mark.asyncio
async def test_legacy_discovery_search_accepts_limit_and_returns_attributes():
	service = _DiscoveryWithRows()

	results = await service.search_opportunities(query="rfp", limit=1)

	assert len(results) == 1
	assert service.last_filters is not None
	assert service.last_filters["query"] == "rfp"
	assert results[0].title == "First"
	assert results[0].value == 100
	assert results[0].deadline == "2026-06-01"


@pytest.mark.asyncio
async def test_unavailable_market_analyzer_does_not_emit_positive_claims():
	agent = AnalysisAgent.__new__(AnalysisAgent)
	agent.market_analyzer = MarketAnalyzer()
	task = AnalysisTask(
		task_id="market",
		analysis_type="market",
		data_sources=[],
		analysis_parameters={},
	)

	result = await agent._market_analysis(task)

	assert result.confidence_score == 0.0
	assert result.data_quality_score == 0.0
	assert result.insights["status"] == "unavailable"
	assert "unavailable" in result.executive_summary.lower()


@pytest.mark.asyncio
async def test_unavailable_financial_analyzer_does_not_emit_positive_claims():
	agent = AnalysisAgent.__new__(AnalysisAgent)
	agent.financial_analyzer = FinancialAnalyzer()
	task = AnalysisTask(
		task_id="financial",
		analysis_type="financial",
		data_sources=[],
		analysis_parameters={},
	)

	result = await agent._financial_analysis(task)

	assert result.confidence_score == 0.0
	assert result.data_quality_score == 0.0
	assert result.insights["status"] == "unavailable"
	assert "unavailable" in result.executive_summary.lower()
