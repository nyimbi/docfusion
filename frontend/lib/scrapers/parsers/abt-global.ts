import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const ABT_COMMERCIAL_OPPORTUNITIES_URL = "https://www.abtglobal.com/doing-business-with-abt/commercial-opportunities";
const ACCORDION_ENTRY_PATTERN = /<h3\b[^>]*class=["'][^"']*accordion__item--header-title[^"']*["'][^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b[^>]*class=["'][^"']*accordion__item--header-title|<footer\b|$)/gi;

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, codepoint: string) => String.fromCodePoint(Number(codepoint)))
		.replace(/&#x([0-9a-f]+);/gi, (_, codepoint: string) => String.fromCodePoint(Number.parseInt(codepoint, 16)))
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, "\"")
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'");
}

function stripHtml(value: string): string {
	return cleanText(decodeHtmlEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function absoluteUrl(href: string | undefined, sourceUrl: string): string | undefined {
	if (!href) return undefined;
	try {
		return new URL(decodeHtmlEntities(href), sourceUrl).toString();
	} catch {
		return undefined;
	}
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

function utcStartOfDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isExpired(deadline: Date | undefined, now = new Date()): boolean {
	if (!deadline) return false;
	return deadline.getTime() < utcStartOfDay(now).getTime();
}

function firstDocumentUrl(block: string, sourceUrl: string): string | undefined {
	for (const match of block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
		const href = decodeHtmlEntities(match[1] ?? "");
		const anchorText = stripHtml(match[2] ?? "");
		if (/\.(?:pdf|docx?|xlsx?)(?:[?#].*)?$/i.test(href) || /\b(?:rfp|rfq|rfa|eoi|roi|tender|scope|terms of reference)\b/i.test(anchorText)) {
			return absoluteUrl(href, sourceUrl);
		}
	}
	return undefined;
}

function inferOpportunityType(text: string): OpportunityData["opportunityType"] {
	const normalized = text.toLowerCase();
	if (/\beoi\b|expression of interest/.test(normalized)) return "eoi";
	if (/\brfa\b|request for applications?|call for proposals?/.test(normalized)) return "grant";
	if (/\brfp\b|request for proposals?/.test(normalized)) return "rfp";
	return "tender";
}

function noticeIdFromTitle(title: string): string {
	return title.match(/\b[A-Z0-9]+(?:-[A-Z0-9]+)*-(?:RFP|RFQ|RFA|EOI|ROI)-\d{4}-\d+\b/i)?.[0]
		?? title.match(/\b(?:RFP|RFQ|RFA|EOI|ROI)[- ][A-Z0-9-]{4,}\b/i)?.[0]
		?? slugify(title);
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
		if (month !== undefined) {
			return new Date(Date.UTC(Number(dayMonthYear[3]), month, Number(dayMonthYear[1])));
		}
	}
	const monthDayYear = value.match(/\b([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\b/);
	if (monthDayYear) {
		const month = months[monthDayYear[1].toLowerCase()];
		if (month !== undefined) {
			return new Date(Date.UTC(Number(monthDayYear[3]), month, Number(monthDayYear[2])));
		}
	}
	return undefined;
}

function parseAbtDeadline(text: string): Date | undefined {
	const candidates = [
		/\b(?:closing date and time|closing date|closing|due date|submitted electronically no later than|submitted no later than|must be submitted|before|by)\b[\s\S]{0,140}?\bon\s+([A-Za-z]+day,?\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
		/\b(?:closing date and time|closing date|closing|due date|submitted electronically no later than|submitted no later than|must be submitted|before|by)\b[\s\S]{0,140}?\b([A-Za-z]+day,?\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
		/\b(?:closing date and time|closing date|closing|due date|submitted electronically no later than|submitted no later than|must be submitted|before|by)\b[\s\S]{0,140}?\b([A-Za-z]+day,?\s+)?([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
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

function parseAbtCommercialOpportunities(content: string | undefined, sourceUrl: string, now = new Date()): OpportunityData[] {
	if (!content) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const match of content.matchAll(ACCORDION_ENTRY_PATTERN)) {
		const title = stripHtml(match[1] ?? "");
		const body = match[2] ?? "";
		const bodyText = stripHtml(body);
		if (title.length < 8 || !/\b(?:rfp|rfq|rfa|eoi|roi|request|tender|proposal|quotation|application)\b/i.test(`${title} ${bodyText}`)) continue;

		const deadline = parseAbtDeadline(`${title} ${bodyText}`);
		if (isExpired(deadline, now)) continue;

		const noticeId = cleanText(noticeIdFromTitle(title));
		const sourceId = `abt-${slugify(noticeId || title)}`;
		if (seen.has(sourceId)) continue;

		const documentUrl = firstDocumentUrl(body, sourceUrl);
		seen.add(sourceId);
		opportunities.push({
			title,
			source: "abt_global",
			sourceId,
			noticeId,
			organization: "Abt Global",
			category: "Abt Global commercial opportunity",
			opportunityType: inferOpportunityType(`${title} ${bodyText}`),
			deadline,
			portalUrl: sourceUrl,
			documentUrl,
			rfpLink: documentUrl ?? sourceUrl,
			projectSummary: deadline
				? `Abt Global commercial opportunity. Deadline: ${deadline.toISOString().slice(0, 10)}.`
				: "Abt Global commercial opportunity.",
			tags: ["abt-global", "donor-implementer", "source-scrape"],
			metadata: {
				abtGlobal: {
					sourcePage: sourceUrl,
					noticeId,
				},
			},
		});
	}

	return opportunities;
}

export const abtGlobalParser: TenderParser = {
	sourceId: "abt_global",
	name: "Abt Global Commercial Opportunities",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseAbtCommercialOpportunities(input.html ?? input.markdown, input.url || ABT_COMMERCIAL_OPPORTUNITIES_URL),
		};
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || ABT_COMMERCIAL_OPPORTUNITIES_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(abtGlobalParser);
