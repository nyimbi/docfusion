"use client";

/**
 * WorkloadHeatMap - Visual capacity heatmap for team workload.
 *
 * Features:
 * - Calendar-style heatmap view
 * - Color-coded utilization levels
 * - Hover details for each cell
 * - Week/month view toggle
 * - Team member filtering
 * - Comparison across time periods
 */

import React, { useState, useMemo } from "react";
import {
	Calendar,
	ChevronLeft,
	ChevronRight,
	Users,
	Clock,
	AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
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
import type { ProposalTask, AuthorExpertise } from "@/lib/db/schema-tasks";

// ============================================================================
// Types
// ============================================================================

interface DayCell {
	date: Date;
	users: {
		userId: string;
		userName: string;
		utilization: number;
		taskCount: number;
		estimatedHours: number;
		availableHours: number;
		isOverloaded: boolean;
	}[];
	totalUtilization: number;
	isWeekend: boolean;
	isToday: boolean;
}

export interface WorkloadHeatMapProps {
	tasks: ProposalTask[];
	teamMembers: AuthorExpertise[];
	startDate?: Date;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const UTILIZATION_COLORS = {
	0: "bg-gray-100",
	20: "bg-green-100",
	40: "bg-green-200",
	60: "bg-yellow-200",
	80: "bg-orange-200",
	100: "bg-red-200",
	120: "bg-red-400",
};

// ============================================================================
// Helper Functions
// ============================================================================

function getUtilizationColor(utilization: number): string {
	if (utilization <= 0) return UTILIZATION_COLORS[0];
	if (utilization <= 20) return UTILIZATION_COLORS[20];
	if (utilization <= 40) return UTILIZATION_COLORS[40];
	if (utilization <= 60) return UTILIZATION_COLORS[60];
	if (utilization <= 80) return UTILIZATION_COLORS[80];
	if (utilization <= 100) return UTILIZATION_COLORS[100];
	return UTILIZATION_COLORS[120];
}

function getUtilizationTextColor(utilization: number): string {
	if (utilization >= 100) return "text-white";
	return "text-gray-700";
}

function formatDate(date: Date): string {
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

function startOfWeek(date: Date): Date {
	const d = new Date(date);
	const day = d.getDay();
	d.setDate(d.getDate() - day);
	d.setHours(0, 0, 0, 0);
	return d;
}

function getWeeksInRange(start: Date, weeks: number): Date[][] {
	const result: Date[][] = [];
	let currentWeekStart = startOfWeek(start);

	for (let w = 0; w < weeks; w++) {
		const week: Date[] = [];
		for (let d = 0; d < 7; d++) {
			week.push(addDays(currentWeekStart, d));
		}
		result.push(week);
		currentWeekStart = addDays(currentWeekStart, 7);
	}

	return result;
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkloadHeatMap({
	tasks,
	teamMembers,
	startDate = new Date(),
	className,
}: WorkloadHeatMapProps) {
	const [weeksToShow, setWeeksToShow] = useState(4);
	const [selectedUser, setSelectedUser] = useState<string>("all");
	const [currentStart, setCurrentStart] = useState(startOfWeek(startDate));

	// Calculate weeks to display
	const weeks = useMemo(
		() => getWeeksInRange(currentStart, weeksToShow),
		[currentStart, weeksToShow]
	);

	// Build heatmap data
	const heatmapData: DayCell[][] = useMemo(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const filteredMembers =
			selectedUser === "all"
				? teamMembers
				: teamMembers.filter((m) => m.userId === selectedUser);

		return weeks.map((week) =>
			week.map((date) => {
				const isWeekend = date.getDay() === 0 || date.getDay() === 6;
				const isToday = date.toDateString() === today.toDateString();

				// Calculate utilization for each user on this day
				const users = filteredMembers.map((member) => {
					// Get tasks due on or active on this date
					const userTasks = tasks.filter((task) => {
						if (task.assignedTo !== member.userName) return false;
						if (task.status === "completed" || task.status === "cancelled")
							return false;

						const taskStart = task.startDate
							? new Date(task.startDate)
							: null;
						const taskEnd = task.dueDate ? new Date(task.dueDate) : null;

						// Task is active on this date if date is between start and end
						if (taskStart && taskEnd) {
							return date >= taskStart && date <= taskEnd;
						}

						// If only due date, assume task is active in the week before
						if (taskEnd) {
							const weekBefore = addDays(taskEnd, -7);
							return date >= weekBefore && date <= taskEnd;
						}

						return false;
					});

					const estimatedHours = userTasks.reduce(
						(sum, t) => sum + (t.estimatedHours ?? 0) / 5, // Divide by workdays
						0
					);

					const dailyAvailable = (member.availableHoursPerWeek ?? 40) / 5;
					const utilization = dailyAvailable > 0
						? (estimatedHours / dailyAvailable) * 100
						: 0;

					return {
						userId: member.userId,
						userName: member.userName,
						utilization: Math.round(utilization),
						taskCount: userTasks.length,
						estimatedHours: Math.round(estimatedHours * 10) / 10,
						availableHours: dailyAvailable,
						isOverloaded: utilization > 100,
					};
				});

				const totalUtilization =
					users.length > 0
						? Math.round(
								users.reduce((sum, u) => sum + u.utilization, 0) / users.length
							)
						: 0;

				return {
					date,
					users,
					totalUtilization,
					isWeekend,
					isToday,
				};
			})
		);
	}, [weeks, tasks, teamMembers, selectedUser]);

	// Navigation handlers
	const handlePreviousWeek = () => {
		setCurrentStart(addDays(currentStart, -7));
	};

	const handleNextWeek = () => {
		setCurrentStart(addDays(currentStart, 7));
	};

	const handleToday = () => {
		setCurrentStart(startOfWeek(new Date()));
	};

	// Summary stats
	const summaryStats = useMemo(() => {
		let totalOverloaded = 0;
		let peakUtilization = 0;
		let totalCells = 0;
		let totalUtilization = 0;

		heatmapData.forEach((week) => {
			week.forEach((day) => {
				if (!day.isWeekend) {
					totalCells++;
					totalUtilization += day.totalUtilization;
					if (day.totalUtilization > peakUtilization) {
						peakUtilization = day.totalUtilization;
					}
					if (day.totalUtilization > 100) {
						totalOverloaded++;
					}
				}
			});
		});

		return {
			avgUtilization: totalCells > 0 ? Math.round(totalUtilization / totalCells) : 0,
			peakUtilization,
			overloadedDays: totalOverloaded,
		};
	}, [heatmapData]);

	return (
		<div className={cn("flex flex-col gap-4", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold flex items-center gap-2">
						<Calendar className="w-5 h-5" />
						Workload Heatmap
					</h2>
					<p className="text-sm text-gray-500">
						{formatDate(currentStart)} -{" "}
						{formatDate(addDays(currentStart, weeksToShow * 7 - 1))}
					</p>
				</div>

				<div className="flex items-center gap-2">
					{/* User filter */}
					<Select value={selectedUser} onValueChange={setSelectedUser}>
						<SelectTrigger className="w-[150px] h-9">
							<SelectValue placeholder="All team" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Team</SelectItem>
							{teamMembers.map((member) => (
								<SelectItem key={member.userId} value={member.userId}>
									{member.userName}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Weeks to show */}
					<Select
						value={weeksToShow.toString()}
						onValueChange={(v) => setWeeksToShow(parseInt(v))}
					>
						<SelectTrigger className="w-[100px] h-9">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="2">2 weeks</SelectItem>
							<SelectItem value="4">4 weeks</SelectItem>
							<SelectItem value="6">6 weeks</SelectItem>
							<SelectItem value="8">8 weeks</SelectItem>
						</SelectContent>
					</Select>

					{/* Navigation */}
					<div className="flex items-center border rounded">
						<Button
							variant="ghost"
							size="sm"
							onClick={handlePreviousWeek}
							className="h-9 px-2"
						>
							<ChevronLeft className="w-4 h-4" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleToday}
							className="h-9 px-3"
						>
							Today
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleNextWeek}
							className="h-9 px-2"
						>
							<ChevronRight className="w-4 h-4" />
						</Button>
					</div>
				</div>
			</div>

			{/* Summary stats */}
			<div className="flex gap-4">
				<Card className="flex-1 p-3">
					<div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
						<Clock className="w-4 h-4" />
						Avg Utilization
					</div>
					<p
						className={cn(
							"text-xl font-bold",
							summaryStats.avgUtilization > 100
								? "text-red-600"
								: summaryStats.avgUtilization > 80
									? "text-orange-600"
									: "text-green-600"
						)}
					>
						{summaryStats.avgUtilization}%
					</p>
				</Card>
				<Card className="flex-1 p-3">
					<div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
						<AlertTriangle className="w-4 h-4" />
						Peak Utilization
					</div>
					<p
						className={cn(
							"text-xl font-bold",
							summaryStats.peakUtilization > 100
								? "text-red-600"
								: "text-gray-900"
						)}
					>
						{summaryStats.peakUtilization}%
					</p>
				</Card>
				<Card className="flex-1 p-3">
					<div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
						<Calendar className="w-4 h-4" />
						Overloaded Days
					</div>
					<p
						className={cn(
							"text-xl font-bold",
							summaryStats.overloadedDays > 0 ? "text-red-600" : "text-green-600"
						)}
					>
						{summaryStats.overloadedDays}
					</p>
				</Card>
			</div>

			{/* Legend */}
			<div className="flex items-center gap-4 text-xs">
				<span className="text-gray-500">Utilization:</span>
				<div className="flex items-center gap-1">
					<div className={cn("w-4 h-4 rounded", UTILIZATION_COLORS[0])} />
					<span>0%</span>
				</div>
				<div className="flex items-center gap-1">
					<div className={cn("w-4 h-4 rounded", UTILIZATION_COLORS[40])} />
					<span>40%</span>
				</div>
				<div className="flex items-center gap-1">
					<div className={cn("w-4 h-4 rounded", UTILIZATION_COLORS[80])} />
					<span>80%</span>
				</div>
				<div className="flex items-center gap-1">
					<div className={cn("w-4 h-4 rounded", UTILIZATION_COLORS[100])} />
					<span>100%</span>
				</div>
				<div className="flex items-center gap-1">
					<div className={cn("w-4 h-4 rounded", UTILIZATION_COLORS[120])} />
					<span>120%+</span>
				</div>
			</div>

			{/* Heatmap grid */}
			<Card>
				<CardContent className="p-4">
					{/* Day headers */}
					<div className="grid grid-cols-7 gap-1 mb-2">
						{DAYS_OF_WEEK.map((day) => (
							<div
								key={day}
								className="text-center text-xs font-medium text-gray-500 py-1"
							>
								{day}
							</div>
						))}
					</div>

					{/* Week rows */}
					<div className="space-y-1">
						{heatmapData.map((week, weekIndex) => (
							<div key={weekIndex} className="grid grid-cols-7 gap-1">
								{week.map((day) => (
									<TooltipProvider key={day.date.toISOString()}>
										<Tooltip>
											<TooltipTrigger asChild>
												<div
													className={cn(
														"aspect-square rounded flex items-center justify-center text-xs font-medium cursor-pointer transition-transform hover:scale-105",
														day.isWeekend
															? "bg-gray-50 text-gray-400"
															: getUtilizationColor(day.totalUtilization),
														day.isWeekend
															? ""
															: getUtilizationTextColor(day.totalUtilization),
														day.isToday && "ring-2 ring-blue-500"
													)}
												>
													{day.date.getDate()}
												</div>
											</TooltipTrigger>
											<TooltipContent side="top" className="max-w-xs">
												<div className="space-y-2">
													<div className="font-medium">
														{day.date.toLocaleDateString("en-US", {
															weekday: "long",
															month: "long",
															day: "numeric",
														})}
													</div>

													{day.isWeekend ? (
														<p className="text-xs text-gray-400">Weekend</p>
													) : (
														<>
															<div className="flex items-center justify-between text-sm">
																<span>Team Utilization:</span>
																<span
																	className={cn(
																		"font-bold",
																		day.totalUtilization > 100
																			? "text-red-600"
																			: "text-green-600"
																	)}
																>
																	{day.totalUtilization}%
																</span>
															</div>

															{day.users.length > 0 && (
																<div className="border-t pt-2 space-y-1">
																	{day.users.map((user) => (
																		<div
																			key={user.userId}
																			className="flex items-center justify-between text-xs"
																		>
																			<span className="truncate max-w-[100px]">
																				{user.userName}
																			</span>
																			<div className="flex items-center gap-2">
																				<span className="text-gray-500">
																					{user.taskCount} tasks
																				</span>
																				<span
																					className={cn(
																						"font-medium",
																						user.isOverloaded
																							? "text-red-600"
																							: "text-green-600"
																					)}
																				>
																					{user.utilization}%
																				</span>
																			</div>
																		</div>
																	))}
																</div>
															)}
														</>
													)}
												</div>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								))}
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Per-user heatmap (when specific user selected) */}
			{selectedUser !== "all" && (
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base flex items-center gap-2">
							<Users className="w-4 h-4" />
							{teamMembers.find((m) => m.userId === selectedUser)?.userName} -
							Daily Breakdown
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{heatmapData.map((week, weekIndex) => (
								<div key={weekIndex} className="flex gap-1">
									{week.map((day) => {
										const userData = day.users[0];
										if (!userData || day.isWeekend) return null;

										return (
											<div
												key={day.date.toISOString()}
												className="flex-1 p-2 rounded bg-gray-50"
											>
												<div className="text-xs text-gray-500 mb-1">
													{day.date.toLocaleDateString("en-US", {
														weekday: "short",
														day: "numeric",
													})}
												</div>
												<div className="flex items-center justify-between">
													<span className="text-sm font-medium">
														{userData.taskCount} tasks
													</span>
													<Badge
														variant={
															userData.isOverloaded
																? "destructive"
																: "secondary"
														}
														className="text-xs"
													>
														{userData.utilization}%
													</Badge>
												</div>
											</div>
										);
									})}
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

export default WorkloadHeatMap;
