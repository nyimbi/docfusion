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
const GPP_UGANDA_BASE_URL = "https://gpp.ppda.go.ug";
const GPP_UGANDA_API_BASE_URL = "https://cdn.ppda.go.ug/api";
const NOTICE_LINK_PATTERN = /href=["']([^"']*\/index\/[^"']+)["']/i;
const ROW_PATTERN = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const DATE_PATTERN = /<span\b[^>]*class=["'][^"']*\btext-success-600\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;

type GppUgandaBidInvitation = {
	id?: number | string;
	ocds_id?: string | null;
	procurement_reference_no?: string | null;
	invitation_to_bid_date?: string | null;
	bid_submission_deadline_date?: string | null;
	bid_submission_deadline_time?: string | null;
	estimated_amount?: number | string | null;
	estimated_amount_currency?: {
		abbreviation?: string | null;
		title?: string | null;
	} | null;
	procurement_method?: {
		title?: string | null;
		code?: string | null;
	} | null;
	procurement_plan_entry?: {
		subject_of_procurement?: string | null;
		procurement_type?: {
			title?: string | null;
			ocds_code?: string | null;
		} | null;
		funding_source?: {
			title?: string | null;
		} | null;
	} | null;
	pdes?: {
		title?: string | null;
		abbreviation?: string | null;
		category?: string | null;
	} | null;
};

type GppUgandaBidInvitationPayload = {
	success?: boolean;
	data?: {
		data?: GppUgandaBidInvitation[];
	} | GppUgandaBidInvitation[];
};

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

function inferApiOpportunityType(record: GppUgandaBidInvitation): OpportunityData["opportunityType"] {
	const haystack = [
		record.procurement_method?.title,
		record.procurement_plan_entry?.procurement_type?.title,
		record.procurement_plan_entry?.subject_of_procurement,
	].filter(Boolean).join(" ").toLowerCase();
	if (haystack.includes("expression of interest")) return "eoi";
	if (haystack.includes("proposal") || haystack.includes("consult")) return "rfp";
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

function parseApiDate(value: string | null | undefined): Date | undefined {
	if (!value) return undefined;
	return parseDate(value);
}

function isExpired(deadline: Date | undefined, now = new Date()): boolean {
	if (!deadline) return false;
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	return deadline < today;
}

function gppUgandaPortalUrl(recordId: string | number | undefined): string | undefined {
	if (recordId === undefined || recordId === null || String(recordId).trim() === "") return undefined;
	return `${GPP_UGANDA_BASE_URL}/public/bid-invitations/tender-notice/${encodeURIComponent(String(recordId))}`;
}

function parseEgpUgandaApiPayload(payload: GppUgandaBidInvitationPayload, now = new Date()): OpportunityData[] {
	const records = Array.isArray(payload.data)
		? payload.data
		: payload.data?.data ?? [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const record of records) {
		const subject = cleanText(record.procurement_plan_entry?.subject_of_procurement);
		const reference = cleanText(record.procurement_reference_no);
		const title = subject || reference;
		if (!title) continue;
		const deadline = parseApiDate(record.bid_submission_deadline_date);
		if (isExpired(deadline, now)) continue;

		const id = record.ocds_id || (record.id !== undefined ? String(record.id) : reference);
		if (!id || seen.has(id)) continue;
		seen.add(id);

		const category = cleanText(record.procurement_plan_entry?.procurement_type?.title);
		const method = cleanText(record.procurement_method?.title);
		const organization = cleanText(record.pdes?.title);
		const currency = cleanText(record.estimated_amount_currency?.abbreviation);
		const amount = Number(record.estimated_amount);
		const portalUrl = gppUgandaPortalUrl(record.id);
		opportunities.push({
			title,
			source: "egp_uganda",
			sourceId: id,
			noticeId: reference || id,
			organization,
			countryRegion: "Uganda",
			category: category || method || undefined,
			opportunityType: inferApiOpportunityType(record),
			publishedDate: parseApiDate(record.invitation_to_bid_date),
			deadline,
			portalUrl,
			rfpLink: portalUrl,
			budgetNumeric: Number.isFinite(amount) ? amount : undefined,
			budgetCurrency: currency || undefined,
			budgetValue: Number.isFinite(amount) && currency ? `${currency} ${amount}` : undefined,
			funder: cleanText(record.procurement_plan_entry?.funding_source?.title) || undefined,
			projectSummary: [
				reference ? `Reference: ${reference}` : undefined,
				method ? `Method: ${method}` : undefined,
				category ? `Type: ${category}` : undefined,
				organization ? `Procuring entity: ${organization}` : undefined,
				deadline ? `Deadline: ${formatLocalDate(deadline)}` : undefined,
			].filter(Boolean).join("; ") || undefined,
			tags: ["egp-uganda", "gpp-uganda", "national-procurement"],
			metadata: {
				egpUganda: {
					recordId: record.id ?? null,
					ocdsId: record.ocds_id ?? null,
					reference: reference || null,
					procurementMethod: method || null,
					procuringEntityCategory: record.pdes?.category ?? null,
					deadlineTime: record.bid_submission_deadline_time ?? null,
				},
			},
		});
	}

	return opportunities;
}

async function fetchGppUgandaBidInvitations(url: string): Promise<GppUgandaBidInvitationPayload> {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(20000),
		headers: {
			Accept: "application/json",
			"User-Agent": "LindelaOpportunityDiscovery/1.0",
		},
	});
	if (!response.ok) {
		throw new Error(`Uganda GPP bid invitation API failed: ${response.status} ${response.statusText}`);
	}
	return await response.json() as GppUgandaBidInvitationPayload;
}

function isGppUgandaApiUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return parsed.hostname === "cdn.ppda.go.ug" && parsed.pathname.startsWith("/api/bid-invitations");
	} catch {
		return false;
	}
}

export const egpUgandaParser: TenderParser = {
	sourceId: "egp_uganda",
	name: "Uganda eGP Bid Notices",
	requiresJavascript: false,
	async parse(content: ParseInput): Promise<ParseResult> {
		if (isGppUgandaApiUrl(content.url)) {
			try {
				return {
					opportunities: parseEgpUgandaApiPayload(await fetchGppUgandaBidInvitations(content.url)),
				};
			} catch (error) {
				return {
					opportunities: [],
					error: error instanceof Error ? error.message : String(error),
				};
			}
		}
		return {
			opportunities: parseEgpUgandaHtml(content.html),
		};
	},
	getPageUrl(baseUrl: string, page: number): string {
		if (isGppUgandaApiUrl(baseUrl)) {
			const url = new URL(baseUrl, GPP_UGANDA_API_BASE_URL);
			url.searchParams.set("page", String(page));
			return url.toString();
		}
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

export { parseEgpUgandaApiPayload, parseEgpUgandaHtml };
export default egpUgandaParser;
