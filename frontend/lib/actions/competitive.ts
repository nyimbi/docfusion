/**
 * Competitive Intelligence & Discriminator Engine - DocFusion
 *
 * Server actions for competitor analysis, discriminator management,
 * ghost themes, and strategic competitive positioning.
 *
 * Features:
 * - Competitor CRUD with capability tracking
 * - Discriminator management and effectiveness tracking
 * - Ghost themes for ethical competitive differentiation
 * - AI-powered SWOT analysis and competitor identification
 * - Competitive matrix generation
 * - Win/loss tracking and pattern analysis
 * - Teaming partner suggestions
 */

"use server";

import { z } from "zod";
import { db } from "@/lib/db";
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
import { opportunities, partners, companySettings } from "@/lib/db/schema";
import { eq, and, desc, sql, like, or, inArray, asc, ne, isNull, isNotNull, type SQL } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm/column";
import { getProviderManager } from "@/lib/ai/providers";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/utils/logger";
import { requireUserContext, type UserContext } from "@/lib/auth-utils";

// ============================================================================
// Types
// ============================================================================

/**
 * Standard action result type for consistent API responses.
 */
type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

type OrganizationColumn = AnyColumn<{ data: string; notNull: false }>;
type CompetitiveUserContext = UserContext & { organizationId: string };

async function requireCompetitiveContext(organizationId?: string | null): Promise<CompetitiveUserContext> {
	const userContext = await requireUserContext();
	if (!userContext.organizationId) {
		throw new Error("Organization context required");
	}
	if (organizationId && organizationId !== userContext.organizationId) {
		throw new Error("Unauthorized");
	}
	return userContext as CompetitiveUserContext;
}

function visibleOrganizationCondition(column: OrganizationColumn, userContext: CompetitiveUserContext) {
	return or(isNull(column), eq(column, userContext.organizationId));
}

function mutableOrganizationCondition(column: OrganizationColumn, userContext: CompetitiveUserContext) {
	return eq(column, userContext.organizationId);
}

function organizationForInsert(inputOrganizationId: string | undefined, userContext: CompetitiveUserContext): string {
	return inputOrganizationId ?? userContext.organizationId;
}

function assignedOpportunityByIdCondition(opportunityId: string, userContext: CompetitiveUserContext): SQL {
	return and(
		eq(opportunities.id, opportunityId),
		or(eq(opportunities.organizationId, userContext.organizationId), isNull(opportunities.organizationId))!,
		eq(opportunities.assignedTo, userContext.userId)
	)!;
}

function assignedOpportunityExistsSql(opportunityId: unknown, userContext: CompetitiveUserContext): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and (opportunities.organization_id = ${userContext.organizationId} or opportunities.organization_id is null)
			and opportunities.assigned_to = ${userContext.userId}
	)`;
}

function organizationOpportunityExistsSql(opportunityId: unknown, userContext: CompetitiveUserContext): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and (opportunities.organization_id = ${userContext.organizationId} or opportunities.organization_id is null)
	)`;
}

function competitorOpportunityByOpportunityCondition(opportunityId: string, userContext: CompetitiveUserContext): SQL {
	return and(
		eq(competitorOpportunities.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userContext)
	)!;
}

function competitorOpportunityByIdCondition(linkId: string, userContext: CompetitiveUserContext): SQL {
	return and(
		eq(competitorOpportunities.id, linkId),
		assignedOpportunityExistsSql(competitorOpportunities.opportunityId, userContext)
	)!;
}

function competitorOpportunityByCompetitorAndOpportunityCondition(
	competitorId: string,
	opportunityId: string,
	userContext: CompetitiveUserContext
): SQL {
	return and(
		eq(competitorOpportunities.competitorId, competitorId),
		competitorOpportunityByOpportunityCondition(opportunityId, userContext)
	)!;
}

function competitiveAnalysisByOpportunityCondition(opportunityId: string, userContext: CompetitiveUserContext): SQL {
	return and(
		eq(competitiveAnalyses.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userContext)
	)!;
}

/**
 * Competitor match with likelihood scoring for opportunity analysis.
 */
export type CompetitorMatch = {
	competitor: Competitor;
	likelihoodScore: number;
	matchReasons: string[];
	role: "prime" | "sub" | "incumbent";
};

/**
 * Comprehensive SWOT analysis for an opportunity.
 */
export type SWOTAnalysis = {
	id: string;
	opportunityId: string;
	strengths: string[];
	weaknesses: string[];
	opportunities: string[];
	threats: string[];
	ourPosition: string;
	winStrategy: string;
	pricingStrategy: string;
	aiInsights: Array<{ insight: string; confidence: number; source: string }>;
};

/**
 * Discriminator suggestion with applicability context.
 */
export type DiscriminatorSuggestion = {
	discriminator?: Discriminator;
	statement: string;
	type: string;
	effectiveAgainst: string[];
	confidence: number;
	rationale: string;
	isNew: boolean;
};

/**
 * Competitive comparison matrix across evaluation criteria.
 */
export type CompetitiveMatrix = {
	criteria: Array<{
		name: string;
		weight: number;
	}>;
	competitors: Array<{
		id: string;
		name: string;
		scores: Array<{
			criterionName: string;
			score: number;
			notes: string;
		}>;
		totalScore: number;
	}>;
	ourScores: Array<{
		criterionName: string;
		score: number;
		notes: string;
		advantage: "strong" | "slight" | "neutral" | "disadvantage";
	}>;
	ourTotalScore: number;
};

/**
 * Teaming partner suggestion with gap analysis.
 */
export type TeamingSuggestion = {
	partnerId?: string;
	partnerName: string;
	gapsFilled: string[];
	rationale: string;
	relationshipType: "sub" | "mentor_protege" | "jv";
	confidence: number;
};

function buildPartnerSourcingSuggestions(gaps: string[]): TeamingSuggestion[] {
	return gaps.slice(0, 5).map((gap) => ({
		partnerName: `Partner sourcing required: ${gap}`,
		gapsFilled: [gap],
		rationale: `No active partner or teaming-capable competitor currently covers ${gap}; source or qualify a partner before final capture review.`,
		relationshipType: "sub",
		confidence: 0.35,
	}));
}

/**
 * Win/loss analysis against a specific competitor.
 */
export type WinLossAnalysis = {
	competitorId: string;
	competitorName: string;
	totalEncounters: number;
	ourWins: number;
	ourLosses: number;
	winRate: number;
	winPatterns: string[];
	lossPatterns: string[];
	aiInsights: string[];
};

/**
 * Filters for competitor searches.
 */
export type CompetitorFilters = {
	competitorType?: string;
	sizeStandard?: string;
	hasCapability?: string;
	hasCertification?: string;
};

/**
 * Filters for discriminator searches.
 */
export type DiscriminatorFilters = {
	type?: string;
	isActive?: boolean;
	effectiveAgainst?: string;
};

// ============================================================================
// Zod Validation Schemas
// ============================================================================

const createCompetitorSchema = z.object({
	name: z.string().min(1, "Name is required").max(500),
	legalName: z.string().max(500).optional(),
	website: z.string().url().optional().or(z.literal("")),
	description: z.string().optional(),
	logoUrl: z.string().url().optional().or(z.literal("")),
	competitorType: z.enum(["prime", "sub", "both"]).optional(),
	sizeStandard: z.enum(["small", "large", "8a", "hubzone", "sdvosb", "wosb"]).optional(),
	capabilities: z.array(z.object({
		area: z.string(),
		strength: z.enum(["strong", "moderate", "weak"]),
		notes: z.string().optional(),
	})).optional(),
	certifications: z.array(z.string()).optional(),
	contractVehicles: z.array(z.string()).optional(),
	naicsCodes: z.array(z.string()).optional(),
	strengths: z.array(z.string()).optional(),
	weaknesses: z.array(z.string()).optional(),
	knownPartners: z.array(z.string()).optional(),
	pricingTendency: z.enum(["aggressive", "moderate", "premium"]).optional(),
	laborRateComparison: z.enum(["below_market", "market", "above_market"]).optional(),
	researchNotes: z.string().optional(),
	organizationId: z.string().uuid().optional(),
});

type CreateCompetitorInput = z.infer<typeof createCompetitorSchema>;

const createDiscriminatorSchema = z.object({
	statement: z.string().min(1, "Statement is required"),
	shortVersion: z.string().max(200).optional(),
	proofPoints: z.array(z.string()).optional(),
	discriminatorType: z.enum([
		"capability", "experience", "approach", "team", "cost", "schedule", "innovation", "past_performance"
	]).optional(),
	category: z.string().max(200).optional(),
	supportingEvidence: z.array(z.object({
		type: z.enum(["contract", "metric", "testimonial", "case_study"]),
		description: z.string(),
		reference: z.string().optional(),
	})).optional(),
	effectiveAgainst: z.array(z.string()).optional(),
	applicableOpportunityTypes: z.array(z.string()).optional(),
	applicableNaicsCodes: z.array(z.string()).optional(),
	organizationId: z.string().uuid().optional(),
});

type CreateDiscriminatorInput = z.infer<typeof createDiscriminatorSchema>;

const createGhostThemeSchema = z.object({
	competitorId: z.string().uuid(),
	weakness: z.string().min(1, "Weakness description is required"),
	ghostLanguage: z.string().min(1, "Ghost language is required"),
	suggestedPlacement: z.string().optional(),
	category: z.enum(["technical", "management", "past_performance", "cost", "schedule", "risk"]).optional(),
	complianceNotes: z.string().optional(),
	organizationId: z.string().uuid().optional(),
});

type CreateGhostThemeInput = z.infer<typeof createGhostThemeSchema>;

const addCompetitorToOpportunitySchema = z.object({
	competitorId: z.string().uuid(),
	opportunityId: z.string().uuid(),
	likelihoodToBid: z.enum(["certain", "likely", "possible", "unlikely"]).optional(),
	role: z.enum(["prime", "sub", "incumbent"]).optional(),
	teamingPartners: z.array(z.string()).optional(),
	intelligenceSource: z.string().optional(),
	notes: z.string().optional(),
});

type AddCompetitorToOpportunityInput = z.infer<typeof addCompetitorToOpportunitySchema>;

// ============================================================================
// Competitor CRUD Operations
// ============================================================================

/**
 * Create a new competitor record.
 */
export async function createCompetitor(
	input: CreateCompetitorInput
): Promise<ActionResult<Competitor>> {
	try {
		const validated = createCompetitorSchema.parse(input);
		const userContext = await requireCompetitiveContext(validated.organizationId);

		const [competitor] = await db
			.insert(competitors)
			.values({
				...validated,
				organizationId: organizationForInsert(validated.organizationId, userContext),
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		revalidatePath("/competitive");
		return { success: true, data: competitor };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues[0].message };
		}
		logger.error("[createCompetitor]", error);
		return { success: false, error: "Failed to create competitor" };
	}
}

/**
 * Update an existing competitor.
 */
export async function updateCompetitor(
	id: string,
	data: Partial<CreateCompetitorInput>
): Promise<ActionResult<Competitor>> {
	try {
		const userContext = await requireCompetitiveContext(data.organizationId);
		const existing = await db
			.select()
			.from(competitors)
			.where(and(eq(competitors.id, id), mutableOrganizationCondition(competitors.organizationId, userContext)))
			.limit(1);

		if (existing.length === 0) {
			return { success: false, error: "Competitor not found" };
		}

		const [updated] = await db
			.update(competitors)
			.set({
				...data,
				organizationId: organizationForInsert(data.organizationId, userContext),
				updatedAt: new Date(),
			})
			.where(and(eq(competitors.id, id), mutableOrganizationCondition(competitors.organizationId, userContext)))
			.returning();

		revalidatePath("/competitive");
		return { success: true, data: updated };
	} catch (error) {
		logger.error("[updateCompetitor]", error);
		return { success: false, error: "Failed to update competitor" };
	}
}

/**
 * Delete a competitor record.
 */
export async function deleteCompetitor(
	id: string
): Promise<ActionResult<{ deleted: boolean }>> {
	try {
		const userContext = await requireCompetitiveContext();
		const deleted = await db
			.delete(competitors)
			.where(and(eq(competitors.id, id), mutableOrganizationCondition(competitors.organizationId, userContext)))
			.returning();

		if (deleted.length === 0) {
			return { success: false, error: "Competitor not found" };
		}

		revalidatePath("/competitive");
		return { success: true, data: { deleted: true } };
	} catch (error) {
		logger.error("[deleteCompetitor]", error);
		return { success: false, error: "Failed to delete competitor" };
	}
}

/**
 * Get a competitor by ID.
 */
export async function getCompetitor(
	id: string
): Promise<ActionResult<Competitor>> {
	try {
		const userContext = await requireCompetitiveContext();
		const [competitor] = await db
			.select()
			.from(competitors)
			.where(and(eq(competitors.id, id), visibleOrganizationCondition(competitors.organizationId, userContext)))
			.limit(1);

		if (!competitor) {
			return { success: false, error: "Competitor not found" };
		}

		return { success: true, data: competitor };
	} catch (error) {
		logger.error("[getCompetitor]", error);
		return { success: false, error: "Failed to retrieve competitor" };
	}
}

/**
 * List all competitors, optionally filtered by organization.
 */
export async function listCompetitors(
	organizationId?: string
): Promise<ActionResult<Competitor[]>> {
	try {
		const userContext = await requireCompetitiveContext(organizationId);
		const result = organizationId
			? await db
					.select()
					.from(competitors)
					.where(eq(competitors.organizationId, organizationId))
					.orderBy(asc(competitors.name))
			: await db
					.select()
					.from(competitors)
					.where(visibleOrganizationCondition(competitors.organizationId, userContext))
					.orderBy(asc(competitors.name));

		return { success: true, data: result };
	} catch (error) {
		logger.error("[listCompetitors]", error);
		return { success: false, error: "Failed to list competitors" };
	}
}

/**
 * Search competitors with flexible filters.
 */
export async function searchCompetitors(
	query: string,
	filters?: CompetitorFilters
): Promise<ActionResult<Competitor[]>> {
	try {
		const userContext = await requireCompetitiveContext();
		const conditions = [visibleOrganizationCondition(competitors.organizationId, userContext)];

		// Text search on name and description
		if (query && query.trim()) {
			const searchPattern = `%${query.toLowerCase()}%`;
			conditions.push(
				sql`(LOWER(${competitors.name}) LIKE ${searchPattern} OR LOWER(${competitors.description}) LIKE ${searchPattern})`
			);
		}

		// Apply filters
		if (filters?.competitorType) {
			conditions.push(eq(competitors.competitorType, filters.competitorType));
		}

		if (filters?.sizeStandard) {
			conditions.push(eq(competitors.sizeStandard, filters.sizeStandard));
		}

		if (filters?.hasCapability) {
			conditions.push(
				sql`${competitors.capabilities}::jsonb @> ${JSON.stringify([{ area: filters.hasCapability }])}::jsonb`
			);
		}

		if (filters?.hasCertification) {
			conditions.push(
				sql`${competitors.certifications}::jsonb ? ${filters.hasCertification}`
			);
		}

		const result = await db
			.select()
			.from(competitors)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(asc(competitors.name));

		return { success: true, data: result };
	} catch (error) {
		logger.error("[searchCompetitors]", error);
		return { success: false, error: "Failed to search competitors" };
	}
}

// ============================================================================
// Discriminator CRUD Operations
// ============================================================================

/**
 * Create a new discriminator.
 */
export async function createDiscriminator(
	input: CreateDiscriminatorInput
): Promise<ActionResult<Discriminator>> {
	try {
		const validated = createDiscriminatorSchema.parse(input);
		const userContext = await requireCompetitiveContext(validated.organizationId);

		const [discriminator] = await db
			.insert(discriminators)
			.values({
				...validated,
				organizationId: organizationForInsert(validated.organizationId, userContext),
				isActive: true,
				useCount: 0,
				winCount: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		revalidatePath("/competitive/discriminators");
		return { success: true, data: discriminator };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues[0].message };
		}
		logger.error("[createDiscriminator]", error);
		return { success: false, error: "Failed to create discriminator" };
	}
}

/**
 * Update a discriminator.
 */
export async function updateDiscriminator(
	id: string,
	data: Partial<CreateDiscriminatorInput>
): Promise<ActionResult<Discriminator>> {
	try {
		const userContext = await requireCompetitiveContext(data.organizationId);
		const [updated] = await db
			.update(discriminators)
			.set({
				...data,
				organizationId: organizationForInsert(data.organizationId, userContext),
				updatedAt: new Date(),
			})
			.where(and(eq(discriminators.id, id), mutableOrganizationCondition(discriminators.organizationId, userContext)))
			.returning();

		if (!updated) {
			return { success: false, error: "Discriminator not found" };
		}

		revalidatePath("/competitive/discriminators");
		return { success: true, data: updated };
	} catch (error) {
		logger.error("[updateDiscriminator]", error);
		return { success: false, error: "Failed to update discriminator" };
	}
}

/**
 * Delete a discriminator.
 */
export async function deleteDiscriminator(
	id: string
): Promise<ActionResult<{ deleted: boolean }>> {
	try {
		const userContext = await requireCompetitiveContext();
		const deleted = await db
			.delete(discriminators)
			.where(and(eq(discriminators.id, id), mutableOrganizationCondition(discriminators.organizationId, userContext)))
			.returning();

		if (deleted.length === 0) {
			return { success: false, error: "Discriminator not found" };
		}

		revalidatePath("/competitive/discriminators");
		return { success: true, data: { deleted: true } };
	} catch (error) {
		logger.error("[deleteDiscriminator]", error);
		return { success: false, error: "Failed to delete discriminator" };
	}
}

/**
 * List discriminators with optional filters.
 */
export async function listDiscriminators(
	filters?: DiscriminatorFilters
): Promise<ActionResult<Discriminator[]>> {
	try {
		const userContext = await requireCompetitiveContext();
		const conditions = [visibleOrganizationCondition(discriminators.organizationId, userContext)];

		if (filters?.type) {
			conditions.push(eq(discriminators.discriminatorType, filters.type));
		}

		if (filters?.isActive !== undefined) {
			conditions.push(eq(discriminators.isActive, filters.isActive));
		}

		if (filters?.effectiveAgainst) {
			conditions.push(
				sql`${discriminators.effectiveAgainst}::jsonb ? ${filters.effectiveAgainst}`
			);
		}

		const result = await db
			.select()
			.from(discriminators)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(discriminators.effectivenessScore), asc(discriminators.statement));

		return { success: true, data: result };
	} catch (error) {
		logger.error("[listDiscriminators]", error);
		return { success: false, error: "Failed to list discriminators" };
	}
}

/**
 * Record discriminator usage and update effectiveness tracking.
 */
export async function recordDiscriminatorUsage(
	id: string,
	won: boolean
): Promise<ActionResult<Discriminator>> {
	try {
		const userContext = await requireCompetitiveContext();
		const [existing] = await db
			.select()
			.from(discriminators)
			.where(and(eq(discriminators.id, id), mutableOrganizationCondition(discriminators.organizationId, userContext)))
			.limit(1);

		if (!existing) {
			return { success: false, error: "Discriminator not found" };
		}

		const newUseCount = (existing.useCount ?? 0) + 1;
		const newWinCount = (existing.winCount ?? 0) + (won ? 1 : 0);
		const effectivenessScore = newUseCount > 0 ? (newWinCount / newUseCount) * 100 : null;

		const [updated] = await db
			.update(discriminators)
			.set({
				useCount: newUseCount,
				winCount: newWinCount,
				effectivenessScore,
				updatedAt: new Date(),
			})
			.where(and(eq(discriminators.id, id), mutableOrganizationCondition(discriminators.organizationId, userContext)))
			.returning();

		return { success: true, data: updated };
	} catch (error) {
		logger.error("[recordDiscriminatorUsage]", error);
		return { success: false, error: "Failed to record discriminator usage" };
	}
}

// ============================================================================
// Ghost Themes Operations
// ============================================================================

/**
 * Create a new ghost theme for a competitor weakness.
 */
export async function createGhostTheme(
	input: CreateGhostThemeInput
): Promise<ActionResult<GhostTheme>> {
	try {
		const validated = createGhostThemeSchema.parse(input);
		const userContext = await requireCompetitiveContext(validated.organizationId);

		// Verify competitor exists
		const [competitor] = await db
			.select()
			.from(competitors)
			.where(and(eq(competitors.id, validated.competitorId), visibleOrganizationCondition(competitors.organizationId, userContext)))
			.limit(1);

		if (!competitor) {
			return { success: false, error: "Competitor not found" };
		}

		const [ghostTheme] = await db
			.insert(ghostThemes)
			.values({
				...validated,
				organizationId: organizationForInsert(validated.organizationId, userContext),
				isEthical: true,
				useCount: 0,
				createdAt: new Date(),
			})
			.returning();

		revalidatePath("/competitive/ghost-themes");
		return { success: true, data: ghostTheme };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues[0].message };
		}
		logger.error("[createGhostTheme]", error);
		return { success: false, error: "Failed to create ghost theme" };
	}
}

/**
 * List ghost themes, optionally filtered by competitor.
 */
export async function listGhostThemes(
	competitorId?: string
): Promise<ActionResult<GhostTheme[]>> {
	try {
		const userContext = await requireCompetitiveContext();
		const result = competitorId
			? await db
					.select()
					.from(ghostThemes)
					.where(and(eq(ghostThemes.competitorId, competitorId), visibleOrganizationCondition(ghostThemes.organizationId, userContext)))
					.orderBy(desc(ghostThemes.useCount))
			: await db
					.select()
					.from(ghostThemes)
					.where(visibleOrganizationCondition(ghostThemes.organizationId, userContext))
					.orderBy(desc(ghostThemes.useCount));

		return { success: true, data: result };
	} catch (error) {
		logger.error("[listGhostThemes]", error);
		return { success: false, error: "Failed to list ghost themes" };
	}
}

/**
 * Generate ethical ghost theme language using AI.
 * Creates proposal-ready language that highlights a competitor weakness
 * without naming the competitor directly.
 */
export async function generateGhostTheme(
	competitorId: string,
	weakness: string
): Promise<ActionResult<string>> {
	try {
		const userContext = await requireCompetitiveContext();
		// Validate competitor exists
		const [competitor] = await db
			.select()
			.from(competitors)
			.where(and(eq(competitors.id, competitorId), visibleOrganizationCondition(competitors.organizationId, userContext)))
			.limit(1);

		if (!competitor) {
			return { success: false, error: "Competitor not found" };
		}

		const manager = getProviderManager();
		await manager.initialize();

		if (!(await manager.isAvailable())) {
			// Fallback to template-based ghost language
			const fallbackLanguage = generateFallbackGhostLanguage(weakness);
			return { success: true, data: fallbackLanguage };
		}

		const systemPrompt = `You are an expert proposal writer specializing in competitive differentiation.
Your task is to create "ghost theme" language - ethical, professional statements that highlight
a competitor's weakness WITHOUT naming them or being unethical.

Guidelines:
1. Never name or directly identify the competitor
2. Focus on positive aspects of what we offer that address the weakness
3. Use subtle, professional language that evaluators will understand
4. Avoid negative or disparaging language
5. Make statements that are verifiable about our capabilities
6. Ensure the language could apply to any competitor with this weakness

Output ONLY the ghost theme language (2-3 sentences). No explanations or preamble.`;

		const userPrompt = `Create ghost theme language to address this competitor weakness:
"${weakness}"

The competitor is in the ${competitor.competitorType || "general"} category.
${competitor.sizeStandard ? `They are a ${competitor.sizeStandard} business.` : ""}

Generate professional, ethical language that subtly highlights why our approach is superior
in this area without naming or directly attacking the competitor.`;

		const response = await manager.complete({
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPrompt },
			],
			temperature: 0.7,
			maxTokens: 300,
		});

		const ghostLanguage = response.content.trim();
		return { success: true, data: ghostLanguage || generateFallbackGhostLanguage(weakness) };
	} catch (error) {
		logger.error("[generateGhostTheme]", error);
		return { success: false, error: "Failed to generate ghost theme language" };
	}
}

/**
 * Fallback ghost language generation when AI is unavailable.
 */
function generateFallbackGhostLanguage(weakness: string): string {
	const weaknessLower = weakness.toLowerCase();

	const templates: Record<string, string> = {
		experience: "Our team brings extensive, proven experience in this domain, with documented success on comparable projects that demonstrates deep understanding of the challenges and solutions required.",
		capacity: "We maintain dedicated resources and scalable capacity to ensure full commitment to this engagement, with no competing priorities that could impact delivery.",
		technology: "Our approach leverages modern, proven technology solutions with established track records, avoiding experimental approaches that could introduce unnecessary risk.",
		staffing: "Our proposed team is fully committed and available for this engagement, with stable staffing that ensures continuity throughout the project lifecycle.",
		communication: "We prioritize transparent, frequent communication with established protocols that ensure stakeholders remain fully informed at all stages.",
		schedule: "Our proven project management methodology emphasizes realistic scheduling, proactive risk management, and maintaining schedule fidelity through disciplined execution.",
		quality: "We maintain rigorous quality assurance processes with documented metrics and continuous improvement practices that ensure consistent, high-quality deliverables.",
		cost: "Our pricing reflects a sustainable business model that enables us to invest in quality resources, maintain capability, and deliver exceptional value throughout the engagement.",
	};

	// Find matching template based on weakness keywords
	for (const [key, template] of Object.entries(templates)) {
		if (weaknessLower.includes(key)) {
			return template;
		}
	}

	// Default template
	return "Our approach emphasizes the qualities and capabilities most critical to project success, backed by documented evidence and verifiable past performance that demonstrates our commitment to excellence.";
}

// ============================================================================
// Opportunity Intelligence Operations
// ============================================================================

/**
 * Identify likely competitors for an opportunity using capability matching and AI analysis.
 */
export async function identifyLikelyCompetitors(
	opportunityId: string
): Promise<ActionResult<CompetitorMatch[]>> {
	try {
		const userContext = await requireCompetitiveContext();

		// Fetch opportunity details
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(assignedOpportunityByIdCondition(opportunityId, userContext))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		// Fetch all competitors
		const allCompetitors = await db
			.select()
			.from(competitors)
			.where(visibleOrganizationCondition(competitors.organizationId, userContext))
			.orderBy(asc(competitors.name));

		if (allCompetitors.length === 0) {
			return { success: true, data: [] };
		}

		// Get existing competitor-opportunity links
		const existingLinks = await db
			.select()
			.from(competitorOpportunities)
			.where(competitorOpportunityByOpportunityCondition(opportunityId, userContext));

		const existingCompetitorIds = new Set(existingLinks.map(l => l.competitorId));

		// Calculate match scores for each competitor
		const matches: CompetitorMatch[] = [];

		for (const competitor of allCompetitors) {
			const matchResult = calculateCompetitorMatchScore(opportunity, competitor);

			if (matchResult.score >= 30) { // Minimum threshold
				const existingLink = existingLinks.find(l => l.competitorId === competitor.id);

				matches.push({
					competitor,
					likelihoodScore: matchResult.score,
					matchReasons: matchResult.reasons,
					role: existingLink?.role as "prime" | "sub" | "incumbent" || matchResult.suggestedRole,
				});
			}
		}

		// Sort by likelihood score descending
		matches.sort((a, b) => b.likelihoodScore - a.likelihoodScore);

		// Enhance with AI analysis if available
		const manager = getProviderManager();
		await manager.initialize();

		if (await manager.isAvailable() && matches.length > 0) {
			try {
				const enhancedMatches = await enhanceCompetitorMatchesWithAI(
					opportunity,
					matches.slice(0, 10) // Top 10 for AI analysis
				);
				return { success: true, data: enhancedMatches };
			} catch (aiError) {
				logger.warn("[identifyLikelyCompetitors] AI enhancement failed:", aiError);
			}
		}

		return { success: true, data: matches.slice(0, 15) }; // Return top 15
	} catch (error) {
		logger.error("[identifyLikelyCompetitors]", error);
		return { success: false, error: "Failed to identify competitors" };
	}
}

/**
 * Calculate match score between opportunity and competitor using heuristics.
 */
function calculateCompetitorMatchScore(
	opportunity: typeof opportunities.$inferSelect,
	competitor: Competitor
): { score: number; reasons: string[]; suggestedRole: "prime" | "sub" | "incumbent" } {
	let score = 0;
	const reasons: string[] = [];

	// NAICS code matching (high weight)
	const oppMetadata = opportunity.metadata as Record<string, unknown> | null;
	const oppNaics = oppMetadata?.naicsCodes as string[] || [];
	const competitorNaics = competitor.naicsCodes || [];

	if (oppNaics.length > 0 && competitorNaics.length > 0) {
		const naicsMatch = oppNaics.some(n => competitorNaics.includes(n));
		if (naicsMatch) {
			score += 25;
			reasons.push("NAICS code match");
		}
	}

	// Contract vehicle matching
	const oppVehicle = oppMetadata?.contractVehicle as string | undefined;
	const competitorVehicles = competitor.contractVehicles || [];

	if (oppVehicle && competitorVehicles.includes(oppVehicle)) {
		score += 20;
		reasons.push(`Has ${oppVehicle} contract vehicle`);
	}

	// Category/capability matching
	const oppCategory = opportunity.category?.toLowerCase() || "";
	const competitorCapabilities = competitor.capabilities || [];

	for (const cap of competitorCapabilities) {
		if (cap.area.toLowerCase().includes(oppCategory) || oppCategory.includes(cap.area.toLowerCase())) {
			if (cap.strength === "strong") {
				score += 20;
				reasons.push(`Strong capability in ${cap.area}`);
			} else if (cap.strength === "moderate") {
				score += 10;
				reasons.push(`Moderate capability in ${cap.area}`);
			}
			break;
		}
	}

	// Geographic matching
	const oppRegion = opportunity.countryRegion?.toLowerCase() || "";
	const competitorDescription = competitor.description?.toLowerCase() || "";

	if (oppRegion && competitorDescription.includes(oppRegion)) {
		score += 10;
		reasons.push(`Active in ${opportunity.countryRegion}`);
	}

	// Size standard matching (for set-asides)
	const oppSize = oppMetadata?.setAside as string | undefined;
	if (oppSize && competitor.sizeStandard) {
		const sizeMatch = oppSize.toLowerCase().includes(competitor.sizeStandard.toLowerCase());
		if (sizeMatch) {
			score += 15;
			reasons.push(`Qualifies for ${oppSize} set-aside`);
		}
	}

	// Historical win rate with this organization
	const competitorWins = competitor.winCount || 0;
	const competitorLosses = competitor.lossCount || 0;
	const totalHistory = competitorWins + competitorLosses;

	if (totalHistory >= 3) {
		const winRate = competitorWins / totalHistory;
		if (winRate >= 0.5) {
			score += 15;
			reasons.push(`High win rate (${Math.round(winRate * 100)}%)`);
		}
	}

	// Certifications matching
	const oppCerts = oppMetadata?.requiredCertifications as string[] || [];
	const competitorCerts = competitor.certifications || [];

	if (oppCerts.length > 0 && competitorCerts.length > 0) {
		const certMatches = oppCerts.filter(c => competitorCerts.includes(c)).length;
		if (certMatches > 0) {
			score += 10 * certMatches;
			reasons.push(`Has ${certMatches} required certification(s)`);
		}
	}

	// Determine suggested role
	let suggestedRole: "prime" | "sub" | "incumbent" = "prime";

	if (competitor.competitorType === "sub") {
		suggestedRole = "sub";
	} else if (competitor.competitorType === "both" && score < 50) {
		suggestedRole = "sub";
	}

	// Check if they're likely the incumbent (simplified check)
	if (competitor.name && opportunity.organization) {
		const recentWins = competitor.winCount || 0;
		if (recentWins >= 2) {
			suggestedRole = "incumbent";
			if (!reasons.includes("Likely incumbent")) {
				score += 10;
				reasons.push("Likely incumbent based on win history");
			}
		}
	}

	return { score: Math.min(100, score), reasons, suggestedRole };
}

/**
 * Enhance competitor matches with AI analysis.
 */
async function enhanceCompetitorMatchesWithAI(
	opportunity: typeof opportunities.$inferSelect,
	matches: CompetitorMatch[]
): Promise<CompetitorMatch[]> {
	const manager = getProviderManager();

	const competitorSummaries = matches.map(m => ({
		name: m.competitor.name,
		capabilities: m.competitor.capabilities?.map(c => c.area).join(", ") || "Unknown",
		strengths: m.competitor.strengths?.join(", ") || "Unknown",
		currentScore: m.likelihoodScore,
		reasons: m.matchReasons,
	}));

	const systemPrompt = `You are a competitive intelligence analyst for government contracting.
Analyze the likelihood of competitors bidding on an opportunity.

Output as JSON array with this structure:
[
  {
    "name": "<competitor name>",
    "adjustedScore": <number 0-100>,
    "additionalReasons": ["<reason1>", "<reason2>"],
    "role": "prime" | "sub" | "incumbent"
  }
]

Consider:
1. Alignment between competitor capabilities and opportunity requirements
2. Historical bidding patterns
3. Strategic fit
4. Market positioning

Only output valid JSON.`;

	const userPrompt = `Analyze competitor likelihood for this opportunity:

**Opportunity:**
- Title: ${opportunity.title}
- Category: ${opportunity.category || "Not specified"}
- Budget: ${opportunity.budgetValue || "Not specified"}
- Organization: ${opportunity.organization || "Not specified"}
- Requirements: ${opportunity.keyRequirements?.substring(0, 500) || "Not specified"}

**Potential Competitors (with initial scores):**
${JSON.stringify(competitorSummaries, null, 2)}

Provide refined likelihood scores and any additional reasons.`;

	try {
		const response = await manager.complete({
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPrompt },
			],
			temperature: 0.3,
			maxTokens: 1500,
		});

		const jsonMatch = response.content.match(/\[[\s\S]*\]/);
		if (!jsonMatch) {
			return matches;
		}

		const aiAnalysis = JSON.parse(jsonMatch[0]) as Array<{
			name: string;
			adjustedScore: number;
			additionalReasons: string[];
			role: "prime" | "sub" | "incumbent";
		}>;

		// Merge AI analysis with original matches
		return matches.map(match => {
			const aiMatch = aiAnalysis.find(a => a.name === match.competitor.name);
			if (aiMatch) {
				return {
					...match,
					likelihoodScore: Math.round((match.likelihoodScore + aiMatch.adjustedScore) / 2),
					matchReasons: [...match.matchReasons, ...aiMatch.additionalReasons],
					role: aiMatch.role,
				};
			}
			return match;
		}).sort((a, b) => b.likelihoodScore - a.likelihoodScore);
	} catch (error) {
		logger.warn("[enhanceCompetitorMatchesWithAI] Failed:", error);
		return matches;
	}
}

/**
 * Add a competitor to an opportunity's competitive landscape.
 */
export async function addCompetitorToOpportunity(
	input: AddCompetitorToOpportunityInput
): Promise<ActionResult<CompetitorOpportunity>> {
	try {
		const validated = addCompetitorToOpportunitySchema.parse(input);
		const userContext = await requireCompetitiveContext();

		const [opportunity] = await db
			.select({ id: opportunities.id })
			.from(opportunities)
			.where(assignedOpportunityByIdCondition(validated.opportunityId, userContext))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		const [competitor] = await db
			.select({ id: competitors.id })
			.from(competitors)
			.where(and(
				eq(competitors.id, validated.competitorId),
				visibleOrganizationCondition(competitors.organizationId, userContext)
			))
			.limit(1);

		if (!competitor) {
			return { success: false, error: "Competitor not found" };
		}

		// Check if link already exists
		const [existing] = await db
			.select()
			.from(competitorOpportunities)
			.where(competitorOpportunityByCompetitorAndOpportunityCondition(
				validated.competitorId,
				validated.opportunityId,
				userContext
			))
			.limit(1);

		if (existing) {
			return { success: false, error: "Competitor already linked to this opportunity" };
		}

		const [link] = await db
			.insert(competitorOpportunities)
			.values({
				...validated,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		revalidatePath(`/opportunities/${validated.opportunityId}`);
		return { success: true, data: link };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues[0].message };
		}
		logger.error("[addCompetitorToOpportunity]", error);
		return { success: false, error: "Failed to add competitor to opportunity" };
	}
}

/**
 * Update a competitor-opportunity link.
 */
export async function updateCompetitorOpportunity(
	id: string,
	data: Partial<AddCompetitorToOpportunityInput>
): Promise<ActionResult<CompetitorOpportunity>> {
	try {
		const userContext = await requireCompetitiveContext();

		if (data.opportunityId) {
			const [opportunity] = await db
				.select({ id: opportunities.id })
				.from(opportunities)
				.where(assignedOpportunityByIdCondition(data.opportunityId, userContext))
				.limit(1);

			if (!opportunity) {
				return { success: false, error: "Opportunity not found" };
			}
		}

		if (data.competitorId) {
			const [competitor] = await db
				.select({ id: competitors.id })
				.from(competitors)
				.where(and(
					eq(competitors.id, data.competitorId),
					visibleOrganizationCondition(competitors.organizationId, userContext)
				))
				.limit(1);

			if (!competitor) {
				return { success: false, error: "Competitor not found" };
			}
		}

		const [updated] = await db
			.update(competitorOpportunities)
			.set({
				...data,
				updatedAt: new Date(),
			})
			.where(competitorOpportunityByIdCondition(id, userContext))
			.returning();

		if (!updated) {
			return { success: false, error: "Competitor-opportunity link not found" };
		}

		revalidatePath(`/opportunities/${updated.opportunityId}`);
		return { success: true, data: updated };
	} catch (error) {
		logger.error("[updateCompetitorOpportunity]", error);
		return { success: false, error: "Failed to update competitor-opportunity link" };
	}
}

/**
 * List all competitors identified for a specific opportunity.
 */
export async function listCompetitorsForOpportunity(
	opportunityId: string
): Promise<ActionResult<CompetitorOpportunity[]>> {
	try {
		const userContext = await requireCompetitiveContext();
		const links = await db
			.select()
			.from(competitorOpportunities)
			.where(competitorOpportunityByOpportunityCondition(opportunityId, userContext))
			.orderBy(desc(competitorOpportunities.createdAt));

		return { success: true, data: links };
	} catch (error) {
		logger.error("[listCompetitorsForOpportunity]", error);
		return { success: false, error: "Failed to list competitors for opportunity" };
	}
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Generate comprehensive SWOT analysis for an opportunity.
 */
export async function generateSWOT(
	opportunityId: string
): Promise<ActionResult<SWOTAnalysis>> {
	try {
		const userContext = await requireCompetitiveContext();

		// Fetch opportunity details
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(assignedOpportunityByIdCondition(opportunityId, userContext))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		// Fetch identified competitors
		const competitorLinks = await db
			.select({
				link: competitorOpportunities,
				competitor: competitors,
			})
			.from(competitorOpportunities)
			.innerJoin(competitors, eq(competitorOpportunities.competitorId, competitors.id))
			.where(and(
				competitorOpportunityByOpportunityCondition(opportunityId, userContext),
				visibleOrganizationCondition(competitors.organizationId, userContext)
			));

		// Fetch company capabilities
		const [company] = await db
			.select()
			.from(companySettings)
			.where(mutableOrganizationCondition(companySettings.organizationId, userContext))
			.limit(1);

		const companyCapabilities = (company?.coreCapabilities as string[]) || [];
		const companyDifferentiators = (company?.differentiators as string[]) || [];
		const companyCertifications = (company?.certifications as string[]) || [];

		const manager = getProviderManager();
		await manager.initialize();
		const buildHeuristic = () => generateHeuristicSWOT(
			opportunity,
			competitorLinks.map(cl => cl.competitor),
			companyCapabilities,
			companyDifferentiators
		);
		let swotData: Omit<SWOTAnalysis, "id" | "opportunityId">;
		let analyzedBy = "ai-analysis";

		if (!(await manager.isAvailable())) {
			swotData = buildHeuristic();
			analyzedBy = "system-heuristic";
		} else {
			// AI-powered SWOT analysis
			const systemPrompt = `You are a strategic proposal consultant performing SWOT analysis for government/enterprise bids.

Output as JSON with this exact structure:
{
  "strengths": ["<strength1>", "<strength2>", ...],
  "weaknesses": ["<weakness1>", "<weakness2>", ...],
  "opportunities": ["<opportunity1>", "<opportunity2>", ...],
  "threats": ["<threat1>", "<threat2>", ...],
  "ourPosition": "<leader|challenger|follower|niche>",
  "winStrategy": "<2-3 sentence strategy>",
  "pricingStrategy": "<low_price|best_value|premium>",
  "aiInsights": [
    {"insight": "<insight>", "confidence": <0.0-1.0>, "source": "<source>"}
  ]
}

Be specific and actionable. Only output valid JSON.`;

			const competitorSummary = competitorLinks.map(cl => ({
				name: cl.competitor.name,
				role: cl.link.role,
				strengths: cl.competitor.strengths,
				weaknesses: cl.competitor.weaknesses,
				pricingTendency: cl.competitor.pricingTendency,
			}));

			const userPrompt = `Perform SWOT analysis for this opportunity:

**Opportunity:**
- Title: ${opportunity.title}
- Organization: ${opportunity.organization || "Not specified"}
- Budget: ${opportunity.budgetValue || "Not specified"}
- Category: ${opportunity.category || "Not specified"}
- Requirements: ${opportunity.keyRequirements?.substring(0, 800) || "Not specified"}
- Technical: ${opportunity.technicalRequirements?.substring(0, 500) || "Not specified"}

**Our Company:**
- Capabilities: ${companyCapabilities.join(", ") || "General consulting"}
- Differentiators: ${companyDifferentiators.join(", ") || "Not specified"}
- Certifications: ${companyCertifications.join(", ") || "None"}

**Known Competitors:**
${JSON.stringify(competitorSummary, null, 2)}

Provide comprehensive SWOT analysis as JSON.`;

			try {
				const response = await manager.complete({
					messages: [
						{ role: "system", content: systemPrompt },
						{ role: "user", content: userPrompt },
					],
					temperature: 0.4,
					maxTokens: 2000,
				});

				const jsonMatch = response.content.match(/\{[\s\S]*\}/);
				if (!jsonMatch) {
					throw new Error("Invalid JSON response from AI");
				}

				swotData = JSON.parse(jsonMatch[0]) as Omit<SWOTAnalysis, "id" | "opportunityId">;
			} catch (aiError) {
				logger.warn("[generateSWOT] AI analysis failed, using heuristic SWOT:", aiError);
				swotData = buildHeuristic();
				analyzedBy = "system-heuristic";
			}
		}

		// Save to database
		const [savedAnalysis] = await db
			.insert(competitiveAnalyses)
			.values({
				opportunityId,
				strengths: swotData.strengths,
				weaknesses: swotData.weaknesses,
				opportunityFactors: swotData.opportunities,
				threats: swotData.threats,
				ourPosition: swotData.ourPosition,
				winStrategy: swotData.winStrategy,
				pricingStrategy: swotData.pricingStrategy,
				aiInsights: swotData.aiInsights,
				analyzedAt: new Date(),
				analyzedBy,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		revalidatePath(`/opportunities/${opportunityId}`);

		return {
			success: true,
			data: {
				id: savedAnalysis.id,
				opportunityId,
				...swotData,
			},
		};
	} catch (error) {
		logger.error("[generateSWOT]", error);
		return { success: false, error: "Failed to generate SWOT analysis" };
	}
}

/**
 * Generate heuristic-based SWOT when AI is unavailable.
 */
function generateHeuristicSWOT(
	opportunity: typeof opportunities.$inferSelect,
	identifiedCompetitors: Competitor[],
	companyCapabilities: string[],
	companyDifferentiators: string[]
): Omit<SWOTAnalysis, "id"> {
	const strengths: string[] = [];
	const weaknesses: string[] = [];
	const opportunityFactors: string[] = [];
	const threats: string[] = [];

	// Analyze strengths based on capabilities
	if (companyCapabilities.length > 0) {
		strengths.push(`Core capabilities in ${companyCapabilities.slice(0, 3).join(", ")}`);
	}
	if (companyDifferentiators.length > 0) {
		strengths.push(`Key differentiators: ${companyDifferentiators.slice(0, 2).join(", ")}`);
	}

	// Analyze weaknesses based on opportunity requirements
	if (opportunity.budgetNumeric && opportunity.budgetNumeric > 1000000) {
		weaknesses.push("Large contract may stretch resources");
	}
	if (opportunity.daysLeft !== null && opportunity.daysLeft < 21) {
		weaknesses.push("Tight timeline for proposal development");
	}

	// Analyze opportunities
	if (opportunity.category) {
		opportunityFactors.push(`Growth opportunity in ${opportunity.category} sector`);
	}
	if (identifiedCompetitors.length < 3) {
		opportunityFactors.push("Limited known competition");
	}

	// Analyze threats from competitors
	for (const comp of identifiedCompetitors.slice(0, 3)) {
		if (comp.strengths && comp.strengths.length > 0) {
			threats.push(`${comp.name}: ${comp.strengths[0]}`);
		}
	}

	// Determine position and strategy
	const hasIncumbent = identifiedCompetitors.some(c => c.winCount && c.winCount > 2);
	const ourPosition = hasIncumbent ? "challenger" : "leader";
	const winStrategy = hasIncumbent
		? "Focus on innovation and improved approach to differentiate from incumbent"
		: "Emphasize proven capabilities and past performance to establish credibility";
	const pricingStrategy = opportunity.budgetNumeric && opportunity.budgetNumeric < 100000
		? "best_value"
		: "best_value";

	return {
		opportunityId: opportunity.id,
		strengths: strengths.length > 0 ? strengths : ["No company capability strengths recorded"],
		weaknesses: weaknesses.length > 0 ? weaknesses : ["Limited visibility into competition"],
		opportunities: opportunityFactors.length > 0 ? opportunityFactors : [`Evaluate ${opportunity.title} for strategic fit before pursuit`],
		threats: threats.length > 0 ? threats : ["Unknown competitive landscape"],
		ourPosition,
		winStrategy,
		pricingStrategy,
		aiInsights: buildHeuristicSWOTInsights(
			opportunity,
			identifiedCompetitors,
			companyCapabilities,
			companyDifferentiators
		),
	};
}

function buildHeuristicSWOTInsights(
	opportunity: typeof opportunities.$inferSelect,
	identifiedCompetitors: Competitor[],
	companyCapabilities: string[],
	companyDifferentiators: string[]
): Array<{ insight: string; confidence: number; source: string }> {
	const insights: Array<{ insight: string; confidence: number; source: string }> = [];
	const opportunitySignals = [
		opportunity.category,
		opportunity.budgetValue,
		opportunity.keyRequirements,
		opportunity.daysLeft !== null && opportunity.daysLeft !== undefined ? String(opportunity.daysLeft) : null,
	].filter(Boolean).length;

	if (companyCapabilities.length > 0 || companyDifferentiators.length > 0) {
		const signalCount = companyCapabilities.length + companyDifferentiators.length;
		insights.push({
			insight: `Company evidence includes ${companyCapabilities.length} recorded capability signal${companyCapabilities.length === 1 ? "" : "s"} and ${companyDifferentiators.length} differentiator signal${companyDifferentiators.length === 1 ? "" : "s"} for this SWOT.`,
			confidence: boundedHeuristicConfidence(0.45 + Math.min(0.25, signalCount * 0.05)),
			source: "company-capability-evidence",
		});
	} else {
		insights.push({
			insight: "No company capability or differentiator evidence is recorded; validate strengths before using this SWOT in a capture decision.",
			confidence: 0.4,
			source: "company-capability-gap",
		});
	}

	if (identifiedCompetitors.length > 0) {
		const competitorEvidenceCount = identifiedCompetitors.filter(comp =>
			(comp.strengths && comp.strengths.length > 0) ||
			(comp.weaknesses && comp.weaknesses.length > 0) ||
			comp.pricingTendency ||
			(comp.winCount !== null && comp.winCount !== undefined)
		).length;
		insights.push({
			insight: `Competitive threat assessment uses ${identifiedCompetitors.length} linked competitor${identifiedCompetitors.length === 1 ? "" : "s"}, including ${competitorEvidenceCount} with recorded strength, weakness, pricing, or win-history evidence.`,
			confidence: boundedHeuristicConfidence(0.45 + Math.min(0.25, identifiedCompetitors.length * 0.06) + Math.min(0.15, competitorEvidenceCount * 0.05)),
			source: "linked-competitor-evidence",
		});
	} else {
		insights.push({
			insight: "No linked competitors are recorded for this opportunity; competitor threats should be refreshed before final win strategy approval.",
			confidence: 0.35,
			source: "linked-competitor-gap",
		});
	}

	if (opportunitySignals > 0) {
		insights.push({
			insight: `Opportunity metadata contributes ${opportunitySignals} planning signal${opportunitySignals === 1 ? "" : "s"} across category, budget, requirements, and deadline pressure.`,
			confidence: boundedHeuristicConfidence(0.4 + Math.min(0.3, opportunitySignals * 0.08)),
			source: "opportunity-metadata-evidence",
		});
	}

	return insights;
}

function boundedHeuristicConfidence(value: number): number {
	return Math.round(Math.max(0.25, Math.min(0.85, value)) * 100) / 100;
}

function normalizeDiscriminatorText(value: string | null | undefined, fallback: string): string {
	const normalized = (value || fallback).replace(/\s+/g, " ").trim();
	return normalized.length > 0 ? normalized : fallback;
}

function classifyDiscriminatorWeakness(weakness: string): string {
	const normalized = weakness.toLowerCase();
	if (/\b(price|pricing|cost|rate|expensive|premium|budget)\b/.test(normalized)) {
		return "cost";
	}
	if (/\b(schedule|timeline|delay|late|slow|delivery)\b/.test(normalized)) {
		return "schedule";
	}
	if (/\b(team|staff|staffing|turnover|capacity|personnel)\b/.test(normalized)) {
		return "team";
	}
	if (/\b(past performance|incumbent|experience|reference)\b/.test(normalized)) {
		return "past_performance";
	}
	if (/\b(innovation|modern|automation|ai|technology)\b/.test(normalized)) {
		return "innovation";
	}
	if (/\b(management|governance|oversight|risk|quality)\b/.test(normalized)) {
		return "approach";
	}
	return "capability";
}

function discriminatorFocusForType(type: string): string {
	if (type === "cost") return "cost-disciplined";
	if (type === "schedule") return "schedule-assured";
	if (type === "team") return "staffing-resilient";
	if (type === "past_performance") return "past-performance-backed";
	if (type === "innovation") return "modernization-focused";
	if (type === "approach") return "governance-led";
	return "capability-proven";
}

function buildDeterministicDiscriminatorSuggestions(
	opportunity: typeof opportunities.$inferSelect,
	identifiedCompetitors: Competitor[],
	existingDiscriminators: Discriminator[]
): DiscriminatorSuggestion[] {
	const opportunityTitle = normalizeDiscriminatorText(opportunity.title, "this opportunity");
	const requirementText = normalizeDiscriminatorText(opportunity.keyRequirements, "");
	const existingStatements = new Set(
		existingDiscriminators.map((disc) => normalizeDiscriminatorText(disc.statement, "").toLowerCase())
	);
	const suggestions: DiscriminatorSuggestion[] = [];
	const seenStatements = new Set(existingStatements);

	for (const competitor of identifiedCompetitors) {
		const weaknesses = (competitor.weaknesses || [])
			.map((weakness) => normalizeDiscriminatorText(weakness, ""))
			.filter(Boolean)
			.slice(0, 3);

		for (const weakness of weaknesses) {
			const type = classifyDiscriminatorWeakness(weakness);
			const focus = discriminatorFocusForType(type);
			const statement = `Our ${focus} approach directly mitigates ${competitor.name}'s ${weakness.toLowerCase()} risk for ${opportunityTitle}.`;
			const normalizedStatement = statement.toLowerCase();
			if (seenStatements.has(normalizedStatement)) {
				continue;
			}
			seenStatements.add(normalizedStatement);
			const requirementBoost = requirementText.length > 0 ? 0.06 : 0;
			suggestions.push({
				statement,
				type,
				effectiveAgainst: [competitor.id],
				confidence: boundedHeuristicConfidence(0.56 + requirementBoost + Math.min(0.12, weaknesses.length * 0.03)),
				rationale: `Deterministic fallback derived from ${competitor.name}'s recorded weakness "${weakness}"${requirementText ? " and the opportunity requirements" : ""}.`,
				isNew: true,
			});
			if (suggestions.length >= 5) {
				return suggestions;
			}
		}
	}

	return suggestions;
}

/**
 * Suggest discriminators for a specific opportunity based on competitive landscape.
 */
export async function suggestDiscriminators(
	opportunityId: string
): Promise<ActionResult<DiscriminatorSuggestion[]>> {
	try {
		const userContext = await requireCompetitiveContext();

		// Fetch opportunity
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(assignedOpportunityByIdCondition(opportunityId, userContext))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		// Fetch identified competitors
		const competitorLinks = await db
			.select({
				competitor: competitors,
			})
			.from(competitorOpportunities)
			.innerJoin(competitors, eq(competitorOpportunities.competitorId, competitors.id))
			.where(and(
				competitorOpportunityByOpportunityCondition(opportunityId, userContext),
				visibleOrganizationCondition(competitors.organizationId, userContext)
			));

		const competitorIds = competitorLinks.map(cl => cl.competitor.id);

		// Fetch existing discriminators
		const existingDiscriminators = await db
			.select()
			.from(discriminators)
			.where(and(
				eq(discriminators.isActive, true),
				visibleOrganizationCondition(discriminators.organizationId, userContext)
			));

		// Find discriminators effective against identified competitors
		const relevantDiscriminators = existingDiscriminators.filter(d => {
			const effectiveAgainst = d.effectiveAgainst || [];
			return effectiveAgainst.some(id => competitorIds.includes(id));
		});

		const suggestions: DiscriminatorSuggestion[] = [];

		// Add existing relevant discriminators
		for (const disc of relevantDiscriminators) {
			const effectivenessScore = disc.effectivenessScore || 50;
			suggestions.push({
				discriminator: disc,
				statement: disc.statement,
				type: disc.discriminatorType || "capability",
				effectiveAgainst: (disc.effectiveAgainst || []).filter(id => competitorIds.includes(id)),
				confidence: effectivenessScore / 100,
				rationale: `Historical effectiveness: ${Math.round(effectivenessScore)}%`,
				isNew: false,
			});
		}

		// Use AI to suggest new discriminators
		const manager = getProviderManager();
		await manager.initialize();
		let aiSuggestionCount = 0;

		if (await manager.isAvailable()) {
			try {
				const aiSuggestions = await generateAIDiscriminatorSuggestions(
					opportunity,
					competitorLinks.map(cl => cl.competitor),
					existingDiscriminators
				);
				aiSuggestionCount = aiSuggestions.length;
				suggestions.push(...aiSuggestions);
			} catch (error) {
				logger.warn("[suggestDiscriminators] AI suggestion failed:", error);
			}
		}

		if (aiSuggestionCount === 0) {
			const deterministicSuggestions = buildDeterministicDiscriminatorSuggestions(
				opportunity,
				competitorLinks.map(cl => cl.competitor),
				existingDiscriminators
			);
			const currentStatements = new Set(suggestions.map((suggestion) => suggestion.statement.toLowerCase()));
			for (const suggestion of deterministicSuggestions) {
				if (!currentStatements.has(suggestion.statement.toLowerCase())) {
					suggestions.push(suggestion);
					currentStatements.add(suggestion.statement.toLowerCase());
				}
			}
		}

		// Sort by confidence
		suggestions.sort((a, b) => b.confidence - a.confidence);

		return { success: true, data: suggestions.slice(0, 10) };
	} catch (error) {
		logger.error("[suggestDiscriminators]", error);
		return { success: false, error: "Failed to suggest discriminators" };
	}
}

/**
 * Generate AI-powered discriminator suggestions.
 */
async function generateAIDiscriminatorSuggestions(
	opportunity: typeof opportunities.$inferSelect,
	identifiedCompetitors: Competitor[],
	existingDiscriminators: Discriminator[]
): Promise<DiscriminatorSuggestion[]> {
	const manager = getProviderManager();

	const systemPrompt = `You are a proposal strategist specializing in competitive differentiation.
Suggest new discriminator statements that would be effective for this opportunity.

Output as JSON array:
[
  {
    "statement": "<compelling discriminator statement>",
    "type": "capability|experience|approach|team|cost|schedule|innovation|past_performance",
    "effectiveAgainst": ["<competitor name>"],
    "confidence": <0.0-1.0>,
    "rationale": "<why this discriminator would be effective>"
  }
]

Guidelines:
1. Be specific and quantifiable where possible
2. Focus on verifiable advantages
3. Target identified competitor weaknesses
4. Align with opportunity requirements

Only output valid JSON array.`;

	const competitorWeaknesses = identifiedCompetitors
		.filter(c => c.weaknesses && c.weaknesses.length > 0)
		.map(c => ({ name: c.name, weaknesses: c.weaknesses }));

	const existingStatements = existingDiscriminators.map(d => d.statement).join("\n- ");

	const userPrompt = `Suggest discriminators for this opportunity:

**Opportunity:**
- Title: ${opportunity.title}
- Category: ${opportunity.category || "Not specified"}
- Key Requirements: ${opportunity.keyRequirements?.substring(0, 500) || "Not specified"}

**Competitor Weaknesses:**
${JSON.stringify(competitorWeaknesses, null, 2)}

**Existing Discriminators (avoid duplicates):**
- ${existingStatements || "None"}

Suggest 3-5 new, unique discriminator statements.`;

	const response = await manager.complete({
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		temperature: 0.6,
		maxTokens: 1500,
	});

	const jsonMatch = response.content.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		return [];
	}

	const aiSuggestions = JSON.parse(jsonMatch[0]) as Array<{
		statement: string;
		type: string;
		effectiveAgainst: string[];
		confidence: number;
		rationale: string;
	}>;

	return aiSuggestions.map(s => ({
		statement: s.statement,
		type: s.type,
		effectiveAgainst: s.effectiveAgainst,
		confidence: s.confidence,
		rationale: s.rationale,
		isNew: true,
	}));
}

/**
 * Generate competitive comparison matrix for an opportunity.
 */
export async function generateCompetitiveMatrix(
	opportunityId: string
): Promise<ActionResult<CompetitiveMatrix>> {
	try {
		const userContext = await requireCompetitiveContext();

		// Fetch opportunity
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(assignedOpportunityByIdCondition(opportunityId, userContext))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		// Fetch identified competitors
		const competitorLinks = await db
			.select({
				link: competitorOpportunities,
				competitor: competitors,
			})
			.from(competitorOpportunities)
			.innerJoin(competitors, eq(competitorOpportunities.competitorId, competitors.id))
			.where(and(
				competitorOpportunityByOpportunityCondition(opportunityId, userContext),
				visibleOrganizationCondition(competitors.organizationId, userContext)
			));

		if (competitorLinks.length === 0) {
			return { success: false, error: "No competitors identified for this opportunity" };
		}

		// Fetch company info
		const [company] = await db
			.select()
			.from(companySettings)
			.where(mutableOrganizationCondition(companySettings.organizationId, userContext))
			.limit(1);

		// Define evaluation criteria based on opportunity type
		const criteria = defineEvaluationCriteria(opportunity);

		// Score competitors
		const competitorScores = competitorLinks.map(cl => {
			const scores = criteria.map(criterion => ({
				criterionName: criterion.name,
				score: scoreCompetitorOnCriterion(cl.competitor, criterion.name),
				notes: generateCompetitorCriterionNotes(cl.competitor, criterion.name),
			}));

			const totalScore = scores.reduce((sum, s) => {
				const criterion = criteria.find(c => c.name === s.criterionName);
				return sum + (s.score * (criterion?.weight || 0));
			}, 0);

			return {
				id: cl.competitor.id,
				name: cl.competitor.name,
				scores,
				totalScore: Math.round(totalScore * 10) / 10,
			};
		});

		// Score ourselves
		const ourScores = criteria.map(criterion => {
			const ourScore = scoreOurselvesOnCriterion(company, criterion.name);
			const competitorAvg = competitorScores.reduce((sum, c) => {
				const cScore = c.scores.find(s => s.criterionName === criterion.name);
				return sum + (cScore?.score || 0);
			}, 0) / competitorScores.length;

			const diff = ourScore - competitorAvg;
			let advantage: "strong" | "slight" | "neutral" | "disadvantage";
			if (diff >= 1) advantage = "strong";
			else if (diff >= 0.3) advantage = "slight";
			else if (diff >= -0.3) advantage = "neutral";
			else advantage = "disadvantage";

			return {
				criterionName: criterion.name,
				score: ourScore,
				notes: generateOurCriterionNotes(company, criterion.name),
				advantage,
			};
		});

		const ourTotalScore = ourScores.reduce((sum, s) => {
			const criterion = criteria.find(c => c.name === s.criterionName);
			return sum + (s.score * (criterion?.weight || 0));
		}, 0);

		return {
			success: true,
			data: {
				criteria,
				competitors: competitorScores.sort((a, b) => b.totalScore - a.totalScore),
				ourScores,
				ourTotalScore: Math.round(ourTotalScore * 10) / 10,
			},
		};
	} catch (error) {
		logger.error("[generateCompetitiveMatrix]", error);
		return { success: false, error: "Failed to generate competitive matrix" };
	}
}

/**
 * Define evaluation criteria based on opportunity characteristics.
 */
function defineEvaluationCriteria(
	opportunity: typeof opportunities.$inferSelect
): Array<{ name: string; weight: number }> {
	// Standard government RFP criteria
	const baseCriteria = [
		{ name: "Technical Approach", weight: 0.30 },
		{ name: "Past Performance", weight: 0.25 },
		{ name: "Management Approach", weight: 0.20 },
		{ name: "Price", weight: 0.25 },
	];

	// Adjust based on opportunity characteristics
	const oppMetadata = opportunity.metadata as Record<string, unknown> | null;
	const evaluationType = oppMetadata?.evaluationType as string | undefined;

	if (evaluationType === "lpta") {
		// Lowest Price Technically Acceptable
		return [
			{ name: "Technical Approach", weight: 0.20 },
			{ name: "Past Performance", weight: 0.15 },
			{ name: "Management Approach", weight: 0.15 },
			{ name: "Price", weight: 0.50 },
		];
	}

	if (evaluationType === "best_value") {
		return baseCriteria;
	}

	return baseCriteria;
}

/**
 * Score a competitor on a specific criterion.
 */
function scoreCompetitorOnCriterion(competitor: Competitor, criterion: string): number {
	const capabilities = competitor.capabilities || [];
	const strengths = competitor.strengths || [];
	const weaknesses = competitor.weaknesses || [];

	switch (criterion) {
		case "Technical Approach": {
			const strongCaps = capabilities.filter(c => c.strength === "strong").length;
			const totalCaps = capabilities.length;
			if (totalCaps === 0) return 3;
			return Math.min(5, 2 + (strongCaps / totalCaps) * 3);
		}
		case "Past Performance": {
			const wins = competitor.winCount || 0;
			const losses = competitor.lossCount || 0;
			const total = wins + losses;
			if (total === 0) return 3;
			const winRate = wins / total;
			return 2 + winRate * 3;
		}
		case "Management Approach": {
			const hasManagementStrength = strengths.some(s =>
				s.toLowerCase().includes("management") || s.toLowerCase().includes("team")
			);
			return hasManagementStrength ? 4 : 3;
		}
		case "Price": {
			switch (competitor.pricingTendency) {
				case "aggressive": return 5;
				case "moderate": return 3;
				case "premium": return 2;
				default: return 3;
			}
		}
		default:
			return 3;
	}
}

/**
 * Generate notes about a competitor's score on a criterion.
 */
function generateCompetitorCriterionNotes(competitor: Competitor, criterion: string): string {
	switch (criterion) {
		case "Technical Approach":
			return competitor.capabilities?.length
				? `${competitor.capabilities.length} known capabilities`
				: "Limited capability information";
		case "Past Performance":
			return competitor.winCount
				? `${competitor.winCount} wins, ${competitor.lossCount || 0} losses`
				: "No win/loss data available";
		case "Management Approach":
			return competitor.strengths?.some(s => s.toLowerCase().includes("management"))
				? "Known management strengths"
				: "Standard management approach";
		case "Price":
			return competitor.pricingTendency
				? `Tends toward ${competitor.pricingTendency} pricing`
				: "Pricing tendency unknown";
		default:
			return "";
	}
}

/**
 * Score ourselves on a specific criterion.
 */
function scoreOurselvesOnCriterion(
	company: typeof companySettings.$inferSelect | undefined,
	criterion: string
): number {
	if (!company) return 3;

	const capabilities = (company.coreCapabilities as string[]) || [];
	const differentiators = (company.differentiators as string[]) || [];

	switch (criterion) {
		case "Technical Approach":
			return Math.min(5, 3 + capabilities.length * 0.3);
		case "Past Performance":
			return company.pastPerformanceSummary ? 4 : 3;
		case "Management Approach":
			return differentiators.some(d => d.toLowerCase().includes("management")) ? 4 : 3.5;
		case "Price":
			return 3.5; // Assume competitive pricing
		default:
			return 3;
	}
}

/**
 * Generate notes about our score on a criterion.
 */
function generateOurCriterionNotes(
	company: typeof companySettings.$inferSelect | undefined,
	criterion: string
): string {
	if (!company) return "Company profile not configured";

	switch (criterion) {
		case "Technical Approach":
			return `${(company.coreCapabilities as string[])?.length || 0} documented capabilities`;
		case "Past Performance":
			return company.pastPerformanceSummary
				? "Documented past performance available"
				: "Past performance documentation needed";
		case "Management Approach":
			return "Standard management methodology";
		case "Price":
			return "Competitive pricing strategy";
		default:
			return "";
	}
}

/**
 * Suggest teaming partners to fill capability gaps.
 */
export async function suggestTeamingPartners(
	opportunityId: string
): Promise<ActionResult<TeamingSuggestion[]>> {
	try {
		const userContext = await requireCompetitiveContext();

		// Fetch opportunity
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(assignedOpportunityByIdCondition(opportunityId, userContext))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		// Fetch company capabilities
		const [company] = await db
			.select()
			.from(companySettings)
			.where(mutableOrganizationCondition(companySettings.organizationId, userContext))
			.limit(1);

		const ourCapabilities = (company?.coreCapabilities as string[]) || [];
		const ourCertifications = (company?.certifications as string[]) || [];

		// Identify gaps from opportunity requirements
		const gaps = identifyCapabilityGaps(opportunity, ourCapabilities, ourCertifications);

		if (gaps.length === 0) {
			return { success: true, data: [] };
		}

		// Search for potential partners
		const potentialPartners = await db
			.select()
			.from(partners)
			.where(eq(partners.status, "active"));

		// Also consider competitors who could be teaming partners
		const potentialCompetitorPartners = await db
			.select()
			.from(competitors)
			.where(and(
				visibleOrganizationCondition(competitors.organizationId, userContext),
				or(
					eq(competitors.competitorType, "sub"),
					eq(competitors.competitorType, "both")
				)
			));

		const suggestions: TeamingSuggestion[] = [];

		// Evaluate partners
		for (const partner of potentialPartners) {
			const partnerCapabilities = (partner.capabilities as string[]) || [];
			// Partners table uses coreCapabilities as text, extract capability areas
			const coreCapabilityText = partner.coreCapabilities || "";
			const coreCapsList = coreCapabilityText.split(/[,;]/).map(c => c.trim()).filter(Boolean);

			const gapsFilled = gaps.filter(gap =>
				partnerCapabilities.some(pc => pc.toLowerCase().includes(gap.toLowerCase())) ||
				coreCapsList.some(pc => pc.toLowerCase().includes(gap.toLowerCase()))
			);

			if (gapsFilled.length > 0) {
				suggestions.push({
					partnerId: partner.id,
					partnerName: partner.name,
					gapsFilled,
					rationale: `Can fill ${gapsFilled.length} capability gap(s): ${gapsFilled.join(", ")}`,
					relationshipType: determineRelationshipType(partner, opportunity),
					confidence: Math.min(0.9, 0.5 + gapsFilled.length * 0.1),
				});
			}
		}

		// Evaluate competitors as potential teaming partners
		for (const comp of potentialCompetitorPartners) {
			const compCapabilities = comp.capabilities?.map(c => c.area) || [];
			const compCertifications = comp.certifications || [];

			const gapsFilled = gaps.filter(gap =>
				compCapabilities.some(cc => cc.toLowerCase().includes(gap.toLowerCase())) ||
				compCertifications.some(cc => cc.toLowerCase().includes(gap.toLowerCase()))
			);

			if (gapsFilled.length > 0) {
				suggestions.push({
					partnerId: comp.id,
					partnerName: `${comp.name} (Competitor)`,
					gapsFilled,
					rationale: `Competitor with complementary capabilities: ${gapsFilled.join(", ")}`,
					relationshipType: "sub",
					confidence: Math.min(0.7, 0.3 + gapsFilled.length * 0.1),
				});
			}
		}

		// Sort by confidence and gaps filled
		suggestions.sort((a, b) => {
			if (b.confidence !== a.confidence) return b.confidence - a.confidence;
			return b.gapsFilled.length - a.gapsFilled.length;
		});

		if (suggestions.length === 0) {
			return { success: true, data: buildPartnerSourcingSuggestions(gaps) };
		}

		const coveredGaps = new Set(suggestions.flatMap((suggestion) => suggestion.gapsFilled));
		const uncoveredGaps = gaps.filter((gap) => !coveredGaps.has(gap));
		return {
			success: true,
			data: [
				...suggestions,
				...buildPartnerSourcingSuggestions(uncoveredGaps),
			].slice(0, 10),
		};
	} catch (error) {
		logger.error("[suggestTeamingPartners]", error);
		return { success: false, error: "Failed to suggest teaming partners" };
	}
}

/**
 * Identify capability gaps between opportunity requirements and our capabilities.
 */
function identifyCapabilityGaps(
	opportunity: typeof opportunities.$inferSelect,
	ourCapabilities: string[],
	ourCertifications: string[]
): string[] {
	const gaps: string[] = [];
	const ourCapabilitiesLower = ourCapabilities.map(c => c.toLowerCase());
	const ourCertsLower = ourCertifications.map(c => c.toLowerCase());

	// Parse requirements from opportunity
	const requirements = opportunity.keyRequirements || "";
	const techRequirements = opportunity.technicalRequirements || "";
	const allRequirements = `${requirements} ${techRequirements}`.toLowerCase();

	// Common capability keywords to check
	const capabilityKeywords = [
		"security", "cybersecurity", "cloud", "aws", "azure", "gcp",
		"data analytics", "machine learning", "ai", "agile", "devops",
		"system integration", "software development", "project management",
		"change management", "training", "help desk", "networking",
		"database", "oracle", "sap", "salesforce"
	];

	for (const keyword of capabilityKeywords) {
		if (allRequirements.includes(keyword)) {
			const hasCapability = ourCapabilitiesLower.some(c => c.includes(keyword));
			const hasCert = ourCertsLower.some(c => c.includes(keyword));

			if (!hasCapability && !hasCert) {
				gaps.push(keyword);
			}
		}
	}

	// Check for required certifications
	const oppMetadata = opportunity.metadata as Record<string, unknown> | null;
	const requiredCerts = (oppMetadata?.requiredCertifications as string[]) || [];

	for (const cert of requiredCerts) {
		if (!ourCertsLower.some(c => c.includes(cert.toLowerCase()))) {
			gaps.push(cert);
		}
	}

	return Array.from(new Set(gaps)); // Remove duplicates
}

/**
 * Determine the best relationship type for a teaming partner.
 */
function determineRelationshipType(
	partner: typeof partners.$inferSelect,
	opportunity: typeof opportunities.$inferSelect
): "sub" | "mentor_protege" | "jv" {
	const oppMetadata = opportunity.metadata as Record<string, unknown> | null;
	const setAside = oppMetadata?.setAside as string | undefined;
	const partnerType = partner.type; // Use 'type' field from partners schema

	// If set-aside and partner qualifies, consider mentor-protege
	if (setAside && setAside.toLowerCase().includes("8a")) {
		return "mentor_protege";
	}

	// Large contracts might benefit from JV
	const budget = opportunity.budgetNumeric;
	if (budget && budget > 5000000) {
		return "jv";
	}

	// Default to subcontractor
	return "sub";
}

// ============================================================================
// Win/Loss Tracking
// ============================================================================

/**
 * Track win/loss outcome against a competitor.
 */
export async function trackCompetitorWinLoss(
	competitorId: string,
	outcome: "win" | "loss",
	opportunityId: string,
	notes?: string
): Promise<ActionResult<Competitor>> {
	try {
		const userContext = await requireCompetitiveContext();
		const [opportunity] = await db
			.select({ id: opportunities.id })
			.from(opportunities)
			.where(assignedOpportunityByIdCondition(opportunityId, userContext))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		// Verify competitor exists
		const [competitor] = await db
			.select()
			.from(competitors)
			.where(and(eq(competitors.id, competitorId), mutableOrganizationCondition(competitors.organizationId, userContext)))
			.limit(1);

		if (!competitor) {
			return { success: false, error: "Competitor not found" };
		}

		// Update competitor win/loss counts
		const isWin = outcome === "win";
		const updateData: Partial<Competitor> = {
			updatedAt: new Date(),
		};

		if (isWin) {
			updateData.winsAgainstUs = (competitor.winsAgainstUs || 0) + 1;
			updateData.lossesToUs = competitor.lossesToUs; // Keep existing
		} else {
			updateData.lossesToUs = (competitor.lossesToUs || 0) + 1;
			updateData.winsAgainstUs = competitor.winsAgainstUs; // Keep existing
		}

		const [updated] = await db
			.update(competitors)
			.set(updateData)
			.where(and(eq(competitors.id, competitorId), mutableOrganizationCondition(competitors.organizationId, userContext)))
			.returning();

		// Update the competitor-opportunity link
		const [link] = await db
			.select()
			.from(competitorOpportunities)
			.where(competitorOpportunityByCompetitorAndOpportunityCondition(competitorId, opportunityId, userContext))
			.limit(1);

		if (link) {
			await db
				.update(competitorOpportunities)
				.set({
					outcome: isWin ? "lost" : "won", // From competitor's perspective
					outcomeNotes: notes,
					updatedAt: new Date(),
				})
				.where(competitorOpportunityByIdCondition(link.id, userContext));
		}

		revalidatePath("/competitive");
		revalidatePath(`/opportunities/${opportunityId}`);

		return { success: true, data: updated };
	} catch (error) {
		logger.error("[trackCompetitorWinLoss]", error);
		return { success: false, error: "Failed to track win/loss" };
	}
}

/**
 * Get comprehensive win/loss analysis against a competitor.
 */
export async function getWinLossAnalysis(
	competitorId: string
): Promise<ActionResult<WinLossAnalysis>> {
	try {
		const userContext = await requireCompetitiveContext();
		// Fetch competitor
		const [competitor] = await db
			.select()
			.from(competitors)
			.where(and(eq(competitors.id, competitorId), visibleOrganizationCondition(competitors.organizationId, userContext)))
			.limit(1);

		if (!competitor) {
			return { success: false, error: "Competitor not found" };
		}

		// Fetch all encounters with this competitor
		const encounters = await db
			.select({
				link: competitorOpportunities,
				opportunity: opportunities,
			})
			.from(competitorOpportunities)
			.innerJoin(opportunities, eq(competitorOpportunities.opportunityId, opportunities.id))
			.where(
				and(
					eq(competitorOpportunities.competitorId, competitorId),
					isNotNull(competitorOpportunities.outcome),
					assignedOpportunityExistsSql(competitorOpportunities.opportunityId, userContext)
				)
			);

		const ourWins = encounters.filter(e => e.link.outcome === "lost").length; // Competitor lost = we won
		const ourLosses = encounters.filter(e => e.link.outcome === "won").length; // Competitor won = we lost
		const totalEncounters = ourWins + ourLosses;
		const winRate = totalEncounters > 0 ? (ourWins / totalEncounters) * 100 : 0;

		// Analyze patterns
		const winPatterns: string[] = [];
		const lossPatterns: string[] = [];

		const wins = encounters.filter(e => e.link.outcome === "lost");
		const losses = encounters.filter(e => e.link.outcome === "won");

		// Analyze win patterns
		if (wins.length > 0) {
			const winCategories = wins.map(w => w.opportunity.category).filter(Boolean);
			const uniqueWinCategories = Array.from(new Set(winCategories));
			if (uniqueWinCategories.length > 0 && uniqueWinCategories.length <= wins.length / 2) {
				winPatterns.push(`Strong in ${uniqueWinCategories.slice(0, 2).join(", ")} categories`);
			}

			const avgWinBudget = wins.reduce((sum, w) => sum + (w.opportunity.budgetNumeric || 0), 0) / wins.length;
			if (avgWinBudget > 0) {
				winPatterns.push(`Average winning bid: $${Math.round(avgWinBudget).toLocaleString()}`);
			}
		}

		// Analyze loss patterns
		if (losses.length > 0) {
			const lossCategories = losses.map(l => l.opportunity.category).filter(Boolean);
			const uniqueLossCategories = Array.from(new Set(lossCategories));
			if (uniqueLossCategories.length > 0 && uniqueLossCategories.length <= losses.length / 2) {
				lossPatterns.push(`Weak against them in ${uniqueLossCategories.slice(0, 2).join(", ")} categories`);
			}

			const avgLossBudget = losses.reduce((sum, l) => sum + (l.opportunity.budgetNumeric || 0), 0) / losses.length;
			if (avgLossBudget > 0) {
				lossPatterns.push(`Average losing bid: $${Math.round(avgLossBudget).toLocaleString()}`);
			}
		}

		// Generate AI insights if available
		const aiInsights: string[] = [];
		const manager = getProviderManager();
		await manager.initialize();

		if (await manager.isAvailable() && totalEncounters >= 3) {
			try {
				const insights = await generateWinLossInsights(
					competitor,
					encounters,
					winRate
				);
				aiInsights.push(...insights);
			} catch (error) {
				logger.warn("[getWinLossAnalysis] AI insights failed:", error);
			}
		}

		// Add default insights if none from AI
		if (aiInsights.length === 0) {
			if (winRate >= 60) {
				aiInsights.push("Strong historical performance against this competitor");
			} else if (winRate <= 40) {
				aiInsights.push("Consider enhanced competitive strategy for future encounters");
			}
		}

		return {
			success: true,
			data: {
				competitorId,
				competitorName: competitor.name,
				totalEncounters,
				ourWins,
				ourLosses,
				winRate: Math.round(winRate * 10) / 10,
				winPatterns: winPatterns.length > 0 ? winPatterns : ["Insufficient data for pattern analysis"],
				lossPatterns: lossPatterns.length > 0 ? lossPatterns : ["Insufficient data for pattern analysis"],
				aiInsights,
			},
		};
	} catch (error) {
		logger.error("[getWinLossAnalysis]", error);
		return { success: false, error: "Failed to generate win/loss analysis" };
	}
}

/**
 * Generate AI-powered insights from win/loss data.
 */
async function generateWinLossInsights(
	competitor: Competitor,
	encounters: Array<{
		link: CompetitorOpportunity;
		opportunity: typeof opportunities.$inferSelect;
	}>,
	winRate: number
): Promise<string[]> {
	const manager = getProviderManager();

	const systemPrompt = `You are a competitive intelligence analyst.
Analyze win/loss data and provide 2-3 actionable insights.

Output as JSON array of strings:
["<insight1>", "<insight2>", "<insight3>"]

Be specific, actionable, and strategic. Only output valid JSON array.`;

	const encounterSummary = encounters.slice(0, 10).map(e => ({
		category: e.opportunity.category,
		budget: e.opportunity.budgetValue,
		outcome: e.link.outcome,
		notes: e.link.outcomeNotes,
	}));

	const userPrompt = `Analyze our performance against ${competitor.name}:

Win Rate: ${Math.round(winRate)}%

Recent Encounters:
${JSON.stringify(encounterSummary, null, 2)}

Competitor Profile:
- Strengths: ${competitor.strengths?.join(", ") || "Unknown"}
- Weaknesses: ${competitor.weaknesses?.join(", ") || "Unknown"}
- Pricing: ${competitor.pricingTendency || "Unknown"}

Provide strategic insights.`;

	const response = await manager.complete({
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		temperature: 0.5,
		maxTokens: 500,
	});

	const jsonMatch = response.content.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		return [];
	}

	return JSON.parse(jsonMatch[0]) as string[];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the latest competitive analysis for an opportunity.
 */
export async function getLatestCompetitiveAnalysis(
	opportunityId: string
): Promise<ActionResult<CompetitiveAnalysis | null>> {
	try {
		const userContext = await requireCompetitiveContext();
		const [analysis] = await db
			.select()
			.from(competitiveAnalyses)
			.where(competitiveAnalysisByOpportunityCondition(opportunityId, userContext))
			.orderBy(desc(competitiveAnalyses.analyzedAt))
			.limit(1);

		return { success: true, data: analysis || null };
	} catch (error) {
		logger.error("[getLatestCompetitiveAnalysis]", error);
		return { success: false, error: "Failed to retrieve competitive analysis" };
	}
}

/**
 * Update ghost theme usage tracking.
 */
export async function recordGhostThemeUsage(
	ghostThemeId: string
): Promise<ActionResult<GhostTheme>> {
	try {
		const userContext = await requireCompetitiveContext();
		const [updated] = await db
			.update(ghostThemes)
			.set({
				useCount: sql`${ghostThemes.useCount} + 1`,
				lastUsedAt: new Date(),
			})
			.where(and(eq(ghostThemes.id, ghostThemeId), mutableOrganizationCondition(ghostThemes.organizationId, userContext)))
			.returning();

		if (!updated) {
			return { success: false, error: "Ghost theme not found" };
		}

		return { success: true, data: updated };
	} catch (error) {
		logger.error("[recordGhostThemeUsage]", error);
		return { success: false, error: "Failed to record ghost theme usage" };
	}
}

/**
 * Get competitor intelligence summary for dashboard display.
 */
export async function getCompetitorIntelligenceSummary(): Promise<ActionResult<{
	totalCompetitors: number;
	activeDiscriminators: number;
	ghostThemes: number;
	averageWinRate: number;
	recentAnalyses: number;
}>> {
	try {
		const userContext = await requireCompetitiveContext();
		const [competitorCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(competitors)
			.where(visibleOrganizationCondition(competitors.organizationId, userContext));

		const [discriminatorCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(discriminators)
			.where(and(
				eq(discriminators.isActive, true),
				visibleOrganizationCondition(discriminators.organizationId, userContext)
			));

		const [ghostThemeCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(ghostThemes)
			.where(visibleOrganizationCondition(ghostThemes.organizationId, userContext));

		// Calculate average win rate from competitors with data
		const competitorsWithData = await db
			.select({
				winsAgainstUs: competitors.winsAgainstUs,
				lossesToUs: competitors.lossesToUs,
			})
			.from(competitors)
			.where(and(
				visibleOrganizationCondition(competitors.organizationId, userContext),
				or(
					sql`${competitors.winsAgainstUs} > 0`,
					sql`${competitors.lossesToUs} > 0`
				)
			));

		let averageWinRate = 0;
		if (competitorsWithData.length > 0) {
			const totalWins = competitorsWithData.reduce((sum, c) => sum + (c.lossesToUs || 0), 0);
			const totalEncounters = competitorsWithData.reduce(
				(sum, c) => sum + (c.winsAgainstUs || 0) + (c.lossesToUs || 0),
				0
			);
			averageWinRate = totalEncounters > 0 ? (totalWins / totalEncounters) * 100 : 0;
		}

		// Count recent analyses (last 30 days)
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const [recentAnalysesCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(competitiveAnalyses)
			.where(and(
				sql`${competitiveAnalyses.analyzedAt} >= ${thirtyDaysAgo}`,
				organizationOpportunityExistsSql(competitiveAnalyses.opportunityId, userContext)
			));

		return {
			success: true,
			data: {
				totalCompetitors: Number(competitorCount.count),
				activeDiscriminators: Number(discriminatorCount.count),
				ghostThemes: Number(ghostThemeCount.count),
				averageWinRate: Math.round(averageWinRate * 10) / 10,
				recentAnalyses: Number(recentAnalysesCount.count),
			},
		};
	} catch (error) {
		logger.error("[getCompetitorIntelligenceSummary]", error);
		return { success: false, error: "Failed to get intelligence summary" };
	}
}

// ============================================================================
// Competitive Intelligence Import
// ============================================================================

/**
 * Row data from the competitive intelligence Excel file.
 */
export interface CompetitiveIntelligenceRow {
	id: number;
	companyName: string;
	country: string;
	city: string;
	foundedYear: number | null;
	companyAge: number | null;
	companyType: string | null;
	primaryBusiness: string | null;
	specialization: string | null;
	website: string | null;
	linkedIn: string | null;
	email: string | null;
	phone: string | null;
	physicalAddress: string | null;
	ceoFounder: string | null;
	ctoTechLead: string | null;
	keyManagement: string | null;
	managementLinkedin: string | null;
	teamSize: string | null;
	engineerCount: string | null;
	keyEngineers: string | null;
	notableAlumni: string | null;
	annualRevenue: string | null;
	revenueRange: string | null;
	fundingRaised: string | null;
	investors: string | null;
	productsServices: string | null;
	technologyStack: string | null;
	industriesServed: string | null;
	notableClients: string | null;
	recentContracts: string | null;
	contractValues: string | null;
	pursuingOpportunities: string | null;
	partnerships: string | null;
	certifications: string | null;
	awards: string | null;
	newsMentions: string | null;
	recentNews: string | null;
	socialMediaPresence: string | null;
	competitivePositioning: string | null;
	strengths: string | null;
	weaknesses: string | null;
	marketShare: string | null;
	growthTrajectory: string | null;
	threatLevel: string | null;
	strategicNotes: string | null;
	lastUpdated: string | null;
}

/**
 * Parse a comma/semicolon-separated string into an array.
 */
function parseStringArray(value: string | null | undefined): string[] | null {
	if (!value || value.trim() === "") return null;
	// Split by comma or semicolon, trim whitespace, filter empty
	return value.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Parse a date string (various formats) into a Date object.
 */
function parseDateString(value: string | null | undefined): string | null {
	if (!value || value.trim() === "") return null;
	// Expected format: "2026-02-02" or similar
	try {
		const date = new Date(value);
		if (!isNaN(date.getTime())) {
			return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
		}
	} catch {
		// Ignore parse errors
	}
	return null;
}

/**
 * Import a single competitor from competitive intelligence data.
 */
async function importCompetitorFromCIForContext(
	row: CompetitiveIntelligenceRow,
	userContext: CompetitiveUserContext
): Promise<ActionResult<Competitor>> {
	try {
		// Check if competitor already exists by external ID or name inside this organization
		const existing = await db
			.select()
			.from(competitors)
			.where(and(
				mutableOrganizationCondition(competitors.organizationId, userContext),
				or(
					eq(competitors.externalId, String(row.id)),
					eq(competitors.name, row.companyName)
				)
			))
			.limit(1);

		const competitorData = {
			name: row.companyName,
			country: row.country,
			city: row.city,
			foundedYear: row.foundedYear,
			companyAge: row.companyAge,
			companyType: row.companyType,
			primaryBusiness: row.primaryBusiness,
			specialization: row.specialization,
			website: row.website,
			linkedIn: row.linkedIn,
			email: row.email,
			phone: row.phone,
			physicalAddress: row.physicalAddress,
			ceoFounder: row.ceoFounder,
			ctoTechLead: row.ctoTechLead,
			keyManagement: parseStringArray(row.keyManagement),
			managementLinkedin: parseStringArray(row.managementLinkedin),
			teamSize: row.teamSize,
			engineerCount: row.engineerCount,
			keyEngineers: parseStringArray(row.keyEngineers),
			notableAlumni: parseStringArray(row.notableAlumni),
			annualRevenue: row.annualRevenue,
			revenueRange: row.revenueRange,
			fundingRaised: row.fundingRaised,
			investors: parseStringArray(row.investors),
			productsServices: row.productsServices,
			technologyStack: parseStringArray(row.technologyStack),
			industriesServed: parseStringArray(row.industriesServed),
			notableClients: parseStringArray(row.notableClients),
			recentContracts: row.recentContracts,
			contractValues: row.contractValues,
			pursuingOpportunities: row.pursuingOpportunities,
			partnerships: parseStringArray(row.partnerships),
			certifications: parseStringArray(row.certifications),
			awards: parseStringArray(row.awards),
			newsMentions: parseStringArray(row.newsMentions),
			recentNews: row.recentNews,
			// socialMediaPresence is complex - store as JSON if needed
			competitivePositioning: row.competitivePositioning,
			strengths: parseStringArray(row.strengths),
			weaknesses: parseStringArray(row.weaknesses),
			marketShare: row.marketShare,
			growthTrajectory: row.growthTrajectory,
			threatLevel: row.threatLevel,
			strategicNotes: row.strategicNotes,
			lastUpdated: parseDateString(row.lastUpdated),
			externalId: String(row.id),
			organizationId: userContext.organizationId,
			dataSource: "East Africa CI Database 2026",
			intelligenceQuality: "verified" as const,
			updatedAt: new Date(),
		};

		if (existing.length > 0) {
			// Update existing competitor
			const [updated] = await db
				.update(competitors)
				.set(competitorData)
				.where(and(eq(competitors.id, existing[0].id), mutableOrganizationCondition(competitors.organizationId, userContext)))
				.returning();

			return { success: true, data: updated };
		} else {
			// Insert new competitor
			const [created] = await db
				.insert(competitors)
				.values({
					...competitorData,
					createdAt: new Date(),
				})
				.returning();

			return { success: true, data: created };
		}
	} catch (error) {
		logger.error("[importCompetitorFromCI]", error);
		return { success: false, error: `Failed to import competitor: ${row.companyName}` };
	}
}

export async function importCompetitorFromCI(
	row: CompetitiveIntelligenceRow
): Promise<ActionResult<Competitor>> {
	try {
		const userContext = await requireCompetitiveContext();
		return await importCompetitorFromCIForContext(row, userContext);
	} catch (error) {
		logger.error("[importCompetitorFromCI]", error);
		return { success: false, error: `Failed to import competitor: ${row.companyName}` };
	}
}

/**
 * Bulk import competitive intelligence data from Excel row data.
 */
export async function bulkImportCompetitiveIntelligence(
	rows: CompetitiveIntelligenceRow[]
): Promise<ActionResult<{
	total: number;
	imported: number;
	updated: number;
	failed: number;
	errors: string[];
}>> {
	const userContext = await requireCompetitiveContext();
	const result = {
		total: rows.length,
		imported: 0,
		updated: 0,
		failed: 0,
		errors: [] as string[],
	};

	for (const row of rows) {
		try {
			// Check if exists
			const existing = await db
				.select({ id: competitors.id })
				.from(competitors)
				.where(and(
					mutableOrganizationCondition(competitors.organizationId, userContext),
					or(
						eq(competitors.externalId, String(row.id)),
						eq(competitors.name, row.companyName)
					)
				))
				.limit(1);

			const importResult = await importCompetitorFromCIForContext(row, userContext);

			if (importResult.success) {
				if (existing.length > 0) {
					result.updated++;
				} else {
					result.imported++;
				}
			} else {
				result.failed++;
				result.errors.push(importResult.error);
			}
		} catch (error) {
			result.failed++;
			result.errors.push(`Error processing ${row.companyName}: ${String(error)}`);
		}
	}

	revalidatePath("/competitive");
	return { success: true, data: result };
}
