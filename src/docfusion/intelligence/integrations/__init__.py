"""
Intelligence Integrations Module

Integration services that connect the intelligence engine with other system components
including discovery, storage, and document generation for comprehensive proposal
development intelligence.
"""

# from .discovery_integration import IntelligenceDiscoveryService  # Disabled due to dependencies
try:
    from .storage_integration import IntelligenceStorageService
    STORAGE_AVAILABLE = True
except ImportError:
    IntelligenceStorageService = None
    STORAGE_AVAILABLE = False

try:
    from .document_integration import IntelligenceDocumentService
    DOCUMENT_AVAILABLE = True
except ImportError:
    IntelligenceDocumentService = None
    DOCUMENT_AVAILABLE = False

__all__ = [
    # "IntelligenceDiscoveryService",  # Disabled
    *(["IntelligenceStorageService"] if STORAGE_AVAILABLE else []),
    *(["IntelligenceDocumentService"] if DOCUMENT_AVAILABLE else [])
]