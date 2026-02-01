/**
 * Content Library Extensions for Template Snippets
 *
 * Phase 1 Implementation - Extends the existing templateSnippets system with:
 * - Vector embeddings for semantic search
 * - Usage tracking with win/loss analytics
 * - Content freshness and quality scoring
 * - AI-powered auto-tagging
 *
 * This works WITH the existing templates, templateSnippets, and templatePartials
 * from schema-additions.ts rather than replacing them.
 */

import {
	pgTable,
	text,
	timestamp,
	integer,
	jsonb,
	uuid,
	varchar,
	boolean,
	real,
	index,
	uniqueIndex,
	vector,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { user, organization } from "./auth-schema";
import { documents, opportunities, templates } from "./schema";
import { templateSnippets, templatePartials } from "./schema-additions";

// ============================================================================
// Snippet Embeddings - Semantic search for existing snippets
// ============================================================================

export const snippetEmbeddings = pgTable(
	"snippet_embeddings",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Reference to template snippet */
		snippetId: uuid("snippet_id").notNull().references(() => templateSnippets.id, { onDelete: "cascade" }),
		/** Vector embedding (1536 dimensions for OpenAI ada-002) */
		embedding: vector("embedding", { dimensions: 1536 }).notNull(),
		/** Plain text version used for embedding */
		plainText: text("plain_text").notNull(),
		/** Embedding model version */
		modelVersion: varchar("model_version", { length: 50 }).notNull().default("text-embedding-ada-002"),
		/** When embedding was generated */
		generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("snippet_embeddings_snippet_idx").on(table.snippetId),
		index("snippet_embeddings_generated_idx").on(table.generatedAt),
	]
);

// ============================================================================
// Snippet Analytics - Extended metadata for content library features
// ============================================================================

export const snippetAnalytics = pgTable(
	"snippet_analytics",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Reference to template snippet */
		snippetId: uuid("snippet_id").notNull().references(() => templateSnippets.id, { onDelete: "cascade" }),

		// AI-Generated Tags & Classification
		/** AI-generated topic tags */
		aiTags: jsonb("ai_tags").notNull().default([]),
		/** AI-extracted key terms */
		keyTerms: jsonb("key_terms").notNull().default([]),
		/** Content type classification: boilerplate, capability, past_performance, solution, etc. */
		contentType: varchar("content_type", { length: 50 }),
		/** Primary topic category */
		topicCategory: varchar("topic_category", { length: 100 }),
		/** Industry sectors this applies to */
		sectors: jsonb("sectors").notNull().default([]),
		/** Technologies/capabilities covered */
		technologies: jsonb("technologies").notNull().default([]),
		/** Compliance frameworks (FAR, DFARS, HIPAA, etc.) */
		complianceFrameworks: jsonb("compliance_frameworks").notNull().default([]),
		/** Relevance scores by topic (computed by AI) */
		topicScores: jsonb("topic_scores").notNull().default({}),

		// Quality & Freshness
		/** Freshness status: current, review_needed, stale, archived */
		freshnessStatus: varchar("freshness_status", { length: 20 }).notNull().default("current"),
		/** Date when content should be reviewed */
		reviewDueDate: timestamp("review_due_date", { withTimezone: true }),
		/** Last review date */
		lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
		/** Quality score based on usage outcomes (0-100) */
		qualityScore: real("quality_score"),
		/** Word count */
		wordCount: integer("word_count").notNull().default(0),

		// Win/Loss Tracking
		/** Times used in winning proposals */
		winCount: integer("win_count").notNull().default(0),
		/** Times used in losing proposals */
		lossCount: integer("loss_count").notNull().default(0),
		/** Calculated win rate */
		winRate: real("win_rate"),
		/** Last time this content was used */
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

		// Metadata
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("snippet_analytics_snippet_idx").on(table.snippetId),
		index("snippet_analytics_type_idx").on(table.contentType),
		index("snippet_analytics_freshness_idx").on(table.freshnessStatus),
		index("snippet_analytics_quality_idx").on(table.qualityScore),
		index("snippet_analytics_win_rate_idx").on(table.winRate),
	]
);

// ============================================================================
// Snippet Usage Log - Track every use with outcome
// ============================================================================

export const snippetUsageLog = pgTable(
	"snippet_usage_log",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Snippet that was used */
		snippetId: uuid("snippet_id").notNull().references(() => templateSnippets.id, { onDelete: "cascade" }),
		/** Document where snippet was used */
		documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
		/** Opportunity context (for win/loss tracking) */
		opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),

		// Usage Details
		/** How it was used: inserted, referenced, adapted */
		usageType: varchar("usage_type", { length: 30 }).notNull().default("inserted"),
		/** Section in document where used */
		documentSection: varchar("document_section", { length: 200 }),
		/** Whether content was modified when used */
		wasModified: boolean("was_modified").notNull().default(false),

		// Outcome (updated later when proposal outcome is known)
		/** Outcome: pending, won, lost, no_decision, cancelled */
		proposalOutcome: varchar("proposal_outcome", { length: 30 }).notNull().default("pending"),
		/** When outcome was recorded */
		outcomeRecordedAt: timestamp("outcome_recorded_at", { withTimezone: true }),

		// Context
		/** User who used the snippet */
		usedBy: varchar("used_by", { length: 100 }).notNull(),
		/** How snippet was found: search, browse, suggestion */
		discoveryMethod: varchar("discovery_method", { length: 30 }),
		/** Search query if found via search */
		searchQuery: text("search_query"),

		// Metadata
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("snippet_usage_snippet_idx").on(table.snippetId),
		index("snippet_usage_document_idx").on(table.documentId),
		index("snippet_usage_opportunity_idx").on(table.opportunityId),
		index("snippet_usage_outcome_idx").on(table.proposalOutcome),
		index("snippet_usage_used_by_idx").on(table.usedBy),
		index("snippet_usage_created_idx").on(table.createdAt),
	]
);

// ============================================================================
// Template Embeddings - Semantic search for full templates
// ============================================================================

export const templateEmbeddings = pgTable(
	"template_embeddings",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Reference to template */
		templateId: uuid("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),
		/** Vector embedding */
		embedding: vector("embedding", { dimensions: 1536 }).notNull(),
		/** Plain text version used for embedding */
		plainText: text("plain_text").notNull(),
		/** Embedding model version */
		modelVersion: varchar("model_version", { length: 50 }).notNull().default("text-embedding-ada-002"),
		/** When embedding was generated */
		generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("template_embeddings_template_idx").on(table.templateId),
	]
);

// ============================================================================
// Template Analytics - Win/loss and usage tracking for templates
// ============================================================================

export const templateAnalytics = pgTable(
	"template_analytics",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Reference to template */
		templateId: uuid("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),

		// AI Classification
		/** AI-generated topic tags */
		aiTags: jsonb("ai_tags").notNull().default([]),
		/** Industries this template suits */
		industries: jsonb("industries").notNull().default([]),
		/** RFP types this template suits */
		rfpTypes: jsonb("rfp_types").notNull().default([]),

		// Win/Loss Tracking
		/** Times used in winning proposals */
		winCount: integer("win_count").notNull().default(0),
		/** Times used in losing proposals */
		lossCount: integer("loss_count").notNull().default(0),
		/** Calculated win rate */
		winRate: real("win_rate"),
		/** Average evaluator score when used (if available) */
		averageEvaluatorScore: real("average_evaluator_score"),

		// Quality Metrics
		/** Average quality score of documents using this template */
		averageQualityScore: real("average_quality_score"),
		/** User satisfaction rating (1-5) */
		userSatisfaction: real("user_satisfaction"),

		// Metadata
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("template_analytics_template_idx").on(table.templateId),
		index("template_analytics_win_rate_idx").on(table.winRate),
	]
);

// ============================================================================
// Template Usage Log - Track template use with outcome
// ============================================================================

export const templateUsageLog = pgTable(
	"template_usage_log",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Template that was used */
		templateId: uuid("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),
		/** Document created from template */
		documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
		/** Opportunity context */
		opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),

		// Outcome
		/** Outcome: pending, won, lost, no_decision, cancelled */
		proposalOutcome: varchar("proposal_outcome", { length: 30 }).notNull().default("pending"),
		/** When outcome was recorded */
		outcomeRecordedAt: timestamp("outcome_recorded_at", { withTimezone: true }),
		/** Evaluator feedback if available */
		evaluatorFeedback: text("evaluator_feedback"),

		// Usage Context
		/** User who used the template */
		usedBy: varchar("used_by", { length: 100 }).notNull(),

		// Metadata
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("template_usage_template_idx").on(table.templateId),
		index("template_usage_document_idx").on(table.documentId),
		index("template_usage_opportunity_idx").on(table.opportunityId),
		index("template_usage_outcome_idx").on(table.proposalOutcome),
	]
);

// ============================================================================
// Content Suggestions - AI recommendations for snippets/templates
// ============================================================================

export const contentSuggestions = pgTable(
	"content_suggestions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Document where suggestion is made */
		documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
		/** Opportunity context */
		opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
		/** Suggested snippet (mutually exclusive with templateId) */
		snippetId: uuid("snippet_id").references(() => templateSnippets.id, { onDelete: "cascade" }),
		/** Suggested template (mutually exclusive with snippetId) */
		templateId: uuid("template_id").references(() => templates.id, { onDelete: "cascade" }),

		// Suggestion Context
		/** Section in document */
		documentSection: varchar("document_section", { length: 200 }),
		/** Context text that triggered suggestion */
		contextText: text("context_text"),
		/** Relevance score (0-100) */
		relevanceScore: real("relevance_score").notNull(),
		/** Confidence: high, medium, low */
		confidence: varchar("confidence", { length: 20 }).notNull(),
		/** Reasoning for suggestion */
		reasoning: text("reasoning"),

		// User Action
		/** Action: pending, accepted, rejected, ignored */
		userAction: varchar("user_action", { length: 20 }).notNull().default("pending"),
		/** When action was taken */
		actionAt: timestamp("action_at", { withTimezone: true }),
		/** User who took action */
		actionBy: varchar("action_by", { length: 100 }),

		// Learning feedback
		/** Was this helpful (for model training) */
		wasHelpful: boolean("was_helpful"),

		// Metadata
		modelVersion: varchar("model_version", { length: 50 }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("suggestions_document_idx").on(table.documentId),
		index("suggestions_snippet_idx").on(table.snippetId),
		index("suggestions_template_idx").on(table.templateId),
		index("suggestions_action_idx").on(table.userAction),
		index("suggestions_relevance_idx").on(table.relevanceScore),
	]
);

// ============================================================================
// Partial Embeddings - Semantic search for partials
// ============================================================================

export const partialEmbeddings = pgTable(
	"partial_embeddings",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Reference to template partial */
		partialId: uuid("partial_id").notNull().references(() => templatePartials.id, { onDelete: "cascade" }),
		/** Vector embedding */
		embedding: vector("embedding", { dimensions: 1536 }).notNull(),
		/** Plain text version */
		plainText: text("plain_text").notNull(),
		/** Embedding model version */
		modelVersion: varchar("model_version", { length: 50 }).notNull().default("text-embedding-ada-002"),
		generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("partial_embeddings_partial_idx").on(table.partialId),
	]
);

// ============================================================================
// Relations
// ============================================================================

export const snippetEmbeddingsRelations = relations(snippetEmbeddings, ({ one }) => ({
	snippet: one(templateSnippets, {
		fields: [snippetEmbeddings.snippetId],
		references: [templateSnippets.id],
	}),
}));

export const snippetAnalyticsRelations = relations(snippetAnalytics, ({ one }) => ({
	snippet: one(templateSnippets, {
		fields: [snippetAnalytics.snippetId],
		references: [templateSnippets.id],
	}),
}));

export const snippetUsageLogRelations = relations(snippetUsageLog, ({ one }) => ({
	snippet: one(templateSnippets, {
		fields: [snippetUsageLog.snippetId],
		references: [templateSnippets.id],
	}),
	document: one(documents, {
		fields: [snippetUsageLog.documentId],
		references: [documents.id],
	}),
	opportunity: one(opportunities, {
		fields: [snippetUsageLog.opportunityId],
		references: [opportunities.id],
	}),
	user: one(user, {
		fields: [snippetUsageLog.usedBy],
		references: [user.id],
	}),
}));

export const templateEmbeddingsRelations = relations(templateEmbeddings, ({ one }) => ({
	template: one(templates, {
		fields: [templateEmbeddings.templateId],
		references: [templates.id],
	}),
}));

export const templateAnalyticsRelations = relations(templateAnalytics, ({ one }) => ({
	template: one(templates, {
		fields: [templateAnalytics.templateId],
		references: [templates.id],
	}),
}));

export const templateUsageLogRelations = relations(templateUsageLog, ({ one }) => ({
	template: one(templates, {
		fields: [templateUsageLog.templateId],
		references: [templates.id],
	}),
	document: one(documents, {
		fields: [templateUsageLog.documentId],
		references: [documents.id],
	}),
	opportunity: one(opportunities, {
		fields: [templateUsageLog.opportunityId],
		references: [opportunities.id],
	}),
	user: one(user, {
		fields: [templateUsageLog.usedBy],
		references: [user.id],
	}),
}));

export const contentSuggestionsRelations = relations(contentSuggestions, ({ one }) => ({
	document: one(documents, {
		fields: [contentSuggestions.documentId],
		references: [documents.id],
	}),
	opportunity: one(opportunities, {
		fields: [contentSuggestions.opportunityId],
		references: [opportunities.id],
	}),
	snippet: one(templateSnippets, {
		fields: [contentSuggestions.snippetId],
		references: [templateSnippets.id],
	}),
	template: one(templates, {
		fields: [contentSuggestions.templateId],
		references: [templates.id],
	}),
	actor: one(user, {
		fields: [contentSuggestions.actionBy],
		references: [user.id],
	}),
}));

export const partialEmbeddingsRelations = relations(partialEmbeddings, ({ one }) => ({
	partial: one(templatePartials, {
		fields: [partialEmbeddings.partialId],
		references: [templatePartials.id],
	}),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type SnippetEmbeddingRow = typeof snippetEmbeddings.$inferSelect;
export type NewSnippetEmbedding = typeof snippetEmbeddings.$inferInsert;

export type SnippetAnalyticsRow = typeof snippetAnalytics.$inferSelect;
export type NewSnippetAnalytics = typeof snippetAnalytics.$inferInsert;

export type SnippetUsageLogRow = typeof snippetUsageLog.$inferSelect;
export type NewSnippetUsageLog = typeof snippetUsageLog.$inferInsert;

export type TemplateEmbeddingRow = typeof templateEmbeddings.$inferSelect;
export type NewTemplateEmbedding = typeof templateEmbeddings.$inferInsert;

export type TemplateAnalyticsRow = typeof templateAnalytics.$inferSelect;
export type NewTemplateAnalytics = typeof templateAnalytics.$inferInsert;

export type TemplateUsageLogRow = typeof templateUsageLog.$inferSelect;
export type NewTemplateUsageLog = typeof templateUsageLog.$inferInsert;

export type ContentSuggestionRow = typeof contentSuggestions.$inferSelect;
export type NewContentSuggestion = typeof contentSuggestions.$inferInsert;

export type PartialEmbeddingRow = typeof partialEmbeddings.$inferSelect;
export type NewPartialEmbedding = typeof partialEmbeddings.$inferInsert;

// ============================================================================
// Enums
// ============================================================================

export const CONTENT_TYPES = [
	"boilerplate",
	"capability",
	"past_performance",
	"solution",
	"approach",
	"bio",
	"methodology",
	"executive_summary",
	"management_approach",
	"technical_approach",
	"staffing",
	"quality_assurance",
	"risk_management",
	"transition",
	"other",
] as const;

export const FRESHNESS_STATUSES = [
	"current",
	"review_needed",
	"stale",
	"archived",
] as const;

export const USAGE_TYPES = [
	"inserted",
	"referenced",
	"adapted",
] as const;

export const PROPOSAL_OUTCOMES = [
	"pending",
	"won",
	"lost",
	"no_decision",
	"cancelled",
] as const;

export const SUGGESTION_ACTIONS = [
	"pending",
	"accepted",
	"rejected",
	"ignored",
] as const;

export const CONFIDENCE_LEVELS = [
	"high",
	"medium",
	"low",
] as const;

export const DISCOVERY_METHODS = [
	"search",
	"browse",
	"suggestion",
	"direct",
] as const;

export type ContentType = typeof CONTENT_TYPES[number];
export type FreshnessStatus = typeof FRESHNESS_STATUSES[number];
export type UsageType = typeof USAGE_TYPES[number];
export type ProposalOutcome = typeof PROPOSAL_OUTCOMES[number];
export type SuggestionAction = typeof SUGGESTION_ACTIONS[number];
export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number];
export type DiscoveryMethod = typeof DISCOVERY_METHODS[number];
