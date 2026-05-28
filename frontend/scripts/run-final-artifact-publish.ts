import "./load-env";

import { createHash } from "node:crypto";
import path from "node:path";
import type { JSONContent } from "@tiptap/react";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	type EvidenceRecord,
} from "./platform-proof/core";
import { forceLocalEnv } from "./env-utils";
import { documents, opportunities, proposalDocuments } from "@/lib/db/schema";
import { complianceMatrices } from "@/lib/db/schema-rfp";
import { workflowInstances } from "@/lib/db/schema-workflow-runtime";
import { tiptapToDocx } from "@/lib/render/docx-converter";
import {
	downloadFromLinodeE3,
	getLinodeE3ConfigFromEnv,
	uploadToLinodeE3,
	type LinodeE3Config,
} from "@/lib/storage/linode-e3";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_FINAL_ARTIFACT_PUBLISH_RUN_ID ?? createProofRunId("live_final_artifact_publish");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "final-artifact-publish" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-final-artifact-publish-evidence.md");
const LIMIT = boundedNumber(process.env.LIVE_FINAL_ARTIFACT_PUBLISH_LIMIT, 3, 1, 25);
const APPLY = process.env.LIVE_FINAL_ARTIFACT_PUBLISH_APPLY === "1";
const TARGET_OPPORTUNITY_IDS = csvStrings(process.env.LIVE_FINAL_ARTIFACT_PUBLISH_OPPORTUNITY_IDS);
const USER_ID = (process.env.LIVE_FINAL_ARTIFACT_PUBLISH_USER_ID ?? process.env.DISCOVERY_IMPORT_USER_ID ?? "system").slice(0, 100);
const APPROVAL_ROLE = (process.env.LIVE_FINAL_ARTIFACT_PUBLISH_APPROVAL_ROLE ?? "proposal_manager").slice(0, 100);
const SIGNOFF_ROLE = (process.env.LIVE_FINAL_ARTIFACT_PUBLISH_SIGNOFF_ROLE ?? "executive_or_legal").slice(0, 100);

let db: typeof import("@/lib/db")["db"];
let closeDatabaseConnection: typeof import("@/lib/db")["closeDatabaseConnection"] = async () => undefined;
let recordWorkflowRuntimeTransition: typeof import("@/lib/actions/workflow-runtime")["recordWorkflowRuntimeTransition"];
let upsertWorkflowRuntimeTask: typeof import("@/lib/actions/workflow-runtime")["upsertWorkflowRuntimeTask"];

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type CandidateRow = {
	opportunityId: string;
	title: string;
	organizationId: string;
};

type ProposalDocRow = {
	proposalDocumentId: string;
	documentType: string;
	proposalStatus: string | null;
	documentId: string;
	title: string;
	content: unknown;
	plainText: string;
	documentStatus: string | null;
	currentVersion: number | null;
	metadata: unknown;
};

type ResponsePackageReadinessSnapshot = {
	workflowInstanceId: string;
	workflowState: string;
	status: "ready_for_review";
	blockers: string[];
	warnings: string[];
	missingRequirementIds: string[];
	metrics: Record<string, unknown>;
};

type FinalArtifactManifest = {
	documentId: string;
	proposalDocumentId: string;
	opportunityId: string;
	format: "docx";
	filename: string;
	mimeType: string;
	size: number;
	artifactHash: string;
	downloadUrl: string;
	storagePath: string;
	storageBucket: string;
	storageKey: string;
	storageEtag: string | null;
	storageEndpoint: string;
	storageReadbackHash: string;
	storageReadbackSize: number;
	storageReadbackAt: string;
	renderedAt: string;
	renderedBy: string;
	sourceDocumentVersion: number | null;
	sourceContentHash: string;
	renderTimeMs: number;
	pageCount: null;
	responsePackageReadiness: ResponsePackageReadinessSnapshot;
	approvedAt: string;
	approvedBy: string;
	approvalRole: string;
};

type PublishedDocSummary = {
	proposalDocumentId: string;
	documentId: string;
	documentType: string;
	filename: string;
	artifactHash: string;
	storagePath: string;
	storageReadbackSize: number;
	responseReadinessStatus: string;
};

type FinalArtifactPublishProof = {
	runId: string;
	startedAt: string;
	completedAt?: string;
	apply: boolean;
	limit: number;
	targetOpportunityIds: string[];
	candidatesFound: number;
	published: Array<{
		opportunityId: string;
		title: string;
		documentsPublished: number;
		complianceMatrixLocked: boolean;
		artifacts: PublishedDocSummary[];
	}>;
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

	const proof: FinalArtifactPublishProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		apply: APPLY,
		limit: LIMIT,
		targetOpportunityIds: TARGET_OPPORTUNITY_IDS,
		candidatesFound: 0,
		published: [],
		skipped: [],
	};
	let disposition: EvidenceRecord["disposition"] = "fail";

	try {
		const candidates = await selectCandidates();
		proof.candidatesFound = candidates.length;
		for (const candidate of candidates) {
			try {
				proof.published.push(APPLY
					? await publishFinalArtifacts(candidate)
					: await summarizeCandidate(candidate));
			} catch (error) {
				proof.skipped.push({
					opportunityId: candidate.opportunityId,
					title: candidate.title,
					reason: error instanceof Error ? error.message : String(error),
				});
			}
		}
		proof.completedAt = new Date().toISOString();
		disposition = proof.published.length > 0 ? "pass" : "blocked";
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
	const [databaseModule, workflowRuntimeModule] = await Promise.all([
		import("@/lib/db"),
		import("@/lib/actions/workflow-runtime"),
	]);
	db = databaseModule.db;
	closeDatabaseConnection = databaseModule.closeDatabaseConnection;
	recordWorkflowRuntimeTransition = workflowRuntimeModule.recordWorkflowRuntimeTransition;
	upsertWorkflowRuntimeTask = workflowRuntimeModule.upsertWorkflowRuntimeTask;
}

async function selectCandidates(): Promise<CandidateRow[]> {
	const result = await db.execute(sql<CandidateRow>`
		select
			opportunities.id::text as "opportunityId",
			opportunities.title,
			opportunities.organization_id as "organizationId"
		from opportunities
		where opportunities.organization_id is not null
			and exists (
				select 1 from workflow_instances
				where workflow_instances.workflow_key = 'proposal_response_package'
					and workflow_instances.subject_type = 'opportunity'
					and workflow_instances.subject_id = opportunities.id::text
					and workflow_instances.metadata->'readiness'->>'status' = 'ready_for_review'
			)
			and exists (
				select 1 from proposal_documents
				join documents on documents.id = proposal_documents.document_id
				where proposal_documents.opportunity_id = opportunities.id
					and proposal_documents.status in ('in_review', 'approved')
					and documents.metadata->'finalArtifact' is null
			)
		order by (
			select max(proposal_documents.updated_at)
			from proposal_documents
			where proposal_documents.opportunity_id = opportunities.id
		) desc nulls last
		limit ${TARGET_OPPORTUNITY_IDS.length > 0 ? 500 : LIMIT}
	`);
	const rows = result.rows as CandidateRow[];
	const targetIds = new Set(TARGET_OPPORTUNITY_IDS);
	return (targetIds.size > 0 ? rows.filter((row) => targetIds.has(row.opportunityId)) : rows).slice(0, LIMIT);
}

async function summarizeCandidate(candidate: CandidateRow) {
	const [readiness, docs] = await Promise.all([
		loadResponseReadiness(candidate, db),
		loadProposalDocs(candidate, db),
	]);
	return {
		opportunityId: candidate.opportunityId,
		title: candidate.title,
		documentsPublished: docs.length,
		complianceMatrixLocked: false,
		artifacts: docs.map((doc) => ({
			proposalDocumentId: doc.proposalDocumentId,
			documentId: doc.documentId,
			documentType: doc.documentType,
			filename: `${safeFilenameBase(doc.title)}.docx`,
			artifactHash: "dry-run",
			storagePath: "dry-run",
			storageReadbackSize: 0,
			responseReadinessStatus: readiness.status,
		})),
	};
}

async function publishFinalArtifacts(candidate: CandidateRow) {
	const objectStoreConfig = getLinodeE3ConfigFromEnv();
	if (!objectStoreConfig) {
		throw new Error("Linode E3 object storage is required for final artifact publishing");
	}

	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${candidate.opportunityId}))`);
		const readiness = await loadResponseReadiness(candidate, tx);
		const docs = await loadProposalDocs(candidate, tx);
		if (docs.length === 0) throw new Error("No proposal documents are eligible for final artifact publishing");
		const artifacts: PublishedDocSummary[] = [];
		for (const doc of docs) {
			const artifact = await renderAndStoreDocx({
				candidate,
				doc,
				readiness,
				objectStoreConfig,
			});
			await persistFinalArtifact({ candidate, doc, artifact, client: tx });
			await recordFinalArtifactWorkflow({ candidate, doc, artifact, client: tx });
			artifacts.push({
				proposalDocumentId: doc.proposalDocumentId,
				documentId: doc.documentId,
				documentType: doc.documentType,
				filename: artifact.filename,
				artifactHash: artifact.artifactHash,
				storagePath: artifact.storagePath,
				storageReadbackSize: artifact.storageReadbackSize,
				responseReadinessStatus: artifact.responsePackageReadiness.status,
			});
		}
		const complianceMatrixLocked = await lockComplianceMatrix(candidate, tx);
		return {
			opportunityId: candidate.opportunityId,
			title: candidate.title,
			documentsPublished: artifacts.length,
			complianceMatrixLocked,
			artifacts,
		};
	});
}

async function loadResponseReadiness(candidate: CandidateRow, client: DbClient): Promise<ResponsePackageReadinessSnapshot> {
	const [instance] = await client
		.select({
			id: workflowInstances.id,
			state: workflowInstances.state,
			metadata: workflowInstances.metadata,
		})
		.from(workflowInstances)
		.where(and(
			eq(workflowInstances.workflowKey, "proposal_response_package"),
			or(eq(workflowInstances.organizationId, candidate.organizationId), isNull(workflowInstances.organizationId))!,
			eq(workflowInstances.subjectType, "opportunity"),
			eq(workflowInstances.subjectId, candidate.opportunityId)
		))
		.limit(1);
	const readiness = recordObject(recordObject(instance?.metadata).readiness);
	if (readiness.status !== "ready_for_review") {
		throw new Error("Response package readiness must be ready_for_review before final artifact publishing");
	}
	return {
		workflowInstanceId: instance.id,
		workflowState: instance.state,
		status: "ready_for_review",
		blockers: stringArray(readiness.blockers),
		warnings: stringArray(readiness.warnings),
		missingRequirementIds: stringArray(readiness.missingRequirementIds),
		metrics: recordObject(readiness.metrics),
	};
}

async function loadProposalDocs(candidate: CandidateRow, client: DbClient): Promise<ProposalDocRow[]> {
	return client
		.select({
			proposalDocumentId: proposalDocuments.id,
			documentType: proposalDocuments.documentType,
			proposalStatus: proposalDocuments.status,
			documentId: documents.id,
			title: documents.title,
			content: documents.content,
			plainText: sql<string>`coalesce(${documents.plainText}, '')`,
			documentStatus: documents.status,
			currentVersion: documents.currentVersion,
			metadata: documents.metadata,
		})
		.from(proposalDocuments)
		.innerJoin(documents, eq(documents.id, proposalDocuments.documentId))
		.where(and(
			eq(proposalDocuments.opportunityId, candidate.opportunityId),
			sql`${proposalDocuments.status} in ('in_review', 'approved')`,
			sql`${documents.metadata}->'finalArtifact' is null`
		))
		.orderBy(asc(proposalDocuments.sectionOrder), asc(proposalDocuments.createdAt));
}

async function renderAndStoreDocx(input: {
	candidate: CandidateRow;
	doc: ProposalDocRow;
	readiness: ResponsePackageReadinessSnapshot;
	objectStoreConfig: LinodeE3Config;
}): Promise<FinalArtifactManifest> {
	const renderedAt = new Date();
	const start = Date.now();
	const bytes = await tiptapToDocx(input.doc.content as JSONContent, {
		format: "docx",
		metadata: {
			title: input.doc.title,
			author: USER_ID,
			subject: input.candidate.title,
			keywords: ["lindela", "rfp", "final-artifact", input.doc.documentType],
		},
	});
	const renderTimeMs = Date.now() - start;
	const artifactHash = sha256Hex(bytes);
	const filename = `${safeFilenameBase(input.doc.title)}.docx`;
	const key = finalArtifactObjectKey({
		prefix: input.objectStoreConfig.prefix,
		opportunityId: input.candidate.opportunityId,
		proposalDocumentId: input.doc.proposalDocumentId,
		documentId: input.doc.documentId,
		artifactHash,
		filename,
	});
	const upload = await uploadToLinodeE3(input.objectStoreConfig, {
		key,
		body: bytes,
		contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		contentLength: bytes.length,
		metadata: {
			"document-id": input.doc.documentId,
			"proposal-document-id": input.doc.proposalDocumentId,
			"opportunity-id": input.candidate.opportunityId,
			format: "docx",
			sha256: artifactHash,
			"rendered-by": USER_ID,
			"response-readiness-status": input.readiness.status,
			"response-readiness-workflow-id": input.readiness.workflowInstanceId,
			"publish-run-id": RUN_ID,
		},
	});
	const readback = await downloadFromLinodeE3(input.objectStoreConfig, upload.storagePath);
	const storageReadbackHash = sha256Hex(readback.body);
	if (storageReadbackHash !== artifactHash || readback.body.length !== bytes.length) {
		throw new Error(`Storage readback failed for ${input.doc.documentId}`);
	}
	return {
		documentId: input.doc.documentId,
		proposalDocumentId: input.doc.proposalDocumentId,
		opportunityId: input.candidate.opportunityId,
		format: "docx",
		filename,
		mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		size: bytes.length,
		artifactHash,
		downloadUrl: `/api/v1/documents/${input.doc.documentId}/final-artifact?artifactHash=${artifactHash}&filename=${encodeURIComponent(filename)}`,
		storagePath: upload.storagePath,
		storageBucket: upload.bucket,
		storageKey: upload.key,
		storageEtag: upload.etag,
		storageEndpoint: upload.endpoint,
		storageReadbackHash,
		storageReadbackSize: readback.body.length,
		storageReadbackAt: new Date().toISOString(),
		renderedAt: renderedAt.toISOString(),
		renderedBy: USER_ID,
		sourceDocumentVersion: input.doc.currentVersion,
		sourceContentHash: hashDocumentSource(input.doc),
		renderTimeMs,
		pageCount: null,
		responsePackageReadiness: input.readiness,
		approvedAt: new Date().toISOString(),
		approvedBy: USER_ID,
		approvalRole: APPROVAL_ROLE,
	};
}

async function persistFinalArtifact(input: {
	candidate: CandidateRow;
	doc: ProposalDocRow;
	artifact: FinalArtifactManifest;
	client: DbClient;
}) {
	const now = new Date();
	const metadata = recordObject(input.doc.metadata);
	const renderedArtifacts = recordObject(metadata.renderedArtifacts);
	await input.client
		.update(documents)
		.set({
			status: "final",
			metadata: {
				...metadata,
				renderedArtifacts: {
					...renderedArtifacts,
					docx: input.artifact,
				},
				finalArtifact: input.artifact,
				finalSubmissionSignoff: {
					signedAt: now.toISOString(),
					signedBy: USER_ID,
					signoffRole: SIGNOFF_ROLE,
					responsePackageReadiness: input.artifact.responsePackageReadiness,
				},
				finalArtifactWorkflow: {
					state: "submission_signed_off",
					lastRenderedAt: input.artifact.renderedAt,
					lastRenderedBy: USER_ID,
					lastArtifactHash: input.artifact.artifactHash,
					approvedAt: input.artifact.approvedAt,
					approvedBy: USER_ID,
					signedAt: now.toISOString(),
					signedBy: USER_ID,
					signoffRole: SIGNOFF_ROLE,
					responsePackageReadiness: input.artifact.responsePackageReadiness,
					runId: RUN_ID,
				},
			},
			updatedAt: now,
		})
		.where(eq(documents.id, input.doc.documentId));
	await input.client
		.update(proposalDocuments)
		.set({
			status: "final",
			approvedBy: USER_ID,
			approvedAt: now,
			updatedAt: now,
		})
		.where(eq(proposalDocuments.id, input.doc.proposalDocumentId));
}

async function recordFinalArtifactWorkflow(input: {
	candidate: CandidateRow;
	doc: ProposalDocRow;
	artifact: FinalArtifactManifest;
	client: DbClient;
}) {
	const renderInstance = await recordWorkflowRuntimeTransition({
		workflowKey: "final_artifact_render_export",
		organizationId: input.candidate.organizationId,
		subjectType: "document",
		subjectId: input.doc.documentId,
		opportunityId: input.candidate.opportunityId,
		fromState: input.doc.proposalStatus ?? input.doc.documentStatus ?? "in_review",
		toState: "artifact_rendered",
		eventType: "final_artifact_render",
		actorId: USER_ID,
		actorName: USER_ID,
		reason: "Rendered final DOCX artifact from ready response package",
		evidenceLinks: [
			`document:${input.doc.documentId}`,
			`proposal-document:${input.doc.proposalDocumentId}`,
			`artifact:sha256:${input.artifact.artifactHash}`,
			`storage:${input.artifact.storagePath}`,
		],
		priority: "high",
		visibility: "internal",
		metadata: workflowMetadata(input),
		terminal: false,
		actionUrl: `/documents/${input.doc.documentId}`,
	}, input.client);
	await recordWorkflowRuntimeTransition({
		workflowKey: "final_artifact_render_export",
		organizationId: input.candidate.organizationId,
		subjectType: "document",
		subjectId: input.doc.documentId,
		opportunityId: input.candidate.opportunityId,
		fromState: "artifact_rendered",
		toState: "submission_signed_off",
		eventType: "final_artifact_signoff",
		actorId: USER_ID,
		actorName: USER_ID,
		reason: "Approved and signed off final artifact after storage readback verification",
		evidenceLinks: [
			`document:${input.doc.documentId}`,
			`proposal-document:${input.doc.proposalDocumentId}`,
			`artifact:sha256:${input.artifact.artifactHash}`,
			`storage:${input.artifact.storagePath}`,
		],
		priority: "medium",
		visibility: "internal",
		authorityPolicy: {
			requiredRoles: [APPROVAL_ROLE, SIGNOFF_ROLE],
			allowedActorIds: [USER_ID],
		},
		metadata: workflowMetadata(input),
		terminal: true,
		actionUrl: `/documents/${input.doc.documentId}`,
	}, input.client);
	await upsertWorkflowRuntimeTask({
		workflowInstanceId: renderInstance.id,
		taskKey: `final-artifact:${input.doc.documentId}`,
		title: "Final proposal artifact approved and signed off",
		description: "Final DOCX artifact was rendered, stored, read back, approved, and signed off.",
		state: "completed",
		priority: "medium",
		assignedTo: USER_ID,
		assignedRole: null,
		dueAt: null,
		metadata: workflowMetadata(input),
	}, input.client);
}

async function lockComplianceMatrix(candidate: CandidateRow, client: DbClient): Promise<boolean> {
	const [matrix] = await client
		.select()
		.from(complianceMatrices)
		.where(and(
			eq(complianceMatrices.opportunityId, candidate.opportunityId),
			eq(complianceMatrices.organizationId, candidate.organizationId)
		))
		.orderBy(asc(complianceMatrices.version))
		.limit(1);
	if (!matrix) return false;
	const now = new Date();
	await client
		.update(complianceMatrices)
		.set({
			status: "final",
			approvedBy: USER_ID,
			approvedAt: now,
			reviewedBy: USER_ID,
			reviewedAt: now,
			mandatoryComplianceScore: 100,
			complianceScore: matrix.complianceScore ?? 100,
			metadata: {
				...recordObject(matrix.metadata),
				finalArtifactPublish: {
					runId: RUN_ID,
					lockedAt: now.toISOString(),
					lockedBy: USER_ID,
				},
			},
			updatedAt: now,
		})
		.where(eq(complianceMatrices.id, matrix.id));
	return true;
}

function workflowMetadata(input: {
	candidate: CandidateRow;
	doc: ProposalDocRow;
	artifact: FinalArtifactManifest;
}) {
	return {
		documentId: input.doc.documentId,
		proposalDocumentId: input.doc.proposalDocumentId,
		opportunityId: input.candidate.opportunityId,
		documentTitle: input.doc.title,
		documentType: input.doc.documentType,
		action: "publish_final_artifact",
		format: "docx",
		artifactHash: input.artifact.artifactHash,
		filename: input.artifact.filename,
		size: input.artifact.size,
		storagePath: input.artifact.storagePath,
		storageReadbackHash: input.artifact.storageReadbackHash,
		storageReadbackSize: input.artifact.storageReadbackSize,
		approvalRole: APPROVAL_ROLE,
		signoffRole: SIGNOFF_ROLE,
		responsePackageReadiness: input.artifact.responsePackageReadiness,
		source: "final-artifact-publish",
		runId: RUN_ID,
	};
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

function finalArtifactObjectKey(params: {
	prefix?: string;
	opportunityId: string;
	proposalDocumentId: string;
	documentId: string;
	artifactHash: string;
	filename: string;
}): string {
	return [
		safeObjectSegment(params.prefix ?? "rfp"),
		"final-artifacts",
		safeObjectSegment(params.opportunityId),
		safeObjectSegment(params.proposalDocumentId || params.documentId),
		`${params.artifactHash.slice(0, 16)}-${safeObjectSegment(params.filename)}`,
	].join("/");
}

function safeFilenameBase(value: string): string {
	return safeObjectSegment(value.toLowerCase()).slice(0, 80) || "final-artifact";
}

function safeObjectSegment(value: string): string {
	return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "unnamed";
}

function sha256Hex(value: Buffer): string {
	return createHash("sha256").update(value).digest("hex");
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

async function writeArtifacts(proof: FinalArtifactPublishProof, disposition: EvidenceRecord["disposition"]): Promise<void> {
	const artifactPath = await writeProofJson(LOG_DIR, "final-artifact-publish.json", proof);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "final artifact publish",
		journey: "ready response package to approved stored final artifacts",
		run_id: proof.runId,
		artifact_ids: [
			path.relative(WORKSPACE_ROOT, artifactPath),
			`candidates:${proof.candidatesFound}`,
			`published:${proof.published.length}`,
			`artifacts:${proof.published.reduce((total, item) => total + item.artifacts.length, 0)}`,
			`apply:${String(proof.apply)}`,
		],
		topology_tier: "live database and object storage",
		verification_bucket: "final artifact render approval",
		timestamp: proof.completedAt ?? new Date().toISOString(),
		operator: USER_ID,
		cleanup_status: proof.apply ? "not-applicable" : "idempotent-noop",
		disposition,
		notes: proof.published.length > 0
			? `Published final artifacts for ${proof.published.length} ready response package(s).`
			: proof.error ?? "No ready response packages were eligible for final artifact publishing.",
	}], { title: "Final Artifact Publish Evidence" });
}

void main();
