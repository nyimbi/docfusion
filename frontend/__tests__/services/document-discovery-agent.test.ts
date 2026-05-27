import { beforeEach, describe, expect, it, vi } from "vitest";

function createChain(config: {
	onSet?: (value: Record<string, unknown>) => void;
	onValues?: (value: Record<string, unknown>) => void;
} = {}) {
	const chain: Record<string, any> = {};
	chain.set = vi.fn((value: Record<string, unknown>) => {
		config.onSet?.(value);
		return chain;
	});
	chain.values = vi.fn((value: Record<string, unknown>) => {
		config.onValues?.(value);
		return chain;
	});
	chain.where = vi.fn(() => chain);
	return chain;
}

const firecrawlScrapeMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
const insertedValues = vi.hoisted(() => [] as Record<string, unknown>[]);
const opportunityUpdates = vi.hoisted(() => [] as Record<string, unknown>[]);

const dbMock = vi.hoisted(() => ({
	query: {
		opportunities: {
			findFirst: vi.fn(),
		},
		opportunityDocuments: {
			findFirst: vi.fn(),
		},
	},
	insert: vi.fn(),
	update: vi.fn(),
}));

vi.mock("@/lib/scrapers/firecrawl", () => ({
	FirecrawlClient: vi.fn(() => ({
		scrape: firecrawlScrapeMock,
	})),
}));

vi.mock("@/lib/services/searxng-client", () => ({
	searchSearxng: vi.fn(),
	searchDocuments: vi.fn(),
	searchMultiple: vi.fn(),
}));

vi.mock("@/lib/services/docling-client", () => ({
	convertDocumentFromUrl: vi.fn(),
	processRfpDocument: vi.fn(),
	isSupportedFileType: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("@/lib/db/schema", () => ({
	opportunities: {
		id: "opportunities.id",
		documentsDiscovered: "opportunities.documentsDiscovered",
		documentsDiscoveredAt: "opportunities.documentsDiscoveredAt",
		lastDocumentScanAt: "opportunities.lastDocumentScanAt",
	},
	opportunityDocuments: {
		opportunityId: "opportunityDocuments.opportunityId",
		sourceUrl: "opportunityDocuments.sourceUrl",
	},
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((column: unknown, value: unknown) => ({ op: "eq", column, value })),
	and: vi.fn((...conditions: unknown[]) => ({ op: "and", conditions })),
}));

vi.mock("@/lib/ai/providers/factory", () => ({
	quickComplete: vi.fn(),
	prompt: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: {
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
	},
}));

import { quickComplete } from "@/lib/ai/providers/factory";
import { searchDocuments, searchSearxng } from "@/lib/services/searxng-client";
import { discoverDocumentsWithAgent } from "@/lib/services/document-discovery-agent";

const baseOpportunity = {
	id: "opp-1",
	title: "Records Platform Tender",
	organization: "Buyer Ministry",
	portalUrl: "https://buyer.example/tenders/records",
	rfpLink: null,
	noticeId: "BID-2026-001",
	sourceId: null,
	countryRegion: "Kenya",
	deadline: null,
	category: "ICT",
};

beforeEach(() => {
	vi.clearAllMocks();
	firecrawlScrapeMock.mockReset();
	fetchMock.mockReset();
	vi.mocked(quickComplete).mockReset();
	vi.mocked(searchSearxng).mockReset();
	vi.mocked(searchDocuments).mockReset();
	vi.stubGlobal("fetch", fetchMock);
	insertedValues.length = 0;
	opportunityUpdates.length = 0;
	dbMock.query.opportunities.findFirst.mockResolvedValue(baseOpportunity);
	dbMock.query.opportunityDocuments.findFirst.mockResolvedValue(null);
	dbMock.insert.mockImplementation(() => createChain({
		onValues: (value) => insertedValues.push(value),
	}));
	dbMock.update.mockImplementation(() => createChain({
		onSet: (value) => opportunityUpdates.push(value),
	}));
	fetchMock.mockResolvedValue({
		ok: false,
		status: 503,
		text: async () => "browser unavailable",
		json: async () => ({ success: false, error: "browser unavailable" }),
	});
});

describe("discoverDocumentsWithAgent", () => {
	it("uses the browser service to recover primary portal document discovery when Firecrawl fails", async () => {
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
					markdown: "# Records Platform Tender",
					links: ["/downloads/Records-Platform-RFP.pdf"],
				},
			}),
		});

		const result = await discoverDocumentsWithAgent("opp-1", 1);

		expect(result.success).toBe(true);
		expect(result.strategiesAttempted).toEqual(["primary_portal"]);
		expect(result.strategiesSucceeded).toEqual(["primary_portal"]);
		expect(fetchMock).toHaveBeenCalledWith(
			"http://84.247.181.100:3003/v1/scrape",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					url: "https://buyer.example/tenders/records",
					options: {
						timeout: 15000,
						humanScroll: true,
						blockMedia: true,
					},
				}),
			})
		);
		expect(insertedValues).toEqual([
			expect.objectContaining({
				opportunityId: "opp-1",
				documentName: "Records-Platform-RFP.pdf",
				documentType: "rfp",
				sourceUrl: "https://buyer.example/downloads/Records-Platform-RFP.pdf",
				status: "discovered",
				isSelected: true,
				description: expect.stringContaining("browser_fallback_link_extraction: SCRAPE_ALL_ENGINES_FAILED"),
			}),
		]);
		expect(insertedValues[0]).toEqual(expect.objectContaining({
			description: expect.stringContaining("confidence signals: direct document extension"),
		}));
		expect(opportunityUpdates).toEqual([
			expect.objectContaining({
				documentsDiscovered: true,
				documentsDiscoveredAt: expect.any(Date),
				lastDocumentScanAt: expect.any(Date),
			}),
		]);
	});

	it("does not spend a browser fallback call when Firecrawl link extraction finds documents", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: "# Records Platform Tender",
				links: ["https://buyer.example/tenders/files/technical-specification.pdf"],
			},
		});

		const result = await discoverDocumentsWithAgent("opp-1", 1);

		expect(result.success).toBe(true);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(insertedValues).toEqual([
			expect.objectContaining({
				documentName: "technical-specification.pdf",
				documentType: "specification",
				sourceUrl: "https://buyer.example/tenders/files/technical-specification.pdf",
				description: expect.stringContaining("link_extraction"),
			}),
		]);
		expect(insertedValues[0]).toEqual(expect.objectContaining({
			description: expect.stringContaining("specification filename signal"),
			isSelected: true,
		}));
	});

	it("records confidence signals for SearXNG document results instead of a fixed score", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: false,
			error: "no primary document links",
		});
		vi.mocked(quickComplete).mockResolvedValue(JSON.stringify({
			queries: [{ query: "\"BID-2026-001\" filetype:pdf", priority: 10 }],
			fileTypeQueries: [],
		}));
		vi.mocked(searchSearxng).mockResolvedValue({
			query: "\"BID-2026-001\" filetype:pdf",
			number_of_results: 0,
			results: [],
		});
		vi.mocked(searchDocuments).mockResolvedValue([
			{
				title: "Records Platform RFP",
				url: "https://buyer.example/files/BID-2026-001-records-platform-rfp.pdf",
				content: "Buyer Ministry BID-2026-001 tender document for the records platform",
				engine: "bing",
				score: 7,
			},
		]);

		const result = await discoverDocumentsWithAgent("opp-1", 2);

		expect(result.success).toBe(true);
		expect(result.strategiesAttempted).toEqual(["primary_portal", "web_search"]);
		expect(result.strategiesSucceeded).toEqual(["web_search"]);
		expect(result.sources[0]).toEqual(expect.objectContaining({
			confidence: 88,
			source: "searxng_documents",
		}));
		expect(insertedValues).toEqual([
			expect.objectContaining({
				documentName: "Records Platform RFP",
				documentType: "rfp",
				sourceUrl: "https://buyer.example/files/BID-2026-001-records-platform-rfp.pdf",
				isSelected: true,
				description: expect.stringContaining("confidence signals:"),
			}),
		]);
		expect(insertedValues[0]).toEqual(expect.objectContaining({
			description: expect.stringContaining("search engine score"),
		}));
		expect(insertedValues[0]).toEqual(expect.objectContaining({
			description: expect.stringContaining("notice id match"),
		}));
	});

	it("falls back to deterministic search queries when AI returns unusable query rows", async () => {
		firecrawlScrapeMock.mockResolvedValue({
			success: false,
			error: "no primary document links",
		});
		vi.mocked(quickComplete).mockResolvedValue(JSON.stringify({
			queries: [{ purpose: "missing query", priority: 10 }, { query: "   ", priority: 9 }],
			fileTypeQueries: ["", "   "],
		}));
		vi.mocked(searchSearxng).mockImplementation(async (query: string) => ({
			query,
			number_of_results: 1,
			results: [{
				title: "BID-2026-001 Records Platform RFP",
				url: "https://buyer.example/files/BID-2026-001-records-platform-rfp.pdf",
				content: "Buyer Ministry tender document for BID-2026-001 records platform",
				engine: "bing",
				score: 8,
			}],
		}));
		vi.mocked(searchDocuments).mockResolvedValue([]);

		const result = await discoverDocumentsWithAgent("opp-1", 2);

		expect(result.success).toBe(true);
		expect(result.strategiesSucceeded).toEqual(["web_search"]);
		expect(searchSearxng).toHaveBeenCalledWith(
			"\"BID-2026-001\" filetype:pdf",
			expect.objectContaining({
				categories: ["general", "files"],
			})
		);
		expect(vi.mocked(searchSearxng).mock.calls.every(([query]) =>
			typeof query === "string" && query.trim().length > 0
		)).toBe(true);
		expect(insertedValues).toEqual([
			expect.objectContaining({
				documentName: "BID-2026-001 Records Platform RFP",
				sourceUrl: "https://buyer.example/files/BID-2026-001-records-platform-rfp.pdf",
				isSelected: true,
			}),
		]);
	});

	it("caps alternative portal confidence while preserving evidence signals", async () => {
		firecrawlScrapeMock.mockImplementation(async (url: string) => {
			if (url === "https://buyer.example/tenders/records") {
				return { success: true, data: { markdown: "", links: [] } };
			}
			if (url === "https://www.ppip.go.ke/tenders") {
				return {
					success: true,
					data: {
						markdown: "Buyer Ministry BID-2026-001 Records Platform Tender",
						links: ["/downloads/BID-2026-001-records-platform-rfp.pdf"],
					},
				};
			}
			return { success: false, error: "no relevant documents" };
		});
		vi.mocked(quickComplete).mockResolvedValue(JSON.stringify({
			queries: [],
			fileTypeQueries: [],
		}));
		vi.mocked(searchDocuments).mockResolvedValue([]);

		const result = await discoverDocumentsWithAgent("opp-1", 3);

		expect(result.success).toBe(true);
		expect(result.strategiesAttempted).toEqual(["primary_portal", "web_search", "alternative_portals"]);
		expect(result.strategiesSucceeded).toEqual(["alternative_portals"]);
		expect(result.sources[0]).toEqual(expect.objectContaining({
			confidence: 78,
			source: "alternative_portal",
			discoveryMethod: "portal: PPIP Kenya",
		}));
		expect(insertedValues).toEqual([
			expect.objectContaining({
				documentName: "BID-2026-001-records-platform-rfp.pdf",
				sourceUrl: "https://www.ppip.go.ke/downloads/BID-2026-001-records-platform-rfp.pdf",
				isSelected: true,
				description: expect.stringContaining("alternative portal confidence signals:"),
			}),
		]);
		expect(insertedValues[0]).toEqual(expect.objectContaining({
			description: expect.stringContaining("same source host"),
		}));
		expect(insertedValues[0]).toEqual(expect.objectContaining({
			description: expect.stringContaining("notice id match"),
		}));
	});
});
