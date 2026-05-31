import { describe, expect, it } from "vitest";

import { parseGrantsGovSearchResponse } from "@/lib/scrapers/parsers/grants-gov";

describe("Grants.gov parser", () => {
	it("maps posted search API hits into source-backed grant opportunities", () => {
		const opportunities = parseGrantsGovSearchResponse({
			oppHits: [
				{
					id: "362584",
					number: "PDS-LUSAKA-AMSPACES-FY26",
					title: "American Spaces Administrative Funds Management 2026",
					agencyCode: "DOS-ZAM",
					agency: "U.S. Mission to Zambia",
					openDate: "05/29/2099",
					closeDate: "06/20/2099",
					oppStatus: "posted",
					cfdaList: ["19.441"],
					awardCeiling: "250000",
				},
			],
		}, new Date("2099-05-31T00:00:00Z"));

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toMatchObject({
			title: "American Spaces Administrative Funds Management 2026",
			source: "grants_gov",
			sourceId: "grants-gov-362584",
			noticeId: "PDS-LUSAKA-AMSPACES-FY26",
			organization: "U.S. Mission to Zambia",
			countryRegion: "United States",
			category: "Posted grant opportunity",
			sector: "Assistance listings: 19.441",
			opportunityType: "grant",
			portalUrl: "https://www.grants.gov/search-results-detail/362584",
			documentUrl: "https://www.grants.gov/search-results-detail/362584",
			rfpLink: "https://www.grants.gov/search-results-detail/362584",
			budgetNumeric: 250000,
			budgetCurrency: "USD",
			budgetValue: "USD 250000",
			tags: ["grants-gov", "us-federal", "grant", "source-api"],
			metadata: {
				grantsGov: expect.objectContaining({
					id: "362584",
					opportunityNumber: "PDS-LUSAKA-AMSPACES-FY26",
					agencyCode: "DOS-ZAM",
					status: "posted",
					cfdaList: ["19.441"],
					detailUrl: "https://www.grants.gov/search-results-detail/362584",
				}),
			},
		});
		expect(new Date(opportunities[0]!.publishedDate!).toISOString()).toBe("2099-05-29T12:00:00.000Z");
		expect(new Date(opportunities[0]!.deadline!).toISOString()).toBe("2099-06-20T12:00:00.000Z");
	});

	it("filters expired posted and inactive statuses while retaining forecasted opportunities", () => {
		const opportunities = parseGrantsGovSearchResponse({
			oppHits: [
				{
					id: "expired",
					title: "Expired posted grant",
					closeDate: "01/01/2024",
					oppStatus: "posted",
				},
				{
					id: "archived",
					title: "Archived grant",
					closeDate: "12/31/2099",
					oppStatus: "archived",
				},
				{
					id: "forecast",
					number: "GG-FORECAST-1",
					title: "Forecasted resilience grant",
					agency: "Agency for International Development",
					oppStatus: "forecasted",
				},
			],
		}, new Date("2099-05-31T00:00:00Z"));

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toMatchObject({
			sourceId: "grants-gov-forecast",
			noticeId: "GG-FORECAST-1",
			category: "Forecasted grant opportunity",
			organization: "Agency for International Development",
		});
		expect(opportunities[0]?.deadline).toBeUndefined();
	});
});
