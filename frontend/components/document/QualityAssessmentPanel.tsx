/**
 * Quality Assessment Panel Component - DocFusion
 *
 * Displays comprehensive quality assessment results including:
 * - Overall score with visual gauge
 * - Category breakdown with expandable sections
 * - Issues and suggestions with filters
 * - Version comparison view
 */

"use client";

import { useState, useMemo } from "react";
import {
	triggerQualityAssessment,
	getQualityFactors,
	getCategoryIcon,
	getCategoryLabel,
	getScoreColor,
	getScoreGradient,
	getPriorityColor,
	getPriorityBgColor,
	getScoreLevel,
} from "@/lib/actions/quality-assessment";
import type {
	QualityAssessment,
	QualityFactorResult,
	QualityFactorCategory,
	QualityIssue,
	QualitySuggestion,
	IssuePriority,
	QualityScoreLevel,
} from "@/lib/actions/quality-assessment";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

// ============================================================================
// Types & Props
// ============================================================================

interface QualityAssessmentPanelProps {
	documentId: string;
	assessment?: QualityAssessment | null;
	isLoading?: boolean;
	onRefresh?: (assessment: QualityAssessment) => void;
	onCompareVersions?: () => void;
	className?: string;
}

interface CategoryConfig {
	label: string;
	description: string;
	icon: string;
	colorClass: string;
	bgColorClass: string;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_CONFIG: Record<QualityFactorCategory, CategoryConfig> = {
	content: {
		label: "Content Quality",
		description: "Narrative coherence, clarity, evidence quality, and argument strength",
		icon: "📝",
		colorClass: "text-blue-600",
		bgColorClass: "bg-blue-100",
	},
	structure: {
		label: "Structure & Organization",
		description: "Section structure, header hierarchy, and flow",
		icon: "🏗️",
		colorClass: "text-emerald-600",
		bgColorClass: "bg-emerald-100",
	},
	style: {
		label: "Style & Language",
		description: "Grammar, tone, voice, and professional language",
		icon: "✨",
		colorClass: "text-purple-600",
		bgColorClass: "bg-purple-100",
	},
	technical: {
		label: "Technical Quality",
		description: "Jargon usage, format compliance, and visual consistency",
		icon: "⚙️",
		colorClass: "text-amber-600",
		bgColorClass: "bg-amber-100",
	},
	compliance: {
		label: "Compliance & Alignment",
		description: "Target audience alignment and compliance fit",
		icon: "✅",
		colorClass: "text-green-600",
		bgColorClass: "bg-green-100",
	},
	strategy: {
		label: "Strategic Elements",
		description: "Risk identification, CTAs, and budget timeline",
		icon: "🎯",
		colorClass: "text-rose-600",
		bgColorClass: "bg-rose-100",
	},
};

const PRIORITY_CONFIG: Record<
	IssuePriority,
	{ label: string; colorClass: string; icon: string }
> = {
	critical: {
		label: "Critical",
		colorClass: "text-red-600",
		icon: "🚨",
	},
	high: {
		label: "High",
		colorClass: "text-orange-600",
		icon: "⚠️",
	},
	medium: {
		label: "Medium",
		colorClass: "text-yellow-600",
		icon: "⚡",
	},
	low: {
		label: "Low",
		colorClass: "text-blue-600",
		icon: "ℹ️",
	},
};

// ============================================================================
// Helper Functions
// ============================================================================

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

export function QualityAssessmentPanel({
	documentId,
	assessment,
	isLoading = false,
	onRefresh,
	onCompareVersions,
	className,
}: QualityAssessmentPanelProps) {
	const [isRunning, setIsRunning] = useState(false);
	const [activeTab, setActiveTab] = useState<"overview" | "factors" | "issues" | "suggestions">("overview");
	const [expandedCategories, setExpandedCategories] = useState<Record<QualityFactorCategory, boolean>>({
		content: false,
		structure: false,
		style: false,
		technical: false,
		compliance: false,
		strategy: false,
	});
	const [expandedFactors, setExpandedFactors] = useState<Record<string, boolean>>({});
	const [priorityFilter, setPriorityFilter] = useState<IssuePriority | "all">("all");
	const [selectedCategories, setSelectedCategories] = useState<QualityFactorCategory[]>([]);

	const priorityOrder: Record<IssuePriority, number> = {
		critical: 0,
		high: 1,
		medium: 2,
		low: 3,
	};

	// Memoized values
	const sortedIssues = useMemo(() => {
		if (!assessment) return [];
		let issues = [...assessment.issues];
		if (priorityFilter !== "all") {
			issues = issues.filter((i) => i.priority === priorityFilter);
		}
		return issues.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
	}, [assessment, priorityFilter]);

	const priorityCounts = useMemo(() => {
		if (!assessment) return { critical: 0, high: 0, medium: 0, low: 0 };
		return assessment.issues.reduce(
			(counts, issue) => {
				counts[issue.priority]++;
				return counts;
			},
			{ critical: 0, high: 0, medium: 0, low: 0 }
		);
	}, [assessment]);

	const factorsByCategory = useMemo(() => {
		if (!assessment) return {};
		const grouped: Partial<Record<QualityFactorCategory, QualityFactorResult[]>> = {};
		for (const factor of assessment.factors) {
			if (!grouped[factor.category]) {
				grouped[factor.category] = [];
			}
			grouped[factor.category]!.push(factor);
		}
		return grouped;
	}, [assessment]);

	// Handlers
	const handleRunAssessment = async () => {
		setIsRunning(true);
		try {
			const result = await triggerQualityAssessment(documentId, {
				categories: selectedCategories.length > 0 ? selectedCategories : undefined,
				strictMode: false,
			});
			if (result.success && result.assessment && onRefresh) {
				onRefresh(result.assessment);
			}
		} finally {
			setIsRunning(false);
		}
	};

	const toggleCategory = (category: QualityFactorCategory) => {
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
	if (isLoading || isRunning) {
		return (
			<div className={cn("bg-[var(--background)] rounded-lg border border-[var(--border)] p-6", className)}>
				<div className="animate-pulse space-y-6">
					<div className="flex items-center justify-center gap-4">
						<div className="w-28 h-28 rounded-full bg-[var(--background-muted)]" />
						<div className="flex-1 space-y-2">
							<div className="h-6 w-32 bg-[var(--background-muted)] rounded" />
							<div className="h-4 w-48 bg-[var(--background-muted)] rounded" />
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4">
						{[1, 2, 3, 4, 5, 6].map((i) => (
							<div key={i} className="h-24 bg-[var(--background-muted)] rounded-lg" />
						))}
					</div>
				</div>
			</div>
		);
	}

	// No assessment state
	if (!assessment) {
		return (
			<EmptyState onRun={handleRunAssessment} isRunning={isRunning} className={className} />
		);
	}

	return (
		<div className={cn("bg-[var(--background)] rounded-lg border border-[var(--border)]", className)}>
			{/* Header */}
			<PanelHeader
				assessment={assessment}
				onRefresh={handleRunAssessment}
				onCompare={onCompareVersions}
				isRunning={isRunning}
			/>

			{/* Issue Summary Pills */}
			<IssueSummaryPills counts={priorityCounts} totalIssues={assessment.issues.length} />

			{/* Tabs */}
			<TabsNavigation
				activeTab={activeTab}
				onChange={setActiveTab}
				issueCount={assessment.issues.length}
				suggestionCount={assessment.suggestions.length}
			/>

			{/* Tab Content */}
			<div className="p-6">
				{activeTab === "overview" && (
					<OverviewTab
						assessment={assessment}
						factorsByCategory={factorsByCategory}
						expandedCategories={expandedCategories}
						onToggleCategory={toggleCategory}
						expandedFactors={expandedFactors}
						onToggleFactor={toggleFactor}
					/>
				)}
				{activeTab === "factors" && (
					<FactorsTab
						factors={assessment.factors}
						expandedFactors={expandedFactors}
						onToggleFactor={toggleFactor}
					/>
				)}
				{activeTab === "issues" && (
					<IssuesTab
						issues={sortedIssues}
						priorityFilter={priorityFilter}
						onFilterChange={setPriorityFilter}
						priorityCounts={priorityCounts}
						totalIssues={assessment.issues.length}
					/>
				)}
				{activeTab === "suggestions" && (
					<SuggestionsTab suggestions={assessment.suggestions} />
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function EmptyState({
	onRun,
	isRunning,
	className,
}: {
	onRun: () => void;
	isRunning: boolean;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"bg-[var(--background)] rounded-lg border border-[var(--border)] p-8 text-center",
				className
			)}
		>
			<div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--background-muted)] mb-4">
				<ChartPieIcon className="h-8 w-8 text-[var(--foreground-muted)]" />
			</div>
			<h3 className="text-lg font-medium text-[var(--foreground)] mb-2">No Quality Assessment</h3>
			<p className="text-sm text-[var(--foreground-muted)] mb-4 max-w-md mx-auto">
				Run an assessment to analyze your document across 35 quality factors including clarity,
				structure, style, and compliance.
			</p>
			<Button variant="primary" onClick={onRun} disabled={isRunning}>
				<RefreshIcon className="h-4 w-4 mr-2" />
				{isRunning ? "Assessing..." : "Run Assessment"}
			</Button>
		</div>
	);
}

function PanelHeader({
	assessment,
	onRefresh,
	onCompare,
	isRunning,
}: {
	assessment: QualityAssessment;
	onRefresh: () => void;
	onCompare?: () => void;
	isRunning: boolean;
}) {
	const scoreLevel = getScoreLevel(assessment.overallScore);

	return (
		<div className="p-6 border-b border-[var(--border)]">
			<div className="flex items-start gap-6">
				<ScoreGauge score={assessment.overallScore} size="lg" />

				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between mb-2">
						<h3 className="text-lg font-semibold text-[var(--foreground)]">Quality Assessment</h3>
						<div className="flex items-center gap-2">
							<Button variant="ghost" size="sm" onClick={onRefresh} disabled={isRunning}>
								<RefreshIcon className="h-4 w-4" />
							</Button>
							{onCompare && (
								<Button variant="ghost" size="sm" onClick={onCompare}>
									<CompareIcon className="h-4 w-4" />
								</Button>
							)}
						</div>
					</div>
					<p
						className={cn("text-2xl font-bold", getScoreColor(assessment.overallScore))}
					>
						{assessment.overallScore}/100 - {scoreLevel.replace("_", " ").toUpperCase()}
					</p>
					<div className="flex items-center gap-4 mt-2 text-sm text-[var(--foreground-muted)]">
						<span>{assessment.summary.wordCount.toLocaleString()} words</span>
						<span>•</span>
						<span>{assessment.summary.paragraphCount} paragraphs</span>
						<span>•</span>
						<span>Assessed {formatDate(assessment.assessedAt)}</span>
					</div>
				</div>
			</div>

			{/* Quick Stats */}
			<div className="grid grid-cols-3 gap-4 mt-4">
				<QuickStat
					label="Readability"
					value={`Grade ${assessment.summary.readabilityGrade.toFixed(1)}`}
					description="Flesch-Kincaid"
				/>
				<QuickStat
					label="Active Voice"
					value={`${assessment.summary.activeVoicePercentage.toFixed(0)}%`}
					description="Recommended: 80%+"
					positive={assessment.summary.activeVoicePercentage >= 80}
				/>
				<QuickStat
					label="Avg Sentence"
					value={`${assessment.summary.averageSentenceLength.toFixed(0)} words`}
					description="Target: 15-20"
				/>
			</div>
		</div>
	);
}

function QuickStat({
	label,
	value,
	description,
	positive,
}: {
	label: string;
	value: string;
	description?: string;
	positive?: boolean;
}) {
	return (
		<div className="bg-[var(--background-muted)] rounded-lg p-3">
			<div className="flex items-center gap-2">
				{positive !== undefined && (
					<span
						className={cn(
							"text-lg",
							positive ? "text-green-600" : "text-yellow-600"
						)}
					>
						{positive ? "✓" : "⚠"}
					</span>
				)}
				<div>
					<p className="text-xs text-[var(--foreground-muted)]">{label}</p>
					<p className="text-sm font-semibold text-[var(--foreground)]">{value}</p>
					{description && <p className="text-xs text-[var(--foreground-muted)]">{description}</p>}
				</div>
			</div>
		</div>
	);
}

function IssueSummaryPills({
	counts,
	totalIssues,
}: {
	counts: Record<IssuePriority, number>;
	totalIssues: number;
}) {
	return (
		<div className="px-6 pt-4 flex flex-wrap gap-2">
			{counts.critical > 0 && (
				<Badge color="red">
					{PRIORITY_CONFIG.critical.icon} {counts.critical} Critical
				</Badge>
			)}
			{counts.high > 0 && (
				<Badge color="orange">
					{PRIORITY_CONFIG.high.icon} {counts.high} High
				</Badge>
			)}
			{counts.medium > 0 && (
				<Badge color="yellow">
					{PRIORITY_CONFIG.medium.icon} {counts.medium} Medium
				</Badge>
			)}
			{counts.low > 0 && (
				<Badge color="blue">
					{PRIORITY_CONFIG.low.icon} {counts.low} Low
				</Badge>
			)}
			{totalIssues === 0 && <Badge color="green">✓ No Issues Found</Badge>}
		</div>
	);
}

function Badge({
	children,
	color,
}: {
	children: React.ReactNode;
	color: "red" | "orange" | "yellow" | "blue" | "green";
}) {
	const colors: Record<string, string> = {
		red: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
		orange: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
		yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
		blue: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
		green: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
	};

	return (
		<span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium", colors[color])}>
			{children}
		</span>
	);
}

function TabsNavigation({
	activeTab,
	onChange,
	issueCount,
	suggestionCount,
}: {
	activeTab: string;
	onChange: (tab: "overview" | "factors" | "issues" | "suggestions") => void;
	issueCount: number;
	suggestionCount: number;
}) {
	const tabs: Array<{ id: "overview" | "factors" | "issues" | "suggestions"; label: string; count?: number }> = [
		{ id: "overview", label: "Overview" },
		{ id: "factors", label: "All Factors" },
		{ id: "issues", label: "Issues", count: issueCount },
		{ id: "suggestions", label: "Suggestions", count: suggestionCount },
	];

	return (
		<div className="border-b border-[var(--border)]">
			<div className="flex">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						onClick={() => onChange(tab.id)}
						className={cn(
							"px-4 py-3 text-sm font-medium border-b-2 transition-colors relative",
							activeTab === tab.id
								? "border-[var(--accent-500)] text-[var(--foreground)]"
								: "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
						)}
					>
						{tab.label}
						{tab.count !== undefined && tab.count > 0 && (
							<span className="ml-1.5 text-xs">
								({tab.count})
							</span>
						)}
					</button>
				))}
			</div>
		</div>
	);
}

function OverviewTab({
	assessment,
	factorsByCategory,
	expandedCategories,
	onToggleCategory,
	expandedFactors,
	onToggleFactor,
}: {
	assessment: QualityAssessment;
	factorsByCategory: Partial<Record<QualityFactorCategory, QualityFactorResult[]>>;
	expandedCategories: Record<QualityFactorCategory, boolean>;
	onToggleCategory: (category: QualityFactorCategory) => void;
	expandedFactors: Record<string, boolean>;
	onToggleFactor: (id: string) => void;
}) {
	return (
		<div className="space-y-6">
			{/* Category Scores Grid */}
			<div className="grid grid-cols-2 gap-4">
				{assessment.categoryScores.map((categoryScore) => (
					<CategoryScoreCard
						key={categoryScore.category}
						categoryScore={categoryScore}
						factors={factorsByCategory[categoryScore.category] || []}
						isExpanded={expandedCategories[categoryScore.category]}
						onToggle={() => onToggleCategory(categoryScore.category)}
						expandedFactors={expandedFactors}
						onToggleFactor={onToggleFactor}
					/>
				))}
			</div>

			{/* Top Issues */}
			{assessment.issues.length > 0 && (
				<div>
					<h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Top Issues</h4>
					<div className="space-y-2">
						{assessment.issues.slice(0, 5).map((issue) => (
							<IssueCard key={issue.id} issue={issue} compact />
						))}
					</div>
				</div>
			)}

			{/* Top Suggestions */}
			{assessment.suggestions.length > 0 && (
				<div>
					<h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Top Suggestions</h4>
					<div className="space-y-2">
						{assessment.suggestions.slice(0, 5).map((suggestion) => (
							<SuggestionCard key={suggestion.id} suggestion={suggestion} compact />
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function FactorsTab({
	factors,
	expandedFactors,
	onToggleFactor,
}: {
	factors: QualityFactorResult[];
	expandedFactors: Record<string, boolean>;
	onToggleFactor: (id: string) => void;
}) {
	return (
		<div className="space-y-2">
			{factors.length === 0 ? (
				<EmptyTab message="No factors analyzed" />
			) : (
				<div className="space-y-2">
					{factors.map((factor) => (
						<FactorCard
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

function IssuesTab({
	issues,
	priorityFilter,
	onFilterChange,
	priorityCounts,
	totalIssues,
}: {
	issues: QualityIssue[];
	priorityFilter: IssuePriority | "all";
	onFilterChange: (p: IssuePriority | "all") => void;
	priorityCounts: Record<IssuePriority, number>;
	totalIssues: number;
}) {
	return (
		<div className="space-y-4">
			<PriorityFilter
				filter={priorityFilter}
				onChange={onFilterChange}
				counts={priorityCounts}
				total={totalIssues}
			/>

			{issues.length === 0 ? (
				<EmptyTab message="No issues match the selected filter" />
			) : (
				<div className="space-y-3">
					{issues.map((issue) => (
						<IssueCard key={issue.id} issue={issue} />
					))}
				</div>
			)}
		</div>
	);
}

function SuggestionsTab({ suggestions }: { suggestions: QualitySuggestion[] }) {
	return (
		<div className="space-y-3">
			{suggestions.length === 0 ? (
				<EmptyTab message="No suggestions available" icon="✨" />
			) : (
				<div className="space-y-3">
					{suggestions.map((suggestion) => (
						<SuggestionCard key={suggestion.id} suggestion={suggestion} />
					))}
				</div>
			)}
		</div>
	);
}

function EmptyTab({ message, icon = "🔍" }: { message: string; icon?: string }) {
	return (
		<div className="text-center py-8">
			<span className="text-4xl mb-3 block">{icon}</span>
			<p className="text-[var(--foreground-muted)]">{message}</p>
		</div>
	);
}

function PriorityFilter({
	filter,
	onChange,
	counts,
	total,
}: {
	filter: IssuePriority | "all";
	onChange: (p: IssuePriority | "all") => void;
	counts: Record<IssuePriority, number>;
	total: number;
}) {
	const options: Array<{ value: IssuePriority | "all"; label: string; count?: number }> = [
		{ value: "all", label: "All", count: total },
		{ value: "critical", label: "Critical", count: counts.critical },
		{ value: "high", label: "High", count: counts.high },
		{ value: "medium", label: "Medium", count: counts.medium },
		{ value: "low", label: "Low", count: counts.low },
	];

	return (
		<div className="flex items-center gap-2">
			<span className="text-sm text-[var(--foreground-muted)]">Filter:</span>
			<div className="flex gap-1 flex-wrap">
				{options.map((opt) => (
					<button
						key={opt.value}
						onClick={() => onChange(opt.value)}
						className={cn(
							"px-3 py-1 text-xs font-medium rounded-full transition-colors",
							filter === opt.value
								? "bg-[var(--foreground)] text-[var(--background)]"
								: "bg-[var(--background-muted)] text-[var(--foreground-muted)] hover:bg-[var(--border)]"
						)}
					>
						{opt.label} {opt.count !== undefined && `(${opt.count})`}
					</button>
				))}
			</div>
		</div>
	);
}

// ============================================================================
// Card Components
// ============================================================================

interface CategoryScoreCardProps {
	categoryScore: {
		category: QualityFactorCategory;
		score: number;
		issueCount: number;
	};
	factors: QualityFactorResult[];
	isExpanded: boolean;
	onToggle: () => void;
	expandedFactors: Record<string, boolean>;
	onToggleFactor: (id: string) => void;
}

function CategoryScoreCard({
	categoryScore,
	factors,
	isExpanded,
	onToggle,
	expandedFactors,
	onToggleFactor,
}: CategoryScoreCardProps) {
	const config = CATEGORY_CONFIG[categoryScore.category];

	return (
		<div className="border border-[var(--border)] rounded-lg overflow-hidden">
			<button
				onClick={onToggle}
				className="w-full p-4 flex items-center gap-3 hover:bg-[var(--background-muted)] transition-colors text-left"
			>
				<span className="text-2xl">{config.icon}</span>
				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between">
						<h4 className="text-sm font-medium text-[var(--foreground)]">{config.label}</h4>
						<span className={cn("text-lg font-bold", getScoreColor(categoryScore.score))}>
							{categoryScore.score}
						</span>
					</div>
					<div className="flex items-center gap-2 mt-1">
						<div className="flex-1 h-1.5 bg-[var(--background-muted)] rounded-full overflow-hidden">
							<div
								className={cn("h-full rounded-full bg-gradient-to-r", getScoreGradient(categoryScore.score))}
								style={{ width: `${categoryScore.score}%` }}
							/>
						</div>
						<span className="text-xs text-[var(--foreground-muted)]">{factors.length} factors</span>
					</div>
				</div>
				<ChevronIcon className={cn("h-5 w-5 text-[var(--foreground-muted)] transition-transform", isExpanded && "rotate-180")} />
			</button>

			{isExpanded && factors.length > 0 && (
				<div className="border-t border-[var(--border)] bg-[var(--background-muted)] p-3 space-y-2">
					{factors.map((factor) => (
						<FactorCompactRow
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

function FactorCompactRow({
	factor,
	isExpanded,
	onToggle,
}: {
	factor: QualityFactorResult;
	isExpanded: boolean;
	onToggle: () => void;
}) {
	return (
		<div className="bg-[var(--background)] rounded-md border border-[var(--border)] overflow-hidden">
			<button onClick={onToggle} className="w-full p-2.5 flex items-center justify-between hover:bg-[var(--background-muted)]">
				<div className="flex items-center gap-2 flex-1 min-w-0">
					<span className="text-sm font-medium text-[var(--foreground)] flex-1 truncate">{factor.name}</span>
					{factor.issues.length > 0 && (
						<span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
							{factor.issues.length}
						</span>
					)}
				</div>
				<span className={cn("text-sm font-semibold ml-2", getScoreColor(factor.score))}>{factor.score}</span>
			</button>
			{isExpanded && factor.details && (
				<div className="px-3 pb-2.5">
					<p className="text-xs text-[var(--foreground-muted)]">{factor.details}</p>
				</div>
			)}
		</div>
	);
}

function FactorCard({
	factor,
	isExpanded,
	onToggle,
}: {
	factor: QualityFactorResult;
	isExpanded: boolean;
	onToggle: () => void;
}) {
	return (
		<div className="bg-[var(--background)] rounded-lg border border-[var(--border)] overflow-hidden">
			<button onClick={onToggle} className="w-full p-4 flex items-center justify-between hover:bg-[var(--background-muted)] transition-colors">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-3">
						<span className="text-sm font-medium text-[var(--foreground)]">{factor.name}</span>
						<Badge color={getScoreBadgeColor(factor.score)}>{factor.score}/100</Badge>
					</div>
					<p className="text-xs text-[var(--foreground-muted)] mt-1">{factor.description}</p>
					{factor.details && <p className="text-xs text-[var(--foreground-muted)] mt-1">{factor.details}</p>}
				</div>
				<ChevronIcon className={cn("h-5 w-5 transition-transform", isExpanded && "rotate-180")} />
			</button>
			{isExpanded && (
				<div className="border-t border-[var(--border)] p-4 bg-[var(--background-muted)] space-y-3">
					{factor.actualValue && (
						<div className="text-sm">
							<span className="text-[var(--foreground-muted)]">Actual: </span>
							<span className="text-[var(--foreground)] font-medium">{factor.actualValue}</span>
							{factor.targetValue && (
								<span className="text-[var(--foreground-muted)]"> (Target: {factor.targetValue})</span>
							)}
						</div>
					)}
					{factor.issues.length > 0 && (
						<div className="space-y-2">
							<h5 className="text-xs font-medium text-[var(--foreground)]">Issues</h5>
							{factor.issues.map((issue) => (
								<div key={issue.id} className="text-sm text-[var(--foreground)]">
									<span className="font-medium">{issue.priority}:</span> {issue.message}
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function getScoreBadgeColor(score: number): "red" | "orange" | "yellow" | "green" {
	if (score >= 80) return "green";
	if (score >= 60) return "yellow";
	if (score >= 40) return "orange";
	return "red";
}

function IssueCard({ issue, compact = false }: { issue: QualityIssue; compact?: boolean }) {
	const config = PRIORITY_CONFIG[issue.priority];

	if (compact) {
		return (
			<div className="flex items-start gap-2 p-2 rounded bg-[var(--background-muted)] text-sm">
				<span>{config.icon}</span>
				<span className="flex-1 text-[var(--foreground)] truncate">{issue.message}</span>
			</div>
		);
	}

	return (
		<div className={cn("p-4 rounded-lg border", getPriorityBgColor(issue.priority), "border-[var(--border)]")}>
			<div className="flex items-start gap-3">
				<span className="text-xl">{config.icon}</span>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className={cn("text-xs font-semibold uppercase px-2 py-0.5 rounded", config.colorClass, getPriorityBgColor(issue.priority))}>
							{config.label}
						</span>
						{issue.location?.section && (
							<span className="text-xs text-[var(--foreground-muted)]">in {issue.location.section}</span>
						)}
					</div>
					<p className="text-sm text-[var(--foreground)]">{issue.message}</p>
					{issue.suggestion && (
						<p className="text-xs text-[var(--foreground-muted)] mt-2 italic">💡 {issue.suggestion}</p>
					)}
				</div>
			</div>
		</div>
	);
}

const TYPE_LABELS: Record<string, string> = {
	rewrite: "Rewrite",
	expand: "Expand",
	condense: "Condense",
	reorganize: "Reorganize",
	enhance: "Enhance",
	add: "Add",
	remove: "Remove",
	clarify: "Clarify",
};

function SuggestionCard({ suggestion, compact = false }: { suggestion: QualitySuggestion; compact?: boolean }) {
	if (compact) {
		return (
			<div className="flex items-start gap-2 p-2 rounded bg-green-50 dark:bg-green-900/20 text-sm">
				<span className="text-green-600">💡</span>
				<span className="flex-1 text-[var(--foreground)] truncate">{suggestion.text}</span>
			</div>
		);
	}

	return (
		<div className="p-4 rounded-lg border border-[var(--border)] bg-green-50/50 dark:bg-green-900/10">
			<div className="flex items-start gap-3">
				<div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
					<span className="text-green-600 text-sm">💡</span>
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className="text-xs font-medium px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
							{TYPE_LABELS[suggestion.type] || suggestion.type}
						</span>
						<span className={cn("text-xs font-medium", getPriorityColor(suggestion.priority))}>
							{suggestion.priority.charAt(0).toUpperCase() + suggestion.priority.slice(1)} Impact
						</span>
					</div>
					<p className="text-sm text-[var(--foreground)]">{suggestion.text}</p>
					{suggestion.replacement && (
						<div className="mt-2 p-2 rounded bg-green-100/50 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
							<p className="text-xs text-green-700 dark:text-green-400 mb-1">Suggested replacement:</p>
							<p className="text-sm font-mono text-[var(--foreground)]">{suggestion.replacement}</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Score Gauge Component
// ============================================================================

interface ScoreGaugeProps {
	score: number;
	size?: "sm" | "md" | "lg";
}

function ScoreGauge({ score, size = "md" }: ScoreGaugeProps) {
	const sizeClasses = { sm: "w-14 h-14", md: "w-20 h-20", lg: "w-28 h-28" };
	const textClasses = { sm: "text-lg", md: "text-2xl", lg: "text-3xl" };
	const strokeWidth = size === "lg" ? 6 : size === "md" ? 5 : 4;
	const radius = size === "lg" ? 50 : size === "md" ? 42 : 30;
	const circumference = 2 * Math.PI * radius;
	const strokeDashoffset = circumference - (score / 100) * circumference;

	const getColor = (s: number) => {
		if (s >= 80) return "#22c55e";
		if (s >= 60) return "#eab308";
		if (s >= 40) return "#f97316";
		return "#ef4444";
	};

	return (
		<div className={cn("relative", sizeClasses[size])}>
			<svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
				<circle
					cx="60"
					cy="60"
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					className="text-[var(--background-muted)]"
				/>
				<circle
					cx="60"
					cy="60"
					r={radius}
					fill="none"
					stroke={getColor(score)}
					strokeWidth={strokeWidth}
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={strokeDashoffset}
					className="transition-all duration-700 ease-out"
				/>
			</svg>
			<div className="absolute inset-0 flex items-center justify-center">
				<span className={cn("font-bold", textClasses[size], getScoreColor(score))}>{score}</span>
			</div>
		</div>
	);
}

// ============================================================================
// Icons
// ============================================================================

function ChartPieIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
		</svg>
	);
}

function RefreshIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
		</svg>
	);
}

function CompareIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
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
