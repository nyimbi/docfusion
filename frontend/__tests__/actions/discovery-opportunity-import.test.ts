import { beforeEach, describe, expect, it, vi } from "vitest";

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
	downloadDocumentMock.mockResolvedValue({ success: true, documentId: "source-doc-1" });
	fetchMock.mockResolvedValue({
		ok: false,
		status: 503,
		text: async () => "browser unavailable",
		json: async () => ({ success: false, error: "browser unavailable" }),
	});
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

	it("imports COMESA configured sources with the COMESA parser", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: [
					"* [Open Tenders](https://www.comesa.int/category/open-tenders/)",
					"",
					"[](https://www.comesa.int/procurement-of-consultancy-services-to-review-the-development-of-comesa-regional-agri-food-systems-investment-plan-rasip-2026-2031/)",
					"",
					"### [Procurement of Consultancy Services to Review the Development of COMESA Regional Agri Food Systems Investment Plan (RASIP) 2026-2031](https://www.comesa.int/procurement-of-consultancy-services-to-review-the-development-of-comesa-regional-agri-food-systems-investment-plan-rasip-2026-2031/)",
					"",
					"08/05/2026",
					"",
					"REQUEST FOR EXPRESSIONS OF INTEREST (REOI) Procurement Title: Procurement of Consultancy Services to Review the Development of COMESA Regional Agri Food Systems Investment Plan (RASIP) 2026-2031 For more details visit https://www.nepad.org/tenders/procurement-of-consultancy-services-review-development-of-comesa-regional-agri-food-systems",
				].join("\n"),
				links: ["https://www.comesa.int/procurement-of-consultancy-services-to-review-the-development-of-comesa-regional-agri-food-systems-investment-plan-rasip-2026-2031/"],
				metadata: { title: "Open Tenders Archives - COMESA" },
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
			title: "Procurement of Consultancy Services to Review the Development of COMESA Regional Agri Food Systems Investment Plan (RASIP) 2026-2031",
			category: "Consultancy",
			countryRegion: "Eastern and Southern Africa",
			organization: "COMESA Secretariat",
			rfpLink: "https://www.nepad.org/tenders/procurement-of-consultancy-services-review-development-of-comesa-regional-agri-food-systems",
			portalUrl: "https://www.comesa.int/procurement-of-consultancy-services-to-review-the-development-of-comesa-regional-agri-food-systems-investment-plan-rasip-2026-2031/",
			documentUrl: "https://www.nepad.org/tenders/procurement-of-consultancy-services-review-development-of-comesa-regional-agri-food-systems",
			tags: ["external-discovery", "source-scrape", "comesa", "regional-procurement"],
			metadata: expect.objectContaining({
				comesa: expect.objectContaining({ sourceArchive: "open-tenders" }),
				discovery: expect.objectContaining({
					resultEngine: "firecrawl-source",
					scrapeMethod: "firecrawl",
					scrapedWithFirecrawl: true,
					sourceUrl: "https://www.comesa.int/category/open-tenders/",
				}),
			}),
		}));
	});
});
