/**
 * Opportunity Server Actions - DocFusion
 *
 * Server-side actions for managing RFP/EOI/Tender opportunities.
 * Includes CRUD operations, filtering, sorting, and analytics.
 */

"use server";

import { db } from "@/lib/db";
import { opportunities, opportunityImports, savedSearches } from "@/lib/db/schema";
import { eq, and, or, gte, lte, inArray, isNull, desc, asc, sql, count } from "drizzle-orm";

import { buildOpportunityConditions } from "./opportunity-filters";
import type {
	Opportunity,
	OpportunityInput,
	OpportunityListItem,
	OpportunityFilters,
	OpportunitySort,
	PaginationOptions,
	PaginatedResponse,
	OpportunityStats,
	DecisionStatus,
	PriorityRank,
	OpportunityImport,
} from "@/lib/types/opportunity";

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get all opportunities with optional filters, sorting, and pagination.
 */
export async function getOpportunities(
	filters?: OpportunityFilters,
	sort?: OpportunitySort,
	pagination?: PaginationOptions
): Promise<PaginatedResponse<OpportunityListItem>> {
	const page = pagination?.page ?? 1;
	const pageSize = pagination?.pageSize ?? 25;
	const offset = (page - 1) * pageSize;

	// Build WHERE conditions using shared filter builder
	const conditions = buildOpportunityConditions(filters);

	// Build ORDER BY
	const sortField = sort?.field ?? "deadline";
	const sortDir = sort?.direction ?? "asc";

	const orderByColumn = {
		deadline: opportunities.deadline,
		priorityRank: opportunities.priorityRank,
		fitScore: opportunities.fitScore,
		budgetNumeric: opportunities.budgetNumeric,
		title: opportunities.title,
		organization: opportunities.organization,
		category: opportunities.category,
		countryRegion: opportunities.countryRegion,
		createdAt: opportunities.createdAt,
		updatedAt: opportunities.updatedAt,
	}[sortField];

	const orderBy = sortDir === "asc" ? asc(orderByColumn) : desc(orderByColumn);

	// Execute queries
	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const [rows, totalResult] = await Promise.all([
		db
			.select({
				id: opportunities.id,
				sourceId: opportunities.sourceId,
				title: opportunities.title,
				category: opportunities.category,
				countryRegion: opportunities.countryRegion,
				organization: opportunities.organization,
				deadline: opportunities.deadline,
				daysLeft: opportunities.daysLeft,
				isExpired: opportunities.isExpired,
				budgetValue: opportunities.budgetValue,
				priorityRank: opportunities.priorityRank,
				fitScore: opportunities.fitScore,
				decisionStatus: opportunities.decisionStatus,
				assignedTo: opportunities.assignedTo,
				tags: opportunities.tags,
				rfpLink: opportunities.rfpLink,
			})
			.from(opportunities)
			.where(whereClause)
			.orderBy(orderBy)
			.limit(pageSize)
			.offset(offset),
		db
			.select({ count: count() })
			.from(opportunities)
			.where(whereClause),
	]);

	const total = totalResult[0]?.count ?? 0;
	const now = new Date();

	return {
		data: rows.map((row) => {
			// Compute daysLeft and isExpired dynamically based on current date
			const deadline = row.deadline ? new Date(row.deadline) : null;
			const daysLeft = deadline
				? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
				: null;
			const isExpired = deadline ? deadline < now : false;

			return {
				...row,
				daysLeft,
				isExpired,
				tags: (row.tags as string[]) ?? [],
				priorityRank: (row.priorityRank ?? 3) as PriorityRank,
				decisionStatus: (row.decisionStatus ?? "pending") as DecisionStatus,
			};
		}),
		total,
		page,
		pageSize,
		totalPages: Math.ceil(total / pageSize),
	};
}

/**
 * Get a single opportunity by ID.
 */
export async function getOpportunity(id: string): Promise<Opportunity | null> {
	const [row] = await db
		.select()
		.from(opportunities)
		.where(eq(opportunities.id, id))
		.limit(1);

	if (!row) return null;

	return {
		...row,
		tags: (row.tags as string[]) ?? [],
		metadata: row.metadata as Record<string, unknown> | null,
		priorityRank: (row.priorityRank ?? 3) as PriorityRank,
		decisionStatus: (row.decisionStatus ?? "pending") as DecisionStatus,
		opportunityType: (row.opportunityType ?? "rfp") as Opportunity["opportunityType"],
		revenuePotential: row.revenuePotential as Opportunity["revenuePotential"],
	} as Opportunity;
}

/**
 * Create a new opportunity.
 */
export async function createOpportunity(input: OpportunityInput): Promise<Opportunity> {
	const now = new Date();
	const deadline = input.deadline ? new Date(input.deadline) : null;
	const daysLeft = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
	const isExpired = deadline ? deadline < now : false;

	const [row] = await db
		.insert(opportunities)
		.values({
			sourceId: input.sourceId,
			title: input.title,
			category: input.category,
			itCategory: input.itCategory,
			sector: input.sector,
			countryRegion: input.countryRegion,
			organization: input.organization,
			funder: input.funder,
			deadline,
			daysLeft,
			isExpired,
			budgetValue: input.budgetValue,
			budgetNumeric: input.budgetNumeric,
			budgetCurrency: input.budgetCurrency,
			projectSummary: input.projectSummary,
			projectScope: input.projectScope,
			keyRequirements: input.keyRequirements,
			technicalRequirements: input.technicalRequirements,
			submissionMethod: input.submissionMethod,
			submissionRequirements: input.submissionRequirements,
			rfpLink: input.rfpLink,
			sourcePlatform: input.sourcePlatform,
			sourceFile: input.sourceFile,
			opportunityType: input.opportunityType ?? "rfp",
			priorityRank: input.priorityRank ?? 3,
			fitScore: input.fitScore,
			winProbability: input.winProbability,
			revenuePotential: input.revenuePotential,
			strategicNotes: input.strategicNotes,
			decisionStatus: input.decisionStatus ?? "pending",
			decisionReason: input.decisionReason,
			assignedTo: input.assignedTo,
			isReviewed: input.isReviewed ?? false,
			tags: input.tags ?? [],
			metadata: input.metadata,
			// searchVector is auto-populated by PostgreSQL trigger
		})
		.returning();

	return {
		...row,
		tags: (row.tags as string[]) ?? [],
		metadata: row.metadata as Record<string, unknown> | null,
		priorityRank: (row.priorityRank ?? 3) as PriorityRank,
		decisionStatus: (row.decisionStatus ?? "pending") as DecisionStatus,
		opportunityType: (row.opportunityType ?? "rfp") as Opportunity["opportunityType"],
		revenuePotential: row.revenuePotential as Opportunity["revenuePotential"],
	} as Opportunity;
}

/**
 * Update an existing opportunity.
 */
export async function updateOpportunity(id: string, input: Partial<OpportunityInput>): Promise<Opportunity> {
	const now = new Date();
	let updateData: Record<string, unknown> = { ...input, updatedAt: now };

	// Recalculate deadline-related fields if deadline changes
	if (input.deadline !== undefined) {
		const deadline = input.deadline ? new Date(input.deadline) : null;
		const daysLeft = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
		const isExpired = deadline ? deadline < now : false;
		updateData = { ...updateData, deadline, daysLeft, isExpired };
	}

	// searchVector is auto-populated by PostgreSQL trigger on update

	const [row] = await db
		.update(opportunities)
		.set(updateData)
		.where(eq(opportunities.id, id))
		.returning();

	if (!row) {
		throw new Error(`Opportunity not found: ${id}`);
	}

	return {
		...row,
		tags: (row.tags as string[]) ?? [],
		metadata: row.metadata as Record<string, unknown> | null,
		priorityRank: (row.priorityRank ?? 3) as PriorityRank,
		decisionStatus: (row.decisionStatus ?? "pending") as DecisionStatus,
		opportunityType: (row.opportunityType ?? "rfp") as Opportunity["opportunityType"],
		revenuePotential: row.revenuePotential as Opportunity["revenuePotential"],
	} as Opportunity;
}

/**
 * Delete an opportunity.
 */
export async function deleteOpportunity(id: string): Promise<void> {
	await db.delete(opportunities).where(eq(opportunities.id, id));
}

/**
 * Bulk update opportunity status.
 */
export async function bulkUpdateStatus(
	ids: string[],
	status: DecisionStatus,
	reason?: string
): Promise<number> {
	const result = await db
		.update(opportunities)
		.set({
			decisionStatus: status,
			decisionReason: reason,
			updatedAt: new Date(),
		})
		.where(inArray(opportunities.id, ids));

	return result.rowCount ?? 0;
}

/**
 * Bulk update priority rank.
 */
export async function bulkUpdatePriority(ids: string[], priority: PriorityRank): Promise<number> {
	const result = await db
		.update(opportunities)
		.set({
			priorityRank: priority,
			updatedAt: new Date(),
		})
		.where(inArray(opportunities.id, ids));

	return result.rowCount ?? 0;
}

/**
 * Mark opportunities as reviewed.
 */
export async function markAsReviewed(ids: string[], reviewed: boolean = true): Promise<number> {
	const result = await db
		.update(opportunities)
		.set({
			isReviewed: reviewed,
			updatedAt: new Date(),
		})
		.where(inArray(opportunities.id, ids));

	return result.rowCount ?? 0;
}

/**
 * Assign opportunities to a user.
 */
export async function assignOpportunities(ids: string[], assignedTo: string | null): Promise<number> {
	const result = await db
		.update(opportunities)
		.set({
			assignedTo,
			updatedAt: new Date(),
		})
		.where(inArray(opportunities.id, ids));

	return result.rowCount ?? 0;
}

// ============================================================================
// Analytics & Statistics
// ============================================================================

/**
 * Get opportunity statistics.
 *
 * Optimized to use only 2 parallel database round-trips instead of 8 sequential:
 * - Batch 1: Single aggregate query combining total, active, expired, value, avg fit
 * - Batch 2: Parallel groupBy queries for status, priority, category, country, deadlines
 */
export async function getOpportunityStats(filters?: OpportunityFilters): Promise<OpportunityStats> {
	const conditions = buildOpportunityConditions(filters);
	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const now = new Date();
	const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

	// Batch 1: Single query for all scalar aggregates (total, active, expired, value, avgFit)
	// Batch 2: Parallel groupBy queries for dimensional breakdowns
	const [
		[aggregates],
		statusCounts,
		priorityCounts,
		categoryCounts,
		countryCounts,
		upcomingDeadlines,
	] = await Promise.all([
		// Combined scalar aggregates -- one table scan instead of five
		db
			.select({
				total: count(),
				expired: sql<number>`COUNT(*) FILTER (WHERE ${opportunities.deadline} IS NOT NULL AND ${opportunities.deadline} <= ${today})`,
				active: sql<number>`COUNT(*) FILTER (WHERE ${opportunities.deadline} IS NULL OR ${opportunities.deadline} >= ${today})`,
				totalValue: sql<number>`COALESCE(SUM(${opportunities.budgetNumeric}), 0)`,
				avgFit: sql<number | null>`AVG(${opportunities.fitScore})`,
			})
			.from(opportunities)
			.where(whereClause),

		// Status breakdown
		db
			.select({
				status: opportunities.decisionStatus,
				count: count(),
			})
			.from(opportunities)
			.where(whereClause)
			.groupBy(opportunities.decisionStatus),

		// Priority breakdown
		db
			.select({
				priority: opportunities.priorityRank,
				count: count(),
			})
			.from(opportunities)
			.where(whereClause)
			.groupBy(opportunities.priorityRank),

		// Top 10 categories
		db
			.select({
				category: opportunities.category,
				count: count(),
			})
			.from(opportunities)
			.where(and(whereClause, sql`${opportunities.category} IS NOT NULL`))
			.groupBy(opportunities.category)
			.orderBy(desc(count()))
			.limit(10),

		// Top 10 countries
		db
			.select({
				country: opportunities.countryRegion,
				count: count(),
			})
			.from(opportunities)
			.where(and(whereClause, sql`${opportunities.countryRegion} IS NOT NULL`))
			.groupBy(opportunities.countryRegion)
			.orderBy(desc(count()))
			.limit(10),

		// Upcoming deadlines (next 30 days)
		db
			.select({
				date: opportunities.deadline,
				count: count(),
			})
			.from(opportunities)
			.where(
				and(
					whereClause,
					gte(opportunities.deadline, now),
					lte(opportunities.deadline, thirtyDaysFromNow),
					eq(opportunities.isExpired, false)
				)
			)
			.groupBy(opportunities.deadline)
			.orderBy(asc(opportunities.deadline))
			.limit(30),
	]);

	// Build status map
	const byStatus: Record<DecisionStatus, number> = {
		pending: 0,
		interested: 0,
		shortlisted: 0,
		pursuing: 0,
		submitted: 0,
		won: 0,
		lost: 0,
		declined: 0,
		expired: 0,
	};
	for (const row of statusCounts) {
		if (row.status && row.status in byStatus) {
			byStatus[row.status as DecisionStatus] = row.count;
		}
	}

	// Build priority map
	const byPriority: Record<PriorityRank, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
	for (const row of priorityCounts) {
		if (row.priority !== null && row.priority >= 1 && row.priority <= 5) {
			byPriority[row.priority as PriorityRank] = row.count;
		}
	}

	return {
		total: aggregates?.total ?? 0,
		byStatus,
		byPriority,
		byCategory: categoryCounts
			.filter((r) => r.category)
			.map((r) => ({ category: r.category!, count: r.count })),
		byCountry: countryCounts
			.filter((r) => r.country)
			.map((r) => ({ country: r.country!, count: r.count })),
		expiredCount: aggregates?.expired ?? 0,
		activeCount: aggregates?.active ?? 0,
		upcomingDeadlines: upcomingDeadlines
			.filter((r) => r.date)
			.map((r) => ({ date: r.date!, count: r.count })),
		totalEstimatedValue: aggregates?.totalValue ?? 0,
		averageFitScore: aggregates?.avgFit ?? null,
	};
}

/**
 * Get unique values for filter options.
 */
export async function getFilterOptions(): Promise<{
	categories: string[];
	sectors: string[];
	countries: string[];
	organizations: string[];
	sourceFiles: string[];
}> {
	const [categories, sectors, countries, organizations, sourceFiles] = await Promise.all([
		db
			.selectDistinct({ value: opportunities.category })
			.from(opportunities)
			.where(sql`${opportunities.category} IS NOT NULL`)
			.orderBy(asc(opportunities.category)),
		db
			.selectDistinct({ value: opportunities.sector })
			.from(opportunities)
			.where(sql`${opportunities.sector} IS NOT NULL`)
			.orderBy(asc(opportunities.sector)),
		db
			.selectDistinct({ value: opportunities.countryRegion })
			.from(opportunities)
			.where(sql`${opportunities.countryRegion} IS NOT NULL`)
			.orderBy(asc(opportunities.countryRegion)),
		db
			.selectDistinct({ value: opportunities.organization })
			.from(opportunities)
			.where(sql`${opportunities.organization} IS NOT NULL`)
			.orderBy(asc(opportunities.organization)),
		db
			.selectDistinct({ value: opportunities.sourceFile })
			.from(opportunities)
			.where(sql`${opportunities.sourceFile} IS NOT NULL`)
			.orderBy(asc(opportunities.sourceFile)),
	]);

	return {
		categories: categories.map((r) => r.value!).filter(Boolean),
		sectors: sectors.map((r) => r.value!).filter(Boolean),
		countries: countries.map((r) => r.value!).filter(Boolean),
		organizations: organizations.map((r) => r.value!).filter(Boolean),
		sourceFiles: sourceFiles.map((r) => r.value!).filter(Boolean),
	};
}

// ============================================================================
// Import Operations
// ============================================================================

/**
 * Get import history.
 */
export async function getImportHistory(limit: number = 20): Promise<OpportunityImport[]> {
	const rows = await db
		.select()
		.from(opportunityImports)
		.orderBy(desc(opportunityImports.startedAt))
		.limit(limit);

	return rows.map((row) => ({
		...row,
		errors: (row.errors as OpportunityImport["errors"]) ?? [],
		config: row.config as OpportunityImport["config"],
		status: row.status as OpportunityImport["status"],
	}));
}

/**
 * Create an import record.
 */
export async function createImportRecord(
	filename: string,
	totalRecords: number,
	config?: OpportunityImport["config"]
): Promise<string> {
	const [row] = await db
		.insert(opportunityImports)
		.values({
			filename,
			totalRecords,
			status: "processing",
			config,
		})
		.returning({ id: opportunityImports.id });

	return row.id;
}

/**
 * Update import record with results.
 */
export async function updateImportRecord(
	id: string,
	results: {
		importedRecords: number;
		updatedRecords: number;
		skippedRecords: number;
		failedRecords: number;
		status: OpportunityImport["status"];
		errors?: OpportunityImport["errors"];
	}
): Promise<void> {
	await db
		.update(opportunityImports)
		.set({
			...results,
			completedAt: new Date(),
		})
		.where(eq(opportunityImports.id, id));
}

/**
 * Refresh days left and expired status for all opportunities.
 * Should be run periodically (e.g., daily cron job).
 */
export async function refreshDeadlineStatus(): Promise<number> {
	const now = new Date();

	// Update all opportunities with deadlines
	const result = await db.execute(sql`
		UPDATE opportunities
		SET
			days_left = CASE
				WHEN deadline IS NOT NULL THEN
					CEIL(EXTRACT(EPOCH FROM (deadline - NOW())) / 86400)
				ELSE NULL
			END,
			is_expired = CASE
				WHEN deadline IS NOT NULL AND deadline < NOW() THEN TRUE
				ELSE FALSE
			END,
			updated_at = NOW()
		WHERE deadline IS NOT NULL
	`);

	return (result as { rowCount?: number }).rowCount ?? 0;
}

// ============================================================================
// Full-Text Search
// ============================================================================

/**
 * Search opportunities using PostgreSQL full-text search with relevance ranking.
 * Returns results ranked by search relevance score.
 */
export async function searchOpportunities(
	query: string,
	filters?: OpportunityFilters,
	sort?: OpportunitySort,
	pagination?: PaginationOptions
): Promise<PaginatedResponse<OpportunityListItem & { searchRank?: number }>> {
	const page = pagination?.page ?? 1;
	const pageSize = pagination?.pageSize ?? 25;
	const offset = (page - 1) * pageSize;

	// Build tsquery from search text
	const tsquery = sql`plainto_tsquery('english', ${query})`;

	// Build WHERE conditions: full-text search + shared filters
	const filterConditions = buildOpportunityConditions(filters);
	const conditions: ReturnType<typeof eq>[] = [
		sql`${opportunities.searchVector} @@ ${tsquery}`,
		...filterConditions,
	];

	const whereClause = and(...conditions);

	// Build ORDER BY with search rank
	const sortField = sort?.field ?? "relevance";
	const sortDir = sort?.direction ?? "desc";

	let orderBy;
	if (sortField === "relevance") {
		orderBy = sortDir === "desc"
			? desc(sql`ts_rank_cd(${opportunities.searchVector}, ${tsquery})`)
			: asc(sql`ts_rank_cd(${opportunities.searchVector}, ${tsquery})`);
	} else {
		const column = {
			deadline: opportunities.deadline,
			priorityRank: opportunities.priorityRank,
			fitScore: opportunities.fitScore,
			budgetNumeric: opportunities.budgetNumeric,
			title: opportunities.title,
			organization: opportunities.organization,
			category: opportunities.category,
			countryRegion: opportunities.countryRegion,
			createdAt: opportunities.createdAt,
			updatedAt: opportunities.updatedAt,
		}[sortField] ?? opportunities.deadline;
		orderBy = sortDir === "desc" ? desc(column) : asc(column);
	}

	// Execute queries
	const [rows, totalResult] = await Promise.all([
		db
			.select({
				id: opportunities.id,
				sourceId: opportunities.sourceId,
				title: opportunities.title,
				category: opportunities.category,
				countryRegion: opportunities.countryRegion,
				organization: opportunities.organization,
				deadline: opportunities.deadline,
				daysLeft: opportunities.daysLeft,
				isExpired: opportunities.isExpired,
				budgetValue: opportunities.budgetValue,
				priorityRank: opportunities.priorityRank,
				fitScore: opportunities.fitScore,
				decisionStatus: opportunities.decisionStatus,
				assignedTo: opportunities.assignedTo,
				tags: opportunities.tags,
				rfpLink: opportunities.rfpLink,
				searchRank: sql<number>`ts_rank_cd(${opportunities.searchVector}, ${tsquery})`,
			})
			.from(opportunities)
			.where(whereClause)
			.orderBy(orderBy)
			.limit(pageSize)
			.offset(offset),
		db
			.select({ count: count() })
			.from(opportunities)
			.where(whereClause),
	]);

	const total = totalResult[0]?.count ?? 0;
	const now = new Date();

	return {
		data: rows.map((row) => ({
			...row,
			daysLeft: row.deadline
				? Math.ceil((new Date(row.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
				: null,
			isExpired: row.deadline ? new Date(row.deadline) < now : false,
			tags: (row.tags as string[]) ?? [],
			priorityRank: (row.priorityRank ?? 3) as PriorityRank,
			decisionStatus: (row.decisionStatus ?? "pending") as DecisionStatus,
			searchRank: row.searchRank,
		})),
		total,
		page,
		pageSize,
		totalPages: Math.ceil(total / pageSize),
	};
}

/**
 * Get search suggestions for autocomplete.
 * Returns matching terms from existing opportunities.
 */
export async function getSearchSuggestions(
	prefix: string,
	limit: number = 10
): Promise<string[]> {
	if (!prefix || prefix.length < 2) {
		return [];
	}

	// Use trigram similarity for suggestions
	const results = await db.execute(sql`
		SELECT DISTINCT word
		FROM ts_stat(${
			sql`SELECT to_tsvector('english', title || ' ' || COALESCE(organization, '') || ' ' || COALESCE(category, '')) FROM opportunities`
		})
		WHERE word ILIKE ${prefix + '%'}
		ORDER BY word
		LIMIT ${limit}
	`);

	return (results.rows as { word: string }[]).map((row) => row.word);
}

/**
 * Refresh search vectors for all opportunities.
 * Should be called after bulk imports or updates.
 */
export async function refreshSearchVectors(): Promise<number> {
	const result = await db.execute(sql`
		UPDATE opportunities
		SET search_vector =
			setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
			setweight(to_tsvector('english', COALESCE(organization, '')), 'B') ||
			setweight(to_tsvector('english', COALESCE(project_summary, '')), 'C') ||
			setweight(to_tsvector('english', COALESCE(key_requirements, '')), 'C') ||
			setweight(to_tsvector('english', COALESCE(country_region, '')), 'D') ||
			setweight(to_tsvector('english', COALESCE(category, '')), 'D') ||
			setweight(to_tsvector('english', COALESCE(sector, '')), 'D')
		WHERE search_vector IS NULL OR search_vector = ''
	`);

	return (result as { rowCount?: number }).rowCount ?? 0;
}

// ============================================================================
// Facet Counts for Filters
// ============================================================================

/**
 * Filter option with count for faceted search.
 */
export interface FilterOptionWithCount {
	value: string;
	count: number;
}

/**
 * Facet counts for all filter options.
 * Returns counts respecting current filters (excludes the filter being calculated).
 */
export async function getFilterOptionsWithCounts(
	filters?: OpportunityFilters
): Promise<{
	categories: FilterOptionWithCount[];
	sectors: FilterOptionWithCount[];
	countries: FilterOptionWithCount[];
	organizations: FilterOptionWithCount[];
	sourceFiles: FilterOptionWithCount[];
	statuses: FilterOptionWithCount[];
	priorityRanks: FilterOptionWithCount[];
}> {
	// Build base conditions using shared filter builder with excludeFilter support
	const buildConditions = (excludeFilter?: string): ReturnType<typeof eq>[] => {
		return buildOpportunityConditions(filters, {
			excludeFilter: excludeFilter as import("./opportunity-filters").ExcludableFilter | undefined,
		});
	};

	// Get counts for each category
	const [categories, sectors, countries, organizations, sourceFiles, statuses, priorityRanks] =
		await Promise.all([
			// Categories with counts
			db
				.select({
					value: opportunities.category,
					count: count(),
				})
				.from(opportunities)
				.where(and(...buildConditions("categories"), sql`${opportunities.category} IS NOT NULL`))
				.groupBy(opportunities.category)
				.orderBy(desc(count())),

			// Sectors with counts
			db
				.select({
					value: opportunities.sector,
					count: count(),
				})
				.from(opportunities)
				.where(and(...buildConditions("sectors"), sql`${opportunities.sector} IS NOT NULL`))
				.groupBy(opportunities.sector)
				.orderBy(desc(count())),

			// Countries with counts
			db
				.select({
					value: opportunities.countryRegion,
					count: count(),
				})
				.from(opportunities)
				.where(and(...buildConditions("countries"), sql`${opportunities.countryRegion} IS NOT NULL`))
				.groupBy(opportunities.countryRegion)
				.orderBy(desc(count())),

			// Organizations with counts
			db
				.select({
					value: opportunities.organization,
					count: count(),
				})
				.from(opportunities)
				.where(and(...buildConditions("organizations"), sql`${opportunities.organization} IS NOT NULL`))
				.groupBy(opportunities.organization)
				.orderBy(desc(count())),

			// Source files with counts
			db
				.select({
					value: opportunities.sourceFile,
					count: count(),
				})
				.from(opportunities)
				.where(and(...buildConditions("sourceFiles"), sql`${opportunities.sourceFile} IS NOT NULL`))
				.groupBy(opportunities.sourceFile)
				.orderBy(desc(count())),

			// Statuses with counts
			db
				.select({
					value: opportunities.decisionStatus,
					count: count(),
				})
				.from(opportunities)
				.where(and(...buildConditions("statuses"), sql`${opportunities.decisionStatus} IS NOT NULL`))
				.groupBy(opportunities.decisionStatus)
				.orderBy(desc(count())),

			// Priority ranks with counts
			db
				.select({
					value: opportunities.priorityRank,
					count: count(),
				})
				.from(opportunities)
				.where(and(...buildConditions("priorityRanks"), sql`${opportunities.priorityRank} IS NOT NULL`))
				.groupBy(opportunities.priorityRank)
				.orderBy(asc(opportunities.priorityRank)),
		]);

	return {
		categories: categories.map((r) => ({ value: r.value!, count: r.count })),
		sectors: sectors.map((r) => ({ value: r.value!, count: r.count })),
		countries: countries.map((r) => ({ value: r.value!, count: r.count })),
		organizations: organizations.map((r) => ({ value: r.value!, count: r.count })),
		sourceFiles: sourceFiles.map((r) => ({ value: r.value!, count: r.count })),
		statuses: statuses.map((r) => ({ value: r.value as string, count: r.count })),
		priorityRanks: priorityRanks.map((r) => ({ value: String(r.value), count: r.count })),
	};
}

// ============================================================================
// Saved Searches (persisted to database)
// ============================================================================

/**
 * Saved search configuration.
 */
export interface SavedSearch {
	id: string;
	userId: string;
	name: string;
	description?: string;
	filters: OpportunityFilters;
	sort: OpportunitySort;
	isDefault?: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Hydrate a database row into a SavedSearch.
 */
function hydrateSavedSearch(row: typeof savedSearches.$inferSelect): SavedSearch {
	const filters = row.filters as Record<string, unknown>;
	return {
		id: row.id,
		userId: row.userId,
		name: row.name,
		description: (filters.description as string) ?? undefined,
		filters: (filters.filters ?? filters) as OpportunityFilters,
		sort: (filters.sort ?? { field: "deadline", direction: "asc" }) as OpportunitySort,
		isDefault: (filters.isDefault as boolean) ?? false,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

/**
 * Serialize a SavedSearch into the JSONB payload stored in the `filters` column.
 */
function serializeSavedSearchFilters(
	search: Omit<SavedSearch, "id" | "userId" | "createdAt" | "updatedAt">
): Record<string, unknown> {
	return {
		filters: search.filters,
		sort: search.sort,
		description: search.description,
		isDefault: search.isDefault ?? false,
	};
}

/**
 * Get all saved searches for a user, ordered by most recently updated.
 */
export async function getSavedSearches(userId: string): Promise<SavedSearch[]> {
	const rows = await db
		.select()
		.from(savedSearches)
		.where(eq(savedSearches.userId, userId))
		.orderBy(desc(savedSearches.updatedAt));

	return rows.map(hydrateSavedSearch);
}

/**
 * Get a saved search by ID.
 */
export async function getSavedSearch(id: string): Promise<SavedSearch | null> {
	const [row] = await db
		.select()
		.from(savedSearches)
		.where(eq(savedSearches.id, id))
		.limit(1);

	return row ? hydrateSavedSearch(row) : null;
}

/**
 * Save a search configuration.
 */
export async function saveSearch(
	userId: string,
	search: Omit<SavedSearch, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<SavedSearch> {
	const [row] = await db
		.insert(savedSearches)
		.values({
			userId,
			name: search.name,
			filters: serializeSavedSearchFilters(search),
		})
		.returning();

	return hydrateSavedSearch(row);
}

/**
 * Update a saved search.
 */
export async function updateSavedSearch(
	id: string,
	updates: Partial<Omit<SavedSearch, "id" | "userId" | "createdAt">>
): Promise<SavedSearch | null> {
	const existing = await getSavedSearch(id);
	if (!existing) return null;

	const merged = { ...existing, ...updates };
	const [row] = await db
		.update(savedSearches)
		.set({
			name: merged.name,
			filters: serializeSavedSearchFilters(merged),
			updatedAt: new Date(),
		})
		.where(eq(savedSearches.id, id))
		.returning();

	return row ? hydrateSavedSearch(row) : null;
}

/**
 * Delete a saved search.
 */
export async function deleteSavedSearch(id: string): Promise<boolean> {
	const result = await db
		.delete(savedSearches)
		.where(eq(savedSearches.id, id));

	return (result.rowCount ?? 0) > 0;
}

/**
 * Set a saved search as default for a user.
 * Clears the default flag on all other searches for the same user first.
 */
export async function setDefaultSavedSearch(id: string): Promise<boolean> {
	const existing = await getSavedSearch(id);
	if (!existing) return false;

	// Get all searches for this user and clear their isDefault flag
	const userSearches = await db
		.select()
		.from(savedSearches)
		.where(eq(savedSearches.userId, existing.userId));

	for (const row of userSearches) {
		const data = row.filters as Record<string, unknown>;
		if (data.isDefault) {
			await db
				.update(savedSearches)
				.set({
					filters: { ...data, isDefault: false },
					updatedAt: new Date(),
				})
				.where(eq(savedSearches.id, row.id));
		}
	}

	// Set the new default
	const existingData = (await db
		.select({ filters: savedSearches.filters })
		.from(savedSearches)
		.where(eq(savedSearches.id, id))
		.limit(1))[0];

	if (!existingData) return false;

	await db
		.update(savedSearches)
		.set({
			filters: { ...(existingData.filters as Record<string, unknown>), isDefault: true },
			updatedAt: new Date(),
		})
		.where(eq(savedSearches.id, id));

	return true;
}

/**
 * Get the default saved search for a user.
 */
export async function getDefaultSavedSearch(userId: string): Promise<SavedSearch | null> {
	const rows = await db
		.select()
		.from(savedSearches)
		.where(eq(savedSearches.userId, userId));

	for (const row of rows) {
		const data = row.filters as Record<string, unknown>;
		if (data.isDefault) return hydrateSavedSearch(row);
	}
	return null;
}
