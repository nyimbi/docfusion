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
import { db } from "@/lib/db";
import { scraperSources } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { scraperQueue } from "@/lib/scrapers/queue";
import { initializeScraperQueue } from "@/lib/scrapers/runtime";
import { requireScraperAccess } from "@/lib/scrapers/api-auth";

// Initialize queue executor on module load
initializeScraperQueue();

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

		// Fetch the source
		const source = await db.query.scraperSources.findFirst({
			where: eq(scraperSources.id, sourceId),
		});

		if (!source) {
			return NextResponse.json(
				{ success: false, message: "Source not found" },
				{ status: 404 }
			);
		}

		if (!source.enabled) {
			return NextResponse.json(
				{ success: false, message: "Source is disabled" },
				{ status: 400 }
			);
		}

		// Add job to queue
		const jobId = await scraperQueue.add({
			sourceId: source.id,
			sourceKey: source.sourceId,
			sourceName: source.name,
			priority: priority ?? (source.priority as 1 | 2 | 3),
			tier: source.scheduleTier,
		});

		return NextResponse.json({
			success: true,
			jobId,
			message: `Scraper job queued for ${source.name}`,
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
