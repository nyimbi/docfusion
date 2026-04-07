"""
Intelligence Predictors Module

Win probability modeling and prediction components.
Uses machine learning for strategic outcome prediction.
"""

# Prediction models
from .win_probability_predictor import (
	WinProbabilityPredictor,
	PredictionFeatures,
	PredictionResult,
	ModelPerformanceMetrics,
	HistoricalOpportunity,
)
from .scoring_predictor import (
	ScoringPredictor,
	SectionFeatures,
	SectionScorePrediction,
	SectionModelMetrics,
	HistoricalSectionScore,
	ProposalSection,
)
from .historical_data_store import (
	HistoricalDataStore,
	HistoricalRFPResult,
	TrainingExample,
	DataQualityMetrics,
	RFPStatus,
)
from .feature_engineer import (
	FeatureEngineer,
	EngineeredFeatures,
)
from .model_persistence import (
	ModelPersistence,
	ModelMetadata,
	ModelType,
	ModelStatus,
)
from .explainer import (
	PredictionExplainer,
	FeatureContribution,
	PredictionExplanation,
	ExplainerConfig,
)

__all__ = [
	# Win probability predictor
	"WinProbabilityPredictor",
	"PredictionFeatures",
	"PredictionResult",
	"ModelPerformanceMetrics",
	"HistoricalOpportunity",
	# Scoring predictor
	"ScoringPredictor",
	"SectionFeatures",
	"SectionScorePrediction",
	"SectionModelMetrics",
	"HistoricalSectionScore",
	"ProposalSection",
	# Historical data store
	"HistoricalDataStore",
	"HistoricalRFPResult",
	"TrainingExample",
	"DataQualityMetrics",
	"RFPStatus",
	# Feature engineer
	"FeatureEngineer",
	"EngineeredFeatures",
	# Model persistence
	"ModelPersistence",
	"ModelMetadata",
	"ModelType",
	"ModelStatus",
	# Explainer
	"PredictionExplainer",
	"FeatureContribution",
	"PredictionExplanation",
	"ExplainerConfig",
]