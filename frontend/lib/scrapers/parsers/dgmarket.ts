/**
 * DGMarket Parser
 *
 * Parser for Development Gateway Market (dgMarket) - a global aggregator
 * of development/aid sector tenders from multilateral organizations.
 *
 * Site characteristics:
 * - Static HTML (no JavaScript rendering required)
 * - Standard pagination with page numbers
 * - Structured tender listings with clear field demarcation
 * - Covers: World Bank, AfDB, ADB, UNDP, and other development agencies
 */

import type { TenderParser, ParseInput, ParseResult } from "./types";
import { parseDate, cleanText, registerParser } from "./types";
import type { OpportunityData } from "../deduplicator";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a title is actually a navigation link (not a tender)
 */
function isNavigationLink(title: string): boolean {
	const navPatterns = [
		/^(home|about|contact|login|register|search|help|faq)$/i,
		/^(next|previous|back|first|last)$/i,
		/^page\s*\d+$/i,
		/^(sign in|sign up|log in|log out)$/i,
		/^(terms|privacy|cookies?|policy)$/i,
		/^\d+$/, // Just a number
		/^[<>»«›‹]+$/, // Navigation symbols
	];

	return navPatterns.some((p) => p.test(title.trim()));
}

/**
 * Extract metadata from surrounding context text
 */
function extractMetadataFromContext(
	context: string,
	title: string
): {
	organization?: string;
	deadline?: Date;
	country?: string;
	category?: string;
	summary?: string;
} {
	const result: {
		organization?: string;
		deadline?: Date;
		country?: string;
		category?: string;
		summary?: string;
	} = {};

	// Organization patterns
	const orgMatch = context.match(
		/(?:Organization|Agency|Buyer|Client|Procuring Entity):\s*([^\n]+)/i
	);
	if (orgMatch) {
		result.organization = cleanText(orgMatch[1]);
	}

	// Deadline patterns
	const deadlineMatch = context.match(
		/(?:Deadline|Closing|Due|Submission)(?:\s+Date)?:\s*([^\n]+)/i
	);
	if (deadlineMatch) {
		result.deadline = parseDate(deadlineMatch[1]);
	}

	// Country patterns
	const countryMatch = context.match(
		/(?:Country|Location|Region):\s*([^\n]+)/i
	);
	if (countryMatch) {
		result.country = cleanText(countryMatch[1]);
	}

	// Category patterns
	const categoryMatch = context.match(
		/(?:Category|Sector|Type):\s*([^\n]+)/i
	);
	if (categoryMatch) {
		result.category = cleanText(categoryMatch[1]);
	}

	// Summary - look for description near title
	const titleIndex = context.toLowerCase().indexOf(title.toLowerCase());
	if (titleIndex !== -1) {
		const afterTitle = context.slice(titleIndex + title.length, titleIndex + title.length + 300);
		const summaryMatch = afterTitle.match(/[.:]?\s*([A-Z][^.!?]{20,200}[.!?])/);
		if (summaryMatch) {
			result.summary = cleanText(summaryMatch[1]);
		}
	}

	return result;
}

/**
 * Extract notice ID from DGMarket URL
 */
function extractNoticeId(url: string): string {
	// DGMarket URLs often contain tender IDs
	// Example: https://dgmarket.com/tenders/np-00123456
	const match = url.match(/(?:tender|notice|np)[/-](\d+)/i);
	if (match) {
		return `dgm-${match[1]}`;
	}

	// Fallback: use URL hash
	const urlHash = url
		.replace(/https?:\/\//, "")
		.replace(/[^\w]/g, "-")
		.substring(0, 50);
	return `dgm-${urlHash}`;
}

/**
 * Generate a notice ID from title and organization
 */
function generateNoticeId(title: string, organization?: string): string {
	const normalized = `${title}-${organization || ""}`
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "-")
		.substring(0, 80);
	return `dgm-${normalized}`;
}

/**
 * Extract total number of pages from content
 */
function extractTotalPages(markdown: string): number | undefined {
	// Look for patterns like "Page 1 of 50" or "1/50"
	const match = markdown.match(
		/(?:page\s*\d+\s*(?:of|\/)\s*(\d+))|(?:(\d+)\s*pages?)/i
	);

	if (match) {
		return parseInt(match[1] || match[2], 10);
	}

	return undefined;
}

// ============================================================================
// Parser Implementation
// ============================================================================

export const dgmarketParser: TenderParser = {
	sourceId: "dgmarket",
	name: "DGMarket (Development Gateway)",
	requiresJavascript: false,

	/**
	 * Parse DGMarket tender listing page
	 */
	async parse(content: ParseInput): Promise<ParseResult> {
		const opportunities: OpportunityData[] = [];
		const markdown = content.markdown || "";

		// Pattern 1: Markdown link format from Firecrawl
		const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+dgmarket[^\s)]*)\)/gi;

		// Pattern 2: Structured tender blocks
		const blockPattern = /(?:^|\n)([A-Z][^\n]{10,200})\n(?:Organization|Agency|Buyer):\s*([^\n]+)\n(?:.*?Deadline|Closing):\s*([^\n]+)/gi;

		// Pattern 3: Table row format
		const tableRowPattern = /\|\s*([^|]{10,200})\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/gi;

		let match;

		// Extract from markdown links
		while ((match = linkPattern.exec(markdown)) !== null) {
			const title = cleanText(match[1]);
			const url = match[2];

			if (isNavigationLink(title)) continue;

			const contextStart = Math.max(0, match.index - 500);
			const contextEnd = Math.min(markdown.length, match.index + match[0].length + 500);
			const context = markdown.slice(contextStart, contextEnd);

			const metadata = extractMetadataFromContext(context, title);

			opportunities.push({
				title,
				source: this.sourceId,
				organization: metadata.organization || "Development Gateway",
				deadline: metadata.deadline,
				portalUrl: url,
				countryRegion: metadata.country,
				category: metadata.category,
				projectSummary: metadata.summary,
				noticeId: extractNoticeId(url),
			});
		}

		// Extract from structured blocks
		while ((match = blockPattern.exec(markdown)) !== null) {
			const title = cleanText(match[1]);
			const organization = cleanText(match[2]);
			const deadlineStr = cleanText(match[3]);

			if (isNavigationLink(title)) continue;

			const exists = opportunities.some(
				(o) => o.title.toLowerCase() === title.toLowerCase()
			);
			if (exists) continue;

			opportunities.push({
				title,
				source: this.sourceId,
				organization,
				deadline: parseDate(deadlineStr),
				noticeId: generateNoticeId(title, organization),
			});
		}

		// Extract from table rows
		while ((match = tableRowPattern.exec(markdown)) !== null) {
			const title = cleanText(match[1]);
			const organization = cleanText(match[2]);
			const country = cleanText(match[3]);
			const deadlineStr = cleanText(match[4]);

			if (title.toLowerCase().includes("title") || title.includes("---")) continue;
			if (isNavigationLink(title)) continue;

			const exists = opportunities.some(
				(o) => o.title.toLowerCase() === title.toLowerCase()
			);
			if (exists) continue;

			opportunities.push({
				title,
				source: this.sourceId,
				organization,
				deadline: parseDate(deadlineStr),
				countryRegion: country,
				noticeId: generateNoticeId(title, organization),
			});
		}

		// Determine pagination
		const nextPageUrl = findNextPage(content, this);

		return {
			opportunities,
			nextPageUrl,
			totalPages: extractTotalPages(markdown),
		};
	},

	getPageUrl(baseUrl: string, page: number): string {
		const url = new URL(baseUrl);
		url.searchParams.set("page", String(page));
		return url.toString();
	},

	hasNextPage(content: ParseInput, currentPage: number): boolean {
		const markdown = content.markdown || "";
		const links = content.links || [];

		const hasNextLink = links.some(
			(link) =>
				link.toLowerCase().includes("next") ||
				link.includes(`page=${currentPage + 1}`)
		);

		const hasNextInMarkdown =
			markdown.includes(`page=${currentPage + 1}`) ||
			markdown.toLowerCase().includes("next page") ||
			markdown.includes("›") ||
			markdown.includes("»");

		return hasNextLink || hasNextInMarkdown;
	},
};

/**
 * Find the next page URL from content
 */
function findNextPage(content: ParseInput, parser: TenderParser): string | undefined {
	const links = content.links || [];

	const nextLink = links.find(
		(link) =>
			link.toLowerCase().includes("next") ||
			/page=\d+.*next/i.test(link) ||
			/[?&]page=\d+$/i.test(link)
	);

	if (nextLink) {
		try {
			new URL(nextLink, content.url);
			return nextLink;
		} catch {
			// Invalid URL
		}
	}

	const currentUrl = new URL(content.url);
	const currentPage = parseInt(currentUrl.searchParams.get("page") || "1", 10);

	if (parser.hasNextPage(content, currentPage)) {
		return parser.getPageUrl(content.url, currentPage + 1);
	}

	return undefined;
}

// ============================================================================
// Self-Registration
// ============================================================================

registerParser(dgmarketParser);

export default dgmarketParser;
