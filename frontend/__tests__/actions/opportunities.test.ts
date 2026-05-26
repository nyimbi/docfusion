/**
 * Opportunity Server Actions Tests - DocFusion
 *
 * Tests for opportunity CRUD, filter building, statistics,
 * full-text search, and saved search operations.
 *
 * Strategy: mock the drizzle `db` object at module level so every
 * server action exercises its real logic (filter construction, data
 * transformation, pagination arithmetic) while database I/O is
 * replaced by controlled stubs.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// Chainable query builder mock factory
// ---------------------------------------------------------------------------

function createQueryBuilder(resolvedValue: unknown = []) {
	const builder: Record<string, Mock> = {};
	const methods = [
		"select",
		"selectDistinct",
		"from",
		"where",
		"orderBy",
		"limit",
		"offset",
		"groupBy",
		"insert",
		"values",
		"update",
		"set",
		"delete",
		"returning",
	];
	for (const m of methods) {
		builder[m] = vi.fn().mockReturnValue(builder);
	}
	// Awaiting the builder resolves to the configured value
	builder.then = vi.fn((resolve: (v: unknown) => void) => resolve(resolvedValue));
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

// Shared mock db instance
const mockDb = {
	select: vi.fn(),
	selectDistinct: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	execute: vi.fn(),
};
const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const getUserContextMock = vi.hoisted(() => vi.fn());
const requireUserContextMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
	db: mockDb,
}));

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
	getUserContext: getUserContextMock,
	requireUserContext: requireUserContextMock,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wire mockDb so a full chained query resolves to `value`. */
function mockChain(value: unknown) {
	const qb = createQueryBuilder(value);
	mockDb.select.mockReturnValue(qb);
	mockDb.selectDistinct.mockReturnValue(qb);
	mockDb.insert.mockReturnValue(qb);
	mockDb.update.mockReturnValue(qb);
	mockDb.delete.mockReturnValue(qb);
	return qb;
}

/** Mock consecutive db.select() calls (for Promise.all parallel queries). */
function mockParallelSelects(...values: unknown[]) {
	const builders = values.map((v) => createQueryBuilder(v));
	const selectMock = mockDb.select;
	selectMock.mockReset();
	for (const b of builders) {
		selectMock.mockReturnValueOnce(b);
	}
	selectMock.mockReturnValue(createQueryBuilder([]));
	return builders;
}

// ---------------------------------------------------------------------------
// Imports under test
// ---------------------------------------------------------------------------

import { buildOpportunityConditions } from "@/lib/actions/opportunity-filters";
import type { OpportunityFilters } from "@/lib/types/opportunity";

beforeEach(() => {
	getCurrentUserIdMock.mockResolvedValue("user-1");
	getUserContextMock.mockResolvedValue({
		userId: "user-1",
		organizationId: "org-1",
		roles: [],
	});
	requireUserContextMock.mockResolvedValue({
		userId: "user-1",
		organizationId: "org-1",
		roles: [],
	});
});

// ============================================================================
// 1. buildOpportunityConditions
// ============================================================================

describe("buildOpportunityConditions", () => {
	it("returns empty array when filters is undefined", () => {
		expect(buildOpportunityConditions(undefined)).toEqual([]);
	});

	it("returns empty array when filters is empty object", () => {
		expect(buildOpportunityConditions({})).toEqual([]);
	});

	it("adds search condition when search term provided", () => {
		const conditions = buildOpportunityConditions({ search: "water" });
		expect(conditions).toHaveLength(1);
	});

	it("adds category filter when categories array provided", () => {
		const conditions = buildOpportunityConditions({
			categories: ["GIS", "Cybersecurity"],
		});
		expect(conditions).toHaveLength(1);
	});

	it("does not add category filter for empty categories array", () => {
		expect(buildOpportunityConditions({ categories: [] })).toHaveLength(0);
	});

	it("adds status filter when statuses provided", () => {
		const conditions = buildOpportunityConditions({
			statuses: ["pending", "pursuing"],
		});
		expect(conditions).toHaveLength(1);
	});

	it("adds priority filter when priorityRanks provided", () => {
		const conditions = buildOpportunityConditions({ priorityRanks: [1, 5] });
		expect(conditions).toHaveLength(1);
	});

	it("adds sector filter", () => {
		const conditions = buildOpportunityConditions({
			sectors: ["NGO", "Government/SOE"],
		});
		expect(conditions).toHaveLength(1);
	});

	it("adds country filter", () => {
		const conditions = buildOpportunityConditions({
			countries: ["Kenya", "Uganda"],
		});
		expect(conditions).toHaveLength(1);
	});

	it("adds organizations filter", () => {
		const conditions = buildOpportunityConditions({ organizations: ["UNDP"] });
		expect(conditions).toHaveLength(1);
	});

	it("adds budgetMin filter", () => {
		expect(buildOpportunityConditions({ budgetMin: 100000 })).toHaveLength(1);
	});

	it("adds budgetMax filter", () => {
		expect(buildOpportunityConditions({ budgetMax: 500000 })).toHaveLength(1);
	});

	it("adds both budget range filters", () => {
		const conditions = buildOpportunityConditions({
			budgetMin: 100000,
			budgetMax: 500000,
		});
		expect(conditions).toHaveLength(2);
	});

	it("adds fit score range filters", () => {
		const conditions = buildOpportunityConditions({
			fitScoreMin: 60,
			fitScoreMax: 95,
		});
		expect(conditions).toHaveLength(2);
	});

	it("adds deadline range filters (from and to)", () => {
		const conditions = buildOpportunityConditions({
			deadlineFrom: new Date("2025-01-01"),
			deadlineTo: new Date("2025-12-31"),
		});
		expect(conditions).toHaveLength(2);
	});

	it("adds isExpired=false condition (non-expired)", () => {
		const conditions = buildOpportunityConditions({ isExpired: false });
		expect(conditions).toHaveLength(1);
	});

	it("adds isExpired=true condition (expired)", () => {
		const conditions = buildOpportunityConditions({ isExpired: true });
		expect(conditions).toHaveLength(1);
	});

	it("adds isReviewed condition", () => {
		expect(buildOpportunityConditions({ isReviewed: true })).toHaveLength(1);
	});

	it("adds assignedTo filter", () => {
		expect(buildOpportunityConditions({ assignedTo: "user-42" })).toHaveLength(1);
	});

	it("adds sourceFiles filter", () => {
		const conditions = buildOpportunityConditions({
			sourceFiles: ["rfps-q1.xlsx"],
		});
		expect(conditions).toHaveLength(1);
	});

	it("handles continent=africa with regional bloc and country matching", () => {
		const conditions = buildOpportunityConditions({ continent: "africa" });
		// Single OR condition containing 24+ ILIKE patterns
		expect(conditions).toHaveLength(1);
	});

	it("combines multiple filters correctly", () => {
		const filters: OpportunityFilters = {
			search: "water",
			categories: ["GIS"],
			statuses: ["pending"],
			priorityRanks: [4, 5],
			budgetMin: 50000,
			isExpired: false,
			continent: "africa",
		};
		// search + categories + statuses + priorityRanks + budgetMin + isExpired + continent
		expect(buildOpportunityConditions(filters)).toHaveLength(7);
	});

	it("respects excludeFilter option for faceted counts", () => {
		const filters: OpportunityFilters = {
			categories: ["GIS"],
			statuses: ["pending"],
		};
		const conditions = buildOpportunityConditions(filters, {
			excludeFilter: "categories",
		});
		expect(conditions).toHaveLength(1);
	});

	it("excludeFilter does not affect non-matching filters", () => {
		const filters: OpportunityFilters = {
			categories: ["GIS"],
			statuses: ["pending"],
		};
		const conditions = buildOpportunityConditions(filters, {
			excludeFilter: "countries",
		});
		expect(conditions).toHaveLength(2);
	});

	it("handles budgetMin=0 as valid filter", () => {
		expect(buildOpportunityConditions({ budgetMin: 0 })).toHaveLength(1);
	});

	it("handles fitScoreMin=0 as valid filter", () => {
		expect(buildOpportunityConditions({ fitScoreMin: 0 })).toHaveLength(1);
	});
});

// ============================================================================
// 2. getOpportunities
// ============================================================================

describe("getOpportunities", () => {
	let getOpportunities: typeof import("@/lib/actions/opportunities").getOpportunities;

	beforeEach(async () => {
		vi.clearAllMocks();
		const mod = await import("@/lib/actions/opportunities");
		getOpportunities = mod.getOpportunities;
	});

	it("returns paginated results with correct metadata", async () => {
		const futureDate = new Date(Date.now() + 7 * 86400000);
		const rows = [
			{
				id: "opp-1",
				sourceId: "RFP-001",
				title: "Water Systems RFP",
				category: "GIS",
				countryRegion: "Kenya",
				organization: "UNDP",
				deadline: futureDate,
				daysLeft: 7,
				isExpired: false,
				budgetValue: "$100,000",
				priorityRank: 4,
				fitScore: 85,
				decisionStatus: "pending",
				assignedTo: null,
				tags: ["water", "gis"],
				rfpLink: "https://example.com/rfp",
			},
		];
		mockParallelSelects(rows, [{ count: 42 }]);

		const result = await getOpportunities(undefined, undefined, {
			page: 2,
			pageSize: 10,
		});

		expect(result.page).toBe(2);
		expect(result.pageSize).toBe(10);
		expect(result.total).toBe(42);
		expect(result.totalPages).toBe(5);
		expect(result.data).toHaveLength(1);
		expect(result.data[0].title).toBe("Water Systems RFP");
		expect(result.data[0].tags).toEqual(["water", "gis"]);
	});

	it("defaults to page 1 / pageSize 25 when no pagination provided", async () => {
		mockParallelSelects([], [{ count: 0 }]);

		const result = await getOpportunities();

		expect(result.page).toBe(1);
		expect(result.pageSize).toBe(25);
		expect(result.total).toBe(0);
		expect(result.totalPages).toBe(0);
		expect(result.data).toEqual([]);
	});

	it("computes daysLeft and isExpired dynamically from deadline", async () => {
		const pastDate = new Date(Date.now() - 3 * 86400000);
		const rows = [
			{
				id: "opp-2",
				sourceId: null,
				title: "Expired Tender",
				category: null,
				countryRegion: null,
				organization: null,
				deadline: pastDate,
				daysLeft: -3,
				isExpired: true,
				budgetValue: null,
				priorityRank: 3,
				fitScore: null,
				decisionStatus: "expired",
				assignedTo: null,
				tags: [],
				rfpLink: null,
			},
		];
		mockParallelSelects(rows, [{ count: 1 }]);

		const result = await getOpportunities();

		expect(result.data[0].isExpired).toBe(true);
		expect(result.data[0].daysLeft).toBeLessThan(0);
	});

	it("handles null deadline (daysLeft=null, isExpired=false)", async () => {
		const rows = [
			{
				id: "opp-3",
				sourceId: null,
				title: "No Deadline EOI",
				category: null,
				countryRegion: null,
				organization: null,
				deadline: null,
				daysLeft: null,
				isExpired: false,
				budgetValue: null,
				priorityRank: null,
				fitScore: null,
				decisionStatus: null,
				assignedTo: null,
				tags: null,
				rfpLink: null,
			},
		];
		mockParallelSelects(rows, [{ count: 1 }]);

		const result = await getOpportunities();

		expect(result.data[0].daysLeft).toBeNull();
		expect(result.data[0].isExpired).toBe(false);
		expect(result.data[0].tags).toEqual([]);
		expect(result.data[0].priorityRank).toBe(3);
		expect(result.data[0].decisionStatus).toBe("pending");
	});

	it("applies filters via buildOpportunityConditions", async () => {
		mockParallelSelects([], [{ count: 0 }]);
		await getOpportunities({ categories: ["IT"] });
		expect(mockDb.select).toHaveBeenCalled();
	});

	it("calculates totalPages with exact division", async () => {
		mockParallelSelects([], [{ count: 50 }]);
		const result = await getOpportunities(undefined, undefined, {
			page: 1,
			pageSize: 10,
		});
		expect(result.totalPages).toBe(5);
	});

	it("calculates totalPages with remainder", async () => {
		mockParallelSelects([], [{ count: 51 }]);
		const result = await getOpportunities(undefined, undefined, {
			page: 1,
			pageSize: 10,
		});
		expect(result.totalPages).toBe(6);
	});
});

// ============================================================================
// 3. getOpportunityStats
// ============================================================================

describe("getOpportunityStats", () => {
	let getOpportunityStats: typeof import("@/lib/actions/opportunities").getOpportunityStats;

	beforeEach(async () => {
		vi.clearAllMocks();
		const mod = await import("@/lib/actions/opportunities");
		getOpportunityStats = mod.getOpportunityStats;
	});

	it("returns correct stat structure with populated data", async () => {
		mockParallelSelects(
			[{ total: 100, expired: 15, active: 85, totalValue: 5000000, avgFit: 72.5 }],
			[
				{ status: "pending", count: 40 },
				{ status: "pursuing", count: 25 },
				{ status: "won", count: 10 },
				{ status: "declined", count: 5 },
			],
			[
				{ priority: 1, count: 5 },
				{ priority: 3, count: 50 },
				{ priority: 5, count: 20 },
			],
			[
				{ category: "GIS", count: 30 },
				{ category: "IT", count: 20 },
			],
			[
				{ country: "Kenya", count: 25 },
				{ country: "Uganda", count: 10 },
			],
			[{ date: new Date("2025-06-15"), count: 3 }]
		);

		const stats = await getOpportunityStats();

		expect(stats.total).toBe(100);
		expect(stats.expiredCount).toBe(15);
		expect(stats.activeCount).toBe(85);
		expect(stats.totalEstimatedValue).toBe(5000000);
		expect(stats.averageFitScore).toBe(72.5);

		expect(stats.byStatus.pending).toBe(40);
		expect(stats.byStatus.pursuing).toBe(25);
		expect(stats.byStatus.won).toBe(10);
		expect(stats.byStatus.declined).toBe(5);
		expect(stats.byStatus.interested).toBe(0);
		expect(stats.byStatus.submitted).toBe(0);
		expect(stats.byStatus.lost).toBe(0);
		expect(stats.byStatus.expired).toBe(0);

		expect(stats.byPriority[1]).toBe(5);
		expect(stats.byPriority[3]).toBe(50);
		expect(stats.byPriority[5]).toBe(20);
		expect(stats.byPriority[2]).toBe(0);
		expect(stats.byPriority[4]).toBe(0);

		expect(stats.byCategory).toEqual([
			{ category: "GIS", count: 30 },
			{ category: "IT", count: 20 },
		]);
		expect(stats.byCountry).toEqual([
			{ country: "Kenya", count: 25 },
			{ country: "Uganda", count: 10 },
		]);
		expect(stats.upcomingDeadlines).toHaveLength(1);
		expect(stats.upcomingDeadlines[0].count).toBe(3);
	});

	it("handles empty database gracefully", async () => {
		mockParallelSelects(
			[{ total: 0, expired: 0, active: 0, totalValue: 0, avgFit: null }],
			[],
			[],
			[],
			[],
			[]
		);

		const stats = await getOpportunityStats();

		expect(stats.total).toBe(0);
		expect(stats.expiredCount).toBe(0);
		expect(stats.activeCount).toBe(0);
		expect(stats.totalEstimatedValue).toBe(0);
		expect(stats.averageFitScore).toBeNull();
		expect(stats.byCategory).toEqual([]);
		expect(stats.byCountry).toEqual([]);
		expect(stats.upcomingDeadlines).toEqual([]);

		for (const s of ["pending", "interested", "pursuing", "submitted", "won", "lost", "declined", "expired"] as const) {
			expect(stats.byStatus[s]).toBe(0);
		}
		for (const p of [1, 2, 3, 4, 5] as const) {
			expect(stats.byPriority[p]).toBe(0);
		}
	});

	it("handles missing aggregates row by defaulting to zero", async () => {
		mockParallelSelects([], [], [], [], [], []);

		const stats = await getOpportunityStats();

		expect(stats.total).toBe(0);
		expect(stats.expiredCount).toBe(0);
		expect(stats.activeCount).toBe(0);
		expect(stats.totalEstimatedValue).toBe(0);
		expect(stats.averageFitScore).toBeNull();
	});

	it("filters null categories and countries from breakdowns", async () => {
		mockParallelSelects(
			[{ total: 10, expired: 0, active: 10, totalValue: 0, avgFit: null }],
			[],
			[],
			[{ category: null, count: 5 }, { category: "IT", count: 3 }],
			[{ country: null, count: 2 }, { country: "Kenya", count: 8 }],
			[]
		);

		const stats = await getOpportunityStats();

		expect(stats.byCategory).toEqual([{ category: "IT", count: 3 }]);
		expect(stats.byCountry).toEqual([{ country: "Kenya", count: 8 }]);
	});

	it("ignores priority values outside 1-5 range", async () => {
		mockParallelSelects(
			[{ total: 5, expired: 0, active: 5, totalValue: 0, avgFit: null }],
			[],
			[
				{ priority: 0, count: 2 },
				{ priority: 3, count: 3 },
				{ priority: 6, count: 1 },
				{ priority: null, count: 1 },
			],
			[],
			[],
			[]
		);

		const stats = await getOpportunityStats();
		expect(stats.byPriority[3]).toBe(3);
		expect(stats.byPriority[1]).toBe(0);
		expect(stats.byPriority[2]).toBe(0);
	});

	it("ignores invalid status values", async () => {
		mockParallelSelects(
			[{ total: 5, expired: 0, active: 5, totalValue: 0, avgFit: null }],
			[
				{ status: "pending", count: 3 },
				{ status: "invalid_status", count: 2 },
				{ status: null, count: 1 },
			],
			[],
			[],
			[],
			[]
		);

		const stats = await getOpportunityStats();
		expect(stats.byStatus.pending).toBe(3);
		expect("invalid_status" in stats.byStatus).toBe(false);
	});
});

// ============================================================================
// 4. searchOpportunities
// ============================================================================

describe("searchOpportunities", () => {
	let searchOpportunities: typeof import("@/lib/actions/opportunities").searchOpportunities;

	beforeEach(async () => {
		vi.clearAllMocks();
		const mod = await import("@/lib/actions/opportunities");
		searchOpportunities = mod.searchOpportunities;
	});

	it("returns results with searchRank field", async () => {
		const futureDate = new Date(Date.now() + 14 * 86400000);
		const rows = [
			{
				id: "opp-s1",
				sourceId: null,
				title: "Water Infrastructure Project",
				category: "Infrastructure",
				countryRegion: "Tanzania",
				organization: "World Bank",
				deadline: futureDate,
				daysLeft: 14,
				isExpired: false,
				budgetValue: "$2M",
				priorityRank: 5,
				fitScore: 90,
				decisionStatus: "interested",
				assignedTo: "user-1",
				tags: ["water"],
				rfpLink: null,
				searchRank: 0.85,
			},
		];
		mockParallelSelects(rows, [{ count: 1 }]);

		const result = await searchOpportunities("water infrastructure");

		expect(result.data).toHaveLength(1);
		expect(result.data[0].searchRank).toBe(0.85);
		expect(result.data[0].title).toBe("Water Infrastructure Project");
	});

	it("returns empty for no matches", async () => {
		mockParallelSelects([], [{ count: 0 }]);

		const result = await searchOpportunities("xyznonexistent");

		expect(result.data).toEqual([]);
		expect(result.total).toBe(0);
		expect(result.totalPages).toBe(0);
	});

	it("applies additional filters alongside search query", async () => {
		mockParallelSelects([], [{ count: 0 }]);

		const result = await searchOpportunities(
			"infrastructure",
			{ categories: ["IT"] },
			{ field: "deadline", direction: "asc" },
			{ page: 1, pageSize: 5 }
		);

		expect(result.page).toBe(1);
		expect(result.pageSize).toBe(5);
		expect(mockDb.select).toHaveBeenCalled();
	});

	it("defaults to relevance sorting", async () => {
		mockParallelSelects([], [{ count: 0 }]);
		await searchOpportunities("test query");
		expect(mockDb.select).toHaveBeenCalled();
	});

	it("handles special characters in search query without throwing", async () => {
		mockParallelSelects([], [{ count: 0 }]);
		const result = await searchOpportunities("water & sanitation (NGO)");
		expect(result).toBeDefined();
		expect(result.data).toEqual([]);
	});

	it("computes daysLeft and isExpired dynamically in search results", async () => {
		const pastDeadline = new Date(Date.now() - 5 * 86400000);
		const rows = [
			{
				id: "opp-s2",
				sourceId: null,
				title: "Expired Search Result",
				category: null,
				countryRegion: null,
				organization: null,
				deadline: pastDeadline,
				daysLeft: -5,
				isExpired: true,
				budgetValue: null,
				priorityRank: null,
				fitScore: null,
				decisionStatus: null,
				assignedTo: null,
				tags: null,
				rfpLink: null,
				searchRank: 0.5,
			},
		];
		mockParallelSelects(rows, [{ count: 1 }]);

		const result = await searchOpportunities("expired");

		expect(result.data[0].isExpired).toBe(true);
		expect(result.data[0].daysLeft).toBeLessThan(0);
		expect(result.data[0].tags).toEqual([]);
		expect(result.data[0].priorityRank).toBe(3);
		expect(result.data[0].decisionStatus).toBe("pending");
	});
});

// ============================================================================
// 5. getSearchSuggestions
// ============================================================================

describe("getSearchSuggestions", () => {
	let getSearchSuggestions: typeof import("@/lib/actions/opportunities").getSearchSuggestions;

	beforeEach(async () => {
		vi.clearAllMocks();
		const mod = await import("@/lib/actions/opportunities");
		getSearchSuggestions = mod.getSearchSuggestions;
	});

	it("returns empty for prefix shorter than 2 characters", async () => {
		const result = await getSearchSuggestions("a");
		expect(result).toEqual([]);
		expect(mockDb.execute).not.toHaveBeenCalled();
	});

	it("returns empty for empty prefix", async () => {
		const result = await getSearchSuggestions("");
		expect(result).toEqual([]);
	});

	it("returns suggestions from database for valid prefix", async () => {
		mockDb.execute.mockResolvedValueOnce({
			rows: [{ word: "water" }, { word: "watershed" }, { word: "waterfall" }],
		});

		const result = await getSearchSuggestions("wat");

		expect(result).toEqual(["water", "watershed", "waterfall"]);
		expect(mockDb.execute).toHaveBeenCalledTimes(1);
	});

	it("respects custom limit parameter", async () => {
		mockDb.execute.mockResolvedValueOnce({ rows: [{ word: "infra" }] });
		const result = await getSearchSuggestions("inf", 5);
		expect(result).toEqual(["infra"]);
	});
});

// ============================================================================
// 6. Saved Searches CRUD
// ============================================================================

describe("Saved Searches", () => {
	let saveSearch: typeof import("@/lib/actions/opportunities").saveSearch;
	let getSavedSearches: typeof import("@/lib/actions/opportunities").getSavedSearches;
	let getSavedSearch: typeof import("@/lib/actions/opportunities").getSavedSearch;
	let updateSavedSearch: typeof import("@/lib/actions/opportunities").updateSavedSearch;
	let deleteSavedSearch: typeof import("@/lib/actions/opportunities").deleteSavedSearch;

	beforeEach(async () => {
		vi.clearAllMocks();
		getCurrentUserIdMock.mockResolvedValue("user-1");
		const mod = await import("@/lib/actions/opportunities");
		saveSearch = mod.saveSearch;
		getSavedSearches = mod.getSavedSearches;
		getSavedSearch = mod.getSavedSearch;
		updateSavedSearch = mod.updateSavedSearch;
		deleteSavedSearch = mod.deleteSavedSearch;
	});

	describe("saveSearch", () => {
		it("creates saved search and returns hydrated object", async () => {
			const now = new Date();
			const insertedRow = {
				id: "ss-1",
				userId: "user-1",
				name: "Africa Opportunities",
				filters: {
					filters: { continent: "africa", categories: ["IT"] },
					sort: { field: "deadline", direction: "asc" },
					description: "IT opportunities in Africa",
					isDefault: false,
				},
				createdAt: now,
				updatedAt: now,
			};
			mockChain([insertedRow]);

			const result = await saveSearch("user-1", {
				name: "Africa Opportunities",
				description: "IT opportunities in Africa",
				filters: { continent: "africa", categories: ["IT"] },
				sort: { field: "deadline", direction: "asc" },
			});

			expect(result.id).toBe("ss-1");
			expect(result.userId).toBe("user-1");
			expect(result.name).toBe("Africa Opportunities");
			expect(result.filters.continent).toBe("africa");
			expect(result.sort.field).toBe("deadline");
		});
	});

	describe("getSavedSearches", () => {
		it("retrieves all saved searches for a user", async () => {
			const now = new Date();
			const rows = [
				{
					id: "ss-1",
					userId: "user-1",
					name: "Search A",
					filters: {
						filters: { categories: ["GIS"] },
						sort: { field: "deadline", direction: "asc" },
						isDefault: true,
					},
					createdAt: now,
					updatedAt: now,
				},
				{
					id: "ss-2",
					userId: "user-1",
					name: "Search B",
					filters: {
						filters: { statuses: ["pending"] },
						sort: { field: "fitScore", direction: "desc" },
						isDefault: false,
					},
					createdAt: now,
					updatedAt: now,
				},
			];
			mockChain(rows);

			const result = await getSavedSearches("user-1");

			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("Search A");
			expect(result[0].isDefault).toBe(true);
			expect(result[1].filters.statuses).toEqual(["pending"]);
		});

		it("returns empty array for user with no saved searches", async () => {
			getCurrentUserIdMock.mockResolvedValueOnce("user-none");
			mockChain([]);
			const result = await getSavedSearches("user-none");
			expect(result).toEqual([]);
		});

		it("rejects reads for another user's saved searches before querying", async () => {
			await expect(getSavedSearches("other-user")).rejects.toThrow("Unauthorized");
			expect(mockDb.select).not.toHaveBeenCalled();
		});
	});

	describe("getSavedSearch", () => {
		it("retrieves single saved search by ID", async () => {
			const now = new Date();
			const row = {
				id: "ss-1",
				userId: "user-1",
				name: "My Search",
				filters: {
					filters: { search: "water" },
					sort: { field: "deadline", direction: "asc" },
					description: "Water search",
					isDefault: false,
				},
				createdAt: now,
				updatedAt: now,
			};
			mockChain([row]);

			const result = await getSavedSearch("ss-1");

			expect(result).not.toBeNull();
			expect(result!.id).toBe("ss-1");
			expect(result!.description).toBe("Water search");
		});

		it("returns null for non-existent search", async () => {
			mockChain([]);
			const result = await getSavedSearch("nonexistent");
			expect(result).toBeNull();
		});

		it("rejects unauthenticated single-search reads before querying", async () => {
			getCurrentUserIdMock.mockResolvedValueOnce(null);

			await expect(getSavedSearch("ss-1")).rejects.toThrow("Unauthorized");
			expect(mockDb.select).not.toHaveBeenCalled();
		});
	});

	describe("deleteSavedSearch", () => {
		it("returns true when deleted (rowCount > 0)", async () => {
			const qb = createQueryBuilder({ rowCount: 1 });
			mockDb.delete.mockReturnValue(qb);
			const result = await deleteSavedSearch("ss-1");
			expect(result).toBe(true);
		});

		it("returns false when not found (rowCount = 0)", async () => {
			const qb = createQueryBuilder({ rowCount: 0 });
			mockDb.delete.mockReturnValue(qb);
			const result = await deleteSavedSearch("nonexistent");
			expect(result).toBe(false);
		});
	});
});

// ============================================================================
// 7. CRUD Operations
// ============================================================================

describe("CRUD Operations", () => {
	let getOpportunity: typeof import("@/lib/actions/opportunities").getOpportunity;
	let createOpportunity: typeof import("@/lib/actions/opportunities").createOpportunity;
	let updateOpportunity: typeof import("@/lib/actions/opportunities").updateOpportunity;
	let deleteOpportunity: typeof import("@/lib/actions/opportunities").deleteOpportunity;

	beforeEach(async () => {
		vi.clearAllMocks();
		getCurrentUserIdMock.mockResolvedValue("user-1");
		const mod = await import("@/lib/actions/opportunities");
		getOpportunity = mod.getOpportunity;
		createOpportunity = mod.createOpportunity;
		updateOpportunity = mod.updateOpportunity;
		deleteOpportunity = mod.deleteOpportunity;
	});

	describe("getOpportunity", () => {
		it("returns null for non-existent opportunity", async () => {
			mockChain([]);
			const result = await getOpportunity("nonexistent-id");
			expect(result).toBeNull();
		});

		it("returns hydrated opportunity with defaults for null fields", async () => {
			const now = new Date();
			const row = {
				id: "opp-1",
				sourceId: "RFP-001",
				title: "Test RFP",
				category: "IT",
				itCategory: null,
				sector: null,
				countryRegion: "Kenya",
				organization: "UNDP",
				funder: null,
				deadline: new Date(Date.now() + 7 * 86400000),
				daysLeft: 7,
				isExpired: false,
				budgetValue: "$100K",
				budgetNumeric: 100000,
				budgetCurrency: "USD",
				projectSummary: "Test summary",
				projectScope: null,
				keyRequirements: null,
				technicalRequirements: null,
				submissionMethod: null,
				submissionRequirements: null,
				rfpLink: null,
				sourcePlatform: null,
				sourceFile: "test.xlsx",
				opportunityType: null,
				priorityRank: null,
				fitScore: 75,
				winProbability: null,
				revenuePotential: null,
				strategicNotes: null,
				decisionStatus: null,
				decisionReason: null,
				assignedTo: null,
				isReviewed: false,
				tags: null,
				metadata: null,
				createdAt: now,
				updatedAt: now,
				importedAt: now,
				source: null,
				fingerprint: null,
				noticeId: null,
				portalUrl: null,
				documentUrl: null,
				scrapedAt: null,
				publishedDate: null,
				documentsDiscovered: false,
				documentsDiscoveredAt: null,
				documentsDownloadedCount: 0,
				lastDocumentScanAt: null,
				searchVector: null,
				notes: null,
			};
			mockChain([row]);

			const result = await getOpportunity("opp-1");

			expect(result).not.toBeNull();
			expect(result!.id).toBe("opp-1");
			expect(result!.tags).toEqual([]);
			expect(result!.priorityRank).toBe(3);
			expect(result!.decisionStatus).toBe("pending");
			expect(result!.opportunityType).toBe("rfp");
		});

		it("scopes reads to assigned opportunities", async () => {
			let where: unknown;
			const qb = createQueryBuilder([]);
			qb.where.mockImplementation((value: unknown) => {
				where = value;
				return qb;
			});
			mockDb.select.mockReturnValue(qb);

			await getOpportunity("opp-1");

			expect(collectSqlFragments(where).join(" ")).toContain("assigned_to");
		});
	});

	describe("createOpportunity", () => {
		it("creates opportunity and returns hydrated result", async () => {
			const futureDeadline = new Date(Date.now() + 10 * 86400000);
			const now = new Date();
			const returnRow = {
				id: "new-opp-1",
				sourceId: null,
				title: "New RFP",
				category: "GIS",
				itCategory: null,
				sector: null,
				countryRegion: "Kenya",
				organization: "WFP",
				funder: null,
				deadline: futureDeadline,
				daysLeft: 10,
				isExpired: false,
				budgetValue: "$50K",
				budgetNumeric: 50000,
				budgetCurrency: "USD",
				projectSummary: "Test",
				projectScope: null,
				keyRequirements: null,
				technicalRequirements: null,
				submissionMethod: null,
				submissionRequirements: null,
				rfpLink: null,
				sourcePlatform: null,
				sourceFile: null,
				opportunityType: "rfp",
				priorityRank: 3,
				fitScore: null,
				winProbability: null,
				revenuePotential: null,
				strategicNotes: null,
				decisionStatus: "pending",
				decisionReason: null,
				assignedTo: null,
				isReviewed: false,
				tags: [],
				metadata: null,
				createdAt: now,
				updatedAt: now,
				importedAt: now,
				notes: null,
			};
			mockChain([returnRow]);

			const result = await createOpportunity({
				title: "New RFP",
				category: "GIS",
				countryRegion: "Kenya",
				organization: "WFP",
				deadline: futureDeadline,
				budgetValue: "$50K",
				budgetNumeric: 50000,
				budgetCurrency: "USD",
				projectSummary: "Test",
			});

			expect(result.id).toBe("new-opp-1");
			expect(result.title).toBe("New RFP");
			expect(result.tags).toEqual([]);
			expect(result.priorityRank).toBe(3);
			expect(result.decisionStatus).toBe("pending");
		});
	});

	describe("updateOpportunity", () => {
		it("throws when opportunity not found", async () => {
			mockChain([]);
			await expect(
				updateOpportunity("nonexistent", { title: "Updated" })
			).rejects.toThrow("Opportunity not found");
		});

		it("returns updated opportunity", async () => {
			const now = new Date();
			const newDeadline = new Date(Date.now() + 30 * 86400000);
			const returnRow = {
				id: "opp-1",
				sourceId: null,
				title: "Updated RFP",
				category: "IT",
				itCategory: null,
				sector: null,
				countryRegion: "Kenya",
				organization: "UNDP",
				funder: null,
				deadline: newDeadline,
				daysLeft: 30,
				isExpired: false,
				budgetValue: null,
				budgetNumeric: null,
				budgetCurrency: null,
				projectSummary: null,
				projectScope: null,
				keyRequirements: null,
				technicalRequirements: null,
				submissionMethod: null,
				submissionRequirements: null,
				rfpLink: null,
				sourcePlatform: null,
				sourceFile: null,
				opportunityType: "rfp",
				priorityRank: 4,
				fitScore: null,
				winProbability: null,
				revenuePotential: null,
				strategicNotes: null,
				decisionStatus: "pursuing",
				decisionReason: null,
				assignedTo: null,
				isReviewed: false,
				tags: ["updated"],
				metadata: null,
				createdAt: now,
				updatedAt: now,
				importedAt: now,
				notes: null,
			};
			mockChain([returnRow]);

			const result = await updateOpportunity("opp-1", {
				title: "Updated RFP",
				deadline: newDeadline,
			});

			expect(result.id).toBe("opp-1");
			expect(result.title).toBe("Updated RFP");
			expect(result.tags).toEqual(["updated"]);
		});

		it("scopes updates to assigned opportunities", async () => {
			let where: unknown;
			const qb = createQueryBuilder([]);
			qb.where.mockImplementation((value: unknown) => {
				where = value;
				return qb;
			});
			mockDb.update.mockReturnValue(qb);

			await expect(updateOpportunity("opp-1", { title: "Updated" })).rejects.toThrow("Opportunity not found");

			expect(collectSqlFragments(where).join(" ")).toContain("assigned_to");
		});
	});

	describe("deleteOpportunity", () => {
		it("calls db.delete", async () => {
			const qb = createQueryBuilder(undefined);
			mockDb.delete.mockReturnValue(qb);
			await deleteOpportunity("opp-1");
			expect(mockDb.delete).toHaveBeenCalled();
		});

		it("scopes deletes to assigned opportunities", async () => {
			let where: unknown;
			const qb = createQueryBuilder(undefined);
			qb.where.mockImplementation((value: unknown) => {
				where = value;
				return qb;
			});
			mockDb.delete.mockReturnValue(qb);

			await deleteOpportunity("opp-1");

			expect(collectSqlFragments(where).join(" ")).toContain("assigned_to");
		});
	});
});

// ============================================================================
// 8. Bulk Operations
// ============================================================================

describe("Bulk Operations", () => {
	let bulkUpdateStatus: typeof import("@/lib/actions/opportunities").bulkUpdateStatus;
	let bulkUpdatePriority: typeof import("@/lib/actions/opportunities").bulkUpdatePriority;
	let markAsReviewed: typeof import("@/lib/actions/opportunities").markAsReviewed;
	let assignOpportunities: typeof import("@/lib/actions/opportunities").assignOpportunities;

	beforeEach(async () => {
		vi.clearAllMocks();
		getCurrentUserIdMock.mockResolvedValue("user-1");
		const mod = await import("@/lib/actions/opportunities");
		bulkUpdateStatus = mod.bulkUpdateStatus;
		bulkUpdatePriority = mod.bulkUpdatePriority;
		markAsReviewed = mod.markAsReviewed;
		assignOpportunities = mod.assignOpportunities;
	});

	it("bulkUpdateStatus returns count of updated rows", async () => {
		let where: unknown;
		const qb = createQueryBuilder({ rowCount: 5 });
		qb.where.mockImplementation((value: unknown) => {
			where = value;
			return qb;
		});
		mockDb.update.mockReturnValue(qb);
		const count = await bulkUpdateStatus(["a", "b", "c", "d", "e"], "pursuing", "Good fit");
		expect(count).toBe(5);
		expect(collectSqlFragments(where).join(" ")).toContain("assigned_to");
	});

	it("bulkUpdateStatus returns 0 when no rows match", async () => {
		const qb = createQueryBuilder({ rowCount: 0 });
		mockDb.update.mockReturnValue(qb);
		expect(await bulkUpdateStatus([], "pursuing")).toBe(0);
	});

	it("bulkUpdateStatus handles null rowCount", async () => {
		const qb = createQueryBuilder({ rowCount: undefined });
		mockDb.update.mockReturnValue(qb);
		expect(await bulkUpdateStatus(["a"], "declined")).toBe(0);
	});

	it("bulkUpdatePriority returns count", async () => {
		let where: unknown;
		const qb = createQueryBuilder({ rowCount: 3 });
		qb.where.mockImplementation((value: unknown) => {
			where = value;
			return qb;
		});
		mockDb.update.mockReturnValue(qb);
		expect(await bulkUpdatePriority(["a", "b", "c"], 5)).toBe(3);
		expect(collectSqlFragments(where).join(" ")).toContain("assigned_to");
	});

	it("markAsReviewed returns count", async () => {
		let where: unknown;
		const qb = createQueryBuilder({ rowCount: 2 });
		qb.where.mockImplementation((value: unknown) => {
			where = value;
			return qb;
		});
		mockDb.update.mockReturnValue(qb);
		expect(await markAsReviewed(["a", "b"], true)).toBe(2);
		expect(collectSqlFragments(where).join(" ")).toContain("assigned_to");
	});

	it("markAsReviewed defaults reviewed to true", async () => {
		const qb = createQueryBuilder({ rowCount: 1 });
		mockDb.update.mockReturnValue(qb);
		expect(await markAsReviewed(["a"])).toBe(1);
	});

	it("assignOpportunities assigns user", async () => {
		let where: unknown;
		const qb = createQueryBuilder({ rowCount: 2 });
		qb.where.mockImplementation((value: unknown) => {
			where = value;
			return qb;
		});
		mockDb.update.mockReturnValue(qb);
		expect(await assignOpportunities(["a", "b"], "user-42")).toBe(2);
		expect(collectSqlFragments(where).join(" ")).toContain("assigned_to");
	});

	it("assignOpportunities unassigns with null", async () => {
		const qb = createQueryBuilder({ rowCount: 1 });
		mockDb.update.mockReturnValue(qb);
		expect(await assignOpportunities(["a"], null)).toBe(1);
	});
});

// ============================================================================
// 9. Import Operations
// ============================================================================

describe("Import Operations", () => {
	let getImportHistory: typeof import("@/lib/actions/opportunities").getImportHistory;
	let createImportRecord: typeof import("@/lib/actions/opportunities").createImportRecord;
	let updateImportRecord: typeof import("@/lib/actions/opportunities").updateImportRecord;

	beforeEach(async () => {
		vi.clearAllMocks();
		getCurrentUserIdMock.mockResolvedValue("admin");
		getUserContextMock.mockResolvedValue({
			userId: "admin",
			organizationId: "org-1",
			roles: [],
		});
		requireUserContextMock.mockResolvedValue({
			userId: "admin",
			organizationId: "org-1",
			roles: [],
		});
		const mod = await import("@/lib/actions/opportunities");
		getImportHistory = mod.getImportHistory;
		createImportRecord = mod.createImportRecord;
		updateImportRecord = mod.updateImportRecord;
	});

	it("getImportHistory returns typed import records", async () => {
		const now = new Date();
		const qb = mockChain([
			{
				id: "imp-1",
				filename: "rfps.xlsx",
				filePath: null,
				totalRecords: 100,
				importedRecords: 90,
				updatedRecords: 5,
				skippedRecords: 3,
				failedRecords: 2,
				status: "completed",
				errors: [{ rowIndex: 50, status: "failed", error: "Invalid date" }],
				config: null,
				importedBy: "admin",
				startedAt: now,
				completedAt: now,
			},
		]);

		const result = await getImportHistory();

		expect(result).toHaveLength(1);
		expect(result[0].filename).toBe("rfps.xlsx");
		expect(result[0].status).toBe("completed");
		expect(result[0].errors).toHaveLength(1);
		const whereSql = collectSqlFragments(qb.where.mock.calls[0][0]).join(" ");
		expect(whereSql).toContain("imported_by");
		expect(whereSql).toContain("admin");
	});

	it("getImportHistory defaults null errors to empty array", async () => {
		mockChain([
			{
				id: "imp-2",
				filename: "test.xlsx",
				filePath: null,
				totalRecords: 10,
				importedRecords: 10,
				updatedRecords: 0,
				skippedRecords: 0,
				failedRecords: 0,
				status: "completed",
				errors: null,
				config: null,
				importedBy: "admin",
				startedAt: new Date(),
				completedAt: new Date(),
			},
		]);

		const result = await getImportHistory();
		expect(result[0].errors).toEqual([]);
	});

	it("createImportRecord returns the new record ID", async () => {
		const qb = mockChain([{ id: "imp-new-1" }]);
		const id = await createImportRecord("new-data.xlsx", 50);
		expect(id).toBe("imp-new-1");
		expect(qb.values).toHaveBeenCalledWith(expect.objectContaining({
			importedBy: "admin",
		}));
	});

	it("createImportRecord accepts an explicit import owner for service runs", async () => {
		const qb = mockChain([{ id: "imp-service-1" }]);
		const id = await createImportRecord("scheduled.jsonl", 3, undefined, "service-user-1");

		expect(id).toBe("imp-service-1");
		expect(qb.values).toHaveBeenCalledWith(expect.objectContaining({
			importedBy: "service-user-1",
		}));
		expect(getCurrentUserIdMock).not.toHaveBeenCalled();
	});

	it("updateImportRecord calls db.update", async () => {
		const qb = createQueryBuilder(undefined);
		mockDb.update.mockReturnValue(qb);

		await updateImportRecord("imp-1", {
			importedRecords: 45,
			updatedRecords: 3,
			skippedRecords: 1,
			failedRecords: 1,
			status: "completed",
			errors: [],
		});

		expect(mockDb.update).toHaveBeenCalled();
		const whereSql = collectSqlFragments(qb.where.mock.calls[0][0]).join(" ");
		expect(whereSql).toContain("imported_by");
		expect(whereSql).toContain("admin");
	});
});

// ============================================================================
// 10. refreshDeadlineStatus
// ============================================================================

describe("refreshDeadlineStatus", () => {
	let refreshDeadlineStatus: typeof import("@/lib/actions/opportunities").refreshDeadlineStatus;

	beforeEach(async () => {
		vi.clearAllMocks();
		const mod = await import("@/lib/actions/opportunities");
		refreshDeadlineStatus = mod.refreshDeadlineStatus;
	});

	it("returns count of updated rows", async () => {
		mockDb.execute.mockResolvedValueOnce({ rowCount: 42 });
		expect(await refreshDeadlineStatus()).toBe(42);
		expect(mockDb.execute).toHaveBeenCalledTimes(1);
	});

	it("returns 0 when no rows have deadlines", async () => {
		mockDb.execute.mockResolvedValueOnce({ rowCount: 0 });
		expect(await refreshDeadlineStatus()).toBe(0);
	});

	it("returns 0 when rowCount is undefined", async () => {
		mockDb.execute.mockResolvedValueOnce({});
		expect(await refreshDeadlineStatus()).toBe(0);
	});
});

// ============================================================================
// 11. getFilterOptions
// ============================================================================

describe("getFilterOptions", () => {
	let getFilterOptions: typeof import("@/lib/actions/opportunities").getFilterOptions;

	beforeEach(async () => {
		vi.clearAllMocks();
		const mod = await import("@/lib/actions/opportunities");
		getFilterOptions = mod.getFilterOptions;
	});

	it("returns distinct values for all filter dimensions", async () => {
		const data = [
			[{ value: "GIS" }, { value: "IT" }],
			[{ value: "NGO" }],
			[{ value: "Kenya" }, { value: "Uganda" }],
			[{ value: "UNDP" }],
			[{ value: "q1.xlsx" }],
		];
		const builders = data.map((v) => createQueryBuilder(v));
		mockDb.selectDistinct
			.mockReturnValueOnce(builders[0])
			.mockReturnValueOnce(builders[1])
			.mockReturnValueOnce(builders[2])
			.mockReturnValueOnce(builders[3])
			.mockReturnValueOnce(builders[4]);

		const result = await getFilterOptions();

		expect(result.categories).toEqual(["GIS", "IT"]);
		expect(result.sectors).toEqual(["NGO"]);
		expect(result.countries).toEqual(["Kenya", "Uganda"]);
		expect(result.organizations).toEqual(["UNDP"]);
		expect(result.sourceFiles).toEqual(["q1.xlsx"]);
	});

	it("returns empty arrays when no data exists", async () => {
		mockDb.selectDistinct.mockReturnValue(createQueryBuilder([]));

		const result = await getFilterOptions();

		expect(result.categories).toEqual([]);
		expect(result.sectors).toEqual([]);
		expect(result.countries).toEqual([]);
		expect(result.organizations).toEqual([]);
		expect(result.sourceFiles).toEqual([]);
	});
});

// ============================================================================
// 12. SavedSearch hydration round-trip
// ============================================================================

describe("SavedSearch hydration round-trip", () => {
	let saveSearch: typeof import("@/lib/actions/opportunities").saveSearch;

	beforeEach(async () => {
		vi.clearAllMocks();
		getCurrentUserIdMock.mockResolvedValue("user-1");
		const mod = await import("@/lib/actions/opportunities");
		saveSearch = mod.saveSearch;
	});

	it("preserves filters, sort, description, isDefault", async () => {
		const now = new Date();
		const inputFilters = {
			search: "water",
			categories: ["GIS"],
			budgetMin: 10000,
			continent: "africa",
		};
		const inputSort = { field: "fitScore" as const, direction: "desc" as const };

		mockChain([
			{
				id: "ss-rt",
				userId: "user-1",
				name: "Round Trip",
				filters: {
					filters: inputFilters,
					sort: inputSort,
					description: "Testing round trip",
					isDefault: true,
				},
				createdAt: now,
				updatedAt: now,
			},
		]);

		const result = await saveSearch("user-1", {
			name: "Round Trip",
			description: "Testing round trip",
			filters: inputFilters,
			sort: inputSort,
			isDefault: true,
		});

		expect(result.filters).toEqual(inputFilters);
		expect(result.sort).toEqual(inputSort);
		expect(result.description).toBe("Testing round trip");
		expect(result.isDefault).toBe(true);
	});

	it("defaults isDefault to false when not in stored payload", async () => {
		const now = new Date();
		mockChain([
			{
				id: "ss-nd",
				userId: "user-1",
				name: "No Default",
				filters: {
					filters: { search: "test" },
					sort: { field: "deadline", direction: "asc" },
				},
				createdAt: now,
				updatedAt: now,
			},
		]);

		const result = await saveSearch("user-1", {
			name: "No Default",
			filters: { search: "test" },
			sort: { field: "deadline", direction: "asc" },
		});

		expect(result.isDefault).toBe(false);
	});

	it("defaults sort when not in stored payload", async () => {
		const now = new Date();
		mockChain([
			{
				id: "ss-ns",
				userId: "user-1",
				name: "No Sort",
				filters: { filters: { search: "test" } },
				createdAt: now,
				updatedAt: now,
			},
		]);

		const result = await saveSearch("user-1", {
			name: "No Sort",
			filters: { search: "test" },
			sort: { field: "deadline", direction: "asc" },
		});

		expect(result.sort).toEqual({ field: "deadline", direction: "asc" });
	});
});

// ============================================================================
// 13. refreshSearchVectors
// ============================================================================

describe("refreshSearchVectors", () => {
	let refreshSearchVectors: typeof import("@/lib/actions/opportunities").refreshSearchVectors;

	beforeEach(async () => {
		vi.clearAllMocks();
		const mod = await import("@/lib/actions/opportunities");
		refreshSearchVectors = mod.refreshSearchVectors;
	});

	it("returns count of updated rows", async () => {
		mockDb.execute.mockResolvedValueOnce({ rowCount: 15 });
		expect(await refreshSearchVectors()).toBe(15);
	});

	it("returns 0 when rowCount is undefined", async () => {
		mockDb.execute.mockResolvedValueOnce({});
		expect(await refreshSearchVectors()).toBe(0);
	});
});
