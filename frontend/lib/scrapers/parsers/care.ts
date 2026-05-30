import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const CARE_RFP_URL = "https://www.care.org/about-us/contact-us/request-for-proposals/";
const CARE_ENTRY_PATTERN = /<h3\b[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b[^>]*class=["'][^"']*\btitle\b|<section\b[^>]*class=["'][^"']*footer|$)/gi;

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
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
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

function parseCareDeadline(blockText: string): Date | undefined {
	const candidate = blockText.match(/\bTender submission deadline:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i)?.[1]
		?? blockText.match(/\b(?:deadline|due date|closing date)\s*:?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i)?.[1];
	return parseDate(candidate);
}

function inferOpportunityType(title: string): OpportunityData["opportunityType"] {
	const normalized = title.toLowerCase();
	if (/\brfq\b|request for quotations?/.test(normalized)) return "tender";
	if (/\btender\b/.test(normalized)) return "tender";
	return "rfp";
}

function extractDocumentLinks(block: string, sourceUrl: string): Array<{ url: string; label?: string }> {
	const links: Array<{ url: string; label?: string }> = [];
	const seen = new Set<string>();
	for (const match of block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
		const label = stripHtml(match[2] ?? "");
		const href = decodeHtmlEntities(match[1] ?? "");
		if (!/\.(?:pdf|docx?|xlsx?|zip)(?:[?#].*)?$/i.test(href) && !/\b(?:sow|rfp|rfq|tender|document package|terms of reference)\b/i.test(label)) continue;
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

function descriptionFrom(block: string): string | undefined {
	const description = stripHtml(block.match(/<strong>\s*Description:\s*<\/strong>[\s\S]*?<br\s*\/?>([\s\S]*?)<\/p>/i)?.[1] ?? "");
	if (description) return description;
	return [...block.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
		.map((match) => stripHtml(match[1] ?? ""))
		.find((text) => text.length > 30 && !/^Tender submission deadline:/i.test(text));
}

function parseCareRfps(content: string | undefined, sourceUrl: string, now = new Date()): OpportunityData[] {
	if (!content) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const match of content.matchAll(CARE_ENTRY_PATTERN)) {
		const title = stripHtml(match[1] ?? "");
		if (title.length < 8 || /^Current opportunities$/i.test(title)) continue;
		const block = match[2] ?? "";
		const blockText = stripHtml(block);
		const deadline = parseCareDeadline(blockText);
		if (isExpired(deadline, now)) continue;
		const documentLinks = extractDocumentLinks(block, sourceUrl);
		const sourceId = `care-${slugify(title) || "rfp"}`;
		if (seen.has(sourceId)) continue;
		seen.add(sourceId);

		opportunities.push({
			title,
			source: "care",
			sourceId,
			organization: "CARE",
			category: "CARE RFP/RFQ",
			opportunityType: inferOpportunityType(title),
			deadline,
			portalUrl: sourceUrl,
			documentUrl: documentLinks[0]?.url ?? sourceUrl,
			rfpLink: documentLinks[0]?.url ?? sourceUrl,
			projectSummary: descriptionFrom(block) ?? "CARE request for proposals or quotations.",
			tags: ["care", "ngo", "source-scrape", "source-documents"],
			metadata: {
				care: {
					sourcePage: sourceUrl,
					documentLinks,
				},
			},
		});
	}

	return opportunities;
}

export const careParser: TenderParser = {
	sourceId: "care",
	name: "CARE Request for Proposals",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseCareRfps(input.html ?? input.markdown, input.url || CARE_RFP_URL),
		};
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || CARE_RFP_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(careParser);
