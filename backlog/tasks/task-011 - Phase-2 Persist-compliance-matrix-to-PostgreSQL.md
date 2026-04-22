
## Implementation Notes

**Approach:**
- Inspected Drizzle schema in `frontend/drizzle/meta/0007_snapshot.json` to understand the actual table structure.
- Created Alembic migration `migrations/versions/2026_04_22_2216_2e95cd515199_add_compliance_matrices_and_compliance_.py` that mirrors the Drizzle schema exactly for both `compliance_matrices` and `compliance_entries` tables, including all columns, defaults, indexes, and foreign keys.
- Added `save_to_db(session, matrix)` instance method to `ComplianceMatrixGenerator` that:
  - Calculates compliance counts (total, mandatory, compliant, partial, not_addressed) from matrix mappings
  - Computes `compliance_score` and `mandatory_compliance_score`
  - Upserts the matrix row with `ON CONFLICT (id) DO UPDATE`
  - Atomically replaces entries via DELETE + INSERT
- Added `load_from_db(matrix_id, session)` static method that reconstructs a `ComplianceMatrix` with full `RequirementMapping` objects from database rows.
- Both methods accept `session: Any` (SQLAlchemy AsyncSession or asyncpg connection) and use `sqlalchemy.text` for queries.

**Files touched:**
- `migrations/versions/2026_04_22_2216_2e95cd515199_add_compliance_matrices_and_compliance_.py` — new Alembic migration.
- `src/docfusion/rfp/compliance_matrix.py` — added `save_to_db`, `load_from_db`, `json` import, `timezone` import.
- `tests/ci/test_compliance_matrix_persistence.py` — 5 tests: insert round-trip, load reconstruction, missing matrix error, overwrite behavior, count calculation.

**Unexpected findings:**
- Drizzle schema is significantly richer than the task plan assumed: `compliance_matrices` has 27 columns including score fields, review/approval tracking, JSONB config columns. `compliance_entries` has 25 columns with workflow fields (`assigned_to`, `due_date`, `completion_percent`).
- The Python `ComplianceMatrix` model uses `rfp_id` while Drizzle uses `opportunity_id` — mapped during save/load.
- `RequirementMapping` has no direct `requirement_text` storage in `compliance_entries`; stored in mapping metadata JSONB instead.

**Deviations from plan:**
- Migration schema follows Drizzle exactly rather than the simplified schema in the task plan. Drizzle is the source of truth per task notes.
- `save_to_db` takes `matrix: ComplianceMatrix` as an explicit parameter rather than using `self.id` / `self.entries`, since `ComplianceMatrixGenerator` stores matrices in `_matrices` dict and doesn't have instance-level matrix state.
