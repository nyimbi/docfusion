import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const SAM_SEARCH_API_URL = "https://sam.gov/api/prod/sgs/v1/search/";
const SAM_DEFAULT_QUERY = "\"request for proposal\"";
const SAM_DEFAULT_PAGE_SIZE = 10;

type SamGovValue = {
	code?: string | null;
	value?: string | null;
};

type SamGovDescription = {
	content?: string;
};

type SamGovOrganization = {
	name?: string;
	type?: string;
	level?: number;
};

type SamGovPlace = {
	country?: string | null;
	state?: string | null;
	city?: string | null;
};

type SamGovContact = {
	fullName?: string | null;
	email?: string | null;
	type?: string | null;
};

type SamGovResult = {
	_id?: string;
	parentNoticeId?: string;
	solicitationNumber?: string;
	cleanSolicitationNumber?: string;
	title?: string;
	type?: SamGovValue;
	isActive?: boolean;
	isCanceled?: boolean;
	publishDate?: string;
	modifiedDate?: string;
	responseDate?: string;
	responseDateActual?: string;
	archiveDate?: string;
	descriptions?: SamGovDescription[];
	organizationHierarchy?: SamGovOrganization[];
	placeOfPerformance?: SamGovPlace[];
	pointOfContacts?: SamGovContact[];
	naics?: SamGovValue[];
	psc?: SamGovValue[];
	_rScore?: number;
};

type SamGovSearchResponse = {
	_embedded?: {
		results?: SamGovResult[];
	};
	page?: {
		totalElements?: number;
	};
};

function stripHtml(value: string | undefined): string {
	return cleanText((value ?? "")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, "\"")
		.replace(/&#39;/g, "'"));
}

function parseSamDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	const timestamp = Date.parse(value);
	return Number.isNaN(timestamp) ? undefined : new Date(timestamp);
}

function queryFromSourceUrl(sourceUrl: string): string {
	try {
		const url = new URL(sourceUrl);
		return url.searchParams.get("keywords")
			?? url.searchParams.get("q")
			?? url.searchParams.get("query")
			?? SAM_DEFAULT_QUERY;
	} catch {
		return SAM_DEFAULT_QUERY;
	}
}

export function samGovSearchApiUrl(sourceUrl: string, size = SAM_DEFAULT_PAGE_SIZE): string {
	const apiUrl = new URL(SAM_SEARCH_API_URL);
	apiUrl.searchParams.set("index", "opp");
	apiUrl.searchParams.set("size", String(size));
	apiUrl.searchParams.set("page", "0");
	apiUrl.searchParams.set("sort", "-relevance");
	apiUrl.searchParams.set("q", queryFromSourceUrl(sourceUrl));
	apiUrl.searchParams.set("is_active", "true");
	return apiUrl.toString();
}

function organizationName(result: SamGovResult): string {
	const hierarchy = [...(result.organizationHierarchy ?? [])].sort((a, b) => (a.level ?? 99) - (b.level ?? 99));
	return hierarchy.at(-1)?.name || hierarchy[0]?.name || "SAM.gov";
}

function organizationPath(result: SamGovResult): string[] {
	return [...(result.organizationHierarchy ?? [])]
		.sort((a, b) => (a.level ?? 99) - (b.level ?? 99))
		.map((org) => cleanText(org.name))
		.filter(Boolean);
}

function countryRegion(result: SamGovResult): string | undefined {
	const place = result.placeOfPerformance?.[0];
	return cleanText([place?.country, place?.state, place?.city].filter(Boolean).join(" / ")) || undefined;
}

function opportunityType(result: SamGovResult, summary: string): OpportunityData["opportunityType"] {
	const haystack = `${result.title ?? ""} ${result.type?.value ?? ""} ${summary}`.toLowerCase();
	if (/\b(eoi|sources sought|request for information|rfi)\b/.test(haystack)) return "eoi";
	if (/\b(rfp|request for proposal|draft request for proposal)\b/.test(haystack)) return "rfp";
	return "tender";
}

function primaryContact(result: SamGovResult): SamGovContact | undefined {
	return result.pointOfContacts?.find((contact) => contact.type?.toLowerCase() === "primary")
		?? result.pointOfContacts?.[0];
}

function portalUrl(result: SamGovResult): string {
	const id = result._id || result.parentNoticeId || result.solicitationNumber || result.cleanSolicitationNumber;
	return id ? `https://sam.gov/opp/${encodeURIComponent(id)}/view` : "https://sam.gov/search/?index=opp";
}

export function parseSamGovSearchResponse(response: SamGovSearchResponse, sourceUrl = "https://sam.gov/search/?index=opp"): OpportunityData[] {
	const total = response.page?.totalElements;
	return (response._embedded?.results ?? [])
		.filter((result) => result.isActive !== false && result.isCanceled !== true)
		.map((result): OpportunityData | undefined => {
			const title = cleanText(result.title);
			if (!title) return undefined;
			const summary = stripHtml(result.descriptions?.[0]?.content).slice(0, 1800);
			const url = portalUrl(result);
			const noticeId = result.solicitationNumber || result.cleanSolicitationNumber || result._id || result.parentNoticeId;
			if (!noticeId) return undefined;
			const contact = primaryContact(result);

			return {
				title,
				source: "sam_gov",
				sourceId: `sam-${noticeId}`,
				noticeId,
				organization: organizationName(result),
				countryRegion: countryRegion(result),
				sector: result.naics?.[0]?.value || result.psc?.[0]?.value || undefined,
				category: result.type?.value || "SAM.gov opportunity",
				opportunityType: opportunityType(result, summary),
				publishedDate: parseSamDate(result.publishDate),
				deadline: parseSamDate(result.responseDateActual ?? result.responseDate),
				portalUrl: url,
				documentUrl: url,
				rfpLink: url,
				projectSummary: summary || "SAM.gov contract opportunity.",
				submissionMethod: contact?.email ? `Respond according to SAM.gov notice instructions; primary contact ${contact.email}.` : undefined,
				tags: ["sam-gov", "us-federal", "source-scrape"],
				metadata: {
					samGov: {
						sourcePage: sourceUrl,
						searchQuery: queryFromSourceUrl(sourceUrl),
						typeCode: result.type?.code,
						type: result.type?.value,
						modifiedDate: result.modifiedDate,
						archiveDate: result.archiveDate,
						relevanceScore: result._rScore,
						totalResults: total,
						organizationPath: organizationPath(result),
						contacts: result.pointOfContacts,
					},
				},
			};
		})
		.filter((opportunity): opportunity is OpportunityData => Boolean(opportunity));
}

async function fetchSamGovOpportunities(sourceUrl: string): Promise<SamGovSearchResponse> {
	const response = await fetch(samGovSearchApiUrl(sourceUrl));
	if (!response.ok) {
		throw new Error(`SAM.gov search endpoint returned HTTP ${response.status}`);
	}
	return await response.json() as SamGovSearchResponse;
}

export const samGovParser: TenderParser = {
	sourceId: "sam_gov",
	name: "SAM.gov Contract Opportunities",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			const response = await fetchSamGovOpportunities(input.url);
			return {
				opportunities: parseSamGovSearchResponse(response, input.url),
			};
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch SAM.gov opportunities",
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

registerParser(samGovParser);
