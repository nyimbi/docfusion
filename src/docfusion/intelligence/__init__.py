"""
Intelligence Engine Module

The comprehensive AI-powered intelligence engine for proposal development,
providing predictive analytics, strategic recommendations, content optimization,
competitive intelligence, and deadline intelligence to maximize proposal win rates.

Week 11 Implementation: Intelligence Engine Development
"""

import logging
from importlib import import_module

logger = logging.getLogger(__name__)

_EXPORTS = {
    # Predictive Analytics
    "WinProbabilityPredictor": ".predictors.win_probability_predictor",
    "PredictionFeatures": ".predictors.win_probability_predictor",
    "PredictionResult": ".predictors.win_probability_predictor",
    "ModelPerformanceMetrics": ".predictors.win_probability_predictor",
    "HistoricalOpportunity": ".predictors.win_probability_predictor",
    "ScoringPredictor": ".predictors.scoring_predictor",
    "SectionFeatures": ".predictors.scoring_predictor",
    "SectionScorePrediction": ".predictors.scoring_predictor",
    "SectionModelMetrics": ".predictors.scoring_predictor",
    "HistoricalSectionScore": ".predictors.scoring_predictor",
    "ProposalSection": ".predictors.scoring_predictor",

    # Strategic Recommendations
    "StrategyRecommender": ".recommenders.strategy_recommender",
    "OpportunityContext": ".recommenders.strategy_recommender",
    "StrategicRecommendation": ".recommenders.strategy_recommender",
    "ResourceAllocation": ".recommenders.strategy_recommender",
    "RecommendationType": ".recommenders.strategy_recommender",
    "StrategicPriority": ".recommenders.strategy_recommender",
    "ContentRecommender": ".recommenders.content_recommender",
    "ContentRecommendationReport": ".recommenders.content_recommender",
    "ContentAnalysis": ".recommenders.content_recommender",
    "ContentSuggestion": ".recommenders.content_recommender",
    "ContentIssue": ".recommenders.content_recommender",
    "RecommendationCategory": ".recommenders.content_recommender",

    # Competitive Intelligence
    "CompetitiveAnalyzer": ".analyzers.competitive_analyzer",
    "CompetitiveAnalysis": ".analyzers.competitive_analyzer",
    "CompetitorProfile": ".analyzers.competitive_analyzer",
    "MarketIntelligence": ".analyzers.competitive_analyzer",
    "CompetitivePositioning": ".analyzers.competitive_analyzer",

    # Deadline Intelligence
    "DeadlineType": ".deadline_parser",
    "DeadlineStatus": ".deadline_parser",
    "DeadlinePriority": ".deadline_parser",
    "Deadline": ".deadline_parser",
    "Milestone": ".deadline_parser",
    "Timeline": ".deadline_parser",
    "DeadlineExtractionResult": ".deadline_parser",
    "DeadlineParser": ".deadline_parser",
    "CalendarProvider": ".calendar_integration",
    "ReminderType": ".calendar_integration",
    "EventStatus": ".calendar_integration",
    "CalendarEvent": ".calendar_integration",
    "Reminder": ".calendar_integration",
    "CalendarCredentials": ".calendar_integration",
    "CalendarIntegration": ".calendar_integration",

    # Integration Services
    "IntelligenceDiscoveryService": ".integrations.discovery_integration",
    "OpportunityIntelligence": ".integrations.discovery_integration",
    "IntelligenceLevel": ".integrations.discovery_integration",
    "IntelligenceStorageService": ".integrations.storage_integration",
    "StorageType": ".integrations.storage_integration",
    "DataType": ".integrations.storage_integration",
    "StorageMetadata": ".integrations.storage_integration",
    "IntelligenceDocumentService": ".integrations.document_integration",
    "DocumentIntelligenceInsight": ".integrations.document_integration",
    "DocumentIntelligenceSession": ".integrations.document_integration",
    "DocumentState": ".integrations.document_integration",
    "IntegrationMode": ".integrations.document_integration",
}


def __getattr__(name: str):
    """Load intelligence exports lazily to keep package import lightweight."""
    if name not in _EXPORTS:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    module = import_module(_EXPORTS[name], __name__)
    value = getattr(module, name)
    globals()[name] = value
    return value


def __dir__() -> list[str]:
    return sorted([*globals(), *_EXPORTS])

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
