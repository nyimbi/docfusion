/**
 * Competitive Intelligence Repository - DocFusion
 *
 * Data access layer for competitors, discriminators, ghost themes,
 * competitor-opportunity links, and competitive analyses.
 *
 * Query patterns mirrored from `actions/competitive.ts`:
 * - Competitor CRUD with organization-scoped listing
 * - Text + JSONB capability/certification search
 * - Discriminator management with effectiveness tracking
 * - Ghost theme CRUD scoped to competitor
 * - Competitor-opportunity linking with likelihood scoring
 * - Competitive analysis record persistence
 */

import {
	SQL,
	and,
	eq,
	or,
	desc,
	asc,
	sql,
	like,
	inArray,
	ne,
	isNull,
	isNotNull,
	count,
} from "drizzle-orm";
import {
	competitors,
	discriminators,
	ghostThemes,
	competitorOpportunities,
	competitiveAnalyses,
	type Competitor,
	type Discriminator,
	type GhostTheme,
	type CompetitorOpportunity,
	type CompetitiveAnalysis,
} from "@/lib/db/schema-competitors";
import { BaseRepository } from "./base-repository";

// ============================================================================
// Filter types
// ============================================================================

export interface CompetitorFilters {
	competitorType?: string;
	sizeStandard?: string;
	hasCapability?: string;
	hasCertification?: string;
}

export interface DiscriminatorFilters {
	type?: string;
	isActive?: boolean;
	effectiveAgainst?: string;
}

// ============================================================================
// Type aliases for Drizzle inference
// ============================================================================

type CompetitorInsert = typeof competitors.$inferInsert;
type DiscriminatorInsert = typeof discriminators.$inferInsert;
type GhostThemeInsert = typeof ghostThemes.$inferInsert;
type CompetitorOpportunityInsert = typeof competitorOpportunities.$inferInsert;
type CompetitiveAnalysisInsert = typeof competitiveAnalyses.$inferInsert;

// ============================================================================
// Repository
// ============================================================================

export class CompetitiveRepository extends BaseRepository<
	typeof competitors,
	Competitor,
	CompetitorInsert
> {
	constructor() {
		super(competitors);
	}

	// ──────────────────────────────────────────────────────────────────────
	// Competitor queries
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * List all competitors, optionally filtered by organization.
	 * Mirrors `listCompetitors`.
	 */
	async findByOrganization(organizationId?: string): Promise<Competitor[]> {
		if (organizationId) {
			return this.db
				.select()
				.from(competitors)
				.where(eq(competitors.organizationId, organizationId))
				.orderBy(asc(competitors.name));
		}
		return this.db
			.select()
			.from(competitors)
			.orderBy(asc(competitors.name));
	}

	/**
	 * Text + JSONB search across competitors.
	 * Mirrors `searchCompetitors`.
	 */
	async search(
		query: string,
		filters?: CompetitorFilters,
	): Promise<Competitor[]> {
		const conditions: SQL[] = [];

		if (query?.trim()) {
			const pattern = `%${query.toLowerCase()}%`;
			conditions.push(
				sql`(LOWER(${competitors.name}) LIKE ${pattern} OR LOWER(${competitors.description}) LIKE ${pattern})`,
			);
		}

		if (filters?.competitorType) {
			conditions.push(eq(competitors.competitorType, filters.competitorType));
		}
		if (filters?.sizeStandard) {
			conditions.push(eq(competitors.sizeStandard, filters.sizeStandard));
		}
		if (filters?.hasCapability) {
			conditions.push(
				sql`${competitors.capabilities}::jsonb @> ${JSON.stringify([{ area: filters.hasCapability }])}::jsonb`,
			);
		}
		if (filters?.hasCertification) {
			conditions.push(
				sql`${competitors.certifications}::jsonb ? ${filters.hasCertification}`,
			);
		}

		return this.db
			.select()
			.from(competitors)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(asc(competitors.name));
	}

	// ──────────────────────────────────────────────────────────────────────
	// Discriminator queries
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * List discriminators with optional type/active/effectiveAgainst filters.
	 * Mirrors `listDiscriminators`.
	 */
	async getDiscriminators(filters?: DiscriminatorFilters): Promise<Discriminator[]> {
		const conditions: SQL[] = [];

		if (filters?.type) {
			conditions.push(eq(discriminators.discriminatorType, filters.type));
		}
		if (filters?.isActive !== undefined) {
			conditions.push(eq(discriminators.isActive, filters.isActive));
		}
		if (filters?.effectiveAgainst) {
			conditions.push(
				sql`${discriminators.effectiveAgainst}::jsonb ? ${filters.effectiveAgainst}`,
			);
		}

		return this.db
			.select()
			.from(discriminators)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(discriminators.effectivenessScore), asc(discriminators.statement));
	}

	/**
	 * Get a single discriminator by ID.
	 */
	async getDiscriminatorById(id: string): Promise<Discriminator | null> {
		const [row] = await this.db
			.select()
			.from(discriminators)
			.where(eq(discriminators.id, id))
			.limit(1);
		return row ?? null;
	}

	/**
	 * Create a discriminator.
	 */
	async createDiscriminator(data: DiscriminatorInsert): Promise<Discriminator> {
		const [row] = await this.db
			.insert(discriminators)
			.values({
				...data,
				isActive: true,
				useCount: 0,
				winCount: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();
		return row;
	}

	/**
	 * Update a discriminator.
	 */
	async updateDiscriminator(id: string, data: Partial<DiscriminatorInsert>): Promise<Discriminator | null> {
		const [row] = await this.db
			.update(discriminators)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(discriminators.id, id))
			.returning();
		return row ?? null;
	}

	/**
	 * Delete a discriminator.
	 */
	async deleteDiscriminator(id: string): Promise<boolean> {
		const result = await this.db
			.delete(discriminators)
			.where(eq(discriminators.id, id))
			.returning();
		return result.length > 0;
	}

	/**
	 * Record discriminator usage and recalculate effectiveness.
	 * Mirrors `recordDiscriminatorUsage`.
	 */
	async recordDiscriminatorUsage(id: string, won: boolean): Promise<Discriminator | null> {
		const [existing] = await this.db
			.select()
			.from(discriminators)
			.where(eq(discriminators.id, id))
			.limit(1);

		if (!existing) return null;

		const newUseCount = (existing.useCount ?? 0) + 1;
		const newWinCount = (existing.winCount ?? 0) + (won ? 1 : 0);
		const effectivenessScore = newUseCount > 0 ? (newWinCount / newUseCount) * 100 : null;

		const [updated] = await this.db
			.update(discriminators)
			.set({
				useCount: newUseCount,
				winCount: newWinCount,
				effectivenessScore,
				updatedAt: new Date(),
			})
			.where(eq(discriminators.id, id))
			.returning();

		return updated ?? null;
	}

	// ──────────────────────────────────────────────────────────────────────
	// Ghost themes
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Get ghost themes for a competitor.
	 */
	async getGhostThemesByCompetitor(competitorId: string): Promise<GhostTheme[]> {
		return this.db
			.select()
			.from(ghostThemes)
			.where(eq(ghostThemes.competitorId, competitorId))
			.orderBy(desc(ghostThemes.createdAt));
	}

	/**
	 * Get all ghost themes marked as ethical.
	 */
	async getEthicalGhostThemes(): Promise<GhostTheme[]> {
		return this.db
			.select()
			.from(ghostThemes)
			.where(eq(ghostThemes.isEthical, true))
			.orderBy(asc(ghostThemes.competitorId), desc(ghostThemes.createdAt));
	}

	/**
	 * Create a ghost theme.
	 */
	async createGhostTheme(data: GhostThemeInsert): Promise<GhostTheme> {
		const [row] = await this.db
			.insert(ghostThemes)
			.values({ ...data, createdAt: new Date() })
			.returning();
		return row;
	}

	/**
	 * Update a ghost theme.
	 */
	async updateGhostTheme(id: string, data: Partial<GhostThemeInsert>): Promise<GhostTheme | null> {
		const [row] = await this.db
			.update(ghostThemes)
			.set(data)
			.where(eq(ghostThemes.id, id))
			.returning();
		return row ?? null;
	}

	/**
	 * Delete a ghost theme.
	 */
	async deleteGhostTheme(id: string): Promise<boolean> {
		const result = await this.db
			.delete(ghostThemes)
			.where(eq(ghostThemes.id, id))
			.returning();
		return result.length > 0;
	}

	// ──────────────────────────────────────────────────────────────────────
	// Competitor-opportunity links
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Link a competitor to an opportunity.
	 */
	async addCompetitorToOpportunity(data: CompetitorOpportunityInsert): Promise<CompetitorOpportunity> {
		const [row] = await this.db
			.insert(competitorOpportunities)
			.values(data)
			.returning();
		return row;
	}

	/**
	 * Get competitors linked to an opportunity.
	 */
	async getCompetitorsForOpportunity(opportunityId: string): Promise<CompetitorOpportunity[]> {
		return this.db
			.select()
			.from(competitorOpportunities)
			.where(eq(competitorOpportunities.opportunityId, opportunityId));
	}

	/**
	 * Get opportunities linked to a competitor.
	 */
	async getOpportunitiesForCompetitor(competitorId: string): Promise<CompetitorOpportunity[]> {
		return this.db
			.select()
			.from(competitorOpportunities)
			.where(eq(competitorOpportunities.competitorId, competitorId));
	}

	/**
	 * Remove a competitor-opportunity link.
	 */
	async removeCompetitorFromOpportunity(competitorId: string, opportunityId: string): Promise<boolean> {
		const result = await this.db
			.delete(competitorOpportunities)
			.where(
				and(
					eq(competitorOpportunities.competitorId, competitorId),
					eq(competitorOpportunities.opportunityId, opportunityId),
				),
			)
			.returning();
		return result.length > 0;
	}

	// ──────────────────────────────────────────────────────────────────────
	// Competitive analyses
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Get competitive analysis for an opportunity.
	 */
	async getAnalysisByOpportunity(opportunityId: string): Promise<CompetitiveAnalysis | null> {
		const [row] = await this.db
			.select()
			.from(competitiveAnalyses)
			.where(eq(competitiveAnalyses.opportunityId, opportunityId))
			.orderBy(desc(competitiveAnalyses.updatedAt))
			.limit(1);
		return row ?? null;
	}

	/**
	 * Create or update a competitive analysis.
	 */
	async upsertAnalysis(data: CompetitiveAnalysisInsert): Promise<CompetitiveAnalysis> {
		if (data.opportunityId) {
			const existing = await this.getAnalysisByOpportunity(data.opportunityId);
			if (existing) {
				const [row] = await this.db
					.update(competitiveAnalyses)
					.set({ ...data, updatedAt: new Date() })
					.where(eq(competitiveAnalyses.id, existing.id))
					.returning();
				return row;
			}
		}
		const [row] = await this.db
			.insert(competitiveAnalyses)
			.values(data)
			.returning();
		return row;
	}
}
