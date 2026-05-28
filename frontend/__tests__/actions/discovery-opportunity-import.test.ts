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
						expect.objectContaining({
							url: "https://procurement.example.com/docs/annual-report.pdf",
							source: "scraped_markdown",
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

	it("imports UN Procurement configured sources from browser-rendered listing cards", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: false,
			error: "Firecrawl DNS safety check failed",
		});
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				content: `
					<li class="views-row">
						<div class="views-field views-field-title custom-card-title">WS2006276746</div>
						<span class="start">09 Jun 2026 </span>
						<time datetime="2026-06-09T15:00:00Z" class="datetime">15:00</time>
						<div class="views-field views-field-field-text-75-1 custom-card-title-field">
							<div class="field-content">Provision of Cisco Core, Distribution and Datacenter Solutions</div>
						</div>
						<div class="views-field views-field-name tender-custom-field tender-commodity-group-field">
							<span class="field-content">Communications Equipment</span>
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

		expect(result.results).toMatchObject({ total: 1, imported: 1, failed: 0 });
		expect(createOpportunityMock).toHaveBeenCalledWith(expect.objectContaining({
			title: "Provision of Cisco Core, Distribution and Datacenter Solutions",
			source: "un_procurement",
			sourceId: "un-procurement-ws2006276746",
			noticeId: "WS2006276746",
			sourcePlatform: "UN Procurement",
			sourceFile: "source:https://www.un.org/procurement/solicitations-opportunities",
			category: "Communications Equipment",
			opportunityType: "tender",
			tags: ["external-discovery", "source-scrape", "un-procurement", "unpd", "solicitation"],
			metadata: expect.objectContaining({
				unProcurement: expect.objectContaining({
					noticeId: "WS2006276746",
					commodityGroup: "Communications Equipment",
				}),
				discovery: expect.objectContaining({
					scrapedWithBrowserFallback: true,
					scrapeMethod: "browser_fallback",
					browserFallbackReason: "Firecrawl DNS safety check failed",
				}),
			}),
		}));
		expect(result.warnings).toEqual([
			expect.objectContaining({
				type: "browser_fallback_used",
				query: "source:https://www.un.org/procurement/solicitations-opportunities",
				message: "Firecrawl DNS safety check failed",
			}),
		]);
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
			total: 1,
			imported: 1,
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

	it("imports World Bank configured sources with the World Bank parser", async () => {
		firecrawlScrapeMock.mockResolvedValueOnce({
			success: true,
			data: {
				markdown: [
					"| Description | Country | Project Title | Notice Type | Language | Published Date |",
					"| --- | --- | --- | --- | --- | --- |",
					"| [Contratacao de Especialista em Conectividade](http://projects.worldbank.org/en/projects-operations/procurement-detail/OP00428547) | Angola | [Angola Digital Acceleration Project - P180693](http://projects.worldbank.org/en/projects-operations/project-detail/P180693) | Request for Expression of Interest | Portuguese | May 25, 2026 |",
					"| [Awarded consultant contract](http://projects.worldbank.org/en/projects-operations/procurement-detail/OP00440000) | Kenya | [Awarded Project - P100000](http://projects.worldbank.org/en/projects-operations/project-detail/P100000) | Contract Award | English | May 25, 2026 |",
				].join("\n"),
				links: [
					"http://projects.worldbank.org/en/projects-operations/procurement-detail/OP00428547",
				],
				metadata: { title: "Procurement Notices" },
			},
		});
		fetchMock.mockResolvedValueOnce({
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
		expect(firecrawlScrapeMock).toHaveBeenNthCalledWith(1, "https://projects.worldbank.org/en/projects-operations/procurement", expect.objectContaining({
			formats: ["markdown", "html", "links"],
		}));
		expect(firecrawlScrapeMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith("https://search.worldbank.org/api/procnotices?format=json&apilang=en&id=OP00428547", expect.objectContaining({
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
			tags: ["external-discovery", "source-scrape", "world-bank", "development-bank", "global-procurement"],
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
					resultEngine: "firecrawl-source",
					scrapeMethod: "firecrawl",
					scrapedWithFirecrawl: true,
					sourceUrl: "https://projects.worldbank.org/en/projects-operations/procurement",
				}),
			}),
		}));
		expect(result.sourceDocumentsCreated).toBe(1);
	});
});
