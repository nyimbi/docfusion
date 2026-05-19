import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema-comments-workflow", () => ({
	documentApprovals: {},
	workflowAssignments: {},
}));
vi.mock("@/lib/db/schema", () => ({
	documents: {},
	proposalDocuments: {},
}));
vi.mock("@/lib/db/auth-schema", () => ({
	user: {},
}));
vi.mock("@/lib/security/public-url", () => ({
	fetchPublicHttpUrl: vi.fn(),
}));
vi.mock("@/lib/utils/logger", () => ({
	logger: {
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

import {
	cancelWorkflow,
	createApproval,
	deleteApproval,
	getApproval,
	getApprovals,
	getOverdueApprovals,
	getPendingApprovalsForUser,
	getUpcomingDeadlines,
	getWorkflowStatus,
	initializeWorkflow,
	reassignApprovals,
	submitReview,
	updateApproval,
	updateApprovalDueDate,
} from "@/lib/actions/approvals";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("approval action auth", () => {
	it("rejects unauthenticated approval actions before database access", async () => {
		await expect(getApproval("approval-1")).rejects.toThrow("Unauthorized");
		await expect(getApprovals()).rejects.toThrow("Unauthorized");
		await expect(getPendingApprovalsForUser("reviewer-1")).rejects.toThrow("Unauthorized");
		await expect(getOverdueApprovals()).rejects.toThrow("Unauthorized");
		await expect(createApproval({
			documentId: "doc-1",
			stage: "reviewer",
			assignedTo: "reviewer-1",
		})).rejects.toThrow("Unauthorized");
		await expect(submitReview({
			approvalId: "approval-1",
			status: "approved",
		}, "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(updateApproval("approval-1", { status: "in_review" })).rejects.toThrow("Unauthorized");
		await expect(deleteApproval("approval-1")).rejects.toThrow("Unauthorized");
		await expect(initializeWorkflow("doc-1")).rejects.toThrow("Unauthorized");
		await expect(getWorkflowStatus("doc-1")).rejects.toThrow("Unauthorized");
		await expect(getUpcomingDeadlines("reviewer-1")).rejects.toThrow("Unauthorized");
		await expect(updateApprovalDueDate("approval-1", new Date("2026-01-01T00:00:00.000Z"))).rejects.toThrow("Unauthorized");
		await expect(reassignApprovals("reviewer-1", "reviewer-2")).rejects.toThrow("Unauthorized");
		await expect(cancelWorkflow("doc-1")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
