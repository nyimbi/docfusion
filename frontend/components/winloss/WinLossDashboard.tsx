"use client";

/**
 * Win/Loss Dashboard Component
 *
 * Main dashboard combining key metrics, recent activity, alerts,
 * and quick access to detailed analysis tools.
 */

import { useState, useEffect, useTransition, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Trophy,
	XCircle,
	TrendingUp,
	TrendingDown,
	Target,
	DollarSign,
	BarChart3,
	Lightbulb,
	CheckCircle,
	AlertTriangle,
	Clock,
	Plus,
	ChevronRight,
	RefreshCw,
	Loader2,
	ArrowUp,
	ArrowDown,
	Minus,
	Zap,
	Users,
	FileText,
	Calendar,
} from "lucide-react";
import { getDashboardMetrics } from "@/lib/actions/winloss";
import type { ActionItem } from "@/lib/types/winloss";

// Extended DashboardMetrics interface to include all properties used in the component
interface DashboardMetrics {
	currentWinRate: number;
	winRateChange: number;
	totalDebriefs: number;
	pendingDebriefs: number;
	totalContractValueWon: number;
	pipelineValue: number;
	roi: number;
	trendDirection?: "up" | "down" | "stable";
	recentDebriefs?: Array<{
		id: string;
		opportunityTitle?: string;
		outcome: string;
		debriefDate?: Date | string;
	}>;
	topStrength?: string;
	topWeakness?: string;
	activePatterns: number;
	pendingActionItems: number;
	upcomingActionItems?: ActionItem[];
	recentWins: number;
	recentLosses: number;
	activeProposals: number;
}

interface WinLossDashboardProps {
	initialMetrics?: DashboardMetrics;
	onCreateDebrief?: () => void;
	onViewDebriefs?: () => void;
	onViewPatterns?: () => void;
	onViewStats?: () => void;
	className?: string;
}

export function WinLossDashboard({
	initialMetrics,
	onCreateDebrief,
	onViewDebriefs,
	onViewPatterns,
	onViewStats,
	className,
}: WinLossDashboardProps) {
	const [isPending, startTransition] = useTransition();
	const [metrics, setMetrics] = useState<DashboardMetrics | null>(initialMetrics ?? null);
	const [isLoading, setIsLoading] = useState(!initialMetrics);

	// Fetch dashboard metrics
	const fetchMetrics = useCallback(async () => {
		startTransition(async () => {
			setIsLoading(true);
			try {
				const result = await getDashboardMetrics();

				if (result.success && result.data) {
					setMetrics(result.data as unknown as DashboardMetrics);
				}
			} catch (error) {
				console.error("Failed to fetch dashboard metrics:", error);
			} finally {
				setIsLoading(false);
			}
		});
	}, []);

	useEffect(() => {
		if (!initialMetrics) {
			fetchMetrics();
		}
	}, [initialMetrics, fetchMetrics]);

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

	// Format date
	const formatDate = (date: Date | string | null | undefined): string => {
		if (!date) return "-";
		return new Date(date).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	};

	// Get trend icon
	const getTrendIcon = () => {
		if (!metrics) return null;
		switch (metrics.trendDirection) {
			case "up":
				return <ArrowUp className="h-4 w-4 text-green-600" />;
			case "down":
				return <ArrowDown className="h-4 w-4 text-red-600" />;
			default:
				return <Minus className="h-4 w-4 text-muted-foreground" />;
		}
	};

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
				<div className="grid grid-cols-3 gap-4">
					<Card className="col-span-2">
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

	if (!metrics) {
		return (
			<div className={cn("text-center py-12", className)}>
				<BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
				<p className="text-muted-foreground">No dashboard data available</p>
				<Button onClick={fetchMetrics} className="mt-4">
					Refresh
				</Button>
			</div>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-2xl font-bold">Win/Loss Intelligence</h1>
					{isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" onClick={fetchMetrics} disabled={isPending}>
						<RefreshCw className={cn("h-4 w-4 mr-2", isPending && "animate-spin")} />
						Refresh
					</Button>
					{onCreateDebrief && (
						<Button onClick={onCreateDebrief}>
							<Plus className="h-4 w-4 mr-2" />
							New Debrief
						</Button>
					)}
				</div>
			</div>

			{/* Key Metrics */}
			<div className="grid grid-cols-4 gap-4">
				{/* Win Rate */}
				<Card
					className={cn(
						"cursor-pointer hover:border-primary/50 transition-colors",
						metrics.currentWinRate >= 50 ? "border-green-200" : "border-red-200"
					)}
					onClick={onViewStats}
				>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Win Rate</p>
								<div className="flex items-baseline gap-2">
									<p
										className={cn(
											"text-3xl font-bold mt-1",
											metrics.currentWinRate >= 50
												? "text-green-600"
												: "text-red-600"
										)}
									>
										{metrics.currentWinRate.toFixed(0)}%
									</p>
									{metrics.winRateChange !== 0 && (
										<span
											className={cn(
												"text-sm flex items-center gap-0.5",
												metrics.winRateChange > 0
													? "text-green-600"
													: "text-red-600"
											)}
										>
											{metrics.winRateChange > 0 ? (
												<ArrowUp className="h-3 w-3" />
											) : (
												<ArrowDown className="h-3 w-3" />
											)}
											{Math.abs(metrics.winRateChange).toFixed(0)}%
										</span>
									)}
								</div>
							</div>
							<div
								className={cn(
									"p-3 rounded-full",
									metrics.currentWinRate >= 50 ? "bg-green-100" : "bg-red-100"
								)}
							>
								{metrics.currentWinRate >= 50 ? (
									<Trophy className="h-6 w-6 text-green-600" />
								) : (
									<Target className="h-6 w-6 text-red-600" />
								)}
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Total Debriefs */}
				<Card
					className="cursor-pointer hover:border-primary/50 transition-colors"
					onClick={onViewDebriefs}
				>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Total Debriefs</p>
								<p className="text-3xl font-bold mt-1">{metrics.totalDebriefs}</p>
								<p className="text-xs text-muted-foreground mt-1">
									{metrics.pendingDebriefs} pending review
								</p>
							</div>
							<div className="p-3 rounded-full bg-blue-100">
								<FileText className="h-6 w-6 text-blue-600" />
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Contract Value */}
				<Card className="cursor-pointer hover:border-primary/50 transition-colors">
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Value Won</p>
								<p className="text-3xl font-bold mt-1 text-green-600">
									{formatCurrency(metrics.totalContractValueWon)}
								</p>
								<p className="text-xs text-muted-foreground mt-1">
									Pipeline: {formatCurrency(metrics.pipelineValue)}
								</p>
							</div>
							<div className="p-3 rounded-full bg-green-100">
								<DollarSign className="h-6 w-6 text-green-600" />
							</div>
						</div>
					</CardContent>
				</Card>

				{/* ROI */}
				<Card className="cursor-pointer hover:border-primary/50 transition-colors">
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">ROI</p>
								<div className="flex items-center gap-2">
									<p
										className={cn(
											"text-3xl font-bold mt-1",
											metrics.roi >= 0 ? "text-green-600" : "text-red-600"
										)}
									>
										{metrics.roi >= 0 ? "+" : ""}
										{metrics.roi.toFixed(0)}%
									</p>
									{getTrendIcon()}
								</div>
							</div>
							<div
								className={cn(
									"p-3 rounded-full",
									metrics.roi >= 0 ? "bg-green-100" : "bg-red-100"
								)}
							>
								{metrics.roi >= 0 ? (
									<TrendingUp className="h-6 w-6 text-green-600" />
								) : (
									<TrendingDown className="h-6 w-6 text-red-600" />
								)}
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Main Content Row */}
			<div className="grid grid-cols-3 gap-4">
				{/* Recent Debriefs */}
				<Card className="col-span-2">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<div>
							<CardTitle>Recent Debriefs</CardTitle>
							<CardDescription>Latest proposal outcomes</CardDescription>
						</div>
						{onViewDebriefs && (
							<Button variant="ghost" size="sm" onClick={onViewDebriefs}>
								View All
								<ChevronRight className="h-4 w-4 ml-1" />
							</Button>
						)}
					</CardHeader>
					<CardContent>
						{metrics.recentDebriefs && metrics.recentDebriefs.length > 0 ? (
							<div className="space-y-3">
								{metrics.recentDebriefs.map((debrief, index) => (
									<Link
										key={debrief.id}
										href={`/winloss/${debrief.id}`}
										className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
									>
										<div
											className={cn(
												"p-2 rounded-full flex-shrink-0",
												debrief.outcome === "win"
													? "bg-green-100"
													: debrief.outcome === "loss"
													? "bg-red-100"
													: "bg-gray-100"
											)}
										>
											{debrief.outcome === "win" ? (
												<Trophy className="h-4 w-4 text-green-600" />
											) : debrief.outcome === "loss" ? (
												<XCircle className="h-4 w-4 text-red-600" />
											) : (
												<Target className="h-4 w-4 text-gray-600" />
											)}
										</div>
										<div className="flex-1 min-w-0">
											<p className="font-medium truncate">
												{debrief.opportunityTitle}
											</p>
											<p className="text-sm text-muted-foreground">
												{formatDate(debrief.debriefDate)}
											</p>
										</div>
										<Badge
											variant="secondary"
											className={cn(
												debrief.outcome === "win"
													? "bg-green-100 text-green-700"
													: debrief.outcome === "loss"
													? "bg-red-100 text-red-700"
													: "bg-gray-100 text-gray-700"
											)}
										>
											{debrief.outcome === "win"
												? "Won"
												: debrief.outcome === "loss"
												? "Lost"
												: "No Award"}
										</Badge>
									</Link>
								))}
							</div>
						) : (
							<div className="text-center py-8 text-muted-foreground">
								<FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
								<p>No recent debriefs</p>
								{onCreateDebrief && (
									<Button variant="link" onClick={onCreateDebrief} className="mt-2">
										Create your first debrief
									</Button>
								)}
							</div>
						)}
					</CardContent>
				</Card>

				{/* Insights & Alerts */}
				<div className="space-y-4">
					{/* Key Insights */}
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-base flex items-center gap-2">
								<Lightbulb className="h-5 w-5 text-amber-500" />
								Key Insights
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{/* Top Strength */}
							{metrics.topStrength && (
								<div className="flex items-start gap-2 p-2 bg-green-50 rounded-lg">
									<CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
									<div>
										<p className="text-sm font-medium text-green-700">Top Strength</p>
										<p className="text-sm text-green-600 line-clamp-2">
											{metrics.topStrength}
										</p>
									</div>
								</div>
							)}

							{/* Top Weakness */}
							{metrics.topWeakness && (
								<div className="flex items-start gap-2 p-2 bg-red-50 rounded-lg">
									<AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
									<div>
										<p className="text-sm font-medium text-red-700">Top Weakness</p>
										<p className="text-sm text-red-600 line-clamp-2">
											{metrics.topWeakness}
										</p>
									</div>
								</div>
							)}

							{/* Active Patterns */}
							<div className="flex items-center justify-between pt-2">
								<span className="text-sm text-muted-foreground">
									Active patterns
								</span>
								<Badge variant="secondary">{metrics.activePatterns}</Badge>
							</div>
						</CardContent>
					</Card>

					{/* Action Items Alert */}
					{metrics.pendingActionItems > 0 && (
						<Card className="border-amber-200 bg-amber-50">
							<CardContent className="pt-6">
								<div className="flex items-center gap-3">
									<div className="p-2 rounded-full bg-amber-100">
										<Clock className="h-5 w-5 text-amber-600" />
									</div>
									<div className="flex-1">
										<p className="font-medium text-amber-800">
											{metrics.pendingActionItems} Pending Action Items
										</p>
										<p className="text-sm text-amber-600">
											Review and complete outstanding tasks
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Upcoming Action Items */}
					{metrics.upcomingActionItems && metrics.upcomingActionItems.length > 0 && (
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-base flex items-center gap-2">
									<CheckCircle className="h-5 w-5" />
									Upcoming Actions
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{metrics.upcomingActionItems.slice(0, 3).map((item, index) => (
										<div
											key={item.id}
											className="flex items-start gap-2 text-sm"
										>
											<Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
											<div className="flex-1 min-w-0">
												<p className="line-clamp-1">{item.item}</p>
												<p className="text-xs text-muted-foreground">
													Due: {formatDate(item.dueDate)}
												</p>
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			</div>

			{/* Quick Stats Row */}
			<div className="grid grid-cols-4 gap-4">
				<Card
					className="cursor-pointer hover:bg-muted/50 transition-colors"
					onClick={onViewStats}
				>
					<CardContent className="py-4 flex items-center gap-3">
						<div className="p-2 rounded-full bg-green-100">
							<Trophy className="h-5 w-5 text-green-600" />
						</div>
						<div>
							<p className="text-2xl font-bold text-green-600">{metrics.recentWins}</p>
							<p className="text-sm text-muted-foreground">Recent Wins</p>
						</div>
					</CardContent>
				</Card>

				<Card
					className="cursor-pointer hover:bg-muted/50 transition-colors"
					onClick={onViewStats}
				>
					<CardContent className="py-4 flex items-center gap-3">
						<div className="p-2 rounded-full bg-red-100">
							<XCircle className="h-5 w-5 text-red-600" />
						</div>
						<div>
							<p className="text-2xl font-bold text-red-600">{metrics.recentLosses}</p>
							<p className="text-sm text-muted-foreground">Recent Losses</p>
						</div>
					</CardContent>
				</Card>

				<Card
					className="cursor-pointer hover:bg-muted/50 transition-colors"
					onClick={onViewPatterns}
				>
					<CardContent className="py-4 flex items-center gap-3">
						<div className="p-2 rounded-full bg-purple-100">
							<Zap className="h-5 w-5 text-purple-600" />
						</div>
						<div>
							<p className="text-2xl font-bold">{metrics.activePatterns}</p>
							<p className="text-sm text-muted-foreground">Active Patterns</p>
						</div>
					</CardContent>
				</Card>

				<Card className="cursor-pointer hover:bg-muted/50 transition-colors">
					<CardContent className="py-4 flex items-center gap-3">
						<div className="p-2 rounded-full bg-blue-100">
							<Users className="h-5 w-5 text-blue-600" />
						</div>
						<div>
							<p className="text-2xl font-bold">{metrics.activeProposals}</p>
							<p className="text-sm text-muted-foreground">Active Proposals</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Quick Links */}
			<Card>
				<CardHeader>
					<CardTitle>Quick Actions</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-4 gap-4">
						<Button
							variant="outline"
							className="h-auto py-4 flex flex-col gap-2"
							onClick={onCreateDebrief}
						>
							<Plus className="h-6 w-6" />
							<span>New Debrief</span>
						</Button>
						<Button
							variant="outline"
							className="h-auto py-4 flex flex-col gap-2"
							onClick={onViewStats}
						>
							<BarChart3 className="h-6 w-6" />
							<span>View Statistics</span>
						</Button>
						<Button
							variant="outline"
							className="h-auto py-4 flex flex-col gap-2"
							onClick={onViewPatterns}
						>
							<Zap className="h-6 w-6" />
							<span>Analyze Patterns</span>
						</Button>
						<Button
							variant="outline"
							className="h-auto py-4 flex flex-col gap-2"
							asChild
						>
							<Link href="/winloss/lessons">
								<Lightbulb className="h-6 w-6" />
								<span>Lessons Learned</span>
							</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export default WinLossDashboard;
