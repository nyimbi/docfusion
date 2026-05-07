"use server";

import { db } from "@/lib/db";
import {
	claimAnalysis,
	type ClaimAnalysisStatus,
	type ClaimEvidenceStrength,
	type ClaimResolution,
} from "@/lib/db/schema-evidence";
import { requireUserContext } from "@/lib/auth-utils";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";
import { eq } from "drizzle-orm";

type ClaimAnalysisRow = typeof claimAnalysis.$inferSelect;

export type ClaimRemediationAction =
	| "start"
	| "add_evidence"
	| "rewrite"
	| "waive"
	| "remove"
	| "reopen";

export interface ClaimRemediationInput {
	claimId: string;
	action: ClaimRemediationAction;
	reason: string;
	evidenceIds?: string[];
	revisedClaimText?: string;
	assignedTo?: string | null;
	dueAt?: Date | string | null;
}

export interface ClaimRemediationResult {
	claimId: string;
	opportunityId: string | null;
	fromState: string;
	toState: string;
	status: ClaimAnalysisStatus;
	resolution: ClaimResolution | null;
	workflowInstanceId: string;
	taskProjected: boolean;
}

const WORKFLOW_KEY = "evidence_claim_remediation";
const SUBJECT_TYPE = "evidence_claim";

export async function transitionClaimRemediationWorkflow(
	input: ClaimRemediationInput
): Promise<ClaimRemediationResult> {
	const userContext = await requireUserContext();
	const reason = input.reason.trim();
	if (!reason) {
		throw new Error("Claim remediation transitions require a reason");
	}

	const [claim] = await db
		.select()
		.from(claimAnalysis)
		.where(eq(claimAnalysis.id, input.claimId))
		.limit(1);
	if (!claim) {
		throw new Error("Claim not found");
	}

	const fromState = claimState(claim);
	const transition = buildTransition(input, claim, userContext.userId);
	const [updated] = await db
		.update(claimAnalysis)
		.set(transition.patch)
		.where(eq(claimAnalysis.id, input.claimId))
		.returning();
	if (!updated) {
		throw new Error("Failed to update claim remediation state");
	}

	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: WORKFLOW_KEY,
		subjectType: SUBJECT_TYPE,
		subjectId: input.claimId,
		opportunityId: claim.opportunityId ?? null,
		fromState,
		toState: transition.toState,
		eventType: `claim_${input.action}`,
		actorId: userContext.userId,
		reason,
		evidenceLinks: input.evidenceIds ?? [],
		priority: priorityForClaim(updated),
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : "proposal_writer",
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, updated),
		metadata: {
			claimId: input.claimId,
			documentId: claim.documentId ?? null,
			sectionId: claim.sectionId ?? null,
			riskLevel: claim.riskLevel ?? null,
			evidenceStrength: updated.evidenceStrength ?? null,
			resolution: updated.resolution ?? null,
			action: input.action,
		},
		terminal: transition.terminal,
		actionUrl: claim.documentId ? `/documents/${claim.documentId}` : "/evidence",
	});

	let taskProjected = false;
	if (transition.taskState) {
		await upsertWorkflowRuntimeTask({
			workflowInstanceId: instance.id,
			taskKey: `claim-remediation:${input.claimId}`,
			title: transition.taskTitle,
			description: taskDescription(updated),
			state: transition.taskState,
			priority: priorityForClaim(updated),
			assignedTo: input.assignedTo ?? null,
			assignedRole: transition.terminal ? null : "proposal_writer",
			dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, updated),
			metadata: {
				claimId: input.claimId,
				opportunityId: updated.opportunityId ?? null,
				documentId: updated.documentId ?? null,
				sectionId: updated.sectionId ?? null,
				resolution: updated.resolution ?? null,
			},
		});
		taskProjected = true;
	}

	return {
		claimId: updated.id,
		opportunityId: updated.opportunityId ?? null,
		fromState,
		toState: transition.toState,
		status: updated.status ?? "open",
		resolution: updated.resolution ?? null,
		workflowInstanceId: instance.id,
		taskProjected,
	};
}

function buildTransition(
	input: ClaimRemediationInput,
	claim: ClaimAnalysisRow,
	actorId: string
): {
	toState: string;
	terminal: boolean;
	taskState?: "open" | "in_progress" | "completed";
	taskTitle: string;
	patch: Partial<typeof claimAnalysis.$inferInsert>;
} {
	const now = new Date();
	const baseNotes = input.reason.trim();
	switch (input.action) {
		case "start":
			ensureNotTerminal(claim);
			return {
				toState: "in_progress",
				terminal: false,
				taskState: "in_progress",
				taskTitle: "Remediate unsupported proposal claim",
				patch: {
					status: "in_progress",
					resolution: null,
					resolutionNotes: baseNotes,
					resolvedBy: null,
					resolvedAt: null,
				},
			};
		case "add_evidence": {
			const evidenceIds = normalizedEvidenceIds(input.evidenceIds);
			if (!evidenceIds.length) {
				throw new Error("Evidence remediation requires at least one evidence item");
			}
			const linkedEvidenceIds = mergeIds(claim.linkedEvidenceIds ?? [], evidenceIds);
			return {
				toState: "evidenced",
				terminal: true,
				taskState: "completed",
				taskTitle: "Claim evidence remediation completed",
				patch: {
					status: "resolved",
					resolution: "evidence_added",
					resolutionNotes: baseNotes,
					resolvedBy: actorId,
					resolvedAt: now,
					linkedEvidenceIds,
					hasEvidence: true,
					evidenceStrength: strengthForEvidenceCount(linkedEvidenceIds.length),
				},
			};
		}
		case "rewrite":
			if (!input.revisedClaimText?.trim()) {
				throw new Error("Claim rewrite remediation requires revised claim text");
			}
			return {
				toState: "rewritten",
				terminal: true,
				taskState: "completed",
				taskTitle: "Claim rewrite remediation completed",
				patch: {
					claimText: input.revisedClaimText.trim(),
					status: "resolved",
					resolution: "claim_modified",
					resolutionNotes: `${baseNotes}\n\nOriginal claim: ${claim.claimText}`,
					resolvedBy: actorId,
					resolvedAt: now,
				},
			};
		case "waive":
			return {
				toState: "waived",
				terminal: true,
				taskState: "completed",
				taskTitle: "Claim risk waiver recorded",
				patch: {
					status: "wont_fix",
					resolution: "accepted_as_is",
					resolutionNotes: baseNotes,
					resolvedBy: actorId,
					resolvedAt: now,
				},
			};
		case "remove":
			return {
				toState: "removed",
				terminal: true,
				taskState: "completed",
				taskTitle: "Unsupported claim removal recorded",
				patch: {
					status: "resolved",
					resolution: "claim_removed",
					resolutionNotes: baseNotes,
					resolvedBy: actorId,
					resolvedAt: now,
				},
			};
		case "reopen":
			return {
				toState: "open",
				terminal: false,
				taskState: "open",
				taskTitle: "Reopened claim remediation",
				patch: {
					status: "open",
					resolution: null,
					resolutionNotes: baseNotes,
					resolvedBy: null,
					resolvedAt: null,
				},
			};
		default:
			input.action satisfies never;
			throw new Error("Unsupported claim remediation action");
	}
}

function ensureNotTerminal(claim: ClaimAnalysisRow) {
	if (claim.status === "resolved" || claim.status === "wont_fix") {
		throw new Error("Terminal claims must be reopened before remediation can continue");
	}
}

function claimState(claim: ClaimAnalysisRow): string {
	if (claim.status === "resolved" || claim.status === "wont_fix") {
		return claim.resolution ?? "resolved";
	}
	return claim.status ?? "open";
}

function normalizedEvidenceIds(ids: string[] | undefined): string[] {
	return (ids ?? []).map((id) => id.trim()).filter(Boolean);
}

function mergeIds(existing: string[], incoming: string[]): string[] {
	return Array.from(new Set([...existing, ...incoming]));
}

function strengthForEvidenceCount(count: number): ClaimEvidenceStrength {
	if (count >= 3) return "strong";
	if (count >= 1) return "moderate";
	return "weak";
}

function priorityForClaim(claim: ClaimAnalysisRow): "critical" | "high" | "medium" | "low" {
	if (claim.riskLevel === "high" && claim.evidenceStrength === "none") return "critical";
	if (claim.riskLevel === "high") return "high";
	if (claim.riskLevel === "medium") return "medium";
	return "low";
}

function normalizeDueAt(inputDueAt: Date | string | null | undefined, claim: ClaimAnalysisRow): Date {
	if (inputDueAt instanceof Date) return inputDueAt;
	if (typeof inputDueAt === "string" && inputDueAt.trim()) return new Date(inputDueAt);
	const days = claim.riskLevel === "high" ? 1 : claim.riskLevel === "medium" ? 3 : 5;
	const dueAt = new Date();
	dueAt.setUTCDate(dueAt.getUTCDate() + days);
	return dueAt;
}

function taskDescription(claim: ClaimAnalysisRow): string {
	return [
		claim.claimText,
		claim.evaluatorImpact ? `Evaluator impact: ${claim.evaluatorImpact}` : null,
		claim.quantificationSuggestion ? `Quantification suggestion: ${claim.quantificationSuggestion}` : null,
	].filter(Boolean).join("\n\n");
}
