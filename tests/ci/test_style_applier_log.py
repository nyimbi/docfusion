"""Test for style_applier _log_initialization replacement."""

from __future__ import annotations

import logging

from docfusion.document_engine.formatter.style_applier import StyleApplier


async def test_log_initialization_no_error():
	# Should not raise; just log
	applier = StyleApplier()
	# If we get here without exception, the stub is replaced
	assert applier.metrics == {
		"styles_applied": 0,
		"cache_hits": 0,
		"compliance_violations": 0,
		"auto_corrections": 0,
	}
