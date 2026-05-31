/**
 * COMESA open tenders parser.
 *
 * COMESA's archive pages include navigation links that look tender-like, so
 * this parser only accepts dated post cards from the open-tenders archive.
 */

import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

export interface ComesaTenderDetailLink {
	description?: string;
	url: string;
	score: number;
}

export interface ComesaTenderDetail {
	links: ComesaTenderDetailLink[];
	primaryLink?: ComesaTenderDetailLink;
}

const COMESA_BASE_URL = "https://www.comesa.int";
export const COMESA_OPEN_TENDERS_URL = `${COMESA_BASE_URL}/category/open-tenders/`;
const POST_PATTERN = /###\s*\[([^\]]+)\]\((https?:\/\/www\.comesa\.int\/[^)]+)\)\s*\n+\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*\n+\s*([\s\S]*?)(?=\n\n\[\]\(|\n\n###\s*\[|\n\n\*\s+\[|$)/gi;
const EXCLUDED_TITLES = new Set(["awarded tenders", "open tenders"]);
const DOCUMENT_PATTERN = /\.(pdf|docx?|xlsx?|zip)(?:[?#]|$)/i;
const DOCUMENT_KEYWORDS = [
	"rfp",
	"request for proposal",
	"request for expression",
	"tender",
	"bid",
	"advert",
	"terms of reference",
	"tor",
	"document",
];

function decodeEntities(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, codepoint: string) => String.fromCodePoint(Number(codepoint)))
		.replace(/&#x([0-9a-f]+);/gi, (_, codepoint: string) => String.fromCodePoint(Number.parseInt(codepoint, 16)))
		.replace(/&nbsp;|&#160;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, "\"")
		.replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&hellip;/gi, "...")
		.replace(/&ndash;|&mdash;/gi, "-");
}

function stripHtml(value: string | undefined): string {
	if (!value) return "";
	return cleanText(decodeEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function sourceIdFromUrl(url: string): string {
	const slug = url
		.replace(/^https?:\/\/www\.comesa\.int\//i, "")
		.replace(/\/$/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
	return slug || "comesa-open-tender";
}

function cleanSummary(value: string): string | undefined {
	const cleaned = cleanText(
		value
			.replace(/\[Read more\]\([^)]+\)/gi, "")
			.replace(/!\[[^\]]*]\([^)]+\)/g, "")
			.replace(/\s+/g, " ")
	);
	return cleaned || undefined;
}

function inferCategory(title: string, summary: string | undefined): string {
	const text = `${title} ${summary ?? ""}`.toLowerCase();
	if (text.includes("consultancy") || text.includes("consultant")) return "Consultancy";
	if (text.includes("expression of interest") || text.includes("eoi") || text.includes("reoi")) return "Expression of interest";
	return "Tender";
}

function inferOpportunityType(category: string): OpportunityData["opportunityType"] {
	if (category === "Consultancy") return "rfp";
	if (category === "Expression of interest") return "eoi";
	return "tender";
}

function extractDocumentUrl(summary: string | undefined, portalUrl: string): string {
	const match = summary?.match(/https?:\/\/[^\s)]+/i);
	return match?.[0]?.replace(/[.,;]+$/g, "") || portalUrl;
}

function normalizeComesaUrl(rawUrl: string, baseUrl: string): string | undefined {
	const trimmed = rawUrl.trim().replace(/[),.;]+$/g, "");
	if (!trimmed) return undefined;
	try {
		const parsed = new URL(trimmed, baseUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return undefined;
	}
}

function opportunityFromPost(
	title: string,
	portalUrl: string,
	publishedDateText: string,
	rawSummary: string | undefined
): OpportunityData | undefined {
	const cleanTitle = cleanText(title);
	if (!cleanTitle || EXCLUDED_TITLES.has(cleanTitle.toLowerCase())) return undefined;

	const summary = cleanSummary(rawSummary ?? "");
	const category = inferCategory(cleanTitle, summary);
	const sourceId = sourceIdFromUrl(portalUrl);
	const documentUrl = extractDocumentUrl(summary, portalUrl);
	const publishedDate = parseDate(publishedDateText);
	return {
		title: cleanTitle,
		source: "comesa",
		sourceId,
		noticeId: sourceId,
		organization: "COMESA Secretariat",
		countryRegion: "Eastern and Southern Africa",
		category,
		opportunityType: inferOpportunityType(category),
		publishedDate,
		portalUrl,
		documentUrl,
		rfpLink: documentUrl,
		projectSummary: summary,
		tags: ["comesa", "regional-procurement"],
		metadata: {
			comesa: {
				sourceArchive: "open-tenders",
				publishedDate: publishedDate?.toISOString() ?? null,
			},
		},
	};
}

function scoreDetailLink(description: string | undefined, url: string): number {
	const haystack = `${description ?? ""} ${url}`.toLowerCase();
	if (haystack.includes("privacy")) return -100;
	let score = 0;
	if (/\.docx?(?:[?#]|$)/i.test(url)) score += 6;
	if (/\.pdf(?:[?#]|$)/i.test(url)) score += 4;
	if (/\.xlsx?(?:[?#]|$)/i.test(url)) score += 2;
	for (const keyword of DOCUMENT_KEYWORDS) {
		if (haystack.includes(keyword)) score += 3;
	}
	if (haystack.includes("rfp")) score += 5;
	return score;
}

function collectDetailCandidate(
	candidates: Map<string, ComesaTenderDetailLink>,
	url: string | undefined,
	description: string | undefined
): void {
	if (!url || !DOCUMENT_PATTERN.test(url)) return;
	const score = scoreDetailLink(description, url);
	if (score <= 0) return;
	const existing = candidates.get(url);
	if (!existing || score > existing.score) {
		candidates.set(url, {
			url,
			description: description ? cleanText(description) : undefined,
			score,
		});
	}
}

export function parseComesaTenderDetailMarkdown(
	markdown: string | undefined,
	links: string[] = [],
	baseUrl = COMESA_BASE_URL
): ComesaTenderDetail {
	const candidates = new Map<string, ComesaTenderDetailLink>();
	const markdownLinkPattern = /!?\[([^\]]{0,240})\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
	for (const match of markdown?.matchAll(markdownLinkPattern) ?? []) {
		const url = normalizeComesaUrl(match[2] ?? "", baseUrl);
		collectDetailCandidate(candidates, url, match[1]);
	}

	const bareUrlPattern = /https?:\/\/[^\s<>"')]+/g;
	for (const match of markdown?.matchAll(bareUrlPattern) ?? []) {
		const url = normalizeComesaUrl(match[0] ?? "", baseUrl);
		collectDetailCandidate(candidates, url, undefined);
	}

	for (const rawLink of links) {
		const url = normalizeComesaUrl(rawLink, baseUrl);
		collectDetailCandidate(candidates, url, undefined);
	}

	const ranked = [...candidates.values()].sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
	return {
		links: ranked,
		primaryLink: ranked[0],
	};
}

function parseComesaMarkdown(markdown: string | undefined): OpportunityData[] {
	if (!markdown) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const match of markdown.matchAll(POST_PATTERN)) {
		const portalUrl = match[2];
		if (!portalUrl) continue;
		if (seen.has(portalUrl)) continue;
		const opportunity = opportunityFromPost(match[1] ?? "", portalUrl, match[3] ?? "", match[4]);
		if (!opportunity) continue;
		seen.add(portalUrl);
		opportunities.push(opportunity);
	}

	return opportunities;
}

export function parseComesaOpenTendersHtml(
	html: string | undefined,
	sourceUrl = COMESA_OPEN_TENDERS_URL
): OpportunityData[] {
	if (!html) return [];
	const postPattern = /<h3\b[^>]*class=["'][^"']*\bpost-title\b[^"']*["'][^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>[\s\S]*?<span\b[^>]*class=["'][^"']*\bdate\b[^"']*["'][^>]*>([\s\S]*?)<\/span>[\s\S]*?<div\b[^>]*class=["'][^"']*\bpost-excerpt\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();
	for (const match of html.matchAll(postPattern)) {
		const portalUrl = normalizeComesaUrl(decodeEntities(match[1] ?? ""), sourceUrl);
		if (!portalUrl || seen.has(portalUrl)) continue;
		const opportunity = opportunityFromPost(
			stripHtml(match[2]),
			portalUrl,
			stripHtml(match[3]),
			stripHtml(match[4])
		);
		if (!opportunity) continue;
		seen.add(portalUrl);
		opportunities.push(opportunity);
	}
	return opportunities;
}

async function fetchComesaOpenTenders(sourceUrl: string): Promise<OpportunityData[]> {
	const response = await fetch(sourceUrl || COMESA_OPEN_TENDERS_URL, {
		signal: AbortSignal.timeout(20000),
		headers: {
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.9",
			"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
		},
	});
	if (!response.ok) {
		throw new Error(`COMESA open tenders fetch failed: ${response.status} ${response.statusText}`);
	}
	return parseComesaOpenTendersHtml(await response.text(), sourceUrl);
}

export const comesaParser: TenderParser = {
	sourceId: "comesa",
	name: "COMESA Open Tenders",
	requiresJavascript: false,
	async parse(content: ParseInput): Promise<ParseResult> {
		try {
			if (content.html) {
				return { opportunities: parseComesaOpenTendersHtml(content.html, content.url || COMESA_OPEN_TENDERS_URL) };
			}
			if (content.markdown) {
				return { opportunities: parseComesaMarkdown(content.markdown) };
			}
			return { opportunities: await fetchComesaOpenTenders(content.url || COMESA_OPEN_TENDERS_URL) };
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	},
	getPageUrl(baseUrl: string, page: number): string {
		if (page <= 1) return baseUrl;
		const url = new URL(baseUrl, COMESA_BASE_URL);
		url.searchParams.set("paged", String(page));
		return url.toString();
	},
	hasNextPage(): boolean {
		return false;
	},
};

registerParser(comesaParser);

export default comesaParser;
