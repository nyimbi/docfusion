"""
Intelligence Integrations Module

Integration services that connect the intelligence engine with other system components
including discovery, storage, and document generation for comprehensive proposal
development intelligence.
"""

from .discovery_integration import IntelligenceDiscoveryService
from .storage_integration import IntelligenceStorageService
from .document_integration import IntelligenceDocumentService

__all__ = [
    "IntelligenceDiscoveryService",
    "IntelligenceStorageService",
    "IntelligenceDocumentService",
]