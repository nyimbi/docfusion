#!/usr/bin/env python3
"""
Prediction Endpoints

FastAPI endpoints for ML-based prediction services including section scoring
and win probability prediction with comprehensive explainability.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

try:
	from uuid_extensions import uuid7str
except ImportError:
	from uuid import uuid4

	def uuid7str() -> str:
		return str(uuid4())


# Request/Response Models

class SectionScoreRequest(BaseModel):
	"""Request for section score prediction"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True)

	features: Dict[str, float] = Field(
		...,
		description="Section features for prediction"
	)
	section_type: str = Field(
		...,
		description="Type of proposal section (e.g., 'technical_approach', 'past_performance')"
	)
	include_explanation: bool = Field(
		default=True,
		description="Whether to include feature importance explanation"
	)


class WinProbabilityRequest(BaseModel):
	"""Request for win probability prediction"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True)

	# Opportunity characteristics
	opportunity_value: float = Field(description="Estimated opportunity value")
	submission_days_remaining: int = Field(description="Days remaining for submission")
	requirements_complexity: float = Field(
		ge=0.0, le=1.0,
		description="Complexity score of requirements"
	)

	# Organizational factors
	capability_match_score: float = Field(
		ge=0.0, le=1.0,
		description="How well capabilities match requirements"
	)
	past_performance_score: float = Field(
		ge=0.0, le=1.0,
		description="Relevant past performance score"
	)
	team_experience_score: float = Field(
		ge=0.0, le=1.0,
		description="Team experience relevance score"
	)

	# Competitive factors
	competitive_intensity: float = Field(
		ge=0.0, le=1.0,
		description="Level of competition"
	)
	incumbent_advantage: bool = Field(
		description="Whether there's an incumbent advantage"
	)
	estimated_competitors: int = Field(
		ge=0,
		description="Estimated number of competitors"
	)

	# Market factors
	market_familiarity: float = Field(
		ge=0.0, le=1.0,
		description="Familiarity with market/client"
	)
	industry_experience_years: int = Field(
		ge=0,
		description="Years of industry experience"
	)
	client_relationship_score: float = Field(
		ge=0.0, le=1.0,
		description="Quality of client relationship"
	)

	# Strategic factors
	strategic_importance: float = Field(
		ge=0.0, le=1.0,
		description="Strategic importance to organization"
	)
	resource_availability: float = Field(
		ge=0.0, le=1.0,
		description="Availability of required resources"
	)
	pricing_competitiveness: float = Field(
		ge=0.0, le=1.0,
		description="Expected pricing competitiveness"
	)

	# Optional section scores for integration
	section_scores: Optional[Dict[str, float]] = Field(
		default=None,
		description="Optional section scores from ScoringPredictor"
	)


class WinProbabilityFromScoresRequest(BaseModel):
	"""Request for win probability from section scores"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True)

	section_scores: Dict[str, float] = Field(
		...,
		description="Dictionary of section type to predicted score (0-100)"
	)
	opportunity_id: str = Field(
		...,
		description="Unique opportunity identifier"
	)
	opportunity_features: Optional[Dict[str, float]] = Field(
		default=None,
		description="Optional additional opportunity features"
	)


class FeatureContributionResponse(BaseModel):
	"""Feature contribution in prediction"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True)

	feature_name: str = Field(description="Name of the feature")
	feature_value: float = Field(description="Value of the feature")
	contribution: float = Field(description="Contribution to prediction")
	relative_importance: float = Field(description="Relative importance (0-1)")
	direction: str = Field(description="Direction of impact: positive, negative, neutral")
	description: str = Field(description="Human-readable description")


class PredictionExplanationResponse(BaseModel):
	"""Explanation for a prediction"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True)

	prediction_id: str = Field(description="Unique prediction identifier")
	model_type: str = Field(description="Type of model used")
	predicted_value: float = Field(description="Predicted value")
	confidence: float = Field(description="Prediction confidence")

	feature_contributions: List[FeatureContributionResponse] = Field(
		description="Ordered list of feature contributions"
	)
	top_positive_contributors: List[FeatureContributionResponse] = Field(
		description="Top features positively impacting prediction"
	)
	top_negative_contributors: List[FeatureContributionResponse] = Field(
		description="Top features negatively impacting prediction"
	)

	summary: str = Field(description="Human-readable summary explanation")
	key_insights: List[str] = Field(description="Key insights from prediction")
	recommendations: List[str] = Field(description="Improvement recommendations")

	explained_at: datetime = Field(default_factory=datetime.now)


class SectionScoreResponse(BaseModel):
	"""Response for section score prediction"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True)

	prediction_id: str = Field(description="Unique prediction identifier")
	section_type: str = Field(description="Type of proposal section")
	predicted_score: float = Field(
		ge=0.0, le=100.0,
		description="Predicted section score (0-100)"
	)
	confidence_interval: tuple[float, float] = Field(
		description="95% confidence interval for score"
	)

	top_positive_features: List[tuple[str, float]] = Field(
		description="Features positively impacting score"
	)
	top_negative_features: List[tuple[str, float]] = Field(
		description="Features negatively impacting score"
	)

	model_used: str = Field(description="ML model used for prediction")
	prediction_confidence: float = Field(description="Confidence in prediction")

	improvement_suggestions: List[str] = Field(
		description="Specific suggestions to improve score"
	)
	critical_gaps: List[str] = Field(
		description="Critical gaps that must be addressed"
	)

	prediction_timestamp: datetime = Field(default_factory=datetime.now)

	explanation: Optional[PredictionExplanationResponse] = Field(
		default=None,
		description="Detailed prediction explanation if requested"
	)


class WinProbabilityResponse(BaseModel):
	"""Response for win probability prediction"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True)

	opportunity_id: str = Field(description="Opportunity identifier")
	predicted_win_probability: float = Field(
		ge=0.0, le=1.0,
		description="Predicted win probability"
	)
	confidence_interval: tuple[float, float] = Field(
		description="95% confidence interval"
	)

	top_positive_factors: List[tuple[str, float]] = Field(
		description="Top factors increasing win probability"
	)
	top_negative_factors: List[tuple[str, float]] = Field(
		description="Top factors decreasing win probability"
	)

	model_used: str = Field(description="ML model used for prediction")
	prediction_confidence: float = Field(description="Confidence in prediction")

	improvement_recommendations: List[str] = Field(
		description="Recommendations to improve win probability"
	)
	risk_factors: List[str] = Field(
		description="Key risk factors identified"
	)

	prediction_timestamp: datetime = Field(default_factory=datetime.now)

	explanation: Optional[PredictionExplanationResponse] = Field(
		default=None,
		description="Detailed prediction explanation if requested"
	)


class ModelStatusResponse(BaseModel):
	"""Response for model status"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True)

	model_type: str = Field(description="Type of model")
	is_trained: bool = Field(description="Whether model is trained")
	model_version: str = Field(description="Model version")
	training_samples: int = Field(description="Number of training samples")
	last_trained: Optional[datetime] = Field(description="Last training timestamp")

	performance_metrics: Optional[Dict[str, float]] = Field(
		description="Model performance metrics"
	)


# Prediction Endpoints Class

class PredictionEndpoints:
	"""FastAPI prediction endpoints"""

	def __init__(
		self,
		scoring_predictor=None,
		win_probability_predictor=None,
		historical_data_store=None,
		feature_engineer=None,
		model_persistence=None,
		prediction_explainer=None,
	):
		"""
		Initialize prediction endpoints.

		Args:
			scoring_predictor: ScoringPredictor instance
			win_probability_predictor: WinProbabilityPredictor instance
			historical_data_store: HistoricalDataStore instance
			feature_engineer: FeatureEngineer instance
			model_persistence: ModelPersistence instance
			prediction_explainer: PredictionExplainer instance
		"""
		self.scoring_predictor = scoring_predictor
		self.win_probability_predictor = win_probability_predictor
		self.historical_data_store = historical_data_store
		self.feature_engineer = feature_engineer
		self.model_persistence = model_persistence
		self.prediction_explainer = prediction_explainer
		self.logger = logging.getLogger(__name__)

		# Create FastAPI router
		self.router = APIRouter(prefix="/api/v1/predictions", tags=["predictions"])

		# Register endpoints
		self._register_endpoints()

		self.logger.info("Prediction endpoints initialized")

	def _register_endpoints(self):
		"""Register all prediction endpoints"""

		@self.router.post("/score", response_model=SectionScoreResponse)
		async def predict_section_score(request: SectionScoreRequest):
			"""Calculate RFP section score prediction"""
			return await self._handle_section_score_prediction(request)

		@self.router.post("/win-probability", response_model=WinProbabilityResponse)
		async def predict_win_probability(request: WinProbabilityRequest):
			"""Calculate win probability prediction"""
			return await self._handle_win_probability_prediction(request)

		@self.router.post("/win-probability/from-scores", response_model=WinProbabilityResponse)
		async def predict_win_probability_from_scores(request: WinProbabilityFromScoresRequest):
			"""Calculate win probability from section scores"""
			return await self._handle_win_probability_from_scores(request)

		@self.router.get("/{prediction_id}/explain", response_model=PredictionExplanationResponse)
		async def get_prediction_explanation(prediction_id: str):
			"""Get detailed explanation for a prediction"""
			return await self._handle_get_explanation(prediction_id)

		@self.router.get("/models/status", response_model=Dict[str, ModelStatusResponse])
		async def get_models_status():
			"""Get status of all prediction models"""
			return await self._handle_get_models_status()

	async def _handle_section_score_prediction(
		self,
		request: SectionScoreRequest
	) -> SectionScoreResponse:
		"""Handle section score prediction request"""
		try:
			if not self.scoring_predictor:
				raise HTTPException(status_code=503, detail="Scoring predictor not available")

			# Import ProposalSection enum
			from ...intelligence.predictors.scoring_predictor import ProposalSection, SectionFeatures

			# Validate section type
			try:
				section_type = ProposalSection(request.section_type)
			except ValueError:
				valid_types = [s.value for s in ProposalSection]
				raise HTTPException(
					status_code=400,
					detail=f"Invalid section type. Valid types: {valid_types}"
				)

			# Create SectionFeatures from request
			features = SectionFeatures(**request.features)

			# Make prediction
			prediction = await self.scoring_predictor.predict_section_score(features, section_type)

			# Generate explanation if requested
			explanation = None
			if request.include_explanation and self.prediction_explainer:
				explanation = self.prediction_explainer.explain_prediction(
					prediction_id=prediction.prediction_id,
					predicted_value=prediction.predicted_score,
					feature_values=request.features,
					feature_importances=dict(prediction.top_positive_features + prediction.top_negative_features),
					model_type=f"section_scorer_{section_type.value}",
					confidence=prediction.prediction_confidence
				)

			return SectionScoreResponse(
				prediction_id=prediction.prediction_id,
				section_type=section_type.value,
				predicted_score=prediction.predicted_score,
				confidence_interval=prediction.confidence_interval,
				top_positive_features=prediction.top_positive_features,
				top_negative_features=prediction.top_negative_features,
				model_used=prediction.model_used,
				prediction_confidence=prediction.prediction_confidence,
				improvement_suggestions=prediction.improvement_suggestions,
				critical_gaps=prediction.critical_gaps,
				prediction_timestamp=prediction.prediction_timestamp,
				explanation=explanation
			)

		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Section score prediction failed: {e}")
			raise HTTPException(status_code=500, detail=str(e))

	async def _handle_win_probability_prediction(
		self,
		request: WinProbabilityRequest
	) -> WinProbabilityResponse:
		"""Handle win probability prediction request"""
		try:
			if not self.win_probability_predictor:
				raise HTTPException(status_code=503, detail="Win probability predictor not available")

			# Import PredictionFeatures
			from ...intelligence.predictors.win_probability_predictor import PredictionFeatures

			# Create features from request
			features = PredictionFeatures(
				opportunity_value=request.opportunity_value,
				submission_days_remaining=request.submission_days_remaining,
				requirements_complexity=request.requirements_complexity,
				capability_match_score=request.capability_match_score,
				past_performance_score=request.past_performance_score,
				team_experience_score=request.team_experience_score,
				competitive_intensity=request.competitive_intensity,
				incumbent_advantage=request.incumbent_advantage,
				estimated_competitors=request.estimated_competitors,
				market_familiarity=request.market_familiarity,
				industry_experience_years=request.industry_experience_years,
				client_relationship_score=request.client_relationship_score,
				strategic_importance=request.strategic_importance,
				resource_availability=request.resource_availability,
				pricing_competitiveness=request.pricing_competitiveness,
			)

			# Generate opportunity ID
			opportunity_id = uuid7str()

			# Make prediction
			prediction = await self.win_probability_predictor.predict_win_probability(
				features, opportunity_id
			)

			# Generate explanation
			explanation = None
			if self.prediction_explainer:
				feature_values = {
					"opportunity_value": request.opportunity_value,
					"submission_days_remaining": request.submission_days_remaining,
					"requirements_complexity": request.requirements_complexity,
					"capability_match_score": request.capability_match_score,
					"past_performance_score": request.past_performance_score,
					"team_experience_score": request.team_experience_score,
					"competitive_intensity": request.competitive_intensity,
					"incumbent_advantage": float(request.incumbent_advantage),
					"estimated_competitors": request.estimated_competitors,
					"market_familiarity": request.market_familiarity,
					"industry_experience_years": request.industry_experience_years,
					"client_relationship_score": request.client_relationship_score,
					"strategic_importance": request.strategic_importance,
					"resource_availability": request.resource_availability,
					"pricing_competitiveness": request.pricing_competitiveness,
				}

				feature_importances = dict(
					prediction.top_positive_factors + prediction.top_negative_factors
				)

				explanation = self.prediction_explainer.explain_prediction(
					prediction_id=prediction.opportunity_id,
					predicted_value=prediction.predicted_win_probability,
					feature_values=feature_values,
					feature_importances=feature_importances,
					model_type="win_probability",
					confidence=prediction.prediction_confidence
				)

			return WinProbabilityResponse(
				opportunity_id=prediction.opportunity_id,
				predicted_win_probability=prediction.predicted_win_probability,
				confidence_interval=prediction.confidence_interval,
				top_positive_factors=prediction.top_positive_factors,
				top_negative_factors=prediction.top_negative_factors,
				model_used=prediction.model_used,
				prediction_confidence=prediction.prediction_confidence,
				improvement_recommendations=prediction.improvement_recommendations,
				risk_factors=prediction.risk_factors,
				prediction_timestamp=prediction.prediction_timestamp,
				explanation=explanation
			)

		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Win probability prediction failed: {e}")
			raise HTTPException(status_code=500, detail=str(e))

	async def _handle_win_probability_from_scores(
		self,
		request: WinProbabilityFromScoresRequest
	) -> WinProbabilityResponse:
		"""Handle win probability prediction from section scores"""
		try:
			if not self.win_probability_predictor:
				raise HTTPException(status_code=503, detail="Win probability predictor not available")

			# Make prediction from scores
			prediction = await self.win_probability_predictor.predict_win_probability_from_scores(
				section_scores=request.section_scores,
				opportunity_id=request.opportunity_id,
				opportunity_features=request.opportunity_features
			)

			# Generate explanation
			explanation = None
			if self.prediction_explainer:
				feature_importances = dict(
					prediction.top_positive_factors + prediction.top_negative_factors
				)

				explanation = self.prediction_explainer.explain_prediction(
					prediction_id=prediction.opportunity_id,
					predicted_value=prediction.predicted_win_probability,
					feature_values=request.section_scores,
					feature_importances=feature_importances,
					model_type="win_probability_from_scores",
					confidence=prediction.prediction_confidence
				)

			return WinProbabilityResponse(
				opportunity_id=prediction.opportunity_id,
				predicted_win_probability=prediction.predicted_win_probability,
				confidence_interval=prediction.confidence_interval,
				top_positive_factors=prediction.top_positive_factors,
				top_negative_factors=prediction.top_negative_factors,
				model_used=prediction.model_used,
				prediction_confidence=prediction.prediction_confidence,
				improvement_recommendations=prediction.improvement_recommendations,
				risk_factors=prediction.risk_factors,
				prediction_timestamp=prediction.prediction_timestamp,
				explanation=explanation
			)

		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Win probability from scores prediction failed: {e}")
			raise HTTPException(status_code=500, detail=str(e))

	async def _handle_get_explanation(
		self,
		prediction_id: str
	) -> PredictionExplanationResponse:
		"""Handle get prediction explanation request"""
		try:
			if not self.prediction_explainer:
				raise HTTPException(status_code=503, detail="Prediction explainer not available")

			# Try to get cached explanation
			explanation = self.prediction_explainer.get_cached_explanation(prediction_id)

			if not explanation:
				raise HTTPException(
					status_code=404,
					detail=f"Prediction explanation not found: {prediction_id}"
				)

			return explanation

		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Get explanation failed: {e}")
			raise HTTPException(status_code=500, detail=str(e))

	async def _handle_get_models_status(self) -> Dict[str, ModelStatusResponse]:
		"""Handle get models status request"""
		try:
			status = {}

			# Get scoring predictor status
			if self.scoring_predictor:
				status["scoring_predictor"] = ModelStatusResponse(
					model_type="scoring_predictor",
					is_trained=any(self.scoring_predictor.is_trained.values()) if hasattr(self.scoring_predictor, 'is_trained') else False,
					model_version="1.0.0",
					training_samples=len(getattr(self.scoring_predictor, 'training_data', {})),
					last_trained=None,
					performance_metrics=None
				)
			else:
				status["scoring_predictor"] = ModelStatusResponse(
					model_type="scoring_predictor",
					is_trained=False,
					model_version="N/A",
					training_samples=0,
					last_trained=None,
					performance_metrics=None
				)

			# Get win probability predictor status
			if self.win_probability_predictor:
				perf = self.win_probability_predictor.get_model_performance()
				status["win_probability_predictor"] = ModelStatusResponse(
					model_type="win_probability_predictor",
					is_trained=self.win_probability_predictor.is_trained,
					model_version="1.0.0",
					training_samples=len(self.win_probability_predictor.training_data),
					last_trained=None,
					performance_metrics=perf.get('random_forest', {}).get('metrics') if perf else None
				)
			else:
				status["win_probability_predictor"] = ModelStatusResponse(
					model_type="win_probability_predictor",
					is_trained=False,
					model_version="N/A",
					training_samples=0,
					last_trained=None,
					performance_metrics=None
				)

			return status

		except Exception as e:
			self.logger.error(f"Get models status failed: {e}")
			raise HTTPException(status_code=500, detail=str(e))


# Factory function
def create_prediction_endpoints(
	scoring_predictor=None,
	win_probability_predictor=None,
	historical_data_store=None,
	feature_engineer=None,
	model_persistence=None,
	prediction_explainer=None,
) -> PredictionEndpoints:
	"""
	Create prediction endpoints instance.

	Args:
		scoring_predictor: ScoringPredictor instance
		win_probability_predictor: WinProbabilityPredictor instance
		historical_data_store: HistoricalDataStore instance
		feature_engineer: FeatureEngineer instance
		model_persistence: ModelPersistence instance
		prediction_explainer: PredictionExplainer instance

	Returns:
		Configured PredictionEndpoints instance
	"""
	return PredictionEndpoints(
		scoring_predictor=scoring_predictor,
		win_probability_predictor=win_probability_predictor,
		historical_data_store=historical_data_store,
		feature_engineer=feature_engineer,
		model_persistence=model_persistence,
		prediction_explainer=prediction_explainer,
	)