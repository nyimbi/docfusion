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
import { requireScraperAccess } from "@/lib/scrapers/api-auth";
import { cancelScraperJobWorkflow } from "@/lib/actions/scraper-workflows";

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

		const result = await cancelScraperJobWorkflow(
			runId,
			"Operator cancelled scraper job through the scraper run API."
		);
		if (result.success) {
			return NextResponse.json({
				success: true,
				message: "Job cancelled successfully",
			});
		}

		return NextResponse.json(
			{ success: false, message: result.error ?? "Job not found or already completed" },
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
