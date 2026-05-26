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
import {
	getLinodeE3ConfigFromEnv,
	type LinodeE3Config,
	uploadToLinodeE3,
} from "@/lib/storage/linode-e3";
import type { ExportFormat, RenderOptions } from "@/lib/types/opportunity";
import { and, eq, sql, type SQL } from "drizzle-orm";

type DocumentRow = typeof documents.$inferSelect;
type ProposalDocumentRow = typeof proposalDocuments.$inferSelect;

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
	renderedAt: string;
	renderedBy: string;
	renderTimeMs: number | null;
	pageCount: number | null;
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

function assignedOpportunityExistsSql(opportunityId: unknown, actorId: string): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and opportunities.assigned_to = ${actorId}
	)`;
}

function visibleProposalDocumentCondition(proposalDocumentId: string, actorId: string): SQL {
	return and(
		eq(proposalDocuments.id, proposalDocumentId),
		assignedOpportunityExistsSql(proposalDocuments.opportunityId, actorId)
	)!;
}

function visibleProposalDocumentForOpportunityAndDocumentCondition(
	opportunityId: string,
	documentId: string,
	actorId: string
): SQL {
	return and(
		eq(proposalDocuments.opportunityId, opportunityId),
		eq(proposalDocuments.documentId, documentId),
		assignedOpportunityExistsSql(opportunityId, actorId)
	)!;
}

function visibleDocumentCondition(
	documentId: string,
	actorId: string,
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
					and opportunities.assigned_to = ${actorId}
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
					and opportunities.assigned_to = ${actorId}
			)`
		)!;
	}
	return and(
		eq(documents.id, documentId),
		sql`documents.owner_id = ${actorId}`
	)!;
}

export async function transitionFinalArtifactWorkflow(
	input: FinalArtifactWorkflowInput
): Promise<FinalArtifactWorkflowResult> {
	const userContext = await requireUserContext();
	const reason = requireReason(input.reason, "Final artifact transitions require a reason");
	const proposalDocument = await loadProposalDocument(input, userContext.userId);
	const document = await loadDocument(input.documentId, userContext.userId, proposalDocument, input.opportunityId);
	const fromState = finalArtifactState(document, proposalDocument);
	const transition = await buildTransition({
		input,
		document,
		proposalDocument,
		actor: userContext,
	});

	const [updatedDocument] = await db
		.update(documents)
		.set(transition.documentPatch)
		.where(visibleDocumentCondition(input.documentId, userContext.userId, proposalDocument, input.opportunityId))
		.returning();
	if (!updatedDocument) {
		throw new Error("Failed to update final artifact metadata");
	}

	if (proposalDocument && transition.proposalPatch) {
		await db
			.update(proposalDocuments)
			.set(transition.proposalPatch)
			.where(visibleProposalDocumentCondition(proposalDocument.id, userContext.userId));
	}

	const opportunityId = proposalDocument?.opportunityId ?? input.opportunityId ?? null;
	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: WORKFLOW_KEY,
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
			proposalDocumentId: proposalDocument?.id ?? null,
			fromState,
			toState: transition.toState,
			artifactHash: transition.artifact?.artifactHash ?? null,
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
						},
						finalArtifactWorkflow: {
							state: "submission_signed_off",
							signedAt: now.toISOString(),
							signedBy: input.actor.userId,
							signoffRole: approvalRole,
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
	actorId: string,
	proposalDocument: ProposalDocumentRow | null,
	opportunityId?: string | null
) {
	const [document] = await db
		.select()
		.from(documents)
		.where(visibleDocumentCondition(documentId, actorId, proposalDocument, opportunityId))
		.limit(1);
	if (!document) {
		throw new Error("Document not found");
	}
	return document;
}

async function loadProposalDocument(input: FinalArtifactWorkflowInput, actorId: string) {
	if (input.proposalDocumentId) {
		const [proposalDocument] = await db
			.select()
			.from(proposalDocuments)
			.where(visibleProposalDocumentCondition(input.proposalDocumentId, actorId))
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
			actorId
		))
		.limit(1);
	return proposalDocument ?? null;
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
		},
	});
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
		renderedAt: input.renderedAt.toISOString(),
		renderedBy: input.renderedBy,
		renderTimeMs: input.renderResult.renderTimeMs ?? null,
		pageCount: input.renderResult.pageCount ?? null,
	};
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

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? { ...(value as Record<string, unknown>) }
		: {};
}
