/**
 * Scraper Runtime Engine
 *
 * Thin orchestrator that coordinates fetching, extraction, deduplication,
 * and persistence. All heavy lifting is delegated to focused modules:
 *
 * - fetcher.ts    — page fetching (Firecrawl / stealth / HTTP)
 * - extractor.ts  — content-to-opportunity extraction helpers
 * - deduplicator.ts — fingerprint-based dedup (pre-existing)
 * - persister.ts  — scraper run lifecycle in the database
 */

import type { ScraperSource } from "@/lib/db/schema";
import { scraperQueue, type ScraperJob, type ScraperJobResult } from "./queue";
import { deduplicateOpportunity } from "./deduplicator";
import { scrapePage, RateLimiter, withTimeout } from "./fetcher";
import { createRun, finaliseRunSuccess, finaliseRunFailure } from "./persister";
import { logger } from "@/lib/utils/logger";

// Re-export ScrapedPage from fetcher so existing consumers keep working
export type { ScrapedPage } from "./fetcher";

// ============================================================================
// Types
// ============================================================================

function generateUUID(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}

	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

export interface ScraperConfig {
	rateLimit: number;        // Requests per second
	timeout: number;          // Seconds
	maxPages: number;
	maxRetries: number;
	requiresJavascript: boolean;
	requiresAuth: boolean;
	requiresProxy: boolean;
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
// Scraper Runtime
// ============================================================================

export class ScraperRuntime {
	private progressHandlers: Set<ProgressHandler> = new Set();
	private abortControllers: Map<string, AbortController> = new Map();

	// -------------------------------------------------------------------------
	// Progress Handling
	// -------------------------------------------------------------------------

	onProgress(handler: ProgressHandler): () => void {
		this.progressHandlers.add(handler);
		return () => this.progressHandlers.delete(handler);
	}

	private emitProgress(progress: RuntimeProgress): void {
		for (const handler of this.progressHandlers) {
			try {
				handler(progress);
			} catch (error) {
				logger.error("Progress handler error:", error);
			}
		}
	}

	// -------------------------------------------------------------------------
	// Job Execution
	// -------------------------------------------------------------------------

	/**
	 * Execute a scraper job — main entry point.
	 * Creates a run record, iterates through pages, deduplicates results,
	 * and finalises the run as success or failure.
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
		const dbRun = await createRun({
			sourceId: source.id,
			sourceKey: source.sourceId,
			runId,
			batchId: job.batchId,
		});
		await scraperQueue.attachRun(job.id, dbRun.id);

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
			warnings: [],
		};

		try {
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
				`Scraper timed out after ${source.timeout}s per page`,
				() => abortController.abort()
			);

			if (result.pagesScraped === 0) {
				throw new Error("No pages were scraped");
			}

			result.success = true;
			result.partial = result.opportunitiesFailed > 0 || (result.warnings?.length ?? 0) > 0;
			result.durationSeconds = (Date.now() - startTime) / 1000;

			await finaliseRunSuccess(dbRun.id, source.id, result);

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			result.success = false;
			result.error = errorMessage;
			result.durationSeconds = (Date.now() - startTime) / 1000;

			await finaliseRunFailure(dbRun.id, source.id, result, {
				aborted: abortController.signal.aborted,
				errorMessage,
				errorType: error instanceof Error ? error.name : "Unknown",
				progress: job.progress,
			});

		} finally {
			this.abortControllers.delete(job.id);
		}

		return result;
	}

	// -------------------------------------------------------------------------
	// Core Scraping Loop
	// -------------------------------------------------------------------------

	/**
	 * Iterate through pages, scrape each one, and deduplicate opportunities.
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
		let consecutivePageErrors = 0;
		const visitedUrls = new Set<string>();

		while (currentUrl && pageNum < maxPages && !signal.aborted) {
			if (await scraperQueue.isCancelled(job.id)) {
				throw new Error("Job cancelled");
			}

			const normalisedUrl = normalizeUrl(currentUrl);
			if (visitedUrls.has(normalisedUrl)) {
				result.warnings?.push(`Stopped pagination loop at already visited URL: ${currentUrl}`);
				break;
			}
			visitedUrls.add(normalisedUrl);

			await rateLimiter.wait();

			if (signal.aborted) {
				throw new Error("Job cancelled");
			}

			// Update progress
			const progress = Math.round((pageNum / maxPages) * 100);
			await scraperQueue.setJobProgress(job.id, progress);

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
			const page = await scrapePage(currentUrl, source, signal);

			if (await scraperQueue.isCancelled(job.id)) {
				throw new Error("Job cancelled");
			}

			result.pagesScraped++;

			if (page.error) {
				consecutivePageErrors++;
				result.warnings?.push(`Page ${pageNum + 1} (${currentUrl}) failed: ${page.error}`);
				logger.error(`Page scrape error: ${page.error}`);
			} else {
				consecutivePageErrors = 0;
				// Deduplicate and persist each opportunity
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
						result.warnings?.push(
							`Opportunity processing failed on page ${pageNum + 1}: ${error instanceof Error ? error.message : String(error)}`
						);
						logger.error("Opportunity processing error:", error);
					}
				}
			}

			const nextUrl = page.nextPageUrl ? normalizeUrl(page.nextPageUrl) : undefined;
			if (nextUrl && visitedUrls.has(nextUrl)) {
				result.warnings?.push(`Stopped pagination loop before revisiting URL: ${page.nextPageUrl}`);
				currentUrl = undefined;
			} else {
				currentUrl = page.nextPageUrl;
			}
			pageNum++;
		}

		if (result.pagesScraped > 0 && consecutivePageErrors === result.pagesScraped) {
			throw new Error(
				result.warnings?.[result.warnings.length - 1] || "Every scraped page failed"
			);
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

	// -------------------------------------------------------------------------
	// Job Cancellation
	// -------------------------------------------------------------------------

	cancel(jobId: string): boolean {
		const controller = this.abortControllers.get(jobId);
		if (controller) {
			controller.abort();
			return true;
		}
		return false;
	}
}

function normalizeUrl(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return url.trim();
	}
}

// ============================================================================
// Singleton Export
// ============================================================================

export const scraperRuntime = new ScraperRuntime();

// ============================================================================
// Queue Integration
// ============================================================================

import { db } from "@/lib/db";
import { scraperSources } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Job executor function for the queue.
 * Fetches source config and delegates to the runtime.
 */
export async function executeScraperJob(job: ScraperJob): Promise<ScraperJobResult> {
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

	return scraperRuntime.execute(job, source);
}

/**
 * Initialize queue with executor.
 */
export function initializeScraperQueue(): void {
	scraperQueue.setExecutor(executeScraperJob);
}
