"""Regression coverage for the top-level agents package export contract."""

from __future__ import annotations


def test_agents_all_exports_are_present():
	import docfusion.agents as agents

	missing = [name for name in agents.__all__ if not hasattr(agents, name)]

	assert missing == []
