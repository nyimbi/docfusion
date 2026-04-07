/**
 * LLM-Based Tender Extractor
 *
 * Uses Firecrawl's LLM extraction to dynamically parse any tender site
 * without site-specific code. This handles the "long tail" of sources
 * that don't warrant custom parsers.
 *
 * How it works:
 * 1. Define a JSON schema for tender data
 * 2. Firecrawl uses an LLM to extract matching data from any page
 * 3. Works regardless of HTML structure, table formats, etc.
 */

import { FirecrawlClient, type ScrapeOptions } from "../firecrawl";
import type { OpportunityData } from "../deduplicator";
import { logger } from "@/lib/utils/logger";

// ============================================================================
// Tender Extraction Schema
// ============================================================================

/**
 * JSON Schema for LLM extraction
 * Firecrawl's LLM will extract data matching this structure
 */
export const TENDER_EXTRACTION_SCHEMA = {
	type: "object",
	properties: {
		tenders: {
			type: "array",
			description: "List of tenders, RFPs, bids, or procurement opportunities found on the page",
			items: {
				type: "object",
				properties: {
					title: {
						type: "string",
						description: "The title or name of the tender/RFP/bid",
					},
					organization: {
						type: "string",
						description: "The organization, agency, or buyer issuing the tender",
					},
					deadline: {
						type: "string",
						description: "Submission deadline date (any format)",
					},
					reference_number: {
						type: "string",
						description: "Reference number, notice ID, or tender ID",
					},
					country: {
						type: "string",
						description: "Country or region where the tender applies",
					},
					category: {
						type: "string",
						description: "Category, sector, or type of procurement",
					},
					budget: {
						type: "string",
						description: "Budget amount or estimated value",
					},
					description: {
						type: "string",
						description: "Brief description or summary of the tender",
					},
					url: {
						type: "string",
						description: "Direct link to the tender details page",
					},
				},
				required: ["title"],
			},
		},
		next_page_url: {
			type: "string",
			description: "URL to the next page of results, if pagination exists",
		},
		total_results: {
			type: "number",
			description: "Total number of tenders if shown on page",
		},
	},
	required: ["tenders"],
};

/**
 * System prompt to guide the LLM extraction
 */
export const TENDER_EXTRACTION_PROMPT = `
You are extracting tender/procurement opportunities from a webpage.

Look for:
- Tender notices, RFPs (Request for Proposal), RFQs, EOIs
- Bid invitations, procurement notices, contract opportunities
- Government or organizational procurement listings

Extract ALL tenders visible on the page. For each tender, capture:
- Title (required)
- Organization/buyer
- Deadline (any date format)
- Reference/ID number
- Country/region
- Category/sector
- Budget/value
- Description
- Link to details

If a field is not visible, omit it. Do not guess or fabricate data.
If there are no tenders on the page, return an empty array.
`;

// ============================================================================
// LLM Extractor
// ============================================================================

export interface LLMExtractorOptions {
	/** Firecrawl client instance */
	firecrawl: FirecrawlClient;
	/** Source ID for tracking */
	sourceId: string;
	/** Source name for fallback organization */
	sourceName?: string;
	/** Additional scrape options */
	scrapeOptions?: Partial<ScrapeOptions>;
	/** Use stealth scraper as fallback for anti-bot protected sites */
	useStealthFallback?: boolean;
	/** Stealth scraper URL (default: http://localhost:3003) */
	stealthScraperUrl?: string;
}

export interface LLMExtractionResult {
	opportunities: OpportunityData[];
	nextPageUrl?: string;
	totalResults?: number;
	rawExtraction?: unknown;
	error?: string;
}

/**
 * Extract tenders from any URL using LLM
 */
export async function extractTendersWithLLM(
	url: string,
	options: LLMExtractorOptions
): Promise<LLMExtractionResult> {
	const {
		firecrawl,
		sourceId,
		sourceName,
		useStealthFallback = true,
		stealthScraperUrl = process.env.STEALTH_SCRAPER_URL || "http://localhost:3003",
	} = options;

	try {
		const result = await firecrawl.scrape(url, {
			formats: ["extract" as unknown as "markdown"],  // Must include "extract" when using extraction (not in Firecrawl's type defs yet)
			timeout: 300000, // 5 minutes for CPU-based LLM inference
			...options.scrapeOptions,
			extract: {
				schema: TENDER_EXTRACTION_SCHEMA,
				systemPrompt: TENDER_EXTRACTION_PROMPT,
			},
		});

		// If Firecrawl was blocked by anti-bot, try stealth + separate LLM call
		if (!result.success && result.error?.includes("SCRAPE_ALL_ENGINES_FAILED") && useStealthFallback) {
			logger.debug(`[LLM Extractor] Firecrawl blocked for ${url}, trying stealth scraper...`);
			return await extractWithStealthFallback(url, sourceId, sourceName, stealthScraperUrl);
		}

		if (!result.success) {
			return {
				opportunities: [],
				error: result.error || "Scrape failed",
			};
		}

		// Extract the LLM-parsed data
		const extracted = result.data?.extract as {
			tenders?: Array<{
				title: string;
				organization?: string;
				deadline?: string;
				reference_number?: string;
				country?: string;
				category?: string;
				budget?: string;
				description?: string;
				url?: string;
			}>;
			next_page_url?: string;
			total_results?: number;
		} | undefined;

		if (!extracted?.tenders || extracted.tenders.length === 0) {
			return {
				opportunities: [],
				rawExtraction: extracted,
			};
		}

		// Convert to OpportunityData format
		const opportunities: OpportunityData[] = extracted.tenders.map((tender) => ({
			title: tender.title,
			source: sourceId,
			organization: tender.organization || sourceName,
			deadline: tender.deadline ? parseFlexibleDate(tender.deadline) : undefined,
			noticeId: tender.reference_number || generateNoticeId(tender.title, sourceId),
			countryRegion: tender.country,
			category: tender.category,
			budgetValue: tender.budget,
			projectSummary: tender.description,
			portalUrl: tender.url || url,
		}));

		return {
			opportunities,
			nextPageUrl: extracted.next_page_url,
			totalResults: extracted.total_results,
			rawExtraction: extracted,
		};
	} catch (error) {
		return {
			opportunities: [],
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse dates in various formats the LLM might return
 */
function parseFlexibleDate(dateStr: string): Date | undefined {
	if (!dateStr) return undefined;

	// Try native parsing first
	const parsed = new Date(dateStr);
	if (!isNaN(parsed.getTime())) {
		return parsed;
	}

	// Try common formats
	const formats = [
		/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/, // DD/MM/YYYY or MM/DD/YYYY
		/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/, // YYYY-MM-DD
		/(\d{1,2})(?:st|nd|rd|th)?\s+(\w+),?\s+(\d{4})/i, // 15th January 2026
	];

	for (const pattern of formats) {
		const match = dateStr.match(pattern);
		if (match) {
			const parsed = new Date(dateStr);
			if (!isNaN(parsed.getTime())) {
				return parsed;
			}
		}
	}

	return undefined;
}

/**
 * Generate a notice ID from title
 */
function generateNoticeId(title: string, sourceId: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.substring(0, 60);
	return `${sourceId}-${slug}`;
}

// ============================================================================
// Stealth Fallback
// ============================================================================

/**
 * Fallback extraction using stealth scraper when Firecrawl is blocked.
 * Scrapes the page with stealth browser, then uses basic pattern matching
 * since we can't use Firecrawl's LLM extraction on stealth content.
 */
async function extractWithStealthFallback(
	url: string,
	sourceId: string,
	sourceName?: string,
	stealthScraperUrl: string = "http://localhost:3003"
): Promise<LLMExtractionResult> {
	try {
		const response = await fetch(`${stealthScraperUrl}/v1/scrape`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				url,
				options: {
					timeout: 60000,
					humanScroll: true,
					blockMedia: true,
				},
			}),
			signal: AbortSignal.timeout(70000),
		});

		if (!response.ok) {
			const error = await response.text();
			return {
				opportunities: [],
				error: `Stealth scraper error: ${error}`,
			};
		}

		const result = await response.json() as {
			success: boolean;
			data?: { markdown?: string };
			error?: string;
		};

		if (!result.success || !result.data?.markdown) {
			return {
				opportunities: [],
				error: result.error || "Stealth scrape returned no content",
			};
		}

		// Use pattern-based extraction on the markdown
		const opportunities = extractOpportunitiesFromMarkdownStealth(
			result.data.markdown,
			url,
			sourceId,
			sourceName
		);

		return {
			opportunities,
			rawExtraction: { stealthFallback: true, markdownLength: result.data.markdown.length },
		};
	} catch (error) {
		return {
			opportunities: [],
			error: `Stealth fallback failed: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

/**
 * Pattern-based extraction from markdown (used for stealth fallback)
 */
function extractOpportunitiesFromMarkdownStealth(
	markdown: string,
	sourceUrl: string,
	sourceId: string,
	sourceName?: string
): OpportunityData[] {
	const opportunities: OpportunityData[] = [];

	// Pattern 1: Markdown links with tender-like text
	const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
	let match;

	while ((match = linkPattern.exec(markdown)) !== null) {
		const [, text, linkUrl] = match;
		const lowerText = text.toLowerCase();

		if (
			lowerText.includes("tender") ||
			lowerText.includes("rfp") ||
			lowerText.includes("rfq") ||
			lowerText.includes("eoi") ||
			lowerText.includes("bid") ||
			lowerText.includes("procurement") ||
			lowerText.includes("contract") ||
			lowerText.includes("solicitation")
		) {
			opportunities.push({
				title: text.trim(),
				source: sourceId,
				organization: sourceName,
				portalUrl: linkUrl.startsWith("http") ? linkUrl : new URL(linkUrl, sourceUrl).toString(),
				noticeId: generateNoticeId(text, sourceId),
			});
		}
	}

	// Pattern 2: Headings that look like tender titles
	const headingPattern = /^#{1,3}\s+(.+(?:tender|rfp|rfq|procurement|bid|contract).+)$/gim;
	while ((match = headingPattern.exec(markdown)) !== null) {
		const title = match[1].trim();
		if (!opportunities.some(o => o.title === title)) {
			opportunities.push({
				title,
				source: sourceId,
				organization: sourceName,
				portalUrl: sourceUrl,
				noticeId: generateNoticeId(title, sourceId),
			});
		}
	}

	return opportunities;
}

// ============================================================================
// Batch Extraction
// ============================================================================

/**
 * Extract tenders from multiple URLs in parallel
 */
export async function batchExtractTenders(
	urls: string[],
	options: LLMExtractorOptions,
	concurrency: number = 3
): Promise<Map<string, LLMExtractionResult>> {
	const results = new Map<string, LLMExtractionResult>();

	// Process in batches
	for (let i = 0; i < urls.length; i += concurrency) {
		const batch = urls.slice(i, i + concurrency);
		const batchResults = await Promise.all(
			batch.map((url) => extractTendersWithLLM(url, options))
		);

		batch.forEach((url, index) => {
			results.set(url, batchResults[index]);
		});
	}

	return results;
}
