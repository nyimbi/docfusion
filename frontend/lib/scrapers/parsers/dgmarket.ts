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

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, "\"")
		.replace(/&#39;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">");
}

function cleanHtmlText(value: string | undefined): string {
	return cleanText(decodeHtmlEntities((value ?? "").replace(/<[^>]*>/g, " ")));
}

function normalizeDgMarketUrl(url: string | undefined, baseUrl: string): string | undefined {
	if (!url) return undefined;
	try {
		const normalized = new URL(decodeHtmlEntities(url), baseUrl);
		return normalized.hostname.includes("dgmarket.com") ? normalized.toString() : undefined;
	} catch {
		return undefined;
	}
}

function isTenderNoticeUrl(url: string | undefined): boolean {
	if (!url) return false;
	try {
		const pathname = new URL(url).pathname.toLowerCase();
		return /^\/tender\/\d+/.test(pathname) || pathname.includes("shownotice") || pathname.includes("np-notice");
	} catch {
		return false;
	}
}

function extractMarkdownLink(
	value: string,
	baseUrl: string
): { title: string; url: string } | undefined {
	const match = value.match(/\[([^\]]+)\]\(([^)]+)\)/);
	const url = normalizeDgMarketUrl(match?.[2], baseUrl);
	if (!match || !url) return undefined;
	return {
		title: cleanText(match[1]),
		url,
	};
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

function opportunityExists(opportunities: OpportunityData[], title: string, portalUrl?: string): boolean {
	const normalizedTitle = title.toLowerCase();
	return opportunities.some(
		(opportunity) =>
			opportunity.title.toLowerCase() === normalizedTitle ||
			(Boolean(portalUrl) && opportunity.portalUrl === portalUrl)
	);
}

function extractDgMarketHtmlNotices(html: string, baseUrl: string): OpportunityData[] {
	const opportunities: OpportunityData[] = [];
	const rowPattern = /<table[^>]+class=["'][^"']*\blist_notice_table\b[^"']*["'][^>]*>[\s\S]*?<\/table>/gi;
	let rowMatch: RegExpExecArray | null;

	while ((rowMatch = rowPattern.exec(html)) !== null) {
		const row = rowMatch[0];
		const titleMatch = row.match(
			/<div[^>]+class=["'][^"']*\bln_notice_title\b[^"']*["'][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i
		);
		const portalUrl = normalizeDgMarketUrl(titleMatch?.[1], baseUrl);
		const title = cleanHtmlText(titleMatch?.[2]);
		if (!title || !portalUrl || isNavigationLink(title) || !isTenderNoticeUrl(portalUrl)) continue;

		const hiddenNoticeId = row.match(/<input[^>]+name=["']noticeId["'][^>]+value=["']([^"']+)["']/i)?.[1];
		const country = cleanHtmlText(row.match(/country_icon[\s\S]*?<span[^>]+class=["'][^"']*\bln_listing\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]);
		const category = cleanHtmlText(row.match(/type_icon[\s\S]*?<span[^>]+class=["'][^"']*\bln_listing\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]);
		const publishedDate = parseDate(cleanHtmlText(row.match(/<div[^>]+class=["'][^"']*\bln_date\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]));
		const deadline = parseDate(cleanHtmlText(row.match(/<div[^>]+class=["'][^"']*\bln_deadline\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]));

		opportunities.push({
			title,
			source: "dgmarket",
			sourceId: hiddenNoticeId,
			noticeId: hiddenNoticeId ? `dgm-${hiddenNoticeId}` : extractNoticeId(portalUrl),
			organization: "DGMarket",
			deadline,
			publishedDate,
			portalUrl,
			documentUrl: portalUrl,
			countryRegion: country || undefined,
			category: category || undefined,
			opportunityType: "tender",
			tags: ["dgmarket", "global-procurement"],
			metadata: {
				dgmarket: {
					source: "html-listing",
				},
			},
		});
	}

	return opportunities;
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
		const html = content.html || "";

		// Pattern 1: Markdown link format from Firecrawl
		const linkPattern = /\[([^\]]+)\]\(([^)\s]+)\)/gi;

		// Pattern 2: Structured tender blocks
		const blockPattern = /(?:^|\n)([A-Z][^\n]{10,200})\n(?:Organization|Agency|Buyer):\s*([^\n]+)\n(?:.*?Deadline|Closing):\s*([^\n]+)/gi;

		// Pattern 3: Table row format
		const tableRowPattern = /^\|\s*([^|]{3,200})\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|$/gim;

		let match;

		for (const opportunity of extractDgMarketHtmlNotices(html || markdown, content.url)) {
			if (!opportunityExists(opportunities, opportunity.title, opportunity.portalUrl)) {
				opportunities.push(opportunity);
			}
		}

		// Extract from table rows before bare links so row metadata is preserved
		while ((match = tableRowPattern.exec(markdown)) !== null) {
			const titleLink = extractMarkdownLink(match[1], content.url);
			const title = cleanText(titleLink?.title ?? match[1]);
			const organization = cleanText(match[2]);
			const country = cleanText(match[3]);
			const deadlineStr = cleanText(match[4]);

			if (title.toLowerCase().includes("title") || title.includes("---")) continue;
			if (isNavigationLink(title)) continue;

			if (opportunityExists(opportunities, title, titleLink?.url)) continue;

			opportunities.push({
				title,
				source: this.sourceId,
				organization,
				deadline: parseDate(deadlineStr),
				countryRegion: country,
				portalUrl: titleLink?.url,
				documentUrl: titleLink?.url,
				opportunityType: "tender",
				noticeId: titleLink?.url ? extractNoticeId(titleLink.url) : generateNoticeId(title, organization),
				tags: ["dgmarket", "global-procurement"],
			});
		}

		// Extract from markdown links
		while ((match = linkPattern.exec(markdown)) !== null) {
			const title = cleanText(match[1]);
			const url = normalizeDgMarketUrl(match[2], content.url);

			if (!url || isNavigationLink(title) || !isTenderNoticeUrl(url)) continue;

			const contextStart = Math.max(0, match.index - 500);
			const contextEnd = Math.min(markdown.length, match.index + match[0].length + 500);
			const context = markdown.slice(contextStart, contextEnd);

			const metadata = extractMetadataFromContext(context, title);

			if (opportunityExists(opportunities, title, url)) continue;

			opportunities.push({
				title,
				source: this.sourceId,
				organization: metadata.organization || "DGMarket",
				deadline: metadata.deadline,
				portalUrl: url,
				documentUrl: url,
				countryRegion: metadata.country,
				category: metadata.category,
				opportunityType: "tender",
				projectSummary: metadata.summary,
				noticeId: extractNoticeId(url),
				tags: ["dgmarket", "global-procurement"],
			});
		}

		// Extract from structured blocks
		while ((match = blockPattern.exec(markdown)) !== null) {
			const title = cleanText(match[1]);
			const organization = cleanText(match[2]);
			const deadlineStr = cleanText(match[3]);

			if (isNavigationLink(title)) continue;

			if (opportunityExists(opportunities, title)) continue;

			opportunities.push({
				title,
				source: this.sourceId,
				organization,
				deadline: parseDate(deadlineStr),
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
