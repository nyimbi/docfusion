/**
 * Scraper Runtime Engine
 *
 * Executes scraper jobs with rate limiting, timeout handling,
 * and progress tracking. Uses Firecrawl for web scraping with
 * JavaScript rendering support, with fallback to basic HTTP fetch.
 *
 * Architecture:
 * - Firecrawl integration for JS-rendered pages (primary)
 * - Basic HTTP fetch fallback when Firecrawl unavailable
 * - Rate limiting with configurable requests/second
 * - Timeout enforcement from source config
 * - Page limit enforcement
 * - Error capture and structured logging
 * - Progress callbacks for real-time updates
 */

import type { ScraperSource } from "@/lib/db/schema";
import { createScraperRun, updateScraperRun, updateSourceMetrics } from "@/lib/actions/scraper-sources";
import { scraperQueue, type ScraperJob, type ScraperJobResult } from "./queue";
import { deduplicateOpportunity, type OpportunityData } from "./deduplicator";
import { firecrawl, extractOpportunitiesFromMarkdown, type ScrapeResult } from "./firecrawl";

// UUID generation - inline for serverless compatibility
function generateUUID(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

// ============================================================================
// Types
// ============================================================================

export interface ScraperConfig {
	rateLimit: number;        // Requests per second
	timeout: number;          // Seconds
	maxPages: number;
	maxRetries: number;
	requiresJavascript: boolean;
	requiresAuth: boolean;
	requiresProxy: boolean;
}

export interface ScrapedPage {
	url: string;
	statusCode: number;
	opportunities: OpportunityData[];
	nextPageUrl?: string;
	error?: string;
}

export interface RuntimeProgress {
	jobId: string;
	runId: string;
	progress: number;
	pagesScraped: number;
	opportunitiesFound: number;
	currentUrl?: string;
	status: string;
}

export type ProgressHandler = (progress: RuntimeProgress) => void;

// ============================================================================
// Rate Limiter
// ============================================================================

class RateLimiter {
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
// Timeout Handler
// ============================================================================

function withTimeout<T>(
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
// Scraper Runtime
// ============================================================================

export class ScraperRuntime {
	private progressHandlers: Set<ProgressHandler> = new Set();
	private abortControllers: Map<string, AbortController> = new Map();

	// -------------------------------------------------------------------------
	// Progress Handling
	// -------------------------------------------------------------------------

	/**
	 * Register a progress handler
	 */
	onProgress(handler: ProgressHandler): () => void {
		this.progressHandlers.add(handler);
		return () => this.progressHandlers.delete(handler);
	}

	/**
	 * Emit progress to all handlers
	 */
	private emitProgress(progress: RuntimeProgress): void {
		for (const handler of this.progressHandlers) {
			try {
				handler(progress);
			} catch (error) {
				console.error("Progress handler error:", error);
			}
		}
	}

	// -------------------------------------------------------------------------
	// Job Execution
	// -------------------------------------------------------------------------

	/**
	 * Execute a scraper job - this is the main entry point
	 */
	async execute(
		job: ScraperJob,
		source: ScraperSource
	): Promise<ScraperJobResult> {
		const runId = `${source.sourceId}_${generateUUID()}`;
		const startTime = Date.now();
		const abortController = new AbortController();
		this.abortControllers.set(job.id, abortController);

		// Create run record
		const dbRun = await createScraperRun({
			sourceId: source.id,
			sourceKey: source.sourceId,
			runId,
			batchId: job.batchId,
			triggerType: "manual",
			startedAt: new Date(),
			status: "running",
			progress: 0,
		});

		const result: ScraperJobResult = {
			runId: dbRun.id,
			opportunitiesFound: 0,
			opportunitiesNew: 0,
			opportunitiesUpdated: 0,
			opportunitiesSkipped: 0,
			opportunitiesFailed: 0,
			pagesScraped: 0,
			durationSeconds: 0,
			success: false,
		};

		try {
			// Execute scraping with timeout
			const timeoutMs = (source.timeout || 30) * 1000;
			const scrapingPromise = this.scrapeSource(
				job,
				source,
				dbRun.id,
				result,
				abortController.signal
			);

			await withTimeout(
				scrapingPromise,
				timeoutMs * source.maxPages, // Scale timeout by pages
				`Scraper timed out after ${source.timeout}s per page`
			);

			result.success = true;
			result.durationSeconds = (Date.now() - startTime) / 1000;

			// Update run record as successful
			await updateScraperRun(dbRun.id, {
				status: "success",
				completedAt: new Date(),
				durationSeconds: result.durationSeconds,
				progress: 100,
				opportunitiesFound: result.opportunitiesFound,
				opportunitiesNew: result.opportunitiesNew,
				opportunitiesUpdated: result.opportunitiesUpdated,
				opportunitiesSkipped: result.opportunitiesSkipped,
				opportunitiesFailed: result.opportunitiesFailed,
				pagesScraped: result.pagesScraped,
			});

			// Update source metrics
			await updateSourceMetrics(source.id, {
				success: true,
				opportunitiesFound: result.opportunitiesFound,
				uniqueOpportunities: result.opportunitiesNew,
				durationSeconds: result.durationSeconds,
			});

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			result.success = false;
			result.error = errorMessage;
			result.durationSeconds = (Date.now() - startTime) / 1000;

			// Update run record as failed
			await updateScraperRun(dbRun.id, {
				status: abortController.signal.aborted ? "cancelled" : "failed",
				completedAt: new Date(),
				durationSeconds: result.durationSeconds,
				progress: job.progress,
				errorMessage,
				errorType: error instanceof Error ? error.name : "Unknown",
				opportunitiesFound: result.opportunitiesFound,
				opportunitiesNew: result.opportunitiesNew,
				pagesScraped: result.pagesScraped,
			});

			// Update source metrics with failure
			await updateSourceMetrics(source.id, {
				success: false,
				opportunitiesFound: result.opportunitiesFound,
				uniqueOpportunities: result.opportunitiesNew,
				durationSeconds: result.durationSeconds,
				error: errorMessage,
			});

		} finally {
			this.abortControllers.delete(job.id);
		}

		return result;
	}

	/**
	 * Core scraping logic - iterates through pages
	 */
	private async scrapeSource(
		job: ScraperJob,
		source: ScraperSource,
		runId: string,
		result: ScraperJobResult,
		signal: AbortSignal
	): Promise<void> {
		const rateLimiter = new RateLimiter(source.rateLimit || 1);
		const maxPages = source.maxPages || 10;
		let currentUrl: string | undefined = source.url;
		let pageNum = 0;

		while (currentUrl && pageNum < maxPages && !signal.aborted) {
			// Rate limit
			await rateLimiter.wait();

			// Check cancellation
			if (signal.aborted) {
				throw new Error("Job cancelled");
			}

			// Update progress
			const progress = Math.round((pageNum / maxPages) * 100);
			scraperQueue.updateProgress(job.id, progress);

			this.emitProgress({
				jobId: job.id,
				runId,
				progress,
				pagesScraped: pageNum,
				opportunitiesFound: result.opportunitiesFound,
				currentUrl,
				status: "running",
			});

			// Scrape the page
			const page = await this.scrapePage(
				currentUrl,
				source,
				signal
			);

			result.pagesScraped++;

			if (page.error) {
				// Log error but continue to next page
				console.error(`Page scrape error: ${page.error}`);
			} else {
				// Process opportunities
				for (const opp of page.opportunities) {
					try {
						const dedupResult = await deduplicateOpportunity(opp, source.id);

						result.opportunitiesFound++;

						if (dedupResult.action === "inserted") {
							result.opportunitiesNew++;
						} else if (dedupResult.action === "updated") {
							result.opportunitiesUpdated++;
						} else {
							result.opportunitiesSkipped++;
						}
					} catch (error) {
						result.opportunitiesFailed++;
						console.error("Opportunity processing error:", error);
					}
				}
			}

			// Get next page URL
			currentUrl = page.nextPageUrl;
			pageNum++;
		}

		// Final progress update
		this.emitProgress({
			jobId: job.id,
			runId,
			progress: 100,
			pagesScraped: result.pagesScraped,
			opportunitiesFound: result.opportunitiesFound,
			status: "completed",
		});
	}

	/**
	 * Scrape a single page using Firecrawl or fallback to basic fetch
	 */
	private async scrapePage(
		url: string,
		source: ScraperSource,
		signal: AbortSignal
	): Promise<ScrapedPage> {
		try {
			if (signal.aborted) {
				throw new Error("Job cancelled");
			}

			// Try Firecrawl first if configured
			if (firecrawl.isConfigured()) {
				return await this.scrapeWithFirecrawl(url, source);
			}

			// Fallback to basic HTTP fetch
			return await this.scrapeWithFetch(url, source, signal);

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

	/**
	 * Scrape using Firecrawl - handles JavaScript rendering
	 */
	private async scrapeWithFirecrawl(
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

		const opportunities = this.extractOpportunities(
			result.data.markdown || "",
			result.data.links || [],
			url,
			source
		);

		const nextPageUrl = this.findNextPageUrl(result.data.links || [], url);

		return {
			url,
			statusCode: result.data.metadata?.statusCode || 200,
			opportunities,
			nextPageUrl,
		};
	}

	/**
	 * Fallback scrape using basic HTTP fetch
	 */
	private async scrapeWithFetch(
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
		const opportunities = this.extractFromBasicHtml(html, url, source);

		return {
			url,
			statusCode: response.status,
			opportunities,
			nextPageUrl: undefined,
		};
	}

	/**
	 * Extract opportunities from Firecrawl markdown output
	 */
	private extractOpportunities(
		markdown: string,
		links: string[],
		sourceUrl: string,
		source: ScraperSource
	): OpportunityData[] {
		const rawOpps = extractOpportunitiesFromMarkdown(markdown, sourceUrl);

		return rawOpps.map(opp => ({
			title: opp.title,
			source: source.sourceId,
			organization: opp.organization || source.name,
			deadline: opp.deadline ? new Date(opp.deadline) : undefined,
			projectSummary: opp.description,
			portalUrl: opp.url || sourceUrl,
			noticeId: this.generateNoticeId(opp.title, opp.organization),
		}));
	}

	/**
	 * Basic HTML extraction fallback (without Firecrawl)
	 */
	private extractFromBasicHtml(
		html: string,
		sourceUrl: string,
		source: ScraperSource
	): OpportunityData[] {
		const opportunities: OpportunityData[] = [];
		const titlePattern = /<(?:h[1-6]|a|td)[^>]*>([^<]*(?:tender|rfp|rfq|bid|procurement|eoi)[^<]*)<\/(?:h[1-6]|a|td)>/gi;
		let match;

		while ((match = titlePattern.exec(html)) !== null) {
			const title = match[1].trim();
			if (title.length > 10 && title.length < 500) {
				opportunities.push({
					title,
					source: source.sourceId,
					organization: source.name,
					portalUrl: sourceUrl,
					noticeId: this.generateNoticeId(title, source.name),
				});
			}
		}

		return opportunities;
	}

	/**
	 * Find next page URL from scraped links
	 */
	private findNextPageUrl(links: string[], currentUrl: string): string | undefined {
		for (const link of links) {
			const lowerLink = link.toLowerCase();
			if (
				lowerLink.includes("next") ||
				lowerLink.includes("page=2") ||
				lowerLink.includes("/page/2")
			) {
				try {
					const linkUrl = new URL(link, currentUrl);
					const currentUrlObj = new URL(currentUrl);
					if (linkUrl.hostname === currentUrlObj.hostname) {
						return linkUrl.toString();
					}
				} catch {
					// Invalid URL, skip
				}
			}
		}
		return undefined;
	}

	/**
	 * Generate a notice ID from title and organization
	 */
	private generateNoticeId(title: string, organization?: string | null): string {
		const normalized = `${title}-${organization || ""}`.toLowerCase().replace(/[^a-z0-9]/g, "-");
		return normalized.substring(0, 100);
	}

	/**
	 * Cancel a running job
	 */
	cancel(jobId: string): boolean {
		const controller = this.abortControllers.get(jobId);
		if (controller) {
			controller.abort();
			return true;
		}
		return false;
	}
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Global scraper runtime instance
 */
export const scraperRuntime = new ScraperRuntime();

// ============================================================================
// Queue Integration
// ============================================================================

import { db } from "@/lib/db";
import { scraperSources } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Job executor function for the queue
 * Fetches source config and executes scraper
 */
export async function executeScraperJob(job: ScraperJob): Promise<ScraperJobResult> {
	// Fetch source configuration
	const source = await db.query.scraperSources.findFirst({
		where: eq(scraperSources.id, job.sourceId),
	});

	if (!source) {
		return {
			runId: "",
			opportunitiesFound: 0,
			opportunitiesNew: 0,
			opportunitiesUpdated: 0,
			opportunitiesSkipped: 0,
			opportunitiesFailed: 0,
			pagesScraped: 0,
			durationSeconds: 0,
			success: false,
			error: `Source not found: ${job.sourceId}`,
		};
	}

	// Execute the scraper
	return scraperRuntime.execute(job, source);
}

/**
 * Initialize queue with executor
 */
export function initializeScraperQueue(): void {
	scraperQueue.setExecutor(executeScraperJob);
}
