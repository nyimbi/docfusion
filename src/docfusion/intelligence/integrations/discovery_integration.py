"""
Intelligence-Discovery Integration Service

This module provides seamless integration between the intelligence engine and
discovery system, enabling AI-driven opportunity analysis, competitive intelligence,
and strategic recommendations for discovered opportunities.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

from pydantic import BaseModel, Field, ConfigDict
from uuid import uuid4

# Intelligence engine imports
from ..predictors.win_probability_predictor import (
    WinProbabilityPredictor, PredictionFeatures, PredictionResult, HistoricalOpportunity
)
# from ..analyzers.competitive_analyzer import CompetitiveAnalyzer  # Disabled due to dependency issues
from ..recommenders.strategy_recommender import (
    StrategyRecommender, OpportunityContext, StrategicRecommendation
)

# Discovery system imports (when available)
try:
    from ...discovery.models.opportunity_models import OpportunityData
    from ...discovery.analyzers.opportunity_analyzer import OpportunityAnalyzer
    from ...discovery.matchers.relevance_filter import RelevanceFilter, OpportunityContext as DiscoveryContext
    from ...discovery.integrations.notification_service import OpportunityNotificationService
    DISCOVERY_AVAILABLE = True
except ImportError:
    DISCOVERY_AVAILABLE = False
    # Create placeholder classes for when discovery is not available
    class OpportunityData(BaseModel):
        model_config = ConfigDict(extra='allow')
        id: str
        title: str
        description: str


class IntelligenceLevel(str, Enum):
    """Levels of intelligence analysis"""
    
    BASIC = "basic"
    ENHANCED = "enhanced"
    COMPREHENSIVE = "comprehensive"
    STRATEGIC = "strategic"


class OpportunityIntelligence(BaseModel):
    """Comprehensive opportunity intelligence report"""
    model_config = ConfigDict(extra='forbid', validate_by_name=True)
    
    intelligence_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique intelligence identifier")
    opportunity_id: str = Field(description="Opportunity identifier")
    intelligence_level: IntelligenceLevel = Field(description="Level of intelligence analysis performed")
    
    # Win probability analysis
    win_probability_analysis: Optional[PredictionResult] = Field(None, description="Win probability prediction")
    
    # Competitive intelligence
    competitive_analysis: Optional[Dict[str, Any]] = Field(None, description="Competitive landscape analysis")
    
    # Strategic recommendations
    strategic_recommendation: Optional[StrategicRecommendation] = Field(None, description="Strategic go/no-go recommendation")
    
    # Discovery integration data
    discovery_analysis: Optional[Dict[str, Any]] = Field(None, description="Discovery system analysis results")
    
    # Intelligence insights
    key_insights: List[str] = Field(description="Key intelligence insights")
    risk_factors: List[str] = Field(description="Identified risk factors")
    opportunity_strengths: List[str] = Field(description="Opportunity strengths")
    
    # Action recommendations
    immediate_actions: List[str] = Field(description="Immediate actions recommended")
    strategic_actions: List[str] = Field(description="Strategic actions for consideration")
    
    # Metadata
    analysis_timestamp: datetime = Field(default_factory=datetime.now)
    analysis_duration_seconds: float = Field(description="Time taken for analysis")
    confidence_score: float = Field(ge=0.0, le=1.0, description="Overall confidence in intelligence")


class IntelligenceDiscoveryService:
    """
    Integration service between intelligence engine and discovery system
    
    Provides comprehensive opportunity intelligence by combining discovery
    system data with predictive analytics, competitive analysis, and
    strategic recommendations.
    """
    
    def __init__(self):
        # Initialize intelligence components
        self.win_predictor = WinProbabilityPredictor()
        # self.competitive_analyzer = CompetitiveAnalyzer()  # Disabled due to dependency issues
        self.competitive_analyzer = None
        self.strategy_recommender = StrategyRecommender(self.win_predictor)
        
        # Initialize discovery components (if available)
        if DISCOVERY_AVAILABLE:
            self.opportunity_analyzer = OpportunityAnalyzer()
            self.relevance_filter = RelevanceFilter()
            self.notification_service = OpportunityNotificationService()
        else:
            self.opportunity_analyzer = None
            self.relevance_filter = None
            self.notification_service = None
        
        # Intelligence cache
        self.intelligence_cache: Dict[str, OpportunityIntelligence] = {}
        self.analysis_history: List[OpportunityIntelligence] = []
        
        # Configuration
        self.cache_ttl_hours = 24  # Intelligence cache time-to-live
        self.auto_refresh_enabled = True
        
        self._log_initialization()
    
    async def analyze_opportunity_intelligence(self, opportunity_data: OpportunityData,
                                               intelligence_level: IntelligenceLevel = IntelligenceLevel.ENHANCED,
                                               organizational_profile: Optional[Dict[str, Any]] = None) -> OpportunityIntelligence:
        """
        Generate comprehensive opportunity intelligence
        
        Args:
            opportunity_data: Opportunity data from discovery system
            intelligence_level: Level of analysis to perform
            organizational_profile: Organization capabilities and profile
            
        Returns:
            Comprehensive opportunity intelligence report
        """
        start_time = datetime.now()
        
        try:
            self._log_analysis_start(opportunity_data.id, intelligence_level)
            
            # Check cache first
            cached_intelligence = self._get_cached_intelligence(opportunity_data.id)
            if cached_intelligence and intelligence_level == IntelligenceLevel.BASIC:
                return cached_intelligence
            
            # Extract features for prediction
            prediction_features = await self._extract_prediction_features(opportunity_data)
            
            # Initialize intelligence report
            intelligence = OpportunityIntelligence(
                opportunity_id=opportunity_data.id,
                intelligence_level=intelligence_level,
                key_insights=[],
                risk_factors=[],
                opportunity_strengths=[],
                immediate_actions=[],
                strategic_actions=[],
                analysis_duration_seconds=0.0,
                confidence_score=0.0
            )
            
            # Perform analysis based on intelligence level
            if intelligence_level in [IntelligenceLevel.BASIC, IntelligenceLevel.ENHANCED]:
                await self._perform_basic_analysis(intelligence, opportunity_data, prediction_features)
            
            if intelligence_level in [IntelligenceLevel.ENHANCED, IntelligenceLevel.COMPREHENSIVE]:
                await self._perform_enhanced_analysis(intelligence, opportunity_data, organizational_profile)
            
            if intelligence_level in [IntelligenceLevel.COMPREHENSIVE, IntelligenceLevel.STRATEGIC]:
                await self._perform_comprehensive_analysis(intelligence, opportunity_data, organizational_profile)
            
            if intelligence_level == IntelligenceLevel.STRATEGIC:
                await self._perform_strategic_analysis(intelligence, opportunity_data, organizational_profile)
            
            # Integrate with discovery system analysis
            if DISCOVERY_AVAILABLE and self.opportunity_analyzer:
                discovery_analysis = await self._integrate_discovery_analysis(opportunity_data)
                intelligence.discovery_analysis = discovery_analysis
            
            # Calculate overall confidence and finalize
            intelligence.confidence_score = self._calculate_overall_confidence(intelligence)
            intelligence.analysis_duration_seconds = (datetime.now() - start_time).total_seconds()
            
            # Cache and store results
            self._cache_intelligence(intelligence)
            self.analysis_history.append(intelligence)
            
            self._log_analysis_complete(opportunity_data.id, intelligence.confidence_score, intelligence.analysis_duration_seconds)
            
            return intelligence
            
        except Exception as e:
            self._log_analysis_error(f"Intelligence analysis failed for {opportunity_data.id}: {str(e)}")
            raise
    
    async def _extract_prediction_features(self, opportunity_data: OpportunityData) -> PredictionFeatures:
        """Extract prediction features from opportunity data"""
        
        # Extract basic features from opportunity data
        opportunity_value = getattr(opportunity_data, 'estimated_value', 1000000.0)
        submission_deadline = getattr(opportunity_data, 'submission_deadline', datetime.now() + timedelta(days=30))
        
        # Calculate days remaining
        days_remaining = max(1, (submission_deadline - datetime.now()).days)
        
        # Estimate complexity from description
        description = getattr(opportunity_data, 'description', '')
        complexity_indicators = ['complex', 'advanced', 'sophisticated', 'enterprise', 'large-scale']
        complexity_score = min(1.0, sum(1 for indicator in complexity_indicators if indicator in description.lower()) * 0.2)
        
        # Estimate other features (would be enhanced with more sophisticated analysis)
        features = PredictionFeatures(
            opportunity_value=opportunity_value,
            submission_days_remaining=days_remaining,
            requirements_complexity=complexity_score,
            capability_match_score=0.7,  # Default - would be calculated from org profile
            past_performance_score=0.6,  # Default - would be calculated from history
            team_experience_score=0.7,   # Default - would be calculated from team data
            competitive_intensity=0.5,   # Default - would be enhanced with competitive intel
            incumbent_advantage=False,   # Default - would be determined from research
            estimated_competitors=4,     # Default estimate
            market_familiarity=0.6,      # Default - would be calculated from history
            industry_experience_years=8, # Default - would be from org profile
            client_relationship_score=0.5, # Default - would be from CRM data
            strategic_importance=0.6,    # Default - would be from strategic planning
            resource_availability=0.8,  # Default - would be from resource planning
            pricing_competitiveness=0.7  # Default - would be from pricing analysis
        )
        
        return features
    
    async def _perform_basic_analysis(self, intelligence: OpportunityIntelligence, 
                                      opportunity_data: OpportunityData,
                                      prediction_features: PredictionFeatures):
        """Perform basic intelligence analysis"""
        
        # Basic opportunity assessment
        intelligence.key_insights.extend([
            f"Opportunity value: ${prediction_features.opportunity_value:,.0f}",
            f"Submission deadline: {prediction_features.submission_days_remaining} days remaining",
            f"Estimated complexity: {prediction_features.requirements_complexity:.1%}"
        ])
        
        # Basic risk assessment
        if prediction_features.submission_days_remaining < 21:
            intelligence.risk_factors.append("Limited time for proposal development")
        
        if prediction_features.opportunity_value > 10000000:
            intelligence.risk_factors.append("High-value opportunity requires significant investment")
        
        # Basic recommendations
        intelligence.immediate_actions.extend([
            "Review opportunity requirements in detail",
            "Assess team availability and capability alignment",
            "Conduct initial go/no-go evaluation"
        ])
    
    async def _perform_enhanced_analysis(self, intelligence: OpportunityIntelligence,
                                         opportunity_data: OpportunityData,
                                         organizational_profile: Optional[Dict[str, Any]]):
        """Perform enhanced intelligence analysis with predictions"""
        
        # Win probability prediction
        if self.win_predictor.is_trained:
            prediction_features = await self._extract_prediction_features(opportunity_data)
            win_prediction = await self.win_predictor.predict_win_probability(
                prediction_features, opportunity_data.id
            )
            intelligence.win_probability_analysis = win_prediction
            
            # Add insights from prediction
            win_prob = win_prediction.predicted_win_probability
            intelligence.key_insights.append(f"Predicted win probability: {win_prob:.1%}")
            
            if win_prob >= 0.6:
                intelligence.opportunity_strengths.append("High win probability based on ML analysis")
            elif win_prob <= 0.3:
                intelligence.risk_factors.append("Low predicted win probability")
            
            # Add top factors
            for factor, impact in win_prediction.top_positive_factors[:3]:
                intelligence.opportunity_strengths.append(f"Strong {factor.lower()}")
            
            for factor, impact in win_prediction.top_negative_factors[:3]:
                intelligence.risk_factors.append(f"Weakness in {factor.lower()}")
        
        # Enhanced recommendations based on predictions
        intelligence.strategic_actions.extend([
            "Develop detailed capture strategy based on win probability factors",
            "Address identified weaknesses before proposal development",
            "Leverage identified strengths in proposal positioning"
        ])
    
    async def _perform_comprehensive_analysis(self, intelligence: OpportunityIntelligence,
                                              opportunity_data: OpportunityData,
                                              organizational_profile: Optional[Dict[str, Any]]):
        """Perform comprehensive analysis with competitive intelligence"""
        
        # Competitive analysis (disabled due to dependency issues)
        if organizational_profile and self.competitive_analyzer:
            # competitive_analysis = await self.competitive_analyzer.analyze_competition(
            #     opportunity_data, organizational_profile
            # )
            # intelligence.competitive_analysis = competitive_analysis.model_dump()
            pass
        
        # Enhanced strategic recommendations
        intelligence.strategic_actions.extend([
            "Conduct detailed competitive landscape research",
            "Develop competitive differentiation strategy",
            "Plan team and resource allocation for competitive proposal"
        ])
    
    async def _perform_strategic_analysis(self, intelligence: OpportunityIntelligence,
                                          opportunity_data: OpportunityData,
                                          organizational_profile: Optional[Dict[str, Any]]):
        """Perform strategic-level analysis with comprehensive recommendations"""
        
        # Strategic recommendation
        opportunity_context = self._create_opportunity_context(opportunity_data)
        prediction_features = await self._extract_prediction_features(opportunity_data)
        
        strategic_recommendation = await self.strategy_recommender.recommend_strategy(
            opportunity_context, prediction_features
        )
        intelligence.strategic_recommendation = strategic_recommendation
        
        # Add strategic insights
        recommendation_type = strategic_recommendation.recommendation_type.value
        confidence = strategic_recommendation.confidence_level
        
        intelligence.key_insights.extend([
            f"Strategic recommendation: {recommendation_type.upper()}",
            f"Recommendation confidence: {confidence:.1%}",
            f"Expected value: ${strategic_recommendation.expected_value:,.0f}"
        ])
        
        # Add strategic rationale
        intelligence.key_insights.append(strategic_recommendation.primary_rationale)
        
        # Strategic actions
        intelligence.strategic_actions.extend([
            f"Execute {recommendation_type} strategy with {confidence:.0%} confidence",
            "Consider portfolio impact and resource allocation",
            "Monitor success conditions and decision dependencies"
        ])
        
        # Add resource recommendations if GO
        if strategic_recommendation.resource_allocation:
            resource_alloc = strategic_recommendation.resource_allocation
            intelligence.immediate_actions.extend([
                f"Allocate {resource_alloc.proposed_team_size} team members",
                f"Plan {resource_alloc.proposal_timeline_weeks:.1f} week timeline",
                f"Budget ${resource_alloc.estimated_proposal_cost:,.0f} for proposal development"
            ])
    
    async def _integrate_discovery_analysis(self, opportunity_data: OpportunityData) -> Dict[str, Any]:
        """Integrate with discovery system analysis"""
        
        if not DISCOVERY_AVAILABLE or not self.opportunity_analyzer:
            return {"status": "discovery_not_available"}
        
        try:
            # Perform discovery analysis
            discovery_analysis = await self.opportunity_analyzer.analyze_opportunity(opportunity_data)
            
            # Convert to dictionary for storage
            analysis_dict = {
                "opportunity_classification": getattr(discovery_analysis, 'opportunity_classification', None),
                "competitive_assessment": getattr(discovery_analysis, 'competitive_assessment', None),
                "timeline_analysis": getattr(discovery_analysis, 'timeline_analysis', None),
                "value_estimation": getattr(discovery_analysis, 'value_estimation', None),
                "eligibility_analysis": getattr(discovery_analysis, 'eligibility_analysis', None)
            }
            
            return analysis_dict
            
        except Exception as e:
            return {"status": "discovery_analysis_failed", "error": str(e)}
    
    def _create_opportunity_context(self, opportunity_data: OpportunityData) -> OpportunityContext:
        """Create opportunity context for strategy recommender"""
        
        return OpportunityContext(
            opportunity_id=opportunity_data.id,
            opportunity_value=getattr(opportunity_data, 'estimated_value', 1000000.0),
            submission_deadline=getattr(opportunity_data, 'submission_deadline', datetime.now() + timedelta(days=30)),
            strategic_importance=0.6,  # Would be calculated from strategic assessment
            market_expansion_potential=0.5,  # Would be calculated from market analysis
            relationship_building_value=0.4,  # Would be calculated from client analysis
            competitive_intensity=0.5,  # Would be calculated from competitive research
            incumbent_advantage=False,  # Would be determined from research
            estimated_proposal_effort_hours=300,  # Would be estimated from complexity
            required_team_size=6,  # Would be estimated from requirements
            specialized_skills_required=[]  # Would be extracted from requirements
        )
    
    def _calculate_overall_confidence(self, intelligence: OpportunityIntelligence) -> float:
        """Calculate overall confidence in intelligence analysis"""
        
        confidence_factors = []
        
        # Win probability confidence
        if intelligence.win_probability_analysis:
            confidence_factors.append(intelligence.win_probability_analysis.prediction_confidence)
        
        # Strategic recommendation confidence
        if intelligence.strategic_recommendation:
            confidence_factors.append(intelligence.strategic_recommendation.confidence_level)
        
        # Data completeness confidence
        insights_completeness = min(1.0, len(intelligence.key_insights) / 10)  # Target 10 insights
        confidence_factors.append(insights_completeness)
        
        # Intelligence level adjustment
        level_weights = {
            IntelligenceLevel.BASIC: 0.6,
            IntelligenceLevel.ENHANCED: 0.7,
            IntelligenceLevel.COMPREHENSIVE: 0.8,
            IntelligenceLevel.STRATEGIC: 0.9
        }
        base_confidence = level_weights.get(intelligence.intelligence_level, 0.7)
        
        if confidence_factors:
            factor_confidence = sum(confidence_factors) / len(confidence_factors)
            return (base_confidence + factor_confidence) / 2
        else:
            return base_confidence
    
    def _get_cached_intelligence(self, opportunity_id: str) -> Optional[OpportunityIntelligence]:
        """Get cached intelligence if still valid"""
        
        if opportunity_id in self.intelligence_cache:
            intelligence = self.intelligence_cache[opportunity_id]
            
            # Check if cache is still valid
            cache_age = datetime.now() - intelligence.analysis_timestamp
            if cache_age.total_seconds() < (self.cache_ttl_hours * 3600):
                return intelligence
            else:
                # Remove expired cache
                del self.intelligence_cache[opportunity_id]
        
        return None
    
    def _cache_intelligence(self, intelligence: OpportunityIntelligence):
        """Cache intelligence analysis"""
        
        self.intelligence_cache[intelligence.opportunity_id] = intelligence
        
        # Clean up old cache entries (keep only latest 100)
        if len(self.intelligence_cache) > 100:
            oldest_entries = sorted(
                self.intelligence_cache.items(),
                key=lambda x: x[1].analysis_timestamp
            )[:50]
            
            for opportunity_id, _ in oldest_entries:
                del self.intelligence_cache[opportunity_id]
    
    async def bulk_analyze_opportunities(self, opportunities: List[OpportunityData],
                                         intelligence_level: IntelligenceLevel = IntelligenceLevel.ENHANCED) -> List[OpportunityIntelligence]:
        """Analyze multiple opportunities in parallel"""
        
        self._log_bulk_analysis_start(len(opportunities))
        
        # Create analysis tasks
        analysis_tasks = [
            self.analyze_opportunity_intelligence(opp, intelligence_level)
            for opp in opportunities
        ]
        
        # Execute in parallel
        results = await asyncio.gather(*analysis_tasks, return_exceptions=True)
        
        # Filter successful results
        successful_results = [
            result for result in results 
            if isinstance(result, OpportunityIntelligence)
        ]
        
        self._log_bulk_analysis_complete(len(opportunities), len(successful_results))
        
        return successful_results
    
    def get_intelligence_statistics(self) -> Dict[str, Any]:
        """Get statistics on intelligence analyses performed"""
        
        if not self.analysis_history:
            return {"total_analyses": 0}
        
        # Basic statistics
        total_analyses = len(self.analysis_history)
        avg_confidence = sum(intel.confidence_score for intel in self.analysis_history) / total_analyses
        avg_duration = sum(intel.analysis_duration_seconds for intel in self.analysis_history) / total_analyses
        
        # Analysis by level
        level_counts = {}
        for intel in self.analysis_history:
            level = intel.intelligence_level.value
            level_counts[level] = level_counts.get(level, 0) + 1
        
        # Recent performance (last 10 analyses)
        recent_analyses = self.analysis_history[-10:]
        recent_avg_confidence = sum(intel.confidence_score for intel in recent_analyses) / len(recent_analyses)
        recent_avg_duration = sum(intel.analysis_duration_seconds for intel in recent_analyses) / len(recent_analyses)
        
        return {
            "total_analyses": total_analyses,
            "average_confidence": avg_confidence,
            "average_duration_seconds": avg_duration,
            "analyses_by_level": level_counts,
            "cache_hit_rate": len(self.intelligence_cache) / max(total_analyses, 1),
            "recent_average_confidence": recent_avg_confidence,
            "recent_average_duration": recent_avg_duration,
            "discovery_integration_available": DISCOVERY_AVAILABLE
        }
    
    # Logging methods
    
    def _log_initialization(self):
        discovery_status = "available" if DISCOVERY_AVAILABLE else "not available"
        print(f"IntelligenceDiscoveryService: Initialized (Discovery integration: {discovery_status})")
    
    def _log_analysis_start(self, opportunity_id: str, level: IntelligenceLevel):
        print(f"IntelligenceDiscoveryService: Starting {level.value} analysis for {opportunity_id}")
    
    def _log_analysis_complete(self, opportunity_id: str, confidence: float, duration: float):
        print(f"IntelligenceDiscoveryService: Completed analysis for {opportunity_id} (confidence: {confidence:.3f}, duration: {duration:.1f}s)")
    
    def _log_analysis_error(self, message: str):
        print(f"IntelligenceDiscoveryService Error: {message}")
    
    def _log_bulk_analysis_start(self, count: int):
        print(f"IntelligenceDiscoveryService: Starting bulk analysis of {count} opportunities")
    
    def _log_bulk_analysis_complete(self, total: int, successful: int):
        print(f"IntelligenceDiscoveryService: Completed bulk analysis ({successful}/{total} successful)")


# Example usage and testing
async def create_sample_intelligence_analysis():
    """Create sample intelligence analysis for testing"""
    
    # Initialize service
    service = IntelligenceDiscoveryService()
    
    # Create sample opportunity data
    opportunity = OpportunityData(
        id="intel_test_001",
        title="Advanced Cybersecurity Solutions",
        description="Comprehensive cybersecurity implementation for enterprise client including advanced threat detection, incident response, and security operations center setup"
    )
    
    # Add additional attributes that might be expected
    opportunity.estimated_value = 4500000.0
    opportunity.submission_deadline = datetime.now() + timedelta(days=35)
    
    # Create sample organizational profile
    org_profile = {
        "capabilities": {
            "cybersecurity": 0.9,
            "cloud_security": 0.8,
            "incident_response": 0.85
        },
        "employee_count": 150,
        "years_in_business": 12,
        "past_performance": ["Previous cybersecurity implementations", "SOC management experience"],
        "certifications": ["ISO 27001", "SOC 2 Type II"]
    }
    
    # Perform comprehensive intelligence analysis
    intelligence = await service.analyze_opportunity_intelligence(
        opportunity, 
        IntelligenceLevel.COMPREHENSIVE,
        org_profile
    )
    
    return intelligence, service.get_intelligence_statistics()


if __name__ == "__main__":
    # Test the intelligence-discovery integration
    import asyncio
    
    async def main():
        intelligence, stats = await create_sample_intelligence_analysis()
        
        print("Opportunity Intelligence Analysis:")
        print("=" * 50)
        print(f"Opportunity ID: {intelligence.opportunity_id}")
        print(f"Intelligence Level: {intelligence.intelligence_level.value}")
        print(f"Overall Confidence: {intelligence.confidence_score:.3f}")
        print(f"Analysis Duration: {intelligence.analysis_duration_seconds:.1f} seconds")
        
        print(f"\nKey Insights ({len(intelligence.key_insights)}):")
        for insight in intelligence.key_insights[:5]:
            print(f"  💡 {insight}")
        
        print(f"\nOpportunity Strengths:")
        for strength in intelligence.opportunity_strengths[:3]:
            print(f"  ✅ {strength}")
        
        print(f"\nRisk Factors:")
        for risk in intelligence.risk_factors[:3]:
            print(f"  ⚠️ {risk}")
        
        print(f"\nImmediate Actions:")
        for action in intelligence.immediate_actions[:3]:
            print(f"  🎯 {action}")
        
        if intelligence.win_probability_analysis:
            win_prob = intelligence.win_probability_analysis.predicted_win_probability
            print(f"\nWin Probability: {win_prob:.1%}")
        
        if intelligence.strategic_recommendation:
            rec_type = intelligence.strategic_recommendation.recommendation_type.value
            print(f"Strategic Recommendation: {rec_type.upper()}")
        
        print(f"\nService Statistics:")
        print(f"  Total Analyses: {stats['total_analyses']}")
        print(f"  Average Confidence: {stats['average_confidence']:.3f}")
        print(f"  Discovery Integration: {stats['discovery_integration_available']}")
    
    asyncio.run(main())