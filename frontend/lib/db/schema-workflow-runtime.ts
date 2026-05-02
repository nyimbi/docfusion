/**
 * Workflow runtime schema.
 *
 * These tables provide the cross-domain control plane for proposal workflows:
 * durable instances, ownership/SLA state, audit events, portal visibility, and
 * notification records. Domain tables still own their business data.
 */

import {
	pgTable,
	uuid,
	varchar,
	text,
	timestamp,
	jsonb,
	integer,
	index,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const workflowInstances = pgTable(
	"workflow_instances",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workflowKey: varchar("workflow_key", { length: 100 }).notNull(),
		subjectType: varchar("subject_type", { length: 100 }).notNull(),
		subjectId: varchar("subject_id", { length: 200 }).notNull(),
		opportunityId: uuid("opportunity_id"),
		status: varchar("status", { length: 40 }).notNull().default("active"),
		state: varchar("state", { length: 100 }).notNull(),
		priority: varchar("priority", { length: 40 }).notNull().default("medium"),
		assignedTo: varchar("assigned_to", { length: 200 }),
		assignedRole: varchar("assigned_role", { length: 100 }),
		assignedBy: varchar("assigned_by", { length: 200 }),
		assignedAt: timestamp("assigned_at", { withTimezone: true }),
		dueAt: timestamp("due_at", { withTimezone: true }),
		slaBreachedAt: timestamp("sla_breached_at", { withTimezone: true }),
		escalatedTo: varchar("escalated_to", { length: 200 }),
		escalatedAt: timestamp("escalated_at", { withTimezone: true }),
		visibility: varchar("visibility", { length: 40 }).notNull().default("internal"),
		portalVisibility: jsonb("portal_visibility").$type<{
			visibleToPortal: boolean;
			portalRole?: string;
			summary?: string;
			actionLabel?: string;
			actionUrl?: string;
		}>(),
		authorityPolicy: jsonb("authority_policy").$type<{
			requiredRoles?: string[];
			allowedActorIds?: string[];
			minApprovers?: number;
			escalationRole?: string;
		}>(),
		metrics: jsonb("metrics").$type<Record<string, unknown>>().default({}),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		createdBy: varchar("created_by", { length: 200 }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("workflow_instances_subject_idx").on(table.workflowKey, table.subjectType, table.subjectId),
		index("workflow_instances_opportunity_idx").on(table.opportunityId),
		index("workflow_instances_status_idx").on(table.status),
		index("workflow_instances_state_idx").on(table.state),
		index("workflow_instances_assigned_idx").on(table.assignedTo),
		index("workflow_instances_due_idx").on(table.dueAt),
		index("workflow_instances_visibility_idx").on(table.visibility),
	]
);

export const workflowRuntimeTasks = pgTable(
	"workflow_runtime_tasks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workflowInstanceId: uuid("workflow_instance_id").notNull(),
		taskKey: varchar("task_key", { length: 160 }).notNull(),
		title: varchar("title", { length: 500 }).notNull(),
		description: text("description"),
		state: varchar("state", { length: 80 }).notNull().default("open"),
		priority: varchar("priority", { length: 40 }).notNull().default("medium"),
		assignedTo: varchar("assigned_to", { length: 200 }),
		assignedRole: varchar("assigned_role", { length: 100 }),
		dueAt: timestamp("due_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("workflow_runtime_tasks_key_idx").on(table.workflowInstanceId, table.taskKey),
		index("workflow_runtime_tasks_instance_idx").on(table.workflowInstanceId),
		index("workflow_runtime_tasks_state_idx").on(table.state),
		index("workflow_runtime_tasks_assigned_idx").on(table.assignedTo),
		index("workflow_runtime_tasks_due_idx").on(table.dueAt),
	]
);

export const workflowAuditEvents = pgTable(
	"workflow_audit_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workflowInstanceId: uuid("workflow_instance_id").notNull(),
		subjectType: varchar("subject_type", { length: 100 }).notNull(),
		subjectId: varchar("subject_id", { length: 200 }).notNull(),
		eventType: varchar("event_type", { length: 100 }).notNull(),
		fromState: varchar("from_state", { length: 100 }),
		toState: varchar("to_state", { length: 100 }),
		actorId: varchar("actor_id", { length: 200 }).notNull(),
		actorName: varchar("actor_name", { length: 200 }),
		reason: text("reason"),
		evidenceLinks: jsonb("evidence_links").$type<string[]>().default([]),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("workflow_audit_instance_idx").on(table.workflowInstanceId),
		index("workflow_audit_subject_idx").on(table.subjectType, table.subjectId),
		index("workflow_audit_event_idx").on(table.eventType),
		index("workflow_audit_created_idx").on(table.createdAt),
	]
);

export const workflowNotifications = pgTable(
	"workflow_notifications",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workflowInstanceId: uuid("workflow_instance_id").notNull(),
		recipientId: varchar("recipient_id", { length: 200 }).notNull(),
		channel: varchar("channel", { length: 40 }).notNull().default("in_app"),
		eventType: varchar("event_type", { length: 100 }).notNull(),
		deliveryStatus: varchar("delivery_status", { length: 40 }).notNull().default("queued"),
		actionUrl: text("action_url"),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		deliveredAt: timestamp("delivered_at", { withTimezone: true }),
		acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
	},
	(table) => [
		index("workflow_notifications_instance_idx").on(table.workflowInstanceId),
		index("workflow_notifications_recipient_idx").on(table.recipientId),
		index("workflow_notifications_status_idx").on(table.deliveryStatus),
		index("workflow_notifications_created_idx").on(table.createdAt),
	]
);

export type WorkflowInstanceRow = typeof workflowInstances.$inferSelect;
export type NewWorkflowInstance = typeof workflowInstances.$inferInsert;
export type WorkflowRuntimeTaskRow = typeof workflowRuntimeTasks.$inferSelect;
export type WorkflowAuditEventRow = typeof workflowAuditEvents.$inferSelect;
export type WorkflowNotificationRow = typeof workflowNotifications.$inferSelect;
