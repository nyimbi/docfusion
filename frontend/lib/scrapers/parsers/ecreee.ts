import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const ECREEE_BASE_URL = "https://www.ecreee.org";
export const ECREEE_PROCUREMENT_URL = `${ECREEE_BASE_URL}/category/procurement-notices/`;
const DEFAULT_DETAIL_LIMIT = 25;
const DEFAULT_PAGE_LIMIT = 3;
const DEFAULT_MAX_AGE_DAYS = 730;

type EcreeeDocumentLink = {
	label?: string;
	url: string;
};

type EcreeeListingRow = {
	title: string;
	portalUrl: string;
	publishedDate?: Date;
	publishedDateText?: string;
	summary?: string;
	sourceUrl: string;
};

type EcreeeDetail = {
	title?: string;
	procurementId?: string;
	deadline?: Date;
	deadlineText?: string;
	publishedDate?: Date;
	publishedDateText?: string;
	summary?: string;
	documentLinks: EcreeeDocumentLink[];
};

type EcreeeOpportunity = OpportunityData & {
	portalUrl: string;
	metadata: {
		ecreee: {
			procurementId?: string;
			deadlineText?: string;
			publishedDateText?: string;
			sourceUrl: string;
			documentLinks: EcreeeDocumentLink[];
		};
	};
};

function decodeEntities(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, codepoint: string) => String.fromCodePoint(Number(codepoint)))
		.replace(/&#x([0-9a-f]+);/gi, (_, codepoint: string) => String.fromCodePoint(Number.parseInt(codepoint, 16)))
		.replace(/&nbsp;|&#160;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, "\"")
		.replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi, "-");
}

function stripHtml(value: string | undefined): string {
	if (!value) return "";
	return cleanText(decodeEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>|<\/span>|<\/td>|<\/tr>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function absoluteEcreeeUrl(rawUrl: string | undefined, sourceUrl = ECREEE_PROCUREMENT_URL): string | undefined {
	const cleaned = decodeEntities(rawUrl ?? "").trim();
	if (!cleaned || /^javascript:/i.test(cleaned) || /^mailto:/i.test(cleaned)) return undefined;
	try {
		const url = new URL(cleaned, sourceUrl);
		if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
		url.hash = "";
		return url.toString();
	} catch {
		return undefined;
	}
}

function attrValue(attributes: string | undefined, name: string): string | undefined {
	const match = new RegExp(`${name}=["']([^"']+)["']`, "i").exec(attributes ?? "");
	return match?.[1] ? decodeEntities(match[1]).trim() : undefined;
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 90);
}

function monthNumber(value: string | undefined): number | undefined {
	const months: Record<string, number> = {
		jan: 0, january: 0,
		feb: 1, february: 1,
		mar: 2, march: 2,
		apr: 3, april: 3,
		may: 4,
		jun: 5, june: 5,
		jul: 6, july: 6,
		aug: 7, august: 7,
		sep: 8, sept: 8, september: 8,
		oct: 9, october: 9,
		nov: 10, november: 10,
		dec: 11, december: 11,
	};
	return months[(value ?? "").toLowerCase()];
}

function parseEcreeeDate(value: string | undefined): Date | undefined {
	const cleaned = stripHtml(value)
		.replace(/^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+/i, "")
		.replace(/(\d{1,2})(?:st|nd|rd|th)\b/gi, "$1")
		.replace(/\s+/g, " ")
		.trim();
	if (!cleaned) return undefined;
	const timeMatch = /\b(\d{1,2})(?::(\d{2}))\s*(AM|PM)?\b/i.exec(cleaned);
	const monthDayYear = /\b([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/i.exec(cleaned);
	const dayMonthYear = /\b(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})\b/i.exec(cleaned);
	const isoDate = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(cleaned);
	const day = Number(monthDayYear?.[2] ?? dayMonthYear?.[1] ?? isoDate?.[3]);
	const month = monthDayYear || dayMonthYear
		? monthNumber(monthDayYear?.[1] ?? dayMonthYear?.[2])
		: isoDate ? Number(isoDate[2]) - 1 : undefined;
	const year = Number(monthDayYear?.[3] ?? dayMonthYear?.[3] ?? isoDate?.[1]);
	if (month === undefined || !Number.isFinite(day) || !Number.isFinite(year)) {
		const parsed = new Date(cleaned);
		return Number.isNaN(parsed.getTime()) ? undefined : parsed;
	}
	let hour = Number(timeMatch?.[1] ?? "23");
	const minute = Number(timeMatch?.[2] ?? "59");
	const ampm = (timeMatch?.[3] ?? "").toLowerCase();
	if (ampm === "pm" && hour < 12) hour += 12;
	if (ampm === "am" && hour === 12) hour = 0;
	if (!Number.isFinite(hour) || hour > 23 || !Number.isFinite(minute) || minute > 59) {
		hour = 23;
	}
	return new Date(Date.UTC(year, month, day, hour + 1, Number.isFinite(minute) ? minute : 59));
}

function utcStartOfDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isExpired(deadline: Date | undefined, now = new Date()): boolean {
	return Boolean(deadline && deadline.getTime() < utcStartOfDay(now).getTime());
}

function isStalePublishedDate(publishedDate: Date | undefined, now = new Date()): boolean {
	if (!publishedDate) return false;
	const maxAgeDays = Number(process.env.ECREEE_MAX_AGE_DAYS ?? DEFAULT_MAX_AGE_DAYS);
	const boundedMaxAge = Number.isFinite(maxAgeDays) ? Math.max(30, Math.trunc(maxAgeDays)) : DEFAULT_MAX_AGE_DAYS;
	return publishedDate.getTime() < now.getTime() - boundedMaxAge * 24 * 60 * 60 * 1000;
}

function detailLimit(): number {
	const parsed = Number(process.env.ECREEE_DETAIL_LIMIT ?? DEFAULT_DETAIL_LIMIT);
	if (!Number.isFinite(parsed)) return DEFAULT_DETAIL_LIMIT;
	return Math.min(75, Math.max(0, Math.trunc(parsed)));
}

function pageLimit(): number {
	const parsed = Number(process.env.ECREEE_PAGE_LIMIT ?? DEFAULT_PAGE_LIMIT);
	if (!Number.isFinite(parsed)) return DEFAULT_PAGE_LIMIT;
	return Math.min(12, Math.max(1, Math.trunc(parsed)));
}

function sourceIdFromUrl(portalUrl: string, title: string): string {
	const pathSlug = (() => {
		try {
			return new URL(portalUrl).pathname.split("/").filter(Boolean).pop();
		} catch {
			return undefined;
		}
	})();
	return `ecreee-${slugify(pathSlug ?? title) || "procurement-notice"}`;
}

function inferCategory(title: string, summary?: string): string {
	const haystack = `${title} ${summary ?? ""}`.toLowerCase();
	if (/expression of interest|\beoi\b/.test(haystack)) return "Expression of interest";
	if (/consultancy|consultant|specialist|assistant|expert/.test(haystack)) return "Consultancy";
	if (/request for quotation|\brfq\b|quotation/.test(haystack)) return "Request for quotation";
	if (/grant/.test(haystack)) return "Grant";
	return "Tender";
}

function inferOpportunityType(category: string): OpportunityData["opportunityType"] {
	if (category === "Expression of interest") return "eoi";
	if (category === "Consultancy") return "rfp";
	if (category === "Grant") return "grant";
	return "tender";
}

function publishedDateFromArticle(article: string): { publishedDate?: Date; publishedDateText?: string } {
	const datetime = attrValue(/<time\b([^>]*)>/i.exec(article)?.[1], "datetime");
	const dateText = stripHtml(/<i\b[^>]*class=["'][^"']*\bfa-calendar\b[^"']*["'][^>]*><\/i>\s*([^<]+)/i.exec(article)?.[1]
		?? /<time\b[^>]*>([\s\S]*?)<\/time>/i.exec(article)?.[1]);
	return {
		publishedDate: parseEcreeeDate(datetime ?? dateText),
		publishedDateText: dateText || datetime || undefined,
	};
}

export function parseEcreeeProcurementListingHtml(html: string, sourceUrl = ECREEE_PROCUREMENT_URL, now = new Date()): EcreeeListingRow[] {
	const rows: EcreeeListingRow[] = [];
	const seen = new Set<string>();
	for (const match of html.matchAll(/<article\b(?=[^>]*\bcategory-procurement-notices\b)[^>]*>([\s\S]*?)<\/article>/gi)) {
		const article = match[0] ?? match[1] ?? "";
		const titleMatch = /<h3\b[^>]*class=["'][^"']*\bentry-title\b[^"']*["'][^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(article)
			?? /<h[1-6]\b[^>]*class=["'][^"']*\bentry-title\b[^"']*["'][^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(article);
		const portalUrl = absoluteEcreeeUrl(attrValue(titleMatch?.[1], "href"), sourceUrl);
		const title = stripHtml(titleMatch?.[2]);
		if (!portalUrl || !title || seen.has(portalUrl)) continue;
		const { publishedDate, publishedDateText } = publishedDateFromArticle(article);
		if (isStalePublishedDate(publishedDate, now)) continue;
		const summary = stripHtml(/<div\b[^>]*class=["'][^"']*\bentry-content\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(article)?.[1]) || undefined;
		seen.add(portalUrl);
		rows.push({ title, portalUrl, publishedDate, publishedDateText, summary, sourceUrl });
	}
	return rows;
}

function articleBodyHtml(html: string): string {
	return /<div\b[^>]*class=["'][^"']*\bentry-content\b[^"']*\bdefault-page\b[^"']*["'][^>]*>([\s\S]*?)<div class=["']clearfix["']/i.exec(html)?.[1]
		?? /<div\b[^>]*class=["'][^"']*\bentry-content\b[^"']*["'][^>]*>([\s\S]*?)(?:<div class=["']clearfix["']|<\/article>)/i.exec(html)?.[1]
		?? "";
}

function procurementIdFromDetail(html: string): string | undefined {
	const field = /field-name-field-procurement-id[\s\S]*?<div class=["']field-item[^"']*["']>([\s\S]*?)<\/div>/i.exec(html)?.[1];
	return stripHtml(field) || undefined;
}

function deadlineTextFromDetail(html: string, bodyText: string): string | undefined {
	const field = /field-name-field-procurment-dead-line[\s\S]*?(?:date-display-single["'][^>]*>|field-item[^>]*>)([\s\S]*?)(?:<\/span>|<\/div>)/i.exec(html)?.[1];
	const structured = stripHtml(field);
	if (structured) return structured;
	const patterns = [
		/\bdeadline\s*(?::|is|for submission is)?\s*([A-Za-z]+ \d{1,2},?\s+\d{4}(?:\s*(?:-|at|by|before|,)?\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)?)/i,
		/\bdeadline\s*(?::|is|for submission is)?\s*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+\d{4}(?:\s*(?:-|at|by|before|,)?\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)?)/i,
		/\b(?:no later than|latest)\s+([A-Za-z]+ \d{1,2},?\s+\d{4}(?:\s*(?:-|at|by|before|,)?\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)?)/i,
		/\b(?:no later than|latest)\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+\d{4}(?:\s*(?:-|at|by|before|,)?\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)?)/i,
	];
	for (const pattern of patterns) {
		const match = pattern.exec(bodyText);
		const text = stripHtml(match?.[1]);
		if (text) return text;
	}
	return undefined;
}

function documentLinksFromDetail(html: string, sourceUrl: string): EcreeeDocumentLink[] {
	const body = articleBodyHtml(html) || html;
	const links: EcreeeDocumentLink[] = [];
	const seen = new Set<string>();
	for (const match of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
		const url = absoluteEcreeeUrl(attrValue(match[1] ?? "", "href"), sourceUrl);
		if (!url || seen.has(url)) continue;
		const pathname = new URL(url).pathname;
		if (!/\.(?:pdf|docx?|xlsx?|zip)(?:$|[?#])/i.test(pathname)) continue;
		seen.add(url);
		links.push({ label: stripHtml(match[2] ?? "") || undefined, url });
	}
	return links;
}

function summaryFromDetail(bodyHtml: string): string | undefined {
	const summary = stripHtml(bodyHtml).replace(/\s+/g, " ").trim();
	return summary ? summary.slice(0, 1400) : undefined;
}

export function parseEcreeeProcurementDetailHtml(html: string, sourceUrl: string, now = new Date()): EcreeeDetail | undefined {
	const title = stripHtml(/<h1\b[^>]*class=["'][^"']*\bentry-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]
		?? /<title\b[^>]*>([\s\S]*?)(?:\s+[-|]\s+ECREEE|<\/title>)/i.exec(html)?.[1]);
	if (!title) return undefined;
	const bodyHtml = articleBodyHtml(html);
	const bodyText = stripHtml(bodyHtml);
	const deadlineText = deadlineTextFromDetail(html, bodyText);
	const deadline = parseEcreeeDate(deadlineText);
	if (isExpired(deadline, now)) return undefined;
	const timeMatch = /<time\b([^>]*)class=["'][^"']*\bentry-date\b[^"']*["']([^>]*)>([\s\S]*?)<\/time>/i.exec(html);
	const publishedDateText = attrValue(`${timeMatch?.[1] ?? ""} ${timeMatch?.[2] ?? ""}`, "datetime")
		?? stripHtml(timeMatch?.[3]);
	return {
		title,
		procurementId: procurementIdFromDetail(html),
		deadline,
		deadlineText,
		publishedDate: parseEcreeeDate(publishedDateText),
		publishedDateText: publishedDateText || undefined,
		summary: summaryFromDetail(bodyHtml),
		documentLinks: documentLinksFromDetail(html, sourceUrl),
	};
}

function opportunityFromRow(row: EcreeeListingRow, detail?: EcreeeDetail): EcreeeOpportunity {
	const title = detail?.title ?? row.title;
	const summary = detail?.summary ?? row.summary;
	const category = inferCategory(title, summary);
	const documentLinks = detail?.documentLinks ?? [];
	const primaryDocument = documentLinks.find((link) => /\b(?:tor|terms|rfp|rfq|request|expression|eoi|bid|quotation)\b/i.test(`${link.label ?? ""} ${link.url}`))
		?? documentLinks[0];
	const sourceId = sourceIdFromUrl(row.portalUrl, title);
	return {
		title,
		source: "ecreee",
		sourceId,
		noticeId: detail?.procurementId ?? sourceId.replace(/^ecreee-/, ""),
		organization: "ECOWAS Centre for Renewable Energy and Energy Efficiency",
		countryRegion: "West Africa",
		category,
		opportunityType: inferOpportunityType(category),
		deadline: detail?.deadline,
		publishedDate: detail?.publishedDate ?? row.publishedDate,
		portalUrl: row.portalUrl,
		documentUrl: primaryDocument?.url ?? row.portalUrl,
		rfpLink: primaryDocument?.url ?? row.portalUrl,
		projectSummary: [
			detail?.procurementId ? `Procurement ID: ${detail.procurementId}` : undefined,
			(detail?.deadlineText) ? `Deadline: ${detail.deadlineText}` : undefined,
			(detail?.publishedDateText ?? row.publishedDateText) ? `Published: ${detail?.publishedDateText ?? row.publishedDateText}` : undefined,
			summary,
			documentLinks.length > 0 ? `${documentLinks.length} linked procurement document(s) found.` : undefined,
		].filter(Boolean).join("; ") || "ECREEE procurement opportunity.",
		submissionMethod: "Use the ECREEE procurement notice and linked documents for submission instructions.",
		tags: ["ecreee", "ecowas", "west-africa", "renewable-energy", "source-documents"],
		metadata: {
			ecreee: {
				procurementId: detail?.procurementId,
				deadlineText: detail?.deadlineText,
				publishedDateText: detail?.publishedDateText ?? row.publishedDateText,
				sourceUrl: row.sourceUrl,
				documentLinks,
			},
		},
	};
}

async function fetchHtml(url: string): Promise<string> {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(30000),
		headers: {
			"Accept": "text/html,application/xhtml+xml",
			"User-Agent": "Mozilla/5.0 (compatible; LindelaOpportunityDiscovery/1.0; +https://lindela.io)",
		},
	});
	if (!response.ok) {
		throw new Error(`ECREEE procurement fetch failed: ${response.status} ${response.statusText}`);
	}
	return response.text();
}

function listingUrlsFor(sourceUrl: string): string[] {
	try {
		const url = new URL(sourceUrl || ECREEE_PROCUREMENT_URL);
		if (!url.pathname.startsWith("/category/procurement-notices")) return [url.toString()];
		if (/\/page\/\d+\/?$/.test(url.pathname)) return [url.toString()];
		const urls = [url.toString()];
		for (let page = 2; page <= pageLimit(); page += 1) {
			urls.push(new URL(`/category/procurement-notices/page/${page}/`, ECREEE_BASE_URL).toString());
		}
		return urls;
	} catch {
		return [ECREEE_PROCUREMENT_URL];
	}
}

async function fetchEcreeeOpportunities(sourceUrl: string): Promise<EcreeeOpportunity[]> {
	const listings = await Promise.all(listingUrlsFor(sourceUrl).map(async (url) => ({
		url,
		html: await fetchHtml(url),
	})));
	const rows: EcreeeListingRow[] = [];
	const seen = new Set<string>();
	for (const listing of listings) {
		for (const row of parseEcreeeProcurementListingHtml(listing.html, listing.url)) {
			if (seen.has(row.portalUrl)) continue;
			seen.add(row.portalUrl);
			rows.push(row);
		}
	}
	const limit = detailLimit();
	if (limit <= 0 || rows.length === 0) return rows.map((row) => opportunityFromRow(row));
	const details = await Promise.all(rows.slice(0, limit).map(async (row) => {
		try {
			return { fetched: true, detail: parseEcreeeProcurementDetailHtml(await fetchHtml(row.portalUrl), row.portalUrl) };
		} catch {
			return { fetched: false, detail: undefined };
		}
	}));
	return rows
		.filter((_row, index) => index >= limit || !details[index]?.fetched || Boolean(details[index]?.detail))
		.map((row, index) => opportunityFromRow(row, details[index]?.detail))
		.filter((opportunity) => !isStalePublishedDate(opportunity.publishedDate instanceof Date ? opportunity.publishedDate : parseEcreeeDate(String(opportunity.publishedDate ?? ""))));
}

export const ecreeeParser: TenderParser = {
	sourceId: "ecreee",
	name: "ECREEE Procurement Notices",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		const sourceUrl = input.url || ECREEE_PROCUREMENT_URL;
		if (!input.html?.trim() && !input.markdown?.trim() && sourceUrl) {
			if (!safePath(sourceUrl).startsWith("/category/procurement-notices")) {
				const detail = parseEcreeeProcurementDetailHtml(await fetchHtml(sourceUrl), sourceUrl);
				return {
					opportunities: detail ? [opportunityFromRow({
						title: detail.title ?? "ECREEE procurement opportunity",
						portalUrl: sourceUrl,
						publishedDate: detail.publishedDate,
						publishedDateText: detail.publishedDateText,
						sourceUrl,
					}, detail)] : [],
				};
			}
			return { opportunities: await fetchEcreeeOpportunities(sourceUrl) };
		}
		const content = input.html ?? input.markdown ?? "";
		if (/single-post|post-attachments|field-name-field-procurment-dead-line|<h1\b[^>]*entry-title/i.test(content)) {
			const detail = parseEcreeeProcurementDetailHtml(content, sourceUrl);
			return {
				opportunities: detail ? [opportunityFromRow({
					title: detail.title ?? "ECREEE procurement opportunity",
					portalUrl: sourceUrl,
					publishedDate: detail.publishedDate,
					publishedDateText: detail.publishedDateText,
					sourceUrl,
				}, detail)] : [],
			};
		}
		return {
			opportunities: parseEcreeeProcurementListingHtml(content, sourceUrl).map((row) => opportunityFromRow(row)),
		};
	},

	getPageUrl(baseUrl: string, page: number): string {
		if (page <= 1) return baseUrl || ECREEE_PROCUREMENT_URL;
		return `${ECREEE_PROCUREMENT_URL}page/${page}/`;
	},

	hasNextPage(input: ParseInput, currentPage: number): boolean {
		return currentPage < pageLimit() && /class=["']page-numbers["']|\/category\/procurement-notices\/page\//i.test(input.html ?? input.markdown ?? "");
	},
};

function safePath(sourceUrl: string): string {
	try {
		return new URL(sourceUrl).pathname;
	} catch {
		return "";
	}
}

registerParser(ecreeeParser);
