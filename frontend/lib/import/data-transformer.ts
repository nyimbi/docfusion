/**
 * Data Transformer for DocFusion
 *
 * Applies column mappings and transformations to source data.
 * Handles:
 * - Column concatenation (multiple source → one target)
 * - Value transforms (date, number, email, phone, etc.)
 * - Default values for empty fields
 * - Validation with detailed error reporting
 */

import type {
	ColumnMapping,
	ColumnTransform,
	PreviewRow,
	ValidationIssue,
	ValidationResult,
	ImportTargetTable,
} from "@/lib/types/import";
import { getTableSchema, validateColumnValue, getColumnSchema } from "./table-schemas";

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Apply a transform to a string value.
 */
function applyTransform(value: string, transform: ColumnTransform): string {
	if (!value) return value;

	switch (transform) {
		case "uppercase":
			return value.toUpperCase();

		case "lowercase":
			return value.toLowerCase();

		case "trim":
			return value.trim();

		case "capitalize":
			return value
				.toLowerCase()
				.split(" ")
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" ");

		case "date": {
			const date = parseDate(value);
			return date ? date.toISOString().split("T")[0] : value;
		}

		case "datetime": {
			const date = parseDate(value);
			return date ? date.toISOString() : value;
		}

		case "number": {
			const num = parseNumber(value);
			return num !== null ? String(num) : value;
		}

		case "integer": {
			const num = parseNumber(value);
			return num !== null ? String(Math.round(num)) : value;
		}

		case "currency": {
			const { value: formatted } = parseCurrency(value);
			return formatted;
		}

		case "email":
			return value.toLowerCase().trim();

		case "phone":
			return normalizePhone(value);

		case "url":
			return normalizeUrl(value);

		case "boolean": {
			const lower = value.toLowerCase().trim();
			if (["true", "yes", "1", "y"].includes(lower)) return "true";
			if (["false", "no", "0", "n"].includes(lower)) return "false";
			return value;
		}

		case "none":
		default:
			return value;
	}
}

/**
 * Parse a date from various formats.
 */
function parseDate(value: string): Date | null {
	if (!value) return null;

	// Try native Date parsing first
	const parsed = new Date(value);
	if (!isNaN(parsed.getTime())) return parsed;

	// Try common date patterns
	const patterns = [
		// DD/MM/YYYY or DD-MM-YYYY
		/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
		// MM/DD/YYYY or MM-DD-YYYY
		/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
		// YYYY/MM/DD or YYYY-MM-DD
		/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
	];

	for (const pattern of patterns) {
		const match = value.match(pattern);
		if (match) {
			const [, a, b, c] = match;
			// Try different interpretations
			const candidates = [
				new Date(Number(c), Number(b) - 1, Number(a)), // DD/MM/YYYY
				new Date(Number(c), Number(a) - 1, Number(b)), // MM/DD/YYYY
				new Date(Number(a), Number(b) - 1, Number(c)), // YYYY/MM/DD
			];
			const valid = candidates.find((d) => !isNaN(d.getTime()));
			if (valid) return valid;
		}
	}

	// Try Excel serial date (days since 1899-12-30)
	const num = Number(value);
	if (!isNaN(num) && num > 0 && num < 100000) {
		const excelEpoch = new Date(1899, 11, 30);
		return new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
	}

	return null;
}

/**
 * Parse a number from a string.
 */
function parseNumber(value: string): number | null {
	if (!value) return null;

	// Remove currency symbols and thousand separators
	const cleaned = value
		.replace(/[$€£¥₹,]/g, "")
		.replace(/\s/g, "")
		.trim();

	// Handle multipliers
	const multipliers: [RegExp, number][] = [
		[/M$/i, 1_000_000],
		[/K$/i, 1_000],
		[/B$/i, 1_000_000_000],
	];

	for (const [pattern, multiplier] of multipliers) {
		if (pattern.test(cleaned)) {
			const num = parseFloat(cleaned.replace(pattern, ""));
			return isNaN(num) ? null : num * multiplier;
		}
	}

	const num = parseFloat(cleaned);
	return isNaN(num) ? null : num;
}

/**
 * Parse currency value.
 */
function parseCurrency(value: string): { value: string; numeric: number | null; currency: string | null } {
	if (!value) return { value: "", numeric: null, currency: null };

	const currencySymbols: Record<string, string> = {
		$: "USD",
		"€": "EUR",
		"£": "GBP",
		"¥": "JPY",
		"₹": "INR",
	};

	let currency: string | null = null;
	let cleaned = value;

	// Extract currency from symbol
	for (const [symbol, code] of Object.entries(currencySymbols)) {
		if (value.includes(symbol)) {
			currency = code;
			cleaned = value.replace(symbol, "");
			break;
		}
	}

	// Extract currency from code
	const codeMatch = value.match(/\b(USD|EUR|GBP|JPY|INR|KES|NGN|ZAR)\b/i);
	if (codeMatch) {
		currency = codeMatch[1].toUpperCase();
		cleaned = value.replace(codeMatch[0], "");
	}

	const numeric = parseNumber(cleaned);

	return { value: value.trim(), numeric, currency };
}

/**
 * Normalize a phone number.
 */
function normalizePhone(value: string): string {
	if (!value) return value;

	// Keep only digits, +, and common separators
	const cleaned = value.replace(/[^\d+\-\s()]/g, "").trim();

	// Remove excessive whitespace
	return cleaned.replace(/\s+/g, " ");
}

/**
 * Normalize a URL.
 */
function normalizeUrl(value: string): string {
	if (!value) return value;

	const trimmed = value.trim();

	// Add https:// if no protocol
	if (!/^https?:\/\//i.test(trimmed)) {
		return `https://${trimmed}`;
	}

	return trimmed;
}

// ============================================================================
// Row Transformation
// ============================================================================

/**
 * Extract value from a source row using column mapping.
 * Handles concatenation of multiple source columns.
 */
function extractValue(
	row: Record<string, unknown>,
	mapping: ColumnMapping
): string {
	const values: string[] = [];

	for (const sourceCol of mapping.sourceColumns) {
		const value = row[sourceCol];
		if (value !== null && value !== undefined && value !== "") {
			values.push(String(value).trim());
		}
	}

	// If no values and we have a default, use it
	if (values.length === 0 && mapping.defaultValue) {
		return mapping.defaultValue;
	}

	// Join values with separator
	return values.join(mapping.separator || ", ");
}

/**
 * Transform a single row using the provided mappings.
 * Unmapped source columns are automatically collected and appended to the notes field.
 */
export function transformRow(
	sourceRow: Record<string, unknown>,
	mappings: ColumnMapping[],
	rowIndex: number,
	targetTable: ImportTargetTable
): PreviewRow {
	const targetValues: Record<string, unknown> = {};
	const issues: ValidationIssue[] = [];

	// Track which source columns have been mapped
	const mappedSourceColumns = new Set<string>();

	for (const mapping of mappings) {
		// Track all source columns used in this mapping
		for (const sourceCol of mapping.sourceColumns) {
			mappedSourceColumns.add(sourceCol);
		}

		// Extract and concatenate source values
		const rawValue = extractValue(sourceRow, mapping);

		// Apply transform
		const transformedValue = applyTransform(rawValue, mapping.transform);

		// Store the transformed value
		targetValues[mapping.targetColumn] = transformedValue || null;

		// Validate against schema
		const columnSchema = getColumnSchema(targetTable, mapping.targetColumn);
		if (columnSchema) {
			const validation = validateColumnValue(transformedValue, columnSchema);
			if (!validation.valid && validation.error) {
				issues.push({
					row: rowIndex + 1,
					column: mapping.targetColumn,
					value: rawValue,
					message: validation.error,
					severity: mapping.required ? "error" : "warning",
				});
			}
		}
	}

	// Collect unmapped columns and append to notes
	const unmappedData: string[] = [];
	for (const [key, value] of Object.entries(sourceRow)) {
		if (!mappedSourceColumns.has(key) && value !== null && value !== undefined && value !== "") {
			const strValue = String(value).trim();
			if (strValue) {
				unmappedData.push(`${key}: ${strValue}`);
			}
		}
	}

	// Append unmapped data to notes field
	if (unmappedData.length > 0) {
		const existingNotes = targetValues["notes"] ? String(targetValues["notes"]).trim() : "";
		const unmappedSection = `--- Unmapped Fields ---\n${unmappedData.join("\n")}`;
		targetValues["notes"] = existingNotes
			? `${existingNotes}\n\n${unmappedSection}`
			: unmappedSection;
	}

	// Check for required columns that aren't mapped
	const schema = getTableSchema(targetTable);
	for (const col of schema.columns) {
		if (col.required && !(col.name in targetValues)) {
			issues.push({
				row: rowIndex + 1,
				column: col.name,
				message: `Required field "${col.label}" is not mapped`,
				severity: "error",
			});
		}
	}

	return {
		sourceRow: rowIndex + 1,
		sourceValues: sourceRow,
		targetValues,
		issues,
		hasError: issues.some((i) => i.severity === "error"),
		hasWarning: issues.some((i) => i.severity === "warning"),
	};
}

// ============================================================================
// Batch Transformation
// ============================================================================

/**
 * Transform multiple rows and generate preview data.
 */
export function transformRows(
	sourceRows: Record<string, unknown>[],
	mappings: ColumnMapping[],
	targetTable: ImportTargetTable,
	limit?: number
): PreviewRow[] {
	const rowsToProcess = limit ? sourceRows.slice(0, limit) : sourceRows;

	return rowsToProcess.map((row, index) =>
		transformRow(row, mappings, index, targetTable)
	);
}

/**
 * Generate validation result from preview rows.
 */
export function generateValidationResult(previewRows: PreviewRow[]): ValidationResult {
	const allIssues: ValidationIssue[] = previewRows.flatMap((row) => row.issues);

	const errorCount = allIssues.filter((i) => i.severity === "error").length;
	const warningCount = allIssues.filter((i) => i.severity === "warning").length;

	// Group by column
	const columnSummary: Record<string, { errorCount: number; warningCount: number }> = {};
	for (const issue of allIssues) {
		if (issue.column) {
			if (!columnSummary[issue.column]) {
				columnSummary[issue.column] = { errorCount: 0, warningCount: 0 };
			}
			if (issue.severity === "error") {
				columnSummary[issue.column].errorCount++;
			} else if (issue.severity === "warning") {
				columnSummary[issue.column].warningCount++;
			}
		}
	}

	return {
		isValid: errorCount === 0,
		errorCount,
		warningCount,
		issues: allIssues,
		columnSummary,
	};
}

// ============================================================================
// Data Preparation for Insert
// ============================================================================

/**
 * Convert date/datetime string values to actual Date objects for Drizzle ORM.
 * Drizzle expects Date objects for timestamp columns, not ISO strings.
 */
export function convertDatesToObjects(
	record: Record<string, unknown>,
	targetTable: ImportTargetTable
): Record<string, unknown> {
	const schema = getTableSchema(targetTable);
	const result = { ...record };

	for (const column of schema.columns) {
		if ((column.type === "date" || column.type === "datetime") && result[column.name]) {
			const value = result[column.name];
			if (typeof value === "string") {
				const date = parseDate(value);
				if (date) {
					result[column.name] = date;
				} else {
					// If we can't parse it, set to null to avoid Drizzle errors
					result[column.name] = null;
				}
			} else if (typeof value === "number") {
				// Excel serial date number
				const excelEpoch = new Date(1899, 11, 30);
				result[column.name] = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
			}
			// If it's already a Date object, leave it as-is
		}
	}

	return result;
}

/**
 * Prepare transformed rows for database insertion.
 * Returns clean objects ready for Drizzle insert.
 * Converts date strings to Date objects automatically.
 */
export function prepareForInsert(
	previewRows: PreviewRow[],
	targetTable: ImportTargetTable,
	additionalFields?: Record<string, unknown>
): Record<string, unknown>[] {
	return previewRows
		.filter((row) => !row.hasError)
		.map((row) => {
			const baseRecord = {
				...row.targetValues,
				...additionalFields,
			};
			// Convert date strings to Date objects for Drizzle
			return convertDatesToObjects(baseRecord, targetTable);
		});
}

/**
 * Find duplicate rows based on unique key fields.
 */
export function findDuplicates(
	rows: Record<string, unknown>[],
	existingValues: Set<string>,
	uniqueKeyFields: string[]
): number[] {
	const duplicateIndices: number[] = [];

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const key = uniqueKeyFields
			.map((field) => String(row[field] || "").toLowerCase())
			.join("|");

		if (existingValues.has(key)) {
			duplicateIndices.push(i);
		}
	}

	return duplicateIndices;
}

/**
 * Create a unique key from a row.
 */
export function createUniqueKey(
	row: Record<string, unknown>,
	uniqueKeyFields: string[]
): string {
	return uniqueKeyFields
		.map((field) => String(row[field] || "").toLowerCase().trim())
		.join("|");
}

// ============================================================================
// Transform Description Generation
// ============================================================================

/**
 * Get human-readable description of a transform.
 */
export function getTransformDescription(transform: ColumnTransform): string {
	const descriptions: Record<ColumnTransform, string> = {
		none: "No transformation",
		uppercase: "Convert to UPPERCASE",
		lowercase: "Convert to lowercase",
		trim: "Remove leading/trailing whitespace",
		capitalize: "Capitalize Each Word",
		date: "Parse as date (YYYY-MM-DD)",
		datetime: "Parse as date and time",
		number: "Parse as number",
		integer: "Parse as whole number",
		currency: "Parse as currency value",
		email: "Normalize email address",
		phone: "Normalize phone number",
		url: "Normalize URL (add https://)",
		boolean: "Parse as true/false",
	};

	return descriptions[transform] || transform;
}

/**
 * Get available transforms for a column type.
 */
export function getAvailableTransforms(targetType: string): ColumnTransform[] {
	const baseTransforms: ColumnTransform[] = ["none", "trim", "uppercase", "lowercase", "capitalize"];

	const typeSpecific: Record<string, ColumnTransform[]> = {
		string: baseTransforms,
		text: baseTransforms,
		email: [...baseTransforms, "email"],
		phone: [...baseTransforms, "phone"],
		url: [...baseTransforms, "url"],
		date: [...baseTransforms, "date"],
		datetime: [...baseTransforms, "datetime"],
		number: ["none", "number"],
		integer: ["none", "integer"],
		currency: ["none", "currency", "number"],
		boolean: ["none", "boolean"],
	};

	return typeSpecific[targetType] || baseTransforms;
}
