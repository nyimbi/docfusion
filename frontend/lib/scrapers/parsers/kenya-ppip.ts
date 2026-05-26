/**
 * Kenya PPIP Parser
 *
 * Parser for Kenya's Public Procurement Information Portal (tenders.go.ke).
 * PPIP commonly renders tender listings as a table with Tender No,
 * Description, Procuring Entity, procurement method/category, close date,
 * publish date, and action links.
 */

import type { TenderParser, ParseInput, ParseResult } from "./types";
import { cleanText, parseDate, registerParser } from "./types";
import type { OpportunityData } from "../deduplicator";

interface KenyaTenderRow {
	tenderNo: string;
	description: string;
	organization?: string;
	method?: string;
	category?: string;
	deadline?: Date;
	publishedDate?: Date;
	url?: string;
}

function generateNoticeId(tenderNo: string, description: string): string {
	const key = tenderNo || description;
	return key
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 100) || "kenya-ppip-notice";
}

function resolveTenderUrl(rawUrl: string | undefined, baseUrl: string): string | undefined {
	if (!rawUrl) return undefined;
	try {
		const parsed = new URL(rawUrl, baseUrl);
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return undefined;
	}
}

function opportunityTypeFromMethod(method: string | undefined): OpportunityData["category"] {
	if (!method) return "Tender";
	const lower = method.toLowerCase();
	if (lower.includes("rfp") || lower.includes("proposal")) return "RFP";
	if (lower.includes("rfq") || lower.includes("quotation")) return "RFQ";
	if (lower.includes("eoi") || lower.includes("expression")) return "EOI";
	if (lower.includes("prequalification")) return "Prequalification";
	return method;
}

function parseHtmlRows(html: string | undefined, baseUrl: string): KenyaTenderRow[] {
	if (!html?.trim()) return [];
	const rows: KenyaTenderRow[] = [];
	const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
	let rowMatch: RegExpExecArray | null;

	while ((rowMatch = rowPattern.exec(html)) !== null) {
		const cellMatches = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
		if (cellMatches.length < 3) continue;
		const cells = cellMatches.map((match) => cleanText(stripTags(match[1])));
		const linkMatch = cellMatches[0][1].match(/href=["']([^"']+)["']/i);
		const tenderNo = cells[0];
		const description = cells[1];
		if (!tenderNo || !description) continue;

		rows.push({
			tenderNo,
			description,
			organization: cells[2],
			method: cells[3],
			category: cells[4],
			deadline: parseDate(cells[5]),
			publishedDate: parseDate(cells[7]),
			url: resolveTenderUrl(linkMatch?.[1], baseUrl),
		});
	}

	return rows;
}

function parseMarkdownRows(markdown: string | undefined, baseUrl: string): KenyaTenderRow[] {
	if (!markdown?.trim()) return [];
	const rows: KenyaTenderRow[] = [];

	for (const line of markdown.split(/\r?\n/)) {
		if (!line.includes("|")) continue;
		const cells = line
			.split("|")
			.map((cell) => cleanText(cell))
			.filter(Boolean);
		if (cells.length < 6) continue;
		if (/tender\.?\s*no/i.test(cells[0]) || /^[-:]+$/.test(cells[0])) continue;

		const tenderLink = cells[0].match(/\[([^\]]+)\]\(([^)]+)\)/);
		const tenderNo = cleanText(tenderLink?.[1] ?? cells[0]);
		const description = cleanText(cells[1]);
		if (!tenderNo || !description) continue;

		rows.push({
			tenderNo,
			description,
			organization: cells[2],
			method: cells[3],
			category: cells[4],
			deadline: parseDate(cells[5]),
			publishedDate: parseDate(cells[7]),
			url: resolveTenderUrl(tenderLink?.[2], baseUrl),
		});
	}

	return rows;
}

function stripTags(html: string): string {
	return html
		.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
		.replace(/<style\b[\s\S]*?<\/style>/gi, " ")
		.replace(/<[^>]+>/g, " ");
}

function toOpportunity(row: KenyaTenderRow): OpportunityData {
	return {
		title: row.description,
		source: kenyaPpipParser.sourceId,
		sourceId: row.tenderNo,
		noticeId: row.tenderNo || generateNoticeId(row.tenderNo, row.description),
		organization: row.organization,
		countryRegion: "Kenya",
		deadline: row.deadline,
		publishedDate: row.publishedDate,
		category: row.category || opportunityTypeFromMethod(row.method),
		projectSummary: row.description,
		portalUrl: row.url,
		documentUrl: row.url,
	};
}

export const kenyaPpipParser: TenderParser = {
	sourceId: "kenya_ppip",
	name: "Kenya PPIP",
	requiresJavascript: true,

	async parse(content: ParseInput): Promise<ParseResult> {
		const rows = [
			...parseHtmlRows(content.html, content.url),
			...parseMarkdownRows(content.markdown, content.url),
		];
		const seen = new Set<string>();
		const opportunities: OpportunityData[] = [];

		for (const row of rows) {
			const key = `${row.tenderNo}:${row.organization ?? ""}`.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			opportunities.push(toOpportunity(row));
		}

		return { opportunities };
	},

	getPageUrl(baseUrl: string, page: number): string {
		const url = new URL(baseUrl);
		url.searchParams.set("page", String(page));
		return url.toString();
	},

	hasNextPage(content: ParseInput): boolean {
		return /next|page=\d+|›|»/i.test(`${content.markdown ?? ""} ${content.html ?? ""}`);
	},
};

registerParser(kenyaPpipParser);

export default kenyaPpipParser;
