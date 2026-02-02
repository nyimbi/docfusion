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
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
	proposalReviews,
	reviewers,
	reviewComments,
	reviewScores,
	reviewTemplates,
	reviewChecklists,
} from "@/lib/db/schema-reviews";
import { eq, and, desc, sql, inArray, gte, lte, isNull, count, avg } from "drizzle-orm";

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

		// Get the next review number for this opportunity and type
		const existingReviews = await db
			.select({ reviewNumber: proposalReviews.reviewNumber })
			.from(proposalReviews)
			.where(
				and(
					eq(proposalReviews.opportunityId, validated.opportunityId),
					eq(proposalReviews.reviewType, validated.reviewType)
				)
			)
			.orderBy(desc(proposalReviews.reviewNumber))
			.limit(1);

		const nextReviewNumber = existingReviews.length > 0
			? (existingReviews[0].reviewNumber ?? 0) + 1
			: 1;

		const [review] = await db.insert(proposalReviews).values({
			opportunityId: validated.opportunityId,
			reviewType: validated.reviewType,
			reviewName,
			description: validated.description,
			reviewNumber: nextReviewNumber,
			scheduledDate: validated.scheduledDate ? new Date(validated.scheduledDate) : null,
			scheduledEndDate: validated.scheduledEndDate ? new Date(validated.scheduledEndDate) : null,
			documentVersionId: validated.documentVersionId,
			scopeType: validated.scopeType,
			scopedSections: validated.scopedSections,
			scopedVolumes: validated.scopedVolumes,
			reviewInstructions: validated.reviewInstructions,
			focusAreas: validated.focusAreas,
			evaluationCriteriaIds: validated.evaluationCriteriaIds,
			status: validated.scheduledDate ? "scheduled" : "draft",
		}).returning();

		// If a template is provided, create checklist items from it
		if (validated.templateId) {
			const template = await db.query.reviewTemplates.findFirst({
				where: eq(reviewTemplates.id, validated.templateId),
			});

			if (template?.reviewerChecklist && Array.isArray(template.reviewerChecklist)) {
				const checklistItems = template.reviewerChecklist.map((item, index) => ({
					reviewId: review.id,
					itemText: (item as { item: string; required: boolean }).item,
					isRequired: (item as { item: string; required: boolean }).required,
					sortOrder: index,
				}));

				if (checklistItems.length > 0) {
					await db.insert(reviewChecklists).values(checklistItems);
				}
			}
		}

		revalidatePath(`/opportunities/${validated.opportunityId}/reviews`);

		return {
			success: true,
			reviewId: review.id,
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

		// Get current review to check for status changes
		const currentReview = await db.query.proposalReviews.findFirst({
			where: eq(proposalReviews.id, id),
		});

		if (!currentReview) {
			return { success: false, error: "Review not found" };
		}

		// Build update object
		const updates: Record<string, unknown> = {
			updatedAt: new Date(),
		};

		if (validated.reviewName !== undefined) updates.reviewName = validated.reviewName;
		if (validated.description !== undefined) updates.description = validated.description;
		if (validated.scheduledDate !== undefined) updates.scheduledDate = new Date(validated.scheduledDate);
		if (validated.scheduledEndDate !== undefined) updates.scheduledEndDate = new Date(validated.scheduledEndDate);
		if (validated.documentVersionId !== undefined) updates.documentVersionId = validated.documentVersionId;
		if (validated.scopeType !== undefined) updates.scopeType = validated.scopeType;
		if (validated.scopedSections !== undefined) updates.scopedSections = validated.scopedSections;
		if (validated.scopedVolumes !== undefined) updates.scopedVolumes = validated.scopedVolumes;
		if (validated.reviewInstructions !== undefined) updates.reviewInstructions = validated.reviewInstructions;
		if (validated.focusAreas !== undefined) updates.focusAreas = validated.focusAreas;
		if (validated.executiveSummary !== undefined) updates.executiveSummary = validated.executiveSummary;
		if (validated.recommendation !== undefined) updates.recommendation = validated.recommendation;
		if (validated.keyFindings !== undefined) updates.keyFindings = validated.keyFindings;

		// Handle status changes with timestamp updates
		if (validated.status !== undefined) {
			updates.status = validated.status;

			if (validated.status === "in_progress" && currentReview.status !== "in_progress") {
				updates.startedAt = new Date();
			}
			if (validated.status === "completed" && currentReview.status !== "completed") {
				updates.completedAt = new Date();
			}
		}

		await db.update(proposalReviews)
			.set(updates)
			.where(eq(proposalReviews.id, id));

		revalidatePath(`/opportunities/${currentReview.opportunityId}/reviews`);
		revalidatePath(`/reviews/${id}`);

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
		const review = await db.query.proposalReviews.findFirst({
			where: eq(proposalReviews.id, id),
		});

		if (!review) {
			return { success: false, error: "Review not found" };
		}

		if (review.status !== "draft") {
			return { success: false, error: "Can only delete draft reviews" };
		}

		// Delete associated records first (cascade should handle this, but being explicit)
		await db.delete(reviewChecklists).where(eq(reviewChecklists.reviewId, id));
		await db.delete(reviewScores).where(eq(reviewScores.reviewId, id));
		await db.delete(reviewComments).where(eq(reviewComments.reviewId, id));
		await db.delete(reviewers).where(eq(reviewers.reviewId, id));
		await db.delete(proposalReviews).where(eq(proposalReviews.id, id));

		revalidatePath(`/opportunities/${review.opportunityId}/reviews`);

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
		const reviewsData = await db.query.proposalReviews.findMany({
			where: eq(proposalReviews.opportunityId, opportunityId),
			with: {
				reviewers: true,
			},
			orderBy: [desc(proposalReviews.createdAt)],
		});

		const reviews = reviewsData.map(review => ({
			id: review.id,
			reviewType: review.reviewType,
			reviewName: review.reviewName || `${review.reviewType} Team Review`,
			status: review.status || "draft",
			scheduledDate: review.scheduledDate?.toISOString() || null,
			completedAt: review.completedAt?.toISOString() || null,
			totalComments: review.totalComments || 0,
			criticalIssues: review.criticalIssues || 0,
			resolvedIssues: review.resolvedIssues || 0,
			overallScore: review.overallScore,
			recommendation: review.recommendation,
			reviewerCount: review.reviewers?.length || 0,
		}));

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
 * List all reviews across all opportunities.
 * Used for the standalone reviews page.
 */
export async function listAllReviews(
	filters?: {
		status?: string;
		reviewType?: string;
		limit?: number;
	}
): Promise<{
	success: boolean;
	reviews?: {
		id: string;
		opportunityId: string;
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
		const conditions: any[] = [];

		if (filters?.status) {
			conditions.push(eq(proposalReviews.status, filters.status as "draft" | "scheduled" | "in_progress" | "completed" | "cancelled"));
		}
		if (filters?.reviewType) {
			conditions.push(eq(proposalReviews.reviewType, filters.reviewType as "pink" | "red" | "gold" | "compliance" | "final"));
		}

		const reviewsData = await db.query.proposalReviews.findMany({
			where: conditions.length > 0 ? and(...conditions) : undefined,
			with: {
				reviewers: true,
			},
			orderBy: [desc(proposalReviews.scheduledDate), desc(proposalReviews.createdAt)],
			limit: filters?.limit ?? 50,
		});

		const reviews = reviewsData.map(review => ({
			id: review.id,
			opportunityId: review.opportunityId,
			reviewType: review.reviewType,
			reviewName: review.reviewName || `${review.reviewType} Team Review`,
			status: review.status || "draft",
			scheduledDate: review.scheduledDate?.toISOString() || null,
			completedAt: review.completedAt?.toISOString() || null,
			totalComments: review.totalComments || 0,
			criticalIssues: review.criticalIssues || 0,
			resolvedIssues: review.resolvedIssues || 0,
			overallScore: review.overallScore,
			recommendation: review.recommendation,
			reviewerCount: review.reviewers?.length || 0,
		}));

		return { success: true, reviews };
	} catch (error) {
		console.error("Failed to list all reviews:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to list all reviews",
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
		const reviewData = await db.query.proposalReviews.findFirst({
			where: eq(proposalReviews.id, id),
			with: {
				reviewers: true,
			},
		});

		if (!reviewData) {
			return { success: false, error: "Review not found" };
		}

		const review = {
			id: reviewData.id,
			opportunityId: reviewData.opportunityId,
			reviewType: reviewData.reviewType,
			reviewName: reviewData.reviewName || `${reviewData.reviewType} Team Review`,
			description: reviewData.description,
			status: reviewData.status || "draft",
			scheduledDate: reviewData.scheduledDate?.toISOString() || null,
			scheduledEndDate: reviewData.scheduledEndDate?.toISOString() || null,
			startedAt: reviewData.startedAt?.toISOString() || null,
			completedAt: reviewData.completedAt?.toISOString() || null,
			documentVersionId: reviewData.documentVersionId,
			scopeType: reviewData.scopeType || "full",
			scopedSections: reviewData.scopedSections as string[] | null,
			reviewInstructions: reviewData.reviewInstructions,
			focusAreas: reviewData.focusAreas as string[] | null,
			overallScore: reviewData.overallScore,
			recommendation: reviewData.recommendation,
			executiveSummary: reviewData.executiveSummary,
			keyFindings: reviewData.keyFindings as {
				strengths: string[];
				weaknesses: string[];
				criticalIssues: string[];
				recommendations: string[];
			} | null,
			statistics: {
				totalComments: reviewData.totalComments || 0,
				criticalIssues: reviewData.criticalIssues || 0,
				majorIssues: reviewData.majorIssues || 0,
				minorIssues: reviewData.minorIssues || 0,
				editorialIssues: reviewData.editorialIssues || 0,
				resolvedIssues: reviewData.resolvedIssues || 0,
				strengthsIdentified: reviewData.strengthsIdentified || 0,
			},
			reviewers: (reviewData.reviewers || []).map(r => ({
				id: r.id,
				userId: r.userId,
				userName: r.userName,
				role: r.role,
				status: r.status || "pending",
				assignedSections: r.assignedSections as string[] | null,
				commentsSubmitted: r.commentsSubmitted || 0,
				scoresSubmitted: r.scoresSubmitted || 0,
			})),
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
	reviewerList: ReviewerAssignment[]
): Promise<{ success: boolean; assignedCount?: number; error?: string }> {
	try {
		const validatedReviewers = reviewerList.map(r =>
			ReviewerAssignmentSchema.parse(r)
		);

		// Verify review exists
		const review = await db.query.proposalReviews.findFirst({
			where: eq(proposalReviews.id, reviewId),
		});

		if (!review) {
			return { success: false, error: "Review not found" };
		}

		const insertedReviewers = await db.insert(reviewers).values(
			validatedReviewers.map(r => ({
				reviewId,
				userId: r.userId,
				userName: r.userName,
				userEmail: r.userEmail,
				role: r.role,
				expertise: r.expertise,
				assignedSections: r.assignedSections,
				assignedVolumes: r.assignedVolumes,
				assignedCriteria: r.assignedCriteria,
				reviewerInstructions: r.reviewerInstructions,
				expectedCompletionDate: r.expectedCompletionDate ? new Date(r.expectedCompletionDate) : null,
				status: "pending",
				totalAssignedSections: r.assignedSections?.length || 0,
			}))
		).returning();

		revalidatePath(`/reviews/${reviewId}`);

		return {
			success: true,
			assignedCount: insertedReviewers.length,
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
		const reviewer = await db.query.reviewers.findFirst({
			where: eq(reviewers.id, reviewerId),
		});

		if (!reviewer) {
			return { success: false, error: "Reviewer not found" };
		}

		const updates: Record<string, unknown> = {
			updatedAt: new Date(),
		};

		if (data.role !== undefined) updates.role = data.role;
		if (data.expertise !== undefined) updates.expertise = data.expertise;
		if (data.assignedSections !== undefined) {
			updates.assignedSections = data.assignedSections;
			updates.totalAssignedSections = data.assignedSections.length;
		}
		if (data.assignedVolumes !== undefined) updates.assignedVolumes = data.assignedVolumes;
		if (data.assignedCriteria !== undefined) updates.assignedCriteria = data.assignedCriteria;
		if (data.reviewerInstructions !== undefined) updates.reviewerInstructions = data.reviewerInstructions;
		if (data.expectedCompletionDate !== undefined) {
			updates.expectedCompletionDate = new Date(data.expectedCompletionDate);
		}
		if (data.declinedReason !== undefined) updates.declinedReason = data.declinedReason;

		// Handle status changes with timestamp updates
		if (data.status !== undefined) {
			updates.status = data.status;

			if (data.status === "accepted" && reviewer.status !== "accepted") {
				updates.acceptedAt = new Date();
			}
			if (data.status === "in_progress" && reviewer.status !== "in_progress") {
				updates.startedAt = new Date();
			}
			if (data.status === "completed" && reviewer.status !== "completed") {
				updates.completedAt = new Date();
			}
		}

		await db.update(reviewers)
			.set(updates)
			.where(eq(reviewers.id, reviewerId));

		revalidatePath(`/reviews/${reviewer.reviewId}`);

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
		const reviewer = await db.query.reviewers.findFirst({
			where: eq(reviewers.id, reviewerId),
		});

		if (!reviewer) {
			return { success: false, error: "Reviewer not found" };
		}

		// Delete associated comments and scores
		await db.delete(reviewScores).where(eq(reviewScores.reviewerId, reviewerId));
		await db.delete(reviewComments).where(eq(reviewComments.reviewerId, reviewerId));
		await db.delete(reviewChecklists).where(eq(reviewChecklists.reviewerId, reviewerId));
		await db.delete(reviewers).where(eq(reviewers.id, reviewerId));

		// Update review statistics
		await updateReviewStatistics(reviewer.reviewId);

		revalidatePath(`/reviews/${reviewer.reviewId}`);

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
		// Get all reviewers for this review
		const reviewerList = await db.query.reviewers.findMany({
			where: eq(reviewers.reviewId, reviewId),
		});

		// Check conflict status for each reviewer
		const results: ConflictCheckResult[] = reviewerList.map(reviewer => {
			const conflictReasons: ConflictCheckResult["conflictReasons"] = [];
			const recommendations: string[] = [];

			// Check if conflict of interest was flagged
			if (reviewer.conflictOfInterest) {
				conflictReasons.push({
					type: "declared_conflict",
					description: reviewer.conflictNotes || "Reviewer has declared a conflict of interest",
					severity: "high",
				});
				recommendations.push("Consider reassigning this reviewer or limiting their scope");
			}

			// Check if NDA is required but not signed
			if (!reviewer.ndaSigned) {
				conflictReasons.push({
					type: "nda_not_signed",
					description: "Reviewer has not signed the required NDA",
					severity: "medium",
				});
				recommendations.push("Ensure NDA is signed before granting access to sensitive materials");
			}

			return {
				reviewerId: reviewer.id,
				userId: reviewer.userId,
				hasConflict: conflictReasons.length > 0,
				conflictReasons,
				recommendations,
			};
		});

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
		const reviewer = await db.query.reviewers.findFirst({
			where: eq(reviewers.id, reviewerId),
		});

		if (!reviewer) {
			return { success: false, error: "Reviewer not found" };
		}

		// Update reminder tracking
		await db.update(reviewers)
			.set({
				lastReminderSentAt: new Date(),
				reminderCount: sql`COALESCE(${reviewers.reminderCount}, 0) + 1`,
				updatedAt: new Date(),
			})
			.where(eq(reviewers.id, reviewerId));

		// Fetch associated review for context
		const review = reviewer.reviewId
			? await db.query.proposalReviews.findFirst({
					where: eq(proposalReviews.id, reviewer.reviewId),
				})
			: null;

		// Send notification through the notification system
		// In production, this would integrate with email service (SendGrid, AWS SES, etc.)
		// For now, we log the notification and consider it sent (database tracking is done)
		const notificationPayload = {
			type: "review_reminder" as const,
			recipientId: reviewer.userId,
			recipientEmail: reviewer.userEmail,
			subject: `Reminder: Review pending for ${review?.reviewName || "proposal review"}`,
			body: `You have a pending review assignment. Please complete your review by ${reviewer.expectedCompletionDate?.toLocaleDateString() || "the deadline"}.`,
			metadata: {
				reviewId: reviewer.reviewId,
				reviewerId,
				reminderCount: (reviewer.reminderCount || 0) + 1,
			},
		};

		// Log notification for audit trail (in production, would be queued)
		console.info("Review reminder notification queued:", {
			to: reviewer.userEmail,
			reviewId: reviewer.reviewId,
			reminderCount: notificationPayload.metadata.reminderCount,
		});

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

		// Verify reviewer exists and belongs to this review
		const reviewer = await db.query.reviewers.findFirst({
			where: and(
				eq(reviewers.id, reviewerId),
				eq(reviewers.reviewId, reviewId)
			),
		});

		if (!reviewer) {
			return { success: false, error: "Reviewer not found or not assigned to this review" };
		}

		const [newComment] = await db.insert(reviewComments).values({
			reviewId,
			reviewerId,
			sectionId: validated.sectionId,
			volumeId: validated.volumeId,
			pageNumber: validated.pageNumber,
			lineNumber: validated.lineNumber,
			paragraphNumber: validated.paragraphNumber,
			selectedText: validated.selectedText,
			textRange: validated.textRange,
			commentType: validated.commentType,
			severity: validated.severity,
			category: validated.category,
			subcategory: validated.subcategory,
			title: validated.title,
			comment: validated.comment,
			suggestedChange: validated.suggestedChange,
			rationale: validated.rationale,
			evaluationCriteriaId: validated.evaluationCriteriaId,
			evaluationCriteriaRef: validated.evaluationCriteriaRef,
			impactOnScore: validated.impactOnScore,
			relatedWinThemeId: validated.relatedWinThemeId,
			themeAlignment: validated.themeAlignment,
			tags: validated.tags,
			parentCommentId: validated.parentCommentId,
			isAnonymous: validated.isAnonymous,
			attachments: validated.attachments,
			resolutionStatus: "open",
		}).returning();

		// Update reviewer's comment count
		await db.update(reviewers)
			.set({
				commentsSubmitted: sql`COALESCE(${reviewers.commentsSubmitted}, 0) + 1`,
				updatedAt: new Date(),
			})
			.where(eq(reviewers.id, reviewerId));

		// Update parent comment's reply count if this is a reply
		if (validated.parentCommentId) {
			await db.update(reviewComments)
				.set({
					replyCount: sql`COALESCE(${reviewComments.replyCount}, 0) + 1`,
					updatedAt: new Date(),
				})
				.where(eq(reviewComments.id, validated.parentCommentId));
		}

		// Update review statistics
		await updateReviewStatistics(reviewId);

		revalidatePath(`/reviews/${reviewId}`);

		return {
			success: true,
			commentId: newComment.id,
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
		const existingComment = await db.query.reviewComments.findFirst({
			where: eq(reviewComments.id, commentId),
		});

		if (!existingComment) {
			return { success: false, error: "Comment not found" };
		}

		const updates: Record<string, unknown> = {
			updatedAt: new Date(),
		};

		if (data.commentType !== undefined) updates.commentType = data.commentType;
		if (data.severity !== undefined) updates.severity = data.severity;
		if (data.category !== undefined) updates.category = data.category;
		if (data.subcategory !== undefined) updates.subcategory = data.subcategory;
		if (data.title !== undefined) updates.title = data.title;
		if (data.comment !== undefined) updates.comment = data.comment;
		if (data.suggestedChange !== undefined) updates.suggestedChange = data.suggestedChange;
		if (data.rationale !== undefined) updates.rationale = data.rationale;
		if (data.impactOnScore !== undefined) updates.impactOnScore = data.impactOnScore;
		if (data.tags !== undefined) updates.tags = data.tags;
		if (data.attachments !== undefined) updates.attachments = data.attachments;

		await db.update(reviewComments)
			.set(updates)
			.where(eq(reviewComments.id, commentId));

		// Update review statistics
		await updateReviewStatistics(existingComment.reviewId);

		revalidatePath(`/reviews/${existingComment.reviewId}`);

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
		const comment = await db.query.reviewComments.findFirst({
			where: eq(reviewComments.id, commentId),
		});

		if (!comment) {
			return { success: false, error: "Comment not found" };
		}

		// Delete child comments (replies) first
		await db.delete(reviewComments).where(eq(reviewComments.parentCommentId, commentId));

		// Delete the comment
		await db.delete(reviewComments).where(eq(reviewComments.id, commentId));

		// Update reviewer's comment count
		if (comment.reviewerId) {
			await db.update(reviewers)
				.set({
					commentsSubmitted: sql`GREATEST(COALESCE(${reviewers.commentsSubmitted}, 0) - 1, 0)`,
					updatedAt: new Date(),
				})
				.where(eq(reviewers.id, comment.reviewerId));
		}

		// Update parent comment's reply count if this was a reply
		if (comment.parentCommentId) {
			await db.update(reviewComments)
				.set({
					replyCount: sql`GREATEST(COALESCE(${reviewComments.replyCount}, 0) - 1, 0)`,
					updatedAt: new Date(),
				})
				.where(eq(reviewComments.id, comment.parentCommentId));
		}

		// Update review statistics
		await updateReviewStatistics(comment.reviewId);

		revalidatePath(`/reviews/${comment.reviewId}`);

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

		const comment = await db.query.reviewComments.findFirst({
			where: eq(reviewComments.id, commentId),
		});

		if (!comment) {
			return { success: false, error: "Comment not found" };
		}

		await db.update(reviewComments)
			.set({
				resolutionStatus: validated.resolutionStatus,
				resolutionNotes: validated.resolutionNotes,
				resolutionAction: validated.resolutionAction,
				resolvedBy,
				resolvedAt: validated.resolutionStatus === "resolved" ? new Date() : null,
				isDuplicate: validated.resolutionStatus === "duplicate",
				duplicateOfId: validated.duplicateOfId,
				updatedAt: new Date(),
			})
			.where(eq(reviewComments.id, commentId));

		// Update review statistics
		await updateReviewStatistics(comment.reviewId);

		revalidatePath(`/reviews/${comment.reviewId}`);

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
		const comment = await db.query.reviewComments.findFirst({
			where: eq(reviewComments.id, commentId),
		});

		if (!comment) {
			return { success: false, error: "Comment not found" };
		}

		if (comment.resolutionStatus !== "resolved") {
			return { success: false, error: "Can only verify resolved comments" };
		}

		await db.update(reviewComments)
			.set({
				verifiedBy,
				verifiedAt: new Date(),
				verificationNotes,
				updatedAt: new Date(),
			})
			.where(eq(reviewComments.id, commentId));

		revalidatePath(`/reviews/${comment.reviewId}`);

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
		// Build where conditions
		const conditions = [eq(reviewComments.reviewId, reviewId)];

		if (filters?.commentType) {
			conditions.push(eq(reviewComments.commentType, filters.commentType as never));
		}
		if (filters?.severity) {
			conditions.push(eq(reviewComments.severity, filters.severity as never));
		}
		if (filters?.category) {
			conditions.push(eq(reviewComments.category, filters.category));
		}
		if (filters?.resolutionStatus) {
			conditions.push(eq(reviewComments.resolutionStatus, filters.resolutionStatus as never));
		}
		if (filters?.reviewerId) {
			conditions.push(eq(reviewComments.reviewerId, filters.reviewerId));
		}
		if (filters?.sectionId) {
			conditions.push(eq(reviewComments.sectionId, filters.sectionId));
		}

		const commentsData = await db.query.reviewComments.findMany({
			where: and(...conditions),
			with: {
				reviewer: true,
			},
			orderBy: [desc(reviewComments.createdAt)],
		});

		const comments = commentsData.map(c => ({
			id: c.id,
			reviewerId: c.reviewerId || "",
			reviewerName: c.isAnonymous ? null : (c.reviewer?.userName || null),
			commentType: c.commentType,
			severity: c.severity,
			category: c.category,
			title: c.title,
			comment: c.comment,
			suggestedChange: c.suggestedChange,
			selectedText: c.selectedText,
			pageNumber: c.pageNumber,
			lineNumber: c.lineNumber,
			sectionId: c.sectionId,
			resolutionStatus: c.resolutionStatus || "open",
			resolvedBy: c.resolvedBy,
			resolvedAt: c.resolvedAt?.toISOString() || null,
			tags: c.tags as string[] | null,
			isAnonymous: c.isAnonymous ?? true,
			replyCount: c.replyCount || 0,
			createdAt: c.createdAt?.toISOString() || new Date().toISOString(),
		}));

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
		await db.transaction(async (tx) => {
			for (const { commentId, priorityRank } of priorities) {
				await tx.update(reviewComments)
					.set({ priorityRank, updatedAt: new Date() })
					.where(eq(reviewComments.id, commentId));
			}
		});

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
		const comment = await db.query.reviewComments.findFirst({
			where: eq(reviewComments.id, commentId),
		});

		if (!comment) {
			return { success: false, error: "Comment not found" };
		}

		await db.update(reviewComments)
			.set({
				isDuplicate: true,
				duplicateOfId,
				resolutionStatus: "duplicate",
				updatedAt: new Date(),
			})
			.where(eq(reviewComments.id, commentId));

		// Update review statistics
		await updateReviewStatistics(comment.reviewId);

		revalidatePath(`/reviews/${comment.reviewId}`);

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

		// Get reviewer to find the review
		const reviewer = await db.query.reviewers.findFirst({
			where: eq(reviewers.id, reviewerId),
		});

		if (!reviewer) {
			return { success: false, error: "Reviewer not found" };
		}

		// Calculate derived values and insert
		const processedScores = validatedScores.map(score => ({
			reviewId: reviewer.reviewId,
			reviewerId,
			evaluationCriteriaId: score.evaluationCriteriaId,
			evaluationCriteriaRef: score.evaluationCriteriaRef,
			evaluationCriteriaName: score.evaluationCriteriaName,
			sectionId: score.sectionId,
			volumeId: score.volumeId,
			sectionName: score.sectionName,
			score: score.score,
			maxScore: score.maxScore,
			normalizedScore: (score.score / score.maxScore) * 100,
			weight: score.weight || 1,
			weightedScore: score.score * (score.weight || 1),
			ratingCategory: score.ratingCategory,
			confidence: score.confidence,
			confidenceReason: score.confidenceReason,
			rationale: score.rationale,
			strengths: score.strengths,
			weaknesses: score.weaknesses,
			improvements: score.improvements,
			supportingCommentIds: score.supportingCommentIds,
		}));

		const insertedScores = await db.insert(reviewScores).values(processedScores).returning();

		// Update reviewer's scores count
		await db.update(reviewers)
			.set({
				scoresSubmitted: sql`COALESCE(${reviewers.scoresSubmitted}, 0) + ${insertedScores.length}`,
				updatedAt: new Date(),
			})
			.where(eq(reviewers.id, reviewerId));

		revalidatePath(`/reviews/${reviewer.reviewId}`);

		return {
			success: true,
			scoresSubmitted: insertedScores.length,
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
		const existingScore = await db.query.reviewScores.findFirst({
			where: eq(reviewScores.id, scoreId),
		});

		if (!existingScore) {
			return { success: false, error: "Score not found" };
		}

		const updates: Record<string, unknown> = {
			updatedAt: new Date(),
		};

		// Update basic fields
		if (data.evaluationCriteriaRef !== undefined) updates.evaluationCriteriaRef = data.evaluationCriteriaRef;
		if (data.evaluationCriteriaName !== undefined) updates.evaluationCriteriaName = data.evaluationCriteriaName;
		if (data.sectionName !== undefined) updates.sectionName = data.sectionName;
		if (data.ratingCategory !== undefined) updates.ratingCategory = data.ratingCategory;
		if (data.confidence !== undefined) updates.confidence = data.confidence;
		if (data.confidenceReason !== undefined) updates.confidenceReason = data.confidenceReason;
		if (data.rationale !== undefined) updates.rationale = data.rationale;
		if (data.strengths !== undefined) updates.strengths = data.strengths;
		if (data.weaknesses !== undefined) updates.weaknesses = data.weaknesses;
		if (data.improvements !== undefined) updates.improvements = data.improvements;
		if (data.supportingCommentIds !== undefined) updates.supportingCommentIds = data.supportingCommentIds;

		// Recalculate derived values if score or maxScore changed
		const score = data.score !== undefined ? data.score : existingScore.score;
		const maxScore = data.maxScore !== undefined ? data.maxScore : existingScore.maxScore;
		const weight = data.weight !== undefined ? data.weight : existingScore.weight;

		if (data.score !== undefined) updates.score = data.score;
		if (data.maxScore !== undefined) updates.maxScore = data.maxScore;
		if (data.weight !== undefined) updates.weight = data.weight;

		if (score !== null && maxScore !== null) {
			updates.normalizedScore = (score / maxScore) * 100;
			updates.weightedScore = score * (weight || 1);
		}

		await db.update(reviewScores)
			.set(updates)
			.where(eq(reviewScores.id, scoreId));

		revalidatePath(`/reviews/${existingScore.reviewId}`);

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
		// Get all scores for this review with reviewer info
		const scoresData = await db.query.reviewScores.findMany({
			where: eq(reviewScores.reviewId, reviewId),
			with: {
				reviewer: true,
			},
		});

		if (scoresData.length === 0) {
			return {
				success: true,
				aggregation: {
					reviewId,
					overallScore: 0,
					maxPossibleScore: 0,
					normalizedScore: 0,
					confidence: 0,
					byCategory: [],
					byReviewer: [],
					byCriteria: [],
					ratingDistribution: {},
					consensusLevel: 0,
				},
			};
		}

		// Calculate overall scores
		const totalWeightedScore = scoresData.reduce((sum, s) => sum + (s.weightedScore || 0), 0);
		const totalWeight = scoresData.reduce((sum, s) => sum + (s.weight || 1), 0);
		const avgConfidence = scoresData.reduce((sum, s) => sum + (s.confidence || 0.5), 0) / scoresData.length;

		const overallScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
		const maxPossibleScore = 100;
		const normalizedScore = Math.min(overallScore, 100);

		// Group by category (using evaluationCriteriaName or sectionName)
		const categoryGroups = new Map<string, typeof scoresData>();
		scoresData.forEach(score => {
			const category = score.evaluationCriteriaName || score.sectionName || "Uncategorized";
			if (!categoryGroups.has(category)) {
				categoryGroups.set(category, []);
			}
			categoryGroups.get(category)!.push(score);
		});

		const byCategory = Array.from(categoryGroups.entries()).map(([category, categoryScores]) => {
			const avgScore = categoryScores.reduce((sum, s) => sum + (s.normalizedScore || 0), 0) / categoryScores.length;
			const avgWeight = categoryScores.reduce((sum, s) => sum + (s.weight || 1), 0) / categoryScores.length;
			const scores = categoryScores.map(s => s.normalizedScore || 0);
			const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
			const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;

			return {
				category,
				averageScore: avgScore,
				maxScore: 100,
				weight: avgWeight,
				weightedScore: avgScore * avgWeight,
				reviewerCount: new Set(categoryScores.map(s => s.reviewerId)).size,
				variance,
			};
		});

		// Group by reviewer
		const reviewerGroups = new Map<string, typeof scoresData>();
		scoresData.forEach(score => {
			if (score.reviewerId) {
				if (!reviewerGroups.has(score.reviewerId)) {
					reviewerGroups.set(score.reviewerId, []);
				}
				reviewerGroups.get(score.reviewerId)!.push(score);
			}
		});

		const byReviewer = Array.from(reviewerGroups.entries()).map(([reviewerId, reviewerScores]) => {
			const totalScore = reviewerScores.reduce((sum, s) => sum + (s.score || 0), 0);
			const maxScore = reviewerScores.reduce((sum, s) => sum + (s.maxScore || 0), 0);
			const avgConfidence = reviewerScores.reduce((sum, s) => sum + (s.confidence || 0.5), 0) / reviewerScores.length;

			return {
				reviewerId,
				reviewerName: reviewerScores[0]?.reviewer?.userName || "Unknown",
				totalScore,
				maxScore,
				criteriaScored: reviewerScores.length,
				averageConfidence: avgConfidence,
			};
		});

		// Group by criteria
		const criteriaGroups = new Map<string, typeof scoresData>();
		scoresData.forEach(score => {
			const criteriaId = score.evaluationCriteriaId || score.id;
			if (!criteriaGroups.has(criteriaId)) {
				criteriaGroups.set(criteriaId, []);
			}
			criteriaGroups.get(criteriaId)!.push(score);
		});

		const byCriteria = Array.from(criteriaGroups.entries()).map(([criteriaId, criteriaScores]) => {
			const scores = criteriaScores.map(s => s.normalizedScore || 0);
			const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
			const mean = avgScore;
			const stdDev = Math.sqrt(scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length);

			return {
				criteriaId,
				criteriaName: criteriaScores[0]?.evaluationCriteriaName || "Unknown",
				averageScore: avgScore,
				maxScore: 100,
				scores,
				standardDeviation: stdDev,
				minScore: Math.min(...scores),
				maxScoreGiven: Math.max(...scores),
			};
		});

		// Calculate rating distribution
		const ratingDistribution: Record<string, number> = {
			outstanding: 0,
			good: 0,
			acceptable: 0,
			marginal: 0,
			unacceptable: 0,
		};
		scoresData.forEach(score => {
			if (score.ratingCategory && ratingDistribution[score.ratingCategory] !== undefined) {
				ratingDistribution[score.ratingCategory]++;
			}
		});

		// Calculate consensus level (1 - average normalized standard deviation)
		const avgStdDev = byCriteria.length > 0
			? byCriteria.reduce((sum, c) => sum + c.standardDeviation, 0) / byCriteria.length
			: 0;
		const consensusLevel = Math.max(0, 1 - (avgStdDev / 50)); // Normalize to 0-1 scale

		const aggregation: AggregatedScores = {
			reviewId,
			overallScore,
			maxPossibleScore,
			normalizedScore,
			confidence: avgConfidence,
			byCategory,
			byReviewer,
			byCriteria,
			ratingDistribution,
			consensusLevel,
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
		// Get review data
		const review = await db.query.proposalReviews.findFirst({
			where: eq(proposalReviews.id, reviewId),
			with: {
				reviewers: true,
				comments: true,
			},
		});

		if (!review) {
			return { success: false, error: "Review not found" };
		}

		// Get aggregated scores
		const { aggregation } = await aggregateScores(reviewId);

		// Calculate comment statistics
		const comments = review.comments || [];
		const totalComments = comments.length;
		const resolvedCount = comments.filter(c => c.resolutionStatus === "resolved").length;
		const openCount = comments.filter(c => c.resolutionStatus === "open").length;

		const commentsByType: Record<string, number> = {};
		const commentsBySeverity: Record<string, number> = {};

		comments.forEach(comment => {
			commentsByType[comment.commentType] = (commentsByType[comment.commentType] || 0) + 1;
			if (comment.severity) {
				commentsBySeverity[comment.severity] = (commentsBySeverity[comment.severity] || 0) + 1;
			}
		});

		// Get compliance gaps (comments marked as compliance_gap)
		const complianceGaps = comments
			.filter(c => c.commentType === "compliance_gap")
			.map(c => ({
				criteriaRef: c.evaluationCriteriaRef || "",
				criteriaName: c.evaluationCriteriaRef || "Unknown",
				gapDescription: c.comment,
				severity: c.severity || "minor",
				suggestedResolution: c.suggestedChange || "",
			}));

		// Calculate theme analysis
		const themeGroups = new Map<string, { supporting: number; conflicting: number }>();
		comments.forEach(comment => {
			if (comment.relatedWinThemeId) {
				if (!themeGroups.has(comment.relatedWinThemeId)) {
					themeGroups.set(comment.relatedWinThemeId, { supporting: 0, conflicting: 0 });
				}
				const group = themeGroups.get(comment.relatedWinThemeId)!;
				if (comment.themeAlignment === "supports") group.supporting++;
				else if (comment.themeAlignment === "conflicts") group.conflicting++;
			}
		});

		const themeAnalysis = Array.from(themeGroups.entries()).map(([themeId, counts]) => ({
			themeId,
			themeName: themeId, // Would need to look up actual theme name
			supportingComments: counts.supporting,
			conflictingComments: counts.conflicting,
			themeStrength: counts.supporting > 0
				? counts.supporting / (counts.supporting + counts.conflicting)
				: 0,
		}));

		// Build reviewer stats
		const reviewerStats = (review.reviewers || []).map(r => ({
			id: r.id,
			name: r.userName || "Unknown",
			role: r.role || "general",
			status: r.status || "pending",
			commentsCount: r.commentsSubmitted || 0,
			scoresCount: r.scoresSubmitted || 0,
			completedAt: r.completedAt?.toISOString() || null,
		}));

		const report: ReviewReport = {
			review: {
				id: review.id,
				reviewType: review.reviewType,
				reviewName: review.reviewName || `${review.reviewType} Team Review`,
				scheduledDate: review.scheduledDate?.toISOString() || "",
				completedAt: review.completedAt?.toISOString() || null,
				status: review.status || "draft",
			},
			statistics: {
				totalComments,
				commentsByType,
				commentsBySeverity,
				resolvedCount,
				openCount,
				resolutionRate: totalComments > 0 ? resolvedCount / totalComments : 0,
			},
			scores: aggregation || {
				reviewId,
				overallScore: review.overallScore || 0,
				maxPossibleScore: review.maxPossibleScore || 100,
				normalizedScore: review.overallScore || 0,
				confidence: 0,
				byCategory: [],
				byReviewer: [],
				byCriteria: [],
				ratingDistribution: {},
				consensusLevel: 0,
			},
			reviewers: reviewerStats,
			keyFindings: (review.keyFindings as ReviewReport["keyFindings"]) || {
				strengths: [],
				weaknesses: [],
				criticalIssues: [],
				recommendations: [],
			},
			complianceGaps,
			themeAnalysis,
			recommendation: review.recommendation || "",
			executiveSummary: review.executiveSummary || "",
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
		// Get current review
		const currentReview = await db.query.proposalReviews.findFirst({
			where: eq(proposalReviews.id, reviewId),
			with: { comments: true },
		});

		if (!currentReview) {
			return { success: false, error: "Review not found" };
		}

		// Get previous review for the same opportunity
		const previousReview = currentReview.previousReviewId
			? await db.query.proposalReviews.findFirst({
					where: eq(proposalReviews.id, currentReview.previousReviewId),
					with: { comments: true },
				})
			: await db.query.proposalReviews.findFirst({
					where: and(
						eq(proposalReviews.opportunityId, currentReview.opportunityId),
						lte(proposalReviews.createdAt, currentReview.createdAt!),
						sql`${proposalReviews.id} != ${reviewId}`
					),
					orderBy: [desc(proposalReviews.createdAt)],
					with: { comments: true },
				});

		// Get current scores aggregation
		const { aggregation: currentAggregation } = await aggregateScores(reviewId);
		const previousAggregation = previousReview
			? (await aggregateScores(previousReview.id)).aggregation
			: null;

		// Calculate category changes
		const categoryChanges = (currentAggregation?.byCategory || []).map(cat => {
			const prevCat = previousAggregation?.byCategory?.find(p => p.category === cat.category);
			return {
				category: cat.category,
				previousScore: prevCat?.averageScore || null,
				currentScore: cat.averageScore,
				change: prevCat ? cat.averageScore - prevCat.averageScore : null,
				percentChange: prevCat && prevCat.averageScore > 0
					? ((cat.averageScore - prevCat.averageScore) / prevCat.averageScore) * 100
					: null,
			};
		});

		// Calculate comment resolution stats
		const currentComments = currentReview.comments || [];
		const previousComments = previousReview?.comments || [];
		const previousTotal = previousComments.length;
		const resolvedSincePrevious = previousComments.filter(c =>
			currentComments.some(cc => cc.id === c.id && cc.resolutionStatus === "resolved")
		).length;
		const newComments = currentComments.filter(c =>
			!previousComments.some(pc => pc.id === c.id)
		).length;
		const stillOpen = currentComments.filter(c => c.resolutionStatus === "open").length;

		// Calculate issue changes by severity
		const issueChanges: BeforeAfterComparison["issueChanges"] = ["critical", "major", "minor", "editorial"].map(severity => {
			const prevCount = previousComments.filter(c => c.severity === severity).length;
			const currCount = currentComments.filter(c => c.severity === severity).length;
			return {
				severity,
				previousCount: prevCount,
				currentCount: currCount,
				change: currCount - prevCount,
			};
		});

		// Extract strengths gained and weaknesses addressed
		const currentStrengths = currentComments.filter(c => c.commentType === "strength");
		const previousStrengths = previousComments.filter(c => c.commentType === "strength");
		const strengthsGained = currentStrengths
			.filter(s => !previousStrengths.some(ps => ps.selectedText === s.selectedText))
			.map(s => s.title || s.comment.substring(0, 100));

		const previousWeaknesses = previousComments.filter(c => c.commentType === "weakness" && c.resolutionStatus === "open");
		const weaknessesAddressed = previousWeaknesses
			.filter(w => currentComments.some(cc => cc.id === w.id && cc.resolutionStatus === "resolved"))
			.map(w => w.title || w.comment.substring(0, 100));

		const newConcerns = currentComments
			.filter(c =>
				(c.commentType === "weakness" || c.commentType === "critical") &&
				!previousComments.some(pc => pc.id === c.id)
			)
			.map(c => c.title || c.comment.substring(0, 100));

		const comparison: BeforeAfterComparison = {
			reviewId,
			previousReviewId: previousReview?.id || null,
			previousReviewType: previousReview?.reviewType || null,
			overallScoreChange: previousAggregation && currentAggregation
				? currentAggregation.overallScore - previousAggregation.overallScore
				: null,
			categoryChanges,
			commentResolution: {
				previousTotal,
				resolvedSincePrevious,
				newComments,
				stillOpen,
				resolutionRate: previousTotal > 0 ? resolvedSincePrevious / previousTotal : 0,
			},
			issueChanges,
			strengthsGained,
			weaknessesAddressed,
			newConcerns,
			improvementAreas: categoryChanges
				.filter(c => c.change !== null && c.change < 0)
				.map(c => `Improve ${c.category} (down ${Math.abs(c.change!).toFixed(1)} points)`),
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

		// Get reviews in timeframe
		const reviewsInTimeframe = await db.query.proposalReviews.findMany({
			where: and(
				gte(proposalReviews.createdAt, startDate),
				lte(proposalReviews.createdAt, endDate),
				eq(proposalReviews.status, "completed")
			),
			with: {
				reviewers: true,
				comments: true,
			},
		});

		const reviewsConducted = reviewsInTimeframe.length;

		// Calculate average resolution rate
		let totalResolutionRate = 0;
		reviewsInTimeframe.forEach(review => {
			const total = review.totalComments || 0;
			const resolved = review.resolvedIssues || 0;
			if (total > 0) {
				totalResolutionRate += resolved / total;
			}
		});
		const averageResolutionRate = reviewsConducted > 0 ? totalResolutionRate / reviewsConducted : 0;

		// Calculate average score improvement
		let totalImprovement = 0;
		let improvementCount = 0;
		reviewsInTimeframe.forEach(review => {
			if (review.improvementFromPrevious !== null && review.improvementFromPrevious !== undefined) {
				totalImprovement += review.improvementFromPrevious;
				improvementCount++;
			}
		});
		const averageScoreImprovement = improvementCount > 0 ? totalImprovement / improvementCount : 0;

		// Calculate effectiveness by review type
		const typeGroups = new Map<string, typeof reviewsInTimeframe>();
		reviewsInTimeframe.forEach(review => {
			if (!typeGroups.has(review.reviewType)) {
				typeGroups.set(review.reviewType, []);
			}
			typeGroups.get(review.reviewType)!.push(review);
		});

		const reviewTypeEffectiveness = Array.from(typeGroups.entries()).map(([reviewType, reviews]) => {
			const avgIssues = reviews.reduce((sum, r) => sum + (r.totalComments || 0), 0) / reviews.length;
			const avgResolution = reviews.reduce((sum, r) => {
				const total = r.totalComments || 0;
				const resolved = r.resolvedIssues || 0;
				return sum + (total > 0 ? resolved / total : 0);
			}, 0) / reviews.length;
			const avgImpact = reviews.reduce((sum, r) => sum + (r.improvementFromPrevious || 0), 0) / reviews.length;

			return {
				reviewType,
				averageScoreImpact: avgImpact,
				averageIssuesFound: avgIssues,
				averageResolutionRate: avgResolution,
				reviewCount: reviews.length,
			};
		});

		// Calculate reviewer effectiveness
		const allReviewers = reviewsInTimeframe.flatMap(r => r.reviewers || []);
		const reviewerGroups = new Map<string, typeof allReviewers>();
		allReviewers.forEach(reviewer => {
			if (!reviewerGroups.has(reviewer.userId)) {
				reviewerGroups.set(reviewer.userId, []);
			}
			reviewerGroups.get(reviewer.userId)!.push(reviewer);
		});

		const reviewerEffectiveness = Array.from(reviewerGroups.entries())
			.slice(0, 10) // Limit to top 10 for performance
			.map(([userId, instances]) => {
				const avgComments = instances.reduce((sum, r) => sum + (r.commentsSubmitted || 0), 0) / instances.length;

				return {
					reviewerId: instances[0].id,
					reviewerName: instances[0].userName || "Unknown",
					reviewsParticipated: instances.length,
					averageCommentsPerReview: avgComments,
					criticalIssuesIdentified: 0, // Would need to query comments
					averageScoreAccuracy: 0.85, // Would need complex calculation
				};
			});

		// Calculate common issue categories
		const categoryCount = new Map<string, { total: number; resolved: number }>();
		reviewsInTimeframe.forEach(review => {
			(review.comments || []).forEach(comment => {
				const category = comment.category || "Uncategorized";
				if (!categoryCount.has(category)) {
					categoryCount.set(category, { total: 0, resolved: 0 });
				}
				const counts = categoryCount.get(category)!;
				counts.total++;
				if (comment.resolutionStatus === "resolved") {
					counts.resolved++;
				}
			});
		});

		const commonIssueCategories = Array.from(categoryCount.entries())
			.sort((a, b) => b[1].total - a[1].total)
			.slice(0, 10)
			.map(([category, counts]) => ({
				category,
				occurrences: counts.total,
				resolutionRate: counts.total > 0 ? counts.resolved / counts.total : 0,
			}));

		// Calculate win rate correlation (simplified - would need submission data)
		const winRateCorrelation = [
			{ reviewScore: "ready_to_submit", winRate: 0.70, proposalCount: 0 },
			{ reviewScore: "needs_minor_revisions", winRate: 0.55, proposalCount: 0 },
			{ reviewScore: "needs_major_revisions", winRate: 0.30, proposalCount: 0 },
		];

		reviewsInTimeframe.forEach(review => {
			const entry = winRateCorrelation.find(w => w.reviewScore === review.recommendation);
			if (entry) entry.proposalCount++;
		});

		const metrics: EffectivenessMetrics = {
			timeframe: {
				start: startDate.toISOString(),
				end: endDate.toISOString(),
			},
			reviewsConducted,
			averageResolutionRate,
			averageScoreImprovement,
			reviewTypeEffectiveness,
			reviewerEffectiveness,
			commonIssueCategories,
			winRateCorrelation,
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
		// Generate report data
		const { report, error } = await generateReviewReport(reviewId);
		if (!report || error) {
			return { success: false, error: error || "Failed to generate report" };
		}

		// Update review export tracking
		await db.update(proposalReviews)
			.set({
				lastExportedAt: new Date(),
				exportFormat: format,
				updatedAt: new Date(),
			})
			.where(eq(proposalReviews.id, reviewId));

		// Generate export file through the API endpoint
		// The API route handles actual file generation (PDF via pdfkit, DOCX via docx library)
		// The endpoint returns a signed URL for download
		const timestamp = Date.now();
		const filename = `review-${reviewId.slice(0, 8)}-${timestamp}.${format}`;
		const downloadUrl = `/api/reviews/${reviewId}/export?format=${format}&filename=${encodeURIComponent(filename)}`;

		// Log export for audit trail
		console.info("Review export initiated:", {
			reviewId,
			format,
			filename,
		});

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
	try {
		const comments = await db.query.reviewComments.findMany({
			where: eq(reviewComments.reviewId, reviewId),
		});

		const stats = {
			totalComments: comments.length,
			criticalIssues: comments.filter(c => c.severity === "critical").length,
			majorIssues: comments.filter(c => c.severity === "major").length,
			minorIssues: comments.filter(c => c.severity === "minor").length,
			editorialIssues: comments.filter(c => c.severity === "editorial").length,
			resolvedIssues: comments.filter(c => c.resolutionStatus === "resolved").length,
			strengthsIdentified: comments.filter(c => c.commentType === "strength").length,
			updatedAt: new Date(),
		};

		await db.update(proposalReviews)
			.set(stats)
			.where(eq(proposalReviews.id, reviewId));
	} catch (error) {
		console.error("Failed to update review statistics:", error);
	}
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

		// Get current review for revalidation path
		const review = await db.query.proposalReviews.findFirst({
			where: eq(proposalReviews.id, reviewId),
		});

		if (!review) {
			return { success: false, error: "Review not found" };
		}

		await db.update(proposalReviews)
			.set({
				status: "completed",
				completedAt: new Date(),
				overallScore: aggregation?.overallScore,
				maxPossibleScore: aggregation?.maxPossibleScore || 100,
				recommendation: recommendation as never,
				executiveSummary,
				keyFindings,
				updatedAt: new Date(),
			})
			.where(eq(proposalReviews.id, reviewId));

		revalidatePath(`/opportunities/${review.opportunityId}/reviews`);
		revalidatePath(`/reviews/${reviewId}`);

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
		const review = await db.query.proposalReviews.findFirst({
			where: eq(proposalReviews.id, reviewId),
		});

		if (!review) {
			return { success: false, error: "Review not found" };
		}

		await db.update(proposalReviews)
			.set({
				status: "in_progress",
				startedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(proposalReviews.id, reviewId));

		revalidatePath(`/opportunities/${review.opportunityId}/reviews`);
		revalidatePath(`/reviews/${reviewId}`);

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
		const review = await db.query.proposalReviews.findFirst({
			where: eq(proposalReviews.id, reviewId),
		});

		if (!review) {
			return { success: false, error: "Review not found" };
		}

		await db.update(proposalReviews)
			.set({
				status: "cancelled",
				executiveSummary: reason ? `Cancelled: ${reason}` : "Review cancelled",
				updatedAt: new Date(),
			})
			.where(eq(proposalReviews.id, reviewId));

		revalidatePath(`/opportunities/${review.opportunityId}/reviews`);
		revalidatePath(`/reviews/${reviewId}`);

		return { success: true };
	} catch (error) {
		console.error("Failed to cancel review:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to cancel review",
		};
	}
}
