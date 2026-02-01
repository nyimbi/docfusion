/**
 * Past Performance Database Schema
 *
 * Schema for tracking past performance projects, relevance scoring,
 * CPAR ratings, and AI-generated narratives.
 */

import { pgTable, uuid, varchar, text, timestamp, date, real, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// Projects Table
// ============================================================================

export const projects = pgTable("projects", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: uuid("organization_id"),

	// Basic info
	name: varchar("name", { length: 500 }).notNull(),
	contractNumber: varchar("contract_number", { length: 100 }),
	taskOrderNumber: varchar("task_order_number", { length: 100 }),

	// Customer info
	customerName: varchar("customer_name", { length: 500 }).notNull(),
	customerAgency: varchar("customer_agency", { length: 500 }),
	customerPOC: varchar("customer_poc", { length: 200 }),
	customerPOCEmail: varchar("customer_poc_email", { length: 200 }),
	customerPOCPhone: varchar("customer_poc_phone", { length: 50 }),

	// Contract details
	contractType: varchar("contract_type", { length: 100 }), // FFP, T&M, CPFF, IDIQ, etc.
	contractValue: real("contract_value"),
	periodOfPerformance: jsonb("period_of_performance").$type<{
		start: string;
		end: string;
		options?: { start: string; end: string }[];
	}>(),

	// Scope
	description: text("description"),
	scopeSummary: text("scope_summary"),
	technicalAreas: jsonb("technical_areas").$type<string[]>(),
	naicsCode: varchar("naics_code", { length: 20 }),

	// Team
	peakStaffing: integer("peak_staffing"),
	keyPersonnel: jsonb("key_personnel").$type<{
		name: string;
		role: string;
		personnelId?: string;
	}[]>(),

	// Performance metrics (CPAR ratings 1-5 scale)
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

	// Outcomes and achievements
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

	// Awards and recognition
	awards: jsonb("awards").$type<{
		name: string;
		date: string;
		issuingOrganization: string;
	}[]>(),

	// Classification
	securityLevel: varchar("security_level", { length: 50 }),
	isActive: boolean("is_active").default(true),

	// Prime/Sub status
	primeOrSub: varchar("prime_or_sub", { length: 50 }).default("prime"), // prime, subcontractor
	primeContractorName: varchar("prime_contractor_name", { length: 500 }),
	subcontractValue: real("subcontract_value"),

	// Reference status
	referenceStatus: varchar("reference_status", { length: 50 }).default("available"), // available, limited, unavailable
	referenceNotes: text("reference_notes"),
	lastReferenceCheck: timestamp("last_reference_check", { withTimezone: true }),

	// Auto-generated content
	cparNarrative: text("cpar_narrative"),
	briefDescription: text("brief_description"),
	executiveSummary: text("executive_summary"),

	// Embedding for semantic search
	embeddingUpdatedAt: timestamp("embedding_updated_at", { withTimezone: true }),

	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// Project Relevance Scores Table
// ============================================================================

export const projectRelevanceScores = pgTable("project_relevance_scores", {
	id: uuid("id").primaryKey().defaultRandom(),
	projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
	opportunityId: uuid("opportunity_id"),

	// Overall score
	overallScore: real("overall_score").notNull(),

	// Component scores (0-100)
	recencyScore: real("recency_score"),
	sizeScore: real("size_score"),
	scopeScore: real("scope_score"),
	customerScore: real("customer_score"),
	complexityScore: real("complexity_score"),
	performanceScore: real("performance_score"),

	// Matching details
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

	// Generated narrative
	relevanceNarrative: text("relevance_narrative"),
	strengthsNarrative: text("strengths_narrative"),
	mitigationsNarrative: text("mitigations_narrative"),

	// Selection status
	isSelected: boolean("is_selected").default(false),
	selectionRank: integer("selection_rank"),
	selectionNotes: text("selection_notes"),

	calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow(),
	calculatedBy: varchar("calculated_by", { length: 200 }),
});

// ============================================================================
// Project Documents Table
// ============================================================================

export const projectDocuments = pgTable("project_documents", {
	id: uuid("id").primaryKey().defaultRandom(),
	projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),

	// Document info
	documentType: varchar("document_type", { length: 100 }).notNull(), // cpar, award_letter, contract, mod, deliverable, testimonial
	title: varchar("title", { length: 500 }).notNull(),
	description: text("description"),

	// File info
	fileUrl: text("file_url"),
	fileName: varchar("file_name", { length: 500 }),
	fileSize: integer("file_size"),
	mimeType: varchar("mime_type", { length: 100 }),

	// Metadata
	documentDate: date("document_date"),
	expirationDate: date("expiration_date"),
	isConfidential: boolean("is_confidential").default(false),

	uploadedBy: varchar("uploaded_by", { length: 200 }),
	uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// Project Tags Table
// ============================================================================

export const projectTags = pgTable("project_tags", {
	id: uuid("id").primaryKey().defaultRandom(),
	projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),

	tagName: varchar("tag_name", { length: 100 }).notNull(),
	tagCategory: varchar("tag_category", { length: 100 }), // technical, customer, contract_type, etc.

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// Past Performance Volumes Table
// ============================================================================

export const pastPerfVolumes = pgTable("past_perf_volumes", {
	id: uuid("id").primaryKey().defaultRandom(),
	opportunityId: uuid("opportunity_id"),

	// Volume info
	title: varchar("title", { length: 500 }).notNull(),
	version: integer("version").default(1),

	// Structure
	maxProjects: integer("max_projects"),
	maxPages: integer("max_pages"),
	formatRequirements: text("format_requirements"),

	// Selected projects (ordered)
	selectedProjectIds: jsonb("selected_project_ids").$type<string[]>(),

	// Generated content
	introductionNarrative: text("introduction_narrative"),
	conclusionNarrative: text("conclusion_narrative"),

	// Status
	status: varchar("status", { length: 50 }).default("draft"), // draft, in_review, approved, submitted

	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// Relations
// ============================================================================

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

// ============================================================================
// Types
// ============================================================================

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectRelevanceScore = typeof projectRelevanceScores.$inferSelect;
export type NewProjectRelevanceScore = typeof projectRelevanceScores.$inferInsert;
export type ProjectDocument = typeof projectDocuments.$inferSelect;
export type NewProjectDocument = typeof projectDocuments.$inferInsert;
export type ProjectTag = typeof projectTags.$inferSelect;
export type PastPerfVolume = typeof pastPerfVolumes.$inferSelect;
