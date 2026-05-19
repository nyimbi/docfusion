/**
 * Import Server Actions
 *
 * Server-side actions for universal data import functionality.
 * Handles file parsing, data transformation, preview generation,
 * import execution, and template management.
 *
 * Privacy Model:
 * - Each import is owned by the user who initiated it
 * - Imported records inherit the organization context
 * - Import history is organization-scoped for auditing
 */

"use server";

import { db } from "@/lib/db";
import {
	dataImports,
	importMappingTemplates,
	opportunities,
	contacts,
	accounts,
} from "@/lib/db/schema";
import { partners } from "@/lib/db/schema-partners";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import type {
	ImportTargetTable,
	ColumnMapping,
	ImportOptions,
	ImportResult,
	ImportProgress,
	ValidationIssue,
	ImportTemplateSummary,
	ImportTemplateDetail,
	PreviewRow,
} from "@/lib/types/import";
import { transformRows, generateValidationResult, createUniqueKey, convertDatesToObjects } from "@/lib/import/data-transformer";
import { getTableSchema } from "@/lib/import/table-schemas";
import type { ColumnMappingConfig } from "@/lib/db/schema-import";
import { logger } from "@/lib/utils/logger";
import { requireUserContext } from "@/lib/auth-utils";

// ============================================================================
// Types
// ============================================================================

interface UserContext {
	userId: string;
	organizationId?: string;
}

interface ParsedData {
	headers: string[];
	sampleRows: Record<string, unknown>[];
	totalRows: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function requireMatchingUserContext(input: UserContext): Promise<UserContext> {
	const current = await requireUserContext();
	if (current.userId !== input.userId) {
		throw new Error("Unauthorized");
	}
	if (input.organizationId && current.organizationId !== input.organizationId) {
		throw new Error("Unauthorized");
	}
	return current;
}

/**
 * Get the Drizzle table for a target table name.
 */
function getTable(targetTable: ImportTargetTable) {
	switch (targetTable) {
		case "opportunities":
			return opportunities;
		case "contacts":
			return contacts;
		case "accounts":
			return accounts;
		case "partners":
			return partners;
		default:
			throw new Error(`Unknown target table: ${targetTable}`);
	}
}

/**
 * Check for existing records based on unique key fields.
 */
async function findExistingRecords(
	targetTable: ImportTargetTable,
	uniqueKeys: string[],
	userContext: UserContext
): Promise<Set<string>> {
	const table = getTable(targetTable);
	const schema = getTableSchema(targetTable);
	const existingSet = new Set<string>();

	// Build query to find existing records
	// This is a simplified approach - real implementation would build proper WHERE clause
	try {
		let query;

		switch (targetTable) {
			case "opportunities": {
				query = db
					.select({ sourceId: opportunities.sourceId, sourceFile: opportunities.sourceFile })
					.from(opportunities);
				break;
			}
			case "contacts": {
				query = db
					.select({ email: contacts.email })
					.from(contacts)
					.where(eq(contacts.ownerId, userContext.userId));
				break;
			}
			case "accounts": {
				query = db
					.select({ name: accounts.name, country: accounts.country, type: accounts.type })
					.from(accounts);
				break;
			}
			case "partners": {
				query = db
					.select({ name: partners.name, country: partners.country })
					.from(partners);
				break;
			}
		}

		const results = await query;

		for (const row of results) {
			const key = schema.uniqueKeyFields
				.map((field) => String((row as Record<string, unknown>)[field] || "").toLowerCase())
				.join("|");
			if (key && key !== "|".repeat(schema.uniqueKeyFields.length - 1)) {
				existingSet.add(key);
			}
		}
	} catch (error) {
		logger.error("Error finding existing records:", error);
	}

	return existingSet;
}

/**
 * Parse PostgreSQL error to extract useful information.
 */
function parsePostgresError(error: unknown): {
	message: string;
	column?: string;
	detail?: string;
	constraint?: string;
	dataType?: string;
} {
	const err = error as {
		message?: string;
		code?: string;
		column?: string;
		detail?: string;
		constraint?: string;
		dataType?: string;
		routine?: string;
	};

	const message = err.message || "Unknown database error";

	// Common PostgreSQL error codes
	// 22P02 - invalid_text_representation (type mismatch)
	// 22001 - string_data_right_truncation (value too long)
	// 23502 - not_null_violation
	// 23503 - foreign_key_violation
	// 23505 - unique_violation
	// 22007 - invalid_datetime_format
	// 22003 - numeric_value_out_of_range

	let detail = err.detail;
	let column = err.column;

	// Try to extract column name from error message
	if (!column && message.includes('column "')) {
		const match = message.match(/column "([^"]+)"/);
		if (match) column = match[1];
	}

	// Extract data type info from message
	let dataType = err.dataType;
	if (!dataType && message.includes('type')) {
		const match = message.match(/type (\w+)/);
		if (match) dataType = match[1];
	}

	// Parse common error patterns
	if (message.includes('invalid input syntax')) {
		const typeMatch = message.match(/invalid input syntax for (?:type )?(\w+)/);
		if (typeMatch) {
			dataType = typeMatch[1];
			detail = `Value cannot be converted to ${dataType}. Check that the source data matches the expected format.`;
		}
	}

	if (message.includes('value too long')) {
		const lenMatch = message.match(/character varying\((\d+)\)/);
		if (lenMatch) {
			detail = `Value exceeds maximum length of ${lenMatch[1]} characters.`;
		}
	}

	if (message.includes('violates not-null constraint')) {
		detail = `Required field is missing or empty.`;
	}

	if (message.includes('violates unique constraint')) {
		detail = `A record with this value already exists.`;
	}

	return { message, column, detail, constraint: err.constraint, dataType };
}

/**
 * Insert records into the target table with per-record error handling.
 * Returns both successful IDs and detailed errors for failed records.
 */
async function insertRecords(
	targetTable: ImportTargetTable,
	records: Record<string, unknown>[],
	userContext: UserContext
): Promise<{
	insertedIds: string[];
	errors: Array<{ index: number; error: string; column?: string; detail?: string }>
}> {
	if (records.length === 0) return { insertedIds: [], errors: [] };

	const table = getTable(targetTable);
	const insertedIds: string[] = [];
	const errors: Array<{ index: number; error: string; column?: string; detail?: string }> = [];

	// Add user context fields to records
	const enrichedRecords = records.map((record) => {
		const enriched = { ...record };

		switch (targetTable) {
			case "opportunities":
				// Opportunities don't have owner in this schema
				break;
			case "contacts":
				enriched.ownerId = userContext.userId;
				enriched.organizationId = userContext.organizationId;
				enriched.visibility = "private";
				enriched.createdBy = userContext.userId;
				break;
			case "accounts":
				enriched.ownerId = userContext.userId;
				enriched.createdBy = userContext.userId;
				break;
			case "partners":
				// Partners table structure
				break;
		}

		return enriched;
	});

	// Try batch insert first (most efficient)
	try {
		const result = await db.insert(table).values(enrichedRecords as never[]).returning({ id: (table as { id: unknown }).id as never });
		insertedIds.push(...result.map((r) => (r as { id: string }).id));
		return { insertedIds, errors };
	} catch (batchError) {
		// Batch failed - try inserting one by one to identify problematic records
		logger.warn("Batch insert failed, falling back to individual inserts:", batchError);

		for (let i = 0; i < enrichedRecords.length; i++) {
			try {
				const result = await db.insert(table).values(enrichedRecords[i] as never).returning({ id: (table as { id: unknown }).id as never });
				insertedIds.push((result[0] as { id: string }).id);
			} catch (recordError) {
				const parsed = parsePostgresError(recordError);
				errors.push({
					index: i,
					error: parsed.message,
					column: parsed.column,
					detail: parsed.detail || `Failed to insert record. ${parsed.dataType ? `Expected type: ${parsed.dataType}` : ""}`,
				});
			}
		}

		return { insertedIds, errors };
	}
}

// ============================================================================
// Preview Actions
// ============================================================================

/**
 * Generate preview of transformed data.
 */
export async function generatePreview(
	parsedData: ParsedData,
	targetTable: ImportTargetTable,
	mappings: ColumnMapping[],
	previewCount: number = 20
): Promise<{
	rows: PreviewRow[];
	validation: ReturnType<typeof generateValidationResult>;
	totalRows: number;
}> {
	// Transform sample rows
	const previewRows = transformRows(
		parsedData.sampleRows.slice(0, previewCount),
		mappings,
		targetTable
	);

	// Generate validation result
	const validation = generateValidationResult(previewRows);

	return {
		rows: previewRows,
		validation,
		totalRows: parsedData.totalRows,
	};
}

// ============================================================================
// Import Execution
// ============================================================================

/**
 * Execute the import operation.
 */
export async function executeImport(
	parsedData: {
		sampleRows: Record<string, unknown>[];
		totalRows: number;
		metadata: { filename: string; fileType: string; fileSize?: number; sheetName?: string };
	},
	targetTable: ImportTargetTable,
	mappings: ColumnMapping[],
	options: ImportOptions,
	userContext: UserContext
): Promise<ImportResult> {
	const currentUserContext = await requireMatchingUserContext(userContext);
	const startTime = Date.now();
	const importedIds: string[] = [];
	const errors: ValidationIssue[] = [];
	let importedRows = 0;
	let updatedRows = 0;
	let skippedRows = 0;
	let failedRows = 0;

	// Create import record
	const [importRecord] = await db
		.insert(dataImports)
		.values({
			organizationId: currentUserContext.organizationId,
			filename: parsedData.metadata.filename,
			fileType: parsedData.metadata.fileType,
			fileSize: parsedData.metadata.fileSize,
			sheetName: parsedData.metadata.sheetName,
			targetTable,
			mappingsUsed: mappings.map((m) => ({
				targetColumn: m.targetColumn,
				sourceColumns: m.sourceColumns,
				separator: m.separator,
				transform: m.transform,
			})),
			totalRows: parsedData.totalRows,
			status: "processing",
			duplicateHandling: options.duplicateHandling,
			batchSize: options.batchSize,
			importedBy: currentUserContext.userId,
			startedAt: new Date(),
		})
		.returning({ id: dataImports.id });

	const importId = importRecord.id;
	const schema = getTableSchema(targetTable);

	try {
		// Get existing records for duplicate detection
		const existingKeys = await findExistingRecords(targetTable, schema.uniqueKeyFields, currentUserContext);

		// Transform all rows
		const allRows = transformRows(parsedData.sampleRows, mappings, targetTable);

		// Process in batches
		const batchSize = options.batchSize || 100;
		const toInsert: Record<string, unknown>[] = [];
		const toUpdate: Array<{ key: string; values: Record<string, unknown> }> = [];

		for (let i = 0; i < allRows.length; i++) {
			const row = allRows[i];

			// Skip rows with errors
			if (row.hasError) {
				failedRows++;
				errors.push(...row.issues.filter((issue) => issue.severity === "error"));
				continue;
			}

			// Check for duplicates
			const uniqueKey = createUniqueKey(row.targetValues, schema.uniqueKeyFields);

			if (existingKeys.has(uniqueKey)) {
				switch (options.duplicateHandling) {
					case "skip":
						skippedRows++;
						continue;
					case "update":
						// Convert date strings to Date objects for Drizzle ORM
						toUpdate.push({ key: uniqueKey, values: convertDatesToObjects(row.targetValues, targetTable) });
						updatedRows++;
						existingKeys.add(uniqueKey); // Prevent processing same key twice
						continue;
					case "create":
						// Fall through to insert
						break;
				}
			}

			// Track key to prevent duplicates within batch
			existingKeys.add(uniqueKey);
			// Convert date strings to Date objects for Drizzle ORM
			toInsert.push(convertDatesToObjects(row.targetValues, targetTable));
		}

		// Insert new records in batches
		for (let i = 0; i < toInsert.length; i += batchSize) {
			const batch = toInsert.slice(i, i + batchSize);
			const batchStartRow = i + 1; // 1-based row numbers

			const result = await insertRecords(targetTable, batch, currentUserContext);

			// Track successful inserts
			importedIds.push(...result.insertedIds);
			importedRows += result.insertedIds.length;

			// Track failed inserts with detailed errors
			for (const err of result.errors) {
				const rowNum = batchStartRow + err.index;
				const rowData = batch[err.index];
				errors.push({
					row: rowNum,
					column: err.column,
					value: err.column && rowData ? String(rowData[err.column] || "") : undefined,
					message: err.detail || err.error,
					severity: "error",
				});
				failedRows++;
			}
		}

		// Update import record with results
		// Convert ValidationIssue to ImportError format for DB storage
		const dbErrors = errors.slice(0, 100).map((e) => ({
			row: e.row,
			column: e.column,
			value: e.value !== undefined ? String(e.value) : undefined,
			error: e.message,
		}));

		await db
			.update(dataImports)
			.set({
				status: "completed",
				importedRows,
				updatedRows,
				skippedRows,
				failedRows,
				errors: dbErrors,
				importedIds,
				completedAt: new Date(),
			})
			.where(eq(dataImports.id, importId));

		// Save as template if requested
		let savedTemplateId: string | undefined;
		if (options.saveAsTemplate && options.templateName) {
			const [template] = await db
				.insert(importMappingTemplates)
				.values({
					organizationId: currentUserContext.organizationId,
					name: options.templateName,
					description: options.templateDescription,
					targetTable,
					mappings: mappings.map((m): ColumnMappingConfig => ({
						targetColumn: m.targetColumn,
						sourceColumns: m.sourceColumns,
						separator: m.separator,
						transform: m.transform,
						defaultValue: m.defaultValue,
						required: m.required,
					})),
					createdBy: currentUserContext.userId,
				})
				.returning({ id: importMappingTemplates.id });
			savedTemplateId = template.id;
		}

		return {
			importId,
			success: failedRows === 0,
			totalRows: parsedData.totalRows,
			importedRows,
			updatedRows,
			skippedRows,
			failedRows,
			importedIds,
			errors,
			durationMs: Date.now() - startTime,
			savedTemplateId,
		};
	} catch (error) {
		// Update import record with failure
		const errorMsg = error instanceof Error ? error.message : "Unknown error";
		await db
			.update(dataImports)
			.set({
				status: "failed",
				errors: [{ row: 0, error: errorMsg }],
				completedAt: new Date(),
			})
			.where(eq(dataImports.id, importId));

		return {
			importId,
			success: false,
			totalRows: parsedData.totalRows,
			importedRows: 0,
			updatedRows: 0,
			skippedRows: 0,
			failedRows: parsedData.totalRows,
			importedIds: [],
			errors: [{ row: 0, message: errorMsg, severity: "error" as const }],
			durationMs: Date.now() - startTime,
		};
	}
}

// ============================================================================
// Import Progress
// ============================================================================

/**
 * Get import progress by ID.
 */
export async function getImportProgress(
	importId: string,
	userContext: UserContext
): Promise<ImportProgress | null> {
	const currentUserContext = await requireMatchingUserContext(userContext);

	const [record] = await db
		.select()
		.from(dataImports)
		.where(
			and(
				eq(dataImports.id, importId),
				eq(dataImports.importedBy, currentUserContext.userId)
			)
		);

	if (!record) return null;

	const totalRows = record.totalRows || 0;
	const processedRows =
		(record.importedRows || 0) +
		(record.updatedRows || 0) +
		(record.skippedRows || 0) +
		(record.failedRows || 0);

	return {
		importId: record.id,
		status: record.status as ImportProgress["status"],
		totalRows,
		processedRows,
		importedRows: record.importedRows || 0,
		updatedRows: record.updatedRows || 0,
		skippedRows: record.skippedRows || 0,
		failedRows: record.failedRows || 0,
		currentBatch: 0,
		totalBatches: 0,
		percentage: totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 0,
		// Convert ImportError from DB to ValidationIssue format
		errors: ((record.errors || []) as Array<{ row: number; column?: string; value?: string; error: string }>).map((e) => ({
			row: e.row,
			column: e.column,
			value: e.value,
			message: e.error,
			severity: "error" as const,
		})),
		startedAt: record.startedAt?.toISOString() || new Date().toISOString(),
		completedAt: record.completedAt?.toISOString(),
	};
}

// ============================================================================
// Import History
// ============================================================================

/**
 * Get import history for the organization.
 */
export async function getImportHistory(
	userContext: UserContext,
	limit: number = 20
): Promise<Array<{
	id: string;
	filename: string;
	targetTable: string;
	status: string;
	totalRows: number;
	importedRows: number;
	failedRows: number;
	startedAt: string;
	completedAt?: string;
}>> {
	const currentUserContext = await requireMatchingUserContext(userContext);

	const records = await db
		.select({
			id: dataImports.id,
			filename: dataImports.filename,
			targetTable: dataImports.targetTable,
			status: dataImports.status,
			totalRows: dataImports.totalRows,
			importedRows: dataImports.importedRows,
			failedRows: dataImports.failedRows,
			startedAt: dataImports.startedAt,
			completedAt: dataImports.completedAt,
		})
		.from(dataImports)
		.where(eq(dataImports.importedBy, currentUserContext.userId))
		.orderBy(sql`${dataImports.startedAt} DESC`)
		.limit(limit);

	return records.map((r) => ({
		id: r.id,
		filename: r.filename,
		targetTable: r.targetTable,
		status: r.status || "unknown",
		totalRows: r.totalRows || 0,
		importedRows: r.importedRows || 0,
		failedRows: r.failedRows || 0,
		startedAt: r.startedAt?.toISOString() || new Date().toISOString(),
		completedAt: r.completedAt?.toISOString(),
	}));
}

/**
 * Rollback an import by deleting all imported records.
 */
export async function rollbackImport(
	importId: string,
	userContext: UserContext
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
	try {
		const currentUserContext = await requireMatchingUserContext(userContext);

		// Get import record
		const [record] = await db
			.select()
			.from(dataImports)
			.where(
				and(
					eq(dataImports.id, importId),
					eq(dataImports.importedBy, currentUserContext.userId)
				)
			);

		if (!record) {
			return { success: false, deletedCount: 0, error: "Import not found" };
		}

		const importedIds = (record.importedIds as string[]) || [];
		if (importedIds.length === 0) {
			return { success: true, deletedCount: 0 };
		}

		// Delete records from target table
		const table = getTable(record.targetTable as ImportTargetTable);
		await db.delete(table).where(inArray((table as { id: unknown }).id as never, importedIds as never[]));

		// Update import record
		await db
			.update(dataImports)
			.set({
				status: "cancelled",
				importedIds: [],
			})
			.where(eq(dataImports.id, importId));

		return { success: true, deletedCount: importedIds.length };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : "Unknown error";
		return { success: false, deletedCount: 0, error: errorMsg };
	}
}

// ============================================================================
// Template Management
// ============================================================================

/**
 * Get all templates for the organization.
 */
export async function getTemplates(
	userContext: UserContext,
	targetTable?: ImportTargetTable
): Promise<ImportTemplateSummary[]> {
	const currentUserContext = await requireMatchingUserContext(userContext);

	// Build conditions array
	const conditions = [
		or(
			eq(importMappingTemplates.organizationId, currentUserContext.organizationId || ""),
			eq(importMappingTemplates.createdBy, currentUserContext.userId)
		),
	];

	if (targetTable) {
		conditions.push(eq(importMappingTemplates.targetTable, targetTable));
	}

	const records = await db
		.select({
			id: importMappingTemplates.id,
			name: importMappingTemplates.name,
			description: importMappingTemplates.description,
			targetTable: importMappingTemplates.targetTable,
			useCount: importMappingTemplates.useCount,
			lastUsedAt: importMappingTemplates.lastUsedAt,
			createdAt: importMappingTemplates.createdAt,
		})
		.from(importMappingTemplates)
		.where(and(...conditions))
		.orderBy(sql`${importMappingTemplates.useCount} DESC`);

	return records.map((r) => ({
		id: r.id,
		name: r.name,
		description: r.description || undefined,
		targetTable: r.targetTable as ImportTargetTable,
		useCount: r.useCount || 0,
		lastUsedAt: r.lastUsedAt?.toISOString(),
		createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
	}));
}

/**
 * Get template detail by ID.
 */
export async function getTemplateDetail(
	templateId: string,
	userContext: UserContext
): Promise<ImportTemplateDetail | null> {
	const currentUserContext = await requireMatchingUserContext(userContext);

	const [record] = await db
		.select()
		.from(importMappingTemplates)
		.where(
			and(
				eq(importMappingTemplates.id, templateId),
				or(
					eq(importMappingTemplates.organizationId, currentUserContext.organizationId || ""),
					eq(importMappingTemplates.createdBy, currentUserContext.userId)
				)
			)
		);

	if (!record) return null;

	// Update use count
	await db
		.update(importMappingTemplates)
		.set({
			useCount: (record.useCount || 0) + 1,
			lastUsedAt: new Date(),
		})
		.where(eq(importMappingTemplates.id, templateId));

	return {
		id: record.id,
		name: record.name,
		description: record.description || undefined,
		targetTable: record.targetTable as ImportTargetTable,
		useCount: (record.useCount || 0) + 1,
		lastUsedAt: new Date().toISOString(),
		createdAt: record.createdAt?.toISOString() || new Date().toISOString(),
		mappings: (record.mappings as ColumnMappingConfig[]) || [],
		sourceColumnPatterns: (record.sourceColumnPatterns as Record<string, string[]>) || undefined,
	};
}

/**
 * Delete a template.
 */
export async function deleteTemplate(
	templateId: string,
	userContext: UserContext
): Promise<{ success: boolean; error?: string }> {
	try {
		const currentUserContext = await requireMatchingUserContext(userContext);
		const result = await db
			.delete(importMappingTemplates)
			.where(
				and(
					eq(importMappingTemplates.id, templateId),
					eq(importMappingTemplates.createdBy, currentUserContext.userId)
				)
			);

		return { success: true };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : "Unknown error";
		return { success: false, error: errorMsg };
	}
}
