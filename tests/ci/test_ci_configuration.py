"""Verify CI configuration includes required checks."""

from __future__ import annotations

from pathlib import Path


def test_ci_has_alembic_check():
	ci = Path(".github/workflows/ci.yml").read_text()
	assert "alembic-check" in ci
	assert "alembic upgrade head" in ci


def test_ci_has_coverage_gate():
	ci = Path(".github/workflows/ci.yml").read_text()
	assert "cov-fail-under" in ci


def test_ci_has_e2e_job():
	ci = Path(".github/workflows/ci.yml").read_text()
	assert "e2e-tests" in ci
	assert "playwright" in ci.lower()


def test_vitest_has_coverage_threshold():
	vitest = Path("frontend/vitest.config.ts").read_text()
	assert "thresholds" in vitest
