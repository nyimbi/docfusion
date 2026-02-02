"use client";

/**
 * PWin Dashboard Component
 *
 * Comprehensive dashboard showing PWin overview, portfolio metrics,
 * opportunity rankings, and trend analysis. Provides at-a-glance
 * visibility into the health of the opportunity pipeline.
 *
 * Features:
 * - Portfolio summary metrics (total opportunities, weighted value, avg PWin)
 * - PWin distribution chart
 * - Top opportunities ranking
 * - Recent trend indicators
 * - At-risk opportunity alerts
 *
 * @example
 * ```tsx
 * <PwinDashboard
 *   organizationId="org-123"
 *   onOpportunitySelect={(id) => router.push(`/opportunities/${id}`)}
 * />
 * ```
 */

import { useState, useEffect, useCallback } from "react";
import {
	Target,
	TrendingUp,
	TrendingDown,
	Gauge,
	BarChart3,
	AlertTriangle,
	DollarSign,
	Award,
	RefreshCw,
	Loader2,
	ChevronRight,
	Minus,
	ArrowUp,
	ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
	getPortfolioMetrics,
	rankOpportunities,
} from "@/lib/actions/pwin";
import type {
	PortfolioMetrics,
	OpportunityRanking,
} from "@/lib/types/pwin";

// ============================================================================
// Types
// ============================================================================

interface PwinDashboardProps {
	organizationId?: string;
	onOpportunitySelect?: (opportunityId: string) => void;
	className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number): string {
	if (value >= 1e9) {
		return `$${(value / 1e9).toFixed(1)}B`;
	}
	if (value >= 1e6) {
		return `$${(value / 1e6).toFixed(1)}M`;
	}
	if (value >= 1e3) {
		return `$${(value / 1e3).toFixed(0)}K`;
	}
	return `$${value.toFixed(0)}`;
}

function getPwinBadgeVariant(pwin: number): "default" | "secondary" | "destructive" | "outline" {
	if (pwin >= 70) return "default";
	if (pwin >= 50) return "secondary";
	if (pwin >= 30) return "outline";
	return "destructive";
}

function getPwinColor(pwin: number): string {
	if (pwin >= 70) return "text-green-600 dark:text-green-400";
	if (pwin >= 50) return "text-amber-600 dark:text-amber-400";
	if (pwin >= 30) return "text-orange-600 dark:text-orange-400";
	return "text-red-600 dark:text-red-400";
}

function getDistributionBarColor(range: string): string {
	if (range.includes("70") || range.includes("80") || range.includes("90")) {
		return "bg-green-500";
	}
	if (range.includes("50") || range.includes("60")) {
		return "bg-amber-500";
	}
	if (range.includes("30") || range.includes("40")) {
		return "bg-orange-500";
	}
	return "bg-red-500";
}

// ============================================================================
// Component
// ============================================================================

export function PwinDashboard({
	organizationId,
	onOpportunitySelect,
	className,
}: PwinDashboardProps) {
	// State
	const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
	const [rankings, setRankings] = useState<OpportunityRanking[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Load dashboard data
	const loadDashboardData = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const [metricsResult, rankingsResult] = await Promise.all([
				getPortfolioMetrics(organizationId),
				rankOpportunities({
					sortBy: "expected_value",
					limit: 10,
					organizationId,
				}),
			]);

			if (metricsResult.success) {
				setMetrics(metricsResult.data);
			} else {
				setError(metricsResult.error);
			}

			if (rankingsResult.success) {
				setRankings(rankingsResult.data);
			}
		} catch (err) {
			setError("Failed to load dashboard data");
		}

		setIsLoading(false);
	}, [organizationId]);

	// Load data on mount
	useEffect(() => {
		loadDashboardData();
	}, [loadDashboardData]);

	// Loading state
	if (isLoading) {
		return <PwinDashboardSkeleton className={className} />;
	}

	// Error state
	if (error) {
		return (
			<Card className={className}>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<AlertTriangle className="h-12 w-12 text-destructive mb-4" />
					<p className="text-lg font-medium mb-2">Failed to Load Dashboard</p>
					<p className="text-sm text-muted-foreground mb-4">{error}</p>
					<Button onClick={loadDashboardData} variant="outline">
						<RefreshCw className="h-4 w-4 mr-2" />
						Retry
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold flex items-center gap-2">
						<Target className="h-6 w-6 text-primary" />
						PWin Dashboard
					</h2>
					<p className="text-muted-foreground">
						Portfolio performance and opportunity rankings
					</p>
				</div>
				<Button variant="outline" size="sm" onClick={loadDashboardData}>
					<RefreshCw className="h-4 w-4 mr-2" />
					Refresh
				</Button>
			</div>

			{/* Summary Metrics */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<MetricCard
					title="Total Opportunities"
					value={metrics?.totalOpportunities ?? 0}
					icon={BarChart3}
					trend={null}
				/>
				<MetricCard
					title="Pipeline Value"
					value={formatCurrency(metrics?.totalPipelineValue ?? 0)}
					icon={DollarSign}
					subtitle="Total contract value"
				/>
				<MetricCard
					title="Weighted Value"
					value={formatCurrency(metrics?.weightedPipelineValue ?? 0)}
					icon={Gauge}
					subtitle="PWin-weighted value"
				/>
				<MetricCard
					title="Average PWin"
					value={`${metrics?.averagePwin ?? 0}%`}
					icon={Target}
					trend={metrics?.averagePwin && metrics.averagePwin > 50 ? "up" : metrics?.averagePwin && metrics.averagePwin < 40 ? "down" : null}
					trendLabel={metrics?.averagePwin && metrics.averagePwin > 50 ? "Above target" : metrics?.averagePwin && metrics.averagePwin < 40 ? "Below target" : undefined}
				/>
			</div>

			{/* Second Row: Expected Wins and At Risk */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base flex items-center gap-2">
							<Award className="h-4 w-4 text-green-500" />
							Expected Wins
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span className="text-3xl font-bold text-green-600">
								{metrics?.expectedWins?.toFixed(1) ?? 0}
							</span>
							<span className="text-muted-foreground">
								of {metrics?.totalOpportunities ?? 0}
							</span>
						</div>
						<p className="text-sm text-muted-foreground mt-1">
							Based on current PWin assessments
						</p>
					</CardContent>
				</Card>

				<Card className={cn(
					metrics?.atRiskCount && metrics.atRiskCount > 0 ? "border-amber-500/50" : ""
				)}>
					<CardHeader className="pb-2">
						<CardTitle className="text-base flex items-center gap-2">
							<AlertTriangle className={cn(
								"h-4 w-4",
								metrics?.atRiskCount && metrics.atRiskCount > 0 ? "text-amber-500" : "text-muted-foreground"
							)} />
							At Risk
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span className={cn(
								"text-3xl font-bold",
								metrics?.atRiskCount && metrics.atRiskCount > 0 ? "text-amber-600" : "text-muted-foreground"
							)}>
								{metrics?.atRiskCount ?? 0}
							</span>
							<span className="text-muted-foreground">opportunities</span>
						</div>
						<p className="text-sm text-muted-foreground mt-1">
							PWin below 30% requiring attention
						</p>
					</CardContent>
				</Card>
			</div>

			{/* PWin Distribution and Rankings */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* PWin Distribution */}
				<Card>
					<CardHeader>
						<CardTitle className="text-base">PWin Distribution</CardTitle>
						<CardDescription>
							Opportunities grouped by probability range
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{metrics?.pwinDistribution && metrics.pwinDistribution.length > 0 ? (
							metrics.pwinDistribution.map((bucket, idx) => (
								<div key={idx} className="space-y-1">
									<div className="flex justify-between text-sm">
										<span>{bucket.range}</span>
										<span className="font-medium">{bucket.count}</span>
									</div>
									<div className="h-2 bg-muted rounded-full overflow-hidden">
										<div
											className={cn(
												"h-full transition-all",
												getDistributionBarColor(bucket.range)
											)}
											style={{
												width: `${Math.min(100, (bucket.count / (metrics.totalOpportunities || 1)) * 100)}%`,
											}}
										/>
									</div>
								</div>
							))
						) : (
							<p className="text-sm text-muted-foreground text-center py-4">
								No distribution data available
							</p>
						)}
					</CardContent>
				</Card>

				{/* Top Opportunities */}
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Top Opportunities</CardTitle>
						<CardDescription>
							Ranked by expected value (PWin x Contract Value)
						</CardDescription>
					</CardHeader>
					<CardContent>
						{rankings.length > 0 ? (
							<div className="space-y-3">
								{rankings.slice(0, 5).map((opp, idx) => (
									<div
										key={opp.opportunityId}
										className={cn(
											"flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
											onOpportunitySelect && "cursor-pointer"
										)}
										onClick={() => onOpportunitySelect?.(opp.opportunityId)}
									>
										<div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
											{idx + 1}
										</div>
										<div className="flex-1 min-w-0">
											<p className="font-medium truncate">{opp.opportunityName}</p>
											<div className="flex items-center gap-2 text-xs text-muted-foreground">
												<span>{formatCurrency(opp.value)}</span>
												<span>|</span>
												<span>EV: {formatCurrency(opp.expectedValue)}</span>
											</div>
										</div>
										<Badge variant={getPwinBadgeVariant(opp.pwin)}>
											{opp.pwin}%
										</Badge>
										{onOpportunitySelect && (
											<ChevronRight className="h-4 w-4 text-muted-foreground" />
										)}
									</div>
								))}
							</div>
						) : (
							<p className="text-sm text-muted-foreground text-center py-4">
								No opportunities with PWin assessments
							</p>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Category Breakdown (if available) */}
			{metrics?.byCategory && Object.keys(metrics.byCategory).length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Performance by Category</CardTitle>
						<CardDescription>
							PWin metrics grouped by opportunity category
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{Object.entries(metrics.byCategory).map(([category, data]) => (
								<div
									key={category}
									className="p-3 bg-muted/30 rounded-lg space-y-2"
								>
									<div className="font-medium capitalize">{category}</div>
									<div className="grid grid-cols-3 gap-2 text-sm">
										<div>
											<div className="text-muted-foreground text-xs">Count</div>
											<div className="font-medium">{data.count}</div>
										</div>
										<div>
											<div className="text-muted-foreground text-xs">Value</div>
											<div className="font-medium">{formatCurrency(data.value)}</div>
										</div>
										<div>
											<div className="text-muted-foreground text-xs">Avg PWin</div>
											<div className={cn("font-medium", getPwinColor(data.avgPwin))}>
												{data.avgPwin}%
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

// ============================================================================
// Metric Card Sub-Component
// ============================================================================

interface MetricCardProps {
	title: string;
	value: string | number;
	icon: React.ElementType;
	subtitle?: string;
	trend?: "up" | "down" | null;
	trendLabel?: string;
}

function MetricCard({
	title,
	value,
	icon: Icon,
	subtitle,
	trend,
	trendLabel,
}: MetricCardProps) {
	return (
		<Card>
			<CardContent className="pt-6">
				<div className="flex items-start justify-between">
					<div>
						<p className="text-sm text-muted-foreground">{title}</p>
						<p className="text-2xl font-bold mt-1">{value}</p>
						{subtitle && (
							<p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
						)}
						{trend && (
							<div className={cn(
								"flex items-center gap-1 text-xs mt-1",
								trend === "up" ? "text-green-600" : "text-red-600"
							)}>
								{trend === "up" ? (
									<ArrowUp className="h-3 w-3" />
								) : (
									<ArrowDown className="h-3 w-3" />
								)}
								{trendLabel}
							</div>
						)}
					</div>
					<div className="p-2 bg-primary/10 rounded-lg">
						<Icon className="h-5 w-5 text-primary" />
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Skeleton Component
// ============================================================================

function PwinDashboardSkeleton({ className }: { className?: string }) {
	return (
		<div className={cn("space-y-6", className)}>
			<div className="flex items-center justify-between">
				<div>
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-64 mt-2" />
				</div>
				<Skeleton className="h-9 w-24" />
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Card key={i}>
						<CardContent className="pt-6">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-8 w-20 mt-2" />
						</CardContent>
					</Card>
				))}
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<Skeleton className="h-5 w-32" />
						<Skeleton className="h-4 w-48" />
					</CardHeader>
					<CardContent className="space-y-3">
						{Array.from({ length: 5 }).map((_, i) => (
							<Skeleton key={i} className="h-8 w-full" />
						))}
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<Skeleton className="h-5 w-32" />
						<Skeleton className="h-4 w-48" />
					</CardHeader>
					<CardContent className="space-y-3">
						{Array.from({ length: 5 }).map((_, i) => (
							<Skeleton key={i} className="h-12 w-full" />
						))}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

export default PwinDashboard;
