/**
 * DocumentAnalysisPanel Component - DocFusion
 *
 * Comprehensive document analysis display showing overall score,
 * category breakdown, factor details, and actionable issues.
 * Supports 30+ analysis factors across clarity, compliance,
 * persuasiveness, and technical quality categories.
 */

"use client";

import { useState, useMemo } from "react";
import type {
	DocumentAnalysis,
	CategoryScore,
	AnalysisFactor,
	AnalysisIssue,
	AnalysisSuggestion,
	AnalysisFactorCategory,
	IssueSeverity,
	SuggestionImpact,
} from "@/lib/types/opportunity";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

// ============================================================================
// Types & Constants
// ============================================================================

interface DocumentAnalysisPanelProps {
	analysis: DocumentAnalysis | null;
	isLoading?: boolean;
	onRefresh?: () => void;
	onApplySuggestion?: (suggestion: AnalysisSuggestion) => void;
	className?: string;
}

type ExpandedState = Record<string, boolean>;

const CATEGORY_CONFIG: Record<
	AnalysisFactorCategory,
	{ label: string; description: string; icon: string; color: string }
> = {
	clarity: {
		label: "Clarity & Readability",
		description: "How clear and easy to understand the document is",
		icon: "📖",
		color: "blue",
	},
	compliance: {
		label: "Compliance & Responsiveness",
		description: "How well the document addresses requirements",
		icon: "✅",
		color: "green",
	},
	persuasiveness: {
		label: "Persuasiveness & Strength",
		description: "How compelling and convincing the content is",
		icon: "💪",
		color: "purple",
	},
	technical: {
		label: "Technical Quality",
		description: "Technical accuracy and depth of content",
		icon: "⚙️",
		color: "amber",
	},
};

const SEVERITY_CONFIG: Record<
	IssueSeverity,
	{ label: string; color: string; bgColor: string; borderColor: string }
> = {
	critical: {
		label: "Critical",
		color: "text-red-700 dark:text-red-400",
		bgColor: "bg-red-50 dark:bg-red-950",
		borderColor: "border-red-200 dark:border-red-800",
	},
	error: {
		label: "Error",
		color: "text-orange-700 dark:text-orange-400",
		bgColor: "bg-orange-50 dark:bg-orange-950",
		borderColor: "border-orange-200 dark:border-orange-800",
	},
	warning: {
		label: "Warning",
		color: "text-yellow-700 dark:text-yellow-400",
		bgColor: "bg-yellow-50 dark:bg-yellow-950",
		borderColor: "border-yellow-200 dark:border-yellow-800",
	},
	info: {
		label: "Info",
		color: "text-blue-700 dark:text-blue-400",
		bgColor: "bg-blue-50 dark:bg-blue-950",
		borderColor: "border-blue-200 dark:border-blue-800",
	},
};

const IMPACT_CONFIG: Record<
	SuggestionImpact,
	{ label: string; color: string }
> = {
	high: { label: "High Impact", color: "text-green-600 dark:text-green-400" },
	medium: { label: "Medium Impact", color: "text-yellow-600 dark:text-yellow-400" },
	low: { label: "Low Impact", color: "text-gray-600 dark:text-gray-400" },
};

// ============================================================================
// Helper Functions
// ============================================================================

function getScoreColor(score: number): string {
	if (score >= 80) return "text-green-600 dark:text-green-400";
	if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
	if (score >= 40) return "text-orange-600 dark:text-orange-400";
	return "text-red-600 dark:text-red-400";
}

function getScoreGradient(score: number): string {
	if (score >= 80) return "from-green-500 to-emerald-500";
	if (score >= 60) return "from-yellow-500 to-amber-500";
	if (score >= 40) return "from-orange-500 to-amber-500";
	return "from-red-500 to-rose-500";
}

function getScoreLabel(score: number): string {
	if (score >= 90) return "Excellent";
	if (score >= 80) return "Good";
	if (score >= 70) return "Above Average";
	if (score >= 60) return "Average";
	if (score >= 50) return "Below Average";
	if (score >= 40) return "Needs Work";
	return "Poor";
}

function formatDate(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(date));
}

// ============================================================================
// Main Component
// ============================================================================

export function DocumentAnalysisPanel({
	analysis,
	isLoading = false,
	onRefresh,
	onApplySuggestion,
	className,
}: DocumentAnalysisPanelProps) {
	const [expandedCategories, setExpandedCategories] = useState<ExpandedState>({});
	const [expandedFactors, setExpandedFactors] = useState<ExpandedState>({});
	const [activeTab, setActiveTab] = useState<"overview" | "issues" | "suggestions">("overview");
	const [severityFilter, setSeverityFilter] = useState<IssueSeverity | "all">("all");

	// Sort issues by severity (critical first)
	const sortedIssues = useMemo(() => {
		if (!analysis) return [];
		const severityOrder: Record<IssueSeverity, number> = {
			critical: 0,
			error: 1,
			warning: 2,
			info: 3,
		};
		const filtered = severityFilter === "all"
			? analysis.issues
			: analysis.issues.filter((i) => i.severity === severityFilter);
		return [...filtered].sort(
			(a, b) => severityOrder[a.severity] - severityOrder[b.severity]
		);
	}, [analysis, severityFilter]);

	// Sort suggestions by impact (high first)
	const sortedSuggestions = useMemo(() => {
		if (!analysis) return [];
		const impactOrder: Record<SuggestionImpact, number> = {
			high: 0,
			medium: 1,
			low: 2,
		};
		return [...analysis.suggestions].sort(
			(a, b) => impactOrder[a.impact] - impactOrder[b.impact]
		);
	}, [analysis]);

	// Group factors by category
	const factorsByCategory = useMemo((): Partial<Record<AnalysisFactorCategory, AnalysisFactor[]>> => {
		if (!analysis) return {};
		return analysis.factors.reduce((acc, factor) => {
			if (!acc[factor.category]) acc[factor.category] = [];
			acc[factor.category]!.push(factor);
			return acc;
		}, {} as Partial<Record<AnalysisFactorCategory, AnalysisFactor[]>>);
	}, [analysis]);

	// Issue counts by severity
	const issueCounts = useMemo(() => {
		if (!analysis) return { critical: 0, error: 0, warning: 0, info: 0 };
		return analysis.issues.reduce(
			(acc, issue) => {
				acc[issue.severity]++;
				return acc;
			},
			{ critical: 0, error: 0, warning: 0, info: 0 }
		);
	}, [analysis]);

	const toggleCategory = (category: string) => {
		setExpandedCategories((prev) => ({
			...prev,
			[category]: !prev[category],
		}));
	};

	const toggleFactor = (factorId: string) => {
		setExpandedFactors((prev) => ({
			...prev,
			[factorId]: !prev[factorId],
		}));
	};

	// Loading state
	if (isLoading) {
		return (
			<div className={cn("bg-[var(--background)] rounded-lg border border-[var(--border)] p-6", className)}>
				<div className="animate-pulse space-y-6">
					<div className="flex items-center gap-4">
						<div className="w-24 h-24 rounded-full bg-[var(--background-muted)]" />
						<div className="flex-1 space-y-2">
							<div className="h-6 w-32 bg-[var(--background-muted)] rounded" />
							<div className="h-4 w-48 bg-[var(--background-muted)] rounded" />
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4">
						{[1, 2, 3, 4].map((i) => (
							<div key={i} className="h-20 bg-[var(--background-muted)] rounded-lg" />
						))}
					</div>
				</div>
			</div>
		);
	}

	// No analysis state
	if (!analysis) {
		return (
			<div className={cn("bg-[var(--background)] rounded-lg border border-[var(--border)] p-8 text-center", className)}>
				<div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--background-muted)] mb-4">
					<AnalysisIcon className="h-8 w-8 text-[var(--foreground-muted)]" />
				</div>
				<h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
					No Analysis Available
				</h3>
				<p className="text-sm text-[var(--foreground-muted)] mb-4">
					Run an analysis to see quality scores and improvement suggestions.
				</p>
				{onRefresh && (
					<Button variant="primary" onClick={onRefresh}>
						<RefreshIcon className="h-4 w-4 mr-2" />
						Analyze Document
					</Button>
				)}
			</div>
		);
	}

	return (
		<div className={cn("bg-[var(--background)] rounded-lg border border-[var(--border)]", className)}>
			{/* Header with Overall Score */}
			<div className="p-6 border-b border-[var(--border)]">
				<div className="flex items-start gap-6">
					{/* Score Gauge */}
					<ScoreGauge score={analysis.overallScore} size="lg" />

					{/* Score Info */}
					<div className="flex-1 min-w-0">
						<div className="flex items-center justify-between mb-2">
							<h3 className="text-lg font-semibold text-[var(--foreground)]">
								Document Quality Score
							</h3>
							{onRefresh && (
								<Button variant="ghost" size="sm" onClick={onRefresh}>
									<RefreshIcon className="h-4 w-4" />
								</Button>
							)}
						</div>
						<p className={cn("text-2xl font-bold", getScoreColor(analysis.overallScore))}>
							{getScoreLabel(analysis.overallScore)}
						</p>
						<div className="flex items-center gap-4 mt-2 text-sm text-[var(--foreground-muted)]">
							<span>{analysis.wordCount.toLocaleString()} words</span>
							<span>•</span>
							<span>{analysis.paragraphCount} paragraphs</span>
							<span>•</span>
							<span>Analyzed {formatDate(analysis.analyzedAt)}</span>
						</div>
					</div>
				</div>

				{/* Issue Summary Pills */}
				<div className="flex flex-wrap gap-2 mt-4">
					{issueCounts.critical > 0 && (
						<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
							{issueCounts.critical} Critical
						</span>
					)}
					{issueCounts.error > 0 && (
						<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
							{issueCounts.error} Errors
						</span>
					)}
					{issueCounts.warning > 0 && (
						<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
							{issueCounts.warning} Warnings
						</span>
					)}
					{issueCounts.info > 0 && (
						<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
							{issueCounts.info} Info
						</span>
					)}
					{analysis.issues.length === 0 && (
						<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
							<CheckIcon className="h-3 w-3" />
							No Issues Found
						</span>
					)}
				</div>
			</div>

			{/* Tab Navigation */}
			<div className="border-b border-[var(--border)]">
				<div className="flex">
					{(["overview", "issues", "suggestions"] as const).map((tab) => (
						<button
							key={tab}
							onClick={() => setActiveTab(tab)}
							className={cn(
								"px-4 py-3 text-sm font-medium border-b-2 transition-colors",
								activeTab === tab
									? "border-[var(--accent-500)] text-[var(--foreground)]"
									: "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border)]"
							)}
						>
							{tab === "overview" && "Overview"}
							{tab === "issues" && `Issues (${analysis.issues.length})`}
							{tab === "suggestions" && `Suggestions (${analysis.suggestions.length})`}
						</button>
					))}
				</div>
			</div>

			{/* Tab Content */}
			<div className="p-6">
				{/* Overview Tab */}
				{activeTab === "overview" && (
					<div className="space-y-6">
						{/* Category Scores Grid */}
						<div className="grid grid-cols-2 gap-4">
							{analysis.categoryScores.map((categoryScore) => {
								const config = CATEGORY_CONFIG[categoryScore.category];
								return (
									<CategoryScoreCard
										key={categoryScore.category}
										categoryScore={categoryScore}
										config={config}
										factors={factorsByCategory[categoryScore.category] || []}
										isExpanded={expandedCategories[categoryScore.category] || false}
										onToggle={() => toggleCategory(categoryScore.category)}
										expandedFactors={expandedFactors}
										onToggleFactor={toggleFactor}
									/>
								);
							})}
						</div>
					</div>
				)}

				{/* Issues Tab */}
				{activeTab === "issues" && (
					<div className="space-y-4">
						{/* Severity Filter */}
						<div className="flex items-center gap-2 mb-4">
							<span className="text-sm text-[var(--foreground-muted)]">Filter:</span>
							<div className="flex gap-1">
								{(["all", "critical", "error", "warning", "info"] as const).map((severity) => (
									<button
										key={severity}
										onClick={() => setSeverityFilter(severity)}
										className={cn(
											"px-3 py-1 text-xs font-medium rounded-full transition-colors",
											severityFilter === severity
												? severity === "all"
													? "bg-[var(--foreground)] text-[var(--background)]"
													: cn(SEVERITY_CONFIG[severity as IssueSeverity].bgColor, SEVERITY_CONFIG[severity as IssueSeverity].color)
												: "bg-[var(--background-muted)] text-[var(--foreground-muted)] hover:bg-[var(--border)]"
										)}
									>
										{severity === "all" ? "All" : SEVERITY_CONFIG[severity].label}
										{severity !== "all" && ` (${issueCounts[severity]})`}
									</button>
								))}
							</div>
						</div>

						{/* Issues List */}
						{sortedIssues.length === 0 ? (
							<div className="text-center py-8">
								<CheckIcon className="h-12 w-12 text-green-500 mx-auto mb-3" />
								<p className="text-[var(--foreground-muted)]">
									{severityFilter === "all"
										? "No issues found in this document!"
										: `No ${SEVERITY_CONFIG[severityFilter as IssueSeverity].label.toLowerCase()} issues found.`}
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{sortedIssues.map((issue) => (
									<IssueCard key={issue.id} issue={issue} />
								))}
							</div>
						)}
					</div>
				)}

				{/* Suggestions Tab */}
				{activeTab === "suggestions" && (
					<div className="space-y-4">
						{sortedSuggestions.length === 0 ? (
							<div className="text-center py-8">
								<SparkleIcon className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
								<p className="text-[var(--foreground-muted)]">
									No suggestions available. The document looks great!
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{sortedSuggestions.map((suggestion) => (
									<SuggestionCard
										key={suggestion.id}
										suggestion={suggestion}
										onApply={onApplySuggestion}
									/>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ScoreGaugeProps {
	score: number;
	size?: "sm" | "md" | "lg";
	showLabel?: boolean;
}

function ScoreGauge({ score, size = "md", showLabel = true }: ScoreGaugeProps) {
	const sizeClasses = {
		sm: "w-14 h-14",
		md: "w-20 h-20",
		lg: "w-24 h-24",
	};
	const textClasses = {
		sm: "text-lg",
		md: "text-2xl",
		lg: "text-3xl",
	};
	const strokeWidth = size === "lg" ? 6 : size === "md" ? 5 : 4;
	const radius = size === "lg" ? 42 : size === "md" ? 35 : 25;
	const circumference = 2 * Math.PI * radius;
	const strokeDashoffset = circumference - (score / 100) * circumference;

	return (
		<div className={cn("relative flex-shrink-0", sizeClasses[size])}>
			<svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
				{/* Background circle */}
				<circle
					cx="50"
					cy="50"
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					className="text-[var(--background-muted)]"
				/>
				{/* Progress circle */}
				<circle
					cx="50"
					cy="50"
					r={radius}
					fill="none"
					stroke="url(#scoreGradient)"
					strokeWidth={strokeWidth}
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={strokeDashoffset}
					className="transition-all duration-700 ease-out"
				/>
				{/* Gradient definition */}
				<defs>
					<linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop
							offset="0%"
							className={cn(
								score >= 80 ? "text-green-500" :
								score >= 60 ? "text-yellow-500" :
								score >= 40 ? "text-orange-500" :
								"text-red-500"
							)}
							stopColor="currentColor"
						/>
						<stop
							offset="100%"
							className={cn(
								score >= 80 ? "text-emerald-500" :
								score >= 60 ? "text-amber-500" :
								score >= 40 ? "text-amber-500" :
								"text-rose-500"
							)}
							stopColor="currentColor"
						/>
					</linearGradient>
				</defs>
			</svg>
			{/* Score number */}
			<div className="absolute inset-0 flex items-center justify-center">
				<span className={cn("font-bold", textClasses[size], getScoreColor(score))}>
					{Math.round(score)}
				</span>
			</div>
		</div>
	);
}

interface CategoryScoreCardProps {
	categoryScore: CategoryScore;
	config: { label: string; description: string; icon: string; color: string };
	factors: AnalysisFactor[];
	isExpanded: boolean;
	onToggle: () => void;
	expandedFactors: ExpandedState;
	onToggleFactor: (factorId: string) => void;
}

function CategoryScoreCard({
	categoryScore,
	config,
	factors,
	isExpanded,
	onToggle,
	expandedFactors,
	onToggleFactor,
}: CategoryScoreCardProps) {
	return (
		<div className="border border-[var(--border)] rounded-lg overflow-hidden">
			{/* Card Header */}
			<button
				onClick={onToggle}
				className="w-full p-4 flex items-center gap-3 hover:bg-[var(--background-muted)] transition-colors text-left"
			>
				<span className="text-2xl">{config.icon}</span>
				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between">
						<h4 className="text-sm font-medium text-[var(--foreground)]">
							{config.label}
						</h4>
						<span className={cn("text-lg font-bold", getScoreColor(categoryScore.score))}>
							{Math.round(categoryScore.score)}
						</span>
					</div>
					<div className="flex items-center gap-2 mt-1">
						<div className="flex-1 h-1.5 bg-[var(--background-muted)] rounded-full overflow-hidden">
							<div
								className={cn("h-full rounded-full bg-gradient-to-r", getScoreGradient(categoryScore.score))}
								style={{ width: `${categoryScore.score}%` }}
							/>
						</div>
						<span className="text-xs text-[var(--foreground-muted)]">
							{categoryScore.factorCount} factors
						</span>
					</div>
				</div>
				<ChevronIcon
					className={cn(
						"h-5 w-5 text-[var(--foreground-muted)] transition-transform",
						isExpanded && "rotate-180"
					)}
				/>
			</button>

			{/* Expanded Factors */}
			{isExpanded && factors.length > 0 && (
				<div className="border-t border-[var(--border)] bg-[var(--background-muted)] p-3 space-y-2">
					{factors.map((factor) => (
						<FactorRow
							key={factor.id}
							factor={factor}
							isExpanded={expandedFactors[factor.id] || false}
							onToggle={() => onToggleFactor(factor.id)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

interface FactorRowProps {
	factor: AnalysisFactor;
	isExpanded: boolean;
	onToggle: () => void;
}

function FactorRow({ factor, isExpanded, onToggle }: FactorRowProps) {
	return (
		<div className="bg-[var(--background)] rounded-lg border border-[var(--border)] overflow-hidden">
			<button
				onClick={onToggle}
				className="w-full p-3 flex items-center gap-3 hover:bg-[var(--background-muted)] transition-colors text-left"
			>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium text-[var(--foreground)]">
							{factor.name}
						</span>
						{factor.issues.length > 0 && (
							<span className="text-xs px-1.5 py-0.5 rounded bg-[var(--background-muted)] text-[var(--foreground-muted)]">
								{factor.issues.length} issues
							</span>
						)}
					</div>
					<p className="text-xs text-[var(--foreground-muted)] mt-0.5 line-clamp-1">
						{factor.description}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<span className={cn("text-sm font-semibold", getScoreColor(factor.score))}>
						{Math.round(factor.score)}
					</span>
					<ChevronIcon
						className={cn(
							"h-4 w-4 text-[var(--foreground-muted)] transition-transform",
							isExpanded && "rotate-180"
						)}
					/>
				</div>
			</button>

			{/* Expanded Factor Details */}
			{isExpanded && (
				<div className="px-3 pb-3 space-y-2">
					{/* Factor Issues */}
					{factor.issues.length > 0 && (
						<div className="space-y-1.5">
							{factor.issues.map((issue) => (
								<div
									key={issue.id}
									className={cn(
										"p-2 rounded text-xs",
										SEVERITY_CONFIG[issue.severity].bgColor,
										SEVERITY_CONFIG[issue.severity].borderColor,
										"border"
									)}
								>
									<span className={cn("font-medium", SEVERITY_CONFIG[issue.severity].color)}>
										{SEVERITY_CONFIG[issue.severity].label}:
									</span>{" "}
									<span className="text-[var(--foreground)]">{issue.message}</span>
								</div>
							))}
						</div>
					)}

					{/* Factor Suggestions */}
					{factor.suggestions.length > 0 && (
						<div className="space-y-1.5">
							{factor.suggestions.map((suggestion) => (
								<div
									key={suggestion.id}
									className="p-2 rounded text-xs bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800"
								>
									<span className="font-medium text-green-700 dark:text-green-400">
										Suggestion:
									</span>{" "}
									<span className="text-[var(--foreground)]">{suggestion.text}</span>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

interface IssueCardProps {
	issue: AnalysisIssue;
}

function IssueCard({ issue }: IssueCardProps) {
	const config = SEVERITY_CONFIG[issue.severity];

	return (
		<div className={cn("p-4 rounded-lg border", config.bgColor, config.borderColor)}>
			<div className="flex items-start gap-3">
				<SeverityIcon severity={issue.severity} className="h-5 w-5 flex-shrink-0 mt-0.5" />
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className={cn("text-xs font-semibold uppercase", config.color)}>
							{config.label}
						</span>
						{issue.location?.text && (
							<span className="text-xs text-[var(--foreground-muted)]">
								in "{issue.location.text.slice(0, 30)}..."
							</span>
						)}
					</div>
					<p className="text-sm text-[var(--foreground)]">{issue.message}</p>
					{issue.suggestion && (
						<p className="text-xs text-[var(--foreground-muted)] mt-2 italic">
							💡 {issue.suggestion}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

interface SuggestionCardProps {
	suggestion: AnalysisSuggestion;
	onApply?: (suggestion: AnalysisSuggestion) => void;
}

function SuggestionCard({ suggestion, onApply }: SuggestionCardProps) {
	const impactConfig = IMPACT_CONFIG[suggestion.impact];
	const typeLabels: Record<string, string> = {
		rewrite: "Rewrite",
		add: "Add",
		remove: "Remove",
		restructure: "Restructure",
		clarify: "Clarify",
	};

	return (
		<div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--background)]">
			<div className="flex items-start gap-3">
				<div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent-100)] dark:bg-[var(--accent-900)] flex items-center justify-center">
					<SparkleIcon className="h-4 w-4 text-[var(--accent-500)]" />
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--background-muted)] text-[var(--foreground-muted)]">
							{typeLabels[suggestion.type] || suggestion.type}
						</span>
						<span className={cn("text-xs font-medium", impactConfig.color)}>
							{impactConfig.label}
						</span>
					</div>
					<p className="text-sm text-[var(--foreground)]">{suggestion.text}</p>
					{suggestion.replacement && (
						<div className="mt-2 p-2 rounded bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
							<p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
								Suggested replacement:
							</p>
							<p className="text-xs text-[var(--foreground)] font-mono">
								{suggestion.replacement}
							</p>
						</div>
					)}
					{onApply && suggestion.replacement && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onApply(suggestion)}
							className="mt-2"
						>
							Apply Suggestion
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Icons
// ============================================================================

function AnalysisIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
			/>
		</svg>
	);
}

function RefreshIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
			/>
		</svg>
	);
}

function CheckIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
		</svg>
	);
}

function ChevronIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
		</svg>
	);
}

function SparkleIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
			/>
		</svg>
	);
}

function SeverityIcon({ severity, className }: { severity: IssueSeverity; className?: string }) {
	const config = SEVERITY_CONFIG[severity];

	if (severity === "critical" || severity === "error") {
		return (
			<svg className={cn(className, config.color)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
		);
	}

	if (severity === "warning") {
		return (
			<svg className={cn(className, config.color)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		);
	}

	return (
		<svg className={cn(className, config.color)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
	);
}
