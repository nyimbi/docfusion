import { chromium, type Browser, type BrowserContext } from "playwright-core";

export interface CloakBrowserScrapeOptions {
	timeout?: number;
	humanScroll?: boolean;
	blockMedia?: boolean;
}

export interface CloakBrowserScrapeResult {
	success: boolean;
	data?: {
		markdown?: string;
		html?: string;
		links?: string[];
		metadata?: {
			title?: string;
			statusCode?: number;
		};
	};
	error?: string;
}

export function getCloakBrowserEndpoint(): string | undefined {
	const endpoint = process.env.CLOAKBROWSER_CDP_URL
		?? process.env.CLOAKBROWSER_WS_ENDPOINT
		?? process.env.CLOAKBROWSER_REMOTE_DEBUGGING_URL;
	return endpoint?.trim() || undefined;
}

export async function scrapeWithCloakBrowser(
	url: string,
	options: CloakBrowserScrapeOptions = {}
): Promise<CloakBrowserScrapeResult> {
	const endpoint = getCloakBrowserEndpoint();
	if (!endpoint) {
		return {
			success: false,
			error: "CloakBrowser endpoint is not configured",
		};
	}

	let browser: Browser | undefined;
	let context: BrowserContext | undefined;
	try {
		const timeout = options.timeout ?? 60000;
		browser = await chromium.connectOverCDP(endpoint, { timeout });
		context = browser.contexts()[0] ?? await browser.newContext();
		if (options.blockMedia) {
			await context.route("**/*", async (route) => {
				const resourceType = route.request().resourceType();
				if (resourceType === "image" || resourceType === "media" || resourceType === "font") {
					await route.abort();
					return;
				}
				await route.continue();
			});
		}

		const page = await context.newPage();
		const response = await page.goto(url, {
			timeout,
			waitUntil: "domcontentloaded",
		});
		if (options.humanScroll) {
			await page.mouse.wheel(0, 900);
			await page.waitForTimeout(750);
			await page.mouse.wheel(0, -250);
		}
		await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 15000) }).catch(() => undefined);

		const [html, title, markdown, links] = await Promise.all([
			page.content(),
			page.title().catch(() => undefined),
			page.locator("body").innerText({ timeout: 5000 }).catch(() => ""),
			page.$$eval("a[href]", (anchors) => anchors
				.map((anchor) => (anchor as HTMLAnchorElement).href)
				.filter(Boolean)).catch(() => []),
		]);

		return {
			success: Boolean(markdown.trim() || html.trim()),
			data: {
				markdown,
				html,
				links,
				metadata: {
					title,
					statusCode: response?.status(),
				},
			},
			...(!markdown.trim() && !html.trim() ? { error: "CloakBrowser returned no page content" } : {}),
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	} finally {
		await context?.unroute("**/*").catch(() => undefined);
		await browser?.close().catch(() => undefined);
	}
}
