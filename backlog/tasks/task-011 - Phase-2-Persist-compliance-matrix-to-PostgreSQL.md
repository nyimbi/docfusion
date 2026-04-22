---
id: TASK-011
title: 'Phase 2: Persist compliance matrix to PostgreSQL'
status: Done
assignee: []
created_date: ''
updated_date: '2026-04-22 22:18'
labels: []
dependencies:
  - task-007
priority: high
---

# task-011 - Phase 2: Persist compliance matrix to PostgreSQL

## Description (the why)

`ComplianceMatrixGenerator` is currently in-memory only. A generated matrix is lost when the process exits. We need durable persistence into `compliance_matrices` and `compliance_entries`.

## Acceptance Criteria (the what)

- [ ] `compliance_matrices` and `compliance_entries` tables exist in the database (via Alembic migration).
- [ ] `ComplianceMatrixGenerator` has async `save_to_db(session)` and `load_from_db(matrix_id, session)` methods.
- [ ] Data round-trips correctly: generate → save → load → compare equal.
- [ ] `tests/ci/test_compliance_matrix_persistence.py` covers round-trip and partial-update scenarios.
- [ ] Asyncpg is the driver; no sync `psycopg2` used outside Alembic.

## Implementation Plan (the how)

**Step 1: Check if the tables exist.**
```bash
grep -rn "compliance_matrices\|compliance_entries" migrations/ frontend/drizzle/ src/docfusion/ 2>/dev/null
```

If they exist in Drizzle but not in Alembic, you need to mirror them in Alembic. If they don't exist at all, create them.

**Step 2: Create Alembic migration.**
```bash
uv run alembic revision -m "add compliance_matrices and compliance_entries tables"
```

This creates a file like `migrations/versions/XXXX_add_compliance_matrices_and_compliance_entries_tables.py`. Edit its `upgrade()` function:

```python
def upgrade() -> None:
	op.create_table(
		"compliance_matrices",
		sa.Column("id", sa.String, primary_key=True),
		sa.Column("rfp_id", sa.String, nullable=False),
		sa.Column("title", sa.String, nullable=True),
		sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
		sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
		sa.Column("metadata", postgresql.JSONB, nullable=False, server_default="{}"),
	)
	op.create_index("ix_compliance_matrices_rfp_id", "compliance_matrices", ["rfp_id"])

	op.create_table(
		"compliance_entries",
		sa.Column("id", sa.String, primary_key=True),
		sa.Column("matrix_id", sa.String, sa.ForeignKey("compliance_matrices.id", ondelete="CASCADE"), nullable=False),
		sa.Column("requirement_id", sa.String, nullable=True),
		sa.Column("requirement_text", sa.Text, nullable=False),
		sa.Column("status", sa.String, nullable=False, server_default="pending"),
		sa.Column("response", sa.Text, nullable=True),
		sa.Column("evidence", postgresql.JSONB, nullable=False, server_default="[]"),
		sa.Column("owner", sa.String, nullable=True),
		sa.Column("confidence", sa.Float, nullable=True),
	)
	op.create_index("ix_compliance_entries_matrix_id", "compliance_entries", ["matrix_id"])

def downgrade() -> None:
	op.drop_index("ix_compliance_entries_matrix_id", "compliance_entries")
	op.drop_table("compliance_entries")
	op.drop_index("ix_compliance_matrices_rfp_id", "compliance_matrices")
	op.drop_table("compliance_matrices")
```

Add imports at top: `import sqlalchemy as sa` and `from sqlalchemy.dialects import postgresql`.

**Step 3: Run the migration in your dev DB.**
```bash
uv run alembic upgrade head
```

**Step 4: Add persistence methods to `ComplianceMatrixGenerator`.**

```python
async def save_to_db(self, session: AsyncSession) -> str:
	"""Persist this matrix to the database. Returns the matrix id."""
	from sqlalchemy import text
	matrix_id = self.id or uuid7str()
	await session.execute(
		text("""
			INSERT INTO compliance_matrices (id, rfp_id, title, metadata)
			VALUES (:id, :rfp_id, :title, CAST(:metadata AS JSONB))
			ON CONFLICT (id) DO UPDATE SET
				title = EXCLUDED.title,
				metadata = EXCLUDED.metadata,
				updated_at = NOW()
		"""),
		{
			"id": matrix_id,
			"rfp_id": self.rfp_id,
			"title": self.title,
			"metadata": json.dumps(self.metadata),
		},
	)

	# Replace entries atomically.
	await session.execute(
		text("DELETE FROM compliance_entries WHERE matrix_id = :mid"),
		{"mid": matrix_id},
	)
	for entry in self.entries:
		await session.execute(
			text("""
				INSERT INTO compliance_entries
				(id, matrix_id, requirement_id, requirement_text, status, response, evidence, owner, confidence)
				VALUES
				(:id, :matrix_id, :requirement_id, :text, :status, :response, CAST(:evidence AS JSONB), :owner, :confidence)
			"""),
			{
				"id": entry.id or uuid7str(),
				"matrix_id": matrix_id,
				"requirement_id": entry.requirement_id,
				"text": entry.requirement_text,
				"status": entry.status,
				"response": entry.response,
				"evidence": json.dumps(entry.evidence),
				"owner": entry.owner,
				"confidence": entry.confidence,
			},
		)

	await session.commit()
	self.id = matrix_id
	return matrix_id

@classmethod
async def load_from_db(cls, matrix_id: str, session: AsyncSession) -> "ComplianceMatrixGenerator":
	from sqlalchemy import text
	row = (await session.execute(
		text("SELECT * FROM compliance_matrices WHERE id = :id"),
		{"id": matrix_id},
	)).mappings().first()
	if row is None:
		raise ValueError(f"No compliance matrix with id {matrix_id}")

	entries_rows = (await session.execute(
		text("SELECT * FROM compliance_entries WHERE matrix_id = :mid ORDER BY id"),
		{"mid": matrix_id},
	)).mappings().all()

	instance = cls(rfp_id=row["rfp_id"], title=row["title"])
	instance.id = row["id"]
	instance.metadata = row["metadata"]
	instance.entries = [ComplianceEntry(**dict(e)) for e in entries_rows]
	return instance
```

Imports needed: `from sqlalchemy.ext.asyncio import AsyncSession`, `import json`, `from docfusion.core.utils import uuid7str`.

**Step 5: Test.**

```python
# tests/ci/test_compliance_matrix_persistence.py
"""Round-trip persistence coverage."""

import pytest

from docfusion.rfp.compliance_matrix import ComplianceMatrixGenerator

async def test_save_and_load_roundtrips(db_session):
	matrix = ComplianceMatrixGenerator(rfp_id="rfp-123", title="Test")
	matrix.add_entry(requirement_text="24/7 support", status="met", owner="ops")
	matrix_id = await matrix.save_to_db(db_session)

	loaded = await ComplianceMatrixGenerator.load_from_db(matrix_id, db_session)
	assert loaded.rfp_id == "rfp-123"
	assert loaded.title == "Test"
	assert len(loaded.entries) == 1
	assert loaded.entries[0].requirement_text == "24/7 support"

async def test_save_overwrites_existing_entries(db_session):
	matrix = ComplianceMatrixGenerator(rfp_id="rfp-abc")
	matrix.add_entry(requirement_text="First")
	mid = await matrix.save_to_db(db_session)

	matrix.entries.clear()
	matrix.add_entry(requirement_text="Second")
	await matrix.save_to_db(db_session)

	loaded = await ComplianceMatrixGenerator.load_from_db(mid, db_session)
	assert len(loaded.entries) == 1
	assert loaded.entries[0].requirement_text == "Second"
```

The `db_session` fixture should already exist in `tests/ci/conftest.py`. If not, add one using asyncpg.

**Step 6: Verify + commit.**
```bash
uv run pytest tests/ci/test_compliance_matrix_persistence.py -vxs
git add migrations/ src/docfusion/rfp/compliance_matrix.py tests/ci/test_compliance_matrix_persistence.py
git commit -m "feat(rfp): persist compliance matrix to PostgreSQL [G-RFP-03]"
```

## Notes for less-capable agents

- Do NOT drop or alter the existing Drizzle schema. The Drizzle side already has these tables for the Next.js path — you are mirroring them in Alembic so Python can read/write the same rows.
- If the column names in your Drizzle migration differ from above, make your Alembic migration **match Drizzle exactly**. Drizzle is the source of truth.
- `ON CONFLICT (id) DO UPDATE` requires the id to be a primary key — which it is in the schema above. Good.

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Compliance matrix persistence via Alembic migration matching Drizzle schema; save/load methods with 5 passing tests
<!-- SECTION:NOTES:END -->
