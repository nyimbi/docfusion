/**
 * BeforeAfterView - Review Change Comparison
 *
 * Compares metrics and findings between reviews to show improvement
 * or regression in proposal quality.
 */

"use client";

import {
	TrendingUp,
	TrendingDown,
	Minus,
	ArrowRight,
	CheckCircle2,
	AlertTriangle,
	BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface BeforeAfterComparisonData {
	reviewId: string;
	previousReviewId: string | null;
	previousReviewType: string | null;
	overallScoreChange: number | null;
	categoryChanges: {
		category: string;
		previousScore: number | null;
		currentScore: number;
		change: number | null;
		percentChange: number | null;
	}[];
	commentResolution: {
		previousTotal: number;
		resolvedSincePrevious: number;
		newComments: number;
		stillOpen: number;
		resolutionRate: number;
	};
	issueChanges: {
		severity: string;
		previousCount: number;
		currentCount: number;
		change: number;
	}[];
	strengthsGained: string[];
	weaknessesAddressed: string[];
	newConcerns: string[];
	improvementAreas: string[];
}

export interface BeforeAfterViewProps {
	comparison: BeforeAfterComparisonData;
	currentReviewName: string;
	previousReviewName?: string;
	className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SEVERITY_COLORS: Record<string, string> = {
	critical: "text-red-600",
	major: "text-orange-600",
	minor: "text-yellow-600",
	editorial: "text-blue-600",
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function ChangeIndicator({ change, showPercent = false }: { change: number | null; showPercent?: boolean }) {
	if (change === null) return <Minus className="h-4 w-4 text-muted-foreground" />;

	const isPositive = change > 0;
	const isNeutral = change === 0;

	return (
		<div className={cn(
			"flex items-center gap-1",
			isPositive && "text-green-600",
			!isPositive && !isNeutral && "text-red-600",
			isNeutral && "text-muted-foreground"
		)}>
			{isPositive ? (
				<TrendingUp className="h-4 w-4" />
			) : isNeutral ? (
				<Minus className="h-4 w-4" />
			) : (
				<TrendingDown className="h-4 w-4" />
			)}
			<span className="font-medium">
				{isPositive && "+"}
				{change.toFixed(showPercent ? 1 : 0)}
				{showPercent && "%"}
			</span>
		</div>
	);
}

function IssueChangeIndicator({ change }: { change: number }) {
	// For issues, negative is good (fewer issues)
	const isPositive = change < 0;
	const isNeutral = change === 0;

	return (
		<div className={cn(
			"flex items-center gap-1",
			isPositive && "text-green-600",
			!isPositive && !isNeutral && "text-red-600",
			isNeutral && "text-muted-foreground"
		)}>
			{isPositive ? (
				<TrendingDown className="h-4 w-4" />
			) : isNeutral ? (
				<Minus className="h-4 w-4" />
			) : (
				<TrendingUp className="h-4 w-4" />
			)}
			<span className="font-medium">
				{change > 0 && "+"}
				{change}
			</span>
		</div>
	);
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BeforeAfterView({
	comparison,
	currentReviewName,
	previousReviewName = "Previous Review",
	className,
}: BeforeAfterViewProps) {
	const hasImproved = (comparison.overallScoreChange ?? 0) > 0;
	const resolutionPercent = comparison.commentResolution.resolutionRate * 100;

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-center gap-4">
				<div className="text-center">
					<Badge variant="outline">{previousReviewName}</Badge>
				</div>
				<ArrowRight className="h-5 w-5 text-muted-foreground" />
				<div className="text-center">
					<Badge>{currentReviewName}</Badge>
				</div>
			</div>

			{/* Overall Score Change */}
			<Card className={cn(
				"border-2",
				hasImproved ? "border-green-500/50" : comparison.overallScoreChange !== null && comparison.overallScoreChange < 0 ? "border-red-500/50" : "border-muted"
			)}>
				<CardContent className="p-6">
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-lg font-semibold">Overall Score Change</h3>
							<p className="text-sm text-muted-foreground">
								Compared to previous review
							</p>
						</div>
						<div className="text-right">
							{comparison.overallScoreChange !== null ? (
								<div className={cn(
									"text-3xl font-bold",
									hasImproved ? "text-green-600" : comparison.overallScoreChange < 0 ? "text-red-600" : ""
								)}>
									{hasImproved && "+"}
									{comparison.overallScoreChange.toFixed(1)}
								</div>
							) : (
								<div className="text-3xl font-bold text-muted-foreground">N/A</div>
							)}
							<p className="text-sm text-muted-foreground">points</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Category Changes */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base flex items-center gap-2">
						<BarChart3 className="h-4 w-4" />
						Score Changes by Category
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{comparison.categoryChanges.map((cat) => (
							<div key={cat.category}>
								<div className="flex items-center justify-between mb-1">
									<span className="text-sm font-medium">{cat.category}</span>
									<div className="flex items-center gap-4">
										<span className="text-sm text-muted-foreground">
											{cat.previousScore !== null ? cat.previousScore.toFixed(1) : "N/A"}
											{" → "}
											{cat.currentScore.toFixed(1)}
										</span>
										<ChangeIndicator change={cat.change} />
									</div>
								</div>
								<div className="relative h-2 bg-muted rounded-full overflow-hidden">
									{cat.previousScore !== null && (
										<div
											className="absolute h-full bg-muted-foreground/30 rounded-full"
											style={{ width: `${cat.previousScore}%` }}
										/>
									)}
									<div
										className={cn(
											"absolute h-full rounded-full",
											(cat.change ?? 0) >= 0 ? "bg-green-500" : "bg-red-500"
										)}
										style={{ width: `${cat.currentScore}%` }}
									/>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Comment Resolution */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Comment Resolution Progress</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
						<div className="text-center p-3 bg-muted rounded-lg">
							<p className="text-2xl font-bold">{comparison.commentResolution.previousTotal}</p>
							<p className="text-xs text-muted-foreground">Previous Comments</p>
						</div>
						<div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
							<p className="text-2xl font-bold text-green-600">
								{comparison.commentResolution.resolvedSincePrevious}
							</p>
							<p className="text-xs text-muted-foreground">Resolved</p>
						</div>
						<div className="text-center p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
							<p className="text-2xl font-bold text-blue-600">
								{comparison.commentResolution.newComments}
							</p>
							<p className="text-xs text-muted-foreground">New Comments</p>
						</div>
						<div className="text-center p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
							<p className="text-2xl font-bold text-amber-600">
								{comparison.commentResolution.stillOpen}
							</p>
							<p className="text-xs text-muted-foreground">Still Open</p>
						</div>
					</div>

					<div>
						<div className="flex justify-between text-sm mb-1">
							<span>Resolution Rate</span>
							<span className="font-medium">{resolutionPercent.toFixed(1)}%</span>
						</div>
						<Progress value={resolutionPercent} className="h-2" />
					</div>
				</CardContent>
			</Card>

			{/* Issue Changes by Severity */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Issue Changes by Severity</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{comparison.issueChanges.map((issue) => (
							<div key={issue.severity} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
								<div className="flex items-center gap-2">
									<Badge variant="outline" className={cn("capitalize", SEVERITY_COLORS[issue.severity])}>
										{issue.severity}
									</Badge>
								</div>
								<div className="flex items-center gap-4">
									<span className="text-sm text-muted-foreground">
										{issue.previousCount} → {issue.currentCount}
									</span>
									<IssueChangeIndicator change={issue.change} />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Improvements & Concerns */}
			<div className="grid md:grid-cols-2 gap-4">
				{/* Improvements */}
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base flex items-center gap-2 text-green-600">
							<CheckCircle2 className="h-4 w-4" />
							Improvements Made
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{comparison.strengthsGained.length > 0 && (
							<div>
								<h4 className="text-sm font-medium mb-2">New Strengths</h4>
								<ul className="space-y-1">
									{comparison.strengthsGained.map((item, idx) => (
										<li key={idx} className="text-sm flex items-start gap-2">
											<TrendingUp className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
											{item}
										</li>
									))}
								</ul>
							</div>
						)}
						{comparison.weaknessesAddressed.length > 0 && (
							<div>
								<h4 className="text-sm font-medium mb-2">Weaknesses Addressed</h4>
								<ul className="space-y-1">
									{comparison.weaknessesAddressed.map((item, idx) => (
										<li key={idx} className="text-sm flex items-start gap-2">
											<CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
											{item}
										</li>
									))}
								</ul>
							</div>
						)}
						{comparison.strengthsGained.length === 0 && comparison.weaknessesAddressed.length === 0 && (
							<p className="text-sm text-muted-foreground italic">No specific improvements noted</p>
						)}
					</CardContent>
				</Card>

				{/* Remaining Concerns */}
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base flex items-center gap-2 text-amber-600">
							<AlertTriangle className="h-4 w-4" />
							Areas Needing Attention
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{comparison.newConcerns.length > 0 && (
							<div>
								<h4 className="text-sm font-medium mb-2">New Concerns</h4>
								<ul className="space-y-1">
									{comparison.newConcerns.map((item, idx) => (
										<li key={idx} className="text-sm flex items-start gap-2">
											<AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
											{item}
										</li>
									))}
								</ul>
							</div>
						)}
						{comparison.improvementAreas.length > 0 && (
							<div>
								<h4 className="text-sm font-medium mb-2">Continue Improving</h4>
								<ul className="space-y-1">
									{comparison.improvementAreas.map((item, idx) => (
										<li key={idx} className="text-sm flex items-start gap-2">
											<TrendingUp className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
											{item}
										</li>
									))}
								</ul>
							</div>
						)}
						{comparison.newConcerns.length === 0 && comparison.improvementAreas.length === 0 && (
							<p className="text-sm text-muted-foreground italic">No remaining concerns identified</p>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

export default BeforeAfterView;
