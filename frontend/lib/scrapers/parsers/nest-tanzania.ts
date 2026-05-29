import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const NEST_TANZANIA_BASE_URL = "https://nest.go.tz";
const NEST_TANZANIA_RELEASES_URL = `${NEST_TANZANIA_BASE_URL}/gateway/nest-data-portal-api/api/releases`;
const DEFAULT_LOOKBACK_DAYS = 2;
const DEFAULT_MAX_API_PAGES = 2;

type NestNamedEntity = {
	id?: string | null;
	name?: string | null;
	address?: {
		region?: string | null;
		countryName?: string | null;
	} | null;
};

type NestItem = {
	description?: string | null;
	classification?: {
		id?: string | null;
		description?: string | null;
		scheme?: string | null;
	} | null;
	quantity?: number | null;
	unit?: {
		name?: string | null;
	} | null;
};

type NestTender = {
	id?: string | null;
	description?: string | null;
	status?: string | null;
	procurementMethod?: string | null;
	procurementMethodDetails?: string | null;
	additionalProcurementCategories?: string[] | null;
	procuringEntity?: NestNamedEntity | null;
	tenderPeriod?: {
		startDate?: string | null;
		endDate?: string | null;
	} | null;
	items?: NestItem[] | null;
};

type NestRelease = {
	id?: string | null;
	ocid?: string | null;
	date?: string | null;
	tag?: string[] | null;
	buyer?: NestNamedEntity | null;
	parties?: NestNamedEntity[] | null;
	tender?: NestTender | null;
};

type NestReleasesResponse = {
	links?: {
		next?: string | null;
	} | null;
	releases?: NestRelease[] | null;
};

function isoDateDaysAgo(now: Date, days: number): string {
	const date = new Date(now.getTime());
	date.setUTCDate(date.getUTCDate() - days);
	date.setUTCHours(0, 0, 0, 0);
	return date.toISOString();
}

export function nestTanzaniaReleasesApiUrl(sourceUrl: string, now = new Date()): string {
	const url = new URL(sourceUrl || NEST_TANZANIA_RELEASES_URL, NEST_TANZANIA_RELEASES_URL);
	if (!url.searchParams.has("since")) {
		url.searchParams.set("since", isoDateDaysAgo(now, DEFAULT_LOOKBACK_DAYS));
	}
	return url.toString();
}

function maxApiPages(): number {
	const parsed = Number(process.env.NEST_TANZANIA_MAX_API_PAGES ?? DEFAULT_MAX_API_PAGES);
	if (!Number.isFinite(parsed)) return DEFAULT_MAX_API_PAGES;
	return Math.min(5, Math.max(1, Math.trunc(parsed)));
}

function parseIsoDate(value: string | null | undefined): Date | undefined {
	if (!value) return undefined;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? undefined : new Date(parsed);
}

function dateAtUtcStartOfDay(value: Date): Date {
	const date = new Date(value.getTime());
	date.setUTCHours(0, 0, 0, 0);
	return date;
}

function isExpired(deadline: Date | undefined, now: Date): boolean {
	return Boolean(deadline && deadline.getTime() < dateAtUtcStartOfDay(now).getTime());
}

function isOpenTender(tender: NestTender, deadline: Date | undefined, now: Date): boolean {
	const status = cleanText(tender.status).toLowerCase();
	if (["cancelled", "canceled", "complete", "unsuccessful"].includes(status)) return false;
	return !isExpired(deadline, now);
}

function primaryPartyRegion(release: NestRelease): string | undefined {
	const region = release.tender?.procuringEntity?.address?.region
		?? release.buyer?.address?.region
		?? release.parties?.find((party) => cleanText(party.address?.region))?.address?.region;
	return cleanText(region) || undefined;
}

function releaseUrl(release: NestRelease): string {
	if (release.ocid && release.id) {
		return `${NEST_TANZANIA_RELEASES_URL}/${encodeURIComponent(release.ocid)}/${encodeURIComponent(release.id)}`;
	}
	return NEST_TANZANIA_BASE_URL;
}

function inferOpportunityType(tender: NestTender): OpportunityData["opportunityType"] {
	const haystack = [
		tender.description,
		tender.procurementMethod,
		tender.procurementMethodDetails,
		...(tender.additionalProcurementCategories ?? []),
	].join(" ").toLowerCase();
	if (/\b(eoi|expression of interest|request for information|rfi)\b/.test(haystack)) return "eoi";
	if (/\b(rfp|request for proposal|consultancy|consulting|consultant)\b/.test(haystack)) return "rfp";
	return "tender";
}

function itemSummary(items: NestItem[] | null | undefined): string | undefined {
	const descriptions = (items ?? [])
		.map((item) => cleanText(item.description ?? item.classification?.description))
		.filter(Boolean)
		.slice(0, 3);
	return descriptions.length > 0 ? descriptions.join("; ") : undefined;
}

function formatDate(value: Date | undefined): string | undefined {
	return value?.toISOString().slice(0, 10);
}

function opportunityFromRelease(release: NestRelease, sourceUrl: string, now: Date): OpportunityData | undefined {
	const tender = release.tender;
	if (!tender) return undefined;

	const title = cleanText(tender.description);
	const tenderId = cleanText(tender.id);
	if (!title || !tenderId) return undefined;

	const deadline = parseIsoDate(tender.tenderPeriod?.endDate);
	if (!isOpenTender(tender, deadline, now)) return undefined;

	const publishedDate = parseIsoDate(tender.tenderPeriod?.startDate ?? release.date);
	const organization = cleanText(tender.procuringEntity?.name ?? release.buyer?.name);
	const region = primaryPartyRegion(release);
	const portalUrl = releaseUrl(release);
	const method = cleanText(tender.procurementMethodDetails ?? tender.procurementMethod);
	const items = itemSummary(tender.items);
	const noticeId = release.ocid ?? tenderId;

	return {
		title,
		source: "nest_tanzania",
		sourceId: `nest-${noticeId}`,
		noticeId: tenderId,
		organization: organization || "NeST Tanzania",
		countryRegion: "Tanzania",
		category: method || "NeST tender",
		sector: cleanText(tender.items?.[0]?.classification?.description) || undefined,
		opportunityType: inferOpportunityType(tender),
		publishedDate,
		deadline,
		portalUrl,
		documentUrl: portalUrl,
		rfpLink: portalUrl,
		projectSummary: [
			method ? `Procurement method: ${method}` : undefined,
			region ? `Region: ${region}` : undefined,
			items ? `Items: ${items}` : undefined,
			deadline ? `Deadline: ${formatDate(deadline)}` : undefined,
		].filter(Boolean).join("; ") || undefined,
		tags: ["nest-tanzania", "tanzania", "national-procurement", "ocds", "source-api"],
		metadata: {
			nestTanzania: {
				sourcePage: sourceUrl,
				ocid: release.ocid,
				releaseId: release.id,
				tenderId,
				status: tender.status,
				procurementMethod: tender.procurementMethod,
				procurementMethodDetails: tender.procurementMethodDetails,
				region,
				releaseDate: release.date,
			},
		},
	};
}

export function parseNestTanzaniaReleasesResponse(
	response: NestReleasesResponse,
	sourceUrl = NEST_TANZANIA_RELEASES_URL,
	now = new Date()
): OpportunityData[] {
	const seen = new Set<string>();
	const opportunities: OpportunityData[] = [];
	for (const release of response.releases ?? []) {
		const opportunity = opportunityFromRelease(release, sourceUrl, now);
		if (!opportunity) continue;
		const identity = `${opportunity.source}:${opportunity.sourceId}`;
		if (seen.has(identity)) continue;
		seen.add(identity);
		opportunities.push(opportunity);
	}
	return opportunities;
}

async function fetchNestTanzaniaReleases(sourceUrl: string): Promise<NestReleasesResponse> {
	let nextUrl: string | undefined = nestTanzaniaReleasesApiUrl(sourceUrl);
	const releases: NestRelease[] = [];
	let lastResponse: NestReleasesResponse = {};

	for (let page = 0; nextUrl && page < maxApiPages(); page += 1) {
		const response = await fetch(nextUrl, {
			headers: {
				Accept: "application/json",
				"User-Agent": "DocFusionRfpSourceCollector/1.0",
			},
		});
		if (!response.ok) {
			throw new Error(`NeST Tanzania releases endpoint returned HTTP ${response.status}`);
		}
		const payload = await response.json() as NestReleasesResponse;
		lastResponse = payload;
		releases.push(...(payload.releases ?? []));
		nextUrl = payload.links?.next ?? undefined;
	}

	return {
		...lastResponse,
		releases,
	};
}

export const nestTanzaniaParser: TenderParser = {
	sourceId: "nest_tanzania",
	name: "NeST Tanzania OCDS Releases",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			const response = await fetchNestTanzaniaReleases(input.url);
			return {
				opportunities: parseNestTanzaniaReleasesResponse(response, input.url),
			};
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch NeST Tanzania releases",
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

registerParser(nestTanzaniaParser);

export default nestTanzaniaParser;
