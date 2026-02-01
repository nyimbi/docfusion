/**
 * Task Management Schema - DocFusion
 *
 * Database schema for intelligent task assignment, workload balancing,
 * and proposal progress tracking. Includes author expertise tracking,
 * task dependencies, and workload snapshots for capacity planning.
 *
 * Key Features:
 * - Task lifecycle management with dependencies
 * - Author expertise profiling for intelligent assignment
 * - Workload snapshots for capacity analysis
 * - Critical path tracking for deadlines
 */

import {
	pgTable,
	uuid,
	varchar,
	text,
	timestamp,
	date,
	real,
	integer,
	boolean,
	jsonb,
	index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// Proposal Tasks
// ============================================================================

/**
 * ProposalTasks - Individual tasks for proposal development.
 *
 * Tasks are the atomic units of work assigned to authors. They track
 * progress, dependencies, and deadlines. Tasks can be auto-generated
 * from compliance matrices or manually created.
 */
export const proposalTasks = pgTable("proposal_tasks", {
	id: uuid("id").primaryKey().defaultRandom(),
	opportunityId: uuid("opportunity_id").notNull(),

	// Task identification
	taskNumber: varchar("task_number", { length: 50 }),
	title: varchar("title", { length: 500 }).notNull(),
	description: text("description"),

	// Categorization
	taskType: varchar("task_type", { length: 100 }).notNull(), // writing, review, graphics, research, editing, formatting, approval
	taskCategory: varchar("task_category", { length: 100 }), // technical, management, past_performance, cost, executive_summary
	sectionId: uuid("section_id"),
	requirementId: uuid("requirement_id"),
	volumeId: uuid("volume_id"),

	// Assignment
	assignedTo: varchar("assigned_to", { length: 200 }),
	assignedToEmail: varchar("assigned_to_email", { length: 200 }),
	assignedBy: varchar("assigned_by", { length: 200 }),
	assignedAt: timestamp("assigned_at", { withTimezone: true }),

	// Assignment suggestions (AI-generated)
	suggestedAssignees: jsonb("suggested_assignees").$type<{
		userId: string;
		userName: string;
		matchScore: number;
		reasons: string[];
	}[]>(),

	// Timeline
	startDate: timestamp("start_date", { withTimezone: true }),
	dueDate: timestamp("due_date", { withTimezone: true }),
	estimatedHours: real("estimated_hours"),
	actualHours: real("actual_hours"),
	hoursLogged: jsonb("hours_logged").$type<{
		date: string;
		hours: number;
		userId: string;
		notes?: string;
	}[]>(),

	// Dependencies - critical for scheduling
	dependsOn: jsonb("depends_on").$type<string[]>().default([]),
	blockedBy: jsonb("blocked_by").$type<string[]>().default([]),
	blocks: jsonb("blocks").$type<string[]>().default([]),

	// Status tracking
	status: varchar("status", { length: 50 }).default("pending"), // pending, assigned, in_progress, review, blocked, completed, cancelled
	priority: varchar("priority", { length: 50 }).default("medium"), // critical, high, medium, low
	completedAt: timestamp("completed_at", { withTimezone: true }),
	completedBy: varchar("completed_by", { length: 200 }),

	// Progress tracking
	progress: integer("progress").default(0), // 0-100 percentage
	wordCountTarget: integer("word_count_target"),
	wordCountCurrent: integer("word_count_current"),
	pageTarget: real("page_target"),
	pageCurrent: real("page_current"),

	// Quality tracking
	qualityScore: real("quality_score"),
	lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
	lastReviewedBy: varchar("last_reviewed_by", { length: 200 }),
	reviewNotes: text("review_notes"),

	// Compliance linkage
	complianceRequirements: jsonb("compliance_requirements").$type<string[]>(),
	evaluationCriteriaIds: jsonb("evaluation_criteria_ids").$type<string[]>(),

	// Notifications
	remindersSent: integer("reminders_sent").default(0),
	lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
	escalated: boolean("escalated").default(false),
	escalatedAt: timestamp("escalated_at", { withTimezone: true }),

	// Comments and activity
	comments: jsonb("comments").$type<{
		id: string;
		userId: string;
		userName: string;
		content: string;
		createdAt: string;
	}[]>().default([]),

	// Tags for filtering
	tags: jsonb("tags").$type<string[]>().default([]),

	// Source tracking (if auto-generated)
	sourceType: varchar("source_type", { length: 50 }), // compliance_matrix, template, manual, import
	sourceId: uuid("source_id"),

	// Metadata
	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	opportunityIdx: index("proposal_tasks_opportunity_idx").on(table.opportunityId),
	assignedToIdx: index("proposal_tasks_assigned_to_idx").on(table.assignedTo),
	statusIdx: index("proposal_tasks_status_idx").on(table.status),
	dueDateIdx: index("proposal_tasks_due_date_idx").on(table.dueDate),
	priorityIdx: index("proposal_tasks_priority_idx").on(table.priority),
}));

// ============================================================================
// Author Expertise
// ============================================================================

/**
 * AuthorExpertise - Profile of author capabilities for intelligent assignment.
 *
 * Tracks expertise areas, writing speed, quality scores, and preferences.
 * Used by the AI to suggest optimal task assignments based on skills
 * and historical performance.
 */
export const authorExpertise = pgTable("author_expertise", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: varchar("user_id", { length: 200 }).notNull().unique(),
	userName: varchar("user_name", { length: 200 }).notNull(),
	userEmail: varchar("user_email", { length: 200 }),

	// Expertise areas with proficiency levels
	expertiseAreas: jsonb("expertise_areas").$type<{
		area: string;
		category: string;
		proficiency: "beginner" | "intermediate" | "advanced" | "expert";
		yearsExperience: number;
		lastUsed: string;
		projectCount: number;
	}[]>().default([]),

	// Writing metrics (auto-calculated from history)
	averageWordsPerHour: real("average_words_per_hour"),
	qualityScoreAverage: real("quality_score_average"),
	onTimeDeliveryRate: real("on_time_delivery_rate"), // 0-100 percentage
	revisionRate: real("revision_rate"), // Average revisions per task
	firstDraftAcceptanceRate: real("first_draft_acceptance_rate"),

	// Task completion history
	totalTasksCompleted: integer("total_tasks_completed").default(0),
	totalHoursLogged: real("total_hours_logged").default(0),
	tasksCompletedByType: jsonb("tasks_completed_by_type").$type<Record<string, number>>().default({}),
	tasksCompletedByCategory: jsonb("tasks_completed_by_category").$type<Record<string, number>>().default({}),

	// Preferences
	preferredTaskTypes: jsonb("preferred_task_types").$type<string[]>().default([]),
	avoidedTaskTypes: jsonb("avoided_task_types").$type<string[]>().default([]),
	maxConcurrentTasks: integer("max_concurrent_tasks").default(5),
	preferredWorkingHours: jsonb("preferred_working_hours").$type<{
		start: string;
		end: string;
		timezone: string;
	}>(),

	// Availability
	availability: varchar("availability", { length: 50 }).default("available"), // available, limited, unavailable
	availableHoursPerWeek: real("available_hours_per_week").default(40),
	outOfOfficeDates: jsonb("out_of_office_dates").$type<{
		start: string;
		end: string;
		reason?: string;
	}[]>().default([]),

	// Clearance (for secure work)
	clearanceLevel: varchar("clearance_level", { length: 100 }),
	clearanceStatus: varchar("clearance_status", { length: 50 }),

	// Certifications relevant to writing
	certifications: jsonb("certifications").$type<{
		name: string;
		issuer: string;
		expirationDate?: string;
	}[]>().default([]),

	// Performance trends
	performanceTrend: varchar("performance_trend", { length: 50 }), // improving, stable, declining
	lastPerformanceReview: timestamp("last_performance_review", { withTimezone: true }),

	// Metadata
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	userIdIdx: index("author_expertise_user_id_idx").on(table.userId),
	availabilityIdx: index("author_expertise_availability_idx").on(table.availability),
}));

// ============================================================================
// Workload Snapshots
// ============================================================================

/**
 * WorkloadSnapshots - Daily snapshots of author workload for capacity planning.
 *
 * Captures current task load, estimated hours, and utilization rate.
 * Used for workload balancing, bottleneck detection, and forecasting.
 */
export const workloadSnapshots = pgTable("workload_snapshots", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: varchar("user_id", { length: 200 }).notNull(),
	userName: varchar("user_name", { length: 200 }),

	snapshotDate: date("snapshot_date").notNull(),

	// Current load metrics
	activeTasks: integer("active_tasks").default(0),
	pendingTasks: integer("pending_tasks").default(0),
	completedTasks: integer("completed_tasks").default(0),
	blockedTasks: integer("blocked_tasks").default(0),

	// Hours tracking
	totalEstimatedHours: real("total_estimated_hours").default(0),
	totalActualHours: real("total_actual_hours").default(0),
	hoursLoggedToday: real("hours_logged_today").default(0),

	// Deadline pressure
	dueToday: integer("due_today").default(0),
	dueThisWeek: integer("due_this_week").default(0),
	overdueCount: integer("overdue_count").default(0),
	criticalTasks: integer("critical_tasks").default(0),

	// Capacity metrics
	availableHours: real("available_hours").default(0),
	allocatedHours: real("allocated_hours").default(0),
	utilizationRate: real("utilization_rate").default(0), // 0-100 percentage
	overallocationAmount: real("overallocation_amount").default(0), // Hours over capacity

	// Task distribution
	tasksByType: jsonb("tasks_by_type").$type<Record<string, number>>().default({}),
	tasksByPriority: jsonb("tasks_by_priority").$type<Record<string, number>>().default({}),
	tasksByOpportunity: jsonb("tasks_by_opportunity").$type<Record<string, number>>().default({}),

	// Performance for the day
	tasksCompletedToday: integer("tasks_completed_today").default(0),
	wordsWrittenToday: integer("words_written_today").default(0),

	// Health indicators
	workloadHealth: varchar("workload_health", { length: 50 }), // healthy, elevated, overloaded, critical
	riskLevel: varchar("risk_level", { length: 50 }), // low, medium, high, critical

	// Recommendations
	recommendations: jsonb("recommendations").$type<string[]>().default([]),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	userDateIdx: index("workload_snapshots_user_date_idx").on(table.userId, table.snapshotDate),
	snapshotDateIdx: index("workload_snapshots_date_idx").on(table.snapshotDate),
	healthIdx: index("workload_snapshots_health_idx").on(table.workloadHealth),
}));

// ============================================================================
// Task Templates
// ============================================================================

/**
 * TaskTemplates - Reusable templates for common task types.
 *
 * Allows creating standard tasks with predefined values,
 * checklist items, and estimated durations.
 */
export const taskTemplates = pgTable("task_templates", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: uuid("organization_id"),

	// Template identification
	name: varchar("name", { length: 200 }).notNull(),
	description: text("description"),

	// Task defaults
	taskType: varchar("task_type", { length: 100 }).notNull(),
	taskCategory: varchar("task_category", { length: 100 }),
	defaultPriority: varchar("default_priority", { length: 50 }).default("medium"),

	// Estimates
	estimatedHours: real("estimated_hours"),
	wordCountTarget: integer("word_count_target"),
	pageTarget: real("page_target"),

	// Checklist items
	checklist: jsonb("checklist").$type<{
		item: string;
		required: boolean;
	}[]>().default([]),

	// Instructions
	instructions: text("instructions"),
	exampleContent: text("example_content"),
	qualityCriteria: jsonb("quality_criteria").$type<string[]>().default([]),

	// Dependencies template
	suggestedDependencies: jsonb("suggested_dependencies").$type<string[]>().default([]),

	// Expertise requirements
	requiredExpertise: jsonb("required_expertise").$type<{
		area: string;
		minProficiency: string;
	}[]>().default([]),

	// Tags
	tags: jsonb("tags").$type<string[]>().default([]),

	isActive: boolean("is_active").default(true),

	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// Task History / Activity Log
// ============================================================================

/**
 * TaskActivity - Audit log of all task changes and activities.
 *
 * Tracks status changes, assignments, comments, and time entries
 * for complete task history and analytics.
 */
export const taskActivity = pgTable("task_activity", {
	id: uuid("id").primaryKey().defaultRandom(),
	taskId: uuid("task_id").notNull(),

	// Activity info
	activityType: varchar("activity_type", { length: 100 }).notNull(), // created, assigned, status_change, comment, time_logged, progress_update, due_date_change, completed, escalated
	description: text("description"),

	// Change details
	previousValue: text("previous_value"),
	newValue: text("new_value"),
	changeField: varchar("change_field", { length: 100 }),

	// Actor
	userId: varchar("user_id", { length: 200 }),
	userName: varchar("user_name", { length: 200 }),

	// Additional data
	metadata: jsonb("metadata").$type<Record<string, unknown>>(),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	taskIdIdx: index("task_activity_task_id_idx").on(table.taskId),
	activityTypeIdx: index("task_activity_type_idx").on(table.activityType),
	createdAtIdx: index("task_activity_created_at_idx").on(table.createdAt),
}));

// ============================================================================
// Opportunity Task Summary
// ============================================================================

/**
 * OpportunityTaskSummary - Aggregated task metrics per opportunity.
 *
 * Provides quick access to proposal progress, deadlines, and health
 * without having to aggregate individual tasks.
 */
export const opportunityTaskSummary = pgTable("opportunity_task_summary", {
	id: uuid("id").primaryKey().defaultRandom(),
	opportunityId: uuid("opportunity_id").notNull().unique(),

	// Task counts
	totalTasks: integer("total_tasks").default(0),
	pendingTasks: integer("pending_tasks").default(0),
	inProgressTasks: integer("in_progress_tasks").default(0),
	completedTasks: integer("completed_tasks").default(0),
	blockedTasks: integer("blocked_tasks").default(0),
	cancelledTasks: integer("cancelled_tasks").default(0),

	// Priority breakdown
	criticalTasks: integer("critical_tasks").default(0),
	highPriorityTasks: integer("high_priority_tasks").default(0),
	overdueTasks: integer("overdue_tasks").default(0),

	// Progress
	overallProgress: integer("overall_progress").default(0), // 0-100
	wordCountTotal: integer("word_count_total").default(0),
	wordCountCompleted: integer("word_count_completed").default(0),

	// Timeline
	earliestDueDate: timestamp("earliest_due_date", { withTimezone: true }),
	latestDueDate: timestamp("latest_due_date", { withTimezone: true }),
	proposalDeadline: timestamp("proposal_deadline", { withTimezone: true }),
	daysUntilDeadline: integer("days_until_deadline"),

	// Team metrics
	uniqueAssignees: integer("unique_assignees").default(0),
	totalEstimatedHours: real("total_estimated_hours").default(0),
	totalActualHours: real("total_actual_hours").default(0),

	// Health indicators
	healthStatus: varchar("health_status", { length: 50 }).default("healthy"), // healthy, at_risk, critical
	riskFactors: jsonb("risk_factors").$type<string[]>().default([]),
	criticalPath: jsonb("critical_path").$type<string[]>().default([]),

	// Bottlenecks
	bottlenecks: jsonb("bottlenecks").$type<{
		taskId: string;
		title: string;
		reason: string;
		impactedTasks: number;
	}[]>().default([]),

	lastCalculatedAt: timestamp("last_calculated_at", { withTimezone: true }),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	opportunityIdx: index("opportunity_task_summary_opp_idx").on(table.opportunityId),
	healthIdx: index("opportunity_task_summary_health_idx").on(table.healthStatus),
}));

// ============================================================================
// Relations
// ============================================================================

export const proposalTasksRelations = relations(proposalTasks, ({ many }) => ({
	activities: many(taskActivity),
}));

export const taskActivityRelations = relations(taskActivity, ({ one }) => ({
	task: one(proposalTasks, {
		fields: [taskActivity.taskId],
		references: [proposalTasks.id],
	}),
}));

// ============================================================================
// Types
// ============================================================================

export type ProposalTask = typeof proposalTasks.$inferSelect;
export type NewProposalTask = typeof proposalTasks.$inferInsert;

export type AuthorExpertise = typeof authorExpertise.$inferSelect;
export type NewAuthorExpertise = typeof authorExpertise.$inferInsert;

export type WorkloadSnapshot = typeof workloadSnapshots.$inferSelect;
export type NewWorkloadSnapshot = typeof workloadSnapshots.$inferInsert;

export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type NewTaskTemplate = typeof taskTemplates.$inferInsert;

export type TaskActivity = typeof taskActivity.$inferSelect;
export type NewTaskActivity = typeof taskActivity.$inferInsert;

export type OpportunityTaskSummary = typeof opportunityTaskSummary.$inferSelect;
export type NewOpportunityTaskSummary = typeof opportunityTaskSummary.$inferInsert;
