"use client";

/**
 * Opportunity Comparison Component
 *
 * Side-by-side comparison of multiple opportunities showing PWin scores,
 * factor breakdowns, strengths, and weaknesses. Helps identify patterns
 * and make informed pursuit decisions.
 *
 * Features:
 * - Multi-opportunity side-by-side view
 * - Factor score comparison with visual bars
 * - Strengths and weaknesses analysis
 * - Delta indicators between opportunities
 * - Recommendations based on comparison
 *
 * @example
 * ```tsx
 * <OpportunityComparison
 *   opportunityIds={["opp-1", "opp-2", "opp-3"]}
 *   onOpportunityRemove={(id) => removeFromComparison(id)}
 * />
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
	Scale,
	TrendingUp,
	TrendingDown,
	Minus,
	Plus,
	X,
	Loader2,
	AlertCircle,
	RefreshCw,
	Target,
	DollarSign,
	CheckCircle2,
	XCircle,
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { compareOpportunities } from "@/lib/actions/pwin";
import type { FactorScore } from "@/lib/types/pwin";

// ============================================================================
// Types
// ============================================================================

interface OpportunityComparisonProps {
	opportunityIds: string[];
	onOpportunityRemove?: (opportunityId: string) => void;
	onOpportunitySelect?: (opportunityId: string) => void;
	className?: string;
}

/**
 * Individual opportunity comparison data.
 * Matches the return type from compareOpportunities action.
 */
interface ComparisonOpportunity {
	opportunityId: string;
	opportunityName: string;
	pwin: number;
	contractValue: number;
	expectedValue: number;
	factorBreakdown: FactorScore[];
	strengthsVsOthers: string[];
	weaknessesVsOthers: string[];
	rank: number;
}

/**
 * Full comparison result with recommendations.
 */
interface ComparisonResult {
	opportunities: ComparisonOpportunity[];
	recommendations: string[];
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

function getPwinColor(pwin: number): string {
	if (pwin >= 70) return "text-green-600 dark:text-green-400";
	if (pwin >= 50) return "text-amber-600 dark:text-amber-400";
	if (pwin >= 30) return "text-orange-600 dark:text-orange-400";
	return "text-red-600 dark:text-red-400";
}

function getPwinBgColor(pwin: number): string {
	if (pwin >= 70) return "bg-green-500";
	if (pwin >= 50) return "bg-amber-500";
	if (pwin >= 30) return "bg-orange-500";
	return "bg-red-500";
}

function getScoreColor(score: number, maxScore: number = 10): string {
	const percentage = (score / maxScore) * 100;
	if (percentage >= 70) return "bg-green-500";
	if (percentage >= 50) return "bg-amber-500";
	if (percentage >= 30) return "bg-orange-500";
	return "bg-red-500";
}

function getDeltaIndicator(value: number, avg: number): "above" | "below" | "equal" {
	const diff = value - avg;
	if (diff > 0.5) return "above";
	if (diff < -0.5) return "below";
	return "equal";
}

// ============================================================================
// Component
// ============================================================================

export function OpportunityComparison({
	opportunityIds,
	onOpportunityRemove,
	onOpportunitySelect,
	className,
}: OpportunityComparisonProps) {
	// State
	const [comparison, setComparison] = useState<ComparisonResult | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Load comparison data
	const loadComparison = useCallback(async () => {
		if (opportunityIds.length === 0) {
			setComparison(null);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		setError(null);

		const result = await compareOpportunities(opportunityIds);

		if (result.success) {
			// Transform the array result into our component's expected format
			setComparison({
				opportunities: result.data,
				recommendations: [],
			});
		} else {
			setError(result.error);
		}

		setIsLoading(false);
	}, [opportunityIds]);

	// Load on mount and when IDs change
	useEffect(() => {
		loadComparison();
	}, [loadComparison]);

	// Compute unified factor list for comparison
	const allFactors = useMemo(() => {
		if (!comparison?.opportunities) return [];

		const factorMap = new Map<string, { name: string; maxScore: number }>();

		for (const opp of comparison.opportunities) {
			for (const score of opp.factorBreakdown) {
				if (!factorMap.has(score.factorId)) {
					factorMap.set(score.factorId, {
						name: score.factorName,
						maxScore: 10,
					});
				}
			}
		}

		return Array.from(factorMap.entries()).map(([id, data]) => ({
			factorId: id,
			...data,
		}));
	}, [comparison]);

	// Compute average scores for delta indicators
	const averageScores = useMemo(() => {
		if (!comparison?.opportunities || comparison.opportunities.length === 0) {
			return { pwin: 0, value: 0, factorScores: new Map<string, number>() };
		}

		const opps = comparison.opportunities;
		const avgPwin = opps.reduce((sum, o) => sum + o.pwin, 0) / opps.length;
		const avgValue = opps.reduce((sum, o) => sum + o.contractValue, 0) / opps.length;

		const factorScoreMap = new Map<string, number>();
		for (const factor of allFactors) {
			let sum = 0;
			let count = 0;
			for (const opp of opps) {
				const score = opp.factorBreakdown.find(s => s.factorId === factor.factorId);
				if (score) {
					sum += score.score;
					count++;
				}
			}
			if (count > 0) {
				factorScoreMap.set(factor.factorId, sum / count);
			}
		}

		return { pwin: avgPwin, value: avgValue, factorScores: factorScoreMap };
	}, [comparison, allFactors]);

	// Loading state
	if (isLoading) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Scale className="h-5 w-5 text-primary" />
						Opportunity Comparison
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
						<Scale className="h-5 w-5 text-primary" />
						Opportunity Comparison
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<AlertCircle className="h-10 w-10 text-destructive mb-3" />
					<p className="text-muted-foreground mb-4">{error}</p>
					<Button variant="outline" size="sm" onClick={loadComparison}>
						<RefreshCw className="h-4 w-4 mr-2" />
						Retry
					</Button>
				</CardContent>
			</Card>
		);
	}

	// Empty state
	if (!comparison || comparison.opportunities.length === 0) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Scale className="h-5 w-5 text-primary" />
						Opportunity Comparison
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<Scale className="h-10 w-10 text-muted-foreground mb-3" />
					<p className="text-muted-foreground text-center">
						Select at least 2 opportunities to compare
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
								<Scale className="h-5 w-5 text-primary" />
								Opportunity Comparison
							</CardTitle>
							<CardDescription className="mt-1">
								Comparing {comparison.opportunities.length} opportunities
							</CardDescription>
						</div>
						<Button variant="outline" size="sm" onClick={loadComparison}>
							<RefreshCw className="h-4 w-4 mr-2" />
							Refresh
						</Button>
					</div>
				</CardHeader>

				<CardContent>
					<ScrollArea className="w-full">
						<div className="min-w-[600px]">
							{/* Header Row */}
							<div className="flex border-b pb-4 mb-4">
								<div className="w-40 flex-shrink-0" />
								{comparison.opportunities.map((opp) => (
									<div
										key={opp.opportunityId}
										className="flex-1 min-w-[200px] px-3"
									>
										<div className="flex items-start justify-between">
											<div
												className={cn(
													"flex-1 min-w-0",
													onOpportunitySelect && "cursor-pointer"
												)}
												onClick={() => onOpportunitySelect?.(opp.opportunityId)}

					role="button"
					tabIndex={0}
					onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
												<h4 className="font-semibold truncate">
													{opp.opportunityName}
												</h4>
											</div>
											{onOpportunityRemove && (
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6 -mt-1 -mr-2"
													onClick={() => onOpportunityRemove(opp.opportunityId)}
												>
													<X className="h-4 w-4" />
												</Button>
											)}
										</div>
									</div>
								))}
							</div>

							{/* PWin Row */}
							<ComparisonRow
								label="PWin"
								icon={Target}
								values={comparison.opportunities.map((opp) => ({
									opportunityId: opp.opportunityId,
									value: opp.pwin,
									display: `${opp.pwin}%`,
									color: getPwinColor(opp.pwin),
									delta: getDeltaIndicator(opp.pwin, averageScores.pwin),
								}))}
								showProgress
								maxValue={100}
							/>

							{/* Value Row */}
							<ComparisonRow
								label="Contract Value"
								icon={DollarSign}
								values={comparison.opportunities.map((opp) => ({
									opportunityId: opp.opportunityId,
									value: opp.contractValue,
									display: formatCurrency(opp.contractValue),
									delta: getDeltaIndicator(opp.contractValue, averageScores.value),
								}))}
							/>

							{/* Expected Value Row */}
							<ComparisonRow
								label="Expected Value"
								icon={TrendingUp}
								values={comparison.opportunities.map((opp) => ({
									opportunityId: opp.opportunityId,
									value: opp.expectedValue,
									display: formatCurrency(opp.expectedValue),
									color: "text-green-600",
								}))}
							/>

							{/* Factor Scores */}
							{allFactors.length > 0 && (
								<>
									<div className="flex items-center gap-2 mt-6 mb-3">
										<span className="text-sm font-medium text-muted-foreground">
											Factor Scores
										</span>
										<div className="flex-1 h-px bg-border" />
									</div>

									{allFactors.map((factor) => {
										const avgScore = averageScores.factorScores.get(factor.factorId) ?? 0;

										return (
											<ComparisonRow
												key={factor.factorId}
												label={factor.name}
												values={comparison.opportunities.map((opp) => {
													const score = opp.factorBreakdown.find(
														s => s.factorId === factor.factorId
													);
													return {
														opportunityId: opp.opportunityId,
														value: score?.score ?? 0,
														display: score ? `${score.score}/${factor.maxScore}` : "N/A",
														delta: score
															? getDeltaIndicator(score.score, avgScore)
															: "equal",
													};
												})}
												showProgress
												maxValue={factor.maxScore}
											/>
										);
									})}
								</>
							)}

							{/* Strengths & Weaknesses */}
							<div className="flex items-center gap-2 mt-6 mb-3">
								<span className="text-sm font-medium text-muted-foreground">
									Analysis
								</span>
								<div className="flex-1 h-px bg-border" />
							</div>

							{/* Strengths */}
							<div className="flex mb-4">
								<div className="w-40 flex-shrink-0 py-2">
									<div className="flex items-center gap-2 text-sm text-green-600">
										<CheckCircle2 className="h-4 w-4" />
										<span>Strengths</span>
									</div>
								</div>
								{comparison.opportunities.map((opp) => (
									<div
										key={opp.opportunityId}
										className="flex-1 min-w-[200px] px-3"
									>
										<ul className="space-y-1">
											{opp.strengthsVsOthers.slice(0, 3).map((strength, idx) => (
												<li
													key={idx}
													className="text-xs text-muted-foreground flex items-start gap-1"
												>
													<Plus className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
													<span>{strength}</span>
												</li>
											))}
											{opp.strengthsVsOthers.length === 0 && (
												<li className="text-xs text-muted-foreground italic">
													No strengths identified
												</li>
											)}
										</ul>
									</div>
								))}
							</div>

							{/* Weaknesses */}
							<div className="flex">
								<div className="w-40 flex-shrink-0 py-2">
									<div className="flex items-center gap-2 text-sm text-red-600">
										<XCircle className="h-4 w-4" />
										<span>Weaknesses</span>
									</div>
								</div>
								{comparison.opportunities.map((opp) => (
									<div
										key={opp.opportunityId}
										className="flex-1 min-w-[200px] px-3"
									>
										<ul className="space-y-1">
											{opp.weaknessesVsOthers.slice(0, 3).map((weakness, idx) => (
												<li
													key={idx}
													className="text-xs text-muted-foreground flex items-start gap-1"
												>
													<Minus className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
													<span>{weakness}</span>
												</li>
											))}
											{opp.weaknessesVsOthers.length === 0 && (
												<li className="text-xs text-muted-foreground italic">
													No weaknesses identified
												</li>
											)}
										</ul>
									</div>
								))}
							</div>
						</div>
						<ScrollBar orientation="horizontal" />
					</ScrollArea>

					{/* Recommendations */}
					{comparison.recommendations && comparison.recommendations.length > 0 && (
						<div className="mt-6 pt-4 border-t">
							<h4 className="font-medium mb-3">Comparison Insights</h4>
							<ul className="space-y-2">
								{comparison.recommendations.map((rec, idx) => (
									<li
										key={idx}
										className="flex items-start gap-2 text-sm text-muted-foreground"
									>
										<Target className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
										<span>{rec}</span>
									</li>
								))}
							</ul>
						</div>
					)}
				</CardContent>
			</Card>
		</TooltipProvider>
	);
}

// ============================================================================
// Comparison Row Sub-Component
// ============================================================================

interface ComparisonRowProps {
	label: string;
	icon?: React.ElementType;
	values: Array<{
		opportunityId: string;
		value: number;
		display: string;
		color?: string;
		delta?: "above" | "below" | "equal";
	}>;
	showProgress?: boolean;
	maxValue?: number;
}

function ComparisonRow({
	label,
	icon: Icon,
	values,
	showProgress,
	maxValue = 100,
}: ComparisonRowProps) {
	return (
		<div className="flex items-center py-2 border-b border-border/50 last:border-b-0">
			<div className="w-40 flex-shrink-0 pr-3">
				<div className="flex items-center gap-2 text-sm">
					{Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
					<span className="truncate">{label}</span>
				</div>
			</div>
			{values.map((item) => (
				<div
					key={item.opportunityId}
					className="flex-1 min-w-[200px] px-3"
				>
					<div className="flex items-center gap-2">
						<span className={cn("font-medium", item.color)}>
							{item.display}
						</span>
						{item.delta && item.delta !== "equal" && (
							<Tooltip>
								<TooltipTrigger asChild>
									<span>
										{item.delta === "above" ? (
											<ArrowUp className="h-3.5 w-3.5 text-green-600" />
										) : (
											<ArrowDown className="h-3.5 w-3.5 text-red-600" />
										)}
									</span>
								</TooltipTrigger>
								<TooltipContent>
									{item.delta === "above" ? "Above average" : "Below average"}
								</TooltipContent>
							</Tooltip>
						)}
					</div>
					{showProgress && (
						<div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
							<div
								className={cn(
									"h-full transition-all",
									getScoreColor(item.value, maxValue)
								)}
								style={{ width: `${Math.min(100, (item.value / maxValue) * 100)}%` }}
							/>
						</div>
					)}
				</div>
			))}
		</div>
	);
}

export default OpportunityComparison;
