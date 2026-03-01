"""
Scraping Orchestrator
=====================

Main orchestration logic for running scrapers.

Responsibilities:
	- Load and instantiate scrapers dynamically
	- Manage concurrent execution
	- Coordinate pipeline processing
	- Track metrics and health
	- Handle errors and retries

Usage:
	# Run all sources
	python -m backend.discovery.scheduler.orchestrator --all

	# Run specific tier
	python -m backend.discovery.scheduler.orchestrator --tier tier1

	# Run single source
	python -m backend.discovery.scheduler.orchestrator --source ungm

Author: TenderSourceMax
"""

from __future__ import annotations

import asyncio
import importlib
import logging
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Type

from backend.discovery.models.opportunity import ScrapedOpportunity, SourceType, ScraperResult
from backend.discovery.scrapers.base import BaseScraper
from backend.discovery.pipeline.transformer import OpportunityTransformer
from backend.discovery.pipeline.categorizer import OpportunityCategorizer
from backend.discovery.pipeline.deduplicator import Deduplicator
from backend.discovery.pipeline.docfusion_sync import DocFusionSync
from backend.discovery.scheduler.config import (
	load_config,
	OrchestratorConfig,
	SourceConfig,
	get_sources_for_tier,
	get_enabled_sources,
)

logger = logging.getLogger(__name__)


# ============================================================================
# Orchestration Results
# ============================================================================

@dataclass
class SourceResult:
	"""Result of running a single source."""
	source_id: str
	source_name: str
	status: str = "pending"  # "success", "partial", "failed", "pending"
	opportunities_scraped: int = 0
	opportunities_unique: int = 0
	opportunities_synced: int = 0
	duration_seconds: float = 0.0
	error: str | None = None
	warnings: list[str] = field(default_factory=list)


@dataclass
class OrchestrationResult:
	"""Result of orchestration run."""
	run_id: str
	started_at: datetime
	completed_at: datetime | None = None
	status: str = "running"  # "running", "completed", "failed"

	# Counts
	sources_total: int = 0
	sources_success: int = 0
	sources_failed: int = 0
	opportunities_total: int = 0
	opportunities_unique: int = 0
	opportunities_synced: int = 0

	# Details
	source_results: list[SourceResult] = field(default_factory=list)
	errors: list[str] = field(default_factory=list)

	@property
	def duration_seconds(self) -> float:
		if self.completed_at:
			return (self.completed_at - self.started_at).total_seconds()
		return (datetime.utcnow() - self.started_at).total_seconds()


# ============================================================================
# Scraper Registry
# ============================================================================

# Map source IDs to scraper classes
SCRAPER_REGISTRY: dict[str, str] = {
	# MDB Scrapers
	"ungm": "backend.discovery.scrapers.ungm.UNGMScraper",
	"undp": "backend.discovery.scrapers.undp.UNDPScraper",
	"afdb": "backend.discovery.scrapers.afdb.AfDBScraper",
	"worldbank": "backend.discovery.scrapers.worldbank.WorldBankScraper",

	# African Government Portals
	"kenya_ppip": "backend.discovery.scrapers.africa.kenya.KenyaPPIPScraper",
	"sa_etenders": "backend.discovery.scrapers.africa.south_africa.SAeTendersScraper",
	"nigeria_bpp": "backend.discovery.scrapers.africa.nigeria.NigeriaBPPScraper",
	"rwanda": "backend.discovery.scrapers.africa.rwanda.RwandaRPPAScraper",
	"ghana": "backend.discovery.scrapers.africa.ghana.GHANEPSScraper",
	"tanzania": "backend.discovery.scrapers.africa.tanzania.TanzaniaPPRAScraper",
	"uganda": "backend.discovery.scrapers.africa.uganda.UgandaGPPScraper",
	"ethiopia": "backend.discovery.scrapers.africa.ethiopia.EthiopiaPPAScraper",

	# Regional Organizations
	"eac": "backend.discovery.scrapers.regional.eac.EACScraper",
	"sadc": "backend.discovery.scrapers.regional.sadc.SADCScraper",
	"ecowas": "backend.discovery.scrapers.regional.ecowas.ECOWASScraper",

	# Aggregators
	"ted": "backend.discovery.scrapers.ted.TEDScraper",
	"dgmarket": "backend.discovery.scrapers.dgmarket.DGMarketScraper",
}


def get_scraper_class(source_id: str) -> Type[BaseScraper] | None:
	"""
	Dynamically load and return scraper class for source.

	Args:
		source_id: Source identifier

	Returns:
		Scraper class or None if not found
	"""
	class_path = SCRAPER_REGISTRY.get(source_id)
	if not class_path:
		logger.warning(f"No scraper registered for source: {source_id}")
		return None

	try:
		module_path, class_name = class_path.rsplit(".", 1)
		module = importlib.import_module(module_path)
		return getattr(module, class_name)
	except (ImportError, AttributeError) as e:
		logger.error(f"Failed to load scraper for {source_id}: {e}")
		return None


# ============================================================================
# Scraping Orchestrator
# ============================================================================

class ScrapingOrchestrator:
	"""
	Main orchestrator for running tender scrapers.

	Coordinates:
		- Scraper instantiation and execution
		- Pipeline processing (transform, categorize, deduplicate)
		- DocFusion synchronization
		- Metrics and health tracking

	Usage:
		orchestrator = ScrapingOrchestrator()
		result = await orchestrator.run_tier("tier1")
	"""

	def __init__(
		self,
		config: OrchestratorConfig | None = None,
		config_path: str | Path | None = None,
	) -> None:
		"""
		Initialize orchestrator.

		Args:
			config: Pre-loaded configuration
			config_path: Path to configuration file
		"""
		self.config = config or load_config(config_path)

		# Initialize pipeline components
		self.transformer = OpportunityTransformer()
		self.categorizer = OpportunityCategorizer()
		self.deduplicator = Deduplicator(
			db_path=self.config.dedup_db_path,
			similarity_threshold=0.85,
		)

		# Semaphore for concurrency control
		self._semaphore = asyncio.Semaphore(self.config.max_concurrent_scrapers)

		# Run tracking
		self._current_run: OrchestrationResult | None = None

	async def run_all(self) -> OrchestrationResult:
		"""
		Run all enabled sources.

		Returns:
			OrchestrationResult with statistics
		"""
		sources = get_enabled_sources(self.config)
		return await self._run_sources(sources, "all")

	async def run_tier(self, tier: str) -> OrchestrationResult:
		"""
		Run all sources in a tier.

		Args:
			tier: Tier name (tier1, tier2, tier3)

		Returns:
			OrchestrationResult with statistics
		"""
		sources = get_sources_for_tier(self.config, tier)
		if not sources:
			logger.warning(f"No sources found for tier: {tier}")

		return await self._run_sources(sources, tier)

	async def run_source(self, source_id: str) -> OrchestrationResult:
		"""
		Run a single source.

		Args:
			source_id: Source identifier

		Returns:
			OrchestrationResult with statistics
		"""
		if source_id in self.config.sources:
			source = self.config.sources[source_id]
			return await self._run_sources([source], source_id)
		else:
			# Try to run even if not in config
			result = OrchestrationResult(
				run_id=f"manual_{source_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
				started_at=datetime.utcnow(),
				sources_total=1,
			)

			source_result = await self._run_single_source_by_id(source_id)
			result.source_results.append(source_result)

			if source_result.status == "success":
				result.sources_success = 1
			else:
				result.sources_failed = 1
				if source_result.error:
					result.errors.append(source_result.error)

			result.opportunities_total = source_result.opportunities_scraped
			result.opportunities_unique = source_result.opportunities_unique
			result.opportunities_synced = source_result.opportunities_synced
			result.completed_at = datetime.utcnow()
			result.status = "completed"

			return result

	async def _run_sources(
		self,
		sources: list[SourceConfig],
		run_name: str,
	) -> OrchestrationResult:
		"""
		Run multiple sources with concurrency control.

		Args:
			sources: List of source configurations
			run_name: Name for this run (for logging)

		Returns:
			OrchestrationResult
		"""
		run_id = f"{run_name}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

		result = OrchestrationResult(
			run_id=run_id,
			started_at=datetime.utcnow(),
			sources_total=len(sources),
		)

		self._current_run = result

		logger.info(f"Starting orchestration run: {run_id} ({len(sources)} sources)")

		# Create tasks for all sources
		tasks = [
			self._run_single_source(source)
			for source in sources
		]

		# Run with gathering (respects semaphore)
		source_results = await asyncio.gather(*tasks, return_exceptions=True)

		# Process results
		for i, source_result in enumerate(source_results):
			if isinstance(source_result, Exception):
				# Handle unexpected exceptions
				result.source_results.append(SourceResult(
					source_id=sources[i].id,
					source_name=sources[i].name,
					status="failed",
					error=str(source_result),
				))
				result.sources_failed += 1
				result.errors.append(f"{sources[i].id}: {source_result}")
			else:
				result.source_results.append(source_result)

				if source_result.status == "success":
					result.sources_success += 1
				elif source_result.status == "partial":
					result.sources_success += 1
				else:
					result.sources_failed += 1
					if source_result.error:
						result.errors.append(f"{source_result.source_id}: {source_result.error}")

				result.opportunities_total += source_result.opportunities_scraped
				result.opportunities_unique += source_result.opportunities_unique
				result.opportunities_synced += source_result.opportunities_synced

		result.completed_at = datetime.utcnow()
		result.status = "completed" if result.sources_failed == 0 else "partial"

		logger.info(
			f"Orchestration complete: {result.sources_success}/{result.sources_total} sources, "
			f"{result.opportunities_unique} unique opportunities in {result.duration_seconds:.1f}s"
		)

		self._current_run = None

		return result

	async def _run_single_source(
		self,
		source: SourceConfig,
	) -> SourceResult:
		"""
		Run a single source with semaphore control.

		Args:
			source: Source configuration

		Returns:
			SourceResult
		"""
		async with self._semaphore:
			return await self._run_single_source_by_id(
				source.id,
				timeout=source.timeout,
			)

	async def _run_single_source_by_id(
		self,
		source_id: str,
		timeout: int = 30,
	) -> SourceResult:
		"""
		Run a single source by ID.

		Args:
			source_id: Source identifier
			timeout: Request timeout

		Returns:
			SourceResult
		"""
		start_time = datetime.utcnow()
		result = SourceResult(
			source_id=source_id,
			source_name=source_id,
		)

		logger.info(f"Starting scraper: {source_id}")

		try:
			# Get scraper class
			scraper_class = get_scraper_class(source_id)
			if not scraper_class:
				result.status = "failed"
				result.error = f"No scraper found for source: {source_id}"
				return result

			# Instantiate and run scraper
			scraper = scraper_class()
			result.source_name = scraper.source_name

			scrape_result = await scraper.run()

			result.opportunities_scraped = scrape_result.count

			if scrape_result.metrics.status.value == "failed":
				result.status = "failed"
				result.error = "; ".join(scrape_result.metrics.errors) if scrape_result.metrics.errors else "Unknown error"
				return result

			# Process through pipeline
			opportunities = scrape_result.opportunities

			if opportunities:
				# Categorize opportunities without categories
				for opp in opportunities:
					if not opp.category:
						cat_result = self.categorizer.categorize(
							opp.description or "",
							opp.title,
						)
						opp.category = cat_result.primary_category.value

				# Deduplicate
				dedup_result = self.deduplicator.process_batch(
					opportunities,
					source_type=scraper.source_type,
				)

				result.opportunities_unique = len(dedup_result.unique)

				# Sync to DocFusion (export mode for now)
				if dedup_result.unique:
					sync = DocFusionSync()
					export_path = sync.export_for_import(dedup_result.unique)
					result.opportunities_synced = len(dedup_result.unique)
					logger.info(f"Exported {len(dedup_result.unique)} opportunities to {export_path}")

			result.status = "success"

		except asyncio.TimeoutError:
			result.status = "failed"
			result.error = f"Timeout after {timeout}s"
			logger.error(f"Source {source_id} timed out")

		except Exception as e:
			result.status = "failed"
			result.error = str(e)
			logger.exception(f"Source {source_id} failed: {e}")

		finally:
			result.duration_seconds = (datetime.utcnow() - start_time).total_seconds()
			logger.info(
				f"Completed {source_id}: {result.status} "
				f"({result.opportunities_unique} unique in {result.duration_seconds:.1f}s)"
			)

		return result

	def get_health_status(self) -> dict[str, Any]:
		"""
		Get health status of the orchestrator.

		Returns:
			Dictionary with health information
		"""
		return {
			"status": "healthy",
			"current_run": self._current_run.run_id if self._current_run else None,
			"dedup_fingerprints": self.deduplicator.get_fingerprint_count(),
			"transformer_stats": self.transformer.stats,
			"dedup_stats": self.deduplicator.stats,
		}


# ============================================================================
# Convenience Functions
# ============================================================================

async def run_all_sources() -> OrchestrationResult:
	"""Run all enabled sources."""
	orchestrator = ScrapingOrchestrator()
	return await orchestrator.run_all()


async def run_tier(tier: str) -> OrchestrationResult:
	"""Run all sources in a tier."""
	orchestrator = ScrapingOrchestrator()
	return await orchestrator.run_tier(tier)


async def run_source(source_id: str) -> OrchestrationResult:
	"""Run a single source."""
	orchestrator = ScrapingOrchestrator()
	return await orchestrator.run_source(source_id)


# ============================================================================
# CLI Entry Point
# ============================================================================

def main() -> None:
	"""CLI entry point for orchestrator."""
	import argparse

	parser = argparse.ArgumentParser(
		description="TenderSourceMax Scraping Orchestrator",
		formatter_class=argparse.RawDescriptionHelpFormatter,
		epilog="""
Examples:
  python -m backend.discovery.scheduler.orchestrator --all
  python -m backend.discovery.scheduler.orchestrator --tier tier1
  python -m backend.discovery.scheduler.orchestrator --source ungm
		""",
	)

	group = parser.add_mutually_exclusive_group(required=True)
	group.add_argument("--all", action="store_true", help="Run all enabled sources")
	group.add_argument("--tier", type=str, help="Run sources in tier (tier1, tier2, tier3)")
	group.add_argument("--source", type=str, help="Run a single source by ID")

	parser.add_argument("--config", type=str, help="Path to config file")
	parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

	args = parser.parse_args()

	# Configure logging
	log_level = logging.DEBUG if args.verbose else logging.INFO
	logging.basicConfig(
		level=log_level,
		format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
	)

	# Run orchestrator
	async def run():
		orchestrator = ScrapingOrchestrator(config_path=args.config)

		if args.all:
			result = await orchestrator.run_all()
		elif args.tier:
			result = await orchestrator.run_tier(args.tier)
		elif args.source:
			result = await orchestrator.run_source(args.source)

		# Print summary
		print("\n" + "=" * 60)
		print("ORCHESTRATION SUMMARY")
		print("=" * 60)
		print(f"Run ID: {result.run_id}")
		print(f"Status: {result.status}")
		print(f"Duration: {result.duration_seconds:.1f}s")
		print(f"\nSources: {result.sources_success}/{result.sources_total} successful")
		print(f"Opportunities scraped: {result.opportunities_total}")
		print(f"Opportunities unique: {result.opportunities_unique}")
		print(f"Opportunities synced: {result.opportunities_synced}")

		if result.errors:
			print(f"\nErrors ({len(result.errors)}):")
			for error in result.errors[:5]:
				print(f"  - {error}")

		print("\nSource Details:")
		for sr in result.source_results:
			status_icon = "✓" if sr.status == "success" else "✗"
			print(f"  {status_icon} {sr.source_name}: {sr.opportunities_unique} unique ({sr.duration_seconds:.1f}s)")

	asyncio.run(run())


if __name__ == "__main__":
	main()
