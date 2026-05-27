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
});
