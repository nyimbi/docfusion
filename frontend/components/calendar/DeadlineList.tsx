/**
 * DeadlineList Component - DocFusion
 *
 * Sorted list view of deadlines with filtering, grouping by date,
 * and status indicators.
 */

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type {
	DeadlineItem,
	DeadlineType,
	DeadlineUrgency,
	DeadlineFilters,
} from "@/lib/types/opportunity";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

type GroupBy = "date" | "type" | "opportunity" | "urgency";

interface DeadlineListProps {
	deadlines: DeadlineItem[];
	title?: string;
	showFilters?: boolean;
	groupBy?: GroupBy;
	emptyMessage?: string;
	maxHeight?: string;
	onFilterChange?: (filters: DeadlineFilters) => void;
}

// ============================================================================
// Constants
// ============================================================================

const TYPE_LABELS: Record<DeadlineType, string> = {
	opportunity: "RFP Deadline",
	requirement: "Requirement",
	proposal_document: "Document",
	document_section: "Section",
	review: "Review",
	submission: "Submission",
};

const TYPE_COLORS: Record<DeadlineType, { bg: string; text: string; border: string }> = {
	opportunity: {
		bg: "bg-red-50 dark:bg-red-950",
		text: "text-red-700 dark:text-red-300",
		border: "border-l-red-500",
	},
	requirement: {
		bg: "bg-amber-50 dark:bg-amber-950",
		text: "text-amber-700 dark:text-amber-300",
		border: "border-l-amber-500",
	},
	proposal_document: {
		bg: "bg-blue-50 dark:bg-blue-950",
		text: "text-blue-700 dark:text-blue-300",
		border: "border-l-blue-500",
	},
	document_section: {
		bg: "bg-violet-50 dark:bg-violet-950",
		text: "text-violet-700 dark:text-violet-300",
		border: "border-l-violet-500",
	},
	review: {
		bg: "bg-teal-50 dark:bg-teal-950",
		text: "text-teal-700 dark:text-teal-300",
		border: "border-l-teal-500",
	},
	submission: {
		bg: "bg-emerald-50 dark:bg-emerald-950",
		text: "text-emerald-700 dark:text-emerald-300",
		border: "border-l-emerald-500",
	},
};

const URGENCY_STYLES: Record<
	DeadlineUrgency,
	{ bg: string; text: string; badge: string; label: string }
> = {
	overdue: {
		bg: "bg-red-100 dark:bg-red-900/50",
		text: "text-red-800 dark:text-red-200",
		badge: "bg-red-500 text-white",
		label: "Overdue",
	},
	critical: {
		bg: "bg-orange-100 dark:bg-orange-900/50",
		text: "text-orange-800 dark:text-orange-200",
		badge: "bg-orange-500 text-white",
		label: "Critical",
	},
	urgent: {
		bg: "bg-amber-100 dark:bg-amber-900/50",
		text: "text-amber-800 dark:text-amber-200",
		badge: "bg-amber-500 text-white",
		label: "Urgent",
	},
	upcoming: {
		bg: "bg-blue-50 dark:bg-blue-900/30",
		text: "text-blue-700 dark:text-blue-300",
		badge: "bg-blue-500 text-white",
		label: "Upcoming",
	},
	normal: {
		bg: "bg-gray-50 dark:bg-gray-900/30",
		text: "text-gray-700 dark:text-gray-300",
		badge: "bg-gray-400 text-white",
		label: "Normal",
	},
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(date: Date): string {
	const now = new Date();
	const deadline = new Date(date);
	const isToday =
		deadline.toDateString() === now.toDateString();
	const tomorrow = new Date(now);
	tomorrow.setDate(tomorrow.getDate() + 1);
	const isTomorrow = deadline.toDateString() === tomorrow.toDateString();

	if (isToday) return "Today";
	if (isTomorrow) return "Tomorrow";

	return deadline.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

function formatDaysUntil(days: number): string {
	if (days === 0) return "Due today";
	if (days === 1) return "Due tomorrow";
	if (days < 0) return `${Math.abs(days)} days overdue`;
	return `${days} days left`;
}

function groupDeadlines(
	deadlines: DeadlineItem[],
	groupBy: GroupBy
): Map<string, DeadlineItem[]> {
	const groups = new Map<string, DeadlineItem[]>();

	for (const item of deadlines) {
		let key: string;

		switch (groupBy) {
			case "date":
				key = item.deadline.toISOString().split("T")[0];
				break;
			case "type":
				key = item.type;
				break;
			case "opportunity":
				key = item.opportunityId;
				break;
			case "urgency":
				key = item.urgency;
				break;
		}

		const existing = groups.get(key) || [];
		existing.push(item);
		groups.set(key, existing);
	}

	return groups;
}

function getGroupLabel(groupBy: GroupBy, key: string, items: DeadlineItem[]): string {
	switch (groupBy) {
		case "date":
			return formatDate(new Date(key + "T00:00:00"));
		case "type":
			return TYPE_LABELS[key as DeadlineType] || key;
		case "opportunity":
			return items[0]?.opportunityTitle || key;
		case "urgency":
			return URGENCY_STYLES[key as DeadlineUrgency]?.label || key;
	}
}

// ============================================================================
// Sub-Components
// ============================================================================

function DeadlineCard({ item }: { item: DeadlineItem }) {
	const colors = TYPE_COLORS[item.type];
	const urgencyStyle = URGENCY_STYLES[item.urgency];

	return (
		<Link
			href={`/opportunities/${item.opportunityId}`}
			className={cn(
				"block p-3 rounded-lg border-l-4 transition-all",
				"hover:shadow-md hover:translate-x-0.5",
				"bg-[var(--background)] border border-[var(--border)]",
				colors.border
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex-1 min-w-0">
					{/* Type Badge */}
					<div className="flex items-center gap-2 mb-1">
						<span
							className={cn(
								"text-xs px-2 py-0.5 rounded-full font-medium",
								colors.bg,
								colors.text
							)}
						>
							{TYPE_LABELS[item.type]}
						</span>
						{item.urgency !== "normal" && (
							<span
								className={cn(
									"text-xs px-2 py-0.5 rounded-full font-medium",
									urgencyStyle.badge
								)}
							>
								{urgencyStyle.label}
							</span>
						)}
					</div>

					{/* Title */}
					<h4 className="font-medium text-[var(--foreground)] line-clamp-1">
						{item.title}
					</h4>

					{/* Opportunity */}
					<p className="text-sm text-[var(--foreground-muted)] line-clamp-1 mt-0.5">
						{item.opportunityTitle}
					</p>

					{/* Metadata */}
					<div className="flex items-center gap-3 mt-2 text-xs text-[var(--foreground-muted)]">
						<span className="flex items-center gap-1">
							<CalendarIcon className="h-3.5 w-3.5" />
							{formatDate(item.deadline)}
						</span>
						{item.assignedTo && (
							<span className="flex items-center gap-1">
								<UserIcon className="h-3.5 w-3.5" />
								{item.assignedTo}
							</span>
						)}
						{item.status && (
							<span className="flex items-center gap-1">
								<StatusIcon className="h-3.5 w-3.5" />
								{item.status.replace(/_/g, " ")}
							</span>
						)}
					</div>
				</div>

				{/* Days indicator */}
				<div
					className={cn(
						"text-right flex-shrink-0 px-2 py-1 rounded",
						urgencyStyle.bg
					)}
				>
					<span
						className={cn(
							"text-lg font-bold",
							item.daysUntil < 0 ? "text-red-600" : urgencyStyle.text
						)}
					>
						{item.daysUntil < 0 ? Math.abs(item.daysUntil) : item.daysUntil}
					</span>
					<span className={cn("text-xs block", urgencyStyle.text)}>
						{item.daysUntil < 0 ? "overdue" : "days"}
					</span>
				</div>
			</div>
		</Link>
	);
}

function FilterBar({
	filters,
	onFilterChange,
}: {
	filters: DeadlineFilters;
	onFilterChange: (filters: DeadlineFilters) => void;
}) {
	const [localFilters, setLocalFilters] = useState<DeadlineFilters>(filters);

	const handleTypeToggle = (type: DeadlineType) => {
		const current = localFilters.types || [];
		const updated = current.includes(type)
			? current.filter((t) => t !== type)
			: [...current, type];
		const newFilters = { ...localFilters, types: updated.length > 0 ? updated : undefined };
		setLocalFilters(newFilters);
		onFilterChange(newFilters);
	};

	const handleUrgencyToggle = (urgency: DeadlineUrgency) => {
		const current = localFilters.urgencies || [];
		const updated = current.includes(urgency)
			? current.filter((u) => u !== urgency)
			: [...current, urgency];
		const newFilters = { ...localFilters, urgencies: updated.length > 0 ? updated : undefined };
		setLocalFilters(newFilters);
		onFilterChange(newFilters);
	};

	const handleClear = () => {
		const newFilters: DeadlineFilters = {};
		setLocalFilters(newFilters);
		onFilterChange(newFilters);
	};

	const hasFilters =
		(localFilters.types?.length ?? 0) > 0 ||
		(localFilters.urgencies?.length ?? 0) > 0;

	return (
		<div className="space-y-3 p-3 bg-[var(--background-muted)] rounded-lg">
			{/* Type filters */}
			<div>
				<label className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide mb-2 block">
					Type
				</label>
				<div className="flex flex-wrap gap-1.5">
					{(Object.keys(TYPE_LABELS) as DeadlineType[]).map((type) => {
						const isActive = localFilters.types?.includes(type);
						const colors = TYPE_COLORS[type];
						return (
							<button
								key={type}
								onClick={() => handleTypeToggle(type)}
								className={cn(
									"px-2 py-1 text-xs rounded-full transition-colors",
									isActive
										? cn(colors.bg, colors.text, "ring-1 ring-current")
										: "bg-[var(--background)] text-[var(--foreground-muted)] hover:bg-[var(--background)]"
								)}
							>
								{TYPE_LABELS[type]}
							</button>
						);
					})}
				</div>
			</div>

			{/* Urgency filters */}
			<div>
				<label className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide mb-2 block">
					Urgency
				</label>
				<div className="flex flex-wrap gap-1.5">
					{(["overdue", "critical", "urgent", "upcoming", "normal"] as DeadlineUrgency[]).map(
						(urgency) => {
							const isActive = localFilters.urgencies?.includes(urgency);
							const style = URGENCY_STYLES[urgency];
							return (
								<button
									key={urgency}
									onClick={() => handleUrgencyToggle(urgency)}
									className={cn(
										"px-2 py-1 text-xs rounded-full transition-colors",
										isActive
											? cn(style.bg, style.text, "ring-1 ring-current")
											: "bg-[var(--background)] text-[var(--foreground-muted)] hover:bg-[var(--background)]"
									)}
								>
									{style.label}
								</button>
							);
						}
					)}
				</div>
			</div>

			{/* Clear button */}
			{hasFilters && (
				<button
					onClick={handleClear}
					className="text-xs text-[var(--accent-600)] hover:underline"
				>
					Clear all filters
				</button>
			)}
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function DeadlineList({
	deadlines,
	title,
	showFilters = false,
	groupBy = "date",
	emptyMessage = "No deadlines found",
	maxHeight,
	onFilterChange,
}: DeadlineListProps) {
	const [filters, setFilters] = useState<DeadlineFilters>({});

	// Filter deadlines
	const filteredDeadlines = useMemo(() => {
		return deadlines.filter((item) => {
			if (filters.types?.length && !filters.types.includes(item.type)) {
				return false;
			}
			if (filters.urgencies?.length && !filters.urgencies.includes(item.urgency)) {
				return false;
			}
			return true;
		});
	}, [deadlines, filters]);

	// Group deadlines
	const groupedDeadlines = useMemo(() => {
		return groupDeadlines(filteredDeadlines, groupBy);
	}, [filteredDeadlines, groupBy]);

	// Sort groups
	const sortedGroups = useMemo(() => {
		const entries = Array.from(groupedDeadlines.entries());

		if (groupBy === "date") {
			entries.sort((a, b) => a[0].localeCompare(b[0]));
		} else if (groupBy === "urgency") {
			const order: DeadlineUrgency[] = ["overdue", "critical", "urgent", "upcoming", "normal"];
			entries.sort((a, b) => {
				return order.indexOf(a[0] as DeadlineUrgency) - order.indexOf(b[0] as DeadlineUrgency);
			});
		}

		return entries;
	}, [groupedDeadlines, groupBy]);

	const handleFilterChange = (newFilters: DeadlineFilters) => {
		setFilters(newFilters);
		onFilterChange?.(newFilters);
	};

	return (
		<div className="space-y-4">
			{/* Header */}
			{title && (
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
					<span className="text-sm text-[var(--foreground-muted)]">
						{filteredDeadlines.length} deadline{filteredDeadlines.length !== 1 ? "s" : ""}
					</span>
				</div>
			)}

			{/* Filters */}
			{showFilters && <FilterBar filters={filters} onFilterChange={handleFilterChange} />}

			{/* Deadline list */}
			<div
				className={cn("space-y-4", maxHeight && "overflow-y-auto")}
				style={maxHeight ? { maxHeight } : undefined}
			>
				{sortedGroups.length === 0 ? (
					<div className="text-center py-8 text-[var(--foreground-muted)]">
						<CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
						<p>{emptyMessage}</p>
					</div>
				) : (
					sortedGroups.map(([key, items]) => (
						<div key={key}>
							{/* Group header */}
							<h4 className="text-sm font-medium text-[var(--foreground-muted)] mb-2 sticky top-0 bg-[var(--background)] py-1">
								{getGroupLabel(groupBy, key, items)}
								<span className="ml-2 text-xs opacity-70">({items.length})</span>
							</h4>

							{/* Items in group */}
							<div className="space-y-2">
								{items.map((item) => (
									<DeadlineCard key={item.id} item={item} />
								))}
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Icons
// ============================================================================

function CalendarIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
			/>
		</svg>
	);
}

function UserIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
			/>
		</svg>
	);
}

function StatusIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
	);
}
