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
	const titlePattern = /<(?:h[1-6]|a|td)[^>]*>([^<]*(?:tender|rfp|rfq|bid|procurement|eoi)[^<]*)<\/(?:h[1-6]|a|td)>/gi;
	let match;

	while ((match = titlePattern.exec(html)) !== null) {
		const title = match[1].trim();
		if (title.length > 10 && title.length < 500) {
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
	for (const link of links) {
		const lowerLink = link.toLowerCase();
		if (
			lowerLink.includes("next") ||
			lowerLink.includes("page=2") ||
			lowerLink.includes("/page/2")
		) {
			try {
				const linkUrl = new URL(link, currentUrl);
				const currentUrlObj = new URL(currentUrl);
				if (linkUrl.hostname === currentUrlObj.hostname) {
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
	const normalized = `${title}-${organization || ""}`.toLowerCase().replace(/[^a-z0-9]/g, "-");
	return normalized.substring(0, 100);
}
