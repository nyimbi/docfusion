/**
 * Review Management Schema - DocFusion
 *
 * Implements the Formal Review Process (Pink/Red/Gold Team)
 * for government proposal development methodology.
 *
 * Review Types:
 * - Pink Team: Initial draft review focusing on outline and compliance gaps
 * - Red Team: Full proposal review simulating government evaluation
 * - Gold Team: Final review for polish, compliance verification, win themes
 * - Compliance: Focused review on requirements traceability
 * - Final: Last look before submission
 *
 * Tables:
 * - proposalReviews: Core review sessions with scheduling and results
 * - reviewers: Assigned reviewers with roles and conflict checks
 * - reviewComments: Detailed feedback with severity and location tracking
 * - reviewScores: Evaluation scores mapped to criteria
 */

import { relations } from "drizzle-orm";
import {
	boolean,
	integer,
	jsonb,
	pgTable,
	real,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

// ============================================================================
// REVIEW TYPE ENUMERATIONS
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

// ============================================================================
// PROPOSAL REVIEWS TABLE
// ============================================================================

/**
 * Core review sessions for proposals.
 * Each review represents a formal review gate in the proposal process.
 */
export const proposalReviews = pgTable("proposal_reviews", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: varchar("organization_id", { length: 100 }),
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
	documentSnapshot: text("document_snapshot"), // Optional frozen snapshot

	// Review scope
	scopeType: varchar("scope_type", { length: 50 }).default("full"), // full, partial, section
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

// ============================================================================
// REVIEWERS TABLE
// ============================================================================

/**
 * Reviewers assigned to a review session.
 * Supports role-based assignments, section assignments, and conflict of interest tracking.
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
	status: varchar("status", { length: 50 }).default("pending"), // pending, accepted, declined, in_progress, completed
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

// ============================================================================
// REVIEW COMMENTS TABLE
// ============================================================================

/**
 * Detailed review comments with location tracking, severity, and resolution workflow.
 * Supports anonymous aggregation for unbiased review summaries.
 */
export const reviewComments = pgTable("review_comments", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: varchar("organization_id", { length: 100 }),
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
	category: varchar("category", { length: 100 }), // technical, management, cost, past_performance, etc.
	subcategory: varchar("subcategory", { length: 100 }),

	// Comment content
	title: varchar("title", { length: 300 }),
	comment: text("comment").notNull(),
	suggestedChange: text("suggested_change"),
	rationale: text("rationale"),

	// Reference to evaluation criteria
	evaluationCriteriaId: uuid("evaluation_criteria_id"),
	evaluationCriteriaRef: varchar("evaluation_criteria_ref", { length: 100 }), // e.g., "M.2.1"
	impactOnScore: varchar("impact_on_score", { length: 50 }), // high, medium, low

	// Win theme connection
	relatedWinThemeId: uuid("related_win_theme_id"),
	themeAlignment: varchar("theme_alignment", { length: 50 }), // supports, conflicts, neutral

	// Tags for filtering
	tags: jsonb("tags").$type<string[]>(),

	// Resolution workflow
	resolutionStatus: varchar("resolution_status", { length: 50 })
		.default("open")
		.$type<ResolutionStatus>(),
	resolutionNotes: text("resolution_notes"),
	resolutionAction: varchar("resolution_action", { length: 100 }), // revised, clarified, removed, kept
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

// ============================================================================
// REVIEW SCORES TABLE
// ============================================================================

/**
 * Evaluation scores assigned during reviews.
 * Maps to evaluation criteria and supports confidence-weighted aggregation.
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
	normalizedScore: real("normalized_score"), // 0-100 scale
	weight: real("weight").default(1),
	weightedScore: real("weighted_score"),

	// Score category (for government ratings)
	ratingCategory: varchar("rating_category", { length: 100 }), // outstanding, good, acceptable, marginal, unacceptable

	// Confidence in score
	confidence: real("confidence"), // 0-1 scale
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

// ============================================================================
// REVIEW TEMPLATES TABLE
// ============================================================================

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

// ============================================================================
// REVIEW CHECKLISTS TABLE
// ============================================================================

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

// ============================================================================
// RELATIONS
// ============================================================================

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

// ============================================================================
// TYPE EXPORTS
// ============================================================================

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
