import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

export const BADEA_PROCUREMENT_URL = "https://www.badea.org/fr/procurement-notice-fr/";
const DEFAULT_PAGE_LIMIT = 4;

type BadeaDocumentLink = {
	label?: string;
	url: string;
};

type BadeaOpportunity = OpportunityData & {
	portalUrl: string;
	metadata: {
		badea: {
			sourceUrl: string;
			publishedMonth?: string;
			documentLinks: BadeaDocumentLink[];
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
		.replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi, "-")
		.replace(/&laquo;|&raquo;/gi, "\"");
}

function stripHtml(value: string | undefined): string {
	if (!value) return "";
	return cleanText(decodeEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>|<\/span>|<\/a>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function absoluteBadeaUrl(rawUrl: string | undefined, sourceUrl = BADEA_PROCUREMENT_URL): string | undefined {
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
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 100);
}

function isDocumentUrl(url: string): boolean {
	try {
		return /\.pdf(?:$|[?#])/i.test(new URL(url).pathname);
	} catch {
		return /\.pdf(?:$|[?#])/i.test(url);
	}
}

function basenameFromUrl(url: string): string {
	try {
		const pathname = new URL(url).pathname;
		const basename = pathname.split("/").filter(Boolean).pop() ?? "";
		return decodeURIComponent(basename.replace(/\+/g, " "));
	} catch {
		return url.split("/").filter(Boolean).pop() ?? url;
	}
}

function fallbackTitleFromUrl(url: string): string {
	return stripHtml(basenameFromUrl(url)
		.replace(/\.[a-z0-9]+$/i, "")
		.replace(/[-_]+/g, " "));
}

function isBadHeading(title: string): boolean {
	const normalized = title
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
	return !normalized
		|| normalized.length < 8
		|| /^(avis de marches|procurement notice|download|telecharger|francais|english|arabic|home|accueil)$/.test(normalized)
		|| /^a propos de badea/.test(normalized)
		|| /^(about|news|events|contact|search)$/.test(normalized);
}

function titleNearLink(html: string, linkIndex: number, documentUrl: string): string {
	const chunk = html.slice(Math.max(0, linkIndex - 3500), linkIndex);
	const headings = [...chunk.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
		.map((match) => stripHtml(match[1]))
		.filter((title) => !isBadHeading(title));
	return headings.at(-1) ?? fallbackTitleFromUrl(documentUrl);
}

function publishedMonthFromUrl(documentUrl: string): string | undefined {
	try {
		const match = /\/uploads\/(\d{4})\/(\d{2})\//.exec(new URL(documentUrl).pathname);
		return match ? `${match[1]}-${match[2]}` : undefined;
	} catch {
		return undefined;
	}
}

function publishedDateFromMonth(month: string | undefined): Date | undefined {
	if (!month) return undefined;
	const match = /^(\d{4})-(\d{2})$/.exec(month);
	if (!match) return undefined;
	return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

function inferOpportunityType(title: string, documentUrl: string): OpportunityData["opportunityType"] {
	const haystack = `${title} ${basenameFromUrl(documentUrl)}`
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
	if (/\b(eoi|ami)\b|expression of interest|manifestation d.?interet|consultant|consultancy|demande de propositions|request for proposals|\brfp\b/.test(haystack)) {
		return "eoi";
	}
	return "tender";
}

function inferCategory(title: string, documentUrl: string): string {
	const haystack = `${title} ${basenameFromUrl(documentUrl)}`
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
	if (/plan de passation|\bagpm\b|general procurement notice/.test(haystack)) return "General procurement notice";
	if (/\b(eoi|ami)\b|expression of interest|manifestation d.?interet|consultant|consultancy/.test(haystack)) return "Expression of interest";
	if (/demande de propositions|request for proposals|\brfp\b/.test(haystack)) return "Request for proposal";
	return "Tender notice";
}

function inferCountryRegion(title: string, documentUrl: string): string {
	const haystack = `${title} ${basenameFromUrl(documentUrl)}`
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
	const countries: Array<[RegExp, string]> = [
		[/\bbenin\b/, "Benin"],
		[/burkina\s+faso|fada|dori/, "Burkina Faso"],
		[/\bcote\s+d.?ivoire\b|\babobo\b|\bivoire\b/, "Cote d'Ivoire"],
		[/\bguinee[-\s]?bissau\b|\bbissau\b/, "Guinea-Bissau"],
		[/\bguinee\b|\bguinea\b/, "Guinea"],
		[/madagascar|anoisizato|maki/, "Madagascar"],
		[/zanzibar|tanzania|mnazi\s+mmoja/, "Tanzania"],
		[/\bzambia\b|kalabo|sikongo/, "Zambia"],
		[/\btchad\b|\bchad\b|abeche/, "Chad"],
	];
	return countries.find(([pattern]) => pattern.test(haystack))?.[1] ?? "Africa";
}

function opportunityFromDocument(title: string, documentUrl: string, sourceUrl: string): BadeaOpportunity {
	const publishedMonth = publishedMonthFromUrl(documentUrl);
	const documentLinks = [{ label: "Procurement notice PDF", url: documentUrl }];
	const category = inferCategory(title, documentUrl);
	const fileSlug = slugify(basenameFromUrl(documentUrl));

	return {
		title,
		source: "badea",
		sourceId: `badea-${slugify(`${title}-${fileSlug}`) || fileSlug || "procurement-notice"}`,
		noticeId: fileSlug || undefined,
		organization: "Arab Bank for Economic Development in Africa (BADEA)",
		countryRegion: inferCountryRegion(title, documentUrl),
		category,
		opportunityType: inferOpportunityType(title, documentUrl),
		publishedDate: publishedDateFromMonth(publishedMonth),
		portalUrl: sourceUrl,
		documentUrl,
		rfpLink: documentUrl,
		projectSummary: [
			"BADEA African development project procurement notice.",
			publishedMonth ? `Source document month: ${publishedMonth}.` : undefined,
			"Use the linked PDF for deadlines and submission instructions.",
		].filter(Boolean).join(" "),
		submissionMethod: "Use the BADEA procurement notice PDF for submission instructions.",
		tags: ["badea", "development-bank", "africa", "source-documents"],
		metadata: {
			badea: {
				sourceUrl,
				publishedMonth,
				documentLinks,
			},
		},
	};
}

export function parseBadeaProcurementHtml(html: string, sourceUrl = BADEA_PROCUREMENT_URL): BadeaOpportunity[] {
	const opportunities: BadeaOpportunity[] = [];
	const seen = new Set<string>();
	for (const match of html.matchAll(/<a\b([^>]*)>/gi)) {
		const documentUrl = absoluteBadeaUrl(attrValue(match[1], "href"), sourceUrl);
		if (!documentUrl || seen.has(documentUrl) || !isDocumentUrl(documentUrl)) continue;
		seen.add(documentUrl);
		const title = titleNearLink(html, match.index ?? 0, documentUrl);
		if (!title) continue;
		opportunities.push(opportunityFromDocument(title, documentUrl, sourceUrl));
	}
	return opportunities;
}

function pageLimit(): number {
	const parsed = Number(process.env.BADEA_PAGE_LIMIT ?? DEFAULT_PAGE_LIMIT);
	if (!Number.isFinite(parsed)) return DEFAULT_PAGE_LIMIT;
	return Math.min(12, Math.max(1, Math.trunc(parsed)));
}

function maxPageFromHtml(html: string): number | undefined {
	const match = /\bdata-max-page=["'](\d+)["']/i.exec(html);
	if (!match) return undefined;
	const parsed = Number(match[1]);
	return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : undefined;
}

function pageUrlFor(baseUrl: string, page: number): string {
	const url = new URL(baseUrl || BADEA_PROCUREMENT_URL);
	const basePath = url.pathname
		.replace(/\/\d+\/?$/i, "/")
		.replace(/\/?$/i, "/");
	url.pathname = page <= 1 ? basePath : `${basePath}${page}/`;
	url.search = "";
	url.hash = "";
	return url.toString();
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
		throw new Error(`BADEA procurement fetch failed: ${response.status} ${response.statusText}`);
	}
	return response.text();
}

async function fetchBadeaOpportunities(sourceUrl: string): Promise<BadeaOpportunity[]> {
	const baseUrl = sourceUrl || BADEA_PROCUREMENT_URL;
	const opportunities: BadeaOpportunity[] = [];
	const seen = new Set<string>();
	let lastPage = pageLimit();
	for (let page = 1; page <= Math.min(pageLimit(), lastPage); page++) {
		const pageUrl = pageUrlFor(baseUrl, page);
		const html = await fetchHtml(pageUrl);
		lastPage = Math.min(pageLimit(), maxPageFromHtml(html) ?? lastPage);
		const pageOpportunities = parseBadeaProcurementHtml(html, pageUrl);
		if (pageOpportunities.length === 0) break;
		for (const opportunity of pageOpportunities) {
			const identity = opportunity.documentUrl ?? opportunity.sourceId ?? opportunity.title;
			if (seen.has(identity)) continue;
			seen.add(identity);
			opportunities.push(opportunity);
		}
	}
	return opportunities;
}

export const badeaParser: TenderParser = {
	sourceId: "badea",
	name: "BADEA Procurement Notices",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		if (!input.html?.trim() && !input.markdown?.trim() && input.url) {
			return { opportunities: await fetchBadeaOpportunities(input.url) };
		}
		return { opportunities: parseBadeaProcurementHtml(input.html ?? input.markdown ?? "", input.url) };
	},

	getPageUrl(baseUrl: string, page: number): string {
		return pageUrlFor(baseUrl || BADEA_PROCUREMENT_URL, page);
	},

	hasNextPage(input: ParseInput, currentPage: number): boolean {
		const html = input.html ?? input.markdown ?? "";
		return currentPage < Math.min(pageLimit(), maxPageFromHtml(html) ?? pageLimit());
	},
};

registerParser(badeaParser);
