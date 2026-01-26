"""
Global Source Database Management

Comprehensive databases of all procurement sources worldwide.
Automatically discovers and catalogs new sources using AI.
"""

# Source databases and discovery
from .global_source_db import GlobalSourceDB, ProcurementSource, SourceType, SourceStatus
from .source_discoverer import SourceDiscoverer, DiscoveryResult, SourcePattern

__all__ = [
    "GlobalSourceDB", "ProcurementSource", "SourceType", "SourceStatus",
    "SourceDiscoverer", "DiscoveryResult", "SourcePattern"
]