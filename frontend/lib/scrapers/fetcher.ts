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

const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_CONFIGURED_RESPONSE_BYTES = 25 * 1024 * 1024;

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
		const safeRate = Number.isFinite(requestsPerSecond) && requestsPerSecond > 0
			? Math.min(requestsPerSecond, 20)
			: 1;
		this.minInterval = 1000 / safeRate;
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

function configNumber(
	source: ScraperSource,
	key: string,
	fallback: number,
	max: number
): number {
	const config = source.config as Record<string, unknown> | null;
	const value = config?.[key];
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		return fallback;
	}
	return Math.min(value, max);
}

function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
	const controller = new AbortController();

	const abort = () => {
		if (!controller.signal.aborted) {
			controller.abort();
		}
	};

	for (const signal of signals) {
		if (signal.aborted) {
			abort();
			break;
		}
		signal.addEventListener("abort", abort, { once: true });
	}

	return controller.signal;
}

async function readTextWithLimit(response: Response, maxBytes: number): Promise<string> {
	const contentLength = response.headers.get("content-length");
	if (contentLength && Number(contentLength) > maxBytes) {
		throw new Error(`Response too large: ${contentLength} bytes exceeds ${maxBytes}`);
	}

	if (!response.body) {
		return response.text();
	}

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (!value) continue;

		total += value.byteLength;
		if (total > maxBytes) {
			try {
				await reader.cancel();
			} catch {
				// Best-effort stream cleanup.
			}
			throw new Error(`Response too large: exceeded ${maxBytes} bytes`);
		}
		chunks.push(value);
	}

	const body = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return new TextDecoder("utf-8").decode(body);
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
	message = "Operation timed out",
	onTimeout?: () => void
): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			onTimeout?.();
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
			const result = await scrapeWithFirecrawl(url, source, signal);

			if (signal.aborted) {
				throw new Error("Job cancelled");
			}

			const shouldFallback =
				source.requiresJavascript ||
				source.requiresProxy ||
				(
					!result.opportunities.length &&
					!!result.error &&
					(
						result.error.includes("SCRAPE_ALL_ENGINES_FAILED") ||
						result.error.includes("blocked") ||
						result.error.includes("timeout") ||
						result.statusCode >= 400
					)
				);

			if (shouldFallback) {
				logger.debug(`[Scraper] Firecrawl could not extract ${url}, trying stealth scraper...`);
				const stealthResult = await scrapeWithStealth(url, source, signal);
				if (!stealthResult.error || stealthResult.opportunities.length > 0) {
					return stealthResult;
				}
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
	source: ScraperSource,
	signal: AbortSignal
): Promise<ScrapedPage> {
	const result = await firecrawl.scrape(url, {
		formats: ["markdown", "links"],
		timeout: (source.timeout || 30) * 1000,
		waitFor: source.requiresJavascript ? 3000 : undefined,
		signal,
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
	source: ScraperSource,
	signal: AbortSignal
): Promise<ScrapedPage> {
	const stealthUrl = process.env.STEALTH_SCRAPER_URL || "http://localhost:3003";
	const timeoutSignal = AbortSignal.timeout((source.timeout || 60) * 1000 + 10000);

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
			signal: combineAbortSignals([signal, timeoutSignal]),
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
	const maxBytes = configNumber(
		source,
		"maxResponseBytes",
		DEFAULT_MAX_RESPONSE_BYTES,
		MAX_CONFIGURED_RESPONSE_BYTES,
	);
	const response = await fetch(url, {
		signal,
		redirect: "follow",
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

	const contentType = response.headers.get("content-type") || "";
	if (
		contentType &&
		!contentType.includes("text/html") &&
		!contentType.includes("application/xhtml+xml") &&
		!contentType.includes("application/xml") &&
		!contentType.includes("text/plain")
	) {
		return {
			url,
			statusCode: response.status,
			opportunities: [],
			error: `Unsupported content type: ${contentType}`,
		};
	}

	const html = await readTextWithLimit(response, maxBytes);

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
