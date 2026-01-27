/**
 * CalendarClientPage Component - DocFusion
 *
 * Client-side wrapper for calendar page with state management
 * for month navigation and view switching.
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarView, DeadlineList, UpcomingWidget } from "@/components/calendar";
import type {
	CalendarMonthSummary,
	DeadlineItem,
	DeadlineStats,
	DeadlineFilters,
} from "@/lib/types/opportunity";
import { getCalendarMonthSummary, getUpcomingDeadlines } from "@/lib/actions/calendar";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

type ViewTab = "calendar" | "list";

interface CalendarClientPageProps {
	initialMonth: number;
	initialYear: number;
	initialMonthSummary: CalendarMonthSummary;
	upcomingDeadlines: DeadlineItem[];
	stats: DeadlineStats;
}

// ============================================================================
// Main Component
// ============================================================================

export function CalendarClientPage({
	initialMonth,
	initialYear,
	initialMonthSummary,
	upcomingDeadlines,
	stats,
}: CalendarClientPageProps) {
	const router = useRouter();
	const searchParams = useSearchParams();

	// State
	const [activeTab, setActiveTab] = useState<ViewTab>("calendar");
	const [monthSummary, setMonthSummary] = useState(initialMonthSummary);
	const [currentMonth, setCurrentMonth] = useState(initialMonth);
	const [currentYear, setCurrentYear] = useState(initialYear);
	const [selectedDate, setSelectedDate] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	// Handle month change
	const handleMonthChange = async (month: number, year: number) => {
		setCurrentMonth(month);
		setCurrentYear(year);

		// Update URL
		const params = new URLSearchParams(searchParams.toString());
		params.set("month", String(month));
		params.set("year", String(year));
		router.push(`/calendar?${params.toString()}`, { scroll: false });

		// Fetch new data
		startTransition(async () => {
			const newSummary = await getCalendarMonthSummary(month, year);
			setMonthSummary(newSummary);
		});
	};

	// Handle day click
	const handleDayClick = (date: string, items: DeadlineItem[]) => {
		setSelectedDate(selectedDate === date ? null : date);
	};

	// Flatten all deadlines for list view
	const allDeadlines = monthSummary.byDate.flatMap((d) => d.items);

	return (
		<div className="space-y-6">
			{/* View tabs */}
			<div className="flex items-center gap-4 border-b border-[var(--border)]">
				<button
					onClick={() => setActiveTab("calendar")}
					className={cn(
						"px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
						activeTab === "calendar"
							? "border-[var(--accent-500)] text-[var(--accent-600)]"
							: "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
					)}
				>
					<CalendarIcon className="h-4 w-4 inline-block mr-2" />
					Calendar View
				</button>
				<button
					onClick={() => setActiveTab("list")}
					className={cn(
						"px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
						activeTab === "list"
							? "border-[var(--accent-500)] text-[var(--accent-600)]"
							: "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
					)}
				>
					<ListIcon className="h-4 w-4 inline-block mr-2" />
					List View
				</button>

				{/* Loading indicator */}
				{isPending && (
					<span className="text-sm text-[var(--foreground-muted)] ml-auto">
						Loading...
					</span>
				)}
			</div>

			{/* Content */}
			<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
				{/* Main content area */}
				<div className="lg:col-span-3">
					{activeTab === "calendar" ? (
						<CalendarView
							monthSummary={monthSummary}
							onMonthChange={handleMonthChange}
							onDayClick={handleDayClick}
							selectedDate={selectedDate}
						/>
					) : (
						<DeadlineList
							deadlines={allDeadlines}
							title={`Deadlines for ${getMonthName(currentMonth)} ${currentYear}`}
							showFilters
							groupBy="date"
							emptyMessage="No deadlines this month"
							maxHeight="calc(100vh - 300px)"
						/>
					)}
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Upcoming widget */}
					<UpcomingWidget
						deadlines={upcomingDeadlines}
						stats={stats}
						title="Next 30 Days"
						maxItems={8}
						showStats
					/>

					{/* Quick links */}
					<div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4">
						<h3 className="font-semibold text-[var(--foreground)] mb-3">Quick Filters</h3>
						<div className="space-y-2">
							<QuickFilterButton
								label="Overdue"
								count={stats.overdue}
								urgent
								onClick={() => {
									// Could implement filter functionality here
								}}
							/>
							<QuickFilterButton
								label="Due Today"
								count={stats.dueToday}
								onClick={() => {}}
							/>
							<QuickFilterButton
								label="Due This Week"
								count={stats.dueThisWeek}
								onClick={() => {}}
							/>
							<QuickFilterButton
								label="RFP Deadlines"
								count={stats.byType.opportunity}
								onClick={() => {}}
							/>
							<QuickFilterButton
								label="Document Deadlines"
								count={stats.byType.proposal_document}
								onClick={() => {}}
							/>
						</div>
					</div>

					{/* Type breakdown */}
					<div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4">
						<h3 className="font-semibold text-[var(--foreground)] mb-3">By Type</h3>
						<div className="space-y-2">
							<TypeBar type="opportunity" label="RFP Deadlines" count={stats.byType.opportunity} total={stats.total} />
							<TypeBar type="requirement" label="Requirements" count={stats.byType.requirement} total={stats.total} />
							<TypeBar type="proposal_document" label="Documents" count={stats.byType.proposal_document} total={stats.total} />
							<TypeBar type="document_section" label="Sections" count={stats.byType.document_section} total={stats.total} />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function QuickFilterButton({
	label,
	count,
	urgent,
	onClick,
}: {
	label: string;
	count: number;
	urgent?: boolean;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[var(--background-muted)] transition-colors text-left"
		>
			<span className="text-sm text-[var(--foreground)]">{label}</span>
			<span
				className={cn(
					"text-sm font-medium px-2 py-0.5 rounded-full",
					urgent && count > 0
						? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
						: "bg-[var(--background-muted)] text-[var(--foreground-muted)]"
				)}
			>
				{count}
			</span>
		</button>
	);
}

function TypeBar({
	type,
	label,
	count,
	total,
}: {
	type: string;
	label: string;
	count: number;
	total: number;
}) {
	const percentage = total > 0 ? (count / total) * 100 : 0;

	const colors: Record<string, string> = {
		opportunity: "bg-red-500",
		requirement: "bg-amber-500",
		proposal_document: "bg-blue-500",
		document_section: "bg-violet-500",
	};

	return (
		<div>
			<div className="flex items-center justify-between text-sm mb-1">
				<span className="text-[var(--foreground-muted)]">{label}</span>
				<span className="text-[var(--foreground)]">{count}</span>
			</div>
			<div className="h-2 bg-[var(--background-muted)] rounded-full overflow-hidden">
				<div
					className={cn("h-full rounded-full transition-all", colors[type] || "bg-gray-400")}
					style={{ width: `${percentage}%` }}
				/>
			</div>
		</div>
	);
}

// ============================================================================
// Helpers
// ============================================================================

function getMonthName(month: number): string {
	const months = [
		"January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December",
	];
	return months[month - 1] || "";
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

function ListIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M4 6h16M4 10h16M4 14h16M4 18h16"
			/>
		</svg>
	);
}
