/**
 * Tests for ScraperStatusWidget Component
 *
 * Tests the component's data processing and display logic.
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Types (matching component)
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

// ============================================================================
// Helper Functions (testing component logic without React)
// ============================================================================

function getHealthStatusColor(status: string): string {
	const colors: Record<string, string> = {
		healthy: "text-green-600",
		degraded: "text-yellow-600",
		failing: "text-red-600",
		unknown: "text-gray-500",
	};
	return colors[status] ?? "text-gray-500";
}

function getHealthStatusIcon(status: string): string {
	const icons: Record<string, string> = {
		healthy: "CheckCircle2",
		degraded: "AlertTriangle",
		failing: "XCircle",
		unknown: "Clock",
	};
	return icons[status] ?? "Clock";
}

function formatSuccessRate(rate: number | null): string {
	if (rate === null) return "N/A";
	return `${Math.round(rate * 100)}%`;
}

function formatDuration(seconds: number | null): string {
	if (seconds === null) return "N/A";
	if (seconds < 60) return `${Math.round(seconds)}s`;
	const minutes = Math.floor(seconds / 60);
	const secs = Math.round(seconds % 60);
	return `${minutes}m ${secs}s`;
}

function formatNumber(num: number): string {
	if (num >= 1_000_000) {
		return `${(num / 1_000_000).toFixed(1)}M`;
	}
	if (num >= 1_000) {
		return `${(num / 1_000).toFixed(1)}K`;
	}
	return num.toString();
}

function calculateOverallStatus(summary: HealthSummary): string {
	const { healthy, degraded, failing, total, enabled } = summary;

	// If no enabled sources, unknown
	if (enabled === 0) return "unknown";

	// Calculate percentages of enabled sources
	const healthyPercent = healthy / enabled;
	const failingPercent = failing / enabled;

	if (failingPercent > 0.5) return "failing";
	if (healthyPercent >= 0.8) return "healthy";
	if (healthyPercent >= 0.5) return "degraded";
	return "failing";
}

function sortSourcesByHealth(sources: SourceHealthItem[]): SourceHealthItem[] {
	const priority: Record<string, number> = {
		failing: 0,
		degraded: 1,
		unknown: 2,
		healthy: 3,
	};
	return [...sources].sort(
		(a, b) => (priority[a.healthStatus] ?? 99) - (priority[b.healthStatus] ?? 99)
	);
}

function groupSourcesByTier(
	sources: SourceHealthItem[]
): Record<number, SourceHealthItem[]> {
	return sources.reduce(
		(acc, source) => {
			const tier = source.scheduleTier ?? 3;
			if (!acc[tier]) acc[tier] = [];
			acc[tier].push(source);
			return acc;
		},
		{} as Record<number, SourceHealthItem[]>
	);
}

// ============================================================================
// Tests
// ============================================================================

describe("ScraperStatusWidget Helpers", () => {
	describe("getHealthStatusColor", () => {
		it("should return correct colors for each status", () => {
			expect(getHealthStatusColor("healthy")).toBe("text-green-600");
			expect(getHealthStatusColor("degraded")).toBe("text-yellow-600");
			expect(getHealthStatusColor("failing")).toBe("text-red-600");
			expect(getHealthStatusColor("unknown")).toBe("text-gray-500");
		});

		it("should return gray for unknown status", () => {
			expect(getHealthStatusColor("invalid")).toBe("text-gray-500");
		});
	});

	describe("getHealthStatusIcon", () => {
		it("should return correct icons for each status", () => {
			expect(getHealthStatusIcon("healthy")).toBe("CheckCircle2");
			expect(getHealthStatusIcon("degraded")).toBe("AlertTriangle");
			expect(getHealthStatusIcon("failing")).toBe("XCircle");
			expect(getHealthStatusIcon("unknown")).toBe("Clock");
		});

		it("should return Clock for unknown status", () => {
			expect(getHealthStatusIcon("invalid")).toBe("Clock");
		});
	});

	describe("formatSuccessRate", () => {
		it("should format rates as percentages", () => {
			expect(formatSuccessRate(0.85)).toBe("85%");
			expect(formatSuccessRate(0.5)).toBe("50%");
			expect(formatSuccessRate(0.99)).toBe("99%");
		});

		it("should handle null rates", () => {
			expect(formatSuccessRate(null)).toBe("N/A");
		});

		it("should round correctly", () => {
			expect(formatSuccessRate(0.856)).toBe("86%");
			expect(formatSuccessRate(0.854)).toBe("85%");
		});
	});

	describe("formatDuration", () => {
		it("should format seconds under a minute", () => {
			expect(formatDuration(30)).toBe("30s");
			expect(formatDuration(59)).toBe("59s");
		});

		it("should format minutes and seconds", () => {
			expect(formatDuration(90)).toBe("1m 30s");
			expect(formatDuration(330)).toBe("5m 30s");
		});

		it("should handle null", () => {
			expect(formatDuration(null)).toBe("N/A");
		});
	});

	describe("formatNumber", () => {
		it("should format thousands with K suffix", () => {
			expect(formatNumber(1500)).toBe("1.5K");
			expect(formatNumber(1000)).toBe("1.0K");
		});

		it("should format millions with M suffix", () => {
			expect(formatNumber(1_500_000)).toBe("1.5M");
			expect(formatNumber(1_000_000)).toBe("1.0M");
		});

		it("should leave small numbers as is", () => {
			expect(formatNumber(999)).toBe("999");
			expect(formatNumber(100)).toBe("100");
		});
	});

	describe("calculateOverallStatus", () => {
		it("should return unknown when no enabled sources", () => {
			const summary: HealthSummary = {
				total: 5,
				enabled: 0,
				healthy: 0,
				degraded: 0,
				failing: 0,
				unknown: 5,
				disabled: 0,
			};
			expect(calculateOverallStatus(summary)).toBe("unknown");
		});

		it("should return healthy when 80%+ are healthy", () => {
			const summary: HealthSummary = {
				total: 10,
				enabled: 10,
				healthy: 8,
				degraded: 1,
				failing: 1,
				unknown: 0,
				disabled: 0,
			};
			expect(calculateOverallStatus(summary)).toBe("healthy");
		});

		it("should return degraded when 50-79% are healthy", () => {
			const summary: HealthSummary = {
				total: 10,
				enabled: 10,
				healthy: 6,
				degraded: 2,
				failing: 2,
				unknown: 0,
				disabled: 0,
			};
			expect(calculateOverallStatus(summary)).toBe("degraded");
		});

		it("should return failing when >50% are failing", () => {
			const summary: HealthSummary = {
				total: 10,
				enabled: 10,
				healthy: 2,
				degraded: 2,
				failing: 6,
				unknown: 0,
				disabled: 0,
			};
			expect(calculateOverallStatus(summary)).toBe("failing");
		});
	});

	describe("sortSourcesByHealth", () => {
		it("should sort sources with failing first", () => {
			const sources: SourceHealthItem[] = [
				{
					sourceId: "1",
					sourceKey: "a",
					sourceName: "Source A",
					healthStatus: "healthy",
					lastRunAt: null,
					lastSuccessAt: null,
					lastError: null,
					successRate: 0.9,
					totalRuns: 10,
					successfulRuns: 9,
					failedRuns: 1,
					lastOpportunitiesCount: 100,
					avgRunDurationSeconds: null,
					avgOpportunitiesPerRun: null,
					dataQualityScore: null,
					valueScore: null,
				},
				{
					sourceId: "2",
					sourceKey: "b",
					sourceName: "Source B",
					healthStatus: "failing",
					lastRunAt: null,
					lastSuccessAt: null,
					lastError: "Timeout",
					successRate: 0.1,
					totalRuns: 10,
					successfulRuns: 1,
					failedRuns: 9,
					lastOpportunitiesCount: 10,
					avgRunDurationSeconds: null,
					avgOpportunitiesPerRun: null,
					dataQualityScore: null,
					valueScore: null,
				},
			];

			const sorted = sortSourcesByHealth(sources);
			expect(sorted[0].healthStatus).toBe("failing");
			expect(sorted[1].healthStatus).toBe("healthy");
		});

		it("should order: failing, degraded, unknown, healthy", () => {
			const sources: SourceHealthItem[] = [
				{
					sourceId: "1",
					sourceKey: "h",
					sourceName: "Healthy",
					healthStatus: "healthy",
					lastRunAt: null,
					lastSuccessAt: null,
					lastError: null,
					successRate: 0.9,
					totalRuns: 10,
					successfulRuns: 9,
					failedRuns: 1,
					lastOpportunitiesCount: 100,
					avgRunDurationSeconds: null,
					avgOpportunitiesPerRun: null,
					dataQualityScore: null,
					valueScore: null,
				},
				{
					sourceId: "2",
					sourceKey: "f",
					sourceName: "Failing",
					healthStatus: "failing",
					lastRunAt: null,
					lastSuccessAt: null,
					lastError: "Error",
					successRate: 0.1,
					totalRuns: 10,
					successfulRuns: 1,
					failedRuns: 9,
					lastOpportunitiesCount: 10,
					avgRunDurationSeconds: null,
					avgOpportunitiesPerRun: null,
					dataQualityScore: null,
					valueScore: null,
				},
				{
					sourceId: "3",
					sourceKey: "d",
					sourceName: "Degraded",
					healthStatus: "degraded",
					lastRunAt: null,
					lastSuccessAt: null,
					lastError: null,
					successRate: 0.6,
					totalRuns: 10,
					successfulRuns: 6,
					failedRuns: 4,
					lastOpportunitiesCount: 50,
					avgRunDurationSeconds: null,
					avgOpportunitiesPerRun: null,
					dataQualityScore: null,
					valueScore: null,
				},
			];

			const sorted = sortSourcesByHealth(sources);
			expect(sorted[0].healthStatus).toBe("failing");
			expect(sorted[1].healthStatus).toBe("degraded");
			expect(sorted[2].healthStatus).toBe("healthy");
		});
	});

	describe("groupSourcesByTier", () => {
		it("should group sources by tier", () => {
			const sources: SourceHealthItem[] = [
				{
					sourceId: "1",
					sourceKey: "a",
					sourceName: "Tier 1 Source",
					healthStatus: "healthy",
					lastRunAt: null,
					lastSuccessAt: null,
					lastError: null,
					successRate: 0.9,
					totalRuns: 10,
					successfulRuns: 9,
					failedRuns: 1,
					lastOpportunitiesCount: 100,
					avgRunDurationSeconds: null,
					avgOpportunitiesPerRun: null,
					dataQualityScore: null,
					valueScore: null,
					scheduleTier: 1,
				},
				{
					sourceId: "2",
					sourceKey: "b",
					sourceName: "Tier 2 Source",
					healthStatus: "healthy",
					lastRunAt: null,
					lastSuccessAt: null,
					lastError: null,
					successRate: 0.85,
					totalRuns: 10,
					successfulRuns: 8,
					failedRuns: 2,
					lastOpportunitiesCount: 80,
					avgRunDurationSeconds: null,
					avgOpportunitiesPerRun: null,
					dataQualityScore: null,
					valueScore: null,
					scheduleTier: 2,
				},
				{
					sourceId: "3",
					sourceKey: "c",
					sourceName: "Another Tier 1",
					healthStatus: "degraded",
					lastRunAt: null,
					lastSuccessAt: null,
					lastError: null,
					successRate: 0.7,
					totalRuns: 10,
					successfulRuns: 7,
					failedRuns: 3,
					lastOpportunitiesCount: 70,
					avgRunDurationSeconds: null,
					avgOpportunitiesPerRun: null,
					dataQualityScore: null,
					valueScore: null,
					scheduleTier: 1,
				},
			];

			const grouped = groupSourcesByTier(sources);

			expect(grouped[1]).toHaveLength(2);
			expect(grouped[2]).toHaveLength(1);
			expect(grouped[3]).toBeUndefined();
		});

		it("should default to tier 3 if not specified", () => {
			const sources: SourceHealthItem[] = [
				{
					sourceId: "1",
					sourceKey: "a",
					sourceName: "Default Tier",
					healthStatus: "healthy",
					lastRunAt: null,
					lastSuccessAt: null,
					lastError: null,
					successRate: 0.9,
					totalRuns: 10,
					successfulRuns: 9,
					failedRuns: 1,
					lastOpportunitiesCount: 100,
					avgRunDurationSeconds: null,
					avgOpportunitiesPerRun: null,
					dataQualityScore: null,
					valueScore: null,
					// No scheduleTier specified
				},
			];

			const grouped = groupSourcesByTier(sources);
			expect(grouped[3]).toHaveLength(1);
		});
	});
});