import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const EBRD_BASE_URL = "https://www.ebrd.com";
const EBRD_FILTER_ENDPOINT = `${EBRD_BASE_URL}/bin/ebrd_dxp/filterlistservlet`;
const EBRD_NOTICES_PARENT_PATH = "/content/ebrd_dxp/uk/en/home/work-with-us/project-procurement/procurement-notices";
const EBRD_NOTICES_PAGE_URL = `${EBRD_BASE_URL}/home/work-with-us/project-procurement/procurement-notices.html`;

type EbrdSearchResult = {
	pagePath?: string;
	title?: string;
	projectUrl?: string;
	projectCountry?: string;
	projectSector?: string;
	projectContractType?: string;
	projectNoticeType?: string;
	projectIssueDate?: string;
	projectCloseDate?: string;
	projectDescription?: string;
	projectLinks?: string;
};

type EbrdFilterResponse = {
	resultCount?: Array<{
		resultCount?: number;
		cardType?: string;
	}>;
	searchResult?: EbrdSearchResult[];
};

export function parseEbrdDate(value: string | undefined): Date | undefined {
	const cleaned = cleanText(value);
	if (!cleaned) return undefined;
	const timestamp = Date.parse(cleaned);
	return Number.isNaN(timestamp) ? undefined : new Date(timestamp);
}

function publishedUrlFromPath(pagePath: string | undefined): string | undefined {
	if (!pagePath) return undefined;
	const normalized = pagePath
		.replace(/^\/content\/ebrd_dxp\/uk\/en/, "")
		.replace(/^\/content\/ebrd_dxp/, "");
	if (!normalized || normalized === pagePath) return undefined;
	return `${EBRD_BASE_URL}${normalized}`;
}

function noticeIdFrom(result: EbrdSearchResult): string {
	const title = cleanText(result.title);
	const explicit = title.match(/\b\d{4,5}-[A-Z]{2,5}-\d{4,6}\b/)?.[0];
	if (explicit) return explicit;
	const pageSlug = result.pagePath?.split("/").pop()?.replace(/\.html$/i, "");
	return pageSlug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

function opportunityTypeFrom(noticeType: string | undefined, title: string): OpportunityData["opportunityType"] {
	const haystack = `${noticeType ?? ""} ${title}`.toLowerCase();
	if (/expressions? of interest/.test(haystack)) return "eoi";
	if (haystack.includes("proposal")) return "rfp";
	return "tender";
}

function summaryFor(result: EbrdSearchResult): string {
	const parts = [
		result.projectDescription,
		result.projectCountry ? `Country: ${result.projectCountry}` : undefined,
		result.projectSector ? `Sector: ${result.projectSector}` : undefined,
		result.projectContractType ? `Contract type: ${result.projectContractType}` : undefined,
		result.projectNoticeType ? `Notice type: ${result.projectNoticeType}` : undefined,
		result.projectIssueDate ? `Issue date: ${result.projectIssueDate}` : undefined,
		result.projectCloseDate ? `Closing date: ${result.projectCloseDate}` : undefined,
	];
	return parts.map(cleanText).filter(Boolean).join(". ");
}

export function parseEbrdNoticeApiResponse(response: EbrdFilterResponse): OpportunityData[] {
	return (response.searchResult ?? [])
		.map((result): OpportunityData | undefined => {
			const title = cleanText(result.title);
			if (!title) return undefined;
			const noticeId = noticeIdFrom(result);
			const portalUrl = result.projectUrl || publishedUrlFromPath(result.pagePath) || EBRD_NOTICES_PAGE_URL;
			const noticeType = cleanText(result.projectNoticeType || result.projectContractType);

			return {
				title,
				source: "ebrd",
				sourceId: `ebrd-${noticeId}`,
				noticeId,
				organization: "European Bank for Reconstruction and Development",
				countryRegion: cleanText(result.projectCountry) || undefined,
				sector: cleanText(result.projectSector) || undefined,
				category: noticeType || "EBRD procurement notice",
				opportunityType: opportunityTypeFrom(noticeType, title),
				publishedDate: parseEbrdDate(result.projectIssueDate),
				deadline: parseEbrdDate(result.projectCloseDate),
				portalUrl,
				documentUrl: portalUrl,
				rfpLink: portalUrl,
				projectSummary: summaryFor(result) || "EBRD project procurement notice.",
				submissionMethod: "Review the EBRD procurement notice and ECEPP instructions before responding.",
				tags: ["ebrd", "development-bank", "global-procurement", "source-scrape"],
				metadata: {
					ebrd: {
						sourcePage: EBRD_NOTICES_PAGE_URL,
						pagePath: result.pagePath,
						contractType: result.projectContractType,
						noticeType: result.projectNoticeType,
						issueDate: result.projectIssueDate,
						closeDate: result.projectCloseDate,
						resultCount: response.resultCount?.[0]?.resultCount,
					},
				},
			};
		})
		.filter((opportunity): opportunity is OpportunityData => Boolean(opportunity));
}

function searchConfigFrom(input: ParseInput): { parentPath: string; cardType: string } {
	const content = `${input.html ?? ""}\n${input.markdown ?? ""}`;
	const parentPath = content.match(/data-filterPath=["']([^"']+)["']/)?.[1] ?? EBRD_NOTICES_PARENT_PATH;
	const cardType = content.match(/data-cardType=["']([^"']+)["']/)?.[1] ?? "procurement-notices";
	return { parentPath, cardType };
}

async function fetchEbrdNotices(input: ParseInput): Promise<EbrdFilterResponse> {
	const config = searchConfigFrom(input);
	const body = new URLSearchParams({
		parentPath: config.parentPath,
		cardType: config.cardType,
		searchKey: "",
		currentPage: "1",
		eventSort: "",
		sortBy: "newest-first",
		filters: "",
		countryFilters: "",
		sectorFilters: "",
		topicFilters: "",
		statusFilters: "",
		noticeTypeFilters: "",
		pageTypeFilters: "",
		startDate: "",
		endDate: "",
		IsLoggedIn: "false",
		isAlumni: "false",
		isBeeps: "false",
	});

	const response = await fetch(EBRD_FILTER_ENDPOINT, {
		method: "POST",
		headers: {
			"content-type": "application/x-www-form-urlencoded;charset=UTF-8",
		},
		body,
	});
	if (!response.ok) {
		throw new Error(`EBRD filter endpoint returned HTTP ${response.status}`);
	}
	return await response.json() as EbrdFilterResponse;
}

export const ebrdParser: TenderParser = {
	sourceId: "ebrd",
	name: "EBRD Procurement Notices",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			const response = await fetchEbrdNotices(input);
			return {
				opportunities: parseEbrdNoticeApiResponse(response),
			};
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch EBRD procurement notices",
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

registerParser(ebrdParser);
