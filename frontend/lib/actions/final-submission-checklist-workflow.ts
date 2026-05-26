"use server";

import { requireUserContext } from "@/lib/auth-utils";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";
import { db } from "@/lib/db";
import { documents, proposalDocuments } from "@/lib/db/schema";
import { complianceMatrices } from "@/lib/db/schema-rfp";
import { claimAnalysis } from "@/lib/db/schema-evidence";
import {
	hasBlockingDlpFindings,
	scanDocumentsForDlpFindings,
	summarizeDlpFindings,
	type DlpFinding,
} from "@/lib/security/dlp-policy";
import { and, eq, sql, type SQL } from "drizzle-orm";

type ProposalDocumentWithDocument = {
	proposalDocumentId: string;
	documentId: string;
	documentType: string;
	proposalStatus: string;
	approvedBy: string | null;
	approvedAt: Date | null;
	title: string;
	documentStatus: string;
	content: unknown;
	metadata: unknown;
};

type ComplianceMatrixRow = typeof complianceMatrices.$inferSelect;
type ClaimAnalysisRow = typeof claimAnalysis.$inferSelect;

export type FinalChecklistCategory =
	| "documents"
	| "artifact"
	| "approval"
	| "signature"
	| "compliance"
	| "evidence"
	| "privacy"
	| "administrative";

export interface FinalSubmissionChecklistItem {
	id: string;
	category: FinalChecklistCategory;
	label: string;
	required: boolean;
	passed: boolean;
	message: string;
	subjectId?: string | null;
	assignedRole?: string | null;
}

export interface FinalSubmissionChecklistResult {
	opportunityId: string;
	allowed: boolean;
	blockers: string[];
	warnings: string[];
	items: FinalSubmissionChecklistItem[];
	dlpFindings: DlpFinding[];
	workflowInstanceId: string;
	taskProjected: boolean;
}

const WORKFLOW_KEY = "final_submission_checklist_gate";
const SUBJECT_TYPE = "submission_checklist";
const REQUIRED_DOCUMENT_TYPES = [
	"technical_approach",
	"management_plan",
	"cost_proposal",
];

function assignedOpportunityExistsSql(opportunityId: unknown, userId: string): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and opportunities.assigned_to = ${userId}
	)`;
}

function visibleProposalDocumentsForOpportunityCondition(opportunityId: string, userId: string): SQL {
	return and(
		eq(proposalDocuments.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userId)
	)!;
}

function visibleComplianceMatricesForOpportunityCondition(opportunityId: string, userId: string): SQL {
	return and(
		eq(complianceMatrices.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userId)
	)!;
}

function visibleClaimsForOpportunityCondition(opportunityId: string, userId: string): SQL {
	return and(
		eq(claimAnalysis.opportunityId, opportunityId),
		assignedOpportunityExistsSql(claimAnalysis.opportunityId, userId)
	)!;
}

export async function evaluateFinalSubmissionChecklistWorkflow(
	opportunityId: string
): Promise<FinalSubmissionChecklistResult> {
	const userContext = await requireUserContext();
	const [docs, matrices, claims] = await Promise.all([
		loadProposalDocuments(opportunityId, userContext.userId),
		db
			.select()
			.from(complianceMatrices)
			.where(visibleComplianceMatricesForOpportunityCondition(opportunityId, userContext.userId)),
		db
			.select()
			.from(claimAnalysis)
			.where(visibleClaimsForOpportunityCondition(opportunityId, userContext.userId)),
	]);
	const dlpFindings = scanDocumentsForDlpFindings(docs.map((doc) => ({
		documentId: doc.documentId,
		title: doc.title,
		content: doc.content,
	})));
	const items = buildChecklistItems(docs, matrices, claims, dlpFindings);
	const blockers = items
		.filter((item) => item.required && !item.passed)
		.map((item) => `${item.label}: ${item.message}`);
	const warnings = items
		.filter((item) => !item.required && !item.passed)
		.map((item) => `${item.label}: ${item.message}`);
	const allowed = blockers.length === 0;
	const assignedRole = allowed ? null : roleForFirstBlocker(items);
	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: WORKFLOW_KEY,
		subjectType: SUBJECT_TYPE,
		subjectId: opportunityId,
		opportunityId,
		fromState: "pending",
		toState: allowed ? "ready" : "blocked",
		eventType: allowed ? "final_submission_checklist_passed" : "final_submission_checklist_blocked",
		actorId: userContext.userId,
		reason: allowed
			? "Final submission checklist passed"
			: `Final submission checklist blocked: ${blockers.join("; ")}`,
		priority: allowed ? "medium" : "critical",
		assignedRole,
		dueAt: allowed ? null : nextUtcDay(),
		metadata: {
			itemCount: items.length,
			blockerCount: blockers.length,
			warningCount: warnings.length,
			dlpFindingCount: dlpFindings.length,
			blockingDlpFindingCount: dlpFindings.filter((finding) => isBlockingFinding(finding)).length,
			requiredDocumentTypes: REQUIRED_DOCUMENT_TYPES,
			items,
		},
		terminal: allowed,
		actionUrl: `/opportunities/${opportunityId}/submission`,
	});

	await upsertWorkflowRuntimeTask({
		workflowInstanceId: instance.id,
		taskKey: `final-submission-checklist:${opportunityId}`,
		title: allowed ? "Final submission checklist passed" : "Resolve final submission blockers",
		description: allowed
			? "Final submission checklist passed."
			: blockers.join("\n"),
		state: allowed ? "completed" : "blocked",
		priority: allowed ? "medium" : "critical",
		assignedRole,
		dueAt: allowed ? null : nextUtcDay(),
		metadata: {
			opportunityId,
			blockers,
			warnings,
		},
	});

	return {
		opportunityId,
		allowed,
		blockers,
		warnings,
		items,
		dlpFindings,
		workflowInstanceId: instance.id,
		taskProjected: true,
	};
}

async function loadProposalDocuments(opportunityId: string, userId: string): Promise<ProposalDocumentWithDocument[]> {
	return db
		.select({
			proposalDocumentId: proposalDocuments.id,
			documentId: proposalDocuments.documentId,
			documentType: proposalDocuments.documentType,
			proposalStatus: proposalDocuments.status,
			approvedBy: proposalDocuments.approvedBy,
			approvedAt: proposalDocuments.approvedAt,
			title: documents.title,
			documentStatus: documents.status,
			content: documents.content,
			metadata: documents.metadata,
		})
		.from(proposalDocuments)
		.innerJoin(documents, eq(documents.id, proposalDocuments.documentId))
		.where(visibleProposalDocumentsForOpportunityCondition(opportunityId, userId));
}

function buildChecklistItems(
	docs: ProposalDocumentWithDocument[],
	matrices: ComplianceMatrixRow[],
	claims: ClaimAnalysisRow[],
	dlpFindings: DlpFinding[]
): FinalSubmissionChecklistItem[] {
	const items: FinalSubmissionChecklistItem[] = [];
	for (const documentType of REQUIRED_DOCUMENT_TYPES) {
		const doc = docs.find((candidate) => candidate.documentType === documentType);
		items.push(requiredDocumentItem(documentType, doc));
		if (doc) {
			items.push(approvalItem(doc));
			items.push(artifactItem(doc));
			items.push(signatureItem(doc));
		}
	}
	items.push(complianceLockItem(matrices));
	items.push(claimEvidenceItem(claims));
	items.push(dlpItem(dlpFindings));
	return items;
}

function requiredDocumentItem(
	documentType: string,
	doc: ProposalDocumentWithDocument | undefined
): FinalSubmissionChecklistItem {
	return {
		id: `document:${documentType}`,
		category: "documents",
		label: `${formatDocumentType(documentType)} present`,
		required: true,
		passed: Boolean(doc),
		message: doc ? `Document linked as ${doc.title}` : "Required proposal document is missing",
		subjectId: doc?.documentId ?? null,
		assignedRole: "proposal_manager",
	};
}

function approvalItem(doc: ProposalDocumentWithDocument): FinalSubmissionChecklistItem {
	const passed = doc.proposalStatus === "final" && Boolean(doc.approvedBy && doc.approvedAt);
	return {
		id: `approval:${doc.proposalDocumentId}`,
		category: "approval",
		label: `${doc.title} approval`,
		required: true,
		passed,
		message: passed
			? `Approved by ${doc.approvedBy}`
			: `Proposal document status is ${doc.proposalStatus}; final approval is required`,
		subjectId: doc.proposalDocumentId,
		assignedRole: "proposal_manager",
	};
}

function artifactItem(doc: ProposalDocumentWithDocument): FinalSubmissionChecklistItem {
	const artifact = finalArtifact(doc.metadata);
	const passed = Boolean(artifact?.artifactHash);
	return {
		id: `artifact:${doc.documentId}`,
		category: "artifact",
		label: `${doc.title} artifact hash`,
		required: true,
		passed,
		message: passed
			? `Final artifact hash ${artifact?.artifactHash}`
			: "Approved final artifact hash is missing",
		subjectId: doc.documentId,
		assignedRole: "production_specialist",
	};
}

function signatureItem(doc: ProposalDocumentWithDocument): FinalSubmissionChecklistItem {
	const signoff = finalSubmissionSignoff(doc.metadata);
	const passed = Boolean(signoff?.signedBy && signoff.signedAt);
	return {
		id: `signature:${doc.documentId}`,
		category: "signature",
		label: `${doc.title} executive signoff`,
		required: true,
		passed,
		message: passed
			? `Signed by ${signoff?.signedBy}`
			: "Required executive/legal signoff metadata is missing",
		subjectId: doc.documentId,
		assignedRole: "executive",
	};
}

function complianceLockItem(matrices: ComplianceMatrixRow[]): FinalSubmissionChecklistItem {
	const lockedMatrix = matrices.find((matrix) => ["final", "submitted"].includes(matrix.status));
	const unresolvedCount = lockedMatrix ? unresolvedComplianceCount(lockedMatrix) : 0;
	const mandatoryScore = Number(lockedMatrix?.mandatoryComplianceScore ?? 0);
	const passed = Boolean(
		lockedMatrix?.approvedBy &&
		lockedMatrix.approvedAt &&
		unresolvedCount === 0 &&
		mandatoryScore >= 100
	);
	return {
		id: "compliance:matrix-lock",
		category: "compliance",
		label: "Compliance matrix final lock",
		required: true,
		passed,
		message: passed
			? `Matrix ${lockedMatrix?.name} locked by ${lockedMatrix?.approvedBy}`
			: complianceLockFailureMessage(lockedMatrix, unresolvedCount, mandatoryScore),
		subjectId: lockedMatrix?.id ?? null,
		assignedRole: "compliance_officer",
	};
}

function unresolvedComplianceCount(matrix: ComplianceMatrixRow): number {
	return Number(matrix.notAddressedCount ?? 0) + Number(matrix.nonCompliantCount ?? 0);
}

function complianceLockFailureMessage(
	matrix: ComplianceMatrixRow | undefined,
	unresolvedCount: number,
	mandatoryScore: number
): string {
	if (!matrix) {
		return "A final or submitted compliance matrix with approval is required";
	}
	if (!matrix.approvedBy || !matrix.approvedAt) {
		return "A final or submitted compliance matrix with approval is required";
	}
	if (unresolvedCount > 0) {
		return `Compliance matrix ${matrix.name} is locked but still has ${unresolvedCount} unresolved compliance gap${unresolvedCount === 1 ? "" : "s"}`;
	}
	if (mandatoryScore < 100) {
		return `Compliance matrix ${matrix.name} is locked but mandatory compliance is ${mandatoryScore}%`;
	}
	return "A final or submitted compliance matrix with approval is required";
}

function claimEvidenceItem(claims: ClaimAnalysisRow[]): FinalSubmissionChecklistItem {
	const unresolved = claims.filter(isBlockingClaim);
	const first = unresolved[0];
	return {
		id: "evidence:high-risk-claims",
		category: "evidence",
		label: "High-risk claim evidence",
		required: true,
		passed: unresolved.length === 0,
		message: unresolved.length === 0
			? "No unresolved high-risk unsupported claims detected"
			: `${unresolved.length} high-risk unsupported claim${unresolved.length === 1 ? "" : "s"} ${unresolved.length === 1 ? "requires" : "require"} remediation${first ? `; first: ${truncateClaim(first.claimText)}` : ""}`,
		subjectId: first?.id ?? null,
		assignedRole: "proposal_writer",
	};
}

function isBlockingClaim(claim: ClaimAnalysisRow): boolean {
	if (claim.status === "resolved" || claim.status === "wont_fix") {
		return false;
	}
	return claim.riskLevel === "high";
}

function truncateClaim(value: string): string {
	return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

function dlpItem(findings: DlpFinding[]): FinalSubmissionChecklistItem {
	const blocking = hasBlockingDlpFindings(findings);
	const summary = summarizeDlpFindings(findings);
	const findingDetails = findings.slice(0, 3).map((finding) =>
		`${finding.title}: ${finding.label} (${finding.severity})`
	).join("; ");
	return {
		id: "privacy:dlp-clearance",
		category: "privacy",
		label: "DLP clearance",
		required: true,
		passed: !blocking,
		message: blocking
			? `Blocking DLP findings must be remediated or waived before submission (${summary}): ${findingDetails}`
			: findings.length
				? `Only advisory DLP findings remain (${summary}): ${findingDetails}`
				: "No DLP findings detected",
		assignedRole: "security_reviewer",
	};
}

function finalArtifact(metadata: unknown): { artifactHash?: unknown } | null {
	const value = asRecord(metadata).finalArtifact;
	if (!value || typeof value !== "object") {
		return null;
	}
	return value as { artifactHash?: unknown };
}

function finalSubmissionSignoff(metadata: unknown): { signedBy?: unknown; signedAt?: unknown } | null {
	const value = asRecord(metadata).finalSubmissionSignoff;
	if (!value || typeof value !== "object") {
		return null;
	}
	return value as { signedBy?: unknown; signedAt?: unknown };
}

function roleForFirstBlocker(items: FinalSubmissionChecklistItem[]) {
	return items.find((item) => item.required && !item.passed)?.assignedRole ?? "proposal_manager";
}

function formatDocumentType(documentType: string) {
	return documentType
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function isBlockingFinding(finding: DlpFinding) {
	return finding.severity === "critical" || finding.severity === "high";
}

function nextUtcDay(): Date {
	const dueAt = new Date();
	dueAt.setUTCDate(dueAt.getUTCDate() + 1);
	return dueAt;
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};
}
