/**
 * Integration & External Systems Domain Schema - DocFusion
 *
 * Consolidated schema for all external system integrations, data import/export,
 * and organizational resource management. Merges the following domain schemas:
 *
 * - Scraper: TenderSourceMax scraper configuration, run tracking, health metrics
 * - Import: Universal data import, mapping templates, import history
 * - Partners: Partner management, communications, notes, import history
 * - Company: Company profiles, roles, CVs, clients, products, services, variables
 * - Content Library: Snippet/template embeddings, analytics, usage tracking, suggestions
 * - Past Performance: Projects, relevance scoring, CPAR ratings, narratives
 * - Personnel: Personnel records, resumes, skills taxonomy, position matching
 */

import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	real,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
	vector,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { documents, opportunities, templates } from "./schema";
import { templateSnippets, templatePartials } from "./schema-additions";


// ============================================================================
// ============================================================================
//
//  SECTION: SCRAPER (TenderSourceMax Scraper System)
//
// ============================================================================
// ============================================================================

// ============================================================================
// Scraper Enums
// ============================================================================

export const scraperSourceTypeEnum = pgEnum("scraper_source_type", [
	"mdb",
	"un_agency",
	"aggregator",
	"government",
	"regional",
	"bilateral",
	"ngo",
	"commercial",
]);

export const scraperHealthStatusEnum = pgEnum("scraper_health_status", [
	"healthy",
	"degraded",
	"failing",
	"unknown",
	"disabled",
]);

export const scraperRunStatusEnum = pgEnum("scraper_run_status", [
	"pending",
	"running",
	"success",
	"partial",
	"failed",
	"timeout",
	"cancelled",
]);

// ============================================================================
// Scraper Sources
// ============================================================================

export const scraperSources = pgTable(
	"scraper_sources",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		sourceId: varchar("source_id", { length: 50 }).notNull().unique(),
		name: varchar("name", { length: 200 }).notNull(),
		url: text("url").notNull(),

		sourceType: scraperSourceTypeEnum("source_type").notNull().default("aggregator"),
		coverage: jsonb("coverage").notNull().default([]),
		language: varchar("language", { length: 10 }).default("en"),

		scraperClass: varchar("scraper_class", { length: 200 }),
		rateLimit: real("rate_limit").notNull().default(1.0),
		timeout: integer("timeout").notNull().default(30),
		maxPages: integer("max_pages").notNull().default(10),
		maxRetries: integer("max_retries").notNull().default(3),
		requiresJavascript: boolean("requires_javascript").notNull().default(false),
		requiresAuth: boolean("requires_auth").notNull().default(false),
		requiresProxy: boolean("requires_proxy").notNull().default(false),

		scheduleTier: integer("schedule_tier").notNull().default(3),
		cronExpression: varchar("cron_expression", { length: 50 }),
		priority: integer("priority").notNull().default(2),
		enabled: boolean("enabled").notNull().default(true),

		healthStatus: scraperHealthStatusEnum("health_status").notNull().default("unknown"),
		lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
		lastRunAt: timestamp("last_run_at", { withTimezone: true }),
		lastError: text("last_error"),
		totalOpportunitiesScraped: integer("total_opportunities_scraped").notNull().default(0),
		lastOpportunitiesCount: integer("last_opportunities_count").default(0),
		successfulRuns: integer("successful_runs").notNull().default(0),
		failedRuns: integer("failed_runs").notNull().default(0),
		avgRunDurationSeconds: real("avg_run_duration_seconds"),
		successRate: real("success_rate"),

		avgOpportunitiesPerRun: real("avg_opportunities_per_run"),
		uniqueOpportunitiesContributed: integer("unique_opportunities_contributed").notNull().default(0),
		dataQualityScore: real("data_quality_score"),
		valueScore: real("value_score"),

		notes: text("notes"),
		config: jsonb("config"),
		authConfig: jsonb("auth_config"),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("scraper_sources_source_id_idx").on(table.sourceId),
		index("scraper_sources_type_idx").on(table.sourceType),
		index("scraper_sources_tier_idx").on(table.scheduleTier),
		index("scraper_sources_enabled_idx").on(table.enabled),
		index("scraper_sources_health_idx").on(table.healthStatus),
		index("scraper_sources_last_run_idx").on(table.lastRunAt),
	]
);

// ============================================================================
// Scraper Runs
// ============================================================================

export const scraperRuns = pgTable(
	"scraper_runs",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		sourceId: uuid("source_id").notNull().references(() => scraperSources.id, { onDelete: "cascade" }),
		sourceKey: varchar("source_key", { length: 50 }).notNull(),

		runId: varchar("run_id", { length: 100 }).notNull(),
		batchId: varchar("batch_id", { length: 100 }),
		triggerType: varchar("trigger_type", { length: 20 }).notNull().default("scheduled"),

		startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		durationSeconds: real("duration_seconds"),

		status: scraperRunStatusEnum("status").notNull().default("pending"),
		progress: integer("progress").default(0),

		opportunitiesFound: integer("opportunities_found").notNull().default(0),
		opportunitiesNew: integer("opportunities_new").notNull().default(0),
		opportunitiesUpdated: integer("opportunities_updated").notNull().default(0),
		opportunitiesSkipped: integer("opportunities_skipped").notNull().default(0),
		opportunitiesFailed: integer("opportunities_failed").notNull().default(0),

		pagesScraped: integer("pages_scraped").notNull().default(0),
		requestsMade: integer("requests_made").notNull().default(0),
		rateLimitHits: integer("rate_limit_hits").notNull().default(0),
		bytesDownloaded: integer("bytes_downloaded").notNull().default(0),

		errorMessage: text("error_message"),
		errorType: varchar("error_type", { length: 50 }),
		errorLog: jsonb("error_log"),
		warnings: jsonb("warnings"),

		dataQualityScore: real("data_quality_score"),
		sampleData: jsonb("sample_data"),

		runConfig: jsonb("run_config"),
		performanceMetrics: jsonb("performance_metrics"),
	},
	(table) => [
		index("scraper_runs_source_idx").on(table.sourceId),
		index("scraper_runs_source_key_idx").on(table.sourceKey),
		index("scraper_runs_run_id_idx").on(table.runId),
		index("scraper_runs_batch_idx").on(table.batchId),
		index("scraper_runs_status_idx").on(table.status),
		index("scraper_runs_started_idx").on(table.startedAt),
	]
);

// ============================================================================
// Scraper Schedules
// ============================================================================

export const scraperSchedules = pgTable(
	"scraper_schedules",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		name: varchar("name", { length: 50 }).notNull().unique(),
		label: varchar("label", { length: 100 }).notNull(),
		cronExpression: varchar("cron_expression", { length: 50 }).notNull(),
		description: text("description"),

		maxConcurrent: integer("max_concurrent").notNull().default(3),
		timeoutMinutes: integer("timeout_minutes").notNull().default(30),

		enabled: boolean("enabled").notNull().default(true),

		lastRunAt: timestamp("last_run_at", { withTimezone: true }),
		nextRunAt: timestamp("next_run_at", { withTimezone: true }),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	}
);

// Scraper Relations
export const scraperSourcesRelations = relations(scraperSources, ({ many }) => ({
	runs: many(scraperRuns),
}));

export const scraperRunsRelations = relations(scraperRuns, ({ one }) => ({
	source: one(scraperSources, {
		fields: [scraperRuns.sourceId],
		references: [scraperSources.id],
	}),
}));

// Scraper Type exports
export type ScraperSource = typeof scraperSources.$inferSelect;
export type NewScraperSource = typeof scraperSources.$inferInsert;
export type ScraperRun = typeof scraperRuns.$inferSelect;
export type NewScraperRun = typeof scraperRuns.$inferInsert;
export type ScraperSchedule = typeof scraperSchedules.$inferSelect;
export type NewScraperSchedule = typeof scraperSchedules.$inferInsert;


// ============================================================================
// ============================================================================
//
//  SECTION: IMPORT (Universal Data Import)
//
// ============================================================================
// ============================================================================

// ============================================================================
// Import JSONB Types
// ============================================================================

export interface ColumnMappingConfig {
	targetColumn: string;
	sourceColumns: string[];
	separator?: string;
	transform?: string;
	defaultValue?: string;
	required: boolean;
}

export interface ImportError {
	row: number;
	column?: string;
	value?: string;
	error: string;
}

// ============================================================================
// Import Mapping Templates
// ============================================================================

export const importMappingTemplates = pgTable(
	"import_mapping_templates",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: varchar("organization_id", { length: 255 }),

		name: varchar("name", { length: 200 }).notNull(),
		description: text("description"),
		targetTable: varchar("target_table", { length: 100 }).notNull(),

		mappings: jsonb("mappings").$type<ColumnMappingConfig[]>().notNull(),

		sourceColumnPatterns: jsonb("source_column_patterns").$type<Record<string, string[]>>(),

		useCount: integer("use_count").default(0),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
		createdBy: varchar("created_by", { length: 255 }),
	},
	(table) => [
		index("import_templates_org_idx").on(table.organizationId),
		index("import_templates_target_idx").on(table.targetTable),
		index("import_templates_use_count_idx").on(table.useCount),
		uniqueIndex("import_templates_org_name_idx").on(table.organizationId, table.name),
	]
);

// ============================================================================
// Data Imports
// ============================================================================

export const dataImports = pgTable(
	"data_imports",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: varchar("organization_id", { length: 255 }),

		filename: varchar("filename", { length: 500 }).notNull(),
		fileType: varchar("file_type", { length: 20 }).notNull(),
		fileSize: integer("file_size"),
		sheetName: varchar("sheet_name", { length: 200 }),

		targetTable: varchar("target_table", { length: 100 }).notNull(),
		templateId: uuid("template_id").references(() => importMappingTemplates.id, { onDelete: "set null" }),

		mappingsUsed: jsonb("mappings_used").$type<Array<{
			targetColumn: string;
			sourceColumns: string[];
			separator?: string;
			transform?: string;
		}>>(),

		totalRows: integer("total_rows").default(0),
		importedRows: integer("imported_rows").default(0),
		updatedRows: integer("updated_rows").default(0),
		skippedRows: integer("skipped_rows").default(0),
		failedRows: integer("failed_rows").default(0),

		status: varchar("status", { length: 30 }).default("pending"),

		errors: jsonb("errors").$type<ImportError[]>().default([]),

		duplicateHandling: varchar("duplicate_handling", { length: 30 }).default("skip"),
		batchSize: integer("batch_size").default(100),

		importedIds: jsonb("imported_ids").$type<string[]>().default([]),

		startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
		completedAt: timestamp("completed_at", { withTimezone: true }),

		importedBy: varchar("imported_by", { length: 255 }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("data_imports_org_idx").on(table.organizationId),
		index("data_imports_target_idx").on(table.targetTable),
		index("data_imports_status_idx").on(table.status),
		index("data_imports_started_idx").on(table.startedAt),
		index("data_imports_imported_by_idx").on(table.importedBy),
	]
);

// Import Relations
export const importMappingTemplatesRelations = relations(importMappingTemplates, ({ many }) => ({
	imports: many(dataImports),
}));

export const dataImportsRelations = relations(dataImports, ({ one }) => ({
	template: one(importMappingTemplates, {
		fields: [dataImports.templateId],
		references: [importMappingTemplates.id],
	}),
}));

// Import Type exports
export type ImportMappingTemplateRow = typeof importMappingTemplates.$inferSelect;
export type NewImportMappingTemplate = typeof importMappingTemplates.$inferInsert;
export type DataImportRow = typeof dataImports.$inferSelect;
export type NewDataImport = typeof dataImports.$inferInsert;


// ============================================================================
// ============================================================================
//
//  SECTION: PARTNERS (Partner Management)
//
// ============================================================================
// ============================================================================

export const partners = pgTable(
	"partners",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		name: varchar("name", { length: 500 }).notNull(),
		country: varchar("country", { length: 100 }),
		region: varchar("region", { length: 100 }),
		corporateStatus: varchar("corporate_status", { length: 100 }),
		foundingDate: varchar("founding_date", { length: 50 }),
		description: text("description"),

		contactName: varchar("contact_name", { length: 200 }),
		contactEmail: varchar("contact_email", { length: 200 }),
		contactPhone: varchar("contact_phone", { length: 100 }),
		website: varchar("website", { length: 500 }),
		address: text("address"),

		leadership: text("leadership"),
		notableClients: text("notable_clients"),
		revenueEstimate: varchar("revenue_estimate", { length: 100 }),
		employeeCount: varchar("employee_count", { length: 50 }),
		fundingStatus: varchar("funding_status", { length: 200 }),

		type: varchar("type", { length: 50 }).notNull().default("prospect"),
		coreCapabilities: text("core_capabilities"),
		capabilities: jsonb("capabilities").notNull().default([]),
		sectors: jsonb("sectors").notNull().default([]),

		competitorRelationships: text("competitor_relationships"),
		riskAssessment: text("risk_assessment"),

		partnershipFitScore: real("partnership_fit_score"),
		fitJustification: text("fit_justification"),
		tier: integer("tier"),
		priorityActions: text("priority_actions"),

		pastCollaborations: integer("past_collaborations").notNull().default(0),
		performanceRating: real("performance_rating"),

		notes: text("notes"),
		tags: jsonb("tags").notNull().default([]),

		status: varchar("status", { length: 20 }).notNull().default("prospect"),
		source: varchar("source", { length: 100 }),
		sourceFile: varchar("source_file", { length: 500 }),
		metadata: jsonb("metadata"),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("partners_status_idx").on(table.status),
		index("partners_type_idx").on(table.type),
		index("partners_country_idx").on(table.country),
		index("partners_region_idx").on(table.region),
		index("partners_tier_idx").on(table.tier),
		index("partners_fit_score_idx").on(table.partnershipFitScore),
		uniqueIndex("partners_name_country_idx").on(table.name, table.country),
	]
);

export const partnerCommunications = pgTable(
	"partner_communications",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		partnerId: uuid("partner_id").notNull().references(() => partners.id, { onDelete: "cascade" }),

		communicationType: varchar("communication_type", { length: 50 }).notNull(),
		direction: varchar("direction", { length: 20 }).notNull().default("outbound"),
		subject: varchar("subject", { length: 500 }),
		content: text("content"),
		summary: text("summary"),

		ourParticipants: jsonb("our_participants").notNull().default([]),
		partnerContacts: jsonb("partner_contacts").notNull().default([]),
		loggedBy: varchar("logged_by", { length: 100 }).notNull().default("system"),

		communicationDate: timestamp("communication_date", { withTimezone: true }).notNull(),
		durationMinutes: integer("duration_minutes"),

		outcome: text("outcome"),
		actionItems: jsonb("action_items").notNull().default([]),
		nextSteps: text("next_steps"),
		followUpDate: timestamp("follow_up_date", { withTimezone: true }),
		followUpCompleted: boolean("follow_up_completed").notNull().default(false),

		sentiment: varchar("sentiment", { length: 20 }),
		opportunityId: uuid("opportunity_id"),
		tags: jsonb("tags").notNull().default([]),

		attachments: jsonb("attachments").notNull().default([]),
		externalReference: varchar("external_reference", { length: 500 }),

		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("partner_comms_partner_idx").on(table.partnerId),
		index("partner_comms_type_idx").on(table.communicationType),
		index("partner_comms_date_idx").on(table.communicationDate),
		index("partner_comms_logged_by_idx").on(table.loggedBy),
		index("partner_comms_opportunity_idx").on(table.opportunityId),
		index("partner_comms_follow_up_idx").on(table.followUpDate),
	]
);

export const partnerNotes = pgTable(
	"partner_notes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		partnerId: uuid("partner_id").notNull().references(() => partners.id, { onDelete: "cascade" }),

		content: text("content").notNull(),
		noteType: varchar("note_type", { length: 30 }).notNull().default("general"),
		isPinned: boolean("is_pinned").notNull().default(false),
		authorId: varchar("author_id", { length: 100 }).notNull(),
		authorName: varchar("author_name", { length: 200 }),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("partner_notes_partner_idx").on(table.partnerId),
		index("partner_notes_type_idx").on(table.noteType),
		index("partner_notes_pinned_idx").on(table.isPinned),
		index("partner_notes_author_idx").on(table.authorId),
	]
);

export const partnerImports = pgTable(
	"partner_imports",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		filename: varchar("filename", { length: 500 }).notNull(),
		filePath: text("file_path"),
		totalRecords: integer("total_records").notNull().default(0),
		importedRecords: integer("imported_records").notNull().default(0),
		updatedRecords: integer("updated_records").notNull().default(0),
		skippedRecords: integer("skipped_records").notNull().default(0),
		failedRecords: integer("failed_records").notNull().default(0),
		status: varchar("status", { length: 20 }).notNull().default("pending"),
		errors: jsonb("errors").default([]),
		config: jsonb("config"),
		importedBy: varchar("imported_by", { length: 200 }).notNull().default("system"),
		startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		index("partner_imports_status_idx").on(table.status),
		index("partner_imports_started_idx").on(table.startedAt),
	]
);

// NOTE: Partner relations are defined in schema.ts to avoid circular dependencies
// with opportunityPartners table.

// Partner Type exports
export type PartnerRow = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;
export type PartnerCommunicationRow = typeof partnerCommunications.$inferSelect;
export type NewPartnerCommunication = typeof partnerCommunications.$inferInsert;
export type PartnerNoteRow = typeof partnerNotes.$inferSelect;
export type NewPartnerNote = typeof partnerNotes.$inferInsert;
export type PartnerImportRow = typeof partnerImports.$inferSelect;
export type NewPartnerImport = typeof partnerImports.$inferInsert;


// ============================================================================
// ============================================================================
//
//  SECTION: COMPANY (Company Setup & Resources)
//
// ============================================================================
// ============================================================================

export const roles = pgTable(
	"roles",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		name: varchar("name", { length: 200 }).notNull(),
		description: text("description"),
		department: varchar("department", { length: 200 }),
		level: varchar("level", { length: 50 }),
		responsibilities: jsonb("responsibilities").notNull().default([]),
		skillsRequired: jsonb("skills_required").notNull().default([]),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("roles_org_idx").on(table.organizationId),
		index("roles_department_idx").on(table.department),
	]
);

export const cvs = pgTable(
	"cvs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: varchar("user_id", { length: 100 }),
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		fullName: varchar("full_name", { length: 200 }).notNull(),
		title: varchar("title", { length: 200 }),
		summary: text("summary"),
		experience: jsonb("experience").notNull().default([]),
		education: jsonb("education").notNull().default([]),
		skills: jsonb("skills").notNull().default([]),
		certifications: jsonb("certifications").notNull().default([]),
		projects: jsonb("projects").notNull().default([]),
		languages: jsonb("languages").notNull().default([]),
		publications: jsonb("publications").notNull().default([]),
		email: varchar("email", { length: 200 }),
		phone: varchar("phone", { length: 50 }),
		linkedinUrl: text("linkedin_url"),
		portfolioUrl: text("portfolio_url"),
		version: integer("version").notNull().default(1),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("cvs_user_idx").on(table.userId),
		index("cvs_org_idx").on(table.organizationId),
		index("cvs_active_idx").on(table.isActive),
	]
);

export const companyProfiles = pgTable(
	"company_profiles",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: varchar("organization_id", { length: 100 }).notNull().unique(),
		name: varchar("name", { length: 500 }).notNull(),
		description: text("description"),
		mission: text("mission"),
		vision: text("vision"),
		founded: integer("founded"),
		employees: varchar("employees", { length: 100 }),
		revenue: varchar("revenue", { length: 100 }),
		website: varchar("website", { length: 500 }),
		industry: varchar("industry", { length: 200 }),
		specialties: jsonb("specialties").notNull().default([]),
		certifications: jsonb("certifications").notNull().default([]),
		awards: jsonb("awards").notNull().default([]),
		keyClients: jsonb("key_clients").notNull().default([]),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("company_profiles_org_idx").on(table.organizationId),
	]
);

export const clients = pgTable(
	"clients",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		name: varchar("name", { length: 500 }).notNull(),
		industry: varchar("industry", { length: 200 }),
		size: varchar("size", { length: 100 }),
		location: varchar("location", { length: 300 }),
		contactName: varchar("contact_name", { length: 200 }),
		contactEmail: varchar("contact_email", { length: 200 }),
		contactPhone: varchar("contact_phone", { length: 50 }),
		relationshipType: varchar("relationship_type", { length: 100 }),
		contractValue: real("contract_value"),
		startDate: timestamp("start_date", { withTimezone: true }),
		endDate: timestamp("end_date", { withTimezone: true }),
		status: varchar("status", { length: 20 }).notNull().default("prospect"),
		notes: text("notes"),
		projects: jsonb("projects").notNull().default([]),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("clients_org_idx").on(table.organizationId),
		index("clients_status_idx").on(table.status),
		index("clients_industry_idx").on(table.industry),
	]
);

export const products = pgTable(
	"products",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		name: varchar("name", { length: 500 }).notNull(),
		category: varchar("category", { length: 200 }),
		description: text("description"),
		shortDescription: varchar("short_description", { length: 500 }),
		longDescription: text("long_description"),
		websiteUrl: text("website_url"),
		logoUrl: text("logo_url"),
		features: jsonb("features").notNull().default([]),
		pricing: text("pricing"),
		availability: varchar("availability", { length: 100 }),
		documentation: text("documentation"),
		images: jsonb("images").notNull().default([]),
		status: varchar("status", { length: 50 }).notNull().default("active"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("products_org_idx").on(table.organizationId),
		index("products_category_idx").on(table.category),
		index("products_status_idx").on(table.status),
	]
);

export const services = pgTable(
	"services",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		name: varchar("name", { length: 500 }).notNull(),
		category: varchar("category", { length: 200 }),
		description: text("description"),
		capabilities: jsonb("capabilities").notNull().default([]),
		pricing: text("pricing"),
		turnaround: varchar("turnaround", { length: 200 }),
		certifications: jsonb("certifications").notNull().default([]),
		status: varchar("status", { length: 50 }).notNull().default("active"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("services_org_idx").on(table.organizationId),
		index("services_category_idx").on(table.category),
		index("services_status_idx").on(table.status),
	]
);

export const companyVariables = pgTable(
	"company_variables",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		name: varchar("name", { length: 100 }).notNull(),
		label: varchar("label", { length: 200 }).notNull(),
		value: text("value"),
		description: text("description"),
		valueType: varchar("value_type", { length: 20 }).notNull().default("text"),
		category: varchar("category", { length: 100 }),
		sortOrder: integer("sort_order").notNull().default(0),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("company_variables_org_idx").on(table.organizationId),
		index("company_variables_category_idx").on(table.category),
		uniqueIndex("company_variables_org_name_idx").on(table.organizationId, table.name),
	]
);

// Company Relations
export const cvsRelations = relations(cvs, ({ one }) => ({}));
export const companyProfilesRelations = relations(companyProfiles, ({ many }) => ({}));
export const clientsRelations = relations(clients, ({ one }) => ({}));
export const companyVariablesRelations = relations(companyVariables, ({ }) => ({}));

// Company Type exports
export type RoleRow = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type CVRow = typeof cvs.$inferSelect;
export type NewCV = typeof cvs.$inferInsert;
export type CompanyProfileRow = typeof companyProfiles.$inferSelect;
export type NewCompanyProfile = typeof companyProfiles.$inferInsert;
export type ClientRow = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type ProductRow = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ServiceRow = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type CompanyVariableRow = typeof companyVariables.$inferSelect;
export type NewCompanyVariable = typeof companyVariables.$inferInsert;


// ============================================================================
// ============================================================================
//
//  SECTION: CONTENT LIBRARY (Content Library Extensions)
//
// ============================================================================
// ============================================================================

export const snippetEmbeddings = pgTable(
	"snippet_embeddings",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		snippetId: uuid("snippet_id").notNull().references(() => templateSnippets.id, { onDelete: "cascade" }),
		embedding: vector("embedding", { dimensions: 1536 }).notNull(),
		plainText: text("plain_text").notNull(),
		modelVersion: varchar("model_version", { length: 50 }).notNull().default("text-embedding-ada-002"),
		generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("snippet_embeddings_snippet_idx").on(table.snippetId),
		index("snippet_embeddings_generated_idx").on(table.generatedAt),
	]
);

export const snippetAnalytics = pgTable(
	"snippet_analytics",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		snippetId: uuid("snippet_id").notNull().references(() => templateSnippets.id, { onDelete: "cascade" }),

		aiTags: jsonb("ai_tags").notNull().default([]),
		keyTerms: jsonb("key_terms").notNull().default([]),
		contentType: varchar("content_type", { length: 50 }),
		topicCategory: varchar("topic_category", { length: 100 }),
		sectors: jsonb("sectors").notNull().default([]),
		technologies: jsonb("technologies").notNull().default([]),
		complianceFrameworks: jsonb("compliance_frameworks").notNull().default([]),
		topicScores: jsonb("topic_scores").notNull().default({}),

		freshnessStatus: varchar("freshness_status", { length: 20 }).notNull().default("current"),
		reviewDueDate: timestamp("review_due_date", { withTimezone: true }),
		lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
		qualityScore: real("quality_score"),
		wordCount: integer("word_count").notNull().default(0),

		winCount: integer("win_count").notNull().default(0),
		lossCount: integer("loss_count").notNull().default(0),
		winRate: real("win_rate"),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

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

export const snippetUsageLog = pgTable(
	"snippet_usage_log",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		snippetId: uuid("snippet_id").notNull().references(() => templateSnippets.id, { onDelete: "cascade" }),
		documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
		opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),

		usageType: varchar("usage_type", { length: 30 }).notNull().default("inserted"),
		documentSection: varchar("document_section", { length: 200 }),
		wasModified: boolean("was_modified").notNull().default(false),

		proposalOutcome: varchar("proposal_outcome", { length: 30 }).notNull().default("pending"),
		outcomeRecordedAt: timestamp("outcome_recorded_at", { withTimezone: true }),

		usedBy: varchar("used_by", { length: 100 }).notNull(),
		discoveryMethod: varchar("discovery_method", { length: 30 }),
		searchQuery: text("search_query"),

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

export const templateEmbeddings = pgTable(
	"template_embeddings",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		templateId: uuid("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),
		embedding: vector("embedding", { dimensions: 1536 }).notNull(),
		plainText: text("plain_text").notNull(),
		modelVersion: varchar("model_version", { length: 50 }).notNull().default("text-embedding-ada-002"),
		generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("template_embeddings_template_idx").on(table.templateId),
	]
);

export const templateAnalytics = pgTable(
	"template_analytics",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		templateId: uuid("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),

		aiTags: jsonb("ai_tags").notNull().default([]),
		industries: jsonb("industries").notNull().default([]),
		rfpTypes: jsonb("rfp_types").notNull().default([]),

		winCount: integer("win_count").notNull().default(0),
		lossCount: integer("loss_count").notNull().default(0),
		winRate: real("win_rate"),
		averageEvaluatorScore: real("average_evaluator_score"),

		averageQualityScore: real("average_quality_score"),
		userSatisfaction: real("user_satisfaction"),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("template_analytics_template_idx").on(table.templateId),
		index("template_analytics_win_rate_idx").on(table.winRate),
	]
);

export const templateUsageLog = pgTable(
	"template_usage_log",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		templateId: uuid("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),
		documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
		opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),

		proposalOutcome: varchar("proposal_outcome", { length: 30 }).notNull().default("pending"),
		outcomeRecordedAt: timestamp("outcome_recorded_at", { withTimezone: true }),
		evaluatorFeedback: text("evaluator_feedback"),

		usedBy: varchar("used_by", { length: 100 }).notNull(),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("template_usage_template_idx").on(table.templateId),
		index("template_usage_document_idx").on(table.documentId),
		index("template_usage_opportunity_idx").on(table.opportunityId),
		index("template_usage_outcome_idx").on(table.proposalOutcome),
	]
);

export const contentSuggestions = pgTable(
	"content_suggestions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
		opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
		snippetId: uuid("snippet_id").references(() => templateSnippets.id, { onDelete: "cascade" }),
		templateId: uuid("template_id").references(() => templates.id, { onDelete: "cascade" }),

		documentSection: varchar("document_section", { length: 200 }),
		contextText: text("context_text"),
		relevanceScore: real("relevance_score").notNull(),
		confidence: varchar("confidence", { length: 20 }).notNull(),
		reasoning: text("reasoning"),

		userAction: varchar("user_action", { length: 20 }).notNull().default("pending"),
		actionAt: timestamp("action_at", { withTimezone: true }),
		actionBy: varchar("action_by", { length: 100 }),

		wasHelpful: boolean("was_helpful"),

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

export const partialEmbeddings = pgTable(
	"partial_embeddings",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		partialId: uuid("partial_id").notNull().references(() => templatePartials.id, { onDelete: "cascade" }),
		embedding: vector("embedding", { dimensions: 1536 }).notNull(),
		plainText: text("plain_text").notNull(),
		modelVersion: varchar("model_version", { length: 50 }).notNull().default("text-embedding-ada-002"),
		generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("partial_embeddings_partial_idx").on(table.partialId),
	]
);

// Content Library Relations
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

// Content Library Type exports
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

// Content Library Enums
export const CONTENT_TYPES = [
	"boilerplate", "capability", "past_performance", "solution", "approach",
	"bio", "methodology", "executive_summary", "management_approach",
	"technical_approach", "staffing", "quality_assurance", "risk_management",
	"transition", "other",
] as const;

export const FRESHNESS_STATUSES = ["current", "review_needed", "stale", "archived"] as const;
export const USAGE_TYPES = ["inserted", "referenced", "adapted"] as const;
export const PROPOSAL_OUTCOMES = ["pending", "won", "lost", "no_decision", "cancelled"] as const;
export const SUGGESTION_ACTIONS = ["pending", "accepted", "rejected", "ignored"] as const;
export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export const DISCOVERY_METHODS = ["search", "browse", "suggestion", "direct"] as const;

export type ContentType = typeof CONTENT_TYPES[number];
export type FreshnessStatus = typeof FRESHNESS_STATUSES[number];
export type UsageType = typeof USAGE_TYPES[number];
export type ProposalOutcome = typeof PROPOSAL_OUTCOMES[number];
export type SuggestionAction = typeof SUGGESTION_ACTIONS[number];
export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number];
export type DiscoveryMethod = typeof DISCOVERY_METHODS[number];


// ============================================================================
// ============================================================================
//
//  SECTION: PAST PERFORMANCE (Past Performance Management)
//
// ============================================================================
// ============================================================================

export const projects = pgTable("projects", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: uuid("organization_id"),

	name: varchar("name", { length: 500 }).notNull(),
	contractNumber: varchar("contract_number", { length: 100 }),
	taskOrderNumber: varchar("task_order_number", { length: 100 }),

	customerName: varchar("customer_name", { length: 500 }).notNull(),
	customerAgency: varchar("customer_agency", { length: 500 }),
	customerPOC: varchar("customer_poc", { length: 200 }),
	customerPOCEmail: varchar("customer_poc_email", { length: 200 }),
	customerPOCPhone: varchar("customer_poc_phone", { length: 50 }),

	contractType: varchar("contract_type", { length: 100 }),
	contractValue: real("contract_value"),
	periodOfPerformance: jsonb("period_of_performance").$type<{
		start: string;
		end: string;
		options?: { start: string; end: string }[];
	}>(),

	description: text("description"),
	scopeSummary: text("scope_summary"),
	technicalAreas: jsonb("technical_areas").$type<string[]>(),
	naicsCode: varchar("naics_code", { length: 20 }),

	peakStaffing: integer("peak_staffing"),
	keyPersonnel: jsonb("key_personnel").$type<{
		name: string;
		role: string;
		personnelId?: string;
	}[]>(),

	cparRatings: jsonb("cpar_ratings").$type<{
		quality: number;
		schedule: number;
		cost: number;
		management: number;
		smallBusiness?: number;
		overall: number;
		narratives?: {
			quality?: string;
			schedule?: string;
			cost?: string;
			management?: string;
		};
	}>(),

	keyAccomplishments: jsonb("key_accomplishments").$type<string[]>(),
	quantifiedResults: jsonb("quantified_results").$type<{
		metric: string;
		value: string;
		context: string;
		impactArea?: string;
	}[]>(),
	challenges: jsonb("challenges").$type<{
		challenge: string;
		resolution: string;
		outcome: string;
	}[]>(),

	awards: jsonb("awards").$type<{
		name: string;
		date: string;
		issuingOrganization: string;
	}[]>(),

	securityLevel: varchar("security_level", { length: 50 }),
	isActive: boolean("is_active").default(true),

	primeOrSub: varchar("prime_or_sub", { length: 50 }).default("prime"),
	primeContractorName: varchar("prime_contractor_name", { length: 500 }),
	subcontractValue: real("subcontract_value"),

	referenceStatus: varchar("reference_status", { length: 50 }).default("available"),
	referenceNotes: text("reference_notes"),
	lastReferenceCheck: timestamp("last_reference_check", { withTimezone: true }),

	cparNarrative: text("cpar_narrative"),
	briefDescription: text("brief_description"),
	executiveSummary: text("executive_summary"),

	embeddingUpdatedAt: timestamp("embedding_updated_at", { withTimezone: true }),

	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const projectRelevanceScores = pgTable("project_relevance_scores", {
	id: uuid("id").primaryKey().defaultRandom(),
	projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
	opportunityId: uuid("opportunity_id"),

	overallScore: real("overall_score").notNull(),

	recencyScore: real("recency_score"),
	sizeScore: real("size_score"),
	scopeScore: real("scope_score"),
	customerScore: real("customer_score"),
	complexityScore: real("complexity_score"),
	performanceScore: real("performance_score"),

	matchingRequirements: jsonb("matching_requirements").$type<{
		requirementId: string;
		requirementText: string;
		matchStrength: number;
		matchReason: string;
	}[]>(),
	matchingTechnicalAreas: jsonb("matching_technical_areas").$type<string[]>(),
	gaps: jsonb("gaps").$type<{
		area: string;
		severity: "critical" | "moderate" | "minor";
		mitigation?: string;
	}[]>(),

	relevanceNarrative: text("relevance_narrative"),
	strengthsNarrative: text("strengths_narrative"),
	mitigationsNarrative: text("mitigations_narrative"),

	isSelected: boolean("is_selected").default(false),
	selectionRank: integer("selection_rank"),
	selectionNotes: text("selection_notes"),

	calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow(),
	calculatedBy: varchar("calculated_by", { length: 200 }),
});

export const projectDocuments = pgTable("project_documents", {
	id: uuid("id").primaryKey().defaultRandom(),
	projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),

	documentType: varchar("document_type", { length: 100 }).notNull(),
	title: varchar("title", { length: 500 }).notNull(),
	description: text("description"),

	fileUrl: text("file_url"),
	fileName: varchar("file_name", { length: 500 }),
	fileSize: integer("file_size"),
	mimeType: varchar("mime_type", { length: 100 }),

	documentDate: date("document_date"),
	expirationDate: date("expiration_date"),
	isConfidential: boolean("is_confidential").default(false),

	uploadedBy: varchar("uploaded_by", { length: 200 }),
	uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow(),
});

export const projectTags = pgTable("project_tags", {
	id: uuid("id").primaryKey().defaultRandom(),
	projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),

	tagName: varchar("tag_name", { length: 100 }).notNull(),
	tagCategory: varchar("tag_category", { length: 100 }),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const pastPerfVolumes = pgTable("past_perf_volumes", {
	id: uuid("id").primaryKey().defaultRandom(),
	opportunityId: uuid("opportunity_id"),

	title: varchar("title", { length: 500 }).notNull(),
	version: integer("version").default(1),

	maxProjects: integer("max_projects"),
	maxPages: integer("max_pages"),
	formatRequirements: text("format_requirements"),

	selectedProjectIds: jsonb("selected_project_ids").$type<string[]>(),

	introductionNarrative: text("introduction_narrative"),
	conclusionNarrative: text("conclusion_narrative"),

	status: varchar("status", { length: 50 }).default("draft"),

	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Past Performance Relations
export const projectsRelations = relations(projects, ({ many }) => ({
	relevanceScores: many(projectRelevanceScores),
	documents: many(projectDocuments),
	tags: many(projectTags),
}));

export const projectRelevanceScoresRelations = relations(projectRelevanceScores, ({ one }) => ({
	project: one(projects, {
		fields: [projectRelevanceScores.projectId],
		references: [projects.id],
	}),
}));

export const projectDocumentsRelations = relations(projectDocuments, ({ one }) => ({
	project: one(projects, {
		fields: [projectDocuments.projectId],
		references: [projects.id],
	}),
}));

export const projectTagsRelations = relations(projectTags, ({ one }) => ({
	project: one(projects, {
		fields: [projectTags.projectId],
		references: [projects.id],
	}),
}));

// Past Performance Type exports
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectRelevanceScore = typeof projectRelevanceScores.$inferSelect;
export type NewProjectRelevanceScore = typeof projectRelevanceScores.$inferInsert;
export type ProjectDocument = typeof projectDocuments.$inferSelect;
export type NewProjectDocument = typeof projectDocuments.$inferInsert;
export type ProjectTag = typeof projectTags.$inferSelect;
export type PastPerfVolume = typeof pastPerfVolumes.$inferSelect;


// ============================================================================
// ============================================================================
//
//  SECTION: PERSONNEL (Personnel & Resume Management)
//
// ============================================================================
// ============================================================================

export const personnel = pgTable("personnel", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: uuid("organization_id"),

	firstName: varchar("first_name", { length: 100 }).notNull(),
	lastName: varchar("last_name", { length: 100 }).notNull(),
	email: varchar("email", { length: 200 }),
	phone: varchar("phone", { length: 50 }),
	photoUrl: text("photo_url"),

	employmentType: varchar("employment_type", { length: 50 }),
	startDate: date("start_date"),
	endDate: date("end_date"),
	department: varchar("department", { length: 100 }),
	currentTitle: varchar("current_title", { length: 200 }),
	location: varchar("location", { length: 200 }),

	resumeFull: text("resume_full"),
	resumeBrief: text("resume_brief"),
	resumeFederal: text("resume_federal"),
	linkedInUrl: text("linkedin_url"),

	education: jsonb("education").$type<
		{
			degree: string;
			field: string;
			institution: string;
			year: number;
			gpa?: number;
			honors?: string;
		}[]
	>(),

	certifications: jsonb("certifications").$type<
		{
			name: string;
			issuer: string;
			dateObtained: string;
			expirationDate?: string;
			certificationNumber?: string;
			status: "active" | "expired" | "pending";
		}[]
	>(),

	clearanceLevel: varchar("clearance_level", { length: 100 }),
	clearanceStatus: varchar("clearance_status", { length: 50 }),
	clearanceExpiration: date("clearance_expiration"),
	clearanceInvestigationType: varchar("clearance_investigation_type", { length: 50 }),
	clearancePolygraph: boolean("clearance_polygraph").default(false),

	availability: varchar("availability", { length: 50 }).default("available"),
	availableDate: date("available_date"),
	currentProposals: jsonb("current_proposals").$type<string[]>().default([]),
	maxCommitment: integer("max_commitment").default(100),

	skills: jsonb("skills").$type<
		{
			skillId: string;
			skillName: string;
			proficiency: "beginner" | "intermediate" | "advanced" | "expert";
			yearsExperience: number;
			lastUsed?: string;
		}[]
	>(),

	professionalSummary: text("professional_summary"),
	keyAchievements: jsonb("key_achievements").$type<string[]>(),
	publications: jsonb("publications").$type<
		{
			title: string;
			publisher: string;
			date: string;
			url?: string;
		}[]
	>(),
	awards: jsonb("awards").$type<
		{
			name: string;
			issuer: string;
			date: string;
		}[]
	>(),

	languages: jsonb("languages").$type<
		{
			language: string;
			proficiency: "basic" | "conversational" | "professional" | "native";
		}[]
	>(),

	laborCategories: jsonb("labor_categories").$type<
		{
			contractVehicle: string;
			laborCategory: string;
			rate?: number;
		}[]
	>(),

	proposalWinCount: integer("proposal_win_count").default(0),
	proposalSubmitCount: integer("proposal_submit_count").default(0),
	yearsOfExperience: integer("years_of_experience"),

	isActive: boolean("is_active").default(true),
	lastResumeUpdate: timestamp("last_resume_update", { withTimezone: true }),

	embeddingUpdatedAt: timestamp("embedding_updated_at", { withTimezone: true }),

	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const skillsTaxonomy = pgTable("skills_taxonomy", {
	id: uuid("id").primaryKey().defaultRandom(),

	name: varchar("name", { length: 200 }).notNull(),
	category: varchar("category", { length: 100 }).notNull(),
	subcategory: varchar("subcategory", { length: 100 }),

	description: text("description"),

	synonyms: jsonb("synonyms").$type<string[]>().default([]),
	relatedSkills: jsonb("related_skills").$type<string[]>().default([]),

	parentId: uuid("parent_id"),
	level: integer("level").default(0),

	usageCount: integer("usage_count").default(0),

	isActive: boolean("is_active").default(true),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const personnelExperience = pgTable("personnel_experience", {
	id: uuid("id").primaryKey().defaultRandom(),
	personnelId: uuid("personnel_id").references(() => personnel.id, { onDelete: "cascade" }),

	title: varchar("title", { length: 200 }).notNull(),
	company: varchar("company", { length: 200 }),
	projectId: uuid("project_id"),
	client: varchar("client", { length: 200 }),

	startDate: date("start_date"),
	endDate: date("end_date"),
	isCurrent: boolean("is_current").default(false),

	description: text("description"),
	accomplishments: jsonb("accomplishments").$type<string[]>(),

	scope: jsonb("scope").$type<{
		teamSize?: number;
		budgetSize?: number;
		responsibilities?: string[];
	}>(),

	skillsUsed: jsonb("skills_used").$type<string[]>(),

	contractType: varchar("contract_type", { length: 50 }),
	contractValue: real("contract_value"),
	laborCategory: varchar("labor_category", { length: 100 }),

	location: varchar("location", { length: 200 }),
	isRemote: boolean("is_remote").default(false),

	proofOfWork: jsonb("proof_of_work").$type<{
		repositories?: {
			type: "github" | "gitlab" | "bitbucket" | "other";
			url: string;
			name: string;
			description?: string;
			role?: string;
			stars?: number;
			commits?: number;
		}[];
		articles?: {
			type: "blog" | "article" | "whitepaper" | "case_study" | "book" | "other";
			title: string;
			url: string;
			publisher?: string;
			publishDate?: string;
			description?: string;
		}[];
		videos?: {
			type: "youtube" | "vimeo" | "presentation" | "webinar" | "tutorial" | "other";
			title: string;
			url: string;
			thumbnailUrl?: string;
			duration?: number;
			views?: number;
			description?: string;
			recordedDate?: string;
		}[];
		audio?: {
			type: "podcast" | "interview" | "presentation" | "discussion" | "other";
			title: string;
			url: string;
			duration?: number;
			description?: string;
			recordedDate?: string;
			platform?: string;
		}[];
		awards?: {
			name: string;
			issuer: string;
			date: string;
			description?: string;
			url?: string;
		}[];
		certificationsEarned?: {
			name: string;
			issuer: string;
			date: string;
			url?: string;
		}[];
		patents?: {
			title: string;
			number?: string;
			filingDate?: string;
			status: "filed" | "pending" | "granted" | "expired";
			url?: string;
			description?: string;
		}[];
		references?: {
			name: string;
			title: string;
			company: string;
			relationship: string;
			email?: string;
			phone?: string;
			linkedIn?: string;
			canContact: boolean;
		}[];
		metrics?: {
			name: string;
			value: string;
			description?: string;
			verifiable: boolean;
		}[];
		links?: {
			type: "portfolio" | "demo" | "documentation" | "slide_deck" | "other";
			title: string;
			url: string;
			description?: string;
		}[];
	}>(),

	commentary: jsonb("commentary").$type<{
		narrative?: string;
		lessonsLearned?: string[];
		challengesOvercome?: {
			challenge: string;
			solution: string;
			outcome: string;
		}[];
		technicalDecisions?: {
			decision: string;
			context: string;
			rationale: string;
			outcome: string;
		}[];
		leadershipMoments?: {
			situation: string;
			action: string;
			result: string;
		}[];
		recordings?: {
			type: "audio" | "video";
			title: string;
			url: string;
			duration?: number;
			transcript?: string;
			recordedDate?: string;
		}[];
	}>(),

	displayOrder: integer("display_order"),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const positionRequirements = pgTable("position_requirements", {
	id: uuid("id").primaryKey().defaultRandom(),
	opportunityId: uuid("opportunity_id"),

	positionTitle: varchar("position_title", { length: 200 }).notNull(),
	positionCategory: varchar("position_category", { length: 100 }),
	laborCategory: varchar("labor_category", { length: 100 }),
	positionNumber: varchar("position_number", { length: 50 }),

	requiredSkills: jsonb("required_skills").$type<
		{
			skillId: string;
			skillName: string;
			minProficiency: "beginner" | "intermediate" | "advanced" | "expert";
			required: boolean;
		}[]
	>(),
	requiredEducation: varchar("required_education", { length: 200 }),
	minimumEducation: varchar("minimum_education", { length: 100 }),
	preferredEducation: varchar("preferred_education", { length: 100 }),
	requiredExperience: integer("required_experience"),
	preferredExperience: integer("preferred_experience"),
	requiredClearance: varchar("required_clearance", { length: 100 }),
	requiredCertifications: jsonb("required_certifications").$type<string[]>(),
	preferredCertifications: jsonb("preferred_certifications").$type<string[]>(),

	description: text("description"),
	responsibilities: jsonb("responsibilities").$type<string[]>(),

	headcount: integer("headcount").default(1),
	startDate: date("start_date"),
	endDate: date("end_date"),
	duration: integer("duration"),
	hoursPerWeek: integer("hours_per_week").default(40),
	locationRequired: varchar("location_required", { length: 200 }),
	remoteAllowed: boolean("remote_allowed").default(false),

	assignedPersonnelId: uuid("assigned_personnel_id").references(() => personnel.id),
	assignmentStatus: varchar("assignment_status", { length: 50 }).default("open"),
	assignmentNotes: text("assignment_notes"),
	assignedAt: timestamp("assigned_at", { withTimezone: true }),
	assignedBy: varchar("assigned_by", { length: 200 }),

	matchScore: real("match_score"),
	matchDetails: jsonb("match_details").$type<{
		skillsMatch: number;
		experienceMatch: number;
		educationMatch: number;
		clearanceMatch: number;
		certificationMatch: number;
		availabilityMatch: number;
		gaps: string[];
	}>(),

	backupCandidates: jsonb("backup_candidates").$type<
		{
			personnelId: string;
			matchScore: number;
			notes?: string;
		}[]
	>(),

	proposalSectionId: uuid("proposal_section_id"),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const personnelAvailability = pgTable("personnel_availability", {
	id: uuid("id").primaryKey().defaultRandom(),
	personnelId: uuid("personnel_id").references(() => personnel.id, { onDelete: "cascade" }),

	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),

	commitment: integer("commitment").notNull(),
	opportunityId: uuid("opportunity_id"),
	opportunityName: varchar("opportunity_name", { length: 500 }),

	status: varchar("status", { length: 50 }).default("committed"),

	notes: text("notes"),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const resumeTemplates = pgTable("resume_templates", {
	id: uuid("id").primaryKey().defaultRandom(),

	name: varchar("name", { length: 200 }).notNull(),
	format: varchar("format", { length: 50 }).notNull(),
	description: text("description"),

	templateContent: text("template_content").notNull(),
	templateType: varchar("template_type", { length: 50 }).default("latex"),

	sections: jsonb("sections").$type<
		{
			name: string;
			key: string;
			required: boolean;
			order: number;
			maxLength?: number;
		}[]
	>(),

	maxPages: integer("max_pages"),
	targetWordCount: integer("target_word_count"),

	complianceNotes: text("compliance_notes"),

	isDefault: boolean("is_default").default(false),
	isActive: boolean("is_active").default(true),

	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Personnel Relations
export const personnelRelations = relations(personnel, ({ many }) => ({
	experience: many(personnelExperience),
	availability: many(personnelAvailability),
	positions: many(positionRequirements),
}));

export const personnelExperienceRelations = relations(personnelExperience, ({ one }) => ({
	personnel: one(personnel, {
		fields: [personnelExperience.personnelId],
		references: [personnel.id],
	}),
}));

export const positionRequirementsRelations = relations(positionRequirements, ({ one }) => ({
	assignedPersonnel: one(personnel, {
		fields: [positionRequirements.assignedPersonnelId],
		references: [personnel.id],
	}),
}));

export const personnelAvailabilityRelations = relations(personnelAvailability, ({ one }) => ({
	personnel: one(personnel, {
		fields: [personnelAvailability.personnelId],
		references: [personnel.id],
	}),
}));

export const skillsTaxonomyRelations = relations(skillsTaxonomy, ({ one }) => ({
	parent: one(skillsTaxonomy, {
		fields: [skillsTaxonomy.parentId],
		references: [skillsTaxonomy.id],
	}),
}));

// Personnel Type exports
export type Personnel = typeof personnel.$inferSelect;
export type NewPersonnel = typeof personnel.$inferInsert;
export type SkillTaxonomy = typeof skillsTaxonomy.$inferSelect;
export type NewSkillTaxonomy = typeof skillsTaxonomy.$inferInsert;
export type PersonnelExperience = typeof personnelExperience.$inferSelect;
export type NewPersonnelExperience = typeof personnelExperience.$inferInsert;
export type PositionRequirement = typeof positionRequirements.$inferSelect;
export type NewPositionRequirement = typeof positionRequirements.$inferInsert;
export type PersonnelAvailability = typeof personnelAvailability.$inferSelect;
export type ResumeTemplate = typeof resumeTemplates.$inferSelect;
