/**
 * LaborMixChart - Labor Category Distribution Chart
 *
 * Displays labor mix as a donut/pie chart with hours and cost percentages,
 * interactive filtering, and category legend.
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
	PieChart,
	Users,
	Clock,
	DollarSign,
	AlertCircle,
	Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// LaborMixEntry from schema doesn't have level field
import { getPricingSummary, type PricingSummaryUIData } from "@/lib/actions/pricing";

// =============================================================================
// Types
// =============================================================================

export interface LaborMixChartProps {
	/** Opportunity ID to display chart for */
	opportunityId: string;
	/** Whether to enable interactive filtering */
	interactive?: boolean;
	/** Additional CSS classes */
	className?: string;
}

type ViewMode = "hours" | "cost";

// =============================================================================
// Constants
// =============================================================================

const LEVEL_COLORS: Record<string, string> = {
	junior: "#22c55e",
	mid: "#3b82f6",
	senior: "#a855f7",
	principal: "#f59e0b",
	executive: "#ef4444",
	default: "#6b7280",
};

const LEVEL_BG_COLORS: Record<string, string> = {
	junior: "bg-green-500",
	mid: "bg-blue-500",
	senior: "bg-purple-500",
	principal: "bg-amber-500",
	executive: "bg-red-500",
	default: "bg-gray-500",
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

// =============================================================================
// Loading Skeleton
// =============================================================================

function LaborMixChartSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-6 w-40" />
			</CardHeader>
			<CardContent className="flex flex-col items-center">
				<Skeleton className="h-48 w-48 rounded-full" />
				<div className="mt-4 space-y-2 w-full">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-8 w-full" />
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Donut Chart Component
// =============================================================================

interface DonutChartProps {
	data: {
		categoryId: string;
		categoryName: string;
		value: number;
		percentage: number;
	}[];
	centerLabel: string;
	centerValue: string;
	selectedCategory: string | null;
	onCategoryClick?: (categoryId: string | null) => void;
}

function DonutChart({
	data,
	centerLabel,
	centerValue,
	selectedCategory,
	onCategoryClick,
}: DonutChartProps) {
	const total = data.reduce((sum, item) => sum + item.value, 0);
	let cumulativePercent = 0;

	const segments = data.map((item) => {
		const startPercent = cumulativePercent;
		cumulativePercent += item.percentage;
		const endPercent = cumulativePercent;

		const startAngle = (startPercent / 100) * 360;
		const endAngle = (endPercent / 100) * 360;
		const largeArcFlag = item.percentage > 50 ? 1 : 0;

		// Calculate path coordinates
		const startX = 50 + 40 * Math.cos(((startAngle - 90) * Math.PI) / 180);
		const startY = 50 + 40 * Math.sin(((startAngle - 90) * Math.PI) / 180);
		const endX = 50 + 40 * Math.cos(((endAngle - 90) * Math.PI) / 180);
		const endY = 50 + 40 * Math.sin(((endAngle - 90) * Math.PI) / 180);

		// Use default color since LaborMixEntry doesn't have level info
		const color = LEVEL_COLORS.default;
		const isSelected = selectedCategory === item.categoryId;
		const isFiltered = selectedCategory !== null && !isSelected;

		return {
			...item,
			startX,
			startY,
			endX,
			endY,
			largeArcFlag,
			color,
			isSelected,
			isFiltered,
		};
	});

	return (
		<div className="relative w-48 h-48">
			<svg viewBox="0 0 100 100" className="w-full h-full">
				{segments.map((segment, index) => (
					<path
						key={segment.categoryId}
						d={`M 50 50 L ${segment.startX} ${segment.startY} A 40 40 0 ${segment.largeArcFlag} 1 ${segment.endX} ${segment.endY} Z`}
						fill={segment.color}
						stroke="white"
						strokeWidth="1"
						opacity={segment.isFiltered ? 0.3 : 1}
						className={cn(
							"transition-all duration-200",
							onCategoryClick && "cursor-pointer hover:opacity-80"
						)}
						onClick={() => onCategoryClick?.(
							segment.isSelected ? null : segment.categoryId
						)}
					>
						<title>
							{segment.categoryName}: {segment.percentage.toFixed(1)}%
						</title>
					</path>
				))}
				{/* Center hole */}
				<circle cx="50" cy="50" r="25" fill="white" className="dark:fill-gray-900" />
			</svg>
			{/* Center text */}
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span className="text-2xl font-bold">{centerValue}</span>
				<span className="text-xs text-muted-foreground">{centerLabel}</span>
			</div>
		</div>
	);
}

// =============================================================================
// Legend Component
// =============================================================================

interface LegendProps {
	data: {
		categoryId: string;
		categoryName: string;
		hours: number;
		cost: number;
		percentage: number;
	}[];
	viewMode: ViewMode;
	selectedCategory: string | null;
	onCategoryClick?: (categoryId: string | null) => void;
}

function Legend({
	data,
	viewMode,
	selectedCategory,
	onCategoryClick,
}: LegendProps) {
	return (
		<div className="w-full space-y-2">
			{data.map((item) => {
				// Use default color since LaborMixEntry doesn't have level info
				const bgColor = LEVEL_BG_COLORS.default;
				const isSelected = selectedCategory === item.categoryId;
				const isFiltered = selectedCategory !== null && !isSelected;

				return (
					<button
						key={item.categoryId}
						onClick={() => onCategoryClick?.(isSelected ? null : item.categoryId)}
						className={cn(
							"w-full flex items-center gap-3 p-2 rounded-lg transition-all",
							onCategoryClick && "hover:bg-muted/50 cursor-pointer",
							isSelected && "bg-muted",
							isFiltered && "opacity-50"
						)}
					>
						<div className={cn("w-3 h-3 rounded-sm shrink-0", bgColor)} />
						<div className="flex-1 text-left min-w-0">
							<div className="font-medium truncate">{item.categoryName}</div>
						</div>
						<div className="text-right shrink-0">
							<div className="text-sm font-mono">
								{viewMode === "hours"
									? `${formatNumber(item.hours)} hrs`
									: formatCurrency(item.cost)}
							</div>
							<div className="text-xs text-muted-foreground">
								{item.percentage.toFixed(1)}%
							</div>
						</div>
					</button>
				);
			})}
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function LaborMixChart({
	opportunityId,
	interactive = true,
	className,
}: LaborMixChartProps) {
	// State
	const [summary, setSummary] = useState<PricingSummaryUIData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [viewMode, setViewMode] = useState<ViewMode>("hours");
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

	// Load summary
	useEffect(() => {
		async function loadSummary() {
			setIsLoading(true);
			setError(null);

			const result = await getPricingSummary(opportunityId);
			if (result.success && result.data) {
				setSummary(result.data);
			} else if (!result.success) {
				setError("error" in result ? (result as { error: string }).error : "Failed to load labor mix");
			}
			setIsLoading(false);
		}
		loadSummary();
	}, [opportunityId]);

	// Prepare chart data
	// Note: LaborMixEntry only has category, percentage, hours - no cost or level
	const chartData = useMemo(() => {
		if (!summary || summary.laborMix.length === 0) return [];

		// Calculate cost based on hours and average rate if available
		const avgRate = summary.grandTotal.laborHours > 0
			? summary.grandTotal.laborCost / summary.grandTotal.laborHours
			: 0;

		return summary.laborMix.map((item, index) => {
			const estimatedCost = item.hours * avgRate;
			return {
				categoryId: `cat-${index}`,
				categoryName: item.category,
				hours: item.hours,
				cost: estimatedCost,
				value: viewMode === "hours" ? item.hours : estimatedCost,
				percentage: item.percentage,
			};
		});
	}, [summary, viewMode]);

	// Calculate totals
	const totals = useMemo(() => {
		if (!summary) return { hours: 0, cost: 0 };
		return {
			hours: summary.grandTotal.laborHours,
			cost: summary.grandTotal.laborCost,
		};
	}, [summary]);

	// Filter data if category selected
	const filteredData = useMemo(() => {
		if (!selectedCategory) return chartData;
		return chartData.filter((item) => item.categoryId === selectedCategory);
	}, [chartData, selectedCategory]);

	// Handle category click
	const handleCategoryClick = useCallback(
		(categoryId: string | null) => {
			if (!interactive) return;
			setSelectedCategory(categoryId);
		},
		[interactive]
	);

	// Loading state
	if (isLoading) {
		return <LaborMixChartSkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<PieChart className="h-5 w-5" />
						Labor Mix
					</CardTitle>
					<Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
						<TabsList className="h-8">
							<TabsTrigger value="hours" className="text-xs gap-1 px-2">
								<Clock className="h-3 w-3" />
								Hours
							</TabsTrigger>
							<TabsTrigger value="cost" className="text-xs gap-1 px-2">
								<DollarSign className="h-3 w-3" />
								Cost
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
			</CardHeader>

			<CardContent>
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive" className="mb-4">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* No Data State */}
				{!summary || chartData.length === 0 ? (
					<div className="text-center py-12">
						<Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
						<h3 className="mt-4 font-medium">No labor data</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Add labor cost elements to see the mix
						</p>
					</div>
				) : (
					<div className="flex flex-col items-center gap-6">
						{/* Chart */}
						<DonutChart
							data={chartData}
							centerLabel={viewMode === "hours" ? "Total Hours" : "Total Cost"}
							centerValue={
								viewMode === "hours"
									? formatNumber(totals.hours)
									: formatCurrency(totals.cost)
							}
							selectedCategory={selectedCategory}
							onCategoryClick={interactive ? handleCategoryClick : undefined}
						/>

						{/* Summary Stats */}
						<div className="flex items-center gap-6 text-center">
							<div>
								<div className="text-2xl font-bold">{chartData.length}</div>
								<div className="text-xs text-muted-foreground">Categories</div>
							</div>
							<div>
								<div className="text-2xl font-bold">{formatNumber(totals.hours)}</div>
								<div className="text-xs text-muted-foreground">Total Hours</div>
							</div>
							<div>
								<div className="text-2xl font-bold">{formatCurrency(totals.cost)}</div>
								<div className="text-xs text-muted-foreground">Total Cost</div>
							</div>
						</div>

						{/* Legend */}
						<Legend
							data={chartData}
							viewMode={viewMode}
							selectedCategory={selectedCategory}
							onCategoryClick={interactive ? handleCategoryClick : undefined}
						/>

						{/* Filter indicator */}
						{selectedCategory && (
							<div className="text-sm text-muted-foreground">
								Click the same category to clear filter
							</div>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default LaborMixChart;
