"""
TenderSourceMax - Automated Tender Acquisition System
=====================================================

A comprehensive, automated tender/RFP acquisition system that scrapes
free public sources to provide timely, high-quality opportunity data
for Africa and the Global South.

Principle: No paid API subscriptions - beat commercial aggregators
by accessing primary sources directly.

Architecture:
	Scrapers (Python) -> Processor (Transform) -> DocFusion API (Import)
		|                    |                        |
		v                    v                        v
	Source DBs           Dedup DB              Opportunities
	(JSON/YAML)          (SQLite)               (PostgreSQL)

Modules:
	- scrapers: Individual source scrapers (UNGM, AfDB, government portals)
	- models: Data models for scraped opportunities
	- pipeline: Data transformation, categorization, deduplication
	- scheduler: Job orchestration and scheduling
	- monitoring: Health checks and alerting
	- sources: Source registry and configuration

Usage:
	from backend.discovery import run_scraper, sync_to_docfusion

	# Run single scraper
	opportunities = await run_scraper("ungm")

	# Run full pipeline
	await sync_to_docfusion(opportunities)

Author: DocFusion Team
Date: February 2026
"""

# Models
from backend.discovery.models.opportunity import (
	ScrapedOpportunity,
	OpportunityType,
	SourceType,
)

# Scrapers
from backend.discovery.scrapers.base import BaseScraper
from backend.discovery.models.opportunity import ScraperResult

# Pipeline
from backend.discovery.pipeline.transformer import OpportunityTransformer
from backend.discovery.pipeline.categorizer import OpportunityCategorizer, OpportunityCategory
from backend.discovery.pipeline.deduplicator import Deduplicator
from backend.discovery.pipeline.docfusion_sync import (
	DocFusionSync,
	sync_opportunities,
	export_opportunities,
)

# Scheduler
from backend.discovery.scheduler.orchestrator import (
	ScrapingOrchestrator,
	run_all_sources,
	run_tier,
	run_source,
)

# Monitoring
from backend.discovery.monitoring.health import (
	HealthChecker,
	HealthStatus,
	check_source_health,
	get_system_health,
)

__version__ = "1.0.0"
__all__ = [
	# Models
	"ScrapedOpportunity",
	"OpportunityType",
	"SourceType",
	# Scrapers
	"BaseScraper",
	"ScraperResult",
	# Pipeline
	"OpportunityTransformer",
	"OpportunityCategorizer",
	"OpportunityCategory",
	"Deduplicator",
	"DocFusionSync",
	"sync_opportunities",
	"export_opportunities",
	# Scheduler
	"ScrapingOrchestrator",
	"run_all_sources",
	"run_tier",
	"run_source",
	# Monitoring
	"HealthChecker",
	"HealthStatus",
	"check_source_health",
	"get_system_health",
]
