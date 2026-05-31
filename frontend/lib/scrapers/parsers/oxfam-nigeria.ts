import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const OXFAM_NIGERIA_PROCUREMENT_URL = "https://nigeria.oxfam.org/procurement-and-consultancy";

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
		.replace(/&mdash;/g, "-");
}

function stripHtml(value: string): string {
	return cleanText(decodeHtmlEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>|<\/ul>|<\/ol>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function absoluteUrl(rawUrl: string | undefined | null, sourceUrl: string): string | undefined {
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

function extractMainContent(content: string): string {
	return content.match(/<main\b[\s\S]*?<\/main>/i)?.[0]
		?? content.match(/<article\b[\s\S]*?<\/article>/i)?.[0]
		?? content;
}

function parseCandidateDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	return parseDate(value
		.replace(/\bat\s+\d{1,2}[:.]\d{2}(?:\s*(?:am|pm))?/gi, " ")
		.replace(/\([^)]*\)/g, " ")
		.trim());
}

function extractDeadline(text: string): Date | undefined {
	const match = text.match(/\bSubmission Deadline:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i)
		?? text.match(/\b(?:deadline|closing date|due date)\s*:?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
	return parseCandidateDate(match?.[1]);
}

function extractTitle(content: string, text: string): string {
	const objective = content.match(/<strong>\s*Main Objective\s*<\/strong>\s*<\/p>\s*<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1];
	const cleanedObjective = stripHtml(objective ?? "");
	if (cleanedObjective.length >= 20) return cleanedObjective;
	const firstParagraph = stripHtml(content.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
	if (firstParagraph.length >= 20) return firstParagraph.slice(0, 180);
	return text.slice(0, 180) || "Oxfam in Nigeria procurement and consultancy opportunity";
}

function extractDocumentLinks(content: string, sourceUrl: string): Array<{ url: string; label?: string }> {
	const links: Array<{ url: string; label?: string }> = [];
	const seen = new Set<string>();
	for (const match of content.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
		const label = stripHtml(match[2] ?? "");
		const href = match[1] ?? "";
		if (!/\b(?:terms of reference|tor|request for proposal|rfp|tender|download)\b/i.test(`${label} ${href}`)) continue;
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

export function parseOxfamNigeriaProcurementHtml(
	content: string | undefined,
	sourceUrl = OXFAM_NIGERIA_PROCUREMENT_URL,
	now = new Date()
): OpportunityData[] {
	if (!content) return [];
	const main = extractMainContent(content);
	const text = stripHtml(main);
	if (!/\bSubmission Deadline\b/i.test(text) || !/\bproposal|terms of reference|consultancy|procurement\b/i.test(text)) return [];
	const deadline = extractDeadline(text);
	if (isExpired(deadline, now)) return [];
	const title = extractTitle(main, text);
	const documentLinks = extractDocumentLinks(main, sourceUrl);
	const documentUrl = documentLinks[0]?.url ?? sourceUrl;

	return [{
		title,
		source: "oxfam_nigeria",
		sourceId: `oxfam-nigeria-${slugify(title) || "procurement"}`,
		organization: "Oxfam in Nigeria",
		category: "Oxfam consultancy procurement",
		opportunityType: "rfp",
		countryRegion: "Nigeria",
		deadline,
		portalUrl: sourceUrl,
		documentUrl,
		rfpLink: documentUrl,
		projectSummary: text.slice(0, 2200),
		tags: ["oxfam-nigeria", "ngo", "source-scrape", "source-documents"],
		metadata: {
			oxfamNigeria: {
				sourcePage: sourceUrl,
				documentLinks,
			},
		},
	}];
}

export const oxfamNigeriaParser: TenderParser = {
	sourceId: "oxfam_nigeria",
	name: "Oxfam in Nigeria Procurement and Consultancy",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseOxfamNigeriaProcurementHtml(input.html ?? input.markdown, input.url || OXFAM_NIGERIA_PROCUREMENT_URL),
		};
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || OXFAM_NIGERIA_PROCUREMENT_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(oxfamNigeriaParser);
