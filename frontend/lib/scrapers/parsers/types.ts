/**
 * Site-Specific Parser Types
 *
 * Each tender portal needs its own parser because:
 * 1. Different HTML/DOM structures
 * 2. Different pagination mechanisms
 * 3. JavaScript-rendered vs static content
 * 4. Different data fields and formats
 */

import type { OpportunityData } from "../deduplicator";

// ============================================================================
// Parser Interface
// ============================================================================

/**
 * Base interface for all site-specific parsers.
 * Each tender portal should implement this interface.
 */
export interface TenderParser {
	/** Unique identifier matching scraperSources.sourceId */
	sourceId: string;

	/** Human-readable name */
	name: string;

	/** Whether this site requires JavaScript rendering */
	requiresJavascript: boolean;

	/** Parse the page content and extract opportunities */
	parse(content: ParseInput): Promise<ParseResult>;

	/** Get the URL for a specific page number (for pagination) */
	getPageUrl(baseUrl: string, page: number): string;

	/** Check if there are more pages to scrape */
	hasNextPage(content: ParseInput, currentPage: number): boolean;
}

export interface ParseInput {
	/** Raw HTML content (for static sites) */
	html?: string;
	/** Markdown content (from Firecrawl) */
	markdown?: string;
	/** Extracted links (from Firecrawl) */
	links?: string[];
	/** Original URL */
	url: string;
	/** Maximum source records requested by the caller for source API parsers */
	sourceLimit?: number;
}

export interface ParseResult {
	opportunities: OpportunityData[];
	nextPageUrl?: string;
	totalPages?: number;
	error?: string;
}

// ============================================================================
// Parser Registry
// ============================================================================

/**
 * Registry of all available parsers by sourceId.
 * Parsers register themselves here on import.
 */
export const parserRegistry = new Map<string, TenderParser>();

/**
 * Register a parser for a specific source
 */
export function registerParser(parser: TenderParser): void {
	parserRegistry.set(parser.sourceId, parser);
}

/**
 * Get a parser for a specific source
 */
export function getParser(sourceId: string): TenderParser | null {
	return parserRegistry.get(sourceId) || null;
}

/**
 * Check if a parser exists for a source
 */
export function hasParser(sourceId: string): boolean {
	return parserRegistry.has(sourceId);
}

// ============================================================================
// Parser Utilities
// ============================================================================

/**
 * Common date parsing for African tender portals
 * Handles formats like: "31st January, 2026", "2026-01-31", "31/01/2026"
 */
export function parseDate(dateStr: string | null | undefined): Date | undefined {
	if (!dateStr) return undefined;

	const cleaned = dateStr.trim();

	// Try ISO format first
	const isoMatch = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
	if (isoMatch) {
		return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
	}

	// Try DD/MM/YYYY
	const slashMatch = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
	if (slashMatch) {
		return new Date(parseInt(slashMatch[3]), parseInt(slashMatch[2]) - 1, parseInt(slashMatch[1]));
	}

	// Try "31st January, 2026" format
	const ordinalMatch = cleaned.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(\w+),?\s*(\d{4})/i);
	if (ordinalMatch) {
		const months: Record<string, number> = {
			january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
			july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
		};
		const month = months[ordinalMatch[2].toLowerCase()];
		if (month !== undefined) {
			return new Date(parseInt(ordinalMatch[3]), month, parseInt(ordinalMatch[1]));
		}
	}

	// Fallback to Date.parse
	const parsed = Date.parse(cleaned);
	if (!isNaN(parsed)) {
		return new Date(parsed);
	}

	return undefined;
}

/**
 * Clean and normalize text extracted from HTML
 */
export function cleanText(text: string | null | undefined): string {
	if (!text) return "";
	return text
		.replace(/\s+/g, " ")
		.replace(/[\r\n\t]/g, " ")
		.trim();
}

/**
 * Extract currency and amount from budget strings
 */
export function parseBudget(budgetStr: string | null | undefined): {
	currency?: string;
	amount?: number;
	original: string;
} {
	if (!budgetStr) return { original: "" };

	const cleaned = budgetStr.trim();

	// Match patterns like "KES 1,000,000" or "USD 50000" or "$1M"
	const match = cleaned.match(/([A-Z]{3}|[$€£])\s*([\d,]+(?:\.\d+)?)\s*(M|K|B)?/i);
	if (match) {
		const currencyMap: Record<string, string> = { "$": "USD", "€": "EUR", "£": "GBP" };
		const multiplierMap: Record<string, number> = { K: 1000, M: 1000000, B: 1000000000 };

		const currency = currencyMap[match[1]] || match[1].toUpperCase();
		let amount = parseFloat(match[2].replace(/,/g, ""));
		if (match[3]) {
			amount *= multiplierMap[match[3].toUpperCase()] || 1;
		}

		return { currency, amount, original: cleaned };
	}

	return { original: cleaned };
}
