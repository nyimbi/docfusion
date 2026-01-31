/**
 * CRM Database Schema for DocFusion
 *
 * Comprehensive CRM system managing:
 * - Accounts (Partners, Prospects, Leads, Customers, Vendors)
 * - Contacts (Individual people associated with accounts)
 * - Activities (All interactions and timeline events)
 * - Deals (Sales pipeline tracking)
 * - Documents (Universal document storage with polymorphic relations)
 * - Stage History (Pipeline transition audit trail)
 *
 * Design Philosophy:
 * - Unified entity pattern: Single accounts table with type discriminator
 * - Full audit trail: Stage history tracks all pipeline transitions
 * - Polymorphic relations: Documents can attach to any entity type
 * - Flexible filtering: Indexed fields for efficient queries by type, stage, region
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
import { opportunities } from "./schema";

// ============================================================================
// ACCOUNTS (Unified entity for all relationship types)
// ============================================================================

/**
 * Unified accounts table supporting multiple relationship types.
 *
 * Account Types:
 * - partner: Teaming/collaboration partners for joint bids
 * - prospect: Early-stage potential customers (not yet qualified)
 * - lead: Qualified prospects actively being pursued
 * - customer: Active paying customers
 * - vendor: Suppliers and service providers
 * - other: General contacts not fitting other categories
 *
 * Pipeline Stages vary by type - see ACCOUNT_STAGES constant in types file.
 */
export const accounts = pgTable(
	"accounts",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		// ===== Core Identity =====
		/** Organization/company name */
		name: varchar("name", { length: 500 }).notNull(),
		/** Account type discriminator */
		type: varchar("type", { length: 50 }).notNull(),

		// ===== Classification =====
		/** Primary industry (e.g., "Technology", "Healthcare", "Finance") */
		industry: varchar("industry", { length: 100 }),
		/** Industry sector (e.g., "Software", "Medical Devices") */
		sector: varchar("sector", { length: 100 }),
		/** Industry sub-sector for finer classification */
		subSector: varchar("sub_sector", { length: 100 }),
		/** Company size category: micro, small, medium, large, enterprise */
		companySize: varchar("company_size", { length: 50 }),

		// ===== Location =====
		/** Country where account is headquartered */
		country: varchar("country", { length: 100 }),
		/** Geographic region (e.g., "East Africa", "EMEA", "North America") */
		region: varchar("region", { length: 100 }),
		/** City/locality */
		city: varchar("city", { length: 100 }),
		/** Full street address */
		address: text("address"),
		/** IANA timezone identifier (e.g., "America/New_York") */
		timezone: varchar("timezone", { length: 50 }),

		// ===== Communication Preferences =====
		/** Primary business language (ISO 639-1 code) */
		primaryLanguage: varchar("primary_language", { length: 50 }).default("en"),
		/** Additional languages spoken */
		additionalLanguages: jsonb("additional_languages").$type<string[]>().default([]),
		/** Preferred contact method: email, phone, linkedin, whatsapp, in_person */
		preferredContactMethod: varchar("preferred_contact_method", { length: 50 }),

		// ===== Company Details =====
		/** Detailed company description/profile */
		description: text("description"),
		/** Company website URL */
		website: varchar("website", { length: 500 }),
		/** LinkedIn company page URL */
		linkedinUrl: varchar("linkedin_url", { length: 500 }),
		/** Year the company was founded */
		foundedYear: integer("founded_year"),
		/** Employee count or range description */
		employeeCount: varchar("employee_count", { length: 50 }),
		/** Annual revenue estimate (e.g., "$1M-$5M", "$10M+") */
		annualRevenue: varchar("annual_revenue", { length: 100 }),
		/** Month when fiscal year ends (e.g., "December", "March") */
		fiscalYearEnd: varchar("fiscal_year_end", { length: 20 }),

		// ===== Contact Information (Company-Level) =====
		/** Primary company email address */
		email: varchar("email", { length: 255 }),
		/** Primary company phone number */
		phone: varchar("phone", { length: 100 }),
		/** Headquarters location (if different from address) */
		headquarters: varchar("headquarters", { length: 255 }),

		// ===== Classification (Extended) =====
		/** High-level category for organization (e.g., "Government Security", "Private Foundation") */
		category: varchar("category", { length: 200 }),
		/** Sub-category for finer classification */
		subCategory: varchar("sub_category", { length: 200 }),
		/** Organization type (e.g., "Intelligence", "Foundation", "NGO") */
		organizationType: varchar("organization_type", { length: 100 }),

		// ===== Partner-Specific Fields =====
		/** Partner tier: 1 (strategic), 2 (preferred), 3 (approved) */
		partnerTier: integer("partner_tier"),
		/** AI-calculated partnership fit score (0-100) */
		partnershipFitScore: real("partnership_fit_score"),
		/** Core capabilities description (text format) */
		coreCapabilities: text("core_capabilities"),
		/** Capabilities as structured list for filtering */
		capabilities: jsonb("capabilities").$type<string[]>().default([]),
		/** Corporate status (e.g., "Private", "Public", "Multinational") */
		corporateStatus: varchar("corporate_status", { length: 100 }),
		/** Notable clients or projects */
		notableClients: text("notable_clients"),
		/** Risk assessment level: LOW, MEDIUM, HIGH */
		riskAssessment: varchar("risk_assessment", { length: 100 }),
		/** Justification for partnership fit score */
		fitJustification: text("fit_justification"),

		// ===== Grant Maker-Specific Fields =====
		/** Annual giving amount in USD */
		annualGiving: varchar("annual_giving", { length: 100 }),
		/** Focus areas for funding (e.g., "Democracy; Civil Society; Human Rights") */
		focusAreas: text("focus_areas"),
		/** Typical grant range (e.g., "$50,000 - $5,000,000+") */
		grantRange: varchar("grant_range", { length: 200 }),
		/** Geographic focus for funding */
		geographicFocus: text("geographic_focus"),
		/** Application process description */
		applicationProcess: text("application_process"),
		/** Notable past grants and funding history */
		grantHistory: text("grant_history"),
		/** Peacebuilding/impact relevance score (0-10) */
		impactScore: integer("impact_score"),

		// ===== Customer-Specific Fields =====
		/** Date when account became a customer */
		customerSince: timestamp("customer_since", { withTimezone: true }),
		/** Total contract value */
		contractValue: real("contract_value"),
		/** Currency for contract value (ISO 4217 code) */
		contractCurrency: varchar("contract_currency", { length: 10 }).default("USD"),
		/** Next contract renewal date */
		contractRenewalDate: timestamp("contract_renewal_date", { withTimezone: true }),
		/** Customer health score (0-100) based on engagement metrics */
		customerHealthScore: integer("customer_health_score"),
		/** Churn risk assessment: low, medium, high */
		churnRisk: varchar("churn_risk", { length: 20 }),

		// ===== Pipeline & Status =====
		/** Current pipeline stage (varies by account type) */
		stage: varchar("stage", { length: 50 }).default("new"),
		/** Account status: active, inactive, churned, lost, archived */
		status: varchar("status", { length: 50 }).default("active"),

		// ===== Ownership & Assignment =====
		/** User ID of account owner/manager */
		ownerId: varchar("owner_id", { length: 255 }),
		/** Display name of account owner */
		ownerName: varchar("owner_name", { length: 255 }),
		/** Team ID if assigned to a team */
		teamId: varchar("team_id", { length: 255 }),

		// ===== Engagement Tracking =====
		/** Date of last interaction with this account */
		lastContactDate: timestamp("last_contact_date", { withTimezone: true }),
		/** Scheduled date for next follow-up */
		nextFollowUpDate: timestamp("next_follow_up_date", { withTimezone: true }),
		/** Engagement score based on interaction frequency (0-100) */
		engagementScore: integer("engagement_score"),

		// ===== Lead/Prospect Scoring =====
		/** Lead score for prioritization (0-100) */
		leadScore: integer("lead_score"),
		/** Original source of the lead */
		leadSource: varchar("lead_source", { length: 100 }),
		/** Detailed lead source information */
		leadSourceDetail: varchar("lead_source_detail", { length: 255 }),
		/** Qualification status: unqualified, mql, sql, opportunity, customer */
		qualificationStatus: varchar("qualification_status", { length: 50 }),

		// ===== Prospect-Specific Fields =====
		/** Key leadership contacts (names and titles) */
		keyLeadership: text("key_leadership"),
		/** Suggested pitching angle or value proposition for this prospect */
		pitchingAngle: text("pitching_angle"),
		/** Priority tier for outreach (e.g., "Tier 1 - Immediate", "Tier 2 - High Priority") */
		priorityTier: varchar("priority_tier", { length: 100 }),

		// ===== Metadata =====
		/** Tags for categorization and filtering */
		tags: jsonb("tags").$type<string[]>().default([]),
		/** Custom fields for extensibility */
		customFields: jsonb("custom_fields").$type<Record<string, unknown>>(),
		/** Data source identifier (e.g., "manual", "import", "api") */
		source: varchar("source", { length: 100 }),
		/** Original source file if imported */
		sourceFile: varchar("source_file", { length: 500 }),

		// ===== Audit =====
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
		/** User ID who created this account */
		createdBy: varchar("created_by", { length: 255 }),
		/** User ID who last updated this account */
		updatedBy: varchar("updated_by", { length: 255 }),
	},
	(table) => [
		// Primary query indexes
		index("accounts_type_idx").on(table.type),
		index("accounts_status_idx").on(table.status),
		index("accounts_stage_idx").on(table.stage),
		index("accounts_country_idx").on(table.country),
		index("accounts_region_idx").on(table.region),
		index("accounts_industry_idx").on(table.industry),
		index("accounts_owner_idx").on(table.ownerId),

		// Scoring and prioritization indexes
		index("accounts_lead_score_idx").on(table.leadScore),
		index("accounts_partner_tier_idx").on(table.partnerTier),
		index("accounts_fit_score_idx").on(table.partnershipFitScore),
		index("accounts_health_score_idx").on(table.customerHealthScore),
		index("accounts_priority_tier_idx").on(table.priorityTier),
		index("accounts_impact_score_idx").on(table.impactScore),
		index("accounts_category_idx").on(table.category),
		index("accounts_org_type_idx").on(table.organizationType),

		// Date-based indexes
		index("accounts_last_contact_idx").on(table.lastContactDate),
		index("accounts_next_followup_idx").on(table.nextFollowUpDate),
		index("accounts_created_idx").on(table.createdAt),
		index("accounts_updated_idx").on(table.updatedAt),

		// Composite indexes for common queries
		index("accounts_type_status_idx").on(table.type, table.status),
		index("accounts_type_stage_idx").on(table.type, table.stage),

		// Uniqueness constraint
		uniqueIndex("accounts_name_country_type_idx").on(table.name, table.country, table.type),
	]
);

// ============================================================================
// CONTACTS (Individual people associated with accounts)
// ============================================================================

/**
 * Contacts table for managing individual people.
 *
 * Contacts can be linked to accounts or exist independently.
 * Tracks communication preferences, relationship strength, and engagement.
 */
export const contacts = pgTable(
	"contacts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Associated account (optional - contacts can exist independently) */
		accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),

		// ===== Identity =====
		/** First/given name */
		firstName: varchar("first_name", { length: 100 }).notNull(),
		/** Last/family name */
		lastName: varchar("last_name", { length: 100 }).notNull(),
		/** Full display name (computed or override) */
		fullName: varchar("full_name", { length: 255 }),
		/** Salutation: Mr., Ms., Dr., Prof., etc. */
		salutation: varchar("salutation", { length: 20 }),

		// ===== Professional Info =====
		/** Job title */
		title: varchar("title", { length: 200 }),
		/** Department within organization */
		department: varchar("department", { length: 100 }),
		/** Role in decision making: decision_maker, influencer, champion, blocker, user */
		role: varchar("role", { length: 100 }),
		/** Seniority level: c_level, vp, director, manager, individual */
		seniority: varchar("seniority", { length: 50 }),

		// ===== Contact Details =====
		/** Primary email address */
		email: varchar("email", { length: 255 }),
		/** Secondary/personal email */
		emailSecondary: varchar("email_secondary", { length: 255 }),
		/** Primary phone number */
		phone: varchar("phone", { length: 50 }),
		/** Mobile phone number */
		phoneMobile: varchar("phone_mobile", { length: 50 }),
		/** Work/office phone */
		phoneWork: varchar("phone_work", { length: 50 }),
		/** LinkedIn profile URL */
		linkedinUrl: varchar("linkedin_url", { length: 500 }),

		// ===== Location =====
		/** Country of residence */
		country: varchar("country", { length: 100 }),
		/** City/locality */
		city: varchar("city", { length: 100 }),
		/** IANA timezone identifier */
		timezone: varchar("timezone", { length: 50 }),

		// ===== Communication Preferences =====
		/** Preferred language (ISO 639-1 code) */
		preferredLanguage: varchar("preferred_language", { length: 50 }).default("en"),
		/** Preferred contact method: email, phone, linkedin, whatsapp */
		preferredContactMethod: varchar("preferred_contact_method", { length: 50 }),
		/** Best time to reach this contact */
		bestTimeToContact: varchar("best_time_to_contact", { length: 100 }),
		/** Global do not contact flag */
		doNotContact: boolean("do_not_contact").default(false),
		/** Do not send emails */
		doNotEmail: boolean("do_not_email").default(false),
		/** Do not call */
		doNotCall: boolean("do_not_call").default(false),

		// ===== Relationship =====
		/** Whether this is the primary contact for the account */
		isPrimaryContact: boolean("is_primary_contact").default(false),
		/** Relationship warmth: cold, warm, hot */
		relationshipStrength: varchar("relationship_strength", { length: 20 }),
		/** Level of influence in decisions: low, medium, high */
		influence: varchar("influence", { length: 20 }),
		/** Sentiment towards us: negative, neutral, positive, champion */
		sentiment: varchar("sentiment", { length: 20 }),

		// ===== Engagement =====
		/** Date of last interaction */
		lastContactDate: timestamp("last_contact_date", { withTimezone: true }),
		/** Scheduled next follow-up date */
		nextFollowUpDate: timestamp("next_follow_up_date", { withTimezone: true }),
		/** Total number of logged interactions */
		totalInteractions: integer("total_interactions").default(0),

		// ===== Notes & Tags =====
		/** Free-form notes about this contact */
		notes: text("notes"),
		/** Tags for categorization */
		tags: jsonb("tags").$type<string[]>().default([]),

		// ===== Audit =====
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
		/** User ID who created this contact */
		createdBy: varchar("created_by", { length: 255 }),
	},
	(table) => [
		// Primary query indexes
		index("contacts_account_idx").on(table.accountId),
		index("contacts_email_idx").on(table.email),
		index("contacts_name_idx").on(table.lastName, table.firstName),

		// Relationship indexes
		index("contacts_primary_idx").on(table.isPrimaryContact),
		index("contacts_role_idx").on(table.role),
		index("contacts_seniority_idx").on(table.seniority),

		// Engagement indexes
		index("contacts_last_contact_idx").on(table.lastContactDate),
		index("contacts_next_followup_idx").on(table.nextFollowUpDate),

		// Audit
		index("contacts_created_idx").on(table.createdAt),
	]
);

// ============================================================================
// ACTIVITIES (All interactions and timeline events)
// ============================================================================

/**
 * Activities table for tracking all interactions.
 *
 * Activity Types:
 * - email: Email correspondence
 * - call: Phone/video calls
 * - meeting: In-person or virtual meetings
 * - task: Internal tasks and to-dos
 * - note: General notes and observations
 * - linkedin: LinkedIn messages and interactions
 * - whatsapp: WhatsApp messages
 * - sms: Text messages
 * - event: Conferences, webinars, events
 * - demo: Product demonstrations
 * - proposal: Proposal submissions
 */
export const activities = pgTable(
	"activities",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		// ===== Related Entities (polymorphic) =====
		/** Associated account */
		accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
		/** Associated contact */
		contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
		/** Associated deal */
		dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
		/** Associated opportunity (RFP) */
		opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),

		// ===== Activity Type =====
		/** Activity type discriminator */
		type: varchar("type", { length: 50 }).notNull(),

		// ===== Details =====
		/** Activity subject/title */
		subject: varchar("subject", { length: 500 }),
		/** Full description/content */
		description: text("description"),
		/** Outcome or result of the activity */
		outcome: text("outcome"),

		// ===== Timing =====
		/** When the activity is/was scheduled */
		scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
		/** When the activity was completed */
		completedAt: timestamp("completed_at", { withTimezone: true }),
		/** Duration in minutes */
		durationMinutes: integer("duration_minutes"),

		// ===== Direction =====
		/** Communication direction: inbound, outbound, internal */
		direction: varchar("direction", { length: 20 }),

		// ===== Status =====
		/** Activity status: scheduled, completed, cancelled, no_show, rescheduled */
		status: varchar("status", { length: 50 }).default("scheduled"),

		// ===== Priority =====
		/** Priority level: low, normal, high, urgent */
		priority: varchar("priority", { length: 20 }).default("normal"),

		// ===== Participants =====
		/** Participants object with internal and external lists */
		participants: jsonb("participants").$type<{
			internal: string[];
			external: string[];
		}>(),

		// ===== Follow-up =====
		/** Whether follow-up is required */
		followUpRequired: boolean("follow_up_required").default(false),
		/** Scheduled follow-up date */
		followUpDate: timestamp("follow_up_date", { withTimezone: true }),
		/** Notes for follow-up */
		followUpNotes: text("follow_up_notes"),

		// ===== Metadata =====
		/** File attachments */
		attachments: jsonb("attachments").$type<{ name: string; url: string; type?: string }[]>().default([]),
		/** External system reference (email thread ID, calendar event ID) */
		externalId: varchar("external_id", { length: 255 }),
		/** Source of the activity: manual, email_sync, calendar_sync, api */
		source: varchar("source", { length: 100 }),

		// ===== Audit =====
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
		/** User ID who created this activity */
		createdBy: varchar("created_by", { length: 255 }),
	},
	(table) => [
		// Entity relation indexes
		index("activities_account_idx").on(table.accountId),
		index("activities_contact_idx").on(table.contactId),
		index("activities_deal_idx").on(table.dealId),
		index("activities_opportunity_idx").on(table.opportunityId),

		// Query indexes
		index("activities_type_idx").on(table.type),
		index("activities_status_idx").on(table.status),
		index("activities_priority_idx").on(table.priority),

		// Date indexes
		index("activities_scheduled_idx").on(table.scheduledAt),
		index("activities_completed_idx").on(table.completedAt),
		index("activities_followup_idx").on(table.followUpDate),
		index("activities_created_idx").on(table.createdAt),

		// Composite for timeline queries
		index("activities_account_date_idx").on(table.accountId, table.createdAt),
	]
);

// ============================================================================
// DEALS (Sales pipeline tracking)
// ============================================================================

/**
 * Deals table for tracking sales opportunities through the pipeline.
 *
 * Default Pipeline Stages:
 * - qualification: Initial assessment
 * - discovery: Understanding needs
 * - proposal: Proposal submitted
 * - negotiation: Terms discussion
 * - closed_won: Deal won
 * - closed_lost: Deal lost
 */
export const deals = pgTable(
	"deals",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Associated account (required) */
		accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
		/** Primary contact for this deal */
		primaryContactId: uuid("primary_contact_id").references(() => contacts.id, { onDelete: "set null" }),
		/** Associated opportunity/RFP if applicable */
		opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),

		// ===== Deal Info =====
		/** Deal name/title */
		name: varchar("name", { length: 500 }).notNull(),
		/** Deal description */
		description: text("description"),

		// ===== Value =====
		/** Deal value (one-time) */
		value: real("value"),
		/** Currency (ISO 4217 code) */
		currency: varchar("currency", { length: 10 }).default("USD"),
		/** Recurring value (if subscription/retainer) */
		recurringValue: real("recurring_value"),
		/** Recurring period: monthly, quarterly, yearly */
		recurringPeriod: varchar("recurring_period", { length: 20 }),

		// ===== Pipeline =====
		/** Pipeline identifier (for multiple pipelines) */
		pipelineId: varchar("pipeline_id", { length: 100 }).default("default"),
		/** Current pipeline stage */
		stage: varchar("stage", { length: 50 }).notNull().default("qualification"),
		/** Win probability percentage for this stage (0-100) */
		stageProbability: integer("stage_probability"),

		// ===== Timing =====
		/** Expected close date */
		expectedCloseDate: timestamp("expected_close_date", { withTimezone: true }),
		/** Actual close date (when won or lost) */
		actualCloseDate: timestamp("actual_close_date", { withTimezone: true }),

		// ===== Status =====
		/** Deal status: open, won, lost, on_hold, abandoned */
		status: varchar("status", { length: 50 }).default("open"),

		// ===== Win/Loss Analysis =====
		/** Primary reason for loss */
		lossReason: varchar("loss_reason", { length: 100 }),
		/** Detailed loss explanation */
		lossReasonDetail: text("loss_reason_detail"),
		/** Competitor we lost to (if applicable) */
		competitorLostTo: varchar("competitor_lost_to", { length: 255 }),
		/** Reason for winning (for future reference) */
		winReason: text("win_reason"),

		// ===== Ownership =====
		/** User ID of deal owner */
		ownerId: varchar("owner_id", { length: 255 }),
		/** Display name of deal owner */
		ownerName: varchar("owner_name", { length: 255 }),

		// ===== Metadata =====
		/** Tags for categorization */
		tags: jsonb("tags").$type<string[]>().default([]),
		/** Custom fields for extensibility */
		customFields: jsonb("custom_fields").$type<Record<string, unknown>>(),

		// ===== Audit =====
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
		/** User ID who created this deal */
		createdBy: varchar("created_by", { length: 255 }),
	},
	(table) => [
		// Entity relation indexes
		index("deals_account_idx").on(table.accountId),
		index("deals_contact_idx").on(table.primaryContactId),
		index("deals_opportunity_idx").on(table.opportunityId),

		// Pipeline indexes
		index("deals_pipeline_idx").on(table.pipelineId),
		index("deals_stage_idx").on(table.stage),
		index("deals_status_idx").on(table.status),

		// Value and date indexes
		index("deals_value_idx").on(table.value),
		index("deals_expected_close_idx").on(table.expectedCloseDate),
		index("deals_actual_close_idx").on(table.actualCloseDate),

		// Owner and audit indexes
		index("deals_owner_idx").on(table.ownerId),
		index("deals_created_idx").on(table.createdAt),

		// Composite for pipeline views
		index("deals_pipeline_stage_idx").on(table.pipelineId, table.stage),
		index("deals_status_stage_idx").on(table.status, table.stage),
	]
);

// ============================================================================
// CRM DOCUMENTS (Universal document storage)
// ============================================================================

/**
 * CRM Documents table for storing files associated with CRM entities.
 *
 * Document Types:
 * - cv: Curriculum vitae / resume
 * - certification: Professional certifications
 * - registration: Company registrations
 * - contract: Signed contracts
 * - proposal: Proposals sent
 * - nda: Non-disclosure agreements
 * - invoice: Invoices
 * - other: Other document types
 *
 * Supports polymorphic associations to accounts, contacts, deals, or activities.
 */
export const crmDocuments = pgTable(
	"crm_documents",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		// ===== Polymorphic Relations =====
		/** Associated account */
		accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
		/** Associated contact */
		contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
		/** Associated deal */
		dealId: uuid("deal_id").references(() => deals.id, { onDelete: "cascade" }),
		/** Associated activity */
		activityId: uuid("activity_id").references(() => activities.id, { onDelete: "cascade" }),

		// ===== Document Info =====
		/** Document display name */
		name: varchar("name", { length: 500 }).notNull(),
		/** Document type discriminator */
		type: varchar("type", { length: 50 }).notNull(),

		// ===== File Details =====
		/** Original filename */
		fileName: varchar("file_name", { length: 500 }),
		/** File size in bytes */
		fileSize: integer("file_size"),
		/** MIME type */
		mimeType: varchar("mime_type", { length: 100 }),
		/** Storage URL (S3, local path, etc.) */
		storageUrl: text("storage_url"),

		// ===== Metadata =====
		/** Document description */
		description: text("description"),
		/** Version number for tracking revisions */
		version: integer("version").default(1),
		/** Reference to previous version */
		previousVersionId: uuid("previous_version_id"),

		// ===== Validity =====
		/** When document becomes valid */
		validFrom: timestamp("valid_from", { withTimezone: true }),
		/** When document expires */
		validTo: timestamp("valid_to", { withTimezone: true }),
		/** Issuing authority/organization */
		issuedBy: varchar("issued_by", { length: 255 }),

		// ===== Audit =====
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
		/** User ID who uploaded this document */
		createdBy: varchar("created_by", { length: 255 }),
	},
	(table) => [
		// Polymorphic relation indexes
		index("crm_docs_account_idx").on(table.accountId),
		index("crm_docs_contact_idx").on(table.contactId),
		index("crm_docs_deal_idx").on(table.dealId),
		index("crm_docs_activity_idx").on(table.activityId),

		// Query indexes
		index("crm_docs_type_idx").on(table.type),
		index("crm_docs_valid_to_idx").on(table.validTo),
		index("crm_docs_created_idx").on(table.createdAt),
	]
);

// ============================================================================
// ACCOUNT STAGE HISTORY (Pipeline transition audit trail)
// ============================================================================

/**
 * Account Stage History for tracking all pipeline transitions.
 *
 * Records every stage change with timestamp, user, and reason for compliance
 * and analytics purposes.
 */
export const accountStageHistory = pgTable(
	"account_stage_history",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Associated account */
		accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),

		// ===== Stage Change =====
		/** Stage before the change (null for initial creation) */
		previousStage: varchar("previous_stage", { length: 50 }),
		/** New stage after the change */
		newStage: varchar("new_stage", { length: 50 }).notNull(),

		// ===== Type Change (if account type changed) =====
		/** Type before the change */
		previousType: varchar("previous_type", { length: 50 }),
		/** New type after the change */
		newType: varchar("new_type", { length: 50 }),

		// ===== Audit =====
		/** User who made the change */
		changedBy: varchar("changed_by", { length: 255 }),
		/** Reason for the change */
		reason: text("reason"),
		/** Timestamp of the change */
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("stage_history_account_idx").on(table.accountId),
		index("stage_history_new_stage_idx").on(table.newStage),
		index("stage_history_created_idx").on(table.createdAt),
		// Composite for timeline queries
		index("stage_history_account_date_idx").on(table.accountId, table.createdAt),
	]
);

// ============================================================================
// DEAL STAGE HISTORY (Deal pipeline transition audit trail)
// ============================================================================

/**
 * Deal Stage History for tracking sales pipeline transitions.
 */
export const dealStageHistory = pgTable(
	"deal_stage_history",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Associated deal */
		dealId: uuid("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),

		// ===== Stage Change =====
		/** Stage before the change */
		previousStage: varchar("previous_stage", { length: 50 }),
		/** New stage after the change */
		newStage: varchar("new_stage", { length: 50 }).notNull(),

		// ===== Value at time of change =====
		/** Deal value at time of stage change */
		valueAtChange: real("value_at_change"),

		// ===== Audit =====
		/** User who made the change */
		changedBy: varchar("changed_by", { length: 255 }),
		/** Reason for the change */
		reason: text("reason"),
		/** Timestamp of the change */
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("deal_history_deal_idx").on(table.dealId),
		index("deal_history_new_stage_idx").on(table.newStage),
		index("deal_history_created_idx").on(table.createdAt),
	]
);

// ============================================================================
// RELATIONS
// ============================================================================

export const accountsRelations = relations(accounts, ({ many }) => ({
	contacts: many(contacts),
	activities: many(activities),
	deals: many(deals),
	documents: many(crmDocuments),
	stageHistory: many(accountStageHistory),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
	account: one(accounts, {
		fields: [contacts.accountId],
		references: [accounts.id],
	}),
	activities: many(activities),
	deals: many(deals),
	documents: many(crmDocuments),
}));

export const activitiesRelations = relations(activities, ({ one, many }) => ({
	account: one(accounts, {
		fields: [activities.accountId],
		references: [accounts.id],
	}),
	contact: one(contacts, {
		fields: [activities.contactId],
		references: [contacts.id],
	}),
	deal: one(deals, {
		fields: [activities.dealId],
		references: [deals.id],
	}),
	opportunity: one(opportunities, {
		fields: [activities.opportunityId],
		references: [opportunities.id],
	}),
	documents: many(crmDocuments),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
	account: one(accounts, {
		fields: [deals.accountId],
		references: [accounts.id],
	}),
	primaryContact: one(contacts, {
		fields: [deals.primaryContactId],
		references: [contacts.id],
	}),
	opportunity: one(opportunities, {
		fields: [deals.opportunityId],
		references: [opportunities.id],
	}),
	activities: many(activities),
	documents: many(crmDocuments),
	stageHistory: many(dealStageHistory),
}));

export const crmDocumentsRelations = relations(crmDocuments, ({ one }) => ({
	account: one(accounts, {
		fields: [crmDocuments.accountId],
		references: [accounts.id],
	}),
	contact: one(contacts, {
		fields: [crmDocuments.contactId],
		references: [contacts.id],
	}),
	deal: one(deals, {
		fields: [crmDocuments.dealId],
		references: [deals.id],
	}),
	activity: one(activities, {
		fields: [crmDocuments.activityId],
		references: [activities.id],
	}),
}));

export const accountStageHistoryRelations = relations(accountStageHistory, ({ one }) => ({
	account: one(accounts, {
		fields: [accountStageHistory.accountId],
		references: [accounts.id],
	}),
}));

export const dealStageHistoryRelations = relations(dealStageHistory, ({ one }) => ({
	deal: one(deals, {
		fields: [dealStageHistory.dealId],
		references: [deals.id],
	}),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AccountRow = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type ContactRow = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;

export type ActivityRow = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;

export type DealRow = typeof deals.$inferSelect;
export type NewDeal = typeof deals.$inferInsert;

export type CrmDocumentRow = typeof crmDocuments.$inferSelect;
export type NewCrmDocument = typeof crmDocuments.$inferInsert;

export type AccountStageHistoryRow = typeof accountStageHistory.$inferSelect;
export type NewAccountStageHistory = typeof accountStageHistory.$inferInsert;

export type DealStageHistoryRow = typeof dealStageHistory.$inferSelect;
export type NewDealStageHistory = typeof dealStageHistory.$inferInsert;
