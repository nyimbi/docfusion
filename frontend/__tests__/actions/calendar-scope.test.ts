import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const requireUserContextMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "innerJoin", "limit", "orderBy"]) {
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

import {
	getDeadlinesByDateRange,
	getMilestones,
} from "@/lib/actions/calendar";

const opportunityId = "11111111-1111-4111-8111-111111111111";
const dateRange = {
	startDate: new Date("2026-01-01T00:00:00.000Z"),
	endDate: new Date("2026-01-31T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue("calendar-user-1");
	requireUserContextMock.mockResolvedValue({
		userId: "calendar-user-1",
		organizationId: "org-1",
		roles: ["proposal_manager"],
	});
});

describe("calendar opportunity scoping", () => {
	it("scopes aggregate deadline source queries to assigned opportunities", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [],
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

		const result = await getDeadlinesByDateRange(dateRange);

		expect(result).toEqual([]);
		expect(wheres).toHaveLength(4);
		for (const where of wheres) {
			const sqlText = collectSqlFragments(where).join(" ");
			expect(sqlText).toContain("opportunities.organization_id");
			expect(sqlText).toContain("org-1");
			expect(sqlText).toContain("opportunities.assigned_to");
			expect(sqlText).toContain("calendar-user-1");
		}
	});

	it("scopes milestone source queries through the assigned opportunity", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [],
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

		const result = await getMilestones(opportunityId);

		expect(result).toEqual([]);
		expect(wheres).toHaveLength(4);
		for (const where of wheres) {
			const sqlText = collectSqlFragments(where).join(" ");
			expect(sqlText).toContain("opportunities.organization_id");
			expect(sqlText).toContain("org-1");
			expect(sqlText).toContain("opportunities.assigned_to");
			expect(sqlText).toContain("calendar-user-1");
		}
	});
});
