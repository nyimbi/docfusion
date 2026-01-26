"""
Intelligence Analyzers Module

Advanced intelligence analysis capabilities including competitive
landscape analysis, market intelligence, and strategic positioning.
"""

# Handle optional competitive analyzer with graceful fallback
try:
    from .competitive_analyzer import CompetitiveAnalyzer
    COMPETITIVE_ANALYZER_AVAILABLE = True
    __all__ = ["CompetitiveAnalyzer"]
except ImportError:
    CompetitiveAnalyzer = None
    COMPETITIVE_ANALYZER_AVAILABLE = False
    __all__ = []

# from .market_analyzer import MarketAnalyzer              # Future implementation
# from .win_loss_analyzer import WinLossAnalyzer          # Future implementation  
# from .differentiation_analyzer import DifferentiationAnalyzer  # Future implementation