"use server";

import { db } from "@/lib/db";
import {
	proposalReviews,
	reviewComments,
	reviewers,
} from "@/lib/db/schema-reviews";
import {
	assertUserHasAuthorityRole,
	requireUserContext,
	type UserContext,
} from "@/lib/auth-utils";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";
import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";

type ProposalReviewRow = typeof proposalReviews.$inferSelect;
type ReviewerRow = typeof reviewers.$inferSelect;
type ReviewCommentRow = typeof reviewComments.$inferSelect;
type ReviewPackageUserContext = UserContext & { organizationId: string };

export type ReviewPackageAction =
	| "freeze_package"
	| "start_review"
	| "complete_reviewer"
	| "approve_package"
	| "reject_package"
	| "waive_findings"
	| "reopen";

export interface ReviewPackageWorkflowInput {
	reviewId: string;
	action: ReviewPackageAction;
	reason: string;
	reviewerId?: string | null;
	documentSnapshot?: string | null;
	documentVersionId?: string | null;
	executiveSummary?: string | null;
	keyFindings?: {
		strengths: string[];
		weaknesses: string[];
		criticalIssues: string[];
		recommendations: string[];
	};
	minCompletedReviewers?: number;
	authorityRole?: string | null;
	assignedTo?: string | null;
	dueAt?: Date | string | null;
}

export interface ReviewPackageWorkflowResult {
	reviewId: string;
	opportunityId: string;
	fromState: string;
	toState: string;
	workflowInstanceId: string;
	taskProjected: boolean;
}

const WORKFLOW_KEY = "review_package_gate";
const SUBJECT_TYPE = "proposal_review";

function assignedReviewExistsSql(reviewId: unknown, userContext: ReviewPackageUserContext): SQL {
	return sql`exists (
		select 1
		from proposal_reviews
		join opportunities on opportunities.id = proposal_reviews.opportunity_id
		where proposal_reviews.id = ${reviewId}
			and (proposal_reviews.organization_id = ${userContext.organizationId} or proposal_reviews.organization_id is null)
			and (
				opportunities.organization_id = ${userContext.organizationId}
				or opportunities.organization_id is null
			)
			and opportunities.assigned_to = ${userContext.userId}
	)`;
}

function reviewOrganizationCondition(organizationId: string): SQL {
	return or(
		eq(proposalReviews.organizationId, organizationId),
		isNull(proposalReviews.organizationId)
	)!;
}

function commentOrganizationCondition(organizationId: string): SQL {
	return or(
		eq(reviewComments.organizationId, organizationId),
		isNull(reviewComments.organizationId)
	)!;
}

function visibleReviewCondition(reviewId: string, userContext: ReviewPackageUserContext): SQL {
	return and(
		eq(proposalReviews.id, reviewId),
		reviewOrganizationCondition(userContext.organizationId),
		assignedReviewExistsSql(reviewId, userContext)
	)!;
}

function visibleReviewersForReviewCondition(reviewId: string, userContext: ReviewPackageUserContext): SQL {
	return and(
		eq(reviewers.reviewId, reviewId),
		assignedReviewExistsSql(reviewId, userContext)
	)!;
}

function visibleCommentsForReviewCondition(reviewId: string, userContext: ReviewPackageUserContext): SQL {
	return and(
		eq(reviewComments.reviewId, reviewId),
		commentOrganizationCondition(userContext.organizationId),
		assignedReviewExistsSql(reviewId, userContext)
	)!;
}

function visibleReviewerCondition(reviewerId: string, reviewId: string, userContext: ReviewPackageUserContext): SQL {
	return and(
		eq(reviewers.id, reviewerId),
		assignedReviewExistsSql(reviewId, userContext)
	)!;
}

export async function transitionReviewPackageWorkflow(
	input: ReviewPackageWorkflowInput
): Promise<ReviewPackageWorkflowResult> {
	const userContext = await requireUserContext();
	requireReviewPackageTenantContext(userContext);
	const reason = requireReason(input.reason, "Review package transitions require a reason");
	const [review] = await db
		.select()
		.from(proposalReviews)
		.where(visibleReviewCondition(input.reviewId, userContext))
		.limit(1);
	if (!review) {
		throw new Error("Review package not found");
	}

	const [assignedReviewers, comments] = await Promise.all([
		db.select().from(reviewers).where(visibleReviewersForReviewCondition(input.reviewId, userContext)),
		db.select().from(reviewComments).where(visibleCommentsForReviewCondition(input.reviewId, userContext)),
	]);
	const reviewer = input.reviewerId
		? assignedReviewers.find((candidate) => candidate.id === input.reviewerId) ?? null
		: null;
	if (input.action === "complete_reviewer" && !reviewer) {
		throw new Error("Reviewer assignment not found");
	}

	const fromState = review.status ?? "draft";
	const transition = buildReviewPackageTransition({
		input,
		review,
		reviewer,
		assignedReviewers,
		comments,
		actor: userContext,
	});

	const [updatedReview] = transition.reviewPatch
		? await db
			.update(proposalReviews)
			.set(transition.reviewPatch)
			.where(visibleReviewCondition(input.reviewId, userContext))
			.returning()
		: [review];
	if (!updatedReview) {
		throw new Error("Failed to update review package state");
	}

	if (reviewer && transition.reviewerPatch) {
		await db
			.update(reviewers)
			.set(transition.reviewerPatch)
			.where(visibleReviewerCondition(reviewer.id, input.reviewId, userContext));
	}

	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: WORKFLOW_KEY,
		organizationId: userContext.organizationId,
		subjectType: SUBJECT_TYPE,
		subjectId: input.reviewId,
		opportunityId: updatedReview.opportunityId,
		fromState,
		toState: transition.toState,
		eventType: `review_package_${input.action}`,
		actorId: userContext.userId,
		reason,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? reviewer?.userId ?? null,
		assignedRole: transition.terminal ? null : transition.assignedRole,
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt ?? updatedReview.scheduledEndDate, 2),
		metadata: {
			reviewId: input.reviewId,
			organizationId: userContext.organizationId,
			reviewType: updatedReview.reviewType,
			reviewName: updatedReview.reviewName ?? null,
			reviewerId: reviewer?.id ?? null,
			reviewerUserId: reviewer?.userId ?? null,
			completedReviewerCount: completedReviewerCount(assignedReviewers, reviewer?.id),
			openCriticalCommentCount: openCriticalCommentCount(comments),
			action: input.action,
			authorityRole: input.authorityRole ?? null,
		},
		terminal: transition.terminal,
		actionUrl: `/reviews`,
	});

	await upsertWorkflowRuntimeTask({
		workflowInstanceId: instance.id,
		taskKey: `review-package:${input.reviewId}`,
		title: transition.taskTitle,
		description: `${transition.taskTitle}. Reason: ${reason}`,
		state: transition.taskState,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? reviewer?.userId ?? null,
		assignedRole: transition.terminal ? null : transition.assignedRole,
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt ?? updatedReview.scheduledEndDate, 2),
		metadata: {
			reviewId: input.reviewId,
			organizationId: userContext.organizationId,
			fromState,
			toState: transition.toState,
			reviewerId: reviewer?.id ?? null,
		},
	});

	return {
		reviewId: input.reviewId,
		opportunityId: updatedReview.opportunityId,
		fromState,
		toState: transition.toState,
		workflowInstanceId: instance.id,
		taskProjected: true,
	};
}

function requireReviewPackageTenantContext(userContext: UserContext): asserts userContext is ReviewPackageUserContext {
	if (!userContext.organizationId) {
		throw new Error("No organization context");
	}
}

function buildReviewPackageTransition(input: {
	input: ReviewPackageWorkflowInput;
	review: ProposalReviewRow;
	reviewer: ReviewerRow | null;
	assignedReviewers: ReviewerRow[];
	comments: ReviewCommentRow[];
	actor: UserContext;
}): {
	toState: string;
	terminal: boolean;
	taskState: "open" | "in_progress" | "blocked" | "completed" | "cancelled";
	taskTitle: string;
	priority: "critical" | "high" | "medium" | "low";
	assignedRole: string;
	reviewPatch?: Partial<typeof proposalReviews.$inferInsert>;
	reviewerPatch?: Partial<typeof reviewers.$inferInsert>;
} {
	const now = new Date();
	const reason = input.input.reason.trim();
	switch (input.input.action) {
		case "freeze_package": {
			const snapshot = input.input.documentSnapshot?.trim() || input.review.documentSnapshot;
			if (!snapshot) {
				throw new Error("Freezing a review package requires a document snapshot");
			}
			return {
				toState: "scheduled",
				terminal: false,
				taskState: "open",
				taskTitle: "Complete frozen review package",
				priority: "high",
				assignedRole: "review_lead",
				reviewPatch: {
					status: "scheduled",
					documentSnapshot: snapshot,
					documentVersionId: input.input.documentVersionId ?? input.review.documentVersionId ?? null,
					reviewInstructions: appendNote(input.review.reviewInstructions, `Package frozen: ${reason}`),
					updatedAt: now,
				},
			};
		}
		case "start_review":
			enforceReviewStatus(input.review, ["scheduled", "draft"], "Only draft or scheduled review packages can be started");
			return {
				toState: "in_progress",
				terminal: false,
				taskState: "in_progress",
				taskTitle: "Review package in progress",
				priority: "high",
				assignedRole: "reviewer",
				reviewPatch: {
					status: "in_progress",
					startedAt: input.review.startedAt ?? now,
					updatedAt: now,
				},
			};
		case "complete_reviewer":
			return {
				toState: "reviewer_completed",
				terminal: false,
				taskState: allReviewersComplete(input.assignedReviewers, input.reviewer?.id) ? "open" : "in_progress",
				taskTitle: "Reviewer package completed",
				priority: "medium",
				assignedRole: "review_lead",
				reviewerPatch: {
					status: "completed",
					completedAt: now,
					updatedAt: now,
				},
			};
		case "approve_package":
			enforceQuorum(input.assignedReviewers, input.input.minCompletedReviewers ?? 2);
			if (openCriticalCommentCount(input.comments) > 0) {
				throw new Error("Review package cannot be approved with unresolved critical comments");
			}
			return {
				toState: "approved",
				terminal: true,
				taskState: "completed",
				taskTitle: "Review package approved",
				priority: "low",
				assignedRole: "review_lead",
				reviewPatch: {
					status: "completed",
					completedAt: now,
					recommendation: "ready_to_submit",
					executiveSummary: input.input.executiveSummary ?? input.review.executiveSummary,
					keyFindings: input.input.keyFindings ?? input.review.keyFindings,
					updatedAt: now,
				},
			};
		case "reject_package":
			enforceQuorum(input.assignedReviewers, input.input.minCompletedReviewers ?? 1);
			return {
				toState: "rejected",
				terminal: true,
				taskState: "completed",
				taskTitle: "Review package rejected for revision",
				priority: "high",
				assignedRole: "review_lead",
				reviewPatch: {
					status: "completed",
					completedAt: now,
					recommendation: "needs_major_revisions",
					executiveSummary: input.input.executiveSummary ?? reason,
					keyFindings: input.input.keyFindings ?? input.review.keyFindings,
					updatedAt: now,
				},
			};
		case "waive_findings":
			requireAuthority(input.actor, input.input.authorityRole, "Waiving review findings requires an authority role");
			return {
				toState: "waived",
				terminal: true,
				taskState: "completed",
				taskTitle: "Review findings waived by authority",
				priority: "medium",
				assignedRole: "review_lead",
				reviewPatch: {
					status: "completed",
					completedAt: now,
					recommendation: "needs_minor_revisions",
					executiveSummary: input.input.executiveSummary ?? `Waived by ${input.input.authorityRole}: ${reason}`,
					keyFindings: input.input.keyFindings ?? input.review.keyFindings,
					updatedAt: now,
				},
			};
		case "reopen":
			return {
				toState: "in_progress",
				terminal: false,
				taskState: "open",
				taskTitle: "Reopened review package",
				priority: "high",
				assignedRole: "review_lead",
				reviewPatch: {
					status: "in_progress",
					completedAt: null,
					recommendation: null,
					executiveSummary: appendNote(input.review.executiveSummary, `Reopened: ${reason}`),
					updatedAt: now,
				},
			};
	}
}

function enforceReviewStatus(
	review: ProposalReviewRow,
	allowed: Array<ProposalReviewRow["status"]>,
	message: string
) {
	if (!allowed.includes(review.status)) {
		throw new Error(message);
	}
}

function enforceQuorum(assignedReviewers: ReviewerRow[], minCompletedReviewers: number) {
	const completed = assignedReviewers.filter((reviewer) => reviewer.status === "completed").length;
	if (completed < minCompletedReviewers) {
		throw new Error(`Review package requires at least ${minCompletedReviewers} completed reviewers`);
	}
}

function openCriticalCommentCount(comments: ReviewCommentRow[]): number {
	return comments.filter((comment) =>
		comment.severity === "critical"
		&& !["resolved", "wont_fix", "duplicate"].includes(comment.resolutionStatus ?? "open")
	).length;
}

function completedReviewerCount(reviewersList: ReviewerRow[], justCompletedReviewerId?: string): number {
	return reviewersList.filter((reviewer) =>
		reviewer.status === "completed" || reviewer.id === justCompletedReviewerId
	).length;
}

function allReviewersComplete(reviewersList: ReviewerRow[], justCompletedReviewerId?: string): boolean {
	return reviewersList.length > 0
		&& completedReviewerCount(reviewersList, justCompletedReviewerId) === reviewersList.length;
}

function appendNote(existing: string | null, note: string): string {
	return [existing, note].filter(Boolean).join("\n");
}

function requireReason(value: string, message: string): string {
	const reason = value.trim();
	if (!reason) {
		throw new Error(message);
	}
	return reason;
}

function requireAuthority(
	actor: UserContext,
	value: string | null | undefined,
	message: string
): string {
	return assertUserHasAuthorityRole(actor, value, message);
}

function normalizeDueAt(value: Date | string | null | undefined, defaultDays: number): Date {
	if (value) {
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) {
			throw new Error("Due date is invalid");
		}
		return parsed;
	}
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + defaultDays);
	return date;
}
