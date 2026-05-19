/**
 * Scraper Runs Server Actions
 *
 * Server-side actions for managing scraper run history, tracking execution
 * results, and providing aggregate statistics and health monitoring.
 */

"use server";

import { db } from "@/lib/db";
import {
	scraperRuns,
	scraperSources,
	type ScraperRun,
	type NewScraperRun,
} from "@/lib/db/schema";
import {
	eq,
	and,
	or,
	desc,
	asc,
	gte,
	lte,
	inArray,
	ilike,
	sql,
	count,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getScraperStatsForPeriod } from "@/lib/scrapers/run-stats";
import { requireScraperOperatorSession } from "@/lib/scrapers/session-auth";

function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/g, "\\$&");
}

function safeRevalidatePath(path: string): void {
	try {
		revalidatePath(path);
	} catch {
		// Scraper workers can run outside a Next request/static-generation store.
	}
}

async function requireScraperRunActionSession(): Promise<void> {
	await requireScraperOperatorSession();
}

// ============================================================================
// Types
// ============================================================================

export type { ScraperRun, NewScraperRun };

export type ScraperRunStatus = typeof scraperRuns.$inferSelect["status"];

export interface ScraperRunWithSource extends ScraperRun {
	source?: {
		id: string;
		sourceId: string;
		name: string;
		sourceType: string;
	} | null;
}

export interface ScraperRunFilters {
	sourceId?: string;
	sourceKey?: string;
	status?: ScraperRunStatus;
	statuses?: ScraperRunStatus[];
	triggerType?: string;
	batchId?: string;
	startedAfter?: Date;
	startedBefore?: Date;
	search?: string;
}

export interface ScraperRunSort {
	field: "startedAt" | "completedAt" | "durationSeconds" | "opportunitiesFound" | "status";
	direction: "asc" | "desc";
}

export interface PaginationOptions {
	page: number;
	pageSize: number;
}

export interface PaginatedRuns {
	data: ScraperRunWithSource[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

export interface ScraperStats {
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

export interface SourceHealthItem {
	sourceId: string;
	sourceKey: string;
	sourceName: string;
	healthStatus: string;
	lastRunAt: Date | null;
	lastSuccessAt: Date | null;
	lastError: string | null;
	successRate: number | null;
	totalRuns: number;
	successfulRuns: number;
	failedRuns: number;
	lastOpportunitiesCount: number;
	avgRunDurationSeconds: number | null;
	avgOpportunitiesPerRun: number | null;
	dataQualityScore: number | null;
	valueScore: number | null;
}

export interface CompleteRunResults {
	opportunitiesFound: number;
	opportunitiesNew: number;
	opportunitiesUpdated: number;
	opportunitiesSkipped: number;
	opportunitiesFailed: number;
	pagesScraped: number;
	requestsMade: number;
	rateLimitHits: number;
	bytesDownloaded: number;
	dataQualityScore?: number;
	sampleData?: unknown;
	warnings?: unknown[];
}

export interface FailRunError {
	errorMessage: string;
	errorType?: string;
	errorLog?: unknown[];
}

// ============================================================================
// Query Operations
// ============================================================================

/**
 * Get paginated scraper runs with filtering and sorting
 */
export async function getScraperRuns(
	filters?: ScraperRunFilters,
	sort?: ScraperRunSort,
	pagination?: PaginationOptions
): Promise<PaginatedRuns> {
	await requireScraperRunActionSession();
	const page = pagination?.page ?? 1;
	const pageSize = pagination?.pageSize ?? 25;
	const offset = (page - 1) * pageSize;

	// Build WHERE conditions
	const conditions: ReturnType<typeof eq>[] = [];

	if (filters?.sourceId) {
		conditions.push(eq(scraperRuns.sourceId, filters.sourceId));
	}

	if (filters?.sourceKey) {
		conditions.push(eq(scraperRuns.sourceKey, filters.sourceKey));
	}

	if (filters?.status) {
		conditions.push(eq(scraperRuns.status, filters.status));
	}

	if (filters?.statuses?.length) {
		conditions.push(inArray(scraperRuns.status, filters.statuses));
	}

	if (filters?.triggerType) {
		conditions.push(eq(scraperRuns.triggerType, filters.triggerType));
	}

	if (filters?.batchId) {
		conditions.push(eq(scraperRuns.batchId, filters.batchId));
	}

	if (filters?.startedAfter) {
		conditions.push(gte(scraperRuns.startedAt, filters.startedAfter));
	}

	if (filters?.startedBefore) {
		conditions.push(lte(scraperRuns.startedAt, filters.startedBefore));
	}

	if (filters?.search?.trim()) {
		const pattern = `%${escapeLikePattern(filters.search.trim())}%`;
		const searchClause = or(
			ilike(scraperRuns.runId, pattern),
			ilike(scraperRuns.sourceKey, pattern),
			ilike(scraperRuns.batchId, pattern),
			ilike(scraperRuns.errorMessage, pattern),
		);
		if (searchClause) {
			conditions.push(searchClause as ReturnType<typeof eq>);
		}
	}

	// Build ORDER BY
	const sortField = sort?.field ?? "startedAt";
	const sortDir = sort?.direction ?? "desc";

	const orderByColumn = {
		startedAt: scraperRuns.startedAt,
		completedAt: scraperRuns.completedAt,
		durationSeconds: scraperRuns.durationSeconds,
		opportunitiesFound: scraperRuns.opportunitiesFound,
		status: scraperRuns.status,
	}[sortField];

	const orderBy = sortDir === "asc" ? asc(orderByColumn) : desc(orderByColumn);

	// Execute queries
	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const [rows, totalResult] = await Promise.all([
		db
			.select({
				id: scraperRuns.id,
				sourceId: scraperRuns.sourceId,
				sourceKey: scraperRuns.sourceKey,
				runId: scraperRuns.runId,
				batchId: scraperRuns.batchId,
				triggerType: scraperRuns.triggerType,
				startedAt: scraperRuns.startedAt,
				completedAt: scraperRuns.completedAt,
				durationSeconds: scraperRuns.durationSeconds,
				status: scraperRuns.status,
				progress: scraperRuns.progress,
				opportunitiesFound: scraperRuns.opportunitiesFound,
				opportunitiesNew: scraperRuns.opportunitiesNew,
				opportunitiesUpdated: scraperRuns.opportunitiesUpdated,
				opportunitiesSkipped: scraperRuns.opportunitiesSkipped,
				opportunitiesFailed: scraperRuns.opportunitiesFailed,
				pagesScraped: scraperRuns.pagesScraped,
				requestsMade: scraperRuns.requestsMade,
				rateLimitHits: scraperRuns.rateLimitHits,
				bytesDownloaded: scraperRuns.bytesDownloaded,
				errorMessage: scraperRuns.errorMessage,
				errorType: scraperRuns.errorType,
				errorLog: scraperRuns.errorLog,
				warnings: scraperRuns.warnings,
				dataQualityScore: scraperRuns.dataQualityScore,
				sampleData: scraperRuns.sampleData,
				runConfig: scraperRuns.runConfig,
				performanceMetrics: scraperRuns.performanceMetrics,
			})
			.from(scraperRuns)
			.where(whereClause)
			.orderBy(orderBy)
			.limit(pageSize)
			.offset(offset),
		db
			.select({ count: count() })
			.from(scraperRuns)
			.where(whereClause),
	]);

	const total = totalResult[0]?.count ?? 0;

	// Optionally join with sources for additional context
	let data: ScraperRunWithSource[] = rows;
	if (rows.length > 0) {
		const sourceIds = [...new Set(rows.map((r) => r.sourceId))];
		const sources = await db
			.select({
				id: scraperSources.id,
				sourceId: scraperSources.sourceId,
				name: scraperSources.name,
				sourceType: scraperSources.sourceType,
			})
			.from(scraperSources)
			.where(inArray(scraperSources.id, sourceIds));

		const sourceMap = new Map(sources.map((s) => [s.id, s]));

		data = rows.map((row) => ({
			...row,
			source: sourceMap.get(row.sourceId) ?? null,
		}));
	}

	return {
		data,
		total,
		page,
		pageSize,
		totalPages: Math.ceil(total / pageSize),
	};
}

/**
 * Get a single scraper run by ID
 */
export async function getScraperRun(id: string): Promise<ScraperRunWithSource | null> {
	await requireScraperRunActionSession();
	const [run] = await db
		.select()
		.from(scraperRuns)
		.where(eq(scraperRuns.id, id))
		.limit(1);

	if (!run) return null;

	// Get source info
	const [source] = await db
		.select({
			id: scraperSources.id,
			sourceId: scraperSources.sourceId,
			name: scraperSources.name,
			sourceType: scraperSources.sourceType,
		})
		.from(scraperSources)
		.where(eq(scraperSources.id, run.sourceId))
		.limit(1);

	return {
		...run,
		source: source ?? null,
	};
}

// ============================================================================
// Mutation Operations
// ============================================================================

/**
 * Create a new scraper run
 */
export async function createScraperRun(
	data: Omit<NewScraperRun, "id">
): Promise<ScraperRun> {
	await requireScraperRunActionSession();
	const [run] = await db
		.insert(scraperRuns)
		.values({
			...data,
			startedAt: data.startedAt ?? new Date(),
			status: data.status ?? "pending",
			opportunitiesFound: data.opportunitiesFound ?? 0,
			opportunitiesNew: data.opportunitiesNew ?? 0,
			opportunitiesUpdated: data.opportunitiesUpdated ?? 0,
			opportunitiesSkipped: data.opportunitiesSkipped ?? 0,
			opportunitiesFailed: data.opportunitiesFailed ?? 0,
			pagesScraped: data.pagesScraped ?? 0,
			requestsMade: data.requestsMade ?? 0,
			rateLimitHits: data.rateLimitHits ?? 0,
			bytesDownloaded: data.bytesDownloaded ?? 0,
		})
		.returning();

	safeRevalidatePath("/opportunities/sources");
	safeRevalidatePath("/opportunities/runs");

	return run;
}

/**
 * Update a scraper run
 */
export async function updateScraperRun(
	id: string,
	data: Partial<Omit<NewScraperRun, "id">>
): Promise<ScraperRun | null> {
	await requireScraperRunActionSession();
	const [updated] = await db
		.update(scraperRuns)
		.set(data)
		.where(eq(scraperRuns.id, id))
		.returning();

	safeRevalidatePath("/opportunities/sources");
	safeRevalidatePath("/opportunities/runs");

	return updated ?? null;
}

/**
 * Mark a scraper run as completed with results
 */
export async function completeScraperRun(
	id: string,
	results: CompleteRunResults
): Promise<ScraperRun | null> {
	await requireScraperRunActionSession();
	// Get the run to calculate duration
	const [existingRun] = await db
		.select({ startedAt: scraperRuns.startedAt })
		.from(scraperRuns)
		.where(eq(scraperRuns.id, id))
		.limit(1);

	if (!existingRun) return null;

	const completedAt = new Date();
	const durationSeconds =
		existingRun.startedAt
			? (completedAt.getTime() - existingRun.startedAt.getTime()) / 1000
			: null;

	// Determine final status based on results
	// partial: some failures but some successes
	// success: no failures (or no data)
	// failed: handled by failScraperRun
	const status: ScraperRunStatus =
		results.opportunitiesFailed > 0 ? "partial" : "success";

	const [updated] = await db
		.update(scraperRuns)
		.set({
			status,
			completedAt,
			durationSeconds,
			opportunitiesFound: results.opportunitiesFound,
			opportunitiesNew: results.opportunitiesNew,
			opportunitiesUpdated: results.opportunitiesUpdated,
			opportunitiesSkipped: results.opportunitiesSkipped,
			opportunitiesFailed: results.opportunitiesFailed,
			pagesScraped: results.pagesScraped,
			requestsMade: results.requestsMade,
			rateLimitHits: results.rateLimitHits,
			bytesDownloaded: results.bytesDownloaded,
			dataQualityScore: results.dataQualityScore ?? null,
			sampleData: results.sampleData ?? null,
			warnings: results.warnings ?? null,
		})
		.where(eq(scraperRuns.id, id))
		.returning();

	// Update source metrics if we have a valid sourceId
	if (updated?.sourceId) {
		await updateSourceHealthAfterRun(updated.sourceId);
	}

	safeRevalidatePath("/opportunities/sources");
	safeRevalidatePath("/opportunities/runs");

	return updated ?? null;
}

/**
 * Mark a scraper run as failed with error details
 */
export async function failScraperRun(
	id: string,
	error: FailRunError
): Promise<ScraperRun | null> {
	await requireScraperRunActionSession();
	// Get the run to calculate duration
	const [existingRun] = await db
		.select({ startedAt: scraperRuns.startedAt, sourceId: scraperRuns.sourceId })
		.from(scraperRuns)
		.where(eq(scraperRuns.id, id))
		.limit(1);

	if (!existingRun) return null;

	const completedAt = new Date();
	const durationSeconds =
		existingRun.startedAt
			? (completedAt.getTime() - existingRun.startedAt.getTime()) / 1000
			: null;

	const [updated] = await db
		.update(scraperRuns)
		.set({
			status: "failed",
			completedAt,
			durationSeconds,
			errorMessage: error.errorMessage,
			errorType: error.errorType ?? null,
			errorLog: error.errorLog ?? null,
		})
		.where(eq(scraperRuns.id, id))
		.returning();

	// Update source health
	if (existingRun.sourceId) {
		await updateSourceHealthAfterRun(existingRun.sourceId);
	}

	safeRevalidatePath("/opportunities/sources");
	safeRevalidatePath("/opportunities/runs");

	return updated ?? null;
}

// ============================================================================
// Statistics & Health
// ============================================================================

/**
 * Get aggregate scraper statistics
 */
export async function getScraperStats(
	filters?: Pick<ScraperRunFilters, "sourceId" | "startedAfter" | "startedBefore">
): Promise<ScraperStats> {
	await requireScraperRunActionSession();
	return getScraperStatsForPeriod(filters);
}

/**
 * Get health status by source
 */
export async function getSourceHealth(): Promise<SourceHealthItem[]> {
	await requireScraperRunActionSession();
	// Join runs with sources to compute health metrics
	const sources = await db
		.select({
			id: scraperSources.id,
			sourceId: scraperSources.sourceId,
			name: scraperSources.name,
			sourceType: scraperSources.sourceType,
			healthStatus: scraperSources.healthStatus,
			lastRunAt: scraperSources.lastRunAt,
			lastSuccessAt: scraperSources.lastSuccessAt,
			lastError: scraperSources.lastError,
			successRate: scraperSources.successRate,
			successfulRuns: scraperSources.successfulRuns,
			failedRuns: scraperSources.failedRuns,
			lastOpportunitiesCount: scraperSources.lastOpportunitiesCount,
			avgRunDurationSeconds: scraperSources.avgRunDurationSeconds,
			avgOpportunitiesPerRun: scraperSources.avgOpportunitiesPerRun,
			dataQualityScore: scraperSources.dataQualityScore,
			valueScore: scraperSources.valueScore,
			totalOpportunitiesScraped: scraperSources.totalOpportunitiesScraped,
		})
		.from(scraperSources)
		.orderBy(asc(scraperSources.priority), asc(scraperSources.name));

	// Calculate total runs from successfulRuns + failedRuns
	return sources.map((source) => ({
		sourceId: source.id,
		sourceKey: source.sourceId,
		sourceName: source.name,
		healthStatus: source.healthStatus,
		lastRunAt: source.lastRunAt,
		lastSuccessAt: source.lastSuccessAt,
		lastError: source.lastError,
		successRate: source.successRate,
		totalRuns: (source.successfulRuns ?? 0) + (source.failedRuns ?? 0),
		successfulRuns: source.successfulRuns ?? 0,
		failedRuns: source.failedRuns ?? 0,
		lastOpportunitiesCount: source.lastOpportunitiesCount ?? 0,
		avgRunDurationSeconds: source.avgRunDurationSeconds,
		avgOpportunitiesPerRun: source.avgOpportunitiesPerRun,
		dataQualityScore: source.dataQualityScore,
		valueScore: source.valueScore,
	}));
}

/**
 * Get runs grouped by batch ID
 */
export async function getBatchRuns(
	batchId: string
): Promise<{ batchId: string; runs: ScraperRunWithSource[] }> {
	await requireScraperRunActionSession();
	const runs = await db
		.select()
		.from(scraperRuns)
		.where(eq(scraperRuns.batchId, batchId))
		.orderBy(asc(scraperRuns.startedAt));

	// Get source info
	const sourceIds = [...new Set(runs.map((r) => r.sourceId))];
	const sources = sourceIds.length > 0
		? await db
				.select({
					id: scraperSources.id,
					sourceId: scraperSources.sourceId,
					name: scraperSources.name,
					sourceType: scraperSources.sourceType,
				})
				.from(scraperSources)
				.where(inArray(scraperSources.id, sourceIds))
		: [];

	const sourceMap = new Map(sources.map((s) => [s.id, s]));

	const runsWithSource: ScraperRunWithSource[] = runs.map((run) => ({
		...run,
		source: sourceMap.get(run.sourceId) ?? null,
	}));

	return {
		batchId,
		runs: runsWithSource,
	};
}

/**
 * Get recent runs across all sources
 */
export async function getRecentRuns(
	limit: number = 50
): Promise<ScraperRunWithSource[]> {
	await requireScraperRunActionSession();
	const runs = await db
		.select()
		.from(scraperRuns)
		.orderBy(desc(scraperRuns.startedAt))
		.limit(limit);

	// Get source info
	const sourceIds = [...new Set(runs.map((r) => r.sourceId))];
	const sources = sourceIds.length > 0
		? await db
				.select({
					id: scraperSources.id,
					sourceId: scraperSources.sourceId,
					name: scraperSources.name,
					sourceType: scraperSources.sourceType,
				})
				.from(scraperSources)
				.where(inArray(scraperSources.id, sourceIds))
		: [];

	const sourceMap = new Map(sources.map((s) => [s.id, s]));

	return runs.map((run) => ({
		...run,
		source: sourceMap.get(run.sourceId) ?? null,
	}));
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Update source health after a run completes or fails
 */
async function updateSourceHealthAfterRun(sourceId: string): Promise<void> {
	// Get all runs for this source
	const runs = await db
		.select({
			status: scraperRuns.status,
			opportunitiesFound: scraperRuns.opportunitiesFound,
			durationSeconds: scraperRuns.durationSeconds,
			startedAt: scraperRuns.startedAt,
			completedAt: scraperRuns.completedAt,
		})
		.from(scraperRuns)
		.where(eq(scraperRuns.sourceId, sourceId))
		.orderBy(desc(scraperRuns.startedAt))
		.limit(100);

	if (runs.length === 0) return;

	// Calculate metrics
	const totalRuns = runs.length;
	const successfulRuns = runs.filter(
		(r) => r.status === "success" || r.status === "partial"
	).length;
	const failedRuns = runs.filter(
		(r) => r.status === "failed" || r.status === "timeout"
	).length;

	const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;

	const durations = runs
		.filter((r) => r.durationSeconds !== null)
		.map((r) => r.durationSeconds!);
	const avgRunDurationSeconds =
		durations.length > 0
			? durations.reduce((a, b) => a + b, 0) / durations.length
			: null;

	const opportunities = runs.filter((r) => r.opportunitiesFound > 0);
	const avgOpportunitiesPerRun =
		opportunities.length > 0
			? opportunities.reduce((a, b) => a + b.opportunitiesFound, 0) / opportunities.length
			: null;

	// Determine health status based on recent runs
	const recentFailures = runs.slice(0, 5).filter(
		(r) => r.status === "failed" || r.status === "timeout"
	).length;

	let healthStatus: "healthy" | "degraded" | "failing" | "unknown" | "disabled" = "healthy";
	if (recentFailures >= 3) {
		healthStatus = "failing";
	} else if (recentFailures >= 1) {
		healthStatus = "degraded";
	}

	// Get last success
	const lastSuccess = runs.find(
		(r) => r.status === "success" || r.status === "partial"
	);

	// Get last error
	const lastFailed = runs.find(
		(r) => r.status === "failed" || r.status === "timeout"
	);

	// Update source
	await db
		.update(scraperSources)
		.set({
			healthStatus,
			lastRunAt: runs[0]?.startedAt ?? null,
			lastSuccessAt: lastSuccess?.completedAt ?? null,
			lastError: lastFailed ? `Last run failed with status: ${lastFailed.status}` : null,
			successfulRuns,
			failedRuns,
			successRate,
			avgRunDurationSeconds,
			avgOpportunitiesPerRun,
			updatedAt: new Date(),
		})
		.where(eq(scraperSources.id, sourceId));
}

/**
 * Cancel a pending or running scraper run
 */
export async function cancelScraperRun(id: string): Promise<ScraperRun | null> {
	await requireScraperRunActionSession();
	const [updated] = await db
		.update(scraperRuns)
		.set({
			status: "cancelled",
			completedAt: new Date(),
		})
		.where(
			and(
				eq(scraperRuns.id, id),
				or(
					eq(scraperRuns.status, "pending"),
					eq(scraperRuns.status, "running")
				)
			)
		)
		.returning();

	safeRevalidatePath("/opportunities/sources");
	safeRevalidatePath("/opportunities/runs");

	return updated ?? null;
}

/**
 * Get run counts by source for dashboard
 */
export async function getRunCountsBySource(
	days: number = 7
): Promise<Map<string, { total: number; successful: number; failed: number }>> {
	await requireScraperRunActionSession();
	const since = new Date();
	since.setDate(since.getDate() - days);

	const runs = await db
		.select({
			sourceKey: scraperRuns.sourceKey,
			status: scraperRuns.status,
			count: count(),
		})
		.from(scraperRuns)
		.where(gte(scraperRuns.startedAt, since))
		.groupBy(scraperRuns.sourceKey, scraperRuns.status);

	const result = new Map<string, { total: number; successful: number; failed: number }>();

	for (const run of runs) {
		const existing = result.get(run.sourceKey) ?? { total: 0, successful: 0, failed: 0 };
		existing.total += run.count;
		if (run.status === "success" || run.status === "partial") {
			existing.successful += run.count;
		} else if (run.status === "failed" || run.status === "timeout") {
			existing.failed += run.count;
		}
		result.set(run.sourceKey, existing);
	}

	return result;
}

/**
 * Get run timeline for a specific period
 */
export async function getRunTimeline(
	options?: {
		sourceId?: string;
		startDate?: Date;
		endDate?: Date;
		groupBy?: "day" | "hour";
	}
): Promise<{ date: string; runs: number; opportunities: number; avgDuration: number | null }[]> {
	await requireScraperRunActionSession();
	const startDate = options?.startDate ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
	const endDate = options?.endDate ?? new Date();
	const groupBy = options?.groupBy ?? "day";

	const conditions: ReturnType<typeof eq>[] = [
		gte(scraperRuns.startedAt, startDate),
		lte(scraperRuns.startedAt, endDate),
	];

	if (options?.sourceId) {
		conditions.push(eq(scraperRuns.sourceId, options.sourceId));
	}

	const dateFormat = groupBy === "day" ? "YYYY-MM-DD" : "YYYY-MM-DD HH24";

	const results = await db.execute(sql`
		SELECT
			TO_CHAR(started_at, ${sql.raw(`'${dateFormat}'`)}) as date,
			COUNT(*) as runs,
			SUM(opportunities_found) as opportunities,
			AVG(duration_seconds) as avg_duration
		FROM scraper_runs
		WHERE ${conditions.length > 0 ? sql`(${and(...conditions)})` : sql`TRUE`}
		GROUP BY TO_CHAR(started_at, ${sql.raw(`'${dateFormat}'`)})
		ORDER BY date ASC
	`);

	return results.rows.map((row) => ({
		date: row.date as string,
		runs: Number(row.runs),
		opportunities: Number(row.opportunities ?? 0),
		avgDuration: row.avg_duration ? Number(row.avg_duration) : null,
	}));
}
