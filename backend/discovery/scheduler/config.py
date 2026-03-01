"""
Scheduler Configuration
=======================

Configuration management for scraping schedules.

Schedule Tiers:
	- tier1: Every 6 hours (high-priority sources)
	- tier2: Every 12 hours (medium-priority sources)
	- tier3: Daily at 6 AM UTC (lower-priority sources)

Author: TenderSourceMax
"""

from __future__ import annotations

import os
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)


# ============================================================================
# Configuration Models
# ============================================================================

@dataclass
class ScheduleConfig:
	"""Configuration for a schedule tier."""
	name: str
	cron: str
	sources: list[str]
	enabled: bool = True
	max_concurrent: int = 3
	timeout_minutes: int = 30


@dataclass
class SourceConfig:
	"""Configuration for a single source."""
	id: str
	name: str
	url: str
	scraper_class: str
	rate_limit: float = 1.0
	timeout: int = 30
	max_retries: int = 3
	max_pages: int = 10
	enabled: bool = True
	javascript: bool = False
	proxy_required: bool = False
	tier: str = "tier3"
	coverage: list[str] = field(default_factory=list)


@dataclass
class OrchestratorConfig:
	"""Full orchestrator configuration."""
	schedules: dict[str, ScheduleConfig]
	sources: dict[str, SourceConfig]
	defaults: dict[str, Any]

	# Global settings
	database_url: str | None = None
	export_dir: str = "data/sync_exports"
	dedup_db_path: str = "data/dedup.db"
	log_level: str = "INFO"

	# Concurrency settings
	max_concurrent_scrapers: int = 5
	default_timeout_minutes: int = 30


# ============================================================================
# Configuration Loader
# ============================================================================

DEFAULT_SCHEDULES = {
	"tier1": ScheduleConfig(
		name="tier1",
		cron="0 */6 * * *",  # Every 6 hours
		sources=["ungm", "undp", "afdb", "kenya_ppip", "sa_etenders"],
		max_concurrent=3,
	),
	"tier2": ScheduleConfig(
		name="tier2",
		cron="0 */12 * * *",  # Every 12 hours
		sources=["nigeria_bpp", "worldbank", "ted", "rwanda", "ghana"],
		max_concurrent=3,
	),
	"tier3": ScheduleConfig(
		name="tier3",
		cron="0 6 * * *",  # Daily at 6 AM UTC
		sources=["tanzania", "uganda", "ethiopia", "eac", "sadc"],
		max_concurrent=2,
	),
}

DEFAULT_CONFIG = {
	"max_concurrent_scrapers": 5,
	"default_timeout_minutes": 30,
	"rate_limit": 1.0,
	"max_retries": 3,
	"max_pages": 10,
}


def load_config(
	config_path: str | Path | None = None,
) -> OrchestratorConfig:
	"""
	Load orchestrator configuration from YAML file.

	Args:
		config_path: Path to config file (uses default if None)

	Returns:
		OrchestratorConfig object
	"""
	# Try to load from file
	config_data: dict[str, Any] = {}

	if config_path:
		path = Path(config_path)
		if path.exists():
			with open(path) as f:
				config_data = yaml.safe_load(f) or {}
			logger.info(f"Loaded config from {path}")

	# Also try loading source registry
	registry_path = Path(__file__).parent.parent / "sources" / "registry.yaml"
	sources_data: dict[str, SourceConfig] = {}

	if registry_path.exists():
		with open(registry_path) as f:
			registry = yaml.safe_load(f) or {}

		# Handle both list and dict formats for sources
		sources_list = registry.get("sources", [])
		if isinstance(sources_list, list):
			# List format: [{"id": "ungm", "name": "..."}, ...]
			for source_info in sources_list:
				source_id = source_info.get("id")
				if not source_id:
					continue
				sources_data[source_id] = SourceConfig(
					id=source_id,
					name=source_info.get("name", source_id),
					url=source_info.get("url", ""),
					scraper_class=source_info.get("scraper_class", ""),
					rate_limit=source_info.get("rate_limit", 1.0),
					timeout=source_info.get("timeout", 30),
					max_retries=source_info.get("max_retries", 3),
					max_pages=source_info.get("max_pages", 10),
					enabled=source_info.get("enabled", True),
					javascript=source_info.get("javascript", False),
					proxy_required=source_info.get("proxy_required", False),
					tier=f"tier{source_info.get('schedule_tier', 3)}",
					coverage=source_info.get("coverage", []),
				)
		elif isinstance(sources_list, dict):
			# Dict format: {"ungm": {"name": "..."}, ...}
			for source_id, source_info in sources_list.items():
				sources_data[source_id] = SourceConfig(
					id=source_id,
					name=source_info.get("name", source_id),
					url=source_info.get("url", ""),
					scraper_class=source_info.get("scraper_class", ""),
					rate_limit=source_info.get("rate_limit", 1.0),
					timeout=source_info.get("timeout", 30),
					max_retries=source_info.get("max_retries", 3),
					max_pages=source_info.get("max_pages", 10),
					enabled=source_info.get("enabled", True),
					javascript=source_info.get("javascript", False),
					proxy_required=source_info.get("proxy_required", False),
					tier=source_info.get("tier", "tier3"),
					coverage=source_info.get("coverage", []),
				)

	# Build schedules from registry or defaults
	schedules: dict[str, ScheduleConfig] = {}

	# Extract schedules from registry
	if registry_path.exists():
		with open(registry_path) as f:
			registry = yaml.safe_load(f) or {}

		for tier_name, tier_info in registry.get("schedules", {}).items():
			schedules[tier_name] = ScheduleConfig(
				name=tier_name,
				cron=tier_info.get("cron", "0 6 * * *"),
				sources=tier_info.get("sources", []),
				enabled=tier_info.get("enabled", True),
				max_concurrent=tier_info.get("max_concurrent", 3),
				timeout_minutes=tier_info.get("timeout_minutes", 30),
			)

	# Fall back to defaults if no schedules loaded
	if not schedules:
		schedules = DEFAULT_SCHEDULES

	# Build defaults
	defaults = {**DEFAULT_CONFIG, **config_data.get("defaults", {})}

	return OrchestratorConfig(
		schedules=schedules,
		sources=sources_data,
		defaults=defaults,
		database_url=os.environ.get("DATABASE_URL"),
		export_dir=config_data.get("export_dir", "data/sync_exports"),
		dedup_db_path=config_data.get("dedup_db_path", "data/dedup.db"),
		log_level=config_data.get("log_level", "INFO"),
		max_concurrent_scrapers=defaults.get("max_concurrent_scrapers", 5),
		default_timeout_minutes=defaults.get("default_timeout_minutes", 30),
	)


def get_sources_for_tier(
	config: OrchestratorConfig,
	tier: str,
) -> list[SourceConfig]:
	"""
	Get all sources configured for a tier.

	Args:
		config: Orchestrator configuration
		tier: Tier name (tier1, tier2, tier3)

	Returns:
		List of SourceConfig for enabled sources in tier
	"""
	if tier not in config.schedules:
		logger.warning(f"Unknown tier: {tier}")
		return []

	schedule = config.schedules[tier]
	sources: list[SourceConfig] = []

	for source_id in schedule.sources:
		if source_id in config.sources:
			source = config.sources[source_id]
			if source.enabled:
				sources.append(source)
		else:
			logger.warning(f"Source {source_id} in tier {tier} not found in registry")

	return sources


def get_enabled_sources(
	config: OrchestratorConfig,
) -> list[SourceConfig]:
	"""
	Get all enabled sources.

	Args:
		config: Orchestrator configuration

	Returns:
		List of all enabled SourceConfig objects
	"""
	return [s for s in config.sources.values() if s.enabled]


# ============================================================================
# Standalone execution
# ============================================================================

if __name__ == "__main__":
	# Test configuration loading
	config = load_config()

	print("Orchestrator Configuration")
	print("=" * 60)
	print(f"Sources loaded: {len(config.sources)}")
	print(f"Schedules: {list(config.schedules.keys())}")

	for tier_name, schedule in config.schedules.items():
		print(f"\n{tier_name}:")
		print(f"  Cron: {schedule.cron}")
		print(f"  Sources: {schedule.sources}")
		print(f"  Max concurrent: {schedule.max_concurrent}")
