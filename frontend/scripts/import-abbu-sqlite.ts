#!/usr/bin/env npx tsx
/**
 * Import ABBU (Apple Address Book) contacts from SQLite database
 *
 * Usage: npx tsx scripts/import-abbu-sqlite.ts "/path/to/contacts.abbu" <userId>
 */

import Database from "better-sqlite3";
import { join } from "path";
import { db } from "../lib/db";
import { contacts, contactImports } from "../lib/db/schema-crm";
import { eq } from "drizzle-orm";

interface ABCDRecord {
	ZFIRSTNAME: string | null;
	ZLASTNAME: string | null;
	ZNICKNAME: string | null;
	ZORGANIZATION: string | null;
	ZJOBTITLE: string | null;
	ZDEPARTMENT: string | null;
	ZBIRTHDAY: number | null;
	ZNOTETEXT: string | null;
}

interface ABCDEmail {
	ZPERSON: number;
	ZADDRESSNORMALIZED: string | null;
	ZLABEL: string | null;
}

interface ABCDPhone {
	ZPERSON: number;
	ZFULLNUMBER: string | null;
	ZLABEL: string | null;
}

async function importABBUSqlite(abbuPath: string, userId: string) {
	console.log(`\nImporting contacts from: ${abbuPath}`);
	console.log(`User ID: ${userId}\n`);

	const dbPath = join(abbuPath, "AddressBook-v22.abcddb");
	const sqlite = new Database(dbPath, { readonly: true });

	// Get all contacts (persons)
	const recordsQuery = sqlite.prepare(`
		SELECT
			Z_PK, ZFIRSTNAME, ZLASTNAME, ZNICKNAME, ZORGANIZATION,
			ZJOBTITLE, ZDEPARTMENT, ZBIRTHDAY
		FROM ZABCDRECORD
		WHERE ZFIRSTNAME IS NOT NULL OR ZLASTNAME IS NOT NULL OR ZORGANIZATION IS NOT NULL
	`);
	const records = recordsQuery.all() as (ABCDRecord & { Z_PK: number })[];

	console.log(`Found ${records.length} contacts\n`);

	if (records.length === 0) {
		console.log("No contacts found");
		sqlite.close();
		return;
	}

	// Get emails
	const emailsQuery = sqlite.prepare(`
		SELECT ZOWNER, ZADDRESSNORMALIZED, ZLABEL
		FROM ZABCDEMAILADDRESS
		WHERE ZADDRESSNORMALIZED IS NOT NULL
	`);
	const emailRows = emailsQuery.all() as { ZOWNER: number; ZADDRESSNORMALIZED: string; ZLABEL: string | null }[];
	const emailMap = new Map<number, { primary?: string; secondary?: string }>();
	for (const row of emailRows) {
		if (!emailMap.has(row.ZOWNER)) {
			emailMap.set(row.ZOWNER, { primary: row.ZADDRESSNORMALIZED });
		} else {
			const existing = emailMap.get(row.ZOWNER)!;
			if (!existing.secondary) {
				existing.secondary = row.ZADDRESSNORMALIZED;
			}
		}
	}

	// Get phones
	const phonesQuery = sqlite.prepare(`
		SELECT ZOWNER, ZFULLNUMBER, ZLABEL
		FROM ZABCDPHONENUMBER
		WHERE ZFULLNUMBER IS NOT NULL
	`);
	const phoneRows = phonesQuery.all() as { ZOWNER: number; ZFULLNUMBER: string; ZLABEL: string | null }[];
	const phoneMap = new Map<number, { phone?: string; mobile?: string; work?: string }>();
	for (const row of phoneRows) {
		const label = (row.ZLABEL || "").toLowerCase();
		const existing = phoneMap.get(row.ZOWNER) || {};

		if (label.includes("mobile") || label.includes("cell") || label.includes("iphone")) {
			existing.mobile = existing.mobile || row.ZFULLNUMBER;
		} else if (label.includes("work") || label.includes("business")) {
			existing.work = existing.work || row.ZFULLNUMBER;
		} else {
			existing.phone = existing.phone || row.ZFULLNUMBER;
		}

		phoneMap.set(row.ZOWNER, existing);
	}

	// Get notes
	const notesQuery = sqlite.prepare(`
		SELECT ZCONTACT, ZTEXT FROM ZABCDNOTE WHERE ZTEXT IS NOT NULL
	`);
	const noteRows = notesQuery.all() as { ZCONTACT: number; ZTEXT: string }[];
	const noteMap = new Map<number, string>();
	for (const row of noteRows) {
		noteMap.set(row.ZCONTACT, row.ZTEXT);
	}

	// Create import record
	const [importRecord] = await db.insert(contactImports).values({
		filename: abbuPath.split("/").pop() || "contacts.abbu",
		fileType: "abbu",
		fileSize: 0,
		totalRecords: records.length,
		status: "processing",
		importedBy: userId,
	}).returning();

	console.log(`Import ID: ${importRecord.id}\n`);

	let imported = 0;
	let skipped = 0;
	let failed = 0;
	const errors: Array<{ row: number; error: string }> = [];

	for (const record of records) {
		const emails = emailMap.get(record.Z_PK);
		const phones = phoneMap.get(record.Z_PK);
		const note = noteMap.get(record.Z_PK);

		const firstName = record.ZFIRSTNAME?.trim() || "";
		const lastName = record.ZLASTNAME?.trim() || "";
		const fullName = [firstName, lastName].filter(Boolean).join(" ") || record.ZORGANIZATION || "Unknown";

		if (!firstName && !lastName && !emails?.primary) {
			skipped++;
			continue;
		}

		try {
			await db.insert(contacts).values({
				firstName: firstName || "Unknown",
				lastName: lastName || "",
				fullName,
				preferredName: record.ZNICKNAME || undefined,
				email: emails?.primary,
				emailSecondary: emails?.secondary,
				phone: phones?.phone,
				phoneMobile: phones?.mobile,
				phoneWork: phones?.work,
				title: record.ZJOBTITLE || undefined,
				department: record.ZDEPARTMENT || undefined,
				notes: note,
				tags: [],
				ownerId: userId,
				visibility: "private",
				sharedWith: [],
			});
			imported++;
		} catch (err) {
			failed++;
			errors.push({
				row: record.Z_PK,
				error: err instanceof Error ? err.message : "Unknown error",
			});
		}

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
		errors: errors.slice(0, 100),
		completedAt: new Date(),
	}).where(eq(contactImports.id, importRecord.id));

	sqlite.close();

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

// Get args
const [,, abbuPath, userId] = process.argv;

if (!abbuPath || !userId) {
	console.log("Usage: npx tsx scripts/import-abbu-sqlite.ts <abbu-path> <user-id>");
	process.exit(1);
}

importABBUSqlite(abbuPath, userId)
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Import failed:", err);
		process.exit(1);
	});
