import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserContextMock } = vi.hoisted(() => ({
	requireUserContextMock: vi.fn(async () => ({
		userId: "production-lead-1",
		organizationId: "org-1",
	})),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/actions/document-render", () => ({
	renderDocument: vi.fn(async () => ({
		success: true,
		format: "docx",
		data: Buffer.from("rendered final proposal").toString("base64"),
		size: Buffer.byteLength("rendered final proposal"),
		mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		filename: "technical-approach.docx",
		renderTimeMs: 42,
		pageCount: 12,
	})),
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "artifact-workflow-1" })),
	upsertWorkflowRuntimeTask: vi.fn(async () => ({ id: "artifact-task-1" })),
}));

const storageMock = vi.hoisted(() => ({
	getLinodeE3ConfigFromEnv: vi.fn(() => ({
		endpoint: "https://objects.example.com",
		region: "gb-lon-1",
		bucket: "mansa",
		accessKeyId: "access-key",
		secretAccessKey: "secret-key",
		prefix: "proposal",
	})),
	uploadToLinodeE3: vi.fn(async () => ({
		bucket: "mansa",
		key: "proposal/final-artifacts/opp-1/proposal-doc-1/rendered.docx",
		storagePath: "s3://mansa/proposal/final-artifacts/opp-1/proposal-doc-1/rendered.docx",
		etag: "\"artifact-etag\"",
		endpoint: "https://objects.example.com",
	})),
}));

vi.mock("@/lib/storage/linode-e3", () => storageMock);

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
	onSet?: (value: Record<string, unknown>) => void;
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
	return Object.values(value as Record<string, unknown>).flatMap((item) => collectSqlFragments(item, seen));
}

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		select: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import { renderDocument } from "@/lib/actions/document-render";
import { transitionFinalArtifactWorkflow } from "@/lib/actions/final-artifact-workflow";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

const baseDocument = {
	id: "doc-1",
	title: "Technical Approach",
	content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Final content" }] }] },
	plainText: "Final content",
	status: "approved",
	visibility: "private",
	ownerId: "writer-1",
	templateId: null,
	tags: [],
	wordCount: 500,
	characterCount: 3200,
	currentVersion: 4,
	collaboratorIds: [],
	metadata: {},
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
	lastAccessedAt: null,
};

const proposalDocument = {
	id: "proposal-doc-1",
	opportunityId: "opp-1",
	documentId: "doc-1",
	documentType: "technical_approach",
	sectionOrder: 1,
	status: "approved",
	assignedTo: "writer-1",
	dueDate: null,
	reviewerId: "reviewer-1",
	approvedBy: "reviewer-1",
	approvedAt: new Date("2026-05-02T00:00:00.000Z"),
	aiAnalysisScore: 91,
	aiAnalysisAt: null,
	notes: null,
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

const renderedHash = createHash("sha256")
	.update(Buffer.from("rendered final proposal"))
	.digest("hex");

function storedArtifact(overrides: Record<string, unknown> = {}) {
	return {
		documentId: "doc-1",
		proposalDocumentId: "proposal-doc-1",
		opportunityId: "opp-1",
		format: "docx",
		filename: "technical-approach.docx",
		mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		size: Buffer.byteLength("rendered final proposal"),
		artifactHash: renderedHash,
		downloadUrl: `/api/v1/documents/doc-1/final-artifact?artifactHash=${renderedHash}`,
		storagePath: "s3://mansa/proposal/final-artifacts/opp-1/proposal-doc-1/rendered.docx",
		storageBucket: "mansa",
		storageKey: "proposal/final-artifacts/opp-1/proposal-doc-1/rendered.docx",
		storageEtag: "\"artifact-etag\"",
		storageEndpoint: "https://objects.example.com",
		renderedAt: "2026-05-05T00:00:00.000Z",
		renderedBy: "production-lead-1",
		renderTimeMs: 42,
		pageCount: 12,
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "production-lead-1",
		organizationId: "org-1",
	});
	storageMock.getLinodeE3ConfigFromEnv.mockReturnValue({
		endpoint: "https://objects.example.com",
		region: "gb-lon-1",
		bucket: "mansa",
		accessKeyId: "access-key",
		secretAccessKey: "secret-key",
		prefix: "proposal",
	});
	storageMock.uploadToLinodeE3.mockResolvedValue({
		bucket: "mansa",
		key: "proposal/final-artifacts/opp-1/proposal-doc-1/rendered.docx",
		storagePath: "s3://mansa/proposal/final-artifacts/opp-1/proposal-doc-1/rendered.docx",
		etag: "\"artifact-etag\"",
		endpoint: "https://objects.example.com",
	});
	dbMock.select.mockReset();
	dbMock.update.mockReset();
});

describe("final artifact workflow", () => {
	it("requests final render work and projects a production task", async () => {
		const wheres: unknown[] = [];
		let documentPatch: Record<string, unknown> | undefined;
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [proposalDocument],
				onWhere: (value) => {
					wheres.push(value);
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [baseDocument],
				onWhere: (value) => {
					wheres.push(value);
				},
			}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [baseDocument],
			onSet: (value) => {
				documentPatch = value;
			},
			onWhere: (value) => {
				wheres.push(value);
			},
		}));

		const result = await transitionFinalArtifactWorkflow({
			documentId: "doc-1",
			proposalDocumentId: "proposal-doc-1",
			action: "request_render",
			reason: "Prepare the final DOCX for submission review",
			format: "docx",
			assignedTo: "production-1",
		});

		expect(result).toMatchObject({
			documentId: "doc-1",
			proposalDocumentId: "proposal-doc-1",
			opportunityId: "opp-1",
			fromState: "approved",
			toState: "render_requested",
			taskProjected: true,
		});
		expect(documentPatch?.metadata).toMatchObject({
			finalArtifactWorkflow: {
				state: "render_requested",
				requestedBy: "production-lead-1",
				format: "docx",
			},
		});
		expect(wheres).toHaveLength(3);
		for (const where of wheres) {
			expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
		}
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(
			expect.objectContaining({
				taskKey: "final-artifact:doc-1",
				state: "open",
				assignedRole: "production_specialist",
			})
		);
	});

	it("blocks final rendering for an unapproved proposal document", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ ...proposalDocument, status: "in_review" }] }))
			.mockReturnValueOnce(createChain({ result: [baseDocument] }));

		await expect(transitionFinalArtifactWorkflow({
			documentId: "doc-1",
			proposalDocumentId: "proposal-doc-1",
			action: "render",
			reason: "Render final artifact",
			format: "docx",
		})).rejects.toThrow("approved or final proposal document");
		expect(renderDocument).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("blocks final rendering before calling the renderer when object storage is absent", async () => {
		storageMock.getLinodeE3ConfigFromEnv.mockReturnValue(null);
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [proposalDocument] }))
			.mockReturnValueOnce(createChain({ result: [baseDocument] }));

		await expect(transitionFinalArtifactWorkflow({
			documentId: "doc-1",
			proposalDocumentId: "proposal-doc-1",
			action: "render",
			reason: "Render final artifact",
			format: "docx",
		})).rejects.toThrow("Linode E3 object storage is required");
		expect(renderDocument).not.toHaveBeenCalled();
		expect(storageMock.uploadToLinodeE3).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("renders an approved proposal document, stores artifact metadata, and records runtime evidence", async () => {
		let documentPatch: Record<string, unknown> | undefined;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [proposalDocument] }))
			.mockReturnValueOnce(createChain({ result: [baseDocument] }));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{
				...baseDocument,
				metadata: {
					renderedArtifacts: {
						docx: { artifactHash: renderedHash },
					},
				},
			}],
			onSet: (value) => {
				documentPatch = value;
			},
		}));

		const result = await transitionFinalArtifactWorkflow({
			documentId: "doc-1",
			proposalDocumentId: "proposal-doc-1",
			action: "render",
			reason: "Render approved final artifact",
			format: "docx",
		});

		expect(result.toState).toBe("artifact_rendered");
		expect(result.artifact).toMatchObject({
			documentId: "doc-1",
			proposalDocumentId: "proposal-doc-1",
			opportunityId: "opp-1",
			format: "docx",
			filename: "technical-approach.docx",
			artifactHash: renderedHash,
			size: Buffer.byteLength("rendered final proposal"),
			renderedBy: "production-lead-1",
			renderTimeMs: 42,
			pageCount: 12,
			storagePath: "s3://mansa/proposal/final-artifacts/opp-1/proposal-doc-1/rendered.docx",
			storageBucket: "mansa",
			storageEtag: "\"artifact-etag\"",
		});
		expect(result.artifact?.downloadUrl).toContain(`/api/v1/documents/doc-1/final-artifact?artifactHash=${renderedHash}`);
		expect(storageMock.uploadToLinodeE3).toHaveBeenCalledWith(
			expect.objectContaining({ bucket: "mansa" }),
			expect.objectContaining({
				contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				contentLength: Buffer.byteLength("rendered final proposal"),
				metadata: expect.objectContaining({
					"document-id": "doc-1",
					"proposal-document-id": "proposal-doc-1",
					"opportunity-id": "opp-1",
					sha256: renderedHash,
				}),
			})
		);
		expect(documentPatch?.metadata).toMatchObject({
			renderedArtifacts: {
				docx: expect.objectContaining({
					artifactHash: renderedHash,
					storagePath: "s3://mansa/proposal/final-artifacts/opp-1/proposal-doc-1/rendered.docx",
				}),
			},
			finalArtifactWorkflow: {
				state: "artifact_rendered",
				lastRenderedBy: "production-lead-1",
				lastArtifactHash: renderedHash,
			},
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				workflowKey: "final_artifact_render_export",
				eventType: "final_artifact_render",
				toState: "artifact_rendered",
				terminal: false,
				metadata: expect.objectContaining({
					artifactHash: renderedHash,
					filename: "technical-approach.docx",
				}),
			})
		);
	});

	it("requires production authority before approving a rendered artifact", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [proposalDocument],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					...baseDocument,
					metadata: {
						renderedArtifacts: {
							docx: storedArtifact(),
						},
					},
				}],
			}));

		await expect(transitionFinalArtifactWorkflow({
			documentId: "doc-1",
			proposalDocumentId: "proposal-doc-1",
			action: "approve",
			reason: "Approve final artifact",
			format: "docx",
		})).rejects.toThrow("production approval authority");
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("approves a rendered artifact and marks the proposal document final", async () => {
		const artifact = storedArtifact();
		let documentPatch: Record<string, unknown> | undefined;
		let proposalPatch: Record<string, unknown> | undefined;
		let proposalUpdateWhere: unknown;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [proposalDocument] }))
			.mockReturnValueOnce(createChain({
				result: [{
					...baseDocument,
					metadata: {
						renderedArtifacts: { docx: artifact },
					},
				}],
			}));
		dbMock.update
			.mockReturnValueOnce(createChain({
				result: [{ ...baseDocument, status: "final" }],
				onSet: (value) => {
					documentPatch = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					proposalPatch = value;
				},
				onWhere: (value) => {
					proposalUpdateWhere = value;
				},
			}));

		const result = await transitionFinalArtifactWorkflow({
			documentId: "doc-1",
			proposalDocumentId: "proposal-doc-1",
			action: "approve",
			reason: "The artifact matches the final package",
			format: "docx",
			approvalRole: "proposal_manager",
		});

		expect(result.toState).toBe("artifact_approved");
		expect(documentPatch).toMatchObject({
			status: "final",
			metadata: {
				finalArtifact: expect.objectContaining({
					artifactHash: renderedHash,
					approvedBy: "production-lead-1",
					approvalRole: "proposal_manager",
				}),
			},
		});
		expect(proposalPatch).toMatchObject({
			status: "final",
			approvedBy: "production-lead-1",
		});
		expect(collectSqlFragments(proposalUpdateWhere).join(" ")).toContain("opportunities.assigned_to");
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				toState: "artifact_approved",
				terminal: true,
				authorityPolicy: { requiredRoles: ["proposal_manager"] },
			})
		);
	});

	it("records executive signoff only after the final artifact is approved", async () => {
		const artifact = storedArtifact();
		let documentPatch: Record<string, unknown> | undefined;
		let proposalPatch: Record<string, unknown> | undefined;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ ...proposalDocument, status: "final" }] }))
			.mockReturnValueOnce(createChain({
				result: [{
					...baseDocument,
					status: "final",
					metadata: {
						finalArtifact: artifact,
					},
				}],
			}));
		dbMock.update
			.mockReturnValueOnce(createChain({
				result: [{ ...baseDocument, status: "final" }],
				onSet: (value) => {
					documentPatch = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					proposalPatch = value;
				},
			}));

		const result = await transitionFinalArtifactWorkflow({
			documentId: "doc-1",
			proposalDocumentId: "proposal-doc-1",
			action: "signoff",
			reason: "Executive reviewed the final package",
			approvalRole: "executive_or_legal",
		});

		expect(result).toMatchObject({
			fromState: "artifact_approved",
			toState: "submission_signed_off",
			artifact,
		});
		expect(documentPatch?.metadata).toMatchObject({
			finalSubmissionSignoff: {
				signedBy: "production-lead-1",
				signoffRole: "executive_or_legal",
			},
			finalArtifactWorkflow: {
				state: "submission_signed_off",
				signedBy: "production-lead-1",
				signoffRole: "executive_or_legal",
			},
		});
		expect(proposalPatch).toMatchObject({
			updatedAt: expect.any(Date),
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				toState: "submission_signed_off",
				eventType: "final_artifact_signoff",
				terminal: true,
				authorityPolicy: { requiredRoles: ["executive_or_legal"] },
			})
		);
	});

	it("blocks signoff when no approved final artifact exists", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ ...proposalDocument, status: "approved" }] }))
			.mockReturnValueOnce(createChain({
				result: [{
					...baseDocument,
					metadata: {
						renderedArtifacts: {
							docx: storedArtifact(),
						},
					},
				}],
			}));

		await expect(transitionFinalArtifactWorkflow({
			documentId: "doc-1",
			proposalDocumentId: "proposal-doc-1",
			action: "signoff",
			reason: "Executive reviewed the final package",
			approvalRole: "executive_or_legal",
		})).rejects.toThrow("approved final artifact");
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("reopens an approved artifact and clears the final proposal state", async () => {
		let documentPatch: Record<string, unknown> | undefined;
		let proposalPatch: Record<string, unknown> | undefined;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ ...proposalDocument, status: "final" }] }))
			.mockReturnValueOnce(createChain({
				result: [{
					...baseDocument,
					status: "final",
					metadata: {
						finalArtifact: storedArtifact(),
						finalSubmissionSignoff: {
							signedBy: "executive-1",
							signedAt: "2026-05-05T00:00:00.000Z",
						},
					},
				}],
			}));
		dbMock.update
			.mockReturnValueOnce(createChain({
				result: [{ ...baseDocument, status: "draft" }],
				onSet: (value) => {
					documentPatch = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					proposalPatch = value;
				},
			}));

		const result = await transitionFinalArtifactWorkflow({
			documentId: "doc-1",
			proposalDocumentId: "proposal-doc-1",
			action: "reopen",
			reason: "Late correction changed the approved artifact",
			approvalRole: "proposal_manager",
		});

		expect(result).toMatchObject({
			fromState: "submission_signed_off",
			toState: "artifact_reopened",
		});
		expect(documentPatch).toMatchObject({
			status: "draft",
			metadata: {
				finalArtifact: null,
				finalSubmissionSignoff: null,
				finalArtifactWorkflow: {
					state: "artifact_reopened",
					reopenedBy: "production-lead-1",
				},
			},
		});
		expect(proposalPatch).toMatchObject({
			status: "in_review",
			approvedBy: null,
			approvedAt: null,
		});
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(
			expect.objectContaining({
				state: "open",
				assignedRole: "production_specialist",
			})
		);
	});
});
