/**
 * PricingSummary - Pricing Roll-up Display
 *
 * Displays period-by-period breakdown, grand totals, indirect rates,
 * and optional visualization charts for labor mix and cost breakdown.
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
	DollarSign,
	Clock,
	TrendingUp,
	PieChart,
	BarChart3,
	RefreshCw,
	AlertCircle,
	Loader2,
	ChevronDown,
	ChevronRight,
	Download,
	Percent,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	TableFooter,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type {
	CostElementType,
} from "@/lib/types/pricing";
import {
	getPricingSummary,
	recalculatePricing,
	type PricingSummaryUIData,
	type PeriodSummary,
} from "@/lib/actions/pricing";

// =============================================================================
// Types
// =============================================================================

export interface PricingSummaryProps {
	/** Opportunity ID to display summary for */
	opportunityId: string;
	/** Whether to show visualization charts */
	showCharts?: boolean;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const COST_TYPE_COLORS: Record<CostElementType | string, string> = {
	labor: "bg-blue-500",
	odc: "bg-purple-500",
	subcontract: "bg-green-500",
	travel: "bg-amber-500",
	material: "bg-cyan-500",
	equipment: "bg-indigo-500",
	other: "bg-gray-500",
};

const LABOR_LEVEL_COLORS: Record<string, string> = {
	junior: "bg-green-400",
	mid: "bg-blue-400",
	senior: "bg-purple-400",
	principal: "bg-amber-400",
	executive: "bg-red-400",
};

// =============================================================================
// Utility Functions
// =============================================================================

function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
}

function formatNumber(value: number): string {
	return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "percent",
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	}).format(value / 100);
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function PricingSummarySkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-9 w-24" />
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				<Skeleton className="h-32 w-full" />
				<Skeleton className="h-48 w-full" />
				<Skeleton className="h-32 w-full" />
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Grand Total Card
// =============================================================================

interface GrandTotalCardProps {
	summary: PricingSummaryUIData;
}

function GrandTotalCard({ summary }: GrandTotalCardProps) {
	return (
		<div className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg">
			<div className="flex items-start justify-between">
				<div>
					<div className="text-sm text-muted-foreground font-medium">
						Total Proposed Cost
					</div>
					<div className="text-4xl font-bold mt-1">
						{formatCurrency(summary.grandTotal.totalCost)}
					</div>
				</div>
				<div className="text-right">
					<div className="text-sm text-muted-foreground">Total Labor Hours</div>
					<div className="text-2xl font-semibold">
						{formatNumber(summary.grandTotal.laborHours)}
					</div>
				</div>
			</div>

			<Separator className="my-4" />

			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<div>
					<div className="text-xs text-muted-foreground">Direct Cost</div>
					<div className="font-semibold">{formatCurrency(summary.grandTotal.directCost)}</div>
				</div>
				<div>
					<div className="text-xs text-muted-foreground">Indirect Cost</div>
					<div className="font-semibold">{formatCurrency(summary.grandTotal.indirectCost)}</div>
				</div>
				<div>
					<div className="text-xs text-muted-foreground">Fee</div>
					<div className="font-semibold">{formatCurrency(summary.grandTotal.fee)}</div>
				</div>
				<div>
					<div className="text-xs text-muted-foreground">Contract Type</div>
					<div className="font-semibold capitalize">
						{summary.contractType?.replace(/_/g, " ") || "Not specified"}
					</div>
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// Period Summary Table
// =============================================================================

interface PeriodSummaryTableProps {
	periods: PeriodSummary[];
	grandTotal: PricingSummaryUIData["grandTotal"];
}

function PeriodSummaryTable({ periods, grandTotal }: PeriodSummaryTableProps) {
	const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());

	const togglePeriod = (periodId: string) => {
		setExpandedPeriods((prev) => {
			const next = new Set(prev);
			if (next.has(periodId)) {
				next.delete(periodId);
			} else {
				next.add(periodId);
			}
			return next;
		});
	};

	return (
		<div className="border rounded-lg overflow-hidden">
			<Table>
				<TableHeader>
					<TableRow className="bg-muted/50">
						<TableHead className="w-[200px]">Period</TableHead>
						<TableHead className="text-right">Labor</TableHead>
						<TableHead className="text-right">ODC</TableHead>
						<TableHead className="text-right">Travel</TableHead>
						<TableHead className="text-right">Other</TableHead>
						<TableHead className="text-right">Indirect</TableHead>
						<TableHead className="text-right">Fee</TableHead>
						<TableHead className="text-right font-semibold">Total</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{periods.map((period, index) => {
						const periodKey = `period-${period.periodNumber}`;
						const periodName = period.periodType === "base"
							? "Base Period"
							: `Option ${period.periodNumber - 1}`;
						// Calculate indirect as overhead + G&A applied
						const gaAmount = period.totalDirectCost * period.gaRate;
						const feeAmount = (period.totalDirectCost + period.overhead + gaAmount) * period.feeRate;
						const indirectTotal = period.overhead + gaAmount;
						return (
							<Collapsible
								key={periodKey}
								open={expandedPeriods.has(periodKey)}
								onOpenChange={() => togglePeriod(periodKey)}
								asChild
							>
								<>
									<TableRow className="cursor-pointer hover:bg-muted/50">
										<TableCell>
											<CollapsibleTrigger asChild>
												<div className="flex items-center gap-2">
													{expandedPeriods.has(periodKey) ? (
														<ChevronDown className="h-4 w-4" />
													) : (
														<ChevronRight className="h-4 w-4" />
													)}
													<span className="font-medium">{periodName}</span>
													<Badge variant="secondary" className="text-xs">
														{period.periodType === "base" ? "Base" : "Option"}
													</Badge>
												</div>
											</CollapsibleTrigger>
										</TableCell>
										<TableCell className="text-right">
											{formatCurrency(period.laborCost)}
										</TableCell>
										<TableCell className="text-right">
											{formatCurrency(period.odcCost)}
										</TableCell>
										<TableCell className="text-right">
											{formatCurrency(period.travelCost)}
										</TableCell>
										<TableCell className="text-right">
											{formatCurrency(period.subcontractCost + period.materialCost)}
										</TableCell>
										<TableCell className="text-right">
											{formatCurrency(indirectTotal)}
										</TableCell>
										<TableCell className="text-right">
											{formatCurrency(feeAmount)}
										</TableCell>
										<TableCell className="text-right font-semibold">
											{formatCurrency(period.totalPrice)}
										</TableCell>
									</TableRow>
									<CollapsibleContent asChild>
										<TableRow className="bg-muted/30">
											<TableCell colSpan={8} className="p-4">
												<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
													<div>
														<div className="text-muted-foreground">Overhead</div>
														<div className="font-medium">
															{formatCurrency(period.overhead)}
														</div>
													</div>
													<div>
														<div className="text-muted-foreground">G&A ({(period.gaRate * 100).toFixed(1)}%)</div>
														<div className="font-medium">
															{formatCurrency(gaAmount)}
														</div>
													</div>
													<div>
														<div className="text-muted-foreground">Fee ({(period.feeRate * 100).toFixed(1)}%)</div>
														<div className="font-medium">
															{formatCurrency(feeAmount)}
														</div>
													</div>
													<div>
														<div className="text-muted-foreground">Subcontract</div>
														<div className="font-medium">
															{formatCurrency(period.subcontractCost)}
														</div>
													</div>
													<div>
														<div className="text-muted-foreground">Material</div>
														<div className="font-medium">
															{formatCurrency(period.materialCost)}
														</div>
													</div>
													<div>
														<div className="text-muted-foreground">Direct Cost</div>
														<div className="font-medium">
															{formatCurrency(period.totalDirectCost)}
														</div>
													</div>
												</div>
											</TableCell>
										</TableRow>
									</CollapsibleContent>
								</>
							</Collapsible>
						);
					})}
				</TableBody>
				<TableFooter>
					<TableRow className="font-semibold bg-muted/50">
						<TableCell>Grand Total</TableCell>
						<TableCell className="text-right">
							{formatCurrency(grandTotal.laborCost)}
						</TableCell>
						<TableCell className="text-right">
							{formatCurrency(grandTotal.odcCost)}
						</TableCell>
						<TableCell className="text-right">
							{formatCurrency(grandTotal.travelCost)}
						</TableCell>
						<TableCell className="text-right">
							{formatCurrency(
								grandTotal.subcontractCost + grandTotal.materialCost + grandTotal.otherCost
							)}
						</TableCell>
						<TableCell className="text-right">
							{formatCurrency(grandTotal.indirectCost)}
						</TableCell>
						<TableCell className="text-right">{formatCurrency(grandTotal.fee)}</TableCell>
						<TableCell className="text-right">
							{formatCurrency(grandTotal.totalCost)}
						</TableCell>
					</TableRow>
				</TableFooter>
			</Table>
		</div>
	);
}

// =============================================================================
// Labor Mix Chart (Simple Bar)
// =============================================================================

interface LaborMixChartProps {
	laborMix: PricingSummaryUIData["laborMix"];
}

function LaborMixChart({ laborMix }: LaborMixChartProps) {
	if (laborMix.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				No labor data available
			</div>
		);
	}

	const sortedMix = [...laborMix].sort((a, b) => b.percentage - a.percentage);

	return (
		<div className="space-y-3">
			{sortedMix.map((item, index) => (
				<div key={`labor-mix-${index}`} className="space-y-1">
					<div className="flex items-center justify-between text-sm">
						<div className="flex items-center gap-2">
							<span className="font-medium">{item.category}</span>
						</div>
						<div className="flex items-center gap-4">
							<span className="text-muted-foreground">
								{formatNumber(item.hours)} hrs
							</span>
							<span className="text-muted-foreground w-12 text-right">
								{item.percentage.toFixed(1)}%
							</span>
						</div>
					</div>
					<Progress
						value={item.percentage}
						className="h-2"
					/>
				</div>
			))}
		</div>
	);
}

// =============================================================================
// Cost Type Breakdown Chart
// =============================================================================

interface CostTypeChartProps {
	breakdown: PricingSummaryUIData["costTypeBreakdown"];
}

function CostTypeChart({ breakdown }: CostTypeChartProps) {
	if (breakdown.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				No cost data available
			</div>
		);
	}

	const sortedBreakdown = [...breakdown].sort((a, b) => b.percentage - a.percentage);
	const total = sortedBreakdown.reduce((sum, item) => sum + item.amount, 0);

	// Pre-compute pie segments with cumulative percentages
	const COLOR_MAP: Record<string, string> = {
		"bg-blue-500": "#3b82f6",
		"bg-purple-500": "#a855f7",
		"bg-green-500": "#22c55e",
		"bg-amber-500": "#f59e0b",
		"bg-cyan-500": "#06b6d4",
		"bg-indigo-500": "#6366f1",
		"bg-gray-500": "#6b7280",
	};

	let cumulativePercent = 0;
	const segments = sortedBreakdown.map((item) => {
		const startPercent = cumulativePercent;
		const endPercent = startPercent + item.percentage;
		cumulativePercent = endPercent;

		const startAngle = (startPercent / 100) * 360;
		const endAngle = (endPercent / 100) * 360;
		const largeArcFlag = item.percentage > 50 ? 1 : 0;
		const startX = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
		const startY = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
		const endX = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
		const endY = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);

		const colorClass = COST_TYPE_COLORS[item.type] || COST_TYPE_COLORS.other;
		const fillColor = COLOR_MAP[colorClass] || "#6b7280";

		return {
			...item,
			startPercent,
			startAngle,
			endAngle,
			largeArcFlag,
			startX,
			startY,
			endX,
			endY,
			fillColor,
		};
	});

	return (
		<div className="space-y-4">
			{/* Simple donut representation */}
			<div className="flex items-center justify-center">
				<div className="relative w-48 h-48">
					{/* Outer ring segments */}
					<svg viewBox="0 0 100 100" className="transform -rotate-90">
						{segments.map((seg, index) => {
							// First segment uses a circle stroke, others use pie paths
							if (seg.startPercent === 0 && seg.percentage > 0) {
								return (
									<circle
										key={seg.type}
										cx="50"
										cy="50"
										r="40"
										fill="none"
										stroke={seg.fillColor}
										strokeWidth="15"
										strokeDasharray={`${(seg.percentage * 251.3) / 100} 251.3`}
									/>
								);
							}
							return (
								<path
									key={seg.type}
									d={`M 50 50 L ${seg.startX} ${seg.startY} A 40 40 0 ${seg.largeArcFlag} 1 ${seg.endX} ${seg.endY} Z`}
									fill={seg.fillColor}
									stroke="white"
									strokeWidth="1"
								/>
							);
						})}
					</svg>
					{/* Center text */}
					<div className="absolute inset-0 flex items-center justify-center">
						<div className="text-center">
							<div className="text-2xl font-bold">{formatCurrency(total)}</div>
							<div className="text-xs text-muted-foreground">Total</div>
						</div>
					</div>
				</div>
			</div>

			{/* Legend */}
			<div className="grid grid-cols-2 gap-2">
				{sortedBreakdown.map((item) => (
					<div key={item.type} className="flex items-center gap-2">
						<div
							className={cn(
								"w-3 h-3 rounded-sm",
								COST_TYPE_COLORS[item.type] || COST_TYPE_COLORS.other
							)}
						/>
						<span className="text-sm capitalize">{item.type.replace(/_/g, " ")}</span>
						<span className="text-sm text-muted-foreground ml-auto">
							{item.percentage.toFixed(1)}%
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

// =============================================================================
// Indirect Rates Display
// =============================================================================

interface IndirectRatesDisplayProps {
	rates: PricingSummaryUIData["indirectRates"];
}

function IndirectRatesDisplay({ rates }: IndirectRatesDisplayProps) {
	if (rates.length === 0) {
		return (
			<div className="text-center py-4 text-muted-foreground">
				No indirect rates configured
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{rates.map((rate) => (
				<div
					key={rate.rateType}
					className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
				>
					<div>
						<div className="font-medium">{rate.name}</div>
						<div className="text-sm text-muted-foreground capitalize">
							{rate.rateType.replace(/_/g, " ")}
						</div>
					</div>
					<div className="text-right">
						<div className="flex items-center gap-1 font-mono">
							<Percent className="h-3 w-3" />
							{(rate.rate * 100).toFixed(2)}%
						</div>
						<div className="text-sm text-muted-foreground">
							Applied: {formatCurrency(rate.appliedAmount)}
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function PricingSummary({
	opportunityId,
	showCharts = true,
	className,
}: PricingSummaryProps) {
	// State
	const [summary, setSummary] = useState<PricingSummaryUIData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isRecalculating, setIsRecalculating] = useState(false);
	const [activeTab, setActiveTab] = useState("periods");

	// Load summary
	useEffect(() => {
		async function loadSummary() {
			setIsLoading(true);
			setError(null);

			const result = await getPricingSummary(opportunityId);
			if (result.success && result.data) {
				setSummary(result.data);
			} else if (!result.success) {
				setError("error" in result ? (result as { error: string }).error : "Failed to load pricing summary");
			}
			setIsLoading(false);
		}
		loadSummary();
	}, [opportunityId]);

	// Handle recalculate
	const handleRecalculate = useCallback(async () => {
		setIsRecalculating(true);
		const result = await recalculatePricing(opportunityId);
		if (result.success) {
			// Reload summary
			const summaryResult = await getPricingSummary(opportunityId);
			if (summaryResult.success && summaryResult.data) {
				setSummary(summaryResult.data);
			}
		}
		setIsRecalculating(false);
	}, [opportunityId]);

	// Loading state
	if (isLoading) {
		return <PricingSummarySkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<TrendingUp className="h-5 w-5" />
						Pricing Summary
					</CardTitle>

					<div className="flex items-center gap-2">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="outline"
										size="icon"
										onClick={handleRecalculate}
										disabled={isRecalculating}
									>
										{isRecalculating ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<RefreshCw className="h-4 w-4" />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>Recalculate all costs</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						<Button variant="outline">
							<Download className="h-4 w-4 mr-2" />
							Export
						</Button>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* No Data State */}
				{!summary && !error && (
					<div className="text-center py-12">
						<DollarSign className="h-12 w-12 mx-auto text-muted-foreground/50" />
						<h3 className="mt-4 font-medium">No pricing data</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Add cost elements to generate pricing summary
						</p>
					</div>
				)}

				{/* Summary Content */}
				{summary && (
					<>
						{/* Grand Total */}
						<GrandTotalCard summary={summary} />

						{/* Tabs for different views */}
						<Tabs value={activeTab} onValueChange={setActiveTab}>
							<TabsList>
								<TabsTrigger value="periods">Period Breakdown</TabsTrigger>
								{showCharts && (
									<>
										<TabsTrigger value="labor">
											<PieChart className="h-4 w-4 mr-1" />
											Labor Mix
										</TabsTrigger>
										<TabsTrigger value="costs">
											<BarChart3 className="h-4 w-4 mr-1" />
											Cost Types
										</TabsTrigger>
									</>
								)}
								<TabsTrigger value="rates">Indirect Rates</TabsTrigger>
							</TabsList>

							<TabsContent value="periods" className="mt-4">
								<PeriodSummaryTable
									periods={summary.periodSummaries}
									grandTotal={summary.grandTotal}
								/>
							</TabsContent>

							{showCharts && (
								<>
									<TabsContent value="labor" className="mt-4">
										<LaborMixChart laborMix={summary.laborMix} />
									</TabsContent>

									<TabsContent value="costs" className="mt-4">
										<CostTypeChart breakdown={summary.costTypeBreakdown} />
									</TabsContent>
								</>
							)}

							<TabsContent value="rates" className="mt-4">
								<IndirectRatesDisplay rates={summary.indirectRates} />
							</TabsContent>
						</Tabs>

						{/* Generated timestamp */}
						<div className="text-xs text-muted-foreground text-right">
							Generated: {new Date(summary.generatedAt).toLocaleString()}
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}

export default PricingSummary;
