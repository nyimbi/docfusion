"use client";

/**
 * Forecast Widget Component
 *
 * Displays revenue forecasts based on deal pipeline data.
 * Shows projections by month with probability weighting.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	TrendingUp,
	TrendingDown,
	Target,
	DollarSign,
	Calendar,
	AlertTriangle,
} from "lucide-react";
import type { DealRow } from "@/lib/db/schema-crm";

interface ForecastWidgetProps {
	deals: DealRow[];
	target?: number;
	months?: number;
	showQuota?: boolean;
	quotaProgress?: number;
	className?: string;
}

// Deal stage probabilities
const STAGE_PROBABILITIES: Record<string, number> = {
	qualification: 10,
	discovery: 25,
	proposal: 50,
	negotiation: 75,
	closed_won: 100,
	closed_lost: 0,
};

// Format currency
const formatCurrency = (value: number, compact = false) => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		notation: compact || value >= 1000000 ? "compact" : "standard",
		maximumFractionDigits: value >= 1000000 ? 1 : 0,
	}).format(value);
};

// Get month name
const getMonthName = (date: Date) => {
	return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

// Calculate forecast data
const calculateForecast = (deals: DealRow[], months: number) => {
	const now = new Date();
	const forecast: {
		month: string;
		date: Date;
		committed: number;
		bestCase: number;
		pipeline: number;
		deals: number;
	}[] = [];

	for (let i = 0; i < months; i++) {
		const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
		const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);

		const monthDeals = deals.filter((d) => {
			if (!d.expectedCloseDate || d.status !== "open") return false;
			const closeDate = new Date(d.expectedCloseDate);
			return closeDate >= monthDate && closeDate <= monthEnd;
		});

		const committed = monthDeals
			.filter((d) => ["negotiation"].includes(d.stage))
			.reduce((sum, d) => {
				const probability = STAGE_PROBABILITIES[d.stage] ?? 0;
				return sum + (d.value ?? 0) * (probability / 100);
			}, 0);

		const bestCase = monthDeals.reduce((sum, d) => {
			const probability = STAGE_PROBABILITIES[d.stage] ?? 0;
			return sum + (d.value ?? 0) * (probability / 100);
		}, 0);

		const pipeline = monthDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);

		forecast.push({
			month: getMonthName(monthDate),
			date: monthDate,
			committed,
			bestCase,
			pipeline,
			deals: monthDeals.length,
		});
	}

	return forecast;
};

export function ForecastWidget({
	deals,
	target,
	months = 3,
	showQuota = true,
	quotaProgress,
	className,
}: ForecastWidgetProps) {
	const forecast = useMemo(() => calculateForecast(deals, months), [deals, months]);

	const totals = useMemo(() => {
		return {
			committed: forecast.reduce((sum, f) => sum + f.committed, 0),
			bestCase: forecast.reduce((sum, f) => sum + f.bestCase, 0),
			pipeline: forecast.reduce((sum, f) => sum + f.pipeline, 0),
		};
	}, [forecast]);

	const quotaPercentage = target && target > 0 ? (totals.bestCase / target) * 100 : 0;
	const isOnTrack = quotaPercentage >= 80;
	const isAtRisk = quotaPercentage < 60;

	return (
		<Card className={className}>
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base font-medium">Revenue Forecast</CardTitle>
					<div className="flex items-center gap-2">
						{target && (
							<Badge
								variant={isOnTrack ? "default" : isAtRisk ? "destructive" : "secondary"}
								className="text-xs"
							>
								{isOnTrack ? (
									<TrendingUp className="h-3 w-3 mr-1" />
								) : isAtRisk ? (
									<AlertTriangle className="h-3 w-3 mr-1" />
								) : (
									<TrendingDown className="h-3 w-3 mr-1" />
								)}
								{quotaPercentage.toFixed(0)}% of target
							</Badge>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Summary totals */}
				<div className="grid grid-cols-3 gap-4 pb-4 border-b">
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">Committed</p>
						<p className="text-lg font-semibold text-green-600">
							{formatCurrency(totals.committed)}
						</p>
						<p className="text-xs text-muted-foreground">High confidence</p>
					</div>
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">Best Case</p>
						<p className="text-lg font-semibold text-blue-600">
							{formatCurrency(totals.bestCase)}
						</p>
						<p className="text-xs text-muted-foreground">Weighted forecast</p>
					</div>
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">Pipeline</p>
						<p className="text-lg font-semibold">{formatCurrency(totals.pipeline)}</p>
						<p className="text-xs text-muted-foreground">Total value</p>
					</div>
				</div>

				{/* Quota progress */}
				{showQuota && target && (
					<div className="space-y-2">
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground flex items-center gap-1">
								<Target className="h-4 w-4" />
								Target: {formatCurrency(target)}
							</span>
							<span
								className={cn(
									"font-medium",
									isOnTrack && "text-green-600",
									isAtRisk && "text-red-600",
									!isOnTrack && !isAtRisk && "text-amber-600"
								)}
							>
								{formatCurrency(totals.bestCase)} / {formatCurrency(target)}
							</span>
						</div>
						<Progress
							value={Math.min(quotaPercentage, 100)}
							className={cn(
								"h-2",
								isOnTrack && "[&>div]:bg-green-500",
								isAtRisk && "[&>div]:bg-red-500",
								!isOnTrack && !isAtRisk && "[&>div]:bg-amber-500"
							)}
						/>
					</div>
				)}

				{/* Monthly breakdown */}
				<div className="space-y-3">
					<p className="text-xs font-medium text-muted-foreground">Monthly Breakdown</p>
					{forecast.map((month, index) => {
						const maxValue = Math.max(...forecast.map((f) => f.pipeline), 1);

						return (
							<div key={month.month} className="space-y-1">
								<div className="flex items-center justify-between text-sm">
									<div className="flex items-center gap-2">
										<Calendar className="h-4 w-4 text-muted-foreground" />
										<span className="font-medium">{month.month}</span>
										<Badge variant="outline" className="text-xs">
											{month.deals} deals
										</Badge>
									</div>
									<span className="text-muted-foreground">
										{formatCurrency(month.bestCase, true)} weighted
									</span>
								</div>

								{/* Stacked bar showing committed vs best case vs pipeline */}
								<div className="relative h-4 bg-muted rounded-full overflow-hidden">
									{/* Pipeline (full bar) */}
									<div
										className="absolute inset-y-0 left-0 bg-slate-300 rounded-full"
										style={{ width: `${(month.pipeline / maxValue) * 100}%` }}
									/>
									{/* Best case */}
									<div
										className="absolute inset-y-0 left-0 bg-blue-400 rounded-full"
										style={{ width: `${(month.bestCase / maxValue) * 100}%` }}
									/>
									{/* Committed */}
									<div
										className="absolute inset-y-0 left-0 bg-green-500 rounded-full"
										style={{ width: `${(month.committed / maxValue) * 100}%` }}
									/>
								</div>

								<div className="flex items-center gap-4 text-xs text-muted-foreground">
									<div className="flex items-center gap-1">
										<div className="h-2 w-2 rounded-full bg-green-500" />
										<span>Committed: {formatCurrency(month.committed, true)}</span>
									</div>
									<div className="flex items-center gap-1">
										<div className="h-2 w-2 rounded-full bg-blue-400" />
										<span>Best: {formatCurrency(month.bestCase, true)}</span>
									</div>
									<div className="flex items-center gap-1">
										<div className="h-2 w-2 rounded-full bg-slate-300" />
										<span>Pipeline: {formatCurrency(month.pipeline, true)}</span>
									</div>
								</div>
							</div>
						);
					})}
				</div>

				{/* Legend */}
				<div className="pt-2 border-t text-xs text-muted-foreground">
					<p>
						<strong>Committed:</strong> Negotiation stage deals (75% probability)
					</p>
					<p>
						<strong>Best Case:</strong> All deals weighted by stage probability
					</p>
					<p>
						<strong>Pipeline:</strong> Total unweighted value
					</p>
				</div>
			</CardContent>
		</Card>
	);
}

export default ForecastWidget;
