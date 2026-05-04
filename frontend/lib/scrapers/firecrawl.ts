/**
 * Firecrawl Integration
 *
 * Client for self-hosted Firecrawl instance.
 * Handles web scraping with JavaScript rendering, rate limiting, and proxy support.
 *
 * API Reference: https://docs.firecrawl.dev/api-reference
 */

// ============================================================================
// Types
// ============================================================================

export interface FirecrawlConfig {
	baseUrl: string;
	apiKey: string;
	timeout?: number;
}

export interface ScrapeOptions {
	/** Formats to return: markdown, html, rawHtml, links, screenshot */
	formats?: Array<"markdown" | "html" | "rawHtml" | "links" | "screenshot">;
	/** Only include specific tags */
	includeTags?: string[];
	/** Exclude specific tags */
	excludeTags?: string[];
	/** Custom headers to send */
	headers?: Record<string, string>;
	/** Wait for selector before scraping */
	waitFor?: number;
	/** Mobile viewport */
	mobile?: boolean;
	/** Skip TLS verification */
	skipTlsVerification?: boolean;
	/** Timeout in milliseconds */
	timeout?: number;
	/** Optional cancellation signal for the outbound Firecrawl request */
	signal?: AbortSignal;
	/** Extract structured data with LLM */
	extract?: {
		schema: Record<string, unknown>;
		systemPrompt?: string;
		prompt?: string;
	};
	/** Actions to perform before scraping (click, scroll, etc.) */
	actions?: Array<{
		type: "wait" | "click" | "screenshot" | "scrape" | "scroll" | "write" | "press";
		selector?: string;
		milliseconds?: number;
		text?: string;
		key?: string;
	}>;
}

export interface ScrapeResult {
	success: boolean;
	data?: {
		markdown?: string;
		html?: string;
		rawHtml?: string;
		links?: string[];
		screenshot?: string;
		metadata?: {
			title?: string;
			description?: string;
			language?: string;
			sourceURL?: string;
			statusCode?: number;
		};
		extract?: Record<string, unknown>;
	};
	error?: string;
}

export interface CrawlOptions {
	/** Exclude paths matching these patterns */
	excludePaths?: string[];
	/** Only include paths matching these patterns */
	includePaths?: string[];
	/** Maximum pages to crawl */
	maxDepth?: number;
	/** Ignore sitemap */
	ignoreSitemap?: boolean;
	/** Maximum number of pages */
	limit?: number;
	/** Allow backward links */
	allowBackwardLinks?: boolean;
	/** Allow external links */
	allowExternalLinks?: boolean;
	/** Webhook URL for async crawl */
	webhook?: string;
	/** Scrape options for each page */
	scrapeOptions?: ScrapeOptions;
}

export interface CrawlResult {
	success: boolean;
	id?: string;
	url?: string;
	status?: "scraping" | "completed" | "failed";
	total?: number;
	completed?: number;
	creditsUsed?: number;
	expiresAt?: string;
	data?: Array<{
		markdown?: string;
		html?: string;
		metadata?: {
			title?: string;
			sourceURL?: string;
			statusCode?: number;
		};
	}>;
	error?: string;
}

// ============================================================================
// Firecrawl Client
// ============================================================================

export class FirecrawlClient {
	private baseUrl: string;
	private apiKey: string;
	private timeout: number;

	constructor(config?: Partial<FirecrawlConfig>) {
		this.baseUrl = config?.baseUrl || process.env.FIRECRAWL_URL || "http://84.247.181.100:3002";
		this.apiKey = config?.apiKey || process.env.FIRECRAWL_KEY || "";
		this.timeout = config?.timeout || 60000;

		// Remove trailing slash
		this.baseUrl = this.baseUrl.replace(/\/$/, "");
	}

	private combineSignals(signals: AbortSignal[]): AbortSignal {
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

	/**
	 * Check if Firecrawl is configured
	 */
	isConfigured(): boolean {
		return !!this.baseUrl;
	}

	/**
	 * Make authenticated request to Firecrawl
	 */
	private async request<T>(
		endpoint: string,
		options: RequestInit = {},
		requestTimeout?: number,
		externalSignal?: AbortSignal
	): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;
		const timeout = requestTimeout || this.timeout;
		const timeoutSignal = AbortSignal.timeout(timeout);

		const response = await fetch(url, {
			...options,
			headers: {
				"Content-Type": "application/json",
				...(this.apiKey ? { "Authorization": `Bearer ${this.apiKey}` } : {}),
				...options.headers,
			},
			signal: externalSignal
				? this.combineSignals([externalSignal, timeoutSignal])
				: timeoutSignal,
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Firecrawl error ${response.status}: ${error}`);
		}

		return response.json();
	}

	/**
	 * Scrape a single URL
	 */
	async scrape(url: string, options?: ScrapeOptions): Promise<ScrapeResult> {
		try {
			const { signal, ...scrapeOptions } = options ?? {};
			const result = await this.request<ScrapeResult>("/v1/scrape", {
				method: "POST",
				body: JSON.stringify({
					url,
					...scrapeOptions,
				}),
			}, options?.timeout, signal);

			return result;
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Start an async crawl job
	 */
	async crawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
		try {
			const result = await this.request<CrawlResult>("/v1/crawl", {
				method: "POST",
				body: JSON.stringify({
					url,
					...options,
				}),
			});

			return result;
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Get crawl job status
	 */
	async getCrawlStatus(crawlId: string): Promise<CrawlResult> {
		try {
			const result = await this.request<CrawlResult>(`/v1/crawl/${crawlId}`, {
				method: "GET",
			});

			return result;
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Cancel a crawl job
	 */
	async cancelCrawl(crawlId: string): Promise<{ success: boolean }> {
		try {
			await this.request(`/v1/crawl/${crawlId}`, {
				method: "DELETE",
			});
			return { success: true };
		} catch (error) {
			return { success: false };
		}
	}

	/**
	 * Map a website's URLs (fast, no content)
	 */
	async map(url: string, options?: {
		search?: string;
		ignoreSitemap?: boolean;
		includeSubdomains?: boolean;
		limit?: number;
	}): Promise<{ success: boolean; links?: string[]; error?: string }> {
		try {
			const result = await this.request<{ success: boolean; links: string[] }>("/v1/map", {
				method: "POST",
				body: JSON.stringify({
					url,
					...options,
				}),
			});

			return result;
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Default Firecrawl client instance
 */
export const firecrawl = new FirecrawlClient();

// ============================================================================
// Opportunity Extraction Helpers
// ============================================================================

/**
 * Extract structured opportunity data from scraped content using patterns.
 * This is a fallback when LLM extraction is not available.
 */
export function extractOpportunitiesFromMarkdown(
	markdown: string,
	sourceUrl: string
): Array<{
	title: string;
	organization?: string;
	deadline?: string;
	description?: string;
	url?: string;
}> {
	const opportunities: Array<{
		title: string;
		organization?: string;
		deadline?: string;
		description?: string;
		url?: string;
	}> = [];

	// Common patterns for tender/RFP listings
	// This is a basic implementation - production would use LLM extraction

	// Pattern 1: Look for links with tender-like text
	const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
	let match;

	while ((match = linkPattern.exec(markdown)) !== null) {
		const [, text, url] = match;
		const lowerText = text.toLowerCase();

		// Check if this looks like a tender/RFP link
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
				url: url.startsWith("http") ? url : new URL(url, sourceUrl).toString(),
			});
		}
	}

	// Pattern 2: Look for table rows (common in tender listings)
	const tableRowPattern = /\|([^|]+)\|([^|]+)\|([^|]+)\|/g;
	while ((match = tableRowPattern.exec(markdown)) !== null) {
		const cells = [match[1], match[2], match[3]].map(c => c.trim());

		// Skip header rows
		if (cells.some(c => c.includes("---"))) continue;

		// Try to identify which cell is which
		const datePattern = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/;

		for (let i = 0; i < cells.length; i++) {
			if (cells[i].length > 20 && !datePattern.test(cells[i])) {
				// Likely a title
				const opp: {
					title: string;
					organization?: string;
					deadline?: string;
					description?: string;
					url?: string;
				} = { title: cells[i] };

				// Check other cells for dates
				for (let j = 0; j < cells.length; j++) {
					if (i !== j && datePattern.test(cells[j])) {
						opp.deadline = cells[j];
						break;
					}
				}

				opportunities.push(opp);
				break;
			}
		}
	}

	return opportunities;
}

/**
 * LLM-based extraction schema for opportunities
 * Use with Firecrawl's extract feature
 */
export const opportunityExtractionSchema = {
	type: "object",
	properties: {
		opportunities: {
			type: "array",
			items: {
				type: "object",
				properties: {
					title: { type: "string", description: "Title of the tender/RFP/opportunity" },
					organization: { type: "string", description: "Issuing organization" },
					deadline: { type: "string", description: "Submission deadline date" },
					reference: { type: "string", description: "Reference/notice number" },
					category: { type: "string", description: "Category or sector" },
					location: { type: "string", description: "Country or region" },
					budget: { type: "string", description: "Budget or value if mentioned" },
					description: { type: "string", description: "Brief description" },
					url: { type: "string", description: "Link to full details" },
				},
				required: ["title"],
			},
		},
	},
};
