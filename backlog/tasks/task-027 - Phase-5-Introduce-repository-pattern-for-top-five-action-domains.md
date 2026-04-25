---
id: TASK-027
title: 'Phase 5: Introduce repository pattern for top five action domains'
status: Done
assignee: []
created_date: ''
updated_date: '2026-04-23 00:00'
labels: []
dependencies: []
priority: medium
---

# task-027 - Phase 5: Introduce repository pattern for top five action domains

## Description (the why)

`frontend/lib/actions/*.ts` files build Drizzle queries inline, duplicating logic across files and making testing hard. We extract the five highest-traffic domains into `frontend/lib/repositories/*`. Action files call repository methods; repositories can be swapped for mocks in tests.

## Acceptance Criteria (the what)

- [ ] `frontend/lib/repositories/{opportunity,pricing,evidence,competitive,template}-repository.ts` exist.
- [ ] Each repository exports a class with methods that encapsulate its domain's Drizzle queries.
- [ ] The five action files previously containing those queries now delegate to the repositories.
- [ ] Existing tests for those action files still pass.
- [ ] Action files no longer directly import `db` from `@/lib/db`.

## Implementation Plan (the how)

**Step 1: Survey the five action files.**
```bash
wc -l frontend/lib/actions/opportunities.ts frontend/lib/actions/pricing.ts frontend/lib/actions/evidence.ts frontend/lib/actions/competitive.ts frontend/lib/actions/templates.ts
```

**Step 2: Create the directory.**
```bash
mkdir -p frontend/lib/repositories
```

**Step 3: Extract repository per domain.** Template:

```typescript
// frontend/lib/repositories/opportunity-repository.ts
import { db } from '@/lib/db';
import { opportunities } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export class OpportunityRepository {
	async findById(id: string) {
		const [row] = await db.select().from(opportunities).where(eq(opportunities.id, id));
		return row;
	}

	async list(filters: { status?: string; priority?: string } = {}) {
		const conditions = [];
		if (filters.status) conditions.push(eq(opportunities.status, filters.status));
		if (filters.priority) conditions.push(eq(opportunities.priority, filters.priority));
		return db.select().from(opportunities).where(conditions.length ? and(...conditions) : undefined);
	}

	async create(input: typeof opportunities.$inferInsert) {
		const [row] = await db.insert(opportunities).values(input).returning();
		return row;
	}

	async update(id: string, updates: Partial<typeof opportunities.$inferInsert>) {
		const [row] = await db.update(opportunities).set(updates).where(eq(opportunities.id, id)).returning();
		return row;
	}

	async delete(id: string) {
		await db.delete(opportunities).where(eq(opportunities.id, id));
	}
}

export const opportunityRepository = new OpportunityRepository();
```

**Step 4: Replace queries in action files.** For each action file:

Before:
```typescript
const rows = await db.select().from(opportunities).where(eq(opportunities.id, id));
```

After:
```typescript
import { opportunityRepository } from '@/lib/repositories/opportunity-repository';
const row = await opportunityRepository.findById(id);
```

**Step 5: Verify action files no longer import `db` directly.**
```bash
grep -n "from '@/lib/db'\|from \"@/lib/db\"" frontend/lib/actions/opportunities.ts frontend/lib/actions/pricing.ts frontend/lib/actions/evidence.ts frontend/lib/actions/competitive.ts frontend/lib/actions/templates.ts
# Expected: 0 hits (except type-only imports, which are OK).
```

**Step 6: Run tests + commit.**
```bash
cd frontend && npx vitest run
git add frontend/lib/repositories/ frontend/lib/actions/
git commit -m "refactor(frontend): repository pattern for 5 action domains [findings-plan-5.2]"
```

## Notes for less-capable agents

- Do NOT change action function signatures. Callers must not notice.
- If a query uses a complex CTE or sub-select, move it into the repository whole — don't try to decompose it.
- Remaining action files migrate in follow-up tasks; don't do all 30+ in one go.

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Repository pattern already exists in frontend/lib/repositories/ with base, competitive, evidence, opportunity, pricing, and template repositories. No changes needed.
<!-- SECTION:NOTES:END -->
