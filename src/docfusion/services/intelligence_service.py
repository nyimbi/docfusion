"""Interface for intelligence operations used by agents.

Provides a Protocol-based abstraction over the intelligence module so that
agents can depend on a stable interface rather than importing concrete
analyzers, predictors, and recommenders directly.
"""

import logging
from typing import Protocol, Any

logger = logging.getLogger(__name__)


class IntelligenceServiceInterface(Protocol):
	"""Protocol defining the intelligence operations contract.

	Any class implementing these methods (duck-typed or explicit) can be
	used as an intelligence service by agent code.
	"""

	async def analyze_opportunity(
		self,
		opportunity_id: str,
		intelligence_level: str = "enhanced",
		organizational_profile: dict[str, Any] | None = None,
	) -> dict[str, Any]:
		"""Analyze an opportunity for win probability, competitiveness, etc.

		Args:
			opportunity_id: Unique identifier of the opportunity.
			intelligence_level: One of basic, enhanced, comprehensive, strategic.
			organizational_profile: Optional org capabilities context.

		Returns:
			Intelligence report as a dictionary.
		"""
		...

	async def predict_win_probability(
		self,
		opportunity_id: str,
		features: dict[str, Any] | None = None,
	) -> dict[str, Any]:
		"""Predict win probability for a specific opportunity.

		Args:
			opportunity_id: Unique identifier of the opportunity.
			features: Optional pre-computed prediction features.

		Returns:
			Prediction result including probability, confidence, and factors.
		"""
		...

	async def get_competitive_assessment(
		self,
		opportunity_id: str,
	) -> dict[str, Any]:
		"""Get competitive landscape assessment for an opportunity.

		Args:
			opportunity_id: Unique identifier of the opportunity.

		Returns:
			Competitive analysis including competitor profiles and positioning.
		"""
		...

	async def get_strategic_recommendation(
		self,
		opportunity_id: str,
		organizational_profile: dict[str, Any] | None = None,
	) -> dict[str, Any]:
		"""Get go/no-go strategic recommendation for an opportunity.

		Args:
			opportunity_id: Unique identifier of the opportunity.
			organizational_profile: Optional org capabilities context.

		Returns:
			Strategic recommendation with actions and resource allocation.
		"""
		...

	async def get_content_recommendations(
		self,
		section_text: str,
		section_type: str = "general",
	) -> dict[str, Any]:
		"""Get content improvement recommendations for proposal text.

		Args:
			section_text: The proposal section text to analyze.
			section_type: Type of section (executive_summary, technical, etc.).

		Returns:
			Content analysis with suggestions and quality scores.
		"""
		...


class DefaultIntelligenceService:
	"""Default implementation backed by the intelligence module.

	Gracefully degrades when the intelligence module or its heavy
	dependencies (sklearn, xgboost, numpy) are not installed.
	"""

	def __init__(self) -> None:
		self._discovery_service = None
		self._win_predictor = None
		self._strategy_recommender = None
		self._content_recommender = None
		self._competitive_analyzer = None

		try:
			from docfusion.intelligence.integrations.discovery_integration import (
				IntelligenceDiscoveryService,
			)
			self._discovery_service = IntelligenceDiscoveryService()
			self._win_predictor = self._discovery_service.win_predictor
			self._strategy_recommender = self._discovery_service.strategy_recommender
			logger.info("Intelligence service initialized with full module")
		except ImportError:
			logger.warning("Intelligence module not available; service will return stubs")

		try:
			from docfusion.intelligence.recommenders.content_recommender import (
				ContentRecommender,
			)
			self._content_recommender = ContentRecommender()
		except ImportError:
			logger.debug("Content recommender not available")

		try:
			from docfusion.intelligence.analyzers.competitive_analyzer import (
				CompetitiveAnalyzer,
			)
			self._competitive_analyzer = CompetitiveAnalyzer()
		except ImportError:
			logger.debug("Competitive analyzer not available")

	async def analyze_opportunity(
		self,
		opportunity_id: str,
		intelligence_level: str = "enhanced",
		organizational_profile: dict[str, Any] | None = None,
	) -> dict[str, Any]:
		if not self._discovery_service:
			return {"error": "Intelligence service unavailable", "opportunity_id": opportunity_id}

		from docfusion.intelligence.integrations.discovery_integration import IntelligenceLevel
		from docfusion.discovery.models.opportunity_models import OpportunityData

		level = IntelligenceLevel(intelligence_level)
		# The caller supplies an ID; the real service expects OpportunityData.
		# Build a minimal stub -- the service will enrich from storage.
		opp_data = OpportunityData(id=opportunity_id)
		result = await self._discovery_service.analyze_opportunity_intelligence(
			opp_data, level, organizational_profile
		)
		return result.model_dump()

	async def predict_win_probability(
		self,
		opportunity_id: str,
		features: dict[str, Any] | None = None,
	) -> dict[str, Any]:
		if not self._win_predictor:
			return {"error": "Win predictor unavailable", "opportunity_id": opportunity_id}

		from docfusion.intelligence.predictors.win_probability_predictor import PredictionFeatures

		if features:
			pred_features = PredictionFeatures(**features)
			result = await self._win_predictor.predict_win_probability(
				opportunity_id, pred_features
			)
			return result.model_dump()

		return {"error": "Features required for prediction", "opportunity_id": opportunity_id}

	async def get_competitive_assessment(
		self,
		opportunity_id: str,
	) -> dict[str, Any]:
		if not self._competitive_analyzer:
			return {"error": "Competitive analyzer unavailable", "opportunity_id": opportunity_id}
		return {"opportunity_id": opportunity_id, "status": "not_implemented"}

	async def get_strategic_recommendation(
		self,
		opportunity_id: str,
		organizational_profile: dict[str, Any] | None = None,
	) -> dict[str, Any]:
		if not self._strategy_recommender:
			return {"error": "Strategy recommender unavailable", "opportunity_id": opportunity_id}
		return {"opportunity_id": opportunity_id, "status": "not_implemented"}

	async def get_content_recommendations(
		self,
		section_text: str,
		section_type: str = "general",
	) -> dict[str, Any]:
		if not self._content_recommender:
			return {"error": "Content recommender unavailable"}
		return {"section_type": section_type, "status": "not_implemented"}
