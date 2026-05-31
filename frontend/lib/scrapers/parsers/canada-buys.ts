import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const CANADA_BUYS_BASE_URL = "https://canadabuys.canada.ca";
export const CANADA_BUYS_OPEN_TENDERS_URL =
	`${CANADA_BUYS_BASE_URL}/en/tender-opportunities?status%5B0%5D=87&items_per_page=50`;
const DEFAULT_MAX_PAGES = 1;
const DEFAULT_DETAIL_LIMIT = 50;
const DETAIL_BATCH_SIZE = 5;
const DOCUMENT_URL_PATTERN = /\.(?:pdf|docx?|xlsx?|zip)(?:[?#].*)?$/i;

type CanadaBuysListingOpportunity = OpportunityData & {
	portalUrl: string;
};

type CanadaBuysDetail = {
	solicitationNumber?: string;
	publishedDate?: Date;
	deadline?: Date;
	description?: string;
	contractingOrganization?: string;
	documentLinks: Array<{ url: string; label?: string }>;
	submissionMethod?: string;
	procurementMethod?: string;
	selectionMethod?: string;
	unspsc?: string[];
};

function maxPages(): number {
	const parsed = Number(process.env.CANADABUYS_MAX_PAGES ?? DEFAULT_MAX_PAGES);
	if (!Number.isFinite(parsed)) return DEFAULT_MAX_PAGES;
	return Math.min(5, Math.max(1, Math.trunc(parsed)));
}

function detailLimit(): number {
	const parsed = Number(process.env.CANADABUYS_DETAIL_LIMIT ?? DEFAULT_DETAIL_LIMIT);
	if (!Number.isFinite(parsed)) return DEFAULT_DETAIL_LIMIT;
	return Math.min(100, Math.max(0, Math.trunc(parsed)));
}

function decodeEntities(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, codepoint: string) => String.fromCodePoint(Number(codepoint)))
		.replace(/&#x([0-9a-f]+);/gi, (_, codepoint: string) => String.fromCodePoint(Number.parseInt(codepoint, 16)))
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, "\"")
		.replace(/&#39;/g, "'")
		.replace(/&apos;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&nbsp;/gi, " ")
		.replace(/&ndash;/gi, "-")
		.replace(/&mdash;/gi, "-")
		.replace(/&rsquo;/gi, "'")
		.replace(/&lsquo;/gi, "'")
		.replace(/&ldquo;/gi, "\"")
		.replace(/&rdquo;/gi, "\"")
		.replace(/&hellip;/gi, "...");
}

function stripHtml(value: string): string {
	return cleanText(decodeEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>|<\/tr>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function absoluteUrl(rawUrl: string | undefined | null, baseUrl = CANADA_BUYS_BASE_URL): string | undefined {
	const cleaned = decodeEntities(rawUrl ?? "").trim();
	if (!cleaned || /^javascript:/i.test(cleaned) || /^mailto:/i.test(cleaned)) return undefined;
	try {
		const parsed = new URL(cleaned, baseUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return undefined;
	}
}

function attrValue(attributes: string, name: string): string | undefined {
	const match = new RegExp(`${name}=["']([^"']+)["']`, "i").exec(attributes);
	return match?.[1] ? decodeEntities(match[1]).trim() : undefined;
}

function parseCanadaDate(value: string | undefined | null): Date | undefined {
	const text = stripHtml(value ?? "");
	if (!text) return undefined;
	const dateTime = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?:\s+([A-Z]{2,4}))?)?/i);
	if (dateTime) {
		const year = Number(dateTime[1]);
		const month = Number(dateTime[2]);
		const day = Number(dateTime[3]);
		const hour = Number(dateTime[4] ?? "12");
		const minute = Number(dateTime[5] ?? "0");
		const zone = (dateTime[6] ?? "UTC").toUpperCase();
		const offsets: Record<string, number> = {
			NST: -3.5, NDT: -2.5, AST: -4, ADT: -3, EST: -5, EDT: -4,
			CST: -6, CDT: -5, MST: -7, MDT: -6, PST: -8, PDT: -7,
		};
		const offset = offsets[zone] ?? 0;
		return new Date(Date.UTC(year, month - 1, day, hour - offset, minute));
	}
	const parsed = Date.parse(text);
	return Number.isNaN(parsed) ? undefined : new Date(parsed);
}

function utcStartOfDay(value: Date): Date {
	return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function isExpired(deadline: Date | undefined, now: Date): boolean {
	return Boolean(deadline && deadline.getTime() < utcStartOfDay(now).getTime());
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 90);
}

function listingUrl(sourceUrl: string, page: number): string {
	const url = new URL(sourceUrl || CANADA_BUYS_OPEN_TENDERS_URL, CANADA_BUYS_OPEN_TENDERS_URL);
	if (!url.pathname.startsWith("/en/tender-opportunities")) {
		url.pathname = "/en/tender-opportunities";
		url.search = "";
	}
	if (!url.searchParams.has("status[0]")) {
		url.searchParams.set("status[0]", "87");
	}
	if (!url.searchParams.has("items_per_page")) {
		url.searchParams.set("items_per_page", "50");
	}
	if (page > 0) {
		url.searchParams.set("page", `,0,${page},0`);
	}
	return url.toString();
}

function cellsFromRow(rowHtml: string): string[] {
	return [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
		.map((match) => match[1] ?? "");
}

function noticeIdFromUrl(url: string): string {
	try {
		const pathname = new URL(url).pathname;
		return decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "");
	} catch {
		return "";
	}
}

function titleAndUrlFromCell(cellHtml: string): { title?: string; url?: string } {
	const link = /<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(cellHtml);
	if (!link) return {};
	const attributes = link[1] ?? "";
	const url = absoluteUrl(attrValue(attributes, "href"));
	const title = cleanText(attrValue(attributes, "title") ?? stripHtml(link[2] ?? ""));
	return { title, url };
}

function opportunityType(title: string): OpportunityData["opportunityType"] {
	const lower = title.toLowerCase();
	if (/\b(request for proposal|rfp|proposal)\b/.test(lower)) return "rfp";
	if (/\b(request for qualification|rfq|pre-qualification|prequalification)\b/.test(lower)) return "eoi";
	return "tender";
}

function opportunityFromRow(rowHtml: string, now: Date): CanadaBuysListingOpportunity | undefined {
	if (!/\/tender-opportunities\/tender-notice\//i.test(rowHtml)) return undefined;
	const cells = cellsFromRow(rowHtml);
	if (cells.length < 5) return undefined;
	const { title, url } = titleAndUrlFromCell(cells[0] ?? "");
	if (!title || !url) return undefined;
	const deadline = parseCanadaDate(cells[3]);
	if (isExpired(deadline, now)) return undefined;
	const category = stripHtml(cells[1] ?? "") || "CanadaBuys tender notice";
	const publishedDate = parseCanadaDate(cells[2]);
	const organization = stripHtml(cells[4] ?? "") || "CanadaBuys";
	const noticeId = noticeIdFromUrl(url);

	return {
		title,
		source: "canada_buys",
		sourceId: `canadabuys-${slugify(noticeId || title)}`,
		noticeId: noticeId || undefined,
		organization,
		countryRegion: "Canada",
		category,
		opportunityType: opportunityType(title),
		publishedDate,
		deadline,
		portalUrl: url,
		documentUrl: url,
		rfpLink: url,
		projectSummary: [
			noticeId ? `Notice ID: ${noticeId}` : undefined,
			category ? `Category: ${category}` : undefined,
			publishedDate ? `Open/amendment date: ${publishedDate.toISOString()}` : undefined,
			deadline ? `Closing date: ${deadline.toISOString()}` : undefined,
		].filter(Boolean).join("; "),
		submissionMethod: "Use the CanadaBuys tender notice page and attached solicitation documents for submission instructions.",
		tags: ["canadabuys", "canada", "public-procurement", "source-documents"],
		metadata: {
			canadaBuys: {
				noticeId,
				category,
				detailUrl: url,
				documentLinks: [{ url, label: title }],
			},
		},
	};
}

export function parseCanadaBuysListingHtml(html: string, now = new Date()): OpportunityData[] {
	const seen = new Set<string>();
	const opportunities: OpportunityData[] = [];
	for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
		const opportunity = opportunityFromRow(row[1] ?? "", now);
		if (!opportunity?.sourceId || seen.has(opportunity.sourceId)) continue;
		seen.add(opportunity.sourceId);
		opportunities.push(opportunity);
	}
	return opportunities;
}

function fieldItem(html: string, fieldName: string): string | undefined {
	const field = new RegExp(`<div\\b[^>]*field--name-${fieldName}\\b[\\s\\S]*?<\\/div>`, "i").exec(html)?.[0];
	if (!field) return undefined;
	const item = /<(?:span|div)\b[^>]*field--item[^>]*>([\s\S]*?)<\/(?:span|div)>/i.exec(field)?.[1];
	return item ? stripHtml(item) : undefined;
}

function closingDateFromDetail(html: string): Date | undefined {
	const match = /<div\b[^>]*class=["'][^"']*\bclosing-date-field\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html);
	if (!match) return undefined;
	const date = stripHtml(/<span\b[^>]*class=["'][^"']*\bdateclass\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(match[1] ?? "")?.[1] ?? "");
	const time = stripHtml(/<span\b[^>]*class=["'][^"']*\btimeclass\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(match[1] ?? "")?.[1] ?? "");
	return parseCanadaDate(`${date} ${time}`.trim());
}

function descriptionFromDetail(html: string): string | undefined {
	const match = /<div\b[^>]*field--name-body\b[^>]*tender-detail-description\b[^>]*>([\s\S]*?)<\/div>/i.exec(html);
	const text = stripHtml(match?.[1] ?? "");
	return text ? text.slice(0, 1800) : undefined;
}

function documentLinksFromDetail(html: string, sourceUrl: string): Array<{ url: string; label?: string }> {
	const table = /<table\b[^>]*class=["'][^"']*\btender-documents-table\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/i.exec(html)?.[1] ?? "";
	const links: Array<{ url: string; label?: string }> = [];
	const seen = new Set<string>();
	for (const link of table.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
		const url = absoluteUrl(attrValue(link[1] ?? "", "href"), sourceUrl);
		if (!url || seen.has(url)) continue;
		if (!DOCUMENT_URL_PATTERN.test(url)) continue;
		seen.add(url);
		const label = stripHtml(link[2] ?? "");
		links.push({ url, ...(label ? { label } : {}) });
	}
	return links;
}

function detailTerms(html: string): { procurementMethod?: string; selectionMethod?: string; unspsc?: string[] } {
	const termLabels = [...html.matchAll(/<div\b[^>]*field--name-field-term-label\b[^>]*>([\s\S]*?)<\/div>/gi)]
		.map((match) => stripHtml(match[1] ?? ""))
		.filter(Boolean);
	const procurementMethod = termLabels.find((label) => /competitive|limited|open bidding/i.test(label));
	const selectionMethod = termLabels.find((label) => /lowest|best value|point rated|selection/i.test(label));
	const unspsc = [...new Set([...html.matchAll(/>\s*(\d{8}\s+[^<]+?)\s*<\/span>/gi)]
		.map((match) => stripHtml(match[1] ?? "").replace(/\s+See a list of notices associated with this UNSPSC$/i, ""))
		.filter(Boolean))];
	return { procurementMethod, selectionMethod, unspsc };
}

export function parseCanadaBuysDetailHtml(html: string, sourceUrl: string): CanadaBuysDetail {
	const publishedDate = parseCanadaDate(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i.exec(html)?.[1]);
	const documentLinks = documentLinksFromDetail(html, sourceUrl);
	const terms = detailTerms(html);
	return {
		solicitationNumber: fieldItem(html, "field-tender-solicitation-number"),
		publishedDate,
		deadline: closingDateFromDetail(html),
		description: descriptionFromDetail(html),
		contractingOrganization: fieldItem(html, "field-tender-contact-orgname"),
		documentLinks,
		submissionMethod: stripHtml(/Tenders must be submitted[\s\S]{0,300}?<\/p>/i.exec(html)?.[0] ?? "") || undefined,
		...terms,
	};
}

function mergeDetail(opportunity: OpportunityData, detail: CanadaBuysDetail | undefined): OpportunityData {
	if (!detail) return opportunity;
	const documentLinks = detail.documentLinks.length > 0
		? detail.documentLinks
		: [{ url: opportunity.portalUrl ?? opportunity.rfpLink ?? "", label: opportunity.title }].filter((link) => link.url);
	const primaryDocument = detail.documentLinks[0]?.url ?? opportunity.documentUrl;
	const solicitationNumber = cleanText(detail.solicitationNumber);
	const metadata = {
		...(opportunity.metadata?.canadaBuys as Record<string, unknown> | undefined),
		solicitationNumber,
		procurementMethod: detail.procurementMethod,
		selectionMethod: detail.selectionMethod,
		unspsc: detail.unspsc,
		documentLinks,
	};

	return {
		...opportunity,
		sourceId: solicitationNumber ? `canadabuys-${slugify(solicitationNumber)}` : opportunity.sourceId,
		noticeId: solicitationNumber || opportunity.noticeId,
		organization: detail.contractingOrganization || opportunity.organization,
		publishedDate: detail.publishedDate ?? opportunity.publishedDate,
		deadline: detail.deadline ?? opportunity.deadline,
		documentUrl: primaryDocument,
		rfpLink: primaryDocument ?? opportunity.rfpLink,
		projectSummary: [
			solicitationNumber ? `Solicitation number: ${solicitationNumber}` : undefined,
			detail.description,
			detail.procurementMethod ? `Procurement method: ${detail.procurementMethod}` : undefined,
			detail.selectionMethod ? `Selection method: ${detail.selectionMethod}` : undefined,
			detail.documentLinks.length > 0 ? `${detail.documentLinks.length} tender document(s) found.` : undefined,
		].filter(Boolean).join("; ") || opportunity.projectSummary,
		submissionMethod: detail.submissionMethod ?? opportunity.submissionMethod,
		metadata: {
			...opportunity.metadata,
			canadaBuys: metadata,
		},
	};
}

async function fetchText(url: string): Promise<string> {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(20000),
		headers: {
			Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.9",
			"User-Agent": "Mozilla/5.0 (compatible; LindelaOpportunityDiscovery/1.0; +https://lindela.io)",
		},
	});
	if (!response.ok) {
		throw new Error(`CanadaBuys fetch failed: ${response.status} ${response.statusText}`);
	}
	return response.text();
}

async function enrichWithDetails(opportunities: OpportunityData[]): Promise<OpportunityData[]> {
	const limit = detailLimit();
	if (limit <= 0) return opportunities;
	const enriched = [...opportunities];
	for (let index = 0; index < Math.min(limit, opportunities.length); index += DETAIL_BATCH_SIZE) {
		const batch = opportunities.slice(index, index + DETAIL_BATCH_SIZE);
		const details = await Promise.all(batch.map(async (opportunity) => {
			if (!opportunity.portalUrl) return undefined;
			try {
				return parseCanadaBuysDetailHtml(await fetchText(opportunity.portalUrl), opportunity.portalUrl);
			} catch {
				return undefined;
			}
		}));
		for (let offset = 0; offset < batch.length; offset += 1) {
			enriched[index + offset] = mergeDetail(batch[offset]!, details[offset]);
		}
	}
	return enriched;
}

async function fetchCanadaBuysOpportunities(sourceUrl: string): Promise<OpportunityData[]> {
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();
	for (let page = 0; page < maxPages(); page += 1) {
		const pageOpportunities = parseCanadaBuysListingHtml(await fetchText(listingUrl(sourceUrl, page)));
		for (const opportunity of pageOpportunities) {
			if (!opportunity.sourceId || seen.has(opportunity.sourceId)) continue;
			seen.add(opportunity.sourceId);
			opportunities.push(opportunity);
		}
		if (pageOpportunities.length === 0) break;
	}
	return enrichWithDetails(opportunities);
}

export const canadaBuysParser: TenderParser = {
	sourceId: "canada_buys",
	name: "CanadaBuys Open Tender Notices",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			if (input.html) {
				return { opportunities: parseCanadaBuysListingHtml(input.html) };
			}
			return { opportunities: await fetchCanadaBuysOpportunities(input.url) };
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch CanadaBuys opportunities",
			};
		}
	},

	getPageUrl(baseUrl: string, page: number): string {
		return listingUrl(baseUrl, page - 1);
	},

	hasNextPage(input: ParseInput): boolean {
		return /\brel=["']next["']/i.test(input.html ?? "");
	},
};

registerParser(canadaBuysParser);

export default canadaBuysParser;
