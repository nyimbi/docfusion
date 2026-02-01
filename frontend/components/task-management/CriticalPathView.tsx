"use client";

/**
 * CriticalPathView - Timeline visualization of task dependencies.
 *
 * Features:
 * - Gantt-style timeline display
 * - Dependency visualization with arrows
 * - Critical path highlighting
 * - Milestone markers
 * - Zoom and scroll controls
 * - Task status indicators on timeline
 */

import React, { useState, useMemo, useCallback, useRef } from "react";
import {
	Calendar,
	ChevronLeft,
	ChevronRight,
	ZoomIn,
	ZoomOut,
	AlertTriangle,
	Target,
	Flag,
	Clock,
	ArrowRight,
	MoreVertical,
	Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ProposalTask } from "@/lib/db/schema-tasks";

// ============================================================================
// Types
// ============================================================================

interface TimelineTask extends ProposalTask {
	level: number; // Row level for layout
	startX: number; // Position in pixels
	width: number; // Width in pixels
	isCritical: boolean;
	dependencies: TimelineTask[];
}

interface Milestone {
	id: string;
	label: string;
	date: Date;
	type: "deadline" | "checkpoint" | "review";
}

export interface CriticalPathViewProps {
	tasks: ProposalTask[];
	criticalPath: string[]; // Array of task IDs in critical path
	milestones?: Milestone[];
	proposalDeadline?: Date;
	loading?: boolean;
	onTaskClick?: (task: ProposalTask) => void;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DAY_WIDTH_OPTIONS = {
	day: 40,
	week: 15,
	month: 4,
};

const STATUS_COLORS: Record<string, string> = {
	pending: "bg-gray-300",
	assigned: "bg-blue-400",
	in_progress: "bg-amber-400",
	review: "bg-purple-400",
	blocked: "bg-red-400",
	completed: "bg-green-400",
	cancelled: "bg-gray-200",
};

// ============================================================================
// Helper Functions
// ============================================================================

function getDaysBetween(start: Date, end: Date): number {
	return Math.ceil(
		(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
	);
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

function formatDate(date: Date): string {
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}

function getWeekNumber(date: Date): number {
	const firstDay = new Date(date.getFullYear(), 0, 1);
	const pastDaysOfYear = (date.getTime() - firstDay.getTime()) / 86400000;
	return Math.ceil((pastDaysOfYear + firstDay.getDay() + 1) / 7);
}

// ============================================================================
// Timeline Header Component
// ============================================================================

interface TimelineHeaderProps {
	startDate: Date;
	endDate: Date;
	dayWidth: number;
	today: Date;
}

function TimelineHeader({
	startDate,
	endDate,
	dayWidth,
	today,
}: TimelineHeaderProps) {
	const days = getDaysBetween(startDate, endDate);
	const dates: Date[] = [];

	for (let i = 0; i <= days; i++) {
		dates.push(addDays(startDate, i));
	}

	// Group by week
	const weeks: { start: Date; days: Date[] }[] = [];
	let currentWeek: { start: Date; days: Date[] } | null = null;

	dates.forEach((date) => {
		const weekNum = getWeekNumber(date);
		if (!currentWeek || getWeekNumber(currentWeek.start) !== weekNum) {
			if (currentWeek) weeks.push(currentWeek);
			currentWeek = { start: date, days: [date] };
		} else {
			currentWeek.days.push(date);
		}
	});
	if (currentWeek) weeks.push(currentWeek);

	return (
		<div className="flex flex-col border-b sticky top-0 bg-white z-10">
			{/* Week labels */}
			<div className="flex border-b">
				<div className="w-64 flex-shrink-0 px-3 py-1 text-xs font-medium text-gray-500 bg-gray-50">
					Task
				</div>
				<div className="flex">
					{weeks.map((week, i) => (
						<div
							key={i}
							style={{ width: week.days.length * dayWidth }}
							className="text-xs font-medium text-gray-500 px-1 py-1 border-l bg-gray-50"
						>
							Week {getWeekNumber(week.start)}
						</div>
					))}
				</div>
			</div>

			{/* Day labels */}
			<div className="flex">
				<div className="w-64 flex-shrink-0" />
				<div className="flex">
					{dates.map((date, i) => {
						const isToday = date.toDateString() === today.toDateString();
						const isWeekend = date.getDay() === 0 || date.getDay() === 6;

						return (
							<div
								key={i}
								style={{ width: dayWidth }}
								className={cn(
									"text-xs text-center py-1 border-l",
									isToday && "bg-blue-100 font-bold",
									isWeekend && !isToday && "bg-gray-50"
								)}
							>
								{dayWidth >= 20 ? (
									<span>{date.getDate()}</span>
								) : (
									date.getDate() % 7 === 1 && <span>{date.getDate()}</span>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Task Bar Component
// ============================================================================

interface TaskBarProps {
	task: TimelineTask;
	onClick?: () => void;
}

function TaskBar({ task, onClick }: TaskBarProps) {
	const statusColor = STATUS_COLORS[task.status ?? "pending"];
	const progress = task.progress ?? 0;

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div
						className={cn(
							"absolute h-6 rounded cursor-pointer transition-all",
							"hover:ring-2 hover:ring-blue-400 hover:ring-offset-1",
							task.isCritical && "ring-2 ring-red-400",
							statusColor
						)}
						style={{
							left: task.startX,
							width: Math.max(task.width, 20),
							top: "50%",
							transform: "translateY(-50%)",
						}}
						onClick={onClick}
					>
						{/* Progress fill */}
						{progress > 0 && (
							<div
								className="absolute inset-0 bg-black/20 rounded-l"
								style={{ width: `${progress}%` }}
							/>
						)}

						{/* Label */}
						{task.width > 60 && (
							<span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-white truncate">
								{task.title}
							</span>
						)}

						{/* Critical indicator */}
						{task.isCritical && (
							<AlertTriangle className="absolute -top-1 -right-1 w-3 h-3 text-red-600" />
						)}
					</div>
				</TooltipTrigger>
				<TooltipContent side="top" className="max-w-xs">
					<div className="space-y-1">
						<p className="font-medium">{task.title}</p>
						<div className="flex items-center gap-2 text-xs">
							<Badge
								variant="outline"
								className="capitalize"
							>
								{task.status}
							</Badge>
							<span>{progress}% complete</span>
						</div>
						{task.startDate && task.dueDate && (
							<p className="text-xs text-gray-500">
								{formatDate(new Date(task.startDate))} -{" "}
								{formatDate(new Date(task.dueDate))}
							</p>
						)}
						{task.isCritical && (
							<p className="text-xs text-red-600 font-medium">
								Critical path task
							</p>
						)}
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function CriticalPathView({
	tasks,
	criticalPath,
	milestones = [],
	proposalDeadline,
	loading = false,
	onTaskClick,
	className,
}: CriticalPathViewProps) {
	const [zoomLevel, setZoomLevel] = useState<keyof typeof DAY_WIDTH_OPTIONS>(
		"week"
	);
	const [scrollPosition, setScrollPosition] = useState(0);
	const scrollRef = useRef<HTMLDivElement>(null);

	const dayWidth = DAY_WIDTH_OPTIONS[zoomLevel];

	// Calculate timeline bounds
	const { startDate, endDate, today } = useMemo(() => {
		const now = new Date();
		now.setHours(0, 0, 0, 0);

		let earliest = now;
		let latest = proposalDeadline ?? addDays(now, 30);

		tasks.forEach((task) => {
			if (task.startDate) {
				const start = new Date(task.startDate);
				if (start < earliest) earliest = start;
			}
			if (task.dueDate) {
				const due = new Date(task.dueDate);
				if (due > latest) latest = due;
			}
		});

		// Add padding
		earliest = addDays(earliest, -3);
		latest = addDays(latest, 7);

		return { startDate: earliest, endDate: latest, today: now };
	}, [tasks, proposalDeadline]);

	// Create critical path set for O(1) lookup
	const criticalPathSet = useMemo(() => new Set(criticalPath), [criticalPath]);

	// Process tasks for timeline display
	const timelineTasks: TimelineTask[] = useMemo(() => {
		const taskMap = new Map<string, ProposalTask>();
		tasks.forEach((t) => taskMap.set(t.id, t));

		// Sort by start date, then by critical path priority
		const sortedTasks = [...tasks]
			.filter((t) => t.startDate || t.dueDate)
			.sort((a, b) => {
				const aStart = a.startDate
					? new Date(a.startDate).getTime()
					: a.dueDate
						? new Date(a.dueDate).getTime() - 7 * 24 * 60 * 60 * 1000
						: Date.now();
				const bStart = b.startDate
					? new Date(b.startDate).getTime()
					: b.dueDate
						? new Date(b.dueDate).getTime() - 7 * 24 * 60 * 60 * 1000
						: Date.now();

				// Critical path first
				if (criticalPathSet.has(a.id) && !criticalPathSet.has(b.id)) return -1;
				if (!criticalPathSet.has(a.id) && criticalPathSet.has(b.id)) return 1;

				return aStart - bStart;
			});

		// Assign levels (simple greedy algorithm)
		const levels: { end: number }[] = [];

		return sortedTasks.map((task) => {
			const taskStart = task.startDate
				? new Date(task.startDate)
				: task.dueDate
					? addDays(new Date(task.dueDate), -7)
					: today;
			const taskEnd = task.dueDate
				? new Date(task.dueDate)
				: addDays(taskStart, 7);

			const startDays = getDaysBetween(startDate, taskStart);
			const durationDays = Math.max(getDaysBetween(taskStart, taskEnd), 1);

			const startX = startDays * dayWidth;
			const width = durationDays * dayWidth;

			// Find available level
			let level = 0;
			for (let i = 0; i < levels.length; i++) {
				if (levels[i].end < startX) {
					level = i;
					break;
				}
				level = i + 1;
			}

			if (!levels[level]) {
				levels[level] = { end: startX + width + 5 };
			} else {
				levels[level].end = Math.max(levels[level].end, startX + width + 5);
			}

			// Get dependencies
			const dependencies: TimelineTask[] = [];
			(task.dependsOn ?? []).forEach((depId) => {
				const dep = taskMap.get(depId);
				if (dep) dependencies.push(dep as TimelineTask);
			});

			return {
				...task,
				level,
				startX,
				width,
				isCritical: criticalPathSet.has(task.id),
				dependencies,
			};
		});
	}, [tasks, criticalPathSet, startDate, today, dayWidth]);

	// Calculate total timeline width
	const totalDays = getDaysBetween(startDate, endDate);
	const timelineWidth = totalDays * dayWidth;

	// Handlers
	const handleZoomIn = useCallback(() => {
		if (zoomLevel === "month") setZoomLevel("week");
		else if (zoomLevel === "week") setZoomLevel("day");
	}, [zoomLevel]);

	const handleZoomOut = useCallback(() => {
		if (zoomLevel === "day") setZoomLevel("week");
		else if (zoomLevel === "week") setZoomLevel("month");
	}, [zoomLevel]);

	const scrollToToday = useCallback(() => {
		if (!scrollRef.current) return;
		const todayOffset = getDaysBetween(startDate, today) * dayWidth;
		scrollRef.current.scrollLeft = Math.max(0, todayOffset - 200);
	}, [startDate, today, dayWidth]);

	// Critical path summary
	const criticalPathSummary = useMemo(() => {
		const criticalTasks = timelineTasks.filter((t) => t.isCritical);
		const blockedCritical = criticalTasks.filter(
			(t) => t.status === "blocked"
		).length;
		const lateCritical = criticalTasks.filter(
			(t) => t.dueDate && new Date(t.dueDate) < today && t.status !== "completed"
		).length;

		return {
			total: criticalTasks.length,
			blockedCritical,
			lateCritical,
		};
	}, [timelineTasks, today]);

	if (loading) {
		return (
			<div className={cn("flex items-center justify-center py-12", className)}>
				<Loader2 className="w-8 h-8 animate-spin text-gray-400" />
			</div>
		);
	}

	return (
		<div className={cn("flex flex-col gap-4", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold flex items-center gap-2">
						<Target className="w-5 h-5" />
						Critical Path
					</h2>
					<p className="text-sm text-gray-500">
						{criticalPathSummary.total} tasks on critical path
						{criticalPathSummary.blockedCritical > 0 && (
							<span className="text-red-600 ml-2">
								• {criticalPathSummary.blockedCritical} blocked
							</span>
						)}
						{criticalPathSummary.lateCritical > 0 && (
							<span className="text-orange-600 ml-2">
								• {criticalPathSummary.lateCritical} overdue
							</span>
						)}
					</p>
				</div>

				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={scrollToToday}>
						<Calendar className="w-4 h-4 mr-1" />
						Today
					</Button>

					<div className="flex items-center border rounded">
						<Button
							variant="ghost"
							size="sm"
							onClick={handleZoomOut}
							disabled={zoomLevel === "month"}
							className="h-8 px-2"
						>
							<ZoomOut className="w-4 h-4" />
						</Button>
						<span className="text-xs px-2 capitalize">{zoomLevel}</span>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleZoomIn}
							disabled={zoomLevel === "day"}
							className="h-8 px-2"
						>
							<ZoomIn className="w-4 h-4" />
						</Button>
					</div>
				</div>
			</div>

			{/* Legend */}
			<div className="flex items-center gap-4 text-xs">
				<div className="flex items-center gap-1">
					<div className="w-3 h-3 rounded bg-amber-400" />
					<span>In Progress</span>
				</div>
				<div className="flex items-center gap-1">
					<div className="w-3 h-3 rounded bg-green-400" />
					<span>Completed</span>
				</div>
				<div className="flex items-center gap-1">
					<div className="w-3 h-3 rounded bg-red-400" />
					<span>Blocked</span>
				</div>
				<div className="flex items-center gap-1">
					<div className="w-3 h-3 rounded ring-2 ring-red-400 bg-white" />
					<span>Critical Path</span>
				</div>
			</div>

			{/* Timeline */}
			<Card>
				<CardContent className="p-0 overflow-hidden">
					<ScrollArea className="w-full" ref={scrollRef}>
						<div style={{ width: 256 + timelineWidth }}>
							{/* Header */}
							<TimelineHeader
								startDate={startDate}
								endDate={endDate}
								dayWidth={dayWidth}
								today={today}
							/>

							{/* Tasks */}
							<div className="relative">
								{timelineTasks.map((task) => (
									<div
										key={task.id}
										className="flex border-b hover:bg-gray-50"
										style={{ height: 40 }}
									>
										{/* Task label */}
										<div className="w-64 flex-shrink-0 flex items-center px-3 border-r bg-white">
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<span
															className={cn(
																"text-sm truncate cursor-pointer hover:text-blue-600",
																task.isCritical && "font-medium text-red-700"
															)}
															onClick={() => onTaskClick?.(task)}
														>
															{task.title}
														</span>
													</TooltipTrigger>
													<TooltipContent side="right">
														<p>{task.title}</p>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</div>

										{/* Task bar area */}
										<div className="relative flex-1">
											{/* Today line */}
											{(() => {
												const todayX =
													getDaysBetween(startDate, today) * dayWidth;
												return (
													<div
														className="absolute top-0 bottom-0 w-px bg-blue-500 z-10"
														style={{ left: todayX }}
													/>
												);
											})()}

											{/* Task bar */}
											<TaskBar
												task={task}
												onClick={() => onTaskClick?.(task)}
											/>
										</div>
									</div>
								))}

								{/* Milestones */}
								{milestones.map((milestone) => {
									const x = getDaysBetween(startDate, milestone.date) * dayWidth;
									return (
										<div
											key={milestone.id}
											className="absolute top-0 bottom-0 z-20"
											style={{ left: 256 + x }}
										>
											<div className="relative h-full">
												<div className="absolute top-0 bottom-0 w-px bg-purple-500 border-l-2 border-dashed border-purple-300" />
												<div className="absolute -top-1 -translate-x-1/2">
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger>
																<Flag className="w-4 h-4 text-purple-600" />
															</TooltipTrigger>
															<TooltipContent>
																<p className="font-medium">{milestone.label}</p>
																<p className="text-xs">
																	{formatDate(milestone.date)}
																</p>
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												</div>
											</div>
										</div>
									);
								})}

								{/* Deadline */}
								{proposalDeadline && (
									<div
										className="absolute top-0 bottom-0 z-20"
										style={{
											left:
												256 +
												getDaysBetween(startDate, proposalDeadline) * dayWidth,
										}}
									>
										<div className="relative h-full">
											<div className="absolute top-0 bottom-0 w-1 bg-red-500" />
											<div className="absolute -top-1 -translate-x-1/2">
												<TooltipProvider>
													<Tooltip>
														<TooltipTrigger>
															<Flag className="w-5 h-5 text-red-600 fill-red-600" />
														</TooltipTrigger>
														<TooltipContent>
															<p className="font-medium">Proposal Deadline</p>
															<p className="text-xs">
																{formatDate(proposalDeadline)}
															</p>
														</TooltipContent>
													</Tooltip>
												</TooltipProvider>
											</div>
										</div>
									</div>
								)}
							</div>
						</div>
						<ScrollBar orientation="horizontal" />
					</ScrollArea>
				</CardContent>
			</Card>

			{/* Empty state */}
			{timelineTasks.length === 0 && (
				<div className="flex flex-col items-center justify-center py-12 text-gray-500">
					<Calendar className="w-12 h-12 mb-4 text-gray-300" />
					<p className="text-lg font-medium mb-2">No tasks with dates</p>
					<p className="text-sm">Add start/due dates to tasks to see them on the timeline</p>
				</div>
			)}
		</div>
	);
}

export default CriticalPathView;
