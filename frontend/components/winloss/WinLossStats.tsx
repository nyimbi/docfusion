"use client";

/**
 * Win/Loss Statistics Dashboard Component
 *
 * Displays comprehensive win/loss statistics including win rate,
 * ROI, monthly trends, and score breakdowns with charts.
 */

import { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Trophy,
	XCircle,
	TrendingUp,
	TrendingDown,
	Target,
	DollarSign,
	BarChart3,
	PieChart,
	Calendar,
	Building2,
	Users,
	Loader2,
	ArrowUp,
	ArrowDown,
	Minus,
} from "lucide-react";
import { getWinLossStatistics } from "@/lib/actions/winloss";
import type { WinLossStats, WinLossFilters, MonthlyStats } from "@/lib/types/winloss";

interface WinLossStatsProps {
	initialStats?: WinLossStats;
	onPeriodChange?: (period: string) => void;
	className?: string;
}

type TimePeriod = "3m" | "6m" | "12m" | "all";

export function WinLossStatsDisplay({
	initialStats,
	onPeriodChange,
	className,
}: WinLossStatsProps) {
	const [isPending, startTransition] = useTransition();
	const [stats, setStats] = useState<WinLossStats | null>(initialStats ?? null);
	const [isLoading, setIsLoading] = useState(!initialStats);
	const [timePeriod, setTimePeriod] = useState<TimePeriod>("12m");

	// Fetch statistics
	const fetchStats = useCallback(async () => {
		startTransition(async () => {
			setIsLoading(true);
			try {
				const filters: WinLossFilters = {};

				// Calculate date range based on period
				const now = new Date();
				switch (timePeriod) {
					case "3m":
						filters.dateFrom = new Date(now.setMonth(now.getMonth() - 3));
						break;
					case "6m":
						filters.dateFrom = new Date(now.setMonth(now.getMonth() - 6));
						break;
					case "12m":
						filters.dateFrom = new Date(now.setMonth(now.getMonth() - 12));
						break;
					// "all" - no date filter
				}

				const result = await getWinLossStatistics(filters as Parameters<typeof getWinLossStatistics>[0]);

				if (result.success && result.data) {
					setStats(result.data as unknown as WinLossStats);
				}
			} catch (error) {
				console.error("Failed to fetch statistics:", error);
			} finally {
				setIsLoading(false);
			}
		});
	}, [timePeriod]);

	useEffect(() => {
		if (!initialStats) {
			fetchStats();
		}
	}, [initialStats, fetchStats]);

	useEffect(() => {
		onPeriodChange?.(timePeriod);
	}, [timePeriod, onPeriodChange]);

	// Format currency
	const formatCurrency = (value: number | null | undefined): string => {
		if (value === null || value === undefined) return "-";
		if (value >= 1000000) {
			return `$${(value / 1000000).toFixed(1)}M`;
		}
		if (value >= 1000) {
			return `$${(value / 1000).toFixed(0)}K`;
		}
		return `$${value.toLocaleString()}`;
	};

	// Get trend icon
	const getTrendIcon = (current: number, threshold: number) => {
		if (current > threshold * 1.1) {
			return <ArrowUp className="h-4 w-4 text-green-600" />;
		}
		if (current < threshold * 0.9) {
			return <ArrowDown className="h-4 w-4 text-red-600" />;
		}
		return <Minus className="h-4 w-4 text-muted-foreground" />;
	};

	// Calculate max for chart scaling
	const maxMonthlyValue = useMemo(() => {
		if (!stats?.byMonth) return 10;
		return Math.max(
			...stats.byMonth.map((m) => m.wins + m.losses),
			1
		);
	}, [stats?.byMonth]);

	if (isLoading) {
		return (
			<div className={cn("space-y-6", className)}>
				<div className="flex items-center justify-between">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-10 w-32" />
				</div>
				<div className="grid grid-cols-4 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<Card key={i}>
							<CardContent className="pt-6">
								<Skeleton className="h-4 w-20 mb-2" />
								<Skeleton className="h-8 w-24" />
							</CardContent>
						</Card>
					))}
				</div>
				<div className="grid grid-cols-2 gap-4">
					<Card>
						<CardContent className="pt-6">
							<Skeleton className="h-48 w-full" />
						</CardContent>
					</Card>
					<Card>
						<CardContent className="pt-6">
							<Skeleton className="h-48 w-full" />
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	if (!stats) {
		return (
			<div className={cn("text-center py-12", className)}>
				<BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
				<p className="text-muted-foreground">No statistics available</p>
			</div>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h2 className="text-xl font-semibold">Win/Loss Statistics</h2>
					{isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
				</div>
				<Select
					value={timePeriod}
					onValueChange={(value) => setTimePeriod(value as TimePeriod)}
				>
					<SelectTrigger className="w-[140px]">
						<Calendar className="h-4 w-4 mr-2" />
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="3m">Last 3 Months</SelectItem>
						<SelectItem value="6m">Last 6 Months</SelectItem>
						<SelectItem value="12m">Last 12 Months</SelectItem>
						<SelectItem value="all">All Time</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Key Metrics */}
			<div className="grid grid-cols-4 gap-4">
				{/* Win Rate */}
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Win Rate</p>
								<p className="text-3xl font-bold mt-1">
									{stats.winRate.toFixed(1)}%
								</p>
								<p className="text-xs text-muted-foreground mt-1">
									{stats.wins} wins / {stats.wins + stats.losses} decisions
								</p>
							</div>
							<div
								className={cn(
									"p-3 rounded-full",
									stats.winRate >= 50 ? "bg-green-100" : "bg-red-100"
								)}
							>
								{stats.winRate >= 50 ? (
									<Trophy className="h-6 w-6 text-green-600" />
								) : (
									<Target className="h-6 w-6 text-red-600" />
								)}
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Total Proposals */}
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Total Proposals</p>
								<p className="text-3xl font-bold mt-1">{stats.totalProposals}</p>
								<div className="flex items-center gap-2 mt-1 text-xs">
									<span className="text-green-600">{stats.wins} won</span>
									<span className="text-muted-foreground">|</span>
									<span className="text-red-600">{stats.losses} lost</span>
								</div>
							</div>
							<div className="p-3 rounded-full bg-blue-100">
								<BarChart3 className="h-6 w-6 text-blue-600" />
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Contract Value */}
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Contract Value Won</p>
								<p className="text-3xl font-bold mt-1">
									{formatCurrency(stats.totalContractValue)}
								</p>
								<p className="text-xs text-muted-foreground mt-1">
									Investment: {formatCurrency(stats.totalInvestment)}
								</p>
							</div>
							<div className="p-3 rounded-full bg-green-100">
								<DollarSign className="h-6 w-6 text-green-600" />
							</div>
						</div>
					</CardContent>
				</Card>

				{/* ROI */}
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">ROI</p>
								<p
									className={cn(
										"text-3xl font-bold mt-1",
										stats.roi >= 0 ? "text-green-600" : "text-red-600"
									)}
								>
									{stats.roi >= 0 ? "+" : ""}
									{stats.roi.toFixed(0)}%
								</p>
								<p className="text-xs text-muted-foreground mt-1">
									Avg. Ranking: {stats.averageRanking?.toFixed(1) ?? "-"}
								</p>
							</div>
							<div
								className={cn(
									"p-3 rounded-full",
									stats.roi >= 0 ? "bg-green-100" : "bg-red-100"
								)}
							>
								{stats.roi >= 0 ? (
									<TrendingUp className="h-6 w-6 text-green-600" />
								) : (
									<TrendingDown className="h-6 w-6 text-red-600" />
								)}
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Charts Row */}
			<div className="grid grid-cols-2 gap-4">
				{/* Monthly Trend */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<BarChart3 className="h-5 w-5" />
							Monthly Trend
						</CardTitle>
						<CardDescription>Wins and losses over time</CardDescription>
					</CardHeader>
					<CardContent>
						{stats.byMonth && stats.byMonth.length > 0 ? (
							<div className="space-y-4">
								<div className="flex h-48 items-end gap-1">
									{stats.byMonth.slice(-12).map((month, index) => {
										const total = month.wins + month.losses;
										const winHeight = (month.wins / maxMonthlyValue) * 100;
										const lossHeight = (month.losses / maxMonthlyValue) * 100;

										return (
											<div
												key={month.month}
												className="flex-1 flex flex-col justify-end items-center gap-0.5"
												title={`${month.month}: ${month.wins} wins, ${month.losses} losses`}
											>
												<div
													className="w-full bg-green-500 rounded-t"
													style={{ height: `${winHeight}%` }}
												/>
												<div
													className="w-full bg-red-500 rounded-b"
													style={{ height: `${lossHeight}%` }}
												/>
												<span className="text-xs text-muted-foreground mt-1 rotate-45 origin-left whitespace-nowrap">
													{month.month.split("-")[1]}
												</span>
											</div>
										);
									})}
								</div>
								<div className="flex justify-center gap-4 text-sm">
									<div className="flex items-center gap-2">
										<div className="w-3 h-3 rounded bg-green-500" />
										<span>Wins</span>
									</div>
									<div className="flex items-center gap-2">
										<div className="w-3 h-3 rounded bg-red-500" />
										<span>Losses</span>
									</div>
								</div>
							</div>
						) : (
							<div className="h-48 flex items-center justify-center text-muted-foreground">
								No monthly data available
							</div>
						)}
					</CardContent>
				</Card>

				{/* Score Breakdown */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Target className="h-5 w-5" />
							Average Scores
						</CardTitle>
						<CardDescription>Performance by evaluation factor</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{[
							{ label: "Technical", value: stats.scoreBreakdown.technicalAvg },
							{ label: "Management", value: stats.scoreBreakdown.managementAvg },
							{ label: "Past Performance", value: stats.scoreBreakdown.pastPerfAvg },
							{ label: "Cost", value: stats.scoreBreakdown.costAvg },
						].map((score) => (
							<div key={score.label} className="space-y-2">
								<div className="flex justify-between text-sm">
									<span>{score.label}</span>
									<span className="font-medium">
										{score.value !== null && score.value !== undefined
											? `${score.value.toFixed(0)}%`
											: "-"}
									</span>
								</div>
								<Progress
									value={score.value ?? 0}
									className={cn(
										"h-2",
										score.value && score.value >= 80
											? "[&>div]:bg-green-500"
											: score.value && score.value >= 60
											? "[&>div]:bg-yellow-500"
											: "[&>div]:bg-red-500"
									)}
								/>
							</div>
						))}
					</CardContent>
				</Card>
			</div>

			{/* Bottom Row */}
			<div className="grid grid-cols-2 gap-4">
				{/* By Agency */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Building2 className="h-5 w-5" />
							Performance by Agency
						</CardTitle>
					</CardHeader>
					<CardContent>
						{stats.byAgency && stats.byAgency.length > 0 ? (
							<div className="space-y-3">
								{stats.byAgency.slice(0, 5).map((agency) => (
									<div
										key={agency.agencyId || agency.agencyName}
										className="flex items-center justify-between"
									>
										<div className="flex-1 min-w-0">
											<p className="font-medium truncate">{agency.agencyName}</p>
											<p className="text-sm text-muted-foreground">
												{agency.wins} / {agency.proposals} proposals
											</p>
										</div>
										<Badge
											variant="secondary"
											className={cn(
												agency.winRate >= 50
													? "bg-green-100 text-green-800"
													: "bg-red-100 text-red-800"
											)}
										>
											{agency.winRate.toFixed(0)}%
										</Badge>
									</div>
								))}
							</div>
						) : (
							<div className="text-center py-8 text-muted-foreground">
								No agency data available
							</div>
						)}
					</CardContent>
				</Card>

				{/* By Competitor */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5" />
							Performance vs Competitors
						</CardTitle>
					</CardHeader>
					<CardContent>
						{stats.byCompetitor && stats.byCompetitor.length > 0 ? (
							<div className="space-y-3">
								{stats.byCompetitor.slice(0, 5).map((competitor) => (
									<div
										key={competitor.competitorId || competitor.competitorName}
										className="flex items-center justify-between"
									>
										<div className="flex-1 min-w-0">
											<p className="font-medium truncate">
												{competitor.competitorName}
											</p>
											<p className="text-sm text-muted-foreground">
												{competitor.wins} wins / {competitor.losses} losses
											</p>
										</div>
										<Badge
											variant="secondary"
											className={cn(
												competitor.winRateAgainst >= 50
													? "bg-green-100 text-green-800"
													: "bg-red-100 text-red-800"
											)}
										>
											{competitor.winRateAgainst.toFixed(0)}%
										</Badge>
									</div>
								))}
							</div>
						) : (
							<div className="text-center py-8 text-muted-foreground">
								No competitor data available
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Outcome Distribution */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<PieChart className="h-5 w-5" />
						Outcome Distribution
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-4 gap-4">
						<div className="text-center p-4 rounded-lg bg-green-50 border border-green-100">
							<Trophy className="h-8 w-8 mx-auto text-green-600 mb-2" />
							<p className="text-3xl font-bold text-green-700">{stats.wins}</p>
							<p className="text-sm text-green-600">Wins</p>
							<p className="text-xs text-green-500 mt-1">
								{stats.totalProposals > 0
									? `${((stats.wins / stats.totalProposals) * 100).toFixed(1)}%`
									: "0%"}
							</p>
						</div>
						<div className="text-center p-4 rounded-lg bg-red-50 border border-red-100">
							<XCircle className="h-8 w-8 mx-auto text-red-600 mb-2" />
							<p className="text-3xl font-bold text-red-700">{stats.losses}</p>
							<p className="text-sm text-red-600">Losses</p>
							<p className="text-xs text-red-500 mt-1">
								{stats.totalProposals > 0
									? `${((stats.losses / stats.totalProposals) * 100).toFixed(1)}%`
									: "0%"}
							</p>
						</div>
						<div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-100">
							<Target className="h-8 w-8 mx-auto text-yellow-600 mb-2" />
							<p className="text-3xl font-bold text-yellow-700">{stats.noAward}</p>
							<p className="text-sm text-yellow-600">No Award</p>
							<p className="text-xs text-yellow-500 mt-1">
								{stats.totalProposals > 0
									? `${((stats.noAward / stats.totalProposals) * 100).toFixed(1)}%`
									: "0%"}
							</p>
						</div>
						<div className="text-center p-4 rounded-lg bg-gray-50 border border-gray-200">
							<BarChart3 className="h-8 w-8 mx-auto text-gray-500 mb-2" />
							<p className="text-3xl font-bold text-gray-700">{stats.cancelled}</p>
							<p className="text-sm text-gray-600">Cancelled</p>
							<p className="text-xs text-gray-500 mt-1">
								{stats.totalProposals > 0
									? `${((stats.cancelled / stats.totalProposals) * 100).toFixed(1)}%`
									: "0%"}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export { WinLossStatsDisplay as WinLossStats };
export default WinLossStatsDisplay;
