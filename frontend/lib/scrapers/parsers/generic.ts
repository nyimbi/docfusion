/**
 * Generic Firecrawl Parser
 *
 * Fallback parser for sites without specific implementations.
 * Uses pattern matching on Firecrawl markdown output to extract
 * tender-like content.
 *
 * This parser is less reliable than site-specific parsers but
 * provides baseline extraction for unknown sites.
 */

import type { TenderParser, ParseInput, ParseResult } from "./types";
import { parseDate, cleanText, parseBudget, registerParser } from "./types";
import type { OpportunityData } from "../deduplicator";

// ============================================================================
// Tender Detection Patterns
// ============================================================================

const TENDER_KEYWORDS = [
	"tender",
	"rfp",
	"rfq",
	"rfi",
	"eoi",
	"bid",
	"procurement",
	"quotation",
	"solicitation",
	"invitation to bid",
	"request for proposal",
	"request for quotation",
	"expression of interest",
	"notice of intent",
	"contract award",
];

const EXCLUDE_KEYWORDS = [
	"privacy policy",
	"terms of service",
	"cookie",
	"login",
	"register",
	"sign up",
	"about us",
	"contact us",
	"faq",
	"help",
];

const AFRICAN_COUNTRIES = [
	"Kenya", "Tanzania", "Uganda", "Rwanda", "Ethiopia", "South Africa",
	"Nigeria", "Ghana", "Egypt", "Morocco", "Tunisia", "Senegal",
	"Cameroon", "Ivory Coast", "Cote d'Ivoire", "Mali", "Burkina Faso",
	"Zimbabwe", "Zambia", "Mozambique", "Botswana", "Namibia",
];

// ============================================================================
// Helper Functions
// ============================================================================

function shouldExclude(text: string): boolean {
	const lower = text.toLowerCase();
	return EXCLUDE_KEYWORDS.some((kw) => lower.includes(kw));
}

function isTenderLike(title: string, context: string): boolean {
	const combined = `${title} ${context}`.toLowerCase();
	return TENDER_KEYWORDS.some((kw) => combined.includes(kw));
}

function parseMetadataBlock(block: string): {
	organization?: string;
	deadline?: Date;
	country?: string;
	budget?: { currency?: string; amount?: number; original: string };
	description?: string;
} {
	const result: {
		organization?: string;
		deadline?: Date;
		country?: string;
		budget?: { currency?: string; amount?: number; original: string };
		description?: string;
	} = {};

	const orgMatch = block.match(/(?:organization|agency|buyer|client):\s*([^\n]+)/i);
	if (orgMatch) result.organization = cleanText(orgMatch[1].replace(/[*_]/g, ""));

	const deadlineMatch = block.match(/(?:deadline|closing|due|submission)(?:\s*date)?:\s*([^\n]+)/i);
	if (deadlineMatch) result.deadline = parseDate(deadlineMatch[1].replace(/[*_]/g, ""));

	const countryMatch = block.match(/(?:country|location|region):\s*([^\n]+)/i);
	if (countryMatch) result.country = cleanText(countryMatch[1].replace(/[*_]/g, ""));

	const budgetMatch = block.match(/(?:budget|value|amount):\s*([^\n]+)/i);
	if (budgetMatch) result.budget = parseBudget(budgetMatch[1].replace(/[*_]/g, ""));

	const descMatch = block.match(/(?:description|summary|details):\s*([^\n]+)/i);
	if (descMatch) result.description = cleanText(descMatch[1].replace(/[*_]/g, ""));

	return result;
}

function extractContextMetadata(context: string): {
	organization?: string;
	deadline?: Date;
	country?: string;
	description?: string;
} {
	const result: {
		organization?: string;
		deadline?: Date;
		country?: string;
		description?: string;
	} = {};

	const orgPatterns = [
		/(?:organization|agency|buyer|client|procuring entity):\s*([^\n]+)/i,
		/(?:issued by|from|by)\s+([A-Z][A-Za-z\s&]+(?:Ltd|Inc|Corp|Organization|Agency|Ministry|Department)?)/i,
	];
	for (const p of orgPatterns) {
		const match = context.match(p);
		if (match) {
			result.organization = cleanText(match[1]);
			break;
		}
	}

	const deadlinePatterns = [
		/(?:deadline|closing|due|submission)(?:\s*date)?:\s*([^\n]+)/i,
		/(?:closes?|due)\s+(?:on\s+)?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
		/(\d{1,2}(?:st|nd|rd|th)?\s+\w+,?\s+\d{4})/i,
	];
	for (const p of deadlinePatterns) {
		const match = context.match(p);
		if (match) {
			result.deadline = parseDate(match[1]);
			if (result.deadline) break;
		}
	}

	for (const country of AFRICAN_COUNTRIES) {
		if (context.includes(country)) {
			result.country = country;
			break;
		}
	}

	const descMatch = context.match(/[.:]?\s*([A-Z][^.!?]{30,200}[.!?])/);
	if (descMatch) {
		result.description = cleanText(descMatch[1]);
	}

	return result;
}

function generateId(title: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.substring(0, 60);
	return `gen-${slug || "unknown"}`;
}

function extractFromStructuredMarkdown(markdown: string, sourceUrl: string): OpportunityData[] {
	const opportunities: OpportunityData[] = [];

	const blockPattern = /#{1,3}\s*([^\n]+)\n((?:[*_]*\w+[*_]*:\s*[^\n]+\n?)+)/gi;

	let match;
	while ((match = blockPattern.exec(markdown)) !== null) {
		const title = cleanText(match[1]);
		const metadataBlock = match[2];

		if (shouldExclude(title)) continue;
		if (!isTenderLike(title, metadataBlock)) continue;

		const metadata = parseMetadataBlock(metadataBlock);

		opportunities.push({
			title,
			source: "generic",
			organization: metadata.organization,
			deadline: metadata.deadline,
			countryRegion: metadata.country,
			budgetValue: metadata.budget?.original,
			budgetNumeric: metadata.budget?.amount,
			budgetCurrency: metadata.budget?.currency,
			projectSummary: metadata.description,
			portalUrl: sourceUrl,
			noticeId: generateId(title),
		});
	}

	return opportunities;
}

function extractFromLinks(markdown: string, sourceUrl: string): OpportunityData[] {
	const opportunities: OpportunityData[] = [];
	const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi;

	let match;
	while ((match = linkPattern.exec(markdown)) !== null) {
		const linkText = cleanText(match[1]);
		const url = match[2];

		if (linkText.length < 10 || linkText.length > 300) continue;
		if (shouldExclude(linkText)) continue;
		if (!isTenderLike(linkText, "")) continue;

		const contextStart = Math.max(0, match.index - 200);
		const contextEnd = Math.min(markdown.length, match.index + match[0].length + 200);
		const context = markdown.slice(contextStart, contextEnd);

		const metadata = extractContextMetadata(context);

		opportunities.push({
			title: linkText,
			source: "generic",
			organization: metadata.organization,
			deadline: metadata.deadline,
			countryRegion: metadata.country,
			portalUrl: url,
			noticeId: generateId(linkText),
		});
	}

	return opportunities;
}

function extractFromHeadings(markdown: string, sourceUrl: string): OpportunityData[] {
	const opportunities: OpportunityData[] = [];
	const headingPattern = /^#{1,4}\s+(.+?)$/gm;

	let match;
	while ((match = headingPattern.exec(markdown)) !== null) {
		const title = cleanText(match[1]);

		if (title.length < 15 || title.length > 250) continue;
		if (shouldExclude(title)) continue;
		if (!isTenderLike(title, "")) continue;

		const afterHeading = markdown.slice(match.index + match[0].length, match.index + match[0].length + 500);
		const metadata = extractContextMetadata(afterHeading);

		opportunities.push({
			title,
			source: "generic",
			organization: metadata.organization,
			deadline: metadata.deadline,
			countryRegion: metadata.country,
			projectSummary: metadata.description,
			portalUrl: sourceUrl,
			noticeId: generateId(title),
		});
	}

	return opportunities;
}

function findNextPage(content: ParseInput): string | undefined {
	const links = content.links || [];
	const markdown = content.markdown || "";

	for (const nextLink of links) {
		if (!/next|›|»/i.test(nextLink) && !/page=\d+/i.test(nextLink)) {
			continue;
		}
		try {
			const url = new URL(nextLink, content.url);
			const current = new URL(content.url);
			url.hash = "";
			current.hash = "";
			const currentPage = getPageNumber(current) ?? 1;
			const linkPage = getPageNumber(url);
			const isExplicitNext = /next|›|»/i.test(nextLink);
			if (!isExplicitNext && linkPage !== undefined && linkPage <= currentPage) {
				continue;
			}
			if (url.hostname === current.hostname && url.toString() !== current.toString()) {
				return url.toString();
			}
		} catch {
			// Invalid URL
		}
	}

	const paginationMatch = markdown.match(
		/\[(?:Next|›|»|\d+)\]\((https?:\/\/[^\s)]+page[=\/]\d+[^\s)]*)\)/i
	);
	if (paginationMatch) {
		try {
			const url = new URL(paginationMatch[1], content.url);
			const current = new URL(content.url);
			url.hash = "";
			current.hash = "";
			const currentPage = getPageNumber(current) ?? 1;
			const linkPage = getPageNumber(url);
			if (linkPage !== undefined && linkPage <= currentPage) {
				return undefined;
			}
			if (url.hostname === current.hostname && url.toString() !== current.toString()) {
				return url.toString();
			}
		} catch {
			// Invalid URL
		}
	}

	return undefined;
}

function getPageNumber(url: URL): number | undefined {
	const pageParam = url.searchParams.get("page") ?? url.searchParams.get("p");
	if (pageParam && /^\d+$/.test(pageParam)) {
		return Number(pageParam);
	}

	const pathMatch = url.pathname.match(/\/page\/(\d+)(?:\/|$)/i);
	return pathMatch ? Number(pathMatch[1]) : undefined;
}

// ============================================================================
// Parser Implementation
// ============================================================================

export const genericParser: TenderParser = {
	sourceId: "generic",
	name: "Generic Firecrawl Parser",
	requiresJavascript: false,

	async parse(content: ParseInput): Promise<ParseResult> {
		const opportunities: OpportunityData[] = [];
		const markdown = content.markdown || "";

		// Strategy 1: Extract from structured markdown
		const structuredOpps = extractFromStructuredMarkdown(markdown, content.url);
		opportunities.push(...structuredOpps);

		// Strategy 2: Extract from links with tender keywords
		const linkOpps = extractFromLinks(markdown, content.url);
		for (const opp of linkOpps) {
			if (!opportunities.some((o) => o.title.toLowerCase() === opp.title.toLowerCase())) {
				opportunities.push(opp);
			}
		}

		// Strategy 3: Extract from heading + paragraph patterns
		const headingOpps = extractFromHeadings(markdown, content.url);
		for (const opp of headingOpps) {
			if (!opportunities.some((o) => o.title.toLowerCase() === opp.title.toLowerCase())) {
				opportunities.push(opp);
			}
		}

		return {
			opportunities,
			nextPageUrl: findNextPage(content),
		};
	},

	getPageUrl(baseUrl: string, page: number): string {
		const url = new URL(baseUrl);

		if (url.searchParams.has("page")) {
			url.searchParams.set("page", String(page));
		} else if (url.searchParams.has("p")) {
			url.searchParams.set("p", String(page));
		} else if (url.searchParams.has("offset")) {
			url.searchParams.set("offset", String((page - 1) * 20));
		} else {
			url.searchParams.set("page", String(page));
		}

		return url.toString();
	},

	hasNextPage(content: ParseInput, _currentPage: number): boolean {
		const markdown = content.markdown || "";
		const links = content.links || [];

		const paginationIndicators = [
			/next\s*page/i,
			/page\s*\d+\s*of\s*\d+/i,
			/»|›/,
			/\bpage[=\/]\d+/i,
		];

		return (
			paginationIndicators.some((p) => p.test(markdown)) ||
			links.some((l) => /next|page=\d+/i.test(l))
		);
	},
};

// ============================================================================
// Self-Registration
// ============================================================================

registerParser(genericParser);

export default genericParser;
