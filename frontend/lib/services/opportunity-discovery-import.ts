import { createHash } from "crypto";
import { db } from "@/lib/db";
import { opportunities, opportunityDocuments } from "@/lib/db/schema";
import { FirecrawlClient } from "@/lib/scrapers/firecrawl";
import { genericParser, getParser, type ParseResult, type TenderParser } from "@/lib/scrapers/parsers";
import { parseAfdbNoticeDetailMarkdown } from "@/lib/scrapers/parsers/afdb";
import { parseComesaTenderDetailMarkdown } from "@/lib/scrapers/parsers/comesa";
import { parseUndpNoticeDetailMarkdown } from "@/lib/scrapers/parsers/undp";
import {
	fetchWorldBankNoticeDetail,
	parseWorldBankNoticeDetailMarkdown,
	worldBankNoticeIdFromUrl,
	type WorldBankNoticeDetail,
} from "@/lib/scrapers/parsers/world-bank";
import type { OpportunityData } from "@/lib/scrapers/deduplicator";
import { scrapeWithBrowserService } from "@/lib/services/browser-scraper-client";
import { getCloakBrowserEndpoint, scrapeWithCloakBrowser } from "@/lib/services/cloakbrowser-scraper-client";
import { fetchKenyaPpipOpportunities, isKenyaPpipUrl } from "@/lib/services/kenya-ppip-client";
import { fetchUngmOpportunities, isUngmUrl } from "@/lib/services/ungm-client";
import { downloadDocument, type DownloadParseMode, type DownloadParseStatus } from "@/lib/services/rfp-document-service";
import { fetchPublicHttpUrl } from "@/lib/security/public-url";
import {
	getSearxngBaseUrl,
	searchSearxng,
	type SearchOptions,
	type SearxngResult,
	type SearxngUnresponsiveEngine,
} from "@/lib/services/searxng-client";
import { isLowValueProcurementDocumentLink } from "@/lib/services/rfp-document-link-filter";
import type { ImportConfig, ImportRecordResult, ImportSourceHealth, OpportunityInput } from "@/lib/types/opportunity";
import {
	createImportRecord,
	createOpportunity,
	updateImportRecord,
	updateOpportunity,
} from "@/lib/actions/opportunities";
import { and, eq } from "drizzle-orm";
import { getUserContext } from "@/lib/auth-utils";

export interface DiscoveryImportInput {
	query?: string;
	queries?: string[];
	limitPerQuery?: number;
	sourceUrls?: string[];
	sourceScrapeLimit?: number;
	language?: string;
	timeRange?: SearchOptions["time_range"];
	categories?: SearchOptions["categories"];
	engines?: SearchOptions["engines"];
	searchEngineFanout?: boolean;
	searchPages?: number;
	countryRegion?: string;
	category?: string;
	updateExisting?: boolean;
	includeUnmatchedResults?: boolean;
	scrapeTopResults?: boolean;
	scrapeLimit?: number;
	browserFallback?: boolean;
	browserFallbackLimit?: number;
	downloadDiscoveredDocuments?: boolean;
	downloadLimit?: number;
	downloadParseMode?: DownloadParseMode;
}

interface DiscoveryCandidate {
	query: string;
	result: SearxngResult;
	discoveryMethod?: "searxng" | "source_scrape";
	sourceUrl?: string;
	opportunity?: OpportunityData;
	sourceTotal?: number;
	scrape?: {
		title?: string;
		description?: string;
		markdown?: string;
		links?: string[];
		success: boolean;
		error?: string;
		method: DiscoveryScrapeMethod;
		fallbackReason?: string;
	};
}

type OpportunityActionOverride = {
	actorId: string;
	organizationId: string;
};

export type ImportResultsSummary = {
	total: number;
	imported: number;
	updated: number;
	skipped: number;
	failed: number;
};

export interface DiscoveryRunWarning {
	type:
		| "firecrawl_failed"
		| "search_no_candidates"
		| "searxng_engine_degraded"
		| "source_scrape_failed"
		| "source_scrape_empty"
		| "browser_fallback_failed"
		| "browser_fallback_used"
		| "cloakbrowser_fallback_failed"
		| "cloakbrowser_fallback_used"
		| "source_document_seed_failed"
		| "source_document_download_failed"
		| "source_document_parse_failed";
	query: string;
	title: string;
	url: string;
	message: string;
}

export interface DiscoveryImportResult {
	importId: string;
	results: ImportResultsSummary;
	errors: ImportRecordResult[];
	warnings: DiscoveryRunWarning[];
	sourceHealth: ImportSourceHealth[];
	sourceDocumentsCreated: number;
	sourceDocumentsExisting: number;
	sourceDocumentsDownloadAttempted: number;
	sourceDocumentsDownloaded: number;
	sourceDocumentsDownloadFailed: number;
	sourceDocumentsParseAttempted: number;
	sourceDocumentsParsed: number;
	sourceDocumentsParseFailed: number;
}

type SourceDocumentSeedResult =
	| { state: "created" | "existing"; documentId: string; sourceUrl: string }
	| { state: "none" | "failed"; documentId?: undefined; sourceUrl?: string };

type SourceCandidateImportStatus = ImportRecordResult["status"];

type SourceDocumentDownloadOutcome = {
	downloaded: boolean;
	parsingStatus?: DownloadParseStatus;
	parsingError?: string;
};

function persistenceRetryAttempts(): number {
	const parsed = Number(process.env.DISCOVERY_IMPORT_DB_RETRY_ATTEMPTS ?? DEFAULT_PERSISTENCE_RETRY_ATTEMPTS);
	if (!Number.isFinite(parsed)) return DEFAULT_PERSISTENCE_RETRY_ATTEMPTS;
	return Math.min(5, Math.max(1, Math.trunc(parsed)));
}

function persistenceRetryDelayMs(): number {
	const parsed = Number(process.env.DISCOVERY_IMPORT_DB_RETRY_DELAY_MS ?? DEFAULT_PERSISTENCE_RETRY_DELAY_MS);
	if (!Number.isFinite(parsed)) return DEFAULT_PERSISTENCE_RETRY_DELAY_MS;
	return Math.min(5_000, Math.max(0, Math.trunc(parsed)));
}

function persistenceErrorText(error: unknown): string {
	if (error instanceof Error) {
		const cause = "cause" in error ? (error as { cause?: unknown }).cause : undefined;
		return [
			error.name,
			error.message,
			typeof cause === "object" && cause ? JSON.stringify(cause) : String(cause ?? ""),
		].join(" ");
	}
	return String(error);
}

function isRetryablePersistenceError(error: unknown): boolean {
	const text = persistenceErrorText(error);
	return /\b(ECONNREFUSED|ECONNRESET|ETIMEDOUT|EPIPE|ENETUNREACH|57P01|57P02|57P03|53300|08000|08003|08006)\b/i.test(text)
		|| /connection terminated|connection timeout|terminating connection|server closed the connection|database system is starting up|too many connections/i.test(text);
}

async function sleep(ms: number): Promise<void> {
	if (ms <= 0) return;
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withPersistenceRetry<T>(operation: () => Promise<T>): Promise<T> {
	const attempts = persistenceRetryAttempts();
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			return await operation();
		} catch (error) {
			if (attempt >= attempts || !isRetryablePersistenceError(error)) {
				throw error;
			}
			await sleep(persistenceRetryDelayMs() * attempt);
		}
	}
	throw new Error("Persistence retry exhausted unexpectedly");
}

interface SourceCandidateImportOutcome {
	sourceUrl: string;
	status: SourceCandidateImportStatus;
}

type FirecrawlScrapeResult = Awaited<ReturnType<FirecrawlClient["scrape"]>>;
type DiscoveryScrapeMethod = "firecrawl" | "direct_http" | "browser_fallback" | "browser_source" | "cloakbrowser_fallback" | "source_api";

type DiscoveryDocumentLink = {
	url: string;
	label?: string;
	source: "result_url" | "opportunity_document_url" | "scraped_markdown" | "scraped_link";
	score: number;
};

const SOURCE_SCRAPE_IMPORT_SOURCES = new Set([
	"afdb",
	"adb",
	"badea",
	"boad",
	"dbsa",
	"idb",
	"african_union",
	"auda_nepad",
	"africa_cdc",
	"aiib",
	"isdb",
	"kenya_ppip",
	"undp",
	"ungm",
	"world_bank",
	"cdb",
	"ceb_mauritius",
	"ebrd",
	"sam_gov",
	"contracts_finder",
	"find_tender",
	"canada_buys",
	"new_zealand_gets",
	"grants_gov",
	"eu_funding_tenders",
	"dgmarket",
	"comesa",
	"sadc",
	"ecowas",
	"ecreee",
	"mof_sierra_leone",
	"marches_publics_niger",
	"benin_marches_publics",
	"dgmp_mali",
	"dnccp_togo",
	"un_procurement",
	"unicef",
	"iom",
	"irc",
	"giz",
	"mercy_corps",
	"plan_international",
	"save_children",
	"spc",
	"rti",
	"abt_global",
	"fhi360",
	"nrc",
	"oxfam_nigeria",
	"palladium",
	"jhpiego",
	"dt_global",
	"care",
	"enabel",
	"winrock",
	"tetra_tech_intdev",
	"trademark_africa",
	"egp_uganda",
	"umucyo_rwanda",
	"ghaneps",
	"zppa_zambia",
	"nest_tanzania",
	"etenders_sa",
	"maneps_malawi",
	"nocopo_nigeria",
	"cpbn_namibia",
	"esppra_eswatini",
]);

interface ConfiguredSourceParseResult {
	parser: TenderParser;
	parseResult: ParseResult;
	scrapeResult: FirecrawlScrapeResult;
	attempts: number;
	method: DiscoveryScrapeMethod;
	fallbackReason?: string;
	lastEmptyMessage?: string;
}

type DiscoverySearchRequest = {
	query: string;
	engines?: string[];
	page: number;
	label: string;
	failedAsImportError: boolean;
};

type DiscoverySearchTask = {
	query: string;
	request: DiscoverySearchRequest;
};

type DiscoverySearchOutcome = DiscoverySearchTask & (
	| { response: Awaited<ReturnType<typeof searchSearxng>>; error?: undefined }
	| { response?: undefined; error: unknown }
);

const DEFAULT_DISCOVERY_QUERIES = [
	"software development RFP Africa",
	"ICT tender East Africa",
	"digital transformation request for proposals Kenya",
	"grant management system tender Africa",
];

const OPPORTUNITY_KEYWORDS = [
	"rfp",
	"request for proposal",
	"request for proposals",
	"request for quotation",
	"request for quotations",
	"rfq",
	"request for bid",
	"request for bids",
	"invitation to bid",
	"itb",
	"tender",
	"bid",
	"eoi",
	"expression of interest",
	"procurement",
	"grant",
	"solicitation",
	"call for proposals",
	"terms of reference",
];

const HIGH_INTENT_QUERY_KEYWORDS = [
	...OPPORTUNITY_KEYWORDS,
	"deadline",
	"submission",
	"consultancy",
	"consulting services",
];

const PROCUREMENT_PORTAL_URL_PATTERNS = [
	/\/\/(?:www\.)?ungm\.org\/public\/notice/i,
	/\/\/(?:www\.)?unops\.org\/business-opportunities/i,
	/\/\/(?:www\.)?iom\.int\/procurement-opportunities/i,
	/\/\/(?:www\.)?wfp\.org\/procurement/i,
	/\/\/(?:www\.)?who\.int\/about\/accountability\/procurement/i,
	/\/\/(?:www\.)?ilo\.org\/about-ilo\/procurement/i,
	/\/\/(?:www\.)?ifad\.org\/(?:en\/)?(?:project-procurement|corporate-procurement)/i,
	/\/\/(?:www\.)?unhcr\.org\/.*bidding-opportunities/i,
	/\/\/(?:www\.)?unwomen\.org\/en\/about-us\/procurement/i,
	/\/\/(?:www\.)?fao\.org\/unfao\/procurement/i,
	/\/\/procurement-notices\.undp\.org\//i,
	/\/\/(?:www\.)?worldbank\.org\/.*procurement/i,
	/\/\/tenders\.worldbank\.org\//i,
	/\/\/(?:www\.)?afdb\.org\/.*procurement/i,
	/\/\/(?:www\.)?adb\.org\/business\/.*procurement/i,
	/\/\/(?:www\.)?badea\.org\/(?:fr\/procurement-notice-fr|procurement-notices-2|ar\/procurement-notices-ar|Portal\/procurement)/i,
	/\/\/(?:www\.)?boad\.org\/(?:fr\/opportunites\/appels-doffre|en\/opportunities\/calls-for-tender)/i,
	/\/\/(?:www\.)?dbsa\.org\/procurement/i,
	/\/\/(?:www\.)?caribank\.org\/work-with-us\/procurement/i,
	/\/\/(?:www\.)?ceb\.mu\/procurement\/tender/i,
	/\/\/(?:www\.)?aiib\.org\/.*project-procurement/i,
	/\/\/(?:www\.)?isdb\.org\/project-procurement/i,
	/\/\/(?:www\.)?nepad\.org\/(?:tenders|file-download\/download\/public)/i,
	/\/\/africacdc\.org\/(?:supply-chain-division\/opportunities|bid-program\/supply-chain-division|opportunity\/|wp-content\/uploads\/)/i,
	/\/\/tenders\.go\.ke\//i,
	/\/\/sam\.gov\/search/i,
	/\/\/(?:www\.)?usaid\.gov\/business-forecast/i,
	/\/\/(?:www\.)?etenders\.gov\.za\//i,
	/\/\/(?:www\.)?ppra\.go\.tz\/tenders/i,
	/\/\/egpuganda\.go\.ug\/(?:bid-notices|index\/)/i,
	/\/\/gpp\.ppda\.go\.ug\/public\/bid-invitations/i,
	/\/\/cdn\.ppda\.go\.ug\/api\/bid-invitations/i,
	/\/\/(?:www\.)?umucyo\.gov\.rw\/eb\/bav\/selectListAdvertisingListForGU\.do/i,
	/\/\/(?:www\.)?ghaneps\.gov\.gh\/epps\/quickSearchAction\.do/i,
	/\/\/eprocure\.zppa\.org\.zm\/epps\/quickSearchAction\.do/i,
	/\/\/maneps\.mw\/rms\/api\/tender-notices\/active-tenders-search/i,
	/\/\/(?:www\.)?nocopo\.bpp\.gov\.ng\/(?:Open-Data|PublishedRecordHandler\.ashx)/i,
	/\/\/(?:www\.)?cpbn\.com\.na\/index\/external\/2/i,
	/\/\/(?:www\.)?ebrd\.com\/.*procurement/i,
	/\/\/(?:www\.)?comesa\.int\/category\/open-tenders/i,
	/\/\/(?:www\.)?sadc\.int\/procurement-opportunities/i,
	/\/\/(?:www\.)?ecowas\.int\/(?:procurement|nwp_events\/)/i,
	/\/\/(?:www\.)?ecreee\.org\/(?!wp-content|wp-admin|wp-includes)/i,
	/\/\/mof\.gov\.sl\/(?:public-notices|documents\/|wp-content\/uploads\/)/i,
	/\/\/(?:www\.)?marchespublics\.ne\/(?:appels-offres|appel-offre\/)/i,
	/\/\/api\.marches-publics\.bj\/v2\/api\/portail\/appelsoffres/i,
	/\/\/(?:www\.)?marches-publics\.bj\/appels-doffres/i,
	/\/\/(?:www\.)?dgmp\.gouv\.ml\/(?:\?q=node\/(?:66|71)|.*sites\/default\/files\/DATA_IN\/)/i,
	/\/\/dnccp\.gouv\.tg\/dnccp\/(?:wp-json\/wp\/v2\/posts|category\/avis-d-appel-d-offres|avis-d-appel-d-offres\/)/i,
	/\/\/(?:www\.)?un\.org\/procurement/i,
	/\/\/(?:www\.)?unicef\.org\/supply\/.*tender/i,
	/\/\/(?:www\.)?giz\.de\/.*\/tenders/i,
	/\/\/(?:www\.)?contractsfinder\.service\.gov\.uk\/Search/i,
	/\/\/canadabuys\.canada\.ca\/.*tender-opportunities/i,
	/\/\/(?:www\.)?tenders\.gov\.au\/atm/i,
	/\/\/(?:www\.)?gets\.govt\.nz\//i,
	/\/\/(?:www\.)?grants\.gov\/search-grants/i,
	/\/\/(?:www\.)?usaid\.gov\/business-forecast/i,
	/\/\/(?:www\.)?mercycorps\.org\/tenders/i,
	/\/\/(?:www\.)?crs\.org\/bid-opportunities/i,
	/\/\/(?:www\.)?rescue\.org\/procurement-policies-and-bid-opportunities/i,
	/\/\/(?:www\.)?rescue\.org\/rfp\//i,
	/\/\/(?:www\.)?nrc\.no\/(?:themes\/177\/tender|procurement|tender\/)/i,
	/\/\/nigeria\.oxfam\.org\/procurement-and-consultancy/i,
	/\/\/(?:www\.)?savethechildren\.net\/tenders/i,
	/\/\/plan-international\.org\/calls-tender/i,
	/\/\/(?:www\.)?dai\.com\/our-work\/supplier-registration-portal/i,
	/\/\/(?:www\.)?gov\.uk\/government\/organisations\/foreign-commonwealth-development-office\/about\/procurement/i,
	/\/\/(?:www\.)?fcdoservices\.gov\.uk\/why-choose-us\/becoming-a-supplier/i,
	/\/\/(?:www\.)?gtai\.de\/en\/trade\/tenders/i,
	/\/\/(?:www\.)?gtai\.de\/en\/meta\/search\/kfw-tenders/i,
	/\/\/data\.iadb\.org\/dataset\/project-procurement-bidding-notices-and-notification-of-contract-awards/i,
	/\/\/(?:www\.)?iadb\.org\/.*\/procurement/i,
	/\/\/(?:www\.)?spc\.int\/procurement/i,
	/\/\/(?:www\.)?thepalladiumgroup\.com\/(?:tenders|tender\/)/i,
	/\/\/(?:www\.)?jhpiego\.org\/work-with-us/i,
	/\/\/dt-global\.com\/proposals/i,
	/\/\/(?:www\.)?care\.org\/about-us\/contact-us\/request-for-proposals/i,
	/\/\/(?:www\.)?enabel\.be\/(?:public-procurement|grants)/i,
	/\/\/(?:www\.)?winrock\.org\/contracts/i,
	/\/\/intdev\.tetratech\.com\.au\/partner-with-us/i,
	/\/\/intdev\.tetratecheurope\.com\/work-with-us\/tender-opportunities/i,
	/\/\/(?:www\.)?trademarkafrica\.com\/procurement/i,
];

const LOW_VALUE_DISCOVERY_HOSTS = new Set([
	"archive.org",
	"britannica.com",
	"cambridge.org",
	"collinsdictionary.com",
	"context.reverso.net",
	"dictionary.cambridge.org",
	"dictionary.com",
	"linguee.com",
	"merriam-webster.com",
	"thefreedictionary.com",
	"thesaurus.com",
	"reverso.net",
	"wikimedia.org",
	"wikipedia.org",
	"wordreference.com",
	"yourdictionary.com",
]);

const DEFAULT_STEALTH_SCRAPER_URL = "http://84.247.181.100:3003";
const MIN_USEFUL_SCRAPE_MARKDOWN_LENGTH = 120;
const BOT_PROTECTION_CONTENT_PATTERN = /(?:radware captcha page|captcha\.perfdrive\.com|h-captcha|please solve this captcha|made us think that you are a bot|access denied|too many requests|just a moment\.?)/i;
const DEFAULT_AFDB_DETAIL_LIMIT = 5;
const DEFAULT_COMESA_DETAIL_LIMIT = 5;
const DEFAULT_UNDP_DETAIL_LIMIT = 5;
const DEFAULT_WORLD_BANK_DETAIL_LIMIT = 5;
const DEFAULT_CONFIGURED_SOURCE_SCRAPE_ATTEMPTS = 2;
const DEFAULT_CONFIGURED_SOURCE_MAX_PAGES = 3;
const DEFAULT_CONFIGURED_SOURCE_DETAIL_LIMIT = 10;
const DEFAULT_CONFIGURED_SOURCE_DISCOVERY_TIMEOUT_MS = 90_000;
const DEFAULT_PERSISTENCE_RETRY_ATTEMPTS = 3;
const DEFAULT_PERSISTENCE_RETRY_DELAY_MS = 500;
const DEFAULT_DISCOVERY_SEARCH_CONCURRENCY = 4;
const MAX_DISCOVERY_SOURCE_DOCUMENTS = 5;
const MIN_DISCOVERY_SOURCE_DOCUMENT_SCORE = 6;
const DOCUMENT_URL_PATTERN = /\.(pdf|docx?|xlsx?|zip)(?:[?#]|$)|\/\/idbdocs\.iadb\.org\/wsdocs\/getdocument\.aspx\?docnum=|\/\/www\.contractsfinder\.service\.gov\.uk\/Notice\/Attachment\//i;
const DOCUMENT_LINK_KEYWORDS = [
	"rfp",
	"request for proposal",
	"tender",
	"bid",
	"solicitation",
	"download",
	"attachment",
	"terms of reference",
	"tor",
];
const AFDB_SEARCH_FALLBACK_QUERIES = [
	"afdb procurement reoi pdf consulting services",
	"afdb project related procurement request for expressions of interest pdf",
	"afdb procurement request for proposal pdf",
	"afdb procurement tender pdf consulting",
];

function sha256Hex(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function normalizeUrlForIdentity(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.hash = "";
		parsed.searchParams.sort();
		return parsed.toString();
	} catch {
		return url.trim();
	}
}

function sourceOpportunityIdentity(opportunity: OpportunityData, sourceUrl: string): string {
	if (opportunity.source === "dnccp_togo" && opportunity.sourceId) {
		return `${normalizeUrlForIdentity(sourceUrl)}#${opportunity.sourceId}`;
	}

	const url = opportunity.documentUrl ?? opportunity.rfpLink ?? opportunity.portalUrl;
	if (url) {
		const normalizedUrl = normalizeUrlForIdentity(url);
		const normalizedSourceUrl = normalizeUrlForIdentity(sourceUrl);
		const rowId = opportunity.sourceId ?? opportunity.noticeId;
		if (rowId && normalizedUrl === normalizedSourceUrl) {
			return `${normalizedSourceUrl}#${rowId}`;
		}
		return normalizedUrl;
	}
	return `${normalizeUrlForIdentity(sourceUrl)}#${opportunity.sourceId ?? opportunity.noticeId ?? opportunity.title}`;
}

function isAfdbSourceUrl(sourceUrl: string): boolean {
	try {
		const parsed = new URL(sourceUrl);
		return /(^|\.)afdb\.org$/i.test(parsed.hostname);
	} catch {
		return false;
	}
}

function compactText(value: string | undefined | null, maxLength: number): string | undefined {
	const compacted = value?.replace(/\s+/g, " ").trim();
	if (!compacted) return undefined;
	return compacted.length > maxLength ? `${compacted.slice(0, maxLength - 3)}...` : compacted;
}

function compactIdentifier(value: string | undefined | null, maxLength: number): string | undefined {
	const compacted = value?.replace(/\s+/g, " ").trim();
	if (!compacted) return undefined;
	if (compacted.length <= maxLength) return compacted;

	const hash = sha256Hex(compacted).slice(0, 10);
	const prefix = compacted
		.slice(0, maxLength - hash.length - 1)
		.replace(/\s+$/g, "")
		.replace(/[-:/#._]+$/g, "");
	return `${prefix || "notice"}-${hash}`;
}

function slugForSourceFile(query: string): string {
	const slug = query
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 80);
	return `searxng:${slug || "opportunity-discovery"}`;
}

function compactSourceId(value: string): string {
	const trimmed = value.trim();
	if (trimmed.length <= 50) return trimmed;

	const hash = sha256Hex(trimmed).slice(0, 10);
	const slug = trimmed
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		|| "source";
	const prefix = slug.slice(0, 50 - hash.length - 1).replace(/-+$/g, "") || "source";
	return `${prefix}-${hash}`;
}

function normalizeDiscoveryQueries(input: DiscoveryImportInput): string[] {
	const rawQueries = [
		input.query,
		...(input.queries ?? []),
	].filter((query): query is string => Boolean(query?.trim()));
	if (rawQueries.length === 0 && (input.sourceUrls?.length ?? 0) > 0) {
		return [];
	}
	const queries = rawQueries.length > 0 ? rawQueries : DEFAULT_DISCOVERY_QUERIES;
	return [...new Set(queries.map((query) => query.trim()))];
}

function normalizeSourceUrls(input: DiscoveryImportInput): string[] {
	return [...new Set((input.sourceUrls ?? [])
		.map((url) => url.trim())
		.filter(Boolean)
		.map((url) => {
			try {
				const parsed = new URL(url);
				parsed.hash = "";
				return parsed.toString();
			} catch {
				return "";
			}
		})
		.filter(Boolean))];
}

function parserForSourceUrl(sourceUrl: string): TenderParser {
	let host = "";
	try {
		host = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
	} catch {
		return genericParser;
	}

	let sourceId: string | undefined;
	if (host === "afdb.org" || host.endsWith(".afdb.org")) sourceId = "afdb";
	else if (host === "adb.org" || host.endsWith(".adb.org")) sourceId = "adb";
	else if (host === "badea.org" && /^\/(?:fr\/procurement-notice-fr|procurement-notices-2|ar\/procurement-notices-ar|Portal\/procurement)/.test(safeUrlPathname(sourceUrl))) sourceId = "badea";
	else if (host === "boad.org" && /^\/(?:fr\/opportunites\/appels-doffre|en\/opportunities\/calls-for-tender)/.test(safeUrlPathname(sourceUrl))) sourceId = "boad";
	else if (host === "dbsa.org" && safeUrlPathname(sourceUrl).startsWith("/procurement")) sourceId = "dbsa";
	else if (host === "data.iadb.org" && safeUrlPathname(sourceUrl).startsWith("/dataset/project-procurement-bidding-notices-and-notification-of-contract-awards")) sourceId = "idb";
	else if (host === "iadb.org" && safeUrlPathname(sourceUrl).includes("/procurement/procurement-projects/procurement-notices")) sourceId = "idb";
	else if (host === "au.int" && safeUrlPathname(sourceUrl).startsWith("/en/bids")) sourceId = "african_union";
	else if (host === "nepad.org" && safeUrlPathname(sourceUrl).startsWith("/tenders")) sourceId = "auda_nepad";
	else if (host === "africacdc.org" && /^(?:\/supply-chain-division\/opportunities\/?|\/bid-program\/supply-chain-division\/?|\/opportunity\/)/.test(safeUrlPathname(sourceUrl))) sourceId = "africa_cdc";
	else if (host.includes("aiib.org") && safeUrlPathname(sourceUrl).includes("/project-procurement/")) sourceId = "aiib";
	else if (host === "isdb.org" && safeUrlPathname(sourceUrl).startsWith("/project-procurement/")) sourceId = "isdb";
	else if (host === "mercycorps.org" || host.endsWith(".mercycorps.org")) sourceId = "mercy_corps";
	else if ((host === "plan-international.org" || host.endsWith(".plan-international.org")) && safeUrlPathname(sourceUrl).startsWith("/calls-tender")) sourceId = "plan_international";
	else if (host === "savethechildren.net" || host.endsWith(".savethechildren.net")) sourceId = "save_children";
	else if (host === "spc.int" && safeUrlPathname(sourceUrl).startsWith("/procurement")) sourceId = "spc";
	else if (host.includes("tenders.go.ke")) sourceId = "kenya_ppip";
	else if (host === "un.org" && safeUrlPathname(sourceUrl).startsWith("/procurement/")) sourceId = "un_procurement";
	else if (host.includes("procurement-notices.undp.org")) sourceId = "undp";
	else if (host === "ungm.org") sourceId = "ungm";
	else if (host.includes("worldbank.org")) sourceId = "world_bank";
	else if (host.includes("caribank.org") && safeUrlPathname(sourceUrl).startsWith("/work-with-us/procurement/")) sourceId = "cdb";
	else if (host === "ceb.mu" && safeUrlPathname(sourceUrl).startsWith("/procurement/tender")) sourceId = "ceb_mauritius";
	else if (host.includes("ebrd.com")) sourceId = "ebrd";
	else if (host.includes("sam.gov")) sourceId = "sam_gov";
	else if (host === "contractsfinder.service.gov.uk" && /^(?:\/Published\/Notices\/OCDS\/Search|\/Search|\/Notice\/)/i.test(safeUrlPathname(sourceUrl))) sourceId = "contracts_finder";
	else if (host === "find-tender.service.gov.uk" && /^(?:\/api\/1\.0\/ocdsReleasePackages|\/Search\/Results)/.test(safeUrlPathname(sourceUrl))) sourceId = "find_tender";
	else if (host === "canadabuys.canada.ca" && /^\/(?:en\/tender-opportunities|fr\/occasions-de-marche)/.test(safeUrlPathname(sourceUrl))) sourceId = "canada_buys";
	else if (host === "gets.govt.nz" && /^(?:\/ExternalIndex\.htm|\/[^/]+\/ExternalTenderDetails\.htm)/.test(safeUrlPathname(sourceUrl))) sourceId = "new_zealand_gets";
	else if ((host === "micro.grants.gov" && safeUrlPathname(sourceUrl).startsWith("/rest/opportunities/search")) || (host === "grants.gov" && safeUrlPathname(sourceUrl).startsWith("/search-grants"))) sourceId = "grants_gov";
	else if (host.includes("ec.europa.eu") && sourceUrl.includes("funding-tenders")) sourceId = "eu_funding_tenders";
	else if (host.includes("dgmarket.com")) sourceId = "dgmarket";
	else if (host.includes("comesa.int")) sourceId = "comesa";
	else if (host === "sadc.int" && safeUrlPathname(sourceUrl).startsWith("/procurement-opportunities")) sourceId = "sadc";
	else if (host === "ecowas.int" && /^(?:\/procurement\/|\/nwp_events\/)/.test(safeUrlPathname(sourceUrl))) sourceId = "ecowas";
	else if (host === "ecreee.org" && !/^\/wp-(?:content|admin|includes)\//.test(safeUrlPathname(sourceUrl))) sourceId = "ecreee";
	else if (host === "mof.gov.sl" && /^(?:\/public-notices\/?|\/documents\/|\/wp-content\/uploads\/)/.test(safeUrlPathname(sourceUrl))) sourceId = "mof_sierra_leone";
	else if (host === "marchespublics.ne" && /^(?:\/appels-offres\/?|\/appel-offre\/)/.test(safeUrlPathname(sourceUrl))) sourceId = "marches_publics_niger";
	else if (host === "api.marches-publics.bj" && safeUrlPathname(sourceUrl).startsWith("/v2/api/portail/appelsoffres")) sourceId = "benin_marches_publics";
	else if (host === "marches-publics.bj" && safeUrlPathname(sourceUrl).startsWith("/appels-doffres")) sourceId = "benin_marches_publics";
	else if (host === "dgmp.gouv.ml" && (sourceUrl.includes("q=node/71") || sourceUrl.includes("q=node/66") || safeUrlPathname(sourceUrl).startsWith("/sites/default/files/DATA_IN/"))) sourceId = "dgmp_mali";
	else if (host === "dnccp.gouv.tg" && (safeUrlPathname(sourceUrl).startsWith("/dnccp/wp-json/wp/v2/posts") || safeUrlPathname(sourceUrl).startsWith("/dnccp/category/avis-d-appel-d-offres") || safeUrlPathname(sourceUrl).startsWith("/dnccp/avis-d-appel-d-offres/"))) sourceId = "dnccp_togo";
	else if (host.includes("unicef.org")) sourceId = "unicef";
	else if (host === "unwomen.org" && safeUrlPathname(sourceUrl).startsWith("/en/about-us/procurement")) sourceId = "un_women";
	else if (host === "iom.int" && safeUrlPathname(sourceUrl).startsWith("/procurement-opportunities")) sourceId = "iom";
	else if (host === "rescue.org" && /^(?:\/procurement-policies-and-bid-opportunities|\/rfp\/)/.test(safeUrlPathname(sourceUrl))) sourceId = "irc";
	else if (host.includes("giz.de") && safeUrlPathname(sourceUrl).endsWith("/tenders")) sourceId = "giz";
	else if (host === "gtai.de" && /^\/en\/(?:trade\/tenders|meta\/search\/kfw-tenders)/.test(safeUrlPathname(sourceUrl))) sourceId = "gtai_kfw";
	else if (host === "rti.org" && safeUrlPathname(sourceUrl).startsWith("/current-opportunities")) sourceId = "rti";
	else if (host === "abtglobal.com" && safeUrlPathname(sourceUrl).startsWith("/doing-business-with-abt/commercial-opportunities")) sourceId = "abt_global";
	else if (host === "fhi360.org" && safeUrlPathname(sourceUrl).startsWith("/partner-us-business-opportunities")) sourceId = "fhi360";
	else if (host === "solicitations.fhi360.org" && safeUrlPathname(sourceUrl).startsWith("/Solicitation.aspx")) sourceId = "fhi360";
	else if (host === "nrc.no" && /^(?:\/themes\/177\/tender|\/procurement|\/tender\/)/.test(safeUrlPathname(sourceUrl))) sourceId = "nrc";
	else if (host === "nigeria.oxfam.org" && safeUrlPathname(sourceUrl).startsWith("/procurement-and-consultancy")) sourceId = "oxfam_nigeria";
	else if (host === "thepalladiumgroup.com" && /^(?:\/tenders|\/tender\/)/.test(safeUrlPathname(sourceUrl))) sourceId = "palladium";
	else if (host === "jhpiego.org" && safeUrlPathname(sourceUrl).startsWith("/work-with-us")) sourceId = "jhpiego";
	else if (host === "dt-global.com" && safeUrlPathname(sourceUrl).startsWith("/proposals")) sourceId = "dt_global";
	else if (host === "care.org" && safeUrlPathname(sourceUrl).startsWith("/about-us/contact-us/request-for-proposals")) sourceId = "care";
	else if (host === "enabel.be" && /^(?:\/public-procurement|\/grants)/.test(safeUrlPathname(sourceUrl))) sourceId = "enabel";
	else if (host === "winrock.org" && safeUrlPathname(sourceUrl).startsWith("/contracts")) sourceId = "winrock";
	else if (host === "intdev.tetratech.com.au" && safeUrlPathname(sourceUrl).startsWith("/partner-with-us")) sourceId = "tetra_tech_intdev";
	else if (host === "intdev.tetratecheurope.com" && safeUrlPathname(sourceUrl).startsWith("/work-with-us/tender-opportunities")) sourceId = "tetra_tech_intdev";
	else if (host === "trademarkafrica.com" && /^(?:\/procurement\/?|\/[a-z0-9-]+\/?)$/i.test(safeUrlPathname(sourceUrl))) sourceId = "trademark_africa";
	else if (host.includes("egpuganda.go.ug") && safeUrlPathname(sourceUrl).startsWith("/bid-notices")) sourceId = "egp_uganda";
	else if (host === "cdn.ppda.go.ug" && safeUrlPathname(sourceUrl).startsWith("/api/bid-invitations")) sourceId = "egp_uganda";
	else if (host === "umucyo.gov.rw" && safeUrlPathname(sourceUrl).startsWith("/eb/bav/selectListAdvertisingListForGU.do")) sourceId = "umucyo_rwanda";
	else if (host === "ghaneps.gov.gh" && safeUrlPathname(sourceUrl).startsWith("/epps/quickSearchAction.do")) sourceId = "ghaneps";
	else if (host === "eprocure.zppa.org.zm" && safeUrlPathname(sourceUrl).startsWith("/epps/quickSearchAction.do")) sourceId = "zppa_zambia";
	else if (host === "maneps.mw" && safeUrlPathname(sourceUrl).startsWith("/rms/api/tender-notices/active-tenders-search")) sourceId = "maneps_malawi";
	else if (host === "nocopo.bpp.gov.ng" && /^\/(?:Open-Data|PublishedRecordHandler\.ashx)/.test(safeUrlPathname(sourceUrl))) sourceId = "nocopo_nigeria";
	else if (host === "cpbn.com.na" && safeUrlPathname(sourceUrl).startsWith("/index/external/2")) sourceId = "cpbn_namibia";
	else if (host === "esppra.co.sz" && safeUrlPathname(sourceUrl).startsWith("/sppra/tender.php")) sourceId = "esppra_eswatini";
	else if (host === "ocds-api.etenders.gov.za" && safeUrlPathname(sourceUrl).startsWith("/api/OCDSReleases")) sourceId = "etenders_sa";
	else if (host === "nest.go.tz" && safeUrlPathname(sourceUrl).includes("/nest-data-portal-api/api/releases")) sourceId = "nest_tanzania";
	return sourceId ? getParser(sourceId) ?? genericParser : genericParser;
}

function isSourceApiParser(parser: TenderParser): boolean {
	return parser.sourceId === "sam_gov"
		|| parser.sourceId === "contracts_finder"
		|| parser.sourceId === "find_tender"
		|| parser.sourceId === "canada_buys"
		|| parser.sourceId === "new_zealand_gets"
		|| parser.sourceId === "grants_gov"
		|| parser.sourceId === "eu_funding_tenders"
		|| parser.sourceId === "adb"
		|| parser.sourceId === "badea"
		|| parser.sourceId === "boad"
		|| parser.sourceId === "dbsa"
		|| parser.sourceId === "idb"
		|| parser.sourceId === "african_union"
		|| parser.sourceId === "aiib"
		|| parser.sourceId === "isdb"
		|| parser.sourceId === "world_bank"
		|| parser.sourceId === "cdb"
		|| parser.sourceId === "ceb_mauritius"
		|| parser.sourceId === "comesa"
		|| parser.sourceId === "sadc"
		|| parser.sourceId === "ecowas"
		|| parser.sourceId === "ecreee"
		|| parser.sourceId === "mof_sierra_leone"
		|| parser.sourceId === "marches_publics_niger"
		|| parser.sourceId === "benin_marches_publics"
		|| parser.sourceId === "dgmp_mali"
		|| parser.sourceId === "dnccp_togo"
		|| parser.sourceId === "iom"
		|| parser.sourceId === "nest_tanzania"
		|| parser.sourceId === "egp_uganda"
		|| parser.sourceId === "umucyo_rwanda"
		|| parser.sourceId === "ghaneps"
		|| parser.sourceId === "zppa_zambia"
		|| parser.sourceId === "maneps_malawi"
		|| parser.sourceId === "nrc"
		|| parser.sourceId === "nocopo_nigeria"
		|| parser.sourceId === "cpbn_namibia"
		|| parser.sourceId === "esppra_eswatini"
		|| parser.sourceId === "etenders_sa"
		|| parser.sourceId === "trademark_africa";
}

function isLowValueDiscoveryUrl(url: string | undefined): boolean {
	if (!url) return false;
	try {
		const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
		return LOW_VALUE_DISCOVERY_HOSTS.has(host)
			|| Array.from(LOW_VALUE_DISCOVERY_HOSTS).some((blockedHost) => host.endsWith(`.${blockedHost}`));
	} catch {
		return false;
	}
}

function isHighIntentDiscoveryQuery(query: string): boolean {
	const normalized = query.toLowerCase();
	return HIGH_INTENT_QUERY_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isKnownProcurementPortalUrl(url: string): boolean {
	return PROCUREMENT_PORTAL_URL_PATTERNS.some((pattern) => pattern.test(url));
}

function isLikelyOpportunity(result: SearxngResult, query?: string): boolean {
	if (isLowValueDiscoveryUrl(result.url)) return false;
	if (isBotProtectionSearchResult(result)) return false;
	const haystack = `${result.title} ${result.content} ${result.url}`.toLowerCase();
	if (OPPORTUNITY_KEYWORDS.some((keyword) => haystack.includes(keyword))) return true;
	if (!query || !isHighIntentDiscoveryQuery(query)) return false;
	return isDocumentUrl(result.url) || isKnownProcurementPortalUrl(result.url);
}

function isBotProtectionSearchResult(result: Pick<SearxngResult, "title" | "content" | "url">): boolean {
	const haystack = `${result.title}\n${result.content}\n${result.url}`;
	return BOT_PROTECTION_CONTENT_PATTERN.test(haystack);
}

function describeUnresponsiveEngine(engine: SearxngUnresponsiveEngine): string {
	if (Array.isArray(engine)) {
		return engine.filter(Boolean).join(": ");
	}
	if (typeof engine === "string") {
		return engine;
	}
	const name = engine.engine ?? "unknown";
	const reason = engine.error ?? engine.message;
	return reason ? `${name}: ${reason}` : name;
}

function collectSearxngEngineWarnings(
	query: string,
	unresponsiveEngines: SearxngUnresponsiveEngine[] | undefined
): DiscoveryRunWarning[] {
	if (!unresponsiveEngines?.length) return [];

	return [{
		type: "searxng_engine_degraded",
		query,
		title: "SearXNG engine degradation",
		url: `${getSearxngBaseUrl()}/search`,
		message: unresponsiveEngines.map(describeUnresponsiveEngine).join("; "),
	}];
}

function collectSearchNoCandidateWarning(query: string): DiscoveryRunWarning {
	return {
		type: "search_no_candidates",
		query,
		title: "SearXNG returned no opportunity candidates",
		url: `${getSearxngBaseUrl()}/search`,
		message: `No opportunity-like search results were accepted for "${query}"; configured source scraping or query refinement is required to produce candidates.`,
	};
}

function searchEngineLabel(engines: string[] | undefined): string {
	return engines?.length === 1 ? engines[0] : "searxng";
}

function searchRequestsForInput(
	query: string,
	input: DiscoveryImportInput
): DiscoverySearchRequest[] {
	const engines = input.engines?.filter((engine) => engine.trim()) ?? [];
	const shouldFanOut = input.searchEngineFanout !== false && engines.length > 1;
	const pages = Array.from(
		{ length: discoverySearchPages(input.searchPages) },
		(_, index) => index + 1
	);
	if (!shouldFanOut) {
		return pages.map((page) => ({
			query,
			engines: engines.length > 0 ? engines : undefined,
			page,
			label: searchEngineLabel(engines.length > 0 ? engines : undefined),
			failedAsImportError: true,
		}));
	}

	return engines.flatMap((engine) =>
		pages.map((page) => ({
			query,
			engines: [engine],
			page,
			label: page === 1 ? engine : `${engine}:page-${page}`,
			failedAsImportError: false,
		}))
	);
}

function discoverySearchConcurrency(): number {
	const parsed = Number(process.env.DISCOVERY_SEARCH_CONCURRENCY ?? DEFAULT_DISCOVERY_SEARCH_CONCURRENCY);
	if (!Number.isFinite(parsed)) return DEFAULT_DISCOVERY_SEARCH_CONCURRENCY;
	return Math.min(16, Math.max(1, Math.trunc(parsed)));
}

function discoverySearchPages(raw: number | undefined): number {
	if (raw === undefined) return 1;
	if (!Number.isFinite(raw)) return 1;
	return Math.min(5, Math.max(1, Math.trunc(raw)));
}

async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let nextIndex = 0;

	async function runWorker(): Promise<void> {
		while (nextIndex < items.length) {
			const index = nextIndex++;
			results[index] = await worker(items[index]!, index);
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, () => runWorker())
	);
	return results;
}

async function runDiscoverySearches(
	queries: string[],
	input: DiscoveryImportInput
): Promise<DiscoverySearchOutcome[]> {
	const tasks = queries.flatMap((query) =>
		searchRequestsForInput(query, input).map((request) => ({ query, request }))
	);

	return mapWithConcurrency(tasks, discoverySearchConcurrency(), async (task) => {
		try {
			const response = await searchSearxng(task.request.query, {
				categories: input.categories ?? ["general"],
				engines: task.request.engines,
				language: input.language,
				page: task.request.page > 1 ? task.request.page : undefined,
				time_range: input.timeRange,
				safesearch: 1,
			});
			return { ...task, response };
		} catch (error) {
			return { ...task, error };
		}
	});
}

function inferOpportunityType(candidate: DiscoveryCandidate): OpportunityInput["opportunityType"] {
	const haystack = [
		candidate.result.title,
		candidate.result.content,
		candidate.scrape?.title,
		candidate.scrape?.description,
	].join(" ").toLowerCase();

	if (haystack.includes("expression of interest") || /\beoi\b/.test(haystack)) return "eoi";
	if (haystack.includes("grant")) return "grant";
	if (
		haystack.includes("request for quotation")
		|| haystack.includes("request for bid")
		|| haystack.includes("invitation to bid")
		|| /\brfq\b/.test(haystack)
		|| /\bitb\b/.test(haystack)
	) return "tender";
	if (haystack.includes("tender")) return "tender";
	if (haystack.includes("request for proposal") || /\brfp\b/.test(haystack)) return "rfp";
	return "other";
}

function resultHost(url: string): string | undefined {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return undefined;
	}
}

function isDocumentUrl(url: string): boolean {
	return DOCUMENT_URL_PATTERN.test(url);
}

function normalizeCandidateDocumentUrl(rawUrl: string, baseUrl: string): string | null {
	const trimmed = rawUrl.trim().replace(/[),.;]+$/, "");
	if (!trimmed) return null;

	try {
		const parsed = new URL(trimmed, baseUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null;
		}
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return null;
	}
}

function scoreDocumentLink(label: string, url: string): number {
	const haystack = `${label} ${url}`.toLowerCase();
	let score = 0;
	if (/\.pdf(?:[?#]|$)/i.test(url)) score += 5;
	if (/\.docx?(?:[?#]|$)/i.test(url)) score += 4;
	if (/\.xlsx?(?:[?#]|$)/i.test(url)) score += 2;
	if (/\.zip(?:[?#]|$)/i.test(url)) score += 1;
	for (const keyword of DOCUMENT_LINK_KEYWORDS) {
		if (haystack.includes(keyword)) score += 3;
	}
	return score;
}

function addDocumentLinkCandidate(
	candidates: DiscoveryDocumentLink[],
	seenUrls: Map<string, number>,
	link: DiscoveryDocumentLink
): void {
	if (isLowValueDiscoveryUrl(link.url)) return;
	if (isLowValueProcurementDocumentLink(link)) return;
	const existingIndex = seenUrls.get(link.url);
	if (existingIndex === undefined) {
		seenUrls.set(link.url, candidates.length);
		candidates.push(link);
		return;
	}

	const existing = candidates[existingIndex];
	if (!existing || existing.score >= link.score) return;
	candidates[existingIndex] = {
		...link,
		label: link.label || existing.label,
	};
}

function extractDocumentLinks(
	markdown: string | undefined,
	links: string[] | undefined,
	baseUrl: string
): DiscoveryDocumentLink[] {
	const candidates: DiscoveryDocumentLink[] = [];
	const seenUrls = new Map<string, number>();

	if (markdown?.trim()) {
		const markdownLinkPattern = /!?\[([^\]]{0,240})\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
		for (const match of markdown.matchAll(markdownLinkPattern)) {
			const label = match[1] ?? "";
			const url = normalizeCandidateDocumentUrl(match[2] ?? "", baseUrl);
			if (!url || !isDocumentUrl(url)) continue;
			addDocumentLinkCandidate(candidates, seenUrls, {
				url,
				label: label || undefined,
				source: "scraped_markdown",
				score: scoreDocumentLink(label, url),
			});
		}

		const bareUrlPattern = /https?:\/\/[^\s<>"'()[\]]+/g;
		for (const match of markdown.matchAll(bareUrlPattern)) {
			const url = normalizeCandidateDocumentUrl(match[0] ?? "", baseUrl);
			if (!url || !isDocumentUrl(url)) continue;
			addDocumentLinkCandidate(candidates, seenUrls, {
				url,
				source: "scraped_markdown",
				score: scoreDocumentLink("", url),
			});
		}
	}

	for (const rawLink of links ?? []) {
		const url = normalizeCandidateDocumentUrl(rawLink, baseUrl);
		if (!url || !isDocumentUrl(url)) continue;
		addDocumentLinkCandidate(candidates, seenUrls, {
			url,
			source: "scraped_link",
			score: scoreDocumentLink("", url),
		});
	}

	return candidates
		.map((candidate, order) => ({ ...candidate, order }))
		.sort((a, b) => b.score - a.score || a.order - b.order)
		.map(({ order: _order, ...candidate }) => candidate);
}

function collectCandidateDocumentLinks(candidate: DiscoveryCandidate): DiscoveryDocumentLink[] {
	const candidates: DiscoveryDocumentLink[] = [];
	const seenUrls = new Map<string, number>();

	if (isDocumentUrl(candidate.result.url)) {
		const url = normalizeCandidateDocumentUrl(candidate.result.url, candidate.result.url);
		if (url) {
			addDocumentLinkCandidate(candidates, seenUrls, {
				url,
				source: "result_url",
				score: scoreDocumentLink(candidate.result.title, url),
				label: candidate.result.title,
			});
		}
	}

	if (candidate.opportunity?.documentUrl) {
		const url = normalizeCandidateDocumentUrl(
			candidate.opportunity.documentUrl,
			candidate.opportunity.portalUrl ?? candidate.result.url
		);
		if (url) {
			addDocumentLinkCandidate(candidates, seenUrls, {
				url,
				source: "opportunity_document_url",
				score: scoreDocumentLink(candidate.opportunity.title, url) + 2,
				label: candidate.opportunity.title,
			});
		}
	}

	for (const link of sourceOpportunityDocumentLinks(candidate.opportunity)) {
		addDocumentLinkCandidate(candidates, seenUrls, link);
	}

	if (candidates.length > 0 && candidate.opportunity?.source === "giz") {
		return candidates
			.map((candidateLink, order) => ({ ...candidateLink, order }))
			.sort((a, b) => b.score - a.score || a.order - b.order)
			.slice(0, MAX_DISCOVERY_SOURCE_DOCUMENTS)
			.map(({ order: _order, ...candidateLink }) => candidateLink);
	}

	if (shouldAttachPageWideDocumentLinks(candidate)) {
		for (const link of extractDocumentLinks(candidate.scrape?.markdown, candidate.scrape?.links, candidate.result.url)) {
			addDocumentLinkCandidate(candidates, seenUrls, link);
		}
	}

	return candidates
		.map((candidateLink, order) => ({ ...candidateLink, order }))
		.sort((a, b) => b.score - a.score || a.order - b.order)
		.slice(0, MAX_DISCOVERY_SOURCE_DOCUMENTS)
		.map(({ order: _order, ...candidateLink }) => candidateLink);
}

function shouldAttachPageWideDocumentLinks(candidate: DiscoveryCandidate): boolean {
	return candidate.discoveryMethod !== "source_scrape";
}

function sourceOpportunityDocumentLinks(opportunity: OpportunityData | undefined): DiscoveryDocumentLink[] {
	const metadataLinks = ["giz", "fhi360", "dtGlobal", "care", "enabel", "winrock", "nrc", "oxfamNigeria", "irc", "idb", "contractsFinder", "canadaBuys", "newZealandGets", "tradeMarkAfrica", "badea", "boad", "dbsa", "isdb", "africanUnion", "audaNepad", "africaCdc", "sadc", "ecowas", "ecreee", "mofSierraLeone"].flatMap((key) => {
		const metadata = opportunity?.metadata?.[key];
		if (!metadata || typeof metadata !== "object") return [];
		const links = (metadata as { documentLinks?: unknown }).documentLinks;
		return Array.isArray(links) ? links : [];
	});
	if (metadataLinks.length === 0) return [];

	return metadataLinks
		.map((link): DiscoveryDocumentLink | undefined => {
			if (!link || typeof link !== "object") return undefined;
			const { url, label } = link as { url?: unknown; label?: unknown };
			if (typeof url !== "string" || !isDocumentUrl(url)) return undefined;
			return {
				url,
				label: typeof label === "string" ? label : undefined,
				source: "opportunity_document_url",
				score: scoreDocumentLink(typeof label === "string" ? label : "", url) + 2,
			};
		})
		.filter((link): link is DiscoveryDocumentLink => Boolean(link));
}

function extractDocumentUrlFromMarkdown(markdown: string | undefined, baseUrl: string): string | undefined {
	return extractDocumentLinks(markdown, undefined, baseUrl)[0]?.url;
}

function sourcePlatformName(opportunity: OpportunityData | undefined, discoveryMethod: DiscoveryCandidate["discoveryMethod"]): string {
	if (opportunity?.source === "afdb") return "African Development Bank";
	if (opportunity?.source === "adb") return "Asian Development Bank";
	if (opportunity?.source === "badea") return "BADEA";
	if (opportunity?.source === "boad") return "BOAD";
	if (opportunity?.source === "dbsa") return "Development Bank of Southern Africa";
	if (opportunity?.source === "idb") return "Inter-American Development Bank";
	if (opportunity?.source === "african_union") return "African Union";
	if (opportunity?.source === "auda_nepad") return "African Union Development Agency";
	if (opportunity?.source === "africa_cdc") return "Africa CDC";
	if (opportunity?.source === "aiib") return "Asian Infrastructure Investment Bank";
	if (opportunity?.source === "isdb") return "Islamic Development Bank";
	if (opportunity?.source === "kenya_ppip") return "Kenya PPIP";
	if (opportunity?.source === "undp") return "UNDP";
	if (opportunity?.source === "ungm") return "UNGM";
	if (opportunity?.source === "world_bank") return "World Bank";
	if (opportunity?.source === "cdb") return "Caribbean Development Bank";
	if (opportunity?.source === "ceb_mauritius") return "Mauritius CEB";
	if (opportunity?.source === "ebrd") return "EBRD";
	if (opportunity?.source === "sam_gov") return "SAM.gov";
	if (opportunity?.source === "contracts_finder") return "UK Contracts Finder";
	if (opportunity?.source === "find_tender") return "UK Find a Tender";
	if (opportunity?.source === "canada_buys") return "CanadaBuys";
	if (opportunity?.source === "new_zealand_gets") return "New Zealand GETS";
	if (opportunity?.source === "grants_gov") return "Grants.gov";
	if (opportunity?.source === "eu_funding_tenders") return "EU Funding & Tenders";
	if (opportunity?.source === "dgmarket") return "DGMarket";
	if (opportunity?.source === "comesa") return "COMESA";
	if (opportunity?.source === "sadc") return "SADC";
	if (opportunity?.source === "ecowas") return "ECOWAS";
	if (opportunity?.source === "ecreee") return "ECREEE";
	if (opportunity?.source === "mof_sierra_leone") return "Sierra Leone Ministry of Finance";
	if (opportunity?.source === "marches_publics_niger") return "Niger Public Procurement Portal";
	if (opportunity?.source === "benin_marches_publics") return "Benin Public Procurement Portal";
	if (opportunity?.source === "dgmp_mali") return "DGMP Mali";
	if (opportunity?.source === "dnccp_togo") return "DNCCP Togo";
	if (opportunity?.source === "un_procurement") return "UN Procurement";
	if (opportunity?.source === "unicef") return "UNICEF Supply Division";
	if (opportunity?.source === "iom") return "IOM";
	if (opportunity?.source === "irc") return "International Rescue Committee";
	if (opportunity?.source === "giz") return "GIZ";
	if (opportunity?.source === "mercy_corps") return "Mercy Corps";
	if (opportunity?.source === "plan_international") return "Plan International";
	if (opportunity?.source === "save_children") return "Save the Children International";
	if (opportunity?.source === "spc") return "Pacific Community";
	if (opportunity?.source === "rti") return "RTI International";
	if (opportunity?.source === "abt_global") return "Abt Global";
	if (opportunity?.source === "fhi360") return "FHI 360";
	if (opportunity?.source === "palladium") return "Palladium";
	if (opportunity?.source === "jhpiego") return "Jhpiego";
	if (opportunity?.source === "dt_global") return "DT Global";
	if (opportunity?.source === "care") return "CARE";
	if (opportunity?.source === "enabel") return "Enabel";
	if (opportunity?.source === "winrock") return "Winrock International";
	if (opportunity?.source === "nrc") return "Norwegian Refugee Council";
	if (opportunity?.source === "oxfam_nigeria") return "Oxfam in Nigeria";
	if (opportunity?.source === "tetra_tech_intdev") return "Tetra Tech International Development";
	if (opportunity?.source === "trademark_africa") return "TradeMark Africa";
	if (opportunity?.source === "egp_uganda") return "Uganda eGP";
	if (opportunity?.source === "umucyo_rwanda") return "Rwanda UMUCYO";
	if (opportunity?.source === "ghaneps") return "Ghana GHANEPS";
	if (opportunity?.source === "zppa_zambia") return "Zambia ZPPA";
	if (opportunity?.source === "nest_tanzania") return "NeST Tanzania";
	if (opportunity?.source === "etenders_sa") return "South Africa eTenders";
	if (opportunity?.source === "maneps_malawi") return "MANEPS Malawi";
	if (opportunity?.source === "nocopo_nigeria") return "Nigeria NOCOPO";
	if (opportunity?.source === "cpbn_namibia") return "Namibia CPBN";
	if (opportunity?.source === "esppra_eswatini") return "ESPPRA Eswatini";
	return discoveryMethod === "source_scrape" ? "Configured Source Scrape" : "SearXNG";
}

function sourceTags(opportunity: OpportunityData | undefined, discoveryMethod: DiscoveryCandidate["discoveryMethod"]): string[] {
	if (discoveryMethod !== "source_scrape") return ["external-discovery"];
	return [...new Set([
		"external-discovery",
		"source-scrape",
		...(opportunity?.source === "afdb" ? ["afdb", "development-bank", "regional-procurement"] : []),
		...(opportunity?.source === "adb" ? ["adb", "development-bank", "institutional-procurement"] : []),
		...(opportunity?.source === "badea" ? ["badea", "development-bank", "africa", "source-documents"] : []),
		...(opportunity?.source === "boad" ? ["boad", "development-bank", "west-africa", "uemoa", "source-documents"] : []),
		...(opportunity?.source === "dbsa" ? ["dbsa", "south-africa", "development-bank", "source-documents"] : []),
		...(opportunity?.source === "idb" ? ["idb", "iadb", "development-bank", "source-documents"] : []),
		...(opportunity?.source === "african_union" ? ["african-union", "auc", "regional-procurement", "direct-documents"] : []),
		...(opportunity?.source === "auda_nepad" ? ["auda-nepad", "african-union", "africa", "source-documents"] : []),
		...(opportunity?.source === "africa_cdc" ? ["africa-cdc", "african-union", "africa", "health-procurement"] : []),
		...(opportunity?.source === "aiib" ? ["aiib", "development-bank", "project-procurement"] : []),
		...(opportunity?.source === "isdb" ? ["isdb", "development-bank", "global-south", "project-procurement", "source-documents"] : []),
		...(opportunity?.source === "kenya_ppip" ? ["kenya-ppip"] : []),
		...(opportunity?.source === "undp" ? ["undp", "un-procurement"] : []),
		...(opportunity?.source === "ungm" ? ["ungm", "un-procurement"] : []),
		...(opportunity?.source === "world_bank" ? ["world-bank", "development-bank", "global-procurement"] : []),
		...(opportunity?.source === "cdb" ? ["cdb", "development-bank", "regional-procurement"] : []),
		...(opportunity?.source === "ceb_mauritius" ? ["ceb", "mauritius", "national-procurement", "direct-documents"] : []),
		...(opportunity?.source === "ebrd" ? ["ebrd", "development-bank", "global-procurement"] : []),
		...(opportunity?.source === "sam_gov" ? ["sam-gov", "us-federal"] : []),
		...(opportunity?.source === "contracts_finder" ? ["contracts-finder", "uk", "public-procurement", "ocds"] : []),
		...(opportunity?.source === "find_tender" ? ["find-tender", "uk", "public-procurement", "ocds"] : []),
		...(opportunity?.source === "canada_buys" ? ["canadabuys", "canada", "public-procurement", "source-documents"] : []),
		...(opportunity?.source === "new_zealand_gets" ? ["gets", "new-zealand", "public-procurement", "source-documents"] : []),
		...(opportunity?.source === "grants_gov" ? ["grants-gov", "us-federal", "grant"] : []),
		...(opportunity?.source === "eu_funding_tenders" ? ["eu-funding-tenders", "european-commission"] : []),
		...(opportunity?.source === "dgmarket" ? ["dgmarket", "global-south", "global-procurement", "source-documents"] : []),
		...(opportunity?.source === "comesa" ? ["comesa", "regional-procurement"] : []),
		...(opportunity?.source === "sadc" ? ["sadc", "southern-africa", "regional-procurement", "source-documents"] : []),
		...(opportunity?.source === "ecowas" ? ["ecowas", "west-africa", "regional-procurement", "source-documents"] : []),
		...(opportunity?.source === "ecreee" ? ["ecreee", "ecowas", "west-africa", "renewable-energy", "source-documents"] : []),
		...(opportunity?.source === "mof_sierra_leone" ? ["sierra-leone", "ministry-of-finance", "national-procurement", "source-documents"] : []),
		...(opportunity?.source === "marches_publics_niger" ? ["niger", "west-africa", "national-procurement", "source-api"] : []),
		...(opportunity?.source === "benin_marches_publics" ? ["benin", "west-africa", "national-procurement", "source-api", "direct-documents"] : []),
		...(opportunity?.source === "dgmp_mali" ? ["mali", "west-africa", "national-procurement", "source-api", "direct-documents"] : []),
		...(opportunity?.source === "dnccp_togo" ? ["togo", "west-africa", "national-procurement", "source-api", "direct-documents"] : []),
		...(opportunity?.source === "un_procurement" ? ["un-procurement", "unpd"] : []),
		...(opportunity?.source === "unicef" ? ["unicef", "un-procurement", "tender-calendar"] : []),
		...(opportunity?.source === "iom" ? ["iom", "un-procurement"] : []),
		...(opportunity?.source === "irc" ? ["irc", "ngo", "source-documents"] : []),
		...(opportunity?.source === "giz" ? ["giz", "bilateral-donor"] : []),
		...(opportunity?.source === "mercy_corps" ? ["mercy-corps", "ngo", "source-documents"] : []),
		...(opportunity?.source === "plan_international" ? ["plan-international", "ngo", "source-documents"] : []),
		...(opportunity?.source === "save_children" ? ["save-the-children", "ngo", "source-documents"] : []),
		...(opportunity?.source === "spc" ? ["spc", "pacific-community", "regional-procurement", "source-documents"] : []),
		...(opportunity?.source === "fhi360" ? ["fhi360", "donor-implementer", "source-documents"] : []),
		...(opportunity?.source === "palladium" ? ["palladium", "donor-implementer", "source-documents"] : []),
		...(opportunity?.source === "jhpiego" ? ["jhpiego", "donor-implementer"] : []),
		...(opportunity?.source === "dt_global" ? ["dt-global", "donor-implementer", "source-documents"] : []),
		...(opportunity?.source === "care" ? ["care", "ngo", "source-documents"] : []),
		...(opportunity?.source === "enabel" ? ["enabel", "bilateral-donor", "source-documents"] : []),
		...(opportunity?.source === "winrock" ? ["winrock", "ngo", "source-documents"] : []),
		...(opportunity?.source === "nrc" ? ["nrc", "ngo", "source-documents"] : []),
		...(opportunity?.source === "oxfam_nigeria" ? ["oxfam-nigeria", "ngo", "source-documents"] : []),
		...(opportunity?.source === "tetra_tech_intdev" ? ["tetra-tech-intdev", "donor-implementer", "source-documents"] : []),
		...(opportunity?.source === "trademark_africa" ? ["trademark-africa", "africa", "regional-trade", "source-documents"] : []),
		...(opportunity?.source === "egp_uganda" ? ["egp-uganda", "national-procurement"] : []),
		...(opportunity?.source === "umucyo_rwanda" ? ["umucyo", "rwanda", "national-procurement"] : []),
		...(opportunity?.source === "ghaneps" ? ["ghaneps", "ghana", "national-procurement"] : []),
		...(opportunity?.source === "zppa_zambia" ? ["zppa", "zambia", "national-procurement"] : []),
		...(opportunity?.source === "nest_tanzania" ? ["nest-tanzania", "tanzania", "national-procurement", "ocds"] : []),
		...(opportunity?.source === "etenders_sa" ? ["etenders-sa", "south-africa", "national-procurement", "ocds"] : []),
		...(opportunity?.source === "maneps_malawi" ? ["maneps", "malawi", "national-procurement"] : []),
		...(opportunity?.source === "nocopo_nigeria" ? ["nocopo", "nigeria", "national-procurement", "open-contracting"] : []),
		...(opportunity?.source === "cpbn_namibia" ? ["cpbn", "namibia", "national-procurement"] : []),
		...(opportunity?.source === "esppra_eswatini" ? ["esppra", "eswatini", "national-procurement", "direct-documents"] : []),
		...(opportunity?.tags ?? []),
	])];
}

function configuredSourceScrapeAttempts(): number {
	const parsed = Number(process.env.CONFIGURED_SOURCE_SCRAPE_ATTEMPTS ?? DEFAULT_CONFIGURED_SOURCE_SCRAPE_ATTEMPTS);
	return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : DEFAULT_CONFIGURED_SOURCE_SCRAPE_ATTEMPTS;
}

function configuredSourceMaxPages(): number {
	const parsed = Number(process.env.CONFIGURED_SOURCE_MAX_PAGES ?? DEFAULT_CONFIGURED_SOURCE_MAX_PAGES);
	if (!Number.isFinite(parsed)) return DEFAULT_CONFIGURED_SOURCE_MAX_PAGES;
	return Math.min(5, Math.max(1, Math.trunc(parsed)));
}

function configuredSourceDetailLimit(): number {
	const parsed = Number(process.env.CONFIGURED_SOURCE_DETAIL_LIMIT ?? DEFAULT_CONFIGURED_SOURCE_DETAIL_LIMIT);
	if (!Number.isFinite(parsed)) return DEFAULT_CONFIGURED_SOURCE_DETAIL_LIMIT;
	return Math.min(50, Math.max(0, Math.trunc(parsed)));
}

function sourceOpportunityType(opportunity: OpportunityData | undefined): OpportunityInput["opportunityType"] | undefined {
	if (!opportunity?.opportunityType) return undefined;
	if (opportunity.opportunityType === "contract") return "tender";
	return opportunity.opportunityType;
}

function safeUrlPathname(url: string): string {
	try {
		return new URL(url).pathname;
	} catch {
		return "";
	}
}

function isUmucyoTenderDetailUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return parsed.hostname.toLowerCase() === "www.umucyo.gov.rw"
			&& parsed.pathname === "/eb/bav/selectAdvertisingDtlInfo.do"
			&& Boolean(parsed.searchParams.get("tendReferNo"));
	} catch {
		return false;
	}
}

function discoveredSourceDocumentName(url: string, opportunityTitle: string): string {
	if (isUmucyoTenderDetailUrl(url)) {
		return `${opportunityTitle.slice(0, 450)}.html`;
	}
	const path = safeUrlPathname(url);
	const filename = path.split("/").filter(Boolean).pop();
	if (filename && /\.[a-z0-9]{2,5}$/i.test(filename)) {
		return decodeURIComponent(filename).slice(0, 500);
	}
	return `${opportunityTitle.slice(0, 450)}.html`;
}

function discoveredSourceDocumentType(url: string): "rfp" | "attachment" {
	if (isUmucyoTenderDetailUrl(url)) return "rfp";
	const path = safeUrlPathname(url);
	return /\.(pdf|docx?|html?)$/i.test(path) || /(rfp|tender|bid|solicitation)/i.test(url)
		? "rfp"
		: "attachment";
}

function discoveryDocumentLinksFromOpportunity(opportunity: OpportunityInput): string[] {
	const urls = new Set<string>();
	if (opportunity.documentUrl) urls.add(opportunity.documentUrl);

	const discovery = opportunity.metadata?.discovery;
	if (discovery && typeof discovery === "object" && !Array.isArray(discovery)) {
		const links = (discovery as { documentLinks?: unknown }).documentLinks;
		if (Array.isArray(links)) {
			for (const link of links) {
				if (typeof link === "string") {
					urls.add(link);
				} else if (link && typeof link === "object") {
					const { url, score } = link as { url?: unknown; score?: unknown };
					if (
						typeof score === "number"
						&& score < MIN_DISCOVERY_SOURCE_DOCUMENT_SCORE
						&& url !== opportunity.documentUrl
					) {
						continue;
					}
					if (typeof url === "string") urls.add(url);
				}
			}
		}
	}

	return [...urls].slice(0, MAX_DISCOVERY_SOURCE_DOCUMENTS);
}

async function ensureDiscoveredSourceDocument(
	opportunityId: string,
	opportunity: OpportunityInput,
	organizationId: string,
	documentUrl = opportunity.documentUrl
): Promise<SourceDocumentSeedResult> {
	if (!documentUrl) return { state: "none" };

	const [existing] = await db
		.select({ id: opportunityDocuments.id })
		.from(opportunityDocuments)
		.where(and(
			eq(opportunityDocuments.opportunityId, opportunityId),
			eq(opportunityDocuments.organizationId, organizationId),
			eq(opportunityDocuments.sourceUrl, documentUrl)
		)!)
		.limit(1);
	if (existing?.id) return { state: "existing", documentId: existing.id, sourceUrl: documentUrl };

	const [created] = await db.insert(opportunityDocuments).values({
		organizationId,
		opportunityId,
		documentName: discoveredSourceDocumentName(documentUrl, opportunity.title),
		documentType: discoveredSourceDocumentType(documentUrl),
		description: "Source document link from live opportunity discovery.",
		sourceUrl: documentUrl,
		status: "discovered",
		isSelected: true,
	}).returning({ id: opportunityDocuments.id });
	if (!created?.id) {
		throw new Error("Source document row was not returned after insert");
	}
	return { state: "created", documentId: created.id, sourceUrl: documentUrl };
}

async function ensureDiscoveredSourceDocumentSafely(
	opportunityId: string,
	opportunity: OpportunityInput,
	organizationId: string,
	candidate: DiscoveryCandidate,
	warnings: DiscoveryRunWarning[],
	documentUrl = opportunity.documentUrl
): Promise<SourceDocumentSeedResult> {
	try {
		return await ensureDiscoveredSourceDocument(opportunityId, opportunity, organizationId, documentUrl);
	} catch (error) {
		warnings.push({
			type: "source_document_seed_failed",
			query: candidate.query,
			title: candidate.result.title,
			url: documentUrl ?? candidate.result.url,
			message: error instanceof Error ? error.message : "Source document row could not be seeded",
		});
		return { state: "failed", sourceUrl: documentUrl };
	}
}

async function ensureDiscoveredSourceDocumentsSafely(
	opportunityId: string,
	opportunity: OpportunityInput,
	organizationId: string,
	candidate: DiscoveryCandidate,
	warnings: DiscoveryRunWarning[]
): Promise<SourceDocumentSeedResult[]> {
	const documentUrls = discoveryDocumentLinksFromOpportunity(opportunity);
	if (documentUrls.length === 0) return [{ state: "none" }];

	const results: SourceDocumentSeedResult[] = [];
	for (const documentUrl of documentUrls) {
		results.push(await ensureDiscoveredSourceDocumentSafely(
			opportunityId,
			opportunity,
			organizationId,
			candidate,
			warnings,
			documentUrl
		));
	}
	return results;
}

async function downloadSeededSourceDocumentSafely(
	documentId: string,
	opportunityId: string,
	userId: string,
	candidate: DiscoveryCandidate,
	warnings: DiscoveryRunWarning[],
	parseMode?: DownloadParseMode
): Promise<SourceDocumentDownloadOutcome> {
	try {
		const result = parseMode
			? await downloadDocument(documentId, userId, opportunityId, { parseMode })
			: await downloadDocument(documentId, userId, opportunityId);
		if (result.success) {
			return {
				downloaded: true,
				parsingStatus: result.parsingStatus,
				parsingError: result.parsingError,
			};
		}

		warnings.push({
			type: "source_document_download_failed",
			query: candidate.query,
			title: candidate.result.title,
			url: candidate.result.url,
			message: result.error ?? "Seeded source document could not be downloaded",
		});
	} catch (error) {
		warnings.push({
			type: "source_document_download_failed",
			query: candidate.query,
			title: candidate.result.title,
			url: candidate.result.url,
			message: error instanceof Error ? error.message : "Seeded source document could not be downloaded",
		});
	}
	return { downloaded: false };
}

function importConfigWithWarnings(
	baseConfig: ImportConfig,
	warnings: DiscoveryRunWarning[],
	sourceHealth: ImportSourceHealth[] = []
): ImportConfig {
	const audit = {
		...(warnings.length > 0 ? { warnings } : {}),
		...(sourceHealth.length > 0 ? { sourceHealth } : {}),
	};
	return {
		...baseConfig,
		...(Object.keys(audit).length > 0 ? { audit } : {}),
	};
}

function sourceQuery(sourceUrl: string): string {
	return `source:${sourceUrl}`;
}

function incrementRecordCounter(record: Record<string, number>, key: string): void {
	record[key] = (record[key] ?? 0) + 1;
}

function warningBelongsToSource(warning: DiscoveryRunWarning, sourceUrl: string): boolean {
	return warning.query === sourceQuery(sourceUrl)
		|| warning.url === sourceUrl
		|| warning.url.startsWith(`${sourceUrl}/`);
}

function buildSourceHealthRollups(
	sourceUrls: string[],
	candidates: DiscoveryCandidate[],
	outcomes: SourceCandidateImportOutcome[],
	warnings: DiscoveryRunWarning[]
): ImportSourceHealth[] {
	return sourceUrls.map((sourceUrl) => {
		const sourceCandidates = candidates.filter((candidate) => candidate.sourceUrl === sourceUrl);
		const sourceOutcomes = outcomes.filter((outcome) => outcome.sourceUrl === sourceUrl);
		const sourceWarnings = warnings.filter((warning) => warningBelongsToSource(warning, sourceUrl));
		const warningTypes: Record<string, number> = {};
		for (const warning of sourceWarnings) {
			incrementRecordCounter(warningTypes, warning.type);
		}

		const imported = sourceOutcomes.filter((outcome) => outcome.status === "created").length;
		const updated = sourceOutcomes.filter((outcome) => outcome.status === "updated").length;
		const skipped = sourceOutcomes.filter((outcome) => outcome.status === "skipped").length;
		const failed = sourceOutcomes.filter((outcome) => outcome.status === "failed").length;
		const hasFailedScrape = Boolean(
			warningTypes.source_scrape_failed
			|| warningTypes.browser_fallback_failed
			|| warningTypes.cloakbrowser_fallback_failed
		);
		const hasEmptyScrape = Boolean(warningTypes.source_scrape_empty);
		const hasDegradation = sourceWarnings.length > 0 || failed > 0;
		const status: ImportSourceHealth["status"] = sourceCandidates.length === 0 && sourceWarnings.length === 0
			? "not_run"
			: sourceCandidates.length === 0 && hasFailedScrape
				? "failed"
			: sourceCandidates.length === 0 && hasEmptyScrape
				? "empty"
			: hasDegradation
				? "degraded"
				: "healthy";

		return {
			sourceUrl,
			status,
			candidates: sourceCandidates.length,
			imported,
			updated,
			skipped,
			failed,
			warnings: sourceWarnings.length,
			warningTypes,
			...(sourceWarnings[0]?.message ? { message: sourceWarnings[0].message } : {}),
		};
	});
}

function buildOpportunityFromDiscovery(
	candidate: DiscoveryCandidate,
	userId: string,
	input: DiscoveryImportInput
): OpportunityInput {
	const discoveryMethod = candidate.discoveryMethod ?? "searxng";
	const sourceOpportunity = candidate.opportunity;
	const normalizedUrl = discoveryMethod === "source_scrape" && sourceOpportunity
		? sourceOpportunityIdentity(sourceOpportunity, candidate.sourceUrl ?? candidate.result.url)
		: normalizeUrlForIdentity(candidate.result.url);
	const urlHash = sha256Hex(normalizedUrl);
	const markdownSummary = compactText(candidate.scrape?.markdown, 2200);
	const summary = compactText(
		sourceOpportunity?.projectSummary || candidate.scrape?.description || candidate.result.content || markdownSummary,
		2200
	);
	const host = resultHost(candidate.result.url);
	const documentLinks = collectCandidateDocumentLinks(candidate);
	const documentUrl = documentLinks[0]?.url
		?? sourceOpportunity?.documentUrl
		?? extractDocumentUrlFromMarkdown(candidate.scrape?.markdown, candidate.result.url);
	const source = sourceOpportunity?.source && SOURCE_SCRAPE_IMPORT_SOURCES.has(sourceOpportunity.source)
		? sourceOpportunity.source
		: discoveryMethod === "source_scrape" ? "source-scrape" : "searxng";

	return {
		sourceId: compactSourceId(sourceOpportunity?.sourceId || `searxng-${urlHash.slice(0, 42)}`),
		title: compactText(sourceOpportunity?.title || candidate.scrape?.title || candidate.result.title || candidate.result.url, 1000)!,
		category: input.category || sourceOpportunity?.category || candidate.result.category || "External discovery",
		countryRegion: input.countryRegion || sourceOpportunity?.countryRegion,
		organization: sourceOpportunity?.organization || host,
		deadline: sourceOpportunity?.deadline ?? undefined,
		publishedDate: sourceOpportunity?.publishedDate ?? undefined,
		projectSummary: summary,
		submissionMethod: compactText(sourceOpportunity?.submissionMethod, 200),
		rfpLink: sourceOpportunity?.rfpLink || sourceOpportunity?.portalUrl || candidate.result.url,
		sourcePlatform: sourcePlatformName(sourceOpportunity, discoveryMethod),
		sourceFile: discoveryMethod === "source_scrape" ? `source:${candidate.sourceUrl ?? candidate.query}` : slugForSourceFile(candidate.query),
		opportunityType: sourceOpportunityType(sourceOpportunity) || inferOpportunityType(candidate),
		source,
		fingerprint: urlHash,
		noticeId: compactIdentifier(sourceOpportunity?.noticeId, 100),
		portalUrl: sourceOpportunity?.portalUrl || candidate.result.url,
		documentUrl,
		scrapedAt: new Date(),
		priorityRank: 3,
		decisionStatus: "pending",
		assignedTo: userId,
		isReviewed: false,
		tags: sourceTags(sourceOpportunity, discoveryMethod),
		metadata: {
			...(sourceOpportunity?.metadata ?? {}),
			discovery: {
				engine: discoveryMethod,
				query: candidate.query,
				resultEngine: candidate.result.engine,
				score: candidate.result.score,
				url: normalizedUrl,
				sourceTotal: candidate.sourceTotal,
				scrapedWithFirecrawl: candidate.scrape?.success && candidate.scrape.method === "firecrawl",
				scrapedWithDirectHttp: candidate.scrape?.success && candidate.scrape.method === "direct_http",
				scrapedWithBrowserFallback: candidate.scrape?.success && candidate.scrape.method === "browser_fallback",
				scrapedWithBrowserSource: candidate.scrape?.success && candidate.scrape.method === "browser_source",
				scrapedWithCloakBrowserFallback: candidate.scrape?.success && candidate.scrape.method === "cloakbrowser_fallback",
				scrapeMethod: candidate.scrape?.method,
				browserFallbackReason: candidate.scrape?.fallbackReason,
				scrapeError: candidate.scrape?.error,
				documentUrl,
				documentLinks: documentLinks.map(({ url, label, source, score }) => ({
					url,
					...(label ? { label } : {}),
					source,
					score,
				})),
				sourceUrl: candidate.sourceUrl,
			},
		},
	};
}

async function findExistingDiscoveredOpportunity(opp: OpportunityInput, organizationId: string): Promise<string | null> {
	if (opp.fingerprint) {
		const [existing] = await db
			.select({ id: opportunities.id })
			.from(opportunities)
			.where(and(
				eq(opportunities.organizationId, organizationId),
				eq(opportunities.fingerprint, opp.fingerprint)
			)!)
			.limit(1);

		if (existing?.id) return existing.id;
	}

	if (opp.sourceId && opp.sourceFile) {
		const [existing] = await db
			.select({ id: opportunities.id })
			.from(opportunities)
			.where(
				and(
					eq(opportunities.organizationId, organizationId),
					eq(opportunities.sourceId, opp.sourceId),
					eq(opportunities.sourceFile, opp.sourceFile)
				)!
			)
			.limit(1);

		if (existing?.id) return existing.id;
	}

	if (opp.source && opp.sourceId) {
		const [existing] = await db
			.select({ id: opportunities.id })
			.from(opportunities)
			.where(
				and(
					eq(opportunities.organizationId, organizationId),
					eq(opportunities.source, opp.source),
					eq(opportunities.sourceId, opp.sourceId)
				)!
			)
			.limit(1);

		return existing?.id || null;
	}

	return null;
}

async function actionOverrideForDiscoveryActor(
	userId: string,
	organizationId: string
): Promise<OpportunityActionOverride | undefined> {
	let userContext: Awaited<ReturnType<typeof getUserContext>> = null;
	try {
		userContext = await getUserContext();
	} catch {
		return { actorId: userId, organizationId };
	}
	if (userContext?.userId === userId && userContext.organizationId === organizationId) {
		return undefined;
	}
	return { actorId: userId, organizationId };
}

async function scrapeDiscoveryCandidates(
	candidates: DiscoveryCandidate[],
	scrapeLimit: number,
	input: DiscoveryImportInput
): Promise<void> {
	if (scrapeLimit <= 0) return;

	const firecrawl = new FirecrawlClient({ timeout: 15000 });
	const browserFallbackLimit = Math.min(input.browserFallbackLimit ?? scrapeLimit, scrapeLimit);
	let browserFallbackAttempts = 0;

	for (const candidate of candidates.slice(0, scrapeLimit)) {
		const scrapeResult = await firecrawl.scrape(candidate.result.url, {
			formats: ["markdown", "links"],
			timeout: 15000,
		});

		candidate.scrape = {
			success: scrapeResult.success,
			title: scrapeResult.data?.metadata?.title,
			description: scrapeResult.data?.metadata?.description,
			markdown: scrapeResult.data?.markdown,
			links: scrapeResult.data?.links,
			error: scrapeResult.error,
			method: "firecrawl",
		};

		const fallbackReason = browserFallbackReason(candidate.scrape);
		if ((input.browserFallback ?? true) && fallbackReason && browserFallbackAttempts < browserFallbackLimit) {
			browserFallbackAttempts++;
			const browserResult = await scrapeWithBrowserFallback(candidate.result.url, fallbackReason);
			if (isUsefulBrowserFallback(browserResult)) {
				candidate.scrape = browserResult;
			} else if (browserResult.error) {
				candidate.scrape.error = `${candidate.scrape.error || fallbackReason}; browser fallback: ${browserResult.error}`;
				candidate.scrape.fallbackReason = fallbackReason;
			}
		}
	}
}

async function discoverConfiguredSourceCandidates(
	sourceUrls: string[],
	limitPerSource: number,
	seenUrls: Set<string>,
	warnings: DiscoveryRunWarning[],
	input: DiscoveryImportInput
): Promise<DiscoveryCandidate[]> {
	if (!sourceUrls.length || limitPerSource <= 0) return [];

	const firecrawl = new FirecrawlClient({ timeout: 20000 });
	const candidates: DiscoveryCandidate[] = [];

	for (const sourceUrl of sourceUrls) {
		try {
			candidates.push(...await withConfiguredSourceTimeout(
				sourceUrl,
				() => discoverConfiguredSourceCandidatesForUrl(
					firecrawl,
					sourceUrl,
					limitPerSource,
					seenUrls,
					warnings,
					input
				)
			));
		} catch (error) {
			warnings.push({
				type: "source_scrape_failed",
				query: sourceQuery(sourceUrl),
				title: "Configured source scrape failed",
				url: sourceUrl,
				message: error instanceof Error ? error.message : String(error),
			});
			continue;
		}
	}

	return candidates;
}

async function discoverConfiguredSourceCandidatesForUrl(
	firecrawl: FirecrawlClient,
	sourceUrl: string,
	limitPerSource: number,
	seenUrls: Set<string>,
	warnings: DiscoveryRunWarning[],
	input: DiscoveryImportInput
): Promise<DiscoveryCandidate[]> {
	const candidates: DiscoveryCandidate[] = [];
	if (isKenyaPpipUrl(sourceUrl)) {
		const ppipResult = await discoverKenyaPpipCandidates(sourceUrl, limitPerSource, seenUrls, warnings);
		candidates.push(...ppipResult.candidates);
		if (ppipResult.handled) return candidates;
	}
	if (isUngmUrl(sourceUrl)) {
		const ungmResult = await discoverUngmCandidates(sourceUrl, limitPerSource, seenUrls, warnings);
		candidates.push(...ungmResult.candidates);
		if (ungmResult.handled) return candidates;
	}

	const sourceResult = await scrapeAndParseConfiguredSource(firecrawl, sourceUrl, limitPerSource, {
		browserFallback: input.browserFallback ?? true,
	});
	if (!sourceResult.scrapeResult.success || !sourceResult.scrapeResult.data) {
		if (isAfdbSourceUrl(sourceUrl)) {
			const fallbackResult = await discoverAfdbSearchFallbackCandidates(sourceUrl, limitPerSource, seenUrls, warnings);
			if (fallbackResult.handled) return fallbackResult.candidates;
		}
		warnings.push({
			type: sourceResult.method === "browser_fallback"
				? "browser_fallback_failed"
				: sourceResult.method === "cloakbrowser_fallback"
					? "cloakbrowser_fallback_failed"
					: "source_scrape_failed",
			query: `source:${sourceUrl}`,
			title: "Configured source scrape failed",
			url: sourceUrl,
			message: sourceResult.scrapeResult.error ?? "Firecrawl returned no source content",
		});
		return candidates;
	}

	const { parser, parseResult, scrapeResult } = sourceResult;
	if (!parseResult.opportunities.length) {
		if (isAfdbSourceUrl(sourceUrl)) {
			const fallbackResult = await discoverAfdbSearchFallbackCandidates(sourceUrl, limitPerSource, seenUrls, warnings);
			if (fallbackResult.handled) return fallbackResult.candidates;
		}
		warnings.push({
			type: "source_scrape_empty",
			query: `source:${sourceUrl}`,
			title: "Configured source scrape found no opportunities",
			url: sourceUrl,
			message: sourceResult.lastEmptyMessage
				?? `${configuredSourceMethodLabel(sourceResult.method)} returned content after ${sourceResult.attempts} attempt(s), but the ${parser.name} parser found no tender-like records.`,
		});
		return candidates;
	}

	const opportunities = parser.sourceId === "undp"
		? await enrichUndpOpportunitiesWithDetails(
			parseResult.opportunities.slice(0, limitPerSource),
			firecrawl,
			Math.min(DEFAULT_UNDP_DETAIL_LIMIT, limitPerSource)
		)
		: parser.sourceId === "afdb"
			? await enrichAfdbOpportunitiesWithDetails(
				parseResult.opportunities.slice(0, limitPerSource),
				firecrawl,
				Math.min(DEFAULT_AFDB_DETAIL_LIMIT, limitPerSource)
			)
		: parser.sourceId === "world_bank"
			? await enrichWorldBankOpportunitiesWithDetails(
				parseResult.opportunities.slice(0, limitPerSource),
				firecrawl,
				Math.min(DEFAULT_WORLD_BANK_DETAIL_LIMIT, limitPerSource)
			)
		: parser.sourceId === "comesa"
			? await enrichComesaOpportunitiesWithDetails(
				parseResult.opportunities.slice(0, limitPerSource),
				firecrawl,
				Math.min(DEFAULT_COMESA_DETAIL_LIMIT, limitPerSource)
			)
		: parseResult.opportunities.slice(0, limitPerSource);

	for (const opportunity of opportunities) {
		const url = opportunity.portalUrl ?? sourceUrl;
		const identity = sourceOpportunityIdentity(opportunity, sourceUrl);
		if (seenUrls.has(identity)) continue;
		seenUrls.add(identity);

		candidates.push({
			query: `source:${sourceUrl}`,
			discoveryMethod: "source_scrape",
			sourceUrl,
			opportunity,
			result: {
				title: opportunity.title,
				url,
				content: opportunity.projectSummary ?? "",
				engine: "firecrawl-source",
				score: 1,
				category: opportunity.countryRegion ?? "Configured source",
			},
			scrape: {
				success: true,
				title: opportunity.title,
				description: opportunity.projectSummary,
				markdown: scrapeResult.data?.markdown,
				links: scrapeResult.data?.links,
				method: sourceResult.method,
				fallbackReason: sourceResult.fallbackReason,
			},
		});
	}
	return candidates;
}

async function withConfiguredSourceTimeout<T>(
	sourceUrl: string,
	operation: () => Promise<T>
): Promise<T> {
	const timeoutMs = configuredSourceDiscoveryTimeoutMs();
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			operation(),
			new Promise<T>((_, reject) => {
				timeout = setTimeout(() => {
					reject(new Error(`Configured source discovery timed out after ${timeoutMs}ms for ${sourceUrl}`));
				}, timeoutMs);
			}),
		]);
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}

function configuredSourceDiscoveryTimeoutMs(): number {
	const parsed = Number(process.env.CONFIGURED_SOURCE_DISCOVERY_TIMEOUT_MS ?? DEFAULT_CONFIGURED_SOURCE_DISCOVERY_TIMEOUT_MS);
	if (!Number.isFinite(parsed)) return DEFAULT_CONFIGURED_SOURCE_DISCOVERY_TIMEOUT_MS;
	return Math.min(300_000, Math.max(5, Math.trunc(parsed)));
}

function configuredSourceMethodLabel(method: ConfiguredSourceParseResult["method"]): string {
	switch (method) {
		case "browser_fallback":
			return "Browser fallback";
		case "browser_source":
			return "Browser source";
		case "cloakbrowser_fallback":
			return "CloakBrowser fallback";
		case "source_api":
			return "Source API";
		case "firecrawl":
			return "Firecrawl";
		case "direct_http":
			return "Direct HTTP";
	}
}

async function scrapeAndParseConfiguredSource(
	firecrawl: FirecrawlClient,
	sourceUrl: string,
	limitPerSource: number,
	options: { browserFallback: boolean }
): Promise<ConfiguredSourceParseResult> {
	const parser = parserForSourceUrl(sourceUrl);
	if (isSourceApiParser(parser)) {
		const parseResult = await parser.parse({ url: sourceUrl });
		return {
			parser,
			parseResult,
			scrapeResult: parseResult.opportunities.length > 0
				? {
					success: true,
					data: {
						markdown: "",
						links: [],
						metadata: {
							title: parser.name,
							description: `${parser.name} parsed from its public source API.`,
						},
					},
				}
				: {
					success: false,
					error: parseResult.error ?? `${parser.name} source API returned no opportunities`,
				},
			attempts: 1,
			method: "source_api",
			lastEmptyMessage: parseResult.error ?? `${parser.name} source API returned no opportunities.`,
		};
	}
	if (parser.requiresJavascript && options.browserFallback) {
		return {
			parser,
			...await parseConfiguredSourceWithBrowserSource(parser, sourceUrl),
		};
	}
	const maxAttempts = configuredSourceScrapeAttempts();
	let lastScrapeResult: FirecrawlScrapeResult | undefined;
	let lastParseResult: ParseResult = { opportunities: [] };
	let lastEmptyMessage: string | undefined;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const scrapeResult = await firecrawl.scrape(sourceUrl, {
			formats: ["markdown", "html", "links"],
			timeout: 20000,
		});
		lastScrapeResult = scrapeResult;
		if (!scrapeResult.success || !scrapeResult.data) {
			if (attempt < maxAttempts) continue;
			const directHttpResult = await maybeParseConfiguredSourceWithDirectHttp(parser, sourceUrl, limitPerSource);
			if (directHttpResult.parseResult.opportunities.length > 0) {
				return {
					parser,
					...directHttpResult,
				};
			}
			if (options.browserFallback) {
				return {
					parser,
					...await maybeParseConfiguredSourceWithBrowserFallback(
						parser,
						sourceUrl,
						scrapeResult,
						lastParseResult,
						attempt,
						lastEmptyMessage
					),
				};
			}
			return {
				parser,
				parseResult: lastParseResult,
				scrapeResult,
				attempts: attempt,
				method: "firecrawl",
				lastEmptyMessage: directHttpResult.lastEmptyMessage,
			};
		}

		lastParseResult = await parser.parse({
			html: scrapeResult.data.html,
			markdown: scrapeResult.data.markdown ?? "",
			links: scrapeResult.data.links ?? [],
			url: sourceUrl,
		});
		if (lastParseResult.opportunities.length > 0) {
			const paginatedParseResult = await scrapeAdditionalConfiguredSourcePages(
				firecrawl,
				parser,
				sourceUrl,
				{
					html: scrapeResult.data.html,
					markdown: scrapeResult.data.markdown ?? "",
					links: scrapeResult.data.links ?? [],
					url: sourceUrl,
				},
				lastParseResult,
				limitPerSource
			);
			const enrichedParseResult = await enrichConfiguredSourceOpportunityDetailsWithFirecrawl(
				firecrawl,
				parser,
				sourceUrl,
				paginatedParseResult,
				limitPerSource
			);
			return {
				parser,
				parseResult: enrichedParseResult,
				scrapeResult,
				attempts: attempt,
				method: "firecrawl",
			};
		}

		lastEmptyMessage = `Firecrawl returned content but ${parser.name} found no opportunities on attempt ${attempt} of ${maxAttempts}.`;
	}

	const scrapeResult = lastScrapeResult ?? {
		success: false,
		error: "Configured source scrape did not run",
	};
	const directHttpResult = await maybeParseConfiguredSourceWithDirectHttp(parser, sourceUrl, limitPerSource);
	if (directHttpResult.parseResult.opportunities.length > 0) {
		return {
			parser,
			...directHttpResult,
		};
	}
	if (directHttpResult.lastEmptyMessage) {
		lastEmptyMessage = directHttpResult.lastEmptyMessage;
	}
	if (!options.browserFallback) {
		return {
			parser,
			parseResult: lastParseResult,
			scrapeResult,
			attempts: maxAttempts,
			method: "firecrawl",
			lastEmptyMessage,
		};
	}

	return {
		parser,
		...await maybeParseConfiguredSourceWithBrowserFallback(
			parser,
			sourceUrl,
			scrapeResult,
			lastParseResult,
			maxAttempts,
			lastEmptyMessage
		),
	};
}

async function maybeParseConfiguredSourceWithDirectHttp(
	parser: TenderParser,
	sourceUrl: string,
	limitPerSource: number
): Promise<Omit<ConfiguredSourceParseResult, "parser">> {
	try {
		const response = await fetchPublicHttpUrl(sourceUrl, {
			timeoutMs: 20000,
			maxRedirects: 3,
			headers: {
				"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"Accept-Language": "en-US,en;q=0.9",
				"User-Agent": "Mozilla/5.0 (compatible; LindelaOpportunityDiscovery/1.0; +https://lindela.io)",
			},
		}, "Configured source direct fetch");
		if (!response.ok) {
			return {
				parseResult: { opportunities: [] },
				scrapeResult: {
					success: false,
					error: `Direct HTTP returned ${response.status} ${response.statusText}`,
				},
				attempts: 1,
				method: "direct_http",
				lastEmptyMessage: `Direct HTTP returned ${response.status} ${response.statusText}`,
			};
		}

		const html = await response.text();
		if (isBotProtectionContent({
			title: response.headers.get("title") ?? undefined,
			markdown: html,
		})) {
			return {
				parseResult: { opportunities: [] },
				scrapeResult: {
					success: false,
					error: "Direct HTTP returned bot-protection content",
				},
				attempts: 1,
				method: "direct_http",
				fallbackReason: "Direct HTTP returned bot-protection content",
				lastEmptyMessage: "Direct HTTP returned bot-protection content",
			};
		}
		const input = { html, markdown: html, links: extractHtmlLinks(html, sourceUrl), url: sourceUrl };
		const parseResult = await parser.parse(input);
		const paginatedParseResult = parseResult.opportunities.length > 0
			? await fetchAdditionalConfiguredSourcePagesWithDirectHttp(parser, sourceUrl, input, parseResult, limitPerSource)
			: parseResult;
		return {
			parseResult: paginatedParseResult,
			scrapeResult: {
				success: true,
				data: {
					html,
					markdown: html,
					links: input.links,
					metadata: {
						title: parser.name,
						description: `${parser.name} parsed through direct HTTP fallback.`,
						statusCode: response.status,
					},
				},
			},
			attempts: 1,
			method: "direct_http",
			lastEmptyMessage: paginatedParseResult.opportunities.length > 0
				? undefined
				: `Direct HTTP returned content but ${parser.name} found no tender-like records.`,
		};
	} catch (error) {
		return {
			parseResult: { opportunities: [] },
			scrapeResult: {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			},
			attempts: 1,
			method: "direct_http",
			lastEmptyMessage: error instanceof Error ? error.message : String(error),
		};
	}
}

async function fetchAdditionalConfiguredSourcePagesWithDirectHttp(
	parser: TenderParser,
	sourceUrl: string,
	firstPageInput: Parameters<TenderParser["parse"]>[0],
	firstPageResult: ParseResult,
	limitPerSource: number
): Promise<ParseResult> {
	if (firstPageResult.opportunities.length >= limitPerSource) return firstPageResult;

	let currentUrl = sourceUrl;
	let currentInput = firstPageInput;
	let currentResult = firstPageResult;
	const opportunities = [...firstPageResult.opportunities];
	const maxPages = configuredSourceMaxPages();

	for (let page = 1; page < maxPages && opportunities.length < limitPerSource; page += 1) {
		const nextPageUrl = nextConfiguredSourcePageUrl(parser, currentUrl, page, currentInput, currentResult);
		if (!nextPageUrl || nextPageUrl === currentUrl) break;

		const response = await fetchPublicHttpUrl(nextPageUrl, {
			timeoutMs: 20000,
			maxRedirects: 3,
			headers: {
				"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"Accept-Language": "en-US,en;q=0.9",
				"User-Agent": "Mozilla/5.0 (compatible; LindelaOpportunityDiscovery/1.0; +https://lindela.io)",
			},
		}, "Configured source direct page fetch");
		if (!response.ok) break;

		const html = await response.text();
		currentUrl = nextPageUrl;
		currentInput = { html, markdown: html, links: extractHtmlLinks(html, nextPageUrl), url: nextPageUrl };
		currentResult = await parser.parse(currentInput);
		if (currentResult.opportunities.length === 0) break;
		opportunities.push(...currentResult.opportunities);
	}

	return {
		...firstPageResult,
		opportunities,
		nextPageUrl: opportunities.length >= limitPerSource ? currentResult.nextPageUrl : undefined,
	};
}

async function scrapeAdditionalConfiguredSourcePages(
	firecrawl: FirecrawlClient,
	parser: TenderParser,
	sourceUrl: string,
	firstPageInput: Parameters<TenderParser["parse"]>[0],
	firstPageResult: ParseResult,
	limitPerSource: number
): Promise<ParseResult> {
	const maxPages = configuredSourceMaxPages();
	if (maxPages <= 1 || firstPageResult.opportunities.length >= limitPerSource) {
		return firstPageResult;
	}

	const opportunities = [...firstPageResult.opportunities];
	const seen = new Set(opportunities.map((opportunity) => sourceOpportunityIdentity(opportunity, sourceUrl)));
	let currentInput = firstPageInput;
	let currentResult = firstPageResult;
	let currentUrl = sourceUrl;

	for (let page = 1; page < maxPages && opportunities.length < limitPerSource; page++) {
		const nextPageUrl = nextConfiguredSourcePageUrl(parser, currentUrl, page, currentInput, currentResult);
		if (!nextPageUrl || nextPageUrl === currentUrl) break;

		const scrapeResult = await firecrawl.scrape(nextPageUrl, {
			formats: ["markdown", "html", "links"],
			timeout: 20000,
		});
		if (!scrapeResult.success || !scrapeResult.data) break;

		currentInput = {
			html: scrapeResult.data.html,
			markdown: scrapeResult.data.markdown ?? "",
			links: scrapeResult.data.links ?? [],
			url: nextPageUrl,
		};
		currentResult = await parser.parse(currentInput);
		for (const opportunity of currentResult.opportunities) {
			const identity = sourceOpportunityIdentity(opportunity, sourceUrl);
			if (seen.has(identity)) continue;
			seen.add(identity);
			opportunities.push(opportunity);
			if (opportunities.length >= limitPerSource) break;
		}
		currentUrl = nextPageUrl;
	}

	return {
		...firstPageResult,
		opportunities,
		nextPageUrl: opportunities.length >= limitPerSource ? currentResult.nextPageUrl : undefined,
	};
}

function shouldEnrichConfiguredSourceDetails(parser: TenderParser): boolean {
	return parser.sourceId === "africa_cdc";
}

function mergeConfiguredSourceDetailOpportunity(listing: OpportunityData, detail: OpportunityData): OpportunityData {
	return {
		...listing,
		...detail,
		title: detail.title || listing.title,
		organization: detail.organization ?? listing.organization,
		deadline: detail.deadline ?? listing.deadline,
		source: detail.source || listing.source,
		sourceId: detail.sourceId ?? listing.sourceId,
		noticeId: detail.noticeId ?? listing.noticeId,
		portalUrl: detail.portalUrl ?? listing.portalUrl,
		documentUrl: detail.documentUrl ?? listing.documentUrl,
		category: detail.category ?? listing.category,
		countryRegion: detail.countryRegion ?? listing.countryRegion,
		projectSummary: detail.projectSummary ?? listing.projectSummary,
		submissionMethod: detail.submissionMethod ?? listing.submissionMethod,
		rfpLink: detail.rfpLink ?? listing.rfpLink,
		opportunityType: detail.opportunityType ?? listing.opportunityType,
		publishedDate: detail.publishedDate ?? listing.publishedDate,
		tags: [...new Set([...(listing.tags ?? []), ...(detail.tags ?? [])])],
		metadata: {
			...(listing.metadata ?? {}),
			...(detail.metadata ?? {}),
		},
	};
}

async function enrichConfiguredSourceOpportunityDetailsWithFirecrawl(
	firecrawl: FirecrawlClient,
	parser: TenderParser,
	sourceUrl: string,
	parseResult: ParseResult,
	limitPerSource: number
): Promise<ParseResult> {
	if (!shouldEnrichConfiguredSourceDetails(parser)) return parseResult;

	const detailLimit = Math.min(configuredSourceDetailLimit(), limitPerSource, parseResult.opportunities.length);
	if (detailLimit <= 0) return parseResult;

	const sourceIdentity = normalizeUrlForIdentity(sourceUrl);
	const enriched = [...parseResult.opportunities];
	const seenDetailUrls = new Set<string>();
	for (let index = 0; index < detailLimit; index += 1) {
		const opportunity = enriched[index];
		if (!opportunity) continue;
		const detailUrl = opportunity.portalUrl;
		if (!detailUrl || normalizeUrlForIdentity(detailUrl) === sourceIdentity || seenDetailUrls.has(detailUrl)) continue;
		seenDetailUrls.add(detailUrl);

		try {
			const scrapeResult = await firecrawl.scrape(detailUrl, {
				formats: ["markdown", "html", "links"],
				timeout: 20000,
			});
			if (!scrapeResult.success || !scrapeResult.data) continue;
			const detailResult = await parser.parse({
				html: scrapeResult.data.html,
				markdown: scrapeResult.data.markdown ?? "",
				links: scrapeResult.data.links ?? [],
				url: detailUrl,
			});
			const detail = detailResult.opportunities[0];
			if (!detail) continue;
			enriched[index] = mergeConfiguredSourceDetailOpportunity(opportunity, detail);
		} catch {
			continue;
		}
	}

	return {
		...parseResult,
		opportunities: enriched,
	};
}

function extractHtmlLinks(html: string, sourceUrl: string): string[] {
	const links: string[] = [];
	for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
		try {
			const url = new URL(match[1] ?? "", sourceUrl);
			if (url.protocol !== "http:" && url.protocol !== "https:") continue;
			url.hash = "";
			links.push(url.toString());
		} catch {
			continue;
		}
	}
	return [...new Set(links)];
}

function nextConfiguredSourcePageUrl(
	parser: TenderParser,
	currentUrl: string,
	currentPage: number,
	currentInput: Parameters<TenderParser["parse"]>[0],
	currentResult: ParseResult
): string | undefined {
	const candidate = currentResult.nextPageUrl
		?? (parser.hasNextPage(currentInput, currentPage) ? parser.getPageUrl(currentUrl, currentPage + 1) : undefined);
	if (!candidate) return undefined;

	try {
		const parsed = new URL(candidate, currentUrl);
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return undefined;
	}
}

async function parseConfiguredSourceWithBrowserSource(
	parser: TenderParser,
	sourceUrl: string
): Promise<Omit<ConfiguredSourceParseResult, "parser">> {
	const browserResult = await scrapeWithBrowserSource(sourceUrl);
	if (!isUsefulBrowserFallback(browserResult)) {
		return {
			parseResult: { opportunities: [] },
			scrapeResult: {
				success: false,
				error: browserResult.error ?? "Browser source scrape returned no usable content",
			},
			attempts: 1,
			method: "browser_source",
			lastEmptyMessage: browserResult.error ?? "Browser source scrape returned no usable content",
		};
	}

	const parseResult = await parser.parse({
		markdown: browserResult.markdown ?? "",
		links: browserResult.links ?? [],
		url: sourceUrl,
	});
	return {
		parseResult,
		scrapeResult: {
			success: true,
			data: {
				markdown: browserResult.markdown,
				links: browserResult.links,
				metadata: {
					title: browserResult.title,
					description: browserResult.description,
				},
			},
		},
		attempts: 1,
		method: "browser_source",
		lastEmptyMessage: parseResult.opportunities.length > 0
			? undefined
			: `Browser source scrape returned content but ${parser.name} found no tender-like records.`,
	};
}

async function maybeParseConfiguredSourceWithBrowserFallback(
	parser: TenderParser,
	sourceUrl: string,
	firecrawlResult: FirecrawlScrapeResult,
	lastParseResult: ParseResult,
	attempts: number,
	lastEmptyMessage?: string
): Promise<Omit<ConfiguredSourceParseResult, "parser">> {
	const fallbackReason = lastEmptyMessage
		?? browserFallbackReason({
			success: firecrawlResult.success,
			title: firecrawlResult.data?.metadata?.title,
			description: firecrawlResult.data?.metadata?.description,
			markdown: firecrawlResult.data?.markdown,
			error: firecrawlResult.error,
			method: "firecrawl",
		})
		?? "Configured source parser found no tender-like records";
	const browserResult = await scrapeWithBrowserFallback(sourceUrl, fallbackReason);
	if (!isUsefulBrowserFallback(browserResult)) {
		const cloakResult = await maybeParseConfiguredSourceWithCloakBrowserFallback(
			parser,
			sourceUrl,
			firecrawlResult,
			lastParseResult,
			attempts,
			fallbackReason,
			[
				firecrawlResult.error,
				lastEmptyMessage,
				browserResult.error ? `browser fallback: ${browserResult.error}` : undefined,
			].filter(Boolean).join("; ")
		);
		if (cloakResult) return cloakResult;

		return {
			parseResult: lastParseResult,
			scrapeResult: {
				...firecrawlResult,
				error: [
					firecrawlResult.error,
					lastEmptyMessage,
					browserResult.error ? `browser fallback: ${browserResult.error}` : undefined,
				].filter(Boolean).join("; ") || "Configured source scrape failed",
			},
			attempts,
			method: "browser_fallback",
			fallbackReason,
			lastEmptyMessage,
		};
	}

	const parseResult = await parser.parse({
		markdown: browserResult.markdown ?? "",
		links: browserResult.links ?? [],
		url: sourceUrl,
	});
	const browserEmptyMessage = parseResult.opportunities.length > 0
		? undefined
		: `Browser fallback returned content but ${parser.name} found no tender-like records.`;
	if (browserEmptyMessage) {
		const cloakResult = await maybeParseConfiguredSourceWithCloakBrowserFallback(
			parser,
			sourceUrl,
			firecrawlResult,
			parseResult,
			attempts,
			browserEmptyMessage,
			browserEmptyMessage
		);
		if (cloakResult) return cloakResult;
	}
	return {
		parseResult,
		scrapeResult: {
			success: true,
			data: {
				markdown: browserResult.markdown,
				links: browserResult.links,
				metadata: {
					title: browserResult.title,
					description: browserResult.description,
				},
			},
		},
		attempts,
		method: "browser_fallback",
		fallbackReason,
		lastEmptyMessage: browserEmptyMessage,
	};
}

async function maybeParseConfiguredSourceWithCloakBrowserFallback(
	parser: TenderParser,
	sourceUrl: string,
	previousScrapeResult: FirecrawlScrapeResult,
	previousParseResult: ParseResult,
	attempts: number,
	fallbackReason: string,
	previousFailureMessage?: string
): Promise<Omit<ConfiguredSourceParseResult, "parser"> | null> {
	if (!getCloakBrowserEndpoint()) return null;

	const cloakResult = await scrapeWithCloakBrowser(sourceUrl, {
		timeout: 60000,
		humanScroll: true,
		blockMedia: true,
	});
	const cloakScrape: NonNullable<DiscoveryCandidate["scrape"]> = {
		success: cloakResult.success,
		title: cloakResult.data?.metadata?.title,
		markdown: cloakResult.data?.markdown,
		links: cloakResult.data?.links,
		error: cloakResult.error,
		method: "cloakbrowser_fallback",
		fallbackReason,
	};
	if (!isUsefulBrowserFallback(cloakScrape)) {
		return {
			parseResult: previousParseResult,
			scrapeResult: {
				...previousScrapeResult,
				error: [
					previousScrapeResult.error,
					previousFailureMessage,
					cloakResult.error ? `CloakBrowser fallback: ${cloakResult.error}` : undefined,
				].filter(Boolean).join("; ") || "Configured source scrape failed",
			},
			attempts,
			method: "cloakbrowser_fallback",
			fallbackReason,
			lastEmptyMessage: previousFailureMessage,
		};
	}

	const parseResult = await parser.parse({
		html: cloakResult.data?.html,
		markdown: cloakResult.data?.markdown ?? "",
		links: cloakResult.data?.links ?? [],
		url: sourceUrl,
	});
	return {
		parseResult,
		scrapeResult: {
			success: true,
			data: {
				html: cloakResult.data?.html,
				markdown: cloakResult.data?.markdown,
				links: cloakResult.data?.links,
				metadata: {
					title: cloakResult.data?.metadata?.title,
					description: previousFailureMessage,
					statusCode: cloakResult.data?.metadata?.statusCode,
				},
			},
		},
		attempts,
		method: "cloakbrowser_fallback",
		fallbackReason,
		lastEmptyMessage: parseResult.opportunities.length > 0
			? undefined
			: `CloakBrowser fallback returned content but ${parser.name} found no tender-like records.`,
	};
}

function metadataRecord(value: OpportunityData["metadata"]): Record<string, unknown> {
	return value ?? {};
}

async function enrichAfdbOpportunitiesWithDetails(
	opportunities: OpportunityData[],
	firecrawl: FirecrawlClient,
	detailLimit: number
): Promise<OpportunityData[]> {
	if (detailLimit <= 0) return opportunities;
	const enriched = [...opportunities];
	for (let index = 0; index < Math.min(detailLimit, enriched.length); index++) {
		const opportunity = enriched[index];
		if (!opportunity.portalUrl) continue;
		try {
			const detailResult = await firecrawl.scrape(opportunity.portalUrl, {
				formats: ["markdown", "links"],
				timeout: 20000,
			});
			if (!detailResult.success || !detailResult.data) continue;
			const detail = parseAfdbNoticeDetailMarkdown(
				detailResult.data.markdown,
				detailResult.data.links ?? [],
				opportunity.portalUrl
			);
			if (!detail.primaryLink) continue;
			const afdbMetadata = metadataRecord(metadataRecord(opportunity.metadata).afdb as Record<string, unknown> | undefined);
			enriched[index] = {
				...opportunity,
				documentUrl: detail.primaryLink.url,
				rfpLink: detail.primaryLink.url,
				submissionMethod: detail.primaryLink.description ?? opportunity.submissionMethod,
				metadata: {
					...metadataRecord(opportunity.metadata),
					afdb: {
						...afdbMetadata,
						links: detail.links,
						primaryLink: detail.primaryLink,
					},
				},
			};
		} catch {
			// Detail enrichment is opportunistic; the listing row remains usable.
		}
	}
	return enriched;
}

async function enrichComesaOpportunitiesWithDetails(
	opportunities: OpportunityData[],
	firecrawl: FirecrawlClient,
	detailLimit: number
): Promise<OpportunityData[]> {
	if (detailLimit <= 0) return opportunities;
	const enriched = [...opportunities];
	for (let index = 0; index < Math.min(detailLimit, enriched.length); index++) {
		const opportunity = enriched[index];
		if (!opportunity.portalUrl) continue;
		try {
			const detailResult = await firecrawl.scrape(opportunity.portalUrl, {
				formats: ["markdown", "links"],
				timeout: 20000,
			});
			if (!detailResult.success || !detailResult.data) continue;
			const detail = parseComesaTenderDetailMarkdown(
				detailResult.data.markdown,
				detailResult.data.links ?? [],
				opportunity.portalUrl
			);
			if (!detail.primaryLink) continue;
			const comesaMetadata = metadataRecord(metadataRecord(opportunity.metadata).comesa as Record<string, unknown> | undefined);
			enriched[index] = {
				...opportunity,
				documentUrl: detail.primaryLink.url,
				rfpLink: detail.primaryLink.url,
				submissionMethod: detail.primaryLink.description ?? opportunity.submissionMethod,
				metadata: {
					...metadataRecord(opportunity.metadata),
					comesa: {
						...comesaMetadata,
						links: detail.links,
						primaryLink: detail.primaryLink,
					},
				},
			};
		} catch {
			// Detail enrichment is opportunistic; the listing row remains usable.
		}
	}
	return enriched;
}

async function enrichUndpOpportunitiesWithDetails(
	opportunities: OpportunityData[],
	firecrawl: FirecrawlClient,
	detailLimit: number
): Promise<OpportunityData[]> {
	if (detailLimit <= 0) return opportunities;
	const enriched = [...opportunities];
	for (let index = 0; index < Math.min(detailLimit, enriched.length); index++) {
		const opportunity = enriched[index];
		if (!opportunity.portalUrl) continue;
		try {
			const detailResult = await firecrawl.scrape(opportunity.portalUrl, {
				formats: ["markdown", "links"],
				timeout: 20000,
			});
			if (!detailResult.success || !detailResult.data) continue;
			const detail = parseUndpNoticeDetailMarkdown(
				detailResult.data.markdown,
				detailResult.data.links ?? []
			);
			if (!detail.primaryLink) continue;
			const undpMetadata = metadataRecord(metadataRecord(opportunity.metadata).undp as Record<string, unknown> | undefined);
			enriched[index] = {
				...opportunity,
				documentUrl: detail.primaryLink.url,
				rfpLink: detail.primaryLink.url,
				submissionMethod: detail.primaryLink.description ?? opportunity.submissionMethod,
				metadata: {
					...metadataRecord(opportunity.metadata),
					undp: {
						...undpMetadata,
						...(detail.contactEmail ? { contactEmail: detail.contactEmail } : {}),
						links: detail.links,
						primaryLink: detail.primaryLink,
					},
				},
			};
		} catch {
			// Detail enrichment is opportunistic; the listing row remains usable.
		}
	}
	return enriched;
}

async function enrichWorldBankOpportunitiesWithDetails(
	opportunities: OpportunityData[],
	firecrawl: FirecrawlClient,
	detailLimit: number
): Promise<OpportunityData[]> {
	if (detailLimit <= 0) return opportunities;
	const enriched = [...opportunities];
	for (let index = 0; index < Math.min(detailLimit, enriched.length); index++) {
		const opportunity = enriched[index];
		if (!opportunity.portalUrl) continue;
		try {
			const detail = await resolveWorldBankNoticeDetail(opportunity, firecrawl);
			if (!isUsefulWorldBankDetail(detail)) continue;
			const worldBankMetadata = metadataRecord(metadataRecord(opportunity.metadata).worldBank as Record<string, unknown> | undefined);
			enriched[index] = {
				...opportunity,
				organization: detail.organization ?? opportunity.organization,
				deadline: detail.submissionDeadline ?? opportunity.deadline,
				publishedDate: detail.publishedDate ?? opportunity.publishedDate,
				projectSummary: detail.details ?? opportunity.projectSummary,
				submissionMethod: detail.procurementMethod ?? opportunity.submissionMethod,
				metadata: {
					...metadataRecord(opportunity.metadata),
					worldBank: {
						...worldBankMetadata,
						...(detail.projectId ? { projectId: detail.projectId } : {}),
						...(detail.projectTitle ? { projectTitle: detail.projectTitle } : {}),
						...(detail.noticeNo ? { noticeNo: detail.noticeNo } : {}),
						...(detail.noticeType ? { noticeType: detail.noticeType } : {}),
						...(detail.borrowerBidReference ? { borrowerBidReference: detail.borrowerBidReference } : {}),
						...(detail.procurementMethod ? { procurementMethod: detail.procurementMethod } : {}),
						...(detail.language ? { language: detail.language } : {}),
						...(detail.contactEmail ? { contactEmail: detail.contactEmail } : {}),
					},
				},
			};
		} catch {
			// Detail enrichment is opportunistic; the listing row remains usable.
		}
	}
	return enriched;
}

async function resolveWorldBankNoticeDetail(
	opportunity: OpportunityData,
	firecrawl: FirecrawlClient
): Promise<WorldBankNoticeDetail> {
	const noticeId = opportunity.noticeId ?? opportunity.sourceId ?? worldBankNoticeIdFromUrl(opportunity.portalUrl);
	if (noticeId) {
		try {
			const detail = await fetchWorldBankNoticeDetail(noticeId);
			if (isUsefulWorldBankDetail(detail)) return detail;
		} catch {
			// Fall back to the rendered detail page when the public API is unavailable.
		}
	}

	if (!opportunity.portalUrl) return {};
	const detailResult = await firecrawl.scrape(opportunity.portalUrl, {
		formats: ["markdown", "links"],
		timeout: 20000,
	});
	if (!detailResult.success || !detailResult.data?.markdown) return {};
	return parseWorldBankNoticeDetailMarkdown(detailResult.data.markdown);
}

function isUsefulWorldBankDetail(detail: WorldBankNoticeDetail): boolean {
	return Boolean(detail.details || detail.organization || detail.borrowerBidReference);
}

async function discoverKenyaPpipCandidates(
	sourceUrl: string,
	limitPerSource: number,
	seenUrls: Set<string>,
	warnings: DiscoveryRunWarning[]
): Promise<{ handled: boolean; candidates: DiscoveryCandidate[] }> {
	try {
		const result = await fetchKenyaPpipOpportunities(sourceUrl, {
			limit: limitPerSource,
			timeoutMs: 20000,
		});
		if (!result.opportunities.length) {
			warnings.push({
				type: "source_scrape_empty",
				query: `source:${sourceUrl}`,
				title: "Kenya PPIP API returned no opportunities",
				url: result.apiUrl,
				message: "The PPIP public JSON API responded successfully, but returned no tender records.",
			});
			return { handled: true, candidates: [] };
		}

		const candidates: DiscoveryCandidate[] = [];
		for (const opportunity of result.opportunities.slice(0, limitPerSource)) {
			const url = opportunity.portalUrl ?? opportunity.documentUrl ?? sourceUrl;
			const normalizedUrl = normalizeUrlForIdentity(url);
			if (seenUrls.has(normalizedUrl)) continue;
			seenUrls.add(normalizedUrl);

			candidates.push({
				query: `source:${sourceUrl}`,
				discoveryMethod: "source_scrape",
				sourceUrl,
				opportunity,
				sourceTotal: result.total,
				result: {
					title: opportunity.title,
					url,
					content: opportunity.projectSummary ?? "",
					engine: "kenya-ppip-api",
					score: 1,
					category: opportunity.category ?? opportunity.countryRegion ?? "Kenya PPIP",
				},
				scrape: {
					success: true,
					title: opportunity.title,
					description: opportunity.projectSummary,
					markdown: [
						`# ${opportunity.title}`,
						opportunity.organization ? `Organization: ${opportunity.organization}` : undefined,
						opportunity.noticeId ? `Notice: ${opportunity.noticeId}` : undefined,
						opportunity.deadline ? `Deadline: ${opportunity.deadline}` : undefined,
						opportunity.documentUrl ? `Document: ${opportunity.documentUrl}` : undefined,
					].filter(Boolean).join("\n"),
					links: opportunity.documentUrl ? [opportunity.documentUrl] : undefined,
					method: "source_api",
				},
			});
		}

		return { handled: true, candidates };
	} catch (error) {
		warnings.push({
			type: "source_scrape_failed",
			query: `source:${sourceUrl}`,
			title: "Kenya PPIP API failed",
			url: sourceUrl,
			message: error instanceof Error ? error.message : String(error),
		});
		return { handled: false, candidates: [] };
	}
}

async function discoverUngmCandidates(
	sourceUrl: string,
	limitPerSource: number,
	seenUrls: Set<string>,
	warnings: DiscoveryRunWarning[]
): Promise<{ handled: boolean; candidates: DiscoveryCandidate[] }> {
	try {
		const result = await fetchUngmOpportunities(sourceUrl, {
			limit: limitPerSource,
			timeoutMs: 20000,
		});
		if (!result.opportunities.length) {
			warnings.push({
				type: "source_scrape_empty",
				query: `source:${sourceUrl}`,
				title: "UNGM notice search returned no opportunities",
				url: result.searchUrl,
				message: "The UNGM public notice endpoint responded successfully, but returned no active notice records.",
			});
			return { handled: true, candidates: [] };
		}

		const candidates: DiscoveryCandidate[] = [];
		for (const opportunity of result.opportunities.slice(0, limitPerSource)) {
			const url = opportunity.portalUrl ?? sourceUrl;
			const normalizedUrl = normalizeUrlForIdentity(url);
			if (seenUrls.has(normalizedUrl)) continue;
			seenUrls.add(normalizedUrl);

			candidates.push({
				query: `source:${sourceUrl}`,
				discoveryMethod: "source_scrape",
				sourceUrl,
				opportunity,
				sourceTotal: result.total,
				result: {
					title: opportunity.title,
					url,
					content: opportunity.projectSummary ?? "",
					engine: "ungm-public-notice-search",
					score: 1,
					category: opportunity.category ?? opportunity.countryRegion ?? "UNGM",
				},
				scrape: {
					success: true,
					title: opportunity.title,
					description: opportunity.projectSummary,
					markdown: [
						`# ${opportunity.title}`,
						opportunity.organization ? `Organization: ${opportunity.organization}` : undefined,
						opportunity.noticeId ? `Notice: ${opportunity.noticeId}` : undefined,
						opportunity.deadline ? `Deadline: ${opportunity.deadline}` : undefined,
						opportunity.portalUrl ? `Portal: ${opportunity.portalUrl}` : undefined,
					].filter(Boolean).join("\n"),
					method: "source_api",
				},
			});
		}

		return { handled: true, candidates };
	} catch (error) {
		warnings.push({
			type: "source_scrape_failed",
			query: `source:${sourceUrl}`,
			title: "UNGM notice search failed",
			url: sourceUrl,
			message: error instanceof Error ? error.message : String(error),
		});
		return { handled: false, candidates: [] };
	}
}

async function discoverAfdbSearchFallbackCandidates(
	sourceUrl: string,
	limitPerSource: number,
	seenUrls: Set<string>,
	warnings: DiscoveryRunWarning[]
): Promise<{ handled: boolean; candidates: DiscoveryCandidate[] }> {
	const candidates: DiscoveryCandidate[] = [];
	const seenDocuments = new Set<string>();
	let lastError: string | undefined;

	for (const query of AFDB_SEARCH_FALLBACK_QUERIES) {
		try {
			const response = await searchSearxng(query, {
				engines: ["google", "duckduckgo", "bing", "brave"],
				sendAcceptHeader: false,
			});
			for (const result of response.results) {
				const opportunity = afdbOpportunityFromSearchResult(result, query);
				if (!opportunity) continue;
				const documentUrl = opportunity.documentUrl ?? opportunity.rfpLink;
				if (!documentUrl) continue;

				const identity = sourceOpportunityIdentity(opportunity, sourceUrl);
				if (seenDocuments.has(identity) || seenUrls.has(identity)) continue;
				if (!(await isDownloadableAfdbSearchDocument(documentUrl))) continue;

				seenDocuments.add(identity);
				seenUrls.add(identity);
				candidates.push({
					query: `source:${sourceUrl}`,
					discoveryMethod: "source_scrape",
					sourceUrl,
					opportunity,
					sourceTotal: response.number_of_results || response.results.length,
					result: {
						...result,
						url: opportunity.portalUrl ?? result.url,
						content: opportunity.projectSummary ?? result.content,
						category: opportunity.category ?? result.category,
					},
					scrape: {
						success: true,
						title: opportunity.title,
						description: opportunity.projectSummary,
						markdown: [
							`# ${opportunity.title}`,
							`Discovery: AFDB SearXNG document fallback`,
							`Query: ${query}`,
							`Document: ${documentUrl}`,
							opportunity.portalUrl ? `Search result: ${opportunity.portalUrl}` : undefined,
						].filter(Boolean).join("\n"),
						links: [documentUrl],
						method: "source_api",
						fallbackReason: "AFDB listing scrape returned blocked or empty content",
					},
				});

				if (candidates.length >= limitPerSource) {
					return { handled: true, candidates };
				}
			}
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
		}
	}

	if (candidates.length > 0) return { handled: true, candidates };

	warnings.push({
		type: lastError ? "source_scrape_failed" : "source_scrape_empty",
		query: `source:${sourceUrl}`,
		title: lastError ? "AFDB search fallback failed" : "AFDB search fallback found no documents",
		url: sourceUrl,
		message: lastError
			? `AFDB listing scrape was unusable and SearXNG document fallback failed: ${lastError}`
			: "AFDB listing scrape was unusable and SearXNG document fallback found no downloadable procurement documents.",
	});
	return { handled: true, candidates: [] };
}

function afdbOpportunityFromSearchResult(result: SearxngResult, query: string): OpportunityData | undefined {
	const documentUrl = afdbDocumentUrlFromSearchResult(result);
	if (!documentUrl) return undefined;
	const title = cleanAfdbSearchTitle(result.title);
	const haystack = `${title} ${result.content} ${documentUrl}`.toLowerCase();
	if (!/(reoi|eoi|ifb|spn|request|expression of interest|tender|procurement|consultant|consulting)/iu.test(haystack)) {
		return undefined;
	}

	const sourceId = `afdb-search-${sha256Hex(documentUrl).slice(0, 24)}`;
	const isExpressionOfInterest = /expression of interest|\breoi\b|\beoi\b/iu.test(haystack);
	return {
		title,
		source: "afdb",
		sourceId,
		noticeId: sourceId,
		organization: "African Development Bank",
		category: isExpressionOfInterest ? "Expression of interest" : "Tender",
		opportunityType: isExpressionOfInterest ? "eoi" : "tender",
		portalUrl: result.url,
		documentUrl,
		rfpLink: documentUrl,
		projectSummary: result.content || title,
		tags: ["afdb", "development-bank", "regional-procurement", "search-fallback"],
		metadata: {
			afdb: {
				discoveryMethod: "searxng-document-search",
				query,
				engine: result.engine,
				score: result.score,
			},
		},
	};
}

function afdbDocumentUrlFromSearchResult(result: SearxngResult): string | undefined {
	try {
		const parsed = new URL(result.url);
		if (!/\.(pdf|docx?)(?:$|[?#])/iu.test(parsed.pathname)) return undefined;
		if (/operations?[-_]?procurement[-_]?manual|opm-part|procurement[-_]?policy/iu.test(parsed.pathname)) return undefined;
		const haystack = `${result.title} ${result.content} ${result.url}`.toLowerCase();
		if (/(^|\.)afdb\.org$/iu.test(parsed.hostname)) return undefined;
		if (!/(african development bank|afdb)/iu.test(haystack)) return undefined;
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return undefined;
	}
}

async function isDownloadableAfdbSearchDocument(documentUrl: string): Promise<boolean> {
	try {
		const response = await fetchPublicHttpUrl(documentUrl, {
			headers: {
				"User-Agent": "DocFusion/1.0 opportunity-discovery",
				Range: "bytes=0-1023",
			},
			timeoutMs: 15000,
		}, "AFDB discovery fallback document probe");
		if (!response.ok) return false;
		const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
		return !contentType.includes("text/html");
	} catch {
		return false;
	}
}

function cleanAfdbSearchTitle(title: string): string {
	return title
		.replace(/\s*-\s*African Development Bank\s*$/iu, "")
		.replace(/\s*\.\.\.\s*$/u, "")
		.replace(/\s+/gu, " ")
		.trim()
		|| "AFDB procurement opportunity";
}

function browserFallbackReason(scrape: DiscoveryCandidate["scrape"]): string | null {
	if (!scrape?.success) {
		return scrape?.error || "Firecrawl scrape failed";
	}
	if (isBotProtectionContent(scrape)) {
		return "Scrape returned bot-protection content";
	}

	const markdownLength = scrape.markdown?.trim().length ?? 0;
	if (markdownLength < MIN_USEFUL_SCRAPE_MARKDOWN_LENGTH && !scrape.description?.trim()) {
		return `Firecrawl returned sparse content (${markdownLength} markdown characters)`;
	}

	return null;
}

function isUsefulBrowserFallback(scrape: DiscoveryCandidate["scrape"]): boolean {
	if (!scrape?.success) return false;
	if (isBotProtectionContent(scrape)) return false;
	return Boolean(
		scrape.description?.trim() ||
		(scrape.markdown?.trim().length ?? 0) >= MIN_USEFUL_SCRAPE_MARKDOWN_LENGTH ||
		scrape.title?.trim()
	);
}

function isBotProtectionContent(scrape: Pick<NonNullable<DiscoveryCandidate["scrape"]>, "title" | "description" | "markdown">): boolean {
	const content = `${scrape.title ?? ""}\n${scrape.description ?? ""}\n${scrape.markdown ?? ""}`;
	return BOT_PROTECTION_CONTENT_PATTERN.test(content);
}

function collectDiscoveryWarnings(candidates: DiscoveryCandidate[]): DiscoveryRunWarning[] {
	const warnings: DiscoveryRunWarning[] = [];
	for (const candidate of candidates) {
		if (!candidate.scrape) continue;
		const base = {
			query: candidate.query,
			title: candidate.result.title,
			url: candidate.result.url,
		};
		if (candidate.scrape.method === "browser_fallback" && candidate.scrape.success) {
			warnings.push({
				...base,
				type: "browser_fallback_used",
				message: candidate.scrape.fallbackReason ?? "Firecrawl required browser fallback",
			});
			continue;
		}
		if (candidate.scrape.method === "browser_fallback" && !candidate.scrape.success) {
			warnings.push({
				...base,
				type: "browser_fallback_failed",
				message: candidate.scrape.error ?? candidate.scrape.fallbackReason ?? "Browser fallback failed",
			});
			continue;
		}
		if (candidate.scrape.method === "cloakbrowser_fallback" && candidate.scrape.success) {
			warnings.push({
				...base,
				type: "cloakbrowser_fallback_used",
				message: candidate.scrape.fallbackReason ?? "Configured source required CloakBrowser fallback",
			});
			continue;
		}
		if (candidate.scrape.method === "cloakbrowser_fallback" && !candidate.scrape.success) {
			warnings.push({
				...base,
				type: "cloakbrowser_fallback_failed",
				message: candidate.scrape.error ?? candidate.scrape.fallbackReason ?? "CloakBrowser fallback failed",
			});
			continue;
		}
		if (candidate.scrape.method === "firecrawl" && !candidate.scrape.success) {
			warnings.push({
				...base,
				type: "firecrawl_failed",
				message: candidate.scrape.error ?? "Firecrawl scrape failed",
			});
		}
	}
	return warnings;
}

async function scrapeWithBrowserFallback(
	url: string,
	fallbackReason: string
): Promise<NonNullable<DiscoveryCandidate["scrape"]>> {
	return scrapeWithBrowser(url, "browser_fallback", fallbackReason);
}

async function scrapeWithBrowserSource(
	url: string
): Promise<NonNullable<DiscoveryCandidate["scrape"]>> {
	return scrapeWithBrowser(url, "browser_source");
}

async function scrapeWithBrowser(
	url: string,
	method: Extract<DiscoveryScrapeMethod, "browser_fallback" | "browser_source">,
	fallbackReason?: string
): Promise<NonNullable<DiscoveryCandidate["scrape"]>> {
	const stealthUrl = (process.env.STEALTH_SCRAPER_URL || DEFAULT_STEALTH_SCRAPER_URL).replace(/\/$/, "");

	try {
		const result = await scrapeWithBrowserService(stealthUrl, url, {
			timeout: 15000,
			humanScroll: true,
			blockMedia: true,
			formats: ["markdown", "html", "links"],
		});

		return {
			success: result.success,
			title: result.data?.metadata?.title,
			description: result.data?.metadata?.description,
			markdown: result.data?.markdown,
			links: result.data?.links,
			error: result.error,
			method,
			fallbackReason,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
			method,
			fallbackReason,
		};
	}
}

export async function executeOpportunityDiscoveryImport(
	input: DiscoveryImportInput,
	userId: string,
	organizationId: string
): Promise<DiscoveryImportResult> {
	const queries = normalizeDiscoveryQueries(input);
	const sourceUrls = normalizeSourceUrls(input);
	const limitPerQuery = Math.min(Math.max(input.limitPerQuery ?? 10, 1), 50);
	const sourceScrapeLimit = Math.min(Math.max(input.sourceScrapeLimit ?? limitPerQuery, 0), 500);
	const updateExisting = input.updateExisting ?? true;
	const downloadParseMode = input.downloadParseMode;
	const downloadLimit = input.downloadDiscoveredDocuments
		? Math.min(Math.max(input.downloadLimit ?? 3, 0), 25)
		: 0;
	const candidates: DiscoveryCandidate[] = [];
	const seenUrls = new Set<string>();
	const searchFailures: ImportRecordResult[] = [];
	const searchWarnings: DiscoveryRunWarning[] = [];
	const actionOverride = await actionOverrideForDiscoveryActor(userId, organizationId);

	const searchStats = new Map(queries.map((query) => [
		query,
		{
			accepted: 0,
			failed: 0,
			total: searchRequestsForInput(query, input).length,
		},
	]));
	for (const outcome of await runDiscoverySearches(queries, input)) {
		const stats = searchStats.get(outcome.query);
		if (outcome.response === undefined) {
			if (stats) stats.failed++;
			if (outcome.request.failedAsImportError) {
				searchFailures.push({
					rowIndex: searchFailures.length + 1,
					status: "failed",
					error: `Search failed for "${outcome.query}": ${String(outcome.error)}`,
					data: { title: outcome.query },
				});
			} else {
				searchWarnings.push({
					type: "searxng_engine_degraded",
					query: outcome.query,
					title: `SearXNG ${outcome.request.label} search failed`,
					url: `${getSearxngBaseUrl()}/search`,
					message: `${outcome.request.label}: ${outcome.error instanceof Error ? outcome.error.message : String(outcome.error)}`,
				});
			}
			continue;
		}

		searchWarnings.push(...collectSearxngEngineWarnings(outcome.query, outcome.response.unresponsive_engines));

		for (const result of outcome.response.results.slice(0, limitPerQuery)) {
			if (!result.url || !result.title) continue;
			if (isLowValueDiscoveryUrl(result.url)) continue;
			if (!input.includeUnmatchedResults && !isLikelyOpportunity(result, outcome.query)) continue;

			const normalizedUrl = normalizeUrlForIdentity(result.url);
			if (seenUrls.has(normalizedUrl)) continue;
			seenUrls.add(normalizedUrl);
			candidates.push({ query: outcome.query, result });
			if (stats) stats.accepted++;
		}
	}

	for (const [query, stats] of searchStats) {
		if (stats.accepted === 0 && stats.failed < stats.total) {
			searchWarnings.push(collectSearchNoCandidateWarning(query));
		}
	}

	if (input.scrapeTopResults) {
		await scrapeDiscoveryCandidates(
			candidates,
			Math.min(input.scrapeLimit ?? 3, candidates.length),
			input
		);
	}
	const warnings = [...searchWarnings];
	candidates.push(...await discoverConfiguredSourceCandidates(
		sourceUrls,
		sourceScrapeLimit,
		seenUrls,
		warnings,
		input
	));
	warnings.push(...collectDiscoveryWarnings(candidates));
	const baseImportConfig: ImportConfig = {
		columnMappings: [],
		sheetName: "searxng_discovery",
		updateExisting,
		matchBy: "sourceId",
	};

	const totalRecords = candidates.length + searchFailures.length;
	const importConfig = importConfigWithWarnings(baseImportConfig, warnings);
	const importId = await withPersistenceRetry(() => actionOverride
		? createImportRecord("searxng-discovery", totalRecords, importConfig, userId, actionOverride.organizationId)
		: createImportRecord("searxng-discovery", totalRecords, importConfig, userId));

	const importResults: ImportResultsSummary = {
		total: totalRecords,
		imported: 0,
		updated: 0,
		skipped: 0,
		failed: searchFailures.length,
	};
	let sourceDocumentsCreated = 0;
	let sourceDocumentsExisting = 0;
	let sourceDocumentsDownloadAttempted = 0;
	let sourceDocumentsDownloaded = 0;
	let sourceDocumentsDownloadFailed = 0;
	let sourceDocumentsParseAttempted = 0;
	let sourceDocumentsParsed = 0;
	let sourceDocumentsParseFailed = 0;
	const allErrors: ImportRecordResult[] = [...searchFailures];
	const sourceImportOutcomes: SourceCandidateImportOutcome[] = [];

	function recordSourceDocumentDownloadOutcome(
		outcome: SourceDocumentDownloadOutcome,
		candidate: DiscoveryCandidate
	): void {
		if (outcome.downloaded) {
			sourceDocumentsDownloaded++;
		} else {
			sourceDocumentsDownloadFailed++;
			return;
		}

		if (outcome.parsingStatus === "completed") {
			sourceDocumentsParseAttempted++;
			sourceDocumentsParsed++;
		}
		if (outcome.parsingStatus === "failed") {
			sourceDocumentsParseAttempted++;
			sourceDocumentsParseFailed++;
			warnings.push({
				type: "source_document_parse_failed",
				query: candidate.query,
				title: candidate.result.title,
				url: candidate.result.url,
				message: outcome.parsingError ?? "Downloaded source document could not be parsed",
			});
		}
	}

	for (let i = 0; i < candidates.length; i++) {
		const candidate = candidates[i];

		try {
			const oppData = buildOpportunityFromDiscovery(candidate, userId, input);
			const existingId = await findExistingDiscoveredOpportunity(oppData, organizationId);

			if (existingId && !updateExisting) {
				importResults.skipped++;
				if (candidate.sourceUrl) {
					sourceImportOutcomes.push({ sourceUrl: candidate.sourceUrl, status: "skipped" });
				}
				allErrors.push({
					rowIndex: searchFailures.length + i + 1,
					status: "skipped",
					opportunityId: existingId,
				});
				continue;
			}

			if (existingId) {
				if (actionOverride) {
					await updateOpportunity(existingId, oppData, actionOverride);
				} else {
					await updateOpportunity(existingId, oppData);
				}
				const sourceDocumentStates = await ensureDiscoveredSourceDocumentsSafely(
					existingId,
					oppData,
					organizationId,
					candidate,
					warnings
				);
				for (const sourceDocumentState of sourceDocumentStates) {
					if (sourceDocumentState.state === "created") {
						sourceDocumentsCreated++;
						if (sourceDocumentsDownloadAttempted < downloadLimit) {
							sourceDocumentsDownloadAttempted++;
							const downloadOutcome = await downloadSeededSourceDocumentSafely(
								sourceDocumentState.documentId,
								existingId,
								userId,
								candidate,
								warnings,
								downloadParseMode
							);
							recordSourceDocumentDownloadOutcome(downloadOutcome, candidate);
						}
					}
					if (sourceDocumentState.state === "existing") {
						sourceDocumentsExisting++;
					}
				}
				importResults.updated++;
				if (candidate.sourceUrl) {
					sourceImportOutcomes.push({ sourceUrl: candidate.sourceUrl, status: "updated" });
				}
				allErrors.push({
					rowIndex: searchFailures.length + i + 1,
					status: "updated",
					opportunityId: existingId,
				});
			} else {
				const created = actionOverride
					? await createOpportunity(oppData, actionOverride)
					: await createOpportunity(oppData);
				const sourceDocumentStates = await ensureDiscoveredSourceDocumentsSafely(
					created.id,
					oppData,
					organizationId,
					candidate,
					warnings
				);
				for (const sourceDocumentState of sourceDocumentStates) {
					if (sourceDocumentState.state === "created") {
						sourceDocumentsCreated++;
						if (sourceDocumentsDownloadAttempted < downloadLimit) {
							sourceDocumentsDownloadAttempted++;
							const downloadOutcome = await downloadSeededSourceDocumentSafely(
								sourceDocumentState.documentId,
								created.id,
								userId,
								candidate,
								warnings,
								downloadParseMode
							);
							recordSourceDocumentDownloadOutcome(downloadOutcome, candidate);
						}
					}
					if (sourceDocumentState.state === "existing") {
						sourceDocumentsExisting++;
					}
				}
				importResults.imported++;
				if (candidate.sourceUrl) {
					sourceImportOutcomes.push({ sourceUrl: candidate.sourceUrl, status: "created" });
				}
				allErrors.push({
					rowIndex: searchFailures.length + i + 1,
					status: "created",
					opportunityId: created.id,
				});
			}
		} catch (err) {
			importResults.failed++;
			if (candidate.sourceUrl) {
				sourceImportOutcomes.push({ sourceUrl: candidate.sourceUrl, status: "failed" });
			}
			allErrors.push({
				rowIndex: searchFailures.length + i + 1,
				status: "failed",
				error: String(err),
				data: {
					title: candidate.result.title,
					rfpLink: candidate.result.url,
				},
			});
		}
	}

	const sourceHealth = buildSourceHealthRollups(sourceUrls, candidates, sourceImportOutcomes, warnings);
	const completedImportResults = {
		importedRecords: importResults.imported,
		updatedRecords: importResults.updated,
		skippedRecords: importResults.skipped,
		failedRecords: importResults.failed,
		status: "completed",
		errors: allErrors.filter((e) => e.status === "failed"),
		config: importConfigWithWarnings(baseImportConfig, warnings, sourceHealth),
	} as const;
	await withPersistenceRetry(() => actionOverride
		? updateImportRecord(importId, completedImportResults, userId, actionOverride.organizationId)
		: updateImportRecord(importId, completedImportResults, userId));

	return {
		importId,
		results: importResults,
		errors: allErrors,
		warnings,
		sourceHealth,
		sourceDocumentsCreated,
		sourceDocumentsExisting,
		sourceDocumentsDownloadAttempted,
		sourceDocumentsDownloaded,
		sourceDocumentsDownloadFailed,
		sourceDocumentsParseAttempted,
		sourceDocumentsParsed,
		sourceDocumentsParseFailed,
	};
}
