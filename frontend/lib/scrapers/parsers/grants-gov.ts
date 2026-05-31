import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const GRANTS_GOV_SEARCH_API_URL = "https://micro.grants.gov/rest/opportunities/search";
const GRANTS_GOV_DETAIL_BASE_URL = "https://www.grants.gov/search-results-detail";
const DEFAULT_ROWS = 100;
const DEFAULT_MAX_API_PAGES = 1;

type GrantsGovSearchHit = {
	id?: string | number | null;
	number?: string | null;
	title?: string | null;
	agencyCode?: string | null;
	agency?: string | null;
	openDate?: string | null;
	closeDate?: string | null;
	oppStatus?: string | null;
	cfdaList?: string[] | null;
	awardFloor?: string | number | null;
	awardCeiling?: string | number | null;
};

type GrantsGovSearchResponse = {
	hitCount?: number | null;
	startRecord?: number | null;
	oppHits?: GrantsGovSearchHit[] | null;
	errorMsgs?: string[] | null;
	searchParams?: {
		rows?: number | null;
		startRecordNum?: number | null;
		oppStatuses?: string | null;
		sortBy?: string | null;
		keyword?: string | null;
	} | null;
};

function grantsGovSearchUrl(sourceUrl = GRANTS_GOV_SEARCH_API_URL): URL {
	try {
		const parsed = new URL(sourceUrl || GRANTS_GOV_SEARCH_API_URL, GRANTS_GOV_SEARCH_API_URL);
		if (parsed.hostname === "micro.grants.gov" && parsed.pathname === "/rest/opportunities/search") {
			return parsed;
		}
	} catch {
		// Fall through to the public backend URL.
	}
	return new URL(GRANTS_GOV_SEARCH_API_URL);
}

function rowsFor(sourceUrl: string): number {
	const url = grantsGovSearchUrl(sourceUrl);
	const parsed = Number(url.searchParams.get("rows") ?? DEFAULT_ROWS);
	if (!Number.isFinite(parsed)) return DEFAULT_ROWS;
	return Math.min(500, Math.max(1, Math.trunc(parsed)));
}

function maxApiPages(): number {
	const parsed = Number(process.env.GRANTS_GOV_MAX_API_PAGES ?? DEFAULT_MAX_API_PAGES);
	if (!Number.isFinite(parsed)) return DEFAULT_MAX_API_PAGES;
	return Math.min(5, Math.max(1, Math.trunc(parsed)));
}

function parseDate(value: string | null | undefined): Date | undefined {
	const text = cleanText(value);
	if (!text) return undefined;
	const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (slash) {
		const month = Number(slash[1]);
		const day = Number(slash[2]);
		const year = Number(slash[3]);
		if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
			return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
		}
	}
	const parsed = Date.parse(text);
	return Number.isNaN(parsed) ? undefined : new Date(parsed);
}

function utcStartOfDay(value: Date): Date {
	const date = new Date(value.getTime());
	date.setUTCHours(0, 0, 0, 0);
	return date;
}

function isExpired(deadline: Date | undefined, now: Date): boolean {
	return Boolean(deadline && deadline.getTime() < utcStartOfDay(now).getTime());
}

function numericAmount(value: string | number | null | undefined): number | undefined {
	if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : undefined;
	const cleaned = cleanText(value)?.replace(/[$,]/g, "");
	if (!cleaned) return undefined;
	const parsed = Number(cleaned);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function budgetValue(hit: GrantsGovSearchHit): string | undefined {
	const floor = numericAmount(hit.awardFloor);
	const ceiling = numericAmount(hit.awardCeiling);
	if (floor && ceiling) return `USD ${floor} - ${ceiling}`;
	if (ceiling) return `USD ${ceiling}`;
	if (floor) return `USD ${floor}+`;
	return undefined;
}

function portalUrl(hit: GrantsGovSearchHit): string {
	return `${GRANTS_GOV_DETAIL_BASE_URL}/${encodeURIComponent(String(hit.id))}`;
}

function opportunityFromHit(hit: GrantsGovSearchHit, now: Date): OpportunityData | undefined {
	const id = cleanText(hit.id == null ? undefined : String(hit.id));
	const title = cleanText(hit.title);
	if (!id || !title) return undefined;

	const status = cleanText(hit.oppStatus).toLowerCase();
	if (!["posted", "forecasted"].includes(status)) return undefined;

	const deadline = parseDate(hit.closeDate);
	if (status === "posted" && isExpired(deadline, now)) return undefined;

	const publishedDate = parseDate(hit.openDate);
	const number = cleanText(hit.number);
	const agency = cleanText(hit.agency) || "Grants.gov";
	const cfdaList = (hit.cfdaList ?? []).map((cfda) => cleanText(cfda)).filter(Boolean);
	const budgetNumeric = numericAmount(hit.awardCeiling) ?? numericAmount(hit.awardFloor);
	const detailUrl = portalUrl(hit);

	return {
		title,
		source: "grants_gov",
		sourceId: `grants-gov-${id}`,
		noticeId: number || id,
		organization: agency,
		countryRegion: "United States",
		category: status === "forecasted" ? "Forecasted grant opportunity" : "Posted grant opportunity",
		sector: cfdaList.length > 0 ? `Assistance listings: ${cfdaList.join(", ")}` : undefined,
		opportunityType: "grant",
		publishedDate,
		deadline,
		portalUrl: detailUrl,
		documentUrl: detailUrl,
		rfpLink: detailUrl,
		budgetNumeric,
		budgetCurrency: budgetNumeric ? "USD" : undefined,
		budgetValue: budgetValue(hit),
		projectSummary: [
			number ? `Opportunity number: ${number}` : undefined,
			`Status: ${status}`,
			cfdaList.length > 0 ? `Assistance listings: ${cfdaList.join(", ")}` : undefined,
			deadline ? `Close date: ${deadline.toISOString()}` : undefined,
		].filter(Boolean).join("; "),
		tags: ["grants-gov", "us-federal", "grant", "source-api"],
		metadata: {
			grantsGov: {
				id,
				opportunityNumber: number ?? null,
				agencyCode: hit.agencyCode ?? null,
				agency,
				status,
				cfdaList,
				awardFloor: hit.awardFloor ?? null,
				awardCeiling: hit.awardCeiling ?? null,
				detailUrl,
			},
		},
	};
}

export function parseGrantsGovSearchResponse(
	payload: GrantsGovSearchResponse,
	now = new Date()
): OpportunityData[] {
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();
	for (const hit of payload.oppHits ?? []) {
		const opportunity = opportunityFromHit(hit, now);
		if (!opportunity) continue;
		const key = `${opportunity.source}:${opportunity.sourceId}`;
		if (seen.has(key)) continue;
		seen.add(key);
		opportunities.push(opportunity);
	}
	return opportunities;
}

function payloadFor(sourceUrl: string, startRecordNum: number, rows: number): Record<string, string | number> {
	const url = grantsGovSearchUrl(sourceUrl);
	return {
		keyword: url.searchParams.get("keyword") ?? "",
		oppNum: url.searchParams.get("oppNum") ?? "",
		cfda: url.searchParams.get("cfda") ?? "",
		agencies: url.searchParams.get("agencies") ?? "",
		sortBy: url.searchParams.get("sortBy") ?? "openDate|desc",
		rows,
		startRecordNum,
		eligibilities: url.searchParams.get("eligibilities") ?? "",
		fundingCategories: url.searchParams.get("fundingCategories") ?? "",
		fundingInstruments: url.searchParams.get("fundingInstruments") ?? "",
		dateRange: url.searchParams.get("dateRange") ?? "",
		oppStatuses: url.searchParams.get("oppStatuses") ?? "forecasted|posted",
	};
}

async function fetchGrantsGovOpportunities(sourceUrl: string): Promise<GrantsGovSearchResponse> {
	const url = grantsGovSearchUrl(sourceUrl);
	const rows = rowsFor(sourceUrl);
	const hits: GrantsGovSearchHit[] = [];
	let lastResponse: GrantsGovSearchResponse = {};

	for (let page = 0; page < maxApiPages(); page += 1) {
		const startRecordNum = page * rows;
		const response = await fetch(url.toString(), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				"User-Agent": "DocFusionRfpSourceCollector/1.0",
			},
			body: JSON.stringify(payloadFor(sourceUrl, startRecordNum, rows)),
		});
		if (!response.ok) {
			throw new Error(`Grants.gov search endpoint returned HTTP ${response.status}`);
		}
		const payload = await response.json() as GrantsGovSearchResponse;
		lastResponse = payload;
		hits.push(...(payload.oppHits ?? []));
		const total = payload.hitCount ?? hits.length;
		if (hits.length >= total || (payload.oppHits ?? []).length < rows) break;
	}

	return {
		...lastResponse,
		oppHits: hits,
	};
}

export const grantsGovParser: TenderParser = {
	sourceId: "grants_gov",
	name: "Grants.gov Search API",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			const response = await fetchGrantsGovOpportunities(input.url);
			return {
				opportunities: parseGrantsGovSearchResponse(response),
			};
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch Grants.gov opportunities",
			};
		}
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(grantsGovParser);

export default grantsGovParser;
