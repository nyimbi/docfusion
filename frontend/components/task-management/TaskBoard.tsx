"use client";

/**
 * TaskBoard - Kanban-style board for visual task management.
 *
 * Features:
 * - Drag-and-drop between columns
 * - Configurable columns (by status, priority, assignee)
 * - Collapsible columns
 * - WIP (Work in Progress) limits
 * - Quick add task per column
 * - Column-level statistics
 */

import React, { useState, useMemo, useCallback } from "react";
import {
	Plus,
	MoreVertical,
	ChevronDown,
	ChevronRight,
	AlertTriangle,
	GripVertical,
	Users,
	Filter,
	Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TaskCard } from "./TaskCard";
import type { ProposalTask } from "@/lib/db/schema-tasks";

// ============================================================================
// Types
// ============================================================================

type GroupBy = "status" | "priority" | "assignee" | "taskType";

interface ColumnConfig {
	id: string;
	label: string;
	color: string;
	wipLimit?: number;
}

export interface TaskBoardProps {
	tasks: ProposalTask[];
	groupBy?: GroupBy;
	onTaskClick?: (task: ProposalTask) => void;
	onTaskEdit?: (task: ProposalTask) => void;
	onTaskAssign?: (task: ProposalTask) => void;
	onStatusChange?: (taskId: string, status: string) => void;
	onTaskMove?: (taskId: string, newGroup: string) => void;
	onAddTask?: (columnId: string) => void;
	className?: string;
}

// ============================================================================
// Column Configurations
// ============================================================================

const STATUS_COLUMNS: ColumnConfig[] = [
	{ id: "pending", label: "Pending", color: "bg-gray-500" },
	{ id: "assigned", label: "Assigned", color: "bg-blue-500" },
	{ id: "in_progress", label: "In Progress", color: "bg-amber-500", wipLimit: 5 },
	{ id: "review", label: "Review", color: "bg-purple-500", wipLimit: 3 },
	{ id: "blocked", label: "Blocked", color: "bg-red-500" },
	{ id: "completed", label: "Completed", color: "bg-green-500" },
];

const PRIORITY_COLUMNS: ColumnConfig[] = [
	{ id: "critical", label: "Critical", color: "bg-red-500" },
	{ id: "high", label: "High", color: "bg-orange-500" },
	{ id: "medium", label: "Medium", color: "bg-yellow-500" },
	{ id: "low", label: "Low", color: "bg-gray-500" },
];

const TASK_TYPE_COLUMNS: ColumnConfig[] = [
	{ id: "writing", label: "Writing", color: "bg-blue-500" },
	{ id: "review", label: "Review", color: "bg-purple-500" },
	{ id: "graphics", label: "Graphics", color: "bg-pink-500" },
	{ id: "research", label: "Research", color: "bg-teal-500" },
	{ id: "editing", label: "Editing", color: "bg-indigo-500" },
	{ id: "formatting", label: "Formatting", color: "bg-cyan-500" },
	{ id: "approval", label: "Approval", color: "bg-green-500" },
];

function getColumnsForGroupBy(groupBy: GroupBy): ColumnConfig[] {
	switch (groupBy) {
		case "status":
			return STATUS_COLUMNS;
		case "priority":
			return PRIORITY_COLUMNS;
		case "taskType":
			return TASK_TYPE_COLUMNS;
		case "assignee":
			return []; // Dynamic columns based on data
		default:
			return STATUS_COLUMNS;
	}
}

// ============================================================================
// Board Column Component
// ============================================================================

interface BoardColumnProps {
	column: ColumnConfig;
	tasks: ProposalTask[];
	isCollapsed: boolean;
	onToggleCollapse: () => void;
	onTaskClick?: (task: ProposalTask) => void;
	onTaskEdit?: (task: ProposalTask) => void;
	onTaskAssign?: (task: ProposalTask) => void;
	onStatusChange?: (taskId: string, status: string) => void;
	onAddTask?: () => void;
	onDragStart?: (taskId: string) => void;
	onDragOver?: (e: React.DragEvent) => void;
	onDrop?: (e: React.DragEvent) => void;
}

function BoardColumn({
	column,
	tasks,
	isCollapsed,
	onToggleCollapse,
	onTaskClick,
	onTaskEdit,
	onTaskAssign,
	onStatusChange,
	onAddTask,
	onDragStart,
	onDragOver,
	onDrop,
}: BoardColumnProps) {
	const isOverWipLimit = column.wipLimit && tasks.length > column.wipLimit;
	const criticalTasks = tasks.filter((t) => t.priority === "critical").length;
	const blockedTasks = tasks.filter((t) => t.status === "blocked").length;

	return (
		<div
			className={cn(
				"flex flex-col bg-gray-50 rounded-lg transition-all duration-200",
				isCollapsed ? "w-12" : "w-72 min-w-72"
			)}
			onDragOver={onDragOver}
			onDrop={onDrop}
		>
			{/* Column Header */}
			<div
				className={cn(
					"flex items-center gap-2 p-3 border-b bg-white rounded-t-lg",
					isCollapsed && "flex-col py-4"
				)}
			>
				<button
					onClick={onToggleCollapse}
					className="p-1 hover:bg-gray-100 rounded"
				>
					{isCollapsed ? (
						<ChevronRight className="w-4 h-4" />
					) : (
						<ChevronDown className="w-4 h-4" />
					)}
				</button>

				{/* Color indicator */}
				<div className={cn("w-3 h-3 rounded-full", column.color)} />

				{/* Title and count */}
				{!isCollapsed ? (
					<>
						<span className="font-medium text-sm flex-1">{column.label}</span>
						<Badge
							variant="secondary"
							className={cn(
								"px-2",
								isOverWipLimit && "bg-red-100 text-red-700"
							)}
						>
							{tasks.length}
							{column.wipLimit && `/${column.wipLimit}`}
						</Badge>
					</>
				) : (
					<div className="flex flex-col items-center gap-1 writing-vertical-rl rotate-180">
						<span className="font-medium text-xs">{column.label}</span>
						<Badge variant="secondary" className="px-1.5 py-0.5 text-xs">
							{tasks.length}
						</Badge>
					</div>
				)}

				{/* Column actions */}
				{!isCollapsed && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-6 w-6 p-0">
								<MoreVertical className="w-4 h-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={onAddTask}>
								<Plus className="w-4 h-4 mr-2" />
								Add Task
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem>Set WIP Limit</DropdownMenuItem>
							<DropdownMenuItem>Sort by Priority</DropdownMenuItem>
							<DropdownMenuItem>Sort by Due Date</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>

			{/* WIP Warning */}
			{!isCollapsed && isOverWipLimit && (
				<div className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 text-xs">
					<AlertTriangle className="w-3.5 h-3.5" />
					<span>WIP limit exceeded</span>
				</div>
			)}

			{/* Column stats */}
			{!isCollapsed && (criticalTasks > 0 || blockedTasks > 0) && (
				<div className="flex items-center gap-3 px-3 py-1.5 bg-amber-50 text-xs">
					{criticalTasks > 0 && (
						<span className="text-red-600">{criticalTasks} critical</span>
					)}
					{blockedTasks > 0 && (
						<span className="text-orange-600">{blockedTasks} blocked</span>
					)}
				</div>
			)}

			{/* Tasks */}
			{!isCollapsed && (
				<ScrollArea className="flex-1 p-2">
					<div className="flex flex-col gap-2">
						{tasks.map((task) => (
							<div
								key={task.id}
								draggable
								onDragStart={(e) => {
									e.dataTransfer.setData("taskId", task.id);
									onDragStart?.(task.id);
								}}
							>
								<TaskCard
									task={task}
									variant="default"
									showDragHandle
									onClick={onTaskClick}
									onEdit={onTaskEdit}
									onAssign={onTaskAssign}
									onStatusChange={onStatusChange}
								/>
							</div>
						))}

						{/* Empty state */}
						{tasks.length === 0 && (
							<div className="flex flex-col items-center justify-center py-8 text-gray-400">
								<p className="text-sm">No tasks</p>
								<Button
									variant="ghost"
									size="sm"
									onClick={onAddTask}
									className="mt-2"
								>
									<Plus className="w-4 h-4 mr-1" />
									Add task
								</Button>
							</div>
						)}
					</div>
				</ScrollArea>
			)}

			{/* Quick add button */}
			{!isCollapsed && tasks.length > 0 && (
				<div className="p-2 border-t">
					<Button
						variant="ghost"
						size="sm"
						onClick={onAddTask}
						className="w-full justify-start text-gray-500"
					>
						<Plus className="w-4 h-4 mr-1" />
						Add task
					</Button>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function TaskBoard({
	tasks,
	groupBy = "status",
	onTaskClick,
	onTaskEdit,
	onTaskAssign,
	onStatusChange,
	onTaskMove,
	onAddTask,
	className,
}: TaskBoardProps) {
	const [currentGroupBy, setCurrentGroupBy] = useState<GroupBy>(groupBy);
	const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(
		new Set()
	);
	const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
	const [showCompleted, setShowCompleted] = useState(false);

	// Generate columns based on groupBy
	const columns = useMemo(() => {
		if (currentGroupBy === "assignee") {
			// Generate dynamic columns for assignees
			const assignees = new Set<string>();
			tasks.forEach((task) => {
				if (task.assignedTo) {
					assignees.add(task.assignedTo);
				}
			});

			const assigneeColumns: ColumnConfig[] = [
				{ id: "unassigned", label: "Unassigned", color: "bg-gray-500" },
				...Array.from(assignees)
					.sort()
					.map((assignee, index) => ({
						id: assignee,
						label: assignee,
						color: `bg-${
							["blue", "green", "purple", "pink", "indigo", "teal"][index % 6]
						}-500`,
					})),
			];

			return assigneeColumns;
		}

		return getColumnsForGroupBy(currentGroupBy);
	}, [currentGroupBy, tasks]);

	// Group tasks by column
	const groupedTasks = useMemo(() => {
		const groups: Record<string, ProposalTask[]> = {};

		// Initialize all columns
		columns.forEach((col) => {
			groups[col.id] = [];
		});

		// Group tasks
		tasks.forEach((task) => {
			// Skip completed/cancelled unless showCompleted
			if (!showCompleted && (task.status === "completed" || task.status === "cancelled")) {
				return;
			}

			let groupKey: string;

			switch (currentGroupBy) {
				case "status":
					groupKey = task.status ?? "pending";
					break;
				case "priority":
					groupKey = task.priority ?? "medium";
					break;
				case "assignee":
					groupKey = task.assignedTo ?? "unassigned";
					break;
				case "taskType":
					groupKey = task.taskType;
					break;
				default:
					groupKey = task.status ?? "pending";
			}

			if (!groups[groupKey]) {
				groups[groupKey] = [];
			}
			groups[groupKey].push(task);
		});

		// Sort tasks within each group by priority then due date
		Object.values(groups).forEach((groupTasks) => {
			groupTasks.sort((a, b) => {
				// Priority order
				const priorityOrder: Record<string, number> = {
					critical: 0,
					high: 1,
					medium: 2,
					low: 3,
				};
				const priorityDiff =
					(priorityOrder[a.priority ?? "medium"] ?? 2) -
					(priorityOrder[b.priority ?? "medium"] ?? 2);
				if (priorityDiff !== 0) return priorityDiff;

				// Due date
				const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
				const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
				return aDate - bDate;
			});
		});

		return groups;
	}, [tasks, currentGroupBy, columns, showCompleted]);

	// Handlers
	const handleToggleCollapse = useCallback((columnId: string) => {
		setCollapsedColumns((prev) => {
			const next = new Set(prev);
			if (next.has(columnId)) {
				next.delete(columnId);
			} else {
				next.add(columnId);
			}
			return next;
		});
	}, []);

	const handleDragStart = useCallback((taskId: string) => {
		setDraggingTaskId(taskId);
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
	}, []);

	const handleDrop = useCallback(
		(columnId: string) => (e: React.DragEvent) => {
			e.preventDefault();
			const taskId = e.dataTransfer.getData("taskId");

			if (taskId && onTaskMove) {
				onTaskMove(taskId, columnId);
			} else if (taskId && currentGroupBy === "status" && onStatusChange) {
				onStatusChange(taskId, columnId);
			}

			setDraggingTaskId(null);
		},
		[onTaskMove, currentGroupBy, onStatusChange]
	);

	// Statistics
	const stats = useMemo(() => {
		const total = tasks.length;
		const completed = tasks.filter((t) => t.status === "completed").length;
		const blocked = tasks.filter((t) => t.status === "blocked").length;
		const overdue = tasks.filter(
			(t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "completed"
		).length;

		return { total, completed, blocked, overdue };
	}, [tasks]);

	return (
		<div className={cn("flex flex-col gap-4", className)}>
			{/* Toolbar */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					{/* Group by selector */}
					<div className="flex items-center gap-2">
						<span className="text-sm text-gray-500">Group by:</span>
						<Select
							value={currentGroupBy}
							onValueChange={(value) => setCurrentGroupBy(value as GroupBy)}
						>
							<SelectTrigger className="w-[140px] h-9">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="status">Status</SelectItem>
								<SelectItem value="priority">Priority</SelectItem>
								<SelectItem value="assignee">Assignee</SelectItem>
								<SelectItem value="taskType">Task Type</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Stats */}
					<div className="flex items-center gap-3 text-sm text-gray-500">
						<span>{stats.total} tasks</span>
						{stats.completed > 0 && (
							<span className="text-green-600">{stats.completed} done</span>
						)}
						{stats.blocked > 0 && (
							<span className="text-red-600">{stats.blocked} blocked</span>
						)}
						{stats.overdue > 0 && (
							<span className="text-orange-600">{stats.overdue} overdue</span>
						)}
					</div>
				</div>

				<div className="flex items-center gap-2">
					{/* Show completed toggle */}
					<Button
						variant={showCompleted ? "secondary" : "outline"}
						size="sm"
						onClick={() => setShowCompleted(!showCompleted)}
						className="h-9"
					>
						{showCompleted ? "Hide Completed" : "Show Completed"}
					</Button>

					{/* Settings */}
					<Button variant="outline" size="sm" className="h-9">
						<Settings className="w-4 h-4" />
					</Button>
				</div>
			</div>

			{/* Board */}
			<div className="flex gap-3 overflow-x-auto pb-4">
				{columns.map((column) => {
					// Skip completed column unless showing completed
					if (column.id === "completed" && !showCompleted) return null;
					if (column.id === "cancelled" && !showCompleted) return null;

					return (
						<BoardColumn
							key={column.id}
							column={column}
							tasks={groupedTasks[column.id] ?? []}
							isCollapsed={collapsedColumns.has(column.id)}
							onToggleCollapse={() => handleToggleCollapse(column.id)}
							onTaskClick={onTaskClick}
							onTaskEdit={onTaskEdit}
							onTaskAssign={onTaskAssign}
							onStatusChange={onStatusChange}
							onAddTask={() => onAddTask?.(column.id)}
							onDragStart={handleDragStart}
							onDragOver={handleDragOver}
							onDrop={handleDrop(column.id)}
						/>
					);
				})}
			</div>
		</div>
	);
}

export default TaskBoard;
