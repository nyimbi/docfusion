"use client";

/**
 * Task List Component
 *
 * Displays and manages tasks from activities with task type.
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	CheckSquare,
	Circle,
	Clock,
	Calendar,
	AlertCircle,
	MoreHorizontal,
	Plus,
	Search,
	Filter,
	User,
	Building2,
} from "lucide-react";
import type { ActivityRow } from "@/lib/db/schema-crm";

interface TaskListProps {
	/** Activities to display as tasks (alias: activities) */
	tasks?: ActivityRow[];
	/** Alternative prop name for tasks */
	activities?: ActivityRow[];
	onTaskComplete?: (taskId: string) => void;
	onTaskClick?: (task: ActivityRow) => void;
	onCreateTask?: () => void;
	showFilters?: boolean;
	className?: string;
}

export function TaskList({
	tasks: tasksProp,
	activities,
	onTaskComplete,
	onTaskClick,
	onCreateTask,
	showFilters = true,
	className,
}: TaskListProps) {
	// Support both tasks and activities props
	const tasks = useMemo(() => tasksProp ?? activities ?? [], [tasksProp, activities]);
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [priorityFilter, setPriorityFilter] = useState<string>("all");
	const [sortBy, setSortBy] = useState<string>("dueDate");

	// Filter and sort tasks
	const filteredTasks = useMemo(() => {
		let result = [...tasks];

		// Search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(t) =>
					t.subject?.toLowerCase().includes(query) ||
					t.description?.toLowerCase().includes(query)
			);
		}

		// Status filter
		if (statusFilter !== "all") {
			result = result.filter((t) => t.status === statusFilter);
		}

		// Priority filter
		if (priorityFilter !== "all") {
			result = result.filter((t) => t.priority === priorityFilter);
		}

		// Sort
		result.sort((a, b) => {
			if (sortBy === "dueDate") {
				const aDate = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
				const bDate = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
				return aDate - bDate;
			}
			if (sortBy === "priority") {
				const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
				return (
					(priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) -
					(priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2)
				);
			}
			if (sortBy === "created") {
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			}
			return 0;
		});

		return result;
	}, [tasks, searchQuery, statusFilter, priorityFilter, sortBy]);

	// Separate tasks by status
	const { overdue, today, upcoming, completed } = useMemo(() => {
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const todayEnd = new Date(now);
		todayEnd.setHours(23, 59, 59, 999);

		return {
			overdue: filteredTasks.filter(
				(t) =>
					t.status !== "completed" &&
					t.scheduledAt &&
					new Date(t.scheduledAt) < now
			),
			today: filteredTasks.filter(
				(t) =>
					t.status !== "completed" &&
					t.scheduledAt &&
					new Date(t.scheduledAt) >= now &&
					new Date(t.scheduledAt) <= todayEnd
			),
			upcoming: filteredTasks.filter(
				(t) =>
					t.status !== "completed" &&
					t.scheduledAt &&
					new Date(t.scheduledAt) > todayEnd
			),
			completed: filteredTasks.filter((t) => t.status === "completed"),
		};
	}, [filteredTasks]);

	// Format date
	const formatDueDate = (date: Date | string | null) => {
		if (!date) return "";
		const d = new Date(date);
		const now = new Date();
		now.setHours(0, 0, 0, 0);

		const diffDays = Math.floor(
			(d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
		);

		if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
		if (diffDays === 0) return "Today";
		if (diffDays === 1) return "Tomorrow";
		if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
		return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
	};

	// Get priority badge
	const getPriorityBadge = (priority: string | null) => {
		switch (priority) {
			case "urgent":
				return (
					<Badge className="bg-red-100 text-red-700">
						<AlertCircle className="h-3 w-3 mr-1" />
						Urgent
					</Badge>
				);
			case "high":
				return <Badge className="bg-orange-100 text-orange-700">High</Badge>;
			case "normal":
				return null;
			case "low":
				return <Badge className="bg-gray-100 text-gray-600">Low</Badge>;
			default:
				return null;
		}
	};

	// Task item component
	const TaskItem = ({ task }: { task: ActivityRow }) => {
		const isOverdue =
			task.status !== "completed" &&
			task.scheduledAt &&
			new Date(task.scheduledAt) < new Date();

		return (
			<div
				className={cn(
					"group flex items-start gap-3 p-3 rounded-md hover:bg-muted/50 transition-colors",
					task.status === "completed" && "opacity-60"
				)}
			>
				<Checkbox
					checked={task.status === "completed"}
					onCheckedChange={() => onTaskComplete?.(task.id)}
					className="mt-1"
				/>

				<div
					className="flex-1 min-w-0 cursor-pointer"
					onClick={() => onTaskClick?.(task)}

		role="button"
		tabIndex={0}
		onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
					<div className="flex items-center gap-2">
						<span
							className={cn(
								"font-medium truncate",
								task.status === "completed" && "line-through"
							)}
						>
							{task.subject}
						</span>
						{getPriorityBadge(task.priority)}
					</div>

					{task.description && (
						<p className="text-sm text-muted-foreground mt-1 line-clamp-1">
							{task.description}
						</p>
					)}

					<div className="flex items-center gap-4 mt-2">
						{task.scheduledAt && (
							<span
								className={cn(
									"flex items-center gap-1 text-xs",
									isOverdue ? "text-red-600" : "text-muted-foreground"
								)}
							>
								<Calendar className="h-3 w-3" />
								{formatDueDate(task.scheduledAt)}
							</span>
						)}
						{task.accountId && (
							<span className="flex items-center gap-1 text-xs text-muted-foreground">
								<Building2 className="h-3 w-3" />
								Account
							</span>
						)}
						{task.contactId && (
							<span className="flex items-center gap-1 text-xs text-muted-foreground">
								<User className="h-3 w-3" />
								Contact
							</span>
						)}
					</div>
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
						>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => onTaskClick?.(task)}>
							View Details
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => onTaskComplete?.(task.id)}>
							{task.status === "completed" ? "Mark Incomplete" : "Mark Complete"}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		);
	};

	// Task section component
	const TaskSection = ({
		title,
		tasks,
		icon: Icon,
		className: sectionClassName,
	}: {
		title: string;
		tasks: ActivityRow[];
		icon: React.ElementType;
		className?: string;
	}) => {
		if (tasks.length === 0) return null;

		return (
			<div className={sectionClassName}>
				<h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
					<Icon className="h-4 w-4" />
					{title} ({tasks.length})
				</h3>
				<div className="space-y-1">
					{tasks.map((task) => (
						<TaskItem key={task.id} task={task} />
					))}
				</div>
			</div>
		);
	};

	return (
		<Card className={className}>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<CheckSquare className="h-5 w-5" />
						Tasks
					</CardTitle>
					<Button size="sm" onClick={onCreateTask}>
						<Plus className="h-4 w-4 mr-1" />
						New Task
					</Button>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Filters */}
				{showFilters && (
					<div className="flex items-center gap-2">
						<div className="relative flex-1 max-w-xs">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search tasks..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9 h-8"
							/>
						</div>

						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger className="w-[130px] h-8">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="scheduled">Open</SelectItem>
								<SelectItem value="completed">Completed</SelectItem>
							</SelectContent>
						</Select>

						<Select value={priorityFilter} onValueChange={setPriorityFilter}>
							<SelectTrigger className="w-[130px] h-8">
								<SelectValue placeholder="Priority" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Priority</SelectItem>
								<SelectItem value="urgent">Urgent</SelectItem>
								<SelectItem value="high">High</SelectItem>
								<SelectItem value="normal">Normal</SelectItem>
								<SelectItem value="low">Low</SelectItem>
							</SelectContent>
						</Select>

						<Select value={sortBy} onValueChange={setSortBy}>
							<SelectTrigger className="w-[130px] h-8">
								<SelectValue placeholder="Sort by" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="dueDate">Due Date</SelectItem>
								<SelectItem value="priority">Priority</SelectItem>
								<SelectItem value="created">Created</SelectItem>
							</SelectContent>
						</Select>
					</div>
				)}

				{/* Task Lists */}
				<div className="space-y-6">
					<TaskSection
						title="Overdue"
						tasks={overdue}
						icon={AlertCircle}
						className="text-red-600"
					/>
					<TaskSection
						title="Today"
						tasks={today}
						icon={Clock}
					/>
					<TaskSection
						title="Upcoming"
						tasks={upcoming}
						icon={Calendar}
					/>
					<TaskSection
						title="Completed"
						tasks={completed}
						icon={CheckSquare}
					/>
				</div>

				{filteredTasks.length === 0 && (
					<div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
						<CheckSquare className="h-12 w-12 mb-4" />
						<p>No tasks found</p>
						<Button
							variant="outline"
							size="sm"
							className="mt-4"
							onClick={onCreateTask}
						>
							Create First Task
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default TaskList;
