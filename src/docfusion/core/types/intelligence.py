"""
Shared Intelligence Types (lazy re-exports)

Convenience re-exports of intelligence types that are used by multiple modules.
Importing from here (rather than deep into the intelligence package) provides
a stable, shallow import path and guards against future circular dependencies.

These types originate in intelligence.integrations.discovery_integration but
are needed by sibling integration modules (storage, document) and potentially
by other top-level packages.

IMPORTANT: Core types must NOT depend on higher-level modules at import time.
We use TYPE_CHECKING for type-checking and lazy imports at runtime to preserve
the dependency direction (core <- integration, not core -> integration).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
	from docfusion.intelligence.integrations.discovery_integration import (
		IntelligenceLevel as IntelligenceLevel,
		OpportunityIntelligence as OpportunityIntelligence,
	)


def __getattr__(name: str):
	"""Lazy runtime import to avoid circular dependency at module load time."""
	if name == "IntelligenceLevel":
		from docfusion.intelligence.integrations.discovery_integration import (
			IntelligenceLevel,
		)
		return IntelligenceLevel
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