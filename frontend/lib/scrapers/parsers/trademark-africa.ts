import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const TRADEMARK_AFRICA_BASE_URL = "https://trademarkafrica.com";
export const TRADEMARK_AFRICA_PROCUREMENT_URL = `${TRADEMARK_AFRICA_BASE_URL}/procurement/`;
const DEFAULT_DETAIL_LIMIT = 25;

type TmaListingOpportunity = OpportunityData & {
	portalUrl: string;
	metadata: {
		tradeMarkAfrica: TradeMarkAfricaMetadata;
	};
};

type TradeMarkAfricaMetadata = {
	reference?: string;
	deadlineText?: string;
	detailUrl: string;
	documentLinks: Array<{ label?: string; url: string }>;
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
		.replace(/&ndash;|&mdash;/gi, "-")
		.replace(/&eacute;/gi, "e")
		.replace(/&egrave;/gi, "e")
		.replace(/&agrave;/gi, "a")
		.replace(/&ccedil;/gi, "c");
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

function absoluteUrl(rawUrl: string | undefined, sourceUrl = TRADEMARK_AFRICA_PROCUREMENT_URL): string | undefined {
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

function detailLimit(): number {
	const parsed = Number(process.env.TRADEMARK_AFRICA_DETAIL_LIMIT ?? DEFAULT_DETAIL_LIMIT);
	if (!Number.isFinite(parsed)) return DEFAULT_DETAIL_LIMIT;
	return Math.min(75, Math.max(0, Math.trunc(parsed)));
}

function utcStartOfDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isExpired(deadline: Date | undefined, now = new Date()): boolean {
	return Boolean(deadline && deadline.getTime() < utcStartOfDay(now).getTime());
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

function parseTime(value: string): { hour: number; minute: number } | undefined {
	const match = value.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?|am|pm)?\b/i);
	if (!match) return undefined;
	let hour = Number(match[1]);
	const minute = Number(match[2] ?? "0");
	const ampm = (match[3] ?? "").replace(/\./g, "").toLowerCase();
	if (ampm === "pm" && hour < 12) hour += 12;
	if (ampm === "am" && hour === 12) hour = 0;
	if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return undefined;
	return { hour, minute };
}

function parseTradeMarkAfricaDeadline(text: string | undefined): Date | undefined {
	const cleaned = stripHtml(text).replace(/\s+/g, " ").trim();
	if (!cleaned) return undefined;

	const explicit = /submission deadline\s*:?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})\b([\s\S]{0,80})/i.exec(cleaned)
		?? /\bdeadline\b\s*(?:shall be|is|:)?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})\b([\s\S]{0,80})/i.exec(cleaned)
		?? /\b([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})\b([\s\S]{0,80})/i.exec(cleaned);
	if (!explicit) return undefined;

	const dateText = explicit[1] ?? "";
	const tail = explicit[2] ?? "";
	const dayMonthYear = dateText.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/i);
	const monthDayYear = dateText.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/i);
	const day = Number(dayMonthYear?.[1] ?? monthDayYear?.[2]);
	const month = monthNumber(dayMonthYear?.[2] ?? monthDayYear?.[1]);
	const year = Number(dayMonthYear?.[3] ?? monthDayYear?.[3]);
	if (month === undefined || !Number.isFinite(day) || !Number.isFinite(year)) return undefined;

	const time = parseTime(tail) ?? { hour: 23, minute: 59 };
	const isKenyaTime = /\b(?:kenya|east african|eat)\b/i.test(tail);
	const utcHour = isKenyaTime ? time.hour - 3 : time.hour;
	return new Date(Date.UTC(year, month, day, utcHour, time.minute));
}

function referenceFrom(title: string): string | undefined {
	return title.match(/\b(?:PRQ|TMA)\/?[A-Z0-9&/-]+\/\d{2,4}\b/i)?.[0]
		?? title.match(/\bPRQ\d{5,}\b/i)?.[0]
		?? title.match(/\bTMA\/[A-Z0-9&/-]+\/\d{4}\b/i)?.[0];
}

function inferOpportunityType(title: string): OpportunityData["opportunityType"] {
	const normalized = title.toLowerCase();
	if (/\beoi\b|expression of interest|prequalification|pre-qualification/.test(normalized)) return "eoi";
	if (/\brfp\b|request for proposal|consultancy|consultant/.test(normalized)) return "rfp";
	return "tender";
}

function documentLinksFromHtml(html: string, sourceUrl: string): Array<{ label?: string; url: string }> {
	const links: Array<{ label?: string; url: string }> = [];
	const seen = new Set<string>();
	for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
		const attributes = match[1] ?? "";
		const href = attrValue(attributes, "href");
		const url = absoluteUrl(href, sourceUrl);
		if (!url || seen.has(url)) continue;
		const label = stripHtml(match[2] ?? "");
		const haystack = `${label} ${url}`;
		if (!/\b(?:tender|bid|advert|document|clarification|addendum|extension|code of conduct|supplier|download|terms of reference|tor)\b/i.test(haystack)
			&& !/\.(?:pdf|docx?|xlsx?|zip)(?:[?#].*)?$/i.test(url)) {
			continue;
		}
		if (/\.(?:webp|png|jpe?g|svg)(?:[?#].*)?$/i.test(url)) continue;
		seen.add(url);
		links.push({ label: label || undefined, url });
	}
	return links;
}

function summaryFromText(text: string): string | undefined {
	const withoutFooter = text
		.replace(/\bGrowing Prosperity Through Trade\b[\s\S]*$/i, "")
		.replace(/\bFollow Us\b[\s\S]*$/i, "")
		.trim();
	return withoutFooter.length > 0 ? withoutFooter.slice(0, 1200) : undefined;
}

function opportunityFrom(
	title: string,
	sourceUrl: string,
	options: {
		portalUrl: string;
		deadline?: Date;
		deadlineText?: string;
		summary?: string;
		documentLinks?: Array<{ label?: string; url: string }>;
	}
): TmaListingOpportunity {
	const reference = referenceFrom(title);
	const documentLinks = options.documentLinks ?? [];
	const primaryDocument = documentLinks.find((link) => /\btender document\b/i.test(link.label ?? ""))
		?? documentLinks.find((link) => /\b(?:tender|rfp|tor|terms of reference)\b/i.test(`${link.label ?? ""} ${link.url}`))
		?? documentLinks[0];
	const identity = reference ?? options.portalUrl.split("/").filter(Boolean).pop() ?? title;
	return {
		title,
		source: "trademark_africa",
		sourceId: `trademark-africa-${slugify(identity) || "tender"}`,
		noticeId: reference,
		organization: "TradeMark Africa",
		countryRegion: "Africa",
		category: "TradeMark Africa tender",
		opportunityType: inferOpportunityType(title),
		deadline: options.deadline,
		portalUrl: options.portalUrl,
		documentUrl: primaryDocument?.url ?? options.portalUrl,
		rfpLink: primaryDocument?.url ?? options.portalUrl,
		projectSummary: [
			reference ? `Reference: ${reference}` : undefined,
			options.deadlineText ? `Submission deadline: ${options.deadlineText}` : undefined,
			options.summary,
			documentLinks.length > 0 ? `${documentLinks.length} linked tender document(s) found.` : undefined,
		].filter(Boolean).join("; ") || "TradeMark Africa tender opportunity.",
		submissionMethod: "Use the TradeMark Africa notice and linked tender documents for submission instructions.",
		tags: ["trademark-africa", "africa", "regional-trade", "source-documents"],
		metadata: {
			tradeMarkAfrica: {
				reference,
				deadlineText: options.deadlineText,
				detailUrl: options.portalUrl,
				documentLinks,
			},
		},
	};
}

export function parseTradeMarkAfricaProcurementHtml(html: string, sourceUrl = TRADEMARK_AFRICA_PROCUREMENT_URL, now = new Date()): TmaListingOpportunity[] {
	const opportunities: TmaListingOpportunity[] = [];
	const seen = new Set<string>();
	const cardPattern = /<div\b[^>]*class=["'][^"']*\buc_post_title\b[^"']*["'][^>]*>\s*<a\b([^>]*)>[\s\S]*?<div\b[^>]*class=["'][^"']*\bue_p_title\b[^"']*["'][^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/a>[\s\S]*?<div\b[^>]*class=["'][^"']*\buc_post_text\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
	for (const match of html.matchAll(cardPattern)) {
		const portalUrl = absoluteUrl(attrValue(match[1] ?? "", "data-post-link"), sourceUrl);
		const title = stripHtml(match[2] ?? "");
		const cardText = stripHtml(match[3] ?? "");
		if (!portalUrl || !title || seen.has(portalUrl)) continue;
		if (!/\b(?:tender|bid|rfp|eoi|prq|consultancy|prequalification)\b/i.test(`${title} ${cardText}`)) continue;
		const deadline = parseTradeMarkAfricaDeadline(cardText);
		if (isExpired(deadline, now)) continue;
		seen.add(portalUrl);
		opportunities.push(opportunityFrom(title, sourceUrl, {
			portalUrl,
			deadline,
			deadlineText: cardText.match(/submission deadline\s*:?\s*([^;]+)/i)?.[1]?.trim() ?? undefined,
			summary: cardText,
		}));
	}
	return opportunities;
}

function parseTradeMarkAfricaDetailHtml(html: string, sourceUrl: string, now = new Date()): TmaListingOpportunity[] {
	const title = stripHtml(
		/<h1\b[^>]*class=["'][^"']*\belementor-heading-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]
		?? /<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(html)?.[1]
		?? /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
	).replace(/\s+-\s+TradeMark Africa$/i, "");
	if (!title || !/\b(?:tender|bid|rfp|eoi|prq|consultancy|prequalification)\b/i.test(title)) return [];
	const bodyText = stripHtml(html);
	const deadline = parseTradeMarkAfricaDeadline(bodyText);
	if (isExpired(deadline, now)) return [];
	const deadlineText = bodyText.match(/submission deadline\s*:?\s*([^.;]+)/i)?.[1]?.trim();
	return [opportunityFrom(title, sourceUrl, {
		portalUrl: sourceUrl,
		deadline,
		deadlineText,
		summary: summaryFromText(bodyText),
		documentLinks: documentLinksFromHtml(html, sourceUrl),
	})];
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
		throw new Error(`TradeMark Africa fetch failed: ${response.status} ${response.statusText}`);
	}
	return response.text();
}

async function fetchTradeMarkAfricaOpportunities(sourceUrl: string): Promise<TmaListingOpportunity[]> {
	const listingHtml = await fetchHtml(sourceUrl || TRADEMARK_AFRICA_PROCUREMENT_URL);
	const listingRows = parseTradeMarkAfricaProcurementHtml(listingHtml, sourceUrl || TRADEMARK_AFRICA_PROCUREMENT_URL);
	const limit = detailLimit();
	if (limit <= 0 || listingRows.length === 0) return listingRows;

	const details = await Promise.all(listingRows.slice(0, limit).map(async (row) => {
		try {
			return parseTradeMarkAfricaDetailHtml(await fetchHtml(row.portalUrl), row.portalUrl)[0];
		} catch {
			return undefined;
		}
	}));
	return listingRows.map((row, index) => details[index] ?? row);
}

export const tradeMarkAfricaParser: TenderParser = {
	sourceId: "trademark_africa",
	name: "TradeMark Africa Tenders",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		if (!input.html?.trim() && !input.markdown?.trim() && input.url) {
			return { opportunities: await fetchTradeMarkAfricaOpportunities(input.url) };
		}
		const content = input.html ?? input.markdown ?? "";
		if (/class=["'][^"']*\buc_post_title\b/i.test(content)) {
			return { opportunities: parseTradeMarkAfricaProcurementHtml(content, input.url) };
		}
		return { opportunities: parseTradeMarkAfricaDetailHtml(content, input.url) };
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || TRADEMARK_AFRICA_PROCUREMENT_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(tradeMarkAfricaParser);
