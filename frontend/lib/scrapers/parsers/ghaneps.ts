import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const GHANEPS_BASE_URL = "https://www.ghaneps.gov.gh";
export const GHANEPS_CURRENT_TENDERS_URL = `${GHANEPS_BASE_URL}/epps/quickSearchAction.do?searchSelect=6`;
const DEFAULT_MAX_PAGES = 3;

function decodeEntities(value: string): string {
	return value
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, "\"")
		.replace(/&#39;/g, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">");
}

function stripHtml(value: string): string {
	return cleanText(decodeEntities(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ")));
}

function tableRows(html: string): string[] {
	return [...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
}

function rowCells(rowHtml: string): string[] {
	return [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1] ?? "");
}

function absoluteGhanepsUrl(rawUrl: string | undefined): string | undefined {
	const cleaned = decodeEntities(rawUrl ?? "").trim();
	if (!cleaned) return undefined;
	try {
		return new URL(cleaned, GHANEPS_BASE_URL).toString();
	} catch {
		return undefined;
	}
}

function titleLink(cell: string): { title: string; portalUrl?: string; resourceId?: string } | undefined {
	const match = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(cell);
	if (!match) return undefined;
	const portalUrl = absoluteGhanepsUrl(match[1]);
	const title = stripHtml(match[2] ?? "");
	if (!title) return undefined;
	return {
		title,
		portalUrl,
		resourceId: portalUrl ? new URL(portalUrl).searchParams.get("resourceId") ?? undefined : undefined,
	};
}

function noticePdfUrl(cell: string): string | undefined {
	const match = /<a\b[^>]*href=["']([^"']*downloadNoticeForAdvSearch\.do[^"']*)["']/i.exec(cell);
	return absoluteGhanepsUrl(match?.[1]);
}

function parseGhanepsDate(value: string): Date | undefined {
	const cleaned = cleanText(value);
	if (!cleaned) return undefined;
	const parsed = Date.parse(cleaned);
	return Number.isNaN(parsed) ? undefined : new Date(parsed);
}

function inferOpportunityType(title: string, procedure: string): OpportunityData["opportunityType"] {
	const haystack = `${title} ${procedure}`.toLowerCase();
	if (/\b(eoi|expression of interest)\b/.test(haystack)) return "eoi";
	if (/\b(rfp|request for proposal|consultancy|consultant)\b/.test(haystack)) return "rfp";
	return "tender";
}

function sourceIdFor(resourceId: string | undefined, title: string, organization: string): string {
	if (resourceId) return `ghaneps-${resourceId}`;
	const slug = `${title}-${organization}`
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 90);
	return `ghaneps-${slug || "tender"}`;
}

function opportunityFromRow(rowHtml: string): OpportunityData | undefined {
	const cells = rowCells(rowHtml);
	if (cells.length < 8) return undefined;
	const linkedTitle = titleLink(cells[1] ?? "");
	if (!linkedTitle) return undefined;

	const organization = stripHtml(cells[2] ?? "");
	const deadlineText = stripHtml(cells[4] ?? "");
	const procedure = stripHtml(cells[5] ?? "");
	const status = stripHtml(cells[6] ?? "");
	const documentUrl = noticePdfUrl(cells[7] ?? "");
	const publishedText = stripHtml(cells[8] ?? "");
	const sourceId = sourceIdFor(linkedTitle.resourceId, linkedTitle.title, organization);

	return {
		title: linkedTitle.title,
		source: "ghaneps",
		sourceId,
		noticeId: linkedTitle.resourceId ?? sourceId,
		organization: organization || "GHANEPS",
		countryRegion: "Ghana",
		category: procedure || "GHANEPS current tender",
		opportunityType: inferOpportunityType(linkedTitle.title, procedure),
		publishedDate: parseGhanepsDate(publishedText),
		deadline: parseGhanepsDate(deadlineText),
		portalUrl: linkedTitle.portalUrl ?? GHANEPS_CURRENT_TENDERS_URL,
		documentUrl,
		rfpLink: documentUrl ?? linkedTitle.portalUrl ?? GHANEPS_CURRENT_TENDERS_URL,
		projectSummary: [
			status ? `Status: ${status}` : undefined,
			procedure ? `Procedure: ${procedure}` : undefined,
			deadlineText ? `Submission deadline: ${deadlineText}` : undefined,
			publishedText ? `Published: ${publishedText}` : undefined,
		].filter(Boolean).join("; "),
		submissionMethod: "Submit through the Ghana Electronic Procurement System.",
		tags: ["ghaneps", "ghana", "national-procurement", "source-api"],
		metadata: {
			ghaneps: {
				resourceId: linkedTitle.resourceId,
				status,
				procedure,
				deadlineText,
				publishedText,
				noticePdfUrl: documentUrl,
			},
		},
	};
}

export function parseGhanepsCurrentTendersHtml(html: string): OpportunityData[] {
	const seen = new Set<string>();
	const opportunities: OpportunityData[] = [];
	for (const row of tableRows(html)) {
		const opportunity = opportunityFromRow(row);
		if (!opportunity?.sourceId || seen.has(opportunity.sourceId)) continue;
		seen.add(opportunity.sourceId);
		opportunities.push(opportunity);
	}
	return opportunities;
}

function maxPages(): number {
	const parsed = Number(process.env.GHANEPS_MAX_PAGES ?? DEFAULT_MAX_PAGES);
	if (!Number.isFinite(parsed)) return DEFAULT_MAX_PAGES;
	return Math.min(10, Math.max(1, Math.trunc(parsed)));
}

function pageUrl(sourceUrl: string, page: number): string {
	const url = new URL(sourceUrl || GHANEPS_CURRENT_TENDERS_URL, GHANEPS_CURRENT_TENDERS_URL);
	url.searchParams.set("searchSelect", "6");
	if (page > 1) {
		url.searchParams.set("d-3680175-p", String(page));
	}
	return url.toString();
}

async function fetchGhanepsPage(sourceUrl: string, page: number): Promise<string> {
	const response = await fetch(pageUrl(sourceUrl, page), {
		signal: AbortSignal.timeout(20000),
		headers: {
			"Accept": "text/html,application/xhtml+xml",
			"User-Agent": "Mozilla/5.0 (compatible; LindelaOpportunityDiscovery/1.0; +https://lindela.io)",
		},
	});
	if (!response.ok) {
		throw new Error(`GHANEPS current tenders fetch failed: ${response.status} ${response.statusText}`);
	}
	return response.text();
}

async function fetchGhanepsCurrentTenders(sourceUrl: string): Promise<OpportunityData[]> {
	const seen = new Set<string>();
	const opportunities: OpportunityData[] = [];
	for (let page = 1; page <= maxPages(); page += 1) {
		const pageOpportunities = parseGhanepsCurrentTendersHtml(await fetchGhanepsPage(sourceUrl, page));
		if (pageOpportunities.length === 0) break;
		for (const opportunity of pageOpportunities) {
			if (!opportunity.sourceId || seen.has(opportunity.sourceId)) continue;
			seen.add(opportunity.sourceId);
			opportunities.push(opportunity);
		}
	}
	return opportunities;
}

export const ghanepsParser: TenderParser = {
	sourceId: "ghaneps",
	name: "Ghana GHANEPS Current Tenders",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			if (input.html || input.markdown) {
				return { opportunities: parseGhanepsCurrentTendersHtml(input.html || input.markdown || "") };
			}
			return { opportunities: await fetchGhanepsCurrentTenders(input.url || GHANEPS_CURRENT_TENDERS_URL) };
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	},

	getPageUrl(baseUrl: string, page: number): string {
		return pageUrl(baseUrl || GHANEPS_CURRENT_TENDERS_URL, page);
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(ghanepsParser);
