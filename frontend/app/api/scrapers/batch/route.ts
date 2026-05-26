/**
 * POST /api/scrapers/batch
 *
 * Bulk operations on scraper sources.
 *
 * Operations:
 * - run: Start scraper runs for multiple sources
 * - enable: Enable multiple sources
 * - disable: Disable multiple sources
 * - delete: Delete multiple sources
 *
 * Request body:
 * {
 *   operation: "run" | "enable" | "disable" | "delete";
 *   sourceIds: string[];
 *   options?: {
 *     priority?: 1 | 2 | 3;
 *   }
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   results: { sourceId: string; success: boolean; error?: string }[];
 *   summary: { succeeded: number; failed: number };
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scraperSources } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireScraperAccess } from "@/lib/scrapers/api-auth";
import { revalidatePath } from "next/cache";
import { scraperQueue, type ScraperJob } from "@/lib/scrapers/queue";
import {
	startScraperSourceRunWorkflow,
	transitionScraperSourceEnabledWorkflow,
} from "@/lib/actions/scraper-workflows";
import { WorkflowAuthorityDeniedError } from "@/lib/workflows/authority-error";

type BatchOperation = "run" | "enable" | "disable" | "delete";

interface BatchRequest {
	operation: BatchOperation;
	sourceIds: string[];
	options?: {
		priority?: 1 | 2 | 3;
	};
}

interface BatchResult {
	sourceId: string;
	success: boolean;
	jobId?: string;
	error?: string;
}

export async function POST(request: NextRequest) {
	try {
		const unauthorized = await requireScraperAccess(request);
		if (unauthorized) return unauthorized;

		const body: BatchRequest = await request.json();
		const { operation, sourceIds, options } = body;

		if (!operation || !sourceIds || !Array.isArray(sourceIds)) {
			return NextResponse.json(
				{ success: false, message: "operation and sourceIds[] are required" },
				{ status: 400 }
			);
		}

		if (!["run", "enable", "disable", "delete"].includes(operation)) {
			return NextResponse.json(
				{ success: false, message: "operation must be run, enable, disable, or delete" },
				{ status: 400 }
			);
		}

		if (sourceIds.length === 0) {
			return NextResponse.json(
				{ success: false, message: "sourceIds array cannot be empty" },
				{ status: 400 }
			);
		}

		if (options?.priority !== undefined && ![1, 2, 3].includes(options.priority)) {
			return NextResponse.json(
				{ success: false, message: "priority must be 1, 2, or 3" },
				{ status: 400 }
			);
		}

		if (sourceIds.length > 100) {
			return NextResponse.json(
				{ success: false, message: "Maximum 100 sources per batch operation" },
				{ status: 400 }
			);
		}

		if (operation === "delete") {
			const unauthorizedDelete = await requireScraperAccess(request, {
				allowedRoles: ["operations", "admin"],
			});
			if (unauthorizedDelete) return unauthorizedDelete;
		}

		// Fetch all sources
		const sources = await db
			.select()
			.from(scraperSources)
			.where(inArray(scraperSources.id, sourceIds));

		const sourceMap = new Map(sources.map(s => [s.id, s]));
		const results: BatchResult[] = [];

		// Process each source
		for (const sourceId of sourceIds) {
			const source = sourceMap.get(sourceId);

			if (!source) {
				results.push({
					sourceId,
					success: false,
					error: "Source not found",
				});
				continue;
			}

			try {
				switch (operation) {
					case "run":
						const runResult = await startScraperSourceRunWorkflow(sourceId, {
							priority: options?.priority,
							reason: "Bulk scraper run requested by operator.",
						});
						results.push({
							sourceId,
							success: runResult.success,
							jobId: runResult.jobId,
							error: runResult.error,
						});
						break;

					case "enable":
						const enableResult = await transitionScraperSourceEnabledWorkflow(
							sourceId,
							true,
							"Bulk enable requested by operator."
						);
						results.push({
							sourceId,
							success: enableResult.success,
							error: enableResult.error,
						});
						break;

					case "disable":
						const disableResult = await transitionScraperSourceEnabledWorkflow(
							sourceId,
							false,
							"Bulk disable requested by operator."
						);
						results.push({
							sourceId,
							success: disableResult.success,
							error: disableResult.error,
						});
						break;

					case "delete":
						await db
							.delete(scraperSources)
							.where(eq(scraperSources.id, sourceId));
						results.push({ sourceId, success: true });
						break;

					default:
						results.push({
							sourceId,
							success: false,
							error: `Unknown operation: ${operation}`,
						});
				}
			} catch (error) {
				if (error instanceof WorkflowAuthorityDeniedError) {
					throw error;
				}
				results.push({
					sourceId,
					success: false,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		// Revalidate cache
		revalidatePath("/opportunities/sources");

		// Calculate summary
		const succeeded = results.filter(r => r.success).length;
		const failed = results.filter(r => !r.success).length;

		return NextResponse.json({
			success: failed === 0,
			results,
			summary: { succeeded, failed },
		});

	} catch (error) {
		if (error instanceof WorkflowAuthorityDeniedError) {
			return NextResponse.json(
				{ success: false, message: "Forbidden" },
				{ status: 403 }
			);
		}
		console.error("Error performing batch operation:", error);
		return NextResponse.json(
			{
				success: false,
				message: error instanceof Error ? error.message : "Batch operation failed",
			},
			{ status: 500 }
		);
	}
}

/**
 * GET /api/scrapers/batch?batchId=xxx
 *
 * Get status of all jobs in a batch.
 */
export async function GET(request: NextRequest) {
	try {
		const unauthorized = await requireScraperAccess(request);
		if (unauthorized) return unauthorized;

		const { searchParams } = new URL(request.url);
		const batchId = searchParams.get("batchId");

		if (!batchId) {
			return NextResponse.json(
				{ success: false, message: "batchId query parameter is required" },
				{ status: 400 }
			);
		}

		const jobs: ScraperJob[] = await scraperQueue.getBatchJobs(batchId);

		const summary = {
			total: jobs.length,
			queued: jobs.filter(j => j.status === "queued" || j.status === "retrying").length,
			running: jobs.filter(j => j.status === "running").length,
			completed: jobs.filter(j => j.status === "completed").length,
			failed: jobs.filter(j => j.status === "failed" || j.status === "cancelled").length,
		};

		return NextResponse.json({
			success: true,
			batchId,
			jobs,
			summary,
		});

	} catch (error) {
		console.error("Error getting batch status:", error);
		return NextResponse.json(
			{
				success: false,
				message: error instanceof Error ? error.message : "Failed to get batch status",
			},
			{ status: 500 }
		);
	}
}
