import { beforeEach, describe, expect, it, vi } from "vitest";

const requireScraperOperatorSessionMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
}));

function createChain(result: unknown[] = []) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "orderBy", "limit", "offset"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(result).then(resolve);
	return chain;
}

vi.mock("@/lib/db", () => ({
	db: dbMock,
}));

vi.mock("@/lib/scrapers/session-auth", () => ({
	requireScraperOperatorSession: requireScraperOperatorSessionMock,
}));

vi.mock("@/lib/scrapers/source-persistence", () => ({
	createScraperRunRecord: vi.fn(),
	updateScraperRunRecord: vi.fn(),
	updateSourceMetricsForRun: vi.fn(),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

import {
	getPaginatedScraperSources,
	getScraperSources,
	getSourceRuns,
} from "@/lib/actions/scraper-sources";

beforeEach(() => {
	vi.clearAllMocks();
	requireScraperOperatorSessionMock.mockResolvedValue(undefined);
});

describe("scraper source pagination bounds", () => {
	it("normalizes optional scraper source list limits", async () => {
		const sourceChain = createChain([]);
		dbMock.select.mockReturnValueOnce(sourceChain);

		await expect(getScraperSources({ limit: -10 })).resolves.toEqual([]);

		expect(sourceChain.limit).toHaveBeenCalledWith(1);
	});

	it("normalizes paginated source page and page size", async () => {
		const rowsChain = createChain([]);
		dbMock.select
			.mockReturnValueOnce(createChain([{ count: 2 }]))
			.mockReturnValueOnce(rowsChain);

		const result = await getPaginatedScraperSources({ page: -3, pageSize: -10 });

		expect(rowsChain.limit).toHaveBeenCalledWith(1);
		expect(rowsChain.offset).toHaveBeenCalledWith(0);
		expect(result.pagination).toEqual({
			page: 1,
			pageSize: 1,
			total: 2,
			totalPages: 2,
			hasMore: true,
		});
	});

	it("normalizes source run limits", async () => {
		const runsChain = createChain([]);
		dbMock.select.mockReturnValueOnce(runsChain);

		await expect(getSourceRuns("source-1", { limit: Number.POSITIVE_INFINITY })).resolves.toEqual([]);

		expect(runsChain.limit).toHaveBeenCalledWith(50);
	});
});
