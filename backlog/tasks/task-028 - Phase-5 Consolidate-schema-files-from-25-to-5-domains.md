---
id: task-028
title: "Phase 5: Consolidate schema files from 25 to 5 domains"
status: To Do
phase: 5
gap_ids: [findings-plan-5.1]
priority: Medium
---

# task-028 - Phase 5: Consolidate schema files from 25 to 5 domains

## Description (the why)

`frontend/lib/db/schema-*.ts` has 25 files. Finding a table requires grepping; cross-table relations span files. Consolidate into five domain-oriented schemas. Backwards compatibility via re-exports from `schema.ts`.

## Acceptance Criteria (the what)

- [ ] `frontend/lib/db/schema.ts` re-exports from five files: `schema-core.ts`, `schema-crm.ts`, `schema-workflow.ts`, `schema-intelligence.ts`, `schema-integration.ts`.
- [ ] Every table previously defined in a `schema-*.ts` file lives in one of the five new files.
- [ ] `npm run db:push` (or `drizzle-kit push`) succeeds without diff (schema is semantically unchanged).
- [ ] All existing imports from `@/lib/db/schema` continue to resolve.

## Implementation Plan (the how)

**Step 1: Inventory the 25 files.**
```bash
ls frontend/lib/db/schema-*.ts
```

**Step 2: Map tables to domains.** Use this bucketing:

- **core**: opportunities, documents, templates, users, sessions
- **crm**: accounts, contacts, deals, activities
- **workflow**: pipeline, reviews, approvals, comments, tasks
- **intelligence**: pricing, pwin, competitive, evidence, win_themes
- **integration**: scrapers, imports, partners, opportunity_documents

Write the mapping in `backlog/docs/schema-consolidation-map.md`.

**Step 3: Create the five destination files.** Start each one with:

```typescript
// frontend/lib/db/schema-core.ts
import { pgTable, text, timestamp, jsonb, integer, boolean } from 'drizzle-orm/pg-core';

// Paste the table definitions from the old schema-*.ts files here.
```

**Step 4: Copy tables into destination files.** Do NOT delete the source files yet — we want Drizzle to produce zero-diff output as proof of equivalence.

**Step 5: Update `schema.ts`.**

```typescript
// frontend/lib/db/schema.ts
export * from './schema-core';
export * from './schema-crm';
export * from './schema-workflow';
export * from './schema-intelligence';
export * from './schema-integration';
```

**Step 6: Drop the old `schema-*.ts` sources** (the ones you copied from). Make sure no file still imports from them:

```bash
grep -rn "from.*schema-opportunities\|from.*schema-crm-legacy" frontend/
```

**Step 7: Verify zero diff.**
```bash
cd frontend
npx drizzle-kit generate
# Review the generated SQL. Expected: no new migration, or an empty one.
```

If Drizzle produces a migration, you missed a column somewhere — diff the old vs new schema files until they match.

**Step 8: Commit.**
```bash
git add frontend/lib/db/ backlog/docs/schema-consolidation-map.md
git commit -m "refactor(frontend): consolidate 25 schema files into 5 domains [findings-plan-5.1]"
```

## Notes for less-capable agents

- This task is mechanical but error-prone. Work in small batches — consolidate one domain at a time, commit, verify, then move on.
- If two old schema files defined the same table (unlikely but possible), the last one wins. Flag it.
- Preserve export names exactly. The codebase imports tables by name.
