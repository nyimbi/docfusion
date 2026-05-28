import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const EU_SEARCH_API_URL = "https://api.tech.ec.europa.eu/search-api/prod/rest/search";
const EU_PORTAL_BASE_URL = "https://ec.europa.eu/info/funding-tenders/opportunities/portal";
const EU_DEFAULT_QUERY = "proposal";
const EU_DEFAULT_PAGE_SIZE = 25;

type EuMetadata = Record<string, string[] | undefined>;

type EuSearchResult = {
	reference?: string;
	url?: string;
	summary?: string;
	content?: string;
	metadata?: EuMetadata;
	score?: number;
};

type EuSearchResponse = {
	totalResults?: number;
	results?: EuSearchResult[];
	warnings?: unknown[];
};

function stripHtml(value: string | undefined): string {
	return cleanText((value ?? "")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(?:p|li|h\d)>/gi, "\n")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, "\"")
		.replace(/&#39;/g, "'"));
}

function metadataValue(metadata: EuMetadata | undefined, key: string): string | undefined {
	return metadata?.[key]?.find((value) => cleanText(value));
}

function queryFromSourceUrl(sourceUrl: string): string {
	try {
		const url = new URL(sourceUrl);
		return url.searchParams.get("keywords")
			?? url.searchParams.get("q")
			?? url.searchParams.get("query")
			?? url.searchParams.get("text")
			?? EU_DEFAULT_QUERY;
	} catch {
		return EU_DEFAULT_QUERY;
	}
}

export function euFundingTendersSearchApiUrl(sourceUrl: string, pageSize = EU_DEFAULT_PAGE_SIZE): string {
	const apiUrl = new URL(EU_SEARCH_API_URL);
	apiUrl.searchParams.set("apiKey", "SEDIA");
	apiUrl.searchParams.set("text", queryFromSourceUrl(sourceUrl));
	apiUrl.searchParams.set("pageSize", String(pageSize));
	apiUrl.searchParams.set("pageNumber", "1");
	return apiUrl.toString();
}

function parseEuDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	const timestamp = Date.parse(value);
	return Number.isNaN(timestamp) ? undefined : new Date(timestamp);
}

function futureDeadline(metadata: EuMetadata | undefined, now: Date): Date | undefined {
	for (const value of metadata?.deadlineDate ?? []) {
		const deadline = parseEuDate(value);
		if (deadline && deadline.getTime() >= now.getTime()) return deadline;
	}
	return undefined;
}

function canonicalPortalUrl(result: EuSearchResult): string {
	const url = metadataValue(result.metadata, "url") ?? result.url ?? `${EU_PORTAL_BASE_URL}/screen/opportunities/calls-for-proposals`;
	return url
		.replace("/opportunities/data/topicDetails/", "/opportunities/portal/screen/opportunities/topic-details/")
		.replace(/\/topic-details\/([^/?#]+)\.json\b/i, "/topic-details/$1")
		.replace(/\/topicDetails\/([^/?#]+)\.json\b/i, "/topic-details/$1");
}

function sourceIdFrom(result: EuSearchResult, portalUrl: string): string {
	const metadata = result.metadata;
	const raw = metadataValue(metadata, "identifier")
		?? metadataValue(metadata, "cftId")
		?? metadataValue(metadata, "ccm2Id")
		?? metadataValue(metadata, "callIdentifier")
		?? result.reference
		?? portalUrl.split("/").filter(Boolean).at(-1)
		?? "opportunity";
	return `eu-${cleanText(raw).replace(/\s+/g, "-").slice(0, 120)}`;
}

function opportunityType(result: EuSearchResult): OpportunityData["opportunityType"] {
	const type = metadataValue(result.metadata, "type");
	const haystack = [
		type,
		metadataValue(result.metadata, "title"),
		metadataValue(result.metadata, "callTitle"),
		result.summary,
		result.content,
	].map((value) => value ?? "").join(" ").toLowerCase();
	if (type === "0" || haystack.includes("tender")) return "tender";
	if (haystack.includes("expression of interest")) return "eoi";
	if (haystack.includes("proposal") || haystack.includes("call")) return "grant";
	return "grant";
}

function organizationName(metadata: EuMetadata | undefined): string {
	const leadAuthority = metadataValue(metadata, "cftLeadContractingAuthorityCode");
	if (leadAuthority) {
		try {
			const parsed = JSON.parse(leadAuthority) as Array<{ name?: string; isLeadAuthority?: boolean }>;
			const lead = parsed.find((authority) => authority.isLeadAuthority)?.name ?? parsed[0]?.name;
			if (lead) return cleanText(lead);
		} catch {
			// Fall back to stable portal owner below.
		}
	}
	return "European Commission";
}

function sectorFrom(metadata: EuMetadata | undefined): string | undefined {
	return metadataValue(metadata, "frameworkProgramme")
		?? metadataValue(metadata, "mainCpv")
		?? metadataValue(metadata, "projectAcronym")
		?? undefined;
}

function summaryFrom(result: EuSearchResult): string {
	const metadata = result.metadata;
	const summary = stripHtml(
		metadataValue(metadata, "description")
			?? metadataValue(metadata, "descriptionByte")
			?? metadataValue(metadata, "destinationDetails")
			?? result.summary
			?? result.content
	);
	return summary.slice(0, 1800) || "EU Funding & Tenders opportunity.";
}

function budgetFrom(metadata: EuMetadata | undefined): string | undefined {
	return metadataValue(metadata, "budget")
		?? metadataValue(metadata, "cftEstimatedTotalProcedureValue")
		?? undefined;
}

export function parseEuFundingTendersResponse(
	response: EuSearchResponse,
	sourceUrl = `${EU_PORTAL_BASE_URL}/screen/opportunities/calls-for-proposals`,
	now = new Date()
): OpportunityData[] {
	const seen = new Set<string>();
	return (response.results ?? [])
		.map((result): OpportunityData | undefined => {
			const metadata = result.metadata;
			const deadline = futureDeadline(metadata, now);
			if (!deadline) return undefined;

			const title = cleanText(metadataValue(metadata, "title") ?? result.summary ?? result.content);
			if (!title) return undefined;

			const portalUrl = canonicalPortalUrl(result);
			if (seen.has(portalUrl)) return undefined;
			seen.add(portalUrl);

			const sourceId = sourceIdFrom(result, portalUrl);
			const type = opportunityType(result);
			const budgetValue = budgetFrom(metadata);

			return {
				title,
				source: "eu_funding_tenders",
				sourceId,
				noticeId: sourceId.replace(/^eu-/, ""),
				organization: organizationName(metadata),
				countryRegion: metadataValue(metadata, "geographicalZones") ?? metadataValue(metadata, "geographicalZone"),
				sector: sectorFrom(metadata),
				category: metadataValue(metadata, "callTitle") ?? metadataValue(metadata, "caName") ?? "EU Funding & Tenders opportunity",
				opportunityType: type,
				publishedDate: parseEuDate(metadataValue(metadata, "startDate") ?? metadataValue(metadata, "es_SortDate")),
				deadline,
				portalUrl,
				documentUrl: portalUrl,
				rfpLink: portalUrl,
				budgetValue,
				projectSummary: summaryFrom(result),
				submissionMethod: "Review and submit through the EU Funding & Tenders Portal.",
				tags: ["eu-funding-tenders", type === "tender" ? "eu-tender" : "eu-grant", "source-scrape"],
				metadata: {
					euFundingTenders: {
						sourcePage: sourceUrl,
						searchQuery: queryFromSourceUrl(sourceUrl),
						reference: result.reference,
						totalResults: response.totalResults,
						score: result.score,
						status: metadataValue(metadata, "status"),
						sortStatus: metadataValue(metadata, "sortStatus"),
						type: metadataValue(metadata, "type"),
						callIdentifier: metadataValue(metadata, "callIdentifier"),
						cftId: metadataValue(metadata, "cftId"),
						ccm2Id: metadataValue(metadata, "ccm2Id"),
					},
				},
			};
		})
		.filter((opportunity): opportunity is OpportunityData => Boolean(opportunity));
}

async function fetchEuFundingTenders(sourceUrl: string): Promise<EuSearchResponse> {
	const response = await fetch(euFundingTendersSearchApiUrl(sourceUrl), {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: "{}",
	});
	if (!response.ok) {
		throw new Error(`EU Funding & Tenders search endpoint returned HTTP ${response.status}`);
	}
	return await response.json() as EuSearchResponse;
}

export const euFundingTendersParser: TenderParser = {
	sourceId: "eu_funding_tenders",
	name: "EU Funding & Tenders Portal",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			const response = await fetchEuFundingTenders(input.url);
			return {
				opportunities: parseEuFundingTendersResponse(response, input.url),
			};
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch EU Funding & Tenders opportunities",
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

registerParser(euFundingTendersParser);
