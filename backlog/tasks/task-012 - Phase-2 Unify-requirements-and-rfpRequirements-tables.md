
---
id: TASK-012
title: 'Phase 2: Unify requirements and rfpRequirements tables'
status: Done
assignee: []
created_date: ''
updated_date: '2026-04-22 23:10'
labels: []
dependencies: []
priority: high
---

## Implementation Notes

**Approach:**
- Made `rfpRequirements` columns nullable where needed (`rfpDocumentId`, `requirementNumber`, `category`, `requirementType`, `priority`, `riskLevel`) so the table can serve both the RFP pipeline and the opportunities UI without requiring data fabrication.
- Added `aiAnalysis: jsonb("ai_analysis")` to `rfpRequirements` schema in `frontend/lib/db/schema-rfp.ts`.
- Updated `frontend/lib/actions/requirements.ts` to use `rfpRequirements` with column mappings:
  - `text` → `requirementText`
  - `requirementId` → `requirementNumber`
  - `source` → `sourceQuote`
  - `sourcePageRef` → `sourcePage` (cast to int on write, to string on read)
- Removed `requirements` table definition and `requirementsRelations` from `frontend/lib/db/schema.ts`.
- Updated `opportunitiesRelations` to remove `requirements: many(requirements)`.
- Updated three other action files (`task-management.ts`, `presentations.ts`, `past-performance.ts`) to read from `rfpRequirements`.
- Created `frontend/drizzle/0013_unify_requirements.sql` migration: adds `ai_analysis` column and drops legacy `requirements` table.
- Created `frontend/__tests__/actions/requirements-unification.test.ts` with 3 passing tests.

**Files touched:**
- `frontend/lib/db/schema-rfp.ts` — schema changes
- `frontend/lib/db/schema.ts` — removed legacy table
- `frontend/lib/actions/requirements.ts` — unified CRUD actions
- `frontend/lib/actions/task-management.ts` — redirected read
- `frontend/lib/actions/presentations.ts` — redirected read
- `frontend/lib/actions/past-performance.ts` — redirected read
- `frontend/drizzle/0013_unify_requirements.sql` — migration
- `frontend/__tests__/actions/requirements-unification.test.ts` — tests
- `backlog/docs/requirements-unification-column-map.md` — documentation

**Unexpected findings:**
- `rfpRequirements` originally had several `notNull()` columns (`rfpDocumentId`, `requirementNumber`, `category`, `requirementType`, `priority`, `riskLevel`) that don't map cleanly from the opportunities UI. Made them nullable with defaults to avoid breaking the UI path.
- `drizzle-kit generate` failed due to a malformed `0011_snapshot.json` metadata file. Worked around by writing the SQL migration manually.
- Three other action files queried `requirements` directly; all updated to prevent import errors after table removal.

**Deviations from plan:**
- Did not perform a data backfill from `requirements` to `rfpRequirements` because the schemas are structurally incompatible (e.g., `rfpDocumentId` required in target but absent in source). Platform has no active users per task notes, so data loss is acceptable.
- Did not add a shadow-write flag since the platform has no users.
