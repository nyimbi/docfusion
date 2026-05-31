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
			"global_public_sector",
			"global_regional_search",
			"donor_ngo_search",
		]);
		expect(new Set(campaignIds).size).toBe(campaignIds.length);
		expect(DEFAULT_AGGRESSIVE_RFP_ACQUISITION_CAMPAIGNS.flatMap((campaign) => campaign.sourceUrls ?? []))
			.toEqual(expect.arrayContaining([
				"https://www.unesco.org/en/procurement",
				"https://www.unwomen.org/en/about-us/procurement",
				"https://cdn.ppda.go.ug/api/bid-invitations",
				"https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?limit=100&stages=tender",
				"https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?limit=100&stages=tender",
				"https://micro.grants.gov/rest/opportunities/search?rows=100&oppStatuses=forecasted%7Cposted",
				"https://canadabuys.canada.ca/en/tender-opportunities",
				"https://www.mercycorps.org/tenders",
				"https://www.rti.org/current-opportunities",
				"https://www.abtglobal.com/doing-business-with-abt/commercial-opportunities",
				"https://solicitations.fhi360.org/Solicitation.aspx",
				"https://www.rescue.org/procurement-policies-and-bid-opportunities",
				"https://www.nrc.no/themes/177/tender",
				"https://nigeria.oxfam.org/procurement-and-consultancy",
				"https://thepalladiumgroup.com/tenders",
				"https://jhpiego.org/work-with-us/",
				"https://dt-global.com/proposals/",
				"https://www.care.org/about-us/contact-us/request-for-proposals/",
				"https://www.enabel.be/public-procurement/",
				"https://www.enabel.be/grants/",
				"https://winrock.org/contracts/",
				"https://www.iadb.org/en/how-we-can-work-together/procurement/procurement-projects/procurement-notices",
				"https://data.iadb.org/dataset/project-procurement-bidding-notices-and-notification-of-contract-awards",
				"https://intdev.tetratech.com.au/partner-with-us/",
			]));
	});

	it("builds search-only campaigns without accidentally re-adding every default source", () => {
		const [run] = buildAggressiveRfpAcquisitionInputs({
			campaignIds: ["document_search"],
			limitPerQuery: 7,
			searchPages: 2,
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
		expect(run.input.searchPages).toBe(2);
		expect(run.input.scrapeTopResults).toBe(true);
		expect(run.input.downloadLimit).toBe(5);
	});

	it("builds source-only campaigns without spending search requests", () => {
		const [run] = buildAggressiveRfpAcquisitionInputs({
			campaignIds: ["africa_national"],
			limitPerQuery: 9,
			searchPages: 1,
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

	it("builds mixed global public-sector campaigns with search fanout and direct sources", () => {
		const [run] = buildAggressiveRfpAcquisitionInputs({
			campaignIds: ["global_public_sector"],
			limitPerQuery: 5,
			searchPages: 2,
			sourceScrapeLimit: 20,
			scrapeLimit: 2,
			browserFallbackLimit: 2,
			downloadLimit: 6,
			downloadParseMode: "queued",
		});

		expect(run.campaign.id).toBe("global_public_sector");
		expect(run.input.queries).toEqual(expect.arrayContaining([
			"site:sam.gov \"solicitation\" \"proposal due\"",
			"site:contractsfinder.service.gov.uk/Notice \"Closing date\" \"tender\"",
			"site:find-tender.service.gov.uk/Notice \"Submission deadline\" tender",
			"site:canadabuys.canada.ca \"request for proposal\" \"closing date\"",
		]));
		expect(run.input.sourceUrls).toEqual(expect.arrayContaining([
			"https://sam.gov/search/?index=opp&keywords=%22request%20for%20proposal%22",
			"https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?limit=100&stages=tender",
			"https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?limit=100&stages=tender",
			"https://micro.grants.gov/rest/opportunities/search?rows=100&oppStatuses=forecasted%7Cposted",
			"https://www.tenders.gov.au/atm",
			"https://www.gets.govt.nz/ExternalIndex.htm",
		]));
		expect(run.input.searchEngineFanout).toBe(true);
		expect(run.input.scrapeTopResults).toBe(true);
		expect(run.input.scrapeLimit).toBe(2);
		expect(run.input.downloadLimit).toBe(6);
	});

	it("selects requested campaigns by id", () => {
		expect(selectAggressiveRfpAcquisitionCampaigns(["development_banks", "document_search"]).map((campaign) => campaign.id))
			.toEqual(["development_banks", "document_search"]);
	});

	it("turns donor and regional search groups into source-backed campaigns", () => {
		const [regional, donor] = buildAggressiveRfpAcquisitionInputs({
			campaignIds: ["global_regional_search", "donor_ngo_search"],
			limitPerQuery: 4,
			searchPages: 2,
			sourceScrapeLimit: 15,
			scrapeLimit: 2,
			browserFallbackLimit: 2,
			downloadLimit: 5,
			downloadParseMode: "queued",
		});

		expect(regional.input.sourceUrls).toEqual(expect.arrayContaining([
			"https://www.iadb.org/en/how-we-can-work-together/procurement/procurement-projects/procurement-notices",
			"https://data.iadb.org/dataset/project-procurement-bidding-notices-and-notification-of-contract-awards",
			"https://www.spc.int/procurement",
			"https://intdev.tetratecheurope.com/work-with-us/tender-opportunities/",
			"https://intdev.tetratech.com.au/partner-with-us/",
		]));
		expect(regional.input.queries).toEqual(expect.arrayContaining([
			"site:iadb.org procurement \"request for proposals\"",
			"site:data.iadb.org/dataset/project-procurement-bidding-notices-and-notification-of-contract-awards procurement notices",
			"site:spc.int/procurement \"request for proposal\"",
			"site:intdev.tetratech.com.au/partner-with-us tender \"Closing Date and Time\"",
			"site:intdev.tetratecheurope.com/work-with-us/tender-opportunities tender deadline",
		]));
		expect(donor.input.sourceUrls).toEqual(expect.arrayContaining([
			"https://www.mercycorps.org/tenders",
			"https://www.crs.org/bid-opportunities",
			"https://www.dai.com/our-work/supplier-registration-portal",
			"https://www.rescue.org/procurement-policies-and-bid-opportunities",
			"https://www.gtai.de/en/meta/search/kfw-tenders/795748!search",
			"https://www.rti.org/current-opportunities",
			"https://www.abtglobal.com/doing-business-with-abt/commercial-opportunities",
			"https://solicitations.fhi360.org/Solicitation.aspx",
			"https://www.nrc.no/themes/177/tender",
			"https://nigeria.oxfam.org/procurement-and-consultancy",
			"https://thepalladiumgroup.com/tenders",
			"https://jhpiego.org/work-with-us/",
			"https://dt-global.com/proposals/",
			"https://www.care.org/about-us/contact-us/request-for-proposals/",
			"https://www.enabel.be/public-procurement/",
			"https://www.enabel.be/grants/",
			"https://winrock.org/contracts/",
		]));
		expect(donor.input.queries).toEqual(expect.arrayContaining([
			"site:gtai.de/en/trade/ \"KfW-Tenders\" \"Tender Notice\" \"Deadline\"",
			"site:dai.com/uploads \"request for proposals\" DAI",
			"site:plan-international.org/calls-tender tender deadline",
			"site:rescue.org/rfp RFP procurement",
			"site:rescue.org/procurement-policies-and-bid-opportunities RFP",
			"site:rti.org/current-opportunities \"Request for Quote/Proposal\" \"Date Proposal Due\"",
			"site:abtglobal.com/doing-business-with-abt/commercial-opportunities \"RFP\" \"Closing\"",
			"site:fhi360.org/partner-us-business-opportunities solicitations \"Closing date\"",
			"site:nrc.no/tender \"Request for Proposal\" \"Deadline for\"",
			"site:nrc.no/tender \"Invitation to tender\" \"Deadline\"",
			"site:nigeria.oxfam.org/procurement-and-consultancy \"Submission Deadline\"",
			"site:thepalladiumgroup.com/tenders RFP tender closing date",
			"site:jhpiego.org/work-with-us \"RFP\" \"Close Date\"",
			"site:dt-global.com/proposals RFP \"Application Deadline\"",
			"site:care.org/about-us/contact-us/request-for-proposals \"Tender submission deadline\"",
			"site:enabel.be/public-procurement \"Closing date\" \"Status :\" \"Open\"",
			"site:enabel.be/grants \"Closing date\" \"Status :\" \"Open\"",
			"site:winrock.org/contracts RFP \"Submission Deadline\"",
			"site:winrock.org/contracts \"download this\" RFP OR EOI OR TOR",
			"site:cowater.com/wp-content/uploads/2026 RFP deadline",
		]));
		expect(donor.input.scrapeTopResults).toBe(true);
	});
});
