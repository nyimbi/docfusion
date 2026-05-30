import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const ROW_PATTERN = /<div\b[^>]*class=["'][^"']*c-view__row[^"']*["'][^>]*>([\s\S]*?)(?=<div\b[^>]*class=["'][^"']*c-view__row[^"']*["']|<\/div>\s*<\/div>\s*<\/main>|$)/gi;

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
	return cleanText(decodeHtmlEntities(value.replace(/<script[\s\S]*?<\/script>/gi, " ")
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

function fieldText(block: string, label: string): string | undefined {
	const pattern = new RegExp(`<div\\b[^>]*class=["'][^"']*c-field__label[^"']*["'][^>]*>\\s*${label}\\s*<\\/div>\\s*<div\\b[^>]*class=["'][^"']*c-field__content[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`, "i");
	const value = stripHtml(block.match(pattern)?.[1] ?? "");
	return value || undefined;
}

function dateRangeEnd(block: string): Date | undefined {
	const dateMatches = [...block.matchAll(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/gi)];
	const lastDate = dateMatches[dateMatches.length - 1]?.[1];
	if (!lastDate) return undefined;
	const parsed = new Date(lastDate);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function inferOpportunityType(title: string): OpportunityData["opportunityType"] {
	const normalized = title.toLowerCase();
	if (/\brfi\b|request for information/.test(normalized)) return "tender";
	if (/\brfp\b|request for proposals?/.test(normalized)) return "rfp";
	if (/intent to bid|\bbid\b|tender/.test(normalized)) return "tender";
	return "tender";
}

function sourceIdFrom(detailUrl: string | undefined, title: string): string {
	const slug = (detailUrl ? safePathTail(detailUrl) : title)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
	return `mercy-corps-${slug || "tender"}`;
}

function safePathTail(url: string): string {
	try {
		return new URL(url).pathname.split("/").filter(Boolean).pop() ?? url;
	} catch {
		return url;
	}
}

function parseMercyCorps(content: string | undefined, sourceUrl: string): OpportunityData[] {
	if (!content) return [];
	const opportunities: OpportunityData[] = [];
	const blocks = [...content.matchAll(ROW_PATTERN)].map((match) => match[1] ?? "");
	if (blocks.length === 0) blocks.push(content);

	for (const block of blocks) {
		if (!/c-button-box/.test(block)) continue;
		const titleHtml = block.match(/<h3\b[^>]*class=["'][^"']*c-button-box__title[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1];
		const title = stripHtml(titleHtml ?? "");
		if (title.length < 8) continue;
		const detailUrl = absoluteUrl(block.match(/<a\b[^>]*class=["'][^"']*c-button-box__link[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1]
			?? block.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*c-button[^"']*["']/i)?.[1], sourceUrl);
		const country = fieldText(block, "Country of destination");
		const tenderingOffice = fieldText(block, "Tendering office");

		opportunities.push({
			title,
			source: "mercy_corps",
			sourceId: sourceIdFrom(detailUrl, title),
			organization: "Mercy Corps",
			countryRegion: country,
			category: "Mercy Corps tender",
			opportunityType: inferOpportunityType(title),
			deadline: dateRangeEnd(block),
			portalUrl: detailUrl ?? sourceUrl,
			documentUrl: detailUrl,
			rfpLink: detailUrl ?? sourceUrl,
			projectSummary: tenderingOffice ? `Tendering office: ${tenderingOffice}` : undefined,
			tags: ["mercy-corps", "ngo", "source-scrape"],
			metadata: {
				mercyCorps: {
					sourcePage: sourceUrl,
					tenderingOffice,
				},
			},
		});
	}

	return opportunities;
}

export const mercyCorpsParser: TenderParser = {
	sourceId: "mercy_corps",
	name: "Mercy Corps Tenders",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseMercyCorps(input.html ?? input.markdown, input.url),
		};
	},

	getPageUrl(baseUrl: string, page: number): string {
		const url = new URL(baseUrl);
		if (page > 1) url.searchParams.set("page", String(page - 1));
		return url.toString();
	},

	hasNextPage(content: ParseInput): boolean {
		return /\brel=["']next["']|Load More|pager__item/i.test(content.html ?? content.markdown ?? "");
	},
};

registerParser(mercyCorpsParser);
