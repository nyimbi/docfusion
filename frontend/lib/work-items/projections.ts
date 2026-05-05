export type WorkItemKind =
	| "workflow"
	| "task"
	| "notification"
	| "exception"
	| "approval"
	| "comment"
	| "portal";

export type WorkItemPriority = "critical" | "high" | "medium" | "low";

export interface WorkItem {
	id: string;
	kind: WorkItemKind;
	title: string;
	description?: string | null;
	status: string;
	priority: WorkItemPriority;
	owner?: string | null;
	role?: string | null;
	dueAt?: string | null;
	updatedAt?: string | null;
	opportunityId?: string | null;
	subjectType?: string | null;
	subjectId?: string | null;
	actionUrl?: string | null;
	disabledReason?: string | null;
	blocker?: string | null;
	portalVisible?: boolean;
	auditRef?: string | null;
	source: string;
}

export interface WorkItemSummary {
	total: number;
	open: number;
	blocked: number;
	overdue: number;
	dueSoon: number;
	critical: number;
	byKind: Record<string, number>;
}

export interface CommandCenterBlocker {
	id: string;
	label: string;
	severity: "critical" | "high" | "medium" | "low";
	owner?: string | null;
	dueAt?: string | null;
	actionUrl?: string | null;
}

export interface CommandCenterNextAction {
	id: string;
	label: string;
	priority: WorkItemPriority;
	actionUrl?: string | null;
	disabledReason?: string | null;
	source: string;
}

export interface ReadinessScore {
	score: number;
	label: "ready" | "watch" | "blocked";
	reasons: string[];
}

const PRIORITY_SCORE: Record<WorkItemPriority, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
};

const OPEN_STATUSES = new Set([
	"active",
	"assigned",
	"blocked",
	"breached",
	"escalated",
	"in_progress",
	"open",
	"pending",
	"queued",
	"review",
	"waiting",
]);

const BLOCKED_STATUSES = new Set(["blocked", "breached", "escalated", "failed"]);

export function normalizeWorkItems(items: WorkItem[], now = new Date()): WorkItem[] {
	return items
		.map((item) => ({
			...item,
			priority: item.priority ?? "medium",
			blocker: item.blocker ?? deriveItemBlocker(item, now),
		}))
		.sort((a, b) => {
			const priorityDelta = PRIORITY_SCORE[a.priority] - PRIORITY_SCORE[b.priority];
			if (priorityDelta !== 0) return priorityDelta;
			const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
			const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
			if (aDue !== bDue) return aDue - bDue;
			return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
		});
}

export function summarizeWorkItems(items: WorkItem[], now = new Date()): WorkItemSummary {
	const dueSoonCutoff = now.getTime() + 48 * 60 * 60 * 1000;
	const summary: WorkItemSummary = {
		total: items.length,
		open: 0,
		blocked: 0,
		overdue: 0,
		dueSoon: 0,
		critical: 0,
		byKind: {},
	};

	for (const item of items) {
		const status = item.status.toLowerCase();
		summary.byKind[item.kind] = (summary.byKind[item.kind] ?? 0) + 1;
		if (OPEN_STATUSES.has(status)) summary.open += 1;
		if (BLOCKED_STATUSES.has(status) || item.blocker) summary.blocked += 1;
		if (item.priority === "critical") summary.critical += 1;
		if (item.dueAt) {
			const due = new Date(item.dueAt).getTime();
			if (Number.isFinite(due) && due < now.getTime() && OPEN_STATUSES.has(status)) {
				summary.overdue += 1;
			} else if (Number.isFinite(due) && due <= dueSoonCutoff && OPEN_STATUSES.has(status)) {
				summary.dueSoon += 1;
			}
		}
	}

	return summary;
}

export function deriveCommandCenterBlockers(items: WorkItem[], now = new Date()): CommandCenterBlocker[] {
	return normalizeWorkItems(items, now)
		.filter((item) => item.blocker || BLOCKED_STATUSES.has(item.status.toLowerCase()) || isOverdue(item, now))
		.slice(0, 8)
		.map((item) => ({
			id: item.id,
			label: item.blocker ?? item.title,
			severity: item.priority,
			owner: item.owner ?? item.role,
			dueAt: item.dueAt,
			actionUrl: item.actionUrl,
		}));
}

export function deriveCommandCenterNextActions(items: WorkItem[], now = new Date()): CommandCenterNextAction[] {
	return normalizeWorkItems(items, now)
		.filter((item) => OPEN_STATUSES.has(item.status.toLowerCase()))
		.slice(0, 5)
		.map((item) => ({
			id: item.id,
			label: item.title,
			priority: item.priority,
			actionUrl: item.actionUrl,
			disabledReason: item.disabledReason,
			source: item.source,
		}));
}

export function deriveReadinessScore(items: WorkItem[], now = new Date()): ReadinessScore {
	const summary = summarizeWorkItems(items, now);
	const penalties =
		(summary.blocked * 18) +
		(summary.overdue * 14) +
		(summary.critical * 8) +
		(summary.dueSoon * 4);
	const score = Math.max(0, Math.min(100, 100 - penalties));
	const reasons: string[] = [];
	if (summary.blocked) reasons.push(`${summary.blocked} blocker${summary.blocked === 1 ? "" : "s"}`);
	if (summary.overdue) reasons.push(`${summary.overdue} overdue item${summary.overdue === 1 ? "" : "s"}`);
	if (summary.critical) reasons.push(`${summary.critical} critical item${summary.critical === 1 ? "" : "s"}`);
	if (summary.dueSoon) reasons.push(`${summary.dueSoon} due soon`);
	if (!reasons.length) reasons.push("No active blockers in the current projection");

	return {
		score,
		label: score >= 85 ? "ready" : score >= 60 ? "watch" : "blocked",
		reasons,
	};
}

function deriveItemBlocker(item: WorkItem, now: Date): string | null {
	const status = item.status.toLowerCase();
	if (status === "blocked") return "Blocked work item";
	if (status === "breached") return "SLA breached";
	if (status === "escalated") return "Escalated workflow";
	if (status === "failed") return "Failed delivery or job";
	if (isOverdue(item, now)) return "Past due";
	return null;
}

function isOverdue(item: WorkItem, now: Date): boolean {
	if (!item.dueAt) return false;
	const due = new Date(item.dueAt).getTime();
	return Number.isFinite(due) && due < now.getTime() && OPEN_STATUSES.has(item.status.toLowerCase());
}
