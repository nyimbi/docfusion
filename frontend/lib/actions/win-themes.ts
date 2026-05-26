"use server";

/**
 * Win Theme Orchestration Engine Server Actions
 *
 * Provides comprehensive win theme management capabilities for government proposals including:
 * - Theme CRUD operations with classification and priority management
 * - AI-powered theme suggestion and analysis
 * - Theme consistency analysis across document sections
 * - Theme injection point identification and management
 * - Ghost theme detection for competitive positioning
 * - Theme reinforcement generation
 * - Visualization data for heat maps and coverage analysis
 * - Evaluation criteria mapping
 *
 * @module lib/actions/win-themes
 */

import { db } from "@/lib/db";
import { eq, and, desc, asc, inArray, sql, type SQL } from "drizzle-orm";
import { requireUserContext, type UserContext } from "@/lib/auth-utils";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { AIClient } from "@/lib/ai/client";
import { documents, opportunities, proposalDocuments } from "@/lib/db/schema";
import {
	winThemes,
	themeOccurrences,
	themeInjectionPoints,
	themeAnalysisResults,
	competitorProfiles,
	type WinTheme as DBWinTheme,
	type ThemeOccurrence as DBThemeOccurrence,
	type ThemeInjectionPoint as DBThemeInjectionPoint,
	type ThemeAnalysisResult as DBThemeAnalysisResult,
	type CompetitorProfile as DBCompetitorProfile,
	type ThemeType,
	type ThemeStrength,
	type InjectionType,
	type InjectionStatus,
	type ThemeGap,
	type VolumeCoverage,
	type ThemeRecommendation,
} from "@/lib/db/schema-win-themes";
import type {
	WinTheme,
	WinThemeId,
	CreateWinThemeInput,
	UpdateWinThemeInput,
	ThemeSuggestion,
	ThemeSuggestionId,
	GenerateThemeSuggestionsInput,
	ThemeHeatMap,
	HeatMapCell,
	HeatMapSection,
	ConsistencyAnalysis,
	ConsistencyIssue,
	ConsistencyRecommendation,
	ThemeOccurrence,
	ThemeOccurrenceId,
	VerifyOccurrenceInput,
	InjectionPoint,
	InjectionPointId,
	InjectionFilters,
	GenerateInjectionsInput,
	Competitor,
	CompetitorId,
	CreateCompetitorInput,
	GhostThemeSuggestion,
	CriteriaThemeMapping,
	MapThemesToCriteriaInput,
	ThemeSummary,
	ReinforcementText,
	GenerateReinforcementInput,
	GetThemesResult,
	GetThemeResult,
	CreateThemeResult,
	UpdateThemeResult,
	DeleteThemeResult,
	ReorderThemesResult,
	GetSuggestionsResult,
	GenerateSuggestionsResult,
	AcceptSuggestionResult,
	GetHeatMapResult,
	GetConsistencyResult,
	GetOccurrencesResult,
	VerifyOccurrenceResult,
	GetInjectionsResult,
	GenerateInjectionsResult,
	AcceptInjectionResult,
	GetCompetitorsResult,
	CreateCompetitorResult,
	GetGhostSuggestionsResult,
	GetCriteriaMappingsResult,
	MapCriteriaResult,
	GetSummaryResult,
	GetReinforcementResult,
	WinThemeType,
	ThemePriority,
	ThemeStatus,
} from "@/lib/types/win-themes";
import { logger } from "@/lib/utils/logger";

// ============================================================================
// Zod Validation Schemas
// ============================================================================

const createWinThemeSchema = z.object({
	opportunityId: z.string().uuid("Invalid opportunity ID"),
	statement: z.string().min(10, "Theme statement must be at least 10 characters").max(2000),
	shortVersion: z.string().max(100, "Short version must be 100 characters or less"),
	type: z.enum(["value_prop", "differentiator", "proof_point", "risk_mitigation"]),
	priority: z.number().int().min(1).max(5).optional().default(3) as z.ZodType<ThemePriority>,
	supportingEvidence: z.array(z.string()).optional().default([]),
	relatedProjectIds: z.array(z.string()).optional().default([]),
	keywords: z.array(z.string()).optional().default([]),
	ghostTheme: z.object({
		competitorId: z.string().optional(),
		competitorName: z.string().optional(),
		counterPositioning: z.string(),
		subtletyLevel: z.number().int().min(1).max(5) as z.ZodType<1 | 2 | 3 | 4 | 5>,
		phrasings: z.array(z.string()),
	}).optional(),
});

const updateWinThemeSchema = createWinThemeSchema.partial().omit({ opportunityId: true }).extend({
	status: z.enum(["draft", "active", "approved", "archived"]).optional(),
	displayOrder: z.number().int().min(1).optional(),
});

const competitorInputSchema = z.object({
	opportunityId: z.string().uuid("Invalid opportunity ID"),
	name: z.string().min(1, "Competitor name is required").max(200),
	weaknesses: z.array(z.string()).optional().default([]),
	likelyThemes: z.array(z.string()).optional().default([]),
	ourAdvantages: z.array(z.string()).optional().default([]),
	threatLevel: z.enum(["high", "medium", "low"]).optional().default("medium"),
	notes: z.string().optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

type WinThemeUserContext = UserContext & { organizationId: string };

async function requireWinThemeContext(): Promise<WinThemeUserContext> {
	const userContext = await requireUserContext();
	if (!userContext.organizationId) {
		throw new Error("Organization context required");
	}
	return userContext as WinThemeUserContext;
}

/**
 * Get AI client instance for theme operations.
 */
function getAIClient(): AIClient {
	return new AIClient();
}

function assignedOpportunityExistsSql(opportunityId: unknown, userContext: WinThemeUserContext): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and (opportunities.organization_id = ${userContext.organizationId} or opportunities.organization_id is null)
			and opportunities.assigned_to = ${userContext.userId}
	)`;
}

async function requireAssignedOpportunity(opportunityId: string, userContext: WinThemeUserContext): Promise<void> {
	const [opportunity] = await db
		.select({ id: opportunities.id })
		.from(opportunities)
		.where(
			and(
				eq(opportunities.id, opportunityId),
				sql`(${opportunities.organizationId} = ${userContext.organizationId} or ${opportunities.organizationId} is null)`,
				eq(opportunities.assignedTo, userContext.userId)
			)
		)
		.limit(1);

	if (!opportunity) {
		throw new Error("Opportunity not found");
	}
}

function visibleOpportunityThemesCondition(opportunityId: string, userContext: WinThemeUserContext): SQL {
	return and(
		eq(winThemes.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userContext)
	)!;
}

function visibleThemeByIdCondition(themeId: string, userContext: WinThemeUserContext): SQL {
	return and(
		eq(winThemes.id, themeId),
		assignedOpportunityExistsSql(winThemes.opportunityId, userContext)
	)!;
}

function visibleThemeForOpportunityCondition(
	themeId: string,
	opportunityId: string,
	userContext: WinThemeUserContext
): SQL {
	return and(
		eq(winThemes.id, themeId),
		visibleOpportunityThemesCondition(opportunityId, userContext)
	)!;
}

function assignedThemeExistsSql(themeId: unknown, userContext: WinThemeUserContext): SQL {
	return sql`exists (
		select 1
		from win_themes
		join opportunities on opportunities.id = win_themes.opportunity_id
		where win_themes.id = ${themeId}
			and (opportunities.organization_id = ${userContext.organizationId} or opportunities.organization_id is null)
			and opportunities.assigned_to = ${userContext.userId}
	)`;
}

function visibleThemeOccurrencesCondition(themeId: string, userContext: WinThemeUserContext): SQL {
	return and(
		eq(themeOccurrences.themeId, themeId),
		assignedThemeExistsSql(themeId, userContext)
	)!;
}

function visibleOccurrenceByIdCondition(occurrenceId: string, userContext: WinThemeUserContext): SQL {
	return and(
		eq(themeOccurrences.id, occurrenceId),
		sql`exists (
			select 1
			from win_themes
			join opportunities on opportunities.id = win_themes.opportunity_id
			where win_themes.id = ${themeOccurrences.themeId}
				and (opportunities.organization_id = ${userContext.organizationId} or opportunities.organization_id is null)
				and opportunities.assigned_to = ${userContext.userId}
		)`
	)!;
}

function visibleInjectionByIdCondition(injectionId: string, userContext: WinThemeUserContext): SQL {
	return and(
		eq(themeInjectionPoints.id, injectionId),
		sql`exists (
			select 1
			from win_themes
			join opportunities on opportunities.id = win_themes.opportunity_id
			where win_themes.id = ${themeInjectionPoints.themeId}
				and (opportunities.organization_id = ${userContext.organizationId} or opportunities.organization_id is null)
				and opportunities.assigned_to = ${userContext.userId}
		)`
	)!;
}

function visibleCompetitorsCondition(opportunityId: string, userContext: WinThemeUserContext): SQL {
	return and(
		eq(competitorProfiles.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userContext)
	)!;
}

function visibleCompetitorByIdCondition(competitorId: string, userContext: WinThemeUserContext): SQL {
	return and(
		eq(competitorProfiles.id, competitorId),
		assignedOpportunityExistsSql(competitorProfiles.opportunityId, userContext)
	)!;
}

function visibleProposalDocumentsForOpportunityCondition(
	opportunityId: string,
	userContext: WinThemeUserContext
): SQL {
	return and(
		eq(proposalDocuments.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userContext)
	)!;
}

/**
 * Map database win theme to API response type.
 */
function mapDBThemeToWinTheme(row: DBWinTheme): WinTheme {
	return {
		id: row.id,
		opportunityId: row.opportunityId,
		statement: row.themeStatement,
		shortVersion: row.shortVersion || row.themeStatement.substring(0, 100),
		type: (row.themeType as WinThemeType) || "differentiator",
		priority: (row.priority || 3) as ThemePriority,
		status: (row.isActive ? "active" : "archived") as ThemeStatus,
		displayOrder: row.priority || 1,
		supportingEvidence: (row.supportingEvidence as string[]) || [],
		relatedProjectIds: (row.relatedProjects as string[]) || [],
		keywords: (row.keywords as string[]) || [],
		ghostTheme: row.ghostTheme && row.targetCompetitor ? {
			id: `ghost-${row.id}`,
			competitorName: row.targetCompetitor,
			counterPositioning: row.ghostTheme,
			subtletyLevel: 3,
			phrasings: [],
		} : undefined,
		createdBy: row.createdBy ?? null,
		createdAt: row.createdAt || new Date(),
		updatedAt: row.updatedAt || new Date(),
	};
}

/**
 * Map database occurrence to API type.
 */
function mapDBOccurrenceToThemeOccurrence(row: DBThemeOccurrence): ThemeOccurrence {
	const strengthMap: Record<string, ThemeOccurrence["strength"]> = {
		strong: "strong",
		moderate: "moderate",
		weak: "weak",
		implicit: "weak",
	};

	return {
		id: row.id,
		themeId: row.themeId,
		documentId: row.documentId,
		sectionId: row.sectionId?.toString() || "",
		sectionName: row.sectionName || "Unknown Section",
		page: row.pageNumber || undefined,
		paragraphIndex: row.paragraphIndex || undefined,
		text: row.textExcerpt || "",
		strength: strengthMap[row.strength || "weak"] || "weak",
		isVerified: row.userVerified || false,
		verifiedBy: row.verifiedBy || undefined,
		verifiedAt: row.verifiedAt || undefined,
		detectedAt: row.detectedAt || row.createdAt || new Date(),
	};
}

/**
 * Map database injection point to API type.
 */
function mapDBInjectionToInjectionPoint(
	row: DBThemeInjectionPoint,
	themeName: string
): InjectionPoint {
	const impactLevel = (row.impactScore || 0) > 0.7 ? "high" :
		(row.impactScore || 0) > 0.4 ? "medium" : "low";

	return {
		id: row.id,
		themeId: row.themeId,
		themeName,
		sectionId: row.sectionId?.toString() || "",
		sectionName: row.sectionName || "Unknown Section",
		paragraphIndex: 0,
		insertPosition: row.injectionType === "replace" ? "replace" :
			row.injectionType === "enhance" ? "inline" : "after",
		originalText: row.textContext || "",
		suggestedText: row.suggestedText,
		previewText: row.textContext
			? `${row.textContext.substring(0, 50)}... ${row.suggestedText} ...${row.textContext.substring(row.textContext.length - 50)}`
			: row.suggestedText,
		impactScore: Math.round((row.impactScore || 0) * 100),
		impactLevel,
		rationale: row.rationale || "",
		status: (row.status as InjectionPoint["status"]) || "pending",
		modifiedText: row.acceptedText || undefined,
		generatedAt: row.createdAt || new Date(),
	};
}

/**
 * Map database competitor to API type.
 */
function mapDBCompetitorToCompetitor(row: DBCompetitorProfile): Competitor {
	return {
		id: row.id,
		opportunityId: row.opportunityId,
		name: row.competitorName,
		weaknesses: (row.competitorWeaknesses as string[]) || [],
		likelyThemes: (row.competitorThemes as string[]) || [],
		ourAdvantages: (row.ourDifferentiators as string[]) || [],
		threatLevel: row.confidenceLevel === "high" ? "high" :
			row.confidenceLevel === "medium" ? "medium" : "low",
		notes: row.sourceNotes || undefined,
		createdAt: row.createdAt || new Date(),
		updatedAt: row.updatedAt || new Date(),
	};
}

/**
 * Get next display order for a new theme.
 */
async function getNextDisplayOrder(opportunityId: string, userContext: WinThemeUserContext): Promise<number> {
	const result = await db
		.select({ maxOrder: sql<number>`COALESCE(MAX(${winThemes.priority}), 0)` })
		.from(winThemes)
		.where(visibleOpportunityThemesCondition(opportunityId, userContext));

	return (result[0]?.maxOrder || 0) + 1;
}

// ============================================================================
// Win Theme CRUD Operations
// ============================================================================

/**
 * Get all themes for an opportunity.
 *
 * @param opportunityId - The opportunity ID to fetch themes for
 * @returns Array of win themes ordered by priority
 */
export async function getThemes(opportunityId: string): Promise<GetThemesResult> {
	try {
		const userContext = await requireWinThemeContext();

		const themes = await db
			.select()
			.from(winThemes)
			.where(visibleOpportunityThemesCondition(opportunityId, userContext))
			.orderBy(asc(winThemes.priority), asc(winThemes.createdAt));

		return { success: true, data: themes.map(mapDBThemeToWinTheme) };
	} catch (error) {
		logger.error("Error getting themes:", error);
		return { success: false, error: `Failed to get themes: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Get a single theme by ID.
 *
 * @param themeId - The theme ID to fetch
 * @returns Single win theme or error
 */
export async function getTheme(themeId: WinThemeId): Promise<GetThemeResult> {
	try {
		const userContext = await requireWinThemeContext();

		const [theme] = await db
			.select()
			.from(winThemes)
			.where(visibleThemeByIdCondition(themeId, userContext));

		if (!theme) {
			return { success: false, error: "Theme not found" };
		}

		return { success: true, data: mapDBThemeToWinTheme(theme) };
	} catch (error) {
		logger.error("Error getting theme:", error);
		return { success: false, error: `Failed to get theme: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Create a new win theme.
 *
 * @param input - Theme creation data
 * @returns Created win theme
 */
export async function createTheme(input: CreateWinThemeInput): Promise<CreateThemeResult> {
	try {
		const userContext = await requireWinThemeContext();
		const validated = createWinThemeSchema.parse(input);

		await requireAssignedOpportunity(validated.opportunityId, userContext);
		const displayOrder = await getNextDisplayOrder(validated.opportunityId, userContext);

		const [theme] = await db
			.insert(winThemes)
			.values({
				opportunityId: validated.opportunityId,
				themeStatement: validated.statement,
				shortVersion: validated.shortVersion,
				themeType: validated.type as ThemeType,
				priority: displayOrder,
				supportingEvidence: validated.supportingEvidence,
				relatedProjects: validated.relatedProjectIds,
				keywords: validated.keywords,
				variations: [],
				targetSections: [],
				minOccurrences: 3,
				isActive: true,
				ghostTheme: validated.ghostTheme?.counterPositioning,
				targetCompetitor: validated.ghostTheme?.competitorName,
				createdBy: userContext.userId,
			})
			.returning();

		revalidatePath(`/opportunities/${validated.opportunityId}`);

		return { success: true, data: mapDBThemeToWinTheme(theme) };
	} catch (error) {
		logger.error("Error creating theme:", error);
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues.map((issue: z.ZodIssue) => issue.message).join(", ") };
		}
		return { success: false, error: `Failed to create theme: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Update an existing win theme.
 *
 * @param themeId - Theme ID to update
 * @param input - Fields to update
 * @returns Updated win theme
 */
export async function updateTheme(
	themeId: WinThemeId,
	input: UpdateWinThemeInput
): Promise<UpdateThemeResult> {
	try {
		const userContext = await requireWinThemeContext();
		const validated = updateWinThemeSchema.parse(input);

		// Build update object dynamically
		const updates: Partial<DBWinTheme> = {};
		if (validated.statement !== undefined) updates.themeStatement = validated.statement;
		if (validated.shortVersion !== undefined) updates.shortVersion = validated.shortVersion;
		if (validated.type !== undefined) updates.themeType = validated.type as ThemeType;
		if (validated.supportingEvidence !== undefined) updates.supportingEvidence = validated.supportingEvidence;
		if (validated.relatedProjectIds !== undefined) updates.relatedProjects = validated.relatedProjectIds;
		if (validated.keywords !== undefined) updates.keywords = validated.keywords;
		if (validated.status !== undefined) updates.isActive = validated.status === "active" || validated.status === "approved";
		if (validated.displayOrder !== undefined) updates.priority = validated.displayOrder;
		if (validated.ghostTheme !== undefined) {
			updates.ghostTheme = validated.ghostTheme?.counterPositioning || null;
			updates.targetCompetitor = validated.ghostTheme?.competitorName || null;
		}
		updates.updatedAt = new Date();

		const [theme] = await db
			.update(winThemes)
			.set(updates)
			.where(visibleThemeByIdCondition(themeId, userContext))
			.returning();

		if (!theme) {
			return { success: false, error: "Theme not found" };
		}

		revalidatePath(`/opportunities/${theme.opportunityId}`);

		return { success: true, data: mapDBThemeToWinTheme(theme) };
	} catch (error) {
		logger.error("Error updating theme:", error);
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues.map((issue: z.ZodIssue) => issue.message).join(", ") };
		}
		return { success: false, error: `Failed to update theme: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Delete a win theme.
 *
 * @param themeId - Theme ID to delete
 * @returns Deletion status
 */
export async function deleteTheme(themeId: WinThemeId): Promise<DeleteThemeResult> {
	try {
		const userContext = await requireWinThemeContext();

		// Get theme first for revalidation path
		const [theme] = await db
			.select({ opportunityId: winThemes.opportunityId })
			.from(winThemes)
			.where(visibleThemeByIdCondition(themeId, userContext));

		if (!theme) {
			return { success: false, error: "Theme not found" };
		}

		await db.delete(winThemes).where(visibleThemeByIdCondition(themeId, userContext));

		revalidatePath(`/opportunities/${theme.opportunityId}`);

		return { success: true, data: { deleted: true } };
	} catch (error) {
		logger.error("Error deleting theme:", error);
		return { success: false, error: `Failed to delete theme: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Reorder themes (update display order).
 *
 * @param opportunityId - Opportunity ID
 * @param themeIds - Ordered array of theme IDs
 * @returns Reorder status
 */
export async function reorderThemes(
	opportunityId: string,
	themeIds: WinThemeId[]
): Promise<ReorderThemesResult> {
	try {
		const userContext = await requireWinThemeContext();
		await requireAssignedOpportunity(opportunityId, userContext);

		await db.transaction(async (tx) => {
			for (let i = 0; i < themeIds.length; i++) {
				await tx
					.update(winThemes)
					.set({ priority: i + 1, updatedAt: new Date() })
					.where(
						visibleThemeForOpportunityCondition(themeIds[i], opportunityId, userContext)
					);
			}
		});

		revalidatePath(`/opportunities/${opportunityId}`);

		return { success: true, data: { reordered: true } };
	} catch (error) {
		logger.error("Error reordering themes:", error);
		return { success: false, error: `Failed to reorder themes: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Theme Suggestions
// ============================================================================

/**
 * Get pending theme suggestions for an opportunity.
 *
 * Note: This currently returns AI-generated suggestions that haven't been
 * persisted to database yet. In a full implementation, suggestions would
 * be stored and retrieved from a dedicated table.
 *
 * @param opportunityId - Opportunity ID
 * @returns Array of theme suggestions
 */
export async function getThemeSuggestions(
	opportunityId: string
): Promise<GetSuggestionsResult> {
	try {
		const userContext = await requireWinThemeContext();
		await requireAssignedOpportunity(opportunityId, userContext);

		// In a full implementation, we would query a suggestions table
		// For now, return empty array (suggestions are generated on-demand)
		return { success: true, data: [] };
	} catch (error) {
		logger.error("Error getting suggestions:", error);
		return { success: false, error: `Failed to get suggestions: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Generate AI-powered theme suggestions.
 *
 * Analyzes the opportunity context, requirements, existing themes, and
 * competitive intelligence to suggest compelling win themes.
 *
 * @param input - Generation parameters
 * @returns Array of AI-generated theme suggestions
 */
export async function generateThemeSuggestions(
	input: GenerateThemeSuggestionsInput
): Promise<GenerateSuggestionsResult> {
	try {
		const userContext = await requireWinThemeContext();
		await requireAssignedOpportunity(input.opportunityId, userContext);
		const aiClient = getAIClient();

		// Gather context
		const existingThemes = await db
			.select()
			.from(winThemes)
			.where(visibleOpportunityThemesCondition(input.opportunityId, userContext));

		const competitors = await db
			.select()
			.from(competitorProfiles)
			.where(visibleCompetitorsCondition(input.opportunityId, userContext));

		const prompt = `You are an expert government proposal strategist. Analyze the following context and suggest ${input.count || 5} compelling win themes.

EXISTING THEMES (avoid duplication):
${existingThemes.map(t => `- ${t.themeStatement}`).join("\n") || "None yet"}

COMPETITORS:
${competitors.map(c => `- ${c.competitorName}: Weaknesses: ${(c.competitorWeaknesses as string[])?.join(", ") || "Unknown"}`).join("\n") || "No competitive intelligence"}

${input.additionalContext ? `ADDITIONAL CONTEXT:\n${input.additionalContext}` : ""}

${input.themeTypes?.length ? `FOCUS ON THESE THEME TYPES: ${input.themeTypes.join(", ")}` : ""}

For each theme, provide:
1. A compelling statement (1-2 sentences)
2. A short version (max 100 characters)
3. Theme type: value_prop, differentiator, proof_point, or risk_mitigation
4. Confidence score (0-1)
5. Rationale explaining why this theme will resonate
6. Suggested keywords for detection

Respond in JSON format:
{
  "suggestions": [
    {
      "statement": "Full theme statement",
      "shortVersion": "Short version",
      "type": "differentiator",
      "confidence": 0.85,
      "rationale": "Why this works",
      "suggestedKeywords": ["keyword1", "keyword2"]
    }
  ]
}`;

		const response = await aiClient.complete(prompt, {
			temperature: 0.7,
			maxTokens: 2000,
		});

		try {
			const jsonMatch = response.content.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				throw new Error("No JSON found in AI response");
			}

			const parsed = JSON.parse(jsonMatch[0]) as {
				suggestions: Array<{
					statement: string;
					shortVersion: string;
					type: WinThemeType;
					confidence: number;
					rationale: string;
					suggestedKeywords: string[];
				}>;
			};

			const suggestions: ThemeSuggestion[] = parsed.suggestions.map((s, i) => ({
				id: `suggestion-${Date.now()}-${i}`,
				opportunityId: input.opportunityId,
				statement: s.statement,
				shortVersion: s.shortVersion,
				type: s.type,
				confidence: s.confidence,
				rationale: s.rationale,
				sources: [],
				suggestedKeywords: s.suggestedKeywords,
				status: "pending",
				generatedAt: new Date(),
			}));

			return { success: true, data: suggestions };
		} catch (parseError) {
			logger.error("Error parsing AI response:", parseError);
			return { success: false, error: "Failed to parse AI suggestions" };
		}
	} catch (error) {
		logger.error("Error generating suggestions:", error);
		return { success: false, error: `Failed to generate suggestions: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Accept a theme suggestion (creates a new theme).
 *
 * @param suggestionId - Suggestion ID to accept
 * @param modifications - Optional modifications to the suggestion
 * @returns Created win theme
 */
export async function acceptThemeSuggestion(
	suggestionId: ThemeSuggestionId,
	modifications?: Partial<CreateWinThemeInput>
): Promise<AcceptSuggestionResult> {
	try {
		// Note: In a full implementation, we would:
		// 1. Fetch the suggestion from a suggestions table
		// 2. Apply modifications
		// 3. Create the theme
		// 4. Update suggestion status

		// For now, we expect the modifications to contain the full theme data
		if (!modifications?.opportunityId || !modifications?.statement || !modifications?.shortVersion || !modifications?.type) {
			return { success: false, error: "Modifications must include opportunityId, statement, shortVersion, and type" };
		}

		const result = await createTheme(modifications as CreateWinThemeInput);
		return result;
	} catch (error) {
		logger.error("Error accepting suggestion:", error);
		return { success: false, error: `Failed to accept suggestion: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Dismiss a theme suggestion.
 *
 * @param suggestionId - Suggestion ID to dismiss
 * @returns Dismissal status
 */
export async function dismissThemeSuggestion(
	suggestionId: ThemeSuggestionId
): Promise<{ success: boolean; error?: string }> {
	try {
		await requireWinThemeContext();
		// In a full implementation, update suggestion status in database
		return { success: true };
	} catch (error) {
		logger.error("Error dismissing suggestion:", error);
		return { success: false, error: `Failed to dismiss suggestion: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Theme Heat Map
// ============================================================================

/**
 * Generate theme coverage heat map.
 *
 * Creates a visualization matrix showing how well each theme is covered
 * across different document sections.
 *
 * @param opportunityId - Opportunity ID
 * @returns Heat map data structure
 */
export async function getThemeHeatMap(opportunityId: string): Promise<GetHeatMapResult> {
	try {
		const userContext = await requireWinThemeContext();

		// Get all active themes
		const themes = await db
			.select()
			.from(winThemes)
			.where(
				and(
					visibleOpportunityThemesCondition(opportunityId, userContext),
					eq(winThemes.isActive, true)
				)
			);

		if (themes.length === 0) {
			return {
				success: true,
				data: {
					opportunityId,
					themes: [],
					sections: [],
					cells: [],
					summary: {
						totalCells: 0,
						strongCells: 0,
						moderateCells: 0,
						weakCells: 0,
						missingCells: 0,
						overallCoverage: 0,
					},
					generatedAt: new Date(),
				},
			};
		}

		// Get all occurrences
		const themeIds = themes.map(t => t.id);
		const occurrences = await db
			.select()
			.from(themeOccurrences)
			.where(inArray(themeOccurrences.themeId, themeIds));

		// Build section map
		const sectionMap = new Map<string, HeatMapSection>();
		for (const occurrence of occurrences) {
			if (occurrence.sectionId && !sectionMap.has(occurrence.sectionId.toString())) {
				sectionMap.set(occurrence.sectionId.toString(), {
					id: occurrence.sectionId.toString(),
					name: occurrence.sectionName || "Unknown Section",
					wordCount: 0,
				});
			}
		}

		const sections = Array.from(sectionMap.values());

		// Build heat map cells
		const strengthMap: Record<string, number> = {
			strong: 100,
			moderate: 70,
			weak: 40,
			implicit: 20,
		};

		const cells: HeatMapCell[] = [];
		let strongCells = 0;
		let moderateCells = 0;
		let weakCells = 0;
		let missingCells = 0;

		for (const theme of themes) {
			for (const section of sections) {
				const sectionOccurrences = occurrences.filter(
					o => o.themeId === theme.id && o.sectionId?.toString() === section.id
				);

				const occurrenceIds = sectionOccurrences.map(o => o.id);
				const avgStrength = sectionOccurrences.length > 0
					? sectionOccurrences.reduce((sum, o) => sum + (strengthMap[o.strength || "weak"] || 40), 0) / sectionOccurrences.length
					: 0;

				let strength: HeatMapCell["strength"];
				if (avgStrength >= 80) {
					strength = "strong";
					strongCells++;
				} else if (avgStrength >= 50) {
					strength = "moderate";
					moderateCells++;
				} else if (avgStrength > 0) {
					strength = "weak";
					weakCells++;
				} else {
					strength = "missing";
					missingCells++;
				}

				cells.push({
					themeId: theme.id,
					sectionId: section.id,
					strength,
					occurrenceCount: sectionOccurrences.length,
					qualityScore: Math.round(avgStrength),
					occurrenceIds,
				});
			}
		}

		const totalCells = cells.length;
		const overallCoverage = totalCells > 0
			? Math.round(((strongCells + moderateCells) / totalCells) * 100)
			: 0;

		return {
			success: true,
			data: {
				opportunityId,
				themes: themes.map(mapDBThemeToWinTheme),
				sections,
				cells,
				summary: {
					totalCells,
					strongCells,
					moderateCells,
					weakCells,
					missingCells,
					overallCoverage,
				},
				generatedAt: new Date(),
			},
		};
	} catch (error) {
		logger.error("Error generating heat map:", error);
		return { success: false, error: `Failed to generate heat map: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Get details for a specific heat map cell.
 *
 * @param themeId - Theme ID
 * @param sectionId - Section ID
 * @returns Cell details with occurrences
 */
export async function getHeatMapCellDetails(
	themeId: WinThemeId,
	sectionId: string
): Promise<{ success: boolean; data?: HeatMapCell; error?: string }> {
	try {
		const userContext = await requireWinThemeContext();

		const occurrences = await db
			.select()
			.from(themeOccurrences)
			.where(
				and(
					visibleThemeOccurrencesCondition(themeId, userContext),
					eq(themeOccurrences.sectionId, sectionId)
				)
			);

		const strengthMap: Record<string, number> = {
			strong: 100,
			moderate: 70,
			weak: 40,
			implicit: 20,
		};

		const avgStrength = occurrences.length > 0
			? occurrences.reduce((sum, o) => sum + (strengthMap[o.strength || "weak"] || 40), 0) / occurrences.length
			: 0;

		let strength: HeatMapCell["strength"];
		if (avgStrength >= 80) strength = "strong";
		else if (avgStrength >= 50) strength = "moderate";
		else if (avgStrength > 0) strength = "weak";
		else strength = "missing";

		return {
			success: true,
			data: {
				themeId,
				sectionId,
				strength,
				occurrenceCount: occurrences.length,
				qualityScore: Math.round(avgStrength),
				occurrenceIds: occurrences.map(o => o.id),
			},
		};
	} catch (error) {
		logger.error("Error getting cell details:", error);
		return { success: false, error: `Failed to get cell details: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Consistency Analysis
// ============================================================================

/**
 * Analyze theme consistency across the proposal.
 *
 * Examines coverage, identifies gaps, detects inconsistencies, and
 * provides actionable recommendations for improvement.
 *
 * @param opportunityId - Opportunity ID
 * @returns Comprehensive consistency analysis
 */
export async function analyzeConsistency(
	opportunityId: string
): Promise<GetConsistencyResult> {
	try {
		const userContext = await requireWinThemeContext();
		const aiClient = getAIClient();

		// Get all active themes and occurrences
		const themes = await db
			.select()
			.from(winThemes)
			.where(
				and(
					visibleOpportunityThemesCondition(opportunityId, userContext),
					eq(winThemes.isActive, true)
				)
			);

		if (themes.length === 0) {
			return {
				success: true,
				data: {
					opportunityId,
					overallScore: 0,
					scoreBreakdown: {
						coverageScore: 0,
						consistencyScore: 0,
						strengthScore: 0,
						balanceScore: 0,
					},
					issues: [],
					recommendations: [],
					themesWithGaps: [],
					analyzedAt: new Date(),
				},
			};
		}

		const themeIds = themes.map(t => t.id);
		const occurrences = await db
			.select()
			.from(themeOccurrences)
			.where(inArray(themeOccurrences.themeId, themeIds));

		// Build coverage analysis
		const sectionSet = new Set<string>();
		const themeOccurrenceMap = new Map<string, DBThemeOccurrence[]>();

		for (const occurrence of occurrences) {
			if (occurrence.sectionId) sectionSet.add(occurrence.sectionId.toString());
			const existing = themeOccurrenceMap.get(occurrence.themeId) || [];
			existing.push(occurrence);
			themeOccurrenceMap.set(occurrence.themeId, existing);
		}

		const totalSections = sectionSet.size || 1;

		// Calculate scores
		const issues: ConsistencyIssue[] = [];
		const themesWithGaps: ConsistencyAnalysis["themesWithGaps"] = [];

		let totalCoverage = 0;
		let totalStrength = 0;

		for (const theme of themes) {
			const themeOccurs = themeOccurrenceMap.get(theme.id) || [];
			const coveredSections = new Set(themeOccurs.map(o => o.sectionId?.toString()).filter(Boolean));
			const coverage = (coveredSections.size / totalSections) * 100;

			totalCoverage += coverage;

			// Check for gaps
			if (coverage < 50) {
				const missingSections = Array.from(sectionSet).filter(s => !coveredSections.has(s));
				themesWithGaps.push({
					themeId: theme.id,
					themeName: theme.shortVersion || theme.themeStatement.substring(0, 50),
					missingSections,
				});

				issues.push({
					id: `gap-${theme.id}`,
					type: "gap",
					severity: coverage < 25 ? "critical" : "warning",
					themeId: theme.id,
					themeName: theme.shortVersion || undefined,
					message: `Theme "${theme.shortVersion || theme.themeStatement.substring(0, 30)}..." has low coverage`,
					details: `Only ${Math.round(coverage)}% of sections contain this theme`,
					recommendation: "Add theme reinforcement to missing sections",
				});
			}

			// Check for weak coverage
			const strengthMap: Record<string, number> = { strong: 100, moderate: 70, weak: 40, implicit: 20 };
			const avgStrength = themeOccurs.length > 0
				? themeOccurs.reduce((sum, o) => sum + (strengthMap[o.strength || "weak"] || 40), 0) / themeOccurs.length
				: 0;

			totalStrength += avgStrength;

			if (avgStrength < 50 && themeOccurs.length > 0) {
				issues.push({
					id: `weak-${theme.id}`,
					type: "weak_coverage",
					severity: "warning",
					themeId: theme.id,
					themeName: theme.shortVersion || undefined,
					message: `Theme "${theme.shortVersion || theme.themeStatement.substring(0, 30)}..." has weak presence`,
					details: `Average strength is ${Math.round(avgStrength)}%`,
					recommendation: "Strengthen theme language in existing occurrences",
				});
			}

			// Check for priority mismatch
			if ((theme.priority || 3) <= 2 && coverage < 60) {
				issues.push({
					id: `priority-${theme.id}`,
					type: "priority_mismatch",
					severity: "critical",
					themeId: theme.id,
					themeName: theme.shortVersion || undefined,
					message: `High-priority theme has low coverage`,
					details: `Theme has priority ${theme.priority} but only ${Math.round(coverage)}% coverage`,
					recommendation: "Increase coverage for this high-priority theme",
				});
			}
		}

		// Calculate overall scores
		const coverageScore = themes.length > 0 ? Math.round(totalCoverage / themes.length) : 0;
		const strengthScore = themes.length > 0 ? Math.round(totalStrength / themes.length) : 0;
		const consistencyScore = 100 - (issues.filter(i => i.type === "inconsistency").length * 10);
		const balanceScore = 100 - Math.abs(50 - coverageScore); // Penalize both over and under coverage

		const overallScore = Math.round(
			(coverageScore * 0.3) + (strengthScore * 0.3) + (consistencyScore * 0.2) + (balanceScore * 0.2)
		);

		// Generate AI recommendations
		const recommendations: ConsistencyRecommendation[] = [];

		if (themesWithGaps.length > 0) {
			recommendations.push({
				id: "rec-coverage",
				category: "coverage",
				priority: "high",
				title: "Improve Theme Coverage",
				description: `${themesWithGaps.length} theme(s) have significant coverage gaps`,
				affectedThemeIds: themesWithGaps.map(t => t.themeId),
				affectedSectionIds: [...new Set(themesWithGaps.flatMap(t => t.missingSections))],
				actionItems: themesWithGaps.map(t => `Add "${t.themeName}" to ${t.missingSections.length} missing sections`),
			});
		}

		if (strengthScore < 60) {
			recommendations.push({
				id: "rec-strength",
				category: "strength",
				priority: "medium",
				title: "Strengthen Theme Presence",
				description: "Overall theme strength could be improved",
				affectedThemeIds: themes.filter(t => {
					const occurs = themeOccurrenceMap.get(t.id) || [];
					const strengthMap: Record<string, number> = { strong: 100, moderate: 70, weak: 40, implicit: 20 };
					const avg = occurs.length > 0 ? occurs.reduce((sum, o) => sum + (strengthMap[o.strength || "weak"] || 40), 0) / occurs.length : 0;
					return avg < 60;
				}).map(t => t.id),
				affectedSectionIds: [],
				actionItems: ["Review weak occurrences and enhance language", "Add supporting evidence where themes appear"],
			});
		}

		// Store analysis result
		await db.insert(themeAnalysisResults).values({
			opportunityId,
			analyzedBy: userContext.userId,
			totalThemes: themes.length,
			averageCoverage: coverageScore,
			consistencyScore: overallScore,
			coverageByVolume: [] as VolumeCoverage[],
			gaps: themesWithGaps.map(t => ({
				sectionId: t.missingSections[0] || "",
				sectionName: "Unknown",
				missingThemes: [t.themeId],
				severity: "major" as const,
			})) as ThemeGap[],
			criticalGapCount: issues.filter(i => i.severity === "critical").length,
			majorGapCount: issues.filter(i => i.severity === "warning").length,
			minorGapCount: issues.filter(i => i.severity === "info").length,
			recommendations: recommendations.map(r => ({
				type: "strengthen_theme" as const,
				priority: r.priority,
				description: r.description,
			})) as ThemeRecommendation[],
			highPriorityRecommendations: recommendations.filter(r => r.priority === "high").length,
		});

		return {
			success: true,
			data: {
				opportunityId,
				overallScore,
				scoreBreakdown: {
					coverageScore,
					consistencyScore,
					strengthScore,
					balanceScore,
				},
				issues,
				recommendations,
				themesWithGaps,
				analyzedAt: new Date(),
			},
		};
	} catch (error) {
		logger.error("Error analyzing consistency:", error);
		return { success: false, error: `Failed to analyze consistency: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Theme Occurrences
// ============================================================================

/**
 * Get all occurrences for a theme.
 *
 * @param themeId - Theme ID
 * @returns Array of theme occurrences
 */
export async function getThemeOccurrences(
	themeId: WinThemeId
): Promise<GetOccurrencesResult> {
	try {
		const userContext = await requireWinThemeContext();

		const occurrences = await db
			.select()
			.from(themeOccurrences)
			.where(visibleThemeOccurrencesCondition(themeId, userContext))
			.orderBy(asc(themeOccurrences.sectionName), asc(themeOccurrences.pageNumber));

		return { success: true, data: occurrences.map(mapDBOccurrenceToThemeOccurrence) };
	} catch (error) {
		logger.error("Error getting occurrences:", error);
		return { success: false, error: `Failed to get occurrences: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Verify or unverify a theme occurrence.
 *
 * @param input - Verification input
 * @returns Updated occurrence
 */
export async function verifyOccurrence(
	input: VerifyOccurrenceInput
): Promise<VerifyOccurrenceResult> {
	try {
		const userContext = await requireWinThemeContext();

		const [occurrence] = await db
			.update(themeOccurrences)
			.set({
				userVerified: input.isVerified,
				verifiedBy: input.isVerified ? userContext.userId : null,
				verifiedAt: input.isVerified ? new Date() : null,
			})
			.where(visibleOccurrenceByIdCondition(input.occurrenceId, userContext))
			.returning();

		if (!occurrence) {
			return { success: false, error: "Occurrence not found" };
		}

		return { success: true, data: mapDBOccurrenceToThemeOccurrence(occurrence) };
	} catch (error) {
		logger.error("Error verifying occurrence:", error);
		return { success: false, error: `Failed to verify occurrence: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Scan document for theme occurrences (re-analyze).
 *
 * Uses AI to identify where themes appear in document content.
 *
 * @param opportunityId - Opportunity ID
 * @param themeId - Optional specific theme to scan for
 * @returns Number of occurrences found
 */
export async function scanForOccurrences(
	opportunityId: string,
	themeId?: WinThemeId
): Promise<{ success: boolean; count?: number; error?: string }> {
	try {
		const userContext = await requireWinThemeContext();
		await requireAssignedOpportunity(opportunityId, userContext);
		const aiClient = getAIClient();

		// Get themes to scan for
		const themes = themeId
			? await db.select().from(winThemes).where(visibleThemeForOpportunityCondition(themeId, opportunityId, userContext))
			: await db.select().from(winThemes).where(
					and(visibleOpportunityThemesCondition(opportunityId, userContext), eq(winThemes.isActive, true))
				);

		if (themes.length === 0) {
			return { success: true, count: 0 };
		}

		// Get documents for this opportunity via proposalDocuments join table
		const opportunityDocs = await db
			.select({
				id: documents.id,
				content: documents.content,
				title: documents.title,
				proposalDocId: proposalDocuments.id,
			})
			.from(proposalDocuments)
			.innerJoin(documents, eq(proposalDocuments.documentId, documents.id))
			.where(visibleProposalDocumentsForOpportunityCondition(opportunityId, userContext));

		if (opportunityDocs.length === 0) {
			return { success: true, count: 0 };
		}

		let totalOccurrences = 0;

		// Process each document
		for (const doc of opportunityDocs) {
			if (!doc.content) continue;

			// Use AI to identify theme occurrences in document content
			const prompt = `Analyze this document content and identify occurrences of the following win themes. For each occurrence found, provide the theme ID, the exact text excerpt (max 200 chars), and the strength of the occurrence (strong, moderate, weak, or implicit).

Win Themes:
${themes.map(t => `- ID: ${t.id}, Statement: "${t.themeStatement}", Short: "${t.shortVersion || ""}"`).join("\n")}

Document Content (excerpt, first 15000 chars):
${typeof doc.content === "string" ? doc.content.slice(0, 15000) : JSON.stringify(doc.content).slice(0, 15000)}

Return a JSON array of occurrences: [{ "themeId": "...", "excerpt": "...", "strength": "strong|moderate|weak|implicit", "paragraphIndex": number }]
Return empty array [] if no occurrences found.`;

			try {
				const response = await aiClient.complete(prompt, { maxTokens: 4000 });

				const responseText = response.content;
				const jsonMatch = responseText.match(/\[[\s\S]*?\]/);

				if (jsonMatch) {
					const occurrences = JSON.parse(jsonMatch[0]) as {
						themeId: string;
						excerpt: string;
						strength: string;
						paragraphIndex?: number;
					}[];

					// Store occurrences in database
					for (const occ of occurrences) {
						await db.insert(themeOccurrences).values({
							themeId: occ.themeId,
							documentId: doc.id,
							sectionName: doc.title || "Document",
							textExcerpt: occ.excerpt,
							strength: occ.strength as "strong" | "moderate" | "weak" | "implicit",
							paragraphIndex: occ.paragraphIndex || 0,
							occurrenceType: "explicit",
							confidence: occ.strength === "strong" ? 0.95 : occ.strength === "moderate" ? 0.8 : 0.6,
							aiSuggested: true,
							userVerified: false,
							detectedAt: new Date(),
						});
						totalOccurrences++;
					}
				}
			} catch (aiError) {
				logger.warn(`AI analysis failed for document ${doc.id}:`, aiError);
				// Continue processing other documents
			}
		}

		return { success: true, count: totalOccurrences };
	} catch (error) {
		logger.error("Error scanning for occurrences:", error);
		return { success: false, error: `Failed to scan for occurrences: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Theme Injection
// ============================================================================

/**
 * Get injection point suggestions.
 *
 * @param opportunityId - Opportunity ID
 * @param filters - Optional filters
 * @returns Array of injection suggestions
 */
export async function getInjectionSuggestions(
	opportunityId: string,
	filters?: InjectionFilters
): Promise<GetInjectionsResult> {
	try {
		const userContext = await requireWinThemeContext();

		// Build query conditions
		const conditions: SQL[] = [
			eq(themeInjectionPoints.documentId, opportunityId),
			visibleOpportunityThemesCondition(opportunityId, userContext),
		];

		if (filters?.themeId) {
			conditions.push(eq(themeInjectionPoints.themeId, filters.themeId));
		}

		if (filters?.sectionId) {
			conditions.push(eq(themeInjectionPoints.sectionId, filters.sectionId));
		}

		if (filters?.status?.length) {
			conditions.push(inArray(themeInjectionPoints.status, filters.status));
		}

		const injections = await db
			.select({
				injection: themeInjectionPoints,
				theme: winThemes,
			})
			.from(themeInjectionPoints)
			.innerJoin(winThemes, eq(themeInjectionPoints.themeId, winThemes.id))
			.where(and(...conditions))
			.orderBy(desc(themeInjectionPoints.impactScore));

		// Filter by impact if specified
		let results = injections.map(({ injection, theme }) =>
			mapDBInjectionToInjectionPoint(injection, theme.shortVersion || theme.themeStatement.substring(0, 50))
		);

		if (filters?.minImpact) {
			const minScore = filters.minImpact === "high" ? 70 : filters.minImpact === "medium" ? 40 : 0;
			results = results.filter(r => r.impactScore >= minScore);
		}

		return { success: true, data: results };
	} catch (error) {
		logger.error("Error getting injections:", error);
		return { success: false, error: `Failed to get injections: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Generate AI injection suggestions.
 *
 * Analyzes document content and identifies optimal locations to inject
 * or reinforce themes.
 *
 * @param input - Generation parameters
 * @returns Array of injection suggestions
 */
export async function generateInjectionSuggestions(
	input: GenerateInjectionsInput
): Promise<GenerateInjectionsResult> {
	try {
		const userContext = await requireWinThemeContext();
		await requireAssignedOpportunity(input.opportunityId, userContext);
		const aiClient = getAIClient();

		// Get theme(s) to inject
		const themes = input.themeId
			? await db.select().from(winThemes).where(visibleThemeForOpportunityCondition(input.themeId, input.opportunityId, userContext))
			: await db.select().from(winThemes).where(
					and(visibleOpportunityThemesCondition(input.opportunityId, userContext), eq(winThemes.isActive, true))
				);

		if (themes.length === 0) {
			return { success: true, data: [] };
		}

		// Get existing occurrences to avoid duplication
		const themeIds = themes.map(t => t.id);
		const existingOccurrences = await db
			.select()
			.from(themeOccurrences)
			.where(inArray(themeOccurrences.themeId, themeIds));

		const prompt = `You are analyzing a government proposal to find optimal locations to inject or reinforce win themes.

THEMES TO INJECT:
${themes.map(t => `- "${t.themeStatement}" (Short: "${t.shortVersion || "N/A"}")`).join("\n")}

EXISTING OCCURRENCES (avoid these locations):
${existingOccurrences.map(o => `- ${o.sectionName || "Unknown"}: "${o.textExcerpt?.substring(0, 80)}..."`).join("\n") || "None"}

For each theme, suggest ${input.maxSuggestions || 3} strategic injection points. For each, provide:
1. Section name and estimated page
2. Surrounding text context
3. Suggested text to inject
4. Type: before (insert before), after (insert after), replace, or inline (enhance)
5. Rationale for this location
6. Impact score (0-100)

Respond in JSON format:
{
  "injections": [
    {
      "themeId": "theme-id",
      "sectionName": "Section Name",
      "pageNumber": 5,
      "originalText": "Context text...",
      "suggestedText": "Text to inject",
      "insertPosition": "after",
      "rationale": "Why here",
      "impactScore": 85
    }
  ]
}`;

		const response = await aiClient.complete(prompt, {
			temperature: 0.6,
			maxTokens: 2000,
		});

		try {
			const jsonMatch = response.content.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				throw new Error("No JSON found in AI response");
			}

			const parsed = JSON.parse(jsonMatch[0]) as {
				injections: Array<{
					themeId?: string;
					sectionName: string;
					pageNumber: number;
					originalText: string;
					suggestedText: string;
					insertPosition: "before" | "after" | "replace" | "inline";
					rationale: string;
					impactScore: number;
				}>;
			};

			// Store and return injection points
			const results: InjectionPoint[] = [];

			for (const injection of parsed.injections) {
				const themeId = injection.themeId || themes[0].id;
				const theme = themes.find(t => t.id === themeId) || themes[0];

				const injectionType: InjectionType =
					injection.insertPosition === "replace" ? "replace" :
					injection.insertPosition === "inline" ? "enhance" : "insert";

				const [inserted] = await db
					.insert(themeInjectionPoints)
					.values({
						themeId: theme.id,
						documentId: input.opportunityId,
						sectionId: injection.sectionName.toLowerCase().replace(/\s+/g, "-"),
						sectionName: injection.sectionName,
						pageNumber: injection.pageNumber,
						textContext: injection.originalText,
						suggestedText: injection.suggestedText,
						injectionType,
						rationale: injection.rationale,
						impactScore: injection.impactScore / 100,
						status: "pending",
					})
					.returning();

				results.push(mapDBInjectionToInjectionPoint(
					inserted,
					theme.shortVersion || theme.themeStatement.substring(0, 50)
				));
			}

			return { success: true, data: results };
		} catch (parseError) {
			logger.error("Error parsing AI response:", parseError);
			return { success: false, error: "Failed to parse AI injection suggestions" };
		}
	} catch (error) {
		logger.error("Error generating injections:", error);
		return { success: false, error: `Failed to generate injections: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Accept an injection suggestion.
 *
 * @param injectionId - Injection ID to accept
 * @param modifiedText - Optional modified text
 * @returns Acceptance status
 */
export async function acceptInjection(
	injectionId: InjectionPointId,
	modifiedText?: string
): Promise<AcceptInjectionResult> {
	try {
		const userContext = await requireWinThemeContext();

		const [injection] = await db
			.update(themeInjectionPoints)
			.set({
				status: modifiedText ? "modified" : "accepted",
				acceptedText: modifiedText || null,
				acceptedBy: userContext.userId,
				acceptedAt: new Date(),
			})
			.where(visibleInjectionByIdCondition(injectionId, userContext))
			.returning({ id: themeInjectionPoints.id });

		if (!injection) {
			return { success: false, error: "Injection not found" };
		}

		return { success: true, data: { accepted: true } };
	} catch (error) {
		logger.error("Error accepting injection:", error);
		return { success: false, error: `Failed to accept injection: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Reject an injection suggestion.
 *
 * @param injectionId - Injection ID to reject
 * @returns Rejection status
 */
export async function rejectInjection(
	injectionId: InjectionPointId
): Promise<{ success: boolean; error?: string }> {
	try {
		const userContext = await requireWinThemeContext();

		const [injection] = await db
			.update(themeInjectionPoints)
			.set({
				status: "rejected",
				acceptedBy: userContext.userId,
				acceptedAt: new Date(),
			})
			.where(visibleInjectionByIdCondition(injectionId, userContext))
			.returning({ id: themeInjectionPoints.id });

		if (!injection) {
			return { success: false, error: "Injection not found" };
		}

		return { success: true };
	} catch (error) {
		logger.error("Error rejecting injection:", error);
		return { success: false, error: `Failed to reject injection: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Competitive Positioning (Ghost Themes)
// ============================================================================

/**
 * Get competitors for an opportunity.
 *
 * @param opportunityId - Opportunity ID
 * @returns Array of competitor profiles
 */
export async function getCompetitors(
	opportunityId: string
): Promise<GetCompetitorsResult> {
	try {
		const userContext = await requireWinThemeContext();

		const competitors = await db
			.select()
			.from(competitorProfiles)
			.where(visibleCompetitorsCondition(opportunityId, userContext))
			.orderBy(asc(competitorProfiles.competitorName));

		return { success: true, data: competitors.map(mapDBCompetitorToCompetitor) };
	} catch (error) {
		logger.error("Error getting competitors:", error);
		return { success: false, error: `Failed to get competitors: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Create a competitor profile.
 *
 * @param input - Competitor data
 * @returns Created competitor
 */
export async function createCompetitor(
	input: CreateCompetitorInput
): Promise<CreateCompetitorResult> {
	try {
		const userContext = await requireWinThemeContext();
		const validated = competitorInputSchema.parse(input);

		await requireAssignedOpportunity(validated.opportunityId, userContext);

		const [competitor] = await db
			.insert(competitorProfiles)
			.values({
				opportunityId: validated.opportunityId,
				competitorName: validated.name,
				competitorWeaknesses: validated.weaknesses,
				competitorThemes: validated.likelyThemes,
				ourDifferentiators: validated.ourAdvantages,
				confidenceLevel: validated.threatLevel === "high" ? "high" :
					validated.threatLevel === "medium" ? "medium" : "low",
				sourceNotes: validated.notes,
				sourceType: "bid_intel",
				isActive: true,
				createdBy: userContext.userId,
			})
			.returning();

		revalidatePath(`/opportunities/${validated.opportunityId}`);

		return { success: true, data: mapDBCompetitorToCompetitor(competitor) };
	} catch (error) {
		logger.error("Error creating competitor:", error);
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues.map((issue: z.ZodIssue) => issue.message).join(", ") };
		}
		return { success: false, error: `Failed to create competitor: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Update a competitor profile.
 *
 * @param competitorId - Competitor ID
 * @param input - Fields to update
 * @returns Updated competitor
 */
export async function updateCompetitor(
	competitorId: CompetitorId,
	input: Partial<CreateCompetitorInput>
): Promise<CreateCompetitorResult> {
	try {
		const userContext = await requireWinThemeContext();

		const updates: Partial<DBCompetitorProfile> = {};
		if (input.name !== undefined) updates.competitorName = input.name;
		if (input.weaknesses !== undefined) updates.competitorWeaknesses = input.weaknesses;
		if (input.likelyThemes !== undefined) updates.competitorThemes = input.likelyThemes;
		if (input.ourAdvantages !== undefined) updates.ourDifferentiators = input.ourAdvantages;
		if (input.threatLevel !== undefined) {
			updates.confidenceLevel = input.threatLevel === "high" ? "high" :
				input.threatLevel === "medium" ? "medium" : "low";
		}
		if (input.notes !== undefined) updates.sourceNotes = input.notes;
		updates.updatedAt = new Date();

		const [competitor] = await db
			.update(competitorProfiles)
			.set(updates)
			.where(visibleCompetitorByIdCondition(competitorId, userContext))
			.returning();

		if (!competitor) {
			return { success: false, error: "Competitor not found" };
		}

		revalidatePath(`/opportunities/${competitor.opportunityId}`);

		return { success: true, data: mapDBCompetitorToCompetitor(competitor) };
	} catch (error) {
		logger.error("Error updating competitor:", error);
		return { success: false, error: `Failed to update competitor: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Delete a competitor profile.
 *
 * @param competitorId - Competitor ID
 * @returns Deletion status
 */
export async function deleteCompetitor(
	competitorId: CompetitorId
): Promise<{ success: boolean; error?: string }> {
	try {
		const userContext = await requireWinThemeContext();

		const [competitor] = await db
			.select({ opportunityId: competitorProfiles.opportunityId })
			.from(competitorProfiles)
			.where(visibleCompetitorByIdCondition(competitorId, userContext));

		if (!competitor) {
			return { success: false, error: "Competitor not found" };
		}

		await db.delete(competitorProfiles).where(visibleCompetitorByIdCondition(competitorId, userContext));

		revalidatePath(`/opportunities/${competitor.opportunityId}`);

		return { success: true };
	} catch (error) {
		logger.error("Error deleting competitor:", error);
		return { success: false, error: `Failed to delete competitor: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Generate ghost theme suggestions based on competitors.
 *
 * Analyzes competitor weaknesses and our strengths to create subtle
 * counter-positioning statements.
 *
 * @param opportunityId - Opportunity ID
 * @param competitorId - Optional specific competitor
 * @returns Array of ghost theme suggestions
 */
export async function generateGhostThemeSuggestions(
	opportunityId: string,
	competitorId?: CompetitorId
): Promise<GetGhostSuggestionsResult> {
	try {
		const userContext = await requireWinThemeContext();
		await requireAssignedOpportunity(opportunityId, userContext);
		const aiClient = getAIClient();

		// Get competitors
		const competitors = competitorId
			? await db.select().from(competitorProfiles).where(visibleCompetitorByIdCondition(competitorId, userContext))
			: await db.select().from(competitorProfiles).where(
					and(visibleCompetitorsCondition(opportunityId, userContext), eq(competitorProfiles.isActive, true))
				);

		if (competitors.length === 0) {
			return { success: true, data: [] };
		}

		const prompt = `You are a proposal strategist developing ghost themes for competitive positioning.

Ghost themes subtly highlight our strengths in contrast to competitor weaknesses WITHOUT directly naming competitors.

COMPETITORS:
${competitors.map(c => `
## ${c.competitorName}${c.isIncumbent ? " (INCUMBENT)" : ""}
Weaknesses: ${(c.competitorWeaknesses as string[])?.join(", ") || "Unknown"}
Their Themes: ${(c.competitorThemes as string[])?.join(", ") || "Unknown"}
Our Advantages: ${(c.ourDifferentiators as string[])?.join(", ") || "Not specified"}
`).join("\n")}

For each competitor, generate 2-3 ghost themes with varying subtlety levels (1=very subtle, 5=more direct but still professional).

Respond in JSON format:
{
  "ghostThemes": [
    {
      "competitorId": "competitor-id",
      "competitorName": "Competitor Name",
      "statement": "Our proven track record of on-time delivery...",
      "phrasings": ["Alternate phrasing 1", "Alternate phrasing 2"],
      "subtletyLevel": 3,
      "rationale": "Targets their delivery issues"
    }
  ]
}`;

		const response = await aiClient.complete(prompt, {
			temperature: 0.7,
			maxTokens: 2000,
		});

		try {
			const jsonMatch = response.content.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				throw new Error("No JSON found in AI response");
			}

			const parsed = JSON.parse(jsonMatch[0]) as {
				ghostThemes: Array<{
					competitorId?: string;
					competitorName: string;
					statement: string;
					phrasings: string[];
					subtletyLevel: 1 | 2 | 3 | 4 | 5;
					rationale: string;
				}>;
			};

			const suggestions: GhostThemeSuggestion[] = parsed.ghostThemes.map((g, i) => ({
				id: `ghost-${Date.now()}-${i}`,
				competitorId: competitors.find(c => c.competitorName === g.competitorName)?.id,
				competitorName: g.competitorName,
				statement: g.statement,
				phrasings: g.phrasings,
				subtletyLevel: g.subtletyLevel,
				rationale: g.rationale,
				status: "pending",
				generatedAt: new Date(),
			}));

			return { success: true, data: suggestions };
		} catch (parseError) {
			logger.error("Error parsing AI response:", parseError);
			return { success: false, error: "Failed to parse AI ghost theme suggestions" };
		}
	} catch (error) {
		logger.error("Error generating ghost themes:", error);
		return { success: false, error: `Failed to generate ghost themes: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Evaluation Criteria Mapping
// ============================================================================

/**
 * Get criteria-theme mappings for an opportunity.
 *
 * @param opportunityId - Opportunity ID
 * @returns Array of criteria mappings
 */
export async function getCriteriaMappings(
	opportunityId: string
): Promise<GetCriteriaMappingsResult> {
	try {
		const userContext = await requireWinThemeContext();

		// Get themes with their evaluation criteria
		const themes = await db
			.select()
			.from(winThemes)
			.where(
				and(visibleOpportunityThemesCondition(opportunityId, userContext), eq(winThemes.isActive, true))
			);

		// Build criteria map
		const criteriaMap = new Map<string, CriteriaThemeMapping>();

		for (const theme of themes) {
			const criteriaIds = theme.evaluationCriteriaIds as string[] | null;
			if (!criteriaIds) continue;

			for (const criteriaId of criteriaIds) {
				if (!criteriaMap.has(criteriaId)) {
					criteriaMap.set(criteriaId, {
						id: `mapping-${criteriaId}`,
						opportunityId,
						criteriaId,
						criteriaName: criteriaId,
						mappedThemes: [],
						coverageScore: 0,
						isAdequate: false,
						updatedAt: new Date(),
					});
				}

				criteriaMap.get(criteriaId)!.mappedThemes.push({
					themeId: theme.id,
					relevanceScore: 80,
				});
			}
		}

		// Calculate coverage scores
		const mappings = Array.from(criteriaMap.values()).map(m => ({
			...m,
			coverageScore: Math.min(100, m.mappedThemes.length * 25),
			isAdequate: m.mappedThemes.length >= 2,
		}));

		return { success: true, data: mappings };
	} catch (error) {
		logger.error("Error getting criteria mappings:", error);
		return { success: false, error: `Failed to get mappings: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Map themes to an evaluation criterion.
 *
 * @param input - Mapping input
 * @returns Updated mapping
 */
export async function mapThemesToCriteria(
	input: MapThemesToCriteriaInput
): Promise<MapCriteriaResult> {
	try {
		const userContext = await requireWinThemeContext();

		// Update each theme's evaluationCriteriaIds
		for (const mapping of input.themeMappings) {
			const [theme] = await db
				.select()
				.from(winThemes)
				.where(visibleThemeByIdCondition(mapping.themeId, userContext));

			if (theme) {
				const existingCriteria = (theme.evaluationCriteriaIds as string[]) || [];
				if (!existingCriteria.includes(input.criteriaId)) {
					await db
						.update(winThemes)
						.set({
							evaluationCriteriaIds: [...existingCriteria, input.criteriaId],
							updatedAt: new Date(),
						})
						.where(visibleThemeByIdCondition(mapping.themeId, userContext));
				}
			}
		}

		const result: CriteriaThemeMapping = {
			id: `mapping-${input.criteriaId}`,
			opportunityId: "",
			criteriaId: input.criteriaId,
			criteriaName: input.criteriaId,
			mappedThemes: input.themeMappings,
			coverageScore: Math.min(100, input.themeMappings.length * 25),
			isAdequate: input.themeMappings.length >= 2,
			updatedAt: new Date(),
		};

		return { success: true, data: result };
	} catch (error) {
		logger.error("Error mapping themes to criteria:", error);
		return { success: false, error: `Failed to map themes: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Auto-suggest theme-criteria mappings using AI.
 *
 * @param opportunityId - Opportunity ID
 * @returns Array of suggested mappings
 */
export async function suggestCriteriaMappings(
	opportunityId: string
): Promise<GetCriteriaMappingsResult> {
	try {
		await requireWinThemeContext();

		// In a full implementation, use AI to suggest mappings
		// For now, return current mappings
		return getCriteriaMappings(opportunityId);
	} catch (error) {
		logger.error("Error suggesting criteria mappings:", error);
		return { success: false, error: `Failed to suggest mappings: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Theme Summary
// ============================================================================

/**
 * Get theme summary statistics for an opportunity.
 *
 * @param opportunityId - Opportunity ID
 * @returns Theme summary statistics
 */
export async function getThemeSummary(opportunityId: string): Promise<GetSummaryResult> {
	try {
		const userContext = await requireWinThemeContext();

		const themes = await db
			.select()
			.from(winThemes)
			.where(visibleOpportunityThemesCondition(opportunityId, userContext));

		const activeThemes = themes.filter(t => t.isActive);

		// Count by type
		const byType: Record<WinThemeType, number> = {
			value_prop: 0,
			differentiator: 0,
			proof_point: 0,
			risk_mitigation: 0,
		};

		// Count by status
		const byStatus: Record<ThemeStatus, number> = {
			draft: 0,
			active: 0,
			approved: 0,
			archived: 0,
		};

		for (const theme of themes) {
			const type = (theme.themeType as WinThemeType) || "differentiator";
			byType[type] = (byType[type] || 0) + 1;

			const status = theme.isActive ? "active" : "archived";
			byStatus[status] = (byStatus[status] || 0) + 1;
		}

		// Get occurrences for coverage calculation
		const themeIds = activeThemes.map(t => t.id);
		const occurrences = themeIds.length > 0
			? await db.select().from(themeOccurrences).where(inArray(themeOccurrences.themeId, themeIds))
			: [];

		// Calculate coverage per theme
		const sectionCount = new Set(occurrences.map(o => o.sectionId?.toString()).filter(Boolean)).size || 1;

		const themeCoverage = activeThemes.map(theme => {
			const themeOccurs = occurrences.filter(o => o.themeId === theme.id);
			const coveredSections = new Set(themeOccurs.map(o => o.sectionId?.toString()).filter(Boolean));
			return {
				id: theme.id,
				name: theme.shortVersion || theme.themeStatement.substring(0, 50),
				coverage: Math.round((coveredSections.size / sectionCount) * 100),
			};
		});

		const sorted = [...themeCoverage].sort((a, b) => b.coverage - a.coverage);
		const avgCoverage = themeCoverage.length > 0
			? Math.round(themeCoverage.reduce((sum, t) => sum + t.coverage, 0) / themeCoverage.length)
			: 0;

		// Get latest analysis for gap count
		const [latestAnalysis] = await db
			.select()
			.from(themeAnalysisResults)
			.where(
				and(
					eq(themeAnalysisResults.opportunityId, opportunityId),
					assignedOpportunityExistsSql(opportunityId, userContext)
				)
			)
			.orderBy(desc(themeAnalysisResults.analyzedAt))
			.limit(1);

		return {
			success: true,
			data: {
				opportunityId,
				totalThemes: themes.length,
				activeThemes: activeThemes.length,
				byType,
				byStatus,
				coveragePercentage: avgCoverage,
				strongestTheme: sorted[0] ? sorted[0] : undefined,
				weakestTheme: sorted[sorted.length - 1] ? sorted[sorted.length - 1] : undefined,
				criticalGaps: latestAnalysis?.criticalGapCount || 0,
				lastAnalyzedAt: latestAnalysis?.analyzedAt || undefined,
			},
		};
	} catch (error) {
		logger.error("Error getting theme summary:", error);
		return { success: false, error: `Failed to get summary: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Theme Reinforcement
// ============================================================================

/**
 * Generate reinforcement text for a theme in a specific section.
 *
 * Creates contextually appropriate text that reinforces a theme
 * within the given section.
 *
 * @param input - Reinforcement generation parameters
 * @returns Generated reinforcement text options
 */
export async function generateReinforcementText(
	input: GenerateReinforcementInput
): Promise<GetReinforcementResult> {
	try {
		const userContext = await requireWinThemeContext();
		const aiClient = getAIClient();

		const [theme] = await db
			.select()
			.from(winThemes)
			.where(visibleThemeByIdCondition(input.themeId, userContext));

		if (!theme) {
			return { success: false, error: "Theme not found" };
		}

		const toneDescription = {
			assertive: "confident and direct",
			professional: "formal and business-appropriate",
			technical: "detailed and specification-focused",
			persuasive: "compelling and benefit-focused",
		};

		const tone = input.tone || "professional";
		const targetWordCount = input.targetWordCount || 50;
		const optionCount = input.optionCount || 3;

		const prompt = `Generate ${optionCount} variations of reinforcement text for the following win theme.

THEME: "${theme.themeStatement}"
SHORT VERSION: "${theme.shortVersion || "N/A"}"
SUPPORTING EVIDENCE: ${(theme.supportingEvidence as string[])?.join("; ") || "None"}

TARGET SECTION: ${input.sectionId}
TONE: ${toneDescription[tone]}
TARGET LENGTH: approximately ${targetWordCount} words each

Each variation should:
1. Naturally incorporate the theme
2. Be appropriate for a government RFP response
3. Include specific, evaluator-friendly language

Respond in JSON format:
{
  "options": [
    {
      "text": "The reinforcement text...",
      "tone": "${tone}",
      "wordCount": 50
    }
  ],
  "placementSuggestion": "Suggested placement within the section"
}`;

		const response = await aiClient.complete(prompt, {
			temperature: 0.7,
			maxTokens: 1000,
		});

		try {
			const jsonMatch = response.content.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				throw new Error("No JSON found in AI response");
			}

			const parsed = JSON.parse(jsonMatch[0]) as {
				options: Array<{
					text: string;
					tone: ReinforcementText["options"][0]["tone"];
					wordCount: number;
				}>;
				placementSuggestion: string;
			};

			return {
				success: true,
				data: {
					id: `reinforcement-${Date.now()}`,
					themeId: input.themeId,
					sectionId: input.sectionId,
					options: parsed.options,
					placementSuggestion: parsed.placementSuggestion,
					generatedAt: new Date(),
				},
			};
		} catch (parseError) {
			logger.error("Error parsing AI response:", parseError);
			return { success: false, error: "Failed to parse AI reinforcement text" };
		}
	} catch (error) {
		logger.error("Error generating reinforcement:", error);
		return { success: false, error: `Failed to generate reinforcement: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}
