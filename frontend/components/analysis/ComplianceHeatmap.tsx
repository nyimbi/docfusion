/**
 * ComplianceHeatmap Component - DocFusion
 *
 * Displays paragraph-by-paragraph quality heatmap with color-coded
 * scores, issue indicators, and inline suggestion application.
 * Enables quick identification of document sections needing attention.
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import type {
	ParagraphAnalysis,
	AnalysisIssue,
	AnalysisSuggestion,
	IssueSeverity,
} from "@/lib/types/opportunity";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

// ============================================================================
// Types & Constants
// ============================================================================

interface ComplianceHeatmapProps {
	paragraphs: ParagraphAnalysis[];
	isLoading?: boolean;
	onParagraphClick?: (paragraph: ParagraphAnalysis) => void;
	onApplySuggestion?: (suggestion: AnalysisSuggestion, paragraphIndex: number) => void;
	selectedParagraphIndex?: number;
	showFullText?: boolean;
	className?: string;
}

const SCORE_THRESHOLDS = {
	excellent: 90,
	good: 75,
	average: 60,
	belowAverage: 40,
};

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
	critical: 0,
	error: 1,
	warning: 2,
	info: 3,
};

// ============================================================================
// Helper Functions
// ============================================================================

function getScoreColorClass(score: number): string {
	if (score >= SCORE_THRESHOLDS.excellent) return "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700";
	if (score >= SCORE_THRESHOLDS.good) return "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800";
	if (score >= SCORE_THRESHOLDS.average) return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
	if (score >= SCORE_THRESHOLDS.belowAverage) return "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800";
	return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
}

function getScoreBarColor(score: number): string {
	if (score >= SCORE_THRESHOLDS.excellent) return "bg-green-500";
	if (score >= SCORE_THRESHOLDS.good) return "bg-emerald-500";
	if (score >= SCORE_THRESHOLDS.average) return "bg-yellow-500";
	if (score >= SCORE_THRESHOLDS.belowAverage) return "bg-orange-500";
	return "bg-red-500";
}

function getScoreTextColor(score: number): string {
	if (score >= SCORE_THRESHOLDS.good) return "text-green-700 dark:text-green-400";
	if (score >= SCORE_THRESHOLDS.average) return "text-yellow-700 dark:text-yellow-400";
	if (score >= SCORE_THRESHOLDS.belowAverage) return "text-orange-700 dark:text-orange-400";
	return "text-red-700 dark:text-red-400";
}

function getMostSevereIssue(issues: AnalysisIssue[]): IssueSeverity | null {
	if (issues.length === 0) return null;
	return issues.reduce((mostSevere, issue) => {
		return SEVERITY_ORDER[issue.severity] < SEVERITY_ORDER[mostSevere]
			? issue.severity
			: mostSevere;
	}, issues[0].severity);
}

function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength).trim() + "...";
}

// ============================================================================
// Main Component
// ============================================================================

export function ComplianceHeatmap({
	paragraphs,
	isLoading = false,
	onParagraphClick,
	onApplySuggestion,
	selectedParagraphIndex,
	showFullText = false,
	className,
}: ComplianceHeatmapProps) {
	const [expandedParagraph, setExpandedParagraph] = useState<number | null>(null);
	const [viewMode, setViewMode] = useState<"compact" | "detailed">("compact");

	// Calculate overall stats
	const stats = useMemo(() => {
		if (paragraphs.length === 0) {
			return {
				avgScore: 0,
				totalIssues: 0,
				criticalCount: 0,
				lowScoreCount: 0,
			};
		}

		const avgScore = paragraphs.reduce((sum, p) => sum + p.score, 0) / paragraphs.length;
		const totalIssues = paragraphs.reduce((sum, p) => sum + p.issues.length, 0);
		const criticalCount = paragraphs.reduce(
			(sum, p) => sum + p.issues.filter((i) => i.severity === "critical" || i.severity === "error").length,
			0
		);
		const lowScoreCount = paragraphs.filter((p) => p.score < SCORE_THRESHOLDS.average).length;

		return { avgScore, totalIssues, criticalCount, lowScoreCount };
	}, [paragraphs]);

	const handleParagraphClick = useCallback(
		(paragraph: ParagraphAnalysis, index: number) => {
			setExpandedParagraph(expandedParagraph === index ? null : index);
			onParagraphClick?.(paragraph);
		},
		[expandedParagraph, onParagraphClick]
	);

	// Loading state
	if (isLoading) {
		return (
			<div className={cn("bg-[var(--background)] rounded-lg border border-[var(--border)] p-4", className)}>
				<div className="animate-pulse space-y-3">
					{[1, 2, 3, 4, 5].map((i) => (
						<div key={i} className="h-12 bg-[var(--background-muted)] rounded" />
					))}
				</div>
			</div>
		);
	}

	// Empty state
	if (paragraphs.length === 0) {
		return (
			<div className={cn("bg-[var(--background)] rounded-lg border border-[var(--border)] p-8 text-center", className)}>
				<HeatmapIcon className="h-12 w-12 text-[var(--foreground-muted)] mx-auto mb-3" />
				<p className="text-sm text-[var(--foreground-muted)]">
					No paragraph analysis available. Run a document analysis to see the heatmap.
				</p>
			</div>
		);
	}

	return (
		<div className={cn("bg-[var(--background)] rounded-lg border border-[var(--border)]", className)}>
			{/* Header with Stats */}
			<div className="p-4 border-b border-[var(--border)]">
				<div className="flex items-center justify-between mb-3">
					<h3 className="text-sm font-semibold text-[var(--foreground)]">
						Compliance Heatmap
					</h3>
					<div className="flex items-center gap-2">
						<button
							onClick={() => setViewMode("compact")}
							className={cn(
								"px-2 py-1 text-xs rounded",
								viewMode === "compact"
									? "bg-[var(--foreground)] text-[var(--background)]"
									: "bg-[var(--background-muted)] text-[var(--foreground-muted)] hover:bg-[var(--border)]"
							)}
						>
							Compact
						</button>
						<button
							onClick={() => setViewMode("detailed")}
							className={cn(
								"px-2 py-1 text-xs rounded",
								viewMode === "detailed"
									? "bg-[var(--foreground)] text-[var(--background)]"
									: "bg-[var(--background-muted)] text-[var(--foreground-muted)] hover:bg-[var(--border)]"
							)}
						>
							Detailed
						</button>
					</div>
				</div>

				{/* Stats Row */}
				<div className="grid grid-cols-4 gap-3 text-center">
					<div className="bg-[var(--background-muted)] rounded p-2">
						<div className={cn("text-lg font-bold", getScoreTextColor(stats.avgScore))}>
							{Math.round(stats.avgScore)}
						</div>
						<div className="text-xs text-[var(--foreground-muted)]">Avg Score</div>
					</div>
					<div className="bg-[var(--background-muted)] rounded p-2">
						<div className="text-lg font-bold text-[var(--foreground)]">
							{paragraphs.length}
						</div>
						<div className="text-xs text-[var(--foreground-muted)]">Paragraphs</div>
					</div>
					<div className="bg-[var(--background-muted)] rounded p-2">
						<div className={cn(
							"text-lg font-bold",
							stats.criticalCount > 0 ? "text-red-600 dark:text-red-400" : "text-[var(--foreground)]"
						)}>
							{stats.criticalCount}
						</div>
						<div className="text-xs text-[var(--foreground-muted)]">Critical</div>
					</div>
					<div className="bg-[var(--background-muted)] rounded p-2">
						<div className={cn(
							"text-lg font-bold",
							stats.lowScoreCount > 0 ? "text-orange-600 dark:text-orange-400" : "text-[var(--foreground)]"
						)}>
							{stats.lowScoreCount}
						</div>
						<div className="text-xs text-[var(--foreground-muted)]">Low Score</div>
					</div>
				</div>

				{/* Legend */}
				<div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-[var(--border)]">
					<LegendItem color="bg-green-500" label="Excellent (90+)" />
					<LegendItem color="bg-emerald-500" label="Good (75-89)" />
					<LegendItem color="bg-yellow-500" label="Average (60-74)" />
					<LegendItem color="bg-orange-500" label="Below (40-59)" />
					<LegendItem color="bg-red-500" label="Poor (<40)" />
				</div>
			</div>

			{/* Heatmap Grid */}
			<div className={cn(
				"p-4",
				viewMode === "compact" ? "space-y-1" : "space-y-2"
			)}>
				{viewMode === "compact" ? (
					<CompactView
						paragraphs={paragraphs}
						selectedIndex={selectedParagraphIndex}
						expandedIndex={expandedParagraph}
						onParagraphClick={handleParagraphClick}
					/>
				) : (
					<DetailedView
						paragraphs={paragraphs}
						selectedIndex={selectedParagraphIndex}
						expandedIndex={expandedParagraph}
						onParagraphClick={handleParagraphClick}
						onApplySuggestion={onApplySuggestion}
						showFullText={showFullText}
					/>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function LegendItem({ color, label }: { color: string; label: string }) {
	return (
		<div className="flex items-center gap-1">
			<div className={cn("w-3 h-3 rounded", color)} />
			<span className="text-xs text-[var(--foreground-muted)]">{label}</span>
		</div>
	);
}

interface CompactViewProps {
	paragraphs: ParagraphAnalysis[];
	selectedIndex?: number;
	expandedIndex: number | null;
	onParagraphClick: (paragraph: ParagraphAnalysis, index: number) => void;
}

function CompactView({ paragraphs, selectedIndex, expandedIndex, onParagraphClick }: CompactViewProps) {
	return (
		<div className="flex flex-wrap gap-1">
			{paragraphs.map((paragraph, index) => {
				const severity = getMostSevereIssue(paragraph.issues);
				const isSelected = selectedIndex === index;
				const isExpanded = expandedIndex === index;

				return (
					<div key={paragraph.id} className="relative">
						<button
							onClick={() => onParagraphClick(paragraph, index)}
							className={cn(
								"w-8 h-8 rounded text-xs font-medium transition-all",
								getScoreBarColor(paragraph.score),
								isSelected && "ring-2 ring-[var(--accent-500)] ring-offset-2",
								"hover:scale-110 hover:z-10"
							)}
							title={`Paragraph ${index + 1}: Score ${Math.round(paragraph.score)}`}
						>
							{index + 1}
						</button>
						{/* Issue indicator */}
						{severity && (
							<div
								className={cn(
									"absolute -top-1 -right-1 w-3 h-3 rounded-full border border-white dark:border-gray-900",
									severity === "critical" || severity === "error"
										? "bg-red-500"
										: severity === "warning"
										? "bg-yellow-500"
										: "bg-blue-500"
								)}
							/>
						)}

						{/* Expanded tooltip */}
						{isExpanded && (
							<div className="absolute top-full left-0 mt-2 z-20 w-64 bg-[var(--background)] rounded-lg border border-[var(--border)] shadow-lg p-3">
								<div className="flex items-center justify-between mb-2">
									<span className="text-xs font-semibold text-[var(--foreground)]">
										Paragraph {index + 1}
									</span>
									<span className={cn("text-sm font-bold", getScoreTextColor(paragraph.score))}>
										{Math.round(paragraph.score)}
									</span>
								</div>
								<p className="text-xs text-[var(--foreground-muted)] line-clamp-3 mb-2">
									{paragraph.text}
								</p>
								{paragraph.issues.length > 0 && (
									<div className="text-xs text-orange-600 dark:text-orange-400">
										{paragraph.issues.length} issue{paragraph.issues.length !== 1 ? "s" : ""}
									</div>
								)}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}

interface DetailedViewProps {
	paragraphs: ParagraphAnalysis[];
	selectedIndex?: number;
	expandedIndex: number | null;
	onParagraphClick: (paragraph: ParagraphAnalysis, index: number) => void;
	onApplySuggestion?: (suggestion: AnalysisSuggestion, paragraphIndex: number) => void;
	showFullText: boolean;
}

function DetailedView({
	paragraphs,
	selectedIndex,
	expandedIndex,
	onParagraphClick,
	onApplySuggestion,
	showFullText,
}: DetailedViewProps) {
	return (
		<div className="space-y-2">
			{paragraphs.map((paragraph, index) => {
				const isSelected = selectedIndex === index;
				const isExpanded = expandedIndex === index;
				const severity = getMostSevereIssue(paragraph.issues);

				return (
					<div key={paragraph.id}>
						<button
							onClick={() => onParagraphClick(paragraph, index)}
							className={cn(
								"w-full text-left p-3 rounded-lg border transition-all",
								getScoreColorClass(paragraph.score),
								isSelected && "ring-2 ring-[var(--accent-500)]",
								"hover:shadow-sm"
							)}
						>
							<div className="flex items-start gap-3">
								{/* Score indicator */}
								<div className="flex-shrink-0 w-10 text-center">
									<div className={cn("text-lg font-bold", getScoreTextColor(paragraph.score))}>
										{Math.round(paragraph.score)}
									</div>
									<div className="text-[10px] text-[var(--foreground-muted)]">¶{index + 1}</div>
								</div>

								{/* Content */}
								<div className="flex-1 min-w-0">
									<p className={cn(
										"text-sm text-[var(--foreground)]",
										showFullText ? "" : "line-clamp-2"
									)}>
										{showFullText ? paragraph.text : truncateText(paragraph.text, 150)}
									</p>

									{/* Issue badges */}
									{paragraph.issues.length > 0 && (
										<div className="flex flex-wrap gap-1 mt-2">
											{paragraph.issues.slice(0, 3).map((issue) => (
												<span
													key={issue.id}
													className={cn(
														"text-[10px] px-1.5 py-0.5 rounded",
														issue.severity === "critical" || issue.severity === "error"
															? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
															: issue.severity === "warning"
															? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
															: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
													)}
												>
													{truncateText(issue.message, 40)}
												</span>
											))}
											{paragraph.issues.length > 3 && (
												<span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
													+{paragraph.issues.length - 3} more
												</span>
											)}
										</div>
									)}
								</div>

								{/* Severity icon */}
								{severity && (
									<SeverityBadge severity={severity} />
								)}
							</div>
						</button>

						{/* Expanded details */}
						{isExpanded && (
							<div className="mt-2 ml-14 p-3 bg-[var(--background-muted)] rounded-lg space-y-3">
								{/* Full text */}
								{!showFullText && (
									<div>
										<h5 className="text-xs font-semibold text-[var(--foreground)] mb-1">
											Full Text
										</h5>
										<p className="text-xs text-[var(--foreground-muted)]">
											{paragraph.text}
										</p>
									</div>
								)}

								{/* Issues */}
								{paragraph.issues.length > 0 && (
									<div>
										<h5 className="text-xs font-semibold text-[var(--foreground)] mb-2">
											Issues ({paragraph.issues.length})
										</h5>
										<div className="space-y-1.5">
											{paragraph.issues.map((issue) => (
												<div
													key={issue.id}
													className={cn(
														"p-2 rounded text-xs border",
														issue.severity === "critical" || issue.severity === "error"
															? "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
															: issue.severity === "warning"
															? "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800"
															: "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800"
													)}
												>
													<span className="font-medium">{issue.message}</span>
													{issue.suggestion && (
														<p className="text-[var(--foreground-muted)] mt-1 italic">
															💡 {issue.suggestion}
														</p>
													)}
												</div>
											))}
										</div>
									</div>
								)}

								{/* Suggestions */}
								{paragraph.suggestions.length > 0 && (
									<div>
										<h5 className="text-xs font-semibold text-[var(--foreground)] mb-2">
											Suggestions ({paragraph.suggestions.length})
										</h5>
										<div className="space-y-1.5">
											{paragraph.suggestions.map((suggestion) => (
												<div
													key={suggestion.id}
													className="p-2 rounded text-xs bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800"
												>
													<p className="text-[var(--foreground)]">{suggestion.text}</p>
													{suggestion.replacement && (
														<div className="mt-2 p-1.5 bg-white dark:bg-gray-900 rounded font-mono text-[10px]">
															{suggestion.replacement}
														</div>
													)}
													{onApplySuggestion && suggestion.replacement && (
														<Button
															variant="ghost"
															size="sm"
															onClick={(e) => {
																e.stopPropagation();
																onApplySuggestion(suggestion, index);
															}}
															className="mt-2 h-6 text-xs"
														>
															Apply
														</Button>
													)}
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}

function SeverityBadge({ severity }: { severity: IssueSeverity }) {
	const config: Record<IssueSeverity, { icon: string; color: string }> = {
		critical: { icon: "⚠", color: "text-red-500" },
		error: { icon: "✕", color: "text-orange-500" },
		warning: { icon: "!", color: "text-yellow-500" },
		info: { icon: "i", color: "text-blue-500" },
	};

	const { icon, color } = config[severity];

	return (
		<div className={cn("flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", color)}>
			{icon}
		</div>
	);
}

// ============================================================================
// Icons
// ============================================================================

function HeatmapIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
			/>
		</svg>
	);
}
