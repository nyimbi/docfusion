/**
 * UNDP procurement notices parser.
 *
 * UNDP rows arrive from Firecrawl as field-packed link text. Parse the labels
 * directly so source identity and notice metadata survive configured imports.
 */

import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const UNDP_BASE_URL = "https://procurement-notices.undp.org";
const LABEL_PATTERN = /\b(Title|Ref No|UNDP Office\/Country|Office\/Country|Process|Deadline|Posted)\b/gi;
const LINK_PATTERN = /\[([^\]]+)]\((https?:\/\/procurement-notices\.undp\.org\/[^)]+)\)/gi;

function normalizeInlineText(text: string): string {
	return cleanText(text.replace(/\\+/g, " "));
}

function extractLabelledFields(text: string): Record<string, string> {
	const normalized = normalizeInlineText(text);
	const matches = [...normalized.matchAll(LABEL_PATTERN)];
	const fields: Record<string, string> = {};

	for (let index = 0; index < matches.length; index++) {
		const match = matches[index];
		const label = match[1].toLowerCase();
		const start = (match.index ?? 0) + match[0].length;
		const end = matches[index + 1]?.index ?? normalized.length;
		const value = cleanText(normalized.slice(start, end));
		if (value) fields[label] = value;
	}

	return fields;
}

function parseUndpDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	const match = value.match(/(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/);
	if (!match) return undefined;
	const months: Record<string, number> = {
		jan: 0,
		feb: 1,
		mar: 2,
		apr: 3,
		may: 4,
		jun: 5,
		jul: 6,
		aug: 7,
		sep: 8,
		oct: 9,
		nov: 10,
		dec: 11,
	};
	const month = months[match[2].toLowerCase()];
	if (month === undefined) return undefined;
	const rawYear = Number(match[3]);
	const year = rawYear < 100 ? 2000 + rawYear : rawYear;
	return new Date(year, month, Number(match[1]));
}

function sourceIdFromUrl(url: string): string {
	try {
		const parsed = new URL(url);
		const negotiationId = parsed.searchParams.get("nego_id");
		if (negotiationId) return `nego-${negotiationId}`;
	} catch {
		// Fall back to slug below.
	}
	return url
		.replace(/^https?:\/\/procurement-notices\.undp\.org\//i, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80) || "undp-procurement-notice";
}

function inferOpportunityType(process: string | undefined): OpportunityData["opportunityType"] {
	const normalized = process?.toLowerCase() ?? "";
	if (normalized.includes("expression of interest") || /\beoi\b/.test(normalized)) return "eoi";
	if (normalized.includes("request for proposal") || /\brfp\b/.test(normalized)) return "rfp";
	if (normalized.includes("request for quotation") || /\brfq\b/.test(normalized)) return "tender";
	if (normalized.includes("invitation to bid") || /\bitb\b/.test(normalized)) return "tender";
	return "tender";
}

function parseOfficeCountry(value: string | undefined): { organization?: string; countryRegion?: string } {
	if (!value) return {};
	const [organization, countryRegion] = value.split("/").map((part) => cleanText(part)).filter(Boolean);
	return { organization, countryRegion };
}

function parseUndpMarkdown(markdown: string | undefined): OpportunityData[] {
	if (!markdown) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const match of markdown.matchAll(LINK_PATTERN)) {
		const fields = extractLabelledFields(match[1]);
		const title = cleanText(fields.title);
		const portalUrl = match[2];
		if (!title || seen.has(portalUrl)) continue;
		seen.add(portalUrl);

		const office = parseOfficeCountry(fields["undp office/country"] ?? fields["office/country"]);
		const process = cleanText(fields.process);
		const refNo = cleanText(fields["ref no"]);
		const sourceId = refNo || sourceIdFromUrl(portalUrl);
		const deadline = parseUndpDate(fields.deadline);
		const publishedDate = parseUndpDate(fields.posted);

		opportunities.push({
			title,
			source: "undp",
			sourceId,
			noticeId: sourceId,
			organization: office.organization,
			countryRegion: office.countryRegion,
			category: process || "UNDP procurement notice",
			opportunityType: inferOpportunityType(process),
			deadline,
			publishedDate,
			portalUrl,
			documentUrl: portalUrl,
			rfpLink: portalUrl,
			projectSummary: process ? `Process: ${process}` : undefined,
			tags: ["undp", "un-procurement"],
			metadata: {
				undp: {
					refNo: refNo || null,
					process: process || null,
					deadline: deadline?.toISOString() ?? null,
					publishedDate: publishedDate?.toISOString() ?? null,
				},
			},
		});
	}

	return opportunities;
}

export const undpParser: TenderParser = {
	sourceId: "undp",
	name: "UNDP Procurement Notices",
	requiresJavascript: false,
	async parse(content: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseUndpMarkdown(content.markdown),
		};
	},
	getPageUrl(baseUrl: string, page: number): string {
		if (page <= 1) return baseUrl;
		const url = new URL(baseUrl, UNDP_BASE_URL);
		url.searchParams.set("page", String(page));
		return url.toString();
	},
	hasNextPage(): boolean {
		return false;
	},
};

registerParser(undpParser);

export default undpParser;
