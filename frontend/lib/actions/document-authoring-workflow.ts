"use server";

import { db } from "@/lib/db";
import {
	documentSections,
	documentVersions,
	documents,
	opportunities,
	proposalDocuments,
	templates,
} from "@/lib/db/schema";
import { requireUserContext } from "@/lib/auth-utils";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";
import { and, eq, or, sql, type SQL } from "drizzle-orm";

type DocumentRow = typeof documents.$inferSelect;
type DocumentContent = Record<string, unknown>;
type ProposalDocumentRow = typeof proposalDocuments.$inferSelect;
type SectionRow = typeof documentSections.$inferSelect;
type TemplateRow = typeof templates.$inferSelect;

export type DocumentCreationSource = "template" | "blank" | "imported_structure";
export type DocumentAuthoringAction =
	| "start_drafting"
	| "persist_content"
	| "submit_review"
	| "accept_ai"
	| "reject_ai"
	| "mark_ready"
	| "reopen";

export interface CreateWorkflowDocumentInput {
	title: string;
	reason: string;
	templateId?: string | null;
	opportunityId?: string | null;
	documentType?: string | null;
	placeholderValues?: Record<string, string | number | boolean | null>;
	content?: DocumentContent | null;
	source?: DocumentCreationSource;
	assignedTo?: string | null;
	dueAt?: Date | string | null;
	sectionSeeds?: Array<{
		sectionName: string;
		targetWordCount?: number | null;
		requirementIds?: string[];
	}>;
}

export interface DocumentAuthoringWorkflowInput {
	documentId: string;
	action: DocumentAuthoringAction;
	reason: string;
	content?: DocumentContent | null;
	proposalDocumentId?: string | null;
	sectionId?: string | null;
	assignedTo?: string | null;
	dueAt?: Date | string | null;
	provenance?: Record<string, unknown>;
}

export interface DocumentCreationWorkflowResult {
	documentId: string;
	proposalDocumentId: string | null;
	opportunityId: string | null;
	fromState: string;
	toState: string;
	versionNumber: number;
	workflowInstanceId: string;
	taskProjected: boolean;
}

export interface DocumentAuthoringWorkflowResult {
	documentId: string;
	proposalDocumentId: string | null;
	sectionId: string | null;
	opportunityId: string | null;
	fromState: string;
	toState: string;
	versionNumber: number;
	workflowInstanceId: string;
	taskProjected: boolean;
}

const CREATION_WORKFLOW_KEY = "document_creation_from_template";
const AUTHORING_WORKFLOW_KEY = "document_authoring";
const DOCUMENT_SUBJECT_TYPE = "document";

function assignedOpportunityExistsSql(opportunityId: unknown, actorId: string): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and opportunities.assigned_to = ${actorId}
	)`;
}

function visibleOpportunityCondition(opportunityId: string, actorId: string): SQL {
	return and(
		eq(opportunities.id, opportunityId),
		assignedOpportunityExistsSql(opportunityId, actorId)
	)!;
}

function visibleDocumentCondition(documentId: string, actorId: string): SQL {
	return and(
		eq(documents.id, documentId),
		sql`documents.owner_id = ${actorId}`
	)!;
}

function visibleProposalDocumentCondition(proposalDocumentId: string, actorId: string): SQL {
	return and(
		eq(proposalDocuments.id, proposalDocumentId),
		assignedOpportunityExistsSql(proposalDocuments.opportunityId, actorId)
	)!;
}

function visibleProposalDocumentsForOpportunityCondition(opportunityId: string, actorId: string): SQL {
	return and(
		eq(proposalDocuments.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, actorId)
	)!;
}

function visibleSectionCondition(sectionId: string, actorId: string): SQL {
	return and(
		eq(documentSections.id, sectionId),
		sql`exists (
			select 1
			from proposal_documents
			join opportunities on opportunities.id = proposal_documents.opportunity_id
			where proposal_documents.id = ${documentSections.proposalDocumentId}
				and opportunities.assigned_to = ${actorId}
		)`
	)!;
}

function visibleTemplateCondition(templateId: string, actorId: string): SQL {
	return and(
		eq(templates.id, templateId),
		or(
			eq(templates.createdBy, actorId),
			and(
				eq(templates.status, "published"),
				or(
					eq(templates.visibility, "public"),
					eq(templates.visibility, "organization")
				)!
			)!
		)!
	)!;
}

export async function createWorkflowDocumentFromTemplate(
	input: CreateWorkflowDocumentInput
): Promise<DocumentCreationWorkflowResult> {
	const userContext = await requireUserContext();
	const reason = requireReason(input.reason, "Document creation transitions require a reason");
	const template = input.templateId ? await loadTemplate(input.templateId, userContext.userId) : null;
	const source = input.source ?? (template ? "template" : "blank");
	const rawContent = cloneContent(input.content ?? template?.content ?? blankContent());
	const processedContent = substitutePlaceholders(rawContent, input.placeholderValues ?? {});
	const plainText = extractPlainText(processedContent);
	const now = new Date();
	const title = substitutePlaceholdersInString(input.title.trim(), input.placeholderValues ?? {});

	if (input.opportunityId) {
		const [opportunity] = await db
			.select({ id: opportunities.id })
			.from(opportunities)
			.where(visibleOpportunityCondition(input.opportunityId, userContext.userId))
			.limit(1);
		if (!opportunity) {
			throw new Error("Opportunity not found");
		}
	}

	const [document] = await db
		.insert(documents)
		.values({
			title,
			content: processedContent,
			plainText,
			status: "draft",
			visibility: "private",
			ownerId: input.assignedTo ?? userContext.userId,
			templateId: template?.id ?? null,
			tags: template ? (template.tags as string[]) : [],
			wordCount: countWords(plainText),
			characterCount: plainText.length,
			currentVersion: 1,
			metadata: {
				...(isRecord(template?.defaultMetadata) ? template?.defaultMetadata : {}),
				workflow: CREATION_WORKFLOW_KEY,
				source,
				opportunityId: input.opportunityId ?? null,
				documentType: input.documentType ?? null,
				templateId: template?.id ?? null,
				templateName: template?.name ?? null,
				placeholderKeys: Object.keys(input.placeholderValues ?? {}),
				createdByWorkflowAt: now.toISOString(),
			},
			createdAt: now,
			updatedAt: now,
		})
		.returning();
	if (!document) {
		throw new Error("Failed to create workflow document");
	}

	await db.insert(documentVersions).values({
		documentId: document.id,
		versionNumber: 1,
		content: processedContent,
		changeDescription: reason,
		createdBy: userContext.userId,
		createdAt: now,
	});

	const proposalDocument = input.opportunityId && input.documentType
		? await createProposalLink({
			document,
			opportunityId: input.opportunityId,
			documentType: input.documentType,
			assignedTo: input.assignedTo ?? userContext.userId,
			dueAt: input.dueAt,
			reason,
			actorId: userContext.userId,
			sectionSeeds: input.sectionSeeds ?? inferSections(processedContent),
		})
		: null;

	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: CREATION_WORKFLOW_KEY,
		subjectType: DOCUMENT_SUBJECT_TYPE,
		subjectId: document.id,
		opportunityId: input.opportunityId ?? null,
		fromState: "none",
		toState: "draft_created",
		eventType: "document_created_from_template",
		actorId: userContext.userId,
		reason,
		priority: "medium",
		assignedTo: input.assignedTo ?? userContext.userId,
		assignedRole: "proposal_writer",
		dueAt: normalizeDueAt(input.dueAt, 5),
		metadata: {
			documentId: document.id,
			proposalDocumentId: proposalDocument?.id ?? null,
			templateId: template?.id ?? null,
			source,
			versionNumber: 1,
			wordCount: document.wordCount,
			documentType: input.documentType ?? null,
		},
		terminal: false,
		actionUrl: `/documents/${document.id}`,
	});

	await upsertWorkflowRuntimeTask({
		workflowInstanceId: instance.id,
		taskKey: `document-authoring:${document.id}`,
		title: "Draft proposal document",
		description: `Draft ${title}. Reason: ${reason}`,
		state: "open",
		priority: "medium",
		assignedTo: input.assignedTo ?? userContext.userId,
		assignedRole: "proposal_writer",
		dueAt: normalizeDueAt(input.dueAt, 5),
		metadata: {
			documentId: document.id,
			proposalDocumentId: proposalDocument?.id ?? null,
			versionNumber: 1,
		},
	});

	return {
		documentId: document.id,
		proposalDocumentId: proposalDocument?.id ?? null,
		opportunityId: input.opportunityId ?? null,
		fromState: "none",
		toState: "draft_created",
		versionNumber: 1,
		workflowInstanceId: instance.id,
		taskProjected: true,
	};
}

export async function transitionDocumentAuthoringWorkflow(
	input: DocumentAuthoringWorkflowInput
): Promise<DocumentAuthoringWorkflowResult> {
	const userContext = await requireUserContext();
	const reason = requireReason(input.reason, "Document authoring transitions require a reason");
	const [document] = await db
		.select()
		.from(documents)
		.where(visibleDocumentCondition(input.documentId, userContext.userId))
		.limit(1);
	if (!document) {
		throw new Error("Document not found");
	}

	const proposalDocument = input.proposalDocumentId
		? await loadProposalDocument(input.proposalDocumentId, userContext.userId)
		: null;
	const section = input.sectionId ? await loadSection(input.sectionId, userContext.userId) : null;
	const fromState = authoringState(document, proposalDocument, section);
	const transition = buildAuthoringTransition(input, document, proposalDocument, section, userContext.userId);
	const updatedDocument = await applyDocumentPatch(input, document, transition.documentPatch, userContext.userId, reason);

	if (proposalDocument && transition.proposalPatch) {
		await db
			.update(proposalDocuments)
			.set(transition.proposalPatch)
			.where(visibleProposalDocumentCondition(proposalDocument.id, userContext.userId));
	}
	if (section && transition.sectionPatch) {
		await db
			.update(documentSections)
			.set(transition.sectionPatch)
			.where(visibleSectionCondition(section.id, userContext.userId));
	}

	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: AUTHORING_WORKFLOW_KEY,
		subjectType: DOCUMENT_SUBJECT_TYPE,
		subjectId: input.documentId,
		opportunityId: proposalDocument?.opportunityId ?? null,
		fromState,
		toState: transition.toState,
		eventType: `document_${input.action}`,
		actorId: userContext.userId,
		reason,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? proposalDocument?.assignedTo ?? section?.assignedTo ?? document.ownerId,
		assignedRole: transition.terminal ? null : transition.assignedRole,
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt ?? proposalDocument?.dueDate ?? section?.dueDate, 3),
		metadata: {
			documentId: input.documentId,
			proposalDocumentId: proposalDocument?.id ?? null,
			sectionId: section?.id ?? null,
			action: input.action,
			versionNumber: updatedDocument.currentVersion,
			wordCount: updatedDocument.wordCount,
			provenance: input.provenance ?? null,
		},
		terminal: transition.terminal,
		actionUrl: `/documents/${input.documentId}`,
	});

	await upsertWorkflowRuntimeTask({
		workflowInstanceId: instance.id,
		taskKey: `document-authoring:${input.documentId}`,
		title: transition.taskTitle,
		description: `${transition.taskTitle}. Reason: ${reason}`,
		state: transition.taskState,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? proposalDocument?.assignedTo ?? section?.assignedTo ?? document.ownerId,
		assignedRole: transition.terminal ? null : transition.assignedRole,
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt ?? proposalDocument?.dueDate ?? section?.dueDate, 3),
		metadata: {
			documentId: input.documentId,
			proposalDocumentId: proposalDocument?.id ?? null,
			sectionId: section?.id ?? null,
			fromState,
			toState: transition.toState,
			versionNumber: updatedDocument.currentVersion,
		},
	});

	return {
		documentId: input.documentId,
		proposalDocumentId: proposalDocument?.id ?? null,
		sectionId: section?.id ?? null,
		opportunityId: proposalDocument?.opportunityId ?? null,
		fromState,
		toState: transition.toState,
		versionNumber: updatedDocument.currentVersion,
		workflowInstanceId: instance.id,
		taskProjected: true,
	};
}

async function loadTemplate(templateId: string, actorId: string): Promise<TemplateRow> {
	const [template] = await db
		.select()
		.from(templates)
		.where(visibleTemplateCondition(templateId, actorId))
		.limit(1);
	if (!template) {
		throw new Error("Template not found");
	}
	return template;
}

async function loadProposalDocument(id: string, actorId: string): Promise<ProposalDocumentRow> {
	const [proposalDocument] = await db
		.select()
		.from(proposalDocuments)
		.where(visibleProposalDocumentCondition(id, actorId))
		.limit(1);
	if (!proposalDocument) {
		throw new Error("Proposal document not found");
	}
	return proposalDocument;
}

async function loadSection(id: string, actorId: string): Promise<SectionRow> {
	const [section] = await db
		.select()
		.from(documentSections)
		.where(visibleSectionCondition(id, actorId))
		.limit(1);
	if (!section) {
		throw new Error("Document section not found");
	}
	return section;
}

async function createProposalLink(input: {
	document: DocumentRow;
	opportunityId: string;
	documentType: string;
	assignedTo: string;
	dueAt?: Date | string | null;
	reason: string;
	actorId: string;
	sectionSeeds: Array<{ sectionName: string; targetWordCount?: number | null; requirementIds?: string[] }>;
}): Promise<ProposalDocumentRow> {
	const existingDocs = await db
		.select({ maxOrder: sql<number>`MAX(${proposalDocuments.sectionOrder})` })
		.from(proposalDocuments)
		.where(visibleProposalDocumentsForOpportunityCondition(input.opportunityId, input.actorId));
	const nextOrder = (existingDocs[0]?.maxOrder ?? -1) + 1;
	const [proposalDocument] = await db
		.insert(proposalDocuments)
		.values({
			opportunityId: input.opportunityId,
			documentId: input.document.id,
			documentType: input.documentType,
			sectionOrder: nextOrder,
			status: "drafting",
			assignedTo: input.assignedTo,
			dueDate: normalizeDueAt(input.dueAt, 5),
			notes: input.reason,
		})
		.returning();
	if (!proposalDocument) {
		throw new Error("Failed to create proposal document link");
	}

	if (input.sectionSeeds.length > 0) {
		await db.insert(documentSections).values(input.sectionSeeds.map((section, index) => ({
			proposalDocumentId: proposalDocument.id,
			sectionName: section.sectionName,
			sectionOrder: index,
			status: "drafting",
			wordCount: 0,
			targetWordCount: section.targetWordCount ?? null,
			assignedTo: input.assignedTo,
			dueDate: normalizeDueAt(input.dueAt, 5),
			requirementIds: section.requirementIds ?? [],
		})));
	}
	return proposalDocument;
}

async function applyDocumentPatch(
	input: DocumentAuthoringWorkflowInput,
	document: DocumentRow,
	patch: Partial<typeof documents.$inferInsert>,
	actorId: string,
	reason: string
): Promise<DocumentRow> {
	if (!input.content) {
		const [updated] = await db
			.update(documents)
			.set(patch)
			.where(visibleDocumentCondition(document.id, actorId))
			.returning();
		if (!updated) {
			throw new Error("Failed to update document authoring state");
		}
		return updated;
	}

	const versionNumber = (document.currentVersion ?? 1) + 1;
	const plainText = extractPlainText(input.content);
	const [updated] = await db
		.update(documents)
		.set({
			...patch,
			content: input.content,
			plainText,
			wordCount: countWords(plainText),
			characterCount: plainText.length,
			currentVersion: versionNumber,
			updatedAt: new Date(),
			metadata: {
				...(isRecord(document.metadata) ? document.metadata : {}),
				lastAuthoringAction: input.action,
				lastAuthoringReason: reason,
				lastAuthoringProvenance: input.provenance ?? null,
			},
		})
		.where(visibleDocumentCondition(document.id, actorId))
		.returning();
	if (!updated) {
		throw new Error("Failed to update document content");
	}

	await db.insert(documentVersions).values({
		documentId: document.id,
		versionNumber,
		content: input.content,
		changeDescription: reason,
		createdBy: actorId,
		createdAt: new Date(),
	});
	return updated;
}

function buildAuthoringTransition(
	input: DocumentAuthoringWorkflowInput,
	document: DocumentRow,
	proposalDocument: ProposalDocumentRow | null,
	section: SectionRow | null,
	actorId: string
): {
	toState: string;
	terminal: boolean;
	taskState: "open" | "in_progress" | "completed" | "cancelled";
	taskTitle: string;
	priority: "critical" | "high" | "medium" | "low";
	assignedRole: string;
	documentPatch: Partial<typeof documents.$inferInsert>;
	proposalPatch?: Partial<typeof proposalDocuments.$inferInsert>;
	sectionPatch?: Partial<typeof documentSections.$inferInsert>;
} {
	const now = new Date();
	const plainText = input.content ? extractPlainText(input.content) : document.plainText ?? "";
	switch (input.action) {
		case "start_drafting":
			return {
				toState: "drafting",
				terminal: false,
				taskState: "in_progress",
				taskTitle: "Draft proposal document",
				priority: "medium",
				assignedRole: "proposal_writer",
				documentPatch: { status: "draft", updatedAt: now },
				proposalPatch: proposalDocument ? { status: "drafting", updatedAt: now } : undefined,
				sectionPatch: section ? { status: "drafting", updatedAt: now } : undefined,
			};
		case "persist_content":
			return {
				toState: "draft_saved",
				terminal: false,
				taskState: "in_progress",
				taskTitle: "Continue drafting proposal document",
				priority: "medium",
				assignedRole: "proposal_writer",
				documentPatch: { status: "draft", updatedAt: now },
				proposalPatch: proposalDocument ? { status: "drafting", updatedAt: now } : undefined,
				sectionPatch: section ? {
					status: "drafting",
					wordCount: countWords(plainText),
					updatedAt: now,
				} : undefined,
			};
		case "submit_review":
			return {
				toState: "in_review",
				terminal: false,
				taskState: "open",
				taskTitle: "Review proposal document",
				priority: "high",
				assignedRole: "proposal_reviewer",
				documentPatch: { status: "review", updatedAt: now },
				proposalPatch: proposalDocument ? { status: "in_review", reviewerId: input.assignedTo ?? proposalDocument.reviewerId, updatedAt: now } : undefined,
				sectionPatch: section ? { status: "in_review", updatedAt: now } : undefined,
			};
		case "accept_ai":
			return {
				toState: "ai_accepted",
				terminal: false,
				taskState: "in_progress",
				taskTitle: "Validate accepted AI-assisted draft",
				priority: "medium",
				assignedRole: "proposal_writer",
				documentPatch: {
					status: "draft",
					metadata: mergeMetadata(document.metadata, {
						lastAIDecision: "accepted",
						lastAIDecisionBy: actorId,
						lastAIDecisionAt: now.toISOString(),
					}),
					updatedAt: now,
				},
				proposalPatch: proposalDocument ? { status: "drafting", updatedAt: now } : undefined,
				sectionPatch: section ? { status: "drafting", updatedAt: now } : undefined,
			};
		case "reject_ai":
			return {
				toState: "ai_rejected",
				terminal: false,
				taskState: "in_progress",
				taskTitle: "Revise rejected AI-assisted draft",
				priority: "medium",
				assignedRole: "proposal_writer",
				documentPatch: {
					status: "draft",
					metadata: mergeMetadata(document.metadata, {
						lastAIDecision: "rejected",
						lastAIDecisionBy: actorId,
						lastAIDecisionAt: now.toISOString(),
					}),
					updatedAt: now,
				},
				proposalPatch: proposalDocument ? { status: "revising", updatedAt: now } : undefined,
				sectionPatch: section ? { status: "drafting", updatedAt: now } : undefined,
			};
		case "mark_ready":
			return {
				toState: "ready",
				terminal: true,
				taskState: "completed",
				taskTitle: "Proposal document ready",
				priority: "low",
				assignedRole: "proposal_writer",
				documentPatch: { status: "approved", updatedAt: now },
				proposalPatch: proposalDocument ? {
					status: "approved",
					approvedBy: actorId,
					approvedAt: now,
					updatedAt: now,
				} : undefined,
				sectionPatch: section ? { status: "approved", updatedAt: now } : undefined,
			};
		case "reopen":
			return {
				toState: "drafting",
				terminal: false,
				taskState: "open",
				taskTitle: "Reopened proposal document drafting",
				priority: "medium",
				assignedRole: "proposal_writer",
				documentPatch: { status: "draft", updatedAt: now },
				proposalPatch: proposalDocument ? {
					status: "revising",
					approvedBy: null,
					approvedAt: null,
					updatedAt: now,
				} : undefined,
				sectionPatch: section ? { status: "drafting", updatedAt: now } : undefined,
			};
	}
}

function authoringState(
	document: DocumentRow,
	proposalDocument: ProposalDocumentRow | null,
	section: SectionRow | null
): string {
	return section?.status ?? proposalDocument?.status ?? document.status ?? "draft";
}

function inferSections(content: DocumentContent): Array<{ sectionName: string; targetWordCount?: number | null; requirementIds?: string[] }> {
	const sections: string[] = [];
	visitContent(content, (node) => {
		if (typeof node.type === "string" && /^heading$/i.test(node.type)) {
			const text = extractPlainText(node);
			if (text) sections.push(text.slice(0, 200));
		}
	});
	return sections.map((sectionName) => ({ sectionName, targetWordCount: null, requirementIds: [] }));
}

function substitutePlaceholders(content: DocumentContent, values: Record<string, string | number | boolean | null>): DocumentContent {
	const substitute = (value: unknown): unknown => {
		if (typeof value === "string") {
			return substitutePlaceholdersInString(value, values);
		}
		if (Array.isArray(value)) {
			return value.map(substitute);
		}
		if (isRecord(value)) {
			return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, substitute(nested)]));
		}
		return value;
	};
	return substitute(content) as DocumentContent;
}

function substitutePlaceholdersInString(
	text: string,
	values: Record<string, string | number | boolean | null>
): string {
	return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key: string) => {
		const value = values[key];
		return value === undefined || value === null ? match : String(value);
	});
}

function extractPlainText(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) return content.map(extractPlainText).filter(Boolean).join(" ");
	if (!isRecord(content)) return "";
	const ownText = typeof content.text === "string" ? content.text : "";
	const childText = extractPlainText(content.content);
	return [ownText, childText].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function visitContent(content: unknown, visitor: (node: Record<string, unknown>) => void): void {
	if (Array.isArray(content)) {
		for (const item of content) visitContent(item, visitor);
		return;
	}
	if (!isRecord(content)) return;
	visitor(content);
	visitContent(content.content, visitor);
}

function countWords(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

function cloneContent(content: unknown): DocumentContent {
	if (!isRecord(content)) return blankContent();
	return JSON.parse(JSON.stringify(content)) as DocumentContent;
}

function blankContent(): DocumentContent {
	return { type: "doc", content: [{ type: "paragraph", content: [] }] };
}

function mergeMetadata(existing: unknown, patch: Record<string, unknown>): Record<string, unknown> {
	return {
		...(isRecord(existing) ? existing : {}),
		...patch,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireReason(value: string, message: string): string {
	const reason = value.trim();
	if (!reason) {
		throw new Error(message);
	}
	return reason;
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
