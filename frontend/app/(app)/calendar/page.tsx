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
	Loader2,
	Plus,
	X,
} from "lucide-react";
import { getUpcomingDeadlines, type CalendarDeadline } from "@/lib/actions/opportunities-crud";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CalendarPage() {
	const [currentDate, setCurrentDate] = React.useState(new Date());
	const [upcomingDeadlines, setUpcomingDeadlines] = React.useState<CalendarDeadline[]>([]);
	const [isLoading, setIsLoading] = React.useState(true);
	const [showAddEvent, setShowAddEvent] = React.useState(false);
	const [newEvent, setNewEvent] = React.useState({
		title: "",
		date: "",
		type: "meeting" as "submission" | "review" | "meeting",
		priority: "medium" as "high" | "medium" | "low",
	});

	// Fetch deadlines on mount
	React.useEffect(() => {
		async function loadDeadlines() {
			try {
				const deadlines = await getUpcomingDeadlines(60); // 60 days ahead
				setUpcomingDeadlines(deadlines);
			} catch (error) {
				console.error("Failed to load deadlines:", error);
			} finally {
				setIsLoading(false);
			}
		}
		loadDeadlines();
	}, []);

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

	const handleAddEvent = () => {
		if (!newEvent.title || !newEvent.date) {
			toast.error("Please fill in all required fields");
			return;
		}

		// Add to local state (will be replaced with server action when available)
		const eventDate = new Date(newEvent.date);
		const daysLeft = Math.ceil((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

		const newDeadline: CalendarDeadline = {
			id: `custom-${Date.now()}`,
			title: newEvent.title,
			date: newEvent.date,
			type: newEvent.type,
			priority: newEvent.priority,
			daysLeft,
		};

		setUpcomingDeadlines((prev) => [...prev, newDeadline].sort((a, b) =>
			new Date(a.date).getTime() - new Date(b.date).getTime()
		));

		toast.success("Event added to calendar");
		setShowAddEvent(false);
		setNewEvent({ title: "", date: "", type: "meeting", priority: "medium" });
	};

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
		<div className="h-full overflow-y-auto p-6 relative">
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
				<Button onClick={() => setShowAddEvent(true)}>
					<Plus className="h-4 w-4" />
					<span className="hidden sm:inline">Add Event</span>
				</Button>
			</div>

			{/* Add Event Dialog */}
			<Dialog open={showAddEvent} onOpenChange={setShowAddEvent}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Add Calendar Event</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="event-title">Event Title *</Label>
							<Input
								id="event-title"
								placeholder="Enter event title"
								value={newEvent.title}
								onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="event-date">Date *</Label>
							<Input
								id="event-date"
								type="date"
								value={newEvent.date}
								onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
							/>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>Type</Label>
								<Select
									value={newEvent.type}
									onValueChange={(value) => setNewEvent({ ...newEvent, type: value as "submission" | "review" | "meeting" })}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="submission">Submission</SelectItem>
										<SelectItem value="review">Review</SelectItem>
										<SelectItem value="meeting">Meeting</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label>Priority</Label>
								<Select
									value={newEvent.priority}
									onValueChange={(value) => setNewEvent({ ...newEvent, priority: value as "high" | "medium" | "low" })}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="high">High</SelectItem>
										<SelectItem value="medium">Medium</SelectItem>
										<SelectItem value="low">Low</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="flex justify-end gap-2 pt-4">
							<Button variant="outline" onClick={() => setShowAddEvent(false)}>
								Cancel
							</Button>
							<Button onClick={handleAddEvent}>
								Add Event
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

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

					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					) : upcomingDeadlines.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
							<p className="text-sm">No upcoming deadlines</p>
						</div>
					) : (
						<div className="space-y-3">
							{upcomingDeadlines.map((deadline, index) => {
								const Icon = typeIcons[deadline.type as keyof typeof typeIcons] || Target;
								const deadlineDate = new Date(deadline.date);
								const daysLeft = deadline.daysLeft ?? Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

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
													{deadlineDate.toLocaleDateString("en-US", {
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
					)}

					{/* Quick Stats */}
					<div className="mt-6 pt-6 border-t border-border">
						<div className="grid grid-cols-2 gap-4">
							<div className="text-center">
								<div className="text-2xl font-bold text-destructive tabular-nums">
									{upcomingDeadlines.filter(d => (d.daysLeft ?? 0) <= 3).length}
								</div>
								<div className="text-xs text-muted-foreground">Urgent</div>
							</div>
							<div className="text-center">
								<div className="text-2xl font-bold text-primary tabular-nums">
									{upcomingDeadlines.filter(d => (d.daysLeft ?? 0) <= 7).length}
								</div>
								<div className="text-xs text-muted-foreground">This Week</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
