/**
 * Content Extractor
 *
 * Pure functions for extracting opportunity data from raw content
 * (HTML and markdown). These are fallback extractors used when no
 * site-specific parser is available.
 *
 * For LLM-based extraction, see parsers/llm-extractor.ts.
 * For site-specific parsing, see the parsers/ directory.
 */

import type { ScraperSource } from "@/lib/db/schema";
import type { OpportunityData } from "./deduplicator";
import { extractOpportunitiesFromMarkdown } from "./firecrawl";

const HTML_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: "\"",
	apos: "'",
	nbsp: " ",
};

// ============================================================================
// Markdown Extraction
// ============================================================================

/**
 * Extract opportunities from Firecrawl markdown output using
 * pattern-matching heuristics and the firecrawl helper.
 *
 * Maps raw extracted records into the canonical OpportunityData shape.
 */
export function extractOpportunitiesFromContent(
	markdown: string,
	links: string[],
	sourceUrl: string,
	source: ScraperSource
): OpportunityData[] {
	const rawOpps = extractOpportunitiesFromMarkdown(markdown, sourceUrl);

	return rawOpps.map(opp => ({
		title: opp.title,
		source: source.sourceId,
		organization: opp.organization || source.name,
		deadline: opp.deadline ? new Date(opp.deadline) : undefined,
		projectSummary: opp.description,
		portalUrl: opp.url || sourceUrl,
		noticeId: generateNoticeId(opp.title, opp.organization),
	}));
}

// ============================================================================
// Basic HTML Extraction
// ============================================================================

/**
 * Regex-based extraction from raw HTML.
 * Scans for h1-h6, anchor, and td elements containing tender keywords.
 * This is the lowest-fidelity extractor — used only when Firecrawl and
 * site-specific parsers are both unavailable.
 */
export function extractFromBasicHtml(
	html: string,
	sourceUrl: string,
	source: ScraperSource
): OpportunityData[] {
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();
	const titlePattern = /<(?:h[1-6]|a|td)[^>]*>([^<]*(?:tender|rfp|rfq|bid|procurement|eoi)[^<]*)<\/(?:h[1-6]|a|td)>/gi;
	let match;

	while ((match = titlePattern.exec(html)) !== null) {
		const title = decodeHtmlEntities(match[1]).replace(/\s+/g, " ").trim();
		const key = title.toLowerCase();
		if (title.length > 10 && title.length < 500) {
			if (seen.has(key)) continue;
			seen.add(key);
			opportunities.push({
				title,
				source: source.sourceId,
				organization: source.name,
				portalUrl: sourceUrl,
				noticeId: generateNoticeId(title, source.name),
			});
		}
	}

	return opportunities;
}

// ============================================================================
// Pagination
// ============================================================================

/**
 * Scan a list of extracted links for a "next page" URL.
 * Looks for common pagination patterns (next, page=2, /page/2).
 * Only returns same-host links to prevent following external redirects.
 */
export function findNextPageUrl(links: string[], currentUrl: string): string | undefined {
	let current: URL;
	try {
		current = new URL(currentUrl);
	} catch {
		return undefined;
	}

	for (const link of links) {
		const lowerLink = link.toLowerCase();
		if (
			lowerLink.includes("next") ||
			/\bpage=\d+/i.test(lowerLink) ||
			/\/page\/\d+/i.test(lowerLink)
		) {
			try {
				const linkUrl = new URL(link, currentUrl);
				linkUrl.hash = "";
				const currentNoHash = new URL(current.toString());
				currentNoHash.hash = "";
				const isExplicitNext = lowerLink.includes("next") || /[›»]/.test(lowerLink);
				const currentPage = getPageNumber(currentNoHash) ?? 1;
				const linkPage = getPageNumber(linkUrl);

				if (!isExplicitNext && linkPage !== undefined && linkPage <= currentPage) {
					continue;
				}

				if (
					linkUrl.hostname === current.hostname &&
					linkUrl.toString() !== currentNoHash.toString()
				) {
					return linkUrl.toString();
				}
			} catch {
				// Invalid URL, skip
			}
		}
	}
	return undefined;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Derive a deterministic notice ID from a title and optional organisation.
 * Normalises to lowercase alphanumeric with hyphens, capped at 100 chars.
 */
export function generateNoticeId(title: string, organization?: string | null): string {
	const normalized = `${title}-${organization || ""}`
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.substring(0, 100);
	return normalized || "unknown-notice";
}

function decodeHtmlEntities(text: string): string {
	return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
		if (entity.startsWith("#x")) {
			const codePoint = Number.parseInt(entity.slice(2), 16);
			return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
		}
		if (entity.startsWith("#")) {
			const codePoint = Number.parseInt(entity.slice(1), 10);
			return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
		}
		return HTML_ENTITIES[entity.toLowerCase()] ?? _;
	});
}

function getPageNumber(url: URL): number | undefined {
	const pageParam = url.searchParams.get("page") ?? url.searchParams.get("p");
	if (pageParam && /^\d+$/.test(pageParam)) {
		return Number(pageParam);
	}

	const pathMatch = url.pathname.match(/\/page\/(\d+)(?:\/|$)/i);
	return pathMatch ? Number(pathMatch[1]) : undefined;
}
