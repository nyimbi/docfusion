import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const SADC_BASE_URL = "https://www.sadc.int";
export const SADC_PROCUREMENT_URL = `${SADC_BASE_URL}/procurement-opportunities`;
const DEFAULT_DETAIL_LIMIT = 25;

type SadcDocumentLink = {
	label?: string;
	url: string;
};

type SadcListingRow = {
	title: string;
	portalUrl: string;
	deadline?: Date;
	deadlineText?: string;
};

type SadcDetail = {
	title?: string;
	reference?: string;
	deadline?: Date;
	deadlineText?: string;
	closingTimeText?: string;
	summary?: string;
	documentLinks: SadcDocumentLink[];
};

type SadcOpportunity = OpportunityData & {
	portalUrl: string;
	metadata: {
		sadc: {
			reference?: string;
			deadlineText?: string;
			closingTimeText?: string;
			documentLinks: SadcDocumentLink[];
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
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&ndash;|&mdash;/gi, "-");
}

function stripHtml(value: string | undefined): string {
	if (!value) return "";
	return cleanText(decodeEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>|<\/span>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function absoluteSadcUrl(rawUrl: string | undefined): string | undefined {
	const cleaned = decodeEntities(rawUrl ?? "").trim();
	if (!cleaned || /^javascript:/i.test(cleaned) || /^mailto:/i.test(cleaned)) return undefined;
	try {
		const url = new URL(cleaned, SADC_BASE_URL);
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

function parseTime(value: string | undefined): { hour: number; minute: number } | undefined {
	const match = value?.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\b/i);
	if (!match) return undefined;
	let hour = Number(match[1]);
	const minute = Number(match[2] ?? "0");
	const ampm = (match[3] ?? "").toLowerCase();
	if (ampm === "pm" && hour < 12) hour += 12;
	if (ampm === "am" && hour === 12) hour = 0;
	if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return undefined;
	return { hour, minute };
}

function parseSadcDate(value: string | undefined, timeText?: string): Date | undefined {
	const cleaned = stripHtml(value).replace(/\s+/g, " ").trim();
	if (!cleaned) return undefined;
	const monthDayYear = /\b([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\b/i.exec(cleaned);
	const dayMonthYear = /\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/i.exec(cleaned);
	const listingMonth = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/i.exec(cleaned);
	const day = Number(monthDayYear?.[2] ?? dayMonthYear?.[1] ?? listingMonth?.[1]);
	const month = monthNumber(monthDayYear?.[1] ?? dayMonthYear?.[2] ?? listingMonth?.[2]);
	const year = Number(monthDayYear?.[3] ?? dayMonthYear?.[3] ?? listingMonth?.[3]);
	if (month === undefined || !Number.isFinite(day) || !Number.isFinite(year)) {
		const parsed = new Date(cleaned);
		return Number.isNaN(parsed.getTime()) ? undefined : parsed;
	}
	const time = parseTime(timeText) ?? { hour: 23, minute: 59 };
	return new Date(Date.UTC(year, month, day, time.hour - 2, time.minute));
}

function utcStartOfDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isExpired(deadline: Date | undefined, now = new Date()): boolean {
	return Boolean(deadline && deadline.getTime() < utcStartOfDay(now).getTime());
}

function referenceFrom(text: string): string | undefined {
	return /\bSADC\/[A-Z0-9/.-]+\b/i.exec(text)?.[0];
}

function inferCategory(title: string, summary: string | undefined): string {
	const haystack = `${title} ${summary ?? ""}`.toLowerCase();
	if (/general procurement notice|\bgpn\b/.test(haystack)) return "General procurement notice";
	if (/expression of interest|\breoi\b|\beoi\b/.test(haystack)) return "Expression of interest";
	if (/consultancy|consultant/.test(haystack)) return "Consultancy";
	return "Tender";
}

function inferOpportunityType(category: string): OpportunityData["opportunityType"] {
	if (category === "Expression of interest") return "eoi";
	if (category === "Consultancy") return "rfp";
	return "tender";
}

function detailLimit(): number {
	const parsed = Number(process.env.SADC_DETAIL_LIMIT ?? DEFAULT_DETAIL_LIMIT);
	if (!Number.isFinite(parsed)) return DEFAULT_DETAIL_LIMIT;
	return Math.min(75, Math.max(0, Math.trunc(parsed)));
}

export function parseSadcProcurementListingHtml(html: string, now = new Date()): SadcListingRow[] {
	const rows: SadcListingRow[] = [];
	const seen = new Set<string>();
	for (const match of html.matchAll(/<div\b[^>]*class=["'][^"']*\bgrid-item\b[^"']*["'][^>]*>([\s\S]*?)(?=<div\b[^>]*class=["'][^"']*\bgrid-item\b|$)/gi)) {
		const card = match[1] ?? "";
		const day = stripHtml(/views-field-field-closing-date date-large[\s\S]*?<div class=["']field-content["']>([\s\S]*?)<\/div>/i.exec(card)?.[1]);
		const monthYear = stripHtml(/views-field-field-closing-date-1 date-small[\s\S]*?<div class=["']field-content["']>([\s\S]*?)<\/div>/i.exec(card)?.[1]);
		const titleMatch = /views-field-title[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(card);
		const portalUrl = absoluteSadcUrl(attrValue(titleMatch?.[1], "href"));
		const title = stripHtml(titleMatch?.[2]);
		if (!portalUrl || !title || seen.has(portalUrl)) continue;
		const deadlineText = `${day} ${monthYear}`.trim();
		const deadline = parseSadcDate(deadlineText);
		if (isExpired(deadline, now)) continue;
		seen.add(portalUrl);
		rows.push({ title, portalUrl, deadline, deadlineText });
	}
	return rows;
}

function documentLinksFromDetail(html: string): SadcDocumentLink[] {
	const field = /field--name-field-attachment[\s\S]*?(?:<\/table>|<\/article>)/i.exec(html)?.[0] ?? "";
	const links: SadcDocumentLink[] = [];
	const seen = new Set<string>();
	for (const match of field.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
		const url = absoluteSadcUrl(attrValue(match[1] ?? "", "href"));
		if (!url || seen.has(url)) continue;
		if (!/\.(?:pdf|docx?|xlsx?|zip)(?:$|[?#])/i.test(new URL(url).pathname)) continue;
		seen.add(url);
		links.push({ label: stripHtml(match[2] ?? "") || undefined, url });
	}
	return links;
}

export function parseSadcProcurementDetailHtml(html: string, sourceUrl: string, now = new Date()): SadcDetail | undefined {
	const title = stripHtml(/<h1\b[^>]*>[\s\S]*?<span\b[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/h1>/i.exec(html)?.[1]
		?? /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]);
	if (!title) return undefined;
	const deadlineText = stripHtml(/<span>\s*Closing Date:\s*<\/span>\s*([^<]+)/i.exec(html)?.[1]);
	const closingTimeText = stripHtml(/<span>\s*Closing Time:\s*<\/span>\s*([^<]+)/i.exec(html)?.[1]);
	const deadline = parseSadcDate(deadlineText, closingTimeText);
	if (isExpired(deadline, now)) return undefined;
	const bodyHtml = /field--name-body[\s\S]*?field__item["'][^>]*>([\s\S]*?)<\/div>\s*(?:<div class=["']field|<\/div>\s*<\/article>)/i.exec(html)?.[1] ?? "";
	const summary = stripHtml(bodyHtml) || undefined;
	return {
		title,
		reference: referenceFrom(summary ?? title),
		deadline,
		deadlineText,
		closingTimeText,
		summary,
		documentLinks: documentLinksFromDetail(html),
	};
}

function opportunityFromRow(row: SadcListingRow, detail?: SadcDetail): SadcOpportunity {
	const title = detail?.title ?? row.title;
	const summary = detail?.summary;
	const category = inferCategory(title, summary);
	const documentLinks = detail?.documentLinks ?? [];
	const primaryDocument = documentLinks.find((link) => /\b(?:rfp|reoi|request|bidding|terms|tor)\b/i.test(`${link.label ?? ""} ${link.url}`))
		?? documentLinks[0];
	const reference = detail?.reference ?? referenceFrom(title);
	const sourceId = `sadc-${slugify(row.portalUrl.split("/").filter(Boolean).pop() ?? reference ?? title) || "tender"}`;
	return {
		title,
		source: "sadc",
		sourceId,
		noticeId: reference ?? sourceId,
		organization: "SADC Secretariat",
		countryRegion: "Southern Africa",
		category,
		opportunityType: inferOpportunityType(category),
		deadline: detail?.deadline ?? row.deadline,
		portalUrl: row.portalUrl,
		documentUrl: primaryDocument?.url ?? row.portalUrl,
		rfpLink: primaryDocument?.url ?? row.portalUrl,
		projectSummary: [
			reference ? `Reference: ${reference}` : undefined,
			(detail?.deadlineText ?? row.deadlineText) ? `Closing date: ${detail?.deadlineText ?? row.deadlineText}` : undefined,
			detail?.closingTimeText ? `Closing time: ${detail.closingTimeText}` : undefined,
			summary,
			documentLinks.length > 0 ? `${documentLinks.length} linked procurement document(s) found.` : undefined,
		].filter(Boolean).join("; ") || "SADC procurement opportunity.",
		submissionMethod: "Use the SADC procurement notice and linked bidding documents for submission instructions.",
		tags: ["sadc", "southern-africa", "regional-procurement", "source-documents"],
		metadata: {
			sadc: {
				reference,
				deadlineText: detail?.deadlineText ?? row.deadlineText,
				closingTimeText: detail?.closingTimeText,
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
		throw new Error(`SADC procurement fetch failed: ${response.status} ${response.statusText}`);
	}
	return response.text();
}

async function fetchSadcOpportunities(sourceUrl: string): Promise<SadcOpportunity[]> {
	const listingHtml = await fetchHtml(sourceUrl || SADC_PROCUREMENT_URL);
	const rows = parseSadcProcurementListingHtml(listingHtml);
	const limit = detailLimit();
	if (limit <= 0 || rows.length === 0) return rows.map((row) => opportunityFromRow(row));
	const details = await Promise.all(rows.slice(0, limit).map(async (row) => {
		try {
			return parseSadcProcurementDetailHtml(await fetchHtml(row.portalUrl), row.portalUrl);
		} catch {
			return undefined;
		}
	}));
	return rows.map((row, index) => opportunityFromRow(row, details[index]));
}

export const sadcParser: TenderParser = {
	sourceId: "sadc",
	name: "SADC Procurement Opportunities",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		if (!input.html?.trim() && !input.markdown?.trim() && input.url) {
			if (/\/procurement-opportunities\/[^/?#]+/i.test(new URL(input.url).pathname)) {
				const detail = parseSadcProcurementDetailHtml(await fetchHtml(input.url), input.url);
				return {
					opportunities: detail ? [opportunityFromRow({
						title: detail.title ?? "SADC procurement opportunity",
						portalUrl: input.url,
						deadline: detail.deadline,
						deadlineText: detail.deadlineText,
					}, detail)] : [],
				};
			}
			return { opportunities: await fetchSadcOpportunities(input.url) };
		}
		const content = input.html ?? input.markdown ?? "";
		if (/node--type-tender|field--name-field-attachment|Closing Date:/i.test(content)) {
			const detail = parseSadcProcurementDetailHtml(content, input.url);
			return {
				opportunities: detail ? [opportunityFromRow({
					title: detail.title ?? "SADC procurement opportunity",
					portalUrl: input.url,
					deadline: detail.deadline,
					deadlineText: detail.deadlineText,
				}, detail)] : [],
			};
		}
		return { opportunities: parseSadcProcurementListingHtml(content).map((row) => opportunityFromRow(row)) };
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || SADC_PROCUREMENT_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(sadcParser);
