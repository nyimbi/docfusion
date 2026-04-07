"""
Intelligence Engine Module

The comprehensive AI-powered intelligence engine for proposal development,
providing predictive analytics, strategic recommendations, content optimization,
competitive intelligence, and deadline intelligence to maximize proposal win rates.

Week 11 Implementation: Intelligence Engine Development
"""

import logging

logger = logging.getLogger(__name__)

# Predictive Analytics
from .predictors.win_probability_predictor import (
    WinProbabilityPredictor, PredictionFeatures, PredictionResult,
    ModelPerformanceMetrics, HistoricalOpportunity
)
from .predictors.scoring_predictor import (
    ScoringPredictor, SectionFeatures, SectionScorePrediction,
    SectionModelMetrics, HistoricalSectionScore, ProposalSection
)

# Strategic Recommendations
from .recommenders.strategy_recommender import (
    StrategyRecommender, OpportunityContext, StrategicRecommendation,
    ResourceAllocation, RecommendationType, StrategicPriority
)
from .recommenders.content_recommender import (
    ContentRecommender, ContentRecommendationReport, ContentAnalysis,
    ContentSuggestion, ContentIssue, RecommendationCategory
)

# Competitive Intelligence
from .analyzers.competitive_analyzer import (
    CompetitiveAnalyzer, CompetitiveAnalysis, CompetitorProfile,
    MarketIntelligence, CompetitivePositioning
)

# Deadline Intelligence
from .deadline_parser import (
    DeadlineType, DeadlineStatus, DeadlinePriority,
    Deadline, Milestone, Timeline, DeadlineExtractionResult,
    DeadlineParser
)
from .calendar_integration import (
    CalendarProvider, ReminderType, EventStatus,
    CalendarEvent, Reminder, CalendarCredentials,
    CalendarIntegration
)

# Integration Services
from .integrations.discovery_integration import (
    IntelligenceDiscoveryService, OpportunityIntelligence, IntelligenceLevel
)
from .integrations.storage_integration import (
    IntelligenceStorageService, StorageType, DataType, StorageMetadata
)
from .integrations.document_integration import (
    IntelligenceDocumentService, DocumentIntelligenceInsight,
    DocumentIntelligenceSession, DocumentState, IntegrationMode
)

__all__ = [
    # Predictive Analytics
    "WinProbabilityPredictor", "PredictionFeatures", "PredictionResult",
    "ModelPerformanceMetrics", "HistoricalOpportunity",
    "ScoringPredictor", "SectionFeatures", "SectionScorePrediction",
    "SectionModelMetrics", "HistoricalSectionScore", "ProposalSection",

    # Strategic Recommendations
    "StrategyRecommender", "OpportunityContext", "StrategicRecommendation",
    "ResourceAllocation", "RecommendationType", "StrategicPriority",
    "ContentRecommender", "ContentRecommendationReport", "ContentAnalysis",
    "ContentSuggestion", "ContentIssue", "RecommendationCategory",

    # Competitive Intelligence
    "CompetitiveAnalyzer", "CompetitiveAnalysis", "CompetitorProfile",
    "MarketIntelligence", "CompetitivePositioning",

    # Deadline Intelligence
    "DeadlineType", "DeadlineStatus", "DeadlinePriority",
    "Deadline", "Milestone", "Timeline", "DeadlineExtractionResult",
    "DeadlineParser",
    "CalendarProvider", "ReminderType", "EventStatus",
    "CalendarEvent", "Reminder", "CalendarCredentials",
    "CalendarIntegration",

    # Integration Services
    "IntelligenceDiscoveryService", "OpportunityIntelligence", "IntelligenceLevel",
    "IntelligenceStorageService", "StorageType", "DataType", "StorageMetadata",
    "IntelligenceDocumentService", "DocumentIntelligenceInsight",
    "DocumentIntelligenceSession", "DocumentState", "IntegrationMode",
]

# Intelligence Engine Version
__version__ = "1.0.0"
__author__ = "Proposal Writer Team"

logger.debug("Intelligence Engine Module v%s loaded", __version__)