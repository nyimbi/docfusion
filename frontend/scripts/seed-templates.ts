/**
 * Seed Templates Script
 *
 * Run with: npx tsx scripts/seed-templates.ts
 *
 * This script seeds the database with all template categories and templates.
 */

import { seedTemplates } from "../lib/db/seed-templates";

async function main() {
	console.log("=".repeat(60));
	console.log("DocFusion Template Seeding Script");
	console.log("=".repeat(60));
	console.log();

	try {
		const result = await seedTemplates();

		console.log();
		console.log("=".repeat(60));
		console.log("Seeding Complete!");
		console.log(`  Categories: ${result.categories}`);
		console.log(`  Templates:  ${result.templates}`);
		if ("snippets" in result) {
			console.log(`  Snippets:   ${result.snippets}`);
		}
		console.log("=".repeat(60));

		process.exit(0);
	} catch (error) {
		console.error("Seeding failed:", error);
		process.exit(1);
	}
}

main();
