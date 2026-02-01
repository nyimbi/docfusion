#!/usr/bin/env npx tsx
/**
 * Import ABBU (Apple Address Book) contacts
 *
 * Usage: npx tsx scripts/import-abbu-contacts.ts "/path/to/contacts.abbu" <userId>
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { db } from "../lib/db";
import { contacts, contactImports } from "../lib/db/schema-crm";
import { parseVCard } from "../lib/import/contact-parsers";

async function importABBU(abbuPath: string, userId: string) {
	console.log(`\nImporting contacts from: ${abbuPath}`);
	console.log(`User ID: ${userId}\n`);

	// Find all vcf files recursively
	const vcfFiles: string[] = [];

	async function findVcfFiles(dir: string) {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				await findVcfFiles(fullPath);
			} else if (entry.name.toLowerCase().endsWith(".vcf")) {
				vcfFiles.push(fullPath);
			}
		}
	}

	await findVcfFiles(abbuPath);
	console.log(`Found ${vcfFiles.length} vCard files\n`);

	if (vcfFiles.length === 0) {
		console.log("No vCard files found in the ABBU directory");
		return;
	}

	// Create import record
	const [importRecord] = await db.insert(contactImports).values({
		filename: abbuPath.split("/").pop() || "contacts.abbu",
		fileType: "abbu",
		fileSize: 0,
		totalRecords: vcfFiles.length,
		status: "processing",
		importedBy: userId,
	}).returning();

	console.log(`Import ID: ${importRecord.id}\n`);

	let imported = 0;
	let skipped = 0;
	let failed = 0;
	const errors: Array<{ row: number; error: string }> = [];

	// Process each vcf file
	for (const vcfPath of vcfFiles) {
		try {
			const content = await readFile(vcfPath, "utf-8");
			const result = await parseVCard(content);

			for (const parsed of result.contacts) {
				if (!parsed.firstName && !parsed.lastName && !parsed.email) {
					skipped++;
					continue;
				}

				try {
					await db.insert(contacts).values({
						firstName: parsed.firstName || "Unknown",
						lastName: parsed.lastName || "",
						fullName: parsed.fullName || `${parsed.firstName || ""} ${parsed.lastName || ""}`.trim(),
						salutation: parsed.salutation,
						preferredName: parsed.preferredName,
						email: parsed.email,
						emailSecondary: parsed.emailSecondary,
						phone: parsed.phone,
						phoneMobile: parsed.phoneMobile,
						phoneWork: parsed.phoneWork,
						title: parsed.title,
						department: parsed.department,
						linkedinUrl: parsed.linkedinUrl,
						country: parsed.country,
						city: parsed.city,
						birthday: parsed.birthday,
						notes: parsed.notes,
						tags: [],
						ownerId: userId,
						visibility: "private",
						sharedWith: [],
					});
					imported++;
				} catch (err) {
					failed++;
					errors.push({
						row: 0,
						error: err instanceof Error ? err.message : "Unknown error",
					});
				}
			}
		} catch (err) {
			failed++;
			errors.push({
				row: 0,
				error: err instanceof Error ? err.message : "Failed to read file",
			});
		}

		// Progress indicator
		if ((imported + skipped + failed) % 50 === 0) {
			process.stdout.write(".");
		}
	}

	console.log("\n");

	// Update import record
	await db.update(contactImports).set({
		status: "completed",
		importedRecords: imported,
		skippedRecords: skipped,
		failedRecords: failed,
		errors: errors.slice(0, 100), // Keep first 100 errors
		completedAt: new Date(),
	}).where(eq(contactImports.id, importRecord.id));

	console.log("=== Import Complete ===");
	console.log(`Imported: ${imported}`);
	console.log(`Skipped:  ${skipped}`);
	console.log(`Failed:   ${failed}`);

	if (errors.length > 0) {
		console.log(`\nFirst few errors:`);
		errors.slice(0, 5).forEach((e) => {
			console.log(`  - Row ${e.row}: ${e.error}`);
		});
	}
}

import { eq } from "drizzle-orm";

// Get args
const [,, abbuPath, userId] = process.argv;

if (!abbuPath || !userId) {
	console.log("Usage: npx tsx scripts/import-abbu-contacts.ts <abbu-path> <user-id>");
	console.log("\nExample:");
	console.log('  npx tsx scripts/import-abbu-contacts.ts "/Users/me/Contacts.abbu" "user_123"');
	process.exit(1);
}

importABBU(abbuPath, userId)
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Import failed:", err);
		process.exit(1);
	});
