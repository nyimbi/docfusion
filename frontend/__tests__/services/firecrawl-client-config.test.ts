import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalFirecrawlUrl = process.env.FIRECRAWL_URL;
const originalFirecrawlApiUrl = process.env.FIRECRAWL_API_URL;

beforeEach(() => {
	vi.resetModules();
	vi.unstubAllGlobals();
	delete process.env.FIRECRAWL_URL;
	delete process.env.FIRECRAWL_API_URL;
});

afterEach(() => {
	if (originalFirecrawlUrl === undefined) {
		delete process.env.FIRECRAWL_URL;
	} else {
		process.env.FIRECRAWL_URL = originalFirecrawlUrl;
	}
	if (originalFirecrawlApiUrl === undefined) {
		delete process.env.FIRECRAWL_API_URL;
	} else {
		process.env.FIRECRAWL_API_URL = originalFirecrawlApiUrl;
	}
	vi.unstubAllGlobals();
});

function mockSuccessfulFetch() {
	const fetchMock = vi.fn(async () => ({
		ok: true,
		json: async () => ({ success: true, data: { markdown: "ok" } }),
	}));
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

describe("Firecrawl client configuration", () => {
	it("uses the connectivity host by default", async () => {
		const fetchMock = mockSuccessfulFetch();
		const { FirecrawlClient } = await import("@/lib/scrapers/firecrawl");

		await new FirecrawlClient({ timeout: 1000 }).scrape("https://example.com", {
			formats: ["markdown"],
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"http://84.247.181.100:3002/v1/scrape",
			expect.objectContaining({ method: "POST" })
		);
	});

	it("honors the canonical FIRECRAWL_URL override", async () => {
		process.env.FIRECRAWL_URL = "http://localhost:3002/";
		process.env.FIRECRAWL_API_URL = "http://legacy.example:3002";
		const fetchMock = mockSuccessfulFetch();
		const { FirecrawlClient } = await import("@/lib/scrapers/firecrawl");

		await new FirecrawlClient({ timeout: 1000 }).scrape("https://example.com");

		expect(fetchMock).toHaveBeenCalledWith(
			"http://localhost:3002/v1/scrape",
			expect.objectContaining({ method: "POST" })
		);
	});

	it("accepts legacy FIRECRAWL_API_URL when FIRECRAWL_URL is absent", async () => {
		process.env.FIRECRAWL_API_URL = "http://legacy.example:3002/";
		const fetchMock = mockSuccessfulFetch();
		const { FirecrawlClient } = await import("@/lib/scrapers/firecrawl");

		await new FirecrawlClient({ timeout: 1000 }).scrape("https://example.com");

		expect(fetchMock).toHaveBeenCalledWith(
			"http://legacy.example:3002/v1/scrape",
			expect.objectContaining({ method: "POST" })
		);
	});
});
