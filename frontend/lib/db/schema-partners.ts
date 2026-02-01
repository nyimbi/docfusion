/**
 * Extended Partner Schema
 *
 * Extends the base partners table with detailed partner information
 * and adds communication tracking for partner interactions.
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

// ============================================================================
// Partners (Extended)
// ============================================================================

/**
 * Partners table with comprehensive partner information.
 * Stores partner prospects, teaming partners, and collaborators.
 */
export const partners = pgTable(
	"partners",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		// Basic Information
		/** Partner organization name */
		name: varchar("name", { length: 500 }).notNull(),
		/** Country where partner is headquartered */
		country: varchar("country", { length: 100 }),
		/** Geographic region (e.g., "East Africa", "Southern Africa") */
		region: varchar("region", { length: 100 }),
		/** Corporate status (e.g., "Private", "Public", "Multinational") */
		corporateStatus: varchar("corporate_status", { length: 100 }),
		/** Year founded or founding date */
		foundingDate: varchar("founding_date", { length: 50 }),
		/** Detailed company description/profile */
		description: text("description"),

		// Contact Information
		/** Primary contact name */
		contactName: varchar("contact_name", { length: 200 }),
		/** Contact email */
		contactEmail: varchar("contact_email", { length: 200 }),
		/** Contact phone */
		contactPhone: varchar("contact_phone", { length: 100 }),
		/** Company website URL */
		website: varchar("website", { length: 500 }),
		/** Physical address */
		address: text("address"),

		// Organizational Details
		/** Key leadership and executives */
		leadership: text("leadership"),
		/** Notable clients and projects */
		notableClients: text("notable_clients"),
		/** Revenue estimate (e.g., "$1M-$5M", "$10M+") */
		revenueEstimate: varchar("revenue_estimate", { length: 100 }),
		/** Employee count or range (e.g., "20-50", "100+") */
		employeeCount: varchar("employee_count", { length: 50 }),
		/** Funding status (e.g., "Seed funding", "Series A", "Not disclosed") */
		fundingStatus: varchar("funding_status", { length: 200 }),

		// Capabilities & Classification
		/** Partner type: "prime", "sub", "consultant", "vendor", "prospect" */
		type: varchar("type", { length: 50 }).notNull().default("prospect"),
		/** Core capabilities/services as text */
		coreCapabilities: text("core_capabilities"),
		/** Capabilities as structured list for filtering */
		capabilities: jsonb("capabilities").notNull().default([]),
		/** Industry sector tags */
		sectors: jsonb("sectors").notNull().default([]),

		// Competitive Intelligence
		/** Relationships with competitors */
		competitorRelationships: text("competitor_relationships"),
		/** Risk assessment notes */
		riskAssessment: text("risk_assessment"),

		// Partnership Evaluation
		/** Partnership fit score (0-10 scale) */
		partnershipFitScore: real("partnership_fit_score"),
		/** Justification for fit score */
		fitJustification: text("fit_justification"),
		/** Partner tier: 1 (highest priority), 2, 3 */
		tier: integer("tier"),
		/** Priority actions needed */
		priorityActions: text("priority_actions"),

		// Collaboration History
		/** Number of past collaborations */
		pastCollaborations: integer("past_collaborations").notNull().default(0),
		/** Performance rating (1-5) */
		performanceRating: real("performance_rating"),

		// Internal Notes
		/** Internal notes about the partner */
		notes: text("notes"),
		/** Tags for categorization */
		tags: jsonb("tags").notNull().default([]),

		// Status & Metadata
		/** Active/inactive/prospect status */
		status: varchar("status", { length: 20 }).notNull().default("prospect"),
		/** Source of partner data (e.g., "excel_import", "manual", "crm") */
		source: varchar("source", { length: 100 }),
		/** Original source file if imported */
		sourceFile: varchar("source_file", { length: 500 }),
		/** Extended metadata */
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

// ============================================================================
// Partner Communications
// ============================================================================

/**
 * Tracks all communications and interactions with partners.
 * Includes meetings, emails, calls, messages, and other touchpoints.
 */
export const partnerCommunications = pgTable(
	"partner_communications",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		partnerId: uuid("partner_id").notNull().references(() => partners.id, { onDelete: "cascade" }),

		// Communication Details
		/** Type: "email", "call", "meeting", "message", "linkedin", "conference", "other" */
		communicationType: varchar("communication_type", { length: 50 }).notNull(),
		/** Direction: "inbound", "outbound", "bidirectional" */
		direction: varchar("direction", { length: 20 }).notNull().default("outbound"),
		/** Subject or title of communication */
		subject: varchar("subject", { length: 500 }),
		/** Full content/notes from the communication */
		content: text("content"),
		/** Summary of key points */
		summary: text("summary"),

		// Participants
		/** Our team member(s) involved */
		ourParticipants: jsonb("our_participants").notNull().default([]),
		/** Partner contact(s) involved */
		partnerContacts: jsonb("partner_contacts").notNull().default([]),
		/** User who logged this communication */
		loggedBy: varchar("logged_by", { length: 100 }).notNull().default("system"),

		// Timing
		/** When the communication occurred */
		communicationDate: timestamp("communication_date", { withTimezone: true }).notNull(),
		/** Duration in minutes (for calls/meetings) */
		durationMinutes: integer("duration_minutes"),

		// Outcomes & Follow-up
		/** Outcome/result of the communication */
		outcome: text("outcome"),
		/** Action items from this communication */
		actionItems: jsonb("action_items").notNull().default([]),
		/** Next steps planned */
		nextSteps: text("next_steps"),
		/** Follow-up date if scheduled */
		followUpDate: timestamp("follow_up_date", { withTimezone: true }),
		/** Whether follow-up has been completed */
		followUpCompleted: boolean("follow_up_completed").notNull().default(false),

		// Sentiment & Classification
		/** Sentiment: "positive", "neutral", "negative", "mixed" */
		sentiment: varchar("sentiment", { length: 20 }),
		/** Opportunity ID if related to specific opportunity */
		opportunityId: uuid("opportunity_id"),
		/** Tags for categorization */
		tags: jsonb("tags").notNull().default([]),

		// Attachments & References
		/** File attachments (URLs or references) */
		attachments: jsonb("attachments").notNull().default([]),
		/** External reference (email thread ID, calendar event, etc.) */
		externalReference: varchar("external_reference", { length: 500 }),

		// Metadata
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

// ============================================================================
// Partner Notes (Quick Notes / Activity Log)
// ============================================================================

/**
 * Quick notes and activity log for partners.
 * For informal notes that don't fit the formal communication structure.
 */
export const partnerNotes = pgTable(
	"partner_notes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		partnerId: uuid("partner_id").notNull().references(() => partners.id, { onDelete: "cascade" }),

		/** Note content */
		content: text("content").notNull(),
		/** Note type: "general", "insight", "concern", "reminder", "research" */
		noteType: varchar("note_type", { length: 30 }).notNull().default("general"),
		/** Whether this note is pinned/important */
		isPinned: boolean("is_pinned").notNull().default(false),
		/** Author user ID */
		authorId: varchar("author_id", { length: 100 }).notNull(),
		/** Author display name */
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

// ============================================================================
// Partner Import History
// ============================================================================

/**
 * Tracks partner data imports for audit and deduplication.
 */
export const partnerImports = pgTable(
	"partner_imports",
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
		index("partner_imports_status_idx").on(table.status),
		index("partner_imports_started_idx").on(table.startedAt),
	]
);

// NOTE: Relations for partners are defined in schema.ts to avoid circular dependencies
// with opportunityPartners table.

// ============================================================================
// Type Exports
// ============================================================================

export type PartnerRow = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;

export type PartnerCommunicationRow = typeof partnerCommunications.$inferSelect;
export type NewPartnerCommunication = typeof partnerCommunications.$inferInsert;

export type PartnerNoteRow = typeof partnerNotes.$inferSelect;
export type NewPartnerNote = typeof partnerNotes.$inferInsert;

export type PartnerImportRow = typeof partnerImports.$inferSelect;
export type NewPartnerImport = typeof partnerImports.$inferInsert;
