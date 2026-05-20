import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const completeMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "innerJoin", "limit", "offset", "orderBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
	chain.set = vi.fn(() => chain);
	chain.values = vi.fn(() => chain);
	chain.onConflictDoUpdate = vi.fn(() => chain);
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
	delete: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("@/lib/ai/client", () => ({
	complete: completeMock,
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: {
		error: vi.fn(),
	},
}));

vi.mock("next/cache", () => ({
	revalidatePath: revalidatePathMock,
}));

import {
	analyzePortfolioGaps,
	calculateRelevanceScores,
	deleteProject,
	duplicateProject,
	exportPastPerformanceVolume,
	generateRelevanceMatrix,
	getPastPerformanceAnalytics,
	getProject,
	searchProjects,
	updateProject,
} from "@/lib/actions/past-performance";

const opportunityId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";

const opportunity = {
	id: opportunityId,
	title: "Digital Health Platform",
	sourceId: "DH-2026",
	organization: "Ministry of Health",
	budgetNumeric: 1000000,
	budgetValue: "$1M",
	projectScope: "Implement a digital health platform",
	technicalRequirements: "Cloud integration and analytics",
};

const requirement = {
	id: "33333333-3333-4333-8333-333333333333",
	opportunityId,
	requirementText: "Provide secure cloud analytics",
	category: "Technical",
	priority: "mandatory",
};

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue("past-performance-user-1");
});

describe("past performance opportunity scoping", () => {
	function expectAssignedOpportunityScope(where: unknown) {
		expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
	}

	function expectProjectOwnerScope(where: unknown) {
		const sqlText = collectSqlFragments(where).join(" ");
		expect(sqlText).toContain("created_by");
		expect(sqlText).toContain("past-performance-user-1");
	}

	it("scopes relevance score calculation to the assigned opportunity and requirements", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [opportunity],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}));

		const result = await calculateRelevanceScores(opportunityId);

		expect(result).toMatchObject({ success: true, data: [] });
		expect(wheres).toHaveLength(3);
		expectAssignedOpportunityScope(wheres[0]);
		expectAssignedOpportunityScope(wheres[1]);
		expectProjectOwnerScope(wheres[2]);
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("scopes relevance matrix opportunity, requirements, and saved score reads", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [opportunity],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [requirement],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}));

		const result = await generateRelevanceMatrix({
			opportunityId,
			projectIds: [projectId],
		});

		expect(result).toMatchObject({
			success: true,
			data: {
				opportunityId,
				opportunityTitle: opportunity.title,
			},
		});
		expect(wheres).toHaveLength(4);
		expectAssignedOpportunityScope(wheres[0]);
		expectAssignedOpportunityScope(wheres[1]);
		expectProjectOwnerScope(wheres[2]);
		expectAssignedOpportunityScope(wheres[3]);
	});

	it("scopes past performance exports to assigned opportunities and selected scores", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [opportunity],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}));

		const result = await exportPastPerformanceVolume(opportunityId, "docx");

		expect(result).toMatchObject({
			success: false,
			error: "No past performance projects selected for this opportunity",
		});
		expect(wheres).toHaveLength(2);
		expectAssignedOpportunityScope(wheres[0]);
		expectAssignedOpportunityScope(wheres[1]);
	});

	it("scopes portfolio gap analysis to assigned opportunities and requirements", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [opportunity],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [requirement],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}));

		const result = await analyzePortfolioGaps(opportunityId);

		expect(result).toMatchObject({ success: true });
		expect(wheres).toHaveLength(3);
		expectAssignedOpportunityScope(wheres[0]);
		expectAssignedOpportunityScope(wheres[1]);
		expectProjectOwnerScope(wheres[2]);
	});

	it("scopes project search and analytics to projects created by the caller", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [{ count: 0 }],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}));

		const searchResult = await searchProjects({ limit: 10, offset: 0 });
		const analyticsResult = await getPastPerformanceAnalytics();

		expect(searchResult).toMatchObject({ success: true, data: { projects: [], total: 0 } });
		expect(analyticsResult).toMatchObject({ success: true });
		expect(wheres).toHaveLength(3);
		wheres.forEach(expectProjectOwnerScope);
	});

	it("scopes project ID reads and mutations to projects created by the caller", async () => {
		const wheres: unknown[] = [];
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => wheres.push(value),
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => wheres.push(value),
		}));
		dbMock.delete.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => wheres.push(value),
		}));
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => wheres.push(value),
		}));

		await getProject(projectId);
		await updateProject(projectId, { description: "Updated" });
		await deleteProject(projectId);
		await duplicateProject(projectId);

		expect(wheres).toHaveLength(4);
		wheres.forEach(expectProjectOwnerScope);
	});
});
