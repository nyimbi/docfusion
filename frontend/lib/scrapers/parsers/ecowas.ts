import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const ECOWAS_BASE_URL = "https://www.ecowas.int";
export const ECOWAS_PROCUREMENT_URL = `${ECOWAS_BASE_URL}/procurement/`;
const DEFAULT_DETAIL_LIMIT = 25;
const ECOWAS_CATEGORY_URLS = [
	ECOWAS_PROCUREMENT_URL,
	`${ECOWAS_BASE_URL}/procurement/procurement_m/goods/`,
	`${ECOWAS_BASE_URL}/procurement/procurement_m/works/`,
	`${ECOWAS_BASE_URL}/procurement/procurement_m/intellectual-services/`,
	`${ECOWAS_BASE_URL}/procurement/procurement_m/physical-services/`,
	`${ECOWAS_BASE_URL}/procurement/procurement_m/general-procurement-notice/`,
	`${ECOWAS_BASE_URL}/procurement/grants_m/grants-notices/`,
] as const;

type EcowasDocumentLink = {
	label?: string;
	url: string;
};

type EcowasListingRow = {
	title: string;
	portalUrl: string;
	deadline?: Date;
	deadlineText?: string;
	sourceUrl: string;
};

type EcowasDetail = {
	title?: string;
	summary?: string;
	documentLinks: EcowasDocumentLink[];
};

type EcowasOpportunity = OpportunityData & {
	portalUrl: string;
	metadata: {
		ecowas: {
			deadlineText?: string;
			sourceUrl: string;
			documentLinks: EcowasDocumentLink[];
		};
	};
};

function decodeEntities(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, codepoint: string) => String.fromCodePoint(Number(codepoint)))
		.replace(/&#x([0-9a-f]+);/gi, (_, codepoint: string) => String.fromCodePoint(Number.parseInt(codepoint, 16)))
		.replace(/&nbsp;|&#160;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, "\"")
		.replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
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
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>|<\/span>|<\/small>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function absoluteEcowasUrl(rawUrl: string | undefined, sourceUrl = ECOWAS_PROCUREMENT_URL): string | undefined {
	const cleaned = decodeEntities(rawUrl ?? "").trim();
	if (!cleaned || /^javascript:/i.test(cleaned) || /^mailto:/i.test(cleaned)) return undefined;
	try {
		const url = new URL(cleaned, sourceUrl);
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

function parseEcowasDate(value: string | undefined): Date | undefined {
	const cleaned = stripHtml(value).replace(/^closing date\s*:?\s*/i, "").replace(/\s+/g, " ").trim();
	if (!cleaned) return undefined;
	const dayMonthYear = /\b(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})\b/i.exec(cleaned);
	const monthDayYear = /\b([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\b/i.exec(cleaned);
	const day = Number(dayMonthYear?.[1] ?? monthDayYear?.[2]);
	const month = monthNumber(dayMonthYear?.[2] ?? monthDayYear?.[1]);
	const year = Number(dayMonthYear?.[3] ?? monthDayYear?.[3]);
	if (month === undefined || !Number.isFinite(day) || !Number.isFinite(year)) {
		const parsed = new Date(cleaned);
		return Number.isNaN(parsed.getTime()) ? undefined : parsed;
	}
	return new Date(Date.UTC(year, month, day, 22, 59));
}

function utcStartOfDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isExpired(deadline: Date | undefined, now = new Date()): boolean {
	return Boolean(deadline && deadline.getTime() < utcStartOfDay(now).getTime());
}

function detailLimit(): number {
	const parsed = Number(process.env.ECOWAS_DETAIL_LIMIT ?? DEFAULT_DETAIL_LIMIT);
	if (!Number.isFinite(parsed)) return DEFAULT_DETAIL_LIMIT;
	return Math.min(75, Math.max(0, Math.trunc(parsed)));
}

function sourceIdFromUrl(portalUrl: string, title: string): string {
	const pathSlug = (() => {
		try {
			return new URL(portalUrl).pathname.split("/").filter(Boolean).pop();
		} catch {
			return undefined;
		}
	})();
	return `ecowas-${slugify(pathSlug ?? title) || "procurement-notice"}`;
}

function inferCategory(title: string): string {
	const normalized = title.toLowerCase();
	if (/general procurement|procurement plan|procurement notice/.test(normalized)) return "General procurement notice";
	if (/consulting services|consultancy|consultant|specialist/.test(normalized)) return "Consultancy";
	if (/invitation\s+(?:for|to)\s+bid|\bbid\b|supply|delivery|works/.test(normalized)) return "Invitation to bid";
	if (/grant/.test(normalized)) return "Grant";
	return "Tender";
}

function inferOpportunityType(category: string): OpportunityData["opportunityType"] {
	if (category === "Consultancy") return "rfp";
	if (category === "Grant") return "grant";
	return "tender";
}

function documentLinksFromDetail(html: string, sourceUrl: string): EcowasDocumentLink[] {
	const downloadsStart = html.search(/<h4\b[^>]*>\s*Downloads\s*<\/h4>/i);
	const field = downloadsStart >= 0
		? html.slice(downloadsStart, html.search(/single-post-navigation|related-posts|sidebar|footer-area/i) >= downloadsStart
			? html.search(/single-post-navigation|related-posts|sidebar|footer-area/i)
			: undefined)
		: html;
	const links: EcowasDocumentLink[] = [];
	const seen = new Set<string>();
	for (const match of field.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
		const url = absoluteEcowasUrl(attrValue(match[1] ?? "", "href"), sourceUrl);
		if (!url || seen.has(url)) continue;
		if (!/\.(?:pdf|docx?|xlsx?|zip)(?:$|[?#])/i.test(new URL(url).pathname)) continue;
		seen.add(url);
		links.push({ label: stripHtml(match[2] ?? "") || undefined, url });
	}
	return links;
}

function summaryFromDetail(html: string): string | undefined {
	const main = /<h3\b[^>]*>[\s\S]*?<\/h3>([\s\S]*?)(?:<h4\b[^>]*>\s*Downloads\s*<\/h4>|single-post-navigation|related-posts|sidebar|footer-area)/i.exec(html)?.[1];
	const summary = stripHtml(main).replace(/\s+/g, " ").trim();
	return summary ? summary.slice(0, 1200) : undefined;
}

export function parseEcowasProcurementListingHtml(html: string, sourceUrl = ECOWAS_PROCUREMENT_URL, now = new Date()): EcowasListingRow[] {
	const rows: EcowasListingRow[] = [];
	const seen = new Set<string>();
	for (const match of html.matchAll(/<a\b([^>]*)>\s*<small>\s*Closing date:\s*([\s\S]*?)<\/small>\s*<h6\b[^>]*>([\s\S]*?)<\/h6>/gi)) {
		const portalUrl = absoluteEcowasUrl(attrValue(match[1] ?? "", "href"), sourceUrl);
		const deadlineText = stripHtml(match[2]);
		const title = stripHtml(match[3]);
		if (!portalUrl || !/\/nwp_events\//i.test(portalUrl) || !title || seen.has(portalUrl)) continue;
		const deadline = parseEcowasDate(deadlineText);
		if (isExpired(deadline, now)) continue;
		seen.add(portalUrl);
		rows.push({ title, portalUrl, deadline, deadlineText, sourceUrl });
	}
	return rows;
}

export function parseEcowasProcurementDetailHtml(html: string, sourceUrl: string): EcowasDetail | undefined {
	const title = stripHtml(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i.exec(html)?.[1]
		?? /<title\b[^>]*>([\s\S]*?)(?:\||<\/title>)/i.exec(html)?.[1]);
	if (!title) return undefined;
	return {
		title,
		summary: summaryFromDetail(html),
		documentLinks: documentLinksFromDetail(html, sourceUrl),
	};
}

function opportunityFromRow(row: EcowasListingRow, detail?: EcowasDetail): EcowasOpportunity {
	const title = detail?.title ?? row.title;
	const category = inferCategory(title);
	const documentLinks = detail?.documentLinks ?? [];
	const primaryDocument = documentLinks.find((link) => /\b(?:request|bid|rfp|tor|terms|invitation)\b/i.test(`${link.label ?? ""} ${link.url}`))
		?? documentLinks[0];
	const sourceId = sourceIdFromUrl(row.portalUrl, title);
	return {
		title,
		source: "ecowas",
		sourceId,
		noticeId: sourceId.replace(/^ecowas-/, ""),
		organization: "ECOWAS Commission",
		countryRegion: "West Africa",
		category,
		opportunityType: inferOpportunityType(category),
		deadline: row.deadline,
		portalUrl: row.portalUrl,
		documentUrl: primaryDocument?.url ?? row.portalUrl,
		rfpLink: primaryDocument?.url ?? row.portalUrl,
		projectSummary: [
			row.deadlineText ? `Closing date: ${row.deadlineText}` : undefined,
			detail?.summary,
			documentLinks.length > 0 ? `${documentLinks.length} linked procurement document(s) found.` : undefined,
		].filter(Boolean).join("; ") || "ECOWAS procurement opportunity.",
		submissionMethod: "Use the ECOWAS procurement notice and linked bidding documents for submission instructions.",
		tags: ["ecowas", "west-africa", "regional-procurement", "source-documents"],
		metadata: {
			ecowas: {
				deadlineText: row.deadlineText,
				sourceUrl: row.sourceUrl,
				documentLinks,
			},
		},
	};
}

async function fetchHtml(url: string): Promise<string> {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(30000),
		headers: {
			"Accept": "text/html,application/xhtml+xml",
			"User-Agent": "Mozilla/5.0 (compatible; LindelaOpportunityDiscovery/1.0; +https://lindela.io)",
		},
	});
	if (!response.ok) {
		throw new Error(`ECOWAS procurement fetch failed: ${response.status} ${response.statusText}`);
	}
	return response.text();
}

function listingUrlsFor(sourceUrl: string): string[] {
	try {
		const url = new URL(sourceUrl || ECOWAS_PROCUREMENT_URL);
		const path = url.pathname.replace(/\/+$/g, "/");
		if (url.hostname.replace(/^www\./, "").toLowerCase() === "ecowas.int" && path === "/procurement/") {
			return [...ECOWAS_CATEGORY_URLS];
		}
		return [url.toString()];
	} catch {
		return [ECOWAS_PROCUREMENT_URL];
	}
}

async function fetchEcowasOpportunities(sourceUrl: string): Promise<EcowasOpportunity[]> {
	const listings = await Promise.all(listingUrlsFor(sourceUrl).map(async (url) => ({
		url,
		html: await fetchHtml(url),
	})));
	const rows: EcowasListingRow[] = [];
	const seen = new Set<string>();
	for (const listing of listings) {
		for (const row of parseEcowasProcurementListingHtml(listing.html, listing.url)) {
			if (seen.has(row.portalUrl)) continue;
			seen.add(row.portalUrl);
			rows.push(row);
		}
	}
	const limit = detailLimit();
	if (limit <= 0 || rows.length === 0) return rows.map((row) => opportunityFromRow(row));
	const details = await Promise.all(rows.slice(0, limit).map(async (row) => {
		try {
			return parseEcowasProcurementDetailHtml(await fetchHtml(row.portalUrl), row.portalUrl);
		} catch {
			return undefined;
		}
	}));
	return rows.map((row, index) => opportunityFromRow(row, details[index]));
}

export const ecowasParser: TenderParser = {
	sourceId: "ecowas",
	name: "ECOWAS Procurement",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		const sourceUrl = input.url || ECOWAS_PROCUREMENT_URL;
		if (!input.html?.trim() && !input.markdown?.trim() && sourceUrl) {
			if (/\/nwp_events\/[^/?#]+/i.test(new URL(sourceUrl).pathname)) {
				const detail = parseEcowasProcurementDetailHtml(await fetchHtml(sourceUrl), sourceUrl);
				return {
					opportunities: detail ? [opportunityFromRow({
						title: detail.title ?? "ECOWAS procurement opportunity",
						portalUrl: sourceUrl,
						sourceUrl,
					}, detail)] : [],
				};
			}
			return { opportunities: await fetchEcowasOpportunities(sourceUrl) };
		}
		const content = input.html ?? input.markdown ?? "";
		if (/\/wp-content\/uploads\/|<h4\b[^>]*>\s*Downloads\s*<\/h4>|\/nwp_events\//i.test(content) && /<h3\b|<title\b/i.test(content)) {
			const detail = parseEcowasProcurementDetailHtml(content, sourceUrl);
			return {
				opportunities: detail ? [opportunityFromRow({
					title: detail.title ?? "ECOWAS procurement opportunity",
					portalUrl: sourceUrl,
					sourceUrl,
				}, detail)] : [],
			};
		}
		return {
			opportunities: parseEcowasProcurementListingHtml(content, sourceUrl).map((row) => opportunityFromRow(row)),
		};
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || ECOWAS_PROCUREMENT_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(ecowasParser);
