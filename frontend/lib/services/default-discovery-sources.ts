import type { DiscoveryImportInput } from "@/lib/services/opportunity-discovery-import";

export const DEFAULT_DISCOVERY_QUERIES = [
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
	"site:unops.org \"request for proposals\" procurement",
	"site:iom.int \"procurement opportunities\" \"request for proposals\"",
	"site:wfp.org procurement \"request for proposal\"",
	"site:who.int procurement \"request for proposals\"",
	"site:ilo.org procurement \"request for proposal\"",
	"site:ifad.org procurement \"request for proposals\"",
	"site:unhcr.org \"bidding opportunities\" procurement",
	"site:fao.org procurement \"request for proposal\"",
	"site:procurement-notices.undp.org \"RFP\"",
	"site:worldbank.org procurement \"Request for Bids\"",
	"site:afdb.org procurement \"request for proposals\"",
	"site:adb.org \"Request for Proposal\" procurement",
	"site:caribank.org/work-with-us/procurement/procurement-notices \"Deadline\"",
	"site:tenders.go.ke \"Request for Proposal\"",
	"site:sam.gov \"request for proposal\" \"response date\"",
	"site:sam.gov USAID \"response date\"",
	"site:ocds-api.etenders.gov.za/api/OCDSReleases \"Request for Proposal\"",
	"site:nest.go.tz/gateway/nest-data-portal-api/api/releases \"active\" \"tenderPeriod\"",
	"site:gpp.ppda.go.ug/public/bid-invitations tender deadline Uganda",
	"site:umucyo.gov.rw/eb/bav/selectListAdvertisingListForGU.do tender deadline Rwanda",
	"site:ghaneps.gov.gh/epps/quickSearchAction.do current tenders Ghana deadline",
	"site:eprocure.zppa.org.zm/epps/quickSearchAction.do current tenders Zambia deadline",
	"site:maneps.mw/procurement-notice tender closing Malawi deadline",
	"site:cpbn.com.na/index/external/2 open bids Namibia closing date",
	"filetype:pdf \"request for proposals\" \"submission deadline\"",
	"filetype:pdf \"terms of reference\" \"proposal\" \"deadline\"",
	"filetype:docx \"request for proposals\" procurement",
] as const;

export const DEFAULT_DISCOVERY_SEARCH_ENGINES = [
	"google",
	"duckduckgo",
	"bing",
	"brave",
] as const;

export const DEFAULT_DISCOVERY_SOURCE_URLS = [
	"https://tenders.go.ke/tenders",
	"https://www.ungm.org/Public/Notice",
	"https://www.unops.org/business-opportunities",
	"https://www.iom.int/procurement-opportunities",
	"https://www.who.int/about/accountability/procurement",
	"https://www.ilo.org/about-ilo/procurement",
	"https://www.fao.org/unfao/procurement/en/",
	"https://www.ifad.org/en/corporate-procurement",
	"https://procurement-notices.undp.org",
	"https://projects.worldbank.org/en/projects-operations/procurement",
	"https://www.afdb.org/en/projects-and-operations/procurement",
	"https://www.adb.org/business/institutional-procurement/notices",
	"https://www.aiib.org/en/opportunities/business/project-procurement/list.html",
	"https://www.isdb.org/project-procurement/tenders",
	"https://www.ebrd.com/home/work-with-us/project-procurement/procurement-notices.html",
	"https://www.dgmarket.com",
	"https://www.comesa.int/category/open-tenders/",
	"https://www.un.org/procurement/solicitations-opportunities",
	"https://www.unicef.org/supply/service-contracts-tender-calendar",
	"https://www.caribank.org/work-with-us/procurement/procurement-notices",
	"https://sam.gov/search/?index=opp&keywords=%22request%20for%20proposal%22",
	"https://sam.gov/search/?index=opp&keywords=USAID",
	"https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals?keywords=proposal",
	"https://ocds-api.etenders.gov.za/api/OCDSReleases",
	"https://nest.go.tz/gateway/nest-data-portal-api/api/releases",
	"https://cdn.ppda.go.ug/api/bid-invitations",
	"https://www.umucyo.gov.rw/eb/bav/selectListAdvertisingListForGU.do?menuId=EB01020100&leftTopFlag=l&recordCountPerPage=50",
	"https://www.ghaneps.gov.gh/epps/quickSearchAction.do?searchSelect=6",
	"https://eprocure.zppa.org.zm/epps/quickSearchAction.do?searchSelect=6",
	"https://maneps.mw/rms/api/tender-notices/active-tenders-search",
	"https://www.cpbn.com.na/index/external/2",
	"https://www.giz.de/en/regions/africa/ghana/tenders",
	"https://www.giz.de/en/regions/africa/south-africa/tenders",
] as const;

export const DEFAULT_DISCOVERY_SOURCE_SCRAPE_LIMIT = 25;
export const DEFAULT_DISCOVERY_SCRAPE_TOP_RESULTS = true;
export const DEFAULT_DISCOVERY_SCRAPE_LIMIT = 5;
export const DEFAULT_DISCOVERY_BROWSER_FALLBACK = true;
export const DEFAULT_DISCOVERY_DOWNLOAD_DISCOVERED_DOCUMENTS = true;
export const DEFAULT_DISCOVERY_DOWNLOAD_LIMIT = 20;

function shouldApplyDefaultQueries(input: DiscoveryImportInput): boolean {
	return !input.query?.trim()
		&& input.queries === undefined
		&& input.sourceUrls === undefined;
}

export function withDefaultDiscoveryRuntimeOptions(input: DiscoveryImportInput): DiscoveryImportInput {
	return {
		...input,
		queries: shouldApplyDefaultQueries(input)
			? [...DEFAULT_DISCOVERY_QUERIES]
			: input.queries,
		engines: input.engines === undefined
			? [...DEFAULT_DISCOVERY_SEARCH_ENGINES]
			: input.engines,
		sourceUrls: input.sourceUrls === undefined
			? [...DEFAULT_DISCOVERY_SOURCE_URLS]
			: input.sourceUrls,
		sourceScrapeLimit: input.sourceScrapeLimit ?? DEFAULT_DISCOVERY_SOURCE_SCRAPE_LIMIT,
		scrapeTopResults: input.scrapeTopResults ?? DEFAULT_DISCOVERY_SCRAPE_TOP_RESULTS,
		scrapeLimit: input.scrapeLimit ?? DEFAULT_DISCOVERY_SCRAPE_LIMIT,
		browserFallback: input.browserFallback ?? DEFAULT_DISCOVERY_BROWSER_FALLBACK,
		browserFallbackLimit: input.browserFallbackLimit ?? input.scrapeLimit ?? DEFAULT_DISCOVERY_SCRAPE_LIMIT,
		downloadDiscoveredDocuments: input.downloadDiscoveredDocuments ?? DEFAULT_DISCOVERY_DOWNLOAD_DISCOVERED_DOCUMENTS,
		downloadLimit: input.downloadLimit ?? DEFAULT_DISCOVERY_DOWNLOAD_LIMIT,
	};
}
