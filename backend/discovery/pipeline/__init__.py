"""
Discovery Pipeline Components
=============================

Processing pipeline for transforming, categorizing, deduplicating,
and syncing scraped opportunities to DocFusion.

Modules:
	- transformer: Data normalization and field mapping
	- categorizer: AI-powered category detection
	- deduplicator: Fingerprint-based duplicate detection
	- docfusion_sync: Sync to DocFusion frontend database

Pipeline Flow:
	Scraper Output → Transformer → Categorizer → Deduplicator → DocFusion Sync
"""

from backend.discovery.pipeline.transformer import OpportunityTransformer
from backend.discovery.pipeline.categorizer import OpportunityCategorizer
from backend.discovery.pipeline.deduplicator import Deduplicator
from backend.discovery.pipeline.docfusion_sync import DocFusionSync

__all__ = [
	"OpportunityTransformer",
	"OpportunityCategorizer",
	"Deduplicator",
	"DocFusionSync",
]
