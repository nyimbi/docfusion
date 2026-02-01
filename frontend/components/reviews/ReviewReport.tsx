/**
 * ReviewReport - Review Summary Report
 *
 * Comprehensive summary of a completed review including statistics,
 * key findings, scores, and recommendations.
 */

"use client";

import {
	FileText,
	Download,
	BarChart3,
	AlertTriangle,
	CheckCircle2,
	ThumbsUp,
	ThumbsDown,
	Target,
	Users,
	Clock,
	TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface ReviewReportData {
	review: {
		id: string;
		reviewType: string;
		reviewName: string;
		scheduledDate: string;
		completedAt: string | null;
		status: string;
	};
	statistics: {
		totalComments: number;
		commentsByType: Record<string, number>;
		commentsBySeverity: Record<string, number>;
		resolvedCount: number;
		openCount: number;
		resolutionRate: number;
	};
	scores: {
		overallScore: number;
		maxPossibleScore: number;
		normalizedScore: number;
		confidence: number;
	};
	reviewers: {
		id: string;
		name: string;
		role: string;
		status: string;
		commentsCount: number;
		scoresCount: number;
		completedAt: string | null;
	}[];
	keyFindings: {
		strengths: string[];
		weaknesses: string[];
		criticalIssues: string[];
		recommendations: string[];
	};
	complianceGaps: {
		criteriaRef: string;
		criteriaName: string;
		gapDescription: string;
		severity: string;
		suggestedResolution: string;
	}[];
	themeAnalysis: {
		themeId: string;
		themeName: string;
		supportingComments: number;
		conflictingComments: number;
		themeStrength: number;
	}[];
	recommendation: string;
	executiveSummary: string;
	generatedAt: string;
}

export interface ReviewReportProps {
	report: ReviewReportData;
	onExport?: (format: "pdf" | "docx" | "xlsx") => void;
	className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RECOMMENDATION_CONFIG: Record<string, { label: string; color: string; description: string }> = {
	ready_to_submit: {
		label: "Ready to Submit",
		color: "bg-green-500",
		description: "Proposal meets all requirements and is ready for submission",
	},
	needs_minor_revisions: {
		label: "Needs Minor Revisions",
		color: "bg-blue-500",
		description: "Minor issues to address before submission",
	},
	needs_major_revisions: {
		label: "Needs Major Revisions",
		color: "bg-amber-500",
		description: "Significant issues require substantial rework",
	},
	not_ready: {
		label: "Not Ready",
		color: "bg-red-500",
		description: "Proposal requires extensive revision before submission",
	},
	recommend_no_bid: {
		label: "Recommend No-Bid",
		color: "bg-gray-500",
		description: "Consider withdrawing from this opportunity",
	},
};

const REVIEW_TYPE_LABELS: Record<string, string> = {
	pink: "Pink Team Review",
	red: "Red Team Review",
	gold: "Gold Team Review",
	compliance: "Compliance Review",
	final: "Final Review",
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ReviewReport({
	report,
	onExport,
	className,
}: ReviewReportProps) {
	const recommendationConfig = RECOMMENDATION_CONFIG[report.recommendation] || RECOMMENDATION_CONFIG.needs_minor_revisions;
	const scorePercent = (report.scores.overallScore / report.scores.maxPossibleScore) * 100;

	const formatDate = (dateStr: string | null) => {
		if (!dateStr) return "N/A";
		return new Date(dateStr).toLocaleDateString("en-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
		});
	};

	return (
		<div className={cn("space-y-6 max-w-4xl mx-auto", className)}>
			{/* Header */}
			<div className="flex items-start justify-between">
				<div>
					<Badge variant="outline" className="mb-2">
						{REVIEW_TYPE_LABELS[report.review.reviewType] || report.review.reviewType}
					</Badge>
					<h1 className="text-2xl font-bold">{report.review.reviewName}</h1>
					<p className="text-muted-foreground">
						Completed {formatDate(report.review.completedAt)}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" onClick={() => onExport?.("pdf")}>
						<Download className="h-4 w-4 mr-2" />
						Export PDF
					</Button>
					<Button variant="outline" onClick={() => onExport?.("docx")}>
						<FileText className="h-4 w-4 mr-2" />
						Export Word
					</Button>
				</div>
			</div>

			{/* Recommendation Banner */}
			<Card className={cn("border-2", recommendationConfig.color.replace("bg-", "border-"))}>
				<CardContent className="p-4">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-lg font-semibold">Recommendation</h2>
							<p className="text-muted-foreground">{recommendationConfig.description}</p>
						</div>
						<Badge className={cn("text-lg px-4 py-2", recommendationConfig.color)}>
							{recommendationConfig.label}
						</Badge>
					</div>
				</CardContent>
			</Card>

			{/* Executive Summary */}
			<Card>
				<CardHeader>
					<CardTitle>Executive Summary</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm leading-relaxed">{report.executiveSummary}</p>
				</CardContent>
			</Card>

			{/* Score Overview */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<BarChart3 className="h-5 w-5" />
						Score Overview
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-between mb-4">
						<div>
							<div className="flex items-baseline gap-2">
								<span className="text-4xl font-bold">{report.scores.overallScore.toFixed(1)}</span>
								<span className="text-xl text-muted-foreground">/ {report.scores.maxPossibleScore}</span>
							</div>
							<p className="text-sm text-muted-foreground">
								{scorePercent.toFixed(1)}% • {(report.scores.confidence * 100).toFixed(0)}% confidence
							</p>
						</div>
						<div className="text-right">
							<Badge className={scorePercent >= 75 ? "bg-green-500" : scorePercent >= 60 ? "bg-yellow-500" : "bg-red-500"}>
								{scorePercent >= 90 ? "Outstanding" : scorePercent >= 75 ? "Good" : scorePercent >= 60 ? "Acceptable" : scorePercent >= 40 ? "Marginal" : "Unacceptable"}
							</Badge>
						</div>
					</div>
					<Progress value={scorePercent} className="h-3" />
				</CardContent>
			</Card>

			{/* Statistics Grid */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-4 text-center">
						<p className="text-3xl font-bold">{report.statistics.totalComments}</p>
						<p className="text-sm text-muted-foreground">Total Comments</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<p className="text-3xl font-bold text-green-600">{report.statistics.resolvedCount}</p>
						<p className="text-sm text-muted-foreground">Resolved</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<p className="text-3xl font-bold text-amber-600">{report.statistics.openCount}</p>
						<p className="text-sm text-muted-foreground">Open</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<p className="text-3xl font-bold">{(report.statistics.resolutionRate * 100).toFixed(0)}%</p>
						<p className="text-sm text-muted-foreground">Resolution Rate</p>
					</CardContent>
				</Card>
			</div>

			{/* Key Findings */}
			<div className="grid md:grid-cols-2 gap-6">
				{/* Strengths */}
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base flex items-center gap-2 text-green-600">
							<ThumbsUp className="h-4 w-4" />
							Strengths ({report.keyFindings.strengths.length})
						</CardTitle>
					</CardHeader>
					<CardContent>
						<ul className="space-y-2">
							{report.keyFindings.strengths.map((strength, idx) => (
								<li key={idx} className="flex items-start gap-2 text-sm">
									<CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
									{strength}
								</li>
							))}
						</ul>
					</CardContent>
				</Card>

				{/* Weaknesses */}
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base flex items-center gap-2 text-red-600">
							<ThumbsDown className="h-4 w-4" />
							Weaknesses ({report.keyFindings.weaknesses.length})
						</CardTitle>
					</CardHeader>
					<CardContent>
						<ul className="space-y-2">
							{report.keyFindings.weaknesses.map((weakness, idx) => (
								<li key={idx} className="flex items-start gap-2 text-sm">
									<AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
									{weakness}
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			</div>

			{/* Critical Issues */}
			{report.keyFindings.criticalIssues.length > 0 && (
				<Card className="border-red-500/50">
					<CardHeader className="pb-3">
						<CardTitle className="text-base flex items-center gap-2 text-red-600">
							<AlertTriangle className="h-4 w-4" />
							Critical Issues ({report.keyFindings.criticalIssues.length})
						</CardTitle>
					</CardHeader>
					<CardContent>
						<ul className="space-y-2">
							{report.keyFindings.criticalIssues.map((issue, idx) => (
								<li key={idx} className="flex items-start gap-2 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
									<span className="font-medium text-red-700 dark:text-red-400">{idx + 1}.</span>
									{issue}
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			)}

			{/* Recommendations */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base flex items-center gap-2">
						<TrendingUp className="h-4 w-4" />
						Recommendations
					</CardTitle>
				</CardHeader>
				<CardContent>
					<ol className="space-y-2 list-decimal list-inside">
						{report.keyFindings.recommendations.map((rec, idx) => (
							<li key={idx} className="text-sm">{rec}</li>
						))}
					</ol>
				</CardContent>
			</Card>

			{/* Compliance Gaps */}
			{report.complianceGaps.length > 0 && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base flex items-center gap-2">
							<Target className="h-4 w-4" />
							Compliance Gaps ({report.complianceGaps.length})
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{report.complianceGaps.map((gap, idx) => (
								<div key={idx} className="p-3 bg-muted rounded-lg">
									<div className="flex items-center gap-2 mb-1">
										<Badge variant="outline" className="font-mono">{gap.criteriaRef}</Badge>
										<span className="font-medium">{gap.criteriaName}</span>
										<Badge variant={gap.severity === "critical" ? "destructive" : "secondary"}>
											{gap.severity}
										</Badge>
									</div>
									<p className="text-sm text-muted-foreground mb-2">{gap.gapDescription}</p>
									<p className="text-sm"><strong>Resolution:</strong> {gap.suggestedResolution}</p>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Reviewer Participation */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base flex items-center gap-2">
						<Users className="h-4 w-4" />
						Reviewer Participation
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						{report.reviewers.map((reviewer) => (
							<div key={reviewer.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
								<div>
									<p className="font-medium">{reviewer.name}</p>
									<p className="text-xs text-muted-foreground">{reviewer.role}</p>
								</div>
								<div className="flex items-center gap-4 text-sm">
									<span>{reviewer.commentsCount} comments</span>
									<span>{reviewer.scoresCount} scores</span>
									<Badge variant={reviewer.status === "completed" ? "default" : "secondary"}>
										{reviewer.status}
									</Badge>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Footer */}
			<div className="text-center text-sm text-muted-foreground py-4 border-t">
				Report generated on {new Date(report.generatedAt).toLocaleString()}
			</div>
		</div>
	);
}

export default ReviewReport;
