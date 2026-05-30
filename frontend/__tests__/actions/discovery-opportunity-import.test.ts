import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const getUserContextMock = vi.hoisted(() => vi.fn());
const requireUserContextMock = vi.hoisted(() => vi.fn());
const searchSearxngMock = vi.hoisted(() => vi.fn());
const createImportRecordMock = vi.hoisted(() => vi.fn());
const updateImportRecordMock = vi.hoisted(() => vi.fn());
const createOpportunityMock = vi.hoisted(() => vi.fn());
const updateOpportunityMock = vi.hoisted(() => vi.fn());
const firecrawlScrapeMock = vi.hoisted(() => vi.fn());
const downloadDocumentMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
const fetchKenyaPpipOpportunitiesMock = vi.hoisted(() => vi.fn());
const isKenyaPpipUrlMock = vi.hoisted(() => vi.fn((url: string) => url.includes("tenders.go.ke")));
const fetchUngmOpportunitiesMock = vi.hoisted(() => vi.fn());
const isUngmUrlMock = vi.hoisted(() => vi.fn((url: string) => url.includes("ungm.org")));
const getCloakBrowserEndpointMock = vi.hoisted(() => vi.fn());
const scrapeWithCloakBrowserMock = vi.hoisted(() => vi.fn());
const fetchPublicHttpUrlMock = vi.hoisted(() => vi.fn());
const selectResultsQueue = vi.hoisted(() => [] as unknown[][]);

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
	getUserContext: getUserContextMock,
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/services/searxng-client", () => ({
	getSearxngBaseUrl: () => "https://search.lindela.io",
	searchSearxng: searchSearxngMock,
}));

vi.mock("@/lib/scrapers/firecrawl", () => ({
	FirecrawlClient: vi.fn(() => ({
		scrape: firecrawlScrapeMock,
	})),
}));

vi.mock("@/lib/services/rfp-document-service", () => ({
	downloadDocument: downloadDocumentMock,
}));

vi.mock("@/lib/services/kenya-ppip-client", () => ({
	fetchKenyaPpipOpportunities: fetchKenyaPpipOpportunitiesMock,
	isKenyaPpipUrl: isKenyaPpipUrlMock,
}));

vi.mock("@/lib/services/ungm-client", () => ({
	fetchUngmOpportunities: fetchUngmOpportunitiesMock,
	isUngmUrl: isUngmUrlMock,
}));

vi.mock("@/lib/services/cloakbrowser-scraper-client", () => ({
	getCloakBrowserEndpoint: getCloakBrowserEndpointMock,
	scrapeWithCloakBrowser: scrapeWithCloakBrowserMock,
}));

vi.mock("@/lib/security/public-url", () => ({
	fetchPublicHttpUrl: fetchPublicHttpUrlMock,
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
		organizationId: "opportunities.organization_id",
		fingerprint: "opportunities.fingerprint",
		source: "opportunities.source",
		sourceId: "opportunities.sourceId",
		sourceFile: "opportunities.sourceFile",
	},
	opportunityDocuments: {
		id: "opportunityDocuments.id",
		organizationId: "opportunityDocuments.organization_id",
		opportunityId: "opportunityDocuments.opportunityId",
		sourceUrl: "opportunityDocuments.sourceUrl",
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
		insert: vi.fn(() => {
			const builder = {
				values: vi.fn(() => builder),
				returning: vi.fn(async () => [{ id: "source-doc-1" }]),
			};
			return builder;
		}),
	},
}));

import { discoverAndImportOpportunities } from "@/lib/actions/import-opportunities";
import { executeOpportunityDiscoveryImport } from "@/lib/services/opportunity-discovery-import";
import { db } from "@/lib/db";

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal("fetch", fetchMock);
	selectResultsQueue.length = 0;
	getCurrentUserIdMock.mockResolvedValue("user-1");
	getUserContextMock.mockResolvedValue({
		userId: "user-1",
		organizationId: "org-1",
		roles: [],
	});
	requireUserContextMock.mockResolvedValue({
		userId: "user-1",
		organizationId: "org-1",
		roles: [],
	});
	createImportRecordMock.mockResolvedValue("import-1");
	createOpportunityMock.mockResolvedValue({ id: "opp-1" });
	updateOpportunityMock.mockResolvedValue({ id: "opp-existing" });
	firecrawlScrapeMock.mockResolvedValue({ success: false, error: "not scraped" });
	fetchKenyaPpipOpportunitiesMock.mockResolvedValue({
		apiUrl: "https://tenders.go.ke/api/active-tenders?perpage=5&page=1",
		opportunities: [],
		total: 0,
	});
	isKenyaPpipUrlMock.mockImplementation((url: string) => url.includes("tenders.go.ke"));
	fetchUngmOpportunitiesMock.mockResolvedValue({
		searchUrl: "https://www.ungm.org/Public/Notice/Search",
		opportunities: [],
		total: 0,
	});
	isUngmUrlMock.mockImplementation((url: string) => url.includes("ungm.org"));
	getCloakBrowserEndpointMock.mockReturnValue(undefined);
	scrapeWithCloakBrowserMock.mockResolvedValue({
		success: false,
		error: "CloakBrowser endpoint is not configured",
	});
	fetchPublicHttpUrlMock.mockResolvedValue(new Response("pdf", {
		status: 200,
		headers: { "content-type": "application/pdf" },
	}));
	downloadDocumentMock.mockResolvedValue({ success: true, documentId: "source-doc-1" });
	fetchMock.mockResolvedValue({
		ok: false,
		status: 503,
		text: async () => "browser unavailable",
		json: async () => ({ success: false, error: "browser unavailable" }),
	});
});

afterEach(() => {
	vi.useRealTimers();
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
			engines: ["bing"],
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
		}, "user-1");
		expect(searchSearxngMock).toHaveBeenCalledWith("case management rfp Kenya", expect.objectContaining({
			categories: ["general"],
			engines: ["bing"],
		}));
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
		}), "user-1");
	});

	it("retries transient import-record creation failures after discovery has produced candidates", async () => {
		process.env.DISCOVERY_IMPORT_DB_RETRY_DELAY_MS = "0";
		createImportRecordMock
			.mockRejectedValueOnce(new Error("connect ECONNREFUSED 88.80.188.224:5432"))
			.mockResolvedValueOnce("import-1");
		searchSearxngMock.mockResolvedValue({
			results: [{
				title: "Request for Proposals: Records platform",
				url: "https://example.org/tenders/records-platform",
				content: "RFP for records platform implementation.",
				engine: "bing",
				score: 8.5,
				category: "general",
			}],
		});
		selectResultsQueue.push([]);

		try {
			const result = await discoverAndImportOpportunities({
				query: "records platform rfp",
				limitPerQuery: 5,
				engines: ["bing"],
			});

			expect(result.importId).toBe("import-1");
			expect(result.results).toMatchObject({
				total: 1,
				imported: 1,
				failed: 0,
			});
			expect(createImportRecordMock).toHaveBeenCalledTimes(2);
			expect(createOpportunityMock).toHaveBeenCalledTimes(1);
			expect(updateImportRecordMock).toHaveBeenCalledWith("import-1", expect.objectContaining({
				importedRecords: 1,
				status: "completed",
			}), "user-1");
		} finally {
			delete process.env.DISCOVERY_IMPORT_DB_RETRY_DELAY_MS;
		}
	});

	it("retries transient import-record completion update failures", async () => {
		process.env.DISCOVERY_IMPORT_DB_RETRY_DELAY_MS = "0";
		updateImportRecordMock
			.mockRejectedValueOnce(new Error("Connection terminated unexpectedly"))
			.mockResolvedValueOnce(undefined);
		searchSearxngMock.mockResolvedValue({
			results: [{
				title: "Request for Proposals: Case workflow platform",
				url: "https://example.org/tenders/case-workflow",
				content: "RFP for workflow platform implementation.",
				engine: "bing",
				score: 8.5,
				category: "general",
			}],
		});
		selectResultsQueue.push([]);

		try {
			const result = await discoverAndImportOpportunities({
				query: "workflow platform rfp",
				limitPerQuery: 5,
				engines: ["bing"],
			});

			expect(result.importId).toBe("import-1");
			expect(result.results).toMatchObject({
				total: 1,
				imported: 1,
				failed: 0,
			});
			expect(updateImportRecordMock).toHaveBeenCalledTimes(2);
			expect(updateImportRecordMock).toHaveBeenLastCalledWith("import-1", expect.objectContaining({
				importedRecords: 1,
				status: "completed",
			}), "user-1");
		} finally {
			delete process.env.DISCOVERY_IMPORT_DB_RETRY_DELAY_MS;
		}
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
			expect.objectContaining({ formats: ["markdown", "links"], timeout: 15000 })
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

	it("fans out configured SearXNG engines so Google and DuckDuckGo results are both imported", async () => {
		searchSearxngMock.mockImplementation(async (_query: string, options: { engines?: string[] }) => {
			const engine = options.engines?.[0] ?? "searxng";
			return {
				results: [
					{
						title: `${engine} Request for Proposals: Grants platform`,
						url: `https://${engine}.example.org/tenders/grants-platform`,
						content: "RFP for a grants platform with a submission deadline.",
						engine,
						score: 10,
						category: "general",
					},
				],
			};
		});
		selectResultsQueue.push([], []);

		const result = await discoverAndImportOpportunities({
			query: "grants platform RFP",
			engines: ["google", "duckduckgo"],
			limitPerQuery: 5,
		});

		expect(result.results).toMatchObject({ total: 2, imported: 2, failed: 0 });
		expect(searchSearxngMock).toHaveBeenCalledTimes(2);
		expect(searchSearxngMock).toHaveBeenNthCalledWith(1, "grants platform RFP", expect.objectContaining({
			engines: ["google"],
		}));
		expect(searchSearxngMock).toHaveBeenNthCalledWith(2, "grants platform RFP", expect.objectContaining({
			engines: ["duckduckgo"],
		}));
		expect(createOpportunityMock).toHaveBeenCalledTimes(2);
		expect(createOpportunityMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
			title: "google Request for Proposals: Grants platform",
			portalUrl: "https://google.example.org/tenders/grants-platform",
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					resultEngine: "google",
				}),
			}),
		}));
		expect(createOpportunityMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
			title: "duckduckgo Request for Proposals: Grants platform",
			portalUrl: "https://duckduckgo.example.org/tenders/grants-platform",
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					resultEngine: "duckduckgo",
				}),
			}),
		}));
	});

	it("runs SearXNG engine fanout concurrently for broad RFP collection throughput", async () => {
		const startedEngines: string[] = [];
		let resolveGoogle: ((value: unknown) => void) | undefined;
		searchSearxngMock.mockImplementation((_query: string, options: { engines?: string[] }) => {
			const engine = options.engines?.[0] ?? "searxng";
			startedEngines.push(engine);
			const response = {
				results: [
					{
						title: `${engine} Request for Proposals: Data exchange`,
						url: `https://${engine}.example.org/tenders/data-exchange`,
						content: "RFP for data exchange implementation with a submission deadline.",
						engine,
						score: 10,
						category: "general",
					},
				],
			};
			if (engine === "google") {
				return new Promise((resolve) => {
					resolveGoogle = () => resolve(response);
				});
			}
			return Promise.resolve(response);
		});
		selectResultsQueue.push([], []);

		const discovery = discoverAndImportOpportunities({
			query: "data exchange RFP",
			engines: ["google", "duckduckgo"],
			limitPerQuery: 5,
		});
		await new Promise((resolve) => setImmediate(resolve));

		expect(startedEngines).toEqual(["google", "duckduckgo"]);
		expect(createOpportunityMock).not.toHaveBeenCalled();

		resolveGoogle?.(undefined);
		const result = await discovery;

		expect(result.results).toMatchObject({ total: 2, imported: 2, failed: 0 });
		expect(createOpportunityMock).toHaveBeenCalledTimes(2);
	});

	it("extracts likely RFP document links from scraped portal pages", async () => {
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "Records platform tender notice",
					url: "https://procurement.example.com/tenders/records-platform",
					content: "Tender notice with document downloads.",
					engine: "google",
					score: 11,
					category: "general",
				},
			],
		});
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: [
					"# Records Platform Tender",
					"[Annual report](/docs/annual-report.pdf)",
					"[Download RFP document](/documents/records-platform-rfp.pdf?token=abc#section)",
				].join("\n\n"),
				metadata: {
					title: "Records Platform Tender",
					description: "Implementation scope and document download links.",
				},
			},
		});
		selectResultsQueue.push([], [], []);

		const result = await discoverAndImportOpportunities({
			query: "records platform tender",
			scrapeTopResults: true,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(1);
		expect(result.sourceDocumentsExisting).toBe(0);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			portalUrl: "https://procurement.example.com/tenders/records-platform",
			rfpLink: "https://procurement.example.com/tenders/records-platform",
			documentUrl: "https://procurement.example.com/documents/records-platform-rfp.pdf?token=abc",
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					documentUrl: "https://procurement.example.com/documents/records-platform-rfp.pdf?token=abc",
				}),
			}),
		}));
		expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({
			id: "opportunityDocuments.id",
		}));
		const insertBuilder = vi.mocked(db.insert).mock.results[0].value as {
			values: ReturnType<typeof vi.fn>;
		};
		expect(insertBuilder.values).toHaveBeenCalledWith(expect.objectContaining({
			opportunityId: "opp-1",
			documentName: "records-platform-rfp.pdf",
			documentType: "rfp",
			sourceUrl: "https://procurement.example.com/documents/records-platform-rfp.pdf?token=abc",
			status: "discovered",
			isSelected: true,
		}));
	});

	it("skips archive mirror source document links from search result pages", async () => {
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "Water platform request for proposal",
					url: "https://buyer.example/tenders/water-platform",
					content: "Request for proposal with submission deadline.",
					engine: "bing",
					score: 11,
					category: "general",
				},
			],
		});
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: [
					"# Water platform request for proposal",
					"[https://archive.org/download/RL32229-crs/RL32229.pdf](https://archive.org/download/RL32229-crs/RL32229.pdf)",
				].join("\n\n"),
				metadata: {
					title: "Water platform request for proposal",
					description: "Current procurement notice.",
				},
			},
		});
		selectResultsQueue.push([], [], []);

		const result = await discoverAndImportOpportunities({
			query: "archive procurement rfp",
			scrapeTopResults: true,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(0);
		expect(db.insert).not.toHaveBeenCalledWith(expect.objectContaining({
			id: "opportunityDocuments.id",
		}));
	});

	it("rejects archive and wiki search hits before scraping", async () => {
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "Archive-hosted procurement document",
					url: "https://commons.wikimedia.org/wiki/File:RL32229_(IA_RL32229-crs).pdf",
					content: "Request for proposal document mirrored from archive.org.",
					engine: "bing",
					score: 11,
					category: "general",
				},
			],
		});

		const result = await discoverAndImportOpportunities({
			query: "archive procurement rfp",
			scrapeTopResults: true,
		});

		expect(result.results).toMatchObject({ total: 0, imported: 0, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(0);
		expect(firecrawlScrapeMock).not.toHaveBeenCalled();
		expect(result.warnings).toEqual(expect.arrayContaining([
			expect.objectContaining({ type: "search_no_candidates" }),
		]));
	});

	it("rejects dictionary and translation search hits before scraping", async () => {
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "REQUEST Definition & Meaning",
					url: "https://www.merriam-webster.com/dictionary/request",
					content: "Definitions and examples for request. Query matched request for proposals.",
					engine: "bing",
					score: 11,
					category: "general",
				},
				{
					title: "request - English-Spanish Dictionary",
					url: "https://www.wordreference.com/es/translation.asp?tranword=request",
					content: "Translation for request, proposal, and deadline.",
					engine: "bing",
					score: 10,
					category: "general",
				},
			],
		});

		const result = await discoverAndImportOpportunities({
			query: "\"request for proposals\" \"submission deadline\"",
			scrapeTopResults: true,
		});

		expect(result.results).toMatchObject({ total: 0, imported: 0, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(0);
		expect(firecrawlScrapeMock).not.toHaveBeenCalled();
		expect(createOpportunityMock).not.toHaveBeenCalled();
		expect(result.warnings).toEqual(expect.arrayContaining([
			expect.objectContaining({ type: "search_no_candidates" }),
		]));
	});

	it("accepts high-intent known procurement notice pages without snippet keywords", async () => {
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "Notice 265488",
					url: "https://www.ungm.org/Public/Notice/265488",
					content: "UNDP-IND/INDIA process details and buyer contact.",
					engine: "google",
					score: 10,
					category: "general",
				},
			],
		});
		selectResultsQueue.push([], []);

		const result = await discoverAndImportOpportunities({
			query: "site:ungm.org \"Request for Proposal\"",
			scrapeTopResults: false,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Notice 265488",
			rfpLink: "https://www.ungm.org/Public/Notice/265488",
			portalUrl: "https://www.ungm.org/Public/Notice/265488",
		}));
		expect(result.warnings).not.toEqual(expect.arrayContaining([
			expect.objectContaining({ type: "search_no_candidates" }),
		]));
	});

	it("accepts RFQ and request-for-bids language as opportunity signals", async () => {
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "RFQ 2026-18 supplier onboarding",
					url: "https://buyer.example.org/notices/2026-18",
					content: "Submission deadline and buyer instructions.",
					engine: "duckduckgo",
					score: 9,
					category: "general",
				},
				{
					title: "Buyer archive",
					url: "https://buyer.example.org/archive",
					content: "Historical updates.",
					engine: "duckduckgo",
					score: 1,
					category: "general",
				},
			],
		});
		selectResultsQueue.push([], []);

		const result = await discoverAndImportOpportunities({
			query: "supplier onboarding",
			scrapeTopResults: false,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "RFQ 2026-18 supplier onboarding",
			opportunityType: "tender",
		}));
	});

	it("preserves and seeds multiple high-signal Firecrawl document links", async () => {
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "Bid for grants management system",
					url: "https://procurement.example.com/tenders/grants-management",
					content: "Bid notice with tender attachments.",
					engine: "brave",
					score: 12,
					category: "general",
				},
			],
		});
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: [
					"# Grants Management Bid",
					"[Annual report](/docs/annual-report.pdf)",
					"[Terms of reference](/docs/grants-management-tor.pdf)",
				].join("\n\n"),
				links: [
					"/docs/grants-management-bid-form.docx",
					"/docs/vendor-profile.xlsx",
				],
				metadata: {
					title: "Grants Management Bid",
					description: "Tender attachments for a grants management platform.",
				},
			},
		});
		selectResultsQueue.push([], [], [], []);

		const result = await discoverAndImportOpportunities({
			query: "grants management bid",
			scrapeTopResults: true,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(2);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			documentUrl: "https://procurement.example.com/docs/grants-management-tor.pdf",
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					documentLinks: expect.arrayContaining([
						expect.objectContaining({
							url: "https://procurement.example.com/docs/grants-management-tor.pdf",
							label: "Terms of reference",
							source: "scraped_markdown",
						}),
						expect.objectContaining({
							url: "https://procurement.example.com/docs/grants-management-bid-form.docx",
							source: "scraped_link",
						}),
					]),
				}),
			}),
		}));
		const insertedSourceUrls = vi.mocked(db.insert).mock.results.map((result) => {
			const insertBuilder = result.value as { values: ReturnType<typeof vi.fn> };
			return insertBuilder.values.mock.calls[0][0].sourceUrl;
		});
		expect(insertedSourceUrls).toEqual([
			"https://procurement.example.com/docs/grants-management-tor.pdf",
			"https://procurement.example.com/docs/grants-management-bid-form.docx",
		]);
		expect(insertedSourceUrls).not.toContain("https://procurement.example.com/docs/annual-report.pdf");
	});

	it("drops award and report PDFs before choosing source documents", async () => {
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "Data platform request for proposals",
					url: "https://procurement.example.com/tenders/data-platform",
					content: "Request for proposal with submission deadline.",
					engine: "google",
					score: 12,
					category: "general",
				},
			],
		});
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: [
					"# Data Platform RFP",
					"[Contract awards above USD100K 2025](/docs/UNwomen-ContractAwardsAboveUSD100K-2025.pdf)",
					"[Notice of Award RFP23-6059 - Preferred Supplier for Graphic Designers and Illustrators](/docs/Notice%20of%20Award%20RFP23-6059.pdf)",
					"[Annual report](/docs/annual-report.pdf)",
					"[Request for proposal](/docs/data-platform-rfp.pdf)",
				].join("\n\n"),
				links: [
					"/docs/vendor-profile.xlsx",
					"/docs/procurement-plan-2026.pdf",
				],
				metadata: {
					title: "Data Platform RFP",
					description: "Active data platform procurement notice.",
				},
			},
		});
		selectResultsQueue.push([], [], []);

		const result = await discoverAndImportOpportunities({
			query: "data platform request for proposals",
			scrapeTopResults: true,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(1);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			documentUrl: "https://procurement.example.com/docs/data-platform-rfp.pdf",
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					documentLinks: [
						expect.objectContaining({
							url: "https://procurement.example.com/docs/data-platform-rfp.pdf",
						}),
					],
				}),
			}),
		}));
		const insertedSourceUrls = vi.mocked(db.insert).mock.results.map((result) => {
			const insertBuilder = result.value as { values: ReturnType<typeof vi.fn> };
			return insertBuilder.values.mock.calls[0][0].sourceUrl;
		});
		expect(insertedSourceUrls).toEqual(["https://procurement.example.com/docs/data-platform-rfp.pdf"]);
	});

	it("imports multiple GIZ country tenders that share a portal page", async () => {
		searchSearxngMock.mockResolvedValue({ results: [] });
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: [
					"Ghana",
					"=====",
					"Deadline: 11.06.2026",
					"Procurement Of Service: Consultancy for The Design and Implementation of a Business Development Program for Creators",
					"[](https://www.giz.de/sites/default/files/media/els-document/2026-05/7000010646-contract-documents-bus-dev-4-content-creators.zip \"dd_media.zip.download\")",
					"Deadline: 08.06.2026",
					"Procurement of Goods: Printing of Study in Europe Desk Information Materials",
					"[](https://www.giz.de/sites/default/files/media/els-document/2026-05/giz-reoi-printing-study-europe-desk-information-materials-15-05-2026.pdf \"Download PDF\")",
				].join("\n\n"),
				links: [
					"https://www.giz.de/sites/default/files/media/els-document/2026-05/7000010646-contract-documents-bus-dev-4-content-creators.zip",
					"https://www.giz.de/sites/default/files/media/els-document/2026-05/giz-reoi-printing-study-europe-desk-information-materials-15-05-2026.pdf",
				],
				metadata: {
					title: "Ghana Tenders | GIZ",
				},
			},
		});
		selectResultsQueue.push([], [], [], []);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.giz.de/en/regions/africa/ghana/tenders"],
			sourceScrapeLimit: 10,
		});

		expect(result.results).toMatchObject({ total: 2, imported: 2, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(2);
		expect(createOpportunityMock).toHaveBeenCalledTimes(2);
		expect(createOpportunityMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
			title: "Procurement Of Service: Consultancy for The Design and Implementation of a Business Development Program for Creators",
			source: "giz",
			sourceId: "giz-7000010646",
			sourcePlatform: "GIZ",
			portalUrl: "https://www.giz.de/en/regions/africa/ghana/tenders",
			documentUrl: "https://www.giz.de/sites/default/files/media/els-document/2026-05/7000010646-contract-documents-bus-dev-4-content-creators.zip",
		}));
		expect(createOpportunityMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
			title: "Procurement of Goods: Printing of Study in Europe Desk Information Materials",
			source: "giz",
			sourcePlatform: "GIZ",
			documentUrl: "https://www.giz.de/sites/default/files/media/els-document/2026-05/giz-reoi-printing-study-europe-desk-information-materials-15-05-2026.pdf",
		}));
	});

	it("imports ADB institutional procurement notices from the accessible source page", async () => {
		searchSearxngMock.mockResolvedValue({ results: [] });
		fetchMock.mockResolvedValue({
			ok: true,
			text: async () => [
				"<h2>Request for Proposal</h2>",
				"<table><tbody>",
				"<tr>",
				"<td data-th=\"Title\"><a href=\"/sites/default/files/page/559266/rfp-broad-commodities-precious-metals-20260527.pdf\">Request for Proposal: Investment Manager Selection for Broad Commodities and Precious Metals Portfolio</a></td>",
				"<td data-th=\"Start date\">27 May 2026</td>",
				"<td data-th=\"End date\">3 July 2026, 5:00 p.m. (Manila time)</td>",
				"</tr>",
				"</tbody></table>",
				"<h2>Invitation to Bid</h2>",
				"<table><tbody>",
				"<tr>",
				"<td data-th=\"Title\"><a href=\"/sites/default/files/page/559266/itb-adb-unified-ai-big-data.zip\">Invitation to Bid: ADB Unified AI &amp; Big Data</a></td>",
				"<td data-th=\"Start date\">18 May 2026</td>",
				"<td data-th=\"End date\">5 June 2026, 11:30 p.m. (Manila time)</td>",
				"</tr>",
				"</tbody></table>",
			].join("\n"),
		});
		selectResultsQueue.push([], [], [], []);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.adb.org/business/institutional-procurement/notices"],
			sourceScrapeLimit: 10,
		});

		expect(result.results).toMatchObject({ total: 2, imported: 2, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(2);
		expect(firecrawlScrapeMock).not.toHaveBeenCalled();
		expect(fetchMock).toHaveBeenCalledWith(
			"https://www.adb.org/business/institutional-procurement/notices",
			expect.objectContaining({ headers: expect.any(Object) })
		);
		expect(createOpportunityMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
			title: "Request for Proposal: Investment Manager Selection for Broad Commodities and Precious Metals Portfolio",
			source: "adb",
			sourceId: "adb-rfp-broad-commodities-precious-metals-20260527",
			sourcePlatform: "Asian Development Bank",
			opportunityType: "rfp",
			documentUrl: "https://www.adb.org/sites/default/files/page/559266/rfp-broad-commodities-precious-metals-20260527.pdf",
		}));
		expect(createOpportunityMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
			title: "Invitation to Bid: ADB Unified AI & Big Data",
			source: "adb",
			sourcePlatform: "Asian Development Bank",
			opportunityType: "tender",
			documentUrl: "https://www.adb.org/sites/default/files/page/559266/itb-adb-unified-ai-big-data.zip",
		}));
	});

	it("does not misroute IDB procurement pages through the ADB source parser", async () => {
		searchSearxngMock.mockResolvedValue({ results: [] });
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: [
					"[Request for Proposals: Digital Citizen Services](https://www.iadb.org/en/procurement/digital-citizen-services-rfp)",
					"",
					"Submission deadline: 15 June 2026",
				].join("\n"),
				links: ["https://www.iadb.org/en/procurement/digital-citizen-services-rfp"],
				metadata: { title: "IDB Procurement Notices" },
			},
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.iadb.org/en/how-we-can-work-together/procurement/procurement-projects/procurement-notices"],
			sourceScrapeLimit: 5,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(fetchMock).not.toHaveBeenCalled();
		expect(firecrawlScrapeMock).toHaveBeenCalledWith(
			"https://www.iadb.org/en/how-we-can-work-together/procurement/procurement-projects/procurement-notices",
			expect.any(Object)
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Request for Proposals: Digital Citizen Services",
			source: "source-scrape",
			sourcePlatform: "Configured Source Scrape",
			portalUrl: "https://www.iadb.org/en/procurement/digital-citizen-services-rfp",
			sourceFile: "source:https://www.iadb.org/en/how-we-can-work-together/procurement/procurement-projects/procurement-notices",
			opportunityType: "rfp",
		}));
	});

	it("imports AIIB project procurement opportunities from the official data script", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 4, 28));
		searchSearxngMock.mockResolvedValue({ results: [] });
		fetchMock.mockResolvedValueOnce({
			ok: true,
			text: async () => [
				"var ppoData = [",
				"{id:\"May 27, 2026\",cd:\"\",mb:\"Azerbaijan\",pj:\"Baku Metro Expansion Project - Phase II (Green Line)\",ds:\"\",cr:\"\",sd:\"\",pc:\"\",st:\"Transport\",ct:\"Notices\",tp:\"General Procurement Notice\",dc:\"/en/projects/details/2026/_download/Azerbaijan/BMEP_P2-General-Procurement-Notice-GPN-rev01-EN-1.pdf\"},",
				"{id:\"May 12, 2026\",cd:\"June 10,2026\",mb:\"Pakistan\",pj:\"Reconstruction of National Highway N-5 under Pakistan&#8217;s Resilient Recovery, Rehabilitation and Reconstruction Framework Project\",ds:\"\",cr:\"\",sd:\"\",pc:\"\",st:\"Transport\",ct:\"Notices\",tp:\"Extension of Tender Submission\",dc:\"/en/projects/details/2026/_download/Pakistan/Corrigendum-No-01-1.pdf\"},",
				"{id:\"April 21, 2026\",cd:\"April 30, 2026\",mb:\"Tajikistan\",pj:\"Rogun Hydropower Development Project - Phase 1\",ds:\"\",cr:\"\",sd:\"\",pc:\"\",st:\"Energy\",ct:\"Notices\",tp:\"Specific Procurement Notice\",dc:\"/en/projects/details/2026/_download/Tajikistan/SPN_final.pdf\"}",
				"];",
			].join("\n"),
		});
		selectResultsQueue.push([], [], [], []);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.aiib.org/en/opportunities/business/project-procurement/list.html"],
			sourceScrapeLimit: 10,
		});

		expect(result.results).toMatchObject({ total: 2, imported: 2, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(2);
		expect(firecrawlScrapeMock).not.toHaveBeenCalled();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://www.aiib.org/en/opportunities/business/project-procurement/_common/ppo-data-all.js",
			expect.objectContaining({ headers: expect.any(Object) })
		);
		expect(createOpportunityMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
			title: "Baku Metro Expansion Project - Phase II (Green Line)",
			source: "aiib",
			sourceId: "aiib-bmep-p2-general-procurement-notice-gpn-rev01",
			sourcePlatform: "Asian Infrastructure Investment Bank",
			opportunityType: "tender",
			documentUrl: "https://www.aiib.org/en/projects/details/2026/_download/Azerbaijan/BMEP_P2-General-Procurement-Notice-GPN-rev01-EN-1.pdf",
			tags: expect.arrayContaining(["aiib", "development-bank", "project-procurement"]),
		}));
		expect(createOpportunityMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
			countryRegion: "Pakistan",
			source: "aiib",
			sourcePlatform: "Asian Infrastructure Investment Bank",
			deadline: new Date(2026, 5, 10),
			documentUrl: "https://www.aiib.org/en/projects/details/2026/_download/Pakistan/Corrigendum-No-01-1.pdf",
		}));
	});

	it("updates legacy configured-source rows when source identity becomes more specific", async () => {
		searchSearxngMock.mockResolvedValue({ results: [] });
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: [
					"Ghana",
					"=====",
					"Deadline: 11.06.2026",
					"Procurement Of Service: Consultancy for The Design and Implementation of a Business Development Program for Creators",
					"[](https://www.giz.de/sites/default/files/media/els-document/2026-05/7000010646-contract-documents-bus-dev-4-content-creators.zip \"dd_media.zip.download\")",
				].join("\n\n"),
				metadata: {
					title: "Ghana Tenders | GIZ",
				},
			},
		});
		selectResultsQueue.push([], [{ id: "legacy-source-scrape-opp" }], []);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.giz.de/en/regions/africa/ghana/tenders"],
			sourceScrapeLimit: 10,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 0, updated: 1, failed: 0 });
		expect(createOpportunityMock).not.toHaveBeenCalled();
		expect(updateOpportunityMock).toHaveBeenCalledWith("legacy-source-scrape-opp", expect.objectContaining({
			source: "giz",
			sourceId: "giz-7000010646",
			sourceFile: "source:https://www.giz.de/en/regions/africa/ghana/tenders",
		}));
	});

	it("keeps opportunity imports successful when source document row seeding fails", async () => {
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "Records platform tender notice",
					url: "https://procurement.example.com/tenders/records-platform",
					content: "Tender notice with document downloads.",
					engine: "google",
					score: 11,
					category: "general",
				},
			],
		});
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: "[Download RFP document](/documents/records-platform-rfp.pdf)",
				metadata: {
					title: "Records Platform Tender",
					description: "Implementation scope and document download links.",
				},
			},
		});
		selectResultsQueue.push([], [], []);
		const returning = vi.fn(async () => {
			throw new Error("source document insert failed");
		});
		vi.mocked(db.insert).mockReturnValueOnce({
			values: vi.fn(() => ({ returning })),
		} as unknown as ReturnType<typeof db.insert>);

		const result = await discoverAndImportOpportunities({
			query: "records platform tender",
			scrapeTopResults: true,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(0);
		expect(result.warnings).toEqual([
			expect.objectContaining({
				type: "source_document_seed_failed",
				title: "Records platform tender notice",
				url: "https://procurement.example.com/documents/records-platform-rfp.pdf",
				message: "source document insert failed",
			}),
		]);
		expect(updateImportRecordMock).toHaveBeenCalledWith("import-1", expect.objectContaining({
			config: expect.objectContaining({
				audit: {
					warnings: [
						expect.objectContaining({
							type: "source_document_seed_failed",
							message: "source document insert failed",
						}),
					],
				},
			}),
		}), "user-1");
	});

	it("downloads newly seeded source documents when bounded discovery intake is enabled", async () => {
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "Records platform tender notice",
					url: "https://procurement.example.com/tenders/records-platform",
					content: "Tender notice with document downloads.",
					engine: "google",
					score: 11,
					category: "general",
				},
			],
		});
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: "[Download RFP document](/documents/records-platform-rfp.pdf)",
				metadata: {
					title: "Records Platform Tender",
					description: "Implementation scope and document download links.",
				},
			},
		});
		selectResultsQueue.push([], [], []);

		const result = await discoverAndImportOpportunities({
			query: "records platform tender",
			scrapeTopResults: true,
			downloadDiscoveredDocuments: true,
			downloadLimit: 1,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(1);
		expect(result.sourceDocumentsDownloadAttempted).toBe(1);
		expect(result.sourceDocumentsDownloaded).toBe(1);
		expect(result.sourceDocumentsDownloadFailed).toBe(0);
		expect(downloadDocumentMock).toHaveBeenCalledWith("source-doc-1", "user-1", "opp-1");
	});

	it("tracks inline source-document parse completion for proof imports", async () => {
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "Procurement notice for records response platform",
					url: "https://procurement.example.com/tenders/records-response-platform",
					content: "Tender notice with document downloads.",
					engine: "google",
					score: 11,
					category: "general",
				},
			],
		});
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: "[Download RFP document](/documents/records-response-platform-rfp.pdf)",
				metadata: {
					title: "Records Response Platform Tender",
					description: "Implementation scope and document download links.",
				},
			},
		});
		downloadDocumentMock.mockResolvedValueOnce({
			success: true,
			documentId: "source-doc-1",
			parsingStatus: "completed",
		});
		selectResultsQueue.push([], [], []);

		const result = await discoverAndImportOpportunities({
			query: "records response platform tender",
			scrapeTopResults: true,
			downloadDiscoveredDocuments: true,
			downloadLimit: 1,
			downloadParseMode: "inline",
		});

		expect(result.sourceDocumentsDownloadAttempted).toBe(1);
		expect(result.sourceDocumentsDownloaded).toBe(1);
		expect(result.sourceDocumentsParseAttempted).toBe(1);
		expect(result.sourceDocumentsParsed).toBe(1);
		expect(result.sourceDocumentsParseFailed).toBe(0);
		expect(downloadDocumentMock).toHaveBeenCalledWith(
			"source-doc-1",
			"user-1",
			"opp-1",
			{ parseMode: "inline" }
		);
	});

	it("falls back to the browser service when Firecrawl cannot scrape a top result cleanly", async () => {
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "Procurement notice for records platform",
					url: "https://blocked.example.com/tender/records-platform",
					content: "Tender notice behind bot protection.",
					engine: "brave",
					score: 10,
					category: "general",
				},
			],
		});
		firecrawlScrapeMock.mockResolvedValue({
			success: false,
			error: "SCRAPE_ALL_ENGINES_FAILED",
		});
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				success: true,
				data: {
					markdown: "# Records Platform Tender\n\nImplementation scope and submission details.",
					metadata: {
						title: "Records Platform Tender",
						description: "Implementation scope and submission details.",
					},
				},
			}),
		});
		selectResultsQueue.push([], []);

		const result = await discoverAndImportOpportunities({
			query: "records platform tender",
			scrapeTopResults: true,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(fetchMock).toHaveBeenCalledWith(
			"http://84.247.181.100:3003/v1/scrape",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					url: "https://blocked.example.com/tender/records-platform",
					options: {
						timeout: 15000,
						humanScroll: true,
						blockMedia: true,
						formats: ["markdown", "html", "links"],
					},
				}),
			})
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Records Platform Tender",
			projectSummary: "Implementation scope and submission details.",
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					scrapedWithFirecrawl: false,
					scrapedWithBrowserFallback: true,
					scrapeMethod: "browser_fallback",
					browserFallbackReason: "SCRAPE_ALL_ENGINES_FAILED",
				}),
			}),
		}));
		expect(result.warnings).toEqual([
			expect.objectContaining({
				type: "browser_fallback_used",
				title: "Procurement notice for records platform",
				url: "https://blocked.example.com/tender/records-platform",
				message: "SCRAPE_ALL_ENGINES_FAILED",
			}),
		]);
		expect(updateImportRecordMock).toHaveBeenCalledWith("import-1", expect.objectContaining({
			config: expect.objectContaining({
				audit: {
					warnings: [
						expect.objectContaining({
							type: "browser_fallback_used",
							message: "SCRAPE_ALL_ENGINES_FAILED",
						}),
					],
				},
			}),
		}), "user-1");
	});

	it("surfaces enrichment warnings when Firecrawl and browser fallback fail but the opportunity is still imported", async () => {
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "Tender for records management system",
					url: "https://blocked.example.com/tender/records-management",
					content: "Tender notice with enough search metadata to import.",
					engine: "brave",
					score: 9,
					category: "general",
				},
			],
		});
		firecrawlScrapeMock.mockResolvedValue({
			success: false,
			error: "SCRAPE_ALL_ENGINES_FAILED",
		});
		fetchMock.mockResolvedValue({
			ok: false,
			status: 503,
			text: async () => "browser unavailable",
			json: async () => ({ success: false, error: "browser unavailable" }),
		});
		selectResultsQueue.push([], []);

		const result = await discoverAndImportOpportunities({
			query: "records management tender",
			scrapeTopResults: true,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Tender for records management system",
			projectSummary: "Tender notice with enough search metadata to import.",
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					scrapedWithFirecrawl: false,
					scrapedWithBrowserFallback: false,
					scrapeMethod: "firecrawl",
					scrapeError: expect.stringContaining("browser fallback"),
				}),
			}),
		}));
		expect(result.warnings).toEqual([
			expect.objectContaining({
				type: "firecrawl_failed",
				title: "Tender for records management system",
				url: "https://blocked.example.com/tender/records-management",
				message: expect.stringContaining("SCRAPE_ALL_ENGINES_FAILED"),
			}),
		]);
		expect(updateImportRecordMock).toHaveBeenCalledWith("import-1", expect.objectContaining({
			config: expect.objectContaining({
				audit: {
					warnings: [
						expect.objectContaining({
							type: "firecrawl_failed",
							message: expect.stringContaining("SCRAPE_ALL_ENGINES_FAILED"),
						}),
					],
				},
			}),
		}), "user-1");
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
		expect(createImportRecordMock).toHaveBeenCalledWith("searxng-discovery", 1, expect.any(Object), "user-1");
		expect(createOpportunityMock).not.toHaveBeenCalled();
		expect(updateOpportunityMock).not.toHaveBeenCalled();
		expect(updateImportRecordMock).toHaveBeenCalledWith("import-1", expect.objectContaining({
			failedRecords: 1,
			errors: [expect.objectContaining({
				status: "failed",
				error: expect.stringContaining("SearXNG unavailable"),
			})],
		}), "user-1");
	});

	it("surfaces SearXNG engine degradation warnings even when no results are returned", async () => {
		searchSearxngMock.mockResolvedValue({
			results: [],
			unresponsive_engines: [
				["google", "access denied"],
				["duckduckgo", "CAPTCHA"],
				"brave: too many requests",
			],
		});

		const result = await discoverAndImportOpportunities({
			query: "Kenya ICT tender RFP",
		});

		expect(result.results).toEqual({
			total: 0,
			imported: 0,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(result.warnings).toEqual([
			expect.objectContaining({
				type: "searxng_engine_degraded",
				query: "Kenya ICT tender RFP",
				message: "google: access denied; duckduckgo: CAPTCHA; brave: too many requests",
			}),
			expect.objectContaining({
				type: "search_no_candidates",
				query: "Kenya ICT tender RFP",
				message: expect.stringContaining("No opportunity-like search results were accepted"),
			}),
		]);
		expect(createOpportunityMock).not.toHaveBeenCalled();
		expect(updateImportRecordMock).toHaveBeenCalledWith("import-1", expect.objectContaining({
			config: expect.objectContaining({
				audit: {
					warnings: [
						expect.objectContaining({
							type: "searxng_engine_degraded",
							message: expect.stringContaining("duckduckgo: CAPTCHA"),
						}),
						expect.objectContaining({
							type: "search_no_candidates",
							message: expect.stringContaining("query refinement"),
						}),
					],
				},
			}),
		}), "user-1");
	});

	it("imports tender-like records from configured source URLs without requiring SearXNG results", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: "[Tender for Digital Records Platform](https://buyer.example/tenders/records)\n\nDeadline: 31 December 2026",
				links: ["https://buyer.example/tenders/records"],
				metadata: { title: "Buyer Tenders" },
			},
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: [" https://buyer.example/tenders "],
			sourceScrapeLimit: 5,
		});

		expect(searchSearxngMock).not.toHaveBeenCalled();
		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(result.sourceHealth).toEqual([
			{
				sourceUrl: "https://buyer.example/tenders",
				status: "healthy",
				candidates: 1,
				imported: 1,
				updated: 0,
				skipped: 0,
				failed: 0,
				warnings: 0,
				warningTypes: {},
			},
		]);
		expect(createImportRecordMock).toHaveBeenCalledWith("searxng-discovery", 1, expect.any(Object), "user-1");
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Tender for Digital Records Platform",
			rfpLink: "https://buyer.example/tenders/records",
			portalUrl: "https://buyer.example/tenders/records",
			source: "source-scrape",
			sourcePlatform: "Configured Source Scrape",
			sourceFile: "source:https://buyer.example/tenders",
			tags: ["external-discovery", "source-scrape"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					engine: "source_scrape",
					sourceUrl: "https://buyer.example/tenders",
					resultEngine: "firecrawl-source",
				}),
			}),
		}));
	});

	it("does not attach unrelated page-wide documents to generic configured-source candidates", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: [
					"[Tender for Digital Records Platform](https://buyer.example/tenders/records)",
					"",
					"Deadline: 31 December 2026",
				].join("\n"),
				links: ["/docs/other-procurement-rfp.pdf"],
				metadata: { title: "Buyer Tenders" },
			},
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://buyer.example/tenders"],
			sourceScrapeLimit: 5,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(0);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Tender for Digital Records Platform",
			documentUrl: undefined,
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					documentLinks: [],
				}),
			}),
		}));
		expect(db.insert).not.toHaveBeenCalled();
	});

	it("imports Save the Children source cards with detail pages as source documents", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				html: `
					<div class="views-row">
						<div class="three_col-listing-card">
							<h3 class="three_col-listing-card__h3">Lebanon Country Office - Tender for Drinking Water Treatment Station</h3>
							<div class="three_col-listing-card__description"><p>Inviting submissions of tenders for water treatment station services.</p></div>
							<div class="three_col-listing-card__table">
								<div class="three_col-listing-card__end-date table-item">15 Jun 2026 - 16:00 UTC</div>
								<div class="three_col-listing-card__country table-item">Lebanon</div>
								<div class="three_col-listing-card__type table-item">Open Tender - Consultancy to Develop a Climate-Informed Procurement and Supply Planning Methodology for Essential Health Commodities</div>
							</div>
							<div class="three_col-listing-card__link">
								<a href="/tenders/lebanon-country-office-tender-drinking-water-treatment-station">Read More</a>
							</div>
						</div>
					</div>
				`,
				markdown: "",
				links: ["/docs/unrelated-page-wide-rfp.pdf"],
				metadata: { title: "Save the Children Tenders" },
			},
		});
		selectResultsQueue.push([], []);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.savethechildren.net/tenders"],
			sourceScrapeLimit: 5,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(1);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Lebanon Country Office - Tender for Drinking Water Treatment Station",
			source: "save_children",
			sourcePlatform: "Save the Children International",
			noticeId: undefined,
			portalUrl: "https://www.savethechildren.net/tenders/lebanon-country-office-tender-drinking-water-treatment-station",
			documentUrl: "https://www.savethechildren.net/tenders/lebanon-country-office-tender-drinking-water-treatment-station",
			tags: expect.arrayContaining(["save-the-children", "ngo", "source-documents"]),
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					documentLinks: [
						expect.objectContaining({
							url: "https://www.savethechildren.net/tenders/lebanon-country-office-tender-drinking-water-treatment-station",
							source: "opportunity_document_url",
						}),
					],
				}),
			}),
		}));
		const insertedSourceUrl = (vi.mocked(db.insert).mock.results[0].value as { values: ReturnType<typeof vi.fn> })
			.values.mock.calls[0][0].sourceUrl;
		expect(insertedSourceUrl).toBe("https://www.savethechildren.net/tenders/lebanon-country-office-tender-drinking-water-treatment-station");
	});

	it("imports Plan International tender sections with ZIP packages as source documents", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				html: `
					<h2 class="wp-block-heading">Calls for tender</h2>
					<h3 class="wp-block-heading">RFQ FY26-214 Child Protection and Humanitarian Diplomacy </h3>
					<p>Plan International Global Hub invites proposals for child protection and humanitarian diplomacy.</p>
					<p>Responses should be submitted no later than 23:59 (GMT) on 27th April 2026.</p>
					<div class="wp-block-qala-blocks-download-block">
						<p class="wp-block-qala-blocks-download-block__title">RFQ FY26-214</p>
						<a href="/uploads/2026/04/RFQ-FY26-214-1.zip" class="wp-block-button__link">Download</a>
					</div>
				`,
				markdown: "",
				links: ["https://plan-international.org/uploads/2026/04/unrelated-page-wide.pdf"],
				metadata: { title: "Calls for tender" },
			},
		});
		selectResultsQueue.push([], []);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://plan-international.org/calls-tender/"],
			sourceScrapeLimit: 5,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(1);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "RFQ FY26-214 Child Protection and Humanitarian Diplomacy",
			source: "plan_international",
			sourcePlatform: "Plan International",
			noticeId: undefined,
			portalUrl: "https://plan-international.org/calls-tender/",
			documentUrl: "https://plan-international.org/uploads/2026/04/RFQ-FY26-214-1.zip",
			tags: expect.arrayContaining(["plan-international", "ngo", "source-documents"]),
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					documentLinks: [
						expect.objectContaining({
							url: "https://plan-international.org/uploads/2026/04/RFQ-FY26-214-1.zip",
							source: "opportunity_document_url",
						}),
					],
				}),
			}),
		}));
		const insertedSourceUrl = (vi.mocked(db.insert).mock.results[0].value as { values: ReturnType<typeof vi.fn> })
			.values.mock.calls[0][0].sourceUrl;
		expect(insertedSourceUrl).toBe("https://plan-international.org/uploads/2026/04/RFQ-FY26-214-1.zip");
	});

	it("paginates configured source URLs before applying the source scrape limit", async () => {
		firecrawlScrapeMock
			.mockResolvedValueOnce({
				success: true,
				data: {
					markdown: [
						"[Current Tenders](https://buyer.example/tenders/current)",
						"",
						"[Tender for Digital Records Platform](https://buyer.example/tenders/records)",
						"",
						"Deadline: 31 December 2026",
						"",
						"[Next](https://buyer.example/tenders?page=2)",
					].join("\n"),
					links: ["https://buyer.example/tenders?page=2"],
					metadata: { title: "Buyer Tenders" },
				},
			})
			.mockResolvedValueOnce({
				success: true,
				data: {
					markdown: "[RFP for Case Management Platform](https://buyer.example/tenders/case-management)\n\nDeadline: 15 January 2027",
					links: [],
					metadata: { title: "Buyer Tenders - Page 2" },
				},
			});
		selectResultsQueue.push([], []);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://buyer.example/tenders"],
			sourceScrapeLimit: 2,
		});

		expect(searchSearxngMock).not.toHaveBeenCalled();
		expect(firecrawlScrapeMock).toHaveBeenCalledTimes(2);
		expect(firecrawlScrapeMock).toHaveBeenNthCalledWith(2, "https://buyer.example/tenders?page=2", expect.any(Object));
		expect(result.results).toEqual({
			total: 2,
			imported: 2,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl: "https://buyer.example/tenders",
				status: "healthy",
				candidates: 2,
				imported: 2,
			}),
		]);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Tender for Digital Records Platform",
		}));
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "RFP for Case Management Platform",
		}));
	});

	it("imports EBRD procurement notices from the source-specific filter endpoint", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				html: `<section data-cardType="procurement-notices" data-filterPath="/content/ebrd_dxp/uk/en/home/work-with-us/project-procurement/procurement-notices"></section>`,
				markdown: "Procurement Notices",
				links: [],
				metadata: { title: "EBRD Procurement Notices" },
			},
		});
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				resultCount: [{ resultCount: 1, cardType: "procurement-notices" }],
				searchResult: [{
					pagePath: "/content/ebrd_dxp/uk/en/home/work-with-us/project-procurement/procurement-notices/syunik-customs-and-logistics-centre-9730-oth-54703.html",
					title: "Syunik Customs and Logistics Centre 9730-OTH-54703",
					projectUrl: "https://www.ebrd.com/home/work-with-us/project-procurement/procurement-notices/syunik-customs-and-logistics-centre-9730-oth-54703.html",
					projectCountry: "Armenia",
					projectSector: "Municipal Infrastructure",
					projectContractType: "Other Notices",
					projectNoticeType: "Invitation for expressions of interest",
					projectIssueDate: "18 May 2026",
					projectCloseDate: "18 Mar 2027",
				}],
			}),
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.ebrd.com/home/work-with-us/project-procurement/procurement-notices.html"],
			sourceScrapeLimit: 5,
			downloadDiscoveredDocuments: false,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://www.ebrd.com/bin/ebrd_dxp/filterlistservlet",
			expect.objectContaining({ method: "POST" })
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Syunik Customs and Logistics Centre 9730-OTH-54703",
			source: "ebrd",
			sourceId: "ebrd-9730-OTH-54703",
			sourcePlatform: "EBRD",
			sourceFile: "source:https://www.ebrd.com/home/work-with-us/project-procurement/procurement-notices.html",
			countryRegion: "Armenia",
			opportunityType: "eoi",
			tags: ["external-discovery", "source-scrape", "ebrd", "development-bank", "global-procurement"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					engine: "source_scrape",
					sourceUrl: "https://www.ebrd.com/home/work-with-us/project-procurement/procurement-notices.html",
				}),
			}),
		}));
	});

	it("imports SAM.gov RFP notices from the public search endpoint", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: "SAM.gov Contract Opportunities",
				links: [],
				metadata: { title: "SAM.gov Contract Opportunities" },
			},
		});
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				page: { totalElements: 1 },
				_embedded: {
					results: [{
						_id: "sam-result-1",
						solicitationNumber: "FA0000-26-R-0001",
						title: "Request for Proposal: Case Management Platform",
						type: { code: "o", value: "Solicitation" },
						isActive: true,
						isCanceled: false,
						publishDate: "2026-05-20T12:00:00+00:00",
						responseDate: "2026-06-30T20:00:00+00:00",
						descriptions: [{ content: "<p>Implementation and support of a case management platform.</p>" }],
						organizationHierarchy: [{ level: 1, name: "JUSTICE, DEPARTMENT OF" }],
						placeOfPerformance: [{ country: "USA", state: "DC", city: "Washington" }],
						naics: [{ code: "541511", value: "Custom Computer Programming Services" }],
						pointOfContacts: [{ type: "primary", email: "buyer@example.gov" }],
					}],
				},
			}),
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://sam.gov/search/?index=opp&keywords=%22request%20for%20proposal%22"],
			sourceScrapeLimit: 5,
			downloadDiscoveredDocuments: false,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://sam.gov/api/prod/sgs/v1/search/?index=opp&size=10&page=0&sort=-relevance&q=%22request+for+proposal%22&is_active=true"
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Request for Proposal: Case Management Platform",
			source: "sam_gov",
			sourcePlatform: "SAM.gov",
			sourceFile: "source:https://sam.gov/search/?index=opp&keywords=%22request%20for%20proposal%22",
			opportunityType: "rfp",
			tags: ["external-discovery", "source-scrape", "sam-gov", "us-federal"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					engine: "source_scrape",
					sourceUrl: "https://sam.gov/search/?index=opp&keywords=%22request%20for%20proposal%22",
				}),
			}),
		}));
	});

	it("imports IOM procurement rows with solicitation attachments", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			text: async () => `
					<ul class="table-row">
						<li data-label="Invitation to Bid (ITB) Ref. No. &amp; Title" class="specifics">
							<h2 class="h5"><a href="/request-proposal-rfp-provision-training-10000-returnee-migrants-guinea-business-and-entrepreneurial-skills">Request for Proposal (RFP) for the Provision of Training for 10,000 returnee migrants in Guinea in business and entrepreneurial skills</a></h2>
							<h3 class="h2 label">30000026651 (RFP 003/GN10/05/2026)</h3>
							<div class="data" data-preamble="Attachment">
								<p><a href="/sites/g/files/tmzbdl2616/files/procurement/30000026651_supplier_0.pdf">30000026651_SUPPLIER</a></p>
								<p><a href="/sites/g/files/tmzbdl2616/files/procurement/rfp003_1.doc">RFP003_1</a></p>
								<p>Brief Description</p>
								<p>Training for returnee migrants in entrepreneurial skills.</p>
							</div>
						</li>
						<li data-label="Details" class="details">
							<span data-preamble="Category" class="data">Services</span>
							<span data-preamble="Country" class="data">Guinea</span>
							<span data-preamble="Publication Date" class="data">2026-05-26 </span>
							<span data-preamble="Closing Date" class="data">2026-06-24</span>
						</li>
					</ul>
				`,
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.iom.int/procurement-opportunities"],
			sourceScrapeLimit: 5,
			downloadDiscoveredDocuments: false,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(firecrawlScrapeMock).not.toHaveBeenCalled();
		expect(fetchMock).toHaveBeenCalledWith(
			"https://www.iom.int/procurement-opportunities",
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: "text/html,application/xhtml+xml",
				}),
			})
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Request for Proposal (RFP) for the Provision of Training for 10,000 returnee migrants in Guinea in business and entrepreneurial skills",
			source: "source-scrape",
			sourceId: "iom-30000026651-rfp-003-gn10-05-2026",
			sourcePlatform: "IOM",
			sourceFile: "source:https://www.iom.int/procurement-opportunities",
			countryRegion: "Guinea",
			opportunityType: "rfp",
			documentUrl: "https://www.iom.int/sites/g/files/tmzbdl2616/files/procurement/rfp003_1.doc",
			tags: ["external-discovery", "source-scrape", "iom", "un-procurement"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					engine: "source_scrape",
					sourceUrl: "https://www.iom.int/procurement-opportunities",
					scrapeMethod: "source_api",
				}),
			}),
		}));
	});

	it("imports NeST Tanzania releases from the public OCDS API", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-05-29T12:00:00Z"));
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				links: { next: null },
				releases: [{
					id: "6eaef89e-e6c9-4b40-8622-f1afc6a61273",
					ocid: "ocds-mv5oob-122383-3-2025-2026-G-32-S003",
					date: "2026-05-27T00:00:00Z",
					tag: ["tender"],
					buyer: { id: "buyer-1", name: "MWACHAMBIA DISPENSARY" },
					parties: [{
						id: "buyer-1",
						name: "MWACHAMBIA DISPENSARY",
						address: { region: "SINGIDA", countryName: "TZ" },
					}],
					tender: {
						id: "122383-3/2025/2026/G/32-S003",
						description: "Supply of Information and Communication Technology Equipment",
						status: "active",
						procurementMethod: "open",
						procurementMethodDetails: "National competitive tendering",
						procuringEntity: { id: "buyer-1", name: "MWACHAMBIA DISPENSARY" },
						tenderPeriod: {
							startDate: "2026-05-27T00:00:00Z",
							endDate: "2026-06-01T11:30:00Z",
						},
						items: [{
							description: "Network equipment",
							classification: { scheme: "UNSPSC", id: "43222600", description: "Network service equipment" },
						}],
					},
				}],
			}),
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://nest.go.tz/gateway/nest-data-portal-api/api/releases"],
			sourceScrapeLimit: 5,
			downloadDiscoveredDocuments: false,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://nest.go.tz/gateway/nest-data-portal-api/api/releases?since=2026-05-27T00%3A00%3A00.000Z",
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: "application/json",
				}),
			})
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Supply of Information and Communication Technology Equipment",
			source: "source-scrape",
			sourceId: "nest-ocds-mv5oob-122383-3-2025-2026-G-32-S003",
			sourcePlatform: "NeST Tanzania",
			sourceFile: "source:https://nest.go.tz/gateway/nest-data-portal-api/api/releases",
			countryRegion: "Tanzania",
			opportunityType: "tender",
			tags: ["external-discovery", "source-scrape", "nest-tanzania", "tanzania", "national-procurement", "ocds", "source-api"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					engine: "source_scrape",
					sourceUrl: "https://nest.go.tz/gateway/nest-data-portal-api/api/releases",
				}),
			}),
		}));
	});

	it("imports MANEPS Malawi tenders from the public active-tenders API", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				count: 1,
				data: [{
					id: "ac48e846-41c3-4ff3-9755-4361e30739de",
					objectType: "RFX",
					name: "Procurement of Blank Number Plate",
					description: "Procurement of blank number plate",
					procurementCategory: "Goods",
					procurementReferenceNumber: "PVHES-0057-3-26",
					status: "Published",
					budgetAmount: 22000000,
					budgetAmountCurrency: "MWK",
					organizationName: "Plant & Vehicle Hire and Engineering Services",
					publishedDate: "2026-05-29T17:00:00.000Z",
					closingDate: "2026-06-03T07:00:00.000Z",
					tenderProcurementMechanism: {
						PRProcurementMechanisms: {
							procurementMethod: "Request for Quotation (RFQ)",
							procurementType: "Goods",
							fundingSource: "Internal Revenue",
							invitationType: "open",
							marketType: "National",
						},
					},
				}],
			}),
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://maneps.mw/rms/api/tender-notices/active-tenders-search"],
			sourceScrapeLimit: 5,
			downloadDiscoveredDocuments: false,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://maneps.mw/rms/api/tender-notices/active-tenders-search",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Accept: "application/json",
					"Content-Type": "application/json",
				}),
				body: expect.stringContaining("\"includeExpiredTenders\":false"),
			})
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Procurement of Blank Number Plate",
			source: "source-scrape",
			sourceId: "maneps-ac48e846-41c3-4ff3-9755-4361e30739de",
			sourcePlatform: "MANEPS Malawi",
			sourceFile: "source:https://maneps.mw/rms/api/tender-notices/active-tenders-search",
			countryRegion: "Malawi",
			opportunityType: "tender",
			tags: ["external-discovery", "source-scrape", "maneps", "malawi", "national-procurement", "source-api"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					engine: "source_scrape",
					sourceUrl: "https://maneps.mw/rms/api/tender-notices/active-tenders-search",
					scrapeMethod: "source_api",
				}),
			}),
		}));
	});

	it("imports Namibia CPBN open bids from the public bids list", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			text: async () => `
				<table id="activeBidsTable"><tbody>
					<tr><td>
						<h4 class="card-title"><a href="https://www.cpbn.com.na/index/bid/108">Procurement of Wastewater Treatment Plant Management Services.: W/ONB/CPBN-06/2026</a></h4>
						<ul><li><strong>Reference number:</strong> W/ONB/CPBN-06/2026 | <strong>Closing Date and Time:</strong> 15th July, 2026 11:00 | <a href="https://www.cpbn.com.na/index/bid/108">More Details</a></li></ul>
						<div class="card-body"><a href="javascript:void(0)" onclick="openModalRemoteContent('https://www.cpbn.com.na/ajax/download/455')" class="download-link"><span></span>&nbsp;Full Advert.pdf</a></div>
					</td></tr>
				</tbody></table>
			`,
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.cpbn.com.na/index/external/2"],
			sourceScrapeLimit: 5,
			downloadDiscoveredDocuments: false,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://www.cpbn.com.na/index/external/2",
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: "text/html,application/xhtml+xml",
				}),
			})
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Procurement of Wastewater Treatment Plant Management Services.",
			source: "source-scrape",
			sourceId: "cpbn-108",
			sourcePlatform: "Namibia CPBN",
			sourceFile: "source:https://www.cpbn.com.na/index/external/2",
			countryRegion: "Namibia",
			opportunityType: "tender",
			documentUrl: undefined,
			tags: ["external-discovery", "source-scrape", "cpbn", "namibia", "national-procurement", "open-bids"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					engine: "source_scrape",
					sourceUrl: "https://www.cpbn.com.na/index/external/2",
					scrapeMethod: "source_api",
				}),
				cpbnNamibia: expect.objectContaining({
					documentRequests: [{
						label: "Full Advert.pdf",
						url: "https://www.cpbn.com.na/ajax/download/455",
					}],
				}),
			}),
		}));
	});

	it("imports ESPPRA Eswatini tenders with direct document URLs", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			text: async () => `
				<div class="list-item job-box">
					<h5 class="text-center text-md-left" style="text-transform: uppercase; color:#f07d2a">Business Continuity Management System</h5>
					<p style="text-align: justify;"><b>Eswatini Revenue Service</b></p>
					<p style="text-align: justify;"> ERS/RFP/01/2026 </p>
					<p style="text-align: justify;"> Procurement Method: Request For Proposal </p>
					<p style="text-align: justify;"> Tender Upload Date:  Tuesday 19th May 2026 10:13 am</p>
					<p style="text-align: justify;"> Submission Deadline:  Tuesday 9th June 2026 12:00 pm</p>
					<a id="26904" href="documents/tenders/Public Service Pension Fund (PSPF)/1779178473.pdf" class="btn" download>Download Tender</a>
				</div>
			`,
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://esppra.co.sz/sppra/tender.php"],
			sourceScrapeLimit: 5,
			downloadDiscoveredDocuments: false,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://esppra.co.sz/sppra/tender.php",
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: "text/html,application/xhtml+xml",
				}),
			})
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Business Continuity Management System",
			source: "source-scrape",
			sourceId: "esppra-26904",
			sourcePlatform: "ESPPRA Eswatini",
			sourceFile: "source:https://esppra.co.sz/sppra/tender.php",
			countryRegion: "Eswatini",
			opportunityType: "rfp",
			documentUrl: "https://esppra.co.sz/sppra/documents/tenders/Public%20Service%20Pension%20Fund%20(PSPF)/1779178473.pdf",
			tags: ["external-discovery", "source-scrape", "esppra", "eswatini", "national-procurement", "direct-documents", "source-api"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					engine: "source_scrape",
					sourceUrl: "https://esppra.co.sz/sppra/tender.php",
					scrapeMethod: "source_api",
				}),
			}),
		}));
		expect(result.sourceDocumentsCreated).toBe(1);
	});

	it("imports Nigeria NOCOPO published records from the public Open Data handler", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			text: async () => JSON.stringify({
				iTotalRecords: 99447,
				iTotalDisplayRecords: 99421,
				aaData: [{
					TotalCount: 99421,
					ID: 263331,
					MDA_NAME_ONLY: "FEDERAL COLLEGE OF FORESTRY IBADAN",
					MDA_Code: "ocds-gyl66f-535011001-000010",
					pi_Project_Title: "Procurement of Laboratory and ICT Equipment, Workshop, Farm Machinery and Implements",
					pi_Package_Number: "FCF/24/01",
					pi_Lot_Number: "LOT 1",
					DatePublished: "2026-05-29T16:24:34.607",
					pb_BudgetYear: "2024",
					pb_Project_State_Item: "OYO",
					bd_Procurement_Category_FK_Item: "Goods",
					bd_Procurement_Method_FK_Item: "Open Competitive Bidding",
				}],
			}),
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://nocopo.bpp.gov.ng/Open-Data"],
			sourceScrapeLimit: 5,
			downloadDiscoveredDocuments: false,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("https://nocopo.bpp.gov.ng/PublishedRecordHandler.ashx?"),
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: "application/json,text/javascript,*/*",
					Referer: "https://nocopo.bpp.gov.ng/Open-Data",
					"X-Requested-With": "XMLHttpRequest",
				}),
			})
		);
		expect(String(fetchMock.mock.calls[0]?.[0])).toContain("sSortDir_0=desc");
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Procurement of Laboratory and ICT Equipment, Workshop, Farm Machinery and Implements",
			source: "source-scrape",
			sourceId: "nocopo-ocds-gyl66f-535011001-000010",
			sourcePlatform: "Nigeria NOCOPO",
			sourceFile: "source:https://nocopo.bpp.gov.ng/Open-Data",
			countryRegion: "Nigeria - OYO",
			opportunityType: "tender",
			rfpLink: "https://nocopo.bpp.gov.ng/downloadJson.ashx?ty=1&ocid=ocds-gyl66f-535011001-000010",
			tags: ["external-discovery", "source-scrape", "nocopo", "nigeria", "national-procurement", "open-contracting", "source-api"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					engine: "source_scrape",
					sourceUrl: "https://nocopo.bpp.gov.ng/Open-Data",
					scrapeMethod: "source_api",
				}),
				nocopo: expect.objectContaining({
					ocid: "ocds-gyl66f-535011001-000010",
					totalCount: 99421,
				}),
			}),
		}));
	});

	it("imports Mauritius CEB tenders with direct document URLs", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			text: async () => `
				<h4 class="mt-40">OAB-TD-2026-10487 - FRAMEWORK AGREEMENT FOR UNSKILLED WORKS [ <span class="blink small">Updated</span> ]</h4>
				<dl class="row">
					<dt>Download:</dt>
					<dd><ul><li><a href="https://ceb.mu/files/files/tenders/Press%20Notice%20OAB-TD-2026-10487.pdf">Press Notice</a></li></ul></dd>
					<dt>Reference:</dt>
					<dd>OAB-TD-2026-10487</dd>
					<dt>Closing Date:</dt>
					<dd>Wednesday, June 10, 2026 at 13:30 hours Mauritian Time</dd>
					<dt>Tender Document:</dt>
					<dd><li><a data-src="https://ceb.mu/files/files/tenders/OAB-TD-2026-10487%20Bidding%20Documents.doc" href="javascript:;" class="subscribe-download">OAB-TD-2026-10487 Bidding Documents.doc</a></li></dd>
				</dl>
			`,
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://ceb.mu/procurement/tender"],
			sourceScrapeLimit: 5,
			downloadDiscoveredDocuments: false,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://ceb.mu/procurement/tender",
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: "text/html,application/xhtml+xml",
				}),
			})
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "OAB-TD-2026-10487 - FRAMEWORK AGREEMENT FOR UNSKILLED WORKS",
			source: "source-scrape",
			sourceId: "ceb-mauritius-oab-td-2026-10487",
			sourcePlatform: "Mauritius CEB",
			sourceFile: "source:https://ceb.mu/procurement/tender",
			countryRegion: "Mauritius",
			opportunityType: "tender",
			documentUrl: "https://ceb.mu/files/files/tenders/OAB-TD-2026-10487%20Bidding%20Documents.doc",
			tags: ["external-discovery", "source-scrape", "ceb", "mauritius", "national-procurement", "direct-documents"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					engine: "source_scrape",
					sourceUrl: "https://ceb.mu/procurement/tender",
					scrapeMethod: "source_api",
				}),
				cebMauritius: expect.objectContaining({
					reference: "OAB-TD-2026-10487",
					documentLinks: [
						expect.objectContaining({ section: "download" }),
						expect.objectContaining({ section: "tender_document" }),
					],
				}),
			}),
		}));
	});

	it("imports African Union bids with direct bid-document URLs", async () => {
		fetchMock
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				text: async () => `
					<table class="views-table sticky-enabled cols-4">
						<tbody>
							<tr class="odd">
								<td class="views-field views-field-field-date active views-align-left">
									<span class="date-display-single">July 02, 2026</span>
								</td>
								<td class="views-field views-field-title views-align-left">
									<a href="/en/bids/20260522/supply-delivery-installation-and-training-enterprise-aigpu-enables-high-performance">Supply, Delivery, Installation and Training of an Enterprise AI/GPU-Enables High-Performance Computing Server</a>
								</td>
								<td class="views-field views-field-field-tags-documents">
									<a href="/en/procurement-bids">Procurement/ Bids</a>
								</td>
								<td class="views-field views-field-field-text-bidnumber views-align-left">ET-AUC-545691-GO-</td>
							</tr>
						</tbody>
					</table>
				`,
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				text: async () => `
					<div class="field field-name-field-date field-type-date field-label-hidden">
						<span class="date-display-range">
							<span class="date-display-start" content="2026-05-22T15:18:00+03:00">May 22, 2026</span>
							to <span class="date-display-end" content="2026-07-02T15:00:00+03:00">July 02, 2026</span>
						</span>
					</div>
					<div class="panel-separator"></div>
					<div class="field field-name-field-text-bidnumber field-type-text field-label-above">
						<div class="field-label">Bid number:&nbsp;</div>
						<div class="field-items"><div class="field-item even">ET-AUC-545691-GO-RFB</div></div>
					</div>
					<div class="panel-separator"></div>
					<div class="field field-name-field-file field-type-file field-label-hidden">
						<div class="field-items"><div class="field-item even">
							<span class="file"><a href="https://au.int/sites/default/files/bids/46431-BIDDING_DOCUMENT_22_May_2026.pdf" type="application/pdf">Bid Document</a></span>
						</div></div>
					</div>
				`,
			});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://au.int/en/bids"],
			sourceScrapeLimit: 5,
			downloadDiscoveredDocuments: false,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://au.int/en/bids",
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: "text/html,application/xhtml+xml",
				}),
			})
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Supply, Delivery, Installation and Training of an Enterprise AI/GPU-Enables High-Performance Computing Server",
			source: "source-scrape",
			sourceId: "african-union-supply-delivery-installat-7a4372edda",
			sourcePlatform: "African Union",
			sourceFile: "source:https://au.int/en/bids",
			countryRegion: "Africa",
			opportunityType: "tender",
			documentUrl: "https://au.int/sites/default/files/bids/46431-BIDDING_DOCUMENT_22_May_2026.pdf",
			rfpLink: "https://au.int/sites/default/files/bids/46431-BIDDING_DOCUMENT_22_May_2026.pdf",
			tags: ["external-discovery", "source-scrape", "african-union", "auc", "regional-procurement", "direct-documents"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					engine: "source_scrape",
					sourceUrl: "https://au.int/en/bids",
					scrapeMethod: "source_api",
				}),
				africanUnion: expect.objectContaining({
					bidNumber: "ET-AUC-545691-GO-RFB",
					documentLinks: [expect.objectContaining({
						url: "https://au.int/sites/default/files/bids/46431-BIDDING_DOCUMENT_22_May_2026.pdf",
					})],
				}),
			}),
		}));
	});

	it("keeps importing later configured sources when one source parser throws", async () => {
		fetchMock.mockRejectedValueOnce(new Error("AU source timed out"));
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: "[RFP for Records Platform](https://buyer.example/tenders/records)\n\nDeadline: 31 December 2026",
				links: ["https://buyer.example/tenders/records"],
				metadata: { title: "Buyer Tenders" },
			},
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://au.int/en/bids", "https://buyer.example/tenders"],
			sourceScrapeLimit: 5,
			downloadDiscoveredDocuments: false,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(result.warnings).toEqual([
			expect.objectContaining({
				type: "source_scrape_failed",
				query: "source:https://au.int/en/bids",
				message: "AU source timed out",
			}),
		]);
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl: "https://au.int/en/bids",
				status: "failed",
				candidates: 0,
				warnings: 1,
				warningTypes: { source_scrape_failed: 1 },
			}),
			expect.objectContaining({
				sourceUrl: "https://buyer.example/tenders",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
		]);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "RFP for Records Platform",
			sourceFile: "source:https://buyer.example/tenders",
		}));
	});

	it("imports Ghana GHANEPS tenders with the national source platform label", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			text: async () => `
				<table id="T01"><tbody>
					<tr>
						<td>1</td>
						<td style="display:block; text-align:left">
							<a href="/epps/cft/prepareViewCfTWS.do?resourceId=2961470">Consultancy Service for the preparation of a comprehensive risk assessment report</a>
						</td>
						<td>MINISTRY OF FINANCE</td>
						<td></td>
						<td>Mon Jun 29 10:00:00 GMT 2026</td>
						<td>Quality and Cost Based Selection</td>
						<td>Bid Submission</td>
						<td><a href="/epps/cft/downloadNoticeForAdvSearch.do?resourceId=2961470"><img src="/epps/images/acrobat.gif" /></a></td>
						<td>Fri May 29 09:15:00 GMT 2026</td>
					</tr>
				</tbody></table>
			`,
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.ghaneps.gov.gh/epps/quickSearchAction.do?searchSelect=6"],
			sourceScrapeLimit: 5,
			downloadDiscoveredDocuments: false,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Consultancy Service for the preparation of a comprehensive risk assessment report",
			source: "source-scrape",
			sourceId: "ghaneps-2961470",
			sourcePlatform: "Ghana GHANEPS",
			countryRegion: "Ghana",
			opportunityType: "rfp",
			documentUrl: "https://www.ghaneps.gov.gh/epps/cft/downloadNoticeForAdvSearch.do?resourceId=2961470",
			tags: ["external-discovery", "source-scrape", "ghaneps", "ghana", "national-procurement", "source-api"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					scrapeMethod: "source_api",
				}),
			}),
		}));
	});

	it("imports South Africa eTenders releases from the public OCDS API", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-05-29T12:00:00Z"));
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				links: { next: null },
				releases: [{
					ocid: "ocds-9t57fa-157517",
					id: "ocds-9t57fa-157517-2026-05-29",
					date: "2026-05-29T00:00:00Z",
					tag: ["compiled"],
					initiationType: "tender",
					buyer: { id: "167", name: "ESKOM" },
					tender: {
						id: "157517",
						title: "E2966CXMWP",
						status: "active",
						category: "Financial service activities, except insurance and pension funding",
						province: "Gauteng",
						deliveryLocation: "02 Maxwell Drive - Sunninghill - Johannesburg - 2157",
						mainProcurementCategory: "services",
						description: "Funding analysis, lender engagement and credit impact assessment.",
						procurementMethod: "open",
						procurementMethodDetails: "Request for Proposal",
						tenderPeriod: {
							startDate: "2026-05-29T00:00:00Z",
							endDate: "2026-06-19T12:00:00Z",
						},
						procuringEntity: { id: "167", name: "ESKOM" },
						documents: [{
							id: "59d27a99-7b97-49d3-ab8c-c8dc31a17297",
							documentType: "basic",
							title: "RFP Letter_NTCSA Sale Final.pdf",
							url: "https://www.etenders.gov.za/home/Download?blobName=59d27a99.pdf&downloadedFileName=RFP%20Letter.pdf",
							format: "pdf",
						}],
					},
				}],
			}),
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://ocds-api.etenders.gov.za/api/OCDSReleases"],
			sourceScrapeLimit: 5,
			downloadDiscoveredDocuments: false,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://ocds-api.etenders.gov.za/api/OCDSReleases?PageNumber=1&PageSize=100&dateFrom=2026-04-29&dateTo=2026-05-29",
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: "application/json",
				}),
			})
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "E2966CXMWP - Funding analysis, lender engagement and credit impact assessment.",
			source: "source-scrape",
			sourceId: "etenders-sa-ocds-9t57fa-157517",
			sourcePlatform: "South Africa eTenders",
			sourceFile: "source:https://ocds-api.etenders.gov.za/api/OCDSReleases",
			countryRegion: "South Africa - Gauteng",
			opportunityType: "rfp",
			rfpLink: "https://www.etenders.gov.za/home/Download?blobName=59d27a99.pdf&downloadedFileName=RFP%20Letter.pdf",
			tags: ["external-discovery", "source-scrape", "etenders-sa", "south-africa", "national-procurement", "ocds", "source-api"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					engine: "source_scrape",
					sourceUrl: "https://ocds-api.etenders.gov.za/api/OCDSReleases",
				}),
			}),
		}));
	});

	it("imports EU Funding & Tenders calls from the SEDIA search endpoint", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: "EU Funding & Tenders Portal",
				links: [],
				metadata: { title: "EU Funding & Tenders Portal" },
			},
		});
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				totalResults: 1,
				results: [{
					reference: "HORIZON-EIC-2026-ACCELERATOR-01en",
					url: "https://ec.europa.eu/info/funding-tenders/opportunities/data/topicDetails/HORIZON-EIC-2026-ACCELERATOR-01.json",
					summary: "EIC Accelerator 2026 - Short proposal",
					metadata: {
						title: ["EIC Accelerator 2026 - Short proposal"],
						identifier: ["HORIZON-EIC-2026-ACCELERATOR-01"],
						callTitle: ["EIC Accelerator 2026"],
						description: ["<p>Funding for innovative companies preparing a short proposal.</p>"],
						type: ["1"],
						status: ["31094502"],
						sortStatus: ["1"],
						deadlineDate: ["2099-12-17T00:00:00.000+0000"],
						startDate: ["2099-01-01T00:00:00.000+0000"],
						frameworkProgramme: ["Horizon Europe"],
					},
				}],
			}),
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals?keywords=proposal"],
			sourceScrapeLimit: 5,
			downloadDiscoveredDocuments: false,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=proposal&pageSize=25&pageNumber=1",
			expect.objectContaining({ method: "POST" })
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "EIC Accelerator 2026 - Short proposal",
			source: "eu_funding_tenders",
			sourcePlatform: "EU Funding & Tenders",
			sourceFile: "source:https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals?keywords=proposal",
			opportunityType: "grant",
			tags: ["external-discovery", "source-scrape", "eu-funding-tenders", "european-commission", "eu-grant"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					engine: "source_scrape",
					sourceUrl: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals?keywords=proposal",
				}),
			}),
		}));
	});

	it("uses browser fallback for configured source URLs when Firecrawl is blocked", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: false,
			error: "DNS lookup failed",
		});
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				success: true,
				data: {
					markdown: "[Tender for Source Browser Recovery](https://buyer.example/tenders/browser-recovery)\n\nDeadline: 31 December 2026",
					metadata: {
						title: "Buyer Tenders Browser",
						description: "Recovered rendered tender listing.",
					},
				},
			}),
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://buyer.example/tenders"],
			sourceScrapeLimit: 5,
			browserFallback: true,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"http://84.247.181.100:3003/v1/scrape",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					url: "https://buyer.example/tenders",
					options: {
						timeout: 15000,
						humanScroll: true,
						blockMedia: true,
						formats: ["markdown", "html", "links"],
					},
				}),
			})
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Tender for Source Browser Recovery",
			rfpLink: "https://buyer.example/tenders/browser-recovery",
			portalUrl: "https://buyer.example/tenders/browser-recovery",
			source: "source-scrape",
			sourcePlatform: "Configured Source Scrape",
			sourceFile: "source:https://buyer.example/tenders",
			tags: ["external-discovery", "source-scrape"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					engine: "source_scrape",
					sourceUrl: "https://buyer.example/tenders",
					resultEngine: "firecrawl-source",
					scrapedWithFirecrawl: false,
					scrapedWithBrowserFallback: true,
					scrapeMethod: "browser_fallback",
					browserFallbackReason: "DNS lookup failed",
				}),
			}),
		}));
		expect(result.warnings).toEqual([
			expect.objectContaining({
				type: "browser_fallback_used",
				query: "source:https://buyer.example/tenders",
				title: "Tender for Source Browser Recovery",
				url: "https://buyer.example/tenders/browser-recovery",
				message: "DNS lookup failed",
			}),
		]);
		expect(updateImportRecordMock).toHaveBeenCalledWith("import-1", expect.objectContaining({
			config: expect.objectContaining({
				audit: expect.objectContaining({
					warnings: [
						expect.objectContaining({
							type: "browser_fallback_used",
							message: "DNS lookup failed",
						}),
					],
					sourceHealth: [
						expect.objectContaining({
							sourceUrl: "https://buyer.example/tenders",
							status: "degraded",
							candidates: 1,
							imported: 1,
							warnings: 1,
							warningTypes: { browser_fallback_used: 1 },
							message: "DNS lookup failed",
						}),
					],
				}),
			}),
		}), "user-1");
	});

	it("uses CloakBrowser for configured source URLs only after Firecrawl and browser fallback fail", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: false,
			error: "Cloudflare challenge",
		});
		getCloakBrowserEndpointMock.mockReturnValue("ws://127.0.0.1:9222/devtools/browser/test");
		scrapeWithCloakBrowserMock.mockResolvedValue({
			success: true,
			data: {
				markdown: "[Tender recovered through CloakBrowser](https://buyer.example/tenders/cloak-recovery)\n\nDeadline: 31 December 2026",
				links: ["https://buyer.example/tenders/cloak-recovery"],
				metadata: {
					title: "Buyer Tenders CloakBrowser",
					statusCode: 200,
				},
			},
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://buyer.example/tenders"],
			sourceScrapeLimit: 5,
			browserFallback: true,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"http://84.247.181.100:3003/v1/scrape",
			expect.objectContaining({ method: "POST" })
		);
		expect(scrapeWithCloakBrowserMock).toHaveBeenCalledWith(
			"https://buyer.example/tenders",
			{
				timeout: 60000,
				humanScroll: true,
				blockMedia: true,
			}
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Tender recovered through CloakBrowser",
			rfpLink: "https://buyer.example/tenders/cloak-recovery",
			portalUrl: "https://buyer.example/tenders/cloak-recovery",
			source: "source-scrape",
			sourcePlatform: "Configured Source Scrape",
			sourceFile: "source:https://buyer.example/tenders",
			tags: ["external-discovery", "source-scrape"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					engine: "source_scrape",
					sourceUrl: "https://buyer.example/tenders",
					resultEngine: "firecrawl-source",
					scrapedWithFirecrawl: false,
					scrapedWithBrowserFallback: false,
					scrapedWithCloakBrowserFallback: true,
					scrapeMethod: "cloakbrowser_fallback",
					browserFallbackReason: "Cloudflare challenge",
				}),
			}),
		}));
		expect(result.warnings).toEqual([
			expect.objectContaining({
				type: "cloakbrowser_fallback_used",
				query: "source:https://buyer.example/tenders",
				title: "Tender recovered through CloakBrowser",
				url: "https://buyer.example/tenders/cloak-recovery",
				message: "Cloudflare challenge",
			}),
		]);
		expect(updateImportRecordMock).toHaveBeenCalledWith("import-1", expect.objectContaining({
			config: expect.objectContaining({
				audit: expect.objectContaining({
					sourceHealth: [
						expect.objectContaining({
							sourceUrl: "https://buyer.example/tenders",
							status: "degraded",
							candidates: 1,
							imported: 1,
							warnings: 1,
							warningTypes: { cloakbrowser_fallback_used: 1 },
							message: "Cloudflare challenge",
						}),
					],
				}),
			}),
		}), "user-1");
	});

	it("imports UN Procurement configured sources from browser-rendered listing cards", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				content: `
					<li class="views-row">
						<div class="views-field views-field-title custom-card-title">WS2006276746</div>
						<span class="start">09 Jun 2026 </span>
						<span class="end">12 Jun 2026</span>
						<time datetime="2026-06-09T15:00:00Z" class="datetime">15:00</time>
						<div class="views-field views-field-field-text-75-1 custom-card-title-field">
							<div class="field-content">Provision of Cisco Core, Distribution and Datacenter Solutions</div>
						</div>
						<div class="views-field views-field-name tender-custom-field tender-commodity-group-field">
							<span class="field-content">Communications Equipment</span>
						</div>
						<div class="views-field views-field-nothing card-buttons">
							<div class="field-content">
								<a href="https://www.un.org/Depts/ptd/sites/www.un.org.Depts.ptd/files/pdf/eoi24446.pdf" target="_blank" class="download-pdf-btn btn btn-secondary">PDF Instructions</a>
								<a href="https://www.ungm.org/Public/Notice/302351" class="btn btn-secondary" target="_blank" aria-label="Express interest for WS2006276746">Express Interest</a>
							</div>
						</div>
					</li>
				`,
				pageStatusCode: 200,
			}),
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.un.org/procurement/solicitations-opportunities"],
			sourceScrapeLimit: 5,
			browserFallback: true,
		});

		expect(firecrawlScrapeMock).not.toHaveBeenCalled();
		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(1);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Provision of Cisco Core, Distribution and Datacenter Solutions",
			source: "un_procurement",
			sourceId: "un-procurement-ws2006276746",
			noticeId: "WS2006276746",
			sourcePlatform: "UN Procurement",
			sourceFile: "source:https://www.un.org/procurement/solicitations-opportunities",
			category: "Communications Equipment",
			opportunityType: "tender",
			documentUrl: "https://www.un.org/Depts/ptd/sites/www.un.org.Depts.ptd/files/pdf/eoi24446.pdf",
			tags: ["external-discovery", "source-scrape", "un-procurement", "unpd", "solicitation"],
			metadata: expect.objectContaining({
				unProcurement: expect.objectContaining({
					noticeId: "WS2006276746",
					commodityGroup: "Communications Equipment",
					expressInterestUrl: "https://www.ungm.org/Public/Notice/302351",
				}),
				discovery: expect.objectContaining({
					scrapedWithBrowserSource: true,
					scrapeMethod: "browser_source",
				}),
			}),
		}));
		const insertedSourceUrl = (vi.mocked(db.insert).mock.results[0].value as { values: ReturnType<typeof vi.fn> })
			.values.mock.calls[0][0].sourceUrl;
		expect(insertedSourceUrl).toBe("https://www.un.org/Depts/ptd/sites/www.un.org.Depts.ptd/files/pdf/eoi24446.pdf");
		expect(result.warnings).toEqual([]);
	});

	it("persists service-run discoveries under the explicit import tenant", async () => {
		getUserContextMock.mockResolvedValue({
			userId: "interactive-user-1",
			organizationId: "org-interactive-1",
			roles: [],
		});
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "Tender for document management platform",
					url: "https://example.org/tenders/document-management",
					content: "Tender notice for document management implementation.",
					engine: "brave",
					score: 9,
					category: "general",
				},
			],
		});
		selectResultsQueue.push([]);

		const result = await executeOpportunityDiscoveryImport(
			{ query: "document management tender", limitPerQuery: 1 },
			"service-user-1",
			"org-service-1"
		);

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(createImportRecordMock).toHaveBeenCalledWith(
			"searxng-discovery",
			1,
			expect.any(Object),
			"service-user-1",
			"org-service-1"
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(
			expect.objectContaining({
				assignedTo: "service-user-1",
				title: "Tender for document management platform",
				source: "searxng",
			}),
			{ actorId: "service-user-1", organizationId: "org-service-1" }
		);
		expect(updateImportRecordMock).toHaveBeenCalledWith(
			"import-1",
			expect.objectContaining({
				importedRecords: 1,
				status: "completed",
			}),
			"service-user-1",
			"org-service-1"
		);
	});

	it("runs explicit service discovery outside a request-scoped auth context", async () => {
		getUserContextMock.mockRejectedValue(new Error("headers was called outside a request scope"));
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "Tender for offline records platform",
					url: "https://example.org/tenders/offline-records",
					content: "Tender notice for records platform implementation.",
					engine: "bing",
					score: 9,
					category: "general",
				},
			],
		});
		selectResultsQueue.push([]);

		const result = await executeOpportunityDiscoveryImport(
			{ query: "offline records tender", limitPerQuery: 1 },
			"service-user-1",
			"org-service-1"
		);

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(createImportRecordMock).toHaveBeenCalledWith(
			"searxng-discovery",
			1,
			expect.any(Object),
			"service-user-1",
			"org-service-1"
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(
			expect.objectContaining({
				assignedTo: "service-user-1",
				title: "Tender for offline records platform",
			}),
			{ actorId: "service-user-1", organizationId: "org-service-1" }
		);
	});

	it("imports Kenya PPIP configured sources through the public JSON API before Firecrawl", async () => {
		const deadline = new Date(2026, 5, 10, 14, 0, 0);
		const publishedDate = new Date(2026, 4, 26);
		fetchKenyaPpipOpportunitiesMock.mockResolvedValue({
			apiUrl: "https://tenders.go.ke/api/active-tenders?perpage=5&page=1",
			total: 928,
			opportunities: [{
				title: "REGISTRATION OF SUPPLIERS & SERVICE PROVIDERS",
				source: "kenya_ppip",
				sourceId: "GDC/SC/REG/007/2026-2028",
				noticeId: "GDC/SC/REG/007/2026-2028",
				organization: "Geothermal Development Company",
				countryRegion: "Kenya",
				category: "Goods",
				projectSummary: "REGISTRATION OF SUPPLIERS & SERVICE PROVIDERS",
				submissionMethod: "Electronic submission",
				opportunityType: "tender",
				deadline,
				publishedDate,
				portalUrl: "https://tenders.go.ke/tenders/291563",
				documentUrl: "https://tenders.go.ke/storage/Documents/registration.pdf",
				rfpLink: "https://tenders.go.ke/storage/Documents/registration.pdf",
				metadata: { ppip: { id: 291563, documentCount: 1 } },
			}],
		});

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://tenders.go.ke/tenders"],
			sourceScrapeLimit: 5,
		});

		expect(searchSearxngMock).not.toHaveBeenCalled();
		expect(fetchKenyaPpipOpportunitiesMock).toHaveBeenCalledWith("https://tenders.go.ke/tenders", {
			limit: 5,
			timeoutMs: 20000,
		});
		expect(firecrawlScrapeMock).not.toHaveBeenCalled();
		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			sourceId: "GDC/SC/REG/007/2026-2028",
			title: "REGISTRATION OF SUPPLIERS & SERVICE PROVIDERS",
			category: "Goods",
			countryRegion: "Kenya",
			organization: "Geothermal Development Company",
			deadline,
			publishedDate,
			rfpLink: "https://tenders.go.ke/storage/Documents/registration.pdf",
			source: "kenya_ppip",
			sourcePlatform: "Kenya PPIP",
			sourceFile: "source:https://tenders.go.ke/tenders",
			noticeId: "GDC/SC/REG/007/2026-2028",
			portalUrl: "https://tenders.go.ke/tenders/291563",
			documentUrl: "https://tenders.go.ke/storage/Documents/registration.pdf",
			tags: ["external-discovery", "source-scrape", "kenya-ppip"],
			metadata: expect.objectContaining({
				ppip: { id: 291563, documentCount: 1 },
				discovery: expect.objectContaining({
					resultEngine: "kenya-ppip-api",
					scrapeMethod: "source_api",
					scrapedWithFirecrawl: false,
					sourceTotal: 928,
					sourceUrl: "https://tenders.go.ke/tenders",
				}),
			}),
		}));
		expect(result.sourceDocumentsCreated).toBe(1);
	});

	it("imports UNGM configured sources through the public notice endpoint before Firecrawl", async () => {
		const deadline = new Date(2026, 4, 26, 15, 30, 0);
		const publishedDate = new Date(2026, 4, 13);
		fetchUngmOpportunitiesMock.mockResolvedValue({
			searchUrl: "https://www.ungm.org/Public/Notice/Search",
			total: 1657,
			opportunities: [{
				title: "Adquisicion de ropa de cama y toallas de bano",
				source: "ungm",
				sourceId: "300726",
				noticeId: "UNDP-PER-00907,1",
				organization: "UNDP",
				countryRegion: "Peru",
				category: "Invitation to bid",
				projectSummary: "Invitation to bid published by UNDP for Peru",
				opportunityType: "tender",
				deadline,
				publishedDate,
				portalUrl: "https://www.ungm.org/Public/Notice/300726",
				rfpLink: "https://www.ungm.org/Public/Notice/300726",
				tags: ["ungm", "un-procurement"],
				metadata: { ungm: { noticeId: "300726", reference: "UNDP-PER-00907,1" } },
			}],
		});

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.ungm.org/Public/Notice"],
			sourceScrapeLimit: 5,
		});

		expect(searchSearxngMock).not.toHaveBeenCalled();
		expect(fetchUngmOpportunitiesMock).toHaveBeenCalledWith("https://www.ungm.org/Public/Notice", {
			limit: 5,
			timeoutMs: 20000,
		});
		expect(firecrawlScrapeMock).not.toHaveBeenCalled();
		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			sourceId: "300726",
			title: "Adquisicion de ropa de cama y toallas de bano",
			category: "Invitation to bid",
			countryRegion: "Peru",
			organization: "UNDP",
			deadline,
			publishedDate,
			rfpLink: "https://www.ungm.org/Public/Notice/300726",
			source: "ungm",
			sourcePlatform: "UNGM",
			sourceFile: "source:https://www.ungm.org/Public/Notice",
			noticeId: "UNDP-PER-00907,1",
			portalUrl: "https://www.ungm.org/Public/Notice/300726",
			tags: ["external-discovery", "source-scrape", "ungm", "un-procurement"],
			metadata: expect.objectContaining({
				ungm: { noticeId: "300726", reference: "UNDP-PER-00907,1" },
				discovery: expect.objectContaining({
					resultEngine: "ungm-public-notice-search",
					scrapeMethod: "source_api",
					scrapedWithFirecrawl: false,
					sourceTotal: 1657,
					sourceUrl: "https://www.ungm.org/Public/Notice",
				}),
			}),
		}));
		expect(result.sourceDocumentsCreated).toBe(0);
	});

	it("imports UNDP configured sources with the UNDP parser", async () => {
		const documentUrl = "https://undp.sharepoint.com/sites/Docs-Public/Procurement/Forms/AllItems.aspx?FilterValue1=UNDP-IND-00772%2C1";
		firecrawlScrapeMock.mockResolvedValueOnce({
			success: true,
			data: {
				markdown: [
					"[Title\\ \\ Wool handloom value chain, Livelihood Enterprise Development & Community Cons\\ \\ Ref No\\ \\ UNDP-IND-00772,1\\ \\ UNDP Office/Country\\ \\ UNDP-IND/INDIA\\ \\ Process\\ \\ RFP - Request for proposal\\ \\ Deadline\\ \\ 09-Jun-26 \\ 08:00 AM (New York time)\\ \\ Posted\\ \\ 26-May-26](https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=45879)",
				].join("\n"),
				links: ["https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=45879"],
				metadata: { title: "UNDP Procurement Notices" },
			},
		}).mockResolvedValueOnce({
			success: true,
			data: {
				markdown: [
					"Contact",
					"UNDP India - [procurement.in@undp.org](mailto:procurement.in@undp.org)",
					"",
					"Documents :",
					"-----------",
					"",
					`[Negotiation Document(s)](${documentUrl})`,
					"(Before Accessing other negotiations Document(s), please click on [this link](https://undp.sharepoint.com/:f:/s/Docs-Public/example?e=abc))",
				].join("\n"),
				links: [documentUrl],
				metadata: { title: "Procurement Notices - UNDP-IND-00772,1" },
			},
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://procurement-notices.undp.org"],
			sourceScrapeLimit: 5,
		});

		expect(searchSearxngMock).not.toHaveBeenCalled();
		expect(firecrawlScrapeMock).toHaveBeenNthCalledWith(1, "https://procurement-notices.undp.org/", expect.objectContaining({
			formats: ["markdown", "html", "links"],
		}));
		expect(firecrawlScrapeMock).toHaveBeenNthCalledWith(2, "https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=45879", expect.objectContaining({
			formats: ["markdown", "links"],
		}));
		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			source: "undp",
			sourcePlatform: "UNDP",
			sourceFile: "source:https://procurement-notices.undp.org/",
			sourceId: "UNDP-IND-00772,1",
			title: "Wool handloom value chain, Livelihood Enterprise Development & Community Cons",
			category: "RFP - Request for proposal",
			countryRegion: "INDIA",
			organization: "UNDP-IND",
			rfpLink: documentUrl,
			portalUrl: "https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=45879",
			documentUrl,
			submissionMethod: "Negotiation Document(s)",
			tags: ["external-discovery", "source-scrape", "undp", "un-procurement"],
			metadata: expect.objectContaining({
				undp: expect.objectContaining({
					refNo: "UNDP-IND-00772,1",
					process: "RFP - Request for proposal",
					contactEmail: "procurement.in@undp.org",
					primaryLink: { description: "Negotiation Document(s)", url: documentUrl },
				}),
				discovery: expect.objectContaining({
					resultEngine: "firecrawl-source",
					scrapeMethod: "firecrawl",
					scrapedWithFirecrawl: true,
					sourceUrl: "https://procurement-notices.undp.org/",
				}),
			}),
		}));
		expect(result.sourceDocumentsCreated).toBe(1);
	});

	it("imports COMESA configured sources with the COMESA parser", async () => {
		const documentUrl = "https://www.comesa.int/wp-content/uploads/2026/05/RFP-Medical-Scheme-2026-Final.docx";
		firecrawlScrapeMock.mockResolvedValueOnce({
			success: true,
			data: {
				markdown: [
					"* [Open Tenders](https://www.comesa.int/category/open-tenders/)",
					"",
					"[](https://www.comesa.int/tender-of-provision-of-staff-medical-insurance-cover-for-staff-of-the-comesa-secretariat/)",
					"",
					"### [Tender for Provision of Staff Medical Insurance Cover for Staff of The COMESA Secretariat](https://www.comesa.int/tender-of-provision-of-staff-medical-insurance-cover-for-staff-of-the-comesa-secretariat/)",
					"",
					"12/05/2026",
					"",
					"The COMESA Secretariat has set aside funding towards contracting a medical insurance service provider.",
				].join("\n"),
				links: ["https://www.comesa.int/tender-of-provision-of-staff-medical-insurance-cover-for-staff-of-the-comesa-secretariat/"],
				metadata: { title: "Open Tenders Archives - COMESA" },
			},
		}).mockResolvedValueOnce({
			success: true,
			data: {
				markdown: [
					"[Privacy Policy](https://www.comesa.int/wp-content/uploads/2022/09/Approved-Data-Privacy-Policy.pdf)",
					"",
					"[Advert Medical Insurance](https://www.comesa.int/wp-content/uploads/2026/05/Advert-Medical-Insurance.docx)",
					"",
					"[RFP Medical Scheme 2026 Final](https://www.comesa.int/wp-content/uploads/2026/05/RFP-Medical-Scheme-2026-Final.docx)",
				].join("\n"),
				links: [
					"https://www.comesa.int/wp-content/uploads/2022/09/Approved-Data-Privacy-Policy.pdf",
					"https://www.comesa.int/wp-content/uploads/2026/05/Advert-Medical-Insurance.docx",
					documentUrl,
				],
				metadata: { title: "Tender for Provision of Staff Medical Insurance Cover" },
			},
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.comesa.int/category/open-tenders/"],
			sourceScrapeLimit: 5,
		});

		expect(searchSearxngMock).not.toHaveBeenCalled();
		expect(firecrawlScrapeMock).toHaveBeenCalledWith("https://www.comesa.int/category/open-tenders/", expect.objectContaining({
			formats: ["markdown", "html", "links"],
		}));
		expect(firecrawlScrapeMock).toHaveBeenCalledWith("https://www.comesa.int/tender-of-provision-of-staff-medical-insurance-cover-for-staff-of-the-comesa-secretariat/", expect.objectContaining({
			formats: ["markdown", "links"],
		}));
		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			source: "comesa",
			sourcePlatform: "COMESA",
			sourceFile: "source:https://www.comesa.int/category/open-tenders/",
			title: "Tender for Provision of Staff Medical Insurance Cover for Staff of The COMESA Secretariat",
			category: "Tender",
			countryRegion: "Eastern and Southern Africa",
			organization: "COMESA Secretariat",
			rfpLink: documentUrl,
			portalUrl: "https://www.comesa.int/tender-of-provision-of-staff-medical-insurance-cover-for-staff-of-the-comesa-secretariat/",
			documentUrl,
			submissionMethod: "RFP Medical Scheme 2026 Final",
			tags: ["external-discovery", "source-scrape", "comesa", "regional-procurement"],
			metadata: expect.objectContaining({
				comesa: expect.objectContaining({
					sourceArchive: "open-tenders",
					primaryLink: expect.objectContaining({ url: documentUrl }),
				}),
				discovery: expect.objectContaining({
					resultEngine: "firecrawl-source",
					scrapeMethod: "firecrawl",
					scrapedWithFirecrawl: true,
					sourceUrl: "https://www.comesa.int/category/open-tenders/",
				}),
			}),
		}));
	});

	it("imports UNICEF configured sources with the UNICEF Supply parser", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: [
					"# Service contracts tender calendar",
					"",
					"Suppliers interested in these bidding exercises should express interest to sd.servicecontracting@unicef.org.",
					"",
					"| Description of tender | Estimated duration of LTA/Institutional Contract | Estimated time of tender issuance |",
					"| --- | --- | --- |",
					"| LTA for Conferencing Telephony Equipment (Ribbon hardware and software) - (ITB) | 4 years (2 +1+1) | Q3 |",
					"| LTA for Mobile Satellite Devices and Services | 5 years (3+1+1) | Q4 |",
				].join("\n"),
				links: [],
				metadata: { title: "Service contracts tender calendar" },
			},
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.unicef.org/supply/service-contracts-tender-calendar"],
			sourceScrapeLimit: 5,
		});

		expect(searchSearxngMock).not.toHaveBeenCalled();
		expect(firecrawlScrapeMock).toHaveBeenCalledWith("https://www.unicef.org/supply/service-contracts-tender-calendar", expect.objectContaining({
			formats: ["markdown", "html", "links"],
		}));
		expect(result.results).toEqual({
			total: 2,
			imported: 2,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			source: "unicef",
			sourcePlatform: "UNICEF Supply Division",
			sourceFile: "source:https://www.unicef.org/supply/service-contracts-tender-calendar",
			sourceId: "unicef-lta-for-conferencing-telephony-e-e80790450d",
			title: "LTA for Conferencing Telephony Equipment (Ribbon hardware and software) - (ITB)",
			category: "Service contract tender calendar",
			countryRegion: "Global",
			organization: "UNICEF Supply Division",
			opportunityType: "tender",
			rfpLink: "https://www.unicef.org/supply/service-contracts-tender-calendar",
			portalUrl: "https://www.unicef.org/supply/service-contracts-tender-calendar",
			documentUrl: undefined,
			submissionMethod: "Express interest by emailing sd.servicecontracting@unicef.org; suppliers should also be registered on UNGM.",
			tags: ["external-discovery", "source-scrape", "unicef", "un-procurement", "tender-calendar", "service-contract", "ict"],
			metadata: expect.objectContaining({
				unicef: expect.objectContaining({
					sourcePage: "service-contracts-tender-calendar",
					estimatedDuration: "4 years (2 +1+1)",
					estimatedIssuance: "Q3",
				}),
				discovery: expect.objectContaining({
					resultEngine: "firecrawl-source",
					scrapeMethod: "firecrawl",
					scrapedWithFirecrawl: true,
					sourceUrl: "https://www.unicef.org/supply/service-contracts-tender-calendar",
				}),
			}),
		}));
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			source: "unicef",
			sourceId: "unicef-lta-for-mobile-satellite-devices-41a5c25bb6",
			title: "LTA for Mobile Satellite Devices and Services",
			sourceFile: "source:https://www.unicef.org/supply/service-contracts-tender-calendar",
			rfpLink: "https://www.unicef.org/supply/service-contracts-tender-calendar",
			tags: ["external-discovery", "source-scrape", "unicef", "un-procurement", "tender-calendar", "service-contract", "ict"],
		}));
		expect(result.sourceDocumentsCreated).toBe(0);
	});

	it("retries configured source scrapes when the first response parses empty", async () => {
		firecrawlScrapeMock
			.mockResolvedValueOnce({
				success: true,
				data: {
					markdown: "# Service contracts tender calendar\n\nSearch form",
					links: [],
					metadata: { title: "Service contracts tender calendar" },
				},
			})
			.mockResolvedValueOnce({
				success: true,
				data: {
					markdown: [
						"# Service contracts tender calendar",
						"",
						"| Description of tender | Estimated duration of LTA/Institutional Contract | Estimated time of tender issuance |",
						"| --- | --- | --- |",
						"| LTA for Mobile Satellite Devices and Services | 5 years (3+1+1) | Q4 |",
					].join("\n"),
					links: [],
					metadata: { title: "Service contracts tender calendar" },
				},
			});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.unicef.org/supply/service-contracts-tender-calendar"],
			sourceScrapeLimit: 5,
		});

		expect(firecrawlScrapeMock).toHaveBeenCalledTimes(2);
		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(result.warnings).toEqual([]);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "LTA for Mobile Satellite Devices and Services",
			source: "unicef",
			tags: ["external-discovery", "source-scrape", "unicef", "un-procurement", "tender-calendar", "service-contract", "ict"],
		}));
	});

	it("imports UNICEF tender calendar documents as source documents", async () => {
		const documentUrl = "https://www.unicef.org/supply/media/24786/file/Medicines-Tender-Calendar-2025-2026.pdf";
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: [
					"# Tender calendars",
					"",
					"### [Medicines tender calendar 2025-2026](https://www.unicef.org/supply/documents/medicines-tender-calendar)",
					"",
					"UNICEF Supply Division publishes calendar dates for planned medicines tenders.",
					"",
					"Files available for download (1)",
					"",
					`[Medicines tender calendar 2025-2026](${documentUrl})`,
				].join("\n"),
				links: [documentUrl],
				metadata: { title: "Tender calendars" },
			},
		});
		selectResultsQueue.push([], []);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.unicef.org/supply/tender-calendars"],
			sourceScrapeLimit: 5,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			source: "unicef",
			sourcePlatform: "UNICEF Supply Division",
			sourceFile: "source:https://www.unicef.org/supply/tender-calendars",
			title: "Medicines tender calendar 2025-2026",
			category: "UNICEF tender calendar",
			rfpLink: documentUrl,
			portalUrl: "https://www.unicef.org/supply/documents/medicines-tender-calendar",
			documentUrl,
			tags: ["external-discovery", "source-scrape", "unicef", "un-procurement", "tender-calendar", "supply", "health-education"],
		}));
		expect(result.sourceDocumentsCreated).toBe(1);
		const insertBuilder = vi.mocked(db.insert).mock.results[0].value as {
			values: ReturnType<typeof vi.fn>;
		};
		expect(insertBuilder.values).toHaveBeenCalledWith(expect.objectContaining({
			documentName: "Medicines-Tender-Calendar-2025-2026.pdf",
			documentType: "rfp",
			sourceUrl: documentUrl,
		}));
	});

	it("imports AFDB configured sources with the AFDB parser", async () => {
		const documentUrl = "https://www.afdb.org/sites/default/files/documents/project-related-procurement/reoi_for_meteorology_mobile_application87.pdf";
		firecrawlScrapeMock.mockResolvedValueOnce({
			success: true,
			data: {
				markdown: [
					"* [New procurement framework](https://www.afdb.org/en/projects-and-operations/procurement/new-procurement-policy)",
					"",
					"26-May-2026",
					"",
					"[EOI - Ethiopia - Development of Meteorological and Climate Mobile Application - BREFONS-Ethiopia](https://www.afdb.org/en/documents/eoi-ethiopia-development-meteorological-and-climate-mobile-application-brefons-ethiopia)",
					"",
					"22-May-2026",
					"",
					"[Contract Awards - Angola - Individual Consultant for the Position of Entrepreneurship Specialist - AYEP](https://www.afdb.org/en/documents/contract-awards-angola-individual-consultant-position-entrepreneurship-specialist-ayep)",
				].join("\n"),
				links: [
					"https://www.afdb.org/en/projects-and-operations/procurement/new-procurement-policy",
					"https://www.afdb.org/en/documents/eoi-ethiopia-development-meteorological-and-climate-mobile-application-brefons-ethiopia",
				],
				metadata: { title: "Procurement" },
			},
		}).mockResolvedValueOnce({
			success: true,
			data: {
				markdown: [
					"# EOI - Ethiopia - Development of Meteorological and Climate Mobile Application - BREFONS-Ethiopia",
					"",
					"[](https://www.afdb.org/sites/default/files/documents/project-related-procurement/reoi_for_meteorology_mobile_application87.pdf \"Download PDF\")",
				].join("\n"),
				links: [documentUrl],
				metadata: { title: "EOI - Ethiopia - Development of Meteorological and Climate Mobile Application" },
			},
		});
		selectResultsQueue.push([], []);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.afdb.org/en/projects-and-operations/procurement"],
			sourceScrapeLimit: 5,
		});

		expect(searchSearxngMock).not.toHaveBeenCalled();
		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			source: "afdb",
			sourcePlatform: "African Development Bank",
			sourceFile: "source:https://www.afdb.org/en/projects-and-operations/procurement",
			title: "EOI - Ethiopia - Development of Meteorological and Climate Mobile Application - BREFONS-Ethiopia",
			category: "Expression of interest",
			countryRegion: "Ethiopia",
			organization: "African Development Bank",
			rfpLink: documentUrl,
			portalUrl: "https://www.afdb.org/en/documents/eoi-ethiopia-development-meteorological-and-climate-mobile-application-brefons-ethiopia",
			documentUrl,
			submissionMethod: undefined,
			tags: ["external-discovery", "source-scrape", "afdb", "development-bank", "regional-procurement"],
			metadata: expect.objectContaining({
				afdb: expect.objectContaining({
					noticePrefix: "EOI",
					language: "en",
					primaryLink: expect.objectContaining({ url: documentUrl }),
				}),
				discovery: expect.objectContaining({
					resultEngine: "firecrawl-source",
					scrapeMethod: "firecrawl",
					scrapedWithFirecrawl: true,
					sourceUrl: "https://www.afdb.org/en/projects-and-operations/procurement",
				}),
			}),
		}));
		expect(result.sourceDocumentsCreated).toBe(1);
	});

	it("recovers AFDB configured sources through SearXNG document fallback when the listing is blocked", async () => {
		const documentUrl = "https://borrower.example/procurement/afdb-reoi-mobile-data-collection.pdf";
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: "Security verification required",
				links: [],
				metadata: { title: "Just a moment" },
			},
		});
		searchSearxngMock.mockResolvedValue({
			query: "afdb procurement reoi pdf consulting services",
			number_of_results: 1,
			results: [{
				title: "AfDB REOI - Mobile data collection consulting services",
				url: documentUrl,
				content: "African Development Bank request for expressions of interest for consulting services.",
				engine: "duckduckgo",
				score: 0.92,
			}],
		});
		fetchPublicHttpUrlMock.mockResolvedValue(new Response("pdf", {
			status: 200,
			headers: { "content-type": "application/pdf" },
		}));
		selectResultsQueue.push([], []);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.afdb.org/en/projects-and-operations/procurement"],
			sourceScrapeLimit: 5,
			browserFallback: false,
		});

		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(result.warnings).toEqual([]);
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl: "https://www.afdb.org/en/projects-and-operations/procurement",
				status: "healthy",
				candidates: 1,
				warnings: 0,
			}),
		]);
		expect(searchSearxngMock).toHaveBeenCalledWith(
			"afdb procurement reoi pdf consulting services",
			expect.objectContaining({
				engines: ["google", "duckduckgo", "bing", "brave"],
				sendAcceptHeader: false,
			})
		);
		expect(fetchPublicHttpUrlMock).toHaveBeenCalledWith(
			documentUrl,
			expect.objectContaining({
				headers: expect.objectContaining({ Range: "bytes=0-1023" }),
				timeoutMs: 15000,
			}),
			"AFDB discovery fallback document probe"
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			source: "afdb",
			sourcePlatform: "African Development Bank",
			sourceFile: "source:https://www.afdb.org/en/projects-and-operations/procurement",
			title: "AfDB REOI - Mobile data collection consulting services",
			category: "Expression of interest",
			opportunityType: "eoi",
			rfpLink: documentUrl,
			documentUrl,
			tags: expect.arrayContaining(["external-discovery", "source-scrape", "afdb", "development-bank", "regional-procurement", "search-fallback"]),
			metadata: expect.objectContaining({
				afdb: expect.objectContaining({
					discoveryMethod: "searxng-document-search",
					engine: "duckduckgo",
				}),
				discovery: expect.objectContaining({
					resultEngine: "duckduckgo",
					scrapeMethod: "source_api",
					sourceUrl: "https://www.afdb.org/en/projects-and-operations/procurement",
				}),
			}),
		}));
		expect(result.sourceDocumentsCreated).toBe(1);
	});

	it("imports World Bank configured sources with the World Bank parser", async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				procnotices: [
					{
						id: "OP00428547",
						bid_description: "Contratacao de Especialista em Conectividade",
						project_ctry_name: "Angola",
						project_id: "P180693",
						project_name: "Angola Digital Acceleration Project - P180693",
						notice_type: "Request for Expression of Interest",
						notice_status: "Published",
						notice_lang_name: "Portuguese",
						noticedate: "25-May-2026",
					},
					{
						id: "OP00440000",
						bid_description: "Awarded consultant contract",
						project_ctry_name: "Kenya",
						project_name: "Awarded Project",
						notice_type: "Contract Award",
						notice_status: "Published",
						notice_lang_name: "English",
						noticedate: "25-May-2026",
					},
				],
			}),
		}).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				procnotices: [{
					id: "OP00428547",
					notice_type: "Request for Expression of Interest",
					noticedate: "25-May-2026",
					notice_lang_name: "Portuguese",
					submission_deadline_date: "2026-05-29T00:00:00Z",
					submission_deadline_time: "15:00",
					project_id: "P180693",
					project_name: "Angola Digital Acceleration Project",
					bid_reference_no: "05./C-105/COMP.1/ICS/PADA-2026/005",
					procurement_method_name: "Individual Consultant Selection",
					contact_email: "consultor.conectividade@ima.gov.ao",
					contact_organization: "Institute of Administrative Modernization",
					notice_text: "<p><strong>SOLICITACAO DE MANIFESTACAO DE INTERESSE</strong></p><p>The services include support to digital infrastructure planning and supervision.</p>",
				}],
			}),
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://projects.worldbank.org/en/projects-operations/procurement"],
			sourceScrapeLimit: 5,
		});

		expect(searchSearxngMock).not.toHaveBeenCalled();
		expect(firecrawlScrapeMock).not.toHaveBeenCalled();
		expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining("https://search.worldbank.org/api/v2/procnotices?"), expect.objectContaining({
			headers: { Accept: "application/json" },
		}));
		expect(fetchMock).toHaveBeenNthCalledWith(2, "https://search.worldbank.org/api/procnotices?format=json&apilang=en&id=OP00428547", expect.objectContaining({
			headers: { Accept: "application/json" },
		}));
		expect(result.results).toEqual({
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			source: "world_bank",
			sourcePlatform: "World Bank",
			sourceFile: "source:https://projects.worldbank.org/en/projects-operations/procurement",
			sourceId: "OP00428547",
			title: "Contratacao de Especialista em Conectividade",
			category: "Request for Expression of Interest",
			countryRegion: "Angola",
			organization: "Institute of Administrative Modernization",
			deadline: new Date(Date.parse("May 29, 2026 15:00")),
			publishedDate: new Date(2026, 4, 25),
			submissionMethod: "Individual Consultant Selection",
			projectSummary: expect.stringContaining("digital infrastructure planning"),
			rfpLink: "https://projects.worldbank.org/en/projects-operations/procurement-detail/OP00428547",
			portalUrl: "https://projects.worldbank.org/en/projects-operations/procurement-detail/OP00428547",
			documentUrl: "https://projects.worldbank.org/en/projects-operations/procurement-detail/OP00428547",
			tags: ["external-discovery", "source-scrape", "world-bank", "development-bank", "global-procurement", "api-list"],
			metadata: expect.objectContaining({
				worldBank: expect.objectContaining({
					projectTitle: "Angola Digital Acceleration Project",
					noticeType: "Request for Expression of Interest",
					projectId: "P180693",
					borrowerBidReference: "05./C-105/COMP.1/ICS/PADA-2026/005",
					procurementMethod: "Individual Consultant Selection",
					contactEmail: "consultor.conectividade@ima.gov.ao",
				}),
				discovery: expect.objectContaining({
					scrapeMethod: "source_api",
					scrapedWithFirecrawl: false,
					sourceUrl: "https://projects.worldbank.org/en/projects-operations/procurement",
				}),
			}),
		}));
		expect(result.sourceDocumentsCreated).toBe(1);
	});
});
