import { beforeEach, describe, expect, it, vi } from "vitest";

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
	chain.set = vi.fn(() => chain);
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
	delete: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
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
	AIClient: vi.fn(() => ({
		complete: vi.fn(async () => ({ content: "{}" })),
	})),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

import { scanForOccurrences, updateTheme } from "@/lib/actions/win-themes";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "theme-user-1",
		organizationId: "org-1",
	});
});

describe("win theme authorization", () => {
	it("scopes theme updates to opportunities assigned to the actor", async () => {
		let updateWhere: unknown;
		dbMock.update.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				updateWhere = value;
			},
		}));

		const result = await updateTheme(
			"11111111-1111-4111-8111-111111111111",
			{
				statement: "A differentiated delivery approach backed by evidence.",
			}
		);

		expect(result).toEqual({ success: false, error: "Theme not found" });
		const sql = collectSqlFragments(updateWhere).join(" ");
		expect(sql).toContain("opportunities.assigned_to");
		expect(sql).toContain("opportunities.organization_id");
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(dbMock.delete).not.toHaveBeenCalled();
	});

	it("scopes occurrence document scans to proposal documents on assigned opportunities", async () => {
		let docsWhere: unknown;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ id: "22222222-2222-4222-8222-222222222222" }] }))
			.mockReturnValueOnce(createChain({ result: [{ id: "theme-1" }] }))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => {
					docsWhere = value;
				},
			}));

		const result = await scanForOccurrences("22222222-2222-4222-8222-222222222222");

		expect(result).toEqual({ success: true, count: 0 });
		const sql = collectSqlFragments(docsWhere).join(" ");
		expect(sql).toContain("opportunities.assigned_to");
		expect(sql).toContain("opportunities.organization_id");
	});
});
