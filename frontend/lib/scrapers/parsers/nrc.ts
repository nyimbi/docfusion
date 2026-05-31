import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

export const NRC_TENDERS_URL = "https://www.nrc.no/themes/177/tender";

const NRC_BASE_URL = "https://www.nrc.no";
const NRC_SEARCH_API_URL = "https://www.nrc.no/api/SearchApi/SearchCategories";
const NRC_TENDER_PAGE_ID = "202178";
const NRC_TENDER_CATEGORY_ID = "177";
const DEFAULT_NRC_MAX_PAGES = 3;
const DEFAULT_NRC_DETAIL_LIMIT = 30;
const DOCUMENT_LINK_PATTERN = /\.(?:pdf|docx?|xlsx?|zip)(?:[?#].*)?$/i;

export type NrcTenderSearchEntry = {
	title?: string | null;
	date?: string | null;
	description?: string | null;
	pageUrl?: string | null;
};

export type NrcTenderSearchResponse = {
	searchEntries?: NrcTenderSearchEntry[] | null;
	pageNumber?: number | null;
	lastPage?: number | null;
	error?: unknown;
};

export type NrcTenderDetail = {
	title?: string;
	publishedDate?: Date;
	deadline?: Date;
	summary?: string;
	documentLinks: Array<{ url: string; label?: string }>;
	reference?: string;
};

function maxPages(): number {
	const parsed = Number(process.env.NRC_TENDER_MAX_PAGES ?? DEFAULT_NRC_MAX_PAGES);
	if (!Number.isFinite(parsed)) return DEFAULT_NRC_MAX_PAGES;
	return Math.min(10, Math.max(1, Math.trunc(parsed)));
}

function detailLimit(): number {
	const parsed = Number(process.env.NRC_TENDER_DETAIL_LIMIT ?? DEFAULT_NRC_DETAIL_LIMIT);
	if (!Number.isFinite(parsed)) return DEFAULT_NRC_DETAIL_LIMIT;
	return Math.min(100, Math.max(1, Math.trunc(parsed)));
}

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, codepoint: string) => String.fromCodePoint(Number(codepoint)))
		.replace(/&#x([0-9a-f]+);/gi, (_, codepoint: string) => String.fromCodePoint(Number.parseInt(codepoint, 16)))
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, "\"")
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&nbsp;/g, " ")
		.replace(/&ndash;/g, "-")
		.replace(/&mdash;/g, "-")
		.replace(/&rsquo;/g, "'")
		.replace(/&lsquo;/g, "'")
		.replace(/&ldquo;/g, "\"")
		.replace(/&rdquo;/g, "\"");
}

function stripHtml(value: string): string {
	return cleanText(decodeHtmlEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>|<\/tr>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function absoluteUrl(rawUrl: string | undefined | null, sourceUrl: string): string | undefined {
	if (!rawUrl) return undefined;
	try {
		const parsed = new URL(decodeHtmlEntities(rawUrl), sourceUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return undefined;
	}
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 90);
}

function utcStartOfDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isExpired(deadline: Date | undefined, now: Date): boolean {
	if (!deadline) return false;
	return deadline.getTime() < utcStartOfDay(now).getTime();
}

function parseNrcDate(value: string | undefined | null): Date | undefined {
	if (!value) return undefined;
	const cleaned = value
		.replace(/\b(\d{1,2})\.\s+([A-Za-z]+)/, "$1 $2")
		.replace(/\b(\d{1,2})(?:st|nd|rd|th)\b/gi, "$1")
		.replace(/\s+/g, " ")
		.trim();
	const slashDate = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (slashDate) {
		return new Date(Number(slashDate[3]), Number(slashDate[1]) - 1, Number(slashDate[2]));
	}
	return parseDate(cleaned);
}

function extractPublishedDate(content: string): Date | undefined {
	const jsonLdDate = content.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1];
	if (jsonLdDate) return parseNrcDate(jsonLdDate);
	const visibleDate = stripHtml(content.match(/\bPublished\s+([^<]+)/i)?.[1] ?? "");
	return parseNrcDate(visibleDate);
}

function parseCandidateDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	return parseNrcDate(value
		.replace(/\([^)]*\)/g, " ")
		.replace(/\bat\s+\d{1,2}[:.]\d{2}(?:\s*(?:am|pm))?/gi, " ")
		.replace(/\bby\s+\d{1,2}[:.]\d{2}(?:\s*(?:am|pm))?/gi, " ")
		.trim());
}

function extractDeadline(text: string): Date | undefined {
	const datePattern = "((?:\\d{1,2}(?:st|nd|rd|th)?\\s+[A-Za-z]+|[A-Za-z]+\\s+\\d{1,2}(?:st|nd|rd|th)?),?\\s+\\d{4})";
	const patterns = [
		new RegExp(`\\bdeadline\\s+for\\s+(?:application|applications|submission|submissions)\\s+is\\s+${datePattern}`, "i"),
		new RegExp(`\\b(?:application|submission|proposal|tender|bid)\\s+deadline\\s*:?[\\s\\S]{0,80}?${datePattern}`, "i"),
		new RegExp(`\\b(?:deadline|closing date|due date)\\s*:?[\\s\\S]{0,80}?${datePattern}`, "i"),
		new RegExp(`\\b(?:no later than|must be submitted by|shall be submitted by|before)\\s+${datePattern}`, "i"),
	];
	for (const pattern of patterns) {
		const parsed = parseCandidateDate(text.match(pattern)?.[1]);
		if (parsed) return parsed;
	}
	return undefined;
}

function extractReference(text: string, documentLinks: Array<{ url: string; label?: string }>): string | undefined {
	const candidates = [
		...documentLinks.flatMap((link) => [
			link.label,
			decodeURIComponent(link.url).split("/").pop(),
		]),
		text,
	].filter((candidate): candidate is string => Boolean(candidate));
	for (const candidate of candidates) {
		const cleaned = candidate
			.replace(/\b\d+(?:\.\d+)?\s*(?:kb|mb|gb)\b/gi, " ")
			.replace(/\.(?:pdf|docx?|xlsx?|zip)\b/gi, " ");
		const match = cleaned.match(/\b(?:RFP|RFQ|ITB|PRF|EOI|BD)[-\s_][A-Z0-9]+(?:[-\s_/]+[A-Z0-9]+){1,8}\b/i);
		if (!match) continue;
		return match[0]
			.replace(/[\s_/]+/g, "-")
			.replace(/-+/g, "-")
			.toUpperCase();
	}
	return undefined;
}

function extractDocumentLinks(content: string, sourceUrl: string): Array<{ url: string; label?: string }> {
	const links: Array<{ url: string; label?: string }> = [];
	const seen = new Set<string>();
	for (const match of content.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
		const href = decodeHtmlEntities(match[1] ?? "");
		const label = stripHtml(match[2] ?? "").replace(/\b\d+(?:\.\d+)?\s*(?:KB|MB|GB)\b/gi, "").trim();
		if (!DOCUMENT_LINK_PATTERN.test(href) && !DOCUMENT_LINK_PATTERN.test(label)) continue;
		const url = absoluteUrl(href, sourceUrl);
		if (!url || seen.has(url)) continue;
		seen.add(url);
		links.push({
			url,
			...(label ? { label } : {}),
		});
	}
	return links;
}

function extractTitle(content: string): string | undefined {
	const title = stripHtml(content.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
	return title.length >= 6 ? title : undefined;
}

function extractArticleContent(content: string): string {
	return content.match(/<article\b[\s\S]*?<\/article>/i)?.[0]
		?? content.match(/<main\b[\s\S]*?<\/main>/i)?.[0]
		?? content;
}

function parseNrcTenderDetailHtml(content: string, sourceUrl: string): NrcTenderDetail {
	const article = extractArticleContent(content);
	const documentLinks = extractDocumentLinks(article, sourceUrl);
	const text = stripHtml(article);
	const summary = text
		.replace(/^.*?\bPublished\s+[^.]+/i, "")
		.slice(0, 1800)
		.trim();
	const deadline = extractDeadline(text);
	const reference = extractReference(text, documentLinks);
	return {
		title: extractTitle(article),
		publishedDate: extractPublishedDate(content),
		deadline,
		summary,
		documentLinks,
		reference,
	};
}

function opportunityType(title: string, description: string, detail: NrcTenderDetail | undefined): OpportunityData["opportunityType"] {
	const haystack = [
		title,
		description,
		detail?.summary,
		detail?.reference,
		...(detail?.documentLinks ?? []).flatMap((link) => [link.label, link.url]),
	].join(" ").toLowerCase();
	if (/\b(eoi|expression of interest)\b/.test(haystack)) return "eoi";
	if (/\b(rfp|request for proposals?|terms of reference|tor|consultancy|consultant)\b/.test(haystack)) return "rfp";
	return "tender";
}

function sourceIdFor(title: string, portalUrl: string, reference: string | undefined): string {
	if (reference) return `nrc-${slugify(reference) || "tender"}`;
	const pathname = new URL(portalUrl).pathname.replace(/^\/tender\/|\/$/g, "");
	return `nrc-${slugify(pathname || title) || "tender"}`;
}

function opportunityFromEntry(
	entry: NrcTenderSearchEntry,
	sourceUrl: string,
	detail: NrcTenderDetail | undefined,
	now: Date
): OpportunityData | undefined {
	const portalUrl = absoluteUrl(entry.pageUrl, sourceUrl);
	const title = cleanText(decodeHtmlEntities(detail?.title ?? entry.title ?? ""));
	if (!portalUrl || title.length < 6) return undefined;
	const deadline = detail?.deadline;
	if (isExpired(deadline, now)) return undefined;
	const description = stripHtml(entry.description ?? "");
	const publishedDate = detail?.publishedDate ?? parseNrcDate(entry.date);
	const documentUrl = detail?.documentLinks[0]?.url ?? portalUrl;
	const reference = detail?.reference;

	return {
		title,
		source: "nrc",
		sourceId: sourceIdFor(title, portalUrl, reference),
		noticeId: reference,
		organization: "Norwegian Refugee Council",
		category: description || "NRC tender",
		opportunityType: opportunityType(title, description, detail),
		publishedDate,
		deadline,
		portalUrl,
		documentUrl,
		rfpLink: documentUrl,
		projectSummary: detail?.summary || description || "Norwegian Refugee Council tender opportunity.",
		tags: ["nrc", "ngo", "source-api", "source-documents"],
		metadata: {
			nrc: {
				sourcePage: sourceUrl,
				portalUrl,
				reference,
				documentLinks: detail?.documentLinks ?? [],
				publishedDate: entry.date,
			},
		},
	};
}

export function parseNrcTenderSearchResponse(
	response: NrcTenderSearchResponse,
	sourceUrl = NRC_TENDERS_URL,
	detailsByUrl = new Map<string, NrcTenderDetail>(),
	now = new Date()
): OpportunityData[] {
	const seen = new Set<string>();
	const opportunities: OpportunityData[] = [];
	for (const entry of response.searchEntries ?? []) {
		const portalUrl = absoluteUrl(entry.pageUrl, sourceUrl);
		const opportunity = opportunityFromEntry(entry, sourceUrl, portalUrl ? detailsByUrl.get(portalUrl) : undefined, now);
		if (!opportunity?.sourceId || seen.has(opportunity.sourceId)) continue;
		seen.add(opportunity.sourceId);
		opportunities.push(opportunity);
	}
	return opportunities;
}

async function fetchNrcSearchPage(pageNumber: number): Promise<NrcTenderSearchResponse> {
	const response = await fetch(NRC_SEARCH_API_URL, {
		method: "POST",
		signal: AbortSignal.timeout(20000),
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			"User-Agent": "DocFusionRfpSourceCollector/1.0",
		},
		body: JSON.stringify({
			currentPageId: NRC_TENDER_PAGE_ID,
			categoryId: NRC_TENDER_CATEGORY_ID,
			sortByDate: true,
			pageNumber,
		}),
	});
	if (!response.ok) {
		throw new Error(`NRC tender search endpoint returned HTTP ${response.status}`);
	}
	return response.json() as Promise<NrcTenderSearchResponse>;
}

async function fetchNrcTenderDetail(portalUrl: string): Promise<NrcTenderDetail | undefined> {
	const response = await fetch(portalUrl, {
		method: "GET",
		signal: AbortSignal.timeout(20000),
		headers: {
			Accept: "text/html",
			"User-Agent": "DocFusionRfpSourceCollector/1.0",
		},
	});
	if (!response.ok) return undefined;
	return parseNrcTenderDetailHtml(await response.text(), portalUrl);
}

async function fetchNrcTenderOpportunities(sourceUrl: string): Promise<OpportunityData[]> {
	const responses: NrcTenderSearchResponse[] = [];
	let lastPage = 1;
	for (let page = 1; page <= Math.min(maxPages(), lastPage); page += 1) {
		const response = await fetchNrcSearchPage(page);
		responses.push(response);
		lastPage = typeof response.lastPage === "number" ? response.lastPage : lastPage;
	}

	const entries = responses.flatMap((response) => response.searchEntries ?? []).slice(0, detailLimit());
	const detailsByUrl = new Map<string, NrcTenderDetail>();
	for (const entry of entries) {
		const portalUrl = absoluteUrl(entry.pageUrl, sourceUrl);
		if (!portalUrl || detailsByUrl.has(portalUrl)) continue;
		const detail = await fetchNrcTenderDetail(portalUrl);
		if (detail) detailsByUrl.set(portalUrl, detail);
	}

	return responses.flatMap((response) => parseNrcTenderSearchResponse(response, sourceUrl, detailsByUrl));
}

export const nrcParser: TenderParser = {
	sourceId: "nrc",
	name: "Norwegian Refugee Council Tenders",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			const content = input.html ?? input.markdown;
			if (content?.trim().startsWith("{")) {
				const response = JSON.parse(content) as NrcTenderSearchResponse;
				return { opportunities: parseNrcTenderSearchResponse(response, input.url || NRC_TENDERS_URL) };
			}
			if (content && /\/tender\//i.test(new URL(input.url || NRC_TENDERS_URL).pathname)) {
				const detail = parseNrcTenderDetailHtml(content, input.url);
				const opportunity = opportunityFromEntry({
					title: detail.title,
					date: detail.publishedDate?.toISOString(),
					description: "NRC tender",
					pageUrl: input.url,
				}, input.url, detail, new Date());
				return { opportunities: opportunity ? [opportunity] : [] };
			}
			return { opportunities: await fetchNrcTenderOpportunities(input.url || NRC_TENDERS_URL) };
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch NRC tenders",
			};
		}
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || NRC_TENDERS_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(nrcParser);

export { parseNrcTenderDetailHtml };
