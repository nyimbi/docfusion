import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

function createSelectChain(result: unknown[]) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "orderBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (resolve: (value: unknown[]) => void) => Promise.resolve(result).then(resolve);
	return chain;
}

const authMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
}));
const scraperRunsMock = vi.hoisted(() => ({
	getScraperStats: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/actions/scraper-runs", () => scraperRunsMock);

import { GET as healthGET } from "@/app/api/admin/scraper/health/route";
import { GET as statsGET } from "@/app/api/admin/scraper/stats/route";

beforeEach(() => {
	vi.clearAllMocks();
	delete process.env.SCRAPER_API_KEY;
	dbMock.select.mockReturnValue(createSelectChain([]));
	scraperRunsMock.getScraperStats.mockResolvedValue({
		totalRuns: 0,
		successfulRuns: 0,
		failedRuns: 0,
		partialRuns: 0,
		successRate: 0,
		avgDurationSeconds: null,
		totalOpportunitiesFound: 0,
		avgOpportunitiesPerRun: 0,
		avgDataQualityScore: null,
		byStatus: {},
	});
});

describe("scraper admin routes", () => {
	it("rejects anonymous telemetry requests", async () => {
		authMock.mockResolvedValueOnce(null);
		const health = await healthGET(new NextRequest("https://app.test/api/admin/scraper/health"));
		expect(health.status).toBe(401);

		authMock.mockResolvedValueOnce(null);
		const stats = await statsGET(new NextRequest("https://app.test/api/admin/scraper/stats"));
		expect(stats.status).toBe(401);
	});

	it("denies proposal managers", async () => {
		authMock.mockResolvedValueOnce({ user: { id: "pm-1", role: "proposal_manager" } });
		const response = await statsGET(new NextRequest("https://app.test/api/admin/scraper/stats"));
		expect(response.status).toBe(403);
		expect(scraperRunsMock.getScraperStats).not.toHaveBeenCalled();
	});

	it("allows operations sessions and configured API keys", async () => {
		authMock.mockResolvedValueOnce({ user: { id: "ops-1", role: "operations" } });
		const stats = await statsGET(new NextRequest("https://app.test/api/admin/scraper/stats"));
		expect(stats.status).toBe(200);
		expect(scraperRunsMock.getScraperStats).toHaveBeenCalledTimes(1);

		process.env.SCRAPER_API_KEY = "scraper-secret";
		const health = await healthGET(new NextRequest("https://app.test/api/admin/scraper/health", {
			headers: { authorization: "Bearer scraper-secret" },
		}));

		expect(health.status).toBe(200);
		expect(dbMock.select).toHaveBeenCalled();
	});
});
