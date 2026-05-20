/**
 * Workflow Domain Schema - DocFusion
 *
 * Consolidated workflow-related schemas:
 * - Pipeline stages and capture management (from schema-pipeline.ts)
 * - Formal review process - Pink/Red/Gold team (from schema-reviews.ts)
 * - Document comments and approval workflow (from schema-comments-workflow.ts)
 * - Task management and workload tracking (from schema-tasks.ts)
 * - Oral presentations and Q&A (from schema-presentations.ts)
 */

import {
	pgTable,
	uuid,
	varchar,
	text,
	integer,
	timestamp,
	date,
	jsonb,
	boolean,
	real,
	index,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { documents, proposalDocuments, documentSections, opportunities } from "./schema";

// ============================================================================
// ======================== PIPELINE (schema-pipeline.ts) =====================
// ============================================================================

// Pipeline stages enum-like values
export const PIPELINE_STAGES = [
  "discovery",
  "qualification",
  "capture",
  "proposal",
  "submitted",
  "evaluation",
  "awarded",
  "lost",
  "no_bid",
  "cancelled",
] as const;

// Capture Pipeline - main pipeline tracking for opportunities
export const capturePipeline = pgTable("capture_pipeline", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }).unique(),

  // Stage tracking
  currentStage: varchar("current_stage", { length: 100 }).notNull().default("discovery"),
  stageEnteredAt: timestamp("stage_entered_at", { withTimezone: true }).defaultNow(),
  stageHistory: jsonb("stage_history").$type<{
    stage: string;
    enteredAt: string;
    exitedAt?: string;
    daysInStage?: number;
  }[]>(),

  // Bid decision
  bidDecision: varchar("bid_decision", { length: 50 }), // bid, no_bid, pending
  bidDecisionDate: timestamp("bid_decision_date", { withTimezone: true }),
  bidDecisionRationale: text("bid_decision_rationale"),
  bidDecisionMadeBy: varchar("bid_decision_made_by", { length: 200 }),

  // Pwin (Probability of Win) tracking
  pwinCurrent: real("pwin_current"),
  pwinTarget: real("pwin_target"),
  pwinHistory: jsonb("pwin_history").$type<{
    date: string;
    value: number;
    reason: string;
    updatedBy?: string;
  }[]>(),

  // Customer relationship
  customerRelationshipScore: integer("customer_relationship_score"), // 1-10
  incumbentStatus: varchar("incumbent_status", { length: 50 }), // incumbent, challenger, new_market
  customerEngagements: integer("customer_engagements").default(0),
  lastCustomerContact: timestamp("last_customer_contact", { withTimezone: true }),

  // Solution readiness
  solutionReadiness: varchar("solution_readiness", { length: 50 }), // not_started, in_progress, ready
  technicalApproachStatus: varchar("technical_approach_status", { length: 50 }),
  teamingStatus: varchar("teaming_status", { length: 50 }), // none_needed, in_progress, complete

  // Investment tracking
  captureInvestment: real("capture_investment").default(0),
  proposalInvestment: real("proposal_investment").default(0),
  totalInvestment: real("total_investment").default(0),
  budgetedInvestment: real("budgeted_investment"),

  // Key dates
  anticipatedRfpDate: timestamp("anticipated_rfp_date", { withTimezone: true }),
  actualRfpDate: timestamp("actual_rfp_date", { withTimezone: true }),
  proposalDueDate: timestamp("proposal_due_date", { withTimezone: true }),
  questionsDeadline: timestamp("questions_deadline", { withTimezone: true }),
  anticipatedAwardDate: timestamp("anticipated_award_date", { withTimezone: true }),
  actualAwardDate: timestamp("actual_award_date", { withTimezone: true }),

  // Capture manager
  captureManager: varchar("capture_manager", { length: 200 }),
  proposalManager: varchar("proposal_manager", { length: 200 }),

  // Priority and health
  priority: varchar("priority", { length: 50 }).default("medium"), // high, medium, low
  healthStatus: varchar("health_status", { length: 50 }).default("on_track"), // on_track, at_risk, critical

  // Notes
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Capture Activities - activities performed during capture
export const captureActivities = pgTable("capture_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  pipelineId: uuid("pipeline_id").references(() => capturePipeline.id, { onDelete: "cascade" }),

  // Activity info
  activityType: varchar("activity_type", { length: 100 }).notNull(), // customer_meeting, site_visit, call, email, rfi_response, draft_review, internal_meeting
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),

  // Timing
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }),
  completedDate: timestamp("completed_date", { withTimezone: true }),
  durationMinutes: integer("duration_minutes"),
  status: varchar("status", { length: 50 }).default("scheduled"), // scheduled, completed, cancelled, rescheduled

  // Outcome
  outcome: text("outcome"),
  successRating: integer("success_rating"), // 1-5
  nextSteps: jsonb("next_steps").$type<string[]>(),

  // Customer intelligence gathered
  intelligenceGathered: text("intelligence_gathered"),
  competitorIntelligence: text("competitor_intelligence"),

  // Participants
  participants: jsonb("participants").$type<{
    name: string;
    role: string;
    organization?: string;
    isCustomer?: boolean;
  }[]>(),

  // Attachments/artifacts
  attachments: jsonb("attachments").$type<{
    name: string;
    url: string;
    type: string;
  }[]>(),

  createdBy: varchar("created_by", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Gate Reviews - formal decision points
export const gateReviews = pgTable("gate_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  pipelineId: uuid("pipeline_id").references(() => capturePipeline.id, { onDelete: "cascade" }),

  // Gate info
  gateType: varchar("gate_type", { length: 100 }).notNull(), // pursuit, bid_no_bid, capture_ready, proposal_ready, color_review, final_review
  gateName: varchar("gate_name", { length: 200 }),
  gateNumber: integer("gate_number"),

  // Timing
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }),
  conductedDate: timestamp("conducted_date", { withTimezone: true }),
  status: varchar("status", { length: 50 }).default("scheduled"), // scheduled, in_progress, completed, cancelled

  // Pre-review checklist
  checklistItems: jsonb("checklist_items").$type<{
    item: string;
    required: boolean;
    completed: boolean;
    notes?: string;
  }[]>(),
  checklistComplete: boolean("checklist_complete").default(false),

  // Decision
  decision: varchar("decision", { length: 50 }), // pass, conditional_pass, fail, defer
  conditions: jsonb("conditions").$type<{
    condition: string;
    dueDate?: string;
    assignee?: string;
    status: "pending" | "met" | "waived";
  }[]>(),
  rationale: text("rationale"),

  // Scoring (for color reviews)
  technicalScore: varchar("technical_score", { length: 50 }), // green, yellow, red
  managementScore: varchar("management_score", { length: 50 }),
  costScore: varchar("cost_score", { length: 50 }),
  overallScore: varchar("overall_score", { length: 50 }),

  // Participants
  reviewers: jsonb("reviewers").$type<{
    name: string;
    role: string;
    vote?: "approve" | "conditional" | "reject";
    comments?: string;
  }[]>(),
  chairperson: varchar("chairperson", { length: 200 }),

  // Documentation
  presentationUrl: text("presentation_url"),
  meetingMinutes: text("meeting_minutes"),
  actionItems: jsonb("action_items").$type<{
    item: string;
    assignee: string;
    dueDate: string;
    status: "pending" | "completed";
  }[]>(),

  createdBy: varchar("created_by", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Pipeline Milestones - key milestones in the capture process
export const pipelineMilestones = pgTable("pipeline_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  pipelineId: uuid("pipeline_id").references(() => capturePipeline.id, { onDelete: "cascade" }),

  // Milestone info
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  milestoneType: varchar("milestone_type", { length: 100 }), // rfp_release, questions_due, proposal_due, award, etc.

  // Timing
  targetDate: timestamp("target_date", { withTimezone: true }),
  actualDate: timestamp("actual_date", { withTimezone: true }),
  status: varchar("status", { length: 50 }).default("pending"), // pending, completed, missed, cancelled

  // Dependencies
  dependsOn: jsonb("depends_on").$type<string[]>(), // Array of milestone IDs
  blockedBy: text("blocked_by"),

  // Ownership
  owner: varchar("owner", { length: 200 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Pipeline Relations
export const capturePipelineRelations = relations(capturePipeline, ({ one, many }) => ({
  opportunity: one(opportunities, {
    fields: [capturePipeline.opportunityId],
    references: [opportunities.id],
  }),
  activities: many(captureActivities),
  gateReviews: many(gateReviews),
  milestones: many(pipelineMilestones),
}));

export const captureActivitiesRelations = relations(captureActivities, ({ one }) => ({
  pipeline: one(capturePipeline, {
    fields: [captureActivities.pipelineId],
    references: [capturePipeline.id],
  }),
}));

export const gateReviewsRelations = relations(gateReviews, ({ one }) => ({
  pipeline: one(capturePipeline, {
    fields: [gateReviews.pipelineId],
    references: [capturePipeline.id],
  }),
}));

export const pipelineMilestonesRelations = relations(pipelineMilestones, ({ one }) => ({
  pipeline: one(capturePipeline, {
    fields: [pipelineMilestones.pipelineId],
    references: [capturePipeline.id],
  }),
}));

// Pipeline Type exports
export type CapturePipeline = typeof capturePipeline.$inferSelect;
export type NewCapturePipeline = typeof capturePipeline.$inferInsert;
export type CaptureActivity = typeof captureActivities.$inferSelect;
export type NewCaptureActivity = typeof captureActivities.$inferInsert;
export type GateReview = typeof gateReviews.$inferSelect;
export type NewGateReview = typeof gateReviews.$inferInsert;
export type PipelineMilestone = typeof pipelineMilestones.$inferSelect;
export type NewPipelineMilestone = typeof pipelineMilestones.$inferInsert;

// ============================================================================
// ======================== REVIEWS (schema-reviews.ts) =======================
// ============================================================================

/**
 * Review types following standard government proposal review methodology
 */
export type ReviewType = "pink" | "red" | "gold" | "compliance" | "final";

/**
 * Review status progression
 */
export type ReviewStatus =
	| "draft"
	| "scheduled"
	| "in_progress"
	| "completed"
	| "cancelled";

/**
 * Reviewer roles on the review team
 */
export type ReviewerRole =
	| "lead"
	| "technical"
	| "cost"
	| "compliance"
	| "general"
	| "subject_matter_expert"
	| "capture_manager";

/**
 * Comment types for categorizing feedback
 */
export type CommentType =
	| "strength"
	| "weakness"
	| "suggestion"
	| "question"
	| "critical"
	| "compliment"
	| "compliance_gap"
	| "theme_opportunity";

/**
 * Severity levels for issues
 */
export type CommentSeverity = "critical" | "major" | "minor" | "editorial";

/**
 * Resolution status for comments
 */
export type ResolutionStatus =
	| "open"
	| "in_progress"
	| "resolved"
	| "wont_fix"
	| "deferred"
	| "duplicate";

/**
 * Overall recommendation after review
 */
export type ReviewRecommendation =
	| "ready_to_submit"
	| "needs_minor_revisions"
	| "needs_major_revisions"
	| "not_ready"
	| "recommend_no_bid";

/**
 * Core review sessions for proposals.
 * Each review represents a formal review gate in the proposal process.
 */
export const proposalReviews = pgTable("proposal_reviews", {
	id: uuid("id").primaryKey().defaultRandom(),
	opportunityId: uuid("opportunity_id").notNull(),

	// Review identification
	reviewType: varchar("review_type", { length: 50 })
		.notNull()
		.$type<ReviewType>(),
	reviewName: varchar("review_name", { length: 200 }),
	description: text("description"),

	// Review number for ordering within same type
	reviewNumber: integer("review_number").default(1),

	// Timing
	scheduledDate: timestamp("scheduled_date", { withTimezone: true }),
	scheduledEndDate: timestamp("scheduled_end_date", { withTimezone: true }),
	startedAt: timestamp("started_at", { withTimezone: true }),
	completedAt: timestamp("completed_at", { withTimezone: true }),

	// Status
	status: varchar("status", { length: 50 })
		.default("draft")
		.$type<ReviewStatus>(),

	// Document version being reviewed
	documentVersionId: uuid("document_version_id"),
	documentSnapshot: text("document_snapshot"),

	// Review scope
	scopeType: varchar("scope_type", { length: 50 }).default("full"),
	scopedSections: jsonb("scoped_sections").$type<string[]>(),
	scopedVolumes: jsonb("scoped_volumes").$type<string[]>(),

	// Review instructions
	reviewInstructions: text("review_instructions"),
	focusAreas: jsonb("focus_areas").$type<string[]>(),
	evaluationCriteriaIds: jsonb("evaluation_criteria_ids").$type<string[]>(),

	// Results summary
	overallScore: real("overall_score"),
	maxPossibleScore: real("max_possible_score"),
	recommendation: varchar("recommendation", { length: 100 }).$type<ReviewRecommendation>(),
	executiveSummary: text("executive_summary"),
	keyFindings: jsonb("key_findings").$type<{
		strengths: string[];
		weaknesses: string[];
		criticalIssues: string[];
		recommendations: string[];
	}>(),

	// Statistics
	totalComments: integer("total_comments").default(0),
	criticalIssues: integer("critical_issues").default(0),
	majorIssues: integer("major_issues").default(0),
	minorIssues: integer("minor_issues").default(0),
	editorialIssues: integer("editorial_issues").default(0),
	resolvedIssues: integer("resolved_issues").default(0),
	strengthsIdentified: integer("strengths_identified").default(0),

	// Score breakdown by category
	scoreBreakdown: jsonb("score_breakdown").$type<{
		category: string;
		score: number;
		maxScore: number;
		weight: number;
	}[]>(),

	// Comparison with previous reviews
	previousReviewId: uuid("previous_review_id"),
	improvementFromPrevious: real("improvement_from_previous"),

	// Export settings
	lastExportedAt: timestamp("last_exported_at", { withTimezone: true }),
	exportFormat: varchar("export_format", { length: 50 }),

	// Metadata
	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Reviewers assigned to a review session.
 */
export const reviewers = pgTable("reviewers", {
	id: uuid("id").primaryKey().defaultRandom(),
	reviewId: uuid("review_id")
		.references(() => proposalReviews.id, { onDelete: "cascade" })
		.notNull(),

	// User identification
	userId: varchar("user_id", { length: 200 }).notNull(),
	userName: varchar("user_name", { length: 200 }),
	userEmail: varchar("user_email", { length: 300 }),

	// Role and expertise
	role: varchar("role", { length: 100 }).$type<ReviewerRole>(),
	expertise: jsonb("expertise").$type<string[]>(),
	yearsExperience: integer("years_experience"),

	// Assignment scope
	assignedSections: jsonb("assigned_sections").$type<string[]>(),
	assignedVolumes: jsonb("assigned_volumes").$type<string[]>(),
	assignedCriteria: jsonb("assigned_criteria").$type<string[]>(),

	// Review instructions specific to this reviewer
	reviewerInstructions: text("reviewer_instructions"),
	expectedCompletionDate: timestamp("expected_completion_date", {
		withTimezone: true,
	}),

	// Progress tracking
	status: varchar("status", { length: 50 }).default("pending"),
	acceptedAt: timestamp("accepted_at", { withTimezone: true }),
	declinedReason: text("declined_reason"),
	startedAt: timestamp("started_at", { withTimezone: true }),
	completedAt: timestamp("completed_at", { withTimezone: true }),

	// Progress metrics
	sectionsReviewed: integer("sections_reviewed").default(0),
	totalAssignedSections: integer("total_assigned_sections").default(0),
	commentsSubmitted: integer("comments_submitted").default(0),
	scoresSubmitted: integer("scores_submitted").default(0),

	// Conflict of interest check
	conflictOfInterest: boolean("conflict_of_interest").default(false),
	conflictNotes: text("conflict_notes"),
	conflictAcknowledgedAt: timestamp("conflict_acknowledged_at", {
		withTimezone: true,
	}),

	// Non-disclosure
	ndaSigned: boolean("nda_signed").default(false),
	ndaSignedAt: timestamp("nda_signed_at", { withTimezone: true }),

	// Reminders
	lastReminderSentAt: timestamp("last_reminder_sent_at", { withTimezone: true }),
	reminderCount: integer("reminder_count").default(0),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Detailed review comments with location tracking, severity, and resolution workflow.
 */
export const reviewComments = pgTable("review_comments", {
	id: uuid("id").primaryKey().defaultRandom(),
	reviewId: uuid("review_id")
		.references(() => proposalReviews.id, { onDelete: "cascade" })
		.notNull(),
	reviewerId: uuid("reviewer_id").references(() => reviewers.id),

	// Location in document
	sectionId: uuid("section_id"),
	volumeId: uuid("volume_id"),
	pageNumber: integer("page_number"),
	lineNumber: integer("line_number"),
	paragraphNumber: integer("paragraph_number"),
	selectedText: text("selected_text"),
	textRange: jsonb("text_range").$type<{
		start: number;
		end: number;
	}>(),

	// Comment classification
	commentType: varchar("comment_type", { length: 50 })
		.notNull()
		.$type<CommentType>(),
	severity: varchar("severity", { length: 50 }).$type<CommentSeverity>(),
	category: varchar("category", { length: 100 }),
	subcategory: varchar("subcategory", { length: 100 }),

	// Comment content
	title: varchar("title", { length: 300 }),
	comment: text("comment").notNull(),
	suggestedChange: text("suggested_change"),
	rationale: text("rationale"),

	// Reference to evaluation criteria
	evaluationCriteriaId: uuid("evaluation_criteria_id"),
	evaluationCriteriaRef: varchar("evaluation_criteria_ref", { length: 100 }),
	impactOnScore: varchar("impact_on_score", { length: 50 }),

	// Win theme connection
	relatedWinThemeId: uuid("related_win_theme_id"),
	themeAlignment: varchar("theme_alignment", { length: 50 }),

	// Tags for filtering
	tags: jsonb("tags").$type<string[]>(),

	// Resolution workflow
	resolutionStatus: varchar("resolution_status", { length: 50 })
		.default("open")
		.$type<ResolutionStatus>(),
	resolutionNotes: text("resolution_notes"),
	resolutionAction: varchar("resolution_action", { length: 100 }),
	resolvedBy: varchar("resolved_by", { length: 200 }),
	resolvedAt: timestamp("resolved_at", { withTimezone: true }),

	// Verification after resolution
	verifiedBy: varchar("verified_by", { length: 200 }),
	verifiedAt: timestamp("verified_at", { withTimezone: true }),
	verificationNotes: text("verification_notes"),

	// Reply thread
	parentCommentId: uuid("parent_comment_id"),
	replyCount: integer("reply_count").default(0),

	// Duplicate tracking
	duplicateOfId: uuid("duplicate_of_id"),
	isDuplicate: boolean("is_duplicate").default(false),

	// Anonymous for aggregation
	isAnonymous: boolean("is_anonymous").default(true),

	// Priority for resolution
	priorityRank: integer("priority_rank"),

	// Attachments
	attachments: jsonb("attachments").$type<{
		name: string;
		url: string;
		type: string;
	}[]>(),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Evaluation scores assigned during reviews.
 */
export const reviewScores = pgTable("review_scores", {
	id: uuid("id").primaryKey().defaultRandom(),
	reviewId: uuid("review_id")
		.references(() => proposalReviews.id, { onDelete: "cascade" })
		.notNull(),
	reviewerId: uuid("reviewer_id").references(() => reviewers.id),

	// Scoring area
	evaluationCriteriaId: uuid("evaluation_criteria_id"),
	evaluationCriteriaRef: varchar("evaluation_criteria_ref", { length: 100 }),
	evaluationCriteriaName: varchar("evaluation_criteria_name", { length: 300 }),

	// Section being scored
	sectionId: uuid("section_id"),
	volumeId: uuid("volume_id"),
	sectionName: varchar("section_name", { length: 300 }),

	// Score values
	score: real("score"),
	maxScore: real("max_score"),
	normalizedScore: real("normalized_score"),
	weight: real("weight").default(1),
	weightedScore: real("weighted_score"),

	// Score category (for government ratings)
	ratingCategory: varchar("rating_category", { length: 100 }),

	// Confidence in score
	confidence: real("confidence"),
	confidenceReason: text("confidence_reason"),

	// Scoring rationale
	rationale: text("rationale"),
	strengths: jsonb("strengths").$type<string[]>(),
	weaknesses: jsonb("weaknesses").$type<string[]>(),
	improvements: jsonb("improvements").$type<string[]>(),

	// Supporting evidence
	supportingCommentIds: jsonb("supporting_comment_ids").$type<string[]>(),

	// Comparison with expected score
	expectedScore: real("expected_score"),
	scoreDelta: real("score_delta"),

	// Historical comparison
	previousReviewScore: real("previous_review_score"),
	scoreChange: real("score_change"),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Templates for review sessions to standardize review processes.
 */
export const reviewTemplates = pgTable("review_templates", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: uuid("organization_id"),

	// Template identification
	name: varchar("name", { length: 200 }).notNull(),
	description: text("description"),
	reviewType: varchar("review_type", { length: 50 }).$type<ReviewType>(),

	// Default settings
	defaultDurationDays: integer("default_duration_days").default(3),
	defaultInstructions: text("default_instructions"),
	defaultFocusAreas: jsonb("default_focus_areas").$type<string[]>(),

	// Scoring template
	scoringCriteria: jsonb("scoring_criteria").$type<{
		criteriaId: string;
		criteriaName: string;
		maxScore: number;
		weight: number;
		description: string;
	}[]>(),

	// Comment categories
	commentCategories: jsonb("comment_categories").$type<string[]>(),

	// Checklists
	reviewerChecklist: jsonb("reviewer_checklist").$type<{
		item: string;
		required: boolean;
	}[]>(),

	// Workflow settings
	requiresScoring: boolean("requires_scoring").default(true),
	requiresConflictCheck: boolean("requires_conflict_check").default(true),
	requiresNDA: boolean("requires_nda").default(false),
	allowAnonymousComments: boolean("allow_anonymous_comments").default(true),

	isDefault: boolean("is_default").default(false),
	isActive: boolean("is_active").default(true),

	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Checklist items for reviewers to complete during reviews.
 */
export const reviewChecklists = pgTable("review_checklists", {
	id: uuid("id").primaryKey().defaultRandom(),
	reviewId: uuid("review_id")
		.references(() => proposalReviews.id, { onDelete: "cascade" })
		.notNull(),
	reviewerId: uuid("reviewer_id").references(() => reviewers.id),

	// Checklist item
	itemText: text("item_text").notNull(),
	itemCategory: varchar("item_category", { length: 100 }),
	sortOrder: integer("sort_order").default(0),

	// Completion status
	isCompleted: boolean("is_completed").default(false),
	completedAt: timestamp("completed_at", { withTimezone: true }),
	completedBy: varchar("completed_by", { length: 200 }),

	// Notes
	notes: text("notes"),

	// Required
	isRequired: boolean("is_required").default(false),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Reviews Relations
export const proposalReviewsRelations = relations(
	proposalReviews,
	({ many, one }) => ({
		reviewers: many(reviewers),
		comments: many(reviewComments),
		scores: many(reviewScores),
		checklists: many(reviewChecklists),
		previousReview: one(proposalReviews, {
			fields: [proposalReviews.previousReviewId],
			references: [proposalReviews.id],
		}),
	})
);

export const reviewersRelations = relations(reviewers, ({ one, many }) => ({
	review: one(proposalReviews, {
		fields: [reviewers.reviewId],
		references: [proposalReviews.id],
	}),
	comments: many(reviewComments),
	scores: many(reviewScores),
	checklists: many(reviewChecklists),
}));

export const reviewCommentsRelations = relations(
	reviewComments,
	({ one, many }) => ({
		review: one(proposalReviews, {
			fields: [reviewComments.reviewId],
			references: [proposalReviews.id],
		}),
		reviewer: one(reviewers, {
			fields: [reviewComments.reviewerId],
			references: [reviewers.id],
		}),
		parentComment: one(reviewComments, {
			fields: [reviewComments.parentCommentId],
			references: [reviewComments.id],
			relationName: "replies",
		}),
		replies: many(reviewComments, {
			relationName: "replies",
		}),
		duplicateOf: one(reviewComments, {
			fields: [reviewComments.duplicateOfId],
			references: [reviewComments.id],
			relationName: "duplicates",
		}),
	})
);

export const reviewScoresRelations = relations(reviewScores, ({ one }) => ({
	review: one(proposalReviews, {
		fields: [reviewScores.reviewId],
		references: [proposalReviews.id],
	}),
	reviewer: one(reviewers, {
		fields: [reviewScores.reviewerId],
		references: [reviewers.id],
	}),
}));

export const reviewChecklistsRelations = relations(
	reviewChecklists,
	({ one }) => ({
		review: one(proposalReviews, {
			fields: [reviewChecklists.reviewId],
			references: [proposalReviews.id],
		}),
		reviewer: one(reviewers, {
			fields: [reviewChecklists.reviewerId],
			references: [reviewers.id],
		}),
	})
);

// Reviews Type Exports
export type ProposalReview = typeof proposalReviews.$inferSelect;
export type NewProposalReview = typeof proposalReviews.$inferInsert;

export type Reviewer = typeof reviewers.$inferSelect;
export type NewReviewer = typeof reviewers.$inferInsert;

export type ReviewComment = typeof reviewComments.$inferSelect;
export type NewReviewComment = typeof reviewComments.$inferInsert;

export type ReviewScore = typeof reviewScores.$inferSelect;
export type NewReviewScore = typeof reviewScores.$inferInsert;

export type ReviewTemplate = typeof reviewTemplates.$inferSelect;
export type NewReviewTemplate = typeof reviewTemplates.$inferInsert;

export type ReviewChecklist = typeof reviewChecklists.$inferSelect;
export type NewReviewChecklist = typeof reviewChecklists.$inferInsert;

// ============================================================================
// ================ COMMENTS WORKFLOW (schema-comments-workflow.ts) ===========
// ============================================================================

export const documentComments = pgTable(
	"document_comments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		documentId: uuid("document_id")
			.notNull()
			.references(() => documents.id, { onDelete: "cascade" }),
		sectionId: uuid("section_id").references(() => documentSections.id, { onDelete: "cascade" }),
		userId: varchar("user_id", { length: 100 }).notNull(),
		content: text("content").notNull(),
		type: varchar("type", { length: 20 }).notNull().default("comment"),
		parentId: uuid("parent_id"),
		position: jsonb("position"),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
		resolvedBy: varchar("resolved_by", { length: 100 }),
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

export const documentApprovals = pgTable(
	"document_approvals",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		documentId: uuid("document_id")
			.notNull()
			.references(() => documents.id, { onDelete: "cascade" }),
		sectionId: uuid("section_id").references(() => documentSections.id, { onDelete: "cascade" }),
		proposalDocumentId: uuid("proposal_document_id").references(() => proposalDocuments.id, {
			onDelete: "cascade",
		}),
		stage: varchar("stage", { length: 20 }).notNull(),
		status: varchar("status", { length: 30 }).notNull().default("pending"),
		assignedTo: varchar("assigned_to", { length: 100 }).notNull(),
		sequenceOrder: integer("sequence_order").notNull().default(0),
		dueDate: timestamp("due_date", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		notes: text("notes"),
		rejectionReason: text("rejection_reason"),
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

export const documentWorkflows = pgTable(
	"document_workflows",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: varchar("name", { length: 200 }).notNull(),
		description: text("description"),
		stages: jsonb("stages").notNull().default([]),
		isDefault: varchar("is_default", { length: 10 }).notNull().default("false"),
		organizationId: varchar("organization_id", { length: 100 }),
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

export const workflowAssignments = pgTable(
	"workflow_assignments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		documentId: uuid("document_id")
			.notNull()
			.references(() => documents.id, { onDelete: "cascade" }),
		workflowId: uuid("workflow_id").references(() => documentWorkflows.id, {
			onDelete: "set null",
		}),
		stage: varchar("stage", { length: 20 }).notNull(),
		userId: varchar("user_id", { length: 100 }).notNull(),
		sequenceOrder: integer("sequence_order").notNull().default(0),
		dueDate: timestamp("due_date", { withTimezone: true }),
		isActive: varchar("is_active", { length: 10 }).notNull().default("true"),
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

export const commentReactions = pgTable(
	"comment_reactions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		commentId: uuid("comment_id")
			.notNull()
			.references(() => documentComments.id, { onDelete: "cascade" }),
		userId: varchar("user_id", { length: 100 }).notNull(),
		reaction: varchar("reaction", { length: 50 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("reactions_comment_user_idx").on(table.commentId, table.userId),
		index("reactions_comment_idx").on(table.commentId),
	]
);

export const commentReads = pgTable(
	"comment_reads",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		documentId: uuid("document_id")
			.notNull()
			.references(() => documents.id, { onDelete: "cascade" }),
		commentId: uuid("comment_id")
			.notNull()
			.references(() => documentComments.id, { onDelete: "cascade" }),
		userId: varchar("user_id", { length: 100 }).notNull(),
		readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("comment_reads_user_comment_idx").on(table.commentId, table.userId),
		index("comment_reads_document_idx").on(table.documentId),
		index("comment_reads_user_idx").on(table.userId),
		index("comment_reads_comment_idx").on(table.commentId),
	]
);

// Comments Workflow Relations
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

// Comments Workflow Type Exports
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

// ============================================================================
// ====================== TASKS (schema-tasks.ts) ============================
// ============================================================================

/**
 * ProposalTasks - Individual tasks for proposal development.
 */
export const proposalTasks = pgTable("proposal_tasks", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: varchar("organization_id", { length: 100 }),
	opportunityId: uuid("opportunity_id").notNull(),

	taskNumber: varchar("task_number", { length: 50 }),
	title: varchar("title", { length: 500 }).notNull(),
	description: text("description"),

	taskType: varchar("task_type", { length: 100 }).notNull(),
	taskCategory: varchar("task_category", { length: 100 }),
	sectionId: uuid("section_id"),
	requirementId: uuid("requirement_id"),
	volumeId: uuid("volume_id"),

	assignedTo: varchar("assigned_to", { length: 200 }),
	assignedToEmail: varchar("assigned_to_email", { length: 200 }),
	assignedBy: varchar("assigned_by", { length: 200 }),
	assignedAt: timestamp("assigned_at", { withTimezone: true }),

	suggestedAssignees: jsonb("suggested_assignees").$type<{
		userId: string;
		userName: string;
		matchScore: number;
		reasons: string[];
	}[]>(),

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

	dependsOn: jsonb("depends_on").$type<string[]>().default([]),
	blockedBy: jsonb("blocked_by").$type<string[]>().default([]),
	blocks: jsonb("blocks").$type<string[]>().default([]),

	status: varchar("status", { length: 50 }).default("pending"),
	priority: varchar("priority", { length: 50 }).default("medium"),
	completedAt: timestamp("completed_at", { withTimezone: true }),
	completedBy: varchar("completed_by", { length: 200 }),

	progress: integer("progress").default(0),
	wordCountTarget: integer("word_count_target"),
	wordCountCurrent: integer("word_count_current"),
	pageTarget: real("page_target"),
	pageCurrent: real("page_current"),

	qualityScore: real("quality_score"),
	lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
	lastReviewedBy: varchar("last_reviewed_by", { length: 200 }),
	reviewNotes: text("review_notes"),

	complianceRequirements: jsonb("compliance_requirements").$type<string[]>(),
	evaluationCriteriaIds: jsonb("evaluation_criteria_ids").$type<string[]>(),

	remindersSent: integer("reminders_sent").default(0),
	lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
	escalated: boolean("escalated").default(false),
	escalatedAt: timestamp("escalated_at", { withTimezone: true }),

	comments: jsonb("comments").$type<{
		id: string;
		userId: string;
		userName: string;
		content: string;
		createdAt: string;
	}[]>().default([]),

	tags: jsonb("tags").$type<string[]>().default([]),

	sourceType: varchar("source_type", { length: 50 }),
	sourceId: uuid("source_id"),

	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	organizationIdx: index("proposal_tasks_organization_idx").on(table.organizationId),
	opportunityIdx: index("proposal_tasks_opportunity_idx").on(table.opportunityId),
	assignedToIdx: index("proposal_tasks_assigned_to_idx").on(table.assignedTo),
	statusIdx: index("proposal_tasks_status_idx").on(table.status),
	dueDateIdx: index("proposal_tasks_due_date_idx").on(table.dueDate),
	priorityIdx: index("proposal_tasks_priority_idx").on(table.priority),
}));

/**
 * AuthorExpertise - Profile of author capabilities for intelligent assignment.
 */
export const authorExpertise = pgTable("author_expertise", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: varchar("user_id", { length: 200 }).notNull().unique(),
	userName: varchar("user_name", { length: 200 }).notNull(),
	userEmail: varchar("user_email", { length: 200 }),

	expertiseAreas: jsonb("expertise_areas").$type<{
		area: string;
		category: string;
		proficiency: "beginner" | "intermediate" | "advanced" | "expert";
		yearsExperience: number;
		lastUsed: string;
		projectCount: number;
	}[]>().default([]),

	averageWordsPerHour: real("average_words_per_hour"),
	qualityScoreAverage: real("quality_score_average"),
	onTimeDeliveryRate: real("on_time_delivery_rate"),
	revisionRate: real("revision_rate"),
	firstDraftAcceptanceRate: real("first_draft_acceptance_rate"),

	totalTasksCompleted: integer("total_tasks_completed").default(0),
	totalHoursLogged: real("total_hours_logged").default(0),
	tasksCompletedByType: jsonb("tasks_completed_by_type").$type<Record<string, number>>().default({}),
	tasksCompletedByCategory: jsonb("tasks_completed_by_category").$type<Record<string, number>>().default({}),

	preferredTaskTypes: jsonb("preferred_task_types").$type<string[]>().default([]),
	avoidedTaskTypes: jsonb("avoided_task_types").$type<string[]>().default([]),
	maxConcurrentTasks: integer("max_concurrent_tasks").default(5),
	preferredWorkingHours: jsonb("preferred_working_hours").$type<{
		start: string;
		end: string;
		timezone: string;
	}>(),

	availability: varchar("availability", { length: 50 }).default("available"),
	availableHoursPerWeek: real("available_hours_per_week").default(40),
	outOfOfficeDates: jsonb("out_of_office_dates").$type<{
		start: string;
		end: string;
		reason?: string;
	}[]>().default([]),

	clearanceLevel: varchar("clearance_level", { length: 100 }),
	clearanceStatus: varchar("clearance_status", { length: 50 }),

	certifications: jsonb("certifications").$type<{
		name: string;
		issuer: string;
		expirationDate?: string;
	}[]>().default([]),

	performanceTrend: varchar("performance_trend", { length: 50 }),
	lastPerformanceReview: timestamp("last_performance_review", { withTimezone: true }),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	userIdIdx: index("author_expertise_user_id_idx").on(table.userId),
	availabilityIdx: index("author_expertise_availability_idx").on(table.availability),
}));

/**
 * WorkloadSnapshots - Daily snapshots of author workload for capacity planning.
 */
export const workloadSnapshots = pgTable("workload_snapshots", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: varchar("user_id", { length: 200 }).notNull(),
	userName: varchar("user_name", { length: 200 }),

	snapshotDate: date("snapshot_date").notNull(),

	activeTasks: integer("active_tasks").default(0),
	pendingTasks: integer("pending_tasks").default(0),
	completedTasks: integer("completed_tasks").default(0),
	blockedTasks: integer("blocked_tasks").default(0),

	totalEstimatedHours: real("total_estimated_hours").default(0),
	totalActualHours: real("total_actual_hours").default(0),
	hoursLoggedToday: real("hours_logged_today").default(0),

	dueToday: integer("due_today").default(0),
	dueThisWeek: integer("due_this_week").default(0),
	overdueCount: integer("overdue_count").default(0),
	criticalTasks: integer("critical_tasks").default(0),

	availableHours: real("available_hours").default(0),
	allocatedHours: real("allocated_hours").default(0),
	utilizationRate: real("utilization_rate").default(0),
	overallocationAmount: real("overallocation_amount").default(0),

	tasksByType: jsonb("tasks_by_type").$type<Record<string, number>>().default({}),
	tasksByPriority: jsonb("tasks_by_priority").$type<Record<string, number>>().default({}),
	tasksByOpportunity: jsonb("tasks_by_opportunity").$type<Record<string, number>>().default({}),

	tasksCompletedToday: integer("tasks_completed_today").default(0),
	wordsWrittenToday: integer("words_written_today").default(0),

	workloadHealth: varchar("workload_health", { length: 50 }),
	riskLevel: varchar("risk_level", { length: 50 }),

	recommendations: jsonb("recommendations").$type<string[]>().default([]),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	userDateIdx: index("workload_snapshots_user_date_idx").on(table.userId, table.snapshotDate),
	snapshotDateIdx: index("workload_snapshots_date_idx").on(table.snapshotDate),
	healthIdx: index("workload_snapshots_health_idx").on(table.workloadHealth),
}));

/**
 * TaskTemplates - Reusable templates for common task types.
 */
export const taskTemplates = pgTable("task_templates", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: uuid("organization_id"),

	name: varchar("name", { length: 200 }).notNull(),
	description: text("description"),

	taskType: varchar("task_type", { length: 100 }).notNull(),
	taskCategory: varchar("task_category", { length: 100 }),
	defaultPriority: varchar("default_priority", { length: 50 }).default("medium"),

	estimatedHours: real("estimated_hours"),
	wordCountTarget: integer("word_count_target"),
	pageTarget: real("page_target"),

	checklist: jsonb("checklist").$type<{
		item: string;
		required: boolean;
	}[]>().default([]),

	instructions: text("instructions"),
	exampleContent: text("example_content"),
	qualityCriteria: jsonb("quality_criteria").$type<string[]>().default([]),

	suggestedDependencies: jsonb("suggested_dependencies").$type<string[]>().default([]),

	requiredExpertise: jsonb("required_expertise").$type<{
		area: string;
		minProficiency: string;
	}[]>().default([]),

	tags: jsonb("tags").$type<string[]>().default([]),

	isActive: boolean("is_active").default(true),

	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * TaskActivity - Audit log of all task changes and activities.
 */
export const taskActivity = pgTable("task_activity", {
	id: uuid("id").primaryKey().defaultRandom(),
	taskId: uuid("task_id").notNull(),

	activityType: varchar("activity_type", { length: 100 }).notNull(),
	description: text("description"),

	previousValue: text("previous_value"),
	newValue: text("new_value"),
	changeField: varchar("change_field", { length: 100 }),

	userId: varchar("user_id", { length: 200 }),
	userName: varchar("user_name", { length: 200 }),

	metadata: jsonb("metadata").$type<Record<string, unknown>>(),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
	taskIdIdx: index("task_activity_task_id_idx").on(table.taskId),
	activityTypeIdx: index("task_activity_type_idx").on(table.activityType),
	createdAtIdx: index("task_activity_created_at_idx").on(table.createdAt),
}));

/**
 * OpportunityTaskSummary - Aggregated task metrics per opportunity.
 */
export const opportunityTaskSummary = pgTable("opportunity_task_summary", {
	id: uuid("id").primaryKey().defaultRandom(),
	opportunityId: uuid("opportunity_id").notNull().unique(),

	totalTasks: integer("total_tasks").default(0),
	pendingTasks: integer("pending_tasks").default(0),
	inProgressTasks: integer("in_progress_tasks").default(0),
	completedTasks: integer("completed_tasks").default(0),
	blockedTasks: integer("blocked_tasks").default(0),
	cancelledTasks: integer("cancelled_tasks").default(0),

	criticalTasks: integer("critical_tasks").default(0),
	highPriorityTasks: integer("high_priority_tasks").default(0),
	overdueTasks: integer("overdue_tasks").default(0),

	overallProgress: integer("overall_progress").default(0),
	wordCountTotal: integer("word_count_total").default(0),
	wordCountCompleted: integer("word_count_completed").default(0),

	earliestDueDate: timestamp("earliest_due_date", { withTimezone: true }),
	latestDueDate: timestamp("latest_due_date", { withTimezone: true }),
	proposalDeadline: timestamp("proposal_deadline", { withTimezone: true }),
	daysUntilDeadline: integer("days_until_deadline"),

	uniqueAssignees: integer("unique_assignees").default(0),
	totalEstimatedHours: real("total_estimated_hours").default(0),
	totalActualHours: real("total_actual_hours").default(0),

	healthStatus: varchar("health_status", { length: 50 }).default("healthy"),
	riskFactors: jsonb("risk_factors").$type<string[]>().default([]),
	criticalPath: jsonb("critical_path").$type<string[]>().default([]),

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

// Tasks Relations
export const proposalTasksRelations = relations(proposalTasks, ({ many }) => ({
	activities: many(taskActivity),
}));

export const taskActivityRelations = relations(taskActivity, ({ one }) => ({
	task: one(proposalTasks, {
		fields: [taskActivity.taskId],
		references: [proposalTasks.id],
	}),
}));

// Tasks Types
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

// ============================================================================
// =================== PRESENTATIONS (schema-presentations.ts) ================
// ============================================================================

export const oralPresentations = pgTable("oral_presentations", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id"),
  organizationId: uuid("organization_id"),

  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),

  timeLimit: integer("time_limit"),
  qaTimeLimit: integer("qa_time_limit"),
  formatRequirements: text("format_requirements"),
  audienceDescription: text("audience_description"),
  evaluationCriteria: jsonb("evaluation_criteria").$type<{
    criterion: string;
    weight: number;
    description: string;
  }[]>(),

  sourceProposalId: uuid("source_proposal_id"),

  slideCount: integer("slide_count").default(0),
  totalDuration: integer("total_duration"),

  theme: varchar("theme", { length: 50 }).default("default"),
  customBranding: jsonb("custom_branding").$type<{
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    fontFamily?: string;
  }>(),

  status: varchar("status", { length: 50 }).default("draft"),

  presentationDate: timestamp("presentation_date", { withTimezone: true }),
  venue: varchar("venue", { length: 200 }),
  isVirtual: boolean("is_virtual").default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdBy: varchar("created_by", { length: 200 }),
});

export const presentationSlides = pgTable("presentation_slides", {
  id: uuid("id").primaryKey().defaultRandom(),
  presentationId: uuid("presentation_id"),

  slideNumber: integer("slide_number").notNull(),
  slideType: varchar("slide_type", { length: 50 }),
  title: varchar("title", { length: 200 }),

  content: jsonb("content").$type<{
    type: "text" | "bullet" | "image" | "chart" | "table" | "video" | "code" | "quote";
    data: unknown;
    position?: { x: number; y: number; width: number; height: number };
  }[]>().default([]),

  layout: varchar("layout", { length: 50 }).default("default"),
  backgroundImage: text("background_image"),
  backgroundColor: varchar("background_color", { length: 20 }),

  speakerNotes: text("speaker_notes"),
  speakerNotesHtml: text("speaker_notes_html"),
  estimatedDuration: integer("estimated_duration"),

  transitionType: varchar("transition_type", { length: 50 }).default("none"),
  transitionDuration: integer("transition_duration"),

  sourceSectionIds: jsonb("source_section_ids").$type<string[]>().default([]),
  sourceRequirementIds: jsonb("source_requirement_ids").$type<string[]>().default([]),

  annotations: jsonb("annotations").$type<{
    id: string;
    text: string;
    author: string;
    createdAt: string;
    resolved: boolean;
  }[]>().default([]),

  isHidden: boolean("is_hidden").default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const presentationQA = pgTable("presentation_qa", {
  id: uuid("id").primaryKey().defaultRandom(),
  presentationId: uuid("presentation_id"),

  likelyQuestion: text("likely_question").notNull(),
  questionCategory: varchar("question_category", { length: 100 }),
  difficulty: varchar("difficulty", { length: 20 }),
  probability: real("probability"),

  questionSource: varchar("question_source", { length: 100 }),
  relatedSlideIds: jsonb("related_slide_ids").$type<string[]>().default([]),

  suggestedAnswer: text("suggested_answer"),
  answerOutline: jsonb("answer_outline").$type<string[]>().default([]),
  keyPoints: jsonb("key_points").$type<string[]>().default([]),
  supportingEvidence: jsonb("supporting_evidence").$type<{
    evidence: string;
    source: string;
    slideId?: string;
  }[]>().default([]),

  thingsToAvoid: jsonb("things_to_avoid").$type<string[]>().default([]),

  isReviewed: boolean("is_reviewed").default(false),
  reviewedBy: varchar("reviewed_by", { length: 200 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const practiceRecordings = pgTable("practice_recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  presentationId: uuid("presentation_id"),

  recordingUrl: text("recording_url"),
  recordingType: varchar("recording_type", { length: 50 }),
  duration: integer("duration"),

  pacingAnalysis: jsonb("pacing_analysis").$type<{
    averageWPM: number;
    variationScore: number;
    tooFastSegments: { startTime: number; endTime: number }[];
    tooSlowSegments: { startTime: number; endTime: number }[];
    pauseScore: number;
  }>(),

  contentCoverage: jsonb("content_coverage").$type<{
    slideId: string;
    slideNumber: number;
    covered: boolean;
    duration: number;
    targetDuration: number;
    coverageScore: number;
  }[]>(),

  fillerWordAnalysis: jsonb("filler_word_analysis").$type<{
    word: string;
    count: number;
    timestamps: number[];
  }[]>(),

  overallScore: real("overall_score"),

  aiFeedback: text("ai_feedback"),
  recommendations: jsonb("recommendations").$type<string[]>().default([]),

  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow(),
  recordedBy: varchar("recorded_by", { length: 200 }),
});

export const presentationTeam = pgTable("presentation_team", {
  id: uuid("id").primaryKey().defaultRandom(),
  presentationId: uuid("presentation_id"),

  userId: uuid("user_id"),
  name: varchar("name", { length: 200 }).notNull(),
  role: varchar("role", { length: 100 }),

  assignedSlideIds: jsonb("assigned_slide_ids").$type<string[]>().default([]),
  assignedTopics: jsonb("assigned_topics").$type<string[]>().default([]),

  estimatedSpeakingTime: integer("estimated_speaking_time"),

  hasConfirmed: boolean("has_confirmed").default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Presentations Relations
export const oralPresentationsRelations = relations(oralPresentations, ({ many }) => ({
  slides: many(presentationSlides),
  qaItems: many(presentationQA),
  recordings: many(practiceRecordings),
  team: many(presentationTeam),
}));

export const presentationSlidesRelations = relations(presentationSlides, ({ one }) => ({
  presentation: one(oralPresentations, {
    fields: [presentationSlides.presentationId],
    references: [oralPresentations.id],
  }),
}));

export const presentationQARelations = relations(presentationQA, ({ one }) => ({
  presentation: one(oralPresentations, {
    fields: [presentationQA.presentationId],
    references: [oralPresentations.id],
  }),
}));

export const practiceRecordingsRelations = relations(practiceRecordings, ({ one }) => ({
  presentation: one(oralPresentations, {
    fields: [practiceRecordings.presentationId],
    references: [oralPresentations.id],
  }),
}));

export const presentationTeamRelations = relations(presentationTeam, ({ one }) => ({
  presentation: one(oralPresentations, {
    fields: [presentationTeam.presentationId],
    references: [oralPresentations.id],
  }),
}));

// Presentations Type exports
export type OralPresentation = typeof oralPresentations.$inferSelect;
export type NewOralPresentation = typeof oralPresentations.$inferInsert;
export type PresentationSlide = typeof presentationSlides.$inferSelect;
export type NewPresentationSlide = typeof presentationSlides.$inferInsert;
export type PresentationQA = typeof presentationQA.$inferSelect;
export type NewPresentationQA = typeof presentationQA.$inferInsert;
export type PracticeRecording = typeof practiceRecordings.$inferSelect;
export type NewPracticeRecording = typeof practiceRecordings.$inferInsert;
export type PresentationTeamMember = typeof presentationTeam.$inferSelect;
export type NewPresentationTeamMember = typeof presentationTeam.$inferInsert;
