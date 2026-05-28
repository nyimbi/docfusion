import type { DiscoveryImportInput } from "@/lib/services/opportunity-discovery-import";

export const DEFAULT_DISCOVERY_QUERIES = [
	"\"request for proposals\" Africa submission deadline",
	"\"request for proposal\" consultancy Africa procurement",
	"\"tender notice\" Africa ICT procurement",
	"\"software development\" tender procurement Africa",
	"\"digital transformation\" \"request for proposals\" Africa",
	"\"grant management system\" tender Africa",
	"\"health information system\" \"request for proposals\" Africa",
	"\"expression of interest\" consultancy services Africa deadline",
] as const;

export const DEFAULT_DISCOVERY_SEARCH_ENGINES = [
	"duckduckgo",
	"bing",
] as const;

export const DEFAULT_DISCOVERY_SOURCE_URLS = [
	"https://tenders.go.ke/tenders",
	"https://www.ungm.org/Public/Notice",
	"https://procurement-notices.undp.org",
	"https://projects.worldbank.org/en/projects-operations/procurement",
	"https://tenders.worldbank.org/procurement-notices",
	"https://www.afdb.org/en/projects-and-operations/procurement",
	"https://www.adb.org/projects/tenders",
	"https://www.aiib.org/en/opportunities/business/index.html",
	"https://www.isdb.org/project-procurement/tenders",
	"https://www.ebrd.com/home/work-with-us/project-procurement/procurement-notices.html",
	"https://www.dgmarket.com",
	"https://www.comesa.int/category/open-tenders/",
	"https://www.un.org/procurement/solicitations-opportunities",
	"https://www.unicef.org/supply/service-contracts-tender-calendar",
	"https://www.unicef.org/supply/tender-calendars",
	"https://www.usaid.gov/work-usaid/find-a-funding-opportunity",
	"https://sam.gov/search/?index=opp",
	"https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/tenders",
	"https://www.giz.de/en/regions/africa/ghana/tenders",
	"https://www.giz.de/en/regions/africa/south-africa/tenders",
] as const;

export const DEFAULT_DISCOVERY_SOURCE_SCRAPE_LIMIT = 15;
export const DEFAULT_DISCOVERY_SCRAPE_TOP_RESULTS = true;
export const DEFAULT_DISCOVERY_SCRAPE_LIMIT = 5;
export const DEFAULT_DISCOVERY_BROWSER_FALLBACK = true;
export const DEFAULT_DISCOVERY_DOWNLOAD_DISCOVERED_DOCUMENTS = true;
export const DEFAULT_DISCOVERY_DOWNLOAD_LIMIT = 5;

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
