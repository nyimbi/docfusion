import { beforeEach, describe, expect, it, vi } from "vitest";

const requireServerSessionMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const createRunRecordMock = vi.hoisted(() => vi.fn());
const updateRunRecordMock = vi.hoisted(() => vi.fn());
const updateSourceMetricsMock = vi.hoisted(() => vi.fn());
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
	scraperSources: {},
	scraperRuns: {},
	scraperSchedules: {},
}));
vi.mock("@/lib/scrapers/source-persistence", () => ({
	createScraperRunRecord: createRunRecordMock,
	updateScraperRunRecord: updateRunRecordMock,
	updateSourceMetricsForRun: updateSourceMetricsMock,
}));
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

import {
	bulkCreateSchedules,
	bulkCreateSources,
	createScraperRun,
	createScraperSource,
	deleteScraperSource,
	getPaginatedScraperSources,
	getRunStats,
	getScheduleTiers,
	getScraperSource,
	getScraperSources,
	getSourceRuns,
	getSourcesForTier,
	getSourcesStats,
	toggleSourceEnabled,
	updateScraperRun,
	updateScraperSource,
	updateSourceMetrics,
} from "@/lib/actions/scraper-sources";

beforeEach(() => {
	vi.clearAllMocks();
	requireServerSessionMock.mockRejectedValue(new Error("Unauthorized"));
});

describe("scraper source action auth", () => {
	it("rejects unauthenticated source actions before database or internal persistence access", async () => {
		await expect(getScraperSources()).rejects.toThrow("Unauthorized");
		await expect(getPaginatedScraperSources({ page: 1, pageSize: 25 })).rejects.toThrow("Unauthorized");
		await expect(getScraperSource("source-1")).rejects.toThrow("Unauthorized");
		await expect(createScraperSource({
			sourceId: "source-key",
			name: "Source",
			url: "https://example.test",
			sourceType: "government",
		} as never)).rejects.toThrow("Unauthorized");
		await expect(updateScraperSource("source-1", { name: "Updated" })).rejects.toThrow("Unauthorized");
		await expect(toggleSourceEnabled("source-1", false)).rejects.toThrow("Unauthorized");
		await expect(deleteScraperSource("source-1")).rejects.toThrow("Unauthorized");
		await expect(getSourcesStats()).rejects.toThrow("Unauthorized");
		await expect(updateSourceMetrics("source-1", {
			success: true,
			opportunitiesFound: 1,
			uniqueOpportunities: 1,
			durationSeconds: 5,
		})).rejects.toThrow("Unauthorized");
		await expect(createScraperRun({
			sourceId: "source-1",
			sourceKey: "source-key",
			runId: "run-1",
		} as never)).rejects.toThrow("Unauthorized");
		await expect(updateScraperRun("run-1", { progress: 50 })).rejects.toThrow("Unauthorized");
		await expect(getSourceRuns("source-1")).rejects.toThrow("Unauthorized");
		await expect(getRunStats()).rejects.toThrow("Unauthorized");
		await expect(getScheduleTiers()).rejects.toThrow("Unauthorized");
		await expect(getSourcesForTier(1)).rejects.toThrow("Unauthorized");
		await expect(bulkCreateSources([])).rejects.toThrow("Unauthorized");
		await expect(bulkCreateSchedules([])).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
		expect(createRunRecordMock).not.toHaveBeenCalled();
		expect(updateRunRecordMock).not.toHaveBeenCalled();
		expect(updateSourceMetricsMock).not.toHaveBeenCalled();
	});
});
