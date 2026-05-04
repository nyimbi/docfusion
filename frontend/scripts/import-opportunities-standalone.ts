/**
 * Standalone Import Opportunities Script
 *
 * Imports opportunities directly from spreadsheets to the database.
 * Usage: npx tsx scripts/import-opportunities-standalone.ts
 */

import { Pool } from "pg";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const OPPORTUNITIES_DIR = "/Users/nyimbiodero/src/pjs/work_docs/Business/Opportunities";
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	throw new Error("DATABASE_URL is required to import opportunities");
}

// Database connection
const pool = new Pool({
	connectionString: DATABASE_URL,
	ssl: { rejectUnauthorized: false },
});

// Column mappings for different spreadsheet formats
const COLUMN_MAPPINGS: Record<string, Record<string, string>> = {
	software_dev_rfps: {
		ID: "source_id",
		Title: "title",
		Category: "category",
		"Country/Region": "country_region",
		Organization: "organization",
		Deadline: "deadline",
		"Budget/Value": "budget_value",
		"Project Summary": "project_summary",
		"Key Requirements": "key_requirements",
		"Submission Method": "submission_method",
		"RFP Document Link": "rfp_link",
		"Source Platform": "source_platform",
	},
	africa_ngo_rfps: {
		ID: "source_id",
		Title: "title",
		Category: "category",
		"Country/Region": "country_region",
		"Organization/Funder": "organization",
		Deadline: "deadline",
		"Budget/Value": "budget_value",
		"Project Summary": "project_summary",
		"Key Requirements": "key_requirements",
		"Submission Method": "submission_method",
		"RFP/EOI Link": "rfp_link",
		"Source Platform": "source_platform",
	},
	africa_software_rfps: {
		ID: "source_id",
		"Project Title": "title",
		"Software Category": "category",
		"Country/Region": "country_region",
		"Organization/Client": "organization",
		Deadline: "deadline",
		"Est. Budget": "budget_value",
		"Project Scope & Deliverables": "project_scope",
		"Technical Stack/Requirements": "technical_requirements",
		"Submission Requirements": "submission_requirements",
		"RFP/EOI Link": "rfp_link",
		Source: "source_platform",
	},
	africa_commercial_rfps: {
		ID: "source_id",
		Title: "title",
		Sector: "sector",
		"IT Category": "it_category",
		Country: "country_region",
		Organization: "organization",
		Deadline: "deadline",
		"Est. Value": "budget_value",
		"Project Description": "project_summary",
		"Technical Requirements": "technical_requirements",
		"Submission Method": "submission_method",
		"Tender/RFP Link": "rfp_link",
		Source: "source_platform",
	},
};

// Detect format based on filename
function detectFormat(filename: string): string {
	const lowerName = filename.toLowerCase();
	if (lowerName.includes("software_development_rfps_eois")) return "software_dev_rfps";
	if (lowerName.includes("africa_ngo_ingo")) return "africa_ngo_rfps";
	if (lowerName.includes("africa_software_development")) return "africa_software_rfps";
	if (lowerName.includes("africa_commercial_corporate")) return "africa_commercial_rfps";
	return "software_dev_rfps"; // default
}

// Parse date
function parseDate(value: unknown): Date | null {
	if (!value) return null;
	if (value instanceof Date) return value;

	if (typeof value === "number") {
		// Excel serial date
		const excelEpoch = new Date(1899, 11, 30);
		return new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
	}

	if (typeof value === "string") {
		const str = value.trim();
		if (!str || str.toLowerCase() === "expired" || str.toLowerCase() === "n/a") {
			return null;
		}
		const parsed = new Date(str);
		return isNaN(parsed.getTime()) ? null : parsed;
	}

	return null;
}

// Parse currency value
function parseBudget(value: unknown): { value: string; numeric: number | null } {
	if (!value) return { value: "", numeric: null };

	const str = String(value).trim();

	// Try to extract numeric value
	const numMatch = str.match(/([\d,]+(?:\.\d+)?)/);
	if (numMatch) {
		const numericValue = parseFloat(numMatch[1].replace(/,/g, ""));
		if (!isNaN(numericValue)) {
			// Check for multipliers
			if (str.toLowerCase().includes("million") || str.includes("M")) {
				return { value: str, numeric: numericValue * 1_000_000 };
			}
			if (str.toLowerCase().includes("billion") || str.includes("B")) {
				return { value: str, numeric: numericValue * 1_000_000_000 };
			}
			return { value: str, numeric: numericValue };
		}
	}

	return { value: str, numeric: null };
}

// Process a single row
function processRow(
	row: Record<string, unknown>,
	mapping: Record<string, string>,
	sourceFile: string
): Record<string, unknown> | null {
	const result: Record<string, unknown> = {
		source_file: sourceFile,
		opportunity_type: "rfp",
		decision_status: "pending",
		priority_rank: 3,
		is_reviewed: false,
		is_expired: false,
		tags: "[]",
	};

	// Map columns
	for (const [sourceCol, targetCol] of Object.entries(mapping)) {
		const value = row[sourceCol];
		if (value !== undefined && value !== null && value !== "") {
			if (targetCol === "deadline") {
				const date = parseDate(value);
				result[targetCol] = date;
				if (date) {
					const now = new Date();
					const daysLeft = Math.ceil(
						(date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
					);
					result.days_left = daysLeft;
					result.is_expired = daysLeft < 0;
				}
			} else if (targetCol === "budget_value") {
				const { value: budgetStr, numeric } = parseBudget(value);
				result.budget_value = budgetStr;
				result.budget_numeric = numeric;
			} else {
				result[targetCol] = String(value).trim();
			}
		}
	}

	// Skip rows without title
	if (!result.title) return null;

	return result;
}

// Import a single file
async function importFile(
	filePath: string
): Promise<{ imported: number; updated: number; failed: number }> {
	const filename = path.basename(filePath);
	const format = detectFormat(filename);
	const mapping = COLUMN_MAPPINGS[format];

	console.log(`\nProcessing: ${filename} (format: ${format})`);

	// Read Excel file
	const workbook = XLSX.read(fs.readFileSync(filePath), {
		type: "buffer",
		cellDates: true,
	});

	// Find the data sheet (first non-summary sheet)
	const dataSheet = workbook.SheetNames.find(
		(name) =>
			!name.toLowerCase().includes("summary") &&
			!name.toLowerCase().includes("source")
	);

	if (!dataSheet) {
		console.log(`  No data sheet found in ${filename}`);
		return { imported: 0, updated: 0, failed: 0 };
	}

	const sheet = workbook.Sheets[dataSheet];
	const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

	console.log(`  Found ${rows.length} rows in sheet: ${dataSheet}`);

	let imported = 0;
	let updated = 0;
	let failed = 0;

	for (const row of rows) {
		const processed = processRow(row, mapping, filename);
		if (!processed) {
			continue;
		}

		try {
			// Check if exists
			const existingResult = await pool.query(
				`SELECT id FROM opportunities WHERE source_id = $1 AND source_file = $2`,
				[processed.source_id, filename]
			);

			if (existingResult.rows.length > 0) {
				// Update
				const updateCols = Object.keys(processed)
					.filter((k) => k !== "source_id" && k !== "source_file")
					.map((k, i) => `${k} = $${i + 3}`)
					.join(", ");

				const updateVals = Object.keys(processed)
					.filter((k) => k !== "source_id" && k !== "source_file")
					.map((k) => processed[k]);

				await pool.query(
					`UPDATE opportunities SET ${updateCols}, updated_at = NOW()
           WHERE source_id = $1 AND source_file = $2`,
					[processed.source_id, filename, ...updateVals]
				);
				updated++;
			} else {
				// Insert
				const cols = Object.keys(processed).join(", ");
				const placeholders = Object.keys(processed)
					.map((_, i) => `$${i + 1}`)
					.join(", ");
				const vals = Object.values(processed);

				await pool.query(
					`INSERT INTO opportunities (${cols}) VALUES (${placeholders})`,
					vals
				);
				imported++;
			}
		} catch (err) {
			console.error(`  Error processing row:`, err);
			failed++;
		}
	}

	console.log(`  Imported: ${imported}, Updated: ${updated}, Failed: ${failed}`);
	return { imported, updated, failed };
}

// Main function
async function main() {
	console.log("Starting opportunity import...");
	console.log(`Source directory: ${OPPORTUNITIES_DIR}`);

	const files = fs
		.readdirSync(OPPORTUNITIES_DIR)
		.filter((f) => f.endsWith(".xlsx") || f.endsWith(".xls") || f.endsWith(".csv"));

	console.log(`Found ${files.length} spreadsheet files`);

	let totalImported = 0;
	let totalUpdated = 0;
	let totalFailed = 0;

	for (const file of files) {
		const filePath = path.join(OPPORTUNITIES_DIR, file);
		try {
			const { imported, updated, failed } = await importFile(filePath);
			totalImported += imported;
			totalUpdated += updated;
			totalFailed += failed;
		} catch (err) {
			console.error(`Failed to process ${file}:`, err);
		}
	}

	console.log("\n========================================");
	console.log("Import Complete!");
	console.log("========================================");
	console.log(`Total Imported: ${totalImported}`);
	console.log(`Total Updated: ${totalUpdated}`);
	console.log(`Total Failed: ${totalFailed}`);

	await pool.end();
}

main().catch((err) => {
	console.error("Import failed:", err);
	process.exit(1);
});
