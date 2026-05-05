"use server";

import { requireUserContext } from "@/lib/auth-utils";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";
import { db } from "@/lib/db";
import { opportunities, submissions } from "@/lib/db/schema";
import type { SubmissionAttachment } from "@/lib/types/opportunity";
import { eq } from "drizzle-orm";

type SubmissionRow = typeof submissions.$inferSelect;

export type SubmissionCorrectionAction =
	| "request_correction"
	| "apply_correction"
	| "confirm_receipt"
	| "withdraw";

export interface SubmissionCorrectionWorkflowInput {
	submissionId: string;
	action: SubmissionCorrectionAction;
	reason: string;
	confirmationNumber?: string | null;
	correctedAttachments?: SubmissionAttachment[];
	assignedTo?: string | null;
	dueAt?: Date | string | null;
	authorityRole?: string | null;
}

export interface SubmissionCorrectionWorkflowResult {
	submissionId: string;
	opportunityId: string;
	fromState: string;
	toState: string;
	workflowInstanceId: string;
	taskProjected: boolean;
}

const WORKFLOW_KEY = "submission_correction_compensation";
const SUBJECT_TYPE = "submission";

export async function transitionSubmissionCorrectionWorkflow(
	input: SubmissionCorrectionWorkflowInput
): Promise<SubmissionCorrectionWorkflowResult> {
	const userContext = await requireUserContext();
	const reason = requireReason(input.reason, "Submission correction transitions require a reason");
	const submission = await loadSubmission(input.submissionId);
	const fromState = submission.status;
	const transition = buildTransition({
		input,
		submission,
		actorId: userContext.userId,
		reason,
	});

	const [updatedSubmission] = await db
		.update(submissions)
		.set(transition.submissionPatch)
		.where(eq(submissions.id, input.submissionId))
		.returning();
	if (!updatedSubmission) {
		throw new Error("Failed to update submission correction state");
	}

	if (transition.opportunityDecisionStatus) {
		await db
			.update(opportunities)
			.set({
				decisionStatus: transition.opportunityDecisionStatus,
				decisionReason: transition.opportunityDecisionReason,
				updatedAt: new Date(),
			})
			.where(eq(opportunities.id, updatedSubmission.opportunityId));
	}

	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: WORKFLOW_KEY,
		subjectType: SUBJECT_TYPE,
		subjectId: input.submissionId,
		opportunityId: updatedSubmission.opportunityId,
		fromState,
		toState: transition.toState,
		eventType: `submission_${input.action}`,
		actorId: userContext.userId,
		reason,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : transition.assignedRole,
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 1),
		authorityPolicy: input.authorityRole
			? { requiredRoles: [input.authorityRole] }
			: undefined,
		metadata: {
			submissionId: input.submissionId,
			action: input.action,
			confirmationNumber: updatedSubmission.confirmationNumber ?? null,
			attachmentCount: Array.isArray(updatedSubmission.attachments)
				? updatedSubmission.attachments.length
				: 0,
			authorityRole: input.authorityRole ?? null,
		},
		terminal: transition.terminal,
		actionUrl: `/submissions`,
	});

	await upsertWorkflowRuntimeTask({
		workflowInstanceId: instance.id,
		taskKey: `submission-correction:${input.submissionId}`,
		title: transition.taskTitle,
		description: `${transition.taskTitle}. Reason: ${reason}`,
		state: transition.taskState,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : transition.assignedRole,
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 1),
		metadata: {
			submissionId: input.submissionId,
			fromState,
			toState: transition.toState,
		},
	});

	return {
		submissionId: input.submissionId,
		opportunityId: updatedSubmission.opportunityId,
		fromState,
		toState: transition.toState,
		workflowInstanceId: instance.id,
		taskProjected: true,
	};
}

async function loadSubmission(submissionId: string) {
	const [submission] = await db
		.select()
		.from(submissions)
		.where(eq(submissions.id, submissionId))
		.limit(1);
	if (!submission) {
		throw new Error("Submission not found");
	}
	return submission;
}

function buildTransition(input: {
	input: SubmissionCorrectionWorkflowInput;
	submission: SubmissionRow;
	actorId: string;
	reason: string;
}): {
	toState: string;
	terminal: boolean;
	taskState: "open" | "in_progress" | "blocked" | "completed" | "cancelled";
	taskTitle: string;
	priority: "critical" | "high" | "medium" | "low";
	assignedRole: string;
	submissionPatch: Partial<typeof submissions.$inferInsert>;
	opportunityDecisionStatus?: string;
	opportunityDecisionReason?: string;
} {
	const now = new Date();
	const notes = appendNote(input.submission.notes, `${input.input.action}: ${input.reason}`);
	switch (input.input.action) {
		case "request_correction":
			return {
				toState: "correction_required",
				terminal: false,
				taskState: "blocked",
				taskTitle: "Correct submitted proposal package",
				priority: "critical",
				assignedRole: "proposal_manager",
				submissionPatch: {
					status: "under_review",
					notes,
					updatedAt: now,
				},
				opportunityDecisionStatus: "submitted",
				opportunityDecisionReason: `Submission correction requested: ${input.reason}`,
			};
		case "apply_correction":
			requireAuthority(input.input.authorityRole, "Applying submission correction requires submission authority");
			if (!input.input.confirmationNumber?.trim() && !input.submission.confirmationNumber?.trim()) {
				throw new Error("Applying submission correction requires a confirmation or receipt reference");
			}
			return {
				toState: "corrected_submitted",
				terminal: true,
				taskState: "completed",
				taskTitle: "Corrected submission package recorded",
				priority: "high",
				assignedRole: "proposal_manager",
				submissionPatch: {
					status: "submitted",
					confirmationNumber: input.input.confirmationNumber?.trim() ?? input.submission.confirmationNumber,
					attachments: input.input.correctedAttachments ?? input.submission.attachments,
					notes,
					updatedAt: now,
				},
				opportunityDecisionStatus: "submitted",
				opportunityDecisionReason: `Corrected submission recorded: ${input.reason}`,
			};
		case "confirm_receipt":
			if (!input.input.confirmationNumber?.trim() && !input.submission.confirmationNumber?.trim()) {
				throw new Error("Confirming submission receipt requires a confirmation or receipt reference");
			}
			return {
				toState: "receipt_confirmed",
				terminal: true,
				taskState: "completed",
				taskTitle: "Submission receipt confirmed",
				priority: "medium",
				assignedRole: "proposal_manager",
				submissionPatch: {
					status: "submitted",
					confirmationNumber: input.input.confirmationNumber?.trim() ?? input.submission.confirmationNumber,
					notes,
					updatedAt: now,
				},
				opportunityDecisionStatus: "submitted",
				opportunityDecisionReason: `Submission receipt confirmed: ${input.reason}`,
			};
		case "withdraw":
			requireAuthority(input.input.authorityRole, "Withdrawing a submitted package requires submission authority");
			return {
				toState: "withdrawn",
				terminal: true,
				taskState: "cancelled",
				taskTitle: "Submission package withdrawn",
				priority: "high",
				assignedRole: "proposal_manager",
				submissionPatch: {
					status: "withdrawn",
					outcome: "withdrawn",
					outcomeDate: now,
					outcomeNotes: input.reason,
					notes,
					updatedAt: now,
				},
				opportunityDecisionStatus: "declined",
				opportunityDecisionReason: `Submission withdrawn: ${input.reason}`,
			};
	}
}

function requireReason(value: string | null | undefined, message: string) {
	const reason = value?.trim();
	if (!reason) {
		throw new Error(message);
	}
	return reason;
}

function requireAuthority(value: string | null | undefined, message: string) {
	if (!value?.trim()) {
		throw new Error(message);
	}
}

function appendNote(existing: string | null | undefined, note: string) {
	return [existing?.trim(), note].filter(Boolean).join("\n\n");
}

function normalizeDueAt(value: Date | string | null | undefined, fallbackDays: number) {
	if (value instanceof Date) {
		return value;
	}
	if (typeof value === "string" && value.trim()) {
		return new Date(value);
	}
	const dueAt = new Date();
	dueAt.setDate(dueAt.getDate() + fallbackDays);
	return dueAt;
}
