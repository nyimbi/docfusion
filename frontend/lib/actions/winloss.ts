/**
 * Win/Loss Intelligence Platform - DocFusion
 *
 * Comprehensive server actions for post-award analysis, debrief management,
 * pattern recognition, ROI tracking, and competitive intelligence.
 *
 * Features:
 * - Debrief CRUD with score tracking
 * - AI-powered pattern analysis
 * - Win/loss statistics and trend analysis
 * - ROI calculation and tracking
 * - Lessons learned synthesis
 * - Improvement area identification
 * - Competitor comparison analytics
 * - Action item tracking
 * - Dashboard metrics
 * - Export capabilities
 */

"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import {
	debriefs,
	winLossPatterns,
	proposalROI,
	type Debrief,
	type NewDebrief,
	type WinLossPattern,
	type NewWinLossPattern,
	type ProposalROI,
} from "@/lib/db/schema-winloss";
import { opportunities, companySettings } from "@/lib/db/schema";
import { competitors, competitorOpportunities } from "@/lib/db/schema-competitors";
import { eq, and, desc, sql, gte, lte, inArray, count, avg, sum, or, asc, isNotNull, isNull, type SQL } from "drizzle-orm";
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

async function requireWinLossContext(organizationId?: string | null): Promise<UserContext> {
	const userContext = await requireUserContext();
	if (organizationId && organizationId !== userContext.organizationId) {
		throw new Error("Unauthorized");
	}
	return userContext;
}

function visibleOrganizationCondition(column: OrganizationColumn, userContext: UserContext) {
	return userContext.organizationId
		? or(isNull(column), eq(column, userContext.organizationId))
		: isNull(column);
}

function mutableOrganizationCondition(column: OrganizationColumn, userContext: UserContext) {
	return userContext.organizationId
		? eq(column, userContext.organizationId)
		: isNull(column);
}

function organizationForInsert(inputOrganizationId: string | undefined, userContext: UserContext): string | undefined {
	return inputOrganizationId ?? userContext.organizationId;
}

function assignedOpportunityByIdCondition(opportunityId: string, userContext: UserContext): SQL {
	return and(
		eq(opportunities.id, opportunityId),
		eq(opportunities.assignedTo, userContext.userId)
	)!;
}

/**
 * Input for creating a new debrief record.
 */
interface CreateDebriefInput {
	opportunityId: string;
	outcome: "win" | "loss" | "no_award" | "cancelled";
	debriefDate?: Date;
	debriefType?: "written" | "oral" | "none";
	technicalScore?: number;
	technicalMaxScore?: number;
	managementScore?: number;
	managementMaxScore?: number;
	pastPerfScore?: number;
	pastPerfMaxScore?: number;
	costScore?: number;
	costMaxScore?: number;
	overallRanking?: number;
	totalBidders?: number;
	winnerName?: string;
	winnerId?: string;
	winningPrice?: number;
	evaluatorFeedback?: string;
	strengthsIdentified?: string[];
	weaknessesIdentified?: string[];
	proposalInvestment?: number;
	contractValue?: number;
	organizationId?: string;
}

/**
 * Input for updating an existing debrief.
 */
interface UpdateDebriefInput extends Partial<CreateDebriefInput> {
	internalAnalysis?: string;
	lessonsLearned?: string[];
	actionItems?: ActionItem[];
	debriefDocument?: string;
}

/**
 * Action item structure for tracking follow-up tasks.
 */
interface ActionItem {
	id: string;
	item: string;
	assignee: string;
	dueDate: string;
	status: "pending" | "in_progress" | "completed";
	completedAt?: string;
}

/**
 * Filters for win/loss queries.
 */
interface WinLossFilters {
	outcome?: string;
	dateFrom?: Date;
	dateTo?: Date;
	agencyId?: string;
	competitorId?: string;
	minValue?: number;
	maxValue?: number;
	organizationId?: string;
}

/**
 * Comprehensive win/loss statistics.
 */
interface WinLossStats {
	totalProposals: number;
	wins: number;
	losses: number;
	noAward: number;
	cancelled: number;
	winRate: number;
	averageRanking: number;
	totalContractValue: number;
	totalInvestment: number;
	roi: number;
	byMonth: Array<{ month: string; wins: number; losses: number; winRate: number }>;
	byAgency: Array<{ agency: string; proposals: number; wins: number; winRate: number }>;
	byCompetitor: Array<{ competitor: string; encounters: number; wins: number; losses: number }>;
	scoreBreakdown: {
		technicalAvg: number;
		managementAvg: number;
		pastPerfAvg: number;
		costAvg: number;
	};
}

/**
 * Pattern analysis results from AI.
 */
interface PatternAnalysis {
	patterns: WinLossPattern[];
	insights: string[];
	recommendations: string[];
	confidence: number;
}

/**
 * Lessons learned report structure.
 */
interface LessonsReport {
	lessonsLearned: Array<{
		lesson: string;
		frequency: number;
		relatedOutcome: "win" | "loss";
		category: string;
	}>;
	topStrengths: string[];
	topWeaknesses: string[];
	improvementAreas: string[];
	generatedAt: Date;
}

/**
 * ROI analysis results.
 */
interface ROIAnalysis {
	overallROI: number;
	costPerWin: number;
	averageContractValue: number;
	averageProposalCost: number;
	trend: "improving" | "declining" | "stable";
	projectedAnnualReturn: number;
	recommendations: string[];
}

/**
 * Identified improvement areas.
 */
interface ImprovementArea {
	area: string;
	description: string;
	impact: "high" | "medium" | "low";
	effort: "low" | "medium" | "high";
	evidence: string[];
	suggestedActions: string[];
}

/**
 * Competitor comparison results.
 */
interface CompetitorComparison {
	competitorId: string;
	competitorName: string;
	totalEncounters: number;
	ourWins: number;
	theirWins: number;
	winRateAgainst: number;
	strengthsVsThem: string[];
	weaknessesVsThem: string[];
	recommendations: string[];
}

/**
 * Dashboard metrics summary.
 */
interface DashboardMetrics {
	totalDebriefs: number;
	recentWinRate: number;
	totalContractValueWon: number;
	pendingActionItems: number;
	activePatterns: number;
	roi: number;
	trendDirection: "up" | "down" | "stable";
	recentDebriefs: Array<{
		id: string;
		opportunityTitle: string;
		outcome: string;
		debriefDate: Date | null;
	}>;
}

/**
 * Debrief timeline event.
 */
interface DebriefTimelineEvent {
	id: string;
	eventType: "created" | "debrief_requested" | "debrief_received" | "analysis_completed" | "action_item_completed";
	timestamp: Date;
	description: string;
	actor?: string;
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

const createDebriefSchema = z.object({
	opportunityId: z.string().uuid("Invalid opportunity ID"),
	outcome: z.enum(["win", "loss", "no_award", "cancelled"]),
	debriefDate: z.date().optional(),
	debriefType: z.enum(["written", "oral", "none"]).optional(),
	technicalScore: z.number().min(0).optional(),
	technicalMaxScore: z.number().min(0).optional(),
	managementScore: z.number().min(0).optional(),
	managementMaxScore: z.number().min(0).optional(),
	pastPerfScore: z.number().min(0).optional(),
	pastPerfMaxScore: z.number().min(0).optional(),
	costScore: z.number().min(0).optional(),
	costMaxScore: z.number().min(0).optional(),
	overallRanking: z.number().int().min(1).optional(),
	totalBidders: z.number().int().min(1).optional(),
	winnerName: z.string().max(500).optional(),
	winnerId: z.string().uuid().optional(),
	winningPrice: z.number().min(0).optional(),
	evaluatorFeedback: z.string().optional(),
	strengthsIdentified: z.array(z.string()).optional(),
	weaknessesIdentified: z.array(z.string()).optional(),
	proposalInvestment: z.number().min(0).optional(),
	contractValue: z.number().min(0).optional(),
	organizationId: z.string().uuid().optional(),
});

const updateDebriefSchema = createDebriefSchema.partial().extend({
	internalAnalysis: z.string().optional(),
	lessonsLearned: z.array(z.string()).optional(),
	actionItems: z.array(z.object({
		id: z.string(),
		item: z.string(),
		assignee: z.string(),
		dueDate: z.string(),
		status: z.enum(["pending", "in_progress", "completed"]),
		completedAt: z.string().optional(),
	})).optional(),
	debriefDocument: z.string().optional(),
});

const actionItemSchema = z.object({
	id: z.string(),
	item: z.string().min(1, "Item description required"),
	assignee: z.string().min(1, "Assignee required"),
	dueDate: z.string(),
	status: z.enum(["pending", "in_progress", "completed"]),
	completedAt: z.string().optional(),
});

// ============================================================================
// Debrief CRUD Operations
// ============================================================================

/**
 * Create a new debrief record for a completed opportunity.
 * Captures outcome, scores, feedback, and initial analysis.
 */
export async function createDebrief(
	data: CreateDebriefInput
): Promise<ActionResult<Debrief>> {
	try {
		// Validate input
		const validated = createDebriefSchema.parse(data);
		const userContext = await requireWinLossContext(validated.organizationId);
		const organizationId = organizationForInsert(validated.organizationId, userContext);

		// Verify opportunity exists
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(assignedOpportunityByIdCondition(validated.opportunityId, userContext))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		// Check for existing debrief
		const [existing] = await db
			.select()
			.from(debriefs)
			.where(and(
				eq(debriefs.opportunityId, validated.opportunityId),
				mutableOrganizationCondition(debriefs.organizationId, userContext)
			))
			.limit(1);

		if (existing) {
			return { success: false, error: "Debrief already exists for this opportunity" };
		}

		// Create debrief record
		const [debrief] = await db
			.insert(debriefs)
			.values({
				opportunityId: validated.opportunityId,
				organizationId,
				outcome: validated.outcome,
				debriefDate: validated.debriefDate,
				debriefType: validated.debriefType,
				technicalScore: validated.technicalScore,
				technicalMaxScore: validated.technicalMaxScore,
				managementScore: validated.managementScore,
				managementMaxScore: validated.managementMaxScore,
				pastPerfScore: validated.pastPerfScore,
				pastPerfMaxScore: validated.pastPerfMaxScore,
				costScore: validated.costScore,
				costMaxScore: validated.costMaxScore,
				overallRanking: validated.overallRanking,
				totalBidders: validated.totalBidders,
				winnerName: validated.winnerName,
				winnerId: validated.winnerId,
				winningPrice: validated.winningPrice,
				evaluatorFeedback: validated.evaluatorFeedback,
				strengthsIdentified: validated.strengthsIdentified ?? [],
				weaknessesIdentified: validated.weaknessesIdentified ?? [],
				proposalInvestment: validated.proposalInvestment,
				contractValue: validated.contractValue,
				lessonsLearned: [],
				actionItems: [],
				createdAt: new Date(),
				updatedAt: new Date(),
				createdBy: userContext.userId,
			})
			.returning();

		// Update opportunity status based on outcome
		const statusMap: Record<string, string> = {
			win: "won",
			loss: "lost",
			no_award: "expired",
			cancelled: "declined",
		};

		await db
			.update(opportunities)
			.set({
				decisionStatus: statusMap[validated.outcome],
				updatedAt: new Date(),
			})
			.where(assignedOpportunityByIdCondition(validated.opportunityId, userContext));

		revalidatePath("/winloss");
		revalidatePath(`/opportunities/${validated.opportunityId}`);

		return { success: true, data: debrief };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues[0].message };
		}
		logger.error("[createDebrief]", error);
		return { success: false, error: "Failed to create debrief" };
	}
}

/**
 * Update an existing debrief with additional information.
 * Supports updating scores, analysis, lessons learned, and action items.
 */
export async function updateDebrief(
	id: string,
	data: UpdateDebriefInput
): Promise<ActionResult<Debrief>> {
	try {
		// Validate input
		const validated = updateDebriefSchema.parse(data);
		const userContext = await requireWinLossContext(validated.organizationId);

		// Verify debrief exists
		const [existing] = await db
			.select()
			.from(debriefs)
			.where(and(eq(debriefs.id, id), mutableOrganizationCondition(debriefs.organizationId, userContext)))
			.limit(1);

		if (!existing) {
			return { success: false, error: "Debrief not found" };
		}

		// Build update object, excluding undefined values
		const updateData: Partial<NewDebrief> = {
			updatedAt: new Date(),
		};

		if (validated.outcome !== undefined) updateData.outcome = validated.outcome;
		if (validated.debriefDate !== undefined) updateData.debriefDate = validated.debriefDate;
		if (validated.debriefType !== undefined) updateData.debriefType = validated.debriefType;
		if (validated.technicalScore !== undefined) updateData.technicalScore = validated.technicalScore;
		if (validated.technicalMaxScore !== undefined) updateData.technicalMaxScore = validated.technicalMaxScore;
		if (validated.managementScore !== undefined) updateData.managementScore = validated.managementScore;
		if (validated.managementMaxScore !== undefined) updateData.managementMaxScore = validated.managementMaxScore;
		if (validated.pastPerfScore !== undefined) updateData.pastPerfScore = validated.pastPerfScore;
		if (validated.pastPerfMaxScore !== undefined) updateData.pastPerfMaxScore = validated.pastPerfMaxScore;
		if (validated.costScore !== undefined) updateData.costScore = validated.costScore;
		if (validated.costMaxScore !== undefined) updateData.costMaxScore = validated.costMaxScore;
		if (validated.overallRanking !== undefined) updateData.overallRanking = validated.overallRanking;
		if (validated.totalBidders !== undefined) updateData.totalBidders = validated.totalBidders;
		if (validated.winnerName !== undefined) updateData.winnerName = validated.winnerName;
		if (validated.winnerId !== undefined) updateData.winnerId = validated.winnerId;
		if (validated.winningPrice !== undefined) updateData.winningPrice = validated.winningPrice;
		if (validated.evaluatorFeedback !== undefined) updateData.evaluatorFeedback = validated.evaluatorFeedback;
		if (validated.strengthsIdentified !== undefined) updateData.strengthsIdentified = validated.strengthsIdentified;
		if (validated.weaknessesIdentified !== undefined) updateData.weaknessesIdentified = validated.weaknessesIdentified;
		if (validated.proposalInvestment !== undefined) updateData.proposalInvestment = validated.proposalInvestment;
		if (validated.contractValue !== undefined) updateData.contractValue = validated.contractValue;
		if (validated.internalAnalysis !== undefined) updateData.internalAnalysis = validated.internalAnalysis;
		if (validated.lessonsLearned !== undefined) updateData.lessonsLearned = validated.lessonsLearned;
		if (validated.actionItems !== undefined) updateData.actionItems = validated.actionItems;
		if (validated.debriefDocument !== undefined) updateData.debriefDocument = validated.debriefDocument;

		const [updated] = await db
			.update(debriefs)
			.set(updateData)
			.where(and(eq(debriefs.id, id), mutableOrganizationCondition(debriefs.organizationId, userContext)))
			.returning();

		revalidatePath("/winloss");
		revalidatePath(`/winloss/${id}`);

		return { success: true, data: updated };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues[0].message };
		}
		logger.error("[updateDebrief]", error);
		return { success: false, error: "Failed to update debrief" };
	}
}

/**
 * Get a single debrief by ID with related opportunity data.
 */
export async function getDebrief(
	id: string
): Promise<ActionResult<Debrief & { opportunity?: typeof opportunities.$inferSelect }>> {
	try {
		const userContext = await requireWinLossContext();
		const [debrief] = await db
			.select()
			.from(debriefs)
			.where(and(eq(debriefs.id, id), mutableOrganizationCondition(debriefs.organizationId, userContext)))
			.limit(1);

		if (!debrief) {
			return { success: false, error: "Debrief not found" };
		}

		// Fetch related opportunity
		let opportunity: typeof opportunities.$inferSelect | undefined;
		if (debrief.opportunityId) {
			const [opp] = await db
				.select()
				.from(opportunities)
				.where(assignedOpportunityByIdCondition(debrief.opportunityId, userContext))
				.limit(1);
			opportunity = opp;
		}

		return {
			success: true,
			data: { ...debrief, opportunity },
		};
	} catch (error) {
		logger.error("[getDebrief]", error);
		return { success: false, error: "Failed to retrieve debrief" };
	}
}

/**
 * List debriefs with optional filtering.
 * Returns debriefs ordered by creation date descending.
 */
export async function listDebriefs(
	filters?: WinLossFilters
): Promise<ActionResult<Array<Debrief & { opportunityTitle?: string }>>> {
	try {
		const userContext = await requireWinLossContext(filters?.organizationId);
		const conditions: ReturnType<typeof eq>[] = [];
		conditions.push(mutableOrganizationCondition(debriefs.organizationId, userContext));

		// Apply filters
		if (filters?.outcome) {
			conditions.push(eq(debriefs.outcome, filters.outcome));
		}

		if (filters?.dateFrom) {
			conditions.push(gte(debriefs.createdAt, filters.dateFrom));
		}

		if (filters?.dateTo) {
			conditions.push(lte(debriefs.createdAt, filters.dateTo));
		}

		if (filters?.minValue !== undefined) {
			conditions.push(gte(debriefs.contractValue, filters.minValue));
		}

		if (filters?.maxValue !== undefined) {
			conditions.push(lte(debriefs.contractValue, filters.maxValue));
		}

		if (filters?.competitorId) {
			conditions.push(eq(debriefs.winnerId, filters.competitorId));
		}

		// Build query
		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const results = await db
			.select({
				debrief: debriefs,
				opportunityTitle: opportunities.title,
			})
			.from(debriefs)
			.leftJoin(opportunities, eq(debriefs.opportunityId, opportunities.id))
			.where(whereClause)
			.orderBy(desc(debriefs.createdAt));

		return {
			success: true,
			data: results.map(r => ({
				...r.debrief,
				opportunityTitle: r.opportunityTitle ?? undefined,
			})),
		};
	} catch (error) {
		logger.error("[listDebriefs]", error);
		return { success: false, error: "Failed to list debriefs" };
	}
}

/**
 * Delete a debrief record.
 * Removes the debrief and updates the associated opportunity status.
 */
export async function deleteDebrief(
	id: string
): Promise<ActionResult<{ deleted: boolean }>> {
	try {
		const userContext = await requireWinLossContext();
		// Fetch debrief to get opportunity ID
		const [existing] = await db
			.select()
			.from(debriefs)
			.where(and(eq(debriefs.id, id), mutableOrganizationCondition(debriefs.organizationId, userContext)))
			.limit(1);

		if (!existing) {
			return { success: false, error: "Debrief not found" };
		}

		// Delete the debrief
		await db.delete(debriefs).where(and(
			eq(debriefs.id, id),
			mutableOrganizationCondition(debriefs.organizationId, userContext)
		));

		// Reset opportunity status to pending
		if (existing.opportunityId) {
			await db
				.update(opportunities)
				.set({
					decisionStatus: "pending",
					updatedAt: new Date(),
				})
				.where(assignedOpportunityByIdCondition(existing.opportunityId, userContext));
		}

		revalidatePath("/winloss");

		return { success: true, data: { deleted: true } };
	} catch (error) {
		logger.error("[deleteDebrief]", error);
		return { success: false, error: "Failed to delete debrief" };
	}
}

// ============================================================================
// Pattern Analysis
// ============================================================================

/**
 * Analyze win/loss patterns across all debriefs using AI.
 * Identifies recurring themes, correlations, and actionable insights.
 */
export async function analyzeWinLossPatterns(): Promise<ActionResult<PatternAnalysis>> {
	try {
		const userContext = await requireWinLossContext();
		// Fetch all debriefs with opportunity data
		const allDebriefs = await db
			.select({
				debrief: debriefs,
				opportunity: opportunities,
			})
			.from(debriefs)
			.leftJoin(opportunities, eq(debriefs.opportunityId, opportunities.id))
			.where(mutableOrganizationCondition(debriefs.organizationId, userContext))
			.orderBy(desc(debriefs.createdAt));

		if (allDebriefs.length < 3) {
			return {
				success: false,
				error: "Insufficient data for pattern analysis. At least 3 debriefs required.",
			};
		}

		// Separate wins and losses
		const wins = allDebriefs.filter(d => d.debrief.outcome === "win");
		const losses = allDebriefs.filter(d => d.debrief.outcome === "loss");

		// Collect all strengths and weaknesses
		const allStrengths: string[] = [];
		const allWeaknesses: string[] = [];

		for (const d of allDebriefs) {
			const strengths = (d.debrief.strengthsIdentified as string[]) || [];
			const weaknesses = (d.debrief.weaknessesIdentified as string[]) || [];
			allStrengths.push(...strengths);
			allWeaknesses.push(...weaknesses);
		}

		// Calculate frequency maps
		const strengthFrequency = calculateFrequency(allStrengths);
		const weaknessFrequency = calculateFrequency(allWeaknesses);

		// Prepare data for AI analysis
		const manager = getProviderManager();
		await manager.initialize();

		let aiPatterns: Array<{
			patternType: string;
			patternName: string;
			description: string;
			winCorrelation: number;
			confidence: number;
			recommendations: Array<{ recommendation: string; priority: "high" | "medium" | "low"; effort: "low" | "medium" | "high" }>;
		}> = [];

		let insights: string[] = [];
		let recommendations: string[] = [];
		let overallConfidence = 0.5;

		if (await manager.isAvailable()) {
			try {
				const analysisResult = await performAIPatternAnalysis(
					allDebriefs,
					wins,
					losses,
					strengthFrequency,
					weaknessFrequency
				);
				aiPatterns = analysisResult.patterns;
				insights = analysisResult.insights;
				recommendations = analysisResult.recommendations;
				overallConfidence = analysisResult.confidence;
			} catch (aiError) {
				logger.warn("[analyzeWinLossPatterns] AI analysis failed:", aiError);
			}
		}

		// Generate heuristic patterns if AI unavailable
		if (aiPatterns.length === 0) {
			aiPatterns = generateHeuristicPatterns(
				wins,
				losses,
				strengthFrequency,
				weaknessFrequency
			);
			overallConfidence = 0.6;
		}

		// Store patterns in database
		const storedPatterns: WinLossPattern[] = [];

		for (const pattern of aiPatterns) {
			const [stored] = await db
				.insert(winLossPatterns)
				.values({
					patternType: pattern.patternType,
					organizationId: organizationForInsert(undefined, userContext),
					patternName: pattern.patternName,
					description: pattern.description,
					winCorrelation: pattern.winCorrelation,
					lossCorrelation: pattern.winCorrelation < 0 ? Math.abs(pattern.winCorrelation) : 0,
					confidence: pattern.confidence,
					occurrenceCount: allDebriefs.length,
					relatedDebriefs: allDebriefs.map(d => d.debrief.id),
					recommendations: pattern.recommendations,
					isActive: true,
					lastAnalyzedAt: new Date(),
					createdAt: new Date(),
					updatedAt: new Date(),
				})
				.returning();

			storedPatterns.push(stored);
		}

		// Generate default insights if none from AI
		if (insights.length === 0) {
			const winRate = losses.length > 0 ? (wins.length / (wins.length + losses.length)) * 100 : 100;
			insights.push(`Overall win rate: ${Math.round(winRate)}%`);
			insights.push(`Analyzed ${allDebriefs.length} completed proposals`);

			if (strengthFrequency.length > 0) {
				insights.push(`Top strength: "${strengthFrequency[0].item}" (${strengthFrequency[0].count} occurrences)`);
			}
			if (weaknessFrequency.length > 0) {
				insights.push(`Common weakness: "${weaknessFrequency[0].item}" (${weaknessFrequency[0].count} occurrences)`);
			}
		}

		// Generate default recommendations if none from AI
		if (recommendations.length === 0) {
			if (weaknessFrequency.length > 0) {
				recommendations.push(`Address recurring weakness: ${weaknessFrequency[0].item}`);
			}
			if (strengthFrequency.length > 0) {
				recommendations.push(`Leverage proven strength: ${strengthFrequency[0].item}`);
			}
			recommendations.push("Continue systematic debrief collection for improved pattern accuracy");
		}

		revalidatePath("/winloss/patterns");

		return {
			success: true,
			data: {
				patterns: storedPatterns,
				insights,
				recommendations,
				confidence: overallConfidence,
			},
		};
	} catch (error) {
		logger.error("[analyzeWinLossPatterns]", error);
		return { success: false, error: "Failed to analyze patterns" };
	}
}

/**
 * Calculate frequency of items in an array.
 */
function calculateFrequency(items: string[]): Array<{ item: string; count: number }> {
	const frequency = new Map<string, number>();

	for (const item of items) {
		const normalized = item.toLowerCase().trim();
		frequency.set(normalized, (frequency.get(normalized) || 0) + 1);
	}

	return Array.from(frequency.entries())
		.map(([item, count]) => ({ item, count }))
		.sort((a, b) => b.count - a.count);
}

/**
 * Perform AI-powered pattern analysis.
 */
async function performAIPatternAnalysis(
	allDebriefs: Array<{ debrief: Debrief; opportunity: typeof opportunities.$inferSelect | null }>,
	wins: Array<{ debrief: Debrief; opportunity: typeof opportunities.$inferSelect | null }>,
	losses: Array<{ debrief: Debrief; opportunity: typeof opportunities.$inferSelect | null }>,
	strengthFrequency: Array<{ item: string; count: number }>,
	weaknessFrequency: Array<{ item: string; count: number }>
): Promise<{
	patterns: Array<{
		patternType: string;
		patternName: string;
		description: string;
		winCorrelation: number;
		confidence: number;
		recommendations: Array<{ recommendation: string; priority: "high" | "medium" | "low"; effort: "low" | "medium" | "high" }>;
	}>;
	insights: string[];
	recommendations: string[];
	confidence: number;
}> {
	const manager = getProviderManager();

	const systemPrompt = `You are a proposal analytics expert analyzing win/loss patterns.

Output as JSON with this structure:
{
  "patterns": [
    {
      "patternType": "strength|weakness|process|competitor|pricing|team",
      "patternName": "<short name>",
      "description": "<detailed description>",
      "winCorrelation": <-1.0 to 1.0>,
      "confidence": <0.0 to 1.0>,
      "recommendations": [
        {"recommendation": "<action>", "priority": "high|medium|low", "effort": "low|medium|high"}
      ]
    }
  ],
  "insights": ["<insight1>", "<insight2>", ...],
  "recommendations": ["<overall recommendation1>", ...],
  "confidence": <0.0 to 1.0>
}

Guidelines:
1. Identify patterns that correlate with wins (positive correlation) and losses (negative correlation)
2. Focus on actionable, specific patterns
3. Consider technical, management, cost, and team-related patterns
4. Confidence should reflect data quality and sample size

Only output valid JSON.`;

	// Prepare summary data for analysis
	const debriefSummaries = allDebriefs.slice(0, 20).map(d => ({
		outcome: d.debrief.outcome,
		category: d.opportunity?.category,
		organization: d.opportunity?.organization,
		technicalScore: d.debrief.technicalScore,
		managementScore: d.debrief.managementScore,
		costScore: d.debrief.costScore,
		ranking: d.debrief.overallRanking,
		totalBidders: d.debrief.totalBidders,
		strengths: (d.debrief.strengthsIdentified as string[])?.slice(0, 3),
		weaknesses: (d.debrief.weaknessesIdentified as string[])?.slice(0, 3),
		feedback: d.debrief.evaluatorFeedback?.substring(0, 200),
	}));

	const userPrompt = `Analyze these win/loss patterns:

**Summary Statistics:**
- Total Proposals: ${allDebriefs.length}
- Wins: ${wins.length}
- Losses: ${losses.length}
- Win Rate: ${Math.round((wins.length / allDebriefs.length) * 100)}%

**Top Strengths (by frequency):**
${strengthFrequency.slice(0, 5).map(s => `- ${s.item}: ${s.count} occurrences`).join("\n")}

**Top Weaknesses (by frequency):**
${weaknessFrequency.slice(0, 5).map(w => `- ${w.item}: ${w.count} occurrences`).join("\n")}

**Recent Debriefs:**
${JSON.stringify(debriefSummaries, null, 2)}

Identify key patterns, insights, and recommendations.`;

	const response = await manager.complete({
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		temperature: 0.4,
		maxTokens: 2500,
	});

	const jsonMatch = response.content.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error("Invalid JSON response from AI");
	}

	return JSON.parse(jsonMatch[0]);
}

/**
 * Generate heuristic patterns when AI is unavailable.
 */
function generateHeuristicPatterns(
	wins: Array<{ debrief: Debrief; opportunity: typeof opportunities.$inferSelect | null }>,
	losses: Array<{ debrief: Debrief; opportunity: typeof opportunities.$inferSelect | null }>,
	strengthFrequency: Array<{ item: string; count: number }>,
	weaknessFrequency: Array<{ item: string; count: number }>
): Array<{
	patternType: string;
	patternName: string;
	description: string;
	winCorrelation: number;
	confidence: number;
	recommendations: Array<{ recommendation: string; priority: "high" | "medium" | "low"; effort: "low" | "medium" | "high" }>;
}> {
	const patterns: Array<{
		patternType: string;
		patternName: string;
		description: string;
		winCorrelation: number;
		confidence: number;
		recommendations: Array<{ recommendation: string; priority: "high" | "medium" | "low"; effort: "low" | "medium" | "high" }>;
	}> = [];

	// Add strength-based patterns
	if (strengthFrequency.length > 0) {
		patterns.push({
			patternType: "strength",
			patternName: `Strong ${strengthFrequency[0].item}`,
			description: `Identified as a strength in ${strengthFrequency[0].count} proposals. Appears to correlate with positive outcomes.`,
			winCorrelation: 0.6,
			confidence: 0.5 + Math.min(0.3, strengthFrequency[0].count * 0.1),
			recommendations: [
				{
					recommendation: `Continue emphasizing ${strengthFrequency[0].item} in proposals`,
					priority: "high",
					effort: "low",
				},
			],
		});
	}

	// Add weakness-based patterns
	if (weaknessFrequency.length > 0) {
		patterns.push({
			patternType: "weakness",
			patternName: `Recurring ${weaknessFrequency[0].item} Issue`,
			description: `Identified as a weakness in ${weaknessFrequency[0].count} proposals. May be contributing to losses.`,
			winCorrelation: -0.5,
			confidence: 0.5 + Math.min(0.3, weaknessFrequency[0].count * 0.1),
			recommendations: [
				{
					recommendation: `Develop action plan to address ${weaknessFrequency[0].item}`,
					priority: "high",
					effort: "medium",
				},
			],
		});
	}

	// Add pricing pattern if data available
	const avgWinCost = wins.filter(w => w.debrief.costScore).reduce((sum, w) => sum + (w.debrief.costScore || 0), 0) / wins.length || 0;
	const avgLossCost = losses.filter(l => l.debrief.costScore).reduce((sum, l) => sum + (l.debrief.costScore || 0), 0) / losses.length || 0;

	if (avgWinCost > 0 && avgLossCost > 0) {
		const costDiff = avgWinCost - avgLossCost;
		patterns.push({
			patternType: "pricing",
			patternName: "Cost Competitiveness",
			description: `Average cost score on wins: ${avgWinCost.toFixed(1)}, on losses: ${avgLossCost.toFixed(1)}`,
			winCorrelation: costDiff > 0 ? 0.4 : -0.4,
			confidence: 0.5,
			recommendations: [
				{
					recommendation: costDiff > 0
						? "Maintain competitive pricing strategy"
						: "Review pricing methodology for improved competitiveness",
					priority: "medium",
					effort: "medium",
				},
			],
		});
	}

	return patterns;
}

// ============================================================================
// Statistics and Metrics
// ============================================================================

/**
 * Get comprehensive win/loss statistics with filtering.
 * Calculates metrics across multiple dimensions.
 */
export async function getWinLossStatistics(
	filters?: WinLossFilters
): Promise<ActionResult<WinLossStats>> {
	try {
		const userContext = await requireWinLossContext(filters?.organizationId);
		const conditions: ReturnType<typeof eq>[] = [];
		conditions.push(mutableOrganizationCondition(debriefs.organizationId, userContext));

		// Apply filters
		if (filters?.outcome) {
			conditions.push(eq(debriefs.outcome, filters.outcome));
		}

		if (filters?.dateFrom) {
			conditions.push(gte(debriefs.createdAt, filters.dateFrom));
		}

		if (filters?.dateTo) {
			conditions.push(lte(debriefs.createdAt, filters.dateTo));
		}

		if (filters?.minValue !== undefined) {
			conditions.push(gte(debriefs.contractValue, filters.minValue));
		}

		if (filters?.maxValue !== undefined) {
			conditions.push(lte(debriefs.contractValue, filters.maxValue));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Get overall counts by outcome
		const outcomeCounts = await db
			.select({
				outcome: debriefs.outcome,
				count: count(),
			})
			.from(debriefs)
			.where(whereClause)
			.groupBy(debriefs.outcome);

		const outcomeMap: Record<string, number> = {};
		for (const row of outcomeCounts) {
			outcomeMap[row.outcome] = row.count;
		}

		const wins = outcomeMap["win"] || 0;
		const losses = outcomeMap["loss"] || 0;
		const noAward = outcomeMap["no_award"] || 0;
		const cancelled = outcomeMap["cancelled"] || 0;
		const totalProposals = wins + losses + noAward + cancelled;
		const winRate = totalProposals > 0 ? (wins / (wins + losses)) * 100 : 0;

		// Get average ranking
		const [rankingResult] = await db
			.select({
				avgRanking: avg(debriefs.overallRanking),
			})
			.from(debriefs)
			.where(and(whereClause, isNotNull(debriefs.overallRanking)));

		// Get financial metrics
		const [financialResult] = await db
			.select({
				totalContractValue: sum(debriefs.contractValue),
				totalInvestment: sum(debriefs.proposalInvestment),
			})
			.from(debriefs)
			.where(whereClause);

		const totalContractValue = Number(financialResult?.totalContractValue) || 0;
		const totalInvestment = Number(financialResult?.totalInvestment) || 0;
		const roi = totalInvestment > 0 ? ((totalContractValue - totalInvestment) / totalInvestment) * 100 : 0;

		// Get monthly breakdown (last 12 months)
		const twelveMonthsAgo = new Date();
		twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

		const monthlyResults = await db
			.select({
				month: sql<string>`TO_CHAR(${debriefs.createdAt}, 'YYYY-MM')`,
				outcome: debriefs.outcome,
				count: count(),
			})
			.from(debriefs)
			.where(and(whereClause, gte(debriefs.createdAt, twelveMonthsAgo)))
			.groupBy(sql`TO_CHAR(${debriefs.createdAt}, 'YYYY-MM')`, debriefs.outcome)
			.orderBy(asc(sql`TO_CHAR(${debriefs.createdAt}, 'YYYY-MM')`));

		// Aggregate monthly data
		const monthlyMap = new Map<string, { wins: number; losses: number }>();
		for (const row of monthlyResults) {
			const existing = monthlyMap.get(row.month) || { wins: 0, losses: 0 };
			if (row.outcome === "win") existing.wins += row.count;
			if (row.outcome === "loss") existing.losses += row.count;
			monthlyMap.set(row.month, existing);
		}

		const byMonth = Array.from(monthlyMap.entries()).map(([month, data]) => ({
			month,
			wins: data.wins,
			losses: data.losses,
			winRate: data.wins + data.losses > 0 ? (data.wins / (data.wins + data.losses)) * 100 : 0,
		}));

		// Get by agency (from opportunity organization)
		const agencyResults = await db
			.select({
				agency: opportunities.organization,
				outcome: debriefs.outcome,
				count: count(),
			})
			.from(debriefs)
			.leftJoin(opportunities, eq(debriefs.opportunityId, opportunities.id))
			.where(whereClause)
			.groupBy(opportunities.organization, debriefs.outcome);

		const agencyMap = new Map<string, { proposals: number; wins: number }>();
		for (const row of agencyResults) {
			const agency = row.agency || "Unknown";
			const existing = agencyMap.get(agency) || { proposals: 0, wins: 0 };
			existing.proposals += row.count;
			if (row.outcome === "win") existing.wins += row.count;
			agencyMap.set(agency, existing);
		}

		const byAgency = Array.from(agencyMap.entries())
			.map(([agency, data]) => ({
				agency,
				proposals: data.proposals,
				wins: data.wins,
				winRate: data.proposals > 0 ? (data.wins / data.proposals) * 100 : 0,
			}))
			.sort((a, b) => b.proposals - a.proposals)
			.slice(0, 10);

		// Get by competitor (from winner)
		const competitorResults = await db
			.select({
				competitor: debriefs.winnerName,
				outcome: debriefs.outcome,
				count: count(),
			})
			.from(debriefs)
			.where(and(whereClause, isNotNull(debriefs.winnerName)))
			.groupBy(debriefs.winnerName, debriefs.outcome);

		const competitorMap = new Map<string, { encounters: number; wins: number; losses: number }>();
		for (const row of competitorResults) {
			const competitor = row.competitor || "Unknown";
			const existing = competitorMap.get(competitor) || { encounters: 0, wins: 0, losses: 0 };
			existing.encounters += row.count;
			if (row.outcome === "win") existing.wins += row.count;
			if (row.outcome === "loss") existing.losses += row.count;
			competitorMap.set(competitor, existing);
		}

		const byCompetitor = Array.from(competitorMap.entries())
			.map(([competitor, data]) => ({
				competitor,
				encounters: data.encounters,
				wins: data.wins,
				losses: data.losses,
			}))
			.sort((a, b) => b.encounters - a.encounters)
			.slice(0, 10);

		// Get score breakdown (averages)
		const [scoreResult] = await db
			.select({
				technicalAvg: avg(sql`CASE WHEN ${debriefs.technicalMaxScore} > 0 THEN (${debriefs.technicalScore}::float / ${debriefs.technicalMaxScore}::float) * 100 ELSE NULL END`),
				managementAvg: avg(sql`CASE WHEN ${debriefs.managementMaxScore} > 0 THEN (${debriefs.managementScore}::float / ${debriefs.managementMaxScore}::float) * 100 ELSE NULL END`),
				pastPerfAvg: avg(sql`CASE WHEN ${debriefs.pastPerfMaxScore} > 0 THEN (${debriefs.pastPerfScore}::float / ${debriefs.pastPerfMaxScore}::float) * 100 ELSE NULL END`),
				costAvg: avg(sql`CASE WHEN ${debriefs.costMaxScore} > 0 THEN (${debriefs.costScore}::float / ${debriefs.costMaxScore}::float) * 100 ELSE NULL END`),
			})
			.from(debriefs)
			.where(whereClause);

		return {
			success: true,
			data: {
				totalProposals,
				wins,
				losses,
				noAward,
				cancelled,
				winRate: Math.round(winRate * 10) / 10,
				averageRanking: Number(rankingResult?.avgRanking) || 0,
				totalContractValue,
				totalInvestment,
				roi: Math.round(roi * 10) / 10,
				byMonth,
				byAgency,
				byCompetitor,
				scoreBreakdown: {
					technicalAvg: Number(scoreResult?.technicalAvg) || 0,
					managementAvg: Number(scoreResult?.managementAvg) || 0,
					pastPerfAvg: Number(scoreResult?.pastPerfAvg) || 0,
					costAvg: Number(scoreResult?.costAvg) || 0,
				},
			},
		};
	} catch (error) {
		logger.error("[getWinLossStatistics]", error);
		return { success: false, error: "Failed to calculate statistics" };
	}
}

/**
 * Generate AI-powered lessons learned report.
 * Synthesizes insights from all debriefs into actionable lessons.
 */
export async function generateLessonsLearnedReport(): Promise<ActionResult<LessonsReport>> {
	try {
		const userContext = await requireWinLossContext();
		// Fetch all debriefs with lessons
		const allDebriefs = await db
			.select()
			.from(debriefs)
			.where(mutableOrganizationCondition(debriefs.organizationId, userContext))
			.orderBy(desc(debriefs.createdAt));

		if (allDebriefs.length === 0) {
			return { success: false, error: "No debriefs available for analysis" };
		}

		// Collect all lessons, strengths, and weaknesses
		const allLessons: Array<{ lesson: string; outcome: string }> = [];
		const allStrengths: string[] = [];
		const allWeaknesses: string[] = [];

		for (const debrief of allDebriefs) {
			const lessons = (debrief.lessonsLearned as string[]) || [];
			for (const lesson of lessons) {
				allLessons.push({ lesson, outcome: debrief.outcome });
			}

			const strengths = (debrief.strengthsIdentified as string[]) || [];
			const weaknesses = (debrief.weaknessesIdentified as string[]) || [];
			allStrengths.push(...strengths);
			allWeaknesses.push(...weaknesses);
		}

		// Calculate lesson frequency
		const lessonFrequency = new Map<string, { count: number; outcomes: string[] }>();
		for (const { lesson, outcome } of allLessons) {
			const normalized = lesson.toLowerCase().trim();
			const existing = lessonFrequency.get(normalized) || { count: 0, outcomes: [] };
			existing.count++;
			existing.outcomes.push(outcome);
			lessonFrequency.set(normalized, existing);
		}

		// Categorize lessons
		const categorizedLessons = Array.from(lessonFrequency.entries())
			.map(([lesson, data]) => {
				const winCount = data.outcomes.filter(o => o === "win").length;
				const lossCount = data.outcomes.filter(o => o === "loss").length;
				const relatedOutcome = winCount >= lossCount ? "win" : "loss";

				// Simple categorization based on keywords
				let category = "general";
				const lessonLower = lesson.toLowerCase();
				if (lessonLower.includes("technical") || lessonLower.includes("approach")) category = "technical";
				else if (lessonLower.includes("price") || lessonLower.includes("cost")) category = "pricing";
				else if (lessonLower.includes("team") || lessonLower.includes("staff")) category = "team";
				else if (lessonLower.includes("manage") || lessonLower.includes("process")) category = "management";
				else if (lessonLower.includes("past perf") || lessonLower.includes("experience")) category = "experience";

				return {
					lesson,
					frequency: data.count,
					relatedOutcome: relatedOutcome as "win" | "loss",
					category,
				};
			})
			.sort((a, b) => b.frequency - a.frequency);

		// Get top strengths and weaknesses
		const strengthFrequency = calculateFrequency(allStrengths);
		const weaknessFrequency = calculateFrequency(allWeaknesses);

		const topStrengths = strengthFrequency.slice(0, 5).map(s => s.item);
		const topWeaknesses = weaknessFrequency.slice(0, 5).map(w => w.item);

		// Generate improvement areas
		const improvementAreas: string[] = [];
		for (const weakness of topWeaknesses) {
			improvementAreas.push(`Address recurring weakness: ${weakness}`);
		}

		// Use AI to enhance the report if available
		const manager = getProviderManager();
		await manager.initialize();

		if (await manager.isAvailable() && categorizedLessons.length >= 3) {
			try {
				const aiEnhancements = await enhanceLessonsReportWithAI(
					categorizedLessons,
					topStrengths,
					topWeaknesses
				);
				improvementAreas.push(...aiEnhancements.additionalImprovements);
			} catch (error) {
				logger.warn("[generateLessonsLearnedReport] AI enhancement failed:", error);
			}
		}

		return {
			success: true,
			data: {
				lessonsLearned: categorizedLessons,
				topStrengths,
				topWeaknesses,
				improvementAreas: Array.from(new Set(improvementAreas)).slice(0, 10),
				generatedAt: new Date(),
			},
		};
	} catch (error) {
		logger.error("[generateLessonsLearnedReport]", error);
		return { success: false, error: "Failed to generate lessons learned report" };
	}
}

/**
 * Enhance lessons report with AI analysis.
 */
async function enhanceLessonsReportWithAI(
	lessons: Array<{ lesson: string; frequency: number; relatedOutcome: "win" | "loss"; category: string }>,
	strengths: string[],
	weaknesses: string[]
): Promise<{ additionalImprovements: string[] }> {
	const manager = getProviderManager();

	const systemPrompt = `You are a proposal development expert synthesizing lessons learned.

Output as JSON:
{
  "additionalImprovements": ["<specific improvement action>", ...]
}

Focus on actionable, specific improvements based on patterns in the data. Maximum 5 improvements.
Only output valid JSON.`;

	const userPrompt = `Based on these lessons learned:

**Top Lessons:**
${lessons.slice(0, 10).map(l => `- ${l.lesson} (${l.frequency}x, mostly ${l.relatedOutcome}s)`).join("\n")}

**Top Strengths:** ${strengths.join(", ")}
**Top Weaknesses:** ${weaknesses.join(", ")}

What specific improvements should the organization prioritize?`;

	const response = await manager.complete({
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		temperature: 0.4,
		maxTokens: 500,
	});

	const jsonMatch = response.content.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		return { additionalImprovements: [] };
	}

	return JSON.parse(jsonMatch[0]);
}

/**
 * Calculate and store proposal ROI metrics.
 * Aggregates financial performance for a given time period.
 */
export async function calculateProposalROI(): Promise<ActionResult<ROIAnalysis>> {
	try {
		const userContext = await requireWinLossContext();
		const organizationId = organizationForInsert(undefined, userContext);
		// Get current period (last 12 months)
		const periodEnd = new Date();
		const periodStart = new Date();
		periodStart.setMonth(periodStart.getMonth() - 12);

		// Fetch debriefs in period
		const periodDebriefs = await db
			.select()
			.from(debriefs)
			.where(
				and(
					mutableOrganizationCondition(debriefs.organizationId, userContext),
					gte(debriefs.createdAt, periodStart),
					lte(debriefs.createdAt, periodEnd)
				)
			);

		if (periodDebriefs.length === 0) {
			return { success: false, error: "No debriefs in the analysis period" };
		}

		// Calculate metrics
		const wins = periodDebriefs.filter(d => d.outcome === "win");
		const losses = periodDebriefs.filter(d => d.outcome === "loss");

		const totalInvestment = periodDebriefs.reduce((sum, d) => sum + (d.proposalInvestment || 0), 0);
		const totalContractValue = wins.reduce((sum, d) => sum + (d.contractValue || 0), 0);

		const overallROI = totalInvestment > 0 ? ((totalContractValue - totalInvestment) / totalInvestment) * 100 : 0;
		const costPerWin = wins.length > 0 ? totalInvestment / wins.length : 0;
		const averageContractValue = wins.length > 0 ? totalContractValue / wins.length : 0;
		const averageProposalCost = periodDebriefs.length > 0 ? totalInvestment / periodDebriefs.length : 0;

		// Calculate trend (compare to previous period)
		const previousPeriodStart = new Date(periodStart);
		previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 12);

		const previousPeriodDebriefs = await db
			.select()
			.from(debriefs)
			.where(
				and(
					mutableOrganizationCondition(debriefs.organizationId, userContext),
					gte(debriefs.createdAt, previousPeriodStart),
					lte(debriefs.createdAt, periodStart)
				)
			);

		let trend: "improving" | "declining" | "stable" = "stable";
		if (previousPeriodDebriefs.length > 0) {
			const prevWins = previousPeriodDebriefs.filter(d => d.outcome === "win");
			const prevInvestment = previousPeriodDebriefs.reduce((sum, d) => sum + (d.proposalInvestment || 0), 0);
			const prevContractValue = prevWins.reduce((sum, d) => sum + (d.contractValue || 0), 0);
			const prevROI = prevInvestment > 0 ? ((prevContractValue - prevInvestment) / prevInvestment) * 100 : 0;

			if (overallROI > prevROI * 1.1) trend = "improving";
			else if (overallROI < prevROI * 0.9) trend = "declining";
		}

		// Calculate projected annual return
		const monthsInPeriod = 12;
		const monthlyContractValue = totalContractValue / monthsInPeriod;
		const projectedAnnualReturn = monthlyContractValue * 12;

		// Generate recommendations based on metrics
		const recommendations: string[] = [];

		if (overallROI < 100) {
			recommendations.push("Current ROI below 100% indicates investment exceeding returns. Consider more selective bidding.");
		}

		if (costPerWin > averageContractValue * 0.3) {
			recommendations.push("Proposal costs are high relative to contract value. Streamline proposal development process.");
		}

		const winRate = losses.length > 0 ? wins.length / (wins.length + losses.length) : 1;
		if (winRate < 0.3) {
			recommendations.push("Win rate below 30%. Consider pre-qualifying opportunities more rigorously.");
		}

		if (trend === "declining") {
			recommendations.push("ROI trend is declining. Review recent losses for correctable patterns.");
		}

		if (recommendations.length === 0) {
			recommendations.push("Maintain current bidding strategy with continued focus on high-probability opportunities.");
		}

		// Store ROI record
		await db.insert(proposalROI).values({
			organizationId,
			periodStart,
			periodEnd,
			totalProposals: periodDebriefs.length,
			totalWins: wins.length,
			totalLosses: losses.length,
			totalNoAward: periodDebriefs.filter(d => d.outcome === "no_award").length,
			totalInvestment,
			totalContractValue,
			winRate: winRate * 100,
			averageProposalCost,
			roi: overallROI,
			costPerWin,
			createdAt: new Date(),
		});

		revalidatePath("/winloss/roi");

		return {
			success: true,
			data: {
				overallROI: Math.round(overallROI * 10) / 10,
				costPerWin: Math.round(costPerWin),
				averageContractValue: Math.round(averageContractValue),
				averageProposalCost: Math.round(averageProposalCost),
				trend,
				projectedAnnualReturn: Math.round(projectedAnnualReturn),
				recommendations,
			},
		};
	} catch (error) {
		logger.error("[calculateProposalROI]", error);
		return { success: false, error: "Failed to calculate ROI" };
	}
}

// ============================================================================
// Improvement Areas
// ============================================================================

/**
 * Identify areas for improvement using AI analysis.
 * Analyzes patterns across debriefs to find actionable improvement opportunities.
 */
export async function identifyImprovementAreas(): Promise<ActionResult<ImprovementArea[]>> {
	try {
		const userContext = await requireWinLossContext();
		// Fetch debriefs with weaknesses
		const debriefsWithWeaknesses = await db
			.select({
				debrief: debriefs,
				opportunity: opportunities,
			})
			.from(debriefs)
			.leftJoin(opportunities, eq(debriefs.opportunityId, opportunities.id))
			.where(and(
				mutableOrganizationCondition(debriefs.organizationId, userContext),
				sql`jsonb_array_length(${debriefs.weaknessesIdentified}) > 0`
			))
			.orderBy(desc(debriefs.createdAt));

		if (debriefsWithWeaknesses.length === 0) {
			return { success: true, data: [] };
		}

		// Collect and categorize weaknesses
		const weaknessCategories = new Map<string, {
			weaknesses: string[];
			evidence: string[];
			outcomes: string[];
		}>();

		for (const { debrief, opportunity } of debriefsWithWeaknesses) {
			const weaknesses = (debrief.weaknessesIdentified as string[]) || [];

			for (const weakness of weaknesses) {
				// Categorize weakness
				const category = categorizeWeakness(weakness);
				const existing = weaknessCategories.get(category) || { weaknesses: [], evidence: [], outcomes: [] };
				existing.weaknesses.push(weakness);
				existing.evidence.push(`${opportunity?.title || "Unknown"}: ${weakness}`);
				existing.outcomes.push(debrief.outcome);
				weaknessCategories.set(category, existing);
			}
		}

		// Generate improvement areas
		const improvementAreas: ImprovementArea[] = [];

		for (const [area, data] of weaknessCategories.entries()) {
			const uniqueWeaknesses = Array.from(new Set(data.weaknesses));
			const lossRate = data.outcomes.filter(o => o === "loss").length / data.outcomes.length;

			// Determine impact based on frequency and loss correlation
			let impact: "high" | "medium" | "low" = "low";
			if (data.weaknesses.length >= 5 || lossRate >= 0.7) impact = "high";
			else if (data.weaknesses.length >= 3 || lossRate >= 0.5) impact = "medium";

			// Determine effort based on category
			let effort: "low" | "medium" | "high" = "medium";
			if (area === "pricing" || area === "team") effort = "high";
			if (area === "documentation" || area === "compliance") effort = "low";

			improvementAreas.push({
				area,
				description: `Identified ${uniqueWeaknesses.length} unique weakness patterns in "${area}" category across ${data.weaknesses.length} instances.`,
				impact,
				effort,
				evidence: data.evidence.slice(0, 5),
				suggestedActions: generateSuggestedActions(area, uniqueWeaknesses),
			});
		}

		// Sort by impact (high first) then by occurrence count
		improvementAreas.sort((a, b) => {
			const impactOrder = { high: 0, medium: 1, low: 2 };
			return impactOrder[a.impact] - impactOrder[b.impact];
		});

		// Enhance with AI if available
		const manager = getProviderManager();
		await manager.initialize();

		if (await manager.isAvailable() && improvementAreas.length > 0) {
			try {
				const enhancedAreas = await enhanceImprovementAreasWithAI(improvementAreas);
				return { success: true, data: enhancedAreas };
			} catch (error) {
				logger.warn("[identifyImprovementAreas] AI enhancement failed:", error);
			}
		}

		return { success: true, data: improvementAreas };
	} catch (error) {
		logger.error("[identifyImprovementAreas]", error);
		return { success: false, error: "Failed to identify improvement areas" };
	}
}

/**
 * Categorize a weakness into a general area.
 */
function categorizeWeakness(weakness: string): string {
	const weaknessLower = weakness.toLowerCase();

	if (weaknessLower.includes("price") || weaknessLower.includes("cost") || weaknessLower.includes("rate")) {
		return "pricing";
	}
	if (weaknessLower.includes("technical") || weaknessLower.includes("approach") || weaknessLower.includes("solution")) {
		return "technical";
	}
	if (weaknessLower.includes("team") || weaknessLower.includes("staff") || weaknessLower.includes("personnel") || weaknessLower.includes("resource")) {
		return "team";
	}
	if (weaknessLower.includes("experience") || weaknessLower.includes("past perf") || weaknessLower.includes("history")) {
		return "experience";
	}
	if (weaknessLower.includes("manage") || weaknessLower.includes("process") || weaknessLower.includes("schedule")) {
		return "management";
	}
	if (weaknessLower.includes("compli") || weaknessLower.includes("require") || weaknessLower.includes("document")) {
		return "compliance";
	}

	return "general";
}

/**
 * Generate suggested actions for an improvement area.
 */
function generateSuggestedActions(area: string, weaknesses: string[]): string[] {
	const actions: string[] = [];

	switch (area) {
		case "pricing":
			actions.push("Conduct competitive pricing analysis for similar opportunities");
			actions.push("Review labor rate structures and overhead allocation");
			actions.push("Develop more accurate cost estimation templates");
			break;
		case "technical":
			actions.push("Update technical approach templates with proven solutions");
			actions.push("Conduct technical capability gap analysis");
			actions.push("Develop more compelling innovation narratives");
			break;
		case "team":
			actions.push("Strengthen key personnel resumes and qualifications");
			actions.push("Develop succession planning documentation");
			actions.push("Identify and recruit for capability gaps");
			break;
		case "experience":
			actions.push("Document recent relevant contract performance");
			actions.push("Collect and organize client references");
			actions.push("Develop case studies for key project successes");
			break;
		case "management":
			actions.push("Update project management methodology documentation");
			actions.push("Develop risk management templates and examples");
			actions.push("Create quality assurance process documentation");
			break;
		case "compliance":
			actions.push("Develop comprehensive compliance checklists");
			actions.push("Improve proposal review process for requirements coverage");
			actions.push("Create templates for common compliance narratives");
			break;
		default:
			actions.push("Review and address specific weaknesses identified");
			actions.push("Implement systematic improvement tracking");
			break;
	}

	// Add weakness-specific actions
	for (const weakness of weaknesses.slice(0, 2)) {
		actions.push(`Address specific issue: "${weakness}"`);
	}

	return actions;
}

/**
 * Enhance improvement areas with AI suggestions.
 */
async function enhanceImprovementAreasWithAI(
	areas: ImprovementArea[]
): Promise<ImprovementArea[]> {
	const manager = getProviderManager();

	const systemPrompt = `You are a proposal improvement consultant.
For each improvement area, provide 1-2 additional specific, actionable suggestions.

Output as JSON array:
[
  {
    "area": "<area name>",
    "additionalActions": ["<action1>", "<action2>"]
  }
]

Only output valid JSON.`;

	const userPrompt = `Enhance these improvement areas with additional actions:

${areas.map(a => `**${a.area}** (${a.impact} impact):\n  Evidence: ${a.evidence.slice(0, 2).join("; ")}\n  Current actions: ${a.suggestedActions.slice(0, 2).join("; ")}`).join("\n\n")}`;

	const response = await manager.complete({
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		temperature: 0.4,
		maxTokens: 800,
	});

	const jsonMatch = response.content.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		return areas;
	}

	const enhancements = JSON.parse(jsonMatch[0]) as Array<{
		area: string;
		additionalActions: string[];
	}>;

	// Merge enhancements
	for (const area of areas) {
		const enhancement = enhancements.find(e => e.area === area.area);
		if (enhancement) {
			area.suggestedActions = [...area.suggestedActions, ...enhancement.additionalActions];
		}
	}

	return areas;
}

// ============================================================================
// Action Item Tracking
// ============================================================================

/**
 * Add or update an action item on a debrief.
 */
export async function trackDebriefActionItems(
	debriefId: string,
	actionItem: ActionItem
): Promise<ActionResult<Debrief>> {
	try {
		// Validate action item
		const validated = actionItemSchema.parse(actionItem);
		const userContext = await requireWinLossContext();

		// Fetch existing debrief
		const [existing] = await db
			.select()
			.from(debriefs)
			.where(and(eq(debriefs.id, debriefId), mutableOrganizationCondition(debriefs.organizationId, userContext)))
			.limit(1);

		if (!existing) {
			return { success: false, error: "Debrief not found" };
		}

		// Update action items
		const currentItems = (existing.actionItems as ActionItem[]) || [];
		const itemIndex = currentItems.findIndex(item => item.id === validated.id);

		if (itemIndex >= 0) {
			// Update existing item
			currentItems[itemIndex] = validated;
		} else {
			// Add new item
			currentItems.push(validated);
		}

		const [updated] = await db
			.update(debriefs)
			.set({
				actionItems: currentItems,
				updatedAt: new Date(),
			})
			.where(and(eq(debriefs.id, debriefId), mutableOrganizationCondition(debriefs.organizationId, userContext)))
			.returning();

		revalidatePath(`/winloss/${debriefId}`);

		return { success: true, data: updated };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues[0].message };
		}
		logger.error("[trackDebriefActionItems]", error);
		return { success: false, error: "Failed to track action item" };
	}
}

/**
 * Update the status of a specific action item.
 */
export async function updateActionItemStatus(
	debriefId: string,
	itemId: string,
	status: ActionItem["status"]
): Promise<ActionResult<Debrief>> {
	try {
		const userContext = await requireWinLossContext();
		// Fetch existing debrief
		const [existing] = await db
			.select()
			.from(debriefs)
			.where(and(eq(debriefs.id, debriefId), mutableOrganizationCondition(debriefs.organizationId, userContext)))
			.limit(1);

		if (!existing) {
			return { success: false, error: "Debrief not found" };
		}

		// Update action item status
		const currentItems = (existing.actionItems as ActionItem[]) || [];
		const itemIndex = currentItems.findIndex(item => item.id === itemId);

		if (itemIndex < 0) {
			return { success: false, error: "Action item not found" };
		}

		currentItems[itemIndex] = {
			...currentItems[itemIndex],
			status,
			completedAt: status === "completed" ? new Date().toISOString() : undefined,
		};

		const [updated] = await db
			.update(debriefs)
			.set({
				actionItems: currentItems,
				updatedAt: new Date(),
			})
			.where(and(eq(debriefs.id, debriefId), mutableOrganizationCondition(debriefs.organizationId, userContext)))
			.returning();

		revalidatePath(`/winloss/${debriefId}`);

		return { success: true, data: updated };
	} catch (error) {
		logger.error("[updateActionItemStatus]", error);
		return { success: false, error: "Failed to update action item status" };
	}
}

// ============================================================================
// Competitor Analysis
// ============================================================================

/**
 * Compare head-to-head performance against a specific competitor.
 */
export async function compareToCompetitors(
	competitorId: string
): Promise<ActionResult<CompetitorComparison>> {
	try {
		const userContext = await requireWinLossContext();
		// Fetch competitor
		const [competitor] = await db
			.select()
			.from(competitors)
			.where(and(
				eq(competitors.id, competitorId),
				visibleOrganizationCondition(competitors.organizationId, userContext)
			))
			.limit(1);

		if (!competitor) {
			return { success: false, error: "Competitor not found" };
		}

		// Find debriefs where this competitor won
		const competitorWins = await db
			.select({
				debrief: debriefs,
				opportunity: opportunities,
			})
			.from(debriefs)
			.leftJoin(opportunities, eq(debriefs.opportunityId, opportunities.id))
			.where(and(
				eq(debriefs.winnerId, competitorId),
				mutableOrganizationCondition(debriefs.organizationId, userContext)
			));

		// Find debriefs where we won against this competitor
		const ourWins = await db
			.select({
				debrief: debriefs,
				competitorLink: competitorOpportunities,
			})
			.from(debriefs)
			.leftJoin(competitorOpportunities, eq(debriefs.opportunityId, competitorOpportunities.opportunityId))
			.where(
				and(
					mutableOrganizationCondition(debriefs.organizationId, userContext),
					eq(debriefs.outcome, "win"),
					eq(competitorOpportunities.competitorId, competitorId)
				)
			);

		const totalEncounters = competitorWins.length + ourWins.length;
		const winRateAgainst = totalEncounters > 0
			? (ourWins.length / totalEncounters) * 100
			: 0;

		// Analyze patterns
		const strengthsVsThem: string[] = [];
		const weaknessesVsThem: string[] = [];

		// From our wins, collect our strengths
		for (const win of ourWins) {
			const strengths = (win.debrief.strengthsIdentified as string[]) || [];
			strengthsVsThem.push(...strengths);
		}

		// From their wins, collect our weaknesses
		for (const loss of competitorWins) {
			const weaknesses = (loss.debrief.weaknessesIdentified as string[]) || [];
			weaknessesVsThem.push(...weaknesses);
		}

		// Deduplicate and take top items
		const uniqueStrengths = Array.from(new Set(strengthsVsThem)).slice(0, 5);
		const uniqueWeaknesses = Array.from(new Set(weaknessesVsThem)).slice(0, 5);

		// Generate recommendations
		const recommendations: string[] = [];

		if (winRateAgainst < 50) {
			recommendations.push(`Improve competitiveness against ${competitor.name} by addressing common loss patterns`);
		}

		if (uniqueWeaknesses.length > 0) {
			recommendations.push(`Focus on addressing: ${uniqueWeaknesses[0]}`);
		}

		if (uniqueStrengths.length > 0) {
			recommendations.push(`Continue leveraging strength: ${uniqueStrengths[0]}`);
		}

		// Enhance with AI if available
		const manager = getProviderManager();
		await manager.initialize();

		if (await manager.isAvailable() && totalEncounters >= 3) {
			try {
				const aiRecommendations = await generateCompetitorRecommendationsAI(
					competitor,
					ourWins.length,
					competitorWins.length,
					uniqueStrengths,
					uniqueWeaknesses
				);
				recommendations.push(...aiRecommendations);
			} catch (error) {
				logger.warn("[compareToCompetitors] AI recommendations failed:", error);
			}
		}

		return {
			success: true,
			data: {
				competitorId,
				competitorName: competitor.name,
				totalEncounters,
				ourWins: ourWins.length,
				theirWins: competitorWins.length,
				winRateAgainst: Math.round(winRateAgainst * 10) / 10,
				strengthsVsThem: uniqueStrengths,
				weaknessesVsThem: uniqueWeaknesses,
				recommendations: Array.from(new Set(recommendations)).slice(0, 5),
			},
		};
	} catch (error) {
		logger.error("[compareToCompetitors]", error);
		return { success: false, error: "Failed to compare against competitor" };
	}
}

/**
 * Generate AI-powered competitor recommendations.
 */
async function generateCompetitorRecommendationsAI(
	competitor: typeof competitors.$inferSelect,
	ourWins: number,
	theirWins: number,
	strengths: string[],
	weaknesses: string[]
): Promise<string[]> {
	const manager = getProviderManager();

	const systemPrompt = `You are a competitive intelligence strategist.
Based on head-to-head performance data, provide 2-3 specific, actionable recommendations.

Output as JSON array of strings:
["<recommendation1>", "<recommendation2>", ...]

Be specific and strategic. Only output valid JSON array.`;

	const userPrompt = `Generate recommendations for competing against ${competitor.name}:

**Head-to-Head Record:**
- Our Wins: ${ourWins}
- Their Wins: ${theirWins}
- Win Rate: ${ourWins + theirWins > 0 ? Math.round((ourWins / (ourWins + theirWins)) * 100) : 0}%

**Our Strengths vs Them:** ${strengths.join(", ") || "Unknown"}
**Our Weaknesses vs Them:** ${weaknesses.join(", ") || "Unknown"}

**Competitor Profile:**
- Pricing Tendency: ${competitor.pricingTendency || "Unknown"}
- Known Strengths: ${competitor.strengths?.join(", ") || "Unknown"}
- Known Weaknesses: ${competitor.weaknesses?.join(", ") || "Unknown"}`;

	const response = await manager.complete({
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		temperature: 0.5,
		maxTokens: 400,
	});

	const jsonMatch = response.content.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		return [];
	}

	return JSON.parse(jsonMatch[0]) as string[];
}

// ============================================================================
// Export Functionality
// ============================================================================

function toCsvRow(values: unknown[]): string {
	return values
		.map((value) => {
			const text = value === null || value === undefined ? "" : String(value);
			return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
		})
		.join(",");
}

/**
 * Export win/loss report in specified format.
 * Generates downloadable report with comprehensive analytics.
 */
export async function exportWinLossReport(
	format: "pdf" | "csv"
): Promise<ActionResult<{ content: string; filename: string; mimeType: string }>> {
	try {
		await requireWinLossContext();
		// Fetch all required data
		const statisticsResult = await getWinLossStatistics();
		if (!statisticsResult.success) {
			return { success: false, error: statisticsResult.error };
		}

		const lessonsResult = await generateLessonsLearnedReport();
		const patternsResult = await analyzeWinLossPatterns();

		const stats = statisticsResult.data;
		const lessons = lessonsResult.success ? lessonsResult.data : null;
		const patterns = patternsResult.success ? patternsResult.data : null;

		const filename = `winloss-report-${new Date().toISOString().split("T")[0]}.${format}`;

		if (format === "csv") {
			const summaryData = [
				["Win/Loss Analysis Report"],
				["Generated", new Date().toISOString()],
				[""],
				["Overall Statistics"],
				["Total Proposals", stats.totalProposals],
				["Wins", stats.wins],
				["Losses", stats.losses],
				["No Award", stats.noAward],
				["Cancelled", stats.cancelled],
				["Win Rate", `${(stats.winRate * 100).toFixed(1)}%`],
				["Total Contract Value", stats.totalContractValue],
				["Total Investment", stats.totalInvestment],
				["ROI", stats.roi.toFixed(2)],
			];

			const patternsHeaders = ["Pattern Name", "Description", "Type", "Occurrences", "Win Correlation", "Confidence"];
			const patternsData = patterns?.patterns.map(p => [
				p.patternName,
				p.description ?? "",
				p.patternType,
				p.occurrenceCount ?? 0,
				(p.winCorrelation ?? 0).toFixed(3),
				(p.confidence ?? 0).toFixed(3),
			]) ?? [];

			// Lessons sheet data
			const lessonsHeaders = ["Lesson", "Category", "Outcome", "Frequency"];
			const lessonsData = lessons?.lessonsLearned.map(l => [
				l.lesson,
				l.category,
				l.relatedOutcome,
				l.frequency,
			]) ?? [];

			const csv = [
				...summaryData,
				[],
				["Patterns"],
				patternsHeaders,
				...patternsData,
				[],
				["Lessons Learned"],
				lessonsHeaders,
				...lessonsData,
			].map(toCsvRow).join("\n");

			return {
				success: true,
				data: {
					content: Buffer.from(csv, "utf-8").toString("base64"),
					filename,
					mimeType: "text/csv",
				},
			};
		} else {
			// Generate HTML report for PDF-like viewing
			const htmlContent = `
<!DOCTYPE html>
<html>
<head>
	<title>Win/Loss Analysis Report</title>
	<style>
		body { font-family: Arial, sans-serif; margin: 40px; }
		h1 { color: #1a365d; }
		h2 { color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
		table { border-collapse: collapse; width: 100%; margin: 20px 0; }
		th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
		th { background: #f7fafc; }
		.metric { font-size: 24px; font-weight: bold; color: #2d3748; }
		.metric-label { font-size: 14px; color: #718096; }
		.metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
		.metric-card { background: #f7fafc; padding: 20px; border-radius: 8px; }
	</style>
</head>
<body>
	<h1>Win/Loss Analysis Report</h1>
	<p>Generated: ${new Date().toLocaleDateString()}</p>

	<h2>Executive Summary</h2>
	<div class="metrics-grid">
		<div class="metric-card">
			<div class="metric">${stats.wins}/${stats.totalProposals}</div>
			<div class="metric-label">Wins / Total</div>
		</div>
		<div class="metric-card">
			<div class="metric">${(stats.winRate * 100).toFixed(1)}%</div>
			<div class="metric-label">Win Rate</div>
		</div>
		<div class="metric-card">
			<div class="metric">$${(stats.totalContractValue / 1000000).toFixed(1)}M</div>
			<div class="metric-label">Contract Value</div>
		</div>
	</div>

	${patterns && patterns.patterns.length > 0 ? `
	<h2>Key Patterns</h2>
	<table>
		<tr><th>Pattern</th><th>Type</th><th>Correlation</th><th>Confidence</th></tr>
		${patterns.patterns.slice(0, 10).map(p => `
			<tr>
				<td>${p.patternName ?? p.description ?? "N/A"}</td>
				<td>${p.patternType}</td>
				<td>${(p.winCorrelation ?? 0).toFixed(3)}</td>
				<td>${(p.confidence ?? 0).toFixed(3)}</td>
			</tr>
		`).join("")}
	</table>
	` : ""}

	${lessons && lessons.lessonsLearned.length > 0 ? `
	<h2>Lessons Learned</h2>
	<table>
		<tr><th>Lesson</th><th>Category</th><th>Outcome</th></tr>
		${lessons.lessonsLearned.slice(0, 10).map(l => `
			<tr>
				<td>${l.lesson}</td>
				<td>${l.category}</td>
				<td>${l.relatedOutcome}</td>
			</tr>
		`).join("")}
	</table>
	` : ""}
</body>
</html>`;

			return {
				success: true,
				data: {
					content: Buffer.from(htmlContent).toString("base64"),
					filename: filename.replace(".pdf", ".html"),
					mimeType: "text/html",
				},
			};
		}
	} catch (error) {
		logger.error("[exportWinLossReport]", error);
		return { success: false, error: "Failed to export report" };
	}
}

// ============================================================================
// AI Insights
// ============================================================================

/**
 * Get AI-generated insights for an opportunity or overall win/loss performance.
 */
export async function getWinLossInsights(
	opportunityId?: string
): Promise<ActionResult<string[]>> {
	try {
		const userContext = await requireWinLossContext();
		let contextData: {
			opportunity?: typeof opportunities.$inferSelect;
			debriefs: Debrief[];
			patterns: WinLossPattern[];
		};

		if (opportunityId) {
			// Get insights specific to an opportunity
			const [opportunity] = await db
				.select()
				.from(opportunities)
				.where(assignedOpportunityByIdCondition(opportunityId, userContext))
				.limit(1);

			if (!opportunity) {
				return { success: false, error: "Opportunity not found" };
			}

			const relatedDebriefs = await db
				.select()
				.from(debriefs)
				.where(
					and(
						mutableOrganizationCondition(debriefs.organizationId, userContext),
						or(
							eq(debriefs.opportunityId, opportunityId),
							sql`${debriefs.strengthsIdentified}::text ILIKE ${'%' + (opportunity.category || '') + '%'}`
						)
					)
				)
				.limit(10);

			const activePatterns = await db
				.select()
				.from(winLossPatterns)
				.where(and(
					eq(winLossPatterns.isActive, true),
					mutableOrganizationCondition(winLossPatterns.organizationId, userContext)
				))
				.limit(5);

			contextData = {
				opportunity,
				debriefs: relatedDebriefs,
				patterns: activePatterns,
			};
		} else {
			// Get general insights
			const recentDebriefs = await db
				.select()
				.from(debriefs)
				.where(mutableOrganizationCondition(debriefs.organizationId, userContext))
				.orderBy(desc(debriefs.createdAt))
				.limit(10);

			const activePatterns = await db
				.select()
				.from(winLossPatterns)
				.where(and(
					eq(winLossPatterns.isActive, true),
					mutableOrganizationCondition(winLossPatterns.organizationId, userContext)
				))
				.limit(5);

			contextData = {
				debriefs: recentDebriefs,
				patterns: activePatterns,
			};
		}

		// Generate insights with AI
		const manager = getProviderManager();
		await manager.initialize();

		if (!(await manager.isAvailable())) {
			// Return heuristic insights
			const insights: string[] = [];

			if (contextData.debriefs.length > 0) {
				const wins = contextData.debriefs.filter(d => d.outcome === "win");
				const winRate = wins.length / contextData.debriefs.length;
				insights.push(`Recent win rate: ${Math.round(winRate * 100)}%`);
			}

			if (contextData.patterns.length > 0) {
				insights.push(`${contextData.patterns.length} active patterns identified`);
			}

			if (contextData.opportunity) {
				insights.push(`Analyzing opportunity: ${contextData.opportunity.title}`);
			}

			return { success: true, data: insights };
		}

		const systemPrompt = `You are a proposal strategy advisor.
Based on win/loss data, provide 3-5 actionable insights.

Output as JSON array of strings:
["<insight1>", "<insight2>", ...]

Be specific, concise, and actionable. Only output valid JSON array.`;

		const userPrompt = opportunityId
			? `Generate insights for opportunity "${contextData.opportunity?.title}":

**Opportunity Details:**
- Category: ${contextData.opportunity?.category}
- Organization: ${contextData.opportunity?.organization}
- Budget: ${contextData.opportunity?.budgetValue}

**Relevant Historical Data:**
- ${contextData.debriefs.length} related debriefs
- ${contextData.patterns.length} active patterns

**Active Patterns:**
${contextData.patterns.map(p => `- ${p.patternName}: ${p.description?.substring(0, 100)}`).join("\n")}`
			: `Generate insights from recent win/loss performance:

**Recent Performance:**
- ${contextData.debriefs.length} recent debriefs
- Wins: ${contextData.debriefs.filter(d => d.outcome === "win").length}
- Losses: ${contextData.debriefs.filter(d => d.outcome === "loss").length}

**Active Patterns:**
${contextData.patterns.map(p => `- ${p.patternName} (correlation: ${p.winCorrelation?.toFixed(2)})`).join("\n")}`;

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
			return { success: true, data: ["Unable to generate AI insights at this time"] };
		}

		return { success: true, data: JSON.parse(jsonMatch[0]) as string[] };
	} catch (error) {
		logger.error("[getWinLossInsights]", error);
		return { success: false, error: "Failed to generate insights" };
	}
}

// ============================================================================
// Pattern Management
// ============================================================================

/**
 * List identified win/loss patterns.
 */
export async function getPatterns(
	filters?: { patternType?: string }
): Promise<ActionResult<WinLossPattern[]>> {
	try {
		const userContext = await requireWinLossContext();
		const conditions: ReturnType<typeof eq>[] = [];
		conditions.push(mutableOrganizationCondition(winLossPatterns.organizationId, userContext));

		if (filters?.patternType) {
			conditions.push(eq(winLossPatterns.patternType, filters.patternType));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const patterns = await db
			.select()
			.from(winLossPatterns)
			.where(whereClause)
			.orderBy(desc(winLossPatterns.confidence), desc(winLossPatterns.occurrenceCount));

		return { success: true, data: patterns };
	} catch (error) {
		logger.error("[getPatterns]", error);
		return { success: false, error: "Failed to retrieve patterns" };
	}
}

/**
 * Acknowledge a pattern as reviewed.
 */
export async function acknowledgePattern(
	patternId: string
): Promise<ActionResult<WinLossPattern>> {
	try {
		const userContext = await requireWinLossContext();
		const [updated] = await db
			.update(winLossPatterns)
			.set({
				lastAnalyzedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(and(
				eq(winLossPatterns.id, patternId),
				mutableOrganizationCondition(winLossPatterns.organizationId, userContext)
			))
			.returning();

		if (!updated) {
			return { success: false, error: "Pattern not found" };
		}

		revalidatePath("/winloss/patterns");

		return { success: true, data: updated };
	} catch (error) {
		logger.error("[acknowledgePattern]", error);
		return { success: false, error: "Failed to acknowledge pattern" };
	}
}

// ============================================================================
// Dashboard Metrics
// ============================================================================

/**
 * Get summary metrics for the win/loss dashboard.
 */
export async function getDashboardMetrics(): Promise<ActionResult<DashboardMetrics>> {
	try {
		const userContext = await requireWinLossContext();
		// Total debriefs count
		const [debriefCount] = await db
			.select({ count: count() })
			.from(debriefs)
			.where(mutableOrganizationCondition(debriefs.organizationId, userContext));

		// Recent win rate (last 6 months)
		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

		const recentDebriefs = await db
			.select()
			.from(debriefs)
			.where(and(
				mutableOrganizationCondition(debriefs.organizationId, userContext),
				gte(debriefs.createdAt, sixMonthsAgo)
			));

		const recentWins = recentDebriefs.filter(d => d.outcome === "win");
		const recentLosses = recentDebriefs.filter(d => d.outcome === "loss");
		const recentWinRate = recentWins.length + recentLosses.length > 0
			? (recentWins.length / (recentWins.length + recentLosses.length)) * 100
			: 0;

		// Total contract value won
		const [valueResult] = await db
			.select({ total: sum(debriefs.contractValue) })
			.from(debriefs)
			.where(and(
				mutableOrganizationCondition(debriefs.organizationId, userContext),
				eq(debriefs.outcome, "win")
			));

		// Pending action items
		const allDebriefs = await db
			.select()
			.from(debriefs)
			.where(mutableOrganizationCondition(debriefs.organizationId, userContext));
		let pendingActionItems = 0;
		for (const debrief of allDebriefs) {
			const items = (debrief.actionItems as ActionItem[]) || [];
			pendingActionItems += items.filter(i => i.status !== "completed").length;
		}

		// Active patterns count
		const [patternCount] = await db
			.select({ count: count() })
			.from(winLossPatterns)
			.where(and(
				eq(winLossPatterns.isActive, true),
				mutableOrganizationCondition(winLossPatterns.organizationId, userContext)
			));

		// Calculate ROI
		const [investmentResult] = await db
			.select({ total: sum(debriefs.proposalInvestment) })
			.from(debriefs)
			.where(mutableOrganizationCondition(debriefs.organizationId, userContext));

		const totalContractValue = Number(valueResult?.total) || 0;
		const totalInvestment = Number(investmentResult?.total) || 0;
		const roi = totalInvestment > 0 ? ((totalContractValue - totalInvestment) / totalInvestment) * 100 : 0;

		// Trend direction (compare last 3 months to previous 3 months)
		const threeMonthsAgo = new Date();
		threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

		const recentThreeMonths = recentDebriefs.filter(d => d.createdAt && d.createdAt >= threeMonthsAgo);
		const previousThreeMonths = recentDebriefs.filter(
			d => d.createdAt && d.createdAt < threeMonthsAgo && d.createdAt >= sixMonthsAgo
		);

		const recentWinRateThree = recentThreeMonths.filter(d => d.outcome === "win").length /
			Math.max(1, recentThreeMonths.filter(d => d.outcome === "win" || d.outcome === "loss").length);
		const previousWinRateThree = previousThreeMonths.filter(d => d.outcome === "win").length /
			Math.max(1, previousThreeMonths.filter(d => d.outcome === "win" || d.outcome === "loss").length);

		let trendDirection: "up" | "down" | "stable" = "stable";
		if (recentWinRateThree > previousWinRateThree * 1.1) trendDirection = "up";
		else if (recentWinRateThree < previousWinRateThree * 0.9) trendDirection = "down";

		// Recent debriefs with opportunity info
		const recentDebriefsWithOpps = await db
			.select({
				id: debriefs.id,
				opportunityTitle: opportunities.title,
				outcome: debriefs.outcome,
				debriefDate: debriefs.debriefDate,
			})
			.from(debriefs)
			.leftJoin(opportunities, eq(debriefs.opportunityId, opportunities.id))
			.where(mutableOrganizationCondition(debriefs.organizationId, userContext))
			.orderBy(desc(debriefs.createdAt))
			.limit(5);

		return {
			success: true,
			data: {
				totalDebriefs: Number(debriefCount.count),
				recentWinRate: Math.round(recentWinRate * 10) / 10,
				totalContractValueWon: totalContractValue,
				pendingActionItems,
				activePatterns: Number(patternCount.count),
				roi: Math.round(roi * 10) / 10,
				trendDirection,
				recentDebriefs: recentDebriefsWithOpps.map(d => ({
					id: d.id,
					opportunityTitle: d.opportunityTitle || "Unknown",
					outcome: d.outcome,
					debriefDate: d.debriefDate,
				})),
			},
		};
	} catch (error) {
		logger.error("[getDashboardMetrics]", error);
		return { success: false, error: "Failed to get dashboard metrics" };
	}
}

// ============================================================================
// Debrief Timeline
// ============================================================================

/**
 * Get timeline of events for a debrief.
 */
export async function getDebriefTimeline(
	opportunityId: string
): Promise<ActionResult<DebriefTimelineEvent[]>> {
	try {
		const userContext = await requireWinLossContext();
		// Fetch debrief for this opportunity
		const [debrief] = await db
			.select()
			.from(debriefs)
			.where(and(
				eq(debriefs.opportunityId, opportunityId),
				mutableOrganizationCondition(debriefs.organizationId, userContext)
			))
			.limit(1);

		if (!debrief) {
			return { success: true, data: [] };
		}

		const events: DebriefTimelineEvent[] = [];

		// Add creation event
		if (debrief.createdAt) {
			events.push({
				id: `${debrief.id}-created`,
				eventType: "created",
				timestamp: debrief.createdAt,
				description: `Debrief record created with outcome: ${debrief.outcome}`,
				actor: debrief.createdBy || "System",
			});
		}

		// Add debrief requested event
		if (debrief.debriefRequestedAt) {
			events.push({
				id: `${debrief.id}-requested`,
				eventType: "debrief_requested",
				timestamp: debrief.debriefRequestedAt,
				description: "Formal debrief requested from contracting officer",
			});
		}

		// Add debrief received event
		if (debrief.debriefReceivedAt) {
			events.push({
				id: `${debrief.id}-received`,
				eventType: "debrief_received",
				timestamp: debrief.debriefReceivedAt,
				description: `Debrief received (${debrief.debriefType || "type unknown"})`,
			});
		}

		// Add analysis completed if internal analysis exists
		if (debrief.internalAnalysis && debrief.updatedAt) {
			events.push({
				id: `${debrief.id}-analyzed`,
				eventType: "analysis_completed",
				timestamp: debrief.updatedAt,
				description: "Internal analysis completed",
			});
		}

		// Add action item completion events
		const actionItems = (debrief.actionItems as ActionItem[]) || [];
		for (const item of actionItems) {
			if (item.status === "completed" && item.completedAt) {
				events.push({
					id: `${debrief.id}-action-${item.id}`,
					eventType: "action_item_completed",
					timestamp: new Date(item.completedAt),
					description: `Action item completed: ${item.item.substring(0, 50)}...`,
					actor: item.assignee,
				});
			}
		}

		// Sort by timestamp descending
		events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

		return { success: true, data: events };
	} catch (error) {
		logger.error("[getDebriefTimeline]", error);
		return { success: false, error: "Failed to get debrief timeline" };
	}
}
