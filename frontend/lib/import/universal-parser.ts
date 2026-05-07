/**
 * Universal File Parser for DocFusion
 *
 * Delimited file parsing supporting CSV files with various delimiters and TSV files.
 *
 * Features:
 * - Automatic format detection
 * - Column type inference
 * - Sample row extraction for preview
 */

import Papa from "papaparse";
import type {
	ParsedFileData,
	DetectedColumnType,
	ColumnDataType,
} from "@/lib/types/import";

// ============================================================================
// Constants
// ============================================================================

/** Maximum sample rows to return for preview */
const MAX_SAMPLE_ROWS = 100;

/** Minimum rows to analyze for type inference */
const MIN_ROWS_FOR_INFERENCE = 10;

/** Regex patterns for type detection */
const TYPE_PATTERNS = {
	email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
	phone: /^[\d\s\-+()]{7,20}$/,
	url: /^(https?:\/\/)?[\w\-]+(\.[\w\-]+)+[/#?]?.*$/,
	date: /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},?\s+\d{4})$/,
	datetime: /^\d{4}[-/]\d{1,2}[-/]\d{1,2}[\sT]\d{1,2}:\d{2}(:\d{2})?/,
	integer: /^-?\d+$/,
	number: /^-?[\d,]+\.?\d*$/,
	currency: /^[$€£¥₹]?\s*[\d,]+\.?\d*\s*(USD|EUR|GBP|KES|NGN|ZAR)?$/i,
	boolean: /^(true|false|yes|no|1|0|y|n)$/i,
};

// ============================================================================
// File Type Detection
// ============================================================================

/**
 * Detect file type from filename and content.
 */
export function detectFileType(filename: string): "csv" | "tsv" {
	const ext = filename.toLowerCase().split(".").pop();

	// Check extension first
	if (ext === "tsv") return "tsv";
	if (ext === "csv") return "csv";

	// Default to CSV
	return "csv";
}

/**
 * Detect delimiter for CSV files by analyzing first few lines.
 */
function detectDelimiter(content: string): string {
	const lines = content.split("\n").slice(0, 5);
	const delimiters = [",", "\t", ";", "|"];
	const counts: Record<string, number[]> = {};

	for (const delim of delimiters) {
		counts[delim] = lines.map((line) => {
			// Count occurrences outside of quoted strings
			let count = 0;
			let inQuotes = false;
			for (const char of line) {
				if (char === '"') inQuotes = !inQuotes;
				else if (char === delim && !inQuotes) count++;
			}
			return count;
		});
	}

	// Find delimiter with most consistent count across lines
	let bestDelim = ",";
	let bestConsistency = -1;

	for (const [delim, lineCounts] of Object.entries(counts)) {
		if (lineCounts.every((c) => c === 0)) continue;

		const avg = lineCounts.reduce((a, b) => a + b, 0) / lineCounts.length;
		const variance = lineCounts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / lineCounts.length;
		const consistency = avg / (variance + 1);

		if (consistency > bestConsistency) {
			bestConsistency = consistency;
			bestDelim = delim;
		}
	}

	return bestDelim;
}

// ============================================================================
// Type Inference
// ============================================================================

/**
 * Infer column data type from sample values.
 */
function inferColumnType(values: unknown[]): ColumnDataType {
	const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== "");
	if (nonEmpty.length === 0) return "string";

	const stringValues = nonEmpty.map((v) => String(v).trim());

	// Check patterns in priority order
	const patternMatches: Record<string, number> = {
		email: 0,
		url: 0,
		phone: 0,
		datetime: 0,
		date: 0,
		currency: 0,
		integer: 0,
		number: 0,
		boolean: 0,
	};

	for (const val of stringValues) {
		for (const [type, pattern] of Object.entries(TYPE_PATTERNS)) {
			if (pattern.test(val)) {
				patternMatches[type]++;
			}
		}
	}

	const threshold = stringValues.length * 0.7; // 70% match required

	// Check in priority order (most specific first)
	if (patternMatches.email >= threshold) return "email";
	if (patternMatches.url >= threshold) return "url";
	if (patternMatches.datetime >= threshold) return "datetime";
	if (patternMatches.date >= threshold) return "date";
	if (patternMatches.currency >= threshold) return "currency";
	if (patternMatches.boolean >= threshold) return "boolean";
	if (patternMatches.integer >= threshold) return "integer";
	if (patternMatches.number >= threshold) return "number";
	if (patternMatches.phone >= threshold) return "phone";

	// Check if values are very long (text vs string)
	const avgLength = stringValues.reduce((sum, v) => sum + v.length, 0) / stringValues.length;
	if (avgLength > 200) return "text";

	return "string";
}

/**
 * Analyze column for type detection and statistics.
 */
function analyzeColumn(name: string, values: unknown[]): DetectedColumnType {
	const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== "");
	const fillRate = nonEmpty.length / values.length;

	// Get sample values (first 5 non-empty)
	const sampleValues = nonEmpty
		.slice(0, 5)
		.map((v) => String(v).substring(0, 100));

	// Check uniqueness
	const uniqueValues = new Set(nonEmpty.map((v) => String(v).toLowerCase()));
	const appearsUnique = uniqueValues.size === nonEmpty.length && nonEmpty.length >= MIN_ROWS_FOR_INFERENCE;

	return {
		name,
		inferredType: inferColumnType(nonEmpty),
		fillRate,
		sampleValues,
		appearsUnique,
	};
}

// ============================================================================
// CSV/TSV Parsing
// ============================================================================

/**
 * Parse CSV or TSV file.
 */
export async function parseCSVFile(
	content: string,
	filename: string,
	fileSize: number
): Promise<ParsedFileData> {
	const delimiter = filename.endsWith(".tsv") ? "\t" : detectDelimiter(content);
	const fileType = delimiter === "\t" ? "tsv" : "csv";

	return new Promise((resolve, reject) => {
		Papa.parse<Record<string, unknown>>(content, {
			header: true,
			delimiter,
			skipEmptyLines: true,
			transformHeader: (header) => header.trim(),
			complete: (result) => {
				const headers = result.meta.fields || [];
				const rows = result.data;
				const sampleRows = rows.slice(0, MAX_SAMPLE_ROWS);

				// Analyze columns
				const detectedTypes = headers.map((header) => {
					const values = sampleRows.map((row) => row[header]);
					return analyzeColumn(header, values);
				});

				resolve({
					headers,
					sampleRows,
					totalRows: rows.length,
					detectedTypes,
					metadata: {
						filename,
						fileType,
						fileSize,
					},
				});
			},
			error: (error: Error) => {
				reject(new Error(`CSV parsing failed: ${error.message}`));
			},
		});
	});
}

// ============================================================================
// Main Parser Function
// ============================================================================

/**
 * Parse any supported file format.
 * Returns parsed data with headers, sample rows, and type detection.
 */
export async function parseFile(file: File): Promise<ParsedFileData> {
	const buffer = await file.arrayBuffer();
	const fileType = detectFileType(file.name);

	switch (fileType) {
		case "csv":
		case "tsv": {
			const text = new TextDecoder().decode(buffer);
			return parseCSVFile(text, file.name, file.size);
		}

		default:
			throw new Error(`Unsupported file type: ${fileType}`);
	}
}
