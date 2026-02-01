"use client";

/**
 * BottleneckAlerts - Warning indicators for project bottlenecks.
 *
 * Features:
 * - Real-time bottleneck detection
 * - Severity-based alert prioritization
 * - Actionable recommendations
 * - Impact analysis (downstream effects)
 * - Resolution tracking
 */

import React, { useMemo } from "react";
import {
	AlertTriangle,
	AlertOctagon,
	Clock,
	Users,
	Link2,
	TrendingDown,
	Calendar,
	Zap,
	ChevronRight,
	Bell,
	XCircle,
	CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ProposalTask, AuthorExpertise } from "@/lib/db/schema-tasks";

// ============================================================================
// Types
// ============================================================================

export type BottleneckType =
	| "blocked_task"
	| "overdue_task"
	| "overloaded_assignee"
	| "unassigned_critical"
	| "dependency_chain"
	| "deadline_risk"
	| "quality_issue"
	| "capacity_shortfall";

export type BottleneckSeverity = "critical" | "high" | "medium" | "low";

export interface Bottleneck {
	id: string;
	type: BottleneckType;
	severity: BottleneckSeverity;
	title: string;
	description: string;
	affectedTasks: ProposalTask[];
	affectedUsers: string[];
	impactedTaskCount: number;
	recommendations: string[];
	detectedAt: Date;
	resolvedAt?: Date;
}

export interface BottleneckAlertsProps {
	tasks: ProposalTask[];
	teamMembers: AuthorExpertise[];
	proposalDeadline?: Date;
	onTaskClick?: (task: ProposalTask) => void;
	onResolve?: (bottleneckId: string) => void;
	onDismiss?: (bottleneckId: string) => void;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_CONFIG: Record<
	BottleneckSeverity,
	{
		label: string;
		color: string;
		bgColor: string;
		borderColor: string;
		icon: React.ComponentType<{ className?: string }>;
	}
> = {
	critical: {
		label: "Critical",
		color: "text-red-700",
		bgColor: "bg-red-50",
		borderColor: "border-red-200",
		icon: AlertOctagon,
	},
	high: {
		label: "High",
		color: "text-orange-700",
		bgColor: "bg-orange-50",
		borderColor: "border-orange-200",
		icon: AlertTriangle,
	},
	medium: {
		label: "Medium",
		color: "text-yellow-700",
		bgColor: "bg-yellow-50",
		borderColor: "border-yellow-200",
		icon: Clock,
	},
	low: {
		label: "Low",
		color: "text-gray-600",
		bgColor: "bg-gray-50",
		borderColor: "border-gray-200",
		icon: Bell,
	},
};

const BOTTLENECK_TYPE_CONFIG: Record<
	BottleneckType,
	{
		label: string;
		icon: React.ComponentType<{ className?: string }>;
	}
> = {
	blocked_task: { label: "Blocked Task", icon: XCircle },
	overdue_task: { label: "Overdue Task", icon: Clock },
	overloaded_assignee: { label: "Overloaded Assignee", icon: Users },
	unassigned_critical: { label: "Unassigned Critical", icon: Zap },
	dependency_chain: { label: "Dependency Chain", icon: Link2 },
	deadline_risk: { label: "Deadline Risk", icon: Calendar },
	quality_issue: { label: "Quality Issue", icon: TrendingDown },
	capacity_shortfall: { label: "Capacity Shortfall", icon: AlertTriangle },
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

function detectBottlenecks(
	tasks: ProposalTask[],
	teamMembers: AuthorExpertise[],
	proposalDeadline?: Date
): Bottleneck[] {
	const bottlenecks: Bottleneck[] = [];
	const now = new Date();
	const taskMap = new Map<string, ProposalTask>();
	tasks.forEach((t) => taskMap.set(t.id, t));

	// 1. Blocked tasks
	const blockedTasks = tasks.filter((t) => t.status === "blocked");
	blockedTasks.forEach((task) => {
		// Calculate impact - how many tasks are waiting on this one
		const blockedChain = getBlockedChain(task, taskMap);

		bottlenecks.push({
			id: `blocked-${task.id}`,
			type: "blocked_task",
			severity:
				task.priority === "critical"
					? "critical"
					: blockedChain.length > 3
						? "high"
						: "medium",
			title: `Blocked: ${task.title}`,
			description: `This task is blocked and ${blockedChain.length} downstream tasks are waiting`,
			affectedTasks: [task, ...blockedChain],
			affectedUsers: task.assignedTo ? [task.assignedTo] : [],
			impactedTaskCount: blockedChain.length,
			recommendations: [
				"Identify and resolve the blocker",
				"Consider reassigning to someone who can address the blocker",
				"If blocked by external dependency, escalate to management",
			],
			detectedAt: new Date(),
		});
	});

	// 2. Overdue tasks
	const overdueTasks = tasks.filter(
		(t) =>
			t.dueDate &&
			new Date(t.dueDate) < now &&
			t.status !== "completed" &&
			t.status !== "cancelled"
	);
	overdueTasks.forEach((task) => {
		const daysOverdue = Math.ceil(
			(now.getTime() - new Date(task.dueDate!).getTime()) / (1000 * 60 * 60 * 24)
		);

		bottlenecks.push({
			id: `overdue-${task.id}`,
			type: "overdue_task",
			severity:
				daysOverdue > 7
					? "critical"
					: daysOverdue > 3
						? "high"
						: "medium",
			title: `Overdue: ${task.title} (${daysOverdue} days)`,
			description: `This task was due ${daysOverdue} days ago and is not yet completed`,
			affectedTasks: [task],
			affectedUsers: task.assignedTo ? [task.assignedTo] : [],
			impactedTaskCount: getBlockedChain(task, taskMap).length,
			recommendations: [
				`Task is ${daysOverdue} days overdue - immediate attention required`,
				task.assignedTo
					? `Check in with ${task.assignedTo} for status`
					: "Assign this task immediately",
				"Consider breaking into smaller tasks if too large",
			],
			detectedAt: new Date(),
		});
	});

	// 3. Unassigned critical tasks
	const unassignedCritical = tasks.filter(
		(t) =>
			!t.assignedTo &&
			t.priority === "critical" &&
			t.status !== "completed" &&
			t.status !== "cancelled"
	);
	if (unassignedCritical.length > 0) {
		bottlenecks.push({
			id: "unassigned-critical",
			type: "unassigned_critical",
			severity: "critical",
			title: `${unassignedCritical.length} Critical Tasks Unassigned`,
			description:
				"Critical tasks without assignees risk missing deadlines",
			affectedTasks: unassignedCritical,
			affectedUsers: [],
			impactedTaskCount: unassignedCritical.length,
			recommendations: [
				"Use AI assignment suggestions to find best matches",
				"Review team capacity before assigning",
				"Consider splitting tasks if too large for one person",
			],
			detectedAt: new Date(),
		});
	}

	// 4. Overloaded assignees
	const assigneeWorkload = new Map<string, ProposalTask[]>();
	tasks
		.filter(
			(t) =>
				t.assignedTo &&
				t.status !== "completed" &&
				t.status !== "cancelled"
		)
		.forEach((task) => {
			const existing = assigneeWorkload.get(task.assignedTo!) ?? [];
			assigneeWorkload.set(task.assignedTo!, [...existing, task]);
		});

	assigneeWorkload.forEach((userTasks, userName) => {
		const member = teamMembers.find((m) => m.userName === userName);
		const maxTasks = member?.maxConcurrentTasks ?? 5;
		const capacity = member?.availableHoursPerWeek ?? 40;

		const totalHours = userTasks.reduce(
			(sum, t) => sum + (t.estimatedHours ?? 0),
			0
		);
		const utilization = (totalHours / capacity) * 100;

		if (userTasks.length > maxTasks || utilization > 120) {
			bottlenecks.push({
				id: `overloaded-${userName}`,
				type: "overloaded_assignee",
				severity: utilization > 150 ? "critical" : "high",
				title: `${userName} is overloaded`,
				description: `${userTasks.length} tasks assigned (${Math.round(utilization)}% capacity)`,
				affectedTasks: userTasks,
				affectedUsers: [userName],
				impactedTaskCount: userTasks.length,
				recommendations: [
					`Reassign ${userTasks.length - maxTasks} lower-priority tasks`,
					"Review task estimates - may be overestimated",
					"Consider adding team members to help",
				],
				detectedAt: new Date(),
			});
		}
	});

	// 5. Deadline risk
	if (proposalDeadline) {
		const daysUntilDeadline = Math.ceil(
			(proposalDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
		);
		const incompleteTasks = tasks.filter(
			(t) => t.status !== "completed" && t.status !== "cancelled"
		);
		const totalRemainingHours = incompleteTasks.reduce(
			(sum, t) => sum + (t.estimatedHours ?? 0),
			0
		);
		const availableTeamHours =
			teamMembers.reduce(
				(sum, m) => sum + (m.availableHoursPerWeek ?? 40),
				0
			) *
			(daysUntilDeadline / 7);

		if (totalRemainingHours > availableTeamHours * 0.9) {
			bottlenecks.push({
				id: "deadline-risk",
				type: "deadline_risk",
				severity:
					totalRemainingHours > availableTeamHours ? "critical" : "high",
				title: "Deadline at Risk",
				description: `${Math.round(totalRemainingHours)}h of work remaining, ${Math.round(availableTeamHours)}h team capacity before deadline`,
				affectedTasks: incompleteTasks,
				affectedUsers: teamMembers.map((m) => m.userName),
				impactedTaskCount: incompleteTasks.length,
				recommendations: [
					"Reduce scope by deprioritizing non-essential tasks",
					"Add temporary team capacity",
					"Review and reduce estimates where possible",
					"Consider deadline extension request",
				],
				detectedAt: new Date(),
			});
		}
	}

	// Sort by severity
	const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
	bottlenecks.sort(
		(a, b) => severityOrder[a.severity] - severityOrder[b.severity]
	);

	return bottlenecks;
}

function getBlockedChain(
	task: ProposalTask,
	taskMap: Map<string, ProposalTask>,
	visited = new Set<string>()
): ProposalTask[] {
	if (visited.has(task.id)) return [];
	visited.add(task.id);

	const blocking = task.blocks ?? [];
	const chain: ProposalTask[] = [];

	blocking.forEach((blockingId) => {
		const blockedTask = taskMap.get(blockingId);
		if (blockedTask) {
			chain.push(blockedTask);
			chain.push(...getBlockedChain(blockedTask, taskMap, visited));
		}
	});

	return chain;
}

// ============================================================================
// Bottleneck Card Component
// ============================================================================

interface BottleneckCardProps {
	bottleneck: Bottleneck;
	onTaskClick?: (task: ProposalTask) => void;
	onResolve?: () => void;
	onDismiss?: () => void;
}

function BottleneckCard({
	bottleneck,
	onTaskClick,
	onResolve,
	onDismiss,
}: BottleneckCardProps) {
	const severityConfig = SEVERITY_CONFIG[bottleneck.severity];
	const typeConfig = BOTTLENECK_TYPE_CONFIG[bottleneck.type];
	const SeverityIcon = severityConfig.icon;
	const TypeIcon = typeConfig.icon;

	return (
		<Alert
			className={cn(
				"border-l-4",
				severityConfig.bgColor,
				severityConfig.borderColor
			)}
		>
			<div className="flex items-start gap-3">
				<SeverityIcon
					className={cn("w-5 h-5 mt-0.5", severityConfig.color)}
				/>

				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<AlertTitle className="mb-0">{bottleneck.title}</AlertTitle>
						<Badge
							variant="outline"
							className={cn("text-xs", severityConfig.color)}
						>
							{severityConfig.label}
						</Badge>
					</div>

					<AlertDescription className="text-sm">
						{bottleneck.description}
					</AlertDescription>

					{/* Affected tasks preview */}
					{bottleneck.affectedTasks.length > 0 && (
						<div className="mt-2 flex flex-wrap gap-1">
							{bottleneck.affectedTasks.slice(0, 3).map((task) => (
								<Badge
									key={task.id}
									variant="secondary"
									className="cursor-pointer hover:bg-gray-200"
									onClick={() => onTaskClick?.(task)}
								>
									{task.title.length > 25
										? task.title.slice(0, 25) + "..."
										: task.title}
								</Badge>
							))}
							{bottleneck.affectedTasks.length > 3 && (
								<Badge variant="secondary">
									+{bottleneck.affectedTasks.length - 3} more
								</Badge>
							)}
						</div>
					)}

					{/* Affected users */}
					{bottleneck.affectedUsers.length > 0 && (
						<div className="mt-2 flex items-center gap-1">
							<span className="text-xs text-gray-500">Affected:</span>
							{bottleneck.affectedUsers.slice(0, 3).map((user) => (
								<Avatar key={user} className="w-5 h-5">
									<AvatarFallback className="text-[10px]">
										{getInitials(user)}
									</AvatarFallback>
								</Avatar>
							))}
							{bottleneck.affectedUsers.length > 3 && (
								<span className="text-xs text-gray-500">
									+{bottleneck.affectedUsers.length - 3}
								</span>
							)}
						</div>
					)}

					{/* Recommendations */}
					{bottleneck.recommendations.length > 0 && (
						<div className="mt-3 p-2 bg-white/50 rounded border border-gray-200">
							<p className="text-xs font-medium text-gray-600 mb-1">
								Recommendations:
							</p>
							<ul className="text-xs text-gray-600 space-y-0.5">
								{bottleneck.recommendations.slice(0, 2).map((rec, i) => (
									<li key={i} className="flex items-start gap-1">
										<ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
										{rec}
									</li>
								))}
							</ul>
						</div>
					)}

					{/* Actions */}
					<div className="mt-3 flex gap-2">
						{onResolve && (
							<Button size="sm" variant="outline" onClick={onResolve}>
								<CheckCircle2 className="w-3.5 h-3.5 mr-1" />
								Mark Resolved
							</Button>
						)}
						{onDismiss && (
							<Button
								size="sm"
								variant="ghost"
								onClick={onDismiss}
								className="text-gray-500"
							>
								Dismiss
							</Button>
						)}
					</div>
				</div>
			</div>
		</Alert>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function BottleneckAlerts({
	tasks,
	teamMembers,
	proposalDeadline,
	onTaskClick,
	onResolve,
	onDismiss,
	className,
}: BottleneckAlertsProps) {
	// Detect bottlenecks
	const bottlenecks = useMemo(
		() => detectBottlenecks(tasks, teamMembers, proposalDeadline),
		[tasks, teamMembers, proposalDeadline]
	);

	// Group by severity
	const groupedBottlenecks = useMemo(() => {
		const groups: Record<BottleneckSeverity, Bottleneck[]> = {
			critical: [],
			high: [],
			medium: [],
			low: [],
		};

		bottlenecks.forEach((b) => {
			groups[b.severity].push(b);
		});

		return groups;
	}, [bottlenecks]);

	const criticalCount = groupedBottlenecks.critical.length;
	const highCount = groupedBottlenecks.high.length;
	const totalCount = bottlenecks.length;

	if (totalCount === 0) {
		return (
			<Card className={cn("bg-green-50 border-green-200", className)}>
				<CardContent className="py-6">
					<div className="flex items-center gap-3 text-green-700">
						<CheckCircle2 className="w-8 h-8" />
						<div>
							<p className="font-medium">No Bottlenecks Detected</p>
							<p className="text-sm text-green-600">
								All tasks are progressing smoothly
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className={cn("flex flex-col gap-4", className)}>
			{/* Summary header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold flex items-center gap-2">
						<AlertTriangle
							className={cn(
								"w-5 h-5",
								criticalCount > 0
									? "text-red-500"
									: highCount > 0
										? "text-orange-500"
										: "text-yellow-500"
							)}
						/>
						Bottleneck Alerts
					</h2>
					<p className="text-sm text-gray-500">
						{totalCount} issues detected
						{criticalCount > 0 && (
							<span className="text-red-600 ml-2">
								• {criticalCount} critical
							</span>
						)}
						{highCount > 0 && (
							<span className="text-orange-600 ml-2">• {highCount} high</span>
						)}
					</p>
				</div>

				{/* Quick stats */}
				<div className="flex gap-2">
					{Object.entries(groupedBottlenecks).map(([severity, items]) =>
						items.length > 0 ? (
							<Badge
								key={severity}
								variant="outline"
								className={cn(
									SEVERITY_CONFIG[severity as BottleneckSeverity].color
								)}
							>
								{items.length} {severity}
							</Badge>
						) : null
					)}
				</div>
			</div>

			{/* Bottleneck list */}
			<ScrollArea className="flex-1 max-h-[600px]">
				<div className="space-y-3">
					{bottlenecks.map((bottleneck) => (
						<BottleneckCard
							key={bottleneck.id}
							bottleneck={bottleneck}
							onTaskClick={onTaskClick}
							onResolve={onResolve ? () => onResolve(bottleneck.id) : undefined}
							onDismiss={onDismiss ? () => onDismiss(bottleneck.id) : undefined}
						/>
					))}
				</div>
			</ScrollArea>
		</div>
	);
}

export default BottleneckAlerts;
