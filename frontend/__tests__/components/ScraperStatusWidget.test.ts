/**
 * Tests for Scraper Status Dashboard Widget
 *
 * Tests the widget component patterns, data formatting, and display logic.
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Types (matching the component)
// ============================================================================

interface ScraperStats {
	totalRuns: number;
	successful: number;
	failed: number;
	partial: number;
	successRate: number;
	avgDurationSeconds: number | null;
	totalOpportunitiesFound: number;
	avgOpportunitiesPerRun: number | null;
	avgDataQualityScore: number | null;
	byStatus: Record<string, number>;
}

interface SourceHealthItem {
	sourceId: string;
	sourceKey: string;
	sourceName: string;
	healthStatus: string;
	lastRunAt: string | null;
	lastSuccessAt: string | null;
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
	scheduleTier?: number;
}

interface HealthSummary {
	total: number;
	enabled: number;
	healthy: number;
	degraded: number;
	failing: number;
	unknown: number;
	disabled: number;
}

interface ScraperHealthData {
	overallStatus: "healthy" | "degraded" | "failing" | "unknown";
	sources: SourceHealthItem[];
	byTier: Record<number, SourceHealthItem[]>;
	summary: HealthSummary;
	stats: {
		totalOpportunities: number;
		avgSuccessRate: number;
		byType: Record<string, number>;
	};
}

// ============================================================================
// Helper Functions (matching component logic)
// ============================================================================

function getHealthStatusConfig(status: string) {
	const configs: Record<string, { color: string; label: string }> = {
		healthy: { color: "green", label: "Healthy" },
		degraded: { color: "yellow", label: "Degraded" },
		failing: { color: "red", label: "Failing" },
		unknown: { color: "gray", label: "Unknown" },
	};
	return configs[status] ?? configs.unknown;
}

function formatDuration(seconds: number | null): string {
	if (seconds === null) return "N/A";
	if (seconds < 60) return `${Math.round(seconds)}s`;
	const minutes = Math.floor(seconds / 60);
	const secs = Math.round(seconds % 60);
	if (minutes < 60) return `${minutes}m ${secs}s`;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${hours}h ${mins}m`;
}

function formatNumber(num: number | null): string {
	if (num === null) return "N/A";
	if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
	if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
	return num.toString();
}

function formatPercentage(value: number | null): string {
	if (value === null) return "N/A";
	return `${Math.round(value * 100)}%`;
}

function formatRelativeTime(dateStr: string | null): string {
	if (!dateStr) return "Never";

	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return date.toLocaleDateString();
}

function calculateOverallStatus(summary: HealthSummary): "healthy" | "degraded" | "failing" | "unknown" {
	if (summary.total === 0) return "unknown";

	const { healthy, degraded, failing } = summary;
	const totalActive = healthy + degraded + failing;

	if (totalActive === 0) return "unknown";

	if (failing > healthy) return "failing";
	if (degraded > 0 || failing > 0) return "degraded";
	return "healthy";
}

// ============================================================================
// Tests
// ============================================================================

describe("Scraper Status Widget Helpers", () => {
	describe("getHealthStatusConfig", () => {
		it("should return correct config for healthy status", () => {
			const config = getHealthStatusConfig("healthy");
			expect(config.color).toBe("green");
			expect(config.label).toBe("Healthy");
		});

		it("should return correct config for degraded status", () => {
			const config = getHealthStatusConfig("degraded");
			expect(config.color).toBe("yellow");
			expect(config.label).toBe("Degraded");
		});

		it("should return correct config for failing status", () => {
			const config = getHealthStatusConfig("failing");
			expect(config.color).toBe("red");
			expect(config.label).toBe("Failing");
		});

		it("should return unknown config for unrecognized status", () => {
			const config = getHealthStatusConfig("invalid");
			expect(config.color).toBe("gray");
			expect(config.label).toBe("Unknown");
		});
	});

	describe("formatDuration", () => {
		it("should format seconds", () => {
			expect(formatDuration(30)).toBe("30s");
			expect(formatDuration(59)).toBe("59s");
		});

		it("should format minutes and seconds", () => {
			expect(formatDuration(60)).toBe("1m 0s");
			expect(formatDuration(90)).toBe("1m 30s");
			expect(formatDuration(3599)).toBe("59m 59s");
		});

		it("should format hours and minutes", () => {
			expect(formatDuration(3600)).toBe("1h 0m");
			expect(formatDuration(3661)).toBe("1h 1m");
			expect(formatDuration(7325)).toBe("2h 2m");
		});

		it("should handle null", () => {
			expect(formatDuration(null)).toBe("N/A");
		});
	});

	describe("formatNumber", () => {
		it("should format small numbers", () => {
			expect(formatNumber(0)).toBe("0");
			expect(formatNumber(999)).toBe("999");
		});

		it("should format thousands", () => {
			expect(formatNumber(1000)).toBe("1.0K");
			expect(formatNumber(1234)).toBe("1.2K");
			expect(formatNumber(999999)).toBe("1000.0K");
		});

		it("should format millions", () => {
			expect(formatNumber(1000000)).toBe("1.0M");
			expect(formatNumber(2500000)).toBe("2.5M");
		});

		it("should handle null", () => {
			expect(formatNumber(null)).toBe("N/A");
		});
	});

	describe("formatPercentage", () => {
		it("should format percentages", () => {
			expect(formatPercentage(0)).toBe("0%");
			expect(formatPercentage(0.5)).toBe("50%");
			expect(formatPercentage(0.847)).toBe("85%");
			expect(formatPercentage(1)).toBe("100%");
		});

		it("should handle null", () => {
			expect(formatPercentage(null)).toBe("N/A");
		});
	});

	describe("formatRelativeTime", () => {
		it("should return Never for null", () => {
			expect(formatRelativeTime(null)).toBe("Never");
		});

		it("should return Just now for recent times", () => {
			const now = new Date().toISOString();
			expect(formatRelativeTime(now)).toBe("Just now");
		});

		it("should format minutes ago", () => {
			const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
			const result = formatRelativeTime(fiveMinAgo);
			expect(result).toMatch(/^\d+m ago$/);
		});

		it("should format hours ago", () => {
			const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
			const result = formatRelativeTime(twoHoursAgo);
			expect(result).toMatch(/^\d+h ago$/);
		});

		it("should format days ago", () => {
			const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
			const result = formatRelativeTime(threeDaysAgo);
			expect(result).toMatch(/^\d+d ago$/);
		});
	});

	describe("calculateOverallStatus", () => {
		it("should return unknown when no sources", () => {
			const summary: HealthSummary = {
				total: 0,
				enabled: 0,
				healthy: 0,
				degraded: 0,
				failing: 0,
				unknown: 0,
				disabled: 0,
			};

			expect(calculateOverallStatus(summary)).toBe("unknown");
		});

		it("should return healthy when all sources healthy", () => {
			const summary: HealthSummary = {
				total: 5,
				enabled: 5,
				healthy: 5,
				degraded: 0,
				failing: 0,
				unknown: 0,
				disabled: 0,
			};

			expect(calculateOverallStatus(summary)).toBe("healthy");
		});

		it("should return degraded when some sources degraded", () => {
			const summary: HealthSummary = {
				total: 5,
				enabled: 5,
				healthy: 3,
				degraded: 2,
				failing: 0,
				unknown: 0,
				disabled: 0,
			};

			expect(calculateOverallStatus(summary)).toBe("degraded");
		});

		it("should return degraded when some sources failing", () => {
			const summary: HealthSummary = {
				total: 5,
				enabled: 5,
				healthy: 4,
				degraded: 0,
				failing: 1,
				unknown: 0,
				disabled: 0,
			};

			expect(calculateOverallStatus(summary)).toBe("degraded");
		});

		it("should return failing when more failing than healthy", () => {
			const summary: HealthSummary = {
				total: 5,
				enabled: 5,
				healthy: 1,
				degraded: 0,
				failing: 4,
				unknown: 0,
				disabled: 0,
			};

			expect(calculateOverallStatus(summary)).toBe("failing");
		});
	});
});

describe("Scraper Status Widget Data Patterns", () => {
	it("should structure health data correctly", () => {
		const healthData: ScraperHealthData = {
			overallStatus: "healthy",
			sources: [
				{
					sourceId: "src-1",
					sourceKey: "ungm",
					sourceName: "UN Global Market",
					healthStatus: "healthy",
					lastRunAt: new Date().toISOString(),
					lastSuccessAt: new Date().toISOString(),
					lastError: null,
					successRate: 0.95,
					totalRuns: 100,
					successfulRuns: 95,
					failedRuns: 5,
					lastOpportunitiesCount: 25,
					avgRunDurationSeconds: 120,
					avgOpportunitiesPerRun: 22,
					dataQualityScore: 0.92,
					valueScore: 0.88,
					scheduleTier: 1,
				},
			],
			byTier: {
				1: [],
				2: [],
				3: [],
			},
			summary: {
				total: 1,
				enabled: 1,
				healthy: 1,
				degraded: 0,
				failing: 0,
				unknown: 0,
				disabled: 0,
			},
			stats: {
				totalOpportunities: 2200,
				avgSuccessRate: 0.95,
				byType: { tender: 2000, grant: 200 },
			},
		};

		expect(healthData.overallStatus).toBe("healthy");
		expect(healthData.sources.length).toBe(1);
		expect(healthData.summary.healthy).toBe(1);
		expect(healthData.stats.totalOpportunities).toBe(2200);
	});

	it("should structure stats data correctly", () => {
		const statsData: ScraperStats = {
			totalRuns: 50,
			successful: 45,
			failed: 3,
			partial: 2,
			successRate: 0.9,
			avgDurationSeconds: 180,
			totalOpportunitiesFound: 1250,
			avgOpportunitiesPerRun: 25,
			avgDataQualityScore: 0.88,
			byStatus: {
				success: 45,
				failed: 3,
				partial: 2,
			},
		};

		expect(statsData.totalRuns).toBe(50);
		expect(statsData.successRate).toBeCloseTo(0.9);
		expect(statsData.byStatus.success).toBe(45);
	});

	it("should handle tier grouping", () => {
		const sources: SourceHealthItem[] = [
			{ ...createMockSource(), scheduleTier: 1, sourceKey: "ungm" },
			{ ...createMockSource(), scheduleTier: 1, sourceKey: "devex" },
			{ ...createMockSource(), scheduleTier: 2, sourceKey: "tadat" },
			{ ...createMockSource(), scheduleTier: 3, sourceKey: "afdb" },
		];

		const byTier: Record<number, SourceHealthItem[]> = {};

		for (const source of sources) {
			const tier = source.scheduleTier ?? 3;
			if (!byTier[tier]) byTier[tier] = [];
			byTier[tier].push(source);
		}

		expect(byTier[1].length).toBe(2);
		expect(byTier[2].length).toBe(1);
		expect(byTier[3].length).toBe(1);
	});
});

function createMockSource(): SourceHealthItem {
	return {
		sourceId: `src-${Math.random().toString(36).slice(2, 7)}`,
		sourceKey: "test",
		sourceName: "Test Source",
		healthStatus: "healthy",
		lastRunAt: new Date().toISOString(),
		lastSuccessAt: new Date().toISOString(),
		lastError: null,
		successRate: 0.9,
		totalRuns: 10,
		successfulRuns: 9,
		failedRuns: 1,
		lastOpportunitiesCount: 20,
		avgRunDurationSeconds: 60,
		avgOpportunitiesPerRun: 18,
		dataQualityScore: 0.85,
		valueScore: 0.75,
	};
}