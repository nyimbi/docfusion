/**
 * Import All Accounts Script
 *
 * Imports accounts from three Excel source files:
 * 1. Datacraft_Lindela_1000_Prospects_Master.xlsx - Prospects for Lindela
 * 2. Grant_Makers_Database_500.xlsx - Grant-making organizations
 * 3. Datacraft_Africa_Software_Companies_Master.xlsx - Software company partners
 *
 * Usage: npx tsx scripts/import-all-accounts.ts
 */

import * as XLSX from "./lib/xlsx-reader";
import { db } from "../lib/db";
import { accounts } from "../lib/db/schema-crm";
import { eq, and } from "drizzle-orm";
import path from "path";

// ============================================================================
// Configuration
// ============================================================================

const SOURCE_FILES = {
	prospects: "/Users/nyimbiodero/src/pjs/work_docs/Business/Partnerships/Datacraft_Lindela_1000_Prospects_Master.xlsx",
	grantMakers: "/Users/nyimbiodero/src/pjs/work_docs/Business/Partnerships/Grant_Makers_Database_500.xlsx",
	softwareCompanies: "/Users/nyimbiodero/src/pjs/work_docs/Business/Partnerships/Datacraft_Africa_Software_Companies_Master.xlsx",
};

// ============================================================================
// Type Definitions
// ============================================================================

interface ProspectRow {
	"Organization Name": string;
	"Country": string;
	"Region": string;
	"Category": string;
	"Sub-Category": string;
	"Organization Type": string;
	"Headquarters"?: string;
	"Website": string;
	"Key Leadership": string;
	"Lindela Relevance Score": number;
	"Pitching Angle": string;
	"Priority Tier": string;
}

interface GrantMakerRow {
	"ID": number;
	"Organization Name": string;
	"Type": string;
	"HQ Country": string;
	"Website": string;
	"Annual Giving (USD)": string;
	"Focus Areas": string;
	"Grant Range": string;
	"Geographic Focus": string;
	"Application Process": string;
	"Contact": string;
	"Grant History": string;
	"Peacebuilding Score": number;
	"Category": string;
}

interface SoftwareCompanyRow {
	"Company Name": string;
	"Country": string;
	"Region": string;
	"City": string;
	"Corporate Status": string;
	"Founding Date": string | number;
	"Company Profile/Description": string;
	"Core Software Capabilities": string;
	"Website": string;
	"Email": string;
	"Phone": string;
	"Address": string;
	"Key Leadership": string;
	"Notable Clients/Projects": string;
	"Revenue Estimate": string;
	"Employee Count": string;
	"Risk Assessment": string;
	"Partnership Fit Score": number;
	"Fit Justification": string;
}

interface ImportStats {
	total: number;
	created: number;
	updated: number;
	skipped: number;
	errors: number;
}

// ============================================================================
// Import Functions
// ============================================================================

/**
 * Import prospects from Lindela Excel file
 */
async function importProspects(filePath: string): Promise<ImportStats> {
	console.log("\n📥 Importing Prospects from:", path.basename(filePath));

	const stats: ImportStats = { total: 0, created: 0, updated: 0, skipped: 0, errors: 0 };

	try {
		const workbook = XLSX.readFile(filePath);
		const sheet = workbook.Sheets[workbook.SheetNames[0]];
		const rows = XLSX.utils.sheet_to_json<ProspectRow>(sheet);

		stats.total = rows.length;
		console.log(`   Found ${rows.length} prospects to import`);

		for (const row of rows) {
			try {
				if (!row["Organization Name"]) {
					stats.skipped++;
					continue;
				}

				// Check if account already exists
				const existing = await db.query.accounts.findFirst({
					where: and(
						eq(accounts.name, row["Organization Name"]),
						eq(accounts.country, row["Country"] || "Unknown"),
						eq(accounts.type, "prospect")
					),
				});

				const accountData = {
					name: row["Organization Name"],
					type: "prospect" as const,
					country: row["Country"] || null,
					region: row["Region"] || null,
					category: row["Category"] || null,
					subCategory: row["Sub-Category"] || null,
					organizationType: row["Organization Type"] || null,
					headquarters: row["Headquarters"] || null,
					website: cleanUrl(row["Website"]),
					keyLeadership: row["Key Leadership"] || null,
					leadScore: row["Lindela Relevance Score"] ? Math.round(row["Lindela Relevance Score"] * 10) : null,
					pitchingAngle: row["Pitching Angle"] || null,
					priorityTier: row["Priority Tier"] || null,
					source: "import",
					sourceFile: path.basename(filePath),
					updatedAt: new Date(),
				};

				if (existing) {
					// Update existing account
					await db.update(accounts)
						.set(accountData)
						.where(eq(accounts.id, existing.id));
					stats.updated++;
				} else {
					// Create new account
					await db.insert(accounts).values({
						...accountData,
						stage: "new",
						status: "active",
						createdAt: new Date(),
					});
					stats.created++;
				}
			} catch (error) {
				console.error(`   Error importing "${row["Organization Name"]}":`, error);
				stats.errors++;
			}
		}
	} catch (error) {
		console.error("   Failed to read file:", error);
		throw error;
	}

	return stats;
}

/**
 * Import grant makers from Excel file
 */
async function importGrantMakers(filePath: string): Promise<ImportStats> {
	console.log("\n📥 Importing Grant Makers from:", path.basename(filePath));

	const stats: ImportStats = { total: 0, created: 0, updated: 0, skipped: 0, errors: 0 };

	try {
		const workbook = XLSX.readFile(filePath);
		const sheet = workbook.Sheets[workbook.SheetNames[0]];
		const rows = XLSX.utils.sheet_to_json<GrantMakerRow>(sheet);

		stats.total = rows.length;
		console.log(`   Found ${rows.length} grant makers to import`);

		for (const row of rows) {
			try {
				if (!row["Organization Name"]) {
					stats.skipped++;
					continue;
				}

				// Check if account already exists
				const existing = await db.query.accounts.findFirst({
					where: and(
						eq(accounts.name, row["Organization Name"]),
						eq(accounts.type, "prospect")
					),
				});

				const accountData = {
					name: row["Organization Name"],
					type: "prospect" as const,
					organizationType: row["Type"] || null,
					country: row["HQ Country"] || null,
					website: cleanUrl(row["Website"]),
					annualGiving: row["Annual Giving (USD)"] || null,
					focusAreas: row["Focus Areas"] || null,
					grantRange: row["Grant Range"] || null,
					geographicFocus: row["Geographic Focus"] || null,
					applicationProcess: row["Application Process"] || null,
					keyLeadership: row["Contact"] || null,
					grantHistory: row["Grant History"] || null,
					impactScore: row["Peacebuilding Score"] || null,
					category: row["Category"] || "Grant Maker",
					industry: "Philanthropy",
					sector: "Grant Making",
					leadScore: row["Peacebuilding Score"] ? row["Peacebuilding Score"] * 10 : null,
					source: "import",
					sourceFile: path.basename(filePath),
					updatedAt: new Date(),
				};

				if (existing) {
					// Update existing account
					await db.update(accounts)
						.set(accountData)
						.where(eq(accounts.id, existing.id));
					stats.updated++;
				} else {
					// Create new account
					await db.insert(accounts).values({
						...accountData,
						stage: "new",
						status: "active",
						createdAt: new Date(),
					});
					stats.created++;
				}
			} catch (error) {
				console.error(`   Error importing "${row["Organization Name"]}":`, error);
				stats.errors++;
			}
		}
	} catch (error) {
		console.error("   Failed to read file:", error);
		throw error;
	}

	return stats;
}

/**
 * Import software companies from Excel file
 */
async function importSoftwareCompanies(filePath: string): Promise<ImportStats> {
	console.log("\n📥 Importing Software Companies from:", path.basename(filePath));

	const stats: ImportStats = { total: 0, created: 0, updated: 0, skipped: 0, errors: 0 };

	try {
		const workbook = XLSX.readFile(filePath);
		const sheet = workbook.Sheets[workbook.SheetNames[0]];
		const rows = XLSX.utils.sheet_to_json<SoftwareCompanyRow>(sheet);

		stats.total = rows.length;
		console.log(`   Found ${rows.length} software companies to import`);

		for (const row of rows) {
			try {
				if (!row["Company Name"]) {
					stats.skipped++;
					continue;
				}

				// Check if account already exists
				const existing = await db.query.accounts.findFirst({
					where: and(
						eq(accounts.name, row["Company Name"]),
						eq(accounts.country, row["Country"] || "Unknown"),
						eq(accounts.type, "partner")
					),
				});

				// Parse founding year
				let foundedYear: number | null = null;
				if (row["Founding Date"]) {
					const parsed = typeof row["Founding Date"] === "number"
						? row["Founding Date"]
						: parseInt(String(row["Founding Date"]), 10);
					if (!isNaN(parsed) && parsed > 1900 && parsed <= new Date().getFullYear()) {
						foundedYear = parsed;
					}
				}

				const accountData = {
					name: row["Company Name"],
					type: "partner" as const,
					country: row["Country"] || null,
					region: row["Region"] || null,
					city: row["City"] || null,
					corporateStatus: row["Corporate Status"] || null,
					foundedYear,
					description: row["Company Profile/Description"] || null,
					coreCapabilities: row["Core Software Capabilities"] || null,
					website: cleanUrl(row["Website"]),
					email: row["Email"] || null,
					phone: row["Phone"] || null,
					address: row["Address"] || null,
					keyLeadership: row["Key Leadership"] || null,
					notableClients: row["Notable Clients/Projects"] || null,
					annualRevenue: row["Revenue Estimate"] || null,
					employeeCount: row["Employee Count"] || null,
					riskAssessment: row["Risk Assessment"] || null,
					partnershipFitScore: row["Partnership Fit Score"] ? row["Partnership Fit Score"] * 10 : null,
					fitJustification: row["Fit Justification"] || null,
					industry: "Technology",
					sector: "Software Development",
					category: "Software Company",
					source: "import",
					sourceFile: path.basename(filePath),
					updatedAt: new Date(),
				};

				if (existing) {
					// Update existing account
					await db.update(accounts)
						.set(accountData)
						.where(eq(accounts.id, existing.id));
					stats.updated++;
				} else {
					// Create new account
					await db.insert(accounts).values({
						...accountData,
						stage: "identified",
						status: "active",
						createdAt: new Date(),
					});
					stats.created++;
				}
			} catch (error) {
				console.error(`   Error importing "${row["Company Name"]}":`, error);
				stats.errors++;
			}
		}
	} catch (error) {
		console.error("   Failed to read file:", error);
		throw error;
	}

	return stats;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Clean and normalize URL
 */
function cleanUrl(url: string | undefined | null): string | null {
	if (!url) return null;

	let cleaned = url.trim();
	if (!cleaned) return null;

	// Add protocol if missing
	if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
		cleaned = "https://" + cleaned;
	}

	return cleaned;
}

/**
 * Print import statistics
 */
function printStats(label: string, stats: ImportStats) {
	console.log(`\n   ${label} Results:`);
	console.log(`   ├── Total rows: ${stats.total}`);
	console.log(`   ├── Created: ${stats.created}`);
	console.log(`   ├── Updated: ${stats.updated}`);
	console.log(`   ├── Skipped: ${stats.skipped}`);
	console.log(`   └── Errors: ${stats.errors}`);
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
	console.log("=".repeat(60));
	console.log("📂 Account Import Script");
	console.log("=".repeat(60));

	const allStats: ImportStats = { total: 0, created: 0, updated: 0, skipped: 0, errors: 0 };

	try {
		// Import Prospects
		const prospectsStats = await importProspects(SOURCE_FILES.prospects);
		printStats("Prospects", prospectsStats);
		allStats.total += prospectsStats.total;
		allStats.created += prospectsStats.created;
		allStats.updated += prospectsStats.updated;
		allStats.skipped += prospectsStats.skipped;
		allStats.errors += prospectsStats.errors;

		// Import Grant Makers
		const grantStats = await importGrantMakers(SOURCE_FILES.grantMakers);
		printStats("Grant Makers", grantStats);
		allStats.total += grantStats.total;
		allStats.created += grantStats.created;
		allStats.updated += grantStats.updated;
		allStats.skipped += grantStats.skipped;
		allStats.errors += grantStats.errors;

		// Import Software Companies
		const softwareStats = await importSoftwareCompanies(SOURCE_FILES.softwareCompanies);
		printStats("Software Companies", softwareStats);
		allStats.total += softwareStats.total;
		allStats.created += softwareStats.created;
		allStats.updated += softwareStats.updated;
		allStats.skipped += softwareStats.skipped;
		allStats.errors += softwareStats.errors;

		// Print final summary
		console.log("\n" + "=".repeat(60));
		console.log("📊 FINAL SUMMARY");
		console.log("=".repeat(60));
		printStats("All Sources", allStats);

		console.log("\n✅ Import completed successfully!");
	} catch (error) {
		console.error("\n❌ Import failed:", error);
		process.exit(1);
	}

	process.exit(0);
}

main();
