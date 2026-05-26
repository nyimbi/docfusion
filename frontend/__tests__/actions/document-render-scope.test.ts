import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const requireUserContextMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "innerJoin", "limit"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
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
	return Object.values(value as Record<string, unknown>).flatMap((item) => collectSqlFragments(item, seen));
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
	},
}));

vi.mock("@/lib/render/latex-converter", () => ({
	tiptapToLatex: vi.fn(),
	tiptapToPlainText: vi.fn(),
}));
vi.mock("@/lib/render/docx-converter", () => ({
	tiptapToDocx: vi.fn(),
}));
vi.mock("@/lib/render/pptx-converter", () => ({
	tiptapToPptx: vi.fn(),
	estimateSlideCount: vi.fn(),
}));

import { preSubmissionAudit } from "@/lib/actions/document-render";

const opportunityId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue("render-user-1");
	requireUserContextMock.mockResolvedValue({
		userId: "render-user-1",
		organizationId: "org-1",
		roles: ["proposal_manager"],
	});
});

describe("document render opportunity scoping", () => {
	it("scopes pre-submission audit opportunity and proposal document reads", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{
					id: opportunityId,
					title: "Response",
					deadline: null,
					decisionStatus: "pending",
				}],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}));

		const result = await preSubmissionAudit(opportunityId);

		expect(result.opportunityId).toBe(opportunityId);
		expect(result.isReady).toBe(false);
		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			const sqlText = collectSqlFragments(where).join(" ");
			expect(sqlText).toContain("opportunities.organization_id");
			expect(sqlText).toContain("org-1");
			expect(sqlText).toContain("opportunities.assigned_to");
			expect(sqlText).toContain("render-user-1");
		}
	});
});
