import { beforeEach, describe, expect, it, vi } from "vitest";

const requireTenantContextMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "limit", "offset", "orderBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
	chain.set = vi.fn(() => chain);
	chain.values = vi.fn(() => chain);
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
	transaction: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth/tenant-context", () => ({
	requireTenantContext: requireTenantContextMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		transaction: vi.fn(),
	},
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(),
	upsertWorkflowRuntimeTask: vi.fn(),
}));

vi.mock("@/lib/ai/providers", () => ({
	getProviderManager: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: {
		warn: vi.fn(),
	},
}));

import {
	analyzeRequirementGaps,
	createRequirement,
	getRequirementStats,
	getRequirements,
	updateRequirement,
} from "@/lib/actions/requirements";

const opportunityId = "11111111-1111-4111-8111-111111111111";
const requirementId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
	vi.clearAllMocks();
	requireTenantContextMock.mockResolvedValue({
		userId: "requirements-user-1",
		organizationId: "org-1",
	});
});

describe("requirements opportunity scoping", () => {
	it("scopes paginated requirement reads through assigned opportunities", async () => {
		const wheres: unknown[] = [];
		const rowsChain = createChain({
			result: [],
			onWhere: (value) => wheres.push(value),
		});
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{ count: 0 }],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(rowsChain);

		const result = await getRequirements(opportunityId, undefined, undefined, {
			page: -5,
			pageSize: -20,
		});

		expect(result).toMatchObject({ data: [], total: 0, page: 1, pageSize: 1 });
		expect(wheres).toHaveLength(2);
		expect(rowsChain.limit).toHaveBeenCalledWith(1);
		expect(rowsChain.offset).toHaveBeenCalledWith(0);
		for (const where of wheres) {
			expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
		}
	});

	it("checks opportunity assignment before creating requirements", async () => {
		let opportunityWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				opportunityWhere = value;
			},
		}));

		await expect(createRequirement({
			opportunityId,
			text: "The contractor shall provide secure hosting.",
		})).rejects.toThrow("Opportunity not found");

		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(collectSqlFragments(opportunityWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes single requirement updates through the owning opportunity", async () => {
		let updateWhere: unknown;
		dbMock.update.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				updateWhere = value;
			},
		}));

		const result = await updateRequirement(requirementId, { complianceStatus: "partial" });

		expect(result).toBeNull();
		expect(collectSqlFragments(updateWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes requirement stats to assigned opportunities", async () => {
		let statsWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				statsWhere = value;
			},
		}));

		const result = await getRequirementStats(opportunityId);

		expect(result.total).toBe(0);
		expect(collectSqlFragments(statsWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes requirement gap analysis to assigned opportunities", async () => {
		let analysisWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				analysisWhere = value;
			},
		}));

		const result = await analyzeRequirementGaps(opportunityId);

		expect(result).toMatchObject({ opportunityId, overallReadiness: 0 });
		expect(collectSqlFragments(analysisWhere).join(" ")).toContain("opportunities.assigned_to");
	});
});
