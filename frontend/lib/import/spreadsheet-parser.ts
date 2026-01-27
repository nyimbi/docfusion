/**
 * Spreadsheet Parser - DocFusion
 *
 * Utilities for parsing Excel spreadsheets containing RFP/EOI opportunities.
 * Handles multiple spreadsheet formats with intelligent column detection.
 */

import type {
	ColumnMapping,
	DetectedFormat,
	NormalizedOpportunity,
	OpportunityInput,
	RawSpreadsheetRow,
	ImportRecordResult,
} from "@/lib/types/opportunity";

// ============================================================================
// Format Detection
// ============================================================================

/**
 * Known spreadsheet formats and their column mappings.
 */
const KNOWN_FORMATS: Record<string, { columns: string[]; mappings: ColumnMapping[] }> = {
	software_dev_rfps: {
		columns: [
			"ID",
			"Title",
			"Category",
			"Country/Region",
			"Organization",
			"Deadline",
			"Days Left",
			"Budget/Value",
			"Project Summary",
			"Key Requirements",
			"Submission Method",
			"RFP Document Link",
			"Source Platform",
		],
		mappings: [
			{ field: "sourceId", sourceColumns: ["ID"] },
			{ field: "title", sourceColumns: ["Title"], required: true },
			{ field: "category", sourceColumns: ["Category"] },
			{ field: "countryRegion", sourceColumns: ["Country/Region"] },
			{ field: "organization", sourceColumns: ["Organization"] },
			{ field: "deadline", sourceColumns: ["Deadline"], transform: "date" },
			{ field: "budgetValue", sourceColumns: ["Budget/Value"] },
			{ field: "projectSummary", sourceColumns: ["Project Summary"] },
			{ field: "keyRequirements", sourceColumns: ["Key Requirements"] },
			{ field: "submissionMethod", sourceColumns: ["Submission Method"] },
			{ field: "rfpLink", sourceColumns: ["RFP Document Link"] },
			{ field: "sourcePlatform", sourceColumns: ["Source Platform"] },
		],
	},
	africa_ngo_rfps: {
		columns: [
			"ID",
			"Title",
			"Category",
			"Country/Region",
			"Organization/Funder",
			"Deadline",
			"Days Left",
			"Budget/Value",
			"Project Summary",
			"Key Requirements",
			"Submission Method",
			"RFP/EOI Link",
			"Source Platform",
		],
		mappings: [
			{ field: "sourceId", sourceColumns: ["ID"] },
			{ field: "title", sourceColumns: ["Title"], required: true },
			{ field: "category", sourceColumns: ["Category"] },
			{ field: "countryRegion", sourceColumns: ["Country/Region"] },
			{ field: "organization", sourceColumns: ["Organization/Funder"] },
			{ field: "funder", sourceColumns: ["Organization/Funder"] },
			{ field: "deadline", sourceColumns: ["Deadline"], transform: "date" },
			{ field: "budgetValue", sourceColumns: ["Budget/Value"] },
			{ field: "projectSummary", sourceColumns: ["Project Summary"] },
			{ field: "keyRequirements", sourceColumns: ["Key Requirements"] },
			{ field: "submissionMethod", sourceColumns: ["Submission Method"] },
			{ field: "rfpLink", sourceColumns: ["RFP/EOI Link"] },
			{ field: "sourcePlatform", sourceColumns: ["Source Platform"] },
		],
	},
	africa_software_rfps: {
		columns: [
			"ID",
			"Project Title",
			"Software Category",
			"Country/Region",
			"Organization/Client",
			"Deadline",
			"Days Left",
			"Est. Budget",
			"Project Scope & Deliverables",
			"Technical Stack/Requirements",
			"Submission Requirements",
			"RFP/EOI Link",
			"Source",
		],
		mappings: [
			{ field: "sourceId", sourceColumns: ["ID"] },
			{ field: "title", sourceColumns: ["Project Title"], required: true },
			{ field: "category", sourceColumns: ["Software Category"] },
			{ field: "countryRegion", sourceColumns: ["Country/Region"] },
			{ field: "organization", sourceColumns: ["Organization/Client"] },
			{ field: "deadline", sourceColumns: ["Deadline"], transform: "date" },
			{ field: "budgetValue", sourceColumns: ["Est. Budget"] },
			{ field: "projectScope", sourceColumns: ["Project Scope & Deliverables"] },
			{ field: "technicalRequirements", sourceColumns: ["Technical Stack/Requirements"] },
			{ field: "submissionRequirements", sourceColumns: ["Submission Requirements"] },
			{ field: "rfpLink", sourceColumns: ["RFP/EOI Link"] },
			{ field: "sourcePlatform", sourceColumns: ["Source"] },
		],
	},
	africa_commercial_rfps: {
		columns: [
			"ID",
			"Title",
			"Sector",
			"IT Category",
			"Country",
			"Organization",
			"Deadline",
			"Days Left",
			"Est. Value",
			"Project Description",
			"Technical Requirements",
			"Submission Method",
			"Tender/RFP Link",
			"Source",
		],
		mappings: [
			{ field: "sourceId", sourceColumns: ["ID"] },
			{ field: "title", sourceColumns: ["Title"], required: true },
			{ field: "sector", sourceColumns: ["Sector"] },
			{ field: "itCategory", sourceColumns: ["IT Category"] },
			{ field: "category", sourceColumns: ["IT Category"] },
			{ field: "countryRegion", sourceColumns: ["Country"] },
			{ field: "organization", sourceColumns: ["Organization"] },
			{ field: "deadline", sourceColumns: ["Deadline"], transform: "date" },
			{ field: "budgetValue", sourceColumns: ["Est. Value"] },
			{ field: "projectSummary", sourceColumns: ["Project Description"] },
			{ field: "technicalRequirements", sourceColumns: ["Technical Requirements"] },
			{ field: "submissionMethod", sourceColumns: ["Submission Method"] },
			{ field: "rfpLink", sourceColumns: ["Tender/RFP Link"] },
			{ field: "sourcePlatform", sourceColumns: ["Source"] },
		],
	},
};

/**
 * Detect spreadsheet format based on column headers.
 */
export function detectFormat(columns: string[], sheetName: string): DetectedFormat {
	let bestMatch: { type: DetectedFormat["type"]; confidence: number; mappings: ColumnMapping[] } = {
		type: "unknown",
		confidence: 0,
		mappings: [],
	};

	const normalizedColumns = columns.map((c) => c?.toLowerCase().trim());

	for (const [formatType, formatDef] of Object.entries(KNOWN_FORMATS)) {
		const expectedColumns = formatDef.columns.map((c) => c.toLowerCase().trim());
		let matchCount = 0;

		for (const expected of expectedColumns) {
			if (normalizedColumns.some((col) => col === expected || col?.includes(expected) || expected.includes(col || ""))) {
				matchCount++;
			}
		}

		const confidence = matchCount / expectedColumns.length;

		if (confidence > bestMatch.confidence) {
			bestMatch = {
				type: formatType as DetectedFormat["type"],
				confidence,
				mappings: formatDef.mappings,
			};
		}
	}

	// If no good match, create generic mappings
	if (bestMatch.confidence < 0.5) {
		bestMatch = {
			type: "unknown",
			confidence: 0,
			mappings: createGenericMappings(columns),
		};
	}

	return {
		...bestMatch,
		sheetName,
		columnMapping: bestMatch.mappings,
	};
}

/**
 * Create generic column mappings based on column name patterns.
 */
function createGenericMappings(columns: string[]): ColumnMapping[] {
	const mappings: ColumnMapping[] = [];

	for (const col of columns) {
		const lowerCol = col?.toLowerCase() || "";

		// ID fields
		if (lowerCol === "id" || lowerCol.includes("source_id") || lowerCol.includes("ref")) {
			mappings.push({ field: "sourceId", sourceColumns: [col] });
		}
		// Title fields
		else if (lowerCol.includes("title") || lowerCol.includes("name") || lowerCol.includes("project")) {
			if (!mappings.some((m) => m.field === "title")) {
				mappings.push({ field: "title", sourceColumns: [col], required: true });
			}
		}
		// Category fields
		else if (lowerCol.includes("category") || lowerCol.includes("type") || lowerCol.includes("sector")) {
			if (!mappings.some((m) => m.field === "category")) {
				mappings.push({ field: "category", sourceColumns: [col] });
			}
		}
		// Country/Region fields
		else if (lowerCol.includes("country") || lowerCol.includes("region") || lowerCol.includes("location")) {
			mappings.push({ field: "countryRegion", sourceColumns: [col] });
		}
		// Organization fields
		else if (
			lowerCol.includes("organization") ||
			lowerCol.includes("client") ||
			lowerCol.includes("company") ||
			lowerCol.includes("funder")
		) {
			if (!mappings.some((m) => m.field === "organization")) {
				mappings.push({ field: "organization", sourceColumns: [col] });
			}
		}
		// Deadline fields
		else if (lowerCol.includes("deadline") || lowerCol.includes("due") || lowerCol.includes("closing")) {
			mappings.push({ field: "deadline", sourceColumns: [col], transform: "date" });
		}
		// Budget fields
		else if (lowerCol.includes("budget") || lowerCol.includes("value") || lowerCol.includes("amount")) {
			mappings.push({ field: "budgetValue", sourceColumns: [col] });
		}
		// Summary/Description fields
		else if (
			lowerCol.includes("summary") ||
			lowerCol.includes("description") ||
			lowerCol.includes("scope") ||
			lowerCol.includes("overview")
		) {
			if (!mappings.some((m) => m.field === "projectSummary")) {
				mappings.push({ field: "projectSummary", sourceColumns: [col] });
			}
		}
		// Requirements fields
		else if (lowerCol.includes("requirement") || lowerCol.includes("qualification")) {
			if (lowerCol.includes("technical")) {
				mappings.push({ field: "technicalRequirements", sourceColumns: [col] });
			} else {
				mappings.push({ field: "keyRequirements", sourceColumns: [col] });
			}
		}
		// Link fields
		else if (lowerCol.includes("link") || lowerCol.includes("url") || lowerCol.includes("website")) {
			mappings.push({ field: "rfpLink", sourceColumns: [col] });
		}
		// Source fields
		else if (lowerCol.includes("source") || lowerCol.includes("platform") || lowerCol.includes("portal")) {
			mappings.push({ field: "sourcePlatform", sourceColumns: [col] });
		}
		// Submission fields
		else if (lowerCol.includes("submission")) {
			if (lowerCol.includes("method")) {
				mappings.push({ field: "submissionMethod", sourceColumns: [col] });
			} else {
				mappings.push({ field: "submissionRequirements", sourceColumns: [col] });
			}
		}
	}

	return mappings;
}

// ============================================================================
// Value Transformation
// ============================================================================

/**
 * Parse a date value from various formats.
 */
export function parseDate(value: unknown): Date | null {
	if (!value) return null;

	if (value instanceof Date) {
		return isNaN(value.getTime()) ? null : value;
	}

	if (typeof value === "number") {
		// Excel serial date number
		const excelEpoch = new Date(1899, 11, 30);
		const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
		return isNaN(date.getTime()) ? null : date;
	}

	if (typeof value === "string") {
		const str = value.trim();
		if (!str || str.toLowerCase() === "expired" || str.toLowerCase() === "n/a") {
			return null;
		}

		// Try various date formats
		const formats = [
			/^(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
			/^(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY or DD/MM/YYYY
			/^(\d{2})-(\d{2})-(\d{4})/, // MM-DD-YYYY or DD-MM-YYYY
		];

		for (const format of formats) {
			const match = str.match(format);
			if (match) {
				const parsed = new Date(str);
				if (!isNaN(parsed.getTime())) {
					return parsed;
				}
			}
		}

		// Fallback to Date.parse
		const parsed = new Date(str);
		return isNaN(parsed.getTime()) ? null : parsed;
	}

	return null;
}

/**
 * Parse currency value and extract numeric amount.
 */
export function parseCurrency(value: unknown): { value: string; numeric: number | null; currency: string | null } {
	if (!value) return { value: "", numeric: null, currency: null };

	const str = String(value).trim();

	// Common currency patterns
	const currencyPatterns: [RegExp, string][] = [
		[/^\$\s*([\d,]+(?:\.\d+)?)/i, "USD"],
		[/^USD\s*([\d,]+(?:\.\d+)?)/i, "USD"],
		[/^€\s*([\d,]+(?:\.\d+)?)/i, "EUR"],
		[/^EUR\s*([\d,]+(?:\.\d+)?)/i, "EUR"],
		[/^£\s*([\d,]+(?:\.\d+)?)/i, "GBP"],
		[/^GBP\s*([\d,]+(?:\.\d+)?)/i, "GBP"],
		[/^R\s*([\d,]+(?:\.\d+)?)/i, "ZAR"],
		[/^ZAR\s*([\d,]+(?:\.\d+)?)/i, "ZAR"],
		[/^₹\s*([\d,]+(?:\.\d+)?)/i, "INR"],
		[/^INR\s*([\d,]+(?:\.\d+)?)/i, "INR"],
		[/^KES\s*([\d,]+(?:\.\d+)?)/i, "KES"],
		[/^NGN\s*([\d,]+(?:\.\d+)?)/i, "NGN"],
		[/^([\d,]+(?:\.\d+)?)\s*(?:million|M)/i, "MULT_MILLION"],
		[/^([\d,]+(?:\.\d+)?)\s*(?:billion|B)/i, "MULT_BILLION"],
	];

	for (const [pattern, currency] of currencyPatterns) {
		const match = str.match(pattern);
		if (match) {
			let numericValue = parseFloat(match[1].replace(/,/g, ""));

			if (currency === "MULT_MILLION") {
				numericValue *= 1_000_000;
				return { value: str, numeric: numericValue, currency: null };
			}
			if (currency === "MULT_BILLION") {
				numericValue *= 1_000_000_000;
				return { value: str, numeric: numericValue, currency: null };
			}

			return { value: str, numeric: isNaN(numericValue) ? null : numericValue, currency };
		}
	}

	// Try to extract any number
	const numMatch = str.match(/([\d,]+(?:\.\d+)?)/);
	if (numMatch) {
		const numericValue = parseFloat(numMatch[1].replace(/,/g, ""));
		return { value: str, numeric: isNaN(numericValue) ? null : numericValue, currency: null };
	}

	return { value: str, numeric: null, currency: null };
}

/**
 * Get value from row using column mappings.
 */
function getValueFromRow(row: RawSpreadsheetRow, mapping: ColumnMapping): unknown {
	for (const col of mapping.sourceColumns) {
		const value = row[col];
		if (value !== undefined && value !== null && value !== "") {
			return value;
		}
	}
	return null;
}

// ============================================================================
// Row Normalization
// ============================================================================

/**
 * Normalize a raw spreadsheet row to opportunity format.
 */
export function normalizeRow(
	row: RawSpreadsheetRow,
	mappings: ColumnMapping[],
	sourceFile: string
): NormalizedOpportunity {
	const errors: string[] = [];
	const normalized: OpportunityInput = {
		title: "", // Will be set below
		sourceFile,
	};

	for (const mapping of mappings) {
		const rawValue = getValueFromRow(row, mapping);

		if (mapping.required && !rawValue) {
			errors.push(`Missing required field: ${mapping.field}`);
			continue;
		}

		if (!rawValue) continue;

		try {
			switch (mapping.transform) {
				case "date": {
					const date = parseDate(rawValue);
					if (mapping.field === "deadline") {
						normalized.deadline = date || undefined;
					}
					break;
				}
				case "currency": {
					const { value, numeric, currency } = parseCurrency(rawValue);
					if (mapping.field === "budgetValue") {
						normalized.budgetValue = value;
						normalized.budgetNumeric = numeric || undefined;
						normalized.budgetCurrency = currency || undefined;
					}
					break;
				}
				case "number": {
					const num = parseFloat(String(rawValue).replace(/,/g, ""));
					(normalized as unknown as Record<string, unknown>)[mapping.field] = isNaN(num) ? null : num;
					break;
				}
				case "trim":
					(normalized as unknown as Record<string, unknown>)[mapping.field] = String(rawValue).trim();
					break;
				case "lowercase":
					(normalized as unknown as Record<string, unknown>)[mapping.field] = String(rawValue).toLowerCase().trim();
					break;
				default: {
					// String field
					const strValue = String(rawValue).trim();
					(normalized as unknown as Record<string, unknown>)[mapping.field] = strValue || null;
				}
			}
		} catch (err) {
			errors.push(`Error processing ${mapping.field}: ${err}`);
		}
	}

	// Handle budget if not explicitly mapped with transform
	if (!normalized.budgetNumeric && normalized.budgetValue) {
		const { numeric, currency } = parseCurrency(normalized.budgetValue);
		normalized.budgetNumeric = numeric || undefined;
		normalized.budgetCurrency = normalized.budgetCurrency || currency || undefined;
	}

	return {
		...normalized,
		_rawRow: row,
		_parseErrors: errors.length > 0 ? errors : undefined,
	};
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Process an array of raw rows into normalized opportunities.
 */
export function processRows(
	rows: RawSpreadsheetRow[],
	mappings: ColumnMapping[],
	sourceFile: string
): { opportunities: NormalizedOpportunity[]; errors: ImportRecordResult[] } {
	const opportunities: NormalizedOpportunity[] = [];
	const errors: ImportRecordResult[] = [];

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];

		// Skip empty rows
		if (!row || Object.values(row).every((v) => !v)) {
			continue;
		}

		try {
			const normalized = normalizeRow(row, mappings, sourceFile);

			// Skip rows without title
			if (!normalized.title) {
				errors.push({
					rowIndex: i + 1,
					status: "skipped",
					error: "Missing title",
					data: normalized,
				});
				continue;
			}

			// Check for parse errors
			if (normalized._parseErrors?.length) {
				errors.push({
					rowIndex: i + 1,
					status: "failed",
					error: normalized._parseErrors.join("; "),
					data: normalized,
				});
				continue;
			}

			opportunities.push(normalized);
		} catch (err) {
			errors.push({
				rowIndex: i + 1,
				status: "failed",
				error: String(err),
			});
		}
	}

	return { opportunities, errors };
}

/**
 * Validate opportunity data before import.
 */
export function validateOpportunity(opp: NormalizedOpportunity): string[] {
	const errors: string[] = [];

	if (!opp.title || opp.title.trim().length === 0) {
		errors.push("Title is required");
	}

	if (opp.title && opp.title.length > 1000) {
		errors.push("Title exceeds maximum length of 1000 characters");
	}

	if (opp.deadline && !(opp.deadline instanceof Date)) {
		errors.push("Invalid deadline date format");
	}

	if (opp.rfpLink && opp.rfpLink.length > 0) {
		try {
			new URL(opp.rfpLink);
		} catch {
			// Not a fatal error, just a warning - link might be partial
		}
	}

	return errors;
}
