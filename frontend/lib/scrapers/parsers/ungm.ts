/**
 * UNGM Parser
 *
 * UNGM's public notice search returns server-rendered table-row fragments from
 * /Public/Notice/Search. This parser maps those row fragments into canonical
 * opportunity data without requiring browser rendering.
 */

import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

interface UngmNoticeRow {
	noticeId: string;
	title: string;
	deadline?: Date;
	publishedDate?: Date;
	organization?: string;
	noticeType?: string;
	reference?: string;
	countryRegion?: string;
	portalUrl?: string;
}

export interface UngmNoticeDetailLink {
	url: string;
	description?: string;
}

export interface UngmNoticeDetail {
	description?: string;
	contactEmail?: string;
	links: UngmNoticeDetailLink[];
	primaryLink?: UngmNoticeDetailLink;
}

const HTML_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: "\"",
	apos: "'",
	nbsp: " ",
};

const UNGM_MONTHS: Record<string, number> = {
	jan: 0,
	january: 0,
	feb: 1,
	february: 1,
	mar: 2,
	march: 2,
	apr: 3,
	april: 3,
	may: 4,
	jun: 5,
	june: 5,
	jul: 6,
	july: 6,
	aug: 7,
	august: 7,
	sep: 8,
	sept: 8,
	september: 8,
	oct: 9,
	october: 9,
	nov: 10,
	november: 10,
	dec: 11,
	december: 11,
};

function decodeHtmlEntities(text: string): string {
	return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
		if (entity.startsWith("#x")) {
			const codePoint = Number.parseInt(entity.slice(2), 16);
			return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
		}
		if (entity.startsWith("#")) {
			const codePoint = Number.parseInt(entity.slice(1), 10);
			return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
		}
		return HTML_ENTITIES[entity.toLowerCase()] ?? match;
	});
}

function stripTags(html: string): string {
	return decodeHtmlEntities(html
		.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
		.replace(/<style\b[\s\S]*?<\/style>/gi, " ")
		.replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
		.replace(/<[^>]+>/g, " "));
}

function resolveUrl(rawUrl: string | undefined, baseUrl: string): string | undefined {
	if (!rawUrl) return undefined;
	try {
		const parsed = new URL(rawUrl, baseUrl);
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return undefined;
	}
}

function extractHtmlBlockAfterTitle(html: string, title: string): string | undefined {
	const titlePattern = new RegExp(`<div\\b[^>]*class=["'][^"']*\\btitle\\b[^"']*["'][^>]*>\\s*${title}\\s*<\\/div>`, "i");
	const titleMatch = titlePattern.exec(html);
	if (titleMatch?.index === undefined) return undefined;
	const afterTitle = html.slice(titleMatch.index + titleMatch[0].length);
	return extractFirstDivContent(afterTitle);
}

function extractFirstDivContent(html: string): string | undefined {
	const tagPattern = /<\/?div\b[^>]*>/gi;
	let firstOpen: RegExpExecArray | null = null;
	let tagMatch: RegExpExecArray | null;
	while ((tagMatch = tagPattern.exec(html)) !== null) {
		if (!tagMatch[0].startsWith("</")) {
			firstOpen = tagMatch;
			break;
		}
	}
	if (!firstOpen) return undefined;

	const contentStart = tagPattern.lastIndex;
	let depth = 1;
	while ((tagMatch = tagPattern.exec(html)) !== null) {
		if (tagMatch[0].startsWith("</")) {
			depth--;
			if (depth === 0) return html.slice(contentStart, tagMatch.index);
		} else {
			depth++;
		}
	}
	return undefined;
}

function extractTableCells(rowHtml: string): string[] {
	return [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
		.map((match) => cleanText(stripTags(match[1])));
}

function parseUngmDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	const cleaned = value
		.replace(/\([^)]*\)/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	const match = cleaned.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
	if (!match) {
		const parsed = Date.parse(cleaned);
		return Number.isNaN(parsed) ? undefined : new Date(parsed);
	}

	const yearValue = Number(match[3]);
	const year = yearValue < 100 ? 2000 + yearValue : yearValue;
	const month = UNGM_MONTHS[match[2].toLowerCase()];
	if (month === undefined) return undefined;
	return new Date(
		year,
		month,
		Number(match[1]),
		Number(match[4] ?? 0),
		Number(match[5] ?? 0),
		0
	);
}

function extractAttribute(html: string, attribute: string): string | undefined {
	const match = html.match(new RegExp(`${attribute}=["']([^"']+)["']`, "i"));
	return match?.[1];
}

function extractTitle(cellHtml: string): string {
	const titleMatch = cellHtml.match(/<span\b[^>]*class=["'][^"']*\bungm-title\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
	return cleanText(stripTags(titleMatch?.[1] ?? cellHtml));
}

function extractRoleCellHtml(rowHtml: string): string[] {
	const cellStarts = [...rowHtml.matchAll(/<div\b(?=[^>]*role=["']cell["'])[^>]*>/gi)]
		.map((match) => match.index ?? 0);
	if (!cellStarts.length) return [];

	return cellStarts.map((start, index) => {
		const end = cellStarts[index + 1] ?? rowHtml.length;
		return rowHtml.slice(start, end);
	});
}

function extractRowHtml(html: string): Array<{ noticeId: string; html: string }> {
	const rowStarts = [...html.matchAll(/<div\b(?=[^>]*role=["']row["'])(?=[^>]*\bdataRow\b)(?=[^>]*data-noticeid=["']([^"']+)["'])[^>]*>/gi)]
		.map((match) => ({ index: match.index ?? 0, noticeId: match[1] }));
	return rowStarts.map((row, index) => {
		const end = rowStarts[index + 1]?.index ?? html.length;
		return {
			noticeId: row.noticeId,
			html: html.slice(row.index, end),
		};
	});
}

function parseUngmNoticeRows(html: string | undefined, baseUrl: string): UngmNoticeRow[] {
	if (!html?.trim()) return [];

	return extractRowHtml(html)
		.map((row): UngmNoticeRow | null => {
			const cells = extractRoleCellHtml(row.html);
			if (cells.length < 7) return null;

			const portalUrl = resolveUrl(extractAttribute(cells[1], "href") ?? `/Public/Notice/${row.noticeId}`, baseUrl);
			const title = extractTitle(cells[1]);
			if (!title) return null;

			const noticeRow: UngmNoticeRow = {
				noticeId: row.noticeId,
				title,
				deadline: parseUngmDate(cleanText(stripTags(cells[2]))),
				publishedDate: parseUngmDate(cleanText(stripTags(cells[3]))),
				organization: cleanText(stripTags(cells[4])) || undefined,
				noticeType: cleanText(stripTags(cells[5])) || undefined,
				reference: cleanText(stripTags(cells[6])) || undefined,
				countryRegion: cleanText(stripTags(cells[7])) || undefined,
				portalUrl,
			};
			return noticeRow;
		})
		.filter((row): row is UngmNoticeRow => Boolean(row));
}

function opportunityTypeFromNoticeType(noticeType: string | undefined): OpportunityData["opportunityType"] {
	const lower = noticeType?.toLowerCase() ?? "";
	if (lower.includes("expression") || /\beoi\b/.test(lower)) return "eoi";
	if (lower.includes("proposal")) return "rfp";
	if (lower.includes("quotation")) return "tender";
	if (lower.includes("bid")) return "tender";
	if (lower.includes("grant")) return "grant";
	return "tender";
}

function scoreDetailLink(link: UngmNoticeDetailLink): number {
	const haystack = `${link.description ?? ""} ${link.url}`.toLowerCase();
	let score = 0;
	if (haystack.includes("negotiation document")) score += 10;
	if (haystack.includes("document")) score += 6;
	if (haystack.includes("direct link")) score += 5;
	if (haystack.includes("procurement notices")) score += 4;
	if (haystack.includes("quantum")) score += 3;
	if (link.url.includes("sharepoint.com")) score += 7;
	if (link.url.includes("view_negotiation_dlink")) score += 6;
	if (/\/login\.cfm(?:[?#]|$)/i.test(link.url)) score -= 20;
	if (/\.(pdf|docx?|xlsx?|zip)(?:[?#]|$)/i.test(link.url)) score += 8;
	if (link.url.startsWith("https://")) score += 1;
	return score;
}

function selectPrimaryDetailLink(links: UngmNoticeDetailLink[]): UngmNoticeDetailLink | undefined {
	return [...links].sort((a, b) => scoreDetailLink(b) - scoreDetailLink(a))[0];
}

export function parseUngmNoticeDetailHtml(html: string | undefined, baseUrl = "https://www.ungm.org"): UngmNoticeDetail {
	if (!html?.trim()) return { links: [] };

	const description = cleanText(stripTags(extractHtmlBlockAfterTitle(html, "Description") ?? "")) || undefined;
	const contactEmail = html.match(/mailto:([^"'>\s]+)/i)?.[1];
	const links: UngmNoticeDetailLink[] = [];
	const linksTable = html.match(/<table\b[^>]*id=["']tblLinks["'][^>]*>([\s\S]*?)<\/table>/i)?.[1] ?? "";
	for (const rowMatch of linksTable.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
		const cells = extractTableCells(rowMatch[1]);
		if (cells.length < 2) continue;
		const url = resolveUrl(cells[0], baseUrl);
		if (!url || !/^https?:\/\//i.test(url)) continue;
		links.push({
			url,
			description: cells[1] || undefined,
		});
	}

	return {
		description,
		contactEmail,
		links,
		primaryLink: selectPrimaryDetailLink(links),
	};
}

export function mapUngmNoticeRowToOpportunity(row: UngmNoticeRow): OpportunityData {
	const summaryParts = [
		row.noticeType,
		row.organization ? `published by ${row.organization}` : undefined,
		row.countryRegion ? `for ${row.countryRegion}` : undefined,
	].filter(Boolean);

	return {
		title: row.title,
		source: ungmParser.sourceId,
		sourceId: row.noticeId,
		noticeId: row.reference || row.noticeId,
		organization: row.organization,
		countryRegion: row.countryRegion,
		deadline: row.deadline,
		publishedDate: row.publishedDate,
		category: row.noticeType || "UN procurement notice",
		projectSummary: summaryParts.length ? summaryParts.join(" ") : row.title,
		opportunityType: opportunityTypeFromNoticeType(row.noticeType),
		portalUrl: row.portalUrl,
		rfpLink: row.portalUrl,
		tags: ["ungm", "un-procurement"],
		metadata: {
			ungm: {
				noticeId: row.noticeId,
				reference: row.reference,
				noticeType: row.noticeType,
				countryRegion: row.countryRegion,
			},
		},
	};
}

export function parseUngmSearchHtml(html: string | undefined, baseUrl = "https://www.ungm.org"): OpportunityData[] {
	return parseUngmNoticeRows(html, baseUrl).map(mapUngmNoticeRowToOpportunity);
}

export const ungmParser: TenderParser = {
	sourceId: "ungm",
	name: "United Nations Global Marketplace",
	requiresJavascript: false,

	async parse(content: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseUngmSearchHtml(content.html ?? content.markdown, content.url),
		};
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(ungmParser);

export default ungmParser;
