/**
 * Opportunity Import Server Actions - DocFusion
 *
 * Server-side actions for importing opportunities from Excel spreadsheets.
 * Handles file parsing, format detection, and database insertion.
 */

"use server";

import { db } from "@/lib/db";
import { opportunities, opportunityImports } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs/promises";
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
	RawSpreadsheetRow,
	DetectedFormat,
} from "@/lib/types/opportunity";
import {
	createImportRecord,
	updateImportRecord,
	createOpportunity,
	updateOpportunity,
} from "./opportunities";

// ============================================================================
// File Processing
// ============================================================================

/**
 * Read and parse an Excel file.
 */
async function parseExcelFile(filePath: string): Promise<{
	sheets: { name: string; data: RawSpreadsheetRow[] }[];
	filename: string;
}> {
	const buffer = await fs.readFile(filePath);
	const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

	const sheets = workbook.SheetNames.map((name) => {
		const sheet = workbook.Sheets[name];
		const data = XLSX.utils.sheet_to_json<RawSpreadsheetRow>(sheet, {
			defval: null,
			raw: false,
			dateNF: "yyyy-mm-dd",
		});
		return { name, data };
	});

	return {
		sheets,
		filename: path.basename(filePath),
	};
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

/**
 * Import opportunities from a local file path.
 */
export async function importFromFile(
	filePath: string,
	config?: Partial<ImportConfig>
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
	// Parse the file
	const { sheets, filename } = await parseExcelFile(filePath);

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
 * Import opportunities from uploaded file data.
 */
export async function importFromBuffer(
	buffer: Buffer,
	filename: string,
	config?: Partial<ImportConfig>
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
	// Parse the buffer
	const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

	const sheets = workbook.SheetNames.map((name) => {
		const sheet = workbook.Sheets[name];
		const data = XLSX.utils.sheet_to_json<RawSpreadsheetRow>(sheet, {
			defval: null,
			raw: false,
			dateNF: "yyyy-mm-dd",
		});
		return { name, data };
	});

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
	const { sheets, filename } = await parseExcelFile(filePath);
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
	const files = await fs.readdir(dirPath);
	const excelFiles = files.filter(
		(f) => f.endsWith(".xlsx") || f.endsWith(".xls") || f.endsWith(".csv")
	);

	const results = {
		totalFiles: excelFiles.length,
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

	for (const file of excelFiles) {
		const filePath = path.join(dirPath, file);

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
