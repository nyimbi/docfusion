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

		// TODO: Queue the actual parsing job (e.g., via background job system)
		// await queueParsingJob(job.id);

		revalidatePath("/documents");
		return { success: true, rfpDocumentId: rfpDoc.id, jobId: job.id };
	} catch (error) {
		console.error("Error uploading RFP document:", error);
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
		console.error("Error getting RFP document:", error);
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
		console.error("Error listing RFP documents:", error);
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
		console.error("Error deleting RFP document:", error);
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
				orderBy: [orderFn(orderColumn as any)],
				limit,
				offset,
			}),
			db.select({ count: sql<number>`count(*)` }).from(rfpRequirements).where(whereClause),
		]);

		return { requirements, total: Number(count) };
	} catch (error) {
		console.error("Error getting requirements:", error);
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
		console.error("Error getting requirement:", error);
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
		console.error("Error updating requirement:", error);
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
		console.error("Error bulk updating requirements:", error);
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
		console.error("Error creating compliance matrix:", error);
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
		console.error("Error getting compliance matrix:", error);
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
		console.error("Error listing compliance matrices:", error);
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
		console.error("Error updating compliance entry:", error);
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
		console.error("Error updating matrix status:", error);
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
		console.error("Error getting parsing job status:", error);
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
		console.error("Error cancelling parsing job:", error);
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
		console.error("Error getting RFP stats:", error);
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
		console.error("Error exporting compliance matrix:", error);
		return { success: false, error: "Failed to export matrix" };
	}
}
