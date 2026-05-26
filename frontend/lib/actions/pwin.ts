/**
 * Predictive Win Probability Engine Server Actions - DocFusion
 *
 * Comprehensive server actions for managing PWin (Probability of Win) assessments,
 * factor management, sensitivity analysis, portfolio optimization, and model training.
 *
 * Features:
 * - PWin factor CRUD with default factor initialization
 * - PWin assessment calculation with weighted averages
 * - Sensitivity analysis and what-if scenarios
 * - AI-powered recommendations for improving PWin
 * - Portfolio optimization for opportunity prioritization
 * - Model training and performance evaluation
 * - Forecasting and calibration
 * - Historical tracking and comparison
 *
 * The PWin calculation uses a weighted average approach:
 *   PWin = Σ(factor_score × factor_weight) / Σ(max_score × factor_weight)
 *
 * Default factors include:
 * - Customer Relationship (25% weight)
 * - Incumbent Status (15% weight)
 * - Solution Fit (20% weight)
 * - Price Competitiveness (15% weight)
 * - Past Performance Match (10% weight)
 * - Team Qualifications (10% weight)
 * - Competitive Position (5% weight)
 */

"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import {
	pwinFactors,
	pwinAssessments,
	pwinModelPerformance,
	portfolioOptimizations,
	type PwinFactor,
	type NewPwinFactor,
	type PwinAssessment,
	type NewPwinAssessment,
	type PwinModelPerformance,
	type NewPwinModelPerformance,
	type PortfolioOptimization,
	type NewPortfolioOptimization,
} from "@/lib/db/schema-pwin";
import { opportunities } from "@/lib/db/schema";
import { debriefs } from "@/lib/db/schema-winloss";
import { eq, and, desc, asc, sql, gte, lte, inArray, count, avg, sum, isNotNull, or, isNull, type SQL } from "drizzle-orm";
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
type PwinUserContext = UserContext & { organizationId: string };

async function requirePwinContext(organizationId?: string | null): Promise<PwinUserContext> {
	const userContext = await requireUserContext();
	if (!userContext.organizationId) {
		throw new Error("Organization context required");
	}
	if (organizationId && organizationId !== userContext.organizationId) {
		throw new Error("Unauthorized");
	}
	return userContext as PwinUserContext;
}

function visibleOrganizationCondition(column: OrganizationColumn, userContext: PwinUserContext) {
	return or(isNull(column), eq(column, userContext.organizationId));
}

function mutableOrganizationCondition(column: OrganizationColumn, userContext: PwinUserContext) {
	return eq(column, userContext.organizationId);
}

function organizationForInsert(inputOrganizationId: string | undefined, userContext: PwinUserContext): string {
	return inputOrganizationId ?? userContext.organizationId;
}

function visibleOpportunityCondition(opportunityId: string, userContext: PwinUserContext) {
	return and(
		eq(opportunities.id, opportunityId),
		or(eq(opportunities.organizationId, userContext.organizationId), isNull(opportunities.organizationId))!,
		eq(opportunities.assignedTo, userContext.userId)
	);
}

function assignedOpportunityConditions(userContext: PwinUserContext, conditions: SQL[] = []): SQL {
	return and(
		or(eq(opportunities.organizationId, userContext.organizationId), isNull(opportunities.organizationId))!,
		eq(opportunities.assignedTo, userContext.userId),
		...conditions
	)!;
}

/**
 * Factor score entry for PWin assessment.
 */
export interface FactorScore {
	factorId: string;
	factorName: string;
	score: number;
	weight: number;
	notes?: string;
}

/**
 * Sensitivity analysis result showing impact of improving each factor.
 */
export interface SensitivityResult {
	factorId: string;
	factorName: string;
	currentScore: number;
	maxScore: number;
	weight: number;
	impactIfMaximized: number;
	impactPerPoint: number;
	improvementPotential: number;
	priority: "high" | "medium" | "low";
}

/**
 * AI-generated recommendation for improving PWin.
 */
export interface PwinRecommendation {
	recommendation: string;
	priority: "high" | "medium" | "low";
	factorId?: string;
	factorName?: string;
	expectedImpact: number;
	effort: "low" | "medium" | "high";
	timeframe: "immediate" | "short_term" | "long_term";
}

/**
 * Risk factor identified in PWin assessment.
 */
export interface PwinRisk {
	riskId: string;
	riskType: "score_gap" | "declining_trend" | "competitive_threat" | "timeline" | "resource";
	severity: "high" | "medium" | "low";
	description: string;
	relatedFactorId?: string;
	mitigationActions: string[];
}

/**
 * Comprehensive PWin report structure.
 */
export interface PwinReport {
	opportunityId: string;
	opportunityName: string;
	currentPwin: number;
	targetPwin?: number;
	pwinGap: number;
	assessmentDate: Date;
	factorScores: FactorScore[];
	sensitivityAnalysis: SensitivityResult[];
	recommendations: PwinRecommendation[];
	risks: PwinRisk[];
	historicalTrend: Array<{ date: string; pwin: number }>;
	confidenceInterval: { lower: number; upper: number; confidence: number };
	generatedAt: Date;
}

/**
 * Portfolio optimization parameters.
 */
export interface OptimizationParams {
	optimizationType: "maximize_wins" | "maximize_value" | "balanced";
	resourceConstraint?: number;
	minPwin?: number;
	maxOpportunities?: number;
	includeOpportunityIds?: string[];
	excludeOpportunityIds?: string[];
	organizationId?: string;
}

/**
 * Opportunity comparison result.
 */
export interface OpportunityComparison {
	opportunityId: string;
	opportunityName: string;
	pwin: number;
	contractValue: number;
	expectedValue: number;
	factorBreakdown: FactorScore[];
	strengthsVsOthers: string[];
	weaknessesVsOthers: string[];
	rank: number;
}

/**
 * Ranking filters for opportunity list.
 */
export interface RankingFilters {
	minPwin?: number;
	maxPwin?: number;
	minValue?: number;
	maxValue?: number;
	stage?: string;
	sortBy?: "pwin" | "value" | "expected_value" | "recent";
	limit?: number;
	organizationId?: string;
}

/**
 * Portfolio-level metrics.
 */
export interface PortfolioMetrics {
	totalOpportunities: number;
	totalPipelineValue: number;
	weightedPipelineValue: number;
	averagePwin: number;
	expectedWins: number;
	atRiskCount: number;
	pwinDistribution: Array<{ range: string; count: number; value: number }>;
	topOpportunities: Array<{ id: string; name: string; pwin: number; value: number }>;
	riskConcentration: number;
	diversificationScore: number;
	byCategory?: Record<string, { count: number; value: number; avgPwin: number }>;
}

/**
 * Model training parameters.
 */
export interface TrainingParams {
	modelType?: "weighted_avg" | "logistic" | "neural" | "ensemble";
	validationSplit?: number;
	featureSelection?: "all" | "top_n" | "correlation";
	topNFeatures?: number;
	organizationId?: string;
}

/**
 * Model performance evaluation result.
 */
export interface ModelEvaluation {
	modelVersion: string;
	modelType: string;
	accuracy: number;
	precision: number;
	recall: number;
	f1Score: number;
	auc: number;
	brierScore: number;
	calibrationData: Array<{ predictedBucket: number; actualWinRate: number; count: number }>;
	featureImportance: Array<{ factorId: string; factorName: string; importance: number; rank: number }>;
	recommendations: string[];
	isActive: boolean;
	trainedAt: Date;
	trainingSetSize: number;
	testSetSize: number;
}

/**
 * Forecast result for pipeline opportunities.
 */
export interface PwinForecast {
	opportunities: Array<{
		opportunityId: string;
		opportunityName: string;
		predictedPwin: number;
		confidenceInterval: { lower: number; upper: number };
		predictedOutcome: "win" | "loss" | "uncertain";
		probability: number;
	}>;
	aggregateMetrics: {
		expectedWins: number;
		expectedValue: number;
		confidenceLevel: number;
	};
	generatedAt: Date;
}

/**
 * Calibration statistics for model.
 */
export interface CalibrationData {
	buckets: Array<{
		predictedRange: { min: number; max: number };
		count: number;
		actualWins: number;
		actualWinRate: number;
		expectedWinRate: number;
		calibrationError: number;
	}>;
	overallCalibrationError: number;
	brierScore: number;
	reliability: number;
	resolution: number;
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

const createFactorSchema = z.object({
	factorName: z.string().min(1).max(200),
	factorCategory: z.enum(["customer", "solution", "competition", "team", "price", "contract", "past_performance"]),
	description: z.string().optional(),
	weight: z.number().min(0).max(10).default(1),
	minScore: z.number().min(0).default(0),
	maxScore: z.number().min(1).default(10),
	scoringGuidelines: z.array(z.object({
		score: z.number(),
		description: z.string(),
	})).optional(),
	organizationId: z.string().uuid().optional(),
});

type CreateFactorInput = z.infer<typeof createFactorSchema>;

const updateFactorSchema = createFactorSchema.partial().extend({
	isActive: z.boolean().optional(),
	winCorrelation: z.number().min(-1).max(1).optional(),
});

type UpdateFactorInput = z.infer<typeof updateFactorSchema>;

const factorScoreSchema = z.object({
	factorId: z.string().uuid(),
	factorName: z.string(),
	score: z.number().min(0),
	weight: z.number().min(0),
	notes: z.string().optional(),
});

const assessPwinSchema = z.object({
	opportunityId: z.string().uuid(),
	scores: z.array(factorScoreSchema),
	assessmentType: z.enum(["initial", "mid_capture", "final", "gate_review"]).optional(),
	assessedBy: z.string().optional(),
	notes: z.string().optional(),
	organizationId: z.string().uuid().optional(),
});

type AssessPwinInput = z.infer<typeof assessPwinSchema>;

const optimizationParamsSchema = z.object({
	optimizationType: z.enum(["maximize_wins", "maximize_value", "balanced"]),
	resourceConstraint: z.number().min(0).optional(),
	minPwin: z.number().min(0).max(100).optional(),
	maxOpportunities: z.number().int().min(1).optional(),
	includeOpportunityIds: z.array(z.string().uuid()).optional(),
	excludeOpportunityIds: z.array(z.string().uuid()).optional(),
	organizationId: z.string().uuid().optional(),
});

const rankingFiltersSchema = z.object({
	minPwin: z.number().min(0).max(100).optional(),
	maxPwin: z.number().min(0).max(100).optional(),
	minValue: z.number().min(0).optional(),
	maxValue: z.number().min(0).optional(),
	stage: z.string().optional(),
	sortBy: z.enum(["pwin", "value", "expected_value", "recent"]).optional(),
	limit: z.number().int().min(1).max(100).optional(),
	organizationId: z.string().uuid().optional(),
});

const trainingParamsSchema = z.object({
	modelType: z.enum(["weighted_avg", "logistic", "neural", "ensemble"]).optional(),
	validationSplit: z.number().min(0.1).max(0.5).optional(),
	featureSelection: z.enum(["all", "top_n", "correlation"]).optional(),
	topNFeatures: z.number().int().min(1).max(20).optional(),
	organizationId: z.string().uuid().optional(),
});

// ============================================================================
// Default Factors Configuration
// ============================================================================

/**
 * Default PWin factors with standard weights and scoring guidelines.
 * These represent industry-standard factors for government contracting PWin assessment.
 */
const DEFAULT_FACTORS: Omit<CreateFactorInput, "organizationId">[] = [
	{
		factorName: "Customer Relationship",
		factorCategory: "customer",
		description: "Strength of existing relationship with the customer, including access to decision-makers, understanding of requirements, and historical interactions.",
		weight: 2.5,
		minScore: 0,
		maxScore: 10,
		scoringGuidelines: [
			{ score: 0, description: "No existing relationship" },
			{ score: 2, description: "Limited contact, primarily through RFI/RFP responses" },
			{ score: 4, description: "Some relationship through small contracts or meetings" },
			{ score: 6, description: "Good relationship with program staff" },
			{ score: 8, description: "Strong relationship with access to key decision-makers" },
			{ score: 10, description: "Exceptional relationship with trusted advisor status" },
		],
	},
	{
		factorName: "Incumbent Status",
		factorCategory: "competition",
		description: "Current position relative to incumbent contractor, considering recompete advantages and customer satisfaction with incumbent performance.",
		weight: 1.5,
		minScore: 0,
		maxScore: 10,
		scoringGuidelines: [
			{ score: 0, description: "Strong incumbent with excellent performance" },
			{ score: 3, description: "Incumbent with acceptable performance" },
			{ score: 5, description: "No incumbent or new requirement" },
			{ score: 7, description: "Incumbent with poor performance, opportunity to displace" },
			{ score: 10, description: "We are the incumbent with strong performance" },
		],
	},
	{
		factorName: "Solution Fit",
		factorCategory: "solution",
		description: "Alignment between customer requirements and our proposed technical solution, including innovation and differentiation.",
		weight: 2.0,
		minScore: 0,
		maxScore: 10,
		scoringGuidelines: [
			{ score: 0, description: "Solution does not meet requirements" },
			{ score: 2, description: "Solution meets basic requirements with significant gaps" },
			{ score: 4, description: "Solution meets most requirements" },
			{ score: 6, description: "Solution meets all requirements" },
			{ score: 8, description: "Solution exceeds requirements with clear differentiators" },
			{ score: 10, description: "Best-in-class solution with compelling innovation" },
		],
	},
	{
		factorName: "Price Competitiveness",
		factorCategory: "price",
		description: "Competitiveness of our pricing relative to expected competition and customer budget expectations.",
		weight: 1.5,
		minScore: 0,
		maxScore: 10,
		scoringGuidelines: [
			{ score: 0, description: "Price significantly above market and budget" },
			{ score: 2, description: "Price above typical market rates" },
			{ score: 4, description: "Price competitive but not lowest" },
			{ score: 6, description: "Price competitive with good value proposition" },
			{ score: 8, description: "Competitive price with demonstrated value" },
			{ score: 10, description: "Best value pricing with clear cost advantages" },
		],
	},
	{
		factorName: "Past Performance Match",
		factorCategory: "past_performance",
		description: "Relevance and quality of past performance examples to the current opportunity requirements.",
		weight: 1.0,
		minScore: 0,
		maxScore: 10,
		scoringGuidelines: [
			{ score: 0, description: "No relevant past performance" },
			{ score: 2, description: "Limited relevance, mostly subcontract work" },
			{ score: 4, description: "Some relevant experience but not recent" },
			{ score: 6, description: "Good relevant experience with positive evaluations" },
			{ score: 8, description: "Strong relevant experience with excellent ratings" },
			{ score: 10, description: "Exceptional track record on similar programs" },
		],
	},
	{
		factorName: "Team Qualifications",
		factorCategory: "team",
		description: "Quality and availability of proposed key personnel and overall team composition.",
		weight: 1.0,
		minScore: 0,
		maxScore: 10,
		scoringGuidelines: [
			{ score: 0, description: "Key positions unfilled or unqualified" },
			{ score: 2, description: "Team has gaps in critical skills" },
			{ score: 4, description: "Adequate team with some concerns" },
			{ score: 6, description: "Good team with qualified key personnel" },
			{ score: 8, description: "Strong team with exceptional qualifications" },
			{ score: 10, description: "Best-in-class team with customer-preferred personnel" },
		],
	},
	{
		factorName: "Competitive Position",
		factorCategory: "competition",
		description: "Overall competitive landscape analysis including known competitors, their likely approach, and our discriminators.",
		weight: 0.5,
		minScore: 0,
		maxScore: 10,
		scoringGuidelines: [
			{ score: 0, description: "Facing strong competition with no clear advantage" },
			{ score: 2, description: "Multiple strong competitors, limited differentiation" },
			{ score: 4, description: "Competitive field but some advantages" },
			{ score: 6, description: "Good competitive position with clear discriminators" },
			{ score: 8, description: "Strong competitive position, limited strong competition" },
			{ score: 10, description: "Dominant position or sole source opportunity" },
		],
	},
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate PWin from factor scores using weighted average formula.
 * PWin = Σ(factor_score × factor_weight) / Σ(max_score × factor_weight) × 100
 */
function calculatePwinFromScores(scores: FactorScore[], factors: PwinFactor[]): {
	pwin: number;
	weightedScore: number;
	maxPossibleScore: number;
} {
	if (scores.length === 0) {
		return { pwin: 0, weightedScore: 0, maxPossibleScore: 0 };
	}

	let weightedScore = 0;
	let maxPossibleScore = 0;

	for (const score of scores) {
		const factor = factors.find(f => f.id === score.factorId);
		const maxScore = factor?.maxScore ?? 10;
		const weight = score.weight;

		weightedScore += score.score * weight;
		maxPossibleScore += maxScore * weight;
	}

	const pwin = maxPossibleScore > 0 ? Math.round((weightedScore / maxPossibleScore) * 100) : 0;

	return { pwin, weightedScore, maxPossibleScore };
}

/**
 * Calculate confidence interval for PWin based on data quality and sample size.
 */
function calculateConfidenceInterval(
	pwin: number,
	factorScoreCount: number,
	historicalDataPoints: number
): { lower: number; upper: number; confidence: number } {
	// Base uncertainty inversely related to data quality
	const dataQualityFactor = Math.min(1, (factorScoreCount + historicalDataPoints) / 20);
	const baseUncertainty = 15 * (1 - dataQualityFactor * 0.5);

	// PWin-specific adjustment (more uncertainty at extremes)
	const extremityFactor = 1 + Math.abs(pwin - 50) / 100;
	const adjustedUncertainty = baseUncertainty * extremityFactor;

	// Calculate confidence level based on data quality
	const confidence = 0.5 + dataQualityFactor * 0.4;

	return {
		lower: Math.max(0, Math.round(pwin - adjustedUncertainty)),
		upper: Math.min(100, Math.round(pwin + adjustedUncertainty)),
		confidence: Math.round(confidence * 100) / 100,
	};
}

/**
 * Revalidate PWin-related paths after updates.
 */
function revalidatePwinPaths(opportunityId?: string): void {
	revalidatePath("/opportunities");
	revalidatePath("/pwin");
	revalidatePath("/portfolio");
	if (opportunityId) {
		revalidatePath(`/opportunities/${opportunityId}`);
		revalidatePath(`/pwin/${opportunityId}`);
	}
}

// ============================================================================
// Factor Management
// ============================================================================

/**
 * List all PWin factors, optionally filtered by organization.
 * Returns active factors sorted by weight descending.
 */
export async function listPwinFactors(
	organizationId?: string
): Promise<ActionResult<PwinFactor[]>> {
	try {
		const userContext = await requirePwinContext(organizationId);
		const conditions = and(
			eq(pwinFactors.isActive, true),
			visibleOrganizationCondition(pwinFactors.organizationId, userContext)
		);

		const factors = await db
			.select()
			.from(pwinFactors)
			.where(conditions)
			.orderBy(desc(pwinFactors.weight));

		return { success: true, data: factors };
	} catch (error) {
		logger.error("[listPwinFactors]", error);
		return { success: false, error: "Failed to list PWin factors" };
	}
}

/**
 * Create a new PWin factor with validation.
 */
export async function createPwinFactor(
	data: CreateFactorInput
): Promise<ActionResult<PwinFactor>> {
	try {
		const validated = createFactorSchema.parse(data);
		const userContext = await requirePwinContext(validated.organizationId);
		const organizationId = organizationForInsert(validated.organizationId, userContext);

		// Check for duplicate factor name within organization
		const [existing] = await db
			.select()
			.from(pwinFactors)
			.where(
				and(
					eq(pwinFactors.factorName, validated.factorName),
					organizationId
						? eq(pwinFactors.organizationId, organizationId)
						: isNull(pwinFactors.organizationId)
				)
			)
			.limit(1);

		if (existing) {
			return { success: false, error: `Factor "${validated.factorName}" already exists` };
		}

		const [factor] = await db
			.insert(pwinFactors)
			.values({
				factorName: validated.factorName,
				factorCategory: validated.factorCategory,
				description: validated.description,
				weight: validated.weight,
				minScore: validated.minScore,
				maxScore: validated.maxScore,
				scoringGuidelines: validated.scoringGuidelines,
				organizationId,
				isActive: true,
				isDefault: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		revalidatePath("/pwin/factors");

		return { success: true, data: factor };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues[0].message };
		}
		logger.error("[createPwinFactor]", error);
		return { success: false, error: "Failed to create PWin factor" };
	}
}

/**
 * Update an existing PWin factor.
 */
export async function updatePwinFactor(
	id: string,
	data: UpdateFactorInput
): Promise<ActionResult<PwinFactor>> {
	try {
		const validated = updateFactorSchema.parse(data);
		const userContext = await requirePwinContext(validated.organizationId);

		// Verify factor exists
		const [existing] = await db
			.select()
			.from(pwinFactors)
			.where(and(eq(pwinFactors.id, id), mutableOrganizationCondition(pwinFactors.organizationId, userContext)))
			.limit(1);

		if (!existing) {
			return { success: false, error: "Factor not found" };
		}

		// Build update object
		const updateData: Partial<NewPwinFactor> = {
			updatedAt: new Date(),
		};

		if (validated.factorName !== undefined) updateData.factorName = validated.factorName;
		if (validated.factorCategory !== undefined) updateData.factorCategory = validated.factorCategory;
		if (validated.description !== undefined) updateData.description = validated.description;
		if (validated.weight !== undefined) updateData.weight = validated.weight;
		if (validated.minScore !== undefined) updateData.minScore = validated.minScore;
		if (validated.maxScore !== undefined) updateData.maxScore = validated.maxScore;
		if (validated.scoringGuidelines !== undefined) updateData.scoringGuidelines = validated.scoringGuidelines;
		if (validated.isActive !== undefined) updateData.isActive = validated.isActive;
		if (validated.winCorrelation !== undefined) updateData.winCorrelation = validated.winCorrelation;

		const [updated] = await db
			.update(pwinFactors)
			.set(updateData)
			.where(and(eq(pwinFactors.id, id), mutableOrganizationCondition(pwinFactors.organizationId, userContext)))
			.returning();

		revalidatePath("/pwin/factors");

		return { success: true, data: updated };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues[0].message };
		}
		logger.error("[updatePwinFactor]", error);
		return { success: false, error: "Failed to update PWin factor" };
	}
}

/**
 * Delete (soft-delete by deactivating) a PWin factor.
 */
export async function deletePwinFactor(id: string): Promise<ActionResult<{ deleted: boolean }>> {
	try {
		const userContext = await requirePwinContext();
		const [existing] = await db
			.select()
			.from(pwinFactors)
			.where(and(eq(pwinFactors.id, id), mutableOrganizationCondition(pwinFactors.organizationId, userContext)))
			.limit(1);

		if (!existing) {
			return { success: false, error: "Factor not found" };
		}

		// Soft delete by setting isActive to false
		await db
			.update(pwinFactors)
			.set({ isActive: false, updatedAt: new Date() })
			.where(and(eq(pwinFactors.id, id), mutableOrganizationCondition(pwinFactors.organizationId, userContext)));

		revalidatePath("/pwin/factors");

		return { success: true, data: { deleted: true } };
	} catch (error) {
		logger.error("[deletePwinFactor]", error);
		return { success: false, error: "Failed to delete PWin factor" };
	}
}

/**
 * Initialize default factor set for an organization.
 * Creates the standard set of PWin factors if not already present.
 */
export async function initializeDefaultFactors(
	organizationId: string
): Promise<ActionResult<PwinFactor[]>> {
	try {
		await requirePwinContext(organizationId);

		// Check if factors already exist for this organization
		const existingFactors = await db
			.select()
			.from(pwinFactors)
			.where(eq(pwinFactors.organizationId, organizationId));

		if (existingFactors.length > 0) {
			return { success: true, data: existingFactors };
		}

		// Create default factors
		const createdFactors: PwinFactor[] = [];

		for (const factorDef of DEFAULT_FACTORS) {
			const [factor] = await db
				.insert(pwinFactors)
				.values({
					...factorDef,
					organizationId,
					isActive: true,
					isDefault: true,
					createdAt: new Date(),
					updatedAt: new Date(),
				})
				.returning();

			createdFactors.push(factor);
		}

		revalidatePath("/pwin/factors");

		return { success: true, data: createdFactors };
	} catch (error) {
		logger.error("[initializeDefaultFactors]", error);
		return { success: false, error: "Failed to initialize default factors" };
	}
}

// ============================================================================
// PWin Assessment
// ============================================================================

/**
 * Assess PWin for an opportunity based on factor scores.
 * Calculates weighted average and stores the assessment with historical tracking.
 */
export async function assessPwin(
	opportunityId: string,
	scores: FactorScore[],
	options?: {
		assessmentType?: "initial" | "mid_capture" | "final" | "gate_review";
		assessedBy?: string;
		notes?: string;
		organizationId?: string;
	}
): Promise<ActionResult<PwinAssessment>> {
	try {
		// Validate input
		const validated = assessPwinSchema.parse({
			opportunityId,
			scores,
			...options,
		});
		const userContext = await requirePwinContext(validated.organizationId);
		const organizationId = organizationForInsert(validated.organizationId, userContext);

		// Verify opportunity exists
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(visibleOpportunityCondition(opportunityId, userContext))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		// Get active factors for lookup
		const factors = await db
			.select()
			.from(pwinFactors)
			.where(and(
				eq(pwinFactors.isActive, true),
				visibleOrganizationCondition(pwinFactors.organizationId, userContext)
			));

		// Calculate PWin
		const { pwin, weightedScore, maxPossibleScore } = calculatePwinFromScores(validated.scores, factors);

		// Get previous assessment for delta calculation
		const [previousAssessment] = await db
			.select()
			.from(pwinAssessments)
			.where(and(
				eq(pwinAssessments.opportunityId, opportunityId),
				mutableOrganizationCondition(pwinAssessments.organizationId, userContext)
			))
			.orderBy(desc(pwinAssessments.assessedAt))
			.limit(1);

		const previousPwin = previousAssessment?.calculatedPwin ?? null;
		const pwinDelta = previousPwin !== null ? pwin - previousPwin : null;

		// Calculate confidence interval
		const historicalCount = previousAssessment ? 1 : 0;
		const confidenceInterval = calculateConfidenceInterval(pwin, validated.scores.length, historicalCount);

		// Run sensitivity analysis
		const sensitivityAnalysis = calculateSensitivityAnalysis(validated.scores, factors, pwin);

		// Create assessment record
		const [assessment] = await db
			.insert(pwinAssessments)
			.values({
				opportunityId,
				organizationId,
				assessedAt: new Date(),
				assessedBy: userContext.userId,
				assessmentType: validated.assessmentType ?? "initial",
				factorScores: validated.scores,
				calculatedPwin: pwin,
				previousPwin,
				pwinDelta,
				confidenceInterval,
				sensitivityAnalysis: sensitivityAnalysis.map((s) => ({
					factorId: s.factorId,
					factorName: s.factorName,
					currentScore: s.currentScore,
					impactIfImproved: s.impactIfMaximized,
					improvementPotential: s.improvementPotential,
				})),
				recommendations: [],
				notes: validated.notes,
				createdAt: new Date(),
			})
			.returning();

		// Update opportunity with new PWin
		await db
			.update(opportunities)
			.set({
				winProbability: pwin,
				updatedAt: new Date(),
			})
			.where(visibleOpportunityCondition(opportunityId, userContext));

		revalidatePwinPaths(opportunityId);

		return { success: true, data: assessment };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues[0].message };
		}
		logger.error("[assessPwin]", error);
		return { success: false, error: "Failed to assess PWin" };
	}
}

/**
 * Calculate sensitivity analysis for each factor.
 */
function calculateSensitivityAnalysis(
	scores: FactorScore[],
	factors: PwinFactor[],
	currentPwin: number
): SensitivityResult[] {
	const results: SensitivityResult[] = [];

	for (const score of scores) {
		const factor = factors.find(f => f.id === score.factorId);
		if (!factor) continue;

		const maxScore = factor.maxScore ?? 10;
		const currentScore = score.score;
		const weight = score.weight;

		// Calculate impact if this factor is maximized
		const currentContribution = currentScore * weight;
		const maxContribution = maxScore * weight;
		const additionalContribution = maxContribution - currentContribution;

		// Calculate total max possible to get impact as percentage
		let totalMaxPossible = 0;
		for (const s of scores) {
			const f = factors.find(ff => ff.id === s.factorId);
			totalMaxPossible += (f?.maxScore ?? 10) * s.weight;
		}

		const impactIfMaximized = totalMaxPossible > 0
			? Math.round((additionalContribution / totalMaxPossible) * 100)
			: 0;

		const pointsRemaining = maxScore - currentScore;
		const impactPerPoint = pointsRemaining > 0
			? Math.round((impactIfMaximized / pointsRemaining) * 10) / 10
			: 0;

		const improvementPotential = Math.round((1 - currentScore / maxScore) * 100);

		// Determine priority based on impact and improvement potential
		let priority: "high" | "medium" | "low" = "low";
		if (impactIfMaximized >= 10 && improvementPotential >= 40) priority = "high";
		else if (impactIfMaximized >= 5 || improvementPotential >= 50) priority = "medium";

		results.push({
			factorId: score.factorId,
			factorName: score.factorName,
			currentScore,
			maxScore,
			weight,
			impactIfMaximized,
			impactPerPoint,
			improvementPotential,
			priority,
		});
	}

	// Sort by impact potential
	results.sort((a, b) => b.impactIfMaximized - a.impactIfMaximized);

	return results;
}

/**
 * Get a single PWin assessment by ID.
 */
export async function getPwinAssessment(id: string): Promise<ActionResult<PwinAssessment>> {
	try {
		const userContext = await requirePwinContext();
		const [assessment] = await db
			.select()
			.from(pwinAssessments)
			.where(and(eq(pwinAssessments.id, id), mutableOrganizationCondition(pwinAssessments.organizationId, userContext)))
			.limit(1);

		if (!assessment) {
			return { success: false, error: "Assessment not found" };
		}

		return { success: true, data: assessment };
	} catch (error) {
		logger.error("[getPwinAssessment]", error);
		return { success: false, error: "Failed to get PWin assessment" };
	}
}

/**
 * List all PWin assessments for an opportunity.
 */
export async function listPwinAssessments(
	opportunityId: string
): Promise<ActionResult<PwinAssessment[]>> {
	try {
		const userContext = await requirePwinContext();
		const assessments = await db
			.select()
			.from(pwinAssessments)
			.where(and(
				eq(pwinAssessments.opportunityId, opportunityId),
				mutableOrganizationCondition(pwinAssessments.organizationId, userContext)
			))
			.orderBy(desc(pwinAssessments.assessedAt));

		return { success: true, data: assessments };
	} catch (error) {
		logger.error("[listPwinAssessments]", error);
		return { success: false, error: "Failed to list PWin assessments" };
	}
}

/**
 * Get PWin history over time for an opportunity.
 */
export async function getPwinHistory(
	opportunityId: string
): Promise<ActionResult<Array<{ date: string; pwin: number; assessmentType: string }>>> {
	try {
		const userContext = await requirePwinContext();
		const assessments = await db
			.select({
				assessedAt: pwinAssessments.assessedAt,
				calculatedPwin: pwinAssessments.calculatedPwin,
				assessmentType: pwinAssessments.assessmentType,
			})
			.from(pwinAssessments)
			.where(and(
				eq(pwinAssessments.opportunityId, opportunityId),
				mutableOrganizationCondition(pwinAssessments.organizationId, userContext)
			))
			.orderBy(asc(pwinAssessments.assessedAt));

		const history = assessments.map(a => ({
			date: a.assessedAt?.toISOString() ?? new Date().toISOString(),
			pwin: a.calculatedPwin ?? 0,
			assessmentType: a.assessmentType ?? "initial",
		}));

		return { success: true, data: history };
	} catch (error) {
		logger.error("[getPwinHistory]", error);
		return { success: false, error: "Failed to get PWin history" };
	}
}

/**
 * Compare multiple PWin assessments side by side.
 */
export async function comparePwinAssessments(
	assessmentIds: string[]
): Promise<ActionResult<{
	assessments: PwinAssessment[];
	comparison: {
		factorName: string;
		scores: Array<{ assessmentId: string; score: number }>;
		trend: "improving" | "declining" | "stable";
	}[];
}>> {
	try {
		const userContext = await requirePwinContext();
		if (assessmentIds.length < 2) {
			return { success: false, error: "At least 2 assessments required for comparison" };
		}

		const assessments = await db
			.select()
			.from(pwinAssessments)
			.where(and(
				inArray(pwinAssessments.id, assessmentIds),
				mutableOrganizationCondition(pwinAssessments.organizationId, userContext)
			))
			.orderBy(asc(pwinAssessments.assessedAt));

		if (assessments.length < 2) {
			return { success: false, error: "Could not find all requested assessments" };
		}

		// Build factor comparison
		const factorMap = new Map<string, Array<{ assessmentId: string; score: number; date: Date }>>();

		for (const assessment of assessments) {
			const scores = assessment.factorScores as FactorScore[];
			for (const score of scores) {
				const existing = factorMap.get(score.factorName) ?? [];
				existing.push({
					assessmentId: assessment.id,
					score: score.score,
					date: assessment.assessedAt ?? new Date(),
				});
				factorMap.set(score.factorName, existing);
			}
		}

		const comparison = Array.from(factorMap.entries()).map(([factorName, scoreData]) => {
			// Sort by date and determine trend
			scoreData.sort((a, b) => a.date.getTime() - b.date.getTime());
			const scores = scoreData.map(s => ({ assessmentId: s.assessmentId, score: s.score }));

			let trend: "improving" | "declining" | "stable" = "stable";
			if (scoreData.length >= 2) {
				const first = scoreData[0].score;
				const last = scoreData[scoreData.length - 1].score;
				if (last > first * 1.1) trend = "improving";
				else if (last < first * 0.9) trend = "declining";
			}

			return { factorName, scores, trend };
		});

		return { success: true, data: { assessments, comparison } };
	} catch (error) {
		logger.error("[comparePwinAssessments]", error);
		return { success: false, error: "Failed to compare assessments" };
	}
}

// ============================================================================
// Analysis & Recommendations
// ============================================================================

/**
 * Run sensitivity analysis to identify highest-impact improvement opportunities.
 */
export async function runSensitivityAnalysis(
	opportunityId: string
): Promise<ActionResult<SensitivityResult[]>> {
	try {
		const userContext = await requirePwinContext();
		// Get latest assessment
		const [latestAssessment] = await db
			.select()
			.from(pwinAssessments)
			.where(and(
				eq(pwinAssessments.opportunityId, opportunityId),
				mutableOrganizationCondition(pwinAssessments.organizationId, userContext)
			))
			.orderBy(desc(pwinAssessments.assessedAt))
			.limit(1);

		if (!latestAssessment) {
			return { success: false, error: "No PWin assessment found for this opportunity" };
		}

		// Return stored sensitivity analysis if available - map to full SensitivityResult type
		if (latestAssessment.sensitivityAnalysis) {
			const stored = latestAssessment.sensitivityAnalysis;
			const results: SensitivityResult[] = stored.map((s) => ({
				factorId: s.factorId,
				factorName: s.factorName,
				currentScore: s.currentScore,
				maxScore: 10, // Default max
				weight: 1,
				impactIfMaximized: s.impactIfImproved,
				impactPerPoint: s.impactIfImproved / Math.max(1, 10 - s.currentScore),
				improvementPotential: s.improvementPotential,
				priority: s.improvementPotential > 5 ? "high" : s.improvementPotential > 2 ? "medium" : "low",
			}));
			return { success: true, data: results };
		}

		// Recalculate if not stored
		const factors = await db
			.select()
			.from(pwinFactors)
			.where(and(
				eq(pwinFactors.isActive, true),
				visibleOrganizationCondition(pwinFactors.organizationId, userContext)
			));

		const scores = latestAssessment.factorScores as FactorScore[];
		const currentPwin = latestAssessment.calculatedPwin ?? 0;

		const analysis = calculateSensitivityAnalysis(scores, factors, currentPwin);

		// Map to DB format and update assessment
		const dbFormat = analysis.map((s) => ({
			factorId: s.factorId,
			factorName: s.factorName,
			currentScore: s.currentScore,
			impactIfImproved: s.impactIfMaximized,
			improvementPotential: s.improvementPotential,
		}));

		await db
			.update(pwinAssessments)
			.set({ sensitivityAnalysis: dbFormat })
			.where(and(
				eq(pwinAssessments.id, latestAssessment.id),
				mutableOrganizationCondition(pwinAssessments.organizationId, userContext)
			));

		return { success: true, data: analysis };
	} catch (error) {
		logger.error("[runSensitivityAnalysis]", error);
		return { success: false, error: "Failed to run sensitivity analysis" };
	}
}

/**
 * Get AI-generated recommendations to improve PWin.
 */
export async function getRecommendationsToImprovePwin(
	opportunityId: string
): Promise<ActionResult<PwinRecommendation[]>> {
	try {
		const userContext = await requirePwinContext();
		// Get opportunity and latest assessment
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(visibleOpportunityCondition(opportunityId, userContext))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		const [latestAssessment] = await db
			.select()
			.from(pwinAssessments)
			.where(and(
				eq(pwinAssessments.opportunityId, opportunityId),
				mutableOrganizationCondition(pwinAssessments.organizationId, userContext)
			))
			.orderBy(desc(pwinAssessments.assessedAt))
			.limit(1);

		if (!latestAssessment) {
			return { success: false, error: "No PWin assessment found" };
		}

		const scores = latestAssessment.factorScores as FactorScore[];
		const storedSensitivity = latestAssessment.sensitivityAnalysis ?? [];
		const sensitivity: SensitivityResult[] = storedSensitivity.map((s) => ({
			factorId: s.factorId,
			factorName: s.factorName,
			currentScore: s.currentScore,
			maxScore: 10,
			weight: 1,
			impactIfMaximized: s.impactIfImproved,
			impactPerPoint: s.impactIfImproved / Math.max(1, 10 - s.currentScore),
			improvementPotential: s.improvementPotential,
			priority: s.improvementPotential > 5 ? "high" : s.improvementPotential > 2 ? "medium" : "low",
		}));
		const currentPwin = latestAssessment.calculatedPwin ?? 0;

		// Generate recommendations using AI
		const manager = getProviderManager();
		await manager.initialize();

		let recommendations: PwinRecommendation[] = [];

		if (await manager.isAvailable()) {
			try {
				recommendations = await generateAIPwinRecommendations(
					opportunity,
					scores,
					sensitivity,
					currentPwin
				);
			} catch (aiError) {
				logger.warn("[getRecommendationsToImprovePwin] AI generation failed:", aiError);
			}
		}

		// Generate heuristic recommendations if AI unavailable
		if (recommendations.length === 0) {
			recommendations = generateHeuristicRecommendations(scores, sensitivity);
		}

		// Store recommendations in assessment
		await db
			.update(pwinAssessments)
			.set({ recommendations })
			.where(and(
				eq(pwinAssessments.id, latestAssessment.id),
				mutableOrganizationCondition(pwinAssessments.organizationId, userContext)
			));

		return { success: true, data: recommendations };
	} catch (error) {
		logger.error("[getRecommendationsToImprovePwin]", error);
		return { success: false, error: "Failed to generate recommendations" };
	}
}

/**
 * Generate AI-powered PWin improvement recommendations.
 */
async function generateAIPwinRecommendations(
	opportunity: typeof opportunities.$inferSelect,
	scores: FactorScore[],
	sensitivity: SensitivityResult[],
	currentPwin: number
): Promise<PwinRecommendation[]> {
	const manager = getProviderManager();

	const systemPrompt = `You are a capture management expert specializing in probability of win (PWin) analysis.
Based on the factor scores and sensitivity analysis, provide specific, actionable recommendations to improve PWin.

Output as JSON array:
[
  {
    "recommendation": "<specific action>",
    "priority": "high|medium|low",
    "factorName": "<factor this addresses>",
    "expectedImpact": <1-20 points>,
    "effort": "low|medium|high",
    "timeframe": "immediate|short_term|long_term"
  }
]

Focus on high-impact, achievable actions. Only output valid JSON array.`;

	const userPrompt = `Generate PWin improvement recommendations:

**Opportunity:** ${opportunity.title}
**Organization:** ${opportunity.organization}
**Current PWin:** ${currentPwin}%

**Factor Scores:**
${scores.map(s => `- ${s.factorName}: ${s.score}/10 (weight: ${s.weight})`).join("\n")}

**Sensitivity Analysis (sorted by impact):**
${sensitivity.slice(0, 5).map(s => `- ${s.factorName}: +${s.impactIfMaximized}% if maximized, ${s.improvementPotential}% improvement potential`).join("\n")}

Provide 3-5 specific recommendations prioritizing high-impact factors.`;

	const response = await manager.complete({
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		temperature: 0.4,
		maxTokens: 1000,
	});

	const jsonMatch = response.content.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		return [];
	}

	const parsed = JSON.parse(jsonMatch[0]) as PwinRecommendation[];

	// Add factorId mapping
	return parsed.map(rec => ({
		...rec,
		factorId: scores.find(s => s.factorName.toLowerCase() === rec.factorName?.toLowerCase())?.factorId,
	}));
}

/**
 * Generate heuristic recommendations when AI is unavailable.
 */
function generateHeuristicRecommendations(
	scores: FactorScore[],
	sensitivity: SensitivityResult[]
): PwinRecommendation[] {
	const recommendations: PwinRecommendation[] = [];

	// Focus on high-impact factors with improvement potential
	const highImpactFactors = sensitivity.filter(s => s.priority === "high" || s.impactIfMaximized >= 8);

	for (const factor of highImpactFactors.slice(0, 3)) {
		let recommendation = "";
		let effort: "low" | "medium" | "high" = "medium";
		let timeframe: "immediate" | "short_term" | "long_term" = "short_term";

		switch (factor.factorName.toLowerCase()) {
			case "customer relationship":
				recommendation = "Schedule executive engagement meeting with key customer stakeholders";
				effort = "medium";
				timeframe = "immediate";
				break;
			case "solution fit":
				recommendation = "Conduct solution alignment workshop to identify additional customer requirements";
				effort = "medium";
				timeframe = "short_term";
				break;
			case "price competitiveness":
				recommendation = "Review pricing strategy and identify cost reduction opportunities";
				effort = "high";
				timeframe = "short_term";
				break;
			case "past performance match":
				recommendation = "Document additional relevant past performance and collect customer references";
				effort = "low";
				timeframe = "immediate";
				break;
			case "team qualifications":
				recommendation = "Strengthen key personnel qualifications or identify alternative candidates";
				effort = "medium";
				timeframe = "short_term";
				break;
			default:
				recommendation = `Develop action plan to improve ${factor.factorName} score`;
		}

		recommendations.push({
			recommendation,
			priority: factor.priority,
			factorId: factor.factorId,
			factorName: factor.factorName,
			expectedImpact: factor.impactIfMaximized,
			effort,
			timeframe,
		});
	}

	return recommendations;
}

/**
 * Identify risk factors that may impact PWin negatively.
 */
export async function identifyPwinRisks(
	opportunityId: string
): Promise<ActionResult<PwinRisk[]>> {
	try {
		const userContext = await requirePwinContext();
		// Get opportunity and latest assessment
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(visibleOpportunityCondition(opportunityId, userContext))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		const assessments = await db
			.select()
			.from(pwinAssessments)
			.where(and(
				eq(pwinAssessments.opportunityId, opportunityId),
				mutableOrganizationCondition(pwinAssessments.organizationId, userContext)
			))
			.orderBy(desc(pwinAssessments.assessedAt))
			.limit(5);

		if (assessments.length === 0) {
			return { success: false, error: "No PWin assessments found" };
		}

		const latestAssessment = assessments[0];
		const scores = latestAssessment.factorScores as FactorScore[];
		const currentPwin = latestAssessment.calculatedPwin ?? 0;

		const risks: PwinRisk[] = [];
		let riskCounter = 1;

		// Check for low-scoring critical factors
		for (const score of scores) {
			if (score.score <= 3) {
				risks.push({
					riskId: `risk-${riskCounter++}`,
					riskType: "score_gap",
					severity: score.weight >= 2 ? "high" : score.score <= 2 ? "high" : "medium",
					description: `${score.factorName} score is critically low (${score.score}/10)`,
					relatedFactorId: score.factorId,
					mitigationActions: [
						`Develop immediate action plan to address ${score.factorName}`,
						`Allocate additional resources to improve this factor`,
					],
				});
			}
		}

		// Check for declining trend
		if (assessments.length >= 2) {
			const previousPwin = assessments[1].calculatedPwin ?? 0;
			if (currentPwin < previousPwin - 10) {
				risks.push({
					riskId: `risk-${riskCounter++}`,
					riskType: "declining_trend",
					severity: currentPwin < previousPwin - 20 ? "high" : "medium",
					description: `PWin has declined from ${previousPwin}% to ${currentPwin}%`,
					mitigationActions: [
						"Review recent changes that may have impacted scores",
						"Conduct root cause analysis of declining factors",
						"Develop recovery plan with specific milestones",
					],
				});
			}
		}

		// Check for timeline risks
		if (opportunity.deadline) {
			const daysToDeadline = Math.ceil(
				(opportunity.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
			);

			if (daysToDeadline < 30 && currentPwin < 50) {
				risks.push({
					riskId: `risk-${riskCounter++}`,
					riskType: "timeline",
					severity: daysToDeadline < 14 ? "high" : "medium",
					description: `Only ${daysToDeadline} days until deadline with PWin at ${currentPwin}%`,
					mitigationActions: [
						"Prioritize high-impact improvement actions",
						"Consider resource surge to accelerate improvements",
						"Evaluate bid/no-bid decision based on realistic improvement potential",
					],
				});
			}
		}

		// Check for competitive threats (low competitive position score)
		const competitiveScore = scores.find(
			s => s.factorName.toLowerCase().includes("competitive") || s.factorName.toLowerCase().includes("incumbent")
		);

		if (competitiveScore && competitiveScore.score <= 4) {
			risks.push({
				riskId: `risk-${riskCounter++}`,
				riskType: "competitive_threat",
				severity: competitiveScore.score <= 2 ? "high" : "medium",
				description: `Weak competitive position (score: ${competitiveScore.score}/10)`,
				relatedFactorId: competitiveScore.factorId,
				mitigationActions: [
					"Conduct detailed competitive analysis",
					"Identify and document unique discriminators",
					"Develop ghosting strategy for key competitors",
				],
			});
		}

		// Sort by severity
		const severityOrder = { high: 0, medium: 1, low: 2 };
		risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

		return { success: true, data: risks };
	} catch (error) {
		logger.error("[identifyPwinRisks]", error);
		return { success: false, error: "Failed to identify PWin risks" };
	}
}

/**
 * Generate a comprehensive PWin report for an opportunity.
 */
export async function generatePwinReport(
	opportunityId: string
): Promise<ActionResult<PwinReport>> {
	try {
		const userContext = await requirePwinContext();
		// Get opportunity
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(visibleOpportunityCondition(opportunityId, userContext))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		// Get all assessments for history
		const assessments = await db
			.select()
			.from(pwinAssessments)
			.where(and(
				eq(pwinAssessments.opportunityId, opportunityId),
				mutableOrganizationCondition(pwinAssessments.organizationId, userContext)
			))
			.orderBy(desc(pwinAssessments.assessedAt));

		if (assessments.length === 0) {
			return { success: false, error: "No PWin assessments found" };
		}

		const latestAssessment = assessments[0];
		const currentPwin = latestAssessment.calculatedPwin ?? 0;
		const targetPwin = 70; // Default target
		const pwinGap = targetPwin - currentPwin;

		// Get factor scores
		const factorScores = latestAssessment.factorScores as FactorScore[];

		// Get sensitivity analysis
		const sensitivityResult = await runSensitivityAnalysis(opportunityId);
		const sensitivityAnalysis = sensitivityResult.success ? sensitivityResult.data : [];

		// Get recommendations
		const recommendationsResult = await getRecommendationsToImprovePwin(opportunityId);
		const recommendations = recommendationsResult.success ? recommendationsResult.data : [];

		// Get risks
		const risksResult = await identifyPwinRisks(opportunityId);
		const risks = risksResult.success ? risksResult.data : [];

		// Build historical trend
		const historicalTrend = assessments.map(a => ({
			date: a.assessedAt?.toISOString() ?? new Date().toISOString(),
			pwin: a.calculatedPwin ?? 0,
		})).reverse();

		// Calculate confidence interval
		const confidenceInterval = latestAssessment.confidenceInterval as {
			lower: number;
			upper: number;
			confidence: number;
		} ?? calculateConfidenceInterval(currentPwin, factorScores.length, assessments.length);

		const report: PwinReport = {
			opportunityId,
			opportunityName: opportunity.title,
			currentPwin,
			targetPwin,
			pwinGap,
			assessmentDate: latestAssessment.assessedAt ?? new Date(),
			factorScores,
			sensitivityAnalysis,
			recommendations,
			risks,
			historicalTrend,
			confidenceInterval,
			generatedAt: new Date(),
		};

		return { success: true, data: report };
	} catch (error) {
		logger.error("[generatePwinReport]", error);
		return { success: false, error: "Failed to generate PWin report" };
	}
}

// ============================================================================
// Portfolio Optimization
// ============================================================================

/**
 * Optimize opportunity portfolio based on PWin and resource constraints.
 */
export async function optimizePortfolio(
	params: OptimizationParams
): Promise<ActionResult<PortfolioOptimization>> {
	try {
		const validated = optimizationParamsSchema.parse(params);
		const userContext = await requirePwinContext(validated.organizationId);
		const organizationId = organizationForInsert(validated.organizationId, userContext);

		// Build query conditions
		const conditions: SQL[] = [];

		if (validated.minPwin !== undefined) {
			conditions.push(gte(opportunities.winProbability, validated.minPwin));
		}

		if (validated.includeOpportunityIds?.length) {
			conditions.push(inArray(opportunities.id, validated.includeOpportunityIds));
		}

		// Fetch candidate opportunities
		const whereClause = assignedOpportunityConditions(userContext, conditions);

		let candidateQuery = db
			.select()
			.from(opportunities)
			.where(whereClause)
			.orderBy(desc(opportunities.winProbability));

		const candidates = await candidateQuery;

		// Filter out excluded opportunities
		const filteredCandidates = validated.excludeOpportunityIds?.length
			? candidates.filter(o => !validated.excludeOpportunityIds!.includes(o.id))
			: candidates;

		// Calculate expected value for each opportunity
		const opportunitiesWithEV = filteredCandidates.map(opp => {
			const pwin = (opp.winProbability ?? 50) / 100;
			const value = opp.budgetNumeric ?? 0;
			const expectedValue = pwin * value;
			const investmentRequired = value * 0.02; // Assume 2% proposal cost

			return {
				opportunity: opp,
				pwin: opp.winProbability ?? 50,
				value,
				expectedValue,
				investmentRequired,
			};
		});

		// Apply optimization strategy
		let selectedOpportunities: typeof opportunitiesWithEV = [];

		switch (validated.optimizationType) {
			case "maximize_wins":
				// Sort by PWin descending
				selectedOpportunities = opportunitiesWithEV
					.sort((a, b) => b.pwin - a.pwin)
					.slice(0, validated.maxOpportunities ?? 10);
				break;

			case "maximize_value":
				// Sort by expected value descending
				selectedOpportunities = opportunitiesWithEV
					.sort((a, b) => b.expectedValue - a.expectedValue)
					.slice(0, validated.maxOpportunities ?? 10);
				break;

			case "balanced":
			default:
				// Balance between PWin and expected value
				// Score = 0.5 * normalized_pwin + 0.5 * normalized_ev
				const maxEV = Math.max(...opportunitiesWithEV.map(o => o.expectedValue), 1);
				const scoredOpps = opportunitiesWithEV.map(o => ({
					...o,
					balanceScore: 0.5 * (o.pwin / 100) + 0.5 * (o.expectedValue / maxEV),
				}));

				selectedOpportunities = scoredOpps
					.sort((a, b) => b.balanceScore - a.balanceScore)
					.slice(0, validated.maxOpportunities ?? 10);
				break;
		}

		// Apply resource constraint if specified
		if (validated.resourceConstraint) {
			let totalInvestment = 0;
			const constrained: typeof selectedOpportunities = [];

			for (const opp of selectedOpportunities) {
				if (totalInvestment + opp.investmentRequired <= validated.resourceConstraint) {
					constrained.push(opp);
					totalInvestment += opp.investmentRequired;
				}
			}

			selectedOpportunities = constrained;
		}

		// Calculate portfolio metrics
		const totalExpectedValue = selectedOpportunities.reduce((sum, o) => sum + o.expectedValue, 0);
		const totalInvestment = selectedOpportunities.reduce((sum, o) => sum + o.investmentRequired, 0);
		const portfolioPwin = selectedOpportunities.length > 0
			? selectedOpportunities.reduce((sum, o) => sum + o.pwin, 0) / selectedOpportunities.length
			: 0;

		// Calculate diversification score (based on value distribution)
		const valueSum = selectedOpportunities.reduce((sum, o) => sum + o.value, 0);
		const concentrationIndex = valueSum > 0
			? selectedOpportunities.reduce((sum, o) => sum + Math.pow(o.value / valueSum, 2), 0)
			: 1;
		const diversificationScore = Math.round((1 - concentrationIndex) * 100);

		// Store optimization result
		const [optimization] = await db
			.insert(portfolioOptimizations)
			.values({
				organizationId,
				optimizationType: validated.optimizationType,
				resourceConstraint: validated.resourceConstraint,
				selectedOpportunities: selectedOpportunities.map(o => ({
					opportunityId: o.opportunity.id,
					opportunityName: o.opportunity.title,
					pwin: o.pwin,
					value: o.value,
					investmentRequired: o.investmentRequired,
					expectedValue: o.expectedValue,
				})),
				totalExpectedValue,
				totalInvestment,
				portfolioPwin,
				diversificationScore,
				createdAt: new Date(),
				createdBy: userContext.userId,
			})
			.returning();

		revalidatePath("/portfolio");

		return { success: true, data: optimization };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues[0].message };
		}
		logger.error("[optimizePortfolio]", error);
		return { success: false, error: "Failed to optimize portfolio" };
	}
}

/**
 * Compare multiple opportunities side by side.
 */
export async function compareOpportunities(
	opportunityIds: string[]
): Promise<ActionResult<OpportunityComparison[]>> {
	try {
		const userContext = await requirePwinContext();
		if (opportunityIds.length < 2) {
			return { success: false, error: "At least 2 opportunities required for comparison" };
		}

		// Fetch opportunities
		const opps = await db
			.select()
			.from(opportunities)
			.where(assignedOpportunityConditions(userContext, [
				inArray(opportunities.id, opportunityIds),
			]));

		if (opps.length < 2) {
			return { success: false, error: "Could not find all requested opportunities" };
		}

		// Fetch latest assessments
		const assessments = await db
			.select()
			.from(pwinAssessments)
			.where(and(
				inArray(pwinAssessments.opportunityId, opportunityIds),
				mutableOrganizationCondition(pwinAssessments.organizationId, userContext)
			))
			.orderBy(desc(pwinAssessments.assessedAt));

		// Group assessments by opportunity (latest only)
		const assessmentMap = new Map<string, PwinAssessment>();
		for (const assessment of assessments) {
			if (assessment.opportunityId && !assessmentMap.has(assessment.opportunityId)) {
				assessmentMap.set(assessment.opportunityId, assessment);
			}
		}

		// Calculate average scores across all opportunities for comparison
		const allFactorScores = new Map<string, number[]>();
		for (const assessment of assessmentMap.values()) {
			const scores = assessment.factorScores as FactorScore[];
			for (const score of scores) {
				const existing = allFactorScores.get(score.factorName) ?? [];
				existing.push(score.score);
				allFactorScores.set(score.factorName, existing);
			}
		}

		const averageScores = new Map<string, number>();
		for (const [factorName, scores] of allFactorScores) {
			averageScores.set(factorName, scores.reduce((sum, s) => sum + s, 0) / scores.length);
		}

		// Build comparisons
		const comparisons: OpportunityComparison[] = [];

		for (const opp of opps) {
			const assessment = assessmentMap.get(opp.id);
			const pwin = opp.winProbability ?? 50;
			const contractValue = opp.budgetNumeric ?? 0;
			const expectedValue = (pwin / 100) * contractValue;
			const factorBreakdown = (assessment?.factorScores as FactorScore[]) ?? [];

			// Identify strengths and weaknesses vs others
			const strengthsVsOthers: string[] = [];
			const weaknessesVsOthers: string[] = [];

			for (const score of factorBreakdown) {
				const avg = averageScores.get(score.factorName) ?? score.score;
				if (score.score > avg + 1) {
					strengthsVsOthers.push(score.factorName);
				} else if (score.score < avg - 1) {
					weaknessesVsOthers.push(score.factorName);
				}
			}

			comparisons.push({
				opportunityId: opp.id,
				opportunityName: opp.title,
				pwin,
				contractValue,
				expectedValue,
				factorBreakdown,
				strengthsVsOthers,
				weaknessesVsOthers,
				rank: 0, // Will be set below
			});
		}

		// Rank by expected value
		comparisons.sort((a, b) => b.expectedValue - a.expectedValue);
		comparisons.forEach((c, i) => { c.rank = i + 1; });

		return { success: true, data: comparisons };
	} catch (error) {
		logger.error("[compareOpportunities]", error);
		return { success: false, error: "Failed to compare opportunities" };
	}
}

/**
 * Rank opportunities by PWin and/or value with filtering.
 */
export async function rankOpportunities(
	filters?: RankingFilters
): Promise<ActionResult<Array<{
	rank: number;
	opportunityId: string;
	opportunityName: string;
	pwin: number;
	value: number;
	expectedValue: number;
	stage?: string;
}>>> {
	try {
		const validated = filters ? rankingFiltersSchema.parse(filters) : {};
		const userContext = await requirePwinContext(validated.organizationId);

		// Build query conditions
		const conditions: SQL[] = [];

		if (validated.minPwin !== undefined) {
			conditions.push(gte(opportunities.winProbability, validated.minPwin));
		}

		if (validated.maxPwin !== undefined) {
			conditions.push(lte(opportunities.winProbability, validated.maxPwin));
		}

		if (validated.minValue !== undefined) {
			conditions.push(gte(opportunities.budgetNumeric, validated.minValue));
		}

		if (validated.maxValue !== undefined) {
			conditions.push(lte(opportunities.budgetNumeric, validated.maxValue));
		}

		// Note: stage filtering would require joining with pipeline table
		// For now, we filter by category as a proxy
		if (validated.stage) {
			conditions.push(eq(opportunities.category, validated.stage));
		}

		const whereClause = assignedOpportunityConditions(userContext, conditions);

		// Determine sort order
		let orderByClause;
		switch (validated.sortBy) {
			case "pwin":
				orderByClause = desc(opportunities.winProbability);
				break;
			case "value":
				orderByClause = desc(opportunities.budgetNumeric);
				break;
			case "expected_value":
				// Will sort in JS after fetching
				orderByClause = desc(opportunities.winProbability);
				break;
			case "recent":
			default:
				orderByClause = desc(opportunities.createdAt);
		}

		const opps = await db
			.select()
			.from(opportunities)
			.where(whereClause)
			.orderBy(orderByClause)
			.limit(validated.limit ?? 50);

		// Calculate expected value and build result
		let rankings = opps.map(opp => {
			const pwin = opp.winProbability ?? 50;
			const value = opp.budgetNumeric ?? 0;
			return {
				rank: 0,
				opportunityId: opp.id,
				opportunityName: opp.title,
				pwin,
				value,
				expectedValue: (pwin / 100) * value,
				stage: opp.category ?? undefined,
			};
		});

		// Sort by expected value if requested
		if (validated.sortBy === "expected_value") {
			rankings.sort((a, b) => b.expectedValue - a.expectedValue);
		}

		// Assign ranks
		rankings = rankings.map((r, i) => ({ ...r, rank: i + 1 }));

		return { success: true, data: rankings };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues[0].message };
		}
		logger.error("[rankOpportunities]", error);
		return { success: false, error: "Failed to rank opportunities" };
	}
}

/**
 * Get portfolio-level metrics summary.
 */
export async function getPortfolioMetrics(
	organizationId?: string
): Promise<ActionResult<PortfolioMetrics>> {
	try {
		const userContext = await requirePwinContext(organizationId);
		// Fetch all active opportunities
		const opps = await db
			.select()
			.from(opportunities)
			.where(
				assignedOpportunityConditions(userContext, [
					eq(opportunities.isExpired, false),
					isNotNull(opportunities.winProbability),
				])
			);

		if (opps.length === 0) {
			return {
				success: true,
				data: {
					totalOpportunities: 0,
					totalPipelineValue: 0,
					weightedPipelineValue: 0,
					averagePwin: 0,
					expectedWins: 0,
					atRiskCount: 0,
					pwinDistribution: [],
					topOpportunities: [],
					riskConcentration: 0,
					diversificationScore: 0,
				},
			};
		}

		const totalOpportunities = opps.length;
		const totalPipelineValue = opps.reduce((sum, o) => sum + (o.budgetNumeric ?? 0), 0);

		const oppsWithMetrics = opps.map(o => ({
			id: o.id,
			name: o.title,
			pwin: o.winProbability ?? 50,
			value: o.budgetNumeric ?? 0,
			weightedValue: ((o.winProbability ?? 50) / 100) * (o.budgetNumeric ?? 0),
		}));

		const weightedPipelineValue = oppsWithMetrics.reduce((sum, o) => sum + o.weightedValue, 0);
		const averagePwin = oppsWithMetrics.reduce((sum, o) => sum + o.pwin, 0) / totalOpportunities;

		// Expected wins = sum of all probabilities
		const expectedWins = oppsWithMetrics.reduce((sum, o) => sum + o.pwin / 100, 0);

		// PWin distribution buckets
		const buckets = [
			{ bucket: "0-20%", min: 0, max: 20, count: 0, value: 0 },
			{ bucket: "21-40%", min: 21, max: 40, count: 0, value: 0 },
			{ bucket: "41-60%", min: 41, max: 60, count: 0, value: 0 },
			{ bucket: "61-80%", min: 61, max: 80, count: 0, value: 0 },
			{ bucket: "81-100%", min: 81, max: 100, count: 0, value: 0 },
		];

		for (const opp of oppsWithMetrics) {
			const bucket = buckets.find(b => opp.pwin >= b.min && opp.pwin <= b.max);
			if (bucket) {
				bucket.count++;
				bucket.value += opp.value;
			}
		}

		const pwinDistribution = buckets.map(b => ({
			range: b.bucket,
			count: b.count,
			value: b.value,
		}));

		// At-risk opportunities (PWin < 40%)
		const atRiskCount = oppsWithMetrics.filter(o => o.pwin < 40).length;

		// Top opportunities by expected value
		const topOpportunities = oppsWithMetrics
			.sort((a, b) => b.weightedValue - a.weightedValue)
			.slice(0, 5)
			.map(o => ({
				id: o.id,
				name: o.name,
				pwin: o.pwin,
				value: o.value,
			}));

		// Risk concentration (Herfindahl-Hirschman Index style)
		const riskConcentration = totalPipelineValue > 0
			? Math.round(
					oppsWithMetrics.reduce(
						(sum, o) => sum + Math.pow(o.value / totalPipelineValue, 2),
						0
					) * 100
				)
			: 0;

		const diversificationScore = 100 - riskConcentration;

		return {
			success: true,
			data: {
				totalOpportunities,
				totalPipelineValue,
				weightedPipelineValue: Math.round(weightedPipelineValue),
				averagePwin: Math.round(averagePwin * 10) / 10,
				expectedWins: Math.round(expectedWins * 10) / 10,
				atRiskCount,
				pwinDistribution,
				topOpportunities,
				riskConcentration,
				diversificationScore,
			},
		};
	} catch (error) {
		logger.error("[getPortfolioMetrics]", error);
		return { success: false, error: "Failed to get portfolio metrics" };
	}
}

// ============================================================================
// Model Training & Evaluation
// ============================================================================

/**
 * Train or retrain the PWin prediction model based on historical outcomes.
 */
export async function trainPwinModel(
	params?: TrainingParams
): Promise<ActionResult<PwinModelPerformance>> {
	try {
		const validated = params ? trainingParamsSchema.parse(params) : {};
		const userContext = await requirePwinContext(validated.organizationId);
		const organizationId = organizationForInsert(validated.organizationId, userContext);

		// Fetch historical data from debriefs
		const historicalData = await db
			.select({
				debrief: debriefs,
				opportunity: opportunities,
			})
			.from(debriefs)
			.innerJoin(opportunities, eq(debriefs.opportunityId, opportunities.id))
			.where(and(
				inArray(debriefs.outcome, ["win", "loss"]),
				mutableOrganizationCondition(debriefs.organizationId, userContext)
			));

		if (historicalData.length < 10) {
			return {
				success: false,
				error: "Insufficient historical data for training. At least 10 completed opportunities required.",
			};
		}

		// Fetch related PWin assessments
		const assessmentMap = new Map<string, PwinAssessment>();
		const opportunityIds = historicalData.map(h => h.opportunity.id);

		const assessments = await db
			.select()
			.from(pwinAssessments)
			.where(and(
				inArray(pwinAssessments.opportunityId, opportunityIds),
				mutableOrganizationCondition(pwinAssessments.organizationId, userContext)
			))
			.orderBy(desc(pwinAssessments.assessedAt));

		for (const assessment of assessments) {
			if (assessment.opportunityId && !assessmentMap.has(assessment.opportunityId)) {
				assessmentMap.set(assessment.opportunityId, assessment);
			}
		}

		// Prepare training data
		const trainingRecords: Array<{
			pwin: number;
			outcome: 0 | 1; // 0 = loss, 1 = win
			factors: FactorScore[];
		}> = [];

		for (const { debrief, opportunity } of historicalData) {
			const assessment = assessmentMap.get(opportunity.id);
			const pwin = assessment?.calculatedPwin ?? opportunity.winProbability ?? 50;
			const outcome = debrief.outcome === "win" ? 1 : 0;
			const factors = (assessment?.factorScores as FactorScore[]) ?? [];

			trainingRecords.push({ pwin, outcome, factors });
		}

		// Split into training and validation
		const validationSplit = validated.validationSplit ?? 0.2;
		const splitIndex = Math.floor(trainingRecords.length * (1 - validationSplit));
		const trainingSet = trainingRecords.slice(0, splitIndex);
		const validationSet = trainingRecords.slice(splitIndex);

		// Calculate model metrics
		// For weighted_avg model, we evaluate calibration and accuracy

		// Accuracy: how often PWin > 50% correctly predicts win
		let correctPredictions = 0;
		for (const record of validationSet) {
			const predictedWin = record.pwin >= 50;
			const actualWin = record.outcome === 1;
			if (predictedWin === actualWin) correctPredictions++;
		}
		const accuracy = validationSet.length > 0 ? correctPredictions / validationSet.length : 0;

		// Precision: of those predicted to win, how many actually won
		const predictedWins = validationSet.filter(r => r.pwin >= 50);
		const truePositives = predictedWins.filter(r => r.outcome === 1).length;
		const precision = predictedWins.length > 0 ? truePositives / predictedWins.length : 0;

		// Recall: of actual wins, how many were predicted
		const actualWins = validationSet.filter(r => r.outcome === 1);
		const recall = actualWins.length > 0 ? truePositives / actualWins.length : 0;

		// F1 Score
		const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

		// Brier Score (mean squared error of probability predictions)
		const brierScore = validationSet.length > 0
			? validationSet.reduce((sum, r) => sum + Math.pow(r.pwin / 100 - r.outcome, 2), 0) / validationSet.length
			: 0;

		// Calculate calibration data (binned actual vs predicted)
		const calibrationData: Array<{ predictedBucket: number; actualWinRate: number; count: number }> = [];
		const buckets = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

		for (const bucketMax of buckets) {
			const bucketMin = bucketMax - 10;
			const bucketRecords = trainingRecords.filter(r => r.pwin > bucketMin && r.pwin <= bucketMax);
			const bucketWins = bucketRecords.filter(r => r.outcome === 1).length;
			const actualWinRate = bucketRecords.length > 0 ? bucketWins / bucketRecords.length : 0;

			calibrationData.push({
				predictedBucket: bucketMax,
				actualWinRate: Math.round(actualWinRate * 100),
				count: bucketRecords.length,
			});
		}

		// Calculate feature importance based on correlation with outcomes
		const factorImportance: Array<{ factorId: string; factorName: string; importance: number; rank: number }> = [];
		const factorCorrelations = new Map<string, { sumProduct: number; sumScore: number; sumOutcome: number; count: number }>();

		for (const record of trainingRecords) {
			for (const factor of record.factors) {
				const existing = factorCorrelations.get(factor.factorName) ?? {
					sumProduct: 0,
					sumScore: 0,
					sumOutcome: 0,
					count: 0,
				};
				existing.sumProduct += factor.score * record.outcome;
				existing.sumScore += factor.score;
				existing.sumOutcome += record.outcome;
				existing.count++;
				factorCorrelations.set(factor.factorName, existing);
			}
		}

		for (const [factorName, data] of factorCorrelations) {
			if (data.count > 0) {
				// Simple correlation approximation
				const meanScore = data.sumScore / data.count;
				const meanOutcome = data.sumOutcome / data.count;
				const correlation = data.count > 1
					? (data.sumProduct / data.count - meanScore * meanOutcome) / (meanScore * (1 - meanOutcome) + 0.01)
					: 0;

				factorImportance.push({
					factorId: "", // Would need to look up
					factorName,
					importance: Math.abs(correlation),
					rank: 0,
				});
			}
		}

		// Sort and rank
		factorImportance.sort((a, b) => b.importance - a.importance);
		factorImportance.forEach((f, i) => { f.rank = i + 1; });

		// Generate model version
		const modelVersion = `v${Date.now().toString(36)}`;
		const modelType = validated.modelType ?? "weighted_avg";

		// Store model performance
		const [modelPerf] = await db
			.insert(pwinModelPerformance)
			.values({
				organizationId,
				modelVersion,
				modelType,
				accuracy,
				precision,
				recall,
				f1Score,
				auc: accuracy, // Simplified - would need proper ROC calculation
				brierScore,
				calibrationData,
				trainingSetSize: trainingSet.length,
				testSetSize: validationSet.length,
				validationSetSize: validationSet.length,
				featureImportance: factorImportance,
				crossValidationScores: [accuracy], // Simplified
				isActive: true,
				trainedAt: new Date(),
				trainedBy: userContext.userId,
			})
			.returning();

		// Deactivate previous models
		await db
			.update(pwinModelPerformance)
			.set({ isActive: false })
			.where(
				and(
					mutableOrganizationCondition(pwinModelPerformance.organizationId, userContext),
					sql`${pwinModelPerformance.id} != ${modelPerf.id}`
				)
			);

		// Update factor correlations based on training
		for (const importance of factorImportance) {
			await db
				.update(pwinFactors)
				.set({ winCorrelation: importance.importance, updatedAt: new Date() })
				.where(and(
					eq(pwinFactors.factorName, importance.factorName),
					mutableOrganizationCondition(pwinFactors.organizationId, userContext)
				));
		}

		revalidatePath("/pwin/model");

		return { success: true, data: modelPerf };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues[0].message };
		}
		logger.error("[trainPwinModel]", error);
		return { success: false, error: "Failed to train PWin model" };
	}
}

/**
 * Evaluate current model performance.
 */
export async function evaluateModelPerformance(): Promise<ActionResult<ModelEvaluation>> {
	try {
		const userContext = await requirePwinContext();
		const [activeModel] = await db
			.select()
			.from(pwinModelPerformance)
			.where(and(
				eq(pwinModelPerformance.isActive, true),
				mutableOrganizationCondition(pwinModelPerformance.organizationId, userContext)
			))
			.orderBy(desc(pwinModelPerformance.trainedAt))
			.limit(1);

		if (!activeModel) {
			return { success: false, error: "No active model found. Please train a model first." };
		}

		// Generate recommendations based on metrics
		const recommendations: string[] = [];

		if ((activeModel.accuracy ?? 0) < 0.6) {
			recommendations.push("Model accuracy is below 60%. Consider retraining with more data.");
		}

		if ((activeModel.brierScore ?? 1) > 0.25) {
			recommendations.push("Probability calibration needs improvement. Review factor weights.");
		}

		const calibrationData = activeModel.calibrationData as Array<{
			predictedBucket: number;
			actualWinRate: number;
			count: number;
		}> ?? [];

		const poorlyCalibrated = calibrationData.filter(
			c => c.count >= 5 && Math.abs(c.predictedBucket - c.actualWinRate) > 20
		);

		if (poorlyCalibrated.length > 0) {
			recommendations.push(
				`${poorlyCalibrated.length} PWin buckets are poorly calibrated. Review scoring methodology.`
			);
		}

		if (recommendations.length === 0) {
			recommendations.push("Model performance is satisfactory. Continue monitoring.");
		}

		const evaluation: ModelEvaluation = {
			modelVersion: activeModel.modelVersion,
			modelType: activeModel.modelType ?? "weighted_avg",
			accuracy: activeModel.accuracy ?? 0,
			precision: activeModel.precision ?? 0,
			recall: activeModel.recall ?? 0,
			f1Score: activeModel.f1Score ?? 0,
			auc: activeModel.auc ?? 0,
			brierScore: activeModel.brierScore ?? 0,
			calibrationData,
			featureImportance: (activeModel.featureImportance as ModelEvaluation["featureImportance"]) ?? [],
			recommendations,
			isActive: activeModel.isActive ?? false,
			trainedAt: activeModel.trainedAt ?? new Date(),
			trainingSetSize: activeModel.trainingSetSize ?? 0,
			testSetSize: activeModel.testSetSize ?? 0,
		};

		return { success: true, data: evaluation };
	} catch (error) {
		logger.error("[evaluateModelPerformance]", error);
		return { success: false, error: "Failed to evaluate model performance" };
	}
}

/**
 * Get historical model versions and their performance.
 */
export async function getModelHistory(): Promise<ActionResult<PwinModelPerformance[]>> {
	try {
		const userContext = await requirePwinContext();
		const models = await db
			.select()
			.from(pwinModelPerformance)
			.where(mutableOrganizationCondition(pwinModelPerformance.organizationId, userContext))
			.orderBy(desc(pwinModelPerformance.trainedAt))
			.limit(10);

		return { success: true, data: models };
	} catch (error) {
		logger.error("[getModelHistory]", error);
		return { success: false, error: "Failed to get model history" };
	}
}

/**
 * Validate model predictions against actual outcomes.
 */
export async function validateModelPredictions(): Promise<ActionResult<{
	validationResults: Array<{
		opportunityId: string;
		opportunityName: string;
		predictedPwin: number;
		actualOutcome: "win" | "loss";
		predictionCorrect: boolean;
		error: number;
	}>;
	summary: {
		totalValidated: number;
		correctPredictions: number;
		accuracy: number;
		meanError: number;
	};
}>> {
	try {
		const userContext = await requirePwinContext();
		// Get recent completed opportunities with predictions
		const completedOpps = await db
			.select({
				debrief: debriefs,
				opportunity: opportunities,
			})
			.from(debriefs)
			.innerJoin(opportunities, eq(debriefs.opportunityId, opportunities.id))
			.where(and(
				inArray(debriefs.outcome, ["win", "loss"]),
				mutableOrganizationCondition(debriefs.organizationId, userContext)
			))
			.orderBy(desc(debriefs.createdAt))
			.limit(50);

		const validationResults: Array<{
			opportunityId: string;
			opportunityName: string;
			predictedPwin: number;
			actualOutcome: "win" | "loss";
			predictionCorrect: boolean;
			error: number;
		}> = [];

		for (const { debrief, opportunity } of completedOpps) {
			const predictedPwin = opportunity.winProbability ?? 50;
			const actualOutcome = debrief.outcome as "win" | "loss";
			const actualValue = actualOutcome === "win" ? 100 : 0;
			const predictionCorrect = (predictedPwin >= 50) === (actualOutcome === "win");
			const error = Math.abs(predictedPwin - actualValue);

			validationResults.push({
				opportunityId: opportunity.id,
				opportunityName: opportunity.title,
				predictedPwin,
				actualOutcome,
				predictionCorrect,
				error,
			});
		}

		const totalValidated = validationResults.length;
		const correctPredictions = validationResults.filter(r => r.predictionCorrect).length;
		const accuracy = totalValidated > 0 ? correctPredictions / totalValidated : 0;
		const meanError = totalValidated > 0
			? validationResults.reduce((sum, r) => sum + r.error, 0) / totalValidated
			: 0;

		return {
			success: true,
			data: {
				validationResults,
				summary: {
					totalValidated,
					correctPredictions,
					accuracy: Math.round(accuracy * 100) / 100,
					meanError: Math.round(meanError * 10) / 10,
				},
			},
		};
	} catch (error) {
		logger.error("[validateModelPredictions]", error);
		return { success: false, error: "Failed to validate model predictions" };
	}
}

// ============================================================================
// Forecasting
// ============================================================================

/**
 * Forecast win probabilities for all pipeline opportunities.
 */
export async function forecastWinProbabilities(): Promise<ActionResult<PwinForecast>> {
	try {
		const userContext = await requirePwinContext();
		// Get active pipeline opportunities
		const pipelineOpps = await db
			.select()
			.from(opportunities)
			.where(assignedOpportunityConditions(userContext, [
				eq(opportunities.isExpired, false),
			]));

		const forecasts: PwinForecast["opportunities"] = [];

		for (const opp of pipelineOpps) {
			const pwin = opp.winProbability ?? 50;
			const confidence = calculateConfidenceInterval(pwin, 7, 1);

			let predictedOutcome: "win" | "loss" | "uncertain" = "uncertain";
			if (pwin >= 60) predictedOutcome = "win";
			else if (pwin <= 40) predictedOutcome = "loss";

			forecasts.push({
				opportunityId: opp.id,
				opportunityName: opp.title,
				predictedPwin: pwin,
				confidenceInterval: { lower: confidence.lower, upper: confidence.upper },
				predictedOutcome,
				probability: pwin / 100,
			});
		}

		// Calculate aggregate metrics
		const expectedWins = forecasts.reduce((sum, f) => sum + f.probability, 0);
		const expectedValue = forecasts.reduce(
			(sum, f) => {
				const opp = pipelineOpps.find(o => o.id === f.opportunityId);
				return sum + f.probability * (opp?.budgetNumeric ?? 0);
			},
			0
		);

		// Confidence level based on data quality
		const confidenceLevel = forecasts.length > 0 ? 0.7 : 0;

		return {
			success: true,
			data: {
				opportunities: forecasts,
				aggregateMetrics: {
					expectedWins: Math.round(expectedWins * 10) / 10,
					expectedValue: Math.round(expectedValue),
					confidenceLevel,
				},
				generatedAt: new Date(),
			},
		};
	} catch (error) {
		logger.error("[forecastWinProbabilities]", error);
		return { success: false, error: "Failed to forecast win probabilities" };
	}
}

/**
 * Get model calibration statistics.
 */
export async function getCalibrationData(): Promise<ActionResult<CalibrationData>> {
	try {
		const userContext = await requirePwinContext();
		// Get active model calibration data
		const [activeModel] = await db
			.select()
			.from(pwinModelPerformance)
			.where(and(
				eq(pwinModelPerformance.isActive, true),
				mutableOrganizationCondition(pwinModelPerformance.organizationId, userContext)
			))
			.limit(1);

		if (!activeModel) {
			// Calculate from raw data if no model
			const completedOpps = await db
				.select({
					debrief: debriefs,
					opportunity: opportunities,
				})
				.from(debriefs)
				.innerJoin(opportunities, eq(debriefs.opportunityId, opportunities.id))
				.where(and(
					inArray(debriefs.outcome, ["win", "loss"]),
					mutableOrganizationCondition(debriefs.organizationId, userContext)
				));

			const buckets: CalibrationData["buckets"] = [];
			const ranges = [
				{ min: 0, max: 20 },
				{ min: 20, max: 40 },
				{ min: 40, max: 60 },
				{ min: 60, max: 80 },
				{ min: 80, max: 100 },
			];

			let totalError = 0;
			let totalCount = 0;

			for (const range of ranges) {
				const bucketOpps = completedOpps.filter(
					o => (o.opportunity.winProbability ?? 50) > range.min &&
						(o.opportunity.winProbability ?? 50) <= range.max
				);

				const wins = bucketOpps.filter(o => o.debrief.outcome === "win").length;
				const expectedRate = (range.min + range.max) / 2;
				const actualRate = bucketOpps.length > 0 ? (wins / bucketOpps.length) * 100 : 0;
				const error = bucketOpps.length > 0 ? Math.abs(expectedRate - actualRate) : 0;

				buckets.push({
					predictedRange: range,
					count: bucketOpps.length,
					actualWins: wins,
					actualWinRate: actualRate,
					expectedWinRate: expectedRate,
					calibrationError: error,
				});

				totalError += error * bucketOpps.length;
				totalCount += bucketOpps.length;
			}

			const overallCalibrationError = totalCount > 0 ? totalError / totalCount : 0;

			return {
				success: true,
				data: {
					buckets,
					overallCalibrationError,
					brierScore: 0.25, // No model available
					reliability: 1 - overallCalibrationError / 100,
					resolution: 0.5, // Would need proper calculation
				},
			};
		}

		// Use model calibration data
		const modelCalibration = activeModel.calibrationData as Array<{
			predictedBucket: number;
			actualWinRate: number;
			count: number;
		}> ?? [];

		const buckets: CalibrationData["buckets"] = modelCalibration.map(c => ({
			predictedRange: { min: c.predictedBucket - 10, max: c.predictedBucket },
			count: c.count,
			actualWins: Math.round(c.actualWinRate / 100 * c.count),
			actualWinRate: c.actualWinRate,
			expectedWinRate: c.predictedBucket - 5,
			calibrationError: Math.abs(c.predictedBucket - 5 - c.actualWinRate),
		}));

		const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);
		const overallCalibrationError = totalCount > 0
			? buckets.reduce((sum, b) => sum + b.calibrationError * b.count, 0) / totalCount
			: 0;

		return {
			success: true,
			data: {
				buckets,
				overallCalibrationError,
				brierScore: activeModel.brierScore ?? 0.25,
				reliability: 1 - overallCalibrationError / 100,
				resolution: 0.5,
			},
		};
	} catch (error) {
		logger.error("[getCalibrationData]", error);
		return { success: false, error: "Failed to get calibration data" };
	}
}

/**
 * Predict likely outcome for a specific opportunity.
 */
export async function predictOutcome(
	opportunityId: string
): Promise<ActionResult<{
	opportunityId: string;
	opportunityName: string;
	predictedPwin: number;
	confidenceInterval: { lower: number; upper: number };
	predictedOutcome: "win" | "loss" | "uncertain";
	confidence: number;
	factors: Array<{
		factorName: string;
		contribution: "positive" | "neutral" | "negative";
		score: number;
		impact: number;
	}>;
}>> {
	try {
		const userContext = await requirePwinContext();
		// Get opportunity
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(visibleOpportunityCondition(opportunityId, userContext))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		// Get latest assessment
		const [latestAssessment] = await db
			.select()
			.from(pwinAssessments)
			.where(and(
				eq(pwinAssessments.opportunityId, opportunityId),
				mutableOrganizationCondition(pwinAssessments.organizationId, userContext)
			))
			.orderBy(desc(pwinAssessments.assessedAt))
			.limit(1);

		const pwin = latestAssessment?.calculatedPwin ?? opportunity.winProbability ?? 50;
		const scores = (latestAssessment?.factorScores as FactorScore[]) ?? [];

		// Calculate confidence interval
		const interval = calculateConfidenceInterval(pwin, scores.length, 1);

		// Determine predicted outcome
		let predictedOutcome: "win" | "loss" | "uncertain" = "uncertain";
		if (pwin >= 60) predictedOutcome = "win";
		else if (pwin <= 40) predictedOutcome = "loss";

		// Calculate factor contributions
		const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
		const factors = scores.map(s => {
			const normalizedScore = s.score / 10;
			const contribution: "positive" | "neutral" | "negative" =
				normalizedScore >= 0.7 ? "positive" :
				normalizedScore <= 0.3 ? "negative" : "neutral";
			const impact = totalWeight > 0 ? (s.weight / totalWeight) * 100 : 0;

			return {
				factorName: s.factorName,
				contribution,
				score: s.score,
				impact: Math.round(impact),
			};
		});

		return {
			success: true,
			data: {
				opportunityId,
				opportunityName: opportunity.title,
				predictedPwin: pwin,
				confidenceInterval: { lower: interval.lower, upper: interval.upper },
				predictedOutcome,
				confidence: interval.confidence,
				factors,
			},
		};
	} catch (error) {
		logger.error("[predictOutcome]", error);
		return { success: false, error: "Failed to predict outcome" };
	}
}
