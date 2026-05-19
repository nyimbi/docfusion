import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "innerJoin", "leftJoin", "limit", "orderBy", "groupBy"]) {
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
	return Object.values(value as Record<string, unknown>).flatMap((item) =>
		collectSqlFragments(item, seen)
	);
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

import {
	assignPartnerToOpportunity,
	getOpportunityPartners,
	getPartnerOpportunities,
	getPartnerPerformance,
	getPartners,
	removePartnerFromOpportunity,
	updatePartnerAssignment,
} from "@/lib/actions/partners";

const opportunityId = "33333333-3333-4333-8333-333333333333";
const partnerId = "44444444-4444-4444-8444-444444444444";
const assignmentId = "55555555-5555-4555-8555-555555555555";

const partnerRow = {
	id: partnerId,
	name: "Acme Partner",
	type: "subcontractor",
	contactName: null,
	contactEmail: null,
	contactPhone: null,
	capabilities: [],
	pastCollaborations: 0,
	performanceRating: null,
	notes: null,
	status: "active",
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue("partners-user-1");
});

describe("partner opportunity scoping", () => {
	it("checks opportunity assignment before assigning partners", async () => {
		let opportunityWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				opportunityWhere = value;
			},
		}));

		await expect(assignPartnerToOpportunity({
			opportunityId,
			partnerId,
			role: "Implementation partner",
		})).rejects.toThrow("Opportunity not found");

		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(collectSqlFragments(opportunityWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes partner list active-opportunity counts to assigned opportunities", async () => {
		let countWhere: unknown;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [] }))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => {
					countWhere = value;
				},
			}));

		const result = await getPartners();

		expect(result).toEqual([]);
		expect(collectSqlFragments(countWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes partner assignment updates through the owning opportunity", async () => {
		let updateWhere: unknown;
		dbMock.update.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				updateWhere = value;
			},
		}));

		await expect(updatePartnerAssignment({
			assignmentId,
			status: "active" as never,
		})).rejects.toThrow(`Partner assignment ${assignmentId} not found`);

		expect(collectSqlFragments(updateWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes partner assignment deletes through the owning opportunity", async () => {
		let deleteWhere: unknown;
		dbMock.delete.mockReturnValueOnce(createChain({
			onWhere: (value) => {
				deleteWhere = value;
			},
		}));

		await removePartnerFromOpportunity(assignmentId);

		expect(collectSqlFragments(deleteWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes opportunity partner reads to assigned opportunities", async () => {
		let readWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				readWhere = value;
			},
		}));

		const result = await getOpportunityPartners(opportunityId);

		expect(result).toEqual([]);
		expect(collectSqlFragments(readWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes partner opportunity history to assigned opportunities", async () => {
		let historyWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				historyWhere = value;
			},
		}));

		const result = await getPartnerOpportunities(partnerId);

		expect(result).toEqual([]);
		expect(collectSqlFragments(historyWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes partner performance metrics to assigned opportunities", async () => {
		let performanceWhere: unknown;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [partnerRow] }))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => {
					performanceWhere = value;
				},
			}));

		const result = await getPartnerPerformance(partnerId);

		expect(result.totalOpportunities).toBe(0);
		expect(collectSqlFragments(performanceWhere).join(" ")).toContain("opportunities.assigned_to");
	});
});
