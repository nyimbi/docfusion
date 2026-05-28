import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalSearxngUrl = process.env.SEARXNG_URL;
const originalSearxngFallbackUrls = process.env.SEARXNG_FALLBACK_URLS;
const originalSearxngPublicFallbacks = process.env.SEARXNG_PUBLIC_FALLBACKS;
const originalSearxngPublicFallbackLimit = process.env.SEARXNG_PUBLIC_FALLBACK_LIMIT;
const originalSearxngSpaceInstancesUrl = process.env.SEARXNG_SPACE_INSTANCES_URL;
const originalDoclingUrl = process.env.DOCLING_URL;

beforeEach(() => {
	vi.resetModules();
	vi.unstubAllGlobals();
	delete process.env.SEARXNG_URL;
	delete process.env.SEARXNG_FALLBACK_URLS;
	delete process.env.SEARXNG_PUBLIC_FALLBACKS;
	delete process.env.SEARXNG_PUBLIC_FALLBACK_LIMIT;
	delete process.env.SEARXNG_SPACE_INSTANCES_URL;
	delete process.env.DOCLING_URL;
});

afterEach(() => {
	if (originalSearxngUrl === undefined) {
		delete process.env.SEARXNG_URL;
	} else {
		process.env.SEARXNG_URL = originalSearxngUrl;
	}
	if (originalSearxngFallbackUrls === undefined) {
		delete process.env.SEARXNG_FALLBACK_URLS;
	} else {
		process.env.SEARXNG_FALLBACK_URLS = originalSearxngFallbackUrls;
	}
	if (originalSearxngPublicFallbacks === undefined) {
		delete process.env.SEARXNG_PUBLIC_FALLBACKS;
	} else {
		process.env.SEARXNG_PUBLIC_FALLBACKS = originalSearxngPublicFallbacks;
	}
	if (originalSearxngPublicFallbackLimit === undefined) {
		delete process.env.SEARXNG_PUBLIC_FALLBACK_LIMIT;
	} else {
		process.env.SEARXNG_PUBLIC_FALLBACK_LIMIT = originalSearxngPublicFallbackLimit;
	}
	if (originalSearxngSpaceInstancesUrl === undefined) {
		delete process.env.SEARXNG_SPACE_INSTANCES_URL;
	} else {
		process.env.SEARXNG_SPACE_INSTANCES_URL = originalSearxngSpaceInstancesUrl;
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
		const [fallbackUrl, fallbackOptions] = fetchMock.mock.calls[1] as unknown as [string, RequestInit?];
		const parsedFallbackUrl = new URL(fallbackUrl);
		expect(parsedFallbackUrl.origin).toBe("https://search.lindela.io");
		expect(parsedFallbackUrl.pathname).toBe("/search");
		expect(parsedFallbackUrl.searchParams.get("q")).toBe("tenders.go.ke");
		expect(parsedFallbackUrl.searchParams.get("format")).toBe("json");
		expect(parsedFallbackUrl.searchParams.get("engines")).toBe("bing");
		expect(parsedFallbackUrl.searchParams.get("language")).toBe("en");
		expect(parsedFallbackUrl.searchParams.get("safesearch")).toBe("1");
		expect(fallbackOptions).toEqual(expect.objectContaining({
			headers: {
				"Accept": "application/json",
			},
		}));
	});

	it("passes explicit engine filters to SearXNG search", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({
			query: "rfp",
			number_of_results: 0,
			results: [],
		}), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const { searchSearxng } = await import("@/lib/services/searxng-client");

		await searchSearxng("rfp", { engines: ["bing", "wikipedia"], safesearch: 1 });

		const [requested] = fetchMock.mock.calls[0] as unknown as [string, RequestInit?];
		const requestedUrl = new URL(requested);
		expect(requestedUrl.searchParams.get("engines")).toBe("bing,wikipedia");
		expect(requestedUrl.searchParams.get("safesearch")).toBe("1");
	});

	it("can omit the JSON Accept header for engines that reject it", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({
			query: "afdb",
			number_of_results: 0,
			results: [],
		}), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const { searchSearxng } = await import("@/lib/services/searxng-client");

		await searchSearxng("afdb", { sendAcceptHeader: false });

		const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit?];
		expect(requestInit).toEqual(expect.not.objectContaining({
			headers: expect.anything(),
		}));
	});

	it("parses SearXNG HTML results when a reachable instance does not return JSON", async () => {
		const fetchMock = vi.fn(async () => new Response(`
			<!doctype html>
			<html>
				<body>
					<article class="result result-default">
						<h3><a href="https://buyer.example/rfp#overview">Records Platform RFP</a></h3>
						<p class="content">Request for proposals for records platform implementation.</p>
						<span class="engine">duckduckgo</span>
					</article>
				</body>
			</html>
		`, {
			status: 200,
			headers: { "content-type": "text/html" },
		}));
		vi.stubGlobal("fetch", fetchMock);

		const { searchSearxng } = await import("@/lib/services/searxng-client");

		const result = await searchSearxng("records platform rfp", { engines: ["duckduckgo"] });

		expect(result).toMatchObject({
			sourceInstance: "https://search.lindela.io",
			number_of_results: 1,
			results: [{
				title: "Records Platform RFP",
				url: "https://buyer.example/rfp",
				content: "Request for proposals for records platform implementation.",
				engine: "duckduckgo",
			}],
		});
	});

	it("falls back to configured SearXNG instances when the primary search fails", async () => {
		process.env.SEARXNG_URL = "https://primary.example";
		process.env.SEARXNG_FALLBACK_URLS = "https://fallback.example";
		process.env.SEARXNG_PUBLIC_FALLBACKS = "0";
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(new Response("bad gateway", { status: 502, statusText: "Bad Gateway" }))
			.mockResolvedValueOnce(new Response(JSON.stringify({
				query: "rfp",
				number_of_results: 1,
				results: [{
					title: "Fallback RFP",
					url: "https://buyer.example/rfp",
					content: "Request for proposals",
					engine: "bing",
					score: 1,
				}],
			}), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const { searchSearxng } = await import("@/lib/services/searxng-client");

		const result = await searchSearxng("rfp", { engines: ["bing"] });

		expect(result).toMatchObject({
			sourceInstance: "https://fallback.example",
			fallbackFrom: "https://primary.example",
			results: [expect.objectContaining({ title: "Fallback RFP" })],
		});
		expect(new URL(fetchMock.mock.calls[0][0] as string).origin).toBe("https://primary.example");
		expect(new URL(fetchMock.mock.calls[1][0] as string).origin).toBe("https://fallback.example");
	});

	it("uses healthy searx.space instances when the primary has degraded engine fanout", async () => {
		process.env.SEARXNG_URL = "https://primary.example";
		process.env.SEARXNG_SPACE_INSTANCES_URL = "https://searx.space/data/instances.json";
		process.env.SEARXNG_PUBLIC_FALLBACK_LIMIT = "1";
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({
				query: "rfp",
				number_of_results: 0,
				results: [],
				unresponsive_engines: [{ engine: "google", error: "access denied" }],
			}), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({
				instances: {
					"https://dead.example/": {
						error: "certificate expired",
						http: { status_code: null, error: "certificate expired" },
					},
					"https://healthy.example/": {
						network_type: "normal",
						git_url: "https://github.com/searxng/searxng",
						http: { status_code: 200 },
						timing: { search: { all: { median: 0.2 } } },
					},
				},
			}), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({
				query: "rfp",
				number_of_results: 1,
				results: [{
					title: "Recovered Google RFP",
					url: "https://buyer.example/recovered",
					content: "Request for proposals",
					engine: "google",
					score: 2,
				}],
			}), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const { searchSearxng } = await import("@/lib/services/searxng-client");

		const result = await searchSearxng("rfp", { engines: ["google"] });

		expect(result).toMatchObject({
			sourceInstance: "https://healthy.example",
			fallbackFrom: "https://primary.example",
			fallbackReason: expect.stringContaining("google"),
			results: [expect.objectContaining({ title: "Recovered Google RFP" })],
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(fetchMock.mock.calls[1][0]).toBe("https://searx.space/data/instances.json");
		expect(new URL(fetchMock.mock.calls[2][0] as string).origin).toBe("https://healthy.example");
	});

	it("fans out across multiple searx.space fallback instances and dedupes results", async () => {
		process.env.SEARXNG_URL = "https://primary.example";
		process.env.SEARXNG_SPACE_INSTANCES_URL = "https://searx.space/data/instances.json";
		process.env.SEARXNG_PUBLIC_FALLBACK_LIMIT = "2";
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({
				query: "rfp",
				number_of_results: 0,
				results: [],
				unresponsive_engines: [{ engine: "google", error: "access denied" }],
			}), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({
				instances: {
					"https://slow.example/": {
						network_type: "normal",
						git_url: "https://github.com/searxng/searxng",
						http: { status_code: 200 },
						timing: { search: { all: { median: 0.9 } } },
					},
					"https://fast.example/": {
						network_type: "normal",
						git_url: "https://github.com/searxng/searxng",
						http: { status_code: 200 },
						timing: { search: { all: { median: 0.1 } } },
					},
				},
			}), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({
				query: "rfp",
				number_of_results: 2,
				results: [
					{
						title: "Shared RFP",
						url: "https://buyer.example/shared#section",
						content: "Request for proposals",
						engine: "google",
						score: 2,
					},
					{
						title: "Fast RFP",
						url: "https://buyer.example/fast",
						content: "Tender notice",
						engine: "duckduckgo",
						score: 1.5,
					},
				],
			}), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({
				query: "rfp",
				number_of_results: 2,
				results: [
					{
						title: "Shared RFP copy",
						url: "https://buyer.example/shared",
						content: "Request for proposals",
						engine: "bing",
						score: 1.8,
					},
					{
						title: "Slow RFP",
						url: "https://buyer.example/slow",
						content: "Procurement bid",
						engine: "brave",
						score: 1.2,
					},
				],
			}), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const { searchSearxng } = await import("@/lib/services/searxng-client");

		const result = await searchSearxng("rfp", { engines: ["google"] });

		expect(result).toMatchObject({
			sourceInstance: "https://fast.example",
			sourceInstances: ["https://fast.example", "https://slow.example"],
			fallbackFrom: "https://primary.example",
			number_of_results: 3,
		});
		expect(result.results.map((item) => item.url)).toEqual([
			"https://buyer.example/shared#section",
			"https://buyer.example/fast",
			"https://buyer.example/slow",
		]);
		expect(fetchMock).toHaveBeenCalledTimes(4);
		expect(new URL(fetchMock.mock.calls[2][0] as string).origin).toBe("https://fast.example");
		expect(new URL(fetchMock.mock.calls[3][0] as string).origin).toBe("https://slow.example");
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
