"""
Relevance Filter for Multi-Criteria Opportunity Filtering

This module provides sophisticated filtering capabilities to identify
the most relevant opportunities based on multiple weighted criteria
including strategic fit, capability alignment, and business potential.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from uuid import uuid4

import numpy as np
from pydantic import BaseModel, Field, ConfigDict, validator
from pydantic.dataclasses import dataclass as pydantic_dataclass

from ...core.models.base import BaseEntity
from ..models.opportunity_models import OpportunityData
from .opportunity_analyzer import OpportunityAnalysis
from .qualification_analyzer import QualificationAssessment


class FilterCriterion(Enum):
	"""Available filtering criteria"""
	STRATEGIC_FIT = "strategic_fit"
	CAPABILITY_MATCH = "capability_match"
	FINANCIAL_VALUE = "financial_value"
	WIN_PROBABILITY = "win_probability"
	RESOURCE_AVAILABILITY = "resource_availability"
	TIMELINE_FEASIBILITY = "timeline_feasibility"
	COMPETITIVE_ADVANTAGE = "competitive_advantage"
	RISK_LEVEL = "risk_level"
	CLIENT_RELATIONSHIP = "client_relationship"
	MARKET_OPPORTUNITY = "market_opportunity"


class FilterOperator(Enum):
	"""Filter operators for criteria evaluation"""
	GREATER_THAN = "gt"
	LESS_THAN = "lt"
	GREATER_EQUAL = "gte"
	LESS_EQUAL = "lte"
	EQUALS = "eq"
	IN_RANGE = "in_range"
	CONTAINS = "contains"
	MATCHES = "matches"


class FilterRule(BaseModel):
	"""Individual filter rule definition"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	criterion: FilterCriterion = Field(description="Filter criterion to evaluate")
	operator: FilterOperator = Field(description="Comparison operator")
	value: Union[float, int, str, List[Any]] = Field(description="Threshold or comparison value")
	weight: float = Field(default=1.0, ge=0.0, le=10.0, description="Rule importance weight")
	is_mandatory: bool = Field(default=False, description="Whether rule is mandatory (eliminates if failed)")
	description: str = Field(description="Human-readable rule description")


class ScoringModel(BaseModel):
	"""Scoring model configuration"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	model_name: str = Field(description="Name of the scoring model")
	criteria_weights: Dict[FilterCriterion, float] = Field(description="Weights for each criterion")
	normalization_method: str = Field(default="min_max", description="Score normalization method")
	aggregation_method: str = Field(default="weighted_sum", description="Score aggregation method")
	
	@validator('criteria_weights')
	def validate_weights(cls, v):
		total_weight = sum(v.values())
		if abs(total_weight - 1.0) > 0.001:  # Allow small floating point differences
			raise ValueError(f"Criteria weights must sum to 1.0, got {total_weight}")
		return v


class FilterProfile(BaseModel):
	"""Complete filtering profile with rules and scoring"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	profile_name: str = Field(description="Name of the filter profile")
	description: str = Field(description="Profile description and use case")
	filter_rules: List[FilterRule] = Field(description="List of filter rules to apply")
	scoring_model: ScoringModel = Field(description="Scoring model configuration")
	
	# Profile metadata
	created_date: datetime = Field(default_factory=datetime.now)
	last_updated: datetime = Field(default_factory=datetime.now)
	usage_count: int = Field(default=0, ge=0)
	success_rate: float = Field(default=0.0, ge=0.0, le=1.0)


class OpportunityScore(BaseModel):
	"""Individual opportunity scoring result"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	opportunity_id: str = Field(description="Opportunity identifier")
	overall_score: float = Field(ge=0.0, le=1.0, description="Overall relevance score")
	
	# Individual criterion scores
	criterion_scores: Dict[FilterCriterion, float] = Field(description="Scores by criterion")
	weighted_scores: Dict[FilterCriterion, float] = Field(description="Weighted scores by criterion")
	
	# Rule evaluation results
	passed_rules: List[str] = Field(description="Rules that passed")
	failed_rules: List[str] = Field(description="Rules that failed")
	mandatory_failures: List[str] = Field(description="Failed mandatory rules")
	
	# Qualitative assessments
	strengths: List[str] = Field(description="Key opportunity strengths")
	weaknesses: List[str] = Field(description="Key opportunity weaknesses")
	risk_factors: List[str] = Field(description="Identified risk factors")
	
	# Metadata
	score_confidence: float = Field(ge=0.0, le=1.0, description="Scoring confidence level")
	evaluation_timestamp: datetime = Field(default_factory=datetime.now)


class FilteringResults(BaseModel):
	"""Complete filtering and scoring results"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	profile_used: str = Field(description="Filter profile name used")
	total_opportunities: int = Field(ge=0, description="Total opportunities evaluated")
	
	# Filtering results
	passed_opportunities: List[OpportunityScore] = Field(description="Opportunities that passed all filters")
	failed_opportunities: List[OpportunityScore] = Field(description="Opportunities that failed filtering")
	
	# Score-based rankings
	top_opportunities: List[OpportunityScore] = Field(description="Top-ranked opportunities")
	recommended_opportunities: List[OpportunityScore] = Field(description="Recommended for pursuit")
	
	# Analytics
	score_distribution: Dict[str, int] = Field(description="Distribution of scores by range")
	criterion_performance: Dict[FilterCriterion, float] = Field(description="Average performance by criterion")
	
	# Summary statistics
	average_score: float = Field(ge=0.0, le=1.0, description="Average opportunity score")
	median_score: float = Field(ge=0.0, le=1.0, description="Median opportunity score")
	score_variance: float = Field(ge=0.0, description="Score variance")
	
	# Metadata
	filtering_timestamp: datetime = Field(default_factory=datetime.now)
	processing_time: timedelta = Field(description="Time taken for filtering process")


@pydantic_dataclass
class OpportunityContext:
	"""Extended context for opportunity evaluation"""
	
	opportunity_data: OpportunityData
	opportunity_analysis: Optional[OpportunityAnalysis] = None
	qualification_assessment: Optional[QualificationAssessment] = None
	
	# Additional context
	strategic_priority: float = field(default=0.5)
	resource_constraints: Dict[str, Any] = field(default_factory=dict)
	market_conditions: Dict[str, Any] = field(default_factory=dict)
	competitive_landscape: Dict[str, Any] = field(default_factory=dict)
	client_history: Dict[str, Any] = field(default_factory=dict)


class RelevanceFilter:
	"""
	Advanced multi-criteria opportunity relevance filter
	
	Provides sophisticated filtering and scoring capabilities to identify
	the most relevant opportunities based on configurable criteria and
	business rules.
	"""
	
	def __init__(self):
		self.default_profiles = self._create_default_profiles()
		self.scoring_history: List[Dict[str, Any]] = []
		
		# Pre-defined scoring models
		self.scoring_models = {
			'balanced': self._create_balanced_scoring_model(),
			'growth_focused': self._create_growth_focused_model(),
			'risk_averse': self._create_risk_averse_model(),
			'capability_driven': self._create_capability_driven_model()
		}
	
	def _create_default_profiles(self) -> Dict[str, FilterProfile]:
		"""Create default filter profiles for common use cases"""
		
		profiles = {}
		
		# High-Value Opportunities Profile
		high_value_rules = [
			FilterRule(
				criterion=FilterCriterion.FINANCIAL_VALUE,
				operator=FilterOperator.GREATER_EQUAL,
				value=1000000.0,
				weight=3.0,
				is_mandatory=True,
				description="Minimum contract value of $1M"
			),
			FilterRule(
				criterion=FilterCriterion.WIN_PROBABILITY,
				operator=FilterOperator.GREATER_EQUAL,
				value=0.3,
				weight=2.0,
				is_mandatory=False,
				description="Win probability at least 30%"
			),
			FilterRule(
				criterion=FilterCriterion.CAPABILITY_MATCH,
				operator=FilterOperator.GREATER_EQUAL,
				value=0.7,
				weight=2.5,
				is_mandatory=True,
				description="Strong capability alignment required"
			)
		]
		
		profiles['high_value'] = FilterProfile(
			profile_name="High-Value Opportunities",
			description="Focus on high-value contracts with strong capability alignment",
			filter_rules=high_value_rules,
			scoring_model=self._create_balanced_scoring_model()
		)
		
		# Strategic Growth Profile
		strategic_rules = [
			FilterRule(
				criterion=FilterCriterion.STRATEGIC_FIT,
				operator=FilterOperator.GREATER_EQUAL,
				value=0.8,
				weight=3.0,
				is_mandatory=True,
				description="High strategic alignment required"
			),
			FilterRule(
				criterion=FilterCriterion.MARKET_OPPORTUNITY,
				operator=FilterOperator.GREATER_EQUAL,
				value=0.6,
				weight=2.0,
				is_mandatory=False,
				description="Good market opportunity potential"
			),
			FilterRule(
				criterion=FilterCriterion.COMPETITIVE_ADVANTAGE,
				operator=FilterOperator.GREATER_EQUAL,
				value=0.5,
				weight=2.0,
				is_mandatory=False,
				description="Some competitive advantage preferred"
			)
		]
		
		profiles['strategic_growth'] = FilterProfile(
			profile_name="Strategic Growth",
			description="Opportunities aligned with strategic growth objectives",
			filter_rules=strategic_rules,
			scoring_model=self._create_growth_focused_model()
		)
		
		# Low-Risk Profile
		low_risk_rules = [
			FilterRule(
				criterion=FilterCriterion.RISK_LEVEL,
				operator=FilterOperator.LESS_EQUAL,
				value=0.3,
				weight=3.0,
				is_mandatory=True,
				description="Low to moderate risk tolerance"
			),
			FilterRule(
				criterion=FilterCriterion.CAPABILITY_MATCH,
				operator=FilterOperator.GREATER_EQUAL,
				value=0.8,
				weight=2.5,
				is_mandatory=True,
				description="Strong existing capability match"
			),
			FilterRule(
				criterion=FilterCriterion.CLIENT_RELATIONSHIP,
				operator=FilterOperator.GREATER_EQUAL,
				value=0.6,
				weight=2.0,
				is_mandatory=False,
				description="Existing client relationship preferred"
			)
		]
		
		profiles['low_risk'] = FilterProfile(
			profile_name="Low-Risk Opportunities",
			description="Conservative approach focusing on low-risk, high-capability-match opportunities",
			filter_rules=low_risk_rules,
			scoring_model=self._create_risk_averse_model()
		)
		
		return profiles
	
	def _create_balanced_scoring_model(self) -> ScoringModel:
		"""Create balanced scoring model"""
		return ScoringModel(
			model_name="Balanced",
			criteria_weights={
				FilterCriterion.STRATEGIC_FIT: 0.20,
				FilterCriterion.CAPABILITY_MATCH: 0.20,
				FilterCriterion.FINANCIAL_VALUE: 0.15,
				FilterCriterion.WIN_PROBABILITY: 0.15,
				FilterCriterion.TIMELINE_FEASIBILITY: 0.10,
				FilterCriterion.COMPETITIVE_ADVANTAGE: 0.10,
				FilterCriterion.RISK_LEVEL: 0.10
			}
		)
	
	def _create_growth_focused_model(self) -> ScoringModel:
		"""Create growth-focused scoring model"""
		return ScoringModel(
			model_name="Growth Focused",
			criteria_weights={
				FilterCriterion.STRATEGIC_FIT: 0.25,
				FilterCriterion.MARKET_OPPORTUNITY: 0.20,
				FilterCriterion.FINANCIAL_VALUE: 0.20,
				FilterCriterion.COMPETITIVE_ADVANTAGE: 0.15,
				FilterCriterion.CAPABILITY_MATCH: 0.10,
				FilterCriterion.WIN_PROBABILITY: 0.10
			}
		)
	
	def _create_risk_averse_model(self) -> ScoringModel:
		"""Create risk-averse scoring model"""
		return ScoringModel(
			model_name="Risk Averse",
			criteria_weights={
				FilterCriterion.CAPABILITY_MATCH: 0.30,
				FilterCriterion.RISK_LEVEL: 0.25,
				FilterCriterion.CLIENT_RELATIONSHIP: 0.15,
				FilterCriterion.WIN_PROBABILITY: 0.15,
				FilterCriterion.TIMELINE_FEASIBILITY: 0.10,
				FilterCriterion.FINANCIAL_VALUE: 0.05
			}
		)
	
	def _create_capability_driven_model(self) -> ScoringModel:
		"""Create capability-driven scoring model"""
		return ScoringModel(
			model_name="Capability Driven",
			criteria_weights={
				FilterCriterion.CAPABILITY_MATCH: 0.35,
				FilterCriterion.COMPETITIVE_ADVANTAGE: 0.20,
				FilterCriterion.STRATEGIC_FIT: 0.15,
				FilterCriterion.WIN_PROBABILITY: 0.15,
				FilterCriterion.FINANCIAL_VALUE: 0.10,
				FilterCriterion.RESOURCE_AVAILABILITY: 0.05
			}
		)
	
	async def filter_opportunities(self,
	                               opportunity_contexts: List[OpportunityContext],
	                               profile_name: str = 'balanced',
	                               custom_profile: Optional[FilterProfile] = None) -> FilteringResults:
		"""
		Filter and score opportunities using specified profile
		
		Args:
			opportunity_contexts: List of opportunities with context
			profile_name: Name of pre-defined profile to use
			custom_profile: Custom filter profile (overrides profile_name)
			
		Returns:
			Complete filtering and scoring results
		"""
		start_time = datetime.now()
		
		try:
			# Determine which profile to use
			if custom_profile:
				profile = custom_profile
			elif profile_name in self.default_profiles:
				profile = self.default_profiles[profile_name]
			else:
				profile = self.default_profiles['balanced']  # Default fallback
			
			# Score all opportunities
			opportunity_scores = []
			for context in opportunity_contexts:
				score = await self._score_opportunity(context, profile)
				opportunity_scores.append(score)
			
			# Apply filtering rules
			passed_opportunities = []
			failed_opportunities = []
			
			for score in opportunity_scores:
				if not score.mandatory_failures:  # No mandatory rule failures
					passed_opportunities.append(score)
				else:
					failed_opportunities.append(score)
			
			# Rank and categorize opportunities
			ranked_opportunities = sorted(
				passed_opportunities,
				key=lambda x: x.overall_score,
				reverse=True
			)
			
			# Determine top and recommended opportunities
			top_count = min(10, len(ranked_opportunities))
			top_opportunities = ranked_opportunities[:top_count]
			
			# Recommended: top 70th percentile with score > 0.6
			score_threshold = np.percentile(
				[s.overall_score for s in ranked_opportunities] or [0],
				70
			) if ranked_opportunities else 0
			recommended_opportunities = [
				opp for opp in ranked_opportunities
				if opp.overall_score >= max(score_threshold, 0.6)
			]
			
			# Calculate analytics
			all_scores = [score.overall_score for score in opportunity_scores]
			score_distribution = self._calculate_score_distribution(all_scores)
			criterion_performance = self._calculate_criterion_performance(opportunity_scores)
			
			processing_time = datetime.now() - start_time
			
			results = FilteringResults(
				profile_used=profile.profile_name,
				total_opportunities=len(opportunity_contexts),
				passed_opportunities=passed_opportunities,
				failed_opportunities=failed_opportunities,
				top_opportunities=top_opportunities,
				recommended_opportunities=recommended_opportunities,
				score_distribution=score_distribution,
				criterion_performance=criterion_performance,
				average_score=np.mean(all_scores) if all_scores else 0.0,
				median_score=np.median(all_scores) if all_scores else 0.0,
				score_variance=np.var(all_scores) if all_scores else 0.0,
				processing_time=processing_time
			)
			
			# Update profile usage statistics
			profile.usage_count += 1
			profile.last_updated = datetime.now()
			
			# Store results for analysis
			self.scoring_history.append({
				'timestamp': datetime.now(),
				'profile': profile.profile_name,
				'total_opportunities': len(opportunity_contexts),
				'passed_count': len(passed_opportunities),
				'average_score': results.average_score
			})
			
			return results
			
		except Exception as e:
			self._log_filtering_error(f"Filtering failed: {str(e)}")
			raise
	
	async def _score_opportunity(self, context: OpportunityContext, 
	                             profile: FilterProfile) -> OpportunityScore:
		"""Score individual opportunity against filter profile"""
		
		opportunity = context.opportunity_data
		
		# Calculate individual criterion scores
		criterion_scores = {}
		for criterion in FilterCriterion:
			score = await self._calculate_criterion_score(criterion, context)
			criterion_scores[criterion] = score
		
		# Apply scoring model weights
		weighted_scores = {}
		total_weighted_score = 0.0
		
		for criterion, weight in profile.scoring_model.criteria_weights.items():
			weighted_score = criterion_scores.get(criterion, 0.0) * weight
			weighted_scores[criterion] = weighted_score
			total_weighted_score += weighted_score
		
		# Evaluate filter rules
		passed_rules = []
		failed_rules = []
		mandatory_failures = []
		
		for rule in profile.filter_rules:
			rule_result = await self._evaluate_filter_rule(rule, context, criterion_scores)
			
			if rule_result:
				passed_rules.append(rule.description)
			else:
				failed_rules.append(rule.description)
				if rule.is_mandatory:
					mandatory_failures.append(rule.description)
		
		# Generate qualitative assessments
		strengths = self._identify_opportunity_strengths(criterion_scores, context)
		weaknesses = self._identify_opportunity_weaknesses(criterion_scores, context)
		risk_factors = self._identify_risk_factors(criterion_scores, context)
		
		# Calculate overall confidence
		confidence = self._calculate_scoring_confidence(
			criterion_scores, context.qualification_assessment
		)
		
		return OpportunityScore(
			opportunity_id=opportunity.id,
			overall_score=min(total_weighted_score, 1.0),
			criterion_scores=criterion_scores,
			weighted_scores=weighted_scores,
			passed_rules=passed_rules,
			failed_rules=failed_rules,
			mandatory_failures=mandatory_failures,
			strengths=strengths,
			weaknesses=weaknesses,
			risk_factors=risk_factors,
			score_confidence=confidence
		)
	
	async def _calculate_criterion_score(self, criterion: FilterCriterion,
	                                     context: OpportunityContext) -> float:
		"""Calculate score for individual criterion"""
		
		opportunity = context.opportunity_data
		analysis = context.opportunity_analysis
		qualification = context.qualification_assessment
		
		if criterion == FilterCriterion.STRATEGIC_FIT:
			return context.strategic_priority
		
		elif criterion == FilterCriterion.CAPABILITY_MATCH:
			if qualification:
				return qualification.overall_match_score
			else:
				return 0.5  # Default neutral score
		
		elif criterion == FilterCriterion.FINANCIAL_VALUE:
			if opportunity.estimated_value:
				# Normalize based on typical contract sizes
				max_value = 50000000.0  # $50M as reference max
				return min(opportunity.estimated_value / max_value, 1.0)
			else:
				return 0.0
		
		elif criterion == FilterCriterion.WIN_PROBABILITY:
			if qualification:
				return qualification.win_probability
			elif analysis:
				# Extract from opportunity analysis if available
				return getattr(analysis, 'win_probability', 0.5)
			else:
				return 0.5  # Default neutral
		
		elif criterion == FilterCriterion.RESOURCE_AVAILABILITY:
			# Would be calculated based on current resource utilization
			# For now, use simple heuristic
			if opportunity.submission_deadline:
				days_to_deadline = (opportunity.submission_deadline - datetime.now()).days
				if days_to_deadline > 60:
					return 0.9  # Good availability
				elif days_to_deadline > 30:
					return 0.6  # Moderate availability
				else:
					return 0.3  # Limited availability
			else:
				return 0.5
		
		elif criterion == FilterCriterion.TIMELINE_FEASIBILITY:
			if opportunity.submission_deadline:
				days_to_deadline = (opportunity.submission_deadline - datetime.now()).days
				if days_to_deadline >= 45:
					return 1.0  # Excellent feasibility
				elif days_to_deadline >= 30:
					return 0.8  # Good feasibility
				elif days_to_deadline >= 15:
					return 0.5  # Moderate feasibility
				else:
					return 0.2  # Poor feasibility
			else:
				return 0.5
		
		elif criterion == FilterCriterion.COMPETITIVE_ADVANTAGE:
			if qualification:
				# Based on differentiators and strengths
				advantage_score = len(qualification.differentiators) * 0.2
				return min(advantage_score, 1.0)
			else:
				return 0.4  # Default low advantage
		
		elif criterion == FilterCriterion.RISK_LEVEL:
			# Lower risk = higher score (inverted)
			base_risk = 0.5
			
			if qualification:
				# Higher number of gaps = higher risk = lower score
				risk_penalty = len(qualification.qualification_gaps) * 0.1
				base_risk += risk_penalty
			
			# Check for other risk factors
			if opportunity.submission_deadline:
				days_to_deadline = (opportunity.submission_deadline - datetime.now()).days
				if days_to_deadline < 30:
					base_risk += 0.2  # Timeline risk
			
			# Invert risk to score (lower risk = higher score)
			return max(1.0 - min(base_risk, 1.0), 0.0)
		
		elif criterion == FilterCriterion.CLIENT_RELATIONSHIP:
			# Would be based on historical client data
			# For now, use opportunity source as proxy
			if hasattr(opportunity, 'source') and opportunity.source:
				if 'repeat' in opportunity.source.lower() or 'referral' in opportunity.source.lower():
					return 0.8
				elif 'cold' in opportunity.source.lower():
					return 0.2
			return 0.5
		
		elif criterion == FilterCriterion.MARKET_OPPORTUNITY:
			# Would be based on market analysis
			# For now, use industry and contract value as proxy
			base_score = 0.5
			
			if opportunity.estimated_value and opportunity.estimated_value > 5000000:
				base_score += 0.2  # Large market opportunity
			
			# Could add industry-specific multipliers here
			return min(base_score, 1.0)
		
		else:
			return 0.5  # Default neutral score
	
	async def _evaluate_filter_rule(self, rule: FilterRule, context: OpportunityContext,
	                                criterion_scores: Dict[FilterCriterion, float]) -> bool:
		"""Evaluate individual filter rule"""
		
		criterion_score = criterion_scores.get(rule.criterion, 0.0)
		threshold = rule.value
		
		if rule.operator == FilterOperator.GREATER_THAN:
			return criterion_score > threshold
		elif rule.operator == FilterOperator.LESS_THAN:
			return criterion_score < threshold
		elif rule.operator == FilterOperator.GREATER_EQUAL:
			return criterion_score >= threshold
		elif rule.operator == FilterOperator.LESS_EQUAL:
			return criterion_score <= threshold
		elif rule.operator == FilterOperator.EQUALS:
			return abs(criterion_score - threshold) < 0.01
		elif rule.operator == FilterOperator.IN_RANGE:
			if isinstance(threshold, list) and len(threshold) == 2:
				return threshold[0] <= criterion_score <= threshold[1]
		
		# For string-based operators, would need additional context
		# For now, return True as default
		return True
	
	def _identify_opportunity_strengths(self, criterion_scores: Dict[FilterCriterion, float],
	                                    context: OpportunityContext) -> List[str]:
		"""Identify key opportunity strengths"""
		strengths = []
		
		# High-scoring criteria become strengths
		for criterion, score in criterion_scores.items():
			if score >= 0.8:
				if criterion == FilterCriterion.STRATEGIC_FIT:
					strengths.append("Strong strategic alignment")
				elif criterion == FilterCriterion.CAPABILITY_MATCH:
					strengths.append("Excellent capability match")
				elif criterion == FilterCriterion.FINANCIAL_VALUE:
					strengths.append("High financial value")
				elif criterion == FilterCriterion.WIN_PROBABILITY:
					strengths.append("High win probability")
				elif criterion == FilterCriterion.COMPETITIVE_ADVANTAGE:
					strengths.append("Strong competitive position")
		
		# Add context-specific strengths
		if context.qualification_assessment:
			strengths.extend(context.qualification_assessment.strengths[:2])
		
		return strengths[:5]  # Limit to top 5
	
	def _identify_opportunity_weaknesses(self, criterion_scores: Dict[FilterCriterion, float],
	                                     context: OpportunityContext) -> List[str]:
		"""Identify key opportunity weaknesses"""
		weaknesses = []
		
		# Low-scoring criteria become weaknesses
		for criterion, score in criterion_scores.items():
			if score <= 0.4:
				if criterion == FilterCriterion.STRATEGIC_FIT:
					weaknesses.append("Limited strategic alignment")
				elif criterion == FilterCriterion.CAPABILITY_MATCH:
					weaknesses.append("Capability gaps present")
				elif criterion == FilterCriterion.WIN_PROBABILITY:
					weaknesses.append("Low win probability")
				elif criterion == FilterCriterion.TIMELINE_FEASIBILITY:
					weaknesses.append("Challenging timeline")
				elif criterion == FilterCriterion.COMPETITIVE_ADVANTAGE:
					weaknesses.append("Limited competitive differentiation")
		
		# Add gap-specific weaknesses
		if context.qualification_assessment:
			for gap in context.qualification_assessment.qualification_gaps[:2]:
				weaknesses.append(f"Gap: {gap.description}")
		
		return weaknesses[:5]  # Limit to top 5
	
	def _identify_risk_factors(self, criterion_scores: Dict[FilterCriterion, float],
	                           context: OpportunityContext) -> List[str]:
		"""Identify key risk factors"""
		risks = []
		
		# High risk score = low actual risk, so look for low scores in risk criterion
		risk_score = criterion_scores.get(FilterCriterion.RISK_LEVEL, 0.5)
		if risk_score < 0.6:
			risks.append("Elevated project risk")
		
		# Timeline risks
		timeline_score = criterion_scores.get(FilterCriterion.TIMELINE_FEASIBILITY, 0.5)
		if timeline_score < 0.5:
			risks.append("Tight submission timeline")
		
		# Capability risks
		capability_score = criterion_scores.get(FilterCriterion.CAPABILITY_MATCH, 0.5)
		if capability_score < 0.6:
			risks.append("Capability development required")
		
		# Add qualification-specific risks
		if context.qualification_assessment:
			critical_gaps = [gap for gap in context.qualification_assessment.qualification_gaps
			                 if gap.severity == "critical"]
			if critical_gaps:
				risks.append("Critical qualification gaps")
		
		return risks[:4]  # Limit to top 4
	
	def _calculate_scoring_confidence(self, criterion_scores: Dict[FilterCriterion, float],
	                                  qualification: Optional[QualificationAssessment]) -> float:
		"""Calculate overall scoring confidence"""
		base_confidence = 0.7
		
		# Higher confidence with more complete information
		complete_scores = sum(1 for score in criterion_scores.values() if score != 0.5)
		total_criteria = len(criterion_scores)
		
		if total_criteria > 0:
			completeness_bonus = (complete_scores / total_criteria) * 0.2
			base_confidence += completeness_bonus
		
		# Higher confidence with qualification assessment
		if qualification:
			base_confidence += 0.1
		
		return min(base_confidence, 1.0)
	
	def _calculate_score_distribution(self, scores: List[float]) -> Dict[str, int]:
		"""Calculate score distribution by range"""
		if not scores:
			return {}
		
		distribution = {
			'excellent (0.8-1.0)': 0,
			'good (0.6-0.8)': 0,
			'average (0.4-0.6)': 0,
			'poor (0.2-0.4)': 0,
			'very_poor (0.0-0.2)': 0
		}
		
		for score in scores:
			if score >= 0.8:
				distribution['excellent (0.8-1.0)'] += 1
			elif score >= 0.6:
				distribution['good (0.6-0.8)'] += 1
			elif score >= 0.4:
				distribution['average (0.4-0.6)'] += 1
			elif score >= 0.2:
				distribution['poor (0.2-0.4)'] += 1
			else:
				distribution['very_poor (0.0-0.2)'] += 1
		
		return distribution
	
	def _calculate_criterion_performance(self, opportunity_scores: List[OpportunityScore]) -> Dict[FilterCriterion, float]:
		"""Calculate average performance by criterion"""
		if not opportunity_scores:
			return {}
		
		criterion_sums = {}
		for score in opportunity_scores:
			for criterion, value in score.criterion_scores.items():
				if criterion not in criterion_sums:
					criterion_sums[criterion] = []
				criterion_sums[criterion].append(value)
		
		return {
			criterion: np.mean(values)
			for criterion, values in criterion_sums.items()
		}
	
	def get_profile_recommendations(self, results: FilteringResults) -> List[str]:
		"""Get recommendations for profile optimization"""
		recommendations = []
		
		# Analyze results to suggest improvements
		if results.average_score < 0.5:
			recommendations.append("Consider loosening filter criteria - many opportunities scoring below average")
		
		if len(results.recommended_opportunities) == 0:
			recommendations.append("No opportunities meet recommendation threshold - review scoring model")
		
		if results.score_variance < 0.05:
			recommendations.append("Low score variance - consider adjusting weights for better differentiation")
		
		# Analyze criterion performance
		low_performing_criteria = [
			criterion for criterion, avg_score in results.criterion_performance.items()
			if avg_score < 0.4
		]
		
		if low_performing_criteria:
			recommendations.append(f"Consider capability development in: {', '.join([c.value for c in low_performing_criteria[:3]])}")
		
		return recommendations
	
	def _log_filtering_error(self, message: str) -> None:
		"""Log filtering errors"""
		print(f"RelevanceFilter Error: {message}")


# Example usage and testing
async def create_sample_relevance_filtering():
	"""Create sample relevance filtering for testing"""
	
	# Sample opportunity contexts
	opportunity_contexts = []
	
	for i in range(5):
		opportunity = OpportunityData(
			id=f"test_opp_{i:03d}",
			title=f"Test Opportunity {i+1}",
			description=f"Sample opportunity description {i+1}",
			estimated_value=float((i+1) * 1000000),  # $1M to $5M
			submission_deadline=datetime.now() + timedelta(days=30 + i*10)
		)
		
		context = OpportunityContext(
			opportunity_data=opportunity,
			strategic_priority=0.5 + (i * 0.1),  # Varying strategic priority
		)
		
		opportunity_contexts.append(context)
	
	# Run filtering
	filter_engine = RelevanceFilter()
	results = await filter_engine.filter_opportunities(opportunity_contexts, 'balanced')
	
	return results


if __name__ == "__main__":
	# Test the relevance filter
	import asyncio
	
	async def main():
		results = await create_sample_relevance_filtering()
		print(f"Total Opportunities: {results.total_opportunities}")
		print(f"Passed Filtering: {len(results.passed_opportunities)}")
		print(f"Top Opportunities: {len(results.top_opportunities)}")
		print(f"Recommended: {len(results.recommended_opportunities)}")
		print(f"Average Score: {results.average_score:.2f}")
		
		for i, opp in enumerate(results.top_opportunities[:3]):
			print(f"\n#{i+1}: {opp.opportunity_id}")
			print(f"Score: {opp.overall_score:.2f}")
			print(f"Strengths: {', '.join(opp.strengths[:2])}")
		
	asyncio.run(main())