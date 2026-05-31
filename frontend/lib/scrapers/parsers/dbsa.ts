import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const DBSA_BASE_URL = "https://www.dbsa.org";
export const DBSA_PROCUREMENT_URL = `${DBSA_BASE_URL}/procurement`;

type DbsaDocumentLink = {
	label?: string;
	url: string;
};

type DbsaMetadata = {
	reference?: string;
	closingDateText?: string;
	publishedDateText?: string;
	documentLinks: DbsaDocumentLink[];
};

type DbsaOpportunity = OpportunityData & {
	portalUrl: string;
	metadata: {
		dbsa: DbsaMetadata;
	};
};

function decodeEntities(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, codepoint: string) => String.fromCodePoint(Number(codepoint)))
		.replace(/&#x([0-9a-f]+);/gi, (_, codepoint: string) => String.fromCodePoint(Number.parseInt(codepoint, 16)))
		.replace(/&nbsp;|&#160;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, "\"")
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&ndash;|&mdash;/gi, "-");
}

function stripHtml(value: string | undefined): string {
	if (!value) return "";
	return cleanText(decodeEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>|<\/span>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function absoluteDbsaUrl(rawUrl: string | undefined): string | undefined {
	const cleaned = decodeEntities(rawUrl ?? "").trim();
	if (!cleaned || /^javascript:/i.test(cleaned) || /^mailto:/i.test(cleaned)) return undefined;
	try {
		const url = new URL(cleaned, DBSA_BASE_URL);
		if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
		url.hash = "";
		return url.toString();
	} catch {
		return undefined;
	}
}

function attrValue(attributes: string | undefined, name: string): string | undefined {
	const match = new RegExp(`${name}=["']([^"']+)["']`, "i").exec(attributes ?? "");
	return match?.[1] ? decodeEntities(match[1]).trim() : undefined;
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 90);
}

function monthNumber(value: string | undefined): number | undefined {
	const months: Record<string, number> = {
		jan: 0, january: 0,
		feb: 1, february: 1,
		mar: 2, march: 2,
		apr: 3, april: 3,
		may: 4,
		jun: 5, june: 5,
		jul: 6, july: 6,
		aug: 7, august: 7,
		sep: 8, sept: 8, september: 8,
		oct: 9, october: 9,
		nov: 10, november: 10,
		dec: 11, december: 11,
	};
	return months[(value ?? "").toLowerCase()];
}

function parseDbsaDate(value: string | undefined, endOfDay = false): Date | undefined {
	const cleaned = stripHtml(value).replace(/\s+/g, " ").trim();
	if (!cleaned) return undefined;
	const match = /\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:\s*(?:@|at)\s*(\d{1,2})[Hh:](\d{2}))?/i.exec(cleaned);
	if (!match) {
		const parsed = new Date(cleaned);
		return Number.isNaN(parsed.getTime()) ? undefined : parsed;
	}
	const month = monthNumber(match[2]);
	if (month === undefined) return undefined;
	const hour = match[4] ? Number(match[4]) : endOfDay ? 23 : 0;
	const minute = match[5] ? Number(match[5]) : endOfDay ? 55 : 0;
	return new Date(Date.UTC(Number(match[3]), month, Number(match[1]), hour - 2, minute));
}

function utcStartOfDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isExpired(deadline: Date | undefined, now = new Date()): boolean {
	return Boolean(deadline && deadline.getTime() < utcStartOfDay(now).getTime());
}

function tableHtml(html: string): string {
	return /<table\b[^>]*class=["'][^"']*\btable\b[^"']*["'][^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i.exec(html)?.[1] ?? "";
}

function cellsFromRow(rowHtml: string): string[] {
	return [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1] ?? "");
}

function documentLinksFromCell(cellHtml: string): DbsaDocumentLink[] {
	const links: DbsaDocumentLink[] = [];
	const seen = new Set<string>();
	for (const match of cellHtml.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
		const url = absoluteDbsaUrl(attrValue(match[1] ?? "", "href"));
		if (!url || seen.has(url)) continue;
		if (!/\.(?:pdf|docx?|xlsx?|zip)(?:$|[?#])/i.test(new URL(url).pathname)) continue;
		seen.add(url);
		links.push({ label: stripHtml(match[2] ?? "") || undefined, url });
	}
	return links;
}

function referenceFrom(text: string): string | undefined {
	return /\b(?:RFP|RFQ|RFI)\s*\d{2,3}(?:-\d{2,3})?\/\d{4}\b/i.exec(text)?.[0]
		?? /\b(?:RFP|RFQ|RFI)\s*\d{2,3}(?:-\d{2,3})?\.\d{4}\b/i.exec(text)?.[0]?.replace(".", "/");
}

function titleFromCell(cellHtml: string): string {
	const beforeFirstBreak = cellHtml.split(/<br\s*\/?>/i)[0] ?? cellHtml;
	return stripHtml(beforeFirstBreak);
}

function inferOpportunityType(reference: string | undefined, title: string): OpportunityData["opportunityType"] {
	const haystack = `${reference ?? ""} ${title}`.toLowerCase();
	if (/\brfi\b|request for information/.test(haystack)) return "eoi";
	if (/\brfq\b|quotation/.test(haystack)) return "tender";
	return "rfp";
}

function opportunityFromRow(cells: string[], now = new Date()): DbsaOpportunity | undefined {
	const [descriptionCell, publishedCell, closingCell] = cells;
	const title = titleFromCell(descriptionCell);
	if (!title || !/\b(?:RFP|RFQ|RFI)\b/i.test(title)) return undefined;
	const reference = referenceFrom(title);
	const publishedDateText = stripHtml(publishedCell);
	const closingDateText = stripHtml(closingCell);
	const deadline = parseDbsaDate(closingDateText, true);
	if (isExpired(deadline, now)) return undefined;
	const publishedDate = parseDbsaDate(publishedDateText);
	const documentLinks = documentLinksFromCell(descriptionCell);
	const primaryDocument = documentLinks.find((link) => /tender volume|tender document|rfp/i.test(`${link.label ?? ""} ${link.url}`))
		?? documentLinks[0];
	const sourceId = `dbsa-${slugify(reference ?? title) || "tender"}`;

	return {
		title,
		source: "dbsa",
		sourceId,
		noticeId: reference ?? sourceId,
		organization: "Development Bank of Southern Africa",
		countryRegion: "South Africa",
		category: "DBSA RFP/RFQ procurement",
		opportunityType: inferOpportunityType(reference, title),
		publishedDate,
		deadline,
		portalUrl: DBSA_PROCUREMENT_URL,
		documentUrl: primaryDocument?.url ?? DBSA_PROCUREMENT_URL,
		rfpLink: primaryDocument?.url ?? DBSA_PROCUREMENT_URL,
		projectSummary: [
			reference ? `Reference: ${reference}` : undefined,
			publishedDateText ? `Date published: ${publishedDateText}` : undefined,
			closingDateText ? `Closing date: ${closingDateText}` : undefined,
			stripHtml(descriptionCell),
			documentLinks.length > 0 ? `${documentLinks.length} linked procurement document(s) found.` : undefined,
		].filter(Boolean).join("; "),
		submissionMethod: "Use the DBSA procurement page and linked tender volume for submission instructions.",
		tags: ["dbsa", "south-africa", "development-bank", "source-documents"],
		metadata: {
			dbsa: {
				reference,
				closingDateText,
				publishedDateText,
				documentLinks,
			},
		},
	};
}

export function parseDbsaProcurementHtml(html: string, now = new Date()): DbsaOpportunity[] {
	const opportunities: DbsaOpportunity[] = [];
	const seen = new Set<string>();
	for (const match of tableHtml(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
		const opportunity = opportunityFromRow(cellsFromRow(match[1] ?? ""), now);
		if (!opportunity || seen.has(opportunity.sourceId ?? opportunity.title)) continue;
		seen.add(opportunity.sourceId ?? opportunity.title);
		opportunities.push(opportunity);
	}
	return opportunities;
}

async function fetchDbsaProcurement(sourceUrl: string): Promise<DbsaOpportunity[]> {
	const response = await fetch(sourceUrl || DBSA_PROCUREMENT_URL, {
		signal: AbortSignal.timeout(30000),
		headers: {
			"Accept": "text/html,application/xhtml+xml",
			"User-Agent": "Mozilla/5.0 (compatible; LindelaOpportunityDiscovery/1.0; +https://lindela.io)",
		},
	});
	if (!response.ok) {
		throw new Error(`DBSA procurement fetch failed: ${response.status} ${response.statusText}`);
	}
	return parseDbsaProcurementHtml(await response.text());
}

export const dbsaParser: TenderParser = {
	sourceId: "dbsa",
	name: "DBSA Open RFQs and Tenders",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		if (!input.html?.trim() && !input.markdown?.trim() && input.url) {
			return { opportunities: await fetchDbsaProcurement(input.url) };
		}
		return { opportunities: parseDbsaProcurementHtml(input.html ?? input.markdown ?? "") };
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || DBSA_PROCUREMENT_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(dbsaParser);
