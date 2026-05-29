import { describe, expect, it } from "vitest";

import {
	nestTanzaniaReleasesApiUrl,
	parseNestTanzaniaReleasesResponse,
} from "@/lib/scrapers/parsers/nest-tanzania";

function formatDate(value: unknown): string | undefined {
	if (!(value instanceof Date)) return undefined;
	return value.toISOString().slice(0, 10);
}

describe("NeST Tanzania parser", () => {
	it("adds a rolling since cursor when the configured source URL has none", () => {
		const apiUrl = nestTanzaniaReleasesApiUrl(
			"https://nest.go.tz/gateway/nest-data-portal-api/api/releases",
			new Date("2026-05-29T12:00:00Z")
		);

		expect(apiUrl).toBe("https://nest.go.tz/gateway/nest-data-portal-api/api/releases?since=2026-05-27T00%3A00%3A00.000Z");
	});

	it("extracts open OCDS releases with buyer, dates, method, and direct release URLs", () => {
		const opportunities = parseNestTanzaniaReleasesResponse({
			releases: [{
				id: "6eaef89e-e6c9-4b40-8622-f1afc6a61273",
				ocid: "ocds-mv5oob-122383-3-2025-2026-G-32-S003",
				date: "2026-05-27T00:00:00Z",
				tag: ["tender"],
				buyer: { id: "buyer-1", name: "MWACHAMBIA DISPENSARY" },
				parties: [{
					id: "buyer-1",
					name: "MWACHAMBIA DISPENSARY",
					address: { region: "SINGIDA", countryName: "TZ" },
				}],
				tender: {
					id: "122383-3/2025/2026/G/32-S003",
					description: "Supply of comprehensive building materials for all construction stages",
					status: "active",
					procurementMethod: "open",
					procurementMethodDetails: "National competitive tendering",
					procuringEntity: { id: "buyer-1", name: "MWACHAMBIA DISPENSARY" },
					tenderPeriod: {
						startDate: "2026-05-27T00:00:00Z",
						endDate: "2026-06-01T11:30:00Z",
					},
					items: [{
						description: "Treated softwood timber",
						classification: {
							scheme: "UNSPSC",
							id: "11121604",
							description: "Softwood timber",
						},
						quantity: 18,
						unit: { name: "Pcs" },
					}],
				},
			}, {
				id: "expired-release",
				ocid: "ocds-mv5oob-expired",
				date: "2026-05-20T00:00:00Z",
				tender: {
					id: "expired",
					description: "Expired tender",
					status: "active",
					tenderPeriod: { endDate: "2026-05-25T10:00:00Z" },
				},
			}],
		}, "https://nest.go.tz/gateway/nest-data-portal-api/api/releases", new Date("2026-05-29T12:00:00Z"));

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toMatchObject({
			title: "Supply of comprehensive building materials for all construction stages",
			source: "nest_tanzania",
			sourceId: "nest-ocds-mv5oob-122383-3-2025-2026-G-32-S003",
			noticeId: "122383-3/2025/2026/G/32-S003",
			organization: "MWACHAMBIA DISPENSARY",
			countryRegion: "Tanzania",
			category: "National competitive tendering",
			sector: "Softwood timber",
			opportunityType: "tender",
			portalUrl: "https://nest.go.tz/gateway/nest-data-portal-api/api/releases/ocds-mv5oob-122383-3-2025-2026-G-32-S003/6eaef89e-e6c9-4b40-8622-f1afc6a61273",
			tags: ["nest-tanzania", "tanzania", "national-procurement", "ocds", "source-api"],
		});
		expect(formatDate(opportunities[0].publishedDate)).toBe("2026-05-27");
		expect(formatDate(opportunities[0].deadline)).toBe("2026-06-01");
		expect(opportunities[0].projectSummary).toContain("Region: SINGIDA");
	});
});
