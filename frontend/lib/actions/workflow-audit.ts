"use server";

import { db } from "@/lib/db";
import {
	workflowAuditEvents,
	workflowInstances,
	type WorkflowAuditEventRow,
	type WorkflowInstanceRow,
} from "@/lib/db/schema-workflow-runtime";
import { getWorkflowDashboard } from "@/lib/actions/workflow-runtime";
import { getWorkflowViewerScopeFromSession, type WorkflowViewerScope } from "@/lib/workflows/viewer-scope";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

export interface WorkflowAuditExplorerFilters {
	runId?: string | null;
	subjectType?: string | null;
	subjectId?: string | null;
	eventType?: string | null;
	actorId?: string | null;
	limit?: number;
}

export interface WorkflowAuditExplorerEvent {
	id: string;
	workflowInstanceId: string;
	subjectType: string;
	subjectId: string;
	eventType: string;
	fromState: string | null;
	toState: string | null;
	actorId: string;
	actorName: string | null;
	reason: string | null;
	evidenceLinks: string[];
	metadata: Record<string, unknown>;
	createdAt: string;
}

export interface WorkflowAuditExplorerProjection {
	filters: Required<Pick<WorkflowAuditExplorerFilters, "limit">> & Omit<WorkflowAuditExplorerFilters, "limit">;
	summary: {
		totalEvents: number;
		runCount: number;
		subjectCount: number;
		eventTypes: Record<string, number>;
	};
	runs: Array<{
		id: string;
		workflowKey: string;
		subjectType: string;
		subjectId: string;
		state: string;
		status: string;
		updatedAt: string;
	}>;
	events: WorkflowAuditExplorerEvent[];
	reconstruction: {
		runId: string;
		subjectType: string;
		subjectId: string;
		workflowKey: string;
		currentState: string;
		status: string;
		timeline: WorkflowAuditExplorerEvent[];
	} | null;
	generatedAt: string;
}

export async function getWorkflowAuditExplorerProjection(
	filters: WorkflowAuditExplorerFilters = {}
): Promise<WorkflowAuditExplorerProjection> {
	const scope = await getWorkflowViewerScopeFromSession();
	return getWorkflowAuditExplorerProjectionForScope(scope, filters);
}

export async function getWorkflowAuditExplorerProjectionForScope(
	scope: WorkflowViewerScope | null,
	filters: WorkflowAuditExplorerFilters = {}
): Promise<WorkflowAuditExplorerProjection> {
	if (!scope) return emptyProjection(filters);

	const limit = normalizeLimit(filters.limit);
	const visibleRunIds = await resolveVisibleRunIds(filters.runId, scope);
	if (visibleRunIds && visibleRunIds.length === 0) {
		return emptyProjection({ ...filters, limit });
	}

	const eventConditions = [
		filters.runId ? eq(workflowAuditEvents.workflowInstanceId, filters.runId) : undefined,
		filters.subjectType ? eq(workflowAuditEvents.subjectType, filters.subjectType) : undefined,
		filters.subjectId ? eq(workflowAuditEvents.subjectId, filters.subjectId) : undefined,
		filters.eventType ? eq(workflowAuditEvents.eventType, filters.eventType) : undefined,
		filters.actorId ? eq(workflowAuditEvents.actorId, filters.actorId) : undefined,
		visibleRunIds ? inArray(workflowAuditEvents.workflowInstanceId, visibleRunIds) : undefined,
	].filter(Boolean);

	const events = await db
		.select()
		.from(workflowAuditEvents)
		.where(eventConditions.length ? and(...eventConditions) : sql`true`)
		.orderBy(desc(workflowAuditEvents.createdAt))
		.limit(limit);

	const runIds = [...new Set(events.map((event) => event.workflowInstanceId))];
	const runs = runIds.length
		? await db
			.select()
			.from(workflowInstances)
			.where(inArray(workflowInstances.id, runIds))
			.limit(runIds.length)
		: [];
	const runMap = new Map(runs.map((run) => [run.id, run]));
	const reconstructionRun = resolveReconstructionRun(filters.runId, events, runMap);
	const reconstruction = reconstructionRun
		? await buildReconstruction(reconstructionRun, visibleRunIds)
		: null;

	return {
		filters: {
			runId: filters.runId ?? null,
			subjectType: filters.subjectType ?? null,
			subjectId: filters.subjectId ?? null,
			eventType: filters.eventType ?? null,
			actorId: filters.actorId ?? null,
			limit,
		},
		summary: summarizeEvents(events),
		runs: runs.map(toRunSummary),
		events: events.map(toAuditEvent),
		reconstruction,
		generatedAt: new Date().toISOString(),
	};
}

async function resolveVisibleRunIds(
	runId: string | null | undefined,
	scope: NonNullable<Awaited<ReturnType<typeof getWorkflowViewerScopeFromSession>>>
): Promise<string[] | null> {
	if (scope.isGlobalWorkflowViewer) return null;
	const dashboard = await getWorkflowDashboard(scope, { limit: 500 });
	const visible = dashboard.items.map((item) => item.id);
	if (!runId) return visible;
	return visible.includes(runId) ? [runId] : [];
}

async function buildReconstruction(
	run: WorkflowInstanceRow,
	visibleRunIds: string[] | null
): Promise<WorkflowAuditExplorerProjection["reconstruction"]> {
	if (visibleRunIds && !visibleRunIds.includes(run.id)) return null;
	const timeline = await db
		.select()
		.from(workflowAuditEvents)
		.where(eq(workflowAuditEvents.workflowInstanceId, run.id))
		.orderBy(desc(workflowAuditEvents.createdAt))
		.limit(100);

	return {
		runId: run.id,
		subjectType: run.subjectType,
		subjectId: run.subjectId,
		workflowKey: run.workflowKey,
		currentState: run.state,
		status: run.status,
		timeline: timeline.reverse().map(toAuditEvent),
	};
}

function resolveReconstructionRun(
	runId: string | null | undefined,
	events: WorkflowAuditEventRow[],
	runMap: Map<string, WorkflowInstanceRow>
): WorkflowInstanceRow | null {
	if (runId) return runMap.get(runId) ?? null;
	const firstRunId = events[0]?.workflowInstanceId;
	return firstRunId ? runMap.get(firstRunId) ?? null : null;
}

function summarizeEvents(events: WorkflowAuditEventRow[]) {
	const eventTypes: Record<string, number> = {};
	const runIds = new Set<string>();
	const subjects = new Set<string>();
	for (const event of events) {
		eventTypes[event.eventType] = (eventTypes[event.eventType] ?? 0) + 1;
		runIds.add(event.workflowInstanceId);
		subjects.add(`${event.subjectType}:${event.subjectId}`);
	}
	return {
		totalEvents: events.length,
		runCount: runIds.size,
		subjectCount: subjects.size,
		eventTypes,
	};
}

function toRunSummary(run: WorkflowInstanceRow) {
	return {
		id: run.id,
		workflowKey: run.workflowKey,
		subjectType: run.subjectType,
		subjectId: run.subjectId,
		state: run.state,
		status: run.status,
		updatedAt: toIso(run.updatedAt),
	};
}

function toAuditEvent(event: WorkflowAuditEventRow): WorkflowAuditExplorerEvent {
	return {
		id: event.id,
		workflowInstanceId: event.workflowInstanceId,
		subjectType: event.subjectType,
		subjectId: event.subjectId,
		eventType: event.eventType,
		fromState: event.fromState,
		toState: event.toState,
		actorId: event.actorId,
		actorName: event.actorName,
		reason: event.reason,
		evidenceLinks: event.evidenceLinks ?? [],
		metadata: isRecord(event.metadata) ? event.metadata : {},
		createdAt: toIso(event.createdAt),
	};
}

function normalizeLimit(limit: number | undefined): number {
	if (!limit || !Number.isFinite(limit)) return 100;
	return Math.max(1, Math.min(250, Math.floor(limit)));
}

function emptyProjection(filters: WorkflowAuditExplorerFilters): WorkflowAuditExplorerProjection {
	const limit = normalizeLimit(filters.limit);
	return {
		filters: {
			runId: filters.runId ?? null,
			subjectType: filters.subjectType ?? null,
			subjectId: filters.subjectId ?? null,
			eventType: filters.eventType ?? null,
			actorId: filters.actorId ?? null,
			limit,
		},
		summary: {
			totalEvents: 0,
			runCount: 0,
			subjectCount: 0,
			eventTypes: {},
		},
		runs: [],
		events: [],
		reconstruction: null,
		generatedAt: new Date().toISOString(),
	};
}

function toIso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
