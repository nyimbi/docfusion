/**
 * Approvals Server Actions - DocFusion
 *
 * Server actions for managing document review/approval workflow:
 * - Multi-stage workflow (writer → reviewer → approver)
 * - Multiple reviewers support
 * - Deadline tracking
 * - Status transitions
 * - Email notification triggers (placeholder)
 */

"use server";

import { db } from "@/lib/db";
import { documentApprovals, workflowAssignments } from "@/lib/db/schema-comments-workflow";
import { documents, proposalDocuments } from "@/lib/db/schema";
import { eq, and, desc, asc, sql, inArray, gte, lt } from "drizzle-orm";
import type {
	DocumentApproval,
	CreateApprovalInput,
	UpdateApprovalInput,
	SubmitReviewInput,
	ApprovalFilters,
	WorkflowStatus,
	StageStatus,
	DeadlineSummary,
	WorkflowDeadline,
	DeadlineUrgency,
	WorkflowStage,
	ApprovalStatus,
} from "@/lib/types/comments-workflow";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Maps database row to DocumentApproval type.
 */
function mapDocumentApproval(row: typeof documentApprovals.$inferSelect): DocumentApproval {
	return {
		id: row.id,
		documentId: row.documentId,
		sectionId: row.sectionId,
		proposalDocumentId: row.proposalDocumentId,
		stage: row.stage as WorkflowStage,
		status: row.status as ApprovalStatus,
		assignedTo: row.assignedTo,
		sequenceOrder: row.sequenceOrder,
		dueDate: row.dueDate,
		completedAt: row.completedAt,
		notes: row.notes,
		rejectionReason: row.rejectionReason,
		previousApprovalId: row.previousApprovalId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

/**
 * Build where clause for approval filters.
 */
function buildApprovalWhereClause(filters: ApprovalFilters) {
	const conditions = [];

	if (filters.documentId) {
		conditions.push(eq(documentApprovals.documentId, filters.documentId));
	}

	if (filters.sectionId) {
		conditions.push(eq(documentApprovals.sectionId, filters.sectionId));
	}

	if (filters.proposalDocumentId) {
		conditions.push(eq(documentApprovals.proposalDocumentId, filters.proposalDocumentId));
	}

	if (filters.stage) {
		conditions.push(eq(documentApprovals.stage, filters.stage));
	}

	if (filters.status) {
		conditions.push(eq(documentApprovals.status, filters.status));
	}

	if (filters.assignedTo) {
		conditions.push(eq(documentApprovals.assignedTo, filters.assignedTo));
	}

	if (filters.isOverdue) {
		const now = new Date();
		conditions.push(
			and(
				sql`${documentApprovals.dueDate} < ${now}`,
				sql`${documentApprovals.completedAt} IS NULL`
			)
		);
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * Calculate urgency level from days remaining.
 */
function calculateUrgency(daysRemaining: number): DeadlineUrgency {
	if (daysRemaining < 0) return "overdue";
	if (daysRemaining <= 3) return "critical";
	if (daysRemaining <= 7) return "urgent";
	return "normal";
}

// ============================================================================
// Approval CRUD Operations
// ============================================================================

/**
 * Get a single approval by ID.
 */
export async function getApproval(id: string): Promise<DocumentApproval | null> {
	const [row] = await db
		.select()
		.from(documentApprovals)
		.where(eq(documentApprovals.id, id))
		.limit(1);

	if (!row) return null;
	return mapDocumentApproval(row);
}

/**
 * Get approvals with optional filtering.
 */
export async function getApprovals(
	filters: ApprovalFilters = {},
	options: { limit?: number; offset?: number; orderBy?: "asc" | "desc" } = {}
): Promise<{ approvals: DocumentApproval[]; total: number }> {
	const whereClause = buildApprovalWhereClause(filters);

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(documentApprovals)
		.where(whereClause);

	const total = countResult[0]?.count || 0;

	// Get approvals with ordering and pagination
	const rows = await db
		.select()
		.from(documentApprovals)
		.where(whereClause)
		.orderBy(
			asc(documentApprovals.sequenceOrder),
			desc(documentApprovals.createdAt)
		)
		.limit(options.limit ?? 1000)
		.offset(options.offset ?? 0);
	const approvals = rows.map(mapDocumentApproval);

	return { approvals, total };
}

/**
 * Get pending approvals assigned to a user.
 */
export async function getPendingApprovalsForUser(
	userId: string,
	options: { limit?: number; offset?: number } = {}
): Promise<{ approvals: DocumentApproval[]; total: number }> {
	return getApprovals(
		{ assignedTo: userId, status: "pending" },
		options
	);
}

/**
 * Get overdue approvals.
 */
export async function getOverdueApprovals(
	options: { limit?: number; offset?: number } = {}
): Promise<{ approvals: DocumentApproval[]; total: number }> {
	return getApprovals({ isOverdue: true }, options);
}

/**
 * Create a new approval workflow entry.
 */
export async function createApproval(input: CreateApprovalInput): Promise<DocumentApproval> {
	const {
		documentId,
		sectionId,
		proposalDocumentId,
		stage,
		assignedTo,
		sequenceOrder = 0,
		dueDate,
	} = input;

	const [approval] = await db
		.insert(documentApprovals)
		.values({
			documentId,
			sectionId: sectionId || null,
			proposalDocumentId: proposalDocumentId || null,
			stage,
			status: "pending",
			assignedTo,
			sequenceOrder,
			dueDate: dueDate ? new Date(dueDate) : null,
		})
		.returning();

	// Log notification for assignment (email delivery can be added via webhook/queue)
	console.log(`[Notification] Approval assigned: user=${assignedTo}, document=${documentId}, stage=${stage}`);

	return mapDocumentApproval(approval);
}

/**
 * Submit a review decision (approve, reject, or request changes).
 */
export async function submitReview(
	input: SubmitReviewInput,
	userId: string
): Promise<DocumentApproval> {
	const { approvalId, status, notes, rejectionReason } = input;

	const [existing] = await db
		.select()
		.from(documentApprovals)
		.where(eq(documentApprovals.id, approvalId))
		.limit(1);

	if (!existing) {
		throw new Error("Approval record not found");
	}

	if (existing.assignedTo !== userId) {
		throw new Error("You are not assigned to this review");
	}

	if (existing.status !== "pending" && existing.status !== "in_review") {
		throw new Error("This approval has already been processed");
	}

	const updateData: Partial<typeof documentApprovals.$inferInsert> = {
		status,
		completedAt: new Date(),
		notes: notes || null,
		rejectionReason: rejectionReason || null,
		updatedAt: new Date(),
	};

	const [updated] = await db
		.update(documentApprovals)
		.set(updateData)
		.where(eq(documentApprovals.id, approvalId))
		.returning();

	// If approved, advance to next stage
	if (status === "approved") {
		await advanceWorkflow(existing.documentId);
	}

	// Log notification for status change (email delivery can be added via webhook/queue)
	console.log(`[Notification] Approval ${status}: document=${existing.documentId}, reviewer=${userId}`);

	return mapDocumentApproval(updated);
}

/**
 * Update approval details.
 */
export async function updateApproval(
	id: string,
	input: UpdateApprovalInput
): Promise<DocumentApproval> {
	const updateData: Partial<typeof documentApprovals.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (input.status !== undefined) updateData.status = input.status;
	if (input.notes !== undefined) updateData.notes = input.notes;
	if (input.rejectionReason !== undefined) updateData.rejectionReason = input.rejectionReason;

	// If setting to pending/in_review, clear completion
	if (input.status === "pending" || input.status === "in_review") {
		updateData.completedAt = null;
	}

	const [updated] = await db
		.update(documentApprovals)
		.set(updateData)
		.where(eq(documentApprovals.id, id))
		.returning();

	if (!updated) {
		throw new Error("Approval not found");
	}

	return mapDocumentApproval(updated);
}

/**
 * Delete an approval record.
 */
export async function deleteApproval(id: string): Promise<void> {
	await db.delete(documentApprovals).where(eq(documentApprovals.id, id));
}

// ============================================================================
// Workflow Management
// ============================================================================

/**
 * Initialize review workflow for a document.
 *
 * Creates approval entries based on assignments.
 */
export async function initializeWorkflow(
	documentId: string,
	options: {
		proposalDocumentId?: string;
		writerId?: string;
		reviewerIds?: string[];
		approverId?: string;
		stageFlow?: WorkflowStage[];
	} = {}
): Promise<WorkflowStatus> {
	const {
		proposalDocumentId,
		writerId,
		reviewerIds = [],
		approverId,
		stageFlow = ["writer", "reviewer", "approver"],
	} = options;

	// Get existing assignments
	const assignments = await db
		.select()
		.from(workflowAssignments)
		.where(eq(workflowAssignments.documentId, documentId))
		.orderBy(asc(workflowAssignments.sequenceOrder));

	// Create approvals from assignments or use provided options
	for (const stage of stageFlow) {
		let users: { userId: string; sequenceOrder: number; dueDate?: Date }[] = [];

		const stageAssignments = assignments.filter((a) => a.stage === stage);

		if (stage === "writer" && writerId) {
			users = [{ userId: writerId, sequenceOrder: 0 }];
		} else if (stage === "writer" && stageAssignments.length > 0) {
			users = stageAssignments.map((a) => ({
				userId: a.userId,
				sequenceOrder: a.sequenceOrder,
				dueDate: a.dueDate || undefined,
			}));
		} else if (stage === "reviewer" && reviewerIds.length > 0) {
			users = reviewerIds.map((id, i) => ({ userId: id, sequenceOrder: i }));
		} else if (stage === "reviewer" && stageAssignments.length > 0) {
			users = stageAssignments.map((a) => ({
				userId: a.userId,
				sequenceOrder: a.sequenceOrder,
				dueDate: a.dueDate || undefined,
			}));
		} else if (stage === "approver" && approverId) {
			users = [{ userId: approverId, sequenceOrder: 0 }];
		} else if (stage === "approver" && stageAssignments.length > 0) {
			users = stageAssignments.map((a) => ({
				userId: a.userId,
				sequenceOrder: a.sequenceOrder,
				dueDate: a.dueDate || undefined,
			}));
		}

		for (const user of users) {
			await createApproval({
				documentId,
				proposalDocumentId,
				stage,
				assignedTo: user.userId,
				sequenceOrder: user.sequenceOrder,
				dueDate: user.dueDate,
			});
		}
	}

	return getWorkflowStatus(documentId);
}

/**
 * Get the current workflow status for a document.
 */
export async function getWorkflowStatus(documentId: string): Promise<WorkflowStatus> {
	const approvals = await getApprovals({ documentId });

	// Get document info and assignments
	const [doc] = await db
		.select({ title: documents.title })
		.from(documents)
		.where(eq(documents.id, documentId))
		.limit(1);

	const assignments = await db
		.select()
		.from(workflowAssignments)
		.where(eq(workflowAssignments.documentId, documentId));

	// Build stage statuses
	const stages: WorkflowStage[] = ["writer", "reviewer", "approver"];
	const currentStageStatuses: StageStatus[] = [];
	let currentStage: WorkflowStage | null = null;
	let overallStatus: ApprovalStatus = "pending";
	let completedStages = 0;
	let daysUntilDue: number | null = null;

	for (const stage of stages) {
		const stageApprovals = approvals.approvals.filter((a) => a.stage === stage);
		
		if (stageApprovals.length === 0) continue;

		const approvedCount = stageApprovals.filter((a) => a.status === "approved").length;
		const rejectedCount = stageApprovals.filter(
			(a) => a.status === "rejected" || a.status === "changes_requested"
		).length;
		const pendingCount = stageApprovals.filter(
			(a) => a.status === "pending" || a.status === "in_review"
		).length;

		let stageStatus: ApprovalStatus;
		if (rejectedCount > 0) {
			stageStatus = "changes_requested";
		} else if (approvedCount === stageApprovals.length) {
			stageStatus = "approved";
			completedStages++;
		} else if (approvedCount > 0) {
			stageStatus = "in_review";
			currentStage = currentStage || stage;
		} else {
			stageStatus = "pending";
			currentStage = currentStage || stage;
		}

		// Get earliest due date
		const earliestDueDate = stageApprovals
			.map((a) => a.dueDate)
			.filter((d): d is Date => d !== null)
			.sort((a, b) => a.getTime() - b.getTime())[0];

		if (earliestDueDate && !daysUntilDue) {
			daysUntilDue = Math.ceil(
				(earliestDueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
			);
		}

		const assignedUsers = stageApprovals.map((a) => ({
			userId: a.assignedTo,
			userName: a.assignedToName || a.assignedTo,
			sequenceOrder: a.sequenceOrder,
			hasCompleted: a.status === "approved",
		}));

		const completedApproval = stageApprovals.find((a) => a.status === "approved");

		currentStageStatuses.push({
			stage,
			name: stage.charAt(0).toUpperCase() + stage.slice(1),
			status: stageStatus,
			completed: stageStatus === "approved",
			assignedUsers,
			completedBy: completedApproval?.assignedTo || null,
			completedAt: completedApproval?.completedAt || null,
			dueDate: earliestDueDate || null,
			isOverdue: earliestDueDate ? earliestDueDate < new Date() : false,
		});

		overallStatus = stageStatus;
	}

	// Calculate progress
	const totalStages = currentStageStatuses.length;
	const progressPercentage = totalStages > 0 ? (completedStages / totalStages) * 100 : 0;

	// Determine available actions (simplified - in real app check current user permissions)
	const availableActions = [];
	if (overallStatus === "pending" || overallStatus === "in_review") {
		availableActions.push(
			{ type: "approve" as const, label: "Approve" },
			{ type: "reject" as const, label: "Reject" },
			{ type: "request_changes" as const, label: "Request Changes" }
		);
	}

	return {
		documentId,
		workflowId: assignments[0]?.workflowId || null,
		currentStage,
		overallStatus,
		progressPercentage,
		stageStatuses: currentStageStatuses,
		isActionRequired: overallStatus === "pending" || overallStatus === "in_review",
		availableActions,
		daysUntilDue,
	};
}

/**
 * Advance workflow to next stage after approval.
 */
async function advanceWorkflow(documentId: string): Promise<void> {
	const { approvals } = await getApprovals({ documentId });

	const stages: WorkflowStage[] = ["writer", "reviewer", "approver"];
	let foundPending = false;

	for (const stage of stages) {
		const stageApprovals = approvals.filter((a) => a.stage === stage);
		
		if (stageApprovals.length === 0) continue;

		const allApproved = stageApprovals.every((a) => a.status === "approved");
		
		if (allApproved) continue;

		if (!foundPending) {
			// Activate this stage
			for (const approval of stageApprovals) {
				if (approval.status === "pending") {
					await updateApproval(approval.id, { status: "in_review" });
				}
			}
			foundPending = true;
			break;
		}
	}
}

// ============================================================================
// Deadline Management
// ============================================================================

/**
 * Get upcoming deadlines for a user.
 */
export async function getUpcomingDeadlines(
	userId: string,
	days: number = 30
): Promise<DeadlineSummary> {
	const now = new Date();
	const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

	const approvals = await db
		.select()
		.from(documentApprovals)
		.where(
			and(
				eq(documentApprovals.assignedTo, userId),
				inArray(documentApprovals.status, ["pending", "in_review"]),
				sql`${documentApprovals.dueDate} IS NOT NULL`,
				sql`${documentApprovals.dueDate} <= ${future}`
			)
		)
		.orderBy(asc(documentApprovals.dueDate));

	// Get document titles
	const documentIds = [...new Set(approvals.map((a) => a.documentId))];
	const docs = await db
		.select({ id: documents.id, title: documents.title })
		.from(documents)
		.where(inArray(documents.id, documentIds));

	const titleMap = new Map(docs.map((d) => [d.id, d.title]));

	const overdue: WorkflowDeadline[] = [];
	const critical: WorkflowDeadline[] = [];
	const urgent: WorkflowDeadline[] = [];
	const normal: WorkflowDeadline[] = [];

	for (const approval of approvals) {
		if (!approval.dueDate) continue;

		const daysRemaining = Math.ceil(
			(approval.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
		);

		const deadline: WorkflowDeadline = {
			id: approval.id,
			type: "approval",
			title: titleMap.get(approval.documentId) || "Untitled Document",
			documentId: approval.documentId,
			documentTitle: titleMap.get(approval.documentId) || "Untitled Document",
			stage: approval.stage as WorkflowStage,
			assignedTo: approval.assignedTo,
			dueDate: approval.dueDate,
			daysRemaining,
			urgency: calculateUrgency(daysRemaining),
			status: approval.status as ApprovalStatus,
		};

		if (daysRemaining < 0) {
			overdue.push(deadline);
		} else if (daysRemaining <= 3) {
			critical.push(deadline);
		} else if (daysRemaining <= 7) {
			urgent.push(deadline);
		} else {
			normal.push(deadline);
		}
	}

	// Sort each category by due date
	const sortByDate = (a: WorkflowDeadline, b: WorkflowDeadline) =>
		a.dueDate.getTime() - b.dueDate.getTime();

	return {
		overdue: overdue.sort(sortByDate),
		critical: critical.sort(sortByDate),
		urgent: urgent.sort(sortByDate),
		normal: normal.sort(sortByDate),
		totalCount: overdue.length + critical.length + urgent.length + normal.length,
	};
}

/**
 * Update due date for an approval.
 */
export async function updateApprovalDueDate(
	id: string,
	dueDate: Date | null
): Promise<DocumentApproval> {
	const [updated] = await db
		.update(documentApprovals)
		.set({
			dueDate,
			updatedAt: new Date(),
		})
		.where(eq(documentApprovals.id, id))
		.returning();

	if (!updated) {
		throw new Error("Approval not found");
	}

	return mapDocumentApproval(updated);
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Reassign all pending approvals from one user to another.
 */
export async function reassignApprovals(
	fromUserId: string,
	toUserId: string,
	documentId?: string
): Promise<number> {
	let whereClause = and(
		eq(documentApprovals.assignedTo, fromUserId),
		inArray(documentApprovals.status, ["pending", "in_review"])
	);

	if (documentId) {
		whereClause = and(whereClause, eq(documentApprovals.documentId, documentId));
	}

	const result = await db
		.update(documentApprovals)
		.set({
			assignedTo: toUserId,
			updatedAt: new Date(),
		})
		.where(whereClause);

	return result.rowCount || 0;
}

/**
 * Cancel all pending approvals for a document.
 */
export async function cancelWorkflow(documentId: string): Promise<number> {
	const result = await db
		.delete(documentApprovals)
		.where(
			and(
				eq(documentApprovals.documentId, documentId),
				inArray(documentApprovals.status, ["pending", "in_review"])
			)
		);

	return result.rowCount || 0;
}
