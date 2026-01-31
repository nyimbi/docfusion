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
	date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { opportunities } from "./schema";

// ============================================================================
// Types for JSONB Columns
// ============================================================================

/**
 * Commercial insights structure for account research.
 * Stored as JSONB for flexible, queryable insights.
 */
export interface CommercialInsights {
	/** Commercial opportunities identified for this account */
	opportunities: Array<{
		title: string;
		description: string;
		potentialValue?: string;
		timeframe?: string;
		confidence: "high" | "medium" | "low";
	}>;
	/** Partnership opportunities with mutual benefit */
	partnerships: Array<{
		type: string;
		description: string;
		synergies: string[];
		nextSteps?: string;
	}>;
	/** Our products/services that match their needs */
	productsToOffer: Array<{
		productName: string;
		relevance: string;
		painPointAddressed?: string;
		suggestedApproach?: string;
	}>;
	/** Generated value proposition statement */
	valuePropositionSummary: string;
	/** Key talking points for engagement */
	talkingPoints: string[];
	/** Competitive positioning notes */
	competitivePositioning?: string;
}

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
		/** General notes and unmapped import data */
		notes: text("notes"),

		// ===== Research =====
		/** AI-generated research findings, notes, and insights */
		researchFindings: text("research_findings"),
		/** Date of last research activity */
		lastResearchDate: timestamp("last_research_date", { withTimezone: true }),
		/** Research confidence score (0-100) based on source quality */
		researchConfidence: integer("research_confidence"),
		/** URLs of sources used in research */
		researchSources: jsonb("research_sources").$type<string[]>().default([]),
		/** AI-generated value proposition tailored to this account */
		valueProposition: text("value_proposition"),
		/** Structured commercial insights (opportunities, partnerships, products to offer) */
		commercialInsights: jsonb("commercial_insights").$type<CommercialInsights>(),
		/** AI thinking trace/reasoning for human review */
		aiThinkingTrace: text("ai_thinking_trace"),

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

		// ============================================================================
		// CONTEXT FIELDS - Where/how we know this person
		// ============================================================================

		/** How we met this person: conference, referral, linkedin, cold_outreach, etc. */
		howWeMet: varchar("how_we_met", { length: 200 }),
		/** Details about first meeting/encounter */
		meetingContext: text("meeting_context"),
		/** Date when we first met/connected */
		meetingDate: timestamp("meeting_date", { withTimezone: true }),
		/** Contact who referred/introduced this person (self-referential, set after creation) */
		referredBy: uuid("referred_by"),

		// ============================================================================
		// CURRENT ACTIVITIES/INTERESTS
		// ============================================================================

		/** What they're currently working on */
		currentProjects: text("current_projects"),
		/** Professional interests and focus areas */
		interests: jsonb("interests").$type<string[]>(),
		/** Key skills and expertise */
		skills: jsonb("skills").$type<string[]>(),
		/** Papers, articles, talks, etc. */
		publications: jsonb("publications").$type<string[]>(),

		// ============================================================================
		// RESEARCH ENRICHMENT (parallel to accounts)
		// ============================================================================

		/** AI-generated research findings and notes */
		researchFindings: text("research_findings"),
		/** URLs of sources used in research */
		researchSources: jsonb("research_sources").$type<string[]>(),
		/** Date of last research activity */
		lastResearchDate: timestamp("last_research_date", { withTimezone: true }),
		/** Research confidence score (0-100) */
		researchConfidence: integer("research_confidence"),

		// ============================================================================
		// PROFESSIONAL INSIGHTS
		// ============================================================================

		/** Career history with companies, titles, dates */
		careerHistory: jsonb("career_history").$type<Array<{
			company: string;
			title: string;
			startDate?: string;
			endDate?: string;
		}>>(),
		/** Education background */
		educationHistory: jsonb("education_history").$type<Array<{
			institution: string;
			degree?: string;
			field?: string;
			year?: number;
		}>>(),
		/** Social profile URLs: twitter, github, etc. */
		socialProfiles: jsonb("social_profiles").$type<Record<string, string>>(),

		// ============================================================================
		// AI-GENERATED INSIGHTS
		// ============================================================================

		/** Why maintain this relationship - AI-generated */
		valueProposition: text("value_proposition"),
		/** AI thinking trace/reasoning for human review */
		aiThinkingTrace: text("ai_thinking_trace"),

		// ============================================================================
		// MULTIPLE PHOTOS
		// ============================================================================

		/** Array of contact photos with captions */
		photos: jsonb("photos").$type<Array<{
			url: string;
			caption?: string;
			isPrimary?: boolean;
			uploadedAt: string;
		}>>(),

		// ============================================================================
		// PERSONAL DETAILS (for relationship building)
		// ============================================================================

		/** Date of birth */
		birthday: date("birthday"),
		/** Wedding anniversary or similar */
		anniversary: date("anniversary"),
		/** Personal email (non-work) */
		personalEmail: varchar("personal_email", { length: 200 }),
		/** Personal phone (non-work) */
		personalPhone: varchar("personal_phone", { length: 50 }),
		/** Home address */
		homeAddress: text("home_address"),
		/** Nickname or preferred name */
		preferredName: varchar("preferred_name", { length: 100 }),
		/** Pronouns: he/him, she/her, they/them, etc. */
		pronouns: varchar("pronouns", { length: 50 }),

		// ============================================================================
		// FAMILY TRACKING (for asking about kids, remembering birthdays)
		// ============================================================================

		/** Family members with relationships and birthdays */
		family: jsonb("family").$type<Array<{
			name: string;
			relationship: string; // spouse, child, parent, sibling
			birthday?: string;   // YYYY-MM-DD
			notes?: string;
		}>>(),

		// ============================================================================
		// LINKEDIN-LEVEL PROFESSIONAL DETAILS
		// ============================================================================

		/** Professional certifications */
		certifications: jsonb("certifications").$type<Array<{
			name: string;
			issuer?: string;
			dateIssued?: string;
			expirationDate?: string;
			credentialId?: string;
		}>>(),
		/** Languages spoken with proficiency levels */
		languages: jsonb("languages").$type<Array<{
			language: string;
			proficiency: string; // native, fluent, professional, conversational, basic
		}>>(),
		/** Professional awards and recognitions */
		awards: jsonb("awards").$type<Array<{
			title: string;
			issuer?: string;
			date?: string;
			description?: string;
		}>>(),
		/** Volunteer work and causes */
		volunteerWork: jsonb("volunteer_work").$type<Array<{
			organization: string;
			role?: string;
			cause?: string;
			startDate?: string;
			endDate?: string;
		}>>(),
		/** Patents held */
		patents: jsonb("patents").$type<Array<{
			title: string;
			patentNumber?: string;
			dateIssued?: string;
		}>>(),
		/** Professional courses completed */
		courses: jsonb("courses").$type<Array<{
			name: string;
			provider?: string;
			completionDate?: string;
		}>>(),

		// ============================================================================
		// COMMUNICATION PREFERENCES (Extended)
		// ============================================================================

		/** Detailed communication preferences */
		communicationPreferences: jsonb("communication_preferences").$type<{
			preferredChannel: string;  // email, phone, linkedin, text
			bestTimeToContact?: string;
			timezone?: string;
			doNotContact?: boolean;
			assistantName?: string;    // gatekeeper to build rapport with
			assistantEmail?: string;
			assistantPhone?: string;
		}>(),

		// ============================================================================
		// MASTER SALESMAN RELATIONSHIP INTELLIGENCE
		// ============================================================================

		// Personal Interests & Lifestyle (for rapport building)
		/** Hobbies, causes, activities */
		personalInterests: jsonb("personal_interests").$type<string[]>(),
		/** Sports teams they follow */
		favoriteSportsTeams: jsonb("favorite_sports_teams").$type<string[]>(),
		/** College/university for alumni affinity */
		almaMater: varchar("alma_mater", { length: 200 }),
		/** Year of graduation */
		graduationYear: integer("graduation_year"),
		/** Military service background */
		militaryService: varchar("military_service", { length: 200 }),
		/** Pets with names and types */
		pets: jsonb("pets").$type<Array<{ name: string; type: string }>>(),
		/** Favorite vacation destinations */
		vacationSpots: jsonb("vacation_spots").$type<string[]>(),
		/** Dietary restrictions for meal planning */
		dietaryRestrictions: varchar("dietary_restrictions", { length: 200 }),
		/** Religious observances for scheduling sensitivity */
		religiousObservances: varchar("religious_observances", { length: 200 }),

		// Relationship Dynamics
		/** analytical, driver, amiable, expressive */
		communicationStyle: varchar("communication_style", { length: 50 }),
		/** data-driven, consensus, intuitive */
		decisionMakingStyle: varchar("decision_making_style", { length: 50 }),
		/** What drives them: recognition, achievement, security, etc. */
		motivators: jsonb("motivators").$type<string[]>(),
		/** What frustrates them */
		stressors: jsonb("stressors").$type<string[]>(),
		/** Topics to avoid: politics, religion, competitors, etc. */
		topicsToAvoid: jsonb("topics_to_avoid").$type<string[]>(),

		// Gift & Entertainment Preferences
		/** accepts_gifts, no_gifts, company_policy */
		giftPolicy: varchar("gift_policy", { length: 100 }),
		/** wine, books, experiences, etc. */
		giftPreferences: jsonb("gift_preferences").$type<string[]>(),
		/** golf, dinners, concerts, sports events */
		entertainmentPreferences: jsonb("entertainment_preferences").$type<string[]>(),

		// Relationship History & Reciprocity
		/** Contact who introduced us to this person */
		introducedBy: uuid("introduced_by"),
		/** People we've connected them with */
		introducedTo: jsonb("introduced_to").$type<string[]>(),
		/** Favors we've done for them */
		favorsGiven: jsonb("favors_given").$type<Array<{ description: string; date: string }>>(),
		/** Favors they've done for us */
		favorsReceived: jsonb("favors_received").$type<Array<{ description: string; date: string }>>(),
		/** Shared experiences and memories */
		sharedExperiences: jsonb("shared_experiences").$type<Array<{
			description: string; // "Dinner at Nobu", "Attended AWS re:Invent together"
			date: string;
			notes?: string;
		}>>(),
		/** Gifts we've given with reactions */
		giftsGiven: jsonb("gifts_given").$type<Array<{
			item: string;
			occasion?: string;
			date: string;
			reaction?: string; // "loved it", "seemed indifferent"
		}>>(),

		// Organizational Intelligence
		/** Their manager's name */
		reportingTo: varchar("reporting_to", { length: 200 }),
		/** Team size */
		directReports: integer("direct_reports"),
		/** Budget authority: <10K, 10K-100K, 100K-1M, >1M */
		budgetAuthority: varchar("budget_authority", { length: 100 }),
		/** Budget cycle: Q4 planning, fiscal year, etc. */
		budgetCycle: varchar("budget_cycle", { length: 100 }),
		/** Who influences their decisions */
		keyInfluencers: jsonb("key_influencers").$type<string[]>(),
		/** Allies in their organization */
		internalChampions: jsonb("internal_champions").$type<string[]>(),
		/** People who might block deals */
		internalBlockers: jsonb("internal_blockers").$type<string[]>(),

		// Professional Goals & Pain Points
		/** What keeps them up at night */
		currentChallenges: jsonb("current_challenges").$type<string[]>(),
		/** Where they want to be */
		careerGoals: text("career_goals"),
		/** What they're measured on */
		kpisTracked: jsonb("kpis_tracked").$type<string[]>(),
		/** Who they've worked with before */
		previousVendors: jsonb("previous_vendors").$type<string[]>(),
		/** Competitors they're considering */
		competitorsConsidering: jsonb("competitors_considering").$type<string[]>(),

		// Engagement Scoring (note: lastContactDate exists in base schema)
		/** Typical contact frequency: weekly, monthly, quarterly */
		contactFrequency: varchar("contact_frequency", { length: 50 }),
		/** Self-assessed relationship strength: 1-10 */
		relationshipScore: integer("relationship_score"),
		/** Scheduled next touchpoint */
		nextTouchpointDate: timestamp("next_touchpoint_date", { withTimezone: true }),
		/** Reason for next follow-up */
		followUpReason: text("follow_up_reason"),

		// Important Dates (beyond birthday/anniversary)
		/** Work anniversaries, promotions, company founding, etc. */
		importantDates: jsonb("important_dates").$type<Array<{
			date: string;
			occasion: string;
			recurring: boolean;
		}>>(),

		// Conversation Starters & Talking Points
		/** Things to bring up in conversation */
		talkingPoints: jsonb("talking_points").$type<Array<{
			topic: string;
			context: string;
			lastDiscussed?: string;
		}>>(),
		/** Their recent successes to congratulate */
		recentWins: jsonb("recent_wins").$type<string[]>(),

		// ============================================================================
		// PRIVACY & SHARING - Contact ownership and visibility controls
		// ============================================================================

		/** User ID who owns this contact (the uploader/creator) */
		ownerId: varchar("owner_id", { length: 255 }).notNull(),
		/**
		 * Visibility level for this contact:
		 * - private: Only visible to owner
		 * - shared: Visible to owner and users in sharedWith array
		 * - organization: Visible to all users in the organization
		 */
		visibility: varchar("visibility", { length: 20 }).notNull().default("private"),
		/** Array of user IDs this contact is shared with (when visibility = 'shared') */
		sharedWith: jsonb("shared_with").$type<string[]>().default([]),
		/** Organization ID for org-level visibility filtering */
		organizationId: varchar("organization_id", { length: 255 }),

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

		// Privacy/ownership indexes
		index("contacts_owner_idx").on(table.ownerId),
		index("contacts_visibility_idx").on(table.visibility),
		index("contacts_org_idx").on(table.organizationId),

		// Relationship indexes
		index("contacts_primary_idx").on(table.isPrimaryContact),
		index("contacts_role_idx").on(table.role),
		index("contacts_seniority_idx").on(table.seniority),

		// Engagement indexes
		index("contacts_last_contact_idx").on(table.lastContactDate),
		index("contacts_next_followup_idx").on(table.nextFollowUpDate),

		// Research and context indexes
		index("contacts_referred_by_idx").on(table.referredBy),
		index("contacts_how_we_met_idx").on(table.howWeMet),
		index("contacts_birthday_idx").on(table.birthday),
		index("contacts_next_touchpoint_idx").on(table.nextTouchpointDate),

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
// CONTACT IMPORTS (Import tracking and history)
// ============================================================================

/**
 * Contact Imports table for tracking import history.
 *
 * Records each import operation with file metadata, statistics,
 * field mappings, and any errors encountered during processing.
 */
export const contactImports = pgTable(
	"contact_imports",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		// ===== File Information =====
		/** Original filename uploaded */
		filename: varchar("filename", { length: 500 }).notNull(),
		/** File format: vcf, csv, abbu */
		fileType: varchar("file_type", { length: 20 }).notNull(),
		/** File size in bytes */
		fileSize: integer("file_size"),

		// ===== Import Statistics =====
		/** Total records parsed from file */
		totalRecords: integer("total_records").default(0),
		/** Successfully imported new contacts */
		importedRecords: integer("imported_records").default(0),
		/** Existing contacts updated */
		updatedRecords: integer("updated_records").default(0),
		/** Records skipped (duplicates, invalid) */
		skippedRecords: integer("skipped_records").default(0),
		/** Records that failed to import */
		failedRecords: integer("failed_records").default(0),

		// ===== Status =====
		/** Import status: pending, processing, completed, failed, cancelled */
		status: varchar("status", { length: 30 }).default("pending"),

		// ===== Errors and Mapping =====
		/** Array of error details with row numbers */
		errors: jsonb("errors").$type<Array<{ row: number; error: string; field?: string }>>().default([]),
		/** Field mapping used for CSV imports */
		fieldMapping: jsonb("field_mapping").$type<Record<string, string>>(),
		/** Import options used */
		importOptions: jsonb("import_options").$type<{
			updateExisting: boolean;
			skipDuplicates: boolean;
			defaultAccountId?: string;
			defaultTags?: string[];
			/** Default visibility for imported contacts */
			defaultVisibility?: "private" | "shared" | "organization";
			/** Users to share imported contacts with (when visibility is 'shared') */
			sharedWith?: string[];
		}>(),

		// ===== Timestamps =====
		/** When import was initiated */
		startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
		/** When import completed (success or failure) */
		completedAt: timestamp("completed_at", { withTimezone: true }),

		// ===== Ownership & Organization =====
		/** User who initiated the import (also the owner of imported contacts) */
		importedBy: varchar("imported_by", { length: 255 }).notNull(),
		/** Organization ID for the import */
		organizationId: varchar("organization_id", { length: 255 }),

		// ===== Audit =====
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("contact_imports_status_idx").on(table.status),
		index("contact_imports_imported_by_idx").on(table.importedBy),
		index("contact_imports_org_idx").on(table.organizationId),
		index("contact_imports_created_idx").on(table.createdAt),
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

export type ContactImportRow = typeof contactImports.$inferSelect;
export type NewContactImport = typeof contactImports.$inferInsert;
