import type { DiscoveryImportInput } from "@/lib/services/opportunity-discovery-import";

export const DEFAULT_DISCOVERY_SOURCE_URLS = [
	"https://tenders.go.ke/tenders",
	"https://www.ungm.org/Public/Notice",
	"https://procurement-notices.undp.org",
	"https://projects.worldbank.org/en/projects-operations/procurement",
	"https://www.afdb.org/en/projects-and-operations/procurement",
	"https://www.comesa.int/category/open-tenders/",
	"https://www.un.org/procurement/solicitations-opportunities",
	"https://www.unicef.org/supply/service-contracts-tender-calendar",
	"https://www.unicef.org/supply/tender-calendars",
] as const;

export const DEFAULT_DISCOVERY_SOURCE_SCRAPE_LIMIT = 10;
export const DEFAULT_DISCOVERY_SCRAPE_TOP_RESULTS = true;
export const DEFAULT_DISCOVERY_SCRAPE_LIMIT = 3;
export const DEFAULT_DISCOVERY_BROWSER_FALLBACK = true;
export const DEFAULT_DISCOVERY_DOWNLOAD_DISCOVERED_DOCUMENTS = true;
export const DEFAULT_DISCOVERY_DOWNLOAD_LIMIT = 3;

export function withDefaultDiscoveryRuntimeOptions(input: DiscoveryImportInput): DiscoveryImportInput {
	return {
		...input,
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
