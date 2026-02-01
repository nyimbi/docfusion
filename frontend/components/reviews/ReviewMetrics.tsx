/**
 * ReviewMetrics - Review Process Effectiveness Statistics
 *
 * Displays metrics on review process effectiveness including review type
 * performance, reviewer contributions, and win rate correlations.
 */

"use client";

import { useMemo } from "react";
import {
	BarChart3,
	TrendingUp,
	Users,
	Target,
	Award,
	Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface ReviewTypeEffectiveness {
	reviewType: string;
	averageScoreImpact: number;
	averageIssuesFound: number;
	averageResolutionRate: number;
	reviewCount: number;
}

export interface ReviewerEffectiveness {
	reviewerId: string;
	reviewerName: string;
	reviewsParticipated: number;
	averageCommentsPerReview: number;
	criticalIssuesIdentified: number;
	averageScoreAccuracy: number;
}

export interface WinRateCorrelation {
	reviewScore: string;
	winRate: number;
	proposalCount: number;
}

export interface CommonIssueCategory {
	category: string;
	occurrences: number;
	resolutionRate: number;
}

export interface EffectivenessMetricsData {
	timeframe: {
		start: string;
		end: string;
	};
	reviewsConducted: number;
	averageResolutionRate: number;
	averageScoreImprovement: number;
	reviewTypeEffectiveness: ReviewTypeEffectiveness[];
	reviewerEffectiveness: ReviewerEffectiveness[];
	commonIssueCategories: CommonIssueCategory[];
	winRateCorrelation: WinRateCorrelation[];
}

export interface ReviewMetricsProps {
	metrics: EffectivenessMetricsData;
	className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const REVIEW_TYPE_LABELS: Record<string, { label: string; color: string }> = {
	pink: { label: "Pink Team", color: "bg-pink-500" },
	red: { label: "Red Team", color: "bg-red-500" },
	gold: { label: "Gold Team", color: "bg-amber-500" },
	compliance: { label: "Compliance", color: "bg-blue-500" },
	final: { label: "Final", color: "bg-purple-500" },
};

const RECOMMENDATION_LABELS: Record<string, string> = {
	ready_to_submit: "Ready to Submit",
	needs_minor_revisions: "Minor Revisions",
	needs_major_revisions: "Major Revisions",
	not_ready: "Not Ready",
	recommend_no_bid: "No-Bid",
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ReviewMetrics({
	metrics,
	className,
}: ReviewMetricsProps) {
	const formatDate = (dateStr: string) => {
		return new Date(dateStr).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	// Calculate top reviewer
	const topReviewer = useMemo(() => {
		return metrics.reviewerEffectiveness.reduce((best, current) =>
			current.criticalIssuesIdentified > (best?.criticalIssuesIdentified || 0) ? current : best
		, metrics.reviewerEffectiveness[0]);
	}, [metrics.reviewerEffectiveness]);

	// Calculate most effective review type
	const mostEffectiveType = useMemo(() => {
		return metrics.reviewTypeEffectiveness.reduce((best, current) =>
			current.averageScoreImpact > (best?.averageScoreImpact || 0) ? current : best
		, metrics.reviewTypeEffectiveness[0]);
	}, [metrics.reviewTypeEffectiveness]);

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-xl font-bold">Review Process Metrics</h2>
					<p className="text-sm text-muted-foreground">
						{formatDate(metrics.timeframe.start)} - {formatDate(metrics.timeframe.end)}
					</p>
				</div>
				<Badge variant="outline" className="gap-1">
					<Clock className="h-3 w-3" />
					{metrics.reviewsConducted} reviews
				</Badge>
			</div>

			{/* Summary Cards */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
								<BarChart3 className="h-5 w-5 text-blue-600" />
							</div>
							<div>
								<p className="text-2xl font-bold">{metrics.reviewsConducted}</p>
								<p className="text-xs text-muted-foreground">Reviews Conducted</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
								<Target className="h-5 w-5 text-green-600" />
							</div>
							<div>
								<p className="text-2xl font-bold">{(metrics.averageResolutionRate * 100).toFixed(0)}%</p>
								<p className="text-xs text-muted-foreground">Avg Resolution Rate</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
								<TrendingUp className="h-5 w-5 text-purple-600" />
							</div>
							<div>
								<p className="text-2xl font-bold">+{metrics.averageScoreImprovement.toFixed(1)}</p>
								<p className="text-xs text-muted-foreground">Avg Score Improvement</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
								<Users className="h-5 w-5 text-amber-600" />
							</div>
							<div>
								<p className="text-2xl font-bold">{metrics.reviewerEffectiveness.length}</p>
								<p className="text-xs text-muted-foreground">Active Reviewers</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Review Type Effectiveness */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Review Type Effectiveness</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{metrics.reviewTypeEffectiveness.map((type) => {
							const typeConfig = REVIEW_TYPE_LABELS[type.reviewType] || { label: type.reviewType, color: "bg-gray-500" };
							const isBest = type.reviewType === mostEffectiveType?.reviewType;

							return (
								<div key={type.reviewType} className={cn("p-3 rounded-lg", isBest && "bg-green-50 dark:bg-green-900/20")}>
									<div className="flex items-center justify-between mb-2">
										<div className="flex items-center gap-2">
											<Badge className={typeConfig.color}>{typeConfig.label}</Badge>
											{isBest && (
												<Badge variant="outline" className="text-green-600 border-green-600">
													<Award className="h-3 w-3 mr-1" />
													Most Effective
												</Badge>
											)}
										</div>
										<span className="text-sm text-muted-foreground">{type.reviewCount} reviews</span>
									</div>

									<div className="grid grid-cols-3 gap-4 text-sm">
										<div>
											<p className="text-muted-foreground">Score Impact</p>
											<p className="font-medium text-green-600">+{type.averageScoreImpact.toFixed(1)}</p>
										</div>
										<div>
											<p className="text-muted-foreground">Issues Found</p>
											<p className="font-medium">{type.averageIssuesFound.toFixed(0)}</p>
										</div>
										<div>
											<p className="text-muted-foreground">Resolution Rate</p>
											<p className="font-medium">{(type.averageResolutionRate * 100).toFixed(0)}%</p>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>

			{/* Top Reviewers */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Reviewer Contributions</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{metrics.reviewerEffectiveness.slice(0, 5).map((reviewer, idx) => {
							const isTop = reviewer.reviewerId === topReviewer?.reviewerId;

							return (
								<div key={reviewer.reviewerId} className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted/50">
									<div className={cn(
										"w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
										idx === 0 ? "bg-amber-100 text-amber-700" :
										idx === 1 ? "bg-gray-100 text-gray-700" :
										idx === 2 ? "bg-orange-100 text-orange-700" :
										"bg-muted text-muted-foreground"
									)}>
										{idx + 1}
									</div>
									<div className="flex-1">
										<p className="font-medium">{reviewer.reviewerName}</p>
										<p className="text-xs text-muted-foreground">
											{reviewer.reviewsParticipated} reviews • {reviewer.averageCommentsPerReview.toFixed(1)} comments/review
										</p>
									</div>
									<div className="text-right">
										<p className="font-medium">{reviewer.criticalIssuesIdentified}</p>
										<p className="text-xs text-muted-foreground">critical issues</p>
									</div>
									<div className="text-right">
										<p className="font-medium">{(reviewer.averageScoreAccuracy * 100).toFixed(0)}%</p>
										<p className="text-xs text-muted-foreground">accuracy</p>
									</div>
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>

			{/* Common Issue Categories */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Common Issue Categories</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{metrics.commonIssueCategories.map((category) => (
							<div key={category.category}>
								<div className="flex items-center justify-between mb-1">
									<span className="text-sm font-medium">{category.category}</span>
									<span className="text-sm text-muted-foreground">
										{category.occurrences} occurrences • {(category.resolutionRate * 100).toFixed(0)}% resolved
									</span>
								</div>
								<Progress value={category.resolutionRate * 100} className="h-2" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Win Rate Correlation */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Win Rate by Review Recommendation</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{metrics.winRateCorrelation.map((correlation) => {
							const label = RECOMMENDATION_LABELS[correlation.reviewScore] || correlation.reviewScore;
							const winPercent = correlation.winRate * 100;

							return (
								<div key={correlation.reviewScore}>
									<div className="flex items-center justify-between mb-1">
										<span className="text-sm font-medium">{label}</span>
										<div className="flex items-center gap-2">
											<Badge variant="outline">{correlation.proposalCount} proposals</Badge>
											<span className="font-medium text-green-600">{winPercent.toFixed(0)}% win rate</span>
										</div>
									</div>
									<div className="relative h-4 bg-muted rounded-full overflow-hidden">
										<div
											className={cn(
												"absolute h-full rounded-full transition-all",
												winPercent >= 60 ? "bg-green-500" :
												winPercent >= 40 ? "bg-amber-500" : "bg-red-500"
											)}
											style={{ width: `${winPercent}%` }}
										/>
									</div>
								</div>
							);
						})}
					</div>

					<div className="mt-4 p-3 bg-muted rounded-lg">
						<p className="text-sm">
							<strong>Insight:</strong> Proposals receiving &ldquo;Ready to Submit&rdquo; recommendations have
							the highest win rate, demonstrating the value of thorough review processes.
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export default ReviewMetrics;
