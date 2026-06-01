import { afterEach, describe, expect, it, vi } from "vitest";

const connectOverCDPMock = vi.hoisted(() => vi.fn());
const cloakLaunchMock = vi.hoisted(() => vi.fn());

vi.mock("playwright-core", () => ({
	chromium: {
		connectOverCDP: connectOverCDPMock,
	},
}));

vi.mock("cloakbrowser", () => ({
	launch: cloakLaunchMock,
}));

import {
	getCloakBrowserEndpoint,
	isCloakBrowserScraperConfigured,
	isLocalCloakBrowserLaunchEnabled,
	scrapeWithCloakBrowser,
} from "@/lib/services/cloakbrowser-scraper-client";

describe("cloakbrowser-scraper-client", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.clearAllMocks();
	});

	it("stays disabled until a CloakBrowser CDP endpoint is configured", async () => {
		vi.stubEnv("CLOAKBROWSER_CDP_URL", "");
		vi.stubEnv("CLOAKBROWSER_WS_ENDPOINT", "");
		vi.stubEnv("CLOAKBROWSER_REMOTE_DEBUGGING_URL", "");
		vi.stubEnv("CLOAKBROWSER_LOCAL_LAUNCH", "");

		expect(getCloakBrowserEndpoint()).toBeUndefined();
		expect(isLocalCloakBrowserLaunchEnabled()).toBe(false);
		expect(isCloakBrowserScraperConfigured()).toBe(false);
		await expect(scrapeWithCloakBrowser("https://example.com")).resolves.toEqual({
			success: false,
			error: "CloakBrowser endpoint is not configured and local launch is disabled",
		});
	});

	it("accepts the standard CloakBrowser CDP endpoint environment variable", () => {
		vi.stubEnv("CLOAKBROWSER_CDP_URL", "ws://127.0.0.1:9222/devtools/browser/test");

		expect(getCloakBrowserEndpoint()).toBe("ws://127.0.0.1:9222/devtools/browser/test");
		expect(isCloakBrowserScraperConfigured()).toBe(true);
	});

	it("can launch a local CloakBrowser instance when explicitly enabled", async () => {
		vi.stubEnv("CLOAKBROWSER_CDP_URL", "");
		vi.stubEnv("CLOAKBROWSER_WS_ENDPOINT", "");
		vi.stubEnv("CLOAKBROWSER_REMOTE_DEBUGGING_URL", "");
		vi.stubEnv("CLOAKBROWSER_LOCAL_LAUNCH", "1");
		vi.stubEnv("CLOAKBROWSER_EXTRA_ARGS", "--disable-dev-shm-usage");

		const page = {
			goto: vi.fn().mockResolvedValue({ status: () => 200 }),
			mouse: { wheel: vi.fn() },
			waitForTimeout: vi.fn().mockResolvedValue(undefined),
			waitForLoadState: vi.fn().mockResolvedValue(undefined),
			content: vi.fn().mockResolvedValue("<html><body>Rendered tender page</body></html>"),
			title: vi.fn().mockResolvedValue("Rendered tender page"),
			locator: vi.fn().mockReturnValue({
				innerText: vi.fn().mockResolvedValue("Rendered tender page with procurement details"),
			}),
			$$eval: vi.fn().mockResolvedValue(["https://example.com/rfp.pdf"]),
		};
		const context = {
			route: vi.fn().mockResolvedValue(undefined),
			unroute: vi.fn().mockResolvedValue(undefined),
			newPage: vi.fn().mockResolvedValue(page),
		};
		const browser = {
			contexts: vi.fn().mockReturnValue([]),
			newContext: vi.fn().mockResolvedValue(context),
			close: vi.fn().mockResolvedValue(undefined),
		};
		cloakLaunchMock.mockResolvedValue(browser);

		await expect(scrapeWithCloakBrowser("https://example.com/tender", {
			blockMedia: true,
			humanScroll: true,
			timeout: 12000,
		})).resolves.toMatchObject({
			success: true,
			data: {
				markdown: "Rendered tender page with procurement details",
				links: ["https://example.com/rfp.pdf"],
				metadata: {
					title: "Rendered tender page",
					statusCode: 200,
				},
			},
		});
		expect(connectOverCDPMock).not.toHaveBeenCalled();
		expect(cloakLaunchMock).toHaveBeenCalledWith(expect.objectContaining({
			headless: true,
			humanize: true,
			args: expect.arrayContaining(["--disable-dev-shm-usage"]),
			launchOptions: { timeout: 12000 },
		}));
		expect(context.route).toHaveBeenCalled();
		expect(page.mouse.wheel).toHaveBeenCalledWith(0, 900);
		expect(browser.close).toHaveBeenCalled();
	});
});
