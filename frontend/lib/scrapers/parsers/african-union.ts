import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const AU_BASE_URL = "https://au.int";
export const AFRICAN_UNION_BIDS_URL = `${AU_BASE_URL}/en/bids`;
const DEFAULT_DETAIL_LIMIT = 25;

type AuBidRow = {
	title: string;
	portalUrl: string;
	deadline?: Date;
	deadlineText?: string;
	bidNumber?: string;
	bidType?: string;
};

type AuBidDetail = {
	publishedDate?: Date;
	deadline?: Date;
	deadlineText?: string;
	bidNumber?: string;
	documentLinks: Array<{ label: string; url: string }>;
	summary?: string;
};

function decodeEntities(value: string): string {
	return value
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, "\"")
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">");
}

function stripHtml(value: string): string {
	return cleanText(decodeEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function absoluteAuUrl(rawUrl: string | undefined): string | undefined {
	const cleaned = decodeEntities(rawUrl ?? "").trim();
	if (!cleaned || /^javascript:/i.test(cleaned)) return undefined;
	try {
		return new URL(cleaned, AU_BASE_URL).toString();
	} catch {
		return undefined;
	}
}

function validDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseVisibleAuDate(value: string | undefined): Date | undefined {
	const cleaned = value?.replace(/\s+/g, " ").trim();
	if (!cleaned) return undefined;
	const match = /^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/.exec(cleaned);
	if (!match) return validDate(cleaned);
	const monthIndex = [
		"january",
		"february",
		"march",
		"april",
		"may",
		"june",
		"july",
		"august",
		"september",
		"october",
		"november",
		"december",
	].indexOf((match[1] ?? "").toLowerCase());
	if (monthIndex < 0) return undefined;
	return new Date(Date.UTC(Number(match[3]), monthIndex, Number(match[2]), 20, 59, 59));
}

function fieldHtml(rowHtml: string, className: string): string | undefined {
	const match = new RegExp(`<td\\b[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/td>`, "i").exec(rowHtml);
	return match?.[1];
}

function linkFromHtml(html: string | undefined): { label: string; url: string } | undefined {
	if (!html) return undefined;
	const match = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(html);
	const url = absoluteAuUrl(match?.[1]);
	const label = stripHtml(match?.[2] ?? "");
	return url && label ? { label, url } : undefined;
}

function sourceIdFor(row: Pick<AuBidRow, "bidNumber" | "portalUrl" | "title">): string {
	const portalSlug = row.portalUrl.split("/").filter(Boolean).pop();
	const slug = (portalSlug || row.title)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 90);
	return `african-union-${slug || "bid"}`;
}

function inferOpportunityType(title: string, bidType: string | undefined): OpportunityData["opportunityType"] {
	const haystack = `${title} ${bidType ?? ""}`.toLowerCase();
	if (/\b(eoi|expression of interest|open call)\b/.test(haystack)) return "eoi";
	if (/\b(consultancy|consultant|request for proposal|rfp)\b/.test(haystack)) return "rfp";
	return "tender";
}

function documentLinksFromDetail(html: string): Array<{ label: string; url: string }> {
	const fileField = /field-name-field-file[\s\S]*?(?:<div class="panel-separator"|<\/article>)/i.exec(html)?.[0] ?? html;
	const seen = new Set<string>();
	const links: Array<{ label: string; url: string }> = [];
	for (const match of fileField.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
		const url = absoluteAuUrl(match[1]);
		if (!url || seen.has(url)) continue;
		seen.add(url);
		links.push({
			url,
			label: stripHtml(match[2] ?? "") || url.split("/").pop() || "AU bid document",
		});
	}
	return links;
}

function bidNumberFromDetail(html: string): string | undefined {
	const field = /field-name-field-text-bidnumber[\s\S]*?<div class=["']field-item[^"']*["']>([\s\S]*?)<\/div>/i.exec(html)?.[1];
	return stripHtml(field ?? "") || undefined;
}

function dateDetail(html: string): Pick<AuBidDetail, "publishedDate" | "deadline" | "deadlineText"> {
	const dateField = /field-name-field-date[\s\S]*?(?:<div class="panel-separator"|<\/article>)/i.exec(html)?.[0] ?? "";
	const start = /date-display-start[^>]*content=["']([^"']+)["'][^>]*>([\s\S]*?)<\/span>/i.exec(dateField);
	const end = /date-display-end[^>]*content=["']([^"']+)["'][^>]*>([\s\S]*?)<\/span>/i.exec(dateField);
	const single = /date-display-single[^>]*content=["']([^"']+)["'][^>]*>([\s\S]*?)<\/span>/i.exec(dateField);
	return {
		publishedDate: validDate(start?.[1] ?? single?.[1]),
		deadline: validDate(end?.[1]) ?? parseVisibleAuDate(stripHtml(single?.[2] ?? "")),
		deadlineText: stripHtml(end?.[2] ?? single?.[2] ?? "") || undefined,
	};
}

function summaryFromDetail(html: string): string | undefined {
	const body = /field-name-body[\s\S]*?(?:<div class="panel-separator"|<\/article>)/i.exec(html)?.[0];
	return stripHtml(body ?? "") || undefined;
}

export function parseAfricanUnionBidsHtml(html: string): AuBidRow[] {
	const tableBody = /<table\b[^>]*class=["'][^"']*\bviews-table\b[^"']*["'][^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i.exec(html)?.[1] ?? "";
	const rows: AuBidRow[] = [];
	const seen = new Set<string>();
	for (const match of tableBody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
		const rowHtml = match[1] ?? "";
		const titleLink = linkFromHtml(fieldHtml(rowHtml, "views-field-title"));
		if (!titleLink || seen.has(titleLink.url)) continue;
		seen.add(titleLink.url);
		const deadlineText = stripHtml(fieldHtml(rowHtml, "views-field-field-date") ?? "");
		rows.push({
			title: titleLink.label,
			portalUrl: titleLink.url,
			deadline: parseVisibleAuDate(deadlineText),
			deadlineText,
			bidType: stripHtml(fieldHtml(rowHtml, "views-field-field-tags-documents") ?? "") || undefined,
			bidNumber: stripHtml(fieldHtml(rowHtml, "views-field-field-text-bidnumber") ?? "") || undefined,
		});
	}
	return rows;
}

export function parseAfricanUnionBidDetailHtml(html: string): AuBidDetail {
	return {
		...dateDetail(html),
		bidNumber: bidNumberFromDetail(html),
		documentLinks: documentLinksFromDetail(html),
		summary: summaryFromDetail(html),
	};
}

function opportunityFromRow(row: AuBidRow, detail?: AuBidDetail): OpportunityData {
	const bidNumber = detail?.bidNumber ?? row.bidNumber;
	const documentLinks = detail?.documentLinks ?? [];
	const primaryDocument = documentLinks[0];
	const deadline = detail?.deadline ?? row.deadline;
	const deadlineText = detail?.deadlineText ?? row.deadlineText;
	const sourceId = sourceIdFor({ ...row, bidNumber });
	return {
		title: row.title,
		source: "african_union",
		sourceId,
		noticeId: bidNumber ?? sourceId,
		organization: "African Union Commission",
		countryRegion: "Africa",
		category: row.bidType ?? "African Union procurement",
		opportunityType: inferOpportunityType(row.title, row.bidType),
		publishedDate: detail?.publishedDate,
		deadline,
		portalUrl: row.portalUrl,
		documentUrl: primaryDocument?.url,
		rfpLink: primaryDocument?.url ?? row.portalUrl,
		projectSummary: [
			bidNumber ? `Bid number: ${bidNumber}` : undefined,
			deadlineText ? `Deadline: ${deadlineText}` : undefined,
			detail?.summary,
			documentLinks.length > 0 ? `${documentLinks.length} linked bid document(s) found.` : undefined,
		].filter(Boolean).join("; "),
		submissionMethod: "Use the African Union bid notice and linked bid document for submission instructions.",
		tags: ["african-union", "auc", "regional-procurement", "direct-documents"],
		metadata: {
			africanUnion: {
				bidNumber,
				deadlineText,
				bidType: row.bidType,
				documentLinks,
			},
		},
	};
}

function detailLimit(): number {
	const parsed = Number(process.env.AFRICAN_UNION_DETAIL_LIMIT ?? DEFAULT_DETAIL_LIMIT);
	if (!Number.isFinite(parsed)) return DEFAULT_DETAIL_LIMIT;
	return Math.min(50, Math.max(0, Math.trunc(parsed)));
}

async function fetchHtml(url: string): Promise<string> {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(30000),
		headers: {
			"Accept": "text/html,application/xhtml+xml",
			"User-Agent": "Mozilla/5.0 (compatible; LindelaOpportunityDiscovery/1.0; +https://lindela.io)",
		},
	});
	if (!response.ok) {
		throw new Error(`African Union bid fetch failed: ${response.status} ${response.statusText}`);
	}
	return response.text();
}

async function fetchAfricanUnionBids(sourceUrl: string): Promise<OpportunityData[]> {
	const html = await fetchHtml(sourceUrl || AFRICAN_UNION_BIDS_URL);
	const rows = parseAfricanUnionBidsHtml(html);
	const limit = detailLimit();
	const details = await Promise.all(rows.slice(0, limit).map(async (row) => {
		try {
			return parseAfricanUnionBidDetailHtml(await fetchHtml(row.portalUrl));
		} catch {
			return undefined;
		}
	}));
	return rows.map((row, index) => opportunityFromRow(row, details[index]));
}

export const africanUnionParser: TenderParser = {
	sourceId: "african_union",
	name: "African Union Bids",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		if (!input.html?.trim() && input.url) {
			return { opportunities: await fetchAfricanUnionBids(input.url) };
		}
		const rows = parseAfricanUnionBidsHtml(input.html ?? "");
		return { opportunities: rows.map((row) => opportunityFromRow(row)) };
	},

	getPageUrl(baseUrl: string, page: number): string {
		if (page <= 1) return baseUrl || AFRICAN_UNION_BIDS_URL;
		const url = new URL(baseUrl || AFRICAN_UNION_BIDS_URL);
		url.searchParams.set("page", String(page - 1));
		return url.toString();
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(africanUnionParser);
