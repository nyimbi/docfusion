"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
	CheckCircle2,
	XCircle,
	AlertTriangle,
	Clock,
	RefreshCw,
	TrendingUp,
	Activity,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
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

interface StatsResponse {
	success: boolean;
	data: ScraperStats;
}

interface HealthResponse {
	success: boolean;
	data: ScraperHealthData;
}

// ============================================================================
// Constants
// ============================================================================

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const HEALTH_STATUS_CONFIG = {
	healthy: {
		icon: CheckCircle2,
		color: "text-green-600",
		bgColor: "bg-green-50",
		borderColor: "border-green-200",
		badgeVariant: "default" as const,
		label: "Healthy",
	},
	degraded: {
		icon: AlertTriangle,
		color: "text-amber-600",
		bgColor: "bg-amber-50",
		borderColor: "border-amber-200",
		badgeVariant: "secondary" as const,
		label: "Degraded",
	},
	failing: {
		icon: XCircle,
		color: "text-red-600",
		bgColor: "bg-red-50",
		borderColor: "border-red-200",
		badgeVariant: "destructive" as const,
		label: "Failing",
	},
	unknown: {
		icon: Clock,
		color: "text-slate-500",
		bgColor: "bg-slate-50",
		borderColor: "border-slate-200",
		badgeVariant: "outline" as const,
		label: "Unknown",
	},
	disabled: {
		icon: XCircle,
		color: "text-slate-400",
		bgColor: "bg-slate-100",
		borderColor: "border-slate-200",
		badgeVariant: "outline" as const,
		label: "Disabled",
	},
};

const TIER_LABELS: Record<number, string> = {
	1: "Tier 1 (6-hour)",
	2: "Tier 2 (12-hour)",
	3: "Tier 3 (Daily)",
};

// ============================================================================
// Loading Skeleton
// ============================================================================

function ScraperStatusSkeleton() {
	return (
		<Card variant="default">
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-8 w-8 rounded-lg" />
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Stats row */}
				<div className="grid grid-cols-3 gap-4">
					<div className="space-y-2">
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-8 w-20" />
					</div>
					<div className="space-y-2">
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-8 w-20" />
					</div>
					<div className="space-y-2">
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-8 w-20" />
					</div>
				</div>
				{/* Progress bar */}
				<div className="space-y-2">
					<div className="flex justify-between">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-12" />
					</div>
					<Skeleton className="h-2 w-full" />
				</div>
				{/* Sources by tier */}
				<div className="space-y-3 pt-2">
					<Skeleton className="h-5 w-32" />
					<div className="space-y-2">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				</div>
			</CardContent>
			<CardFooter>
				<Skeleton className="h-9 w-full" />
			</CardFooter>
		</Card>
	);
}

// ============================================================================
// Error State
// ============================================================================

interface ErrorStateProps {
	error: string;
	onRetry: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
	return (
		<Card variant="default">
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg">Scraper Status</CardTitle>
					<Button
						variant="ghost"
						size="icon"
						onClick={onRetry}
						aria-label="Retry"
					>
						<RefreshCw className="h-4 w-4" />
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col items-center justify-center py-8 text-center">
					<XCircle className="h-12 w-12 text-red-500 mb-4" />
					<p className="text-sm text-muted-foreground mb-2">Failed to load scraper status</p>
					<p className="text-xs text-muted-foreground">{error}</p>
				</div>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Health Status Badge
// ============================================================================

interface HealthBadgeProps {
	status: string;
	size?: "sm" | "md";
}

function HealthBadge({ status, size = "md" }: HealthBadgeProps) {
	const config = HEALTH_STATUS_CONFIG[status as keyof typeof HEALTH_STATUS_CONFIG]
		|| HEALTH_STATUS_CONFIG.unknown;

	const Icon = config.icon;

	return (
		<Badge
			variant={config.badgeVariant}
			className={cn(
				"gap-1.5",
				size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1"
			)}
		>
			<Icon className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
			{config.label}
		</Badge>
	);
}

// ============================================================================
// Source Item
// ============================================================================

interface SourceItemProps {
	source: SourceHealthItem;
}

function SourceItem({ source }: SourceItemProps) {
	const config = HEALTH_STATUS_CONFIG[source.healthStatus as keyof typeof HEALTH_STATUS_CONFIG]
		|| HEALTH_STATUS_CONFIG.unknown;

	const Icon = config.icon;

	const lastRunText = source.lastRunAt
		? formatRelativeTime(new Date(source.lastRunAt))
		: "Never";

	return (
		<div
			className={cn(
				"flex items-center justify-between p-3 rounded-lg border",
				config.bgColor,
				config.borderColor
			)}
		>
			<div className="flex items-center gap-3 min-w-0 flex-1">
				<Icon className={cn("h-4 w-4 shrink-0", config.color)} />
				<div className="min-w-0 flex-1">
					<p className="text-sm font-medium truncate">{source.sourceName}</p>
					<p className="text-xs text-muted-foreground">
						{lastRunText}
						{source.lastOpportunitiesCount > 0 && (
							<span className="ml-2">
								{source.lastOpportunitiesCount} opps
							</span>
						)}
					</p>
				</div>
			</div>
			<div className="flex items-center gap-2 shrink-0">
				{source.successRate !== null && (
					<span className={cn(
						"text-xs font-medium",
						source.successRate >= 80 ? "text-green-600" :
						source.successRate >= 50 ? "text-amber-600" : "text-red-600"
					)}>
						{Math.round(source.successRate)}%
					</span>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatRelativeTime(date: Date): string {
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

function formatDuration(seconds: number): string {
	if (seconds < 60) return `${Math.round(seconds)}s`;
	if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
	return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

// ============================================================================
// Main Component
// ============================================================================

export interface ScraperStatusWidgetProps {
	/** Enable auto-refresh (default: true) */
	autoRefresh?: boolean;
	/** Refresh interval in milliseconds (default: 5 minutes) */
	refreshInterval?: number;
	/** Callback when "View Runs" is clicked */
	onViewRuns?: () => void;
	/** Callback when "Run All" is clicked */
	onRunAll?: () => void;
	/** Show detailed source list (default: true) */
	showSources?: boolean;
	/** Max sources to show per tier */
	maxSourcesPerTier?: number;
	/** Additional CSS classes */
	className?: string;
}

export function ScraperStatusWidget({
	autoRefresh = true,
	refreshInterval = REFRESH_INTERVAL_MS,
	onViewRuns,
	onRunAll,
	showSources = true,
	maxSourcesPerTier = 3,
	className,
}: ScraperStatusWidgetProps) {
	const [stats, setStats] = useState<ScraperStats | null>(null);
	const [health, setHealth] = useState<ScraperHealthData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async (isBackgroundRefresh = false) => {
		if (!isBackgroundRefresh) {
			setIsLoading(true);
		}
		setError(null);

		try {
			const [statsRes, healthRes] = await Promise.all([
				fetch("/api/admin/scraper/stats"),
				fetch("/api/admin/scraper/health"),
			]);

			if (!statsRes.ok || !healthRes.ok) {
				throw new Error("Failed to fetch data");
			}

			const statsData: StatsResponse = await statsRes.json();
			const healthData: HealthResponse = await healthRes.json();

			if (!statsData.success || !healthData.success) {
				throw new Error("API returned error");
			}

			setStats(statsData.data);
			setHealth(healthData.data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setIsLoading(false);
			setIsRefreshing(false);
		}
	}, []);

	const handleRefresh = useCallback(() => {
		setIsRefreshing(true);
		fetchData(true);
	}, [fetchData]);

	// Initial fetch
	useEffect(() => {
		fetchData();
	}, [fetchData]);

	// Auto-refresh
	useEffect(() => {
		if (!autoRefresh) return;

		const interval = setInterval(() => {
			fetchData(true);
		}, refreshInterval);

		return () => clearInterval(interval);
	}, [autoRefresh, refreshInterval, fetchData]);

	// Loading state
	if (isLoading) {
		return <ScraperStatusSkeleton />;
	}

	// Error state
	if (error && !stats && !health) {
		return <ErrorState error={error} onRetry={handleRefresh} />;
	}

	// Determine overall status
	const overallConfig = health
		? HEALTH_STATUS_CONFIG[health.overallStatus as keyof typeof HEALTH_STATUS_CONFIG]
		: HEALTH_STATUS_CONFIG.unknown;

	const OverallIcon = overallConfig.icon;

	return (
		<Card variant="default" className={className}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Activity className="h-5 w-5 text-muted-foreground" />
						<CardTitle className="text-lg">Scraper Status</CardTitle>
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={handleRefresh}
						disabled={isRefreshing}
						aria-label="Refresh"
					>
						<RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
					</Button>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Overall Health Badge */}
				{health && (
					<div className="flex items-center gap-2">
						<HealthBadge status={health.overallStatus} />
						<span className="text-sm text-muted-foreground">
							{health.summary.enabled} of {health.summary.total} sources enabled
						</span>
					</div>
				)}

				{/* Stats Grid */}
				{stats && (
					<div className="grid grid-cols-3 gap-4">
						<div>
							<p className="text-xs text-muted-foreground mb-1">Total Runs</p>
							<p className="text-2xl font-semibold">{stats.totalRuns}</p>
							<p className="text-xs text-muted-foreground">last 24h</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground mb-1">Successful</p>
							<p className="text-2xl font-semibold text-green-600">
								{stats.successful}
							</p>
							{stats.partial > 0 && (
								<p className="text-xs text-muted-foreground">
									{stats.partial} partial
								</p>
							)}
						</div>
						<div>
							<p className="text-xs text-muted-foreground mb-1">Failed</p>
							<p className="text-2xl font-semibold text-red-600">
								{stats.failed}
							</p>
						</div>
					</div>
				)}

				{/* Success Rate Progress */}
				{stats && (
					<div className="space-y-2">
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">Success Rate</span>
							<span className="font-medium">{stats.successRate.toFixed(1)}%</span>
						</div>
						<Progress
							value={stats.successRate}
							className={cn(
								"h-2",
								stats.successRate >= 80 ? "[&>div]:bg-green-500" :
								stats.successRate >= 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"
							)}
						/>
					</div>
				)}

				{/* Additional Metrics */}
				{stats && (stats.avgDurationSeconds || stats.totalOpportunitiesFound > 0) && (
					<div className="flex items-center gap-4 text-xs text-muted-foreground">
						{stats.avgDurationSeconds && (
							<div className="flex items-center gap-1">
								<Clock className="h-3 w-3" />
								<span>Avg: {formatDuration(stats.avgDurationSeconds)}</span>
							</div>
						)}
						{stats.totalOpportunitiesFound > 0 && (
							<div className="flex items-center gap-1">
								<TrendingUp className="h-3 w-3" />
								<span>{stats.totalOpportunitiesFound.toLocaleString()} opportunities</span>
							</div>
						)}
					</div>
				)}

				{/* Sources by Tier */}
				{showSources && health && (
					<div className="space-y-3 pt-2 border-t">
						{Object.entries(health.byTier).map(([tier, sources]) => {
							if (sources.length === 0) return null;

							const displaySources = sources.slice(0, maxSourcesPerTier);
							const remaining = sources.length - maxSourcesPerTier;

							return (
								<div key={tier} className="space-y-2">
									<p className="text-sm font-medium text-muted-foreground">
										{TIER_LABELS[Number(tier)] || `Tier ${tier}`}
									</p>
									<div className="space-y-1.5">
										{displaySources.map((source) => (
											<SourceItem key={source.sourceId} source={source} />
										))}
										{remaining > 0 && (
											<p className="text-xs text-muted-foreground pl-3">
												+{remaining} more sources
											</p>
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</CardContent>

			<CardFooter className="gap-2">
				{onViewRuns && (
					<Button
						variant="outline"
						size="sm"
						onClick={onViewRuns}
						className="flex-1"
					>
						<Activity className="h-4 w-4 mr-2" />
						View Runs
					</Button>
				)}
				{onRunAll && (
					<Button
						variant="primary"
						size="sm"
						onClick={onRunAll}
						className="flex-1"
					>
						<RefreshCw className="h-4 w-4 mr-2" />
						Run All Now
					</Button>
				)}
			</CardFooter>
		</Card>
	);
}

export default ScraperStatusWidget;