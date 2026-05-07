/**
 * Opportunity Deduplicator
 *
 * Uses SHA256 fingerprinting to prevent duplicate opportunities.
 * Fingerprint = SHA256(lowercase(title) + org + deadline)
 *
 * Upsert Logic:
 * 1. Check fingerprint exists → update scrapedAt timestamp
 * 2. Check (source, sourceId) exists → update fields
 * 3. Otherwise → insert new opportunity
 */

import { createHash } from "crypto";
import { db } from "@/lib/db";
import { opportunities } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export interface OpportunityData {
	// Required fields
	title: string;
	organization?: string;
	deadline?: Date | string | null;

	// Source tracking
	source: string;        // Scraper source ID (e.g., "ungm", "afdb")
	sourceId?: string;     // Original ID from source portal
	noticeId?: string;     // Notice/tender ID
	portalUrl?: string;    // Link to portal page
	documentUrl?: string;  // Link to tender documents

	// Optional fields
	category?: string;
	itCategory?: string;
	sector?: string;
	countryRegion?: string;
	funder?: string;
	budgetValue?: string;
	budgetNumeric?: number;
	budgetCurrency?: string;
	projectSummary?: string;
	projectScope?: string;
	keyRequirements?: string;
	technicalRequirements?: string;
	submissionMethod?: string;
	submissionRequirements?: string;
	rfpLink?: string;
	opportunityType?: "rfp" | "eoi" | "tender" | "grant" | "contract";
	publishedDate?: Date | string | null;
	tags?: string[];
	metadata?: Record<string, unknown>;
}

export interface DeduplicationResult {
	action: "inserted" | "updated" | "skipped";
	opportunityId: string;
	fingerprint: string;
	reason?: string;
}

// ============================================================================
// Fingerprint Generation
// ============================================================================

function cleanString(value: string | null | undefined): string | undefined {
	const cleaned = value?.replace(/\s+/g, " ").trim();
	return cleaned || undefined;
}

function parseOptionalDate(value: Date | string | null | undefined): Date | null {
	if (!value) return null;
	const date = typeof value === "string" ? new Date(value) : value;
	return !isNaN(date.getTime()) ? date : null;
}

function normalizeOpportunity(data: OpportunityData): OpportunityData {
	const title = cleanString(data.title);
	if (!title) {
		throw new Error("Opportunity title is required");
	}

	return {
		...data,
		title,
		organization: cleanString(data.organization),
		source: cleanString(data.source) || "unknown",
		sourceId: cleanString(data.sourceId),
		noticeId: cleanString(data.noticeId),
		portalUrl: cleanString(data.portalUrl),
		documentUrl: cleanString(data.documentUrl),
		category: cleanString(data.category),
		itCategory: cleanString(data.itCategory),
		sector: cleanString(data.sector),
		countryRegion: cleanString(data.countryRegion),
		funder: cleanString(data.funder),
		budgetValue: cleanString(data.budgetValue),
		budgetCurrency: cleanString(data.budgetCurrency),
		projectSummary: cleanString(data.projectSummary),
		projectScope: cleanString(data.projectScope),
		keyRequirements: cleanString(data.keyRequirements),
		technicalRequirements: cleanString(data.technicalRequirements),
		submissionMethod: cleanString(data.submissionMethod),
		submissionRequirements: cleanString(data.submissionRequirements),
		rfpLink: cleanString(data.rfpLink),
		deadline: parseOptionalDate(data.deadline),
		publishedDate: parseOptionalDate(data.publishedDate),
	};
}

/**
 * Generate a SHA256 fingerprint for deduplication.
 * Fingerprint = SHA256(lowercase(title) + org + deadline_date)
 *
 * Using title + organization + deadline provides a good balance:
 * - Title alone has false positives (same title, different orgs)
 * - Adding org reduces collisions significantly
 * - Adding deadline catches reposted opportunities
 */
export function generateFingerprint(data: {
	title: string;
	organization?: string;
	deadline?: Date | string | null;
}): string {
	// Normalize title: lowercase, trim whitespace, collapse multiple spaces
	const normalizedTitle = data.title
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ");

	// Normalize organization: lowercase, trim, or empty string
	const normalizedOrg = (data.organization || "")
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ");

	// Normalize deadline: extract just the date portion (YYYY-MM-DD)
	let normalizedDeadline = "";
	if (data.deadline) {
		const date = typeof data.deadline === "string"
			? new Date(data.deadline)
			: data.deadline;

		if (!isNaN(date.getTime())) {
			normalizedDeadline = date.toISOString().split("T")[0];
		}
	}

	// Concatenate with delimiter to prevent collision edge cases
	const input = `${normalizedTitle}|${normalizedOrg}|${normalizedDeadline}`;

	// Generate SHA256 hash
	return createHash("sha256").update(input).digest("hex");
}

/**
 * Generate a secondary fingerprint for fuzzy matching.
 * Uses only title (heavily normalized) for catching near-duplicates.
 */
export function generateFuzzyFingerprint(title: string): string {
	// More aggressive normalization:
	// - lowercase
	// - remove punctuation
	// - remove common words
	// - collapse whitespace
	const normalized = title
		.toLowerCase()
		.replace(/[^\w\s]/g, "")  // Remove punctuation
		.replace(/\b(the|a|an|for|of|to|and|in|on)\b/gi, "")  // Remove common words
		.replace(/\s+/g, " ")
		.trim();

	return createHash("sha256").update(normalized).digest("hex").substring(0, 32);
}

// ============================================================================
// Deduplication
// ============================================================================

/**
 * Deduplicate an opportunity using fingerprint matching.
 *
 * Strategy:
 * 1. Exact fingerprint match → Update scrapedAt, return existing
 * 2. Source + noticeId match → Update fields, return existing
 * 3. No match → Insert new record
 */
export async function deduplicateOpportunity(
	data: OpportunityData,
	scraperSourceId: string
): Promise<DeduplicationResult> {
	const normalized = normalizeOpportunity(data);
	const fingerprint = generateFingerprint({
		title: normalized.title,
		organization: normalized.organization,
		deadline: normalized.deadline,
	});

	const deadline = parseOptionalDate(normalized.deadline);
	const publishedDate = parseOptionalDate(normalized.publishedDate);

	// Check for existing by fingerprint
	const existingByFingerprint = await db.query.opportunities.findFirst({
		where: eq(opportunities.fingerprint, fingerprint),
	});

	if (existingByFingerprint) {
		// Update scrapedAt timestamp to show it's still active
		await db
			.update(opportunities)
			.set({
				scrapedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(opportunities.id, existingByFingerprint.id));

		return {
			action: "skipped",
			opportunityId: existingByFingerprint.id,
			fingerprint,
			reason: "Fingerprint match - opportunity already exists",
		};
	}

	// Check for existing by source + source identifiers when available.
	const sourceIdentifierConditions = [];
	if (normalized.noticeId) {
		sourceIdentifierConditions.push(eq(opportunities.noticeId, normalized.noticeId));
	}
	if (normalized.sourceId) {
		sourceIdentifierConditions.push(eq(opportunities.sourceId, normalized.sourceId));
	}

	if (sourceIdentifierConditions.length > 0) {
		const existingBySourceId = await db.query.opportunities.findFirst({
			where: and(
				eq(opportunities.source, normalized.source),
				or(...sourceIdentifierConditions)
			),
		});

		if (existingBySourceId) {
			// Update the record with new data
			await db
				.update(opportunities)
				.set({
					title: normalized.title,
					organization: normalized.organization,
					deadline: deadline,
					fingerprint, // Update fingerprint in case data changed
					category: normalized.category ?? existingBySourceId.category,
					itCategory: normalized.itCategory ?? existingBySourceId.itCategory,
					sector: normalized.sector ?? existingBySourceId.sector,
					countryRegion: normalized.countryRegion ?? existingBySourceId.countryRegion,
					funder: normalized.funder ?? existingBySourceId.funder,
					budgetValue: normalized.budgetValue ?? existingBySourceId.budgetValue,
					budgetNumeric: normalized.budgetNumeric ?? existingBySourceId.budgetNumeric,
					budgetCurrency: normalized.budgetCurrency ?? existingBySourceId.budgetCurrency,
					projectSummary: normalized.projectSummary ?? existingBySourceId.projectSummary,
					projectScope: normalized.projectScope ?? existingBySourceId.projectScope,
					keyRequirements: normalized.keyRequirements ?? existingBySourceId.keyRequirements,
					technicalRequirements: normalized.technicalRequirements ?? existingBySourceId.technicalRequirements,
					submissionMethod: normalized.submissionMethod ?? existingBySourceId.submissionMethod,
					submissionRequirements: normalized.submissionRequirements ?? existingBySourceId.submissionRequirements,
					rfpLink: normalized.rfpLink ?? existingBySourceId.rfpLink,
					portalUrl: normalized.portalUrl ?? existingBySourceId.portalUrl,
					documentUrl: normalized.documentUrl ?? existingBySourceId.documentUrl,
					publishedDate: publishedDate ?? existingBySourceId.publishedDate,
					scrapedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(opportunities.id, existingBySourceId.id));

			return {
				action: "updated",
				opportunityId: existingBySourceId.id,
				fingerprint,
				reason: "Source identifier match - updated existing record",
			};
		}
	}

	// Calculate days left and expiration status
	let daysLeft: number | null = null;
	let isExpired = false;
	if (deadline) {
		const now = new Date();
		const diffMs = deadline.getTime() - now.getTime();
		daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
		isExpired = daysLeft < 0;
	}

	// Insert new opportunity
	const [inserted] = await db
		.insert(opportunities)
		.values({
			title: normalized.title,
			organization: normalized.organization,
			deadline,
			daysLeft,
			isExpired,
			fingerprint,
			source: normalized.source,
			sourceId: normalized.sourceId,
			noticeId: normalized.noticeId,
			portalUrl: normalized.portalUrl,
			documentUrl: normalized.documentUrl,
			category: normalized.category,
			itCategory: normalized.itCategory,
			sector: normalized.sector,
			countryRegion: normalized.countryRegion,
			funder: normalized.funder,
			budgetValue: normalized.budgetValue,
			budgetNumeric: normalized.budgetNumeric,
			budgetCurrency: normalized.budgetCurrency,
			projectSummary: normalized.projectSummary,
			projectScope: normalized.projectScope,
			keyRequirements: normalized.keyRequirements,
			technicalRequirements: normalized.technicalRequirements,
			submissionMethod: normalized.submissionMethod,
			submissionRequirements: normalized.submissionRequirements,
			rfpLink: normalized.rfpLink,
			opportunityType: normalized.opportunityType || "rfp",
			publishedDate,
			scrapedAt: new Date(),
			tags: normalized.tags || [],
			metadata: {
				...(normalized.metadata ?? {}),
				scraperSourceId,
			},
			sourcePlatform: normalized.source,
		})
		.onConflictDoUpdate({
			target: opportunities.fingerprint,
			set: {
				scrapedAt: new Date(),
				updatedAt: new Date(),
			},
		})
		.returning({ id: opportunities.id });

	return {
		action: "inserted",
		opportunityId: inserted.id,
		fingerprint,
	};
}

// ============================================================================
// Bulk Deduplication
// ============================================================================

export interface BulkDeduplicationResult {
	total: number;
	inserted: number;
	updated: number;
	skipped: number;
	failed: number;
	errors: Array<{ index: number; error: string }>;
}

/**
 * Deduplicate multiple opportunities in batch.
 * Processes sequentially to avoid race conditions on fingerprint checks.
 */
export async function bulkDeduplicateOpportunities(
	opportunities: OpportunityData[],
	scraperSourceId: string
): Promise<BulkDeduplicationResult> {
	const result: BulkDeduplicationResult = {
		total: opportunities.length,
		inserted: 0,
		updated: 0,
		skipped: 0,
		failed: 0,
		errors: [],
	};

	for (let i = 0; i < opportunities.length; i++) {
		try {
			const dedupResult = await deduplicateOpportunity(
				opportunities[i],
				scraperSourceId
			);

			switch (dedupResult.action) {
				case "inserted":
					result.inserted++;
					break;
				case "updated":
					result.updated++;
					break;
				case "skipped":
					result.skipped++;
					break;
			}
		} catch (error) {
			result.failed++;
			result.errors.push({
				index: i,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return result;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if an opportunity exists by fingerprint.
 */
export async function opportunityExists(data: {
	title: string;
	organization?: string;
	deadline?: Date | string | null;
}): Promise<{ exists: boolean; id?: string }> {
	const fingerprint = generateFingerprint(data);

	const existing = await db.query.opportunities.findFirst({
		where: eq(opportunities.fingerprint, fingerprint),
		columns: { id: true },
	});

	return {
		exists: !!existing,
		id: existing?.id,
	};
}

/**
 * Find potential duplicates by fuzzy matching.
 * Returns opportunities that might be duplicates based on title similarity.
 */
export async function findPotentialDuplicates(
	title: string,
	limit: number = 5
): Promise<Array<{ id: string; title: string; similarity: number }>> {
	// For MVP: Simple approach using SQL LIKE
	// Production: Use pg_trgm extension for trigram similarity
	// or vector similarity search

	const searchTerms = title
		.toLowerCase()
		.split(/\s+/)
		.filter(term => term.length > 3)
		.slice(0, 3);

	if (searchTerms.length === 0) {
		return [];
	}

	// Build search pattern
	const pattern = `%${searchTerms.join("%")}%`;

	const results = await db.query.opportunities.findMany({
		where: (table, { ilike }) => ilike(table.title, pattern),
		columns: {
			id: true,
			title: true,
		},
		limit,
	});

	// Calculate simple similarity score
	return results.map(r => ({
		id: r.id,
		title: r.title,
		similarity: calculateSimilarity(title.toLowerCase(), r.title.toLowerCase()),
	}));
}

/**
 * Simple similarity calculation using Jaccard index.
 */
function calculateSimilarity(a: string, b: string): number {
	const setA = new Set(a.split(/\s+/));
	const setB = new Set(b.split(/\s+/));

	const intersection = new Set([...setA].filter(x => setB.has(x)));
	const union = new Set([...setA, ...setB]);

	return intersection.size / union.size;
}
