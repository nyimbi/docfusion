/**
 * Workflows Server Actions - DocFusion
 *
 * Server actions for managing workflow configuration and assignments:
 * - Workflow template CRUD
 * - Workflow assignments (who reviews/approves what)
 * - Default workflow management
 */

"use server";

import { db } from "@/lib/db";
import { documentWorkflows, workflowAssignments } from "@/lib/db/schema-comments-workflow";
import { documents } from "@/lib/db/schema";
import { eq, and, desc, asc, sql, or, isNull } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm/column";
import type {
	DocumentWorkflow,
	WorkflowAssignment,
	CreateWorkflowInput,
	UpdateWorkflowInput,
	CreateAssignmentInput,
	BulkAssignmentInput,
	WorkflowStageConfig,
	WorkflowStage,
} from "@/lib/types/comments-workflow";
import { logger } from "@/lib/utils/logger";
import { requireUserContext, type UserContext } from "@/lib/auth-utils";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Maps database row to DocumentWorkflow type.
 */
function mapDocumentWorkflow(row: typeof documentWorkflows.$inferSelect): DocumentWorkflow {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		stages: (row.stages as WorkflowStageConfig[]) || [],
		isDefault: row.isDefault === "true",
		organizationId: row.organizationId,
		documentType: row.documentType,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

/**
 * Maps database row to WorkflowAssignment type.
 */
function mapWorkflowAssignment(row: typeof workflowAssignments.$inferSelect): WorkflowAssignment {
	return {
		id: row.id,
		documentId: row.documentId,
		workflowId: row.workflowId,
		stage: row.stage as WorkflowStage,
		userId: row.userId,
		sequenceOrder: row.sequenceOrder,
		dueDate: row.dueDate,
		isActive: row.isActive === "true",
		assignedBy: row.assignedBy,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

type OrganizationColumn = AnyColumn<{ data: string; notNull: false }>;

async function requireWorkflowContext(organizationId?: string | null): Promise<UserContext> {
	const userContext = await requireUserContext();
	if (organizationId && organizationId !== userContext.organizationId) {
		throw new Error("Unauthorized");
	}
	return userContext;
}

async function requireWorkflowActor(): Promise<string> {
	return (await requireWorkflowContext()).userId;
}

function visibleOrganizationCondition(column: OrganizationColumn, userContext: UserContext) {
	return userContext.organizationId
		? (or(isNull(column), eq(column, userContext.organizationId)) ?? isNull(column))
		: isNull(column);
}

function mutableOrganizationCondition(column: OrganizationColumn, userContext: UserContext) {
	return userContext.organizationId
		? eq(column, userContext.organizationId)
		: isNull(column);
}

function organizationForInsert(inputOrganizationId: string | undefined, userContext: UserContext): string | undefined {
	return inputOrganizationId ?? userContext.organizationId;
}

// ============================================================================
// Workflow Template CRUD
// ============================================================================

/**
 * Get a single workflow by ID.
 */
export async function getWorkflow(id: string): Promise<DocumentWorkflow | null> {
	const userContext = await requireWorkflowContext();
	const [row] = await db
		.select()
		.from(documentWorkflows)
		.where(and(
			eq(documentWorkflows.id, id),
			visibleOrganizationCondition(documentWorkflows.organizationId, userContext)
		))
		.limit(1);

	if (!row) return null;
	return mapDocumentWorkflow(row);
}

/**
 * Get workflows with optional filtering.
 */
export async function getWorkflows(options: {
	organizationId?: string;
	isDefault?: boolean;
	documentType?: string;
	limit?: number;
	offset?: number;
} = {}): Promise<{ workflows: DocumentWorkflow[]; total: number }> {
	const userContext = await requireWorkflowContext(options.organizationId);
	const conditions = [];
	conditions.push(visibleOrganizationCondition(documentWorkflows.organizationId, userContext));

	if (options.isDefault !== undefined) {
		conditions.push(
			eq(documentWorkflows.isDefault, options.isDefault.toString())
		);
	}

	if (options.documentType) {
		conditions.push(eq(documentWorkflows.documentType, options.documentType));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(documentWorkflows)
		.where(whereClause);

	const total = countResult[0]?.count || 0;

	// Get workflows with pagination
	const rows = await db
		.select()
		.from(documentWorkflows)
		.where(whereClause)
		.orderBy(desc(documentWorkflows.isDefault), asc(documentWorkflows.name))
		.limit(options.limit ?? 1000)
		.offset(options.offset ?? 0);
	const workflows = rows.map(mapDocumentWorkflow);

	return { workflows, total };
}

/**
 * Get the default workflow for an organization.
 */
export async function getDefaultWorkflow(
	organizationId?: string
): Promise<DocumentWorkflow | null> {
	const userContext = await requireWorkflowContext(organizationId);
	const conditions = [eq(documentWorkflows.isDefault, "true")];
	conditions.push(visibleOrganizationCondition(documentWorkflows.organizationId, userContext));

	const [row] = await db
		.select()
		.from(documentWorkflows)
		.where(and(...conditions))
		.limit(1);

	if (!row) return null;
	return mapDocumentWorkflow(row);
}

/**
 * Create a new workflow template.
 */
export async function createWorkflow(
	input: CreateWorkflowInput
): Promise<DocumentWorkflow> {
	const {
		name,
		description,
		stages,
		isDefault = false,
		organizationId,
		documentType,
	} = input;
	const userContext = await requireWorkflowContext(organizationId);
	const workflowOrganizationId = organizationForInsert(organizationId, userContext);

	// If setting as default, unset other defaults first
	if (isDefault && workflowOrganizationId) {
		await db
			.update(documentWorkflows)
			.set({ isDefault: "false" })
			.where(eq(documentWorkflows.organizationId, workflowOrganizationId));
	}

	const [workflow] = await db
		.insert(documentWorkflows)
		.values({
			name,
			description: description || null,
			stages: stages as unknown as typeof documentWorkflows.$inferInsert["stages"],
			isDefault: isDefault.toString(),
			organizationId: workflowOrganizationId || null,
			documentType: documentType || null,
		})
		.returning();

	return mapDocumentWorkflow(workflow);
}

/**
 * Update an existing workflow.
 */
export async function updateWorkflow(
	id: string,
	input: UpdateWorkflowInput
): Promise<DocumentWorkflow> {
	const userContext = await requireWorkflowContext();
	const [existingWorkflow] = await db
		.select({ organizationId: documentWorkflows.organizationId })
		.from(documentWorkflows)
		.where(and(
			eq(documentWorkflows.id, id),
			mutableOrganizationCondition(documentWorkflows.organizationId, userContext)
		))
		.limit(1);

	if (!existingWorkflow) {
		throw new Error("Workflow not found");
	}

	// If setting as default, handle the change
	if (input.isDefault !== undefined && input.isDefault) {
		if (existingWorkflow.organizationId) {
			await db
				.update(documentWorkflows)
				.set({ isDefault: "false" })
				.where(
					and(
						eq(documentWorkflows.organizationId, existingWorkflow.organizationId),
						sql`${documentWorkflows.id} != ${id}`
					)
				);
		}
	}

	const updateData: Partial<typeof documentWorkflows.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (input.name !== undefined) updateData.name = input.name;
	if (input.description !== undefined) updateData.description = input.description;
	if (input.stages !== undefined) {
		updateData.stages = input.stages as unknown as typeof documentWorkflows.$inferInsert["stages"];
	}
	if (input.isDefault !== undefined) {
		updateData.isDefault = input.isDefault.toString();
	}

	const [updated] = await db
		.update(documentWorkflows)
		.set(updateData)
		.where(and(
			eq(documentWorkflows.id, id),
			mutableOrganizationCondition(documentWorkflows.organizationId, userContext)
		))
		.returning();

	if (!updated) {
		throw new Error("Workflow not found");
	}

	return mapDocumentWorkflow(updated);
}

/**
 * Delete a workflow.
 */
export async function deleteWorkflow(id: string): Promise<void> {
	const userContext = await requireWorkflowContext();
	const [workflow] = await db
		.select({ id: documentWorkflows.id })
		.from(documentWorkflows)
		.where(and(
			eq(documentWorkflows.id, id),
			mutableOrganizationCondition(documentWorkflows.organizationId, userContext)
		))
		.limit(1);

	if (!workflow) {
		throw new Error("Workflow not found");
	}

	// Check if workflow is in use
	const existingAssignments = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(workflowAssignments)
		.where(eq(workflowAssignments.workflowId, id));

	if (existingAssignments[0]?.count > 0) {
		throw new Error("Cannot delete workflow with active assignments");
	}

	await db.delete(documentWorkflows).where(and(
		eq(documentWorkflows.id, id),
		mutableOrganizationCondition(documentWorkflows.organizationId, userContext)
	));
}

// ============================================================================
// Workflow Assignment CRUD
// ============================================================================

/**
 * Get workflow assignments for a document.
 */
export async function getWorkflowAssignments(
	documentId: string
): Promise<WorkflowAssignment[]> {
	const rows = await db
		.select()
		.from(workflowAssignments)
		.where(
			and(
				eq(workflowAssignments.documentId, documentId),
				eq(workflowAssignments.isActive, "true")
			)
		)
		.orderBy(asc(workflowAssignments.stage), asc(workflowAssignments.sequenceOrder));

	return rows.map(mapWorkflowAssignment);
}

/**
 * Get assignments for a specific stage on a document.
 */
export async function getStageAssignments(
	documentId: string,
	stage: WorkflowStage
): Promise<WorkflowAssignment[]> {
	const rows = await db
		.select()
		.from(workflowAssignments)
		.where(
			and(
				eq(workflowAssignments.documentId, documentId),
				eq(workflowAssignments.stage, stage),
				eq(workflowAssignments.isActive, "true")
			)
		)
		.orderBy(asc(workflowAssignments.sequenceOrder));

	return rows.map(mapWorkflowAssignment);
}

/**
 * Create a new workflow assignment.
 */
export async function createAssignment(
	input: CreateAssignmentInput,
	_assignedBy: string
): Promise<WorkflowAssignment> {
	const assignedBy = await requireWorkflowActor();
	const { documentId, workflowId, stage, userId, sequenceOrder = 0, dueDate } = input;

	// Validate document exists
	const [doc] = await db
		.select({ id: documents.id })
		.from(documents)
		.where(eq(documents.id, documentId))
		.limit(1);

	if (!doc) {
		throw new Error("Document not found");
	}

	// Check if assignment already exists
	const [existing] = await db
		.select({ id: workflowAssignments.id })
		.from(workflowAssignments)
		.where(
			and(
				eq(workflowAssignments.documentId, documentId),
				eq(workflowAssignments.stage, stage),
				eq(workflowAssignments.sequenceOrder, sequenceOrder)
			)
		)
		.limit(1);

	if (existing) {
		throw new Error("Assignment already exists for this stage and position");
	}

	const [assignment] = await db
		.insert(workflowAssignments)
		.values({
			documentId,
			workflowId: workflowId || null,
			stage,
			userId,
			sequenceOrder,
			dueDate: dueDate ? new Date(dueDate) : null,
			isActive: "true",
			assignedBy,
		})
		.returning();

	return mapWorkflowAssignment(assignment);
}

/**
 * Assign multiple users to workflow stages.
 */
export async function bulkCreateAssignments(
	input: BulkAssignmentInput,
	_assignedBy: string
): Promise<WorkflowAssignment[]> {
	const assignedBy = await requireWorkflowActor();
	const { documentId, assignments } = input;

	const created: WorkflowAssignment[] = [];

	for (const assignment of assignments) {
		try {
			const newAssignment = await createAssignment(
				{
					documentId,
					stage: assignment.stage,
					userId: assignment.userId,
					sequenceOrder: assignment.sequenceOrder,
					dueDate: assignment.dueDate,
				},
				assignedBy
			);
			created.push(newAssignment);
		} catch (error) {
			// Continue creating other assignments even if one fails
			logger.error(`Failed to create assignment:`, error);
		}
	}

	return created;
}

/**
 * Update an existing assignment.
 */
export async function updateAssignment(
	id: string,
	updates: {
		userId?: string;
		sequenceOrder?: number;
		dueDate?: Date | null;
		isActive?: boolean;
	}
): Promise<WorkflowAssignment> {
	await requireWorkflowActor();
	const updateData: Partial<typeof workflowAssignments.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (updates.userId !== undefined) updateData.userId = updates.userId;
	if (updates.sequenceOrder !== undefined) updateData.sequenceOrder = updates.sequenceOrder;
	if (updates.dueDate !== undefined) updateData.dueDate = updates.dueDate;
	if (updates.isActive !== undefined) updateData.isActive = updates.isActive.toString();

	const [updated] = await db
		.update(workflowAssignments)
		.set(updateData)
		.where(eq(workflowAssignments.id, id))
		.returning();

	if (!updated) {
		throw new Error("Assignment not found");
	}

	return mapWorkflowAssignment(updated);
}

/**
 * Delete (deactivate) an assignment.
 */
export async function deleteAssignment(id: string): Promise<void> {
	await requireWorkflowActor();
	await db
		.update(workflowAssignments)
		.set({
			isActive: "false",
			updatedAt: new Date(),
		})
		.where(eq(workflowAssignments.id, id));
}

/**
 * Remove all assignments for a document.
 */
export async function clearDocumentAssignments(documentId: string): Promise<number> {
	await requireWorkflowActor();
	const result = await db
		.update(workflowAssignments)
		.set({
			isActive: "false",
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(workflowAssignments.documentId, documentId),
				eq(workflowAssignments.isActive, "true")
			)
		);

	return result.rowCount || 0;
}

// ============================================================================
// Workflow Presets
// ============================================================================

/**
 * Create a default standard workflow.
 */
export async function createStandardWorkflow(
	organizationId?: string
): Promise<DocumentWorkflow> {
	const stages: WorkflowStageConfig[] = [
		{
			stage: "writer",
			name: "Write",
			description: "Draft and edit the document",
			requiredCount: 1,
			requireAll: false,
			dueDays: 7,
			isOptional: false,
			notifications: {
				onAssign: true,
				onDueSoon: true,
				reminderDays: [3, 1],
			},
		},
		{
			stage: "reviewer",
			name: "Review",
			description: "Technical and content review",
			requiredCount: 1,
			requireAll: false,
			dueDays: 3,
			isOptional: false,
			notifications: {
				onAssign: true,
				onDueSoon: true,
				reminderDays: [2, 1],
			},
		},
		{
			stage: "approver",
			name: "Approve",
			description: "Final approval and sign-off",
			requiredCount: 1,
			requireAll: false,
			dueDays: 2,
			isOptional: false,
			notifications: {
				onAssign: true,
				onDueSoon: true,
				reminderDays: [1],
			},
		},
	];

	return createWorkflow({
		name: "Standard Review Workflow",
		description: "Standard three-stage review: write → review → approve",
		stages,
		isDefault: true,
		organizationId,
	});
}

/**
 * Create a multi-reviewer workflow.
 */
export async function createMultiReviewerWorkflow(
	organizationId?: string,
	reviewerCount: number = 2
): Promise<DocumentWorkflow> {
	const stages: WorkflowStageConfig[] = [
		{
			stage: "writer",
			name: "Write",
			description: "Draft and edit the document",
			requiredCount: 1,
			requireAll: false,
			dueDays: 7,
			isOptional: false,
		},
		{
			stage: "reviewer",
			name: "Review",
			description: `Multiple reviewers (${reviewerCount}) must approve`,
			requiredCount: reviewerCount,
			requireAll: true,
			dueDays: 3,
			isOptional: false,
			notifications: {
				onAssign: true,
				onDueSoon: true,
				reminderDays: [2, 1],
			},
		},
		{
			stage: "approver",
			name: "Approve",
			description: "Final approval and sign-off",
			requiredCount: 1,
			requireAll: false,
			dueDays: 1,
			isOptional: false,
			notifications: {
				onAssign: true,
				onDueSoon: true,
				reminderDays: [1],
			},
		},
	];

	return createWorkflow({
		name: `Multi-Reviewer Workflow (${reviewerCount})`,
		description: `Document requires approval from ${reviewerCount} reviewers before final approval`,
		stages,
		isDefault: false,
		organizationId,
	});
}

/**
 * Create a solo workflow (single person does all stages).
 */
export async function createSoloWorkflow(organizationId?: string): Promise<DocumentWorkflow> {
	const stages: WorkflowStageConfig[] = [
		{
			stage: "writer",
			name: "Write",
			description: "Write and self-review",
			requiredCount: 1,
			requireAll: false,
			dueDays: 7,
			isOptional: false,
		},
		{
			stage: "approver",
			name: "Finalize",
			description: "Self-approve and finalize",
			requiredCount: 1,
			requireAll: false,
			dueDays: 1,
			isOptional: false,
		},
	];

	return createWorkflow({
		name: "Solo Workflow",
		description:
			"Single person creates and approves their own work (for draft documents)",
		stages,
		isDefault: false,
		organizationId,
	});
}

// ============================================================================
// Auto-assignment
// ============================================================================

/**
 * Initialize a document with default workflow assignments.
 */
export async function initializeDefaultWorkflow(
	documentId: string,
	_creatorId: string,
	documentType?: string
): Promise<{ workflow: DocumentWorkflow | null; assignments: WorkflowAssignment[] }> {
	const creatorId = await requireWorkflowActor();
	// Find appropriate workflow
	// 1. Try document-type specific
	// 2. Try organization's default
	// 3. Fall back to global default

	let workflow = documentType
		? (await getWorkflows({ documentType, isDefault: true })).workflows[0]
		: null;

	if (!workflow) {
		workflow = (await getDefaultWorkflow()) || null;
	}

	if (!workflow) {
		// Create standard workflow if none exists
		workflow = await createStandardWorkflow();
	}

	// Clear existing assignments
	await clearDocumentAssignments(documentId);

	// Create assignments based on workflow stages
	const assignments: WorkflowAssignment[] = [];

	for (const stageConfig of workflow.stages) {
		// For writer stage, assign to creator
		// For review/approve, leave unassigned (to be assigned later)
		if (stageConfig.stage === "writer") {
			const assignment = await createAssignment(
				{
					documentId,
					workflowId: workflow.id,
					stage: stageConfig.stage,
					userId: creatorId,
					sequenceOrder: 0,
				},
				creatorId
			);
			assignments.push(assignment);
		}
	}

	return { workflow, assignments };
}

/**
 * Apply a workflow template to a document.
 */
export async function applyWorkflowToDocument(
	documentId: string,
	workflowId: string,
	assignments: Record<WorkflowStage, string[]>
): Promise<WorkflowAssignment[]> {
	const actorId = await requireWorkflowActor();
	const workflow = await getWorkflow(workflowId);
	
	if (!workflow) {
		throw new Error("Workflow not found");
	}

	// Clear existing assignments
	await clearDocumentAssignments(documentId);

	const created: WorkflowAssignment[] = [];

	for (const stage of workflow.stages) {
		const userIds = assignments[stage.stage] || [];

		for (let i = 0; i < userIds.length; i++) {
			const assignment = await createAssignment(
				{
					documentId,
					workflowId,
					stage: stage.stage,
					userId: userIds[i],
					sequenceOrder: i,
				},
				actorId
			);
			created.push(assignment);
		}
	}

	return created;
}
