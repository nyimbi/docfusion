/**
 * Task Management Server Actions - DocFusion
 *
 * Server-side actions for intelligent task assignment, workload balancing,
 * and proposal progress tracking. Includes AI-powered assignment suggestions,
 * critical path analysis, and bottleneck detection.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

interface TaskFilters {
	status?: string;
	priority?: string;
	assignedTo?: string;
	taskType?: string;
	taskCategory?: string;
	dueBefore?: string;
	dueAfter?: string;
	isOverdue?: boolean;
	sectionId?: string;
	volumeId?: string;
	search?: string;
	tags?: string[];
}

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

interface TaskAssignment {
	taskId: string;
	userId: string;
	assignedBy: string;
}

interface CriticalPathNode {
	taskId: string;
	title: string;
	dueDate: string;
	duration: number;
	slack: number;
	isCritical: boolean;
	dependencies: string[];
	dependents: string[];
}

interface CriticalPath {
	nodes: CriticalPathNode[];
	criticalTasks: string[];
	totalDuration: number;
	projectEndDate: string;
	bottlenecks: string[];
}

interface WorkloadSummary {
	userId: string;
	userName: string;
	activeTasks: number;
	pendingTasks: number;
	totalEstimatedHours: number;
	totalActualHours: number;
	dueThisWeek: number;
	overdueCount: number;
	utilizationRate: number;
	availableHours: number;
	tasksByPriority: Record<string, number>;
	tasksByType: Record<string, number>;
	upcomingDeadlines: { taskId: string; title: string; dueDate: string }[];
	workloadHealth: "healthy" | "elevated" | "overloaded" | "critical";
}

interface RebalanceResult {
	success: boolean;
	reassignments: {
		taskId: string;
		fromUser: string;
		toUser: string;
		reason: string;
	}[];
	improvements: {
		metric: string;
		before: number;
		after: number;
	}[];
	warnings: string[];
}

interface Bottleneck {
	taskId: string;
	title: string;
	assignedTo: string;
	blockedTasks: number;
	reason: string;
	severity: "critical" | "high" | "medium" | "low";
	suggestedAction: string;
	impactDays: number;
}

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
	volumeProgress: {
		volumeId: string;
		volumeName: string;
		progress: number;
		tasksCompleted: number;
		tasksTotal: number;
	}[];
	teamPerformance: {
		userId: string;
		userName: string;
		tasksCompleted: number;
		tasksAssigned: number;
		onTimeRate: number;
	}[];
	timeline: {
		date: string;
		tasksCompleted: number;
		progress: number;
	}[];
	risks: string[];
	recommendations: string[];
}

// ============================================================================
// Input Schemas
// ============================================================================

const CreateTaskInput = z.object({
	opportunityId: z.string().uuid(),
	title: z.string().min(1).max(500),
	description: z.string().optional(),
	taskType: z.string().min(1),
	taskCategory: z.string().optional(),
	sectionId: z.string().uuid().optional(),
	requirementId: z.string().uuid().optional(),
	volumeId: z.string().uuid().optional(),
	assignedTo: z.string().optional(),
	assignedToEmail: z.string().email().optional(),
	dueDate: z.string().optional(),
	estimatedHours: z.number().positive().optional(),
	priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
	dependsOn: z.array(z.string().uuid()).optional(),
	wordCountTarget: z.number().int().positive().optional(),
	pageTarget: z.number().positive().optional(),
	complianceRequirements: z.array(z.string()).optional(),
	tags: z.array(z.string()).optional(),
});

const UpdateTaskInput = z.object({
	title: z.string().min(1).max(500).optional(),
	description: z.string().optional(),
	taskType: z.string().optional(),
	taskCategory: z.string().optional(),
	assignedTo: z.string().optional(),
	assignedToEmail: z.string().email().optional(),
	dueDate: z.string().optional(),
	estimatedHours: z.number().positive().optional(),
	actualHours: z.number().positive().optional(),
	priority: z.enum(["critical", "high", "medium", "low"]).optional(),
	status: z.enum(["pending", "assigned", "in_progress", "review", "blocked", "completed", "cancelled"]).optional(),
	progress: z.number().int().min(0).max(100).optional(),
	wordCountCurrent: z.number().int().min(0).optional(),
	pageCurrent: z.number().min(0).optional(),
	dependsOn: z.array(z.string().uuid()).optional(),
	tags: z.array(z.string()).optional(),
});

// ============================================================================
// Task CRUD Operations
// ============================================================================

/**
 * Create a new proposal task.
 */
export async function createTask(
	input: z.infer<typeof CreateTaskInput>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
	try {
		const validated = CreateTaskInput.parse(input);

		// Generate task number
		const taskNumber = `T-${Date.now().toString(36).toUpperCase()}`;

		// In production, insert into database
		const task = {
			id: crypto.randomUUID(),
			...validated,
			taskNumber,
			status: validated.assignedTo ? "assigned" : "pending",
			assignedAt: validated.assignedTo ? new Date().toISOString() : null,
			progress: 0,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		console.log("Creating task:", task);

		// Log activity
		await logTaskActivity(task.id, "created", "Task created", undefined, task.status);

		revalidatePath("/opportunities/[id]/tasks", "page");

		return { success: true, data: task };
	} catch (error) {
		console.error("Failed to create task:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to create task" };
	}
}

/**
 * Update an existing task.
 */
export async function updateTask(
	id: string,
	input: z.infer<typeof UpdateTaskInput>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
	try {
		const validated = UpdateTaskInput.parse(input);

		// In production, update database
		console.log("Updating task:", id, validated);

		// Track status changes
		if (validated.status) {
			await logTaskActivity(id, "status_change", `Status changed to ${validated.status}`, undefined, validated.status);
		}

		// Track assignment changes
		if (validated.assignedTo) {
			await logTaskActivity(id, "assigned", `Assigned to ${validated.assignedTo}`);
		}

		revalidatePath("/opportunities/[id]/tasks", "page");

		return { success: true, data: { id, ...validated, updatedAt: new Date().toISOString() } };
	} catch (error) {
		console.error("Failed to update task:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to update task" };
	}
}

/**
 * Delete a task.
 */
export async function deleteTask(id: string): Promise<{ success: boolean; error?: string }> {
	try {
		// In production, delete from database
		console.log("Deleting task:", id);

		revalidatePath("/opportunities/[id]/tasks", "page");

		return { success: true };
	} catch (error) {
		console.error("Failed to delete task:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to delete task" };
	}
}

/**
 * List tasks with filters.
 */
export async function listTasks(
	opportunityId: string,
	filters?: TaskFilters
): Promise<{ success: boolean; data?: unknown[]; error?: string }> {
	try {
		console.log("Listing tasks for opportunity:", opportunityId, "with filters:", filters);

		// Mock data for development
		const tasks = [
			{
				id: "task-1",
				taskNumber: "T-001",
				title: "Write Executive Summary",
				description: "Draft the executive summary highlighting key win themes",
				taskType: "writing",
				taskCategory: "executive_summary",
				status: "in_progress",
				priority: "high",
				progress: 45,
				assignedTo: "John Smith",
				assignedToEmail: "john.smith@example.com",
				dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
				estimatedHours: 8,
				actualHours: 4,
				wordCountTarget: 2000,
				wordCountCurrent: 900,
				createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
			},
			{
				id: "task-2",
				taskNumber: "T-002",
				title: "Technical Approach Section",
				description: "Develop technical approach addressing all Section L requirements",
				taskType: "writing",
				taskCategory: "technical",
				status: "pending",
				priority: "critical",
				progress: 0,
				assignedTo: "Jane Doe",
				assignedToEmail: "jane.doe@example.com",
				dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
				estimatedHours: 16,
				dependsOn: ["task-1"],
				wordCountTarget: 5000,
				wordCountCurrent: 0,
				createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
			},
			{
				id: "task-3",
				taskNumber: "T-003",
				title: "Create Org Chart Graphic",
				description: "Design organizational chart showing project team structure",
				taskType: "graphics",
				taskCategory: "management",
				status: "completed",
				priority: "medium",
				progress: 100,
				assignedTo: "Bob Wilson",
				assignedToEmail: "bob.wilson@example.com",
				dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
				completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
				estimatedHours: 4,
				actualHours: 3,
				createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
			},
			{
				id: "task-4",
				taskNumber: "T-004",
				title: "Past Performance Narratives",
				description: "Write 3 past performance narratives for relevant projects",
				taskType: "writing",
				taskCategory: "past_performance",
				status: "blocked",
				priority: "high",
				progress: 30,
				assignedTo: "Sarah Johnson",
				assignedToEmail: "sarah.johnson@example.com",
				dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
				estimatedHours: 12,
				actualHours: 4,
				blockedBy: ["Waiting for project references from PM"],
				wordCountTarget: 3000,
				wordCountCurrent: 900,
				createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
			},
			{
				id: "task-5",
				taskNumber: "T-005",
				title: "Review Technical Section",
				description: "Conduct technical review of approach section",
				taskType: "review",
				taskCategory: "technical",
				status: "pending",
				priority: "medium",
				progress: 0,
				dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
				estimatedHours: 6,
				dependsOn: ["task-2"],
				createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
			},
		];

		// Apply filters
		let filteredTasks = tasks;

		if (filters?.status) {
			filteredTasks = filteredTasks.filter(t => t.status === filters.status);
		}
		if (filters?.priority) {
			filteredTasks = filteredTasks.filter(t => t.priority === filters.priority);
		}
		if (filters?.assignedTo) {
			filteredTasks = filteredTasks.filter(t => t.assignedTo?.toLowerCase().includes(filters.assignedTo!.toLowerCase()));
		}
		if (filters?.taskType) {
			filteredTasks = filteredTasks.filter(t => t.taskType === filters.taskType);
		}
		if (filters?.search) {
			const search = filters.search.toLowerCase();
			filteredTasks = filteredTasks.filter(t =>
				t.title.toLowerCase().includes(search) ||
				t.description?.toLowerCase().includes(search)
			);
		}
		if (filters?.isOverdue) {
			filteredTasks = filteredTasks.filter(t =>
				t.status !== "completed" && new Date(t.dueDate) < new Date()
			);
		}

		return { success: true, data: filteredTasks };
	} catch (error) {
		console.error("Failed to list tasks:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to list tasks" };
	}
}

/**
 * Get a single task by ID.
 */
export async function getTask(
	id: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
	try {
		// In production, fetch from database
		console.log("Getting task:", id);

		return { success: true, data: { id, title: "Sample Task" } };
	} catch (error) {
		console.error("Failed to get task:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to get task" };
	}
}

// ============================================================================
// Task Generation
// ============================================================================

/**
 * Generate tasks from a compliance matrix.
 * Creates one task per requirement that needs to be addressed.
 */
export async function generateTasksFromCompliance(
	matrixId: string
): Promise<{ success: boolean; data?: { tasksCreated: number; tasks: unknown[] }; error?: string }> {
	try {
		console.log("Generating tasks from compliance matrix:", matrixId);

		// In production, read compliance matrix and generate tasks
		// Mock generation
		const generatedTasks = [
			{
				id: crypto.randomUUID(),
				taskNumber: "T-AUTO-001",
				title: "Address Requirement L.5.2.1 - Technical Approach",
				description: "Write response addressing Section L requirement 5.2.1",
				taskType: "writing",
				taskCategory: "technical",
				status: "pending",
				priority: "high",
				sourceType: "compliance_matrix",
				sourceId: matrixId,
			},
			{
				id: crypto.randomUUID(),
				taskNumber: "T-AUTO-002",
				title: "Address Requirement L.5.2.2 - Management Approach",
				description: "Write response addressing Section L requirement 5.2.2",
				taskType: "writing",
				taskCategory: "management",
				status: "pending",
				priority: "high",
				sourceType: "compliance_matrix",
				sourceId: matrixId,
			},
			{
				id: crypto.randomUUID(),
				taskNumber: "T-AUTO-003",
				title: "Address Requirement L.5.3 - Past Performance",
				description: "Compile past performance evidence for requirement L.5.3",
				taskType: "writing",
				taskCategory: "past_performance",
				status: "pending",
				priority: "medium",
				sourceType: "compliance_matrix",
				sourceId: matrixId,
			},
		];

		revalidatePath("/opportunities/[id]/tasks", "page");

		return {
			success: true,
			data: {
				tasksCreated: generatedTasks.length,
				tasks: generatedTasks,
			},
		};
	} catch (error) {
		console.error("Failed to generate tasks:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to generate tasks" };
	}
}

// ============================================================================
// Assignment Suggestions
// ============================================================================

/**
 * Suggest optimal assignees for a task based on expertise, workload, and availability.
 */
export async function suggestAssignment(
	taskId: string
): Promise<{ success: boolean; data?: AssignmentSuggestion[]; error?: string }> {
	try {
		console.log("Suggesting assignments for task:", taskId);

		// In production, analyze author expertise and workload
		const suggestions: AssignmentSuggestion[] = [
			{
				userId: "user-1",
				userName: "John Smith",
				userEmail: "john.smith@example.com",
				matchScore: 95,
				reasons: [
					"Expert in technical writing (5 years experience)",
					"High on-time delivery rate (98%)",
					"Successfully completed 12 similar tasks",
					"Currently has capacity (60% utilized)",
				],
				workloadStatus: "moderate",
				estimatedCompletionDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
				expertiseMatch: 95,
				availabilityMatch: 85,
				performanceScore: 92,
			},
			{
				userId: "user-2",
				userName: "Jane Doe",
				userEmail: "jane.doe@example.com",
				matchScore: 88,
				reasons: [
					"Strong technical background",
					"Available immediately",
					"Good quality scores (avg 4.5/5)",
				],
				workloadStatus: "available",
				estimatedCompletionDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
				expertiseMatch: 85,
				availabilityMatch: 95,
				performanceScore: 85,
			},
			{
				userId: "user-3",
				userName: "Bob Wilson",
				userEmail: "bob.wilson@example.com",
				matchScore: 72,
				reasons: [
					"Has relevant certifications",
					"Moderate workload currently",
					"Previous experience with this client",
				],
				workloadStatus: "high",
				estimatedCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
				expertiseMatch: 78,
				availabilityMatch: 60,
				performanceScore: 80,
			},
		];

		return { success: true, data: suggestions };
	} catch (error) {
		console.error("Failed to suggest assignments:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to suggest assignments" };
	}
}

/**
 * Bulk assign multiple tasks.
 */
export async function bulkAssignTasks(
	assignments: TaskAssignment[]
): Promise<{ success: boolean; data?: { assigned: number; failed: number }; error?: string }> {
	try {
		console.log("Bulk assigning tasks:", assignments);

		let assigned = 0;
		let failed = 0;

		for (const assignment of assignments) {
			const result = await updateTask(assignment.taskId, {
				assignedTo: assignment.userId,
			});

			if (result.success) {
				assigned++;
			} else {
				failed++;
			}
		}

		revalidatePath("/opportunities/[id]/tasks", "page");

		return { success: true, data: { assigned, failed } };
	} catch (error) {
		console.error("Failed to bulk assign tasks:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to bulk assign tasks" };
	}
}

// ============================================================================
// Critical Path Analysis
// ============================================================================

/**
 * Calculate the critical path for an opportunity's tasks.
 */
export async function calculateCriticalPath(
	opportunityId: string
): Promise<{ success: boolean; data?: CriticalPath; error?: string }> {
	try {
		console.log("Calculating critical path for opportunity:", opportunityId);

		// In production, perform actual critical path analysis
		// This would use topological sorting and forward/backward pass algorithms

		const criticalPath: CriticalPath = {
			nodes: [
				{
					taskId: "task-1",
					title: "Executive Summary",
					dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
					duration: 8,
					slack: 0,
					isCritical: true,
					dependencies: [],
					dependents: ["task-2"],
				},
				{
					taskId: "task-2",
					title: "Technical Approach",
					dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
					duration: 16,
					slack: 0,
					isCritical: true,
					dependencies: ["task-1"],
					dependents: ["task-5"],
				},
				{
					taskId: "task-3",
					title: "Org Chart",
					dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
					duration: 4,
					slack: 2,
					isCritical: false,
					dependencies: [],
					dependents: [],
				},
				{
					taskId: "task-4",
					title: "Past Performance",
					dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
					duration: 12,
					slack: 1,
					isCritical: false,
					dependencies: [],
					dependents: [],
				},
				{
					taskId: "task-5",
					title: "Technical Review",
					dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
					duration: 6,
					slack: 0,
					isCritical: true,
					dependencies: ["task-2"],
					dependents: [],
				},
			],
			criticalTasks: ["task-1", "task-2", "task-5"],
			totalDuration: 30, // hours
			projectEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
			bottlenecks: ["task-2 has no slack and multiple dependents"],
		};

		return { success: true, data: criticalPath };
	} catch (error) {
		console.error("Failed to calculate critical path:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to calculate critical path" };
	}
}

// ============================================================================
// Workload Management
// ============================================================================

/**
 * Get workload summary for a user.
 */
export async function getWorkloadSummary(
	userId: string
): Promise<{ success: boolean; data?: WorkloadSummary; error?: string }> {
	try {
		console.log("Getting workload summary for user:", userId);

		// In production, aggregate from tasks and snapshots
		const summary: WorkloadSummary = {
			userId,
			userName: "John Smith",
			activeTasks: 5,
			pendingTasks: 3,
			totalEstimatedHours: 42,
			totalActualHours: 28,
			dueThisWeek: 4,
			overdueCount: 1,
			utilizationRate: 85,
			availableHours: 40,
			tasksByPriority: {
				critical: 1,
				high: 2,
				medium: 4,
				low: 1,
			},
			tasksByType: {
				writing: 5,
				review: 2,
				graphics: 1,
			},
			upcomingDeadlines: [
				{ taskId: "task-1", title: "Executive Summary", dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString() },
				{ taskId: "task-2", title: "Technical Approach", dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
			],
			workloadHealth: "elevated",
		};

		return { success: true, data: summary };
	} catch (error) {
		console.error("Failed to get workload summary:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to get workload summary" };
	}
}

/**
 * Get workload summaries for all team members on an opportunity.
 */
export async function getTeamWorkload(
	opportunityId: string
): Promise<{ success: boolean; data?: WorkloadSummary[]; error?: string }> {
	try {
		console.log("Getting team workload for opportunity:", opportunityId);

		// In production, aggregate workload for all assigned users
		const teamWorkload: WorkloadSummary[] = [
			{
				userId: "user-1",
				userName: "John Smith",
				activeTasks: 5,
				pendingTasks: 2,
				totalEstimatedHours: 35,
				totalActualHours: 20,
				dueThisWeek: 3,
				overdueCount: 0,
				utilizationRate: 88,
				availableHours: 40,
				tasksByPriority: { critical: 1, high: 2, medium: 2, low: 0 },
				tasksByType: { writing: 4, review: 1 },
				upcomingDeadlines: [],
				workloadHealth: "elevated",
			},
			{
				userId: "user-2",
				userName: "Jane Doe",
				activeTasks: 3,
				pendingTasks: 1,
				totalEstimatedHours: 24,
				totalActualHours: 16,
				dueThisWeek: 2,
				overdueCount: 0,
				utilizationRate: 60,
				availableHours: 40,
				tasksByPriority: { critical: 0, high: 1, medium: 2, low: 0 },
				tasksByType: { writing: 2, research: 1 },
				upcomingDeadlines: [],
				workloadHealth: "healthy",
			},
			{
				userId: "user-3",
				userName: "Bob Wilson",
				activeTasks: 2,
				pendingTasks: 0,
				totalEstimatedHours: 12,
				totalActualHours: 8,
				dueThisWeek: 1,
				overdueCount: 1,
				utilizationRate: 30,
				availableHours: 40,
				tasksByPriority: { critical: 0, high: 0, medium: 1, low: 1 },
				tasksByType: { graphics: 2 },
				upcomingDeadlines: [],
				workloadHealth: "healthy",
			},
			{
				userId: "user-4",
				userName: "Sarah Johnson",
				activeTasks: 4,
				pendingTasks: 3,
				totalEstimatedHours: 48,
				totalActualHours: 30,
				dueThisWeek: 4,
				overdueCount: 2,
				utilizationRate: 120,
				availableHours: 40,
				tasksByPriority: { critical: 2, high: 2, medium: 0, low: 0 },
				tasksByType: { writing: 3, review: 1 },
				upcomingDeadlines: [],
				workloadHealth: "overloaded",
			},
		];

		return { success: true, data: teamWorkload };
	} catch (error) {
		console.error("Failed to get team workload:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to get team workload" };
	}
}

/**
 * Suggest workload rebalancing across the team.
 */
export async function balanceWorkload(
	opportunityId: string
): Promise<{ success: boolean; data?: RebalanceResult; error?: string }> {
	try {
		console.log("Balancing workload for opportunity:", opportunityId);

		// In production, use optimization algorithm to suggest reassignments
		const result: RebalanceResult = {
			success: true,
			reassignments: [
				{
					taskId: "task-6",
					fromUser: "Sarah Johnson",
					toUser: "Jane Doe",
					reason: "Sarah is overloaded (120% utilization), Jane has capacity (60% utilization)",
				},
				{
					taskId: "task-7",
					fromUser: "Sarah Johnson",
					toUser: "Bob Wilson",
					reason: "Graphics task better suited to Bob's expertise",
				},
			],
			improvements: [
				{ metric: "Team utilization variance", before: 35, after: 12 },
				{ metric: "Max individual utilization", before: 120, after: 85 },
				{ metric: "Overdue risk tasks", before: 3, after: 1 },
			],
			warnings: [
				"Bob Wilson may need support with writing tasks",
				"Consider extending deadline for task-8 if rebalancing is applied",
			],
		};

		return { success: true, data: result };
	} catch (error) {
		console.error("Failed to balance workload:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to balance workload" };
	}
}

// ============================================================================
// Bottleneck Detection
// ============================================================================

/**
 * Detect bottlenecks in the proposal workflow.
 */
export async function detectBottlenecks(
	opportunityId: string
): Promise<{ success: boolean; data?: Bottleneck[]; error?: string }> {
	try {
		console.log("Detecting bottlenecks for opportunity:", opportunityId);

		// In production, analyze task dependencies and status
		const bottlenecks: Bottleneck[] = [
			{
				taskId: "task-4",
				title: "Past Performance Narratives",
				assignedTo: "Sarah Johnson",
				blockedTasks: 2,
				reason: "Blocked waiting for external reference information",
				severity: "high",
				suggestedAction: "Escalate to PM to expedite reference collection",
				impactDays: 3,
			},
			{
				taskId: "task-2",
				title: "Technical Approach Section",
				assignedTo: "Jane Doe",
				blockedTasks: 3,
				reason: "On critical path with multiple dependents, currently at 0% progress",
				severity: "critical",
				suggestedAction: "Prioritize this task and consider adding support resources",
				impactDays: 5,
			},
		];

		return { success: true, data: bottlenecks };
	} catch (error) {
		console.error("Failed to detect bottlenecks:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to detect bottlenecks" };
	}
}

// ============================================================================
// Escalation & Notifications
// ============================================================================

/**
 * Escalate overdue or at-risk tasks.
 */
export async function escalateOverdueTasks(
	opportunityId: string
): Promise<{ success: boolean; data?: { escalated: number; tasks: string[] }; error?: string }> {
	try {
		console.log("Escalating overdue tasks for opportunity:", opportunityId);

		// In production, find overdue tasks and send escalation notifications
		const escalatedTasks = ["task-4", "task-7"];

		// Update task escalation status
		for (const taskId of escalatedTasks) {
			await logTaskActivity(taskId, "escalated", "Task escalated due to deadline risk");
		}

		return {
			success: true,
			data: {
				escalated: escalatedTasks.length,
				tasks: escalatedTasks,
			},
		};
	} catch (error) {
		console.error("Failed to escalate tasks:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to escalate tasks" };
	}
}

// ============================================================================
// Progress Reporting
// ============================================================================

/**
 * Generate a progress report for an opportunity.
 */
export async function generateProgressReport(
	opportunityId: string
): Promise<{ success: boolean; data?: ProgressReport; error?: string }> {
	try {
		console.log("Generating progress report for opportunity:", opportunityId);

		// In production, aggregate data from tasks
		const report: ProgressReport = {
			opportunityId,
			opportunityName: "Agency XYZ IT Modernization",
			reportDate: new Date().toISOString(),
			overallProgress: 45,
			taskSummary: {
				total: 15,
				completed: 5,
				inProgress: 6,
				pending: 2,
				blocked: 1,
				overdue: 1,
			},
			volumeProgress: [
				{ volumeId: "vol-1", volumeName: "Technical Volume", progress: 35, tasksCompleted: 2, tasksTotal: 6 },
				{ volumeId: "vol-2", volumeName: "Management Volume", progress: 50, tasksCompleted: 2, tasksTotal: 4 },
				{ volumeId: "vol-3", volumeName: "Past Performance", progress: 60, tasksCompleted: 3, tasksTotal: 5 },
			],
			teamPerformance: [
				{ userId: "user-1", userName: "John Smith", tasksCompleted: 3, tasksAssigned: 5, onTimeRate: 100 },
				{ userId: "user-2", userName: "Jane Doe", tasksCompleted: 1, tasksAssigned: 3, onTimeRate: 100 },
				{ userId: "user-3", userName: "Bob Wilson", tasksCompleted: 1, tasksAssigned: 2, onTimeRate: 50 },
			],
			timeline: [
				{ date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), tasksCompleted: 1, progress: 15 },
				{ date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), tasksCompleted: 2, progress: 25 },
				{ date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), tasksCompleted: 1, progress: 35 },
				{ date: new Date().toISOString(), tasksCompleted: 1, progress: 45 },
			],
			risks: [
				"Technical volume behind schedule - may impact review timeline",
				"One team member overloaded - consider reassignment",
				"External dependency for past performance references not yet resolved",
			],
			recommendations: [
				"Prioritize technical approach section to unblock dependent tasks",
				"Rebalance workload from Sarah Johnson to Jane Doe",
				"Schedule daily standups for remaining week before deadline",
			],
		};

		return { success: true, data: report };
	} catch (error) {
		console.error("Failed to generate progress report:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to generate progress report" };
	}
}

// ============================================================================
// Author Expertise Management
// ============================================================================

/**
 * Update author expertise based on completed tasks.
 */
export async function updateAuthorExpertise(
	userId: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
	try {
		console.log("Updating author expertise for user:", userId);

		// In production, analyze completed tasks and update expertise profile
		// This would calculate averages, update proficiency levels, etc.

		const updatedExpertise = {
			userId,
			averageWordsPerHour: 450,
			qualityScoreAverage: 4.2,
			onTimeDeliveryRate: 94,
			totalTasksCompleted: 48,
			expertiseAreas: [
				{ area: "Technical Writing", proficiency: "expert", yearsExperience: 5, lastUsed: new Date().toISOString() },
				{ area: "Proposal Development", proficiency: "advanced", yearsExperience: 4, lastUsed: new Date().toISOString() },
			],
		};

		return { success: true, data: updatedExpertise };
	} catch (error) {
		console.error("Failed to update author expertise:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to update author expertise" };
	}
}

/**
 * Get author expertise for a user.
 */
export async function getAuthorExpertise(
	userId: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
	try {
		console.log("Getting author expertise for user:", userId);

		// Mock data
		const expertise = {
			id: crypto.randomUUID(),
			userId,
			userName: "John Smith",
			userEmail: "john.smith@example.com",
			expertiseAreas: [
				{ area: "Technical Writing", category: "writing", proficiency: "expert", yearsExperience: 5, lastUsed: new Date().toISOString(), projectCount: 24 },
				{ area: "Proposal Development", category: "writing", proficiency: "advanced", yearsExperience: 4, lastUsed: new Date().toISOString(), projectCount: 18 },
				{ area: "Government Contracting", category: "domain", proficiency: "advanced", yearsExperience: 3, lastUsed: new Date().toISOString(), projectCount: 12 },
			],
			averageWordsPerHour: 450,
			qualityScoreAverage: 4.2,
			onTimeDeliveryRate: 94,
			revisionRate: 1.2,
			totalTasksCompleted: 48,
			totalHoursLogged: 520,
			preferredTaskTypes: ["writing", "review"],
			maxConcurrentTasks: 5,
			availability: "available",
			availableHoursPerWeek: 40,
			clearanceLevel: "Secret",
			clearanceStatus: "Active",
			certifications: [
				{ name: "PMP", issuer: "PMI", expirationDate: "2026-05-01" },
				{ name: "APMP Practitioner", issuer: "APMP" },
			],
		};

		return { success: true, data: expertise };
	} catch (error) {
		console.error("Failed to get author expertise:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to get author expertise" };
	}
}

// ============================================================================
// Task Activity Logging
// ============================================================================

/**
 * Log a task activity.
 */
async function logTaskActivity(
	taskId: string,
	activityType: string,
	description: string,
	previousValue?: string,
	newValue?: string
): Promise<void> {
	console.log("Logging task activity:", {
		taskId,
		activityType,
		description,
		previousValue,
		newValue,
		createdAt: new Date().toISOString(),
	});

	// In production, insert into task_activity table
}

/**
 * Get activity history for a task.
 */
export async function getTaskActivity(
	taskId: string
): Promise<{ success: boolean; data?: unknown[]; error?: string }> {
	try {
		console.log("Getting activity for task:", taskId);

		// Mock activity data
		const activities = [
			{
				id: "act-1",
				taskId,
				activityType: "created",
				description: "Task created",
				userName: "Admin User",
				createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
			},
			{
				id: "act-2",
				taskId,
				activityType: "assigned",
				description: "Assigned to John Smith",
				userName: "Admin User",
				createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
			},
			{
				id: "act-3",
				taskId,
				activityType: "status_change",
				description: "Status changed to in_progress",
				previousValue: "assigned",
				newValue: "in_progress",
				userName: "John Smith",
				createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
			},
			{
				id: "act-4",
				taskId,
				activityType: "progress_update",
				description: "Progress updated to 45%",
				previousValue: "20",
				newValue: "45",
				userName: "John Smith",
				createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
			},
		];

		return { success: true, data: activities };
	} catch (error) {
		console.error("Failed to get task activity:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to get task activity" };
	}
}

// ============================================================================
// Time Tracking
// ============================================================================

/**
 * Log time against a task.
 */
export async function logTime(
	taskId: string,
	hours: number,
	notes?: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
	try {
		console.log("Logging time for task:", taskId, hours, notes);

		// In production, add to hoursLogged array and update actualHours
		const timeEntry = {
			id: crypto.randomUUID(),
			taskId,
			hours,
			notes,
			date: new Date().toISOString(),
		};

		await logTaskActivity(taskId, "time_logged", `Logged ${hours} hours`);

		return { success: true, data: timeEntry };
	} catch (error) {
		console.error("Failed to log time:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to log time" };
	}
}
