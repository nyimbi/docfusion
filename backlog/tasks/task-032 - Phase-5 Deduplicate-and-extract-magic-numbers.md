---
id: task-032
title: "Phase 5: Deduplicate logic and extract magic numbers"
status: To Do
phase: 5
gap_ids: [findings-plan-4.1, findings-plan-4.2, findings-plan-4.3, findings-plan-4.4]
priority: Low
---

# task-032 - Phase 5: Deduplicate logic and extract magic numbers

## Description (the why)

Four documented duplication hot spots and scattered magic numbers across Python and TypeScript. We centralize.

## Acceptance Criteria (the what)

- [ ] `frontend/lib/actions/opportunity-filters.ts` exists with a `buildOpportunityConditions(filters)` function; all 4 opportunity list functions delegate to it.
- [ ] `frontend/lib/actions/import-opportunities.ts` has a shared `executeImport` helper used by both `importFromFile` and `importFromBuffer`.
- [ ] Category detection lives in a single module (`backend/discovery/pipeline/categorizer.py`); the duplicates in `base.py` and `update_africa_rfps.py` delegate.
- [ ] `backend/discovery/constants.py` holds scraper thresholds; `frontend/lib/render/pptx-constants.ts` holds slide values; `frontend/lib/ai/constants.ts` holds AI thresholds.
- [ ] Existing tests pass.

## Implementation Plan (the how)

**Step 1 — Opportunity filter builder.**

Read the 4 list functions in `frontend/lib/actions/opportunities.ts`. Find the filter-condition construction block that appears in each. Extract to:

```typescript
// frontend/lib/actions/opportunity-filters.ts
import { eq, and, gte, lte, ilike, inArray } from 'drizzle-orm';
import { opportunities } from '@/lib/db/schema';

export interface OpportunityFilters {
	status?: string[];
	priority?: string[];
	search?: string;
	minValue?: number;
	maxValue?: number;
	// ...
}

export function buildOpportunityConditions(filters: OpportunityFilters) {
	const conditions = [];
	if (filters.status?.length) conditions.push(inArray(opportunities.status, filters.status));
	if (filters.priority?.length) conditions.push(inArray(opportunities.priority, filters.priority));
	if (filters.search) conditions.push(ilike(opportunities.title, `%${filters.search}%`));
	if (filters.minValue != null) conditions.push(gte(opportunities.value, filters.minValue));
	if (filters.maxValue != null) conditions.push(lte(opportunities.value, filters.maxValue));
	return conditions.length ? and(...conditions) : undefined;
}
```

Refactor each of the 4 functions to call `buildOpportunityConditions(filters)`.

**Step 2 — Import pipeline.**

Extract the shared core from `importFromFile` and `importFromBuffer`:

```typescript
async function executeImport(sheets: Sheet[], filename: string, config: ImportConfig): Promise<ImportResult> {
	// The shared logic.
}

export async function importFromFile(file: File, config: ImportConfig) {
	const sheets = await parseFile(file);
	return executeImport(sheets, file.name, config);
}

export async function importFromBuffer(buffer: Buffer, filename: string, config: ImportConfig) {
	const sheets = await parseBuffer(buffer, filename);
	return executeImport(sheets, filename, config);
}
```

**Step 3 — Category detection.**

Find the `categorize*` functions in `backend/discovery/scrapers/base.py` and `data/Opportunities/TenderSourceMax/update_africa_rfps.py`. Both should import from:

```python
# backend/discovery/pipeline/categorizer.py
class OpportunityCategorizer:
	def categorize(self, text: str) -> str:
		# Single canonical regex-based categorization.
		...
```

And delegate:

```python
# base.py
from backend.discovery.pipeline.categorizer import OpportunityCategorizer
_categorizer = OpportunityCategorizer()

def categorize_opportunity(text: str) -> str:
	return _categorizer.categorize(text)
```

**Step 4 — Magic number constants.**

For each module with a hardcoded number (e.g. `if score > 0.75:`), extract to `constants.py`:

```python
# backend/discovery/constants.py
# Scoring thresholds
MIN_CONFIDENCE_SCORE = 0.75
HIGH_PRIORITY_THRESHOLD = 0.90
DEDUP_SIMILARITY_THRESHOLD = 0.85

# Weights
TITLE_MATCH_WEIGHT = 0.6
DESCRIPTION_MATCH_WEIGHT = 0.4
```

Then replace each magic number at its call site with a named import.

Do the same for `frontend/lib/render/pptx-constants.ts` and `frontend/lib/ai/constants.ts` (TypeScript pattern: `export const MIN_CONFIDENCE_SCORE = 0.75;`).

**Step 5: Verify + commit per logical group.**
```bash
uv run pytest tests/ci/ -vxs
cd frontend && npx vitest run

git add frontend/lib/actions/opportunity-filters.ts frontend/lib/actions/opportunities.ts
git commit -m "refactor(frontend): extract opportunity filter builder [findings-plan-4.1]"

git add frontend/lib/actions/import-opportunities.ts
git commit -m "refactor(frontend): shared executeImport helper [findings-plan-4.2]"

git add backend/discovery/pipeline/categorizer.py backend/discovery/scrapers/base.py data/
git commit -m "refactor(discovery): single categorizer source [findings-plan-4.3]"

git add backend/discovery/constants.py frontend/lib/render/pptx-constants.ts frontend/lib/ai/constants.ts
git commit -m "refactor: extract magic numbers to named constants [findings-plan-4.4]"
```

## Notes for less-capable agents

- Commit each sub-task separately. This makes bisecting easier if something breaks.
- If two call sites use slightly different numbers for the same concept (0.75 vs 0.8), PICK ONE — the higher one by default — and flag the change in Implementation Notes. Don't create two constants.
