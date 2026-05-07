"use server";

import { db } from "@/lib/db";
import { proposalReviews, reviewComments } from "@/lib/db/schema-reviews";
import { proposalTasks, taskActivity } from "@/lib/db/schema-tasks";
import { requireUserContext } from "@/lib/auth-utils";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";
import { and, eq } from "drizzle-orm";

type ReviewCommentRow = typeof reviewComments.$inferSelect;
type ProposalTaskRow = typeof proposalTasks.$inferSelect;

export type ReviewCommentWorkflowAction = "project_task" | "start_resolution" | "resolve" | "reopen";

export interface ReviewCommentWorkflowInput {
	commentId: string;
	action: ReviewCommentWorkflowAction;
	reason: string;
	assignedTo?: string | null;
	assignedToEmail?: string | null;
	dueAt?: Date | string | null;
	resolutionAction?: "revised" | "clarified" | "removed" | "kept";
}

export interface ReviewCommentWorkflowResult {
	commentId: string;
	opportunityId: string;
	fromState: string;
	toState: string;
	taskId: string | null;
	workflowInstanceId: string;
}

const WORKFLOW_KEY = "review_comment_resolution";
const SUBJECT_TYPE = "review_comment";

export async function transitionReviewCommentWorkflow(
	input: ReviewCommentWorkflowInput
): Promise<ReviewCommentWorkflowResult> {
	const userContext = await requireUserContext();
	const reason = input.reason.trim();
	if (!reason) {
		throw new Error("Review comment workflow transitions require a reason");
	}

	const [comment] = await db
		.select()
		.from(reviewComments)
		.where(eq(reviewComments.id, input.commentId))
		.limit(1);
	if (!comment) {
		throw new Error("Review comment not found");
	}
	const [review] = await db
		.select({ opportunityId: proposalReviews.opportunityId })
		.from(proposalReviews)
		.where(eq(proposalReviews.id, comment.reviewId))
		.limit(1);
	if (!review?.opportunityId) {
		throw new Error("Review comment is not linked to an opportunity");
	}

	const [existingTask] = await db
		.select()
		.from(proposalTasks)
		.where(and(
			eq(proposalTasks.sourceType, "review_comment"),
			eq(proposalTasks.sourceId, input.commentId)
		))
		.limit(1);

	const fromState = comment.resolutionStatus ?? "open";
	const transition = buildCommentTransition(input, comment, existingTask ?? null, userContext.userId);
	const [updatedComment] = await db
		.update(reviewComments)
		.set(transition.commentPatch)
		.where(eq(reviewComments.id, input.commentId))
		.returning();
	if (!updatedComment) {
		throw new Error("Failed to update review comment workflow state");
	}

	const task = await upsertCommentTask({
		comment: updatedComment,
		existingTask: existingTask ?? null,
		opportunityId: review.opportunityId,
		input,
		status: transition.taskStatus,
		actorId: userContext.userId,
	});

	if (task) {
		await db.insert(taskActivity).values({
			taskId: task.id,
			activityType: `review_comment_${input.action}`,
			description: reason,
			previousValue: existingTask?.status ?? null,
			newValue: transition.taskStatus,
			changeField: "status",
			userId: userContext.userId,
			userName: userContext.userId,
			metadata: {
				commentId: input.commentId,
				reviewId: comment.reviewId,
				resolutionStatus: transition.toState,
			},
		});
	}

	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: WORKFLOW_KEY,
		subjectType: SUBJECT_TYPE,
		subjectId: input.commentId,
		opportunityId: review.opportunityId,
		fromState,
		toState: transition.toState,
		eventType: `review_comment_${input.action}`,
		actorId: userContext.userId,
		reason,
		priority: priorityForComment(comment),
		assignedTo: task?.assignedTo ?? input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : "proposal_writer",
		dueAt: transition.terminal ? null : task?.dueDate ?? normalizeDueAt(input.dueAt, comment),
		metadata: {
			reviewId: comment.reviewId,
			taskId: task?.id ?? null,
			commentType: comment.commentType,
			severity: comment.severity ?? null,
			sectionId: comment.sectionId ?? null,
			resolutionAction: input.resolutionAction ?? null,
		},
		terminal: transition.terminal,
		actionUrl: `/reviews/${comment.reviewId}`,
	});

	if (task) {
		await upsertWorkflowRuntimeTask({
			workflowInstanceId: instance.id,
			taskKey: `review-comment:${input.commentId}`,
			title: task.title,
			description: task.description ?? undefined,
			state: runtimeStateForTaskStatus(transition.taskStatus),
			priority: priorityForComment(comment),
			assignedTo: task.assignedTo ?? null,
			assignedRole: transition.terminal ? null : "proposal_writer",
			dueAt: transition.terminal ? null : task.dueDate,
			metadata: {
				commentId: input.commentId,
				reviewId: comment.reviewId,
				taskId: task.id,
			},
		});
	}

	return {
		commentId: updatedComment.id,
		opportunityId: review.opportunityId,
		fromState,
		toState: transition.toState,
		taskId: task?.id ?? null,
		workflowInstanceId: instance.id,
	};
}

function buildCommentTransition(
	input: ReviewCommentWorkflowInput,
	comment: ReviewCommentRow,
	existingTask: ProposalTaskRow | null,
	actorId: string
): {
	toState: string;
	terminal: boolean;
	taskStatus: "pending" | "assigned" | "in_progress" | "completed";
	commentPatch: Partial<typeof reviewComments.$inferInsert>;
} {
	const now = new Date();
	switch (input.action) {
		case "project_task":
			ensureOpenComment(comment);
			return {
				toState: "open",
				terminal: false,
				taskStatus: input.assignedTo || existingTask?.assignedTo ? "assigned" : "pending",
				commentPatch: {
					resolutionStatus: "open",
					updatedAt: now,
				},
			};
		case "start_resolution":
			ensureOpenComment(comment);
			return {
				toState: "in_progress",
				terminal: false,
				taskStatus: "in_progress",
				commentPatch: {
					resolutionStatus: "in_progress",
					resolutionNotes: input.reason.trim(),
					updatedAt: now,
				},
			};
		case "resolve": {
			const resolutionAction = input.resolutionAction;
			if (!resolutionAction) {
				throw new Error("Resolving a review comment requires a resolution action");
			}
			return {
				toState: "resolved",
				terminal: true,
				taskStatus: "completed",
				commentPatch: {
					resolutionStatus: "resolved",
					resolutionAction,
					resolutionNotes: input.reason.trim(),
					resolvedBy: actorId,
					resolvedAt: now,
					updatedAt: now,
				},
			};
		}
		case "reopen":
			return {
				toState: "open",
				terminal: false,
				taskStatus: input.assignedTo || existingTask?.assignedTo ? "assigned" : "pending",
				commentPatch: {
					resolutionStatus: "open",
					resolutionNotes: input.reason.trim(),
					resolutionAction: null,
					resolvedBy: null,
					resolvedAt: null,
					verifiedBy: null,
					verifiedAt: null,
					verificationNotes: null,
					updatedAt: now,
				},
			};
		default:
			input.action satisfies never;
			throw new Error("Unsupported review comment workflow action");
	}
}

async function upsertCommentTask(input: {
	comment: ReviewCommentRow;
	existingTask: ProposalTaskRow | null;
	opportunityId: string;
	input: ReviewCommentWorkflowInput;
	status: "pending" | "assigned" | "in_progress" | "completed";
	actorId: string;
}): Promise<ProposalTaskRow | null> {
	const now = new Date();
	const assignedTo = input.input.assignedTo ?? input.existingTask?.assignedTo ?? null;
	const taskPatch = {
		title: input.comment.title ?? `Resolve review comment ${input.comment.id.slice(0, 8)}`,
		description: input.comment.comment,
		taskType: "review",
		taskCategory: input.comment.category ?? "review",
		sectionId: input.comment.sectionId ?? null,
		volumeId: input.comment.volumeId ?? null,
		assignedTo,
		assignedToEmail: input.input.assignedToEmail ?? input.existingTask?.assignedToEmail ?? null,
		assignedBy: assignedTo ? input.actorId : input.existingTask?.assignedBy ?? null,
		assignedAt: assignedTo ? input.existingTask?.assignedAt ?? now : null,
		dueDate: input.status === "completed" ? null : normalizeDueAt(input.input.dueAt, input.comment),
		status: input.status,
		priority: priorityForComment(input.comment),
		progress: input.status === "completed" ? 100 : input.status === "in_progress" ? Math.max(input.existingTask?.progress ?? 0, 25) : input.existingTask?.progress ?? 0,
		completedAt: input.status === "completed" ? now : null,
		completedBy: input.status === "completed" ? input.actorId : null,
		sourceType: "review_comment",
		sourceId: input.comment.id,
		updatedAt: now,
	};

	if (input.existingTask) {
		const [updated] = await db
			.update(proposalTasks)
			.set(taskPatch)
			.where(eq(proposalTasks.id, input.existingTask.id))
			.returning();
		return updated ?? null;
	}

	const [created] = await db
		.insert(proposalTasks)
		.values({
			opportunityId: input.opportunityId,
			taskNumber: `RC-${input.comment.id.slice(0, 8)}`,
			createdBy: input.actorId,
			...taskPatch,
		})
		.returning();
	return created ?? null;
}

function ensureOpenComment(comment: ReviewCommentRow) {
	if (comment.resolutionStatus === "resolved") {
		throw new Error("Resolved comments must be reopened before more resolution work can be projected");
	}
}

function priorityForComment(comment: ReviewCommentRow): "critical" | "high" | "medium" | "low" {
	if (comment.severity === "critical") return "critical";
	if (comment.severity === "major") return "high";
	if (comment.severity === "editorial") return "low";
	return "medium";
}

function normalizeDueAt(inputDueAt: Date | string | null | undefined, comment: ReviewCommentRow): Date {
	if (inputDueAt instanceof Date) return inputDueAt;
	if (typeof inputDueAt === "string" && inputDueAt.trim()) return new Date(inputDueAt);
	const dueAt = new Date();
	dueAt.setUTCDate(dueAt.getUTCDate() + (comment.severity === "critical" ? 1 : 3));
	return dueAt;
}

function runtimeStateForTaskStatus(
	status: "pending" | "assigned" | "in_progress" | "completed"
): "open" | "in_progress" | "completed" {
	if (status === "completed") return "completed";
	if (status === "in_progress") return "in_progress";
	return "open";
}
