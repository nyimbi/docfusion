/**
 * Opportunity Server Actions - DocFusion
 *
 * Server-side actions for managing RFP/EOI/Tender opportunities.
 * Includes CRUD operations, filtering, sorting, and analytics.
 */

"use server";

import { db } from "@/lib/db";
import { opportunities, opportunityImports } from "@/lib/db/schema";
import { eq, and, or, gte, lte, like, inArray, isNull, desc, asc, sql, count } from "drizzle-orm";
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

	// Build WHERE conditions
	const conditions: ReturnType<typeof eq>[] = [];

	if (filters?.search) {
		const searchTerm = `%${filters.search}%`;
		conditions.push(
			or(
				like(opportunities.title, searchTerm),
				like(opportunities.organization, searchTerm),
				like(opportunities.projectSummary, searchTerm),
				like(opportunities.keyRequirements, searchTerm)
			)!
		);
	}

	if (filters?.categories?.length) {
		conditions.push(inArray(opportunities.category, filters.categories));
	}

	if (filters?.sectors?.length) {
		conditions.push(inArray(opportunities.sector, filters.sectors));
	}

	if (filters?.countries?.length) {
		conditions.push(inArray(opportunities.countryRegion, filters.countries));
	}

	if (filters?.organizations?.length) {
		conditions.push(inArray(opportunities.organization, filters.organizations));
	}

	if (filters?.statuses?.length) {
		conditions.push(inArray(opportunities.decisionStatus, filters.statuses));
	}

	if (filters?.priorityRanks?.length) {
		conditions.push(inArray(opportunities.priorityRank, filters.priorityRanks));
	}

	if (filters?.isExpired !== undefined) {
		conditions.push(eq(opportunities.isExpired, filters.isExpired));
	}

	if (filters?.isReviewed !== undefined) {
		conditions.push(eq(opportunities.isReviewed, filters.isReviewed));
	}

	if (filters?.deadlineFrom) {
		conditions.push(gte(opportunities.deadline, filters.deadlineFrom));
	}

	if (filters?.deadlineTo) {
		conditions.push(lte(opportunities.deadline, filters.deadlineTo));
	}

	if (filters?.budgetMin !== undefined) {
		conditions.push(gte(opportunities.budgetNumeric, filters.budgetMin));
	}

	if (filters?.budgetMax !== undefined) {
		conditions.push(lte(opportunities.budgetNumeric, filters.budgetMax));
	}

	if (filters?.fitScoreMin !== undefined) {
		conditions.push(gte(opportunities.fitScore, filters.fitScoreMin));
	}

	if (filters?.fitScoreMax !== undefined) {
		conditions.push(lte(opportunities.fitScore, filters.fitScoreMax));
	}

	if (filters?.sourceFiles?.length) {
		conditions.push(inArray(opportunities.sourceFile, filters.sourceFiles));
	}

	if (filters?.assignedTo) {
		conditions.push(eq(opportunities.assignedTo, filters.assignedTo));
	}

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

	return {
		data: rows.map((row) => ({
			...row,
			tags: (row.tags as string[]) ?? [],
			priorityRank: (row.priorityRank ?? 3) as PriorityRank,
			decisionStatus: (row.decisionStatus ?? "pending") as DecisionStatus,
		})),
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
 */
export async function getOpportunityStats(filters?: OpportunityFilters): Promise<OpportunityStats> {
	// Build base conditions from filters
	const conditions: ReturnType<typeof eq>[] = [];

	if (filters?.sourceFiles?.length) {
		conditions.push(inArray(opportunities.sourceFile, filters.sourceFiles));
	}

	if (filters?.isExpired !== undefined) {
		conditions.push(eq(opportunities.isExpired, filters.isExpired));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get counts by status
	const statusCounts = await db
		.select({
			status: opportunities.decisionStatus,
			count: count(),
		})
		.from(opportunities)
		.where(whereClause)
		.groupBy(opportunities.decisionStatus);

	// Get counts by priority
	const priorityCounts = await db
		.select({
			priority: opportunities.priorityRank,
			count: count(),
		})
		.from(opportunities)
		.where(whereClause)
		.groupBy(opportunities.priorityRank);

	// Get top categories
	const categoryCounts = await db
		.select({
			category: opportunities.category,
			count: count(),
		})
		.from(opportunities)
		.where(and(whereClause, sql`${opportunities.category} IS NOT NULL`))
		.groupBy(opportunities.category)
		.orderBy(desc(count()))
		.limit(10);

	// Get top countries
	const countryCounts = await db
		.select({
			country: opportunities.countryRegion,
			count: count(),
		})
		.from(opportunities)
		.where(and(whereClause, sql`${opportunities.countryRegion} IS NOT NULL`))
		.groupBy(opportunities.countryRegion)
		.orderBy(desc(count()))
		.limit(10);

	// Get expired and active counts
	const [expiredResult] = await db
		.select({ count: count() })
		.from(opportunities)
		.where(and(whereClause, eq(opportunities.isExpired, true)));

	const [activeResult] = await db
		.select({ count: count() })
		.from(opportunities)
		.where(and(whereClause, eq(opportunities.isExpired, false)));

	// Get total count
	const [totalResult] = await db
		.select({ count: count() })
		.from(opportunities)
		.where(whereClause);

	// Get total estimated value
	const [valueResult] = await db
		.select({
			total: sql<number>`SUM(${opportunities.budgetNumeric})`,
		})
		.from(opportunities)
		.where(whereClause);

	// Get average fit score
	const [avgFitResult] = await db
		.select({
			avg: sql<number>`AVG(${opportunities.fitScore})`,
		})
		.from(opportunities)
		.where(and(whereClause, sql`${opportunities.fitScore} IS NOT NULL`));

	// Get upcoming deadlines (next 30 days)
	const now = new Date();
	const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
	const upcomingDeadlines = await db
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
		.limit(30);

	// Build status map
	const byStatus: Record<DecisionStatus, number> = {
		pending: 0,
		interested: 0,
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
		total: totalResult?.count ?? 0,
		byStatus,
		byPriority,
		byCategory: categoryCounts
			.filter((r) => r.category)
			.map((r) => ({ category: r.category!, count: r.count })),
		byCountry: countryCounts
			.filter((r) => r.country)
			.map((r) => ({ country: r.country!, count: r.count })),
		expiredCount: expiredResult?.count ?? 0,
		activeCount: activeResult?.count ?? 0,
		upcomingDeadlines: upcomingDeadlines
			.filter((r) => r.date)
			.map((r) => ({ date: r.date!, count: r.count })),
		totalEstimatedValue: valueResult?.total ?? 0,
		averageFitScore: avgFitResult?.avg ?? null,
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
