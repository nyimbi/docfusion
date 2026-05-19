"use server";

/**
 * CRM Activity Server Actions
 *
 * CRUD operations for managing activities (interactions, tasks, notes).
 * Includes timeline queries, task management, and activity statistics.
 */

import { db } from "@/lib/db";
import {
	activities,
	accounts,
	contacts,
	deals,
	crmDocuments,
} from "@/lib/db/schema-crm";
import { eq, and, or, gte, lte, ilike, inArray, desc, asc, sql, count, isNull, type SQL } from "drizzle-orm";
import type {
	ActivityFilters,
	Pagination,
	PaginatedResponse,
	CreateActivityInput,
	UpdateActivityInput,
	ActivityStats,
	ActivityType,
	ActivityStatus,
	ActivityWithRelations,
} from "@/lib/types/crm";
import type { ActivityRow, NewActivity } from "@/lib/db/schema-crm";
import { recordContactInteractionInternal } from "./contacts";
import { getCurrentUserId } from "@/lib/auth-utils";

async function requireActivityActor(): Promise<string> {
	const userId = await getCurrentUserId();
	if (!userId) {
		throw new Error("Unauthorized");
	}
	return userId;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a new activity.
 */
export async function createActivity(
	input: CreateActivityInput,
	_userId?: string
): Promise<ActivityRow> {
	const actorId = await requireActivityActor();
	const now = new Date();

	const newActivity: NewActivity = {
		accountId: input.accountId,
		contactId: input.contactId,
		dealId: input.dealId,
		opportunityId: input.opportunityId,
		type: input.type,
		subject: input.subject,
		description: input.description,
		outcome: input.outcome,
		scheduledAt: input.scheduledAt,
		completedAt: input.completedAt,
		durationMinutes: input.durationMinutes,
		direction: input.direction,
		status: input.status ?? "scheduled",
		priority: input.priority ?? "normal",
		participants: input.participants,
		followUpRequired: input.followUpRequired ?? false,
		followUpDate: input.followUpDate,
		followUpNotes: input.followUpNotes,
		attachments: input.attachments ?? [],
		externalId: input.externalId,
		source: input.source ?? "manual",
		createdBy: actorId,
		createdAt: now,
		updatedAt: now,
	};

	const [created] = await db.insert(activities).values(newActivity).returning();

	// Update last contact date on account and contact if activity is completed
	if (input.completedAt || input.status === "completed") {
		const contactDate = input.completedAt ?? now;

		if (input.accountId) {
			await db
				.update(accounts)
				.set({
					lastContactDate: contactDate,
					updatedAt: now,
				})
				.where(and(eq(accounts.id, input.accountId), eq(accounts.ownerId, actorId)));
		}

		if (input.contactId) {
			await recordContactInteractionInternal(input.contactId, contactDate);
		}
	}

	return created;
}

/**
 * Update an existing activity.
 */
export async function updateActivity(
	id: string,
	input: UpdateActivityInput,
	_userId?: string
): Promise<ActivityRow | null> {
	const actorId = await requireActivityActor();
	const existing = await db.query.activities.findFirst({
		where: and(eq(activities.id, id), eq(activities.createdBy, actorId)),
	});

	if (!existing) {
		return null;
	}

	const now = new Date();

	const [updated] = await db
		.update(activities)
		.set({
			...input,
			updatedAt: now,
		})
		.where(and(eq(activities.id, id), eq(activities.createdBy, actorId)))
		.returning();

	// Update last contact date if activity was just completed
	if (
		input.status === "completed" &&
		existing.status !== "completed" &&
		(updated.accountId || updated.contactId)
	) {
		const contactDate = input.completedAt ?? now;

		if (updated.accountId) {
			await db
				.update(accounts)
				.set({
					lastContactDate: contactDate,
					updatedAt: now,
				})
				.where(and(eq(accounts.id, updated.accountId), eq(accounts.ownerId, actorId)));
		}

		if (updated.contactId) {
			await recordContactInteractionInternal(updated.contactId, contactDate);
		}
	}

	return updated;
}

/**
 * Delete an activity.
 */
export async function deleteActivity(id: string): Promise<boolean> {
	const actorId = await requireActivityActor();
	const result = await db
		.delete(activities)
		.where(and(eq(activities.id, id), eq(activities.createdBy, actorId)));
	return (result.rowCount ?? 0) > 0;
}

/**
 * Get a single activity by ID.
 */
export async function getActivity(id: string): Promise<ActivityRow | null> {
	const activity = await db.query.activities.findFirst({
		where: eq(activities.id, id),
	});
	return activity ?? null;
}

/**
 * Get activity with related entities.
 */
export async function getActivityWithRelations(
	id: string
): Promise<ActivityWithRelations | null> {
	const activity = await db.query.activities.findFirst({
		where: eq(activities.id, id),
		with: {
			account: true,
			contact: true,
			deal: true,
			documents: {
				limit: 20,
				orderBy: desc(crmDocuments.createdAt),
			},
		},
	});

	return activity ?? null;
}

/**
 * Get all activities with optional filtering and pagination.
 */
export async function getActivities(
	filters?: ActivityFilters,
	pagination?: Pagination
): Promise<PaginatedResponse<ActivityRow>> {
	const conditions = buildActivityFilterConditions(filters);

	// Get total count
	const [{ total }] = await db
		.select({ total: count() })
		.from(activities)
		.where(conditions.length > 0 ? and(...conditions) : undefined);

	// Get paginated results
	const page = pagination?.page ?? 1;
	const pageSize = pagination?.pageSize ?? 50;
	const offset = (page - 1) * pageSize;

	const results = await db.query.activities.findMany({
		where: conditions.length > 0 ? and(...conditions) : undefined,
		orderBy: [desc(activities.scheduledAt), desc(activities.createdAt)],
		limit: pageSize,
		offset,
	});

	const totalPages = Math.ceil(total / pageSize);

	return {
		data: results,
		total,
		page,
		pageSize,
		totalPages,
		hasNext: page < totalPages,
		hasPrevious: page > 1,
	};
}

// ============================================================================
// TIMELINE QUERIES
// ============================================================================

/**
 * Get activity timeline for an account.
 */
export async function getAccountTimeline(
	accountId: string,
	filters?: ActivityFilters,
	pagination?: Pagination
): Promise<PaginatedResponse<ActivityRow>> {
	const conditions = [
		eq(activities.accountId, accountId),
		...buildActivityFilterConditions(filters),
	];

	// Get total count
	const [{ total }] = await db
		.select({ total: count() })
		.from(activities)
		.where(and(...conditions));

	// Get paginated results
	const page = pagination?.page ?? 1;
	const pageSize = pagination?.pageSize ?? 25;
	const offset = (page - 1) * pageSize;

	const results = await db
		.select()
		.from(activities)
		.where(and(...conditions))
		.orderBy(desc(activities.createdAt))
		.limit(pageSize)
		.offset(offset);

	const totalPages = Math.ceil(total / pageSize);

	return {
		data: results,
		total,
		page,
		pageSize,
		totalPages,
		hasNext: page < totalPages,
		hasPrevious: page > 1,
	};
}

/**
 * Get activity timeline for a contact.
 */
export async function getContactTimeline(
	contactId: string,
	filters?: ActivityFilters,
	pagination?: Pagination
): Promise<PaginatedResponse<ActivityRow>> {
	const conditions = [
		eq(activities.contactId, contactId),
		...buildActivityFilterConditions(filters),
	];

	const [{ total }] = await db
		.select({ total: count() })
		.from(activities)
		.where(and(...conditions));

	const page = pagination?.page ?? 1;
	const pageSize = pagination?.pageSize ?? 25;
	const offset = (page - 1) * pageSize;

	const results = await db
		.select()
		.from(activities)
		.where(and(...conditions))
		.orderBy(desc(activities.createdAt))
		.limit(pageSize)
		.offset(offset);

	const totalPages = Math.ceil(total / pageSize);

	return {
		data: results,
		total,
		page,
		pageSize,
		totalPages,
		hasNext: page < totalPages,
		hasPrevious: page > 1,
	};
}

/**
 * Get activity timeline for a deal.
 */
export async function getDealTimeline(
	dealId: string,
	filters?: ActivityFilters,
	pagination?: Pagination
): Promise<PaginatedResponse<ActivityRow>> {
	const conditions = [
		eq(activities.dealId, dealId),
		...buildActivityFilterConditions(filters),
	];

	const [{ total }] = await db
		.select({ total: count() })
		.from(activities)
		.where(and(...conditions));

	const page = pagination?.page ?? 1;
	const pageSize = pagination?.pageSize ?? 25;
	const offset = (page - 1) * pageSize;

	const results = await db
		.select()
		.from(activities)
		.where(and(...conditions))
		.orderBy(desc(activities.createdAt))
		.limit(pageSize)
		.offset(offset);

	const totalPages = Math.ceil(total / pageSize);

	return {
		data: results,
		total,
		page,
		pageSize,
		totalPages,
		hasNext: page < totalPages,
		hasPrevious: page > 1,
	};
}

// ============================================================================
// TASK MANAGEMENT
// ============================================================================

/**
 * Get upcoming tasks.
 */
export async function getUpcomingTasks(
	userId?: string,
	days = 7
): Promise<ActivityRow[]> {
	const now = new Date();
	const futureDate = new Date();
	futureDate.setDate(futureDate.getDate() + days);

	const conditions = [
		eq(activities.type, "task"),
		inArray(activities.status, ["scheduled"]),
		gte(activities.scheduledAt, now),
		lte(activities.scheduledAt, futureDate),
	];

	if (userId) {
		conditions.push(eq(activities.createdBy, userId));
	}

	return db.query.activities.findMany({
		where: and(...conditions),
		orderBy: asc(activities.scheduledAt),
		limit: 50,
	});
}

/**
 * Get overdue tasks.
 */
export async function getOverdueTasks(userId?: string): Promise<ActivityRow[]> {
	const now = new Date();

	const conditions = [
		eq(activities.type, "task"),
		inArray(activities.status, ["scheduled"]),
		lte(activities.scheduledAt, now),
	];

	if (userId) {
		conditions.push(eq(activities.createdBy, userId));
	}

	return db.query.activities.findMany({
		where: and(...conditions),
		orderBy: asc(activities.scheduledAt),
		limit: 50,
	});
}

/**
 * Get activities requiring follow-up.
 */
export async function getActivitiesNeedingFollowup(
	userId?: string,
	daysOverdue = 0
): Promise<ActivityRow[]> {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

	const conditions = [
		eq(activities.followUpRequired, true),
		lte(activities.followUpDate, cutoffDate),
		or(
			isNull(activities.status),
			inArray(activities.status, ["scheduled", "completed"])
		),
	];

	if (userId) {
		conditions.push(eq(activities.createdBy, userId));
	}

	return db.query.activities.findMany({
		where: and(...conditions),
		orderBy: asc(activities.followUpDate),
		limit: 50,
	});
}

/**
 * Complete a task/activity.
 */
export async function completeActivity(
	id: string,
	outcome?: string,
	_userId?: string
): Promise<ActivityRow | null> {
	const actorId = await requireActivityActor();
	const now = new Date();

	const existing = await db.query.activities.findFirst({
		where: and(eq(activities.id, id), eq(activities.createdBy, actorId)),
	});

	if (!existing) {
		return null;
	}

	const [updated] = await db
		.update(activities)
		.set({
			status: "completed",
			completedAt: now,
			outcome: outcome ?? existing.outcome,
			updatedAt: now,
		})
		.where(and(eq(activities.id, id), eq(activities.createdBy, actorId)))
		.returning();

	// Update last contact date on related entities
	if (updated.accountId) {
		await db
			.update(accounts)
			.set({
				lastContactDate: now,
				updatedAt: now,
			})
			.where(and(eq(accounts.id, updated.accountId), eq(accounts.ownerId, actorId)));
	}

	if (updated.contactId) {
		await recordContactInteractionInternal(updated.contactId, now);
	}

	return updated;
}

/**
 * Reschedule an activity.
 */
export async function rescheduleActivity(
	id: string,
	newScheduledAt: Date,
	reason?: string,
	_userId?: string
): Promise<ActivityRow | null> {
	const actorId = await requireActivityActor();
	const existing = await db.query.activities.findFirst({
		where: and(eq(activities.id, id), eq(activities.createdBy, actorId)),
	});

	if (!existing) {
		return null;
	}

	const now = new Date();
	const description = reason
		? `${existing.description ?? ""}\n\n[Rescheduled: ${reason}]`
		: existing.description;

	const [updated] = await db
		.update(activities)
		.set({
			scheduledAt: newScheduledAt,
			status: "rescheduled",
			description,
			updatedAt: now,
		})
		.where(and(eq(activities.id, id), eq(activities.createdBy, actorId)))
		.returning();

	return updated;
}

/**
 * Cancel an activity.
 */
export async function cancelActivity(
	id: string,
	reason?: string,
	_userId?: string
): Promise<ActivityRow | null> {
	const actorId = await requireActivityActor();
	const existing = await db.query.activities.findFirst({
		where: and(eq(activities.id, id), eq(activities.createdBy, actorId)),
	});

	if (!existing) {
		return null;
	}

	const now = new Date();
	const description = reason
		? `${existing.description ?? ""}\n\n[Cancelled: ${reason}]`
		: existing.description;

	const [updated] = await db
		.update(activities)
		.set({
			status: "cancelled",
			description,
			updatedAt: now,
		})
		.where(and(eq(activities.id, id), eq(activities.createdBy, actorId)))
		.returning();

	return updated;
}

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get activity statistics.
 */
export async function getActivityStats(
	filters?: ActivityFilters
): Promise<ActivityStats> {
	const conditions = buildActivityFilterConditions(filters);

	// Get total count
	const [{ total }] = await db
		.select({ total: count() })
		.from(activities)
		.where(conditions.length > 0 ? and(...conditions) : undefined);

	// Get counts by type
	const typeCounts = await db
		.select({
			type: activities.type,
			count: count(),
		})
		.from(activities)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.groupBy(activities.type);

	const byType: Record<ActivityType, number> = {} as Record<ActivityType, number>;
	for (const row of typeCounts) {
		byType[row.type as ActivityType] = row.count;
	}

	// Get counts by status
	const statusCounts = await db
		.select({
			status: activities.status,
			count: count(),
		})
		.from(activities)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.groupBy(activities.status);

	const byStatus: Record<ActivityStatus, number> = {} as Record<ActivityStatus, number>;
	for (const row of statusCounts) {
		if (row.status) byStatus[row.status as ActivityStatus] = row.count;
	}

	// Get completed this period (last 30 days)
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const [{ completedThisPeriod }] = await db
		.select({ completedThisPeriod: count() })
		.from(activities)
		.where(
			and(
				eq(activities.status, "completed"),
				gte(activities.completedAt, thirtyDaysAgo),
				...(conditions.length > 0 ? conditions : [])
			)
		);

	// Get overdue count
	const now = new Date();
	const [{ overdueCount }] = await db
		.select({ overdueCount: count() })
		.from(activities)
		.where(
			and(
				inArray(activities.status, ["scheduled"]),
				lte(activities.scheduledAt, now),
				...(conditions.length > 0 ? conditions : [])
			)
		);

	// Get upcoming count (next 7 days)
	const sevenDaysFromNow = new Date();
	sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

	const [{ upcomingCount }] = await db
		.select({ upcomingCount: count() })
		.from(activities)
		.where(
			and(
				inArray(activities.status, ["scheduled"]),
				gte(activities.scheduledAt, now),
				lte(activities.scheduledAt, sevenDaysFromNow),
				...(conditions.length > 0 ? conditions : [])
			)
		);

	return {
		total,
		byType,
		byStatus,
		completedThisPeriod,
		overdueCount,
		upcomingCount,
	};
}

/**
 * Get activity count by user for leaderboard.
 */
export async function getActivityCountsByUser(
	startDate?: Date,
	endDate?: Date
): Promise<{ userId: string; count: number; completedCount: number }[]> {
	const conditions = [];

	if (startDate) {
		conditions.push(gte(activities.createdAt, startDate));
	}
	if (endDate) {
		conditions.push(lte(activities.createdAt, endDate));
	}

	const results = await db
		.select({
			userId: activities.createdBy,
			count: count(),
			completedCount: sql<number>`SUM(CASE WHEN ${activities.status} = 'completed' THEN 1 ELSE 0 END)`,
		})
		.from(activities)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.groupBy(activities.createdBy)
		.orderBy(desc(sql`count`));

	return results
		.filter((r) => r.userId !== null)
		.map((r) => ({
			userId: r.userId!,
			count: r.count,
			completedCount: Number(r.completedCount),
		}));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build filter conditions for activity queries.
 */
function buildActivityFilterConditions(filters?: ActivityFilters) {
	const conditions: SQL<unknown>[] = [];

	if (!filters) return conditions;

	// Entity filters
	if (filters.accountId) {
		conditions.push(eq(activities.accountId, filters.accountId));
	}
	if (filters.contactId) {
		conditions.push(eq(activities.contactId, filters.contactId));
	}
	if (filters.dealId) {
		conditions.push(eq(activities.dealId, filters.dealId));
	}
	if (filters.opportunityId) {
		conditions.push(eq(activities.opportunityId, filters.opportunityId));
	}

	// Type filter
	if (filters.type) {
		if (Array.isArray(filters.type)) {
			conditions.push(inArray(activities.type, filters.type));
		} else {
			conditions.push(eq(activities.type, filters.type));
		}
	}

	// Status filter
	if (filters.status) {
		if (Array.isArray(filters.status)) {
			conditions.push(inArray(activities.status, filters.status));
		} else {
			conditions.push(eq(activities.status, filters.status));
		}
	}

	// Direction filter
	if (filters.direction) {
		if (Array.isArray(filters.direction)) {
			conditions.push(inArray(activities.direction, filters.direction));
		} else {
			conditions.push(eq(activities.direction, filters.direction));
		}
	}

	// Priority filter
	if (filters.priority) {
		if (Array.isArray(filters.priority)) {
			conditions.push(inArray(activities.priority, filters.priority));
		} else {
			conditions.push(eq(activities.priority, filters.priority));
		}
	}

	// Follow-up filter
	if (filters.followUpRequired !== undefined) {
		conditions.push(eq(activities.followUpRequired, filters.followUpRequired));
	}

	// Date filters
	if (filters.scheduledBefore) {
		conditions.push(lte(activities.scheduledAt, filters.scheduledBefore));
	}
	if (filters.scheduledAfter) {
		conditions.push(gte(activities.scheduledAt, filters.scheduledAfter));
	}
	if (filters.completedBefore) {
		conditions.push(lte(activities.completedAt, filters.completedBefore));
	}
	if (filters.completedAfter) {
		conditions.push(gte(activities.completedAt, filters.completedAfter));
	}

	// Creator filter
	if (filters.createdBy) {
		conditions.push(eq(activities.createdBy, filters.createdBy));
	}

	return conditions;
}

/**
 * Log a quick note as an activity.
 */
export async function logNote(
	input: {
		accountId?: string;
		contactId?: string;
		dealId?: string;
		content: string;
	},
	userId?: string
): Promise<ActivityRow> {
	return createActivity(
		{
			accountId: input.accountId,
			contactId: input.contactId,
			dealId: input.dealId,
			type: "note",
			subject: input.content.substring(0, 100) + (input.content.length > 100 ? "..." : ""),
			description: input.content,
			status: "completed",
			completedAt: new Date(),
		},
		userId
	);
}

/**
 * Log an email activity.
 */
export async function logEmail(
	input: {
		accountId?: string;
		contactId?: string;
		dealId?: string;
		subject: string;
		content?: string;
		direction: "inbound" | "outbound";
		externalId?: string;
	},
	userId?: string
): Promise<ActivityRow> {
	return createActivity(
		{
			accountId: input.accountId,
			contactId: input.contactId,
			dealId: input.dealId,
			type: "email",
			subject: input.subject,
			description: input.content,
			direction: input.direction,
			status: "completed",
			completedAt: new Date(),
			externalId: input.externalId,
			source: input.externalId ? "email_sync" : "manual",
		},
		userId
	);
}

/**
 * Log a call activity.
 */
export async function logCall(
	input: {
		accountId?: string;
		contactId?: string;
		dealId?: string;
		subject: string;
		outcome?: string;
		durationMinutes?: number;
		direction: "inbound" | "outbound";
	},
	userId?: string
): Promise<ActivityRow> {
	return createActivity(
		{
			accountId: input.accountId,
			contactId: input.contactId,
			dealId: input.dealId,
			type: "call",
			subject: input.subject,
			outcome: input.outcome,
			durationMinutes: input.durationMinutes,
			direction: input.direction,
			status: "completed",
			completedAt: new Date(),
		},
		userId
	);
}

/**
 * Schedule a meeting activity.
 */
export async function scheduleMeeting(
	input: {
		accountId?: string;
		contactId?: string;
		dealId?: string;
		subject: string;
		description?: string;
		scheduledAt: Date;
		durationMinutes?: number;
		participants?: { internal: string[]; external: string[] };
	},
	userId?: string
): Promise<ActivityRow> {
	return createActivity(
		{
			accountId: input.accountId,
			contactId: input.contactId,
			dealId: input.dealId,
			type: "meeting",
			subject: input.subject,
			description: input.description,
			scheduledAt: input.scheduledAt,
			durationMinutes: input.durationMinutes ?? 60,
			participants: input.participants,
			status: "scheduled",
		},
		userId
	);
}

/**
 * Create a task.
 */
export async function createTask(
	input: {
		accountId?: string;
		contactId?: string;
		dealId?: string;
		subject: string;
		description?: string;
		dueDate: Date;
		priority?: "low" | "normal" | "high" | "urgent";
	},
	userId?: string
): Promise<ActivityRow> {
	return createActivity(
		{
			accountId: input.accountId,
			contactId: input.contactId,
			dealId: input.dealId,
			type: "task",
			subject: input.subject,
			description: input.description,
			scheduledAt: input.dueDate,
			priority: input.priority ?? "normal",
			status: "scheduled",
		},
		userId
	);
}
