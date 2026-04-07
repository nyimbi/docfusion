"use server";

/**
 * Server Actions for RFP Intelligence Platform
 *
 * Handles:
 * - RFP document upload and parsing
 * - Requirements extraction and classification
 * - Compliance matrix management
 * - Semantic search across RFP content
 */

import { db } from "@/lib/db";
import {
	rfpDocuments,
	rfpRequirements,
	complianceMatrices,
	complianceEntries,
	rfpParsingJobs,
	type NewRfpDocument,
	type NewRfpRequirement,
	type NewComplianceMatrix,
	type NewComplianceEntry,
	type NewRfpParsingJob,
	type RfpDocumentRow,
	type RfpRequirementRow,
	type ComplianceMatrixRow,
	type ComplianceEntryRow,
} from "@/lib/db/schema";
import { eq, and, desc, asc, sql, ilike, or, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
	parseRFPWithAI,
	batchExtractRequirements,
	type ExtractedRequirement,
} from "@/lib/ai/rfp-parser";
import type {
	RfpFormat,
	RfpRequirementCategory,
	RfpRequirementPriority,
	RfpComplianceStatus,
	RfpRiskLevel,
	MatrixStatus,
	RfpRequirementFilters,
	ComplianceMatrixFilters,
	UploadRfpInput,
	CreateComplianceMatrixInput,
	UpdateComplianceEntryInput,
} from "@/lib/types/rfp";
import { logger } from "@/lib/utils/logger";

// ============================================================================
// RFP Document Actions
// ============================================================================

/**
 * Upload and begin parsing an RFP document
 */
export async function uploadRfpDocument(input: {
	opportunityId?: string;
	filename: string;
	fileType: "pdf" | "docx" | "html";
	fileSize: number;
	storagePath: string;
	fileHash?: string;
}): Promise<{ success: boolean; rfpDocumentId?: string; jobId?: string; error?: string }> {
	try {
		const userId = await getCurrentUserId();
		if (!userId) {
			return { success: false, error: "Not authenticated" };
		}

		// Check for duplicate based on hash
		if (input.fileHash) {
			const existing = await db.query.rfpDocuments.findFirst({
				where: eq(rfpDocuments.fileHash, input.fileHash),
			});
			if (existing) {
				return { success: false, error: "This document has already been uploaded" };
			}
		}

		// Create RFP document record
		const [rfpDoc] = await db.insert(rfpDocuments).values({
			opportunityId: input.opportunityId,
			filename: input.filename,
			fileType: input.fileType,
			fileSize: input.fileSize,
			storagePath: input.storagePath,
			fileHash: input.fileHash,
			parsingStatus: "pending",
			uploadedBy: userId,
		}).returning();

		// Create parsing job
		const [job] = await db.insert(rfpParsingJobs).values({
			rfpDocumentId: rfpDoc.id,
			status: "queued",
			initiatedBy: userId,
		}).returning();

		// Start the parsing job asynchronously (fire-and-forget)
		// This runs after the response is sent to the client
		processRfpParsingJob(job.id, rfpDoc.id).catch((error) => {
			logger.error("[RFP Parser] Background job failed:", error);
		});

		revalidatePath("/documents");
		return { success: true, rfpDocumentId: rfpDoc.id, jobId: job.id };
	} catch (error) {
		logger.error("Error uploading RFP document:", error);
		return { success: false, error: "Failed to upload document" };
	}
}

/**
 * Get an RFP document by ID
 */
export async function getRfpDocument(id: string): Promise<RfpDocumentRow | null> {
	try {
		const doc = await db.query.rfpDocuments.findFirst({
			where: eq(rfpDocuments.id, id),
		});
		return doc ?? null;
	} catch (error) {
		logger.error("Error getting RFP document:", error);
		return null;
	}
}

/**
 * List RFP documents with optional filters
 */
export async function listRfpDocuments(params?: {
	opportunityId?: string;
	parsingStatus?: string;
	limit?: number;
	offset?: number;
}): Promise<{ documents: RfpDocumentRow[]; total: number }> {
	try {
		const { opportunityId, parsingStatus, limit = 20, offset = 0 } = params ?? {};

		const conditions = [];
		if (opportunityId) conditions.push(eq(rfpDocuments.opportunityId, opportunityId));
		if (parsingStatus) conditions.push(eq(rfpDocuments.parsingStatus, parsingStatus));

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const [documents, [{ count }]] = await Promise.all([
			db.query.rfpDocuments.findMany({
				where: whereClause,
				orderBy: [desc(rfpDocuments.createdAt)],
				limit,
				offset,
			}),
			db.select({ count: sql<number>`count(*)` }).from(rfpDocuments).where(whereClause),
		]);

		return { documents, total: Number(count) };
	} catch (error) {
		logger.error("Error listing RFP documents:", error);
		return { documents: [], total: 0 };
	}
}

/**
 * Delete an RFP document and all related data
 */
export async function deleteRfpDocument(id: string): Promise<{ success: boolean; error?: string }> {
	try {
		const userId = await getCurrentUserId();
		if (!userId) {
			return { success: false, error: "Not authenticated" };
		}

		await db.delete(rfpDocuments).where(eq(rfpDocuments.id, id));
		revalidatePath("/documents");
		return { success: true };
	} catch (error) {
		logger.error("Error deleting RFP document:", error);
		return { success: false, error: "Failed to delete document" };
	}
}

// ============================================================================
// Requirements Actions
// ============================================================================

/**
 * Get requirements for an RFP document
 */
export async function getRequirements(filters: RfpRequirementFilters & {
	limit?: number;
	offset?: number;
	sortBy?: "requirementNumber" | "priority" | "category" | "complianceStatus" | "createdAt";
	sortOrder?: "asc" | "desc";
}): Promise<{ requirements: RfpRequirementRow[]; total: number }> {
	try {
		const {
			rfpDocumentId,
			opportunityId,
			category,
			priority,
			complianceStatus,
			riskLevel,
			assignedTo,
			search,
			limit = 50,
			offset = 0,
			sortBy = "requirementNumber",
			sortOrder = "asc",
		} = filters;

		const conditions = [];
		if (rfpDocumentId) conditions.push(eq(rfpRequirements.rfpDocumentId, rfpDocumentId));
		if (opportunityId) conditions.push(eq(rfpRequirements.opportunityId, opportunityId));
		if (category) conditions.push(eq(rfpRequirements.category, category));
		if (priority) conditions.push(eq(rfpRequirements.priority, priority));
		if (complianceStatus) conditions.push(eq(rfpRequirements.complianceStatus, complianceStatus));
		if (riskLevel) conditions.push(eq(rfpRequirements.riskLevel, riskLevel));
		if (assignedTo) conditions.push(eq(rfpRequirements.assignedTo, assignedTo));
		if (search) {
			conditions.push(or(
				ilike(rfpRequirements.title, `%${search}%`),
				ilike(rfpRequirements.requirementText, `%${search}%`),
				ilike(rfpRequirements.requirementNumber, `%${search}%`),
			));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
		const orderColumn = rfpRequirements[sortBy as keyof typeof rfpRequirements] || rfpRequirements.requirementNumber;
		const orderFn = sortOrder === "desc" ? desc : asc;

		const [requirements, [{ count }]] = await Promise.all([
			db.query.rfpRequirements.findMany({
				where: whereClause,
				orderBy: [orderFn(orderColumn as unknown as Parameters<typeof asc>[0])],
				limit,
				offset,
			}),
			db.select({ count: sql<number>`count(*)` }).from(rfpRequirements).where(whereClause),
		]);

		return { requirements, total: Number(count) };
	} catch (error) {
		logger.error("Error getting requirements:", error);
		return { requirements: [], total: 0 };
	}
}

/**
 * Get a single requirement by ID
 */
export async function getRequirement(id: string): Promise<RfpRequirementRow | null> {
	try {
		const req = await db.query.rfpRequirements.findFirst({
			where: eq(rfpRequirements.id, id),
		});
		return req ?? null;
	} catch (error) {
		logger.error("Error getting requirement:", error);
		return null;
	}
}

/**
 * Update a requirement
 */
export async function updateRequirement(
	id: string,
	updates: Partial<{
		complianceStatus: RfpComplianceStatus;
		responseStrategy: string;
		assignedTo: string;
		dueDate: string;
		responseDocumentId: string;
		responseSection: string;
		notes: string;
		tags: string[];
	}>
): Promise<{ success: boolean; error?: string }> {
	try {
		const userId = await getCurrentUserId();
		if (!userId) {
			return { success: false, error: "Not authenticated" };
		}

		await db.update(rfpRequirements)
			.set({
				...updates,
				dueDate: updates.dueDate ? new Date(updates.dueDate) : undefined,
				updatedAt: new Date(),
			})
			.where(eq(rfpRequirements.id, id));

		revalidatePath("/requirements");
		return { success: true };
	} catch (error) {
		logger.error("Error updating requirement:", error);
		return { success: false, error: "Failed to update requirement" };
	}
}

/**
 * Bulk update requirements
 */
export async function bulkUpdateRequirements(
	ids: string[],
	updates: Partial<{
		complianceStatus: RfpComplianceStatus;
		assignedTo: string;
		dueDate: string;
	}>
): Promise<{ success: boolean; updated: number; error?: string }> {
	try {
		const userId = await getCurrentUserId();
		if (!userId) {
			return { success: false, updated: 0, error: "Not authenticated" };
		}

		const result = await db.update(rfpRequirements)
			.set({
				...updates,
				dueDate: updates.dueDate ? new Date(updates.dueDate) : undefined,
				updatedAt: new Date(),
			})
			.where(inArray(rfpRequirements.id, ids));

		revalidatePath("/requirements");
		return { success: true, updated: ids.length };
	} catch (error) {
		logger.error("Error bulk updating requirements:", error);
		return { success: false, updated: 0, error: "Failed to update requirements" };
	}
}

// ============================================================================
// Compliance Matrix Actions
// ============================================================================

/**
 * Create a new compliance matrix
 */
export async function createComplianceMatrix(
	input: CreateComplianceMatrixInput
): Promise<{ success: boolean; matrixId?: string; error?: string }> {
	try {
		const userId = await getCurrentUserId();
		if (!userId) {
			return { success: false, error: "Not authenticated" };
		}

		// Get requirements to include in matrix
		const requirements = input.includeRequirementIds
			? await db.query.rfpRequirements.findMany({
					where: inArray(rfpRequirements.id, input.includeRequirementIds),
			  })
			: input.rfpDocumentId
			? await db.query.rfpRequirements.findMany({
					where: eq(rfpRequirements.rfpDocumentId, input.rfpDocumentId),
			  })
			: [];

		// Create the matrix
		const [matrix] = await db.insert(complianceMatrices).values({
			opportunityId: input.opportunityId,
			rfpDocumentId: input.rfpDocumentId,
			name: input.name,
			description: input.description,
			totalRequirements: requirements.length,
			mandatoryCount: requirements.filter(r => r.priority === "mandatory").length,
			notAddressedCount: requirements.length,
			createdBy: userId,
		}).returning();

		// Create entries for each requirement
		if (requirements.length > 0) {
			await db.insert(complianceEntries).values(
				requirements.map((req, index) => ({
					matrixId: matrix.id,
					requirementId: req.id,
					complianceStatus: "pending" as const,
					sortOrder: index,
				}))
			);
		}

		revalidatePath("/compliance");
		return { success: true, matrixId: matrix.id };
	} catch (error) {
		logger.error("Error creating compliance matrix:", error);
		return { success: false, error: "Failed to create compliance matrix" };
	}
}

/**
 * Get a compliance matrix by ID with all entries
 */
export async function getComplianceMatrix(id: string): Promise<{
	matrix: ComplianceMatrixRow | null;
	entries: ComplianceEntryRow[];
	requirements: Record<string, RfpRequirementRow>;
}> {
	try {
		const matrix = await db.query.complianceMatrices.findFirst({
			where: eq(complianceMatrices.id, id),
		});

		if (!matrix) {
			return { matrix: null, entries: [], requirements: {} };
		}

		const entries = await db.query.complianceEntries.findMany({
			where: eq(complianceEntries.matrixId, id),
			orderBy: [asc(complianceEntries.sortOrder)],
		});

		// Fetch all related requirements
		const requirementIds = entries.map(e => e.requirementId);
		const reqs = requirementIds.length > 0
			? await db.query.rfpRequirements.findMany({
					where: inArray(rfpRequirements.id, requirementIds),
			  })
			: [];

		const requirements: Record<string, RfpRequirementRow> = {};
		for (const req of reqs) {
			requirements[req.id] = req;
		}

		return { matrix, entries, requirements };
	} catch (error) {
		logger.error("Error getting compliance matrix:", error);
		return { matrix: null, entries: [], requirements: {} };
	}
}

/**
 * List compliance matrices
 */
export async function listComplianceMatrices(filters?: ComplianceMatrixFilters & {
	limit?: number;
	offset?: number;
}): Promise<{ matrices: ComplianceMatrixRow[]; total: number }> {
	try {
		const { opportunityId, status, search, limit = 20, offset = 0 } = filters ?? {};

		const conditions = [];
		if (opportunityId) conditions.push(eq(complianceMatrices.opportunityId, opportunityId));
		if (status) conditions.push(eq(complianceMatrices.status, status));
		if (search) conditions.push(ilike(complianceMatrices.name, `%${search}%`));

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const [matrices, [{ count }]] = await Promise.all([
			db.query.complianceMatrices.findMany({
				where: whereClause,
				orderBy: [desc(complianceMatrices.createdAt)],
				limit,
				offset,
			}),
			db.select({ count: sql<number>`count(*)` }).from(complianceMatrices).where(whereClause),
		]);

		return { matrices, total: Number(count) };
	} catch (error) {
		logger.error("Error listing compliance matrices:", error);
		return { matrices: [], total: 0 };
	}
}

/**
 * Update a compliance entry
 */
export async function updateComplianceEntry(
	id: string,
	updates: UpdateComplianceEntryInput
): Promise<{ success: boolean; error?: string }> {
	try {
		const userId = await getCurrentUserId();
		if (!userId) {
			return { success: false, error: "Not authenticated" };
		}

		await db.update(complianceEntries)
			.set({
				...updates,
				dueDate: updates.dueDate ? new Date(updates.dueDate) : undefined,
				updatedAt: new Date(),
			})
			.where(eq(complianceEntries.id, id));

		// Update matrix statistics
		const entry = await db.query.complianceEntries.findFirst({
			where: eq(complianceEntries.id, id),
		});
		if (entry) {
			await recalculateMatrixStats(entry.matrixId);
		}

		revalidatePath("/compliance");
		return { success: true };
	} catch (error) {
		logger.error("Error updating compliance entry:", error);
		return { success: false, error: "Failed to update compliance entry" };
	}
}

/**
 * Update compliance matrix status
 */
export async function updateComplianceMatrixStatus(
	id: string,
	status: MatrixStatus
): Promise<{ success: boolean; error?: string }> {
	try {
		const userId = await getCurrentUserId();
		if (!userId) {
			return { success: false, error: "Not authenticated" };
		}

		const updates: Record<string, unknown> = { status, updatedAt: new Date() };
		if (status === "review") {
			updates.reviewedBy = userId;
			updates.reviewedAt = new Date();
		} else if (status === "final" || status === "submitted") {
			updates.approvedBy = userId;
			updates.approvedAt = new Date();
		}

		await db.update(complianceMatrices)
			.set(updates)
			.where(eq(complianceMatrices.id, id));

		revalidatePath("/compliance");
		return { success: true };
	} catch (error) {
		logger.error("Error updating matrix status:", error);
		return { success: false, error: "Failed to update matrix status" };
	}
}

/**
 * Recalculate matrix statistics based on entry statuses
 */
async function recalculateMatrixStats(matrixId: string): Promise<void> {
	const entries = await db.query.complianceEntries.findMany({
		where: eq(complianceEntries.matrixId, matrixId),
	});

	const requirements = await db.query.rfpRequirements.findMany({
		where: inArray(rfpRequirements.id, entries.map(e => e.requirementId)),
	});

	const mandatoryReqIds = new Set(
		requirements.filter(r => r.priority === "mandatory").map(r => r.id)
	);

	let compliantCount = 0;
	let partialCount = 0;
	let nonCompliantCount = 0;
	let notAddressedCount = 0;
	let mandatoryCompliant = 0;

	for (const entry of entries) {
		const isMandatory = mandatoryReqIds.has(entry.requirementId);

		switch (entry.complianceStatus) {
			case "full":
			case "compliant":
				compliantCount++;
				if (isMandatory) mandatoryCompliant++;
				break;
			case "partial":
				partialCount++;
				break;
			case "non_compliant":
				nonCompliantCount++;
				break;
			case "pending":
			case "not_addressed":
				notAddressedCount++;
				break;
		}
	}

	const total = entries.length;
	const mandatoryTotal = mandatoryReqIds.size;
	const complianceScore = total > 0 ? ((compliantCount + partialCount * 0.5) / total) * 100 : 0;
	const mandatoryComplianceScore = mandatoryTotal > 0 ? (mandatoryCompliant / mandatoryTotal) * 100 : 100;

	await db.update(complianceMatrices)
		.set({
			totalRequirements: total,
			mandatoryCount: mandatoryTotal,
			compliantCount,
			partialCount,
			nonCompliantCount,
			notAddressedCount,
			complianceScore,
			mandatoryComplianceScore,
			updatedAt: new Date(),
		})
		.where(eq(complianceMatrices.id, matrixId));
}

// ============================================================================
// Parsing Job Actions
// ============================================================================

/**
 * Get parsing job status
 */
export async function getParsingJobStatus(jobId: string): Promise<{
	status: string;
	progress: number;
	currentStep?: string;
	error?: string;
} | null> {
	try {
		const job = await db.query.rfpParsingJobs.findFirst({
			where: eq(rfpParsingJobs.id, jobId),
		});

		if (!job) return null;

		return {
			status: job.status,
			progress: job.progress,
			currentStep: job.currentStep ?? undefined,
			error: job.errorMessage ?? undefined,
		};
	} catch (error) {
		logger.error("Error getting parsing job status:", error);
		return null;
	}
}

/**
 * Cancel a parsing job
 */
export async function cancelParsingJob(jobId: string): Promise<{ success: boolean; error?: string }> {
	try {
		const userId = await getCurrentUserId();
		if (!userId) {
			return { success: false, error: "Not authenticated" };
		}

		await db.update(rfpParsingJobs)
			.set({
				status: "cancelled",
				completedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(rfpParsingJobs.id, jobId),
					eq(rfpParsingJobs.status, "processing")
				)
			);

		return { success: true };
	} catch (error) {
		logger.error("Error cancelling parsing job:", error);
		return { success: false, error: "Failed to cancel job" };
	}
}

// ============================================================================
// Statistics Actions
// ============================================================================

/**
 * Get RFP parsing statistics for dashboard
 */
export async function getRfpStats(opportunityId?: string): Promise<{
	totalDocuments: number;
	totalRequirements: number;
	byCategory: Record<string, number>;
	byPriority: Record<string, number>;
	byStatus: Record<string, number>;
}> {
	try {
		const docConditions = opportunityId
			? eq(rfpDocuments.opportunityId, opportunityId)
			: undefined;
		const reqConditions = opportunityId
			? eq(rfpRequirements.opportunityId, opportunityId)
			: undefined;

		const [docCount, requirements] = await Promise.all([
			db.select({ count: sql<number>`count(*)` })
				.from(rfpDocuments)
				.where(docConditions),
			db.query.rfpRequirements.findMany({
				where: reqConditions,
				columns: { category: true, priority: true, complianceStatus: true },
			}),
		]);

		const byCategory: Record<string, number> = {};
		const byPriority: Record<string, number> = {};
		const byStatus: Record<string, number> = {};

		for (const req of requirements) {
			byCategory[req.category] = (byCategory[req.category] || 0) + 1;
			byPriority[req.priority] = (byPriority[req.priority] || 0) + 1;
			byStatus[req.complianceStatus] = (byStatus[req.complianceStatus] || 0) + 1;
		}

		return {
			totalDocuments: Number(docCount[0]?.count ?? 0),
			totalRequirements: requirements.length,
			byCategory,
			byPriority,
			byStatus,
		};
	} catch (error) {
		logger.error("Error getting RFP stats:", error);
		return {
			totalDocuments: 0,
			totalRequirements: 0,
			byCategory: {},
			byPriority: {},
			byStatus: {},
		};
	}
}

/**
 * Export compliance matrix to JSON
 */
export async function exportComplianceMatrix(matrixId: string): Promise<{
	success: boolean;
	data?: unknown;
	error?: string;
}> {
	try {
		const { matrix, entries, requirements } = await getComplianceMatrix(matrixId);
		if (!matrix) {
			return { success: false, error: "Matrix not found" };
		}

		const exportData = {
			matrix: {
				name: matrix.name,
				description: matrix.description,
				status: matrix.status,
				complianceScore: matrix.complianceScore,
				mandatoryComplianceScore: matrix.mandatoryComplianceScore,
				statistics: {
					total: matrix.totalRequirements,
					mandatory: matrix.mandatoryCount,
					compliant: matrix.compliantCount,
					partial: matrix.partialCount,
					nonCompliant: matrix.nonCompliantCount,
					notAddressed: matrix.notAddressedCount,
				},
				createdAt: matrix.createdAt,
				updatedAt: matrix.updatedAt,
			},
			entries: entries.map(entry => ({
				requirementNumber: requirements[entry.requirementId]?.requirementNumber,
				title: requirements[entry.requirementId]?.title,
				category: requirements[entry.requirementId]?.category,
				priority: requirements[entry.requirementId]?.priority,
				requirementText: requirements[entry.requirementId]?.requirementText,
				complianceStatus: entry.complianceStatus,
				complianceJustification: entry.complianceJustification,
				responseReference: entry.responseReference,
				responseSummary: entry.responseSummary,
				strengthAssessment: entry.strengthAssessment,
				riskLevel: entry.riskLevel,
			})),
		};

		return { success: true, data: exportData };
	} catch (error) {
		logger.error("Error exporting compliance matrix:", error);
		return { success: false, error: "Failed to export matrix" };
	}
}

// ============================================================================
// Background Processing Functions
// ============================================================================

/**
 * Process an RFP parsing job asynchronously.
 * This function handles the actual parsing, extraction, and storage of requirements.
 */
async function processRfpParsingJob(jobId: string, rfpDocumentId: string): Promise<void> {
	logger.debug(`[RFP Parser] Starting job ${jobId} for document ${rfpDocumentId}`);

	try {
		// Update job status to processing
		await db.update(rfpParsingJobs).set({
			status: "processing",
			startedAt: new Date(),
			currentStep: "Initializing",
			progress: 5,
			updatedAt: new Date(),
		}).where(eq(rfpParsingJobs.id, jobId));

		// Update document status
		await db.update(rfpDocuments).set({
			parsingStatus: "processing",
			parsingProgress: 5,
			parsingStartedAt: new Date(),
			updatedAt: new Date(),
		}).where(eq(rfpDocuments.id, rfpDocumentId));

		// Fetch the document record
		const rfpDoc = await db.query.rfpDocuments.findFirst({
			where: eq(rfpDocuments.id, rfpDocumentId),
		});

		if (!rfpDoc) {
			throw new Error("RFP document not found");
		}

		// Step 1: Read and extract text from the document (10-30%)
		await updateJobProgress(jobId, rfpDocumentId, 10, "Extracting text from document");

		// For now, we'll simulate text extraction.
		// In production, you would read from storage and extract text based on file type
		let extractedText = rfpDoc.extractedText || "";

		if (!extractedText) {
			// Simulate text extraction - in production, use pdf-parse, mammoth, etc.
			// This would be replaced with actual file reading logic
			extractedText = await extractTextFromDocument(rfpDoc.storagePath, rfpDoc.fileType);
		}

		await updateJobProgress(jobId, rfpDocumentId, 30, "Parsing RFP structure");

		// Step 2: Parse RFP structure and metadata (30-50%)
		const parsedRFP = await parseRFPWithAI(extractedText);

		// Update document with parsed metadata
		await db.update(rfpDocuments).set({
			extractedText,
			extractedTitle: parsedRFP.sections[0]?.title,
			issuingOrganization: parsedRFP.issuingAgency,
			solicitationNumber: parsedRFP.solicitationNumber,
			responseDeadline: parsedRFP.responseDeadline ? new Date(parsedRFP.responseDeadline) : undefined,
			questionsDeadline: parsedRFP.questionDeadline ? new Date(parsedRFP.questionDeadline) : undefined,
			contractType: parsedRFP.contractType,
			naicsCodes: parsedRFP.naicsCode ? [parsedRFP.naicsCode] : [],
			setAsideType: parsedRFP.setAside,
			estimatedValue: parsedRFP.estimatedValue,
			detectedSections: parsedRFP.sections.map((s) => s.title),
			parsingConfidence: parsedRFP.confidence * 100,
			parsingProgress: 50,
			updatedAt: new Date(),
		}).where(eq(rfpDocuments.id, rfpDocumentId));

		await updateJobProgress(jobId, rfpDocumentId, 50, "Extracting requirements");

		// Step 3: Extract requirements (50-80%)
		// Format sections for batch extraction (with id and text properties)
		const sectionsForExtraction = parsedRFP.sections.map((s) => ({
			id: s.sectionId,
			text: s.content,
			pageNumber: s.pageStart,
		}));
		const extractedRequirementsMap = await batchExtractRequirements(sectionsForExtraction);

		// Flatten the Map into an array of requirements
		const allExtractedRequirements: ExtractedRequirement[] = [];
		for (const [_sectionId, requirements] of extractedRequirementsMap) {
			allExtractedRequirements.push(...requirements);
		}

		await updateJobProgress(jobId, rfpDocumentId, 70, "Classifying and storing requirements");

		// Step 4: Store extracted requirements (70-90%)
		if (allExtractedRequirements.length > 0) {
			const requirementsToInsert = allExtractedRequirements.map((req, index) => ({
				rfpDocumentId,
				opportunityId: rfpDoc.opportunityId,
				requirementNumber: req.requirementNumber || `REQ-${String(index + 1).padStart(3, "0")}`,
				sectionReference: req.sectionReference || undefined,
				title: req.title || req.fullText.slice(0, 100),
				requirementText: req.fullText,
				summary: req.summary || undefined,
				category: req.category,
				subcategory: req.subcategory || undefined,
				requirementType: req.requirementType,
				priority: req.priority,
				evaluationWeight: req.evaluationWeight || undefined,
				scoringMethod: req.scoringMethod || undefined,
				confidenceScore: req.confidenceScore,
				relatedRequirements: req.relatedRequirements || [],
				pageNumber: req.pageNumber || undefined,
				complianceStatus: "pending" as const,
				riskLevel: "medium" as const,
			}));

			await db.insert(rfpRequirements).values(requirementsToInsert);
		}

		await updateJobProgress(jobId, rfpDocumentId, 90, "Finalizing");

		// Step 5: Complete the job (90-100%)
		const now = new Date();

		await db.update(rfpParsingJobs).set({
			status: "completed",
			progress: 100,
			currentStep: "Completed",
			completedAt: now,
			requirementsExtracted: allExtractedRequirements.length,
			updatedAt: now,
		}).where(eq(rfpParsingJobs.id, jobId));

		await db.update(rfpDocuments).set({
			parsingStatus: "completed",
			parsingProgress: 100,
			parsingCompletedAt: now,
			updatedAt: now,
		}).where(eq(rfpDocuments.id, rfpDocumentId));

		logger.debug(`[RFP Parser] Job ${jobId} completed successfully. Extracted ${allExtractedRequirements.length} requirements.`);

	} catch (error) {
		logger.error(`[RFP Parser] Job ${jobId} failed:`, error);

		const errorMessage = error instanceof Error ? error.message : "Unknown error";

		// Update job and document with error status
		await db.update(rfpParsingJobs).set({
			status: "failed",
			errorMessage,
			completedAt: new Date(),
			updatedAt: new Date(),
		}).where(eq(rfpParsingJobs.id, jobId));

		await db.update(rfpDocuments).set({
			parsingStatus: "failed",
			parsingError: errorMessage,
			updatedAt: new Date(),
		}).where(eq(rfpDocuments.id, rfpDocumentId));
	}
}

/**
 * Helper to update job and document progress
 */
async function updateJobProgress(
	jobId: string,
	rfpDocumentId: string,
	progress: number,
	step: string
): Promise<void> {
	await Promise.all([
		db.update(rfpParsingJobs).set({
			progress,
			currentStep: step,
			updatedAt: new Date(),
		}).where(eq(rfpParsingJobs.id, jobId)),
		db.update(rfpDocuments).set({
			parsingProgress: progress,
			updatedAt: new Date(),
		}).where(eq(rfpDocuments.id, rfpDocumentId)),
	]);
}

/**
 * Extract text from a document based on file type.
 * Supports PDF, DOCX, and HTML file types with appropriate parsing.
 */
async function extractTextFromDocument(
	storagePath: string,
	fileType: string
): Promise<string> {
	try {
		const fs = await import("fs/promises");
		const path = await import("path");

		// Determine the actual file path (local or remote)
		let fileBuffer: Buffer;

		if (storagePath.startsWith("/") || storagePath.startsWith("./")) {
			// Local file system
			fileBuffer = await fs.readFile(storagePath);
		} else if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
			// Remote URL - fetch the file
			const response = await fetch(storagePath);
			if (!response.ok) {
				throw new Error(`Failed to fetch document: ${response.status} ${response.statusText}`);
			}
			const arrayBuffer = await response.arrayBuffer();
			fileBuffer = Buffer.from(arrayBuffer);
		} else {
			// Assume it's a storage key - construct URL based on storage configuration
			const storageBaseUrl = process.env.STORAGE_BASE_URL || "";
			if (storageBaseUrl) {
				const fullUrl = `${storageBaseUrl}/${storagePath}`;
				const response = await fetch(fullUrl);
				if (!response.ok) {
					throw new Error(`Failed to fetch from storage: ${response.status}`);
				}
				const arrayBuffer = await response.arrayBuffer();
				fileBuffer = Buffer.from(arrayBuffer);
			} else {
				logger.warn(`[RFP Parser] No storage URL configured, cannot fetch: ${storagePath}`);
				return "";
			}
		}

		// Parse based on file type
		switch (fileType.toLowerCase()) {
			case "pdf": {
				// Use pdf-parse for PDF extraction
				try {
					// Dynamic import with type assertion for optional dependency
					// eslint-disable-next-line @typescript-eslint/no-require-imports
					const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
					const data = await pdfParse(fileBuffer);
					return data.text;
				} catch (pdfError) {
					logger.error("[RFP Parser] PDF parsing failed, trying fallback:", pdfError);
					// Fallback: return buffer as string (may contain some readable text)
					return fileBuffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
				}
			}

			case "docx": {
				// Use mammoth for DOCX extraction
				try {
					// Dynamic import with type assertion for optional dependency
					// eslint-disable-next-line @typescript-eslint/no-require-imports
					const mammoth = require("mammoth") as {
						extractRawText: (options: { buffer: Buffer }) => Promise<{ value: string }>;
					};
					const result = await mammoth.extractRawText({ buffer: fileBuffer });
					return result.value;
				} catch (docxError) {
					logger.error("[RFP Parser] DOCX parsing failed:", docxError);
					return "";
				}
			}

			case "html": {
				// Parse HTML and extract text content
				const htmlContent = fileBuffer.toString("utf-8");
				// Simple HTML text extraction (strips tags)
				return htmlContent
					.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Remove scripts
					.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // Remove styles
					.replace(/<[^>]+>/g, " ") // Remove HTML tags
					.replace(/&nbsp;/g, " ") // Replace &nbsp;
					.replace(/&amp;/g, "&") // Replace &amp;
					.replace(/&lt;/g, "<") // Replace &lt;
					.replace(/&gt;/g, ">") // Replace &gt;
					.replace(/&quot;/g, '"') // Replace &quot;
					.replace(/\s+/g, " ") // Normalize whitespace
					.trim();
			}

			case "txt":
			case "text":
				// Plain text - return as is
				return fileBuffer.toString("utf-8");

			default:
				// Unknown file type - attempt to read as UTF-8
				logger.warn(`[RFP Parser] Unknown file type: ${fileType}, attempting UTF-8 decode`);
				return fileBuffer.toString("utf-8");
		}
	} catch (error) {
		logger.error("[RFP Parser] Error extracting text:", error);
		return "";
	}
}
