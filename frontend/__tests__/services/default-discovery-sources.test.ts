import { describe, expect, it } from "vitest";

import {
	DEFAULT_DISCOVERY_SOURCE_URLS,
	withDefaultDiscoveryRuntimeOptions,
} from "@/lib/services/default-discovery-sources";

describe("default discovery sources", () => {
	it("preloads live-proven configured procurement sources", () => {
		expect(DEFAULT_DISCOVERY_SOURCE_URLS).toEqual([
			"https://tenders.go.ke/tenders",
			"https://www.ungm.org/Public/Notice",
			"https://procurement-notices.undp.org",
			"https://projects.worldbank.org/en/projects-operations/procurement",
			"https://www.afdb.org/en/projects-and-operations/procurement",
			"https://www.comesa.int/category/open-tenders/",
			"https://www.un.org/procurement/solicitations-opportunities",
			"https://www.unicef.org/supply/service-contracts-tender-calendar",
			"https://www.unicef.org/supply/tender-calendars",
		]);
		expect(new Set(DEFAULT_DISCOVERY_SOURCE_URLS).size).toBe(DEFAULT_DISCOVERY_SOURCE_URLS.length);
	});

	it("keeps scheduled and legacy discovery inputs on source-document defaults", () => {
		expect(withDefaultDiscoveryRuntimeOptions({
			query: "ICT tender East Africa",
		})).toMatchObject({
			query: "ICT tender East Africa",
			sourceUrls: [...DEFAULT_DISCOVERY_SOURCE_URLS],
			sourceScrapeLimit: 10,
			scrapeTopResults: true,
			scrapeLimit: 3,
			browserFallback: true,
			browserFallbackLimit: 3,
			downloadDiscoveredDocuments: true,
			downloadLimit: 3,
		});

		expect(withDefaultDiscoveryRuntimeOptions({
			query: "ICT tender East Africa",
			sourceUrls: [],
			downloadDiscoveredDocuments: false,
		})).toMatchObject({
			sourceUrls: [],
			downloadDiscoveredDocuments: false,
		});
	});
});
