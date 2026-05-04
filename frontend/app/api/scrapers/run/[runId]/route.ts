/**
 * GET /api/scrapers/run/[runId]
 *
 * Get status of a specific scraper job.
 *
 * Response:
 * {
 *   success: boolean;
 *   job?: ScraperJob;
 *   message?: string;
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { scraperQueue } from "@/lib/scrapers/queue";
import { requireScraperAccess } from "@/lib/scrapers/api-auth";

export async function GET(
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

		const job = await scraperQueue.getStatus(runId);

		if (!job) {
			return NextResponse.json(
				{ success: false, message: "Job not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json({
			success: true,
			job,
		});

	} catch (error) {
		console.error("Error getting job status:", error);
		return NextResponse.json(
			{
				success: false,
				message: error instanceof Error ? error.message : "Failed to get job status",
			},
			{ status: 500 }
		);
	}
}
