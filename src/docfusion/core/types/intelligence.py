"""
Shared Intelligence Types

Canonical definitions of intelligence types used across the platform.
Core types must NOT depend on higher-level modules at import time.
"""

from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
	from docfusion.intelligence.integrations.discovery_integration import (
		OpportunityIntelligence,
	)


class IntelligenceLevel(str, Enum):
	"""Levels of intelligence analysis that can be performed on an opportunity."""

	BASIC = "basic"
	ENHANCED = "enhanced"
	COMPREHENSIVE = "comprehensive"
	STRATEGIC = "strategic"


def __getattr__(name: str):
	"""Lazy runtime import for higher-level types to avoid circular deps."""
	if name == "OpportunityIntelligence":
		from docfusion.intelligence.integrations.discovery_integration import (
			OpportunityIntelligence,
		)
		return OpportunityIntelligence
	raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
	"IntelligenceLevel",
	"OpportunityIntelligence",
]
