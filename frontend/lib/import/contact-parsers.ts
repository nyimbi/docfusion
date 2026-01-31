/**
 * Contact Parsing Utilities
 *
 * Multi-format contact import parsers for vCard (.vcf), CSV, and ABBU (Apple Address Book).
 * Provides unified ParsedContact output for consistent downstream processing.
 *
 * Supported formats:
 * - vCard 2.1, 3.0, 4.0 (using vcf library)
 * - CSV with auto-detection and custom field mapping (using papaparse)
 * - ABBU directories (collection of vCard files)
 */

// @ts-expect-error - vcf library doesn't have TypeScript definitions
import vCard from "vcf";
import Papa from "papaparse";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Unified parsed contact structure that all parsers output.
 * Maps to the contact creation input format.
 */
export interface ParsedContact {
	// Identity
	firstName?: string;
	lastName?: string;
	fullName?: string;
	salutation?: string;
	preferredName?: string;

	// Contact details
	email?: string;
	emailSecondary?: string;
	phone?: string;
	phoneMobile?: string;
	phoneWork?: string;
	phoneHome?: string;

	// Professional
	title?: string;
	company?: string;
	department?: string;
	role?: string;

	// Social
	linkedinUrl?: string;
	twitterUrl?: string;
	facebookUrl?: string;
	websiteUrl?: string;

	// Location
	country?: string;
	city?: string;
	state?: string;
	postalCode?: string;
	address?: string;

	// Personal
	birthday?: string; // YYYY-MM-DD format
	anniversary?: string;
	photo?: string; // Base64 or URL

	// Additional
	notes?: string;
	tags?: string[];

	// Raw data for debugging
	_rawData?: Record<string, unknown>;
}

/**
 * Result of a parse operation with statistics and any errors.
 */
export interface ParseResult {
	contacts: ParsedContact[];
	totalParsed: number;
	errors: Array<{ row?: number; message: string }>;
	warnings: Array<{ row?: number; message: string }>;
}

/**
 * CSV field mapping configuration.
 * Maps source column names to ParsedContact fields.
 */
export type FieldMapping = Record<string, keyof ParsedContact | null>;

/**
 * Detected field suggestions for CSV imports.
 */
export interface FieldDetectionResult {
	headers: string[];
	suggestedMapping: FieldMapping;
	confidence: Record<string, number>; // 0-1 confidence for each mapping
}

// ============================================================================
// VCARD PARSER
// ============================================================================

/**
 * Parse vCard (.vcf) content into contacts.
 *
 * Supports vCard versions 2.1, 3.0, and 4.0.
 * Handles single-contact and multi-contact files (separated by BEGIN:VCARD).
 *
 * @param content - Raw vCard file content as string
 * @returns ParseResult with extracted contacts
 *
 * @example
 * const result = await parseVCard(vcfFileContent);
 * console.log(result.contacts);
 */

/**
 * vCard object interface for the vcf library.
 * The library returns objects with a get() method for property access.
 */
interface VCardObject {
	get: (name: string) => unknown;
	[key: string]: unknown;
}

export async function parseVCard(content: string): Promise<ParseResult> {
	const errors: Array<{ row?: number; message: string }> = [];
	const warnings: Array<{ row?: number; message: string }> = [];
	const contacts: ParsedContact[] = [];

	try {
		// Split multi-contact vCard files
		const vcardBlocks = content
			.split(/(?=BEGIN:VCARD)/i)
			.filter((block) => block.trim().length > 0);

		for (let i = 0; i < vcardBlocks.length; i++) {
			try {
				const card = new vCard().parse(vcardBlocks[i]);
				const contact = extractContactFromVCard(card);

				if (contact.firstName || contact.lastName || contact.email) {
					contacts.push(contact);
				} else {
					warnings.push({
						row: i + 1,
						message: "Skipped contact with no name or email",
					});
				}
			} catch (err) {
				errors.push({
					row: i + 1,
					message: `Failed to parse vCard block: ${err instanceof Error ? err.message : "Unknown error"}`,
				});
			}
		}
	} catch (err) {
		errors.push({
			message: `Failed to parse vCard file: ${err instanceof Error ? err.message : "Unknown error"}`,
		});
	}

	return {
		contacts,
		totalParsed: contacts.length,
		errors,
		warnings,
	};
}


/**
 * Extract contact data from a parsed vCard object.
 */
function extractContactFromVCard(card: VCardObject): ParsedContact {
	const contact: ParsedContact = {};

	// Helper to get vCard property value
	const getProp = (name: string): string | undefined => {
		const prop = card.get(name);
		if (!prop) return undefined;
		if (typeof prop === "string") return prop;
		if (Array.isArray(prop) && prop.length > 0) {
			const first = prop[0];
			return typeof first === "string" ? first : String(first?.valueOf?.() ?? "");
		}
		const value = (prop as { valueOf?: () => unknown })?.valueOf?.();
		return value ? String(value) : undefined;
	};

	// Helper to get typed property (with TYPE parameter like home, work, cell)
	const getTypedProp = (name: string, type: string): string | undefined => {
		const props = card.get(name);
		if (!props) return undefined;
		const propArray = Array.isArray(props) ? props : [props];
		for (const prop of propArray) {
			const propType = prop?.type?.toLowerCase?.() || "";
			if (propType.includes(type.toLowerCase())) {
				return prop?.valueOf?.();
			}
		}
		return undefined;
	};

	// Name parsing (N property has structured format: family;given;middle;prefix;suffix)
	const n = getProp("n");
	if (n) {
		const nameParts = n.split(";");
		contact.lastName = nameParts[0]?.trim() || undefined;
		contact.firstName = nameParts[1]?.trim() || undefined;
		contact.salutation = nameParts[3]?.trim() || undefined;
	}

	// Full name (FN)
	contact.fullName = getProp("fn");

	// Nickname
	contact.preferredName = getProp("nickname");

	// Email addresses (prefer work, then pref, then first)
	const workEmail = getTypedProp("email", "work");
	const homeEmail = getTypedProp("email", "home");
	const prefEmail = getTypedProp("email", "pref");
	const anyEmail = getProp("email");

	contact.email = workEmail || prefEmail || anyEmail;
	if (contact.email !== homeEmail && homeEmail) {
		contact.emailSecondary = homeEmail;
	} else if (contact.email !== anyEmail && anyEmail && anyEmail !== contact.email) {
		contact.emailSecondary = anyEmail;
	}

	// Phone numbers
	contact.phoneMobile = getTypedProp("tel", "cell") || getTypedProp("tel", "mobile");
	contact.phoneWork = getTypedProp("tel", "work");
	contact.phoneHome = getTypedProp("tel", "home");
	contact.phone = contact.phoneMobile || contact.phoneWork || contact.phoneHome || getProp("tel");

	// Organization and title
	const org = getProp("org");
	if (org) {
		const orgParts = org.split(";");
		contact.company = orgParts[0]?.trim() || undefined;
		contact.department = orgParts[1]?.trim() || undefined;
	}
	contact.title = getProp("title");
	contact.role = getProp("role");

	// URLs
	const urls = card.get("url");
	if (urls) {
		const urlArray = Array.isArray(urls) ? urls : [urls];
		for (const url of urlArray) {
			const urlValue = typeof url === "string" ? url : url?.valueOf?.();
			if (urlValue) {
				if (urlValue.includes("linkedin.com")) {
					contact.linkedinUrl = urlValue;
				} else if (urlValue.includes("twitter.com") || urlValue.includes("x.com")) {
					contact.twitterUrl = urlValue;
				} else if (urlValue.includes("facebook.com")) {
					contact.facebookUrl = urlValue;
				} else if (!contact.websiteUrl) {
					contact.websiteUrl = urlValue;
				}
			}
		}
	}

	// Address (ADR has structured format)
	const adr = getProp("adr");
	if (adr) {
		const adrParts = adr.split(";");
		// ADR format: PO Box;Extended;Street;Locality;Region;Postal Code;Country
		contact.address = [adrParts[0], adrParts[1], adrParts[2]]
			.filter(Boolean)
			.join(" ")
			.trim() || undefined;
		contact.city = adrParts[3]?.trim() || undefined;
		contact.state = adrParts[4]?.trim() || undefined;
		contact.postalCode = adrParts[5]?.trim() || undefined;
		contact.country = adrParts[6]?.trim() || undefined;
	}

	// Birthday (BDAY)
	const bday = getProp("bday");
	if (bday) {
		// Try to parse various date formats
		const parsed = parseDate(bday);
		if (parsed) contact.birthday = parsed;
	}

	// Anniversary
	const anniversary = getProp("anniversary") || getProp("x-anniversary");
	if (anniversary) {
		const parsed = parseDate(anniversary);
		if (parsed) contact.anniversary = parsed;
	}

	// Photo (may be base64 or URL)
	const photo = getProp("photo");
	if (photo) {
		contact.photo = photo;
	}

	// Notes
	contact.notes = getProp("note");

	// Categories as tags
	const categories = getProp("categories");
	if (categories) {
		contact.tags = categories.split(",").map((t: string) => t.trim()).filter(Boolean);
	}

	return contact;
}

// ============================================================================
// CSV PARSER
// ============================================================================

/**
 * Parse CSV content into contacts with optional field mapping.
 *
 * Uses PapaParse for robust CSV handling including:
 * - Auto-detection of delimiters
 * - Quoted field support
 * - Header row detection
 * - Error recovery
 *
 * @param content - Raw CSV file content as string
 * @param mapping - Optional custom field mapping (source column → contact field)
 * @returns ParseResult with extracted contacts
 *
 * @example
 * // With auto-detected mapping
 * const result = await parseCSV(csvContent);
 *
 * // With custom mapping
 * const mapping = { "First": "firstName", "Last": "lastName" };
 * const result = await parseCSV(csvContent, mapping);
 */
export async function parseCSV(
	content: string,
	mapping?: FieldMapping
): Promise<ParseResult> {
	const errors: Array<{ row?: number; message: string }> = [];
	const warnings: Array<{ row?: number; message: string }> = [];
	const contacts: ParsedContact[] = [];

	return new Promise((resolve) => {
		Papa.parse<Record<string, string>>(content, {
			header: true,
			skipEmptyLines: true,
			transformHeader: (header) => header.trim(),
			complete: (results) => {
				// Auto-detect mapping if not provided
				const fieldMap = mapping || detectCSVFields(results.meta.fields || []).suggestedMapping;

				// Process each row
				for (let i = 0; i < results.data.length; i++) {
					const row = results.data[i];

					try {
						const contact = extractContactFromCSVRow(row, fieldMap);

						if (contact.firstName || contact.lastName || contact.email) {
							contacts.push(contact);
						} else {
							warnings.push({
								row: i + 2, // +2 for header row and 1-based indexing
								message: "Skipped row with no name or email",
							});
						}
					} catch (err) {
						errors.push({
							row: i + 2,
							message: `Failed to parse row: ${err instanceof Error ? err.message : "Unknown error"}`,
						});
					}
				}

				// Add PapaParse errors
				for (const error of results.errors) {
					errors.push({
						row: error.row ? error.row + 2 : undefined,
						message: error.message,
					});
				}

				resolve({
					contacts,
					totalParsed: contacts.length,
					errors,
					warnings,
				});
			},
			error: (error: Error) => {
				errors.push({ message: `CSV parsing failed: ${error.message}` });
				resolve({
					contacts: [],
					totalParsed: 0,
					errors,
					warnings,
				});
			},
		});
	});
}

/**
 * Extract contact from a CSV row using field mapping.
 */
function extractContactFromCSVRow(
	row: Record<string, string>,
	mapping: FieldMapping
): ParsedContact {
	const contact: ParsedContact = {};

	for (const [sourceField, targetField] of Object.entries(mapping)) {
		if (!targetField || !(sourceField in row)) continue;

		const value = row[sourceField]?.trim();
		if (!value) continue;

		// Handle special cases
		if (targetField === "tags") {
			contact.tags = value.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
		} else if (targetField === "birthday" || targetField === "anniversary") {
			const parsed = parseDate(value);
			if (parsed) contact[targetField] = parsed;
		} else {
			(contact as Record<string, unknown>)[targetField] = value;
		}
	}

	// If we have fullName but not firstName/lastName, try to split
	if (contact.fullName && !contact.firstName && !contact.lastName) {
		const { firstName, lastName } = splitFullName(contact.fullName);
		contact.firstName = firstName;
		contact.lastName = lastName;
	}

	return contact;
}

/**
 * Detect CSV field mappings from header names.
 *
 * Uses pattern matching and common variations to suggest mappings.
 *
 * @param headers - Array of CSV header names
 * @returns Detection result with suggested mapping and confidence scores
 *
 * @example
 * const result = detectCSVFields(["First Name", "Email Address", "Company"]);
 * // result.suggestedMapping = { "First Name": "firstName", "Email Address": "email", ... }
 */
export function detectCSVFields(headers: string[]): FieldDetectionResult {
	const mapping: FieldMapping = {};
	const confidence: Record<string, number> = {};

	// Field detection patterns (normalized header → contact field)
	const patterns: Array<{
		field: keyof ParsedContact;
		patterns: RegExp[];
		priority: number;
	}> = [
		// Name fields
		{
			field: "firstName",
			patterns: [
				/^first[_\s-]?name$/i,
				/^given[_\s-]?name$/i,
				/^first$/i,
				/^fname$/i,
				/^forename$/i,
			],
			priority: 1,
		},
		{
			field: "lastName",
			patterns: [
				/^last[_\s-]?name$/i,
				/^family[_\s-]?name$/i,
				/^surname$/i,
				/^last$/i,
				/^lname$/i,
			],
			priority: 1,
		},
		{
			field: "fullName",
			patterns: [
				/^full[_\s-]?name$/i,
				/^name$/i,
				/^display[_\s-]?name$/i,
				/^contact[_\s-]?name$/i,
			],
			priority: 2,
		},
		{
			field: "salutation",
			patterns: [/^salutation$/i, /^prefix$/i, /^title$/i, /^mr[_\s-]?ms$/i],
			priority: 3,
		},
		{
			field: "preferredName",
			patterns: [/^nickname$/i, /^preferred[_\s-]?name$/i, /^alias$/i],
			priority: 3,
		},

		// Email fields
		{
			field: "email",
			patterns: [
				/^e[_\s-]?mail$/i,
				/^email[_\s-]?address$/i,
				/^primary[_\s-]?email$/i,
				/^work[_\s-]?email$/i,
				/^business[_\s-]?email$/i,
			],
			priority: 1,
		},
		{
			field: "emailSecondary",
			patterns: [
				/^secondary[_\s-]?email$/i,
				/^personal[_\s-]?email$/i,
				/^home[_\s-]?email$/i,
				/^other[_\s-]?email$/i,
				/^email[_\s-]?2$/i,
			],
			priority: 2,
		},

		// Phone fields
		{
			field: "phone",
			patterns: [
				/^phone$/i,
				/^phone[_\s-]?number$/i,
				/^telephone$/i,
				/^primary[_\s-]?phone$/i,
			],
			priority: 1,
		},
		{
			field: "phoneMobile",
			patterns: [
				/^mobile$/i,
				/^mobile[_\s-]?phone$/i,
				/^cell$/i,
				/^cell[_\s-]?phone$/i,
				/^cellular$/i,
			],
			priority: 1,
		},
		{
			field: "phoneWork",
			patterns: [
				/^work[_\s-]?phone$/i,
				/^office[_\s-]?phone$/i,
				/^business[_\s-]?phone$/i,
				/^direct$/i,
			],
			priority: 2,
		},
		{
			field: "phoneHome",
			patterns: [/^home[_\s-]?phone$/i, /^home$/i, /^personal[_\s-]?phone$/i],
			priority: 3,
		},

		// Professional fields
		{
			field: "title",
			patterns: [
				/^job[_\s-]?title$/i,
				/^position$/i,
				/^designation$/i,
				/^role$/i,
			],
			priority: 1,
		},
		{
			field: "company",
			patterns: [
				/^company$/i,
				/^organization$/i,
				/^org$/i,
				/^employer$/i,
				/^company[_\s-]?name$/i,
				/^business$/i,
			],
			priority: 1,
		},
		{
			field: "department",
			patterns: [/^department$/i, /^dept$/i, /^division$/i, /^unit$/i],
			priority: 2,
		},

		// Social fields
		{
			field: "linkedinUrl",
			patterns: [
				/^linkedin$/i,
				/^linkedin[_\s-]?url$/i,
				/^linkedin[_\s-]?profile$/i,
			],
			priority: 1,
		},
		{
			field: "twitterUrl",
			patterns: [/^twitter$/i, /^twitter[_\s-]?url$/i, /^x$/i],
			priority: 2,
		},
		{
			field: "websiteUrl",
			patterns: [/^website$/i, /^url$/i, /^web$/i, /^homepage$/i],
			priority: 2,
		},

		// Location fields
		{
			field: "country",
			patterns: [/^country$/i, /^nation$/i, /^country[_\s-]?code$/i],
			priority: 1,
		},
		{
			field: "city",
			patterns: [/^city$/i, /^town$/i, /^locality$/i, /^municipality$/i],
			priority: 1,
		},
		{
			field: "state",
			patterns: [/^state$/i, /^province$/i, /^region$/i, /^county$/i],
			priority: 2,
		},
		{
			field: "postalCode",
			patterns: [
				/^postal[_\s-]?code$/i,
				/^zip$/i,
				/^zip[_\s-]?code$/i,
				/^postcode$/i,
			],
			priority: 2,
		},
		{
			field: "address",
			patterns: [
				/^address$/i,
				/^street$/i,
				/^street[_\s-]?address$/i,
				/^location$/i,
			],
			priority: 1,
		},

		// Personal fields
		{
			field: "birthday",
			patterns: [
				/^birthday$/i,
				/^birth[_\s-]?date$/i,
				/^dob$/i,
				/^date[_\s-]?of[_\s-]?birth$/i,
			],
			priority: 1,
		},
		{
			field: "anniversary",
			patterns: [/^anniversary$/i, /^wedding[_\s-]?date$/i],
			priority: 2,
		},

		// Other fields
		{
			field: "notes",
			patterns: [/^notes?$/i, /^comments?$/i, /^description$/i, /^memo$/i],
			priority: 1,
		},
		{
			field: "tags",
			patterns: [
				/^tags?$/i,
				/^categories?$/i,
				/^labels?$/i,
				/^groups?$/i,
			],
			priority: 1,
		},
	];

	// Try to match each header
	for (const header of headers) {
		const normalizedHeader = header.toLowerCase().trim();
		let bestMatch: { field: keyof ParsedContact; score: number } | null = null;

		for (const { field, patterns: fieldPatterns, priority } of patterns) {
			for (const pattern of fieldPatterns) {
				if (pattern.test(normalizedHeader)) {
					const score = 1 / priority; // Higher priority = higher score
					if (!bestMatch || score > bestMatch.score) {
						bestMatch = { field, score };
					}
					break;
				}
			}
		}

		if (bestMatch) {
			mapping[header] = bestMatch.field;
			confidence[header] = bestMatch.score;
		} else {
			mapping[header] = null; // Unknown field
			confidence[header] = 0;
		}
	}

	return {
		headers,
		suggestedMapping: mapping,
		confidence,
	};
}

// ============================================================================
// ABBU PARSER (Apple Address Book Backup)
// ============================================================================

/**
 * Parse ABBU (Apple Address Book Backup) directory.
 *
 * ABBU format is a directory containing individual vCard files.
 * Each .vcf file in the directory represents one contact.
 *
 * @param files - Array of File objects from the ABBU directory
 * @returns ParseResult with all extracted contacts
 *
 * @example
 * // From file input with webkitdirectory attribute
 * const files = Array.from(fileInput.files);
 * const result = await parseABBU(files);
 */
export async function parseABBU(files: File[]): Promise<ParseResult> {
	const errors: Array<{ row?: number; message: string }> = [];
	const warnings: Array<{ row?: number; message: string }> = [];
	const allContacts: ParsedContact[] = [];

	// Filter for .vcf files only
	const vcfFiles = files.filter(
		(file) =>
			file.name.toLowerCase().endsWith(".vcf") ||
			file.name.toLowerCase().endsWith(".vcard")
	);

	if (vcfFiles.length === 0) {
		errors.push({ message: "No vCard files found in ABBU directory" });
		return { contacts: [], totalParsed: 0, errors, warnings };
	}

	// Process each vCard file
	for (const file of vcfFiles) {
		try {
			const content = await file.text();
			const result = await parseVCard(content);

			allContacts.push(...result.contacts);

			// Add file context to errors/warnings
			for (const error of result.errors) {
				errors.push({ ...error, message: `${file.name}: ${error.message}` });
			}
			for (const warning of result.warnings) {
				warnings.push({ ...warning, message: `${file.name}: ${warning.message}` });
			}
		} catch (err) {
			errors.push({
				message: `Failed to read ${file.name}: ${err instanceof Error ? err.message : "Unknown error"}`,
			});
		}
	}

	return {
		contacts: allContacts,
		totalParsed: allContacts.length,
		errors,
		warnings,
	};
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse various date formats to YYYY-MM-DD.
 */
function parseDate(dateStr: string): string | undefined {
	if (!dateStr) return undefined;

	// Already in ISO format
	if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
		return dateStr;
	}

	// YYYYMMDD format (common in vCard)
	if (/^\d{8}$/.test(dateStr)) {
		return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
	}

	// Try standard Date parsing
	const date = new Date(dateStr);
	if (!isNaN(date.getTime())) {
		return date.toISOString().split("T")[0];
	}

	// MM/DD/YYYY or DD/MM/YYYY (try both)
	const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (slashMatch) {
		const [, a, b, year] = slashMatch;
		// Assume MM/DD/YYYY if first number > 12, otherwise ambiguous
		const month = parseInt(a) > 12 ? b : a;
		const day = parseInt(a) > 12 ? a : b;
		return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
	}

	return undefined;
}

/**
 * Split a full name into first and last name parts.
 */
function splitFullName(fullName: string): { firstName?: string; lastName?: string } {
	const parts = fullName.trim().split(/\s+/);

	if (parts.length === 0) return {};
	if (parts.length === 1) return { firstName: parts[0] };

	// Handle common suffixes
	const suffixes = ["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "phd", "md", "esq"];
	const lastPart = parts[parts.length - 1].toLowerCase();

	if (suffixes.includes(lastPart) && parts.length > 2) {
		return {
			firstName: parts[0],
			lastName: parts.slice(1).join(" "),
		};
	}

	return {
		firstName: parts[0],
		lastName: parts.slice(1).join(" "),
	};
}

/**
 * Detect file type from filename or content.
 */
export function detectFileType(
	filename: string,
	content?: string
): "vcf" | "csv" | "abbu" | "unknown" {
	const ext = filename.toLowerCase().split(".").pop();

	if (ext === "vcf" || ext === "vcard") return "vcf";
	if (ext === "csv") return "csv";
	if (ext === "abbu" || filename.toLowerCase().includes(".abbu")) return "abbu";

	// Try to detect from content
	if (content) {
		if (content.includes("BEGIN:VCARD")) return "vcf";
		// CSV typically has comma or tab separated values
		const firstLine = content.split("\n")[0];
		if (firstLine.includes(",") || firstLine.includes("\t")) return "csv";
	}

	return "unknown";
}

/**
 * Auto-parse content based on detected file type.
 */
export async function autoParseContacts(
	filename: string,
	content: string,
	mapping?: FieldMapping
): Promise<ParseResult> {
	const fileType = detectFileType(filename, content);

	switch (fileType) {
		case "vcf":
			return parseVCard(content);
		case "csv":
			return parseCSV(content, mapping);
		default:
			return {
				contacts: [],
				totalParsed: 0,
				errors: [{ message: `Unsupported file type: ${filename}` }],
				warnings: [],
			};
	}
}

/**
 * Validate a parsed contact for required fields.
 */
export function validateContact(contact: ParsedContact): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	// Must have at least a name or email
	if (!contact.firstName && !contact.lastName && !contact.fullName && !contact.email) {
		errors.push("Contact must have at least a name or email address");
	}

	// Validate email format if provided
	if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
		errors.push("Invalid primary email format");
	}
	if (contact.emailSecondary && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.emailSecondary)) {
		errors.push("Invalid secondary email format");
	}

	// Validate URL formats if provided
	if (contact.linkedinUrl && !isValidUrl(contact.linkedinUrl)) {
		errors.push("Invalid LinkedIn URL format");
	}
	if (contact.websiteUrl && !isValidUrl(contact.websiteUrl)) {
		errors.push("Invalid website URL format");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

function isValidUrl(str: string): boolean {
	try {
		new URL(str);
		return true;
	} catch {
		return false;
	}
}
