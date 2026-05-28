import { describe, expect, it } from "vitest";

import {
	DEFAULT_DISCOVERY_QUERIES,
	DEFAULT_DISCOVERY_SEARCH_ENGINES,
	DEFAULT_DISCOVERY_SOURCE_URLS,
	withDefaultDiscoveryRuntimeOptions,
} from "@/lib/services/default-discovery-sources";

describe("default discovery sources", () => {
	it("preloads broad RFP queries plus live-proven and browser-fallback-capable procurement sources", () => {
		expect(DEFAULT_DISCOVERY_QUERIES).toEqual([
			"\"request for proposals\" submission deadline",
			"\"request for proposal\" procurement deadline",
			"\"tender notice\" procurement deadline",
			"\"invitation to bid\" procurement deadline",
			"\"expression of interest\" consultancy deadline",
			"\"terms of reference\" consultancy procurement",
			"\"request for quotations\" procurement deadline",
			"\"request for proposals\" Africa submission deadline",
			"\"request for proposal\" consultancy Africa procurement",
			"\"tender notice\" Africa ICT procurement",
			"\"software development\" tender procurement Africa",
			"\"digital transformation\" \"request for proposals\" Africa",
			"\"grant management system\" tender Africa",
			"\"health information system\" \"request for proposals\" Africa",
			"\"expression of interest\" consultancy services Africa deadline",
			"\"monitoring and evaluation\" \"request for proposals\" Africa deadline",
			"\"data platform\" \"request for proposals\" Africa deadline",
			"\"ERP implementation\" tender Africa deadline",
			"\"cybersecurity\" tender Africa deadline",
			"\"supply and installation\" ICT equipment tender Africa",
			"\"consulting services\" \"expression of interest\" Africa deadline",
			"\"digital health\" \"call for proposals\" Africa deadline",
			"site:ungm.org \"Request for Proposal\"",
			"site:procurement-notices.undp.org \"RFP\"",
			"site:devbusiness.un.org \"Request for Proposal\"",
			"site:worldbank.org procurement \"Request for Bids\"",
			"site:afdb.org procurement \"request for proposals\"",
			"site:adb.org \"Request for Proposal\" procurement",
			"site:tenders.go.ke \"Request for Proposal\"",
			"site:sam.gov \"request for proposal\" \"response date\"",
			"site:usaid.gov \"Request for Proposal\" Africa",
			"site:etenders.gov.za \"request for bid\"",
			"site:ppra.go.tz tenders \"request for proposal\"",
			"site:egpuganda.go.ug tender \"request for proposals\"",
			"filetype:pdf \"request for proposals\" \"submission deadline\"",
			"filetype:pdf \"terms of reference\" \"proposal\" \"deadline\"",
			"filetype:docx \"request for proposals\" procurement",
		]);
		expect(DEFAULT_DISCOVERY_SEARCH_ENGINES).toEqual(["google", "duckduckgo", "bing", "brave"]);
		expect(DEFAULT_DISCOVERY_SOURCE_URLS).toEqual([
			"https://tenders.go.ke/tenders",
			"https://www.ungm.org/Public/Notice",
			"https://procurement-notices.undp.org",
			"https://projects.worldbank.org/en/projects-operations/procurement",
			"https://tenders.worldbank.org/procurement-notices",
			"https://www.afdb.org/en/projects-and-operations/procurement",
			"https://www.adb.org/business/institutional-procurement/notices",
			"https://www.aiib.org/en/opportunities/business/project-procurement/list.html",
			"https://www.isdb.org/project-procurement/tenders",
			"https://www.ebrd.com/home/work-with-us/project-procurement/procurement-notices.html",
			"https://www.dgmarket.com",
			"https://www.comesa.int/category/open-tenders/",
			"https://www.un.org/procurement/solicitations-opportunities",
			"https://www.unicef.org/supply/service-contracts-tender-calendar",
			"https://www.unicef.org/supply/tender-calendars",
			"https://devbusiness.un.org",
			"https://www.usaid.gov/business-forecast",
			"https://sam.gov/search/?index=opp&keywords=%22request%20for%20proposal%22",
			"https://sam.gov/search/?index=opp&keywords=USAID",
			"https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals?keywords=proposal",
			"https://www.etenders.gov.za/Home/opportunities?id=1",
			"https://www.ppra.go.tz/tenders",
			"https://egpuganda.go.ug/notices",
			"https://www.giz.de/en/regions/africa/ghana/tenders",
			"https://www.giz.de/en/regions/africa/south-africa/tenders",
		]);
		expect(new Set(DEFAULT_DISCOVERY_QUERIES).size).toBe(DEFAULT_DISCOVERY_QUERIES.length);
		expect(new Set(DEFAULT_DISCOVERY_SOURCE_URLS).size).toBe(DEFAULT_DISCOVERY_SOURCE_URLS.length);
	});

	it("keeps scheduled and legacy discovery inputs on source-document defaults", () => {
		expect(withDefaultDiscoveryRuntimeOptions({})).toMatchObject({
			queries: [...DEFAULT_DISCOVERY_QUERIES],
			engines: [...DEFAULT_DISCOVERY_SEARCH_ENGINES],
			sourceUrls: [...DEFAULT_DISCOVERY_SOURCE_URLS],
			sourceScrapeLimit: 25,
			scrapeTopResults: true,
			scrapeLimit: 5,
			browserFallback: true,
			browserFallbackLimit: 5,
			downloadDiscoveredDocuments: true,
			downloadLimit: 20,
		});

		expect(withDefaultDiscoveryRuntimeOptions({
			query: "ICT tender East Africa",
		})).toMatchObject({
			query: "ICT tender East Africa",
			queries: undefined,
			engines: [...DEFAULT_DISCOVERY_SEARCH_ENGINES],
			sourceUrls: [...DEFAULT_DISCOVERY_SOURCE_URLS],
			sourceScrapeLimit: 25,
			scrapeTopResults: true,
			scrapeLimit: 5,
			browserFallback: true,
			browserFallbackLimit: 5,
			downloadDiscoveredDocuments: true,
			downloadLimit: 20,
		});

		expect(withDefaultDiscoveryRuntimeOptions({
			sourceUrls: ["https://buyer.example/tenders"],
			downloadDiscoveredDocuments: false,
		})).toMatchObject({
			queries: undefined,
			engines: [...DEFAULT_DISCOVERY_SEARCH_ENGINES],
			sourceUrls: ["https://buyer.example/tenders"],
			downloadDiscoveredDocuments: false,
		});
	});
});
