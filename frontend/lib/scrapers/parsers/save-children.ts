import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const ROW_PATTERN = /<div\b[^>]*class=["'][^"']*views-row[^"']*["'][^>]*>([\s\S]*?)(?=<div\b[^>]*class=["'][^"']*views-row[^"']*["']|<ul\b[^>]*class=["'][^"']*js-pager__items|$)/gi;

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

function htmlByClass(block: string, className: string): string | undefined {
	const pattern = new RegExp(`<div\\b[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`, "i");
	return block.match(pattern)?.[1];
}

function titleFromCard(block: string): string | undefined {
	const titleHtml = block.match(/<h3\b[^>]*class=["'][^"']*three_col-listing-card__[^"']*h3[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1];
	const title = stripHtml(titleHtml ?? "");
	return title.length >= 8 ? title : undefined;
}

function endDateFromCard(block: string): Date | undefined {
	const endHtml = htmlByClass(block, "three_col-listing-card__end-date");
	const datetime = endHtml?.match(/datetime=["']([^"']+)["']/i)?.[1];
	if (datetime) {
		const parsed = new Date(datetime);
		if (!Number.isNaN(parsed.getTime())) return parsed;
	}
	const text = stripHtml(endHtml ?? "").replace(/\s+-\s+.*$/, "");
	return parseDate(text);
}

function inferOpportunityType(title: string, typeText: string): OpportunityData["opportunityType"] {
	const haystack = `${title} ${typeText}`.toLowerCase();
	if (/\brfi\b|request for information|market dialogue/.test(haystack)) return "tender";
	if (/\brfp\b|request for proposals?/.test(haystack)) return "rfp";
	if (/\bitt\b|invitation to tender|tender/.test(haystack)) return "tender";
	return "tender";
}

function sourceIdFrom(detailUrl: string | undefined, title: string): string {
	const slug = (detailUrl ? safePathTail(detailUrl) : title)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
	return `save-children-${slug || "tender"}`;
}

function safePathTail(url: string): string {
	try {
		return new URL(url).pathname.split("/").filter(Boolean).pop() ?? url;
	} catch {
		return url;
	}
}

function parseSaveChildren(content: string | undefined, sourceUrl: string): OpportunityData[] {
	if (!content) return [];
	const opportunities: OpportunityData[] = [];
	const blocks = [...content.matchAll(ROW_PATTERN)].map((match) => match[1] ?? "");
	if (blocks.length === 0) blocks.push(content);

	for (const block of blocks) {
		if (!/three_col-listing-card/.test(block)) continue;
		const title = titleFromCard(block);
		if (!title) continue;
		const readMorePath = block.match(/<div\b[^>]*class=["'][^"']*three_col-listing-card__link[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["']/i)?.[1];
		const detailUrl = absoluteUrl(readMorePath, sourceUrl);
		const description = stripHtml(htmlByClass(block, "three_col-listing-card__description") ?? "");
		const country = stripHtml(htmlByClass(block, "three_col-listing-card__country") ?? "") || undefined;
		const typeText = stripHtml(htmlByClass(block, "three_col-listing-card__type") ?? "");
		const deadline = endDateFromCard(block);
		const sourceId = sourceIdFrom(detailUrl, title);

		opportunities.push({
			title,
			source: "save_children",
			sourceId,
			organization: "Save the Children International",
			countryRegion: country,
			category: "Save the Children tender",
			opportunityType: inferOpportunityType(title, typeText),
			deadline,
			portalUrl: detailUrl ?? sourceUrl,
			documentUrl: detailUrl,
			rfpLink: detailUrl ?? sourceUrl,
			projectSummary: description || undefined,
			tags: ["save-the-children", "ngo", "source-scrape"],
			metadata: {
				saveChildren: {
					sourcePage: sourceUrl,
					type: typeText || undefined,
				},
			},
		});
	}

	return opportunities;
}

export const saveChildrenParser: TenderParser = {
	sourceId: "save_children",
	name: "Save the Children Tenders",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseSaveChildren(input.html ?? input.markdown, input.url),
		};
	},

	getPageUrl(baseUrl: string, page: number): string {
		const url = new URL(baseUrl);
		if (page > 1) url.searchParams.set("page", String(page - 1));
		return url.toString();
	},

	hasNextPage(content: ParseInput): boolean {
		return /\brel=["']next["']|data-drupal-views-infinite-scroll-pager|Load More/i.test(content.html ?? content.markdown ?? "");
	},
};

registerParser(saveChildrenParser);
