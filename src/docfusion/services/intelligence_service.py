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
		self._opportunity_cache: dict[str, dict[str, Any]] = {}

		try:
			from docfusion.intelligence.integrations.discovery_integration import (
				IntelligenceDiscoveryService,
			)
			self._discovery_service = IntelligenceDiscoveryService()
			self._win_predictor = self._discovery_service.win_predictor
			self._strategy_recommender = self._discovery_service.strategy_recommender
			logger.info("Intelligence service initialized with full module")
		except ImportError:
			logger.warning("Intelligence module not available; service will return honest unavailable states")

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

		from docfusion.core.types.intelligence import IntelligenceLevel
		from docfusion.discovery.models.opportunity_models import OpportunityData

		level = IntelligenceLevel(intelligence_level)
		# The caller supplies an ID; the real service expects OpportunityData.
		# Build the minimal typed reference the service uses to enrich from storage.
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
			return {"status": "unavailable", "error": "Competitive analyzer unavailable", "opportunity_id": opportunity_id}
		opportunity = await self._get_opportunity_details(opportunity_id)
		if not opportunity:
			return self._missing_opportunity_result(opportunity_id)

		from docfusion.discovery.models.opportunity_models import OpportunityData

		result = await self._competitive_analyzer.analyze_competition(
			OpportunityData(**self._to_opportunity_data(opportunity)),
			organizational_profile={},
		)
		return self._dump_result(result)

	async def get_strategic_recommendation(
		self,
		opportunity_id: str,
		organizational_profile: dict[str, Any] | None = None,
	) -> dict[str, Any]:
		if not self._strategy_recommender:
			return {"status": "unavailable", "error": "Strategy recommender unavailable", "opportunity_id": opportunity_id}
		opportunity = await self._get_opportunity_details(opportunity_id)
		if not opportunity:
			return self._missing_opportunity_result(opportunity_id)

		context = self._build_strategy_context(opportunity, organizational_profile or {})
		result = await self._strategy_recommender.recommend_strategy(context)
		return self._dump_result(result)

	async def get_content_recommendations(
		self,
		section_text: str,
		section_type: str = "general",
	) -> dict[str, Any]:
		if not self._content_recommender:
			return {"section_type": section_type, "status": "unavailable", "error": "Content recommender unavailable"}
		if not section_text.strip():
			return {"section_type": section_type, "status": "unavailable", "error": "Section text is required"}

		try:
			from docfusion.intelligence.predictors.scoring_predictor import ProposalSection
		except ImportError as exc:
			return {
				"section_type": section_type,
				"status": "unavailable",
				"error": f"Proposal section model unavailable: {exc}",
			}

		result = await self._content_recommender.analyze_content(
			section_text,
			self._to_proposal_section(section_type, ProposalSection),
		)
		return self._dump_result(result)

	async def _get_opportunity_details(self, opportunity_id: str) -> dict[str, Any] | None:
		if opportunity_id in self._opportunity_cache:
			return self._opportunity_cache[opportunity_id]
		get_details = getattr(self._discovery_service, "get_opportunity_details", None)
		if not callable(get_details):
			return None
		details = await get_details(opportunity_id)
		if isinstance(details, dict):
			self._opportunity_cache[opportunity_id] = details
			return details
		return None

	def _missing_opportunity_result(self, opportunity_id: str) -> dict[str, Any]:
		return {
			"opportunity_id": opportunity_id,
			"status": "unavailable",
			"error": "Opportunity details not found in intelligence cache or discovery service",
		}

	def _to_opportunity_data(self, opportunity: dict[str, Any]) -> dict[str, Any]:
		return {
			"id": opportunity["id"],
			"title": opportunity.get("title") or "Untitled opportunity",
			"description": opportunity.get("description") or opportunity.get("project_summary") or "",
			"requirements": opportunity.get("requirements") or opportunity.get("key_requirements") or "",
			"scope_of_work": opportunity.get("scope_of_work") or opportunity.get("project_scope") or "",
			"estimated_value": opportunity.get("estimated_value") or opportunity.get("budget_numeric"),
			"source": opportunity.get("source"),
			"source_url": opportunity.get("source_url") or opportunity.get("rfp_link"),
			"tags": opportunity.get("tags") or [],
		}

	def _build_strategy_context(
		self,
		opportunity: dict[str, Any],
		organizational_profile: dict[str, Any],
	) -> Any:
		from datetime import datetime, timedelta
		from types import SimpleNamespace

		try:
			from docfusion.intelligence.recommenders.strategy_recommender import OpportunityContext
		except ImportError:
			OpportunityContext = SimpleNamespace

		deadline = opportunity.get("submission_deadline") or opportunity.get("deadline")
		if not isinstance(deadline, datetime):
			deadline = datetime.now() + timedelta(days=30)
		return OpportunityContext(
			opportunity_id=opportunity["id"],
			opportunity_value=float(opportunity.get("estimated_value") or opportunity.get("budget_numeric") or 0),
			submission_deadline=deadline,
			strategic_importance=float(organizational_profile.get("strategic_importance", 0.5)),
			market_expansion_potential=float(organizational_profile.get("market_expansion_potential", 0.5)),
			relationship_building_value=float(organizational_profile.get("relationship_building_value", 0.5)),
			competitive_intensity=float(opportunity.get("competitive_intensity", 0.5)),
			incumbent_advantage=bool(opportunity.get("incumbent_advantage", False)),
			estimated_proposal_effort_hours=float(opportunity.get("estimated_proposal_effort_hours", 120)),
			required_team_size=int(opportunity.get("required_team_size", 4)),
			specialized_skills_required=list(opportunity.get("specialized_skills_required") or []),
		)

	def _to_proposal_section(self, section_type: str, proposal_section: Any) -> Any:
		aliases = {
			"general": proposal_section.UNDERSTANDING_OF_REQUIREMENTS,
			"executive_summary": proposal_section.UNDERSTANDING_OF_REQUIREMENTS,
			"technical": proposal_section.TECHNICAL_APPROACH,
			"technical_approach": proposal_section.TECHNICAL_APPROACH,
			"management_plan": proposal_section.MANAGEMENT_APPROACH,
			"staffing_plan": proposal_section.PERSONNEL_QUALIFICATIONS,
			"past_performance": proposal_section.PAST_PERFORMANCE,
			"cost_proposal": proposal_section.PRICE_COST,
		}
		if section_type in aliases:
			return aliases[section_type]
		try:
			return proposal_section(section_type)
		except ValueError:
			return proposal_section.UNDERSTANDING_OF_REQUIREMENTS

	def _dump_result(self, result: Any) -> dict[str, Any]:
		if hasattr(result, "model_dump"):
			return result.model_dump()
		if isinstance(result, dict):
			return result
		return dict(result)
