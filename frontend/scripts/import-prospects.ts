/**
 * Import Prospects from Excel into CRM Accounts Table
 *
 * Imports all prospects from the Datacraft_Lindela_1000_Prospects_Master.xlsx file
 * into the CRM accounts table with type="prospect".
 *
 * Column Mapping:
 * - Organization Name → name
 * - Country → country
 * - Region → region
 * - Category → industry
 * - Sub-Category → sector
 * - Organization Type → subSector
 * - Headquarters → city
 * - Website → website
 * - Key Leadership → customFields.keyLeadership
 * - Lindela Relevance Score → leadScore (scaled to 0-100)
 * - Pitching Angle → customFields.pitchingAngle
 * - Priority Tier → tags[] + customFields.priorityTier
 *
 * Run with: npx tsx scripts/import-prospects.ts
 *
 * Options:
 *   --dry-run    Show what would be imported without making changes
 *   --sheet=NAME Import from a specific sheet (default: "All Prospects")
 */

import * as XLSX from "./lib/xlsx-reader";
import * as fs from "fs";
import { db } from "../lib/db";
import { accounts, type NewAccount } from "../lib/db/schema-crm";
import { eq, and } from "drizzle-orm";

const EXCEL_PATH = "/Users/nyimbiodero/src/pjs/work_docs/Business/Partnerships/Datacraft_Lindela_1000_Prospects_Master.xlsx";

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const sheetArg = args.find(a => a.startsWith("--sheet="));
const SHEET_NAME = sheetArg ? sheetArg.split("=")[1] : "All Prospects";

/**
 * Extract priority tier tag from the tier string
 */
function extractPriorityTag(tier: string | undefined): string[] {
	if (!tier) return [];

	const tags: string[] = [];

	if (tier.includes("Tier 1")) {
		tags.push("tier-1-immediate");
	} else if (tier.includes("Tier 2")) {
		tags.push("tier-2-high-priority");
	} else if (tier.includes("Tier 3")) {
		tags.push("tier-3-medium");
	} else if (tier.includes("Tier 4")) {
		tags.push("tier-4-low");
	}

	return tags;
}

/**
 * Scale the Lindela score (1-10) to lead score (0-100)
 */
function scaleLeadScore(lindelaScore: number | undefined): number {
	if (lindelaScore === undefined || lindelaScore === null) return 0;
	// Scale from 1-10 to 0-100
	return Math.min(100, Math.max(0, Math.round(lindelaScore * 10)));
}

/**
 * Clean and normalize string values
 */
function cleanString(value: unknown): string | undefined {
	if (value === undefined || value === null || value === "") return undefined;
	return String(value).trim();
}

/**
 * Parse a row from the Excel file into a NewAccount object
 */
function parseProspectRow(row: Record<string, unknown>, rowIndex: number): NewAccount | null {
	const organizationName = cleanString(row["Organization Name"]);

	// Skip rows without organization name
	if (!organizationName) {
		console.warn(`  Row ${rowIndex}: Skipping - no organization name`);
		return null;
	}

	// Extract fields that now have dedicated columns
	const keyLeadership = cleanString(row["Key Leadership"]);
	const pitchingAngle = cleanString(row["Pitching Angle"]);
	const priorityTier = cleanString(row["Priority Tier"]);
	const organizationType = cleanString(row["Organization Type"]);

	// Build custom fields for remaining data without direct mapping
	const customFields: Record<string, unknown> = {};

	// Store organization type in custom fields (subSector is used but we keep original too)
	if (organizationType) {
		customFields.organizationType = organizationType;
	}

	// Extract the raw Lindela score for reference
	const lindelaScore = row["Lindela Relevance Score"];
	if (lindelaScore !== undefined && lindelaScore !== null) {
		customFields.lindelaRelevanceScore = lindelaScore;
	}

	// Build tags array
	const tags: string[] = [];

	// Add priority tier as tag
	tags.push(...extractPriorityTag(priorityTier));

	// Add category as tag for easy filtering
	const category = cleanString(row["Category"]);
	if (category) {
		tags.push(category.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
	}

	// Create the account record
	const account: NewAccount = {
		// Core Identity
		name: organizationName,
		type: "prospect",

		// Classification
		industry: category,
		sector: cleanString(row["Sub-Category"]),
		subSector: organizationType,

		// Location
		country: cleanString(row["Country"]),
		region: cleanString(row["Region"]),
		city: cleanString(row["Headquarters"]),

		// Company Details
		website: cleanString(row["Website"]),

		// Lead Scoring
		leadScore: scaleLeadScore(lindelaScore as number | undefined),
		leadSource: "excel-import",
		leadSourceDetail: "Datacraft_Lindela_1000_Prospects_Master.xlsx",

		// Prospect-Specific Fields (now dedicated columns)
		keyLeadership,
		pitchingAngle,
		priorityTier,

		// Pipeline
		stage: "new",
		status: "active",

		// Metadata
		tags,
		customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
		source: "import",
		sourceFile: EXCEL_PATH,
	};

	return account;
}

/**
 * Check if a prospect already exists (by name, country, and type)
 */
async function prospectExists(name: string, country: string | undefined): Promise<boolean> {
	const existing = await db
		.select({ id: accounts.id })
		.from(accounts)
		.where(
			and(
				eq(accounts.name, name),
				eq(accounts.type, "prospect"),
				country ? eq(accounts.country, country) : undefined
			)
		)
		.limit(1);

	return existing.length > 0;
}

/**
 * Main import function
 */
async function importProspects() {
	console.log("=".repeat(70));
	console.log("Prospects Import to CRM");
	console.log("=".repeat(70));
	console.log();
	console.log(`File: ${EXCEL_PATH}`);
	console.log(`Sheet: ${SHEET_NAME}`);
	console.log(`Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE IMPORT"}`);
	console.log();

	// Check if file exists
	if (!fs.existsSync(EXCEL_PATH)) {
		console.error(`Error: File not found: ${EXCEL_PATH}`);
		process.exit(1);
	}

	// Read the Excel file
	console.log("Reading Excel file...");
	const workbook = XLSX.readFile(EXCEL_PATH);

	// Check if sheet exists
	if (!workbook.SheetNames.includes(SHEET_NAME)) {
		console.error(`Error: Sheet "${SHEET_NAME}" not found`);
		console.log("Available sheets:", workbook.SheetNames.join(", "));
		process.exit(1);
	}

	// Get the worksheet
	const worksheet = workbook.Sheets[SHEET_NAME];
	const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

	console.log(`Found ${jsonData.length} rows in sheet "${SHEET_NAME}"`);
	console.log();

	// Statistics
	const stats = {
		total: jsonData.length,
		parsed: 0,
		skipped: 0,
		duplicates: 0,
		inserted: 0,
		errors: 0,
	};

	// Batch for insertion
	const accountsToInsert: NewAccount[] = [];

	console.log("Parsing rows...");
	console.log("-".repeat(70));

	for (let i = 0; i < jsonData.length; i++) {
		const row = jsonData[i];
		const rowNum = i + 2; // Excel rows start at 1, plus header row

		try {
			const account = parseProspectRow(row, rowNum);

			if (!account) {
				stats.skipped++;
				continue;
			}

			// Check for duplicates
			if (!DRY_RUN) {
				const exists = await prospectExists(account.name, account.country ?? undefined);
				if (exists) {
					console.log(`  Row ${rowNum}: Skipping duplicate - ${account.name} (${account.country || "no country"})`);
					stats.duplicates++;
					continue;
				}
			}

			accountsToInsert.push(account);
			stats.parsed++;

			// Progress log every 100 rows
			if (stats.parsed % 100 === 0) {
				console.log(`  Parsed ${stats.parsed} records...`);
			}
		} catch (error) {
			console.error(`  Row ${rowNum}: Error - ${error instanceof Error ? error.message : String(error)}`);
			stats.errors++;
		}
	}

	console.log("-".repeat(70));
	console.log();

	// Insert in batches
	if (!DRY_RUN && accountsToInsert.length > 0) {
		console.log(`Inserting ${accountsToInsert.length} prospects...`);

		const BATCH_SIZE = 100;
		for (let i = 0; i < accountsToInsert.length; i += BATCH_SIZE) {
			const batch = accountsToInsert.slice(i, i + BATCH_SIZE);

			try {
				await db.insert(accounts).values(batch);
				stats.inserted += batch.length;
				console.log(`  Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} records)`);
			} catch (error) {
				console.error(`  Batch insert error: ${error instanceof Error ? error.message : String(error)}`);
				stats.errors += batch.length;

				// Try one-by-one insertion for failed batch
				console.log("  Attempting individual insertions...");
				for (const account of batch) {
					try {
						await db.insert(accounts).values(account);
						stats.inserted++;
					} catch (individualError) {
						console.error(`    Failed: ${account.name} - ${individualError instanceof Error ? individualError.message : String(individualError)}`);
						stats.errors++;
					}
				}
			}
		}
	}

	// Summary
	console.log();
	console.log("=".repeat(70));
	console.log("Import Summary");
	console.log("=".repeat(70));
	console.log();
	console.log(`  Total rows in Excel:     ${stats.total}`);
	console.log(`  Successfully parsed:     ${stats.parsed}`);
	console.log(`  Skipped (no name):       ${stats.skipped}`);
	console.log(`  Skipped (duplicates):    ${stats.duplicates}`);

	if (!DRY_RUN) {
		console.log(`  Inserted to database:    ${stats.inserted}`);
	}

	console.log(`  Errors:                  ${stats.errors}`);
	console.log();

	if (DRY_RUN) {
		console.log("DRY RUN complete. No changes were made.");
		console.log("Run without --dry-run to perform the actual import.");

		// Show sample of what would be inserted
		console.log();
		console.log("Sample of first 5 records that would be inserted:");
		console.log("-".repeat(70));
		accountsToInsert.slice(0, 5).forEach((account, idx) => {
			console.log(`\n${idx + 1}. ${account.name}`);
			console.log(`   Country: ${account.country || "(none)"}`);
			console.log(`   Region: ${account.region || "(none)"}`);
			console.log(`   Industry: ${account.industry || "(none)"}`);
			console.log(`   Sector: ${account.sector || "(none)"}`);
			console.log(`   Lead Score: ${account.leadScore}`);
			console.log(`   Tags: ${account.tags?.join(", ") || "(none)"}`);
			if (account.customFields) {
				console.log(`   Custom Fields: ${JSON.stringify(account.customFields).substring(0, 100)}...`);
			}
		});
	} else {
		console.log("Import complete!");
	}

	console.log();
	console.log("=".repeat(70));
}

// Run the import
importProspects()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error("Fatal error:", error);
		process.exit(1);
	});
