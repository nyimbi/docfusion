/**
 * Import Opportunities Script
 *
 * Run this script to import opportunities from the local spreadsheet directory.
 * Usage: npx tsx scripts/import-opportunities.ts
 */

import { importFromDirectory, importFromFile } from "../lib/actions/import-opportunities";
import path from "path";

const OPPORTUNITIES_DIR = "/Users/nyimbiodero/src/pjs/work_docs/Business/Opportunities";

async function main() {
	console.log("Starting opportunity import...\n");
	console.log(`Source directory: ${OPPORTUNITIES_DIR}\n`);

	try {
		const results = await importFromDirectory(OPPORTUNITIES_DIR, {
			updateExisting: true,
			matchBy: "sourceIdAndFile",
		});

		console.log("\n========================================");
		console.log("Import Complete!");
		console.log("========================================\n");
		console.log(`Total files processed: ${results.processedFiles}/${results.totalFiles}`);
		console.log(`Total imported: ${results.totalImported}`);
		console.log(`Total updated: ${results.totalUpdated}`);
		console.log(`Total failed: ${results.totalFailed}`);

		console.log("\nFile-by-file results:");
		for (const fileResult of results.fileResults) {
			const icon = fileResult.status === "success" ? "✓" : "✗";
			console.log(`  ${icon} ${fileResult.filename}`);
			if (fileResult.status === "success") {
				console.log(`    Imported: ${fileResult.imported}, Updated: ${fileResult.updated}, Failed: ${fileResult.failed}`);
			} else {
				console.log(`    Error: ${fileResult.error}`);
			}
		}
	} catch (err) {
		console.error("Import failed:", err);
		process.exit(1);
	}
}

main();
