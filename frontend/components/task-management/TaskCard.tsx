"use client";

/**
 * TaskCard - Individual task card for display in lists and boards.
 *
 * Features:
 * - Visual priority/status indicators
 * - Progress tracking display
 * - Drag handle for board reordering
 * - Quick actions (assign, edit, complete)
 * - Dependency warnings
 * - Due date countdown with urgency coloring
 */

import React, { useState, useCallback } from "react";
import {
	Calendar,
	Clock,
	User,
	AlertTriangle,
	CheckCircle2,
	Circle,
	Pause,
	Play,
	MoreVertical,
	GripVertical,
	Link2,
	MessageSquare,
	Tag,
	ChevronRight,
	Zap,
	Target,
	FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ProposalTask } from "@/lib/db/schema-tasks";

// ============================================================================
// Types
// ============================================================================

export interface TaskCardProps {
	task: ProposalTask;
	variant?: "compact" | "default" | "expanded";
	isDragging?: boolean;
	showDragHandle?: boolean;
	onEdit?: (task: ProposalTask) => void;
	onAssign?: (task: ProposalTask) => void;
	onStatusChange?: (taskId: string, status: string) => void;
	onDelete?: (taskId: string) => void;
	onClick?: (task: ProposalTask) => void;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG: Record<string, {
	label: string;
	color: string;
	bgColor: string;
	icon: React.ComponentType<{ className?: string }>;
}> = {
	pending: {
		label: "Pending",
		color: "text-gray-600",
		bgColor: "bg-gray-100",
		icon: Circle,
	},
	assigned: {
		label: "Assigned",
		color: "text-blue-600",
		bgColor: "bg-blue-100",
		icon: User,
	},
	in_progress: {
		label: "In Progress",
		color: "text-amber-600",
		bgColor: "bg-amber-100",
		icon: Play,
	},
	review: {
		label: "Review",
		color: "text-purple-600",
		bgColor: "bg-purple-100",
		icon: Target,
	},
	blocked: {
		label: "Blocked",
		color: "text-red-600",
		bgColor: "bg-red-100",
		icon: Pause,
	},
	completed: {
		label: "Completed",
		color: "text-green-600",
		bgColor: "bg-green-100",
		icon: CheckCircle2,
	},
	cancelled: {
		label: "Cancelled",
		color: "text-gray-400",
		bgColor: "bg-gray-50",
		icon: Circle,
	},
};

const PRIORITY_CONFIG: Record<string, {
	label: string;
	color: string;
	bgColor: string;
	borderColor: string;
}> = {
	critical: {
		label: "Critical",
		color: "text-red-700",
		bgColor: "bg-red-50",
		borderColor: "border-l-red-500",
	},
	high: {
		label: "High",
		color: "text-orange-700",
		bgColor: "bg-orange-50",
		borderColor: "border-l-orange-500",
	},
	medium: {
		label: "Medium",
		color: "text-yellow-700",
		bgColor: "bg-yellow-50",
		borderColor: "border-l-yellow-500",
	},
	low: {
		label: "Low",
		color: "text-gray-600",
		bgColor: "bg-gray-50",
		borderColor: "border-l-gray-300",
	},
};

const TASK_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
	writing: FileText,
	review: Target,
	graphics: FileText,
	research: FileText,
	editing: FileText,
	formatting: FileText,
	approval: CheckCircle2,
};

// ============================================================================
// Helper Functions
// ============================================================================

function getDueDateInfo(dueDate: Date | string | null): {
	label: string;
	urgency: "overdue" | "today" | "soon" | "normal" | "none";
	daysRemaining: number | null;
} {
	if (!dueDate) {
		return { label: "No due date", urgency: "none", daysRemaining: null };
	}

	const due = new Date(dueDate);
	const now = new Date();
	const diffMs = due.getTime() - now.getTime();
	const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays < 0) {
		return {
			label: `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""} overdue`,
			urgency: "overdue",
			daysRemaining: diffDays,
		};
	}

	if (diffDays === 0) {
		return { label: "Due today", urgency: "today", daysRemaining: 0 };
	}

	if (diffDays <= 3) {
		return {
			label: `Due in ${diffDays} day${diffDays !== 1 ? "s" : ""}`,
			urgency: "soon",
			daysRemaining: diffDays,
		};
	}

	return {
		label: `Due ${due.toLocaleDateString()}`,
		urgency: "normal",
		daysRemaining: diffDays,
	};
}

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

// ============================================================================
// Component
// ============================================================================

export function TaskCard({
	task,
	variant = "default",
	isDragging = false,
	showDragHandle = false,
	onEdit,
	onAssign,
	onStatusChange,
	onDelete,
	onClick,
	className,
}: TaskCardProps) {
	const [isHovered, setIsHovered] = useState(false);

	const statusConfig = STATUS_CONFIG[task.status ?? "pending"];
	const priorityConfig = PRIORITY_CONFIG[task.priority ?? "medium"];
	const dueDateInfo = getDueDateInfo(task.dueDate);
	const StatusIcon = statusConfig.icon;
	const TaskTypeIcon = TASK_TYPE_ICONS[task.taskType] ?? FileText;

	const hasBlockers = task.blockedBy && task.blockedBy.length > 0;
	const blocksOthers = task.blocks && task.blocks.length > 0;
	const hasComments = task.comments && task.comments.length > 0;
	const hasTags = task.tags && task.tags.length > 0;

	const handleClick = useCallback(() => {
		onClick?.(task);
	}, [onClick, task]);

	const handleStatusChange = useCallback(
		(newStatus: string) => {
			onStatusChange?.(task.id, newStatus);
		},
		[onStatusChange, task.id]
	);

	// Compact variant - minimal info, used in dense lists
	if (variant === "compact") {
		return (
			<div
				className={cn(
					"flex items-center gap-2 p-2 rounded-md border border-transparent",
					"hover:bg-gray-50 hover:border-gray-200 cursor-pointer",
					"transition-all duration-150",
					isDragging && "opacity-50",
					className
				)}
				onClick={handleClick}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}

	role="button"
	tabIndex={0}
	onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
				{showDragHandle && (
					<GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
				)}

				<StatusIcon className={cn("w-4 h-4", statusConfig.color)} />

				<span className="flex-1 text-sm truncate">{task.title}</span>

				{task.assignedTo && (
					<Avatar className="w-5 h-5">
						<AvatarFallback className="text-xs">
							{getInitials(task.assignedTo)}
						</AvatarFallback>
					</Avatar>
				)}

				{dueDateInfo.urgency !== "none" && (
					<span
						className={cn(
							"text-xs",
							dueDateInfo.urgency === "overdue" && "text-red-600 font-medium",
							dueDateInfo.urgency === "today" && "text-orange-600",
							dueDateInfo.urgency === "soon" && "text-yellow-600",
							dueDateInfo.urgency === "normal" && "text-gray-500"
						)}
					>
						{dueDateInfo.daysRemaining !== null
							? `${dueDateInfo.daysRemaining}d`
							: ""}
					</span>
				)}
			</div>
		);
	}

	// Expanded variant - shows all details
	if (variant === "expanded") {
		return (
			<Card
				className={cn(
					"border-l-4 transition-all duration-200",
					priorityConfig.borderColor,
					isDragging && "opacity-50 shadow-lg",
					onClick && "cursor-pointer hover:shadow-md",
					className
				)}
				onClick={handleClick}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
			>
				<CardHeader className="pb-2">
					<div className="flex items-start justify-between gap-2">
						<div className="flex items-start gap-2 flex-1">
							{showDragHandle && (
								<GripVertical className="w-5 h-5 text-gray-400 cursor-grab mt-0.5" />
							)}

							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2 mb-1">
									{task.taskNumber && (
										<span className="text-xs font-mono text-gray-500">
											{task.taskNumber}
										</span>
									)}
									<Badge
										variant="outline"
										className={cn("text-xs", priorityConfig.color)}
									>
										{priorityConfig.label}
									</Badge>
									<Badge
										variant="outline"
										className={cn("text-xs", statusConfig.color)}
									>
										<StatusIcon className="w-3 h-3 mr-1" />
										{statusConfig.label}
									</Badge>
								</div>

								<h4 className="font-medium text-sm leading-tight">
									{task.title}
								</h4>

								{task.description && (
									<p className="text-xs text-gray-500 mt-1 line-clamp-2">
										{task.description}
									</p>
								)}
							</div>
						</div>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
									<MoreVertical className="w-4 h-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => onEdit?.(task)}>
									Edit Task
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => onAssign?.(task)}>
									Assign
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => handleStatusChange("in_progress")}
									disabled={task.status === "in_progress"}
								>
									Start Task
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => handleStatusChange("completed")}
									disabled={task.status === "completed"}
								>
									Mark Complete
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => handleStatusChange("blocked")}
									disabled={task.status === "blocked"}
								>
									Mark Blocked
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => onDelete?.(task.id)}
									className="text-red-600"
								>
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</CardHeader>

				<CardContent className="pt-0">
					{/* Progress bar */}
					{task.progress != null && task.progress > 0 && (
						<div className="mb-3">
							<div className="flex justify-between text-xs text-gray-500 mb-1">
								<span>Progress</span>
								<span>{task.progress}%</span>
							</div>
							<Progress value={task.progress} className="h-1.5" />
						</div>
					)}

					{/* Meta info row */}
					<div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
						{/* Due date */}
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<div
										className={cn(
											"flex items-center gap-1",
											dueDateInfo.urgency === "overdue" &&
												"text-red-600 font-medium",
											dueDateInfo.urgency === "today" && "text-orange-600",
											dueDateInfo.urgency === "soon" && "text-yellow-600"
										)}
									>
										<Calendar className="w-3.5 h-3.5" />
										<span>{dueDateInfo.label}</span>
									</div>
								</TooltipTrigger>
								<TooltipContent>
									{task.dueDate
										? new Date(task.dueDate).toLocaleString()
										: "No due date set"}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						{/* Estimated hours */}
						{task.estimatedHours && (
							<div className="flex items-center gap-1">
								<Clock className="w-3.5 h-3.5" />
								<span>{task.estimatedHours}h est</span>
								{task.actualHours && (
									<span className="text-gray-400">
										/ {task.actualHours}h actual
									</span>
								)}
							</div>
						)}

						{/* Assignee */}
						{task.assignedTo && (
							<div className="flex items-center gap-1">
								<Avatar className="w-4 h-4">
									<AvatarFallback className="text-[10px]">
										{getInitials(task.assignedTo)}
									</AvatarFallback>
								</Avatar>
								<span>{task.assignedTo}</span>
							</div>
						)}

						{/* Task type */}
						<div className="flex items-center gap-1">
							<TaskTypeIcon className="w-3.5 h-3.5" />
							<span className="capitalize">{task.taskType}</span>
						</div>
					</div>

					{/* Dependencies and blockers */}
					{(hasBlockers || blocksOthers) && (
						<div className="flex items-center gap-2 mt-2 pt-2 border-t">
							{hasBlockers && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Badge
												variant="outline"
												className="text-red-600 border-red-200 bg-red-50"
											>
												<AlertTriangle className="w-3 h-3 mr-1" />
												Blocked by {task.blockedBy?.length}
											</Badge>
										</TooltipTrigger>
										<TooltipContent>
											<p>This task is waiting on other tasks</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}

							{blocksOthers && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Badge
												variant="outline"
												className="text-amber-600 border-amber-200 bg-amber-50"
											>
												<Link2 className="w-3 h-3 mr-1" />
												Blocks {task.blocks?.length}
											</Badge>
										</TooltipTrigger>
										<TooltipContent>
											<p>Other tasks are waiting on this one</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}
						</div>
					)}

					{/* Tags */}
					{hasTags && (
						<div className="flex flex-wrap gap-1 mt-2">
							{task.tags?.slice(0, 3).map((tag) => (
								<Badge
									key={tag}
									variant="secondary"
									className="text-xs px-1.5 py-0"
								>
									{tag}
								</Badge>
							))}
							{task.tags && task.tags.length > 3 && (
								<Badge variant="secondary" className="text-xs px-1.5 py-0">
									+{task.tags.length - 3}
								</Badge>
							)}
						</div>
					)}

					{/* Comments indicator */}
					{hasComments && (
						<div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
							<MessageSquare className="w-3.5 h-3.5" />
							<span>{task.comments?.length} comments</span>
						</div>
					)}
				</CardContent>
			</Card>
		);
	}

	// Default variant - balanced information
	return (
		<Card
			className={cn(
				"border-l-4 transition-all duration-200",
				priorityConfig.borderColor,
				isDragging && "opacity-50 shadow-lg",
				onClick && "cursor-pointer hover:shadow-md",
				className
			)}
			onClick={handleClick}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<CardContent className="p-3">
				<div className="flex items-start gap-2">
					{showDragHandle && (
						<GripVertical className="w-4 h-4 text-gray-400 cursor-grab mt-1" />
					)}

					<div className="flex-1 min-w-0">
						{/* Header row */}
						<div className="flex items-center justify-between gap-2 mb-1">
							<div className="flex items-center gap-1.5">
								<StatusIcon className={cn("w-4 h-4", statusConfig.color)} />
								{task.taskNumber && (
									<span className="text-xs font-mono text-gray-400">
										{task.taskNumber}
									</span>
								)}
							</div>

							<div className="flex items-center gap-1">
								{task.priority === "critical" && (
									<Zap className="w-3.5 h-3.5 text-red-500" />
								)}
								{(isHovered || true) && (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="sm"
												className="h-6 w-6 p-0"
												onClick={(e) => e.stopPropagation()}
											>
												<MoreVertical className="w-3.5 h-3.5" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem
												onClick={(e) => {
													e.stopPropagation();
													onEdit?.(task);
												}}
											>
												Edit
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={(e) => {
													e.stopPropagation();
													onAssign?.(task);
												}}
											>
												Assign
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												onClick={(e) => {
													e.stopPropagation();
													handleStatusChange("completed");
												}}
											>
												Complete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								)}
							</div>
						</div>

						{/* Title */}
						<h4 className="font-medium text-sm leading-tight mb-2 line-clamp-2">
							{task.title}
						</h4>

						{/* Progress bar */}
						{task.progress != null && task.progress > 0 && (
							<div className="mb-2">
								<Progress value={task.progress} className="h-1" />
							</div>
						)}

						{/* Footer row */}
						<div className="flex items-center justify-between text-xs text-gray-500">
							<div className="flex items-center gap-2">
								{/* Due date */}
								{dueDateInfo.urgency !== "none" && (
									<span
										className={cn(
											dueDateInfo.urgency === "overdue" &&
												"text-red-600 font-medium",
											dueDateInfo.urgency === "today" && "text-orange-600",
											dueDateInfo.urgency === "soon" && "text-yellow-600"
										)}
									>
										{dueDateInfo.label}
									</span>
								)}

								{/* Blockers indicator */}
								{hasBlockers && (
									<AlertTriangle className="w-3.5 h-3.5 text-red-500" />
								)}

								{/* Comments indicator */}
								{hasComments && (
									<div className="flex items-center gap-0.5">
										<MessageSquare className="w-3 h-3" />
										<span>{task.comments?.length}</span>
									</div>
								)}
							</div>

							{/* Assignee */}
							{task.assignedTo && (
								<Avatar className="w-5 h-5">
									<AvatarFallback className="text-[10px]">
										{getInitials(task.assignedTo)}
									</AvatarFallback>
								</Avatar>
							)}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export default TaskCard;
