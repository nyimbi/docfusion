import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: vi.fn(async () => ({ userId: "owner-1", organizationId: "org-1" })),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn() },
}));

vi.mock("@/lib/db/schema-comments-workflow", () => ({
	documentWorkflows: {
		id: "document_workflows.id",
		isDefault: "document_workflows.is_default",
		name: "document_workflows.name",
		organizationId: "document_workflows.organization_id",
		documentType: "document_workflows.document_type",
	},
	workflowAssignments: {
		id: "workflow_assignments.id",
		documentId: "workflow_assignments.document_id",
		workflowId: "workflow_assignments.workflow_id",
		stage: "workflow_assignments.stage",
		userId: "workflow_assignments.user_id",
		sequenceOrder: "workflow_assignments.sequence_order",
		dueDate: "workflow_assignments.due_date",
		isActive: "workflow_assignments.is_active",
		assignedBy: "workflow_assignments.assigned_by",
		createdAt: "workflow_assignments.created_at",
		updatedAt: "workflow_assignments.updated_at",
	},
}));

vi.mock("@/lib/db/schema", () => ({
	documents: {
		id: "documents.id",
		ownerId: "documents.owner_id",
	},
}));

interface ChainConfig {
	result?: unknown[];
	rowCount?: number;
	onValues?: (value: Record<string, unknown>) => void;
	onSet?: (value: Record<string, unknown>) => void;
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "limit", "offset", "orderBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
	chain.values = vi.fn((value: Record<string, unknown>) => {
		config.onValues?.(value);
		return chain;
	});
	chain.set = vi.fn((value: Record<string, unknown>) => {
		config.onSet?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => config.result ?? []);
	chain.then = (resolve: (value: unknown) => void) =>
		Promise.resolve(config.rowCount === undefined ? (config.result ?? []) : { rowCount: config.rowCount }).then(resolve);
	return chain;
}

function collectSqlFragments(value: unknown, seen = new Set<object>()): string[] {
	if (typeof value === "string") {
		return [value];
	}
	if (!value || typeof value !== "object") {
		return [];
	}
	if (seen.has(value)) {
		return [];
	}
	seen.add(value);
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectSqlFragments(item, seen));
	}
	return Reflect.ownKeys(value).flatMap((key) =>
		collectSqlFragments((value as Record<PropertyKey, unknown>)[key], seen)
	);
}

function expectOwnerScope(where: unknown) {
	const sqlText = collectSqlFragments(where).join(" ");
	expect(sqlText).toContain("documents.owner_id");
	expect(sqlText).toContain("owner-1");
}

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		select: vi.fn(() => createChain()),
		insert: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import {
	clearDocumentAssignments,
	createAssignment,
	getStageAssignments,
	getWorkflows,
	getWorkflowAssignments,
	updateAssignment,
} from "@/lib/actions/workflows";

const assignment = {
	id: "assignment-1",
	documentId: "doc-1",
	workflowId: null,
	stage: "reviewer",
	userId: "reviewer-1",
	sequenceOrder: 0,
	dueDate: null,
	isActive: "true",
	assignedBy: "owner-1",
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.select.mockReset();
	dbMock.insert.mockReset();
	dbMock.update.mockReset();
});

describe("workflow assignment scoping", () => {
	it("normalizes workflow list pagination", async () => {
		const wheres: unknown[] = [];
		const rowsChain = createChain({
			result: [],
			onWhere: (value) => wheres.push(value),
		});
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{ count: 0 }],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(rowsChain);

		await expect(getWorkflows({ limit: -20, offset: -5 })).resolves.toEqual({
			workflows: [],
			total: 0,
		});

		expect(wheres).toHaveLength(2);
		expect(rowsChain.limit).toHaveBeenCalledWith(1);
		expect(rowsChain.offset).toHaveBeenCalledWith(0);
	});

	it("scopes assignment creation to documents owned by the actor", async () => {
		let documentWhere: unknown;
		let duplicateWhere: unknown;
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{ id: "doc-1" }],
				onWhere: (value) => {
					documentWhere = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => {
					duplicateWhere = value;
				},
			}));
		dbMock.insert.mockReturnValueOnce(createChain({ result: [assignment] }));

		const result = await createAssignment({
			documentId: "doc-1",
			stage: "reviewer",
			userId: "reviewer-1",
		}, "spoofed");

		expect(result.id).toBe("assignment-1");
		expectOwnerScope(documentWhere);
		expectOwnerScope(duplicateWhere);
	});

	it("scopes assignment reads through document ownership", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [assignment],
				onWhere: (value) => {
					wheres.push(value);
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [assignment],
				onWhere: (value) => {
					wheres.push(value);
				},
			}));

		await expect(getWorkflowAssignments("doc-1")).resolves.toHaveLength(1);
		await expect(getStageAssignments("doc-1", "reviewer")).resolves.toHaveLength(1);

		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			expectOwnerScope(where);
		}
	});

	it("scopes assignment update and document clears through document ownership", async () => {
		let updateWhere: unknown;
		let clearWhere: unknown;
		dbMock.update
			.mockReturnValueOnce(createChain({
				result: [{ ...assignment, isActive: "false" }],
				onWhere: (value) => {
					updateWhere = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				rowCount: 2,
				onWhere: (value) => {
					clearWhere = value;
				},
			}));

		await updateAssignment("assignment-1", { isActive: false });
		const cleared = await clearDocumentAssignments("doc-1");

		expect(cleared).toBe(2);
		expectOwnerScope(updateWhere);
		expectOwnerScope(clearWhere);
	});
});
