import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserContextMock } = vi.hoisted(() => ({
	requireUserContextMock: vi.fn(async () => ({
		userId: "proposal-manager-1",
		organizationId: "org-1",
	})),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "submission-correction-workflow-1" })),
	upsertWorkflowRuntimeTask: vi.fn(async () => ({ id: "submission-correction-task-1" })),
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

import { transitionSubmissionCorrectionWorkflow } from "@/lib/actions/submission-correction-workflow";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

const submission = {
	id: "submission-1",
	opportunityId: "opp-1",
	submittedAt: new Date("2026-05-05T00:00:00.000Z"),
	submittedBy: "Proposal Lead",
	submissionMethod: "portal",
	confirmationNumber: "PORTAL-123",
	attachments: [
		{
			documentId: "doc-1",
			documentTitle: "Technical Approach",
			documentType: "technical_approach",
			artifactHash: "a".repeat(64),
			lockedAt: "2026-05-05T00:00:00.000Z",
		},
	],
	notes: "Initial receipt recorded.",
	status: "submitted",
	outcome: null,
	outcomeDate: null,
	outcomeNotes: null,
	evaluatorFeedback: null,
	lessonsLearned: null,
	contractValue: null,
	contractDuration: null,
	createdAt: new Date("2026-05-05T00:00:00.000Z"),
	updatedAt: new Date("2026-05-05T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "proposal-manager-1",
		organizationId: "org-1",
	});
	dbMock.select.mockReset();
	dbMock.update.mockReset();
});

describe("submission correction workflow", () => {
	it("requests post-dispatch correction and projects blocked correction work", async () => {
		let submissionPatch: Record<string, unknown> | undefined;
		let opportunityPatch: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({ result: [submission] }));
		dbMock.update
			.mockReturnValueOnce(createChain({
				result: [{ ...submission, status: "under_review" }],
				onSet: (value) => {
					submissionPatch = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					opportunityPatch = value;
				},
			}));

		const result = await transitionSubmissionCorrectionWorkflow({
			submissionId: "submission-1",
			action: "request_correction",
			reason: "Portal rejected the cost volume filename",
			assignedTo: "proposal-manager-1",
		});

		expect(result).toMatchObject({
			submissionId: "submission-1",
			opportunityId: "opp-1",
			fromState: "submitted",
			toState: "correction_required",
		});
		expect(submissionPatch).toMatchObject({
			status: "under_review",
			notes: expect.stringContaining("Portal rejected the cost volume filename"),
		});
		expect(opportunityPatch).toMatchObject({
			decisionStatus: "submitted",
			decisionReason: "Submission correction requested: Portal rejected the cost volume filename",
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				workflowKey: "submission_correction_compensation",
				eventType: "submission_request_correction",
				toState: "correction_required",
				terminal: false,
				assignedRole: "proposal_manager",
			})
		);
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(
			expect.objectContaining({
				taskKey: "submission-correction:submission-1",
				state: "blocked",
				priority: "critical",
			})
		);
	});

	it("applies a corrected submission package with authority and updated receipt", async () => {
		const correctedAttachments = [
			{
				documentId: "doc-2",
				documentTitle: "Corrected Cost Proposal",
				documentType: "cost_proposal" as const,
				artifactHash: "b".repeat(64),
				lockedAt: "2026-05-05T01:00:00.000Z",
			},
		];
		let submissionPatch: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({ result: [{ ...submission, status: "under_review" }] }));
		dbMock.update
			.mockReturnValueOnce(createChain({
				result: [{ ...submission, status: "submitted", confirmationNumber: "PORTAL-456", attachments: correctedAttachments }],
				onSet: (value) => {
					submissionPatch = value;
				},
			}))
			.mockReturnValueOnce(createChain());

		const result = await transitionSubmissionCorrectionWorkflow({
			submissionId: "submission-1",
			action: "apply_correction",
			reason: "Corrected filename accepted by portal",
			confirmationNumber: " PORTAL-456 ",
			correctedAttachments,
			authorityRole: "proposal_manager",
		});

		expect(result.toState).toBe("corrected_submitted");
		expect(submissionPatch).toMatchObject({
			status: "submitted",
			confirmationNumber: "PORTAL-456",
			attachments: correctedAttachments,
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				toState: "corrected_submitted",
				terminal: true,
				authorityPolicy: { requiredRoles: ["proposal_manager"] },
			})
		);
	});

	it("requires authority before withdrawing a submitted package", async () => {
		dbMock.select.mockReturnValueOnce(createChain({ result: [submission] }));

		await expect(transitionSubmissionCorrectionWorkflow({
			submissionId: "submission-1",
			action: "withdraw",
			reason: "Client cancelled the procurement",
		})).rejects.toThrow("requires submission authority");
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("withdraws a submitted package and compensates opportunity status", async () => {
		let submissionPatch: Record<string, unknown> | undefined;
		let opportunityPatch: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({ result: [submission] }));
		dbMock.update
			.mockReturnValueOnce(createChain({
				result: [{ ...submission, status: "withdrawn", outcome: "withdrawn" }],
				onSet: (value) => {
					submissionPatch = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					opportunityPatch = value;
				},
			}));

		const result = await transitionSubmissionCorrectionWorkflow({
			submissionId: "submission-1",
			action: "withdraw",
			reason: "Agency cancelled the tender",
			authorityRole: "proposal_manager",
		});

		expect(result.toState).toBe("withdrawn");
		expect(submissionPatch).toMatchObject({
			status: "withdrawn",
			outcome: "withdrawn",
			outcomeNotes: "Agency cancelled the tender",
		});
		expect(submissionPatch?.outcomeDate).toBeInstanceOf(Date);
		expect(opportunityPatch).toMatchObject({
			decisionStatus: "declined",
			decisionReason: "Submission withdrawn: Agency cancelled the tender",
		});
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(
			expect.objectContaining({
				state: "cancelled",
				assignedRole: null,
			})
		);
	});
});
