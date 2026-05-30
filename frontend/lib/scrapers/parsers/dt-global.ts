import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const DT_GLOBAL_PROPOSALS_URL = "https://dt-global.com/proposals/";
const LIST_CARD_PATTERN = /<div\b[^>]*id=["']div_block-23-4572-\d+["'][^>]*>([\s\S]*?)(?=<div\b[^>]*id=["']div_block-23-4572-\d+["']|<div\b[^>]*class=["'][^"']*oxy-easy-posts-pages|<\/section>|$)/gi;
const DOCUMENT_LINK_PATTERN = /(?:\b(?:documents?|request for proposal|tender addendum|application|template|form)\b|\brfp\b|rfp[_/-])/i;

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

function pathTail(url: string | undefined): string | undefined {
	if (!url) return undefined;
	try {
		return new URL(url).pathname.split("/").filter(Boolean).pop();
	} catch {
		return undefined;
	}
}

function utcStartOfDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isExpired(deadline: Date | undefined, now = new Date()): boolean {
	if (!deadline) return false;
	return deadline.getTime() < utcStartOfDay(now).getTime();
}

function extractTitleAndUrl(block: string, sourceUrl: string): { title?: string; portalUrl?: string } {
	const linkedTitle = block.match(/<h5\b[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
		?? block.match(/<a\b[^>]*href=["']([^"']*\/proposals\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
	const portalUrl = absoluteUrl(linkedTitle?.[1], sourceUrl);
	const title = stripHtml(linkedTitle?.[2] ?? "");
	return {
		title: title.length >= 8 ? title : undefined,
		portalUrl,
	};
}

function firstMatchText(block: string, pattern: RegExp): string | undefined {
	const value = stripHtml(block.match(pattern)?.[1] ?? "");
	return value || undefined;
}

function extractSummary(block: string): string | undefined {
	return firstMatchText(block, /<div\b[^>]*id=["']text_block-47-4572-\d+["'][^>]*>([\s\S]*?)<\/div>/i)
		?? [...block.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
			.map((match) => stripHtml(match[1] ?? ""))
			.find((text) => text.length > 30);
}

function parseDtDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	const withoutWeekday = value
		.replace(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+/gi, "")
		.replace(/\b\d{1,2}[.:]\d{2}\s*(?:am|pm)?\b/gi, " ")
		.replace(/\b(?:hrs|hours|GMT|UTC|AEST|AEDT|Melbourne|Apia|Samoa|time|on|at)\b/gi, " ");
	const candidates = [
		value.match(/\b(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/)?.[1],
		withoutWeekday.match(/\b(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/)?.[1],
		value.match(/\b([A-Za-z]+\s+\d{1,2},\s+\d{4})\b/)?.[1],
		withoutWeekday.match(/\b([A-Za-z]+\s+\d{1,2},\s+\d{4})\b/)?.[1],
	];
	for (const candidate of candidates) {
		const parsed = parseDate(candidate);
		if (parsed) return parsed;
	}
	return parseDate(withoutWeekday) ?? parseDate(value);
}

function extractDeadline(block: string): Date | undefined {
	return parseDtDate(firstMatchText(block, /<div\b[^>]*id=["']text_block-100-4572-\d+["'][^>]*>([\s\S]*?)<\/div>/i)
		?? stripHtml(block).match(/\b(?:deadline|closing|application deadline)[\s\S]{0,180}?(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},\s+\d{4})/i)?.[1]
		?? stripHtml(block));
}

function inferOpportunityType(title: string): OpportunityData["opportunityType"] {
	const normalized = title.toLowerCase();
	if (/\brfq\b|request for quotations?/.test(normalized)) return "tender";
	if (/\brft\b|request for tender|tender/.test(normalized)) return "tender";
	if (/\brfp\b|request for proposals?/.test(normalized)) return "rfp";
	return "tender";
}

function documentLinksFromBlock(block: string, sourceUrl: string): Array<{ url: string; label?: string }> {
	const links: Array<{ url: string; label?: string }> = [];
	const seen = new Set<string>();
	for (const match of block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
		const label = stripHtml(match[2] ?? "");
		const href = decodeHtmlEntities(match[1] ?? "");
		if (!DOCUMENT_LINK_PATTERN.test(`${label} ${href}`) && !/\.(?:pdf|docx?|xlsx?|zip)(?:[?#].*)?$/i.test(href)) continue;
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

function sourceIdFrom(title: string, portalUrl: string | undefined): string {
	return `dt-global-${slugify(pathTail(portalUrl) ?? title) || "proposal"}`;
}

function buildOpportunity(
	title: string,
	portalUrl: string | undefined,
	sourceUrl: string,
	block: string,
	now = new Date()
): OpportunityData | undefined {
	const summary = extractSummary(block);
	const deadline = extractDeadline(block);
	if (isExpired(deadline, now)) return undefined;
	const documentLinks = documentLinksFromBlock(block, portalUrl ?? sourceUrl);
	const documentUrl = documentLinks[0]?.url ?? portalUrl ?? sourceUrl;
	const sourceId = sourceIdFrom(title, portalUrl);

	return {
		title,
		source: "dt_global",
		sourceId,
		noticeId: title.match(/\b(?:RFP|RFQ|RFT|EOI|SO)\b[\/A-Z0-9-]+/i)?.[0] ?? pathTail(portalUrl) ?? sourceId,
		organization: "DT Global",
		category: "DT Global proposal",
		opportunityType: inferOpportunityType(title),
		deadline,
		portalUrl: portalUrl ?? sourceUrl,
		documentUrl,
		rfpLink: documentUrl,
		projectSummary: summary ?? "DT Global proposal opportunity.",
		tags: ["dt-global", "donor-implementer", "source-scrape", "source-documents"],
		metadata: {
			dtGlobal: {
				sourcePage: sourceUrl,
				documentLinks,
			},
		},
	};
}

function parseList(content: string, sourceUrl: string): OpportunityData[] {
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();
	for (const match of content.matchAll(LIST_CARD_PATTERN)) {
		const block = match[0];
		const { title, portalUrl } = extractTitleAndUrl(block, sourceUrl);
		if (!title || !/\b(?:rfp|rfq|rft|request|proposal|tender)\b/i.test(title)) continue;
		const opportunity = buildOpportunity(title, portalUrl, sourceUrl, block);
		if (!opportunity || seen.has(opportunity.sourceId ?? opportunity.title)) continue;
		seen.add(opportunity.sourceId ?? opportunity.title);
		opportunities.push(opportunity);
	}
	return opportunities;
}

function parseDetail(content: string, sourceUrl: string): OpportunityData[] {
	const title = stripHtml(content.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "")
		|| stripHtml(content.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+-\s+DTGlobal$/i, "");
	if (!title || !/\b(?:rfp|rfq|rft|request|proposal|tender)\b/i.test(title)) return [];
	const opportunity = buildOpportunity(title, sourceUrl, sourceUrl, content);
	return opportunity ? [opportunity] : [];
}

export const dtGlobalParser: TenderParser = {
	sourceId: "dt_global",
	name: "DT Global Proposals",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		const content = input.html ?? input.markdown ?? "";
		const sourceUrl = input.url || DT_GLOBAL_PROPOSALS_URL;
		const opportunities = /\/proposals\/[^/?#]+\/?$/i.test(new URL(sourceUrl).pathname)
			? parseDetail(content, sourceUrl)
			: parseList(content, sourceUrl);
		return { opportunities };
	},

	getPageUrl(baseUrl: string, page: number): string {
		const normalized = baseUrl || DT_GLOBAL_PROPOSALS_URL;
		if (page <= 1) return normalized;
		return new URL(`/proposals/page/${page}/`, normalized).toString();
	},

	hasNextPage(input: ParseInput, currentPage: number): boolean {
		const content = input.html ?? input.markdown ?? "";
		return new RegExp(`/proposals/page/${currentPage + 1}/`, "i").test(content);
	},
};

registerParser(dtGlobalParser);
