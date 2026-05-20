import net from "node:net";
import tls from "node:tls";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";
import {
	workflowAuditEvents,
	workflowInstances,
	workflowNotifications,
	workflowRuntimeTasks,
	workflowTemplates,
	type WorkflowInstanceRow,
	type WorkflowNotificationRow,
	type WorkflowTemplateRow,
} from "@/lib/db/schema-workflow-runtime";
import { opportunities } from "@/lib/db/schema";
import { WorkflowAuthorityDeniedError } from "@/lib/workflows/authority-error";
import { simulateWorkflowTemplate } from "@/lib/workflows/simulation";
import type { WorkflowViewerScope } from "@/lib/workflows/viewer-scope";
import { and, asc, desc, eq, inArray, isNotNull, lt, or, sql } from "drizzle-orm";

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

export interface WorkflowTemplateInput {
	templateKey: string;
	name: string;
	description?: string;
	subjectType: string;
	states: string[];
	transitions: Array<{
		action: string;
		from: string[];
		to: string;
		requiredRoles?: string[];
		requiresReason?: boolean;
	}>;
	slaPolicy?: WorkflowTemplateRow["slaPolicy"];
	notificationPolicy?: WorkflowTemplateRow["notificationPolicy"];
	portalPolicy?: WorkflowTemplateRow["portalPolicy"];
	metadata?: Record<string, unknown>;
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

function normalizeWorkflowLimit(
	limit: number | undefined,
	fallback: number,
	maximum = 500
): number {
	if (limit === undefined || !Number.isFinite(limit)) return fallback;
	return Math.max(1, Math.min(maximum, Math.floor(limit)));
}

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
	const limit = normalizeWorkflowLimit(options.limit, 100);
	const rows = await db
		.select()
		.from(workflowInstances)
		.where(and(
			inArray(workflowInstances.status, ["active", "waiting", "breached"]),
			isNotNull(workflowInstances.dueAt),
			lt(workflowInstances.dueAt, now)
		))
		.orderBy(asc(workflowInstances.dueAt))
		.limit(limit);

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
	scope: WorkflowViewerScope,
	filters: WorkflowDashboardFilters = {}
): Promise<WorkflowDashboardSummary> {
	assertWorkflowViewerScope(scope);
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
	const scopeCondition = await getWorkflowScopeCondition(scope, filters.opportunityId);
	if (scopeCondition) {
		conditions.push(scopeCondition);
	}

	const limit = normalizeWorkflowLimit(filters.limit, 100);
	const rows = await db
		.select()
		.from(workflowInstances)
		.where(conditions.length ? and(...conditions) : sql`true`)
		.orderBy(desc(workflowInstances.updatedAt));
	const items = rows.slice(0, limit);
	const dueSoonThreshold = Date.now() + 48 * 60 * 60 * 1000;

	return {
		total: rows.length,
		active: rows.filter((item) => item.status === "active" || item.status === "waiting").length,
		breached: rows.filter((item) => item.status === "breached").length,
		escalated: rows.filter((item) => item.status === "escalated").length,
		completed: rows.filter((item) => item.status === "completed").length,
		bySubjectType: rows.reduce<Record<string, number>>((acc, item) => {
			acc[item.subjectType] = (acc[item.subjectType] ?? 0) + 1;
			return acc;
		}, {}),
		dueSoon: rows.filter((item) => {
			if (!item.dueAt) return false;
			const time = new Date(item.dueAt).getTime();
			return time <= dueSoonThreshold && time >= Date.now() && item.status !== "completed";
		}),
		items,
	};
}

export async function listPortalWorkflowItems(
	scope: WorkflowViewerScope,
	options: { portalRole?: string; limit?: number } = {}
): Promise<WorkflowInstanceRow[]> {
	assertWorkflowViewerScope(scope);
	const conditions = [inArray(workflowInstances.visibility, ["portal", "external"])];
	const scopeCondition = await getWorkflowScopeCondition(scope);
	if (scopeCondition) {
		conditions.push(scopeCondition);
	}
	const rows = await db
		.select()
		.from(workflowInstances)
		.where(and(...conditions))
		.orderBy(asc(workflowInstances.dueAt), desc(workflowInstances.updatedAt));

	return rows.filter((row) => {
		const visibility = row.portalVisibility;
		if (visibility?.visibleToPortal !== true) return false;
		if (visibility.portalRole && !scope.isGlobalWorkflowViewer && !scope.portalRoles.includes(visibility.portalRole)) {
			return false;
		}
		if (options.portalRole && scope.isGlobalWorkflowViewer) {
			return visibility.portalRole === options.portalRole;
		}
		return true;
	}).slice(0, normalizeWorkflowLimit(options.limit, 50));
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
		throw new WorkflowAuthorityDeniedError({
			action: input.action,
			requiredRoles: policy.requiredRoles,
		});
	}
}

export async function reverseWorkflowRuntimeState(input: {
	workflowInstanceId: string;
	action: "reopen" | "cancel" | "resolve";
	actorId: string;
	actorName?: string;
	reason: string;
	targetState?: string;
	visibility?: "internal" | "portal" | "external";
	portalVisibility?: WorkflowPortalVisibility | null;
	evidenceLinks?: string[];
	metadata?: Record<string, unknown>;
	authorityChecked: true;
}): Promise<WorkflowInstanceRow> {
	if (input.authorityChecked !== true) {
		throw new Error("Workflow reversal requires prior authority verification");
	}
	const reason = input.reason.trim();
	if (!reason) {
		throw new Error("Workflow reversal requires a reason");
	}

	const [instance] = await db
		.select()
		.from(workflowInstances)
		.where(eq(workflowInstances.id, input.workflowInstanceId))
		.limit(1);
	if (!instance) {
		throw new Error("Workflow instance not found");
	}

	const now = new Date();
	const toState = input.targetState
		?? (input.action === "reopen" ? "active" : input.action === "cancel" ? "cancelled" : "resolved");
	const status: WorkflowRuntimeStatus = input.action === "reopen"
		? "active"
		: input.action === "cancel"
			? "cancelled"
			: "completed";
	const metadata = {
		...(isRecord(instance.metadata) ? instance.metadata : {}),
		...(input.metadata ?? {}),
		reversal: {
			action: input.action,
			reason,
			actorId: input.actorId,
			at: now.toISOString(),
			previousState: instance.state,
			previousStatus: instance.status,
		},
	};

	const [updated] = await db
		.update(workflowInstances)
		.set({
			state: toState,
			status,
			visibility: input.visibility ?? instance.visibility,
			portalVisibility: input.portalVisibility === undefined ? instance.portalVisibility : input.portalVisibility,
			metadata,
			completedAt: status === "completed" || status === "cancelled" ? now : null,
			updatedAt: now,
		})
		.where(eq(workflowInstances.id, input.workflowInstanceId))
		.returning();
	if (!updated) {
		throw new Error("Failed to reverse workflow state");
	}

	await db.insert(workflowAuditEvents).values({
		workflowInstanceId: updated.id,
		subjectType: updated.subjectType,
		subjectId: updated.subjectId,
		eventType: `workflow_${input.action}`,
		fromState: instance.state,
		toState,
		actorId: input.actorId,
		actorName: input.actorName ?? input.actorId,
		reason,
		evidenceLinks: input.evidenceLinks ?? [],
		metadata,
	});

	if (input.action === "cancel") {
		await db
			.update(workflowRuntimeTasks)
			.set({ state: "cancelled", updatedAt: now })
			.where(eq(workflowRuntimeTasks.workflowInstanceId, updated.id));
	}

	return updated;
}

function assertWorkflowViewerScope(scope: WorkflowViewerScope | null | undefined): asserts scope is WorkflowViewerScope {
	if (!scope?.userId) {
		throw new Error("Workflow viewer scope is required");
	}
}

async function getWorkflowScopeCondition(scope: WorkflowViewerScope, opportunityId?: string) {
	if (scope.isGlobalWorkflowViewer) return null;
	const assignedOpportunityIds = await getAssignedOpportunityIdsForScope(scope.userId, opportunityId);
	const actorCondition = sql`coalesce(${workflowInstances.authorityPolicy}, '{}'::jsonb) @> ${JSON.stringify({ allowedActorIds: [scope.userId] })}::jsonb`;
	const conditions = [
		eq(workflowInstances.assignedTo, scope.userId),
		actorCondition,
	];
	if (assignedOpportunityIds.length) {
		conditions.push(inArray(workflowInstances.opportunityId, assignedOpportunityIds));
		const subjectOpportunityCondition = and(
			eq(workflowInstances.subjectType, "opportunity"),
			inArray(workflowInstances.subjectId, assignedOpportunityIds)
		);
		if (subjectOpportunityCondition) {
			conditions.push(subjectOpportunityCondition);
		}
	}
	return or(...conditions);
}

async function getAssignedOpportunityIdsForScope(userId: string, opportunityId?: string): Promise<string[]> {
	const conditions = [eq(opportunities.assignedTo, userId)];
	if (opportunityId && isUuid(opportunityId)) {
		conditions.push(eq(opportunities.id, opportunityId));
	}
	const rows = await db
		.select({ id: opportunities.id })
		.from(opportunities)
		.where(and(...conditions));
	return rows.map((row) => row.id);
}

export async function createWorkflowTemplateDraft(
	input: WorkflowTemplateInput,
	actorId: string
): Promise<WorkflowTemplateRow> {
	const simulation = simulateWorkflowTemplate(input);
	if (!simulation.valid) {
		throw new Error(`Workflow template is invalid: ${simulation.errors.join("; ")}`);
	}

	const [latest] = await db
		.select()
		.from(workflowTemplates)
		.where(eq(workflowTemplates.templateKey, input.templateKey))
		.orderBy(desc(workflowTemplates.version))
		.limit(1);
	const version = (latest?.version ?? 0) + 1;
	const [created] = await db
		.insert(workflowTemplates)
		.values({
			templateKey: input.templateKey,
			name: input.name,
			description: input.description ?? null,
			subjectType: input.subjectType,
			version,
			status: "draft",
			states: input.states,
			transitions: input.transitions,
			slaPolicy: input.slaPolicy ?? {},
			notificationPolicy: input.notificationPolicy ?? {},
			portalPolicy: input.portalPolicy ?? {},
			metadata: {
				...(input.metadata ?? {}),
				simulation,
			},
			createdBy: actorId,
		})
		.returning();
	if (!created) {
		throw new Error("Failed to create workflow template");
	}
	return created;
}

export async function publishWorkflowTemplate(
	templateId: string,
	actorId: string
): Promise<WorkflowTemplateRow> {
	const [template] = await db
		.select()
		.from(workflowTemplates)
		.where(eq(workflowTemplates.id, templateId))
		.limit(1);
	if (!template) {
		throw new Error("Workflow template not found");
	}
	const simulation = simulateWorkflowTemplate(template);
	if (!simulation.valid) {
		throw new Error(`Workflow template is invalid: ${simulation.errors.join("; ")}`);
	}

	await db
		.update(workflowTemplates)
		.set({
			status: "deprecated",
			deprecatedAt: new Date(),
			deprecatedBy: actorId,
			updatedAt: new Date(),
		})
		.where(and(
			eq(workflowTemplates.templateKey, template.templateKey),
			eq(workflowTemplates.status, "active")
		));

	const [updated] = await db
		.update(workflowTemplates)
		.set({
			status: "active",
			publishedAt: new Date(),
			publishedBy: actorId,
			metadata: {
				...(isRecord(template.metadata) ? template.metadata : {}),
				simulation,
			},
			updatedAt: new Date(),
		})
		.where(eq(workflowTemplates.id, templateId))
		.returning();
	if (!updated) {
		throw new Error("Failed to publish workflow template");
	}
	return updated;
}

export async function deprecateWorkflowTemplate(
	templateId: string,
	actorId: string
): Promise<WorkflowTemplateRow> {
	const [updated] = await db
		.update(workflowTemplates)
		.set({
			status: "deprecated",
			deprecatedAt: new Date(),
			deprecatedBy: actorId,
			updatedAt: new Date(),
		})
		.where(eq(workflowTemplates.id, templateId))
		.returning();
	if (!updated) {
		throw new Error("Workflow template not found");
	}
	return updated;
}

export async function rollbackWorkflowTemplate(
	input: {
		templateKey: string;
		targetVersion: number;
		actorId: string;
	}
): Promise<WorkflowTemplateRow> {
	const [target] = await db
		.select()
		.from(workflowTemplates)
		.where(and(
			eq(workflowTemplates.templateKey, input.templateKey),
			eq(workflowTemplates.version, input.targetVersion)
		))
		.limit(1);
	if (!target) {
		throw new Error(`Workflow template ${input.templateKey} v${input.targetVersion} was not found`);
	}
	const simulation = simulateWorkflowTemplate(target);
	if (!simulation.valid) {
		throw new Error(`Workflow template rollback target is invalid: ${simulation.errors.join("; ")}`);
	}

	await db
		.update(workflowTemplates)
		.set({
			status: "deprecated",
			deprecatedAt: new Date(),
			deprecatedBy: input.actorId,
			updatedAt: new Date(),
		})
		.where(and(
			eq(workflowTemplates.templateKey, input.templateKey),
			eq(workflowTemplates.status, "active")
		));

	const [updated] = await db
		.update(workflowTemplates)
		.set({
			status: "active",
			publishedAt: new Date(),
			publishedBy: input.actorId,
			metadata: {
				...(isRecord(target.metadata) ? target.metadata : {}),
				rollback: {
					rolledBackBy: input.actorId,
					rolledBackAt: new Date().toISOString(),
					targetVersion: input.targetVersion,
				},
				simulation,
			},
			updatedAt: new Date(),
		})
		.where(eq(workflowTemplates.id, target.id))
		.returning();
	if (!updated) {
		throw new Error("Failed to rollback workflow template");
	}
	return updated;
}

export async function listWorkflowTemplates(filters: {
	status?: string;
	subjectType?: string;
	limit?: number;
} = {}): Promise<WorkflowTemplateRow[]> {
	const conditions = [];
	if (filters.status) conditions.push(eq(workflowTemplates.status, filters.status));
	if (filters.subjectType) conditions.push(eq(workflowTemplates.subjectType, filters.subjectType));
	return db
		.select()
		.from(workflowTemplates)
		.where(conditions.length ? and(...conditions) : sql`true`)
		.orderBy(desc(workflowTemplates.updatedAt))
		.limit(normalizeWorkflowLimit(filters.limit, 100));
}

export async function deliverWorkflowNotifications(options: {
	limit?: number;
	now?: Date;
	notificationIds?: string[];
} = {}): Promise<{ attempted: number; delivered: number; failed: number; skipped: number }> {
	const conditions = [eq(workflowNotifications.deliveryStatus, "queued")];
	if (options.notificationIds?.length) {
		conditions.push(inArray(workflowNotifications.id, options.notificationIds));
	}
	const rows = await db
		.select({
			notification: workflowNotifications,
			instance: workflowInstances,
			recipient: user,
		})
		.from(workflowNotifications)
		.innerJoin(workflowInstances, eq(workflowNotifications.workflowInstanceId, workflowInstances.id))
		.innerJoin(user, eq(workflowNotifications.recipientId, user.id))
		.where(and(...conditions))
		.orderBy(asc(workflowNotifications.createdAt))
		.limit(normalizeWorkflowLimit(options.limit, 50));

	let delivered = 0;
	let failed = 0;
	let skipped = 0;
	const now = options.now ?? new Date();
	for (const row of rows) {
		if (row.notification.channel !== "email") {
			skipped += 1;
			continue;
		}
		if (isWithinNotificationQuietHours(row.recipient.preferences, now)) {
			skipped += 1;
			await markNotificationDeferredForQuietHours(row.notification, now);
			continue;
		}
		if (!row.recipient.email) {
			failed += 1;
			await markNotificationFailed(row.notification, "Recipient email is missing");
			continue;
		}

		try {
			await sendStalwartEmail({
				to: row.recipient.email,
				toName: row.recipient.name ?? row.recipient.email,
				subject: workflowEmailSubject(row.instance),
				text: workflowEmailBody(row.instance, row.notification.actionUrl),
			});
			delivered += 1;
			await db
				.update(workflowNotifications)
				.set({
					deliveryStatus: "delivered",
					deliveredAt: now,
				})
				.where(eq(workflowNotifications.id, row.notification.id));
		} catch (error) {
			failed += 1;
			await markNotificationFailed(row.notification, error instanceof Error ? error.message : "Delivery failed");
		}
	}

	return { attempted: rows.length, delivered, failed, skipped };
}

async function markNotificationDeferredForQuietHours(
	notification: WorkflowNotificationRow,
	now: Date
) {
	await db
		.update(workflowNotifications)
		.set({
			metadata: {
				...(isRecord(notification.metadata) ? notification.metadata : {}),
				quietHoursDeferred: {
					deferredAt: now.toISOString(),
					reason: "Recipient notification quiet hours are active",
				},
			},
		})
		.where(eq(workflowNotifications.id, notification.id));
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
		channel: "email",
		eventType: input.eventType,
		actionUrl: input.actionUrl ?? null,
		metadata: input.metadata,
	})));
}

async function markNotificationFailed(notification: WorkflowNotificationRow, error: string) {
	await db
		.update(workflowNotifications)
		.set({
			deliveryStatus: "failed",
			metadata: {
				...(isRecord(notification.metadata) ? notification.metadata : {}),
				error,
			},
		})
		.where(eq(workflowNotifications.id, notification.id));
}

function isWithinNotificationQuietHours(preferences: unknown, now: Date): boolean {
	const notifications = isRecord(preferences) ? preferences.notifications : null;
	const quietHours = isRecord(notifications) ? notifications.quietHours : null;
	if (!isRecord(quietHours) || quietHours.enabled !== true) return false;
	const start = parseTimeOfDayMinutes(quietHours.start);
	const end = parseTimeOfDayMinutes(quietHours.end);
	if (start === null || end === null || start === end) return false;
	const current = now.getUTCHours() * 60 + now.getUTCMinutes();
	if (start < end) return current >= start && current < end;
	return current >= start || current < end;
}

function parseTimeOfDayMinutes(value: unknown): number | null {
	if (typeof value !== "string") return null;
	const match = /^(\d{2}):(\d{2})$/.exec(value);
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (hours > 23 || minutes > 59) return null;
	return hours * 60 + minutes;
}

async function sendStalwartEmail(input: {
	to: string;
	toName?: string;
	subject: string;
	text: string;
}) {
	const config = getStalwartSmtpConfig();
	const message = [
		`From: ${formatAddress(config.fromName, config.from)}`,
		`To: ${formatAddress(input.toName, input.to)}`,
		`Subject: ${sanitizeHeader(input.subject)}`,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=utf-8",
		"",
		input.text,
	].join("\r\n");
	await smtpSend({
		host: config.host,
		port: config.port,
		secure: config.secure,
		username: config.username,
		password: config.password,
		from: config.from,
		to: input.to,
		message,
	});
}

function getStalwartSmtpConfig() {
	const host = process.env.STALWART_SMTP_HOST ?? process.env.SMTP_HOST ?? "mail.lindela.io";
	const port = Number(process.env.STALWART_SMTP_PORT ?? process.env.SMTP_PORT ?? 587);
	const username = process.env.STALWART_SMTP_USER ?? process.env.SMTP_USER;
	const password = process.env.STALWART_SMTP_PASSWORD ?? process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS;
	const from = process.env.WORKFLOW_EMAIL_FROM ?? process.env.SMTP_FROM ?? "alerts@lindela.io";
	if (!username || !password) {
		throw new Error("Stalwart SMTP credentials are not configured");
	}
	const secureSetting = process.env.STALWART_SMTP_SECURE
		?? process.env.SMTP_SECURE
		?? process.env.SMTP_USE_TLS
		?? "false";
	return {
		host,
		port,
		username,
		password,
		from,
		fromName: process.env.WORKFLOW_EMAIL_FROM_NAME ?? "DocFusion Workflows",
		secure: String(secureSetting) === "true" || port === 465,
	};
}

async function smtpSend(input: {
	host: string;
	port: number;
	secure: boolean;
	username: string;
	password: string;
	from: string;
	to: string;
	message: string;
}) {
	const timeoutMs = Number(process.env.STALWART_SMTP_TIMEOUT_MS ?? process.env.SMTP_TIMEOUT_MS ?? 15_000);
	let socket: net.Socket | tls.TLSSocket = input.secure
		? tls.connect({ host: input.host, port: input.port, servername: input.host })
		: net.connect({ host: input.host, port: input.port });
	socket.on("error", () => undefined);
	let buffer = "";
	const read = () => new Promise<string>((resolve, reject) => {
		const timer = setTimeout(() => {
			cleanup();
			socket.destroy();
			reject(new Error(`SMTP response timed out after ${timeoutMs}ms`));
		}, timeoutMs);
		const cleanup = () => {
			clearTimeout(timer);
			socket.off("data", onData);
			socket.off("error", onError);
		};
		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};
		const onData = (chunk: Buffer) => {
			buffer += chunk.toString("utf8");
			const lines = buffer.split(/\r?\n/);
			const last = lines[lines.length - 2] ?? "";
			if (/^\d{3}\s/.test(last)) {
				cleanup();
				const response = buffer;
				buffer = "";
				resolve(response);
			}
		};
		socket.on("data", onData);
		socket.once("error", onError);
	});
	const write = async (command: string, expected: number[]) => {
		socket.write(`${command}\r\n`);
		const response = await read();
		const code = Number(response.slice(0, 3));
		if (!expected.includes(code)) {
			throw new Error(`SMTP command failed (${command.split(" ")[0]}): ${response.trim()}`);
		}
	};

	await read();
	await write(`EHLO ${input.host}`, [250]);
	if (!input.secure) {
		await write("STARTTLS", [220]);
		const secureSocket = tls.connect({ socket, servername: input.host });
		secureSocket.on("error", () => undefined);
		await waitForSecureConnect(secureSocket);
		socket = secureSocket;
		buffer = "";
		await write(`EHLO ${input.host}`, [250]);
	}
	await write("AUTH LOGIN", [334]);
	await write(Buffer.from(input.username).toString("base64"), [334]);
	await write(Buffer.from(input.password).toString("base64"), [235]);
	await write(`MAIL FROM:<${input.from}>`, [250]);
	await write(`RCPT TO:<${input.to}>`, [250, 251]);
	await write("DATA", [354]);
	socket.write(`${input.message}\r\n.\r\n`);
	const dataResponse = await read();
	const dataCode = Number(dataResponse.slice(0, 3));
	if (dataCode !== 250) {
		throw new Error(`SMTP DATA failed: ${dataResponse.trim()}`);
	}
	socket.write("QUIT\r\n");
	socket.end();
}

function waitForSecureConnect(socket: tls.TLSSocket): Promise<void> {
	return new Promise((resolve, reject) => {
		socket.once("secureConnect", resolve);
		socket.once("error", reject);
	});
}

function workflowEmailSubject(instance: WorkflowInstanceRow): string {
	return `Workflow ${instance.status}: ${instance.subjectType} ${instance.subjectId}`;
}

function workflowEmailBody(instance: WorkflowInstanceRow, actionUrl: string | null): string {
	const lines = [
		`Workflow: ${instance.workflowKey}`,
		`Subject: ${instance.subjectType} ${instance.subjectId}`,
		`State: ${instance.state}`,
		`Status: ${instance.status}`,
		`Priority: ${instance.priority}`,
	];
	if (instance.dueAt) lines.push(`Due: ${instance.dueAt.toISOString()}`);
	if (actionUrl) lines.push(`Action: ${actionUrl}`);
	return lines.join("\n");
}

function formatAddress(name: string | undefined, email: string): string {
	return name ? `"${sanitizeHeader(name)}" <${email}>` : email;
}

function sanitizeHeader(value: string): string {
	return value.replace(/[\r\n]/g, " ").trim();
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

function isUuid(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
