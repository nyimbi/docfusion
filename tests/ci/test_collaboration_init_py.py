"""Verify all collaboration subdirs have __init__.py files."""

from __future__ import annotations

from pathlib import Path


def test_collaboration_init_files():
	base = Path("src/docfusion/collaboration")
	missing = []
	for subdir in base.rglob(""):
		if subdir.name == "__pycache__":
			continue
		if subdir.is_dir() and subdir != base:
			init_file = subdir / "__init__.py"
			if not init_file.exists():
				missing.append(str(subdir))
	assert not missing, f"Missing __init__.py in: {missing}"
