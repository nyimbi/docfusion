import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const searchSearxngMock = vi.hoisted(() => vi.fn());
const createImportRecordMock = vi.hoisted(() => vi.fn());
const updateImportRecordMock = vi.hoisted(() => vi.fn());
const createOpportunityMock = vi.hoisted(() => vi.fn());
const updateOpportunityMock = vi.hoisted(() => vi.fn());
const firecrawlScrapeMock = vi.hoisted(() => vi.fn());
const selectResultsQueue = vi.hoisted(() => [] as unknown[][]);

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/services/searxng-client", () => ({
	searchSearxng: searchSearxngMock,
}));

vi.mock("@/lib/scrapers/firecrawl", () => ({
	FirecrawlClient: vi.fn(() => ({
		scrape: firecrawlScrapeMock,
	})),
}));

vi.mock("@/lib/actions/opportunities", () => ({
	createImportRecord: createImportRecordMock,
	updateImportRecord: updateImportRecordMock,
	createOpportunity: createOpportunityMock,
	updateOpportunity: updateOpportunityMock,
}));

vi.mock("@/lib/db/schema", () => ({
	opportunities: {
		id: "opportunities.id",
		fingerprint: "opportunities.fingerprint",
		source: "opportunities.source",
		sourceId: "opportunities.sourceId",
	},
	opportunityImports: {},
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((column: unknown, value: unknown) => ({ op: "eq", column, value })),
	and: vi.fn((...conditions: unknown[]) => ({ op: "and", conditions })),
}));

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn(() => {
			const result = selectResultsQueue.shift() ?? [];
			const builder = {
				from: vi.fn(() => builder),
				where: vi.fn(() => builder),
				limit: vi.fn(() => builder),
				then: vi.fn((resolve: (value: unknown[]) => void) => resolve(result)),
			};
			return builder;
		}),
	},
}));

import { discoverAndImportOpportunities } from "@/lib/actions/import-opportunities";

beforeEach(() => {
	vi.clearAllMocks();
	selectResultsQueue.length = 0;
	getCurrentUserIdMock.mockResolvedValue("user-1");
	createImportRecordMock.mockResolvedValue("import-1");
	createOpportunityMock.mockResolvedValue({ id: "opp-1" });
	updateOpportunityMock.mockResolvedValue({ id: "opp-existing" });
	firecrawlScrapeMock.mockResolvedValue({ success: false, error: "not scraped" });
});

describe("discoverAndImportOpportunities", () => {
	it("persists SearXNG opportunity results as audited opportunity imports", async () => {
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "Request for Proposals: Case management platform",
					url: "https://example.org/tenders/case-management",
					content: "RFP for implementation of a case management platform.",
					engine: "bing",
					score: 8.5,
					category: "general",
				},
				{
					title: "Annual report",
					url: "https://example.org/news/annual-report",
					content: "General organization update.",
					engine: "bing",
					score: 1,
					category: "general",
				},
			],
		});
		selectResultsQueue.push([], []);

		const result = await discoverAndImportOpportunities({
			query: "case management rfp Kenya",
			limitPerQuery: 5,
			countryRegion: "Kenya",
		});

		expect(result.importId).toBe("import-1");
		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(createImportRecordMock).toHaveBeenCalledWith("searxng-discovery", 1, {
			columnMappings: [],
			sheetName: "searxng_discovery",
			updateExisting: true,
			matchBy: "sourceId",
		});
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			assignedTo: "user-1",
			title: "Request for Proposals: Case management platform",
			countryRegion: "Kenya",
			rfpLink: "https://example.org/tenders/case-management",
			portalUrl: "https://example.org/tenders/case-management",
			source: "searxng",
			sourcePlatform: "SearXNG",
			sourceFile: "searxng:case-management-rfp-kenya",
			opportunityType: "rfp",
			decisionStatus: "pending",
			tags: ["external-discovery"],
		}));
		const createdInput = createOpportunityMock.mock.calls[0][0];
		expect(createdInput.sourceId).toMatch(/^searxng-[a-f0-9]{42}$/);
		expect(createdInput.fingerprint).toMatch(/^[a-f0-9]{64}$/);
		expect(updateImportRecordMock).toHaveBeenCalledWith("import-1", expect.objectContaining({
			importedRecords: 1,
			updatedRecords: 0,
			failedRecords: 0,
			status: "completed",
		}));
	});

	it("updates existing discovered opportunities and can enrich top results with Firecrawl", async () => {
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "Tender for digital workflow platform",
					url: "https://procurement.example.com/opportunity?id=123",
					content: "Tender notice.",
					engine: "google",
					score: 12,
					category: "general",
				},
			],
		});
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: "# Digital Workflow Tender\n\nDetailed scope for implementation.",
				metadata: {
					title: "Digital Workflow Tender",
					description: "Detailed scope for implementation.",
				},
			},
		});
		selectResultsQueue.push([{ id: "opp-existing" }]);

		const result = await discoverAndImportOpportunities({
			query: "digital workflow tender",
			scrapeTopResults: true,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 0, updated: 1, failed: 0 });
		expect(firecrawlScrapeMock).toHaveBeenCalledWith(
			"https://procurement.example.com/opportunity?id=123",
			expect.objectContaining({ formats: ["markdown"], timeout: 15000 })
		);
		expect(updateOpportunityMock).toHaveBeenCalledWith("opp-existing", expect.objectContaining({
			title: "Digital Workflow Tender",
			projectSummary: "Detailed scope for implementation.",
			source: "searxng",
			assignedTo: "user-1",
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					scrapedWithFirecrawl: true,
					query: "digital workflow tender",
				}),
			}),
		}));
		expect(createOpportunityMock).not.toHaveBeenCalled();
	});

	it("records search failures without touching opportunity rows", async () => {
		searchSearxngMock.mockRejectedValue(new Error("SearXNG unavailable"));

		const result = await discoverAndImportOpportunities({
			query: "rfp search failure",
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 0,
			updated: 0,
			skipped: 0,
			failed: 1,
		});
		expect(createImportRecordMock).toHaveBeenCalledWith("searxng-discovery", 1, expect.any(Object));
		expect(createOpportunityMock).not.toHaveBeenCalled();
		expect(updateOpportunityMock).not.toHaveBeenCalled();
		expect(updateImportRecordMock).toHaveBeenCalledWith("import-1", expect.objectContaining({
			failedRecords: 1,
			errors: [expect.objectContaining({
				status: "failed",
				error: expect.stringContaining("SearXNG unavailable"),
			})],
		}));
	});
});
