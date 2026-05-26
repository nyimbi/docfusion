import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/actions/document-render", () => ({
	preSubmissionAudit: vi.fn(),
}));

vi.mock("@/lib/actions/final-submission-checklist-workflow", () => ({
	evaluateFinalSubmissionChecklistWorkflow: vi.fn(),
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "workflow-instance-1" })),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

interface ChainConfig {
	result?: unknown[];
	onValues?: (value: Record<string, unknown>) => void;
	onSet?: (value: Record<string, unknown>) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "innerJoin", "where", "orderBy", "limit"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.values = vi.fn((value: Record<string, unknown>) => {
		config.onValues?.(value);
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

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		select: vi.fn(() => createChain()),
		insert: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import { preSubmissionAudit } from "@/lib/actions/document-render";
import { evaluateFinalSubmissionChecklistWorkflow } from "@/lib/actions/final-submission-checklist-workflow";
import { createSubmission } from "@/lib/actions/submissions";

const readyAudit = {
	opportunityId: "opp-1",
	isReady: true,
	readinessScore: 100,
	checks: [],
	documents: [],
	missingDocuments: [],
	issues: [],
	recommendations: [],
	auditedAt: new Date("2026-04-01T00:00:00.000Z"),
};

const submissionRow = {
	id: "submission-1",
	opportunityId: "opp-1",
	submittedAt: new Date("2026-04-01T00:00:00.000Z"),
	submittedBy: "Proposal Lead",
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
	createdAt: new Date("2026-04-01T00:00:00.000Z"),
	updatedAt: new Date("2026-04-01T00:00:00.000Z"),
};

const storedFinalArtifact = {
	documentId: "doc-1",
	proposalDocumentId: "proposal-doc-1",
	opportunityId: "opp-1",
	format: "docx",
	filename: "technical-approach.docx",
	mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	size: 2048,
	artifactHash: "f".repeat(64),
	downloadUrl: `/api/v1/documents/doc-1/final-artifact?artifactHash=${"f".repeat(64)}`,
	storagePath: "s3://mansa/proposal/final-artifacts/opp-1/proposal-doc-1/technical-approach.docx",
	storageBucket: "mansa",
	storageKey: "proposal/final-artifacts/opp-1/proposal-doc-1/technical-approach.docx",
	storageEtag: "\"artifact-etag\"",
	storageEndpoint: "https://objects.example.com",
	renderedAt: "2026-05-05T00:00:00.000Z",
	renderedBy: "production-lead-1",
	renderTimeMs: 40,
	pageCount: 12,
};

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({ userId: "session-user-1" });
	vi.mocked(preSubmissionAudit).mockResolvedValue(readyAudit);
	vi.mocked(evaluateFinalSubmissionChecklistWorkflow).mockResolvedValue({
		opportunityId: "opp-1",
		allowed: true,
		blockers: [],
		warnings: [],
		items: [],
		dlpFindings: [],
		workflowInstanceId: "checklist-workflow-1",
		taskProjected: true,
	});
});

describe("submission workflow gates", () => {
	it("requires a receipt or confirmation before recording submission", async () => {
		await expect(
			createSubmission({
				opportunityId: "opp-1",
				submittedBy: "Proposal Lead",
				submissionMethod: "portal",
				attachmentIds: ["doc-1"],
			})
		).rejects.toThrow("confirmation number");

		expect(preSubmissionAudit).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("blocks submission when pre-submission audit is not ready", async () => {
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{ id: "opp-1" }],
		}));
		vi.mocked(preSubmissionAudit).mockResolvedValueOnce({
			...readyAudit,
			isReady: false,
			readinessScore: 60,
			issues: ["Missing required documents"],
		});

		await expect(
			createSubmission({
				opportunityId: "opp-1",
				submittedBy: "Proposal Lead",
				submissionMethod: "portal",
				confirmationNumber: "PORTAL-123",
				attachmentIds: ["doc-1"],
			})
		).rejects.toThrow("Pre-submission audit is not ready");

		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("blocks submission when the final checklist has unresolved hard gates", async () => {
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{ id: "opp-1" }],
		}));
		vi.mocked(evaluateFinalSubmissionChecklistWorkflow).mockResolvedValueOnce({
			opportunityId: "opp-1",
			allowed: false,
			blockers: ["Technical Approach artifact hash: Approved final artifact hash is missing"],
			warnings: [],
			items: [],
			dlpFindings: [],
			workflowInstanceId: "checklist-workflow-1",
			taskProjected: true,
		});

		await expect(
			createSubmission({
				opportunityId: "opp-1",
				submittedBy: "Proposal Lead",
				submissionMethod: "portal",
				confirmationNumber: "PORTAL-123",
				attachmentIds: ["doc-1"],
			})
		).rejects.toThrow("Final submission checklist is not ready");

		expect(evaluateFinalSubmissionChecklistWorkflow).toHaveBeenCalledWith("opp-1");
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("requires selected attachments to include every required final package document", async () => {
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{ id: "opp-1" }],
		}));
		vi.mocked(evaluateFinalSubmissionChecklistWorkflow).mockResolvedValueOnce({
			opportunityId: "opp-1",
			allowed: true,
			blockers: [],
			warnings: [],
			items: [
				{
					id: "document:technical_approach",
					category: "documents",
					label: "Technical Approach present",
					required: true,
					passed: true,
					message: "Document linked as Technical Approach",
					subjectId: "doc-1",
				},
				{
					id: "document:cost_proposal",
					category: "documents",
					label: "Cost Proposal present",
					required: true,
					passed: true,
					message: "Document linked as Cost Proposal",
					subjectId: "doc-2",
				},
			],
			dlpFindings: [],
			workflowInstanceId: "checklist-workflow-1",
			taskProjected: true,
		});

		await expect(
			createSubmission({
				opportunityId: "opp-1",
				submittedBy: "Proposal Lead",
				submissionMethod: "portal",
				confirmationNumber: "PORTAL-123",
				attachmentIds: ["doc-1"],
			})
		).rejects.toThrow("Cost Proposal present");

		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("requires selected attachments to carry the approved stored final artifact", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{ id: "opp-1" }],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					id: "proposal-doc-1",
					documentId: "doc-1",
					documentType: "technical_approach",
					status: "final",
					title: "Technical Approach",
					metadata: {
						finalArtifact: {
							artifactHash: "f".repeat(64),
							filename: "technical-approach.docx",
						},
					},
				}],
			}));

		await expect(
			createSubmission({
				opportunityId: "opp-1",
				submittedBy: "Proposal Lead",
				submissionMethod: "portal",
				confirmationNumber: "PORTAL-123",
				attachmentIds: ["doc-1"],
			})
		).rejects.toThrow("approved stored final artifact");

		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("locks submitted attachments to final artifact storage receipts", async () => {
		let insertedSubmission: Record<string, unknown> | undefined;
		let opportunityUpdate: Record<string, unknown> | undefined;

		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{ id: "opp-1" }],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					id: "proposal-doc-1",
					documentId: "doc-1",
					documentType: "technical_approach",
					status: "final",
					title: "Technical Approach",
					metadata: {
						finalArtifact: storedFinalArtifact,
					},
				}],
			}));
		dbMock.insert.mockReturnValueOnce(createChain({
			onValues: (value) => {
				insertedSubmission = value;
			},
			result: [{
				...submissionRow,
				attachments: [],
			}],
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			onSet: (value) => {
				opportunityUpdate = value;
			},
		}));

		await createSubmission({
			opportunityId: "opp-1",
			submittedBy: " Proposal Lead ",
			submissionMethod: "portal",
			confirmationNumber: " PORTAL-123 ",
			attachmentIds: ["doc-1"],
		});

		expect(insertedSubmission).toMatchObject({
			opportunityId: "opp-1",
			submittedBy: "session-user-1",
			confirmationNumber: "PORTAL-123",
			status: "submitted",
		});
		const attachments = insertedSubmission?.attachments as Array<Record<string, unknown>>;
		expect(attachments).toHaveLength(1);
		expect(attachments[0]).toMatchObject({
			documentId: "doc-1",
			documentTitle: "Technical Approach",
			documentType: "technical_approach",
			filename: "technical-approach.docx",
			mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			size: 2048,
			artifactHash: "f".repeat(64),
			downloadUrl: `/api/v1/documents/doc-1/final-artifact?artifactHash=${"f".repeat(64)}`,
			storagePath: "s3://mansa/proposal/final-artifacts/opp-1/proposal-doc-1/technical-approach.docx",
			storageBucket: "mansa",
			storageKey: "proposal/final-artifacts/opp-1/proposal-doc-1/technical-approach.docx",
			storageEtag: "\"artifact-etag\"",
			storageEndpoint: "https://objects.example.com",
		});
		expect(attachments[0].lockedAt).toEqual(expect.any(String));
		expect(opportunityUpdate).toMatchObject({
			decisionStatus: "submitted",
		});
		expect(evaluateFinalSubmissionChecklistWorkflow).toHaveBeenCalledWith("opp-1");
	});
});
