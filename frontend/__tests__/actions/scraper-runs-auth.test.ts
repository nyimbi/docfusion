import { beforeEach, describe, expect, it, vi } from "vitest";

const requireServerSessionMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const getStatsMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	requireServerSession: requireServerSessionMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema", () => ({
	scraperRuns: {},
	scraperSources: {},
}));
vi.mock("@/lib/scrapers/run-stats", () => ({
	getScraperStatsForPeriod: getStatsMock,
}));
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

import {
	cancelScraperRun,
	completeScraperRun,
	createScraperRun,
	failScraperRun,
	getBatchRuns,
	getRecentRuns,
	getRunCountsBySource,
	getRunTimeline,
	getScraperRun,
	getScraperRuns,
	getScraperStats,
	getSourceHealth,
	updateScraperRun,
} from "@/lib/actions/scraper-runs";

beforeEach(() => {
	vi.clearAllMocks();
	requireServerSessionMock.mockRejectedValue(new Error("Unauthorized"));
});

describe("scraper run action auth", () => {
	it("rejects unauthenticated run actions before database or internal stats access", async () => {
		await expect(getScraperRuns()).rejects.toThrow("Unauthorized");
		await expect(getScraperRun("run-1")).rejects.toThrow("Unauthorized");
		await expect(createScraperRun({
			sourceId: "source-1",
			sourceKey: "source-key",
			runId: "run-1",
			triggerType: "manual",
		} as never)).rejects.toThrow("Unauthorized");
		await expect(updateScraperRun("run-1", { progress: 50 })).rejects.toThrow("Unauthorized");
		await expect(completeScraperRun("run-1", {
			opportunitiesFound: 1,
			opportunitiesNew: 1,
			opportunitiesUpdated: 0,
			opportunitiesSkipped: 0,
			opportunitiesFailed: 0,
			pagesScraped: 1,
			requestsMade: 1,
			rateLimitHits: 0,
			bytesDownloaded: 1024,
		})).rejects.toThrow("Unauthorized");
		await expect(failScraperRun("run-1", {
			errorMessage: "failed",
			errorType: "test",
		})).rejects.toThrow("Unauthorized");
		await expect(getScraperStats()).rejects.toThrow("Unauthorized");
		await expect(getSourceHealth()).rejects.toThrow("Unauthorized");
		await expect(getBatchRuns("batch-1")).rejects.toThrow("Unauthorized");
		await expect(getRecentRuns()).rejects.toThrow("Unauthorized");
		await expect(cancelScraperRun("run-1")).rejects.toThrow("Unauthorized");
		await expect(getRunCountsBySource()).rejects.toThrow("Unauthorized");
		await expect(getRunTimeline()).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
		expect(getStatsMock).not.toHaveBeenCalled();
	});
});
