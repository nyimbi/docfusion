import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
	onSet?: (value: Record<string, unknown>) => void;
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
			result: [{ ...proposalDocument, status: "approved" }],
			onWhere: (value) => {
				wheres.push(value);
			},
		}));
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{ proposal_documents: { ...proposalDocument, status: "approved" }, documents: documentRow }],
			onWhere: (value) => {
				wheres.push(value);
			},
		}));

		const result = await updateProposalDocument(proposalDocument.id, { status: "approved" });

		expect(result).toMatchObject({ id: proposalDocument.id, status: "approved" });
		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
		}
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
			complianceStatus: "not_addressed",
			responseSection: null,
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
