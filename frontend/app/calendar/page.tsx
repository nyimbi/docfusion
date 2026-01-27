/**
 * Calendar Page - DocFusion
 *
 * Main calendar dashboard showing all deadlines across opportunities,
 * requirements, documents, and sections.
 */

import { Suspense } from "react";
import Link from "next/link";
import { getCalendarMonthSummary, getUpcomingDeadlines, getDeadlineStats } from "@/lib/actions/calendar";
import { CalendarClientPage } from "./CalendarClientPage";

// ============================================================================
// Server Component
// ============================================================================

interface CalendarPageProps {
	searchParams: Promise<{
		month?: string;
		year?: string;
		view?: string;
		filter?: string;
	}>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
	const params = await searchParams;

	// Parse month/year from query params or use current
	const now = new Date();
	const month = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;
	const year = params.year ? parseInt(params.year, 10) : now.getFullYear();

	// Fetch data in parallel
	const [monthSummary, upcomingDeadlines, stats] = await Promise.all([
		getCalendarMonthSummary(month, year),
		getUpcomingDeadlines({ days: 30, limit: 50 }),
		getDeadlineStats(),
	]);

	return (
		<div className="min-h-screen bg-[var(--background)]">
			{/* Header */}
			<header className="sticky top-0 z-10 bg-[var(--background)] border-b border-[var(--border)]">
				<div className="max-w-7xl mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<div>
							<nav className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] mb-1">
								<Link href="/" className="hover:text-[var(--foreground)]">
									Home
								</Link>
								<span>/</span>
								<span className="text-[var(--foreground)]">Calendar</span>
							</nav>
							<h1 className="text-2xl font-bold text-[var(--foreground)]">
								Deadline Calendar
							</h1>
							<p className="text-sm text-[var(--foreground-muted)] mt-1">
								Track all deadlines across opportunities, documents, and requirements
							</p>
						</div>

						{/* Quick Stats */}
						<div className="flex items-center gap-6">
							{stats.overdue > 0 && (
								<div className="text-center">
									<span className="text-2xl font-bold text-red-600">{stats.overdue}</span>
									<span className="text-xs text-[var(--foreground-muted)] block">Overdue</span>
								</div>
							)}
							<div className="text-center">
								<span className="text-2xl font-bold text-orange-600">{stats.dueToday}</span>
								<span className="text-xs text-[var(--foreground-muted)] block">Due Today</span>
							</div>
							<div className="text-center">
								<span className="text-2xl font-bold text-amber-600">{stats.dueThisWeek}</span>
								<span className="text-xs text-[var(--foreground-muted)] block">This Week</span>
							</div>
							<div className="text-center">
								<span className="text-2xl font-bold text-[var(--foreground)]">{stats.total}</span>
								<span className="text-xs text-[var(--foreground-muted)] block">Total</span>
							</div>
						</div>
					</div>
				</div>
			</header>

			{/* Main content */}
			<main className="max-w-7xl mx-auto px-4 py-6">
				<Suspense fallback={<CalendarSkeleton />}>
					<CalendarClientPage
						initialMonth={month}
						initialYear={year}
						initialMonthSummary={monthSummary}
						upcomingDeadlines={upcomingDeadlines}
						stats={stats}
					/>
				</Suspense>
			</main>
		</div>
	);
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function CalendarSkeleton() {
	return (
		<div className="animate-pulse space-y-6">
			{/* Calendar header skeleton */}
			<div className="flex items-center justify-between">
				<div className="h-8 w-48 bg-[var(--background-muted)] rounded" />
				<div className="h-8 w-32 bg-[var(--background-muted)] rounded" />
			</div>

			{/* Legend skeleton */}
			<div className="flex gap-4">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="flex items-center gap-2">
						<div className="w-3 h-3 bg-[var(--background-muted)] rounded-full" />
						<div className="h-4 w-20 bg-[var(--background-muted)] rounded" />
					</div>
				))}
			</div>

			{/* Calendar grid skeleton */}
			<div className="border border-[var(--border)] rounded-lg overflow-hidden">
				{/* Weekday headers */}
				<div className="grid grid-cols-7 bg-[var(--background-muted)]">
					{[1, 2, 3, 4, 5, 6, 7].map((i) => (
						<div key={i} className="p-2 border-b border-[var(--border)]">
							<div className="h-4 w-8 bg-gray-300 dark:bg-gray-700 rounded mx-auto" />
						</div>
					))}
				</div>

				{/* Calendar days */}
				<div className="grid grid-cols-7">
					{Array.from({ length: 35 }).map((_, i) => (
						<div
							key={i}
							className="h-24 p-1 border border-[var(--border)] bg-[var(--background)]"
						>
							<div className="h-6 w-6 bg-[var(--background-muted)] rounded-full mb-1" />
							<div className="h-3 w-full bg-[var(--background-muted)] rounded mt-2" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Metadata
// ============================================================================

export const metadata = {
	title: "Calendar | DocFusion",
	description: "View and manage all deadlines across your opportunities and documents",
};
