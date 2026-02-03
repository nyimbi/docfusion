/**
 * Scraper Schedule API
 *
 * POST /api/scrapers/schedule - Trigger scheduled scraper runs by tier
 * GET /api/scrapers/schedule - Get schedule configurations
 *
 * Can be triggered by system cron, external cron service, or scheduled tasks.
 *
 * Recommended cron schedules:
 * - Tier 1: 0 star/6 star star star (Every 6 hours)
 * - Tier 2: 0 star/12 star star star (Every 12 hours)
 * - Tier 3: 0 6 star star star (Daily at 6am)
 *
 * Query: tier=1|2|3 (required), dryRun=true (optional)
 * Headers: Authorization: Bearer API_KEY (recommended for production)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scraperSources, scraperSchedules } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { scraperQueue } from "@/lib/scrapers/queue";
import { initializeScraperQueue } from "@/lib/scrapers/runtime";

// UUID v4 generation - inline for serverless compatibility
function generateBatchId(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

// Initialize queue executor
initializeScraperQueue();

export async function POST(request: NextRequest) {
	try {
		// Optional: API key authentication for production
		const apiKey = process.env.SCRAPER_API_KEY;
		if (apiKey) {
			const authHeader = request.headers.get("authorization");
			if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
				return NextResponse.json(
					{ success: false, message: "Unauthorized" },
					{ status: 401 }
				);
			}
		}

		const { searchParams } = new URL(request.url);
		const tierParam = searchParams.get("tier");
		const dryRun = searchParams.get("dryRun") === "true";

		if (!tierParam) {
			return NextResponse.json(
				{ success: false, message: "tier query parameter is required (1, 2, or 3)" },
				{ status: 400 }
			);
		}

		const tier = parseInt(tierParam, 10);
		if (![1, 2, 3].includes(tier)) {
			return NextResponse.json(
				{ success: false, message: "tier must be 1, 2, or 3" },
				{ status: 400 }
			);
		}

		// Get schedule configuration for this tier
		const schedule = await db.query.scraperSchedules.findFirst({
			where: eq(scraperSchedules.name, `tier${tier}`),
		});

		// Get all enabled sources for this tier
		const sources = await db
			.select()
			.from(scraperSources)
			.where(
				and(
					eq(scraperSources.scheduleTier, tier),
					eq(scraperSources.enabled, true)
				)
			)
			.orderBy(asc(scraperSources.priority));

		if (sources.length === 0) {
			return NextResponse.json({
				success: true,
				tier,
				batchId: null,
				sources: 0,
				jobIds: [],
				message: `No enabled sources for tier ${tier}`,
			});
		}

		// Dry run - just return what would be triggered
		if (dryRun) {
			return NextResponse.json({
				success: true,
				tier,
				dryRun: true,
				sources: sources.length,
				sourceList: sources.map(s => ({
					id: s.id,
					sourceId: s.sourceId,
					name: s.name,
					priority: s.priority,
				})),
			});
		}

		// Create batch ID
		const batchId = generateBatchId();

		// Queue all sources
		const jobIds: string[] = [];
		const maxConcurrent = schedule?.maxConcurrent ?? 3;

		for (const source of sources) {
			const jobId = await scraperQueue.add({
				sourceId: source.id,
				sourceKey: source.sourceId,
				sourceName: source.name,
				priority: source.priority as 1 | 2 | 3,
				tier: source.scheduleTier,
				batchId,
			});
			jobIds.push(jobId);
		}

		// Update schedule lastRunAt
		if (schedule) {
			await db
				.update(scraperSchedules)
				.set({ lastRunAt: new Date() })
				.where(eq(scraperSchedules.id, schedule.id));
		}

		return NextResponse.json({
			success: true,
			tier,
			batchId,
			sources: sources.length,
			jobIds,
			maxConcurrent,
			message: `Queued ${sources.length} sources for tier ${tier}`,
		});

	} catch (error) {
		console.error("Error triggering scheduled run:", error);
		return NextResponse.json(
			{
				success: false,
				message: error instanceof Error ? error.message : "Schedule trigger failed",
			},
			{ status: 500 }
		);
	}
}

/**
 * Get schedule tier configurations and status.
 */
export async function GET() {
	try {
		const schedules = await db
			.select()
			.from(scraperSchedules)
			.orderBy(asc(scraperSchedules.name));

		// Get source counts per tier
		const sourceCounts: Record<number, { total: number; enabled: number }> = {
			1: { total: 0, enabled: 0 },
			2: { total: 0, enabled: 0 },
			3: { total: 0, enabled: 0 },
		};

		const sources = await db
			.select({
				scheduleTier: scraperSources.scheduleTier,
				enabled: scraperSources.enabled,
			})
			.from(scraperSources);

		for (const source of sources) {
			const tier = source.scheduleTier;
			if (sourceCounts[tier]) {
				sourceCounts[tier].total++;
				if (source.enabled) {
					sourceCounts[tier].enabled++;
				}
			}
		}

		// Get queue stats
		const queueStats = scraperQueue.getStats();

		return NextResponse.json({
			success: true,
			schedules: schedules.map(s => ({
				...s,
				sourceCounts: sourceCounts[parseInt(s.name.replace("tier", ""))] ?? { total: 0, enabled: 0 },
			})),
			queueStats,
		});

	} catch (error) {
		console.error("Error getting schedule status:", error);
		return NextResponse.json(
			{
				success: false,
				message: error instanceof Error ? error.message : "Failed to get schedule status",
			},
			{ status: 500 }
		);
	}
}
