/**
 * UN Procurement solicitations parser.
 *
 * The UN procurement listing is rendered as Drupal card HTML by the browser
 * service. Parse those cards directly instead of relying on markdown links.
 */

import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const UN_PROCUREMENT_URL = "https://www.un.org/procurement/solicitations-opportunities";
const ROW_PATTERN = /<li\b[^>]*class=["'][^"']*\bviews-row\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
const TITLE_PATTERN = /<div\b[^>]*class=["'][^"']*\bviews-field-title\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i;
const DESCRIPTION_PATTERN = /<div\b[^>]*class=["'][^"']*\bviews-field-field-text-75-1\b[^"']*["'][^>]*>[\s\S]*?<div\b[^>]*class=["'][^"']*\bfield-content\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i;
const COMMODITY_PATTERN = /<span\b[^>]*class=["'][^"']*\bfield-content\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;
const DATETIME_PATTERN = /<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i;
const START_DATE_PATTERN = /<span\b[^>]*class=["'][^"']*\bstart\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i;
const END_DATE_PATTERN = /<span\b[^>]*class=["'][^"']*\bend\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i;
const PDF_LINK_PATTERN = /<a\b[^>]*href=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>/i;
const EXPRESS_INTEREST_LINK_PATTERN = /<a\b[^>]*href=["']([^"']+)["'][^>]*aria-label=["'][^"']*Express interest[^"']*["'][^>]*>/i;

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, "\"")
		.replace(/&#39;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">");
}

function stripTags(value: string | undefined): string {
	return cleanText(decodeHtmlEntities((value ?? "").replace(/<[^>]+>/g, " ")));
}

function extractFirst(pattern: RegExp, value: string): string | undefined {
	const match = value.match(pattern);
	return stripTags(match?.[1]) || undefined;
}

function absoluteUrl(rawUrl: string | undefined, sourceUrl: string): string | undefined {
	if (!rawUrl) return undefined;
	try {
		const url = new URL(decodeHtmlEntities(rawUrl), sourceUrl);
		if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
		url.hash = "";
		return url.toString();
	} catch {
		return undefined;
	}
}

function sourceIdFromNotice(noticeId: string, title: string): string {
	const notice = noticeId
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
	return `un-procurement-${notice || slug || "notice"}`;
}

function extractCommodity(row: string): string | undefined {
	let lastValue: string | undefined;
	for (const match of row.matchAll(COMMODITY_PATTERN)) {
		const value = stripTags(match[1]);
		if (value) lastValue = value;
	}
	return lastValue;
}

function parseOpeningDate(row: string): Date | undefined {
	const endDate = extractFirst(END_DATE_PATTERN, row);
	if (endDate) return parseDate(endDate);
	const datetime = row.match(DATETIME_PATTERN)?.[1];
	if (datetime) return parseDate(datetime);
	return parseDate(extractFirst(START_DATE_PATTERN, row));
}

function extractDocumentUrl(row: string, sourceUrl: string): string | undefined {
	return absoluteUrl(row.match(PDF_LINK_PATTERN)?.[1], sourceUrl);
}

function extractExpressInterestUrl(row: string, sourceUrl: string): string | undefined {
	return absoluteUrl(row.match(EXPRESS_INTEREST_LINK_PATTERN)?.[1], sourceUrl);
}

function buildSummary(title: string, noticeId: string, commodity: string | undefined, deadline: Date | undefined): string {
	return [
		`UN Procurement solicitation opening ${noticeId}: ${title}.`,
		commodity ? `Commodity group: ${commodity}.` : undefined,
		deadline ? `Opening date: ${deadline.toISOString().slice(0, 10)}.` : undefined,
	].filter(Boolean).join(" ");
}

function parseRows(markdownOrHtml: string | undefined, sourceUrl: string): OpportunityData[] {
	if (!markdownOrHtml) return [];
	const opportunities: OpportunityData[] = [];
	for (const match of markdownOrHtml.matchAll(ROW_PATTERN)) {
		const row = match[1] ?? "";
		const noticeId = extractFirst(TITLE_PATTERN, row);
		const title = extractFirst(DESCRIPTION_PATTERN, row);
		if (!noticeId || !title) continue;
		const commodity = extractCommodity(row);
		const deadline = parseOpeningDate(row);
		const sourceId = sourceIdFromNotice(noticeId, title);
		const documentUrl = extractDocumentUrl(row, sourceUrl);
		const expressInterestUrl = extractExpressInterestUrl(row, sourceUrl);

		opportunities.push({
			title,
			source: "un_procurement",
			sourceId,
			noticeId,
			organization: "United Nations Procurement Division",
			countryRegion: "Global",
			category: commodity ?? "UN Procurement",
			opportunityType: "tender",
			portalUrl: sourceUrl,
			documentUrl,
			rfpLink: documentUrl ?? expressInterestUrl ?? sourceUrl,
			deadline,
			projectSummary: buildSummary(title, noticeId, commodity, deadline),
			submissionMethod: "Monitor UN Procurement solicitation details and follow the published tender instructions.",
			tags: ["un-procurement", "unpd", "solicitation"],
			metadata: {
				unProcurement: {
					sourceUrl,
					noticeId,
					commodityGroup: commodity ?? null,
					expressInterestUrl: expressInterestUrl ?? null,
				},
			},
		});
	}
	return opportunities;
}

export const unProcurementParser: TenderParser = {
	sourceId: "un_procurement",
	name: "UN Procurement",
	requiresJavascript: true,
	async parse(content: ParseInput): Promise<ParseResult> {
		const source = content.markdown?.trim() ? content.markdown : content.html;
		return {
			opportunities: parseRows(source, content.url || UN_PROCUREMENT_URL),
		};
	},
	getPageUrl(baseUrl: string): string {
		return baseUrl;
	},
	hasNextPage(): boolean {
		return false;
	},
};

registerParser(unProcurementParser);

export default unProcurementParser;
