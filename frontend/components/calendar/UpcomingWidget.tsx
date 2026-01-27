/**
 * UpcomingWidget Component - DocFusion
 *
 * Compact dashboard widget showing upcoming deadlines for the next 7 days.
 * Designed for sidebar or dashboard placement.
 */

"use client";

import Link from "next/link";
import type {
	DeadlineItem,
	DeadlineType,
	DeadlineUrgency,
	DeadlineStats,
} from "@/lib/types/opportunity";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface UpcomingWidgetProps {
	deadlines: DeadlineItem[];
	stats?: DeadlineStats;
	title?: string;
	maxItems?: number;
	showStats?: boolean;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const TYPE_DOTS: Record<DeadlineType, string> = {
	opportunity: "bg-red-500",
	requirement: "bg-amber-500",
	proposal_document: "bg-blue-500",
	document_section: "bg-violet-500",
	review: "bg-teal-500",
	submission: "bg-emerald-500",
};

const URGENCY_TEXT: Record<DeadlineUrgency, string> = {
	overdue: "text-red-600 dark:text-red-400",
	critical: "text-orange-600 dark:text-orange-400",
	urgent: "text-amber-600 dark:text-amber-400",
	upcoming: "text-blue-600 dark:text-blue-400",
	normal: "text-[var(--foreground-muted)]",
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatDeadlineDate(date: Date, daysUntil: number): string {
	if (daysUntil === 0) return "Today";
	if (daysUntil === 1) return "Tomorrow";
	if (daysUntil < 0) return `${Math.abs(daysUntil)}d overdue`;
	if (daysUntil <= 7) {
		const day = date.toLocaleDateString("en-US", { weekday: "short" });
		return day;
	}
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatCard({
	value,
	label,
	urgent,
}: {
	value: number;
	label: string;
	urgent?: boolean;
}) {
	return (
		<div className="text-center">
			<span
				className={cn(
					"text-2xl font-bold",
					urgent ? "text-red-600 dark:text-red-400" : "text-[var(--foreground)]"
				)}
			>
				{value}
			</span>
			<span className="text-xs text-[var(--foreground-muted)] block">{label}</span>
		</div>
	);
}

function DeadlineRow({ item }: { item: DeadlineItem }) {
	return (
		<Link
			href={`/opportunities/${item.opportunityId}`}
			className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--background-muted)] transition-colors group"
		>
			<span className={cn("w-2 h-2 rounded-full flex-shrink-0", TYPE_DOTS[item.type])} />
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-[var(--foreground)] line-clamp-1 group-hover:text-[var(--accent-600)]">
					{item.title}
				</p>
				<p className="text-xs text-[var(--foreground-muted)] line-clamp-1">
					{item.opportunityTitle}
				</p>
			</div>
			<div className="flex-shrink-0 text-right">
				<span
					className={cn(
						"text-sm font-medium",
						URGENCY_TEXT[item.urgency]
					)}
				>
					{formatDeadlineDate(item.deadline, item.daysUntil)}
				</span>
			</div>
		</Link>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function UpcomingWidget({
	deadlines,
	stats,
	title = "Upcoming Deadlines",
	maxItems = 5,
	showStats = true,
	className,
}: UpcomingWidgetProps) {
	const displayedDeadlines = deadlines.slice(0, maxItems);
	const hasMore = deadlines.length > maxItems;

	// Quick stats from data if not provided
	const overdueCount = stats?.overdue ?? deadlines.filter((d) => d.daysUntil < 0).length;
	const dueTodayCount = stats?.dueToday ?? deadlines.filter((d) => d.daysUntil === 0).length;
	const dueThisWeekCount = stats?.dueThisWeek ?? deadlines.filter((d) => d.daysUntil >= 0 && d.daysUntil <= 7).length;

	return (
		<div
			className={cn(
				"bg-[var(--background)] border border-[var(--border)] rounded-lg",
				className
			)}
		>
			{/* Header */}
			<div className="px-4 py-3 border-b border-[var(--border)]">
				<div className="flex items-center justify-between">
					<h3 className="font-semibold text-[var(--foreground)]">{title}</h3>
					<Link
						href="/calendar"
						className="text-sm text-[var(--accent-600)] hover:underline"
					>
						View all
					</Link>
				</div>

				{/* Stats row */}
				{showStats && (
					<div className="flex items-center justify-around mt-3 pt-3 border-t border-[var(--border)]">
						<StatCard value={overdueCount} label="Overdue" urgent={overdueCount > 0} />
						<div className="w-px h-8 bg-[var(--border)]" />
						<StatCard value={dueTodayCount} label="Today" />
						<div className="w-px h-8 bg-[var(--border)]" />
						<StatCard value={dueThisWeekCount} label="This Week" />
					</div>
				)}
			</div>

			{/* Deadline list */}
			<div className="p-2">
				{displayedDeadlines.length === 0 ? (
					<div className="text-center py-6 text-[var(--foreground-muted)]">
						<CheckIcon className="h-8 w-8 mx-auto mb-2 text-green-500" />
						<p className="text-sm">All caught up!</p>
						<p className="text-xs">No upcoming deadlines</p>
					</div>
				) : (
					<div className="space-y-1">
						{displayedDeadlines.map((item) => (
							<DeadlineRow key={item.id} item={item} />
						))}
					</div>
				)}

				{/* Show more link */}
				{hasMore && (
					<Link
						href="/calendar"
						className="block text-center py-2 mt-2 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-muted)] rounded-lg transition-colors"
					>
						+{deadlines.length - maxItems} more deadlines
					</Link>
				)}
			</div>

			{/* Alert banner for overdue/critical */}
			{overdueCount > 0 && (
				<div className="px-4 py-2 bg-red-50 dark:bg-red-950 border-t border-red-200 dark:border-red-800">
					<div className="flex items-center gap-2">
						<AlertIcon className="h-4 w-4 text-red-500 flex-shrink-0" />
						<span className="text-sm text-red-700 dark:text-red-300">
							{overdueCount} deadline{overdueCount !== 1 ? "s" : ""} overdue
						</span>
						<Link
							href="/calendar?filter=overdue"
							className="text-sm text-red-600 dark:text-red-400 hover:underline ml-auto"
						>
							Review
						</Link>
					</div>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Compact Variant
// ============================================================================

interface CompactWidgetProps {
	deadlines: DeadlineItem[];
	maxItems?: number;
}

export function UpcomingWidgetCompact({
	deadlines,
	maxItems = 3,
}: CompactWidgetProps) {
	const displayedDeadlines = deadlines.slice(0, maxItems);
	const overdueCount = deadlines.filter((d) => d.daysUntil < 0).length;

	if (deadlines.length === 0) {
		return (
			<div className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
				<CheckIcon className="h-4 w-4 text-green-500" />
				No upcoming deadlines
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{/* Overdue alert */}
			{overdueCount > 0 && (
				<div className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
					<AlertIcon className="h-4 w-4" />
					<span className="font-medium">{overdueCount} overdue</span>
				</div>
			)}

			{/* Deadlines */}
			{displayedDeadlines.map((item) => (
				<Link
					key={item.id}
					href={`/opportunities/${item.opportunityId}`}
					className="flex items-center gap-2 text-sm hover:text-[var(--accent-600)]"
				>
					<span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", TYPE_DOTS[item.type])} />
					<span className="flex-1 truncate">{item.title}</span>
					<span className={cn("flex-shrink-0", URGENCY_TEXT[item.urgency])}>
						{item.daysUntil === 0 ? "Today" : item.daysUntil < 0 ? `${Math.abs(item.daysUntil)}d` : `${item.daysUntil}d`}
					</span>
				</Link>
			))}

			{/* View all */}
			{deadlines.length > maxItems && (
				<Link
					href="/calendar"
					className="text-xs text-[var(--accent-600)] hover:underline"
				>
					+{deadlines.length - maxItems} more
				</Link>
			)}
		</div>
	);
}

// ============================================================================
// Icons
// ============================================================================

function CheckIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
		</svg>
	);
}

function AlertIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
			/>
		</svg>
	);
}
