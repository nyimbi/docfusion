"""
Prediction Explainer

Provides explainability for ML model predictions through feature importance analysis,
SHAP-like explanations, and contribution breakdowns.
"""

import logging
from datetime import datetime
from typing import Any, Callable, Dict, List

import numpy as np
from pydantic import BaseModel, ConfigDict, Field


class FeatureContribution(BaseModel):
	"""
	Represents the contribution of a single feature to a prediction.
	"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	feature_name: str = Field(..., description="Name of the feature")
	feature_value: float = Field(..., description="Value of the feature")
	contribution: float = Field(..., description="Contribution to prediction (positive or negative)")
	relative_importance: float = Field(
		default=0.0, ge=0.0, le=1.0,
		description="Relative importance (0-1)"
	)
	direction: str = Field(
		default="neutral",
		description="Direction of impact: positive, negative, neutral"
	)
	description: str = Field(
		default="",
		description="Human-readable description of contribution"
	)


class PredictionExplanation(BaseModel):
	"""
	Complete explanation for a model prediction.
	"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	prediction_id: str = Field(..., description="Unique prediction identifier")
	model_type: str = Field(..., description="Type of model used")
	predicted_value: float = Field(..., description="Predicted value")
	confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Prediction confidence")

	# Feature contributions
	feature_contributions: List[FeatureContribution] = Field(
		default_factory=list,
		description="Ordered list of feature contributions"
	)
	top_positive_contributors: List[FeatureContribution] = Field(
		default_factory=list,
		description="Top features positively impacting prediction"
	)
	top_negative_contributors: List[FeatureContribution] = Field(
		default_factory=list,
		description="Top features negatively impacting prediction"
	)

	# Summary insights
	summary: str = Field(default="", description="Human-readable summary explanation")
	key_insights: List[str] = Field(default_factory=list, description="Key insights from prediction")
	recommendations: List[str] = Field(default_factory=list, description="Improvement recommendations")

	# Model context
	baseline_prediction: float = Field(
		default=0.0,
		description="Baseline (average) prediction for reference"
	)
	feature_interactions: List[Dict[str, Any]] = Field(
		default_factory=list,
		description="Detected feature interactions"
	)

	# Metadata
	explained_at: datetime = Field(default_factory=datetime.now)
	explanation_method: str = Field(default="feature_importance", description="Method used for explanation")


class ExplainerConfig(BaseModel):
	"""Configuration for prediction explainer"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	top_n_features: int = Field(default=10, ge=1, le=50, description="Number of top features to show")
	importance_threshold: float = Field(default=0.01, ge=0.0, le=1.0, description="Minimum importance to include")
	include_interactions: bool = Field(default=True, description="Whether to detect feature interactions")
	generate_recommendations: bool = Field(default=True, description="Whether to generate recommendations")


class PredictionExplainer:
	"""
	Explains model predictions through feature importance and contributions.

	Provides explainability for scoring predictor and win probability predictions
	using various methods including feature importance, SHAP-like analysis,
	and contribution decomposition.
	"""

	def __init__(
		self,
		config: ExplainerConfig | None = None,
		feature_names: List[str] | None = None,
		feature_descriptions: Dict[str, str] | None = None
	):
		"""
		Initialize the prediction explainer.

		Args:
			config: Optional explainer configuration
			feature_names: Optional list of feature names
			feature_descriptions: Optional mapping of feature names to descriptions
		"""
		self.config = config or ExplainerConfig()
		self.feature_names = feature_names or []
		self.feature_descriptions = feature_descriptions or self._get_default_descriptions()
		self.logger = logging.getLogger(__name__)

		# Cache for explanations
		self._explanation_cache: Dict[str, PredictionExplanation] = {}

		self._log_initialization()

	def _get_default_descriptions(self) -> Dict[str, str]:
		"""Get default feature descriptions"""
		return {
			# Section score features
			"word_count": "Total word count in the section",
			"unique_concepts_count": "Number of unique concepts or topics covered",
			"technical_depth_score": "Depth of technical detail provided",
			"clarity_score": "Writing clarity and coherence",
			"requirement_coverage_ratio": "Percentage of requirements addressed",
			"compliance_score": "Compliance with solicitation requirements",
			"quantitative_evidence_count": "Number of quantitative supporting elements",
			"case_study_relevance": "Relevance of case studies and examples",
			"reference_quality_score": "Quality of references and citations",
			"team_expertise_match": "Alignment of team expertise with requirements",
			"past_performance_relevance": "Relevance of past performance examples",
			"innovation_score": "Level of innovative approaches proposed",
			"differentiation_strength": "Strength of differentiators from competitors",
			"risk_identification_completeness": "Completeness of risk identification",
			"mitigation_strategy_quality": "Quality of risk mitigation strategies",
			"section_completion_percentage": "Percentage of section completed",

			# Win probability features
			"opportunity_value": "Estimated value of the opportunity",
			"submission_days_remaining": "Days remaining until submission deadline",
			"requirements_complexity": "Complexity score of requirements",
			"capability_match_score": "How well capabilities match requirements",
			"past_performance_score": "Relevance and quality of past performance",
			"team_experience_score": "Team experience relevance to opportunity",
			"competitive_intensity": "Level of competition expected",
			"incumbent_advantage": "Whether there's an incumbent advantage",
			"estimated_competitors": "Estimated number of competitors",
			"market_familiarity": "Familiarity with market and client",
			"industry_experience_years": "Years of industry experience",
			"client_relationship_score": "Quality of client relationship",
			"strategic_importance": "Strategic importance to organization",
			"resource_availability": "Availability of required resources",
			"pricing_competitiveness": "Expected pricing competitiveness",

			# Compliance features
			"compliance_rate": "Overall compliance rate achieved",
			"mandatory_compliance_rate": "Compliance rate for mandatory requirements",
			"optional_compliance_rate": "Compliance rate for optional requirements",
			"gap_count": "Number of compliance gaps identified",
		}

	def _log_initialization(self) -> None:
		"""Log initialization"""
		self.logger.info("PredictionExplainer initialized")

	def explain_prediction(
		self,
		prediction_id: str,
		predicted_value: float,
		feature_values: Dict[str, float],
		feature_importances: Dict[str, float],
		model_type: str = "unknown",
		confidence: float = 0.0,
		baseline: float = 0.5
	) -> PredictionExplanation:
		"""
		Explain a prediction using feature importances and values.

		Args:
			prediction_id: Unique identifier for this prediction
			predicted_value: The predicted value
			feature_values: Dictionary of feature values used
			feature_importances: Dictionary of feature importance scores
			model_type: Type of model used for prediction
			confidence: Prediction confidence score
			baseline: Baseline prediction value for reference

		Returns:
			PredictionExplanation with detailed breakdown
		"""
		# Calculate contributions for each feature
		contributions = self._calculate_contributions(
			feature_values, feature_importances, baseline, predicted_value
		)

		# Sort contributions by absolute importance
		contributions.sort(key=lambda c: abs(c.contribution), reverse=True)

		# Get top positive and negative contributors
		positive = [c for c in contributions if c.direction == "positive"][:self.config.top_n_features]
		negative = [c for c in contributions if c.direction == "negative"][:self.config.top_n_features]

		# Generate summary and insights
		summary = self._generate_summary(predicted_value, positive, negative, model_type)
		insights = self._generate_insights(contributions, predicted_value, model_type)
		recommendations = []

		if self.config.generate_recommendations:
			recommendations = self._generate_recommendations(contributions, model_type)

		# Detect feature interactions if configured
		interactions = []
		if self.config.include_interactions:
			interactions = self._detect_interactions(feature_values, contributions)

		explanation = PredictionExplanation(
			prediction_id=prediction_id,
			model_type=model_type,
			predicted_value=predicted_value,
			confidence=confidence,
			feature_contributions=contributions,
			top_positive_contributors=positive,
			top_negative_contributors=negative,
			summary=summary,
			key_insights=insights,
			recommendations=recommendations,
			baseline_prediction=baseline,
			feature_interactions=interactions,
			explanation_method="feature_importance",
		)

		# Cache explanation
		self._explanation_cache[prediction_id] = explanation

		return explanation

	def _calculate_contributions(
		self,
		feature_values: Dict[str, float],
		feature_importances: Dict[str, float],
		baseline: float,
		predicted_value: float
	) -> List[FeatureContribution]:
		"""Calculate feature contributions to prediction"""
		contributions = []

		# Normalize feature importances
		total_importance = sum(feature_importances.values()) or 1.0
		normalized_importances = {
			k: v / total_importance for k, v in feature_importances.items()
		}

		for feature_name, value in feature_values.items():
			importance = normalized_importances.get(feature_name, 0.0)

			# Skip features below threshold
			if importance < self.config.importance_threshold:
				continue

			# Calculate contribution
			# Contribution = importance * (value - baseline_contribution)
			# For normalized features, value typically in [0, 1]
			# Positive value * positive importance = positive contribution
			# Negative value * positive importance = negative contribution

			# Determine the "expected" contribution based on baseline
			# Features with values above 0.5 (for normalized features) contribute positively
			contribution = importance * (value - 0.5) * 2  # Scale to [-importance, +importance]

			# Determine direction
			if contribution > 0.01:
				direction = "positive"
			elif contribution < -0.01:
				direction = "negative"
			else:
				direction = "neutral"

			# Get description
			description = self.feature_descriptions.get(
				feature_name,
				f"Feature: {feature_name}"
			)

			# Format description based on contribution
			if direction == "positive":
				description += f" (increases prediction by {abs(contribution):.3f})"
			elif direction == "negative":
				description += f" (decreases prediction by {abs(contribution):.3f})"

			contribution_obj = FeatureContribution(
				feature_name=feature_name,
				feature_value=value,
				contribution=contribution,
				relative_importance=importance,
				direction=direction,
				description=description
			)
			contributions.append(contribution_obj)

		return contributions

	def _generate_summary(
		self,
		predicted_value: float,
		positive: List[FeatureContribution],
		negative: List[FeatureContribution],
		model_type: str
	) -> str:
		"""Generate human-readable summary of prediction"""
		if model_type == "win_probability":
			probability_pct = predicted_value * 100
			summary = f"Predicted win probability: {probability_pct:.1f}%. "

			if positive:
				top_pos = positive[0]
				summary += f"Primary positive factor: {top_pos.feature_name.replace('_', ' ')} "

			if negative:
				top_neg = negative[0]
				summary += f"Primary concern: {top_neg.feature_name.replace('_', ' ')}."

		elif model_type == "section_score":
			summary = f"Predicted section score: {predicted_value:.1f}/100. "

			if positive:
				top_pos = positive[0]
				summary += f"Strongest area: {top_pos.feature_name.replace('_', ' ')}. "

			if negative:
				top_neg = negative[0]
				summary += f"Needs improvement: {top_neg.feature_name.replace('_', ' ')}."

		else:
			summary = f"Predicted value: {predicted_value:.2f}. "

			if positive:
				summary += f"{len(positive)} features positively impact this prediction. "
			if negative:
				summary += f"{len(negative)} features negatively impact this prediction."

		return summary

	def _generate_insights(
		self,
		contributions: List[FeatureContribution],
		predicted_value: float,
		model_type: str
	) -> List[str]:
		"""Generate key insights from contributions"""
		insights = []

		# Sort by absolute contribution
		sorted_contrib = sorted(contributions, key=lambda c: abs(c.contribution), reverse=True)

		# Top 3 most impactful features
		for i, contrib in enumerate(sorted_contrib[:3]):
			feature_name = contrib.feature_name.replace('_', ' ').title()

			if contrib.direction == "positive":
				insights.append(
					f"Top positive factor ({i+1}): {feature_name} with {contrib.relative_importance:.1%} importance"
				)
			elif contrib.direction == "negative":
				insights.append(
					f"Top negative factor ({i+1}): {feature_name} with {contrib.relative_importance:.1%} importance"
				)
			else:
				insights.append(
					f"Neutral factor ({i+1}): {feature_name} with {contrib.relative_importance:.1%} importance"
				)

		# Overall prediction insight
		total_positive = sum(c.contribution for c in contributions if c.direction == "positive")
		total_negative = sum(c.contribution for c in contributions if c.direction == "negative")

		insights.append(
			f"Total positive contribution: {total_positive:.3f}, "
			f"Total negative contribution: {total_negative:.3f}"
		)

		# Model-specific insights
		if model_type == "win_probability":
			if predicted_value > 0.7:
				insights.append("High win probability - strong competitive position")
			elif predicted_value < 0.3:
				insights.append("Low win probability - significant improvements needed")
			else:
				insights.append("Moderate win probability - targeted improvements could help")

		elif model_type == "section_score":
			if predicted_value > 80:
				insights.append("Excellent section score - minimal improvements needed")
			elif predicted_value < 60:
				insights.append("Section needs significant improvement")
			else:
				insights.append("Good section score with room for improvement")

		return insights

	def _generate_recommendations(
		self,
		contributions: List[FeatureContribution],
		model_type: str
	) -> List[str]:
		"""Generate actionable recommendations based on contributions"""
		recommendations = []

		# Get negative contributors (features that reduce prediction)
		negative = [c for c in contributions if c.direction == "negative"]
		negative.sort(key=lambda c: abs(c.contribution), reverse=True)

		# Generate specific recommendations for top negative features
		for contrib in negative[:5]:
			feature_name = contrib.feature_name
			rec = self._get_recommendation_for_feature(feature_name, contrib.feature_value, model_type)
			if rec:
				recommendations.append(rec)

		# Add general recommendations based on model type
		if model_type == "win_probability":
			if len(negative) > 3:
				recommendations.append(
					"Consider addressing multiple weak areas to improve overall competitiveness"
				)

		elif model_type == "section_score":
			if len(negative) > 2:
				recommendations.append(
					"Focus improvement efforts on the highest-impact areas first"
				)

		return recommendations[:10]  # Limit to top 10 recommendations

	def _get_recommendation_for_feature(
		self,
		feature_name: str,
		feature_value: float,
		model_type: str
	) -> str | None:
		"""Get specific recommendation for a feature"""
		recommendations_map = {
			"word_count": "Consider expanding content with more detailed explanations",
			"unique_concepts_count": "Add more unique concepts or topics to increase coverage",
			"technical_depth_score": "Increase technical detail with specific methodologies and implementations",
			"clarity_score": "Improve writing clarity - use simpler sentences and clearer structure",
			"requirement_coverage_ratio": "Ensure all requirements are explicitly addressed",
			"compliance_score": "Review and address compliance requirements more thoroughly",
			"quantitative_evidence_count": "Add more quantitative metrics and supporting data",
			"case_study_relevance": "Include more relevant case studies and examples",
			"reference_quality_score": "Strengthen references and citations",
			"team_expertise_match": "Better align team qualifications with requirements",
			"past_performance_relevance": "Include more relevant past performance examples",
			"innovation_score": "Highlight innovative approaches and unique solutions",
			"differentiation_strength": "Strengthen differentiators from competitors",
			"risk_identification_completeness": "Provide more comprehensive risk identification",
			"mitigation_strategy_quality": "Improve risk mitigation strategy quality",

			"capability_match_score": "Better align capabilities with stated requirements",
			"team_experience_score": "Highlight relevant team experience more effectively",
			"competitive_intensity": "Develop stronger differentiation strategy",
			"client_relationship_score": "Invest in client relationship building",
			"pricing_competitiveness": "Review pricing strategy for competitiveness",
		}

		return recommendations_map.get(feature_name)

	def _detect_interactions(
		self,
		feature_values: Dict[str, float],
		contributions: List[FeatureContribution]
	) -> List[Dict[str, Any]]:
		"""Detect potential feature interactions"""
		interactions = []

		# Check for known interaction patterns
		# Example: compliance_score + requirement_coverage = strong positive
		if "compliance_score" in feature_values and "requirement_coverage_ratio" in feature_values:
			compliance_val = feature_values.get("compliance_score", 0)
			coverage_val = feature_values.get("requirement_coverage_ratio", 0)

			if compliance_val > 0.8 and coverage_val > 0.8:
				interactions.append({
					"type": "synergistic",
					"features": ["compliance_score", "requirement_coverage_ratio"],
					"description": "High compliance and coverage create strong synergy",
					"impact": "positive"
				})

		# Example: low team_experience + low past_performance = compounding negative
		if "team_experience_score" in feature_values and "past_performance_relevance" in feature_values:
			team_val = feature_values.get("team_experience_score", 0)
			past_val = feature_values.get("past_performance_relevance", 0)

			if team_val < 0.5 and past_val < 0.5:
				interactions.append({
					"type": "compounding",
					"features": ["team_experience_score", "past_performance_relevance"],
					"description": "Low team experience and past performance compound negatively",
					"impact": "negative"
				})

		# Example: high innovation + high differentiation = multiplier effect
		if "innovation_score" in feature_values and "differentiation_strength" in feature_values:
			innov_val = feature_values.get("innovation_score", 0)
			diff_val = feature_values.get("differentiation_strength", 0)

			if innov_val > 0.7 and diff_val > 0.7:
				interactions.append({
					"type": "multiplicative",
					"features": ["innovation_score", "differentiation_strength"],
					"description": "Strong innovation and differentiation multiply impact",
					"impact": "positive"
				})

		return interactions

	def get_cached_explanation(self, prediction_id: str) -> PredictionExplanation | None:
		"""
		Get a cached explanation by prediction ID.

		Args:
			prediction_id: The prediction ID

		Returns:
			Cached explanation or None
		"""
		return self._explanation_cache.get(prediction_id)

	def clear_cache(self) -> None:
		"""Clear the explanation cache"""
		self._explanation_cache.clear()
		self.logger.info("Cleared explanation cache")

	def explain_with_shap_approximation(
		self,
		prediction_id: str,
		predicted_value: float,
		feature_values: Dict[str, float],
		model_predict_fn: Callable,
		baseline_features: Dict[str, float] | None = None,
		n_samples: int = 100
	) -> PredictionExplanation:
		"""
		Explain prediction using SHAP-like approximation.

		This is a simplified SHAP implementation that approximates
		feature contributions through sampling.

		Args:
			prediction_id: Unique identifier
			predicted_value: The predicted value
			feature_values: Feature values used for prediction
			model_predict_fn: Function that takes features and returns prediction
			baseline_features: Optional baseline feature values
			n_samples: Number of samples for approximation

		Returns:
			PredictionExplanation with SHAP-like contributions
		"""
		# Use provided baseline or compute from feature values
		if baseline_features is None:
			baseline_features = {k: 0.5 for k in feature_values.keys()}

		feature_names = list(feature_values.keys())
		n_features = len(feature_names)

		# Initialize SHAP values
		shap_values = {name: 0.0 for name in feature_names}

		# Approximate SHAP values through sampling
		for _ in range(n_samples):
			# Create random permutation
			perm = np.random.permutation(n_features)

			# Build up prediction incrementally
			current_features = baseline_features.copy()

			for idx in perm:
				feature_name = feature_names[idx]
				# Get prediction before adding feature
				pred_before = model_predict_fn(current_features)

				# Add feature
				current_features[feature_name] = feature_values[feature_name]

				# Get prediction after adding feature
				pred_after = model_predict_fn(current_features)

				# Marginal contribution
				shap_values[feature_name] += (pred_after - pred_before)

		# Average
		for name in feature_names:
			shap_values[name] /= n_samples

		# Create feature importance dict from SHAP values
		feature_importances = {
			name: abs(val) for name, val in shap_values.items()
		}

		# Normalize
		total = sum(feature_importances.values()) or 1.0
		feature_importances = {k: v / total for k, v in feature_importances.items()}

		# Use existing explain_prediction method
		explanation = self.explain_prediction(
			prediction_id=prediction_id,
			predicted_value=predicted_value,
			feature_values=feature_values,
			feature_importances=feature_importances,
			model_type="shap_explained",
			confidence=1.0,
			baseline=model_predict_fn(baseline_features)
		)

		# Override explanation method
		explanation.explanation_method = "shap_approximation"

		return explanation


# Convenience factory function
def create_prediction_explainer(
	config: ExplainerConfig | None = None,
	feature_names: List[str] | None = None,
	feature_descriptions: Dict[str, str] | None = None
) -> PredictionExplainer:
	"""
	Create a PredictionExplainer instance.

	Args:
		config: Optional explainer configuration
		feature_names: Optional list of feature names
		feature_descriptions: Optional mapping of feature names to descriptions

	Returns:
		Configured PredictionExplainer instance
	"""
	return PredictionExplainer(config, feature_names, feature_descriptions)