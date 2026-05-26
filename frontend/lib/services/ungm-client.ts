import { fetchPublicHttpUrl } from "@/lib/security/public-url";
import { parseUngmSearchHtml } from "@/lib/scrapers/parsers/ungm";
import type { OpportunityData } from "@/lib/scrapers/deduplicator";

interface UngmNoticeSearchPayload {
	PageIndex: number;
	PageSize: number;
	Title: string;
	Description: string;
	Reference: string;
	PublishedFrom: string;
	PublishedTo: string;
	DeadlineFrom: string;
	DeadlineTo: string;
	Countries: number[];
	Agencies: number[];
	UNSPSCs: number[];
	NoticeTypes: string[];
	SortField: "Deadline" | "DatePublished";
	SortAscending: boolean;
	isPicker: boolean;
	IsSustainable: boolean;
	IsActive: boolean;
	NoticeDisplayType: null;
	NoticeSearchTotalLabelId: string;
	TypeOfCompetitions: string[];
}

export interface UngmFetchResult {
	searchUrl: string;
	opportunities: OpportunityData[];
	total?: number;
}

export interface UngmFetchOptions {
	limit?: number;
	timeoutMs?: number;
	now?: Date;
}

const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const MONTH_ABBREVIATIONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function isUngmUrl(sourceUrl: string): boolean {
	try {
		return new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase() === "ungm.org";
	} catch {
		return false;
	}
}

function formatUngmSearchDate(date: Date): string {
	const day = String(date.getDate()).padStart(2, "0");
	const month = MONTH_ABBREVIATIONS[date.getMonth()];
	const year = String(date.getFullYear()).slice(-2);
	return `${day}-${month}-${year}`;
}

function parseNumericList(value: string | null): number[] {
	if (!value) return [];
	return value
		.split(",")
		.map((entry) => Number(entry.trim()))
		.filter((entry) => Number.isInteger(entry) && entry > 0);
}

function parseStringList(value: string | null): string[] {
	if (!value) return [];
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function buildSearchPayload(sourceUrl: URL, limit: number, now: Date): UngmNoticeSearchPayload {
	const activeOnly = sourceUrl.searchParams.get("active")?.toLowerCase() !== "false";
	const today = formatUngmSearchDate(now);

	return {
		PageIndex: Math.max(Number(sourceUrl.searchParams.get("page") ?? 0), 0),
		PageSize: Math.min(Math.max(limit, 1), MAX_LIMIT),
		Title: sourceUrl.searchParams.get("title") ?? "",
		Description: sourceUrl.searchParams.get("description") ?? "",
		Reference: sourceUrl.searchParams.get("reference") ?? "",
		PublishedFrom: sourceUrl.searchParams.get("publishedFrom") ?? "",
		PublishedTo: sourceUrl.searchParams.get("publishedTo") ?? today,
		DeadlineFrom: sourceUrl.searchParams.get("deadlineFrom") ?? (activeOnly ? today : ""),
		DeadlineTo: sourceUrl.searchParams.get("deadlineTo") ?? "",
		Countries: parseNumericList(sourceUrl.searchParams.get("countries") ?? sourceUrl.searchParams.get("country")),
		Agencies: parseNumericList(sourceUrl.searchParams.get("agencies") ?? sourceUrl.searchParams.get("agency")),
		UNSPSCs: parseNumericList(sourceUrl.searchParams.get("unspscs") ?? sourceUrl.searchParams.get("unspsc")),
		NoticeTypes: parseStringList(sourceUrl.searchParams.get("noticeTypes") ?? sourceUrl.searchParams.get("noticeType")),
		SortField: sourceUrl.searchParams.get("sort") === "DatePublished" ? "DatePublished" : "Deadline",
		SortAscending: sourceUrl.searchParams.get("sortAscending")?.toLowerCase() !== "false",
		isPicker: false,
		IsSustainable: sourceUrl.searchParams.get("sustainable")?.toLowerCase() === "true",
		IsActive: activeOnly,
		NoticeDisplayType: null,
		NoticeSearchTotalLabelId: "noticeSearchTotal",
		TypeOfCompetitions: parseStringList(sourceUrl.searchParams.get("competitionTypes") ?? sourceUrl.searchParams.get("competitionType")),
	};
}

function buildSearchUrl(sourceUrl: URL): string {
	return new URL("/Public/Notice/Search", sourceUrl.origin).toString();
}

function extractSearchTotal(html: string): number | undefined {
	const match = html.match(/var\s+noticeTotal\s*=\s*["'](\d+)["']/i);
	return match ? Number(match[1]) : undefined;
}

export async function fetchUngmOpportunities(
	sourceUrl: string,
	options: UngmFetchOptions = {}
): Promise<UngmFetchResult> {
	const parsed = new URL(sourceUrl);
	const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
	const searchUrl = buildSearchUrl(parsed);
	const payload = buildSearchPayload(parsed, limit, options.now ?? new Date());
	const response = await fetchPublicHttpUrl(searchUrl, {
		method: "POST",
		headers: {
			Accept: "text/html, */*; q=0.01",
			"Content-Type": "application/json",
			Referer: new URL("/Public/Notice", parsed.origin).toString(),
			"User-Agent": "DocFusion/1.0 opportunity-discovery",
			"X-Requested-With": "XMLHttpRequest",
		},
		body: JSON.stringify(payload),
		timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
	}, "UNGM notice search URL");

	if (!response.ok) {
		throw new Error(`UNGM notice search returned HTTP ${response.status}`);
	}

	const html = await response.text();
	return {
		searchUrl,
		opportunities: parseUngmSearchHtml(html, parsed.origin),
		total: extractSearchTotal(html),
	};
}
