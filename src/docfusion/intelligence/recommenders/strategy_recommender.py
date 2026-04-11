"""
Strategy Recommender

This module provides intelligent go/no-go recommendations and resource allocation
strategies using multi-criteria decision analysis, ML predictions, and portfolio
optimization for competitive proposal development.
"""

import asyncio
import logging
logger = logging.getLogger(__name__)
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum

from pydantic import BaseModel, Field, ConfigDict
from uuid import uuid4

from ..predictors.win_probability_predictor import WinProbabilityPredictor, PredictionFeatures, PredictionResult
from ..predictors.scoring_predictor import ScoringPredictor, SectionFeatures, ProposalSection
from ...core.models.base import BaseEntity


class RecommendationType(str, Enum):
	"""Types of strategic recommendations"""
	
	GO = "go"
	NO_GO = "no_go"
	CONDITIONAL_GO = "conditional_go"
	PORTFOLIO_REBALANCE = "portfolio_rebalance"
	RESOURCE_OPTIMIZATION = "resource_optimization"


class StrategicPriority(str, Enum):
	"""Strategic priority levels"""
	
	CRITICAL = "critical"
	HIGH = "high"
	MEDIUM = "medium"
	LOW = "low"


class OpportunityContext(BaseModel):
	"""Context information for strategic decision making"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	opportunity_id: str = Field(description="Unique opportunity identifier")
	opportunity_value: float = Field(ge=0, description="Estimated opportunity value")
	submission_deadline: datetime = Field(description="Proposal submission deadline")
	
	# Strategic factors
	strategic_importance: float = Field(ge=0.0, le=1.0, description="Strategic importance to organization")
	market_expansion_potential: float = Field(ge=0.0, le=1.0, description="Potential for market expansion")
	relationship_building_value: float = Field(ge=0.0, le=1.0, description="Value for building client relationships")
	
	# Competitive context
	competitive_intensity: float = Field(ge=0.0, le=1.0, description="Level of competition expected")
	incumbent_advantage: bool = Field(description="Whether incumbent has significant advantage")
	
	# Resource requirements
	estimated_proposal_effort_hours: float = Field(ge=0, description="Estimated hours to develop proposal")
	required_team_size: int = Field(ge=0, description="Team size required for execution")
	specialized_skills_required: List[str] = Field(description="List of specialized skills needed")


class ResourceAllocation(BaseModel):
	"""Resource allocation recommendation"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	# Personnel allocation
	proposed_team_size: int = Field(ge=0, description="Recommended team size")
	key_personnel_assignments: Dict[str, str] = Field(description="Key role assignments")
	skill_requirements: List[str] = Field(description="Critical skills needed")
	
	# Time allocation
	proposal_development_hours: float = Field(ge=0, description="Hours for proposal development")
	proposal_timeline_weeks: float = Field(ge=0, description="Recommended timeline in weeks")
	critical_milestones: List[Tuple[str, datetime]] = Field(description="Key milestones and dates")
	
	# Budget allocation
	estimated_proposal_cost: float = Field(ge=0, description="Estimated cost to develop proposal")
	cost_benefit_ratio: float = Field(description="Expected cost/benefit ratio")
	
	# Risk considerations
	resource_risk_factors: List[str] = Field(description="Key resource-related risks")
	mitigation_strategies: List[str] = Field(description="Risk mitigation approaches")


class StrategicRecommendation(BaseModel):
	"""Strategic recommendation with detailed rationale"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	recommendation_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique recommendation identifier")
	opportunity_id: str = Field(description="Opportunity being evaluated")
	
	# Core recommendation
	recommendation_type: RecommendationType = Field(description="Type of recommendation")
	confidence_level: float = Field(ge=0.0, le=1.0, description="Confidence in recommendation")
	priority: StrategicPriority = Field(description="Strategic priority level")
	
	# Decision rationale
	key_factors_supporting: List[str] = Field(description="Factors supporting the recommendation")
	key_factors_against: List[str] = Field(description="Factors against the recommendation")
	primary_rationale: str = Field(description="Primary reasoning for recommendation")
	
	# Predictions and analysis
	win_probability: Optional[float] = Field(None, ge=0.0, le=1.0, description="Predicted win probability")
	expected_value: float = Field(description="Expected value calculation (probability × value)")
	strategic_value_score: float = Field(ge=0.0, le=1.0, description="Strategic value beyond monetary")
	
	# Resource recommendations
	resource_allocation: Optional[ResourceAllocation] = Field(None, description="Resource allocation if GO")
	alternative_opportunities: List[str] = Field(description="Alternative opportunities to consider")
	
	# Conditions and requirements
	success_conditions: List[str] = Field(description="Conditions required for success")
	decision_dependencies: List[str] = Field(description="Dependencies affecting decision")
	
	# Timeline
	decision_deadline: datetime = Field(description="When decision must be made")
	recommendation_timestamp: datetime = Field(default_factory=datetime.now)
	
	# Portfolio impact
	portfolio_impact: str = Field(description="Impact on overall opportunity portfolio")


class PortfolioAnalysis(BaseModel):
	"""Analysis of opportunity portfolio"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	# Portfolio composition
	total_opportunities: int = Field(ge=0, description="Total opportunities under consideration")
	total_estimated_value: float = Field(ge=0, description="Total value of all opportunities")
	
	# Resource utilization
	total_resource_demand: float = Field(ge=0, description="Total resource hours required")
	available_resources: float = Field(ge=0, description="Available resource capacity")
	resource_utilization_rate: float = Field(ge=0.0, le=2.0, description="Resource utilization rate")
	
	# Strategic balance
	strategic_distribution: Dict[str, int] = Field(description="Distribution by strategic importance")
	sector_diversification: Dict[str, float] = Field(description="Value distribution by sector")
	risk_profile: Dict[str, float] = Field(description="Portfolio risk characteristics")
	
	# Expected outcomes
	portfolio_expected_value: float = Field(ge=0, description="Expected value of entire portfolio")
	portfolio_win_rate: float = Field(ge=0.0, le=1.0, description="Expected portfolio win rate")
	
	# Recommendations
	optimization_opportunities: List[str] = Field(description="Opportunities to optimize portfolio")
	rebalancing_suggestions: List[str] = Field(description="Suggested portfolio rebalancing actions")


class StrategyRecommender:
	"""
	Intelligent strategy recommender for proposal decisions
	
	Provides go/no-go recommendations, resource allocation strategies,
	and portfolio optimization using ML predictions, multi-criteria
	analysis, and strategic business intelligence.
	"""
	
	def __init__(self, win_predictor: Optional[WinProbabilityPredictor] = None,
	             scoring_predictor: Optional[ScoringPredictor] = None):
		# ML predictors
		self.win_predictor = win_predictor
		self.scoring_predictor = scoring_predictor
		
		# Strategy parameters
		self.go_threshold = 0.4  # Minimum win probability for GO recommendation
		self.conditional_threshold = 0.25  # Threshold for conditional GO
		self.strategic_value_weight = 0.3  # Weight of strategic vs monetary value
		
		# Portfolio management
		self.max_resource_utilization = 0.9  # Maximum resource utilization
		self.portfolio_diversification_target = 0.7  # Target diversification score
		
		# Historical data
		self.recommendation_history: List[StrategicRecommendation] = []
		self.portfolio_analyses: List[PortfolioAnalysis] = []
		
		self._log_initialization()
	
	async def recommend_strategy(self, context: OpportunityContext,
	                             prediction_features: Optional[PredictionFeatures] = None,
	                             current_portfolio: Optional[List[OpportunityContext]] = None) -> StrategicRecommendation:
		"""
		Generate strategic recommendation for an opportunity
		
		Args:
			context: Opportunity context information
			prediction_features: Features for ML prediction (if available)
			current_portfolio: Current portfolio of opportunities
			
		Returns:
			Strategic recommendation with detailed analysis
		"""
		try:
			self._log_recommendation_start(context.opportunity_id)
			
			# Get ML predictions if available
			win_probability = None
			if self.win_predictor and prediction_features:
				win_result = await self.win_predictor.predict_win_probability(
					prediction_features, context.opportunity_id
				)
				win_probability = win_result.predicted_win_probability
			
			# Analyze portfolio impact
			portfolio_analysis = None
			if current_portfolio:
				portfolio_analysis = await self._analyze_portfolio_impact(context, current_portfolio)
			
			# Calculate expected value
			expected_value = self._calculate_expected_value(
				context.opportunity_value, win_probability, context.strategic_importance
			)
			
			# Calculate strategic value
			strategic_value = self._calculate_strategic_value(context)
			
			# Generate core recommendation
			recommendation_type = self._determine_recommendation_type(
				win_probability, expected_value, strategic_value, context, portfolio_analysis
			)
			
			# Develop supporting rationale
			supporting_factors, opposing_factors = self._analyze_decision_factors(
				context, win_probability, strategic_value, portfolio_analysis
			)
			
			# Generate resource allocation if GO recommendation
			resource_allocation = None
			if recommendation_type in [RecommendationType.GO, RecommendationType.CONDITIONAL_GO]:
				resource_allocation = self._generate_resource_allocation(context)
			
			# Determine success conditions and dependencies
			success_conditions = self._identify_success_conditions(
				context, recommendation_type, win_probability
			)
			decision_dependencies = self._identify_decision_dependencies(context, portfolio_analysis)
			
			# Calculate decision deadline
			decision_deadline = self._calculate_decision_deadline(context)
			
			# Generate recommendation
			recommendation = StrategicRecommendation(
				opportunity_id=context.opportunity_id,
				recommendation_type=recommendation_type,
				confidence_level=self._calculate_recommendation_confidence(
					win_probability, strategic_value, portfolio_analysis
				),
				priority=self._determine_priority(context, strategic_value, recommendation_type),
				key_factors_supporting=supporting_factors,
				key_factors_against=opposing_factors,
				primary_rationale=self._generate_primary_rationale(
					recommendation_type, win_probability, expected_value, strategic_value
				),
				win_probability=win_probability,
				expected_value=expected_value,
				strategic_value_score=strategic_value,
				resource_allocation=resource_allocation,
				alternative_opportunities=self._identify_alternatives(context, current_portfolio),
				success_conditions=success_conditions,
				decision_dependencies=decision_dependencies,
				decision_deadline=decision_deadline,
				portfolio_impact=self._assess_portfolio_impact(context, current_portfolio)
			)
			
			# Store recommendation history
			self.recommendation_history.append(recommendation)
			
			self._log_recommendation_complete(recommendation.opportunity_id, recommendation_type, recommendation.confidence_level)
			
			return recommendation
			
		except Exception as e:
			self._log_recommendation_error(f"Strategy recommendation failed for {context.opportunity_id}: {str(e)}")
			raise
	
	def _calculate_expected_value(self, opportunity_value: float, 
	                              win_probability: Optional[float],
	                              strategic_importance: float) -> float:
		"""Calculate expected value including strategic factors"""
		
		# Base expected value
		if win_probability is not None:
			monetary_expected_value = opportunity_value * win_probability
		else:
			# Use strategic importance as proxy if no win probability available
			monetary_expected_value = opportunity_value * strategic_importance
		
		# Add strategic premium
		strategic_premium = opportunity_value * strategic_importance * self.strategic_value_weight
		
		return monetary_expected_value + strategic_premium
	
	def _calculate_strategic_value(self, context: OpportunityContext) -> float:
		"""Calculate overall strategic value score"""
		
		strategic_factors = [
			context.strategic_importance,
			context.market_expansion_potential,
			context.relationship_building_value
		]
		
		# Weighted average with emphasis on strategic importance
		weights = [0.5, 0.3, 0.2]
		strategic_value = sum(factor * weight for factor, weight in zip(strategic_factors, weights))
		
		return strategic_value
	
	def _determine_recommendation_type(self, win_probability: Optional[float],
	                                   expected_value: float, strategic_value: float,
	                                   context: OpportunityContext,
	                                   portfolio_analysis: Optional[PortfolioAnalysis]) -> RecommendationType:
		"""Determine the type of recommendation to make"""
		
		# If we have win probability, use it as primary factor
		if win_probability is not None:
			if win_probability >= self.go_threshold:
				return RecommendationType.GO
			elif win_probability >= self.conditional_threshold:
				# Check if strategic value justifies conditional GO
				if strategic_value >= 0.7:
					return RecommendationType.CONDITIONAL_GO
				else:
					return RecommendationType.NO_GO
			else:
				return RecommendationType.NO_GO
		
		# Without win probability, use strategic analysis
		else:
			# High strategic value with reasonable competitive position
			if strategic_value >= 0.7 and context.competitive_intensity <= 0.6:
				return RecommendationType.GO
			elif strategic_value >= 0.5:
				return RecommendationType.CONDITIONAL_GO
			else:
				return RecommendationType.NO_GO
	
	def _analyze_decision_factors(self, context: OpportunityContext, 
	                              win_probability: Optional[float], 
	                              strategic_value: float,
	                              portfolio_analysis: Optional[PortfolioAnalysis]) -> Tuple[List[str], List[str]]:
		"""Analyze factors supporting and opposing the decision"""
		
		supporting_factors = []
		opposing_factors = []
		
		# Win probability factors
		if win_probability is not None:
			if win_probability >= 0.6:
				supporting_factors.append(f"High win probability ({win_probability:.1%})")
			elif win_probability <= 0.3:
				opposing_factors.append(f"Low win probability ({win_probability:.1%})")
		
		# Strategic factors
		if strategic_value >= 0.7:
			supporting_factors.append(f"High strategic value ({strategic_value:.2f})")
		elif strategic_value <= 0.4:
			opposing_factors.append(f"Low strategic value ({strategic_value:.2f})")
		
		# Market and competitive factors
		if context.market_expansion_potential >= 0.7:
			supporting_factors.append("Strong market expansion opportunity")
		
		if context.competitive_intensity <= 0.4:
			supporting_factors.append("Favorable competitive landscape")
		elif context.competitive_intensity >= 0.8:
			opposing_factors.append("Highly competitive environment")
		
		if context.incumbent_advantage:
			opposing_factors.append("Incumbent contractor advantage")
		
		# Resource factors
		if context.estimated_proposal_effort_hours <= 200:
			supporting_factors.append("Reasonable proposal development effort")
		elif context.estimated_proposal_effort_hours >= 500:
			opposing_factors.append("High proposal development effort required")
		
		# Timeline factors
		days_to_deadline = (context.submission_deadline - datetime.now()).days
		if days_to_deadline >= 60:
			supporting_factors.append("Adequate time for proposal development")
		elif days_to_deadline <= 21:
			opposing_factors.append("Limited time for quality proposal development")
		
		# Portfolio factors
		if portfolio_analysis:
			if portfolio_analysis.resource_utilization_rate >= 1.2:
				opposing_factors.append("Portfolio resource capacity constraints")
			elif portfolio_analysis.resource_utilization_rate <= 0.6:
				supporting_factors.append("Available portfolio capacity")
		
		return supporting_factors, opposing_factors
	
	def _generate_resource_allocation(self, context: OpportunityContext) -> ResourceAllocation:
		"""Generate resource allocation recommendation"""
		
		# Calculate team size based on opportunity size and complexity
		base_team_size = max(3, min(15, int(context.opportunity_value / 2000000) + 3))
		proposed_team_size = max(base_team_size, context.required_team_size)
		
		# Estimate timeline
		proposal_hours = context.estimated_proposal_effort_hours
		timeline_weeks = max(3, min(16, proposal_hours / (proposed_team_size * 30)))  # 30 hours/person/week
		
		# Generate milestones
		submission_date = context.submission_deadline
		milestones = [
			("Proposal kickoff", datetime.now() + timedelta(days=3)),
			("Technical approach complete", submission_date - timedelta(weeks=timeline_weeks*0.6)),
			("First draft complete", submission_date - timedelta(weeks=timeline_weeks*0.3)),
			("Final review complete", submission_date - timedelta(days=3)),
			("Submission deadline", submission_date)
		]
		
		# Estimate costs
		estimated_cost = proposal_hours * 150  # $150/hour average loaded rate
		cost_benefit_ratio = estimated_cost / context.opportunity_value
		
		# Identify key personnel assignments
		key_assignments = {
			"proposal_manager": "Experienced proposal development leader",
			"technical_lead": "Subject matter expert in required domain",
			"capture_manager": "Business development and client relationship owner"
		}
		
		# Risk factors and mitigation
		risk_factors = [
			"Key personnel availability conflicts",
			"Technical complexity underestimation",
			"Competitive pricing pressure"
		]
		
		mitigation_strategies = [
			"Identify backup personnel for critical roles",
			"Conduct early technical feasibility review",
			"Develop cost-effective solution approaches"
		]
		
		return ResourceAllocation(
			proposed_team_size=proposed_team_size,
			key_personnel_assignments=key_assignments,
			skill_requirements=context.specialized_skills_required,
			proposal_development_hours=proposal_hours,
			proposal_timeline_weeks=timeline_weeks,
			critical_milestones=milestones,
			estimated_proposal_cost=estimated_cost,
			cost_benefit_ratio=cost_benefit_ratio,
			resource_risk_factors=risk_factors,
			mitigation_strategies=mitigation_strategies
		)
	
	def _identify_success_conditions(self, context: OpportunityContext,
	                                 recommendation_type: RecommendationType,
	                                 win_probability: Optional[float]) -> List[str]:
		"""Identify conditions required for success"""
		
		conditions = []
		
		if recommendation_type in [RecommendationType.GO, RecommendationType.CONDITIONAL_GO]:
			# Basic success conditions
			conditions.append("Secure committed team with required expertise")
			conditions.append("Develop compliant and competitive technical solution")
			conditions.append("Complete proposal within timeline and budget")
			
			# Conditional factors
			if context.competitive_intensity >= 0.7:
				conditions.append("Develop strong differentiation strategy")
			
			if context.incumbent_advantage:
				conditions.append("Overcome incumbent advantage with superior value proposition")
			
			if win_probability is not None and win_probability <= 0.5:
				conditions.append("Address factors limiting win probability through proposal strategy")
			
			# Timeline conditions
			days_to_deadline = (context.submission_deadline - datetime.now()).days
			if days_to_deadline <= 30:
				conditions.append("Execute accelerated proposal development schedule")
		
		return conditions
	
	def _identify_decision_dependencies(self, context: OpportunityContext,
	                                    portfolio_analysis: Optional[PortfolioAnalysis]) -> List[str]:
		"""Identify dependencies affecting the decision"""
		
		dependencies = []
		
		# Resource dependencies
		if context.required_team_size >= 10:
			dependencies.append("Availability of required specialized personnel")
		
		if context.estimated_proposal_effort_hours >= 400:
			dependencies.append("Management approval for significant proposal investment")
		
		# Portfolio dependencies
		if portfolio_analysis and portfolio_analysis.resource_utilization_rate >= 1.0:
			dependencies.append("Resolution of portfolio resource conflicts")
		
		# Strategic dependencies
		if context.strategic_importance >= 0.8:
			dependencies.append("Alignment with current strategic business priorities")
		
		# Market dependencies
		if context.market_expansion_potential >= 0.7:
			dependencies.append("Market entry strategy approval and resources")
		
		return dependencies
	
	def _calculate_decision_deadline(self, context: OpportunityContext) -> datetime:
		"""Calculate when strategic decision must be made"""
		
		submission_deadline = context.submission_deadline
		
		# Need time for proposal development
		proposal_weeks = max(3, context.estimated_proposal_effort_hours / 120)  # 120 hours per week
		
		# Add buffer time
		buffer_days = 7
		
		decision_deadline = submission_deadline - timedelta(weeks=proposal_weeks, days=buffer_days)
		
		# Ensure decision deadline is not in the past
		earliest_decision = datetime.now() + timedelta(days=1)
		
		return max(decision_deadline, earliest_decision)
	
	def _calculate_recommendation_confidence(self, win_probability: Optional[float],
	                                         strategic_value: float,
	                                         portfolio_analysis: Optional[PortfolioAnalysis]) -> float:
		"""Calculate confidence level in recommendation"""
		
		confidence_factors = []
		
		# Win probability confidence
		if win_probability is not None:
			confidence_factors.append(min(win_probability * 2, 1.0))  # Higher win probability = higher confidence
		else:
			confidence_factors.append(0.6)  # Default confidence without prediction
		
		# Strategic value confidence
		confidence_factors.append(strategic_value)
		
		# Portfolio analysis confidence
		if portfolio_analysis:
			confidence_factors.append(0.8)  # Have portfolio context
		else:
			confidence_factors.append(0.6)  # Limited portfolio context
		
		# Calculate weighted average
		return sum(confidence_factors) / len(confidence_factors)
	
	def _determine_priority(self, context: OpportunityContext, strategic_value: float,
	                        recommendation_type: RecommendationType) -> StrategicPriority:
		"""Determine strategic priority level"""
		
		# Critical priorities
		if (strategic_value >= 0.8 and recommendation_type == RecommendationType.GO):
			return StrategicPriority.CRITICAL
		
		# High priorities
		if (strategic_value >= 0.6 and recommendation_type in [RecommendationType.GO, RecommendationType.CONDITIONAL_GO]):
			return StrategicPriority.HIGH
		
		# Medium priorities
		if strategic_value >= 0.4:
			return StrategicPriority.MEDIUM
		
		# Low priorities
		return StrategicPriority.LOW
	
	def _generate_primary_rationale(self, recommendation_type: RecommendationType,
	                                win_probability: Optional[float], expected_value: float,
	                                strategic_value: float) -> str:
		"""Generate primary rationale for recommendation"""
		
		if recommendation_type == RecommendationType.GO:
			if win_probability and win_probability >= 0.6:
				return f"High win probability ({win_probability:.1%}) with strong expected value (${expected_value:,.0f}) justifies full pursuit"
			else:
				return f"High strategic value ({strategic_value:.2f}) and favorable competitive position justify pursuit"
		
		elif recommendation_type == RecommendationType.CONDITIONAL_GO:
			return f"Moderate strategic opportunity that should be pursued if success conditions can be met"
		
		elif recommendation_type == RecommendationType.NO_GO:
			if win_probability and win_probability <= 0.3:
				return f"Low win probability ({win_probability:.1%}) does not justify proposal investment"
			else:
				return f"Limited strategic value ({strategic_value:.2f}) and challenging competitive dynamics recommend against pursuit"
		
		return "Strategic analysis indicates this approach based on current opportunity characteristics"
	
	async def _analyze_portfolio_impact(self, context: OpportunityContext,
	                                    current_portfolio: List[OpportunityContext]) -> PortfolioAnalysis:
		"""Analyze impact on current opportunity portfolio"""
		
		# Calculate portfolio metrics including new opportunity
		total_opportunities = len(current_portfolio) + 1
		total_value = sum(opp.opportunity_value for opp in current_portfolio) + context.opportunity_value
		
		# Resource analysis
		total_resource_demand = sum(opp.estimated_proposal_effort_hours for opp in current_portfolio) + context.estimated_proposal_effort_hours
		available_resources = 2000  # Assume 2000 hours available capacity per period
		utilization_rate = total_resource_demand / available_resources
		
		# Strategic distribution
		strategic_counts = {"high": 0, "medium": 0, "low": 0}
		for opp in current_portfolio:
			if opp.strategic_importance >= 0.7:
				strategic_counts["high"] += 1
			elif opp.strategic_importance >= 0.4:
				strategic_counts["medium"] += 1
			else:
				strategic_counts["low"] += 1
		
		# Add current opportunity
		if context.strategic_importance >= 0.7:
			strategic_counts["high"] += 1
		elif context.strategic_importance >= 0.4:
			strategic_counts["medium"] += 1
		else:
			strategic_counts["low"] += 1
		
		# Expected portfolio outcomes (simplified)
		portfolio_expected_value = total_value * 0.4  # Assume 40% overall win rate
		portfolio_win_rate = 0.4
		
		# Generate optimization recommendations
		optimization_opportunities = []
		if utilization_rate >= 1.2:
			optimization_opportunities.append("Reduce portfolio to optimize resource allocation")
		if strategic_counts["low"] >= strategic_counts["high"]:
			optimization_opportunities.append("Focus portfolio on higher strategic value opportunities")
		
		return PortfolioAnalysis(
			total_opportunities=total_opportunities,
			total_estimated_value=total_value,
			total_resource_demand=total_resource_demand,
			available_resources=available_resources,
			resource_utilization_rate=utilization_rate,
			strategic_distribution=strategic_counts,
			sector_diversification={"government": 0.6, "commercial": 0.4},  # Simplified
			risk_profile={"high_competition": 0.3, "moderate_competition": 0.5, "low_competition": 0.2},
			portfolio_expected_value=portfolio_expected_value,
			portfolio_win_rate=portfolio_win_rate,
			optimization_opportunities=optimization_opportunities,
			rebalancing_suggestions=["Consider strategic value vs resource trade-offs"]
		)
	
	def _identify_alternatives(self, context: OpportunityContext,
	                           current_portfolio: Optional[List[OpportunityContext]]) -> List[str]:
		"""Identify alternative opportunities to consider"""
		
		alternatives = []
		
		# Portfolio alternatives
		if current_portfolio:
			# Find similar value opportunities with better characteristics
			similar_opportunities = [
				opp for opp in current_portfolio
				if abs(opp.opportunity_value - context.opportunity_value) / context.opportunity_value <= 0.3
			]
			
			for opp in similar_opportunities[:3]:
				if opp.competitive_intensity < context.competitive_intensity:
					alternatives.append(f"Alternative opportunity {opp.opportunity_id} with lower competition")
		
		# Generic alternatives
		alternatives.extend([
			"Focus resources on higher-probability opportunities in current portfolio",
			"Invest in capability building for future opportunities",
			"Pursue strategic partnerships to improve competitive position"
		])
		
		return alternatives[:4]
	
	def _assess_portfolio_impact(self, context: OpportunityContext,
	                             current_portfolio: Optional[List[OpportunityContext]]) -> str:
		"""Assess impact on overall portfolio"""
		
		if not current_portfolio:
			return "Standalone opportunity - limited portfolio impact analysis available"
		
		# Calculate portfolio changes
		current_total_value = sum(opp.opportunity_value for opp in current_portfolio)
		value_increase = (context.opportunity_value / current_total_value) * 100
		
		current_resource_demand = sum(opp.estimated_proposal_effort_hours for opp in current_portfolio)
		resource_increase = (context.estimated_proposal_effort_hours / current_resource_demand) * 100
		
		impact_description = f"Increases portfolio value by {value_increase:.1f}% and resource demand by {resource_increase:.1f}%"
		
		# Add strategic impact
		high_strategic_count = sum(1 for opp in current_portfolio if opp.strategic_importance >= 0.7)
		if context.strategic_importance >= 0.7:
			impact_description += f". Adds to {high_strategic_count + 1} high-strategic-value opportunities"
		
		return impact_description
	
	def get_recommendation_statistics(self) -> Dict[str, Any]:
		"""Get statistics on recommendations made"""
		
		if not self.recommendation_history:
			return {"total_recommendations": 0}
		
		recommendations_by_type = {}
		for rec in self.recommendation_history:
			rec_type = rec.recommendation_type.value
			recommendations_by_type[rec_type] = recommendations_by_type.get(rec_type, 0) + 1
		
		avg_confidence = np.mean([r.confidence_level for r in self.recommendation_history])
		
		return {
			"total_recommendations": len(self.recommendation_history),
			"recommendations_by_type": recommendations_by_type,
			"average_confidence": avg_confidence,
			"go_rate": recommendations_by_type.get("go", 0) / len(self.recommendation_history),
			"conditional_go_rate": recommendations_by_type.get("conditional_go", 0) / len(self.recommendation_history),
			"no_go_rate": recommendations_by_type.get("no_go", 0) / len(self.recommendation_history)
		}
	
	# Logging methods
	
	def _log_initialization(self):
		logger.info(f"StrategyRecommender: Initialized for intelligent go/no-go and resource allocation recommendations")
	
	def _log_recommendation_start(self, opportunity_id: str):
		logger.info(f"StrategyRecommender: Generating strategic recommendation for {opportunity_id}")
	
	def _log_recommendation_complete(self, opportunity_id: str, recommendation_type: RecommendationType, confidence: float):
		logger.info(f"StrategyRecommender: Recommended {recommendation_type.value} for {opportunity_id} (confidence: {confidence:.3f})")
	
	def _log_recommendation_error(self, message: str):
		logger.error(f"StrategyRecommender Error: {message}")


# Example usage and testing
async def create_sample_strategy_recommendation():
	"""Create sample strategy recommendation for testing"""
	
	# Initialize recommender (without ML predictors for this example)
	recommender = StrategyRecommender()
	
	# Create sample opportunity context
	opportunity_context = OpportunityContext(
		opportunity_id="strategy_test_001",
		opportunity_value=5000000.0,
		submission_deadline=datetime.now() + timedelta(days=45),
		strategic_importance=0.8,
		market_expansion_potential=0.7,
		relationship_building_value=0.6,
		competitive_intensity=0.5,
		incumbent_advantage=False,
		estimated_proposal_effort_hours=350,
		required_team_size=8,
		specialized_skills_required=["cybersecurity", "cloud_architecture", "devops"]
	)
	
	# Create sample current portfolio
	current_portfolio = [
		OpportunityContext(
			opportunity_id="portfolio_001",
			opportunity_value=2000000.0,
			submission_deadline=datetime.now() + timedelta(days=30),
			strategic_importance=0.6,
			market_expansion_potential=0.5,
			relationship_building_value=0.4,
			competitive_intensity=0.6,
			incumbent_advantage=True,
			estimated_proposal_effort_hours=200,
			required_team_size=5,
			specialized_skills_required=["data_analytics"]
		),
		OpportunityContext(
			opportunity_id="portfolio_002",
			opportunity_value=3000000.0,
			submission_deadline=datetime.now() + timedelta(days=60),
			strategic_importance=0.9,
			market_expansion_potential=0.8,
			relationship_building_value=0.7,
			competitive_intensity=0.4,
			incumbent_advantage=False,
			estimated_proposal_effort_hours=400,
			required_team_size=10,
			specialized_skills_required=["ai_ml", "natural_language_processing"]
		)
	]
	
	# Generate recommendation
	recommendation = await recommender.recommend_strategy(
		opportunity_context, 
		current_portfolio=current_portfolio
	)
	
	return recommendation, recommender.get_recommendation_statistics()


if __name__ == "__main__":
	# Test the strategy recommender
	import asyncio
	
	async def main():
		recommendation, stats = await create_sample_strategy_recommendation()
		
		logger.info(f"Strategic Recommendation Results:")
		print("=" * 50)
		logger.info(f"Opportunity ID: {recommendation.opportunity_id}")
		logger.info(f"Recommendation: {recommendation.recommendation_type.value.upper()}")
		logger.info(f"Priority: {recommendation.priority.value}")
		logger.info(f"Confidence: {recommendation.confidence_level:.3f}")
		logger.info(f"Expected Value: ${recommendation.expected_value:,.0f}")
		logger.info(f"Strategic Value Score: {recommendation.strategic_value_score:.3f}")
		
		logger.info(f"\nPrimary Rationale:")
		logger.info(f"  {recommendation.primary_rationale}")
		
		logger.info(f"\nKey Supporting Factors:")
		for factor in recommendation.key_factors_supporting[:3]:
			logger.info(f"  ✅ {factor}")
		
		logger.info(f"\nKey Opposing Factors:")
		for factor in recommendation.key_factors_against[:3]:
			logger.info(f"  ⚠️ {factor}")
		
		if recommendation.resource_allocation:
			logger.info(f"\nResource Allocation:")
			logger.info(f"  Team Size: {recommendation.resource_allocation.proposed_team_size}")
			logger.info(f"  Timeline: {recommendation.resource_allocation.proposal_timeline_weeks:.1f} weeks")
			logger.info(f"  Estimated Cost: ${recommendation.resource_allocation.estimated_proposal_cost:,.0f}")
		
		logger.info(f"\nSuccess Conditions:")
		for condition in recommendation.success_conditions[:3]:
			logger.info(f"  📋 {condition}")
		
		logger.info(f"\nPortfolio Impact:")
		logger.info(f"  {recommendation.portfolio_impact}")
		
		logger.info(f"\nDecision Deadline: {recommendation.decision_deadline.strftime('%Y-%m-%d %H:%M')}")
	
	asyncio.run(main())