/**
 * GET /api/admin/scraper/health
 *
 * Returns health status for all scraper sources.
 * - Overall health status
 * - Sources grouped by tier
 * - Individual source health metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scraperSources } from "@/lib/db/schema";
import { isControlPlaneResponse, requireControlPlaneAdmin } from "@/lib/auth/control-plane";
import { asc, eq } from "drizzle-orm";

interface SourceHealthWithTier {
	sourceId: string;
	sourceKey: string;
	sourceName: string;
	healthStatus: string;
	lastRunAt: Date | null;
	lastSuccessAt: Date | null;
	lastError: string | null;
	successRate: number | null;
	totalRuns: number;
	successfulRuns: number;
	failedRuns: number;
	lastOpportunitiesCount: number;
	avgRunDurationSeconds: number | null;
	avgOpportunitiesPerRun: number | null;
	dataQualityScore: number | null;
	valueScore: number | null;
	scheduleTier: number;
}

export async function GET(request: NextRequest) {
	try {
		const authz = await requireControlPlaneAdmin(request, {
			allowedRoles: ["admin", "operations"],
			allowApiKeyEnv: "SCRAPER_API_KEY",
		});
		if (isControlPlaneResponse(authz)) return authz;

		// Fetch all sources with their tier information
		const sources = await db
			.select({
				id: scraperSources.id,
				sourceId: scraperSources.sourceId,
				name: scraperSources.name,
				sourceType: scraperSources.sourceType,
				scheduleTier: scraperSources.scheduleTier,
				healthStatus: scraperSources.healthStatus,
				lastRunAt: scraperSources.lastRunAt,
				lastSuccessAt: scraperSources.lastSuccessAt,
				lastError: scraperSources.lastError,
				successRate: scraperSources.successRate,
				successfulRuns: scraperSources.successfulRuns,
				failedRuns: scraperSources.failedRuns,
				lastOpportunitiesCount: scraperSources.lastOpportunitiesCount,
				avgRunDurationSeconds: scraperSources.avgRunDurationSeconds,
				avgOpportunitiesPerRun: scraperSources.avgOpportunitiesPerRun,
				dataQualityScore: scraperSources.dataQualityScore,
				valueScore: scraperSources.valueScore,
				totalOpportunitiesScraped: scraperSources.totalOpportunitiesScraped,
				enabled: scraperSources.enabled,
			})
			.from(scraperSources)
			.orderBy(asc(scraperSources.priority), asc(scraperSources.name));

		// Transform to health items
		const sourceHealth: SourceHealthWithTier[] = sources.map((source) => ({
			sourceId: source.id,
			sourceKey: source.sourceId,
			sourceName: source.name,
			healthStatus: source.healthStatus,
			lastRunAt: source.lastRunAt,
			lastSuccessAt: source.lastSuccessAt,
			lastError: source.lastError,
			successRate: source.successRate,
			totalRuns: (source.successfulRuns ?? 0) + (source.failedRuns ?? 0),
			successfulRuns: source.successfulRuns ?? 0,
			failedRuns: source.failedRuns ?? 0,
			lastOpportunitiesCount: source.lastOpportunitiesCount ?? 0,
			avgRunDurationSeconds: source.avgRunDurationSeconds,
			avgOpportunitiesPerRun: source.avgOpportunitiesPerRun,
			dataQualityScore: source.dataQualityScore,
			valueScore: source.valueScore,
			scheduleTier: source.scheduleTier,
		}));

		// Group sources by tier
		const byTier: Record<number, SourceHealthWithTier[]> = { 1: [], 2: [], 3: [] };
		for (const source of sourceHealth) {
			const tier = source.scheduleTier;
			if (!byTier[tier]) {
				byTier[tier] = [];
			}
			byTier[tier].push(source);
		}

		// Calculate summary stats
		const summary = {
			total: sources.length,
			enabled: sources.filter((s) => s.enabled).length,
			healthy: sourceHealth.filter((s) => s.healthStatus === "healthy").length,
			degraded: sourceHealth.filter((s) => s.healthStatus === "degraded").length,
			failing: sourceHealth.filter((s) => s.healthStatus === "failing").length,
			unknown: sourceHealth.filter((s) => s.healthStatus === "unknown").length,
			disabled: sourceHealth.filter((s) => s.healthStatus === "disabled").length,
		};

		// Calculate stats
		const totalOpportunities = sources.reduce(
			(sum, s) => sum + (s.totalOpportunitiesScraped ?? 0),
			0
		);
		const successRates = sources
			.filter((s) => s.successRate !== null)
			.map((s) => s.successRate as number);
		const avgSuccessRate =
			successRates.length > 0
				? successRates.reduce((a, b) => a + b, 0) / successRates.length
				: 0;

		const byType: Record<string, number> = {};
		for (const source of sources) {
			byType[source.sourceType] = (byType[source.sourceType] || 0) + 1;
		}

		// Determine overall health status
		let overallStatus: "healthy" | "degraded" | "failing" | "unknown";
		if (summary.failing > 0) {
			overallStatus = "failing";
		} else if (summary.degraded > 0) {
			overallStatus = "degraded";
		} else if (summary.healthy > 0) {
			overallStatus = "healthy";
		} else {
			overallStatus = "unknown";
		}

		return NextResponse.json({
			success: true,
			data: {
				overallStatus,
				sources: sourceHealth,
				byTier,
				summary,
				stats: {
					totalOpportunities,
					avgSuccessRate: Math.round(avgSuccessRate * 10) / 10,
					byType,
				},
			},
		});
	} catch (error) {
		console.error("Error fetching scraper health:", error);
		return NextResponse.json(
			{
				success: false,
				message: error instanceof Error ? error.message : "Failed to fetch scraper health",
			},
			{ status: 500 }
		);
	}
}
