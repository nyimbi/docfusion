/**
 * ScoreAggregation - Combined Score Visualization
 *
 * Displays aggregated scores from all reviewers with consensus
 * analysis, variance indicators, and breakdown visualizations.
 */

"use client";

import { useMemo } from "react";
import {
	BarChart3,
	Users,
	TrendingUp,
	TrendingDown,
	Minus,
	AlertTriangle,
	CheckCircle2,
	Info,
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
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface ReviewerScore {
	reviewerId: string;
	reviewerName: string;
	criteriaId: string;
	score: number;
	maxScore: number;
	confidence: number;
}

export interface CriteriaAggregation {
	criteriaId: string;
	criteriaName: string;
	criteriaRef?: string;
	category: string;
	weight: number;
	averageScore: number;
	maxScore: number;
	minScoreGiven: number;
	maxScoreGiven: number;
	standardDeviation: number;
	reviewerCount: number;
	scores: ReviewerScore[];
	consensusLevel: number; // 0-1 scale
}

export interface ScoreAggregationProps {
	aggregations: CriteriaAggregation[];
	overallScore: number;
	maxPossibleScore: number;
	reviewerCount: number;
	consensusThreshold?: number;
	className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CONSENSUS_LEVELS = [
	{ min: 0.9, label: "Strong", color: "text-green-600 bg-green-100" },
	{ min: 0.7, label: "Good", color: "text-blue-600 bg-blue-100" },
	{ min: 0.5, label: "Moderate", color: "text-amber-600 bg-amber-100" },
	{ min: 0, label: "Low", color: "text-red-600 bg-red-100" },
];

const getConsensusConfig = (level: number) => {
	return CONSENSUS_LEVELS.find((c) => level >= c.min) || CONSENSUS_LEVELS[3];
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ScoreAggregation({
	aggregations,
	overallScore,
	maxPossibleScore,
	reviewerCount,
	consensusThreshold = 0.7,
	className,
}: ScoreAggregationProps) {
	// Calculate overall statistics
	const stats = useMemo(() => {
		const normalizedScore = (overallScore / maxPossibleScore) * 100;
		const avgConsensus =
			aggregations.reduce((sum, a) => sum + a.consensusLevel, 0) /
			(aggregations.length || 1);
		const lowConsensusCount = aggregations.filter(
			(a) => a.consensusLevel < consensusThreshold
		).length;

		// Group by category
		const byCategory: Record<
			string,
			{ total: number; count: number; weight: number }
		> = {};
		aggregations.forEach((a) => {
			if (!byCategory[a.category]) {
				byCategory[a.category] = { total: 0, count: 0, weight: 0 };
			}
			byCategory[a.category].total +=
				(a.averageScore / a.maxScore) * 100 * a.weight;
			byCategory[a.category].weight += a.weight;
			byCategory[a.category].count += 1;
		});

		const categoryScores = Object.entries(byCategory).map(([cat, data]) => ({
			category: cat,
			score: data.weight > 0 ? data.total / data.weight : 0,
			count: data.count,
		}));

		return {
			normalizedScore,
			avgConsensus,
			lowConsensusCount,
			categoryScores,
		};
	}, [aggregations, overallScore, maxPossibleScore, consensusThreshold]);

	// Determine rating
	const rating = useMemo(() => {
		const score = stats.normalizedScore;
		if (score >= 90) return { label: "Outstanding", color: "text-green-600" };
		if (score >= 75) return { label: "Good", color: "text-blue-600" };
		if (score >= 60) return { label: "Acceptable", color: "text-amber-600" };
		if (score >= 40) return { label: "Marginal", color: "text-orange-600" };
		return { label: "Unacceptable", color: "text-red-600" };
	}, [stats.normalizedScore]);

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-semibold flex items-center gap-2">
						<BarChart3 className="h-5 w-5" />
						Score Aggregation
					</h3>
					<p className="text-sm text-muted-foreground">
						Combined scores from {reviewerCount} reviewers
					</p>
				</div>

				<div className="flex items-center gap-2">
					<Users className="h-4 w-4 text-muted-foreground" />
					<span className="text-sm">{reviewerCount} reviewers</span>
				</div>
			</div>

			{/* Overall Score Card */}
			<Card>
				<CardContent className="p-6">
					<div className="grid grid-cols-3 gap-6">
						{/* Main Score */}
						<div className="text-center">
							<p className="text-sm text-muted-foreground mb-1">Overall Score</p>
							<div className="text-4xl font-bold">
								{overallScore.toFixed(1)}
								<span className="text-lg font-normal text-muted-foreground">
									/{maxPossibleScore}
								</span>
							</div>
							<Badge className={cn("mt-2", rating.color)}>
								{rating.label}
							</Badge>
						</div>

						{/* Normalized Score */}
						<div className="text-center">
							<p className="text-sm text-muted-foreground mb-1">Normalized</p>
							<div className="text-4xl font-bold">
								{stats.normalizedScore.toFixed(1)}%
							</div>
							<Progress
								value={stats.normalizedScore}
								className="h-2 mt-3"
							/>
						</div>

						{/* Consensus */}
						<div className="text-center">
							<p className="text-sm text-muted-foreground mb-1">Consensus Level</p>
							<div className="text-4xl font-bold">
								{(stats.avgConsensus * 100).toFixed(0)}%
							</div>
							<Badge
								className={cn(
									"mt-2",
									getConsensusConfig(stats.avgConsensus).color
								)}
							>
								{getConsensusConfig(stats.avgConsensus).label}
							</Badge>
						</div>
					</div>

					{/* Low consensus warning */}
					{stats.lowConsensusCount > 0 && (
						<div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg flex items-center gap-3">
							<AlertTriangle className="h-5 w-5 text-amber-600" />
							<div>
								<p className="text-sm font-medium text-amber-800 dark:text-amber-400">
									{stats.lowConsensusCount} criteria have low reviewer consensus
								</p>
								<p className="text-xs text-amber-700 dark:text-amber-500">
									Consider discussing these areas with the review team.
								</p>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Category Breakdown */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Score by Category</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{stats.categoryScores.map((cat) => (
						<div key={cat.category}>
							<div className="flex items-center justify-between mb-1">
								<span className="text-sm font-medium">{cat.category}</span>
								<span className="text-sm">{cat.score.toFixed(1)}%</span>
							</div>
							<div className="flex items-center gap-2">
								<Progress value={cat.score} className="flex-1 h-2" />
								<span className="text-xs text-muted-foreground w-16">
									{cat.count} criteria
								</span>
							</div>
						</div>
					))}
				</CardContent>
			</Card>

			{/* Detailed Criteria Scores */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Criteria Details</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{aggregations.map((agg) => {
							const consensusConfig = getConsensusConfig(agg.consensusLevel);
							const normalizedAvg = (agg.averageScore / agg.maxScore) * 100;
							const variance = agg.maxScoreGiven - agg.minScoreGiven;
							const hasHighVariance = variance > agg.maxScore * 0.3;

							return (
								<div
									key={agg.criteriaId}
									className={cn(
										"p-4 rounded-lg border",
										agg.consensusLevel < consensusThreshold &&
											"border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20"
									)}
								>
									{/* Header */}
									<div className="flex items-start justify-between mb-3">
										<div>
											<div className="flex items-center gap-2">
												{agg.criteriaRef && (
													<Badge variant="outline">{agg.criteriaRef}</Badge>
												)}
												<span className="font-medium">{agg.criteriaName}</span>
												<Badge variant="secondary" className="text-xs">
													{(agg.weight * 100).toFixed(0)}% weight
												</Badge>
											</div>
											<p className="text-xs text-muted-foreground mt-1">
												{agg.category}
											</p>
										</div>

										<div className="text-right">
											<p className="text-xl font-bold">
												{agg.averageScore.toFixed(1)}
												<span className="text-sm font-normal text-muted-foreground">
													/{agg.maxScore}
												</span>
											</p>
											<Badge className={cn("mt-1", consensusConfig.color)}>
												{consensusConfig.label} consensus
											</Badge>
										</div>
									</div>

									{/* Score bar with range */}
									<div className="relative h-6 bg-muted rounded overflow-hidden mb-2">
										{/* Average score fill */}
										<div
											className="absolute h-full bg-primary/70"
											style={{ width: `${normalizedAvg}%` }}
										/>

										{/* Range indicator */}
										<div
											className="absolute h-full border-l-2 border-r-2 border-primary opacity-50"
											style={{
												left: `${(agg.minScoreGiven / agg.maxScore) * 100}%`,
												width: `${((agg.maxScoreGiven - agg.minScoreGiven) / agg.maxScore) * 100}%`,
											}}
										/>

										{/* Score labels */}
										<div className="absolute inset-0 flex items-center justify-between px-2 text-xs">
											<span className="font-medium">
												{agg.minScoreGiven.toFixed(0)}-{agg.maxScoreGiven.toFixed(0)}
											</span>
											<span className="font-medium">
												avg: {normalizedAvg.toFixed(0)}%
											</span>
										</div>
									</div>

									{/* Statistics */}
									<div className="flex items-center gap-4 text-xs text-muted-foreground">
										<span className="flex items-center gap-1">
											<Users className="h-3 w-3" />
											{agg.reviewerCount} reviewers
										</span>
										<span>
											σ = {agg.standardDeviation.toFixed(1)}
										</span>
										{hasHighVariance && (
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger>
														<span className="flex items-center gap-1 text-amber-600">
															<AlertTriangle className="h-3 w-3" />
															High variance
														</span>
													</TooltipTrigger>
													<TooltipContent>
														Reviewers have significantly different scores for this criteria.
														Consider discussion.
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										)}
									</div>

									{/* Individual reviewer scores */}
									<div className="mt-3 flex flex-wrap gap-2">
										{agg.scores.map((score) => {
											const isOutlier =
												Math.abs(score.score - agg.averageScore) >
												agg.standardDeviation * 1.5;

											return (
												<TooltipProvider key={score.reviewerId}>
													<Tooltip>
														<TooltipTrigger>
															<Badge
																variant={isOutlier ? "outline" : "secondary"}
																className={cn(
																	"text-xs",
																	isOutlier && "border-amber-500 text-amber-600"
																)}
															>
																{score.score}/{score.maxScore}
															</Badge>
														</TooltipTrigger>
														<TooltipContent>
															<p>{score.reviewerName}</p>
															<p className="text-xs text-muted-foreground">
																Confidence: {(score.confidence * 100).toFixed(0)}%
															</p>
														</TooltipContent>
													</Tooltip>
												</TooltipProvider>
											);
										})}
									</div>
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>

			{/* Legend */}
			<Card>
				<CardContent className="p-4">
					<div className="flex items-center gap-6 text-xs">
						<span className="flex items-center gap-2">
							<div className="w-3 h-3 bg-primary/70 rounded" />
							Average score
						</span>
						<span className="flex items-center gap-2">
							<div className="w-3 h-3 border-l-2 border-r-2 border-primary opacity-50" />
							Score range
						</span>
						<span className="flex items-center gap-2">
							<AlertTriangle className="h-3 w-3 text-amber-600" />
							High variance / Low consensus
						</span>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export default ScoreAggregation;
