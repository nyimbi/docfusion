import { db } from "@/lib/db";
import { scraperRuns, scraperSources, type ScraperRun } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function updateSourceMetricsForRun(
	sourceId: string,
	runResult: {
		success: boolean;
		opportunitiesFound: number;
		uniqueOpportunities: number;
		durationSeconds: number;
		error?: string;
	}
): Promise<void> {
	const source = await db.query.scraperSources.findFirst({
		where: eq(scraperSources.id, sourceId),
	});

	if (!source) return;

	const totalRuns = (source.successfulRuns || 0) + (source.failedRuns || 0) + 1;
	const newSuccessfulRuns = runResult.success
		? (source.successfulRuns || 0) + 1
		: source.successfulRuns || 0;
	const newFailedRuns = runResult.success
		? source.failedRuns || 0
		: (source.failedRuns || 0) + 1;

	const successRate = (newSuccessfulRuns / totalRuns) * 100;

	const prevAvgDuration = source.avgRunDurationSeconds || runResult.durationSeconds;
	const newAvgDuration =
		((prevAvgDuration * (totalRuns - 1)) + runResult.durationSeconds) / totalRuns;

	const prevAvgOpps = source.avgOpportunitiesPerRun || runResult.opportunitiesFound;
	const newAvgOpps =
		((prevAvgOpps * (newSuccessfulRuns - 1)) + runResult.opportunitiesFound) /
		Math.max(newSuccessfulRuns, 1);

	let healthStatus: "healthy" | "degraded" | "failing" | "unknown" = "healthy";
	if (!runResult.success) {
		healthStatus = newFailedRuns >= 3 ? "failing" : "degraded";
	} else if (runResult.opportunitiesFound === 0 && source.lastOpportunitiesCount && source.lastOpportunitiesCount > 0) {
		healthStatus = "degraded";
	}

	await db
		.update(scraperSources)
		.set({
			healthStatus,
			lastRunAt: new Date(),
			lastSuccessAt: runResult.success ? new Date() : source.lastSuccessAt,
			lastError: runResult.error || null,
			lastOpportunitiesCount: runResult.opportunitiesFound,
			totalOpportunitiesScraped: (source.totalOpportunitiesScraped || 0) + runResult.opportunitiesFound,
			uniqueOpportunitiesContributed: (source.uniqueOpportunitiesContributed || 0) + runResult.uniqueOpportunities,
			successfulRuns: newSuccessfulRuns,
			failedRuns: newFailedRuns,
			successRate,
			avgRunDurationSeconds: newAvgDuration,
			avgOpportunitiesPerRun: newAvgOpps,
			updatedAt: new Date(),
		})
		.where(eq(scraperSources.id, sourceId));
}

export async function createScraperRunRecord(
	data: Omit<typeof scraperRuns.$inferInsert, "id">
): Promise<ScraperRun> {
	const [run] = await db.insert(scraperRuns).values(data).returning();
	return run;
}

export async function updateScraperRunRecord(
	id: string,
	data: Partial<typeof scraperRuns.$inferInsert>
): Promise<ScraperRun | null> {
	const [updated] = await db
		.update(scraperRuns)
		.set(data)
		.where(eq(scraperRuns.id, id))
		.returning();
	return updated || null;
}
