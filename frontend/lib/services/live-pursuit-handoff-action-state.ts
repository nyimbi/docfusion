import fs from "node:fs/promises";
import path from "node:path";
import {
	readLatestLivePursuitHandoff,
	resolveLatestHandoffWorkspaceRoot,
} from "@/lib/services/latest-live-pursuit-handoff";
import type {
	LatestLivePursuitHandoffActionReadiness,
	LatestLivePursuitHandoffTask,
	LatestLivePursuitHandoffTaskActionAuditEvent,
	LatestLivePursuitHandoffTaskActionState,
	LatestLivePursuitHandoffTaskActionStatus,
	LatestLivePursuitHandoffTaskActionUpdate,
} from "@/lib/types/latest-live-pursuit-handoff";

const ACTION_STATE_RELATIVE_PATH = path.join(".omx", "state", "latest-live-pursuit-handoff-action-state.json");
const ACTION_AUDIT_RELATIVE_PATH = path.join(".omx", "state", "latest-live-pursuit-handoff-action-events.md");
const VALID_STATUSES = new Set<LatestLivePursuitHandoffTaskActionStatus>([
	"pending_operator_action",
	"in_progress",
	"completed",
	"blocked",
]);

interface LatestLivePursuitHandoffActionStateFile {
	runId: string;
	updatedAt: string;
	tasks: Record<string, LatestLivePursuitHandoffTaskActionState>;
}

export async function readLatestLivePursuitHandoffActionStates(options: {
	workspaceRoot?: string;
	runId?: string;
} = {}): Promise<Record<string, LatestLivePursuitHandoffTaskActionState>> {
	const workspaceRoot = options.workspaceRoot ?? resolveLatestHandoffWorkspaceRoot();
	const statePath = path.resolve(workspaceRoot, ACTION_STATE_RELATIVE_PATH);
	try {
		const parsed = JSON.parse(await fs.readFile(statePath, "utf8")) as LatestLivePursuitHandoffActionStateFile;
		if (options.runId && parsed.runId !== options.runId) return {};
		return parsed.tasks ?? {};
	} catch (error) {
		if (isMissingPathError(error)) return {};
		throw error;
	}
}

export async function readLatestLivePursuitHandoffActionAuditEvents(options: {
	workspaceRoot?: string;
	runId?: string;
	limit?: number;
} = {}): Promise<LatestLivePursuitHandoffTaskActionAuditEvent[]> {
	const workspaceRoot = options.workspaceRoot ?? resolveLatestHandoffWorkspaceRoot();
	const auditPath = path.resolve(workspaceRoot, ACTION_AUDIT_RELATIVE_PATH);
	try {
		const rawAudit = await fs.readFile(auditPath, "utf8");
		const events = rawAudit
			.split(/\r?\n/)
			.map((line) => parseActionAuditEventLine(line, workspaceRoot, auditPath))
			.filter((event): event is LatestLivePursuitHandoffTaskActionAuditEvent => Boolean(event))
			.filter((event) => !options.runId || event.runId === options.runId)
			.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
		return typeof options.limit === "number" ? events.slice(0, Math.max(0, options.limit)) : events;
	} catch (error) {
		if (isMissingPathError(error)) return [];
		throw error;
	}
}

export function summarizeLatestLivePursuitHandoffActionReadiness(input: {
	tasks: LatestLivePursuitHandoffTask[];
	actionStates: Record<string, LatestLivePursuitHandoffTaskActionState>;
}): LatestLivePursuitHandoffActionReadiness {
	const blockedTaskIds: string[] = [];
	const pendingTaskIds: string[] = [];
	const criticalIncompleteTaskIds: string[] = [];
	const missingEvidenceTaskIds: string[] = [];
	let completedTaskCount = 0;
	let updatedAt: string | undefined;

	for (const task of input.tasks) {
		const state = input.actionStates[task.id];
		const status = state?.status ?? task.status;
		if (state?.updatedAt && (!updatedAt || state.updatedAt > updatedAt)) {
			updatedAt = state.updatedAt;
		}

		if (status === "completed") {
			completedTaskCount += 1;
			if (!hasCompletionEvidence(state)) {
				missingEvidenceTaskIds.push(task.id);
			}
			continue;
		}

		if (status === "blocked") {
			blockedTaskIds.push(task.id);
		} else {
			pendingTaskIds.push(task.id);
		}
		if (task.priority === "critical") {
			criticalIncompleteTaskIds.push(task.id);
		}
	}

	const reasons = readinessReasons({
		taskCount: input.tasks.length,
		completedTaskCount,
		blockedTaskIds,
		pendingTaskIds,
		criticalIncompleteTaskIds,
		missingEvidenceTaskIds,
	});
	const status = blockedTaskIds.length > 0 || criticalIncompleteTaskIds.length > 0 || missingEvidenceTaskIds.length > 0
		? "blocked"
		: completedTaskCount === input.tasks.length ? "ready_for_submission" : "in_progress";
	return {
		status,
		taskCount: input.tasks.length,
		completedTaskCount,
		blockedTaskIds,
		pendingTaskIds,
		criticalIncompleteTaskIds,
		missingEvidenceTaskIds,
		reasons,
		updatedAt,
	};
}

export async function updateLatestLivePursuitHandoffTaskActionState(input: {
	taskId: string;
	status: LatestLivePursuitHandoffTaskActionStatus;
	assigneeName?: string;
	evidenceNote?: string;
	receiptUrl?: string;
	updatedByUserId: string;
	workspaceRoot?: string;
}): Promise<LatestLivePursuitHandoffTaskActionUpdate> {
	if (!input.taskId.trim()) throw new Error("taskId is required");
	if (!VALID_STATUSES.has(input.status)) throw new Error(`Unsupported handoff task status: ${input.status}`);

	const workspaceRoot = input.workspaceRoot ?? resolveLatestHandoffWorkspaceRoot();
	const latest = await readLatestLivePursuitHandoff({ workspaceRoot });
	const task = latest.index.executionPlan.tasks.find((candidate) => candidate.id === input.taskId);
	if (!task) throw new Error(`Latest live handoff task not found: ${input.taskId}`);
	if (input.status === "completed" && !optionalTrimmed(input.evidenceNote) && !optionalTrimmed(input.receiptUrl)) {
		throw new Error("Completed handoff tasks require an evidence note or receipt URL");
	}

	const existing = await readActionStateFile(workspaceRoot, latest.index.runId);
	const nextTaskState: LatestLivePursuitHandoffTaskActionState = {
		taskId: task.id,
		status: input.status,
		assigneeName: optionalTrimmed(input.assigneeName),
		evidenceNote: optionalTrimmed(input.evidenceNote),
		receiptUrl: optionalTrimmed(input.receiptUrl),
		updatedAt: new Date().toISOString(),
		updatedByUserId: input.updatedByUserId,
	};
	const nextState: LatestLivePursuitHandoffActionStateFile = {
		runId: latest.index.runId,
		updatedAt: nextTaskState.updatedAt,
		tasks: {
			...existing.tasks,
			[task.id]: nextTaskState,
		},
	};
	await writeActionStateFile(workspaceRoot, nextState);
	const auditEvent = await appendActionAuditEvent(workspaceRoot, {
		runId: latest.index.runId,
		taskId: task.id,
		taskTitle: task.title,
		status: nextTaskState.status,
		assigneeName: nextTaskState.assigneeName,
		evidenceNote: nextTaskState.evidenceNote,
		receiptUrl: nextTaskState.receiptUrl,
		updatedAt: nextTaskState.updatedAt,
		updatedByUserId: nextTaskState.updatedByUserId,
	});
	return {
		taskState: nextTaskState,
		auditEvent,
		actionReadiness: summarizeLatestLivePursuitHandoffActionReadiness({
			tasks: latest.index.executionPlan.tasks,
			actionStates: nextState.tasks,
		}),
	};
}

async function readActionStateFile(
	workspaceRoot: string,
	runId: string,
): Promise<LatestLivePursuitHandoffActionStateFile> {
	const statePath = path.resolve(workspaceRoot, ACTION_STATE_RELATIVE_PATH);
	try {
		const parsed = JSON.parse(await fs.readFile(statePath, "utf8")) as LatestLivePursuitHandoffActionStateFile;
		if (parsed.runId !== runId) {
			return { runId, updatedAt: new Date().toISOString(), tasks: {} };
		}
		return {
			runId,
			updatedAt: parsed.updatedAt,
			tasks: parsed.tasks ?? {},
		};
	} catch (error) {
		if (isMissingPathError(error)) {
			return { runId, updatedAt: new Date().toISOString(), tasks: {} };
		}
		throw error;
	}
}

async function writeActionStateFile(
	workspaceRoot: string,
	state: LatestLivePursuitHandoffActionStateFile,
): Promise<void> {
	const statePath = path.resolve(workspaceRoot, ACTION_STATE_RELATIVE_PATH);
	await fs.mkdir(path.dirname(statePath), { recursive: true });
	const tempPath = `${statePath}.tmp`;
	await fs.writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
	await fs.rename(tempPath, statePath);
}

async function appendActionAuditEvent(
	workspaceRoot: string,
	event: {
		runId: string;
		taskId: string;
		taskTitle: string;
		status: LatestLivePursuitHandoffTaskActionStatus;
		assigneeName?: string;
		evidenceNote?: string;
		receiptUrl?: string;
		updatedAt: string;
		updatedByUserId: string;
	},
): Promise<LatestLivePursuitHandoffTaskActionUpdate["auditEvent"]> {
	const auditPath = path.resolve(workspaceRoot, ACTION_AUDIT_RELATIVE_PATH);
	await fs.mkdir(path.dirname(auditPath), { recursive: true });
	await ensureActionAuditHeader(auditPath);
	const eventId = `lhp_${event.updatedAt.replace(/[-:.]/g, "").replace("T", "_").replace("Z", "Z")}_${event.taskId}`;
	const row = [
		event.updatedAt,
		`\`${event.runId}\``,
		`\`${event.taskId}\``,
		escapeMarkdownCell(event.taskTitle),
		event.status,
		escapeMarkdownCell(event.assigneeName ?? ""),
		escapeMarkdownCell(event.evidenceNote ?? ""),
		escapeMarkdownCell(event.receiptUrl ?? ""),
		`\`${event.updatedByUserId}\``,
		`\`${eventId}\``,
	].join(" | ");
	await fs.appendFile(auditPath, `| ${row} |\n`, "utf8");
	return {
		eventId,
		runId: event.runId,
		taskId: event.taskId,
		taskTitle: event.taskTitle,
		status: event.status,
		assigneeName: event.assigneeName,
		evidenceNote: event.evidenceNote,
		receiptUrl: event.receiptUrl,
		updatedAt: event.updatedAt,
		updatedByUserId: event.updatedByUserId,
		auditPath: path.relative(workspaceRoot, auditPath),
	};
}

async function ensureActionAuditHeader(auditPath: string): Promise<void> {
	try {
		const existing = await fs.readFile(auditPath, "utf8");
		if (existing.trim().length > 0) return;
	} catch (error) {
		if (!isMissingPathError(error)) throw error;
	}
	await fs.writeFile(
		auditPath,
		[
			"# Latest Live Pursuit Handoff Action Events",
			"",
			"| updated_at | run_id | task_id | task_title | status | assignee | evidence_note | receipt_url | updated_by | event_id |",
			"|---|---|---|---|---|---|---|---|---|---|",
			"",
		].join("\n"),
		"utf8",
	);
}

function escapeMarkdownCell(value: string): string {
	return value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function parseActionAuditEventLine(
	line: string,
	workspaceRoot: string,
	auditPath: string,
): LatestLivePursuitHandoffTaskActionAuditEvent | null {
	const cells = parseMarkdownTableRow(line);
	if (cells.length !== 10) return null;
	if (cells[0] === "updated_at" || cells[0].startsWith("---")) return null;
	const status = cells[4] as LatestLivePursuitHandoffTaskActionStatus;
	if (!VALID_STATUSES.has(status)) return null;
	return {
		updatedAt: cells[0],
		runId: unwrapCodeCell(cells[1]),
		taskId: unwrapCodeCell(cells[2]),
		taskTitle: cells[3],
		status,
		assigneeName: optionalTrimmed(cells[5]),
		evidenceNote: optionalTrimmed(cells[6]),
		receiptUrl: optionalTrimmed(cells[7]),
		updatedByUserId: unwrapCodeCell(cells[8]),
		eventId: unwrapCodeCell(cells[9]),
		auditPath: path.relative(workspaceRoot, auditPath),
	};
}

function parseMarkdownTableRow(line: string): string[] {
	const trimmed = line.trim();
	if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
	const cells: string[] = [];
	let cell = "";
	const body = trimmed.slice(1, -1);
	for (let index = 0; index < body.length; index += 1) {
		const character = body[index];
		if (character === "|" && body[index - 1] !== "\\") {
			cells.push(unescapeMarkdownCell(cell));
			cell = "";
		} else {
			cell += character;
		}
	}
	cells.push(unescapeMarkdownCell(cell));
	return cells;
}

function unescapeMarkdownCell(value: string): string {
	return value.replace(/\\\|/g, "|").replace(/\s+/g, " ").trim();
}

function unwrapCodeCell(value: string): string {
	return value.replace(/^`/, "").replace(/`$/, "");
}

function hasCompletionEvidence(state: LatestLivePursuitHandoffTaskActionState | undefined): boolean {
	return Boolean(optionalTrimmed(state?.evidenceNote) || optionalTrimmed(state?.receiptUrl));
}

function readinessReasons(input: {
	taskCount: number;
	completedTaskCount: number;
	blockedTaskIds: string[];
	pendingTaskIds: string[];
	criticalIncompleteTaskIds: string[];
	missingEvidenceTaskIds: string[];
}): string[] {
	const reasons: string[] = [];
	if (input.blockedTaskIds.length > 0) {
		reasons.push(`${input.blockedTaskIds.length} blocked task${input.blockedTaskIds.length === 1 ? "" : "s"}`);
	}
	if (input.criticalIncompleteTaskIds.length > 0) {
		reasons.push(`${input.criticalIncompleteTaskIds.length} critical task${input.criticalIncompleteTaskIds.length === 1 ? "" : "s"} incomplete`);
	}
	if (input.missingEvidenceTaskIds.length > 0) {
		reasons.push(`${input.missingEvidenceTaskIds.length} completed task${input.missingEvidenceTaskIds.length === 1 ? "" : "s"} missing evidence`);
	}
	if (reasons.length === 0 && input.completedTaskCount === input.taskCount) {
		reasons.push("All handoff tasks are complete with evidence");
	}
	if (reasons.length === 0) {
		reasons.push(`${input.pendingTaskIds.length} handoff task${input.pendingTaskIds.length === 1 ? "" : "s"} still in progress`);
	}
	return reasons;
}

function optionalTrimmed(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function isMissingPathError(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}
