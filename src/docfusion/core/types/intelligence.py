"""
Shared Intelligence Types (re-exports)

Convenience re-exports of intelligence types that are used by multiple modules.
Importing from here (rather than deep into the intelligence package) provides
a stable, shallow import path and guards against future circular dependencies.

These types originate in intelligence.integrations.discovery_integration but
are needed by sibling integration modules (storage, document) and potentially
by other top-level packages.
"""

from __future__ import annotations

from docfusion.intelligence.integrations.discovery_integration import (
	IntelligenceLevel as IntelligenceLevel,
	OpportunityIntelligence as OpportunityIntelligence,
)

__all__ = [
	"IntelligenceLevel",
	"OpportunityIntelligence",
]
