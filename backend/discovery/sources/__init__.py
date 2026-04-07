"""
TenderSourceMax Source Registry
===============================

Loads and manages source configurations from registry.yaml.

Usage:
	from backend.discovery.sources import (
		get_source,
		get_all_sources,
		get_sources_by_tier,
	)

	# Get single source config
	config = get_source("ungm")

	# Get all enabled sources
	all_sources = get_all_sources()

	# Get tier 1 sources for high-priority scraping
	tier1 = get_sources_by_tier(1)
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

from backend.discovery.models.opportunity import SourceConfig, SourceType


# ============================================================================
# Registry Loading
# ============================================================================

_registry_cache: dict[str, Any] | None = None


def _get_registry_path() -> Path:
	"""Get path to registry.yaml file."""
	current_dir = Path(__file__).parent
	return current_dir / "registry.yaml"


def _load_registry() -> dict[str, Any]:
	"""Load and cache registry from YAML file."""
	global _registry_cache

	if _registry_cache is not None:
		return _registry_cache

	registry_path = _get_registry_path()
	if not registry_path.exists():
		raise FileNotFoundError(f"Registry file not found: {registry_path}")

	with open(registry_path, "r") as f:
		_registry_cache = yaml.safe_load(f)

	return _registry_cache


def reload_registry() -> None:
	"""Force reload of registry from disk."""
	global _registry_cache
	_registry_cache = None
	_load_registry()


# ============================================================================
# Source Access Functions
# ============================================================================

def get_source(source_id: str) -> SourceConfig | None:
	"""
	Get configuration for a specific source.

	Args:
		source_id: Unique source identifier (e.g., "ungm")

	Returns:
		SourceConfig or None if not found
	"""
	registry = _load_registry()

	for source_data in registry.get("sources", []):
		if source_data.get("id") == source_id:
			return SourceConfig.from_dict(source_data)

	return None


def get_all_sources(*, enabled_only: bool = True) -> list[SourceConfig]:
	"""
	Get all source configurations.

	Args:
		enabled_only: Only return enabled sources (default True)

	Returns:
		List of SourceConfig objects
	"""
	registry = _load_registry()
	sources: list[SourceConfig] = []

	for source_data in registry.get("sources", []):
		if enabled_only and not source_data.get("enabled", True):
			continue
		sources.append(SourceConfig.from_dict(source_data))

	return sources


def get_sources_by_tier(tier: int) -> list[SourceConfig]:
	"""
	Get sources for a specific schedule tier.

	Args:
		tier: Schedule tier (1, 2, or 3)

	Returns:
		List of SourceConfig objects for that tier
	"""
	registry = _load_registry()
	schedules = registry.get("schedules", {})

	tier_key = f"tier{tier}"
	if tier_key not in schedules:
		return []

	tier_source_ids = schedules[tier_key].get("sources", [])

	# Get full configs for each source ID
	sources: list[SourceConfig] = []
	for source_id in tier_source_ids:
		config = get_source(source_id)
		if config and config.enabled:
			sources.append(config)

	return sources


def get_sources_by_type(source_type: SourceType) -> list[SourceConfig]:
	"""
	Get sources of a specific type.

	Args:
		source_type: Type of source (mdb, government, etc.)

	Returns:
		List of SourceConfig objects matching the type
	"""
	sources = get_all_sources()
	return [s for s in sources if s.source_type == source_type]


def get_sources_by_coverage(region: str) -> list[SourceConfig]:
	"""
	Get sources covering a specific region/country.

	Args:
		region: Region or country name (e.g., "africa", "kenya")

	Returns:
		List of SourceConfig objects covering that region
	"""
	sources = get_all_sources()
	region_lower = region.lower()
	return [s for s in sources if region_lower in [r.lower() for r in s.coverage]]


def get_schedule_cron(tier: int) -> str | None:
	"""
	Get cron expression for a schedule tier.

	Args:
		tier: Schedule tier (1, 2, or 3)

	Returns:
		Cron expression string or None
	"""
	registry = _load_registry()
	schedules = registry.get("schedules", {})

	tier_key = f"tier{tier}"
	if tier_key not in schedules:
		return None

	return schedules[tier_key].get("cron")


def get_settings() -> dict[str, Any]:
	"""
	Get global settings from registry.

	Returns:
		Settings dictionary
	"""
	registry = _load_registry()
	return registry.get("settings", {})


# ============================================================================
# Validation
# ============================================================================

def validate_registry() -> list[str]:
	"""
	Validate registry configuration.

	Returns:
		List of validation error messages (empty if valid)
	"""
	errors: list[str] = []

	try:
		registry = _load_registry()
	except Exception as e:
		return [f"Failed to load registry: {e}"]

	# Check for required keys
	if "sources" not in registry:
		errors.append("Missing 'sources' key in registry")

	# Validate each source
	source_ids = set()
	for i, source in enumerate(registry.get("sources", [])):
		# Required fields
		if "id" not in source:
			errors.append(f"Source {i}: Missing 'id' field")
			continue

		source_id = source["id"]

		# Check for duplicates
		if source_id in source_ids:
			errors.append(f"Duplicate source id: {source_id}")
		source_ids.add(source_id)

		if "name" not in source:
			errors.append(f"Source {source_id}: Missing 'name' field")

		if "url" not in source:
			errors.append(f"Source {source_id}: Missing 'url' field")

		# Validate type
		if "type" in source:
			try:
				SourceType(source["type"])
			except ValueError:
				errors.append(f"Source {source_id}: Invalid type '{source['type']}'")

		# Validate rate_limit
		if "rate_limit" in source:
			if not isinstance(source["rate_limit"], (int, float)) or source["rate_limit"] <= 0:
				errors.append(f"Source {source_id}: Invalid rate_limit")

	# Validate schedules reference existing sources
	for tier_key, tier_config in registry.get("schedules", {}).items():
		for ref_source in tier_config.get("sources", []):
			if ref_source not in source_ids:
				errors.append(f"Schedule {tier_key}: References unknown source '{ref_source}'")

	return errors


# ============================================================================
# Module-level exports
# ============================================================================

__all__ = [
	"get_source",
	"get_all_sources",
	"get_sources_by_tier",
	"get_sources_by_type",
	"get_sources_by_coverage",
	"get_schedule_cron",
	"get_settings",
	"validate_registry",
	"reload_registry",
]
