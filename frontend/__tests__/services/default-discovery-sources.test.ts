import { describe, expect, it } from "vitest";

import { DEFAULT_DISCOVERY_SOURCE_URLS } from "@/lib/services/default-discovery-sources";

describe("default discovery sources", () => {
	it("preloads live-proven configured procurement sources", () => {
		expect(DEFAULT_DISCOVERY_SOURCE_URLS).toEqual([
			"https://tenders.go.ke/tenders",
			"https://www.ungm.org/Public/Notice",
			"https://procurement-notices.undp.org",
			"https://projects.worldbank.org/en/projects-operations/procurement",
			"https://www.afdb.org/en/projects-and-operations/procurement",
			"https://www.comesa.int/category/open-tenders/",
			"https://www.unicef.org/supply/service-contracts-tender-calendar",
		]);
		expect(new Set(DEFAULT_DISCOVERY_SOURCE_URLS).size).toBe(DEFAULT_DISCOVERY_SOURCE_URLS.length);
	});
});
