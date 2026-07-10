"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
	workflowAuditEvents,
	workflowNotifications,
	type WorkflowInstanceRow,
	type WorkflowNotificationRow,
} from "@/lib/db/schema-workflow-runtime";
import type { ProposalTask } from "@/lib/db/schema-tasks";
import { claimAnalysis, type ClaimAnalysisRecord } from "@/lib/db/schema-evidence";
import { getOpportunity } from "@/lib/actions/opportunities";
import { listAllTasks, listTasks } from "@/lib/actions/task-management";
import { getOpportunityDocuments } from "@/lib/services/rfp-document-service";
import { deliverWorkflowNotifications, getWorkflowDashboard } from "@/lib/actions/workflow-runtime";
import { getUserPreferences, updateNotificationPreferences, type UserPreferences } from "@/lib/actions/user-settings";
import { getWorkflowViewerScopeFromSession } from "@/lib/workflows/viewer-scope";
import {
	deriveCommandCenterBlockers,
	deriveCommandCenterNextActions,
	deriveReadinessDimensions,
	deriveReadinessScore,
	normalizeWorkItems,
	summarizeWorkItems,
	type CommandCenterBlocker,
	type CommandCenterNextAction,
	type ReadinessDimension,
	type ReadinessScore,
	type WorkItem,
	type WorkItemPriority,
	type WorkItemSummary,
} from "@/lib/work-items/projections";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";

export interface OperationalInboxProjection {
	items: WorkItem[];
	summary: WorkItemSummary;
	notificationPreferences: UserPreferences["notifications"] | null;
	generatedAt: string;
}

export interface OpportunityCommandCenterProjection {
	opportunityId: string;
	readiness: ReadinessScore;
	readinessDimensions: ReadinessDimension[];
	nextActions: CommandCenterNextAction[];
	blockers: CommandCenterBlocker[];
	workSummary: WorkItemSummary;
	documentSummary: {
		total: number;
		downloaded: number;
		failed: number;
	};
	workflowSummary: {
		total: number;
		active: number;
		breached: number;
		escalated: number;
		completed: number;
	};
	auditEvents: Array<{
		id: string;
		eventType: string;
		actorName: string | null;
		reason: string | null;
		createdAt: string;
	}>;
	generatedAt: string;
}

export async function getUnreadWorkflowNotificationSummary(): Promise<{
	hasNotifications: boolean;
	unreadCount: number;
}> {
	const scope = await getWorkflowViewerScopeFromSession();
	if (!scope) {
		return { hasNotifications: false, unreadCount: 0 };
	}

	const [result] = await db
		.select({ unreadCount: count() })
		.from(workflowNotifications)
		.where(and(
			eq(workflowNotifications.recipientId, scope.userId),
			isNull(workflowNotifications.acknowledgedAt)
		));

	const unreadCount = Number(result?.unreadCount ?? 0);
	return {
		hasNotifications: unreadCount > 0,
		unreadCount,
	};
}

export async function getOperationalInboxProjection(options: {
	opportunityId?: string | null;
	limit?: number;
} = {}): Promise<OperationalInboxProjection> {
	const scope = await getWorkflowViewerScopeFromSession();
	if (!scope) {
		return emptyInboxProjection();
	}

	const limit = options.limit ?? 100;
	const [workflowDashboard, taskResult, notifications, preferences] = await Promise.all([
		getWorkflowDashboard(scope, {
			opportunityId: options.opportunityId ?? undefined,
			statuses: ["active", "waiting", "breached", "escalated"],
			limit,
		}),
		options.opportunityId ? listTasks(options.opportunityId) : listAllTasks({ limit }),
		listWorkflowNotificationsForInbox(scope.userId, scope.isGlobalWorkflowViewer, limit),
		getUserPreferences(),
	]);

	const items = normalizeWorkItems([
		...workflowDashboard.items.map(workflowInstanceToWorkItem),
		...(taskResult.data ?? []).map(taskToWorkItem),
		...notifications.map(notificationToWorkItem),
	]);

	return {
		items: items.slice(0, limit),
		summary: summarizeWorkItems(items),
		notificationPreferences: preferences.notifications,
		generatedAt: new Date().toISOString(),
	};
}

export async function getOpportunityCommandCenterProjection(
	opportunityId: string
): Promise<OpportunityCommandCenterProjection> {
	const scope = await getWorkflowViewerScopeFromSession();
	if (!scope) {
		throw new Error("Authentication is required to load the opportunity command center");
	}

	const [opportunity, taskResult, workflowDashboard] = await Promise.all([
		getOpportunity(opportunityId),
		listTasks(opportunityId),
		getWorkflowDashboard(scope, { opportunityId, limit: 80 }),
	]);
	const canReadOpportunity =
		scope.isGlobalWorkflowViewer ||
		Boolean(opportunity) ||
		workflowDashboard.items.length > 0;
	if (!canReadOpportunity) {
		throw new Error("Opportunity not found or not permitted");
	}
	const [documents, blockingClaims] = await Promise.all([
		getOpportunityDocuments(opportunityId),
		listBlockingOpportunityClaims(opportunityId, scope.userId, scope.organizationId),
	]);
	const canReadOpportunityAudit =
		scope.isGlobalWorkflowViewer ||
		opportunity?.assignedTo === scope.userId ||
		workflowDashboard.items.length > 0;
	const auditEvents = canReadOpportunityAudit
		? await listOpportunityAuditEvents(
			opportunityId,
			workflowDashboard.items.map((item) => item.id),
			scope.isGlobalWorkflowViewer || opportunity?.assignedTo === scope.userId
		)
		: [];

	const workItems = normalizeWorkItems([
		...workflowDashboard.items.map(workflowInstanceToWorkItem),
		...(taskResult.data ?? []).map(taskToWorkItem),
	]);
	const documentWorkItems = documents
		.filter((document) => document.status === "failed" || document.status === "downloading")
		.map((document): WorkItem => ({
			id: `document:${document.id}`,
			kind: "workflow",
			title: document.status === "failed" ? `Recover failed document: ${document.documentName}` : `Finish downloading ${document.documentName}`,
			status: document.status,
			priority: document.status === "failed" ? "high" : "medium",
			opportunityId,
			subjectType: "rfp_document",
			subjectId: document.id,
			actionUrl: `/opportunities/${opportunityId}`,
			source: "rfp_document",
		}));
	const claimWorkItems = blockingClaims.map(claimToWorkItem);
	const allItems = normalizeWorkItems([...workItems, ...documentWorkItems, ...claimWorkItems]);

	if (opportunity?.deadline && new Date(opportunity.deadline).getTime() < Date.now()) {
		allItems.unshift({
			id: `deadline:${opportunityId}`,
			kind: "workflow",
			title: "Review expired opportunity deadline",
			status: "blocked",
			priority: "critical",
			opportunityId,
			subjectType: "opportunity",
			subjectId: opportunityId,
			actionUrl: `/opportunities/${opportunityId}`,
			source: "opportunity_deadline",
			blocker: "Deadline has passed",
		});
	}

	return {
		opportunityId,
		readiness: deriveReadinessScore(allItems),
		readinessDimensions: deriveReadinessDimensions(allItems),
		nextActions: deriveCommandCenterNextActions(allItems),
		blockers: deriveCommandCenterBlockers(allItems),
		workSummary: summarizeWorkItems(allItems),
		documentSummary: {
			total: documents.length,
			downloaded: documents.filter((document) => document.status === "downloaded" || document.status === "analyzed").length,
			failed: documents.filter((document) => document.status === "failed" || document.status === "error").length,
		},
		workflowSummary: {
			total: workflowDashboard.total,
			active: workflowDashboard.active,
			breached: workflowDashboard.breached,
			escalated: workflowDashboard.escalated,
			completed: workflowDashboard.completed,
		},
		auditEvents: auditEvents.map((event) => ({
			id: event.id,
			eventType: event.eventType,
			actorName: event.actorName,
			reason: event.reason,
			createdAt: toIso(event.createdAt),
		})),
		generatedAt: new Date().toISOString(),
	};
}

async function listBlockingOpportunityClaims(
	opportunityId: string,
	userId: string,
	organizationId?: string
): Promise<ClaimAnalysisRecord[]> {
	const rows = await db
		.select()
		.from(claimAnalysis)
		.where(and(
			eq(claimAnalysis.opportunityId, opportunityId),
			eq(claimAnalysis.riskLevel, "high"),
			assignedOpportunityExistsSql(claimAnalysis.opportunityId, userId, organizationId),
		));

	return rows.filter((claim) => claim.status !== "resolved" && claim.status !== "wont_fix");
}

function assignedOpportunityExistsSql(opportunityId: unknown, userId: string, organizationId?: string) {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			${organizationId ? sql`and (opportunities.organization_id = ${organizationId} or opportunities.organization_id is null)` : sql``}
			and opportunities.assigned_to = ${userId}
	)`;
}

function claimToWorkItem(claim: ClaimAnalysisRecord): WorkItem {
	const claimText = truncateClaim(claim.claimText);
	return {
		id: `claim:${claim.id}`,
		kind: "exception",
		title: `Resolve unsupported claim: ${claimText}`,
		description: claim.evaluatorImpact,
		status: claim.status ?? "open",
		priority: claim.evidenceStrength === "none" ? "critical" : "high",
		role: "proposal_writer",
		opportunityId: claim.opportunityId,
		subjectType: "evidence_claim",
		subjectId: claim.id,
		actionUrl: claim.documentId ? `/documents/${claim.documentId}` : "/evidence",
		blocker: "High-risk unsupported claim requires remediation",
		source: "claim_analysis",
	};
}

export async function acknowledgeWorkflowNotification(notificationId: string) {
	const scope = await getWorkflowViewerScopeFromSession();
	if (!scope) {
		return { success: false, error: "Authentication is required" };
	}

	const conditions = [
		eq(workflowNotifications.id, notificationId),
		scope.isGlobalWorkflowViewer ? sql`true` : eq(workflowNotifications.recipientId, scope.userId),
	];
	const [existing] = await db
		.select()
		.from(workflowNotifications)
		.where(and(...conditions))
		.limit(1);
	if (!existing) {
		return { success: false, error: "Notification not found or not permitted" };
	}

	const [updated] = await db
		.update(workflowNotifications)
		.set({
			acknowledgedAt: new Date(),
			metadata: {
				...(isRecord(existing.metadata) ? existing.metadata : {}),
				acknowledgement: {
					acknowledgedBy: scope.userId,
					acknowledgedAt: new Date().toISOString(),
				},
			},
		})
		.where(and(...conditions))
		.returning();

	if (!updated) {
		return { success: false, error: "Notification not found or not permitted" };
	}
	revalidatePath("/tasks");
	return { success: true };
}

export async function retryWorkflowNotificationDelivery(notificationId: string) {
	const scope = await getWorkflowViewerScopeFromSession();
	if (!scope?.isGlobalWorkflowViewer) {
		return { success: false, error: "Workflow operations permission is required" };
	}

	const [notification] = await db
		.select()
		.from(workflowNotifications)
		.where(eq(workflowNotifications.id, notificationId))
		.limit(1);
	if (!notification) {
		return { success: false, error: "Notification not found" };
	}

	await db
		.update(workflowNotifications)
		.set({
			deliveryStatus: "queued",
			metadata: {
				...(isRecord(notification.metadata) ? notification.metadata : {}),
				redeliveryRequestedBy: scope.userId,
				redeliveryRequestedAt: new Date().toISOString(),
			},
		})
		.where(eq(workflowNotifications.id, notificationId));
	const result = await deliverWorkflowNotifications({ notificationIds: [notificationId], limit: 1 });
	revalidatePath("/tasks");
	revalidatePath("/workflows/operations");
	return { success: true, result };
}

export async function updateWorkflowNotificationQuietHours(input: {
	enabled: boolean;
	start: string;
	end: string;
}) {
	const current = await getUserPreferences();
	const result = await updateNotificationPreferences({
		...current.notifications,
		quietHours: {
			enabled: input.enabled,
			start: input.start,
			end: input.end,
		},
	});
	revalidatePath("/tasks");
	return result;
}

async function listWorkflowNotificationsForInbox(
	userId: string,
	isGlobalWorkflowViewer: boolean,
	limit: number
): Promise<WorkflowNotificationRow[]> {
	const conditions = [
		inArray(workflowNotifications.deliveryStatus, ["queued", "failed", "delivered"]),
		isGlobalWorkflowViewer ? sql`true` : eq(workflowNotifications.recipientId, userId),
	];
	return db
		.select()
		.from(workflowNotifications)
		.where(and(...conditions))
		.orderBy(desc(workflowNotifications.createdAt))
		.limit(limit);
}

async function listOpportunityAuditEvents(
	opportunityId: string,
	visibleWorkflowIds: string[],
	canReadDirectSubjectAudit: boolean
) {
	if (canReadDirectSubjectAudit) {
		const rows = await db
			.select()
			.from(workflowAuditEvents)
			.where(eq(workflowAuditEvents.subjectId, opportunityId))
			.orderBy(desc(workflowAuditEvents.createdAt))
			.limit(8);

		if (rows.length > 0) return rows;
	}

	const workflowIds = [...new Set(visibleWorkflowIds)];
	if (!workflowIds.length) return [];
	return db
		.select()
		.from(workflowAuditEvents)
		.where(inArray(workflowAuditEvents.workflowInstanceId, workflowIds))
		.orderBy(desc(workflowAuditEvents.createdAt))
		.limit(8);
}

function workflowInstanceToWorkItem(row: WorkflowInstanceRow): WorkItem {
	const title = `${humanize(row.workflowKey)}: ${humanize(row.state)}`;
	const blocker = workflowReadinessBlocker(row);
	return {
		id: `workflow:${row.id}`,
		kind: row.status === "breached" || row.status === "escalated" ? "exception" : "workflow",
		title,
		description: workflowReadinessDescription(row),
		status: row.status,
		priority: normalizePriority(row.priority),
		owner: row.assignedTo ?? row.escalatedTo,
		role: row.assignedRole,
		dueAt: toIsoOrNull(row.dueAt),
		updatedAt: toIsoOrNull(row.updatedAt),
		opportunityId: row.opportunityId,
		subjectType: row.subjectType,
		subjectId: row.subjectId,
		actionUrl: row.portalVisibility?.actionUrl ?? workflowSubjectUrl(row),
		disabledReason: disabledReasonForWorkflow(row),
		blocker,
		portalVisible: row.portalVisibility?.visibleToPortal === true,
		auditRef: row.id,
		source: "workflow_runtime",
	};
}

function workflowReadinessBlocker(row: WorkflowInstanceRow): string | null {
	if (row.workflowKey !== "proposal_response_package") {
		return null;
	}
	const readiness = asRecord(asRecord(row.metadata).readiness);
	const status = readiness.status;
	if (status === "ready_for_review") {
		return null;
	}
	if (status === "blocked") {
		const blockers = stringArray(readiness.blockers);
		return `Response package readiness blocked${blockers[0] ? `: ${blockers[0]}` : ""}`;
	}
	if (Object.keys(readiness).length === 0) {
		return "Response package readiness missing";
	}
	return "Response package readiness status is unrecognized";
}

function workflowReadinessDescription(row: WorkflowInstanceRow): string | null {
	if (row.workflowKey !== "proposal_response_package") {
		return null;
	}
	const readiness = asRecord(asRecord(row.metadata).readiness);
	const metrics = asRecord(readiness.metrics);
	const winThemeCriteriaCoverage = metrics.winThemeCriteriaCoverage ?? metrics.winThemeCoverage;
	const winThemeSeedCount = typeof metrics.winThemeSeedCount === "number" && Number.isFinite(metrics.winThemeSeedCount)
		? metrics.winThemeSeedCount
		: null;
	return [
		`Readiness: ${typeof readiness.status === "string" ? readiness.status : "missing"}`,
		`Requirement coverage: ${formatPercent(numberMetric(metrics.requirementCoverage))}`,
		`Review gates: ${formatPercent(numberMetric(metrics.reviewGateCoverage))}`,
		`Draft artifacts: ${formatPercent(numberMetric(metrics.draftArtifactIntegrityCoverage))}`,
		`Evaluator win themes: ${formatPercent(numberMetric(winThemeCriteriaCoverage))}${winThemeSeedCount === null ? "" : ` (${winThemeSeedCount} seed${winThemeSeedCount === 1 ? "" : "s"})`}`,
	].join(" | ");
}

function taskToWorkItem(task: ProposalTask): WorkItem {
	return {
		id: `task:${task.id}`,
		kind: "task",
		title: task.title,
		description: task.description,
		status: task.status ?? "pending",
		priority: normalizePriority(task.priority),
		owner: task.assignedTo,
		dueAt: toIsoOrNull(task.dueDate),
		updatedAt: toIsoOrNull(task.updatedAt),
		opportunityId: task.opportunityId,
		subjectType: task.requirementId ? "requirement" : "proposal_task",
		subjectId: task.requirementId ?? task.id,
		actionUrl: `/tasks?task=${task.id}`,
		source: "proposal_task",
	};
}

function notificationToWorkItem(notification: WorkflowNotificationRow): WorkItem {
	const acknowledged = Boolean(notification.acknowledgedAt);
	return {
		id: `notification:${notification.id}`,
		kind: "notification",
		title: `${humanize(notification.eventType)} notification`,
		status: acknowledged ? "completed" : notification.deliveryStatus,
		priority: notification.deliveryStatus === "failed" ? "high" : "medium",
		dueAt: toIsoOrNull(notification.createdAt),
		updatedAt: toIsoOrNull(notification.deliveredAt ?? notification.createdAt),
		subjectType: "workflow_notification",
		subjectId: notification.id,
		actionUrl: notification.actionUrl ?? "/tasks",
		disabledReason: acknowledged ? "Already acknowledged" : null,
		auditRef: notification.workflowInstanceId,
		source: "workflow_notification",
	};
}

function emptyInboxProjection(): OperationalInboxProjection {
	return {
		items: [],
		summary: summarizeWorkItems([]),
		notificationPreferences: null,
		generatedAt: new Date().toISOString(),
	};
}

function workflowSubjectUrl(row: WorkflowInstanceRow): string {
	if (row.workflowKey === "proposal_response_package" && row.opportunityId) {
		return `/opportunities/${row.opportunityId}/documents`;
	}
	if (row.opportunityId) return `/opportunities/${row.opportunityId}`;
	if (row.subjectType === "opportunity") return `/opportunities/${row.subjectId}`;
	return "/workflows";
}

function disabledReasonForWorkflow(row: WorkflowInstanceRow): string | null {
	if (row.status === "completed") return "Workflow is complete";
	if (row.status === "cancelled") return "Workflow is cancelled";
	if (row.authorityPolicy?.requiredRoles?.length) {
		return `Requires ${row.authorityPolicy.requiredRoles.join(", ")}`;
	}
	return null;
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberMetric(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function formatPercent(value: number): string {
	return `${Math.round(value * 100)}%`;
}

function normalizePriority(value: string | null | undefined): WorkItemPriority {
	if (value === "critical" || value === "high" || value === "medium" || value === "low") return value;
	return "medium";
}

function humanize(value: string): string {
	return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function truncateClaim(value: string): string {
	return value.length > 96 ? `${value.slice(0, 93)}...` : value;
}

function toIso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
	return isRecord(value) ? value : {};
}
