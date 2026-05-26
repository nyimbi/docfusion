"""Behavior checks for the default intelligence service contract."""

from __future__ import annotations

from typing import Any

import pytest

from docfusion.services.intelligence_service import DefaultIntelligenceService


class _FakeResult:
	def __init__(self, payload: dict[str, Any]) -> None:
		self.payload = payload

	def model_dump(self) -> dict[str, Any]:
		return self.payload


class _FakeDiscovery:
	async def get_opportunity_details(self, opportunity_id: str) -> dict[str, Any] | None:
		if opportunity_id != "opp-1":
			return None
		return {
			"id": "opp-1",
			"title": "Records platform RFP",
			"description": "RFP for workflow modernization.",
			"requirements": "The supplier must provide secure workflow reporting.",
			"estimated_value": 250000,
		}


class _FakeCompetitiveAnalyzer:
	def __init__(self) -> None:
		self.last_opportunity: Any = None

	async def analyze_competition(
		self,
		opportunity_data: Any,
		organizational_profile: dict[str, Any],
	) -> _FakeResult:
		self.last_opportunity = opportunity_data
		return _FakeResult({"status": "competitive", "opportunity_id": opportunity_data.id})


class _FakeStrategyRecommender:
	def __init__(self) -> None:
		self.last_context: Any = None

	async def recommend_strategy(self, context: Any) -> _FakeResult:
		self.last_context = context
		return _FakeResult({"status": "recommended", "opportunity_id": context.opportunity_id})


def _bare_intelligence_service() -> DefaultIntelligenceService:
	service = DefaultIntelligenceService.__new__(DefaultIntelligenceService)
	service._discovery_service = _FakeDiscovery()
	service._win_predictor = None
	service._strategy_recommender = None
	service._content_recommender = None
	service._competitive_analyzer = None
	service._opportunity_cache = {}
	return service


@pytest.mark.asyncio
async def test_competitive_assessment_uses_discovered_opportunity_details():
	service = _bare_intelligence_service()
	analyzer = _FakeCompetitiveAnalyzer()
	service._competitive_analyzer = analyzer

	result = await service.get_competitive_assessment("opp-1")

	assert result == {"status": "competitive", "opportunity_id": "opp-1"}
	assert analyzer.last_opportunity.title == "Records platform RFP"
	assert service._opportunity_cache["opp-1"]["estimated_value"] == 250000


@pytest.mark.asyncio
async def test_strategic_recommendation_uses_discovered_opportunity_context():
	service = _bare_intelligence_service()
	recommender = _FakeStrategyRecommender()
	service._strategy_recommender = recommender

	result = await service.get_strategic_recommendation(
		"opp-1",
		{"strategic_importance": 0.8},
	)

	assert result == {"status": "recommended", "opportunity_id": "opp-1"}
	assert recommender.last_context.opportunity_id == "opp-1"
	assert recommender.last_context.opportunity_value == 250000
	assert recommender.last_context.strategic_importance == 0.8


@pytest.mark.asyncio
async def test_intelligence_methods_are_honest_when_details_are_missing():
	service = _bare_intelligence_service()
	service._competitive_analyzer = _FakeCompetitiveAnalyzer()
	service._strategy_recommender = _FakeStrategyRecommender()

	competitive = await service.get_competitive_assessment("missing")
	strategic = await service.get_strategic_recommendation("missing")
	content = await service.get_content_recommendations("   ", "technical_approach")

	assert competitive["status"] == "unavailable"
	assert strategic["status"] == "unavailable"
	assert content["status"] == "unavailable"
	assert "not_implemented" not in str([competitive, strategic, content])
