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
import { fetchKenyaPpipOpportunities, isKenyaPpipUrl } from "@/lib/services/kenya-ppip-client";
import { fetchUngmOpportunities, isUngmUrl } from "@/lib/services/ungm-client";
import { downloadDocument } from "@/lib/services/rfp-document-service";
import {
	getSearxngBaseUrl,
	searchSearxng,
	type SearchOptions,
	type SearxngResult,
	type SearxngUnresponsiveEngine,
} from "@/lib/services/searxng-client";
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
		method: "firecrawl" | "browser_fallback" | "source_api";
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
		| "source_document_seed_failed"
		| "source_document_download_failed";
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
}

type SourceDocumentSeedResult =
	| { state: "created" | "existing"; documentId: string; sourceUrl: string }
	| { state: "none" | "failed"; documentId?: undefined; sourceUrl?: string };

type SourceCandidateImportStatus = ImportRecordResult["status"];

interface SourceCandidateImportOutcome {
	sourceUrl: string;
	status: SourceCandidateImportStatus;
}

type FirecrawlScrapeResult = Awaited<ReturnType<FirecrawlClient["scrape"]>>;

type DiscoveryDocumentLink = {
	url: string;
	label?: string;
	source: "result_url" | "opportunity_document_url" | "scraped_markdown" | "scraped_link";
	score: number;
};

interface ConfiguredSourceParseResult {
	parser: TenderParser;
	parseResult: ParseResult;
	scrapeResult: FirecrawlScrapeResult;
	attempts: number;
	method: "firecrawl" | "browser_fallback";
	fallbackReason?: string;
	lastEmptyMessage?: string;
}

const DEFAULT_DISCOVERY_QUERIES = [
	"software development RFP Africa",
	"ICT tender East Africa",
	"digital transformation request for proposals Kenya",
	"grant management system tender Africa",
];

const OPPORTUNITY_KEYWORDS = [
	"rfp",
	"request for proposal",
	"tender",
	"bid",
	"eoi",
	"expression of interest",
	"procurement",
	"grant",
	"solicitation",
];

const DEFAULT_STEALTH_SCRAPER_URL = "http://84.247.181.100:3003";
const MIN_USEFUL_SCRAPE_MARKDOWN_LENGTH = 120;
const DEFAULT_AFDB_DETAIL_LIMIT = 5;
const DEFAULT_COMESA_DETAIL_LIMIT = 5;
const DEFAULT_UNDP_DETAIL_LIMIT = 5;
const DEFAULT_WORLD_BANK_DETAIL_LIMIT = 5;
const DEFAULT_CONFIGURED_SOURCE_SCRAPE_ATTEMPTS = 2;
const MAX_DISCOVERY_SOURCE_DOCUMENTS = 5;
const MIN_DISCOVERY_SOURCE_DOCUMENT_SCORE = 6;
const DOCUMENT_URL_PATTERN = /\.(pdf|docx?|xlsx?|zip)(?:[?#]|$)/i;
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
	const url = opportunity.documentUrl ?? opportunity.rfpLink ?? opportunity.portalUrl;
	if (url) return normalizeUrlForIdentity(url);
	return `${normalizeUrlForIdentity(sourceUrl)}#${opportunity.sourceId ?? opportunity.noticeId ?? opportunity.title}`;
}

function compactText(value: string | undefined | null, maxLength: number): string | undefined {
	const compacted = value?.replace(/\s+/g, " ").trim();
	if (!compacted) return undefined;
	return compacted.length > maxLength ? `${compacted.slice(0, maxLength - 3)}...` : compacted;
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
	if (host.includes("afdb.org")) sourceId = "afdb";
	else if (host.includes("tenders.go.ke")) sourceId = "kenya_ppip";
	else if (host === "un.org" && safeUrlPathname(sourceUrl).startsWith("/procurement/")) sourceId = "un_procurement";
	else if (host.includes("procurement-notices.undp.org")) sourceId = "undp";
	else if (host === "ungm.org") sourceId = "ungm";
	else if (host.includes("worldbank.org")) sourceId = "world_bank";
	else if (host.includes("ebrd.com")) sourceId = "ebrd";
	else if (host.includes("dgmarket.com")) sourceId = "dgmarket";
	else if (host.includes("comesa.int")) sourceId = "comesa";
	else if (host.includes("unicef.org")) sourceId = "unicef";
	else if (host.includes("giz.de") && safeUrlPathname(sourceUrl).endsWith("/tenders")) sourceId = "giz";
	return sourceId ? getParser(sourceId) ?? genericParser : genericParser;
}

function isLikelyOpportunity(result: SearxngResult): boolean {
	const haystack = `${result.title} ${result.content} ${result.url}`.toLowerCase();
	return OPPORTUNITY_KEYWORDS.some((keyword) => haystack.includes(keyword));
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

function inferOpportunityType(candidate: DiscoveryCandidate): OpportunityInput["opportunityType"] {
	const haystack = [
		candidate.result.title,
		candidate.result.content,
		candidate.scrape?.title,
		candidate.scrape?.description,
	].join(" ").toLowerCase();

	if (haystack.includes("expression of interest") || /\beoi\b/.test(haystack)) return "eoi";
	if (haystack.includes("grant")) return "grant";
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

	for (const link of extractDocumentLinks(candidate.scrape?.markdown, candidate.scrape?.links, candidate.result.url)) {
		addDocumentLinkCandidate(candidates, seenUrls, link);
	}

	return candidates
		.map((candidateLink, order) => ({ ...candidateLink, order }))
		.sort((a, b) => b.score - a.score || a.order - b.order)
		.slice(0, MAX_DISCOVERY_SOURCE_DOCUMENTS)
		.map(({ order: _order, ...candidateLink }) => candidateLink);
}

function sourceOpportunityDocumentLinks(opportunity: OpportunityData | undefined): DiscoveryDocumentLink[] {
	const gizLinks = opportunity?.metadata?.giz && typeof opportunity.metadata.giz === "object"
		? (opportunity.metadata.giz as { documentLinks?: unknown }).documentLinks
		: undefined;
	if (!Array.isArray(gizLinks)) return [];

	return gizLinks
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
	if (opportunity?.source === "kenya_ppip") return "Kenya PPIP";
	if (opportunity?.source === "undp") return "UNDP";
	if (opportunity?.source === "ungm") return "UNGM";
	if (opportunity?.source === "world_bank") return "World Bank";
	if (opportunity?.source === "ebrd") return "EBRD";
	if (opportunity?.source === "comesa") return "COMESA";
	if (opportunity?.source === "un_procurement") return "UN Procurement";
	if (opportunity?.source === "unicef") return "UNICEF Supply Division";
	if (opportunity?.source === "giz") return "GIZ";
	return discoveryMethod === "source_scrape" ? "Configured Source Scrape" : "SearXNG";
}

function sourceTags(opportunity: OpportunityData | undefined, discoveryMethod: DiscoveryCandidate["discoveryMethod"]): string[] {
	if (discoveryMethod !== "source_scrape") return ["external-discovery"];
	return [...new Set([
		"external-discovery",
		"source-scrape",
		...(opportunity?.source === "afdb" ? ["afdb", "development-bank", "regional-procurement"] : []),
		...(opportunity?.source === "kenya_ppip" ? ["kenya-ppip"] : []),
		...(opportunity?.source === "undp" ? ["undp", "un-procurement"] : []),
		...(opportunity?.source === "ungm" ? ["ungm", "un-procurement"] : []),
		...(opportunity?.source === "world_bank" ? ["world-bank", "development-bank", "global-procurement"] : []),
		...(opportunity?.source === "ebrd" ? ["ebrd", "development-bank", "global-procurement"] : []),
		...(opportunity?.source === "comesa" ? ["comesa", "regional-procurement"] : []),
		...(opportunity?.source === "un_procurement" ? ["un-procurement", "unpd"] : []),
		...(opportunity?.source === "unicef" ? ["unicef", "un-procurement", "tender-calendar"] : []),
		...(opportunity?.source === "giz" ? ["giz", "bilateral-donor"] : []),
		...(opportunity?.tags ?? []),
	])];
}

function configuredSourceScrapeAttempts(): number {
	const parsed = Number(process.env.CONFIGURED_SOURCE_SCRAPE_ATTEMPTS ?? DEFAULT_CONFIGURED_SOURCE_SCRAPE_ATTEMPTS);
	return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : DEFAULT_CONFIGURED_SOURCE_SCRAPE_ATTEMPTS;
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

function discoveredSourceDocumentName(url: string, opportunityTitle: string): string {
	const path = safeUrlPathname(url);
	const filename = path.split("/").filter(Boolean).pop();
	if (filename && /\.[a-z0-9]{2,5}$/i.test(filename)) {
		return decodeURIComponent(filename).slice(0, 500);
	}
	return `${opportunityTitle.slice(0, 450)}.html`;
}

function discoveredSourceDocumentType(url: string): "rfp" | "attachment" {
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
	warnings: DiscoveryRunWarning[]
): Promise<boolean> {
	try {
		const result = await downloadDocument(documentId, userId, opportunityId);
		if (result.success) {
			return true;
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
	return false;
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
	const source = sourceOpportunity?.source === "afdb" || sourceOpportunity?.source === "kenya_ppip" || sourceOpportunity?.source === "undp" || sourceOpportunity?.source === "ungm" || sourceOpportunity?.source === "world_bank" || sourceOpportunity?.source === "ebrd" || sourceOpportunity?.source === "comesa" || sourceOpportunity?.source === "un_procurement" || sourceOpportunity?.source === "unicef" || sourceOpportunity?.source === "giz"
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
		submissionMethod: sourceOpportunity?.submissionMethod,
		rfpLink: sourceOpportunity?.rfpLink || sourceOpportunity?.portalUrl || candidate.result.url,
		sourcePlatform: sourcePlatformName(sourceOpportunity, discoveryMethod),
		sourceFile: discoveryMethod === "source_scrape" ? `source:${candidate.sourceUrl ?? candidate.query}` : slugForSourceFile(candidate.query),
		opportunityType: sourceOpportunityType(sourceOpportunity) || inferOpportunityType(candidate),
		source,
		fingerprint: urlHash,
		noticeId: sourceOpportunity?.noticeId,
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
				scrapedWithBrowserFallback: candidate.scrape?.success && candidate.scrape.method === "browser_fallback",
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
		if (isKenyaPpipUrl(sourceUrl)) {
			const ppipResult = await discoverKenyaPpipCandidates(sourceUrl, limitPerSource, seenUrls, warnings);
			candidates.push(...ppipResult.candidates);
			if (ppipResult.handled) continue;
		}
		if (isUngmUrl(sourceUrl)) {
			const ungmResult = await discoverUngmCandidates(sourceUrl, limitPerSource, seenUrls, warnings);
			candidates.push(...ungmResult.candidates);
			if (ungmResult.handled) continue;
		}

		const sourceResult = await scrapeAndParseConfiguredSource(firecrawl, sourceUrl, {
			browserFallback: input.browserFallback ?? true,
		});
		if (!sourceResult.scrapeResult.success || !sourceResult.scrapeResult.data) {
			warnings.push({
				type: sourceResult.method === "browser_fallback" ? "browser_fallback_failed" : "source_scrape_failed",
				query: `source:${sourceUrl}`,
				title: "Configured source scrape failed",
				url: sourceUrl,
				message: sourceResult.scrapeResult.error ?? "Firecrawl returned no source content",
			});
			continue;
		}

		const { parser, parseResult, scrapeResult } = sourceResult;
		if (!parseResult.opportunities.length) {
			warnings.push({
				type: "source_scrape_empty",
				query: `source:${sourceUrl}`,
				title: "Configured source scrape found no opportunities",
				url: sourceUrl,
				message: sourceResult.lastEmptyMessage
					?? `${sourceResult.method === "browser_fallback" ? "Browser fallback" : "Firecrawl"} returned content after ${sourceResult.attempts} attempt(s), but the ${parser.name} parser found no tender-like records.`,
			});
			continue;
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
	}

	return candidates;
}

async function scrapeAndParseConfiguredSource(
	firecrawl: FirecrawlClient,
	sourceUrl: string,
	options: { browserFallback: boolean }
): Promise<ConfiguredSourceParseResult> {
	const parser = parserForSourceUrl(sourceUrl);
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
			if (options.browserFallback) {
				return {
					parser,
					...await maybeParseConfiguredSourceWithBrowserFallback(
						parser,
						sourceUrl,
						scrapeResult,
						lastParseResult,
						attempt
					),
				};
			}
			return {
				parser,
				parseResult: lastParseResult,
				scrapeResult,
				attempts: attempt,
				method: "firecrawl",
			};
		}

		lastParseResult = await parser.parse({
			html: scrapeResult.data.html,
			markdown: scrapeResult.data.markdown ?? "",
			links: scrapeResult.data.links ?? [],
			url: sourceUrl,
		});
		if (lastParseResult.opportunities.length > 0) {
			return {
				parser,
				parseResult: lastParseResult,
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
		attempts,
		method: "browser_fallback",
		fallbackReason,
		lastEmptyMessage: parseResult.opportunities.length > 0
			? undefined
			: `Browser fallback returned content but ${parser.name} found no tender-like records.`,
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

function browserFallbackReason(scrape: DiscoveryCandidate["scrape"]): string | null {
	if (!scrape?.success) {
		return scrape?.error || "Firecrawl scrape failed";
	}

	const markdownLength = scrape.markdown?.trim().length ?? 0;
	if (markdownLength < MIN_USEFUL_SCRAPE_MARKDOWN_LENGTH && !scrape.description?.trim()) {
		return `Firecrawl returned sparse content (${markdownLength} markdown characters)`;
	}

	return null;
}

function isUsefulBrowserFallback(scrape: DiscoveryCandidate["scrape"]): boolean {
	if (!scrape?.success) return false;
	return Boolean(
		scrape.description?.trim() ||
		(scrape.markdown?.trim().length ?? 0) >= MIN_USEFUL_SCRAPE_MARKDOWN_LENGTH ||
		scrape.title?.trim()
	);
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
			method: "browser_fallback",
			fallbackReason,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
			method: "browser_fallback",
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
	const sourceScrapeLimit = Math.min(Math.max(input.sourceScrapeLimit ?? limitPerQuery, 0), 50);
	const updateExisting = input.updateExisting ?? true;
	const downloadLimit = input.downloadDiscoveredDocuments
		? Math.min(Math.max(input.downloadLimit ?? 3, 0), 10)
		: 0;
	const candidates: DiscoveryCandidate[] = [];
	const seenUrls = new Set<string>();
	const searchFailures: ImportRecordResult[] = [];
	const searchWarnings: DiscoveryRunWarning[] = [];
	const actionOverride = await actionOverrideForDiscoveryActor(userId, organizationId);

	for (const query of queries) {
		try {
			const candidateCountBeforeQuery = candidates.length;
			const response = await searchSearxng(query, {
				categories: input.categories ?? ["general", "news", "files"],
				engines: input.engines,
				language: input.language,
				time_range: input.timeRange,
				safesearch: 1,
			});
			searchWarnings.push(...collectSearxngEngineWarnings(query, response.unresponsive_engines));

			for (const result of response.results.slice(0, limitPerQuery)) {
				if (!result.url || !result.title) continue;
				if (!input.includeUnmatchedResults && !isLikelyOpportunity(result)) continue;

				const normalizedUrl = normalizeUrlForIdentity(result.url);
				if (seenUrls.has(normalizedUrl)) continue;
				seenUrls.add(normalizedUrl);
				candidates.push({ query, result });
			}
			if (candidates.length === candidateCountBeforeQuery) {
				searchWarnings.push(collectSearchNoCandidateWarning(query));
			}
		} catch (err) {
			searchFailures.push({
				rowIndex: searchFailures.length + 1,
				status: "failed",
				error: `Search failed for "${query}": ${String(err)}`,
				data: { title: query },
			});
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
	const importId = actionOverride
		? await createImportRecord("searxng-discovery", totalRecords, importConfig, userId, actionOverride.organizationId)
		: await createImportRecord("searxng-discovery", totalRecords, importConfig, userId);

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
	const allErrors: ImportRecordResult[] = [...searchFailures];
	const sourceImportOutcomes: SourceCandidateImportOutcome[] = [];

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
							if (await downloadSeededSourceDocumentSafely(
								sourceDocumentState.documentId,
								existingId,
								userId,
								candidate,
								warnings
							)) {
								sourceDocumentsDownloaded++;
							} else {
								sourceDocumentsDownloadFailed++;
							}
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
							if (await downloadSeededSourceDocumentSafely(
								sourceDocumentState.documentId,
								created.id,
								userId,
								candidate,
								warnings
							)) {
								sourceDocumentsDownloaded++;
							} else {
								sourceDocumentsDownloadFailed++;
							}
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
	if (actionOverride) {
		await updateImportRecord(importId, completedImportResults, userId, actionOverride.organizationId);
	} else {
		await updateImportRecord(importId, completedImportResults, userId);
	}

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
	};
}
