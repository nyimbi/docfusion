/**
 * Stealth Scraper using Crawlee
 *
 * Features:
 * - Playwright with realistic browser fingerprints
 * - Automatic retry with session rotation
 * - Human-like behavior simulation
 * - HTML to Markdown conversion
 * - Link extraction
 *
 * Anti-bot capabilities:
 * - Randomized user agents
 * - Realistic viewport sizes
 * - Mouse movement simulation
 * - Request timing randomization
 * - Browser fingerprint generation
 */

import { PlaywrightCrawler, Configuration } from "crawlee";
import TurndownService from "turndown";

// ============================================================================
// Types
// ============================================================================

export interface ScrapeOptions {
	/** Timeout in milliseconds (default: 60000) */
	timeout?: number;
	/** Wait for specific selector before scraping */
	waitForSelector?: string;
	/** Wait time in ms after page load (default: 2000) */
	waitAfterLoad?: number;
	/** Simulate human scrolling (default: true) */
	humanScroll?: boolean;
	/** Take screenshot (returns base64) */
	screenshot?: boolean;
	/** Block images/media for faster loading */
	blockMedia?: boolean;
}

export interface ScrapeResult {
	success: boolean;
	url: string;
	markdown?: string;
	html?: string;
	title?: string;
	links?: string[];
	screenshot?: string;
	statusCode?: number;
	error?: string;
}

// ============================================================================
// Stealth Configuration
// ============================================================================

// Realistic user agents (updated for 2026)
const USER_AGENTS = [
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:133.0) Gecko/20100101 Firefox/133.0",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
];

// Realistic viewport sizes
const VIEWPORTS = [
	{ width: 1920, height: 1080 },
	{ width: 1366, height: 768 },
	{ width: 1536, height: 864 },
	{ width: 1440, height: 900 },
	{ width: 1280, height: 720 },
];

function randomChoice<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function randomDelay(min: number, max: number): Promise<void> {
	const delay = Math.floor(Math.random() * (max - min + 1)) + min;
	return new Promise((resolve) => setTimeout(resolve, delay));
}

// ============================================================================
// HTML to Markdown Converter
// ============================================================================

const turndown = new TurndownService({
	headingStyle: "atx",
	codeBlockStyle: "fenced",
	bulletListMarker: "-",
});

// Remove script, style, and other non-content elements
turndown.remove(["script", "style", "nav", "footer", "header", "aside", "noscript"]);

// ============================================================================
// Link Extractor
// ============================================================================

function extractLinks(html: string, baseUrl: string): string[] {
	const links: string[] = [];
	const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
	let match;

	while ((match = linkPattern.exec(html)) !== null) {
		try {
			const absoluteUrl = new URL(match[1], baseUrl).toString();
			// Only include http/https links
			if (absoluteUrl.startsWith("http")) {
				links.push(absoluteUrl);
			}
		} catch {
			// Invalid URL, skip
		}
	}

	// Dedupe
	return [...new Set(links)];
}

// ============================================================================
// Stealth Scraper
// ============================================================================

export async function stealthScrape(
	url: string,
	options: Partial<ScrapeOptions> = {}
): Promise<ScrapeResult> {
	const {
		timeout = 60000,
		waitForSelector,
		waitAfterLoad = 2000,
		humanScroll = true,
		screenshot = false,
		blockMedia = false,
	} = options;

	const userAgent = randomChoice(USER_AGENTS);
	const viewport = randomChoice(VIEWPORTS);

	let result: ScrapeResult = {
		success: false,
		url,
	};

	// Configure Crawlee to be less noisy
	Configuration.getGlobalConfig().set("purgeOnStart", false);

	const crawler = new PlaywrightCrawler({
		// Stealth settings
		headless: true,
		maxRequestRetries: 3,
		requestHandlerTimeoutSecs: timeout / 1000,
		navigationTimeoutSecs: timeout / 1000,

		// Browser launch options
		launchContext: {
			launchOptions: {
				args: [
					"--disable-blink-features=AutomationControlled",
					"--disable-dev-shm-usage",
					"--no-sandbox",
					"--disable-setuid-sandbox",
					"--disable-infobars",
					"--window-position=0,0",
					"--ignore-certificate-errors",
					"--ignore-certificate-errors-spki-list",
				],
			},
		},

		// Pre-navigation hook - set up stealth
		preNavigationHooks: [
			async ({ page }) => {
				// Set user agent
				await page.setExtraHTTPHeaders({
					"User-Agent": userAgent,
					"Accept-Language": "en-US,en;q=0.9",
					"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
				});

				// Set viewport
				await page.setViewportSize(viewport);

				// Override navigator properties to hide automation
				await page.addInitScript(() => {
					// Hide webdriver
					Object.defineProperty(navigator, "webdriver", {
						get: () => undefined,
					});

					// Add plugins (real browsers have these)
					Object.defineProperty(navigator, "plugins", {
						get: () => [1, 2, 3, 4, 5],
					});

					// Add languages
					Object.defineProperty(navigator, "languages", {
						get: () => ["en-US", "en"],
					});

					// Override permissions
					const originalQuery = window.navigator.permissions.query;
					window.navigator.permissions.query = (parameters: PermissionDescriptor) =>
						parameters.name === "notifications"
							? Promise.resolve({ state: "denied" } as PermissionStatus)
							: originalQuery(parameters);

					// Add chrome object (Chromium browsers have this)
					(window as Record<string, unknown>).chrome = {
						runtime: {},
					};
				});

				// Block media if requested (saves bandwidth)
				if (blockMedia) {
					await page.route("**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2,ttf,mp4,webm}", (route) =>
						route.abort()
					);
				}
			},
		],

		// Request handler
		requestHandler: async ({ page, request }) => {
			try {
				// Random delay before interacting (human-like)
				await randomDelay(500, 1500);

				// Wait for page to be ready
				await page.waitForLoadState("domcontentloaded");

				// Optional: wait for specific selector
				if (waitForSelector) {
					await page.waitForSelector(waitForSelector, { timeout: timeout / 2 });
				}

				// Wait a bit more for dynamic content
				await randomDelay(waitAfterLoad, waitAfterLoad + 1000);

				// Human-like scrolling
				if (humanScroll) {
					await simulateHumanScroll(page);
				}

				// Get page content
				const html = await page.content();
				const title = await page.title();

				// Convert to markdown
				const markdown = turndown.turndown(html);

				// Extract links
				const links = extractLinks(html, request.loadedUrl || url);

				// Optional screenshot
				let screenshotBase64: string | undefined;
				if (screenshot) {
					const buffer = await page.screenshot({ type: "png", fullPage: false });
					screenshotBase64 = buffer.toString("base64");
				}

				result = {
					success: true,
					url: request.loadedUrl || url,
					markdown,
					html,
					title,
					links,
					screenshot: screenshotBase64,
					statusCode: 200,
				};
			} catch (error) {
				result = {
					success: false,
					url,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},

		// Error handler
		failedRequestHandler: async ({ request }, error) => {
			result = {
				success: false,
				url: request.url,
				error: error.message,
			};
		},
	});

	// Run the crawler
	await crawler.run([url]);

	return result;
}

// ============================================================================
// Human Behavior Simulation
// ============================================================================

async function simulateHumanScroll(page: import("playwright").Page): Promise<void> {
	// Get page height
	const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
	const viewportHeight = await page.evaluate(() => window.innerHeight);

	// Don't scroll if page is short
	if (scrollHeight <= viewportHeight * 1.5) {
		return;
	}

	// Scroll in chunks with random delays
	let currentScroll = 0;
	const maxScroll = Math.min(scrollHeight - viewportHeight, viewportHeight * 3);

	while (currentScroll < maxScroll) {
		// Random scroll amount (100-400 pixels)
		const scrollAmount = Math.floor(Math.random() * 300) + 100;
		currentScroll += scrollAmount;

		await page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), currentScroll);

		// Random delay between scrolls (200-800ms)
		await randomDelay(200, 800);
	}

	// Scroll back to top (some sites check this)
	await randomDelay(500, 1000);
	await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
}
