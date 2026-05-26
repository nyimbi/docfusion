/**
 * Opportunity Import Server Actions - DocFusion
 *
 * Server-side actions for importing opportunities from delimited files.
 * Handles file parsing, format detection, and database insertion.
 */

"use server";

import { db } from "@/lib/db";
import { opportunities, opportunityImports } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Papa from "papaparse";
import path from "path";
import fs from "fs/promises";
import { getCurrentUserId } from "@/lib/auth-utils";
import { executeOpportunityDiscoveryImport } from "@/lib/services/opportunity-discovery-import";
import type { DiscoveryImportInput, ImportResultsSummary } from "@/lib/services/opportunity-discovery-import";
import {
	detectFormat,
	processRows,
	validateOpportunity,
} from "@/lib/import/spreadsheet-parser";
import type {
	ImportConfig,
	ImportRecordResult,
	NormalizedOpportunity,
	OpportunityImport,
	OpportunityInput,
	RawSpreadsheetRow,
	DetectedFormat,
} from "@/lib/types/opportunity";
import {
	createImportRecord,
	updateImportRecord,
	createOpportunity,
	updateOpportunity,
} from "./opportunities";

type ImportFileData = Buffer | ArrayBuffer | Uint8Array;
export type { DiscoveryImportInput, ImportResultsSummary } from "@/lib/services/opportunity-discovery-import";

// ============================================================================
// File Processing
// ============================================================================

async function requireCurrentUserId(): Promise<string> {
	const userId = await getCurrentUserId();
	if (!userId) {
		throw new Error("Unauthorized");
	}
	return userId;
}

function resolveConfiguredImportPath(
	inputPath: string,
	rootEnvVar: "OPPORTUNITY_IMPORT_ROOT" | "SCRAPER_EXPORT_ROOT"
): string {
	const root = process.env[rootEnvVar];
	if (!root) {
		throw new Error(`${rootEnvVar} is not configured`);
	}

	const rootPath = path.resolve(root);
	const resolvedPath = path.resolve(inputPath);
	const relativePath = path.relative(rootPath, resolvedPath);
	if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
		throw new Error("Import path is outside the configured import root");
	}

	return resolvedPath;
}

function toImportBuffer(data: ImportFileData): Buffer {
	if (Buffer.isBuffer(data)) return data;
	if (data instanceof ArrayBuffer) return Buffer.from(data);
	return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

/**
 * Read and parse a delimited file.
 */
async function parseDelimitedFile(filePath: string): Promise<{
	sheets: { name: string; data: RawSpreadsheetRow[] }[];
	filename: string;
}> {
	const content = await fs.readFile(filePath, "utf-8");

	return {
		sheets: [{ name: "Data", data: parseDelimitedRows(content, filePath) }],
		filename: path.basename(filePath),
	};
}

function parseDelimitedRows(content: string, filename: string): RawSpreadsheetRow[] {
	if (!/\.(csv|tsv)$/i.test(filename)) {
		throw new Error("Only CSV and TSV opportunity imports are supported in the deployed importer");
	}

	const parsed = Papa.parse<Record<string, unknown>>(content, {
		header: true,
		skipEmptyLines: true,
		delimiter: filename.toLowerCase().endsWith(".tsv") ? "\t" : undefined,
		transformHeader: (header) => header.trim(),
	});

	if (parsed.errors.length > 0) {
		throw new Error(`Delimited import parse failed: ${parsed.errors[0].message}`);
	}

	return parsed.data as RawSpreadsheetRow[];
}

/**
 * Detect the format of all sheets in a workbook.
 */
function detectSheetFormats(
	sheets: { name: string; data: RawSpreadsheetRow[] }[]
): { sheet: string; format: DetectedFormat; rowCount: number }[] {
	const results: { sheet: string; format: DetectedFormat; rowCount: number }[] = [];

	for (const sheet of sheets) {
		if (sheet.data.length === 0) continue;

		// Get columns from first row
		const columns = Object.keys(sheet.data[0] || {});
		const format = detectFormat(columns, sheet.name);

		// Skip summary/metadata sheets (typically have very different structure)
		if (
			sheet.name.toLowerCase().includes("summary") ||
			sheet.name.toLowerCase().includes("source") ||
			columns.length < 5
		) {
			continue;
		}

		results.push({
			sheet: sheet.name,
			format,
			rowCount: sheet.data.length,
		});
	}

	return results;
}

// ============================================================================
// Import Operations
// ============================================================================

/** Shared return type for spreadsheet import functions. */
interface SpreadsheetImportResult {
	importId: string;
	results: {
		total: number;
		imported: number;
		updated: number;
		skipped: number;
		failed: number;
	};
	errors: ImportRecordResult[];
}

/**
 * Core import pipeline shared by importFromFile and importFromBuffer.
 *
 * Handles: format detection, sheet selection, row processing, validation,
 * duplicate detection, DB upsert, and import record bookkeeping.
 */
async function executeSpreadsheetImport(
	sheets: { name: string; data: RawSpreadsheetRow[] }[],
	filename: string,
	config?: Partial<ImportConfig>
): Promise<SpreadsheetImportResult> {
	// Detect formats
	const sheetFormats = detectSheetFormats(sheets);

	if (sheetFormats.length === 0) {
		throw new Error("No valid data sheets found in the file");
	}

	// Use specified sheet or first detected data sheet
	const targetSheet = config?.sheetName
		? sheetFormats.find((s) => s.sheet === config.sheetName) || sheetFormats[0]
		: sheetFormats[0];

	const sheetData = sheets.find((s) => s.name === targetSheet.sheet);
	if (!sheetData) {
		throw new Error(`Sheet not found: ${targetSheet.sheet}`);
	}

	// Use provided mappings or detected mappings
	const mappings = config?.columnMappings || targetSheet.format.columnMapping;

	// Process rows
	const { opportunities: normalizedOpps, errors: parseErrors } = processRows(
		sheetData.data,
		mappings,
		filename
	);

	// Create import record
	const importId = await createImportRecord(filename, sheetData.data.length, {
		columnMappings: mappings,
		sheetName: targetSheet.sheet,
		updateExisting: config?.updateExisting ?? true,
		matchBy: config?.matchBy ?? "sourceIdAndFile",
	});

	// Import to database
	const importResults = {
		total: normalizedOpps.length,
		imported: 0,
		updated: 0,
		skipped: 0,
		failed: 0,
	};

	const allErrors: ImportRecordResult[] = [...parseErrors];

	for (let i = 0; i < normalizedOpps.length; i++) {
		const opp = normalizedOpps[i];

		try {
			// Validate
			const validationErrors = validateOpportunity(opp);
			if (validationErrors.length > 0) {
				allErrors.push({
					rowIndex: i + 1,
					status: "failed",
					error: validationErrors.join("; "),
					data: opp,
				});
				importResults.failed++;
				continue;
			}

			// Check for existing record
			let existingId: string | null = null;

			if (config?.updateExisting !== false) {
				const matchConditions = [];

				if (config?.matchBy === "title" || !opp.sourceId) {
					matchConditions.push(eq(opportunities.title, opp.title));
				} else if (config?.matchBy === "sourceId") {
					matchConditions.push(eq(opportunities.sourceId, opp.sourceId || ""));
				} else {
					// Default: sourceIdAndFile
					if (opp.sourceId) {
						matchConditions.push(
							and(
								eq(opportunities.sourceId, opp.sourceId),
								eq(opportunities.sourceFile, filename)
							)!
						);
					}
				}

				if (matchConditions.length > 0) {
					const [existing] = await db
						.select({ id: opportunities.id })
						.from(opportunities)
						.where(matchConditions[0])
						.limit(1);

					existingId = existing?.id || null;
				}
			}

			// Clean up the normalized data before insert
			const { _rawRow, _parseErrors, ...cleanData } = opp;

			if (existingId) {
				// Update existing
				await updateOpportunity(existingId, cleanData);
				importResults.updated++;
				allErrors.push({
					rowIndex: i + 1,
					status: "updated",
					opportunityId: existingId,
				});
			} else {
				// Create new
				const created = await createOpportunity(cleanData);
				importResults.imported++;
				allErrors.push({
					rowIndex: i + 1,
					status: "created",
					opportunityId: created.id,
				});
			}
		} catch (err) {
			allErrors.push({
				rowIndex: i + 1,
				status: "failed",
				error: String(err),
				data: opp,
			});
			importResults.failed++;
		}
	}

	// Update import record
	await updateImportRecord(importId, {
		importedRecords: importResults.imported,
		updatedRecords: importResults.updated,
		skippedRecords: importResults.skipped,
		failedRecords: importResults.failed,
		status: "completed",
		errors: allErrors.filter((e) => e.status === "failed"),
	});

	return {
		importId,
		results: importResults,
		errors: allErrors,
	};
}

/**
 * Import opportunities from a local file path.
 */
export async function importFromFile(
	filePath: string,
	config?: Partial<ImportConfig>
): Promise<SpreadsheetImportResult> {
	await requireCurrentUserId();

	const allowedPath = resolveConfiguredImportPath(filePath, "OPPORTUNITY_IMPORT_ROOT");
	const { sheets, filename } = await parseDelimitedFile(allowedPath);
	return executeSpreadsheetImport(sheets, filename, config);
}

/**
 * Import opportunities from uploaded file data.
 */
export async function importFromBuffer(
	data: ImportFileData,
	filename: string,
	config?: Partial<ImportConfig>
): Promise<SpreadsheetImportResult> {
	await requireCurrentUserId();
	const buffer = toImportBuffer(data);

	return executeSpreadsheetImport(
		[{ name: "Data", data: parseDelimitedRows(buffer.toString("utf-8"), filename) }],
		filename,
		config
	);
}

function buildImportPreview(
	sheets: { name: string; data: RawSpreadsheetRow[] }[],
	filename: string,
	config?: Partial<ImportConfig>
): {
	filename: string;
	sheets: { name: string; format: DetectedFormat; rowCount: number }[];
	preview: NormalizedOpportunity[];
	totalRows: number;
} {
	const sheetFormats = detectSheetFormats(sheets);

	if (sheetFormats.length === 0) {
		throw new Error("No valid data sheets found in the file");
	}

	// Use specified sheet or first detected data sheet
	const targetSheet = config?.sheetName
		? sheetFormats.find((s) => s.sheet === config.sheetName) || sheetFormats[0]
		: sheetFormats[0];

	const sheetData = sheets.find((s) => s.name === targetSheet.sheet);
	if (!sheetData) {
		throw new Error(`Sheet not found: ${targetSheet.sheet}`);
	}

	const mappings = config?.columnMappings || targetSheet.format.columnMapping;

	// Process only first 10 rows for preview
	const previewData = sheetData.data.slice(0, 10);
	const { opportunities: preview } = processRows(previewData, mappings, filename);

	return {
		filename,
		sheets: sheetFormats.map((sf) => ({ name: sf.sheet, format: sf.format, rowCount: sf.rowCount })),
		preview,
		totalRows: sheetData.data.length,
	};
}

/**
 * Preview an uploaded file without relying on server filesystem paths.
 */
export async function previewImportFromBuffer(
	data: ImportFileData,
	filename: string,
	config?: Partial<ImportConfig>
): Promise<{
	filename: string;
	sheets: { name: string; format: DetectedFormat; rowCount: number }[];
	preview: NormalizedOpportunity[];
	totalRows: number;
}> {
	await requireCurrentUserId();
	const buffer = toImportBuffer(data);
	return buildImportPreview(
		[{ name: "Data", data: parseDelimitedRows(buffer.toString("utf-8"), filename) }],
		filename,
		config
	);
}

/**
 * Preview import without actually importing.
 */
export async function previewImport(
	filePath: string,
	config?: Partial<ImportConfig>
): Promise<{
	filename: string;
	sheets: { name: string; format: DetectedFormat; rowCount: number }[];
	preview: NormalizedOpportunity[];
	totalRows: number;
}> {
	await requireCurrentUserId();

	const allowedPath = resolveConfiguredImportPath(filePath, "OPPORTUNITY_IMPORT_ROOT");
	const { sheets, filename } = await parseDelimitedFile(allowedPath);
	return buildImportPreview(sheets, filename, config);
}

// ============================================================================
// External Discovery Import
// ============================================================================

/**
 * Search SearXNG for opportunity notices and persist discovered results.
 *
 * This is the durable ingestion bridge from live web discovery into the
 * opportunity table. Firecrawl enrichment is opt-in so routine search imports
 * stay cheap, while high-value search runs can scrape top results for cleaner
 * titles and summaries.
 */
export async function discoverAndImportOpportunities(
	input: DiscoveryImportInput = {}
): Promise<{
	importId: string;
	results: ImportResultsSummary;
	errors: ImportRecordResult[];
}> {
	const userId = await requireCurrentUserId();
	return executeOpportunityDiscoveryImport(input, userId);
}

// ============================================================================
// Scraper Integration
// ============================================================================

/**
 * Import opportunities from scraper JSON export.
 *
 * The scraper system exports opportunities as JSONL files.
 * This function imports them into the database.
 */
export async function importFromScraperExport(
	jsonlPath: string
): Promise<{
	importId: string;
	results: {
		total: number;
		imported: number;
		updated: number;
		skipped: number;
		failed: number;
	};
	errors: ImportRecordResult[];
}> {
	await requireCurrentUserId();

	const allowedPath = resolveConfiguredImportPath(jsonlPath, "SCRAPER_EXPORT_ROOT");
	const content = await fs.readFile(allowedPath, "utf-8");
	const lines = content.trim().split("\n").filter(Boolean);

	const records = lines.map((line) => JSON.parse(line));

	const filename = path.basename(allowedPath);

	// Create import record
	const importId = await createImportRecord(filename, records.length, {
		columnMappings: [],
		sheetName: "scraper_export",
		updateExisting: true,
		matchBy: "sourceId",
	});

	const importResults = {
		total: records.length,
		imported: 0,
		updated: 0,
		skipped: 0,
		failed: 0,
	};

	const allErrors: ImportRecordResult[] = [];

	for (let i = 0; i < records.length; i++) {
		const record = records[i];

		try {
			// Check for existing by fingerprint or source/source_id
			let existingId: string | null = null;

			if (record.fingerprint) {
				const [existing] = await db
					.select({ id: opportunities.id })
					.from(opportunities)
					.where(eq(opportunities.fingerprint, record.fingerprint))
					.limit(1);
				existingId = existing?.id || null;
			}

			if (!existingId && record.source && record.source_id) {
				const [existing] = await db
					.select({ id: opportunities.id })
					.from(opportunities)
					.where(
						and(
							eq(opportunities.source, record.source),
							eq(opportunities.sourceId, record.source_id)
						)!
					)
					.limit(1);
				existingId = existing?.id || null;
			}

			// Validate required field
			if (!record.title) {
				throw new Error("Missing required field: title");
			}

			// Map scraper record to opportunity schema
			const oppData = {
				title: record.title as string,
				description: record.description,
				status: record.status || "open",
				deadline: record.deadline,
				publishedDate: record.published_date,
				organization: record.organization,
				country: record.country,
				funder: record.funder,
				category: record.category,
				sector: record.sector,
				opportunityType: record.opportunity_type,
				budgetValue: record.budget_value,
				budgetMin: record.budget_min,
				budgetMax: record.budget_max,
				currency: record.currency || "USD",
				referenceNumber: record.reference_number,
				noticeId: record.notice_id,
				source: record.source,
				sourceId: record.source_id,
				portalUrl: record.portal_url,
				documentUrl: record.document_url,
				fingerprint: record.fingerprint,
				sourceFile: filename,
			};

			if (existingId) {
				await updateOpportunity(existingId, oppData);
				importResults.updated++;
				allErrors.push({
					rowIndex: i + 1,
					status: "updated",
					opportunityId: existingId,
				});
			} else {
				const created = await createOpportunity(oppData as OpportunityInput);
				importResults.imported++;
				allErrors.push({
					rowIndex: i + 1,
					status: "created",
					opportunityId: created.id,
				});
			}
		} catch (err) {
			allErrors.push({
				rowIndex: i + 1,
				status: "failed",
				error: String(err),
				data: record,
			});
			importResults.failed++;
		}
	}

	// Update import record
	await updateImportRecord(importId, {
		importedRecords: importResults.imported,
		updatedRecords: importResults.updated,
		skippedRecords: importResults.skipped,
		failedRecords: importResults.failed,
		status: "completed",
		errors: allErrors.filter((e) => e.status === "failed"),
	});

	return {
		importId,
		results: importResults,
		errors: allErrors,
	};
}

/**
 * Import all scraper exports from the sync directory.
 */
export async function importAllScraperExports(
	syncDir: string = "data/sync_exports"
): Promise<{
	totalFiles: number;
	processedFiles: number;
	totalImported: number;
	totalUpdated: number;
	totalFailed: number;
	fileResults: {
		filename: string;
		status: "success" | "failed";
		imported: number;
		updated: number;
		failed: number;
		error?: string;
	}[];
}> {
	await requireCurrentUserId();

	const allowedSyncDir = resolveConfiguredImportPath(syncDir, "SCRAPER_EXPORT_ROOT");
	let files: string[];
	try {
		files = await fs.readdir(allowedSyncDir);
	} catch {
		// Directory doesn't exist yet
		return {
			totalFiles: 0,
			processedFiles: 0,
			totalImported: 0,
			totalUpdated: 0,
			totalFailed: 0,
			fileResults: [],
		};
	}

	const jsonlFiles = files.filter((f) => f.endsWith(".jsonl") || f.endsWith(".json"));

	const results = {
		totalFiles: jsonlFiles.length,
		processedFiles: 0,
		totalImported: 0,
		totalUpdated: 0,
		totalFailed: 0,
		fileResults: [] as {
			filename: string;
			status: "success" | "failed";
			imported: number;
			updated: number;
			failed: number;
			error?: string;
		}[],
	};

	for (const file of jsonlFiles) {
		const filePath = path.join(allowedSyncDir, file);

		try {
			const { results: importResults } = await importFromScraperExport(filePath);

			results.processedFiles++;
			results.totalImported += importResults.imported;
			results.totalUpdated += importResults.updated;
			results.totalFailed += importResults.failed;

			results.fileResults.push({
				filename: file,
				status: "success",
				imported: importResults.imported,
				updated: importResults.updated,
				failed: importResults.failed,
			});

			// Optionally move processed file to archive
			// await fs.rename(filePath, path.join(syncDir, 'archive', file));
		} catch (err) {
			results.fileResults.push({
				filename: file,
				status: "failed",
				imported: 0,
				updated: 0,
				failed: 0,
				error: String(err),
			});
		}
	}

	return results;
}

// ============================================================================
// Directory Import
// ============================================================================

/**
 * Import all spreadsheets from a directory.
 */
export async function importFromDirectory(
	dirPath: string,
	config?: Partial<ImportConfig>
): Promise<{
	totalFiles: number;
	processedFiles: number;
	totalImported: number;
	totalUpdated: number;
	totalFailed: number;
	fileResults: {
		filename: string;
		status: "success" | "failed";
		imported: number;
		updated: number;
		failed: number;
		error?: string;
	}[];
}> {
	await requireCurrentUserId();

	const allowedDir = resolveConfiguredImportPath(dirPath, "OPPORTUNITY_IMPORT_ROOT");
	const files = await fs.readdir(allowedDir);
	const delimitedFiles = files.filter((f) => f.endsWith(".csv") || f.endsWith(".tsv"));

	const results = {
		totalFiles: delimitedFiles.length,
		processedFiles: 0,
		totalImported: 0,
		totalUpdated: 0,
		totalFailed: 0,
		fileResults: [] as {
			filename: string;
			status: "success" | "failed";
			imported: number;
			updated: number;
			failed: number;
			error?: string;
		}[],
	};

	for (const file of delimitedFiles) {
		const filePath = path.join(allowedDir, file);

		try {
			const { results: importResults } = await importFromFile(filePath, config);

			results.processedFiles++;
			results.totalImported += importResults.imported;
			results.totalUpdated += importResults.updated;
			results.totalFailed += importResults.failed;

			results.fileResults.push({
				filename: file,
				status: "success",
				imported: importResults.imported,
				updated: importResults.updated,
				failed: importResults.failed,
			});
		} catch (err) {
			results.fileResults.push({
				filename: file,
				status: "failed",
				imported: 0,
				updated: 0,
				failed: 0,
				error: String(err),
			});
		}
	}

	return results;
}
