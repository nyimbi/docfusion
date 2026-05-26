import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserContextMock } = vi.hoisted(() => ({
	requireUserContextMock: vi.fn(async () => ({
		userId: "import-owner-1",
		organizationId: "org-1",
		roles: ["import_approver"],
	})),
}));

vi.mock("@/lib/auth-utils", () => {
	const assertUserHasAuthorityRole = (context: { role?: string; roles?: string[] }, requiredRole: string | null | undefined, message: string) => {
		const role = requiredRole?.trim().toLowerCase();
		if (!role) throw new Error(message);
		const roles = new Set([context.role, ...(context.roles ?? [])].filter(Boolean).map((value) => String(value).trim().toLowerCase()));
		if (!roles.has("admin") && !roles.has(role)) {
			throw new Error(`${message}: requires ${role}`);
		}
		return role;
	};
	return {
		requireUserContext: requireUserContextMock,
		assertUserHasAuthorityRole,
	};
});

vi.mock("@/lib/actions/import", () => ({
	rollbackImport: vi.fn(async () => ({ success: true, deletedCount: 3 })),
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "import-workflow-1" })),
	upsertWorkflowRuntimeTask: vi.fn(async () => ({ id: "import-task-1" })),
}));

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "limit"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.set = vi.fn((value: Record<string, unknown>) => {
		config.onSet?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => config.result ?? []);
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		select: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import { rollbackImport } from "@/lib/actions/import";
import { transitionImportGovernanceWorkflow } from "@/lib/actions/import-governance-workflow";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

const importRecord = {
	id: "import-1",
	organizationId: "org-1",
	filename: "opportunities.csv",
	fileType: "csv",
	fileSize: 2048,
	sheetName: null,
	targetTable: "opportunities",
	templateId: null,
	mappingsUsed: [],
	totalRows: 10,
	importedRows: 3,
	updatedRows: 0,
	skippedRows: 0,
	failedRows: 0,
	status: "pending",
	errors: [],
	duplicateHandling: "skip",
	batchSize: 100,
	importedIds: ["opp-1", "opp-2", "opp-3"],
	startedAt: new Date("2026-05-05T00:00:00.000Z"),
	completedAt: null,
	importedBy: "import-owner-1",
	createdAt: new Date("2026-05-05T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "import-owner-1",
		organizationId: "org-1",
		roles: ["import_approver"],
	});
	vi.mocked(rollbackImport).mockResolvedValue({ success: true, deletedCount: 3 });
	dbMock.select.mockReset();
	dbMock.update.mockReset();
});

describe("import governance workflow", () => {
	it("records a blocked preview when validation errors remain", async () => {
		let patch: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({ result: [importRecord] }));
		dbMock.update.mockReturnValueOnce(createChain({
			onSet: (value) => {
				patch = value;
			},
		}));

		const result = await transitionImportGovernanceWorkflow({
			importId: "import-1",
			action: "preview_ready",
			reason: "Preview generated with missing title",
			previewErrors: [{ row: 2, column: "title", error: "Title is required" }],
		});

		expect(result).toMatchObject({
			importId: "import-1",
			targetTable: "opportunities",
			fromState: "pending",
			toState: "preview_blocked",
		});
		expect(patch).toMatchObject({
			status: "pending",
			errors: [{ row: 2, column: "title", error: "Title is required" }],
		});
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(
			expect.objectContaining({
				taskKey: "import-governance:import-1",
				state: "blocked",
				assignedRole: "data_steward",
			})
		);
	});

	it("requires import authority before approving execution", async () => {
		dbMock.select.mockReturnValueOnce(createChain({ result: [importRecord] }));

		await expect(transitionImportGovernanceWorkflow({
			importId: "import-1",
			action: "approve_execute",
			reason: "Mapping reviewed",
		})).rejects.toThrow("requires import authority");
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("approves execution and projects operator work", async () => {
		let patch: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({ result: [importRecord] }));
		dbMock.update.mockReturnValueOnce(createChain({
			onSet: (value) => {
				patch = value;
			},
		}));

		const result = await transitionImportGovernanceWorkflow({
			importId: "import-1",
			action: "approve_execute",
			reason: "Mapping reviewed",
			authorityRole: "import_approver",
		});

		expect(result.toState).toBe("execution_approved");
		expect(patch).toMatchObject({
			status: "processing",
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: "import_approve_execute",
				assignedRole: "data_import_operator",
				authorityPolicy: { requiredRoles: ["import_approver"] },
				terminal: false,
			})
		);
	});

	it("rejects claimed import authority when the initiating actor lacks the role", async () => {
		requireUserContextMock.mockResolvedValueOnce({
			userId: "import-owner-1",
			organizationId: "org-1",
			roles: ["data_steward"],
		});
		dbMock.select.mockReturnValueOnce(createChain({ result: [importRecord] }));

		await expect(transitionImportGovernanceWorkflow({
			importId: "import-1",
			action: "approve_execute",
			reason: "Mapping reviewed",
			authorityRole: "import_approver",
		})).rejects.toThrow("requires import_approver");
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("rolls back through the existing import rollback path and records deleted count", async () => {
		dbMock.select.mockReturnValueOnce(createChain({ result: [{ ...importRecord, status: "completed" }] }));

		const result = await transitionImportGovernanceWorkflow({
			importId: "import-1",
			action: "rollback",
			reason: "Wrong source file imported",
			authorityRole: "import_approver",
		});

		expect(rollbackImport).toHaveBeenCalledWith("import-1", expect.objectContaining({
			userId: "import-owner-1",
			organizationId: "org-1",
			roles: ["import_approver"],
		}));
		expect(result).toMatchObject({
			toState: "rolled_back",
			deletedCount: 3,
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				toState: "rolled_back",
				terminal: true,
				metadata: expect.objectContaining({
					deletedCount: 3,
				}),
			})
		);
	});
});
