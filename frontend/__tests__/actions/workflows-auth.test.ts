import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema-comments-workflow", () => ({
	documentWorkflows: {},
	workflowAssignments: {},
}));
vi.mock("@/lib/db/schema", () => ({
	documents: {},
}));

import {
	applyWorkflowToDocument,
	bulkCreateAssignments,
	clearDocumentAssignments,
	createAssignment,
	createWorkflow,
	deleteAssignment,
	deleteWorkflow,
	getStageAssignments,
	getWorkflowAssignments,
	initializeDefaultWorkflow,
	updateAssignment,
	updateWorkflow,
} from "@/lib/actions/workflows";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockRejectedValue(new Error("Unauthorized"));
});

describe("workflow action auth", () => {
	it("rejects unauthenticated workflow writes before database access", async () => {
		await expect(createWorkflow({
			name: "Review",
			stages: [],
		})).rejects.toThrow("Unauthorized");
		await expect(updateWorkflow("workflow-1", { name: "Updated" })).rejects.toThrow("Unauthorized");
		await expect(deleteWorkflow("workflow-1")).rejects.toThrow("Unauthorized");

		await expect(getWorkflowAssignments("doc-1")).rejects.toThrow("Unauthorized");
		await expect(getStageAssignments("doc-1", "reviewer")).rejects.toThrow("Unauthorized");
		await expect(createAssignment({
			documentId: "doc-1",
			stage: "reviewer",
			userId: "assignee-1",
		}, "spoofed-assigner")).rejects.toThrow("Unauthorized");
		await expect(bulkCreateAssignments({
			documentId: "doc-1",
			assignments: [{
				stage: "reviewer",
				userId: "assignee-1",
			}],
		}, "spoofed-assigner")).rejects.toThrow("Unauthorized");
		await expect(updateAssignment("assignment-1", { isActive: false })).rejects.toThrow("Unauthorized");
		await expect(deleteAssignment("assignment-1")).rejects.toThrow("Unauthorized");
		await expect(clearDocumentAssignments("doc-1")).rejects.toThrow("Unauthorized");

		await expect(initializeDefaultWorkflow("doc-1", "spoofed-creator")).rejects.toThrow("Unauthorized");
		await expect(applyWorkflowToDocument("doc-1", "workflow-1", {
			reviewer: ["assignee-1"],
		} as never)).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("rejects spoofed workflow organization IDs before database access", async () => {
		requireUserContextMock.mockResolvedValue({
			userId: "workflow-user-1",
			organizationId: "org-session",
		});

		await expect(createWorkflow({
			name: "Review",
			stages: [],
			organizationId: "org-other",
		})).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
