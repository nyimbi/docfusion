import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const UN_WOMEN_PROCUREMENT_URL = "https://www.unwomen.org/en/about-us/procurement";
const NOTICE_LINK_PATTERN = /<a\b[^>]*href=["'](https?:\/\/(?:www\.)?ungm\.org\/Public\/notice\/(\d+))["'][^>]*>([\s\S]*?)<\/a>/gi;

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
		.replace(/<[^>]+>/g, " ")));
}

function utcStartOfDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isExpired(deadline: Date | undefined, now = new Date()): boolean {
	if (!deadline) return false;
	return deadline.getTime() < utcStartOfDay(now).getTime();
}

function deadlineFromContext(context: string): Date | undefined {
	const datetime = context.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i)?.[1];
	if (datetime) {
		const parsed = new Date(datetime);
		if (!Number.isNaN(parsed.getTime())) return parsed;
	}

	const text = stripHtml(context);
	const deadlineText = text.match(/\bDeadline:\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i)?.[1];
	return parseDate(deadlineText);
}

function inferOpportunityType(title: string): OpportunityData["opportunityType"] {
	const normalized = title.toLowerCase();
	if (/\beoi\b|expression of interest/.test(normalized)) return "eoi";
	if (/\brfq\b|request for quotation/.test(normalized)) return "tender";
	if (/\bitb\b|invitation to bid|invitation to tender|\bbid\b/.test(normalized)) return "tender";
	if (/\brfp\b|request for proposals?/.test(normalized)) return "rfp";
	return "tender";
}

function parseUnWomenProcurement(content: string | undefined, sourceUrl: string, now = new Date()): OpportunityData[] {
	if (!content) return [];
	const opportunities: OpportunityData[] = [];
	const seenNoticeIds = new Set<string>();

	for (const match of content.matchAll(NOTICE_LINK_PATTERN)) {
		const portalUrl = decodeHtmlEntities(match[1] ?? "");
		const noticeId = match[2] ?? "";
		const title = stripHtml(match[3] ?? "");
		if (!noticeId || seenNoticeIds.has(noticeId) || title.length < 8) continue;

		const contextStart = Math.max(0, match.index ?? 0);
		const contextEnd = Math.min(content.length, contextStart + match[0].length + 500);
		const context = content.slice(contextStart, contextEnd);
		const deadline = deadlineFromContext(context);
		if (isExpired(deadline, now)) continue;

		seenNoticeIds.add(noticeId);
		opportunities.push({
			title,
			source: "un_women",
			sourceId: `un-women-${noticeId}`,
			noticeId,
			organization: "UN Women",
			category: "UN Women procurement",
			opportunityType: inferOpportunityType(title),
			deadline,
			portalUrl,
			documentUrl: portalUrl,
			rfpLink: portalUrl,
			projectSummary: deadline
				? `UN Women procurement notice. Deadline: ${deadline.toISOString().slice(0, 10)}.`
				: "UN Women procurement notice.",
			tags: ["un-women", "un-procurement", "ungm", "source-scrape"],
			metadata: {
				unWomen: {
					sourcePage: sourceUrl,
					noticeId,
				},
			},
		});
	}

	return opportunities;
}

export const unWomenParser: TenderParser = {
	sourceId: "un_women",
	name: "UN Women Procurement",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseUnWomenProcurement(input.html ?? input.markdown, input.url),
		};
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || UN_WOMEN_PROCUREMENT_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(unWomenParser);
