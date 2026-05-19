/**
 * Proposal Documents Server Actions - DocFusion
 *
 * Server actions for managing proposal documents and their relationship
 * to opportunities. Handles document creation, linking, status tracking,
 * and progress calculations.
 */

"use server";

import { db } from "@/lib/db";
import { documents, proposalDocuments, documentSections } from "@/lib/db/schema";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import type {
	ProposalDocument,
	ProposalDocumentType,
	ProposalDocumentStatus,
	CreateProposalDocumentInput,
	LinkDocumentInput,
	UpdateProposalDocumentInput,
	ProposalProgress,
	DocumentSection,
	CreateSectionInput,
	UpdateSectionInput,
	SectionProgress,
	DocumentSectionStatus,
} from "@/lib/types/opportunity";
import { getDocumentTypeLabel } from "@/lib/utils/proposal-labels";
import {
	getDatacraftProposalDocumentContent,
	getDatacraftProposalSectionSeeds,
} from "@/lib/data/datacraft-response-content";
import { getCurrentUserId } from "@/lib/auth-utils";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Maps database row to ProposalDocument type.
 */
function mapProposalDocument(
	row: typeof proposalDocuments.$inferSelect,
	doc?: typeof documents.$inferSelect | null
): ProposalDocument {
	return {
		id: row.id,
		opportunityId: row.opportunityId,
		documentId: row.documentId,
		documentType: row.documentType as ProposalDocumentType,
		sectionOrder: row.sectionOrder,
		status: row.status as ProposalDocumentStatus,
		assignedTo: row.assignedTo,
		dueDate: row.dueDate,
		reviewerId: row.reviewerId,
		approvedBy: row.approvedBy,
		approvedAt: row.approvedAt,
		aiAnalysisScore: row.aiAnalysisScore,
		aiAnalysisAt: row.aiAnalysisAt,
		notes: row.notes,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		document: doc
			? {
					id: doc.id,
					title: doc.title,
					wordCount: doc.wordCount,
					status: doc.status,
					updatedAt: doc.updatedAt,
			  }
			: undefined,
	};
}

/**
 * Maps database row to DocumentSection type.
 */
function mapDocumentSection(row: typeof documentSections.$inferSelect): DocumentSection {
	return {
		id: row.id,
		proposalDocumentId: row.proposalDocumentId,
		sectionName: row.sectionName,
		sectionOrder: row.sectionOrder,
		status: row.status as DocumentSectionStatus,
		wordCount: row.wordCount,
		targetWordCount: row.targetWordCount,
		assignedTo: row.assignedTo,
		dueDate: row.dueDate,
		requirementIds: (row.requirementIds as string[]) || [],
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function extractPlainText(content: unknown): string {
	if (typeof content === "string") {
		return content;
	}

	if (Array.isArray(content)) {
		return content.map(extractPlainText).filter(Boolean).join(" ");
	}

	if (content && typeof content === "object") {
		const record = content as Record<string, unknown>;
		const ownText = typeof record.text === "string" ? record.text : "";
		const childText = extractPlainText(record.content);
		return [ownText, childText].filter(Boolean).join(" ");
	}

	return "";
}

function countWords(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

async function requireCurrentUserId(): Promise<string> {
	const userId = await getCurrentUserId();
	if (!userId) {
		throw new Error("Unauthorized");
	}
	return userId;
}

// Label utility functions are in @/lib/utils/proposal-labels.ts
// to avoid "use server" requirement for synchronous client functions

// ============================================================================
// Proposal Document CRUD Operations
// ============================================================================

/**
 * Get a single proposal document by ID.
 */
export async function getProposalDocument(id: string): Promise<ProposalDocument | null> {
	const results = await db
		.select()
		.from(proposalDocuments)
		.leftJoin(documents, eq(proposalDocuments.documentId, documents.id))
		.where(eq(proposalDocuments.id, id))
		.limit(1);

	if (results.length === 0) return null;

	const { proposal_documents, documents: doc } = results[0];
	return mapProposalDocument(proposal_documents, doc);
}

/**
 * Get all proposal documents for an opportunity.
 */
export async function getProposalDocuments(
	opportunityId: string,
	includeDocument = true
): Promise<ProposalDocument[]> {
	if (includeDocument) {
		const results = await db
			.select()
			.from(proposalDocuments)
			.leftJoin(documents, eq(proposalDocuments.documentId, documents.id))
			.where(eq(proposalDocuments.opportunityId, opportunityId))
			.orderBy(asc(proposalDocuments.sectionOrder), asc(proposalDocuments.createdAt));

		return results.map(({ proposal_documents, documents: doc }) =>
			mapProposalDocument(proposal_documents, doc)
		);
	}

	const results = await db
		.select()
		.from(proposalDocuments)
		.where(eq(proposalDocuments.opportunityId, opportunityId))
		.orderBy(asc(proposalDocuments.sectionOrder), asc(proposalDocuments.createdAt));

	return results.map((row) => mapProposalDocument(row));
}

/**
 * Create a new proposal document with a new underlying document.
 */
export async function createProposalDocument(
	input: CreateProposalDocumentInput
): Promise<ProposalDocument> {
	const userId = await requireCurrentUserId();
	const { opportunityId, documentType, title, templateId, assignedTo, dueDate, notes } = input;

	// Generate a title if not provided
	const documentTitle = title || `${getDocumentTypeLabel(documentType)} - Draft`;

	// Get max section order for this opportunity
	const existingDocs = await db
		.select({ maxOrder: sql<number>`MAX(${proposalDocuments.sectionOrder})` })
		.from(proposalDocuments)
		.where(eq(proposalDocuments.opportunityId, opportunityId));

	const nextOrder = (existingDocs[0]?.maxOrder ?? -1) + 1;

	// Create the underlying document first
	const defaultContent = getDatacraftProposalDocumentContent(documentType);
	const plainText = extractPlainText(defaultContent);
	const wordCount = countWords(plainText);
	const [newDoc] = await db
		.insert(documents)
		.values({
			title: documentTitle,
			content: defaultContent,
			plainText,
			templateId: templateId || null,
			status: "draft",
			ownerId: userId,
			tags: ["datacraft", "proposal-response", documentType],
			wordCount,
			characterCount: plainText.length,
			metadata: {
				source: "datacraft_response_sections",
				documentType,
			},
		})
		.returning();

	// Create the proposal document link
	const [proposalDoc] = await db
		.insert(proposalDocuments)
		.values({
			opportunityId,
			documentId: newDoc.id,
			documentType,
			sectionOrder: nextOrder,
			status: "not_started",
			assignedTo: assignedTo || null,
			dueDate: dueDate ? new Date(dueDate) : null,
			notes: notes || null,
		})
		.returning();

	const sectionSeeds = getDatacraftProposalSectionSeeds(documentType);
	if (sectionSeeds.length > 0) {
		const estimatedSectionWords = Math.round(wordCount / sectionSeeds.length);
		await db.insert(documentSections).values(
			sectionSeeds.map((section, index) => ({
				proposalDocumentId: proposalDoc.id,
				sectionName: section.sectionName,
				sectionOrder: index,
				status: estimatedSectionWords > 0 ? "drafting" : "not_started",
				wordCount: estimatedSectionWords,
				targetWordCount: section.targetWordCount,
				assignedTo: assignedTo || null,
				dueDate: dueDate ? new Date(dueDate) : null,
				requirementIds: [],
			}))
		);
	}

	return mapProposalDocument(proposalDoc, newDoc);
}

/**
 * Link an existing document to a proposal.
 */
export async function linkExistingDocument(input: LinkDocumentInput): Promise<ProposalDocument> {
	await requireCurrentUserId();
	const { opportunityId, documentId, documentType, sectionOrder, assignedTo, dueDate, notes } =
		input;

	// Check if document exists
	const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);

	if (!doc) {
		throw new Error("Document not found");
	}

	// Check if already linked
	const existing = await db
		.select()
		.from(proposalDocuments)
		.where(
			and(
				eq(proposalDocuments.opportunityId, opportunityId),
				eq(proposalDocuments.documentId, documentId)
			)
		)
		.limit(1);

	if (existing.length > 0) {
		throw new Error("Document is already linked to this opportunity");
	}

	// Get max section order if not provided
	let order = sectionOrder;
	if (order === undefined) {
		const existingDocs = await db
			.select({ maxOrder: sql<number>`MAX(${proposalDocuments.sectionOrder})` })
			.from(proposalDocuments)
			.where(eq(proposalDocuments.opportunityId, opportunityId));

		order = (existingDocs[0]?.maxOrder ?? -1) + 1;
	}

	// Create the link
	const [proposalDoc] = await db
		.insert(proposalDocuments)
		.values({
			opportunityId,
			documentId,
			documentType,
			sectionOrder: order,
			status: "not_started",
			assignedTo: assignedTo || null,
			dueDate: dueDate ? new Date(dueDate) : null,
			notes: notes || null,
		})
		.returning();

	return mapProposalDocument(proposalDoc, doc);
}

/**
 * Update a proposal document.
 */
export async function updateProposalDocument(
	id: string,
	input: UpdateProposalDocumentInput
): Promise<ProposalDocument> {
	const userId = await requireCurrentUserId();
	const updateData: Partial<typeof proposalDocuments.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (input.documentType !== undefined) updateData.documentType = input.documentType;
	if (input.sectionOrder !== undefined) updateData.sectionOrder = input.sectionOrder;
	if (input.status !== undefined) updateData.status = input.status;
	if (input.assignedTo !== undefined) updateData.assignedTo = input.assignedTo;
	if (input.dueDate !== undefined) {
		updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
	}
	if (input.reviewerId !== undefined) updateData.reviewerId = input.reviewerId;
	if (input.notes !== undefined) updateData.notes = input.notes;

	// Handle approval
	if (input.status === "approved" && !updateData.approvedAt) {
		updateData.approvedAt = new Date();
		updateData.approvedBy = userId;
	}

	const [updated] = await db
		.update(proposalDocuments)
		.set(updateData)
		.where(eq(proposalDocuments.id, id))
		.returning();

	if (!updated) {
		throw new Error("Proposal document not found");
	}

	// Fetch with document data
	return getProposalDocument(id) as Promise<ProposalDocument>;
}

/**
 * Update the status of a proposal document.
 */
export async function updateProposalDocumentStatus(
	id: string,
	status: ProposalDocumentStatus,
	notes?: string
): Promise<ProposalDocument> {
	return updateProposalDocument(id, { status, notes });
}

/**
 * Delete a proposal document link (does not delete the underlying document).
 */
export async function unlinkProposalDocument(id: string): Promise<void> {
	await requireCurrentUserId();
	await db.delete(proposalDocuments).where(eq(proposalDocuments.id, id));
}

/**
 * Delete a proposal document and its underlying document.
 */
export async function deleteProposalDocument(id: string): Promise<void> {
	await requireCurrentUserId();
	// Get the document ID first
	const [proposalDoc] = await db
		.select({ documentId: proposalDocuments.documentId })
		.from(proposalDocuments)
		.where(eq(proposalDocuments.id, id))
		.limit(1);

	if (!proposalDoc) {
		throw new Error("Proposal document not found");
	}

	// Delete proposal document link (cascades to sections)
	await db.delete(proposalDocuments).where(eq(proposalDocuments.id, id));

	// Delete underlying document
	await db.delete(documents).where(eq(documents.id, proposalDoc.documentId));
}

/**
 * Reorder proposal documents.
 */
export async function reorderProposalDocuments(
	opportunityId: string,
	orderedIds: string[]
): Promise<void> {
	await requireCurrentUserId();
	// Update each document with its new order
	await Promise.all(
		orderedIds.map((id, index) =>
			db
				.update(proposalDocuments)
				.set({ sectionOrder: index, updatedAt: new Date() })
				.where(and(eq(proposalDocuments.id, id), eq(proposalDocuments.opportunityId, opportunityId)))
		)
	);
}

// ============================================================================
// Progress Tracking
// ============================================================================

/**
 * Calculate proposal progress for an opportunity.
 */
export async function getProposalProgress(opportunityId: string): Promise<ProposalProgress> {
	const docs = await db
		.select()
		.from(proposalDocuments)
		.where(eq(proposalDocuments.opportunityId, opportunityId));

	const now = new Date();

	// Initialize status counts
	const byStatus: Record<ProposalDocumentStatus, number> = {
		not_started: 0,
		drafting: 0,
		in_review: 0,
		revising: 0,
		approved: 0,
		final: 0,
	};

	let documentsOnTrack = 0;
	let documentsOverdue = 0;
	let documentsAtRisk = 0;
	let nextDeadline: Date | null = null;
	let totalAiScore = 0;
	let aiScoreCount = 0;

	for (const doc of docs) {
		// Count by status
		const status = doc.status as ProposalDocumentStatus;
		byStatus[status] = (byStatus[status] || 0) + 1;

		// Track deadlines and progress
		if (doc.dueDate) {
			const dueDate = new Date(doc.dueDate);

			// Check if this is the next upcoming deadline
			if (dueDate > now && (!nextDeadline || dueDate < nextDeadline)) {
				nextDeadline = dueDate;
			}

			// Determine status relative to deadline
			const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

			if (status === "final" || status === "approved") {
				documentsOnTrack++;
			} else if (dueDate < now) {
				documentsOverdue++;
			} else if (daysUntilDue <= 3 && status === "not_started") {
				documentsAtRisk++;
			} else if (daysUntilDue <= 7 && (status === "not_started" || status === "drafting")) {
				documentsAtRisk++;
			} else {
				documentsOnTrack++;
			}
		} else {
			// No deadline set - consider on track if not stale
			if (status !== "not_started") {
				documentsOnTrack++;
			}
		}

		// Track AI scores
		if (doc.aiAnalysisScore !== null) {
			totalAiScore += doc.aiAnalysisScore;
			aiScoreCount++;
		}
	}

	// Calculate completion percentage
	// Weight: not_started=0, drafting=20, in_review=60, revising=40, approved=80, final=100
	const statusWeights: Record<ProposalDocumentStatus, number> = {
		not_started: 0,
		drafting: 20,
		in_review: 60,
		revising: 40,
		approved: 80,
		final: 100,
	};

	let totalWeight = 0;
	for (const doc of docs) {
		totalWeight += statusWeights[doc.status as ProposalDocumentStatus] || 0;
	}

	const completionPercentage = docs.length > 0 ? Math.round(totalWeight / docs.length) : 0;

	return {
		opportunityId,
		totalDocuments: docs.length,
		byStatus,
		completionPercentage,
		documentsOnTrack,
		documentsOverdue,
		documentsAtRisk,
		nextDeadline,
		averageAiScore: aiScoreCount > 0 ? Math.round(totalAiScore / aiScoreCount) : null,
	};
}

// ============================================================================
// Document Section Operations
// ============================================================================

/**
 * Get all sections for a proposal document.
 */
export async function getDocumentSections(proposalDocumentId: string): Promise<DocumentSection[]> {
	const results = await db
		.select()
		.from(documentSections)
		.where(eq(documentSections.proposalDocumentId, proposalDocumentId))
		.orderBy(asc(documentSections.sectionOrder));

	return results.map(mapDocumentSection);
}

/**
 * Create a new document section.
 */
export async function createSection(input: CreateSectionInput): Promise<DocumentSection> {
	await requireCurrentUserId();
	const {
		proposalDocumentId,
		sectionName,
		sectionOrder,
		targetWordCount,
		assignedTo,
		dueDate,
		requirementIds,
	} = input;

	// Get max section order if not provided
	let order = sectionOrder;
	if (order === undefined) {
		const existingSections = await db
			.select({ maxOrder: sql<number>`MAX(${documentSections.sectionOrder})` })
			.from(documentSections)
			.where(eq(documentSections.proposalDocumentId, proposalDocumentId));

		order = (existingSections[0]?.maxOrder ?? -1) + 1;
	}

	const [section] = await db
		.insert(documentSections)
		.values({
			proposalDocumentId,
			sectionName,
			sectionOrder: order,
			status: "not_started",
			wordCount: 0,
			targetWordCount: targetWordCount || null,
			assignedTo: assignedTo || null,
			dueDate: dueDate ? new Date(dueDate) : null,
			requirementIds: requirementIds || [],
		})
		.returning();

	return mapDocumentSection(section);
}

/**
 * Update a document section.
 */
export async function updateSection(
	id: string,
	input: UpdateSectionInput
): Promise<DocumentSection> {
	await requireCurrentUserId();
	const updateData: Partial<typeof documentSections.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (input.sectionName !== undefined) updateData.sectionName = input.sectionName;
	if (input.sectionOrder !== undefined) updateData.sectionOrder = input.sectionOrder;
	if (input.status !== undefined) updateData.status = input.status;
	if (input.wordCount !== undefined) updateData.wordCount = input.wordCount;
	if (input.targetWordCount !== undefined) updateData.targetWordCount = input.targetWordCount;
	if (input.assignedTo !== undefined) updateData.assignedTo = input.assignedTo;
	if (input.dueDate !== undefined) {
		updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
	}
	if (input.requirementIds !== undefined) updateData.requirementIds = input.requirementIds;

	const [updated] = await db
		.update(documentSections)
		.set(updateData)
		.where(eq(documentSections.id, id))
		.returning();

	if (!updated) {
		throw new Error("Document section not found");
	}

	return mapDocumentSection(updated);
}

/**
 * Update section progress (word count and status).
 */
export async function updateSectionProgress(
	id: string,
	wordCount: number,
	status?: DocumentSectionStatus
): Promise<DocumentSection> {
	return updateSection(id, { wordCount, status });
}

/**
 * Link requirements to a section.
 */
export async function linkRequirementsToSection(
	sectionId: string,
	requirementIds: string[]
): Promise<DocumentSection> {
	return updateSection(sectionId, { requirementIds });
}

/**
 * Delete a document section.
 */
export async function deleteSection(id: string): Promise<void> {
	await requireCurrentUserId();
	await db.delete(documentSections).where(eq(documentSections.id, id));
}

/**
 * Reorder document sections.
 */
export async function reorderSections(
	proposalDocumentId: string,
	orderedIds: string[]
): Promise<void> {
	await requireCurrentUserId();
	await Promise.all(
		orderedIds.map((id, index) =>
			db
				.update(documentSections)
				.set({ sectionOrder: index, updatedAt: new Date() })
				.where(
					and(
						eq(documentSections.id, id),
						eq(documentSections.proposalDocumentId, proposalDocumentId)
					)
				)
		)
	);
}

/**
 * Get section progress for a proposal document.
 */
export async function getSectionProgress(proposalDocumentId: string): Promise<SectionProgress[]> {
	const sections = await getDocumentSections(proposalDocumentId);

	return sections.map((section) => {
		const progressPercentage =
			section.targetWordCount && section.targetWordCount > 0
				? Math.min(100, Math.round((section.wordCount / section.targetWordCount) * 100))
				: section.wordCount > 0
				? 50 // If no target but has content, assume 50%
				: 0;

		return {
			sectionId: section.id,
			sectionName: section.sectionName,
			wordCount: section.wordCount,
			targetWordCount: section.targetWordCount,
			progressPercentage,
			status: section.status,
			requirementsAddressed: section.requirementIds.length,
			totalRequirements: section.requirementIds.length, // Would need requirements lookup for actual total
		};
	});
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Create standard proposal document set for an opportunity.
 */
export async function createStandardProposalSet(
	opportunityId: string,
	documentTypes?: ProposalDocumentType[]
): Promise<ProposalDocument[]> {
	await requireCurrentUserId();
	const types = documentTypes || [
		"cover_letter",
		"executive_summary",
		"technical_approach",
		"management_plan",
		"staffing_plan",
		"past_performance",
		"cost_proposal",
	];

	const created: ProposalDocument[] = [];

	for (const documentType of types) {
		const doc = await createProposalDocument({
			opportunityId,
			documentType,
		});
		created.push(doc);
	}

	return created;
}

/**
 * Bulk update proposal document statuses.
 */
export async function bulkUpdateStatus(
	ids: string[],
	status: ProposalDocumentStatus
): Promise<void> {
	await requireCurrentUserId();
	await db
		.update(proposalDocuments)
		.set({ status, updatedAt: new Date() })
		.where(inArray(proposalDocuments.id, ids));
}

/**
 * Bulk assign proposal documents.
 */
export async function bulkAssign(ids: string[], assignedTo: string): Promise<void> {
	await requireCurrentUserId();
	await db
		.update(proposalDocuments)
		.set({ assignedTo, updatedAt: new Date() })
		.where(inArray(proposalDocuments.id, ids));
}
