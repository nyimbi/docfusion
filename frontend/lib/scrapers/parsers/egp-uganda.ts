/**
 * Uganda eGP bid-notices parser.
 *
 * The public bid list is rendered as static table rows. Firecrawl can return
 * the HTML, so this parser reads rows directly instead of relying on generic
 * link text that loses the procuring entity, category, and dates.
 */

import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const EGP_UGANDA_BASE_URL = "https://egpuganda.go.ug";
const NOTICE_LINK_PATTERN = /href=["']([^"']*\/index\/[^"']+)["']/i;
const ROW_PATTERN = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const DATE_PATTERN = /<span\b[^>]*class=["'][^"']*\btext-success-600\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;

function normalizeEgpUrl(rawUrl: string): string | undefined {
	try {
		const parsed = new URL(rawUrl, EGP_UGANDA_BASE_URL);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return undefined;
	}
}

function stripHtml(value: string | undefined): string {
	return cleanText((value ?? "")
		.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
		.replace(/<style\b[\s\S]*?<\/style>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, "\"")
		.replace(/&#39;/g, "'"));
}

function noticeIdFromUrl(url: string): string {
	const match = url.match(/\/index\/([^/?#]+)/i);
	return match?.[1] ?? url;
}

function extractReference(rowHtml: string): string | undefined {
	const match = rowHtml.match(/<a\b[^>]*class=["'][^"']*\bfont-weight-semibold\b[^"']*["'][^>]*>([\s\S]*?)(?:<div\b|<\/a>)/i);
	const reference = stripHtml(match?.[1]);
	return reference || undefined;
}

function extractOrganization(rowHtml: string): string | undefined {
	const match = rowHtml.match(/<div\b[^>]*class=["'][^"']*\bfont-size-sm\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
	const organization = stripHtml(match?.[1]);
	return organization || undefined;
}

function extractCategory(rowHtml: string): string | undefined {
	for (const match of rowHtml.matchAll(/<span\b[^>]*class=["'][^"']*\bbadge\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)) {
		const category = stripHtml(match[1]);
		if (category) return category;
	}
	return undefined;
}

function extractSubject(rowHtml: string): string | undefined {
	const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1] ?? "");
	const subjectCell = cells[2];
	const subject = stripHtml(subjectCell);
	return subject || undefined;
}

function extractDates(rowHtml: string): { publishedDate?: Date; deadline?: Date } {
	const dates = [...rowHtml.matchAll(DATE_PATTERN)].map((match) => stripHtml(match[1]));
	return {
		publishedDate: parseDate(dates[0]),
		deadline: parseDate(dates[1]),
	};
}

function inferOpportunityType(category: string | undefined): OpportunityData["opportunityType"] {
	const normalized = category?.toLowerCase() ?? "";
	if (normalized.includes("consult")) return "rfp";
	if (normalized.includes("works") || normalized.includes("supplies")) return "tender";
	return "tender";
}

function formatLocalDate(date: Date | undefined): string | undefined {
	if (!date) return undefined;
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function parseEgpUgandaHtml(html: string | undefined): OpportunityData[] {
	if (!html) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const match of html.matchAll(ROW_PATTERN)) {
		const rowHtml = match[1] ?? "";
		const rawUrl = rowHtml.match(NOTICE_LINK_PATTERN)?.[1];
		const portalUrl = rawUrl ? normalizeEgpUrl(rawUrl) : undefined;
		if (!portalUrl || seen.has(portalUrl)) continue;

		const subject = extractSubject(rowHtml);
		const reference = extractReference(rowHtml);
		const organization = extractOrganization(rowHtml);
		const category = extractCategory(rowHtml);
		const { publishedDate, deadline } = extractDates(rowHtml);
		const title = subject ?? reference;
		if (!title) continue;

		seen.add(portalUrl);
		const noticeId = noticeIdFromUrl(portalUrl);
		opportunities.push({
			title,
			source: "egp_uganda",
			sourceId: noticeId,
			noticeId,
			organization,
			countryRegion: "Uganda",
			category,
			opportunityType: inferOpportunityType(category),
			publishedDate,
			deadline,
			portalUrl,
			rfpLink: portalUrl,
			projectSummary: [
				reference ? `Reference: ${reference}` : undefined,
				category ? `Type: ${category}` : undefined,
				organization ? `Procuring entity: ${organization}` : undefined,
				deadline ? `Deadline: ${formatLocalDate(deadline)}` : undefined,
			].filter(Boolean).join("; ") || undefined,
			tags: ["egp-uganda", "national-procurement"],
			metadata: {
				egpUganda: {
					reference,
					publishedDate: formatLocalDate(publishedDate) ?? null,
				},
			},
		});
	}

	return opportunities;
}

export const egpUgandaParser: TenderParser = {
	sourceId: "egp_uganda",
	name: "Uganda eGP Bid Notices",
	requiresJavascript: false,
	async parse(content: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseEgpUgandaHtml(content.html),
		};
	},
	getPageUrl(baseUrl: string, page: number): string {
		if (page <= 1) return baseUrl;
		const url = new URL(baseUrl, EGP_UGANDA_BASE_URL);
		url.searchParams.set("page", String(page));
		return url.toString();
	},
	hasNextPage(): boolean {
		return false;
	},
};

registerParser(egpUgandaParser);

export { parseEgpUgandaHtml };
export default egpUgandaParser;
