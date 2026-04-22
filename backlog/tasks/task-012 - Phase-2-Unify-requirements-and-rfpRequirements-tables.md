---
id: TASK-012
title: 'Phase 2: Unify requirements and rfpRequirements tables'
status: In Progress
assignee: []
created_date: ''
updated_date: '2026-04-22 22:18'
labels: []
dependencies:
  - task-011
priority: high
---

# task-012 - Phase 2: Unify requirements and rfpRequirements tables

## Description (the why)

Two separate requirements tables (`requirements` used by opportunities UI, `rfpRequirements` used by RFP pipeline) are not synchronized. Different columns, different writers. The unified target is `rfpRequirements` with an added `aiAnalysis jsonb` column. Old `requirements` stays behind a feature flag for two weeks of shadow-write safety, then drops.

## Acceptance Criteria (the what)

- [ ] Drizzle migration adds `aiAnalysis jsonb` column to `rfpRequirements` and copies all rows from `requirements` into `rfpRequirements` with a documented column map.
- [ ] Server actions in `frontend/lib/actions/requirements.ts` read from `rfpRequirements` only.
- [ ] Components in `frontend/app/(app)/opportunities/[id]/requirements/` render from `rfpRequirements` only.
- [ ] The legacy `requirements` table is dropped in the same migration (no shadow-write window — platform has no active users).
- [ ] Integration test confirms the merged path works end-to-end.

## Implementation Plan (the how)

**Step 1: Study both schemas.**
```bash
grep -n "requirements\|rfpRequirements" frontend/lib/db/schema.ts frontend/lib/db/schema-rfp.ts
```

Write down the column map in `backlog/docs/requirements-unification-column-map.md`:

```markdown
| requirements (old)  | rfpRequirements (target) | Action           |
|---------------------|--------------------------|------------------|
| id                  | id                       | direct           |
| opportunityId       | opportunityId            | direct           |
| requirementId       | requirementNumber        | rename           |
| text                | requirementText          | rename           |
| source              | sourceQuote              | rename           |
| sourcePageRef       | sourcePage               | rename, cast     |
| priority            | priority                 | direct           |
| complianceStatus    | complianceStatus         | direct           |
| responseStrategy    | responseStrategy         | direct           |
| assignedTo          | assignedTo               | direct           |
| riskLevel           | riskLevel                | direct           |
| aiAnalysis          | aiAnalysis               | NEW jsonb column |
```

**Step 2: Generate the Drizzle migration.**
```bash
cd frontend
# Edit schema-rfp.ts: add aiAnalysis column.
# Then:
npx drizzle-kit generate
```

The generated SQL file will be under `frontend/drizzle/`. Add the backfill manually:

```sql
-- frontend/drizzle/XXXX_unify_requirements.sql
ALTER TABLE "rfp_requirements" ADD COLUMN IF NOT EXISTS "ai_analysis" jsonb;

INSERT INTO "rfp_requirements" (
	id, opportunity_id, requirement_number, requirement_text,
	source_quote, source_page, priority, compliance_status,
	response_strategy, assigned_to, risk_level, ai_analysis
)
SELECT
	r.id, r.opportunity_id, r.requirement_id, r.text,
	r.source, NULLIF(r.source_page_ref, '')::integer, r.priority, r.compliance_status,
	r.response_strategy, r.assigned_to, r.risk_level, r.ai_analysis
FROM "requirements" r
WHERE NOT EXISTS (
	SELECT 1 FROM "rfp_requirements" rr WHERE rr.id = r.id
);

DROP TABLE "requirements";
```

**Step 3: Update TypeScript schema.**

In `frontend/lib/db/schema-rfp.ts`, add:
```typescript
aiAnalysis: jsonb('ai_analysis'),
```

**Step 4: Migrate server actions.** Find every read/write:
```bash
grep -rn "\\brequirements\\b" frontend/lib/actions/ --include="*.ts" | grep -v rfpRequirements
```

For each hit, change the table reference from `requirements` to `rfpRequirements`. Adjust column names (e.g. `text` → `requirementText`). Preserve function signatures so callers don't break.

**Step 5: Remove the legacy table definition** from `frontend/lib/db/schema.ts` in the same commit as the migration. No shadow-write — the platform has no users, so no cutover risk.

**Step 6: Update components.** Find usages:
```bash
grep -rn "import.*requirements" frontend/app/ frontend/components/ --include="*.tsx"
```

Update imports to target the new schema fields. React prop types may need adjustment.

**Step 7: Write integration test.**

```typescript
// frontend/__tests__/actions/requirements-unification.test.ts
import { describe, it, expect } from 'vitest';
import { createRequirement, getRequirements } from '@/lib/actions/requirements';

describe('requirements unification', () => {
	it('writes only to rfpRequirements when shadow write is off', async () => {
		process.env.SHADOW_WRITE_REQUIREMENTS = 'false';
		const r = await createRequirement({ opportunityId: 'op1', text: 'test' });
		const listed = await getRequirements('op1');
		expect(listed.some((x) => x.id === r.id)).toBe(true);
	});
});
```

**Step 8: Verify.**
```bash
cd frontend && npx drizzle-kit push && npx vitest run __tests__/actions/requirements-unification.test.ts
```

**Step 9: Commit.**
```bash
git add frontend/drizzle/ frontend/lib/ frontend/app/ frontend/components/ backlog/docs/requirements-unification-column-map.md
git commit -m "feat(data): unify requirements tables with shadow write [G-DATA-01]"
```

## Notes for less-capable agents

- No users are on the platform yet. The migration drops the legacy table in the same step — no shadow-write, no soak.
- If a component uses an old column name (`text`) and the new column is `requirementText`, rename at the call sites directly. No backward-compat shim needed.
- Run the Drizzle migration against a fresh dev DB first to catch any column-type errors.
