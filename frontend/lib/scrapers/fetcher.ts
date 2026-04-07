/**
 * Page Fetcher
 *
 * Fetches web pages using multiple strategies:
 * 1. Firecrawl (primary) — JS rendering, anti-bot handling
 * 2. Stealth scraper (fallback) — Crawlee-based, human-like browsing
 * 3. Basic HTTP fetch (last resort) — plain fetch with UA spoofing
 *
 * Each strategy normalises its output into a ScrapedPage with parsed
 * opportunities via the parser registry.
 */

import type { ScraperSource } from "@/lib/db/schema";
import type { OpportunityData } from "./deduplicator";
import { firecrawl } from "./firecrawl";
import { getParser, genericParser, type ParseInput } from "./parsers";
import { extractFromBasicHtml, findNextPageUrl } from "./extractor";
import { logger } from "@/lib/utils/logger";

// ============================================================================
// Types
// ============================================================================

export interface ScrapedPage {
	url: string;
	statusCode: number;
	opportunities: OpportunityData[];
	nextPageUrl?: string;
	error?: string;
}

/**
 * Stealth scraper response shape from the Crawlee-based service.
 */
interface StealthScrapeResponse {
	success: boolean;
	data?: {
		markdown?: string;
		links?: string[];
		metadata?: { statusCode?: number };
	};
	error?: string;
}

// ============================================================================
// Rate Limiter
// ============================================================================

/**
 * Token-bucket rate limiter.
 * Enforces a minimum interval between outgoing requests.
 */
export class RateLimiter {
	private lastRequest: number = 0;
	private minInterval: number;

	constructor(requestsPerSecond: number) {
		this.minInterval = 1000 / requestsPerSecond;
	}

	async wait(): Promise<void> {
		const now = Date.now();
		const elapsed = now - this.lastRequest;

		if (elapsed < this.minInterval) {
			const delay = this.minInterval - elapsed;
			await new Promise(resolve => setTimeout(resolve, delay));
		}

		this.lastRequest = Date.now();
	}
}

// ============================================================================
// Timeout Wrapper
// ============================================================================

/**
 * Race a promise against a timeout. Rejects with `message` if the
 * timeout fires first; cleans up properly in either case.
 */
export function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	message = "Operation timed out"
): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(message));
		}, timeoutMs);

		promise
			.then(result => {
				clearTimeout(timer);
				resolve(result);
			})
			.catch(error => {
				clearTimeout(timer);
				reject(error);
			});
	});
}

// ============================================================================
// Page Fetching
// ============================================================================

/**
 * Scrape a single page, selecting the best available strategy.
 *
 * Strategy order:
 * 1. Firecrawl (if configured) — falls back to stealth on anti-bot block
 * 2. Basic HTTP fetch (if Firecrawl unavailable)
 */
export async function scrapePage(
	url: string,
	source: ScraperSource,
	signal: AbortSignal
): Promise<ScrapedPage> {
	try {
		if (signal.aborted) {
			throw new Error("Job cancelled");
		}

		if (firecrawl.isConfigured()) {
			const result = await scrapeWithFirecrawl(url, source);

			// If Firecrawl was blocked by anti-bot, try stealth scraper
			if (!result.opportunities.length && result.error?.includes("SCRAPE_ALL_ENGINES_FAILED")) {
				logger.debug(`[Scraper] Firecrawl blocked for ${url}, trying stealth scraper...`);
				return await scrapeWithStealth(url, source);
			}

			return result;
		}

		return await scrapeWithFetch(url, source, signal);

	} catch (error) {
		if (signal.aborted) {
			throw error;
		}

		return {
			url,
			statusCode: 0,
			opportunities: [],
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

// ============================================================================
// Strategy: Firecrawl
// ============================================================================

/**
 * Scrape using Firecrawl — handles JavaScript rendering.
 * Uses site-specific parser if available, falls back to generic extraction.
 */
async function scrapeWithFirecrawl(
	url: string,
	source: ScraperSource
): Promise<ScrapedPage> {
	const result = await firecrawl.scrape(url, {
		formats: ["markdown", "links"],
		timeout: (source.timeout || 30) * 1000,
		waitFor: source.requiresJavascript ? 3000 : undefined,
	});

	if (!result.success || !result.data) {
		return {
			url,
			statusCode: result.data?.metadata?.statusCode || 0,
			opportunities: [],
			error: result.error || "Firecrawl scrape failed",
		};
	}

	const parseInput: ParseInput = {
		markdown: result.data.markdown || "",
		links: result.data.links || [],
		url,
	};

	const parser = getParser(source.sourceId) || genericParser;
	const parseResult = await parser.parse(parseInput);

	const opportunities = parseResult.opportunities.map(opp => ({
		...opp,
		source: source.sourceId,
		organization: opp.organization || source.name,
	}));

	const nextPageUrl = parseResult.nextPageUrl || findNextPageUrl(result.data.links || [], url);

	return {
		url,
		statusCode: result.data.metadata?.statusCode || 200,
		opportunities,
		nextPageUrl,
	};
}

// ============================================================================
// Strategy: Stealth Scraper (Crawlee)
// ============================================================================

/**
 * Scrape using stealth scraper service (Crawlee-based).
 * Used as fallback when Firecrawl is blocked by anti-bot protection.
 */
async function scrapeWithStealth(
	url: string,
	source: ScraperSource
): Promise<ScrapedPage> {
	const stealthUrl = process.env.STEALTH_SCRAPER_URL || "http://localhost:3003";

	try {
		const response = await fetch(`${stealthUrl}/v1/scrape`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				url,
				options: {
					timeout: (source.timeout || 60) * 1000,
					humanScroll: true,
					blockMedia: true,
				},
			}),
			signal: AbortSignal.timeout((source.timeout || 60) * 1000 + 10000),
		});

		if (!response.ok) {
			const error = await response.text();
			return {
				url,
				statusCode: response.status,
				opportunities: [],
				error: `Stealth scraper error: ${error}`,
			};
		}

		const result = await response.json() as StealthScrapeResponse;

		if (!result.success || !result.data) {
			return {
				url,
				statusCode: 0,
				opportunities: [],
				error: result.error || "Stealth scrape failed",
			};
		}

		const parseInput: ParseInput = {
			markdown: result.data.markdown || "",
			links: result.data.links || [],
			url,
		};

		const parser = getParser(source.sourceId) || genericParser;
		const parseResult = await parser.parse(parseInput);

		const opportunities = parseResult.opportunities.map(opp => ({
			...opp,
			source: source.sourceId,
			organization: opp.organization || source.name,
		}));

		return {
			url,
			statusCode: result.data.metadata?.statusCode || 200,
			opportunities,
			nextPageUrl: parseResult.nextPageUrl,
		};
	} catch (error) {
		return {
			url,
			statusCode: 0,
			opportunities: [],
			error: `Stealth scraper unavailable: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

// ============================================================================
// Strategy: Basic HTTP Fetch
// ============================================================================

/**
 * Fallback scrape using basic HTTP fetch.
 * Uses site-specific parser if available, falls back to basic HTML extraction.
 */
async function scrapeWithFetch(
	url: string,
	source: ScraperSource,
	signal: AbortSignal
): Promise<ScrapedPage> {
	const response = await fetch(url, {
		signal,
		headers: {
			"User-Agent": "DocuFusion-Scraper/1.0 (+https://docufusion.ai/bot)",
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.5",
		},
	});

	if (!response.ok) {
		return {
			url,
			statusCode: response.status,
			opportunities: [],
			error: `HTTP ${response.status}: ${response.statusText}`,
		};
	}

	const html = await response.text();

	const parseInput: ParseInput = {
		html,
		url,
	};

	// Try site-specific parser first
	const parser = getParser(source.sourceId);
	if (parser) {
		const parseResult = await parser.parse(parseInput);
		const opportunities = parseResult.opportunities.map(opp => ({
			...opp,
			source: source.sourceId,
			organization: opp.organization || source.name,
		}));

		return {
			url,
			statusCode: response.status,
			opportunities,
			nextPageUrl: parseResult.nextPageUrl,
		};
	}

	// Fall back to basic HTML extraction
	const opportunities = extractFromBasicHtml(html, url, source);

	return {
		url,
		statusCode: response.status,
		opportunities,
		nextPageUrl: undefined,
	};
}
