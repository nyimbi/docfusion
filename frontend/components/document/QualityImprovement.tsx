/**
 * Quality Improvement Component - DocFusion
 *
 * Displays improvement suggestions with:
 * - Priority-filtered suggestions
 * - Category-grouped recommendations
 * - Action buttons for applying suggestions
 * - Quick fix options
 */

"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import type {
	QualitySuggestion,
	QualityIssue,
	IssuePriority,
	SuggestionType,
	QualityFactorCategory,
} from "@/lib/actions/quality-assessment-types";
import {
	getPriorityColor,
	getPriorityBgColor,
	getCategoryIcon,
	getCategoryLabel,
} from "@/lib/actions/quality-assessment-types";

// ============================================================================
// Types & Props
// ============================================================================

interface QualityImprovementProps {
	suggestions: QualitySuggestion[];
	issues?: QualityIssue[];
	onApplySuggestion?: (suggestion: QualitySuggestion) => void;
	onNavigateToIssue?: (issue: QualityIssue) => void;
	compact?: boolean;
	className?: string;
}

interface SuggestionCardProps {
	suggestion: QualitySuggestion;
	onApply?: (suggestion: QualitySuggestion) => void;
	onDismiss?: (id: string) => void;
	variant?: "detailed" | "compact";
}

interface IssueCardProps {
	issue: QualityIssue;
	onNavigate?: (issue: QualityIssue) => void;
	variant?: "detailed" | "compact";
}

interface ImprovementStats {
	totalSuggestions: number;
	highPriorityCount: number;
	typeBreakdown: Record<SuggestionType, number>;
}

// ============================================================================
// Constants
// ============================================================================

const TYPE_ICONS: Record<SuggestionType, string> = {
	rewrite: "✏️",
	expand: "📄",
	condense: "✂️",
	reorganize: "🔄",
	enhance: "✨",
	add: "➕",
	remove: "➖",
	clarify: "💡",
};

const TYPE_DESCRIPTIONS: Record<SuggestionType, string> = {
	rewrite: "Change the wording or phrasing",
	expand: "Add more detail or explanation",
	condense: "Make it shorter and more concise",
	reorganize: "Restructure for better flow",
	enhance: "Improve the quality or impact",
	add: "Include additional content",
	remove: "Delete unnecessary content",
	clarify: "Make it clearer or easier to understand",
};

// ============================================================================
// Main Component
// ============================================================================

export function QualityImprovement({
	suggestions,
	issues = [],
	onApplySuggestion,
	onNavigateToIssue,
	compact = false,
	className,
}: QualityImprovementProps) {
	const [priorityFilter, setPriorityFilter] = useState<IssuePriority | "all">("all");
	const [typeFilter, setTypeFilter] = useState<SuggestionType | "all">("all");
	const [categoryFilter, setCategoryFilter] = useState<QualityFactorCategory | "all">("all");
	const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([]);

	// Calculate statistics
	const stats: ImprovementStats = useMemo(() => {
		return {
			totalSuggestions: suggestions.length,
			highPriorityCount: suggestions.filter(
				(s) => s.priority === "critical" || s.priority === "high"
			).length,
			typeBreakdown: suggestions.reduce((acc, s) => {
				acc[s.type] = (acc[s.type] || 0) + 1;
				return acc;
			}, {} as Record<SuggestionType, number>),
		};
	}, [suggestions]);

	// Filter suggestions
	const filteredSuggestions = useMemo(() => {
		return suggestions.filter((s) => {
			if (priorityFilter !== "all" && s.priority !== priorityFilter) return false;
			if (typeFilter !== "all" && s.type !== typeFilter) return false;
			if (dismissedSuggestions.includes(s.id)) return false;
			return true;
		});
	}, [suggestions, priorityFilter, typeFilter, dismissedSuggestions]);

	// Filter issues
	const filteredIssues = useMemo(() => {
		if (priorityFilter === "all") return issues;
		return issues.filter((i) => i.priority === priorityFilter);
	}, [issues, priorityFilter]);

	// Handle apply
	const handleApply = (suggestion: QualitySuggestion) => {
		if (onApplySuggestion) {
			onApplySuggestion(suggestion);
		}
	};

	// Handle dismiss
	const handleDismiss = (id: string) => {
		setDismissedSuggestions((prev) => [...prev, id]);
	};

	if (compact) {
		return (
			<CompactView
				suggestions={suggestions.slice(0, 5)}
				onApply={handleApply}
				onDismiss={handleDismiss}
				stats={stats}
				className={className}
			/>
		);
	}

	return (
		<div className={cn(	"bg-[var(--background)] rounded-lg border border-[var(--border)] p-6", className)}>
			<PanelHeader
				suggestions={suggestions}
				filteredCount={filteredSuggestions.length}
				onClear={() => {
					setPriorityFilter("all");
					setTypeFilter("all");
				}}
			/>

			<ActiveFilters
				priority={priorityFilter}
				type={typeFilter}
				onPriorityChange={setPriorityFilter}
				onTypeChange={setTypeFilter}
			/>

			<div className="mt-4 grid grid-cols-[1fr,1fr,2fr] gap-6">
				{/* Priority Summary */}
				<div className="space-y-3">
					<h4 className="text-sm font-medium text-[var(--foreground)]">By Priority</h4>
					<PriorityBreakdown suggestions={suggestions} onFilter={setPriorityFilter} />
				</div>

				{/* Type Breakdown */}
				<div className="space-y-3">
					<h4 className="text-sm font-medium text-[var(--foreground)]">By Type</h4>
					<TypeBreakdown suggestions={suggestions} onFilter={setTypeFilter} />
				</div>

				{/* Suggestion List */}
				<div className="space-y-3">
					<h4 className="text-sm font-medium text-[var(--foreground)]">
						Suggestions ({filteredSuggestions.length})
					</h4>
					<div className="space-y-2 max-h-[400px] overflow-y-auto">
						{filteredSuggestions.length === 0 ? (
							<EmptyState
								message="No suggestions match the current filters"
								onClear={() => {
									setPriorityFilter("all");
									setTypeFilter("all");
								}}
							/>
						) : (
							filteredSuggestions.map((suggestion) => (
								<SuggestionCard
									key={suggestion.id}
									suggestion={suggestion}
									onApply={handleApply}
									onDismiss={handleDismiss}
								/>
								))
							)}
						</div>
					</div>
				</div>

			{/* Issues Section */}
			{filteredIssues.length > 0 && (
				<div className="mt-6 pt-6 border-t border-[var(--border)]">
					<h4 className="text-sm font-medium text-[var(--foreground)] mb-3">
						Issues ({filteredIssues.length})
					</h4>
					<div className="space-y-2 max-h-[300px] overflow-y-auto">
						{filteredIssues.map((issue) => (
							<IssueCard
								key={issue.id}
								issue={issue}
								onNavigate={onNavigateToIssue}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// View Components
// ============================================================================

function CompactView({
	suggestions,
	onApply,
	onDismiss,
	stats,
	className,
}: {
	suggestions: QualitySuggestion[];
	onApply: (s: QualitySuggestion) => void;
	onDismiss: (id: string) => void;
	stats: ImprovementStats;
	className?: string;
}) {
	return (
		<div className={cn("bg-[var(--background)] rounded-lg border border-[var(--border)] p-4", className)}>
			<div className="flex items-center justify-between mb-4">
				<h4 className="text-sm font-medium text-[var(--foreground)]">
					Improvement Suggestions
				</h4>
				<Badge color="green">{stats.totalSuggestions} available</Badge>
			</div>

			{stats.highPriorityCount > 0 && (
				<Badge color="orange" className="mb-3">
					⚠️ {stats.highPriorityCount} high priority
				</Badge>
			)}

			<div className="space-y-2">
				{suggestions.length === 0 ? (
					<p className="text-sm text-[var(--foreground-muted)] text-center py-4">
						No suggestions available
					</p>
				) : (
					suggestions.slice(0, 5).map((suggestion) => (
						<SuggestionCard
							key={suggestion.id}
							suggestion={suggestion}
							onApply={onApply}
							onDismiss={onDismiss}
							variant="compact"
						/>
					))
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Card Components
// ============================================================================

function SuggestionCard({
	suggestion,
	onApply,
	onDismiss,
	variant = "detailed",
}: SuggestionCardProps) {
	const [isApplying, setIsApplying] = useState(false);
	const [isDismissed, setIsDismissed] = useState(false);

	const handleApply = async () => {
		setIsApplying(true);
		if (onApply) {
			await onApply(suggestion);
		}
		setIsApplying(false);
	};

	const handleDismiss = () => {
		if (onDismiss) {
			onDismiss(suggestion.id);
		}
		setIsDismissed(true);
	};

	if (isDismissed) return null;

	if (variant === "compact") {
		return (
			<div className="flex items-start gap-2 p-2 rounded bg-[var(--background-muted)] text-sm">
				<span>{TYPE_ICONS[suggestion.type]}</span>
				<span className={cn("text-xs px-1.5 py-0.5 rounded", getPriorityBgColor(suggestion.priority))}>
					{suggestion.priority}
				</span>
				<span className="flex-1 text-[var(--foreground)] truncate">{suggestion.text}</span>
				{onApply && suggestion.replacement && (
					<button
						onClick={handleApply}
						disabled={isApplying}
						className="text-xs text-[var(--accent-500)] hover:underline"
					>
						{isApplying ? "Applying..." : "Apply"}
					</button>
				)}
				{onDismiss && (
					<button
						onClick={handleDismiss}
						className="text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
					>
						✕
					</button>
				)}
			</div>
		);
	}

	return (
		<div className="p-4 rounded-lg border border-[var(--border)] bg-green-50/50 dark:bg-green-900/10">
			<div className="flex items-start gap-3">
				<div className="flex-shrink-0">
					<div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-lg">
						{TYPE_ICONS[suggestion.type]}
					</div>
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1 flex-wrap">
						<span className="text-xs font-medium px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
							{suggestion.type}
						</span>
						<span className={cn("text-xs font-medium", getPriorityColor(suggestion.priority))}>
							{suggestion.priority.toUpperCase()} IMPACT
						</span>
					</div>
					<p className="text-sm text-[var(--foreground)]">{suggestion.text}</p>
					<p className="text-xs text-[var(--foreground-muted)] mt-1">
						{TYPE_DESCRIPTIONS[suggestion.type]}
					</p>
					{suggestion.replacement && (
						<div className="mt-3 p-2 rounded bg-green-100/50 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
							<p className="text-xs text-green-700 dark:text-green-400 mb-1">
								Suggested replacement:
							</p>
							<p className="text-sm text-[var(--foreground)]">{suggestion.replacement}</p>
						</div>
					)}
					<div className="flex items-center gap-2 mt-3">
						{onApply && (
							<Button
								variant="outline"
								size="sm"
								onClick={handleApply}
								disabled={isApplying}
							>
								{isApplying ? "Applying..." : "Accept Suggestion"}
							</Button>
						)}
						{onDismiss && (
							<button
								onClick={handleDismiss}
								className="text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] px-2"
							>
								Dismiss
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function IssueCard({ issue, onNavigate, variant = "detailed" }: IssueCardProps) {
	if (variant === "compact") {
		return (
			<div className="flex items-start gap-2 p-2 rounded bg-[var(--background-muted)] text-sm">
				<span>{issue.priority === "critical" ? "🚨" : issue.priority === "high" ? "⚠️" : "⚡"}</span>
				<span className={cn("text-xs px-1.5 py-0.5 rounded", getPriorityBgColor(issue.priority))}>
					{issue.priority}
				</span>
				<span className="flex-1 text-[var(--foreground)] truncate">{issue.message}</span>
				{onNavigate && (
					<button
						onClick={() => onNavigate(issue)}
						className="text-xs text-[var(--accent-500)] hover:underline"
					>
						View
					</button>
				)}
			</div>
		);
	}

	return (
		<div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background-muted)]">
			<div className="flex items-start gap-3">
				<span className={cn("text-lg", getPriorityColor(issue.priority))}>
					{issue.priority === "critical" ? "🚨" : issue.priority === "high" ? "⚠️" : issue.priority === "medium" ? "⚡" : "ℹ️"}
				</span>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className={cn("text-xs font-semibold uppercase", getPriorityColor(issue.priority))}>
							{issue.priority}
						</span>
					</div>
					<p className="text-sm text-[var(--foreground)]">{issue.message}</p>
					{issue.suggestion && (
						<p className="text-xs text-[var(--foreground-muted)] mt-1 italic">
							💡 {issue.suggestion}
						</p>
					)}
					{onNavigate && (
						<button
							onClick={() => onNavigate(issue)}
							className="text-xs text-[var(--accent-500)] hover:underline mt-2"
						>
							Go to location
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Helper Components
// ============================================================================

function PanelHeader({
	suggestions,
	filteredCount,
	onClear,
}: {
	suggestions: QualitySuggestion[];
	filteredCount: number;
	onClear: () => void;
}) {
	const hasActiveFilters = suggestions.length !== filteredCount;

	return (
		<div className="flex items-center justify-between mb-4">
			<div>
				<h3 className="text-lg font-semibold text-[var(--foreground)]">Quality Improvements</h3>
				<p className="text-sm text-[var(--foreground-muted)]">
					{filteredCount} of {suggestions.length} suggestions shown
				</p>
			</div>
			{hasActiveFilters && (
				<Button variant="ghost" size="sm" onClick={onClear}>
					Clear Filters
				</Button>
			)}
		</div>
	);
}

function ActiveFilters({
	priority,
	type,
	onPriorityChange,
	onTypeChange,
}: {
	priority: string;
	type: string;
	onPriorityChange: (p: IssuePriority | "all") => void;
	onTypeChange: (t: SuggestionType | "all") => void;
}) {
	const hasFilters = priority !== "all" || type !== "all";
	if (!hasFilters) return null;

	return (
		<div className="flex items-center gap-2 mb-4">
			<span className="text-sm text-[var(--foreground-muted)]">Filters:</span>
			{priority !== "all" && (
				<Badge color="blue" className="cursor-pointer" onClick={() => onPriorityChange("all")}>
					Priority: {priority} ✕
				</Badge>
			)}
			{type !== "all" && (
				<Badge color="green" className="cursor-pointer" onClick={() => onTypeChange("all")}>
					Type: {type} ✕
				</Badge>
			)}
		</div>
	);
}

function PriorityBreakdown({
	suggestions,
	onFilter,
}: {
	suggestions: QualitySuggestion[];
	onFilter: (p: IssuePriority | "all") => void;
}) {
	const counts = suggestions.reduce(
		(acc, s) => {
			acc[s.priority]++;
			return acc;
		},
		{ critical: 0, high: 0, medium: 0, low: 0 } as Record<IssuePriority, number>
	);

	const priorities: IssuePriority[] = ["critical", "high", "medium", "low"];

	return (
		<div className="space-y-1.5">
			{[...priorities, "all"].map((p) => (
				<button
					key={p}
					onClick={() => onFilter(p as IssuePriority)}
					className={cn(
						"w-full flex items-center justify-between px-3 py-2 rounded text-left text-sm",
						(p === "all" ? suggestions.length : counts[p as IssuePriority]) > 1
							? "text-yellow-700 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300"
							: "text-green-700 bg-green-100 dark:bg-green-900 dark:text-green-300"
					)}
				>
					<span className="capitalize">{p}</span>
					<span className="font-medium">{counts[p as IssuePriority] || suggestions.length}</span>
				</button>
			))}
		</div>
	);
}

function TypeBreakdown({
	suggestions,
	onFilter,
}: {
	suggestions: QualitySuggestion[];
	onFilter: (t: SuggestionType | "all") => void;
}) {
	const counts = suggestions.reduce((acc, s) => {
		acc[s.type] = (acc[s.type] || 0) + 1;
		return acc;
	}, {} as Record<SuggestionType, number>);

	const types: SuggestionType[] = ["rewrite", "expand", "condense", "add", "remove", "clarify", "enhance", "reorganize"];

	return (
		<div className="space-y-1.5">
			{types.map((type) => (
				<button
					key={type}
					onClick={() => onFilter(type)}
					disabled={counts[type] === 0}
					className={cn(
						"w-full flex items-center justify-between px-3 py-2 rounded text-left text-sm",
						counts[type]
							? "hover:bg-[var(--background-muted)] text-[var(--foreground)]"
							: "text-[var(--foreground-muted)] cursor-not-allowed"
					)}
				>
					<span className="capitalize">{type}</span>
					{counts[type] > 0 && <span className="font-medium">{counts[type]}</span>}
				</button>
			))}
			<button
				onClick={() => onFilter("all")}
				className="w-full px-3 py-2 text-sm text-[var(--accent-500)] hover:underline text-left"
			>
				Show all types
			</button>
		</div>
	);
}

function EmptyState({ message, onClear }: { message: string; onClear: () => void }) {
	return (
		<div className="text-center py-8">
			<SparkleIcon className="h-12 w-12 text-[var(--foreground-muted)] mx-auto mb-3" />
			<p className="text-[var(--foreground-muted)] mb-3">{message}</p>
			<Button variant="outline" size="sm" onClick={onClear}>
				Clear Filters
			</Button>
		</div>
	);
}

function Badge({
	children,
	color,
	className,
	onClick,
}: {
	children: React.ReactNode;
	color: "red" | "orange" | "yellow" | "blue" | "green";
	className?: string;
	onClick?: () => void;
}) {
	const colors: Record<string, string> = {
		red: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
		orange: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
		yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
		blue: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
		green: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
	};

	return (
		<span
			onClick={onClick}
			className={cn(
				"inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
				colors[color],
				onClick && "cursor-pointer hover:opacity-80",
				className
			)}

	role="button"
	tabIndex={0}
	onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
			{children}
		</span>
	);
}

// ============================================================================
// Icons
// ============================================================================

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

// ============================================================================
// Mini Suggestion Component for inline use
// ============================================================================

export function MiniSuggestion({
	suggestion,
	onApply,
}: {
	suggestion: QualitySuggestion;
	onApply?: (suggestion: QualitySuggestion) => void;
}) {
	return (
		<div className="flex items-center gap-2 p-2 rounded bg-green-50 dark:bg-green-900/20 text-sm">
			<span>{TYPE_ICONS[suggestion.type]}</span>
			<span className="flex-1 text-[var(--foreground)] truncate">{suggestion.text}</span>
			{onApply && suggestion.replacement && (
				<button
					onClick={() => onApply(suggestion)}
					className="text-xs text-[var(--accent-500)] hover:underline"
				>
					Apply
				</button>
			)}
		</div>
	);
}

// ============================================================================
// Quick Action Toolbar
// ============================================================================

interface QuickActionToolbarProps {
	suggestions: QualitySuggestion[];
	onApplyAll?: (suggestions: QualitySuggestion[]) => void;
	onQuickFix?: (fixType: "grammar" | "acronyms" | "weak-language" | "transitions") => void;
	className?: string;
}

export function QuickActionToolbar({
	suggestions,
	onApplyAll,
	onQuickFix,
	className,
}: QuickActionToolbarProps) {
	const hasQuickFixes = suggestions.some((s) => ["clarify", "rewrite"].includes(s.type));

	return (
		<div className={cn("flex items-center gap-2 p-3 bg-[var(--background-muted)] rounded-lg", className)}>
			<span className="text-sm font-medium text-[var(--foreground)]">Quick Actions:</span>
			{hasQuickFixes && onApplyAll && (
				<Button
					variant="primary"
					size="sm"
					onClick={() => onApplyAll(suggestions.slice(0, 5))}
				>
					Apply Top 5 Suggestions
				</Button>
			)}
			{onQuickFix && (
				<>
					<Button variant="outline" size="sm" onClick={() => onQuickFix("grammar")}>
						Fix Grammar
					</Button>
					<Button variant="outline" size="sm" onClick={() => onQuickFix("acronyms")}>
						Define Acronyms
					</Button>
				</>
			)}
		</div>
	);
}
