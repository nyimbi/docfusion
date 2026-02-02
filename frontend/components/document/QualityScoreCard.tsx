/**
 * Quality Score Card Component - DocFusion
 *
 * A compact score visualization component with:
 * - Score gauge visualization
 * - Category breakdown mini-bars
 * - Quick stats display
 * - Color-coded status indicators
 */

"use client";

import { cn } from "@/lib/utils";
import {
	getScoreColor,
	getScoreGradient,
	getScoreLevel,
	getCategoryIcon,
	getCategoryLabel,
} from "@/lib/actions/quality-assessment-types";
import type {
	QualityAssessment,
	QualityFactorCategory,
	QualityScoreLevel,
} from "@/lib/actions/quality-assessment-types";

// ============================================================================
// Props
// ============================================================================

interface QualityScoreCardProps {
	assessment?: QualityAssessment | null;
	isLoading?: boolean;
	compact?: boolean;
	onClick?: () => void;
	className?: string;
}

interface MiniScoreGaugeProps {
	score: number;
	size?: "xs" | "sm" | "md";
	showLabel?: boolean;
}

interface CategoryMiniBarProps {
	category: QualityFactorCategory;
	score: number;
	size?: "sm" | "md";
}

// ============================================================================
// Main Component
// ============================================================================

export function QualityScoreCard({
	assessment,
	isLoading = false,
	compact = false,
	onClick,
	className,
}: QualityScoreCardProps) {
	if (isLoading) {
		return <LoadingState compact={compact} className={className} />;
	}

	if (!assessment) {
		return <EmptyState compact={compact} onClick={onClick} className={className} />;
	}

	return (
		<div
			onClick={onClick}
			className={cn(
				"bg-[var(--background)] border border-[var(--border)] rounded-lg",
				onClick && "cursor-pointer hover:border-[var(--accent-500)]",
				className
			)}
		>
			{compact ? (
				<CompactView assessment={assessment} />
			) : (
				<FullView assessment={assessment} />
			)}
		</div>
	);
}

// ============================================================================
// View Components
// ============================================================================

function CompactView({ assessment }: { assessment: QualityAssessment }) {
	const scoreLevel = getScoreLevel(assessment.overallScore);

	return (
		<div className="p-4 flex items-center gap-4">
			<MiniScoreGauge score={assessment.overallScore} size="md" />
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<h4 className="font-semibold text-[var(--foreground)]">Quality Score</h4>
					<ScorePill score={assessment.overallScore} level={scoreLevel} />
				</div>
				<p className="text-sm text-[var(--foreground-muted)]">
					{assessment.summary.wordCount.toLocaleString()} words • {" "}
					{assessment.issues.length} {" "}
					{assessment.issues.length === 1 ? "issue" : "issues"} detected
				</p>
			</div>
		</div>
	);
}

function FullView({ assessment }: { assessment: QualityAssessment }) {
	const scoreLevel = getScoreLevel(assessment.overallScore);
	const activeCategories = assessment.categoryScores.filter((c) => c.score > 0);

	return (
		<div className="p-6">
			{/* Header */}
			<div className="flex items-center gap-6 mb-6">
				<MiniScoreGauge score={assessment.overallScore} size="md" showLabel />
				<div className="flex-1">
					<h3 className="text-lg font-semibold text-[var(--foreground)]">Document Quality</h3>
					<p className={cn("text-xl font-bold", getScoreColor(assessment.overallScore))}>
						{assessment.overallScore}/100
					</p>
					<p className="text-sm capitalize text-[var(--foreground-muted)]">
						{scoreLevel.replace("_", " ")}
					</p>
				</div>
			</div>

			{/* Category Mini Bars */}
			<div className="space-y-2 mb-6">
				{activeCategories.map((cat) => (
					<CategoryMiniBar
						key={cat.category}
						category={cat.category}
						score={cat.score}
						size="sm"
					/>
				))}
			</div>

			{/* Quick Stats */}
			<div className="grid grid-cols-4 gap-2">
				<MiniStat label="Words" value={assessment.summary.wordCount.toLocaleString()} />
				<MiniStat
					label="Readability"
					value={`G${assessment.summary.readabilityGrade.toFixed(0)}`}
				/>
				<MiniStat
					label="Active Voice"
					value={`${assessment.summary.activeVoicePercentage.toFixed(0)}%`}
				/>
				<MiniStat label="Issues" value={assessment.issues.length.toString()} color="red" />
			</div>
		</div>
	);
}

// ============================================================================
// State Components
// ============================================================================

function LoadingState({ compact, className }: { compact: boolean; className?: string }) {
	return (
		<div
			className={cn(
				"bg-[var(--background)] border border-[var(--border)] rounded-lg animate-pulse",
				className
			)}
		>
			<div className={compact ? "p-4 flex items-center gap-4" : "p-6 space-y-4"}>
				<div className={cn("rounded-full bg-[var(--background-muted)]", compact ? "w-12 h-12" : "w-20 h-20")} />
				<div className={compact ? "flex-1" : "space-y-2"}>
					<div className="h-4 w-24 bg-[var(--background-muted)] rounded" />
					<div className="h-3 w-32 bg-[var(--background-muted)] rounded" />
				</div>
			</div>
		</div>
	);
}

function EmptyState({
	compact,
	onClick,
	className,
}: {
	compact: boolean;
	onClick?: () => void;
	className?: string;
}) {
	return (
		<div
			onClick={onClick}
			className={cn(
				"bg-[var(--background)] border border-dashed border-[var(--border)] rounded-lg",
				"text-center cursor-pointer hover:border-[var(--accent-500)] hover:bg-[var(--background-muted)]",
				"transition-all",
				compact ? "p-4" : "p-8",
				className
			)}
		>
			<SparkleIcon className={cn("mx-auto text-[var(--foreground-muted)]", compact ? "h-6 w-6 mb-2" : "h-10 w-10 mb-3")} />
			<p className="text-sm text-[var(--foreground-muted)] font-medium">Run Assessment</p>
			{!compact && <p className="text-xs text-[var(--foreground-muted)] mt-1">Analyze 35+ quality factors</p>}
		</div>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

export function MiniScoreGauge({ score, size = "md", showLabel = false }: MiniScoreGaugeProps) {
	const sizeClasses = { xs: "w-8 h-8", sm: "w-12 h-12", md: "w-20 h-20" };
	const strokeWidth = size === "xs" ? 3 : size === "sm" ? 4 : 5;
	const radius = { xs: 10, sm: 16, md: 26 }[size];
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (score / 100) * circumference;
	const textSize = { xs: "text-xs", sm: "text-sm", md: "text-2xl" }[size];

	const color = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : score >= 40 ? "#f97316" : "#ef4444";

	return (
		<div className={cn("relative", sizeClasses[size])}>
			<svg className="w-full h-full transform -rotate-90" viewBox="0 0 60 60">
				<circle
					cx="30"
					cy="30"
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					className="text-[var(--background-muted)]"
				/>
				<circle
					cx="30"
					cy="30"
					r={radius}
					fill="none"
					stroke={color}
					strokeWidth={strokeWidth}
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					className="transition-all duration-700"
				/>
			</svg>
			<div className="absolute inset-0 flex items-center justify-center">
				<span className={cn("font-bold", textSize, getScoreColor(score))}>{Math.round(score)}</span>
			</div>
			{showLabel && (
				<div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
					<span className="text-xs text-[var(--foreground-muted)] uppercase">{getScoreLevel(score)}</span>
				</div>
			)}
		</div>
	);
}

export function CategoryMiniBar({ category, score, size = "sm" }: CategoryMiniBarProps) {
	const icon = getCategoryIcon(category);
	const label = getCategoryLabel(category);
	const isSmall = size === "sm";

	return (
		<div className="flex items-center gap-2">
			{isSmall ? (
				<span className="text-base" title={label}>
					{icon}
					</span>
			) : (
				<span className="text-sm w-6 text-center">{icon}</span>
			)}
			<div className="flex-1">
				<div className="flex items-center justify-between mb-0.5">
					{!isSmall && <span className="text-xs text-[var(--foreground-muted)]">{label}</span>}
					<span className={cn("text-xs font-semibold", getScoreColor(score))}>{score}</span>
				</div>
				<div className="h-1.5 bg-[var(--background-muted)] rounded-full overflow-hidden">
					<div
						className={cn("h-full rounded-full bg-gradient-to-r", getScoreGradient(score))}
						style={{ width: `${score}%` }}
					/>
				</div>
			</div>
		</div>
	);
}

function ScorePill({ score, level }: { score: number; level: QualityScoreLevel }) {
	const colors: Record<QualityScoreLevel, string> = {
		excellent: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
		good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
		average: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
		needs_work: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
		poor: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
	};

	return (
		<span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", colors[level])}>
			{level.replace("_", " ")}
		</span>
	);
}

function MiniStat({
	label,
	value,
	color,
}: {
	label: string;
	value: string;
	color?: "red" | "orange" | "green";
}) {
	const colorClasses = {
		red: "text-red-600",
		orange: "text-orange-600",
		green: "text-green-600",
	};

	return (
		<div className="text-center bg-[var(--background-muted)] rounded p-2">
			<p className={cn("text-sm font-semibold", color ? colorClasses[color] : "text-[var(--foreground)]")}>{value}</p>
			<p className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-wide">{label}</p>
		</div>
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
// Mini Progress Component for inline display
// ============================================================================

interface QualityProgressProps {
	score: number;
	variant?: "bar" | "mini" | "inline";
	className?: string;
}

export function QualityProgress({ score, variant = "bar", className }: QualityProgressProps) {
	if (variant === "mini") {
		return (
			<div className={cn("w-16 h-1.5 bg-[var(--background-muted)] rounded-full overflow-hidden", className)}>
				<div
					className={cn("h-full rounded-full bg-gradient-to-r", getScoreGradient(score))}
					style={{ width: `${score}%` }}
				/>
			</div>
		);
	}

	if (variant === "inline") {
		return (
			<span className={cn("text-xs font-medium", getScoreColor(score), className)}>{score}%</span>
		);
	}

	return (
		<div className={cn("w-full h-2 bg-[var(--background-muted)] rounded-full overflow-hidden", className)}>
			<div
				className={cn("h-full rounded-full bg-gradient-to-r", getScoreGradient(score))}
				style={{ width: `${score}%` }}
			/>
		</div>
	);
}
