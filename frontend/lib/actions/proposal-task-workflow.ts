"use server";

import { db } from "@/lib/db";
import { proposalTasks, taskActivity } from "@/lib/db/schema-tasks";
import { requireUserContext } from "@/lib/auth-utils";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";
import { and, eq, sql, type SQL } from "drizzle-orm";

type ProposalTaskRow = typeof proposalTasks.$inferSelect;
type ProposalTaskStatus = "pending" | "assigned" | "in_progress" | "review" | "blocked" | "completed" | "cancelled";

export type ProposalTaskWorkflowAction =
	| "assign"
	| "start"
	| "block"
	| "resume"
	| "submit_review"
	| "complete"
	| "cancel"
	| "reopen";

export interface ProposalTaskWorkflowInput {
	taskId: string;
	action: ProposalTaskWorkflowAction;
	reason: string;
	assignedTo?: string | null;
	assignedToEmail?: string | null;
	blocker?: string;
	progress?: number;
	evidenceLinks?: string[];
}

export interface ProposalTaskWorkflowResult {
	taskId: string;
	opportunityId: string;
	fromState: string;
	toState: ProposalTaskStatus;
	workflowInstanceId: string;
	runtimeTaskState: "open" | "in_progress" | "blocked" | "completed" | "cancelled";
}

const WORKFLOW_KEY = "proposal_task_lifecycle";
const SUBJECT_TYPE = "proposal_task";

function assignedOpportunityExistsSql(opportunityId: unknown, userId: string): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and opportunities.assigned_to = ${userId}
	)`;
}

function visibleProposalTaskCondition(taskId: string, organizationId: string, userId: string): SQL {
	return and(
		eq(proposalTasks.organizationId, organizationId),
		eq(proposalTasks.id, taskId),
		assignedOpportunityExistsSql(proposalTasks.opportunityId, userId)
	)!;
}

export async function transitionProposalTaskWorkflow(
	input: ProposalTaskWorkflowInput
): Promise<ProposalTaskWorkflowResult> {
	const userContext = await requireUserContext();
	if (!userContext.organizationId) {
		throw new Error("Organization context required");
	}
	const reason = input.reason.trim();
	if (!reason) {
		throw new Error("Task workflow transitions require a reason");
	}

	const [task] = await db
		.select()
		.from(proposalTasks)
		.where(visibleProposalTaskCondition(input.taskId, userContext.organizationId, userContext.userId))
		.limit(1);
	if (!task) {
		throw new Error("Task not found");
	}

	const fromState = normalizeTaskStatus(task.status);
	const transition = buildTaskTransition(input, task, fromState, userContext.userId);
	const [updated] = await db
		.update(proposalTasks)
		.set(transition.patch)
		.where(visibleProposalTaskCondition(input.taskId, userContext.organizationId, userContext.userId))
		.returning();
	if (!updated) {
		throw new Error("Failed to update task workflow state");
	}

	await db.insert(taskActivity).values({
		taskId: input.taskId,
		activityType: `workflow_${input.action}`,
		description: reason,
		previousValue: fromState,
		newValue: transition.toState,
		changeField: "status",
		userId: userContext.userId,
		userName: userContext.userId,
		metadata: {
			action: input.action,
			blocker: input.blocker ?? null,
			evidenceLinks: input.evidenceLinks ?? [],
		},
	});

	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: WORKFLOW_KEY,
		subjectType: SUBJECT_TYPE,
		subjectId: input.taskId,
		opportunityId: updated.opportunityId,
		fromState,
		toState: transition.toState,
		eventType: `task_${input.action}`,
		actorId: userContext.userId,
		reason,
		evidenceLinks: input.evidenceLinks ?? [],
		priority: priorityForTask(updated),
		assignedTo: updated.assignedTo ?? null,
		assignedRole: transition.terminal ? null : roleForTask(updated),
		dueAt: transition.terminal ? null : updated.dueDate,
		metadata: {
			taskNumber: updated.taskNumber ?? null,
			taskType: updated.taskType,
			taskCategory: updated.taskCategory ?? null,
			progress: updated.progress ?? 0,
			blockedBy: updated.blockedBy ?? [],
		},
		terminal: transition.terminal,
		actionUrl: `/tasks`,
	});

	const runtimeTaskState = runtimeStateForTaskStatus(transition.toState);
	await upsertWorkflowRuntimeTask({
		workflowInstanceId: instance.id,
		taskKey: `proposal-task:${input.taskId}`,
		title: updated.title,
		description: updated.description ?? undefined,
		state: runtimeTaskState,
		priority: priorityForTask(updated),
		assignedTo: updated.assignedTo ?? null,
		assignedRole: transition.terminal ? null : roleForTask(updated),
		dueAt: transition.terminal ? null : updated.dueDate,
		metadata: {
			taskId: input.taskId,
			opportunityId: updated.opportunityId,
			status: transition.toState,
			progress: updated.progress ?? 0,
		},
	});

	return {
		taskId: updated.id,
		opportunityId: updated.opportunityId,
		fromState,
		toState: transition.toState,
		workflowInstanceId: instance.id,
		runtimeTaskState,
	};
}

function buildTaskTransition(
	input: ProposalTaskWorkflowInput,
	task: ProposalTaskRow,
	fromState: ProposalTaskStatus,
	actorId: string
): {
	toState: ProposalTaskStatus;
	terminal: boolean;
	patch: Partial<typeof proposalTasks.$inferInsert>;
} {
	const now = new Date();
	switch (input.action) {
		case "assign": {
			const assignedTo = input.assignedTo?.trim();
			if (!assignedTo) throw new Error("Assigning a task requires an assignee");
			ensureNotTerminal(fromState);
			return {
				toState: "assigned",
				terminal: false,
				patch: {
					assignedTo,
					assignedToEmail: input.assignedToEmail ?? null,
					assignedBy: actorId,
					assignedAt: now,
					status: "assigned",
					updatedAt: now,
				},
			};
		}
		case "start":
			ensureTransition(fromState, ["pending", "assigned", "blocked"], "Only pending, assigned, or blocked tasks can be started");
			return {
				toState: "in_progress",
				terminal: false,
				patch: {
					status: "in_progress",
					progress: Math.max(task.progress ?? 0, input.progress ?? 1),
					blockedBy: [],
					updatedAt: now,
				},
			};
		case "block": {
			const blocker = input.blocker?.trim() || input.reason.trim();
			ensureTransition(fromState, ["pending", "assigned", "in_progress", "review"], "Terminal tasks must be reopened before blocking");
			return {
				toState: "blocked",
				terminal: false,
				patch: {
					status: "blocked",
					blockedBy: mergeBlockers(task.blockedBy ?? [], blocker),
					updatedAt: now,
				},
			};
		}
		case "resume":
			ensureTransition(fromState, ["blocked"], "Only blocked tasks can be resumed");
			return {
				toState: "in_progress",
				terminal: false,
				patch: {
					status: "in_progress",
					blockedBy: [],
					progress: Math.max(task.progress ?? 0, input.progress ?? 1),
					updatedAt: now,
				},
			};
		case "submit_review":
			ensureTransition(fromState, ["in_progress"], "Only in-progress tasks can be submitted for review");
			return {
				toState: "review",
				terminal: false,
				patch: {
					status: "review",
					progress: Math.max(task.progress ?? 0, input.progress ?? 90),
					updatedAt: now,
				},
			};
		case "complete":
			ensureTransition(fromState, ["in_progress", "review"], "Only in-progress or review tasks can be completed");
			return {
				toState: "completed",
				terminal: true,
				patch: {
					status: "completed",
					progress: 100,
					completedAt: now,
					completedBy: actorId,
					blockedBy: [],
					updatedAt: now,
				},
			};
		case "cancel":
			ensureNotTerminal(fromState);
			return {
				toState: "cancelled",
				terminal: true,
				patch: {
					status: "cancelled",
					completedAt: now,
					completedBy: actorId,
					updatedAt: now,
				},
			};
		case "reopen":
			ensureTransition(fromState, ["completed", "cancelled"], "Only completed or cancelled tasks can be reopened");
			return {
				toState: task.assignedTo ? "assigned" : "pending",
				terminal: false,
				patch: {
					status: task.assignedTo ? "assigned" : "pending",
					completedAt: null,
					completedBy: null,
					progress: Math.min(task.progress ?? 0, 90),
					updatedAt: now,
				},
			};
		default:
			input.action satisfies never;
			throw new Error("Unsupported task workflow action");
	}
}

function normalizeTaskStatus(status: string | null): ProposalTaskStatus {
	if (
		status === "assigned" ||
		status === "in_progress" ||
		status === "review" ||
		status === "blocked" ||
		status === "completed" ||
		status === "cancelled"
	) {
		return status;
	}
	return "pending";
}

function ensureTransition(actual: ProposalTaskStatus, allowed: ProposalTaskStatus[], message: string) {
	if (!allowed.includes(actual)) throw new Error(message);
}

function ensureNotTerminal(status: ProposalTaskStatus) {
	if (status === "completed" || status === "cancelled") {
		throw new Error("Terminal tasks must be reopened before this transition");
	}
}

function mergeBlockers(existing: string[], blocker: string): string[] {
	return Array.from(new Set([...existing, blocker].filter(Boolean)));
}

function priorityForTask(task: ProposalTaskRow): "critical" | "high" | "medium" | "low" {
	if (task.priority === "critical" || task.priority === "high" || task.priority === "low") {
		return task.priority;
	}
	return "medium";
}

function roleForTask(task: ProposalTaskRow): string {
	if (task.taskType === "review") return "reviewer";
	if (task.taskType === "approval") return "approver";
	return "proposal_writer";
}

function runtimeStateForTaskStatus(
	status: ProposalTaskStatus
): "open" | "in_progress" | "blocked" | "completed" | "cancelled" {
	if (status === "completed") return "completed";
	if (status === "cancelled") return "cancelled";
	if (status === "blocked") return "blocked";
	if (status === "in_progress" || status === "review") return "in_progress";
	return "open";
}
