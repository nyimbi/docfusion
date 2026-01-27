/**
 * Calendar Page - DocFusion
 *
 * Deadline and milestone tracking calendar.
 * Design: "Command Center Elegance" - Dark theme
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Calendar as CalendarIcon,
	ChevronLeft,
	ChevronRight,
	Clock,
	Target,
	FileText,
	AlertCircle,
} from "lucide-react";

// Placeholder calendar data
const upcomingDeadlines = [
	{
		id: "1",
		title: "USAID Technical Proposal",
		type: "submission",
		date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
		priority: "high",
	},
	{
		id: "2",
		title: "WHO EOI Response",
		type: "submission",
		date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
		priority: "medium",
	},
	{
		id: "3",
		title: "Draft Review - NGO Proposal",
		type: "review",
		date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
		priority: "high",
	},
	{
		id: "4",
		title: "Partner Meeting - AfDB Project",
		type: "meeting",
		date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
		priority: "low",
	},
];

export default function CalendarPage() {
	const [currentDate, setCurrentDate] = React.useState(new Date());

	const monthNames = [
		"January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December"
	];

	const navigateMonth = (direction: "prev" | "next") => {
		setCurrentDate((prev) => {
			const newDate = new Date(prev);
			if (direction === "prev") {
				newDate.setMonth(newDate.getMonth() - 1);
			} else {
				newDate.setMonth(newDate.getMonth() + 1);
			}
			return newDate;
		});
	};

	// Generate calendar days
	const generateCalendarDays = () => {
		const year = currentDate.getFullYear();
		const month = currentDate.getMonth();
		const firstDay = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const days = [];

		// Empty cells for days before the first of the month
		for (let i = 0; i < firstDay; i++) {
			days.push(null);
		}

		// Days of the month
		for (let i = 1; i <= daysInMonth; i++) {
			days.push(i);
		}

		return days;
	};

	const days = generateCalendarDays();
	const today = new Date();
	const isCurrentMonth = currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();

	const priorityColors = {
		high: "border-l-destructive bg-destructive/10",
		medium: "border-l-amber-500 bg-amber-500/10",
		low: "border-l-blue-500 bg-blue-500/10",
	};

	const typeIcons = {
		submission: Target,
		review: FileText,
		meeting: Clock,
	};

	return (
		<div className="relative">
			{/* Page Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-foreground mb-1">
						Calendar
					</h1>
					<p className="text-sm text-muted-foreground">
						Track deadlines, reviews, and important milestones
					</p>
				</div>
				<Button>
					<CalendarIcon className="h-4 w-4" />
					<span className="hidden sm:inline">Add Event</span>
				</Button>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Calendar */}
				<div className="lg:col-span-2 rounded-xl border bg-card p-6 shadow-sm">
					{/* Month Navigation */}
					<div className="flex items-center justify-between mb-6">
						<h2 className="text-lg font-semibold text-foreground">
							{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
						</h2>
						<div className="flex items-center gap-2">
							<button
								onClick={() => navigateMonth("prev")}
								className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
							>
								<ChevronLeft className="h-5 w-5" />
							</button>
							<button
								onClick={() => setCurrentDate(new Date())}
								className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
							>
								Today
							</button>
							<button
								onClick={() => navigateMonth("next")}
								className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
							>
								<ChevronRight className="h-5 w-5" />
							</button>
						</div>
					</div>

					{/* Day Headers */}
					<div className="grid grid-cols-7 gap-1 mb-2">
						{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
							<div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
								{day}
							</div>
						))}
					</div>

					{/* Calendar Grid */}
					<div className="grid grid-cols-7 gap-1">
						{days.map((day, index) => {
							const isToday = isCurrentMonth && day === today.getDate();
							return (
								<div
									key={index}
									className={cn(
										"aspect-square flex items-center justify-center rounded-lg text-sm",
										day !== null && "cursor-pointer hover:bg-accent transition-colors",
										isToday && "bg-primary text-primary-foreground font-semibold",
										!isToday && day !== null && "text-foreground",
										day === null && "text-transparent"
									)}
								>
									{day}
								</div>
							);
						})}
					</div>
				</div>

				{/* Upcoming Deadlines */}
				<div className="rounded-xl border bg-card p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-foreground mb-4">
						Upcoming Deadlines
					</h2>

					<div className="space-y-3">
						{upcomingDeadlines.map((deadline, index) => {
							const Icon = typeIcons[deadline.type as keyof typeof typeIcons];
							const daysLeft = Math.ceil((deadline.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

							return (
								<div
									key={deadline.id}
									className={cn(
										"p-4 rounded-xl border-l-4 transition-all duration-300 ease-out",
										"animate-fade-up",
										priorityColors[deadline.priority as keyof typeof priorityColors]
									)}
									style={{
										animationDelay: `${index * 50}ms`,
										animationFillMode: "forwards",
									}}
								>
									<div className="flex items-start gap-3">
										<div className="p-2 rounded-lg bg-background/50">
											<Icon className="h-4 w-4 text-muted-foreground" />
										</div>
										<div className="flex-1 min-w-0">
											<h3 className="text-sm font-medium text-foreground line-clamp-1">
												{deadline.title}
											</h3>
											<p className="text-xs text-muted-foreground mt-1">
												{deadline.date.toLocaleDateString("en-US", {
													weekday: "short",
													month: "short",
													day: "numeric",
												})}
											</p>
										</div>
										<span
											className={cn(
												"text-xs font-medium px-2 py-1 rounded-full",
												daysLeft <= 3
													? "bg-destructive/20 text-destructive"
													: "bg-muted text-muted-foreground"
											)}
										>
											{daysLeft}d
										</span>
									</div>
								</div>
							);
						})}
					</div>

					{/* Quick Stats */}
					<div className="mt-6 pt-6 border-t border-border">
						<div className="grid grid-cols-2 gap-4">
							<div className="text-center">
								<div className="text-2xl font-bold text-destructive tabular-nums">2</div>
								<div className="text-xs text-muted-foreground">Urgent</div>
							</div>
							<div className="text-center">
								<div className="text-2xl font-bold text-primary tabular-nums">4</div>
								<div className="text-xs text-muted-foreground">This Week</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
