"""
Intelligence Engine Module

The comprehensive AI-powered intelligence engine for proposal development,
providing predictive analytics, strategic recommendations, content optimization,
and competitive intelligence to maximize proposal win rates.

Week 11 Implementation: Intelligence Engine Development
"""

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

# Competitive Intelligence (optional - disabled due to dependency issues)
# try:
#     from .analyzers.competitive_analyzer import (
#         CompetitiveAnalyzer, CompetitiveAnalysis, CompetitorProfile,
#         MarketIntelligence, CompetitivePositioning
#     )
#     COMPETITIVE_ANALYZER_AVAILABLE = True
# except ImportError:
CompetitiveAnalyzer = None
CompetitiveAnalysis = None
CompetitorProfile = None
MarketIntelligence = None
CompetitivePositioning = None
COMPETITIVE_ANALYZER_AVAILABLE = False

# Integration Services
# from .integrations.discovery_integration import (
#     IntelligenceDiscoveryService, OpportunityIntelligence, IntelligenceLevel
# )  # Disabled due to discovery module dependency issues
try:
    from .integrations.storage_integration import (
        IntelligenceStorageService, StorageType, DataType, StorageMetadata
    )
    STORAGE_INTEGRATION_AVAILABLE = True
except ImportError:
    IntelligenceStorageService = None
    StorageType = None
    DataType = None
    StorageMetadata = None
    STORAGE_INTEGRATION_AVAILABLE = False

try:
    from .integrations.document_integration import (
        IntelligenceDocumentService, DocumentIntelligenceInsight, 
        DocumentIntelligenceSession, DocumentState, IntegrationMode
    )
    DOCUMENT_INTEGRATION_AVAILABLE = True
except ImportError:
    IntelligenceDocumentService = None
    DocumentIntelligenceInsight = None
    DocumentIntelligenceSession = None
    DocumentState = None
    IntegrationMode = None
    DOCUMENT_INTEGRATION_AVAILABLE = False

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
    
    # Competitive Intelligence (conditional)
    *(["CompetitiveAnalyzer", "CompetitiveAnalysis", "CompetitorProfile",
       "MarketIntelligence", "CompetitivePositioning"] if COMPETITIVE_ANALYZER_AVAILABLE else []),
    
    # Integration Services (conditional)
    # "IntelligenceDiscoveryService", "OpportunityIntelligence", "IntelligenceLevel",  # Disabled
    *(["IntelligenceStorageService", "StorageType", "DataType", "StorageMetadata"] if STORAGE_INTEGRATION_AVAILABLE else []),
    *(["IntelligenceDocumentService", "DocumentIntelligenceInsight", 
       "DocumentIntelligenceSession", "DocumentState", "IntegrationMode"] if DOCUMENT_INTEGRATION_AVAILABLE else [])
]

# Intelligence Engine Version
__version__ = "1.0.0"
__author__ = "Proposal Writer Team"

print("🧠 Intelligence Engine Module Loaded")
print("   Week 11: Intelligence Engine Development")
print("   Components: Predictive Analytics, Strategic Recommendations, Content Optimization")
print("   Integrations: Discovery, Storage, Document Generation")
print(f"   Version: {__version__}")