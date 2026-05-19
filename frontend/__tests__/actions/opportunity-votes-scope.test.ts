import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "groupBy", "limit", "orderBy"]) {
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
};

vi.mock("@/lib/auth-utils", () => ({
	getServerSession: getServerSessionMock,
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
	castVote,
	getVoteSummariesBulk,
	getVoteSummary,
	getVotes,
	updateDecisionFromVotes,
} from "@/lib/actions/opportunity-votes";

const opportunityId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
	vi.clearAllMocks();
	getServerSessionMock.mockResolvedValue({
		user: {
			id: "vote-user-1",
			name: "Vote User",
			email: "vote@example.com",
		},
	});
});

describe("opportunity vote scoping", () => {
	it("checks opportunity assignment before casting votes", async () => {
		let opportunityWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				opportunityWhere = value;
			},
		}));

		await expect(castVote({
			opportunityId,
			userId: "spoofed-user",
			vote: "go",
		})).rejects.toThrow("Opportunity not found");

		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(collectSqlFragments(opportunityWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes vote list reads through the assigned opportunity", async () => {
		let votesWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				votesWhere = value;
			},
		}));

		const result = await getVotes(opportunityId);

		expect(result).toEqual([]);
		expect(collectSqlFragments(votesWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes vote summary count and confidence reads", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [{}],
				onWhere: (value) => wheres.push(value),
			}));

		const result = await getVoteSummary(opportunityId);

		expect(result).toMatchObject({ opportunityId, totalVotes: 0 });
		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
		}
	});

	it("scopes automatic opportunity status reads and updates", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ vote: "go", count: 2 }] }))
			.mockReturnValueOnce(createChain({ result: [{}] }))
			.mockReturnValueOnce(createChain({
				result: [{ decisionStatus: "pending" }],
				onWhere: (value) => wheres.push(value),
			}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => wheres.push(value),
		}));

		const result = await updateDecisionFromVotes(opportunityId);

		expect(result).toEqual({ updated: true, newStatus: "interested" });
		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
		}
	});

	it("scopes bulk summaries to visible opportunity IDs", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{ id: opportunityId }],
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

		const result = await getVoteSummariesBulk([opportunityId]);

		expect(result.has(opportunityId)).toBe(true);
		expect(wheres).toHaveLength(3);
		for (const where of wheres) {
			expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
		}
	});
});
