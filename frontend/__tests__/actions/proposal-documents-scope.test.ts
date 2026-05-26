import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const requireUserContextMock = vi.hoisted(() => vi.fn());
const recordWorkflowRuntimeTransitionMock = vi.hoisted(() => vi.fn());
const upsertWorkflowRuntimeTaskMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: recordWorkflowRuntimeTransitionMock,
	upsertWorkflowRuntimeTask: upsertWorkflowRuntimeTaskMock,
}));

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
	onSet?: (value: Record<string, unknown>) => void;
	onValues?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "leftJoin", "limit", "orderBy"]) {
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
	chain.values = vi.fn((value: unknown) => {
		config.onValues?.(value);
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

function sqlText(value: unknown): string {
	return collectSqlFragments(value).join(" ");
}

function hasOpportunityTenantScope(where: unknown): boolean {
	const text = sqlText(where);
	return text.includes("opportunities.organization_id") &&
		text.includes("org-1") &&
		text.includes("opportunities.assigned_to") &&
		text.includes("proposal-user-1");
}

function expectOpportunityTenantScope(where: unknown) {
	expect(hasOpportunityTenantScope(where)).toBe(true);
}

function flattenText(value: unknown): string {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map(flattenText).join(" ");
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		return [record.text, record.content].map(flattenText).join(" ");
	}
	return "";
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
	insert: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth-utils", () => {
	const normalizeRoles = (role?: string | null, roles?: Array<string | null | undefined> | null) =>
		[role, ...(roles ?? [])]
			.filter((value): value is string => Boolean(value?.trim()))
			.map((value) => value.trim().toLowerCase());
	const userHasAuthorityRole = (
		context: { role?: string | null; roles?: string[] | null },
		requiredRole: string
	) => {
		const roles = new Set(normalizeRoles(context.role, context.roles));
		return roles.has("admin") || roles.has(requiredRole.trim().toLowerCase());
	};
	return {
		getCurrentUserId: getCurrentUserIdMock,
		requireUserContext: requireUserContextMock,
		userHasAuthorityRole,
	};
});

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

import {
	bulkUpdateStatus,
	createAndDraftStandardProposalSet,
	createProposalDocument,
	createStandardProposalSet,
	generateRequirementAwareSectionDraft,
	getDocumentSections,
	getProposalDocument,
	updateProposalDocument,
	updateSection,
} from "@/lib/actions/proposal-documents";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

const proposalDocument = {
	id: "55555555-5555-4555-8555-555555555555",
	opportunityId: "33333333-3333-4333-8333-333333333333",
	documentId: "44444444-4444-4444-8444-444444444444",
	documentType: "technical_approach",
	sectionOrder: 1,
	status: "drafting",
	assignedTo: "proposal-user-1",
	dueDate: null,
	reviewerId: null,
	approvedBy: null,
	approvedAt: null,
	aiAnalysisScore: null,
	aiAnalysisAt: null,
	notes: null,
	createdAt: new Date("2026-05-19T12:00:00.000Z"),
	updatedAt: new Date("2026-05-19T12:00:00.000Z"),
};

const documentRow = {
	id: proposalDocument.documentId,
	title: "Technical Approach",
	wordCount: 1200,
	status: "draft",
	updatedAt: new Date("2026-05-19T12:00:00.000Z"),
};

const section = {
	id: "66666666-6666-4666-8666-666666666666",
	proposalDocumentId: proposalDocument.id,
	sectionName: "Solution",
	sectionOrder: 1,
	status: "drafting",
	wordCount: 200,
	targetWordCount: 500,
	assignedTo: "proposal-user-1",
	dueDate: null,
	requirementIds: [],
	createdAt: new Date("2026-05-19T12:00:00.000Z"),
	updatedAt: new Date("2026-05-19T12:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue("proposal-user-1");
	requireUserContextMock.mockResolvedValue({
		userId: "proposal-user-1",
		organizationId: "org-1",
		roles: ["proposal_manager"],
	});
	recordWorkflowRuntimeTransitionMock.mockResolvedValue({ id: "response-package-workflow-1" });
	upsertWorkflowRuntimeTaskMock.mockResolvedValue(undefined);
});

describe("proposal document row scoping", () => {
	it("checks opportunity assignment before creating proposal documents", async () => {
		let opportunityWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				opportunityWhere = value;
			},
		}));

		await expect(createProposalDocument({
			opportunityId: proposalDocument.opportunityId,
			documentType: "technical_approach",
		})).rejects.toThrow("Opportunity not found");

		expect(dbMock.insert).not.toHaveBeenCalled();
		expectOpportunityTenantScope(opportunityWhere);
	});

	it("seeds new proposal drafts with opportunity context and matching requirement response plans", async () => {
		const opportunity = {
			id: proposalDocument.opportunityId,
			title: "Offline Field Reporting Platform",
			organization: "Regional Authority",
			sector: "Government/SOE",
			countryRegion: "East Africa",
			category: "Digital Transformation",
			deadline: new Date("2026-06-15T00:00:00.000Z"),
			budgetValue: "USD 500,000",
			projectSummary: "Deploy an offline-first reporting platform for field teams.",
			projectScope: "Mobile data collection, workflow approvals, dashboards, and audit exports.",
			keyRequirements: "Offline-first operation and source-linked reporting.",
			technicalRequirements: "Role-based access control and immutable audit trails.",
			submissionRequirements: "Provide a requirement-by-requirement technical response.",
			fitScore: 91,
			winProbability: 64,
			strategicNotes: "Emphasize Datacraft's live institutional intelligence footprint.",
		};
		const technicalRequirement = {
			id: "77777777-7777-4777-8777-777777777777",
			requirementNumber: "REQ-007",
			title: "Offline reporting",
			requirementText: "The supplier shall support offline data capture and synchronized reporting.",
			sourceQuote: "Offline data capture is mandatory.",
			sourcePage: 12,
			sourceSection: "Section C.4",
			category: "technical",
			priority: "mandatory",
			riskLevel: "high",
			complianceStatus: "not_addressed",
			responseStrategy: "Use MeGuard field operations and Lindela source-cited evidence controls.",
			suggestedApproach: null,
		};
		const financialRequirement = {
			...technicalRequirement,
			id: "88888888-8888-4888-8888-888888888888",
			requirementNumber: "REQ-009",
			category: "financial",
			requirementText: "The supplier shall provide a fixed price schedule.",
		};
		const activeWinTheme = {
			id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
			opportunityId: proposalDocument.opportunityId,
			themeStatement: "Datacraft lowers delivery risk through source-cited evidence controls.",
			shortVersion: "Evidence-led delivery",
			themeType: "risk_reduction",
			priority: 1,
			supportingEvidence: ["Lindela source citation and workflow audit trails"],
		};
		let insertedDocument: Record<string, any> | undefined;
		let insertedSections: unknown;

		dbMock.select
			.mockReturnValueOnce(createChain({ result: [opportunity] }))
			.mockReturnValueOnce(createChain({ result: [technicalRequirement, financialRequirement] }))
			.mockReturnValueOnce(createChain({ result: [activeWinTheme] }))
			.mockReturnValueOnce(createChain({ result: [{ maxOrder: 0 }] }));
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [{ ...documentRow, title: "Technical Approach - Draft", content: {}, plainText: "" }],
				onValues: (value) => {
					insertedDocument = value as Record<string, any>;
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [proposalDocument],
			}))
			.mockReturnValueOnce(createChain({
				onValues: (value) => {
					insertedSections = value;
				},
			}));

		const result = await createProposalDocument({
			opportunityId: proposalDocument.opportunityId,
			documentType: "technical_approach",
		});

		expect(result).toMatchObject({ id: proposalDocument.id, documentType: "technical_approach" });
		expect(insertedDocument).toBeDefined();
		const seededText = flattenText(insertedDocument?.content);
		expect(seededText).toContain("Opportunity-Specific Response Plan");
		expect(seededText).toContain("Offline Field Reporting Platform");
		expect(seededText).toContain("Requirement Response Plan");
		expect(seededText).toContain("Approved Win Themes");
		expect(seededText).toContain("Evidence-led delivery");
		expect(seededText).toContain("Datacraft lowers delivery risk");
		expect(seededText).toContain("REQ-007");
		expect(seededText).toContain("offline data capture");
		expect(seededText).toContain("Response strategy: Use MeGuard field operations");
		expect(seededText).toContain("Compliance Gap Closure");
		expect(seededText).toContain("Datacraft Proof Points");
		expect(seededText).toContain("Lindela");
		expect(seededText).not.toContain("REQ-009");
		expect(insertedDocument?.plainText).toContain("Requirement Response Plan");
		expect(insertedDocument?.metadata).toMatchObject({
			documentType: "technical_approach",
			opportunityId: proposalDocument.opportunityId,
			seededRequirementIds: [technicalRequirement.id],
			seededWinThemeIds: [activeWinTheme.id],
		});
		expect(insertedSections).toEqual(expect.any(Array));
	});

	it("scopes proposal document reads through the owning opportunity", async () => {
		let readWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{ proposal_documents: proposalDocument, documents: documentRow }],
			onWhere: (value) => {
				readWhere = value;
			},
		}));

		const result = await getProposalDocument(proposalDocument.id);

		expect(result).toMatchObject({ id: proposalDocument.id });
		expectOpportunityTenantScope(readWhere);
	});

	it("scopes proposal document updates and reloads through the owning opportunity", async () => {
		const wheres: unknown[] = [];
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ ...proposalDocument, status: "in_review" }],
			onWhere: (value) => {
				wheres.push(value);
			},
		}));
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{ proposal_documents: { ...proposalDocument, status: "in_review" }, documents: documentRow }],
			onWhere: (value) => {
				wheres.push(value);
			},
		}));

		const result = await updateProposalDocument(proposalDocument.id, { status: "in_review" });

		expect(result).toMatchObject({ id: proposalDocument.id, status: "in_review" });
		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			expectOpportunityTenantScope(where);
		}
	});

	it("rejects direct proposal document approval when the session lacks proposal authority", async () => {
		requireUserContextMock.mockResolvedValueOnce({
			userId: "proposal-user-1",
			organizationId: "org-1",
			roles: ["writer"],
		});

		await expect(updateProposalDocument(proposalDocument.id, { status: "approved" }))
			.rejects.toThrow("requires proposal_manager or capture_manager");

		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("blocks final proposal status while linked requirements are not compliant", async () => {
		const linkedSection = {
			...section,
			requirementIds: ["77777777-7777-4777-8777-777777777777"],
		};
		const requirement = {
			id: "77777777-7777-4777-8777-777777777777",
			requirementNumber: "REQ-007",
			title: "Offline reporting",
			complianceStatus: "partial",
		};
		const wheres: unknown[] = [];

		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [proposalDocument],
				onWhere: (value) => {
					wheres.push(value);
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [linkedSection],
				onWhere: (value) => {
					wheres.push(value);
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [requirement],
				onWhere: (value) => {
					wheres.push(value);
				},
			}));

		await expect(updateProposalDocument(proposalDocument.id, { status: "approved" }))
			.rejects.toThrow("linked requirements are compliant");

		expect(dbMock.update).not.toHaveBeenCalled();
		expect(wheres.some(hasOpportunityTenantScope)).toBe(true);
	});

	it("scopes section reads through the owning proposal document opportunity", async () => {
		let readWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [section],
			onWhere: (value) => {
				readWhere = value;
			},
		}));

		const result = await getDocumentSections(proposalDocument.id);

		expect(result).toHaveLength(1);
		expectOpportunityTenantScope(readWhere);
	});

	it("scopes section updates through the owning proposal document opportunity", async () => {
		let updateWhere: unknown;
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ ...section, status: "in_review" }],
			onWhere: (value) => {
				updateWhere = value;
			},
		}));

		const result = await updateSection(section.id, { status: "in_review" });

		expect(result).toMatchObject({ id: section.id, status: "in_review" });
		expectOpportunityTenantScope(updateWhere);
	});

	it("persists requirement-aware section drafts and advances linked requirement coverage", async () => {
		const requirement = {
			id: "77777777-7777-4777-8777-777777777777",
			requirementNumber: "REQ-007",
			title: "Offline reporting",
			requirementText: "The supplier shall support offline data capture and synchronized reporting.",
			sourcePage: 12,
			sourceSection: "Section C.4",
			category: "technical",
			priority: "mandatory",
			riskLevel: "high",
			complianceStatus: "not_addressed",
			responseStrategy: null,
			suggestedApproach: "Show offline capture, synchronization, and audit controls.",
		};
		const linkedSection = {
			...section,
			sectionName: "Workflow-First Delivery",
			requirementIds: [requirement.id],
		};
		const sourceDocument = {
			...documentRow,
			content: {
				type: "doc",
				content: [{ type: "paragraph", content: [{ type: "text", text: "Existing draft." }] }],
			},
			plainText: "Existing draft.",
			metadata: { source: "datacraft_response_sections" },
			currentVersion: 1,
			characterCount: 15,
			ownerId: "proposal-user-1",
		};
		const opportunity = {
			id: proposalDocument.opportunityId,
			title: "Offline Field Reporting Platform",
			organization: "Regional Authority",
			sector: "Government/SOE",
			countryRegion: "East Africa",
			category: "Digital Transformation",
			deadline: null,
			budgetValue: null,
			projectSummary: null,
			projectScope: null,
			keyRequirements: null,
			technicalRequirements: null,
			submissionRequirements: null,
			fitScore: null,
			winProbability: null,
			strategicNotes: null,
		};
		const activeWinTheme = {
			id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
			opportunityId: proposalDocument.opportunityId,
			themeStatement: "Datacraft lowers section-level delivery risk through source-cited evidence controls.",
			shortVersion: "Evidence-led delivery",
			themeType: "risk_reduction",
			priority: 1,
			supportingEvidence: ["Requirement traceability and workflow audit trails"],
		};
		const updateSets: Record<string, unknown>[] = [];
		const updateWheres: unknown[] = [];
		let versionInsert: Record<string, unknown> | undefined;

		dbMock.select
			.mockReturnValueOnce(createChain({ result: [linkedSection] }))
			.mockReturnValueOnce(createChain({ result: [proposalDocument] }))
			.mockReturnValueOnce(createChain({ result: [sourceDocument] }))
			.mockReturnValueOnce(createChain({ result: [opportunity] }))
			.mockReturnValueOnce(createChain({ result: [requirement] }))
			.mockReturnValueOnce(createChain({ result: [activeWinTheme] }));
		dbMock.update.mockImplementation(() => createChain({
			result: [{ ...sourceDocument, currentVersion: 2 }],
			onSet: (value) => {
				updateSets.push(value);
			},
			onWhere: (value) => {
				updateWheres.push(value);
			},
		}));
		dbMock.insert.mockReturnValueOnce(createChain({
			onValues: (value) => {
				versionInsert = value as Record<string, unknown>;
			},
		}));

		const result = await generateRequirementAwareSectionDraft(linkedSection.id);

		expect(result).toMatchObject({
			sectionId: linkedSection.id,
			proposalDocumentId: proposalDocument.id,
			documentId: sourceDocument.id,
			requirementIds: [requirement.id],
			winThemeIds: [activeWinTheme.id],
			versionNumber: 2,
		});
		expect(result.plainText).toContain("Direct Requirement Responses");
		expect(result.plainText).toContain("REQ-007");
		expect(result.plainText).toContain("offline data capture");
		expect(result.plainText).toContain("Approved Win Themes");
		expect(result.plainText).toContain("Evidence-led delivery");
		expect(result.plainText).toContain("section-level delivery risk");
		expect(flattenText(updateSets[0]?.content)).toContain("Existing draft.");
		expect(flattenText(updateSets[0]?.content)).toContain("Workflow-First Delivery");
		expect(updateSets[0]?.metadata).toMatchObject({
			requirementAwareSectionDrafts: [
				expect.objectContaining({
					sectionId: linkedSection.id,
					requirementIds: [requirement.id],
					winThemeIds: [activeWinTheme.id],
				}),
			],
		});
		expect(versionInsert).toMatchObject({
			documentId: sourceDocument.id,
			versionNumber: 2,
			changeDescription: "Generated requirement-aware draft for Workflow-First Delivery",
		});
		expect(updateSets).toEqual(expect.arrayContaining([
			expect.objectContaining({
				status: "drafting",
				requirementIds: [requirement.id],
			}),
			expect.objectContaining({
				responseDocumentId: sourceDocument.id,
				responseSection: linkedSection.sectionName,
				complianceStatus: "partial",
			}),
		]));
		expect(updateWheres.some(hasOpportunityTenantScope)).toBe(true);
	});

	it("scopes bulk proposal document status updates through assigned opportunities", async () => {
		let updateWhere: unknown;
		dbMock.update.mockReturnValueOnce(createChain({
			onWhere: (value) => {
				updateWhere = value;
			},
		}));

		await bulkUpdateStatus([proposalDocument.id], "in_review");

		expectOpportunityTenantScope(updateWhere);
	});

	it("rejects bulk final proposal status updates when the session lacks proposal authority", async () => {
		requireUserContextMock.mockResolvedValueOnce({
			userId: "proposal-user-1",
			organizationId: "org-1",
			roles: ["writer"],
		});

		await expect(bulkUpdateStatus([proposalDocument.id], "approved"))
			.rejects.toThrow("requires proposal_manager or capture_manager");

		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("links existing standard proposal documents to matching requirements without duplicating documents", async () => {
		const requirement = {
			id: "77777777-7777-4777-8777-777777777777",
			opportunityId: proposalDocument.opportunityId,
			category: "technical",
			complianceStatus: "partial",
			responseSection: null,
			metadata: {
				workflow: {
					state: "accepted",
				},
			},
		};
		const updateSets: Record<string, unknown>[] = [];
		const updateWheres: unknown[] = [];

		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{ id: proposalDocument.opportunityId }],
			}))
			.mockReturnValueOnce(createChain({
				result: [proposalDocument],
			}))
			.mockReturnValueOnce(createChain({
				result: [requirement],
			}))
			.mockReturnValueOnce(createChain({
				result: [section],
			}));
		dbMock.update.mockImplementation(() => createChain({
			onSet: (value) => {
				updateSets.push(value);
			},
			onWhere: (value) => {
				updateWheres.push(value);
			},
		}));

		const created = await createStandardProposalSet(
			proposalDocument.opportunityId,
			["technical_approach"]
		);

		expect(created).toEqual([]);
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(updateSets).toEqual(expect.arrayContaining([
			expect.objectContaining({
				responseDocumentId: proposalDocument.documentId,
				responseSection: section.sectionName,
			}),
			expect.objectContaining({
				requirementIds: [requirement.id],
			}),
		]));
		expect(updateWheres).toHaveLength(2);
		for (const where of updateWheres) {
			expectOpportunityTenantScope(where);
		}
	});

	it("seeds response package documents from accepted requirements only when requested", async () => {
		const opportunity = {
			id: proposalDocument.opportunityId,
			title: "Offline Field Reporting Platform",
			organization: "Regional Authority",
			sector: "Government/SOE",
			countryRegion: "East Africa",
			category: "Digital Transformation",
			deadline: null,
			budgetValue: null,
			projectSummary: "Deploy an offline-first reporting platform.",
			projectScope: null,
			keyRequirements: null,
			technicalRequirements: null,
			submissionRequirements: null,
			fitScore: null,
			winProbability: null,
			strategicNotes: null,
		};
		const acceptedRequirement = {
			id: "77777777-7777-4777-8777-777777777777",
			opportunityId: proposalDocument.opportunityId,
			requirementNumber: "REQ-ACCEPTED",
			title: "Offline reporting",
			requirementText: "The supplier shall support offline reporting.",
			sourcePage: 12,
			sourceSection: "Section C.4",
			category: "technical",
			priority: "mandatory",
			riskLevel: "high",
			complianceStatus: "partial",
			responseStrategy: "Show offline capture, synchronization, and audit controls.",
			suggestedApproach: null,
			metadata: {
				workflow: {
					state: "accepted",
				},
			},
		};
		const unacceptedRequirement = {
			...acceptedRequirement,
			id: "99999999-9999-4999-8999-999999999999",
			requirementNumber: "REQ-DRAFT",
			requirementText: "The supplier shall provide a draft-only integration plan.",
			responseStrategy: "This unaccepted plan must not be seeded into package drafts.",
			complianceStatus: "not_addressed",
			metadata: {
				workflow: {
					state: "draft",
				},
			},
		};
		let insertedDocument: Record<string, any> | undefined;
		let insertedSections: unknown;

		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ id: proposalDocument.opportunityId }] }))
			.mockReturnValueOnce(createChain({ result: [] }))
			.mockReturnValueOnce(createChain({ result: [opportunity] }))
			.mockReturnValueOnce(createChain({ result: [acceptedRequirement, unacceptedRequirement] }))
			.mockReturnValueOnce(createChain({ result: [] }))
			.mockReturnValueOnce(createChain({ result: [{ maxOrder: 0 }] }))
			.mockReturnValueOnce(createChain({ result: [acceptedRequirement, unacceptedRequirement] }))
			.mockReturnValueOnce(createChain({ result: [section] }));
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [{ ...documentRow, title: "Technical Approach - Draft", content: {}, plainText: "" }],
				onValues: (value) => {
					insertedDocument = value as Record<string, any>;
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [proposalDocument],
			}))
			.mockReturnValueOnce(createChain({
				onValues: (value) => {
					insertedSections = value;
				},
			}));
		dbMock.update.mockReturnValue(createChain());

		const created = await createStandardProposalSet(
			proposalDocument.opportunityId,
			["technical_approach"],
			{ seedAcceptedRequirementsOnly: true }
		);

		expect(created).toHaveLength(1);
		const seededText = flattenText(insertedDocument?.content);
		expect(seededText).toContain("REQ-ACCEPTED");
		expect(seededText).toContain("offline reporting");
		expect(seededText).not.toContain("REQ-DRAFT");
		expect(seededText).not.toContain("draft-only integration plan");
		expect(insertedDocument?.metadata).toMatchObject({
			documentType: "technical_approach",
			opportunityId: proposalDocument.opportunityId,
			requirementSeedPolicy: "accepted_only",
			seededRequirementIds: [acceptedRequirement.id],
		});
		expect(insertedSections).toEqual(expect.any(Array));
	});

	it("creates and drafts a standard package from accepted requirements", async () => {
		const requirement = {
			id: "77777777-7777-4777-8777-777777777777",
			opportunityId: proposalDocument.opportunityId,
			requirementNumber: "REQ-007",
			title: "Offline reporting",
			requirementText: "The supplier shall support offline data capture and synchronized reporting.",
			sourcePage: 12,
			sourceSection: "Section C.4",
			category: "technical",
			priority: "mandatory",
			riskLevel: "high",
			complianceStatus: "compliant",
			responseStrategy: null,
			suggestedApproach: "Show offline capture, synchronization, and audit controls.",
			organizationId: "org-1",
			responseDocumentId: null,
			responseSection: null,
			assignedTo: "proposal-user-1",
			dueDate: null,
			metadata: {
				workflow: {
					state: "accepted",
				},
			},
		};
		const linkedRequirement = {
			...requirement,
			responseDocumentId: proposalDocument.documentId,
			responseSection: "Workflow-First Delivery",
		};
		let complianceEntryInsert: unknown;
		const linkedSection = {
			...section,
			sectionName: linkedRequirement.responseSection,
			requirementIds: [requirement.id],
		};
		const sourceDocument = {
			...documentRow,
			content: {
				type: "doc",
				content: [{ type: "paragraph", content: [{ type: "text", text: "Existing draft." }] }],
			},
			plainText: "Existing draft.",
			metadata: { source: "datacraft_response_sections" },
			currentVersion: 1,
			characterCount: 15,
			ownerId: "proposal-user-1",
		};
		const opportunity = {
			id: proposalDocument.opportunityId,
			title: "Offline Field Reporting Platform",
			organization: "Regional Authority",
			sector: "Government/SOE",
			countryRegion: "East Africa",
			category: "Digital Transformation",
			deadline: null,
			budgetValue: null,
			projectSummary: null,
			projectScope: null,
			keyRequirements: null,
			technicalRequirements: null,
			submissionRequirements: null,
			fitScore: null,
			winProbability: null,
			strategicNotes: null,
		};

		dbMock.select
			.mockReturnValueOnce(createChain({ result: [requirement] }))
			.mockReturnValueOnce(createChain({ result: [{ id: proposalDocument.opportunityId }] }))
			.mockReturnValueOnce(createChain({ result: [proposalDocument] }))
			.mockReturnValueOnce(createChain({ result: [requirement] }))
			.mockReturnValueOnce(createChain({ result: [section] }))
			.mockReturnValueOnce(createChain({ result: [linkedRequirement] }))
			.mockReturnValueOnce(createChain({ result: [] }))
			.mockReturnValueOnce(createChain({ result: [] }))
			.mockReturnValueOnce(createChain({ result: [proposalDocument] }))
			.mockReturnValueOnce(createChain({ result: [proposalDocument] }))
			.mockReturnValueOnce(createChain({ result: [linkedSection] }))
			.mockReturnValueOnce(createChain({ result: [linkedSection] }))
			.mockReturnValueOnce(createChain({ result: [proposalDocument] }))
			.mockReturnValueOnce(createChain({ result: [sourceDocument] }))
			.mockReturnValueOnce(createChain({ result: [opportunity] }))
			.mockReturnValueOnce(createChain({ result: [linkedRequirement] }))
			.mockReturnValueOnce(createChain({ result: [] }));
		dbMock.update.mockImplementation(() => createChain({
			result: [{ ...sourceDocument, currentVersion: 2 }],
		}));
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [{
					id: "matrix-1",
					opportunityId: proposalDocument.opportunityId,
					organizationId: "org-1",
					metadata: null,
				}],
			}))
			.mockReturnValueOnce(createChain({
				onValues: (value) => {
					complianceEntryInsert = value;
				},
			}))
			.mockReturnValueOnce(createChain());

		const result = await createAndDraftStandardProposalSet(
			proposalDocument.opportunityId,
			["technical_approach"]
		);

		expect(result).toMatchObject({
			documentsCreated: 0,
			documentsDrafted: 1,
			sectionsDrafted: 1,
			complianceMatrixId: "matrix-1",
			complianceEntriesCreated: 1,
			requirementIds: [requirement.id],
			proposalDocumentIds: [proposalDocument.id],
			documentIds: [sourceDocument.id],
			versionNumber: 2,
		});
		expect(complianceEntryInsert).toEqual([
			expect.objectContaining({
				requirementId: requirement.id,
				complianceStatus: "compliant",
				responseDocumentId: proposalDocument.documentId,
				responseReference: linkedRequirement.responseSection,
				responseSummary: "Show offline capture, synchronization, and audit controls.",
				strengthAssessment: "strong",
				status: "draft",
			}),
		]);
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "proposal_response_package",
			subjectType: "opportunity",
			subjectId: proposalDocument.opportunityId,
			opportunityId: proposalDocument.opportunityId,
			toState: "response_package_drafted",
			eventType: "response_package_drafted",
			evidenceLinks: expect.arrayContaining([
				"compliance-matrix:matrix-1",
				`requirement:${requirement.id}`,
				`proposal-document:${proposalDocument.id}`,
				`document:${sourceDocument.id}`,
				"document-version:2",
			]),
			metadata: expect.objectContaining({
				sectionsDrafted: 1,
				requirementCount: 1,
				proposalDocumentCount: 1,
				documentVersionNumber: 2,
			}),
			actionUrl: `/opportunities/${proposalDocument.opportunityId}/documents`,
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			workflowInstanceId: "response-package-workflow-1",
			taskKey: `response-package-review:${proposalDocument.opportunityId}`,
			title: "Review drafted response package",
			state: "open",
			priority: "high",
			assignedRole: "proposal_manager",
			metadata: expect.objectContaining({
				requirementCount: 1,
				proposalDocumentCount: 1,
			}),
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			workflowInstanceId: "response-package-workflow-1",
			taskKey: `final-package-render:${proposalDocument.opportunityId}`,
			title: "Render approved final package",
			state: "open",
			priority: "medium",
			assignedRole: "proposal_manager",
			metadata: expect.objectContaining({
				complianceMatrixId: "matrix-1",
				versionNumber: 2,
			}),
		}));
	});
});
