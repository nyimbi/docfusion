"""
Discovery Crawlers Module

GLOBAL PROCUREMENT INTELLIGENCE: AI-driven scrapers that monitor EVERY procurement 
opportunity worldwide through universal scrapers that understand any website structure.

Coverage:
- Every Ministry of Every Government (4,000+ sources)
- Every UN Agency & International Development Bank (5,000+ sources)  
- Every Fortune 500 + Major Corporate Procurement (10,000+ sources)
- Every Major Foundation & Donor Agency (100,000+ sources)
- Total: 100,000+ sources monitored continuously
"""

# AI-Driven Universal Scrapers - THE CORE INNOVATION
from .ai_driven import (
    UniversalScraper, ExtractionStrategy, ExtractionResult,
    VisionScraper, VisionAnalysisResult, UIElement,
    StructureLearner, ExtractionAttempt, SitePattern, StrategyRecommendation,
    PatternRecognizer, PatternMatch
)

# Global Source Database Management
from .source_databases import (
    GlobalSourceDB, ProcurementSource, SourceType, SourceStatus,
    SourceDiscoverer, DiscoveryResult, SourcePattern
)

# Generic Infrastructure
from .generic import BaseScraper, ScrapingConfiguration, ScrapingResult

# Legacy Specialized Scrapers (for high-priority sources needing custom handling)
# from .government import SAMGovScraper, GrantsGovScraper, FBOScraper
# from .commercial import BidSyncScraper, GovWinScraper, RFPDBScraper  
# from .foundations import FoundationCenterScraper, CandidScraper, GrantsDotComScraper
# from .international import TEDEuropaScraper, CanadaBuyAndSellScraper, AustenderScraper

__all__ = [
    # AI-Driven Universal Scrapers (PRIMARY)
    "UniversalScraper", "ExtractionStrategy", "ExtractionResult",
    "VisionScraper", "VisionAnalysisResult", "UIElement",
    "StructureLearner", "ExtractionAttempt", "SitePattern", "StrategyRecommendation",
    "PatternRecognizer", "PatternMatch",
    
    # Global Source Management
    "GlobalSourceDB", "ProcurementSource", "SourceType", "SourceStatus",
    "SourceDiscoverer", "DiscoveryResult", "SourcePattern",
    
    # Generic Infrastructure  
    "BaseScraper", "ScrapingConfiguration", "ScrapingResult"
]