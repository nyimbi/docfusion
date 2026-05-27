/**
 * COMESA open tenders parser.
 *
 * COMESA's archive pages include navigation links that look tender-like, so
 * this parser only accepts dated post cards from the open-tenders archive.
 */

import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const COMESA_BASE_URL = "https://www.comesa.int";
const POST_PATTERN = /###\s*\[([^\]]+)\]\((https?:\/\/www\.comesa\.int\/[^)]+)\)\s*\n+\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*\n+\s*([\s\S]*?)(?=\n\n\[\]\(|\n\n###\s*\[|\n\n\*\s+\[|$)/gi;
const EXCLUDED_TITLES = new Set(["awarded tenders", "open tenders"]);

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

function parseComesaMarkdown(markdown: string | undefined): OpportunityData[] {
	if (!markdown) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const match of markdown.matchAll(POST_PATTERN)) {
		const title = cleanText(match[1]);
		const portalUrl = match[2];
		const publishedDate = parseDate(match[3]);
		const summary = cleanSummary(match[4]);
		if (!title || EXCLUDED_TITLES.has(title.toLowerCase())) continue;
		if (seen.has(portalUrl)) continue;
		seen.add(portalUrl);

		const category = inferCategory(title, summary);
		const documentUrl = extractDocumentUrl(summary, portalUrl);
		const sourceId = sourceIdFromUrl(portalUrl);
		opportunities.push({
			title,
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
		});
	}

	return opportunities;
}

export const comesaParser: TenderParser = {
	sourceId: "comesa",
	name: "COMESA Open Tenders",
	requiresJavascript: false,
	async parse(content: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseComesaMarkdown(content.markdown),
		};
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
