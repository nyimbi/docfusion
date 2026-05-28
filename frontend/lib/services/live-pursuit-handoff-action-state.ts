import fs from "node:fs/promises";
import path from "node:path";
import {
	readLatestLivePursuitHandoff,
	resolveLatestHandoffWorkspaceRoot,
} from "@/lib/services/latest-live-pursuit-handoff";
import type {
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

function optionalTrimmed(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function isMissingPathError(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}
