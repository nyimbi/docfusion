import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

export const IRC_PROCUREMENT_URL = "https://www.rescue.org/procurement-policies-and-bid-opportunities";

const CARD_PATTERN = /<div\b[^>]*class=["'][^"']*\brplc-teaser-basic\b[^"']*["'][^>]*>([\s\S]*?)(?=<\/li>\s*<li\b[^>]*class=["'][^"']*\brpll-one-column-list__item\b|<\/ul>|$)/gi;
const DOCUMENT_LINK_PATTERN = /\.(?:pdf|docx?|xlsx?|zip)(?:[?#].*)?$/i;
const DETAIL_LIMIT = 20;

type IrcDetail = {
	documentLinks: Array<{ url: string; label?: string }>;
	summary?: string;
};

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
		.replace(/&mdash;/g, "-")
		.replace(/&rsquo;/g, "'")
		.replace(/&lsquo;/g, "'")
		.replace(/&ldquo;/g, "\"")
		.replace(/&rdquo;/g, "\"");
}

function stripHtml(value: string): string {
	return cleanText(decodeHtmlEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function absoluteUrl(rawUrl: string | undefined | null, sourceUrl: string): string | undefined {
	if (!rawUrl) return undefined;
	try {
		const parsed = new URL(decodeHtmlEntities(rawUrl.trim()), sourceUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
		parsed.hash = "";
		return parsed.toString();
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

function sourceIdFor(title: string, portalUrl: string): string {
	try {
		const pathSlug = new URL(portalUrl).pathname.replace(/^\/rfp\/|\/$/g, "");
		return `irc-${slugify(decodeURIComponent(pathSlug) || title) || "rfp"}`;
	} catch {
		return `irc-${slugify(title) || "rfp"}`;
	}
}

function parseIrcDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	return parseDate(value.replace(/\s+/g, " ").trim());
}

function extractDocumentLinks(content: string, sourceUrl: string): Array<{ url: string; label?: string }> {
	const links: Array<{ url: string; label?: string }> = [];
	const seen = new Set<string>();
	for (const match of content.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
		const href = decodeHtmlEntities(match[1] ?? "");
		const label = stripHtml(match[2] ?? "");
		const url = absoluteUrl(href, sourceUrl);
		if (!url || seen.has(url)) continue;
		const haystack = `${label} ${url}`.toLowerCase();
		if (!DOCUMENT_LINK_PATTERN.test(url) && !/\b(?:box\.com|forms\.cloud\.microsoft|download|rfp|request for proposal|rfq|quote|bid|tender)\b/i.test(haystack)) continue;
		seen.add(url);
		links.push({
			url,
			...(label ? { label } : {}),
		});
	}
	return links;
}

function parseIrcDetailHtml(content: string | undefined, sourceUrl: string): IrcDetail {
	if (!content) return { documentLinks: [] };
	const main = content.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? content.match(/<body\b[\s\S]*?<\/body>/i)?.[0] ?? content;
	return {
		documentLinks: extractDocumentLinks(main, sourceUrl),
		summary: stripHtml(main).slice(0, 1800) || undefined,
	};
}

function opportunityType(title: string, typeText: string): OpportunityData["opportunityType"] {
	const haystack = `${title} ${typeText}`.toLowerCase();
	if (/\brfq\b|request for quote|request for quotation/.test(haystack)) return "tender";
	if (/\brfp\b|request for proposals?/.test(haystack)) return "rfp";
	return "tender";
}

function opportunityFromCard(card: string, sourceUrl: string, detail?: IrcDetail): OpportunityData | undefined {
	const linkMatch = card.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*\brplc-teaser-basic__wrapper-link\b[^"']*["'][^>]*>/i);
	const portalUrl = absoluteUrl(linkMatch?.[1], sourceUrl);
	const title = stripHtml(card.match(/<h2\b[^>]*class=["'][^"']*\brplc-teaser-basic__title\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "");
	if (!portalUrl || title.length < 6) return undefined;

	const typeText = stripHtml(card.match(/<div\b[^>]*class=["'][^"']*\brplc-teaser-basic__slug\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? "");
	const dateText = stripHtml(card.match(/<div\b[^>]*class=["'][^"']*\brplc-teaser-basic__date\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? "");
	const summary = stripHtml(card.match(/<div\b[^>]*class=["'][^"']*\brplc-teaser-basic__summary\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? "");
	const documentUrl = detail?.documentLinks[0]?.url ?? portalUrl;

	return {
		title,
		source: "irc",
		sourceId: sourceIdFor(title, portalUrl),
		organization: "International Rescue Committee",
		category: "IRC bid opportunity",
		opportunityType: opportunityType(title, typeText),
		publishedDate: parseIrcDate(dateText),
		portalUrl,
		documentUrl,
		rfpLink: documentUrl,
		projectSummary: detail?.summary || summary || "International Rescue Committee bid opportunity.",
		tags: ["irc", "ngo", "source-scrape", "source-documents"],
		metadata: {
			irc: {
				sourcePage: sourceUrl,
				portalUrl,
				type: typeText || undefined,
				listDate: dateText || undefined,
				documentLinks: detail?.documentLinks ?? [],
			},
		},
	};
}

export function parseIrcProcurementHtml(
	content: string | undefined,
	sourceUrl = IRC_PROCUREMENT_URL,
	detailsByUrl = new Map<string, IrcDetail>()
): OpportunityData[] {
	if (!content) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();
	for (const match of content.matchAll(CARD_PATTERN)) {
		const card = match[0];
		const portalUrl = absoluteUrl(card.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*\brplc-teaser-basic__wrapper-link\b/i)?.[1], sourceUrl);
		const opportunity = opportunityFromCard(card, sourceUrl, portalUrl ? detailsByUrl.get(portalUrl) : undefined);
		if (!opportunity?.sourceId || seen.has(opportunity.sourceId)) continue;
		seen.add(opportunity.sourceId);
		opportunities.push(opportunity);
	}
	return opportunities;
}

async function fetchIrcDetail(portalUrl: string): Promise<IrcDetail | undefined> {
	const response = await fetch(portalUrl, {
		method: "GET",
		signal: AbortSignal.timeout(20000),
		headers: {
			Accept: "text/html",
			"User-Agent": "DocFusionRfpSourceCollector/1.0",
		},
		redirect: "manual",
	});
	if (response.status >= 300 && response.status < 400) {
		const location = response.headers.get("location");
		const url = absoluteUrl(location, portalUrl);
		return url ? { documentLinks: [{ url, label: url }] } : undefined;
	}
	if (!response.ok) return undefined;
	const contentType = response.headers.get("content-type") ?? "";
	if (!/\btext\/html\b/i.test(contentType)) {
		return { documentLinks: [{ url: response.url || portalUrl, label: response.url || portalUrl }] };
	}
	return parseIrcDetailHtml(await response.text(), portalUrl);
}

async function fetchIrcListing(sourceUrl: string): Promise<string> {
	const response = await fetch(sourceUrl, {
		method: "GET",
		signal: AbortSignal.timeout(20000),
		headers: {
			Accept: "text/html",
			"User-Agent": "DocFusionRfpSourceCollector/1.0",
		},
	});
	if (!response.ok) throw new Error(`IRC procurement page returned HTTP ${response.status}`);
	return response.text();
}

async function enrichIrcDetails(opportunities: OpportunityData[]): Promise<Map<string, IrcDetail>> {
	const detailsByUrl = new Map<string, IrcDetail>();
	for (const opportunity of opportunities.slice(0, DETAIL_LIMIT)) {
		const portalUrl = opportunity.portalUrl;
		if (!portalUrl || detailsByUrl.has(portalUrl)) continue;
		const detail = await fetchIrcDetail(portalUrl);
		if (detail) detailsByUrl.set(portalUrl, detail);
	}
	return detailsByUrl;
}

export const ircParser: TenderParser = {
	sourceId: "irc",
	name: "International Rescue Committee Bid Opportunities",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			const sourceUrl = input.url || IRC_PROCUREMENT_URL;
			const content = input.html ?? input.markdown ?? await fetchIrcListing(sourceUrl);
			const preliminary = parseIrcProcurementHtml(content, sourceUrl);
			const detailsByUrl = await enrichIrcDetails(preliminary);
			return { opportunities: parseIrcProcurementHtml(content, sourceUrl, detailsByUrl) };
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch IRC bid opportunities",
			};
		}
	},

	getPageUrl(baseUrl: string, page: number): string {
		const url = new URL(baseUrl || IRC_PROCUREMENT_URL);
		if (page > 1) url.searchParams.set("page", String(page - 1));
		return url.toString();
	},

	hasNextPage(content: ParseInput): boolean {
		return /\brel=["']next["']|title=["']Go to next page["']/i.test(content.html ?? content.markdown ?? "");
	},
};

registerParser(ircParser);

export { parseIrcDetailHtml };
