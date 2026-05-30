import { describe, expect, it } from "vitest";

import {
	DEFAULT_AGGRESSIVE_RFP_ACQUISITION_CAMPAIGNS,
	buildAggressiveRfpAcquisitionInputs,
	selectAggressiveRfpAcquisitionCampaigns,
} from "@/lib/services/aggressive-rfp-acquisition";

describe("aggressive RFP acquisition campaigns", () => {
	it("groups broad source acquisition into targeted reliable batches", () => {
		const campaignIds = DEFAULT_AGGRESSIVE_RFP_ACQUISITION_CAMPAIGNS.map((campaign) => campaign.id);
		expect(campaignIds).toEqual([
			"un_multilateral",
			"development_banks",
			"africa_national",
			"high_intent_search",
			"document_search",
		]);
		expect(new Set(campaignIds).size).toBe(campaignIds.length);
		expect(DEFAULT_AGGRESSIVE_RFP_ACQUISITION_CAMPAIGNS.flatMap((campaign) => campaign.sourceUrls ?? []))
			.toEqual(expect.arrayContaining([
				"https://www.unesco.org/en/procurement",
				"https://cdn.ppda.go.ug/api/bid-invitations",
			]));
	});

	it("builds search-only campaigns without accidentally re-adding every default source", () => {
		const [run] = buildAggressiveRfpAcquisitionInputs({
			campaignIds: ["document_search"],
			limitPerQuery: 7,
			sourceScrapeLimit: 0,
			scrapeLimit: 3,
			browserFallbackLimit: 2,
			downloadLimit: 5,
			downloadParseMode: "queued",
		});

		expect(run.campaign.id).toBe("document_search");
		expect(run.input.queries).toEqual(expect.arrayContaining([
			"filetype:pdf \"request for proposals\" \"submission deadline\"",
			"site:ungm.org \"Request for Proposal\" \"Published\"",
		]));
		expect(run.input.sourceUrls).toEqual([]);
		expect(run.input.engines).toEqual(["google", "duckduckgo", "bing", "brave"]);
		expect(run.input.searchEngineFanout).toBe(true);
		expect(run.input.scrapeTopResults).toBe(true);
		expect(run.input.downloadLimit).toBe(5);
	});

	it("builds source-only campaigns without spending search requests", () => {
		const [run] = buildAggressiveRfpAcquisitionInputs({
			campaignIds: ["africa_national"],
			limitPerQuery: 9,
			sourceScrapeLimit: 40,
			scrapeLimit: 4,
			browserFallbackLimit: 4,
			downloadLimit: 0,
			downloadParseMode: "queued",
		});

		expect(run.campaign.id).toBe("africa_national");
		expect(run.input.queries).toEqual([]);
		expect(run.input.sourceUrls).toEqual(expect.arrayContaining([
			"https://tenders.go.ke/tenders",
			"https://ocds-api.etenders.gov.za/api/OCDSReleases",
			"https://www.ghaneps.gov.gh/epps/quickSearchAction.do?searchSelect=6",
		]));
		expect(run.input.scrapeTopResults).toBe(false);
		expect(run.input.scrapeLimit).toBe(0);
		expect(run.input.downloadDiscoveredDocuments).toBe(false);
	});

	it("selects requested campaigns by id", () => {
		expect(selectAggressiveRfpAcquisitionCampaigns(["development_banks", "document_search"]).map((campaign) => campaign.id))
			.toEqual(["development_banks", "document_search"]);
	});
});
