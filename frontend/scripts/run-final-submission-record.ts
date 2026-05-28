import "./load-env";

import { createHash } from "node:crypto";
import path from "node:path";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	type EvidenceRecord,
} from "./platform-proof/core";
import { forceLocalEnv } from "./env-utils";
import { recordWorkflowRuntimeTransition } from "@/lib/actions/workflow-runtime";
import {
	documents,
	opportunities,
	proposalDocuments,
	submissions,
} from "@/lib/db/schema";
import { complianceMatrices } from "@/lib/db/schema-rfp";
import { claimAnalysis } from "@/lib/db/schema-evidence";
import { workflowInstances } from "@/lib/db/schema-workflow-runtime";
import {
	hasBlockingDlpFindings,
	scanDocumentsForDlpFindings,
	summarizeDlpFindings,
	type DlpFinding,
} from "@/lib/security/dlp-policy";
import type { ProposalDocumentType, SubmissionAttachment } from "@/lib/types/opportunity";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_FINAL_SUBMISSION_RECORD_RUN_ID ?? createProofRunId("live_final_submission_record");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "final-submission-record" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-final-submission-record-evidence.md");
const LIMIT = boundedNumber(process.env.LIVE_FINAL_SUBMISSION_RECORD_LIMIT, 3, 1, 25);
const APPLY = process.env.LIVE_FINAL_SUBMISSION_RECORD_APPLY === "1";
const TARGET_OPPORTUNITY_IDS = csvStrings(process.env.LIVE_FINAL_SUBMISSION_RECORD_OPPORTUNITY_IDS);
const USER_ID = (process.env.LIVE_FINAL_SUBMISSION_RECORD_USER_ID ?? process.env.DISCOVERY_IMPORT_USER_ID ?? "system").slice(0, 100);
const RECEIPT_REFERENCE = nonEmpty(process.env.LIVE_FINAL_SUBMISSION_RECORD_CONFIRMATION_NUMBER);
const SUBMISSION_METHOD = nonEmpty(process.env.LIVE_FINAL_SUBMISSION_RECORD_METHOD);
const SUBMISSION_NOTES = nonEmpty(process.env.LIVE_FINAL_SUBMISSION_RECORD_NOTES)
	?? `Recorded by final-submission service run ${RUN_ID}.`;

const REQUIRED_DOCUMENT_TYPES = new Set(["technical_approach", "management_plan", "cost_proposal"]);

let db: typeof import("@/lib/db")["db"];
let closeDatabaseConnection: typeof import("@/lib/db")["closeDatabaseConnection"] = async () => undefined;
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type CandidateRow = {
	opportunityId: string;
	title: string;
	organizationId: string;
	assignedTo: string | null;
	deadline: Date | null;
	submissionMethod: string | null;
};

type ProposalDocRow = {
	proposalDocumentId: string;
	documentType: string;
	proposalStatus: string;
	approvedBy: string | null;
	approvedAt: Date | null;
	documentId: string;
	title: string;
	documentStatus: string;
	content: unknown;
	plainText: string;
	wordCount: number;
	currentVersion: number | null;
	aiAnalysisScore: number | null;
	metadata: unknown;
};

type StoredFinalArtifactManifest = {
	artifactHash: string;
	filename: string;
	mimeType: string;
	size: number;
	downloadUrl?: string;
	storagePath: string;
	storageBucket: string;
	storageKey: string;
	storageEtag: string | null;
	storageEndpoint: string;
	storageReadbackHash: string;
	storageReadbackSize: number;
	storageReadbackAt: string | Date;
	approvedBy: string;
	approvedAt: string | Date;
	sourceDocumentVersion: number | null;
	sourceContentHash: string;
};

type ResponsePackageReadiness = {
	workflowInstanceId: string;
	status: string;
	blockers: string[];
	metrics: Record<string, unknown>;
};

type SubmissionAssessment = {
	opportunityId: string;
	title: string;
	readyToRecord: boolean;
	blockers: string[];
	warnings: string[];
	documentCount: number;
	requiredDocumentCount: number;
	attachmentCount: number;
	receiptReference: string | null;
	submissionMethod: string;
	complianceMatrixId: string | null;
	responseReadinessWorkflowId: string | null;
	dlpFindingCount: number;
	blockingDlpFindingCount: number;
	submissionId?: string;
};

type SubmissionRecordProof = {
	runId: string;
	startedAt: string;
	completedAt?: string;
	apply: boolean;
	limit: number;
	targetOpportunityIds: string[];
	receiptProvided: boolean;
	candidatesFound: number;
	assessed: SubmissionAssessment[];
	skipped: Array<{
		opportunityId?: string;
		title?: string;
		reason: string;
	}>;
	error?: string;
};

async function main() {
	forceLocalEnv(["DATABASE_URL"]);
	await loadRuntime();

	const proof: SubmissionRecordProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		apply: APPLY,
		limit: LIMIT,
		targetOpportunityIds: TARGET_OPPORTUNITY_IDS,
		receiptProvided: Boolean(RECEIPT_REFERENCE),
		candidatesFound: 0,
		assessed: [],
		skipped: [],
	};
	let disposition: EvidenceRecord["disposition"] = "fail";

	try {
		if (APPLY && !RECEIPT_REFERENCE) {
			throw new Error("Apply mode requires LIVE_FINAL_SUBMISSION_RECORD_CONFIRMATION_NUMBER");
		}
		const candidates = await selectCandidates();
		proof.candidatesFound = candidates.length;
		for (const candidate of candidates) {
			try {
				proof.assessed.push(APPLY
					? await recordSubmission(candidate)
					: await assessCandidate(candidate, db));
			} catch (error) {
				proof.skipped.push({
					opportunityId: candidate.opportunityId,
					title: candidate.title,
					reason: error instanceof Error ? error.message : String(error),
				});
			}
		}
		proof.completedAt = new Date().toISOString();
		disposition = proof.assessed.some((item) => item.readyToRecord) ? "pass" : "blocked";
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		disposition = "fail";
	} finally {
		await writeArtifacts(proof, disposition);
		await closeDatabaseConnection().catch(() => undefined);
	}

	console.log(JSON.stringify(proof, null, 2));
	if (disposition === "fail") process.exit(1);
}

async function loadRuntime(): Promise<void> {
	const databaseModule = await import("@/lib/db");
	db = databaseModule.db;
	closeDatabaseConnection = databaseModule.closeDatabaseConnection;
}

async function selectCandidates(): Promise<CandidateRow[]> {
	const conditions = [
		sql`${opportunities.organizationId} is not null`,
		sql`exists (
			select 1 from proposal_documents
			join documents on documents.id = proposal_documents.document_id
			where proposal_documents.opportunity_id = ${opportunities.id}
				and proposal_documents.status = 'final'
				and documents.status = 'final'
				and documents.metadata->'finalArtifact' is not null
		)`,
		sql`not exists (
			select 1 from submissions
			where submissions.opportunity_id = ${opportunities.id}
				and submissions.status in ('submitted', 'under_review', 'awarded', 'rejected')
		)`,
	];
	if (TARGET_OPPORTUNITY_IDS.length > 0) {
		conditions.push(inArray(opportunities.id, TARGET_OPPORTUNITY_IDS));
	}

	return db
		.select({
			opportunityId: opportunities.id,
			title: opportunities.title,
			organizationId: sql<string>`${opportunities.organizationId}`,
			assignedTo: opportunities.assignedTo,
			deadline: opportunities.deadline,
			submissionMethod: opportunities.submissionMethod,
		})
		.from(opportunities)
		.where(and(...conditions))
		.orderBy(desc(opportunities.updatedAt))
		.limit(LIMIT);
}

async function recordSubmission(candidate: CandidateRow): Promise<SubmissionAssessment> {
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${candidate.opportunityId}))`);
		const assessment = await assessCandidate(candidate, tx);
		if (!assessment.readyToRecord) {
			throw new Error(`Final submission is not recordable: ${assessment.blockers.join("; ")}`);
		}
		if (!RECEIPT_REFERENCE) {
			throw new Error("Apply mode requires a submission receipt reference");
		}
		const docs = await loadProposalDocs(candidate, tx);
		const attachments = docs
			.map((doc) => submissionAttachment(doc))
			.filter((attachment): attachment is SubmissionAttachment => Boolean(attachment));
		const now = new Date();
		const [row] = await tx
			.insert(submissions)
			.values({
				organizationId: candidate.organizationId,
				opportunityId: candidate.opportunityId,
				submittedAt: now,
				submittedBy: USER_ID,
				submissionMethod: assessment.submissionMethod,
				confirmationNumber: RECEIPT_REFERENCE,
				attachments,
				notes: SUBMISSION_NOTES,
				status: "submitted",
			})
			.returning({ id: submissions.id });
		await tx
			.update(opportunities)
			.set({
				decisionStatus: "submitted",
				updatedAt: now,
			})
			.where(eq(opportunities.id, candidate.opportunityId));
		await recordWorkflowRuntimeTransition({
			workflowKey: "production_submission",
			organizationId: candidate.organizationId,
			subjectType: "submission",
			subjectId: row.id,
			opportunityId: candidate.opportunityId,
			fromState: "final_review",
			toState: "submitted",
			eventType: "submission_dispatched",
			actorId: USER_ID,
			actorName: USER_ID,
			reason: `Submission receipt ${RECEIPT_REFERENCE} recorded by final-submission service`,
			evidenceLinks: submissionEvidenceLinks(RECEIPT_REFERENCE, attachments),
			priority: "critical",
			visibility: "internal",
			authorityPolicy: {
				requiredRoles: ["proposal_manager", "executive"],
				allowedActorIds: [USER_ID],
				escalationRole: "executive",
			},
			metadata: {
				attachmentCount: attachments.length,
				attachments,
				complianceMatrixId: assessment.complianceMatrixId,
				responseReadinessWorkflowId: assessment.responseReadinessWorkflowId,
				submissionMethod: assessment.submissionMethod,
				source: "final-submission-record",
				runId: RUN_ID,
			},
			terminal: true,
		}, tx);
		return {
			...assessment,
			submissionId: row.id,
		};
	});
}

async function assessCandidate(candidate: CandidateRow, client: DbClient): Promise<SubmissionAssessment> {
	const [docs, matrix, readiness, highRiskClaimCount] = await Promise.all([
		loadProposalDocs(candidate, client),
		loadComplianceMatrix(candidate, client),
		loadResponsePackageReadiness(candidate, client),
		loadHighRiskClaimCount(candidate, client),
	]);
	const blockers: string[] = [];
	const warnings: string[] = [];
	const method = SUBMISSION_METHOD ?? normalizeSubmissionMethod(candidate.submissionMethod);
	const dlpFindings = scanDocumentsForDlpFindings(docs.map((doc) => ({
		documentId: doc.documentId,
		title: doc.title,
		content: doc.content,
	})));

	if (APPLY && !RECEIPT_REFERENCE) {
		blockers.push("Submission receipt reference is required in apply mode");
	}
	if (!candidate.assignedTo) {
		blockers.push("Opportunity is not assigned to a submission actor");
	}
	if (candidate.deadline && candidate.deadline.getTime() < Date.now()) {
		blockers.push("Submission deadline has passed");
	}
	if (!candidate.submissionMethod && !SUBMISSION_METHOD) {
		warnings.push("Opportunity has no stored submission method; using service default 'other'");
	}
	if (docs.length === 0) {
		blockers.push("No finalized proposal documents are available for submission");
	}

	const docTypes = new Set(docs.map((doc) => doc.documentType));
	for (const requiredType of REQUIRED_DOCUMENT_TYPES) {
		if (!docTypes.has(requiredType)) {
			blockers.push(`Missing required final proposal document: ${requiredType}`);
		}
	}
	for (const doc of docs) {
		validateProposalDocument(doc, blockers);
	}

	if (!matrix) {
		blockers.push("A final or submitted compliance matrix with approval is required");
	} else {
		const unresolvedCount = Number(matrix.notAddressedCount ?? 0) + Number(matrix.nonCompliantCount ?? 0);
		const mandatoryScore = Number(matrix.mandatoryComplianceScore ?? 0);
		if (!["final", "submitted"].includes(matrix.status)) {
			blockers.push(`Compliance matrix status is ${matrix.status}, not final/submitted`);
		}
		if (!matrix.approvedBy || !matrix.approvedAt) {
			blockers.push("Compliance matrix approval receipt is required");
		}
		if (unresolvedCount > 0) {
			blockers.push(`Compliance matrix still has ${unresolvedCount} unresolved compliance gaps`);
		}
		if (mandatoryScore < 100) {
			blockers.push(`Mandatory compliance score is ${mandatoryScore}, below 100`);
		}
	}

	if (!readiness) {
		blockers.push("Response package readiness assessment is missing");
	} else {
		validateResponseReadiness(readiness, blockers, warnings);
	}
	if (highRiskClaimCount > 0) {
		blockers.push(`${highRiskClaimCount} unresolved high-risk unsupported claim(s) remain`);
	}
	if (hasBlockingDlpFindings(dlpFindings)) {
		blockers.push(`Blocking DLP findings: ${summarizeDlpFindings(dlpFindings)}`);
	}

	const attachments = docs
		.map((doc) => submissionAttachment(doc))
		.filter(Boolean);

	return {
		opportunityId: candidate.opportunityId,
		title: candidate.title,
		readyToRecord: blockers.length === 0,
		blockers,
		warnings,
		documentCount: docs.length,
		requiredDocumentCount: docs.filter((doc) => REQUIRED_DOCUMENT_TYPES.has(doc.documentType)).length,
		attachmentCount: attachments.length,
		receiptReference: RECEIPT_REFERENCE,
		submissionMethod: method,
		complianceMatrixId: matrix?.id ?? null,
		responseReadinessWorkflowId: readiness?.workflowInstanceId ?? null,
		dlpFindingCount: dlpFindings.length,
		blockingDlpFindingCount: dlpFindings.filter(isBlockingDlpFinding).length,
	};
}

async function loadProposalDocs(candidate: CandidateRow, client: DbClient): Promise<ProposalDocRow[]> {
	return client
		.select({
			proposalDocumentId: proposalDocuments.id,
			documentType: proposalDocuments.documentType,
			proposalStatus: proposalDocuments.status,
			approvedBy: proposalDocuments.approvedBy,
			approvedAt: proposalDocuments.approvedAt,
			documentId: documents.id,
			title: documents.title,
			documentStatus: documents.status,
			content: documents.content,
			plainText: sql<string>`coalesce(${documents.plainText}, '')`,
			wordCount: documents.wordCount,
			currentVersion: documents.currentVersion,
			aiAnalysisScore: proposalDocuments.aiAnalysisScore,
			metadata: documents.metadata,
		})
		.from(proposalDocuments)
		.innerJoin(documents, eq(documents.id, proposalDocuments.documentId))
		.where(and(
			eq(proposalDocuments.opportunityId, candidate.opportunityId),
			or(eq(proposalDocuments.organizationId, candidate.organizationId), isNull(proposalDocuments.organizationId))!
		))
		.orderBy(asc(proposalDocuments.sectionOrder), asc(proposalDocuments.createdAt));
}

async function loadComplianceMatrix(candidate: CandidateRow, client: DbClient) {
	const [matrix] = await client
		.select()
		.from(complianceMatrices)
		.where(and(
			eq(complianceMatrices.opportunityId, candidate.opportunityId),
			or(eq(complianceMatrices.organizationId, candidate.organizationId), isNull(complianceMatrices.organizationId))!
		))
		.orderBy(desc(complianceMatrices.updatedAt))
		.limit(1);
	return matrix;
}

async function loadResponsePackageReadiness(
	candidate: CandidateRow,
	client: DbClient
): Promise<ResponsePackageReadiness | null> {
	const [instance] = await client
		.select({
			id: workflowInstances.id,
			state: workflowInstances.state,
			metadata: workflowInstances.metadata,
		})
		.from(workflowInstances)
		.where(and(
			eq(workflowInstances.workflowKey, "proposal_response_package"),
			eq(workflowInstances.subjectType, "opportunity"),
			eq(workflowInstances.subjectId, candidate.opportunityId),
			or(eq(workflowInstances.organizationId, candidate.organizationId), isNull(workflowInstances.organizationId))!
		))
		.orderBy(desc(workflowInstances.updatedAt))
		.limit(1);
	const readiness = recordObject(recordObject(instance?.metadata).readiness);
	if (!instance || Object.keys(readiness).length === 0) {
		return null;
	}
	return {
		workflowInstanceId: instance.id,
		status: typeof readiness.status === "string" ? readiness.status : "unknown",
		blockers: stringArray(readiness.blockers),
		metrics: recordObject(readiness.metrics),
	};
}

async function loadHighRiskClaimCount(candidate: CandidateRow, client: DbClient): Promise<number> {
	const [row] = await client
		.select({
			count: sql<number>`count(*)::int`,
		})
		.from(claimAnalysis)
		.where(and(
			eq(claimAnalysis.opportunityId, candidate.opportunityId),
			eq(claimAnalysis.riskLevel, "high"),
			sql`coalesce(${claimAnalysis.status}, '') not in ('resolved', 'wont_fix')`
		));
	return row?.count ?? 0;
}

function validateProposalDocument(doc: ProposalDocRow, blockers: string[]): void {
	if (doc.proposalStatus !== "final" || !doc.approvedBy || !doc.approvedAt) {
		blockers.push(`${doc.documentType} is not final-approved`);
	}
	if (doc.documentStatus !== "final") {
		blockers.push(`${doc.documentType} document status is ${doc.documentStatus}, not final`);
	}
	if (doc.wordCount < 100) {
		blockers.push(`${doc.documentType} is incomplete: ${doc.wordCount} words`);
	}
	if (doc.aiAnalysisScore !== null && doc.aiAnalysisScore < 70) {
		blockers.push(`${doc.documentType} quality score is ${doc.aiAnalysisScore}, below 70`);
	}
	if (!finalArtifactManifest(doc.metadata, doc)) {
		blockers.push(`${doc.documentType} lacks an approved current final artifact with storage readback`);
	}
	const signoff = recordObject(recordObject(doc.metadata).finalSubmissionSignoff);
	if (typeof signoff.signedBy !== "string" || !signoff.signedBy || !signoff.signedAt) {
		blockers.push(`${doc.documentType} lacks final submission signoff metadata`);
	}
}

function validateResponseReadiness(
	readiness: ResponsePackageReadiness,
	blockers: string[],
	warnings: string[]
): void {
	if (readiness.status !== "ready_for_review") {
		blockers.push(`Response package readiness is ${readiness.status}, not ready_for_review`);
	}
	if (readiness.blockers.length > 0) {
		blockers.push(`Response package has readiness blockers: ${readiness.blockers.join("; ")}`);
	}
	const metrics = readiness.metrics;
	const requirementCoverage = ratioMetric(metrics.requirementCoverage);
	const sourceCoverage = ratioMetric(metrics.sourceCitationCoverage);
	const evidenceCoverage = ratioMetric(metrics.evidenceCitationCoverage);
	const draftIntegrity = ratioMetric(metrics.draftArtifactIntegrityCoverage);
	if (requirementCoverage < 1) {
		blockers.push(`Response requirement coverage is ${formatPercent(requirementCoverage)}`);
	}
	if (sourceCoverage < 1) {
		blockers.push(`Response source citation coverage is ${formatPercent(sourceCoverage)}`);
	}
	if (evidenceCoverage < 1) {
		blockers.push(`Response evidence citation coverage is ${formatPercent(evidenceCoverage)}`);
	}
	if (draftIntegrity < 1) {
		blockers.push(`Response draft artifact integrity is ${formatPercent(draftIntegrity)}`);
	}
	const winThemeCriteriaCoverage = optionalRatioMetric(metrics.winThemeCriteriaCoverage);
	if (winThemeCriteriaCoverage !== null && winThemeCriteriaCoverage < 1) {
		blockers.push(`Evaluator criteria win-theme coverage is ${formatPercent(winThemeCriteriaCoverage)}`);
	}
	if (winThemeCriteriaCoverage === null) {
		warnings.push("Response readiness did not report evaluator criteria win-theme coverage");
	}
}

function finalArtifactManifest(
	metadata: unknown,
	document: Pick<ProposalDocRow, "title" | "content" | "plainText" | "currentVersion">
): StoredFinalArtifactManifest | null {
	const artifact = recordObject(recordObject(metadata).finalArtifact);
	if (
		typeof artifact.artifactHash !== "string" ||
		typeof artifact.filename !== "string" ||
		typeof artifact.mimeType !== "string" ||
		typeof artifact.size !== "number" ||
		typeof artifact.storagePath !== "string" ||
		typeof artifact.storageBucket !== "string" ||
		typeof artifact.storageKey !== "string" ||
		typeof artifact.storageEndpoint !== "string" ||
		artifact.storageReadbackHash !== artifact.artifactHash ||
		typeof artifact.storageReadbackSize !== "number" ||
		!Number.isFinite(artifact.storageReadbackSize) ||
		artifact.storageReadbackSize <= 0 ||
		!(typeof artifact.storageReadbackAt === "string" || artifact.storageReadbackAt instanceof Date) ||
		typeof artifact.approvedBy !== "string" ||
		!(typeof artifact.approvedAt === "string" || artifact.approvedAt instanceof Date) ||
		!("sourceDocumentVersion" in artifact) ||
		!(typeof artifact.sourceDocumentVersion === "number" || artifact.sourceDocumentVersion === null) ||
		typeof artifact.sourceContentHash !== "string" ||
		artifact.sourceDocumentVersion !== document.currentVersion ||
		artifact.sourceContentHash !== hashDocumentSource(document)
	) {
		return null;
	}
	return {
		artifactHash: artifact.artifactHash,
		filename: artifact.filename,
		mimeType: artifact.mimeType,
		size: artifact.size,
		downloadUrl: typeof artifact.downloadUrl === "string" ? artifact.downloadUrl : undefined,
		storagePath: artifact.storagePath,
		storageBucket: artifact.storageBucket,
		storageKey: artifact.storageKey,
		storageEtag: typeof artifact.storageEtag === "string" ? artifact.storageEtag : null,
		storageEndpoint: artifact.storageEndpoint,
		storageReadbackHash: artifact.storageReadbackHash,
		storageReadbackSize: artifact.storageReadbackSize,
		storageReadbackAt: artifact.storageReadbackAt,
		approvedBy: artifact.approvedBy,
		approvedAt: artifact.approvedAt,
		sourceDocumentVersion: artifact.sourceDocumentVersion,
		sourceContentHash: artifact.sourceContentHash,
	};
}

function submissionAttachment(doc: ProposalDocRow): SubmissionAttachment | null {
	const artifact = finalArtifactManifest(doc.metadata, doc);
	if (!artifact) return null;
	return {
		documentId: doc.documentId,
		documentTitle: doc.title,
		documentType: doc.documentType as ProposalDocumentType,
		filename: artifact.filename,
		mimeType: artifact.mimeType,
		size: artifact.size,
		artifactHash: artifact.artifactHash,
		downloadUrl: artifact.downloadUrl,
		storagePath: artifact.storagePath,
		storageBucket: artifact.storageBucket,
		storageKey: artifact.storageKey,
		storageEtag: artifact.storageEtag,
		storageEndpoint: artifact.storageEndpoint,
		storageReadbackHash: artifact.storageReadbackHash,
		storageReadbackSize: artifact.storageReadbackSize,
		storageReadbackAt: artifact.storageReadbackAt,
		approvedBy: artifact.approvedBy,
		approvedAt: artifact.approvedAt,
		sourceDocumentVersion: artifact.sourceDocumentVersion,
		sourceContentHash: artifact.sourceContentHash,
		lockedAt: new Date().toISOString(),
	};
}

function submissionEvidenceLinks(confirmationNumber: string, attachments: SubmissionAttachment[]): string[] {
	const links = new Set<string>([confirmationNumber, `submission:receipt:${confirmationNumber}`]);
	for (const attachment of attachments) {
		if (attachment.artifactHash) links.add(`artifact:sha256:${attachment.artifactHash}`);
		if (attachment.storagePath) links.add(`artifact:storage:${attachment.storagePath}`);
		if (attachment.sourceContentHash) links.add(`source:sha256:${attachment.sourceContentHash}`);
	}
	return [...links];
}

function hashDocumentSource(doc: Pick<ProposalDocRow, "title" | "content" | "plainText">): string {
	return createHash("sha256")
		.update(JSON.stringify({
			title: doc.title,
			content: doc.content,
			plainText: doc.plainText,
		}))
		.digest("hex");
}

function normalizeSubmissionMethod(value: string | null): string {
	const normalized = value?.trim().toLowerCase();
	if (!normalized) return "other";
	if (normalized.includes("portal")) return "portal";
	if (normalized.includes("email")) return "email";
	if (normalized.includes("physical") || normalized.includes("hard")) return "physical";
	if (normalized.includes("ftp")) return "ftp";
	return "other";
}

function isBlockingDlpFinding(finding: DlpFinding): boolean {
	return finding.severity === "critical" || finding.severity === "high";
}

function ratioMetric(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value)
		? Math.min(1, Math.max(0, value))
		: 0;
}

function optionalRatioMetric(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value)
		? Math.min(1, Math.max(0, value))
		: null;
}

function formatPercent(value: number): string {
	return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

function recordObject(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value) ? { ...value } as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function boundedNumber(raw: string | undefined, defaultValue: number, min: number, max: number): number {
	const parsed = raw === undefined ? defaultValue : Number(raw);
	if (!Number.isFinite(parsed)) return defaultValue;
	return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function csvStrings(raw: string | undefined): string[] {
	return raw
		?.split(",")
		.map((value) => value.trim())
		.filter(Boolean) ?? [];
}

function nonEmpty(value: string | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

async function writeArtifacts(proof: SubmissionRecordProof, disposition: EvidenceRecord["disposition"]): Promise<void> {
	const artifactPath = await writeProofJson(LOG_DIR, "final-submission-record.json", proof);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "final submission record",
		journey: "approved stored final artifacts to auditable submission receipt",
		run_id: proof.runId,
		artifact_ids: [
			path.relative(WORKSPACE_ROOT, artifactPath),
			`candidates:${proof.candidatesFound}`,
			`assessed:${proof.assessed.length}`,
			`ready:${proof.assessed.filter((item) => item.readyToRecord).length}`,
			`apply:${String(proof.apply)}`,
		],
		topology_tier: "live database",
		verification_bucket: "submission dispatch receipt",
		timestamp: proof.completedAt ?? new Date().toISOString(),
		operator: USER_ID,
		cleanup_status: proof.apply ? "not-applicable" : "idempotent-noop",
		disposition,
		notes: proof.assessed.length > 0
			? `Assessed ${proof.assessed.length} final package(s) for submission receipt recording.`
			: proof.error ?? "No finalized packages were eligible for submission receipt recording.",
	}], { title: "Final Submission Record Evidence" });
}

void main();
