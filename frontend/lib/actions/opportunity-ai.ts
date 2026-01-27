/**
 * Opportunity AI Server Actions - DocFusion
 *
 * Server-side actions for AI-powered opportunity analysis,
 * including fit scoring, win probability, and risk assessment.
 */

"use server";

import { db } from "@/lib/db";
import { opportunityAIScores, opportunities } from "@/lib/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import type {
	OpportunityAIScore,
	OpportunityAIScoreSummary,
	AIScoreType,
	AIScoreFactor,
	Opportunity,
} from "@/lib/types/opportunity";

// ============================================================================
// AI Score Operations
// ============================================================================

/**
 * Calculate fit score for an opportunity.
 * Analyzes how well the opportunity matches our capabilities and strategy.
 */
export async function calculateFitScore(opportunityId: string): Promise<OpportunityAIScore> {
	// Get the opportunity data
	const [opp] = await db
		.select()
		.from(opportunities)
		.where(eq(opportunities.id, opportunityId))
		.limit(1);

	if (!opp) {
		throw new Error(`Opportunity not found: ${opportunityId}`);
	}

	// Calculate fit score based on available data
	// This is a simplified scoring model - in production, this would call an LLM
	const factors = calculateFitFactors(opp);
	const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
	const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
	const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 50;

	// Store the score
	const [score] = await db
		.insert(opportunityAIScores)
		.values({
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
		.where(eq(opportunities.id, opportunityId));

	return mapToAIScore(score);
}

/**
 * Calculate win probability for an opportunity.
 * Estimates likelihood of winning based on various factors.
 */
export async function calculateWinProbability(opportunityId: string): Promise<OpportunityAIScore> {
	const [opp] = await db
		.select()
		.from(opportunities)
		.where(eq(opportunities.id, opportunityId))
		.limit(1);

	if (!opp) {
		throw new Error(`Opportunity not found: ${opportunityId}`);
	}

	const factors = calculateWinFactors(opp);
	const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
	const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
	const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 50;

	const [score] = await db
		.insert(opportunityAIScores)
		.values({
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
		.where(eq(opportunities.id, opportunityId));

	return mapToAIScore(score);
}

/**
 * Calculate risk score for an opportunity.
 * Higher score = higher risk.
 */
export async function calculateRiskScore(opportunityId: string): Promise<OpportunityAIScore> {
	const [opp] = await db
		.select()
		.from(opportunities)
		.where(eq(opportunities.id, opportunityId))
		.limit(1);

	if (!opp) {
		throw new Error(`Opportunity not found: ${opportunityId}`);
	}

	const factors = calculateRiskFactors(opp);
	const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
	const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
	const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 50;

	const [score] = await db
		.insert(opportunityAIScores)
		.values({
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
	// Get latest score for each type
	const scoreTypes: AIScoreType[] = ["fit", "win_probability", "risk", "effort"];

	const latestScores = await Promise.all(
		scoreTypes.map(async (type) => {
			const [score] = await db
				.select()
				.from(opportunityAIScores)
				.where(
					and(
						eq(opportunityAIScores.opportunityId, opportunityId),
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
	let query = db
		.select()
		.from(opportunityAIScores)
		.where(eq(opportunityAIScores.opportunityId, opportunityId))
		.orderBy(desc(opportunityAIScores.createdAt))
		.limit(limit);

	if (scoreType) {
		query = db
			.select()
			.from(opportunityAIScores)
			.where(
				and(
					eq(opportunityAIScores.opportunityId, opportunityId),
					eq(opportunityAIScores.scoreType, scoreType)
				)
			)
			.orderBy(desc(opportunityAIScores.createdAt))
			.limit(limit);
	}

	const rows = await query;
	return rows.map(mapToAIScore);
}

/**
 * Get a specific AI score by ID.
 */
export async function getAIScore(scoreId: string): Promise<OpportunityAIScore | null> {
	const [row] = await db
		.select()
		.from(opportunityAIScores)
		.where(eq(opportunityAIScores.id, scoreId))
		.limit(1);

	return row ? mapToAIScore(row) : null;
}

// ============================================================================
// Scoring Factors (Heuristic-based)
// ============================================================================

/**
 * Calculate fit factors based on opportunity data.
 */
function calculateFitFactors(opp: typeof opportunities.$inferSelect): AIScoreFactor[] {
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
 * Calculate win probability factors.
 */
function calculateWinFactors(opp: typeof opportunities.$inferSelect): AIScoreFactor[] {
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
	const relationshipScore = estimateRelationshipScore(opp.organization);
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
 * Calculate risk factors.
 */
function calculateRiskFactors(opp: typeof opportunities.$inferSelect): AIScoreFactor[] {
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

function estimateRelationshipScore(organization: string | null): number {
	// In production, this would check against a CRM
	if (!organization) return 40;
	return 50; // Default to neutral for unknown clients
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
