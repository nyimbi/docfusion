/**
 * GET /api/admin/scraper/stats
 *
 * Returns aggregate scraper statistics for the dashboard widget.
 * - Total runs in last 24 hours
 * - Success/failure counts
 * - Success rate
 * - Average duration
 */

import { NextRequest, NextResponse } from "next/server";
import { getScraperStats } from "@/lib/actions/scraper-runs";

export async function GET(request: NextRequest) {
	try {
		// Get stats for last 24 hours
		const now = new Date();
		const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

		const stats = await getScraperStats({
			startedAfter: twentyFourHoursAgo,
			startedBefore: now,
		});

		return NextResponse.json({
			success: true,
			data: {
				totalRuns: stats.totalRuns,
				successful: stats.successfulRuns,
				failed: stats.failedRuns,
				partial: stats.partialRuns,
				successRate: Math.round(stats.successRate * 10) / 10,
				avgDurationSeconds: stats.avgDurationSeconds
					? Math.round(stats.avgDurationSeconds * 10) / 10
					: null,
				totalOpportunitiesFound: stats.totalOpportunitiesFound,
				avgOpportunitiesPerRun: stats.avgOpportunitiesPerRun,
				avgDataQualityScore: stats.avgDataQualityScore,
				byStatus: stats.byStatus,
			},
		});
	} catch (error) {
		console.error("Error fetching scraper stats:", error);
		return NextResponse.json(
			{
				success: false,
				message: error instanceof Error ? error.message : "Failed to fetch scraper stats",
			},
			{ status: 500 }
		);
	}
}