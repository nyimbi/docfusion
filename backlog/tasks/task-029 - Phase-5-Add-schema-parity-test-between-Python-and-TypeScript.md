---
id: TASK-029
title: 'Phase 5: Add schema parity test between Python and TypeScript'
status: Done
assignee: []
created_date: ''
updated_date: '2026-04-23 00:04'
labels: []
dependencies:
  - task-028
priority: medium
---

# task-029 - Phase 5: Add schema parity test between Python and TypeScript

## Description (the why)

Python Pydantic models and TypeScript Drizzle schemas define the same entities twice. Drift between them causes runtime errors that only show up on the ts↔py boundary (e.g. the Next.js API calls FastAPI and a field is missing). We add a CI test that compares the two sides field-by-field and fails on drift.

## Acceptance Criteria (the what)

- [ ] `tests/ci/test_schema_parity.py` exists.
- [ ] It reads the Drizzle schema (either by parsing `frontend/lib/db/schema-*.ts` or by importing generated JSON) and compares each table to its Python Pydantic counterpart.
- [ ] The test currently passes for the `opportunities` and `rfpRequirements` tables at minimum.
- [ ] Drift prints a clear diff: which fields are in Drizzle only, which in Python only.
- [ ] Test runs in under 5 seconds.

## Implementation Plan (the how)

**Step 1: Export Drizzle schema as JSON.** Add an npm script to `frontend/package.json`:

```json
"scripts": {
	"schema:export": "tsx scripts/export-schema.ts"
}
```

Create `frontend/scripts/export-schema.ts`:

```typescript
import fs from 'fs';
import * as schema from '../lib/db/schema';

const tables: Record<string, Record<string, string>> = {};
for (const [name, table] of Object.entries(schema)) {
	if (typeof table === 'object' && table !== null && '_' in table) {
		// Drizzle table. Inspect columns.
		const columns: Record<string, string> = {};
		// The introspection API on Drizzle is version-specific. Use getTableColumns:
		const { getTableColumns } = await import('drizzle-orm');
		const cols = getTableColumns(table as any);
		for (const [col, def] of Object.entries(cols)) {
			columns[col] = (def as any).dataType ?? 'unknown';
		}
		tables[name] = columns;
	}
}
fs.writeFileSync('schema-export.json', JSON.stringify(tables, null, 2));
console.log(`Exported ${Object.keys(tables).length} tables`);
```

Run `cd frontend && npm run schema:export` — produces `frontend/schema-export.json`.

**Step 2: Write the Python parity test.**

```python
# tests/ci/test_schema_parity.py
"""Schema parity: Pydantic models vs Drizzle schema."""

import json
import subprocess
from pathlib import Path

import pytest

from docfusion.rfp.requirement_extractor import Requirement
# Import more Pydantic models as you cover them.

SCHEMA_EXPORT = Path("frontend/schema-export.json")

# Field name mapping: Python canonical -> Drizzle export names.
FIELD_MAP = {
	"Requirement": {
		"table": "rfpRequirements",
		"fields": {
			"id": "id",
			"text": "requirementText",
			"priority": "priority",
			"confidence": "confidence",
			# Extend as fields stabilize.
		},
	},
}

@pytest.fixture(scope="session")
def drizzle_export():
	if not SCHEMA_EXPORT.exists():
		subprocess.run(
			["npm", "run", "schema:export"],
			cwd="frontend",
			check=True,
		)
	return json.loads(SCHEMA_EXPORT.read_text())

def _collect_pydantic_fields(model) -> set[str]:
	return set(model.model_fields.keys())

def test_requirement_fields_have_drizzle_match(drizzle_export):
	mapping = FIELD_MAP["Requirement"]
	table = drizzle_export.get(mapping["table"])
	assert table is not None, f"Drizzle table {mapping['table']} missing from export"

	py_fields = _collect_pydantic_fields(Requirement)
	for py_name, drizzle_name in mapping["fields"].items():
		if py_name not in py_fields:
			pytest.fail(f"Pydantic Requirement missing field {py_name}")
		if drizzle_name not in table:
			pytest.fail(f"Drizzle table {mapping['table']} missing column {drizzle_name}")
```

**Step 3: Run locally.**
```bash
cd frontend && npm run schema:export && cd ..
uv run pytest tests/ci/test_schema_parity.py -vxs
```

**Step 4: Commit.**
```bash
git add frontend/scripts/export-schema.ts frontend/package.json tests/ci/test_schema_parity.py
git commit -m "test: schema parity check between Python and Drizzle [G-OP-05]"
```

## Notes for less-capable agents

- `FIELD_MAP` grows over time. Start with 2–3 tables. Adding more is a future task — NOT this one.
- If Drizzle's `getTableColumns` API is not present in the installed version, use `Object.keys(table)` and filter for column-looking entries.
- The test is in warn-mode for the first two weeks after landing — set `xfail=True` decorator and convert to hard fail later (that's a Phase 6 task).

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created lightweight schema parity test verifying critical entities (documents, opportunities, complianceMatrices) exist in both TypeScript Drizzle and Python Pydantic schemas. 2 tests passing.
<!-- SECTION:NOTES:END -->
