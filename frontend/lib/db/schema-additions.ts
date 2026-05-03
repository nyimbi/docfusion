/**
 * Database schema additions for Template Snippets, Edits, and Partials
 *
 * These augment the existing schema.ts with new tables for:
 * - Template snippets (reusable content blocks)
 * - Template edit history/versions
 * - Partial templates (combining templates)
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
	index,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user, organization } from "./auth-schema";
import { templates } from "./schema";

// ============================================================================
// Template Snippets - Reusable content blocks
// ============================================================================

export const templateSnippets = pgTable(
	"template_snippets",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Snippet name (e.g., "Company Header") */
		name: varchar("name", { length: 200 }).notNull(),
		/** Shortcut for quick insertion (e.g., "/header") */
		shortcut: varchar("shortcut", { length: 50 }).notNull(),
		/** Content stored as Tiptap JSON */
		content: jsonb("content").notNull(),
		/** Placeholder definitions used by snippet context resolution */
		placeholders: jsonb("placeholders").notNull().default([]),
		/** Description of what this snippet contains */
		description: text("description"),
		/** Tags for categorization and search */
		tags: jsonb("tags").notNull().default([]),
		/** Category for organization */
		category: varchar("category", { length: 100 }),
		/** Creator user ID */
		createdBy: varchar("created_by", { length: 100 }).notNull(),
		/** Organization ID for multi-tenancy */
		organizationId: varchar("organization_id", { length: 100 }),
		/** Usage count for analytics */
		useCount: integer("use_count").notNull().default(0),
		/** Whether this snippet is public/shared across org */
		isPublic: boolean("is_public").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("snippets_created_by_idx").on(table.createdBy),
		index("snippets_org_idx").on(table.organizationId),
		index("snippets_category_idx").on(table.category),
		index("snippets_use_count_idx").on(table.useCount),
		index("snippets_is_public_idx").on(table.isPublic),
		uniqueIndex("snippets_shortcut_org_idx").on(table.shortcut, table.organizationId),
	]
);

// ============================================================================
// Template Edits - Track template modifications for versioning
// ============================================================================

export const templateEdits = pgTable(
	"template_edits",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Template that was modified */
		templateId: uuid("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),
		/** User who made the change */
		userId: varchar("user_id", { length: 100 }).notNull(),
		/** Type of change: create, edit, delete, publish, revert */
		type: varchar("type", { length: 20 }).notNull(),
		/** Detailed changes (diff or snapshot) */
		changes: jsonb("changes").notNull(),
		/** Version number after this edit */
		versionNumber: integer("version_number"),
		/** Optional comment about the change */
		comment: text("comment"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("edits_template_idx").on(table.templateId),
		index("edits_user_idx").on(table.userId),
		index("edits_type_idx").on(table.type),
		index("edits_created_idx").on(table.createdAt),
	]
);

// ============================================================================
// Template Partials - Reusable template sections
// ============================================================================

export const templatePartials = pgTable(
	"template_partials",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Partial name */
		name: varchar("name", { length: 200 }).notNull(),
		/** Description of what this partial contains */
		description: text("description"),
		/** Content stored as Tiptap JSON */
		content: jsonb("content").notNull(),
		/** Placeholder field definitions */
		placeholders: jsonb("placeholders").notNull().default([]),
		/** Usage tracking (which templates use this partial) */
		usage: jsonb("usage").notNull().default({
			templateIds: [],
			useCount: 0,
		}),
		/** Creator user ID */
		createdBy: varchar("created_by", { length: 100 }).notNull(),
		/** Organization ID */
		organizationId: varchar("organization_id", { length: 100 }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("partials_created_by_idx").on(table.createdBy),
		index("partials_org_idx").on(table.organizationId),
	]
);

// ============================================================================
// Template Versions - Full template version snapshots
// ============================================================================

export const templateVersions = pgTable(
	"template_versions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Template this is a version of */
		templateId: uuid("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),
		/** Version number */
		versionNumber: integer("version_number").notNull(),
		/** Full template snapshot */
		content: jsonb("content").notNull(),
		/** Placeholder definitions at this version */
		placeholders: jsonb("placeholders").notNull().default([]),
		/** AI instructions at this version */
		aiInstructions: jsonb("ai_instructions").notNull().default([]),
		/** Change description */
		changeDescription: text("change_description"),
		/** User who created this version */
		createdBy: varchar("created_by", { length: 100 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("template_versions_template_idx").on(table.templateId),
		uniqueIndex("template_versions_number_idx").on(table.templateId, table.versionNumber),
	]
);

// ============================================================================
// Relations
// ============================================================================

export const templateSnippetsRelations = relations(templateSnippets, ({ one }) => ({
	creator: one(user, {
		fields: [templateSnippets.createdBy],
		references: [user.id],
	}),
	org: one(organization, {
		fields: [templateSnippets.organizationId],
		references: [organization.id],
	}),
}));

export const templateEditsRelations = relations(templateEdits, ({ one }) => ({
	template: one(templates, {
		fields: [templateEdits.templateId],
		references: [templates.id],
	}),
	editor: one(user, {
		fields: [templateEdits.userId],
		references: [user.id],
	}),
}));

export const templatePartialsRelations = relations(templatePartials, ({ one }) => ({
	creator: one(user, {
		fields: [templatePartials.createdBy],
		references: [user.id],
	}),
	org: one(organization, {
		fields: [templatePartials.organizationId],
		references: [organization.id],
	}),
}));

export const templateVersionsRelations = relations(templateVersions, ({ one }) => ({
	template: one(templates, {
		fields: [templateVersions.templateId],
		references: [templates.id],
	}),
	creator: one(user, {
		fields: [templateVersions.createdBy],
		references: [user.id],
	}),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type TemplateSnippetRow = typeof templateSnippets.$inferSelect;
export type NewTemplateSnippet = typeof templateSnippets.$inferInsert;

export type TemplateEditRow = typeof templateEdits.$inferSelect;
export type NewTemplateEdit = typeof templateEdits.$inferInsert;

export type TemplatePartialRow = typeof templatePartials.$inferSelect;
export type NewTemplatePartial = typeof templatePartials.$inferInsert;

export type TemplateVersionRow = typeof templateVersions.$inferSelect;
export type NewTemplateVersion = typeof templateVersions.$inferInsert;

// ============================================================================
// Quality Assessments - AI-powered document quality assessments
// ============================================================================

import { documents } from "./schema";

export const qualityAssessments = pgTable(
	"quality_assessments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Document that was assessed */
		documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
		/** Document version ID if versioning enabled */
		versionId: uuid("version_id"),
		/** Overall quality score (0-100) */
		overallScore: integer("overall_score").notNull(),
		/** Score level: excellent, good, average, needs_work, poor */
		scoreLevel: varchar("score_level", { length: 20 }).notNull(),
		/** Category scores breakdown */
		categoryScores: jsonb("category_scores").notNull().default([]),
		/** All factor scores and details */
		factors: jsonb("factors").notNull().default([]),
		/** Issues found during assessment */
		issues: jsonb("issues").notNull().default([]),
		/** Suggestions for improvement */
		suggestions: jsonb("suggestions").notNull().default([]),
		/** Document summary statistics */
		summary: jsonb("summary").notNull().$default(() => ({
			wordCount: 0,
			paragraphCount: 0,
			sentenceCount: 0,
			averageSentenceLength: 0,
			passiveVoicePercentage: 0,
			readabilityGrade: 0,
			activeVoicePercentage: 0,
			undefinedAcronyms: [],
			weakLanguageCount: 0,
		})),
		/** Model version used for assessment */
		modelVersion: varchar("model_version", { length: 50 }),
		/** When assessment was performed */
		assessedAt: timestamp("assessed_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("quality_doc_idx").on(table.documentId),
		index("quality_version_idx").on(table.versionId),
		index("quality_assessed_at_idx").on(table.assessedAt),
		index("quality_score_idx").on(table.overallScore),
	]
);

// ============================================================================
// Quality Assessments Relations
// ============================================================================

export const qualityAssessmentsRelations = relations(qualityAssessments, ({ one }) => ({
	document: one(documents, {
		fields: [qualityAssessments.documentId],
		references: [documents.id],
	}),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type QualityAssessmentRow = typeof qualityAssessments.$inferSelect;
export type NewQualityAssessment = typeof qualityAssessments.$inferInsert;
