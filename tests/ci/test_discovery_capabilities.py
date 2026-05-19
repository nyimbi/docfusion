"""Tests for discovery capability flags exposure."""

from __future__ import annotations

from docfusion.discovery import CAPABILITIES
from docfusion.discovery.crawlers.ai_driven.universal_scraper import HAS_CRAWL4AI


def test_capabilities_is_dict():
	assert isinstance(CAPABILITIES, dict)
	assert all(isinstance(k, str) for k in CAPABILITIES.keys())
	assert all(isinstance(v, bool) for v in CAPABILITIES.values())


def test_capabilities_has_expected_keys():
	expected = {
		"playwright",
		"crawl4ai",
		"cloudscraper",
		"vision",
		"structure_learning",
		"pattern_recognition",
		"source_discovery",
		"deployment",
		"monitoring",
	}
	assert expected.issubset(set(CAPABILITIES.keys()))


def test_crawl4ai_capability_matches_optional_dependency():
	assert CAPABILITIES["crawl4ai"] is HAS_CRAWL4AI
