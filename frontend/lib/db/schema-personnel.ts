/**
 * Personnel & Resume Database Schema
 *
 * Schema for managing personnel records, resumes, skills taxonomy,
 * experience tracking, and position requirement matching.
 */

import {
	pgTable,
	uuid,
	varchar,
	text,
	timestamp,
	date,
	real,
	integer,
	boolean,
	jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// Personnel Table
// ============================================================================

export const personnel = pgTable("personnel", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: uuid("organization_id"),

	// Basic info
	firstName: varchar("first_name", { length: 100 }).notNull(),
	lastName: varchar("last_name", { length: 100 }).notNull(),
	email: varchar("email", { length: 200 }),
	phone: varchar("phone", { length: 50 }),
	photoUrl: text("photo_url"),

	// Employment
	employmentType: varchar("employment_type", { length: 50 }), // employee, contractor, consultant, partner
	startDate: date("start_date"),
	endDate: date("end_date"),
	department: varchar("department", { length: 100 }),
	currentTitle: varchar("current_title", { length: 200 }),
	location: varchar("location", { length: 200 }),

	// Resume content
	resumeFull: text("resume_full"),
	resumeBrief: text("resume_brief"),
	resumeFederal: text("resume_federal"), // Federal format resume
	linkedInUrl: text("linkedin_url"),

	// Education
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

	// Certifications
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

	// Clearance
	clearanceLevel: varchar("clearance_level", { length: 100 }), // None, Public Trust, Secret, Top Secret, TS/SCI
	clearanceStatus: varchar("clearance_status", { length: 50 }), // active, inactive, pending, expired
	clearanceExpiration: date("clearance_expiration"),
	clearanceInvestigationType: varchar("clearance_investigation_type", { length: 50 }),
	clearancePolygraph: boolean("clearance_polygraph").default(false),

	// Availability
	availability: varchar("availability", { length: 50 }).default("available"), // available, partial, committed, unavailable
	availableDate: date("available_date"),
	currentProposals: jsonb("current_proposals").$type<string[]>().default([]),
	maxCommitment: integer("max_commitment").default(100), // Percentage FTE

	// Skills summary (linked to taxonomy)
	skills: jsonb("skills").$type<
		{
			skillId: string;
			skillName: string;
			proficiency: "beginner" | "intermediate" | "advanced" | "expert";
			yearsExperience: number;
			lastUsed?: string;
		}[]
	>(),

	// Professional summary
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

	// Languages
	languages: jsonb("languages").$type<
		{
			language: string;
			proficiency: "basic" | "conversational" | "professional" | "native";
		}[]
	>(),

	// Labor category mapping
	laborCategories: jsonb("labor_categories").$type<
		{
			contractVehicle: string;
			laborCategory: string;
			rate?: number;
		}[]
	>(),

	// Metrics
	proposalWinCount: integer("proposal_win_count").default(0),
	proposalSubmitCount: integer("proposal_submit_count").default(0),
	yearsOfExperience: integer("years_of_experience"),

	// Status
	isActive: boolean("is_active").default(true),
	lastResumeUpdate: timestamp("last_resume_update", { withTimezone: true }),

	// Embedding for semantic search
	embeddingUpdatedAt: timestamp("embedding_updated_at", { withTimezone: true }),

	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// Skills Taxonomy Table
// ============================================================================

export const skillsTaxonomy = pgTable("skills_taxonomy", {
	id: uuid("id").primaryKey().defaultRandom(),

	name: varchar("name", { length: 200 }).notNull(),
	category: varchar("category", { length: 100 }).notNull(), // technical, management, domain, soft_skill
	subcategory: varchar("subcategory", { length: 100 }),

	// Description
	description: text("description"),

	// Synonyms for matching
	synonyms: jsonb("synonyms").$type<string[]>().default([]),

	// Related skills
	relatedSkills: jsonb("related_skills").$type<string[]>().default([]),

	// Hierarchy
	parentId: uuid("parent_id"),
	level: integer("level").default(0),

	// Prevalence in proposals
	usageCount: integer("usage_count").default(0),

	isActive: boolean("is_active").default(true),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// Personnel Experience Table
// ============================================================================

export const personnelExperience = pgTable("personnel_experience", {
	id: uuid("id").primaryKey().defaultRandom(),
	personnelId: uuid("personnel_id").references(() => personnel.id, { onDelete: "cascade" }),

	// Position info
	title: varchar("title", { length: 200 }).notNull(),
	company: varchar("company", { length: 200 }),
	projectId: uuid("project_id"), // Links to past performance project
	client: varchar("client", { length: 200 }),

	// Duration
	startDate: date("start_date"),
	endDate: date("end_date"),
	isCurrent: boolean("is_current").default(false),

	// Description
	description: text("description"),
	accomplishments: jsonb("accomplishments").$type<string[]>(),

	// Scope
	scope: jsonb("scope").$type<{
		teamSize?: number;
		budgetSize?: number;
		responsibilities?: string[];
	}>(),

	// Skills used
	skillsUsed: jsonb("skills_used").$type<string[]>(),

	// Contract details
	contractType: varchar("contract_type", { length: 50 }),
	contractValue: real("contract_value"),
	laborCategory: varchar("labor_category", { length: 100 }),

	// Location
	location: varchar("location", { length: 200 }),
	isRemote: boolean("is_remote").default(false),

	// =========================================================================
	// Rich Media Proof-of-Work
	// Links to evidence, commentary, and detailed discussions about this role
	// =========================================================================

	// Code & Technical Artifacts
	proofOfWork: jsonb("proof_of_work").$type<{
		// Code repositories (GitHub, GitLab, Bitbucket)
		repositories?: {
			type: "github" | "gitlab" | "bitbucket" | "other";
			url: string;
			name: string;
			description?: string;
			role?: string; // "owner" | "contributor" | "maintainer"
			stars?: number;
			commits?: number;
		}[];

		// Publications & Articles
		articles?: {
			type: "blog" | "article" | "whitepaper" | "case_study" | "book" | "other";
			title: string;
			url: string;
			publisher?: string;
			publishDate?: string;
			description?: string;
		}[];

		// Video Content (YouTube, Vimeo, presentations)
		videos?: {
			type: "youtube" | "vimeo" | "presentation" | "webinar" | "tutorial" | "other";
			title: string;
			url: string;
			thumbnailUrl?: string;
			duration?: number; // seconds
			views?: number;
			description?: string;
			recordedDate?: string;
		}[];

		// Audio Content (podcasts, interviews, discussions)
		audio?: {
			type: "podcast" | "interview" | "presentation" | "discussion" | "other";
			title: string;
			url: string;
			duration?: number; // seconds
			description?: string;
			recordedDate?: string;
			platform?: string;
		}[];

		// Awards & Recognition for this role
		awards?: {
			name: string;
			issuer: string;
			date: string;
			description?: string;
			url?: string;
		}[];

		// Certifications earned during this role
		certificationsEarned?: {
			name: string;
			issuer: string;
			date: string;
			url?: string;
		}[];

		// Patents or IP created
		patents?: {
			title: string;
			number?: string;
			filingDate?: string;
			status: "filed" | "pending" | "granted" | "expired";
			url?: string;
			description?: string;
		}[];

		// References who can verify this work
		references?: {
			name: string;
			title: string;
			company: string;
			relationship: string; // "supervisor" | "colleague" | "client" | "subordinate"
			email?: string;
			phone?: string;
			linkedIn?: string;
			canContact: boolean;
		}[];

		// Metrics & Impact Evidence
		metrics?: {
			name: string;
			value: string;
			description?: string;
			verifiable: boolean;
		}[];

		// External Links (portfolio, demos, etc.)
		links?: {
			type: "portfolio" | "demo" | "documentation" | "slide_deck" | "other";
			title: string;
			url: string;
			description?: string;
		}[];
	}>(),

	// Long-form Commentary & Reflection
	// Detailed discussions about the experience, lessons learned, challenges overcome
	commentary: jsonb("commentary").$type<{
		// Written narrative about the role
		narrative?: string;

		// Key lessons learned
		lessonsLearned?: string[];

		// Challenges overcome
		challengesOvercome?: {
			challenge: string;
			solution: string;
			outcome: string;
		}[];

		// Technical decisions made
		technicalDecisions?: {
			decision: string;
			context: string;
			rationale: string;
			outcome: string;
		}[];

		// Leadership moments
		leadershipMoments?: {
			situation: string;
			action: string;
			result: string;
		}[];

		// Audio/video commentary recordings
		recordings?: {
			type: "audio" | "video";
			title: string;
			url: string;
			duration?: number;
			transcript?: string;
			recordedDate?: string;
		}[];
	}>(),

	// Order for resume display
	displayOrder: integer("display_order"),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// Position Requirements Table
// ============================================================================

export const positionRequirements = pgTable("position_requirements", {
	id: uuid("id").primaryKey().defaultRandom(),
	opportunityId: uuid("opportunity_id"),

	// Position info
	positionTitle: varchar("position_title", { length: 200 }).notNull(),
	positionCategory: varchar("position_category", { length: 100 }), // key_personnel, technical, management, support
	laborCategory: varchar("labor_category", { length: 100 }),
	positionNumber: varchar("position_number", { length: 50 }),

	// Requirements
	requiredSkills: jsonb("required_skills").$type<
		{
			skillId: string;
			skillName: string;
			minProficiency: "beginner" | "intermediate" | "advanced" | "expert";
			required: boolean;
		}[]
	>(),
	requiredEducation: varchar("required_education", { length: 200 }),
	minimumEducation: varchar("minimum_education", { length: 100 }), // high_school, bachelors, masters, doctorate
	preferredEducation: varchar("preferred_education", { length: 100 }),
	requiredExperience: integer("required_experience"), // Years
	preferredExperience: integer("preferred_experience"),
	requiredClearance: varchar("required_clearance", { length: 100 }),
	requiredCertifications: jsonb("required_certifications").$type<string[]>(),
	preferredCertifications: jsonb("preferred_certifications").$type<string[]>(),

	// Position description
	description: text("description"),
	responsibilities: jsonb("responsibilities").$type<string[]>(),

	// Staffing
	headcount: integer("headcount").default(1),
	startDate: date("start_date"),
	endDate: date("end_date"),
	duration: integer("duration"), // Months
	hoursPerWeek: integer("hours_per_week").default(40),
	locationRequired: varchar("location_required", { length: 200 }),
	remoteAllowed: boolean("remote_allowed").default(false),

	// Assigned personnel
	assignedPersonnelId: uuid("assigned_personnel_id").references(() => personnel.id),
	assignmentStatus: varchar("assignment_status", { length: 50 }).default("open"), // open, matched, assigned, confirmed
	assignmentNotes: text("assignment_notes"),
	assignedAt: timestamp("assigned_at", { withTimezone: true }),
	assignedBy: varchar("assigned_by", { length: 200 }),

	// Match scoring
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

	// Backup candidates
	backupCandidates: jsonb("backup_candidates").$type<
		{
			personnelId: string;
			matchScore: number;
			notes?: string;
		}[]
	>(),

	// Proposal section reference
	proposalSectionId: uuid("proposal_section_id"),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// Personnel Availability Table
// ============================================================================

export const personnelAvailability = pgTable("personnel_availability", {
	id: uuid("id").primaryKey().defaultRandom(),
	personnelId: uuid("personnel_id").references(() => personnel.id, { onDelete: "cascade" }),

	// Time period
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),

	// Commitment
	commitment: integer("commitment").notNull(), // Percentage 0-100
	opportunityId: uuid("opportunity_id"),
	opportunityName: varchar("opportunity_name", { length: 500 }),

	// Status
	status: varchar("status", { length: 50 }).default("committed"), // committed, tentative, blocked, available

	notes: text("notes"),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// Resume Templates Table
// ============================================================================

export const resumeTemplates = pgTable("resume_templates", {
	id: uuid("id").primaryKey().defaultRandom(),

	name: varchar("name", { length: 200 }).notNull(),
	format: varchar("format", { length: 50 }).notNull(), // federal, commercial, brief, technical
	description: text("description"),

	// Template content (LaTeX or HTML)
	templateContent: text("template_content").notNull(),
	templateType: varchar("template_type", { length: 50 }).default("latex"), // latex, html, docx

	// Sections configuration
	sections: jsonb("sections").$type<
		{
			name: string;
			key: string;
			required: boolean;
			order: number;
			maxLength?: number;
		}[]
	>(),

	// Page limits
	maxPages: integer("max_pages"),
	targetWordCount: integer("target_word_count"),

	// Compliance
	complianceNotes: text("compliance_notes"),

	isDefault: boolean("is_default").default(false),
	isActive: boolean("is_active").default(true),

	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// Relations
// ============================================================================

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

// ============================================================================
// Types
// ============================================================================

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
