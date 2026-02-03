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
	const fingerprint = generateFingerprint({
		title: data.title,
		organization: data.organization,
		deadline: data.deadline,
	});

	// Parse deadline if string
	const deadline = data.deadline
		? typeof data.deadline === "string"
			? new Date(data.deadline)
			: data.deadline
		: null;

	const publishedDate = data.publishedDate
		? typeof data.publishedDate === "string"
			? new Date(data.publishedDate)
			: data.publishedDate
		: null;

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

	// Check for existing by source + noticeId (if we have noticeId)
	if (data.noticeId) {
		const existingBySourceId = await db.query.opportunities.findFirst({
			where: and(
				eq(opportunities.source, data.source),
				eq(opportunities.noticeId, data.noticeId)
			),
		});

		if (existingBySourceId) {
			// Update the record with new data
			await db
				.update(opportunities)
				.set({
					title: data.title,
					organization: data.organization,
					deadline: deadline,
					fingerprint, // Update fingerprint in case data changed
					category: data.category ?? existingBySourceId.category,
					itCategory: data.itCategory ?? existingBySourceId.itCategory,
					sector: data.sector ?? existingBySourceId.sector,
					countryRegion: data.countryRegion ?? existingBySourceId.countryRegion,
					funder: data.funder ?? existingBySourceId.funder,
					budgetValue: data.budgetValue ?? existingBySourceId.budgetValue,
					budgetNumeric: data.budgetNumeric ?? existingBySourceId.budgetNumeric,
					budgetCurrency: data.budgetCurrency ?? existingBySourceId.budgetCurrency,
					projectSummary: data.projectSummary ?? existingBySourceId.projectSummary,
					projectScope: data.projectScope ?? existingBySourceId.projectScope,
					keyRequirements: data.keyRequirements ?? existingBySourceId.keyRequirements,
					technicalRequirements: data.technicalRequirements ?? existingBySourceId.technicalRequirements,
					submissionMethod: data.submissionMethod ?? existingBySourceId.submissionMethod,
					submissionRequirements: data.submissionRequirements ?? existingBySourceId.submissionRequirements,
					rfpLink: data.rfpLink ?? existingBySourceId.rfpLink,
					portalUrl: data.portalUrl ?? existingBySourceId.portalUrl,
					documentUrl: data.documentUrl ?? existingBySourceId.documentUrl,
					publishedDate: publishedDate ?? existingBySourceId.publishedDate,
					scrapedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(opportunities.id, existingBySourceId.id));

			return {
				action: "updated",
				opportunityId: existingBySourceId.id,
				fingerprint,
				reason: "Source + noticeId match - updated existing record",
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
			title: data.title,
			organization: data.organization,
			deadline,
			daysLeft,
			isExpired,
			fingerprint,
			source: data.source,
			sourceId: data.sourceId,
			noticeId: data.noticeId,
			portalUrl: data.portalUrl,
			documentUrl: data.documentUrl,
			category: data.category,
			itCategory: data.itCategory,
			sector: data.sector,
			countryRegion: data.countryRegion,
			funder: data.funder,
			budgetValue: data.budgetValue,
			budgetNumeric: data.budgetNumeric,
			budgetCurrency: data.budgetCurrency,
			projectSummary: data.projectSummary,
			projectScope: data.projectScope,
			keyRequirements: data.keyRequirements,
			technicalRequirements: data.technicalRequirements,
			submissionMethod: data.submissionMethod,
			submissionRequirements: data.submissionRequirements,
			rfpLink: data.rfpLink,
			opportunityType: data.opportunityType || "rfp",
			publishedDate,
			scrapedAt: new Date(),
			tags: data.tags || [],
			metadata: data.metadata,
			sourcePlatform: data.source,
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
