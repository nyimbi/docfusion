"""
Discovery Scheduler
===================

Job scheduling and orchestration for tender scraping.

Components:
	- config: Schedule configuration loader
	- orchestrator: Main scraping orchestrator
	- scraper_runner: Standalone scraper runner with database tracking
	- jobs: Individual job definitions

Scheduling Tiers:
	- Tier 1: High-priority sources (every 6 hours)
	- Tier 2: Medium-priority sources (every 12 hours)
	- Tier 3: Lower-priority sources (daily)
"""

from backend.discovery.scheduler.orchestrator import (
	ScrapingOrchestrator,
	run_all_sources,
	run_tier,
	run_source,
)
from backend.discovery.scheduler.scraper_runner import (
	ScraperRunner,
	RunnerResult,
	SourceRunResult,
	compute_fingerprint,
	compute_fingerprint_from_opportunity,
)

__all__ = [
	# Orchestrator
	"ScrapingOrchestrator",
	"run_all_sources",
	"run_tier",
	"run_source",
	# Scraper Runner
	"ScraperRunner",
	"RunnerResult",
	"SourceRunResult",
	"compute_fingerprint",
	"compute_fingerprint_from_opportunity",
]
