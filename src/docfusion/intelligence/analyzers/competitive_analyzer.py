"""
Competitive Analyzer Foundation

This module provides comprehensive competitive landscape analysis capabilities
to assess market positioning, competitor strengths/weaknesses, and strategic
recommendations for opportunity pursuit.
"""

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from uuid import uuid4

import numpy as np
from pydantic import BaseModel, Field, ConfigDict, field_validator
from pydantic.dataclasses import dataclass as pydantic_dataclass

from ...core.models.base import BaseEntity
# Optional NLP dependencies - gracefully handle missing modules
try:
    from ...nlp.services.text_analyzer import TextAnalyzer
    from ...nlp.services.semantic_matcher import SemanticMatcher
    NLP_AVAILABLE = True
except ImportError:
    TextAnalyzer = None
    SemanticMatcher = None
    NLP_AVAILABLE = False

# Canonical OpportunityData -- always available from discovery.models
from ...discovery.models.opportunity_models import OpportunityData

logger = logging.getLogger(__name__)


class CompetitorTier(Enum):
	"""Competitor tier classification"""
	TIER_1 = "tier_1"  # Major established players
	TIER_2 = "tier_2"  # Strong regional or specialized competitors
	TIER_3 = "tier_3"  # Emerging or niche competitors
	UNKNOWN = "unknown"  # Unclassified competitors


class CompetitiveAdvantage(Enum):
	"""Types of competitive advantages"""
	COST_ADVANTAGE = "cost_advantage"
	CAPABILITY_ADVANTAGE = "capability_advantage"
	RELATIONSHIP_ADVANTAGE = "relationship_advantage"
	INNOVATION_ADVANTAGE = "innovation_advantage"
	SCALE_ADVANTAGE = "scale_advantage"
	DOMAIN_EXPERTISE = "domain_expertise"
	INCUMBENT_ADVANTAGE = "incumbent_advantage"
	PARTNERSHIP_ADVANTAGE = "partnership_advantage"


class CompetitorProfile(BaseModel):
	"""Individual competitor profile"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	name: str = Field(description="Competitor organization name")
	tier: CompetitorTier = Field(description="Competitor tier classification")
	
	# Core characteristics
	estimated_revenue: Optional[float] = Field(None, description="Estimated annual revenue")
	employee_count: Optional[int] = Field(None, description="Approximate employee count")
	geographic_presence: List[str] = Field(default_factory=list, description="Geographic markets served")
	
	# Capabilities and strengths
	core_capabilities: Dict[str, float] = Field(default_factory=dict, description="Core capabilities with strength scores")
	competitive_advantages: List[CompetitiveAdvantage] = Field(description="Key competitive advantages")
	market_differentiators: List[str] = Field(default_factory=list, description="Unique market differentiators")
	
	# Market presence
	target_markets: List[str] = Field(default_factory=list, description="Primary target markets")
	client_base: List[str] = Field(default_factory=list, description="Notable clients")
	recent_wins: List[Dict[str, Any]] = Field(default_factory=list, description="Recent contract wins")
	
	# Performance indicators
	win_rate: Optional[float] = Field(None, ge=0.0, le=1.0, description="Historical win rate")
	average_contract_value: Optional[float] = Field(None, description="Average contract value")
	growth_trajectory: str = Field(default="stable", description="Growth trajectory (growing, stable, declining)")
	
	# Relationships and partnerships
	key_partnerships: List[str] = Field(default_factory=list, description="Strategic partnerships")
	certifications: List[str] = Field(default_factory=list, description="Relevant certifications")
	
	# Intelligence metadata
	intelligence_quality: float = Field(default=0.5, ge=0.0, le=1.0, description="Quality of intelligence data")
	last_updated: datetime = Field(default_factory=datetime.now, description="Last intelligence update")
	data_sources: List[str] = Field(default_factory=list, description="Sources of competitor data")


class CompetitivePositioning(BaseModel):
	"""Competitive positioning assessment"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	opportunity_id: str = Field(description="Opportunity identifier")
	
	# Overall competitive landscape
	total_competitors: int = Field(ge=0, description="Total number of identified competitors")
	tier_distribution: Dict[CompetitorTier, int] = Field(description="Distribution by competitor tier")
	
	# Competitive intensity
	competitive_intensity: float = Field(ge=0.0, le=1.0, description="Overall competitive intensity score")
	market_concentration: float = Field(ge=0.0, le=1.0, description="Market concentration level")
	
	# Our positioning
	our_rank: Optional[int] = Field(None, description="Estimated ranking among competitors")
	our_win_probability: float = Field(ge=0.0, le=1.0, description="Estimated win probability")
	
	# Key insights
	primary_threats: List[str] = Field(description="Primary competitive threats")
	competitive_gaps: List[str] = Field(description="Areas where we lag competitors")
	competitive_strengths: List[str] = Field(description="Areas where we outperform competitors")
	
	# Strategic recommendations
	positioning_strategy: str = Field(description="Recommended positioning strategy")
	key_differentiators: List[str] = Field(description="Recommended key differentiators")
	mitigation_strategies: List[str] = Field(description="Risk mitigation strategies")


class CompetitorComparison(BaseModel):
	"""Head-to-head competitor comparison"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	competitor_name: str = Field(description="Competitor being compared")
	
	# Capability comparison
	capability_gaps: Dict[str, float] = Field(description="Capability gaps (negative = we lag)")
	capability_advantages: Dict[str, float] = Field(description="Areas where we lead")
	
	# Market positioning comparison
	market_share_comparison: Optional[float] = Field(None, description="Relative market share")
	client_overlap: List[str] = Field(default_factory=list, description="Shared client relationships")
	
	# Performance comparison
	win_rate_comparison: Optional[float] = Field(None, description="Relative win rate performance")
	pricing_comparison: str = Field(description="Pricing position (higher, competitive, lower)")
	
	# Head-to-head history
	previous_competitions: int = Field(default=0, ge=0, description="Number of previous competitions")
	head_to_head_wins: int = Field(default=0, ge=0, description="Number of wins against this competitor")
	
	# Strategic assessment
	threat_level: str = Field(description="Threat level (high, medium, low)")
	competitive_response: List[str] = Field(description="Recommended responses to this competitor")


class MarketIntelligence(BaseModel):
	"""Market intelligence summary"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	market_segment: str = Field(description="Market segment being analyzed")
	
	# Market characteristics
	market_size: Optional[float] = Field(None, description="Total addressable market size")
	growth_rate: Optional[float] = Field(None, description="Market growth rate")
	key_trends: List[str] = Field(default_factory=list, description="Key market trends")
	
	# Competitive dynamics
	leading_players: List[str] = Field(description="Top 3-5 market leaders")
	emerging_players: List[str] = Field(default_factory=list, description="Emerging competitive threats")
	consolidation_activity: List[str] = Field(default_factory=list, description="Recent M&A activity")
	
	# Client preferences
	key_buying_criteria: List[str] = Field(description="Primary client buying criteria")
	decision_makers: List[str] = Field(default_factory=list, description="Typical decision maker profiles")
	procurement_preferences: List[str] = Field(default_factory=list, description="Preferred procurement approaches")
	
	# Market opportunities
	underserved_segments: List[str] = Field(default_factory=list, description="Underserved market segments")
	innovation_opportunities: List[str] = Field(default_factory=list, description="Innovation opportunities")
	partnership_opportunities: List[str] = Field(default_factory=list, description="Partnership opportunities")


class CompetitiveAnalysis(BaseModel):
	"""Complete competitive analysis result"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	opportunity_id: str = Field(description="Opportunity identifier")
	
	# Competitive landscape
	identified_competitors: List[CompetitorProfile] = Field(description="Identified competitor profiles")
	competitive_positioning: CompetitivePositioning = Field(description="Overall positioning assessment")
	competitor_comparisons: List[CompetitorComparison] = Field(description="Individual competitor comparisons")
	
	# Market context
	market_intelligence: MarketIntelligence = Field(description="Market intelligence summary")
	
	# Strategic insights
	competitive_strategy: str = Field(description="Recommended competitive strategy")
	win_themes: List[str] = Field(description="Recommended win themes")
	risk_mitigation: List[str] = Field(description="Competitive risk mitigation strategies")
	
	# Action items
	intelligence_gaps: List[str] = Field(description="Key intelligence gaps to address")
	monitoring_priorities: List[str] = Field(description="Ongoing competitive monitoring priorities")
	
	# Analysis metadata
	analysis_confidence: float = Field(ge=0.0, le=1.0, description="Overall analysis confidence")
	analysis_timestamp: datetime = Field(default_factory=datetime.now)
	analysis_version: str = Field(default="1.0")


@pydantic_dataclass
class CompetitiveIntelligenceDatabase:
	"""Competitive intelligence database"""
	
	competitor_profiles: Dict[str, CompetitorProfile] = field(default_factory=dict)
	market_segments: Dict[str, MarketIntelligence] = field(default_factory=dict)
	win_loss_history: List[Dict[str, Any]] = field(default_factory=list)
	competitive_relationships: Dict[str, List[str]] = field(default_factory=dict)
	intelligence_sources: List[str] = field(default_factory=list)


class CompetitiveAnalyzer:
	"""
	Advanced competitive analysis engine
	
	Provides comprehensive competitive landscape analysis including
	competitor identification, market positioning assessment, and
	strategic recommendations for opportunity pursuit.
	"""
	
	def __init__(self, 
	             text_analyzer: Optional[TextAnalyzer] = None,
	             semantic_matcher: Optional[SemanticMatcher] = None,
	             intelligence_db: Optional[CompetitiveIntelligenceDatabase] = None):
		self.text_analyzer = text_analyzer or TextAnalyzer()
		self.semantic_matcher = semantic_matcher or SemanticMatcher()
		self.intelligence_db = intelligence_db or self._initialize_intelligence_db()
		
		# Analysis patterns
		self._competitor_patterns = self._initialize_competitor_patterns()
		self._capability_patterns = self._initialize_capability_patterns()
		self._market_patterns = self._initialize_market_patterns()
		
		# Scoring models
		self._threat_assessment_weights = {
			'market_share': 0.25,
			'capability_overlap': 0.20,
			'win_rate': 0.20,
			'client_relationships': 0.15,
			'pricing_competitiveness': 0.10,
			'innovation_capability': 0.10
		}
	
	def _initialize_intelligence_db(self) -> CompetitiveIntelligenceDatabase:
		"""Initialize competitive intelligence database with sample data"""
		
		# Sample competitor profiles
		competitors = {
			'acme_consulting': CompetitorProfile(
				name='ACME Consulting',
				tier=CompetitorTier.TIER_1,
				estimated_revenue=500000000.0,
				employee_count=2500,
				core_capabilities={
					'software_development': 0.9,
					'project_management': 0.8,
					'cybersecurity': 0.7,
					'data_analytics': 0.6
				},
				competitive_advantages=[
					CompetitiveAdvantage.SCALE_ADVANTAGE,
					CompetitiveAdvantage.INCUMBENT_ADVANTAGE
				],
				win_rate=0.35,
				growth_trajectory='growing'
			),
			'specialized_tech': CompetitorProfile(
				name='Specialized Tech Solutions',
				tier=CompetitorTier.TIER_2,
				estimated_revenue=50000000.0,
				employee_count=300,
				core_capabilities={
					'software_development': 0.95,
					'innovation': 0.9,
					'emerging_tech': 0.8
				},
				competitive_advantages=[
					CompetitiveAdvantage.INNOVATION_ADVANTAGE,
					CompetitiveAdvantage.CAPABILITY_ADVANTAGE
				],
				win_rate=0.45,
				growth_trajectory='growing'
			)
		}
		
		# Sample market intelligence
		markets = {
			'federal_technology': MarketIntelligence(
				market_segment='Federal Technology Services',
				market_size=25000000000.0,
				growth_rate=0.08,
				leading_players=['ACME Consulting', 'Big Tech Corp', 'Federal Solutions Inc'],
				key_buying_criteria=['Security clearance', 'Past performance', 'Technical capability', 'Cost'],
				key_trends=['Cloud migration', 'AI/ML adoption', 'Zero trust security']
			)
		}
		
		return CompetitiveIntelligenceDatabase(
			competitor_profiles=competitors,
			market_segments=markets
		)
	
	def _initialize_competitor_patterns(self) -> Dict[str, List[str]]:
		"""Initialize competitor identification patterns"""
		return {
			'incumbent_indicators': [
				r'incumbent\s+contractor',
				r'current\s+provider',
				r'existing\s+vendor',
				r'prime\s+contractor'
			],
			'past_performance': [
				r'similar\s+contracts',
				r'relevant\s+experience',
				r'comparable\s+projects',
				r'track\s+record'
			],
			'capability_indicators': [
				r'technical\s+expertise',
				r'specialized\s+knowledge',
				r'domain\s+experience',
				r'proven\s+capability'
			]
		}
	
	def _initialize_capability_patterns(self) -> Dict[str, List[str]]:
		"""Initialize capability assessment patterns"""
		return {
			'technical_capabilities': [
				r'software\s+development',
				r'system\s+integration',
				r'data\s+analytics',
				r'cybersecurity',
				r'cloud\s+services'
			],
			'domain_expertise': [
				r'healthcare\s+expertise',
				r'financial\s+services',
				r'government\s+contracting',
				r'regulatory\s+compliance'
			],
			'scale_indicators': [
				r'enterprise\s+scale',
				r'large\s+team',
				r'global\s+presence',
				r'Fortune\s+\d+'
			]
		}
	
	def _initialize_market_patterns(self) -> Dict[str, List[str]]:
		"""Initialize market analysis patterns"""
		return {
			'market_trends': [
				r'digital\s+transformation',
				r'cloud\s+migration',
				r'artificial\s+intelligence',
				r'machine\s+learning',
				r'automation'
			],
			'buying_criteria': [
				r'cost\s+effectiveness',
				r'technical\s+capability',
				r'past\s+performance',
				r'security\s+clearance',
				r'innovation'
			]
		}
	
	async def analyze_competition(self, 
	                              opportunity_data: OpportunityData,
	                              organizational_profile: Dict[str, Any],
	                              market_context: Optional[Dict[str, Any]] = None) -> CompetitiveAnalysis:
		"""
		Perform comprehensive competitive analysis
		
		Args:
			opportunity_data: Opportunity details and requirements
			organizational_profile: Our organizational capabilities and profile
			market_context: Additional market context and intelligence
			
		Returns:
			Complete competitive analysis with insights and recommendations
		"""
		try:
			# Identify likely competitors
			competitors = await self._identify_competitors(opportunity_data, market_context)
			
			# Assess competitive positioning
			positioning = await self._assess_competitive_positioning(
				opportunity_data, competitors, organizational_profile
			)
			
			# Perform head-to-head comparisons
			comparisons = await self._perform_competitor_comparisons(
				competitors, organizational_profile, opportunity_data
			)
			
			# Gather market intelligence
			market_intel = await self._gather_market_intelligence(
				opportunity_data, market_context
			)
			
			# Generate strategic insights
			strategy = self._generate_competitive_strategy(
				positioning, comparisons, market_intel, organizational_profile
			)
			
			# Identify win themes
			win_themes = self._identify_win_themes(
				positioning, comparisons, organizational_profile
			)
			
			# Develop risk mitigation strategies
			risk_mitigation = self._develop_risk_mitigation(
				positioning, comparisons
			)
			
			# Identify intelligence gaps
			intelligence_gaps = self._identify_intelligence_gaps(
				competitors, market_intel
			)
			
			# Set monitoring priorities
			monitoring_priorities = self._set_monitoring_priorities(
				competitors, positioning
			)
			
			# Calculate analysis confidence
			confidence = self._calculate_analysis_confidence(
				competitors, market_intel, positioning
			)
			
			return CompetitiveAnalysis(
				opportunity_id=opportunity_data.id,
				identified_competitors=competitors,
				competitive_positioning=positioning,
				competitor_comparisons=comparisons,
				market_intelligence=market_intel,
				competitive_strategy=strategy,
				win_themes=win_themes,
				risk_mitigation=risk_mitigation,
				intelligence_gaps=intelligence_gaps,
				monitoring_priorities=monitoring_priorities,
				analysis_confidence=confidence
			)
			
		except Exception as e:
			self._log_analysis_error(f"Competitive analysis failed: {str(e)}")
			raise
	
	async def _identify_competitors(self, 
	                                opportunity_data: OpportunityData,
	                                market_context: Optional[Dict[str, Any]]) -> List[CompetitorProfile]:
		"""Identify likely competitors for the opportunity"""
		
		identified_competitors = []
		
		# Start with known competitors from intelligence database
		relevant_competitors = []
		
		# Find competitors by market segment
		if hasattr(opportunity_data, 'industry') and opportunity_data.industry:
			industry = opportunity_data.industry.lower()
			for competitor in self.intelligence_db.competitor_profiles.values():
				if any(industry in market.lower() for market in competitor.target_markets):
					relevant_competitors.append(competitor)
		
		# Find competitors by capability requirements
		if hasattr(opportunity_data, 'requirements') and opportunity_data.requirements:
			req_text = opportunity_data.requirements.lower()
			for competitor in self.intelligence_db.competitor_profiles.values():
				capability_match = any(
					capability in req_text 
					for capability in competitor.core_capabilities.keys()
				)
				if capability_match:
					relevant_competitors.append(competitor)
		
		# Extract competitor mentions from opportunity text
		opportunity_text = ' '.join([
			opportunity_data.description or '',
			opportunity_data.requirements or '',
			opportunity_data.scope_of_work or ''
		])
		
		# Look for incumbent contractor mentions
		for pattern in self._competitor_patterns['incumbent_indicators']:
			matches = re.findall(pattern, opportunity_text, re.IGNORECASE)
			if matches:
				# Create placeholder competitor profile for incumbent
				incumbent = CompetitorProfile(
					name='Incumbent Contractor',
					tier=CompetitorTier.TIER_1,
					competitive_advantages=[CompetitiveAdvantage.INCUMBENT_ADVANTAGE],
					intelligence_quality=0.3  # Low quality since inferred
				)
				relevant_competitors.append(incumbent)
				break
		
		# Add market context competitors
		if market_context and 'known_competitors' in market_context:
			for competitor_name in market_context['known_competitors']:
				if competitor_name in self.intelligence_db.competitor_profiles:
					relevant_competitors.append(
						self.intelligence_db.competitor_profiles[competitor_name]
					)
		
		# Remove duplicates and limit to top competitors
		seen_names = set()
		for competitor in relevant_competitors:
			if competitor.name not in seen_names:
				identified_competitors.append(competitor)
				seen_names.add(competitor.name)
		
		# If no specific competitors identified, add generic market leaders
		if not identified_competitors:
			# Add top tier competitors from relevant market segments
			for market_intel in self.intelligence_db.market_segments.values():
				for leader in market_intel.leading_players[:3]:
					if leader in self.intelligence_db.competitor_profiles:
						identified_competitors.append(
							self.intelligence_db.competitor_profiles[leader]
						)
		
		return identified_competitors[:8]  # Limit to top 8 competitors
	
	async def _assess_competitive_positioning(self,
	                                          opportunity_data: OpportunityData,
	                                          competitors: List[CompetitorProfile],
	                                          organizational_profile: Dict[str, Any]) -> CompetitivePositioning:
		"""Assess overall competitive positioning"""
		
		# Calculate tier distribution
		tier_distribution = {}
		for tier in CompetitorTier:
			tier_distribution[tier] = sum(1 for c in competitors if c.tier == tier)
		
		# Calculate competitive intensity
		intensity_factors = []
		
		# Number of tier 1 competitors
		tier1_count = tier_distribution.get(CompetitorTier.TIER_1, 0)
		intensity_factors.append(min(tier1_count / 3.0, 1.0))
		
		# Average win rates
		win_rates = [c.win_rate for c in competitors if c.win_rate is not None]
		if win_rates:
			avg_win_rate = np.mean(win_rates)
			intensity_factors.append(avg_win_rate)
		
		# Market concentration (simplified)
		if len(competitors) > 0:
			concentration = min(len(competitors) / 10.0, 1.0)  # More competitors = higher intensity
			intensity_factors.append(concentration)
		
		competitive_intensity = np.mean(intensity_factors) if intensity_factors else 0.5
		
		# Estimate our ranking
		our_rank = self._estimate_our_ranking(competitors, organizational_profile)
		
		# Calculate our win probability
		our_win_probability = self._calculate_win_probability(
			competitors, organizational_profile, competitive_intensity
		)
		
		# Identify primary threats
		primary_threats = []
		for competitor in competitors:
			if competitor.tier in [CompetitorTier.TIER_1, CompetitorTier.TIER_2]:
				threat_level = self._assess_competitor_threat(competitor, organizational_profile)
				if threat_level >= 0.7:
					primary_threats.append(f"{competitor.name} - {', '.join([adv.value for adv in competitor.competitive_advantages[:2]])}")
		
		# Identify competitive gaps and strengths
		competitive_gaps = self._identify_competitive_gaps(competitors, organizational_profile)
		competitive_strengths = self._identify_competitive_strengths(competitors, organizational_profile)
		
		# Generate positioning strategy
		if our_rank and our_rank <= 3:
			positioning_strategy = "Market leader positioning - emphasize scale and track record"
		elif competitive_intensity > 0.7:
			positioning_strategy = "Differentiation strategy - focus on unique value propositions"
		else:
			positioning_strategy = "Value positioning - balance capability and cost-effectiveness"
		
		# Key differentiators
		key_differentiators = self._identify_key_differentiators(organizational_profile, competitors)
		
		# Mitigation strategies
		mitigation_strategies = [
			"Monitor competitor activities and pricing strategies",
			"Strengthen relationships with key decision makers",
			"Develop compelling win themes based on unique strengths"
		]
		
		return CompetitivePositioning(
			opportunity_id=opportunity_data.id,
			total_competitors=len(competitors),
			tier_distribution=tier_distribution,
			competitive_intensity=competitive_intensity,
			market_concentration=min(len(competitors) / 5.0, 1.0),  # Simplified calculation
			our_rank=our_rank,
			our_win_probability=our_win_probability,
			primary_threats=primary_threats,
			competitive_gaps=competitive_gaps,
			competitive_strengths=competitive_strengths,
			positioning_strategy=positioning_strategy,
			key_differentiators=key_differentiators,
			mitigation_strategies=mitigation_strategies
		)
	
	async def _perform_competitor_comparisons(self,
	                                          competitors: List[CompetitorProfile],
	                                          organizational_profile: Dict[str, Any],
	                                          opportunity_data: OpportunityData) -> List[CompetitorComparison]:
		"""Perform head-to-head competitor comparisons"""
		
		comparisons = []
		our_capabilities = organizational_profile.get('capabilities', {})
		
		for competitor in competitors:
			# Calculate capability gaps
			capability_gaps = {}
			capability_advantages = {}
			
			for capability, competitor_strength in competitor.core_capabilities.items():
				our_strength = our_capabilities.get(capability, 0.5)
				gap = competitor_strength - our_strength
				
				if gap > 0.1:
					capability_gaps[capability] = gap
				elif gap < -0.1:
					capability_advantages[capability] = abs(gap)
			
			# Assess threat level
			threat_score = self._assess_competitor_threat(competitor, organizational_profile)
			if threat_score >= 0.7:
				threat_level = "high"
			elif threat_score >= 0.4:
				threat_level = "medium"
			else:
				threat_level = "low"
			
			# Generate competitive responses
			competitive_response = []
			
			if capability_gaps:
				competitive_response.append("Address capability gaps through training or partnerships")
			
			if competitor.tier == CompetitorTier.TIER_1:
				competitive_response.append("Emphasize agility and innovation advantages")
			
			if CompetitiveAdvantage.COST_ADVANTAGE in competitor.competitive_advantages:
				competitive_response.append("Focus on value differentiation beyond price")
			
			# Historical performance (simplified)
			previous_competitions = 0
			head_to_head_wins = 0
			
			# Pricing comparison (simplified heuristic)
			if competitor.tier == CompetitorTier.TIER_1:
				pricing_comparison = "higher"
			elif competitor.tier == CompetitorTier.TIER_3:
				pricing_comparison = "lower"
			else:
				pricing_comparison = "competitive"
			
			comparisons.append(CompetitorComparison(
				competitor_name=competitor.name,
				capability_gaps=capability_gaps,
				capability_advantages=capability_advantages,
				pricing_comparison=pricing_comparison,
				previous_competitions=previous_competitions,
				head_to_head_wins=head_to_head_wins,
				threat_level=threat_level,
				competitive_response=competitive_response
			))
		
		return comparisons
	
	async def _gather_market_intelligence(self,
	                                      opportunity_data: OpportunityData,
	                                      market_context: Optional[Dict[str, Any]]) -> MarketIntelligence:
		"""Gather and synthesize market intelligence"""
		
		# Determine market segment
		market_segment = "General Technology Services"  # Default
		
		if hasattr(opportunity_data, 'industry') and opportunity_data.industry:
			market_segment = f"{opportunity_data.industry} Technology Services"
		
		# Check if we have existing market intelligence
		if market_segment in self.intelligence_db.market_segments:
			return self.intelligence_db.market_segments[market_segment]
		
		# Generate market intelligence based on opportunity and context
		key_trends = []
		key_buying_criteria = []
		
		# Extract trends from opportunity description
		opportunity_text = ' '.join([
			opportunity_data.description or '',
			opportunity_data.requirements or ''
		])
		
		for trend_pattern in self._market_patterns['market_trends']:
			if re.search(trend_pattern, opportunity_text, re.IGNORECASE):
				trend_name = trend_pattern.replace(r'\s+', ' ').replace('\\', '')
				key_trends.append(trend_name)
		
		# Extract buying criteria
		for criteria_pattern in self._market_patterns['buying_criteria']:
			if re.search(criteria_pattern, opportunity_text, re.IGNORECASE):
				criteria_name = criteria_pattern.replace(r'\s+', ' ').replace('\\', '')
				key_buying_criteria.append(criteria_name)
		
		# Default market intelligence
		if not key_trends:
			key_trends = ['Digital transformation', 'Cloud adoption', 'Security enhancement']
		
		if not key_buying_criteria:
			key_buying_criteria = ['Technical capability', 'Past performance', 'Cost effectiveness', 'Timeline']
		
		# Leading players from our competitor database
		leading_players = [c.name for c in list(self.intelligence_db.competitor_profiles.values())[:5]]
		
		return MarketIntelligence(
			market_segment=market_segment,
			market_size=opportunity_data.estimated_value * 10 if opportunity_data.estimated_value else None,  # Rough estimate
			growth_rate=0.05,  # Default 5% growth
			leading_players=leading_players,
			key_buying_criteria=key_buying_criteria,
			key_trends=key_trends
		)
	
	def _estimate_our_ranking(self, competitors: List[CompetitorProfile], 
	                          organizational_profile: Dict[str, Any]) -> Optional[int]:
		"""Estimate our ranking among competitors"""
		
		# Score each competitor and ourselves
		competitor_scores = []
		
		for competitor in competitors:
			score = self._calculate_competitor_score(competitor)
			competitor_scores.append((competitor.name, score))
		
		# Calculate our score
		our_score = self._calculate_our_score(organizational_profile)
		competitor_scores.append(("Our Organization", our_score))
		
		# Sort by score descending
		ranked_competitors = sorted(competitor_scores, key=lambda x: x[1], reverse=True)
		
		# Find our ranking
		for rank, (name, score) in enumerate(ranked_competitors, 1):
			if name == "Our Organization":
				return rank
		
		return None
	
	def _calculate_competitor_score(self, competitor: CompetitorProfile) -> float:
		"""Calculate overall competitor strength score"""
		
		score_components = []
		
		# Tier-based base score
		tier_scores = {
			CompetitorTier.TIER_1: 0.8,
			CompetitorTier.TIER_2: 0.6,
			CompetitorTier.TIER_3: 0.4,
			CompetitorTier.UNKNOWN: 0.3
		}
		score_components.append(tier_scores[competitor.tier])
		
		# Win rate component
		if competitor.win_rate:
			score_components.append(competitor.win_rate)
		
		# Capability strength
		if competitor.core_capabilities:
			avg_capability = np.mean(list(competitor.core_capabilities.values()))
			score_components.append(avg_capability)
		
		# Competitive advantages
		advantage_bonus = len(competitor.competitive_advantages) * 0.1
		base_score = np.mean(score_components) if score_components else 0.5
		
		return min(base_score + advantage_bonus, 1.0)
	
	def _calculate_our_score(self, organizational_profile: Dict[str, Any]) -> float:
		"""Calculate our organizational strength score"""
		
		score_components = []
		
		# Capability assessment
		capabilities = organizational_profile.get('capabilities', {})
		if capabilities:
			avg_capability = np.mean(list(capabilities.values()))
			score_components.append(avg_capability)
		
		# Experience factor
		experience_years = organizational_profile.get('years_in_business', 5)
		experience_score = min(experience_years / 20.0, 0.9)  # Cap at 0.9
		score_components.append(experience_score)
		
		# Size/scale factor (if available)
		employee_count = organizational_profile.get('employee_count', 100)
		scale_score = min(employee_count / 1000.0, 0.8)  # Cap at 0.8
		score_components.append(scale_score)
		
		return np.mean(score_components) if score_components else 0.6  # Slightly above average default
	
	def _calculate_win_probability(self, competitors: List[CompetitorProfile],
	                               organizational_profile: Dict[str, Any],
	                               competitive_intensity: float) -> float:
		"""Calculate estimated win probability"""
		
		# Base probability adjusted for competitive intensity
		base_probability = 0.5 * (1 - competitive_intensity * 0.3)
		
		# Adjustment factors
		adjustments = []
		
		# Our relative strength
		our_score = self._calculate_our_score(organizational_profile)
		if competitors:
			competitor_scores = [self._calculate_competitor_score(c) for c in competitors]
			avg_competitor_score = np.mean(competitor_scores)
			relative_strength = our_score - avg_competitor_score
			adjustments.append(relative_strength * 0.3)
		
		# Number of competitors factor
		competitor_penalty = min(len(competitors) * 0.05, 0.2)
		adjustments.append(-competitor_penalty)
		
		# Apply adjustments
		final_probability = base_probability + sum(adjustments)
		
		return max(0.1, min(final_probability, 0.9))  # Bound between 10% and 90%
	
	def _assess_competitor_threat(self, competitor: CompetitorProfile,
	                              organizational_profile: Dict[str, Any]) -> float:
		"""Assess individual competitor threat level"""
		
		threat_factors = []
		
		# Tier-based threat
		tier_threats = {
			CompetitorTier.TIER_1: 0.8,
			CompetitorTier.TIER_2: 0.6,
			CompetitorTier.TIER_3: 0.3,
			CompetitorTier.UNKNOWN: 0.2
		}
		threat_factors.append(tier_threats[competitor.tier])
		
		# Win rate threat
		if competitor.win_rate:
			threat_factors.append(competitor.win_rate)
		
		# Capability overlap threat
		our_capabilities = organizational_profile.get('capabilities', {})
		capability_overlap = 0.0
		
		if our_capabilities and competitor.core_capabilities:
			overlapping_capabilities = set(our_capabilities.keys()) & set(competitor.core_capabilities.keys())
			if overlapping_capabilities:
				overlap_scores = [
					min(our_capabilities[cap], competitor.core_capabilities[cap])
					for cap in overlapping_capabilities
				]
				capability_overlap = np.mean(overlap_scores)
		
		threat_factors.append(capability_overlap)
		
		# Competitive advantage threats
		high_threat_advantages = [
			CompetitiveAdvantage.INCUMBENT_ADVANTAGE,
			CompetitiveAdvantage.SCALE_ADVANTAGE,
			CompetitiveAdvantage.RELATIONSHIP_ADVANTAGE
		]
		
		advantage_threat = sum(
			0.2 for advantage in competitor.competitive_advantages
			if advantage in high_threat_advantages
		)
		
		base_threat = np.mean(threat_factors) if threat_factors else 0.5
		return min(base_threat + advantage_threat, 1.0)
	
	def _identify_competitive_gaps(self, competitors: List[CompetitorProfile],
	                               organizational_profile: Dict[str, Any]) -> List[str]:
		"""Identify areas where we lag behind competitors"""
		
		gaps = []
		our_capabilities = organizational_profile.get('capabilities', {})
		
		# Capability gaps
		competitor_capabilities = {}
		for competitor in competitors:
			for capability, strength in competitor.core_capabilities.items():
				if capability not in competitor_capabilities:
					competitor_capabilities[capability] = []
				competitor_capabilities[capability].append(strength)
		
		# Find where competitors significantly outperform us
		for capability, competitor_strengths in competitor_capabilities.items():
			max_competitor_strength = max(competitor_strengths)
			our_strength = our_capabilities.get(capability, 0.0)
			
			if max_competitor_strength - our_strength > 0.3:  # Significant gap
				gaps.append(f"{capability.title()} capability gap")
		
		# Scale/size gaps
		large_competitors = [c for c in competitors if c.tier == CompetitorTier.TIER_1]
		if large_competitors:
			our_size = organizational_profile.get('employee_count', 100)
			if our_size < 500:  # If we're relatively small
				gaps.append("Scale and resource disadvantage")
		
		# Market presence gaps
		established_competitors = [
			c for c in competitors 
			if CompetitiveAdvantage.INCUMBENT_ADVANTAGE in c.competitive_advantages
		]
		if established_competitors:
			gaps.append("Market presence and relationships")
		
		return gaps[:5]  # Top 5 gaps
	
	def _identify_competitive_strengths(self, competitors: List[CompetitorProfile],
	                                    organizational_profile: Dict[str, Any]) -> List[str]:
		"""Identify areas where we outperform competitors"""
		
		strengths = []
		our_capabilities = organizational_profile.get('capabilities', {})
		
		# Capability advantages
		if our_capabilities:
			for our_capability, our_strength in our_capabilities.items():
				if our_strength >= 0.8:  # High proficiency
					# Check if competitors are weaker in this area
					competitor_strengths = []
					for competitor in competitors:
						comp_strength = competitor.core_capabilities.get(our_capability, 0.0)
						competitor_strengths.append(comp_strength)
					
					if competitor_strengths:
						avg_competitor_strength = np.mean(competitor_strengths)
						if our_strength > avg_competitor_strength + 0.2:
							strengths.append(f"Superior {our_capability.title()} capabilities")
		
		# Innovation advantage (if we're smaller/more agile)
		our_size = organizational_profile.get('employee_count', 100)
		if our_size < 1000:  # Relatively small
			large_competitors = [c for c in competitors if c.employee_count and c.employee_count > 2000]
			if large_competitors:
				strengths.append("Agility and innovation advantage")
		
		# Specialization advantage
		if len(our_capabilities) <= 5:  # Focused capability set
			strengths.append("Specialized domain expertise")
		
		# Cost competitiveness (if applicable)
		if our_size < 500:  # Smaller organizations often more cost-competitive
			strengths.append("Cost-effective delivery model")
		
		return strengths[:5]  # Top 5 strengths
	
	def _identify_key_differentiators(self, organizational_profile: Dict[str, Any],
	                                  competitors: List[CompetitorProfile]) -> List[str]:
		"""Identify key differentiators for positioning"""
		
		differentiators = []
		
		# Unique capabilities
		our_capabilities = set(organizational_profile.get('capabilities', {}).keys())
		competitor_capabilities = set()
		
		for competitor in competitors:
			competitor_capabilities.update(competitor.core_capabilities.keys())
		
		unique_capabilities = our_capabilities - competitor_capabilities
		for capability in unique_capabilities:
			differentiators.append(f"Unique {capability.title()} expertise")
		
		# Innovation and emerging technology
		if 'innovation' in organizational_profile.get('capabilities', {}):
			if organizational_profile['capabilities']['innovation'] >= 0.8:
				differentiators.append("Leading-edge innovation capabilities")
		
		# Agility and responsiveness
		our_size = organizational_profile.get('employee_count', 100)
		if our_size < 500:
			differentiators.append("Rapid response and deployment agility")
		
		# Quality and precision
		if 'quality_assurance' in organizational_profile.get('capabilities', {}):
			differentiators.append("Rigorous quality assurance processes")
		
		# Client-focused approach
		differentiators.append("Personalized client engagement model")
		
		return differentiators[:4]  # Top 4 differentiators
	
	def _generate_competitive_strategy(self, positioning: CompetitivePositioning,
	                                   comparisons: List[CompetitorComparison],
	                                   market_intel: MarketIntelligence,
	                                   organizational_profile: Dict[str, Any]) -> str:
		"""Generate comprehensive competitive strategy"""
		
		# Base strategy on competitive intensity and our position
		if positioning.competitive_intensity > 0.7:
			if positioning.our_rank and positioning.our_rank <= 3:
				return "Defend market position with premium value proposition and thought leadership"
			else:
				return "Niche differentiation strategy focusing on specialized capabilities and client intimacy"
		
		elif positioning.competitive_intensity > 0.4:
			if positioning.our_win_probability > 0.6:
				return "Balanced growth strategy leveraging competitive advantages while building market presence"
			else:
				return "Strategic partnership approach to complement capabilities and compete effectively"
		
		else:
			return "Market development strategy with aggressive positioning and capability expansion"
	
	def _identify_win_themes(self, positioning: CompetitivePositioning,
	                         comparisons: List[CompetitorComparison],
	                         organizational_profile: Dict[str, Any]) -> List[str]:
		"""Identify recommended win themes"""
		
		win_themes = []
		
		# Leverage competitive strengths
		for strength in positioning.competitive_strengths[:2]:
			win_themes.append(f"Emphasize {strength.lower()}")
		
		# Address market needs
		win_themes.append("Proven track record of successful delivery")
		win_themes.append("Client-centric approach with dedicated support")
		
		# Innovation and technology leadership
		if 'innovation' in organizational_profile.get('capabilities', {}):
			win_themes.append("Cutting-edge technology solutions and innovation")
		
		# Value proposition
		win_themes.append("Optimal balance of capability, quality, and cost-effectiveness")
		
		return win_themes[:5]  # Top 5 win themes
	
	def _develop_risk_mitigation(self, positioning: CompetitivePositioning,
	                             comparisons: List[CompetitorComparison]) -> List[str]:
		"""Develop competitive risk mitigation strategies"""
		
		mitigation_strategies = []
		
		# Address primary threats
		for threat in positioning.primary_threats[:2]:
			mitigation_strategies.append(f"Counter {threat.split(' - ')[0]} positioning")
		
		# General mitigation approaches
		mitigation_strategies.extend([
			"Early and frequent customer engagement to build relationships",
			"Develop compelling proof points and case studies",
			"Monitor competitor pricing and positioning strategies",
			"Build strategic partnerships to enhance competitive position"
		])
		
		# High-threat competitor specific mitigation
		high_threat_competitors = [c for c in comparisons if c.threat_level == "high"]
		if high_threat_competitors:
			mitigation_strategies.append("Develop direct response strategy for high-threat competitors")
		
		return mitigation_strategies[:6]  # Top 6 strategies
	
	def _identify_intelligence_gaps(self, competitors: List[CompetitorProfile],
	                                market_intel: MarketIntelligence) -> List[str]:
		"""Identify key competitive intelligence gaps"""
		
		gaps = []
		
		# Competitor-specific gaps
		low_quality_intel = [c for c in competitors if c.intelligence_quality < 0.6]
		if low_quality_intel:
			gaps.append(f"Limited intelligence on {len(low_quality_intel)} key competitors")
		
		# Missing win rate data
		missing_win_rates = [c for c in competitors if c.win_rate is None]
		if missing_win_rates:
			gaps.append("Historical win rate data for key competitors")
		
		# Pricing intelligence
		gaps.append("Competitor pricing strategies and positioning")
		
		# Recent activity
		gaps.append("Recent competitor wins and market activity")
		
		# Partnership intelligence
		gaps.append("Competitor partnership strategies and relationships")
		
		return gaps[:5]  # Top 5 gaps
	
	def _set_monitoring_priorities(self, competitors: List[CompetitorProfile],
	                               positioning: CompetitivePositioning) -> List[str]:
		"""Set ongoing competitive monitoring priorities"""
		
		priorities = []
		
		# Monitor top threats
		tier1_competitors = [c for c in competitors if c.tier == CompetitorTier.TIER_1]
		if tier1_competitors:
			priorities.append(f"Track activities of {len(tier1_competitors)} Tier 1 competitors")
		
		# Market share and positioning changes
		priorities.append("Monitor market share shifts and positioning changes")
		
		# Innovation and capability development
		priorities.append("Track competitor innovation initiatives and capability investments")
		
		# Pricing and contract wins
		priorities.append("Monitor competitor pricing strategies and recent contract wins")
		
		# Partnership and acquisition activity
		priorities.append("Track strategic partnerships and acquisition activity")
		
		return priorities
	
	def _calculate_analysis_confidence(self, competitors: List[CompetitorProfile],
	                                   market_intel: MarketIntelligence,
	                                   positioning: CompetitivePositioning) -> float:
		"""Calculate overall analysis confidence level"""
		
		confidence_factors = []
		
		# Intelligence quality
		if competitors:
			avg_intel_quality = np.mean([c.intelligence_quality for c in competitors])
			confidence_factors.append(avg_intel_quality)
		
		# Completeness of competitor data
		complete_profiles = sum(1 for c in competitors if c.win_rate is not None and c.core_capabilities)
		if competitors:
			completeness_score = complete_profiles / len(competitors)
			confidence_factors.append(completeness_score)
		
		# Market intelligence completeness
		market_completeness = 0.7  # Default moderate confidence
		if hasattr(market_intel, 'market_size') and market_intel.market_size:
			market_completeness += 0.1
		if len(market_intel.key_trends) >= 3:
			market_completeness += 0.1
		confidence_factors.append(min(market_completeness, 1.0))
		
		return np.mean(confidence_factors) if confidence_factors else 0.6
	
	def _log_analysis_error(self, message: str) -> None:
		"""Log analysis errors"""
		import logging
		logger = logging.getLogger(__name__)
		logger.error(f"CompetitiveAnalyzer Error: {message}")


# Example usage and testing
async def create_sample_competitive_analysis():
	"""Create sample competitive analysis for testing"""
	
	# Sample opportunity
	opportunity = OpportunityData(
		id="test_competitive_001",
		title="Federal IT Modernization Project",
		description="Modernize legacy systems with cloud-native architecture",
		requirements="5+ years cloud experience, security clearance, agile methodology",
		estimated_value=5000000.0,
		submission_deadline=datetime.now() + timedelta(days=45)
	)
	
	# Sample organizational profile
	org_profile = {
		'capabilities': {
			'software_development': 0.85,
			'cloud_computing': 0.80,
			'cybersecurity': 0.70,
			'project_management': 0.75
		},
		'employee_count': 350,
		'years_in_business': 12
	}
	
	# Market context
	market_context = {
		'known_competitors': ['acme_consulting', 'specialized_tech']
	}
	
	# Run competitive analysis
	analyzer = CompetitiveAnalyzer()
	analysis = await analyzer.analyze_competition(opportunity, org_profile, market_context)
	
	return analysis


if __name__ == "__main__":
	# Test the competitive analyzer
	import asyncio
	
	async def main():
		analysis = await create_sample_competitive_analysis()
		logger.info(f"Identified Competitors: {len(analysis.identified_competitors)}")
		logger.info(f"Competitive Intensity: {analysis.competitive_positioning.competitive_intensity:.2f}")
		logger.info(f"Our Rank: {analysis.competitive_positioning.our_rank}")
		logger.info(f"Win Probability: {analysis.competitive_positioning.our_win_probability:.2f}")
		logger.info(f"Strategy: {analysis.competitive_strategy}")
		logger.info(f"Analysis Confidence: {analysis.analysis_confidence:.2f}")
		
		for competitor in analysis.identified_competitors:
			logger.info(f"\nCompetitor: {competitor.name} ({competitor.tier.value})")
			logger.info(f"Advantages: {[adv.value for adv in competitor.competitive_advantages]}")
		
	asyncio.run(main())
