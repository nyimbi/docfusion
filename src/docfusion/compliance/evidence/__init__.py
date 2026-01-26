"""
Compliance Evidence Package

Provides comprehensive evidence management for compliance purposes including:
- Evidence collection and organization
- Evidence validity and expiration tracking  
- Evidence linking to compliance requirements
- Evidence quality assessment and scoring
- Evidence backup, archival, and retrieval
"""

from .evidence_manager import (
    EvidenceManager,
    EvidenceRecord,
    EvidenceType,
    EvidenceStatus,
    EvidenceSource,
    EvidenceQuality,
    EvidenceLink,
    EvidenceQualityMetrics,
    EvidenceSearchCriteria
)

__all__ = [
    "EvidenceManager",
    "EvidenceRecord",
    "EvidenceType", 
    "EvidenceStatus",
    "EvidenceSource",
    "EvidenceQuality",
    "EvidenceLink",
    "EvidenceQualityMetrics",
    "EvidenceSearchCriteria"
]