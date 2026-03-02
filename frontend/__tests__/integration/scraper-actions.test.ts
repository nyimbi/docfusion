/**
 * Tests for Scraper Run Server Actions
 *
 * Tests the server action patterns used in frontend/lib/actions/scraper-runs.ts
 */

import { describe, it, expect, beforeEach } from "vitest";

// Mock types matching the scraper runs schema
type ScraperRunStatus =
	| "pending"
	| "running"
	| "success"
	| "partial"
	| "failed"
	| "timeout"
	| "cancelled";

interface ScraperRun {
	id: string;
	sourceId: string;
	sourceKey: string;
	runId: string;
	batchId?: string;
	triggerType: "scheduled" | "manual" | "api";
	status: ScraperRunStatus;
	startedAt: Date;
	completedAt?: Date;
	durationSeconds?: number;
	progress: number;
	opportunitiesFound: number;
	opportunitiesNew: number;
	opportunitiesUpdated: number;
	opportunitiesSkipped: number;
	opportunitiesFailed: number;
	pagesScraped: number;
	requestsMade: number;
	rateLimitHits: number;
	bytesDownloaded: number;
	errorMessage?: string;
	errorType?: string;
}

// In-memory store for testing
let runsStore: Map<string, ScraperRun> = new Map();
let runCounter = 0;

// Helper to create mock runs
function createMockRun(overrides: Partial<ScraperRun> = {}): ScraperRun {
	runCounter++;
	return {
		id: `run-${runCounter}`,
		sourceId: `source-${runCounter}`,
		sourceKey: "test-source",
		runId: `test_${new Date().toISOString().slice(0, 10)}_${runCounter}`,
		triggerType: "scheduled",
		status: "pending",
		startedAt: new Date(),
		progress: 0,
		opportunitiesFound: 0,
		opportunitiesNew: 0,
		opportunitiesUpdated: 0,
		opportunitiesSkipped: 0,
		opportunitiesFailed: 0,
		pagesScraped: 0,
		requestsMade: 0,
		rateLimitHits: 0,
		bytesDownloaded: 0,
		...overrides,
	};
}

// Mock server action patterns
async function getScraperRuns(options: {
	sourceId?: string;
	status?: ScraperRunStatus;
	limit?: number;
	offset?: number;
}): Promise<{ runs: ScraperRun[]; total: number }> {
	let runs = Array.from(runsStore.values());

	if (options.sourceId) {
		runs = runs.filter((r) => r.sourceId === options.sourceId);
	}

	if (options.status) {
		runs = runs.filter((r) => r.status === options.status);
	}

	const total = runs.length;
	const offset = options.offset ?? 0;
	const limit = options.limit ?? 50;

	runs = runs.slice(offset, offset + limit);
	runs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

	return { runs, total };
}

async function createScraperRun(input: {
	sourceId: string;
	sourceKey: string;
	triggerType: "scheduled" | "manual" | "api";
}): Promise<ScraperRun> {
	const run = createMockRun({
		sourceId: input.sourceId,
		sourceKey: input.sourceKey,
		triggerType: input.triggerType,
		status: "pending",
		startedAt: new Date(),
	});

	runsStore.set(run.id, run);
	return run;
}

async function completeScraperRun(
	runId: string,
	data: {
		opportunitiesFound: number;
		opportunitiesNew: number;
		opportunitiesUpdated: number;
		pagesScraped: number;
		durationSeconds: number;
	}
): Promise<ScraperRun> {
	const run = runsStore.get(runId);
	if (!run) {
		throw new Error(`Run not found: ${runId}`);
	}

	const updated: ScraperRun = {
		...run,
		status: "success",
		completedAt: new Date(),
		durationSeconds: data.durationSeconds,
		opportunitiesFound: data.opportunitiesFound,
		opportunitiesNew: data.opportunitiesNew,
		opportunitiesUpdated: data.opportunitiesUpdated,
		pagesScraped: data.pagesScraped,
		progress: 100,
	};

	runsStore.set(runId, updated);
	return updated;
}

async function failScraperRun(
	runId: string,
	error: { message: string; type: string }
): Promise<ScraperRun> {
	const run = runsStore.get(runId);
	if (!run) {
		throw new Error(`Run not found: ${runId}`);
	}

	const updated: ScraperRun = {
		...run,
		status: "failed",
		completedAt: new Date(),
		errorMessage: error.message,
		errorType: error.type,
	};

	runsStore.set(runId, updated);
	return updated;
}

async function getScraperStats(options: {
	since?: Date;
}): Promise<{
	totalRuns: number;
	successRate: number;
	avgDuration: number;
	totalOpportunities: number;
}> {
	const runs = Array.from(runsStore.values());
	let filtered = runs;

	if (options.since) {
		filtered = filtered.filter((r) => r.startedAt >= options.since!);
	}

	const totalRuns = filtered.length;
	const successfulRuns = filtered.filter((r) => r.status === "success").length;
	const successRate = totalRuns > 0 ? successfulRuns / totalRuns : 0;

	const totalDuration = filtered.reduce(
		(sum, r) => sum + (r.durationSeconds ?? 0),
		0
	);
	const avgDuration = totalRuns > 0 ? totalDuration / totalRuns : 0;

	const totalOpportunities = filtered.reduce(
		(sum, r) => sum + r.opportunitiesFound,
		0
	);

	return {
		totalRuns,
		successRate,
		avgDuration,
		totalOpportunities,
	};
}

describe("Scraper Run Server Actions", () => {
	beforeEach(() => {
		runsStore.clear();
		runCounter = 0;
	});

	describe("getScraperRuns", () => {
		it("should return empty array when no runs exist", async () => {
			const result = await getScraperRuns({});
			expect(result.runs).toEqual([]);
			expect(result.total).toBe(0);
		});

		it("should return all runs", async () => {
			await createScraperRun({
				sourceId: "source-1",
				sourceKey: "ungm",
				triggerType: "scheduled",
			});
			await createScraperRun({
				sourceId: "source-2",
				sourceKey: "devex",
				triggerType: "manual",
			});

			const result = await getScraperRuns({});
			expect(result.runs.length).toBe(2);
			expect(result.total).toBe(2);
		});

		it("should filter by sourceId", async () => {
			await createScraperRun({
				sourceId: "source-1",
				sourceKey: "ungm",
				triggerType: "scheduled",
			});
			await createScraperRun({
				sourceId: "source-2",
				sourceKey: "devex",
				triggerType: "scheduled",
			});

			const result = await getScraperRuns({ sourceId: "source-1" });
			expect(result.runs.length).toBe(1);
			expect(result.runs[0].sourceId).toBe("source-1");
		});

		it("should filter by status", async () => {
			const run1 = await createScraperRun({
				sourceId: "source-1",
				sourceKey: "ungm",
				triggerType: "scheduled",
			});
			await completeScraperRun(run1.id, {
				opportunitiesFound: 10,
				opportunitiesNew: 5,
				opportunitiesUpdated: 3,
				pagesScraped: 5,
				durationSeconds: 60,
			});

			await createScraperRun({
				sourceId: "source-2",
				sourceKey: "devex",
				triggerType: "scheduled",
			});

			const pending = await getScraperRuns({ status: "pending" });
			expect(pending.runs.length).toBe(1);

			const success = await getScraperRuns({ status: "success" });
			expect(success.runs.length).toBe(1);
		});

		it("should paginate results", async () => {
			for (let i = 0; i < 10; i++) {
				await createScraperRun({
					sourceId: `source-${i}`,
					sourceKey: "test",
					triggerType: "scheduled",
				});
			}

			const page1 = await getScraperRuns({ limit: 5, offset: 0 });
			expect(page1.runs.length).toBe(5);

			const page2 = await getScraperRuns({ limit: 5, offset: 5 });
			expect(page2.runs.length).toBe(5);
		});
	});

	describe("createScraperRun", () => {
		it("should create a run with pending status", async () => {
			const run = await createScraperRun({
				sourceId: "source-1",
				sourceKey: "ungm",
				triggerType: "scheduled",
			});

			expect(run.status).toBe("pending");
			expect(run.sourceId).toBe("source-1");
			expect(run.sourceKey).toBe("ungm");
			expect(run.triggerType).toBe("scheduled");
		});

		it("should generate unique IDs", async () => {
			const run1 = await createScraperRun({
				sourceId: "source-1",
				sourceKey: "test",
				triggerType: "scheduled",
			});
			const run2 = await createScraperRun({
				sourceId: "source-1",
				sourceKey: "test",
				triggerType: "scheduled",
			});

			expect(run1.id).not.toBe(run2.id);
		});
	});

	describe("completeScraperRun", () => {
		it("should mark run as success", async () => {
			const run = await createScraperRun({
				sourceId: "source-1",
				sourceKey: "ungm",
				triggerType: "scheduled",
			});

			const completed = await completeScraperRun(run.id, {
				opportunitiesFound: 100,
				opportunitiesNew: 25,
				opportunitiesUpdated: 50,
				pagesScraped: 10,
				durationSeconds: 330,
			});

			expect(completed.status).toBe("success");
			expect(completed.opportunitiesFound).toBe(100);
			expect(completed.durationSeconds).toBe(330);
			expect(completed.progress).toBe(100);
			expect(completed.completedAt).toBeDefined();
		});

		it("should throw if run not found", async () => {
			await expect(
				completeScraperRun("nonexistent", {
					opportunitiesFound: 10,
					opportunitiesNew: 5,
					opportunitiesUpdated: 3,
					pagesScraped: 5,
					durationSeconds: 60,
				})
			).rejects.toThrow("Run not found");
		});
	});

	describe("failScraperRun", () => {
		it("should mark run as failed with error", async () => {
			const run = await createScraperRun({
				sourceId: "source-1",
				sourceKey: "ungm",
				triggerType: "scheduled",
			});

			const failed = await failScraperRun(run.id, {
				message: "Connection timeout",
				type: "TimeoutError",
			});

			expect(failed.status).toBe("failed");
			expect(failed.errorMessage).toBe("Connection timeout");
			expect(failed.errorType).toBe("TimeoutError");
		});
	});

	describe("getScraperStats", () => {
		it("should return zero stats when no runs", async () => {
			const stats = await getScraperStats({});

			expect(stats.totalRuns).toBe(0);
			expect(stats.successRate).toBe(0);
			expect(stats.avgDuration).toBe(0);
			expect(stats.totalOpportunities).toBe(0);
		});

		it("should calculate correct statistics", async () => {
			// Create 5 runs: 4 success, 1 failed
			for (let i = 0; i < 4; i++) {
				const run = await createScraperRun({
					sourceId: `source-${i}`,
					sourceKey: "test",
					triggerType: "scheduled",
				});
				await completeScraperRun(run.id, {
					opportunitiesFound: 100,
					opportunitiesNew: 25,
					opportunitiesUpdated: 50,
					pagesScraped: 10,
					durationSeconds: 60,
				});
			}

			const failedRun = await createScraperRun({
				sourceId: "source-failed",
				sourceKey: "test",
				triggerType: "scheduled",
			});
			await failScraperRun(failedRun.id, {
				message: "Error",
				type: "ScrapingError",
			});

			const stats = await getScraperStats({});

			expect(stats.totalRuns).toBe(5);
			expect(stats.successRate).toBeCloseTo(0.8); // 4/5
			expect(stats.avgDuration).toBeCloseTo(48); // (60*4 + 0)/5
			expect(stats.totalOpportunities).toBe(400); // 100 * 4
		});

		it("should filter by date", async () => {
			const run = await createScraperRun({
				sourceId: "source-1",
				sourceKey: "test",
				triggerType: "scheduled",
			});
			await completeScraperRun(run.id, {
				opportunitiesFound: 50,
				opportunitiesNew: 10,
				opportunitiesUpdated: 20,
				pagesScraped: 5,
				durationSeconds: 30,
			});

			// Filter to only include runs from the future
			const futureDate = new Date();
			futureDate.setFullYear(futureDate.getFullYear() + 1);

			const stats = await getScraperStats({ since: futureDate });
			expect(stats.totalRuns).toBe(0);
		});
	});
});