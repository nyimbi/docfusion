/**
 * Database schema for RFP (Request for Proposal) Intelligence Platform
 *
 * Phase 1 Implementation - Core tables for:
 * - RFP document parsing and storage
 * - Requirements extraction and classification
 * - Compliance matrix management
 * - Compliance entry tracking
 *
 * Uses pgvector for semantic search capabilities with 1536-dimension embeddings
 * compatible with OpenAI ada-002 and similar models.
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
import { user } from "./auth-schema";
import { opportunities, documents } from "./schema";

// ============================================================================
// RFP Documents - Uploaded RFP files with parsing metadata
// ============================================================================

export const rfpDocuments = pgTable(
	"rfp_documents",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		/** Link to the opportunity this RFP is for */
		opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
		/** Original filename */
		filename: varchar("filename", { length: 500 }).notNull(),
		/** File type: pdf, docx, html */
		fileType: varchar("file_type", { length: 20 }).notNull(),
		/** File size in bytes */
		fileSize: integer("file_size").notNull(),
		/** Storage path (S3, local, etc.) */
		storagePath: text("storage_path").notNull(),
		/** MD5 hash for deduplication */
		fileHash: varchar("file_hash", { length: 64 }),
		/** RFP format detected: far, dfars, commercial, grant, state_local */
		rfpFormat: varchar("rfp_format", { length: 50 }),
		/** Parsing status: pending, processing, completed, failed */
		parsingStatus: varchar("parsing_status", { length: 20 }).notNull().default("pending"),
		/** Parsing progress percentage (0-100) */
		parsingProgress: integer("parsing_progress").notNull().default(0),
		/** Error message if parsing failed */
		parsingError: text("parsing_error"),
		/** When parsing started */
		parsingStartedAt: timestamp("parsing_started_at", { withTimezone: true }),
		/** When parsing completed */
		parsingCompletedAt: timestamp("parsing_completed_at", { withTimezone: true }),

		// Extracted Metadata
		/** RFP title extracted from document */
		extractedTitle: varchar("extracted_title", { length: 1000 }),
		/** Issuing organization */
		issuingOrganization: varchar("issuing_organization", { length: 500 }),
		/** Solicitation number */
		solicitationNumber: varchar("solicitation_number", { length: 200 }),
		/** Response deadline extracted */
		responseDeadline: timestamp("response_deadline", { withTimezone: true }),
		/** Questions deadline if specified */
		questionsDeadline: timestamp("questions_deadline", { withTimezone: true }),
		/** Pre-proposal conference date */
		preProposalDate: timestamp("pre_proposal_date", { withTimezone: true }),
		/** Contract type: FFP, T&M, Cost Plus, IDIQ, etc. */
		contractType: varchar("contract_type", { length: 100 }),
		/** NAICS codes mentioned */
		naicsCodes: jsonb("naics_codes").notNull().default([]),
		/** Set-aside type: 8a, HUBZone, WOSB, SDVOSB, etc. */
		setAsideType: varchar("set_aside_type", { length: 100 }),
		/** Estimated contract value */
		estimatedValue: real("estimated_value"),
		/** Period of performance in months */
		periodOfPerformance: integer("period_of_performance"),
		/** Place of performance */
		placeOfPerformance: text("place_of_performance"),
		/** Submission instructions */
		submissionInstructions: text("submission_instructions"),

		// Document Structure
		/** Total page count */
		pageCount: integer("page_count"),
		/** Total word count */
		wordCount: integer("word_count"),
		/** Detected sections (JSON array of section headers) */
		detectedSections: jsonb("detected_sections").notNull().default([]),
		/** Section L (Instructions) content if detected */
		sectionLContent: text("section_l_content"),
		/** Section M (Evaluation Criteria) content if detected */
		sectionMContent: text("section_m_content"),
		/** Statement of Work content */
		statementOfWork: text("statement_of_work"),

		// AI Analysis
		/** AI-generated summary of the RFP */
		aiSummary: text("ai_summary"),
		/** Key themes and focus areas identified */
		keyThemes: jsonb("key_themes").notNull().default([]),
		/** Evaluation criteria weights if specified */
		evaluationWeights: jsonb("evaluation_weights").notNull().default({}),
		/** AI confidence score for parsing (0-100) */
		parsingConfidence: real("parsing_confidence"),
		/** Raw extracted text for full-text search */
		extractedText: text("extracted_text"),
		/** Vector embedding for semantic search (1536 dimensions for OpenAI ada-002) */
		embedding: vector("embedding", { dimensions: 1536 }),

		// Metadata
		/** User who uploaded the document */
		uploadedBy: varchar("uploaded_by", { length: 100 }).notNull(),
		/** Extended metadata */
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("rfp_docs_opportunity_idx").on(table.opportunityId),
		index("rfp_docs_status_idx").on(table.parsingStatus),
		index("rfp_docs_format_idx").on(table.rfpFormat),
		index("rfp_docs_deadline_idx").on(table.responseDeadline),
		index("rfp_docs_uploaded_by_idx").on(table.uploadedBy),
		index("rfp_docs_created_idx").on(table.createdAt),
		uniqueIndex("rfp_docs_org_hash_idx").on(table.organizationId, table.fileHash),
		index("rfp_docs_org_idx").on(table.organizationId),
		index("rfp_docs_org_id_idx").on(table.organizationId, table.id),
	]
);

// ============================================================================
// RFP Requirements - Extracted and classified requirements
// ============================================================================

export const rfpRequirements = pgTable(
	"rfp_requirements",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		/** Source RFP document */
		rfpDocumentId: uuid("rfp_document_id").references(() => rfpDocuments.id, { onDelete: "cascade" }),
		/** Link to opportunity for direct access */
		opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),

		// Requirement Identification
		/** Auto-generated requirement ID (e.g., REQ-001) */
		requirementNumber: varchar("requirement_number", { length: 50 }),
		/** Human-readable short title */
		title: varchar("title", { length: 500 }),
		/** Full requirement text */
		requirementText: text("requirement_text").notNull(),
		/** Original quote from source document */
		sourceQuote: text("source_quote"),
		/** Page number in source document */
		sourcePage: integer("source_page"),
		/** Section reference (e.g., "Section L.5.2.1") */
		sourceSection: varchar("source_section", { length: 100 }),

		// Classification
		/** Primary category: technical, management, past_performance, cost, administrative, personnel */
		category: varchar("category", { length: 50 }),
		/** Subcategory for finer classification */
		subcategory: varchar("subcategory", { length: 100 }),
		/** Requirement type: shall, should, may, will */
		requirementType: varchar("requirement_type", { length: 20 }).default("shall"),
		/** Priority: mandatory, preferred, optional */
		priority: varchar("priority", { length: 20 }).default("mandatory"),
		/** Risk level if not addressed: critical, high, medium, low */
		riskLevel: varchar("risk_level", { length: 20 }).default("medium"),
		/** Evaluation weight (0-100) if specified in RFP */
		evaluationWeight: real("evaluation_weight"),

		// AI Analysis
		/** AI confidence in extraction (0-100) */
		extractionConfidence: real("extraction_confidence"),
		/** AI analysis and suggestions */
		aiAnalysis: jsonb("ai_analysis"),
		/** Whether this is explicit or implicit requirement */
		isImplicit: boolean("is_implicit").notNull().default(false),
		/** AI-detected ambiguity level: clear, somewhat_ambiguous, very_ambiguous */
		ambiguityLevel: varchar("ambiguity_level", { length: 30 }),
		/** Suggested clarification questions */
		clarificationQuestions: jsonb("clarification_questions").notNull().default([]),
		/** Related requirements (by ID) */
		relatedRequirements: jsonb("related_requirements").notNull().default([]),
		/** Key terms and concepts */
		keyTerms: jsonb("key_terms").notNull().default([]),
		/** AI-suggested response approach */
		suggestedApproach: text("suggested_approach"),
		/** Vector embedding for semantic search */
		embedding: vector("embedding", { dimensions: 1536 }),

		// Compliance Tracking
		/** Compliance status: not_addressed, in_progress, addressed, compliant, partial, non_compliant */
		complianceStatus: varchar("compliance_status", { length: 30 }).notNull().default("not_addressed"),
		/** Response strategy notes */
		responseStrategy: text("response_strategy"),
		/** Assigned writer/owner */
		assignedTo: varchar("assigned_to", { length: 100 }),
		/** Due date for response */
		dueDate: timestamp("due_date", { withTimezone: true }),
		/** Link to document section addressing this requirement */
		responseDocumentId: uuid("response_document_id").references(() => documents.id, { onDelete: "set null" }),
		/** Specific section in response document */
		responseSection: varchar("response_section", { length: 200 }),
		/** Internal notes */
		notes: text("notes"),

		// Metadata
		/** Tags for filtering */
		tags: jsonb("tags").notNull().default([]),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("rfp_reqs_document_idx").on(table.rfpDocumentId),
		index("rfp_reqs_opportunity_idx").on(table.opportunityId),
		index("rfp_reqs_category_idx").on(table.category),
		index("rfp_reqs_priority_idx").on(table.priority),
		index("rfp_reqs_status_idx").on(table.complianceStatus),
		index("rfp_reqs_assigned_idx").on(table.assignedTo),
		index("rfp_reqs_risk_idx").on(table.riskLevel),
		uniqueIndex("rfp_reqs_number_doc_idx").on(table.rfpDocumentId, table.requirementNumber),
		index("rfp_reqs_org_idx").on(table.organizationId),
		index("rfp_reqs_org_doc_idx").on(table.organizationId, table.rfpDocumentId),
	]
);

// ============================================================================
// Compliance Matrix - Overall compliance tracking for an opportunity
// ============================================================================

export const complianceMatrices = pgTable(
	"compliance_matrices",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		/** Opportunity this matrix is for */
		opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
		/** Source RFP document */
		rfpDocumentId: uuid("rfp_document_id").references(() => rfpDocuments.id, { onDelete: "set null" }),

		// Matrix Metadata
		/** Matrix name/version */
		name: varchar("name", { length: 200 }).notNull(),
		/** Description */
		description: text("description"),
		/** Version number */
		version: integer("version").notNull().default(1),
		/** Matrix status: draft, in_progress, review, final, submitted */
		status: varchar("status", { length: 30 }).notNull().default("draft"),

		// Statistics (cached for performance)
		/** Total requirements count */
		totalRequirements: integer("total_requirements").notNull().default(0),
		/** Mandatory requirements count */
		mandatoryCount: integer("mandatory_count").notNull().default(0),
		/** Fully compliant count */
		compliantCount: integer("compliant_count").notNull().default(0),
		/** Partially compliant count */
		partialCount: integer("partial_count").notNull().default(0),
		/** Non-compliant count */
		nonCompliantCount: integer("non_compliant_count").notNull().default(0),
		/** Not addressed count */
		notAddressedCount: integer("not_addressed_count").notNull().default(0),
		/** Overall compliance score (0-100) */
		complianceScore: real("compliance_score"),
		/** Mandatory compliance score (0-100) */
		mandatoryComplianceScore: real("mandatory_compliance_score"),

		// Review Status
		/** Last reviewed by */
		reviewedBy: varchar("reviewed_by", { length: 100 }),
		/** Last review date */
		reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
		/** Review notes */
		reviewNotes: text("review_notes"),
		/** Approved by */
		approvedBy: varchar("approved_by", { length: 100 }),
		/** Approval date */
		approvedAt: timestamp("approved_at", { withTimezone: true }),

		// Configuration
		/** Custom category groupings */
		categoryGroups: jsonb("category_groups").notNull().default({}),
		/** Display columns configuration */
		displayColumns: jsonb("display_columns").notNull().default([
			"requirementNumber",
			"title",
			"category",
			"priority",
			"complianceStatus",
			"responseSection",
			"assignedTo",
		]),
		/** Export format preferences */
		exportSettings: jsonb("export_settings").notNull().default({}),

		// Metadata
		/** Created by user */
		createdBy: varchar("created_by", { length: 100 }).notNull(),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("compliance_matrix_opportunity_idx").on(table.opportunityId),
		index("compliance_matrix_rfp_idx").on(table.rfpDocumentId),
		index("compliance_matrix_status_idx").on(table.status),
		index("compliance_matrix_created_by_idx").on(table.createdBy),
		uniqueIndex("compliance_matrix_opp_version_idx").on(table.opportunityId, table.version),
		index("compliance_matrices_org_idx").on(table.organizationId),
		index("compliance_matrices_org_id_idx").on(table.organizationId, table.id),
	]
);

// ============================================================================
// Compliance Entries - Individual compliance responses in a matrix
// ============================================================================

export const complianceEntries = pgTable(
	"compliance_entries",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		/** Parent compliance matrix */
		matrixId: uuid("matrix_id").notNull().references(() => complianceMatrices.id, { onDelete: "cascade" }),
		/** Source requirement */
		requirementId: uuid("requirement_id").notNull().references(() => rfpRequirements.id, { onDelete: "cascade" }),

		// Response Mapping
		/** Compliance status: full, partial, non_compliant, not_applicable, pending */
		complianceStatus: varchar("compliance_status", { length: 30 }).notNull().default("pending"),
		/** Compliance explanation/justification */
		complianceJustification: text("compliance_justification"),
		/** Response document reference */
		responseDocumentId: uuid("response_document_id").references(() => documents.id, { onDelete: "set null" }),
		/** Section/page reference in response */
		responseReference: varchar("response_reference", { length: 200 }),
		/** Brief response summary */
		responseSummary: text("response_summary"),

		// Assessment
		/** Self-assessed strength: strong, adequate, weak, gap */
		strengthAssessment: varchar("strength_assessment", { length: 20 }),
		/** Risk if partially/non-compliant: high, medium, low */
		riskLevel: varchar("risk_level", { length: 20 }),
		/** Mitigation strategy for gaps */
		mitigationStrategy: text("mitigation_strategy"),
		/** Supporting evidence references */
		evidenceReferences: jsonb("evidence_references").notNull().default([]),

		// Review Status
		/** Entry status: draft, review, approved, rejected */
		status: varchar("status", { length: 30 }).notNull().default("draft"),
		/** Reviewer notes */
		reviewerNotes: text("reviewer_notes"),
		/** Reviewer user ID */
		reviewedBy: varchar("reviewed_by", { length: 100 }),
		/** Review timestamp */
		reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
		/** Approver user ID */
		approvedBy: varchar("approved_by", { length: 100 }),
		/** Approval timestamp */
		approvedAt: timestamp("approved_at", { withTimezone: true }),

		// Workflow
		/** Assigned writer */
		assignedTo: varchar("assigned_to", { length: 100 }),
		/** Due date */
		dueDate: timestamp("due_date", { withTimezone: true }),
		/** Completion percentage (0-100) */
		completionPercent: integer("completion_percent").notNull().default(0),

		// Display Order
		/** Sort order within matrix */
		sortOrder: integer("sort_order").notNull().default(0),

		// Metadata
		/** Internal notes */
		notes: text("notes"),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("compliance_entry_matrix_idx").on(table.matrixId),
		index("compliance_entry_req_idx").on(table.requirementId),
		index("compliance_entry_status_idx").on(table.complianceStatus),
		index("compliance_entry_assigned_idx").on(table.assignedTo),
		index("compliance_entry_doc_idx").on(table.responseDocumentId),
		uniqueIndex("compliance_entry_matrix_req_idx").on(table.matrixId, table.requirementId),
		index("compliance_entries_org_idx").on(table.organizationId),
	]
);

// ============================================================================
// RFP Parsing Jobs - Track async parsing operations
// ============================================================================

export const rfpParsingJobs = pgTable(
	"rfp_parsing_jobs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		/** RFP document being parsed */
		rfpDocumentId: uuid("rfp_document_id").notNull().references(() => rfpDocuments.id, { onDelete: "cascade" }),

		// Job Status
		/** Job status: queued, processing, completed, failed, cancelled */
		status: varchar("status", { length: 20 }).notNull().default("queued"),
		/** Current step: upload, text_extraction, section_detection, requirement_extraction, classification, embedding */
		currentStep: varchar("current_step", { length: 50 }),
		/** Progress percentage (0-100) */
		progress: integer("progress").notNull().default(0),
		/** Error message if failed */
		errorMessage: text("error_message"),
		/** Error stack trace */
		errorStack: text("error_stack"),

		// Timing
		/** When job was queued */
		queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
		/** When processing started */
		startedAt: timestamp("started_at", { withTimezone: true }),
		/** When job completed/failed */
		completedAt: timestamp("completed_at", { withTimezone: true }),

		// Results Summary
		/** Number of pages processed */
		pagesProcessed: integer("pages_processed"),
		/** Number of requirements extracted */
		requirementsExtracted: integer("requirements_extracted"),
		/** Processing time in milliseconds */
		processingTimeMs: integer("processing_time_ms"),

		// Configuration
		/** Parsing options used */
		parsingOptions: jsonb("parsing_options").notNull().default({
			extractRequirements: true,
			generateEmbeddings: true,
			detectSections: true,
			classifyRequirements: true,
		}),
		/** AI model version used */
		modelVersion: varchar("model_version", { length: 50 }),

		// Metadata
		/** User who initiated the job */
		initiatedBy: varchar("initiated_by", { length: 100 }).notNull(),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("rfp_jobs_document_idx").on(table.rfpDocumentId),
		index("rfp_jobs_status_idx").on(table.status),
		index("rfp_jobs_initiated_by_idx").on(table.initiatedBy),
		index("rfp_jobs_queued_idx").on(table.queuedAt),
		index("rfp_parsing_jobs_org_idx").on(table.organizationId),
	]
);

// ============================================================================
// Relations
// ============================================================================

export const rfpDocumentsRelations = relations(rfpDocuments, ({ one, many }) => ({
	opportunity: one(opportunities, {
		fields: [rfpDocuments.opportunityId],
		references: [opportunities.id],
	}),
	uploader: one(user, {
		fields: [rfpDocuments.uploadedBy],
		references: [user.id],
	}),
	requirements: many(rfpRequirements),
	complianceMatrices: many(complianceMatrices),
	parsingJobs: many(rfpParsingJobs),
}));

export const rfpRequirementsRelations = relations(rfpRequirements, ({ one, many }) => ({
	rfpDocument: one(rfpDocuments, {
		fields: [rfpRequirements.rfpDocumentId],
		references: [rfpDocuments.id],
	}),
	opportunity: one(opportunities, {
		fields: [rfpRequirements.opportunityId],
		references: [opportunities.id],
	}),
	assignee: one(user, {
		fields: [rfpRequirements.assignedTo],
		references: [user.id],
	}),
	responseDocument: one(documents, {
		fields: [rfpRequirements.responseDocumentId],
		references: [documents.id],
	}),
	complianceEntries: many(complianceEntries),
}));

export const complianceMatricesRelations = relations(complianceMatrices, ({ one, many }) => ({
	opportunity: one(opportunities, {
		fields: [complianceMatrices.opportunityId],
		references: [opportunities.id],
	}),
	rfpDocument: one(rfpDocuments, {
		fields: [complianceMatrices.rfpDocumentId],
		references: [rfpDocuments.id],
	}),
	creator: one(user, {
		fields: [complianceMatrices.createdBy],
		references: [user.id],
	}),
	entries: many(complianceEntries),
}));

export const complianceEntriesRelations = relations(complianceEntries, ({ one }) => ({
	matrix: one(complianceMatrices, {
		fields: [complianceEntries.matrixId],
		references: [complianceMatrices.id],
	}),
	requirement: one(rfpRequirements, {
		fields: [complianceEntries.requirementId],
		references: [rfpRequirements.id],
	}),
	responseDocument: one(documents, {
		fields: [complianceEntries.responseDocumentId],
		references: [documents.id],
	}),
	assignee: one(user, {
		fields: [complianceEntries.assignedTo],
		references: [user.id],
	}),
	reviewer: one(user, {
		fields: [complianceEntries.reviewedBy],
		references: [user.id],
		relationName: "reviewer",
	}),
	approver: one(user, {
		fields: [complianceEntries.approvedBy],
		references: [user.id],
		relationName: "approver",
	}),
}));

export const rfpParsingJobsRelations = relations(rfpParsingJobs, ({ one }) => ({
	rfpDocument: one(rfpDocuments, {
		fields: [rfpParsingJobs.rfpDocumentId],
		references: [rfpDocuments.id],
	}),
	initiator: one(user, {
		fields: [rfpParsingJobs.initiatedBy],
		references: [user.id],
	}),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type RfpDocumentRow = typeof rfpDocuments.$inferSelect;
export type NewRfpDocument = typeof rfpDocuments.$inferInsert;

export type RfpRequirementRow = typeof rfpRequirements.$inferSelect;
export type NewRfpRequirement = typeof rfpRequirements.$inferInsert;

export type ComplianceMatrixRow = typeof complianceMatrices.$inferSelect;
export type NewComplianceMatrix = typeof complianceMatrices.$inferInsert;

export type ComplianceEntryRow = typeof complianceEntries.$inferSelect;
export type NewComplianceEntry = typeof complianceEntries.$inferInsert;

export type RfpParsingJobRow = typeof rfpParsingJobs.$inferSelect;
export type NewRfpParsingJob = typeof rfpParsingJobs.$inferInsert;

// ============================================================================
// Enums for Type Safety (use in TypeScript)
// ============================================================================

export const RFP_FORMATS = [
	"far",
	"dfars",
	"commercial",
	"grant",
	"state_local",
	"international",
	"other",
] as const;

export const PARSING_STATUSES = [
	"pending",
	"processing",
	"completed",
	"failed",
] as const;

export const REQUIREMENT_CATEGORIES = [
	"technical",
	"management",
	"past_performance",
	"cost",
	"administrative",
	"personnel",
	"security",
	"compliance",
	"other",
] as const;

export const REQUIREMENT_TYPES = [
	"shall",
	"should",
	"may",
	"will",
] as const;

export const REQUIREMENT_PRIORITIES = [
	"mandatory",
	"preferred",
	"optional",
] as const;

export const COMPLIANCE_STATUSES = [
	"not_addressed",
	"in_progress",
	"addressed",
	"compliant",
	"partial",
	"non_compliant",
	"not_applicable",
	"pending",
] as const;

export const RISK_LEVELS = [
	"critical",
	"high",
	"medium",
	"low",
] as const;

export const MATRIX_STATUSES = [
	"draft",
	"in_progress",
	"review",
	"final",
	"submitted",
] as const;

export type RfpFormat = typeof RFP_FORMATS[number];
export type ParsingStatus = typeof PARSING_STATUSES[number];
export type RequirementCategory = typeof REQUIREMENT_CATEGORIES[number];
export type RequirementType = typeof REQUIREMENT_TYPES[number];
export type RequirementPriority = typeof REQUIREMENT_PRIORITIES[number];
export type ComplianceStatus = typeof COMPLIANCE_STATUSES[number];
export type RiskLevel = typeof RISK_LEVELS[number];
export type MatrixStatus = typeof MATRIX_STATUSES[number];
