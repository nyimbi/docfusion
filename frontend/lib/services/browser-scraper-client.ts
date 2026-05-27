export interface BrowserScrapeOptions {
	timeout?: number;
	humanScroll?: boolean;
	blockMedia?: boolean;
	formats?: Array<"markdown" | "html" | "links">;
	signal?: AbortSignal;
}

export interface BrowserScrapeResult {
	success: boolean;
	data?: {
		markdown?: string;
		html?: string;
		links?: string[];
		metadata?: {
			title?: string;
			description?: string;
			statusCode?: number;
		};
	};
	error?: string;
}

interface BrowserScrapeEndpoint {
	path: string;
	body: Record<string, unknown>;
}

export async function scrapeWithBrowserService(
	baseUrl: string,
	url: string,
	options: BrowserScrapeOptions = {}
): Promise<BrowserScrapeResult> {
	const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
	const timeoutSignal = AbortSignal.timeout((options.timeout ?? 15000) + 5000);
	const signal = options.signal ? combineAbortSignals([options.signal, timeoutSignal]) : timeoutSignal;
	const endpoints: BrowserScrapeEndpoint[] = [
		{
			path: "/v1/scrape",
			body: {
				url,
				options: {
					timeout: options.timeout,
					humanScroll: options.humanScroll,
					blockMedia: options.blockMedia,
					formats: options.formats,
				},
			},
		},
		{
			path: "/scrape",
			body: {
				url,
				formats: options.formats ?? ["markdown", "html"],
				timeout: options.timeout,
			},
		},
	];
	const errors: string[] = [];

	for (const endpoint of endpoints) {
		try {
			const response = await fetch(`${normalizedBaseUrl}${endpoint.path}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(endpoint.body),
				signal,
			});

			if (!response.ok) {
				errors.push(`${endpoint.path} ${response.status}: ${await response.text()}`);
				continue;
			}

			return normalizeBrowserScrapeResponse(await response.json());
		} catch (error) {
			errors.push(`${endpoint.path}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	return {
		success: false,
		error: errors.join("; ") || "Browser scraper failed",
	};
}

function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
	const controller = new AbortController();
	const abort = () => {
		if (!controller.signal.aborted) {
			controller.abort();
		}
	};

	for (const signal of signals) {
		if (signal.aborted) {
			abort();
			break;
		}
		signal.addEventListener("abort", abort, { once: true });
	}

	return controller.signal;
}

function normalizeBrowserScrapeResponse(value: unknown): BrowserScrapeResult {
	if (!value || typeof value !== "object") {
		return { success: false, error: "Browser scraper returned an invalid response" };
	}

	const record = value as Record<string, unknown>;
	if ("data" in record) {
		return record as unknown as BrowserScrapeResult;
	}

	const content = typeof record.content === "string" ? record.content : "";
	const pageStatusCode = typeof record.pageStatusCode === "number" ? record.pageStatusCode : 200;
	if (!content || pageStatusCode >= 400) {
		return {
			success: false,
			error: typeof record.error === "string" ? record.error : `Browser scraper returned status ${pageStatusCode}`,
		};
	}

	return {
		success: true,
		data: {
			markdown: content,
			html: content,
			links: extractHrefLinks(content),
			metadata: {
				title: extractTitle(content),
				statusCode: pageStatusCode,
			},
		},
	};
}

function extractHrefLinks(html: string): string[] {
	return [...html.matchAll(/\bhref=["']([^"']+)["']/gi)]
		.map((match) => match[1])
		.filter((value): value is string => Boolean(value));
}

function extractTitle(html: string): string | undefined {
	const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
	return match?.[1]?.trim();
}
