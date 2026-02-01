/**
 * ThemeConsistencyAnalyzer - Consistency Analysis View
 *
 * Displays overall consistency score, gap list with severity badges,
 * inconsistency warnings, and recommendations for improving theme coverage.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
	BarChart3,
	RefreshCw,
	AlertCircle,
	AlertTriangle,
	Info,
	CheckCircle2,
	Loader2,
	ChevronDown,
	ChevronRight,
	Target,
	Lightbulb,
	TrendingUp,
	XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import type {
	ConsistencyAnalysis,
	ConsistencyIssue,
	ConsistencyIssueSeverity,
	ConsistencyIssueType,
	ConsistencyRecommendation,
} from "@/lib/types/win-themes";
import { analyzeConsistency } from "@/lib/actions/win-themes";

// =============================================================================
// Types
// =============================================================================

export interface ThemeConsistencyAnalyzerProps {
	/** Opportunity ID */
	opportunityId: string;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const SEVERITY_CONFIG: Record<
	ConsistencyIssueSeverity,
	{ label: string; icon: typeof AlertCircle; color: string; bgColor: string }
> = {
	critical: {
		label: "Critical",
		icon: XCircle,
		color: "text-red-600 dark:text-red-400",
		bgColor: "bg-red-100 dark:bg-red-900/30",
	},
	warning: {
		label: "Warning",
		icon: AlertTriangle,
		color: "text-amber-600 dark:text-amber-400",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
	},
	info: {
		label: "Info",
		icon: Info,
		color: "text-blue-600 dark:text-blue-400",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
	},
};

const ISSUE_TYPE_CONFIG: Record<ConsistencyIssueType, { label: string; description: string }> = {
	gap: {
		label: "Coverage Gap",
		description: "Theme missing from important section",
	},
	inconsistency: {
		label: "Inconsistency",
		description: "Conflicting or contradictory messages",
	},
	weak_coverage: {
		label: "Weak Coverage",
		description: "Theme present but not strongly articulated",
	},
	overemphasis: {
		label: "Overemphasis",
		description: "Theme repeated too frequently",
	},
	terminology: {
		label: "Terminology",
		description: "Inconsistent use of terms or language",
	},
	priority_mismatch: {
		label: "Priority Mismatch",
		description: "High priority theme has insufficient coverage",
	},
};

const SCORE_THRESHOLDS = {
	excellent: 90,
	good: 75,
	fair: 60,
	poor: 40,
};

// =============================================================================
// Loading Skeleton
// =============================================================================

function AnalyzerSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-9 w-28" />
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Score gauge skeleton */}
				<div className="flex items-center justify-center">
					<Skeleton className="h-32 w-32 rounded-full" />
				</div>
				{/* Score breakdown skeleton */}
				<div className="grid grid-cols-4 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-16" />
					))}
				</div>
				{/* Issues skeleton */}
				<div className="space-y-2">
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-16" />
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Score Gauge Component
// =============================================================================

interface ScoreGaugeProps {
	score: number;
}

function ScoreGauge({ score }: ScoreGaugeProps) {
	const getScoreColor = (s: number) => {
		if (s >= SCORE_THRESHOLDS.excellent) return "text-green-600";
		if (s >= SCORE_THRESHOLDS.good) return "text-blue-600";
		if (s >= SCORE_THRESHOLDS.fair) return "text-amber-600";
		return "text-red-600";
	};

	const getScoreLabel = (s: number) => {
		if (s >= SCORE_THRESHOLDS.excellent) return "Excellent";
		if (s >= SCORE_THRESHOLDS.good) return "Good";
		if (s >= SCORE_THRESHOLDS.fair) return "Fair";
		if (s >= SCORE_THRESHOLDS.poor) return "Poor";
		return "Critical";
	};

	const circumference = 2 * Math.PI * 45;
	const offset = circumference - (score / 100) * circumference;

	return (
		<div className="relative w-32 h-32">
			<svg className="w-32 h-32 transform -rotate-90">
				{/* Background circle */}
				<circle
					cx="64"
					cy="64"
					r="45"
					stroke="currentColor"
					strokeWidth="10"
					fill="none"
					className="text-muted"
				/>
				{/* Progress circle */}
				<circle
					cx="64"
					cy="64"
					r="45"
					stroke="currentColor"
					strokeWidth="10"
					fill="none"
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					className={cn("transition-all duration-1000", getScoreColor(score))}
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span className={cn("text-3xl font-bold", getScoreColor(score))}>
					{score.toFixed(0)}
				</span>
				<span className="text-xs text-muted-foreground">{getScoreLabel(score)}</span>
			</div>
		</div>
	);
}

// =============================================================================
// Issue Card Component
// =============================================================================

interface IssueCardProps {
	issue: ConsistencyIssue;
}

function IssueCard({ issue }: IssueCardProps) {
	const severityConfig = SEVERITY_CONFIG[issue.severity];
	const typeConfig = ISSUE_TYPE_CONFIG[issue.type];
	const SeverityIcon = severityConfig.icon;

	return (
		<div
			className={cn(
				"p-3 rounded-lg border-l-4",
				issue.severity === "critical" && "border-l-red-500 bg-red-50 dark:bg-red-950/20",
				issue.severity === "warning" && "border-l-amber-500 bg-amber-50 dark:bg-amber-950/20",
				issue.severity === "info" && "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20"
			)}
		>
			<div className="flex items-start gap-3">
				<SeverityIcon className={cn("h-5 w-5 mt-0.5 shrink-0", severityConfig.color)} />
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<Badge variant="secondary" className={cn("text-xs", severityConfig.bgColor, severityConfig.color)}>
							{severityConfig.label}
						</Badge>
						<Badge variant="outline" className="text-xs">
							{typeConfig.label}
						</Badge>
						{issue.themeName && (
							<span className="text-xs text-muted-foreground truncate">
								{issue.themeName}
							</span>
						)}
					</div>
					<p className="text-sm font-medium">{issue.message}</p>
					<p className="text-sm text-muted-foreground mt-1">{issue.details}</p>
					{issue.recommendation && (
						<div className="mt-2 flex items-start gap-2 text-sm">
							<Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
							<span>{issue.recommendation}</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// Recommendation Card Component
// =============================================================================

interface RecommendationCardProps {
	recommendation: ConsistencyRecommendation;
}

function RecommendationCard({ recommendation }: RecommendationCardProps) {
	const priorityColor =
		recommendation.priority === "high"
			? "text-red-600 bg-red-100 dark:bg-red-900/30"
			: recommendation.priority === "medium"
				? "text-amber-600 bg-amber-100 dark:bg-amber-900/30"
				: "text-blue-600 bg-blue-100 dark:bg-blue-900/30";

	return (
		<div className="p-4 border rounded-lg">
			<div className="flex items-start gap-3">
				<TrendingUp className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
				<div className="flex-1">
					<div className="flex items-center gap-2 mb-2">
						<h4 className="font-medium">{recommendation.title}</h4>
						<Badge variant="secondary" className={cn("text-xs", priorityColor)}>
							{recommendation.priority}
						</Badge>
					</div>
					<p className="text-sm text-muted-foreground">{recommendation.description}</p>

					{recommendation.actionItems.length > 0 && (
						<div className="mt-3">
							<p className="text-xs font-medium text-muted-foreground mb-2">
								Action Items:
							</p>
							<ul className="space-y-1">
								{recommendation.actionItems.map((item, idx) => (
									<li key={idx} className="text-sm flex items-start gap-2">
										<CheckCircle2 className="h-3 w-3 mt-1 text-muted-foreground shrink-0" />
										{item}
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function ThemeConsistencyAnalyzer({
	opportunityId,
	className,
}: ThemeConsistencyAnalyzerProps) {
	// State
	const [analysis, setAnalysis] = useState<ConsistencyAnalysis | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Load analysis
	useEffect(() => {
		async function loadAnalysis() {
			setIsLoading(true);
			setError(null);
			const result = await analyzeConsistency(opportunityId);
			if (result.success && result.data) {
				setAnalysis(result.data);
			} else {
				setError(result.error || "Failed to load analysis");
			}
			setIsLoading(false);
		}
		loadAnalysis();
	}, [opportunityId]);

	// Re-analyze
	const handleReanalyze = useCallback(async () => {
		setIsAnalyzing(true);
		setError(null);
		const result = await analyzeConsistency(opportunityId);
		if (result.success && result.data) {
			setAnalysis(result.data);
		} else {
			setError(result.error || "Failed to analyze");
		}
		setIsAnalyzing(false);
	}, [opportunityId]);

	// Group issues by severity
	const issuesBySeverity = analysis
		? {
				critical: analysis.issues.filter((i) => i.severity === "critical"),
				warning: analysis.issues.filter((i) => i.severity === "warning"),
				info: analysis.issues.filter((i) => i.severity === "info"),
			}
		: { critical: [], warning: [], info: [] };

	// Loading state
	if (isLoading) {
		return <AnalyzerSkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<BarChart3 className="h-5 w-5" />
						Consistency Analysis
					</CardTitle>
					<Button
						variant="outline"
						size="sm"
						onClick={handleReanalyze}
						disabled={isAnalyzing}
					>
						{isAnalyzing ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Analyzing...
							</>
						) : (
							<>
								<RefreshCw className="h-4 w-4 mr-2" />
								Re-analyze
							</>
						)}
					</Button>
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

				{/* Empty State */}
				{!analysis && !error && (
					<div className="text-center py-8">
						<BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50" />
						<h3 className="mt-4 font-medium">No analysis available</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Run an analysis to check theme consistency
						</p>
						<Button onClick={handleReanalyze} className="mt-4" disabled={isAnalyzing}>
							<RefreshCw className="h-4 w-4 mr-2" />
							Analyze Now
						</Button>
					</div>
				)}

				{analysis && (
					<>
						{/* Overall Score */}
						<div className="flex flex-col items-center">
							<ScoreGauge score={analysis.overallScore} />
							<p className="text-sm text-muted-foreground mt-2">
								Overall Consistency Score
							</p>
						</div>

						{/* Score Breakdown */}
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<div className="p-3 bg-muted/50 rounded-lg text-center">
								<div className="text-lg font-bold">
									{analysis.scoreBreakdown.coverageScore.toFixed(0)}
								</div>
								<div className="text-xs text-muted-foreground">Coverage</div>
								<Progress
									value={analysis.scoreBreakdown.coverageScore}
									className="h-1 mt-2"
								/>
							</div>
							<div className="p-3 bg-muted/50 rounded-lg text-center">
								<div className="text-lg font-bold">
									{analysis.scoreBreakdown.consistencyScore.toFixed(0)}
								</div>
								<div className="text-xs text-muted-foreground">Consistency</div>
								<Progress
									value={analysis.scoreBreakdown.consistencyScore}
									className="h-1 mt-2"
								/>
							</div>
							<div className="p-3 bg-muted/50 rounded-lg text-center">
								<div className="text-lg font-bold">
									{analysis.scoreBreakdown.strengthScore.toFixed(0)}
								</div>
								<div className="text-xs text-muted-foreground">Strength</div>
								<Progress
									value={analysis.scoreBreakdown.strengthScore}
									className="h-1 mt-2"
								/>
							</div>
							<div className="p-3 bg-muted/50 rounded-lg text-center">
								<div className="text-lg font-bold">
									{analysis.scoreBreakdown.balanceScore.toFixed(0)}
								</div>
								<div className="text-xs text-muted-foreground">Balance</div>
								<Progress
									value={analysis.scoreBreakdown.balanceScore}
									className="h-1 mt-2"
								/>
							</div>
						</div>

						{/* Issues */}
						<Accordion type="multiple" defaultValue={["critical", "warning"]}>
							{/* Critical Issues */}
							{issuesBySeverity.critical.length > 0 && (
								<AccordionItem value="critical">
									<AccordionTrigger>
										<div className="flex items-center gap-2">
											<XCircle className="h-4 w-4 text-red-600" />
											<span>Critical Issues</span>
											<Badge variant="destructive">{issuesBySeverity.critical.length}</Badge>
										</div>
									</AccordionTrigger>
									<AccordionContent>
										<div className="space-y-2 pt-2">
											{issuesBySeverity.critical.map((issue) => (
												<IssueCard key={issue.id} issue={issue} />
											))}
										</div>
									</AccordionContent>
								</AccordionItem>
							)}

							{/* Warnings */}
							{issuesBySeverity.warning.length > 0 && (
								<AccordionItem value="warning">
									<AccordionTrigger>
										<div className="flex items-center gap-2">
											<AlertTriangle className="h-4 w-4 text-amber-600" />
											<span>Warnings</span>
											<Badge className="bg-amber-500">{issuesBySeverity.warning.length}</Badge>
										</div>
									</AccordionTrigger>
									<AccordionContent>
										<div className="space-y-2 pt-2">
											{issuesBySeverity.warning.map((issue) => (
												<IssueCard key={issue.id} issue={issue} />
											))}
										</div>
									</AccordionContent>
								</AccordionItem>
							)}

							{/* Info */}
							{issuesBySeverity.info.length > 0 && (
								<AccordionItem value="info">
									<AccordionTrigger>
										<div className="flex items-center gap-2">
											<Info className="h-4 w-4 text-blue-600" />
											<span>Suggestions</span>
											<Badge variant="secondary">{issuesBySeverity.info.length}</Badge>
										</div>
									</AccordionTrigger>
									<AccordionContent>
										<div className="space-y-2 pt-2">
											{issuesBySeverity.info.map((issue) => (
												<IssueCard key={issue.id} issue={issue} />
											))}
										</div>
									</AccordionContent>
								</AccordionItem>
							)}
						</Accordion>

						{/* Themes with Gaps */}
						{analysis.themesWithGaps.length > 0 && (
							<div>
								<h3 className="text-sm font-medium mb-3 flex items-center gap-2">
									<Target className="h-4 w-4" />
									Themes Missing from Sections
								</h3>
								<div className="space-y-2">
									{analysis.themesWithGaps.map((gap) => (
										<div
											key={gap.themeId}
											className="p-3 border rounded-lg"
										>
											<p className="font-medium text-sm">{gap.themeName}</p>
											<p className="text-xs text-muted-foreground mt-1">
												Missing from: {gap.missingSections.join(", ")}
											</p>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Recommendations */}
						{analysis.recommendations.length > 0 && (
							<div>
								<h3 className="text-sm font-medium mb-3 flex items-center gap-2">
									<Lightbulb className="h-4 w-4" />
									Recommendations
								</h3>
								<div className="space-y-3">
									{analysis.recommendations.map((rec) => (
										<RecommendationCard key={rec.id} recommendation={rec} />
									))}
								</div>
							</div>
						)}

						{/* No Issues */}
						{analysis.issues.length === 0 && (
							<Alert>
								<CheckCircle2 className="h-4 w-4 text-green-600" />
								<AlertTitle>All Clear</AlertTitle>
								<AlertDescription>
									No consistency issues found. Your themes are well-distributed
									and consistently presented throughout the proposal.
								</AlertDescription>
							</Alert>
						)}

						{/* Analysis Date */}
						<p className="text-xs text-muted-foreground text-center">
							Last analyzed: {new Date(analysis.analyzedAt).toLocaleString()}
						</p>
					</>
				)}
			</CardContent>
		</Card>
	);
}

export default ThemeConsistencyAnalyzer;
