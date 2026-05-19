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
import { db } from "@/lib/db";
import {
	proposalTasks,
	authorExpertise,
	workloadSnapshots,
	taskActivity,
	opportunityTaskSummary,
	type ProposalTask,
	type NewProposalTask,
	type AuthorExpertise as AuthorExpertiseType,
	type WorkloadSnapshot,
	type TaskActivity as TaskActivityType,
} from "@/lib/db/schema-tasks";
import { rfpRequirements } from "@/lib/db/schema-rfp";
import { eq, and, or, ilike, gte, lte, desc, asc, sql, inArray, isNull, count, sum, ne, lt, gt, type SQL } from "drizzle-orm";
import { logger } from "@/lib/utils/logger";
import { requireServerSession } from "@/lib/auth-utils";

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

interface TaskActor {
	userId: string;
	userName: string;
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
	workloadHealth: "healthy" | "available" | "elevated" | "overloaded" | "critical";
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
// Helper Functions
// ============================================================================

async function requireTaskActor(): Promise<TaskActor> {
	const session = await requireServerSession();
	const userId = session.user?.id;
	if (!userId) {
		throw new Error("Unauthorized");
	}

	return {
		userId,
		userName: session.user?.name ?? session.user?.email ?? userId,
	};
}

function ensureTaskActorMatches(actor: TaskActor, userId?: string): void {
	if (userId && userId !== actor.userId) {
		throw new Error("Unauthorized");
	}
}

function assignedOpportunityExistsSql(opportunityId: unknown, actor: TaskActor): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and opportunities.assigned_to = ${actor.userId}
	)`;
}

function proposalTasksByOpportunityCondition(opportunityId: string, actor: TaskActor): SQL {
	return and(
		eq(proposalTasks.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, actor)
	)!;
}

function visibleProposalTaskCondition(taskId: string, actor: TaskActor): SQL {
	return and(
		eq(proposalTasks.id, taskId),
		assignedOpportunityExistsSql(proposalTasks.opportunityId, actor)
	)!;
}

function visibleTaskActivityCondition(taskId: string, actor: TaskActor): SQL {
	return and(
		eq(taskActivity.taskId, taskId),
		sql`exists (
			select 1
			from proposal_tasks
			join opportunities on opportunities.id = proposal_tasks.opportunity_id
			where proposal_tasks.id = ${taskActivity.taskId}
				and opportunities.assigned_to = ${actor.userId}
		)`
	)!;
}

function requirementsByOpportunityCondition(opportunityId: string, actor: TaskActor): SQL {
	return and(
		eq(rfpRequirements.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, actor)
	)!;
}

function taskSummaryByOpportunityCondition(opportunityId: string, actor: TaskActor): SQL {
	return and(
		eq(opportunityTaskSummary.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, actor)
	)!;
}

/**
 * Generate a unique task number for an opportunity.
 */
async function generateTaskNumber(opportunityId: string, actor: TaskActor): Promise<string> {
	const result = await db
		.select({ count: count() })
		.from(proposalTasks)
		.where(proposalTasksByOpportunityCondition(opportunityId, actor));

	const taskCount = result[0]?.count ?? 0;
	const nextNumber = taskCount + 1;
	return `T-${nextNumber.toString().padStart(4, "0")}`;
}

/**
 * Log a task activity to the database.
 */
async function logTaskActivity(
	taskId: string,
	activityType: string,
	description: string,
	previousValue?: string,
	newValue?: string,
	userId?: string,
	userName?: string,
	changeField?: string
): Promise<void> {
	try {
		await db.insert(taskActivity).values({
			taskId,
			activityType,
			description,
			previousValue: previousValue ?? null,
			newValue: newValue ?? null,
			userId: userId ?? null,
			userName: userName ?? null,
			changeField: changeField ?? null,
		});
	} catch (error) {
		logger.error("Failed to log task activity:", error);
	}
}

/**
 * Calculate workload health based on utilization rate.
 */
function calculateWorkloadHealth(utilizationRate: number): "healthy" | "available" | "elevated" | "overloaded" | "critical" {
	if (utilizationRate <= 50) return "available";
	if (utilizationRate <= 70) return "healthy";
	if (utilizationRate <= 85) return "elevated";
	if (utilizationRate <= 100) return "overloaded";
	return "critical";
}

/**
 * Calculate the number of days between two dates.
 */
function daysBetween(date1: Date, date2: Date): number {
	const oneDay = 24 * 60 * 60 * 1000;
	return Math.round((date2.getTime() - date1.getTime()) / oneDay);
}

// ============================================================================
// Task CRUD Operations
// ============================================================================

/**
 * Create a new proposal task.
 */
export async function createTask(
	input: z.infer<typeof CreateTaskInput>
): Promise<{ success: boolean; data?: ProposalTask; error?: string }> {
	try {
		const actor = await requireTaskActor();
		const validated = CreateTaskInput.parse(input);

		// Generate task number
		const taskNumber = await generateTaskNumber(validated.opportunityId, actor);

		// Prepare task data
		const taskData: NewProposalTask = {
			opportunityId: validated.opportunityId,
			taskNumber,
			title: validated.title,
			description: validated.description ?? null,
			taskType: validated.taskType,
			taskCategory: validated.taskCategory ?? null,
			sectionId: validated.sectionId ?? null,
			requirementId: validated.requirementId ?? null,
			volumeId: validated.volumeId ?? null,
			assignedTo: validated.assignedTo ?? null,
			assignedToEmail: validated.assignedToEmail ?? null,
			assignedAt: validated.assignedTo ? new Date() : null,
			dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
			estimatedHours: validated.estimatedHours ?? null,
			priority: validated.priority,
			status: validated.assignedTo ? "assigned" : "pending",
			progress: 0,
			dependsOn: validated.dependsOn ?? [],
			wordCountTarget: validated.wordCountTarget ?? null,
			pageTarget: validated.pageTarget ?? null,
			complianceRequirements: validated.complianceRequirements ?? null,
			tags: validated.tags ?? [],
		};

		// Insert task
		const [task] = await db.insert(proposalTasks).values(taskData).returning();

		// Log activity
		await logTaskActivity(
			task.id,
			"created",
			"Task created",
			undefined,
			task.status ?? undefined,
			actor.userId,
			actor.userName
		);

		// If assigned, log assignment activity
		if (validated.assignedTo) {
			await logTaskActivity(
				task.id,
				"assigned",
				`Assigned to ${validated.assignedTo}`,
				undefined,
				validated.assignedTo,
				actor.userId,
				actor.userName,
				"assignedTo"
			);
		}

		// Update opportunity task summary
		await updateOpportunityTaskSummary(validated.opportunityId, actor);

		revalidatePath("/opportunities/[id]/tasks", "page");

		return { success: true, data: task };
	} catch (error) {
		logger.error("Failed to create task:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to create task" };
	}
}

/**
 * Update an existing task.
 */
export async function updateTask(
	id: string,
	input: z.infer<typeof UpdateTaskInput>
): Promise<{ success: boolean; data?: ProposalTask; error?: string }> {
	try {
		const actor = await requireTaskActor();
		const validated = UpdateTaskInput.parse(input);

		// Get current task state
		const [currentTask] = await db
			.select()
			.from(proposalTasks)
			.where(visibleProposalTaskCondition(id, actor))
			.limit(1);

		if (!currentTask) {
			return { success: false, error: "Task not found" };
		}

		// Prepare update data
		const updateData: Partial<NewProposalTask> = {
			updatedAt: new Date(),
		};

		if (validated.title !== undefined) updateData.title = validated.title;
		if (validated.description !== undefined) updateData.description = validated.description;
		if (validated.taskType !== undefined) updateData.taskType = validated.taskType;
		if (validated.taskCategory !== undefined) updateData.taskCategory = validated.taskCategory;
		if (validated.dueDate !== undefined) updateData.dueDate = validated.dueDate ? new Date(validated.dueDate) : null;
		if (validated.estimatedHours !== undefined) updateData.estimatedHours = validated.estimatedHours;
		if (validated.actualHours !== undefined) updateData.actualHours = validated.actualHours;
		if (validated.priority !== undefined) updateData.priority = validated.priority;
		if (validated.progress !== undefined) updateData.progress = validated.progress;
		if (validated.wordCountCurrent !== undefined) updateData.wordCountCurrent = validated.wordCountCurrent;
		if (validated.pageCurrent !== undefined) updateData.pageCurrent = validated.pageCurrent;
		if (validated.dependsOn !== undefined) updateData.dependsOn = validated.dependsOn;
		if (validated.tags !== undefined) updateData.tags = validated.tags;

		// Handle assignment changes
		if (validated.assignedTo !== undefined) {
			updateData.assignedTo = validated.assignedTo;
			updateData.assignedToEmail = validated.assignedToEmail ?? null;
			updateData.assignedAt = validated.assignedTo ? new Date() : null;

			// Log assignment change
			if (validated.assignedTo !== currentTask.assignedTo) {
				await logTaskActivity(
					id,
					"assigned",
					`Assigned to ${validated.assignedTo || "unassigned"}`,
					currentTask.assignedTo ?? undefined,
					validated.assignedTo ?? undefined,
					actor.userId,
					actor.userName,
					"assignedTo"
				);
			}
		}

		// Handle status changes
		if (validated.status !== undefined && validated.status !== currentTask.status) {
			updateData.status = validated.status;

			// If completing, set completedAt
			if (validated.status === "completed") {
				updateData.completedAt = new Date();
				updateData.progress = 100;
			}

			// Log status change
			await logTaskActivity(
				id,
				"status_change",
				`Status changed to ${validated.status}`,
				currentTask.status ?? undefined,
				validated.status,
				actor.userId,
				actor.userName,
				"status"
			);
		}

		// Handle progress updates
		if (validated.progress !== undefined && validated.progress !== currentTask.progress) {
			await logTaskActivity(
				id,
				"progress_update",
				`Progress updated to ${validated.progress}%`,
				String(currentTask.progress ?? 0),
				String(validated.progress),
				actor.userId,
				actor.userName,
				"progress"
			);
		}

		// Update task
		const [updatedTask] = await db
			.update(proposalTasks)
			.set(updateData)
			.where(visibleProposalTaskCondition(id, actor))
			.returning();

		// Update opportunity task summary
		await updateOpportunityTaskSummary(currentTask.opportunityId, actor);

		revalidatePath("/opportunities/[id]/tasks", "page");

		return { success: true, data: updatedTask };
	} catch (error) {
		logger.error("Failed to update task:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to update task" };
	}
}

/**
 * Delete a task.
 */
export async function deleteTask(id: string): Promise<{ success: boolean; error?: string }> {
	try {
		const actor = await requireTaskActor();

		// Get task to find opportunityId for summary update
		const [task] = await db
			.select({ opportunityId: proposalTasks.opportunityId })
			.from(proposalTasks)
			.where(visibleProposalTaskCondition(id, actor))
			.limit(1);

		if (!task) {
			return { success: false, error: "Task not found" };
		}

		// Delete task activities first (foreign key constraint)
		await db.delete(taskActivity).where(eq(taskActivity.taskId, id));

		// Delete task
		await db.delete(proposalTasks).where(visibleProposalTaskCondition(id, actor));

		// Update opportunity task summary
		await updateOpportunityTaskSummary(task.opportunityId, actor);

		revalidatePath("/opportunities/[id]/tasks", "page");

		return { success: true };
	} catch (error) {
		logger.error("Failed to delete task:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to delete task" };
	}
}

/**
 * List all tasks across all opportunities with optional filters.
 */
export async function listAllTasks(
	filters?: TaskFilters & { limit?: number }
): Promise<{ success: boolean; data?: ProposalTask[]; error?: string }> {
	try {
		const actor = await requireTaskActor();
		const conditions = [];
		conditions.push(assignedOpportunityExistsSql(proposalTasks.opportunityId, actor));

		if (filters?.status) {
			conditions.push(eq(proposalTasks.status, filters.status));
		}
		if (filters?.priority) {
			conditions.push(eq(proposalTasks.priority, filters.priority));
		}
		if (filters?.assignedTo) {
			conditions.push(ilike(proposalTasks.assignedTo, `%${filters.assignedTo}%`));
		}
		if (filters?.taskType) {
			conditions.push(eq(proposalTasks.taskType, filters.taskType));
		}
		if (filters?.dueBefore) {
			conditions.push(lte(proposalTasks.dueDate, new Date(filters.dueBefore)));
		}
		if (filters?.dueAfter) {
			conditions.push(gte(proposalTasks.dueDate, new Date(filters.dueAfter)));
		}
		if (filters?.isOverdue) {
			conditions.push(ne(proposalTasks.status, "completed"));
			conditions.push(ne(proposalTasks.status, "cancelled"));
			conditions.push(lt(proposalTasks.dueDate, new Date()));
		}
		if (filters?.search) {
			conditions.push(
				or(
					ilike(proposalTasks.title, `%${filters.search}%`),
					ilike(proposalTasks.description, `%${filters.search}%`)
				)!
			);
		}

		let query = db
			.select()
			.from(proposalTasks)
			.orderBy(
				asc(
					sql`CASE ${proposalTasks.priority}
						WHEN 'critical' THEN 1
						WHEN 'high' THEN 2
						WHEN 'medium' THEN 3
						WHEN 'low' THEN 4
						ELSE 5 END`
				),
				asc(proposalTasks.dueDate)
			);

		if (conditions.length > 0) {
			query = query.where(and(...conditions)) as typeof query;
		}

		const tasks = await query.limit(filters?.limit ?? 100);

		return { success: true, data: tasks };
	} catch (error) {
		logger.error("Failed to list all tasks:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to list tasks" };
	}
}

/**
 * List tasks with filters.
 */
export async function listTasks(
	opportunityId: string,
	filters?: TaskFilters
): Promise<{ success: boolean; data?: ProposalTask[]; error?: string }> {
	try {
		const actor = await requireTaskActor();
		// Build where conditions
		const conditions = [proposalTasksByOpportunityCondition(opportunityId, actor)];

		if (filters?.status) {
			conditions.push(eq(proposalTasks.status, filters.status));
		}
		if (filters?.priority) {
			conditions.push(eq(proposalTasks.priority, filters.priority));
		}
		if (filters?.assignedTo) {
			conditions.push(ilike(proposalTasks.assignedTo, `%${filters.assignedTo}%`));
		}
		if (filters?.taskType) {
			conditions.push(eq(proposalTasks.taskType, filters.taskType));
		}
		if (filters?.taskCategory) {
			conditions.push(eq(proposalTasks.taskCategory, filters.taskCategory));
		}
		if (filters?.sectionId) {
			conditions.push(eq(proposalTasks.sectionId, filters.sectionId));
		}
		if (filters?.volumeId) {
			conditions.push(eq(proposalTasks.volumeId, filters.volumeId));
		}
		if (filters?.dueBefore) {
			conditions.push(lte(proposalTasks.dueDate, new Date(filters.dueBefore)));
		}
		if (filters?.dueAfter) {
			conditions.push(gte(proposalTasks.dueDate, new Date(filters.dueAfter)));
		}
		if (filters?.isOverdue) {
			conditions.push(ne(proposalTasks.status, "completed"));
			conditions.push(ne(proposalTasks.status, "cancelled"));
			conditions.push(lt(proposalTasks.dueDate, new Date()));
		}
		if (filters?.search) {
			conditions.push(
				or(
					ilike(proposalTasks.title, `%${filters.search}%`),
					ilike(proposalTasks.description, `%${filters.search}%`)
				)!
			);
		}

		const tasks = await db
			.select()
			.from(proposalTasks)
			.where(and(...conditions))
			.orderBy(
				asc(
					sql`CASE ${proposalTasks.priority}
						WHEN 'critical' THEN 1
						WHEN 'high' THEN 2
						WHEN 'medium' THEN 3
						WHEN 'low' THEN 4
						ELSE 5 END`
				),
				asc(proposalTasks.dueDate)
			);

		return { success: true, data: tasks };
	} catch (error) {
		logger.error("Failed to list tasks:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to list tasks" };
	}
}

/**
 * Get a single task by ID.
 */
export async function getTask(
	id: string
): Promise<{ success: boolean; data?: ProposalTask; error?: string }> {
	try {
		const actor = await requireTaskActor();
		const [task] = await db
			.select()
			.from(proposalTasks)
			.where(visibleProposalTaskCondition(id, actor))
			.limit(1);

		if (!task) {
			return { success: false, error: "Task not found" };
		}

		return { success: true, data: task };
	} catch (error) {
		logger.error("Failed to get task:", error);
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
	matrixId: string,
	opportunityId: string
): Promise<{ success: boolean; data?: { tasksCreated: number; tasks: ProposalTask[] }; error?: string }> {
	try {
		const actor = await requireTaskActor();

		// Fetch requirements from the compliance matrix
		const reqs = await db
			.select()
			.from(rfpRequirements)
			.where(requirementsByOpportunityCondition(opportunityId, actor));

		if (reqs.length === 0) {
			return { success: true, data: { tasksCreated: 0, tasks: [] } };
		}

		const createdTasks: ProposalTask[] = [];

		for (const req of reqs) {
			// Generate task number
			const taskNumber = await generateTaskNumber(opportunityId, actor);

			// Determine task category based on requirement category
			const taskCategory = req.category?.toLowerCase().includes("technical")
				? "technical"
				: req.category?.toLowerCase().includes("management")
					? "management"
					: req.category?.toLowerCase().includes("past")
						? "past_performance"
						: req.category?.toLowerCase().includes("cost")
							? "cost"
							: null;

			// Map priority from requirement
			const priority = req.priority === "mandatory"
				? "high"
				: req.priority === "preferred"
					? "medium"
					: "low";

			const taskData: NewProposalTask = {
				opportunityId,
				taskNumber,
				title: `Address Requirement ${req.requirementNumber ?? req.id.slice(0, 8)} - ${req.category ?? "General"}`,
				description: req.requirementText,
				taskType: "writing",
				taskCategory,
				requirementId: req.id,
				priority,
				status: "pending",
				progress: 0,
				sourceType: "compliance_matrix",
				sourceId: matrixId,
				complianceRequirements: [req.id],
				dueDate: req.dueDate ?? null,
			};

			const [task] = await db.insert(proposalTasks).values(taskData).returning();
			createdTasks.push(task);

			// Log activity
			await logTaskActivity(
				task.id,
				"created",
				`Task auto-generated from compliance matrix requirement ${req.requirementNumber ?? req.id}`,
				undefined,
				"pending",
				actor.userId,
				actor.userName
			);
		}

		// Update opportunity task summary
		await updateOpportunityTaskSummary(opportunityId, actor);

		revalidatePath("/opportunities/[id]/tasks", "page");

		return {
			success: true,
			data: {
				tasksCreated: createdTasks.length,
				tasks: createdTasks,
			},
		};
	} catch (error) {
		logger.error("Failed to generate tasks:", error);
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
		const actor = await requireTaskActor();
		// Get the task details
		const [task] = await db
			.select()
			.from(proposalTasks)
			.where(visibleProposalTaskCondition(taskId, actor))
			.limit(1);

		if (!task) {
			return { success: false, error: "Task not found" };
		}

		// Get all authors with their expertise
		const authors = await db
			.select()
			.from(authorExpertise)
			.where(eq(authorExpertise.availability, "available"));

		if (authors.length === 0) {
			return { success: true, data: [] };
		}

		// Get current workload for each author
		const workloads = new Map<string, { activeTasks: number; estimatedHours: number }>();

		for (const author of authors) {
			const tasks = await db
				.select({
					count: count(),
					hours: sum(proposalTasks.estimatedHours),
				})
				.from(proposalTasks)
				.where(
					and(
						eq(proposalTasks.assignedTo, author.userName),
						assignedOpportunityExistsSql(proposalTasks.opportunityId, actor),
						or(
							eq(proposalTasks.status, "assigned"),
							eq(proposalTasks.status, "in_progress")
						)
					)
				);

			workloads.set(author.userId, {
				activeTasks: Number(tasks[0]?.count ?? 0),
				estimatedHours: Number(tasks[0]?.hours ?? 0),
			});
		}

		// Calculate match scores for each author
		const suggestions: AssignmentSuggestion[] = authors.map((author) => {
			const reasons: string[] = [];
			let expertiseMatch = 0;
			let availabilityMatch = 0;
			let performanceScore = 0;

			// Check expertise match
			const expertiseAreas = author.expertiseAreas as Array<{
				area: string;
				category: string;
				proficiency: string;
				yearsExperience: number;
			}> | null;

			if (expertiseAreas && Array.isArray(expertiseAreas)) {
				const relevantExpertise = expertiseAreas.find(
					(e) =>
						e.category?.toLowerCase() === task.taskType?.toLowerCase() ||
						e.category?.toLowerCase() === task.taskCategory?.toLowerCase()
				);

				if (relevantExpertise) {
					const proficiencyScore =
						relevantExpertise.proficiency === "expert" ? 100 :
							relevantExpertise.proficiency === "advanced" ? 80 :
								relevantExpertise.proficiency === "intermediate" ? 60 : 40;

					expertiseMatch = proficiencyScore;
					reasons.push(
						`${relevantExpertise.proficiency.charAt(0).toUpperCase() + relevantExpertise.proficiency.slice(1)} in ${relevantExpertise.area} (${relevantExpertise.yearsExperience} years)`
					);
				}
			}

			// Check availability
			const workload = workloads.get(author.userId);
			const availableHours = author.availableHoursPerWeek ?? 40;
			const allocatedHours = workload?.estimatedHours ?? 0;
			const utilizationRate = (allocatedHours / availableHours) * 100;

			if (utilizationRate <= 50) {
				availabilityMatch = 100;
				reasons.push("Excellent availability");
			} else if (utilizationRate <= 70) {
				availabilityMatch = 80;
				reasons.push("Good availability");
			} else if (utilizationRate <= 85) {
				availabilityMatch = 60;
				reasons.push("Moderate availability");
			} else {
				availabilityMatch = 30;
			}

			// Performance metrics
			if (author.onTimeDeliveryRate) {
				performanceScore = Math.min(100, author.onTimeDeliveryRate);
				if (author.onTimeDeliveryRate >= 90) {
					reasons.push(`High on-time delivery rate (${Math.round(author.onTimeDeliveryRate)}%)`);
				}
			}
			if (author.qualityScoreAverage && author.qualityScoreAverage >= 4) {
				performanceScore = (performanceScore + (author.qualityScoreAverage / 5) * 100) / 2;
				reasons.push(`Quality score: ${author.qualityScoreAverage.toFixed(1)}/5`);
			}
			if (author.totalTasksCompleted && author.totalTasksCompleted > 10) {
				reasons.push(`Completed ${author.totalTasksCompleted} tasks`);
			}

			// Calculate overall match score (weighted average)
			const matchScore = Math.round(
				expertiseMatch * 0.4 + availabilityMatch * 0.35 + performanceScore * 0.25
			);

			// Determine workload status
			let workloadStatus: "available" | "moderate" | "high" | "overloaded";
			if (utilizationRate <= 50) {
				workloadStatus = "available";
			} else if (utilizationRate <= 70) {
				workloadStatus = "moderate";
			} else if (utilizationRate <= 100) {
				workloadStatus = "high";
			} else {
				workloadStatus = "overloaded";
			}

			// Estimate completion date
			const estimatedDays = task.estimatedHours
				? Math.ceil((task.estimatedHours / 8) * (100 / Math.max(10, 100 - utilizationRate)))
				: 5;
			const estimatedCompletionDate = new Date(
				Date.now() + estimatedDays * 24 * 60 * 60 * 1000
			).toISOString();

			return {
				userId: author.userId,
				userName: author.userName,
				userEmail: author.userEmail ?? undefined,
				matchScore,
				reasons,
				workloadStatus,
				estimatedCompletionDate,
				expertiseMatch,
				availabilityMatch,
				performanceScore,
			};
		});

		// Sort by match score descending
		suggestions.sort((a, b) => b.matchScore - a.matchScore);

		return { success: true, data: suggestions };
	} catch (error) {
		logger.error("Failed to suggest assignments:", error);
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
		const actor = await requireTaskActor();
		let assigned = 0;
		let failed = 0;

		for (const assignment of assignments) {
			// Get user details from author expertise
			const [author] = await db
				.select()
				.from(authorExpertise)
				.where(eq(authorExpertise.userId, assignment.userId))
				.limit(1);

			const result = await updateTask(assignment.taskId, {
				assignedTo: author?.userName ?? assignment.userId,
				assignedToEmail: author?.userEmail ?? undefined,
			});

			if (result.success) {
				// Log who made the assignment
				await logTaskActivity(
					assignment.taskId,
					"bulk_assigned",
					`Bulk assigned by ${actor.userName}`,
					undefined,
					author?.userName ?? assignment.userId,
					actor.userId,
					actor.userName,
					"assignedTo"
				);
				assigned++;
			} else {
				failed++;
			}
		}

		revalidatePath("/opportunities/[id]/tasks", "page");

		return { success: true, data: { assigned, failed } };
	} catch (error) {
		logger.error("Failed to bulk assign tasks:", error);
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
		const actor = await requireTaskActor();
		// Get all tasks for the opportunity
		const tasks = await db
			.select()
			.from(proposalTasks)
			.where(
				and(
					proposalTasksByOpportunityCondition(opportunityId, actor),
					ne(proposalTasks.status, "cancelled")
				)
			)
			.orderBy(asc(proposalTasks.dueDate));

		if (tasks.length === 0) {
			return {
				success: true,
				data: {
					nodes: [],
					criticalTasks: [],
					totalDuration: 0,
					projectEndDate: new Date().toISOString(),
					bottlenecks: [],
				},
			};
		}

		// Build task graph
		const taskMap = new Map<string, ProposalTask>();
		const dependentsMap = new Map<string, string[]>();

		for (const task of tasks) {
			taskMap.set(task.id, task);
			dependentsMap.set(task.id, []);
		}

		// Build dependents (reverse dependency map)
		for (const task of tasks) {
			const dependencies = task.dependsOn as string[] | null;
			if (dependencies && Array.isArray(dependencies)) {
				for (const depId of dependencies) {
					const deps = dependentsMap.get(depId);
					if (deps) {
						deps.push(task.id);
					}
				}
			}
		}

		// Forward pass - calculate earliest start/finish times
		const earlyStart = new Map<string, number>();
		const earlyFinish = new Map<string, number>();
		const baseDate = new Date();

		// Topological sort for forward pass
		const visited = new Set<string>();
		const sorted: string[] = [];

		function visit(taskId: string) {
			if (visited.has(taskId)) return;
			visited.add(taskId);

			const task = taskMap.get(taskId);
			const dependencies = task?.dependsOn as string[] | null;
			if (dependencies && Array.isArray(dependencies)) {
				for (const depId of dependencies) {
					if (taskMap.has(depId)) {
						visit(depId);
					}
				}
			}
			sorted.push(taskId);
		}

		for (const task of tasks) {
			visit(task.id);
		}

		// Calculate early times
		for (const taskId of sorted) {
			const task = taskMap.get(taskId)!;
			const dependencies = task.dependsOn as string[] | null;
			let maxPredFinish = 0;

			if (dependencies && Array.isArray(dependencies)) {
				for (const depId of dependencies) {
					const predFinish = earlyFinish.get(depId) ?? 0;
					maxPredFinish = Math.max(maxPredFinish, predFinish);
				}
			}

			earlyStart.set(taskId, maxPredFinish);
			const duration = task.estimatedHours ?? 8;
			earlyFinish.set(taskId, maxPredFinish + duration);
		}

		// Backward pass - calculate latest start/finish times
		const lateStart = new Map<string, number>();
		const lateFinish = new Map<string, number>();

		// Find project duration (maximum early finish)
		let projectDuration = 0;
		for (const finish of earlyFinish.values()) {
			projectDuration = Math.max(projectDuration, finish);
		}

		// Process in reverse order
		for (let i = sorted.length - 1; i >= 0; i--) {
			const taskId = sorted[i];
			const task = taskMap.get(taskId)!;
			const dependents = dependentsMap.get(taskId) ?? [];

			let minSuccStart = projectDuration;
			for (const succId of dependents) {
				const succStart = lateStart.get(succId) ?? projectDuration;
				minSuccStart = Math.min(minSuccStart, succStart);
			}

			const duration = task.estimatedHours ?? 8;
			lateFinish.set(taskId, minSuccStart);
			lateStart.set(taskId, minSuccStart - duration);
		}

		// Calculate slack and identify critical path
		const nodes: CriticalPathNode[] = [];
		const criticalTasks: string[] = [];
		const bottlenecks: string[] = [];

		for (const task of tasks) {
			const es = earlyStart.get(task.id) ?? 0;
			const ls = lateStart.get(task.id) ?? 0;
			const slack = ls - es;
			const isCritical = slack === 0;

			const dependencies = task.dependsOn as string[] | null;
			const dependents = dependentsMap.get(task.id) ?? [];

			if (isCritical) {
				criticalTasks.push(task.id);
			}

			// Identify bottlenecks (critical tasks with multiple dependents)
			if (isCritical && dependents.length > 1) {
				bottlenecks.push(`${task.title} has ${dependents.length} dependent tasks and no slack`);
			}

			// Calculate due date from duration
			const dueDate = task.dueDate?.toISOString() ??
				new Date(baseDate.getTime() + (earlyFinish.get(task.id) ?? 0) * 60 * 60 * 1000).toISOString();

			nodes.push({
				taskId: task.id,
				title: task.title,
				dueDate,
				duration: task.estimatedHours ?? 8,
				slack,
				isCritical,
				dependencies: dependencies ?? [],
				dependents,
			});
		}

		// Calculate project end date
		const projectEndDate = new Date(
			baseDate.getTime() + projectDuration * 60 * 60 * 1000
		).toISOString();

		return {
			success: true,
			data: {
				nodes,
				criticalTasks,
				totalDuration: projectDuration,
				projectEndDate,
				bottlenecks,
			},
		};
	} catch (error) {
		logger.error("Failed to calculate critical path:", error);
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
		const actor = await requireTaskActor();
		// Get author details
		const [author] = await db
			.select()
			.from(authorExpertise)
			.where(eq(authorExpertise.userId, userId))
			.limit(1);

		const userName = author?.userName ?? userId;
		const availableHours = author?.availableHoursPerWeek ?? 40;

		// Get task statistics
		const allTasks = await db
			.select()
			.from(proposalTasks)
			.where(and(
				eq(proposalTasks.assignedTo, userName),
				assignedOpportunityExistsSql(proposalTasks.opportunityId, actor)
			));

		const now = new Date();
		const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

		let activeTasks = 0;
		let pendingTasks = 0;
		let totalEstimatedHours = 0;
		let totalActualHours = 0;
		let dueThisWeek = 0;
		let overdueCount = 0;
		const tasksByPriority: Record<string, number> = {};
		const tasksByType: Record<string, number> = {};
		const upcomingDeadlines: { taskId: string; title: string; dueDate: string }[] = [];

		for (const task of allTasks) {
			if (task.status === "in_progress" || task.status === "review") {
				activeTasks++;
			} else if (task.status === "pending" || task.status === "assigned") {
				pendingTasks++;
			}

			// Only count non-completed tasks for workload
			if (task.status !== "completed" && task.status !== "cancelled") {
				totalEstimatedHours += task.estimatedHours ?? 0;
				totalActualHours += task.actualHours ?? 0;

				// Check due dates
				if (task.dueDate) {
					const dueDate = new Date(task.dueDate);
					if (dueDate < now) {
						overdueCount++;
					} else if (dueDate <= oneWeekFromNow) {
						dueThisWeek++;
						upcomingDeadlines.push({
							taskId: task.id,
							title: task.title,
							dueDate: task.dueDate.toISOString(),
						});
					}
				}

				// Count by priority
				const priority = task.priority ?? "medium";
				tasksByPriority[priority] = (tasksByPriority[priority] ?? 0) + 1;

				// Count by type
				const taskType = task.taskType ?? "other";
				tasksByType[taskType] = (tasksByType[taskType] ?? 0) + 1;
			}
		}

		// Sort upcoming deadlines by date
		upcomingDeadlines.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

		// Calculate utilization rate
		const utilizationRate = availableHours > 0
			? Math.round((totalEstimatedHours / availableHours) * 100)
			: 0;

		const workloadHealth = calculateWorkloadHealth(utilizationRate);

		const summary: WorkloadSummary = {
			userId,
			userName,
			activeTasks,
			pendingTasks,
			totalEstimatedHours,
			totalActualHours,
			dueThisWeek,
			overdueCount,
			utilizationRate,
			availableHours,
			tasksByPriority,
			tasksByType,
			upcomingDeadlines: upcomingDeadlines.slice(0, 5),
			workloadHealth,
		};

		return { success: true, data: summary };
	} catch (error) {
		logger.error("Failed to get workload summary:", error);
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
		const actor = await requireTaskActor();
		// Get all unique assignees for the opportunity
		const assignees = await db
			.selectDistinct({ assignedTo: proposalTasks.assignedTo })
			.from(proposalTasks)
			.where(
				and(
					proposalTasksByOpportunityCondition(opportunityId, actor),
					sql`${proposalTasks.assignedTo} IS NOT NULL`
				)
			);

		const workloads: WorkloadSummary[] = [];

		for (const { assignedTo } of assignees) {
			if (!assignedTo) continue;

			// Find the author by name to get userId
			const [author] = await db
				.select()
				.from(authorExpertise)
				.where(eq(authorExpertise.userName, assignedTo))
				.limit(1);

			const userId = author?.userId ?? assignedTo;
			const result = await getWorkloadSummary(userId);

			if (result.success && result.data) {
				workloads.push(result.data);
			}
		}

		// Sort by utilization rate descending
		workloads.sort((a, b) => b.utilizationRate - a.utilizationRate);

		return { success: true, data: workloads };
	} catch (error) {
		logger.error("Failed to get team workload:", error);
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
		const actor = await requireTaskActor();
		// Get team workload
		const teamResult = await getTeamWorkload(opportunityId);
		if (!teamResult.success || !teamResult.data) {
			return { success: false, error: "Failed to get team workload" };
		}

		const workloads = teamResult.data;
		const reassignments: RebalanceResult["reassignments"] = [];
		const warnings: string[] = [];

		// Calculate before metrics
		const beforeUtilizations = workloads.map((w) => w.utilizationRate);
		const beforeVariance = calculateVariance(beforeUtilizations);
		const beforeMax = Math.max(...beforeUtilizations);

		// Identify overloaded and available users
		const overloaded = workloads.filter((w) => w.workloadHealth === "overloaded" || w.workloadHealth === "critical");
		const available = workloads.filter((w) => w.workloadHealth === "healthy" || w.workloadHealth === "available");

		// Suggest reassignments
		for (const overloadedUser of overloaded) {
			// Get their tasks that could be reassigned (non-critical, not in progress)
			const tasks = await db
				.select()
				.from(proposalTasks)
				.where(
					and(
						proposalTasksByOpportunityCondition(opportunityId, actor),
						eq(proposalTasks.assignedTo, overloadedUser.userName),
						or(
							eq(proposalTasks.status, "pending"),
							eq(proposalTasks.status, "assigned")
						),
						ne(proposalTasks.priority, "critical")
					)
				)
				.orderBy(asc(proposalTasks.priority))
				.limit(3);

			for (const task of tasks) {
				// Find best available user
				const bestMatch = available.find((a) =>
					a.utilizationRate < 70 &&
					a.userName !== overloadedUser.userName
				);

				if (bestMatch) {
					reassignments.push({
						taskId: task.id,
						fromUser: overloadedUser.userName,
						toUser: bestMatch.userName,
						reason: `${overloadedUser.userName} is ${overloadedUser.workloadHealth} (${overloadedUser.utilizationRate}% utilization), ${bestMatch.userName} has capacity (${bestMatch.utilizationRate}% utilization)`,
					});

					// Update simulated utilization
					const taskHours = task.estimatedHours ?? 4;
					overloadedUser.utilizationRate -= (taskHours / overloadedUser.availableHours) * 100;
					bestMatch.utilizationRate += (taskHours / bestMatch.availableHours) * 100;
				}
			}
		}

		// Calculate after metrics (simulated)
		const afterUtilizations = workloads.map((w) => w.utilizationRate);
		const afterVariance = calculateVariance(afterUtilizations);
		const afterMax = Math.max(...afterUtilizations);

		// Check for low-expertise assignments
		for (const r of reassignments) {
			const [author] = await db
				.select()
				.from(authorExpertise)
				.where(eq(authorExpertise.userName, r.toUser))
				.limit(1);

			const expertiseAreas = author?.expertiseAreas as Array<{ proficiency: string }> | null;
			const hasExpertise = expertiseAreas?.some((e) =>
				e.proficiency === "expert" || e.proficiency === "advanced"
			);

			if (!hasExpertise) {
				warnings.push(`${r.toUser} may need support with complex tasks`);
			}
		}

		const result: RebalanceResult = {
			success: true,
			reassignments,
			improvements: [
				{
					metric: "Team utilization variance",
					before: Math.round(beforeVariance),
					after: Math.round(afterVariance),
				},
				{
					metric: "Max individual utilization",
					before: Math.round(beforeMax),
					after: Math.round(afterMax),
				},
				{
					metric: "Overloaded team members",
					before: overloaded.length,
					after: workloads.filter((w) => w.utilizationRate > 100).length,
				},
			],
			warnings,
		};

		return { success: true, data: result };
	} catch (error) {
		logger.error("Failed to balance workload:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to balance workload" };
	}
}

/**
 * Calculate variance of an array of numbers.
 */
function calculateVariance(values: number[]): number {
	if (values.length === 0) return 0;
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	const squareDiffs = values.map((v) => Math.pow(v - mean, 2));
	return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
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
		const actor = await requireTaskActor();
		const bottlenecks: Bottleneck[] = [];

		// Get all non-completed tasks
		const tasks = await db
			.select()
			.from(proposalTasks)
			.where(
				and(
					proposalTasksByOpportunityCondition(opportunityId, actor),
					ne(proposalTasks.status, "completed"),
					ne(proposalTasks.status, "cancelled")
				)
			);

		// Build dependency map
		const dependentsMap = new Map<string, string[]>();
		for (const task of tasks) {
			dependentsMap.set(task.id, []);
		}

		for (const task of tasks) {
			const dependencies = task.dependsOn as string[] | null;
			if (dependencies && Array.isArray(dependencies)) {
				for (const depId of dependencies) {
					const deps = dependentsMap.get(depId);
					if (deps) {
						deps.push(task.id);
					}
				}
			}
		}

		const now = new Date();

		for (const task of tasks) {
			const dependents = dependentsMap.get(task.id) ?? [];
			const blockedTasks = dependents.length;

			// Check for blocked status
			if (task.status === "blocked") {
				const blockedReasons = task.blockedBy as string[] | null;
				const reason = blockedReasons?.[0] ?? "Blocked - reason unknown";

				bottlenecks.push({
					taskId: task.id,
					title: task.title,
					assignedTo: task.assignedTo ?? "Unassigned",
					blockedTasks,
					reason,
					severity: blockedTasks >= 3 ? "critical" : blockedTasks >= 1 ? "high" : "medium",
					suggestedAction: "Resolve blocking issue or escalate to management",
					impactDays: task.dueDate
						? Math.max(0, daysBetween(task.dueDate, now))
						: 0,
				});
			}

			// Check for overdue tasks with dependents
			if (task.dueDate && task.dueDate < now && blockedTasks > 0) {
				bottlenecks.push({
					taskId: task.id,
					title: task.title,
					assignedTo: task.assignedTo ?? "Unassigned",
					blockedTasks,
					reason: `Overdue by ${daysBetween(task.dueDate, now)} days with ${blockedTasks} dependent tasks`,
					severity: blockedTasks >= 3 ? "critical" : "high",
					suggestedAction: "Prioritize completion or reassign to available team member",
					impactDays: daysBetween(task.dueDate, now),
				});
			}

			// Check for critical path tasks at 0% progress with imminent deadline
			if (
				task.priority === "critical" &&
				(task.progress ?? 0) === 0 &&
				task.dueDate &&
				daysBetween(now, task.dueDate) <= 3
			) {
				bottlenecks.push({
					taskId: task.id,
					title: task.title,
					assignedTo: task.assignedTo ?? "Unassigned",
					blockedTasks,
					reason: "Critical task at 0% progress with deadline in 3 days or less",
					severity: "critical",
					suggestedAction: "Immediate attention required - assign additional resources",
					impactDays: Math.max(0, daysBetween(now, task.dueDate)),
				});
			}

			// Check for tasks with many dependents and no progress
			if (blockedTasks >= 2 && (task.progress ?? 0) < 25 && task.status === "in_progress") {
				bottlenecks.push({
					taskId: task.id,
					title: task.title,
					assignedTo: task.assignedTo ?? "Unassigned",
					blockedTasks,
					reason: `Blocking ${blockedTasks} tasks with only ${task.progress ?? 0}% progress`,
					severity: blockedTasks >= 3 ? "high" : "medium",
					suggestedAction: "Expedite completion to unblock dependent tasks",
					impactDays: task.dueDate
						? Math.max(0, daysBetween(now, task.dueDate))
						: 5,
				});
			}
		}

		// Sort by severity and impact
		const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
		bottlenecks.sort((a, b) => {
			const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
			if (severityDiff !== 0) return severityDiff;
			return b.impactDays - a.impactDays;
		});

		return { success: true, data: bottlenecks };
	} catch (error) {
		logger.error("Failed to detect bottlenecks:", error);
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
		const actor = await requireTaskActor();
		const now = new Date();

		// Find overdue, non-completed, non-escalated tasks
		const overdueTasks = await db
			.select()
			.from(proposalTasks)
			.where(
				and(
					proposalTasksByOpportunityCondition(opportunityId, actor),
					ne(proposalTasks.status, "completed"),
					ne(proposalTasks.status, "cancelled"),
					eq(proposalTasks.escalated, false),
					lt(proposalTasks.dueDate, now)
				)
			);

		const escalatedTaskIds: string[] = [];

		for (const task of overdueTasks) {
			// Update task as escalated
			await db
				.update(proposalTasks)
				.set({
					escalated: true,
					escalatedAt: now,
					updatedAt: now,
				})
				.where(visibleProposalTaskCondition(task.id, actor));

			// Log escalation activity
			await logTaskActivity(
				task.id,
				"escalated",
				`Task escalated due to overdue deadline (was due ${task.dueDate?.toISOString()})`,
				undefined,
				undefined,
				actor.userId,
				actor.userName,
				"escalated"
			);

			escalatedTaskIds.push(task.id);
		}

		// Also find at-risk tasks (due within 24 hours, less than 50% progress)
		const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
		const atRiskTasks = await db
			.select()
			.from(proposalTasks)
			.where(
				and(
					proposalTasksByOpportunityCondition(opportunityId, actor),
					ne(proposalTasks.status, "completed"),
					ne(proposalTasks.status, "cancelled"),
					eq(proposalTasks.escalated, false),
					gte(proposalTasks.dueDate, now),
					lte(proposalTasks.dueDate, tomorrow),
					lt(proposalTasks.progress, 50)
				)
			);

		for (const task of atRiskTasks) {
			await db
				.update(proposalTasks)
				.set({
					escalated: true,
					escalatedAt: now,
					updatedAt: now,
				})
				.where(visibleProposalTaskCondition(task.id, actor));

			await logTaskActivity(
				task.id,
				"escalated",
				`Task escalated due to deadline risk (due in 24 hours with ${task.progress ?? 0}% progress)`,
				undefined,
				undefined,
				actor.userId,
				actor.userName,
				"escalated"
			);

			escalatedTaskIds.push(task.id);
		}

		revalidatePath("/opportunities/[id]/tasks", "page");

		return {
			success: true,
			data: {
				escalated: escalatedTaskIds.length,
				tasks: escalatedTaskIds,
			},
		};
	} catch (error) {
		logger.error("Failed to escalate tasks:", error);
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
		const actor = await requireTaskActor();

		// Get all tasks for the opportunity
		const tasks = await db
			.select()
			.from(proposalTasks)
			.where(proposalTasksByOpportunityCondition(opportunityId, actor));

		const now = new Date();

		// Calculate task summary
		const taskSummary = {
			total: tasks.length,
			completed: tasks.filter((t) => t.status === "completed").length,
			inProgress: tasks.filter((t) => t.status === "in_progress" || t.status === "review").length,
			pending: tasks.filter((t) => t.status === "pending" || t.status === "assigned").length,
			blocked: tasks.filter((t) => t.status === "blocked").length,
			overdue: tasks.filter((t) =>
				t.status !== "completed" &&
				t.status !== "cancelled" &&
				t.dueDate &&
				t.dueDate < now
			).length,
		};

		// Calculate overall progress (weighted by estimated hours or equal weight)
		let overallProgress = 0;
		if (tasks.length > 0) {
			const totalWeight = tasks.reduce((sum, t) => sum + (t.estimatedHours ?? 1), 0);
			const weightedProgress = tasks.reduce((sum, t) => {
				const weight = t.estimatedHours ?? 1;
				const progress = t.status === "completed" ? 100 : (t.progress ?? 0);
				return sum + (progress * weight);
			}, 0);
			overallProgress = Math.round(weightedProgress / totalWeight);
		}

		// Calculate volume progress
		const volumeMap = new Map<string, { total: number; completed: number; progress: number }>();
		for (const task of tasks) {
			const volumeId = task.volumeId ?? "unassigned";
			const existing = volumeMap.get(volumeId) ?? { total: 0, completed: 0, progress: 0 };
			existing.total++;
			if (task.status === "completed") {
				existing.completed++;
			}
			existing.progress += task.status === "completed" ? 100 : (task.progress ?? 0);
			volumeMap.set(volumeId, existing);
		}

		const volumeProgress = Array.from(volumeMap.entries()).map(([volumeId, data]) => ({
			volumeId,
			volumeName: volumeId === "unassigned" ? "Unassigned" : `Volume ${volumeId.slice(0, 8)}`,
			progress: Math.round(data.progress / data.total),
			tasksCompleted: data.completed,
			tasksTotal: data.total,
		}));

		// Calculate team performance
		const teamMap = new Map<string, { completed: number; assigned: number; onTime: number; total: number }>();
		for (const task of tasks) {
			const userName = task.assignedTo ?? "Unassigned";
			const existing = teamMap.get(userName) ?? { completed: 0, assigned: 0, onTime: 0, total: 0 };
			existing.assigned++;
			if (task.status === "completed") {
				existing.completed++;
				// Check if completed on time
				if (task.completedAt && task.dueDate && task.completedAt <= task.dueDate) {
					existing.onTime++;
				}
				existing.total++;
			}
			teamMap.set(userName, existing);
		}

		const teamPerformance = Array.from(teamMap.entries())
			.filter(([userName]) => userName !== "Unassigned")
			.map(([userName, data]) => ({
				userId: userName,
				userName,
				tasksCompleted: data.completed,
				tasksAssigned: data.assigned,
				onTimeRate: data.total > 0 ? Math.round((data.onTime / data.total) * 100) : 100,
			}));

		// Generate timeline (last 7 days of activity)
		const timeline: ProgressReport["timeline"] = [];
		for (let i = 6; i >= 0; i--) {
			const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
			const dateStr = date.toISOString().split("T")[0];

			const completedOnDate = tasks.filter((t) =>
				t.completedAt &&
				t.completedAt.toISOString().split("T")[0] === dateStr
			).length;

			// Simulate progress (in production, use activity logs)
			const progressOnDate = Math.min(
				100,
				overallProgress - (6 - i) * Math.round(overallProgress / 14)
			);

			timeline.push({
				date: date.toISOString(),
				tasksCompleted: completedOnDate,
				progress: Math.max(0, progressOnDate),
			});
		}

		// Identify risks
		const risks: string[] = [];
		if (taskSummary.overdue > 0) {
			risks.push(`${taskSummary.overdue} task(s) are overdue`);
		}
		if (taskSummary.blocked > 0) {
			risks.push(`${taskSummary.blocked} task(s) are blocked`);
		}
		const criticalTasks = tasks.filter((t) =>
			t.priority === "critical" &&
			t.status !== "completed" &&
			(t.progress ?? 0) < 50
		);
		if (criticalTasks.length > 0) {
			risks.push(`${criticalTasks.length} critical task(s) below 50% progress`);
		}
		const overloadedTeam = teamPerformance.filter((t) =>
			teamMap.get(t.userName)!.assigned > 5
		);
		if (overloadedTeam.length > 0) {
			risks.push(`${overloadedTeam.length} team member(s) have high task load`);
		}

		// Generate recommendations
		const recommendations: string[] = [];
		if (taskSummary.blocked > 0) {
			recommendations.push("Review and resolve blocked tasks to maintain momentum");
		}
		if (criticalTasks.length > 0) {
			recommendations.push("Prioritize critical tasks and consider additional resources");
		}
		if (overloadedTeam.length > 0) {
			recommendations.push("Consider workload rebalancing across the team");
		}
		if (overallProgress < 50 && taskSummary.pending > taskSummary.inProgress) {
			recommendations.push("Start more pending tasks to improve velocity");
		}

		const report: ProgressReport = {
			opportunityId,
			opportunityName: `Opportunity ${opportunityId.slice(0, 8)}`,
			reportDate: now.toISOString(),
			overallProgress,
			taskSummary,
			volumeProgress,
			teamPerformance,
			timeline,
			risks,
			recommendations,
		};

		return { success: true, data: report };
	} catch (error) {
		logger.error("Failed to generate progress report:", error);
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
): Promise<{ success: boolean; data?: AuthorExpertiseType; error?: string }> {
	try {
		const actor = await requireTaskActor();
		ensureTaskActorMatches(actor, userId);

		// Get the author's current expertise
		const [author] = await db
			.select()
			.from(authorExpertise)
			.where(eq(authorExpertise.userId, userId))
			.limit(1);

		if (!author) {
			return { success: false, error: "Author not found" };
		}

		// Get all completed tasks for this author
		const completedTasks = await db
			.select()
			.from(proposalTasks)
			.where(
				and(
					eq(proposalTasks.assignedTo, author.userName),
					eq(proposalTasks.status, "completed"),
					assignedOpportunityExistsSql(proposalTasks.opportunityId, actor)
				)
			);

		// Calculate metrics
		let totalWordsWritten = 0;
		let totalHours = 0;
		let onTimeCount = 0;
		let totalQualityScore = 0;
		let qualityCount = 0;
		const tasksByType: Record<string, number> = {};
		const tasksByCategory: Record<string, number> = {};

		for (const task of completedTasks) {
			// Word count
			if (task.wordCountCurrent) {
				totalWordsWritten += task.wordCountCurrent;
			}

			// Hours
			if (task.actualHours) {
				totalHours += task.actualHours;
			}

			// On-time delivery
			if (task.completedAt && task.dueDate) {
				if (task.completedAt <= task.dueDate) {
					onTimeCount++;
				}
			}

			// Quality score
			if (task.qualityScore) {
				totalQualityScore += task.qualityScore;
				qualityCount++;
			}

			// Task types
			const taskType = task.taskType ?? "other";
			tasksByType[taskType] = (tasksByType[taskType] ?? 0) + 1;

			// Task categories
			if (task.taskCategory) {
				tasksByCategory[task.taskCategory] = (tasksByCategory[task.taskCategory] ?? 0) + 1;
			}
		}

		// Calculate averages
		const averageWordsPerHour = totalHours > 0
			? Math.round(totalWordsWritten / totalHours)
			: null;
		const qualityScoreAverage = qualityCount > 0
			? Math.round((totalQualityScore / qualityCount) * 10) / 10
			: null;
		const onTimeDeliveryRate = completedTasks.length > 0
			? Math.round((onTimeCount / completedTasks.length) * 100)
			: null;

		// Update author expertise
		const [updatedAuthor] = await db
			.update(authorExpertise)
			.set({
				averageWordsPerHour,
				qualityScoreAverage,
				onTimeDeliveryRate,
				totalTasksCompleted: completedTasks.length,
				totalHoursLogged: totalHours,
				tasksCompletedByType: tasksByType,
				tasksCompletedByCategory: tasksByCategory,
				updatedAt: new Date(),
			})
			.where(eq(authorExpertise.userId, userId))
			.returning();

		return { success: true, data: updatedAuthor };
	} catch (error) {
		logger.error("Failed to update author expertise:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to update author expertise" };
	}
}

/**
 * Get author expertise for a user.
 */
export async function getAuthorExpertise(
	userId: string
): Promise<{ success: boolean; data?: AuthorExpertiseType; error?: string }> {
	try {
		const actor = await requireTaskActor();
		ensureTaskActorMatches(actor, userId);
		const [author] = await db
			.select()
			.from(authorExpertise)
			.where(eq(authorExpertise.userId, userId))
			.limit(1);

		if (!author) {
			return { success: false, error: "Author not found" };
		}

		return { success: true, data: author };
	} catch (error) {
		logger.error("Failed to get author expertise:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to get author expertise" };
	}
}

/**
 * List all team members with expertise profiles.
 * Used for workload dashboards, assignment suggestions, and resource planning.
 */
export async function listTeamMembers(
	filters?: {
		availability?: string;
		expertiseArea?: string;
		limit?: number;
	}
): Promise<{ success: boolean; data?: AuthorExpertiseType[]; error?: string }> {
	try {
		await requireTaskActor();
		const conditions: ReturnType<typeof eq>[] = [];

		if (filters?.availability) {
			conditions.push(eq(authorExpertise.availability, filters.availability));
		}

		const members = await db
			.select()
			.from(authorExpertise)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(authorExpertise.totalTasksCompleted))
			.limit(filters?.limit ?? 100);

		// If expertiseArea filter is specified, filter in memory (JSONB field)
		if (filters?.expertiseArea) {
			const filtered = members.filter(m =>
				m.expertiseAreas?.some(e =>
					e.area.toLowerCase().includes(filters.expertiseArea!.toLowerCase()) ||
					e.category.toLowerCase().includes(filters.expertiseArea!.toLowerCase())
				)
			);
			return { success: true, data: filtered };
		}

		return { success: true, data: members };
	} catch (error) {
		logger.error("Failed to list team members:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to list team members" };
	}
}

// ============================================================================
// Task Activity
// ============================================================================

/**
 * Get activity history for a task.
 */
export async function getTaskActivity(
	taskId: string
): Promise<{ success: boolean; data?: TaskActivityType[]; error?: string }> {
	try {
		const actor = await requireTaskActor();
		const activities = await db
			.select()
			.from(taskActivity)
			.where(visibleTaskActivityCondition(taskId, actor))
			.orderBy(desc(taskActivity.createdAt));

		return { success: true, data: activities };
	} catch (error) {
		logger.error("Failed to get task activity:", error);
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
	notes?: string,
	userId?: string
): Promise<{ success: boolean; data?: { id: string; taskId: string; hours: number }; error?: string }> {
	try {
		const actor = await requireTaskActor();
		ensureTaskActorMatches(actor, userId);

		// Get current task
		const [task] = await db
			.select()
			.from(proposalTasks)
			.where(visibleProposalTaskCondition(taskId, actor))
			.limit(1);

		if (!task) {
			return { success: false, error: "Task not found" };
		}

		// Get current hours logged
		const currentHoursLogged = task.hoursLogged as Array<{
			date: string;
			hours: number;
			userId: string;
			notes?: string;
		}> | null ?? [];

		// Add new time entry
		const newEntry = {
			date: new Date().toISOString(),
			hours,
			userId: actor.userId,
			notes,
		};

		const updatedHoursLogged = [...currentHoursLogged, newEntry];
		const totalActualHours = updatedHoursLogged.reduce((sum, entry) => sum + entry.hours, 0);

		// Update task
		await db
			.update(proposalTasks)
			.set({
				hoursLogged: updatedHoursLogged,
				actualHours: totalActualHours,
				updatedAt: new Date(),
			})
			.where(visibleProposalTaskCondition(taskId, actor));

		// Log activity
		await logTaskActivity(
			taskId,
			"time_logged",
			`Logged ${hours} hours${notes ? `: ${notes}` : ""}`,
			String(task.actualHours ?? 0),
			String(totalActualHours),
			actor.userId,
			actor.userName,
			"actualHours"
		);

		return {
			success: true,
			data: {
				id: crypto.randomUUID(),
				taskId,
				hours,
			},
		};
	} catch (error) {
		logger.error("Failed to log time:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to log time" };
	}
}

// ============================================================================
// Opportunity Task Summary
// ============================================================================

/**
 * Update the opportunity task summary (aggregated metrics).
 */
async function updateOpportunityTaskSummary(opportunityId: string, actor: TaskActor): Promise<void> {
	try {
		const tasks = await db
			.select()
			.from(proposalTasks)
			.where(proposalTasksByOpportunityCondition(opportunityId, actor));

		const now = new Date();

		// Calculate summary metrics
		const totalTasks = tasks.length;
		const pendingTasks = tasks.filter((t) => t.status === "pending" || t.status === "assigned").length;
		const inProgressTasks = tasks.filter((t) => t.status === "in_progress" || t.status === "review").length;
		const completedTasks = tasks.filter((t) => t.status === "completed").length;
		const blockedTasks = tasks.filter((t) => t.status === "blocked").length;
		const cancelledTasks = tasks.filter((t) => t.status === "cancelled").length;

		const criticalTasks = tasks.filter((t) => t.priority === "critical" && t.status !== "completed").length;
		const highPriorityTasks = tasks.filter((t) => t.priority === "high" && t.status !== "completed").length;
		const overdueTasks = tasks.filter((t) =>
			t.status !== "completed" &&
			t.status !== "cancelled" &&
			t.dueDate &&
			t.dueDate < now
		).length;

		// Calculate overall progress
		let overallProgress = 0;
		if (totalTasks > 0) {
			const totalWeight = tasks.reduce((sum, t) => sum + (t.estimatedHours ?? 1), 0);
			const weightedProgress = tasks.reduce((sum, t) => {
				const weight = t.estimatedHours ?? 1;
				const progress = t.status === "completed" ? 100 : (t.progress ?? 0);
				return sum + (progress * weight);
			}, 0);
			overallProgress = Math.round(weightedProgress / totalWeight);
		}

		// Word counts
		const wordCountTotal = tasks.reduce((sum, t) => sum + (t.wordCountTarget ?? 0), 0);
		const wordCountCompleted = tasks.reduce((sum, t) => sum + (t.wordCountCurrent ?? 0), 0);

		// Due dates
		const dueDates = tasks
			.filter((t) => t.dueDate && t.status !== "completed" && t.status !== "cancelled")
			.map((t) => t.dueDate!)
			.sort((a, b) => a.getTime() - b.getTime());

		const earliestDueDate = dueDates[0] ?? null;
		const latestDueDate = dueDates[dueDates.length - 1] ?? null;

		// Unique assignees
		const uniqueAssignees = new Set(tasks.filter((t) => t.assignedTo).map((t) => t.assignedTo)).size;

		// Total hours
		const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
		const totalActualHours = tasks.reduce((sum, t) => sum + (t.actualHours ?? 0), 0);

		// Health status
		let healthStatus: "healthy" | "at_risk" | "critical" = "healthy";
		if (overdueTasks > 0 || criticalTasks >= 3) {
			healthStatus = "critical";
		} else if (blockedTasks > 0 || criticalTasks > 0 || highPriorityTasks >= 5) {
			healthStatus = "at_risk";
		}

		// Risk factors
		const riskFactors: string[] = [];
		if (overdueTasks > 0) riskFactors.push(`${overdueTasks} overdue tasks`);
		if (blockedTasks > 0) riskFactors.push(`${blockedTasks} blocked tasks`);
		if (criticalTasks > 0) riskFactors.push(`${criticalTasks} critical tasks pending`);

		// Upsert summary
		const existing = await db
			.select()
			.from(opportunityTaskSummary)
			.where(taskSummaryByOpportunityCondition(opportunityId, actor))
			.limit(1);

		const summaryData = {
			opportunityId,
			totalTasks,
			pendingTasks,
			inProgressTasks,
			completedTasks,
			blockedTasks,
			cancelledTasks,
			criticalTasks,
			highPriorityTasks,
			overdueTasks,
			overallProgress,
			wordCountTotal,
			wordCountCompleted,
			earliestDueDate,
			latestDueDate,
			uniqueAssignees,
			totalEstimatedHours,
			totalActualHours,
			healthStatus,
			riskFactors,
			lastCalculatedAt: now,
			updatedAt: now,
		};

		if (existing.length > 0) {
			await db
				.update(opportunityTaskSummary)
				.set(summaryData)
				.where(taskSummaryByOpportunityCondition(opportunityId, actor));
		} else {
			await db.insert(opportunityTaskSummary).values(summaryData);
		}
	} catch (error) {
		logger.error("Failed to update opportunity task summary:", error);
	}
}
