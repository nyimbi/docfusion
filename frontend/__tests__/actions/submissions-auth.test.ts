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
	userHasAuthorityRole: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema", () => ({
	submissions: {},
	proposalDocuments: {},
	documents: {},
	opportunities: {},
}));
vi.mock("@/lib/actions/document-render", () => ({
	preSubmissionAudit: vi.fn(),
}));
vi.mock("@/lib/actions/final-submission-checklist-workflow", () => ({
	evaluateFinalSubmissionChecklistWorkflow: vi.fn(),
}));
vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(),
}));
vi.mock("@/lib/utils/logger", () => ({
	logger: {
		warn: vi.fn(),
	},
}));

import {
	createSubmission,
	getPreSubmissionChecklist,
	getRecentSubmissions,
	getSubmission,
	getSubmissionHistory,
	getSubmissionsByOpportunity,
	getWinLossAnalytics,
	recordOutcome,
	updateSubmissionStatus,
} from "@/lib/actions/submissions";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockRejectedValue(new Error("Unauthorized"));
});

describe("submission action auth", () => {
	it("rejects unauthenticated submission reads and mutations before database access", async () => {
		await expect(createSubmission({
			opportunityId: "opp-1",
			submittedBy: "spoofed-user",
			submissionMethod: "portal",
			confirmationNumber: "PORTAL-123",
			attachmentIds: ["doc-1"],
		})).rejects.toThrow("Unauthorized");
		await expect(getSubmission("submission-1")).rejects.toThrow("Unauthorized");
		await expect(getSubmissionsByOpportunity("opp-1")).rejects.toThrow("Unauthorized");
		await expect(getSubmissionHistory("opp-1")).rejects.toThrow("Unauthorized");
		await expect(updateSubmissionStatus({
			submissionId: "submission-1",
			status: "submitted",
		})).rejects.toThrow("Unauthorized");
		await expect(recordOutcome({
			submissionId: "submission-1",
			outcome: "won",
		})).rejects.toThrow("Unauthorized");
		await expect(getPreSubmissionChecklist("opp-1")).rejects.toThrow("Unauthorized");
		await expect(getWinLossAnalytics()).rejects.toThrow("Unauthorized");
		await expect(getRecentSubmissions()).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
