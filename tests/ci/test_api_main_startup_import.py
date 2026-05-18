"""Regression coverage for importing the legacy API main module."""

from __future__ import annotations


def test_legacy_api_main_create_app_imports_in_base_environment():
	from docfusion.api.main import create_app

	app = create_app()

	assert app.title == "Proposal Writer API"
