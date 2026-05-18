"""Compatibility wrapper for the current intelligence service abstraction."""

from __future__ import annotations

from docfusion.services.intelligence_service import (
	DefaultIntelligenceService,
	IntelligenceServiceInterface,
)


class IntelligenceService(DefaultIntelligenceService):
	"""Backward-compatible name for legacy agent imports."""


__all__ = ["IntelligenceService", "DefaultIntelligenceService", "IntelligenceServiceInterface"]
