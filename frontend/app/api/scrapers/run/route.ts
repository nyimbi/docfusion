/**
 * POST /api/scrapers/run
 *
 * Trigger a scraper run for a specific source.
 *
 * Request body:
 * {
 *   sourceId: string;      // UUID of the scraper source
 *   priority?: 1 | 2 | 3;  // Optional priority override
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   jobId?: string;
 *   message?: string;
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireScraperAccess } from "@/lib/scrapers/api-auth";
import { scraperQueue } from "@/lib/scrapers/queue";
import { startScraperSourceRunWorkflow } from "@/lib/actions/scraper-workflows";

export async function POST(request: NextRequest) {
	try {
		const unauthorized = await requireScraperAccess(request);
		if (unauthorized) return unauthorized;

		const body = await request.json();
		const { sourceId, priority } = body;

		if (!sourceId) {
			return NextResponse.json(
				{ success: false, message: "sourceId is required" },
				{ status: 400 }
			);
		}

		if (priority !== undefined && ![1, 2, 3].includes(priority)) {
			return NextResponse.json(
				{ success: false, message: "priority must be 1, 2, or 3" },
				{ status: 400 }
			);
		}

		const result = await startScraperSourceRunWorkflow(sourceId, {
			priority,
			reason: "Manual scraper run requested through the scraper source API.",
		});
		if (!result.success) {
			const status =
				result.state === "not_found" ? 404 :
					result.state === "blocked_disabled" || result.state === "duplicate_active" ? 409 :
						500;
			return NextResponse.json(
				{ ...result, message: result.error ?? "Unable to trigger scraper run" },
				{ status }
			);
		}

		return NextResponse.json({
			success: true,
			jobId: result.jobId,
			state: result.state,
			message: "Scraper job queued",
		});

	} catch (error) {
		console.error("Error triggering scraper run:", error);
		return NextResponse.json(
			{
				success: false,
				message: error instanceof Error ? error.message : "Failed to trigger scraper",
			},
			{ status: 500 }
		);
	}
}

/**
 * GET /api/scrapers/run
 *
 * Get all running and queued jobs.
 */
export async function GET(request: NextRequest) {
	try {
		const unauthorized = await requireScraperAccess(request);
		if (unauthorized) return unauthorized;

		const jobs = await scraperQueue.getAllJobs();
		const stats = await scraperQueue.getStats();

		return NextResponse.json({
			success: true,
			jobs,
			stats,
		});

	} catch (error) {
		console.error("Error getting scraper jobs:", error);
		return NextResponse.json(
			{
				success: false,
				message: error instanceof Error ? error.message : "Failed to get jobs",
			},
			{ status: 500 }
		);
	}
}
