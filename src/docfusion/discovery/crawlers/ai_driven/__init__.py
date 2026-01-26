"""
AI-Driven Universal Scraper Module

Intelligent scrapers that can understand and adapt to any website structure.
Uses computer vision, NLP, and machine learning to automatically extract
opportunity data from any government, corporate, or institutional portal.
"""

# Universal AI scrapers
from .universal_scraper import UniversalScraper, ExtractionStrategy, ExtractionResult
from .vision_scraper import VisionScraper, VisionAnalysisResult, UIElement
from .structure_learner import StructureLearner, ExtractionAttempt, SitePattern, StrategyRecommendation
from .pattern_recognizer import PatternRecognizer, PatternMatch

__all__ = [
    "UniversalScraper", "ExtractionStrategy", "ExtractionResult",
    "VisionScraper", "VisionAnalysisResult", "UIElement", 
    "StructureLearner", "ExtractionAttempt", "SitePattern", "StrategyRecommendation",
    "PatternRecognizer", "PatternMatch"
]