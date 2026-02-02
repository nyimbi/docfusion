/**
 * Tasks Page
 *
 * Intelligent Task Assignment & Workload Balancer with AI-suggested assignments,
 * critical path tracking, and bottleneck detection.
 */

"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
	CheckSquare,
	Plus,
	Filter,
	Kanban,
	List,
	BarChart2,
	AlertTriangle,
	Users,
	Calendar,
	Clock,
	User,
	X,
	Loader2,
} from "lucide-react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { TaskBoard } from "@/components/task-management/TaskBoard";
import { TaskList } from "@/components/task-management/TaskList";
import { TaskEditor } from "@/components/task-management/TaskEditor";
import { BottleneckAlerts } from "@/components/task-management/BottleneckAlerts";
import { WorkloadDashboard } from "@/components/task-management/WorkloadDashboard";
import { WorkloadHeatMap } from "@/components/task-management/WorkloadHeatMap";
import { CriticalPathView } from "@/components/task-management/CriticalPathView";
import { TaskGenerator } from "@/components/task-management/TaskGenerator";
import {
	listAllTasks,
	listTasks,
	listTeamMembers,
	updateTask,
	createTask,
	deleteTask,
} from "@/lib/actions/task-management";
import type { ProposalTask, AuthorExpertise } from "@/lib/db/schema-tasks";

export default function TasksPage() {
	const [activeTab, setActiveTab] = useState("board");
	const [viewMode, setViewMode] = useState<"board" | "list">("board");
	const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
	const [showTaskGenerator, setShowTaskGenerator] = useState(false);
	const [tasks, setTasks] = useState<ProposalTask[]>([]);
	const [teamMembers, setTeamMembers] = useState<AuthorExpertise[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [selectedTask, setSelectedTask] = useState<ProposalTask | null>(null);

	// Fetch team members
	const fetchTeamMembers = useCallback(async () => {
		try {
			const result = await listTeamMembers();
			if (result.success && result.data) {
				setTeamMembers(result.data);
			}
		} catch (error) {
			console.error("Failed to fetch team members:", error);
		}
	}, []);

	// Fetch tasks
	const fetchTasks = useCallback(async () => {
		setIsLoading(true);
		try {
			let result;
			if (selectedOpportunityId) {
				result = await listTasks(selectedOpportunityId);
			} else {
				result = await listAllTasks({ limit: 100 });
			}
			if (result.success && result.data) {
				setTasks(result.data);
			}
		} catch (error) {
			console.error("Failed to fetch tasks:", error);
		} finally {
			setIsLoading(false);
		}
	}, [selectedOpportunityId]);

	useEffect(() => {
		fetchTasks();
		fetchTeamMembers();
	}, [fetchTasks, fetchTeamMembers]);

	// Update selected task when selectedTaskId changes
	useEffect(() => {
		if (selectedTaskId && selectedTaskId !== "new") {
			const task = tasks.find(t => t.id === selectedTaskId);
			setSelectedTask(task || null);
		} else {
			setSelectedTask(null);
		}
	}, [selectedTaskId, tasks]);

	// Task handlers
	const handleSaveTask = async (taskData: Partial<ProposalTask>) => {
		if (selectedTaskId === "new") {
			const result = await createTask({
				...taskData,
				opportunityId: selectedOpportunityId || "default",
			} as any);
			if (result.success) {
				fetchTasks();
				setSelectedTaskId(null);
			}
		} else if (selectedTaskId) {
			// Extract only the fields that UpdateTaskInput accepts
			const updateData = {
				title: taskData.title,
				description: taskData.description,
				taskType: taskData.taskType,
				taskCategory: taskData.taskCategory,
				assignedTo: taskData.assignedTo,
				assignedToEmail: taskData.assignedToEmail,
				dueDate: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : undefined,
				estimatedHours: taskData.estimatedHours,
				actualHours: taskData.actualHours,
				priority: taskData.priority as "critical" | "high" | "medium" | "low" | undefined,
				status: taskData.status as "pending" | "assigned" | "in_progress" | "review" | "blocked" | "completed" | "cancelled" | undefined,
				progress: taskData.progress,
				wordCountCurrent: taskData.wordCountCurrent,
				pageCurrent: taskData.pageCurrent,
				tags: taskData.tags,
			};
			// Remove undefined values
			const cleanedData = Object.fromEntries(
				Object.entries(updateData).filter(([_, v]) => v !== undefined)
			);
			const result = await updateTask(selectedTaskId, cleanedData);
			if (result.success) {
				fetchTasks();
			}
		}
	};

	const handleDeleteTask = async (taskId: string) => {
		const result = await deleteTask(taskId);
		if (result.success) {
			fetchTasks();
			setSelectedTaskId(null);
		}
	};

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* Header */}
			<div className="flex-shrink-0 border-b bg-background p-6">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h1 className="text-2xl font-semibold flex items-center gap-2">
							<CheckSquare className="h-6 w-6 text-primary" />
							Task Management
						</h1>
						<p className="text-sm text-muted-foreground mt-1">
							AI-powered task assignment with workload balancing
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Select
							value={selectedOpportunityId || "all"}
							onValueChange={(v) => setSelectedOpportunityId(v === "all" ? null : v)}
						>
							<SelectTrigger className="w-[200px]">
								<SelectValue placeholder="Filter by opportunity" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Opportunities</SelectItem>
								<SelectItem value="opp1">DoD Cloud Services</SelectItem>
								<SelectItem value="opp2">VA Health Portal</SelectItem>
							</SelectContent>
						</Select>
						<Button variant="outline" onClick={() => setShowTaskGenerator(true)}>
							<Filter className="h-4 w-4 mr-2" />
							Generate Tasks
						</Button>
						<Button onClick={() => setSelectedTaskId("new")}>
							<Plus className="h-4 w-4 mr-2" />
							New Task
						</Button>
					</div>
				</div>

				{/* Bottleneck Alerts Banner */}
				{tasks.length > 0 && teamMembers.length > 0 && (
					<BottleneckAlerts
						tasks={tasks}
						teamMembers={teamMembers}
						onTaskClick={(task) => setSelectedTaskId(task.id)}
						className="mt-4"
					/>
				)}
			</div>

			{/* Main Content */}
			<div className="flex-1 overflow-hidden">
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="h-full flex flex-col"
				>
					<div className="flex-shrink-0 border-b px-6">
						<div className="flex items-center justify-between">
							<TabsList className="h-12 bg-transparent border-b-0">
								<TabsTrigger
									value="board"
									className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
								>
									<Kanban className="h-4 w-4 mr-2" />
									Tasks
								</TabsTrigger>
								<TabsTrigger
									value="workload"
									className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
								>
									<Users className="h-4 w-4 mr-2" />
									Team Workload
								</TabsTrigger>
								<TabsTrigger
									value="critical-path"
									className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
								>
									<AlertTriangle className="h-4 w-4 mr-2" />
									Critical Path
								</TabsTrigger>
								<TabsTrigger
									value="analytics"
									className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
								>
									<BarChart2 className="h-4 w-4 mr-2" />
									Analytics
								</TabsTrigger>
							</TabsList>

							{activeTab === "board" && (
								<div className="flex items-center gap-1 bg-muted rounded-lg p-1">
									<Button
										variant={viewMode === "board" ? "secondary" : "ghost"}
										size="sm"
										onClick={() => setViewMode("board")}
									>
										<Kanban className="h-4 w-4" />
									</Button>
									<Button
										variant={viewMode === "list" ? "secondary" : "ghost"}
										size="sm"
										onClick={() => setViewMode("list")}
									>
										<List className="h-4 w-4" />
									</Button>
								</div>
							)}
						</div>
					</div>

					<div className="flex-1 overflow-auto">
						<TabsContent value="board" className="h-full m-0">
							{isLoading ? (
								<div className="flex items-center justify-center h-64">
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : viewMode === "board" ? (
								<div className="p-6">
									{tasks.length > 0 ? (
										<TaskBoard
											tasks={tasks}
											onTaskClick={(task) => setSelectedTaskId(task.id)}
											onTaskEdit={(task) => setSelectedTaskId(task.id)}
											onStatusChange={async (taskId, status) => {
												// Optimistically update
												setTasks(prev => prev.map(t =>
													t.id === taskId ? { ...t, status } : t
												));
											}}
										/>
									) : (
										<TaskBoardPlaceholder
											opportunityId={selectedOpportunityId}
											onSelectTask={setSelectedTaskId}
										/>
									)}
								</div>
							) : (
								<div className="p-6">
									{tasks.length > 0 ? (
										<TaskList
											tasks={tasks}
											onTaskClick={(task) => setSelectedTaskId(task.id)}
											onTaskEdit={(task) => setSelectedTaskId(task.id)}
										/>
									) : (
										<TaskListPlaceholder
											opportunityId={selectedOpportunityId}
											onSelectTask={setSelectedTaskId}
										/>
									)}
								</div>
							)}
						</TabsContent>
						<TabsContent value="workload" className="h-full m-0 p-6">
							<div className="grid grid-cols-2 gap-6 h-full">
								<WorkloadDashboard
									tasks={tasks}
									teamMembers={teamMembers}
									loading={isLoading}
									onRefresh={fetchTasks}
								/>
								<WorkloadHeatMap
									tasks={tasks}
									teamMembers={teamMembers}
								/>
							</div>
						</TabsContent>
						<TabsContent value="critical-path" className="h-full m-0 p-6">
							<CriticalPathView
								tasks={tasks}
								criticalPath={[]} // TODO: Calculate from server action
								onTaskClick={(task) => setSelectedTaskId(task.id)}
							/>
						</TabsContent>
						<TabsContent value="analytics" className="h-full m-0 p-6">
							<WorkloadAnalyticsPlaceholder />
						</TabsContent>
					</div>
				</Tabs>
			</div>

			{/* Task Generator Modal */}
			{showTaskGenerator && selectedOpportunityId && (
				<TaskGenerator
					opportunityId={selectedOpportunityId}
					existingTasks={tasks}
					isOpen={showTaskGenerator}
					onClose={() => setShowTaskGenerator(false)}
					onGenerateTasks={async (newTasks) => {
						// Create each generated task
						for (const task of newTasks) {
							await createTask(task as any);
						}
						fetchTasks();
						setShowTaskGenerator(false);
					}}
				/>
			)}
			{showTaskGenerator && !selectedOpportunityId && (
				<TaskGeneratorPlaceholder onClose={() => setShowTaskGenerator(false)} />
			)}

			{/* Task Editor Side Panel */}
			{selectedTaskId && (
				<div className="fixed right-0 top-0 h-full w-[500px] bg-background border-l shadow-xl z-50 overflow-y-auto">
					<TaskEditor
						task={selectedTaskId === "new" ? null : selectedTask}
						isOpen={true}
						onClose={() => setSelectedTaskId(null)}
						onSave={handleSaveTask}
						onDelete={handleDeleteTask}
						availableAssignees={teamMembers.map(m => ({
							id: m.userId,
							name: m.userName,
							email: m.userEmail || undefined,
						}))}
						availableTasks={tasks}
					/>
					{selectedTaskId !== "new" && selectedTask && (
						<div className="p-6 border-t">
							<AssignmentSuggesterPlaceholder taskId={selectedTaskId} />
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// Placeholder Components

function BottleneckAlertsPlaceholder({ compact }: { compact?: boolean }) {
	const alerts = [
		{ severity: "high", message: "Technical volume deadline in 3 days - 5 tasks overdue" },
		{ severity: "medium", message: "Sarah Johnson at 120% capacity this week" },
	];

	if (compact) {
		return alerts.length > 0 ? (
			<div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
				<AlertTriangle className="h-4 w-4 text-yellow-600" />
				<span className="text-sm text-yellow-700 dark:text-yellow-400">
					{alerts.length} bottleneck{alerts.length > 1 ? "s" : ""} detected
				</span>
			</div>
		) : null;
	}

	return (
		<div className="space-y-2">
			{alerts.map((alert, idx) => (
				<div
					key={idx}
					className={`p-3 rounded-lg flex items-center gap-2 ${
						alert.severity === "high"
							? "bg-red-50 dark:bg-red-900/20"
							: "bg-yellow-50 dark:bg-yellow-900/20"
					}`}
				>
					<AlertTriangle
						className={`h-4 w-4 ${
							alert.severity === "high" ? "text-red-600" : "text-yellow-600"
						}`}
					/>
					<span className="text-sm">{alert.message}</span>
				</div>
			))}
		</div>
	);
}

function TaskBoardPlaceholder({
	opportunityId,
	onSelectTask,
}: {
	opportunityId: string | null;
	onSelectTask: (id: string) => void;
}) {
	const columns = [
		{
			name: "To Do",
			tasks: [
				{ id: "1", title: "Draft executive summary", assignee: "SJ", priority: "high", dueDate: "Feb 5" },
				{ id: "2", title: "Gather past performance", assignee: "MC", priority: "medium", dueDate: "Feb 6" },
			],
		},
		{
			name: "In Progress",
			tasks: [
				{ id: "3", title: "Technical approach section", assignee: "DK", priority: "high", dueDate: "Feb 4" },
				{ id: "4", title: "Pricing analysis", assignee: "ER", priority: "medium", dueDate: "Feb 7" },
			],
		},
		{
			name: "Review",
			tasks: [
				{ id: "5", title: "Management approach draft", assignee: "JW", priority: "low", dueDate: "Feb 8" },
			],
		},
		{
			name: "Complete",
			tasks: [
				{ id: "6", title: "Compliance matrix", assignee: "SJ", priority: "high", dueDate: "Feb 2" },
			],
		},
	];

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case "high":
				return "bg-red-100 text-red-700";
			case "medium":
				return "bg-yellow-100 text-yellow-700";
			default:
				return "bg-blue-100 text-blue-700";
		}
	};

	return (
		<div className="flex gap-4 overflow-x-auto pb-4">
			{columns.map((column) => (
				<div key={column.name} className="flex-shrink-0 w-72 rounded-lg border bg-card">
					<div className="p-3 border-b">
						<div className="flex items-center justify-between">
							<h3 className="font-semibold text-sm">{column.name}</h3>
							<Badge variant="secondary" className="text-xs">
								{column.tasks.length}
							</Badge>
						</div>
					</div>
					<div className="p-2 space-y-2">
						{column.tasks.map((task) => (
							<Card
								key={task.id}
								className="cursor-pointer hover:shadow-md transition-shadow"
								onClick={() => onSelectTask(task.id)}
							>
								<CardContent className="p-3">
									<h4 className="font-medium text-sm mb-2">{task.title}</h4>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<Avatar className="h-6 w-6">
												<AvatarFallback className="text-xs">{task.assignee}</AvatarFallback>
											</Avatar>
											<Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
												{task.priority}
											</Badge>
										</div>
										<span className="text-xs text-muted-foreground flex items-center gap-1">
											<Calendar className="h-3 w-3" />
											{task.dueDate}
										</span>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

function TaskListPlaceholder({
	opportunityId,
	onSelectTask,
}: {
	opportunityId: string | null;
	onSelectTask: (id: string) => void;
}) {
	const tasks = [
		{ id: "1", title: "Draft executive summary", assignee: "Sarah Johnson", status: "To Do", priority: "high", dueDate: "Feb 5" },
		{ id: "2", title: "Technical approach section", assignee: "David Kim", status: "In Progress", priority: "high", dueDate: "Feb 4" },
		{ id: "3", title: "Pricing analysis", assignee: "Emily Rodriguez", status: "In Progress", priority: "medium", dueDate: "Feb 7" },
		{ id: "4", title: "Compliance matrix", assignee: "Sarah Johnson", status: "Complete", priority: "high", dueDate: "Feb 2" },
	];

	return (
		<div className="space-y-2">
			{tasks.map((task) => (
				<Card
					key={task.id}
					className="cursor-pointer hover:shadow-md transition-shadow"
					onClick={() => onSelectTask(task.id)}
				>
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-4">
								<CheckSquare className="h-4 w-4 text-muted-foreground" />
								<div>
									<h4 className="font-medium">{task.title}</h4>
									<p className="text-sm text-muted-foreground">{task.assignee}</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<Badge variant="outline">{task.status}</Badge>
								<span className="text-sm text-muted-foreground">{task.dueDate}</span>
							</div>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

function WorkloadDashboardPlaceholder() {
	const team = [
		{ name: "Sarah Johnson", capacity: 85, tasks: 8 },
		{ name: "Michael Chen", capacity: 120, tasks: 12 },
		{ name: "Emily Rodriguez", capacity: 65, tasks: 5 },
		{ name: "David Kim", capacity: 95, tasks: 9 },
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Team Workload</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{team.map((member) => (
						<div key={member.name} className="space-y-1">
							<div className="flex items-center justify-between text-sm">
								<span className="font-medium">{member.name}</span>
								<span
									className={
										member.capacity > 100
											? "text-red-600"
											: member.capacity > 80
											? "text-yellow-600"
											: "text-green-600"
									}
								>
									{member.capacity}% ({member.tasks} tasks)
								</span>
							</div>
							<div className="h-2 bg-muted rounded-full overflow-hidden">
								<div
									className={`h-full ${
										member.capacity > 100
											? "bg-red-500"
											: member.capacity > 80
											? "bg-yellow-500"
											: "bg-green-500"
									}`}
									style={{ width: `${Math.min(member.capacity, 100)}%` }}
								/>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function WorkloadHeatMapPlaceholder() {
	const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
	const team = ["SJ", "MC", "ER", "DK"];
	const data = [
		[3, 4, 5, 2, 1],
		[5, 5, 4, 4, 3],
		[2, 3, 2, 2, 1],
		[4, 3, 4, 3, 2],
	];

	const getHeatColor = (value: number) => {
		if (value >= 5) return "bg-red-500";
		if (value >= 4) return "bg-orange-400";
		if (value >= 3) return "bg-yellow-400";
		if (value >= 2) return "bg-green-300";
		return "bg-green-200";
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Workload Heat Map</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr>
								<th className="p-2"></th>
								{days.map((day) => (
									<th key={day} className="p-2 text-center text-muted-foreground">
										{day}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{team.map((member, i) => (
								<tr key={member}>
									<td className="p-2 font-medium">{member}</td>
									{data[i].map((value, j) => (
										<td key={j} className="p-1 text-center">
											<div
												className={`w-8 h-8 rounded flex items-center justify-center text-white text-xs mx-auto ${getHeatColor(
													value
												)}`}
											>
												{value}
											</div>
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>
	);
}

function CriticalPathViewPlaceholder({ opportunityId }: { opportunityId: string | null }) {
	const milestones = [
		{ name: "Technical Volume", date: "Feb 10", status: "at_risk", tasks: 5, completed: 2 },
		{ name: "Pricing Volume", date: "Feb 15", status: "on_track", tasks: 4, completed: 1 },
		{ name: "Past Performance", date: "Feb 12", status: "on_track", tasks: 3, completed: 3 },
		{ name: "Final Review", date: "Feb 18", status: "pending", tasks: 2, completed: 0 },
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base flex items-center gap-2">
					<AlertTriangle className="h-4 w-4" />
					Critical Path Analysis
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{milestones.map((milestone, idx) => (
						<div key={milestone.name} className="flex items-center gap-4">
							<div className="flex flex-col items-center">
								<div
									className={`w-4 h-4 rounded-full ${
										milestone.status === "at_risk"
											? "bg-red-500"
											: milestone.status === "on_track"
											? "bg-green-500"
											: "bg-gray-300"
									}`}
								/>
								{idx < milestones.length - 1 && <div className="w-px h-8 bg-border" />}
							</div>
							<div className="flex-1">
								<div className="flex items-center justify-between">
									<h4 className="font-medium">{milestone.name}</h4>
									<Badge
										variant={
											milestone.status === "at_risk"
												? "destructive"
												: milestone.status === "on_track"
												? "default"
												: "outline"
										}
									>
										{milestone.status.replace("_", " ")}
									</Badge>
								</div>
								<p className="text-sm text-muted-foreground">
									Due: {milestone.date} - {milestone.completed}/{milestone.tasks} tasks complete
								</p>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function WorkloadAnalyticsPlaceholder() {
	return (
		<div className="grid gap-6 md:grid-cols-2">
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Task Completion Trends</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{[
							{ week: "Week 1", completed: 15, planned: 18 },
							{ week: "Week 2", completed: 22, planned: 20 },
							{ week: "Week 3", completed: 18, planned: 22 },
							{ week: "Week 4", completed: 12, planned: 15 },
						].map((item) => (
							<div key={item.week} className="flex items-center justify-between">
								<span className="text-sm font-medium">{item.week}</span>
								<span className="text-sm text-muted-foreground">
									{item.completed}/{item.planned} tasks
								</span>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Velocity Metrics</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-4">
						<div className="text-center p-4 bg-muted/50 rounded-lg">
							<div className="text-2xl font-bold">4.2</div>
							<div className="text-xs text-muted-foreground">Tasks/Day</div>
						</div>
						<div className="text-center p-4 bg-muted/50 rounded-lg">
							<div className="text-2xl font-bold">92%</div>
							<div className="text-xs text-muted-foreground">On-Time Rate</div>
						</div>
						<div className="text-center p-4 bg-muted/50 rounded-lg">
							<div className="text-2xl font-bold">2.1d</div>
							<div className="text-xs text-muted-foreground">Avg Cycle Time</div>
						</div>
						<div className="text-center p-4 bg-muted/50 rounded-lg">
							<div className="text-2xl font-bold">85%</div>
							<div className="text-xs text-muted-foreground">Utilization</div>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function TaskGeneratorPlaceholder({ onClose }: { onClose: () => void }) {
	return (
		<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
			<div className="bg-background rounded-lg p-6 max-w-lg w-full mx-4">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold">Generate Tasks from RFP</h2>
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<div className="space-y-4">
					<div>
						<label className="text-sm font-medium">Select Opportunity</label>
						<Input placeholder="Choose an opportunity" className="mt-1" />
					</div>
					<div>
						<label className="text-sm font-medium">Task Template</label>
						<Select>
							<SelectTrigger className="mt-1">
								<SelectValue placeholder="Select template" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="standard">Standard Proposal</SelectItem>
								<SelectItem value="idiq">IDIQ Response</SelectItem>
								<SelectItem value="task_order">Task Order</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
				<div className="flex justify-end gap-2 mt-6">
					<Button variant="outline" onClick={onClose}>Cancel</Button>
					<Button>Generate Tasks</Button>
				</div>
			</div>
		</div>
	);
}

function TaskEditorPlaceholder({
	taskId,
	onClose,
}: {
	taskId?: string;
	onClose: () => void;
}) {
	return (
		<div className="p-6">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-lg font-semibold">
					{taskId ? "Edit Task" : "New Task"}
				</h2>
				<Button variant="ghost" size="sm" onClick={onClose}>
					<X className="h-4 w-4" />
				</Button>
			</div>
			<div className="space-y-4">
				<div>
					<label className="text-sm font-medium">Title</label>
					<Input placeholder="Enter task title" className="mt-1" />
				</div>
				<div>
					<label className="text-sm font-medium">Description</label>
					<textarea
						className="w-full mt-1 p-2 border rounded-md text-sm"
						rows={3}
						placeholder="Enter task description..."
					/>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="text-sm font-medium">Assignee</label>
						<Input placeholder="Select assignee" className="mt-1" />
					</div>
					<div>
						<label className="text-sm font-medium">Due Date</label>
						<Input type="date" className="mt-1" />
					</div>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="text-sm font-medium">Priority</label>
						<Select>
							<SelectTrigger className="mt-1">
								<SelectValue placeholder="Select priority" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="high">High</SelectItem>
								<SelectItem value="medium">Medium</SelectItem>
								<SelectItem value="low">Low</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div>
						<label className="text-sm font-medium">Status</label>
						<Select>
							<SelectTrigger className="mt-1">
								<SelectValue placeholder="Select status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="todo">To Do</SelectItem>
								<SelectItem value="in_progress">In Progress</SelectItem>
								<SelectItem value="review">Review</SelectItem>
								<SelectItem value="complete">Complete</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>
			<div className="flex justify-end gap-2 mt-6">
				<Button variant="outline" onClick={onClose}>Cancel</Button>
				<Button>Save Task</Button>
			</div>
		</div>
	);
}

function AssignmentSuggesterPlaceholder({ taskId }: { taskId: string }) {
	const suggestions = [
		{ name: "Sarah Johnson", score: 95, reason: "Past experience, available capacity" },
		{ name: "Michael Chen", score: 82, reason: "Technical skills match" },
		{ name: "Emily Rodriguez", score: 78, reason: "Similar tasks completed" },
	];

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<Users className="h-4 w-4" />
					AI Assignment Suggestions
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{suggestions.map((suggestion) => (
						<div
							key={suggestion.name}
							className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
						>
							<div>
								<p className="text-sm font-medium">{suggestion.name}</p>
								<p className="text-xs text-muted-foreground">{suggestion.reason}</p>
							</div>
							<Badge variant="secondary">{suggestion.score}% match</Badge>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
