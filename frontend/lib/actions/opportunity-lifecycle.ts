"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { opportunities } from "@/lib/db/schema";
import { recordWorkflowRuntimeTransition, upsertWorkflowRuntimeTask } from "@/lib/actions/workflow-runtime";
import { requireServerSession } from "@/lib/auth-utils";
import type { DecisionStatus } from "@/lib/types/opportunity";
import { eq } from "drizzle-orm";

export type OpportunityTriageAction =
	| "mark_interested"
	| "shortlist"
	| "qualify"
	| "reject"
	| "archive"
	| "mark_stale"
	| "promote"
	| "reopen";

export type OpportunityDeadlineAction = "accept" | "reject" | "change";

export interface OpportunityLifecycleResult {
	success: boolean;
	error?: string;
	opportunityId?: string;
	state?: string;
}

const TRIAGE_STATE_BY_ACTION: Record<OpportunityTriageAction, {
	state: string;
	status: DecisionStatus;
	isReviewed: boolean;
	terminal?: boolean;
}> = {
	mark_interested: { state: "interested", status: "interested", isReviewed: true },
	shortlist: { state: "shortlisted", status: "shortlisted", isReviewed: true },
	qualify: { state: "qualified", status: "pursuing", isReviewed: true },
	reject: { state: "rejected", status: "declined", isReviewed: true, terminal: true },
	archive: { state: "archived", status: "declined", isReviewed: true, terminal: true },
	mark_stale: { state: "stale", status: "expired", isReviewed: true },
	promote: { state: "promoted_to_rfp_intake", status: "pursuing", isReviewed: true },
	reopen: { state: "review", status: "pending", isReviewed: false },
};

export async function transitionOpportunityTriage(input: {
	opportunityId: string;
	action: OpportunityTriageAction;
	reason: string;
	assignedTo?: string | null;
	priority?: "critical" | "high" | "medium" | "low";
}): Promise<OpportunityLifecycleResult> {
	try {
		const actor = await requireLifecycleActor();
		const opportunity = await loadOpportunity(input.opportunityId);
		const target = TRIAGE_STATE_BY_ACTION[input.action];
		const reason = input.reason.trim();
		if (!reason) return { success: false, error: "A triage reason is required" };

		const metadata = mergeOpportunityMetadata(opportunity.metadata, {
			triage: {
				state: target.state,
				action: input.action,
				reason,
				actorId: actor.userId,
				actorName: actor.actorName,
				at: new Date().toISOString(),
			},
		});
		await db
			.update(opportunities)
			.set({
				decisionStatus: target.status,
				decisionReason: reason,
				isReviewed: target.isReviewed,
				assignedTo: input.assignedTo === undefined ? opportunity.assignedTo : input.assignedTo,
				metadata,
				updatedAt: new Date(),
			})
			.where(eq(opportunities.id, input.opportunityId));

		const workflow = await recordWorkflowRuntimeTransition({
			workflowKey: "opportunity_triage",
			subjectType: "opportunity",
			subjectId: input.opportunityId,
			opportunityId: input.opportunityId,
			fromState: readLifecycleState(opportunity.metadata, "triage") ?? "new",
			toState: target.state,
			eventType: `opportunity_${input.action}`,
			actorId: actor.userId,
			actorName: actor.actorName,
			reason,
			assignedTo: input.assignedTo === undefined ? opportunity.assignedTo : input.assignedTo,
			assignedRole: "capture_manager",
			dueAt: opportunity.deadline,
			priority: input.priority ?? deriveOpportunityPriority(opportunity.priorityRank),
			metadata: {
				decisionStatus: target.status,
				previousDecisionStatus: opportunity.decisionStatus,
			},
			terminal: target.terminal ?? false,
			actionUrl: `/opportunities/${input.opportunityId}`,
			notificationRecipients: compact([input.assignedTo ?? opportunity.assignedTo]),
		});

		if (!target.terminal) {
			await upsertWorkflowRuntimeTask({
				workflowInstanceId: workflow.id,
				taskKey: `opportunity_triage:${target.state}`,
				title: `Opportunity ${humanize(target.state)}: ${opportunity.title}`,
				description: reason,
				state: "open",
				assignedTo: input.assignedTo === undefined ? opportunity.assignedTo : input.assignedTo,
				assignedRole: "capture_manager",
				dueAt: opportunity.deadline,
				priority: input.priority ?? deriveOpportunityPriority(opportunity.priorityRank),
				metadata: {
					opportunityId: input.opportunityId,
					action: input.action,
				},
			});
		}

		revalidateOpportunity(input.opportunityId);
		return { success: true, opportunityId: input.opportunityId, state: target.state };
	} catch (error) {
		return lifecycleError(error, "Failed to transition opportunity triage");
	}
}

export async function recordOpportunityAnalysisAcceptance(input: {
	opportunityId: string;
	recommendation: "accept" | "override" | "reject";
	confidence: number;
	reason: string;
	evidenceLinks?: string[];
	fitScore?: number | null;
	winProbability?: number | null;
}): Promise<OpportunityLifecycleResult> {
	try {
		const actor = await requireLifecycleActor();
		const opportunity = await loadOpportunity(input.opportunityId);
		const reason = input.reason.trim();
		if (!reason) return { success: false, error: "An analysis acceptance reason is required" };
		const confidence = Math.max(0, Math.min(100, Math.round(input.confidence)));
		const state = input.recommendation === "reject" ? "analysis_rejected" : "analysis_accepted";
		const metadata = mergeOpportunityMetadata(opportunity.metadata, {
			analysisAcceptance: {
				state,
				recommendation: input.recommendation,
				confidence,
				reason,
				evidenceLinks: input.evidenceLinks ?? [],
				actorId: actor.userId,
				actorName: actor.actorName,
				at: new Date().toISOString(),
			},
		});

		await db
			.update(opportunities)
			.set({
				fitScore: input.fitScore === undefined ? opportunity.fitScore : input.fitScore,
				winProbability: input.winProbability === undefined ? opportunity.winProbability : input.winProbability,
				strategicNotes: reason,
				metadata,
				updatedAt: new Date(),
			})
			.where(eq(opportunities.id, input.opportunityId));

		await recordWorkflowRuntimeTransition({
			workflowKey: "opportunity_analysis_acceptance",
			subjectType: "opportunity",
			subjectId: input.opportunityId,
			opportunityId: input.opportunityId,
			fromState: readLifecycleState(opportunity.metadata, "analysisAcceptance") ?? "analysis_ready",
			toState: state,
			eventType: `opportunity_analysis_${input.recommendation}`,
			actorId: actor.userId,
			actorName: actor.actorName,
			reason,
			evidenceLinks: input.evidenceLinks ?? [],
			priority: deriveOpportunityPriority(opportunity.priorityRank),
			metadata: { confidence, recommendation: input.recommendation },
			terminal: true,
			actionUrl: `/opportunities/${input.opportunityId}`,
		});

		revalidateOpportunity(input.opportunityId);
		return { success: true, opportunityId: input.opportunityId, state };
	} catch (error) {
		return lifecycleError(error, "Failed to record opportunity analysis acceptance");
	}
}

export async function transitionOpportunityDeadline(input: {
	opportunityId: string;
	action: OpportunityDeadlineAction;
	reason: string;
	acceptedDeadline?: Date | string | null;
}): Promise<OpportunityLifecycleResult> {
	try {
		const actor = await requireLifecycleActor();
		const opportunity = await loadOpportunity(input.opportunityId);
		const reason = input.reason.trim();
		if (!reason) return { success: false, error: "A deadline reason is required" };
		const deadline = input.acceptedDeadline ? parseDeadlineInput(input.acceptedDeadline) : opportunity.deadline;
		if (input.action !== "reject" && (!deadline || Number.isNaN(deadline.getTime()))) {
			return { success: false, error: "A valid deadline is required" };
		}
		const state = input.action === "accept" ? "deadline_accepted" : input.action === "reject" ? "deadline_rejected" : "deadline_changed";
		const metadata = mergeOpportunityMetadata(opportunity.metadata, {
			deadlineAcceptance: {
				state,
				reason,
				deadline: deadline?.toISOString() ?? null,
				actorId: actor.userId,
				actorName: actor.actorName,
				at: new Date().toISOString(),
			},
		});

		await db
			.update(opportunities)
			.set({
				deadline: input.action === "change" ? deadline : opportunity.deadline,
				metadata,
				updatedAt: new Date(),
			})
			.where(eq(opportunities.id, input.opportunityId));

		const workflow = await recordWorkflowRuntimeTransition({
			workflowKey: "opportunity_deadline_acceptance",
			subjectType: "opportunity",
			subjectId: input.opportunityId,
			opportunityId: input.opportunityId,
			fromState: readLifecycleState(opportunity.metadata, "deadlineAcceptance") ?? "deadline_detected",
			toState: state,
			eventType: `opportunity_deadline_${input.action}`,
			actorId: actor.userId,
			actorName: actor.actorName,
			reason,
			dueAt: deadline,
			assignedTo: opportunity.assignedTo,
			assignedRole: "capture_manager",
			priority: deadline && deadline.getTime() < Date.now() + 7 * 24 * 60 * 60 * 1000 ? "high" : "medium",
			metadata: { deadline: deadline?.toISOString() ?? null },
			terminal: input.action === "reject",
			actionUrl: `/opportunities/${input.opportunityId}`,
			notificationRecipients: compact([opportunity.assignedTo]),
		});

		if (input.action !== "reject") {
			await upsertWorkflowRuntimeTask({
				workflowInstanceId: workflow.id,
				taskKey: "opportunity_deadline:accepted",
				title: `Protect deadline: ${opportunity.title}`,
				description: reason,
				state: "open",
				assignedTo: opportunity.assignedTo,
				assignedRole: "capture_manager",
				dueAt: deadline,
				priority: deadline && deadline.getTime() < Date.now() + 7 * 24 * 60 * 60 * 1000 ? "high" : "medium",
				metadata: {
					opportunityId: input.opportunityId,
					deadline: deadline?.toISOString() ?? null,
				},
			});
		}

		revalidateOpportunity(input.opportunityId);
		return { success: true, opportunityId: input.opportunityId, state };
	} catch (error) {
		return lifecycleError(error, "Failed to transition opportunity deadline");
	}
}

async function requireLifecycleActor() {
	const session = await requireServerSession();
	const user = session.user as { id: string; name?: string | null; email?: string | null };
	return {
		userId: user.id,
		actorName: user.name ?? user.email ?? user.id,
	};
}

async function loadOpportunity(opportunityId: string) {
	const [opportunity] = await db
		.select()
		.from(opportunities)
		.where(eq(opportunities.id, opportunityId))
		.limit(1);
	if (!opportunity) throw new Error("Opportunity not found");
	return opportunity;
}

function mergeOpportunityMetadata(
	existing: unknown,
	patch: Record<string, unknown>
): Record<string, unknown> {
	return {
		...(isRecord(existing) ? existing : {}),
		workflow: {
			...(isRecord(existing) && isRecord(existing.workflow) ? existing.workflow : {}),
			...patch,
		},
	};
}

function readLifecycleState(metadata: unknown, key: string): string | null {
	if (!isRecord(metadata) || !isRecord(metadata.workflow) || !isRecord(metadata.workflow[key])) return null;
	const state = metadata.workflow[key].state;
	return typeof state === "string" ? state : null;
}

function deriveOpportunityPriority(priorityRank: number | null): "critical" | "high" | "medium" | "low" {
	if ((priorityRank ?? 3) >= 5) return "critical";
	if ((priorityRank ?? 3) >= 4) return "high";
	if ((priorityRank ?? 3) <= 2) return "low";
	return "medium";
}

function parseDeadlineInput(value: Date | string): Date {
	if (value instanceof Date) return value;
	if (!hasExplicitTimezone(value)) {
		return new Date(Number.NaN);
	}
	return new Date(value);
}

function hasExplicitTimezone(value: string): boolean {
	return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
}

function revalidateOpportunity(opportunityId: string) {
	revalidatePath("/opportunities");
	revalidatePath(`/opportunities/${opportunityId}`);
	revalidatePath("/tasks");
	revalidatePath("/workflows");
}

function lifecycleError(error: unknown, fallback: string): OpportunityLifecycleResult {
	return {
		success: false,
		error: error instanceof Error ? error.message : fallback,
	};
}

function compact(values: Array<string | null | undefined>): string[] {
	return values.filter((value): value is string => Boolean(value));
}

function humanize(value: string): string {
	return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
