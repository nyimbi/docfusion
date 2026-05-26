import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalSearxngUrl = process.env.SEARXNG_URL;
const originalDoclingUrl = process.env.DOCLING_URL;

beforeEach(() => {
	vi.resetModules();
	vi.unstubAllGlobals();
	delete process.env.SEARXNG_URL;
	delete process.env.DOCLING_URL;
});

afterEach(() => {
	if (originalSearxngUrl === undefined) {
		delete process.env.SEARXNG_URL;
	} else {
		process.env.SEARXNG_URL = originalSearxngUrl;
	}
	if (originalDoclingUrl === undefined) {
		delete process.env.DOCLING_URL;
	} else {
		process.env.DOCLING_URL = originalDoclingUrl;
	}
	vi.unstubAllGlobals();
});

describe("SearXNG client configuration", () => {
	it("uses the public Lindela search host by default", async () => {
		const fetchMock = vi.fn(async () => ({ ok: true }));
		vi.stubGlobal("fetch", fetchMock);

		const { checkSearxngHealth } = await import("@/lib/services/searxng-client");

		await expect(checkSearxngHealth()).resolves.toBe(true);
		expect(fetchMock).toHaveBeenCalledWith("https://search.lindela.io/health", expect.any(Object));
	});

	it("honors explicit SEARXNG_URL overrides", async () => {
		process.env.SEARXNG_URL = "http://localhost:8888";
		const fetchMock = vi.fn(async () => ({ ok: true }));
		vi.stubGlobal("fetch", fetchMock);

		const { checkSearxngHealth } = await import("@/lib/services/searxng-client");

		await expect(checkSearxngHealth()).resolves.toBe(true);
		expect(fetchMock).toHaveBeenCalledWith("http://localhost:8888/health", expect.any(Object));
	});

	it("falls back to a JSON search probe when /health is unavailable", async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce({ ok: false, status: 404 })
			.mockResolvedValueOnce({ ok: true, status: 200 });
		vi.stubGlobal("fetch", fetchMock);

		const { checkSearxngHealth } = await import("@/lib/services/searxng-client");

		await expect(checkSearxngHealth()).resolves.toBe(true);
		expect(fetchMock).toHaveBeenNthCalledWith(1, "https://search.lindela.io/health", expect.any(Object));
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://search.lindela.io/search?q=rfp&format=json",
			expect.objectContaining({
				headers: {
					"Accept": "application/json",
				},
			})
		);
	});

	it("passes explicit engine filters to SearXNG search", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			json: async () => ({ query: "rfp", number_of_results: 0, results: [] }),
		}));
		vi.stubGlobal("fetch", fetchMock);

		const { searchSearxng } = await import("@/lib/services/searxng-client");

		await searchSearxng("rfp", { engines: ["bing", "wikipedia"], safesearch: 1 });

		const [requested] = fetchMock.mock.calls[0] as unknown as [string, RequestInit?];
		const requestedUrl = new URL(requested);
		expect(requestedUrl.searchParams.get("engines")).toBe("bing,wikipedia");
		expect(requestedUrl.searchParams.get("safesearch")).toBe("1");
	});
});

describe("Docling client configuration", () => {
	it("uses the connectivity host by default", async () => {
		const fetchMock = vi.fn(async () => ({ ok: true }));
		vi.stubGlobal("fetch", fetchMock);

		const { checkDoclingHealth } = await import("@/lib/services/docling-client");

		await expect(checkDoclingHealth()).resolves.toBe(true);
		expect(fetchMock).toHaveBeenCalledWith("http://84.247.181.100:3600/health", expect.any(Object));
	});
});
