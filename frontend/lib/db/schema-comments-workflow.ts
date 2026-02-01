/**
 * Comments and Workflow Schema - DocFusion
 *
 * Database schema for document comments, review/approval workflow,
 * and workflow configuration.
 */

import {
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
	index,
	uniqueIndex,
	integer,
	jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { documents, proposalDocuments, documentSections, user } from "./schema";

// ============================================================================
// Document Comments
// ============================================================================

export const documentComments = pgTable(
	"document_comments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Document being commented on */
		documentId: uuid("document_id")
			.notNull()
			.references(() => documents.id, { onDelete: "cascade" }),
		/** Optional: specific section within document */
		sectionId: uuid("section_id").references(() => documentSections.id, { onDelete: "cascade" }),
		/** User who created the comment */
		userId: varchar("user_id", { length: 100 }).notNull(),
		/** Comment content */
		content: text("content").notNull(),
		/** Type: comment, suggestion, approval, rejection */
		type: varchar("type", { length: 20 }).notNull().default("comment"),
		/** Parent comment ID for threaded replies */
		parentId: uuid("parent_id"),
		/** Position in document (e.g., selected text range) */
		position: jsonb("position"),
		/** When comment was resolved */
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
		/** User who resolved the comment */
		resolvedBy: varchar("resolved_by", { length: 100 }),
		/** Whether comment has been edited */
		isEdited: varchar("is_edited", { length: 10 }).notNull().default("false"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("comments_document_idx").on(table.documentId),
		index("comments_section_idx").on(table.sectionId),
		index("comments_user_idx").on(table.userId),
		index("comments_parent_idx").on(table.parentId),
		index("comments_type_idx").on(table.type),
		index("comments_resolved_idx").on(table.resolvedAt),
		index("comments_created_idx").on(table.createdAt),
	]
);

// ============================================================================
// Document Approvals (Review Workflow)
// ============================================================================

export const documentApprovals = pgTable(
	"document_approvals",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Document being reviewed */
		documentId: uuid("document_id")
			.notNull()
			.references(() => documents.id, { onDelete: "cascade" }),
		/** Optional: specific section within document */
		sectionId: uuid("section_id").references(() => documentSections.id, { onDelete: "cascade" }),
		/** Proposal document if part of a proposal */
		proposalDocumentId: uuid("proposal_document_id").references(() => proposalDocuments.id, {
			onDelete: "cascade",
		}),
		/** Workflow stage: writer, reviewer, approver */
		stage: varchar("stage", { length: 20 }).notNull(),
		/** Current status: pending, in_review, approved, rejected, changes_requested */
		status: varchar("status", { length: 30 }).notNull().default("pending"),
		/** User assigned to this stage */
		assignedTo: varchar("assigned_to", { length: 100 }).notNull(),
		/** Position in review sequence (for multiple reviewers) */
		sequenceOrder: integer("sequence_order").notNull().default(0),
		/** Due date for this review stage */
		dueDate: timestamp("due_date", { withTimezone: true }),
		/** When review was completed */
		completedAt: timestamp("completed_at", { withTimezone: true }),
		/** Completion notes/feedback */
		notes: text("notes"),
		/** Rejection/changes requested reason */
		rejectionReason: text("rejection_reason"),
		/** Previous approval ID (for resubmissions) */
		previousApprovalId: uuid("previous_approval_id"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("approvals_document_idx").on(table.documentId),
		index("approvals_section_idx").on(table.sectionId),
		index("approvals_proposal_doc_idx").on(table.proposalDocumentId),
		index("approvals_stage_idx").on(table.stage),
		index("approvals_status_idx").on(table.status),
		index("approvals_assigned_idx").on(table.assignedTo),
		index("approvals_due_date_idx").on(table.dueDate),
		index("approvals_completed_idx").on(table.completedAt),
	]
);

// ============================================================================
// Workflow Configuration
// ============================================================================

export const documentWorkflows = pgTable(
	"document_workflows",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Workflow name */
		name: varchar("name", { length: 200 }).notNull(),
		/** Workflow description */
		description: text("description"),
		/** Workflow stages configuration (JSON array) */
		stages: jsonb("stages").notNull().default([]),
		/** Whether this is the default organization workflow */
		isDefault: varchar("is_default", { length: 10 }).notNull().default("false"),
		/** Organization ID for organization-specific workflows */
		organizationId: varchar("organization_id", { length: 100 }),
		/** Document type this workflow applies to (optional) */
		documentType: varchar("document_type", { length: 50 }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("workflows_org_idx").on(table.organizationId),
		index("workflows_default_idx").on(table.isDefault),
		index("workflows_type_idx").on(table.documentType),
	]
);

// ============================================================================
// Workflow Assignments (Who is assigned to review/approve what)
// ============================================================================

export const workflowAssignments = pgTable(
	"workflow_assignments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Document this assignment applies to */
		documentId: uuid("document_id")
			.notNull()
			.references(() => documents.id, { onDelete: "cascade" }),
		/** Workflow being used */
		workflowId: uuid("workflow_id").references(() => documentWorkflows.id, {
			onDelete: "set null",
		}),
		/** Stage in workflow: writer, reviewer, approver */
		stage: varchar("stage", { length: 20 }).notNull(),
		/** User assigned to this stage */
		userId: varchar("user_id", { length: 100 }).notNull(),
		/** Position in sequence (for multi-reviewer stages) */
		sequenceOrder: integer("sequence_order").notNull().default(0),
		/** Due date for this assignment */
		dueDate: timestamp("due_date", { withTimezone: true }),
		/** Whether this assignment is active */
		isActive: varchar("is_active", { length: 10 }).notNull().default("true"),
		/** Who created this assignment */
		assignedBy: varchar("assigned_by", { length: 100 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("assignments_document_idx").on(table.documentId),
		index("assignments_workflow_idx").on(table.workflowId),
		index("assignments_stage_idx").on(table.stage),
		index("assignments_user_idx").on(table.userId),
		uniqueIndex("assignments_doc_stage_seq_idx").on(table.documentId, table.stage, table.sequenceOrder),
	]
);

// ============================================================================
// Comment Reactions (optional enhancement)
// ============================================================================

export const commentReactions = pgTable(
	"comment_reactions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		commentId: uuid("comment_id")
			.notNull()
			.references(() => documentComments.id, { onDelete: "cascade" }),
		userId: varchar("user_id", { length: 100 }).notNull(),
		/** Emoji reaction */
		reaction: varchar("reaction", { length: 50 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("reactions_comment_user_idx").on(table.commentId, table.userId),
		index("reactions_comment_idx").on(table.commentId),
	]
);

// ============================================================================
// Comment Read Status (Tracks which users have read which comments)
// ============================================================================

export const commentReads = pgTable(
	"comment_reads",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Document that the comment belongs to */
		documentId: uuid("document_id")
			.notNull()
			.references(() => documents.id, { onDelete: "cascade" }),
		/** The comment that was read */
		commentId: uuid("comment_id")
			.notNull()
			.references(() => documentComments.id, { onDelete: "cascade" }),
		/** The user who read the comment */
		userId: varchar("user_id", { length: 100 }).notNull(),
		/** When the comment was read */
		readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		// Each user can only have one read record per comment
		uniqueIndex("comment_reads_user_comment_idx").on(table.commentId, table.userId),
		index("comment_reads_document_idx").on(table.documentId),
		index("comment_reads_user_idx").on(table.userId),
		index("comment_reads_comment_idx").on(table.commentId),
	]
);

// ============================================================================
// Relations
// ============================================================================

export const documentCommentsRelations = relations(documentComments, ({ one, many }) => ({
	document: one(documents, {
		fields: [documentComments.documentId],
		references: [documents.id],
	}),
	section: one(documentSections, {
		fields: [documentComments.sectionId],
		references: [documentSections.id],
	}),
	parent: one(documentComments, {
		fields: [documentComments.parentId],
		references: [documentComments.id],
		relationName: "commentReplies",
	}),
	replies: many(documentComments, { relationName: "commentReplies" }),
	reactions: many(commentReactions),
}));

export const documentApprovalsRelations = relations(documentApprovals, ({ one }) => ({
	document: one(documents, {
		fields: [documentApprovals.documentId],
		references: [documents.id],
	}),
	section: one(documentSections, {
		fields: [documentApprovals.sectionId],
		references: [documentSections.id],
	}),
	proposalDocument: one(proposalDocuments, {
		fields: [documentApprovals.proposalDocumentId],
		references: [proposalDocuments.id],
	}),
	previousApproval: one(documentApprovals, {
		fields: [documentApprovals.previousApprovalId],
		references: [documentApprovals.id],
	}),
}));

export const documentWorkflowsRelations = relations(documentWorkflows, ({ many }) => ({
	assignments: many(workflowAssignments),
}));

export const workflowAssignmentsRelations = relations(workflowAssignments, ({ one }) => ({
	document: one(documents, {
		fields: [workflowAssignments.documentId],
		references: [documents.id],
	}),
	workflow: one(documentWorkflows, {
		fields: [workflowAssignments.workflowId],
		references: [documentWorkflows.id],
	}),
}));

export const commentReactionsRelations = relations(commentReactions, ({ one }) => ({
	comment: one(documentComments, {
		fields: [commentReactions.commentId],
		references: [documentComments.id],
	}),
}));

export const commentReadsRelations = relations(commentReads, ({ one }) => ({
	document: one(documents, {
		fields: [commentReads.documentId],
		references: [documents.id],
	}),
	comment: one(documentComments, {
		fields: [commentReads.commentId],
		references: [documentComments.id],
	}),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type DocumentCommentRow = typeof documentComments.$inferSelect;
export type NewDocumentComment = typeof documentComments.$inferInsert;

export type DocumentApprovalRow = typeof documentApprovals.$inferSelect;
export type NewDocumentApproval = typeof documentApprovals.$inferInsert;

export type DocumentWorkflowRow = typeof documentWorkflows.$inferSelect;
export type NewDocumentWorkflow = typeof documentWorkflows.$inferInsert;

export type WorkflowAssignmentRow = typeof workflowAssignments.$inferSelect;
export type NewWorkflowAssignment = typeof workflowAssignments.$inferInsert;

export type CommentReactionRow = typeof commentReactions.$inferSelect;
export type NewCommentReaction = typeof commentReactions.$inferInsert;

export type CommentReadRow = typeof commentReads.$inferSelect;
export type NewCommentRead = typeof commentReads.$inferInsert;
