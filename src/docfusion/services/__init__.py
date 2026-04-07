"""Service layer providing clean interfaces for agent consumption.

Agents should depend on the Protocol interfaces (IntelligenceServiceInterface,
DiscoveryServiceInterface) rather than importing concrete modules directly.
Use the Default* implementations for production wiring.
"""

from .intelligence_service import IntelligenceServiceInterface, DefaultIntelligenceService
from .discovery_service import DiscoveryServiceInterface, DefaultDiscoveryService

__all__ = [
	"IntelligenceServiceInterface",
	"DefaultIntelligenceService",
	"DiscoveryServiceInterface",
	"DefaultDiscoveryService",
]
