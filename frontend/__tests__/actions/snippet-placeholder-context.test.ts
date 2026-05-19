import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((left, right) => ({ left, right })),
	and: vi.fn((...conditions) => ({ type: "and", conditions })),
	sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
		type: "sql",
		text: Array.from(strings).join("?"),
		values,
	})),
}));

vi.mock("@/lib/db", () => ({
	db: dbMock,
	documents: {
		id: "documents.id",
		title: "documents.title",
		metadata: "documents.metadata",
	},
	proposalDocuments: {
		id: "proposal_documents.id",
		documentId: "proposal_documents.document_id",
		opportunityId: "proposal_documents.opportunity_id",
	},
	opportunities: {
		id: "opportunities.id",
		organization: "opportunities.organization",
		title: "opportunities.title",
		deadline: "opportunities.deadline",
		rfpLink: "opportunities.rfp_link",
		budgetValue: "opportunities.budget_value",
		metadata: "opportunities.metadata",
	},
	rfpRequirements: {
		id: "rfp_requirements.id",
		organizationId: "rfp_requirements.organization_id",
		opportunityId: "rfp_requirements.opportunity_id",
		requirementNumber: "rfp_requirements.requirement_number",
		requirementText: "rfp_requirements.requirement_text",
	},
}));

import { loadSnippetPlaceholderContext } from "@/lib/placeholders/context-resolution";

function createSelectChain(result: unknown[], onWhere?: (value: unknown) => void) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "limit"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		onWhere?.(value);
		return chain;
	});
	chain.then = (resolve: (value: unknown[]) => void) => Promise.resolve(result).then(resolve);
	return chain;
}

function queueSelectResults(...results: unknown[][]) {
	dbMock.select.mockImplementation(() => createSelectChain(results.shift() ?? []));
}

describe("snippet placeholder context resolution", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("lets explicit opportunity context win while reporting document-link mismatch", async () => {
		queueSelectResults(
			[
				{
					id: "doc-1",
					title: "Response Draft",
					metadata: { opportunityId: "metadata-opp" },
				},
			],
			[
				{
					id: "proposal-doc-1",
					opportunityId: "linked-opp",
				},
			],
			[
				{
					id: "explicit-opp",
					organization: "Acme Health",
					title: "Digital Casework Modernisation",
					deadline: new Date("2026-06-01T00:00:00.000Z"),
					rfpLink: "https://example.test/rfp",
					budgetValue: "250000",
					metadata: { solicitationNumber: "RFP-2026-42" },
				},
			]
		);

		const context = await loadSnippetPlaceholderContext({
			documentId: "doc-1",
			opportunityId: "explicit-opp",
		});

		expect(context.resolvedOpportunityId).toBe("explicit-opp");
		expect(context.values).toMatchObject({
			client_name: "Acme Health",
			opportunity_name: "Digital Casework Modernisation",
			submission_date: "2026-06-01",
			solicitation_number: "RFP-2026-42",
		});
		expect(context.diagnostics).toEqual([
			expect.objectContaining({
				code: "explicitOpportunityLinkMismatch",
			}),
		]);
	});

	it("blocks ambiguous multi-opportunity document links unless an opportunity is explicit", async () => {
		queueSelectResults(
			[
				{
					id: "doc-1",
					title: "Shared Draft",
					metadata: {
						clientName: "Document Client",
						rfpNumber: "DOC-RFP-9",
						dueDate: "2026-07-15",
						projectValue: 120000,
						opportunityId: "metadata-opp",
					},
				},
			],
			[
				{ id: "proposal-doc-1", opportunityId: "opp-1" },
				{ id: "proposal-doc-2", opportunityId: "opp-2" },
			]
		);

		const context = await loadSnippetPlaceholderContext({ documentId: "doc-1" });

		expect(context.resolvedOpportunityId).toBeUndefined();
		expect(context.values.client_name).toBe("Document Client");
		expect(context.values.solicitation_number).toBe("DOC-RFP-9");
		expect(context.values.submission_date).toBe("2026-07-15");
		expect(context.values.project_value).toBe("120000");
		expect(context.values.opportunity_name).toBeUndefined();
		expect(context.diagnostics).toEqual([
			expect.objectContaining({
				code: "ambiguousOpportunityLink",
			}),
		]);
	});

	it("uses a single proposal-document link to resolve opportunity fields", async () => {
		queueSelectResults(
			[
				{
					id: "doc-1",
					title: "Response Draft",
					metadata: {},
				},
			],
			[{ id: "proposal-doc-1", opportunityId: "opp-1" }],
			[
				{
					id: "opp-1",
					organization: "Single Link Client",
					title: "Single Link Opportunity",
					deadline: new Date("2026-08-01T00:00:00.000Z"),
					rfpLink: "https://example.test/single-link",
					budgetValue: 750000,
					metadata: { rfp_number: "SL-2026-01" },
				},
			]
		);

		const context = await loadSnippetPlaceholderContext({ documentId: "doc-1" });

		expect(context.resolvedOpportunityId).toBe("opp-1");
		expect(context.values).toMatchObject({
			client_name: "Single Link Client",
			opportunity_name: "Single Link Opportunity",
			submission_date: "2026-08-01",
			rfp_url: "https://example.test/single-link",
			project_value: "750000",
			solicitation_number: "SL-2026-01",
		});
	});

	it("scopes document-derived placeholder context to the actor when access context is supplied", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createSelectChain(
				[
					{
						id: "doc-1",
						title: "Scoped Draft",
						metadata: {},
					},
				],
				(value) => {
					wheres.push(value);
				}
			))
			.mockReturnValueOnce(createSelectChain(
				[],
				(value) => {
					wheres.push(value);
				}
			));

		await loadSnippetPlaceholderContext({
			documentId: "doc-1",
			accessContext: {
				userId: "user-1",
				organizationId: "org-1",
			},
		});

		expect(JSON.stringify(wheres[0])).toContain("doc-1");
		expect(JSON.stringify(wheres[0])).toContain("user-1");
		expect(JSON.stringify(wheres[1])).toContain("doc-1");
		expect(JSON.stringify(wheres[1])).toContain("user-1");
	});

	it("falls back to document metadata opportunityId when no canonical links exist", async () => {
		queueSelectResults(
			[
				{
					id: "doc-1",
					title: "Metadata Linked Draft",
					metadata: {
						opportunityId: "metadata-opp",
						clientName: "Metadata Client",
					},
				},
			],
			[],
			[
				{
					id: "metadata-opp",
					organization: "Metadata Opportunity Client",
					title: "Metadata Opportunity",
					deadline: "2026-09-01",
					rfpLink: "https://example.test/metadata",
					budgetValue: "500000",
					metadata: { solicitationNumber: "META-1" },
				},
			]
		);

		const context = await loadSnippetPlaceholderContext({ documentId: "doc-1" });

		expect(context.resolvedOpportunityId).toBe("metadata-opp");
		expect(context.values.client_name).toBe("Metadata Opportunity Client");
		expect(context.valueSources.client_name).toBe("opportunity.organization");
		expect(context.values.opportunity_name).toBe("Metadata Opportunity");
	});

	it("uses explicit requirement text before derived requirement text", async () => {
		queueSelectResults(
			[
				{
					opportunityId: "req-opp",
					requirementNumber: "C.3.1",
					requirementText: "Derived requirement text",
				},
			],
			[
				{
					id: "req-opp",
					organization: "Requirement Client",
					title: "Requirement Opportunity",
					deadline: null,
					rfpLink: null,
					budgetValue: null,
					metadata: {},
				},
			]
		);

		const context = await loadSnippetPlaceholderContext({
			requirementId: "req-1",
			requirementText: "Explicit selected requirement text",
		});

		expect(context.resolvedOpportunityId).toBe("req-opp");
		expect(context.values.requirement_number).toBe("C.3.1");
		expect(context.values.requirement_text).toBe("Explicit selected requirement text");
		expect(context.valueSources.requirement_text).toBe("request.requirementText");
		expect(context.values.client_name).toBe("Requirement Client");
	});
});
