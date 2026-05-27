/**
 * African Development Bank procurement notice parser.
 *
 * AFDB procurement pages mix navigation and policy links with live notice rows.
 * Accept only dated document links with actionable procurement prefixes.
 */

import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const AFDB_BASE_URL = "https://www.afdb.org";
const NOTICE_PATTERN = /(?:^|\n)\s*(\d{1,2}-[A-Za-z]{3}-\d{4})\s*\n+\s*\[([^\]]+)]\((https?:\/\/(?:www\.)?afdb\.org\/(?:en|fr)\/documents\/[^)]+)\)/gi;
const MARKDOWN_LINK_PATTERN = /!?\[([^\]]{0,240})\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const BARE_URL_PATTERN = /https?:\/\/[^\s<>"')]+/g;
const DOCUMENT_PATTERN = /\.(pdf|docx?|xlsx?|zip)(?:[?#]|$)/i;
const DOCUMENT_KEYWORDS = [
	"download",
	"pdf",
	"request",
	"expression of interest",
	"eoi",
	"spn",
	"ifb",
	"tender",
	"procurement",
	"reoi",
];
const ACTIONABLE_PREFIXES = new Set([
	"ami",
	"aoi",
	"eoi",
	"gpn",
	"ifb",
	"spn",
]);
const EXCLUDED_PREFIXES = new Set([
	"contract awards",
	"ppm",
]);

export interface AfdbNoticeDetailLink {
	description?: string;
	url: string;
	score: number;
}

export interface AfdbNoticeDetail {
	links: AfdbNoticeDetailLink[];
	primaryLink?: AfdbNoticeDetailLink;
}

function sourceIdFromUrl(url: string): string {
	const slug = url
		.replace(/^https?:\/\/(?:www\.)?afdb\.org\/(?:en|fr)\/documents\//i, "")
		.replace(/\/$/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 100);
	return slug || "afdb-procurement-notice";
}

function noticePrefix(title: string): string {
	const [prefix] = title.split(/\s+-\s+/);
	return cleanText(prefix).toLowerCase();
}

function isActionableNotice(title: string): boolean {
	const prefix = noticePrefix(title);
	if (EXCLUDED_PREFIXES.has(prefix)) return false;
	return ACTIONABLE_PREFIXES.has(prefix);
}

function inferCountryRegion(title: string): string | undefined {
	const parts = title.split(/\s+-\s+/).map(cleanText).filter(Boolean);
	return parts.length >= 3 ? parts[1] : undefined;
}

function inferCategory(title: string): string {
	const prefix = noticePrefix(title);
	if (prefix === "ami" || prefix === "eoi") return "Expression of interest";
	if (prefix === "gpn") return "Procurement notice";
	return "Tender";
}

function inferOpportunityType(category: string): OpportunityData["opportunityType"] {
	if (category === "Expression of interest") return "eoi";
	return "tender";
}

function languageFromUrl(url: string): "en" | "fr" {
	return /\/fr\/documents\//i.test(url) ? "fr" : "en";
}

function normalizeAfdbUrl(rawUrl: string, baseUrl: string): string | undefined {
	const trimmed = rawUrl.trim().replace(/[),.;]+$/g, "").replace(/\\_/g, "_");
	if (!trimmed) return undefined;
	try {
		const parsed = new URL(trimmed, baseUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
		if (!/(^|\.)afdb\.org$/i.test(parsed.hostname)) return undefined;
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return undefined;
	}
}

function scoreDetailLink(description: string | undefined, url: string): number {
	const haystack = `${description ?? ""} ${url}`.toLowerCase();
	let score = 0;
	if (/\.pdf(?:[?#]|$)/i.test(url)) score += 8;
	if (/\.docx?(?:[?#]|$)/i.test(url)) score += 5;
	if (/\/sites\/default\/files\/documents\/project-related-procurement\//i.test(url)) score += 8;
	for (const keyword of DOCUMENT_KEYWORDS) {
		if (haystack.includes(keyword)) score += 2;
	}
	if (haystack.includes("download pdf")) score += 5;
	if (haystack.includes("facebook") || haystack.includes("twitter") || haystack.includes("rss")) score -= 100;
	return score;
}

function collectDetailCandidate(
	candidates: Map<string, AfdbNoticeDetailLink>,
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

export function parseAfdbNoticeDetailMarkdown(
	markdown: string | undefined,
	links: string[] = [],
	baseUrl = AFDB_BASE_URL
): AfdbNoticeDetail {
	const candidates = new Map<string, AfdbNoticeDetailLink>();
	for (const match of markdown?.matchAll(MARKDOWN_LINK_PATTERN) ?? []) {
		collectDetailCandidate(
			candidates,
			normalizeAfdbUrl(match[2] ?? "", baseUrl),
			match[1]
		);
	}
	for (const match of markdown?.matchAll(BARE_URL_PATTERN) ?? []) {
		collectDetailCandidate(
			candidates,
			normalizeAfdbUrl(match[0] ?? "", baseUrl),
			undefined
		);
	}
	for (const rawLink of links) {
		collectDetailCandidate(
			candidates,
			normalizeAfdbUrl(rawLink, baseUrl),
			undefined
		);
	}

	const ranked = [...candidates.values()].sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
	return {
		links: ranked,
		primaryLink: ranked[0],
	};
}

function parseAfdbMarkdown(markdown: string | undefined): OpportunityData[] {
	if (!markdown) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const match of markdown.matchAll(NOTICE_PATTERN)) {
		const publishedDate = parseDate(match[1]);
		const title = cleanText(match[2]);
		const portalUrl = match[3];
		if (!title || !isActionableNotice(title)) continue;
		if (seen.has(portalUrl)) continue;
		seen.add(portalUrl);

		const category = inferCategory(title);
		const sourceId = sourceIdFromUrl(portalUrl);
		const prefix = noticePrefix(title).toUpperCase();
		opportunities.push({
			title,
			source: "afdb",
			sourceId,
			noticeId: sourceId,
			organization: "African Development Bank",
			countryRegion: inferCountryRegion(title),
			category,
			opportunityType: inferOpportunityType(category),
			publishedDate,
			portalUrl,
			documentUrl: portalUrl,
			rfpLink: portalUrl,
			projectSummary: title,
			tags: ["afdb", "development-bank", "regional-procurement"],
			metadata: {
				afdb: {
					noticePrefix: prefix,
					language: languageFromUrl(portalUrl),
					publishedDate: publishedDate?.toISOString() ?? null,
				},
			},
		});
	}

	return opportunities;
}

export const afdbParser: TenderParser = {
	sourceId: "afdb",
	name: "African Development Bank Procurement",
	requiresJavascript: false,
	async parse(content: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseAfdbMarkdown(content.markdown),
		};
	},
	getPageUrl(baseUrl: string, page: number): string {
		if (page <= 1) return baseUrl;
		const url = new URL(baseUrl, AFDB_BASE_URL);
		url.searchParams.set("page", String(page - 1));
		return url.toString();
	},
	hasNextPage(): boolean {
		return false;
	},
};

registerParser(afdbParser);

export default afdbParser;
