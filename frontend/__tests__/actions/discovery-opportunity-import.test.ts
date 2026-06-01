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
	delete process.env.NRC_TENDER_MAX_PAGES;
	delete process.env.NRC_TENDER_DETAIL_LIMIT;
	delete process.env.CONTRACTS_FINDER_MAX_API_PAGES;
	delete process.env.FIND_TENDER_MAX_API_PAGES;
	delete process.env.GRANTS_GOV_MAX_API_PAGES;
	delete process.env.CANADABUYS_MAX_PAGES;
	delete process.env.CANADABUYS_DETAIL_LIMIT;
	delete process.env.GETS_MAX_PAGES;
	delete process.env.GETS_DETAIL_LIMIT;
	delete process.env.TRADEMARK_AFRICA_DETAIL_LIMIT;
	delete process.env.BOAD_PAGE_LIMIT;
	delete process.env.BOAD_DETAIL_LIMIT;
	delete process.env.ECREEE_PAGE_LIMIT;
	delete process.env.ECREEE_DETAIL_LIMIT;
	delete process.env.ISDB_PAGE_LIMIT;
	delete process.env.ISDB_DETAIL_LIMIT;
	delete process.env.CONFIGURED_SOURCE_DETAIL_LIMIT;
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

	it("paginates search engines when broad acquisition requests deeper result pages", async () => {
		searchSearxngMock.mockImplementation(async (_query: string, options: { engines?: string[]; page?: number }) => {
			const engine = options.engines?.[0] ?? "searxng";
			const page = options.page ?? 1;
			return {
				results: [
					{
						title: `${engine} page ${page} Request for Proposals: Case platform`,
						url: `https://${engine}.example.org/tenders/case-platform-page-${page}`,
						content: "RFP for a case platform with a submission deadline.",
						engine,
						score: 10,
						category: "general",
					},
				],
			};
		});
		selectResultsQueue.push([], []);

		const result = await discoverAndImportOpportunities({
			query: "case platform RFP",
			engines: ["google"],
			searchPages: 2,
			limitPerQuery: 5,
		});

		expect(result.results).toMatchObject({ total: 2, imported: 2, failed: 0 });
		expect(searchSearxngMock).toHaveBeenCalledTimes(2);
		expect(searchSearxngMock).toHaveBeenNthCalledWith(1, "case platform RFP", expect.objectContaining({
			engines: ["google"],
			page: undefined,
		}));
		expect(searchSearxngMock).toHaveBeenNthCalledWith(2, "case platform RFP", expect.objectContaining({
			engines: ["google"],
			page: 2,
		}));
		expect(createOpportunityMock).toHaveBeenCalledTimes(2);
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
				{
					title: "tender - English-French translation",
					url: "https://context.reverso.net/translation/english-french/tender",
					content: "Translation examples for tender, procurement, and proposal deadline.",
					engine: "bing",
					score: 9,
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

	it("rejects anti-bot interstitial search hits before import", async () => {
		searchSearxngMock.mockResolvedValue({
			results: [
				{
					title: "Just a moment...",
					url: "https://blocked.example/request-for-proposals",
					content: "Checking your browser before accessing request for proposals with a submission deadline.",
					engine: "google",
					score: 12,
					category: "general",
				},
			],
		});

		const result = await discoverAndImportOpportunities({
			query: "\"request for proposals\" \"submission deadline\"",
			scrapeTopResults: false,
		});

		expect(result.results).toMatchObject({ total: 0, imported: 0, failed: 0 });
		expect(createOpportunityMock).not.toHaveBeenCalled();
		expect(firecrawlScrapeMock).not.toHaveBeenCalled();
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

	it("routes IDB procurement pages through the official datastore parser", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 4, 31));
		searchSearxngMock.mockResolvedValue({ results: [] });
		fetchMock.mockResolvedValue(new Response(JSON.stringify({
			success: true,
			result: {
				records: [
					{
						noticeid: "37854",
						type: "SPECIFIC",
						countryname: "BOLIVIA",
						projectnumber: "BO-L1198",
						proyecturl: "https://www.iadb.org/en/project/BO-L1198",
						loannumber: "4612/BL-BO-1",
						noticetitle: "DISENO E IMPLEMENTACION DEL SISTEMA INTEGRADO DE GESTION CLINICA",
						ezshareid: "EZIDB0000120-1657487614-11094",
						documenturl: "https://idbdocs.iadb.org/wsdocs/getdocument.aspx?docnum=EZIDB0000120-1657487614-11094",
						projectname: "Programa de Mejora en la Accesibilidad a los Servicios de Salud Materna y Neonatal en Bolivia",
						publicationdate: "2026-05-28 08:00:00.000000000",
						deadline: "2026-08-14",
						sectorenglnm: "HEALTH",
						category_nm: "Non-Consulting Services",
						prcrmnt_mthd_engl_nm: "International Competitive Bidding",
						process_id: "BO-L1198-P00285",
						process_desc: "Implementation services for the clinical management system",
					},
					{
						noticeid: "37853",
						type: "AWARD",
						noticetitle: "Contract award should not import",
						deadline: "2026-08-14",
					},
				],
			},
		}), { status: 200, headers: { "content-type": "application/json" } }));
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.iadb.org/en/how-we-can-work-together/procurement/procurement-projects/procurement-notices"],
			sourceScrapeLimit: 5,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(firecrawlScrapeMock).not.toHaveBeenCalled();
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("https://data.iadb.org/api/3/action/datastore_search"),
			expect.any(Object)
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "DISENO E IMPLEMENTACION DEL SISTEMA INTEGRADO DE GESTION CLINICA",
			source: "idb",
			sourceId: "idb-37854",
			sourcePlatform: "Inter-American Development Bank",
			portalUrl: "https://www.iadb.org/en/project/BO-L1198",
			documentUrl: "https://idbdocs.iadb.org/wsdocs/getdocument.aspx?docnum=EZIDB0000120-1657487614-11094",
			sourceFile: "source:https://www.iadb.org/en/how-we-can-work-together/procurement/procurement-projects/procurement-notices",
			opportunityType: "tender",
			tags: expect.arrayContaining(["external-discovery", "source-scrape", "idb", "iadb", "development-bank", "source-documents"]),
		}));
		expect(result.sourceDocumentsCreated).toBe(1);
	});

	it("routes UK Find a Tender configured sources through the public OCDS parser", async () => {
		process.env.FIND_TENDER_MAX_API_PAGES = "1";
		searchSearxngMock.mockResolvedValue({ results: [] });
		fetchMock.mockResolvedValue(new Response(JSON.stringify({
			releases: [{
				ocid: "ocds-h6vhtk-06abcd",
				id: "051999-2099",
				date: "2099-05-29T16:10:39+01:00",
				tag: ["tender"],
				initiationType: "tender",
				tender: {
					id: "ocds-h6vhtk-06abcd",
					title: "Digital case management platform",
					status: "active",
					classification: {
						id: "72262000",
						description: "Software development services",
					},
					mainProcurementCategory: "services",
					description: "Procurement of a case management platform and implementation services.",
					value: {
						amount: 2500000,
						currency: "GBP",
					},
					procurementMethod: "open",
					procurementMethodDetails: "Open procedure",
					submissionMethod: ["electronicSubmission"],
					submissionMethodDetails: "https://buyer.example/tenders/case-platform",
					tenderPeriod: {
						startDate: "2099-05-29T16:10:39+01:00",
						endDate: "2099-07-13T12:00:00+01:00",
					},
				},
				buyer: {
					id: "GB-FTS-1",
					name: "Digital Services Authority",
				},
				parties: [{
					id: "GB-FTS-1",
					name: "Digital Services Authority",
					roles: ["buyer"],
					address: {
						countryName: "United Kingdom",
					},
					contactPoint: {
						email: "procurement@example.gov.uk",
						url: "https://buyer.example/tenders",
					},
				}],
			}],
		}), { status: 200, headers: { "content-type": "application/json" } }));
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?limit=100&stages=tender"],
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
		expect(firecrawlScrapeMock).not.toHaveBeenCalled();
		expect(fetchMock).toHaveBeenCalledWith(
			"https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?limit=100&stages=tender",
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: "application/json",
				}),
			})
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Digital case management platform",
			source: "find_tender",
			sourcePlatform: "UK Find a Tender",
			sourceFile: "source:https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?limit=100&stages=tender",
			rfpLink: "https://buyer.example/tenders/case-platform",
			portalUrl: "https://www.find-tender.service.gov.uk/Notice/051999-2099",
			tags: ["external-discovery", "source-scrape", "find-tender", "uk", "public-procurement", "ocds", "source-api"],
		}));
		expect(result.sourceDocumentsCreated).toBe(1);
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl: "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?limit=100&stages=tender",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
		]);
	});

	it("routes UK Contracts Finder configured sources through the public OCDS parser", async () => {
		process.env.CONTRACTS_FINDER_MAX_API_PAGES = "1";
		searchSearxngMock.mockResolvedValue({ results: [] });
		fetchMock.mockResolvedValue(new Response(JSON.stringify({
			releases: [{
				ocid: "ocds-b5fd17-07ec2535-27cf-4ca2-86e0-3298e6c1b3af",
				id: "5f8725b0-d8ae-49a5-93a1-978d948733b3-899683",
				date: "2099-05-29T15:09:40+01:00",
				tag: ["tender"],
				initiationType: "tender",
				tender: {
					id: "Digital assessments for businesses",
					title: "The Delivery of a Digital Assessment to Action Programme",
					description: "Provide small businesses with a digital assessment and action plan.",
					datePublished: "2099-05-19T12:04:39+01:00",
					status: "active",
					classification: {
						scheme: "CPV",
						id: "72000000",
						description: "IT services: consulting, software development, Internet and support",
					},
					value: {
						amount: 10000,
						currency: "GBP",
					},
					procurementMethod: "open",
					procurementMethodDetails: "Open procedure",
					tenderPeriod: {
						endDate: "2099-06-08T09:00:00+01:00",
					},
					mainProcurementCategory: "services",
					documents: [
						{
							id: "1",
							documentType: "tenderNotice",
							description: "Opportunity notice on Contracts Finder",
							url: "https://www.contractsfinder.service.gov.uk/Notice/5f8725b0-d8ae-49a5-93a1-978d948733b3",
							format: "text/html",
						},
						{
							id: "2",
							documentType: "technicalSpecifications",
							description: "Specification",
							url: "https://www.contractsfinder.service.gov.uk/Notice/Attachment/01ac2251-35eb-4dbb-b0e1-0de57ddee11b",
							format: "application/pdf",
						},
					],
				},
				parties: [{
					id: "GB-CFS-1",
					name: "Winchester City Council",
					roles: ["buyer"],
					address: {
						countryName: "England",
					},
					contactPoint: {
						name: "Emily Reason",
						email: "ereason@example.gov.uk",
					},
				}],
				buyer: {
					id: "GB-CFS-1",
					name: "Winchester City Council",
				},
			}],
		}), { status: 200, headers: { "content-type": "application/json" } }));
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?limit=100&stages=tender"],
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
		expect(firecrawlScrapeMock).not.toHaveBeenCalled();
		expect(fetchMock).toHaveBeenCalledWith(
			"https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?limit=100&stages=tender",
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: "application/json",
				}),
			})
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "The Delivery of a Digital Assessment to Action Programme",
			source: "contracts_finder",
			sourcePlatform: "UK Contracts Finder",
			sourceFile: "source:https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?limit=100&stages=tender",
			rfpLink: "https://www.contractsfinder.service.gov.uk/Notice/Attachment/01ac2251-35eb-4dbb-b0e1-0de57ddee11b",
			portalUrl: "https://www.contractsfinder.service.gov.uk/Notice/5f8725b0-d8ae-49a5-93a1-978d948733b3",
			tags: ["external-discovery", "source-scrape", "contracts-finder", "uk", "public-procurement", "ocds", "source-api"],
		}));
		expect(result.sourceDocumentsCreated).toBe(1);
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl: "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?limit=100&stages=tender",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
		]);
	});

	it("routes Grants.gov configured sources through the public search API parser", async () => {
		process.env.GRANTS_GOV_MAX_API_PAGES = "1";
		searchSearxngMock.mockResolvedValue({ results: [] });
		const sourceUrl = "https://micro.grants.gov/rest/opportunities/search?rows=100&oppStatuses=forecasted%7Cposted";
		fetchMock.mockResolvedValue(new Response(JSON.stringify({
			hitCount: 1,
			oppHits: [{
				id: "362584",
				number: "PDS-LUSAKA-AMSPACES-FY26",
				title: "American Spaces Administrative Funds Management 2026",
				agencyCode: "DOS-ZAM",
				agency: "U.S. Mission to Zambia",
				openDate: "05/29/2099",
				closeDate: "06/20/2099",
				oppStatus: "posted",
				cfdaList: ["19.441"],
				awardCeiling: "250000",
			}],
		}), { status: 200, headers: { "content-type": "application/json" } }));
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: [sourceUrl],
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
		expect(firecrawlScrapeMock).not.toHaveBeenCalled();
		expect(fetchMock).toHaveBeenCalledWith(
			sourceUrl,
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Accept: "application/json",
					"Content-Type": "application/json",
				}),
				body: expect.any(String),
			})
		);
		expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
			rows: 100,
			startRecordNum: 0,
			oppStatuses: "forecasted|posted",
		});
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "American Spaces Administrative Funds Management 2026",
			source: "grants_gov",
			sourceId: "grants-gov-362584",
			sourcePlatform: "Grants.gov",
			sourceFile: `source:${sourceUrl}`,
			rfpLink: "https://www.grants.gov/search-results-detail/362584",
			portalUrl: "https://www.grants.gov/search-results-detail/362584",
			documentUrl: "https://www.grants.gov/search-results-detail/362584",
			opportunityType: "grant",
			tags: ["external-discovery", "source-scrape", "grants-gov", "us-federal", "grant", "source-api"],
		}));
		expect(result.sourceDocumentsCreated).toBe(1);
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl,
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
		]);
	});

	it("routes CanadaBuys configured sources through the open tender parser with source documents", async () => {
		process.env.CANADABUYS_MAX_PAGES = "1";
		process.env.CANADABUYS_DETAIL_LIMIT = "5";
		searchSearxngMock.mockResolvedValue({ results: [] });
		const sourceUrl = "https://canadabuys.canada.ca/en/tender-opportunities?status%5B0%5D=87&items_per_page=50";
		fetchMock
			.mockResolvedValueOnce(new Response(`
				<table>
					<tbody>
						<tr>
							<td class="views-field views-field-dummy-notice-title">
								<a href="/en/tender-opportunities/tender-notice/cb-900-58930369">Low Bandwidth Mesh Solution with Satellite Connectivity</a>
							</td>
							<td class="views-field views-field-field-term-label-1-1">Goods</td>
							<td class="views-field views-field-field-term-label-1-1">2099/05/30</td>
							<td class="views-field views-field-field-tender-closing-date">2099/06/22</td>
							<td class="views-field views-field-field-tender-organization"><span>Royal Canadian Mounted Police (RCMP)</span></td>
						</tr>
					</tbody>
				</table>
			`, { status: 200, headers: { "content-type": "text/html" } }))
			.mockResolvedValueOnce(new Response(`
				<div class="field field--name-field-tender-solicitation-number field--type-string field--label-above">
					<span class="field--item display-flex">202604242/A</span>
				</div>
				<div class="field field--name-field-tender-publication-date field--type-datetime field--label-above">
					<span class="field--item display-flex"><time datetime="2099-05-30T12:00:00Z">2099/05/30</time></span>
				</div>
				<div class="closing-date-field">
					<span class="dateclass">2099/06/22</span>
					<span class="timeclass">17:00 EDT</span>
				</div>
				<div class="field field--name-body field--type-text-with-summary field--label-hidden h-600-overflow-h tender-detail-description field--item">
					<p>Description:<br />The RCMP requires satellite-enabled communications devices.</p>
					<p>Tenders must be submitted to the RCMP Bid Receiving Unit at: <a href="mailto:E_Pacific_Bids@example.gc.ca">E_Pacific_Bids@example.gc.ca</a></p>
				</div>
				<div class="field field--name-field-tender-contact-orgname field--type-string field--label-hidden field--item">Royal Canadian Mounted Police (RCMP)</div>
				<table class="tender-documents-table">
					<tr>
						<td class="field-document_link"><a href="https://canadabuys.canada.ca/sites/default/files/webform/tender_notice/96751/en_202604242a_low-bandwidth-mesh-solution.pdf">EN_202604242A_Low Bandwidth Mesh Solution.pdf</a></td>
					</tr>
					<tr>
						<td class="field-document_link"><a href="/sites/default/files/webform/tender_notice/96751/annex-f-form.xlsx">Annex F Form.xlsx</a></td>
					</tr>
				</table>
			`, { status: 200, headers: { "content-type": "text/html" } }));
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: [sourceUrl],
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
		expect(firecrawlScrapeMock).not.toHaveBeenCalled();
		expect(fetchMock).toHaveBeenNthCalledWith(1, sourceUrl, expect.objectContaining({
			headers: expect.objectContaining({
				Accept: expect.stringContaining("text/html"),
				"Accept-Language": "en-US,en;q=0.9",
			}),
		}));
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://canadabuys.canada.ca/en/tender-opportunities/tender-notice/cb-900-58930369",
			expect.any(Object)
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Low Bandwidth Mesh Solution with Satellite Connectivity",
			source: "canada_buys",
			sourceId: "canadabuys-202604242-a",
			noticeId: "202604242/A",
			sourcePlatform: "CanadaBuys",
			sourceFile: `source:${sourceUrl}`,
			rfpLink: "https://canadabuys.canada.ca/sites/default/files/webform/tender_notice/96751/en_202604242a_low-bandwidth-mesh-solution.pdf",
			portalUrl: "https://canadabuys.canada.ca/en/tender-opportunities/tender-notice/cb-900-58930369",
			documentUrl: "https://canadabuys.canada.ca/sites/default/files/webform/tender_notice/96751/en_202604242a_low-bandwidth-mesh-solution.pdf",
			tags: ["external-discovery", "source-scrape", "canadabuys", "canada", "public-procurement", "source-documents"],
		}));
		expect(result.sourceDocumentsCreated).toBe(2);
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl,
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
		]);
	});

	it("routes New Zealand GETS configured sources through the current tender parser", async () => {
		process.env.GETS_MAX_PAGES = "1";
		process.env.GETS_DETAIL_LIMIT = "5";
		searchSearxngMock.mockResolvedValue({ results: [] });
		const sourceUrl = "https://www.gets.govt.nz/ExternalIndex.htm?orderBy=date";
		fetchMock
			.mockResolvedValueOnce(new Response(`
				<table>
					<tbody>
						<tr id="tender-34016603" class="tender blueRow">
							<td><a href="MSD/ExternalTenderDetails.htm?id=34016603">34016603</a></td>
							<td><a href="MSD/ExternalTenderDetails.htm?id=34016603">12802</a></td>
							<td><a href="MSD/ExternalTenderDetails.htm?id=34016603">Debt Collection Services - RFP</a></td>
							<td><abbr title="Request for Proposals">RFP</abbr></td>
							<td>12:00 PM 3 Jun 2099 (Pacific/Auckland UTC+12:00)</td>
							<td>Ministry of Social Development</td>
						</tr>
					</tbody>
				</table>
			`, { status: 200, headers: { "content-type": "text/html" } }))
			.mockResolvedValueOnce(new Response(`
				<table id="tender-details-info-tbl">
					<tr><td class="label-cell">RFx ID&nbsp;:</td><td>34016603</td></tr>
					<tr><td class="label-cell">Reference #&nbsp;:</td><td>12802</td></tr>
					<tr><td class="label-cell">Close Date&nbsp;:</td><td>12:00 PM 3 Jun 2099 (Pacific/Auckland UTC+12:00)</td></tr>
					<tr><td class="label-cell">Tender Type&nbsp;:</td><td>Request for Proposals (RFP)</td></tr>
					<tr><td class="label-cell">Categories&nbsp;:</td><td>Finance and Insurance Services; Debt collection services</td></tr>
					<tr><td class="label-cell">Regions&nbsp;:</td><td>Auckland; Wellington</td></tr>
					<tr><td class="label-cell">Contact&nbsp;:</td><td>All submissions to be made through the GETS website</td></tr>
				</table>
			`, { status: 200, headers: { "content-type": "text/html" } }));
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: [sourceUrl],
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
		expect(firecrawlScrapeMock).not.toHaveBeenCalled();
		expect(fetchMock).toHaveBeenNthCalledWith(1, sourceUrl, expect.objectContaining({
			headers: expect.objectContaining({
				Accept: expect.stringContaining("text/html"),
				"Accept-Language": "en-NZ,en;q=0.9",
			}),
		}));
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://www.gets.govt.nz/MSD/ExternalTenderDetails.htm?id=34016603",
			expect.any(Object)
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Debt Collection Services - RFP",
			source: "new_zealand_gets",
			sourceId: "gets-34016603",
			noticeId: "12802",
			sourcePlatform: "New Zealand GETS",
			sourceFile: `source:${sourceUrl}`,
			rfpLink: "https://www.gets.govt.nz/MSD/ExternalTenderDetails.htm?id=34016603",
			portalUrl: "https://www.gets.govt.nz/MSD/ExternalTenderDetails.htm?id=34016603",
			documentUrl: "https://www.gets.govt.nz/MSD/ExternalTenderDetails.htm?id=34016603",
			countryRegion: "New Zealand - Auckland; Wellington",
			tags: ["external-discovery", "source-scrape", "gets", "new-zealand", "public-procurement", "source-documents"],
		}));
		expect(result.sourceDocumentsCreated).toBe(1);
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl,
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
		]);
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

	it("imports IsDB project procurement notices with linked source documents", async () => {
		process.env.ISDB_PAGE_LIMIT = "1";
		process.env.ISDB_DETAIL_LIMIT = "1";
		searchSearxngMock.mockResolvedValue({ results: [] });
		fetchMock.mockImplementation(async (url: string) => {
			if (url === "https://www.isdb.org/project-procurement/tenders") {
				return new Response(`
					<article role="article" about="/project-procurement/tenders/2099/eoi/bcc2099-001-digital-health-platform" data-nid="9901" class="display-teaser teaser type-tender">
						<div class="field-title mt-4"><h2><a href="/project-procurement/tenders/2099/eoi/bcc2099-001-digital-health-platform">BCC2099-001 - Digital Health Platform Evaluation</a></h2></div>
						<div class="field field--name-field-tender-status field--type-entity-reference field--label-hidden field--item"><div>Active</div></div>
						<div class="field field--name-field-tender-type field--type-entity-reference field--label-hidden field--item"><div>Expression of Interest</div></div>
						<div class="field field--name-field-world-country field--type-entity-reference field--label-hidden field--item">Nigeria</div>
						<div class="field field--name-field-close-date field--type-datetime field--label-hidden field--item"><time datetime="00Z">24 August 2099</time></div>
					</article>
					<article role="article" about="/project-procurement/tenders/2099/contract-award/closed-award" data-nid="9902" class="display-teaser teaser type-tender">
						<div class="field-title mt-4"><h2><a href="/project-procurement/tenders/2099/contract-award/closed-award">Closed Award</a></h2></div>
						<div class="field field--name-field-tender-type field--type-entity-reference field--label-hidden field--item"><div>Contract Award</div></div>
					</article>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			if (url === "https://www.isdb.org/project-procurement/tenders/2099/eoi/bcc2099-001-digital-health-platform") {
				return new Response(`
					<div class="field field--name-field-notice-type field--type-entity-reference field--label-inline"><div class="field--label">Notice Type</div><div class="field--item">International Competitive Bidding</div></div>
					<div class="field field--name-field-issue-date field--type-datetime field--label-inline"><div class="field--label">Issue Date</div><div class="field--item"><time datetime="2099-08-07T12:00:00Z">7 August 2099</time></div></div>
					<div class="field field--name-field-close-date field--type-datetime field--label-inline"><div class="field--label">Last date of submission</div><div class="field--item"><time datetime="2099-08-24T12:00:00Z">24 August 2099</time></div></div>
					<div class="field field--name-field-tender-type field--type-entity-reference field--label-inline"><div class="field--label">Tender Type</div><div class="field--item">Expression of Interest</div></div>
					<div class="field field--name-field-documents field--type-file field--label-inline"><div class="field--label">Documents</div><div class="field--items"><div class="field--item"><a href="/project-procurement/sites/pproc/files/2099-08/ToR-Digital-Health.pdf">ToR Digital Health.pdf</a></div></div></div>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			return new Response("not found", { status: 404 });
		});

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.isdb.org/project-procurement/tenders"],
			sourceScrapeLimit: 5,
			browserFallback: false,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(1);
		expect(firecrawlScrapeMock).not.toHaveBeenCalled();
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "BCC2099-001 - Digital Health Platform Evaluation",
			source: "isdb",
			sourceId: "isdb-9901",
			sourcePlatform: "Islamic Development Bank",
			sourceFile: "source:https://www.isdb.org/project-procurement/tenders",
			opportunityType: "eoi",
			countryRegion: "Nigeria",
			documentUrl: "https://www.isdb.org/project-procurement/sites/pproc/files/2099-08/ToR-Digital-Health.pdf",
			tags: ["external-discovery", "source-scrape", "isdb", "development-bank", "global-south", "project-procurement", "source-documents"],
		}));
	});

	it("imports AUDA-NEPAD tender notices through Firecrawl with linked source documents", async () => {
		searchSearxngMock.mockResolvedValue({ results: [] });
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				html: `
					<div class="views-row">
						<h3 class="views-field views-field-title"><span class="field-content">Expression of Interest for Africa Medicine Agency (AMA) Technical Committees</span></h3>
						<div class="views-field views-field-nothing"><span class="event-label">Deadline: </span><time datetime="00Z">June 18, 2099</time></div>
						<div class="views-field views-field-nothing-1">
							<a href="/file-download/download/public/231726" title="EN - Expression of Interest for AMA TCs_10MAY2026 RB.pdf">Download File</a>
						</div>
						<div class="views-field views-field-body detail-body"><div class="field-content">
							<p>Applications should be submitted to dg@au-ama.africa before the deadline.</p>
						</div></div>
					</div>
				`,
				markdown: "",
				links: ["https://www.nepad.org/file-download/download/public/231726"],
				metadata: {
					title: "Tenders | AUDA-NEPAD",
					description: "AUDA-NEPAD tender notices.",
				},
			},
		});

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.nepad.org/tenders"],
			sourceScrapeLimit: 5,
			browserFallback: false,
		});

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(1);
		expect(firecrawlScrapeMock).toHaveBeenCalledWith("https://www.nepad.org/tenders", expect.objectContaining({
			formats: ["markdown", "html", "links"],
		}));
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Expression of Interest for Africa Medicine Agency (AMA) Technical Committees",
			source: "auda_nepad",
			sourceId: "auda-nepad-expression-of-interest-for-a-44d561a9d2",
			sourcePlatform: "African Union Development Agency",
			sourceFile: "source:https://www.nepad.org/tenders",
			opportunityType: "eoi",
			countryRegion: "Africa",
			documentUrl: "https://www.nepad.org/file-download/download/public/231726",
			rfpLink: "https://www.nepad.org/file-download/download/public/231726",
			tags: ["external-discovery", "source-scrape", "auda-nepad", "african-union", "africa", "source-documents"],
			metadata: expect.objectContaining({
				audaNepad: expect.objectContaining({
					contactEmail: "dg@au-ama.africa",
					documentLinks: [
						{
							label: "EN - Expression of Interest for AMA TCs_10MAY2026 RB.pdf",
							url: "https://www.nepad.org/file-download/download/public/231726",
						},
					],
				}),
			}),
		}));
	});

	it("imports Africa CDC supply-chain opportunities through Firecrawl", async () => {
		process.env.CONFIGURED_SOURCE_DETAIL_LIMIT = "1";
		searchSearxngMock.mockResolvedValue({ results: [] });
		firecrawlScrapeMock.mockImplementation(async (url: string) => {
			if (url === "https://africacdc.org/supply-chain-division/opportunities/") {
				return {
					success: true,
					data: {
						html: `
							<div class="row" style="margin-bottom:30px;padding-bottom:30px;border-bottom: 1px solid #ececec;">
								<div class="col-md-6"><strong><a href="https://africacdc.org/opportunity/consultancy-to-scaling-of-the-africa-cdc-continental-public-health-data-intelligence-hdi/">Consultancy to Scaling of the Africa CDC Continental Public Health Data Intelligence (HDI)</a></strong></div>
								<div class="col-md-2">7 July 2099</div>
								<div class="col-md-2">RFP No. ACDC/SDI/CS/02</div>
								<div class="col-md-2">Consultancy Services</div>
							</div>
							<div class="row" style="margin-bottom:30px;padding-bottom:30px;border-bottom: 1px solid #ececec;">
								<div class="col-md-6"><strong><a href="https://africacdc.org/opportunity/open-call-for-expression-of-interest-experts-to-serve-on-the-technical-committees-of-the-african-medicines-agency/">Open Call for Expression of Interest: Experts to Serve on the Technical Committees of the African Medicines Agency</a></strong></div>
								<div class="col-md-2">18 June 2099</div>
								<div class="col-md-2">N/A</div>
								<div class="col-md-2">Call for Expression of Interest</div>
							</div>
						`,
						markdown: "",
						links: [],
						metadata: {
							title: "Opportunities - Africa CDC",
							description: "Current opportunities listed under the Africa CDC Supply Chain Division",
						},
					},
				};
			}
			return {
				success: true,
				data: {
					html: `
						<h5 class="elementor-heading-title elementor-size-default"><span>Request for Proposals</span></h5>
						<h1 class="elementor-heading-title elementor-size-default">Consultancy to Scaling of the Africa CDC Continental Public Health Data Intelligence (HDI)</h1>
						<div class="elementor-widget-theme-post-content"><div class="elementor-widget-container">
							<p><strong>Submission Deadline:</strong> July 7, 2099,<br><strong>Submission Email:</strong> <a href="mailto:procurement@africacdc.org">procurement@africacdc.org</a></p>
						</div></div>
						<h5 class="elementor-heading-title elementor-size-default">Deadline</h5>
						<h3 class="elementor-heading-title elementor-size-default">7 July 2099</h3>
						<h5 class="elementor-heading-title elementor-size-default">Bid Number</h5>
						<h3 class="elementor-heading-title elementor-size-default">RFP No. ACDC/SDI/CS/02</h3>
						<a class="elementor-button" href="https://africacdc.org/wp-content/uploads/2099/05/PROCUREMENT-NOTICE-26-May-2099.pdf">Download bid document</a>
					`,
					markdown: "",
					links: ["https://africacdc.org/wp-content/uploads/2099/05/PROCUREMENT-NOTICE-26-May-2099.pdf"],
					metadata: {
						title: "Africa CDC HDI RFP",
					},
				},
			};
		});

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://africacdc.org/supply-chain-division/opportunities/"],
			sourceScrapeLimit: 5,
			browserFallback: false,
		});

		expect(result.results).toMatchObject({ total: 2, imported: 2, failed: 0 });
		expect(result.sourceDocumentsCreated).toBe(1);
		expect(firecrawlScrapeMock).toHaveBeenCalledWith(
			"https://africacdc.org/opportunity/consultancy-to-scaling-of-the-africa-cdc-continental-public-health-data-intelligence-hdi/",
			expect.objectContaining({ formats: ["markdown", "html", "links"] })
		);
		expect(createOpportunityMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
			title: "Consultancy to Scaling of the Africa CDC Continental Public Health Data Intelligence (HDI)",
			source: "africa_cdc",
			sourceId: "africa-cdc-rfp-no-acdc-sdi-cs-02",
			sourcePlatform: "Africa CDC",
			sourceFile: "source:https://africacdc.org/supply-chain-division/opportunities/",
			opportunityType: "rfp",
			countryRegion: "Africa",
			documentUrl: "https://africacdc.org/wp-content/uploads/2099/05/PROCUREMENT-NOTICE-26-May-2099.pdf",
			rfpLink: "https://africacdc.org/wp-content/uploads/2099/05/PROCUREMENT-NOTICE-26-May-2099.pdf",
			tags: ["external-discovery", "source-scrape", "africa-cdc", "african-union", "africa", "health-procurement"],
			metadata: expect.objectContaining({
				africaCdc: expect.objectContaining({
					reference: "RFP No. ACDC/SDI/CS/02",
					bidType: "Request for Proposals",
					submissionEmail: "procurement@africacdc.org",
					documentLinks: [
						{
							label: "Download bid document",
							url: "https://africacdc.org/wp-content/uploads/2099/05/PROCUREMENT-NOTICE-26-May-2099.pdf",
						},
					],
				}),
			}),
		}));
		expect(createOpportunityMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
			source: "africa_cdc",
			sourceId: expect.stringMatching(/^africa-cdc-open-call-for-expression/),
			opportunityType: "eoi",
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
			"http://84.247.181.100:3003/scrape",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					url: "https://blocked.example.com/tender/records-platform",
					formats: ["markdown", "html", "links"],
					timeout: 15000,
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
				source: "iom",
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
			source: "nest_tanzania",
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
			source: "maneps_malawi",
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
			source: "cpbn_namibia",
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
			source: "esppra_eswatini",
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
			source: "nocopo_nigeria",
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
			source: "ceb_mauritius",
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
							<span class="file"><a href="https://au.int/sites/default/files/bids/46431-TECHNICAL_SPECIFICATIONS.pdf" type="application/pdf">Technical Specifications</a></span>
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
			source: "african_union",
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
					documentLinks: expect.arrayContaining([
						expect.objectContaining({
							url: "https://au.int/sites/default/files/bids/46431-BIDDING_DOCUMENT_22_May_2026.pdf",
						}),
						expect.objectContaining({
							label: "Technical Specifications",
							url: "https://au.int/sites/default/files/bids/46431-TECHNICAL_SPECIFICATIONS.pdf",
						}),
					]),
				}),
				africanUnion: expect.objectContaining({
					bidNumber: "ET-AUC-545691-GO-RFB",
					documentLinks: [expect.objectContaining({
						url: "https://au.int/sites/default/files/bids/46431-BIDDING_DOCUMENT_22_May_2026.pdf",
					}), expect.objectContaining({
						url: "https://au.int/sites/default/files/bids/46431-TECHNICAL_SPECIFICATIONS.pdf",
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

	it("times out a stalled configured source and continues to later sources", async () => {
		process.env.CONFIGURED_SOURCE_DISCOVERY_TIMEOUT_MS = "5";
		firecrawlScrapeMock
			.mockImplementationOnce(() => new Promise(() => undefined))
			.mockResolvedValueOnce({
				success: true,
				data: {
					markdown: "[RFP for Case Platform](https://buyer.example/tenders/case)\n\nDeadline: 31 December 2026",
					links: ["https://buyer.example/tenders/case"],
					metadata: { title: "Buyer Tenders" },
				},
			});
		selectResultsQueue.push([]);

		try {
			const result = await discoverAndImportOpportunities({
				sourceUrls: ["https://slow.example/tenders", "https://buyer.example/tenders"],
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
					query: "source:https://slow.example/tenders",
					message: expect.stringContaining("Configured source discovery timed out"),
				}),
			]);
			expect(result.sourceHealth).toEqual([
				expect.objectContaining({
					sourceUrl: "https://slow.example/tenders",
					status: "failed",
					candidates: 0,
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
				title: "RFP for Case Platform",
				sourceFile: "source:https://buyer.example/tenders",
			}));
		} finally {
			delete process.env.CONFIGURED_SOURCE_DISCOVERY_TIMEOUT_MS;
		}
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
			source: "ghaneps",
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
			source: "etenders_sa",
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
			"http://84.247.181.100:3003/scrape",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					url: "https://buyer.example/tenders",
					formats: ["markdown", "html", "links"],
					timeout: 15000,
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

	it("uses direct HTTP fallback for static configured sources when Firecrawl returns bot protection", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: "Captcha Page\n\nPlease solve this CAPTCHA",
				html: "<h1>Captcha Page</h1>",
				links: [],
				metadata: {
					title: "Radware Captcha Page",
				},
			},
		});
		fetchPublicHttpUrlMock.mockResolvedValue(new Response(`
			<div class="search-result">
				<span>Tender Notice </span>
				<a class="" href="/en/trade/rwanda/tenders/consulting-services-for-the-feasibility-study-and-environmental-and-social-instruments-sustainable-public-spaces--2000742" title="Link to Event">
					<h3>Consulting Services for the Feasibility Study and Environmental and Social Instruments</h3>
				</a>
				<p>KfW Entwicklungsbank</p>
				<p class="excerpt">Project: sustainable public spaces in selected secondary cities.</p>
			</div>
		`, { status: 200, headers: { "content-type": "text/html" } }));
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.gtai.de/en/meta/search/kfw-tenders/795748!search"],
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
		expect(fetchPublicHttpUrlMock).toHaveBeenCalledWith(
			"https://www.gtai.de/en/meta/search/kfw-tenders/795748!search",
			expect.objectContaining({
				timeoutMs: 20000,
				maxRedirects: 3,
			}),
			"Configured source direct fetch"
		);
		expect(fetchMock).not.toHaveBeenCalledWith(
			"http://84.247.181.100:3003/v1/scrape",
			expect.anything()
		);
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Consulting Services for the Feasibility Study and Environmental and Social Instruments",
			source: "gtai_kfw",
			sourcePlatform: "GTAI/KfW",
			sourceFile: "source:https://www.gtai.de/en/meta/search/kfw-tenders/795748!search",
			rfpLink: "https://www.gtai.de/en/trade/rwanda/tenders/consulting-services-for-the-feasibility-study-and-environmental-and-social-instruments-sustainable-public-spaces--2000742",
			tags: ["external-discovery", "source-scrape", "gtai", "kfw", "development-bank", "global-south", "source-documents"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					engine: "source_scrape",
					scrapedWithFirecrawl: false,
					scrapedWithDirectHttp: true,
					scrapeMethod: "direct_http",
				}),
			}),
		}));
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl: "https://www.gtai.de/en/meta/search/kfw-tenders/795748!search",
				status: "healthy",
				candidates: 1,
				imported: 1,
				warnings: 0,
			}),
		]);
	});

	it("preserves DGMarket source identity for Global South marketplace imports", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: "",
				html: `
					<table class="list_notice_table">
						<tbody>
							<tr>
								<td>
									<input type="hidden" name="noticeId" value="108981643">
									<div class="ln_notice_title">
										<a href="/tender/108981643">Supply and installation of education data platform</a>
									</div>
									<p>
										<span class="ln_title country_icon">Country:&nbsp;</span>
										<span class="ln_listing">Kenya</span>
									</p>
									<p>
										<span class="ln_title type_icon">Type:</span>
										<span class="ln_listing">Request for Proposals</span>
									</p>
								</td>
								<td>
									<div class="ln_title2">Published</div>
									<div class="ln_date">May 26, 2026</div>
									<div class="ln_title2">Deadline</div>
									<div class="ln_deadline">Jun 15, 2026</div>
								</td>
							</tr>
						</tbody>
					</table>
				`,
				links: ["https://www.dgmarket.com/tender/108981643"],
				metadata: {
					title: "DGMarket",
				},
			},
		});
		selectResultsQueue.push([]);

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.dgmarket.com"],
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
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Supply and installation of education data platform",
			source: "dgmarket",
			sourcePlatform: "DGMarket",
			sourceFile: "source:https://www.dgmarket.com/",
			rfpLink: "https://www.dgmarket.com/tender/108981643",
			tags: ["external-discovery", "source-scrape", "dgmarket", "global-south", "global-procurement", "source-documents"],
			metadata: expect.objectContaining({
				discovery: expect.objectContaining({
					engine: "source_scrape",
					sourceUrl: "https://www.dgmarket.com/",
					resultEngine: "firecrawl-source",
					scrapedWithFirecrawl: true,
					scrapeMethod: "firecrawl",
				}),
			}),
		}));
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl: "https://www.dgmarket.com/",
				status: "healthy",
				candidates: 1,
				imported: 1,
				warnings: 0,
			}),
		]);
	});

	it("routes RTI and Abt configured sources through static source parsers", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: false,
			error: "The operation was aborted due to timeout",
		});
		fetchPublicHttpUrlMock.mockImplementation(async (url: string) => {
			if (url.includes("rti.org/current-opportunities")) {
				return new Response(`
					<p><strong>Request for Quote/Proposal (RFQ/RFP)</strong></p>
					<p><strong>Title:</strong> Service Provider for Physics-Constrained Graph Neural Network Development</p>
					<p><strong>Project:</strong> Energy Systems Planning and Analysis</p>
					<p><strong>RFP/Q Number:</strong> ESP-RFP-2099-027</p>
					<p><strong>Date Proposal Due:</strong> June 12, 2099 at 5:00 PM Manila time</p>
					<p><strong>Attachment:</strong> <a href="/sites/default/files/rfp-027.pdf">Request for Proposal</a></p>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			return new Response(`
				<h3 class="accordion__item--header-title">FPSP-RFP-2099-043: Request for Proposal - Fiji Public Service Leadership Initiative</h3>
				<div class="accordion__item--body">
					<p>Proposals must be submitted electronically before 5:00pm Fiji Time on 26 June 2099.</p>
					<p><a href="/sites/default/files/fpsp-rfp-2099-043.pdf">RFP documentation</a></p>
				</div>
			`, { status: 200, headers: { "content-type": "text/html" } });
		});

		const result = await discoverAndImportOpportunities({
			sourceUrls: [
				"https://www.rti.org/current-opportunities",
				"https://www.abtglobal.com/doing-business-with-abt/commercial-opportunities",
			],
			sourceScrapeLimit: 5,
			browserFallback: false,
		});

		expect(result.results).toEqual({
			total: 2,
			imported: 2,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Service Provider for Physics-Constrained Graph Neural Network Development",
			source: "rti",
			sourcePlatform: "RTI International",
			sourceFile: "source:https://www.rti.org/current-opportunities",
			rfpLink: "https://www.rti.org/sites/default/files/rfp-027.pdf",
			tags: ["external-discovery", "source-scrape", "rti", "donor-implementer"],
		}));
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "FPSP-RFP-2099-043: Request for Proposal - Fiji Public Service Leadership Initiative",
			source: "abt_global",
			sourcePlatform: "Abt Global",
			sourceFile: "source:https://www.abtglobal.com/doing-business-with-abt/commercial-opportunities",
			rfpLink: "https://www.abtglobal.com/sites/default/files/fpsp-rfp-2099-043.pdf",
			tags: ["external-discovery", "source-scrape", "abt-global", "donor-implementer"],
		}));
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl: "https://www.rti.org/current-opportunities",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
			expect.objectContaining({
				sourceUrl: "https://www.abtglobal.com/doing-business-with-abt/commercial-opportunities",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
		]);
	});

	it("routes FHI 360 configured source through its solicitation parser and preserves package documents", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: false,
			error: "The operation was aborted due to timeout",
		});
		fetchPublicHttpUrlMock.mockResolvedValue(new Response(`
			<hr />
			<p class="rteindent1">
				<b><span id="MainContent_lvRFP_lblTitle_0">Support to Strengthen Community-Based Surveillance Activities</span></b><br />
				RFP No.: <span id="MainContent_lvRFP_lblNumber_0">2026-016-Indonesia-CBS_RFP_02</span><br />
				Issue date: <span id="MainContent_lvRFP_lblIssue_0">15 May, 2099</span><br />
				Closing date: <span id="MainContent_lvRFP_lblClose_0">10 Jun, 2099</span><br />
			</p>
			<p class="rteindent1">
				<b>Solicitation file(s):</b><br />
				<a href="/Files/STRIDES%20Tender%20for%20GHS%20Indonesia.pdf">STRIDES - Tender for GHS Indonesia.pdf</a>
				<a href="/Files/Attachment%20A%20Budget%20Proposal.xlsx">Attachment A-Budget Proposal.xlsx</a>
			</p>
		`, { status: 200, headers: { "content-type": "text/html" } }));

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://solicitations.fhi360.org/Solicitation.aspx"],
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
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Support to Strengthen Community-Based Surveillance Activities",
			source: "fhi360",
			sourcePlatform: "FHI 360",
			sourceFile: "source:https://solicitations.fhi360.org/Solicitation.aspx",
			rfpLink: "https://solicitations.fhi360.org/Files/STRIDES%20Tender%20for%20GHS%20Indonesia.pdf",
			tags: ["external-discovery", "source-scrape", "fhi360", "donor-implementer", "source-documents"],
		}));
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl: "https://solicitations.fhi360.org/Solicitation.aspx",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
		]);
	});

	it("routes DT Global and CARE configured sources through active RFP parsers", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: false,
			error: "The operation was aborted due to timeout",
		});
		fetchPublicHttpUrlMock.mockImplementation(async (url: string) => {
			if (url.includes("dt-global.com/proposals")) {
				return new Response(`
					<div id="div_block-23-4572-1" class="ct-div-block">
						<h5 id="headline-35-4572-1">
							<a href="https://dt-global.com/proposals/rfp-review-of-regulations-and-laws-related-to-land-trustees/">RFP - Review of Regulations and Laws related to Land Trustees</a>
						</h5>
						<div id="text_block-47-4572-1"><p>Support to the Solomon Islands Threshold Program.</p></div>
						<div id="text_block-100-4572-1"><span>2 June 2099, 17.00 (5.00pm) Melbourne Time.</span></div>
					</div>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			return new Response(`
				<h3 class="title">Impact Market Growth Advisory Platform - Commercialization</h3>
				<p><strong>Description:</strong><br />CARE seeks to engage an FS-TA Commercialization Consultant.</p>
				<p><strong>Supporting documents:<br /></strong>
					<a href="https://www.care.org/wp-content/uploads/2099/04/SOW_IMGA_Platform.docx">Click here to view the SOW</a>
				</p>
				<p><strong>Tender submission deadline:</strong><br />May 5, 2099</p>
			`, { status: 200, headers: { "content-type": "text/html" } });
		});

		const result = await discoverAndImportOpportunities({
			sourceUrls: [
				"https://dt-global.com/proposals/",
				"https://www.care.org/about-us/contact-us/request-for-proposals/",
			],
			sourceScrapeLimit: 5,
			browserFallback: false,
		});

		expect(result.results).toEqual({
			total: 2,
			imported: 2,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "RFP - Review of Regulations and Laws related to Land Trustees",
			source: "dt_global",
			sourcePlatform: "DT Global",
			sourceFile: "source:https://dt-global.com/proposals/",
			rfpLink: "https://dt-global.com/proposals/rfp-review-of-regulations-and-laws-related-to-land-trustees/",
			tags: ["external-discovery", "source-scrape", "dt-global", "donor-implementer", "source-documents"],
		}));
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Impact Market Growth Advisory Platform - Commercialization",
			source: "care",
			sourcePlatform: "CARE",
			sourceFile: "source:https://www.care.org/about-us/contact-us/request-for-proposals/",
			rfpLink: "https://www.care.org/wp-content/uploads/2099/04/SOW_IMGA_Platform.docx",
			tags: ["external-discovery", "source-scrape", "care", "ngo", "source-documents"],
		}));
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl: "https://dt-global.com/proposals/",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
			expect.objectContaining({
				sourceUrl: "https://www.care.org/about-us/contact-us/request-for-proposals/",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
		]);
	});

	it("routes Enabel configured procurement and grant sources through its source-document parser", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: false,
			error: "The operation was aborted due to timeout",
		});
		fetchPublicHttpUrlMock.mockImplementation(async (url: string) => {
			if (url.includes("enabel.be/public-procurement")) {
				return new Response(`
					<div class="card--news card--tenders | font-normal group" data-open="false">
						<div class="news__botton">
							<p class="h5"><span>GIN23006-10058 &#8211; Marché public de services relatif au contrôle et surveillance des travaux</span></p>
							<p><strong>Country : </strong> Guinea</p>
							<p><strong>Closing date : </strong> 16 June 2099 11:00 </p>
							<div class="hidden__card hidden">
								<p><strong>Status :</strong> Open</p>
								<p><strong>Attachments : </strong></p>
								<p><a href="https://www.enabel.be/app/uploads/2099/05/Cahier-des-charges-Gin23006-10058.pdf" download>Cahier des charges.pdf</a></p>
								<p><a href="https://www.enabel.be/app/uploads/2099/05/Inventaire.xlsx" download>Inventaire.xlsx</a></p>
							</div>
						</div>
					</div>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			return new Response(`
				<div class="card--news card--tenders | font-normal group" data-open="false">
					<div class="news__botton">
						<p class="h5"><span>BDI23007-10156 &#8211; Appel à propositions pour appuyer l'entrepreneuriat féminin</span></p>
						<p><strong>Country : </strong> Burundi</p>
						<p><strong>Closing date : </strong> 06 July 2099 10:00 </p>
						<div class="hidden__card hidden">
							<p><strong>Status :</strong> Open</p>
							<p><strong>Attachments : </strong></p>
							<p><a href="https://www.enabel.be/app/uploads/2099/06/BDI23007-10156-Guidelines.pdf" download>Guidelines.pdf</a></p>
							<p><a href="https://www.enabel.be/app/uploads/2099/06/Application-File.docx" download>Application File.docx</a></p>
						</div>
					</div>
				</div>
			`, { status: 200, headers: { "content-type": "text/html" } });
		});

		const result = await discoverAndImportOpportunities({
			sourceUrls: [
				"https://www.enabel.be/public-procurement/",
				"https://www.enabel.be/grants/",
			],
			sourceScrapeLimit: 5,
			browserFallback: false,
		});

		expect(result.results).toEqual({
			total: 2,
			imported: 2,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Marché public de services relatif au contrôle et surveillance des travaux",
			source: "enabel",
			sourcePlatform: "Enabel",
			sourceFile: "source:https://www.enabel.be/public-procurement/",
			rfpLink: "https://www.enabel.be/app/uploads/2099/05/Cahier-des-charges-Gin23006-10058.pdf",
			tags: ["external-discovery", "source-scrape", "enabel", "bilateral-donor", "source-documents"],
		}));
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Appel à propositions pour appuyer l'entrepreneuriat féminin",
			source: "enabel",
			sourcePlatform: "Enabel",
			sourceFile: "source:https://www.enabel.be/grants/",
			rfpLink: "https://www.enabel.be/app/uploads/2099/06/BDI23007-10156-Guidelines.pdf",
			tags: ["external-discovery", "source-scrape", "enabel", "bilateral-donor", "source-documents"],
		}));
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl: "https://www.enabel.be/public-procurement/",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
			expect.objectContaining({
				sourceUrl: "https://www.enabel.be/grants/",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
		]);
	});

	it("routes Winrock configured contract sources through its source-document parser", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: false,
			error: "The operation was aborted due to timeout",
		});
		fetchPublicHttpUrlMock.mockResolvedValue(new Response(`
			<div class="border-t-6 border-gray-lighter pt-4 grid md:flex gap-4">
				<div class="md:w-2/3 grid gap-2 children:mb-0">
					<h3><a href="https://winrock.org/contracts/pre-qualification-of-cashew-business-development-service-providers/" class="font-bold no-underline">Pre-Qualification of Cashew Production Business Development Service Providers</a></h3>
					Program: Women Economic Empowerment through Cashew Processing (WEECAP) Countries: Cote d'Ivoire, Senegal, Guinea-Bissau Issued by: Winrock International Release Date: October 17th, 2098 Round 1 Submission Deadline: November 14, 2098 Round 2 Submission Deadline: February 14, 2099 Round 3 Submission Deadline: June 14, 2099
				</div>
			</div>
		`, { status: 200, headers: { "content-type": "text/html" } }));

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://winrock.org/contracts/"],
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
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Pre-Qualification of Cashew Production Business Development Service Providers",
			source: "winrock",
			sourcePlatform: "Winrock International",
			sourceFile: "source:https://winrock.org/contracts/",
			rfpLink: "https://winrock.org/contracts/pre-qualification-of-cashew-business-development-service-providers/",
			tags: ["external-discovery", "source-scrape", "winrock", "ngo", "source-documents"],
		}));
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl: "https://winrock.org/contracts/",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
		]);
	});

	it("routes NRC configured tender sources through its source API and detail documents", async () => {
		process.env.NRC_TENDER_MAX_PAGES = "1";
		process.env.NRC_TENDER_DETAIL_LIMIT = "1";
		fetchMock.mockImplementation(async (url: string) => {
			if (url.includes("/api/SearchApi/SearchCategories")) {
				return new Response(JSON.stringify({
					searchEntries: [{
						title: "Managed Incident Response Services (SOC/SIEM Implementation)",
						date: "19. May 2099",
						description: "Request for Proposal.",
						pageUrl: "/tender/managed-incident-response-services-socsiem-implementation",
					}],
					pageNumber: 1,
					lastPage: 1,
				}), { status: 200, headers: { "content-type": "application/json" } });
			}
			return new Response(`
				<article>
					<h1>Managed Incident Response Services (SOC/SIEM Implementation)</h1>
					<span>Published 19. May 2099 </span>
					<p><strong>Deadline for submission is 7 June 2099 at 17:00.</strong></p>
					<a href="/globalassets/pdf/tenders/global/managed-incident-response-services/rfp-it-soc-2099.docx">
						<div class="filename">RFP-IT-SOC-2099.docx</div>
					</a>
				</article>
			`, { status: 200, headers: { "content-type": "text/html" } });
		});

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.nrc.no/themes/177/tender"],
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
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Managed Incident Response Services (SOC/SIEM Implementation)",
			source: "nrc",
			sourcePlatform: "Norwegian Refugee Council",
			sourceFile: "source:https://www.nrc.no/themes/177/tender",
			rfpLink: "https://www.nrc.no/globalassets/pdf/tenders/global/managed-incident-response-services/rfp-it-soc-2099.docx",
			tags: ["external-discovery", "source-scrape", "nrc", "ngo", "source-documents", "source-api"],
		}));
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl: "https://www.nrc.no/themes/177/tender",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
		]);
	});

	it("routes Oxfam Nigeria procurement pages through its strict deadline parser", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: false,
			error: "The operation was aborted due to timeout",
		});
		fetchPublicHttpUrlMock.mockResolvedValue(new Response(`
			<main>
				<p>Oxfam in Nigeria is seeking the services of an experienced and reliable consultancy service provider.</p>
				<p><strong>Main Objective</strong></p>
				<p>Capacity building for LGA budget and planning officers on Basic Excel skills to support the use of ICT for budget preparation, implementation, monitoring, and evaluation.</p>
				<p>Interested parties can download the <a href="https://oxfam.app.box.com/s/example/folder/384191668623"><strong>Terms of Reference</strong></a> (link embedded)</p>
				<ul>
					<li><strong>Submission Deadline:</strong> June 7, 2099, at 23:59 (WAT).</li>
				</ul>
			</main>
		`, { status: 200, headers: { "content-type": "text/html" } }));

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://nigeria.oxfam.org/procurement-and-consultancy"],
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
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Capacity building for LGA budget and planning officers on Basic Excel skills to support the use of ICT for budget preparation, implementation, monitoring, and evaluation.",
			source: "oxfam_nigeria",
			sourcePlatform: "Oxfam in Nigeria",
			sourceFile: "source:https://nigeria.oxfam.org/procurement-and-consultancy",
			rfpLink: "https://oxfam.app.box.com/s/example/folder/384191668623",
			tags: ["external-discovery", "source-scrape", "oxfam-nigeria", "ngo", "source-documents"],
		}));
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl: "https://nigeria.oxfam.org/procurement-and-consultancy",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
		]);
	});

	it("routes IRC bid opportunities through its detail-link parser", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: false,
			error: "The operation was aborted due to timeout",
		});
		fetchPublicHttpUrlMock.mockResolvedValue(new Response(`
			<ul>
				<li class="rpll-one-column-list__item">
					<div class="rplc-teaser-basic rplc-teaser-basic--date-before-summary">
						<a href="/rfp/it-equipment-opt-palestine" class="rplc-teaser-basic__wrapper-link" aria-label="IT Equipment for oPT, Palestine">
							<div class="rplc-teaser-basic__slug"><div>RFP</div></div>
							<h2 class="rplc-teaser-basic__title">IT Equipment for oPT, Palestine</h2>
							<div class="rplc-teaser-basic__date"><div>May 21, 2099</div></div>
							<div class="rplc-teaser-basic__summary"><div class="rpla-paragraph">Supply IT equipment for the IRC response.</div></div>
						</a>
					</div>
				</li>
			</ul>
		`, { status: 200, headers: { "content-type": "text/html" } }));
		fetchMock.mockResolvedValue(new Response("", {
			status: 302,
			headers: { location: "https://rescue.box.com/s/package123" },
		}));

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.rescue.org/procurement-policies-and-bid-opportunities"],
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
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "IT Equipment for oPT, Palestine",
			source: "irc",
			sourcePlatform: "International Rescue Committee",
			sourceFile: "source:https://www.rescue.org/procurement-policies-and-bid-opportunities",
			rfpLink: "https://rescue.box.com/s/package123",
			tags: ["external-discovery", "source-scrape", "irc", "ngo", "source-documents"],
		}));
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl: "https://www.rescue.org/procurement-policies-and-bid-opportunities",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
		]);
	});

	it("routes Palladium, Jhpiego, Tetra Tech, TradeMark Africa, BOAD, DBSA, SADC, ECOWAS, and ECREEE configured sources through static source parsers", async () => {
		process.env.BOAD_PAGE_LIMIT = "1";
		process.env.BOAD_DETAIL_LIMIT = "1";
		process.env.ECREEE_PAGE_LIMIT = "1";
		process.env.ECREEE_DETAIL_LIMIT = "1";
		const boadInertiaHtml = (props: Record<string, unknown>) =>
			`<div id="app" data-page="${JSON.stringify({ component: "Page", props }).replace(/"/g, "&quot;")}"></div>`;
		const boadRow = {
			id: 2931,
			external_id: 572296,
			type: "tender",
			slug: "ami-taxe-carbone-accord-paris-rdc-consultants",
			link: "/fr/opportunites/appels-doffre/ami-taxe-carbone-accord-paris-rdc-consultants/",
			title: "Avis à Manifestation d'Intérêt - Recrutement de consultant pour la mise en œuvre de la taxe carbone et Accord de Paris en RDC",
			acf: {
				presentation: {
					title: null,
					text: "<p>Date limite de soumission : 15 juin 2099</p>",
				},
				start_at: "21/05/2099",
				end_at: "15/06/2099",
				files: [572291],
			},
		};
		firecrawlScrapeMock.mockResolvedValue({
			success: false,
			error: "The operation was aborted due to timeout",
		});
		fetchMock.mockImplementation(async (url: string) => {
			if (url === "https://www.dbsa.org/procurement") {
				return new Response(`
					<table class="table"><tbody><tr>
						<td><strong>RFP 090/2099:</strong> Appointment of a Integrated Digital Marketing and Development Partner<br>
							<a href="/sites/ppdf.dbsa.org/files/media/documents/2099-05/RFP090-2099%20Digital%20Agency.pdf">Tender Volume</a>
						</td>
						<td>26 May 2099</td>
						<td>19 June 2099 at 23H55</td>
					</tr></tbody></table>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			if (url === "https://www.sadc.int/procurement-opportunities") {
				return new Response(`
					<div class="view-content clearfix">
						<div class="views-view-grid horizontal cols-1 clearfix">
							<div class="col-md-3 col-sm-4 col-xs-6 grid-item">
								<div class="column">
									<div class="views-field views-field-fieldset"><span class="field-content"><div class="date-green">
										<div class="views-field views-field-field-closing-date date-large"><div class="field-content">29</div></div>
										<div class="views-field views-field-field-closing-date-1 date-small"><div class="field-content">Jun 2099</div></div>
									</div></span></div>
									<div class="views-field views-field-title"><span class="field-content"><a href="/procurement-opportunities/individual-consultancy-provide-technical-advice-executive-secretary" hreflang="en">INDIVIDUAL CONSULTANCY TO PROVIDE TECHNICAL ADVICE TO THE EXECUTIVE SECRETARY</a></span></div>
								</div>
							</div>
						</div>
					</div>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			if (url === "https://www.sadc.int/procurement-opportunities/individual-consultancy-provide-technical-advice-executive-secretary") {
				return new Response(`
					<h1><span>INDIVIDUAL CONSULTANCY TO PROVIDE TECHNICAL ADVICE TO THE EXECUTIVE SECRETARY</span></h1>
					<p><span>Closing Date:</span> June 29, 2099</p>
					<p><span>Closing Time:</span> 12:00 PM</p>
					<article class="node node--type-tender">
						<div class="field field--name-body field--type-text-with-summary field--entity-node field--label-hidden field__item">
							<p><strong>Reference Number:</strong> SADC/3/5/2/448</p>
							<p>The assignment provides technical advice to the Executive Secretary.</p>
						</div>
						<div class="field field--name-field-attachment field--type-file field--entity-node field--label-hidden field__items clearfix">
							<table><tbody>
								<tr><td><a href="/sites/default/files/2099-05/REOI%20-%20TA%20ES%20OFFICE.docx">Request for Expression of Interest</a></td></tr>
							</tbody></table>
						</div>
					</article>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			if (url.startsWith("https://www.ecowas.int/procurement/")) {
				return new Response(url === "https://www.ecowas.int/procurement/" ? `
					<a href="https://www.ecowas.int/nwp_events/invitation-for-bid-solar-power-systems/">
						<small>Closing date: 11 Jun, 2099</small><h6>Invitation for Bid : Solar Power Systems for Primary Health Care Facilities</h6>
					</a>
				` : "", { status: 200, headers: { "content-type": "text/html" } });
			}
			if (url === "https://www.ecowas.int/nwp_events/invitation-for-bid-solar-power-systems/") {
				return new Response(`
					<h3>Invitation for Bid : Solar Power Systems for Primary Health Care Facilities</h3>
					<p>The ECOWAS Commission invites sealed bids for solar power systems.</p>
					<h4 class="text-blue">Downloads</h4>
					<a href="https://www.ecowas.int/wp-content/uploads/2099/05/FINAL-SISS-Request-for-bids.pdf" class="accordion-title" target="_blank">
						FINAL SISS Request for bids <div><span>2.43 MB</span> <span>pdf</span></div>
					</a>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			if (url === "https://www.ecreee.org/category/procurement-notices/") {
				return new Response(`
					<article class="style-three post category-procurement-notices">
						<div class="post-meta"><span><i class="fa fa-calendar"></i> May 18, 2099</span></div>
						<h3 class="entry-title"><a href="https://www.ecreee.org/call-for-expressions-of-interest-warep-phase-1/">
							Call for Expressions of Interest: Consultancy for the WAREP Completion Report
						</a></h3>
						<div class="entry-content">ECREEE invites qualified consultants for a West Africa regional energy assignment.</div>
					</article>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			if (url === "https://www.ecreee.org/call-for-expressions-of-interest-warep-phase-1/") {
				return new Response(`
					<article class="single-post category-procurement-notices">
						<h1 class="entry-title">Call for Expressions of Interest: Consultancy for the WAREP Completion Report</h1>
						<time class="entry-date published" datetime="2099-05-18T22:01:22-01:00">May 18, 2099</time>
						<div class="entry-content default-page">
							<div class="field-name-field-procurement-id"><div class="field-item odd">ECR/WAREP/EOI/2099/01</div></div>
							<div class="field-name-field-procurment-dead-line"><span class="date-display-single">Wednesday, June 22, 2099 - 23:59</span></div>
							<p>The ECOWAS Centre for Renewable Energy and Energy Efficiency invites qualified consultants.</p>
							<ul class="post-attachments">
								<li><a href="https://www.ecreee.org/wp-content/uploads/2099/05/WAREP-Terms-of-Reference.pdf">WAREP Terms of Reference</a></li>
							</ul>
							<div class="clearfix"></div>
						</div>
					</article>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			if (url === "https://www.badea.org/fr/procurement-notice-fr/") {
				return new Response(`
					<div data-max-page="1"></div>
					<h1 class="elementor-heading-title">RE-TENDERING - REHABILITATION AND EXPANSION OF MNAZI MMOJA HOSPITAL, ZANZIBAR</h1>
					<a href="https://badea-media.9ten.online/wp-content/uploads/2099/05/SPN-Rehabilitation-and-Expansion-of-MMH.pdf">Download</a>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			if (url === "https://www.boad.org/fr/opportunites/appels-doffre") {
				return new Response(boadInertiaHtml({
					tenders: {
						current_page: 1,
						last_page: 1,
						data: [boadRow],
					},
				}), { status: 200, headers: { "content-type": "text/html" } });
			}
			if (url === "https://www.boad.org/fr/opportunites/appels-doffre/ami-taxe-carbone-accord-paris-rdc-consultants/") {
				return new Response(boadInertiaHtml({
					page: boadRow,
					blocks: [{
						acf_fc_layout: "tender_header_block",
						component: "TenderHeaderBlock",
						data: {
							title: boadRow.title,
							presentation: boadRow.acf.presentation,
							files: [{
								title: "Termes de Références - Recrutement de consultant",
								acf: {
									file: {
										title: "TERMES DE REFERENCE TAXE CARBONE RDC",
										filename: "TERMES-DE-REFERENCE-TAXE-CARBONE-RDC.pdf",
										mime_type: "application/pdf",
										url: "https://admin.boad.org/wp-content/uploads/2099/05/TERMES-DE-REFERENCE-TAXE-CARBONE-RDC.pdf",
									},
								},
							}],
						},
					}],
				}), { status: 200, headers: { "content-type": "text/html" } });
			}
			if (url === "https://trademarkafrica.com/procurement/") {
				return new Response(`
					<div class="uc_post_title"><a data-post-link="https://trademarkafrica.com/tma-fwa-dts-01-2026-cloud-hosting/" href="javascrpit:void(0)">
						<div class="ue_p_title">TMA/FWA/DTS/01/2026: Prequalification of Cloud Hosting and Digital Infrastructure Service Providers for TradeMark Africa Digital Platforms</div>
					</a></div>
					<div class="uc_post_text">Tender Advert Tender Document Bid Extension TMA Supplier Code of Conduct Submission Deadline: 04 JUNE 2099 ON OR BEFORE 10.00 AM (KENYA TIME)</div>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			if (url === "https://trademarkafrica.com/tma-fwa-dts-01-2026-cloud-hosting/") {
				return new Response(`
					<h1 class="elementor-heading-title">TMA/FWA/DTS/01/2026: Prequalification of Cloud Hosting and Digital Infrastructure Service Providers for TradeMark Africa Digital Platforms</h1>
					<ul>
						<li><a href="/wp-content/uploads/2099/04/TMA-FWA-DTS-01-2099.pdf">Tender Document</a></li>
					</ul>
					<p><strong>Submission Deadline: 04 JUNE 2099 ON OR BEFORE 10.00 AM (KENYA TIME)</strong></p>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			return new Response("not found", { status: 404 });
		});
		fetchPublicHttpUrlMock.mockImplementation(async (url: string) => {
			if (url.includes("thepalladiumgroup.com/tenders")) {
				return new Response(`
					<ul class="listing">
						<li>
							<span>RFP99-008 Photography services for SWLT PNG</span>
							<a href="/tender/RFP99-008-Photography-services-for-SWLT-PNG">Find out more</a>
						</li>
					</ul>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			if (url.includes("jhpiego.org/work-with-us")) {
				return new Response(`
					<table class="show-desktop"><tbody><tr>
						<td class="title">RFP-99-009</td>
						<td class="description"><div class="text">Social Listening Services</div></td>
						<td class="post-date"><time datetime="May 27, 2099">May 27, 2099</time></td>
						<td class="close-date"><time datetime="June 19, 2099">June 19, 2099</time></td>
						<td class="location">USA</td>
					</tr></tbody></table>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			return new Response(`
				<a class="elementor-accordion-title">Strategic Border Management - Request for Tender</a>
				<div class="elementor-tab-content">
					<p>Closing Date and Time: Tuesday 23 June 2099 at 4:00pm AEST</p>
					<p><a href="/wp-content/uploads/strategic-border-management-rft.pdf">RFT document [PDF]</a></p>
				</div>
			`, { status: 200, headers: { "content-type": "text/html" } });
		});

		const result = await discoverAndImportOpportunities({
			sourceUrls: [
				"https://thepalladiumgroup.com/tenders",
				"https://jhpiego.org/work-with-us/",
				"https://intdev.tetratech.com.au/partner-with-us/",
				"https://trademarkafrica.com/procurement/",
				"https://www.badea.org/fr/procurement-notice-fr/",
				"https://www.boad.org/fr/opportunites/appels-doffre",
				"https://www.dbsa.org/procurement",
				"https://www.sadc.int/procurement-opportunities",
				"https://www.ecowas.int/procurement/",
				"https://www.ecreee.org/category/procurement-notices/",
			],
			sourceScrapeLimit: 5,
			browserFallback: false,
		});

		expect(result.results).toEqual({
			total: 10,
			imported: 10,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "RFP99-008 Photography services for SWLT PNG",
			source: "palladium",
			sourcePlatform: "Palladium",
			sourceFile: "source:https://thepalladiumgroup.com/tenders",
			rfpLink: "https://thepalladiumgroup.com/tender/RFP99-008-Photography-services-for-SWLT-PNG",
			tags: ["external-discovery", "source-scrape", "palladium", "donor-implementer", "source-documents"],
		}));
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "RFP-99-009: Social Listening Services",
			source: "jhpiego",
			sourcePlatform: "Jhpiego",
			sourceFile: "source:https://jhpiego.org/work-with-us/",
			tags: ["external-discovery", "source-scrape", "jhpiego", "donor-implementer"],
		}));
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Strategic Border Management - Request for Tender",
			source: "tetra_tech_intdev",
			sourcePlatform: "Tetra Tech International Development",
			sourceFile: "source:https://intdev.tetratech.com.au/partner-with-us/",
			rfpLink: "https://intdev.tetratech.com.au/wp-content/uploads/strategic-border-management-rft.pdf",
			tags: ["external-discovery", "source-scrape", "tetra-tech-intdev", "donor-implementer", "source-documents"],
		}));
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "TMA/FWA/DTS/01/2026: Prequalification of Cloud Hosting and Digital Infrastructure Service Providers for TradeMark Africa Digital Platforms",
			source: "trademark_africa",
			sourcePlatform: "TradeMark Africa",
			sourceFile: "source:https://trademarkafrica.com/procurement/",
			rfpLink: "https://trademarkafrica.com/wp-content/uploads/2099/04/TMA-FWA-DTS-01-2099.pdf",
			tags: ["external-discovery", "source-scrape", "trademark-africa", "africa", "regional-trade", "source-documents"],
		}));
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "RE-TENDERING - REHABILITATION AND EXPANSION OF MNAZI MMOJA HOSPITAL, ZANZIBAR",
			source: "badea",
			sourcePlatform: "BADEA",
			sourceFile: "source:https://www.badea.org/fr/procurement-notice-fr/",
			rfpLink: "https://badea-media.9ten.online/wp-content/uploads/2099/05/SPN-Rehabilitation-and-Expansion-of-MMH.pdf",
			tags: ["external-discovery", "source-scrape", "badea", "development-bank", "africa", "source-documents"],
		}));
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Avis à Manifestation d'Intérêt - Recrutement de consultant pour la mise en œuvre de la taxe carbone et Accord de Paris en RDC",
			source: "boad",
			sourcePlatform: "BOAD",
			sourceFile: "source:https://www.boad.org/fr/opportunites/appels-doffre",
			rfpLink: "https://admin.boad.org/wp-content/uploads/2099/05/TERMES-DE-REFERENCE-TAXE-CARBONE-RDC.pdf",
			tags: ["external-discovery", "source-scrape", "boad", "development-bank", "west-africa", "uemoa", "source-documents"],
		}));
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "RFP 090/2099: Appointment of a Integrated Digital Marketing and Development Partner",
			source: "dbsa",
			sourcePlatform: "Development Bank of Southern Africa",
			sourceFile: "source:https://www.dbsa.org/procurement",
			rfpLink: "https://www.dbsa.org/sites/ppdf.dbsa.org/files/media/documents/2099-05/RFP090-2099%20Digital%20Agency.pdf",
			tags: ["external-discovery", "source-scrape", "dbsa", "south-africa", "development-bank", "source-documents"],
		}));
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "INDIVIDUAL CONSULTANCY TO PROVIDE TECHNICAL ADVICE TO THE EXECUTIVE SECRETARY",
			source: "sadc",
			sourcePlatform: "SADC",
			sourceFile: "source:https://www.sadc.int/procurement-opportunities",
			rfpLink: "https://www.sadc.int/sites/default/files/2099-05/REOI%20-%20TA%20ES%20OFFICE.docx",
			tags: ["external-discovery", "source-scrape", "sadc", "southern-africa", "regional-procurement", "source-documents"],
		}));
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Invitation for Bid : Solar Power Systems for Primary Health Care Facilities",
			source: "ecowas",
			sourcePlatform: "ECOWAS",
			sourceFile: "source:https://www.ecowas.int/procurement/",
			rfpLink: "https://www.ecowas.int/wp-content/uploads/2099/05/FINAL-SISS-Request-for-bids.pdf",
			tags: ["external-discovery", "source-scrape", "ecowas", "west-africa", "regional-procurement", "source-documents"],
		}));
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Call for Expressions of Interest: Consultancy for the WAREP Completion Report",
			source: "ecreee",
			sourcePlatform: "ECREEE",
			sourceFile: "source:https://www.ecreee.org/category/procurement-notices/",
			rfpLink: "https://www.ecreee.org/wp-content/uploads/2099/05/WAREP-Terms-of-Reference.pdf",
			tags: ["external-discovery", "source-scrape", "ecreee", "ecowas", "west-africa", "renewable-energy", "source-documents"],
		}));
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl: "https://thepalladiumgroup.com/tenders",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
			expect.objectContaining({
				sourceUrl: "https://jhpiego.org/work-with-us/",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
			expect.objectContaining({
				sourceUrl: "https://intdev.tetratech.com.au/partner-with-us/",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
			expect.objectContaining({
				sourceUrl: "https://trademarkafrica.com/procurement/",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
			expect.objectContaining({
				sourceUrl: "https://www.badea.org/fr/procurement-notice-fr/",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
			expect.objectContaining({
				sourceUrl: "https://www.boad.org/fr/opportunites/appels-doffre",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
			expect.objectContaining({
				sourceUrl: "https://www.dbsa.org/procurement",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
			expect.objectContaining({
				sourceUrl: "https://www.sadc.int/procurement-opportunities",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
			expect.objectContaining({
				sourceUrl: "https://www.ecowas.int/procurement/",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
			expect.objectContaining({
				sourceUrl: "https://www.ecreee.org/category/procurement-notices/",
				status: "healthy",
				candidates: 1,
				imported: 1,
			}),
		]);
	});

	it("treats direct HTTP bot protection as blocked content instead of an empty source", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: "Captcha Page\n\nPlease solve this CAPTCHA",
				html: "<h1>Captcha Page</h1>",
				links: [],
				metadata: {
					title: "Radware Captcha Page",
				},
			},
		});
		fetchPublicHttpUrlMock.mockResolvedValue(new Response(`
			<title>Radware Captcha Page</title>
			<p>We apologize for the inconvenience, but your activity made us think that you are a bot.</p>
			<p>Please solve this CAPTCHA to request unblock to the website.</p>
		`, { status: 200, headers: { "content-type": "text/html" } }));

		const result = await discoverAndImportOpportunities({
			sourceUrls: ["https://www.gtai.de/en/meta/search/kfw-tenders/795748!search"],
			sourceScrapeLimit: 5,
			browserFallback: false,
		});

		expect(result.results).toEqual({
			total: 0,
			imported: 0,
			updated: 0,
			skipped: 0,
			failed: 0,
		});
		expect(createOpportunityMock).not.toHaveBeenCalled();
		expect(result.sourceHealth).toEqual([
			expect.objectContaining({
				sourceUrl: "https://www.gtai.de/en/meta/search/kfw-tenders/795748!search",
				status: "empty",
				candidates: 0,
				warnings: 1,
				warningTypes: { source_scrape_empty: 1 },
				message: "Direct HTTP returned bot-protection content",
			}),
		]);
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
			"http://84.247.181.100:3003/scrape",
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
		fetchMock.mockResolvedValueOnce({
			ok: true,
			status: 200,
			text: async () => `
<div class="post-list-item">
	<h3 class="post-title">
		<a href="https://www.comesa.int/tender-of-provision-of-staff-medical-insurance-cover-for-staff-of-the-comesa-secretariat/" rel="bookmark">
			Tender for Provision of Staff Medical Insurance Cover for Staff of The COMESA Secretariat
		</a>
	</h3>
	<div class="post-meta small muted space-bottom-small">
		<span class="date">12/05/2026</span>
	</div>
	<div class="post-excerpt">
		<p>The COMESA Secretariat has set aside funding towards contracting a medical insurance service provider.</p>
	</div>
</div>
			`,
		});
		firecrawlScrapeMock.mockResolvedValueOnce({
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
		expect(fetchMock).toHaveBeenCalledWith("https://www.comesa.int/category/open-tenders/", expect.objectContaining({
			headers: expect.objectContaining({
				"Accept": expect.stringContaining("text/html"),
			}),
		}));
		expect(firecrawlScrapeMock).not.toHaveBeenCalledWith("https://www.comesa.int/category/open-tenders/", expect.anything());
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
					scrapeMethod: "source_api",
					scrapedWithFirecrawl: false,
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
