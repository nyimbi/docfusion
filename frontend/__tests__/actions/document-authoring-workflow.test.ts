import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserContextMock } = vi.hoisted(() => ({
	requireUserContextMock: vi.fn(async () => ({
		userId: "writer-1",
		organizationId: "org-1",
	})),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
	userHasAuthorityRole: (context: { role?: string | null; roles?: string[] | null }, requiredRole: string) => {
		const roles = new Set([
			context.role,
			...(context.roles ?? []),
		].filter(Boolean).map((role) => String(role).trim().toLowerCase()));
		return roles.has("admin") || roles.has(requiredRole.trim().toLowerCase());
	},
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "document-workflow-1" })),
	upsertWorkflowRuntimeTask: vi.fn(async () => ({ id: "document-task-1" })),
}));

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
	onValues?: (value: Record<string, unknown> | Record<string, unknown>[]) => void;
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
	chain.values = vi.fn((value: Record<string, unknown> | Record<string, unknown>[]) => {
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
		insert: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import {
	createWorkflowDocumentFromTemplate,
	transitionDocumentAuthoringWorkflow,
} from "@/lib/actions/document-authoring-workflow";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

const templateContent = {
	type: "doc",
	content: [
		{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Executive Summary" }] },
		{
			type: "paragraph",
			content: [{ type: "text", text: "Datacraft will support {{clientName}} with {{offer}}." }],
		},
	],
};

const template = {
	id: "template-1",
	name: "Executive Summary Template",
	description: "A proposal executive summary",
	content: templateContent,
	status: "published",
	visibility: "organization",
	createdBy: "admin-1",
	categoryIds: [],
	tags: ["executive-summary"],
	placeholders: [],
	aiInstructions: [],
	complianceRequirements: [],
	useCount: 3,
	rating: null,
	ratingCount: 0,
	previewImageUrl: null,
	estimatedTime: null,
	difficulty: null,
	defaultMetadata: { family: "proposal" },
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

const documentRow = {
	id: "doc-1",
	title: "Datacraft Response for Ministry of Digital Services",
	content: templateContent,
	plainText: "Executive Summary Datacraft will support Ministry of Digital Services with delivery assurance.",
	status: "draft",
	visibility: "private",
	ownerId: "writer-1",
	templateId: "template-1",
	tags: ["executive-summary"],
	wordCount: 12,
	characterCount: 92,
	currentVersion: 1,
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
	documentType: "executive_summary",
	sectionOrder: 1,
	status: "drafting",
	assignedTo: "writer-1",
	dueDate: new Date("2026-05-10T00:00:00.000Z"),
	reviewerId: null,
	approvedBy: null,
	approvedAt: null,
	aiAnalysisScore: null,
	aiAnalysisAt: null,
	notes: "Create first response draft",
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

const section = {
	id: "section-1",
	proposalDocumentId: "proposal-doc-1",
	sectionName: "Executive Summary",
	sectionOrder: 0,
	status: "drafting",
	wordCount: 12,
	targetWordCount: 350,
	assignedTo: "writer-1",
	dueDate: new Date("2026-05-10T00:00:00.000Z"),
	requirementIds: ["req-1"],
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "writer-1",
		organizationId: "org-1",
	});
	dbMock.select.mockReset();
	dbMock.insert.mockReset();
	dbMock.update.mockReset();
});

describe("document authoring workflow", () => {
	it("creates a versioned proposal document from a template and projects drafting work", async () => {
		let templateWhere: unknown;
		let opportunityWhere: unknown;
		let maxOrderWhere: unknown;
		let documentValues: Record<string, unknown> | undefined;
		let versionValues: Record<string, unknown> | undefined;
		let proposalValues: Record<string, unknown> | undefined;
		let sectionValues: Record<string, unknown>[] | undefined;

		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [template],
				onWhere: (value) => {
					templateWhere = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [{ id: "opp-1" }],
				onWhere: (value) => {
					opportunityWhere = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [{ maxOrder: 0 }],
				onWhere: (value) => {
					maxOrderWhere = value;
				},
			}));
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [documentRow],
				onValues: (value) => {
					documentValues = value as Record<string, unknown>;
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [{ id: "version-1" }],
				onValues: (value) => {
					versionValues = value as Record<string, unknown>;
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [proposalDocument],
				onValues: (value) => {
					proposalValues = value as Record<string, unknown>;
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onValues: (value) => {
					sectionValues = value as Record<string, unknown>[];
				},
			}));

		const result = await createWorkflowDocumentFromTemplate({
			title: "Datacraft Response for {{clientName}}",
			templateId: "template-1",
			opportunityId: "opp-1",
			documentType: "executive_summary",
			reason: "Create first response draft",
			placeholderValues: {
				clientName: "Ministry of Digital Services",
				offer: "delivery assurance",
			},
			assignedTo: "writer-1",
			dueAt: "2026-05-10T00:00:00.000Z",
		});

		expect(result).toMatchObject({
			documentId: "doc-1",
			proposalDocumentId: "proposal-doc-1",
			opportunityId: "opp-1",
			fromState: "none",
			toState: "draft_created",
			versionNumber: 1,
			taskProjected: true,
		});
		expect(documentValues).toMatchObject({
			title: "Datacraft Response for Ministry of Digital Services",
			plainText: "Executive Summary Datacraft will support Ministry of Digital Services with delivery assurance.",
			wordCount: 12,
			currentVersion: 1,
			templateId: "template-1",
		});
		expect(versionValues).toMatchObject({
			documentId: "doc-1",
			versionNumber: 1,
			changeDescription: "Create first response draft",
			createdBy: "writer-1",
		});
		expect(proposalValues).toMatchObject({
			opportunityId: "opp-1",
			documentId: "doc-1",
			documentType: "executive_summary",
			status: "drafting",
		});
		expect(sectionValues?.[0]).toMatchObject({
			proposalDocumentId: "proposal-doc-1",
			sectionName: "Executive Summary",
			status: "drafting",
		});
		const templateSql = collectSqlFragments(templateWhere).join(" ");
		expect(templateSql).toContain("writer-1");
		expect(templateSql).toContain("published");
		expect(templateSql).toContain("organization");
		expect(collectSqlFragments(opportunityWhere).join(" ")).toContain("opportunities.assigned_to");
		expect(collectSqlFragments(maxOrderWhere).join(" ")).toContain("opportunities.assigned_to");
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "document_creation_from_template",
			subjectType: "document",
			subjectId: "doc-1",
			toState: "draft_created",
			assignedRole: "proposal_writer",
			terminal: false,
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			taskKey: "document-authoring:doc-1",
			state: "open",
			assignedRole: "proposal_writer",
		}));
	});

	it("persists editor content, creates a new document version, updates section progress, and records provenance", async () => {
		const documentWheres: unknown[] = [];
		const opportunityWheres: unknown[] = [];
		let documentPatch: Record<string, unknown> | undefined;
		let versionValues: Record<string, unknown> | undefined;
		let sectionPatch: Record<string, unknown> | undefined;
		const nextContent = {
			type: "doc",
			content: [{
				type: "paragraph",
				content: [{ type: "text", text: "Datacraft provides governed delivery with measurable assurance." }],
			}],
		};
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [documentRow],
				onWhere: (value) => {
					documentWheres.push(value);
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [proposalDocument],
				onWhere: (value) => {
					opportunityWheres.push(value);
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [section],
				onWhere: (value) => {
					opportunityWheres.push(value);
				},
			}));
		dbMock.update
			.mockReturnValueOnce(createChain({
				result: [{ ...documentRow, currentVersion: 2, plainText: "Datacraft provides governed delivery with measurable assurance.", wordCount: 7 }],
				onSet: (value) => {
					documentPatch = value;
				},
				onWhere: (value) => {
					documentWheres.push(value);
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [{ ...proposalDocument, status: "drafting" }],
				onWhere: (value) => {
					opportunityWheres.push(value);
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [{ ...section, wordCount: 7 }],
				onSet: (value) => {
					sectionPatch = value;
				},
				onWhere: (value) => {
					opportunityWheres.push(value);
				},
			}));
		dbMock.insert.mockReturnValueOnce(createChain({
			result: [{ id: "version-2" }],
			onValues: (value) => {
				versionValues = value as Record<string, unknown>;
			},
		}));

		const result = await transitionDocumentAuthoringWorkflow({
			documentId: "doc-1",
			proposalDocumentId: "proposal-doc-1",
			sectionId: "section-1",
			action: "persist_content",
			reason: "Autosave editor draft",
			content: nextContent,
			provenance: {
				source: "editor",
				snippetIds: ["snippet-1"],
			},
		});

		expect(result).toMatchObject({
			documentId: "doc-1",
			proposalDocumentId: "proposal-doc-1",
			sectionId: "section-1",
			fromState: "drafting",
			toState: "draft_saved",
			versionNumber: 2,
		});
		expect(documentPatch).toMatchObject({
			plainText: "Datacraft provides governed delivery with measurable assurance.",
			wordCount: 7,
			currentVersion: 2,
		});
		expect(versionValues).toMatchObject({
			documentId: "doc-1",
			versionNumber: 2,
			changeDescription: "Autosave editor draft",
			createdBy: "writer-1",
		});
		expect(sectionPatch).toMatchObject({
			status: "drafting",
			wordCount: 7,
		});
		for (const where of documentWheres) {
			expect(collectSqlFragments(where).join(" ")).toContain("documents.owner_id");
		}
		for (const where of opportunityWheres) {
			expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
		}
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "document_authoring",
			toState: "draft_saved",
			metadata: expect.objectContaining({
				versionNumber: 2,
				provenance: expect.objectContaining({ source: "editor" }),
			}),
		}));
	});

	it("submits a draft for review and routes work to the reviewer role", async () => {
		let proposalPatch: Record<string, unknown> | undefined;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [documentRow] }))
			.mockReturnValueOnce(createChain({ result: [proposalDocument] }));
		dbMock.update
			.mockReturnValueOnce(createChain({ result: [{ ...documentRow, status: "review" }] }))
			.mockReturnValueOnce(createChain({
				result: [{ ...proposalDocument, status: "in_review", reviewerId: "reviewer-1" }],
				onSet: (value) => {
					proposalPatch = value;
				},
			}));

		const result = await transitionDocumentAuthoringWorkflow({
			documentId: "doc-1",
			proposalDocumentId: "proposal-doc-1",
			action: "submit_review",
			reason: "Ready for color-team review",
			assignedTo: "reviewer-1",
		});

		expect(result).toMatchObject({
			fromState: "drafting",
			toState: "in_review",
			versionNumber: 1,
		});
		expect(proposalPatch).toMatchObject({
			status: "in_review",
			reviewerId: "reviewer-1",
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			toState: "in_review",
			assignedTo: "reviewer-1",
			assignedRole: "proposal_reviewer",
			terminal: false,
		}));
	});

	it("rejects ready approval when the session lacks proposal authority", async () => {
		requireUserContextMock.mockResolvedValueOnce({
			userId: "writer-1",
			organizationId: "org-1",
			roles: ["writer"],
		});
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [documentRow] }))
			.mockReturnValueOnce(createChain({ result: [proposalDocument] }));

		await expect(
			transitionDocumentAuthoringWorkflow({
				documentId: "doc-1",
				proposalDocumentId: "proposal-doc-1",
				action: "mark_ready",
				reason: "Ready for final approval",
			})
		).rejects.toThrow("requires proposal_manager or capture_manager");

		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("marks a proposal document ready only for a proposal authority session", async () => {
		let documentPatch: Record<string, unknown> | undefined;
		let proposalPatch: Record<string, unknown> | undefined;
		requireUserContextMock.mockResolvedValueOnce({
			userId: "writer-1",
			organizationId: "org-1",
			roles: ["proposal_manager"],
		});
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [documentRow] }))
			.mockReturnValueOnce(createChain({ result: [proposalDocument] }));
		dbMock.update
			.mockReturnValueOnce(createChain({
				result: [{ ...documentRow, status: "approved" }],
				onSet: (value) => {
					documentPatch = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [{ ...proposalDocument, status: "approved", approvedBy: "writer-1" }],
				onSet: (value) => {
					proposalPatch = value;
				},
			}));

		const result = await transitionDocumentAuthoringWorkflow({
			documentId: "doc-1",
			proposalDocumentId: "proposal-doc-1",
			action: "mark_ready",
			reason: "Ready for final approval",
		});

		expect(result.toState).toBe("ready");
		expect(documentPatch).toMatchObject({ status: "approved" });
		expect(proposalPatch).toMatchObject({
			status: "approved",
			approvedBy: "writer-1",
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			toState: "ready",
			terminal: true,
		}));
	});

	it("requires a transition reason", async () => {
		await expect(
			createWorkflowDocumentFromTemplate({
				title: "Untitled",
				reason: " ",
			})
		).rejects.toThrow("Document creation transitions require a reason");

		await expect(
			transitionDocumentAuthoringWorkflow({
				documentId: "doc-1",
				action: "start_drafting",
				reason: " ",
			})
		).rejects.toThrow("Document authoring transitions require a reason");
	});
});
