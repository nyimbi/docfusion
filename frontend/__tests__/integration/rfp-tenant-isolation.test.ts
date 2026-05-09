/**
 * Cross-tenant isolation suite for the RFP API.
 *
 * Inserts two RFP documents owned by different organisations and asserts
 * that each route handler refuses to leak the other tenant's data — the
 * core security guarantee W1 introduces. The test fails until every
 * route is tenant-scoped (Tasks 3-10 in the W1 plan).
 *
 * Requires migration 0021_rfp_tenant_isolation.sql to be applied to the
 * DB referenced by `DATABASE_URL`.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";

// Wire the auth mock to the session helper before any import that touches it.
vi.mock("@/lib/auth-utils", async () => {
	const helper = await vi.importActual<typeof import("@/__tests__/helpers/session")>(
		"@/__tests__/helpers/session",
	);
	return {
		getServerSession: async () => helper.getCurrentMockSession(),
		requireServerSession: async () => {
			const s = helper.getCurrentMockSession();
			if (!s) throw new Error("Unauthorized");
			return s;
		},
		getCurrentUserId: async () => helper.getCurrentMockSession()?.user.id ?? null,
		getCurrentUserEmail: async () =>
			helper.getCurrentMockSession()?.user.email ?? null,
		getUserContext: async () => {
			const s = helper.getCurrentMockSession();
			if (!s) return null;
			return { userId: s.user.id, organizationId: s.user.organizationId };
		},
		requireUserContext: async () => {
			const s = helper.getCurrentMockSession();
			if (!s) throw new Error("Unauthorized");
			return { userId: s.user.id, organizationId: s.user.organizationId };
		},
	};
});

import { db } from "@/lib/db";
import { rfpDocuments } from "@/lib/db/schema-rfp";
import { withSession } from "@/__tests__/helpers/session";

// Test fixture identifiers
const ORG_A = "test-org-a-w1";
const ORG_B = "test-org-b-w1";
const USER_A = "test-user-a-w1";
const USER_B = "test-user-b-w1";

const docAId = crypto.randomUUID();
const docBId = crypto.randomUUID();

async function callStatus(rfpId: string): Promise<Response> {
	const { GET } = await import("@/app/api/v1/rfp/[rfpId]/status/route");
	const req = new NextRequest(`http://localhost/api/v1/rfp/${rfpId}/status`);
	return GET(req, { params: Promise.resolve({ rfpId }) });
}

async function callRequirements(rfpId: string): Promise<Response> {
	const { GET } = await import("@/app/api/v1/rfp/[rfpId]/requirements/route");
	const req = new NextRequest(
		`http://localhost/api/v1/rfp/${rfpId}/requirements`,
	);
	return GET(req, { params: Promise.resolve({ rfpId }) });
}

async function callParse(rfpId: string): Promise<Response> {
	const { POST } = await import("@/app/api/v1/rfp/[rfpId]/parse/route");
	const req = new NextRequest(`http://localhost/api/v1/rfp/${rfpId}/parse`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({}),
	});
	return POST(req, { params: Promise.resolve({ rfpId }) });
}

describe("RFP routes enforce tenant isolation", () => {
	beforeAll(async () => {
		await db.insert(rfpDocuments).values([
			{
				id: docAId,
				organizationId: ORG_A,
				uploadedBy: USER_A,
				filename: "alpha.pdf",
				fileType: "pdf",
				fileSize: 10,
				storagePath: `test/${docAId}/alpha.pdf`,
				parsingStatus: "completed",
			},
			{
				id: docBId,
				organizationId: ORG_B,
				uploadedBy: USER_B,
				filename: "bravo.pdf",
				fileType: "pdf",
				fileSize: 10,
				storagePath: `test/${docBId}/bravo.pdf`,
				parsingStatus: "completed",
			},
		]);
	});

	afterAll(async () => {
		await db
			.delete(rfpDocuments)
			.where(inArray(rfpDocuments.id, [docAId, docBId]));
	});

	it("user from org A reading own /status succeeds", async () => {
		const res = await withSession(
			{ userId: USER_A, organizationId: ORG_A },
			() => callStatus(docAId),
		);
		expect(res.status).toBe(200);
	});

	it("user from org A cannot read org B's /status (returns 404)", async () => {
		const res = await withSession(
			{ userId: USER_A, organizationId: ORG_A },
			() => callStatus(docBId),
		);
		expect(res.status).toBe(404);
	});

	it("user from org A cannot list org B's /requirements (returns 404)", async () => {
		const res = await withSession(
			{ userId: USER_A, organizationId: ORG_A },
			() => callRequirements(docBId),
		);
		expect(res.status).toBe(404);
	});

	it("user from org A cannot trigger /parse on org B's document (returns 404)", async () => {
		const res = await withSession(
			{ userId: USER_A, organizationId: ORG_A },
			() => callParse(docBId),
		);
		expect(res.status).toBe(404);
	});
});
