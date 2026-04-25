"""
Core Shared Types

Types that are referenced by multiple top-level modules (e.g. discovery,
intelligence, storage). Placing them here prevents circular imports between
those modules.
"""

from .intelligence import IntelligenceLevel

# OpportunityIntelligence is available via lazy import in .intelligence
# to avoid circular dependency with intelligence.integrations.discovery_integration

__all__ = [
	"IntelligenceLevel",
	"OpportunityIntelligence",
]


def __getattr__(name: str):
	if name == "OpportunityIntelligence":
		from .intelligence import OpportunityIntelligence
		return OpportunityIntelligence
	raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
