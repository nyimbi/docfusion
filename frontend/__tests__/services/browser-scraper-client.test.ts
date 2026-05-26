import { beforeEach, describe, expect, it, vi } from "vitest";

import { scrapeWithBrowserService } from "@/lib/services/browser-scraper-client";

const fetchMock = vi.hoisted(() => vi.fn());

describe("scrapeWithBrowserService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", fetchMock);
	});

	it("uses the legacy /v1/scrape response when available", async () => {
		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
			success: true,
			data: {
				markdown: "# Tender Notice",
				links: ["https://buyer.example/rfp.pdf"],
				metadata: { title: "Tender Notice" },
			},
		}), { status: 200 }));

		const result = await scrapeWithBrowserService("http://browser.example", "https://buyer.example/tender", {
			timeout: 15000,
			humanScroll: true,
			blockMedia: true,
		});

		expect(result).toMatchObject({
			success: true,
			data: {
				markdown: "# Tender Notice",
				links: ["https://buyer.example/rfp.pdf"],
				metadata: { title: "Tender Notice" },
			},
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			"http://browser.example/v1/scrape",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					url: "https://buyer.example/tender",
					options: {
						timeout: 15000,
						humanScroll: true,
						blockMedia: true,
					},
				}),
			}),
		);
	});

	it("falls back to the deployed /scrape response shape", async () => {
		fetchMock
			.mockResolvedValueOnce(new Response("not found", { status: 404 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({
				content: "<html><head><title>Example Tender</title></head><body><a href=\"/rfp.pdf\">RFP</a></body></html>",
				pageStatusCode: 200,
				contentType: "text/html",
			}), { status: 200 }));

		const result = await scrapeWithBrowserService("http://browser.example/", "https://buyer.example/tender", {
			timeout: 20000,
		});

		expect(result).toMatchObject({
			success: true,
			data: {
				markdown: expect.stringContaining("Example Tender"),
				html: expect.stringContaining("Example Tender"),
				links: ["/rfp.pdf"],
				metadata: {
					title: "Example Tender",
					statusCode: 200,
				},
			},
		});
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"http://browser.example/scrape",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					url: "https://buyer.example/tender",
					formats: ["markdown", "html"],
					timeout: 20000,
				}),
			}),
		);
	});
});
