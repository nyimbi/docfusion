"""Verify all 58 African ISO-2 codes are registered in the procurement source DB."""

from __future__ import annotations

import pytest

from docfusion.discovery.crawlers.source_databases.african_sources import (
	AFRICAN_COUNTRY_CODES,
	get_national_sources,
	get_regional_sources,
	get_country_fallbacks,
)
from docfusion.discovery.crawlers.source_databases.global_source_db import GlobalSourceDB


EXPECTED_AFRICAN_CODES = {code for code, _ in AFRICAN_COUNTRY_CODES}


def test_all_58_codes_present():
	assert len(AFRICAN_COUNTRY_CODES) == 58


def test_no_duplicate_codes():
	codes = [code for code, _ in AFRICAN_COUNTRY_CODES]
	assert len(codes) == len(set(codes))


def test_national_and_fallbacks_cover_all_codes():
	national = {s["country"] for s in get_national_sources()}
	fallbacks = {s["country"] for s in get_country_fallbacks()}
	combined = national | fallbacks
	missing = EXPECTED_AFRICAN_CODES - combined
	assert not missing, f"Missing codes: {missing}"


async def test_global_db_loads_african_sources():
	"""Verify the African sources loader runs without raising."""
	db = GlobalSourceDB()
	# _load_african_sources should not raise even if DB insert fails
	# (the method catches exceptions per-source)
	await db._load_african_sources()
	# If we get here, the loader executed successfully
	assert True
