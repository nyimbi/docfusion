/**
 * AnalysisSidebar Component - DocFusion
 *
 * Real-time document analysis sidebar for use alongside the editor.
 * Provides quick issue navigation, live score updates, and
 * actionable suggestion cards with apply/dismiss functionality.
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type {
	DocumentAnalysis,
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

interface AnalysisSidebarProps {
	analysis: DocumentAnalysis | null;
	isAnalyzing?: boolean;
	/** Called when user wants to re-run analysis */
	onAnalyze?: () => void;
	/** Called when user clicks an issue to navigate */
	onIssueClick?: (issue: AnalysisIssue) => void;
	/** Called when user wants to apply a suggestion */
	onApplySuggestion?: (suggestion: AnalysisSuggestion) => void;
	/** Called when user dismisses a suggestion */
	onDismissSuggestion?: (suggestionId: string) => void;
	/** IDs of dismissed suggestions */
	dismissedSuggestionIds?: Set<string>;
	className?: string;
}

type TabType = "score" | "issues" | "suggestions";

const SEVERITY_CONFIG: Record<
	IssueSeverity,
	{ label: string; shortLabel: string; color: string; bgColor: string; borderColor: string }
> = {
	critical: {
		label: "Critical",
		shortLabel: "CRIT",
		color: "text-red-700 dark:text-red-400",
		bgColor: "bg-red-50 dark:bg-red-950",
		borderColor: "border-red-200 dark:border-red-800",
	},
	error: {
		label: "Error",
		shortLabel: "ERR",
		color: "text-orange-700 dark:text-orange-400",
		bgColor: "bg-orange-50 dark:bg-orange-950",
		borderColor: "border-orange-200 dark:border-orange-800",
	},
	warning: {
		label: "Warning",
		shortLabel: "WARN",
		color: "text-yellow-700 dark:text-yellow-400",
		bgColor: "bg-yellow-50 dark:bg-yellow-950",
		borderColor: "border-yellow-200 dark:border-yellow-800",
	},
	info: {
		label: "Info",
		shortLabel: "INFO",
		color: "text-blue-700 dark:text-blue-400",
		bgColor: "bg-blue-50 dark:bg-blue-950",
		borderColor: "border-blue-200 dark:border-blue-800",
	},
};

const IMPACT_CONFIG: Record<SuggestionImpact, { label: string; color: string; priority: number }> = {
	high: { label: "High Impact", color: "text-green-600 dark:text-green-400", priority: 0 },
	medium: { label: "Medium Impact", color: "text-yellow-600 dark:text-yellow-400", priority: 1 },
	low: { label: "Low Impact", color: "text-gray-600 dark:text-gray-400", priority: 2 },
};

const CATEGORY_LABELS: Record<AnalysisFactorCategory, string> = {
	clarity: "Clarity",
	compliance: "Compliance",
	persuasiveness: "Persuasiveness",
	technical: "Technical",
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

function getScoreLabel(score: number): string {
	if (score >= 90) return "Excellent";
	if (score >= 80) return "Good";
	if (score >= 70) return "Above Average";
	if (score >= 60) return "Average";
	if (score >= 50) return "Below Average";
	if (score >= 40) return "Needs Work";
	return "Poor";
}

function getProgressBarColor(score: number): string {
	if (score >= 80) return "bg-green-500";
	if (score >= 60) return "bg-yellow-500";
	if (score >= 40) return "bg-orange-500";
	return "bg-red-500";
}

// ============================================================================
// Main Component
// ============================================================================

export function AnalysisSidebar({
	analysis,
	isAnalyzing = false,
	onAnalyze,
	onIssueClick,
	onApplySuggestion,
	onDismissSuggestion,
	dismissedSuggestionIds = new Set(),
	className,
}: AnalysisSidebarProps) {
	const [activeTab, setActiveTab] = useState<TabType>("score");
	const [categoryFilter, setCategoryFilter] = useState<AnalysisFactorCategory | "all">("all");
	const [severityFilter, setSeverityFilter] = useState<IssueSeverity | "all">("all");

	// Auto-switch to issues tab if there are critical issues
	useEffect(() => {
		if (analysis && analysis.issues.some((i) => i.severity === "critical")) {
			setActiveTab("issues");
		}
	}, [analysis]);

	// Filter and sort issues
	const filteredIssues = useMemo(() => {
		if (!analysis) return [];

		let issues = [...analysis.issues];

		// Filter by severity
		if (severityFilter !== "all") {
			issues = issues.filter((i) => i.severity === severityFilter);
		}

		// Sort by severity (critical first)
		const severityOrder: Record<IssueSeverity, number> = {
			critical: 0,
			error: 1,
			warning: 2,
			info: 3,
		};
		issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

		return issues;
	}, [analysis, severityFilter]);

	// Filter and sort suggestions (excluding dismissed)
	const filteredSuggestions = useMemo(() => {
		if (!analysis) return [];

		let suggestions = analysis.suggestions.filter(
			(s) => !dismissedSuggestionIds.has(s.id)
		);

		// Sort by impact (high first)
		suggestions.sort((a, b) => IMPACT_CONFIG[a.impact].priority - IMPACT_CONFIG[b.impact].priority);

		return suggestions;
	}, [analysis, dismissedSuggestionIds]);

	// Issue counts by severity
	const issueCounts = useMemo(() => {
		if (!analysis) return { critical: 0, error: 0, warning: 0, info: 0, total: 0 };
		const counts = analysis.issues.reduce(
			(acc, issue) => {
				acc[issue.severity]++;
				acc.total++;
				return acc;
			},
			{ critical: 0, error: 0, warning: 0, info: 0, total: 0 }
		);
		return counts;
	}, [analysis]);

	// Render empty/loading state
	if (!analysis && !isAnalyzing) {
		return (
			<div className={cn("bg-[var(--background)] border-l border-[var(--border)] p-4", className)}>
				<div className="text-center py-8">
					<AnalysisIcon className="h-10 w-10 text-[var(--foreground-muted)] mx-auto mb-3" />
					<p className="text-sm text-[var(--foreground-muted)] mb-4">
						No analysis available
					</p>
					{onAnalyze && (
						<Button variant="primary" size="sm" onClick={onAnalyze}>
							Analyze Document
						</Button>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className={cn("bg-[var(--background)] border-l border-[var(--border)] flex flex-col h-full", className)}>
			{/* Header */}
			<div className="p-3 border-b border-[var(--border)]">
				<div className="flex items-center justify-between mb-2">
					<h3 className="text-sm font-semibold text-[var(--foreground)]">
						Analysis
					</h3>
					{onAnalyze && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onAnalyze}
							disabled={isAnalyzing}
							className="h-7 px-2"
						>
							{isAnalyzing ? (
								<LoadingSpinner className="h-3.5 w-3.5" />
							) : (
								<RefreshIcon className="h-3.5 w-3.5" />
							)}
						</Button>
					)}
				</div>

				{/* Quick Score */}
				{analysis && !isAnalyzing && (
					<div className="flex items-center gap-3">
						<div className={cn("text-2xl font-bold", getScoreColor(analysis.overallScore))}>
							{Math.round(analysis.overallScore)}
						</div>
						<div className="flex-1">
							<div className="text-xs text-[var(--foreground-muted)]">
								{getScoreLabel(analysis.overallScore)}
							</div>
							<div className="h-1.5 bg-[var(--background-muted)] rounded-full overflow-hidden mt-1">
								<div
									className={cn("h-full rounded-full transition-all", getProgressBarColor(analysis.overallScore))}
									style={{ width: `${analysis.overallScore}%` }}
								/>
							</div>
						</div>
					</div>
				)}

				{isAnalyzing && (
					<div className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
						<LoadingSpinner className="h-4 w-4" />
						<span>Analyzing document...</span>
					</div>
				)}
			</div>

			{/* Tabs */}
			{analysis && (
				<div className="flex border-b border-[var(--border)]">
					<TabButton
						active={activeTab === "score"}
						onClick={() => setActiveTab("score")}
						label="Score"
					/>
					<TabButton
						active={activeTab === "issues"}
						onClick={() => setActiveTab("issues")}
						label="Issues"
						badge={issueCounts.total}
						badgeColor={issueCounts.critical > 0 ? "red" : issueCounts.error > 0 ? "orange" : undefined}
					/>
					<TabButton
						active={activeTab === "suggestions"}
						onClick={() => setActiveTab("suggestions")}
						label="Tips"
						badge={filteredSuggestions.length}
						badgeColor="green"
					/>
				</div>
			)}

			{/* Tab Content */}
			<div className="flex-1 overflow-y-auto">
				{analysis && activeTab === "score" && (
					<ScoreTab analysis={analysis} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} />
				)}

				{analysis && activeTab === "issues" && (
					<IssuesTab
						issues={filteredIssues}
						issueCounts={issueCounts}
						severityFilter={severityFilter}
						setSeverityFilter={setSeverityFilter}
						onIssueClick={onIssueClick}
					/>
				)}

				{analysis && activeTab === "suggestions" && (
					<SuggestionsTab
						suggestions={filteredSuggestions}
						onApply={onApplySuggestion}
						onDismiss={onDismissSuggestion}
					/>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

interface TabButtonProps {
	active: boolean;
	onClick: () => void;
	label: string;
	badge?: number;
	badgeColor?: "red" | "orange" | "green";
}

function TabButton({ active, onClick, label, badge, badgeColor }: TabButtonProps) {
	return (
		<button
			onClick={onClick}
			className={cn(
				"flex-1 px-3 py-2 text-xs font-medium transition-colors relative",
				active
					? "text-[var(--foreground)] bg-[var(--background-muted)]"
					: "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
			)}
		>
			{label}
			{badge !== undefined && badge > 0 && (
				<span
					className={cn(
						"ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full",
						badgeColor === "red"
							? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
							: badgeColor === "orange"
							? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
							: badgeColor === "green"
							? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
							: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
					)}
				>
					{badge > 99 ? "99+" : badge}
				</span>
			)}
		</button>
	);
}

interface ScoreTabProps {
	analysis: DocumentAnalysis;
	categoryFilter: AnalysisFactorCategory | "all";
	setCategoryFilter: (filter: AnalysisFactorCategory | "all") => void;
}

function ScoreTab({ analysis, categoryFilter, setCategoryFilter }: ScoreTabProps) {
	return (
		<div className="p-3 space-y-4">
			{/* Category Scores */}
			<div>
				<div className="text-xs font-semibold text-[var(--foreground)] mb-2">
					Category Scores
				</div>
				<div className="space-y-2">
					{analysis.categoryScores.map((cat) => (
						<button
							key={cat.category}
							onClick={() => setCategoryFilter(categoryFilter === cat.category ? "all" : cat.category)}
							className={cn(
								"w-full p-2 rounded-lg text-left transition-colors",
								categoryFilter === cat.category
									? "bg-[var(--accent-100)] dark:bg-[var(--accent-900)] border border-[var(--accent-300)]"
									: "bg-[var(--background-muted)] hover:bg-[var(--border)]"
							)}
						>
							<div className="flex items-center justify-between mb-1">
								<span className="text-xs font-medium text-[var(--foreground)]">
									{CATEGORY_LABELS[cat.category]}
								</span>
								<span className={cn("text-sm font-bold", getScoreColor(cat.score))}>
									{Math.round(cat.score)}
								</span>
							</div>
							<div className="h-1 bg-[var(--background)] rounded-full overflow-hidden">
								<div
									className={cn("h-full rounded-full", getProgressBarColor(cat.score))}
									style={{ width: `${cat.score}%` }}
								/>
							</div>
							{cat.issueCount > 0 && (
								<div className="text-[10px] text-[var(--foreground-muted)] mt-1">
									{cat.issueCount} issue{cat.issueCount !== 1 ? "s" : ""}
								</div>
							)}
						</button>
					))}
				</div>
			</div>

			{/* Factor Details (if category selected) */}
			{categoryFilter !== "all" && (
				<div>
					<div className="text-xs font-semibold text-[var(--foreground)] mb-2">
						{CATEGORY_LABELS[categoryFilter]} Factors
					</div>
					<div className="space-y-1.5">
						{analysis.factors
							.filter((f) => f.category === categoryFilter)
							.sort((a, b) => a.score - b.score)
							.map((factor) => (
								<div
									key={factor.id}
									className="p-2 bg-[var(--background-muted)] rounded text-xs"
								>
									<div className="flex items-center justify-between">
										<span className="text-[var(--foreground)] font-medium truncate pr-2">
											{factor.name}
										</span>
										<span className={cn("font-bold flex-shrink-0", getScoreColor(factor.score))}>
											{Math.round(factor.score)}
										</span>
									</div>
									{factor.issues.length > 0 && (
										<div className="text-[10px] text-orange-600 dark:text-orange-400 mt-0.5">
											{factor.issues.length} issue{factor.issues.length !== 1 ? "s" : ""}
										</div>
									)}
								</div>
							))}
					</div>
				</div>
			)}

			{/* Document Stats */}
			<div>
				<div className="text-xs font-semibold text-[var(--foreground)] mb-2">
					Document Stats
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="p-2 bg-[var(--background-muted)] rounded text-center">
						<div className="text-lg font-bold text-[var(--foreground)]">
							{analysis.wordCount.toLocaleString()}
						</div>
						<div className="text-[10px] text-[var(--foreground-muted)]">Words</div>
					</div>
					<div className="p-2 bg-[var(--background-muted)] rounded text-center">
						<div className="text-lg font-bold text-[var(--foreground)]">
							{analysis.paragraphCount}
						</div>
						<div className="text-[10px] text-[var(--foreground-muted)]">Paragraphs</div>
					</div>
				</div>
			</div>
		</div>
	);
}

interface IssuesTabProps {
	issues: AnalysisIssue[];
	issueCounts: Record<IssueSeverity | "total", number>;
	severityFilter: IssueSeverity | "all";
	setSeverityFilter: (filter: IssueSeverity | "all") => void;
	onIssueClick?: (issue: AnalysisIssue) => void;
}

function IssuesTab({
	issues,
	issueCounts,
	severityFilter,
	setSeverityFilter,
	onIssueClick,
}: IssuesTabProps) {
	return (
		<div className="p-3 space-y-3">
			{/* Severity Filter */}
			<div className="flex flex-wrap gap-1">
				<FilterPill
					active={severityFilter === "all"}
					onClick={() => setSeverityFilter("all")}
					label="All"
					count={issueCounts.total}
				/>
				{(["critical", "error", "warning", "info"] as const).map((severity) =>
					issueCounts[severity] > 0 ? (
						<FilterPill
							key={severity}
							active={severityFilter === severity}
							onClick={() => setSeverityFilter(severity)}
							label={SEVERITY_CONFIG[severity].shortLabel}
							count={issueCounts[severity]}
							color={severity === "critical" || severity === "error" ? "red" : severity === "warning" ? "yellow" : "blue"}
						/>
					) : null
				)}
			</div>

			{/* Issues List */}
			{issues.length === 0 ? (
				<div className="text-center py-6">
					<CheckIcon className="h-8 w-8 text-green-500 mx-auto mb-2" />
					<p className="text-xs text-[var(--foreground-muted)]">
						{severityFilter === "all"
							? "No issues found!"
							: `No ${SEVERITY_CONFIG[severityFilter].label.toLowerCase()} issues`}
					</p>
				</div>
			) : (
				<div className="space-y-2">
					{issues.map((issue) => (
						<IssueCard
							key={issue.id}
							issue={issue}
							onClick={onIssueClick ? () => onIssueClick(issue) : undefined}
						/>
					))}
				</div>
			)}
		</div>
	);
}

interface FilterPillProps {
	active: boolean;
	onClick: () => void;
	label: string;
	count: number;
	color?: "red" | "yellow" | "blue";
}

function FilterPill({ active, onClick, label, count, color }: FilterPillProps) {
	return (
		<button
			onClick={onClick}
			className={cn(
				"px-2 py-1 text-[10px] font-medium rounded-full transition-colors",
				active
					? color === "red"
						? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
						: color === "yellow"
						? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
						: color === "blue"
						? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
						: "bg-[var(--foreground)] text-[var(--background)]"
					: "bg-[var(--background-muted)] text-[var(--foreground-muted)] hover:bg-[var(--border)]"
			)}
		>
			{label} ({count})
		</button>
	);
}

interface IssueCardProps {
	issue: AnalysisIssue;
	onClick?: () => void;
}

function IssueCard({ issue, onClick }: IssueCardProps) {
	const config = SEVERITY_CONFIG[issue.severity];

	return (
		<button
			onClick={onClick}
			disabled={!onClick}
			className={cn(
				"w-full text-left p-2 rounded-lg border transition-colors",
				config.bgColor,
				config.borderColor,
				onClick && "hover:shadow-sm cursor-pointer",
				!onClick && "cursor-default"
			)}
		>
			<div className="flex items-start gap-2">
				<span className={cn("text-[10px] font-bold uppercase flex-shrink-0", config.color)}>
					{config.shortLabel}
				</span>
				<div className="flex-1 min-w-0">
					<p className="text-xs text-[var(--foreground)] line-clamp-2">
						{issue.message}
					</p>
					{issue.location?.text && (
						<p className="text-[10px] text-[var(--foreground-muted)] mt-1 truncate italic">
							"{issue.location.text.slice(0, 50)}..."
						</p>
					)}
				</div>
				{onClick && (
					<ChevronRightIcon className="h-3.5 w-3.5 text-[var(--foreground-muted)] flex-shrink-0" />
				)}
			</div>
		</button>
	);
}

interface SuggestionsTabProps {
	suggestions: AnalysisSuggestion[];
	onApply?: (suggestion: AnalysisSuggestion) => void;
	onDismiss?: (suggestionId: string) => void;
}

function SuggestionsTab({ suggestions, onApply, onDismiss }: SuggestionsTabProps) {
	if (suggestions.length === 0) {
		return (
			<div className="p-3 text-center py-6">
				<SparkleIcon className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
				<p className="text-xs text-[var(--foreground-muted)]">
					No suggestions available
				</p>
			</div>
		);
	}

	return (
		<div className="p-3 space-y-2">
			{suggestions.map((suggestion) => (
				<SuggestionCard
					key={suggestion.id}
					suggestion={suggestion}
					onApply={onApply ? () => onApply(suggestion) : undefined}
					onDismiss={onDismiss ? () => onDismiss(suggestion.id) : undefined}
				/>
			))}
		</div>
	);
}

interface SuggestionCardProps {
	suggestion: AnalysisSuggestion;
	onApply?: () => void;
	onDismiss?: () => void;
}

function SuggestionCard({ suggestion, onApply, onDismiss }: SuggestionCardProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const impactConfig = IMPACT_CONFIG[suggestion.impact];

	const typeIcons: Record<string, string> = {
		rewrite: "✏️",
		add: "➕",
		remove: "➖",
		restructure: "🔄",
		clarify: "💡",
	};

	return (
		<div className="p-2 bg-[var(--background-muted)] rounded-lg">
			<div className="flex items-start gap-2">
				<span className="text-sm flex-shrink-0">
					{typeIcons[suggestion.type] || "💡"}
				</span>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-1.5 mb-1">
						<span className={cn("text-[10px] font-medium", impactConfig.color)}>
							{impactConfig.label}
						</span>
					</div>
					<p className={cn(
						"text-xs text-[var(--foreground)]",
						!isExpanded && "line-clamp-2"
					)}>
						{suggestion.text}
					</p>

					{suggestion.replacement && isExpanded && (
						<div className="mt-2 p-1.5 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
							<p className="text-[10px] font-medium text-green-700 dark:text-green-400 mb-1">
								Suggested:
							</p>
							<p className="text-xs text-[var(--foreground)] font-mono">
								{suggestion.replacement}
							</p>
						</div>
					)}

					<div className="flex items-center gap-2 mt-2">
						{suggestion.text.length > 100 && (
							<button
								onClick={() => setIsExpanded(!isExpanded)}
								className="text-[10px] text-[var(--accent-500)] hover:underline"
							>
								{isExpanded ? "Show less" : "Show more"}
							</button>
						)}
						<div className="flex-1" />
						{onDismiss && (
							<button
								onClick={onDismiss}
								className="text-[10px] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
							>
								Dismiss
							</button>
						)}
						{onApply && suggestion.replacement && (
							<Button
								variant="ghost"
								size="sm"
								onClick={onApply}
								className="h-6 px-2 text-[10px]"
							>
								Apply
							</Button>
						)}
					</div>
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

function ChevronRightIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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

function LoadingSpinner({ className }: { className?: string }) {
	return (
		<svg className={cn("animate-spin", className)} fill="none" viewBox="0 0 24 24">
			<circle
				className="opacity-25"
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				strokeWidth="4"
			/>
			<path
				className="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			/>
		</svg>
	);
}
