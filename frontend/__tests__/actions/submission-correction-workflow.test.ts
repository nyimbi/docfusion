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
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "limit"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
	chain.set = vi.fn((value: Record<string, unknown>) => {
		config.onSet?.(value);
		return chain;
	});
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
	return Object.values(value as Record<string, unknown>).flatMap((item) =>
		collectSqlFragments(item, seen)
	);
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
	it("rejects submissions outside the actor's assigned opportunities", async () => {
		let submissionWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				submissionWhere = value;
			},
		}));

		await expect(transitionSubmissionCorrectionWorkflow({
			submissionId: "submission-1",
			action: "request_correction",
			reason: "Portal rejected the cost volume filename",
		})).rejects.toThrow("Submission not found");

		expect(dbMock.update).not.toHaveBeenCalled();
		expect(collectSqlFragments(submissionWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("requests post-dispatch correction and projects blocked correction work", async () => {
		let submissionPatch: Record<string, unknown> | undefined;
		let opportunityPatch: Record<string, unknown> | undefined;
		const wheres: unknown[] = [];
		dbMock.select.mockReturnValueOnce(createChain({
			result: [submission],
			onWhere: (value) => wheres.push(value),
		}));
		dbMock.update
			.mockReturnValueOnce(createChain({
				result: [{ ...submission, status: "under_review" }],
				onSet: (value) => {
					submissionPatch = value;
				},
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					opportunityPatch = value;
				},
				onWhere: (value) => wheres.push(value),
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
		expect(wheres).toHaveLength(3);
		for (const where of wheres) {
			expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
		}
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
