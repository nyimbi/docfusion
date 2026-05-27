/**
 * Opportunity AI Server Actions - DocFusion
 *
 * Server-side actions for AI-powered opportunity analysis,
 * including fit scoring, win probability, and risk assessment.
 *
 * Supports both heuristic-based scoring (fast, offline) and
 * LLM-powered scoring (intelligent, requires AI provider).
 */

"use server";

import { db } from "@/lib/db";
import { opportunityAIScores, opportunities } from "@/lib/db/schema";
import { eq, desc, and, or, isNull, sql, count, type SQL } from "drizzle-orm";
import { prompt, getProviderManager } from "@/lib/ai/providers";
import { getCompanyCapabilities } from "./company-settings";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import type {
	OpportunityAIScore,
	OpportunityAIScoreSummary,
	AIScoreType,
	AIScoreFactor,
	Opportunity,
} from "@/lib/types/opportunity";
import { logger } from "@/lib/utils/logger";

// ============================================================================
// AI Score Operations
// ============================================================================

type OpportunityAIContext = {
	userId: string;
	organizationId: string;
};

async function requireOpportunityAIContext(): Promise<OpportunityAIContext> {
	return requireTenantContext();
}

function normalizeAIScoreHistoryLimit(limit: number | undefined, fallback = 10, maximum = 1000): number {
	if (limit === undefined || !Number.isFinite(limit)) {
		return fallback;
	}
	return Math.max(1, Math.min(maximum, Math.floor(limit)));
}

function opportunityOrganizationCondition(organizationId: string): SQL {
	return or(
		eq(opportunities.organizationId, organizationId),
		isNull(opportunities.organizationId)
	)!;
}

function scoreOrganizationCondition(organizationId: string): SQL {
	return or(
		eq(opportunityAIScores.organizationId, organizationId),
		isNull(opportunityAIScores.organizationId)
	)!;
}

function visibleOpportunityCondition(opportunityId: string, context: OpportunityAIContext): SQL {
	return and(
		eq(opportunities.id, opportunityId),
		opportunityOrganizationCondition(context.organizationId),
		eq(opportunities.assignedTo, context.userId)
	)!;
}

function assignedOpportunityExistsSql(opportunityId: unknown, context: OpportunityAIContext): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and (opportunities.organization_id = ${context.organizationId} or opportunities.organization_id is null)
			and opportunities.assigned_to = ${context.userId}
	)`;
}

function visibleOpportunityScoresCondition(opportunityId: string, context: OpportunityAIContext): SQL {
	return and(
		eq(opportunityAIScores.opportunityId, opportunityId),
		scoreOrganizationCondition(context.organizationId),
		assignedOpportunityExistsSql(opportunityId, context)
	)!;
}

function visibleAIScoreCondition(scoreId: string, context: OpportunityAIContext): SQL {
	return and(
		eq(opportunityAIScores.id, scoreId),
		scoreOrganizationCondition(context.organizationId),
		assignedOpportunityExistsSql(opportunityAIScores.opportunityId, context)
	)!;
}

async function loadVisibleOpportunity(opportunityId: string, context: OpportunityAIContext) {
	const [opp] = await db
		.select()
		.from(opportunities)
		.where(visibleOpportunityCondition(opportunityId, context))
		.limit(1);

	if (!opp) {
		throw new Error(`Opportunity not found: ${opportunityId}`);
	}

	return opp;
}

function buildMetadataOpportunitySummary(opp: {
	title: string;
	organization?: string | null;
	budgetValue?: string | null;
	daysLeft?: number | null;
	category?: string | null;
	sector?: string | null;
	projectSummary?: string | null;
	keyRequirements?: string | null;
}): string {
	const organization = opp.organization || "Unknown organization";
	const classification = [opp.category, opp.sector].filter(Boolean).join(" / ") || "unspecified category";
	const budget = opp.budgetValue || "budget not specified";
	const deadline = opp.daysLeft === null || opp.daysLeft === undefined
		? "deadline not specified"
		: `${opp.daysLeft} day${opp.daysLeft === 1 ? "" : "s"} remaining`;
	const summary = opp.projectSummary?.trim() || "No project summary is recorded.";
	const requirements = opp.keyRequirements?.trim() || "No key requirements are recorded.";

	return `${opp.title} is an opportunity from ${organization} in ${classification}. Budget: ${budget}; ${deadline}. ${summary} Key requirements: ${requirements} Generated from available opportunity metadata.`;
}

/**
 * Calculate fit score for an opportunity.
 * Analyzes how well the opportunity matches our capabilities and strategy.
 */
export async function calculateFitScore(opportunityId: string): Promise<OpportunityAIScore> {
	const context = await requireOpportunityAIContext();

	// Get the opportunity data
	const opp = await loadVisibleOpportunity(opportunityId, context);

	// Calculate fit score based on available data
	// Uses AI when available, falls back to heuristics
	const factors = await calculateFitFactors(opp);
	const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
	const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
	const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 50;

	// Store the score
	const [score] = await db
		.insert(opportunityAIScores)
		.values({
			organizationId: context.organizationId,
			opportunityId,
			scoreType: "fit",
			score: Math.round(finalScore * 10) / 10,
			factors: factors,
			modelVersion: "v1.0-heuristic",
			reasoning: generateFitReasoning(factors, finalScore),
			createdAt: new Date(),
		})
		.returning();

	// Also update the opportunity's fitScore field
	await db
		.update(opportunities)
		.set({
			fitScore: Math.round(finalScore * 10) / 10,
			updatedAt: new Date(),
		})
		.where(visibleOpportunityCondition(opportunityId, context));

	return mapToAIScore(score);
}

/**
 * Calculate win probability for an opportunity.
 * Estimates likelihood of winning based on various factors.
 */
export async function calculateWinProbability(opportunityId: string): Promise<OpportunityAIScore> {
	const context = await requireOpportunityAIContext();

	const opp = await loadVisibleOpportunity(opportunityId, context);

	const factors = await calculateWinFactors(opp, context);
	const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
	const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
	const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 50;

	const [score] = await db
		.insert(opportunityAIScores)
		.values({
			organizationId: context.organizationId,
			opportunityId,
			scoreType: "win_probability",
			score: Math.round(finalScore * 10) / 10,
			factors: factors,
			modelVersion: "v1.0-heuristic",
			reasoning: generateWinReasoning(factors, finalScore),
			createdAt: new Date(),
		})
		.returning();

	// Also update the opportunity's winProbability field
	await db
		.update(opportunities)
		.set({
			winProbability: Math.round(finalScore * 10) / 10,
			updatedAt: new Date(),
		})
		.where(visibleOpportunityCondition(opportunityId, context));

	return mapToAIScore(score);
}

/**
 * Calculate risk score for an opportunity.
 * Higher score = higher risk.
 */
export async function calculateRiskScore(opportunityId: string): Promise<OpportunityAIScore> {
	const context = await requireOpportunityAIContext();

	const opp = await loadVisibleOpportunity(opportunityId, context);

	const factors = await calculateRiskFactors(opp);
	const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
	const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
	const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 50;

	const [score] = await db
		.insert(opportunityAIScores)
		.values({
			organizationId: context.organizationId,
			opportunityId,
			scoreType: "risk",
			score: Math.round(finalScore * 10) / 10,
			factors: factors,
			modelVersion: "v1.0-heuristic",
			reasoning: generateRiskReasoning(factors, finalScore),
			createdAt: new Date(),
		})
		.returning();

	return mapToAIScore(score);
}

/**
 * Calculate all AI scores for an opportunity.
 */
export async function calculateAllScores(opportunityId: string): Promise<{
	fit: OpportunityAIScore;
	winProbability: OpportunityAIScore;
	risk: OpportunityAIScore;
}> {
	await requireOpportunityAIContext();

	const [fit, winProbability, risk] = await Promise.all([
		calculateFitScore(opportunityId),
		calculateWinProbability(opportunityId),
		calculateRiskScore(opportunityId),
	]);

	return { fit, winProbability, risk };
}

// ============================================================================
// Score Retrieval
// ============================================================================

/**
 * Get the latest AI scores for an opportunity.
 */
export async function getLatestScores(opportunityId: string): Promise<OpportunityAIScoreSummary> {
	const context = await requireOpportunityAIContext();

	// Get latest score for each type
	const scoreTypes: AIScoreType[] = ["fit", "win_probability", "risk", "effort"];

	const latestScores = await Promise.all(
		scoreTypes.map(async (type) => {
			const [score] = await db
				.select()
				.from(opportunityAIScores)
				.where(
					and(
						visibleOpportunityScoresCondition(opportunityId, context),
						eq(opportunityAIScores.scoreType, type)
					)
				)
				.orderBy(desc(opportunityAIScores.createdAt))
				.limit(1);

			return { type, score };
		})
	);

	const summary: OpportunityAIScoreSummary = {
		opportunityId,
		fitScore: null,
		winProbability: null,
		riskScore: null,
		effortScore: null,
		lastUpdated: null,
	};

	let mostRecentDate: Date | null = null;

	for (const { type, score } of latestScores) {
		if (score) {
			if (type === "fit") summary.fitScore = score.score;
			else if (type === "win_probability") summary.winProbability = score.score;
			else if (type === "risk") summary.riskScore = score.score;
			else if (type === "effort") summary.effortScore = score.score;

			if (!mostRecentDate || score.createdAt > mostRecentDate) {
				mostRecentDate = score.createdAt;
			}
		}
	}

	summary.lastUpdated = mostRecentDate;

	return summary;
}

/**
 * Get AI score history for an opportunity.
 */
export async function getAIScoreHistory(
	opportunityId: string,
	scoreType?: AIScoreType,
	limit: number = 10
): Promise<OpportunityAIScore[]> {
	const context = await requireOpportunityAIContext();
	const normalizedLimit = normalizeAIScoreHistoryLimit(limit);

	let query = db
		.select()
		.from(opportunityAIScores)
		.where(visibleOpportunityScoresCondition(opportunityId, context))
		.orderBy(desc(opportunityAIScores.createdAt))
		.limit(normalizedLimit);

	if (scoreType) {
		query = db
			.select()
			.from(opportunityAIScores)
			.where(
				and(
					visibleOpportunityScoresCondition(opportunityId, context),
					eq(opportunityAIScores.scoreType, scoreType)
				)
			)
			.orderBy(desc(opportunityAIScores.createdAt))
			.limit(normalizedLimit);
	}

	const rows = await query;
	return rows.map(mapToAIScore);
}

/**
 * Get a specific AI score by ID.
 */
export async function getAIScore(scoreId: string): Promise<OpportunityAIScore | null> {
	const context = await requireOpportunityAIContext();

	const [row] = await db
		.select()
		.from(opportunityAIScores)
		.where(visibleAIScoreCondition(scoreId, context))
		.limit(1);

	return row ? mapToAIScore(row) : null;
}

// ============================================================================
// Scoring Factors (Heuristic-based)
// ============================================================================

/**
 * Calculate fit factors using AI-powered analysis where available.
 */
async function calculateFitFactors(opp: typeof opportunities.$inferSelect): Promise<AIScoreFactor[]> {
	const manager = getProviderManager();
	await manager.initialize();
	
	// If AI is available, use it for sophisticated analysis
	if (await manager.isAvailable()) {
		try {
			return await calculateFitFactorsWithAI(opp);
		} catch (error) {
			logger.warn("[AI Fit Factors Error] Falling back to heuristic:", error);
		}
	}
	
	// Fallback to heuristic calculations
	return calculateFitFactorsHeuristic(opp);
}

/**
 * Calculate fit factors using AI analysis.
 */
async function calculateFitFactorsWithAI(opp: typeof opportunities.$inferSelect): Promise<AIScoreFactor[]> {
	const manager = getProviderManager();
	const companyInfo = await getCompanyCapabilities();
	
	const systemPrompt = `You are an expert business development analyst. Analyze an opportunity for strategic fit with a company's capabilities.

Output your analysis as JSON with this exact structure:
{
  "factors": [
    {"factor": "<factor name>", "weight": <0.0-1.0>, "score": <0-100>, "reasoning": "<explanation>"}
  ]
}

Evaluate these factors:
1. Budget Alignment (weight 0.2) - Does the budget match our typical project size?
2. Timeline Feasibility (weight 0.15) - Is the deadline achievable?
3. Category Relevance (weight 0.25) - Do our capabilities align with the work?
4. Geographic Fit (weight 0.15) - Is the location within our operational footprint?
5. Requirements Clarity (weight 0.15) - Are requirements well-defined?
6. Strategic Alignment (weight 0.1) - Does this support our strategic goals?

Be objective and fair. Score 70+ for good fit, below 50 for poor fit.
Only output valid JSON.`;

	const userPrompt = `Evaluate this opportunity for strategic fit:

**Opportunity:**
- Title: ${opp.title}
- Organization: ${opp.organization || "Not specified"}
- Budget: ${opp.budgetValue || "Not specified"} (${opp.budgetNumeric ? `$${opp.budgetNumeric}` : "unknown"})
- Deadline: ${opp.daysLeft !== null ? `${opp.daysLeft} days remaining` : "Not specified"}
- Category: ${opp.category || "Not specified"}
- Sector: ${opp.sector || "Not specified"}
- Location: ${opp.countryRegion || "Not specified"}

**Project Summary:**
${opp.projectSummary || "Not provided"}

**Key Requirements:**
${opp.keyRequirements || "Not provided"}

**Technical Requirements:**
${opp.technicalRequirements || "Not provided"}

**Our Company Capabilities:**
- Core Capabilities: ${companyInfo.capabilities.join(", ") || "General consulting"}
- Differentiators: ${companyInfo.differentiators.join(", ") || "Not specified"}
- Certifications: ${companyInfo.certifications.join(", ") || "None"}

Provide your fit analysis as JSON.`;

	const response = await manager.complete({
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		temperature: 0.3,
		maxTokens: 1200,
	});

	// Parse the JSON response
	const jsonMatch = response.content.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error("Invalid JSON response from AI");
	}

	const analysis = JSON.parse(jsonMatch[0]) as {
		factors?: AIScoreFactor[];
	};

	return analysis.factors || calculateFitFactorsHeuristic(opp);
}

/**
 * Calculate fit factors using heuristic-based analysis (fallback).
 */
function calculateFitFactorsHeuristic(opp: typeof opportunities.$inferSelect): AIScoreFactor[] {
	const factors: AIScoreFactor[] = [];

	// Budget alignment (favor medium-large budgets)
	const budgetScore = calculateBudgetScore(opp.budgetNumeric);
	factors.push({
		factor: "Budget Alignment",
		weight: 0.2,
		score: budgetScore,
		reasoning: opp.budgetNumeric
			? `Budget of ${opp.budgetValue} ${budgetScore >= 70 ? "aligns well" : "may be challenging"} with our target project size.`
			: "Budget not specified - uncertain alignment.",
	});

	// Deadline feasibility (favor 30-90 days out)
	const deadlineScore = calculateDeadlineScore(opp.daysLeft);
	factors.push({
		factor: "Timeline Feasibility",
		weight: 0.15,
		score: deadlineScore,
		reasoning:
			opp.daysLeft !== null
				? `${opp.daysLeft} days until deadline ${deadlineScore >= 70 ? "provides adequate preparation time" : "may be tight"}.`
				: "No deadline specified.",
	});

	// Category relevance
	const categoryScore = calculateCategoryScore(opp.category);
	factors.push({
		factor: "Category Relevance",
		weight: 0.25,
		score: categoryScore,
		reasoning: opp.category
			? `Category "${opp.category}" ${categoryScore >= 70 ? "matches" : "partially matches"} our core competencies.`
			: "Category not specified.",
	});

	// Geographic alignment
	const geoScore = calculateGeographyScore(opp.countryRegion);
	factors.push({
		factor: "Geographic Fit",
		weight: 0.15,
		score: geoScore,
		reasoning: opp.countryRegion
			? `Location "${opp.countryRegion}" ${geoScore >= 70 ? "is within" : "may require expansion to"} our operational footprint.`
			: "Location not specified.",
	});

	// Requirements clarity
	const clarityScore = calculateClarityScore(opp);
	factors.push({
		factor: "Requirements Clarity",
		weight: 0.15,
		score: clarityScore,
		reasoning: `Requirements are ${clarityScore >= 70 ? "well-defined" : "partially defined"}, ${clarityScore >= 70 ? "reducing" : "increasing"} proposal effort.`,
	});

	// Strategic alignment (based on sector)
	const strategicScore = calculateStrategicScore(opp.sector);
	factors.push({
		factor: "Strategic Alignment",
		weight: 0.1,
		score: strategicScore,
		reasoning: opp.sector
			? `Sector "${opp.sector}" ${strategicScore >= 70 ? "aligns with" : "is adjacent to"} our strategic focus.`
			: "Sector not specified.",
	});

	return factors;
}

/**
 * Calculate win probability factors with AI-enhanced analysis.
 */
async function calculateWinFactors(opp: typeof opportunities.$inferSelect, context: OpportunityAIContext): Promise<AIScoreFactor[]> {
	const manager = getProviderManager();
	await manager.initialize();
	
	// If AI is available, use it for sophisticated analysis
	if (await manager.isAvailable()) {
		try {
			// Get relationship score from CRM/historical data
			const relationshipScore = await estimateRelationshipScoreFromCRM(opp.organization, context);
			
			// Use AI for other factors
			const aiFactors = await calculateWinFactorsWithAI(opp, relationshipScore, context);
			return aiFactors;
		} catch (error) {
			logger.warn("[AI Win Factors Error] Falling back to heuristic:", error);
		}
	}
	
	// Fallback to heuristic calculations
	return await calculateWinFactorsHeuristic(opp, context);
}

/**
 * Calculate win factors using AI analysis.
 */
async function calculateWinFactorsWithAI(
	opp: typeof opportunities.$inferSelect,
	relationshipScore: number,
	context: OpportunityAIContext
): Promise<AIScoreFactor[]> {
	const manager = getProviderManager();
	const companyInfo = await getCompanyCapabilities();
	
	const systemPrompt = `You are an expert proposal strategist. Estimate win probability factors for a government/enterprise opportunity.

Output your analysis as JSON with this exact structure:
{
  "factors": [
    {"factor": "<factor name>", "weight": <0.0-1.0>, "score": <0-100>, "reasoning": "<explanation>"}
  ]
}

Evaluate these factors:
1. Competition Level (weight 0.25) - How competitive is this opportunity?
2. Technical Capability (weight 0.25) - How well do our skills match?
3. Pricing Position (weight 0.15) - Can we be competitive on price?
4. Submission Complexity (weight 0.15) - How complex is the proposal process?
5. Client Relationship (weight 0.2) - Existing relationship score provided

Be realistic and conservative. Score 60+ for favorable conditions, below 40 for challenging.
Only output valid JSON.`;

	const userPrompt = `Estimate win probability factors for this opportunity:

**Opportunity:**
- Title: ${opp.title}
- Organization: ${opp.organization || "Not specified"}
- Budget: ${opp.budgetValue || "Not specified"}
- Category: ${opp.category || "Not specified"}
- Sector: ${opp.sector || "Not specified"}
- Deadline: ${opp.daysLeft !== null ? `${opp.daysLeft} days remaining` : "Not specified"}

**Technical Requirements:**
${opp.technicalRequirements || "Not provided"}

**Submission Requirements:**
${opp.submissionRequirements || "Not provided"}

**Our Capabilities:**
- Core: ${companyInfo.capabilities.join(", ") || "General consulting"}
- Certifications: ${companyInfo.certifications.join(", ") || "None"}

**Historical Data:**
- Client Relationship Score: ${relationshipScore}/100 (${relationshipScore >= 70 ? "Existing relationship" : relationshipScore >= 40 ? "Some history" : "New client"})

Provide your win factor analysis as JSON.`;

	const response = await manager.complete({
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		temperature: 0.3,
		maxTokens: 1200,
	});

	// Parse the JSON response
	const jsonMatch = response.content.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error("Invalid JSON response from AI");
	}

	const analysis = JSON.parse(jsonMatch[0]) as {
		factors?: AIScoreFactor[];
	};

	// Merge AI factors with relationship score if not included
	let factors = analysis.factors || [];
	const hasRelationshipFactor = factors.some(f => f.factor.toLowerCase().includes("relationship"));
	
	if (!hasRelationshipFactor) {
		const relationshipInfo = await getClientRelationshipInfo(opp.organization, context);
		factors.push({
			factor: "Client Relationship",
			weight: 0.2,
			score: relationshipScore,
			reasoning: relationshipInfo.reasoning,
		});
	}

	return factors.length > 0 ? factors : await calculateWinFactorsHeuristic(opp, context);
}

/**
 * Estimate relationship score from CRM/historical data.
 */
async function estimateRelationshipScoreFromCRM(
	organization: string | null,
	context: OpportunityAIContext
): Promise<number> {
	if (!organization) return 40;
	
	try {
		// Query database for past opportunities with this organization
		const pastOpportunities = await db
			.select({
				decisionStatus: opportunities.decisionStatus,
				count: count(),
			})
			.from(opportunities)
			.where(
				and(
					eq(opportunities.organization, organization),
					opportunityOrganizationCondition(context.organizationId),
					eq(opportunities.assignedTo, context.userId)
				)
			)
			.groupBy(opportunities.decisionStatus);
		
		const wonCount = pastOpportunities.find(o => o.decisionStatus === "won")?.count ?? 0;
		const lostCount = pastOpportunities.find(o => o.decisionStatus === "lost")?.count ?? 0;
		const totalCount = pastOpportunities.reduce((sum, o) => sum + Number(o.count), 0);
		
		if (totalCount === 0) {
			// New client - check if we've submitted before
			const submittedCount = await db
				.select({ count: count() })
				.from(opportunities)
				.where(
					and(
						eq(opportunities.organization, organization),
						opportunityOrganizationCondition(context.organizationId),
						eq(opportunities.assignedTo, context.userId),
						sql`${opportunities.decisionStatus} != 'pending'`
					)
				);
			
			return Number(submittedCount[0]?.count) > 0 ? 50 : 40;
		}
		
		// Calculate win rate
		const winRate = wonCount / totalCount;
		
		if (winRate >= 0.5) return 85; // Strong relationship
		if (winRate >= 0.3) return 70; // Good relationship
		if (winRate >= 0.1) return 55; // Some history
		return 45; // Poor track record
	} catch (error) {
		logger.warn("[CRM Query Error] Using default relationship score:", error);
		return 50;
	}
}

/**
 * Get client relationship information.
 */
async function getClientRelationshipInfo(
	organization: string | null,
	context: OpportunityAIContext
): Promise<{ reasoning: string }> {
	if (!organization) {
		return { reasoning: "Organization not specified - no relationship history available." };
	}
	
	try {
		const pastOpportunities = await db
			.select({
				decisionStatus: opportunities.decisionStatus,
				count: count(),
			})
			.from(opportunities)
			.where(
				and(
					eq(opportunities.organization, organization),
					opportunityOrganizationCondition(context.organizationId),
					eq(opportunities.assignedTo, context.userId)
				)
			)
			.groupBy(opportunities.decisionStatus);
		
		const wonCount = pastOpportunities.find(o => o.decisionStatus === "won")?.count ?? 0;
		const lostCount = pastOpportunities.find(o => o.decisionStatus === "lost")?.count ?? 0;
		const totalCount = pastOpportunities.reduce((sum, o) => sum + Number(o.count), 0);
		
		if (totalCount === 0) {
			return { reasoning: `New client ${organization} - no prior relationship.` };
		}
		
		const winRate = Math.round((Number(wonCount) / Number(totalCount)) * 100);
		return { 
			reasoning: `${winRate}% win rate with ${organization} (${wonCount} won, ${lostCount} lost out of ${totalCount} opportunities).` 
		};
	} catch (error) {
		return { reasoning: `Relationship with ${organization} - historical data unavailable.` };
	}
}

/**
 * Calculate win factors using heuristic-based analysis (fallback).
 */
async function calculateWinFactorsHeuristic(
	opp: typeof opportunities.$inferSelect,
	context: OpportunityAIContext
): Promise<AIScoreFactor[]> {
	const factors: AIScoreFactor[] = [];

	// Competition level (estimated based on budget and visibility)
	const competitionScore = estimateCompetitionScore(opp);
	factors.push({
		factor: "Competition Level",
		weight: 0.25,
		score: competitionScore,
		reasoning: `Estimated competition is ${competitionScore >= 60 ? "moderate to low" : "high"} based on opportunity profile.`,
	});

	// Past relationship
	const relationshipScore = await estimateRelationshipScore(opp.organization, context);
	factors.push({
		factor: "Client Relationship",
		weight: 0.2,
		score: relationshipScore,
		reasoning: opp.organization
			? `${relationshipScore >= 70 ? "Existing relationship" : "New client"} with ${opp.organization}.`
			: "Organization not specified.",
	});

	// Technical fit
	const techScore = calculateTechnicalFitScore(opp.technicalRequirements);
	factors.push({
		factor: "Technical Capability",
		weight: 0.25,
		score: techScore,
		reasoning: `Technical requirements ${techScore >= 70 ? "match" : "partially align with"} our capabilities.`,
	});

	// Pricing competitiveness (based on budget range)
	const pricingScore = calculatePricingScore(opp.budgetNumeric);
	factors.push({
		factor: "Pricing Position",
		weight: 0.15,
		score: pricingScore,
		reasoning: `Budget range ${pricingScore >= 70 ? "allows competitive positioning" : "may constrain margins"}.`,
	});

	// Submission complexity
	const submissionScore = calculateSubmissionScore(opp.submissionRequirements);
	factors.push({
		factor: "Submission Complexity",
		weight: 0.15,
		score: submissionScore,
		reasoning: `Submission requirements are ${submissionScore >= 70 ? "manageable" : "complex"}.`,
	});

	return factors;
}

/**
 * Calculate risk factors with AI-enhanced analysis.
 */
async function calculateRiskFactors(opp: typeof opportunities.$inferSelect): Promise<AIScoreFactor[]> {
	const manager = getProviderManager();
	await manager.initialize();
	
	// If AI is available, use it for sophisticated analysis
	if (await manager.isAvailable()) {
		try {
			return await calculateRiskFactorsWithAI(opp);
		} catch (error) {
			logger.warn("[AI Risk Factors Error] Falling back to heuristic:", error);
		}
	}
	
	// Fallback to heuristic calculations
	return calculateRiskFactorsHeuristic(opp);
}

/**
 * Calculate risk factors using AI analysis.
 */
async function calculateRiskFactorsWithAI(opp: typeof opportunities.$inferSelect): Promise<AIScoreFactor[]> {
	const manager = getProviderManager();
	const companyInfo = await getCompanyCapabilities();
	
	const systemPrompt = `You are an expert risk analyst for government/enterprise proposals.

Output your analysis as JSON with this exact structure:
{
  "factors": [
    {"factor": "<risk factor>", "weight": <0.0-1.0>, "score": <0-100>, "reasoning": "<explanation>"}
  ]
}

Evaluate these risk factors (higher score = higher risk):
1. Timeline Risk (weight 0.25) - Is the deadline realistic?
2. Scope Uncertainty (weight 0.25) - How well-defined is the scope?
3. Financial Risk (weight 0.2) - Budget adequacy and payment terms
4. Geographic Risk (weight 0.15) - Location-related challenges
5. Execution Complexity (weight 0.15) - Technical/operational complexity

Be thorough in identifying risks. Score 60+ for high risk, below 40 for low risk.
Only output valid JSON.`;

	const userPrompt = `Analyze risks for this opportunity:

**Opportunity:**
- Title: ${opp.title}
- Organization: ${opp.organization || "Not specified"}
- Budget: ${opp.budgetValue || "Not specified"} (${opp.budgetNumeric ? `$${opp.budgetNumeric}` : "unknown"})
- Deadline: ${opp.daysLeft !== null ? `${opp.daysLeft} days remaining` : "Not specified"}
- Location: ${opp.countryRegion || "Not specified"}

**Project Scope:**
${opp.projectScope || opp.projectSummary || "Not provided"}

**Technical Requirements:**
${opp.technicalRequirements || "Not provided"}

**Key Requirements:**
${opp.keyRequirements || "Not provided"}

**Our Experience:**
- Core Capabilities: ${companyInfo.capabilities.join(", ") || "General consulting"}
- Past Projects: ${companyInfo.differentiators.join(", ") || "Not specified"}

Provide your risk analysis as JSON.`;

	const response = await manager.complete({
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		temperature: 0.3,
		maxTokens: 1200,
	});

	// Parse the JSON response
	const jsonMatch = response.content.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error("Invalid JSON response from AI");
	}

	const analysis = JSON.parse(jsonMatch[0]) as {
		factors?: AIScoreFactor[];
	};

	return analysis.factors || calculateRiskFactorsHeuristic(opp);
}

/**
 * Calculate risk factors using heuristic-based analysis (fallback).
 */
function calculateRiskFactorsHeuristic(opp: typeof opportunities.$inferSelect): AIScoreFactor[] {
	const factors: AIScoreFactor[] = [];

	// Timeline risk
	const timelineRisk = 100 - calculateDeadlineScore(opp.daysLeft);
	factors.push({
		factor: "Timeline Risk",
		weight: 0.25,
		score: timelineRisk,
		reasoning:
			opp.daysLeft !== null
				? `${opp.daysLeft} days may ${timelineRisk >= 50 ? "not be sufficient" : "be adequate"} for quality proposal.`
				: "No deadline - cannot assess timeline risk.",
	});

	// Scope uncertainty
	const scopeRisk = 100 - calculateClarityScore(opp);
	factors.push({
		factor: "Scope Uncertainty",
		weight: 0.25,
		score: scopeRisk,
		reasoning: `Scope definition ${scopeRisk >= 50 ? "lacks clarity" : "is well-defined"}, ${scopeRisk >= 50 ? "increasing" : "reducing"} delivery risk.`,
	});

	// Financial risk
	const financialRisk = calculateFinancialRisk(opp.budgetNumeric);
	factors.push({
		factor: "Financial Risk",
		weight: 0.2,
		score: financialRisk,
		reasoning: opp.budgetNumeric
			? `Budget level ${financialRisk >= 50 ? "may strain resources" : "supports sustainable delivery"}.`
			: "Budget unknown - moderate financial risk assumed.",
	});

	// Geographic risk
	const geoRisk = 100 - calculateGeographyScore(opp.countryRegion);
	factors.push({
		factor: "Geographic Risk",
		weight: 0.15,
		score: geoRisk,
		reasoning: opp.countryRegion
			? `Location ${geoRisk >= 50 ? "introduces operational challenges" : "is within comfortable reach"}.`
			: "Location unknown.",
	});

	// Execution complexity
	const complexityRisk = calculateComplexityRisk(opp);
	factors.push({
		factor: "Execution Complexity",
		weight: 0.15,
		score: complexityRisk,
		reasoning: `Project complexity ${complexityRisk >= 50 ? "requires careful management" : "is manageable"}.`,
	});

	return factors;
}

// ============================================================================
// Score Calculation Helpers
// ============================================================================

function calculateBudgetScore(budgetNumeric: number | null): number {
	if (budgetNumeric === null) return 50;
	if (budgetNumeric < 10000) return 30;
	if (budgetNumeric < 50000) return 50;
	if (budgetNumeric < 200000) return 80;
	if (budgetNumeric < 1000000) return 90;
	return 85; // Very large budgets may have more competition
}

function calculateDeadlineScore(daysLeft: number | null): number {
	if (daysLeft === null) return 50;
	if (daysLeft < 0) return 0; // Expired
	if (daysLeft < 7) return 20;
	if (daysLeft < 14) return 40;
	if (daysLeft < 30) return 60;
	if (daysLeft < 60) return 90;
	if (daysLeft < 90) return 85;
	return 70; // Very far out may indicate low urgency
}

function calculateCategoryScore(category: string | null): number {
	if (!category) return 50;

	const highFitCategories = [
		"software",
		"digital",
		"technology",
		"it",
		"gis",
		"data",
		"analytics",
		"cloud",
		"web",
	];

	const categoryLower = category.toLowerCase();
	const isHighFit = highFitCategories.some((c) => categoryLower.includes(c));

	return isHighFit ? 85 : 55;
}

function calculateGeographyScore(countryRegion: string | null): number {
	if (!countryRegion) return 50;

	const primaryMarkets = ["kenya", "tanzania", "uganda", "rwanda", "africa"];
	const regionLower = countryRegion.toLowerCase();
	const isPrimary = primaryMarkets.some((m) => regionLower.includes(m));

	return isPrimary ? 90 : 60;
}

function calculateClarityScore(opp: typeof opportunities.$inferSelect): number {
	let score = 50;

	if (opp.projectSummary && opp.projectSummary.length > 100) score += 15;
	if (opp.keyRequirements && opp.keyRequirements.length > 50) score += 15;
	if (opp.technicalRequirements && opp.technicalRequirements.length > 50) score += 10;
	if (opp.submissionRequirements && opp.submissionRequirements.length > 50) score += 10;

	return Math.min(score, 100);
}

function calculateStrategicScore(sector: string | null): number {
	if (!sector) return 50;

	const strategicSectors = ["government", "ngo", "health", "education", "finance"];
	const sectorLower = sector.toLowerCase();
	const isStrategic = strategicSectors.some((s) => sectorLower.includes(s));

	return isStrategic ? 85 : 60;
}

function estimateCompetitionScore(opp: typeof opportunities.$inferSelect): number {
	let score = 50;

	// High budget = more competition
	if (opp.budgetNumeric && opp.budgetNumeric > 500000) score -= 15;

	// Well-known organizations attract more bidders
	if (opp.organization && opp.organization.toLowerCase().includes("world bank")) score -= 20;

	// Short deadlines = less competition
	if (opp.daysLeft !== null && opp.daysLeft < 14) score += 20;

	// Niche categories have less competition
	if (opp.category && opp.category.toLowerCase().includes("gis")) score += 15;

	return Math.max(20, Math.min(80, score));
}

async function estimateRelationshipScore(
	organization: string | null,
	context: OpportunityAIContext
): Promise<number> {
	// This function is now replaced by estimateRelationshipScoreFromCRM
	// Kept for backward compatibility
	return await estimateRelationshipScoreFromCRM(organization, context);
}

function calculateTechnicalFitScore(techRequirements: string | null): number {
	if (!techRequirements) return 60;

	const ourTech = ["python", "react", "node", "aws", "gis", "postgresql", "api"];
	const reqLower = techRequirements.toLowerCase();
	const matches = ourTech.filter((t) => reqLower.includes(t)).length;

	return 50 + matches * 10;
}

function calculatePricingScore(budgetNumeric: number | null): number {
	if (budgetNumeric === null) return 50;
	if (budgetNumeric < 20000) return 30; // Too low margin
	if (budgetNumeric < 50000) return 60;
	if (budgetNumeric < 200000) return 80;
	return 70; // Large budgets may have price pressure
}

function calculateSubmissionScore(submissionRequirements: string | null): number {
	if (!submissionRequirements) return 70;

	const reqLower = submissionRequirements.toLowerCase();
	let score = 70;

	if (reqLower.includes("portal")) score -= 10;
	if (reqLower.includes("notarize")) score -= 15;
	if (reqLower.includes("physical")) score -= 10;
	if (reqLower.includes("email")) score += 10;

	return Math.max(30, Math.min(90, score));
}

function calculateFinancialRisk(budgetNumeric: number | null): number {
	if (budgetNumeric === null) return 50;
	if (budgetNumeric < 10000) return 70; // Low margin risk
	if (budgetNumeric > 1000000) return 60; // Large project risk
	return 30; // Medium projects are lowest risk
}

function calculateComplexityRisk(opp: typeof opportunities.$inferSelect): number {
	let risk = 30;

	if (opp.budgetNumeric && opp.budgetNumeric > 500000) risk += 15;
	if (opp.projectScope && opp.projectScope.length > 1000) risk += 10;
	if (
		opp.technicalRequirements &&
		opp.technicalRequirements.toLowerCase().includes("integration")
	)
		risk += 15;

	return Math.min(risk, 80);
}

// ============================================================================
// Reasoning Generators
// ============================================================================

function generateFitReasoning(factors: AIScoreFactor[], score: number): string {
	const topStrengths = factors.filter((f) => f.score >= 70).slice(0, 2);
	const topWeaknesses = factors.filter((f) => f.score < 50).slice(0, 2);

	let reasoning = `Overall fit score of ${Math.round(score)}%. `;

	if (topStrengths.length > 0) {
		reasoning += `Strengths: ${topStrengths.map((f) => f.factor.toLowerCase()).join(", ")}. `;
	}

	if (topWeaknesses.length > 0) {
		reasoning += `Areas of concern: ${topWeaknesses.map((f) => f.factor.toLowerCase()).join(", ")}.`;
	}

	return reasoning;
}

function generateWinReasoning(factors: AIScoreFactor[], score: number): string {
	return `Win probability estimated at ${Math.round(score)}% based on ${factors.length} factors including competition level, technical fit, and pricing position.`;
}

function generateRiskReasoning(factors: AIScoreFactor[], score: number): string {
	const highRisks = factors.filter((f) => f.score >= 60);

	let reasoning = `Overall risk level: ${score >= 60 ? "High" : score >= 40 ? "Medium" : "Low"} (${Math.round(score)}%). `;

	if (highRisks.length > 0) {
		reasoning += `Key risks: ${highRisks.map((f) => f.factor.toLowerCase()).join(", ")}.`;
	}

	return reasoning;
}

// ============================================================================
// Helpers
// ============================================================================

function mapToAIScore(row: typeof opportunityAIScores.$inferSelect): OpportunityAIScore {
	return {
		id: row.id,
		opportunityId: row.opportunityId,
		scoreType: row.scoreType as AIScoreType,
		score: row.score,
		factors: (row.factors as AIScoreFactor[]) ?? [],
		modelVersion: row.modelVersion,
		reasoning: row.reasoning,
		createdAt: row.createdAt,
	};
}

// ============================================================================
// LLM-Powered Scoring (when AI provider is available)
// ============================================================================

/**
 * Calculate fit score using LLM analysis.
 * Falls back to heuristic scoring if no AI provider is available.
 */
export async function calculateFitScoreWithLLM(opportunityId: string): Promise<OpportunityAIScore> {
	const context = await requireOpportunityAIContext();

	// Check if AI is available
	const manager = getProviderManager();
	await manager.initialize();
	if (!(await manager.isAvailable())) {
		logger.debug("[AI] No provider available, using heuristic scoring");
		return calculateFitScore(opportunityId);
	}

	const opp = await loadVisibleOpportunity(opportunityId, context);

	// Get company capabilities for context
	const companyInfo = await getCompanyCapabilities();

	const systemPrompt = `You are an expert government/enterprise proposal evaluator. Analyze opportunities for strategic fit with a company's capabilities.

Output your analysis as JSON with this exact structure:
{
  "score": <number 0-100>,
  "factors": [
    {"factor": "<factor name>", "weight": <0.0-1.0>, "score": <0-100>, "reasoning": "<explanation>"}
  ],
  "reasoning": "<overall assessment in 2-3 sentences>"
}

Evaluate these factors:
1. Budget Alignment (weight 0.2) - Does the budget match our typical project size?
2. Timeline Feasibility (weight 0.15) - Is the deadline achievable?
3. Category Relevance (weight 0.25) - Do our capabilities align with the work?
4. Geographic Fit (weight 0.15) - Is the location within our operational footprint?
5. Requirements Clarity (weight 0.15) - Are requirements well-defined?
6. Strategic Alignment (weight 0.1) - Does this support our strategic goals?

Be concise and direct. Only output valid JSON.`;

	const userPrompt = `Evaluate this opportunity for strategic fit:

**Opportunity Details:**
- Title: ${opp.title}
- Organization: ${opp.organization || "Not specified"}
- Budget: ${opp.budgetValue || "Not specified"}
- Deadline: ${opp.daysLeft !== null ? `${opp.daysLeft} days remaining` : "Not specified"}
- Category: ${opp.category || "Not specified"}
- Sector: ${opp.sector || "Not specified"}
- Location: ${opp.countryRegion || "Not specified"}

**Project Summary:**
${opp.projectSummary || "Not provided"}

**Key Requirements:**
${opp.keyRequirements || "Not provided"}

**Our Company Capabilities:**
- Core Capabilities: ${companyInfo.capabilities.join(", ") || "General consulting"}
- Differentiators: ${companyInfo.differentiators.join(", ") || "Not specified"}
- Certifications: ${companyInfo.certifications.join(", ") || "None"}

Provide your fit analysis as JSON.`;

	try {
		const response = await prompt(userPrompt, systemPrompt, {
			temperature: 0.3,
			maxTokens: 1024,
		});

		// Parse the JSON response
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error("Invalid JSON response from LLM");
		}

		const analysis = JSON.parse(jsonMatch[0]) as {
			score: number;
			factors: AIScoreFactor[];
			reasoning: string;
		};

		// Validate and clamp score
		const finalScore = Math.max(0, Math.min(100, analysis.score));

		// Store the score
		const [score] = await db
			.insert(opportunityAIScores)
			.values({
				organizationId: context.organizationId,
				opportunityId,
				scoreType: "fit",
				score: Math.round(finalScore * 10) / 10,
				factors: analysis.factors || [],
				modelVersion: "v2.0-llm",
				reasoning: analysis.reasoning || `Fit score: ${finalScore}%`,
				createdAt: new Date(),
			})
			.returning();

		// Update the opportunity's fitScore field
		await db
			.update(opportunities)
			.set({
				fitScore: Math.round(finalScore * 10) / 10,
				updatedAt: new Date(),
			})
			.where(visibleOpportunityCondition(opportunityId, context));

		return mapToAIScore(score);
	} catch (error) {
		logger.error("[AI Fit Score Error]", error);
		// Fall back to heuristic scoring
		return calculateFitScore(opportunityId);
	}
}

/**
 * Calculate win probability using LLM analysis.
 */
export async function calculateWinProbabilityWithLLM(opportunityId: string): Promise<OpportunityAIScore> {
	const context = await requireOpportunityAIContext();

	const manager = getProviderManager();
	await manager.initialize();
	if (!(await manager.isAvailable())) {
		return calculateWinProbability(opportunityId);
	}

	const opp = await loadVisibleOpportunity(opportunityId, context);

	const companyInfo = await getCompanyCapabilities();

	const systemPrompt = `You are an expert proposal strategist who estimates win probability for government/enterprise opportunities.

Output your analysis as JSON with this exact structure:
{
  "score": <number 0-100 representing win probability percentage>,
  "factors": [
    {"factor": "<factor name>", "weight": <0.0-1.0>, "score": <0-100>, "reasoning": "<explanation>"}
  ],
  "reasoning": "<overall assessment in 2-3 sentences>"
}

Evaluate these factors:
1. Competition Level (weight 0.25) - How competitive is this opportunity?
2. Client Relationship (weight 0.2) - Any prior relationship with the organization?
3. Technical Capability (weight 0.25) - How well do our skills match?
4. Pricing Position (weight 0.15) - Can we be competitive on price?
5. Submission Complexity (weight 0.15) - How complex is the proposal process?

Be realistic and conservative in your estimates. Only output valid JSON.`;

	const userPrompt = `Estimate win probability for this opportunity:

**Opportunity:**
- Title: ${opp.title}
- Organization: ${opp.organization || "Not specified"}
- Budget: ${opp.budgetValue || "Not specified"}
- Category: ${opp.category || "Not specified"}
- Sector: ${opp.sector || "Not specified"}

**Technical Requirements:**
${opp.technicalRequirements || "Not provided"}

**Submission Requirements:**
${opp.submissionRequirements || "Not provided"}

**Our Capabilities:**
- Core: ${companyInfo.capabilities.join(", ") || "General consulting"}
- Certifications: ${companyInfo.certifications.join(", ") || "None"}

Provide your win probability analysis as JSON.`;

	try {
		const response = await prompt(userPrompt, systemPrompt, {
			temperature: 0.3,
			maxTokens: 1024,
		});

		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error("Invalid JSON response");
		}

		const analysis = JSON.parse(jsonMatch[0]) as {
			score: number;
			factors: AIScoreFactor[];
			reasoning: string;
		};

		const finalScore = Math.max(0, Math.min(100, analysis.score));

		const [score] = await db
			.insert(opportunityAIScores)
			.values({
				organizationId: context.organizationId,
				opportunityId,
				scoreType: "win_probability",
				score: Math.round(finalScore * 10) / 10,
				factors: analysis.factors || [],
				modelVersion: "v2.0-llm",
				reasoning: analysis.reasoning || `Win probability: ${finalScore}%`,
				createdAt: new Date(),
			})
			.returning();

		await db
			.update(opportunities)
			.set({
				winProbability: Math.round(finalScore * 10) / 10,
				updatedAt: new Date(),
			})
			.where(visibleOpportunityCondition(opportunityId, context));

		return mapToAIScore(score);
	} catch (error) {
		logger.error("[AI Win Probability Error]", error);
		return calculateWinProbability(opportunityId);
	}
}

/**
 * Calculate risk score using LLM analysis.
 */
export async function calculateRiskScoreWithLLM(opportunityId: string): Promise<OpportunityAIScore> {
	const context = await requireOpportunityAIContext();

	const manager = getProviderManager();
	await manager.initialize();
	if (!(await manager.isAvailable())) {
		return calculateRiskScore(opportunityId);
	}

	const opp = await loadVisibleOpportunity(opportunityId, context);

	const systemPrompt = `You are an expert risk analyst for government/enterprise proposals.

Output your analysis as JSON with this exact structure:
{
  "score": <number 0-100, higher = higher risk>,
  "factors": [
    {"factor": "<risk factor>", "weight": <0.0-1.0>, "score": <0-100>, "reasoning": "<explanation>"}
  ],
  "reasoning": "<overall risk assessment in 2-3 sentences>"
}

Evaluate these risk factors:
1. Timeline Risk (weight 0.25) - Is the deadline realistic?
2. Scope Uncertainty (weight 0.25) - How well-defined is the scope?
3. Financial Risk (weight 0.2) - Budget adequacy and payment terms
4. Geographic Risk (weight 0.15) - Location-related challenges
5. Execution Complexity (weight 0.15) - Technical/operational complexity

Be thorough in identifying risks. Only output valid JSON.`;

	const userPrompt = `Analyze risks for this opportunity:

**Opportunity:**
- Title: ${opp.title}
- Organization: ${opp.organization || "Not specified"}
- Budget: ${opp.budgetValue || "Not specified"}
- Deadline: ${opp.daysLeft !== null ? `${opp.daysLeft} days remaining` : "Not specified"}
- Location: ${opp.countryRegion || "Not specified"}

**Project Scope:**
${opp.projectScope || opp.projectSummary || "Not provided"}

**Technical Requirements:**
${opp.technicalRequirements || "Not provided"}

Provide your risk analysis as JSON.`;

	try {
		const response = await prompt(userPrompt, systemPrompt, {
			temperature: 0.3,
			maxTokens: 1024,
		});

		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error("Invalid JSON response");
		}

		const analysis = JSON.parse(jsonMatch[0]) as {
			score: number;
			factors: AIScoreFactor[];
			reasoning: string;
		};

		const finalScore = Math.max(0, Math.min(100, analysis.score));

		const [score] = await db
			.insert(opportunityAIScores)
			.values({
				organizationId: context.organizationId,
				opportunityId,
				scoreType: "risk",
				score: Math.round(finalScore * 10) / 10,
				factors: analysis.factors || [],
				modelVersion: "v2.0-llm",
				reasoning: analysis.reasoning || `Risk level: ${finalScore}%`,
				createdAt: new Date(),
			})
			.returning();

		return mapToAIScore(score);
	} catch (error) {
		logger.error("[AI Risk Score Error]", error);
		return calculateRiskScore(opportunityId);
	}
}

/**
 * Calculate all scores using LLM when available.
 */
export async function calculateAllScoresWithLLM(opportunityId: string): Promise<{
	fit: OpportunityAIScore;
	winProbability: OpportunityAIScore;
	risk: OpportunityAIScore;
}> {
	await requireOpportunityAIContext();

	const [fit, winProbability, risk] = await Promise.all([
		calculateFitScoreWithLLM(opportunityId),
		calculateWinProbabilityWithLLM(opportunityId),
		calculateRiskScoreWithLLM(opportunityId),
	]);

	return { fit, winProbability, risk };
}

/**
 * Generate AI-powered executive summary for an opportunity.
 */
export async function generateOpportunitySummary(opportunityId: string): Promise<string> {
	const context = await requireOpportunityAIContext();
	const opp = await loadVisibleOpportunity(opportunityId, context);

	const manager = getProviderManager();
	await manager.initialize();
	if (!(await manager.isAvailable())) {
		return buildMetadataOpportunitySummary(opp);
	}

	const systemPrompt = `You are a business development analyst. Write a brief executive summary (3-4 sentences) highlighting the key aspects of this opportunity and why it might be worth pursuing. Be direct and actionable.`;

	const userPrompt = `Summarize this opportunity:

Title: ${opp.title}
Organization: ${opp.organization || "Unknown"}
Budget: ${opp.budgetValue || "Not specified"}
Deadline: ${opp.daysLeft !== null ? `${opp.daysLeft} days` : "Not specified"}
Category: ${opp.category || "Not specified"}
Sector: ${opp.sector || "Not specified"}

Description:
${opp.projectSummary || "No description provided"}

Key Requirements:
${opp.keyRequirements || "Not specified"}`;

	try {
		return await prompt(userPrompt, systemPrompt, {
			temperature: 0.5,
			maxTokens: 300,
		});
	} catch (error) {
		logger.error("[AI Summary Error]", error);
		return buildMetadataOpportunitySummary(opp);
	}
}
