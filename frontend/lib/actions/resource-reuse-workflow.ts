"use server";

import { db } from "@/lib/db";
import {
	personnel,
	positionRequirements,
	projects,
	projectRelevanceScores,
} from "@/lib/db/schema";
import { requireUserContext } from "@/lib/auth-utils";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";
import { and, eq, sql, type SQL } from "drizzle-orm";

type PersonnelRow = typeof personnel.$inferSelect;
type PositionRow = typeof positionRequirements.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;
type RelevanceRow = typeof projectRelevanceScores.$inferSelect;

export type PersonnelReuseAction = "assign" | "confirm" | "reject" | "release" | "reopen";
export type PastPerformanceReuseAction = "select" | "approve" | "reject" | "deselect" | "reopen";

export interface PersonnelReuseInput {
	positionId: string;
	personnelId?: string | null;
	action: PersonnelReuseAction;
	reason: string;
	assignedTo?: string | null;
	dueAt?: Date | string | null;
}

export interface PastPerformanceReuseInput {
	projectId: string;
	opportunityId: string;
	action: PastPerformanceReuseAction;
	reason: string;
	selectionRank?: number | null;
	assignedTo?: string | null;
	dueAt?: Date | string | null;
}

export interface ResourceReuseWorkflowResult {
	subjectId: string;
	opportunityId: string | null;
	fromState: string;
	toState: string;
	workflowInstanceId: string;
	taskProjected: boolean;
}

const PERSONNEL_WORKFLOW_KEY = "personnel_resource_reuse";
const PERSONNEL_SUBJECT_TYPE = "position_requirement";
const PAST_PERFORMANCE_WORKFLOW_KEY = "past_performance_reuse";
const PAST_PERFORMANCE_SUBJECT_TYPE = "past_performance_project";

function assignedOpportunityExistsSql(opportunityId: unknown, userId: string): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and opportunities.assigned_to = ${userId}
	)`;
}

function visiblePositionCondition(positionId: string, userId: string): SQL {
	return and(
		eq(positionRequirements.id, positionId),
		assignedOpportunityExistsSql(positionRequirements.opportunityId, userId)
	)!;
}

function visiblePersonnelCondition(
	personnelId: string,
	userContext: { organizationId?: string }
): SQL {
	return and(
		eq(personnel.id, personnelId),
		userContext.organizationId ? eq(personnel.organizationId, userContext.organizationId) : sql`false`
	)!;
}

function visibleProjectCondition(
	projectId: string,
	userContext: { organizationId?: string }
): SQL {
	return and(
		eq(projects.id, projectId),
		userContext.organizationId ? eq(projects.organizationId, userContext.organizationId) : sql`false`
	)!;
}

function visibleRelevanceScorePairCondition(projectId: string, opportunityId: string, userId: string): SQL {
	return and(
		eq(projectRelevanceScores.projectId, projectId),
		eq(projectRelevanceScores.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userId)
	)!;
}

export async function transitionPersonnelReuseWorkflow(
	input: PersonnelReuseInput
): Promise<ResourceReuseWorkflowResult> {
	const userContext = await requireUserContext();
	const reason = input.reason.trim();
	if (!reason) {
		throw new Error("Personnel reuse transitions require a reason");
	}

	const [position] = await db
		.select()
		.from(positionRequirements)
		.where(visiblePositionCondition(input.positionId, userContext.userId))
		.limit(1);
	if (!position) {
		throw new Error("Position requirement not found");
	}

	const personnelId = input.personnelId ?? position.assignedPersonnelId ?? null;
	const person = personnelId ? await getPersonnel(personnelId, userContext) : null;
	const transition = buildPersonnelTransition(input, position, person, userContext.userId);
	const fromState = position.assignmentStatus ?? "open";

	const [updatedPosition] = await db
		.update(positionRequirements)
		.set(transition.positionPatch)
		.where(visiblePositionCondition(input.positionId, userContext.userId))
		.returning();
	if (!updatedPosition) {
		throw new Error("Failed to update personnel reuse state");
	}

	if (person && position.opportunityId) {
		await updatePersonnelProposalMembership({
			person,
			userContext,
			opportunityId: position.opportunityId,
			include: transition.includeOpportunity,
		});
	}

	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: PERSONNEL_WORKFLOW_KEY,
		subjectType: PERSONNEL_SUBJECT_TYPE,
		subjectId: input.positionId,
		opportunityId: position.opportunityId ?? null,
		fromState,
		toState: transition.toState,
		eventType: `personnel_${input.action}`,
		actorId: userContext.userId,
		reason,
		priority: priorityForPosition(position),
		assignedTo: input.assignedTo ?? updatedPosition.assignedPersonnelId ?? null,
		assignedRole: transition.terminal ? null : "staffing_manager",
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 3),
		metadata: {
			positionId: input.positionId,
			positionTitle: position.positionTitle,
			positionCategory: position.positionCategory ?? null,
			personnelId: updatedPosition.assignedPersonnelId ?? null,
			matchScore: updatedPosition.matchScore ?? null,
			action: input.action,
		},
		terminal: transition.terminal,
		actionUrl: position.opportunityId
			? `/opportunities/${position.opportunityId}`
			: "/personnel",
	});

	await upsertWorkflowRuntimeTask({
		workflowInstanceId: instance.id,
		taskKey: `personnel-reuse:${input.positionId}`,
		title: transition.taskTitle,
		description: transition.taskDescription,
		state: transition.runtimeTaskState,
		priority: priorityForPosition(position),
		assignedTo: input.assignedTo ?? updatedPosition.assignedPersonnelId ?? null,
		assignedRole: transition.terminal ? null : "staffing_manager",
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 3),
		metadata: {
			positionId: input.positionId,
			opportunityId: position.opportunityId ?? null,
			personnelId: updatedPosition.assignedPersonnelId ?? null,
			assignmentStatus: transition.toState,
		},
	});

	return {
		subjectId: input.positionId,
		opportunityId: position.opportunityId ?? null,
		fromState,
		toState: transition.toState,
		workflowInstanceId: instance.id,
		taskProjected: true,
	};
}

export async function transitionPastPerformanceReuseWorkflow(
	input: PastPerformanceReuseInput
): Promise<ResourceReuseWorkflowResult> {
	const userContext = await requireUserContext();
	const reason = input.reason.trim();
	if (!reason) {
		throw new Error("Past performance reuse transitions require a reason");
	}

	const [project] = await db
		.select()
		.from(projects)
		.where(visibleProjectCondition(input.projectId, userContext))
		.limit(1);
	if (!project) {
		throw new Error("Past performance project not found");
	}

	const [relevance] = await db
		.select()
		.from(projectRelevanceScores)
		.where(visibleRelevanceScorePairCondition(input.projectId, input.opportunityId, userContext.userId))
		.limit(1);
	if (!relevance) {
		throw new Error("Project relevance score not found for opportunity");
	}

	enforceProjectReuseAccess(project, userContext);
	const fromState = pastPerformanceState(relevance);
	const transition = buildPastPerformanceTransition(input, relevance, project, userContext.userId);
	const [updatedRelevance] = await db
		.update(projectRelevanceScores)
		.set(transition.relevancePatch)
		.where(visibleRelevanceScorePairCondition(input.projectId, input.opportunityId, userContext.userId))
		.returning();
	if (!updatedRelevance) {
		throw new Error("Failed to update past performance reuse state");
	}

	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: PAST_PERFORMANCE_WORKFLOW_KEY,
		subjectType: PAST_PERFORMANCE_SUBJECT_TYPE,
		subjectId: input.projectId,
		opportunityId: input.opportunityId,
		fromState,
		toState: transition.toState,
		eventType: `past_performance_${input.action}`,
		actorId: userContext.userId,
		reason,
		priority: priorityForPastPerformance(updatedRelevance),
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : "past_performance_lead",
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 5),
		metadata: {
			projectId: input.projectId,
			projectName: project.name,
			customerName: project.customerName,
			overallScore: updatedRelevance.overallScore,
			selectionRank: updatedRelevance.selectionRank ?? null,
			isSelected: updatedRelevance.isSelected ?? false,
			action: input.action,
		},
		terminal: transition.terminal,
		actionUrl: `/opportunities/${input.opportunityId}`,
	});

	await upsertWorkflowRuntimeTask({
		workflowInstanceId: instance.id,
		taskKey: `past-performance-reuse:${input.opportunityId}:${input.projectId}`,
		title: transition.taskTitle,
		description: transition.taskDescription,
		state: transition.runtimeTaskState,
		priority: priorityForPastPerformance(updatedRelevance),
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : "past_performance_lead",
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 5),
		metadata: {
			projectId: input.projectId,
			opportunityId: input.opportunityId,
			overallScore: updatedRelevance.overallScore,
			selectionRank: updatedRelevance.selectionRank ?? null,
			reuseState: transition.toState,
		},
	});

	return {
		subjectId: input.projectId,
		opportunityId: input.opportunityId,
		fromState,
		toState: transition.toState,
		workflowInstanceId: instance.id,
		taskProjected: true,
	};
}

async function getPersonnel(
	personnelId: string,
	userContext: { organizationId?: string }
): Promise<PersonnelRow> {
	const [person] = await db
		.select()
		.from(personnel)
		.where(visiblePersonnelCondition(personnelId, userContext))
		.limit(1);
	if (!person) {
		throw new Error("Personnel not found");
	}
	return person;
}

function buildPersonnelTransition(
	input: PersonnelReuseInput,
	position: PositionRow,
	person: PersonnelRow | null,
	actorId: string
): {
	toState: string;
	terminal: boolean;
	runtimeTaskState: "open" | "in_progress" | "completed" | "cancelled";
	includeOpportunity: boolean;
	taskTitle: string;
	taskDescription: string;
	positionPatch: Partial<typeof positionRequirements.$inferInsert>;
} {
	const now = new Date();
	switch (input.action) {
		case "assign":
			if (!person) {
				throw new Error("Assigning a position requires personnel");
			}
			return {
				toState: "assigned",
				terminal: false,
				runtimeTaskState: "in_progress",
				includeOpportunity: true,
				taskTitle: "Confirm proposed key personnel assignment",
				taskDescription: `${person.firstName} ${person.lastName} is assigned to ${position.positionTitle}. Reason: ${input.reason.trim()}`,
				positionPatch: {
					assignedPersonnelId: person.id,
					assignmentStatus: "assigned",
					assignmentNotes: input.reason.trim(),
					assignedAt: now,
					assignedBy: actorId,
					updatedAt: now,
				},
			};
		case "confirm":
			if (!person) {
				throw new Error("Confirming a position requires assigned personnel");
			}
			return {
				toState: "confirmed",
				terminal: true,
				runtimeTaskState: "completed",
				includeOpportunity: true,
				taskTitle: "Personnel assignment confirmed",
				taskDescription: `${person.firstName} ${person.lastName} confirmed for ${position.positionTitle}.`,
				positionPatch: {
					assignmentStatus: "confirmed",
					assignmentNotes: input.reason.trim(),
					assignedAt: position.assignedAt ?? now,
					assignedBy: position.assignedBy ?? actorId,
					updatedAt: now,
				},
			};
		case "reject":
			return {
				toState: "rejected",
				terminal: true,
				runtimeTaskState: "cancelled",
				includeOpportunity: false,
				taskTitle: "Personnel assignment rejected",
				taskDescription: `Assignment rejected for ${position.positionTitle}. Reason: ${input.reason.trim()}`,
				positionPatch: {
					assignedPersonnelId: null,
					assignmentStatus: "open",
					assignmentNotes: `Rejected: ${input.reason.trim()}`,
					assignedAt: null,
					assignedBy: null,
					updatedAt: now,
				},
			};
		case "release":
			return {
				toState: "released",
				terminal: true,
				runtimeTaskState: "cancelled",
				includeOpportunity: false,
				taskTitle: "Personnel assignment released",
				taskDescription: `Released assignment for ${position.positionTitle}. Reason: ${input.reason.trim()}`,
				positionPatch: {
					assignedPersonnelId: null,
					assignmentStatus: "open",
					assignmentNotes: `Released: ${input.reason.trim()}`,
					assignedAt: null,
					assignedBy: null,
					updatedAt: now,
				},
			};
		case "reopen":
			return {
				toState: "open",
				terminal: false,
				runtimeTaskState: "open",
				includeOpportunity: false,
				taskTitle: "Reopened personnel assignment",
				taskDescription: `Reopened staffing need for ${position.positionTitle}. Reason: ${input.reason.trim()}`,
				positionPatch: {
					assignedPersonnelId: null,
					assignmentStatus: "open",
					assignmentNotes: input.reason.trim(),
					assignedAt: null,
					assignedBy: null,
					updatedAt: now,
				},
			};
	}
}

function buildPastPerformanceTransition(
	input: PastPerformanceReuseInput,
	relevance: RelevanceRow,
	project: ProjectRow,
	actorId: string
): {
	toState: string;
	terminal: boolean;
	runtimeTaskState: "open" | "in_progress" | "completed" | "cancelled";
	taskTitle: string;
	taskDescription: string;
	relevancePatch: Partial<typeof projectRelevanceScores.$inferInsert>;
} {
	switch (input.action) {
		case "select":
			return {
				toState: "selected",
				terminal: false,
				runtimeTaskState: "in_progress",
				taskTitle: "Validate selected past performance project",
				taskDescription: `${project.name} selected for proposal reuse. Reason: ${input.reason.trim()}`,
				relevancePatch: {
					isSelected: true,
					selectionRank: input.selectionRank ?? relevance.selectionRank ?? null,
					selectionNotes: input.reason.trim(),
					calculatedBy: actorId,
				},
			};
		case "approve":
			if (!relevance.isSelected) {
				throw new Error("Approving past performance reuse requires a selected project");
			}
			return {
				toState: "approved",
				terminal: true,
				runtimeTaskState: "completed",
				taskTitle: "Past performance reuse approved",
				taskDescription: `${project.name} approved for reuse. Reason: ${input.reason.trim()}`,
				relevancePatch: {
					isSelected: true,
					selectionRank: input.selectionRank ?? relevance.selectionRank ?? null,
					selectionNotes: input.reason.trim(),
					calculatedBy: actorId,
				},
			};
		case "reject":
			return {
				toState: "rejected",
				terminal: true,
				runtimeTaskState: "cancelled",
				taskTitle: "Past performance reuse rejected",
				taskDescription: `${project.name} rejected for reuse. Reason: ${input.reason.trim()}`,
				relevancePatch: {
					isSelected: false,
					selectionRank: null,
					selectionNotes: `Rejected: ${input.reason.trim()}`,
					calculatedBy: actorId,
				},
			};
		case "deselect":
			return {
				toState: "deselected",
				terminal: true,
				runtimeTaskState: "cancelled",
				taskTitle: "Past performance reuse deselected",
				taskDescription: `${project.name} removed from reuse set. Reason: ${input.reason.trim()}`,
				relevancePatch: {
					isSelected: false,
					selectionRank: null,
					selectionNotes: `Deselected: ${input.reason.trim()}`,
					calculatedBy: actorId,
				},
			};
		case "reopen":
			return {
				toState: "review",
				terminal: false,
				runtimeTaskState: "open",
				taskTitle: "Reopened past performance reuse review",
				taskDescription: `${project.name} reopened for relevance review. Reason: ${input.reason.trim()}`,
				relevancePatch: {
					isSelected: false,
					selectionRank: null,
					selectionNotes: input.reason.trim(),
					calculatedBy: actorId,
				},
			};
	}
}

async function updatePersonnelProposalMembership(input: {
	person: PersonnelRow;
	userContext: { organizationId?: string };
	opportunityId: string;
	include: boolean;
}) {
	const currentProposals = (input.person.currentProposals ?? []) as string[];
	const next = input.include
		? Array.from(new Set([...currentProposals, input.opportunityId]))
		: currentProposals.filter((id) => id !== input.opportunityId);
	if (next.length === currentProposals.length && next.every((id, index) => id === currentProposals[index])) {
		return;
	}
	await db
		.update(personnel)
		.set({
			currentProposals: next,
			updatedAt: new Date(),
		})
		.where(visiblePersonnelCondition(input.person.id, input.userContext));
}

function enforceProjectReuseAccess(
	project: ProjectRow,
	userContext: { userId: string; organizationId?: string }
) {
	if (
		project.organizationId
		&& userContext.organizationId
		&& String(project.organizationId) !== userContext.organizationId
	) {
		throw new Error("Unauthorized to reuse this past performance project");
	}
}

function pastPerformanceState(relevance: RelevanceRow): string {
	if (relevance.isSelected) return "selected";
	if (relevance.selectionNotes?.startsWith("Rejected:")) return "rejected";
	if (relevance.selectionNotes?.startsWith("Deselected:")) return "deselected";
	return "review";
}

function priorityForPosition(position: PositionRow): "critical" | "high" | "medium" | "low" {
	if (position.positionCategory === "key_personnel") return "high";
	if ((position.matchScore ?? 100) < 70) return "high";
	return "medium";
}

function priorityForPastPerformance(relevance: RelevanceRow): "critical" | "high" | "medium" | "low" {
	if ((relevance.overallScore ?? 0) >= 85) return "medium";
	if ((relevance.gaps ?? []).some((gap) => gap.severity === "critical")) return "high";
	return "medium";
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
