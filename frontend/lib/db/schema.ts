/**
 * Database schema for DocFusion using Drizzle ORM.
 *
 * This defines the PostgreSQL tables for documents, templates, and related entities.
 * Using PostgreSQL-native features like JSONB for content storage and full-text search.
 */

// Re-export auth schema so Drizzle sees all tables
export * from "./auth-schema";

// ============================================================================
// Domain Schema Re-exports (consolidated into 5 domains)
// ============================================================================
// Individual schema files are preserved for backward compatibility.
// New code should prefer importing from "./domains" for a stable surface.

// Domain 1: Core — Documents, RFP, Templates, Content Library
export * from "./schema-rfp";
export * from "./schema-additions";
export * from "./schema-content-library";
export * from "./schema-graphics";
export * from "./schema-formatting";

// Domain 2: CRM — Accounts, Contacts, Companies, Partners, Pipeline
export * from "./schema-crm";
export * from "./schema-company";
export * from "./schema-partners";
export * from "./schema-pipeline";

// Domain 3: Intelligence — Evidence, Competitors, Win Themes, PWin
export * from "./schema-evidence";
export * from "./schema-competitors";
export * from "./schema-win-themes";
export * from "./schema-pwin";
export * from "./schema-past-performance";

// Domain 4: Workflow — Tasks, Reviews, Comments, Presentations
export * from "./schema-tasks";
export * from "./schema-reviews";
export * from "./schema-comments-workflow";
export * from "./schema-workflow-runtime";
export * from "./schema-presentations";
export * from "./schema-winloss";

// Domain 5: Integration — Import, Scraper, Bibliography, Pricing, Personnel
export * from "./schema-import";
export * from "./schema-scraper";
export * from "./schema-bibliography";
export * from "./schema-pricing";
export * from "./schema-personnel";

import { user } from "./auth-schema";

import {
	pgTable,
	pgEnum,
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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// Documents
// ============================================================================

export const documents = pgTable(
	"documents",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		title: varchar("title", { length: 500 }).notNull(),
		/** Tiptap JSONContent stored as JSONB */
		content: jsonb("content").notNull().default({ type: "doc", content: [{ type: "paragraph" }] }),
		/** Plain text extracted for full-text search */
		plainText: text("plain_text"),
		status: varchar("status", { length: 20 }).notNull().default("draft"),
		visibility: varchar("visibility", { length: 20 }).notNull().default("private"),
		ownerId: varchar("owner_id", { length: 100 }).notNull().default("system"),
		templateId: uuid("template_id"),
		tags: jsonb("tags").notNull().default([]),
		wordCount: integer("word_count").notNull().default(0),
		characterCount: integer("character_count").notNull().default(0),
		currentVersion: integer("current_version").notNull().default(1),
		collaboratorIds: jsonb("collaborator_ids").notNull().default([]),
		/** Extended metadata (RFP fields, AI analysis, etc.) */
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
		lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
	},
	(table) => [
		index("documents_owner_idx").on(table.ownerId),
		index("documents_status_idx").on(table.status),
		index("documents_updated_idx").on(table.updatedAt),
		index("documents_template_idx").on(table.templateId),
	]
);

export const documentVersions = pgTable(
	"document_versions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
		versionNumber: integer("version_number").notNull(),
		content: jsonb("content").notNull(),
		changeDescription: text("change_description"),
		/** Base64-encoded Yjs state for CRDT sync */
		yjsState: text("yjs_state"),
		yjsStateVector: text("yjs_state_vector"),
		createdBy: varchar("created_by", { length: 100 }).notNull().default("system"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("versions_document_idx").on(table.documentId),
		uniqueIndex("versions_document_version_idx").on(table.documentId, table.versionNumber),
	]
);

// ============================================================================
// Templates
// ============================================================================

export const templateCategories = pgTable(
	"template_categories",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: varchar("name", { length: 100 }).notNull(),
		description: text("description"),
		slug: varchar("slug", { length: 100 }).notNull(),
		parentId: uuid("parent_id"),
		icon: varchar("icon", { length: 50 }),
		order: integer("order").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("categories_slug_idx").on(table.slug),
		index("categories_parent_idx").on(table.parentId),
	]
);

export const templates = pgTable(
	"templates",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: varchar("name", { length: 500 }).notNull(),
		description: text("description").notNull().default(""),
		/** Tiptap JSONContent stored as JSONB */
		content: jsonb("content").notNull().default({ type: "doc", content: [{ type: "paragraph" }] }),
		status: varchar("status", { length: 20 }).notNull().default("draft"),
		visibility: varchar("visibility", { length: 20 }).notNull().default("private"),
		createdBy: varchar("created_by", { length: 100 }).notNull().default("system"),
		categoryIds: jsonb("category_ids").notNull().default([]),
		tags: jsonb("tags").notNull().default([]),
		/** Placeholder field definitions */
		placeholders: jsonb("placeholders").notNull().default([]),
		/** AI generation instructions */
		aiInstructions: jsonb("ai_instructions").notNull().default([]),
		/** Compliance requirements */
		complianceRequirements: jsonb("compliance_requirements").notNull().default([]),
		useCount: integer("use_count").notNull().default(0),
		rating: real("rating"),
		ratingCount: integer("rating_count").notNull().default(0),
		previewImageUrl: text("preview_image_url"),
		estimatedTime: integer("estimated_time"),
		difficulty: varchar("difficulty", { length: 20 }),
		/** Default metadata for documents created from this template */
		defaultMetadata: jsonb("default_metadata"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("templates_status_idx").on(table.status),
		index("templates_visibility_idx").on(table.visibility),
		index("templates_use_count_idx").on(table.useCount),
		index("templates_updated_idx").on(table.updatedAt),
	]
);

// ============================================================================
// Yjs Collaboration State
// ============================================================================

export const documentYjsStates = pgTable(
	"document_yjs_states",
	{
		documentId: uuid("document_id").primaryKey().references(() => documents.id, { onDelete: "cascade" }),
		/** Base64-encoded Yjs document state */
		state: text("state").notNull(),
		/** State vector for incremental sync */
		stateVector: text("state_vector").notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	}
);

// ============================================================================
// Relations
// ============================================================================

export const documentsRelations = relations(documents, ({ one, many }) => ({
	template: one(templates, {
		fields: [documents.templateId],
		references: [templates.id],
	}),
	versions: many(documentVersions),
	yjsState: one(documentYjsStates, {
		fields: [documents.id],
		references: [documentYjsStates.documentId],
	}),
}));

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
	document: one(documents, {
		fields: [documentVersions.documentId],
		references: [documents.id],
	}),
}));

export const templateCategoriesRelations = relations(templateCategories, ({ one, many }) => ({
	parent: one(templateCategories, {
		fields: [templateCategories.parentId],
		references: [templateCategories.id],
		relationName: "parentChild",
	}),
	children: many(templateCategories, { relationName: "parentChild" }),
}));

// ============================================================================
// Document Collaboration
// ============================================================================

export const documentCollaborators = pgTable(
	"document_collaborators",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		documentId: uuid("document_id")
			.notNull()
			.references(() => documents.id, { onDelete: "cascade" }),
		userId: varchar("user_id", { length: 100 }).notNull(),
		role: varchar("role", { length: 20 }).notNull().default("editor"),
		isActive: boolean("is_active").notNull().default(true),
		joinedAt: timestamp("joined_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
	},
	(table) => [
		index("collaborators_document_idx").on(table.documentId),
		index("collaborators_user_idx").on(table.userId),
		uniqueIndex("collaborators_document_user_idx").on(
			table.documentId,
			table.userId,
		),
	],
);

export const documentCollaboratorsRelations = relations(
	documentCollaborators,
	({ one }) => ({
		document: one(documents, {
			fields: [documentCollaborators.documentId],
			references: [documents.id],
		}),
	}),
);

// ============================================================================
// Type exports for TypeScript inference
// ============================================================================

export type DocumentRow = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type DocumentVersionRow = typeof documentVersions.$inferSelect;
export type NewDocumentVersion = typeof documentVersions.$inferInsert;

export type DocumentCollaboratorRow = typeof documentCollaborators.$inferSelect;
export type NewDocumentCollaborator = typeof documentCollaborators.$inferInsert;

export type TemplateCategoryRow = typeof templateCategories.$inferSelect;
export type NewTemplateCategory = typeof templateCategories.$inferInsert;

export type TemplateRow = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;

export type DocumentYjsStateRow = typeof documentYjsStates.$inferSelect;
export type NewDocumentYjsState = typeof documentYjsStates.$inferInsert;

// ============================================================================
// Opportunities (RFPs, EOIs, Tenders)
// ============================================================================

export const opportunities = pgTable(
	"opportunities",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Original ID from spreadsheet (e.g., "RFP-085", "AFR-066") */
		sourceId: varchar("source_id", { length: 50 }),
		title: varchar("title", { length: 1000 }).notNull(),
		/** Category of opportunity (e.g., "GIS", "Digital Transformation", "Cybersecurity") */
		category: varchar("category", { length: 200 }),
		/** More specific IT category if applicable */
		itCategory: varchar("it_category", { length: 200 }),
		/** Sector (e.g., "Government/SOE", "NGO", "Commercial") */
		sector: varchar("sector", { length: 100 }),
		/** Country or region */
		countryRegion: varchar("country_region", { length: 200 }),
		/** Organization or client name */
		organization: varchar("organization", { length: 500 }),
		/** Funder if different from organization */
		funder: varchar("funder", { length: 500 }),
		/** Deadline date */
		deadline: timestamp("deadline", { withTimezone: true }),
		/** Days left until deadline (can be negative if expired) */
		daysLeft: integer("days_left"),
		/** Whether the opportunity has expired */
		isExpired: boolean("is_expired").notNull().default(false),
		/** Budget/value as string (varied currency formats) */
		budgetValue: varchar("budget_value", { length: 200 }),
		/** Estimated numeric budget value for sorting/filtering */
		budgetNumeric: real("budget_numeric"),
		/** Budget currency */
		budgetCurrency: varchar("budget_currency", { length: 10 }),
		/** Project summary/description */
		projectSummary: text("project_summary"),
		/** Full project scope and deliverables */
		projectScope: text("project_scope"),
		/** Key requirements */
		keyRequirements: text("key_requirements"),
		/** Technical stack/requirements */
		technicalRequirements: text("technical_requirements"),
		/** Submission method */
		submissionMethod: varchar("submission_method", { length: 200 }),
		/** Submission requirements */
		submissionRequirements: text("submission_requirements"),
		/** Link to RFP/EOI document */
		rfpLink: text("rfp_link"),
		/** Source platform */
		sourcePlatform: varchar("source_platform", { length: 200 }),
		/** Original spreadsheet filename */
		sourceFile: varchar("source_file", { length: 500 }),
		/** Type of opportunity */
		opportunityType: varchar("opportunity_type", { length: 50 }).notNull().default("rfp"),

		// Scraper Integration Fields
		/** Scraper source identifier (e.g., "ungm", "afdb", "kenya_ppip") */
		source: varchar("source", { length: 50 }),
		/** SHA256 fingerprint for deduplication (hash of title+org+deadline) */
		fingerprint: varchar("fingerprint", { length: 64 }),
		/** Notice/tender ID from source portal */
		noticeId: varchar("notice_id", { length: 100 }),
		/** Link to portal page */
		portalUrl: text("portal_url"),
		/** Link to tender documents */
		documentUrl: text("document_url"),
		/** When the opportunity was scraped */
		scrapedAt: timestamp("scraped_at", { withTimezone: true }),
		/** Published/posted date from source */
		publishedDate: timestamp("published_date", { withTimezone: true }),

		// Ranking & Analysis Fields
		/** Manual priority ranking (1-5, 5 being highest priority) */
		priorityRank: integer("priority_rank").default(3),
		/** AI-calculated fit score (0-100) */
		fitScore: real("fit_score"),
		/** Win probability estimate (0-100) */
		winProbability: real("win_probability"),
		/** Revenue potential category */
		revenuePotential: varchar("revenue_potential", { length: 20 }),
		/** Strategic alignment notes */
		strategicNotes: text("strategic_notes"),
		/** Decision status */
		decisionStatus: varchar("decision_status", { length: 50 }).notNull().default("pending"),
		/** Reason for decision */
		decisionReason: text("decision_reason"),
		/** Assigned team member */
		assignedTo: varchar("assigned_to", { length: 200 }),

		// Processing metadata
		/** Whether this opportunity has been reviewed */
		isReviewed: boolean("is_reviewed").notNull().default(false),
		/** Tags for categorization */
		tags: jsonb("tags").notNull().default([]),
		/** Extended metadata */
		metadata: jsonb("metadata"),
		/** General notes and unmapped import data */
		notes: text("notes"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
		importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),

		// Document Management Fields
		/** Whether documents have been discovered */
		documentsDiscovered: boolean("documents_discovered").default(false),
		/** When documents were discovered */
		documentsDiscoveredAt: timestamp("documents_discovered_at", { withTimezone: true }),
		/** Count of downloaded documents */
		documentsDownloadedCount: integer("documents_downloaded_count").default(0),
		/** When last document scan occurred */
		lastDocumentScanAt: timestamp("last_document_scan_at", { withTimezone: true }),

		// Full-Text Search
		/** Pre-computed tsvector for full-text search */
		searchVector: text("search_vector"),
	},
	(table) => [
		index("opportunities_deadline_idx").on(table.deadline),
		index("opportunities_category_idx").on(table.category),
		index("opportunities_country_idx").on(table.countryRegion),
		index("opportunities_status_idx").on(table.decisionStatus),
		index("opportunities_priority_idx").on(table.priorityRank),
		index("opportunities_fit_score_idx").on(table.fitScore),
		index("opportunities_source_idx").on(table.sourceFile),
		index("opportunities_expired_idx").on(table.isExpired),
		uniqueIndex("opportunities_source_id_file_idx").on(table.sourceId, table.sourceFile),
		// Scraper deduplication indexes
		uniqueIndex("opportunities_fingerprint_idx").on(table.fingerprint),
		index("opportunities_source_source_id_idx").on(table.source, table.sourceId),
		index("opportunities_scraped_at_idx").on(table.scrapedAt),
		// Full-text search indexes
		index("opportunities_search_vector_idx").using("gin", table.searchVector),
	]
);

// ============================================================================
// Saved Searches
// ============================================================================

export const savedSearches = pgTable(
	"saved_searches",
	{
		id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id").notNull(),
		name: text("name").notNull(),
		/** JSONB payload containing filters */
		filters: jsonb("filters").notNull(),
		sort: jsonb("sort"),
		description: text("description"),
		isDefault: boolean("is_default").default(false).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("saved_searches_user_idx").on(table.userId),
	]
);

export type SavedSearchRow = typeof savedSearches.$inferSelect;
export type NewSavedSearch = typeof savedSearches.$inferInsert;

// ============================================================================
// Opportunity Import History
// ============================================================================

export const opportunityImports = pgTable(
	"opportunity_imports",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Original filename */
		filename: varchar("filename", { length: 500 }).notNull(),
		/** File path if stored */
		filePath: text("file_path"),
		/** Number of records in file */
		totalRecords: integer("total_records").notNull().default(0),
		/** Number of successfully imported records */
		importedRecords: integer("imported_records").notNull().default(0),
		/** Number of updated records (already existed) */
		updatedRecords: integer("updated_records").notNull().default(0),
		/** Number of skipped records */
		skippedRecords: integer("skipped_records").notNull().default(0),
		/** Number of failed records */
		failedRecords: integer("failed_records").notNull().default(0),
		/** Import status */
		status: varchar("status", { length: 20 }).notNull().default("pending"),
		/** Error messages if any */
		errors: jsonb("errors").default([]),
		/** Import configuration used */
		config: jsonb("config"),
		/** Who initiated the import */
		importedBy: varchar("imported_by", { length: 200 }).notNull().default("system"),
		startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		index("imports_status_idx").on(table.status),
		index("imports_started_idx").on(table.startedAt),
	]
);

// ============================================================================
// Go/No-Go Votes
// ============================================================================

export const opportunityVotes = pgTable(
	"opportunity_votes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
		/** User who cast the vote */
		userId: varchar("user_id", { length: 100 }).notNull(),
		/** Display name of user */
		userName: varchar("user_name", { length: 200 }),
		/** Vote decision: "go", "no_go", or "abstain" */
		vote: varchar("vote", { length: 20 }).notNull(),
		/** Confidence level (1-5, where 5 is highest) */
		confidence: integer("confidence"),
		/** Reasoning for the vote */
		justification: text("justification"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("votes_opportunity_idx").on(table.opportunityId),
		uniqueIndex("votes_opportunity_user_idx").on(table.opportunityId, table.userId),
	]
);

// ============================================================================
// AI Scoring History
// ============================================================================

export const opportunityAIScores = pgTable(
	"opportunity_ai_scores",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
		/** Type of score: "fit", "win_probability", "risk", "effort" */
		scoreType: varchar("score_type", { length: 50 }).notNull(),
		/** Score value (0-100) */
		score: real("score").notNull(),
		/** Detailed breakdown of scoring factors */
		factors: jsonb("factors").notNull().default([]),
		/** AI model version used for scoring */
		modelVersion: varchar("model_version", { length: 50 }),
		/** Raw AI response/reasoning */
		reasoning: text("reasoning"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("ai_scores_opportunity_idx").on(table.opportunityId),
		index("ai_scores_type_idx").on(table.scoreType),
		index("ai_scores_created_idx").on(table.createdAt),
	]
);

// ============================================================================
// Requirements (extracted from RFP documents)
// ============================================================================


// ============================================================================
// Proposal Documents (link opportunities to documents)
// ============================================================================

export const proposalDocuments = pgTable(
	"proposal_documents",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
		documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
		/** Document type in proposal context */
		documentType: varchar("document_type", { length: 50 }).notNull(),
		/** Order in final proposal */
		sectionOrder: integer("section_order").notNull().default(0),
		/** Development status */
		status: varchar("status", { length: 30 }).notNull().default("not_started"),
		/** User responsible for this section */
		assignedTo: varchar("assigned_to", { length: 200 }),
		/** Target completion date */
		dueDate: timestamp("due_date", { withTimezone: true }),
		/** User reviewing this section */
		reviewerId: varchar("reviewer_id", { length: 200 }),
		/** User who approved */
		approvedBy: varchar("approved_by", { length: 200 }),
		/** Approval timestamp */
		approvedAt: timestamp("approved_at", { withTimezone: true }),
		/** Latest AI quality score (0-100) */
		aiAnalysisScore: real("ai_analysis_score"),
		/** When AI analysis was last run */
		aiAnalysisAt: timestamp("ai_analysis_at", { withTimezone: true }),
		/** Development notes */
		notes: text("notes"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("proposal_docs_opportunity_idx").on(table.opportunityId),
		index("proposal_docs_document_idx").on(table.documentId),
		index("proposal_docs_status_idx").on(table.status),
		uniqueIndex("proposal_docs_opp_doc_idx").on(table.opportunityId, table.documentId),
	]
);

// ============================================================================
// Document Sections (track progress within proposal documents)
// ============================================================================

export const documentSections = pgTable(
	"document_sections",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		proposalDocumentId: uuid("proposal_document_id").notNull().references(() => proposalDocuments.id, { onDelete: "cascade" }),
		/** Section name/title */
		sectionName: varchar("section_name", { length: 200 }).notNull(),
		/** Order within document */
		sectionOrder: integer("section_order").notNull().default(0),
		/** Development status */
		status: varchar("status", { length: 30 }).notNull().default("not_started"),
		/** Current word count */
		wordCount: integer("word_count").notNull().default(0),
		/** Target word count */
		targetWordCount: integer("target_word_count"),
		/** User responsible for this section */
		assignedTo: varchar("assigned_to", { length: 200 }),
		/** Target completion date */
		dueDate: timestamp("due_date", { withTimezone: true }),
		/** Requirements addressed by this section */
		requirementIds: jsonb("requirement_ids").notNull().default([]),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("doc_sections_proposal_idx").on(table.proposalDocumentId),
		index("doc_sections_status_idx").on(table.status),
	]
);

// ============================================================================
// Document Analyses (30+ factor AI analysis results)
// ============================================================================

export const documentAnalyses = pgTable(
	"document_analyses",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
		/** Link to proposal document if applicable */
		proposalDocumentId: uuid("proposal_document_id").references(() => proposalDocuments.id, { onDelete: "set null" }),
		/** Overall quality score (0-100) */
		overallScore: real("overall_score").notNull(),
		/** Scores by category */
		categoryScores: jsonb("category_scores").notNull(),
		/** Individual factor scores */
		factorScores: jsonb("factor_scores").notNull(),
		/** Issues found */
		issues: jsonb("issues").notNull().default([]),
		/** Improvement suggestions */
		suggestions: jsonb("suggestions").notNull().default([]),
		/** Document stats at time of analysis */
		wordCount: integer("word_count").notNull(),
		paragraphCount: integer("paragraph_count").notNull(),
		/** When analysis was performed */
		analyzedAt: timestamp("analyzed_at", { withTimezone: true }).notNull().defaultNow(),
		/** AI model version used */
		modelVersion: varchar("model_version", { length: 50 }),
	},
	(table) => [
		index("analyses_document_idx").on(table.documentId),
		index("analyses_proposal_doc_idx").on(table.proposalDocumentId),
		index("analyses_analyzed_at_idx").on(table.analyzedAt),
	]
);

// ============================================================================
// Paragraph Analyses (for compliance heatmap)
// ============================================================================

export const paragraphAnalyses = pgTable(
	"paragraph_analyses",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		analysisId: uuid("analysis_id").notNull().references(() => documentAnalyses.id, { onDelete: "cascade" }),
		/** Paragraph index in document */
		paragraphIndex: integer("paragraph_index").notNull(),
		/** Paragraph text */
		text: text("text").notNull(),
		/** Quality score for this paragraph (0-100) */
		score: real("score").notNull(),
		/** Issues specific to this paragraph */
		issues: jsonb("issues").notNull().default([]),
		/** Suggestions specific to this paragraph */
		suggestions: jsonb("suggestions").notNull().default([]),
	},
	(table) => [
		index("paragraph_analysis_idx").on(table.analysisId),
		index("paragraph_index_idx").on(table.paragraphIndex),
	]
);

// ============================================================================
// Submissions (proposal submission tracking)
// ============================================================================

export const submissions = pgTable(
	"submissions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
		/** When proposal was submitted */
		submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
		/** Who submitted */
		submittedBy: varchar("submitted_by", { length: 200 }).notNull(),
		/** How it was submitted */
		submissionMethod: varchar("submission_method", { length: 100 }),
		/** Portal/system confirmation number */
		confirmationNumber: varchar("confirmation_number", { length: 200 }),
		/** Documents included in submission */
		attachments: jsonb("attachments").notNull().default([]),
		/** Submission notes */
		notes: text("notes"),
		/** Current status */
		status: varchar("status", { length: 30 }).notNull().default("submitted"),
		/** Final outcome */
		outcome: varchar("outcome", { length: 20 }),
		/** When outcome was determined */
		outcomeDate: timestamp("outcome_date", { withTimezone: true }),
		/** Outcome notes/details */
		outcomeNotes: text("outcome_notes"),
		/** Feedback from evaluators */
		evaluatorFeedback: text("evaluator_feedback"),
		/** Internal lessons learned */
		lessonsLearned: text("lessons_learned"),
		/** Contract value if won */
		contractValue: real("contract_value"),
		/** Contract duration if won */
		contractDuration: varchar("contract_duration", { length: 100 }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("submissions_opportunity_idx").on(table.opportunityId),
		index("submissions_status_idx").on(table.status),
		index("submissions_outcome_idx").on(table.outcome),
		index("submissions_submitted_at_idx").on(table.submittedAt),
	]
);

// Partners table is defined in schema-integration.ts (re-exported above)
import { partners } from "./schema-integration";

// ============================================================================
// Opportunity Partners (partner assignments)
// ============================================================================

export const opportunityPartners = pgTable(
	"opportunity_partners",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
		partnerId: uuid("partner_id").notNull().references(() => partners.id, { onDelete: "cascade" }),
		/** Partner's role on this opportunity */
		role: varchar("role", { length: 100 }),
		/** Percentage of work assigned */
		workShare: real("work_share"),
		/** Document sections assigned to this partner */
		assignedSections: jsonb("assigned_sections").notNull().default([]),
		/** Collaboration status */
		status: varchar("status", { length: 20 }).notNull().default("invited"),
		/** NDA signed */
		ndaSigned: boolean("nda_signed").notNull().default(false),
		/** Teaming agreement signed */
		teamingAgreementSigned: boolean("teaming_agreement_signed").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("opp_partners_opportunity_idx").on(table.opportunityId),
		index("opp_partners_partner_idx").on(table.partnerId),
		index("opp_partners_status_idx").on(table.status),
		uniqueIndex("opp_partner_unique_idx").on(table.opportunityId, table.partnerId),
	]
);

// ============================================================================
// Opportunity Relations
// ============================================================================

export const opportunitiesRelations = relations(opportunities, ({ many }) => ({
	votes: many(opportunityVotes),
	aiScores: many(opportunityAIScores),
	proposalDocuments: many(proposalDocuments),
	submissions: many(submissions),
	partners: many(opportunityPartners),
	opportunityDocuments: many(opportunityDocuments),
}));

export const opportunityVotesRelations = relations(opportunityVotes, ({ one }) => ({
	opportunity: one(opportunities, {
		fields: [opportunityVotes.opportunityId],
		references: [opportunities.id],
	}),
}));

export const opportunityAIScoresRelations = relations(opportunityAIScores, ({ one }) => ({
	opportunity: one(opportunities, {
		fields: [opportunityAIScores.opportunityId],
		references: [opportunities.id],
	}),
}));


export const proposalDocumentsRelations = relations(proposalDocuments, ({ one, many }) => ({
	opportunity: one(opportunities, {
		fields: [proposalDocuments.opportunityId],
		references: [opportunities.id],
	}),
	document: one(documents, {
		fields: [proposalDocuments.documentId],
		references: [documents.id],
	}),
	sections: many(documentSections),
	analyses: many(documentAnalyses),
}));

export const documentSectionsRelations = relations(documentSections, ({ one }) => ({
	proposalDocument: one(proposalDocuments, {
		fields: [documentSections.proposalDocumentId],
		references: [proposalDocuments.id],
	}),
}));

export const documentAnalysesRelations = relations(documentAnalyses, ({ one, many }) => ({
	document: one(documents, {
		fields: [documentAnalyses.documentId],
		references: [documents.id],
	}),
	proposalDocument: one(proposalDocuments, {
		fields: [documentAnalyses.proposalDocumentId],
		references: [proposalDocuments.id],
	}),
	paragraphAnalyses: many(paragraphAnalyses),
}));

export const paragraphAnalysesRelations = relations(paragraphAnalyses, ({ one }) => ({
	analysis: one(documentAnalyses, {
		fields: [paragraphAnalyses.analysisId],
		references: [documentAnalyses.id],
	}),
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
	opportunity: one(opportunities, {
		fields: [submissions.opportunityId],
		references: [opportunities.id],
	}),
}));

// ============================================================================
// Opportunity Documents (RFP documents discovered and downloaded)
// ============================================================================

export const opportunityDocStatusEnum = pgEnum("opportunity_doc_status", [
	"discovered",
	"downloading",
	"downloaded",
	"failed",
	"analyzed",
	"error",
]);

export const opportunityDocTypeEnum = pgEnum("opportunity_doc_type", [
	"rfp",
	"amendment",
	"attachment",
	"specification",
	"evaluation",
	"form",
	"other",
]);

export const opportunityDocuments = pgTable(
	"opportunity_documents",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
		/** Document name/title */
		documentName: varchar("document_name", { length: 500 }).notNull(),
		/** Type of document */
		documentType: opportunityDocTypeEnum("document_type").notNull().default("attachment"),
		/** Description of the document */
		description: text("description"),
		/** Original source URL */
		sourceUrl: text("source_url").notNull(),
		/** When the document was discovered */
		discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
		/** Local file path after download */
		localPath: text("local_path"),
		/** File size in bytes */
		fileSizeBytes: integer("file_size_bytes"),
		/** MIME type */
		mimeType: varchar("mime_type", { length: 100 }),
		/** SHA256 hash for deduplication */
		fileHash: varchar("file_hash", { length: 64 }),
		/** When downloaded */
		downloadedAt: timestamp("downloaded_at", { withTimezone: true }),
		/** Number of download attempts */
		downloadAttempts: integer("download_attempts").notNull().default(0),
		/** Last error message */
		lastError: text("last_error"),
		/** Extracted text content */
		extractedText: text("extracted_text"),
		/** When text was extracted */
		extractedAt: timestamp("extracted_at", { withTimezone: true }),
		/** Page count (for PDFs) */
		pageCount: integer("page_count"),
		/** Whether document has been analyzed */
		isAnalyzed: boolean("is_analyzed").notNull().default(false),
		/** When analyzed */
		analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
		/** AI analysis results */
		analysisResults: jsonb("analysis_results"),
		/** Current status */
		status: opportunityDocStatusEnum("status").notNull().default("discovered"),
		/** Whether selected for bulk operations */
		isSelected: boolean("is_selected").notNull().default(true),
		/** Who downloaded */
		downloadedBy: varchar("downloaded_by", { length: 200 }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("opp_docs_opportunity_idx").on(table.opportunityId),
		index("opp_docs_status_idx").on(table.status),
		index("opp_docs_type_idx").on(table.documentType),
		uniqueIndex("opp_docs_opp_url_idx").on(table.opportunityId, table.sourceUrl),
	]
);

export const opportunityDocumentsRelations = relations(opportunityDocuments, ({ one }) => ({
	opportunity: one(opportunities, {
		fields: [opportunityDocuments.opportunityId],
		references: [opportunities.id],
	}),
}));

// Import partner communication and notes tables for relations
import { partnerCommunications, partnerNotes } from "./schema-integration";

export const partnersRelations = relations(partners, ({ many }) => ({
	opportunities: many(opportunityPartners),
	communications: many(partnerCommunications),
	notes: many(partnerNotes),
}));

export const partnerCommunicationsRelations = relations(partnerCommunications, ({ one }) => ({
	partner: one(partners, {
		fields: [partnerCommunications.partnerId],
		references: [partners.id],
	}),
}));

export const partnerNotesRelations = relations(partnerNotes, ({ one }) => ({
	partner: one(partners, {
		fields: [partnerNotes.partnerId],
		references: [partners.id],
	}),
}));

export const opportunityPartnersRelations = relations(opportunityPartners, ({ one }) => ({
	opportunity: one(opportunities, {
		fields: [opportunityPartners.opportunityId],
		references: [opportunities.id],
	}),
	partner: one(partners, {
		fields: [opportunityPartners.partnerId],
		references: [partners.id],
	}),
}));

// ============================================================================
// Company Settings (Organization Profile)
// ============================================================================

export const companySettings = pgTable(
	"company_settings",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Organization ID for tenant isolation */
		organizationId: varchar("organization_id", { length: 100 }),
		/** Organization name (formal/legal name) */
		companyName: varchar("company_name", { length: 500 }).notNull(),
		/** Short name (abbreviated for casual use) */
		shortName: varchar("short_name", { length: 100 }),
		/** Colloquial name (informal, how people refer to the company) */
		colloquialName: varchar("colloquial_name", { length: 200 }),
		/** Legal entity name (if different from company name) */
		legalName: varchar("legal_name", { length: 500 }),
		/** Primary logo image URL (full logo) */
		logoImageUrl: text("logo_image_url"),
		/** Icon/favicon URL (small logo mark) */
		logoIconUrl: text("logo_icon_url"),
		/** Area of business/industry category */
		areaOfBusiness: varchar("area_of_business", { length: 200 }),
		/** Company registration/tax ID */
		registrationNumber: varchar("registration_number", { length: 100 }),
		/** Registration country */
		registrationCountry: varchar("registration_country", { length: 100 }),
		/** Tax ID / EIN */
		taxId: varchar("tax_id", { length: 100 }),
		/** VAT number (for international tax) */
		vatNumber: varchar("vat_number", { length: 50 }),
		/** DUNS number (for government contracts) */
		dunsNumber: varchar("duns_number", { length: 20 }),
		/** CAGE code (for government contracts) */
		cageCode: varchar("cage_code", { length: 10 }),
		/** SAM.gov UEI (Unique Entity Identifier) */
		samUei: varchar("sam_uei", { length: 20 }),
		/** NAICS codes */
		naicsCodes: jsonb("naics_codes").notNull().default([]),
		/** Industry description */
		industryDescription: text("industry_description"),
		/** Year founded */
		yearFounded: integer("year_founded"),
		/** Number of employees */
		employeeCount: integer("employee_count"),
		/** Annual revenue (for qualifications) */
		annualRevenue: varchar("annual_revenue", { length: 100 }),
		/** Small business certifications */
		certifications: jsonb("certifications").notNull().default([]),
		/** Website URL */
		website: varchar("website", { length: 500 }),
		/** Primary address line 1 */
		addressLine1: varchar("address_line_1", { length: 500 }),
		/** Primary address line 2 */
		addressLine2: varchar("address_line_2", { length: 500 }),
		/** Address suite/unit */
		addressSuite: varchar("address_suite", { length: 100 }),
		city: varchar("city", { length: 200 }),
		stateProvince: varchar("state_province", { length: 100 }),
		postalCode: varchar("postal_code", { length: 50 }),
		country: varchar("country", { length: 100 }),
		/** General contact email */
		generalEmail: varchar("general_email", { length: 200 }),
		/** General contact phone */
		generalPhone: varchar("general_phone", { length: 50 }),
		/** Primary contact */
		primaryContactName: varchar("primary_contact_name", { length: 200 }),
		primaryContactTitle: varchar("primary_contact_title", { length: 200 }),
		primaryContactEmail: varchar("primary_contact_email", { length: 200 }),
		primaryContactPhone: varchar("primary_contact_phone", { length: 50 }),
		/** Contracts/BD contact */
		contractsContactName: varchar("contracts_contact_name", { length: 200 }),
		contractsContactTitle: varchar("contracts_contact_title", { length: 200 }),
		contractsContactEmail: varchar("contracts_contact_email", { length: 200 }),
		contractsContactPhone: varchar("contracts_contact_phone", { length: 50 }),
		/** Core capabilities (for proposals) */
		coreCapabilities: jsonb("core_capabilities").notNull().default([]),
		/** Key differentiators */
		differentiators: jsonb("differentiators").notNull().default([]),
		/** Past performance summary */
		pastPerformanceSummary: text("past_performance_summary"),
		/** Standard company boilerplate text */
		companyBoilerplate: text("company_boilerplate"),
		/** Logo URL or base64 (legacy - use logoImageUrl) */
		logoUrl: text("logo_url"),
		/** Primary brand color (hex) */
		primaryColor: varchar("primary_color", { length: 10 }),
		/** Secondary brand color (hex) */
		secondaryColor: varchar("secondary_color", { length: 10 }),
		/** Default branding for exports */
		defaultBranding: jsonb("default_branding"),
		/** Additional custom fields */
		customFields: jsonb("custom_fields").notNull().default({}),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("company_settings_org_idx").on(table.organizationId),
	]
);

// ============================================================================
// Opportunity Type Exports
// ============================================================================

export type OpportunityRow = typeof opportunities.$inferSelect;
export type NewOpportunity = typeof opportunities.$inferInsert;

export type OpportunityImportRow = typeof opportunityImports.$inferSelect;
export type NewOpportunityImport = typeof opportunityImports.$inferInsert;

export type OpportunityVoteRow = typeof opportunityVotes.$inferSelect;
export type NewOpportunityVote = typeof opportunityVotes.$inferInsert;

export type OpportunityAIScoreRow = typeof opportunityAIScores.$inferSelect;

export type ProposalDocumentRow = typeof proposalDocuments.$inferSelect;
export type NewProposalDocument = typeof proposalDocuments.$inferInsert;

export type DocumentSectionRow = typeof documentSections.$inferSelect;
export type NewDocumentSection = typeof documentSections.$inferInsert;

export type DocumentAnalysisRow = typeof documentAnalyses.$inferSelect;
export type NewDocumentAnalysis = typeof documentAnalyses.$inferInsert;

export type ParagraphAnalysisRow = typeof paragraphAnalyses.$inferSelect;
export type NewParagraphAnalysis = typeof paragraphAnalyses.$inferInsert;

export type SubmissionRow = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;

export type OpportunityDocumentRow = typeof opportunityDocuments.$inferSelect;
export type NewOpportunityDocument = typeof opportunityDocuments.$inferInsert;

// PartnerRow and NewPartner are exported from schema-partners.ts

export type OpportunityPartnerRow = typeof opportunityPartners.$inferSelect;
export type NewOpportunityPartner = typeof opportunityPartners.$inferInsert;

export type CompanySettingsRow = typeof companySettings.$inferSelect;
export type NewCompanySettings = typeof companySettings.$inferInsert;

// ============================================================================
// User Preferences
// ============================================================================

export const userPreferences = pgTable(
	"user_preferences",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: varchar("user_id", { length: 100 }).notNull().unique(),
		/** Theme preference: light, dark, or system */
		theme: varchar("theme", { length: 20 }).notNull().default("system"),
		/** Email notifications enabled */
		emailNotifications: boolean("email_notifications").notNull().default(true),
		/** Push notifications enabled */
		pushNotifications: boolean("push_notifications").notNull().default(false),
		/** In-app notifications enabled */
		inAppNotifications: boolean("in_app_notifications").notNull().default(true),
		/** Notification digest frequency: realtime, hourly, daily, weekly */
		digestFrequency: varchar("digest_frequency", { length: 20 }).notNull().default("daily"),
		/** User interface language */
		language: varchar("language", { length: 10 }).notNull().default("en"),
		/** User timezone */
		timezone: varchar("timezone", { length: 100 }).notNull().default("UTC"),
		/** Date format preference */
		dateFormat: varchar("date_format", { length: 50 }).notNull().default("MMM d, yyyy"),
		/** Time format: 12h or 24h */
		timeFormat: varchar("time_format", { length: 10 }).notNull().default("12h"),
		/** First day of week */
		weekStart: varchar("week_start", { length: 20 }).notNull().default("monday"),
		/** UI density: compact, comfortable, spacious */
		density: varchar("density", { length: 20 }).notNull().default("comfortable"),
		/** Font size preference: small, medium, large */
		fontSize: varchar("font_size", { length: 20 }).notNull().default("medium"),
		/** Accent color */
		accentColor: varchar("accent_color", { length: 20 }).notNull().default("blue"),
		/** Reduced motion preference */
		reducedMotion: boolean("reduced_motion").notNull().default(false),
		/** AI configuration preferences */
		aiConfig: jsonb("ai_config"),
		/** Which notification types are enabled */
		notificationTypes: jsonb("notification_types").notNull().default({
			email: true,
			push: false,
			documentShared: true,
			documentComment: true,
			opportunityAlert: true,
			deadlineReminder: true,
			systemUpdate: true,
			teamActivity: true,
		}),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index("preferences_user_idx").on(table.userId)]
);

// ============================================================================
// Organization Settings (enhancement)
// ============================================================================

export const organizationSettings = pgTable(
	"organization_settings",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: varchar("organization_id", { length: 100 }).notNull().unique(),
		/** Company display name */
		companyName: varchar("company_name", { length: 500 }).notNull(),
		/** Tagline/slogan */
		tagline: varchar("tagline", { length: 500 }),
		/** Website URL */
		website: varchar("website", { length: 500 }),
		/** Primary brand color (hex) */
		primaryColor: varchar("primary_color", { length: 10 }).notNull().default("#0066CC"),
		/** Secondary brand color (hex) */
		secondaryColor: varchar("secondary_color", { length: 10 }).notNull().default("#00A3E0"),
		/** Logo URL or base64 */
		logoUrl: text("logo_url"),
		/** Favicon URL or base64 */
		faviconUrl: text("favicon_url"),
		/** Custom CSS for branding */
		customCss: text("custom_css"),
		/** Default proposal template */
		defaultTemplateId: uuid("default_template_id"),
		/** Default proposal language */
		defaultLanguage: varchar("default_language", { length: 10 }).notNull().default("en"),
		/** Default currency */
		defaultCurrency: varchar("default_currency", { length: 10 }).notNull().default("USD"),
		/** Date format for proposals */
		defaultDateFormat: varchar("default_date_format", { length: 50 }).notNull().default("MMM d, yyyy"),
		/** Proposal expiry days */
		proposalExpiryDays: integer("proposal_expiry_days").notNull().default(30),
		/** Auto-archive old documents */
		autoArchive: boolean("auto_archive").notNull().default(false),
		/** Archive documents after days */
		archiveAfterDays: integer("archive_after_days"),
		/** Require approval for proposals */
		requireApproval: boolean("require_approval").notNull().default(true),
		/** Default sharing permissions */
		defaultSharing: varchar("default_sharing", { length: 50 }).notNull().default("private"),
		/** Organization metadata */
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index("org_settings_org_idx").on(table.organizationId)]
);

// ============================================================================
// User Workspaces (multiple workspace support)
// ============================================================================

export const userWorkspaces = pgTable(
	"user_workspaces",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: varchar("user_id", { length: 100 }).notNull(),
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		/** Workspace name */
		name: varchar("name", { length: 200 }).notNull(),
		/** Workspace slug/identifier */
		slug: varchar("slug", { length: 200 }).notNull(),
		/** Workspace description */
		description: text("description"),
		/** Is this the default workspace */
		isDefault: boolean("is_default").notNull().default(false),
		/** User role in this workspace */
		role: varchar("role", { length: 50 }).notNull().default("member"),
		/** User permissions in this workspace */
		permissions: jsonb("permissions").notNull().default({
			canCreateDocuments: true,
			canEditTemplates: false,
			canManageUsers: false,
			canViewAnalytics: false,
			canManageSettings: false,
			canDeleteContent: false,
		}),
		/** Workspace theme override */
		config: jsonb("config"),
		/** When user joined this workspace */
		joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
		/** When user last accessed this workspace */
		lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
		/** Is user currently active in this workspace */
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("workspaces_user_idx").on(table.userId),
		index("workspaces_org_idx").on(table.organizationId),
		uniqueIndex("workspaces_user_org_slug_idx").on(table.userId, table.slug),
	]
);

// ============================================================================
// Document Defaults
// ============================================================================

export const documentDefaults = pgTable(
	"document_defaults",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: varchar("user_id", { length: 100 }).notNull(),
		organizationId: varchar("organization_id", { length: 100 }),
		/** Default paper size */
		defaultPaperSize: varchar("default_paper_size", { length: 20 }).notNull().default("A4"),
		/** Default orientation: portrait, landscape */
		defaultOrientation: varchar("default_orientation", { length: 20 }).notNull().default("portrait"),
		/** Default font family */
		defaultFont: varchar("default_font", { length: 100 }).notNull().default("Inter"),
		/** Default font size in points */
		defaultFontSize: real("default_font_size").notNull().default(11),
		/** Default line spacing */
		defaultLineSpacing: varchar("default_line_spacing", { length: 20 }).notNull().default("1.5"),
		/** Default margins in points */
		defaultMargins: jsonb("default_margins").notNull().default({
			top: 72,
			bottom: 72,
			left: 72,
			right: 72,
		}),
		/** Default template for new documents */
		defaultTemplateId: uuid("default_template_id"),
		/** Default page numbering */
		pageNumbering: boolean("page_numbering").notNull().default(true),
		/** Page number position */
		pageNumberPosition: varchar("page_number_position", { length: 50 }).notNull().default("bottom-center"),
		/** Default header text */
		defaultHeader: text("default_header"),
		/** Default footer text */
		defaultFooter: text("default_footer"),
		/** Default cover page enabled */
		defaultCoverPage: boolean("default_cover_page").notNull().default(false),
		/** Default cover page template */
		defaultCoverPageTemplate: varchar("default_cover_page_template", { length: 100 }),
		/** Watermark text (if any) */
		watermarkText: varchar("watermark_text", { length: 200 }),
		/** Export format preferences */
		exportFormats: jsonb("export_formats").notNull().default({
			pdf: true,
			docx: true,
			xlsx: true,
			pptx: true,
		}),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("doc_defaults_user_idx").on(table.userId),
		index("doc_defaults_org_idx").on(table.organizationId),
		uniqueIndex("doc_defaults_user_org_idx").on(table.userId, table.organizationId),
	]
);

// ============================================================================
// AI Preferences
// ============================================================================

export const aiPreferences = pgTable(
	"ai_preferences",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: varchar("user_id", { length: 100 }).notNull(),
		organizationId: varchar("organization_id", { length: 100 }),
		/** Primary AI model */
		primaryModel: varchar("primary_model", { length: 100 }).notNull().default("gpt-4"),
		/** Fallback AI model */
		fallbackModel: varchar("fallback_model", { length: 100 }).notNull().default("gpt-3.5-turbo"),
		/** Temperature for AI generation (0.0 to 1.0) */
		temperature: real("temperature").notNull().default(0.7),
		/** Maximum tokens per request */
		maxTokens: integer("max_tokens").notNull().default(4096),
		/** Streaming responses enabled */
		streamingEnabled: boolean("streaming_enabled").notNull().default(true),
		/** Auto-suggest completions */
		autoSuggest: boolean("auto_suggest").notNull().default(true),
		/** AI suggestion frequency: low, medium, high */
		suggestionFrequency: varchar("suggestion_frequency", { length: 20 }).notNull().default("medium"),
		/** Custom AI instructions/persona */
		customInstructions: text("custom_instructions"),
		/** Proposal writing style: formal, casual, technical, executive */
		writingStyle: varchar("writing_style", { length: 50 }).notNull().default("formal"),
		/** Preferred response format: paragraphs, bullets, mixed */
		responseFormat: varchar("response_format", { length: 20 }).notNull().default("mixed"),
		/** AI features enabled/disabled */
		features: jsonb("features").notNull().default({
			completion: true,
			editing: true,
			summarization: true,
			analysis: true,
			generation: true,
			translation: true,
			evaluation: true,
		}),
		/** AI usage limits (if applicable) */
		usageLimits: jsonb("usage_limits").notNull().default({
			dailyRequests: 100,
			totalBudget: null,
		}),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("ai_prefs_user_idx").on(table.userId),
		index("ai_prefs_org_idx").on(table.organizationId),
		uniqueIndex("ai_prefs_user_org_idx").on(table.userId, table.organizationId),
	]
);

// ============================================================================
// API Keys for Integrations
// ============================================================================

export const apiKeys = pgTable(
	"api_keys",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: varchar("user_id", { length: 100 }).notNull(),
		organizationId: varchar("organization_id", { length: 100 }),
		/** API key name */
		name: varchar("name", { length: 200 }).notNull(),
		/** Hashed key (for identification only) */
		keyHash: varchar("key_hash", { length: 64 }).notNull(),
		/** Key prefix (visible to user) */
		keyPrefix: varchar("key_prefix", { length: 10 }).notNull(),
		/** Scopes/permissions for this key */
		scopes: jsonb("scopes").notNull().default(["read", "write"]),
		/** Rate limit: requests per minute */
		rateLimit: integer("rate_limit").notNull().default(60),
		/** Last used timestamp */
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		/** Expiration date */
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		/** Is this key currently active */
		isActive: boolean("is_active").notNull().default(true),
		/** IP restrictions if any */
		ipRestrictions: jsonb("ip_restrictions"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("api_keys_user_idx").on(table.userId),
		index("api_keys_org_idx").on(table.organizationId),
	]
);

// ============================================================================
// Webhooks
// ============================================================================

export const webhooks = pgTable(
	"webhooks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: varchar("user_id", { length: 100 }).notNull(),
		organizationId: varchar("organization_id", { length: 100 }),
		/** Webhook name */
		name: varchar("name", { length: 200 }).notNull(),
		/** Callback URL */
		url: text("url").notNull(),
		/** Event types to subscribe to */
		events: jsonb("events").notNull().default([]),
		/** Secret for HMAC signature */
		secret: varchar("secret", { length: 500 }),
		/** Content type */
		contentType: varchar("content_type", { length: 50 }).notNull().default("application/json"),
		/** Is webhook active */
		isActive: boolean("is_active").notNull().default(true),
		/** SSL verify enabled */
		sslVerify: boolean("ssl_verify").notNull().default(true),
		/** Retry count on failure */
		retryCount: integer("retry_count").notNull().default(3),
		/** Last delivery attempt timestamp */
		lastDeliveryAt: timestamp("last_delivery_at", { withTimezone: true }),
		/** Last delivery status */
		lastDeliveryStatus: varchar("last_delivery_status", { length: 20 }),
		/** Delivery statistics */
		deliveries: jsonb("deliveries").notNull().default({
			successCount: 0,
			failureCount: 0,
		}),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("webhooks_user_idx").on(table.userId),
		index("webhooks_org_idx").on(table.organizationId),
		index("webhooks_active_idx").on(table.isActive),
	]
);

// ============================================================================
// User Sessions (active session management)
// ============================================================================

export const userSessions = pgTable(
	"user_sessions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: varchar("user_id", { length: 100 }).notNull(),
		/** Session token */
		token: varchar("token", { length: 500 }).notNull().unique(),
		/** Device name/browser */
		deviceName: varchar("device_name", { length: 200 }),
		/** Device type: desktop, mobile, tablet */
		deviceType: varchar("device_type", { length: 20 }),
		/** Operating system */
		os: varchar("os", { length: 100 }),
		/** Browser */
		browser: varchar("browser", { length: 100 }),
		/** IP address */
		ipAddress: varchar("ip_address", { length: 45 }),
		/** IP location/region */
		location: varchar("location", { length: 200 }),
		/** Is this the current session */
		isCurrent: boolean("is_current").notNull().default(false),
		/** Session started at */
		startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
		/** Last active timestamp */
		lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
		/** Expires at */
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("sessions_user_idx").on(table.userId),
		index("sessions_token_idx").on(table.token),
	]
);

// ============================================================================
// Data Exports (GDPR/self-service export)
// ============================================================================

export const dataExports = pgTable(
	"data_exports",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: varchar("user_id", { length: 100 }).notNull(),
		/** Export type: full, documents, settings, activity */
		exportType: varchar("export_type", { length: 50 }).notNull(),
		/** Data types included */
		dataTypes: jsonb("data_types").notNull().default([]),
		/** Export format: json, csv, pdf */
		format: varchar("format", { length: 20 }).notNull().default("json"),
		/** Export status: pending, processing, completed, failed */
		status: varchar("status", { length: 20 }).notNull().default("pending"),
		/** Download URL (when completed) */
		downloadUrl: text("download_url"),
		/** File size in bytes */
		fileSize: integer("file_size"),
		/** Expires at (for security) */
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		/** Error message if failed */
		errorMessage: text("error_message"),
		/** Requested at */
		requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
		/** Completed at */
		completedAt: timestamp("completed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("exports_user_idx").on(table.userId),
		index("exports_status_idx").on(table.status),
	]
);

// ============================================================================
// New Settings Relations
// ============================================================================

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
	user: one(user, {
		fields: [userPreferences.userId],
		references: [user.id],
	}),
}));

export const organizationSettingsRelations = relations(organizationSettings, ({ many }) => ({
	workspaces: many(userWorkspaces),
}));

export const userWorkspacesRelations = relations(userWorkspaces, ({ one }) => ({
	organization: one(organizationSettings, {
		fields: [userWorkspaces.organizationId],
		references: [organizationSettings.organizationId],
	}),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
	user: one(user, {
		fields: [apiKeys.userId],
		references: [user.id],
	}),
}));

export const webhooksRelations = relations(webhooks, ({ one }) => ({
	user: one(user, {
		fields: [webhooks.userId],
		references: [user.id],
	}),
}));

export const dataExportsRelations = relations(dataExports, ({ one }) => ({
	user: one(user, {
		fields: [dataExports.userId],
		references: [user.id],
	}),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
	user: one(user, {
		fields: [userSessions.userId],
		references: [user.id],
	}),
}));

// ============================================================================
// Type Exports for Settings
// ============================================================================

export type UserPreferencesRow = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;

export type OrganizationSettingsRow = typeof organizationSettings.$inferSelect;
export type NewOrganizationSettings = typeof organizationSettings.$inferInsert;

export type UserWorkspacesRow = typeof userWorkspaces.$inferSelect;
export type NewUserWorkspaces = typeof userWorkspaces.$inferInsert;

export type DocumentDefaultsRow = typeof documentDefaults.$inferSelect;
export type NewDocumentDefaults = typeof documentDefaults.$inferInsert;

export type AIPreferencesRow = typeof aiPreferences.$inferSelect;
export type NewAIPreferences = typeof aiPreferences.$inferInsert;

export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type WebhookRow = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;

export type DataExportRow = typeof dataExports.$inferSelect;
export type NewDataExport = typeof dataExports.$inferInsert;

export type UserSessionRow = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;

// Template Snippets, Edits, and Partials are now re-exported via
// export * from "./schema-additions" at the top of this file.
