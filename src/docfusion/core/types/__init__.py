"""
Core Shared Types

Types that are referenced by multiple top-level modules (e.g. discovery,
intelligence, storage). Placing them here prevents circular imports between
those modules.
"""

from .intelligence import IntelligenceLevel, OpportunityIntelligence

__all__ = [
	"IntelligenceLevel",
	"OpportunityIntelligence",
]
