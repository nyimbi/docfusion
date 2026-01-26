"""
Intelligence-Document Integration Service

This module provides integration between the intelligence engine and document
generation system, enabling AI-driven content optimization, real-time scoring
feedback, and intelligent proposal enhancement during document creation.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from enum import Enum

from pydantic import BaseModel, Field, ConfigDict
from uuid import uuid4

# Intelligence engine imports
from ..predictors.scoring_predictor import ScoringPredictor, SectionFeatures, ProposalSection, SectionScorePrediction
from ..recommenders.content_recommender import ContentRecommender, ContentRecommendationReport
from ..recommenders.strategy_recommender import StrategyRecommender
# Integration imports (with fallback for discovery dependency issues)
try:
    from .discovery_integration import OpportunityIntelligence
except ImportError:
    # Create placeholder for OpportunityIntelligence when discovery dependencies fail
    from pydantic import BaseModel, ConfigDict
    class OpportunityIntelligence(BaseModel):
        model_config = ConfigDict(extra='allow')
        intelligence_id: str
        opportunity_id: str


class DocumentState(str, Enum):
    """Document development states"""
    
    PLANNING = "planning"
    DRAFTING = "drafting"
    REVIEWING = "reviewing"
    FINALIZING = "finalizing"
    COMPLETE = "complete"


class IntegrationMode(str, Enum):
    """Integration modes for document development"""
    
    REAL_TIME = "real_time"
    ON_DEMAND = "on_demand"
    BATCH = "batch"
    ADVISORY = "advisory"


class DocumentIntelligenceInsight(BaseModel):
    """Intelligence insight for document development"""
    model_config = ConfigDict(extra='forbid', validate_by_name=True)
    
    insight_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique insight identifier")
    section_type: ProposalSection = Field(description="Section this insight applies to")
    insight_type: str = Field(description="Type of insight (score_prediction, content_recommendation, etc.)")
    
    # Insight content
    title: str = Field(description="Short title of the insight")
    description: str = Field(description="Detailed description")
    priority: str = Field(description="Priority level: critical, high, medium, low")
    
    # Actionable information
    current_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Current predicted score")
    target_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Target score")
    improvement_potential: Optional[float] = Field(None, ge=0.0, le=20.0, description="Potential score improvement")
    
    # Implementation guidance
    specific_actions: List[str] = Field(description="Specific actions to take")
    implementation_effort: str = Field(description="Effort required: minimal, moderate, significant")
    expected_impact: str = Field(description="Expected impact description")
    
    # Context
    content_location: Optional[str] = Field(None, description="Specific location in document")
    dependencies: List[str] = Field(default_factory=list, description="Dependencies or prerequisites")
    
    # Metadata
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence in the insight")
    created_timestamp: datetime = Field(default_factory=datetime.now)
    expires_timestamp: Optional[datetime] = Field(None, description="When insight becomes stale")


class DocumentIntelligenceSession(BaseModel):
    """Intelligence session for document development"""
    model_config = ConfigDict(extra='forbid', validate_by_name=True)
    
    session_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique session identifier")
    proposal_id: str = Field(description="Proposal identifier")
    document_state: DocumentState = Field(description="Current document state")
    integration_mode: IntegrationMode = Field(description="Integration mode")
    
    # Session data
    active_insights: List[DocumentIntelligenceInsight] = Field(description="Currently active insights")
    resolved_insights: List[DocumentIntelligenceInsight] = Field(description="Resolved insights")
    
    # Session statistics
    total_insights_generated: int = Field(default=0, description="Total insights generated")
    insights_implemented: int = Field(default=0, description="Number of insights implemented")
    estimated_score_improvement: float = Field(default=0.0, description="Estimated total score improvement")
    
    # Session timeline
    session_start: datetime = Field(default_factory=datetime.now)
    last_update: datetime = Field(default_factory=datetime.now)
    session_duration_minutes: float = Field(default=0.0, description="Session duration in minutes")


class IntelligenceDocumentService:
    """
    Integration service between intelligence engine and document generation
    
    Provides real-time intelligence insights during document development,
    including content scoring, improvement recommendations, and strategic
    guidance to optimize proposal competitiveness.
    """
    
    def __init__(self):
        # Initialize intelligence components
        self.scoring_predictor = ScoringPredictor()
        self.content_recommender = ContentRecommender()
        self.strategy_recommender = StrategyRecommender()
        
        # Active sessions
        self.active_sessions: Dict[str, DocumentIntelligenceSession] = {}
        self.session_history: List[DocumentIntelligenceSession] = []
        
        # Configuration
        self.real_time_threshold_words = 100  # Trigger analysis after this many words
        self.insight_refresh_interval_minutes = 15
        self.max_active_insights = 10
        
        # Performance tracking
        self.total_analyses = 0
        self.total_insights_generated = 0
        self.average_response_time = 0.0
        
        self._log_initialization()
    
    async def start_intelligence_session(self, proposal_id: str, 
                                         integration_mode: IntegrationMode = IntegrationMode.REAL_TIME,
                                         opportunity_intelligence: Optional[OpportunityIntelligence] = None) -> str:
        """
        Start an intelligence session for document development
        
        Args:
            proposal_id: Proposal identifier
            integration_mode: Mode of intelligence integration
            opportunity_intelligence: Optional opportunity intelligence context
            
        Returns:
            Session ID for tracking
        """
        try:
            session = DocumentIntelligenceSession(
                proposal_id=proposal_id,
                document_state=DocumentState.PLANNING,
                integration_mode=integration_mode,
                active_insights=[],
                resolved_insights=[]
            )
            
            self.active_sessions[session.session_id] = session
            
            # Generate initial strategic insights if opportunity intelligence available
            if opportunity_intelligence:
                initial_insights = await self._generate_initial_insights(
                    session, opportunity_intelligence
                )
                session.active_insights.extend(initial_insights)
                session.total_insights_generated += len(initial_insights)
            
            self._log_session_start(session.session_id, proposal_id, integration_mode)
            
            return session.session_id
            
        except Exception as e:
            self._log_session_error(f"Failed to start intelligence session: {str(e)}")
            raise
    
    async def analyze_section_content(self, session_id: str, section_type: ProposalSection,
                                      content: str, requirements: Optional[List[str]] = None) -> List[DocumentIntelligenceInsight]:
        """
        Analyze section content and generate intelligence insights
        
        Args:
            session_id: Active session identifier
            section_type: Type of section being analyzed
            content: Section content text
            requirements: Optional section requirements
            
        Returns:
            List of intelligence insights for the section
        """
        start_time = datetime.now()
        
        try:
            if session_id not in self.active_sessions:
                raise ValueError(f"No active session found for {session_id}")
            
            session = self.active_sessions[session_id]
            self._log_analysis_start(session_id, section_type)
            
            insights = []
            
            # Generate scoring prediction insight
            scoring_insight = await self._generate_scoring_insight(
                section_type, content, requirements
            )
            if scoring_insight:
                insights.append(scoring_insight)
            
            # Generate content recommendation insights
            content_insights = await self._generate_content_insights(
                section_type, content, requirements
            )
            insights.extend(content_insights)
            
            # Generate competitive insights
            competitive_insights = await self._generate_competitive_insights(
                section_type, content, session.proposal_id
            )
            insights.extend(competitive_insights)
            
            # Update session
            session.active_insights.extend(insights)
            session.total_insights_generated += len(insights)
            session.last_update = datetime.now()
            
            # Update performance tracking
            self.total_analyses += 1
            self.total_insights_generated += len(insights)
            
            analysis_time = (datetime.now() - start_time).total_seconds()
            self.average_response_time = (
                (self.average_response_time * (self.total_analyses - 1) + analysis_time) / self.total_analyses
            )
            
            self._log_analysis_complete(session_id, section_type, len(insights), analysis_time)
            
            return insights
            
        except Exception as e:
            self._log_analysis_error(f"Section analysis failed for {session_id}: {str(e)}")
            raise
    
    async def _generate_scoring_insight(self, section_type: ProposalSection, 
                                        content: str, requirements: Optional[List[str]]) -> Optional[DocumentIntelligenceInsight]:
        """Generate scoring prediction insight"""
        
        if not content or len(content.split()) < 50:  # Minimum content for meaningful analysis
            return None
        
        try:
            # Extract features from content
            features = self._extract_section_features_from_content(content, requirements)
            
            # Get scoring prediction if models are trained
            if section_type in self.scoring_predictor.is_trained and self.scoring_predictor.is_trained[section_type]:
                prediction = await self.scoring_predictor.predict_section_score(features, section_type)
                
                predicted_score = prediction.predicted_score
                confidence = prediction.prediction_confidence
                
                # Determine priority based on score
                if predicted_score < 70:
                    priority = "critical"
                    title = f"Low Predicted Score for {section_type.value.replace('_', ' ').title()}"
                elif predicted_score < 80:
                    priority = "high"
                    title = f"Moderate Score Predicted for {section_type.value.replace('_', ' ').title()}"
                else:
                    priority = "medium"
                    title = f"Good Score Predicted for {section_type.value.replace('_', ' ').title()}"
                
                # Calculate improvement potential
                target_score = min(100, predicted_score + 15)
                improvement_potential = target_score - predicted_score
                
                return DocumentIntelligenceInsight(
                    section_type=section_type,
                    insight_type="score_prediction",
                    title=title,
                    description=f"Current content is predicted to score {predicted_score:.1f}/100 with {confidence:.1%} confidence",
                    priority=priority,
                    current_score=predicted_score,
                    target_score=target_score,
                    improvement_potential=improvement_potential,
                    specific_actions=prediction.improvement_suggestions[:3],
                    implementation_effort="moderate",
                    expected_impact=f"Could improve score by {improvement_potential:.1f} points",
                    confidence=confidence,
                    expires_timestamp=datetime.now() + timedelta(hours=2)
                )
            
        except Exception:
            # Don't fail the entire analysis if scoring prediction fails
            pass
        
        return None
    
    async def _generate_content_insights(self, section_type: ProposalSection,
                                         content: str, requirements: Optional[List[str]]) -> List[DocumentIntelligenceInsight]:
        """Generate content improvement insights"""
        
        insights = []
        
        try:
            # Analyze content with recommender
            content_report = await self.content_recommender.analyze_content(
                content, section_type, requirements
            )
            
            # Convert critical issues to insights
            for issue in content_report.critical_issues:
                insight = DocumentIntelligenceInsight(
                    section_type=section_type,
                    insight_type="critical_issue",
                    title=f"Critical Issue: {issue.description[:50]}...",
                    description=issue.description,
                    priority="critical",
                    specific_actions=[issue.recommended_action],
                    implementation_effort="significant",
                    expected_impact=issue.impact,
                    content_location=issue.location,
                    confidence=0.9,
                    expires_timestamp=datetime.now() + timedelta(hours=24)
                )
                insights.append(insight)
            
            # Convert top improvement suggestions to insights
            for suggestion in content_report.improvement_suggestions[:3]:
                insight = DocumentIntelligenceInsight(
                    section_type=section_type,
                    insight_type="improvement_suggestion",
                    title=suggestion.title,
                    description=suggestion.description,
                    priority=suggestion.priority,
                    specific_actions=suggestion.specific_actions[:3],
                    implementation_effort=suggestion.implementation_effort,
                    expected_impact=suggestion.expected_impact,
                    confidence=0.8,
                    expires_timestamp=datetime.now() + timedelta(hours=12)
                )
                insights.append(insight)
            
            # Add quick wins as high-priority insights
            for quick_win in content_report.quick_wins[:2]:
                insight = DocumentIntelligenceInsight(
                    section_type=section_type,
                    insight_type="quick_win",
                    title=f"Quick Win: {quick_win[:30]}...",
                    description=quick_win,
                    priority="high",
                    specific_actions=[quick_win],
                    implementation_effort="minimal",
                    expected_impact="Immediate improvement with minimal effort",
                    confidence=0.85,
                    expires_timestamp=datetime.now() + timedelta(hours=6)
                )
                insights.append(insight)
            
        except Exception:
            # Don't fail if content analysis fails
            pass
        
        return insights
    
    async def _generate_competitive_insights(self, section_type: ProposalSection,
                                             content: str, proposal_id: str) -> List[DocumentIntelligenceInsight]:
        """Generate competitive positioning insights"""
        
        insights = []
        
        # Analyze competitive positioning (simplified)
        competitive_keywords = ['competitive advantage', 'unique', 'differentiation', 'superior']
        content_lower = content.lower()
        
        competitive_mentions = sum(1 for keyword in competitive_keywords if keyword in content_lower)
        
        if competitive_mentions == 0:
            insight = DocumentIntelligenceInsight(
                section_type=section_type,
                insight_type="competitive_positioning",
                title="Missing Competitive Differentiation",
                description="Content lacks clear competitive differentiation and unique value propositions",
                priority="high",
                specific_actions=[
                    "Add unique capabilities and differentiators",
                    "Highlight competitive advantages",
                    "Include comparative benefits"
                ],
                implementation_effort="moderate",
                expected_impact="Strengthens competitive positioning",
                confidence=0.7,
                expires_timestamp=datetime.now() + timedelta(hours=8)
            )
            insights.append(insight)
        
        return insights
    
    async def _generate_initial_insights(self, session: DocumentIntelligenceSession,
                                         opportunity_intelligence: OpportunityIntelligence) -> List[DocumentIntelligenceInsight]:
        """Generate initial strategic insights for the session"""
        
        insights = []
        
        # Strategic recommendation insight
        if opportunity_intelligence.strategic_recommendation:
            strategic_rec = opportunity_intelligence.strategic_recommendation
            
            insight = DocumentIntelligenceInsight(
                section_type=ProposalSection.TECHNICAL_APPROACH,  # Apply to technical approach by default
                insight_type="strategic_recommendation",
                title=f"Strategic Recommendation: {strategic_rec.recommendation_type.value.upper()}",
                description=strategic_rec.primary_rationale,
                priority="critical",
                specific_actions=strategic_rec.key_factors_supporting[:3],
                implementation_effort="significant",
                expected_impact="Aligns proposal with strategic intelligence",
                confidence=strategic_rec.confidence_level,
                expires_timestamp=datetime.now() + timedelta(days=1)
            )
            insights.append(insight)
        
        # Win probability insight
        if opportunity_intelligence.win_probability_analysis:
            win_analysis = opportunity_intelligence.win_probability_analysis
            
            if win_analysis.predicted_win_probability < 0.5:
                priority = "critical"
                title = "Low Win Probability - Critical Issues"
            elif win_analysis.predicted_win_probability < 0.7:
                priority = "high"
                title = "Moderate Win Probability - Improvements Needed"
            else:
                priority = "medium"
                title = "Good Win Probability - Maintain Strengths"
            
            insight = DocumentIntelligenceInsight(
                section_type=ProposalSection.TECHNICAL_APPROACH,
                insight_type="win_probability",
                title=title,
                description=f"Predicted win probability: {win_analysis.predicted_win_probability:.1%}",
                priority=priority,
                specific_actions=win_analysis.improvement_recommendations[:3],
                implementation_effort="moderate",
                expected_impact="Addresses factors affecting win probability",
                confidence=win_analysis.prediction_confidence,
                expires_timestamp=datetime.now() + timedelta(days=1)
            )
            insights.append(insight)
        
        return insights
    
    def _extract_section_features_from_content(self, content: str, 
                                               requirements: Optional[List[str]]) -> SectionFeatures:
        """Extract section features from content for scoring prediction"""
        
        words = content.split()
        word_count = len(words)
        
        # Simple feature extraction (would be enhanced with NLP)
        unique_concepts = len(set(word.lower() for word in words if len(word) > 4))
        
        # Technical depth assessment
        technical_terms = ['methodology', 'approach', 'framework', 'implementation', 'process']
        technical_count = sum(1 for term in technical_terms if term in content.lower())
        technical_depth = min(1.0, technical_count / 10)
        
        # Clarity assessment (simplified)
        avg_sentence_length = word_count / max(1, content.count('.'))
        clarity = max(0.0, min(1.0, 1.0 - abs(avg_sentence_length - 20) / 20))
        
        # Requirements coverage
        if requirements:
            coverage_count = sum(1 for req in requirements if req.lower() in content.lower())
            coverage_ratio = coverage_count / len(requirements)
        else:
            coverage_ratio = 0.8  # Default
        
        # Evidence assessment
        evidence_terms = ['demonstrated', 'proven', 'example', 'case study', 'successful']
        evidence_count = sum(1 for term in evidence_terms if term in content.lower())
        
        return SectionFeatures(
            word_count=word_count,
            unique_concepts_count=unique_concepts,
            technical_depth_score=technical_depth,
            clarity_score=clarity,
            requirement_coverage_ratio=coverage_ratio,
            compliance_score=0.8,  # Default
            quantitative_evidence_count=evidence_count,
            case_study_relevance=0.6,  # Default
            reference_quality_score=0.7,  # Default
            team_expertise_match=0.7,  # Default
            past_performance_relevance=0.6,  # Default
			innovation_score=0.5,  # Default
			differentiation_strength=0.6,  # Default
			risk_identification_completeness=0.7,  # Default
			mitigation_strategy_quality=0.6,  # Default
			section_completion_percentage=min(1.0, word_count / 1500)  # Assume 1500 words is complete
		)
	
    async def mark_insight_implemented(self, session_id: str, insight_id: str) -> bool:
        """
        Mark an insight as implemented
        
        Args:
            session_id: Session identifier
            insight_id: Insight identifier
            
        Returns:
            True if insight was found and marked as implemented
        """
        if session_id not in self.active_sessions:
            return False
        
        session = self.active_sessions[session_id]
        
        # Find and move insight from active to resolved
        for i, insight in enumerate(session.active_insights):
            if insight.insight_id == insight_id:
                resolved_insight = session.active_insights.pop(i)
                session.resolved_insights.append(resolved_insight)
                session.insights_implemented += 1
                
                # Add score improvement if available
                if resolved_insight.improvement_potential:
                    session.estimated_score_improvement += resolved_insight.improvement_potential
                
                self._log_insight_implemented(session_id, insight_id)
                return True
        
        return False
    
    async def update_document_state(self, session_id: str, new_state: DocumentState) -> bool:
        """
        Update document development state
        
        Args:
            session_id: Session identifier
            new_state: New document state
            
        Returns:
            True if state was updated successfully
        """
        if session_id not in self.active_sessions:
            return False
        
        session = self.active_sessions[session_id]
        old_state = session.document_state
        session.document_state = new_state
        session.last_update = datetime.now()
        
        # Update session duration
        session.session_duration_minutes = (
            (datetime.now() - session.session_start).total_seconds() / 60
        )
        
        self._log_state_update(session_id, old_state, new_state)
        
        return True
    
    async def end_intelligence_session(self, session_id: str) -> DocumentIntelligenceSession:
        """
        End an intelligence session and return final statistics
        
        Args:
            session_id: Session identifier
            
        Returns:
            Final session data with statistics
        """
        if session_id not in self.active_sessions:
            raise ValueError(f"No active session found for {session_id}")
        
        session = self.active_sessions[session_id]
        
        # Finalize session
        session.document_state = DocumentState.COMPLETE
        session.last_update = datetime.now()
        session.session_duration_minutes = (
            (datetime.now() - session.session_start).total_seconds() / 60
        )
        
        # Move to history
        self.session_history.append(session)
        del self.active_sessions[session_id]
        
        self._log_session_end(session_id, session.insights_implemented, session.estimated_score_improvement)
        
        return session
    
    def get_session_insights(self, session_id: str, 
                             priority_filter: Optional[str] = None,
                             section_filter: Optional[ProposalSection] = None) -> List[DocumentIntelligenceInsight]:
        """
        Get insights for a session with optional filtering
        
        Args:
            session_id: Session identifier
            priority_filter: Optional priority filter
            section_filter: Optional section filter
            
        Returns:
            Filtered list of insights
        """
        if session_id not in self.active_sessions:
            return []
        
        session = self.active_sessions[session_id]
        insights = session.active_insights.copy()
        
        # Apply filters
        if priority_filter:
            insights = [insight for insight in insights if insight.priority == priority_filter]
        
        if section_filter:
            insights = [insight for insight in insights if insight.section_type == section_filter]
        
        # Sort by priority and timestamp
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        insights.sort(key=lambda x: (priority_order.get(x.priority, 4), x.created_timestamp), reverse=True)
        
        return insights
    
    def get_service_statistics(self) -> Dict[str, Any]:
        """Get service performance and usage statistics"""
        
        active_session_count = len(self.active_sessions)
        total_session_count = len(self.session_history) + active_session_count
        
        stats = {
            "active_sessions": active_session_count,
            "total_sessions": total_session_count,
            "total_analyses": self.total_analyses,
            "total_insights_generated": self.total_insights_generated,
            "average_response_time_seconds": self.average_response_time,
            "insights_per_analysis": self.total_insights_generated / max(self.total_analyses, 1)
        }
        
        # Session statistics
        if self.session_history:
            session_durations = [session.session_duration_minutes for session in self.session_history]
            insights_implemented = [session.insights_implemented for session in self.session_history]
            score_improvements = [session.estimated_score_improvement for session in self.session_history]
            
            stats.update({
                "average_session_duration_minutes": sum(session_durations) / len(session_durations),
                "average_insights_per_session": sum(insights_implemented) / len(insights_implemented),
                "average_score_improvement": sum(score_improvements) / len(score_improvements),
                "implementation_rate": sum(insights_implemented) / max(sum(session.total_insights_generated for session in self.session_history), 1)
            })
        
        return stats
    
    # Logging methods
    
    def _log_initialization(self):
        print("IntelligenceDocumentService: Initialized for real-time document intelligence")
    
    def _log_session_start(self, session_id: str, proposal_id: str, mode: IntegrationMode):
        print(f"IntelligenceDocumentService: Started session {session_id} for proposal {proposal_id} in {mode.value} mode")
    
    def _log_session_error(self, message: str):
        print(f"IntelligenceDocumentService Session Error: {message}")
    
    def _log_analysis_start(self, session_id: str, section_type: ProposalSection):
        print(f"IntelligenceDocumentService: Analyzing {section_type.value} for session {session_id}")
    
    def _log_analysis_complete(self, session_id: str, section_type: ProposalSection, insight_count: int, duration: float):
        print(f"IntelligenceDocumentService: Generated {insight_count} insights for {section_type.value} in {duration:.2f}s")
    
    def _log_analysis_error(self, message: str):
        print(f"IntelligenceDocumentService Analysis Error: {message}")
    
    def _log_insight_implemented(self, session_id: str, insight_id: str):
        print(f"IntelligenceDocumentService: Insight {insight_id} implemented in session {session_id}")
    
    def _log_state_update(self, session_id: str, old_state: DocumentState, new_state: DocumentState):
        print(f"IntelligenceDocumentService: Session {session_id} state changed from {old_state.value} to {new_state.value}")
    
    def _log_session_end(self, session_id: str, insights_implemented: int, score_improvement: float):
        print(f"IntelligenceDocumentService: Ended session {session_id} - {insights_implemented} insights implemented, {score_improvement:.1f} estimated score improvement")


# Example usage and testing
async def create_sample_document_intelligence():
    """Create sample document intelligence session for testing"""
    
    # Initialize service
    service = IntelligenceDocumentService()
    
    # Start intelligence session
    session_id = await service.start_intelligence_session("test_proposal_001")
    
    # Sample section content
    sample_content = """
    Our technical approach leverages proven methodologies and industry best practices to deliver 
    comprehensive solutions. We will implement an agile development framework that ensures quality 
    deliverables on schedule. The team has successfully delivered similar projects.
    
    Our methodology includes requirements analysis, system design, development, testing, and deployment.
    Quality assurance will be maintained throughout the project lifecycle. We have demonstrated 
    expertise in similar implementations with measurable improvements in efficiency.
    """
    
    # Sample requirements
    requirements = [
        "Must include detailed technical methodology",
        "Shall provide risk management approach",
        "Must demonstrate relevant experience"
    ]
    
    # Analyze section content
    insights = await service.analyze_section_content(
        session_id, ProposalSection.TECHNICAL_APPROACH, sample_content, requirements
    )
    
    # Update document state
    await service.update_document_state(session_id, DocumentState.DRAFTING)
    
    # Mark one insight as implemented
    if insights:
        await service.mark_insight_implemented(session_id, insights[0].insight_id)
    
    # Get session statistics
    session_insights = service.get_session_insights(session_id)
    service_stats = service.get_service_statistics()
    
    # End session
    final_session = await service.end_intelligence_session(session_id)
    
    return {
        "insights": insights,
        "session_insights": session_insights,
        "service_stats": service_stats,
        "final_session": final_session
    }


if __name__ == "__main__":
    # Test the document intelligence integration
    import asyncio
    
    async def main():
        results = await create_sample_document_intelligence()
        
        print("Document Intelligence Integration Test:")
        print("=" * 50)
        
        print(f"\nGenerated Insights ({len(results['insights'])}):")
        for insight in results['insights'][:3]:
            print(f"  🔍 {insight.title} ({insight.priority} priority)")
            print(f"     {insight.description}")
            if insight.specific_actions:
                print(f"     Action: {insight.specific_actions[0]}")
        
        print(f"\nService Statistics:")
        stats = results['service_stats']
        print(f"  Total Analyses: {stats['total_analyses']}")
        print(f"  Total Insights: {stats['total_insights_generated']}")
        print(f"  Average Response Time: {stats['average_response_time_seconds']:.2f}s")
        print(f"  Insights per Analysis: {stats['insights_per_analysis']:.1f}")
        
        print(f"\nFinal Session:")
        session = results['final_session']
        print(f"  Duration: {session.session_duration_minutes:.1f} minutes")
        print(f"  Insights Generated: {session.total_insights_generated}")
        print(f"  Insights Implemented: {session.insights_implemented}")
        print(f"  Estimated Score Improvement: {session.estimated_score_improvement:.1f} points")
    
    asyncio.run(main())