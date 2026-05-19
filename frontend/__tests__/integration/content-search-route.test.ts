import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const sessionMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireServerSession: sessionMock,
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((left, right) => ({ op: "eq", left, right })),
	and: vi.fn((...conditions) => ({ op: "and", conditions })),
	sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
		op: "sql",
		strings: Array.from(strings),
		values,
	})),
}));

vi.mock("@/lib/db", () => ({
	db: dbMock,
}));

vi.mock("@/lib/db/schema-additions", () => ({
	templateSnippets: {
		id: "template_snippets.id",
		name: "template_snippets.name",
		content: "template_snippets.content",
		description: "template_snippets.description",
		category: "template_snippets.category",
		tags: "template_snippets.tags",
		organizationId: "template_snippets.organization_id",
	},
}));

vi.mock("@/lib/db/schema-content-library", () => ({
	snippetAnalytics: {
		snippetId: "snippet_analytics.snippet_id",
		contentType: "snippet_analytics.content_type",
		freshnessStatus: "snippet_analytics.freshness_status",
		qualityScore: "snippet_analytics.quality_score",
		winRate: "snippet_analytics.win_rate",
	},
}));

import { POST } from "@/app/api/v1/content/search/route";

function createChain(result: unknown[], onWhere?: (value: unknown) => void) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "leftJoin", "limit"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		onWhere?.(value);
		return chain;
	});
	chain.then = (resolve: (value: unknown[]) => void, reject?: (reason: unknown) => void) =>
		Promise.resolve(result).then(resolve, reject);
	return chain;
}

describe("content search route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		sessionMock.mockResolvedValue({
			user: { id: "user-1", email: "user@example.test", organizationId: "org-1" },
		});
	});

	it("scopes snippet search to the authenticated organization", async () => {
		let whereClause: unknown;
		dbMock.select.mockReturnValueOnce(createChain([
			{
				snippet: {
					id: "snippet-1",
					name: "Delivery Approach",
					content: "Delivery approach narrative",
					description: "Reusable delivery section",
					category: "technical",
					tags: ["delivery"],
				},
				analytics: {
					freshnessStatus: "current",
					qualityScore: 0.8,
					winRate: 0.5,
				},
			},
		], (value) => {
			whereClause = value;
		}));

		const response = await POST(new NextRequest("https://docfusion.test/api/v1/content/search", {
			method: "POST",
			body: JSON.stringify({ query: "delivery", minSimilarity: 0 }),
		}));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.results).toHaveLength(1);
		expect(JSON.stringify(whereClause)).toContain("org-1");
		expect(JSON.stringify(whereClause)).toContain("template_snippets.organization_id");
	});

	it("requires organization context before searching snippets", async () => {
		sessionMock.mockResolvedValueOnce({
			user: { id: "user-1", email: "user@example.test" },
		});

		const response = await POST(new NextRequest("https://docfusion.test/api/v1/content/search", {
			method: "POST",
			body: JSON.stringify({ query: "delivery" }),
		}));
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body.error).toBe("Organization context required");
		expect(dbMock.select).not.toHaveBeenCalled();
	});
});
