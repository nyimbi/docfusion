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

export interface KenyaPpipApiTender {
	id?: number | string;
	ocid?: string | null;
	title?: string | null;
	tender_ref?: string | null;
	venue?: string | null;
	description?: string | null;
	published_at?: string | null;
	close_at?: string | null;
	terminated?: boolean | number | null;
	addendum_added?: boolean | number | null;
	is_reservation?: boolean | number | null;
	pe?: {
		name?: string | null;
		email?: string | null;
		org_url?: string | null;
		code?: string | null;
	} | null;
	procurement_method?: {
		title?: string | null;
		code?: string | null;
		portal_code?: string | null;
	} | null;
	procurement_category?: {
		title?: string | null;
		code?: string | null;
	} | null;
	submission_methods?: Array<{
		title?: string | null;
		code?: string | null;
	}> | null;
	bidder_categories?: Array<{
		code?: string | null;
		description?: string | null;
	}> | null;
	agpo_groups?: Array<{
		code?: string | null;
		name?: string | null;
	}> | null;
	documents?: KenyaPpipApiDocument[] | null;
}

interface KenyaPpipApiDocument {
	description?: string | null;
	url?: string | null;
	document_type_id?: number | null;
	type?: {
		description?: string | null;
		code?: string | null;
	} | null;
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

function parseKenyaPpipDate(value: string | null | undefined): Date | undefined {
	if (!value) return undefined;
	const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
	if (match) {
		return new Date(
			Number(match[1]),
			Number(match[2]) - 1,
			Number(match[3]),
			Number(match[4] ?? 0),
			Number(match[5] ?? 0),
			Number(match[6] ?? 0)
		);
	}
	return parseDate(value);
}

function selectPrimaryDocument(documents: KenyaPpipApiDocument[] | null | undefined): KenyaPpipApiDocument | undefined {
	if (!documents?.length) return undefined;
	return documents.find((document) => document.type?.code === "tenderDocument" || document.document_type_id === 1)
		?? documents.find((document) => document.type?.code === "tenderNotice" || document.document_type_id === 7)
		?? documents[0];
}

function booleanFlag(value: boolean | number | null | undefined): boolean {
	return value === true || value === 1;
}

function apiTenderMethod(tender: KenyaPpipApiTender): string | undefined {
	return cleanText(tender.procurement_method?.title ?? undefined) || undefined;
}

function apiTenderCategory(tender: KenyaPpipApiTender): string | undefined {
	return cleanText(tender.procurement_category?.title ?? undefined) || undefined;
}

function apiTenderReference(tender: KenyaPpipApiTender): string {
	return cleanText(tender.tender_ref ?? undefined)
		|| cleanText(tender.ocid ?? undefined)
		|| (tender.id === undefined ? "" : String(tender.id));
}

export function mapKenyaPpipApiTenderToOpportunity(
	tender: KenyaPpipApiTender,
	baseUrl = "https://tenders.go.ke"
): OpportunityData | null {
	const title = cleanText(tender.title ?? undefined);
	if (!title) return null;

	const tenderReference = apiTenderReference(tender);
	const method = apiTenderMethod(tender);
	const category = apiTenderCategory(tender);
	const primaryDocument = selectPrimaryDocument(tender.documents);
	const documentUrl = resolveTenderUrl(primaryDocument?.url ?? undefined, baseUrl);
	const portalUrl = tender.id === undefined
		? resolveTenderUrl("/tenders", baseUrl)
		: resolveTenderUrl(`/tenders/${tender.id}`, baseUrl);
	const submissionMethods = tender.submission_methods
		?.map((methodOption) => cleanText(methodOption.title ?? undefined))
		.filter(Boolean)
		.join("; ");
	const tags = [
		booleanFlag(tender.addendum_added) ? "addendum" : undefined,
		booleanFlag(tender.is_reservation) ? "reservation" : undefined,
		...(tender.agpo_groups ?? []).map((group) => cleanText(group.name ?? group.code ?? undefined)),
	].filter((tag): tag is string => Boolean(tag));

	return {
		title,
		source: kenyaPpipParser.sourceId,
		sourceId: tenderReference || (tender.id === undefined ? generateNoticeId("", title) : String(tender.id)),
		noticeId: tenderReference || undefined,
		organization: cleanText(tender.pe?.name ?? undefined) || undefined,
		countryRegion: "Kenya",
		deadline: parseKenyaPpipDate(tender.close_at),
		publishedDate: parseKenyaPpipDate(tender.published_at),
		category: category || opportunityTypeFromMethod(method),
		projectSummary: cleanText(tender.description ?? undefined) || title,
		submissionMethod: submissionMethods || undefined,
		opportunityType: "tender",
		portalUrl,
		documentUrl,
		rfpLink: documentUrl ?? portalUrl,
		tags,
		metadata: {
			ppip: {
				id: tender.id,
				ocid: tender.ocid,
				tenderRef: tender.tender_ref,
				venue: tender.venue,
				method,
				methodCode: tender.procurement_method?.code,
				methodPortalCode: tender.procurement_method?.portal_code,
				category,
				categoryCode: tender.procurement_category?.code,
				documentCount: tender.documents?.length ?? 0,
				terminated: booleanFlag(tender.terminated),
				addendumAdded: booleanFlag(tender.addendum_added),
				isReservation: booleanFlag(tender.is_reservation),
			},
		},
	};
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
