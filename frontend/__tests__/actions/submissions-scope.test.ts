import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const preSubmissionAuditMock = vi.hoisted(() => vi.fn());
const finalChecklistMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "innerJoin", "limit", "orderBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
	chain.set = vi.fn(() => chain);
	chain.values = vi.fn(() => chain);
	chain.returning = vi.fn(async () => config.result ?? []);
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
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
	return Object.values(value as Record<string, unknown>).flatMap((item) => collectSqlFragments(item, seen));
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
	insert: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
	},
}));

vi.mock("@/lib/actions/document-render", () => ({
	preSubmissionAudit: preSubmissionAuditMock,
}));

vi.mock("@/lib/actions/final-submission-checklist-workflow", () => ({
	evaluateFinalSubmissionChecklistWorkflow: finalChecklistMock,
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: {
		warn: vi.fn(),
	},
}));

import {
	createSubmission,
	getRecentSubmissions,
	getPreSubmissionChecklist,
	getSubmission,
	getSubmissionsByOpportunity,
	getWinLossAnalytics,
	recordOutcome,
	updateSubmissionStatus,
} from "@/lib/actions/submissions";

const submission = {
	id: "55555555-5555-4555-8555-555555555555",
	opportunityId: "33333333-3333-4333-8333-333333333333",
	submittedAt: new Date("2026-05-19T12:00:00.000Z"),
	submittedBy: "submission-user-1",
	submissionMethod: "portal",
	confirmationNumber: "PORTAL-123",
	attachments: [],
	notes: null,
	status: "submitted",
	outcome: null,
	outcomeDate: null,
	outcomeNotes: null,
	evaluatorFeedback: null,
	lessonsLearned: null,
	contractValue: null,
	contractDuration: null,
	createdAt: new Date("2026-05-19T12:00:00.000Z"),
	updatedAt: new Date("2026-05-19T12:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "submission-user-1",
		organizationId: "org-1",
	});
});

describe("submission row scoping", () => {
	it("checks opportunity assignment before running submission readiness workflows", async () => {
		let opportunityWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				opportunityWhere = value;
			},
		}));

		await expect(createSubmission({
			opportunityId: submission.opportunityId,
			submittedBy: "spoofed-user",
			submissionMethod: "portal",
			confirmationNumber: "PORTAL-123",
			attachmentIds: ["doc-1"],
		})).rejects.toThrow("Opportunity not found");

		expect(preSubmissionAuditMock).not.toHaveBeenCalled();
		expect(finalChecklistMock).not.toHaveBeenCalled();
		expect(collectSqlFragments(opportunityWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes submission reads through the owning opportunity", async () => {
		let readWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [submission],
			onWhere: (value) => {
				readWhere = value;
			},
		}));

		const result = await getSubmission(submission.id);

		expect(result).toMatchObject({ id: submission.id });
		expect(collectSqlFragments(readWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("loads the operator checklist from the enforced final submission gate", async () => {
		finalChecklistMock.mockResolvedValueOnce({
			opportunityId: submission.opportunityId,
			allowed: false,
			blockers: ["Compliance matrix final lock: A final or submitted compliance matrix with approval is required"],
			warnings: [],
			items: [
				{
					id: "compliance:matrix-lock",
					category: "compliance",
					label: "Compliance matrix final lock",
					required: true,
					passed: false,
					message: "A final or submitted compliance matrix with approval is required",
					assignedRole: "compliance_officer",
				},
			],
			dlpFindings: [],
			workflowInstanceId: "final-checklist-1",
			taskProjected: true,
		});

		const checklist = await getPreSubmissionChecklist(submission.opportunityId);

		expect(finalChecklistMock).toHaveBeenCalledWith(submission.opportunityId);
		expect(checklist).toEqual([
			expect.objectContaining({
				id: "compliance:matrix-lock",
				category: "compliance",
				isRequired: true,
				isCompleted: false,
				isSystemVerified: true,
				notes: "Owner: compliance_officer",
			}),
		]);
	});

	it("scopes opportunity submission lists through assignment", async () => {
		let listWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [submission],
			onWhere: (value) => {
				listWhere = value;
			},
		}));

		const result = await getSubmissionsByOpportunity(submission.opportunityId);

		expect(result).toHaveLength(1);
		expect(collectSqlFragments(listWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes submission status updates through the owning opportunity", async () => {
		let updateWhere: unknown;
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ ...submission, status: "under_review" }],
			onWhere: (value) => {
				updateWhere = value;
			},
		}));

		const result = await updateSubmissionStatus({
			submissionId: submission.id,
			status: "under_review",
		});

		expect(result).toMatchObject({ id: submission.id, status: "under_review" });
		expect(collectSqlFragments(updateWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes outcome updates and opportunity status updates through assignment", async () => {
		const wheres: unknown[] = [];
		dbMock.update
			.mockReturnValueOnce(createChain({
				result: [{ ...submission, outcome: "won", status: "won" }],
				onWhere: (value) => {
					wheres.push(value);
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => {
					wheres.push(value);
				},
			}));

		const result = await recordOutcome({
			submissionId: submission.id,
			outcome: "won",
		});

		expect(result).toMatchObject({ id: submission.id, outcome: "won" });
		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
		}
	});

	it("scopes win/loss analytics to assigned opportunities", async () => {
		let analyticsWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				analyticsWhere = value;
			},
		}));

		const result = await getWinLossAnalytics();

		expect(result).toMatchObject({ totalSubmissions: 0 });
		expect(collectSqlFragments(analyticsWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes recent submissions to assigned opportunities", async () => {
		let recentWhere: unknown;
		const recentChain = createChain({
			result: [],
			onWhere: (value) => {
				recentWhere = value;
			},
		});
		dbMock.select.mockReturnValueOnce(recentChain);

		const result = await getRecentSubmissions(-20);

		expect(result).toEqual([]);
		expect(recentChain.limit).toHaveBeenCalledWith(1);
		expect(collectSqlFragments(recentWhere).join(" ")).toContain("opportunities.assigned_to");
	});
});
