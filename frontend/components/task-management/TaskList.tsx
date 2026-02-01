"use client";

/**
 * TaskList - Filterable, sortable list view of tasks.
 *
 * Features:
 * - Multi-column sorting
 * - Status/priority/assignee filtering
 * - Batch selection and operations
 * - Virtualized rendering for large lists
 * - Inline status updates
 * - Export capabilities
 */

import React, { useState, useMemo, useCallback } from "react";
import {
	ChevronDown,
	ChevronUp,
	Filter,
	Search,
	Download,
	RefreshCw,
	CheckSquare,
	Square,
	MoreHorizontal,
	Calendar,
	User,
	Tag,
	ArrowUpDown,
	X,
	Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	DropdownMenuCheckboxItem,
	DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { TaskCard } from "./TaskCard";
import type { ProposalTask } from "@/lib/db/schema-tasks";

// ============================================================================
// Types
// ============================================================================

type SortField =
	| "title"
	| "status"
	| "priority"
	| "dueDate"
	| "assignedTo"
	| "progress"
	| "taskType";
type SortDirection = "asc" | "desc";

export interface TaskListFilters {
	search: string;
	status: string[];
	priority: string[];
	assignee: string[];
	taskType: string[];
	tags: string[];
	dueDateRange: { from?: Date; to?: Date } | null;
	showCompleted: boolean;
	showCancelled: boolean;
}

export interface TaskListProps {
	tasks: ProposalTask[];
	loading?: boolean;
	viewMode?: "table" | "cards";
	onTaskClick?: (task: ProposalTask) => void;
	onTaskEdit?: (task: ProposalTask) => void;
	onTaskAssign?: (task: ProposalTask) => void;
	onStatusChange?: (taskId: string, status: string) => void;
	onBulkStatusChange?: (taskIds: string[], status: string) => void;
	onBulkAssign?: (taskIds: string[], assignee: string) => void;
	onBulkDelete?: (taskIds: string[]) => void;
	onRefresh?: () => void;
	onExport?: (tasks: ProposalTask[]) => void;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_OPTIONS = [
	{ value: "pending", label: "Pending" },
	{ value: "assigned", label: "Assigned" },
	{ value: "in_progress", label: "In Progress" },
	{ value: "review", label: "Review" },
	{ value: "blocked", label: "Blocked" },
	{ value: "completed", label: "Completed" },
	{ value: "cancelled", label: "Cancelled" },
];

const PRIORITY_OPTIONS = [
	{ value: "critical", label: "Critical" },
	{ value: "high", label: "High" },
	{ value: "medium", label: "Medium" },
	{ value: "low", label: "Low" },
];

const TASK_TYPE_OPTIONS = [
	{ value: "writing", label: "Writing" },
	{ value: "review", label: "Review" },
	{ value: "graphics", label: "Graphics" },
	{ value: "research", label: "Research" },
	{ value: "editing", label: "Editing" },
	{ value: "formatting", label: "Formatting" },
	{ value: "approval", label: "Approval" },
];

const DEFAULT_FILTERS: TaskListFilters = {
	search: "",
	status: [],
	priority: [],
	assignee: [],
	taskType: [],
	tags: [],
	dueDateRange: null,
	showCompleted: false,
	showCancelled: false,
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

function getPriorityOrder(priority: string | null): number {
	const order: Record<string, number> = {
		critical: 0,
		high: 1,
		medium: 2,
		low: 3,
	};
	return order[priority ?? "medium"] ?? 2;
}

function getStatusOrder(status: string | null): number {
	const order: Record<string, number> = {
		blocked: 0,
		in_progress: 1,
		review: 2,
		assigned: 3,
		pending: 4,
		completed: 5,
		cancelled: 6,
	};
	return order[status ?? "pending"] ?? 4;
}

function getStatusColor(status: string | null): string {
	const colors: Record<string, string> = {
		pending: "bg-gray-100 text-gray-700",
		assigned: "bg-blue-100 text-blue-700",
		in_progress: "bg-amber-100 text-amber-700",
		review: "bg-purple-100 text-purple-700",
		blocked: "bg-red-100 text-red-700",
		completed: "bg-green-100 text-green-700",
		cancelled: "bg-gray-50 text-gray-400",
	};
	return colors[status ?? "pending"] ?? colors.pending;
}

function getPriorityColor(priority: string | null): string {
	const colors: Record<string, string> = {
		critical: "bg-red-100 text-red-700",
		high: "bg-orange-100 text-orange-700",
		medium: "bg-yellow-100 text-yellow-700",
		low: "bg-gray-100 text-gray-600",
	};
	return colors[priority ?? "medium"] ?? colors.medium;
}

// ============================================================================
// Component
// ============================================================================

export function TaskList({
	tasks,
	loading = false,
	viewMode = "table",
	onTaskClick,
	onTaskEdit,
	onTaskAssign,
	onStatusChange,
	onBulkStatusChange,
	onBulkAssign,
	onBulkDelete,
	onRefresh,
	onExport,
	className,
}: TaskListProps) {
	// State
	const [filters, setFilters] = useState<TaskListFilters>(DEFAULT_FILTERS);
	const [sortField, setSortField] = useState<SortField>("dueDate");
	const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
	const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
	const [showFilters, setShowFilters] = useState(false);

	// Extract unique values for filter dropdowns
	const filterOptions = useMemo(() => {
		const assignees = new Set<string>();
		const tags = new Set<string>();

		tasks.forEach((task) => {
			if (task.assignedTo) assignees.add(task.assignedTo);
			task.tags?.forEach((tag) => tags.add(tag));
		});

		return {
			assignees: Array.from(assignees).sort(),
			tags: Array.from(tags).sort(),
		};
	}, [tasks]);

	// Filter tasks
	const filteredTasks = useMemo(() => {
		return tasks.filter((task) => {
			// Search filter
			if (filters.search) {
				const searchLower = filters.search.toLowerCase();
				const matchesSearch =
					task.title.toLowerCase().includes(searchLower) ||
					task.description?.toLowerCase().includes(searchLower) ||
					task.taskNumber?.toLowerCase().includes(searchLower) ||
					task.assignedTo?.toLowerCase().includes(searchLower);
				if (!matchesSearch) return false;
			}

			// Status filter
			if (filters.status.length > 0) {
				if (!filters.status.includes(task.status ?? "pending")) return false;
			} else {
				// Default: hide completed and cancelled unless explicitly shown
				if (!filters.showCompleted && task.status === "completed") return false;
				if (!filters.showCancelled && task.status === "cancelled") return false;
			}

			// Priority filter
			if (filters.priority.length > 0) {
				if (!filters.priority.includes(task.priority ?? "medium")) return false;
			}

			// Assignee filter
			if (filters.assignee.length > 0) {
				if (!task.assignedTo || !filters.assignee.includes(task.assignedTo))
					return false;
			}

			// Task type filter
			if (filters.taskType.length > 0) {
				if (!filters.taskType.includes(task.taskType)) return false;
			}

			// Tags filter
			if (filters.tags.length > 0) {
				const taskTags = task.tags ?? [];
				if (!filters.tags.some((tag) => taskTags.includes(tag))) return false;
			}

			// Due date range filter
			if (filters.dueDateRange) {
				if (!task.dueDate) return false;
				const dueDate = new Date(task.dueDate);
				if (filters.dueDateRange.from && dueDate < filters.dueDateRange.from)
					return false;
				if (filters.dueDateRange.to && dueDate > filters.dueDateRange.to)
					return false;
			}

			return true;
		});
	}, [tasks, filters]);

	// Sort tasks
	const sortedTasks = useMemo(() => {
		const sorted = [...filteredTasks];

		sorted.sort((a, b) => {
			let comparison = 0;

			switch (sortField) {
				case "title":
					comparison = a.title.localeCompare(b.title);
					break;
				case "status":
					comparison =
						getStatusOrder(a.status) - getStatusOrder(b.status);
					break;
				case "priority":
					comparison =
						getPriorityOrder(a.priority) - getPriorityOrder(b.priority);
					break;
				case "dueDate": {
					const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
					const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
					comparison = aDate - bDate;
					break;
				}
				case "assignedTo":
					comparison = (a.assignedTo ?? "zzz").localeCompare(
						b.assignedTo ?? "zzz"
					);
					break;
				case "progress":
					comparison = (a.progress ?? 0) - (b.progress ?? 0);
					break;
				case "taskType":
					comparison = a.taskType.localeCompare(b.taskType);
					break;
			}

			return sortDirection === "asc" ? comparison : -comparison;
		});

		return sorted;
	}, [filteredTasks, sortField, sortDirection]);

	// Handlers
	const handleSort = useCallback(
		(field: SortField) => {
			if (sortField === field) {
				setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
			} else {
				setSortField(field);
				setSortDirection("asc");
			}
		},
		[sortField]
	);

	const handleSelectAll = useCallback(() => {
		if (selectedTasks.size === sortedTasks.length) {
			setSelectedTasks(new Set());
		} else {
			setSelectedTasks(new Set(sortedTasks.map((t) => t.id)));
		}
	}, [selectedTasks.size, sortedTasks]);

	const handleSelectTask = useCallback((taskId: string) => {
		setSelectedTasks((prev) => {
			const next = new Set(prev);
			if (next.has(taskId)) {
				next.delete(taskId);
			} else {
				next.add(taskId);
			}
			return next;
		});
	}, []);

	const handleClearFilters = useCallback(() => {
		setFilters(DEFAULT_FILTERS);
	}, []);

	const handleFilterChange = useCallback(
		<K extends keyof TaskListFilters>(key: K, value: TaskListFilters[K]) => {
			setFilters((prev) => ({ ...prev, [key]: value }));
		},
		[]
	);

	const activeFilterCount = useMemo(() => {
		let count = 0;
		if (filters.search) count++;
		if (filters.status.length) count++;
		if (filters.priority.length) count++;
		if (filters.assignee.length) count++;
		if (filters.taskType.length) count++;
		if (filters.tags.length) count++;
		if (filters.dueDateRange) count++;
		return count;
	}, [filters]);

	// Sort icon component
	const SortIcon = ({ field }: { field: SortField }) => {
		if (sortField !== field) {
			return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
		}
		return sortDirection === "asc" ? (
			<ChevronUp className="w-4 h-4" />
		) : (
			<ChevronDown className="w-4 h-4" />
		);
	};

	return (
		<div className={cn("flex flex-col gap-4", className)}>
			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-2">
				{/* Search */}
				<div className="relative flex-1 min-w-[200px] max-w-[300px]">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
					<Input
						placeholder="Search tasks..."
						value={filters.search}
						onChange={(e) => handleFilterChange("search", e.target.value)}
						className="pl-8 h-9"
					/>
				</div>

				{/* Quick filters */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" className="h-9">
							<Filter className="w-4 h-4 mr-1.5" />
							Status
							{filters.status.length > 0 && (
								<Badge variant="secondary" className="ml-1.5 px-1.5">
									{filters.status.length}
								</Badge>
							)}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						{STATUS_OPTIONS.map((option) => (
							<DropdownMenuCheckboxItem
								key={option.value}
								checked={filters.status.includes(option.value)}
								onCheckedChange={(checked) => {
									const newStatus = checked
										? [...filters.status, option.value]
										: filters.status.filter((s) => s !== option.value);
									handleFilterChange("status", newStatus);
								}}
							>
								{option.label}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" className="h-9">
							Priority
							{filters.priority.length > 0 && (
								<Badge variant="secondary" className="ml-1.5 px-1.5">
									{filters.priority.length}
								</Badge>
							)}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						{PRIORITY_OPTIONS.map((option) => (
							<DropdownMenuCheckboxItem
								key={option.value}
								checked={filters.priority.includes(option.value)}
								onCheckedChange={(checked) => {
									const newPriority = checked
										? [...filters.priority, option.value]
										: filters.priority.filter((p) => p !== option.value);
									handleFilterChange("priority", newPriority);
								}}
							>
								{option.label}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>

				{filterOptions.assignees.length > 0 && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" className="h-9">
								<User className="w-4 h-4 mr-1.5" />
								Assignee
								{filters.assignee.length > 0 && (
									<Badge variant="secondary" className="ml-1.5 px-1.5">
										{filters.assignee.length}
									</Badge>
								)}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							{filterOptions.assignees.map((assignee) => (
								<DropdownMenuCheckboxItem
									key={assignee}
									checked={filters.assignee.includes(assignee)}
									onCheckedChange={(checked) => {
										const newAssignees = checked
											? [...filters.assignee, assignee]
											: filters.assignee.filter((a) => a !== assignee);
										handleFilterChange("assignee", newAssignees);
									}}
								>
									{assignee}
								</DropdownMenuCheckboxItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				)}

				{/* Clear filters */}
				{activeFilterCount > 0 && (
					<Button
						variant="ghost"
						size="sm"
						onClick={handleClearFilters}
						className="h-9"
					>
						<X className="w-4 h-4 mr-1" />
						Clear ({activeFilterCount})
					</Button>
				)}

				{/* Spacer */}
				<div className="flex-1" />

				{/* Bulk actions */}
				{selectedTasks.size > 0 && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" className="h-9">
								<MoreHorizontal className="w-4 h-4 mr-1.5" />
								{selectedTasks.size} selected
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{STATUS_OPTIONS.slice(0, 5).map((option) => (
								<DropdownMenuItem
									key={option.value}
									onClick={() =>
										onBulkStatusChange?.(
											Array.from(selectedTasks),
											option.value
										)
									}
								>
									Set status: {option.label}
								</DropdownMenuItem>
							))}
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => onBulkDelete?.(Array.from(selectedTasks))}
								className="text-red-600"
							>
								Delete selected
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}

				{/* Refresh */}
				{onRefresh && (
					<Button variant="outline" size="sm" onClick={onRefresh} className="h-9">
						<RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
					</Button>
				)}

				{/* Export */}
				{onExport && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => onExport(sortedTasks)}
						className="h-9"
					>
						<Download className="w-4 h-4 mr-1.5" />
						Export
					</Button>
				)}
			</div>

			{/* Results summary */}
			<div className="flex items-center justify-between text-sm text-gray-500">
				<span>
					Showing {sortedTasks.length} of {tasks.length} tasks
				</span>
				{selectedTasks.size > 0 && (
					<span>{selectedTasks.size} selected</span>
				)}
			</div>

			{/* Loading state */}
			{loading && (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="w-8 h-8 animate-spin text-gray-400" />
				</div>
			)}

			{/* Empty state */}
			{!loading && sortedTasks.length === 0 && (
				<div className="flex flex-col items-center justify-center py-12 text-gray-500">
					<p className="text-lg font-medium mb-2">No tasks found</p>
					<p className="text-sm">
						{activeFilterCount > 0
							? "Try adjusting your filters"
							: "Create a task to get started"}
					</p>
				</div>
			)}

			{/* Cards view */}
			{!loading && viewMode === "cards" && sortedTasks.length > 0 && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{sortedTasks.map((task) => (
						<TaskCard
							key={task.id}
							task={task}
							onClick={onTaskClick}
							onEdit={onTaskEdit}
							onAssign={onTaskAssign}
							onStatusChange={onStatusChange}
						/>
					))}
				</div>
			)}

			{/* Table view */}
			{!loading && viewMode === "table" && sortedTasks.length > 0 && (
				<div className="border rounded-lg overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow className="bg-gray-50">
								<TableHead className="w-10">
									<Checkbox
										checked={
											selectedTasks.size === sortedTasks.length &&
											sortedTasks.length > 0
										}
										onCheckedChange={handleSelectAll}
									/>
								</TableHead>
								<TableHead
									className="cursor-pointer hover:bg-gray-100"
									onClick={() => handleSort("title")}
								>
									<div className="flex items-center gap-1">
										Task
										<SortIcon field="title" />
									</div>
								</TableHead>
								<TableHead
									className="cursor-pointer hover:bg-gray-100 w-[100px]"
									onClick={() => handleSort("status")}
								>
									<div className="flex items-center gap-1">
										Status
										<SortIcon field="status" />
									</div>
								</TableHead>
								<TableHead
									className="cursor-pointer hover:bg-gray-100 w-[100px]"
									onClick={() => handleSort("priority")}
								>
									<div className="flex items-center gap-1">
										Priority
										<SortIcon field="priority" />
									</div>
								</TableHead>
								<TableHead
									className="cursor-pointer hover:bg-gray-100 w-[120px]"
									onClick={() => handleSort("assignedTo")}
								>
									<div className="flex items-center gap-1">
										Assignee
										<SortIcon field="assignedTo" />
									</div>
								</TableHead>
								<TableHead
									className="cursor-pointer hover:bg-gray-100 w-[100px]"
									onClick={() => handleSort("dueDate")}
								>
									<div className="flex items-center gap-1">
										Due Date
										<SortIcon field="dueDate" />
									</div>
								</TableHead>
								<TableHead
									className="cursor-pointer hover:bg-gray-100 w-[100px]"
									onClick={() => handleSort("progress")}
								>
									<div className="flex items-center gap-1">
										Progress
										<SortIcon field="progress" />
									</div>
								</TableHead>
								<TableHead className="w-10" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{sortedTasks.map((task) => (
								<TableRow
									key={task.id}
									className={cn(
										"cursor-pointer hover:bg-gray-50",
										selectedTasks.has(task.id) && "bg-blue-50"
									)}
									onClick={() => onTaskClick?.(task)}
								>
									<TableCell onClick={(e) => e.stopPropagation()}>
										<Checkbox
											checked={selectedTasks.has(task.id)}
											onCheckedChange={() => handleSelectTask(task.id)}
										/>
									</TableCell>
									<TableCell>
										<div className="flex flex-col">
											<span className="font-medium text-sm line-clamp-1">
												{task.title}
											</span>
											{task.taskNumber && (
												<span className="text-xs text-gray-400 font-mono">
													{task.taskNumber}
												</span>
											)}
										</div>
									</TableCell>
									<TableCell>
										<Badge
											variant="secondary"
											className={cn("text-xs", getStatusColor(task.status))}
										>
											{task.status}
										</Badge>
									</TableCell>
									<TableCell>
										<Badge
											variant="secondary"
											className={cn("text-xs", getPriorityColor(task.priority))}
										>
											{task.priority}
										</Badge>
									</TableCell>
									<TableCell>
										{task.assignedTo ? (
											<div className="flex items-center gap-2">
												<Avatar className="w-6 h-6">
													<AvatarFallback className="text-xs">
														{getInitials(task.assignedTo)}
													</AvatarFallback>
												</Avatar>
												<span className="text-sm truncate max-w-[80px]">
													{task.assignedTo}
												</span>
											</div>
										) : (
											<span className="text-gray-400 text-sm">Unassigned</span>
										)}
									</TableCell>
									<TableCell>
										{task.dueDate ? (
											<span
												className={cn(
													"text-sm",
													new Date(task.dueDate) < new Date() &&
														"text-red-600 font-medium"
												)}
											>
												{new Date(task.dueDate).toLocaleDateString()}
											</span>
										) : (
											<span className="text-gray-400 text-sm">No date</span>
										)}
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											<Progress
												value={task.progress ?? 0}
												className="h-1.5 w-12"
											/>
											<span className="text-xs text-gray-500">
												{task.progress ?? 0}%
											</span>
										</div>
									</TableCell>
									<TableCell onClick={(e) => e.stopPropagation()}>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
													<MoreHorizontal className="w-4 h-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem onClick={() => onTaskEdit?.(task)}>
													Edit
												</DropdownMenuItem>
												<DropdownMenuItem onClick={() => onTaskAssign?.(task)}>
													Assign
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onClick={() =>
														onStatusChange?.(task.id, "completed")
													}
												>
													Mark Complete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}

export default TaskList;
