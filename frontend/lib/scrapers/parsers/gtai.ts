import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const GTAI_KFW_TENDER_SEARCH_URL = "https://www.gtai.de/en/meta/search/kfw-tenders/795748!search";
const RESULT_BLOCK_PATTERN = /<div\b[^>]*class=["'][^"']*search-result[^"']*["'][^>]*>[\s\S]*?(?=<div\b[^>]*class=["'][^"']*search-result[^"']*["']|$)/gi;
const RESULT_LINK_PATTERN = /<a\b[^>]*href=["']([^"']*\/en\/trade\/[^"']*\/tenders\/[^"']+)["'][^>]*>\s*<h3\b[^>]*>([\s\S]*?)<\/h3>\s*<\/a>/gi;

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

function sourceIdFrom(detailUrl: string | undefined, title: string): string {
	const numericId = detailUrl?.match(/--?(\d+)(?:[/?#]|$)/)?.[1];
	const slug = (numericId ?? title)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
	return `gtai-kfw-${slug || "tender"}`;
}

function countryFromUrl(detailUrl: string | undefined): string | undefined {
	if (!detailUrl) return undefined;
	try {
		const [, country] = new URL(detailUrl).pathname.match(/^\/en\/trade\/([^/]+)\/tenders\//) ?? [];
		if (!country) return undefined;
		return decodeURIComponent(country)
			.replace(/-/g, " ")
			.replace(/\b\w/g, (letter) => letter.toUpperCase());
	} catch {
		return undefined;
	}
}

function isClosedTenderResult(context: string): boolean {
	return /Tender\s+Award|Cancellation\s+Notice/i.test(stripHtml(context));
}

function nextPageUrl(content: string, sourceUrl: string): string | undefined {
	const href = content.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*title=["'][^"']*Next page[^"']*["']/i)?.[1]
		?? content.match(/<a\b[^>]*title=["'][^"']*Next page[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1];
	return absoluteUrl(href, sourceUrl);
}

function parseGtaiKfwTenders(content: string | undefined, sourceUrl: string): OpportunityData[] {
	if (!content) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();
	const resultBlocks = [...content.matchAll(RESULT_BLOCK_PATTERN)].map((match) => match[0]);
	const blocks = resultBlocks.length > 0 ? resultBlocks : [content];

	for (const block of blocks) {
		if (isClosedTenderResult(block)) continue;

		for (const match of block.matchAll(RESULT_LINK_PATTERN)) {
			const href = match[1];
			const title = stripHtml(match[2] ?? "");
			if (title.length < 8) continue;

			const detailUrl = absoluteUrl(href, sourceUrl);
			if (!detailUrl || seen.has(detailUrl)) continue;

			seen.add(detailUrl);
			const summary = stripHtml(block.match(/<p\b[^>]*class=["'][^"']*excerpt[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");

			opportunities.push({
				title,
				source: "gtai_kfw",
				sourceId: sourceIdFrom(detailUrl, title),
				organization: "GTAI / KfW Entwicklungsbank",
				countryRegion: countryFromUrl(detailUrl),
				category: "GTAI KfW tender",
				opportunityType: /request for proposals?|\brfp\b/i.test(`${title} ${summary}`) ? "rfp" : "tender",
				portalUrl: detailUrl,
				documentUrl: detailUrl,
				rfpLink: detailUrl,
				projectSummary: summary || undefined,
				tags: ["gtai", "kfw", "development-bank", "source-scrape"],
				metadata: {
					gtai: {
						sourcePage: sourceUrl,
						resultUrl: detailUrl,
					},
				},
			});
		}
	}

	return opportunities;
}

export const gtaiParser: TenderParser = {
	sourceId: "gtai_kfw",
	name: "GTAI KfW Tenders",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		const content = input.html ?? input.markdown ?? "";
		return {
			opportunities: parseGtaiKfwTenders(content, input.url),
			nextPageUrl: nextPageUrl(content, input.url),
		};
	},

	getPageUrl(baseUrl: string, page: number): string {
		const url = new URL(baseUrl || GTAI_KFW_TENDER_SEARCH_URL);
		if (page > 1) url.searchParams.set("page", String(page - 1));
		else url.searchParams.delete("page");
		return url.toString();
	},

	hasNextPage(content: ParseInput): boolean {
		return Boolean(nextPageUrl(content.html ?? content.markdown ?? "", content.url));
	},
};

registerParser(gtaiParser);
