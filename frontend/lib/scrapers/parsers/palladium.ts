import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const PALLADIUM_TENDERS_URL = "https://thepalladiumgroup.com/tenders";
const LIST_ITEM_PATTERN = /<li\b[^>]*>([\s\S]*?href=["'][^"']*\/tender\/[^"']+["'][\s\S]*?)<\/li>/gi;

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
		.replace(/&nbsp;/g, " ");
}

function stripHtml(value: string | undefined): string {
	if (!value) return "";
	return cleanText(decodeHtmlEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>|<\/span>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function absoluteUrl(href: string | undefined, sourceUrl: string): string | undefined {
	if (!href) return undefined;
	try {
		const url = new URL(decodeHtmlEntities(href), sourceUrl);
		if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
		url.hash = "";
		return url.toString();
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

function isExpired(deadline: Date | undefined, now = new Date()): boolean {
	if (!deadline) return false;
	return deadline.getTime() < utcStartOfDay(now).getTime();
}

function parseNamedDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	const months: Record<string, number> = {
		january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
		july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
	};
	const dayMonthYear = value.match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/);
	if (dayMonthYear) {
		const month = months[dayMonthYear[2].toLowerCase()];
		if (month !== undefined) return new Date(Date.UTC(Number(dayMonthYear[3]), month, Number(dayMonthYear[1])));
	}
	const monthDayYear = value.match(/\b([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\b/);
	if (monthDayYear) {
		const month = months[monthDayYear[1].toLowerCase()];
		if (month !== undefined) return new Date(Date.UTC(Number(monthDayYear[3]), month, Number(monthDayYear[2])));
	}
	return undefined;
}

function parsePalladiumDeadline(text: string): Date | undefined {
	const candidates = [
		/\b(?:proposal submission closes|submissions? close|closing date|deadline|closes)\b[\s\S]{0,120}?\b(?:on\s+)?([A-Za-z]+day,?\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
		/\b(?:proposal submission closes|submissions? close|closing date|deadline|closes)\b[\s\S]{0,120}?\b(?:on\s+)?([A-Za-z]+day,?\s+)?([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
		/\b([A-Za-z]+day,?\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/i,
		/\b([A-Za-z]+\s+\d{1,2},\s+\d{4})\b/i,
	];
	for (const pattern of candidates) {
		const match = text.match(pattern);
		const dateText = match?.[2] ?? match?.[1];
		const parsed = parseNamedDate(dateText) ?? parseDate(dateText);
		if (parsed) return parsed;
	}
	return undefined;
}

function inferOpportunityType(text: string): OpportunityData["opportunityType"] {
	const normalized = text.toLowerCase();
	if (/\beoi\b|expression of interest/.test(normalized)) return "eoi";
	if (/\brfq\b|request for quotation/.test(normalized)) return "tender";
	if (/\brfp\b|request for proposals?/.test(normalized)) return "rfp";
	return "tender";
}

function noticeIdFromTitle(title: string): string | undefined {
	return title.match(/\b(?:RFP|RFQ|EOI|ITT|RFT)\d{2}[-/]\d{2,5}\b/i)?.[0]
		?? title.match(/\b(?:RFP|RFQ|EOI|ITT|RFT)[- ][A-Z0-9-]{3,}\b/i)?.[0];
}

function firstDocumentUrl(block: string, sourceUrl: string): string | undefined {
	for (const match of block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
		const href = decodeHtmlEntities(match[1] ?? "");
		const anchorText = stripHtml(match[2] ?? "");
		if (/\/downloads?\//i.test(href)
			|| /\.(?:pdf|docx?|xlsx?|zip)(?:[?#].*)?$/i.test(href)
			|| /\b(?:download|rfp|request for proposal|tender document|terms of reference)\b/i.test(anchorText)) {
			return absoluteUrl(href, sourceUrl);
		}
	}
	return undefined;
}

function detailTitle(content: string): string {
	const explicit = content.match(/<div\b[^>]*class=["'][^"']*\bh2\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
		?? content.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
		?? content.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1]
		?? content.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1]
		?? content.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
	return stripHtml(explicit).replace(/\s+-\s+Palladium\b/i, "");
}

function opportunityFrom(
	title: string,
	sourceUrl: string,
	options: {
		portalUrl?: string;
		documentUrl?: string;
		deadline?: Date;
		summary?: string;
	}
): OpportunityData {
	const noticeId = cleanText(noticeIdFromTitle(title)) || undefined;
	const identity = noticeId ?? options.portalUrl?.split("/").filter(Boolean).pop() ?? title;
	return {
		title,
		source: "palladium",
		sourceId: `palladium-${slugify(identity) || "tender"}`,
		noticeId,
		organization: "Palladium",
		category: "Palladium tender",
		opportunityType: inferOpportunityType(`${title} ${options.summary ?? ""}`),
		deadline: options.deadline,
		portalUrl: options.portalUrl ?? sourceUrl,
		documentUrl: options.documentUrl ?? options.portalUrl ?? sourceUrl,
		rfpLink: options.documentUrl ?? options.portalUrl ?? sourceUrl,
		projectSummary: options.summary || "Palladium tender opportunity.",
		tags: ["palladium", "donor-implementer", "source-scrape", "source-documents"],
		metadata: {
			palladium: {
				sourcePage: sourceUrl,
				detailUrl: options.portalUrl ?? sourceUrl,
				noticeId,
			},
		},
	};
}

function parsePalladiumList(content: string, sourceUrl: string): OpportunityData[] {
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();
	for (const match of content.matchAll(LIST_ITEM_PATTERN)) {
		const block = match[1] ?? "";
		const href = block.match(/<a\b[^>]*href=["']([^"']*\/tender\/[^"']+)["']/i)?.[1];
		const portalUrl = absoluteUrl(href, sourceUrl);
		const title = stripHtml(block.match(/<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1])
			|| stripHtml(block.match(/<a\b[^>]*>[\s\S]*?<\/a>/i)?.[0]);
		if (!portalUrl || title.length < 8) continue;

		const sourceId = `palladium-${slugify(noticeIdFromTitle(title) ?? portalUrl.split("/").filter(Boolean).pop() ?? title)}`;
		if (seen.has(sourceId)) continue;
		seen.add(sourceId);
		opportunities.push(opportunityFrom(title, sourceUrl, {
			portalUrl,
			documentUrl: portalUrl,
			summary: "Palladium tender listing. Detail page is queued as the source document.",
		}));
	}
	return opportunities;
}

function parsePalladiumDetail(content: string, sourceUrl: string, now = new Date()): OpportunityData[] {
	const title = detailTitle(content);
	if (title.length < 8) return [];
	const bodyText = stripHtml(content);
	const deadline = parsePalladiumDeadline(bodyText);
	if (isExpired(deadline, now)) return [];
	const documentUrl = firstDocumentUrl(content, sourceUrl);
	return [opportunityFrom(title, sourceUrl, {
		portalUrl: sourceUrl,
		documentUrl,
		deadline,
		summary: bodyText.slice(0, 900),
	})];
}

function parsePalladiumTenders(content: string | undefined, sourceUrl: string): OpportunityData[] {
	if (!content?.trim()) return [];
	const listOpportunities = parsePalladiumList(content, sourceUrl);
	if (listOpportunities.length > 0) return listOpportunities;
	return parsePalladiumDetail(content, sourceUrl);
}

export const palladiumParser: TenderParser = {
	sourceId: "palladium",
	name: "Palladium Tenders",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parsePalladiumTenders(input.html ?? input.markdown, input.url || PALLADIUM_TENDERS_URL),
		};
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || PALLADIUM_TENDERS_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(palladiumParser);
