/**
 * Tasks Page
 *
 * Intelligent Task Assignment & Workload Balancer with AI-suggested assignments,
 * critical path tracking, and bottleneck detection.
 */

"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	CheckSquare,
	Plus,
	Filter,
	Kanban,
	List,
	BarChart2,
	AlertTriangle,
	Users,
	Loader2,
	TrendingUp,
	Clock,
	Target,
	AlertCircle,
	FileText,
	Inbox,
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
import { OperationalInbox } from "@/components/tasks/OperationalInbox";
import {
	listAllTasks,
	listTasks,
	listTeamMembers,
	updateTask,
	createTask,
	deleteTask,
	calculateCriticalPath,
	suggestAssignment,
	generateProgressReport,
} from "@/lib/actions/task-management";
import { getOpportunities } from "@/lib/actions/opportunities";
import { getOperationalInboxProjection, type OperationalInboxProjection } from "@/lib/actions/work-items";
import type { ProposalTask, AuthorExpertise } from "@/lib/db/schema-tasks";
import type { OpportunityListItem } from "@/lib/types/opportunity";

// Type for assignment suggestions
interface AssignmentSuggestion {
	userId: string;
	userName: string;
	userEmail?: string;
	matchScore: number;
	reasons: string[];
	workloadStatus: "available" | "moderate" | "high" | "overloaded";
	estimatedCompletionDate?: string;
	expertiseMatch: number;
	availabilityMatch: number;
	performanceScore: number;
}

// Type for progress report (matches server action return type)
interface ProgressReport {
	opportunityId: string;
	opportunityName: string;
	reportDate: string;
	overallProgress: number;
	taskSummary: {
		total: number;
		completed: number;
		inProgress: number;
		pending: number;
		blocked: number;
		overdue: number;
	};
	volumeProgress: Array<{
		volumeId: string;
		volumeName: string;
		progress: number;
		tasksCompleted: number;
		tasksTotal: number;
	}>;
	teamPerformance: Array<{
		userId: string;
		userName: string;
		tasksCompleted: number;
		tasksAssigned: number;
		onTimeRate: number;
	}>;
	timeline: Array<{
		date: string;
		tasksCompleted: number;
		progress: number;
	}>;
	risks: string[];
	recommendations: string[];
}

export default function TasksPage() {
	const searchParams = useSearchParams();
	const initialOpportunityId = searchParams.get("opportunityId");
	const [activeTab, setActiveTab] = useState("inbox");
	const [viewMode, setViewMode] = useState<"board" | "list">("board");
	const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(initialOpportunityId);
	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
	const [showTaskGenerator, setShowTaskGenerator] = useState(false);
	const [tasks, setTasks] = useState<ProposalTask[]>([]);
	const [teamMembers, setTeamMembers] = useState<AuthorExpertise[]>([]);
	const [opportunities, setOpportunities] = useState<OpportunityListItem[]>([]);
	const [criticalPath, setCriticalPath] = useState<string[]>([]);
	const [progressReport, setProgressReport] = useState<ProgressReport | null>(null);
	const [operationalInbox, setOperationalInbox] = useState<OperationalInboxProjection | null>(null);
	const [assignmentSuggestions, setAssignmentSuggestions] = useState<AssignmentSuggestion[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isLoadingCriticalPath, setIsLoadingCriticalPath] = useState(false);
	const [isLoadingReport, setIsLoadingReport] = useState(false);
	const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
	const [isLoadingInbox, setIsLoadingInbox] = useState(false);
	const [selectedTask, setSelectedTask] = useState<ProposalTask | null>(null);

	useEffect(() => {
		setSelectedOpportunityId(initialOpportunityId);
	}, [initialOpportunityId]);

	// Fetch opportunities
	const fetchOpportunities = useCallback(async () => {
		try {
			const result = await getOpportunities(undefined, undefined, { page: 1, pageSize: 100 });
			if (result.data) {
				setOpportunities(result.data);
			}
		} catch (error) {
			console.error("Failed to fetch opportunities:", error);
		}
	}, []);

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

	// Fetch critical path when opportunity changes
	const fetchCriticalPath = useCallback(async () => {
		if (!selectedOpportunityId) {
			setCriticalPath([]);
			return;
		}
		setIsLoadingCriticalPath(true);
		try {
			const result = await calculateCriticalPath(selectedOpportunityId);
			if (result.success && result.data) {
				setCriticalPath(result.data.criticalTasks);
			}
		} catch (error) {
			console.error("Failed to calculate critical path:", error);
		} finally {
			setIsLoadingCriticalPath(false);
		}
	}, [selectedOpportunityId]);

	const fetchOperationalInbox = useCallback(async () => {
		setIsLoadingInbox(true);
		try {
			const result = await getOperationalInboxProjection({
				opportunityId: selectedOpportunityId,
				limit: 120,
			});
			setOperationalInbox(result);
		} catch (error) {
			console.error("Failed to fetch operational inbox:", error);
			setOperationalInbox(null);
		} finally {
			setIsLoadingInbox(false);
		}
	}, [selectedOpportunityId]);

	// Fetch progress report when on analytics tab
	const fetchProgressReport = useCallback(async () => {
		if (!selectedOpportunityId) {
			setProgressReport(null);
			return;
		}
		setIsLoadingReport(true);
		try {
			const result = await generateProgressReport(selectedOpportunityId);
			if (result.success && result.data) {
				setProgressReport(result.data as ProgressReport);
			}
		} catch (error) {
			console.error("Failed to generate progress report:", error);
		} finally {
			setIsLoadingReport(false);
		}
	}, [selectedOpportunityId]);

	// Fetch assignment suggestions when task selected
	const fetchAssignmentSuggestions = useCallback(async (taskId: string) => {
		setIsLoadingSuggestions(true);
		try {
			const result = await suggestAssignment(taskId);
			if (result.success && result.data) {
				setAssignmentSuggestions(result.data);
			} else {
				setAssignmentSuggestions([]);
			}
		} catch (error) {
			console.error("Failed to fetch assignment suggestions:", error);
			setAssignmentSuggestions([]);
		} finally {
			setIsLoadingSuggestions(false);
		}
	}, []);

	useEffect(() => {
		fetchOpportunities();
		fetchTeamMembers();
	}, [fetchOpportunities, fetchTeamMembers]);

	useEffect(() => {
		fetchTasks();
		fetchCriticalPath();
		fetchOperationalInbox();
	}, [fetchTasks, fetchCriticalPath, fetchOperationalInbox]);

	useEffect(() => {
		if (activeTab === "analytics" && selectedOpportunityId) {
			fetchProgressReport();
		}
	}, [activeTab, selectedOpportunityId, fetchProgressReport]);

	// Update selected task when selectedTaskId changes
	useEffect(() => {
		if (selectedTaskId && selectedTaskId !== "new") {
			const task = tasks.find(t => t.id === selectedTaskId);
			setSelectedTask(task || null);
			// Fetch AI suggestions for this task
			fetchAssignmentSuggestions(selectedTaskId);
		} else {
			setSelectedTask(null);
			setAssignmentSuggestions([]);
		}
	}, [selectedTaskId, tasks, fetchAssignmentSuggestions]);

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
							<SelectTrigger className="w-[250px]">
								<SelectValue placeholder="Filter by opportunity" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Opportunities</SelectItem>
								{opportunities.map((opp) => (
									<SelectItem key={opp.id} value={opp.id}>
										{opp.title}
									</SelectItem>
								))}
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
									value="inbox"
									className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
								>
									<Inbox className="h-4 w-4 mr-2" />
									Inbox
								</TabsTrigger>
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
						<TabsContent value="inbox" className="h-full m-0 p-6">
							{isLoadingInbox ? (
								<div className="flex items-center justify-center h-64">
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : (
								<OperationalInbox
									initialProjection={operationalInbox}
									onRefresh={fetchOperationalInbox}
								/>
							)}
						</TabsContent>
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
										<EmptyTasksState onCreateTask={() => setSelectedTaskId("new")} />
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
										<EmptyTasksState onCreateTask={() => setSelectedTaskId("new")} />
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
							{isLoadingCriticalPath ? (
								<div className="flex items-center justify-center h-64">
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : !selectedOpportunityId ? (
								<div className="flex flex-col items-center justify-center h-64 text-center">
									<AlertTriangle className="h-12 w-12 text-muted-foreground/30 mb-4" />
									<h3 className="text-lg font-medium mb-2">Select an Opportunity</h3>
									<p className="text-sm text-muted-foreground max-w-md">
										Select an opportunity from the dropdown above to view critical path analysis.
									</p>
								</div>
							) : (
								<CriticalPathView
									tasks={tasks}
									criticalPath={criticalPath}
									onTaskClick={(task) => setSelectedTaskId(task.id)}
								/>
							)}
						</TabsContent>
						<TabsContent value="analytics" className="h-full m-0 p-6">
							{!selectedOpportunityId ? (
								<div className="flex flex-col items-center justify-center h-64 text-center">
									<BarChart2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
									<h3 className="text-lg font-medium mb-2">Select an Opportunity</h3>
									<p className="text-sm text-muted-foreground max-w-md">
										Select an opportunity from the dropdown above to view analytics.
									</p>
								</div>
							) : isLoadingReport ? (
								<div className="flex items-center justify-center h-64">
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : progressReport ? (
								<ProgressReportDashboard report={progressReport} />
							) : (
								<div className="flex flex-col items-center justify-center h-64 text-center">
									<FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
									<h3 className="text-lg font-medium mb-2">No Analytics Data</h3>
									<p className="text-sm text-muted-foreground max-w-md">
										Add some tasks to this opportunity to see analytics.
									</p>
								</div>
							)}
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
				<SelectOpportunityModal
					opportunities={opportunities}
					onSelect={(id) => {
						setSelectedOpportunityId(id);
					}}
					onClose={() => setShowTaskGenerator(false)}
				/>
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
							<AIAssignmentSuggestions
								suggestions={assignmentSuggestions}
								loading={isLoadingSuggestions}
								onAssign={async (userId, userName, email) => {
									await updateTask(selectedTaskId, {
										assignedTo: userName,
										assignedToEmail: email,
									});
									fetchTasks();
								}}
							/>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// Empty state component
function EmptyTasksState({ onCreateTask }: { onCreateTask: () => void }) {
	return (
		<div className="flex flex-col items-center justify-center h-64 text-center">
			<CheckSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
			<h3 className="text-lg font-medium mb-2">No Tasks Yet</h3>
			<p className="text-sm text-muted-foreground max-w-md mb-4">
				Create your first task or generate tasks from an RFP to get started.
			</p>
			<Button onClick={onCreateTask}>
				<Plus className="h-4 w-4 mr-2" />
				Create Task
			</Button>
		</div>
	);
}

// Select opportunity modal for task generation
function SelectOpportunityModal({
	opportunities,
	onSelect,
	onClose,
}: {
	opportunities: OpportunityListItem[];
	onSelect: (id: string) => void;
	onClose: () => void;
}) {
	const [selected, setSelected] = useState<string>("");

	return (
		<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
			<Card className="max-w-lg w-full mx-4">
				<CardHeader>
					<CardTitle>Select Opportunity</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm text-muted-foreground">
						Select an opportunity to generate tasks from its RFP requirements.
					</p>
					<Select value={selected} onValueChange={setSelected}>
						<SelectTrigger>
							<SelectValue placeholder="Choose an opportunity" />
						</SelectTrigger>
						<SelectContent>
							{opportunities.map((opp) => (
								<SelectItem key={opp.id} value={opp.id}>
									{opp.title}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={onClose}>Cancel</Button>
						<Button
							disabled={!selected}
							onClick={() => {
								onSelect(selected);
							}}
						>
							Continue
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

// AI Assignment Suggestions component
function AIAssignmentSuggestions({
	suggestions,
	loading,
	onAssign,
}: {
	suggestions: AssignmentSuggestion[];
	loading: boolean;
	onAssign: (userId: string, userName: string, email?: string) => void;
}) {
	const getWorkloadColor = (status: string) => {
		switch (status) {
			case "available": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
			case "moderate": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
			case "high": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
			case "overloaded": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
			default: return "bg-gray-100 text-gray-700";
		}
	};

	if (loading) {
		return (
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-medium flex items-center gap-2">
						<Users className="h-4 w-4" />
						AI Assignment Suggestions
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center py-4">
						<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
					</div>
				</CardContent>
			</Card>
		);
	}

	if (suggestions.length === 0) {
		return (
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-medium flex items-center gap-2">
						<Users className="h-4 w-4" />
						AI Assignment Suggestions
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground text-center py-4">
						No team members available for assignment suggestions.
					</p>
				</CardContent>
			</Card>
		);
	}

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
					{suggestions.slice(0, 3).map((suggestion) => (
						<div
							key={suggestion.userId}
							className="flex items-center justify-between p-2 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
							onClick={() => onAssign(suggestion.userId, suggestion.userName, suggestion.userEmail)}

			role="button"
			tabIndex={0}
			onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
							<div className="flex-1">
								<div className="flex items-center gap-2">
									<p className="text-sm font-medium">{suggestion.userName}</p>
									<Badge className={`text-xs ${getWorkloadColor(suggestion.workloadStatus)}`}>
										{suggestion.workloadStatus}
									</Badge>
								</div>
								<p className="text-xs text-muted-foreground mt-0.5">
									{suggestion.reasons.slice(0, 2).join(", ")}
								</p>
							</div>
							<Badge variant="secondary">{Math.round(suggestion.matchScore)}% match</Badge>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// Progress Report Dashboard
function ProgressReportDashboard({ report }: { report: ProgressReport }) {
	const { taskSummary, volumeProgress, teamPerformance, risks, recommendations } = report;
	const isOnTrack = report.overallProgress >= 50 && taskSummary.overdue === 0;

	return (
		<div className="grid gap-6 md:grid-cols-2">
			{/* Overall Progress */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<Target className="h-4 w-4" />
						Overall Progress
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div>
							<div className="flex items-center justify-between mb-2">
								<span className="text-2xl font-bold">{Math.round(report.overallProgress)}%</span>
								<Badge variant={isOnTrack ? "default" : "destructive"}>
									{isOnTrack ? "On Track" : "At Risk"}
								</Badge>
							</div>
							<Progress value={report.overallProgress} className="h-2" />
						</div>
						<div className="grid grid-cols-3 gap-2 text-center">
							<div className="p-2 bg-muted/50 rounded">
								<div className="text-lg font-semibold text-green-600">{taskSummary.completed}</div>
								<div className="text-xs text-muted-foreground">Completed</div>
							</div>
							<div className="p-2 bg-muted/50 rounded">
								<div className="text-lg font-semibold text-blue-600">{taskSummary.inProgress}</div>
								<div className="text-xs text-muted-foreground">In Progress</div>
							</div>
							<div className="p-2 bg-muted/50 rounded">
								<div className="text-lg font-semibold text-yellow-600">{taskSummary.pending}</div>
								<div className="text-xs text-muted-foreground">Pending</div>
							</div>
						</div>
						{taskSummary.overdue > 0 && (
							<div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm">
								<AlertCircle className="h-4 w-4 text-red-600" />
								<span className="text-red-700 dark:text-red-400">
									{taskSummary.overdue} overdue task{taskSummary.overdue > 1 ? "s" : ""}
								</span>
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Volume Progress */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<TrendingUp className="h-4 w-4" />
						Volume Progress
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{volumeProgress.length > 0 ? volumeProgress.map((volume) => (
							<div key={volume.volumeId} className="space-y-1">
								<div className="flex items-center justify-between text-sm">
									<span className="font-medium">{volume.volumeName}</span>
									<span className="text-muted-foreground">
										{volume.tasksCompleted}/{volume.tasksTotal} tasks
									</span>
								</div>
								<Progress value={volume.progress} className="h-1.5" />
							</div>
						)) : (
							<p className="text-sm text-muted-foreground text-center py-4">
								No volume data available
							</p>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Team Performance */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<Users className="h-4 w-4" />
						Team Performance
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{teamPerformance.length > 0 ? teamPerformance.slice(0, 5).map((member) => (
							<div key={member.userId} className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium">{member.userName}</p>
									<p className="text-xs text-muted-foreground">
										{member.tasksCompleted}/{member.tasksAssigned} assigned
									</p>
								</div>
								<Badge
									variant={member.onTimeRate >= 90 ? "default" : member.onTimeRate >= 70 ? "secondary" : "destructive"}
								>
									{Math.round(member.onTimeRate)}% on-time
								</Badge>
							</div>
						)) : (
							<p className="text-sm text-muted-foreground text-center py-4">
								No team performance data available
							</p>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Risks & Recommendations */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<AlertTriangle className="h-4 w-4" />
						Risks & Recommendations
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{risks.length > 0 ? (
							<div>
								<h4 className="text-sm font-medium mb-2 text-red-600">Risks</h4>
								<ul className="space-y-1">
									{risks.slice(0, 3).map((risk, idx) => (
										<li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
											<AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
											{risk}
										</li>
									))}
								</ul>
							</div>
						) : (
							<div className="flex items-center gap-2 text-green-600">
								<CheckSquare className="h-4 w-4" />
								<span className="text-sm">No active risks</span>
							</div>
						)}
						{recommendations.length > 0 && (
							<div>
								<h4 className="text-sm font-medium mb-2 text-blue-600">Recommendations</h4>
								<ul className="space-y-1">
									{recommendations.slice(0, 3).map((rec, idx) => (
										<li key={idx} className="text-sm text-muted-foreground">
											• {rec}
										</li>
									))}
								</ul>
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Summary Stats */}
			<Card className="md:col-span-2">
				<CardContent className="py-4">
					<div className="flex items-center justify-around text-center">
						<div>
							<Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
							<p className="text-lg font-semibold">{taskSummary.blocked}</p>
							<p className="text-xs text-muted-foreground">Blocked Tasks</p>
						</div>
						<div className="h-10 w-px bg-border" />
						<div>
							<Target className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
							<p className="text-lg font-semibold">{report.reportDate}</p>
							<p className="text-xs text-muted-foreground">Report Date</p>
						</div>
						<div className="h-10 w-px bg-border" />
						<div>
							<TrendingUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
							<p className="text-lg font-semibold">{taskSummary.total}</p>
							<p className="text-xs text-muted-foreground">Total Tasks</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
