/**
 * CalendarView Component - DocFusion
 *
 * Calendar display with month/week views, color-coded deadline types,
 * and interactive day cells for viewing deadline details.
 */

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type {
	DeadlineItem,
	DeadlinesByDate,
	DeadlineType,
	DeadlineUrgency,
	CalendarMonthSummary,
} from "@/lib/types/opportunity";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

type ViewMode = "month" | "week";

interface CalendarViewProps {
	monthSummary: CalendarMonthSummary;
	onMonthChange?: (month: number, year: number) => void;
	onDayClick?: (date: string, items: DeadlineItem[]) => void;
	selectedDate?: string | null;
	viewMode?: ViewMode;
}

// ============================================================================
// Constants
// ============================================================================

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
];

const TYPE_COLORS: Record<DeadlineType, { bg: string; text: string; dot: string }> = {
	opportunity: {
		bg: "bg-red-100 dark:bg-red-900/30",
		text: "text-red-700 dark:text-red-300",
		dot: "bg-red-500",
	},
	requirement: {
		bg: "bg-amber-100 dark:bg-amber-900/30",
		text: "text-amber-700 dark:text-amber-300",
		dot: "bg-amber-500",
	},
	proposal_document: {
		bg: "bg-blue-100 dark:bg-blue-900/30",
		text: "text-blue-700 dark:text-blue-300",
		dot: "bg-blue-500",
	},
	document_section: {
		bg: "bg-violet-100 dark:bg-violet-900/30",
		text: "text-violet-700 dark:text-violet-300",
		dot: "bg-violet-500",
	},
	review: {
		bg: "bg-teal-100 dark:bg-teal-900/30",
		text: "text-teal-700 dark:text-teal-300",
		dot: "bg-teal-500",
	},
	submission: {
		bg: "bg-emerald-100 dark:bg-emerald-900/30",
		text: "text-emerald-700 dark:text-emerald-300",
		dot: "bg-emerald-500",
	},
};

const URGENCY_STYLES: Record<DeadlineUrgency, string> = {
	overdue: "ring-2 ring-red-500 ring-inset",
	critical: "ring-2 ring-orange-500 ring-inset",
	urgent: "ring-2 ring-amber-500 ring-inset",
	upcoming: "",
	normal: "",
};

// ============================================================================
// Helper Functions
// ============================================================================

function getDaysInMonth(month: number, year: number): number {
	return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(month: number, year: number): number {
	return new Date(year, month - 1, 1).getDay();
}

function formatDateKey(year: number, month: number, day: number): string {
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isToday(dateKey: string): boolean {
	const today = new Date();
	const todayKey = formatDateKey(
		today.getFullYear(),
		today.getMonth() + 1,
		today.getDate()
	);
	return dateKey === todayKey;
}

// ============================================================================
// Sub-Components
// ============================================================================

function DeadlineDot({ type }: { type: DeadlineType }) {
	return (
		<span
			className={cn("w-2 h-2 rounded-full flex-shrink-0", TYPE_COLORS[type].dot)}
			title={type.replace("_", " ")}
		/>
	);
}

function DayCell({
	day,
	month,
	year,
	items,
	isCurrentMonth,
	isSelected,
	onClick,
}: {
	day: number;
	month: number;
	year: number;
	items: DeadlineItem[];
	isCurrentMonth: boolean;
	isSelected: boolean;
	onClick?: () => void;
}) {
	const dateKey = formatDateKey(year, month, day);
	const isTodayCell = isToday(dateKey);
	const hasDeadlines = items.length > 0;

	// Get most urgent item for cell styling
	const mostUrgent = items.reduce<DeadlineUrgency | null>((acc, item) => {
		if (!acc) return item.urgency;
		const priority: DeadlineUrgency[] = ["overdue", "critical", "urgent", "upcoming", "normal"];
		return priority.indexOf(item.urgency) < priority.indexOf(acc) ? item.urgency : acc;
	}, null);

	return (
		<button
			onClick={onClick}
			disabled={!isCurrentMonth}
			className={cn(
				"h-24 p-1 text-left border border-[var(--border)] transition-all",
				"hover:bg-[var(--background-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-inset",
				!isCurrentMonth && "bg-[var(--background-muted)] opacity-50 cursor-not-allowed",
				isCurrentMonth && "bg-[var(--background)]",
				isSelected && "ring-2 ring-[var(--accent-500)] ring-inset",
				mostUrgent && isCurrentMonth && URGENCY_STYLES[mostUrgent]
			)}
		>
			<div className="flex items-center justify-between mb-1">
				<span
					className={cn(
						"text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
						isTodayCell
							? "bg-[var(--accent-500)] text-white"
							: isCurrentMonth
								? "text-[var(--foreground)]"
								: "text-[var(--foreground-muted)]"
					)}
				>
					{day}
				</span>
				{hasDeadlines && (
					<span className="text-xs font-medium text-[var(--foreground-muted)]">
						{items.length}
					</span>
				)}
			</div>

			{/* Deadline dots */}
			{hasDeadlines && (
				<div className="flex flex-wrap gap-0.5">
					{items.slice(0, 6).map((item) => (
						<DeadlineDot key={item.id} type={item.type} />
					))}
					{items.length > 6 && (
						<span className="text-xs text-[var(--foreground-muted)]">
							+{items.length - 6}
						</span>
					)}
				</div>
			)}

			{/* First item preview */}
			{items.length > 0 && (
				<div className="mt-1 overflow-hidden">
					<span
						className={cn(
							"text-xs line-clamp-1 px-1 rounded",
							TYPE_COLORS[items[0].type].bg,
							TYPE_COLORS[items[0].type].text
						)}
					>
						{items[0].title}
					</span>
				</div>
			)}
		</button>
	);
}

function DayDetailPanel({
	date,
	items,
	onClose,
}: {
	date: string;
	items: DeadlineItem[];
	onClose: () => void;
}) {
	const dateObj = new Date(date + "T00:00:00");
	const formattedDate = dateObj.toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	return (
		<div className="bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg p-4">
			<div className="flex items-center justify-between mb-4">
				<h3 className="font-semibold text-[var(--foreground)]">{formattedDate}</h3>
				<button
					onClick={onClose}
					className="p-1 rounded hover:bg-[var(--background-muted)] transition-colors"
					aria-label="Close"
				>
					<CloseIcon className="h-4 w-4 text-[var(--foreground-muted)]" />
				</button>
			</div>

			{items.length === 0 ? (
				<p className="text-sm text-[var(--foreground-muted)]">No deadlines on this day.</p>
			) : (
				<div className="space-y-2 max-h-64 overflow-y-auto">
					{items.map((item) => (
						<Link
							key={item.id}
							href={`/opportunities/${item.opportunityId}`}
							className={cn(
								"block p-2 rounded-lg transition-colors hover:opacity-80",
								TYPE_COLORS[item.type].bg
							)}
						>
							<div className="flex items-start gap-2">
								<DeadlineDot type={item.type} />
								<div className="flex-1 min-w-0">
									<p
										className={cn(
											"text-sm font-medium line-clamp-1",
											TYPE_COLORS[item.type].text
										)}
									>
										{item.title}
									</p>
									<p className="text-xs text-[var(--foreground-muted)] line-clamp-1">
										{item.opportunityTitle}
									</p>
									{item.assignedTo && (
										<p className="text-xs text-[var(--foreground-muted)]">
											Assigned: {item.assignedTo}
										</p>
									)}
								</div>
								<UrgencyBadge urgency={item.urgency} />
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}

function UrgencyBadge({ urgency }: { urgency: DeadlineUrgency }) {
	const styles: Record<DeadlineUrgency, { bg: string; text: string; label: string }> = {
		overdue: { bg: "bg-red-100", text: "text-red-700", label: "Overdue" },
		critical: { bg: "bg-orange-100", text: "text-orange-700", label: "Critical" },
		urgent: { bg: "bg-amber-100", text: "text-amber-700", label: "Urgent" },
		upcoming: { bg: "bg-blue-100", text: "text-blue-700", label: "Soon" },
		normal: { bg: "bg-gray-100", text: "text-gray-700", label: "" },
	};

	if (urgency === "normal") return null;

	return (
		<span
			className={cn(
				"text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0",
				styles[urgency].bg,
				styles[urgency].text
			)}
		>
			{styles[urgency].label}
		</span>
	);
}

function Legend() {
	return (
		<div className="flex flex-wrap gap-4 text-sm">
			{(Object.entries(TYPE_COLORS) as [DeadlineType, typeof TYPE_COLORS[DeadlineType]][]).map(
				([type, colors]) => (
					<div key={type} className="flex items-center gap-1.5">
						<span className={cn("w-3 h-3 rounded-full", colors.dot)} />
						<span className="text-[var(--foreground-muted)] capitalize">
							{type.replace(/_/g, " ")}
						</span>
					</div>
				)
			)}
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function CalendarView({
	monthSummary,
	onMonthChange,
	onDayClick,
	selectedDate,
	viewMode = "month",
}: CalendarViewProps) {
	const [localSelectedDate, setLocalSelectedDate] = useState<string | null>(
		selectedDate || null
	);

	const { month, year, byDate } = monthSummary;

	// Create a map of date -> items for quick lookup
	const itemsByDate = useMemo(() => {
		const map = new Map<string, DeadlineItem[]>();
		for (const day of byDate) {
			map.set(day.date, day.items);
		}
		return map;
	}, [byDate]);

	// Calculate calendar grid
	const daysInMonth = getDaysInMonth(month, year);
	const firstDayOfMonth = getFirstDayOfMonth(month, year);

	// Previous month days to fill the first week
	const prevMonth = month === 1 ? 12 : month - 1;
	const prevYear = month === 1 ? year - 1 : year;
	const daysInPrevMonth = getDaysInMonth(prevMonth, prevYear);

	// Build calendar grid
	const calendarDays: Array<{
		day: number;
		month: number;
		year: number;
		isCurrentMonth: boolean;
	}> = [];

	// Previous month trailing days
	for (let i = firstDayOfMonth - 1; i >= 0; i--) {
		calendarDays.push({
			day: daysInPrevMonth - i,
			month: prevMonth,
			year: prevYear,
			isCurrentMonth: false,
		});
	}

	// Current month days
	for (let day = 1; day <= daysInMonth; day++) {
		calendarDays.push({
			day,
			month,
			year,
			isCurrentMonth: true,
		});
	}

	// Next month leading days
	const nextMonth = month === 12 ? 1 : month + 1;
	const nextYear = month === 12 ? year + 1 : year;
	const remainingCells = 42 - calendarDays.length; // 6 weeks * 7 days
	for (let day = 1; day <= remainingCells; day++) {
		calendarDays.push({
			day,
			month: nextMonth,
			year: nextYear,
			isCurrentMonth: false,
		});
	}

	const handleDayClick = (dateKey: string) => {
		const items = itemsByDate.get(dateKey) || [];
		setLocalSelectedDate(localSelectedDate === dateKey ? null : dateKey);
		onDayClick?.(dateKey, items);
	};

	const handlePrevMonth = () => {
		const newMonth = month === 1 ? 12 : month - 1;
		const newYear = month === 1 ? year - 1 : year;
		onMonthChange?.(newMonth, newYear);
	};

	const handleNextMonth = () => {
		const newMonth = month === 12 ? 1 : month + 1;
		const newYear = month === 12 ? year + 1 : year;
		onMonthChange?.(newMonth, newYear);
	};

	const handleToday = () => {
		const today = new Date();
		onMonthChange?.(today.getMonth() + 1, today.getFullYear());
	};

	const selectedDateItems = localSelectedDate
		? itemsByDate.get(localSelectedDate) || []
		: [];

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<h2 className="text-xl font-semibold text-[var(--foreground)]">
						{MONTHS[month - 1]} {year}
					</h2>
					<div className="flex items-center gap-1">
						<button
							onClick={handlePrevMonth}
							className="p-1.5 rounded-lg hover:bg-[var(--background-muted)] transition-colors"
							aria-label="Previous month"
						>
							<ChevronLeftIcon className="h-5 w-5 text-[var(--foreground-muted)]" />
						</button>
						<button
							onClick={handleNextMonth}
							className="p-1.5 rounded-lg hover:bg-[var(--background-muted)] transition-colors"
							aria-label="Next month"
						>
							<ChevronRightIcon className="h-5 w-5 text-[var(--foreground-muted)]" />
						</button>
					</div>
					<button
						onClick={handleToday}
						className="px-3 py-1 text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--background-muted)] transition-colors"
					>
						Today
					</button>
				</div>

				{/* Stats Summary */}
				<div className="flex items-center gap-4 text-sm">
					{monthSummary.overdueCount > 0 && (
						<span className="text-red-600 font-medium">
							{monthSummary.overdueCount} overdue
						</span>
					)}
					{monthSummary.criticalCount > 0 && (
						<span className="text-orange-600 font-medium">
							{monthSummary.criticalCount} critical
						</span>
					)}
					<span className="text-[var(--foreground-muted)]">
						{monthSummary.totalDeadlines} total
					</span>
				</div>
			</div>

			{/* Legend */}
			<Legend />

			{/* Calendar Grid */}
			<div className="border border-[var(--border)] rounded-lg overflow-hidden">
				{/* Weekday Headers */}
				<div className="grid grid-cols-7 bg-[var(--background-muted)]">
					{WEEKDAYS.map((day) => (
						<div
							key={day}
							className="p-2 text-center text-sm font-medium text-[var(--foreground-muted)] border-b border-[var(--border)]"
						>
							{day}
						</div>
					))}
				</div>

				{/* Calendar Days */}
				<div className="grid grid-cols-7">
					{calendarDays.map((cell, index) => {
						const dateKey = formatDateKey(cell.year, cell.month, cell.day);
						const items = cell.isCurrentMonth
							? itemsByDate.get(dateKey) || []
							: [];
						return (
							<DayCell
								key={index}
								day={cell.day}
								month={cell.month}
								year={cell.year}
								items={items}
								isCurrentMonth={cell.isCurrentMonth}
								isSelected={localSelectedDate === dateKey}
								onClick={() => cell.isCurrentMonth && handleDayClick(dateKey)}
							/>
						);
					})}
				</div>
			</div>

			{/* Selected Day Detail */}
			{localSelectedDate && (
				<DayDetailPanel
					date={localSelectedDate}
					items={selectedDateItems}
					onClose={() => setLocalSelectedDate(null)}
				/>
			)}
		</div>
	);
}

// ============================================================================
// Icons
// ============================================================================

function ChevronLeftIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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

function CloseIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
		</svg>
	);
}
