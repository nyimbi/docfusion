# RFP Pipeline W1 — Auth Isolation: Tenant Predicates and Server-Action Guards

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** W0 must be merged. This plan depends on `requireTenantContext()` and the `organizationId` schema columns.

**Goal:** Close the cross-tenant data exposure on the RFP surface. Every API route, server action, and query that touches `rfpDocuments`, `rfpRequirements`, `rfpParsingJobs`, `complianceMatrices`, or `complianceEntries` will resolve `(userId, organizationId)` from the session and apply `eq(table.organizationId, ctx.organizationId)` to every read and write. The unauthenticated server action `processRfpParsingJob` gets an ownership check. The `workflow/route.ts` route gets a session guard. After W1 ships, audit Critical #1, #2, and #3 are closed.

**Architecture:**
- All routes migrate to a single auth helper (`requireRouteSessionOr401` style — returns NextResponse on failure) so error responses are 401 not 500. Routes that catch a thrown `Unauthorized` from server actions are fragile and will be replaced.
- Every Drizzle query becomes `where(and(eq(table.id, x), eq(table.organizationId, ctx.organizationId)))`. The composite indexes added in W0 cover this pattern.
- `processRfpParsingJob` is wrapped with an ownership check at the top of the function: it loads the document, asserts `document.organizationId === ctx.organizationId`, and refuses to proceed otherwise. The check is internal so even non-route callers can't bypass it.
- A new shared helper `requireRouteTenantContext(request)` wraps `requireTenantContext()` and returns `NextResponse.json({error: "Unauthorized"}, {status: 401})` on missing context — the route equivalent of W0's helper.
- A cross-tenant integration test suite proves the leak is closed end-to-end.

**Tech Stack:** Same as W0 plus drizzle-orm `and()` / `eq()` composition.

---

### Task 1: Cross-tenant integration test (failing — will pass after Task 9)

**Files:**
- Create: `frontend/__tests__/api/rfp-tenant-isolation.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/__tests__/api/rfp-tenant-isolation.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { rfpDocuments, rfpRequirements } from "@/lib/db/schema-rfp";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

const ORG_A = "test-org-a";
const ORG_B = "test-org-b";
const USER_A = "test-user-a";
const USER_B = "test-user-b";

let docAId: string;
let docBId: string;

async function callRouteAs(
	userId: string,
	organizationId: string,
	method: "GET" | "POST",
	path: string,
	body?: unknown,
) {
	// The test harness installs a session cookie that the auth handler reads.
	// See frontend/__tests__/helpers/session.ts for the existing utility.
	const { withSession } = await import("@/__tests__/helpers/session");
	return withSession({ userId, organizationId }, async () => {
		const url = new URL(path, "http://localhost");
		const handler = await import(`@/app${path}/route`);
		const fn = handler[method];
		const req = new Request(url, {
			method,
			body: body ? JSON.stringify(body) : undefined,
			headers: { "content-type": "application/json" },
		});
		return fn(req);
	});
}

describe("RFP routes enforce tenant isolation", () => {
	beforeAll(async () => {
		docAId = uuidv7();
		docBId = uuidv7();
		await db.insert(rfpDocuments).values([
			{
				id: docAId,
				organizationId: ORG_A,
				uploadedBy: USER_A,
				filename: "a.pdf",
				fileType: "pdf",
				fileSize: 1,
				storagePath: "test/a",
			},
			{
				id: docBId,
				organizationId: ORG_B,
				uploadedBy: USER_B,
				filename: "b.pdf",
				fileType: "pdf",
				fileSize: 1,
				storagePath: "test/b",
			},
		]);
	});

	afterAll(async () => {
		await db.delete(rfpRequirements).where(eq(rfpRequirements.organizationId, ORG_A));
		await db.delete(rfpRequirements).where(eq(rfpRequirements.organizationId, ORG_B));
		await db.delete(rfpDocuments).where(eq(rfpDocuments.organizationId, ORG_A));
		await db.delete(rfpDocuments).where(eq(rfpDocuments.organizationId, ORG_B));
	});

	it("user from org A cannot read org B's /status", async () => {
		const res = await callRouteAs(USER_A, ORG_A, "GET", `/api/v1/rfp/${docBId}/status`);
		expect(res.status).toBe(404);
	});

	it("user from org A cannot read org B's /requirements", async () => {
		const res = await callRouteAs(USER_A, ORG_A, "GET", `/api/v1/rfp/${docBId}/requirements`);
		expect(res.status).toBe(404);
	});

	it("user from org A cannot trigger /parse on org B's doc", async () => {
		const res = await callRouteAs(USER_A, ORG_A, "POST", `/api/v1/rfp/${docBId}/parse`);
		expect(res.status).toBe(404);
	});

	it("user from same org sees own data", async () => {
		const res = await callRouteAs(USER_A, ORG_A, "GET", `/api/v1/rfp/${docAId}/status`);
		expect(res.status).toBe(200);
	});
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
cd frontend && npx vitest run __tests__/api/rfp-tenant-isolation.test.ts
```

Expected: failures — cross-tenant requests currently return 200 instead of 404. (If `withSession` helper does not exist, create a stub that returns the requested session — the test infra lives at `frontend/__tests__/helpers/`. Check first via `ls frontend/__tests__/helpers/` and adapt.)

- [ ] **Step 3: Commit**

```bash
git add frontend/__tests__/api/rfp-tenant-isolation.test.ts
git commit -m "test(rfp): cross-tenant isolation suite (failing)"
```

---

### Task 2: `requireRouteTenantContext()` helper

**Files:**
- Create: `frontend/lib/auth/route-tenant.ts`
- Test: `frontend/__tests__/auth/route-tenant.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/__tests__/auth/route-tenant.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/auth/tenant-context", () => ({
	requireTenantContext: vi.fn(),
}));

import { requireRouteTenantContext, isTenantResponse } from "@/lib/auth/route-tenant";
import { requireTenantContext } from "@/lib/auth/tenant-context";

describe("requireRouteTenantContext", () => {
	beforeEach(() => vi.resetAllMocks());

	it("returns context when present", async () => {
		(requireTenantContext as ReturnType<typeof vi.fn>).mockResolvedValue({
			userId: "u",
			organizationId: "o",
		});
		const result = await requireRouteTenantContext();
		expect(isTenantResponse(result)).toBe(false);
		expect(result).toEqual({ userId: "u", organizationId: "o" });
	});

	it("returns 401 NextResponse on Unauthorized", async () => {
		(requireTenantContext as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("Unauthorized"),
		);
		const result = await requireRouteTenantContext();
		expect(isTenantResponse(result)).toBe(true);
		expect((result as NextResponse).status).toBe(401);
	});

	it("returns 403 NextResponse on missing org context", async () => {
		(requireTenantContext as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("No organization context"),
		);
		const result = await requireRouteTenantContext();
		expect(isTenantResponse(result)).toBe(true);
		expect((result as NextResponse).status).toBe(403);
	});
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
cd frontend && npx vitest run __tests__/auth/route-tenant.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement the helper**

```typescript
// frontend/lib/auth/route-tenant.ts
import { NextResponse } from "next/server";
import {
	requireTenantContext,
	type TenantContext,
} from "@/lib/auth/tenant-context";

export type RouteTenantResult = TenantContext | NextResponse;

/**
 * Resolve tenant context for a route handler.
 *
 * Returns either a `TenantContext` or a NextResponse. Use `isTenantResponse()`
 * to discriminate — the Next.js convention for early-return guards.
 */
export async function requireRouteTenantContext(): Promise<RouteTenantResult> {
	try {
		return await requireTenantContext();
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unauthorized";
		if (message === "No organization context") {
			return NextResponse.json({ error: message }, { status: 403 });
		}
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
}

export function isTenantResponse(value: RouteTenantResult): value is NextResponse {
	return value instanceof NextResponse;
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
cd frontend && npx vitest run __tests__/auth/route-tenant.test.ts
```

Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/auth/route-tenant.ts frontend/__tests__/auth/route-tenant.test.ts
git commit -m "feat(auth): add requireRouteTenantContext() route helper"
```

---

### Task 3: `/status` route — apply tenant predicate

**Files:**
- Modify: `frontend/app/api/v1/rfp/[rfpId]/status/route.ts`

- [ ] **Step 1: Replace the auth + lookup**

Open `frontend/app/api/v1/rfp/[rfpId]/status/route.ts`. Replace the GET handler's auth and document lookup with:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { rfpDocuments } from "@/lib/db/schema-rfp";
import { and, eq } from "drizzle-orm";
import {
	requireRouteTenantContext,
	isTenantResponse,
} from "@/lib/auth/route-tenant";

export async function GET(
	_request: NextRequest,
	context: { params: Promise<{ rfpId: string }> },
) {
	const ctx = await requireRouteTenantContext();
	if (isTenantResponse(ctx)) return ctx;

	const { rfpId } = await context.params;
	if (!isUuid(rfpId)) {
		return NextResponse.json({ error: "Invalid rfpId" }, { status: 400 });
	}

	const doc = await db.query.rfpDocuments.findFirst({
		where: and(
			eq(rfpDocuments.id, rfpId),
			eq(rfpDocuments.organizationId, ctx.organizationId),
		),
	});

	if (!doc) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	return NextResponse.json({
		rfpDocumentId: doc.id,
		parsingStatus: doc.parsingStatus,
		parsingProgress: doc.parsingProgress,
		parsingError: doc.parsingError,
		parsingStartedAt: doc.parsingStartedAt,
		parsingCompletedAt: doc.parsingCompletedAt,
	});
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string): boolean {
	return UUID_RE.test(v);
}
```

The `isUuid` helper is duplicated across routes intentionally for now — extract after all routes are migrated (Task 10).

- [ ] **Step 2: Run the cross-tenant test focusing on /status**

```bash
cd frontend && npx vitest run __tests__/api/rfp-tenant-isolation.test.ts -t "status"
```

Expected: the two `/status` tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/v1/rfp/[rfpId]/status/route.ts
git commit -m "feat(rfp): tenant-scope /status route"
```

---

### Task 4: `/requirements` route — apply tenant predicate

**Files:**
- Modify: `frontend/app/api/v1/rfp/[rfpId]/requirements/route.ts`

- [ ] **Step 1: Apply the same pattern as Task 3**

Replace the auth + parent lookup. The query for the requirements list itself must also be tenant-scoped:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { rfpDocuments, rfpRequirements } from "@/lib/db/schema-rfp";
import { and, eq, sql } from "drizzle-orm";
import {
	requireRouteTenantContext,
	isTenantResponse,
} from "@/lib/auth/route-tenant";

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ rfpId: string }> },
) {
	const ctx = await requireRouteTenantContext();
	if (isTenantResponse(ctx)) return ctx;

	const { rfpId } = await context.params;
	if (!isUuid(rfpId)) {
		return NextResponse.json({ error: "Invalid rfpId" }, { status: 400 });
	}

	const doc = await db.query.rfpDocuments.findFirst({
		where: and(
			eq(rfpDocuments.id, rfpId),
			eq(rfpDocuments.organizationId, ctx.organizationId),
		),
	});
	if (!doc) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const url = new URL(request.url);
	const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
	const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize") ?? 50)));

	const tenantedFilter = and(
		eq(rfpRequirements.rfpDocumentId, rfpId),
		eq(rfpRequirements.organizationId, ctx.organizationId),
	);

	const [{ total }] = await db
		.select({ total: sql<number>`COUNT(*)::int` })
		.from(rfpRequirements)
		.where(tenantedFilter);

	const rows = await db.query.rfpRequirements.findMany({
		where: tenantedFilter,
		orderBy: (t, { asc }) => [asc(t.requirementNumber)],
		limit: pageSize,
		offset: (page - 1) * pageSize,
	});

	return NextResponse.json({ requirements: rows, total, page, pageSize });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string): boolean {
	return UUID_RE.test(v);
}
```

- [ ] **Step 2: Run the cross-tenant test**

```bash
cd frontend && npx vitest run __tests__/api/rfp-tenant-isolation.test.ts -t "requirements"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/v1/rfp/[rfpId]/requirements/route.ts
git commit -m "feat(rfp): tenant-scope /requirements route"
```

---

### Task 5: `/parse` route — apply tenant predicate, update writes

**Files:**
- Modify: `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts`

- [ ] **Step 1: Apply tenant predicate to parent lookup, write paths, and job insert**

Key changes:
- Replace auth with `requireRouteTenantContext`.
- Add `eq(rfpDocuments.organizationId, ctx.organizationId)` to the parent `findFirst`.
- The status update at lines 128-137 must also include the tenant predicate.
- The `rfpParsingJobs` insert must include `organizationId: ctx.organizationId`.
- The handoff to `processRfpParsingJob` must pass the resolved `ctx.organizationId` so the action can verify ownership without re-resolving the session (Task 9).

```typescript
const ctx = await requireRouteTenantContext();
if (isTenantResponse(ctx)) return ctx;

const { rfpId } = await context.params;
if (!isUuid(rfpId)) {
	return NextResponse.json({ error: "Invalid rfpId" }, { status: 400 });
}

const doc = await db.query.rfpDocuments.findFirst({
	where: and(
		eq(rfpDocuments.id, rfpId),
		eq(rfpDocuments.organizationId, ctx.organizationId),
	),
});
if (!doc) {
	return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

For the status update guard:

```typescript
await db
	.update(rfpDocuments)
	.set({ parsingStatus: "processing", parsingProgress: 0, parsingError: null })
	.where(
		and(
			eq(rfpDocuments.id, rfpId),
			eq(rfpDocuments.organizationId, ctx.organizationId),
			ne(rfpDocuments.parsingStatus, "processing"),
		),
	);
```

(`ne` from `drizzle-orm`. The `ne` guard prevents the race window described in audit Critical #9 — full idempotency lands in W2.)

For the job insert:

```typescript
const [job] = await db
	.insert(rfpParsingJobs)
	.values({
		rfpDocumentId: rfpId,
		organizationId: ctx.organizationId,
		initiatedBy: ctx.userId,
		status: "queued",
	})
	.returning();
```

For the action handoff:

```typescript
processRfpParsingJob({
	jobId: job.id,
	rfpDocumentId: rfpId,
	tenantContext: { userId: ctx.userId, organizationId: ctx.organizationId },
}).catch((err) => {
	console.error("processRfpParsingJob failed", err);
});
```

(The `tenantContext` parameter is added in Task 9. Until Task 9 lands, this code will fail typecheck — that's intentional and prevents merging a half-fixed pipeline.)

- [ ] **Step 2: Run the cross-tenant test**

```bash
cd frontend && npx vitest run __tests__/api/rfp-tenant-isolation.test.ts -t "parse"
```

Expected: PASS once Task 9 lands. Until then, leave the route compiling against the new `tenantContext` argument and skip via `it.skip` or merge Tasks 5 + 9 in a single commit.

- [ ] **Step 3: Commit (combined with Task 9 if necessary)**

```bash
git add frontend/app/api/v1/rfp/[rfpId]/parse/route.ts
git commit -m "feat(rfp): tenant-scope /parse route"
```

---

### Task 6: `/upload` route — tenant-scope dedup and insert

**Files:**
- Modify: `frontend/app/api/v1/rfp/upload/route.ts`

- [ ] **Step 1: Replace auth + scope the dedup query**

The current dedup at lines 103-115 uses `eq(rfpDocuments.fileHash, hash)` globally. That leaks `existingDocumentId` cross-tenant (audit High #8). Tenant-scope it:

```typescript
const ctx = await requireRouteTenantContext();
if (isTenantResponse(ctx)) return ctx;

// ... validation and scan unchanged ...

const existing = await db.query.rfpDocuments.findFirst({
	where: and(
		eq(rfpDocuments.fileHash, fileHash),
		eq(rfpDocuments.organizationId, ctx.organizationId),
	),
});
if (existing) {
	return NextResponse.json(
		{ error: "Duplicate", existingDocumentId: existing.id },
		{ status: 409 },
	);
}
```

For the insert, set `organizationId: ctx.organizationId` and `uploadedBy: ctx.userId`.

The unique index `rfp_docs_hash_idx` was created globally — change it to scope by org. Add this to a **new** migration `frontend/drizzle/0022_rfp_hash_per_tenant.sql`:

```sql
BEGIN;
DROP INDEX IF EXISTS rfp_docs_hash_idx;
CREATE UNIQUE INDEX rfp_docs_org_hash_idx ON rfp_documents(organization_id, file_hash) WHERE file_hash IS NOT NULL;
COMMIT;
```

And update `schema-rfp.ts` to:

```typescript
		uniqueIndex("rfp_docs_org_hash_idx").on(table.organizationId, table.fileHash),
```

- [ ] **Step 2: Run the existing upload tests**

```bash
cd frontend && npx vitest run __tests__/api/rfp-upload-route.test.ts 2>/dev/null || npx vitest run -t "upload"
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/v1/rfp/upload/route.ts \
        frontend/lib/db/schema-rfp.ts \
        frontend/drizzle/0022_rfp_hash_per_tenant.sql
git commit -m "feat(rfp): tenant-scope /upload dedup and unique index"
```

---

### Task 7: Compliance-matrix route — tenant predicate

**Files:**
- Modify: `frontend/app/api/v1/compliance-matrix/[matrixId]/route.ts`

- [ ] **Step 1: Apply tenant predicate to GET, PATCH, DELETE**

Every query against `complianceMatrices` must include `eq(complianceMatrices.organizationId, ctx.organizationId)`. Pattern:

```typescript
const ctx = await requireRouteTenantContext();
if (isTenantResponse(ctx)) return ctx;

const { matrixId } = await context.params;
if (!isUuid(matrixId)) {
	return NextResponse.json({ error: "Invalid matrixId" }, { status: 400 });
}

const matrix = await db.query.complianceMatrices.findFirst({
	where: and(
		eq(complianceMatrices.id, matrixId),
		eq(complianceMatrices.organizationId, ctx.organizationId),
	),
});
if (!matrix) {
	return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

For PATCH, validate body with zod before write (W2 will harden zod schemas; for now use a minimal one):

```typescript
import { z } from "zod";
import { MATRIX_STATUSES } from "@/lib/db/schema-rfp";

const PatchSchema = z
	.object({
		name: z.string().min(1).max(200).optional(),
		description: z.string().optional(),
		status: z.enum(MATRIX_STATUSES).optional(),
	})
	.strict();

const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})));
if (!parsed.success) {
	return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
}

const updated = await db
	.update(complianceMatrices)
	.set({ ...parsed.data, updatedAt: new Date() })
	.where(
		and(
			eq(complianceMatrices.id, matrixId),
			eq(complianceMatrices.organizationId, ctx.organizationId),
		),
	)
	.returning();
```

- [ ] **Step 2: Run existing compliance-matrix tests**

```bash
cd frontend && npx vitest run -t "compliance-matrix"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/v1/compliance-matrix/[matrixId]/route.ts
git commit -m "feat(rfp): tenant-scope compliance-matrix route + zod body"
```

---

### Task 8: Compliance-entry workflow route — add auth guard + tenant predicate

**Files:**
- Modify: `frontend/app/api/v1/compliance-matrix/[matrixId]/entries/[entryId]/workflow/route.ts`

- [ ] **Step 1: Add the missing auth + tenant**

The current handler has no auth guard at all (audit Critical #3). Replace with:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { complianceMatrices, complianceEntries } from "@/lib/db/schema-rfp";
import { and, eq } from "drizzle-orm";
import {
	requireRouteTenantContext,
	isTenantResponse,
} from "@/lib/auth/route-tenant";
import { transitionComplianceEntryWorkflow } from "@/lib/actions/workflow-domain";

const BodySchema = z
	.object({
		action: z.enum(["start", "complete", "approve", "reject", "cancel"]),
		notes: z.string().optional(),
	})
	.strict();

export async function POST(
	request: NextRequest,
	context: { params: Promise<{ matrixId: string; entryId: string }> },
) {
	const ctx = await requireRouteTenantContext();
	if (isTenantResponse(ctx)) return ctx;

	const { matrixId, entryId } = await context.params;
	if (!isUuid(matrixId) || !isUuid(entryId)) {
		return NextResponse.json({ error: "Invalid id" }, { status: 400 });
	}

	const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid body", issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	const entry = await db.query.complianceEntries.findFirst({
		where: and(
			eq(complianceEntries.id, entryId),
			eq(complianceEntries.matrixId, matrixId),
			eq(complianceEntries.organizationId, ctx.organizationId),
		),
	});
	if (!entry) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	try {
		const result = await transitionComplianceEntryWorkflow({
			entryId,
			matrixId,
			action: parsed.data.action,
			notes: parsed.data.notes,
			tenantContext: { userId: ctx.userId, organizationId: ctx.organizationId },
		});
		return NextResponse.json(result);
	} catch (err) {
		console.error("workflow transition failed", err);
		return NextResponse.json({ error: "Transition failed" }, { status: 500 });
	}
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string): boolean {
	return UUID_RE.test(v);
}
```

The `transitionComplianceEntryWorkflow` action must accept the new `tenantContext` parameter (Task 10).

- [ ] **Step 2: Run existing workflow tests**

```bash
cd frontend && npx vitest run -t "workflow"
```

Expected: tests still PASS once Task 10 lands the action signature change.

- [ ] **Step 3: Commit (with Task 10 as a paired commit if needed)**

```bash
git add frontend/app/api/v1/compliance-matrix/[matrixId]/entries/[entryId]/workflow/route.ts
git commit -m "feat(rfp): add auth + tenant guard to compliance-entry workflow route"
```

---

### Task 9: `processRfpParsingJob` — accept tenant context and verify ownership

**Files:**
- Modify: `frontend/lib/actions/rfp-parser.ts`
- Test: `frontend/__tests__/actions/rfp-parser-tenant.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/__tests__/actions/rfp-parser-tenant.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { rfpDocuments, rfpParsingJobs } from "@/lib/db/schema-rfp";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { processRfpParsingJob } from "@/lib/actions/rfp-parser";

describe("processRfpParsingJob ownership check", () => {
	const docOrg = "tenant-X";
	const otherOrg = "tenant-Y";
	let docId: string;
	let jobId: string;

	beforeAll(async () => {
		docId = uuidv7();
		jobId = uuidv7();
		await db.insert(rfpDocuments).values({
			id: docId,
			organizationId: docOrg,
			uploadedBy: "owner",
			filename: "x.pdf",
			fileType: "pdf",
			fileSize: 1,
			storagePath: "test/x",
		});
		await db.insert(rfpParsingJobs).values({
			id: jobId,
			organizationId: docOrg,
			rfpDocumentId: docId,
			initiatedBy: "owner",
			status: "queued",
		});
	});

	afterAll(async () => {
		await db.delete(rfpParsingJobs).where(eq(rfpParsingJobs.id, jobId));
		await db.delete(rfpDocuments).where(eq(rfpDocuments.id, docId));
	});

	it("rejects calls whose tenantContext does not match the document org", async () => {
		await expect(
			processRfpParsingJob({
				jobId,
				rfpDocumentId: docId,
				tenantContext: { userId: "u", organizationId: otherOrg },
			}),
		).rejects.toThrow(/tenant mismatch/i);
	});
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
cd frontend && npx vitest run __tests__/actions/rfp-parser-tenant.test.ts
```

Expected: FAIL — current signature doesn't take `tenantContext`.

- [ ] **Step 3: Update the action signature and add ownership check**

In `frontend/lib/actions/rfp-parser.ts`, around the `processRfpParsingJob` definition (currently at line 1712), change the input shape:

```typescript
export interface ProcessRfpParsingJobInput {
	jobId: string;
	rfpDocumentId: string;
	tenantContext: { userId: string; organizationId: string };
}

export async function processRfpParsingJob(
	input: ProcessRfpParsingJobInput,
): Promise<void> {
	const { jobId, rfpDocumentId, tenantContext } = input;

	// Ownership check — refuse to proceed if the document is not in the caller's org.
	const doc = await db.query.rfpDocuments.findFirst({
		where: and(
			eq(rfpDocuments.id, rfpDocumentId),
			eq(rfpDocuments.organizationId, tenantContext.organizationId),
		),
	});
	if (!doc) {
		throw new Error(
			`processRfpParsingJob: tenant mismatch (rfpDocumentId=${rfpDocumentId}, organizationId=${tenantContext.organizationId})`,
		);
	}

	// existing pipeline body — but every db.update / db.insert MUST include
	// `eq(table.organizationId, tenantContext.organizationId)` in its where()
	// or set `organizationId: tenantContext.organizationId` on insert.
	// ...
}
```

Walk every `db.update`, `db.insert`, and `db.delete` inside the function and add the tenant predicate or column. The audit identified these specific touch points:
- `db.insert(rfpRequirements)` at line ~1840 → add `organizationId: tenantContext.organizationId` to each row.
- `db.update(rfpDocuments)` at line ~1857 → add `eq(rfpDocuments.organizationId, ...)` to where.
- `db.update(rfpParsingJobs)` at every status transition → add the org predicate.

- [ ] **Step 4: Update all callers**

```bash
grep -rn "processRfpParsingJob(" frontend --include="*.ts" --include="*.tsx"
```

Each caller must now pass `tenantContext`. The known sites:
- `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts` (Task 5)
- `frontend/lib/services/rfp-document-service.ts` line ~1113 — this is the discovery→ingestion bridge; resolve org from the parent `opportunityDocument`'s owner.

For `rfp-document-service.ts`, the call should now read:

```typescript
processRfpParsingJob({
	jobId: job.id,
	rfpDocumentId: doc.id,
	tenantContext: { userId: ctx.userId, organizationId: ctx.organizationId },
}).catch((err) => console.error("queued parse failed", err));
```

Where `ctx` is the tenant context the discovery service has already resolved (it should be — if not, propagate it through the call chain).

- [ ] **Step 5: Run test to verify PASS**

```bash
cd frontend && npx vitest run __tests__/actions/rfp-parser-tenant.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/actions/rfp-parser.ts \
        frontend/lib/services/rfp-document-service.ts \
        frontend/app/api/v1/rfp/[rfpId]/parse/route.ts \
        frontend/__tests__/actions/rfp-parser-tenant.test.ts
git commit -m "feat(rfp): processRfpParsingJob enforces tenant ownership"
```

---

### Task 10: `requirements.ts` and `workflow-domain.ts` actions — tenant scoping

**Files:**
- Modify: `frontend/lib/actions/requirements.ts`
- Modify: `frontend/lib/actions/workflow-domain.ts`

- [ ] **Step 1: Audit every query**

```bash
grep -n "db\.\(query\|select\|insert\|update\|delete\)" frontend/lib/actions/requirements.ts frontend/lib/actions/workflow-domain.ts
```

For each hit that touches `rfpRequirements`, `complianceMatrices`, `complianceEntries`, `rfpDocuments`, or `rfpParsingJobs`:
- Reads must include `eq(table.organizationId, ctx.organizationId)` in `where`.
- Inserts must set `organizationId: ctx.organizationId`.
- Updates and deletes must include the org predicate in `where`.
- Resolve `ctx` via `requireTenantContext()` at the top of every exported function.

- [ ] **Step 2: Replace `patch: any` in `workflow-domain.ts:402`**

Audit High #14: the `db.update(rfpRequirements).set(patch).where(eq(...))` accepts an unvalidated `patch`. Replace with a zod-validated whitelist:

```typescript
import { z } from "zod";
import { COMPLIANCE_STATUSES, REQUIREMENT_PRIORITIES } from "@/lib/db/schema-rfp";

const WorkflowPatchSchema = z
	.object({
		complianceStatus: z.enum(COMPLIANCE_STATUSES).optional(),
		priority: z.enum(REQUIREMENT_PRIORITIES).optional(),
		notes: z.string().optional(),
		assignedTo: z.string().optional(),
	})
	.strict();

const patch = WorkflowPatchSchema.parse(input.patch);

await db
	.update(rfpRequirements)
	.set({ ...patch, updatedAt: new Date() })
	.where(
		and(
			eq(rfpRequirements.id, input.instance.subjectId),
			eq(rfpRequirements.organizationId, ctx.organizationId),
		),
	);
```

Add the schema close to the function so future readers see the contract.

- [ ] **Step 3: Run the actions test suite**

```bash
cd frontend && npx vitest run __tests__/actions/
```

Expected: PASS — pre-existing tests must continue to work; tenant filtering is additive.

- [ ] **Step 4: Run the cross-tenant integration test from Task 1**

```bash
cd frontend && npx vitest run __tests__/api/rfp-tenant-isolation.test.ts
```

Expected: 4/4 PASS — the suite that opened W1 now closes it.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/actions/requirements.ts frontend/lib/actions/workflow-domain.ts
git commit -m "feat(rfp): tenant-scope requirements + workflow-domain actions"
```

---

## Wave-completion gate

Before declaring W1 done and starting W2:

- [ ] All ten tasks committed.
- [ ] `cd frontend && npx vitest run __tests__/api/rfp-tenant-isolation.test.ts` — 4/4 PASS.
- [ ] `cd frontend && npx tsc --noEmit --pretty false` — zero errors. The intentional W0 errors are now resolved.
- [ ] `cd frontend && npx vitest run` — full vitest suite green.
- [ ] Manual probe with two test users in different orgs: each call to `/api/v1/rfp/<other-org-uuid>/...` returns 404, never 200.
- [ ] `grep -rn "db.query.rfp\|db.insert(rfp\|db.update(rfp\|db.delete(rfp\|db.query.complianceMatrices\|db.query.complianceEntries" frontend --include="*.ts"` — every hit either includes the org predicate or is documented as deliberate (e.g. an admin-only operation; none should exist in this surface).

After the gate, W1 is shippable independently. Cross-tenant data exposure is closed; correctness defects (Critical #6, #7, #9, #10, #11) are W2's job.
