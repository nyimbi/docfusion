/**
 * Run Persistence
 *
 * Manages the lifecycle of scraper run records in the database.
 * Encapsulates all create/update calls so the runtime orchestrator
 * does not depend directly on the actions layer.
 */

import { createScraperRun, updateScraperRun, updateSourceMetrics } from "@/lib/actions/scraper-sources";
import type { ScraperJobResult } from "./queue";

// ============================================================================
// Types
// ============================================================================

export interface CreateRunParams {
	sourceId: string;
	sourceKey: string;
	runId: string;
	batchId?: string;
}

export interface RunRecord {
	id: string;
}

// ============================================================================
// Run Lifecycle
// ============================================================================

/**
 * Create a new scraper run record in the database.
 * Called at the start of job execution before any pages are fetched.
 */
export async function createRun(params: CreateRunParams): Promise<RunRecord> {
	return createScraperRun({
		sourceId: params.sourceId,
		sourceKey: params.sourceKey,
		runId: params.runId,
		batchId: params.batchId,
		triggerType: "manual",
		startedAt: new Date(),
		status: "running",
		progress: 0,
	});
}

/**
 * Mark a run as successfully completed and update source-level metrics.
 */
export async function finaliseRunSuccess(
	runId: string,
	sourceId: string,
	result: ScraperJobResult
): Promise<void> {
	await updateScraperRun(runId, {
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

	await updateSourceMetrics(sourceId, {
		success: true,
		opportunitiesFound: result.opportunitiesFound,
		uniqueOpportunities: result.opportunitiesNew,
		durationSeconds: result.durationSeconds,
	});
}

/**
 * Mark a run as failed (or cancelled) and update source-level metrics.
 */
export async function finaliseRunFailure(
	runId: string,
	sourceId: string,
	result: ScraperJobResult,
	options: {
		aborted: boolean;
		errorMessage: string;
		errorType: string;
		progress: number;
	}
): Promise<void> {
	await updateScraperRun(runId, {
		status: options.aborted ? "cancelled" : "failed",
		completedAt: new Date(),
		durationSeconds: result.durationSeconds,
		progress: options.progress,
		errorMessage: options.errorMessage,
		errorType: options.errorType,
		opportunitiesFound: result.opportunitiesFound,
		opportunitiesNew: result.opportunitiesNew,
		pagesScraped: result.pagesScraped,
	});

	await updateSourceMetrics(sourceId, {
		success: false,
		opportunitiesFound: result.opportunitiesFound,
		uniqueOpportunities: result.opportunitiesNew,
		durationSeconds: result.durationSeconds,
		error: options.errorMessage,
	});
}
