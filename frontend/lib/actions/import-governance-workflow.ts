"use server";

import { requireUserContext } from "@/lib/auth-utils";
import { rollbackImport } from "@/lib/actions/import";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";
import { db } from "@/lib/db";
import { dataImports, type ImportError } from "@/lib/db/schema-import";
import { eq } from "drizzle-orm";

type DataImportRow = typeof dataImports.$inferSelect;

export type ImportGovernanceAction =
	| "preview_ready"
	| "approve_execute"
	| "mark_completed"
	| "rollback"
	| "cancel";

export interface ImportGovernanceWorkflowInput {
	importId: string;
	action: ImportGovernanceAction;
	reason: string;
	previewErrors?: ImportError[];
	assignedTo?: string | null;
	dueAt?: Date | string | null;
	authorityRole?: string | null;
}

export interface ImportGovernanceWorkflowResult {
	importId: string;
	targetTable: string;
	fromState: string;
	toState: string;
	workflowInstanceId: string;
	taskProjected: boolean;
	deletedCount?: number;
}

const WORKFLOW_KEY = "import_preview_execute_rollback";
const SUBJECT_TYPE = "import_sync_job";

export async function transitionImportGovernanceWorkflow(
	input: ImportGovernanceWorkflowInput
): Promise<ImportGovernanceWorkflowResult> {
	const userContext = await requireUserContext();
	const reason = requireReason(input.reason, "Import workflow transitions require a reason");
	const record = await loadImport(input.importId);
	if (record.importedBy && record.importedBy !== userContext.userId) {
		throw new Error("Import workflow can only be changed by the initiating user");
	}

	const fromState = record.status ?? "pending";
	const transition = await buildTransition({
		input,
		record,
		userContext: {
			userId: userContext.userId,
			organizationId: userContext.organizationId,
		},
		reason,
	});

	if (transition.patch) {
		await db
			.update(dataImports)
			.set(transition.patch)
			.where(eq(dataImports.id, input.importId));
	}

	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: WORKFLOW_KEY,
		subjectType: SUBJECT_TYPE,
		subjectId: input.importId,
		fromState,
		toState: transition.toState,
		eventType: `import_${input.action}`,
		actorId: userContext.userId,
		reason,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : transition.assignedRole,
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 1),
		authorityPolicy: input.authorityRole
			? { requiredRoles: [input.authorityRole] }
			: undefined,
		metadata: {
			importId: input.importId,
			action: input.action,
			filename: record.filename,
			targetTable: record.targetTable,
			totalRows: record.totalRows ?? 0,
			importedRows: record.importedRows ?? 0,
			failedRows: record.failedRows ?? 0,
			deletedCount: transition.deletedCount ?? null,
			previewErrorCount: input.previewErrors?.length ?? 0,
			authorityRole: input.authorityRole ?? null,
		},
		terminal: transition.terminal,
		actionUrl: `/import`,
	});

	await upsertWorkflowRuntimeTask({
		workflowInstanceId: instance.id,
		taskKey: `import-governance:${input.importId}`,
		title: transition.taskTitle,
		description: `${transition.taskTitle}. Reason: ${reason}`,
		state: transition.taskState,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : transition.assignedRole,
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 1),
		metadata: {
			importId: input.importId,
			fromState,
			toState: transition.toState,
			deletedCount: transition.deletedCount ?? null,
		},
	});

	return {
		importId: input.importId,
		targetTable: record.targetTable,
		fromState,
		toState: transition.toState,
		workflowInstanceId: instance.id,
		taskProjected: true,
		deletedCount: transition.deletedCount,
	};
}

async function loadImport(importId: string) {
	const [record] = await db
		.select()
		.from(dataImports)
		.where(eq(dataImports.id, importId))
		.limit(1);
	if (!record) {
		throw new Error("Import not found");
	}
	return record;
}

async function buildTransition(input: {
	input: ImportGovernanceWorkflowInput;
	record: DataImportRow;
	userContext: { userId: string; organizationId?: string };
	reason: string;
}): Promise<{
	toState: string;
	terminal: boolean;
	taskState: "open" | "in_progress" | "blocked" | "completed" | "cancelled";
	taskTitle: string;
	priority: "critical" | "high" | "medium" | "low";
	assignedRole: string;
	patch?: Partial<typeof dataImports.$inferInsert>;
	deletedCount?: number;
}> {
	const now = new Date();
	switch (input.input.action) {
		case "preview_ready":
			return {
				toState: input.input.previewErrors?.length ? "preview_blocked" : "preview_ready",
				terminal: false,
				taskState: input.input.previewErrors?.length ? "blocked" : "open",
				taskTitle: input.input.previewErrors?.length ? "Fix import preview validation errors" : "Approve import execution",
				priority: input.input.previewErrors?.length ? "high" : "medium",
				assignedRole: input.input.previewErrors?.length ? "data_steward" : "import_approver",
				patch: {
					status: "pending",
					errors: input.input.previewErrors ?? input.record.errors ?? [],
				},
			};
		case "approve_execute":
			requireAuthority(input.input.authorityRole, "Approving import execution requires import authority");
			if ((input.record.failedRows ?? 0) > 0) {
				throw new Error("Import execution cannot be approved while failed preview rows remain");
			}
			return {
				toState: "execution_approved",
				terminal: false,
				taskState: "in_progress",
				taskTitle: "Execute approved import",
				priority: "high",
				assignedRole: "data_import_operator",
				patch: {
					status: "processing",
					startedAt: input.record.startedAt ?? now,
				},
			};
		case "mark_completed":
			return {
				toState: "completed",
				terminal: true,
				taskState: "completed",
				taskTitle: "Import completed",
				priority: "medium",
				assignedRole: "data_import_operator",
				patch: {
					status: "completed",
					completedAt: input.record.completedAt ?? now,
				},
			};
		case "rollback": {
			requireAuthority(input.input.authorityRole, "Rolling back an import requires import authority");
			const rollback = await rollbackImport(input.input.importId, input.userContext);
			if (!rollback.success) {
				throw new Error(rollback.error ?? "Import rollback failed");
			}
			return {
				toState: "rolled_back",
				terminal: true,
				taskState: "completed",
				taskTitle: "Import rollback completed",
				priority: "high",
				assignedRole: "data_import_operator",
				deletedCount: rollback.deletedCount,
			};
		}
		case "cancel":
			requireAuthority(input.input.authorityRole, "Cancelling an import requires import authority");
			return {
				toState: "cancelled",
				terminal: true,
				taskState: "cancelled",
				taskTitle: "Import cancelled",
				priority: "medium",
				assignedRole: "data_import_operator",
				patch: {
					status: "cancelled",
					completedAt: now,
				},
			};
	}
}

function requireReason(value: string | null | undefined, message: string) {
	const reason = value?.trim();
	if (!reason) {
		throw new Error(message);
	}
	return reason;
}

function requireAuthority(value: string | null | undefined, message: string) {
	if (!value?.trim()) {
		throw new Error(message);
	}
}

function normalizeDueAt(value: Date | string | null | undefined, fallbackDays: number) {
	if (value instanceof Date) {
		return value;
	}
	if (typeof value === "string" && value.trim()) {
		return new Date(value);
	}
	const dueAt = new Date();
	dueAt.setDate(dueAt.getDate() + fallbackDays);
	return dueAt;
}
