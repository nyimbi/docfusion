/**
 * Import Partner Data from Excel
 *
 * Imports partner prospects from the Datacraft Africa Partner Prospects Excel file.
 * Run with: npx tsx scripts/import-partners.ts
 */

import * as XLSX from "xlsx";
import * as fs from "fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { partners, partnerImports, type NewPartner } from "../lib/db/schema-partners";
import { eq } from "drizzle-orm";

const EXCEL_PATH = "/Users/nyimbiodero/src/pjs/work_docs/Business/Partnerships/Datacraft_Africa_Partner_Prospects_Master.xlsx";

// Database connection (matching drizzle.config.ts)
const DATABASE_URL = process.env.DATABASE_URL ||
	"postgresql://azureuser:Abcd1234.@lindela16.postgres.database.azure.com:5432/docfusion?sslmode=require";

const pool = new Pool({
	connectionString: DATABASE_URL,
	ssl: DATABASE_URL.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
});
const db = drizzle(pool);

interface ExcelPartnerRow {
	"Company Name": string;
	"Country": string;
	"Region": string;
	"Corporate Status"?: string;
	"Founding Date"?: string;
	"Company Profile/Description"?: string;
	"Core Capabilities"?: string;
	"Website"?: string;
	"Email"?: string;
	"Phone"?: string;
	"Address"?: string;
	"Key Leadership/Executives"?: string;
	"Notable Clients/Projects"?: string;
	"Revenue Estimate"?: string;
	"Employee Count"?: string | number;
	"Funding Status"?: string;
	"Competitor Relationships"?: string;
	"Risk Assessment"?: string;
	"Partnership Fit Score"?: number;
	"Fit Justification"?: string;
}

/**
 * Map Excel row to database partner record
 */
function mapExcelToPartner(row: ExcelPartnerRow, sourceFile: string): NewPartner {
	// Determine tier based on fit score
	let tier: number | undefined;
	const fitScore = row["Partnership Fit Score"];
	if (fitScore !== undefined) {
		if (fitScore >= 8) tier = 1;
		else if (fitScore >= 6) tier = 2;
		else tier = 3;
	}

	// Parse capabilities into array
	const capabilities: string[] = [];
	if (row["Core Capabilities"]) {
		// Split by common delimiters and clean up
		const caps = row["Core Capabilities"]
			.split(/[,;-]/)
			.map(c => c.trim())
			.filter(c => c.length > 0 && c.length < 100);
		capabilities.push(...caps.slice(0, 10)); // Limit to 10 items
	}

	// Normalize employee count
	let employeeCount = row["Employee Count"]?.toString() || undefined;
	if (employeeCount && /^\d+$/.test(employeeCount)) {
		// If it's just a number, add appropriate range
		const count = parseInt(employeeCount, 10);
		if (count < 10) employeeCount = "1-10";
		else if (count < 50) employeeCount = "10-50";
		else if (count < 100) employeeCount = "50-100";
		else if (count < 500) employeeCount = "100-500";
		else employeeCount = "500+";
	}

	return {
		name: row["Company Name"]?.trim() || "Unknown",
		country: row["Country"]?.trim() || undefined,
		region: row["Region"]?.trim() || undefined,
		corporateStatus: row["Corporate Status"]?.trim() || undefined,
		foundingDate: row["Founding Date"]?.toString().trim() || undefined,
		description: row["Company Profile/Description"]?.trim() || undefined,
		contactEmail: row["Email"]?.trim() || undefined,
		contactPhone: row["Phone"]?.trim() || undefined,
		website: row["Website"]?.trim() || undefined,
		address: row["Address"]?.trim() || undefined,
		leadership: row["Key Leadership/Executives"]?.trim() || undefined,
		notableClients: row["Notable Clients/Projects"]?.trim() || undefined,
		revenueEstimate: row["Revenue Estimate"]?.trim() || undefined,
		employeeCount: employeeCount,
		fundingStatus: row["Funding Status"]?.trim() || undefined,
		type: "prospect",
		coreCapabilities: row["Core Capabilities"]?.trim() || undefined,
		capabilities: capabilities,
		sectors: [],
		competitorRelationships: row["Competitor Relationships"]?.trim() || undefined,
		riskAssessment: row["Risk Assessment"]?.trim() || undefined,
		partnershipFitScore: fitScore,
		fitJustification: row["Fit Justification"]?.trim() || undefined,
		tier: tier,
		pastCollaborations: 0,
		notes: undefined,
		tags: [],
		status: "prospect",
		source: "excel_import",
		sourceFile: sourceFile,
		metadata: undefined,
	};
}

async function main() {
	console.log("=".repeat(60));
	console.log("Partner Excel Import");
	console.log("=".repeat(60));
	console.log();

	// Check if file exists
	if (!fs.existsSync(EXCEL_PATH)) {
		console.error(`File not found: ${EXCEL_PATH}`);
		process.exit(1);
	}

	const filename = EXCEL_PATH.split("/").pop() || "unknown";

	// Create import record
	const [importRecord] = await db.insert(partnerImports).values({
		filename,
		filePath: EXCEL_PATH,
		status: "processing",
		importedBy: "script",
	}).returning();

	console.log(`Created import record: ${importRecord.id}`);
	console.log();

	try {
		// Read the Excel file
		const workbook = XLSX.readFile(EXCEL_PATH);

		// Process the "All Partners" sheet (first sheet)
		const sheetName = workbook.SheetNames[0];
		console.log(`Processing sheet: ${sheetName}`);

		const worksheet = workbook.Sheets[sheetName];
		const jsonData = XLSX.utils.sheet_to_json<ExcelPartnerRow>(worksheet);

		console.log(`Found ${jsonData.length} records`);
		console.log();

		let importedCount = 0;
		let updatedCount = 0;
		let skippedCount = 0;
		let failedCount = 0;
		const errors: { row: number; error: string }[] = [];

		for (let i = 0; i < jsonData.length; i++) {
			const row = jsonData[i];
			const rowNum = i + 2; // Excel rows are 1-indexed, plus header

			try {
				// Skip rows without company name
				if (!row["Company Name"] || row["Company Name"].toString().trim() === "") {
					console.log(`  Row ${rowNum}: Skipped (no company name)`);
					skippedCount++;
					continue;
				}

				const partnerData = mapExcelToPartner(row, filename);

				// Check if partner already exists (by name and country)
				const existing = await db.select()
					.from(partners)
					.where(eq(partners.name, partnerData.name))
					.limit(1);

				if (existing.length > 0) {
					// Update existing record
					await db.update(partners)
						.set({
							...partnerData,
							updatedAt: new Date(),
						})
						.where(eq(partners.id, existing[0].id));

					console.log(`  Row ${rowNum}: Updated - ${partnerData.name}`);
					updatedCount++;
				} else {
					// Insert new record
					await db.insert(partners).values(partnerData);
					console.log(`  Row ${rowNum}: Imported - ${partnerData.name}`);
					importedCount++;
				}
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : String(err);
				console.error(`  Row ${rowNum}: Failed - ${errorMsg}`);
				errors.push({ row: rowNum, error: errorMsg });
				failedCount++;
			}
		}

		// Update import record with results
		await db.update(partnerImports)
			.set({
				totalRecords: jsonData.length,
				importedRecords: importedCount,
				updatedRecords: updatedCount,
				skippedRecords: skippedCount,
				failedRecords: failedCount,
				errors: errors.length > 0 ? errors : [],
				status: failedCount > 0 ? "completed_with_errors" : "completed",
				completedAt: new Date(),
			})
			.where(eq(partnerImports.id, importRecord.id));

		console.log();
		console.log("=".repeat(60));
		console.log("Import Summary");
		console.log("=".repeat(60));
		console.log(`  Total Records:   ${jsonData.length}`);
		console.log(`  Imported:        ${importedCount}`);
		console.log(`  Updated:         ${updatedCount}`);
		console.log(`  Skipped:         ${skippedCount}`);
		console.log(`  Failed:          ${failedCount}`);
		console.log();

		if (errors.length > 0) {
			console.log("Errors:");
			errors.slice(0, 10).forEach(e => {
				console.log(`  Row ${e.row}: ${e.error}`);
			});
			if (errors.length > 10) {
				console.log(`  ... and ${errors.length - 10} more errors`);
			}
		}

	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : String(err);
		console.error(`Import failed: ${errorMsg}`);

		// Update import record with failure
		await db.update(partnerImports)
			.set({
				status: "failed",
				errors: [{ error: errorMsg }],
				completedAt: new Date(),
			})
			.where(eq(partnerImports.id, importRecord.id));

		process.exit(1);
	} finally {
		await pool.end();
	}

	console.log();
	console.log("=".repeat(60));
	console.log("Import Complete");
	console.log("=".repeat(60));
}

main().catch(console.error);
