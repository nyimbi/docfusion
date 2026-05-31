import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const WINROCK_CONTRACTS_URL = "https://winrock.org/contracts/";
const WINROCK_CARD_PATTERN = /<div\b[^>]*class=["'][^"']*\bborder-t-6\b[^"']*["'][^>]*>([\s\S]*?)(?=<div\b[^>]*class=["'][^"']*\bborder-t-6\b|<\/main>|$)/gi;
const DOCUMENT_LINK_PATTERN = /\.(?:pdf|docx?|xlsx?|zip)(?:[?#].*)?$/i;

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
		.replace(/&rdquo;/g, "\"")
		.replace(/&hellip;/g, "...");
}

function stripHtml(value: string): string {
	return cleanText(decodeHtmlEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>|<\/ul>|<\/ol>/gi, " ")
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

function normalizeReference(value: string | undefined): string | undefined {
	const normalized = value?.replace(/\s+/g, " ").replace(/\s*-\s*/g, "-").trim();
	return normalized || undefined;
}

function extractReference(text: string): string | undefined {
	const match = text.match(/\b(?:RFP|RFQ|EOI|ITB)[-\s][A-Z0-9]+(?:[-\s._/]+[A-Z0-9]+){1,8}\b/);
	return normalizeReference(match?.[0]);
}

function parseCandidateDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	return parseDate(value
		.replace(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+/i, "")
		.replace(/\b(\d{1,2})(?:st|nd|rd|th)\b/gi, "$1")
		.trim());
}

function futureOrLatestDeadline(dates: Date[], now: Date): Date | undefined {
	if (dates.length === 0) return undefined;
	const startOfToday = utcStartOfDay(now).getTime();
	const futureDates = dates
		.filter((date) => date.getTime() >= startOfToday)
		.sort((a, b) => a.getTime() - b.getTime());
	if (futureDates[0]) return futureDates[0];
	return dates.sort((a, b) => b.getTime() - a.getTime())[0];
}

function extractDeadline(text: string, now = new Date()): Date | undefined {
	const dates: Date[] = [];
	const deadlinePattern = /(?:(?:round\s+\d+\s+)?(?:submission\s+)?deadline|due date|closing date)\s*:?\s*((?:[A-Za-z]+,\s*)?[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/gi;
	const noLaterThanPattern = /no later than\s*((?:[A-Za-z]+,\s*)?[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/gi;
	for (const pattern of [deadlinePattern, noLaterThanPattern]) {
		for (const match of text.matchAll(pattern)) {
			const date = parseCandidateDate(match[1]);
			if (date) dates.push(date);
		}
	}
	return futureOrLatestDeadline(dates, now);
}

function extractDocumentLinks(block: string, sourceUrl: string): Array<{ url: string; label?: string }> {
	const links: Array<{ url: string; label?: string }> = [];
	const seen = new Set<string>();
	for (const match of block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
		const label = stripHtml(match[2] ?? "");
		const href = decodeHtmlEntities(match[1] ?? "");
		if (!DOCUMENT_LINK_PATTERN.test(href) && !/\b(?:download|rfp|rfq|eoi|tor|terms of reference)\b/i.test(label)) continue;
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

function countryFrom(text: string): string | undefined {
	const labeled = text.match(/\bCountries?\s*:\s*([\s\S]*?)(?=\bIssued by:|\bRelease Date:|\bRound\b|\bSubmission Deadline:|$)/i)?.[1];
	if (labeled) return cleanText(labeled);
	const h2Country = text.match(/\b(Bissau,\s+Guin(?:e|ée) Bissau)\b/i)?.[1];
	return h2Country ? cleanText(h2Country) : undefined;
}

function opportunityType(title: string, summary: string): OpportunityData["opportunityType"] {
	const normalized = `${title} ${summary}`.toLowerCase();
	if (/\brfp\b|request for proposals?|demande de proposition|proposal/.test(normalized)) return "rfp";
	return "tender";
}

function sourceIdFor(title: string, reference: string | undefined, portalUrl: string): string {
	if (reference) return `winrock-${slugify(reference) || "contract"}`;
	const pathname = new URL(portalUrl).pathname.replace(/^\/contracts\/|\/$/g, "");
	return `winrock-${slugify(pathname || title) || "contract"}`;
}

function opportunityFromParts(
	title: string,
	portalUrl: string,
	sourceUrl: string,
	block: string,
	summary: string,
	now: Date
): OpportunityData | undefined {
	if (title.length < 8 || !portalUrl.includes("/contracts/")) return undefined;
	const text = stripHtml(`${title} ${summary} ${block}`);
	const deadline = extractDeadline(text, now);
	if (isExpired(deadline, now)) return undefined;
	const reference = extractReference(text);
	const documentLinks = extractDocumentLinks(block, sourceUrl);
	const documentUrl = documentLinks[0]?.url ?? portalUrl;

	return {
		title,
		source: "winrock",
		sourceId: sourceIdFor(title, reference, portalUrl),
		noticeId: reference,
		organization: "Winrock International",
		category: "Winrock contract",
		opportunityType: opportunityType(title, text),
		countryRegion: countryFrom(text),
		deadline,
		portalUrl,
		documentUrl,
		rfpLink: documentUrl,
		projectSummary: summary || "Winrock International contract opportunity.",
		tags: ["winrock", "ngo", "source-scrape", "source-documents"],
		metadata: {
			winrock: {
				sourcePage: sourceUrl,
				portalUrl,
				reference,
				documentLinks,
				summary,
			},
		},
	};
}

function parseWinrockListHtml(content: string, sourceUrl: string, now: Date): OpportunityData[] {
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const match of content.matchAll(WINROCK_CARD_PATTERN)) {
		const block = match[0];
		const titleMatch = block.match(/<h3\b[^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i);
		const portalUrl = absoluteUrl(titleMatch?.[1], sourceUrl);
		const title = stripHtml(titleMatch?.[2] ?? "");
		if (!portalUrl) continue;
		const summaryBlock = block.replace(/<h3\b[\s\S]*?<\/h3>/i, " ");
		const summary = stripHtml(summaryBlock);
		const opportunity = opportunityFromParts(title, portalUrl, sourceUrl, block, summary, now);
		if (!opportunity || seen.has(opportunity.sourceId ?? opportunity.title)) continue;
		seen.add(opportunity.sourceId ?? opportunity.title);
		opportunities.push(opportunity);
	}

	return opportunities;
}

function extractDetailTitle(content: string): string | undefined {
	const title = stripHtml(content.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
	return title.length >= 8 ? title : undefined;
}

function extractMain(content: string): string {
	return content.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? content;
}

function parseWinrockDetailHtml(content: string, sourceUrl: string, now: Date): OpportunityData[] {
	const main = extractMain(content);
	const title = extractDetailTitle(main);
	if (!title) return [];
	const summary = stripHtml(main
		.replace(/<header[\s\S]*?<\/header>/gi, " ")
		.replace(/<h1\b[\s\S]*?<\/h1>/i, " "))
		.slice(0, 1800);
	const opportunity = opportunityFromParts(title, sourceUrl, sourceUrl, main, summary, now);
	return opportunity ? [opportunity] : [];
}

export function parseWinrockContractsHtml(content: string | undefined, sourceUrl = WINROCK_CONTRACTS_URL, now = new Date()): OpportunityData[] {
	if (!content) return [];
	if (/\/contracts\/?$/i.test(new URL(sourceUrl).pathname)) {
		return parseWinrockListHtml(content, sourceUrl, now);
	}
	return parseWinrockDetailHtml(content, sourceUrl, now);
}

export const winrockParser: TenderParser = {
	sourceId: "winrock",
	name: "Winrock International Contracts",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseWinrockContractsHtml(input.html ?? input.markdown, input.url || WINROCK_CONTRACTS_URL),
		};
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || WINROCK_CONTRACTS_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(winrockParser);
