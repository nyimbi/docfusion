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
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "checklist-workflow-1" })),
	upsertWorkflowRuntimeTask: vi.fn(async () => ({ id: "checklist-task-1" })),
}));

interface ChainConfig {
	result?: unknown[];
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "innerJoin", "where"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		select: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import { evaluateFinalSubmissionChecklistWorkflow } from "@/lib/actions/final-submission-checklist-workflow";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

const finalArtifact = {
	documentId: "doc-technical",
	proposalDocumentId: "pd-technical",
	opportunityId: "opp-1",
	format: "docx",
	filename: "technical-approach.docx",
	mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	size: 2048,
	artifactHash: "a".repeat(64),
	downloadUrl: "/api/documents/doc-technical/download",
	renderedAt: "2026-05-05T00:00:00.000Z",
	renderedBy: "production-lead-1",
	renderTimeMs: 40,
	pageCount: 12,
};

function docFixture(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		proposalDocumentId: "pd-technical",
		documentId: "doc-technical",
		documentType: "technical_approach",
		proposalStatus: "final",
		approvedBy: "proposal-manager-1",
		approvedAt: new Date("2026-05-04T00:00:00.000Z"),
		title: "Technical Approach",
		documentStatus: "final",
		content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Clean proposal content." }] }] },
		metadata: {
			finalArtifact,
			finalSubmissionSignoff: {
				signedBy: "executive-1",
				signedAt: "2026-05-05T00:00:00.000Z",
			},
		},
		...overrides,
	};
}

const lockedMatrix = {
	id: "matrix-1",
	opportunityId: "opp-1",
	rfpDocumentId: null,
	name: "RFP Compliance Matrix",
	description: null,
	version: 1,
	status: "final",
	totalRequirements: 10,
	mandatoryCount: 7,
	compliantCount: 10,
	partialCount: 0,
	nonCompliantCount: 0,
	notAddressedCount: 0,
	complianceScore: 100,
	mandatoryComplianceScore: 100,
	reviewedBy: "compliance-1",
	reviewedAt: new Date("2026-05-04T00:00:00.000Z"),
	reviewNotes: null,
	approvedBy: "compliance-1",
	approvedAt: new Date("2026-05-04T00:00:00.000Z"),
	categoryGroups: {},
	displayColumns: [],
	exportSettings: {},
	createdBy: "compliance-1",
	metadata: {},
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-04T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "proposal-manager-1",
		organizationId: "org-1",
	});
	dbMock.select.mockReset();
});

describe("final submission checklist workflow", () => {
	it("blocks submission when required documents, artifacts, signatures, compliance, or DLP clearance are missing", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [
					docFixture({
						proposalStatus: "approved",
						approvedAt: null,
						metadata: {},
						content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "SECRET content" }] }] },
					}),
				],
			}))
			.mockReturnValueOnce(createChain({ result: [{ ...lockedMatrix, status: "review", approvedBy: null, approvedAt: null }] }));

		const result = await evaluateFinalSubmissionChecklistWorkflow("opp-1");

		expect(result.allowed).toBe(false);
		expect(result.blockers.join("\n")).toContain("Management Plan present");
		expect(result.blockers.join("\n")).toContain("Cost Proposal present");
		expect(result.blockers.join("\n")).toContain("artifact hash");
		expect(result.blockers.join("\n")).toContain("executive signoff");
		expect(result.blockers.join("\n")).toContain("Compliance matrix final lock");
		expect(result.blockers.join("\n")).toContain("DLP clearance");
		expect(result.dlpFindings).toHaveLength(1);
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				workflowKey: "final_submission_checklist_gate",
				toState: "blocked",
				priority: "critical",
				terminal: false,
				metadata: expect.objectContaining({
					blockerCount: result.blockers.length,
					blockingDlpFindingCount: 1,
				}),
			})
		);
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(
			expect.objectContaining({
				taskKey: "final-submission-checklist:opp-1",
				state: "blocked",
				priority: "critical",
			})
		);
	});

	it("passes when every required document has approval, signature, artifact, compliance lock, and DLP clearance", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [
					docFixture(),
					docFixture({
						proposalDocumentId: "pd-management",
						documentId: "doc-management",
						documentType: "management_plan",
						title: "Management Plan",
						metadata: {
							finalArtifact: { ...finalArtifact, documentId: "doc-management", proposalDocumentId: "pd-management" },
							finalSubmissionSignoff: { signedBy: "executive-1", signedAt: "2026-05-05T00:00:00.000Z" },
						},
					}),
					docFixture({
						proposalDocumentId: "pd-cost",
						documentId: "doc-cost",
						documentType: "cost_proposal",
						title: "Cost Proposal",
						metadata: {
							finalArtifact: { ...finalArtifact, documentId: "doc-cost", proposalDocumentId: "pd-cost" },
							finalSubmissionSignoff: { signedBy: "executive-1", signedAt: "2026-05-05T00:00:00.000Z" },
						},
					}),
				],
			}))
			.mockReturnValueOnce(createChain({ result: [lockedMatrix] }));

		const result = await evaluateFinalSubmissionChecklistWorkflow("opp-1");

		expect(result.allowed).toBe(true);
		expect(result.blockers).toHaveLength(0);
		expect(result.items.every((item) => item.passed)).toBe(true);
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				toState: "ready",
				eventType: "final_submission_checklist_passed",
				terminal: true,
			})
		);
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(
			expect.objectContaining({
				state: "completed",
				assignedRole: null,
			})
		);
	});

	it("keeps advisory DLP findings non-blocking while preserving warnings", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [
					docFixture(),
					docFixture({
						proposalDocumentId: "pd-management",
						documentId: "doc-management",
						documentType: "management_plan",
						title: "Management Plan",
						content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Reference card 4111 1111 1111 1111 only for test." }] }] },
						metadata: {
							finalArtifact: { ...finalArtifact, documentId: "doc-management", proposalDocumentId: "pd-management" },
							finalSubmissionSignoff: { signedBy: "executive-1", signedAt: "2026-05-05T00:00:00.000Z" },
						},
					}),
					docFixture({
						proposalDocumentId: "pd-cost",
						documentId: "doc-cost",
						documentType: "cost_proposal",
						title: "Cost Proposal",
						metadata: {
							finalArtifact: { ...finalArtifact, documentId: "doc-cost", proposalDocumentId: "pd-cost" },
							finalSubmissionSignoff: { signedBy: "executive-1", signedAt: "2026-05-05T00:00:00.000Z" },
						},
					}),
				],
			}))
			.mockReturnValueOnce(createChain({ result: [lockedMatrix] }));

		const result = await evaluateFinalSubmissionChecklistWorkflow("opp-1");

		expect(result.allowed).toBe(true);
		expect(result.dlpFindings).toHaveLength(1);
		expect(result.dlpFindings[0].severity).toBe("medium");
		expect(result.blockers).toHaveLength(0);
	});
});
