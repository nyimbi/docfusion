/**
 * Scraper Module Exports
 *
 * Core scraper infrastructure for TenderSourceMax integration.
 */

// Queue system
export {
	scraperQueue,
	type ScraperJob,
	type ScraperJobResult,
	type JobStatus,
	type JobPriority,
	type AddJobOptions,
	type QueueConfig,
	type QueueEventType,
	type QueueEvent,
	type ProgressCallback,
	type JobExecutor,
} from "./queue";

// Runtime engine (orchestrator)
export {
	scraperRuntime,
	ScraperRuntime,
	executeScraperJob,
	initializeScraperQueue,
	type ScraperConfig,
	type ScrapedPage,
	type RuntimeProgress,
	type ProgressHandler,
} from "./runtime";

// Fetcher (page fetching strategies)
export {
	scrapePage,
	RateLimiter,
	withTimeout,
} from "./fetcher";

// Extractor (content-to-opportunity conversion)
export {
	extractOpportunitiesFromContent,
	extractFromBasicHtml,
	findNextPageUrl,
	generateNoticeId,
} from "./extractor";

// Persister (run lifecycle management)
export {
	createRun,
	finaliseRunSuccess,
	finaliseRunFailure,
	type CreateRunParams,
	type RunRecord,
} from "./persister";

// Deduplication
export {
	generateFingerprint,
	generateFuzzyFingerprint,
	deduplicateOpportunity,
	bulkDeduplicateOpportunities,
	opportunityExists,
	findPotentialDuplicates,
	type OpportunityData,
	type DeduplicationResult,
	type BulkDeduplicationResult,
} from "./deduplicator";
