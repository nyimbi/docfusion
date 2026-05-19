import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireServerSession: vi.fn(async () => ({
		user: { id: "user-1", email: "user@example.test", organizationId: "org-1" },
	})),
}));

vi.mock("drizzle-orm", () => {
	const sql = (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values });
	return {
		eq: vi.fn((left, right) => ({ op: "eq", left, right })),
		ilike: vi.fn((left, right) => ({ op: "ilike", left, right })),
		and: vi.fn((...conditions) => ({ op: "and", conditions })),
		gte: vi.fn((left, right) => ({ op: "gte", left, right })),
		desc: vi.fn((column) => ({ op: "desc", column })),
		asc: vi.fn((column) => ({ op: "asc", column })),
		sql,
	};
});

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
		shortcut: "template_snippets.shortcut",
		createdBy: "template_snippets.created_by",
		organizationId: "template_snippets.organization_id",
		isPublic: "template_snippets.is_public",
		createdAt: "template_snippets.created_at",
		updatedAt: "template_snippets.updated_at",
		placeholders: "template_snippets.placeholders",
	},
}));

vi.mock("@/lib/db/schema-content-library", () => ({
	snippetAnalytics: {
		snippetId: "snippet_analytics.snippet_id",
		aiTags: "snippet_analytics.ai_tags",
		keyTerms: "snippet_analytics.key_terms",
		contentType: "snippet_analytics.content_type",
		topicCategory: "snippet_analytics.topic_category",
		sectors: "snippet_analytics.sectors",
		technologies: "snippet_analytics.technologies",
		complianceFrameworks: "snippet_analytics.compliance_frameworks",
		freshnessStatus: "snippet_analytics.freshness_status",
		reviewDueDate: "snippet_analytics.review_due_date",
		lastReviewedAt: "snippet_analytics.last_reviewed_at",
		qualityScore: "snippet_analytics.quality_score",
		wordCount: "snippet_analytics.word_count",
		winCount: "snippet_analytics.win_count",
		lossCount: "snippet_analytics.loss_count",
		winRate: "snippet_analytics.win_rate",
		lastUsedAt: "snippet_analytics.last_used_at",
	},
	snippetEmbeddings: {},
}));

import { GET, POST } from "@/app/api/v1/content/snippets/route";

function createChain(result: unknown[], capture?: (value: unknown) => void) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "leftJoin", "orderBy", "limit", "offset"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		capture?.(value);
		return chain;
	});
	chain.values = vi.fn((value: unknown) => {
		capture?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => result);
	chain.then = (resolve: (value: unknown[]) => void) => Promise.resolve(result).then(resolve);
	return chain;
}

describe("content snippets route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns normalized snippet content and placeholder metadata", async () => {
		let countWhere: unknown;
		let listWhere: unknown;
		dbMock.select
			.mockReturnValueOnce(createChain([{ count: 1 }], (value) => {
				countWhere = value;
			}))
			.mockReturnValueOnce(
				createChain([
					{
						snippet: {
							id: "snippet-1",
							name: "Client Opening",
							content: "Dear {{ client_name }}",
							description: "Opening line",
							category: "intro",
							tags: ["rfp"],
							placeholders: [
								{
									id: "client",
									name: "Client",
									variableName: "{{ client_name }}",
									type: "text",
									required: true,
								},
							],
							createdAt: new Date("2026-05-01T00:00:00.000Z"),
							updatedAt: new Date("2026-05-02T00:00:00.000Z"),
						},
						analytics: {
							freshnessStatus: "current",
							wordCount: 3,
							winCount: 1,
							lossCount: 0,
							winRate: 1,
						},
					},
				], (value) => {
					listWhere = value;
				})
			);

		const response = await GET(
			new NextRequest("https://docfusion.test/api/v1/content/snippets")
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.snippets[0].content).toMatchObject({ type: "doc" });
		expect(body.snippets[0].plainTextPreview).toBe("Dear {{ client_name }}");
		expect(body.snippets[0].placeholders[0]).toMatchObject({
			key: "client_name",
			variableName: "client_name",
		});
		expect(JSON.stringify(countWhere)).toContain("org-1");
		expect(JSON.stringify(listWhere)).toContain("org-1");
	});

	it("normalizes created snippet content before storing it", async () => {
		let insertedSnippet: unknown;
		let insertedAnalytics: unknown;
		dbMock.insert
			.mockReturnValueOnce(
				createChain(
					[
						{
							id: "snippet-1",
							name: "Client Opening",
							createdAt: new Date("2026-05-01T00:00:00.000Z"),
							updatedAt: new Date("2026-05-02T00:00:00.000Z"),
						},
					],
					(value) => {
						insertedSnippet = value;
					}
				)
			)
			.mockReturnValueOnce(
				createChain([], (value) => {
					insertedAnalytics = value;
				})
			);

		const response = await POST(
			new NextRequest("https://docfusion.test/api/v1/content/snippets", {
				method: "POST",
				body: JSON.stringify({
					name: "Client Opening",
					content: "Datacraft response narrative.",
					placeholders: [
						{
							id: "client",
							name: "Client",
							variableName: "{{client_name}}",
							type: "text",
							required: true,
						},
					],
				}),
			})
		);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(insertedSnippet).toMatchObject({
			content: { type: "doc" },
			placeholders: [expect.objectContaining({ key: "client_name" })],
			organizationId: "org-1",
		});
		expect(insertedAnalytics).toMatchObject({ wordCount: 3 });
		expect(body.plainTextPreview).toBe("Datacraft response narrative.");
	});
});
