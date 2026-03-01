#!/usr/bin/env python3
"""
Scraper Runner
==============

Standalone scraper execution with database tracking and fingerprint-based deduplication.

This runner provides a focused interface for:
    - Running scrapers by tier or source ID
    - Tracking execution results in the database
    - Fingerprint-based deduplication using SHA256 hashes
    - JSON output for structured logging

Usage:
    python -m backend.discovery.scheduler.scraper_runner --tier tier1
    python -m backend.discovery.scheduler.scraper_runner --source ungm
    python -m backend.discovery.scheduler.scraper_runner --all
    python -m backend.discovery.scheduler.scraper_runner --tier tier1 --dry-run

Exit Codes:
    0: All scrapers completed successfully
    1: One or more scrapers failed
    2: Configuration or initialization error

Author: DocuFusion Team
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import logging
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

# Configure logging before imports
logging.basicConfig(
	level=logging.INFO,
	format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Try imports with graceful fallback
try:
	from backend.discovery.scheduler.config import (
		load_config,
		OrchestratorConfig,
		SourceConfig,
		get_sources_for_tier,
		get_enabled_sources,
	)
	from backend.discovery.scheduler.orchestrator import (
		SCRAPER_REGISTRY,
		get_scraper_class,
	)
	from backend.discovery.models.opportunity import (
		ScrapedOpportunity,
		ScraperResult,
		SourceType,
	)
	from backend.discovery.scrapers.base import BaseScraper
	from backend.discovery.pipeline.deduplicator import Deduplicator
	HAS_DISCOVERY_MODULES = True
except ImportError as e:
	logger.warning(f"Discovery modules not available: {e}")
	HAS_DISCOVERY_MODULES = False


# ============================================================================
# Result Data Classes
# ============================================================================

@dataclass
class SourceRunResult:
	"""Result of running a single source."""
	source_id: str
	source_name: str
	status: str  # "success", "partial", "failed", "pending"
	opportunities_scraped: int = 0
	opportunities_unique: int = 0
	opportunities_stored: int = 0
	duration_seconds: float = 0.0
	error: str | None = None
	warnings: list[str] = field(default_factory=list)
	fingerprint_hashes: list[str] = field(default_factory=list)

	def to_dict(self) -> dict[str, Any]:
		"""Convert to dictionary for JSON serialization."""
		return asdict(self)


@dataclass
class RunnerResult:
	"""Aggregated result of scraper runner execution."""
	run_id: str
	started_at: str
	completed_at: str | None = None
	status: str = "running"  # "running", "completed", "partial", "failed"
	trigger: str = "manual"  # "manual", "scheduled", "tier"
	tier: str | None = None
	source: str | None = None

	# Counts
	sources_total: int = 0
	sources_success: int = 0
	sources_failed: int = 0
	opportunities_total: int = 0
	opportunities_unique: int = 0
	opportunities_stored: int = 0

	# Details
	source_results: list[SourceRunResult] = field(default_factory=list)
	errors: list[str] = field(default_factory=list)
	dry_run: bool = False

	@property
	def duration_seconds(self) -> float:
		"""Calculate duration in seconds."""
		if not self.completed_at:
			return 0.0
		start = datetime.fromisoformat(self.started_at)
		end = datetime.fromisoformat(self.completed_at)
		return (end - start).total_seconds()

	def to_dict(self) -> dict[str, Any]:
		"""Convert to dictionary for JSON serialization."""
		data = asdict(self)
		data["duration_seconds"] = self.duration_seconds
		return data


# ============================================================================
# Fingerprint Computation
# ============================================================================

def compute_fingerprint(
	title: str,
	organization: str | None,
	deadline: str | None,
) -> str:
	"""
	Compute SHA256 fingerprint for deduplication.

	The fingerprint is based on normalized fields:
		- title (lowercase, stripped)
		- organization (lowercase)
		- deadline (ISO format)

	Args:
		title: Opportunity title
		organization: Issuing organization
		deadline: Deadline as ISO string

	Returns:
		SHA256 hash (first 32 characters)
	"""
	components = [
		title.lower().strip() if title else "",
		(organization or "").lower().strip(),
		deadline or "",
	]
	combined = "|".join(components)
	return hashlib.sha256(combined.encode("utf-8")).hexdigest()


def compute_fingerprint_from_opportunity(opp: "ScrapedOpportunity") -> str:
	"""
	Compute fingerprint from ScrapedOpportunity object.

	Args:
		opp: ScrapedOpportunity instance

	Returns:
		SHA256 fingerprint hash
	"""
	return compute_fingerprint(
		title=opp.title,
		organization=opp.organization,
		deadline=opp.deadline.isoformat() if opp.deadline else None,
	)


# ============================================================================
# Scraper Runner
# ============================================================================

class ScraperRunner:
	"""
	Executes scrapers with database tracking and fingerprint-based deduplication.

	Features:
		- Runs scrapers by tier, source ID, or all enabled sources
		- Tracks execution results in PostgreSQL
		- Deduplicates opportunities using SHA256 fingerprints
		- Stores unique opportunities in the database
		- Provides structured JSON output

	Usage:
		runner = ScraperRunner(tier="tier1")
		result = await runner.run()
		print(json.dumps(result.to_dict(), indent=2))
	"""

	# Tier configuration
	TIER_SCHEDULES = {
		"tier1": {"interval_hours": 6, "name": "High Priority (6h)"},
		"tier2": {"interval_hours": 12, "name": "Medium Priority (12h)"},
		"tier3": {"interval_hours": 24, "name": "Daily"},
	}

	def __init__(
		self,
		tier: str | None = None,
		source_id: str | None = None,
		config_path: str | Path | None = None,
		database_url: str | None = None,
		dry_run: bool = False,
	) -> None:
		"""
		Initialize scraper runner.

		Args:
			tier: Run all sources in this tier (tier1, tier2, tier3)
			source_id: Run a specific source by ID
			config_path: Path to configuration file
			database_url: PostgreSQL connection URL (uses DATABASE_URL env if not provided)
			dry_run: If True, don't write to database
		"""
		# Validate arguments
		if tier and source_id:
			raise ValueError("Cannot specify both tier and source_id")

		self.tier = tier
		self.source_id = source_id
		self.dry_run = dry_run
		self.config_path = config_path
		self.database_url = database_url

		# Configuration (loaded lazily)
		self._config: OrchestratorConfig | None = None
		self._sources: list[SourceConfig] = []

		# Deduplicator
		self._deduplicator: Deduplicator | None = None

		# Database pool
		self._pool = None
		self._db_available = False

		# Run tracking
		self._run_id = self._generate_run_id()
		self._batch_id = str(uuid4())

	def _generate_run_id(self) -> str:
		"""Generate unique run ID."""
		timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
		prefix = self.tier or self.source_id or "all"
		return f"{prefix}_{timestamp}"

	@classmethod
	def _compute_fingerprint(cls, opp: "ScrapedOpportunity") -> str:
		"""
		Compute SHA256 fingerprint for deduplication.

		Class method for computing fingerprints from ScrapedOpportunity objects.
		Uses the standalone compute_fingerprint function internally.

		Args:
			opp: ScrapedOpportunity instance

		Returns:
			SHA256 fingerprint hash
		"""
		return compute_fingerprint_from_opportunity(opp)

	def _log_pretty_path(self, path: Path) -> str:
		"""Format path for logging."""
		try:
			relative = path.relative_to(Path.cwd())
			return str(relative)
		except ValueError:
			return str(path)

	@property
	def config(self) -> OrchestratorConfig:
		"""Lazy load configuration."""
		if self._config is None:
			if HAS_DISCOVERY_MODULES:
				self._config = load_config(self.config_path)
			else:
				raise RuntimeError("Discovery modules not available")
		return self._config

	async def _get_sources(self) -> list[SourceConfig]:
		"""
		Get sources to run based on tier or source_id.

		Returns:
			List of SourceConfig objects to run
		"""
		if HAS_DISCOVERY_MODULES:
			if self.tier:
				return get_sources_for_tier(self.config, self.tier)
			elif self.source_id:
				if self.source_id in self.config.sources:
					return [self.config.sources[self.source_id]]
				else:
					logger.warning(f"Source '{self.source_id}' not found in configuration")
					return []
			else:
				# Run all enabled sources
				return get_enabled_sources(self.config)
		return []

	async def _init_database(self) -> None:
		"""Initialize database connection pool."""
		if self.dry_run:
			logger.info("Dry run mode - skipping database initialization")
			return

		import os
		db_url = self.database_url or os.environ.get("DATABASE_URL")

		if not db_url:
			logger.warning("No DATABASE_URL configured - using JSON export mode")
			return

		try:
			import asyncpg
			self._pool = await asyncpg.create_pool(
				db_url,
				min_size=2,
				max_size=10,
			)
			self._db_available = True
			logger.info("Database connection pool initialized")
		except ImportError:
			logger.warning("asyncpg not installed - database storage unavailable")
		except Exception as e:
			logger.error(f"Failed to connect to database: {e}")

	async def _close_database(self) -> None:
		"""Close database connection pool."""
		if self._pool:
			await self._pool.close()
			self._pool = None
			self._db_available = False
			logger.info("Database connection pool closed")

	async def _store_opportunities(
		self,
		session: Any,
		opportunities: list["ScrapedOpportunity"],
	) -> tuple[int, list[str]]:
		"""
		Store opportunities in database with fingerprint deduplication.

		Args:
			session: Database session/connection
			opportunities: List of scraped opportunities

		Returns:
			Tuple of (stored_count, fingerprint_hashes)
		"""
		if self.dry_run:
			logger.info(f"DRY RUN: Would store {len(opportunities)} opportunities")
			fingerprints = [compute_fingerprint_from_opportunity(o) for o in opportunities]
			return len(opportunities), fingerprints

		stored_count = 0
		fingerprints: list[str] = []

		if self._db_available and self._pool:
			async with self._pool.acquire() as conn:
				for opp in opportunities:
					try:
						fingerprint = compute_fingerprint_from_opportunity(opp)

						# Check if exists
						existing = await conn.fetchrow(
							"""
							SELECT id FROM opportunities
							WHERE fingerprint = $1 OR (source = $2 AND source_id = $3)
							""",
							fingerprint,
							opp.source,
							opp.source_id,
						)

						if existing:
							# Update existing
							await conn.execute(
								"""
								UPDATE opportunities SET
									title = $2,
									description = $3,
									updated_at = $4
								WHERE id = $1
								""",
								existing["id"],
								opp.title[:500],
								(opp.description or "")[:5000],
								datetime.now(timezone.utc),
							)
						else:
							# Insert new
							await conn.execute(
								"""
								INSERT INTO opportunities (
									id, title, description, source, source_id,
									organization, country, deadline, budget_value,
									portal_url, document_url, fingerprint,
									created_at, updated_at
								) VALUES (
									$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
								)
								""",
								str(uuid4()),
								opp.title[:500],
								(opp.description or "")[:5000],
								opp.source,
								opp.source_id,
								opp.organization[:255] if opp.organization else None,
								opp.country[:100] if opp.country else None,
								opp.deadline.isoformat() if opp.deadline else None,
								opp.budget_value[:100] if opp.budget_value else None,
								opp.portal_url[:1000] if opp.portal_url else None,
								opp.document_url[:1000] if opp.document_url else None,
								fingerprint,
								datetime.now(timezone.utc),
								datetime.now(timezone.utc),
							)

						fingerprints.append(fingerprint)
						stored_count += 1

					except Exception as e:
						logger.error(f"Failed to store opportunity {opp.source_id}: {e}")

		return stored_count, fingerprints

	async def _run_source(self, source: SourceConfig) -> SourceRunResult:
		"""
		Run a single scraper source.

		Args:
			source: Source configuration

		Returns:
			SourceRunResult with execution details
		"""
		start_time = datetime.now(timezone.utc)
		result = SourceRunResult(
			source_id=source.id,
			source_name=source.name,
			status="pending",
		)

		try:
			logger.info(f"Starting scraper: {source.id}")

			# Get scraper class
			scraper_class = get_scraper_class(source.id)
			if not scraper_class:
				result.status = "failed"
				result.error = f"No scraper class found for source: {source.id}"
				return result

			# Instantiate and run scraper
			scraper = scraper_class(
				rate_limit=source.rate_limit,
				timeout=source.timeout,
			)

			scrape_result: ScraperResult = await scraper.run()

			result.opportunities_scraped = scrape_result.count
			result.source_name = scraper.source_name

			if scrape_result.metrics.status.value == "failed":
				result.status = "failed"
				result.error = "; ".join(scrape_result.errors) if scrape_result.errors else "Unknown error"
				result.warnings = scrape_result.warnings
				return result

			# Process opportunities
			opportunities = scrape_result.opportunities

			if opportunities:
				# Compute fingerprints for deduplication
				for opp in opportunities:
					opp_fingerprint = compute_fingerprint_from_opportunity(opp)
					result.fingerprint_hashes.append(opp_fingerprint)

				# Store in database
				stored, fingerprints = await self._store_opportunities(
					None,  # Session managed internally
					opportunities,
				)
				result.opportunities_unique = len(fingerprints)
				result.opportunities_stored = stored

			result.status = "success"

		except asyncio.TimeoutError:
			result.status = "failed"
			result.error = f"Timeout after {source.timeout}s"
			logger.error(f"Source {source.id} timed out")

		except Exception as e:
			result.status = "failed"
			result.error = str(e)
			logger.exception(f"Source {source.id} failed: {e}")

		finally:
			result.duration_seconds = (datetime.now(timezone.utc) - start_time).total_seconds()
			logger.info(
				f"Completed {source.id}: {result.status} "
				f"({result.opportunities_unique} unique in {result.duration_seconds:.1f}s)"
			)

		return result

	def _summarize(self, results: list[SourceRunResult]) -> RunnerResult:
		"""
		Summarize execution results.

		Args:
			results: List of source run results

		Returns:
			Aggregated RunnerResult
		"""
		runner_result = RunnerResult(
			run_id=self._run_id,
			started_at=datetime.now(timezone.utc).isoformat(),
			trigger="tier" if self.tier else ("source" if self.source_id else "all"),
			tier=self.tier,
			source=self.source_id,
			dry_run=self.dry_run,
		)

		runner_result.sources_total = len(results)
		runner_result.source_results = results

		for r in results:
			if r.status == "success":
				runner_result.sources_success += 1
			else:
				runner_result.sources_failed += 1
				if r.error:
					runner_result.errors.append(f"{r.source_id}: {r.error}")

			runner_result.opportunities_total += r.opportunities_scraped
			runner_result.opportunities_unique += r.opportunities_unique
			runner_result.opportunities_stored += r.opportunities_stored

		runner_result.completed_at = datetime.now(timezone.utc).isoformat()

		# Determine overall status
		if runner_result.sources_failed == 0:
			runner_result.status = "completed"
		elif runner_result.sources_success == 0:
			runner_result.status = "failed"
		else:
			runner_result.status = "partial"

		return runner_result

	async def run(self) -> RunnerResult:
		"""
		Execute scrapers based on configuration.

		Returns:
			RunnerResult with execution summary
		"""
		# Initialize database if needed
		await self._init_database()

		try:
			# Get sources to run
			sources = await self._get_sources()

			if not sources:
				logger.warning("No sources to run")
				return RunnerResult(
					run_id=self._run_id,
					started_at=datetime.now(timezone.utc).isoformat(),
					completed_at=datetime.now(timezone.utc).isoformat(),
					status="failed",
					errors=["No sources to run"],
					tier=self.tier,
					source=self.source_id,
					dry_run=self.dry_run,
				)

			logger.info(f"Running {len(sources)} sources")

			# Run scrapers concurrently with semaphore
			semaphore = asyncio.Semaphore(3)  # Max concurrent scrapers

			async def run_with_semaphore(source: SourceConfig) -> SourceRunResult:
				async with semaphore:
					return await self._run_source(source)

			# Execute all scrapers
			tasks = [run_with_semaphore(s) for s in sources]
			results = await asyncio.gather(*tasks, return_exceptions=True)

			# Process results
			source_results: list[SourceRunResult] = []
			for i, result in enumerate(results):
				if isinstance(result, Exception):
					source_results.append(SourceRunResult(
						source_id=sources[i].id,
						source_name=sources[i].name,
						status="failed",
						error=str(result),
					))
				else:
					source_results.append(result)

			# Create summary
			runner_result = self._summarize(source_results)

			return runner_result

		finally:
			await self._close_database()


# ============================================================================
# CLI Entry Point
# ============================================================================

def main() -> int:
	"""
	CLI entry point for scraper runner.

	Returns:
		Exit code (0 for success, 1 for failures, 2 for errors)
	"""
	parser = argparse.ArgumentParser(
		description="DocuFusion Scraper Runner - Execute scrapers with database tracking",
		formatter_class=argparse.RawDescriptionHelpFormatter,
		epilog="""
Examples:
  # Run all sources in tier 1 (every 6 hours)
  python -m backend.discovery.scheduler.scraper_runner --tier tier1

  # Run a specific source
  python -m backend.discovery.scraper_runner --source ungm

  # Run all enabled sources
  python -m backend.discovery.scheduler.scraper_runner --all

  # Dry run (no database writes)
  python -m backend.discovery.scheduler.scraper_runner --tier tier1 --dry-run

Tiers:
  tier1: High-priority sources (every 6 hours)
  tier2: Medium-priority sources (every 12 hours)
  tier3: Lower-priority sources (daily)
		""",
	)

	# Mutually exclusive run options
	group = parser.add_mutually_exclusive_group(required=True)
	group.add_argument(
		"--tier",
		type=str,
		choices=["tier1", "tier2", "tier3"],
		help="Run all sources in the specified tier",
	)
	group.add_argument(
		"--source",
		type=str,
		help="Run a specific source by ID",
	)
	group.add_argument(
		"--all",
		action="store_true",
		help="Run all enabled sources",
	)

	# Optional arguments
	parser.add_argument(
		"--config",
		type=str,
		help="Path to configuration file",
	)
	parser.add_argument(
		"--dry-run",
		action="store_true",
		help="Run without writing to database",
	)
	parser.add_argument(
		"--verbose", "-v",
		action="store_true",
		help="Enable verbose output",
	)
	parser.add_argument(
		"--output", "-o",
		type=str,
		choices=["json", "text"],
		default="json",
		help="Output format (default: json)",
	)

	args = parser.parse_args()

	# Configure logging
	log_level = logging.DEBUG if args.verbose else logging.INFO
	logging.getLogger().setLevel(log_level)

	# Determine tier and source
	tier = args.tier if args.tier else None
	source_id = args.source if args.source else None

	async def run_async() -> RunnerResult:
		runner = ScraperRunner(
			tier=tier,
			source_id=source_id,
			config_path=args.config,
			dry_run=args.dry_run,
		)
		return await runner.run()

	# Execute
	try:
		result = asyncio.run(run_async())

		# Output
		if args.output == "json":
			print(json.dumps(result.to_dict(), indent=2))
		else:
			_print_text_summary(result)

		# Exit code
		if result.status == "completed":
			return 0
		else:
			return 1

	except ValueError as e:
		logger.error(f"Configuration error: {e}")
		error_result = RunnerResult(
			run_id="error",
			started_at=datetime.now(timezone.utc).isoformat(),
			completed_at=datetime.now(timezone.utc).isoformat(),
			status="failed",
			errors=[str(e)],
		)
		print(json.dumps(error_result.to_dict(), indent=2), file=sys.stderr)
		return 2

	except Exception as e:
		logger.exception(f"Unexpected error: {e}")
		error_result = RunnerResult(
			run_id="error",
			started_at=datetime.now(timezone.utc).isoformat(),
			completed_at=datetime.now(timezone.utc).isoformat(),
			status="failed",
			errors=[str(e)],
		)
		print(json.dumps(error_result.to_dict(), indent=2), file=sys.stderr)
		return 2


def _print_text_summary(result: RunnerResult) -> None:
	"""Print human-readable text summary."""
	print("\n" + "=" * 60)
	print("SCRAPER RUN SUMMARY")
	print("=" * 60)
	print(f"Run ID: {result.run_id}")
	print(f"Status: {result.status}")
	print(f"Duration: {result.duration_seconds:.1f}s")
	print(f"Trigger: {result.trigger}")
	if result.tier:
		print(f"Tier: {result.tier}")
	if result.source:
		print(f"Source: {result.source}")
	if result.dry_run:
		print("Mode: DRY RUN (no database writes)")

	print(f"\nSources: {result.sources_success}/{result.sources_total} successful")
	print(f"Opportunities scraped: {result.opportunities_total}")
	print(f"Opportunities unique: {result.opportunities_unique}")
	print(f"Opportunities stored: {result.opportunities_stored}")

	if result.errors:
		print(f"\nErrors ({len(result.errors)}):")
		for error in result.errors[:5]:
			print(f"  - {error}")
		if len(result.errors) > 5:
			print(f"  ... and {len(result.errors) - 5} more")

	print("\nSource Details:")
	for sr in result.source_results:
		status_icon = "OK" if sr.status == "success" else "FAIL"
		print(f"  [{status_icon}] {sr.source_name}: {sr.opportunities_unique} unique ({sr.duration_seconds:.1f}s)")
		if sr.error:
			print(f"       Error: {sr.error[:100]}")

	print("")


if __name__ == "__main__":
	sys.exit(main())