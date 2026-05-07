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
import {
	downloadFromLinodeE3,
	getLinodeE3ConfigFromEnv,
} from "@/lib/storage/linode-e3";
import { recordWorkflowRuntimeTransition, upsertWorkflowRuntimeTask } from "@/lib/actions/workflow-runtime";
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

type RfpParseWorkflowAction = "retry" | "reject" | "manual_extraction" | "cancel";
type RfpParseWorkflowState =
	| "queued"
	| "processing"
	| "completed"
	| "failed"
	| "cancelled"
	| "rejected"
	| "manual_extraction";

interface RfpParseWorkflowInput {
	rfpDocumentId: string;
	action: RfpParseWorkflowAction;
	reason: string;
	startProcessing?: boolean;
}

interface RfpParseWorkflowResult {
	rfpDocumentId: string;
	jobId?: string;
	state: RfpParseWorkflowState;
	progress: number;
	currentStep?: string;
	error?: string;
}

interface RfpParseWorkflowMetadata {
	state: RfpParseWorkflowState;
	reason?: string;
	at?: string;
	actorId?: string;
	activeJobId?: string;
	attempt: number;
	history: RfpParseWorkflowHistoryEntry[];
}

interface RfpParseWorkflowHistoryEntry {
	action: RfpParseWorkflowAction | "created" | "completed" | "failed";
	from: RfpParseWorkflowState;
	to: RfpParseWorkflowState;
	actorId: string;
	reason: string;
	at: string;
	jobId?: string;
	error?: string;
}

type RfpAmendmentImpactMode = "supersede" | "supplement" | "clarify";

interface ApplyRfpAmendmentInput {
	amendmentDocumentId: string;
	targetDocumentId: string;
	reason: string;
	impactMode?: RfpAmendmentImpactMode;
	impactedRequirementIds?: string[];
}

interface ApplyRfpAmendmentResult {
	success: boolean;
	amendmentDocumentId: string;
	targetDocumentId: string;
	impactMode: RfpAmendmentImpactMode;
	impactedRequirementIds: string[];
	workflowInstanceId?: string;
	error?: string;
}

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
	limit?: number | null;
	offset?: number;
}): Promise<{ documents: RfpDocumentRow[]; total: number }> {
	try {
		const { opportunityId, parsingStatus, offset = 0 } = params ?? {};
		const limit = params && "limit" in params ? params.limit : 20;

		const conditions = [];
		if (opportunityId) conditions.push(eq(rfpDocuments.opportunityId, opportunityId));
		if (parsingStatus) conditions.push(eq(rfpDocuments.parsingStatus, parsingStatus));

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
		const findManyOptions: Parameters<typeof db.query.rfpDocuments.findMany>[0] = {
			where: whereClause,
			orderBy: [desc(rfpDocuments.createdAt)],
			offset,
		};
		if (limit !== null) {
			findManyOptions.limit = limit;
		}

		const [documents, [{ count }]] = await Promise.all([
			db.query.rfpDocuments.findMany(findManyOptions),
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

/**
 * Get the latest parse lifecycle state for an RFP document.
 */
export async function getRfpParseLifecycle(
	rfpDocumentId: string
): Promise<RfpParseWorkflowResult | null> {
	try {
		const doc = await db.query.rfpDocuments.findFirst({
			where: eq(rfpDocuments.id, rfpDocumentId),
		});
		if (!doc) return null;

		const latestJob = await db.query.rfpParsingJobs.findFirst({
			where: eq(rfpParsingJobs.rfpDocumentId, rfpDocumentId),
			orderBy: desc(rfpParsingJobs.createdAt),
		});
		const workflow = normalizeRfpParseWorkflowMetadata(doc.metadata);
		const state = workflow.state ?? parseWorkflowStateFromStatus(
			latestJob?.status ?? doc.parsingStatus
		);

		return {
			rfpDocumentId,
			jobId: latestJob?.id,
			state,
			progress: latestJob?.progress ?? doc.parsingProgress ?? 0,
			currentStep: latestJob?.currentStep ?? undefined,
			error: latestJob?.errorMessage ?? doc.parsingError ?? undefined,
		};
	} catch (error) {
		logger.error("Error getting RFP parse lifecycle:", error);
		return null;
	}
}

export async function reviewRfpParseConfidence(input: {
	rfpDocumentId: string;
	action: "accept" | "request_correction";
	reason: string;
	corrections?: Record<string, unknown>;
}): Promise<{ success: boolean; state?: ParseConfidenceReviewMetadata["state"]; error?: string }> {
	const reason = input.reason.trim();
	if (!reason) {
		return { success: false, error: "Review reason is required" };
	}

	const userId = await getCurrentUserId();
	if (!userId) {
		return { success: false, error: "Not authenticated" };
	}

	try {
		const doc = await db.query.rfpDocuments.findFirst({
			where: eq(rfpDocuments.id, input.rfpDocumentId),
		});
		if (!doc) {
			return { success: false, error: "RFP document not found" };
		}
		if (doc.parsingStatus !== "completed") {
			return { success: false, error: "Parser output can only be reviewed after parsing completes" };
		}

		const metadata = mergeRecordMetadata(doc.metadata);
		const currentReview = normalizeParseConfidenceReviewMetadata(metadata.parseReview, doc.parsingConfidence);
		const nextState = input.action === "accept" ? "accepted" : "correction_requested";
		const nextReview: ParseConfidenceReviewMetadata = {
			...currentReview,
			state: nextState,
			reviewedAt: new Date().toISOString(),
			reviewedBy: userId,
			reason,
			corrections: input.corrections,
		};

		await db.update(rfpDocuments).set({
			metadata: {
				...metadata,
				parseReview: nextReview,
			},
			updatedAt: new Date(),
		}).where(eq(rfpDocuments.id, input.rfpDocumentId));

		try {
			const instance = await recordWorkflowRuntimeTransition({
				workflowKey: "rfp_parse_confidence_review",
				subjectType: "rfp_parse",
				subjectId: doc.id,
				opportunityId: doc.opportunityId,
				fromState: currentReview.state,
				toState: nextState,
				eventType: `rfp_parse_review_${input.action}`,
				actorId: userId,
				reason,
				priority: nextState === "correction_requested" ? "high" : "medium",
				assignedTo: nextState === "correction_requested" ? userId : null,
				assignedRole: "proposal_manager",
				assignedBy: userId,
				dueAt: nextState === "correction_requested" ? addHours(new Date(), 12) : null,
				visibility: "internal",
				authorityPolicy: {
					requiredRoles: ["proposal_manager", "capture_manager"],
					escalationRole: "operations",
				},
				metadata: {
					filename: doc.filename,
					confidence: currentReview.confidence,
					threshold: currentReview.threshold,
					corrections: input.corrections,
				},
				terminal: nextState === "accepted",
				actionUrl: doc.opportunityId ? `/opportunities/${doc.opportunityId}/requirements` : undefined,
			});

			if (nextState === "correction_requested") {
				await upsertWorkflowRuntimeTask({
					workflowInstanceId: instance.id,
					taskKey: `rfp-parse-confidence:${doc.id}`,
					title: `Review parser output for ${doc.filename}`,
					description: reason,
					state: "completed",
					priority: "medium",
					assignedTo: userId,
					assignedRole: "proposal_manager",
					metadata: {
						rfpDocumentId: doc.id,
						reviewState: nextState,
					},
				});
				await upsertWorkflowRuntimeTask({
					workflowInstanceId: instance.id,
					taskKey: `rfp-parse-correction:${doc.id}`,
					title: `Correct parser output for ${doc.filename}`,
					description: reason,
					state: "open",
					priority: "high",
					assignedTo: userId,
					assignedRole: "proposal_manager",
					dueAt: addHours(new Date(), 12),
					metadata: {
						rfpDocumentId: doc.id,
						corrections: input.corrections,
					},
				});
			} else {
				await upsertWorkflowRuntimeTask({
					workflowInstanceId: instance.id,
					taskKey: `rfp-parse-confidence:${doc.id}`,
					title: `Review parser output for ${doc.filename}`,
					description: reason,
					state: "completed",
					priority: "medium",
					assignedTo: userId,
					assignedRole: "proposal_manager",
					metadata: {
						rfpDocumentId: doc.id,
						reviewState: nextState,
					},
				});
			}
		} catch (error) {
			logger.warn("[RFP Parser] Parse confidence review workflow persistence failed:", error);
		}

		revalidatePath(doc.opportunityId ? `/opportunities/${doc.opportunityId}/requirements` : "/requirements");
		return { success: true, state: nextState };
	} catch (error) {
		logger.error("Error reviewing RFP parse confidence:", error);
		return { success: false, error: "Failed to review parser output" };
	}
}

/**
 * Apply an amendment against an existing RFP document and push affected
 * requirements back into impact review.
 */
export async function applyRfpAmendmentSupersession(
	input: ApplyRfpAmendmentInput
): Promise<ApplyRfpAmendmentResult> {
	const reason = input.reason.trim();
	const impactMode = input.impactMode ?? "supplement";
	if (!reason) {
		return {
			success: false,
			amendmentDocumentId: input.amendmentDocumentId,
			targetDocumentId: input.targetDocumentId,
			impactMode,
			impactedRequirementIds: [],
			error: "Amendment impact reason is required",
		};
	}

	const userId = await getCurrentUserId();
	if (!userId) {
		return {
			success: false,
			amendmentDocumentId: input.amendmentDocumentId,
			targetDocumentId: input.targetDocumentId,
			impactMode,
			impactedRequirementIds: [],
			error: "Not authenticated",
		};
	}

	try {
		return await db.transaction(async (tx) => {
			await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.amendmentDocumentId}))`);

			const amendment = await tx.query.rfpDocuments.findFirst({
				where: eq(rfpDocuments.id, input.amendmentDocumentId),
			});
			const target = await tx.query.rfpDocuments.findFirst({
				where: eq(rfpDocuments.id, input.targetDocumentId),
			});
			if (!amendment || !target) {
				return {
					success: false,
					amendmentDocumentId: input.amendmentDocumentId,
					targetDocumentId: input.targetDocumentId,
					impactMode,
					impactedRequirementIds: [],
					error: !amendment ? "Amendment document not found" : "Target RFP document not found",
				};
			}
			if (amendment.opportunityId && target.opportunityId && amendment.opportunityId !== target.opportunityId) {
				return {
					success: false,
					amendmentDocumentId: amendment.id,
					targetDocumentId: target.id,
					impactMode,
					impactedRequirementIds: [],
					error: "Amendment and target RFP belong to different opportunities",
				};
			}

			const impactedRows = await tx
				.select()
				.from(rfpRequirements)
				.where(input.impactedRequirementIds?.length
					? inArray(rfpRequirements.id, input.impactedRequirementIds)
					: eq(rfpRequirements.rfpDocumentId, target.id));

			const now = new Date();
			const impactedRequirementIds = impactedRows.map((row) => row.id);
			for (const row of impactedRows) {
				const metadata = mergeRecordMetadata(row.metadata);
				const workflow = metadata.workflow && typeof metadata.workflow === "object" && !Array.isArray(metadata.workflow)
					? metadata.workflow as Record<string, unknown>
					: {};
				const previousWorkflowState = typeof workflow.state === "string" ? workflow.state : "review";
				await tx.update(rfpRequirements).set({
					complianceStatus: row.complianceStatus === "compliant" ? "partial" : row.complianceStatus,
					metadata: {
						...metadata,
						workflow: {
							...workflow,
							state: "review",
							reason: `Amendment ${amendment.filename} requires impact review: ${reason}`,
							updatedAt: now.toISOString(),
						},
						amendmentImpact: {
							state: "impact_review",
							impactMode,
							amendmentDocumentId: amendment.id,
							targetDocumentId: target.id,
							previousWorkflowState,
							previousComplianceStatus: row.complianceStatus,
							reason,
							actorId: userId,
							at: now.toISOString(),
						},
					},
					updatedAt: now,
				}).where(eq(rfpRequirements.id, row.id));
			}

			const amendmentMetadata = mergeRecordMetadata(amendment.metadata);
			const targetMetadata = mergeRecordMetadata(target.metadata);
			await tx.update(rfpDocuments).set({
				metadata: {
					...amendmentMetadata,
					documentRole: "amendment",
					amendmentWorkflow: {
						state: "impact_review",
						impactMode,
						targetDocumentId: target.id,
						impactedRequirementIds,
						reason,
						actorId: userId,
						at: now.toISOString(),
					},
				},
				updatedAt: now,
			}).where(eq(rfpDocuments.id, amendment.id));

			await tx.update(rfpDocuments).set({
				metadata: {
					...targetMetadata,
					supersession: {
						state: impactMode === "supersede" ? "superseded_by_amendment" : "amended",
						amendmentDocumentId: amendment.id,
						impactMode,
						impactedRequirementCount: impactedRequirementIds.length,
						reason,
						actorId: userId,
						at: now.toISOString(),
					},
				},
				updatedAt: now,
			}).where(eq(rfpDocuments.id, target.id));

			const runtimeInstance = await recordWorkflowRuntimeTransition({
				workflowKey: "rfp_amendment_supersession",
				subjectType: "rfp_document",
				subjectId: amendment.id,
				opportunityId: amendment.opportunityId ?? target.opportunityId,
				fromState: "uploaded",
				toState: "impact_review",
				eventType: "rfp_amendment_applied",
				actorId: userId,
				reason,
				priority: impactMode === "supersede" ? "critical" : "high",
				assignedRole: "proposal_manager",
				dueAt: addHours(now, impactMode === "supersede" ? 4 : 12),
				visibility: "internal",
				authorityPolicy: {
					requiredRoles: ["proposal_manager", "capture_manager"],
					escalationRole: "operations",
				},
				metadata: {
					amendmentFilename: amendment.filename,
					targetDocumentId: target.id,
					targetFilename: target.filename,
					impactMode,
					impactedRequirementIds,
					impactedRequirementCount: impactedRequirementIds.length,
				},
				actionUrl: target.opportunityId
					? `/opportunities/${target.opportunityId}/requirements`
					: undefined,
			}, tx);

			await upsertWorkflowRuntimeTask({
				workflowInstanceId: runtimeInstance.id,
				taskKey: `rfp-amendment-impact:${amendment.id}`,
				title: `Review amendment impact for ${amendment.filename}`,
				description: `${impactedRequirementIds.length} requirement${impactedRequirementIds.length === 1 ? "" : "s"} need impact review: ${reason}`,
				state: "open",
				priority: impactMode === "supersede" ? "critical" : "high",
				assignedRole: "proposal_manager",
				dueAt: addHours(now, impactMode === "supersede" ? 4 : 12),
				metadata: {
					amendmentDocumentId: amendment.id,
					targetDocumentId: target.id,
					impactMode,
					impactedRequirementIds,
				},
			}, tx);

			revalidatePath(target.opportunityId ? `/opportunities/${target.opportunityId}/requirements` : "/requirements");
			return {
				success: true,
				amendmentDocumentId: amendment.id,
				targetDocumentId: target.id,
				impactMode,
				impactedRequirementIds,
				workflowInstanceId: runtimeInstance.id,
			};
		});
	} catch (error) {
		logger.error("Error applying RFP amendment supersession:", error);
		return {
			success: false,
			amendmentDocumentId: input.amendmentDocumentId,
			targetDocumentId: input.targetDocumentId,
			impactMode,
			impactedRequirementIds: [],
			error: error instanceof Error ? error.message : "Failed to apply amendment impact",
		};
	}
}

/**
 * Transition a parse lifecycle when automated parsing needs operator action.
 */
export async function transitionRfpParseWorkflow(
	input: RfpParseWorkflowInput
): Promise<RfpParseWorkflowResult | null> {
	const reason = input.reason.trim();
	if (!reason) {
		throw new Error("RFP parse workflow transition requires a reason.");
	}

	const userId = await getCurrentUserId();
	if (!userId) {
		throw new Error("Not authenticated");
	}

	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.rfpDocumentId}))`);

		const doc = await tx.query.rfpDocuments.findFirst({
			where: eq(rfpDocuments.id, input.rfpDocumentId),
		});
		if (!doc) return null;

		const latestJob = await tx.query.rfpParsingJobs.findFirst({
			where: eq(rfpParsingJobs.rfpDocumentId, input.rfpDocumentId),
			orderBy: desc(rfpParsingJobs.createdAt),
		});

		const currentState = parseWorkflowStateFromStatus(
			latestJob?.status ?? doc.parsingStatus,
			normalizeRfpParseWorkflowMetadata(doc.metadata).state
		);
		const now = new Date();
		const workflow = normalizeRfpParseWorkflowMetadata(doc.metadata);
		const nextState = getNextRfpParseWorkflowState(currentState, input.action);
		let activeJobId = latestJob?.id;
		let progress = latestJob?.progress ?? doc.parsingProgress ?? 0;
		let currentStep = latestJob?.currentStep ?? undefined;
		let error: string | undefined;

		if (input.action === "retry") {
			const [newJob] = await tx.insert(rfpParsingJobs).values({
				rfpDocumentId: input.rfpDocumentId,
				status: "queued",
				currentStep: "Queued for retry",
				progress: 0,
				initiatedBy: userId,
				parsingOptions: latestJob?.parsingOptions ?? {
					extractRequirements: true,
					generateEmbeddings: true,
					detectSections: true,
					classifyRequirements: true,
				},
				metadata: {
					retryOfJobId: latestJob?.id,
					retryReason: reason,
				},
			}).returning();

			activeJobId = newJob?.id;
			progress = 0;
			currentStep = "Queued for retry";
		}

		if (input.action === "cancel" && latestJob) {
			await tx.update(rfpParsingJobs).set({
				status: "cancelled",
				completedAt: now,
				updatedAt: now,
				metadata: mergeRecordMetadata(latestJob.metadata, {
					cancelReason: reason,
					cancelledBy: userId,
				}),
			}).where(eq(rfpParsingJobs.id, latestJob.id));
			progress = latestJob.progress ?? doc.parsingProgress ?? 0;
			currentStep = "Cancelled";
		}

		if (input.action === "reject" && latestJob) {
			await tx.update(rfpParsingJobs).set({
				status: "failed",
				errorMessage: reason,
				completedAt: now,
				updatedAt: now,
				metadata: mergeRecordMetadata(latestJob.metadata, {
					rejectedBy: userId,
					rejectReason: reason,
				}),
			}).where(eq(rfpParsingJobs.id, latestJob.id));
			error = reason;
			currentStep = "Rejected";
		}

		if (input.action === "manual_extraction") {
			error = reason;
			currentStep = "Manual extraction required";
		}

		const nextWorkflow = appendRfpParseWorkflowHistory(workflow, {
			action: input.action,
			from: currentState,
			to: nextState,
			actorId: userId,
			reason,
			at: now.toISOString(),
			jobId: activeJobId,
			error,
		});

		await tx.update(rfpDocuments).set({
			parsingStatus: mapWorkflowStateToDocumentStatus(nextState),
			parsingProgress: progress,
			parsingError: error ?? (nextState === "queued" ? null : doc.parsingError),
			parsingStartedAt: nextState === "queued" ? null : doc.parsingStartedAt,
			parsingCompletedAt: ["failed", "cancelled", "rejected", "manual_extraction"].includes(nextState)
				? now
				: null,
			metadata: {
				...mergeRecordMetadata(doc.metadata),
				parseWorkflow: nextWorkflow,
			},
			updatedAt: now,
		}).where(eq(rfpDocuments.id, input.rfpDocumentId));

		try {
			const runtimeInstance = await recordWorkflowRuntimeTransition({
				workflowKey: "rfp_intake_parse",
				subjectType: "rfp_parse",
				subjectId: input.rfpDocumentId,
				opportunityId: doc.opportunityId,
				fromState: currentState,
				toState: nextState,
				eventType: `rfp_parse_${input.action}`,
				actorId: userId,
				reason,
				priority: nextState === "manual_extraction" || nextState === "failed" ? "high" : "medium",
				assignedTo: nextState === "manual_extraction" || nextState === "rejected" ? userId : null,
				assignedRole: nextState === "manual_extraction" ? "proposal_manager" : null,
				assignedBy: userId,
				dueAt: nextState === "manual_extraction" ? addHours(now, 24) : null,
				visibility: "internal",
				authorityPolicy: {
					requiredRoles: input.action === "reject" ? ["proposal_manager", "operations"] : undefined,
					escalationRole: "operations",
				},
				metadata: {
					activeJobId,
					filename: doc.filename,
					error,
					attempt: nextWorkflow.attempt,
				},
				terminal: ["cancelled", "rejected"].includes(nextState),
				notificationRecipients: nextState === "manual_extraction" ? [userId] : [],
			}, tx);

			if (nextState === "manual_extraction") {
				await upsertWorkflowRuntimeTask({
					workflowInstanceId: runtimeInstance.id,
					taskKey: `manual-extraction:${input.rfpDocumentId}`,
					title: `Manually extract ${doc.filename}`,
					description: reason,
					state: "open",
					priority: "high",
					assignedTo: userId,
					assignedRole: "proposal_manager",
					dueAt: addHours(now, 24),
					metadata: { rfpDocumentId: input.rfpDocumentId, activeJobId },
				}, tx);
			}
		} catch (error) {
			logger.warn("[RFP Parser] Workflow runtime persistence failed:", error);
		}

		if (input.action === "retry" && activeJobId && input.startProcessing !== false) {
			processRfpParsingJob(activeJobId, input.rfpDocumentId).catch((error) => {
				logger.error("[RFP Parser] Retry background job failed:", error);
			});
		}

		return {
			rfpDocumentId: input.rfpDocumentId,
			jobId: activeJobId,
			state: nextState,
			progress,
			currentStep,
			error,
		};
	});
}

function addHours(date: Date, hours: number): Date {
	return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

interface ParseConfidenceReviewMetadata {
	state: "auto_accepted" | "needs_review" | "accepted" | "correction_requested";
	confidence: number;
	threshold: number;
	reviewedAt?: string;
	reviewedBy?: string;
	reason?: string;
	corrections?: Record<string, unknown>;
}

function buildParseConfidenceReviewMetadata(confidence: number): ParseConfidenceReviewMetadata {
	const threshold = getParseConfidenceGateThreshold();
	return {
		state: confidence >= threshold ? "auto_accepted" : "needs_review",
		confidence,
		threshold,
	};
}

function normalizeParseConfidenceReviewMetadata(
	value: unknown,
	fallbackConfidence: number | null | undefined
): ParseConfidenceReviewMetadata {
	const record = value && typeof value === "object" && !Array.isArray(value)
		? value as Partial<ParseConfidenceReviewMetadata>
		: {};
	const confidence = typeof record.confidence === "number"
		? record.confidence
		: fallbackConfidence ?? 0;
	const threshold = typeof record.threshold === "number"
		? record.threshold
		: getParseConfidenceGateThreshold();
	const state = record.state === "accepted" ||
		record.state === "correction_requested" ||
		record.state === "auto_accepted" ||
		record.state === "needs_review"
		? record.state
		: confidence >= threshold ? "auto_accepted" : "needs_review";

	return {
		state,
		confidence,
		threshold,
		reviewedAt: record.reviewedAt,
		reviewedBy: record.reviewedBy,
		reason: record.reason,
		corrections: record.corrections,
	};
}

async function recordParseConfidenceReviewWorkflow(params: {
	rfpDocument: RfpDocumentRow;
	jobId: string;
	confidence: number;
	parseReview: ParseConfidenceReviewMetadata;
}): Promise<void> {
	const needsReview = params.parseReview.state === "needs_review";
	const toState = needsReview ? "needs_confidence_review" : "confidence_auto_accepted";
	const dueAt = needsReview ? addHours(new Date(), 12) : null;

	try {
		const instance = await recordWorkflowRuntimeTransition({
			workflowKey: "rfp_parse_confidence_review",
			subjectType: "rfp_parse",
			subjectId: params.rfpDocument.id,
			opportunityId: params.rfpDocument.opportunityId,
			fromState: "completed",
			toState,
			eventType: `rfp_parse_${toState}`,
			actorId: "system",
			reason: needsReview
				? `Parser confidence ${Math.round(params.confidence)}% is below the ${params.parseReview.threshold}% review gate.`
				: `Parser confidence ${Math.round(params.confidence)}% met the ${params.parseReview.threshold}% review gate.`,
			priority: needsReview ? "high" : "low",
			assignedRole: needsReview ? "proposal_manager" : null,
			dueAt,
			visibility: "internal",
			authorityPolicy: {
				requiredRoles: needsReview ? ["proposal_manager", "capture_manager"] : undefined,
				escalationRole: "operations",
			},
			metadata: {
				filename: params.rfpDocument.filename,
				parseJobId: params.jobId,
				confidence: params.confidence,
				threshold: params.parseReview.threshold,
				reviewState: params.parseReview.state,
			},
			terminal: !needsReview,
			actionUrl: params.rfpDocument.opportunityId
				? `/opportunities/${params.rfpDocument.opportunityId}/requirements`
				: undefined,
		});

		if (needsReview) {
			await upsertWorkflowRuntimeTask({
				workflowInstanceId: instance.id,
				taskKey: `rfp-parse-confidence:${params.rfpDocument.id}`,
				title: `Review parser output for ${params.rfpDocument.filename}`,
				description: `Parser confidence is ${Math.round(params.confidence)}%, below the ${params.parseReview.threshold}% gate. Review extracted metadata and requirements before acceptance.`,
				state: "open",
				priority: "high",
				assignedRole: "proposal_manager",
				dueAt,
				metadata: {
					rfpDocumentId: params.rfpDocument.id,
					parseJobId: params.jobId,
					confidence: params.confidence,
					threshold: params.parseReview.threshold,
				},
			});
		}
	} catch (error) {
		logger.warn("[RFP Parser] Parse confidence workflow persistence failed:", error);
	}
}

function getParseConfidenceGateThreshold(): number {
	const raw = process.env.RFP_PARSE_CONFIDENCE_GATE;
	if (!raw) return 80;
	const parsed = Number(raw);
	return Number.isFinite(parsed) && parsed > 0 && parsed <= 100 ? parsed : 80;
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
			const category = req.category ?? "other";
			const priority = req.priority ?? "medium";
			const status = req.complianceStatus ?? "not_assessed";
			byCategory[category] = (byCategory[category] || 0) + 1;
			byPriority[priority] = (byPriority[priority] || 0) + 1;
			byStatus[status] = (byStatus[status] || 0) + 1;
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

function normalizeRfpParseWorkflowMetadata(metadata: unknown): RfpParseWorkflowMetadata {
	const record = mergeRecordMetadata(metadata);
	const workflow = record.parseWorkflow;
	if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
		return {
			state: "queued",
			attempt: 0,
			history: [],
		};
	}

	const candidate = workflow as Partial<RfpParseWorkflowMetadata>;
	return {
		state: isRfpParseWorkflowState(candidate.state) ? candidate.state : "queued",
		reason: candidate.reason,
		at: candidate.at,
		actorId: candidate.actorId,
		activeJobId: candidate.activeJobId,
		attempt: typeof candidate.attempt === "number" ? candidate.attempt : 0,
		history: Array.isArray(candidate.history) ? candidate.history : [],
	};
}

function mergeRecordMetadata(
	metadata: unknown,
	patch: Record<string, unknown> = {}
): Record<string, unknown> {
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
		return { ...patch };
	}
	return {
		...(metadata as Record<string, unknown>),
		...patch,
	};
}

function isRfpParseWorkflowState(value: unknown): value is RfpParseWorkflowState {
	return (
		value === "queued" ||
		value === "processing" ||
		value === "completed" ||
		value === "failed" ||
		value === "cancelled" ||
		value === "rejected" ||
		value === "manual_extraction"
	);
}

function parseWorkflowStateFromStatus(
	status: string | null | undefined,
	metadataState?: RfpParseWorkflowState
): RfpParseWorkflowState {
	if (metadataState === "rejected" || metadataState === "manual_extraction") {
		return metadataState;
	}
	if (isRfpParseWorkflowState(status)) {
		return status;
	}
	if (status === "pending") {
		return "queued";
	}
	return "queued";
}

function getNextRfpParseWorkflowState(
	currentState: RfpParseWorkflowState,
	action: RfpParseWorkflowAction
): RfpParseWorkflowState {
	const legalTransitions: Record<
		RfpParseWorkflowState,
		Partial<Record<RfpParseWorkflowAction, RfpParseWorkflowState>>
	> = {
		queued: {
			cancel: "cancelled",
		},
		processing: {
			cancel: "cancelled",
		},
		completed: {},
		failed: {
			retry: "queued",
			reject: "rejected",
			manual_extraction: "manual_extraction",
		},
		cancelled: {
			retry: "queued",
			reject: "rejected",
		},
		rejected: {
			retry: "queued",
			manual_extraction: "manual_extraction",
		},
		manual_extraction: {
			retry: "queued",
			reject: "rejected",
		},
	};

	const nextState = legalTransitions[currentState][action];
	if (!nextState) {
		throw new Error(`Cannot ${action} RFP parse from ${currentState} state.`);
	}

	return nextState;
}

function mapWorkflowStateToDocumentStatus(
	state: RfpParseWorkflowState
): "pending" | "processing" | "completed" | "failed" {
	switch (state) {
		case "queued":
			return "pending";
		case "processing":
			return "processing";
		case "completed":
			return "completed";
		case "failed":
		case "cancelled":
		case "rejected":
		case "manual_extraction":
			return "failed";
	}
}

function appendRfpParseWorkflowHistory(
	workflow: RfpParseWorkflowMetadata,
	entry: RfpParseWorkflowHistoryEntry
): RfpParseWorkflowMetadata {
	return {
		...workflow,
		state: entry.to,
		reason: entry.reason,
		at: entry.at,
		actorId: entry.actorId,
		activeJobId: entry.jobId,
		attempt: entry.action === "retry" ? workflow.attempt + 1 : workflow.attempt,
		history: [...workflow.history, entry],
	};
}

/**
 * Process an RFP parsing job asynchronously.
 * This function handles the actual parsing, extraction, and storage of requirements.
 */
export async function processRfpParsingJob(jobId: string, rfpDocumentId: string): Promise<void> {
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
		const parsingConfidence = parsedRFP.confidence * 100;
		const parseReview = buildParseConfidenceReviewMetadata(parsingConfidence);
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
			parsingConfidence,
			parsingProgress: 50,
			metadata: {
				...mergeRecordMetadata(rfpDoc.metadata),
				parseReview,
			},
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
				sourceSection: req.sectionReference || null,
				title: req.title || req.fullText.slice(0, 100),
				requirementText: req.fullText,
				category: req.category,
				subcategory: req.subcategory || null,
				requirementType: req.requirementType,
				priority: req.priority,
				evaluationWeight: req.evaluationWeight || null,
				extractionConfidence: req.confidenceScore * 100,
				relatedRequirements: req.relatedRequirements || [],
				sourcePage: req.pageNumber || null,
				aiAnalysis: {
					summary: req.summary,
					scoringMethod: req.scoringMethod,
					source: "rfp_parser",
				},
				complianceStatus: "pending" as const,
				riskLevel: "medium" as const,
				metadata: {
					workflow: {
						state: "review",
						sourceTrace: {
							rfpDocumentId,
							parseJobId: jobId,
							sectionReference: req.sectionReference,
							pageNumber: req.pageNumber,
						},
					},
				},
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
			parsingError: null,
			metadata: {
				...mergeRecordMetadata(rfpDoc.metadata),
				parseReview,
				parseWorkflow: appendRfpParseWorkflowHistory(
					normalizeRfpParseWorkflowMetadata(rfpDoc.metadata),
					{
						action: "completed",
						from: parseWorkflowStateFromStatus(rfpDoc.parsingStatus),
						to: "completed",
						actorId: "system",
						reason: "Parsing completed successfully.",
						at: now.toISOString(),
						jobId,
					}
				),
			},
			updatedAt: now,
		}).where(eq(rfpDocuments.id, rfpDocumentId));

		await recordParseConfidenceReviewWorkflow({
			rfpDocument: {
				...rfpDoc,
				parsingStatus: "completed",
				parsingConfidence,
			},
			jobId,
			confidence: parsingConfidence,
			parseReview,
		});

		logger.debug(`[RFP Parser] Job ${jobId} completed successfully. Extracted ${allExtractedRequirements.length} requirements.`);

	} catch (error) {
		logger.error(`[RFP Parser] Job ${jobId} failed:`, error);

		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		const failedDoc = await db.query.rfpDocuments.findFirst({
			where: eq(rfpDocuments.id, rfpDocumentId),
		});
		const failedAt = new Date();

		// Update job and document with error status
		await db.update(rfpParsingJobs).set({
			status: "failed",
			errorMessage,
			completedAt: failedAt,
			updatedAt: failedAt,
		}).where(eq(rfpParsingJobs.id, jobId));

		await db.update(rfpDocuments).set({
			parsingStatus: "failed",
			parsingError: errorMessage,
			parsingCompletedAt: failedAt,
			metadata: {
				...mergeRecordMetadata(failedDoc?.metadata),
				parseWorkflow: appendRfpParseWorkflowHistory(
					normalizeRfpParseWorkflowMetadata(failedDoc?.metadata),
					{
						action: "failed",
						from: parseWorkflowStateFromStatus(failedDoc?.parsingStatus),
						to: "failed",
						actorId: "system",
						reason: errorMessage,
						at: failedAt.toISOString(),
						jobId,
						error: errorMessage,
					}
				),
			},
			updatedAt: failedAt,
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

		if (storagePath.startsWith("s3://")) {
			const objectStoreConfig = getLinodeE3ConfigFromEnv();
			if (!objectStoreConfig) {
				throw new Error("Linode E3 storage is not configured");
			}
			const object = await downloadFromLinodeE3(objectStoreConfig, storagePath);
			fileBuffer = object.body;
		} else if (storagePath.startsWith("/") || storagePath.startsWith("./")) {
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
