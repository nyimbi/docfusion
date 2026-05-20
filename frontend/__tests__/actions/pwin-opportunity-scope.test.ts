import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "limit", "orderBy", "values"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => config.result ?? []);
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
	insert: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
	},
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/ai/providers", () => ({
	getProviderManager: vi.fn(() => ({
		initialize: vi.fn(),
		isAvailable: vi.fn(async () => false),
		complete: vi.fn(async () => ({ content: "[]" })),
	})),
}));

import {
	assessPwin,
	compareOpportunities,
	forecastWinProbabilities,
	getPortfolioMetrics,
	optimizePortfolio,
	rankOpportunities,
} from "@/lib/actions/pwin";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "pwin-user-1",
		organizationId: "org-1",
	});
});

describe("PWin opportunity scoping", () => {
	function expectAssignedOpportunityScope(where: unknown) {
		const sqlText = collectSqlFragments(where).join(" ");
		expect(sqlText).toContain("assigned_to");
		expect(sqlText).toContain("pwin-user-1");
	}

	it("scopes opportunity assessment lookup to the assigned user", async () => {
		let opportunityWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				opportunityWhere = value;
			},
		}));

		const result = await assessPwin(
			"33333333-3333-4333-8333-333333333333",
			[
				{
					factorId: "44444444-4444-4444-8444-444444444444",
					factorName: "Capture access",
					score: 6,
					weight: 2,
				},
			]
		);

		expect(result).toEqual({ success: false, error: "Opportunity not found" });
		expectAssignedOpportunityScope(opportunityWhere);
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("scopes portfolio optimization candidates to the assigned user", async () => {
		let candidatesWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				candidatesWhere = value;
			},
		}));
		dbMock.insert.mockReturnValueOnce(createChain({ result: [{ id: "optimization-1" }] }));

		const result = await optimizePortfolio({ optimizationType: "balanced" });

		expect(result.success).toBe(true);
		expectAssignedOpportunityScope(candidatesWhere);
	});

	it("scopes opportunity comparisons to the assigned user", async () => {
		let comparisonWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				comparisonWhere = value;
			},
		}));

		const result = await compareOpportunities([
			"33333333-3333-4333-8333-333333333333",
			"55555555-5555-4555-8555-555555555555",
		]);

		expect(result).toEqual({ success: false, error: "Could not find all requested opportunities" });
		expectAssignedOpportunityScope(comparisonWhere);
	});

	it("scopes opportunity rankings to the assigned user", async () => {
		let rankingWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				rankingWhere = value;
			},
		}));

		const result = await rankOpportunities();

		expect(result).toEqual({ success: true, data: [] });
		expectAssignedOpportunityScope(rankingWhere);
	});

	it("scopes portfolio metrics to the assigned user", async () => {
		let metricsWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				metricsWhere = value;
			},
		}));

		const result = await getPortfolioMetrics();

		expect(result.success).toBe(true);
		expectAssignedOpportunityScope(metricsWhere);
	});

	it("scopes win forecasts to the assigned user", async () => {
		let forecastWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				forecastWhere = value;
			},
		}));

		const result = await forecastWinProbabilities();

		expect(result.success).toBe(true);
		expectAssignedOpportunityScope(forecastWhere);
	});
});
