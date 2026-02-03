/**
 * Bibliography Schema
 *
 * Database schema for managing bibliography entries, citations,
 * and reference tracking for documents.
 */

import {
	pgTable,
	uuid,
	varchar,
	text,
	integer,
	timestamp,
	jsonb,
	boolean,
	index,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { documents } from "./schema";

// ============================================================================
// Entry Types
// ============================================================================

export const bibliographyEntryTypes = [
	"article",
	"book",
	"booklet",
	"conference",
	"inbook",
	"incollection",
	"inproceedings",
	"manual",
	"mastersthesis",
	"misc",
	"phdthesis",
	"proceedings",
	"techreport",
	"unpublished",
] as const;

export type BibliographyEntryType = (typeof bibliographyEntryTypes)[number];

export const citationStyles = [
	"apa",
	"mla",
	"chicago",
	"ieee",
	"vancouver",
	"harvard",
] as const;

export type CitationStyleType = (typeof citationStyles)[number];

// ============================================================================
// Bibliography Entries Table
// ============================================================================

export const bibliographyEntries = pgTable(
	"bibliography_entries",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id"),

		// Core BibTeX fields
		citeKey: varchar("cite_key", { length: 100 }).notNull(),
		entryType: varchar("entry_type", { length: 50 }).notNull().$type<BibliographyEntryType>(),
		title: text("title").notNull(),
		authors: jsonb("authors").$type<string[]>().notNull().default([]),
		editors: jsonb("editors").$type<string[]>(),

		// Publication details
		journal: varchar("journal", { length: 500 }),
		booktitle: varchar("booktitle", { length: 500 }),
		publisher: varchar("publisher", { length: 500 }),
		year: integer("year").notNull(),
		month: varchar("month", { length: 20 }),
		volume: varchar("volume", { length: 50 }),
		number: varchar("number", { length: 50 }),
		pages: varchar("pages", { length: 50 }),
		edition: varchar("edition", { length: 50 }),
		series: varchar("series", { length: 200 }),
		chapter: varchar("chapter", { length: 100 }),

		// Identifiers
		doi: varchar("doi", { length: 200 }),
		isbn: varchar("isbn", { length: 50 }),
		issn: varchar("issn", { length: 50 }),
		url: text("url"),
		arxivId: varchar("arxiv_id", { length: 50 }),
		pmid: varchar("pmid", { length: 20 }),

		// Content
		abstract: text("abstract"),
		keywords: jsonb("keywords").$type<string[]>(),
		note: text("note"),

		// Location info
		address: varchar("address", { length: 500 }),
		institution: varchar("institution", { length: 500 }),
		school: varchar("school", { length: 500 }),
		organization: varchar("organization", { length: 500 }),

		// Usage tracking
		citationCount: integer("citation_count").notNull().default(0),
		lastCitedAt: timestamp("last_cited_at", { withTimezone: true }),

		// AI-generated fields
		aiSummary: text("ai_summary"),
		aiKeyTerms: jsonb("ai_key_terms").$type<string[]>(),
		relevanceScore: integer("relevance_score"), // 0-100

		// Metadata
		isPublic: boolean("is_public").notNull().default(true),
		createdBy: uuid("created_by"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("bib_entries_org_idx").on(table.organizationId),
		index("bib_entries_type_idx").on(table.entryType),
		index("bib_entries_year_idx").on(table.year),
		uniqueIndex("bib_entries_cite_key_org_idx").on(table.citeKey, table.organizationId),
	]
);

// ============================================================================
// Document Citations Table (Links bibliography entries to documents)
// ============================================================================

export const documentCitations = pgTable(
	"document_citations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		documentId: uuid("document_id")
			.notNull()
			.references(() => documents.id, { onDelete: "cascade" }),
		bibliographyEntryId: uuid("bibliography_entry_id")
			.notNull()
			.references(() => bibliographyEntries.id, { onDelete: "cascade" }),

		// Citation details
		citationStyle: varchar("citation_style", { length: 20 }).$type<CitationStyleType>(),
		formattedCitation: text("formatted_citation"), // Cached formatted citation
		inTextCitation: text("in_text_citation"), // e.g., "(Smith, 2023)"

		// Position in document (optional)
		sectionId: varchar("section_id", { length: 100 }),
		pageNumber: integer("page_number"),

		// Timestamps
		citedAt: timestamp("cited_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("doc_citations_doc_idx").on(table.documentId),
		index("doc_citations_entry_idx").on(table.bibliographyEntryId),
	]
);

// ============================================================================
// Citation Styles Preferences (per document or user)
// ============================================================================

export const citationPreferences = pgTable(
	"citation_preferences",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }),
		userId: uuid("user_id"),
		organizationId: uuid("organization_id"),

		// Style settings
		defaultStyle: varchar("default_style", { length: 20 })
			.notNull()
			.$type<CitationStyleType>()
			.default("apa"),
		includeUrl: boolean("include_url").notNull().default(true),
		includeDoi: boolean("include_doi").notNull().default(true),
		includeAccessDate: boolean("include_access_date").notNull().default(false),
		sortOrder: varchar("sort_order", { length: 20 }).notNull().default("author"), // author, year, citation_order

		// Custom formatting
		customSettings: jsonb("custom_settings").$type<Record<string, unknown>>(),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("cite_prefs_doc_idx").on(table.documentId),
		index("cite_prefs_user_idx").on(table.userId),
	]
);

// ============================================================================
// Relations
// ============================================================================

export const bibliographyEntriesRelations = relations(bibliographyEntries, ({ many }) => ({
	citations: many(documentCitations),
}));

export const documentCitationsRelations = relations(documentCitations, ({ one }) => ({
	document: one(documents, {
		fields: [documentCitations.documentId],
		references: [documents.id],
	}),
	bibliographyEntry: one(bibliographyEntries, {
		fields: [documentCitations.bibliographyEntryId],
		references: [bibliographyEntries.id],
	}),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type BibliographyEntryRow = typeof bibliographyEntries.$inferSelect;
export type NewBibliographyEntry = typeof bibliographyEntries.$inferInsert;
export type DocumentCitationRow = typeof documentCitations.$inferSelect;
export type NewDocumentCitation = typeof documentCitations.$inferInsert;
export type CitationPreferencesRow = typeof citationPreferences.$inferSelect;
export type NewCitationPreferences = typeof citationPreferences.$inferInsert;
