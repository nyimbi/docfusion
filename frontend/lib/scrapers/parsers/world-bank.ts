/**
 * World Bank procurement notices parser.
 *
 * The procurement page renders as a markdown table. The generic parser only
 * sees a few tender-like titles, so parse table rows directly and skip awards.
 */

import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const WORLD_BANK_BASE_URL = "https://projects.worldbank.org";
const PROCUREMENT_DETAIL_PATTERN = /projects\.worldbank\.org\/en\/projects-operations\/procurement-detail\/(OP\d+)/i;
const PROJECT_LINK_PATTERN = /\[([^\]]+)]\((https?:\/\/projects\.worldbank\.org\/en\/projects-operations\/project-detail\/[^)]+)\)/i;
const DESCRIPTION_LINK_PATTERN = /\[([^\]]+)]\((https?:\/\/projects\.worldbank\.org\/en\/projects-operations\/procurement-detail\/[^)]+)\)/i;

function normalizeWorldBankUrl(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.protocol = "https:";
		return parsed.toString();
	} catch {
		return url;
	}
}

function sourceIdFromUrl(url: string): string {
	const match = url.match(PROCUREMENT_DETAIL_PATTERN);
	return match?.[1] ?? url
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

function splitMarkdownRow(line: string): string[] {
	return line
		.replace(/^\s*\|\s*/, "")
		.replace(/\s*\|\s*$/, "")
		.split(/\s*\|\s*/)
		.map(cleanText);
}

function isDataRow(cells: string[]): boolean {
	if (cells.length < 6) return false;
	if (!DESCRIPTION_LINK_PATTERN.test(cells[0])) return false;
	const noticeType = cells[3]?.toLowerCase() ?? "";
	return !noticeType.includes("award");
}

function inferOpportunityType(noticeType: string): OpportunityData["opportunityType"] {
	const normalized = noticeType.toLowerCase();
	if (normalized.includes("expression of interest")) return "eoi";
	if (normalized.includes("proposal")) return "rfp";
	return "tender";
}

function parseWorldBankMarkdown(markdown: string | undefined): OpportunityData[] {
	if (!markdown) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const line of markdown.split(/\r?\n/)) {
		const cells = splitMarkdownRow(line);
		if (!isDataRow(cells)) continue;

		const descriptionMatch = cells[0].match(DESCRIPTION_LINK_PATTERN);
		if (!descriptionMatch) continue;
		const title = cleanText(descriptionMatch[1]);
		const portalUrl = normalizeWorldBankUrl(descriptionMatch[2]);
		if (!title || seen.has(portalUrl)) continue;
		seen.add(portalUrl);

		const projectMatch = cells[2]?.match(PROJECT_LINK_PATTERN);
		const noticeType = cleanText(cells[3]);
		const language = cleanText(cells[4]);
		const publishedDate = parseDate(cells[5]);
		const sourceId = sourceIdFromUrl(portalUrl);

		opportunities.push({
			title,
			source: "world_bank",
			sourceId,
			noticeId: sourceId,
			organization: "World Bank",
			countryRegion: cleanText(cells[1]) || undefined,
			category: noticeType || "Procurement notice",
			opportunityType: inferOpportunityType(noticeType),
			publishedDate,
			portalUrl,
			documentUrl: portalUrl,
			rfpLink: portalUrl,
			projectSummary: projectMatch?.[1] ? `Project: ${cleanText(projectMatch[1])}` : undefined,
			funder: "World Bank",
			tags: ["world-bank", "development-bank", "global-procurement"],
			metadata: {
				worldBank: {
					projectTitle: projectMatch?.[1] ? cleanText(projectMatch[1]) : null,
					projectUrl: projectMatch?.[2] ? normalizeWorldBankUrl(projectMatch[2]) : null,
					noticeType,
					language,
					publishedDate: publishedDate?.toISOString() ?? null,
				},
			},
		});
	}

	return opportunities;
}

export const worldBankParser: TenderParser = {
	sourceId: "world_bank",
	name: "World Bank Procurement Notices",
	requiresJavascript: false,
	async parse(content: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseWorldBankMarkdown(content.markdown),
		};
	},
	getPageUrl(baseUrl: string, page: number): string {
		if (page <= 1) return baseUrl;
		const url = new URL(baseUrl, WORLD_BANK_BASE_URL);
		url.searchParams.set("page", String(page));
		return url.toString();
	},
	hasNextPage(): boolean {
		return false;
	},
};

registerParser(worldBankParser);

export default worldBankParser;
