"use client";

/**
 * ROI Calculator Component
 *
 * Displays ROI analysis with trend visualization, quarterly breakdown,
 * and actionable recommendations for improving proposal investment returns.
 */

import { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
	TrendingUp,
	TrendingDown,
	Minus,
	DollarSign,
	Target,
	Calculator,
	RefreshCw,
	Loader2,
	AlertTriangle,
	CheckCircle,
	BarChart3,
	ArrowUp,
	ArrowDown,
	Lightbulb,
	PieChart,
} from "lucide-react";
import { calculateProposalROI } from "@/lib/actions/winloss";
import type { ROIAnalysis, QuarterlyROI, Trend } from "@/lib/types/winloss";

interface ROICalculatorProps {
	initialAnalysis?: ROIAnalysis;
	onRecalculate?: () => void;
	className?: string;
}

const TREND_CONFIG: Record<Trend, { label: string; color: string; icon: React.ReactNode }> = {
	improving: {
		label: "Improving",
		color: "text-green-600",
		icon: <TrendingUp className="h-5 w-5 text-green-600" />,
	},
	declining: {
		label: "Declining",
		color: "text-red-600",
		icon: <TrendingDown className="h-5 w-5 text-red-600" />,
	},
	stable: {
		label: "Stable",
		color: "text-blue-600",
		icon: <Minus className="h-5 w-5 text-blue-600" />,
	},
};

export function ROICalculator({
	initialAnalysis,
	onRecalculate,
	className,
}: ROICalculatorProps) {
	const [isPending, startTransition] = useTransition();
	const [analysis, setAnalysis] = useState<ROIAnalysis | null>(initialAnalysis ?? null);
	const [isLoading, setIsLoading] = useState(!initialAnalysis);

	// Fetch ROI analysis
	const fetchAnalysis = useCallback(async () => {
		startTransition(async () => {
			setIsLoading(true);
			try {
				const result = await calculateProposalROI();

				if (result.success && result.data) {
					setAnalysis(result.data as unknown as ROIAnalysis);
				}
			} catch (error) {
				console.error("Failed to calculate ROI:", error);
			} finally {
				setIsLoading(false);
			}
		});
	}, []);

	useEffect(() => {
		if (!initialAnalysis) {
			fetchAnalysis();
		}
	}, [initialAnalysis, fetchAnalysis]);

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

	// Calculate quarterly chart max
	const quarterlyMax = useMemo(() => {
		if (!analysis?.byQuarter) return 100;
		return Math.max(
			...analysis.byQuarter.map((q) => Math.max(q.investment, q.revenue)),
			1
		);
	}, [analysis?.byQuarter]);

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
				<Card>
					<CardContent className="pt-6">
						<Skeleton className="h-48 w-full" />
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!analysis) {
		return (
			<div className={cn("text-center py-12", className)}>
				<Calculator className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
				<p className="text-muted-foreground">No ROI analysis available</p>
				<Button onClick={fetchAnalysis} className="mt-4">
					Calculate ROI
				</Button>
			</div>
		);
	}

	const trendConfig = TREND_CONFIG[analysis.trend] ?? TREND_CONFIG.stable;

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h2 className="text-xl font-semibold">ROI Analysis</h2>
					{isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
					<Badge
						variant="outline"
						className={cn(
							"flex items-center gap-1",
							analysis.trend === "improving"
								? "text-green-600 border-green-200"
								: analysis.trend === "declining"
								? "text-red-600 border-red-200"
								: "text-blue-600 border-blue-200"
						)}
					>
						{trendConfig.icon}
						{trendConfig.label}
					</Badge>
				</div>
				<Button
					variant="outline"
					onClick={() => {
						fetchAnalysis();
						onRecalculate?.();
					}}
					disabled={isPending}
				>
					<RefreshCw className={cn("h-4 w-4 mr-2", isPending && "animate-spin")} />
					Recalculate
				</Button>
			</div>

			{/* Key Metrics */}
			<div className="grid grid-cols-4 gap-4">
				{/* Overall ROI */}
				<Card className={cn(analysis.overallROI >= 100 ? "border-green-200" : "border-red-200")}>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Overall ROI</p>
								<p
									className={cn(
										"text-3xl font-bold mt-1",
										analysis.overallROI >= 0 ? "text-green-600" : "text-red-600"
									)}
								>
									{analysis.overallROI >= 0 ? "+" : ""}
									{analysis.overallROI.toFixed(0)}%
								</p>
							</div>
							<div
								className={cn(
									"p-3 rounded-full",
									analysis.overallROI >= 0 ? "bg-green-100" : "bg-red-100"
								)}
							>
								{analysis.overallROI >= 0 ? (
									<TrendingUp className="h-6 w-6 text-green-600" />
								) : (
									<TrendingDown className="h-6 w-6 text-red-600" />
								)}
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Cost Per Win */}
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Cost Per Win</p>
								<p className="text-3xl font-bold mt-1">
									{formatCurrency(analysis.costPerWin)}
								</p>
							</div>
							<div className="p-3 rounded-full bg-blue-100">
								<Target className="h-6 w-6 text-blue-600" />
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Avg Contract Value */}
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Avg Contract Value</p>
								<p className="text-3xl font-bold mt-1">
									{formatCurrency(analysis.averageContractValue)}
								</p>
							</div>
							<div className="p-3 rounded-full bg-green-100">
								<DollarSign className="h-6 w-6 text-green-600" />
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Projected Annual Return */}
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Projected Annual</p>
								<p className="text-3xl font-bold mt-1">
									{formatCurrency(analysis.projectedAnnualReturn)}
								</p>
							</div>
							<div className="p-3 rounded-full bg-purple-100">
								<BarChart3 className="h-6 w-6 text-purple-600" />
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Investment vs Revenue Chart */}
			<div className="grid grid-cols-2 gap-4">
				{/* Quarterly Breakdown */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<BarChart3 className="h-5 w-5" />
							Quarterly Performance
						</CardTitle>
						<CardDescription>Investment vs Revenue</CardDescription>
					</CardHeader>
					<CardContent>
						{analysis.byQuarter && analysis.byQuarter.length > 0 ? (
							<div className="space-y-4">
								{analysis.byQuarter.map((quarter) => {
									const investmentWidth = (quarter.investment / quarterlyMax) * 100;
									const revenueWidth = (quarter.revenue / quarterlyMax) * 100;

									return (
										<div key={`${quarter.quarter}-${quarter.year}`} className="space-y-2">
											<div className="flex justify-between text-sm">
												<span className="font-medium">
													{quarter.quarter} {quarter.year}
												</span>
												<span
													className={cn(
														"font-medium",
														quarter.roi >= 0 ? "text-green-600" : "text-red-600"
													)}
												>
													ROI: {quarter.roi >= 0 ? "+" : ""}
													{quarter.roi.toFixed(0)}%
												</span>
											</div>
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<span className="text-xs w-16 text-muted-foreground">
														Investment
													</span>
													<div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
														<div
															className="h-full bg-red-400 rounded-full"
															style={{ width: `${investmentWidth}%` }}
														/>
													</div>
													<span className="text-xs w-16 text-right">
														{formatCurrency(quarter.investment)}
													</span>
												</div>
												<div className="flex items-center gap-2">
													<span className="text-xs w-16 text-muted-foreground">
														Revenue
													</span>
													<div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
														<div
															className="h-full bg-green-500 rounded-full"
															style={{ width: `${revenueWidth}%` }}
														/>
													</div>
													<span className="text-xs w-16 text-right">
														{formatCurrency(quarter.revenue)}
													</span>
												</div>
											</div>
											<div className="flex justify-between text-xs text-muted-foreground pt-1">
												<span>{quarter.proposals} proposals</span>
												<span>{quarter.wins} wins</span>
											</div>
										</div>
									);
								})}
							</div>
						) : (
							<div className="h-48 flex items-center justify-center text-muted-foreground">
								No quarterly data available
							</div>
						)}
					</CardContent>
				</Card>

				{/* ROI Breakdown */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<PieChart className="h-5 w-5" />
							Investment Breakdown
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-6">
						{/* Avg Proposal Cost */}
						<div className="p-4 bg-muted rounded-lg">
							<div className="flex items-center justify-between mb-2">
								<span className="text-sm text-muted-foreground">
									Avg Proposal Cost
								</span>
								<span className="font-bold">
									{formatCurrency(analysis.averageProposalCost)}
								</span>
							</div>
							<Progress
								value={
									(analysis.averageProposalCost / analysis.averageContractValue) * 100
								}
								className="h-2 [&>div]:bg-amber-500"
							/>
							<p className="text-xs text-muted-foreground mt-1">
								{(
									(analysis.averageProposalCost / analysis.averageContractValue) *
									100
								).toFixed(1)}
								% of avg contract value
							</p>
						</div>

						{/* Cost Per Win */}
						<div className="p-4 bg-muted rounded-lg">
							<div className="flex items-center justify-between mb-2">
								<span className="text-sm text-muted-foreground">Cost Per Win</span>
								<span className="font-bold">
									{formatCurrency(analysis.costPerWin)}
								</span>
							</div>
							<Progress
								value={Math.min(
									(analysis.costPerWin / analysis.averageContractValue) * 100,
									100
								)}
								className={cn(
									"h-2",
									analysis.costPerWin / analysis.averageContractValue < 0.2
										? "[&>div]:bg-green-500"
										: analysis.costPerWin / analysis.averageContractValue < 0.4
										? "[&>div]:bg-amber-500"
										: "[&>div]:bg-red-500"
								)}
							/>
							<p className="text-xs text-muted-foreground mt-1">
								{(
									(analysis.costPerWin / analysis.averageContractValue) *
									100
								).toFixed(1)}
								% of avg contract value
							</p>
						</div>

						{/* Break-even Win Rate (if available) */}
						{analysis.breakEvenWinRate !== undefined && (
							<div className="p-4 bg-muted rounded-lg">
								<div className="flex items-center justify-between mb-2">
									<span className="text-sm text-muted-foreground">
										Break-even Win Rate
									</span>
									<span className="font-bold">
										{analysis.breakEvenWinRate.toFixed(1)}%
									</span>
								</div>
								<p className="text-xs text-muted-foreground">
									Win rate needed to break even on investments
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Recommendations */}
			{analysis.recommendations && analysis.recommendations.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Lightbulb className="h-5 w-5 text-amber-500" />
							Recommendations
						</CardTitle>
						<CardDescription>
							Actions to improve your proposal ROI
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ul className="space-y-3">
							{analysis.recommendations.map((rec, index) => (
								<li
									key={index}
									className="flex items-start gap-3 p-3 bg-muted rounded-lg"
								>
									{analysis.overallROI >= 100 ? (
										<CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
									) : (
										<AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
									)}
									<span className="text-sm">{rec}</span>
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			)}

			{/* ROI Summary */}
			<Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
				<CardContent className="py-6">
					<div className="grid grid-cols-3 gap-8 text-center">
						<div>
							<p className="text-sm text-muted-foreground mb-1">Total Investment</p>
							<p className="text-2xl font-bold">
								{formatCurrency(
									analysis.averageProposalCost *
										(analysis.byQuarter?.reduce((sum, q) => sum + q.proposals, 0) ?? 0)
								)}
							</p>
						</div>
						<div>
							<p className="text-sm text-muted-foreground mb-1">Total Returns</p>
							<p className="text-2xl font-bold text-green-600">
								{formatCurrency(
									analysis.byQuarter?.reduce((sum, q) => sum + q.revenue, 0) ?? 0
								)}
							</p>
						</div>
						<div>
							<p className="text-sm text-muted-foreground mb-1">Net Gain/Loss</p>
							<p
								className={cn(
									"text-2xl font-bold",
									analysis.overallROI >= 0 ? "text-green-600" : "text-red-600"
								)}
							>
								{analysis.overallROI >= 0 ? "+" : ""}
								{formatCurrency(
									(analysis.byQuarter?.reduce((sum, q) => sum + q.revenue, 0) ?? 0) -
										(analysis.byQuarter?.reduce((sum, q) => sum + q.investment, 0) ?? 0)
								)}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Period Info */}
			{analysis.periodStart && analysis.periodEnd && (
				<p className="text-xs text-muted-foreground text-center">
					Analysis period:{" "}
					{new Date(analysis.periodStart).toLocaleDateString()} -{" "}
					{new Date(analysis.periodEnd).toLocaleDateString()}
				</p>
			)}
		</div>
	);
}

export default ROICalculator;
