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

// Runtime engine
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
