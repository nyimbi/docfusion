/**
 * Evidence Repository - DocFusion
 *
 * Data access layer for the evidence library, evidence usage tracking,
 * claim analysis, evidence matrices, and strength analysis tables.
 *
 * Query patterns mirrored from `actions/evidence.ts`:
 * - Filtered listing with type/category/status/tag/strength-score predicates
 * - Text search across title, content, summary (ILIKE)
 * - Evidence usage CRUD and tracking
 * - Claim analysis retrieval and resolution
 * - Evidence matrix management
 * - Strength analysis records
 * - Aggregate statistics by type and strength
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
	evidenceLibrary,
	evidenceUsages,
	claimAnalysis,
	evidenceMatrices,
	evidenceStrengthAnalysis,
	type Evidence as DBEvidence,
	type EvidenceUsage as DBEvidenceUsage,
	type ClaimAnalysisRecord as DBClaimAnalysis,
	type EvidenceMatrix as DBEvidenceMatrix,
	type EvidenceStrengthAnalysisRecord as DBEvidenceStrengthAnalysis,
	type NewEvidence,
	type NewEvidenceUsage,
	type NewClaimAnalysis,
	type NewEvidenceMatrix,
	type NewEvidenceStrengthAnalysis,
	type EvidenceType,
	type EvidenceCategory,
	type EvidenceSourceType,
	type EvidenceStatus,
	type EvidenceTier,
} from "@/lib/db/schema-evidence";
import { BaseRepository } from "./base-repository";

// ============================================================================
// Filter types (mirrored from actions/evidence.ts to keep the repository
// self-contained without pulling in "use server" modules)
// ============================================================================

export interface EvidenceFilters {
	evidenceType?: string | string[];
	category?: string | string[];
	status?: string | string[];
	tags?: string[];
	isQuantified?: boolean;
	minStrengthScore?: number;
	maxStrengthScore?: number;
	search?: string;
	limit?: number;
	offset?: number;
	orderBy?: "title" | "strengthScore" | "useCount" | "createdAt" | "updatedAt";
	orderDirection?: "asc" | "desc";
}

// ============================================================================
// Repository
// ============================================================================

export class EvidenceRepository extends BaseRepository<
	typeof evidenceLibrary,
	DBEvidence,
	NewEvidence
> {
	constructor() {
		super(evidenceLibrary);
	}

	// ──────────────────────────────────────────────────────────────────────
	// Filtered listing
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * List evidence items with optional filtering by type, category, status,
	 * strength score range, quantification flag, and free-text search.
	 * Mirrors the WHERE/ORDER/LIMIT logic in `listEvidence`.
	 */
	async findWithFilters(
		organizationId: string | null,
		filters?: EvidenceFilters,
	): Promise<DBEvidence[]> {
		const conditions: SQL[] = [];

		// Organization scope: own + shared (null org)
		if (organizationId) {
			conditions.push(
				or(
					eq(evidenceLibrary.organizationId, organizationId),
					isNull(evidenceLibrary.organizationId),
				)!,
			);
		}

		if (filters?.evidenceType) {
			const types = Array.isArray(filters.evidenceType) ? filters.evidenceType : [filters.evidenceType];
			conditions.push(inArray(evidenceLibrary.evidenceType, types as EvidenceType[]));
		}

		if (filters?.category) {
			const cats = Array.isArray(filters.category) ? filters.category : [filters.category];
			conditions.push(inArray(evidenceLibrary.category, cats as EvidenceCategory[]));
		}

		if (filters?.status) {
			const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
			conditions.push(inArray(evidenceLibrary.status, statuses as EvidenceStatus[]));
		}

		if (filters?.isQuantified !== undefined) {
			conditions.push(eq(evidenceLibrary.isQuantified, filters.isQuantified));
		}

		if (filters?.minStrengthScore !== undefined) {
			conditions.push(gte(evidenceLibrary.strengthScore, filters.minStrengthScore));
		}
		if (filters?.maxStrengthScore !== undefined) {
			conditions.push(lte(evidenceLibrary.strengthScore, filters.maxStrengthScore));
		}

		if (filters?.search) {
			const searchTerm = `%${filters.search}%`;
			conditions.push(
				or(
					like(evidenceLibrary.title, searchTerm),
					like(evidenceLibrary.content, searchTerm),
					sql`${evidenceLibrary.summary} ILIKE ${searchTerm}`,
				)!,
			);
		}

		// Sort
		const orderField = filters?.orderBy ?? "createdAt";
		const orderDir = filters?.orderDirection ?? "desc";

		const fieldMap: Record<string, SQL> = {
			title: orderDir === "asc" ? asc(evidenceLibrary.title) : desc(evidenceLibrary.title),
			strengthScore: orderDir === "asc" ? asc(evidenceLibrary.strengthScore) : desc(evidenceLibrary.strengthScore),
			useCount: orderDir === "asc" ? asc(evidenceLibrary.useCount) : desc(evidenceLibrary.useCount),
			createdAt: orderDir === "asc" ? asc(evidenceLibrary.createdAt) : desc(evidenceLibrary.createdAt),
			updatedAt: orderDir === "asc" ? asc(evidenceLibrary.updatedAt) : desc(evidenceLibrary.updatedAt),
		};

		const orderClause = fieldMap[orderField] ?? desc(evidenceLibrary.createdAt);

		return this.db
			.select()
			.from(evidenceLibrary)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(orderClause)
			.limit(filters?.limit ?? 100)
			.offset(filters?.offset ?? 0);
	}

	// ──────────────────────────────────────────────────────────────────────
	// Domain lookups
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * All evidence items linked to a specific opportunity via usage records.
	 */
	async findByOpportunity(opportunityId: string): Promise<DBEvidence[]> {
		const usages = await this.db
			.select({ evidenceId: evidenceUsages.evidenceId })
			.from(evidenceUsages)
			.where(eq(evidenceUsages.opportunityId, opportunityId));

		if (!usages.length) return [];

		const ids = usages.map((u: { evidenceId: string }) => u.evidenceId);
		return this.db
			.select()
			.from(evidenceLibrary)
			.where(inArray(evidenceLibrary.id, ids))
			.orderBy(desc(evidenceLibrary.strengthScore));
	}

	/**
	 * Filter evidence by type (e.g. "metric", "case_study").
	 */
	async findByType(evidenceType: EvidenceType): Promise<DBEvidence[]> {
		return this.db
			.select()
			.from(evidenceLibrary)
			.where(eq(evidenceLibrary.evidenceType, evidenceType))
			.orderBy(desc(evidenceLibrary.strengthScore));
	}

	/**
	 * Calculate a coverage/strength score across the entire evidence library
	 * for the given organization.
	 *
	 * Returns aggregate metrics: total count, avg strength, type distribution,
	 * underutilized items, and coverage gaps.
	 */
	async calculateStrengthScore(organizationId: string): Promise<{
		totalEvidence: number;
		averageStrength: number;
		byType: { type: string; count: number; avgStrength: number }[];
		byTier: { tier: EvidenceTier; count: number }[];
	}> {
		const orgCondition = or(
			eq(evidenceLibrary.organizationId, organizationId),
			isNull(evidenceLibrary.organizationId),
		);

		const [
			[totals],
			typeBreakdown,
		] = await Promise.all([
			this.db
				.select({
					total: count(),
					avgStrength: sql<number>`COALESCE(AVG(${evidenceLibrary.strengthScore}), 0)`,
				})
				.from(evidenceLibrary)
				.where(orgCondition),

			this.db
				.select({
					type: evidenceLibrary.evidenceType,
					count: count(),
					avgStrength: sql<number>`COALESCE(AVG(${evidenceLibrary.strengthScore}), 0)`,
				})
				.from(evidenceLibrary)
				.where(and(orgCondition, sql`${evidenceLibrary.evidenceType} IS NOT NULL`))
				.groupBy(evidenceLibrary.evidenceType),
		]);

		// Compute tier distribution from strength scores
		const tierRows = await this.db
			.select({
				tier: sql<string>`CASE
					WHEN ${evidenceLibrary.strengthScore} >= 80 THEN 'gold'
					WHEN ${evidenceLibrary.strengthScore} >= 60 THEN 'silver'
					ELSE 'bronze'
				END`,
				count: count(),
			})
			.from(evidenceLibrary)
			.where(and(orgCondition, sql`${evidenceLibrary.strengthScore} IS NOT NULL`))
			.groupBy(sql`CASE
				WHEN ${evidenceLibrary.strengthScore} >= 80 THEN 'gold'
				WHEN ${evidenceLibrary.strengthScore} >= 60 THEN 'silver'
				ELSE 'bronze'
			END`);

		return {
			totalEvidence: totals?.total ?? 0,
			averageStrength: Number((totals?.avgStrength ?? 0).toFixed(1)),
			byType: typeBreakdown
				.filter((r: { type: string | null }) => r.type)
				.map((r: { type: string | null; count: number; avgStrength: number }) => ({
					type: r.type!,
					count: r.count,
					avgStrength: Number(r.avgStrength.toFixed(1)),
				})),
			byTier: tierRows.map((r: { tier: string; count: number }) => ({
				tier: r.tier as EvidenceTier,
				count: r.count,
			})),
		};
	}

	// ──────────────────────────────────────────────────────────────────────
	// Evidence usage tracking
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Record a usage of evidence in a document/section.
	 */
	async recordUsage(evidenceId: string, data: NewEvidenceUsage): Promise<DBEvidenceUsage> {
		const [usage] = await this.db
			.insert(evidenceUsages)
			.values({ ...data, evidenceId })
			.returning();

		// Increment use count on the evidence item
		await this.db
			.update(evidenceLibrary)
			.set({
				useCount: sql`${evidenceLibrary.useCount} + 1`,
				lastUsedAt: new Date(),
				lastUsedInOpportunityId: data.opportunityId,
				updatedAt: new Date(),
			})
			.where(eq(evidenceLibrary.id, evidenceId));

		return usage;
	}

	/**
	 * Get all usage records for a specific evidence item.
	 */
	async getUsagesByEvidenceId(evidenceId: string): Promise<DBEvidenceUsage[]> {
		return this.db
			.select()
			.from(evidenceUsages)
			.where(eq(evidenceUsages.evidenceId, evidenceId))
			.orderBy(desc(evidenceUsages.usedAt));
	}

	// ──────────────────────────────────────────────────────────────────────
	// Claim analysis
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Get all claim analysis records for an opportunity.
	 */
	async getClaimsByOpportunity(opportunityId: string): Promise<DBClaimAnalysis[]> {
		return this.db
			.select()
			.from(claimAnalysis)
			.where(eq(claimAnalysis.opportunityId, opportunityId))
			.orderBy(desc(claimAnalysis.riskLevel), asc(claimAnalysis.sectionId));
	}

	/**
	 * Create a new claim analysis record.
	 */
	async createClaim(data: NewClaimAnalysis): Promise<DBClaimAnalysis> {
		const [row] = await this.db
			.insert(claimAnalysis)
			.values(data)
			.returning();
		return row;
	}

	/**
	 * Update a claim's resolution status.
	 */
	async resolveClaim(
		id: string,
		resolution: string,
		resolvedBy: string,
		notes?: string,
	): Promise<DBClaimAnalysis | null> {
		const [row] = await this.db
			.update(claimAnalysis)
				.set({
					resolution: resolution as any,
					resolvedBy,
					resolvedAt: new Date(),
					resolutionNotes: notes,
					status: "resolved" as any,
				})
			.where(eq(claimAnalysis.id, id))
			.returning();
		return row ?? null;
	}

	// ──────────────────────────────────────────────────────────────────────
	// Evidence matrices
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Get an evidence matrix by opportunity ID.
	 */
	async getMatrixByOpportunity(opportunityId: string): Promise<DBEvidenceMatrix | null> {
		const [row] = await this.db
			.select()
			.from(evidenceMatrices)
			.where(eq(evidenceMatrices.opportunityId, opportunityId))
			.orderBy(desc(evidenceMatrices.createdAt))
			.limit(1);
		return row ?? null;
	}

	/**
	 * Create or update an evidence matrix.
	 */
	async upsertMatrix(data: NewEvidenceMatrix): Promise<DBEvidenceMatrix> {
		const existing = data.opportunityId
			? await this.getMatrixByOpportunity(data.opportunityId)
			: null;

		if (existing) {
			const [row] = await this.db
				.update(evidenceMatrices)
				.set(data)
				.where(eq(evidenceMatrices.id, existing.id))
				.returning();
			return row;
		}

		const [row] = await this.db
			.insert(evidenceMatrices)
			.values(data)
			.returning();
		return row;
	}

	// ──────────────────────────────────────────────────────────────────────
	// Strength analysis
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Get the most recent strength analysis for an evidence item.
	 */
	async getStrengthAnalysis(evidenceId: string): Promise<DBEvidenceStrengthAnalysis | null> {
		const [row] = await this.db
			.select()
			.from(evidenceStrengthAnalysis)
			.where(eq(evidenceStrengthAnalysis.evidenceId, evidenceId))
			.orderBy(desc(evidenceStrengthAnalysis.analyzedAt))
			.limit(1);
		return row ?? null;
	}

	/**
	 * Store a new strength analysis for an evidence item.
	 */
	async createStrengthAnalysis(data: NewEvidenceStrengthAnalysis): Promise<DBEvidenceStrengthAnalysis> {
		const [row] = await this.db
			.insert(evidenceStrengthAnalysis)
			.values(data)
			.returning();
		return row;
	}

	// ──────────────────────────────────────────────────────────────────────
	// Bulk operations
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Bulk import evidence items, returning the number created.
	 */
	async bulkCreate(items: NewEvidence[]): Promise<number> {
		if (!items.length) return 0;
		const rows = await this.db.insert(evidenceLibrary).values(items).returning();
		return rows.length;
	}
}
