import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const CDB_BASE_URL = "https://www.caribank.org";
const CDB_PROCUREMENT_URL = `${CDB_BASE_URL}/work-with-us/procurement/procurement-notices`;
const FETCH_PAGE_LIMIT = 3;
const ROW_PATTERN = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const CELL_PATTERN = /<td\b[^>]*headers=["']([^"']+)["'][^>]*>([\s\S]*?)<\/td>/gi;
const LINK_PATTERN = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i;
const TIME_PATTERN = /<time\b[^>]*datetime=["']([^"']+)["'][^>]*>([\s\S]*?)<\/time>/i;

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, "\"")
		.replace(/&#39;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&rsquo;/gi, "'")
		.replace(/&lsquo;/gi, "'")
		.replace(/&rdquo;/gi, "\"")
		.replace(/&ldquo;/gi, "\"")
		.replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value: string | undefined): string {
	return cleanText(decodeHtmlEntities((value ?? "")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/p>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function normalizeCdbUrl(rawUrl: string, baseUrl = CDB_PROCUREMENT_URL): string | undefined {
	try {
		const parsed = new URL(decodeHtmlEntities(rawUrl).trim(), baseUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return undefined;
	}
}

function sourceIdFromUrl(url: string): string {
	const slug = new URL(url).pathname
		.split("/")
		.filter(Boolean)
		.pop()
		?.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 90);
	return `cdb-${slug || "procurement-notice"}`;
}

function extractCells(rowHtml: string): Record<string, string> {
	const cells: Record<string, string> = {};
	for (const match of rowHtml.matchAll(CELL_PATTERN)) {
		cells[match[1]] = match[2] ?? "";
	}
	return cells;
}

function extractDeadline(cellHtml: string | undefined): Date | undefined {
	if (!cellHtml) return undefined;
	const timeMatch = cellHtml.match(TIME_PATTERN);
	return parseDate(timeMatch?.[1] ?? stripHtml(cellHtml));
}

function inferOpportunityType(title: string, category: string | undefined): OpportunityData["opportunityType"] {
	const haystack = `${title} ${category ?? ""}`.toLowerCase();
	if (/\b(consultancy|consultant|advisory|proposal|rfp)\b/.test(haystack)) return "rfp";
	if (/\b(expression of interest|eoi)\b/.test(haystack)) return "eoi";
	return "tender";
}

export function parseCdbProcurementHtml(html: string | undefined, sourceUrl = CDB_PROCUREMENT_URL): OpportunityData[] {
	if (!html) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const match of html.matchAll(ROW_PATTERN)) {
		const rowHtml = match[1] ?? "";
		const cells = extractCells(rowHtml);
		const titleCell = cells["view-field-cdb-role-service-table-column"] ?? cells["view-title-table-column"];
		const linkMatch = titleCell?.match(LINK_PATTERN);
		const portalUrl = linkMatch?.[1] ? normalizeCdbUrl(linkMatch[1], sourceUrl) : undefined;
		const title = stripHtml(linkMatch?.[2]);
		if (!portalUrl || !title || seen.has(portalUrl)) continue;
		seen.add(portalUrl);

		const sector = stripHtml(cells["view-field-sector-tag-table-column"]);
		const country = stripHtml(cells["view-field-cdb-country-tag-table-column"]);
		const noticeType = stripHtml(cells["view-field-cdb-contract-awards-type-table-column"]);
		const deadline = extractDeadline(cells["view-field-date-of-approval-table-column"]);
		const category = noticeType || sector || "CDB procurement";

		opportunities.push({
			title,
			source: "cdb",
			sourceId: sourceIdFromUrl(portalUrl),
			noticeId: sourceIdFromUrl(portalUrl).replace(/^cdb-/, ""),
			organization: "Caribbean Development Bank",
			countryRegion: country || "Caribbean",
			category,
			opportunityType: inferOpportunityType(title, category),
			deadline,
			portalUrl,
			rfpLink: portalUrl,
			documentUrl: portalUrl,
			projectSummary: [
				sector ? `Sector: ${sector}` : undefined,
				country ? `Country: ${country}` : undefined,
				noticeType ? `Type: ${noticeType}` : undefined,
			].filter(Boolean).join("; ") || `${title}.`,
			submissionMethod: "Review the CDB procurement notice for submission requirements and documents.",
			tags: ["cdb", "development-bank", "regional-procurement", "source-scrape"],
			metadata: {
				cdb: {
					sourceUrl,
					sector: sector || null,
					type: noticeType || null,
				},
			},
		});
	}

	return opportunities;
}

async function fetchCdbHtml(url: string): Promise<string> {
	const response = await fetch(url, {
		headers: {
			Accept: "text/html,application/xhtml+xml",
			"User-Agent": "DocFusionRfpSourceCollector/1.0",
		},
	});
	if (!response.ok) {
		throw new Error(`CDB procurement page returned HTTP ${response.status}`);
	}
	return await response.text();
}

async function fetchCdbProcurementPages(sourceUrl: string): Promise<string> {
	const pages: string[] = [];
	for (let page = 1; page <= FETCH_PAGE_LIMIT; page += 1) {
		pages.push(await fetchCdbHtml(cdbParser.getPageUrl(sourceUrl, page)));
	}
	return pages.join("\n");
}

export const cdbParser: TenderParser = {
	sourceId: "cdb",
	name: "Caribbean Development Bank Procurement Notices",
	requiresJavascript: false,
	async parse(content: ParseInput): Promise<ParseResult> {
		try {
			const sourceUrl = content.url || CDB_PROCUREMENT_URL;
			const html = content.html ?? content.markdown ?? await fetchCdbProcurementPages(sourceUrl);
			return {
				opportunities: parseCdbProcurementHtml(html, sourceUrl),
			};
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch CDB procurement notices",
			};
		}
	},
	getPageUrl(baseUrl: string, page: number): string {
		if (page <= 1) return baseUrl;
		const url = new URL(baseUrl, CDB_PROCUREMENT_URL);
		url.searchParams.set("page", String(page - 1));
		return url.toString();
	},
	hasNextPage(content: ParseInput): boolean {
		return /rel=["']next["']|title=["']Go to next page["']/i.test(content.html ?? content.markdown ?? "");
	},
};

registerParser(cdbParser);

export default cdbParser;
