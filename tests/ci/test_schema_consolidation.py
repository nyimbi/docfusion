"""Verify schema files are consolidated into 5 domains."""

from __future__ import annotations

from pathlib import Path


def test_five_domain_files_exist():
	domains_dir = Path("frontend/lib/db/domains")
	expected = {"core.ts", "crm.ts", "intelligence.ts", "workflow.ts", "integration.ts", "index.ts"}
	found = {f.name for f in domains_dir.glob("*.ts")}
	assert expected.issubset(found), f"Missing domain files: {expected - found}"


def test_individual_schemas_still_exist():
	"""Backward compatibility: original schema files must not be deleted."""
	db_dir = Path("frontend/lib/db")
	schema_files = list(db_dir.glob("schema-*.ts"))
	assert len(schema_files) >= 20, f"Expected >=20 schema files, found {len(schema_files)}"


def test_schema_ts_exports_all_domains():
	schema_ts = Path("frontend/lib/db/schema.ts")
	content = schema_ts.read_text()
	assert "Domain 1: Core" in content
	assert "Domain 2: CRM" in content
	assert "Domain 3: Intelligence" in content
	assert "Domain 4: Workflow" in content
	assert "Domain 5: Integration" in content
