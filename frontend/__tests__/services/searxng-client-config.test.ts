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

	it("posts files to the Docling Serve convert-file endpoint", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			json: async () => ({
				status: "success",
				document: {
					filename: "rfp.pdf",
					md_content: "# Tender\n\nSubmission instructions",
					text_content: "Tender Submission instructions",
				},
				errors: [],
				processing_time: 0.25,
			}),
		}));
		vi.stubGlobal("fetch", fetchMock);

		const { convertDocument } = await import("@/lib/services/docling-client");

		const result = await convertDocument(Buffer.from("pdf-bytes"), "rfp.pdf", {
			outputFormat: "text",
			ocr: false,
			extractTables: false,
			extractImages: false,
			pageRange: [1, 2],
			documentTimeoutSeconds: 30,
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"http://84.247.181.100:3600/v1/convert/file",
			expect.objectContaining({
				method: "POST",
				body: expect.any(FormData),
			})
		);
		const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		const body = requestInit.body as FormData;
		expect(body.get("target_type")).toBe("inbody");
		expect(body.get("to_formats")).toBe("text");
		expect(body.get("do_ocr")).toBe("false");
		expect(body.get("do_table_structure")).toBe("false");
		expect(body.get("include_images")).toBe("false");
		expect(body.getAll("page_range")).toEqual(["1", "2"]);
		expect(body.get("document_timeout")).toBe("30");
		expect(body.get("files")).toBeInstanceOf(Blob);
		expect(result).toMatchObject({
			status: "success",
			text: "Tender Submission instructions",
			markdown: "# Tender\n\nSubmission instructions",
			metadata: {
				title: "rfp.pdf",
			},
		});
	});
});
