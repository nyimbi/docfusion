/**
 * Capture-to-Proposal Pipeline Manager Server Actions - DocFusion
 *
 * Comprehensive server actions for managing the capture pipeline lifecycle,
 * including pipeline tracking, PWin management, activities, gate reviews,
 * milestones, and analytics.
 */

"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import {
	capturePipeline,
	captureActivities,
	gateReviews,
	pipelineMilestones,
	PIPELINE_STAGES,
	type CapturePipeline,
	type CaptureActivity,
	type GateReview,
	type PipelineMilestone,
	type NewCapturePipeline,
	type NewCaptureActivity,
	type NewGateReview,
	type NewPipelineMilestone,
} from "@/lib/db/schema-pipeline";
import { opportunities, opportunityPartners, partners } from "@/lib/db/schema";
import { eq, and, desc, asc, sql, gte, lte, inArray, isNull, count, avg, sum } from "drizzle-orm";
import { getProviderManager } from "@/lib/ai/providers";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/utils/logger";
import { recordWorkflowRuntimeTransition, upsertWorkflowRuntimeTask } from "@/lib/actions/workflow-runtime";

// ============================================================================
// Types
// ============================================================================

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export type PwinCalculation = {
	suggestedPwin: number;
	factors: Array<{
		factor: string;
		impact: "positive" | "neutral" | "negative";
		weight: number;
		score: number;
		rationale: string;
	}>;
	confidence: number;
};

export type GateDecision = {
	decision: "pass" | "conditional_pass" | "fail" | "defer";
	conditions?: Array<{ condition: string; dueDate?: string; assignee?: string }>;
	rationale: string;
	scores?: {
		technical?: string;
		management?: string;
		cost?: string;
		overall?: string;
	};
	reviewerVotes?: Array<{ name: string; vote: string; comments?: string }>;
};

type GateReviewer = {
	name: string;
	role: string;
	vote?: "approve" | "conditional" | "reject";
	comments?: string;
};

export type BidDecisionPackage = {
	opportunityName: string;
	contractValue: number;
	pwin: number;
	pwinFactors: PwinCalculation["factors"];
	executiveSummary: string;
	pros: string[];
	cons: string[];
	competitivePosition: string;
	investmentToDate: number;
	estimatedProposalCost: number;
	recommendation: "bid" | "no_bid" | "conditional";
	conditions?: string[];
};

export type PipelineAnalytics = {
	byStage: Array<{ stage: string; count: number; totalValue: number; avgPwin: number }>;
	totalOpportunities: number;
	totalPipelineValue: number;
	weightedPipelineValue: number;
	conversionRates: Array<{ from: string; to: string; rate: number }>;
	averageTimeInStage: Array<{ stage: string; avgDays: number }>;
};

export type PipelineForecast = {
	quarters: Array<{
		quarter: string;
		expectedWins: number;
		expectedValue: number;
		pipelineValue: number;
		confidence: number;
	}>;
	totalForecastedValue: number;
	confidenceInterval: { low: number; high: number };
};

export type AtRiskOpportunity = {
	pipelineId: string;
	opportunityId: string;
	opportunityName: string;
	riskLevel: "high" | "medium" | "low";
	riskFactors: string[];
	recommendations: string[];
	pwin: number;
	contractValue: number;
};

export type PipelineSummary = {
	pipeline: CapturePipeline;
	recentActivities: CaptureActivity[];
	upcomingGates: GateReview[];
	milestoneStatus: {
		total: number;
		completed: number;
		upcoming: number;
		missed: number;
	};
	healthIndicators: Array<{
		indicator: string;
		status: "good" | "warning" | "critical";
		message: string;
	}>;
	daysInCurrentStage: number;
	nextActions: string[];
};

export type ActivityFilters = {
	status?: string;
	activityType?: string;
	fromDate?: Date;
	toDate?: Date;
};

export type ChecklistItem = {
	item: string;
	required: boolean;
	description?: string;
};

// ============================================================================
// Zod Validation Schemas
// ============================================================================

const updatePipelineSchema = z.object({
	currentStage: z.string().optional(),
	bidDecision: z.enum(["bid", "no_bid", "pending"]).optional(),
	bidDecisionRationale: z.string().optional(),
	bidDecisionMadeBy: z.string().optional(),
	pwinCurrent: z.number().min(0).max(100).optional(),
	pwinTarget: z.number().min(0).max(100).optional(),
	customerRelationshipScore: z.number().min(1).max(10).optional(),
	incumbentStatus: z.enum(["incumbent", "challenger", "new_market"]).optional(),
	solutionReadiness: z.enum(["not_started", "in_progress", "ready"]).optional(),
	technicalApproachStatus: z.string().optional(),
	teamingStatus: z.enum(["none_needed", "in_progress", "complete"]).optional(),
	captureInvestment: z.number().optional(),
	proposalInvestment: z.number().optional(),
	budgetedInvestment: z.number().optional(),
	anticipatedRfpDate: z.date().optional(),
	actualRfpDate: z.date().optional(),
	proposalDueDate: z.date().optional(),
	questionsDeadline: z.date().optional(),
	anticipatedAwardDate: z.date().optional(),
	captureManager: z.string().optional(),
	proposalManager: z.string().optional(),
	priority: z.enum(["high", "medium", "low"]).optional(),
	healthStatus: z.enum(["on_track", "at_risk", "critical"]).optional(),
	notes: z.string().optional(),
});

type UpdatePipelineInput = z.infer<typeof updatePipelineSchema>;

const createActivitySchema = z.object({
	activityType: z.string(),
	title: z.string(),
	description: z.string().optional(),
	scheduledDate: z.date().optional(),
	durationMinutes: z.number().optional(),
	participants: z.array(z.object({
		name: z.string(),
		role: z.string(),
		organization: z.string().optional(),
		isCustomer: z.boolean().optional(),
	})).optional(),
	createdBy: z.string().optional(),
});

type CreateActivityInput = z.infer<typeof createActivitySchema>;

const createMilestoneSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	milestoneType: z.string().optional(),
	targetDate: z.date().optional(),
	owner: z.string().optional(),
	dependsOn: z.array(z.string()).optional(),
});

type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

const updateGateReviewSchema = z.object({
	gateName: z.string().optional(),
	scheduledDate: z.date().optional(),
	status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
	checklistItems: z.array(z.object({
		item: z.string(),
		required: z.boolean(),
		completed: z.boolean(),
		notes: z.string().optional(),
	})).optional(),
	reviewers: z.array(z.object({
		name: z.string(),
		role: z.string(),
		vote: z.enum(["approve", "conditional", "reject"]).optional(),
		comments: z.string().optional(),
	})).optional(),
	chairperson: z.string().optional(),
	presentationUrl: z.string().optional(),
	meetingMinutes: z.string().optional(),
});

type UpdateGateReviewInput = z.infer<typeof updateGateReviewSchema>;

function getGateQuorum(reviewers: GateReviewer[] | null | undefined): number {
	const reviewerCount = reviewers?.length ?? 0;
	if (reviewerCount === 0) return 0;
	return Math.min(2, reviewerCount);
}

function validateGateReviewDecision(review: GateReview, decision: GateDecision): string | null {
	if (review.status === "completed") {
		return "Gate review has already been completed";
	}
	if (review.status === "cancelled") {
		return "Cancelled gate reviews cannot be conducted";
	}
	if (!decision.decision) {
		return "A gate decision is required";
	}
	if (!decision.rationale?.trim()) {
		return "Decision rationale is required";
	}

	const requiredItems = review.checklistItems?.filter((item) => item.required) ?? [];
	const missingRequiredItems = requiredItems.filter((item) => !item.completed);
	if (
		(decision.decision === "pass" || decision.decision === "conditional_pass") &&
		missingRequiredItems.length > 0
	) {
		return `Required checklist items must be completed before a gate can pass: ${missingRequiredItems
			.map((item) => item.item)
			.join(", ")}`;
	}

	if (decision.decision === "conditional_pass" && !decision.conditions?.length) {
		return "Conditional pass requires at least one condition";
	}

	const reviewers = review.reviewers ?? [];
	const quorum = getGateQuorum(reviewers);
	if (quorum > 0) {
		const votes = decision.reviewerVotes ?? reviewers.filter((reviewer) => reviewer.vote);
		if (votes.length < quorum) {
			return `Gate decision requires at least ${quorum} reviewer vote${quorum === 1 ? "" : "s"}`;
		}
		if (decision.decision === "pass" && votes.some((vote) => vote.vote === "reject")) {
			return "Gate cannot pass while a reviewer vote rejects the decision";
		}
	}

	return null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates that a stage transition is valid based on the pipeline flow.
 */
function isValidStageTransition(currentStage: string, newStage: string): boolean {
	// Define valid transitions (can customize based on business rules)
	const validTransitions: Record<string, string[]> = {
		discovery: ["qualification", "no_bid", "cancelled"],
		qualification: ["capture", "no_bid", "cancelled"],
		capture: ["proposal", "no_bid", "cancelled"],
		proposal: ["submitted", "no_bid", "cancelled"],
		submitted: ["evaluation", "cancelled"],
		evaluation: ["awarded", "lost", "cancelled"],
		awarded: [], // Terminal state
		lost: [], // Terminal state
		no_bid: [], // Terminal state
		cancelled: [], // Terminal state
	};

	return validTransitions[currentStage]?.includes(newStage) ?? false;
}

/**
 * Calculate days between two dates.
 */
function daysBetween(start: Date, end: Date): number {
	const msPerDay = 24 * 60 * 60 * 1000;
	return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Get the current quarter string (e.g., "Q1 2024").
 */
function getQuarterString(date: Date): string {
	const quarter = Math.ceil((date.getMonth() + 1) / 3);
	return `Q${quarter} ${date.getFullYear()}`;
}

/**
 * Revalidate pipeline-related paths.
 */
function revalidatePipelinePaths(opportunityId?: string): void {
	revalidatePath("/opportunities");
	revalidatePath("/pipeline");
	if (opportunityId) {
		revalidatePath(`/opportunities/${opportunityId}`);
		revalidatePath(`/pipeline/${opportunityId}`);
	}
}

// ============================================================================
// PIPELINE LIFECYCLE
// ============================================================================

/**
 * Initialize a new capture pipeline for an opportunity.
 * Creates the pipeline record with initial stage and default milestones.
 */
export async function initializePipeline(opportunityId: string): Promise<ActionResult<CapturePipeline>> {
	try {
		// Validate opportunity exists
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(eq(opportunities.id, opportunityId))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		// Check if pipeline already exists
		const [existingPipeline] = await db
			.select()
			.from(capturePipeline)
			.where(eq(capturePipeline.opportunityId, opportunityId))
			.limit(1);

		if (existingPipeline) {
			return { success: false, error: "Pipeline already exists for this opportunity" };
		}

		// Create the pipeline
		const now = new Date();
		const initialStageHistory = [{
			stage: "discovery",
			enteredAt: now.toISOString(),
		}];

		const [newPipeline] = await db
			.insert(capturePipeline)
			.values({
				opportunityId,
				currentStage: "discovery",
				stageEnteredAt: now,
				stageHistory: initialStageHistory,
				pwinCurrent: opportunity.winProbability ?? 50,
				pwinTarget: 70,
				pwinHistory: [{
					date: now.toISOString(),
					value: opportunity.winProbability ?? 50,
					reason: "Initial pipeline creation",
				}],
				priority: opportunity.priorityRank === 5 ? "high" : opportunity.priorityRank === 1 ? "low" : "medium",
				healthStatus: "on_track",
				proposalDueDate: opportunity.deadline ?? undefined,
			} satisfies NewCapturePipeline)
			.returning();

		// Create default milestones based on opportunity dates
		const defaultMilestones: NewPipelineMilestone[] = [];

		if (opportunity.deadline) {
			// RFP Release milestone (if we have anticipated date)
			defaultMilestones.push({
				pipelineId: newPipeline.id,
				name: "RFP Release",
				description: "Official RFP document released",
				milestoneType: "rfp_release",
				status: "pending",
			});

			// Questions Deadline (typically 2 weeks before proposal due)
			const questionsDeadline = new Date(opportunity.deadline);
			questionsDeadline.setDate(questionsDeadline.getDate() - 14);
			defaultMilestones.push({
				pipelineId: newPipeline.id,
				name: "Questions Deadline",
				description: "Last date to submit clarifying questions",
				milestoneType: "questions_due",
				targetDate: questionsDeadline,
				status: "pending",
			});

			// Proposal Due Date
			defaultMilestones.push({
				pipelineId: newPipeline.id,
				name: "Proposal Submission",
				description: "Proposal due to customer",
				milestoneType: "proposal_due",
				targetDate: opportunity.deadline,
				status: "pending",
			});
		}

		// Always add these milestones
		defaultMilestones.push(
			{
				pipelineId: newPipeline.id,
				name: "Bid/No-Bid Decision",
				description: "Gate review for bid decision",
				milestoneType: "bid_decision",
				status: "pending",
			},
			{
				pipelineId: newPipeline.id,
				name: "Color Review (Pink Team)",
				description: "Initial compliance and outline review",
				milestoneType: "color_review",
				status: "pending",
			},
			{
				pipelineId: newPipeline.id,
				name: "Color Review (Red Team)",
				description: "Full proposal review as evaluator",
				milestoneType: "color_review",
				status: "pending",
			}
		);

		if (defaultMilestones.length > 0) {
			await db.insert(pipelineMilestones).values(defaultMilestones);
		}

		revalidatePipelinePaths(opportunityId);

		return { success: true, data: newPipeline };
	} catch (error) {
		logger.error("[Pipeline] Error initializing pipeline:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to initialize pipeline" };
	}
}

/**
 * Get pipeline by opportunity ID.
 */
export async function getPipeline(opportunityId: string): Promise<ActionResult<CapturePipeline | null>> {
	try {
		const [pipeline] = await db
			.select()
			.from(capturePipeline)
			.where(eq(capturePipeline.opportunityId, opportunityId))
			.limit(1);

		return { success: true, data: pipeline ?? null };
	} catch (error) {
		logger.error("[Pipeline] Error fetching pipeline:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to fetch pipeline" };
	}
}

/**
 * List all pipelines with their related opportunities.
 */
export async function listPipelines(): Promise<ActionResult<{
	pipelines: CapturePipeline[];
	opportunities: Map<string, { title: string; organization: string; budgetNumeric: number | null; deadline: Date | null }>;
}>> {
	try {
		const pipelinesWithOpps = await db
			.select({
				pipeline: capturePipeline,
				opportunity: opportunities,
			})
			.from(capturePipeline)
			.innerJoin(opportunities, eq(capturePipeline.opportunityId, opportunities.id))
			.orderBy(desc(capturePipeline.updatedAt));

		const pipelines = pipelinesWithOpps.map(p => p.pipeline);
		const opportunitiesMap = new Map<string, { title: string; organization: string; budgetNumeric: number | null; deadline: Date | null }>();

		for (const { pipeline, opportunity } of pipelinesWithOpps) {
			opportunitiesMap.set(pipeline.id, {
				title: opportunity.title,
				organization: opportunity.organization ?? "",
				budgetNumeric: opportunity.budgetNumeric,
				deadline: opportunity.deadline,
			});
		}

		return { success: true, data: { pipelines, opportunities: opportunitiesMap } };
	} catch (error) {
		logger.error("[Pipeline] Error listing pipelines:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to list pipelines" };
	}
}

/**
 * Update pipeline stage with history tracking.
 */
export async function updatePipelineStage(
	pipelineId: string,
	newStage: string,
	notes?: string
): Promise<ActionResult<CapturePipeline>> {
	try {
		// Validate stage is valid
		if (!PIPELINE_STAGES.includes(newStage as typeof PIPELINE_STAGES[number])) {
			return { success: false, error: `Invalid stage: ${newStage}` };
		}

		// Get current pipeline
		const [currentPipeline] = await db
			.select()
			.from(capturePipeline)
			.where(eq(capturePipeline.id, pipelineId))
			.limit(1);

		if (!currentPipeline) {
			return { success: false, error: "Pipeline not found" };
		}

		// Validate transition
		if (!isValidStageTransition(currentPipeline.currentStage, newStage)) {
			return {
				success: false,
				error: `Invalid stage transition from ${currentPipeline.currentStage} to ${newStage}`,
			};
		}

		const now = new Date();
		const stageHistory = currentPipeline.stageHistory ?? [];

		// Update the last stage entry with exit time and days
		if (stageHistory.length > 0) {
			const lastEntry = stageHistory[stageHistory.length - 1];
			lastEntry.exitedAt = now.toISOString();
			lastEntry.daysInStage = daysBetween(new Date(lastEntry.enteredAt), now);
		}

		// Add new stage entry
		stageHistory.push({
			stage: newStage,
			enteredAt: now.toISOString(),
		});

		// Update pipeline
		const [updated] = await db
			.update(capturePipeline)
			.set({
				currentStage: newStage,
				stageEnteredAt: now,
				stageHistory,
				notes: notes ? `${currentPipeline.notes ?? ""}\n\n[${now.toISOString()}] Stage changed to ${newStage}: ${notes}` : currentPipeline.notes,
				updatedAt: now,
			})
			.where(eq(capturePipeline.id, pipelineId))
			.returning();

		revalidatePipelinePaths(currentPipeline.opportunityId ?? undefined);

		return { success: true, data: updated };
	} catch (error) {
		logger.error("[Pipeline] Error updating pipeline stage:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to update pipeline stage" };
	}
}

/**
 * Update pipeline fields.
 */
export async function updatePipeline(
	pipelineId: string,
	data: Partial<UpdatePipelineInput>
): Promise<ActionResult<CapturePipeline>> {
	try {
		// Validate input
		const parsed = updatePipelineSchema.partial().safeParse(data);
		if (!parsed.success) {
			return { success: false, error: `Validation error: ${parsed.error.message}` };
		}

		// Get current pipeline for opportunityId
		const [currentPipeline] = await db
			.select()
			.from(capturePipeline)
			.where(eq(capturePipeline.id, pipelineId))
			.limit(1);

		if (!currentPipeline) {
			return { success: false, error: "Pipeline not found" };
		}

		// Calculate total investment if capture or proposal investment changed
		let totalInvestment = currentPipeline.totalInvestment ?? 0;
		if (data.captureInvestment !== undefined || data.proposalInvestment !== undefined) {
			const captureInv = data.captureInvestment ?? currentPipeline.captureInvestment ?? 0;
			const proposalInv = data.proposalInvestment ?? currentPipeline.proposalInvestment ?? 0;
			totalInvestment = captureInv + proposalInv;
		}

		const updateData = {
			...parsed.data,
			totalInvestment,
			updatedAt: new Date(),
		};

		const [updated] = await db
			.update(capturePipeline)
			.set(updateData)
			.where(eq(capturePipeline.id, pipelineId))
			.returning();

		revalidatePipelinePaths(currentPipeline.opportunityId ?? undefined);

		return { success: true, data: updated };
	} catch (error) {
		logger.error("[Pipeline] Error updating pipeline:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to update pipeline" };
	}
}

// ============================================================================
// PWIN MANAGEMENT
// ============================================================================

/**
 * Update PWin (Probability of Win) with history tracking.
 */
export async function updatePwin(
	pipelineId: string,
	newPwin: number,
	reason: string,
	updatedBy?: string
): Promise<ActionResult<CapturePipeline>> {
	try {
		// Validate pwin
		if (newPwin < 0 || newPwin > 100) {
			return { success: false, error: "PWin must be between 0 and 100" };
		}

		// Get current pipeline
		const [currentPipeline] = await db
			.select()
			.from(capturePipeline)
			.where(eq(capturePipeline.id, pipelineId))
			.limit(1);

		if (!currentPipeline) {
			return { success: false, error: "Pipeline not found" };
		}

		const now = new Date();
		const pwinHistory = currentPipeline.pwinHistory ?? [];

		// Add new pwin entry
		pwinHistory.push({
			date: now.toISOString(),
			value: newPwin,
			reason,
			updatedBy,
		});

		// Update pipeline
		const [updated] = await db
			.update(capturePipeline)
			.set({
				pwinCurrent: newPwin,
				pwinHistory,
				updatedAt: now,
			})
			.where(eq(capturePipeline.id, pipelineId))
			.returning();

		revalidatePipelinePaths(currentPipeline.opportunityId ?? undefined);

		return { success: true, data: updated };
	} catch (error) {
		logger.error("[Pipeline] Error updating pwin:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to update pwin" };
	}
}

/**
 * Calculate suggested PWin using AI and multiple factors.
 */
export async function calculateSuggestedPwin(opportunityId: string): Promise<ActionResult<PwinCalculation>> {
	try {
		// Fetch all relevant data
		const [pipeline] = await db
			.select()
			.from(capturePipeline)
			.where(eq(capturePipeline.opportunityId, opportunityId))
			.limit(1);

		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(eq(opportunities.id, opportunityId))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		// Fetch activities count
		let activityCount = 0;
		if (pipeline) {
			const [activityResult] = await db
				.select({ count: count() })
				.from(captureActivities)
				.where(
					and(
						eq(captureActivities.pipelineId, pipeline.id),
						eq(captureActivities.status, "completed")
					)
				);
			activityCount = activityResult?.count ?? 0;
		}

		// Fetch partners
		const partnerResults = await db
			.select()
			.from(opportunityPartners)
			.where(eq(opportunityPartners.opportunityId, opportunityId));

		// Define scoring factors
		const factors: PwinCalculation["factors"] = [];

		// Factor 1: Customer Relationship (0-30 points)
		const relationshipScore = pipeline?.customerRelationshipScore ?? 5;
		const relationshipPoints = relationshipScore * 3;
		factors.push({
			factor: "Customer Relationship",
			impact: relationshipScore >= 7 ? "positive" : relationshipScore <= 3 ? "negative" : "neutral",
			weight: 0.25,
			score: relationshipPoints,
			rationale: `Customer relationship score of ${relationshipScore}/10. ${
				relationshipScore >= 7
					? "Strong existing relationship increases win probability."
					: relationshipScore <= 3
						? "Limited relationship requires significant capture effort."
						: "Moderate relationship with room for improvement."
			}`,
		});

		// Factor 2: Incumbent Status (0-20 points)
		const incumbentStatus = pipeline?.incumbentStatus ?? "challenger";
		const incumbentPoints = incumbentStatus === "incumbent" ? 20 : incumbentStatus === "challenger" ? 10 : 5;
		factors.push({
			factor: "Incumbent Status",
			impact: incumbentStatus === "incumbent" ? "positive" : incumbentStatus === "new_market" ? "negative" : "neutral",
			weight: 0.15,
			score: incumbentPoints,
			rationale: `${
				incumbentStatus === "incumbent"
					? "Incumbent advantage provides significant edge."
					: incumbentStatus === "challenger"
						? "Competing against incumbent requires strong discriminators."
						: "New market entry requires establishing credibility."
			}`,
		});

		// Factor 3: Solution Readiness (0-20 points)
		const solutionStatus = pipeline?.solutionReadiness ?? "not_started";
		const solutionPoints = solutionStatus === "ready" ? 20 : solutionStatus === "in_progress" ? 12 : 5;
		factors.push({
			factor: "Solution Readiness",
			impact: solutionStatus === "ready" ? "positive" : solutionStatus === "not_started" ? "negative" : "neutral",
			weight: 0.20,
			score: solutionPoints,
			rationale: `Solution is ${solutionStatus.replace("_", " ")}. ${
				solutionStatus === "ready"
					? "Ready to propose with proven approach."
					: solutionStatus === "in_progress"
						? "Solution development ongoing, needs completion."
						: "Significant solution development required."
			}`,
		});

		// Factor 4: Teaming (0-15 points)
		const teamingStatus = pipeline?.teamingStatus ?? "none_needed";
		const hasPartners = partnerResults.length > 0;
		const teamingPoints = teamingStatus === "complete" ? 15 : teamingStatus === "in_progress" ? 8 : hasPartners ? 10 : 5;
		factors.push({
			factor: "Teaming Arrangement",
			impact: teamingStatus === "complete" ? "positive" : teamingStatus === "in_progress" ? "neutral" : "negative",
			weight: 0.10,
			score: teamingPoints,
			rationale: `Teaming is ${teamingStatus.replace("_", " ")}. ${hasPartners ? `${partnerResults.length} partner(s) engaged.` : "No partners identified."}`,
		});

		// Factor 5: Capture Activity (0-15 points)
		const activityPoints = Math.min(15, activityCount * 3);
		factors.push({
			factor: "Capture Activity",
			impact: activityCount >= 5 ? "positive" : activityCount <= 1 ? "negative" : "neutral",
			weight: 0.15,
			score: activityPoints,
			rationale: `${activityCount} capture activities completed. ${
				activityCount >= 5
					? "Strong engagement demonstrates commitment."
					: activityCount <= 1
						? "Limited activity may indicate lack of preparation."
						: "Moderate activity level."
			}`,
		});

		// Factor 6: Fit Score (from opportunity analysis)
		const fitScore = opportunity.fitScore ?? 50;
		const fitPoints = Math.round(fitScore / 100 * 15);
		factors.push({
			factor: "Opportunity Fit",
			impact: fitScore >= 70 ? "positive" : fitScore <= 40 ? "negative" : "neutral",
			weight: 0.15,
			score: fitPoints,
			rationale: `AI fit score of ${fitScore}/100. ${
				fitScore >= 70
					? "Highly aligned with capabilities."
					: fitScore <= 40
						? "Limited alignment with core competencies."
						: "Moderate alignment requires careful positioning."
			}`,
		});

		// Calculate weighted total
		const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
		const maxPossible = 100; // Maximum theoretical score
		const rawScore = factors.reduce((sum, f) => sum + f.score, 0);
		const suggestedPwin = Math.round((rawScore / maxPossible) * 100);

		// Use AI for additional insight if available
		let confidence = 0.7; // Default confidence
		try {
			const manager = getProviderManager();
			const isAvailable = await manager.isAvailable();

			if (isAvailable) {
				const aiPrompt = `Analyze this opportunity and provide a confidence level (0.5-0.95) for the PWin calculation:

Opportunity: ${opportunity.title}
Organization: ${opportunity.organization}
Calculated PWin: ${suggestedPwin}%

Factors considered:
${factors.map(f => `- ${f.factor}: ${f.score} points (${f.impact}) - ${f.rationale}`).join("\n")}

Respond with ONLY a JSON object: {"confidence": 0.XX, "note": "brief note"}`;

				const response = await manager.complete({
					messages: [
						{ role: "system", content: "You are a capture management expert analyzing bid probability." },
						{ role: "user", content: aiPrompt },
					],
					temperature: 0.3,
					maxTokens: 150,
				});

				try {
					const parsed = JSON.parse(response.content);
					confidence = Math.min(0.95, Math.max(0.5, parsed.confidence));
				} catch {
					// Use default confidence if parsing fails
				}
			}
		} catch (aiError) {
			logger.warn("[Pipeline] AI enhancement not available for pwin calculation:", aiError);
		}

		return {
			success: true,
			data: {
				suggestedPwin: Math.min(100, Math.max(0, suggestedPwin)),
				factors,
				confidence,
			},
		};
	} catch (error) {
		logger.error("[Pipeline] Error calculating suggested pwin:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to calculate pwin" };
	}
}

// ============================================================================
// ACTIVITIES
// ============================================================================

/**
 * Record a new capture activity.
 */
export async function recordActivity(
	pipelineId: string,
	activity: CreateActivityInput
): Promise<ActionResult<CaptureActivity>> {
	try {
		// Validate input
		const parsed = createActivitySchema.safeParse(activity);
		if (!parsed.success) {
			return { success: false, error: `Validation error: ${parsed.error.message}` };
		}

		// Verify pipeline exists
		const [pipeline] = await db
			.select()
			.from(capturePipeline)
			.where(eq(capturePipeline.id, pipelineId))
			.limit(1);

		if (!pipeline) {
			return { success: false, error: "Pipeline not found" };
		}

		const [newActivity] = await db
			.insert(captureActivities)
			.values({
				pipelineId,
				...parsed.data,
				status: parsed.data.scheduledDate && parsed.data.scheduledDate > new Date() ? "scheduled" : "completed",
				completedDate: (!parsed.data.scheduledDate || parsed.data.scheduledDate <= new Date()) ? new Date() : undefined,
			} satisfies NewCaptureActivity)
			.returning();

		// Update customer engagement count if this is a customer-facing activity
		const customerFacingTypes = ["customer_meeting", "site_visit", "call", "email"];
		if (customerFacingTypes.includes(activity.activityType)) {
			await db
				.update(capturePipeline)
				.set({
					customerEngagements: (pipeline.customerEngagements ?? 0) + 1,
					lastCustomerContact: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(capturePipeline.id, pipelineId));
		}

		revalidatePipelinePaths(pipeline.opportunityId ?? undefined);

		return { success: true, data: newActivity };
	} catch (error) {
		logger.error("[Pipeline] Error recording activity:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to record activity" };
	}
}

/**
 * Update an existing activity.
 */
export async function updateActivity(
	activityId: string,
	data: Partial<CreateActivityInput>
): Promise<ActionResult<CaptureActivity>> {
	try {
		const parsed = createActivitySchema.partial().safeParse(data);
		if (!parsed.success) {
			return { success: false, error: `Validation error: ${parsed.error.message}` };
		}

		const [updated] = await db
			.update(captureActivities)
			.set({
				...parsed.data,
				updatedAt: new Date(),
			})
			.where(eq(captureActivities.id, activityId))
			.returning();

		if (!updated) {
			return { success: false, error: "Activity not found" };
		}

		return { success: true, data: updated };
	} catch (error) {
		logger.error("[Pipeline] Error updating activity:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to update activity" };
	}
}

/**
 * Complete an activity with outcome and next steps.
 */
export async function completeActivity(
	activityId: string,
	outcome: string,
	successRating?: number,
	nextSteps?: string[]
): Promise<ActionResult<CaptureActivity>> {
	try {
		if (successRating !== undefined && (successRating < 1 || successRating > 5)) {
			return { success: false, error: "Success rating must be between 1 and 5" };
		}

		const [updated] = await db
			.update(captureActivities)
			.set({
				status: "completed",
				completedDate: new Date(),
				outcome,
				successRating,
				nextSteps,
				updatedAt: new Date(),
			})
			.where(eq(captureActivities.id, activityId))
			.returning();

		if (!updated) {
			return { success: false, error: "Activity not found" };
		}

		return { success: true, data: updated };
	} catch (error) {
		logger.error("[Pipeline] Error completing activity:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to complete activity" };
	}
}

/**
 * List activities for a pipeline with optional filters.
 */
export async function listActivities(
	pipelineId: string,
	filters?: ActivityFilters
): Promise<ActionResult<CaptureActivity[]>> {
	try {
		const conditions = [eq(captureActivities.pipelineId, pipelineId)];

		if (filters?.status) {
			conditions.push(eq(captureActivities.status, filters.status));
		}

		if (filters?.activityType) {
			conditions.push(eq(captureActivities.activityType, filters.activityType));
		}

		if (filters?.fromDate) {
			conditions.push(gte(captureActivities.scheduledDate, filters.fromDate));
		}

		if (filters?.toDate) {
			conditions.push(lte(captureActivities.scheduledDate, filters.toDate));
		}

		const activities = await db
			.select()
			.from(captureActivities)
			.where(and(...conditions))
			.orderBy(desc(captureActivities.scheduledDate));

		return { success: true, data: activities };
	} catch (error) {
		logger.error("[Pipeline] Error listing activities:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to list activities" };
	}
}

/**
 * Get upcoming activities across all pipelines or for a specific pipeline.
 */
export async function getUpcomingActivities(
	pipelineId?: string,
	days: number = 30
): Promise<ActionResult<CaptureActivity[]>> {
	try {
		const now = new Date();
		const futureDate = new Date();
		futureDate.setDate(futureDate.getDate() + days);

		const conditions = [
			eq(captureActivities.status, "scheduled"),
			gte(captureActivities.scheduledDate, now),
			lte(captureActivities.scheduledDate, futureDate),
		];

		if (pipelineId) {
			conditions.push(eq(captureActivities.pipelineId, pipelineId));
		}

		const activities = await db
			.select()
			.from(captureActivities)
			.where(and(...conditions))
			.orderBy(asc(captureActivities.scheduledDate));

		return { success: true, data: activities };
	} catch (error) {
		logger.error("[Pipeline] Error fetching upcoming activities:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to fetch upcoming activities" };
	}
}

// ============================================================================
// GATE REVIEWS
// ============================================================================

/**
 * Schedule a new gate review.
 */
export async function scheduleGateReview(
	pipelineId: string,
	gateType: string,
	scheduledDate: Date,
	reviewers?: string[]
): Promise<ActionResult<GateReview>> {
	try {
		// Verify pipeline exists
		const [pipeline] = await db
			.select()
			.from(capturePipeline)
			.where(eq(capturePipeline.id, pipelineId))
			.limit(1);

		if (!pipeline) {
			return { success: false, error: "Pipeline not found" };
		}

		// Get existing gate reviews to determine gate number
		const existingGates = await db
			.select()
			.from(gateReviews)
			.where(eq(gateReviews.pipelineId, pipelineId))
			.orderBy(desc(gateReviews.gateNumber));

		const nextGateNumber = (existingGates[0]?.gateNumber ?? 0) + 1;

		// Get default checklist for this gate type
		const checklistResult = await getGateReviewChecklist(gateType);
		const checklistItems = checklistResult.success
			? checklistResult.data.map((item) => ({
					item: item.item,
					required: item.required,
					completed: false,
				}))
			: [];

		// Format reviewers
		const reviewerList = reviewers?.map((name) => ({
			name,
			role: "reviewer",
		}));

		const [newReview] = await db
			.insert(gateReviews)
			.values({
				pipelineId,
				gateType,
				gateName: `${gateType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} Review`,
				gateNumber: nextGateNumber,
				scheduledDate,
				status: "scheduled",
				checklistItems,
				reviewers: reviewerList,
			} satisfies NewGateReview)
			.returning();

		revalidatePipelinePaths(pipeline.opportunityId ?? undefined);

		return { success: true, data: newReview };
	} catch (error) {
		logger.error("[Pipeline] Error scheduling gate review:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to schedule gate review" };
	}
}

/**
 * Update gate review details.
 */
export async function updateGateReview(
	gateReviewId: string,
	data: Partial<UpdateGateReviewInput>
): Promise<ActionResult<GateReview>> {
	try {
		const parsed = updateGateReviewSchema.partial().safeParse(data);
		if (!parsed.success) {
			return { success: false, error: `Validation error: ${parsed.error.message}` };
		}

		const [updated] = await db
			.update(gateReviews)
			.set({
				...parsed.data,
				updatedAt: new Date(),
			})
			.where(eq(gateReviews.id, gateReviewId))
			.returning();

		if (!updated) {
			return { success: false, error: "Gate review not found" };
		}

		return { success: true, data: updated };
	} catch (error) {
		logger.error("[Pipeline] Error updating gate review:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to update gate review" };
	}
}

/**
 * Conduct a gate review with decision.
 */
export async function conductGateReview(
	gateReviewId: string,
	decision: GateDecision
): Promise<ActionResult<GateReview>> {
	try {
		// Get the gate review
		const [review] = await db
			.select()
			.from(gateReviews)
			.where(eq(gateReviews.id, gateReviewId))
			.limit(1);

		if (!review) {
			return { success: false, error: "Gate review not found" };
		}

		const gateError = validateGateReviewDecision(review, decision);
		if (gateError) {
			return { success: false, error: gateError };
		}

		const now = new Date();

		// Format conditions with status
		const formattedConditions = decision.conditions?.map((c) => ({
			...c,
			status: "pending" as const,
		}));

		// Format reviewer votes
		const reviewerVotes = decision.reviewerVotes?.map((v) => ({
			name: v.name,
			role: "reviewer",
			vote: v.vote as "approve" | "conditional" | "reject",
			comments: v.comments,
		})) ?? review.reviewers ?? undefined;

		// Update the gate review
		const [updated] = await db
			.update(gateReviews)
			.set({
				status: "completed",
				conductedDate: now,
				decision: decision.decision,
				conditions: formattedConditions,
				rationale: decision.rationale,
				technicalScore: decision.scores?.technical,
				managementScore: decision.scores?.management,
				costScore: decision.scores?.cost,
				overallScore: decision.scores?.overall,
				reviewers: reviewerVotes,
				updatedAt: now,
			})
			.where(eq(gateReviews.id, gateReviewId))
			.returning();

		// If this is a bid/no-bid gate and decision is fail, update pipeline stage
		if (review.gateType === "bid_no_bid" && decision.decision === "fail") {
			await db
				.update(capturePipeline)
				.set({
					currentStage: "no_bid",
					bidDecision: "no_bid",
					bidDecisionDate: now,
					bidDecisionRationale: decision.rationale,
					updatedAt: now,
				})
				.where(eq(capturePipeline.id, review.pipelineId!));
		}

		// Create action items from conditions if conditional pass
		if (decision.decision === "conditional_pass" && decision.conditions?.length) {
			const actionItems = decision.conditions.map((c) => ({
				item: c.condition,
				assignee: c.assignee ?? "Unassigned",
				dueDate: c.dueDate ?? now.toISOString(),
				status: "pending" as const,
			}));

			await db
				.update(gateReviews)
				.set({ actionItems })
				.where(eq(gateReviews.id, gateReviewId));
		}

		try {
			const runtimeInstance = await recordWorkflowRuntimeTransition({
				workflowKey: "capture_gate_review",
				subjectType: "gate_review",
				subjectId: gateReviewId,
				fromState: review.status ?? "scheduled",
				toState: decision.decision,
				eventType: `gate_${decision.decision}`,
				actorId: review.chairperson ?? review.createdBy ?? "system",
				actorName: review.chairperson ?? review.createdBy ?? "System",
				reason: decision.rationale,
				priority: decision.decision === "fail" ? "critical" : decision.decision === "conditional_pass" ? "high" : "medium",
				assignedTo: decision.decision === "conditional_pass" ? review.chairperson ?? null : null,
				assignedRole: "capture_manager",
				dueAt: decision.decision === "conditional_pass" ? earliestConditionDueDate(decision.conditions) : null,
				visibility: "internal",
				authorityPolicy: {
					requiredRoles: ["executive", "capture_manager"],
					minApprovers: getGateQuorum(review.reviewers),
					escalationRole: "executive",
				},
				metadata: {
					pipelineId: review.pipelineId,
					gateType: review.gateType,
					reviewerVotes,
					conditions: formattedConditions ?? [],
				},
				terminal: decision.decision === "pass" || decision.decision === "fail" || decision.decision === "defer",
				notificationRecipients: collectGateNotificationRecipients(review, decision),
			});

			if (decision.decision === "conditional_pass" && decision.conditions?.length) {
				for (const [index, condition] of decision.conditions.entries()) {
					await upsertWorkflowRuntimeTask({
						workflowInstanceId: runtimeInstance.id,
						taskKey: `gate-condition:${gateReviewId}:${index}`,
						title: condition.condition,
						description: `Condition for ${review.gateName ?? review.gateType}`,
						state: "open",
						priority: "high",
						assignedTo: condition.assignee ?? review.chairperson ?? null,
						assignedRole: "capture_manager",
						dueAt: condition.dueDate ?? null,
						metadata: { gateReviewId, pipelineId: review.pipelineId, gateType: review.gateType },
					});
				}
			}
		} catch (error) {
			logger.warn("[Pipeline] Workflow runtime persistence failed:", error);
		}

		return { success: true, data: updated };
	} catch (error) {
		logger.error("[Pipeline] Error conducting gate review:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to conduct gate review" };
	}
}

function earliestConditionDueDate(conditions?: Array<{ dueDate?: string }>): Date | null {
	const dates = (conditions ?? [])
		.map((condition) => condition.dueDate ? new Date(condition.dueDate) : null)
		.filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()))
		.sort((a, b) => a.getTime() - b.getTime());
	return dates[0] ?? null;
}

function collectGateNotificationRecipients(
	review: GateReview,
	decision: GateDecision
): string[] {
	const recipients = new Set<string>();
	if (review.chairperson) recipients.add(review.chairperson);
	for (const condition of decision.conditions ?? []) {
		if (condition.assignee) recipients.add(condition.assignee);
	}
	return [...recipients];
}

/**
 * Get standard checklist items for a gate type.
 */
export async function getGateReviewChecklist(gateType: string): Promise<ActionResult<ChecklistItem[]>> {
	// Define standard checklists for common gate types
	const checklists: Record<string, ChecklistItem[]> = {
		pursuit: [
			{ item: "Opportunity aligns with strategic goals", required: true, description: "Verify opportunity fits business strategy" },
			{ item: "Initial customer relationship assessment complete", required: true },
			{ item: "Preliminary competitive analysis complete", required: false },
			{ item: "Resources available for capture", required: true },
			{ item: "Initial solution concept identified", required: false },
		],
		bid_no_bid: [
			{ item: "Customer requirements clearly understood", required: true },
			{ item: "Technical approach defined", required: true },
			{ item: "Cost estimate prepared", required: true },
			{ item: "Competitive assessment complete", required: true },
			{ item: "Win probability assessed (PWin)", required: true },
			{ item: "Required resources identified", required: true },
			{ item: "Teaming partners confirmed (if needed)", required: false },
			{ item: "Risk assessment complete", required: true },
			{ item: "Past performance identified", required: true },
			{ item: "Key personnel availability confirmed", required: false },
		],
		capture_ready: [
			{ item: "Solution architecture complete", required: true },
			{ item: "Technical team assigned", required: true },
			{ item: "Management approach defined", required: true },
			{ item: "Cost model developed", required: true },
			{ item: "Teaming agreements executed", required: false },
			{ item: "Win themes developed", required: true },
			{ item: "Discriminators identified", required: true },
			{ item: "Ghost competition addressed", required: false },
		],
		proposal_ready: [
			{ item: "Proposal outline approved", required: true },
			{ item: "Section assignments complete", required: true },
			{ item: "Kick-off meeting held", required: true },
			{ item: "Schedule baselined", required: true },
			{ item: "Templates prepared", required: true },
			{ item: "Compliance matrix drafted", required: true },
		],
		color_review: [
			{ item: "All sections submitted for review", required: true },
			{ item: "Compliance matrix updated", required: true },
			{ item: "Page count within limits", required: true },
			{ item: "Graphics complete", required: false },
			{ item: "Pricing volume ready", required: false },
			{ item: "Review materials distributed", required: true },
		],
		final_review: [
			{ item: "All review comments addressed", required: true },
			{ item: "Executive summary finalized", required: true },
			{ item: "Pricing final and approved", required: true },
			{ item: "All volumes complete", required: true },
			{ item: "Compliance verified", required: true },
			{ item: "Submission package prepared", required: true },
			{ item: "Backup submission method ready", required: false },
		],
	};

	const checklist = checklists[gateType] ?? [
		{ item: "Review objectives defined", required: true },
		{ item: "Materials prepared", required: true },
		{ item: "Reviewers assigned", required: true },
	];

	return { success: true, data: checklist };
}

/**
 * List gate reviews for a pipeline.
 */
export async function listGateReviews(pipelineId: string): Promise<ActionResult<GateReview[]>> {
	try {
		const reviews = await db
			.select()
			.from(gateReviews)
			.where(eq(gateReviews.pipelineId, pipelineId))
			.orderBy(asc(gateReviews.gateNumber));

		return { success: true, data: reviews };
	} catch (error) {
		logger.error("[Pipeline] Error listing gate reviews:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to list gate reviews" };
	}
}

// ============================================================================
// BID DECISION
// ============================================================================

/**
 * Generate a comprehensive bid decision package using AI.
 */
export async function generateBidDecisionPackage(pipelineId: string): Promise<ActionResult<BidDecisionPackage>> {
	try {
		// Fetch pipeline
		const [pipeline] = await db
			.select()
			.from(capturePipeline)
			.where(eq(capturePipeline.id, pipelineId))
			.limit(1);

		if (!pipeline) {
			return { success: false, error: "Pipeline not found" };
		}

		// Fetch opportunity
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(eq(opportunities.id, pipeline.opportunityId!))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		// Fetch activities
		const activities = await db
			.select()
			.from(captureActivities)
			.where(eq(captureActivities.pipelineId, pipelineId));

		// Calculate pwin factors
		const pwinResult = await calculateSuggestedPwin(pipeline.opportunityId!);
		const pwinFactors = pwinResult.success ? pwinResult.data.factors : [];
		const pwin = pwinResult.success ? pwinResult.data.suggestedPwin : pipeline.pwinCurrent ?? 50;

		// Compile pros and cons from factors
		const pros: string[] = [];
		const cons: string[] = [];

		for (const factor of pwinFactors) {
			if (factor.impact === "positive") {
				pros.push(`${factor.factor}: ${factor.rationale}`);
			} else if (factor.impact === "negative") {
				cons.push(`${factor.factor}: ${factor.rationale}`);
			}
		}

		// Calculate investment
		const investmentToDate = pipeline.totalInvestment ?? 0;
		const estimatedProposalCost = pipeline.proposalInvestment ?? (opportunity.budgetNumeric ?? 0) * 0.02; // 2% of contract value as estimate

		// Generate executive summary using AI
		let executiveSummary = "";
		let competitivePosition = "";
		let recommendation: "bid" | "no_bid" | "conditional" = "conditional";
		let conditions: string[] = [];

		try {
			const manager = getProviderManager();
			const isAvailable = await manager.isAvailable();

			if (isAvailable) {
				const aiPrompt = `Generate a bid decision package analysis for this opportunity:

Opportunity: ${opportunity.title}
Organization: ${opportunity.organization}
Contract Value: ${opportunity.budgetValue ?? "Unknown"}
PWin: ${pwin}%
Total Investment to Date: $${investmentToDate.toLocaleString()}

Pros:
${pros.map((p) => `- ${p}`).join("\n")}

Cons:
${cons.map((c) => `- ${c}`).join("\n")}

Activities Completed: ${activities.filter((a) => a.status === "completed").length}
Customer Engagement Score: ${pipeline.customerRelationshipScore ?? "Not assessed"}/10
Incumbent Status: ${pipeline.incumbentStatus ?? "Unknown"}
Solution Readiness: ${pipeline.solutionReadiness ?? "Not assessed"}

Respond with a JSON object:
{
  "executiveSummary": "2-3 sentence executive summary",
  "competitivePosition": "Brief assessment of competitive position",
  "recommendation": "bid" | "no_bid" | "conditional",
  "conditions": ["condition 1", "condition 2"] // Only if conditional
}`;

				const response = await manager.complete({
					messages: [
						{ role: "system", content: "You are a capture management expert analyzing bid decisions. Be concise and actionable." },
						{ role: "user", content: aiPrompt },
					],
					temperature: 0.4,
					maxTokens: 500,
				});

				try {
					const parsed = JSON.parse(response.content);
					executiveSummary = parsed.executiveSummary ?? "";
					competitivePosition = parsed.competitivePosition ?? "";
					recommendation = parsed.recommendation ?? "conditional";
					conditions = parsed.conditions ?? [];
				} catch {
					// Generate fallback summary
					executiveSummary = `Opportunity with ${opportunity.organization} valued at ${opportunity.budgetValue ?? "unknown amount"}. Current PWin assessment is ${pwin}%.`;
					competitivePosition = pipeline.incumbentStatus === "incumbent" ? "Strong position as incumbent" : "Challenger position requiring differentiation";
					recommendation = pwin >= 60 ? "bid" : pwin >= 40 ? "conditional" : "no_bid";
				}
			} else {
				// Generate summary without AI
				executiveSummary = `Opportunity with ${opportunity.organization} valued at ${opportunity.budgetValue ?? "unknown amount"}. Current PWin assessment is ${pwin}%.`;
				competitivePosition = pipeline.incumbentStatus === "incumbent" ? "Strong position as incumbent" : "Challenger position requiring differentiation";
				recommendation = pwin >= 60 ? "bid" : pwin >= 40 ? "conditional" : "no_bid";
			}
		} catch (aiError) {
			logger.warn("[Pipeline] AI not available for bid decision package:", aiError);
			executiveSummary = `Opportunity with ${opportunity.organization}. Current PWin assessment is ${pwin}%.`;
			competitivePosition = "Assessment pending";
			recommendation = pwin >= 60 ? "bid" : pwin >= 40 ? "conditional" : "no_bid";
		}

		const bidPackage: BidDecisionPackage = {
			opportunityName: opportunity.title,
			contractValue: opportunity.budgetNumeric ?? 0,
			pwin,
			pwinFactors,
			executiveSummary,
			pros,
			cons,
			competitivePosition,
			investmentToDate,
			estimatedProposalCost,
			recommendation,
			conditions: conditions.length > 0 ? conditions : undefined,
		};

		return { success: true, data: bidPackage };
	} catch (error) {
		logger.error("[Pipeline] Error generating bid decision package:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to generate bid decision package" };
	}
}

/**
 * Record the final bid decision.
 */
export async function recordBidDecision(
	pipelineId: string,
	decision: "bid" | "no_bid",
	rationale: string,
	madeBy: string
): Promise<ActionResult<CapturePipeline>> {
	try {
		const [pipeline] = await db
			.select()
			.from(capturePipeline)
			.where(eq(capturePipeline.id, pipelineId))
			.limit(1);

		if (!pipeline) {
			return { success: false, error: "Pipeline not found" };
		}

		const now = new Date();
		const updateData: Partial<typeof capturePipeline.$inferSelect> = {
			bidDecision: decision,
			bidDecisionDate: now,
			bidDecisionRationale: rationale,
			bidDecisionMadeBy: madeBy,
			updatedAt: now,
		};

		// If no_bid, move to no_bid stage
		if (decision === "no_bid") {
			const stageHistory = pipeline.stageHistory ?? [];
			if (stageHistory.length > 0) {
				const lastEntry = stageHistory[stageHistory.length - 1];
				lastEntry.exitedAt = now.toISOString();
				lastEntry.daysInStage = daysBetween(new Date(lastEntry.enteredAt), now);
			}
			stageHistory.push({
				stage: "no_bid",
				enteredAt: now.toISOString(),
			});

			updateData.currentStage = "no_bid";
			updateData.stageEnteredAt = now;
			updateData.stageHistory = stageHistory;
		}

		const [updated] = await db
			.update(capturePipeline)
			.set(updateData)
			.where(eq(capturePipeline.id, pipelineId))
			.returning();

		revalidatePipelinePaths(pipeline.opportunityId ?? undefined);

		return { success: true, data: updated };
	} catch (error) {
		logger.error("[Pipeline] Error recording bid decision:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to record bid decision" };
	}
}

// ============================================================================
// MILESTONES
// ============================================================================

/**
 * Create a new milestone.
 */
export async function createMilestone(
	pipelineId: string,
	milestone: CreateMilestoneInput
): Promise<ActionResult<PipelineMilestone>> {
	try {
		const parsed = createMilestoneSchema.safeParse(milestone);
		if (!parsed.success) {
			return { success: false, error: `Validation error: ${parsed.error.message}` };
		}

		// Verify pipeline exists
		const [pipeline] = await db
			.select()
			.from(capturePipeline)
			.where(eq(capturePipeline.id, pipelineId))
			.limit(1);

		if (!pipeline) {
			return { success: false, error: "Pipeline not found" };
		}

		const [newMilestone] = await db
			.insert(pipelineMilestones)
			.values({
				pipelineId,
				...parsed.data,
				status: "pending",
			} satisfies NewPipelineMilestone)
			.returning();

		revalidatePipelinePaths(pipeline.opportunityId ?? undefined);

		return { success: true, data: newMilestone };
	} catch (error) {
		logger.error("[Pipeline] Error creating milestone:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to create milestone" };
	}
}

/**
 * Update a milestone.
 */
export async function updateMilestone(
	milestoneId: string,
	data: Partial<CreateMilestoneInput>
): Promise<ActionResult<PipelineMilestone>> {
	try {
		const parsed = createMilestoneSchema.partial().safeParse(data);
		if (!parsed.success) {
			return { success: false, error: `Validation error: ${parsed.error.message}` };
		}

		const [updated] = await db
			.update(pipelineMilestones)
			.set(parsed.data)
			.where(eq(pipelineMilestones.id, milestoneId))
			.returning();

		if (!updated) {
			return { success: false, error: "Milestone not found" };
		}

		return { success: true, data: updated };
	} catch (error) {
		logger.error("[Pipeline] Error updating milestone:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to update milestone" };
	}
}

/**
 * Complete a milestone.
 */
export async function completeMilestone(
	milestoneId: string,
	actualDate?: Date
): Promise<ActionResult<PipelineMilestone>> {
	try {
		const [updated] = await db
			.update(pipelineMilestones)
			.set({
				status: "completed",
				actualDate: actualDate ?? new Date(),
			})
			.where(eq(pipelineMilestones.id, milestoneId))
			.returning();

		if (!updated) {
			return { success: false, error: "Milestone not found" };
		}

		return { success: true, data: updated };
	} catch (error) {
		logger.error("[Pipeline] Error completing milestone:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to complete milestone" };
	}
}

/**
 * List milestones for a pipeline.
 */
export async function listMilestones(pipelineId: string): Promise<ActionResult<PipelineMilestone[]>> {
	try {
		const milestones = await db
			.select()
			.from(pipelineMilestones)
			.where(eq(pipelineMilestones.pipelineId, pipelineId))
			.orderBy(asc(pipelineMilestones.targetDate));

		return { success: true, data: milestones };
	} catch (error) {
		logger.error("[Pipeline] Error listing milestones:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to list milestones" };
	}
}

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get comprehensive pipeline analytics.
 */
export async function getPipelineAnalytics(organizationId?: string): Promise<ActionResult<PipelineAnalytics>> {
	try {
		// Get all pipelines with their opportunities
		const pipelinesWithOpps = await db
			.select({
				pipeline: capturePipeline,
				opportunity: opportunities,
			})
			.from(capturePipeline)
			.innerJoin(opportunities, eq(capturePipeline.opportunityId, opportunities.id));

		// Aggregate by stage
		const byStage: PipelineAnalytics["byStage"] = [];
		const stageGroups = new Map<string, { count: number; totalValue: number; pwinSum: number }>();

		for (const { pipeline, opportunity } of pipelinesWithOpps) {
			const stage = pipeline.currentStage;
			const existing = stageGroups.get(stage) ?? { count: 0, totalValue: 0, pwinSum: 0 };
			existing.count++;
			existing.totalValue += opportunity.budgetNumeric ?? 0;
			existing.pwinSum += pipeline.pwinCurrent ?? 0;
			stageGroups.set(stage, existing);
		}

		for (const [stage, data] of stageGroups) {
			byStage.push({
				stage,
				count: data.count,
				totalValue: data.totalValue,
				avgPwin: data.count > 0 ? Math.round(data.pwinSum / data.count) : 0,
			});
		}

		// Calculate totals
		const totalOpportunities = pipelinesWithOpps.length;
		const totalPipelineValue = pipelinesWithOpps.reduce(
			(sum, { opportunity }) => sum + (opportunity.budgetNumeric ?? 0),
			0
		);
		const weightedPipelineValue = pipelinesWithOpps.reduce(
			(sum, { pipeline, opportunity }) => sum + (opportunity.budgetNumeric ?? 0) * ((pipeline.pwinCurrent ?? 0) / 100),
			0
		);

		// Calculate conversion rates between stages
		const conversionRates: PipelineAnalytics["conversionRates"] = [];
		const stageOrder = ["discovery", "qualification", "capture", "proposal", "submitted", "evaluation", "awarded"];

		for (let i = 0; i < stageOrder.length - 1; i++) {
			const fromStage = stageOrder[i];
			const toStage = stageOrder[i + 1];

			// Count pipelines that passed through each stage
			let fromCount = 0;
			let toCount = 0;

			for (const { pipeline } of pipelinesWithOpps) {
				const history = pipeline.stageHistory ?? [];
				const passedFrom = history.some((h) => h.stage === fromStage);
				const passedTo = history.some((h) => h.stage === toStage);

				if (passedFrom) fromCount++;
				if (passedTo) toCount++;
			}

			conversionRates.push({
				from: fromStage,
				to: toStage,
				rate: fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0,
			});
		}

		// Calculate average time in stage
		const averageTimeInStage: PipelineAnalytics["averageTimeInStage"] = [];
		const stageDays = new Map<string, { total: number; count: number }>();

		for (const { pipeline } of pipelinesWithOpps) {
			const history = pipeline.stageHistory ?? [];
			for (const entry of history) {
				if (entry.daysInStage !== undefined) {
					const existing = stageDays.get(entry.stage) ?? { total: 0, count: 0 };
					existing.total += entry.daysInStage;
					existing.count++;
					stageDays.set(entry.stage, existing);
				}
			}
		}

		for (const [stage, data] of stageDays) {
			averageTimeInStage.push({
				stage,
				avgDays: data.count > 0 ? Math.round(data.total / data.count) : 0,
			});
		}

		return {
			success: true,
			data: {
				byStage,
				totalOpportunities,
				totalPipelineValue,
				weightedPipelineValue: Math.round(weightedPipelineValue),
				conversionRates,
				averageTimeInStage,
			},
		};
	} catch (error) {
		logger.error("[Pipeline] Error getting pipeline analytics:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to get pipeline analytics" };
	}
}

/**
 * Forecast pipeline outcomes.
 */
export async function forecastPipeline(organizationId?: string): Promise<ActionResult<PipelineForecast>> {
	try {
		// Get pipelines with opportunities that have award dates
		const pipelinesWithOpps = await db
			.select({
				pipeline: capturePipeline,
				opportunity: opportunities,
			})
			.from(capturePipeline)
			.innerJoin(opportunities, eq(capturePipeline.opportunityId, opportunities.id))
			.where(
				inArray(capturePipeline.currentStage, ["capture", "proposal", "submitted", "evaluation"])
			);

		// Group by quarter
		const quarterData = new Map<string, {
			pipelineValue: number;
			weightedValue: number;
			count: number;
		}>();

		for (const { pipeline, opportunity } of pipelinesWithOpps) {
			const awardDate = pipeline.anticipatedAwardDate ?? opportunity.deadline;
			if (!awardDate) continue;

			const quarter = getQuarterString(awardDate);
			const existing = quarterData.get(quarter) ?? { pipelineValue: 0, weightedValue: 0, count: 0 };
			const value = opportunity.budgetNumeric ?? 0;
			const pwin = pipeline.pwinCurrent ?? 50;

			existing.pipelineValue += value;
			existing.weightedValue += value * (pwin / 100);
			existing.count++;
			quarterData.set(quarter, existing);
		}

		// Format quarters
		const quarters: PipelineForecast["quarters"] = [];
		let totalForecastedValue = 0;

		const sortedQuarters = Array.from(quarterData.entries()).sort((a, b) => {
			// Sort by quarter (Q1 2024 < Q2 2024 < Q1 2025)
			const [qA, yearA] = a[0].split(" ");
			const [qB, yearB] = b[0].split(" ");
			return parseInt(yearA) - parseInt(yearB) || parseInt(qA[1]) - parseInt(qB[1]);
		});

		for (const [quarter, data] of sortedQuarters) {
			// Estimate expected wins based on weighted value
			const avgValue = data.count > 0 ? data.pipelineValue / data.count : 0;
			const expectedWins = avgValue > 0 ? Math.round(data.weightedValue / avgValue) : 0;
			const confidence = data.count >= 5 ? 0.8 : data.count >= 3 ? 0.6 : 0.4;

			quarters.push({
				quarter,
				expectedWins,
				expectedValue: Math.round(data.weightedValue),
				pipelineValue: Math.round(data.pipelineValue),
				confidence,
			});

			totalForecastedValue += data.weightedValue;
		}

		// Calculate confidence interval (simple approach: +/- 20%)
		const confidenceInterval = {
			low: Math.round(totalForecastedValue * 0.8),
			high: Math.round(totalForecastedValue * 1.2),
		};

		return {
			success: true,
			data: {
				quarters,
				totalForecastedValue: Math.round(totalForecastedValue),
				confidenceInterval,
			},
		};
	} catch (error) {
		logger.error("[Pipeline] Error forecasting pipeline:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to forecast pipeline" };
	}
}

/**
 * Identify opportunities at risk.
 */
export async function identifyAtRiskOpportunities(): Promise<ActionResult<AtRiskOpportunity[]>> {
	try {
		const now = new Date();
		const twoWeeksAgo = new Date(now);
		twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

		// Get all active pipelines
		const pipelinesWithOpps = await db
			.select({
				pipeline: capturePipeline,
				opportunity: opportunities,
			})
			.from(capturePipeline)
			.innerJoin(opportunities, eq(capturePipeline.opportunityId, opportunities.id))
			.where(
				inArray(capturePipeline.currentStage, ["discovery", "qualification", "capture", "proposal", "submitted", "evaluation"])
			);

		const atRisk: AtRiskOpportunity[] = [];

		for (const { pipeline, opportunity } of pipelinesWithOpps) {
			const riskFactors: string[] = [];
			const recommendations: string[] = [];

			// Check for declining pwin
			const pwinHistory = pipeline.pwinHistory ?? [];
			if (pwinHistory.length >= 2) {
				const latest = pwinHistory[pwinHistory.length - 1];
				const previous = pwinHistory[pwinHistory.length - 2];
				if (latest.value < previous.value - 10) {
					riskFactors.push(`PWin declined from ${previous.value}% to ${latest.value}%`);
					recommendations.push("Review and address factors causing PWin decline");
				}
			}

			// Check for missed milestones
			const milestones = await db
				.select()
				.from(pipelineMilestones)
				.where(
					and(
						eq(pipelineMilestones.pipelineId, pipeline.id),
						eq(pipelineMilestones.status, "pending"),
						lte(pipelineMilestones.targetDate, now)
					)
				);

			if (milestones.length > 0) {
				riskFactors.push(`${milestones.length} missed milestone(s)`);
				recommendations.push("Review and update milestone dates or complete overdue milestones");
			}

			// Check for stale activity
			const [lastActivity] = await db
				.select()
				.from(captureActivities)
				.where(eq(captureActivities.pipelineId, pipeline.id))
				.orderBy(desc(captureActivities.completedDate))
				.limit(1);

			if (!lastActivity || (lastActivity.completedDate && lastActivity.completedDate < twoWeeksAgo)) {
				riskFactors.push("No capture activity in the last 2 weeks");
				recommendations.push("Schedule customer engagement or capture activity");
			}

			// Check for approaching deadline without required gates
			if (opportunity.deadline) {
				const daysToDeadline = daysBetween(now, opportunity.deadline);

				if (daysToDeadline <= 30 && daysToDeadline > 0) {
					// Check for bid decision
					if (!pipeline.bidDecision) {
						riskFactors.push(`Deadline in ${daysToDeadline} days without bid decision`);
						recommendations.push("Conduct bid/no-bid review immediately");
					}

					// Check for proposal ready gate
					const gateResults = await db
						.select()
						.from(gateReviews)
						.where(
							and(
								eq(gateReviews.pipelineId, pipeline.id),
								eq(gateReviews.gateType, "proposal_ready"),
								eq(gateReviews.status, "completed")
							)
						);

					if (gateResults.length === 0 && pipeline.currentStage === "proposal") {
						riskFactors.push("Proposal phase without proposal ready review");
						recommendations.push("Schedule proposal ready gate review");
					}
				}
			}

			// Check health status
			if (pipeline.healthStatus === "critical") {
				riskFactors.push("Pipeline marked as critical");
			} else if (pipeline.healthStatus === "at_risk") {
				riskFactors.push("Pipeline marked as at risk");
			}

			// Only add to at-risk list if there are risk factors
			if (riskFactors.length > 0) {
				const riskLevel: "high" | "medium" | "low" =
					riskFactors.length >= 3 || pipeline.healthStatus === "critical" ? "high" :
					riskFactors.length >= 2 || pipeline.healthStatus === "at_risk" ? "medium" : "low";

				atRisk.push({
					pipelineId: pipeline.id,
					opportunityId: opportunity.id,
					opportunityName: opportunity.title,
					riskLevel,
					riskFactors,
					recommendations,
					pwin: pipeline.pwinCurrent ?? 0,
					contractValue: opportunity.budgetNumeric ?? 0,
				});
			}
		}

		// Sort by risk level (high first) then by contract value
		atRisk.sort((a, b) => {
			const levelOrder = { high: 0, medium: 1, low: 2 };
			const levelDiff = levelOrder[a.riskLevel] - levelOrder[b.riskLevel];
			if (levelDiff !== 0) return levelDiff;
			return b.contractValue - a.contractValue;
		});

		return { success: true, data: atRisk };
	} catch (error) {
		logger.error("[Pipeline] Error identifying at-risk opportunities:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to identify at-risk opportunities" };
	}
}

/**
 * Get comprehensive pipeline summary.
 */
export async function getPipelineSummary(pipelineId: string): Promise<ActionResult<PipelineSummary>> {
	try {
		// Fetch pipeline
		const [pipeline] = await db
			.select()
			.from(capturePipeline)
			.where(eq(capturePipeline.id, pipelineId))
			.limit(1);

		if (!pipeline) {
			return { success: false, error: "Pipeline not found" };
		}

		// Fetch recent activities
		const recentActivities = await db
			.select()
			.from(captureActivities)
			.where(eq(captureActivities.pipelineId, pipelineId))
			.orderBy(desc(captureActivities.createdAt))
			.limit(5);

		// Fetch upcoming gates
		const upcomingGates = await db
			.select()
			.from(gateReviews)
			.where(
				and(
					eq(gateReviews.pipelineId, pipelineId),
					eq(gateReviews.status, "scheduled")
				)
			)
			.orderBy(asc(gateReviews.scheduledDate))
			.limit(3);

		// Fetch milestones
		const allMilestones = await db
			.select()
			.from(pipelineMilestones)
			.where(eq(pipelineMilestones.pipelineId, pipelineId));

		const now = new Date();
		const milestoneStatus = {
			total: allMilestones.length,
			completed: allMilestones.filter((m) => m.status === "completed").length,
			upcoming: allMilestones.filter((m) => m.status === "pending" && m.targetDate && m.targetDate > now).length,
			missed: allMilestones.filter((m) => m.status === "pending" && m.targetDate && m.targetDate <= now).length,
		};

		// Calculate days in current stage
		const daysInCurrentStage = pipeline.stageEnteredAt
			? daysBetween(pipeline.stageEnteredAt, now)
			: 0;

		// Build health indicators
		const healthIndicators: PipelineSummary["healthIndicators"] = [];

		// PWin indicator
		const pwin = pipeline.pwinCurrent ?? 0;
		healthIndicators.push({
			indicator: "Win Probability",
			status: pwin >= 60 ? "good" : pwin >= 40 ? "warning" : "critical",
			message: `Current PWin: ${pwin}%`,
		});

		// Activity indicator
		const recentActivityCount = recentActivities.filter(
			(a) => a.completedDate && daysBetween(a.completedDate, now) <= 14
		).length;
		healthIndicators.push({
			indicator: "Activity Level",
			status: recentActivityCount >= 2 ? "good" : recentActivityCount >= 1 ? "warning" : "critical",
			message: `${recentActivityCount} activities in last 2 weeks`,
		});

		// Milestone indicator
		healthIndicators.push({
			indicator: "Milestones",
			status: milestoneStatus.missed === 0 ? "good" : milestoneStatus.missed <= 2 ? "warning" : "critical",
			message: `${milestoneStatus.completed}/${milestoneStatus.total} complete, ${milestoneStatus.missed} missed`,
		});

		// Time in stage indicator (varies by stage)
		const stageTimeLimits: Record<string, number> = {
			discovery: 30,
			qualification: 21,
			capture: 45,
			proposal: 30,
			submitted: 60,
			evaluation: 90,
		};
		const timeLimit = stageTimeLimits[pipeline.currentStage] ?? 30;
		healthIndicators.push({
			indicator: "Stage Duration",
			status: daysInCurrentStage <= timeLimit * 0.7 ? "good" : daysInCurrentStage <= timeLimit ? "warning" : "critical",
			message: `${daysInCurrentStage} days in ${pipeline.currentStage} stage`,
		});

		// Generate next actions
		const nextActions: string[] = [];

		if (milestoneStatus.missed > 0) {
			nextActions.push("Address overdue milestones");
		}

		if (!pipeline.bidDecision && ["capture", "proposal"].includes(pipeline.currentStage)) {
			nextActions.push("Schedule bid/no-bid decision review");
		}

		if (recentActivityCount === 0) {
			nextActions.push("Plan and execute customer engagement");
		}

		if (upcomingGates.length === 0 && pipeline.currentStage === "proposal") {
			nextActions.push("Schedule color team review");
		}

		if (pwin < 50) {
			nextActions.push("Develop win strategies to improve probability");
		}

		return {
			success: true,
			data: {
				pipeline,
				recentActivities,
				upcomingGates,
				milestoneStatus,
				healthIndicators,
				daysInCurrentStage,
				nextActions,
			},
		};
	} catch (error) {
		logger.error("[Pipeline] Error getting pipeline summary:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to get pipeline summary" };
	}
}
