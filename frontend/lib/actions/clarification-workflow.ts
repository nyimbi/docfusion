"use server";

import { db } from "@/lib/db";
import { rfpRequirements } from "@/lib/db/schema-rfp";
import { requireUserContext, userHasAuthorityRole, type UserContext } from "@/lib/auth-utils";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";
import { and, eq, sql, type SQL } from "drizzle-orm";

type RequirementRow = typeof rfpRequirements.$inferSelect;

export type ClarificationWorkflowAction =
	| "draft"
	| "request_approval"
	| "approve"
	| "submit"
	| "record_answer"
	| "incorporate"
	| "reopen";

export type ClarificationWorkflowState =
	| "drafted"
	| "approval_requested"
	| "approved"
	| "submitted"
	| "answered"
	| "incorporated";

export interface ClarificationWorkflowInput {
	requirementId: string;
	action: ClarificationWorkflowAction;
	reason: string;
	question?: string;
	answer?: string;
	submissionReference?: string;
	assignedTo?: string | null;
	dueAt?: Date | string | null;
}

export interface ClarificationWorkflowResult {
	requirementId: string;
	opportunityId: string | null;
	fromState: ClarificationWorkflowState;
	toState: ClarificationWorkflowState;
	questionCount: number;
	workflowInstanceId: string;
	taskProjected: boolean;
}

interface ClarificationRecord {
	id: string;
	question: string;
	answer?: string;
	submissionReference?: string;
	status: ClarificationWorkflowState;
	createdAt: string;
	updatedAt: string;
}

interface ClarificationMetadata {
	state: ClarificationWorkflowState;
	history: Array<{
		action: ClarificationWorkflowAction;
		from: ClarificationWorkflowState;
		to: ClarificationWorkflowState;
		actorId: string;
		reason: string;
		at: string;
	}>;
	questions: ClarificationRecord[];
	lastSubmissionReference?: string;
	lastAnswer?: string;
}

const WORKFLOW_KEY = "requirement_clarification";
const SUBJECT_TYPE = "requirement_clarification";

function assignedOpportunityExistsSql(opportunityId: unknown, userId: string): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and opportunities.assigned_to = ${userId}
	)`;
}

function visibleRequirementCondition(requirementId: string, userId: string): SQL {
	return and(
		eq(rfpRequirements.id, requirementId),
		assignedOpportunityExistsSql(rfpRequirements.opportunityId, userId)
	)!;
}

export async function transitionClarificationWorkflow(
	input: ClarificationWorkflowInput
): Promise<ClarificationWorkflowResult> {
	const userContext = await requireUserContext();
	const reason = input.reason.trim();
	if (!reason) {
		throw new Error("Clarification workflow transitions require a reason");
	}
	requireClarificationAuthority(userContext, input.action);

	const [requirement] = await db
		.select()
		.from(rfpRequirements)
		.where(visibleRequirementCondition(input.requirementId, userContext.userId))
		.limit(1);
	if (!requirement) {
		throw new Error("Requirement not found");
	}

	const metadata = normalizeMetadata(requirement.metadata);
	const clarification = normalizeClarificationMetadata(metadata.clarificationWorkflow);
	const fromState = clarification.state;
	const now = new Date();
	const next = buildClarificationTransition(input, requirement, clarification, userContext.userId, now);
	const updatedMetadata = {
		...metadata,
		clarificationWorkflow: {
			...next.clarification,
			history: [
				...next.clarification.history,
				{
					action: input.action,
					from: fromState,
					to: next.toState,
					actorId: userContext.userId,
					reason,
					at: now.toISOString(),
				},
			],
		},
	};
	const [updated] = await db
		.update(rfpRequirements)
		.set({
			clarificationQuestions: next.clarification.questions.map((question) => question.question),
			metadata: updatedMetadata,
			updatedAt: now,
		})
		.where(visibleRequirementCondition(input.requirementId, userContext.userId))
		.returning();
	if (!updated) {
		throw new Error("Failed to update clarification workflow state");
	}

	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: WORKFLOW_KEY,
		subjectType: SUBJECT_TYPE,
		subjectId: input.requirementId,
		opportunityId: requirement.opportunityId,
		fromState,
		toState: next.toState,
		eventType: `clarification_${input.action}`,
		actorId: userContext.userId,
		reason,
		priority: priorityForRequirement(requirement),
		assignedTo: input.assignedTo ?? null,
		assignedRole: next.terminal ? null : next.assignedRole,
		dueAt: next.terminal ? null : normalizeDueAt(input.dueAt, requirement),
		metadata: {
			requirementNumber: requirement.requirementNumber,
			questionCount: next.clarification.questions.length,
			submissionReference: next.clarification.lastSubmissionReference ?? null,
			hasAnswer: Boolean(next.clarification.lastAnswer),
		},
		terminal: next.terminal,
		actionUrl: requirement.opportunityId
			? `/opportunities/${requirement.opportunityId}/requirements`
			: "/opportunities",
	});

	let taskProjected = false;
	if (next.taskState) {
		await upsertWorkflowRuntimeTask({
			workflowInstanceId: instance.id,
			taskKey: `requirement-clarification:${input.requirementId}`,
			title: next.taskTitle,
			description: requirement.requirementText,
			state: next.taskState,
			priority: priorityForRequirement(requirement),
			assignedTo: input.assignedTo ?? null,
			assignedRole: next.terminal ? null : next.assignedRole,
			dueAt: next.terminal ? null : normalizeDueAt(input.dueAt, requirement),
			metadata: {
				requirementId: input.requirementId,
				opportunityId: requirement.opportunityId ?? null,
				requirementNumber: requirement.requirementNumber ?? null,
			},
		});
		taskProjected = true;
	}

	return {
		requirementId: updated.id,
		opportunityId: updated.opportunityId,
		fromState,
		toState: next.toState,
		questionCount: next.clarification.questions.length,
		workflowInstanceId: instance.id,
		taskProjected,
	};
}

function buildClarificationTransition(
	input: ClarificationWorkflowInput,
	requirement: RequirementRow,
	current: ClarificationMetadata,
	actorId: string,
	now: Date
): {
	toState: ClarificationWorkflowState;
	clarification: ClarificationMetadata;
	terminal: boolean;
	assignedRole: string | null;
	taskState?: "open" | "in_progress" | "blocked" | "completed";
	taskTitle: string;
} {
	const base = { ...current, questions: [...current.questions], history: [...current.history] };
	switch (input.action) {
		case "draft": {
			const question = input.question?.trim();
			if (!question) throw new Error("Drafting a clarification requires a question");
			base.questions.push({
				id: makeQuestionId(requirement.id, question, now),
				question,
				status: "drafted",
				createdAt: now.toISOString(),
				updatedAt: now.toISOString(),
			});
			base.state = "drafted";
			return {
				toState: "drafted",
				clarification: base,
				terminal: false,
				assignedRole: "proposal_manager",
				taskState: "open",
				taskTitle: "Review drafted clarification question",
			};
		}
		case "request_approval":
			ensureQuestionsExist(base);
			base.state = "approval_requested";
			base.questions = markQuestions(base.questions, "approval_requested", now);
			return {
				toState: "approval_requested",
				clarification: base,
				terminal: false,
				assignedRole: "proposal_manager",
				taskState: "blocked",
				taskTitle: "Approve clarification before customer submission",
			};
		case "approve":
			ensureQuestionsExist(base);
			if (current.state !== "approval_requested") {
				throw new Error("Clarifications must be requested for approval before approval");
			}
			base.state = "approved";
			base.questions = markQuestions(base.questions, "approved", now);
			return {
				toState: "approved",
				clarification: base,
				terminal: false,
				assignedRole: "proposal_manager",
				taskState: "open",
				taskTitle: "Submit approved clarification to customer",
			};
		case "submit": {
			ensureState(current.state, "approved", "Only approved clarifications can be submitted");
			const reference = input.submissionReference?.trim();
			if (!reference) throw new Error("Submitting a clarification requires a submission reference");
			base.state = "submitted";
			base.lastSubmissionReference = reference;
			base.questions = base.questions.map((question) => ({
				...question,
				submissionReference: reference,
				status: "submitted",
				updatedAt: now.toISOString(),
			}));
			return {
				toState: "submitted",
				clarification: base,
				terminal: false,
				assignedRole: "proposal_manager",
				taskState: "blocked",
				taskTitle: "Await customer clarification answer",
			};
		}
		case "record_answer": {
			ensureState(current.state, "submitted", "Only submitted clarifications can receive answers");
			const answer = input.answer?.trim();
			if (!answer) throw new Error("Recording a clarification answer requires answer text");
			base.state = "answered";
			base.lastAnswer = answer;
			base.questions = base.questions.map((question) => ({
				...question,
				answer,
				status: "answered",
				updatedAt: now.toISOString(),
			}));
			return {
				toState: "answered",
				clarification: base,
				terminal: false,
				assignedRole: "proposal_writer",
				taskState: "open",
				taskTitle: "Incorporate clarification answer into response",
			};
		}
		case "incorporate":
			ensureState(current.state, "answered", "Clarification answers must be recorded before incorporation");
			base.state = "incorporated";
			base.questions = markQuestions(base.questions, "incorporated", now);
			return {
				toState: "incorporated",
				clarification: base,
				terminal: true,
				assignedRole: null,
				taskState: "completed",
				taskTitle: "Clarification incorporated",
			};
		case "reopen":
			ensureQuestionsExist(base);
			base.state = "drafted";
			base.questions = markQuestions(base.questions, "drafted", now);
			return {
				toState: "drafted",
				clarification: base,
				terminal: false,
				assignedRole: "proposal_manager",
				taskState: "open",
				taskTitle: "Revise reopened clarification",
			};
		default:
			input.action satisfies never;
			throw new Error("Unsupported clarification workflow action");
	}
}

function normalizeMetadata(metadata: unknown): Record<string, unknown> {
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
	return { ...(metadata as Record<string, unknown>) };
}

function requireClarificationAuthority(
	userContext: Pick<UserContext, "role" | "roles">,
	action: ClarificationWorkflowAction
): void {
	if (action !== "approve" && action !== "submit") {
		return;
	}
	const requiredRoles = ["proposal_manager", "capture_manager"];
	if (requiredRoles.some((role) => userHasAuthorityRole(userContext, role))) {
		return;
	}
	throw new Error(
		`Approving or submitting customer clarifications requires proposal or capture authority: requires ${requiredRoles.join(" or ")}`
	);
}

function normalizeClarificationMetadata(value: unknown): ClarificationMetadata {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return { state: "drafted", history: [], questions: [] };
	}
	const record = value as Partial<ClarificationMetadata>;
	return {
		state: isClarificationState(record.state) ? record.state : "drafted",
		history: Array.isArray(record.history) ? record.history : [],
		questions: Array.isArray(record.questions)
			? record.questions.filter(isClarificationRecord)
			: [],
		lastSubmissionReference: record.lastSubmissionReference,
		lastAnswer: record.lastAnswer,
	};
}

function isClarificationState(value: unknown): value is ClarificationWorkflowState {
	return value === "drafted" ||
		value === "approval_requested" ||
		value === "approved" ||
		value === "submitted" ||
		value === "answered" ||
		value === "incorporated";
}

function isClarificationRecord(value: unknown): value is ClarificationRecord {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const record = value as Partial<ClarificationRecord>;
	return typeof record.id === "string" && typeof record.question === "string";
}

function ensureQuestionsExist(metadata: ClarificationMetadata) {
	if (!metadata.questions.length) {
		throw new Error("Clarification workflow requires at least one drafted question");
	}
}

function ensureState(actual: ClarificationWorkflowState, expected: ClarificationWorkflowState, message: string) {
	if (actual !== expected) throw new Error(message);
}

function markQuestions(
	questions: ClarificationRecord[],
	status: ClarificationWorkflowState,
	now: Date
): ClarificationRecord[] {
	return questions.map((question) => ({
		...question,
		status,
		updatedAt: now.toISOString(),
	}));
}

function priorityForRequirement(requirement: RequirementRow): "critical" | "high" | "medium" | "low" {
	if (requirement.riskLevel === "critical" || requirement.priority === "mandatory") return "critical";
	if (requirement.riskLevel === "high") return "high";
	if (requirement.riskLevel === "low" || requirement.priority === "optional") return "low";
	return "medium";
}

function normalizeDueAt(inputDueAt: Date | string | null | undefined, requirement: RequirementRow): Date | null {
	if (inputDueAt instanceof Date) return inputDueAt;
	if (typeof inputDueAt === "string" && inputDueAt.trim()) return new Date(inputDueAt);
	if (requirement.dueDate) return requirement.dueDate;
	const dueAt = new Date();
	dueAt.setUTCDate(dueAt.getUTCDate() + 2);
	return dueAt;
}

function makeQuestionId(requirementId: string, question: string, now: Date): string {
	let hash = 0;
	const seed = `${requirementId}:${question}:${now.toISOString()}`;
	for (let index = 0; index < seed.length; index += 1) {
		hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
	}
	return `cq_${Math.abs(hash).toString(36)}`;
}
