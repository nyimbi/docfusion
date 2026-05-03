import { describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
	execute: vi.fn(),
	transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	db: dbMock,
}));

import {
	SNIPPET_CONTEXT_DOCUMENT_FIXTURE_KEYS,
	SNIPPET_CONTEXT_FIXTURE_LOCK_NAME,
	SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS,
	assertAppliedFixtureTopology,
	assertCanApplySnippetContextFixtures,
	assertNoUnexpectedFixtureLinks,
	assertSingleFixtureMatch,
	auditSnippetContextFixtures,
	buildSnippetContextFixtureDefinitions,
	getManualProofSnippetSeedContract,
	getSnippetFixtureTargetInfo,
	withSnippetContextFixtureApplyLock,
} from "@/lib/snippets/snippet-context-fixtures";

describe("snippet context fixture helpers", () => {
	it("keeps /dc-exec-summary suitable for manual browser placeholder proof", () => {
		expect(getManualProofSnippetSeedContract()).toEqual({
			exists: true,
			containsClientName: true,
			containsOpportunityName: true,
		});
	});

	it("defines canonical, metadata fallback, and ambiguous fixture topologies", () => {
		const definitions = buildSnippetContextFixtureDefinitions();
		const documents = new Map(definitions.documentFixtures.map((fixture) => [fixture.key, fixture]));

		expect(documents.get(SNIPPET_CONTEXT_DOCUMENT_FIXTURE_KEYS.singleLink)?.expectedOpportunityKeys).toEqual([
			SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS.singleLink,
		]);
		expect(documents.get(SNIPPET_CONTEXT_DOCUMENT_FIXTURE_KEYS.metadataFallback)?.expectedOpportunityKeys).toEqual([
			SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS.metadataFallback,
		]);
		expect(documents.get(SNIPPET_CONTEXT_DOCUMENT_FIXTURE_KEYS.metadataFallback)?.metadata).not.toHaveProperty("opportunityId");
		expect(documents.get(SNIPPET_CONTEXT_DOCUMENT_FIXTURE_KEYS.ambiguous)?.expectedOpportunityKeys).toEqual([
			SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS.ambiguousA,
			SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS.ambiguousB,
		]);
		expect(documents.get(SNIPPET_CONTEXT_DOCUMENT_FIXTURE_KEYS.ambiguous)?.metadata).toMatchObject({
			clientName: "Ambiguous Fixture Client",
		});
	});

	it("classifies fixture audit branch counts and duplicate proposal pairs", async () => {
		const fakeClient = {
			execute: vi
				.fn()
				.mockResolvedValueOnce({
					rows: [
						{
							documents: 7,
							proposalDocumentLinks: 3,
							singleLinkDocuments: 1,
							ambiguousLinkDocuments: 1,
							metadataFallbackDocuments: 1,
						},
					],
				})
				.mockResolvedValueOnce({
					rows: [
						{
							id: "doc-single",
							fixtureKey: SNIPPET_CONTEXT_DOCUMENT_FIXTURE_KEYS.singleLink,
							title: "Single",
							linkCount: 1,
							distinctOpportunityCount: 1,
							opportunityIds: ["opp-single"],
						},
						{
							id: "doc-metadata",
							fixtureKey: SNIPPET_CONTEXT_DOCUMENT_FIXTURE_KEYS.metadataFallback,
							title: "Metadata",
							linkCount: 0,
							distinctOpportunityCount: 0,
							opportunityIds: [],
						},
						{
							id: "doc-ambiguous",
							fixtureKey: SNIPPET_CONTEXT_DOCUMENT_FIXTURE_KEYS.ambiguous,
							title: "Ambiguous",
							linkCount: 2,
							distinctOpportunityCount: 2,
							opportunityIds: ["opp-a", "opp-b"],
						},
					],
				})
				.mockResolvedValueOnce({ rows: [] })
				.mockResolvedValueOnce({ rows: [] })
				.mockResolvedValueOnce({ rows: [] })
				.mockResolvedValueOnce({ rows: [{ opportunityId: "opp-x", documentId: "doc-x", count: 2 }] }),
		};

		const audit = await auditSnippetContextFixtures(fakeClient);

		expect(audit.totals).toMatchObject({
			documents: 7,
			proposalDocumentLinks: 3,
			singleLinkDocuments: 1,
			ambiguousLinkDocuments: 1,
			metadataFallbackDocuments: 1,
			duplicateProposalDocumentPairs: 1,
		});
		expect(audit.manualVerificationUrls).toMatchObject({
			[SNIPPET_CONTEXT_DOCUMENT_FIXTURE_KEYS.singleLink]: "/documents/doc-single",
			[SNIPPET_CONTEXT_DOCUMENT_FIXTURE_KEYS.metadataFallback]: "/documents/doc-metadata",
			[SNIPPET_CONTEXT_DOCUMENT_FIXTURE_KEYS.ambiguous]: "/documents/doc-ambiguous",
		});
	});

	it("takes the advisory lock before fixture apply work", async () => {
		const order: string[] = [];
		const tx = {
			execute: vi.fn(async (query: unknown) => {
				order.push(query ? "lock" : "missing-query");
				return { rows: [] };
			}),
		};
		const client = {
			transaction: vi.fn(async (callback: (txClient: typeof tx) => Promise<string>) => callback(tx)),
			execute: vi.fn(),
		} as unknown as Parameters<typeof withSnippetContextFixtureApplyLock>[0];

		const result = await withSnippetContextFixtureApplyLock(client, async () => {
			order.push("fixture-work");
			return "done";
		});

		expect(result).toBe("done");
		expect(tx.execute).toHaveBeenCalledTimes(1);
		expect(SNIPPET_CONTEXT_FIXTURE_LOCK_NAME).toBe("snippet-context-fixtures");
		expect(order[0]).toBe("lock");
		expect(order[1]).toBe("fixture-work");
	});

	it("requires a second confirmation for production-like fixture mutation", () => {
		const target = getSnippetFixtureTargetInfo(
			"postgresql://fixture-user:secret@db.lindela.io:5432/docfusion",
			"development"
		);

		expect(target.productionLike).toBe(true);
		expect(() => assertCanApplySnippetContextFixtures({ targetInfo: target })).toThrow(/Refusing to mutate/);
		expect(() =>
			assertCanApplySnippetContextFixtures({ targetInfo: target, confirmHost: "db.lindela.io" })
		).not.toThrow();
		expect(() => assertCanApplySnippetContextFixtures({ targetInfo: target, allowProduction: true })).not.toThrow();
	});

	it("hard-fails duplicate reserved fixture keys and unexpected topology drift", () => {
		expect(() => assertSingleFixtureMatch("document", "fixture-key", [{ id: "a" }, { id: "b" }])).toThrow(
			/Duplicate reserved document fixture key/
		);
		expect(() => assertNoUnexpectedFixtureLinks("fixture-key", ["opp-a"], ["opp-a", "opp-extra"])).toThrow(
			/topology drift/
		);
	});

	it("enforces branch-specific applied topology", () => {
		expect(() => assertAppliedFixtureTopology("single-link", "single", ["opp-a"], ["opp-a"])).not.toThrow();
		expect(() => assertAppliedFixtureTopology("metadata-fallback", "metadata", [], [])).not.toThrow();
		expect(() =>
			assertAppliedFixtureTopology("ambiguous", "ambiguous", ["opp-a", "opp-b"], ["opp-a", "opp-b"])
		).not.toThrow();

		expect(() => assertAppliedFixtureTopology("single-link", "single", ["opp-a"], [])).toThrow(/exactly one/);
		expect(() => assertAppliedFixtureTopology("metadata-fallback", "metadata", [], ["opp-a"])).toThrow(
			/unexpected proposal_documents/
		);
		expect(() => assertAppliedFixtureTopology("single-link", "single", ["opp-a"], ["opp-a", "opp-a"])).toThrow(
			/duplicate proposal_documents pairs/
		);
		expect(() => assertAppliedFixtureTopology("ambiguous", "ambiguous", ["opp-a", "opp-b"], ["opp-a"])).toThrow(
			/exactly two/
		);
	});
});
