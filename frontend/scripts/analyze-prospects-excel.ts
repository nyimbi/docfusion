/**
 * Analyze Prospects Excel File
 *
 * Reads the Excel file to understand its structure before import
 * Run with: npx tsx scripts/analyze-prospects-excel.ts
 */

import * as XLSX from "./lib/xlsx-reader";
import * as fs from "fs";
import * as path from "path";

const EXCEL_PATH = "/Users/nyimbiodero/src/pjs/work_docs/Business/Partnerships/Datacraft_Lindela_1000_Prospects_Master.xlsx";

async function main() {
	console.log("=".repeat(70));
	console.log("Prospects Excel File Analysis");
	console.log("=".repeat(70));
	console.log(`\nFile: ${EXCEL_PATH}\n`);

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
		console.log(`\n${"=".repeat(70)}`);
		console.log(`Sheet: ${sheetName}`);
		console.log("=".repeat(70));

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
			console.log(`  ${(idx + 1).toString().padStart(2)}. ${header || "(empty)"}`);
		});

		// Get row count
		console.log(`\nTotal Rows: ${data.length - 1} (excluding header)`);

		// Sample first 5 data rows
		console.log("\nSample Data (first 5 rows):");
		for (let i = 1; i <= Math.min(5, data.length - 1); i++) {
			console.log(`\n  --- Row ${i} ---`);
			const row = data[i] as unknown[];
			headers.forEach((header, idx) => {
				const value = row[idx];
				if (value !== undefined && value !== null && value !== "") {
					const displayValue = String(value).length > 60
						? String(value).substring(0, 60) + "..."
						: String(value);
					console.log(`    ${header}: ${displayValue}`);
				}
			});
		}

		// Convert to JSON for analysis
		const jsonData = XLSX.utils.sheet_to_json(worksheet);

		// Analyze unique values for certain columns
		const uniqueAnalysis: Record<string, Set<string>> = {};
		const columnsToAnalyze = [
			"Country", "Region", "Province", "City", "State",
			"Type", "Status", "Category", "Industry", "Sector",
			"Size", "Company Size", "Employee Count",
			"Source", "Lead Source"
		];

		jsonData.forEach((row: any) => {
			// Check all headers for exact match (case-sensitive and variations)
			Object.keys(row).forEach(key => {
				const normalizedKey = key.toLowerCase().replace(/[_\s]+/g, " ").trim();
				const matchingColumn = columnsToAnalyze.find(col =>
					col.toLowerCase() === normalizedKey ||
					col.toLowerCase().replace(/[_\s]+/g, " ") === normalizedKey
				);

				if (matchingColumn || columnsToAnalyze.some(c => c.toLowerCase() === key.toLowerCase())) {
					const analysisKey = matchingColumn || key;
					if (!uniqueAnalysis[analysisKey]) uniqueAnalysis[analysisKey] = new Set();
					if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
						uniqueAnalysis[analysisKey].add(String(row[key]));
					}
				}
			});
		});

		console.log("\n" + "=".repeat(70));
		console.log("Unique Values Analysis:");
		console.log("=".repeat(70));

		Object.entries(uniqueAnalysis).forEach(([col, values]) => {
			console.log(`\n  ${col}: (${values.size} unique values)`);
			const sortedValues = Array.from(values).sort();
			sortedValues.slice(0, 15).forEach(v => {
				console.log(`    - ${v}`);
			});
			if (values.size > 15) {
				console.log(`    ... and ${values.size - 15} more`);
			}
		});

		// Output full column list for mapping reference
		console.log("\n" + "=".repeat(70));
		console.log("Complete Column List for Mapping:");
		console.log("=".repeat(70));
		headers.forEach((header, idx) => {
			if (header) {
				// Count non-empty values
				let nonEmptyCount = 0;
				jsonData.forEach((row: any) => {
					if (row[header] !== undefined && row[header] !== null && row[header] !== "") {
						nonEmptyCount++;
					}
				});
				const fillRate = ((nonEmptyCount / jsonData.length) * 100).toFixed(1);
				console.log(`  ${header.padEnd(40)} - ${fillRate}% populated (${nonEmptyCount}/${jsonData.length})`);
			}
		});

		// Output sample JSON for the first sheet
		if (sheetName === workbook.SheetNames[0]) {
			const outputPath = path.join(__dirname, "prospects-data-sample.json");
			fs.writeFileSync(outputPath, JSON.stringify(jsonData.slice(0, 10), null, 2));
			console.log(`\nSample data saved to: ${outputPath}`);
		}
	}

	console.log("\n" + "=".repeat(70));
	console.log("Analysis Complete");
	console.log("=".repeat(70));
}

main().catch(console.error);
