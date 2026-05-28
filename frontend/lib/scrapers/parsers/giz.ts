/**
 * GIZ country tender page parser.
 *
 * GIZ publishes many country-office tenders as simple markdown blocks:
 * a deadline line, a procurement title, then one or more downloadable files.
 * The generic parser misses these because the title is not a heading and the
 * attachment links often carry the only source document URL.
 */

import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const GIZ_BASE_URL = "https://www.giz.de";
const DEADLINE_PATTERN = /^Deadline:\s*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})\s*$/gim;
const DOCUMENT_LINK_PATTERN = /\[([^\]]*)]\((https?:\/\/www\.giz\.de\/sites\/default\/files\/media\/[^)]+\.(?:pdf|docx?|xlsx?|zip)[^)]*)\s+"[^"]*"\)/gi;
const PROCUREMENT_TITLE_PATTERN = /^(?:Procurement|Expression of Interest|Request for (?:Proposal|Quotation)|Invitation to Bid)\b.*$/im;

function parseGizDate(value: string): Date | undefined {
	const match = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
	if (!match) return undefined;
	const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
	const month = Number(match[2]);
	const day = Number(match[1]);
	if (!year || !month || !day) return undefined;
	return new Date(year, month - 1, day);
}

function countryFromMarkdown(markdown: string, sourceUrl: string): string {
	const heading = markdown.match(/(?:^|\n)([A-Z][A-Za-z\s,]+)\n=+\n/)?.[1];
	if (heading) return cleanText(heading);
	try {
		const segments = new URL(sourceUrl).pathname.split("/").filter(Boolean);
		const country = segments[segments.length - 2];
		const cleaned = cleanText(country?.replace(/-/g, " "));
		return cleaned ? cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "GIZ";
	} catch {
		return "GIZ";
	}
}

function sourceIdFrom(title: string, deadline: string, documentUrl?: string): string {
	const reference = title.match(/\b\d{7,10}\b/)?.[0] ?? documentUrl?.match(/\b\d{7,10}\b/)?.[0];
	if (reference) return `giz-${reference}`;
	const slug = `${deadline}-${title}`
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
	return `giz-${slug || "tender"}`;
}

function inferOpportunityType(title: string): OpportunityData["opportunityType"] {
	const normalized = title.toLowerCase();
	if (normalized.includes("expression of interest") || /\beoi\b/.test(normalized)) return "eoi";
	if (normalized.includes("request for proposal") || /\brfp\b/.test(normalized)) return "rfp";
	if (normalized.includes("request for quotation") || /\brfq\b/.test(normalized)) return "tender";
	return "tender";
}

function documentLinks(block: string): Array<{ label?: string; url: string }> {
	const links: Array<{ label?: string; url?: string }> = [...block.matchAll(DOCUMENT_LINK_PATTERN)]
		.map((match) => ({
			label: cleanText(match[1]) || undefined,
			url: match[2]?.trim(),
		}));
	return links
		.filter((link): link is { label?: string; url: string } => Boolean(link.url));
}

function titleFromBlock(block: string): string | undefined {
	const match = block.match(PROCUREMENT_TITLE_PATTERN);
	if (!match) return undefined;
	return cleanText(match[0].replace(/Procurement ofService/i, "Procurement of Service"));
}

function blockSummary(block: string, title: string): string {
	const compact = cleanText(
		block
			.replace(DOCUMENT_LINK_PATTERN, "")
			.replace(/zip|pdf|docx?|xlsx?/gi, " ")
			.replace(/\b\d+(?:\.\d+)?\s*(?:KB|MB)\b/gi, " ")
	);
	return compact && compact !== title
		? compact.slice(0, 900)
		: "GIZ country office tender with downloadable procurement documents.";
}

function parseGizMarkdown(markdown: string | undefined, sourceUrl: string): OpportunityData[] {
	if (!markdown) return [];
	const country = countryFromMarkdown(markdown, sourceUrl);
	const deadlines = [...markdown.matchAll(DEADLINE_PATTERN)];
	const opportunities: OpportunityData[] = [];

	for (let index = 0; index < deadlines.length; index++) {
		const deadlineMatch = deadlines[index];
		const deadlineText = deadlineMatch[1];
		const start = (deadlineMatch.index ?? 0) + deadlineMatch[0].length;
		const end = deadlines[index + 1]?.index ?? markdown.length;
		const block = markdown.slice(start, end);
		const title = titleFromBlock(block);
		if (!title) continue;

		const docs = documentLinks(block);
		const primaryDocument = docs[0]?.url;
		const sourceId = sourceIdFrom(title, deadlineText, primaryDocument);

		opportunities.push({
			title,
			source: "giz",
			sourceId,
			noticeId: sourceId,
			organization: `GIZ ${country}`,
			countryRegion: country,
			category: "GIZ tender",
			opportunityType: inferOpportunityType(title),
			deadline: parseGizDate(deadlineText),
			portalUrl: sourceUrl,
			documentUrl: primaryDocument,
			rfpLink: primaryDocument ?? sourceUrl,
			projectSummary: blockSummary(block, title),
			submissionMethod: /email/i.test(markdown) ? "Submit according to GIZ country office tender instructions." : undefined,
			tags: ["giz", "bilateral-donor", "source-scrape"],
			metadata: {
				giz: {
					sourcePage: sourceUrl,
					deadline: deadlineText,
					documentLinks: docs,
				},
			},
		});
	}

	return opportunities;
}

export const gizParser: TenderParser = {
	sourceId: "giz",
	name: "GIZ Country Tenders",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseGizMarkdown(input.markdown ?? input.html, input.url),
		};
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(gizParser);
