"use server";

/**
 * Bibliography Server Actions
 *
 * Handles CRUD operations for bibliography entries,
 * document citations, and citation formatting.
 */

import { db } from "@/lib/db";
import {
	bibliographyEntries,
	documentCitations,
	type BibliographyEntryRow,
	type BibliographyEntryType,
	type CitationStyleType,
} from "@/lib/db/schema-bibliography";
import { eq, and, desc, asc, ilike, or, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/auth-utils";
import { logger } from "@/lib/utils/logger";

// ============================================================================
// Types
// ============================================================================

export interface BibliographyEntry {
	id: string;
	citeKey: string;
	type: BibliographyEntryType;
	title: string;
	authors: string[];
	editors?: string[];
	journal?: string;
	booktitle?: string;
	publisher?: string;
	year: number;
	month?: string;
	volume?: string;
	number?: string;
	pages?: string;
	edition?: string;
	doi?: string;
	isbn?: string;
	url?: string;
	abstract?: string;
	keywords?: string[];
	note?: string;
	address?: string;
	institution?: string;
	school?: string;
	citationCount: number;
	lastCitedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateEntryInput {
	citeKey: string;
	entryType: BibliographyEntryType;
	title: string;
	authors: string[];
	editors?: string[];
	journal?: string;
	booktitle?: string;
	publisher?: string;
	year: number;
	month?: string;
	volume?: string;
	number?: string;
	pages?: string;
	edition?: string;
	doi?: string;
	isbn?: string;
	url?: string;
	abstract?: string;
	keywords?: string[];
	note?: string;
	address?: string;
	institution?: string;
	school?: string;
}

export interface UpdateEntryInput extends Partial<CreateEntryInput> {
	id: string;
}

export interface BibliographyStats {
	totalEntries: number;
	totalCitations: number;
	mostCitedEntry: BibliographyEntry | null;
	entriesByType: Record<string, number>;
	entriesByYear: Record<number, number>;
	recentAdditions: BibliographyEntry[];
}

interface ActionResult<T> {
	success: boolean;
	data?: T;
	error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapRowToEntry(row: BibliographyEntryRow): BibliographyEntry {
	return {
		id: row.id,
		citeKey: row.citeKey,
		type: row.entryType as BibliographyEntryType,
		title: row.title,
		authors: (row.authors ?? []) as string[],
		editors: row.editors as string[] | undefined,
		journal: row.journal ?? undefined,
		booktitle: row.booktitle ?? undefined,
		publisher: row.publisher ?? undefined,
		year: row.year,
		month: row.month ?? undefined,
		volume: row.volume ?? undefined,
		number: row.number ?? undefined,
		pages: row.pages ?? undefined,
		edition: row.edition ?? undefined,
		doi: row.doi ?? undefined,
		isbn: row.isbn ?? undefined,
		url: row.url ?? undefined,
		abstract: row.abstract ?? undefined,
		keywords: row.keywords as string[] | undefined,
		note: row.note ?? undefined,
		address: row.address ?? undefined,
		institution: row.institution ?? undefined,
		school: row.school ?? undefined,
		citationCount: row.citationCount,
		lastCitedAt: row.lastCitedAt ?? undefined,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

// ============================================================================
// Entry CRUD Operations
// ============================================================================

/**
 * List all bibliography entries with optional filtering
 */
export async function listBibliographyEntries(options?: {
	search?: string;
	type?: BibliographyEntryType;
	sortBy?: "citeKey" | "year" | "citations" | "title" | "updatedAt";
	sortOrder?: "asc" | "desc";
	limit?: number;
	offset?: number;
}): Promise<ActionResult<{ entries: BibliographyEntry[]; total: number }>> {
	try {
		const {
			search,
			type,
			sortBy = "citeKey",
			sortOrder = "asc",
			limit = 100,
			offset = 0,
		} = options ?? {};

		// Build conditions
		const conditions = [];

		if (search) {
			const searchTerm = `%${search}%`;
			conditions.push(
				or(
					ilike(bibliographyEntries.title, searchTerm),
					ilike(bibliographyEntries.citeKey, searchTerm),
					sql`${bibliographyEntries.authors}::text ILIKE ${searchTerm}`
				)
			);
		}

		if (type) {
			conditions.push(eq(bibliographyEntries.entryType, type));
		}

		// Build order by
		const orderByMap = {
			citeKey: bibliographyEntries.citeKey,
			year: bibliographyEntries.year,
			citations: bibliographyEntries.citationCount,
			title: bibliographyEntries.title,
			updatedAt: bibliographyEntries.updatedAt,
		};
		const orderColumn = orderByMap[sortBy];
		const orderFn = sortOrder === "asc" ? asc : desc;

		// Query with conditions
		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const [entries, countResult] = await Promise.all([
			db.query.bibliographyEntries.findMany({
				where: whereClause,
				orderBy: [orderFn(orderColumn)],
				limit,
				offset,
			}),
			db
				.select({ count: sql<number>`count(*)` })
				.from(bibliographyEntries)
				.where(whereClause),
		]);

		return {
			success: true,
			data: {
				entries: entries.map(mapRowToEntry),
				total: Number(countResult[0]?.count ?? 0),
			},
		};
	} catch (error) {
		logger.error("Failed to list bibliography entries:", error);
		return { success: false, error: "Failed to list bibliography entries" };
	}
}

/**
 * Get a single bibliography entry by ID
 */
export async function getBibliographyEntry(id: string): Promise<ActionResult<BibliographyEntry>> {
	try {
		const entry = await db.query.bibliographyEntries.findFirst({
			where: eq(bibliographyEntries.id, id),
		});

		if (!entry) {
			return { success: false, error: "Entry not found" };
		}

		return { success: true, data: mapRowToEntry(entry) };
	} catch (error) {
		logger.error("Failed to get bibliography entry:", error);
		return { success: false, error: "Failed to get bibliography entry" };
	}
}

/**
 * Create a new bibliography entry
 */
export async function createBibliographyEntry(
	input: CreateEntryInput
): Promise<ActionResult<BibliographyEntry>> {
	try {
		const userId = await getCurrentUserId();

		const [inserted] = await db
			.insert(bibliographyEntries)
			.values({
				citeKey: input.citeKey,
				entryType: input.entryType,
				title: input.title,
				authors: input.authors,
				editors: input.editors,
				journal: input.journal,
				booktitle: input.booktitle,
				publisher: input.publisher,
				year: input.year,
				month: input.month,
				volume: input.volume,
				number: input.number,
				pages: input.pages,
				edition: input.edition,
				doi: input.doi,
				isbn: input.isbn,
				url: input.url,
				abstract: input.abstract,
				keywords: input.keywords,
				note: input.note,
				address: input.address,
				institution: input.institution,
				school: input.school,
				createdBy: userId ?? undefined,
			})
			.returning();

		revalidatePath("/documents");

		return { success: true, data: mapRowToEntry(inserted) };
	} catch (error) {
		logger.error("Failed to create bibliography entry:", error);
		return { success: false, error: "Failed to create bibliography entry" };
	}
}

/**
 * Update an existing bibliography entry
 */
export async function updateBibliographyEntry(
	input: UpdateEntryInput
): Promise<ActionResult<BibliographyEntry>> {
	try {
		const { id, ...updateData } = input;

		const [updated] = await db
			.update(bibliographyEntries)
			.set({
				...updateData,
				entryType: updateData.entryType,
				updatedAt: new Date(),
			})
			.where(eq(bibliographyEntries.id, id))
			.returning();

		if (!updated) {
			return { success: false, error: "Entry not found" };
		}

		revalidatePath("/documents");

		return { success: true, data: mapRowToEntry(updated) };
	} catch (error) {
		logger.error("Failed to update bibliography entry:", error);
		return { success: false, error: "Failed to update bibliography entry" };
	}
}

/**
 * Delete a bibliography entry
 */
export async function deleteBibliographyEntry(id: string): Promise<ActionResult<void>> {
	try {
		const result = await db
			.delete(bibliographyEntries)
			.where(eq(bibliographyEntries.id, id))
			.returning({ id: bibliographyEntries.id });

		if (result.length === 0) {
			return { success: false, error: "Entry not found" };
		}

		revalidatePath("/documents");

		return { success: true };
	} catch (error) {
		logger.error("Failed to delete bibliography entry:", error);
		return { success: false, error: "Failed to delete bibliography entry" };
	}
}

// ============================================================================
// Citation Operations
// ============================================================================

/**
 * Add a citation to a document
 */
export async function citeInDocument(
	documentId: string,
	entryId: string,
	style?: CitationStyleType
): Promise<ActionResult<{ citationId: string; formattedCitation: string }>> {
	try {
		// Get the entry
		const entry = await db.query.bibliographyEntries.findFirst({
			where: eq(bibliographyEntries.id, entryId),
		});

		if (!entry) {
			return { success: false, error: "Bibliography entry not found" };
		}

		// Format the citation
		const citationStyle = style ?? "apa";
		const entryData = mapRowToEntry(entry);
		const formattedCitation = await formatCitation(entryData, citationStyle);
		const inTextCitation = await formatInTextCitation(entryData, citationStyle);

		// Insert citation record
		const [citation] = await db
			.insert(documentCitations)
			.values({
				documentId,
				bibliographyEntryId: entryId,
				citationStyle,
				formattedCitation,
				inTextCitation,
			})
			.returning();

		// Update citation count
		await db
			.update(bibliographyEntries)
			.set({
				citationCount: sql`${bibliographyEntries.citationCount} + 1`,
				lastCitedAt: new Date(),
			})
			.where(eq(bibliographyEntries.id, entryId));

		return {
			success: true,
			data: {
				citationId: citation.id,
				formattedCitation,
			},
		};
	} catch (error) {
		logger.error("Failed to cite in document:", error);
		return { success: false, error: "Failed to cite in document" };
	}
}

/**
 * Get all citations for a document
 */
export async function getDocumentCitations(
	documentId: string
): Promise<ActionResult<BibliographyEntry[]>> {
	try {
		const citations = await db.query.documentCitations.findMany({
			where: eq(documentCitations.documentId, documentId),
			with: {
				bibliographyEntry: true,
			},
		});

		const entries = citations
			.map((c) => c.bibliographyEntry)
			.filter((e): e is BibliographyEntryRow => e !== null)
			.map(mapRowToEntry);

		return { success: true, data: entries };
	} catch (error) {
		logger.error("Failed to get document citations:", error);
		return { success: false, error: "Failed to get document citations" };
	}
}

// ============================================================================
// Import/Export Operations
// ============================================================================

/**
 * Import entries from BibTeX format
 */
export async function importFromBibTeX(
	bibtex: string
): Promise<ActionResult<{ imported: number; errors: string[] }>> {
	try {
		const entries = parseBibTeX(bibtex);
		const errors: string[] = [];
		let imported = 0;

		for (const entry of entries) {
			try {
				await createBibliographyEntry(entry);
				imported++;
			} catch (err) {
				errors.push(`Failed to import ${entry.citeKey}: ${String(err)}`);
			}
		}

		return { success: true, data: { imported, errors } };
	} catch (error) {
		logger.error("Failed to import BibTeX:", error);
		return { success: false, error: "Failed to parse BibTeX file" };
	}
}

/**
 * Export entries to BibTeX format
 */
export async function exportToBibTeX(entryIds?: string[]): Promise<ActionResult<string>> {
	try {
		let entries: BibliographyEntryRow[];

		if (entryIds && entryIds.length > 0) {
			entries = await db.query.bibliographyEntries.findMany({
				where: inArray(bibliographyEntries.id, entryIds),
			});
		} else {
			entries = await db.query.bibliographyEntries.findMany();
		}

		const bibtex = entries.map((e) => entryToBibTeX(mapRowToEntry(e))).join("\n\n");

		return { success: true, data: bibtex };
	} catch (error) {
		logger.error("Failed to export BibTeX:", error);
		return { success: false, error: "Failed to export BibTeX" };
	}
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get bibliography statistics
 */
export async function getBibliographyStats(): Promise<ActionResult<BibliographyStats>> {
	try {
		const allEntries = await db.query.bibliographyEntries.findMany({
			orderBy: [desc(bibliographyEntries.citationCount)],
		});

		const totalEntries = allEntries.length;
		const totalCitations = allEntries.reduce((sum, e) => sum + e.citationCount, 0);
		const mostCitedEntry = allEntries.length > 0 ? mapRowToEntry(allEntries[0]) : null;

		// Count by type
		const entriesByType: Record<string, number> = {};
		allEntries.forEach((e) => {
			entriesByType[e.entryType] = (entriesByType[e.entryType] || 0) + 1;
		});

		// Count by year
		const entriesByYear: Record<number, number> = {};
		allEntries.forEach((e) => {
			entriesByYear[e.year] = (entriesByYear[e.year] || 0) + 1;
		});

		// Recent additions (last 10)
		const recentEntries = await db.query.bibliographyEntries.findMany({
			orderBy: [desc(bibliographyEntries.createdAt)],
			limit: 10,
		});

		return {
			success: true,
			data: {
				totalEntries,
				totalCitations,
				mostCitedEntry,
				entriesByType,
				entriesByYear,
				recentAdditions: recentEntries.map(mapRowToEntry),
			},
		};
	} catch (error) {
		logger.error("Failed to get bibliography stats:", error);
		return { success: false, error: "Failed to get bibliography stats" };
	}
}

// ============================================================================
// Citation Formatting Helpers
// ============================================================================

/**
 * Format a citation in the specified style
 */
export async function formatCitation(entry: BibliographyEntry, style: CitationStyleType): Promise<string> {
	const authors = formatAuthors(entry.authors, style);

	switch (style) {
		case "apa":
			return formatAPA(entry, authors);
		case "mla":
			return formatMLA(entry, authors);
		case "chicago":
			return formatChicago(entry, authors);
		case "ieee":
			return formatIEEE(entry, authors);
		case "vancouver":
			return formatVancouver(entry, authors);
		case "harvard":
			return formatHarvard(entry, authors);
		default:
			return formatAPA(entry, authors);
	}
}

/**
 * Format in-text citation
 */
export async function formatInTextCitation(entry: BibliographyEntry, style: CitationStyleType): Promise<string> {
	const firstAuthor = entry.authors[0]?.split(",")[0] ?? "Unknown";
	const year = entry.year;

	switch (style) {
		case "apa":
		case "harvard":
			return entry.authors.length > 2
				? `(${firstAuthor} et al., ${year})`
				: entry.authors.length === 2
				? `(${firstAuthor} & ${entry.authors[1]?.split(",")[0]}, ${year})`
				: `(${firstAuthor}, ${year})`;
		case "mla":
			return entry.authors.length > 2
				? `(${firstAuthor} et al. ${entry.pages ?? ""})`
				: `(${firstAuthor} ${entry.pages ?? ""})`;
		case "chicago":
			return `(${firstAuthor} ${year})`;
		case "ieee":
			return `[#]`; // IEEE uses numbered citations
		case "vancouver":
			return `(#)`; // Vancouver uses numbered citations
		default:
			return `(${firstAuthor}, ${year})`;
	}
}

function formatAuthors(authors: string[], style: CitationStyleType): string {
	if (authors.length === 0) return "";

	switch (style) {
		case "apa":
		case "harvard":
			if (authors.length === 1) return authors[0];
			if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
			return `${authors[0]}, ... & ${authors[authors.length - 1]}`;
		case "mla":
			if (authors.length === 1) return authors[0];
			if (authors.length === 2) return `${authors[0]}, and ${authors[1]}`;
			return `${authors[0]}, et al.`;
		case "ieee":
		case "vancouver":
			return authors.join(", ");
		default:
			return authors.join(", ");
	}
}

function formatAPA(entry: BibliographyEntry, authors: string): string {
	let citation = `${authors} (${entry.year}). ${entry.title}.`;

	if (entry.type === "article" && entry.journal) {
		citation += ` *${entry.journal}*`;
		if (entry.volume) citation += `, *${entry.volume}*`;
		if (entry.number) citation += `(${entry.number})`;
		if (entry.pages) citation += `, ${entry.pages}`;
		citation += ".";
	} else if (entry.type === "book" && entry.publisher) {
		citation += ` ${entry.publisher}.`;
	} else if (entry.type === "inproceedings" && entry.booktitle) {
		citation += ` In *${entry.booktitle}*`;
		if (entry.pages) citation += ` (pp. ${entry.pages})`;
		citation += ".";
	}

	if (entry.doi) citation += ` https://doi.org/${entry.doi}`;

	return citation;
}

function formatMLA(entry: BibliographyEntry, authors: string): string {
	let citation = `${authors}. "${entry.title}."`;

	if (entry.type === "article" && entry.journal) {
		citation += ` *${entry.journal}*`;
		if (entry.volume) citation += `, vol. ${entry.volume}`;
		if (entry.number) citation += `, no. ${entry.number}`;
		citation += `, ${entry.year}`;
		if (entry.pages) citation += `, pp. ${entry.pages}`;
		citation += ".";
	} else if (entry.type === "book" && entry.publisher) {
		citation += ` ${entry.publisher}, ${entry.year}.`;
	}

	return citation;
}

function formatChicago(entry: BibliographyEntry, authors: string): string {
	let citation = `${authors}. "${entry.title}."`;

	if (entry.type === "article" && entry.journal) {
		citation += ` *${entry.journal}*`;
		if (entry.volume) citation += ` ${entry.volume}`;
		if (entry.number) citation += `, no. ${entry.number}`;
		citation += ` (${entry.year})`;
		if (entry.pages) citation += `: ${entry.pages}`;
		citation += ".";
	} else if (entry.type === "book" && entry.publisher) {
		if (entry.address) citation += ` ${entry.address}:`;
		citation += ` ${entry.publisher}, ${entry.year}.`;
	}

	return citation;
}

function formatIEEE(entry: BibliographyEntry, authors: string): string {
	let citation = `${authors}, "${entry.title},"`;

	if (entry.type === "article" && entry.journal) {
		citation += ` *${entry.journal}*`;
		if (entry.volume) citation += `, vol. ${entry.volume}`;
		if (entry.number) citation += `, no. ${entry.number}`;
		if (entry.pages) citation += `, pp. ${entry.pages}`;
		citation += `, ${entry.year}.`;
	} else if (entry.type === "book" && entry.publisher) {
		if (entry.address) citation += ` ${entry.address}:`;
		citation += ` ${entry.publisher}, ${entry.year}.`;
	}

	return citation;
}

function formatVancouver(entry: BibliographyEntry, authors: string): string {
	let citation = `${authors}. ${entry.title}.`;

	if (entry.type === "article" && entry.journal) {
		citation += ` ${entry.journal}. ${entry.year}`;
		if (entry.volume) citation += `;${entry.volume}`;
		if (entry.number) citation += `(${entry.number})`;
		if (entry.pages) citation += `:${entry.pages}`;
		citation += ".";
	} else if (entry.type === "book" && entry.publisher) {
		if (entry.address) citation += ` ${entry.address}:`;
		citation += ` ${entry.publisher}; ${entry.year}.`;
	}

	return citation;
}

function formatHarvard(entry: BibliographyEntry, authors: string): string {
	// Harvard is similar to APA
	return formatAPA(entry, authors);
}

// ============================================================================
// BibTeX Parsing Helpers
// ============================================================================

function parseBibTeX(bibtex: string): CreateEntryInput[] {
	const entries: CreateEntryInput[] = [];
	const entryRegex = /@(\w+)\{([^,]+),([^}]+)\}/g;

	let match;
	while ((match = entryRegex.exec(bibtex)) !== null) {
		const type = match[1].toLowerCase() as BibliographyEntryType;
		const citeKey = match[2].trim();
		const fieldsStr = match[3];

		const fields: Record<string, string> = {};
		const fieldRegex = /(\w+)\s*=\s*[{"]([^}"]+)[}"]/g;
		let fieldMatch;
		while ((fieldMatch = fieldRegex.exec(fieldsStr)) !== null) {
			fields[fieldMatch[1].toLowerCase()] = fieldMatch[2].trim();
		}

		const entry: CreateEntryInput = {
			citeKey,
			entryType: type,
			title: fields.title ?? "Untitled",
			authors: (fields.author ?? "").split(" and ").map((a) => a.trim()),
			year: parseInt(fields.year ?? "0", 10),
			journal: fields.journal,
			booktitle: fields.booktitle,
			publisher: fields.publisher,
			volume: fields.volume,
			number: fields.number,
			pages: fields.pages,
			doi: fields.doi,
			url: fields.url,
			abstract: fields.abstract,
			keywords: fields.keywords?.split(",").map((k) => k.trim()),
			note: fields.note,
			address: fields.address,
			institution: fields.institution,
			school: fields.school,
		};

		entries.push(entry);
	}

	return entries;
}

function entryToBibTeX(entry: BibliographyEntry): string {
	const fields: string[] = [];

	const addField = (name: string, value: string | undefined | null) => {
		if (value) fields.push(`  ${name} = {${value}}`);
	};

	addField("author", entry.authors.join(" and "));
	addField("title", entry.title);
	addField("year", String(entry.year));
	addField("journal", entry.journal);
	addField("booktitle", entry.booktitle);
	addField("publisher", entry.publisher);
	addField("volume", entry.volume);
	addField("number", entry.number);
	addField("pages", entry.pages);
	addField("doi", entry.doi);
	addField("url", entry.url);
	addField("abstract", entry.abstract);
	addField("keywords", entry.keywords?.join(", "));
	addField("note", entry.note);
	addField("address", entry.address);

	return `@${entry.type}{${entry.citeKey},\n${fields.join(",\n")}\n}`;
}
