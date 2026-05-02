"use server";

import { db } from "@/lib/db";
import {
	workflowAuditEvents,
	workflowInstances,
	workflowNotifications,
	workflowRuntimeTasks,
	type WorkflowInstanceRow,
} from "@/lib/db/schema-workflow-runtime";
import { and, asc, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";

type WorkflowClient = Pick<typeof db, "select" | "insert" | "update" | "execute">;

export type WorkflowRuntimeStatus =
	| "active"
	| "waiting"
	| "breached"
	| "escalated"
	| "completed"
	| "cancelled";

export interface WorkflowAuthorityPolicy {
	requiredRoles?: string[];
	allowedActorIds?: string[];
	minApprovers?: number;
	escalationRole?: string;
}

export interface WorkflowPortalVisibility {
	visibleToPortal: boolean;
	portalRole?: string;
	summary?: string;
	actionLabel?: string;
	actionUrl?: string;
}

export interface WorkflowRuntimeTransitionInput {
	workflowKey: string;
	subjectType: string;
	subjectId: string;
	opportunityId?: string | null;
	fromState?: string | null;
	toState: string;
	eventType?: string;
	actorId: string;
	actorName?: string;
	reason?: string;
	evidenceLinks?: string[];
	priority?: "critical" | "high" | "medium" | "low";
	assignedTo?: string | null;
	assignedRole?: string | null;
	assignedBy?: string | null;
	dueAt?: Date | string | null;
	escalatedTo?: string | null;
	visibility?: "internal" | "portal" | "external";
	portalVisibility?: WorkflowPortalVisibility;
	authorityPolicy?: WorkflowAuthorityPolicy;
	metadata?: Record<string, unknown>;
	terminal?: boolean;
	notificationRecipients?: string[];
	actionUrl?: string;
}

export interface WorkflowRuntimeTaskInput {
	workflowInstanceId: string;
	taskKey: string;
	title: string;
	description?: string;
	state?: "open" | "in_progress" | "blocked" | "completed" | "cancelled";
	priority?: "critical" | "high" | "medium" | "low";
	assignedTo?: string | null;
	assignedRole?: string | null;
	dueAt?: Date | string | null;
	metadata?: Record<string, unknown>;
}

export interface WorkflowDashboardFilters {
	statuses?: WorkflowRuntimeStatus[];
	subjectTypes?: string[];
	assignedTo?: string;
	opportunityId?: string;
	limit?: number;
}

export interface WorkflowDashboardSummary {
	total: number;
	active: number;
	breached: number;
	escalated: number;
	completed: number;
	bySubjectType: Record<string, number>;
	dueSoon: WorkflowInstanceRow[];
	items: WorkflowInstanceRow[];
}

const TERMINAL_STATES = new Set([
	"accepted",
	"approved",
	"completed",
	"cancelled",
	"rejected",
	"submitted",
	"resolved",
	"failed_terminal",
	"locked",
]);

export async function recordWorkflowRuntimeTransition(
	input: WorkflowRuntimeTransitionInput,
	client: WorkflowClient = db
): Promise<WorkflowInstanceRow> {
	const now = new Date();
	const reason = input.reason?.trim();
	const dueAt = normalizeDate(input.dueAt);
	const isTerminal = input.terminal ?? TERMINAL_STATES.has(input.toState);
	const existing = await findWorkflowInstance(input, client);
	const status = deriveRuntimeStatus({
		current: existing?.status as WorkflowRuntimeStatus | undefined,
		dueAt,
		isTerminal,
		escalatedTo: input.escalatedTo,
		now,
	});
	const assignedTo = input.assignedTo === undefined ? existing?.assignedTo ?? null : input.assignedTo;
	const assignedRole = input.assignedRole === undefined ? existing?.assignedRole ?? null : input.assignedRole;
	const assignedAt = input.assignedTo && input.assignedTo !== existing?.assignedTo
		? now
		: existing?.assignedAt ?? null;
	const slaBreachedAt = status === "breached" && !existing?.slaBreachedAt
		? now
		: existing?.slaBreachedAt ?? null;
	const escalatedAt = input.escalatedTo && input.escalatedTo !== existing?.escalatedTo
		? now
		: existing?.escalatedAt ?? null;
	const mergedMetadata = {
		...(isRecord(existing?.metadata) ? existing?.metadata : {}),
		...(input.metadata ?? {}),
		lastEventType: input.eventType ?? "transition",
		lastReason: reason ?? null,
	};

	const patch = {
		opportunityId: input.opportunityId ?? existing?.opportunityId ?? null,
		status,
		state: input.toState,
		priority: input.priority ?? existing?.priority ?? "medium",
		assignedTo,
		assignedRole,
		assignedBy: input.assignedBy ?? input.actorId,
		assignedAt,
		dueAt: dueAt ?? existing?.dueAt ?? null,
		slaBreachedAt,
		escalatedTo: input.escalatedTo ?? existing?.escalatedTo ?? null,
		escalatedAt,
		visibility: input.visibility ?? existing?.visibility ?? "internal",
		portalVisibility: input.portalVisibility ?? existing?.portalVisibility ?? null,
		authorityPolicy: input.authorityPolicy ?? existing?.authorityPolicy ?? null,
		metadata: mergedMetadata,
		updatedAt: now,
		completedAt: isTerminal ? now : null,
	};

	const [instance] = existing
		? await client
			.update(workflowInstances)
			.set(patch)
			.where(eq(workflowInstances.id, existing.id))
			.returning()
		: await client
			.insert(workflowInstances)
			.values({
				workflowKey: input.workflowKey,
				subjectType: input.subjectType,
				subjectId: input.subjectId,
				...patch,
				createdBy: input.actorId,
			})
			.returning();

	if (!instance) {
		throw new Error("Failed to persist workflow instance");
	}

	await client.insert(workflowAuditEvents).values({
		workflowInstanceId: instance.id,
		subjectType: input.subjectType,
		subjectId: input.subjectId,
		eventType: input.eventType ?? "transition",
		fromState: input.fromState ?? existing?.state ?? null,
		toState: input.toState,
		actorId: input.actorId,
		actorName: input.actorName ?? input.actorId,
		reason: reason ?? null,
		evidenceLinks: input.evidenceLinks ?? [],
		metadata: input.metadata ?? {},
	});

	await enqueueWorkflowNotifications({
		instanceId: instance.id,
		recipients: input.notificationRecipients ?? [],
		eventType: input.eventType ?? "transition",
		actionUrl: input.actionUrl ?? input.portalVisibility?.actionUrl,
		metadata: {
			subjectType: input.subjectType,
			subjectId: input.subjectId,
			state: input.toState,
		},
	}, client);

	return instance;
}

export async function upsertWorkflowRuntimeTask(
	input: WorkflowRuntimeTaskInput,
	client: WorkflowClient = db
) {
	const now = new Date();
	const existing = await client
		.select()
		.from(workflowRuntimeTasks)
		.where(and(
			eq(workflowRuntimeTasks.workflowInstanceId, input.workflowInstanceId),
			eq(workflowRuntimeTasks.taskKey, input.taskKey)
		))
		.limit(1);
	const row = existing[0];
	const completedAt = input.state === "completed" ? now : row?.completedAt ?? null;
	const patch = {
		title: input.title,
		description: input.description ?? row?.description ?? null,
		state: input.state ?? row?.state ?? "open",
		priority: input.priority ?? row?.priority ?? "medium",
		assignedTo: input.assignedTo === undefined ? row?.assignedTo ?? null : input.assignedTo,
		assignedRole: input.assignedRole === undefined ? row?.assignedRole ?? null : input.assignedRole,
		dueAt: normalizeDate(input.dueAt) ?? row?.dueAt ?? null,
		completedAt,
		metadata: {
			...(isRecord(row?.metadata) ? row.metadata : {}),
			...(input.metadata ?? {}),
		},
		updatedAt: now,
	};

	const [task] = row
		? await client
			.update(workflowRuntimeTasks)
			.set(patch)
			.where(eq(workflowRuntimeTasks.id, row.id))
			.returning()
		: await client
			.insert(workflowRuntimeTasks)
			.values({
				workflowInstanceId: input.workflowInstanceId,
				taskKey: input.taskKey,
				...patch,
			})
			.returning();

	return task;
}

export async function evaluateWorkflowSla(
	options: { now?: Date; escalationRecipient?: string; limit?: number } = {}
): Promise<{ breached: number; escalated: number }> {
	const now = options.now ?? new Date();
	const rows = await db
		.select()
		.from(workflowInstances)
		.where(and(
			inArray(workflowInstances.status, ["active", "waiting", "breached"]),
			isNotNull(workflowInstances.dueAt),
			lt(workflowInstances.dueAt, now)
		))
		.orderBy(asc(workflowInstances.dueAt))
		.limit(options.limit ?? 100);

	let breached = 0;
	let escalated = 0;
	for (const row of rows) {
		const escalationRecipient = options.escalationRecipient
			?? row.escalatedTo
			?? getEscalationRole(row.authorityPolicy);
		const status = escalationRecipient ? "escalated" : "breached";
		await db
			.update(workflowInstances)
			.set({
				status,
				slaBreachedAt: row.slaBreachedAt ?? now,
				escalatedTo: escalationRecipient ?? row.escalatedTo,
				escalatedAt: escalationRecipient ? row.escalatedAt ?? now : row.escalatedAt,
				updatedAt: now,
			})
			.where(eq(workflowInstances.id, row.id));
		await db.insert(workflowAuditEvents).values({
			workflowInstanceId: row.id,
			subjectType: row.subjectType,
			subjectId: row.subjectId,
			eventType: status === "escalated" ? "sla_escalated" : "sla_breached",
			fromState: row.state,
			toState: row.state,
			actorId: "system",
			actorName: "System",
			reason: `Workflow SLA breached at ${now.toISOString()}`,
			metadata: { dueAt: row.dueAt?.toISOString?.() ?? row.dueAt },
		});
		breached += 1;
		if (status === "escalated") escalated += 1;
	}

	return { breached, escalated };
}

export async function getWorkflowDashboard(
	filters: WorkflowDashboardFilters = {}
): Promise<WorkflowDashboardSummary> {
	const conditions = [];
	if (filters.statuses?.length) {
		conditions.push(inArray(workflowInstances.status, filters.statuses));
	}
	if (filters.subjectTypes?.length) {
		conditions.push(inArray(workflowInstances.subjectType, filters.subjectTypes));
	}
	if (filters.assignedTo) {
		conditions.push(eq(workflowInstances.assignedTo, filters.assignedTo));
	}
	if (filters.opportunityId) {
		conditions.push(eq(workflowInstances.opportunityId, filters.opportunityId));
	}

	const query = db
		.select()
		.from(workflowInstances)
		.where(conditions.length ? and(...conditions) : sql`true`)
		.orderBy(desc(workflowInstances.updatedAt))
		.limit(filters.limit ?? 100);
	const items = await query;
	const dueSoonThreshold = Date.now() + 48 * 60 * 60 * 1000;

	return {
		total: items.length,
		active: items.filter((item) => item.status === "active" || item.status === "waiting").length,
		breached: items.filter((item) => item.status === "breached").length,
		escalated: items.filter((item) => item.status === "escalated").length,
		completed: items.filter((item) => item.status === "completed").length,
		bySubjectType: items.reduce<Record<string, number>>((acc, item) => {
			acc[item.subjectType] = (acc[item.subjectType] ?? 0) + 1;
			return acc;
		}, {}),
		dueSoon: items.filter((item) => {
			if (!item.dueAt) return false;
			const time = new Date(item.dueAt).getTime();
			return time <= dueSoonThreshold && time >= Date.now() && item.status !== "completed";
		}),
		items,
	};
}

export async function listPortalWorkflowItems(
	options: { portalRole?: string; limit?: number } = {}
): Promise<WorkflowInstanceRow[]> {
	const rows = await db
		.select()
		.from(workflowInstances)
		.where(inArray(workflowInstances.visibility, ["portal", "external"]))
		.orderBy(asc(workflowInstances.dueAt), desc(workflowInstances.updatedAt))
		.limit(options.limit ?? 50);

	if (!options.portalRole) return rows;

	return rows.filter((row) => {
		const visibility = row.portalVisibility;
		return visibility?.visibleToPortal !== false
			&& (!visibility?.portalRole || visibility.portalRole === options.portalRole);
	});
}

export async function assertWorkflowAuthority(input: {
	actorId: string;
	actorRoles?: string[];
	policy?: WorkflowAuthorityPolicy | null;
	action?: string;
}): Promise<void> {
	const policy = input.policy;
	if (!policy) return;

	if (policy.allowedActorIds?.includes(input.actorId)) return;

	const actorRoles = new Set(input.actorRoles ?? []);
	const hasRole = (policy.requiredRoles ?? []).some((role) => actorRoles.has(role));
	if (policy.requiredRoles?.length && !hasRole) {
		throw new Error(`Workflow authority denied${input.action ? ` for ${input.action}` : ""}: requires ${policy.requiredRoles.join(" or ")}`);
	}
}

async function findWorkflowInstance(
	input: Pick<WorkflowRuntimeTransitionInput, "workflowKey" | "subjectType" | "subjectId">,
	client: WorkflowClient
): Promise<WorkflowInstanceRow | undefined> {
	const rows = await client
		.select()
		.from(workflowInstances)
		.where(and(
			eq(workflowInstances.workflowKey, input.workflowKey),
			eq(workflowInstances.subjectType, input.subjectType),
			eq(workflowInstances.subjectId, input.subjectId)
		))
		.limit(1);
	return rows[0] as WorkflowInstanceRow | undefined;
}

async function enqueueWorkflowNotifications(
	input: {
		instanceId: string;
		recipients: string[];
		eventType: string;
		actionUrl?: string;
		metadata: Record<string, unknown>;
	},
	client: WorkflowClient
) {
	if (input.recipients.length === 0) return;
	await client.insert(workflowNotifications).values(input.recipients.map((recipientId) => ({
		workflowInstanceId: input.instanceId,
		recipientId,
		eventType: input.eventType,
		actionUrl: input.actionUrl ?? null,
		metadata: input.metadata,
	})));
}

function deriveRuntimeStatus(input: {
	current?: WorkflowRuntimeStatus;
	dueAt?: Date | null;
	isTerminal: boolean;
	escalatedTo?: string | null;
	now: Date;
}): WorkflowRuntimeStatus {
	if (input.isTerminal) return "completed";
	if (input.escalatedTo) return "escalated";
	if (input.dueAt && input.dueAt.getTime() < input.now.getTime()) return "breached";
	return input.current === "escalated" ? "escalated" : "active";
}

function normalizeDate(value: Date | string | null | undefined): Date | null {
	if (!value) return null;
	if (value instanceof Date) return value;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function getEscalationRole(policy: unknown): string | null {
	if (!isRecord(policy)) return null;
	const role = policy.escalationRole;
	return typeof role === "string" && role.trim() ? role : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
