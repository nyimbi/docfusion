/**
 * POST /api/scrapers/run/[runId]/cancel
 *
 * Cancel a running or queued scraper job.
 *
 * Response:
 * {
 *   success: boolean;
 *   message: string;
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { scraperQueue } from "@/lib/scrapers/queue";
import { scraperRuntime } from "@/lib/scrapers/runtime";
import { requireScraperAccess } from "@/lib/scrapers/api-auth";

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ runId: string }> }
) {
	try {
		const unauthorized = await requireScraperAccess(request);
		if (unauthorized) return unauthorized;

		const { runId } = await params;

		if (!runId) {
			return NextResponse.json(
				{ success: false, message: "runId is required" },
				{ status: 400 }
			);
		}

		// First try to cancel in queue
		const queueCancelled = await scraperQueue.cancel(runId);

		// Also try to cancel in runtime (for running jobs)
		const runtimeCancelled = scraperRuntime.cancel(runId);

		if (queueCancelled || runtimeCancelled) {
			return NextResponse.json({
				success: true,
				message: "Job cancelled successfully",
			});
		}

		return NextResponse.json(
			{ success: false, message: "Job not found or already completed" },
			{ status: 404 }
		);

	} catch (error) {
		console.error("Error cancelling job:", error);
		return NextResponse.json(
			{
				success: false,
				message: error instanceof Error ? error.message : "Failed to cancel job",
			},
			{ status: 500 }
		);
	}
}
