# RFP Pipeline W0 — Foundation: Tenant Schema, Python Taxonomy, AI Analysis Schema

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the `organization_id` column on every RFP table, the `requireTenantContext()` auth helper, the Python `Requirement` model split (modality vs. category), and a versioned `aiAnalysis` JSONB schema enforced on both sides. After W0 ships, the database carries tenant identity on every row, both Python and TypeScript agree on requirement categorisation, and `aiAnalysis` is no longer a free-for-all bag of fields.

**Architecture:**
- Drizzle migration `0021_rfp_tenant_isolation.sql` adds `organization_id varchar(100)` to all RFP tables, backfills via `userWorkspaces.isDefault → earliest workspace → __MIGRATED_LEGACY__ sentinel`, sets NOT NULL, and indexes the new column. `schema-rfp.ts` mirrors the change.
- A new `requireTenantContext()` in `frontend/lib/auth/tenant-context.ts` returns `{ userId, organizationId }` and throws when either is missing — replacing the optional `organizationId` in `auth-utils.ts:getUserContext()`.
- Python's existing `RequirementCategory` becomes `RequirementModality` (compliance posture: must / may / conditional). A new `RequirementCategory` enum is added with the 9 values from `schema-rfp.ts:598-608`. The `Requirement` Pydantic model gains a `category` field.
- `aiAnalysis` becomes a versioned discriminated union (zod + Pydantic), with `version: "1"` as the only initial variant.

**Tech Stack:** TypeScript, Next.js 14, Drizzle ORM, PostgreSQL 15, vitest; Python 3.10+, Pydantic v2, pytest.

---

### Task 1: Frontend test — schema carries `organizationId`

**Files:**
- Create: `frontend/__tests__/db/schema-rfp-tenant.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/__tests__/db/schema-rfp-tenant.test.ts
import { describe, it, expect } from "vitest";
import {
	rfpDocuments,
	rfpRequirements,
	rfpParsingJobs,
	complianceMatrices,
	complianceEntries,
} from "@/lib/db/schema-rfp";

describe("RFP tenant isolation schema", () => {
	const tablesUnderTest = [
		{ name: "rfpDocuments", table: rfpDocuments },
		{ name: "rfpRequirements", table: rfpRequirements },
		{ name: "rfpParsingJobs", table: rfpParsingJobs },
		{ name: "complianceMatrices", table: complianceMatrices },
		{ name: "complianceEntries", table: complianceEntries },
	] as const;

	for (const { name, table } of tablesUnderTest) {
		it(`${name} carries a NOT NULL organizationId column`, () => {
			const col = (table as unknown as Record<string, unknown>).organizationId;
			expect(col, `${name}.organizationId must exist`).toBeDefined();
			const meta = col as { notNull?: boolean };
			expect(meta.notNull, `${name}.organizationId must be NOT NULL`).toBe(true);
		});
	}
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
cd frontend && npx vitest run __tests__/db/schema-rfp-tenant.test.ts
```

Expected: 5 failures — `organizationId must exist`.

- [ ] **Step 3: Commit the failing test**

```bash
git add frontend/__tests__/db/schema-rfp-tenant.test.ts
git commit -m "test(rfp): assert organization_id on RFP schema (failing)"
```

---

### Task 2: Drizzle migration 0021 — add column, backfill, lock down

**Files:**
- Create: `frontend/drizzle/0021_rfp_tenant_isolation.sql`

- [ ] **Step 1: Write the migration**

```sql
-- frontend/drizzle/0021_rfp_tenant_isolation.sql
-- Add organization_id to all RFP tables, backfill from user_workspaces, set NOT NULL, index.
-- Backfill order: default workspace -> earliest workspace -> __MIGRATED_LEGACY__ sentinel.

BEGIN;

-- 1. Add columns nullable so backfill can run.
ALTER TABLE rfp_documents       ADD COLUMN IF NOT EXISTS organization_id varchar(100);
ALTER TABLE rfp_requirements    ADD COLUMN IF NOT EXISTS organization_id varchar(100);
ALTER TABLE rfp_parsing_jobs    ADD COLUMN IF NOT EXISTS organization_id varchar(100);
ALTER TABLE compliance_matrices ADD COLUMN IF NOT EXISTS organization_id varchar(100);
ALTER TABLE compliance_entries  ADD COLUMN IF NOT EXISTS organization_id varchar(100);

-- 2. Sentinel org for orphan rows. Ops can reassign later.
INSERT INTO organization_settings (organization_id, company_name, primary_color, secondary_color)
VALUES ('__MIGRATED_LEGACY__', 'Migrated Legacy Tenant', '#0066CC', '#00A3E0')
ON CONFLICT (organization_id) DO NOTHING;

-- 3. Backfill rfp_documents from the user's default workspace, then earliest workspace, then sentinel.
UPDATE rfp_documents d
SET organization_id = COALESCE(
    (SELECT uw.organization_id FROM user_workspaces uw
     WHERE uw.user_id = d.uploaded_by AND uw.is_default = true LIMIT 1),
    (SELECT uw.organization_id FROM user_workspaces uw
     WHERE uw.user_id = d.uploaded_by ORDER BY uw.joined_at ASC LIMIT 1),
    '__MIGRATED_LEGACY__'
)
WHERE d.organization_id IS NULL;

-- 4. Children inherit from rfp_documents.
UPDATE rfp_requirements r
SET organization_id = d.organization_id
FROM rfp_documents d
WHERE r.rfp_document_id = d.id AND r.organization_id IS NULL;

UPDATE rfp_parsing_jobs j
SET organization_id = d.organization_id
FROM rfp_documents d
WHERE j.rfp_document_id = d.id AND j.organization_id IS NULL;

-- compliance_matrices.rfp_document_id is nullable; fall back to created_by's default workspace.
UPDATE compliance_matrices m
SET organization_id = COALESCE(
    (SELECT d.organization_id FROM rfp_documents d WHERE d.id = m.rfp_document_id),
    (SELECT uw.organization_id FROM user_workspaces uw
     WHERE uw.user_id = m.created_by AND uw.is_default = true LIMIT 1),
    '__MIGRATED_LEGACY__'
)
WHERE m.organization_id IS NULL;

UPDATE compliance_entries e
SET organization_id = m.organization_id
FROM compliance_matrices m
WHERE e.matrix_id = m.id AND e.organization_id IS NULL;

-- 5. Lock down — every row must have an org now.
ALTER TABLE rfp_documents       ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE rfp_requirements    ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE rfp_parsing_jobs    ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE compliance_matrices ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE compliance_entries  ALTER COLUMN organization_id SET NOT NULL;

-- 6. Per-table tenant index.
CREATE INDEX IF NOT EXISTS rfp_docs_org_idx            ON rfp_documents(organization_id);
CREATE INDEX IF NOT EXISTS rfp_reqs_org_idx            ON rfp_requirements(organization_id);
CREATE INDEX IF NOT EXISTS rfp_parsing_jobs_org_idx    ON rfp_parsing_jobs(organization_id);
CREATE INDEX IF NOT EXISTS compliance_matrices_org_idx ON compliance_matrices(organization_id);
CREATE INDEX IF NOT EXISTS compliance_entries_org_idx  ON compliance_entries(organization_id);

-- 7. Composite indexes for the most common access pattern (WHERE org = $1 AND id = $2).
CREATE INDEX IF NOT EXISTS rfp_docs_org_id_idx           ON rfp_documents(organization_id, id);
CREATE INDEX IF NOT EXISTS rfp_reqs_org_doc_idx          ON rfp_requirements(organization_id, rfp_document_id);
CREATE INDEX IF NOT EXISTS compliance_matrices_org_id_idx ON compliance_matrices(organization_id, id);

COMMIT;
```

- [ ] **Step 2: Apply against a dev DB and confirm row counts**

```bash
cd frontend && DATABASE_URL=$DATABASE_URL_DEV npx drizzle-kit migrate
```

```bash
psql "$DATABASE_URL_DEV" -c "
  SELECT 'rfp_documents'        AS t, COUNT(*) FILTER (WHERE organization_id IS NULL) AS null_count, COUNT(*) AS total FROM rfp_documents
  UNION ALL SELECT 'rfp_requirements',     COUNT(*) FILTER (WHERE organization_id IS NULL), COUNT(*) FROM rfp_requirements
  UNION ALL SELECT 'rfp_parsing_jobs',     COUNT(*) FILTER (WHERE organization_id IS NULL), COUNT(*) FROM rfp_parsing_jobs
  UNION ALL SELECT 'compliance_matrices',  COUNT(*) FILTER (WHERE organization_id IS NULL), COUNT(*) FROM compliance_matrices
  UNION ALL SELECT 'compliance_entries',   COUNT(*) FILTER (WHERE organization_id IS NULL), COUNT(*) FROM compliance_entries;
"
```

Expected: every `null_count` is 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/drizzle/0021_rfp_tenant_isolation.sql
git commit -m "feat(rfp): migration 0021 add organization_id with backfill"
```

---

### Task 3: Drizzle schema — add `organizationId` columns and indexes

**Files:**
- Modify: `frontend/lib/db/schema-rfp.ts`

- [ ] **Step 1: Add `organizationId` to `rfpDocuments`**

In the `rfpDocuments` definition, after the `id: uuid("id")...` field, add:

```typescript
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
```

In the same table's index list (currently ending at `uniqueIndex("rfp_docs_hash_idx")`), append:

```typescript
		index("rfp_docs_org_idx").on(table.organizationId),
		index("rfp_docs_org_id_idx").on(table.organizationId, table.id),
```

- [ ] **Step 2: Repeat for `rfpRequirements`**

After `id: uuid("id")...`, add the same column. In its index list, append:

```typescript
		index("rfp_reqs_org_idx").on(table.organizationId),
		index("rfp_reqs_org_doc_idx").on(table.organizationId, table.rfpDocumentId),
```

- [ ] **Step 3: Repeat for `complianceMatrices`, `complianceEntries`, `rfpParsingJobs`**

Same `organizationId` field after each `id`. Add to each index list:

- `complianceMatrices`:
```typescript
		index("compliance_matrices_org_idx").on(table.organizationId),
		index("compliance_matrices_org_id_idx").on(table.organizationId, table.id),
```
- `complianceEntries`:
```typescript
		index("compliance_entries_org_idx").on(table.organizationId),
```
- `rfpParsingJobs`:
```typescript
		index("rfp_parsing_jobs_org_idx").on(table.organizationId),
```

- [ ] **Step 4: Run the test from Task 1 to verify PASS**

```bash
cd frontend && npx vitest run __tests__/db/schema-rfp-tenant.test.ts
```

Expected: 5/5 PASS.

- [ ] **Step 5: Run typecheck — expect intentional errors**

```bash
cd frontend && npx tsc --noEmit --pretty false
```

Expected: errors at every `db.insert(rfpDocuments).values({...})` site that omitted `organizationId`. These are the surfaces W1 will fix. Note them; do NOT silence them with `as any` here.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/db/schema-rfp.ts
git commit -m "feat(rfp): add organizationId column to RFP schema tables"
```

---

### Task 4: `requireTenantContext()` helper

**Files:**
- Create: `frontend/lib/auth/tenant-context.ts`
- Test: `frontend/__tests__/auth/tenant-context.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/__tests__/auth/tenant-context.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-utils", () => ({
	getServerSession: vi.fn(),
}));

import { requireTenantContext } from "@/lib/auth/tenant-context";
import { getServerSession } from "@/lib/auth-utils";

describe("requireTenantContext", () => {
	beforeEach(() => vi.resetAllMocks());

	it("returns userId and organizationId when both are present", async () => {
		(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
			user: { id: "user-123", organizationId: "org-abc" },
		});
		await expect(requireTenantContext()).resolves.toEqual({
			userId: "user-123",
			organizationId: "org-abc",
		});
	});

	it("throws Unauthorized when session is missing", async () => {
		(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		await expect(requireTenantContext()).rejects.toThrow("Unauthorized");
	});

	it("throws Unauthorized when userId is missing", async () => {
		(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
			user: { organizationId: "org-abc" },
		});
		await expect(requireTenantContext()).rejects.toThrow("Unauthorized");
	});

	it("throws No organization context when org is missing", async () => {
		(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
			user: { id: "user-123" },
		});
		await expect(requireTenantContext()).rejects.toThrow("No organization context");
	});
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
cd frontend && npx vitest run __tests__/auth/tenant-context.test.ts
```

Expected: 4 failures — module not found.

- [ ] **Step 3: Implement the helper**

```typescript
// frontend/lib/auth/tenant-context.ts
import { getServerSession } from "@/lib/auth-utils";

export interface TenantContext {
	readonly userId: string;
	readonly organizationId: string;
}

/**
 * Resolve the current tenant context for a server component, server action, or route handler.
 *
 * Hard-fails with `Unauthorized` (no session / no user id) or `No organization context`
 * (session exists but `organizationId` is missing). The absence of an org is never
 * an acceptable default — callers that need to handle org-less users must enroll
 * them in a workspace first.
 */
export async function requireTenantContext(): Promise<TenantContext> {
	const session = await getServerSession();
	const userId = session?.user?.id;
	if (!userId) {
		throw new Error("Unauthorized");
	}
	const organizationId = (session.user as { organizationId?: string }).organizationId;
	if (!organizationId) {
		throw new Error("No organization context");
	}
	return { userId, organizationId };
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
cd frontend && npx vitest run __tests__/auth/tenant-context.test.ts
```

Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/auth/tenant-context.ts frontend/__tests__/auth/tenant-context.test.ts
git commit -m "feat(auth): add requireTenantContext() helper"
```

---

### Task 5: Python — rename `RequirementCategory` → `RequirementModality`

**Files:**
- Modify: `src/docfusion/rfp/requirement_extractor.py:26-31` (enum)
- Modify: `src/docfusion/rfp/requirement_extractor.py:68-70` (Requirement field)
- Modify: callers across `src/docfusion/rfp/`, `src/docfusion/orchestration/`, and `tests/ci/`
- Create: `tests/ci/test_rfp_modality.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/ci/test_rfp_modality.py
"""Compliance posture is exposed as `modality`, not `category`."""

from docfusion.rfp.requirement_extractor import (
	Requirement,
	RequirementModality,
)


def test_modality_enum_has_three_values():
	assert {m.value for m in RequirementModality} == {
		"mandatory",
		"optional",
		"conditional",
	}


def test_requirement_has_modality_field():
	r = Requirement(text="The contractor shall...", modality=RequirementModality.MANDATORY)
	assert r.modality == RequirementModality.MANDATORY


def test_requirement_modality_defaults_to_mandatory():
	r = Requirement(text="The contractor shall...")
	assert r.modality == RequirementModality.MANDATORY
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
uv run pytest tests/ci/test_rfp_modality.py -v
```

Expected: ImportError for `RequirementModality`.

- [ ] **Step 3: Rename the enum**

In `src/docfusion/rfp/requirement_extractor.py` lines 26-31, replace:

```python
class RequirementModality(str, Enum):
	"""Compliance posture of an RFP requirement.

	The orthogonal subject-domain axis (technical/management/cost/...)
	lives in `RequirementCategory`, added in the next task.
	"""

	MANDATORY = "mandatory"  # "shall", "must", "required"
	OPTIONAL = "optional"  # "may", "should", "preferred"
	CONDITIONAL = "conditional"  # "if", "when", "where applicable"
```

In the `Requirement` model, replace the existing `category` field (lines 68-70):

```python
	modality: RequirementModality = Field(
		default=RequirementModality.MANDATORY,
		description="Compliance posture (must / may / conditional)",
	)
```

- [ ] **Step 4: Update in-module callers**

```bash
grep -n "RequirementCategory\|\.category\|category=" src/docfusion/rfp/requirement_extractor.py
```

For each hit, if the value is one of `mandatory|optional|conditional`, rename `RequirementCategory` → `RequirementModality` and `category` → `modality`. Pattern-keyword dictionaries that map text patterns to compliance posture (e.g. `"shall" → MANDATORY`) are modality references.

- [ ] **Step 5: Update the rest of the project**

```bash
grep -rln "RequirementCategory" src/docfusion tests examples
```

For each file: replace `RequirementCategory` with `RequirementModality` only where the value is one of `MANDATORY|OPTIONAL|CONDITIONAL`. Most likely files: `src/docfusion/rfp/__init__.py`, `src/docfusion/rfp/rfp_analyzer.py`, `src/docfusion/orchestration/proposal_orchestrator.py`, and existing `tests/ci/test_rfp_*.py` files.

- [ ] **Step 6: Run modality test plus the broader RFP suite**

```bash
uv run pytest tests/ci/test_rfp_modality.py tests/ci/test_rfp_requirement_extractor.py tests/ci/test_rfp_analyzer.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/docfusion/rfp/requirement_extractor.py src/docfusion/rfp/__init__.py \
        src/docfusion/rfp/rfp_analyzer.py src/docfusion/orchestration/proposal_orchestrator.py \
        tests/ci/test_rfp_modality.py
git commit -m "refactor(rfp): rename RequirementCategory to RequirementModality"
```

---

### Task 6: Python — add new `RequirementCategory` matching TS taxonomy

**Files:**
- Modify: `src/docfusion/rfp/requirement_extractor.py`
- Create: `tests/ci/test_rfp_category.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/ci/test_rfp_category.py
"""Python RequirementCategory must match TS REQUIREMENT_CATEGORIES exactly."""

from docfusion.rfp.requirement_extractor import RequirementCategory, Requirement


# Mirror of frontend/lib/db/schema-rfp.ts:598-608.
TS_CATEGORIES = frozenset({
	"technical", "management", "past_performance", "cost",
	"administrative", "personnel", "security", "compliance", "other",
})


def test_category_enum_matches_ts_taxonomy():
	py_categories = {c.value for c in RequirementCategory}
	assert py_categories == TS_CATEGORIES, (
		f"Python and TS taxonomies diverged. "
		f"Python only: {py_categories - TS_CATEGORIES}. "
		f"TS only: {TS_CATEGORIES - py_categories}."
	)


def test_category_default_is_other():
	r = Requirement(text="anything")
	assert r.category == RequirementCategory.OTHER
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
uv run pytest tests/ci/test_rfp_category.py -v
```

Expected: ImportError.

- [ ] **Step 3: Add the new enum**

After the `RequirementModality` definition, add:

```python
class RequirementCategory(str, Enum):
	"""Subject-domain classification — matches TS REQUIREMENT_CATEGORIES.

	Values MUST stay in sync with frontend/lib/db/schema-rfp.ts:598-608.
	A unit test enforces equality.
	"""

	TECHNICAL = "technical"
	MANAGEMENT = "management"
	PAST_PERFORMANCE = "past_performance"
	COST = "cost"
	ADMINISTRATIVE = "administrative"
	PERSONNEL = "personnel"
	SECURITY = "security"
	COMPLIANCE = "compliance"
	OTHER = "other"
```

- [ ] **Step 4: Run the enum test to verify PASS**

```bash
uv run pytest tests/ci/test_rfp_category.py::test_category_enum_matches_ts_taxonomy -v
```

Expected: PASS. The default-is-other test still fails — that's Task 7.

- [ ] **Step 5: Commit**

```bash
git add src/docfusion/rfp/requirement_extractor.py tests/ci/test_rfp_category.py
git commit -m "feat(rfp): add RequirementCategory enum matching TS taxonomy"
```

---

### Task 7: Python — add `category` field to `Requirement` model

**Files:**
- Modify: `src/docfusion/rfp/requirement_extractor.py`

- [ ] **Step 1: The failing test from Task 6 is our cue**

```bash
uv run pytest tests/ci/test_rfp_category.py::test_category_default_is_other -v
```

Expected: AttributeError.

- [ ] **Step 2: Add the field**

In the `Requirement` model, after the `modality` field (added in Task 5), add:

```python
	category: RequirementCategory = Field(
		default=RequirementCategory.OTHER,
		description="Subject domain (technical/management/cost/...) — orthogonal to modality",
	)
```

- [ ] **Step 3: Run the category tests to verify PASS**

```bash
uv run pytest tests/ci/test_rfp_category.py -v
```

Expected: 2/2 PASS.

- [ ] **Step 4: Run the full RFP suite to catch fallout**

```bash
uv run pytest tests/ci -k "rfp or requirement" -v
```

Expected: PASS. Pydantic `extra='forbid'` means any caller passing an unrecognised keyword fails fast — those are intentional surfaces.

- [ ] **Step 5: Commit**

```bash
git add src/docfusion/rfp/requirement_extractor.py
git commit -m "feat(rfp): add subject-domain category field to Requirement"
```

---

### Task 8: TypeScript `aiAnalysis` schema — versioned discriminated union

**Files:**
- Create: `frontend/lib/types/ai-analysis.ts`
- Test: `frontend/__tests__/types/ai-analysis.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/__tests__/types/ai-analysis.test.ts
import { describe, it, expect } from "vitest";
import {
	aiAnalysisSchema,
	parseAiAnalysis,
	type AiAnalysis,
} from "@/lib/types/ai-analysis";

describe("aiAnalysis schema v1", () => {
	it("accepts a valid v1 payload", () => {
		const valid: AiAnalysis = {
			version: "1",
			summary: "10 mandatory requirements detected",
			riskFactors: ["unfunded scope", "unclear evaluation criteria"],
			suggestedApproach: "Prioritize Section L compliance",
			ambiguityFlags: [{ requirementId: "r1", reason: "no metric" }],
			extractedAt: "2026-05-08T00:00:00Z",
		};
		expect(aiAnalysisSchema.parse(valid)).toEqual(valid);
	});

	it("rejects an unversioned payload", () => {
		expect(() => aiAnalysisSchema.parse({ summary: "..." })).toThrow();
	});

	it("rejects an unknown version", () => {
		expect(() =>
			aiAnalysisSchema.parse({ version: "99", summary: "..." }),
		).toThrow();
	});

	it("parseAiAnalysis returns null for null input", () => {
		expect(parseAiAnalysis(null)).toBeNull();
	});

	it("parseAiAnalysis throws on garbage", () => {
		expect(() => parseAiAnalysis({ random: "stuff" })).toThrow();
	});
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
cd frontend && npx vitest run __tests__/types/ai-analysis.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement the schema**

```typescript
// frontend/lib/types/ai-analysis.ts
import { z } from "zod";

const aiAnalysisV1 = z.object({
	version: z.literal("1"),
	summary: z.string(),
	riskFactors: z.array(z.string()).default([]),
	suggestedApproach: z.string().optional(),
	ambiguityFlags: z
		.array(z.object({ requirementId: z.string(), reason: z.string() }))
		.default([]),
	extractedAt: z.string().datetime(),
});

export const aiAnalysisSchema = z.discriminatedUnion("version", [aiAnalysisV1]);

export type AiAnalysis = z.infer<typeof aiAnalysisSchema>;
export type AiAnalysisV1 = z.infer<typeof aiAnalysisV1>;

export function parseAiAnalysis(value: unknown): AiAnalysis | null {
	if (value === null || value === undefined) return null;
	return aiAnalysisSchema.parse(value);
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
cd frontend && npx vitest run __tests__/types/ai-analysis.test.ts
```

Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/types/ai-analysis.ts frontend/__tests__/types/ai-analysis.test.ts
git commit -m "feat(rfp): versioned aiAnalysis schema (zod)"
```

---

### Task 9: Python `aiAnalysis` schema — Pydantic mirror

**Files:**
- Create: `src/docfusion/rfp/ai_analysis.py`
- Create: `tests/ci/test_ai_analysis_schema.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/ci/test_ai_analysis_schema.py
import pytest
from pydantic import ValidationError

from docfusion.rfp.ai_analysis import AiAnalysisV1, parse_ai_analysis


def test_v1_round_trips():
	payload = {
		"version": "1",
		"summary": "ten mandatory requirements",
		"riskFactors": ["unfunded scope"],
		"suggestedApproach": "address Section L first",
		"ambiguityFlags": [{"requirementId": "r1", "reason": "no metric"}],
		"extractedAt": "2026-05-08T00:00:00+00:00",
	}
	parsed = parse_ai_analysis(payload)
	assert isinstance(parsed, AiAnalysisV1)
	assert parsed.version == "1"
	assert parsed.summary == "ten mandatory requirements"


def test_none_returns_none():
	assert parse_ai_analysis(None) is None


def test_missing_version_rejected():
	with pytest.raises(ValidationError):
		parse_ai_analysis({"summary": "..."})


def test_unknown_version_rejected():
	with pytest.raises(ValidationError):
		parse_ai_analysis({"version": "99", "summary": "..."})


def test_extra_fields_rejected():
	with pytest.raises(ValidationError):
		parse_ai_analysis(
			{
				"version": "1",
				"summary": "x",
				"riskFactors": [],
				"ambiguityFlags": [],
				"extractedAt": "2026-05-08T00:00:00+00:00",
				"unknown": "field",
			}
		)
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
uv run pytest tests/ci/test_ai_analysis_schema.py -v
```

Expected: ImportError.

- [ ] **Step 3: Implement the schema**

```python
# src/docfusion/rfp/ai_analysis.py
"""Versioned aiAnalysis schema, mirror of frontend/lib/types/ai-analysis.ts.

Any change here MUST be mirrored in the TS module and vice-versa. The matched
test pair (tests/ci/test_ai_analysis_schema.py and
frontend/__tests__/types/ai-analysis.test.ts) is the contract.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter


class AmbiguityFlag(BaseModel):
	model_config = ConfigDict(extra="forbid", validate_by_name=True, validate_by_alias=True)

	requirementId: str
	reason: str


class AiAnalysisV1(BaseModel):
	"""Schema version 1 for `rfp_requirements.ai_analysis` JSONB column."""

	model_config = ConfigDict(extra="forbid", validate_by_name=True, validate_by_alias=True)

	version: Literal["1"]
	summary: str
	riskFactors: list[str] = Field(default_factory=list)
	suggestedApproach: str | None = None
	ambiguityFlags: list[AmbiguityFlag] = Field(default_factory=list)
	extractedAt: datetime


# Discriminated union ready for future v2/v3 variants.
AiAnalysis = Union[AiAnalysisV1]
_adapter: TypeAdapter[AiAnalysis] = TypeAdapter(AiAnalysis)


def parse_ai_analysis(value: Any) -> AiAnalysis | None:
	"""Parse a raw JSONB payload into the active aiAnalysis variant.

	Returns None for null input. Raises ValidationError on shape mismatch —
	callers should treat that as a data-corruption event.
	"""
	if value is None:
		return None
	return _adapter.validate_python(value)
```

- [ ] **Step 4: Run test to verify PASS**

```bash
uv run pytest tests/ci/test_ai_analysis_schema.py -v
```

Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/docfusion/rfp/ai_analysis.py tests/ci/test_ai_analysis_schema.py
git commit -m "feat(rfp): versioned aiAnalysis schema (Pydantic mirror)"
```

---

## Wave-completion gate

Before declaring W0 done and starting W1:

- [ ] All nine tasks committed.
- [ ] `uv run pytest tests/ci -k "rfp or modality or category or ai_analysis"` — all green.
- [ ] `cd frontend && npx vitest run __tests__/db/schema-rfp-tenant.test.ts __tests__/auth/tenant-context.test.ts __tests__/types/ai-analysis.test.ts` — all green.
- [ ] `cd frontend && npx tsc --noEmit --pretty false` — only the intentional insert-site errors remain (catalogued, to be fixed in W1).
- [ ] On a fresh dev DB, `npx drizzle-kit migrate` runs end-to-end without manual fixup.
- [ ] `psql -c "SELECT COUNT(*) FROM rfp_documents WHERE organization_id IS NULL;"` returns 0.

After the gate, W0 is shippable independently. The `organizationId` columns exist but no query yet enforces them — that is W1's job. W0 introduces zero behavioural change in production traffic.
