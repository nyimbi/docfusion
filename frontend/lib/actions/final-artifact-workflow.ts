"use server";

import { createHash } from "node:crypto";
import {
	assertUserHasAuthorityRole,
	requireUserContext,
	type UserContext,
} from "@/lib/auth-utils";
import { renderDocument } from "@/lib/actions/document-render";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";
import { db } from "@/lib/db";
import { documents, proposalDocuments } from "@/lib/db/schema";
import { workflowInstances } from "@/lib/db/schema-workflow-runtime";
import {
	downloadFromLinodeE3,
	getLinodeE3ConfigFromEnv,
	type LinodeE3Config,
	uploadToLinodeE3,
} from "@/lib/storage/linode-e3";
import type { ExportFormat, RenderOptions } from "@/lib/types/opportunity";
import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";

type DocumentRow = typeof documents.$inferSelect;
type ProposalDocumentRow = typeof proposalDocuments.$inferSelect;
type ResponsePackageWorkflowRow = Pick<
	typeof workflowInstances.$inferSelect,
	"id" | "state" | "metadata"
>;
type FinalArtifactUserContext = UserContext & { organizationId: string };

interface ResponsePackageReadinessSnapshot {
	workflowInstanceId: string;
	workflowState: string;
	status: "ready_for_review" | "blocked" | "unknown";
	blockers: string[];
	warnings: string[];
	missingRequirementIds: string[];
	metrics: {
		requirementCoverage: number;
		documentsDrafted: number;
		sectionsDrafted: number;
		complianceEntriesCreated: number;
		totalDraftWordCount: number;
		minDocumentDraftWordCount: number;
		evidenceChecklistCoverage: number;
		evidenceCitationCoverage: number;
		reviewGateCoverage: number;
		sourceCitationCoverage: number;
		winThemeCoverage: number;
		unresolvedPlaceholderCount: number;
	};
}

export type FinalArtifactAction = "request_render" | "render" | "approve" | "signoff" | "reopen";

export interface FinalArtifactManifest {
	documentId: string;
	proposalDocumentId: string | null;
	opportunityId: string | null;
	format: ExportFormat;
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
	renderTimeMs: number | null;
	pageCount: number | null;
	responsePackageReadiness?: ResponsePackageReadinessSnapshot;
}

export interface FinalArtifactWorkflowInput {
	documentId: string;
	action: FinalArtifactAction;
	reason: string;
	format?: ExportFormat;
	opportunityId?: string | null;
	proposalDocumentId?: string | null;
	renderOptions?: Partial<RenderOptions>;
	approvalRole?: string | null;
	assignedTo?: string | null;
	dueAt?: Date | string | null;
	allowDraftRender?: boolean;
}

export interface FinalArtifactWorkflowResult {
	documentId: string;
	proposalDocumentId: string | null;
	opportunityId: string | null;
	fromState: string;
	toState: string;
	workflowInstanceId: string;
	taskProjected: boolean;
	artifact?: FinalArtifactManifest;
}

const WORKFLOW_KEY = "final_artifact_render_export";
const SUBJECT_TYPE = "document";

function assignedOpportunityExistsSql(opportunityId: unknown, userContext: FinalArtifactUserContext): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and (
				opportunities.organization_id = ${userContext.organizationId}
				or opportunities.organization_id is null
			)
			and opportunities.assigned_to = ${userContext.userId}
	)`;
}

function proposalDocumentOrganizationCondition(organizationId: string): SQL {
	return or(
		eq(proposalDocuments.organizationId, organizationId),
		isNull(proposalDocuments.organizationId)
	)!;
}

function visibleProposalDocumentCondition(
	proposalDocumentId: string,
	userContext: FinalArtifactUserContext
): SQL {
	return and(
		eq(proposalDocuments.id, proposalDocumentId),
		proposalDocumentOrganizationCondition(userContext.organizationId),
		assignedOpportunityExistsSql(proposalDocuments.opportunityId, userContext)
	)!;
}

function visibleProposalDocumentForOpportunityAndDocumentCondition(
	opportunityId: string,
	documentId: string,
	userContext: FinalArtifactUserContext
): SQL {
	return and(
		eq(proposalDocuments.opportunityId, opportunityId),
		eq(proposalDocuments.documentId, documentId),
		proposalDocumentOrganizationCondition(userContext.organizationId),
		assignedOpportunityExistsSql(opportunityId, userContext)
	)!;
}

function visibleDocumentCondition(
	documentId: string,
	userContext: FinalArtifactUserContext,
	proposalDocument: ProposalDocumentRow | null,
	opportunityId?: string | null
): SQL {
	if (proposalDocument) {
		return and(
			eq(documents.id, documentId),
			sql`exists (
				select 1
				from proposal_documents
				join opportunities on opportunities.id = proposal_documents.opportunity_id
				where proposal_documents.id = ${proposalDocument.id}
					and proposal_documents.document_id = ${documentId}
					and (proposal_documents.organization_id = ${userContext.organizationId} or proposal_documents.organization_id is null)
					and (
						opportunities.organization_id = ${userContext.organizationId}
						or opportunities.organization_id is null
					)
					and opportunities.assigned_to = ${userContext.userId}
			)`
		)!;
	}
	if (opportunityId) {
		return and(
			eq(documents.id, documentId),
			sql`exists (
				select 1
				from proposal_documents
				join opportunities on opportunities.id = proposal_documents.opportunity_id
				where proposal_documents.opportunity_id = ${opportunityId}
					and proposal_documents.document_id = ${documentId}
					and (proposal_documents.organization_id = ${userContext.organizationId} or proposal_documents.organization_id is null)
					and (
						opportunities.organization_id = ${userContext.organizationId}
						or opportunities.organization_id is null
					)
					and opportunities.assigned_to = ${userContext.userId}
			)`
		)!;
	}
	return and(
		eq(documents.id, documentId),
		sql`documents.owner_id = ${userContext.userId}`
	)!;
}

export async function transitionFinalArtifactWorkflow(
	input: FinalArtifactWorkflowInput
): Promise<FinalArtifactWorkflowResult> {
	const userContext = await requireUserContext();
	if (!userContext.organizationId) {
		throw new Error("No organization context");
	}
	const finalArtifactContext = userContext as FinalArtifactUserContext;
	const reason = requireReason(input.reason, "Final artifact transitions require a reason");
	const proposalDocument = await loadProposalDocument(input, finalArtifactContext);
	const document = await loadDocument(input.documentId, finalArtifactContext, proposalDocument, input.opportunityId);
	const fromState = finalArtifactState(document, proposalDocument);
	const responsePackageReadiness = await assertResponsePackageReadyForFinalRender(input, proposalDocument, finalArtifactContext);
	const transition = await buildTransition({
		input,
		document,
		proposalDocument,
		actor: userContext,
		responsePackageReadiness,
	});

	const [updatedDocument] = await db
		.update(documents)
		.set(transition.documentPatch)
		.where(visibleDocumentCondition(input.documentId, finalArtifactContext, proposalDocument, input.opportunityId))
		.returning();
	if (!updatedDocument) {
		throw new Error("Failed to update final artifact metadata");
	}

	if (proposalDocument && transition.proposalPatch) {
		await db
			.update(proposalDocuments)
			.set(transition.proposalPatch)
			.where(visibleProposalDocumentCondition(proposalDocument.id, finalArtifactContext));
	}

	const opportunityId = proposalDocument?.opportunityId ?? input.opportunityId ?? null;
	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: WORKFLOW_KEY,
		organizationId: finalArtifactContext.organizationId,
		subjectType: SUBJECT_TYPE,
		subjectId: input.documentId,
		opportunityId,
		fromState,
		toState: transition.toState,
		eventType: `final_artifact_${input.action}`,
		actorId: userContext.userId,
		reason,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : transition.assignedRole,
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 1),
		authorityPolicy: input.approvalRole
			? { requiredRoles: [input.approvalRole] }
			: undefined,
		metadata: {
			documentId: input.documentId,
			organizationId: finalArtifactContext.organizationId,
			proposalDocumentId: proposalDocument?.id ?? null,
			opportunityId,
			documentTitle: updatedDocument.title,
			documentStatus: updatedDocument.status,
			proposalDocumentStatus: transition.proposalPatch?.status ?? proposalDocument?.status ?? null,
			action: input.action,
			format: input.format ?? null,
			artifactHash: transition.artifact?.artifactHash ?? null,
			filename: transition.artifact?.filename ?? null,
			size: transition.artifact?.size ?? null,
			approvalRole: input.approvalRole ?? null,
			responsePackageReadiness: transition.artifact?.responsePackageReadiness ?? responsePackageReadiness,
		},
		terminal: transition.terminal,
		actionUrl: `/documents/${input.documentId}`,
	});

	await upsertWorkflowRuntimeTask({
		workflowInstanceId: instance.id,
		taskKey: `final-artifact:${input.documentId}`,
		title: transition.taskTitle,
		description: `${transition.taskTitle}. Reason: ${reason}`,
		state: transition.taskState,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : transition.assignedRole,
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 1),
		metadata: {
			documentId: input.documentId,
			organizationId: finalArtifactContext.organizationId,
			proposalDocumentId: proposalDocument?.id ?? null,
			fromState,
			toState: transition.toState,
			artifactHash: transition.artifact?.artifactHash ?? null,
			responsePackageReadiness: transition.artifact?.responsePackageReadiness ?? responsePackageReadiness,
		},
	});

	return {
		documentId: input.documentId,
		proposalDocumentId: proposalDocument?.id ?? null,
		opportunityId,
		fromState,
		toState: transition.toState,
		workflowInstanceId: instance.id,
		taskProjected: true,
		artifact: transition.artifact,
	};
}

async function buildTransition(input: {
	input: FinalArtifactWorkflowInput;
	document: DocumentRow;
	proposalDocument: ProposalDocumentRow | null;
	actor: UserContext;
	responsePackageReadiness: ResponsePackageReadinessSnapshot | null;
}): Promise<{
	toState: string;
	terminal: boolean;
	taskState: "open" | "in_progress" | "blocked" | "completed" | "cancelled";
	taskTitle: string;
	priority: "critical" | "high" | "medium" | "low";
	assignedRole: string;
	documentPatch: Partial<typeof documents.$inferInsert>;
	proposalPatch?: Partial<typeof proposalDocuments.$inferInsert>;
	artifact?: FinalArtifactManifest;
}> {
	const now = new Date();
	switch (input.input.action) {
		case "request_render":
			return {
				toState: "render_requested",
				terminal: false,
				taskState: "open",
				taskTitle: "Render final proposal artifact",
				priority: "high",
				assignedRole: "production_specialist",
				documentPatch: {
					metadata: mergeMetadata(input.document.metadata, {
						finalArtifactWorkflow: {
							state: "render_requested",
							requestedAt: now.toISOString(),
							requestedBy: input.actor.userId,
							format: input.input.format ?? "pdf",
							responsePackageReadiness: input.responsePackageReadiness,
						},
					}),
					updatedAt: now,
				},
			};
		case "render": {
			enforceRenderable(input.document, input.proposalDocument, input.input.allowDraftRender);
			const format = input.input.format ?? "pdf";
			const objectStoreConfig = getLinodeE3ConfigFromEnv();
			if (!objectStoreConfig) {
				throw new Error("Linode E3 object storage is required before rendering final submission artifacts");
			}
			const renderResult = await renderDocument(input.input.documentId, {
				...input.input.renderOptions,
				format,
				metadata: {
					...input.input.renderOptions?.metadata,
					title: input.input.renderOptions?.metadata?.title ?? input.document.title,
				},
			});
			if (!renderResult.success || !renderResult.data || !renderResult.filename || !renderResult.mimeType || renderResult.size == null) {
				throw new Error(renderResult.error ?? "Final artifact render failed");
			}
			const artifact = await buildStoredManifest({
				objectStoreConfig,
				documentId: input.document.id,
				proposalDocumentId: input.proposalDocument?.id ?? null,
				opportunityId: input.proposalDocument?.opportunityId ?? input.input.opportunityId ?? null,
				format,
				renderedBy: input.actor.userId,
				renderedAt: now,
				sourceDocumentVersion: input.document.currentVersion ?? null,
				sourceContentHash: hashDocumentSource(input.document),
				responsePackageReadiness: input.responsePackageReadiness ?? undefined,
				renderResult: {
					data: renderResult.data,
					filename: renderResult.filename,
					mimeType: renderResult.mimeType,
					size: renderResult.size,
					renderTimeMs: renderResult.renderTimeMs,
					pageCount: renderResult.pageCount,
				},
			});
			return {
				toState: "artifact_rendered",
				terminal: false,
				taskState: "in_progress",
				taskTitle: "Verify rendered proposal artifact",
				priority: "high",
				assignedRole: "proposal_manager",
				artifact,
				documentPatch: {
					metadata: mergeRenderedArtifact(input.document.metadata, artifact),
					updatedAt: now,
				},
			};
		}
		case "approve": {
			const approvalRole = requireAuthority(input.actor, input.input.approvalRole, "Approving a final artifact requires production approval authority");
			const artifact = latestArtifact(input.document.metadata, input.input.format);
			if (!artifact) {
				throw new Error("Approving a final artifact requires a rendered artifact manifest");
			}
			assertArtifactMatchesCurrentDocument(artifact, input.document);
			return {
				toState: "artifact_approved",
				terminal: true,
				taskState: "completed",
				taskTitle: "Final proposal artifact approved",
				priority: "medium",
				assignedRole: "proposal_manager",
				artifact,
				documentPatch: {
					status: "final",
					metadata: mergeMetadata(input.document.metadata, {
						finalArtifact: {
							...artifact,
							approvedAt: now.toISOString(),
							approvedBy: input.actor.userId,
							approvalRole,
							responsePackageReadiness: artifact.responsePackageReadiness ?? null,
						},
					}),
					updatedAt: now,
				},
				proposalPatch: input.proposalDocument
					? {
						status: "final",
						approvedBy: input.actor.userId,
						approvedAt: now,
						updatedAt: now,
					}
					: undefined,
			};
		}
		case "signoff": {
			const approvalRole = requireAuthority(input.actor, input.input.approvalRole, "Recording final submission signoff requires executive or legal authority");
			const artifact = finalArtifact(input.document.metadata);
			if (!artifact) {
				throw new Error("Final submission signoff requires an approved final artifact");
			}
			return {
				toState: "submission_signed_off",
				terminal: true,
				taskState: "completed",
				taskTitle: "Final submission signoff recorded",
				priority: "medium",
				assignedRole: "proposal_manager",
				artifact,
				documentPatch: {
					metadata: mergeMetadata(input.document.metadata, {
						finalSubmissionSignoff: {
							signedAt: now.toISOString(),
							signedBy: input.actor.userId,
							signoffRole: approvalRole,
							responsePackageReadiness: artifact.responsePackageReadiness ?? null,
						},
						finalArtifactWorkflow: {
							state: "submission_signed_off",
							signedAt: now.toISOString(),
							signedBy: input.actor.userId,
							signoffRole: approvalRole,
							responsePackageReadiness: artifact.responsePackageReadiness ?? null,
						},
					}),
					updatedAt: now,
				},
				proposalPatch: input.proposalDocument
					? {
						updatedAt: now,
					}
					: undefined,
			};
		}
		case "reopen":
			requireAuthority(input.actor, input.input.approvalRole, "Reopening an approved final artifact requires production authority");
			return {
				toState: "artifact_reopened",
				terminal: false,
				taskState: "open",
				taskTitle: "Re-render reopened proposal artifact",
				priority: "high",
				assignedRole: "production_specialist",
				documentPatch: {
					status: "draft",
					metadata: mergeMetadata(input.document.metadata, {
						finalArtifact: null,
						finalSubmissionSignoff: null,
						finalArtifactWorkflow: {
							state: "artifact_reopened",
							reopenedAt: now.toISOString(),
							reopenedBy: input.actor.userId,
						},
					}),
					updatedAt: now,
				},
				proposalPatch: input.proposalDocument
					? {
						status: "in_review",
						approvedBy: null,
						approvedAt: null,
						updatedAt: now,
					}
					: undefined,
			};
	}
}

async function loadDocument(
	documentId: string,
	userContext: FinalArtifactUserContext,
	proposalDocument: ProposalDocumentRow | null,
	opportunityId?: string | null
) {
	const [document] = await db
		.select()
		.from(documents)
		.where(visibleDocumentCondition(documentId, userContext, proposalDocument, opportunityId))
		.limit(1);
	if (!document) {
		throw new Error("Document not found");
	}
	return document;
}

async function loadProposalDocument(input: FinalArtifactWorkflowInput, userContext: FinalArtifactUserContext) {
	if (input.proposalDocumentId) {
		const [proposalDocument] = await db
			.select()
			.from(proposalDocuments)
			.where(visibleProposalDocumentCondition(input.proposalDocumentId, userContext))
			.limit(1);
		if (!proposalDocument) {
			throw new Error("Proposal document link not found");
		}
		if (proposalDocument.documentId !== input.documentId) {
			throw new Error("Proposal document link does not match the document");
		}
		return proposalDocument;
	}
	if (!input.opportunityId) {
		return null;
	}
	const [proposalDocument] = await db
		.select()
		.from(proposalDocuments)
		.where(visibleProposalDocumentForOpportunityAndDocumentCondition(
			input.opportunityId,
			input.documentId,
			userContext
		))
		.limit(1);
	return proposalDocument ?? null;
}

async function assertResponsePackageReadyForFinalRender(
	input: FinalArtifactWorkflowInput,
	proposalDocument: ProposalDocumentRow | null,
	userContext: FinalArtifactUserContext
): Promise<ResponsePackageReadinessSnapshot | null> {
	if (!["request_render", "render"].includes(input.action)) {
		return null;
	}
	if (input.action === "render" && input.allowDraftRender) {
		return null;
	}
	const opportunityId = proposalDocument?.opportunityId ?? input.opportunityId ?? null;
	if (!opportunityId) {
		return null;
	}

	const [instance] = await db
		.select({
			id: workflowInstances.id,
			state: workflowInstances.state,
			metadata: workflowInstances.metadata,
		})
		.from(workflowInstances)
		.where(and(
			eq(workflowInstances.workflowKey, "proposal_response_package"),
			eq(workflowInstances.organizationId, userContext.organizationId),
			eq(workflowInstances.subjectType, "opportunity"),
			eq(workflowInstances.subjectId, opportunityId),
			assignedOpportunityExistsSql(opportunityId, userContext)
		));

	const readiness = responsePackageReadinessFromWorkflow(instance);
	if (!readiness) {
		throw new Error("Response package readiness assessment is required before rendering final submission artifacts");
	}
	if (readiness.status !== "ready_for_review") {
		throw new Error(`Response package readiness is blocked before final rendering: ${responsePackageReadinessFailureMessage(readiness)}`);
	}
	return readiness;
}

function responsePackageReadinessFromWorkflow(
	instance: ResponsePackageWorkflowRow | undefined
): ResponsePackageReadinessSnapshot | null {
	if (!instance) {
		return null;
	}
	const readiness = asRecord(asRecord(instance.metadata).readiness);
	if (Object.keys(readiness).length === 0) {
		return null;
	}
	const metrics = asRecord(readiness.metrics);
	return {
		workflowInstanceId: instance.id,
		workflowState: instance.state,
		status: readiness.status === "ready_for_review" || readiness.status === "blocked"
			? readiness.status
			: "unknown",
		blockers: stringArray(readiness.blockers),
		warnings: stringArray(readiness.warnings),
		missingRequirementIds: stringArray(readiness.missingRequirementIds),
		metrics: {
			requirementCoverage: clampRatio(numberMetric(metrics.requirementCoverage)),
			documentsDrafted: numberMetric(metrics.documentsDrafted),
			sectionsDrafted: numberMetric(metrics.sectionsDrafted),
			complianceEntriesCreated: numberMetric(metrics.complianceEntriesCreated),
			totalDraftWordCount: numberMetric(metrics.totalDraftWordCount),
			minDocumentDraftWordCount: numberMetric(metrics.minDocumentDraftWordCount),
			evidenceChecklistCoverage: clampRatio(numberMetric(metrics.evidenceChecklistCoverage)),
			evidenceCitationCoverage: clampRatio(numberMetric(metrics.evidenceCitationCoverage)),
			reviewGateCoverage: clampRatio(numberMetric(metrics.reviewGateCoverage)),
			sourceCitationCoverage: clampRatio(numberMetric(metrics.sourceCitationCoverage)),
			winThemeCoverage: clampRatio(numberMetric(metrics.winThemeCoverage)),
			unresolvedPlaceholderCount: numberMetric(metrics.unresolvedPlaceholderCount),
		},
	};
}

function responsePackageReadinessFailureMessage(readiness: NonNullable<ReturnType<typeof responsePackageReadinessFromWorkflow>>): string {
	if (readiness.status === "unknown") {
		return "readiness status is unrecognized";
	}
	const blockerSummary = readiness.blockers.length > 0
		? readiness.blockers.slice(0, 3).join("; ")
		: `${readiness.missingRequirementIds.length} accepted requirement${readiness.missingRequirementIds.length === 1 ? "" : "s"} missing from the response package`;
	return `${Math.round(readiness.metrics.requirementCoverage * 100)}% accepted requirement coverage; ${blockerSummary}`;
}

function enforceRenderable(
	document: DocumentRow,
	proposalDocument: ProposalDocumentRow | null,
	allowDraftRender: boolean | undefined
) {
	if (allowDraftRender) {
		return;
	}
	const documentStatus = document.status;
	const proposalStatus = proposalDocument?.status ?? null;
	if (proposalDocument && !["approved", "final"].includes(proposalStatus ?? "")) {
		throw new Error("Rendering a final artifact requires an approved or final proposal document");
	}
	if (!proposalDocument && !["approved", "final", "published"].includes(documentStatus)) {
		throw new Error("Rendering a final artifact requires an approved or final document");
	}
}

async function buildStoredManifest(input: {
	objectStoreConfig: LinodeE3Config;
	documentId: string;
	proposalDocumentId: string | null;
	opportunityId: string | null;
	format: ExportFormat;
	renderedBy: string;
	renderedAt: Date;
	sourceDocumentVersion: number | null;
	sourceContentHash: string;
	responsePackageReadiness?: ResponsePackageReadinessSnapshot;
	renderResult: {
		data: string;
		filename: string;
		mimeType: string;
		size: number;
		renderTimeMs?: number;
		pageCount?: number;
	};
}): Promise<FinalArtifactManifest> {
	const bytes = Buffer.from(input.renderResult.data, "base64");
	const artifactHash = createHash("sha256").update(bytes).digest("hex");
	const key = buildFinalArtifactObjectKey({
		prefix: input.objectStoreConfig.prefix,
		opportunityId: input.opportunityId,
		proposalDocumentId: input.proposalDocumentId,
		documentId: input.documentId,
		artifactHash,
		filename: input.renderResult.filename,
	});
	const upload = await uploadToLinodeE3(input.objectStoreConfig, {
		key,
		body: bytes,
		contentType: input.renderResult.mimeType,
		contentLength: bytes.length,
		metadata: {
			"document-id": input.documentId,
			"proposal-document-id": input.proposalDocumentId ?? "",
			"opportunity-id": input.opportunityId ?? "",
			format: input.format,
			sha256: artifactHash,
			"rendered-by": input.renderedBy,
			"response-readiness-status": input.responsePackageReadiness?.status ?? "",
			"response-readiness-workflow-id": input.responsePackageReadiness?.workflowInstanceId ?? "",
		},
	});
	const readback = await downloadFromLinodeE3(input.objectStoreConfig, upload.storagePath);
	const storageReadbackHash = createHash("sha256").update(readback.body).digest("hex");
	if (storageReadbackHash !== artifactHash || readback.body.length !== bytes.length) {
		throw new Error("Final artifact object storage readback failed hash or size verification");
	}
	const downloadUrl = `/api/v1/documents/${input.documentId}/final-artifact?artifactHash=${artifactHash}&filename=${encodeURIComponent(input.renderResult.filename)}`;
	return {
		documentId: input.documentId,
		proposalDocumentId: input.proposalDocumentId,
		opportunityId: input.opportunityId,
		format: input.format,
		filename: input.renderResult.filename,
		mimeType: input.renderResult.mimeType,
		size: input.renderResult.size,
		artifactHash,
		downloadUrl,
		storagePath: upload.storagePath,
		storageBucket: upload.bucket,
		storageKey: upload.key,
		storageEtag: upload.etag,
		storageEndpoint: upload.endpoint,
		storageReadbackHash,
		storageReadbackSize: readback.body.length,
		storageReadbackAt: new Date().toISOString(),
		renderedAt: input.renderedAt.toISOString(),
		renderedBy: input.renderedBy,
		sourceDocumentVersion: input.sourceDocumentVersion,
		sourceContentHash: input.sourceContentHash,
		renderTimeMs: input.renderResult.renderTimeMs ?? null,
		pageCount: input.renderResult.pageCount ?? null,
		responsePackageReadiness: input.responsePackageReadiness,
	};
}

function hashDocumentSource(document: DocumentRow): string {
	return createHash("sha256")
		.update(JSON.stringify({
			title: document.title,
			content: document.content,
			plainText: document.plainText,
		}))
		.digest("hex");
}

function assertArtifactMatchesCurrentDocument(
	artifact: FinalArtifactManifest,
	document: DocumentRow
): void {
	if (
		artifact.sourceDocumentVersion !== (document.currentVersion ?? null) ||
		artifact.sourceContentHash !== hashDocumentSource(document)
	) {
		throw new Error("Approving a final artifact requires re-rendering the current document version");
	}
}

function buildFinalArtifactObjectKey(params: {
	prefix?: string;
	opportunityId: string | null;
	proposalDocumentId: string | null;
	documentId: string;
	artifactHash: string;
	filename: string;
}): string {
	const prefix = sanitizeObjectKeySegment(params.prefix ?? "rfp");
	const filename = sanitizeObjectKeySegment(params.filename);
	const artifactName = `${params.artifactHash.slice(0, 16)}-${filename}`;
	return [
		prefix,
		"final-artifacts",
		sanitizeObjectKeySegment(params.opportunityId ?? "unassigned"),
		sanitizeObjectKeySegment(params.proposalDocumentId ?? params.documentId),
		artifactName,
	].join("/");
}

function sanitizeObjectKeySegment(value: string): string {
	const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
	return normalized || "unnamed";
}

function mergeRenderedArtifact(metadata: unknown, artifact: FinalArtifactManifest) {
	const current = asRecord(metadata);
	const renderedArtifacts = asRecord(current.renderedArtifacts);
	return {
		...current,
		renderedArtifacts: {
			...renderedArtifacts,
			[artifact.format]: artifact,
		},
		finalArtifactWorkflow: {
			state: "artifact_rendered",
			lastRenderedAt: artifact.renderedAt,
			lastRenderedBy: artifact.renderedBy,
			lastArtifactHash: artifact.artifactHash,
			responsePackageReadiness: artifact.responsePackageReadiness ?? null,
		},
	};
}

function mergeMetadata(metadata: unknown, patch: Record<string, unknown>) {
	return {
		...asRecord(metadata),
		...patch,
	};
}

function latestArtifact(metadata: unknown, format: ExportFormat | undefined): FinalArtifactManifest | null {
	const current = asRecord(metadata);
	const renderedArtifacts = asRecord(current.renderedArtifacts);
	if (format && isArtifact(renderedArtifacts[format])) {
		return renderedArtifacts[format];
	}
	for (const candidate of Object.values(renderedArtifacts).reverse()) {
		if (isArtifact(candidate)) {
			return candidate;
		}
	}
	return null;
}

function finalArtifact(metadata: unknown): FinalArtifactManifest | null {
	const current = asRecord(metadata);
	return isArtifact(current.finalArtifact) ? current.finalArtifact : null;
}

function isArtifact(value: unknown): value is FinalArtifactManifest {
	return Boolean(
		value &&
		typeof value === "object" &&
		typeof (value as FinalArtifactManifest).artifactHash === "string" &&
		typeof (value as FinalArtifactManifest).filename === "string" &&
		typeof (value as FinalArtifactManifest).storagePath === "string"
	);
}

function finalArtifactState(document: DocumentRow, proposalDocument: ProposalDocumentRow | null) {
	const metadata = asRecord(document.metadata);
	if (isRecord(metadata.finalSubmissionSignoff) && isArtifact(metadata.finalArtifact)) {
		return "submission_signed_off";
	}
	if (isArtifact(metadata.finalArtifact)) {
		return "artifact_approved";
	}
	if (latestArtifact(document.metadata, undefined)) {
		return "artifact_rendered";
	}
	return proposalDocument?.status ?? document.status ?? "draft";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requireReason(value: string | null | undefined, message: string) {
	const reason = value?.trim();
	if (!reason) {
		throw new Error(message);
	}
	return reason;
}

function requireAuthority(
	actor: UserContext,
	value: string | null | undefined,
	message: string
): string {
	return assertUserHasAuthorityRole(actor, value, message);
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

function stringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberMetric(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clampRatio(value: number): number {
	return Math.min(1, Math.max(0, value));
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? { ...(value as Record<string, unknown>) }
		: {};
}
