import { afterEach, describe, expect, it, vi } from "vitest";

import { getCloakBrowserEndpoint, scrapeWithCloakBrowser } from "@/lib/services/cloakbrowser-scraper-client";

describe("cloakbrowser-scraper-client", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("stays disabled until a CloakBrowser CDP endpoint is configured", async () => {
		vi.stubEnv("CLOAKBROWSER_CDP_URL", "");
		vi.stubEnv("CLOAKBROWSER_WS_ENDPOINT", "");
		vi.stubEnv("CLOAKBROWSER_REMOTE_DEBUGGING_URL", "");

		expect(getCloakBrowserEndpoint()).toBeUndefined();
		await expect(scrapeWithCloakBrowser("https://example.com")).resolves.toEqual({
			success: false,
			error: "CloakBrowser endpoint is not configured",
		});
	});

	it("accepts the standard CloakBrowser CDP endpoint environment variable", () => {
		vi.stubEnv("CLOAKBROWSER_CDP_URL", "ws://127.0.0.1:9222/devtools/browser/test");

		expect(getCloakBrowserEndpoint()).toBe("ws://127.0.0.1:9222/devtools/browser/test");
	});
});
