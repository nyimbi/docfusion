/**
 * Database schema for DocFusion using Drizzle ORM.
 *
 * This defines the PostgreSQL tables for documents, templates, and related entities.
 * Using PostgreSQL-native features like JSONB for content storage and full-text search.
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
// Type exports for TypeScript inference
// ============================================================================

export type DocumentRow = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type DocumentVersionRow = typeof documentVersions.$inferSelect;
export type NewDocumentVersion = typeof documentVersions.$inferInsert;

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
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
		importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
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
	]
);

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

export const requirements = pgTable(
	"requirements",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
		/** Human-readable requirement ID (e.g., "REQ-001") */
		requirementId: varchar("requirement_id", { length: 50 }),
		/** Primary category */
		category: varchar("category", { length: 100 }),
		/** Subcategory for finer classification */
		subcategory: varchar("subcategory", { length: 100 }),
		/** Full requirement text */
		text: text("text").notNull(),
		/** Original quote from RFP */
		source: text("source"),
		/** Page/section reference in source document */
		sourcePageRef: varchar("source_page_ref", { length: 50 }),
		/** Priority: "mandatory", "preferred", "optional" */
		priority: varchar("priority", { length: 20 }),
		/** Compliance status */
		complianceStatus: varchar("compliance_status", { length: 30 }).notNull().default("not_addressed"),
		/** Strategy for addressing this requirement */
		responseStrategy: text("response_strategy"),
		/** User assigned to address this requirement */
		assignedTo: varchar("assigned_to", { length: 200 }),
		/** Due date for addressing */
		dueDate: timestamp("due_date", { withTimezone: true }),
		/** Internal notes */
		notes: text("notes"),
		/** Risk level: "low", "medium", "high", "critical" */
		riskLevel: varchar("risk_level", { length: 20 }),
		/** AI analysis and suggestions */
		aiAnalysis: jsonb("ai_analysis"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("requirements_opportunity_idx").on(table.opportunityId),
		index("requirements_category_idx").on(table.category),
		index("requirements_status_idx").on(table.complianceStatus),
		index("requirements_priority_idx").on(table.priority),
		index("requirements_assigned_idx").on(table.assignedTo),
	]
);

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

// ============================================================================
// Partners (external collaborators)
// ============================================================================

export const partners = pgTable(
	"partners",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Partner organization name */
		name: varchar("name", { length: 500 }).notNull(),
		/** Partner type: "prime", "sub", "consultant", "vendor" */
		type: varchar("type", { length: 50 }),
		/** Primary contact name */
		contactName: varchar("contact_name", { length: 200 }),
		/** Contact email */
		contactEmail: varchar("contact_email", { length: 200 }),
		/** Contact phone */
		contactPhone: varchar("contact_phone", { length: 50 }),
		/** Partner capabilities/services */
		capabilities: jsonb("capabilities").notNull().default([]),
		/** Number of past collaborations */
		pastCollaborations: integer("past_collaborations").notNull().default(0),
		/** Performance rating (1-5) */
		performanceRating: real("performance_rating"),
		/** Internal notes */
		notes: text("notes"),
		/** Active/inactive status */
		status: varchar("status", { length: 20 }).notNull().default("active"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("partners_status_idx").on(table.status),
		index("partners_type_idx").on(table.type),
	]
);

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
	requirements: many(requirements),
	proposalDocuments: many(proposalDocuments),
	submissions: many(submissions),
	partners: many(opportunityPartners),
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

export const requirementsRelations = relations(requirements, ({ one }) => ({
	opportunity: one(opportunities, {
		fields: [requirements.opportunityId],
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

export const partnersRelations = relations(partners, ({ many }) => ({
	opportunities: many(opportunityPartners),
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
		/** Organization name */
		companyName: varchar("company_name", { length: 500 }).notNull(),
		/** Legal entity name (if different) */
		legalName: varchar("legal_name", { length: 500 }),
		/** Company registration/tax ID */
		registrationNumber: varchar("registration_number", { length: 100 }),
		/** Tax ID / EIN */
		taxId: varchar("tax_id", { length: 100 }),
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
		/** Primary address */
		addressLine1: varchar("address_line_1", { length: 500 }),
		addressLine2: varchar("address_line_2", { length: 500 }),
		city: varchar("city", { length: 200 }),
		stateProvince: varchar("state_province", { length: 100 }),
		postalCode: varchar("postal_code", { length: 50 }),
		country: varchar("country", { length: 100 }),
		/** Primary contact */
		primaryContactName: varchar("primary_contact_name", { length: 200 }),
		primaryContactTitle: varchar("primary_contact_title", { length: 200 }),
		primaryContactEmail: varchar("primary_contact_email", { length: 200 }),
		primaryContactPhone: varchar("primary_contact_phone", { length: 50 }),
		/** Contracts/BD contact */
		contractsContactName: varchar("contracts_contact_name", { length: 200 }),
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
		/** Logo URL or base64 */
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
	}
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
export type NewOpportunityAIScore = typeof opportunityAIScores.$inferInsert;

export type RequirementRow = typeof requirements.$inferSelect;
export type NewRequirement = typeof requirements.$inferInsert;

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

export type PartnerRow = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;

export type OpportunityPartnerRow = typeof opportunityPartners.$inferSelect;
export type NewOpportunityPartner = typeof opportunityPartners.$inferInsert;

export type CompanySettingsRow = typeof companySettings.$inferSelect;
export type NewCompanySettings = typeof companySettings.$inferInsert;
