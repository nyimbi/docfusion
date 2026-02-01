/**
 * ThemeSummaryCard - Quick Stats Widget
 *
 * Displays quick statistics about win themes including total count,
 * coverage percentage, strongest/weakest themes, and critical gaps.
 */

"use client";

import { useState, useEffect } from "react";
import {
	Target,
	TrendingUp,
	TrendingDown,
	AlertTriangle,
	CheckCircle2,
	Loader2,
	Grid3X3,
	BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { ThemeSummary, WinThemeType } from "@/lib/types/win-themes";
import { getThemeSummary } from "@/lib/actions/win-themes";

// =============================================================================
// Types
// =============================================================================

export interface ThemeSummaryCardProps {
	/** Opportunity ID */
	opportunityId: string;
	/** Compact mode for dashboard widgets */
	compact?: boolean;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const TYPE_LABELS: Record<WinThemeType, string> = {
	value_prop: "Value Prop",
	differentiator: "Differentiator",
	proof_point: "Proof Point",
	risk_mitigation: "Risk Mitigation",
};

const TYPE_COLORS: Record<WinThemeType, string> = {
	value_prop: "bg-blue-500",
	differentiator: "bg-purple-500",
	proof_point: "bg-green-500",
	risk_mitigation: "bg-amber-500",
};

// =============================================================================
// Loading Skeleton
// =============================================================================

function SummaryCardSkeleton({ compact }: { compact?: boolean }) {
	if (compact) {
		return (
			<Card>
				<CardContent className="p-4">
					<div className="flex items-center justify-between">
						<div>
							<Skeleton className="h-8 w-12" />
							<Skeleton className="h-4 w-24 mt-1" />
						</div>
						<Skeleton className="h-8 w-8 rounded" />
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<Skeleton className="h-5 w-32" />
					<Skeleton className="h-5 w-16" />
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-3 gap-4">
					<Skeleton className="h-16" />
					<Skeleton className="h-16" />
					<Skeleton className="h-16" />
				</div>
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-8 w-full" />
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Mini Heat Map Preview
// =============================================================================

interface MiniHeatMapProps {
	byType: Record<WinThemeType, number>;
	coveragePercentage: number;
}

function MiniHeatMap({ byType, coveragePercentage }: MiniHeatMapProps) {
	const total = Object.values(byType).reduce((sum, count) => sum + count, 0);
	if (total === 0) return null;

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div className="flex gap-0.5 h-6">
						{(Object.entries(byType) as [WinThemeType, number][])
							.filter(([_, count]) => count > 0)
							.map(([type, count]) => (
								<div
									key={type}
									className={cn(
										"rounded",
										TYPE_COLORS[type],
										coveragePercentage >= 70 ? "opacity-100" :
										coveragePercentage >= 40 ? "opacity-70" : "opacity-40"
									)}
									style={{ width: `${(count / total) * 100}%`, minWidth: 4 }}
								/>
							))}
					</div>
				</TooltipTrigger>
				<TooltipContent>
					<div className="space-y-1">
						{(Object.entries(byType) as [WinThemeType, number][])
							.filter(([_, count]) => count > 0)
							.map(([type, count]) => (
								<div key={type} className="flex items-center gap-2 text-xs">
									<div className={cn("w-2 h-2 rounded", TYPE_COLORS[type])} />
									<span>{TYPE_LABELS[type]}: {count}</span>
								</div>
							))}
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// =============================================================================
// Compact View
// =============================================================================

interface CompactViewProps {
	summary: ThemeSummary;
}

function CompactView({ summary }: CompactViewProps) {
	const getCoverageColor = (coverage: number) => {
		if (coverage >= 70) return "text-green-600";
		if (coverage >= 40) return "text-amber-600";
		return "text-red-600";
	};

	return (
		<Card>
			<CardContent className="p-4">
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-2">
						<Target className="h-5 w-5 text-primary" />
						<span className="font-medium">Win Themes</span>
					</div>
					<Badge variant="secondary">{summary.activeThemes}</Badge>
				</div>

				{/* Coverage Bar */}
				<div className="space-y-1">
					<div className="flex justify-between text-xs">
						<span className="text-muted-foreground">Coverage</span>
						<span className={cn("font-medium", getCoverageColor(summary.coveragePercentage))}>
							{summary.coveragePercentage}%
						</span>
					</div>
					<Progress value={summary.coveragePercentage} className="h-2" />
				</div>

				{/* Mini Stats */}
				<div className="flex items-center justify-between mt-3">
					{summary.criticalGaps > 0 ? (
						<div className="flex items-center gap-1 text-xs text-red-600">
							<AlertTriangle className="h-3 w-3" />
							{summary.criticalGaps} gaps
						</div>
					) : (
						<div className="flex items-center gap-1 text-xs text-green-600">
							<CheckCircle2 className="h-3 w-3" />
							No gaps
						</div>
					)}
					<MiniHeatMap
						byType={summary.byType}
						coveragePercentage={summary.coveragePercentage}
					/>
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Full View
// =============================================================================

interface FullViewProps {
	summary: ThemeSummary;
}

function FullView({ summary }: FullViewProps) {
	const getCoverageColor = (coverage: number) => {
		if (coverage >= 70) return "text-green-600";
		if (coverage >= 40) return "text-amber-600";
		return "text-red-600";
	};

	const getCoverageBgColor = (coverage: number) => {
		if (coverage >= 70) return "bg-green-100 dark:bg-green-900/30";
		if (coverage >= 40) return "bg-amber-100 dark:bg-amber-900/30";
		return "bg-red-100 dark:bg-red-900/30";
	};

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-base">
						<Target className="h-5 w-5" />
						Theme Summary
					</CardTitle>
					{summary.lastAnalyzedAt && (
						<span className="text-xs text-muted-foreground">
							Updated {new Date(summary.lastAnalyzedAt).toLocaleDateString()}
						</span>
					)}
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Stats Grid */}
				<div className="grid grid-cols-3 gap-3">
					<div className="text-center p-3 bg-muted/50 rounded-lg">
						<div className="text-2xl font-bold">{summary.totalThemes}</div>
						<div className="text-xs text-muted-foreground">Total</div>
					</div>
					<div className="text-center p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
						<div className="text-2xl font-bold text-blue-600">
							{summary.activeThemes}
						</div>
						<div className="text-xs text-muted-foreground">Active</div>
					</div>
					<div className={cn("text-center p-3 rounded-lg", getCoverageBgColor(summary.coveragePercentage))}>
						<div className={cn("text-2xl font-bold", getCoverageColor(summary.coveragePercentage))}>
							{summary.coveragePercentage}%
						</div>
						<div className="text-xs text-muted-foreground">Coverage</div>
					</div>
				</div>

				{/* Theme Types Breakdown */}
				<div className="space-y-2">
					<label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
						<BarChart3 className="h-3 w-3" />
						By Type
					</label>
					<div className="flex gap-2">
						{(Object.entries(summary.byType) as [WinThemeType, number][]).map(
							([type, count]) => (
								<TooltipProvider key={type}>
									<Tooltip>
										<TooltipTrigger asChild>
											<div
												className={cn(
													"flex-1 text-center p-2 rounded",
													TYPE_COLORS[type],
													count === 0 && "opacity-30"
												)}
											>
												<div className="text-sm font-bold text-white">{count}</div>
											</div>
										</TooltipTrigger>
										<TooltipContent>
											<span>{TYPE_LABELS[type]}</span>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)
						)}
					</div>
				</div>

				{/* Strongest/Weakest */}
				<div className="grid grid-cols-2 gap-3">
					{summary.strongestTheme && (
						<div className="p-2 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800">
							<div className="flex items-center gap-1 text-xs font-medium text-green-600">
								<TrendingUp className="h-3 w-3" />
								Strongest
							</div>
							<p className="text-sm truncate mt-1" title={summary.strongestTheme.name}>
								{summary.strongestTheme.name}
							</p>
							<p className="text-xs text-muted-foreground">
								{summary.strongestTheme.coverage}% coverage
							</p>
						</div>
					)}

					{summary.weakestTheme && (
						<div className="p-2 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800">
							<div className="flex items-center gap-1 text-xs font-medium text-red-600">
								<TrendingDown className="h-3 w-3" />
								Weakest
							</div>
							<p className="text-sm truncate mt-1" title={summary.weakestTheme.name}>
								{summary.weakestTheme.name}
							</p>
							<p className="text-xs text-muted-foreground">
								{summary.weakestTheme.coverage}% coverage
							</p>
						</div>
					)}
				</div>

				{/* Critical Gaps Alert */}
				{summary.criticalGaps > 0 && (
					<div className="flex items-center gap-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-red-700 dark:text-red-400">
						<AlertTriangle className="h-4 w-4 shrink-0" />
						<span className="text-sm">
							{summary.criticalGaps} critical gap{summary.criticalGaps !== 1 && "s"} need attention
						</span>
					</div>
				)}

				{/* Mini Heat Map */}
				<div className="space-y-1">
					<label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
						<Grid3X3 className="h-3 w-3" />
						Coverage Preview
					</label>
					<MiniHeatMap
						byType={summary.byType}
						coveragePercentage={summary.coveragePercentage}
					/>
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function ThemeSummaryCard({
	opportunityId,
	compact = false,
	className,
}: ThemeSummaryCardProps) {
	const [summary, setSummary] = useState<ThemeSummary | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function loadSummary() {
			setIsLoading(true);
			setError(null);
			const result = await getThemeSummary(opportunityId);
			if (result.success && result.data) {
				setSummary(result.data);
			} else {
				setError(result.error || "Failed to load summary");
			}
			setIsLoading(false);
		}
		loadSummary();
	}, [opportunityId]);

	if (isLoading) {
		return (
			<div className={className}>
				<SummaryCardSkeleton compact={compact} />
			</div>
		);
	}

	if (error || !summary) {
		return (
			<Card className={className}>
				<CardContent className="p-4">
					<div className="flex items-center gap-2 text-muted-foreground">
						<AlertTriangle className="h-4 w-4" />
						<span className="text-sm">{error || "No data"}</span>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className={className}>
			{compact ? <CompactView summary={summary} /> : <FullView summary={summary} />}
		</div>
	);
}

export default ThemeSummaryCard;
