"""Lightweight schema parity test between Python Pydantic and TypeScript Drizzle."""

from __future__ import annotations

from pathlib import Path


# Critical entities that should exist in both Python and TypeScript schemas
CRITICAL_ENTITIES = [
	"documents",
	"opportunities",
	"complianceMatrices",
	"complianceEntries",
	"rfpDocuments",
	"rfpRequirements",
]


def test_typescript_schema_has_critical_entities():
	db_dir = Path("frontend/lib/db")
	all_ts = "\n".join(f.read_text() for f in db_dir.rglob("*.ts") if f.is_file())
	missing = [e for e in CRITICAL_ENTITIES if e not in all_ts]
	assert not missing, f"TypeScript schema missing: {missing}"


def test_python_schema_has_critical_entities():
	python_files = list(Path("src/docfusion").rglob("*.py"))
	all_py = "\n".join(f.read_text() for f in python_files if f.is_file() and "__pycache__" not in str(f))
	# Python uses snake_case and class names
	python_names = ["Document", "Opportunity", "ComplianceMatrix"]
	missing = [e for e in python_names if e not in all_py]
	assert not missing, f"Python schema missing: {missing}"
