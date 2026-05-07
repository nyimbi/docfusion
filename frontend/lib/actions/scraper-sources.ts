/**
 * Scraper Sources Server Actions
 *
 * CRUD operations and metrics for TenderSourceMax scraper sources.
 * Uses PostgreSQL for persistence, tracking, and analytics.
 */

"use server";

import { db } from "@/lib/db";
import {
	scraperSources,
	scraperRuns,
	scraperSchedules,
	type ScraperSource,
	type NewScraperSource,
	type ScraperRun,
	type ScraperSchedule,
} from "@/lib/db/schema";
import { eq, desc, asc, and, gte, lte, sql, count, avg, sum, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/g, "\\$&");
}

function buildSourceSearchCondition(search?: string) {
	const term = search?.trim();
	if (!term) return undefined;

	const pattern = `%${escapeLikePattern(term)}%`;
	return or(
		ilike(scraperSources.name, pattern),
		ilike(scraperSources.sourceId, pattern),
		ilike(scraperSources.url, pattern),
		sql`${scraperSources.coverage}::text ILIKE ${pattern}`,
		sql`${scraperSources.notes} ILIKE ${pattern}`,
	);
}

function safeRevalidatePath(path: string): void {
	try {
		revalidatePath(path);
	} catch {
		// Scraper workers can run outside a Next request/static-generation store.
	}
}

// ============================================================================
// Types
// ============================================================================

export type { ScraperSource, ScraperRun, ScraperSchedule };

export interface ScraperSourceWithRuns extends ScraperSource {
	recentRuns?: ScraperRun[];
}

export interface SourceStats {
	total: number;
	enabled: number;
	healthy: number;
	failing: number;
	byType: Record<string, number>;
	byTier: Record<number, number>;
	totalOpportunities: number;
	avgSuccessRate: number;
}

export interface RunStats {
	totalRuns: number;
	successfulRuns: number;
	failedRuns: number;
	totalOpportunities: number;
	avgDuration: number;
	avgOpportunitiesPerRun: number;
}

// ============================================================================
// Source CRUD Operations
// ============================================================================

export interface PaginatedSources {
	sources: ScraperSourceWithRuns[];
	pagination: {
		page: number;
		pageSize: number;
		total: number;
		totalPages: number;
		hasMore: boolean;
	};
}

/**
 * Get all scraper sources with optional filtering and pagination
 */
export async function getScraperSources(options?: {
	enabled?: boolean;
	sourceType?: string;
	tier?: number;
	healthStatus?: string;
	includeRuns?: boolean;
	limit?: number;
	// Pagination options
	page?: number;
	pageSize?: number;
	search?: string;
}): Promise<ScraperSourceWithRuns[]> {
	const conditions = [];

	if (options?.enabled !== undefined) {
		conditions.push(eq(scraperSources.enabled, options.enabled));
	}
	if (options?.sourceType) {
		conditions.push(eq(scraperSources.sourceType, options.sourceType as typeof scraperSources.sourceType.enumValues[number]));
	}
	if (options?.tier) {
		conditions.push(eq(scraperSources.scheduleTier, options.tier));
	}
	if (options?.healthStatus) {
		conditions.push(eq(scraperSources.healthStatus, options.healthStatus as typeof scraperSources.healthStatus.enumValues[number]));
	}
	const searchCondition = buildSourceSearchCondition(options?.search);
	if (searchCondition) {
		conditions.push(searchCondition);
	}

	const query = db
		.select()
		.from(scraperSources)
		.orderBy(asc(scraperSources.priority), asc(scraperSources.scheduleTier), asc(scraperSources.name));

	if (conditions.length > 0) {
		query.where(and(...conditions));
	}

	if (options?.limit) {
		query.limit(options.limit);
	}

	const sources = await query;

	// Optionally include recent runs
	if (options?.includeRuns) {
		const sourcesWithRuns: ScraperSourceWithRuns[] = [];
		for (const source of sources) {
			const runs = await db
				.select()
				.from(scraperRuns)
				.where(eq(scraperRuns.sourceId, source.id))
				.orderBy(desc(scraperRuns.startedAt))
				.limit(5);

			sourcesWithRuns.push({ ...source, recentRuns: runs });
		}
		return sourcesWithRuns;
	}

	return sources;
}

/**
 * Get paginated scraper sources with filtering
 */
export async function getPaginatedScraperSources(options: {
	page: number;
	pageSize: number;
	enabled?: boolean;
	sourceType?: string;
	tier?: number;
	healthStatus?: string;
	search?: string;
}): Promise<PaginatedSources> {
	const { page, pageSize, search, ...filters } = options;
	const offset = (page - 1) * pageSize;

	// Build conditions
	const conditions = [];

	if (filters.enabled !== undefined) {
		conditions.push(eq(scraperSources.enabled, filters.enabled));
	}
	if (filters.sourceType) {
		conditions.push(eq(scraperSources.sourceType, filters.sourceType as typeof scraperSources.sourceType.enumValues[number]));
	}
	if (filters.tier) {
		conditions.push(eq(scraperSources.scheduleTier, filters.tier));
	}
	if (filters.healthStatus) {
		conditions.push(eq(scraperSources.healthStatus, filters.healthStatus as typeof scraperSources.healthStatus.enumValues[number]));
	}
	const searchCondition = buildSourceSearchCondition(search);
	if (searchCondition) {
		conditions.push(searchCondition);
	}

	// Get total count
	const countResult = await db
		.select({ count: count() })
		.from(scraperSources)
		.where(conditions.length > 0 ? and(...conditions) : undefined);

	const total = countResult[0]?.count ?? 0;

	// Get paginated results
	const sources = await db
		.select()
		.from(scraperSources)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(asc(scraperSources.priority), asc(scraperSources.scheduleTier), asc(scraperSources.name))
		.limit(pageSize)
		.offset(offset);

	const totalPages = Math.ceil(total / pageSize);

	return {
		sources,
		pagination: {
			page,
			pageSize,
			total,
			totalPages,
			hasMore: page < totalPages,
		},
	};
}

/**
 * Get a single scraper source by ID or sourceId
 */
export async function getScraperSource(
	idOrSourceId: string
): Promise<ScraperSourceWithRuns | null> {
	// Try by UUID first
	let source = await db.query.scraperSources.findFirst({
		where: eq(scraperSources.id, idOrSourceId),
	});

	// Try by sourceId if not found
	if (!source) {
		source = await db.query.scraperSources.findFirst({
			where: eq(scraperSources.sourceId, idOrSourceId),
		});
	}

	if (!source) return null;

	// Get recent runs
	const runs = await db
		.select()
		.from(scraperRuns)
		.where(eq(scraperRuns.sourceId, source.id))
		.orderBy(desc(scraperRuns.startedAt))
		.limit(10);

	return { ...source, recentRuns: runs };
}

/**
 * Create a new scraper source
 */
export async function createScraperSource(
	data: Omit<NewScraperSource, "id" | "createdAt" | "updatedAt">
): Promise<ScraperSource> {
	const [source] = await db
		.insert(scraperSources)
		.values({
			...data,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning();

	safeRevalidatePath("/opportunities/sources");
	return source;
}

/**
 * Update a scraper source
 */
export async function updateScraperSource(
	id: string,
	data: Partial<NewScraperSource>
): Promise<ScraperSource | null> {
	const [updated] = await db
		.update(scraperSources)
		.set({
			...data,
			updatedAt: new Date(),
		})
		.where(eq(scraperSources.id, id))
		.returning();

	safeRevalidatePath("/opportunities/sources");
	return updated || null;
}

/**
 * Toggle source enabled status
 */
export async function toggleSourceEnabled(
	id: string,
	enabled: boolean
): Promise<{ success: boolean; source?: ScraperSource; error?: string }> {
	try {
		const [source] = await db
			.update(scraperSources)
			.set({
				enabled,
				healthStatus: enabled ? "unknown" : "disabled",
				updatedAt: new Date(),
			})
			.where(eq(scraperSources.id, id))
			.returning();

		safeRevalidatePath("/opportunities/sources");
		return { success: true, source };
	} catch (error) {
		return { success: false, error: String(error) };
	}
}

/**
 * Delete a scraper source
 */
export async function deleteScraperSource(id: string): Promise<boolean> {
	const result = await db
		.delete(scraperSources)
		.where(eq(scraperSources.id, id));

	safeRevalidatePath("/opportunities/sources");
	return true;
}

// ============================================================================
// Source Metrics & Stats
// ============================================================================

/**
 * Get aggregated statistics for all sources
 */
export async function getSourcesStats(): Promise<SourceStats> {
	const sources = await db.select().from(scraperSources);

	const stats: SourceStats = {
		total: sources.length,
		enabled: 0,
		healthy: 0,
		failing: 0,
		byType: {},
		byTier: { 1: 0, 2: 0, 3: 0 },
		totalOpportunities: 0,
		avgSuccessRate: 0,
	};

	let successRateSum = 0;
	let successRateCount = 0;

	for (const source of sources) {
		if (source.enabled) stats.enabled++;
		if (source.healthStatus === "healthy") stats.healthy++;
		if (source.healthStatus === "failing") stats.failing++;

		stats.byType[source.sourceType] = (stats.byType[source.sourceType] || 0) + 1;
		stats.byTier[source.scheduleTier] = (stats.byTier[source.scheduleTier] || 0) + 1;
		stats.totalOpportunities += source.totalOpportunitiesScraped || 0;

		if (source.successRate !== null) {
			successRateSum += source.successRate;
			successRateCount++;
		}
	}

	stats.avgSuccessRate = successRateCount > 0 ? successRateSum / successRateCount : 0;

	return stats;
}

/**
 * Update source metrics after a run
 */
export async function updateSourceMetrics(
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

	// Calculate running average for duration
	const prevAvgDuration = source.avgRunDurationSeconds || runResult.durationSeconds;
	const newAvgDuration =
		((prevAvgDuration * (totalRuns - 1)) + runResult.durationSeconds) / totalRuns;

	// Calculate running average for opportunities per run
	const prevAvgOpps = source.avgOpportunitiesPerRun || runResult.opportunitiesFound;
	const newAvgOpps =
		((prevAvgOpps * (newSuccessfulRuns - 1)) + runResult.opportunitiesFound) /
		Math.max(newSuccessfulRuns, 1);

	// Determine health status
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

	safeRevalidatePath("/opportunities/sources");
}

// ============================================================================
// Run History
// ============================================================================

/**
 * Record a new scraper run
 */
export async function createScraperRun(
	data: Omit<typeof scraperRuns.$inferInsert, "id">
): Promise<ScraperRun> {
	const [run] = await db.insert(scraperRuns).values(data).returning();
	return run;
}

/**
 * Update a scraper run
 */
export async function updateScraperRun(
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

/**
 * Get runs for a source
 */
export async function getSourceRuns(
	sourceId: string,
	options?: { limit?: number; status?: string }
): Promise<ScraperRun[]> {
	const conditions = [eq(scraperRuns.sourceId, sourceId)];

	if (options?.status) {
		conditions.push(eq(scraperRuns.status, options.status as typeof scraperRuns.status.enumValues[number]));
	}

	return db
		.select()
		.from(scraperRuns)
		.where(and(...conditions))
		.orderBy(desc(scraperRuns.startedAt))
		.limit(options?.limit || 50);
}

/**
 * Get run statistics for a time period
 */
export async function getRunStats(
	sourceId?: string,
	days: number = 7
): Promise<RunStats> {
	const since = new Date();
	since.setDate(since.getDate() - days);

	const conditions = [gte(scraperRuns.startedAt, since)];
	if (sourceId) {
		conditions.push(eq(scraperRuns.sourceId, sourceId));
	}

	const runs = await db
		.select()
		.from(scraperRuns)
		.where(and(...conditions));

	const stats: RunStats = {
		totalRuns: runs.length,
		successfulRuns: 0,
		failedRuns: 0,
		totalOpportunities: 0,
		avgDuration: 0,
		avgOpportunitiesPerRun: 0,
	};

	let totalDuration = 0;

	for (const run of runs) {
		if (run.status === "success" || run.status === "partial") {
			stats.successfulRuns++;
		} else if (run.status === "failed") {
			stats.failedRuns++;
		}

		stats.totalOpportunities += run.opportunitiesFound || 0;
		totalDuration += run.durationSeconds || 0;
	}

	if (runs.length > 0) {
		stats.avgDuration = totalDuration / runs.length;
		stats.avgOpportunitiesPerRun = stats.totalOpportunities / Math.max(stats.successfulRuns, 1);
	}

	return stats;
}

// ============================================================================
// Schedules
// ============================================================================

/**
 * Get all schedule tiers
 */
export async function getScheduleTiers(): Promise<ScraperSchedule[]> {
	return db
		.select()
		.from(scraperSchedules)
		.orderBy(asc(scraperSchedules.name));
}

/**
 * Get sources for a schedule tier
 */
export async function getSourcesForTier(tier: number): Promise<ScraperSource[]> {
	return db
		.select()
		.from(scraperSources)
		.where(and(
			eq(scraperSources.scheduleTier, tier),
			eq(scraperSources.enabled, true)
		))
		.orderBy(asc(scraperSources.priority));
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Bulk create sources (for seeding from YAML)
 */
export async function bulkCreateSources(
	sources: Omit<NewScraperSource, "id" | "createdAt" | "updatedAt">[]
): Promise<ScraperSource[]> {
	if (sources.length === 0) return [];

	const now = new Date();
	const values = sources.map((s) => ({
		...s,
		createdAt: now,
		updatedAt: now,
	}));

	const created = await db
		.insert(scraperSources)
		.values(values)
		.onConflictDoUpdate({
			target: scraperSources.sourceId,
			set: {
				name: sql`EXCLUDED.name`,
				url: sql`EXCLUDED.url`,
				sourceType: sql`EXCLUDED.source_type`,
				coverage: sql`EXCLUDED.coverage`,
				scraperClass: sql`EXCLUDED.scraper_class`,
				rateLimit: sql`EXCLUDED.rate_limit`,
				timeout: sql`EXCLUDED.timeout`,
				maxPages: sql`EXCLUDED.max_pages`,
				requiresJavascript: sql`EXCLUDED.requires_javascript`,
				requiresAuth: sql`EXCLUDED.requires_auth`,
				scheduleTier: sql`EXCLUDED.schedule_tier`,
				priority: sql`EXCLUDED.priority`,
				notes: sql`EXCLUDED.notes`,
				updatedAt: now,
			},
		})
		.returning();

	safeRevalidatePath("/opportunities/sources");
	return created;
}

/**
 * Bulk create schedule tiers
 */
export async function bulkCreateSchedules(
	schedules: Omit<typeof scraperSchedules.$inferInsert, "id" | "createdAt" | "updatedAt">[]
): Promise<ScraperSchedule[]> {
	if (schedules.length === 0) return [];

	const now = new Date();
	const values = schedules.map((s) => ({
		...s,
		createdAt: now,
		updatedAt: now,
	}));

	const created = await db
		.insert(scraperSchedules)
		.values(values)
		.onConflictDoUpdate({
			target: scraperSchedules.name,
			set: {
				label: sql`EXCLUDED.label`,
				cronExpression: sql`EXCLUDED.cron_expression`,
				description: sql`EXCLUDED.description`,
				maxConcurrent: sql`EXCLUDED.max_concurrent`,
				timeoutMinutes: sql`EXCLUDED.timeout_minutes`,
				enabled: sql`EXCLUDED.enabled`,
				updatedAt: now,
			},
		})
		.returning();

	return created;
}
