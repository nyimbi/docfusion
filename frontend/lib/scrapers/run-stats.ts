import { db } from "@/lib/db";
import { scraperRuns } from "@/lib/db/schema";
import { and, avg, count, eq, gte, lte, sum } from "drizzle-orm";

type ScraperRunStatus = typeof scraperRuns.$inferSelect["status"];

export interface ScraperStatsFilters {
	sourceId?: string;
	startedAfter?: Date;
	startedBefore?: Date;
}

export interface ScraperStatsResult {
	totalRuns: number;
	byStatus: Record<ScraperRunStatus, number>;
	successfulRuns: number;
	failedRuns: number;
	partialRuns: number;
	totalOpportunitiesFound: number;
	totalOpportunitiesNew: number;
	totalOpportunitiesUpdated: number;
	avgDurationSeconds: number | null;
	avgOpportunitiesPerRun: number | null;
	successRate: number;
	avgDataQualityScore: number | null;
}

export async function getScraperStatsForPeriod(
	filters?: ScraperStatsFilters
): Promise<ScraperStatsResult> {
	const conditions: ReturnType<typeof eq>[] = [];

	if (filters?.sourceId) {
		conditions.push(eq(scraperRuns.sourceId, filters.sourceId));
	}

	if (filters?.startedAfter) {
		conditions.push(gte(scraperRuns.startedAt, filters.startedAfter));
	}

	if (filters?.startedBefore) {
		conditions.push(lte(scraperRuns.startedAt, filters.startedBefore));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const statusCounts = await db
		.select({
			status: scraperRuns.status,
			count: count(),
		})
		.from(scraperRuns)
		.where(whereClause)
		.groupBy(scraperRuns.status);

	const [aggregateResult] = await db
		.select({
			totalRuns: count(),
			totalOpportunitiesFound: sum(scraperRuns.opportunitiesFound),
			totalOpportunitiesNew: sum(scraperRuns.opportunitiesNew),
			totalOpportunitiesUpdated: sum(scraperRuns.opportunitiesUpdated),
			avgDuration: avg(scraperRuns.durationSeconds),
			avgDataQuality: avg(scraperRuns.dataQualityScore),
		})
		.from(scraperRuns)
		.where(whereClause);

	const byStatus: Record<ScraperRunStatus, number> = {
		pending: 0,
		running: 0,
		success: 0,
		partial: 0,
		failed: 0,
		timeout: 0,
		cancelled: 0,
	};

	for (const row of statusCounts) {
		if (row.status) {
			byStatus[row.status] = row.count;
		}
	}

	const successfulRuns = byStatus.success + byStatus.partial;
	const failedRuns = byStatus.failed + byStatus.timeout;
	const partialRuns = byStatus.partial;
	const totalRuns = aggregateResult?.totalRuns ?? 0;
	const totalOpportunitiesFound = Number(aggregateResult?.totalOpportunitiesFound ?? 0);
	const avgDurationSeconds = aggregateResult?.avgDuration
		? Number(aggregateResult.avgDuration)
		: null;
	const avgDataQualityScore = aggregateResult?.avgDataQuality
		? Number(aggregateResult.avgDataQuality)
		: null;
	const avgOpportunitiesPerRun =
		successfulRuns > 0 ? totalOpportunitiesFound / successfulRuns : null;
	const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;

	return {
		totalRuns,
		byStatus,
		successfulRuns,
		failedRuns,
		partialRuns,
		totalOpportunitiesFound,
		totalOpportunitiesNew: Number(aggregateResult?.totalOpportunitiesNew ?? 0),
		totalOpportunitiesUpdated: Number(aggregateResult?.totalOpportunitiesUpdated ?? 0),
		avgDurationSeconds,
		avgOpportunitiesPerRun,
		successRate,
		avgDataQualityScore,
	};
}
