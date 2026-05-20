import { beforeEach, describe, expect, it, vi } from "vitest";

const requireScraperOperatorSessionMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "orderBy", "limit", "offset"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/db", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/db")>();
	return {
		...actual,
		db: dbMock = {
			select: vi.fn(),
		},
	};
});

vi.mock("@/lib/scrapers/session-auth", () => ({
	requireScraperOperatorSession: requireScraperOperatorSessionMock,
}));

vi.mock("@/lib/scrapers/run-stats", () => ({
	getScraperStatsForPeriod: vi.fn(),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

import { getRecentRuns, getScraperRuns } from "@/lib/actions/scraper-runs";

beforeEach(() => {
	vi.clearAllMocks();
	requireScraperOperatorSessionMock.mockResolvedValue({
		userId: "scraper-admin-1",
		organizationId: "org-1",
	});
});

describe("scraper run pagination", () => {
	it("normalizes paginated run page and page size before querying", async () => {
		const rowsChain = createChain({ result: [] });
		const countChain = createChain({ result: [{ count: 0 }] });
		dbMock.select
			.mockReturnValueOnce(rowsChain)
			.mockReturnValueOnce(countChain);

		const result = await getScraperRuns(undefined, undefined, { page: -3, pageSize: -10 });

		expect(result).toMatchObject({ data: [], total: 0, page: 1, pageSize: 1, totalPages: 0 });
		expect(rowsChain.limit).toHaveBeenCalledWith(1);
		expect(rowsChain.offset).toHaveBeenCalledWith(0);
	});

	it("normalizes recent run limits before querying", async () => {
		const lowLimitChain = createChain({ result: [] });
		const highLimitChain = createChain({ result: [] });
		dbMock.select
			.mockReturnValueOnce(lowLimitChain)
			.mockReturnValueOnce(highLimitChain);

		await expect(getRecentRuns(-10)).resolves.toEqual([]);
		await expect(getRecentRuns(2500)).resolves.toEqual([]);

		expect(lowLimitChain.limit).toHaveBeenCalledWith(1);
		expect(highLimitChain.limit).toHaveBeenCalledWith(1000);
	});
});
