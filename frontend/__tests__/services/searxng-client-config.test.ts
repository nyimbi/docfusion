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
