/**
 * Tests for Scraper Status Dashboard Widget
 *
 * Tests the React component patterns for the dashboard widget.
 */

import { describe, it, expect, beforeEach } from "vitest";

// Mock types matching the dashboard widget props and state
interface SourceHealth {
	sourceKey: string;
	sourceName: string;
	tier: number;
	lastRunStatus: "success" | "partial" | "failed" | "timeout" | null;
	lastRunAt: Date | null;
	successRate: number;
	consecutiveFailures: number;
}

interface ScraperStats {
	totalRuns: number;
	successRate: number;
	avgDurationSeconds: number;
	totalOpportunities: number;
	sourcesByTier: {
		tier: number;
		healthy: number;
		degraded: number;
		failing: number;
		unknown: number;
	}[];
}

interface WidgetState {
	stats: ScraperStats | null;
	healthByTier: Map<number, SourceHealth[]>;
	isLoading: boolean;
	error: string | null;
	lastRefresh: Date | null;
}

// Health status calculation logic
function calculateHealthStatus(
	successRate: number,
	consecutiveFailures: number
): "healthy" | "degraded" | "failing" | "unknown" {
	if (consecutiveFailures >= 3) {
		return "failing";
	}

	if (successRate >= 0.8) {
		return "healthy";
	}

	if (successRate >= 0.5) {
		return "degraded";
	}

	if (successRate === 0 && consecutiveFailures === 0) {
		return "unknown";
	}

	return "failing";
}

// Stats formatting helpers
function formatDuration(seconds: number): string {
	if (seconds < 60) {
		return `${seconds}s`;
	}

	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;

	if (minutes < 60) {
		return remainingSeconds > 0
			? `${minutes}m ${remainingSeconds}s`
			: `${minutes}m`;
	}

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return `${hours}h ${remainingMinutes}m`;
}

function formatSuccessRate(rate: number): string {
	return `${Math.round(rate * 100)}%`;
}

function formatNumber(num: number): string {
	if (num >= 1000000) {
		return `${(num / 1000000).toFixed(1)}M`;
	}

	if (num >= 1000) {
		return `${(num / 1000).toFixed(1)}K`;
	}

	return num.toString();
}

// Color mapping for health status
function getHealthColor(
	status: "healthy" | "degraded" | "failing" | "unknown"
): string {
	const colors = {
		healthy: "green",
		degraded: "yellow",
		failing: "red",
		unknown: "gray",
	};

	return colors[status];
}

// Tier scheduling info
function getTierInfo(tier: number): { name: string; interval: string } {
	const tiers: Record<number, { name: string; interval: string }> = {
		1: { name: "High Priority", interval: "Every 6 hours" },
		2: { name: "Medium Priority", interval: "Every 12 hours" },
		3: { name: "Low Priority", interval: "Daily" },
	};

	return tiers[tier] ?? { name: `Tier ${tier}`, interval: "Unknown" };
}

describe("Scraper Status Widget Logic", () => {
	describe("Health Status Calculation", () => {
		it("should return healthy for high success rate", () => {
			expect(calculateHealthStatus(0.9, 0)).toBe("healthy");
			expect(calculateHealthStatus(0.8, 0)).toBe("healthy");
			expect(calculateHealthStatus(1.0, 0)).toBe("healthy");
		});

		it("should return degraded for medium success rate", () => {
			expect(calculateHealthStatus(0.7, 0)).toBe("degraded");
			expect(calculateHealthStatus(0.5, 0)).toBe("degraded");
			expect(calculateHealthStatus(0.6, 0)).toBe("degraded");
		});

		it("should return failing for low success rate", () => {
			expect(calculateHealthStatus(0.4, 0)).toBe("failing");
			expect(calculateHealthStatus(0.3, 0)).toBe("failing");
			expect(calculateHealthStatus(0.0, 1)).toBe("failing");
		});

		it("should return failing for consecutive failures", () => {
			expect(calculateHealthStatus(0.9, 3)).toBe("failing");
			expect(calculateHealthStatus(0.9, 5)).toBe("failing");
		});

		it("should return unknown for no data", () => {
			expect(calculateHealthStatus(0, 0)).toBe("unknown");
		});
	});

	describe("Duration Formatting", () => {
		it("should format seconds correctly", () => {
			expect(formatDuration(30)).toBe("30s");
			expect(formatDuration(59)).toBe("59s");
		});

		it("should format minutes correctly", () => {
			expect(formatDuration(60)).toBe("1m");
			expect(formatDuration(90)).toBe("1m 30s");
			expect(formatDuration(120)).toBe("2m");
		});

		it("should format hours correctly", () => {
			expect(formatDuration(3600)).toBe("1h 0m");
			expect(formatDuration(3661)).toBe("1h 1m");
			expect(formatDuration(7200)).toBe("2h 0m");
		});
	});

	describe("Success Rate Formatting", () => {
		it("should format as percentage", () => {
			expect(formatSuccessRate(0.5)).toBe("50%");
			expect(formatSuccessRate(0.75)).toBe("75%");
			expect(formatSuccessRate(1.0)).toBe("100%");
			expect(formatSuccessRate(0.833)).toBe("83%");
		});
	});

	describe("Number Formatting", () => {
		it("should format small numbers as-is", () => {
			expect(formatNumber(10)).toBe("10");
			expect(formatNumber(500)).toBe("500");
		});

		it("should format thousands with K", () => {
			expect(formatNumber(1000)).toBe("1.0K");
			expect(formatNumber(5500)).toBe("5.5K");
		});

		it("should format millions with M", () => {
			expect(formatNumber(1000000)).toBe("1.0M");
			expect(formatNumber(2500000)).toBe("2.5M");
		});
	});

	describe("Health Color Mapping", () => {
		it("should return correct colors", () => {
			expect(getHealthColor("healthy")).toBe("green");
			expect(getHealthColor("degraded")).toBe("yellow");
			expect(getHealthColor("failing")).toBe("red");
			expect(getHealthColor("unknown")).toBe("gray");
		});
	});

	describe("Tier Information", () => {
		it("should return correct tier 1 info", () => {
			const info = getTierInfo(1);
			expect(info.name).toBe("High Priority");
			expect(info.interval).toBe("Every 6 hours");
		});

		it("should return correct tier 2 info", () => {
			const info = getTierInfo(2);
			expect(info.name).toBe("Medium Priority");
			expect(info.interval).toBe("Every 12 hours");
		});

		it("should return correct tier 3 info", () => {
			const info = getTierInfo(3);
			expect(info.name).toBe("Low Priority");
			expect(info.interval).toBe("Daily");
		});

		it("should handle unknown tiers", () => {
			const info = getTierInfo(99);
			expect(info.name).toBe("Tier 99");
			expect(info.interval).toBe("Unknown");
		});
	});
});

describe("Widget State Management", () => {
	let state: WidgetState;

	beforeEach(() => {
		state = {
			stats: null,
			healthByTier: new Map(),
			isLoading: false,
			error: null,
			lastRefresh: null,
		};
	});

	describe("Initial State", () => {
		it("should start with null stats", () => {
			expect(state.stats).toBeNull();
		});

		it("should start with empty health map", () => {
			expect(state.healthByTier.size).toBe(0);
		});

		it("should start not loading", () => {
			expect(state.isLoading).toBe(false);
		});
	});

	describe("State Updates", () => {
		it("should update stats correctly", () => {
			const newStats: ScraperStats = {
				totalRuns: 100,
				successRate: 0.85,
				avgDurationSeconds: 300,
				totalOpportunities: 5000,
				sourcesByTier: [
					{ tier: 1, healthy: 5, degraded: 2, failing: 1, unknown: 0 },
				],
			};

			state.stats = newStats;
			expect(state.stats).toEqual(newStats);
		});

		it("should update health by tier", () => {
			const tier1Health: SourceHealth[] = [
				{
					sourceKey: "ungm",
					sourceName: "UN Global Marketplace",
					tier: 1,
					lastRunStatus: "success",
					lastRunAt: new Date(),
					successRate: 0.95,
					consecutiveFailures: 0,
				},
			];

			state.healthByTier.set(1, tier1Health);
			expect(state.healthByTier.get(1)).toEqual(tier1Health);
		});

		it("should track loading state", () => {
			state.isLoading = true;
			expect(state.isLoading).toBe(true);

			state.isLoading = false;
			expect(state.isLoading).toBe(false);
		});

		it("should track errors", () => {
			state.error = "Failed to fetch data";
			expect(state.error).toBe("Failed to fetch data");

			state.error = null;
			expect(state.error).toBeNull();
		});

		it("should track last refresh time", () => {
			const now = new Date();
			state.lastRefresh = now;
			expect(state.lastRefresh).toBe(now);
		});
	});
});

describe("Refresh Logic", () => {
	it("should calculate next refresh time", () => {
		const refreshIntervalMs = 5 * 60 * 1000; // 5 minutes
		const lastRefresh = new Date("2026-01-01T10:00:00Z");
		const nextRefresh = new Date(
			lastRefresh.getTime() + refreshIntervalMs
		);

		expect(nextRefresh.toISOString()).toBe("2026-01-01T10:05:00.000Z");
	});

	it("should determine if refresh is needed", () => {
		const refreshIntervalMs = 5 * 60 * 1000; // 5 minutes

		const now = new Date();
		const recentRefresh = new Date(now.getTime() - 1000); // 1 second ago
		const oldRefresh = new Date(now.getTime() - refreshIntervalMs - 1000);

		function needsRefresh(lastRefresh: Date | null): boolean {
			if (!lastRefresh) return true;
			return now.getTime() - lastRefresh.getTime() > refreshIntervalMs;
		}

		expect(needsRefresh(null)).toBe(true);
		expect(needsRefresh(recentRefresh)).toBe(false);
		expect(needsRefresh(oldRefresh)).toBe(true);
	});
});