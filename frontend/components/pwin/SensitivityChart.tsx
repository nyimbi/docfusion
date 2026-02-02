"use client";

/**
 * Sensitivity Chart Component
 *
 * Visual representation of PWin sensitivity analysis showing the
 * potential impact of improving each factor. Helps identify which
 * factors to focus on for maximum PWin improvement.
 *
 * Features:
 * - Horizontal bar chart showing impact potential per factor
 * - Color-coded priority indicators
 * - Current score vs. max score visualization
 * - Impact per point calculations
 * - Sortable by different metrics
 *
 * @example
 * ```tsx
 * <SensitivityChart
 *   opportunityId="opp-123"
 *   onFactorSelect={(factorId) => scrollToFactor(factorId)}
 * />
 * ```
 */

import { useState, useEffect, useCallback } from "react";
import {
	TrendingUp,
	Target,
	Zap,
	Loader2,
	AlertCircle,
	RefreshCw,
	ArrowUpRight,
	Info,
	ChevronDown,
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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { runSensitivityAnalysis } from "@/lib/actions/pwin";
import type { SensitivityResult, Priority } from "@/lib/types/pwin";

// ============================================================================
// Types
// ============================================================================

interface SensitivityChartProps {
	opportunityId: string;
	initialData?: SensitivityResult[];
	onFactorSelect?: (factorId: string) => void;
	className?: string;
}

type SortOption = "impact" | "potential" | "weight" | "score";

// ============================================================================
// Constants
// ============================================================================

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bgColor: string }> = {
	high: {
		label: "High Priority",
		color: "text-red-600 dark:text-red-400",
		bgColor: "bg-red-500",
	},
	medium: {
		label: "Medium Priority",
		color: "text-amber-600 dark:text-amber-400",
		bgColor: "bg-amber-500",
	},
	low: {
		label: "Low Priority",
		color: "text-blue-600 dark:text-blue-400",
		bgColor: "bg-blue-500",
	},
};

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
	{ value: "impact", label: "Impact if Maximized" },
	{ value: "potential", label: "Improvement Potential" },
	{ value: "weight", label: "Factor Weight" },
	{ value: "score", label: "Current Score (Low to High)" },
];

// ============================================================================
// Helper Functions
// ============================================================================

function sortSensitivityResults(
	results: SensitivityResult[],
	sortBy: SortOption
): SensitivityResult[] {
	return [...results].sort((a, b) => {
		switch (sortBy) {
			case "impact":
				return b.impactIfMaximized - a.impactIfMaximized;
			case "potential":
				return b.improvementPotential - a.improvementPotential;
			case "weight":
				return b.weight - a.weight;
			case "score":
				return a.currentScore - b.currentScore;
			default:
				return 0;
		}
	});
}

function getBarWidth(value: number, max: number): number {
	return Math.min(100, (value / max) * 100);
}

// ============================================================================
// Component
// ============================================================================

export function SensitivityChart({
	opportunityId,
	initialData,
	onFactorSelect,
	className,
}: SensitivityChartProps) {
	// State
	const [results, setResults] = useState<SensitivityResult[]>(initialData ?? []);
	const [sortBy, setSortBy] = useState<SortOption>("impact");
	const [isLoading, setIsLoading] = useState(!initialData);
	const [error, setError] = useState<string | null>(null);

	// Load sensitivity data
	const loadSensitivityData = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		const result = await runSensitivityAnalysis(opportunityId);

		if (result.success) {
			setResults(result.data);
		} else {
			setError(result.error);
		}

		setIsLoading(false);
	}, [opportunityId]);

	// Load on mount if no initial data
	useEffect(() => {
		if (!initialData) {
			loadSensitivityData();
		}
	}, [initialData, loadSensitivityData]);

	// Sorted results
	const sortedResults = sortSensitivityResults(results, sortBy);

	// Find max values for scaling
	const maxImpact = Math.max(...results.map((r) => r.impactIfMaximized), 1);
	const maxPotential = Math.max(...results.map((r) => r.improvementPotential), 1);

	// Loading state
	if (isLoading) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<TrendingUp className="h-5 w-5 text-primary" />
						Sensitivity Analysis
					</CardTitle>
				</CardHeader>
				<CardContent className="flex items-center justify-center py-12">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</CardContent>
			</Card>
		);
	}

	// Error state
	if (error) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<TrendingUp className="h-5 w-5 text-primary" />
						Sensitivity Analysis
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<AlertCircle className="h-10 w-10 text-destructive mb-3" />
					<p className="text-muted-foreground mb-4">{error}</p>
					<Button variant="outline" size="sm" onClick={loadSensitivityData}>
						<RefreshCw className="h-4 w-4 mr-2" />
						Retry
					</Button>
				</CardContent>
			</Card>
		);
	}

	// Empty state
	if (results.length === 0) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<TrendingUp className="h-5 w-5 text-primary" />
						Sensitivity Analysis
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<Target className="h-10 w-10 text-muted-foreground mb-3" />
					<p className="text-muted-foreground">
						No sensitivity data available. Complete a PWin assessment first.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<TooltipProvider>
			<Card className={className}>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<TrendingUp className="h-5 w-5 text-primary" />
								Sensitivity Analysis
							</CardTitle>
							<CardDescription className="mt-1">
								Impact of improving each factor to maximum score
							</CardDescription>
						</div>

						<div className="flex items-center gap-2">
							<Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
								<SelectTrigger className="w-48">
									<SelectValue placeholder="Sort by..." />
								</SelectTrigger>
								<SelectContent>
									{SORT_OPTIONS.map((opt) => (
										<SelectItem key={opt.value} value={opt.value}>
											{opt.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Button variant="outline" size="icon" onClick={loadSensitivityData}>
								<RefreshCw className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</CardHeader>

				<CardContent className="space-y-4">
					{/* Summary Cards */}
					<div className="grid grid-cols-3 gap-4 pb-4 border-b">
						<div className="text-center">
							<div className="text-2xl font-bold text-primary">
								{results.filter((r) => r.priority === "high").length}
							</div>
							<div className="text-xs text-muted-foreground">High Priority</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-amber-600">
								{results.filter((r) => r.priority === "medium").length}
							</div>
							<div className="text-xs text-muted-foreground">Medium Priority</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-blue-600">
								{results.filter((r) => r.priority === "low").length}
							</div>
							<div className="text-xs text-muted-foreground">Low Priority</div>
						</div>
					</div>

					{/* Factor Bars */}
					<div className="space-y-4">
						{sortedResults.map((result) => (
							<SensitivityBar
								key={result.factorId}
								result={result}
								maxImpact={maxImpact}
								maxPotential={maxPotential}
								onClick={() => onFactorSelect?.(result.factorId)}
								sortBy={sortBy}
							/>
						))}
					</div>

					{/* Legend */}
					<div className="flex items-center justify-center gap-6 pt-4 border-t text-xs">
						<div className="flex items-center gap-1">
							<div className="w-3 h-3 rounded bg-primary/20 border border-primary" />
							<span className="text-muted-foreground">Current Score</span>
						</div>
						<div className="flex items-center gap-1">
							<div className="w-3 h-3 rounded bg-primary" />
							<span className="text-muted-foreground">Potential Gain</span>
						</div>
					</div>
				</CardContent>
			</Card>
		</TooltipProvider>
	);
}

// ============================================================================
// Sensitivity Bar Sub-Component
// ============================================================================

interface SensitivityBarProps {
	result: SensitivityResult;
	maxImpact: number;
	maxPotential: number;
	sortBy: SortOption;
	onClick?: () => void;
}

function SensitivityBar({
	result,
	maxImpact,
	maxPotential,
	sortBy,
	onClick,
}: SensitivityBarProps) {
	const priorityConfig = PRIORITY_CONFIG[result.priority];
	const currentPercentage = (result.currentScore / result.maxScore) * 100;
	const gainPercentage = ((result.maxScore - result.currentScore) / result.maxScore) * 100;

	return (
		<div
			className={cn(
				"p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors",
				onClick && "cursor-pointer"
			)}
			onClick={onClick}
		>
			{/* Header Row */}
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-2">
					<span className="font-medium">{result.factorName}</span>
					<Badge
						variant="outline"
						className={cn("text-xs", priorityConfig.color)}
					>
						{priorityConfig.label}
					</Badge>
				</div>

				<div className="flex items-center gap-3 text-sm">
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="flex items-center gap-1">
								<Zap className="h-3.5 w-3.5 text-amber-500" />
								<span className="font-medium">+{result.impactIfMaximized}%</span>
							</div>
						</TooltipTrigger>
						<TooltipContent>
							PWin increase if this factor is maximized
						</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<div className="flex items-center gap-1 text-muted-foreground">
								<ArrowUpRight className="h-3.5 w-3.5" />
								<span>{result.impactPerPoint.toFixed(1)}%/pt</span>
							</div>
						</TooltipTrigger>
						<TooltipContent>
							PWin increase per point improvement
						</TooltipContent>
					</Tooltip>
				</div>
			</div>

			{/* Score Bar */}
			<div className="space-y-1">
				<div className="flex justify-between text-xs text-muted-foreground">
					<span>Score: {result.currentScore}/{result.maxScore}</span>
					<span>Weight: {result.weight}</span>
				</div>

				<div className="h-4 bg-muted rounded-full overflow-hidden flex">
					{/* Current score portion */}
					<div
						className="h-full bg-primary/30 transition-all"
						style={{ width: `${currentPercentage}%` }}
					/>
					{/* Potential gain portion */}
					<div
						className={cn("h-full transition-all", priorityConfig.bgColor)}
						style={{ width: `${gainPercentage}%` }}
					/>
				</div>

				{/* Metrics Row */}
				<div className="flex justify-between text-xs">
					<span className="text-muted-foreground">
						{result.improvementPotential}% improvement potential
					</span>
					<span className="text-muted-foreground">
						{result.maxScore - result.currentScore} points to max
					</span>
				</div>
			</div>
		</div>
	);
}

export default SensitivityChart;
