"""Verify circular imports between intelligence and discovery are resolved."""

from __future__ import annotations


def test_intelligence_imports_cleanly():
	import docfusion.intelligence as intel
	assert intel is not None


def test_discovery_imports_cleanly():
	import docfusion.discovery as disc
	assert disc is not None


def test_cross_import_intelligence_then_discovery():
	import docfusion.intelligence as intel
	import docfusion.discovery as disc
	assert intel is not None
	assert disc is not None


def test_cross_import_discovery_then_intelligence():
	import docfusion.discovery as disc
	import docfusion.intelligence as intel
	assert disc is not None
	assert intel is not None


def test_core_types_intelligence_level():
	from docfusion.core.types import IntelligenceLevel
	assert IntelligenceLevel.BASIC == "basic"
	assert IntelligenceLevel.STRATEGIC == "strategic"
