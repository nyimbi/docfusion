/**
 * Import Database Schema for DocFusion
 *
 * Tables for managing universal data import functionality:
 * - importMappingTemplates: Saved column mapping configurations for reuse
 * - dataImports: Import history with rollback support
 *
 * Design Philosophy:
 * - JSONB for flexible mapping structures that vary per import type
 * - Full audit trail for compliance and rollback capability
 * - Template pattern matching for intelligent auto-mapping
 */

import {
	pgTable,
	text,
	timestamp,
	integer,
	jsonb,
	uuid,
	varchar,
	index,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// Types for JSONB Columns
// ============================================================================

/**
 * Column mapping configuration stored in templates.
 * Supports concatenation of multiple source columns with custom separator.
 */
export interface ColumnMappingConfig {
	/** Target column name in the database table */
	targetColumn: string;
	/** Source column names from the spreadsheet (multiple for concatenation) */
	sourceColumns: string[];
	/** Separator used when concatenating multiple columns (e.g., ", ", " - ") */
	separator?: string;
	/** Transform to apply: uppercase, lowercase, trim, date, number, currency, email, phone */
	transform?: string;
	/** Default value if all source columns are empty */
	defaultValue?: string;
	/** Whether this mapping is required for import */
	required: boolean;
}

/**
 * Import error detail for individual row failures.
 */
export interface ImportError {
	/** Row number (1-indexed) in the source file */
	row: number;
	/** Column name where error occurred (if applicable) */
	column?: string;
	/** Value that caused the error */
	value?: string;
	/** Error message describing the issue */
	error: string;
}

// ============================================================================
// IMPORT MAPPING TEMPLATES
// ============================================================================

/**
 * Import Mapping Templates table for saving reusable column mappings.
 *
 * Templates store:
 * - Target table and column mappings
 * - Source column patterns for auto-detection
 * - Usage statistics for prioritizing frequently-used templates
 *
 * Use Cases:
 * - Recurring imports from the same vendor/source
 * - Organization-wide standard import formats
 * - Quick re-application of complex mappings
 */
export const importMappingTemplates = pgTable(
	"import_mapping_templates",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Organization ID for multi-tenant isolation */
		organizationId: varchar("organization_id", { length: 255 }),

		// ===== Template Identity =====
		/** Template name for display and search */
		name: varchar("name", { length: 200 }).notNull(),
		/** Description of when to use this template */
		description: text("description"),
		/** Target database table: opportunities, contacts, accounts, partners */
		targetTable: varchar("target_table", { length: 100 }).notNull(),

		// ===== Column Mappings =====
		/**
		 * Array of column mapping configurations.
		 * Each mapping defines source-to-target transformation.
		 */
		mappings: jsonb("mappings").$type<ColumnMappingConfig[]>().notNull(),

		// ===== Auto-Detection Hints =====
		/**
		 * Source column patterns for automatic template matching.
		 * Keys are canonical names, values are arrays of possible source column names.
		 * Example: { "title": ["Project Title", "Name", "Subject"], "deadline": ["Due Date", "Deadline"] }
		 */
		sourceColumnPatterns: jsonb("source_column_patterns").$type<Record<string, string[]>>(),

		// ===== Usage Tracking =====
		/** Number of times this template has been used */
		useCount: integer("use_count").default(0),
		/** Last time this template was used for an import */
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

		// ===== Audit =====
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
		/** User who created this template */
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
// DATA IMPORTS (Import History)
// ============================================================================

/**
 * Data Imports table for tracking all import operations.
 *
 * Features:
 * - Full import history with statistics
 * - Rollback support via importedIds tracking
 * - Error logging for debugging and user feedback
 *
 * Status Flow:
 * pending -> processing -> completed | failed | cancelled
 */
export const dataImports = pgTable(
	"data_imports",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Organization ID for multi-tenant isolation */
		organizationId: varchar("organization_id", { length: 255 }),

		// ===== File Information =====
		/** Original filename from upload */
		filename: varchar("filename", { length: 500 }).notNull(),
		/** File type: xlsx, xls, csv, tsv */
		fileType: varchar("file_type", { length: 20 }).notNull(),
		/** File size in bytes */
		fileSize: integer("file_size"),
		/** Sheet name (for Excel files with multiple sheets) */
		sheetName: varchar("sheet_name", { length: 200 }),

		// ===== Target Configuration =====
		/** Target database table: opportunities, contacts, accounts, partners */
		targetTable: varchar("target_table", { length: 100 }).notNull(),
		/** Reference to template used (if any) */
		templateId: uuid("template_id").references(() => importMappingTemplates.id, { onDelete: "set null" }),

		// ===== Mappings Used =====
		/**
		 * Snapshot of column mappings used for this import.
		 * Stored separately from template for historical accuracy.
		 */
		mappingsUsed: jsonb("mappings_used").$type<Array<{
			targetColumn: string;
			sourceColumns: string[];
			separator?: string;
			transform?: string;
		}>>(),

		// ===== Import Statistics =====
		/** Total rows in source file */
		totalRows: integer("total_rows").default(0),
		/** Rows successfully imported as new records */
		importedRows: integer("imported_rows").default(0),
		/** Existing rows updated (when duplicate handling is 'update') */
		updatedRows: integer("updated_rows").default(0),
		/** Rows skipped (duplicates when handling is 'skip') */
		skippedRows: integer("skipped_rows").default(0),
		/** Rows that failed validation or import */
		failedRows: integer("failed_rows").default(0),

		// ===== Status =====
		/** Import status: pending, processing, completed, failed, cancelled */
		status: varchar("status", { length: 30 }).default("pending"),

		// ===== Error Details =====
		/** Array of errors encountered during import */
		errors: jsonb("errors").$type<ImportError[]>().default([]),

		// ===== Import Options =====
		/** How to handle duplicate records: skip, update, create */
		duplicateHandling: varchar("duplicate_handling", { length: 30 }).default("skip"),
		/** Batch size used for import processing */
		batchSize: integer("batch_size").default(100),

		// ===== Rollback Support =====
		/**
		 * IDs of all records created by this import.
		 * Enables complete rollback by deleting all created records.
		 */
		importedIds: jsonb("imported_ids").$type<string[]>().default([]),

		// ===== Timestamps =====
		/** When import was initiated */
		startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
		/** When import completed (success or failure) */
		completedAt: timestamp("completed_at", { withTimezone: true }),

		// ===== Audit =====
		/** User who initiated the import */
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

// ============================================================================
// RELATIONS
// ============================================================================

export const importMappingTemplatesRelations = relations(importMappingTemplates, ({ many }) => ({
	imports: many(dataImports),
}));

export const dataImportsRelations = relations(dataImports, ({ one }) => ({
	template: one(importMappingTemplates, {
		fields: [dataImports.templateId],
		references: [importMappingTemplates.id],
	}),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ImportMappingTemplateRow = typeof importMappingTemplates.$inferSelect;
export type NewImportMappingTemplate = typeof importMappingTemplates.$inferInsert;

export type DataImportRow = typeof dataImports.$inferSelect;
export type NewDataImport = typeof dataImports.$inferInsert;
