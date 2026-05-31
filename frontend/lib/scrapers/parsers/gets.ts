import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const GETS_BASE_URL = "https://www.gets.govt.nz";
export const GETS_CURRENT_TENDERS_URL = `${GETS_BASE_URL}/ExternalIndex.htm?orderBy=date`;
const DEFAULT_MAX_PAGES = 1;
const DEFAULT_DETAIL_LIMIT = 50;
const DETAIL_BATCH_SIZE = 5;
const DOCUMENT_URL_PATTERN = /\.(?:pdf|docx?|xlsx?|zip)(?:[?#].*)?$/i;

type GetsListingOpportunity = OpportunityData & {
	portalUrl: string;
	metadata: {
		newZealandGets: GetsMetadata;
	};
};

type GetsMetadata = {
	rfxId?: string;
	reference?: string;
	tenderType?: string;
	closeDateText?: string;
	detailUrl?: string;
	categories?: string[];
	regions?: string[];
	contact?: string;
	documentLinks: Array<{ url: string; label?: string }>;
};

type GetsDetail = {
	rfxId?: string;
	reference?: string;
	deadline?: Date;
	tenderType?: string;
	categories?: string[];
	regions?: string[];
	contact?: string;
	documentLinks: Array<{ url: string; label?: string }>;
};

function maxPages(): number {
	const parsed = Number(process.env.GETS_MAX_PAGES ?? DEFAULT_MAX_PAGES);
	if (!Number.isFinite(parsed)) return DEFAULT_MAX_PAGES;
	return Math.min(12, Math.max(1, Math.trunc(parsed)));
}

function detailLimit(): number {
	const parsed = Number(process.env.GETS_DETAIL_LIMIT ?? DEFAULT_DETAIL_LIMIT);
	if (!Number.isFinite(parsed)) return DEFAULT_DETAIL_LIMIT;
	return Math.min(150, Math.max(0, Math.trunc(parsed)));
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

function absoluteUrl(rawUrl: string | undefined | null, baseUrl = GETS_BASE_URL): string | undefined {
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

function parseGetsDate(value: string | undefined | null): Date | undefined {
	const text = stripHtml(value ?? "").replace(/^[A-Z][a-z]+,\s+/, "").trim();
	if (!text) return undefined;

	const withOffset = /(\d{1,2}):(\d{2})\s*(AM|PM)\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:[^+-]+)?([+-]\d{2}):?(\d{2})?/i.exec(text);
	if (withOffset) {
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
		const month = months[(withOffset[5] ?? "").toLowerCase()];
		if (month !== undefined) {
			let hour = Number(withOffset[1]);
			const minute = Number(withOffset[2]);
			const ampm = (withOffset[3] ?? "").toUpperCase();
			if (ampm === "PM" && hour < 12) hour += 12;
			if (ampm === "AM" && hour === 12) hour = 0;
			const day = Number(withOffset[4]);
			const year = Number(withOffset[6]);
			const offsetHours = Number(withOffset[7]);
			const offsetMinutes = Number(withOffset[8] ?? "0");
			const offsetSign = offsetHours < 0 ? -1 : 1;
			const offsetTotalMinutes = (Math.abs(offsetHours) * 60 + offsetMinutes) * offsetSign;
			return new Date(Date.UTC(year, month, day, hour, minute) - offsetTotalMinutes * 60_000);
		}
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
	const url = new URL(sourceUrl || GETS_CURRENT_TENDERS_URL, GETS_CURRENT_TENDERS_URL);
	if (!/ExternalIndex\.htm$/i.test(url.pathname)) {
		url.pathname = "/ExternalIndex.htm";
		url.search = "";
	}
	url.searchParams.set("orderBy", "date");
	if (page > 1) {
		url.searchParams.set("page", String(page));
	} else {
		url.searchParams.delete("page");
	}
	return url.toString();
}

function cellsFromRow(rowHtml: string): string[] {
	return [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
		.map((match) => match[1] ?? "");
}

function firstLink(cellHtml: string, baseUrl = GETS_BASE_URL): { text?: string; url?: string } {
	const link = /<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(cellHtml);
	if (!link) return {};
	const url = absoluteUrl(attrValue(link[1] ?? "", "href"), baseUrl);
	const text = stripHtml(link[2] ?? "");
	return { text, url };
}

function textOrNone(cellHtml: string): string | undefined {
	const text = stripHtml(cellHtml);
	if (!text || /^\[(?:none|n\/a)\]$/i.test(text)) return undefined;
	return text;
}

function tenderTypeFromCell(cellHtml: string): string {
	const abbrTitle = attrValue(/<abbr\b([^>]*)>/i.exec(cellHtml)?.[1] ?? "", "title");
	return cleanText(abbrTitle || stripHtml(cellHtml)) || "GETS tender";
}

function opportunityType(tenderType: string, title: string): OpportunityData["opportunityType"] {
	const haystack = `${tenderType} ${title}`.toLowerCase();
	if (/\b(request for proposals?|rfp)\b/.test(haystack)) return "rfp";
	if (/\b(registration of interest|expression of interest|roi|eoi)\b/.test(haystack)) return "eoi";
	return "tender";
}

function splitList(value: string | undefined): string[] | undefined {
	if (!value) return undefined;
	const parts = value
		.split(/\s*(?:\||;|,)\s*/)
		.map((part) => cleanText(part))
		.filter(Boolean);
	return parts.length > 0 ? [...new Set(parts)] : undefined;
}

function opportunityFromRow(rowHtml: string, now: Date): GetsListingOpportunity | undefined {
	const cells = cellsFromRow(rowHtml);
	if (cells.length < 6) return undefined;

	const rfx = firstLink(cells[0] ?? "");
	const titleLink = firstLink(cells[2] ?? "");
	const rfxId = cleanText(rfx.text || /id=["']tender-(\d+)/i.exec(rowHtml)?.[1] || "");
	const detailUrl = titleLink.url || rfx.url;
	const title = cleanText(titleLink.text || stripHtml(cells[2] ?? ""));
	if (!rfxId || !title || !detailUrl) return undefined;

	const reference = textOrNone(cells[1] ?? "");
	const tenderType = tenderTypeFromCell(cells[3] ?? "");
	const closeDateText = stripHtml(cells[4] ?? "");
	const deadline = parseGetsDate(closeDateText);
	if (isExpired(deadline, now)) return undefined;
	const organization = stripHtml(cells[5] ?? "") || "New Zealand GETS";
	const documentLinks = [{ url: detailUrl, label: title }];

	return {
		title,
		source: "new_zealand_gets",
		sourceId: `gets-${slugify(rfxId)}`,
		noticeId: reference || rfxId,
		organization,
		countryRegion: "New Zealand",
		category: tenderType,
		opportunityType: opportunityType(tenderType, title),
		deadline,
		portalUrl: detailUrl,
		documentUrl: detailUrl,
		rfpLink: detailUrl,
		projectSummary: [
			`RFx ID: ${rfxId}`,
			reference ? `Reference: ${reference}` : undefined,
			`Tender type: ${tenderType}`,
			closeDateText ? `Close date: ${closeDateText}` : undefined,
			`Buyer: ${organization}`,
		].filter(Boolean).join("; "),
		submissionMethod: "Use the GETS detail page for submission instructions; supplier login may be required for attached files.",
		tags: ["gets", "new-zealand", "public-procurement", "source-documents"],
		metadata: {
			newZealandGets: {
				rfxId,
				reference,
				tenderType,
				closeDateText,
				detailUrl,
				documentLinks,
			},
		},
	};
}

export function parseGetsListingHtml(html: string, now = new Date()): OpportunityData[] {
	const seen = new Set<string>();
	const opportunities: OpportunityData[] = [];
	for (const row of html.matchAll(/<tr\b[^>]*id=["']tender-\d+["'][^>]*>([\s\S]*?)<\/tr>/gi)) {
		const opportunity = opportunityFromRow(row[0] ?? row[1] ?? "", now);
		if (!opportunity?.sourceId || seen.has(opportunity.sourceId)) continue;
		seen.add(opportunity.sourceId);
		opportunities.push(opportunity);
	}
	return opportunities;
}

function detailFields(html: string): Record<string, string> {
	const fields: Record<string, string> = {};
	for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
		const cells = cellsFromRow(row[1] ?? "");
		if (cells.length < 2) continue;
		const label = stripHtml(cells[0] ?? "").replace(/\s*:$/, "").trim().toLowerCase();
		const value = stripHtml(cells.slice(1).join(" "));
		if (label && value) fields[label] = value;
	}
	return fields;
}

function documentLinksFromDetail(html: string, sourceUrl: string): Array<{ url: string; label?: string }> {
	const links: Array<{ url: string; label?: string }> = [];
	const seen = new Set<string>();
	for (const link of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
		const url = absoluteUrl(attrValue(link[1] ?? "", "href"), sourceUrl);
		if (!url || seen.has(url) || !DOCUMENT_URL_PATTERN.test(url)) continue;
		seen.add(url);
		const label = stripHtml(link[2] ?? "");
		links.push({ url, ...(label ? { label } : {}) });
	}
	return links;
}

export function parseGetsDetailHtml(html: string, sourceUrl: string): GetsDetail {
	const fields = detailFields(html);
	return {
		rfxId: fields["rfx id"],
		reference: fields["reference #"],
		deadline: parseGetsDate(fields["close date"]),
		tenderType: fields["tender type"],
		categories: splitList(fields.categories),
		regions: splitList(fields.regions),
		contact: fields.contact,
		documentLinks: documentLinksFromDetail(html, sourceUrl),
	};
}

function mergeDetail(opportunity: OpportunityData, detail: GetsDetail | undefined): OpportunityData {
	if (!detail) return opportunity;
	const existingMetadata = opportunity.metadata?.newZealandGets as GetsMetadata | undefined;
	const detailUrl = existingMetadata?.detailUrl ?? opportunity.portalUrl ?? opportunity.rfpLink;
	const documentLinks = detail.documentLinks.length > 0
		? detail.documentLinks
		: existingMetadata?.documentLinks ?? [{ url: detailUrl ?? "", label: opportunity.title }].filter((link) => link.url);
	const primaryDocument = detail.documentLinks[0]?.url ?? opportunity.documentUrl;
	const tenderType = detail.tenderType ?? existingMetadata?.tenderType ?? opportunity.category;
	const rfxId = detail.rfxId ?? existingMetadata?.rfxId;
	const reference = detail.reference ?? existingMetadata?.reference;
	const regions = detail.regions ?? existingMetadata?.regions;
	const categories = detail.categories ?? existingMetadata?.categories;

	return {
		...opportunity,
		sourceId: rfxId ? `gets-${slugify(rfxId)}` : opportunity.sourceId,
		noticeId: reference || rfxId || opportunity.noticeId,
		category: tenderType || opportunity.category,
		sector: categories?.join("; ") || opportunity.sector,
		countryRegion: regions && regions.length > 0 ? `New Zealand - ${regions.join("; ")}` : opportunity.countryRegion,
		deadline: detail.deadline ?? opportunity.deadline,
		documentUrl: primaryDocument,
		rfpLink: primaryDocument ?? opportunity.rfpLink,
		projectSummary: [
			rfxId ? `RFx ID: ${rfxId}` : undefined,
			reference ? `Reference: ${reference}` : undefined,
			tenderType ? `Tender type: ${tenderType}` : undefined,
			categories?.length ? `Categories: ${categories.join("; ")}` : undefined,
			regions?.length ? `Regions: ${regions.join("; ")}` : undefined,
			detail.contact ? `Contact: ${detail.contact}` : undefined,
			opportunity.projectSummary,
		].filter(Boolean).join("; ") || opportunity.projectSummary,
		submissionMethod: detail.contact || opportunity.submissionMethod,
		metadata: {
			...opportunity.metadata,
			newZealandGets: {
				...existingMetadata,
				rfxId,
				reference,
				tenderType,
				categories,
				regions,
				contact: detail.contact,
				detailUrl,
				documentLinks,
			},
		},
	};
}

async function fetchText(url: string): Promise<string> {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(20000),
		headers: {
			Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "en-NZ,en;q=0.9",
			"User-Agent": "Mozilla/5.0 (compatible; LindelaOpportunityDiscovery/1.0; +https://lindela.io)",
		},
	});
	if (!response.ok) {
		throw new Error(`GETS fetch failed: ${response.status} ${response.statusText}`);
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
				return parseGetsDetailHtml(await fetchText(opportunity.portalUrl), opportunity.portalUrl);
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

async function fetchGetsOpportunities(sourceUrl: string): Promise<OpportunityData[]> {
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();
	for (let page = 1; page <= maxPages(); page += 1) {
		const pageOpportunities = parseGetsListingHtml(await fetchText(listingUrl(sourceUrl, page)));
		for (const opportunity of pageOpportunities) {
			if (!opportunity.sourceId || seen.has(opportunity.sourceId)) continue;
			seen.add(opportunity.sourceId);
			opportunities.push(opportunity);
		}
		if (pageOpportunities.length === 0) break;
	}
	return enrichWithDetails(opportunities);
}

export const getsParser: TenderParser = {
	sourceId: "new_zealand_gets",
	name: "New Zealand GETS Current Tenders",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			if (input.html) {
				return { opportunities: parseGetsListingHtml(input.html) };
			}
			return { opportunities: await fetchGetsOpportunities(input.url) };
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch GETS opportunities",
			};
		}
	},

	getPageUrl(baseUrl: string, page: number): string {
		return listingUrl(baseUrl, page);
	},

	hasNextPage(input: ParseInput): boolean {
		return /ExternalIndex\.htm\?page=\d+&amp;orderBy=date|ExternalIndex\.htm\?page=\d+&orderBy=date/i.test(input.html ?? "");
	},
};

registerParser(getsParser);

export default getsParser;
