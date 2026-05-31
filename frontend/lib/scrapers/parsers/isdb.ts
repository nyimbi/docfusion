import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const ISDB_BASE_URL = "https://www.isdb.org";
export const ISDB_TENDERS_URL = `${ISDB_BASE_URL}/project-procurement/tenders`;
const DEFAULT_PAGE_LIMIT = 4;
const DEFAULT_DETAIL_LIMIT = 50;

type IsdbDocumentLink = {
	label?: string;
	url: string;
};

type IsdbListingRow = {
	title: string;
	portalUrl: string;
	sourceId?: string;
	status?: string;
	tenderType?: string;
	countryRegion?: string;
	deadline?: Date;
	deadlineText?: string;
};

type IsdbDetail = {
	noticeType?: string;
	issueDate?: Date;
	issueDateText?: string;
	deadline?: Date;
	deadlineText?: string;
	tenderType?: string;
	email?: string;
	summary?: string;
	documentLinks: IsdbDocumentLink[];
};

type IsdbOpportunity = OpportunityData & {
	portalUrl: string;
	metadata: {
		isdb: {
			status?: string;
			tenderType?: string;
			noticeType?: string;
			issueDateText?: string;
			deadlineText?: string;
			email?: string;
			documentLinks: IsdbDocumentLink[];
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

function absoluteIsdbUrl(rawUrl: string | undefined, sourceUrl = ISDB_TENDERS_URL): string | undefined {
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
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 100);
}

function fieldBlock(html: string, fieldName: string): string {
	const marker = `field--name-${fieldName}`;
	const markerIndex = html.indexOf(marker);
	if (markerIndex < 0) return "";
	const start = Math.max(0, html.lastIndexOf("<div", markerIndex));
	const next = html.indexOf("<div class=\"field field--name-", markerIndex + marker.length);
	return html.slice(start, next > start ? next : Math.min(html.length, start + 5000));
}

function fieldText(html: string, fieldName: string): string | undefined {
	const text = stripHtml(fieldBlock(html, fieldName));
	const withoutLabel = text.replace(/^(?:Notice Type|Issue Date|Last date of submission|Tender Type|Email|Documents)\s+/i, "").trim();
	return withoutLabel || undefined;
}

function fieldDate(html: string, fieldName: string): { date?: Date; text?: string } {
	const block = fieldBlock(html, fieldName);
	const datetime = attrValue(/<time\b([^>]*)>/i.exec(block)?.[1], "datetime");
	const text = stripHtml(/<time\b[^>]*>([\s\S]*?)<\/time>/i.exec(block)?.[1]) || fieldText(html, fieldName);
	return {
		date: parseIsdbDate(datetime ?? text),
		text: text || datetime || undefined,
	};
}

function monthNumber(value: string | undefined): number | undefined {
	const normalized = (value ?? "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/\.$/, "");
	const months: Record<string, number> = {
		january: 0, jan: 0, janvier: 0, janv: 0,
		february: 1, feb: 1, fevrier: 1, fevr: 1,
		march: 2, mar: 2, mars: 2,
		april: 3, apr: 3, avril: 3, avr: 3,
		may: 4, mai: 4,
		june: 5, jun: 5, juin: 5,
		july: 6, jul: 6, juillet: 6, juil: 6,
		august: 7, aug: 7, aout: 7,
		september: 8, sept: 8, sep: 8, septembre: 8,
		october: 9, oct: 9, octobre: 9,
		november: 10, nov: 10, novembre: 10,
		december: 11, dec: 11, decembre: 11,
	};
	return months[normalized];
}

function parseIsdbDate(value: string | undefined): Date | undefined {
	const cleaned = stripHtml(value)
		.replace(/(\d{1,2})(?:st|nd|rd|th)\b/gi, "$1")
		.replace(/\s+/g, " ")
		.trim();
	if (!cleaned || cleaned === "00Z") return undefined;
	const iso = /\b(\d{4})-(\d{2})-(\d{2})/.exec(cleaned);
	if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0));
	const dayMonthYear = /\b(\d{1,2})\s+([A-Za-zÀ-ÿ.]+)\s+(\d{4})\b/i.exec(cleaned);
	if (dayMonthYear) {
		const month = monthNumber(dayMonthYear[2]);
		if (month !== undefined) {
			return new Date(Date.UTC(Number(dayMonthYear[3]), month, Number(dayMonthYear[1]), 12, 0, 0));
		}
	}
	const parsed = new Date(cleaned);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function isDocumentUrl(url: string): boolean {
	try {
		return /\.(?:pdf|docx?|xlsx?|zip|rar)(?:$|[?#])/i.test(new URL(url).pathname);
	} catch {
		return /\.(?:pdf|docx?|xlsx?|zip|rar)(?:$|[?#])/i.test(url);
	}
}

function collectDocumentLinks(html: string, sourceUrl: string): IsdbDocumentLink[] {
	const links: IsdbDocumentLink[] = [];
	const seen = new Set<string>();
	for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
		const url = absoluteIsdbUrl(attrValue(match[1], "href"), sourceUrl);
		if (!url || seen.has(url) || !isDocumentUrl(url)) continue;
		seen.add(url);
		links.push({ label: stripHtml(match[2]) || undefined, url });
	}
	return links;
}

function isTenderLike(tenderType: string | undefined): boolean {
	const normalized = (tenderType ?? "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
	return !/contract award|attribution des marches/.test(normalized);
}

function inferOpportunityType(tenderType: string | undefined, title: string): OpportunityData["opportunityType"] {
	const haystack = `${tenderType ?? ""} ${title}`.toLowerCase();
	if (/expression of interest|\beoi\b|manifestation/.test(haystack)) return "eoi";
	if (/general procurement notice|\bgpn\b|specific procurement notice|\bspn\b|pre-qualification|\bpqn\b|tender|bid/.test(haystack)) return "tender";
	return "rfp";
}

function sourceIdFrom(row: IsdbListingRow): string {
	const pathSlug = (() => {
		try {
			return new URL(row.portalUrl).pathname.split("/").filter(Boolean).pop();
		} catch {
			return undefined;
		}
	})();
	return `isdb-${slugify(row.sourceId ?? pathSlug ?? row.title) || "tender"}`;
}

function opportunityFromRow(row: IsdbListingRow, detail?: IsdbDetail): IsdbOpportunity {
	const documentLinks = detail?.documentLinks ?? [];
	const tenderType = detail?.tenderType ?? row.tenderType;
	const deadline = detail?.deadline ?? row.deadline;
	const deadlineText = detail?.deadlineText ?? row.deadlineText;
	return {
		title: row.title,
		source: "isdb",
		sourceId: sourceIdFrom(row),
		noticeId: row.sourceId,
		organization: "Islamic Development Bank (IsDB)",
		countryRegion: row.countryRegion ?? "Global South / IsDB member countries",
		category: tenderType ?? "Project procurement",
		opportunityType: inferOpportunityType(tenderType, row.title),
		publishedDate: detail?.issueDate,
		deadline,
		portalUrl: row.portalUrl,
		documentUrl: documentLinks[0]?.url ?? row.portalUrl,
		rfpLink: documentLinks[0]?.url ?? row.portalUrl,
		projectSummary: [
			detail?.noticeType ? `Notice type: ${detail.noticeType}` : undefined,
			row.status ? `Status: ${row.status}` : undefined,
			deadlineText ? `Last date of submission: ${deadlineText}` : undefined,
			detail?.summary,
			documentLinks.length > 0 ? `${documentLinks.length} linked procurement document(s) found.` : undefined,
		].filter(Boolean).join("; ") || "IsDB project procurement notice.",
		submissionMethod: detail?.email
			? `Use the IsDB notice instructions; contact/submission email: ${detail.email}.`
			: "Use the IsDB notice and linked procurement documents for submission instructions.",
		tags: ["isdb", "development-bank", "global-south", "project-procurement", "source-documents"],
		metadata: {
			isdb: {
				status: row.status,
				tenderType,
				noticeType: detail?.noticeType,
				issueDateText: detail?.issueDateText,
				deadlineText,
				email: detail?.email,
				documentLinks,
			},
		},
	};
}

export function parseIsdbTendersHtml(html: string, sourceUrl = ISDB_TENDERS_URL): IsdbListingRow[] {
	const rows: IsdbListingRow[] = [];
	const seen = new Set<string>();
	for (const match of html.matchAll(/<article\b(?=[^>]*\btype-tender\b)([^>]*)>([\s\S]*?)<\/article>/gi)) {
		const attrs = match[1] ?? "";
		const article = match[0] ?? match[2] ?? "";
		const titleMatch = /<h2\b[^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(article);
		const portalUrl = absoluteIsdbUrl(attrValue(titleMatch?.[1], "href") ?? attrValue(attrs, "about"), sourceUrl);
		const title = stripHtml(titleMatch?.[2]);
		if (!portalUrl || !title || seen.has(portalUrl)) continue;
		const tenderType = fieldText(article, "field-tender-type");
		if (!isTenderLike(tenderType)) continue;
		const deadlineText = stripHtml(/field--name-field-close-date[\s\S]*?<time\b[^>]*>([\s\S]*?)<\/time>/i.exec(article)?.[1]) || undefined;
		seen.add(portalUrl);
		rows.push({
			title,
			portalUrl,
			sourceId: attrValue(attrs, "data-nid"),
			status: fieldText(article, "field-tender-status"),
			tenderType,
			countryRegion: fieldText(article, "field-world-country"),
			deadline: parseIsdbDate(deadlineText),
			deadlineText,
		});
	}
	return rows;
}

export function parseIsdbTenderDetailHtml(html: string, sourceUrl: string): IsdbDetail {
	const issue = fieldDate(html, "field-issue-date");
	const deadline = fieldDate(html, "field-close-date");
	return {
		noticeType: fieldText(html, "field-notice-type"),
		issueDate: issue.date,
		issueDateText: issue.text,
		deadline: deadline.date,
		deadlineText: deadline.text,
		tenderType: fieldText(html, "field-tender-type"),
		email: fieldText(html, "field-email"),
		summary: stripHtml(fieldBlock(html, "field-description")).slice(0, 1200) || undefined,
		documentLinks: collectDocumentLinks(fieldBlock(html, "field-documents") || html, sourceUrl),
	};
}

function pageLimit(): number {
	const parsed = Number(process.env.ISDB_PAGE_LIMIT ?? DEFAULT_PAGE_LIMIT);
	if (!Number.isFinite(parsed)) return DEFAULT_PAGE_LIMIT;
	return Math.min(20, Math.max(1, Math.trunc(parsed)));
}

function detailLimit(): number {
	const parsed = Number(process.env.ISDB_DETAIL_LIMIT ?? DEFAULT_DETAIL_LIMIT);
	if (!Number.isFinite(parsed)) return DEFAULT_DETAIL_LIMIT;
	return Math.min(100, Math.max(0, Math.trunc(parsed)));
}

function maxPagesFromHtml(html: string): number | undefined {
	const pages = [...html.matchAll(/href=["'][^"']*[?&]page=(\d+)/gi)]
		.map((match) => Number(match[1]))
		.filter(Number.isFinite);
	return pages.length > 0 ? Math.max(...pages) + 1 : undefined;
}

function pageUrlFor(baseUrl: string, page: number): string {
	const url = new URL(baseUrl || ISDB_TENDERS_URL);
	if (page <= 1) {
		url.searchParams.delete("page");
	} else {
		url.searchParams.set("page", String(page - 1));
	}
	url.hash = "";
	return url.toString();
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
		throw new Error(`IsDB tender fetch failed: ${response.status} ${response.statusText}`);
	}
	return response.text();
}

async function fetchIsdbOpportunities(sourceUrl: string): Promise<IsdbOpportunity[]> {
	const rows: IsdbListingRow[] = [];
	const seenRows = new Set<string>();
	let lastPage = pageLimit();
	for (let page = 1; page <= Math.min(pageLimit(), lastPage); page++) {
		const pageUrl = pageUrlFor(sourceUrl || ISDB_TENDERS_URL, page);
		const html = await fetchHtml(pageUrl);
		lastPage = Math.min(pageLimit(), maxPagesFromHtml(html) ?? lastPage);
		const pageRows = parseIsdbTendersHtml(html, pageUrl);
		if (pageRows.length === 0) break;
		for (const row of pageRows) {
			if (seenRows.has(row.portalUrl)) continue;
			seenRows.add(row.portalUrl);
			rows.push(row);
		}
	}

	const details = await Promise.all(rows.slice(0, detailLimit()).map(async (row) => {
		try {
			return parseIsdbTenderDetailHtml(await fetchHtml(row.portalUrl), row.portalUrl);
		} catch {
			return undefined;
		}
	}));
	return rows.map((row, index) => opportunityFromRow(row, details[index]));
}

export const isdbParser: TenderParser = {
	sourceId: "isdb",
	name: "IsDB Project Procurement Tenders",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		if (!input.html?.trim() && !input.markdown?.trim() && input.url) {
			return { opportunities: await fetchIsdbOpportunities(input.url) };
		}
		const rows = parseIsdbTendersHtml(input.html ?? input.markdown ?? "", input.url);
		return { opportunities: rows.map((row) => opportunityFromRow(row)) };
	},

	getPageUrl(baseUrl: string, page: number): string {
		return pageUrlFor(baseUrl || ISDB_TENDERS_URL, page);
	},

	hasNextPage(input: ParseInput, currentPage: number): boolean {
		const html = input.html ?? input.markdown ?? "";
		return currentPage < Math.min(pageLimit(), maxPagesFromHtml(html) ?? currentPage);
	},
};

registerParser(isdbParser);
