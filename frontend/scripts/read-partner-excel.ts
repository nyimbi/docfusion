/**
 * Read Partner Excel File
 *
 * This script reads the partner prospects Excel file to understand its structure
 * Run with: npx tsx scripts/read-partner-excel.ts
 */

import * as XLSX from "./lib/xlsx-reader";
import * as fs from "fs";
import * as path from "path";

const EXCEL_PATH = "/Users/nyimbiodero/src/pjs/work_docs/Business/Partnerships/Datacraft_Africa_Partner_Prospects_Master.xlsx";

async function main() {
	console.log("=".repeat(60));
	console.log("Partner Excel File Analysis");
	console.log("=".repeat(60));
	console.log();

	// Check if file exists
	if (!fs.existsSync(EXCEL_PATH)) {
		console.error(`File not found: ${EXCEL_PATH}`);
		process.exit(1);
	}

	// Read the Excel file
	const workbook = XLSX.readFile(EXCEL_PATH);

	console.log("Sheet Names:", workbook.SheetNames);
	console.log();

	// Process each sheet
	for (const sheetName of workbook.SheetNames) {
		console.log(`\n${"=".repeat(60)}`);
		console.log(`Sheet: ${sheetName}`);
		console.log("=".repeat(60));

		const worksheet = workbook.Sheets[sheetName];
		const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

		if (data.length === 0) {
			console.log("  (empty sheet)");
			continue;
		}

		// Get headers (first row)
		const headers = data[0] as string[];
		console.log("\nColumns:");
		headers.forEach((header, idx) => {
			console.log(`  ${idx + 1}. ${header || "(empty)"}`);
		});

		// Get row count
		console.log(`\nTotal Rows: ${data.length - 1} (excluding header)`);

		// Sample first 3 data rows
		console.log("\nSample Data (first 3 rows):");
		for (let i = 1; i <= Math.min(3, data.length - 1); i++) {
			console.log(`\n  Row ${i}:`);
			const row = data[i] as unknown[];
			headers.forEach((header, idx) => {
				const value = row[idx];
				if (value !== undefined && value !== null && value !== "") {
					console.log(`    ${header}: ${value}`);
				}
			});
		}

		// Convert to JSON for full analysis
		const jsonData = XLSX.utils.sheet_to_json(worksheet);

		// Analyze unique values for certain columns
		const uniqueAnalysis: Record<string, Set<string>> = {};
		const columnsToAnalyze = ["Country", "Region", "Type", "Status", "Category", "Industry", "Sector"];

		jsonData.forEach((row: any) => {
			columnsToAnalyze.forEach(col => {
				// Check for various column name variations
				const variations = [col, col.toLowerCase(), col.toUpperCase(), col.replace(" ", "_")];
				for (const v of variations) {
					if (row[v] !== undefined && row[v] !== null && row[v] !== "") {
						if (!uniqueAnalysis[col]) uniqueAnalysis[col] = new Set();
						uniqueAnalysis[col].add(String(row[v]));
					}
				}
			});
		});

		console.log("\nUnique Values Analysis:");
		Object.entries(uniqueAnalysis).forEach(([col, values]) => {
			console.log(`\n  ${col}: (${values.size} unique values)`);
			Array.from(values).slice(0, 10).forEach(v => {
				console.log(`    - ${v}`);
			});
			if (values.size > 10) {
				console.log(`    ... and ${values.size - 10} more`);
			}
		});

		// Output full JSON for the first sheet
		if (sheetName === workbook.SheetNames[0]) {
			const outputPath = path.join(__dirname, "partner-data-sample.json");
			fs.writeFileSync(outputPath, JSON.stringify(jsonData.slice(0, 20), null, 2));
			console.log(`\nSample data saved to: ${outputPath}`);
		}
	}

	console.log("\n" + "=".repeat(60));
	console.log("Analysis Complete");
	console.log("=".repeat(60));
}

main().catch(console.error);
