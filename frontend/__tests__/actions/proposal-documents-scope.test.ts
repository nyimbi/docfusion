import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));

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
	createProposalDocument,
	createStandardProposalSet,
	generateRequirementAwareSectionDraft,
	getDocumentSections,
	getProposalDocument,
	updateProposalDocument,
	updateSection,
} from "@/lib/actions/proposal-documents";

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
		expect(collectSqlFragments(opportunityWhere).join(" ")).toContain("opportunities.assigned_to");
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
		let insertedDocument: Record<string, any> | undefined;
		let insertedSections: unknown;

		dbMock.select
			.mockReturnValueOnce(createChain({ result: [opportunity] }))
			.mockReturnValueOnce(createChain({ result: [technicalRequirement, financialRequirement] }))
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
		expect(collectSqlFragments(readWhere).join(" ")).toContain("opportunities.assigned_to");
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
			expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
		}
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
		expect(wheres.some((where) =>
			collectSqlFragments(where).join(" ").includes("opportunities.assigned_to")
		)).toBe(true);
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
		expect(collectSqlFragments(readWhere).join(" ")).toContain("opportunities.assigned_to");
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
		expect(collectSqlFragments(updateWhere).join(" ")).toContain("opportunities.assigned_to");
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
		const updateSets: Record<string, unknown>[] = [];
		const updateWheres: unknown[] = [];
		let versionInsert: Record<string, unknown> | undefined;

		dbMock.select
			.mockReturnValueOnce(createChain({ result: [linkedSection] }))
			.mockReturnValueOnce(createChain({ result: [proposalDocument] }))
			.mockReturnValueOnce(createChain({ result: [sourceDocument] }))
			.mockReturnValueOnce(createChain({ result: [opportunity] }))
			.mockReturnValueOnce(createChain({ result: [requirement] }));
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
			versionNumber: 2,
		});
		expect(result.plainText).toContain("Direct Requirement Responses");
		expect(result.plainText).toContain("REQ-007");
		expect(result.plainText).toContain("offline data capture");
		expect(flattenText(updateSets[0]?.content)).toContain("Existing draft.");
		expect(flattenText(updateSets[0]?.content)).toContain("Workflow-First Delivery");
		expect(updateSets[0]?.metadata).toMatchObject({
			requirementAwareSectionDrafts: [
				expect.objectContaining({
					sectionId: linkedSection.id,
					requirementIds: [requirement.id],
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
		expect(updateWheres.some((where) =>
			collectSqlFragments(where).join(" ").includes("opportunities.assigned_to")
		)).toBe(true);
	});

	it("scopes bulk proposal document status updates through assigned opportunities", async () => {
		let updateWhere: unknown;
		dbMock.update.mockReturnValueOnce(createChain({
			onWhere: (value) => {
				updateWhere = value;
			},
		}));

		await bulkUpdateStatus([proposalDocument.id], "in_review");

		expect(collectSqlFragments(updateWhere).join(" ")).toContain("opportunities.assigned_to");
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
			expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
		}
	});
});
