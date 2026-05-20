import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	query: {
		rfpDocuments: { findFirst: vi.fn() },
	},
}));

vi.mock("@/lib/auth/route-tenant", () => ({
	requireRouteTenantContext: vi.fn(async () => ({
		userId: "user-1",
		organizationId: "org-1",
	})),
	isTenantResponse: vi.fn(() => false),
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((left, right) => ({ op: "eq", left, right })),
	and: vi.fn((...conditions) => ({ op: "and", conditions })),
	ilike: vi.fn((left, right) => ({ op: "ilike", left, right })),
	desc: vi.fn((column) => ({ op: "desc", column })),
	asc: vi.fn((column) => ({ op: "asc", column })),
	sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
		op: "sql",
		strings: Array.from(strings),
		values,
	})),
}));

vi.mock("@/lib/db", () => ({
	db: dbMock,
}));

vi.mock("@/lib/db/schema-rfp", () => ({
	rfpDocuments: {
		id: "rfp_documents.id",
		organizationId: "rfp_documents.organization_id",
	},
	rfpRequirements: {
		id: "rfp_requirements.id",
		rfpDocumentId: "rfp_requirements.rfp_document_id",
		organizationId: "rfp_requirements.organization_id",
		requirementNumber: "rfp_requirements.requirement_number",
		title: "rfp_requirements.title",
		requirementText: "rfp_requirements.requirement_text",
		sourceSection: "rfp_requirements.source_section",
		category: "rfp_requirements.category",
		priority: "rfp_requirements.priority",
		complianceStatus: "rfp_requirements.compliance_status",
		riskLevel: "rfp_requirements.risk_level",
		dueDate: "rfp_requirements.due_date",
	},
}));

import { GET } from "@/app/api/v1/rfp/[rfpId]/requirements/route";

function createChain(result: unknown[]) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "orderBy", "limit", "offset"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (resolve: (value: unknown[]) => void) => Promise.resolve(result).then(resolve);
	return chain;
}

describe("RFP requirements route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		dbMock.query.rfpDocuments.findFirst.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
	});

	it("normalizes malformed pagination query parameters", async () => {
		const rowsChain = createChain([]);
		dbMock.select
			.mockReturnValueOnce(createChain([{ count: 0 }]))
			.mockReturnValueOnce(rowsChain);

		const response = await GET(
			new NextRequest("https://app.test/api/v1/rfp/11111111-1111-4111-8111-111111111111/requirements?page=bad&pageSize=bad"),
			{ params: Promise.resolve({ rfpId: "11111111-1111-4111-8111-111111111111" }) }
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.page).toBe(1);
		expect(body.pageSize).toBe(50);
		expect(rowsChain.limit).toHaveBeenCalledWith(50);
		expect(rowsChain.offset).toHaveBeenCalledWith(0);
	});
});
