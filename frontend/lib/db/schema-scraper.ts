/**
 * Scraper Sources Database Schema
 *
 * Tables for managing TenderSourceMax scraper configuration, tracking runs,
 * and monitoring health metrics.
 *
 * Migrated from YAML registry for better persistence and metrics tracking.
 */

import {
	pgTable,
	text,
	timestamp,
	integer,
	jsonb,
	uuid,
	varchar,
	boolean,
	real,
	index,
	uniqueIndex,
	pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// Enums
// ============================================================================

export const scraperSourceTypeEnum = pgEnum("scraper_source_type", [
	"mdb",           // Multilateral Development Bank
	"un_agency",     // UN Agency
	"aggregator",    // Multi-source aggregator
	"government",    // Government portal
	"regional",      // Regional organization
	"bilateral",     // Bilateral donor
	"ngo",           // NGO/Foundation
	"commercial",    // Commercial/private sector
]);

export const scraperHealthStatusEnum = pgEnum("scraper_health_status", [
	"healthy",       // Last run successful
	"degraded",      // Partially successful
	"failing",       // Recent failures
	"unknown",       // Never run or stale
	"disabled",      // Manually disabled
]);

export const scraperRunStatusEnum = pgEnum("scraper_run_status", [
	"pending",       // Queued for execution
	"running",       // Currently executing
	"success",       // Completed successfully
	"partial",       // Completed with some failures
	"failed",        // Failed completely
	"timeout",       // Timed out
	"cancelled",     // Manually cancelled
]);

// ============================================================================
// Scraper Sources - Configuration table
// ============================================================================

export const scraperSources = pgTable(
	"scraper_sources",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		// Identity
		/** Unique source identifier (e.g., "ungm", "afdb", "kenya_ppip") */
		sourceId: varchar("source_id", { length: 50 }).notNull().unique(),
		/** Human-readable name */
		name: varchar("name", { length: 200 }).notNull(),
		/** Base URL of the source */
		url: text("url").notNull(),

		// Classification
		/** Type of source */
		sourceType: scraperSourceTypeEnum("source_type").notNull().default("aggregator"),
		/** Countries/regions covered */
		coverage: jsonb("coverage").notNull().default([]),
		/** Primary language */
		language: varchar("language", { length: 10 }).default("en"),

		// Scraper Configuration
		/** Full path to scraper class */
		scraperClass: varchar("scraper_class", { length: 200 }),
		/** Rate limit (requests per second) */
		rateLimit: real("rate_limit").notNull().default(1.0),
		/** Request timeout in seconds */
		timeout: integer("timeout").notNull().default(30),
		/** Maximum pages to scrape per run */
		maxPages: integer("max_pages").notNull().default(10),
		/** Maximum retries per request */
		maxRetries: integer("max_retries").notNull().default(3),
		/** Requires JavaScript rendering (Playwright) */
		requiresJavascript: boolean("requires_javascript").notNull().default(false),
		/** Requires authentication */
		requiresAuth: boolean("requires_auth").notNull().default(false),
		/** Requires proxy rotation */
		requiresProxy: boolean("requires_proxy").notNull().default(false),

		// Scheduling
		/** Schedule tier (1=6hr, 2=12hr, 3=daily) */
		scheduleTier: integer("schedule_tier").notNull().default(3),
		/** Custom cron expression (overrides tier) */
		cronExpression: varchar("cron_expression", { length: 50 }),
		/** Priority level (1=critical, 2=important, 3=standard) */
		priority: integer("priority").notNull().default(2),
		/** Whether the source is enabled for scraping */
		enabled: boolean("enabled").notNull().default(true),

		// Health & Metrics (Updated by scraper runs)
		/** Current health status */
		healthStatus: scraperHealthStatusEnum("health_status").notNull().default("unknown"),
		/** Last successful scrape timestamp */
		lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
		/** Last run timestamp (success or failure) */
		lastRunAt: timestamp("last_run_at", { withTimezone: true }),
		/** Last error message */
		lastError: text("last_error"),
		/** Total opportunities ever scraped */
		totalOpportunitiesScraped: integer("total_opportunities_scraped").notNull().default(0),
		/** Opportunities from last successful run */
		lastOpportunitiesCount: integer("last_opportunities_count").default(0),
		/** Total successful runs */
		successfulRuns: integer("successful_runs").notNull().default(0),
		/** Total failed runs */
		failedRuns: integer("failed_runs").notNull().default(0),
		/** Average run duration in seconds */
		avgRunDurationSeconds: real("avg_run_duration_seconds"),
		/** Success rate (0-100) */
		successRate: real("success_rate"),

		// Value Metrics
		/** Average opportunities per successful run */
		avgOpportunitiesPerRun: real("avg_opportunities_per_run"),
		/** Unique opportunities contributed (deduplicated) */
		uniqueOpportunitiesContributed: integer("unique_opportunities_contributed").notNull().default(0),
		/** Data quality score (0-100, based on field completeness) */
		dataQualityScore: real("data_quality_score"),
		/** Value score (composite of volume, quality, uniqueness) */
		valueScore: real("value_score"),

		// Metadata
		/** Notes about this source */
		notes: text("notes"),
		/** Additional configuration as JSON */
		config: jsonb("config"),
		/** Authentication credentials (encrypted reference) */
		authConfig: jsonb("auth_config"),

		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("scraper_sources_source_id_idx").on(table.sourceId),
		index("scraper_sources_type_idx").on(table.sourceType),
		index("scraper_sources_tier_idx").on(table.scheduleTier),
		index("scraper_sources_enabled_idx").on(table.enabled),
		index("scraper_sources_health_idx").on(table.healthStatus),
		index("scraper_sources_last_run_idx").on(table.lastRunAt),
	]
);

// ============================================================================
// Scraper Runs - Execution history
// ============================================================================

export const scraperRuns = pgTable(
	"scraper_runs",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		// Source reference
		sourceId: uuid("source_id").notNull().references(() => scraperSources.id, { onDelete: "cascade" }),
		/** Source identifier for quick lookups */
		sourceKey: varchar("source_key", { length: 50 }).notNull(),

		// Run identification
		/** Unique run identifier (e.g., "ungm_20260203_143000") */
		runId: varchar("run_id", { length: 100 }).notNull(),
		/** Orchestration batch ID (groups runs from same trigger) */
		batchId: varchar("batch_id", { length: 100 }),
		/** What triggered this run */
		triggerType: varchar("trigger_type", { length: 20 }).notNull().default("scheduled"),

		// Timing
		startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		/** Duration in seconds */
		durationSeconds: real("duration_seconds"),

		// Status
		status: scraperRunStatusEnum("status").notNull().default("pending"),
		/** Progress percentage (0-100) */
		progress: integer("progress").default(0),

		// Results
		/** Total opportunities found */
		opportunitiesFound: integer("opportunities_found").notNull().default(0),
		/** New opportunities (not seen before) */
		opportunitiesNew: integer("opportunities_new").notNull().default(0),
		/** Updated existing opportunities */
		opportunitiesUpdated: integer("opportunities_updated").notNull().default(0),
		/** Skipped (duplicates within run) */
		opportunitiesSkipped: integer("opportunities_skipped").notNull().default(0),
		/** Failed to process */
		opportunitiesFailed: integer("opportunities_failed").notNull().default(0),

		// Pages & Requests
		/** Pages scraped */
		pagesScraped: integer("pages_scraped").notNull().default(0),
		/** HTTP requests made */
		requestsMade: integer("requests_made").notNull().default(0),
		/** Rate limit hits */
		rateLimitHits: integer("rate_limit_hits").notNull().default(0),
		/** Bytes downloaded */
		bytesDownloaded: integer("bytes_downloaded").notNull().default(0),

		// Errors
		/** Primary error message if failed */
		errorMessage: text("error_message"),
		/** Error type/code */
		errorType: varchar("error_type", { length: 50 }),
		/** Detailed error log as JSON array */
		errorLog: jsonb("error_log"),
		/** Warnings (non-fatal issues) */
		warnings: jsonb("warnings"),

		// Data Quality
		/** Field completeness score for this run (0-100) */
		dataQualityScore: real("data_quality_score"),
		/** Sample of opportunities (for debugging) */
		sampleData: jsonb("sample_data"),

		// Metadata
		/** Runtime configuration used */
		runConfig: jsonb("run_config"),
		/** Performance metrics */
		performanceMetrics: jsonb("performance_metrics"),
	},
	(table) => [
		index("scraper_runs_source_idx").on(table.sourceId),
		index("scraper_runs_source_key_idx").on(table.sourceKey),
		index("scraper_runs_run_id_idx").on(table.runId),
		index("scraper_runs_batch_idx").on(table.batchId),
		index("scraper_runs_status_idx").on(table.status),
		index("scraper_runs_started_idx").on(table.startedAt),
	]
);

// ============================================================================
// Scraper Schedules - Schedule tier configuration
// ============================================================================

export const scraperSchedules = pgTable(
	"scraper_schedules",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		/** Schedule name (e.g., "tier1", "tier2", "tier3") */
		name: varchar("name", { length: 50 }).notNull().unique(),
		/** Display label */
		label: varchar("label", { length: 100 }).notNull(),
		/** Cron expression */
		cronExpression: varchar("cron_expression", { length: 50 }).notNull(),
		/** Human-readable description */
		description: text("description"),

		/** Maximum concurrent scrapers for this tier */
		maxConcurrent: integer("max_concurrent").notNull().default(3),
		/** Default timeout in minutes */
		timeoutMinutes: integer("timeout_minutes").notNull().default(30),

		/** Whether this schedule is active */
		enabled: boolean("enabled").notNull().default(true),

		/** Last execution timestamp */
		lastRunAt: timestamp("last_run_at", { withTimezone: true }),
		/** Next scheduled execution */
		nextRunAt: timestamp("next_run_at", { withTimezone: true }),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	}
);

// ============================================================================
// Relations
// ============================================================================

export const scraperSourcesRelations = relations(scraperSources, ({ many }) => ({
	runs: many(scraperRuns),
}));

export const scraperRunsRelations = relations(scraperRuns, ({ one }) => ({
	source: one(scraperSources, {
		fields: [scraperRuns.sourceId],
		references: [scraperSources.id],
	}),
}));

// ============================================================================
// Types
// ============================================================================

export type ScraperSource = typeof scraperSources.$inferSelect;
export type NewScraperSource = typeof scraperSources.$inferInsert;

export type ScraperRun = typeof scraperRuns.$inferSelect;
export type NewScraperRun = typeof scraperRuns.$inferInsert;

export type ScraperSchedule = typeof scraperSchedules.$inferSelect;
export type NewScraperSchedule = typeof scraperSchedules.$inferInsert;
