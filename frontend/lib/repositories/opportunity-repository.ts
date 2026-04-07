/**
 * Opportunity Repository - DocFusion
 *
 * Data access layer for the `opportunities` and related tables (imports,
 * saved searches). Encapsulates all Drizzle queries currently spread across
 * `actions/opportunities.ts` and `actions/opportunity-filters.ts`.
 *
 * Query patterns mirrored from the existing action layer:
 * - Filtered, sorted, paginated listing with dynamic column selection
 * - Full-text search via PostgreSQL tsvector/tsquery
 * - Aggregate statistics with combined scalar + dimensional queries
 * - Faceted filter counts with per-facet exclusion
 * - Saved search persistence
 * - Import history tracking
 * - Bulk status/priority updates
 * - Deadline status refresh (raw SQL for optimal UPDATE performance)
 */

import {
	SQL,
	and,
	eq,
	or,
	gte,
	lte,
	like,
	inArray,
	isNull,
	desc,
	asc,
	count,
	sql,
} from "drizzle-orm";
import {
	opportunities,
	opportunityImports,
	savedSearches,
} from "@/lib/db/schema";
import { BaseRepository, type PaginatedResult } from "./base-repository";
import type {
	Opportunity,
	OpportunityInput,
	OpportunityListItem,
	OpportunityFilters,
	OpportunitySort,
	PaginationOptions,
	OpportunityStats,
	DecisionStatus,
	PriorityRank,
	OpportunityImport,
} from "@/lib/types/opportunity";
import {
	buildOpportunityConditions,
	type ExcludableFilter,
} from "@/lib/actions/opportunity-filters";

// ============================================================================
// List-item column projection (matches the SELECT used in getOpportunities)
// ============================================================================

const LIST_ITEM_COLUMNS = {
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
} as const;

// ============================================================================
// Sort column mapping
// ============================================================================

const SORT_COLUMN_MAP = {
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
} as const;

// ============================================================================
// Repository
// ============================================================================

type OpportunityRow = typeof opportunities.$inferSelect;
type OpportunityInsert = typeof opportunities.$inferInsert;

export class OpportunityRepository extends BaseRepository<
	typeof opportunities,
	OpportunityRow,
	OpportunityInsert
> {
	constructor() {
		super(opportunities);
	}

	// ──────────────────────────────────────────────────────────────────────
	// Filtered listing with pagination
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Paginated, filtered, sorted listing returning the list-item projection.
	 * Matches the query in `getOpportunities`.
	 */
	async findWithFilters(
		filters?: OpportunityFilters,
		sort?: OpportunitySort,
		pagination?: PaginationOptions,
	): Promise<PaginatedResult<OpportunityListItem>> {
		const page = pagination?.page ?? 1;
		const pageSize = pagination?.pageSize ?? 25;
		const offset = (page - 1) * pageSize;

		const conditions = buildOpportunityConditions(filters);
		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const sortField = sort?.field ?? "deadline";
		const sortDir = sort?.direction ?? "asc";
		const col = SORT_COLUMN_MAP[sortField as keyof typeof SORT_COLUMN_MAP] ?? opportunities.deadline;
		const orderBy = sortDir === "asc" ? asc(col) : desc(col);

		const [rows, totalResult] = await Promise.all([
			this.db
				.select(LIST_ITEM_COLUMNS)
				.from(opportunities)
				.where(whereClause)
				.orderBy(orderBy)
				.limit(pageSize)
				.offset(offset),
			this.db
				.select({ count: count() })
				.from(opportunities)
				.where(whereClause),
		]);

		const total = totalResult[0]?.count ?? 0;
		const now = new Date();

		const data: OpportunityListItem[] = rows.map((row) => {
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
		});

		return this.buildPaginatedResult(data, total, page, pageSize);
	}

	// ──────────────────────────────────────────────────────────────────────
	// Full-text search
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Full-text search using PostgreSQL tsvector with relevance ranking.
	 * Matches the query in `searchOpportunities`.
	 */
	async search(
		query: string,
		filters?: OpportunityFilters,
		sort?: OpportunitySort,
		pagination?: PaginationOptions,
	): Promise<PaginatedResult<OpportunityListItem & { searchRank?: number }>> {
		const page = pagination?.page ?? 1;
		const pageSize = pagination?.pageSize ?? 25;
		const offset = (page - 1) * pageSize;

		const tsquery = sql`plainto_tsquery('english', ${query})`;
		const filterConditions = buildOpportunityConditions(filters);
		const conditions: SQL[] = [
			sql`${opportunities.searchVector} @@ ${tsquery}`,
			...filterConditions,
		];
		const whereClause = and(...conditions);

		const sortField = sort?.field ?? "relevance";
		const sortDir = sort?.direction ?? "desc";

		let orderBy: SQL;
		if (sortField === "relevance") {
			const rankExpr = sql`ts_rank_cd(${opportunities.searchVector}, ${tsquery})`;
			orderBy = sortDir === "desc" ? desc(rankExpr) : asc(rankExpr);
		} else {
			const col = SORT_COLUMN_MAP[sortField as keyof typeof SORT_COLUMN_MAP] ?? opportunities.deadline;
			orderBy = sortDir === "desc" ? desc(col) : asc(col);
		}

		const [rows, totalResult] = await Promise.all([
			this.db
				.select({
					...LIST_ITEM_COLUMNS,
					searchRank: sql<number>`ts_rank_cd(${opportunities.searchVector}, ${tsquery})`,
				})
				.from(opportunities)
				.where(whereClause)
				.orderBy(orderBy)
				.limit(pageSize)
				.offset(offset),
			this.db
				.select({ count: count() })
				.from(opportunities)
				.where(whereClause),
		]);

		const total = totalResult[0]?.count ?? 0;
		const now = new Date();

		const data = rows.map((row) => ({
			...row,
			daysLeft: row.deadline
				? Math.ceil((new Date(row.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
				: null,
			isExpired: row.deadline ? new Date(row.deadline) < now : false,
			tags: (row.tags as string[]) ?? [],
			priorityRank: (row.priorityRank ?? 3) as PriorityRank,
			decisionStatus: (row.decisionStatus ?? "pending") as DecisionStatus,
			searchRank: row.searchRank,
		}));

		return this.buildPaginatedResult(data, total, page, pageSize);
	}

	/**
	 * Full-text search suggestions (autocomplete from existing tsvector terms).
	 */
	async getSearchSuggestions(prefix: string, limit: number = 10): Promise<string[]> {
		if (!prefix || prefix.length < 2) return [];

		const results = await this.db.execute(sql`
			SELECT DISTINCT word
			FROM ts_stat(${
				sql`SELECT to_tsvector('english', title || ' ' || COALESCE(organization, '') || ' ' || COALESCE(category, '')) FROM opportunities`
			})
			WHERE word ILIKE ${prefix + "%"}
			ORDER BY word
			LIMIT ${limit}
		`);

		return results.rows.map((row: { word: string }) => row.word);
	}

	/**
	 * Rebuild search vectors for rows that have a NULL/empty vector.
	 */
	async refreshSearchVectors(): Promise<number> {
		const result = await this.db.execute(sql`
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

	// ──────────────────────────────────────────────────────────────────────
	// Statistics / Analytics
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Aggregate statistics using a two-batch parallel query strategy:
	 * - Batch 1: Single scan for scalar aggregates
	 * - Batch 2: Parallel groupBy queries for dimensional breakdowns
	 *
	 * Mirrors `getOpportunityStats`.
	 */
	async getStats(filters?: OpportunityFilters): Promise<OpportunityStats> {
		const conditions = buildOpportunityConditions(filters);
		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const now = new Date();
		const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

		const [
			[aggregates],
			statusCounts,
			priorityCounts,
			categoryCounts,
			countryCounts,
			upcomingDeadlines,
		] = await Promise.all([
			this.db
				.select({
					total: count(),
					expired: sql<number>`COUNT(*) FILTER (WHERE ${opportunities.deadline} IS NOT NULL AND ${opportunities.deadline} <= ${today})`,
					active: sql<number>`COUNT(*) FILTER (WHERE ${opportunities.deadline} IS NULL OR ${opportunities.deadline} >= ${today})`,
					totalValue: sql<number>`COALESCE(SUM(${opportunities.budgetNumeric}), 0)`,
					avgFit: sql<number | null>`AVG(${opportunities.fitScore})`,
				})
				.from(opportunities)
				.where(whereClause),

			this.db
				.select({ status: opportunities.decisionStatus, count: count() })
				.from(opportunities)
				.where(whereClause)
				.groupBy(opportunities.decisionStatus),

			this.db
				.select({ priority: opportunities.priorityRank, count: count() })
				.from(opportunities)
				.where(whereClause)
				.groupBy(opportunities.priorityRank),

			this.db
				.select({ category: opportunities.category, count: count() })
				.from(opportunities)
				.where(and(whereClause, sql`${opportunities.category} IS NOT NULL`))
				.groupBy(opportunities.category)
				.orderBy(desc(count()))
				.limit(10),

			this.db
				.select({ country: opportunities.countryRegion, count: count() })
				.from(opportunities)
				.where(and(whereClause, sql`${opportunities.countryRegion} IS NOT NULL`))
				.groupBy(opportunities.countryRegion)
				.orderBy(desc(count()))
				.limit(10),

			this.db
				.select({ date: opportunities.deadline, count: count() })
				.from(opportunities)
				.where(
					and(
						whereClause,
						gte(opportunities.deadline, now),
						lte(opportunities.deadline, thirtyDaysFromNow),
						eq(opportunities.isExpired, false),
					),
				)
				.groupBy(opportunities.deadline)
				.orderBy(asc(opportunities.deadline))
				.limit(30),
		]);

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

	// ──────────────────────────────────────────────────────────────────────
	// Filter options (distinct values / faceted counts)
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Distinct values for each filterable column.
	 */
	async getFilterOptions(): Promise<{
		categories: string[];
		sectors: string[];
		countries: string[];
		organizations: string[];
		sourceFiles: string[];
	}> {
		const [categories, sectors, countries, organizations, sourceFiles] =
			await Promise.all([
				this.db
					.selectDistinct({ value: opportunities.category })
					.from(opportunities)
					.where(sql`${opportunities.category} IS NOT NULL`)
					.orderBy(asc(opportunities.category)),
				this.db
					.selectDistinct({ value: opportunities.sector })
					.from(opportunities)
					.where(sql`${opportunities.sector} IS NOT NULL`)
					.orderBy(asc(opportunities.sector)),
				this.db
					.selectDistinct({ value: opportunities.countryRegion })
					.from(opportunities)
					.where(sql`${opportunities.countryRegion} IS NOT NULL`)
					.orderBy(asc(opportunities.countryRegion)),
				this.db
					.selectDistinct({ value: opportunities.organization })
					.from(opportunities)
					.where(sql`${opportunities.organization} IS NOT NULL`)
					.orderBy(asc(opportunities.organization)),
				this.db
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

	/**
	 * Faceted filter counts respecting current filters with per-facet exclusion.
	 */
	async getFilterOptionsWithCounts(
		filters?: OpportunityFilters,
	): Promise<{
		categories: { value: string; count: number }[];
		sectors: { value: string; count: number }[];
		countries: { value: string; count: number }[];
		organizations: { value: string; count: number }[];
		sourceFiles: { value: string; count: number }[];
		statuses: { value: string; count: number }[];
		priorityRanks: { value: string; count: number }[];
	}> {
		const buildConditions = (excludeFilter?: string) =>
			buildOpportunityConditions(filters, {
				excludeFilter: excludeFilter as ExcludableFilter | undefined,
			});

		const [categories, sectors, countries, organizations, sourceFiles, statuses, priorityRanks] =
			await Promise.all([
				this.db
					.select({ value: opportunities.category, count: count() })
					.from(opportunities)
					.where(and(...buildConditions("categories"), sql`${opportunities.category} IS NOT NULL`))
					.groupBy(opportunities.category)
					.orderBy(desc(count())),
				this.db
					.select({ value: opportunities.sector, count: count() })
					.from(opportunities)
					.where(and(...buildConditions("sectors"), sql`${opportunities.sector} IS NOT NULL`))
					.groupBy(opportunities.sector)
					.orderBy(desc(count())),
				this.db
					.select({ value: opportunities.countryRegion, count: count() })
					.from(opportunities)
					.where(and(...buildConditions("countries"), sql`${opportunities.countryRegion} IS NOT NULL`))
					.groupBy(opportunities.countryRegion)
					.orderBy(desc(count())),
				this.db
					.select({ value: opportunities.organization, count: count() })
					.from(opportunities)
					.where(and(...buildConditions("organizations"), sql`${opportunities.organization} IS NOT NULL`))
					.groupBy(opportunities.organization)
					.orderBy(desc(count())),
				this.db
					.select({ value: opportunities.sourceFile, count: count() })
					.from(opportunities)
					.where(and(...buildConditions("sourceFiles"), sql`${opportunities.sourceFile} IS NOT NULL`))
					.groupBy(opportunities.sourceFile)
					.orderBy(desc(count())),
				this.db
					.select({ value: opportunities.decisionStatus, count: count() })
					.from(opportunities)
					.where(and(...buildConditions("statuses"), sql`${opportunities.decisionStatus} IS NOT NULL`))
					.groupBy(opportunities.decisionStatus)
					.orderBy(desc(count())),
				this.db
					.select({ value: opportunities.priorityRank, count: count() })
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

	// ──────────────────────────────────────────────────────────────────────
	// Bulk mutations
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Bulk update decision status (and optional reason) for multiple IDs.
	 */
	async bulkUpdateStatus(
		ids: string[],
		status: DecisionStatus,
		reason?: string,
	): Promise<number> {
		const result = await this.db
			.update(opportunities)
			.set({ decisionStatus: status, decisionReason: reason, updatedAt: new Date() })
			.where(inArray(opportunities.id, ids));
		return result.rowCount ?? 0;
	}

	/**
	 * Bulk update priority rank for multiple IDs.
	 */
	async bulkUpdatePriority(ids: string[], priority: PriorityRank): Promise<number> {
		const result = await this.db
			.update(opportunities)
			.set({ priorityRank: priority, updatedAt: new Date() })
			.where(inArray(opportunities.id, ids));
		return result.rowCount ?? 0;
	}

	/**
	 * Mark opportunities as reviewed or not.
	 */
	async markAsReviewed(ids: string[], reviewed: boolean = true): Promise<number> {
		const result = await this.db
			.update(opportunities)
			.set({ isReviewed: reviewed, updatedAt: new Date() })
			.where(inArray(opportunities.id, ids));
		return result.rowCount ?? 0;
	}

	/**
	 * Assign multiple opportunities to a user (or unassign with null).
	 */
	async assignTo(ids: string[], assignedTo: string | null): Promise<number> {
		const result = await this.db
			.update(opportunities)
			.set({ assignedTo, updatedAt: new Date() })
			.where(inArray(opportunities.id, ids));
		return result.rowCount ?? 0;
	}

	// ──────────────────────────────────────────────────────────────────────
	// Deadline maintenance
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Recompute `days_left` and `is_expired` for all rows with a deadline.
	 * Intended for periodic execution (daily cron).
	 */
	async refreshDeadlineStatus(): Promise<number> {
		const result = await this.db.execute(sql`
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

	// ──────────────────────────────────────────────────────────────────────
	// Import history
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Recent import records, ordered newest-first.
	 */
	async getImportHistory(limit: number = 20): Promise<OpportunityImport[]> {
		const rows = await this.db
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
	 * Create a new import record in "processing" state.
	 */
	async createImportRecord(
		filename: string,
		totalRecords: number,
		config?: OpportunityImport["config"],
	): Promise<string> {
		const [row] = await this.db
			.insert(opportunityImports)
			.values({ filename, totalRecords, status: "processing", config })
			.returning({ id: opportunityImports.id });
		return row.id;
	}

	/**
	 * Finalize an import record with result counts.
	 */
	async updateImportRecord(
		id: string,
		results: {
			importedRecords: number;
			updatedRecords: number;
			skippedRecords: number;
			failedRecords: number;
			status: OpportunityImport["status"];
			errors?: OpportunityImport["errors"];
		},
	): Promise<void> {
		await this.db
			.update(opportunityImports)
			.set({ ...results, completedAt: new Date() })
			.where(eq(opportunityImports.id, id));
	}

	// ──────────────────────────────────────────────────────────────────────
	// Saved searches
	// ──────────────────────────────────────────────────────────────────────

	async getSavedSearches(userId: string) {
		return this.db
			.select()
			.from(savedSearches)
			.where(eq(savedSearches.userId, userId))
			.orderBy(desc(savedSearches.updatedAt));
	}

	async getSavedSearchById(id: string) {
		const [row] = await this.db
			.select()
			.from(savedSearches)
			.where(eq(savedSearches.id, id))
			.limit(1);
		return row ?? null;
	}

	async createSavedSearch(userId: string, name: string, filtersPayload: Record<string, unknown>) {
		const [row] = await this.db
			.insert(savedSearches)
			.values({ userId, name, filters: filtersPayload })
			.returning();
		return row;
	}

	async updateSavedSearch(id: string, data: { name?: string; filters?: Record<string, unknown> }) {
		const [row] = await this.db
			.update(savedSearches)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(savedSearches.id, id))
			.returning();
		return row ?? null;
	}

	async deleteSavedSearch(id: string): Promise<boolean> {
		const result = await this.db.delete(savedSearches).where(eq(savedSearches.id, id));
		return (result.rowCount ?? 0) > 0;
	}
}
