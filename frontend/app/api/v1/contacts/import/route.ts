/**
 * Contact Import API Route
 *
 * Handles multi-format contact imports (vCard, CSV, ABBU).
 * All imported contacts are owned by the importing user.
 *
 * Endpoints:
 * - POST: Upload and parse file, return preview
 * - PUT: Confirm import with optional field mapping modifications
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contactImports, contacts, accounts } from "@/lib/db/schema-crm";
import { eq, ilike, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
	autoParseContacts,
	parseCSV,
	detectCSVFields,
	type ParsedContact,
	type FieldMapping,
} from "@/lib/import/contact-parsers";
import type { ContactVisibility } from "@/lib/actions/crm/contacts";

/**
 * Get authenticated user context.
 */
async function getUserContext() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) return null;
	return {
		userId: session.user.id,
		organizationId: session.user.organizationId ?? undefined,
	};
}

// ============================================================================
// POST - Upload and Parse File (Preview)
// ============================================================================

/**
 * Upload a contact file and return parsed preview.
 *
 * Accepts multipart/form-data with:
 * - file: The contact file (.vcf, .csv)
 * - mapping: Optional JSON string with custom field mapping for CSV
 *
 * Returns:
 * - importId: Temporary import ID for confirmation
 * - contacts: Parsed contacts preview (first 50)
 * - totalCount: Total parsed contacts
 * - headers: CSV headers (if CSV file)
 * - suggestedMapping: Auto-detected field mapping (if CSV)
 * - errors/warnings: Any parsing issues
 */
export async function POST(request: NextRequest) {
	try {
		const userContext = await getUserContext();
		if (!userContext) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const formData = await request.formData();
		const file = formData.get("file") as File | null;
		const mappingJson = formData.get("mapping") as string | null;

		if (!file) {
			return NextResponse.json(
				{ error: "No file provided" },
				{ status: 400 }
			);
		}

		// Validate file type
		const filename = file.name;
		const ext = filename.toLowerCase().split(".").pop();
		if (!["vcf", "vcard", "csv"].includes(ext || "")) {
			return NextResponse.json(
				{ error: `Unsupported file type: ${ext}. Supported: .vcf, .csv` },
				{ status: 400 }
			);
		}

		// Read file content
		const content = await file.text();

		// Parse custom mapping if provided
		let mapping: FieldMapping | undefined;
		if (mappingJson) {
			try {
				mapping = JSON.parse(mappingJson);
			} catch {
				return NextResponse.json(
					{ error: "Invalid field mapping JSON" },
					{ status: 400 }
				);
			}
		}

		// Parse the file
		const parseResult = await autoParseContacts(filename, content, mapping);

		// For CSV files, also return headers and suggested mapping
		let csvInfo: {
			headers?: string[];
			suggestedMapping?: FieldMapping;
			confidence?: Record<string, number>;
		} = {};

		if (ext === "csv") {
			// Re-detect fields for the response
			const firstLine = content.split("\n")[0];
			const headers = firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
			const detection = detectCSVFields(headers);
			csvInfo = {
				headers: detection.headers,
				suggestedMapping: detection.suggestedMapping,
				confidence: detection.confidence,
			};
		}

		// Transform errors to schema format (row is required, use 0 as default; error instead of message)
		const schemaErrors = parseResult.errors.map((e) => ({
			row: e.row ?? 0,
			error: e.message,
		}));

		// Create import record in pending state (owned by current user)
		const importResult = await db
			.insert(contactImports)
			.values({
				filename: file.name,
				fileType: ext === "vcard" ? "vcf" : (ext || "unknown"),
				fileSize: file.size,
				totalRecords: parseResult.totalParsed,
				status: "pending",
				fieldMapping: (mapping || csvInfo.suggestedMapping) as Record<string, string> | undefined,
				errors: schemaErrors,
				importedBy: userContext.userId,
				organizationId: userContext.organizationId,
			})
			.returning();
		const importRecord = importResult[0];

		// Enrich preview contacts with account lookup
		const previewContacts = await enrichContactsPreview(
			parseResult.contacts.slice(0, 50)
		);

		return NextResponse.json({
			success: true,
			importId: importRecord.id,
			preview: {
				contacts: previewContacts,
				totalCount: parseResult.totalParsed,
				previewCount: previewContacts.length,
			},
			csv: ext === "csv" ? csvInfo : undefined,
			parsing: {
				errors: parseResult.errors,
				warnings: parseResult.warnings,
				errorCount: parseResult.errors.length,
				warningCount: parseResult.warnings.length,
			},
		});
	} catch (error) {
		console.error("Contact import parse error:", error);
		return NextResponse.json(
			{
				error: "Failed to parse contact file",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

// ============================================================================
// PUT - Confirm Import
// ============================================================================

/**
 * Confirm and execute the import.
 *
 * Request body:
 * - importId: The import ID from the preview step
 * - fileContent: The file content (base64 encoded)
 * - mapping: Final field mapping to use (for CSV)
 * - options: Import options
 *   - updateExisting: Update contacts if email matches (default: true)
 *   - skipDuplicates: Skip instead of update (default: false)
 *   - defaultAccountId: Account to assign standalone contacts to
 *   - defaultTags: Tags to add to all imported contacts
 *
 * Returns:
 * - importId: The import record ID
 * - stats: Import statistics (imported, updated, skipped, failed)
 * - errors: Any import errors
 */
export async function PUT(request: NextRequest) {
	try {
		const userContext = await getUserContext();
		if (!userContext) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = await request.json();
		const {
			importId,
			fileContent,
			mapping,
			options = {},
		} = body as {
			importId: string;
			fileContent: string;
			mapping?: FieldMapping;
			options?: {
				updateExisting?: boolean;
				skipDuplicates?: boolean;
				defaultAccountId?: string;
				defaultTags?: string[];
				visibility?: ContactVisibility;
				sharedWith?: string[];
			};
		};

		if (!importId || !fileContent) {
			return NextResponse.json(
				{ error: "Missing importId or fileContent" },
				{ status: 400 }
			);
		}

		// Get import record (only if owned by current user)
		const importRecord = await db.query.contactImports.findFirst({
			where: and(
				eq(contactImports.id, importId),
				eq(contactImports.importedBy, userContext.userId)
			),
		});

		if (!importRecord) {
			return NextResponse.json(
				{ error: "Import not found or access denied" },
				{ status: 404 }
			);
		}

		if (importRecord.status !== "pending") {
			return NextResponse.json(
				{ error: `Import already ${importRecord.status}` },
				{ status: 400 }
			);
		}

		// Update status to processing
		await db
			.update(contactImports)
			.set({ status: "processing" })
			.where(eq(contactImports.id, importId));

		// Decode and parse file content
		const content = Buffer.from(fileContent, "base64").toString("utf-8");
		const finalMapping = mapping || (importRecord.fieldMapping as FieldMapping | undefined);

		const parseResult = await autoParseContacts(
			importRecord.filename,
			content,
			finalMapping
		);

		// Process imports
		const stats = {
			imported: 0,
			updated: 0,
			skipped: 0,
			failed: 0,
		};
		const importErrors: Array<{ row: number; error: string; contact?: string }> = [];

		for (let i = 0; i < parseResult.contacts.length; i++) {
			const parsed = parseResult.contacts[i];

			try {
				const result = await importSingleContact(parsed, {
					updateExisting: options.updateExisting ?? true,
					skipDuplicates: options.skipDuplicates ?? false,
					defaultAccountId: options.defaultAccountId,
					defaultTags: options.defaultTags,
					visibility: options.visibility ?? "private",
					sharedWith: options.sharedWith ?? [],
					ownerId: userContext.userId,
					organizationId: userContext.organizationId,
				});

				if (result.action === "created") stats.imported++;
				else if (result.action === "updated") stats.updated++;
				else if (result.action === "skipped") stats.skipped++;
			} catch (error) {
				stats.failed++;
				importErrors.push({
					row: i + 1,
					error: error instanceof Error ? error.message : "Unknown error",
					contact: `${parsed.firstName || ""} ${parsed.lastName || ""}`.trim() || parsed.email,
				});
			}
		}

		// Update import record with final stats
		await db
			.update(contactImports)
			.set({
				status: "completed",
				importedRecords: stats.imported,
				updatedRecords: stats.updated,
				skippedRecords: stats.skipped,
				failedRecords: stats.failed,
				errors: importErrors,
				fieldMapping: finalMapping as Record<string, string> | undefined,
				importOptions: {
					updateExisting: options.updateExisting ?? true,
					skipDuplicates: options.skipDuplicates ?? false,
					defaultAccountId: options.defaultAccountId,
					defaultTags: options.defaultTags,
					defaultVisibility: options.visibility,
					sharedWith: options.sharedWith,
				},
				completedAt: new Date(),
			})
			.where(eq(contactImports.id, importId));

		return NextResponse.json({
			success: true,
			importId,
			stats,
			errors: importErrors,
		});
	} catch (error) {
		console.error("Contact import error:", error);
		return NextResponse.json(
			{
				error: "Failed to import contacts",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface ImportOptions {
	updateExisting: boolean;
	skipDuplicates: boolean;
	defaultAccountId?: string;
	defaultTags?: string[];
	visibility: ContactVisibility;
	sharedWith: string[];
	ownerId: string;
	organizationId?: string;
}

interface ImportSingleResult {
	action: "created" | "updated" | "skipped";
	contactId: string;
}

/**
 * Import a single contact with upsert logic.
 * Only updates contacts owned by the importing user.
 */
async function importSingleContact(
	parsed: ParsedContact,
	options: ImportOptions
): Promise<ImportSingleResult> {
	if (!parsed.firstName && !parsed.lastName && !parsed.email) {
		throw new Error("Contact must have name or email");
	}

	// Look up existing contact by email ONLY if owned by this user
	let existingContact;
	if (parsed.email) {
		existingContact = await db.query.contacts.findFirst({
			where: and(
				eq(contacts.email, parsed.email),
				eq(contacts.ownerId, options.ownerId)
			),
		});
	}

	if (existingContact) {
		if (options.skipDuplicates) {
			return { action: "skipped", contactId: existingContact.id };
		}

		if (options.updateExisting) {
			await db.update(contacts).set({
				firstName: parsed.firstName || existingContact.firstName,
				lastName: parsed.lastName || existingContact.lastName,
				fullName: parsed.fullName || `${parsed.firstName || ""} ${parsed.lastName || ""}`.trim(),
				salutation: parsed.salutation || existingContact.salutation,
				preferredName: parsed.preferredName || existingContact.preferredName,
				title: parsed.title || existingContact.title,
				department: parsed.department || existingContact.department,
				emailSecondary: parsed.emailSecondary || existingContact.emailSecondary,
				phone: parsed.phone || existingContact.phone,
				phoneMobile: parsed.phoneMobile || existingContact.phoneMobile,
				phoneWork: parsed.phoneWork || existingContact.phoneWork,
				linkedinUrl: parsed.linkedinUrl || existingContact.linkedinUrl,
				country: parsed.country || existingContact.country,
				city: parsed.city || existingContact.city,
				birthday: parsed.birthday || existingContact.birthday,
				notes: parsed.notes
					? existingContact.notes ? `${existingContact.notes}\n\n--- Imported ---\n${parsed.notes}` : parsed.notes
					: existingContact.notes,
				tags: options.defaultTags
					? [...new Set([...(existingContact.tags as string[] || []), ...options.defaultTags])]
					: existingContact.tags,
				updatedAt: new Date(),
			}).where(eq(contacts.id, existingContact.id));

			return { action: "updated", contactId: existingContact.id };
		}
	}

	// Look up account by company name if provided
	let accountId = options.defaultAccountId;
	if (parsed.company && !accountId) {
		const account = await db.query.accounts.findFirst({
			where: ilike(accounts.name, parsed.company),
			columns: { id: true },
		});
		if (account) accountId = account.id;
	}

	// Create new contact owned by the importing user
	const [newContact] = await db.insert(contacts).values({
		accountId,
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
		tags: options.defaultTags || [],
		// Privacy fields
		ownerId: options.ownerId,
		visibility: options.visibility,
		sharedWith: options.visibility === "shared" ? options.sharedWith : [],
		organizationId: options.organizationId,
	}).returning({ id: contacts.id });

	return { action: "created", contactId: newContact.id };
}

/**
 * Enrich preview contacts with account lookup.
 */
async function enrichContactsPreview(
	parsedContacts: ParsedContact[]
): Promise<Array<ParsedContact & { existingAccount?: string; existingContact?: boolean }>> {
	const enriched = [];

	for (const contact of parsedContacts) {
		const result: ParsedContact & { existingAccount?: string; existingContact?: boolean } = { ...contact };

		// Check if contact exists
		if (contact.email) {
			const existing = await db.query.contacts.findFirst({
				where: eq(contacts.email, contact.email),
				columns: { id: true },
			});
			result.existingContact = !!existing;
		}

		// Look up potential account
		if (contact.company) {
			const account = await db.query.accounts.findFirst({
				where: ilike(accounts.name, contact.company),
				columns: { name: true },
			});
			if (account) result.existingAccount = account.name;
		}

		enriched.push(result);
	}

	return enriched;
}
