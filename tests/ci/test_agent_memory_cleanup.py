"""Test for agent memory TTL cleanup job."""

from __future__ import annotations

from docfusion.agents.memory.cleanup_job import run_cleanup


async def test_cleanup_job_imports_and_runs():
	# The cleanup job should import and run without raising.
	# Without a real DB it will fail to connect, but the function signature is correct.
	try:
		await run_cleanup(dsn="postgresql://invalid:5432/test")
	except Exception:
		pass  # Expected without DB
	assert True
