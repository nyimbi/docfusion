"use client";

/**
 * WorkloadDashboard - Team workload visualization and management.
 *
 * Features:
 * - Team member capacity overview
 * - Individual workload breakdown
 * - Utilization rates and trends
 * - Overallocation warnings
 * - Drag-to-rebalance functionality
 * - Historical workload comparison
 */

import React, { useState, useMemo, useCallback } from "react";
import {
	Users,
	User,
	Clock,
	TrendingUp,
	TrendingDown,
	AlertTriangle,
	CheckCircle2,
	Calendar,
	BarChart2,
	ChevronDown,
	ChevronRight,
	RefreshCw,
	Settings,
	Zap,
	Target,
	Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
	ProposalTask,
	AuthorExpertise,
	WorkloadSnapshot,
} from "@/lib/db/schema-tasks";

// ============================================================================
// Types
// ============================================================================

interface TeamMemberWorkload {
	userId: string;
	userName: string;
	userEmail?: string;
	availability: string;
	availableHoursPerWeek: number;
	currentTasks: ProposalTask[];
	metrics: {
		totalTasks: number;
		activeTasks: number;
		completedTasks: number;
		blockedTasks: number;
		overdueTasks: number;
		totalEstimatedHours: number;
		totalActualHours: number;
		utilizationRate: number;
		dueToday: number;
		dueThisWeek: number;
	};
	health: "healthy" | "elevated" | "overloaded" | "critical";
	trend: "improving" | "stable" | "declining";
}

export interface WorkloadDashboardProps {
	tasks: ProposalTask[];
	teamMembers: AuthorExpertise[];
	snapshots?: WorkloadSnapshot[];
	loading?: boolean;
	onReassignTask?: (taskId: string, newAssignee: string) => Promise<void>;
	onBalanceWorkload?: () => Promise<void>;
	onRefresh?: () => Promise<void>;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const HEALTH_CONFIG: Record<
	string,
	{ label: string; color: string; bgColor: string }
> = {
	healthy: { label: "Healthy", color: "text-green-600", bgColor: "bg-green-100" },
	elevated: {
		label: "Elevated",
		color: "text-yellow-600",
		bgColor: "bg-yellow-100",
	},
	overloaded: {
		label: "Overloaded",
		color: "text-orange-600",
		bgColor: "bg-orange-100",
	},
	critical: {
		label: "Critical",
		color: "text-red-600",
		bgColor: "bg-red-100",
	},
};

const TREND_CONFIG: Record<
	string,
	{ icon: React.ComponentType<{ className?: string }>; color: string }
> = {
	improving: { icon: TrendingUp, color: "text-green-500" },
	stable: { icon: Target, color: "text-gray-500" },
	declining: { icon: TrendingDown, color: "text-red-500" },
};

// ============================================================================
// Helper Functions
// ============================================================================

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function calculateHealth(utilization: number, overdue: number): TeamMemberWorkload["health"] {
	if (utilization > 120 || overdue > 3) return "critical";
	if (utilization > 100 || overdue > 1) return "overloaded";
	if (utilization > 80) return "elevated";
	return "healthy";
}

function getUtilizationColor(rate: number): string {
	if (rate > 100) return "text-red-600";
	if (rate > 80) return "text-orange-600";
	if (rate > 50) return "text-yellow-600";
	return "text-green-600";
}

// ============================================================================
// Team Member Card Component
// ============================================================================

interface MemberCardProps {
	member: TeamMemberWorkload;
	isExpanded: boolean;
	onToggle: () => void;
	onTaskClick?: (task: ProposalTask) => void;
}

function MemberCard({
	member,
	isExpanded,
	onToggle,
	onTaskClick,
}: MemberCardProps) {
	const healthConfig = HEALTH_CONFIG[member.health];
	const TrendIcon = TREND_CONFIG[member.trend].icon;

	return (
		<Card className={cn("transition-all", isExpanded && "ring-2 ring-blue-200")}>
			<Collapsible open={isExpanded} onOpenChange={onToggle}>
				<CollapsibleTrigger asChild>
					<CardHeader className="cursor-pointer hover:bg-gray-50 pb-3">
						<div className="flex items-center gap-3">
							<Avatar className="w-10 h-10">
								<AvatarFallback>{getInitials(member.userName)}</AvatarFallback>
							</Avatar>

							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<CardTitle className="text-base">{member.userName}</CardTitle>
									<Badge
										variant="outline"
										className={cn("text-xs", healthConfig.color)}
									>
										{healthConfig.label}
									</Badge>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger>
												<TrendIcon
													className={cn(
														"w-4 h-4",
														TREND_CONFIG[member.trend].color
													)}
												/>
											</TooltipTrigger>
											<TooltipContent>
												Trend: {member.trend}
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
								<div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
									<span>{member.metrics.activeTasks} active</span>
									<span>{member.metrics.dueThisWeek} due this week</span>
									{member.metrics.overdueTasks > 0 && (
										<span className="text-red-600">
											{member.metrics.overdueTasks} overdue
										</span>
									)}
								</div>
							</div>

							<div className="flex items-center gap-4">
								{/* Utilization gauge */}
								<div className="w-24 text-right">
									<span
										className={cn(
											"text-lg font-bold",
											getUtilizationColor(member.metrics.utilizationRate)
										)}
									>
										{Math.round(member.metrics.utilizationRate)}%
									</span>
									<p className="text-xs text-gray-500">utilization</p>
								</div>

								{isExpanded ? (
									<ChevronDown className="w-5 h-5 text-gray-400" />
								) : (
									<ChevronRight className="w-5 h-5 text-gray-400" />
								)}
							</div>
						</div>

						{/* Utilization bar */}
						<div className="mt-3">
							<Progress
								value={Math.min(member.metrics.utilizationRate, 100)}
								className={cn(
									"h-2",
									member.metrics.utilizationRate > 100 && "[&>div]:bg-red-500"
								)}
							/>
						</div>
					</CardHeader>
				</CollapsibleTrigger>

				<CollapsibleContent>
					<CardContent className="pt-0">
						{/* Metrics grid */}
						<div className="grid grid-cols-4 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
							<div>
								<p className="text-2xl font-bold">
									{member.metrics.totalEstimatedHours}h
								</p>
								<p className="text-xs text-gray-500">Est. hours</p>
							</div>
							<div>
								<p className="text-2xl font-bold">
									{member.availableHoursPerWeek}h
								</p>
								<p className="text-xs text-gray-500">Capacity/week</p>
							</div>
							<div>
								<p className="text-2xl font-bold">
									{member.metrics.completedTasks}
								</p>
								<p className="text-xs text-gray-500">Completed</p>
							</div>
							<div>
								<p className="text-2xl font-bold text-red-600">
									{member.metrics.blockedTasks}
								</p>
								<p className="text-xs text-gray-500">Blocked</p>
							</div>
						</div>

						{/* Task list */}
						{member.currentTasks.length > 0 ? (
							<div className="space-y-2">
								<h4 className="font-medium text-sm text-gray-600">
									Current Tasks
								</h4>
								{member.currentTasks.slice(0, 5).map((task) => {
									const isOverdue =
										task.dueDate &&
										new Date(task.dueDate) < new Date() &&
										task.status !== "completed";

									return (
										<button
											key={task.id}
											onClick={() => onTaskClick?.(task)}
											className="w-full flex items-center gap-2 p-2 text-left rounded border hover:bg-gray-50 transition-colors"
										>
											<div
												className={cn(
													"w-2 h-2 rounded-full flex-shrink-0",
													task.status === "blocked" && "bg-red-500",
													task.status === "in_progress" && "bg-amber-500",
													task.status === "review" && "bg-purple-500",
													task.status === "assigned" && "bg-blue-500",
													task.status === "pending" && "bg-gray-400"
												)}
											/>
											<span className="flex-1 text-sm truncate">
												{task.title}
											</span>
											{task.priority === "critical" && (
												<Zap className="w-3.5 h-3.5 text-red-500" />
											)}
											{isOverdue && (
												<AlertTriangle className="w-3.5 h-3.5 text-red-500" />
											)}
											{task.dueDate && (
												<span
													className={cn(
														"text-xs",
														isOverdue
															? "text-red-600 font-medium"
															: "text-gray-500"
													)}
												>
													{new Date(task.dueDate).toLocaleDateString()}
												</span>
											)}
										</button>
									);
								})}
								{member.currentTasks.length > 5 && (
									<p className="text-xs text-gray-500 text-center py-1">
										+{member.currentTasks.length - 5} more tasks
									</p>
								)}
							</div>
						) : (
							<p className="text-sm text-gray-400 text-center py-4">
								No active tasks assigned
							</p>
						)}
					</CardContent>
				</CollapsibleContent>
			</Collapsible>
		</Card>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkloadDashboard({
	tasks,
	teamMembers,
	snapshots = [],
	loading = false,
	onReassignTask,
	onBalanceWorkload,
	onRefresh,
	className,
}: WorkloadDashboardProps) {
	const [expandedMember, setExpandedMember] = useState<string | null>(null);
	const [sortBy, setSortBy] = useState<"name" | "utilization" | "tasks">(
		"utilization"
	);
	const [balancing, setBalancing] = useState(false);

	// Calculate workload for each team member
	const memberWorkloads: TeamMemberWorkload[] = useMemo(() => {
		const now = new Date();
		const weekEnd = new Date(now);
		weekEnd.setDate(now.getDate() + 7);

		return teamMembers.map((member) => {
			const memberTasks = tasks.filter(
				(t) =>
					t.assignedTo === member.userName &&
					t.status !== "completed" &&
					t.status !== "cancelled"
			);

			const activeTasks = memberTasks.filter(
				(t) => t.status === "in_progress" || t.status === "review"
			).length;
			const blockedTasks = memberTasks.filter(
				(t) => t.status === "blocked"
			).length;
			const overdueTasks = memberTasks.filter(
				(t) => t.dueDate && new Date(t.dueDate) < now
			).length;
			const dueToday = memberTasks.filter(
				(t) =>
					t.dueDate &&
					new Date(t.dueDate).toDateString() === now.toDateString()
			).length;
			const dueThisWeek = memberTasks.filter(
				(t) =>
					t.dueDate &&
					new Date(t.dueDate) >= now &&
					new Date(t.dueDate) <= weekEnd
			).length;

			const totalEstimatedHours = memberTasks.reduce(
				(sum, t) => sum + (t.estimatedHours ?? 0),
				0
			);
			const totalActualHours = memberTasks.reduce(
				(sum, t) => sum + (t.actualHours ?? 0),
				0
			);

			const availableHours = member.availableHoursPerWeek ?? 40;
			const utilizationRate =
				availableHours > 0 ? (totalEstimatedHours / availableHours) * 100 : 0;

			// Determine trend from snapshots
			let trend: TeamMemberWorkload["trend"] = "stable";
			const memberSnapshots = snapshots
				.filter((s) => s.userId === member.userId)
				.sort(
					(a, b) =>
						new Date(b.snapshotDate).getTime() -
						new Date(a.snapshotDate).getTime()
				);

			if (memberSnapshots.length >= 2) {
				const recent = memberSnapshots[0].utilizationRate ?? 0;
				const previous = memberSnapshots[1].utilizationRate ?? 0;
				if (recent < previous - 5) trend = "improving";
				else if (recent > previous + 5) trend = "declining";
			}

			return {
				userId: member.userId,
				userName: member.userName,
				userEmail: member.userEmail ?? undefined,
				availability: member.availability ?? "available",
				availableHoursPerWeek: availableHours,
				currentTasks: memberTasks,
				metrics: {
					totalTasks: memberTasks.length,
					activeTasks,
					completedTasks: tasks.filter(
						(t) =>
							t.assignedTo === member.userName && t.status === "completed"
					).length,
					blockedTasks,
					overdueTasks,
					totalEstimatedHours,
					totalActualHours,
					utilizationRate,
					dueToday,
					dueThisWeek,
				},
				health: calculateHealth(utilizationRate, overdueTasks),
				trend,
			};
		});
	}, [tasks, teamMembers, snapshots]);

	// Sort members
	const sortedMembers = useMemo(() => {
		return [...memberWorkloads].sort((a, b) => {
			switch (sortBy) {
				case "name":
					return a.userName.localeCompare(b.userName);
				case "utilization":
					return b.metrics.utilizationRate - a.metrics.utilizationRate;
				case "tasks":
					return b.metrics.totalTasks - a.metrics.totalTasks;
				default:
					return 0;
			}
		});
	}, [memberWorkloads, sortBy]);

	// Team summary stats
	const teamStats = useMemo(() => {
		const totalTasks = memberWorkloads.reduce(
			(sum, m) => sum + m.metrics.totalTasks,
			0
		);
		const avgUtilization =
			memberWorkloads.length > 0
				? memberWorkloads.reduce(
						(sum, m) => sum + m.metrics.utilizationRate,
						0
					) / memberWorkloads.length
				: 0;
		const overloaded = memberWorkloads.filter(
			(m) => m.health === "overloaded" || m.health === "critical"
		).length;
		const totalOverdue = memberWorkloads.reduce(
			(sum, m) => sum + m.metrics.overdueTasks,
			0
		);

		return { totalTasks, avgUtilization, overloaded, totalOverdue };
	}, [memberWorkloads]);

	const handleBalanceWorkload = useCallback(async () => {
		if (!onBalanceWorkload) return;

		setBalancing(true);
		try {
			await onBalanceWorkload();
		} catch (error) {
			console.error("Failed to balance workload:", error);
		} finally {
			setBalancing(false);
		}
	}, [onBalanceWorkload]);

	return (
		<div className={cn("flex flex-col gap-4", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold flex items-center gap-2">
						<Users className="w-5 h-5" />
						Team Workload
					</h2>
					<p className="text-sm text-gray-500">
						{memberWorkloads.length} team members · {teamStats.totalTasks}{" "}
						active tasks
					</p>
				</div>

				<div className="flex items-center gap-2">
					<Select
						value={sortBy}
						onValueChange={(v) => setSortBy(v as typeof sortBy)}
					>
						<SelectTrigger className="w-[140px] h-9">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="utilization">By Utilization</SelectItem>
							<SelectItem value="tasks">By Task Count</SelectItem>
							<SelectItem value="name">By Name</SelectItem>
						</SelectContent>
					</Select>

					{onBalanceWorkload && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleBalanceWorkload}
							disabled={balancing}
							className="h-9"
						>
							{balancing ? (
								<Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
							) : (
								<Zap className="w-4 h-4 mr-1.5" />
							)}
							Auto-Balance
						</Button>
					)}

					{onRefresh && (
						<Button
							variant="outline"
							size="sm"
							onClick={onRefresh}
							disabled={loading}
							className="h-9"
						>
							<RefreshCw
								className={cn("w-4 h-4", loading && "animate-spin")}
							/>
						</Button>
					)}
				</div>
			</div>

			{/* Summary cards */}
			<div className="grid grid-cols-4 gap-4">
				<Card className="p-4">
					<div className="flex items-center gap-2 text-gray-500 mb-1">
						<BarChart2 className="w-4 h-4" />
						<span className="text-sm">Avg Utilization</span>
					</div>
					<p
						className={cn(
							"text-2xl font-bold",
							getUtilizationColor(teamStats.avgUtilization)
						)}
					>
						{Math.round(teamStats.avgUtilization)}%
					</p>
				</Card>

				<Card className="p-4">
					<div className="flex items-center gap-2 text-gray-500 mb-1">
						<Clock className="w-4 h-4" />
						<span className="text-sm">Active Tasks</span>
					</div>
					<p className="text-2xl font-bold">{teamStats.totalTasks}</p>
				</Card>

				<Card className="p-4">
					<div className="flex items-center gap-2 text-gray-500 mb-1">
						<AlertTriangle className="w-4 h-4" />
						<span className="text-sm">Overloaded</span>
					</div>
					<p
						className={cn(
							"text-2xl font-bold",
							teamStats.overloaded > 0 ? "text-red-600" : "text-green-600"
						)}
					>
						{teamStats.overloaded}
					</p>
				</Card>

				<Card className="p-4">
					<div className="flex items-center gap-2 text-gray-500 mb-1">
						<Calendar className="w-4 h-4" />
						<span className="text-sm">Overdue</span>
					</div>
					<p
						className={cn(
							"text-2xl font-bold",
							teamStats.totalOverdue > 0 ? "text-red-600" : "text-green-600"
						)}
					>
						{teamStats.totalOverdue}
					</p>
				</Card>
			</div>

			{/* Member list */}
			{loading ? (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="w-8 h-8 animate-spin text-gray-400" />
				</div>
			) : sortedMembers.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-12 text-gray-500">
					<Users className="w-12 h-12 mb-4 text-gray-300" />
					<p className="text-lg font-medium mb-2">No team members</p>
					<p className="text-sm">Add team members to track workload</p>
				</div>
			) : (
				<ScrollArea className="flex-1">
					<div className="space-y-3">
						{sortedMembers.map((member) => (
							<MemberCard
								key={member.userId}
								member={member}
								isExpanded={expandedMember === member.userId}
								onToggle={() =>
									setExpandedMember(
										expandedMember === member.userId ? null : member.userId
									)
								}
							/>
						))}
					</div>
				</ScrollArea>
			)}
		</div>
	);
}

export default WorkloadDashboard;
