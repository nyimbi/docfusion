/**
 * Comments and Workflow Types - DocFusion
 *
 * Type definitions for document comments, review/approval workflow,
 * and workflow configuration.
 */

// ============================================================================
// Document Comment Types
// ============================================================================

/** Type of comment */
export type CommentType = "comment" | "suggestion" | "approval" | "rejection";

/** Position in document (for anchoring comments to text) */
export interface CommentPosition {
	/** Block/paragraph index */
	blockIndex?: number;
	/** Offset from start of block */
	startOffset?: number;
	/** End offset (for range selection) */
	endOffset?: number;
	/** Selected text snippet */
	snippet?: string;
	/** CSS selector-like path to node */
	path?: string;
}

/**
 * A comment on a document or section.
 */
export interface DocumentComment {
	id: string;
	documentId: string;
	sectionId: string | null;
	userId: string;
	/** Display info for the user */
	userName?: string;
	userAvatar?: string;
	content: string;
	type: CommentType;
	parentId: string | null;
	position: CommentPosition | null;
	resolvedAt: Date | null;
	resolvedBy: string | null;
	isEdited: boolean;
	createdAt: Date;
	updatedAt: Date;
	/** Nested replies */
	replies?: DocumentComment[];
	/** Reaction counts */
	reactions?: Record<string, number>;
}

/**
 * Input for creating a comment.
 */
export interface CreateCommentInput {
	documentId: string;
	sectionId?: string;
	content: string;
	type?: CommentType;
	parentId?: string;
	position?: CommentPosition;
}

/**
 * Input for updating a comment.
 */
export interface UpdateCommentInput {
	content?: string;
	type?: CommentType;
}

/**
 * Input for resolving a comment.
 */
export interface ResolveCommentInput {
	resolved: boolean;
}

/**
 * Filter criteria for comments.
 */
export interface CommentFilters {
	documentId?: string;
	sectionId?: string;
	userId?: string;
	type?: CommentType;
	resolved?: boolean;
	parentId?: string | null; // null for top-level only
	search?: string;
}

/**
 * Summary statistics for comments.
 */
export interface CommentStats {
	total: number;
	resolved: number;
	unresolved: number;
	byType: Record<CommentType, number>;
}

// ============================================================================
// Reaction Types
// ============================================================================

/**
 * A reaction to a comment.
 */
export interface CommentReaction {
	id: string;
	commentId: string;
	userId: string;
	reaction: string;
	createdAt: Date;
}

/**
 * Emoji reactions available.
 */
export type AvailableReaction = "👍" | "👎" | "❤️" | "🎉" | "🤔" | "✅" | "❓";

// ============================================================================
// Approval Workflow Types
// ============================================================================

/** Workflow stage type */
export type WorkflowStage = "writer" | "reviewer" | "approver";

/** Approval status */
export type ApprovalStatus =
	| "pending"
	| "in_review"
	| "approved"
	| "rejected"
	| "changes_requested";

/**
 * A document approval/review record.
 */
export interface DocumentApproval {
	id: string;
	documentId: string;
	sectionId: string | null;
	proposalDocumentId: string | null;
	stage: WorkflowStage;
	status: ApprovalStatus;
	assignedTo: string;
	assignedToName?: string;
	assignedToAvatar?: string;
	sequenceOrder: number;
	dueDate: Date | null;
	completedAt: Date | null;
	notes: string | null;
	rejectionReason: string | null;
	previousApprovalId: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input for creating an approval workflow entry.
 */
export interface CreateApprovalInput {
	documentId: string;
	sectionId?: string;
	proposalDocumentId?: string;
	stage: WorkflowStage;
	assignedTo: string;
	sequenceOrder?: number;
	dueDate?: Date | string;
}

/**
 * Input for updating approval status.
 */
export interface UpdateApprovalInput {
	status: ApprovalStatus;
	notes?: string;
	rejectionReason?: string;
}

/**
 * Input for submitting review decision.
 */
export interface SubmitReviewInput {
	approvalId: string;
	status: Extract<ApprovalStatus, "approved" | "rejected" | "changes_requested">;
	notes?: string;
	rejectionReason?: string;
}

/**
 * Filter criteria for approvals.
 */
export interface ApprovalFilters {
	documentId?: string;
	sectionId?: string;
	proposalDocumentId?: string;
	stage?: WorkflowStage;
	status?: ApprovalStatus;
	assignedTo?: string;
	isOverdue?: boolean;
}

// ============================================================================
// Workflow Configuration Types
// ============================================================================

/**
 * Configuration for a single stage in a workflow.
 */
export interface WorkflowStageConfig {
	/** Stage type */
	stage: WorkflowStage;
	/** Display name for this stage */
	name: string;
	/** Description of responsibilities */
	description?: string;
	/** Number of reviewers required at this stage */
	requiredCount: number;
	/** Whether all reviewers must approve (vs any can approve) */
	requireAll: boolean;
	/** Default due date offset from stage entry (days) */
	dueDays: number;
	/** Whether this stage can be skipped */
	isOptional: boolean;
	/** Custom notification settings */
	notifications?: {
		onAssign?: boolean;
		onDueSoon?: boolean;
		reminderDays?: number[];
	};
}

/**
 * A configured workflow template.
 */
export interface DocumentWorkflow {
	id: string;
	name: string;
	description: string | null;
	stages: WorkflowStageConfig[];
	isDefault: boolean;
	organizationId: string | null;
	documentType: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input for creating a workflow.
 */
export interface CreateWorkflowInput {
	name: string;
	description?: string;
	stages: WorkflowStageConfig[];
	isDefault?: boolean;
	organizationId?: string;
	documentType?: string;
}

/**
 * Input for updating a workflow.
 */
export interface UpdateWorkflowInput {
	name?: string;
	description?: string;
	stages?: WorkflowStageConfig[];
	isDefault?: boolean;
}

// ============================================================================
// Workflow Assignment Types
// ============================================================================

/**
 * An assignment of a user to a workflow stage for a document.
 */
export interface WorkflowAssignment {
	id: string;
	documentId: string;
	workflowId: string | null;
	stage: WorkflowStage;
	userId: string;
	userName?: string;
	userAvatar?: string;
	sequenceOrder: number;
	dueDate: Date | null;
	isActive: boolean;
	assignedBy: string;
	assignedByName?: string;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input for creating a workflow assignment.
 */
export interface CreateAssignmentInput {
	documentId: string;
	workflowId?: string;
	stage: WorkflowStage;
	userId: string;
	sequenceOrder?: number;
	dueDate?: Date | string;
}

/**
 * Input for bulk assigning users to workflow stages.
 */
export interface BulkAssignmentInput {
	documentId: string;
	assignments: Array<{
		stage: WorkflowStage;
		userId: string;
		sequenceOrder?: number;
		dueDate?: Date | string;
	}>;
}

// ============================================================================
// Workflow Status & Visualization Types
// ============================================================================

/**
 * Current status of a document in the workflow.
 */
export interface WorkflowStatus {
	documentId: string;
	workflowId: string | null;
	currentStage: WorkflowStage | null;
	overallStatus: ApprovalStatus;
	/** Progress through workflow (0-100) */
	progressPercentage: number;
	/** All stages and their current status */
	stageStatuses: StageStatus[];
	/** Can current user take action */
	isActionRequired: boolean;
	/** What action can current user take */
	availableActions: WorkflowAction[];
	/** Days until current stage deadline */
	daysUntilDue: number | null;
}

/**
 * Status of an individual workflow stage.
 */
export interface StageStatus {
	stage: WorkflowStage;
	name: string;
	status: ApprovalStatus;
	completed: boolean;
	assignedUsers: AssignedUser[];
	completedBy: string | null;
	completedAt: Date | null;
	dueDate: Date | null;
	isOverdue: boolean;
}

/**
 * User assigned to a stage.
 */
export interface AssignedUser {
	userId: string;
	userName: string;
	userAvatar?: string;
	sequenceOrder: number;
	hasCompleted: boolean;
}

/**
 * Available workflow actions for current user.
 */
export type WorkflowAction =
	| { type: "submit_for_review"; label: string }
	| { type: "approve"; label: string }
	| { type: "reject"; label: string }
	| { type: "request_changes"; label: string }
	| { type: "approve_with_conditions"; label: string };

// ============================================================================
// Notification Types (for future email integration)
// ============================================================================

/**
 * Notification type for workflow events.
 */
export type WorkflowNotificationType =
	| "assigned"
	| "due_soon"
	| "overdue"
	| "approved"
	| "rejected"
	| "changes_requested"
	| "comment_added"
	| "mentioned";

/**
 * Workflow notification payload.
 */
export interface WorkflowNotification {
	id: string;
	userId: string;
	type: WorkflowNotificationType;
	documentId: string;
	documentTitle: string;
	message: string;
	/** Link to document */
	actionUrl: string;
	/** When to send/deliver */
	deliverAt: Date;
	/** Whether notification has been sent */
	isSent: boolean;
	createdAt: Date;
}

// ============================================================================
// Deadline & Urgency Types
// ============================================================================

/** Urgency level for deadlines */
export type DeadlineUrgency =
	| "overdue"
	| "critical"
	| "urgent"
	| "upcoming"
	| "normal";

/**
 * Deadline information for a workflow item.
 */
export interface WorkflowDeadline {
	id: string;
	type: "approval" | "assignment";
	title: string;
	documentId: string;
	documentTitle: string;
	stage: WorkflowStage;
	assignedTo: string;
	dueDate: Date;
	daysRemaining: number;
	urgency: DeadlineUrgency;
	status: ApprovalStatus;
}

/**
 * Summary of pending deadlines for a user or organization.
 */
export interface DeadlineSummary {
	overdue: WorkflowDeadline[];
	critical: WorkflowDeadline[]; // <= 3 days
	urgent: WorkflowDeadline[]; // <= 7 days
	normal: WorkflowDeadline[]; // > 7 days
	totalCount: number;
}
