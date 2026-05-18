import { beforeEach, describe, expect, it, vi } from "vitest";

const dnsLookupMock = vi.hoisted(() =>
	vi.fn<() => Promise<Array<{ address: string; family: 4 | 6 }>>>()
);
const fetchPublicHttpUrlMock = vi.hoisted(() => vi.fn());
const firecrawlIsConfiguredMock = vi.hoisted(() => vi.fn());
const extractFromBasicHtmlMock = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", () => ({
	lookup: dnsLookupMock,
}));
vi.mock("@/lib/security/public-url", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/security/public-url")>();
	return {
		...actual,
		fetchPublicHttpUrl: fetchPublicHttpUrlMock,
	};
});
vi.mock("@/lib/scrapers/firecrawl", () => ({
	firecrawl: {
		isConfigured: firecrawlIsConfiguredMock,
		scrape: vi.fn(),
	},
}));
vi.mock("@/lib/scrapers/extractor", () => ({
	extractFromBasicHtml: extractFromBasicHtmlMock,
	findNextPageUrl: vi.fn(),
}));
vi.mock("@/lib/scrapers/parsers", () => ({
	getParser: vi.fn(() => null),
	genericParser: { parse: vi.fn() },
}));
vi.mock("@/lib/utils/logger", () => ({
	logger: {
		debug: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
	},
}));

import { scrapePage } from "@/lib/scrapers/fetcher";

const source = {
	sourceId: "kenya-tenders",
	name: "Kenya Tenders",
	timeout: 7,
	config: null,
} as any;

describe("scraper public URL guard", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		dnsLookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
		firecrawlIsConfiguredMock.mockReturnValue(false);
		fetchPublicHttpUrlMock.mockResolvedValue(new Response("<html><body>Tenders</body></html>", {
			status: 200,
			headers: { "content-type": "text/html" },
		}));
		extractFromBasicHtmlMock.mockReturnValue([]);
	});

	it("uses the pinned public URL helper for direct scraper fetches", async () => {
		const controller = new AbortController();

		const result = await scrapePage("https://example.com/tenders", source, controller.signal);

		expect(result).toMatchObject({
			url: "https://example.com/tenders",
			statusCode: 200,
			opportunities: [],
		});
		expect(fetchPublicHttpUrlMock).toHaveBeenCalledWith(
			"https://example.com/tenders",
			expect.objectContaining({
				signal: controller.signal,
				timeoutMs: 7000,
				headers: expect.objectContaining({
					"User-Agent": "DocuFusion-Scraper/1.0 (+https://docufusion.ai/bot)",
				}),
			}),
			"Scraper URL",
		);
	});

	it("rejects private scraper targets before any outbound fetch", async () => {
		const result = await scrapePage("http://127.0.0.1/admin", source, new AbortController().signal);

		expect(result).toMatchObject({
			url: "http://127.0.0.1/admin",
			statusCode: 0,
			opportunities: [],
		});
		expect(result.error).toContain("non-public");
		expect(fetchPublicHttpUrlMock).not.toHaveBeenCalled();
	});
});
