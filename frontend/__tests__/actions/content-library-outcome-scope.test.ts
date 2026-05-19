import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
	update: vi.fn(),
	insert: vi.fn(),
	query: {
		snippetUsageLog: {
			findMany: vi.fn(),
		},
		templateUsageLog: {
			findMany: vi.fn(),
		},
		snippetAnalytics: {
			findFirst: vi.fn(),
		},
		templateAnalytics: {
			findFirst: vi.fn(),
		},
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock,
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/ai/content-library", () => ({
	generateEmbedding: vi.fn(async () => ({ embedding: [] })),
	cosineSimilarity: vi.fn(() => 0),
	getContentSuggestions: vi.fn(async () => []),
}));

import { recordProposalOutcome } from "@/lib/actions/content-library";

function createQueryBuilder(resolvedValue: unknown, onWhere: (value: unknown) => void) {
	const builder: Record<string, Mock> = {};
	for (const method of ["set", "values"]) {
		builder[method] = vi.fn(() => builder);
	}
	builder.where = vi.fn((value: unknown) => {
		onWhere(value);
		return builder;
	});
	builder.then = vi.fn((resolve: (value: unknown) => void) => resolve(resolvedValue));
	return builder;
}

function collectSqlFragments(value: unknown, seen = new Set<object>()): string[] {
	if (typeof value === "string") {
		return [value];
	}
	if (!value || typeof value !== "object") {
		return [];
	}
	if (seen.has(value)) {
		return [];
	}
	seen.add(value);
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectSqlFragments(item, seen));
	}
	return Reflect.ownKeys(value).flatMap((key) =>
		collectSqlFragments((value as Record<PropertyKey, unknown>)[key], seen)
	);
}

describe("content library proposal outcome scope", () => {
	const updateWheres: unknown[] = [];

	beforeEach(() => {
		vi.clearAllMocks();
		updateWheres.length = 0;
		requireUserContextMock.mockResolvedValue({
			userId: "user-1",
			organizationId: "org-1",
		});
		dbMock.update.mockImplementation(() =>
			createQueryBuilder({ rowCount: 1 }, (where) => {
				updateWheres.push(where);
			})
		);
		dbMock.query.snippetUsageLog.findMany.mockResolvedValue([]);
		dbMock.query.templateUsageLog.findMany.mockResolvedValue([]);
	});

	it("scopes outcome updates and usage reads through assigned opportunities", async () => {
		const result = await recordProposalOutcome({
			opportunityId: "opp-1",
			outcome: "won",
			evaluatorFeedback: "Strong technical score",
		});

		expect(result).toMatchObject({ success: true });
		expect(updateWheres).toHaveLength(2);
		for (const where of updateWheres) {
			const sqlText = collectSqlFragments(where).join(" ");
			expect(sqlText).toContain("assigned_to");
			expect(sqlText).toContain("user-1");
		}

		const snippetReadWhere = dbMock.query.snippetUsageLog.findMany.mock.calls[0][0].where;
		const templateReadWhere = dbMock.query.templateUsageLog.findMany.mock.calls[0][0].where;
		for (const where of [snippetReadWhere, templateReadWhere]) {
			const sqlText = collectSqlFragments(where).join(" ");
			expect(sqlText).toContain("assigned_to");
			expect(sqlText).toContain("user-1");
		}
	});
});
