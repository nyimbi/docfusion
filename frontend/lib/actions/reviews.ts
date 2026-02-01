/**
 * Review Management Server Actions - DocFusion
 *
 * Implements comprehensive review management for the Formal Review Process
 * (Pink/Red/Gold Team methodology) in government proposal development.
 *
 * Features:
 * - Review lifecycle management (create, schedule, start, complete)
 * - Reviewer assignment with conflict of interest checking
 * - Comment management with severity and resolution tracking
 * - Score aggregation with confidence weighting
 * - Review effectiveness tracking and analytics
 * - Export capabilities for review packages
 */

"use server";

import { z } from "zod";

// ============================================================================
// INPUT VALIDATION SCHEMAS
// ============================================================================

const CreateReviewInputSchema = z.object({
	opportunityId: z.string().uuid(),
	reviewType: z.enum(["pink", "red", "gold", "compliance", "final"]),
	reviewName: z.string().min(1).max(200).optional(),
	description: z.string().optional(),
	scheduledDate: z.string().datetime().optional(),
	scheduledEndDate: z.string().datetime().optional(),
	documentVersionId: z.string().uuid().optional(),
	scopeType: z.enum(["full", "partial", "section"]).default("full"),
	scopedSections: z.array(z.string()).optional(),
	scopedVolumes: z.array(z.string()).optional(),
	reviewInstructions: z.string().optional(),
	focusAreas: z.array(z.string()).optional(),
	evaluationCriteriaIds: z.array(z.string()).optional(),
	templateId: z.string().uuid().optional(),
});

const UpdateReviewInputSchema = z.object({
	reviewName: z.string().min(1).max(200).optional(),
	description: z.string().optional(),
	scheduledDate: z.string().datetime().optional(),
	scheduledEndDate: z.string().datetime().optional(),
	status: z.enum(["draft", "scheduled", "in_progress", "completed", "cancelled"]).optional(),
	documentVersionId: z.string().uuid().optional(),
	scopeType: z.enum(["full", "partial", "section"]).optional(),
	scopedSections: z.array(z.string()).optional(),
	scopedVolumes: z.array(z.string()).optional(),
	reviewInstructions: z.string().optional(),
	focusAreas: z.array(z.string()).optional(),
	executiveSummary: z.string().optional(),
	recommendation: z.enum([
		"ready_to_submit",
		"needs_minor_revisions",
		"needs_major_revisions",
		"not_ready",
		"recommend_no_bid",
	]).optional(),
	keyFindings: z.object({
		strengths: z.array(z.string()),
		weaknesses: z.array(z.string()),
		criticalIssues: z.array(z.string()),
		recommendations: z.array(z.string()),
	}).optional(),
});

const ReviewerAssignmentSchema = z.object({
	userId: z.string().min(1),
	userName: z.string().optional(),
	userEmail: z.string().email().optional(),
	role: z.enum([
		"lead",
		"technical",
		"cost",
		"compliance",
		"general",
		"subject_matter_expert",
		"capture_manager",
	]).optional(),
	expertise: z.array(z.string()).optional(),
	assignedSections: z.array(z.string()).optional(),
	assignedVolumes: z.array(z.string()).optional(),
	assignedCriteria: z.array(z.string()).optional(),
	reviewerInstructions: z.string().optional(),
	expectedCompletionDate: z.string().datetime().optional(),
});

const CommentInputSchema = z.object({
	sectionId: z.string().uuid().optional(),
	volumeId: z.string().uuid().optional(),
	pageNumber: z.number().int().positive().optional(),
	lineNumber: z.number().int().positive().optional(),
	paragraphNumber: z.number().int().positive().optional(),
	selectedText: z.string().optional(),
	textRange: z.object({
		start: z.number(),
		end: z.number(),
	}).optional(),
	commentType: z.enum([
		"strength",
		"weakness",
		"suggestion",
		"question",
		"critical",
		"compliment",
		"compliance_gap",
		"theme_opportunity",
	]),
	severity: z.enum(["critical", "major", "minor", "editorial"]).optional(),
	category: z.string().optional(),
	subcategory: z.string().optional(),
	title: z.string().max(300).optional(),
	comment: z.string().min(1),
	suggestedChange: z.string().optional(),
	rationale: z.string().optional(),
	evaluationCriteriaId: z.string().uuid().optional(),
	evaluationCriteriaRef: z.string().optional(),
	impactOnScore: z.enum(["high", "medium", "low"]).optional(),
	relatedWinThemeId: z.string().uuid().optional(),
	themeAlignment: z.enum(["supports", "conflicts", "neutral"]).optional(),
	tags: z.array(z.string()).optional(),
	parentCommentId: z.string().uuid().optional(),
	isAnonymous: z.boolean().default(true),
	attachments: z.array(z.object({
		name: z.string(),
		url: z.string().url(),
		type: z.string(),
	})).optional(),
});

const ResolutionInputSchema = z.object({
	resolutionStatus: z.enum([
		"open",
		"in_progress",
		"resolved",
		"wont_fix",
		"deferred",
		"duplicate",
	]),
	resolutionNotes: z.string().optional(),
	resolutionAction: z.enum(["revised", "clarified", "removed", "kept"]).optional(),
	duplicateOfId: z.string().uuid().optional(),
});

const ScoreInputSchema = z.object({
	evaluationCriteriaId: z.string().uuid().optional(),
	evaluationCriteriaRef: z.string().optional(),
	evaluationCriteriaName: z.string().optional(),
	sectionId: z.string().uuid().optional(),
	volumeId: z.string().uuid().optional(),
	sectionName: z.string().optional(),
	score: z.number().min(0),
	maxScore: z.number().positive(),
	weight: z.number().positive().default(1),
	ratingCategory: z.enum([
		"outstanding",
		"good",
		"acceptable",
		"marginal",
		"unacceptable",
	]).optional(),
	confidence: z.number().min(0).max(1).optional(),
	confidenceReason: z.string().optional(),
	rationale: z.string().optional(),
	strengths: z.array(z.string()).optional(),
	weaknesses: z.array(z.string()).optional(),
	improvements: z.array(z.string()).optional(),
	supportingCommentIds: z.array(z.string()).optional(),
});

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type CreateReviewInput = z.infer<typeof CreateReviewInputSchema>;
export type UpdateReviewInput = z.infer<typeof UpdateReviewInputSchema>;
export type ReviewerAssignment = z.infer<typeof ReviewerAssignmentSchema>;
export type CommentInput = z.infer<typeof CommentInputSchema>;
export type ResolutionInput = z.infer<typeof ResolutionInputSchema>;
export type ScoreInput = z.infer<typeof ScoreInputSchema>;

export interface AggregatedScores {
	reviewId: string;
	overallScore: number;
	maxPossibleScore: number;
	normalizedScore: number;
	confidence: number;
	byCategory: {
		category: string;
		averageScore: number;
		maxScore: number;
		weight: number;
		weightedScore: number;
		reviewerCount: number;
		variance: number;
	}[];
	byReviewer: {
		reviewerId: string;
		reviewerName: string;
		totalScore: number;
		maxScore: number;
		criteriaScored: number;
		averageConfidence: number;
	}[];
	byCriteria: {
		criteriaId: string;
		criteriaName: string;
		averageScore: number;
		maxScore: number;
		scores: number[];
		standardDeviation: number;
		minScore: number;
		maxScoreGiven: number;
	}[];
	ratingDistribution: Record<string, number>;
	consensusLevel: number; // 0-1 scale indicating agreement among reviewers
}

export interface ReviewReport {
	review: {
		id: string;
		reviewType: string;
		reviewName: string;
		scheduledDate: string;
		completedAt: string | null;
		status: string;
	};
	statistics: {
		totalComments: number;
		commentsByType: Record<string, number>;
		commentsBySeverity: Record<string, number>;
		resolvedCount: number;
		openCount: number;
		resolutionRate: number;
	};
	scores: AggregatedScores;
	reviewers: {
		id: string;
		name: string;
		role: string;
		status: string;
		commentsCount: number;
		scoresCount: number;
		completedAt: string | null;
	}[];
	keyFindings: {
		strengths: string[];
		weaknesses: string[];
		criticalIssues: string[];
		recommendations: string[];
	};
	complianceGaps: {
		criteriaRef: string;
		criteriaName: string;
		gapDescription: string;
		severity: string;
		suggestedResolution: string;
	}[];
	themeAnalysis: {
		themeId: string;
		themeName: string;
		supportingComments: number;
		conflictingComments: number;
		themeStrength: number;
	}[];
	recommendation: string;
	executiveSummary: string;
	generatedAt: string;
}

export interface BeforeAfterComparison {
	reviewId: string;
	previousReviewId: string | null;
	previousReviewType: string | null;
	overallScoreChange: number | null;
	categoryChanges: {
		category: string;
		previousScore: number | null;
		currentScore: number;
		change: number | null;
		percentChange: number | null;
	}[];
	commentResolution: {
		previousTotal: number;
		resolvedSincePrevious: number;
		newComments: number;
		stillOpen: number;
		resolutionRate: number;
	};
	issueChanges: {
		severity: string;
		previousCount: number;
		currentCount: number;
		change: number;
	}[];
	strengthsGained: string[];
	weaknessesAddressed: string[];
	newConcerns: string[];
	improvementAreas: string[];
}

export interface EffectivenessMetrics {
	timeframe: {
		start: string;
		end: string;
	};
	reviewsConducted: number;
	averageResolutionRate: number;
	averageScoreImprovement: number;
	reviewTypeEffectiveness: {
		reviewType: string;
		averageScoreImpact: number;
		averageIssuesFound: number;
		averageResolutionRate: number;
		reviewCount: number;
	}[];
	reviewerEffectiveness: {
		reviewerId: string;
		reviewerName: string;
		reviewsParticipated: number;
		averageCommentsPerReview: number;
		criticalIssuesIdentified: number;
		averageScoreAccuracy: number; // How close their scores are to consensus
	}[];
	commonIssueCategories: {
		category: string;
		occurrences: number;
		resolutionRate: number;
	}[];
	winRateCorrelation: {
		reviewScore: string; // "ready_to_submit", etc.
		winRate: number;
		proposalCount: number;
	}[];
}

export interface ConflictCheckResult {
	reviewerId: string;
	userId: string;
	hasConflict: boolean;
	conflictReasons: {
		type: string;
		description: string;
		severity: "high" | "medium" | "low";
	}[];
	recommendations: string[];
}

// ============================================================================
// REVIEW MANAGEMENT ACTIONS
// ============================================================================

/**
 * Create a new review session for a proposal
 */
export async function createReview(
	input: CreateReviewInput
): Promise<{ success: boolean; reviewId?: string; error?: string }> {
	try {
		const validated = CreateReviewInputSchema.parse(input);

		// Generate review name if not provided
		const reviewName = validated.reviewName ||
			`${validated.reviewType.charAt(0).toUpperCase() + validated.reviewType.slice(1)} Team Review`;

		// TODO: Insert into database
		// const [review] = await db.insert(proposalReviews).values({
		//   ...validated,
		//   reviewName,
		//   status: validated.scheduledDate ? "scheduled" : "draft",
		// }).returning();

		// For now, return mock success
		const mockReviewId = crypto.randomUUID();

		return {
			success: true,
			reviewId: mockReviewId,
		};
	} catch (error) {
		console.error("Failed to create review:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to create review",
		};
	}
}

/**
 * Update an existing review
 */
export async function updateReview(
	id: string,
	data: UpdateReviewInput
): Promise<{ success: boolean; error?: string }> {
	try {
		const validated = UpdateReviewInputSchema.parse(data);

		// Update timestamps based on status changes
		const updates: Record<string, unknown> = {
			...validated,
			updatedAt: new Date(),
		};

		if (validated.status === "in_progress" && !updates.startedAt) {
			updates.startedAt = new Date();
		}
		if (validated.status === "completed" && !updates.completedAt) {
			updates.completedAt = new Date();
		}

		// TODO: Update in database
		// await db.update(proposalReviews)
		//   .set(updates)
		//   .where(eq(proposalReviews.id, id));

		return { success: true };
	} catch (error) {
		console.error("Failed to update review:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to update review",
		};
	}
}

/**
 * Delete a review (only if in draft status)
 */
export async function deleteReview(
	id: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// TODO: Check status and delete
		// const review = await db.query.proposalReviews.findFirst({
		//   where: eq(proposalReviews.id, id),
		// });
		// if (review?.status !== "draft") {
		//   return { success: false, error: "Can only delete draft reviews" };
		// }
		// await db.delete(proposalReviews).where(eq(proposalReviews.id, id));

		return { success: true };
	} catch (error) {
		console.error("Failed to delete review:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to delete review",
		};
	}
}

/**
 * List all reviews for an opportunity
 */
export async function listReviews(
	opportunityId: string
): Promise<{
	success: boolean;
	reviews?: {
		id: string;
		reviewType: string;
		reviewName: string;
		status: string;
		scheduledDate: string | null;
		completedAt: string | null;
		totalComments: number;
		criticalIssues: number;
		resolvedIssues: number;
		overallScore: number | null;
		recommendation: string | null;
		reviewerCount: number;
	}[];
	error?: string;
}> {
	try {
		// TODO: Query database
		// const reviews = await db.query.proposalReviews.findMany({
		//   where: eq(proposalReviews.opportunityId, opportunityId),
		//   with: { reviewers: true },
		//   orderBy: [desc(proposalReviews.createdAt)],
		// });

		// Mock data
		const reviews = [
			{
				id: crypto.randomUUID(),
				reviewType: "pink",
				reviewName: "Pink Team Review",
				status: "completed",
				scheduledDate: "2024-01-15T09:00:00Z",
				completedAt: "2024-01-17T17:00:00Z",
				totalComments: 45,
				criticalIssues: 3,
				resolvedIssues: 42,
				overallScore: 72.5,
				recommendation: "needs_minor_revisions",
				reviewerCount: 4,
			},
			{
				id: crypto.randomUUID(),
				reviewType: "red",
				reviewName: "Red Team Review",
				status: "scheduled",
				scheduledDate: "2024-01-25T09:00:00Z",
				completedAt: null,
				totalComments: 0,
				criticalIssues: 0,
				resolvedIssues: 0,
				overallScore: null,
				recommendation: null,
				reviewerCount: 5,
			},
		];

		return { success: true, reviews };
	} catch (error) {
		console.error("Failed to list reviews:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to list reviews",
		};
	}
}

/**
 * Get a single review with full details
 */
export async function getReview(id: string): Promise<{
	success: boolean;
	review?: {
		id: string;
		opportunityId: string;
		reviewType: string;
		reviewName: string;
		description: string | null;
		status: string;
		scheduledDate: string | null;
		scheduledEndDate: string | null;
		startedAt: string | null;
		completedAt: string | null;
		documentVersionId: string | null;
		scopeType: string;
		scopedSections: string[] | null;
		reviewInstructions: string | null;
		focusAreas: string[] | null;
		overallScore: number | null;
		recommendation: string | null;
		executiveSummary: string | null;
		keyFindings: {
			strengths: string[];
			weaknesses: string[];
			criticalIssues: string[];
			recommendations: string[];
		} | null;
		statistics: {
			totalComments: number;
			criticalIssues: number;
			majorIssues: number;
			minorIssues: number;
			editorialIssues: number;
			resolvedIssues: number;
			strengthsIdentified: number;
		};
		reviewers: {
			id: string;
			userId: string;
			userName: string | null;
			role: string | null;
			status: string;
			assignedSections: string[] | null;
			commentsSubmitted: number;
			scoresSubmitted: number;
		}[];
	};
	error?: string;
}> {
	try {
		// TODO: Query database with relations
		// const review = await db.query.proposalReviews.findFirst({
		//   where: eq(proposalReviews.id, id),
		//   with: { reviewers: true, comments: true, scores: true },
		// });

		// Mock data
		const review = {
			id,
			opportunityId: crypto.randomUUID(),
			reviewType: "red",
			reviewName: "Red Team Review",
			description: "Full proposal review simulating government evaluation",
			status: "in_progress",
			scheduledDate: "2024-01-25T09:00:00Z",
			scheduledEndDate: "2024-01-27T17:00:00Z",
			startedAt: "2024-01-25T09:15:00Z",
			completedAt: null,
			documentVersionId: crypto.randomUUID(),
			scopeType: "full",
			scopedSections: null,
			reviewInstructions: "Review against all Section M criteria. Focus on technical approach and past performance.",
			focusAreas: ["technical_approach", "past_performance", "management"],
			overallScore: null,
			recommendation: null,
			executiveSummary: null,
			keyFindings: null,
			statistics: {
				totalComments: 28,
				criticalIssues: 2,
				majorIssues: 8,
				minorIssues: 12,
				editorialIssues: 6,
				resolvedIssues: 5,
				strengthsIdentified: 15,
			},
			reviewers: [
				{
					id: crypto.randomUUID(),
					userId: "user-1",
					userName: "Sarah Johnson",
					role: "lead",
					status: "in_progress",
					assignedSections: null,
					commentsSubmitted: 12,
					scoresSubmitted: 5,
				},
				{
					id: crypto.randomUUID(),
					userId: "user-2",
					userName: "Michael Chen",
					role: "technical",
					status: "in_progress",
					assignedSections: ["technical-volume"],
					commentsSubmitted: 10,
					scoresSubmitted: 3,
				},
			],
		};

		return { success: true, review };
	} catch (error) {
		console.error("Failed to get review:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to get review",
		};
	}
}

// ============================================================================
// REVIEWER MANAGEMENT ACTIONS
// ============================================================================

/**
 * Assign reviewers to a review session
 */
export async function assignReviewers(
	reviewId: string,
	reviewers: ReviewerAssignment[]
): Promise<{ success: boolean; assignedCount?: number; error?: string }> {
	try {
		const validatedReviewers = reviewers.map(r =>
			ReviewerAssignmentSchema.parse(r)
		);

		// TODO: Insert reviewers into database
		// const insertedReviewers = await db.insert(reviewers).values(
		//   validatedReviewers.map(r => ({
		//     reviewId,
		//     ...r,
		//     status: "pending",
		//   }))
		// ).returning();

		return {
			success: true,
			assignedCount: validatedReviewers.length,
		};
	} catch (error) {
		console.error("Failed to assign reviewers:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to assign reviewers",
		};
	}
}

/**
 * Update a reviewer's status or assignment
 */
export async function updateReviewer(
	reviewerId: string,
	data: Partial<ReviewerAssignment> & {
		status?: "pending" | "accepted" | "declined" | "in_progress" | "completed";
		declinedReason?: string;
	}
): Promise<{ success: boolean; error?: string }> {
	try {
		const updates: Record<string, unknown> = {
			...data,
			updatedAt: new Date(),
		};

		if (data.status === "accepted") {
			updates.acceptedAt = new Date();
		}
		if (data.status === "in_progress") {
			updates.startedAt = new Date();
		}
		if (data.status === "completed") {
			updates.completedAt = new Date();
		}

		// TODO: Update in database
		// await db.update(reviewers)
		//   .set(updates)
		//   .where(eq(reviewers.id, reviewerId));

		return { success: true };
	} catch (error) {
		console.error("Failed to update reviewer:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to update reviewer",
		};
	}
}

/**
 * Remove a reviewer from a review
 */
export async function removeReviewer(
	reviewerId: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// TODO: Delete from database
		// await db.delete(reviewers).where(eq(reviewers.id, reviewerId));

		return { success: true };
	} catch (error) {
		console.error("Failed to remove reviewer:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to remove reviewer",
		};
	}
}

/**
 * Check for conflicts of interest for all reviewers in a review
 */
export async function checkConflictsOfInterest(
	reviewId: string
): Promise<{
	success: boolean;
	results?: ConflictCheckResult[];
	error?: string;
}> {
	try {
		// TODO: Implement actual conflict checking logic
		// This would check:
		// - Previous employment with competing bidders
		// - Financial interests in competitors
		// - Personal relationships with proposal team
		// - Prior work on this opportunity
		// - Organizational conflicts

		// Mock results
		const results: ConflictCheckResult[] = [
			{
				reviewerId: crypto.randomUUID(),
				userId: "user-1",
				hasConflict: false,
				conflictReasons: [],
				recommendations: [],
			},
			{
				reviewerId: crypto.randomUUID(),
				userId: "user-2",
				hasConflict: true,
				conflictReasons: [
					{
						type: "prior_employment",
						description: "Previously employed by CompetitorCorp (2019-2021)",
						severity: "medium",
					},
				],
				recommendations: [
					"Recommend limiting reviewer to non-competitive sections",
					"Consider alternative reviewer for cost volume",
				],
			},
		];

		return { success: true, results };
	} catch (error) {
		console.error("Failed to check conflicts of interest:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to check conflicts",
		};
	}
}

/**
 * Send reminder to reviewer
 */
export async function sendReviewerReminder(
	reviewerId: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// TODO: Send email/notification and update reminder tracking
		// await db.update(reviewers)
		//   .set({
		//     lastReminderSentAt: new Date(),
		//     reminderCount: sql`${reviewers.reminderCount} + 1`,
		//   })
		//   .where(eq(reviewers.id, reviewerId));

		return { success: true };
	} catch (error) {
		console.error("Failed to send reminder:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to send reminder",
		};
	}
}

// ============================================================================
// COMMENT MANAGEMENT ACTIONS
// ============================================================================

/**
 * Add a review comment
 */
export async function addReviewComment(
	reviewId: string,
	reviewerId: string,
	comment: CommentInput
): Promise<{ success: boolean; commentId?: string; error?: string }> {
	try {
		const validated = CommentInputSchema.parse(comment);

		// TODO: Insert into database and update statistics
		// const [newComment] = await db.insert(reviewComments).values({
		//   reviewId,
		//   reviewerId,
		//   ...validated,
		// }).returning();
		//
		// // Update review statistics
		// await updateReviewStatistics(reviewId);

		const mockCommentId = crypto.randomUUID();

		return {
			success: true,
			commentId: mockCommentId,
		};
	} catch (error) {
		console.error("Failed to add comment:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to add comment",
		};
	}
}

/**
 * Update a comment
 */
export async function updateComment(
	commentId: string,
	data: Partial<CommentInput>
): Promise<{ success: boolean; error?: string }> {
	try {
		// TODO: Update in database
		// await db.update(reviewComments)
		//   .set({ ...data, updatedAt: new Date() })
		//   .where(eq(reviewComments.id, commentId));

		return { success: true };
	} catch (error) {
		console.error("Failed to update comment:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to update comment",
		};
	}
}

/**
 * Delete a comment
 */
export async function deleteComment(
	commentId: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// TODO: Delete from database
		// await db.delete(reviewComments).where(eq(reviewComments.id, commentId));

		return { success: true };
	} catch (error) {
		console.error("Failed to delete comment:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to delete comment",
		};
	}
}

/**
 * Resolve a comment
 */
export async function resolveComment(
	commentId: string,
	resolution: ResolutionInput,
	resolvedBy: string
): Promise<{ success: boolean; error?: string }> {
	try {
		const validated = ResolutionInputSchema.parse(resolution);

		// TODO: Update in database
		// await db.update(reviewComments)
		//   .set({
		//     ...validated,
		//     resolvedBy,
		//     resolvedAt: validated.resolutionStatus === "resolved" ? new Date() : null,
		//     isDuplicate: validated.resolutionStatus === "duplicate",
		//     updatedAt: new Date(),
		//   })
		//   .where(eq(reviewComments.id, commentId));
		//
		// // Update review statistics
		// const comment = await db.query.reviewComments.findFirst({
		//   where: eq(reviewComments.id, commentId),
		// });
		// if (comment) {
		//   await updateReviewStatistics(comment.reviewId);
		// }

		return { success: true };
	} catch (error) {
		console.error("Failed to resolve comment:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to resolve comment",
		};
	}
}

/**
 * Verify a resolved comment
 */
export async function verifyResolution(
	commentId: string,
	verifiedBy: string,
	verificationNotes?: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// TODO: Update in database
		// await db.update(reviewComments)
		//   .set({
		//     verifiedBy,
		//     verifiedAt: new Date(),
		//     verificationNotes,
		//     updatedAt: new Date(),
		//   })
		//   .where(eq(reviewComments.id, commentId));

		return { success: true };
	} catch (error) {
		console.error("Failed to verify resolution:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to verify resolution",
		};
	}
}

/**
 * Get comments for a review with filtering
 */
export async function getReviewComments(
	reviewId: string,
	filters?: {
		commentType?: string;
		severity?: string;
		category?: string;
		resolutionStatus?: string;
		reviewerId?: string;
		sectionId?: string;
	}
): Promise<{
	success: boolean;
	comments?: {
		id: string;
		reviewerId: string;
		reviewerName: string | null;
		commentType: string;
		severity: string | null;
		category: string | null;
		title: string | null;
		comment: string;
		suggestedChange: string | null;
		selectedText: string | null;
		pageNumber: number | null;
		lineNumber: number | null;
		sectionId: string | null;
		resolutionStatus: string;
		resolvedBy: string | null;
		resolvedAt: string | null;
		tags: string[] | null;
		isAnonymous: boolean;
		replyCount: number;
		createdAt: string;
	}[];
	error?: string;
}> {
	try {
		// TODO: Query database with filters
		// const comments = await db.query.reviewComments.findMany({
		//   where: and(
		//     eq(reviewComments.reviewId, reviewId),
		//     filters?.commentType ? eq(reviewComments.commentType, filters.commentType) : undefined,
		//     filters?.severity ? eq(reviewComments.severity, filters.severity) : undefined,
		//     // ... more filters
		//   ),
		//   with: { reviewer: true },
		//   orderBy: [desc(reviewComments.createdAt)],
		// });

		// Mock data
		const comments = [
			{
				id: crypto.randomUUID(),
				reviewerId: crypto.randomUUID(),
				reviewerName: null, // Anonymous
				commentType: "weakness",
				severity: "major",
				category: "technical",
				title: "Missing implementation timeline",
				comment: "The technical approach lacks a detailed implementation timeline showing key milestones.",
				suggestedChange: "Add Gantt chart or timeline showing implementation phases with milestones.",
				selectedText: "Our implementation approach...",
				pageNumber: 15,
				lineNumber: 234,
				sectionId: crypto.randomUUID(),
				resolutionStatus: "open",
				resolvedBy: null,
				resolvedAt: null,
				tags: ["timeline", "technical"],
				isAnonymous: true,
				replyCount: 2,
				createdAt: new Date().toISOString(),
			},
			{
				id: crypto.randomUUID(),
				reviewerId: crypto.randomUUID(),
				reviewerName: null,
				commentType: "strength",
				severity: null,
				category: "past_performance",
				title: "Strong past performance evidence",
				comment: "Excellent use of quantified results from the ABC project demonstrating relevant experience.",
				suggestedChange: null,
				selectedText: "We achieved 99.9% uptime...",
				pageNumber: 28,
				lineNumber: 456,
				sectionId: crypto.randomUUID(),
				resolutionStatus: "open",
				resolvedBy: null,
				resolvedAt: null,
				tags: ["past_performance", "metrics"],
				isAnonymous: true,
				replyCount: 0,
				createdAt: new Date().toISOString(),
			},
		];

		return { success: true, comments };
	} catch (error) {
		console.error("Failed to get comments:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to get comments",
		};
	}
}

/**
 * Bulk update comment priorities
 */
export async function updateCommentPriorities(
	priorities: { commentId: string; priorityRank: number }[]
): Promise<{ success: boolean; error?: string }> {
	try {
		// TODO: Bulk update in database
		// await db.transaction(async (tx) => {
		//   for (const { commentId, priorityRank } of priorities) {
		//     await tx.update(reviewComments)
		//       .set({ priorityRank, updatedAt: new Date() })
		//       .where(eq(reviewComments.id, commentId));
		//   }
		// });

		return { success: true };
	} catch (error) {
		console.error("Failed to update priorities:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to update priorities",
		};
	}
}

/**
 * Mark comment as duplicate
 */
export async function markCommentDuplicate(
	commentId: string,
	duplicateOfId: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// TODO: Update in database
		// await db.update(reviewComments)
		//   .set({
		//     isDuplicate: true,
		//     duplicateOfId,
		//     resolutionStatus: "duplicate",
		//     updatedAt: new Date(),
		//   })
		//   .where(eq(reviewComments.id, commentId));

		return { success: true };
	} catch (error) {
		console.error("Failed to mark duplicate:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to mark duplicate",
		};
	}
}

// ============================================================================
// SCORING ACTIONS
// ============================================================================

/**
 * Submit scores from a reviewer
 */
export async function submitReviewerScores(
	reviewerId: string,
	scores: ScoreInput[]
): Promise<{ success: boolean; scoresSubmitted?: number; error?: string }> {
	try {
		const validatedScores = scores.map(s => ScoreInputSchema.parse(s));

		// Calculate derived values
		const processedScores = validatedScores.map(score => ({
			...score,
			normalizedScore: (score.score / score.maxScore) * 100,
			weightedScore: score.score * (score.weight || 1),
		}));

		// TODO: Insert into database
		// const insertedScores = await db.insert(reviewScores).values(
		//   processedScores.map(s => ({
		//     reviewerId,
		//     ...s,
		//   }))
		// ).returning();

		return {
			success: true,
			scoresSubmitted: processedScores.length,
		};
	} catch (error) {
		console.error("Failed to submit scores:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to submit scores",
		};
	}
}

/**
 * Update a single score
 */
export async function updateScore(
	scoreId: string,
	data: Partial<ScoreInput>
): Promise<{ success: boolean; error?: string }> {
	try {
		const updates: Record<string, unknown> = {
			...data,
			updatedAt: new Date(),
		};

		// Recalculate derived values if score or maxScore changed
		if (data.score !== undefined || data.maxScore !== undefined) {
			// TODO: Get current values and recalculate
		}

		// TODO: Update in database
		// await db.update(reviewScores)
		//   .set(updates)
		//   .where(eq(reviewScores.id, scoreId));

		return { success: true };
	} catch (error) {
		console.error("Failed to update score:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to update score",
		};
	}
}

/**
 * Aggregate scores for a review
 */
export async function aggregateScores(
	reviewId: string
): Promise<{ success: boolean; aggregation?: AggregatedScores; error?: string }> {
	try {
		// TODO: Query all scores and calculate aggregations
		// const scores = await db.query.reviewScores.findMany({
		//   where: eq(reviewScores.reviewId, reviewId),
		//   with: { reviewer: true },
		// });

		// Mock aggregation
		const aggregation: AggregatedScores = {
			reviewId,
			overallScore: 78.5,
			maxPossibleScore: 100,
			normalizedScore: 78.5,
			confidence: 0.85,
			byCategory: [
				{
					category: "Technical Approach",
					averageScore: 82,
					maxScore: 100,
					weight: 0.4,
					weightedScore: 32.8,
					reviewerCount: 4,
					variance: 5.2,
				},
				{
					category: "Past Performance",
					averageScore: 88,
					maxScore: 100,
					weight: 0.25,
					weightedScore: 22,
					reviewerCount: 4,
					variance: 3.1,
				},
				{
					category: "Management Approach",
					averageScore: 75,
					maxScore: 100,
					weight: 0.2,
					weightedScore: 15,
					reviewerCount: 4,
					variance: 8.4,
				},
				{
					category: "Cost/Price",
					averageScore: 72,
					maxScore: 100,
					weight: 0.15,
					weightedScore: 10.8,
					reviewerCount: 3,
					variance: 6.7,
				},
			],
			byReviewer: [
				{
					reviewerId: crypto.randomUUID(),
					reviewerName: "Reviewer 1",
					totalScore: 320,
					maxScore: 400,
					criteriaScored: 4,
					averageConfidence: 0.9,
				},
				{
					reviewerId: crypto.randomUUID(),
					reviewerName: "Reviewer 2",
					totalScore: 305,
					maxScore: 400,
					criteriaScored: 4,
					averageConfidence: 0.85,
				},
			],
			byCriteria: [
				{
					criteriaId: crypto.randomUUID(),
					criteriaName: "Technical Understanding",
					averageScore: 85,
					maxScore: 100,
					scores: [82, 88, 85, 84],
					standardDeviation: 2.2,
					minScore: 82,
					maxScoreGiven: 88,
				},
			],
			ratingDistribution: {
				outstanding: 2,
				good: 8,
				acceptable: 4,
				marginal: 1,
				unacceptable: 0,
			},
			consensusLevel: 0.82,
		};

		return { success: true, aggregation };
	} catch (error) {
		console.error("Failed to aggregate scores:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to aggregate scores",
		};
	}
}

// ============================================================================
// REPORTING ACTIONS
// ============================================================================

/**
 * Generate comprehensive review report
 */
export async function generateReviewReport(
	reviewId: string
): Promise<{ success: boolean; report?: ReviewReport; error?: string }> {
	try {
		// TODO: Compile all review data into report
		// This would aggregate:
		// - Review metadata
		// - All comments with statistics
		// - All scores with aggregation
		// - Reviewer participation
		// - Key findings
		// - Compliance gaps
		// - Theme analysis

		const report: ReviewReport = {
			review: {
				id: reviewId,
				reviewType: "red",
				reviewName: "Red Team Review",
				scheduledDate: "2024-01-25T09:00:00Z",
				completedAt: "2024-01-27T17:00:00Z",
				status: "completed",
			},
			statistics: {
				totalComments: 68,
				commentsByType: {
					strength: 22,
					weakness: 28,
					suggestion: 12,
					question: 4,
					critical: 2,
				},
				commentsBySeverity: {
					critical: 2,
					major: 15,
					minor: 32,
					editorial: 19,
				},
				resolvedCount: 58,
				openCount: 10,
				resolutionRate: 0.853,
			},
			scores: {
				reviewId,
				overallScore: 78.5,
				maxPossibleScore: 100,
				normalizedScore: 78.5,
				confidence: 0.85,
				byCategory: [],
				byReviewer: [],
				byCriteria: [],
				ratingDistribution: {},
				consensusLevel: 0.82,
			},
			reviewers: [
				{
					id: crypto.randomUUID(),
					name: "Sarah Johnson",
					role: "lead",
					status: "completed",
					commentsCount: 18,
					scoresCount: 12,
					completedAt: "2024-01-27T15:30:00Z",
				},
			],
			keyFindings: {
				strengths: [
					"Strong past performance with quantified results",
					"Well-articulated technical approach",
					"Clear understanding of requirements",
				],
				weaknesses: [
					"Implementation timeline lacks detail",
					"Risk mitigation section needs expansion",
					"Cost assumptions not clearly documented",
				],
				criticalIssues: [
					"Missing response to requirement L.5.2.3",
					"Staffing plan has gaps in key technical roles",
				],
				recommendations: [
					"Add detailed Gantt chart for implementation",
					"Expand risk mitigation section with specific mitigations",
					"Document all cost assumptions in appendix",
				],
			},
			complianceGaps: [
				{
					criteriaRef: "L.5.2.3",
					criteriaName: "Quality Assurance Plan",
					gapDescription: "No dedicated QA plan section found",
					severity: "critical",
					suggestedResolution: "Add QA plan section per RFP requirements",
				},
			],
			themeAnalysis: [
				{
					themeId: crypto.randomUUID(),
					themeName: "Innovation Leadership",
					supportingComments: 8,
					conflictingComments: 2,
					themeStrength: 0.75,
				},
			],
			recommendation: "needs_minor_revisions",
			executiveSummary: "The proposal demonstrates strong technical capability and past performance. Key issues to address include timeline detail and compliance gaps identified in Section L.5.2.3.",
			generatedAt: new Date().toISOString(),
		};

		return { success: true, report };
	} catch (error) {
		console.error("Failed to generate report:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to generate report",
		};
	}
}

/**
 * Compare current review with previous review
 */
export async function compareBeforeAfter(
	reviewId: string
): Promise<{ success: boolean; comparison?: BeforeAfterComparison; error?: string }> {
	try {
		// TODO: Get current and previous review data and compare

		const comparison: BeforeAfterComparison = {
			reviewId,
			previousReviewId: crypto.randomUUID(),
			previousReviewType: "pink",
			overallScoreChange: 12.5,
			categoryChanges: [
				{
					category: "Technical Approach",
					previousScore: 72,
					currentScore: 82,
					change: 10,
					percentChange: 13.9,
				},
				{
					category: "Past Performance",
					previousScore: 85,
					currentScore: 88,
					change: 3,
					percentChange: 3.5,
				},
			],
			commentResolution: {
				previousTotal: 45,
				resolvedSincePrevious: 38,
				newComments: 28,
				stillOpen: 7,
				resolutionRate: 0.844,
			},
			issueChanges: [
				{ severity: "critical", previousCount: 5, currentCount: 2, change: -3 },
				{ severity: "major", previousCount: 18, currentCount: 15, change: -3 },
				{ severity: "minor", previousCount: 22, currentCount: 32, change: 10 },
			],
			strengthsGained: [
				"Improved technical approach clarity",
				"Added quantified past performance metrics",
			],
			weaknessesAddressed: [
				"Added project organization chart",
				"Clarified key personnel roles",
			],
			newConcerns: [
				"Timeline still lacks milestone detail",
				"Cost volume formatting inconsistencies",
			],
			improvementAreas: [
				"Continue improving risk mitigation section",
				"Add more graphics to technical approach",
			],
		};

		return { success: true, comparison };
	} catch (error) {
		console.error("Failed to compare reviews:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to compare reviews",
		};
	}
}

/**
 * Track review process effectiveness across reviews
 */
export async function trackReviewEffectiveness(
	organizationId?: string,
	timeframeDays?: number
): Promise<{ success: boolean; metrics?: EffectivenessMetrics; error?: string }> {
	try {
		const endDate = new Date();
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - (timeframeDays || 90));

		// TODO: Query historical review data and calculate metrics

		const metrics: EffectivenessMetrics = {
			timeframe: {
				start: startDate.toISOString(),
				end: endDate.toISOString(),
			},
			reviewsConducted: 24,
			averageResolutionRate: 0.87,
			averageScoreImprovement: 8.5,
			reviewTypeEffectiveness: [
				{
					reviewType: "pink",
					averageScoreImpact: 5.2,
					averageIssuesFound: 42,
					averageResolutionRate: 0.92,
					reviewCount: 12,
				},
				{
					reviewType: "red",
					averageScoreImpact: 8.7,
					averageIssuesFound: 58,
					averageResolutionRate: 0.85,
					reviewCount: 10,
				},
				{
					reviewType: "gold",
					averageScoreImpact: 3.1,
					averageIssuesFound: 18,
					averageResolutionRate: 0.95,
					reviewCount: 8,
				},
			],
			reviewerEffectiveness: [
				{
					reviewerId: crypto.randomUUID(),
					reviewerName: "Sarah Johnson",
					reviewsParticipated: 8,
					averageCommentsPerReview: 15.2,
					criticalIssuesIdentified: 12,
					averageScoreAccuracy: 0.92,
				},
			],
			commonIssueCategories: [
				{ category: "Technical Approach", occurrences: 145, resolutionRate: 0.88 },
				{ category: "Past Performance", occurrences: 78, resolutionRate: 0.92 },
				{ category: "Management", occurrences: 65, resolutionRate: 0.85 },
			],
			winRateCorrelation: [
				{ reviewScore: "ready_to_submit", winRate: 0.72, proposalCount: 18 },
				{ reviewScore: "needs_minor_revisions", winRate: 0.58, proposalCount: 24 },
				{ reviewScore: "needs_major_revisions", winRate: 0.31, proposalCount: 12 },
			],
		};

		return { success: true, metrics };
	} catch (error) {
		console.error("Failed to track effectiveness:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to track effectiveness",
		};
	}
}

/**
 * Export review package (comments, scores, report) in specified format
 */
export async function exportReviewPackage(
	reviewId: string,
	format: "pdf" | "xlsx" | "docx"
): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
	try {
		// TODO: Generate export in requested format
		// This would:
		// 1. Gather all review data
		// 2. Generate formatted document
		// 3. Upload to storage
		// 4. Return download URL

		// Mock response
		const downloadUrl = `https://storage.example.com/exports/review-${reviewId}.${format}`;

		return { success: true, downloadUrl };
	} catch (error) {
		console.error("Failed to export review package:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to export review package",
		};
	}
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Update review statistics after comment/score changes
 */
async function updateReviewStatistics(reviewId: string): Promise<void> {
	// TODO: Recalculate and update review statistics
	// const comments = await db.query.reviewComments.findMany({
	//   where: eq(reviewComments.reviewId, reviewId),
	// });
	//
	// const stats = {
	//   totalComments: comments.length,
	//   criticalIssues: comments.filter(c => c.severity === "critical").length,
	//   majorIssues: comments.filter(c => c.severity === "major").length,
	//   minorIssues: comments.filter(c => c.severity === "minor").length,
	//   editorialIssues: comments.filter(c => c.severity === "editorial").length,
	//   resolvedIssues: comments.filter(c => c.resolutionStatus === "resolved").length,
	//   strengthsIdentified: comments.filter(c => c.commentType === "strength").length,
	// };
	//
	// await db.update(proposalReviews)
	//   .set({ ...stats, updatedAt: new Date() })
	//   .where(eq(proposalReviews.id, reviewId));
}

/**
 * Complete a review and finalize results
 */
export async function completeReview(
	reviewId: string,
	recommendation: string,
	executiveSummary: string,
	keyFindings: {
		strengths: string[];
		weaknesses: string[];
		criticalIssues: string[];
		recommendations: string[];
	}
): Promise<{ success: boolean; error?: string }> {
	try {
		// Aggregate final scores
		const { aggregation } = await aggregateScores(reviewId);

		// TODO: Update review with final results
		// await db.update(proposalReviews)
		//   .set({
		//     status: "completed",
		//     completedAt: new Date(),
		//     overallScore: aggregation?.overallScore,
		//     recommendation,
		//     executiveSummary,
		//     keyFindings,
		//     updatedAt: new Date(),
		//   })
		//   .where(eq(proposalReviews.id, reviewId));

		return { success: true };
	} catch (error) {
		console.error("Failed to complete review:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to complete review",
		};
	}
}

/**
 * Start a review session
 */
export async function startReview(
	reviewId: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// TODO: Update review status and timestamps
		// await db.update(proposalReviews)
		//   .set({
		//     status: "in_progress",
		//     startedAt: new Date(),
		//     updatedAt: new Date(),
		//   })
		//   .where(eq(proposalReviews.id, reviewId));

		return { success: true };
	} catch (error) {
		console.error("Failed to start review:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to start review",
		};
	}
}

/**
 * Cancel a review
 */
export async function cancelReview(
	reviewId: string,
	reason?: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// TODO: Update review status
		// await db.update(proposalReviews)
		//   .set({
		//     status: "cancelled",
		//     executiveSummary: reason ? `Cancelled: ${reason}` : "Review cancelled",
		//     updatedAt: new Date(),
		//   })
		//   .where(eq(proposalReviews.id, reviewId));

		return { success: true };
	} catch (error) {
		console.error("Failed to cancel review:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to cancel review",
		};
	}
}
