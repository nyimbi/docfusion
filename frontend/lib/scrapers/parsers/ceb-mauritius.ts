import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const CEB_BASE_URL = "https://ceb.mu";
export const CEB_MAURITIUS_TENDERS_URL = `${CEB_BASE_URL}/procurement/tender`;

type CebDocumentLink = {
	label: string;
	url: string;
	section: "download" | "tender_document" | "updates";
};

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
	return cleanText(decodeEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function absoluteCebUrl(rawUrl: string | undefined): string | undefined {
	const cleaned = decodeEntities(rawUrl ?? "").replace(/\r|\n/g, "").trim();
	if (!cleaned || /^javascript:/i.test(cleaned)) return undefined;
	try {
		return new URL(cleaned, CEB_BASE_URL).toString();
	} catch {
		return undefined;
	}
}

function tenderBlocks(html: string): Array<{ titleHtml: string; detailsHtml: string }> {
	return [...html.matchAll(/<h4\b[^>]*class=["'][^"']*\bmt-40\b[^"']*["'][^>]*>([\s\S]*?)<\/h4>\s*<dl\b[^>]*>([\s\S]*?)<\/dl>/gi)]
		.map((match) => ({
			titleHtml: match[1] ?? "",
			detailsHtml: match[2] ?? "",
		}));
}

function detailsByLabel(detailsHtml: string): Map<string, string[]> {
	const result = new Map<string, string[]>();
	const matches = [...detailsHtml.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)];
	for (const match of matches) {
		const label = stripHtml(match[1] ?? "").replace(/:$/, "").toLowerCase();
		const value = match[2] ?? "";
		if (!label) continue;
		result.set(label, [...(result.get(label) ?? []), value]);
	}
	return result;
}

function firstDetailText(details: Map<string, string[]>, label: string): string | undefined {
	return details.get(label.toLowerCase())?.map(stripHtml).find(Boolean);
}

function documentLinksFromHtml(html: string, section: CebDocumentLink["section"]): CebDocumentLink[] {
	const links: CebDocumentLink[] = [];
	for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
		const attributes = match[1] ?? "";
		const href = /href=["']([^"']+)["']/i.exec(attributes)?.[1];
		const dataSrc = /data-src=["']([^"']+)["']/i.exec(attributes)?.[1];
		const url = absoluteCebUrl(dataSrc ?? href);
		if (!url) continue;
		links.push({
			url,
			label: stripHtml(match[2] ?? "") || url.split("/").pop() || "CEB tender document",
			section,
		});
	}
	return links;
}

function allDocumentLinks(details: Map<string, string[]>): CebDocumentLink[] {
	const links = [
		...(details.get("download") ?? []).flatMap((html) => documentLinksFromHtml(html, "download")),
		...(details.get("tender document") ?? []).flatMap((html) => documentLinksFromHtml(html, "tender_document")),
		...(details.get("updates") ?? []).flatMap((html) => documentLinksFromHtml(html, "updates")),
	];
	const seen = new Set<string>();
	return links.filter((link) => {
		if (seen.has(link.url)) return false;
		seen.add(link.url);
		return true;
	});
}

function parseMauritiusDeadline(value: string | undefined): Date | undefined {
	const cleaned = value?.replace(/\s+/g, " ").trim();
	if (!cleaned) return undefined;
	const match = /\b([A-Za-z]+),\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})/i.exec(cleaned);
	if (!match) {
		const parsed = new Date(cleaned);
		return Number.isNaN(parsed.getTime()) ? undefined : parsed;
	}
	const monthIndex = [
		"january",
		"february",
		"march",
		"april",
		"may",
		"june",
		"july",
		"august",
		"september",
		"october",
		"november",
		"december",
	].indexOf((match[2] ?? "").toLowerCase());
	if (monthIndex < 0) return undefined;
	const day = Number(match[3]);
	const year = Number(match[4]);
	const hour = Number(match[5]);
	const minute = Number(match[6]);
	return new Date(Date.UTC(year, monthIndex, day, hour - 4, minute));
}

function normalizeTitle(titleHtml: string): string {
	return stripHtml(titleHtml.replace(/\[\s*<span[\s\S]*?<\/span>\s*\]/gi, " "));
}

function inferOpportunityType(title: string, reference: string | undefined): OpportunityData["opportunityType"] {
	const haystack = `${title} ${reference ?? ""}`.toLowerCase();
	if (/\b(rfp|request for proposal|consultancy|consultant)\b/.test(haystack)) return "rfp";
	if (/\b(eoi|expression of interest)\b/.test(haystack)) return "eoi";
	return "tender";
}

function sourceIdFor(reference: string | undefined, title: string): string {
	const slug = (reference || title)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 90);
	return `ceb-mauritius-${slug || "tender"}`;
}

function opportunityFromBlock(block: { titleHtml: string; detailsHtml: string }): OpportunityData | undefined {
	const title = normalizeTitle(block.titleHtml);
	if (!title) return undefined;
	const details = detailsByLabel(block.detailsHtml);
	const reference = firstDetailText(details, "reference");
	const closingDateText = firstDetailText(details, "closing date");
	const remarks = firstDetailText(details, "remarks");
	const documentLinks = allDocumentLinks(details);
	const primaryDocument = documentLinks.find((link) => link.section === "tender_document")
		?? documentLinks.find((link) => link.section === "download")
		?? documentLinks[0];

	return {
		title,
		source: "ceb_mauritius",
		sourceId: sourceIdFor(reference, title),
		noticeId: reference ?? sourceIdFor(reference, title),
		organization: "Central Electricity Board Mauritius",
		countryRegion: "Mauritius",
		category: "CEB public tender",
		opportunityType: inferOpportunityType(title, reference),
		deadline: parseMauritiusDeadline(closingDateText),
		portalUrl: CEB_MAURITIUS_TENDERS_URL,
		documentUrl: primaryDocument?.url,
		rfpLink: primaryDocument?.url ?? CEB_MAURITIUS_TENDERS_URL,
		projectSummary: [
			reference ? `Reference: ${reference}` : undefined,
			closingDateText ? `Closing date: ${closingDateText}` : undefined,
			remarks ? `Remarks: ${remarks}` : undefined,
			documentLinks.length > 0 ? `${documentLinks.length} linked tender document(s) found.` : undefined,
		].filter(Boolean).join("; "),
		submissionMethod: "Use the Mauritius CEB procurement tender page and linked tender documents for submission instructions.",
		tags: ["ceb", "mauritius", "national-procurement", "direct-documents"],
		metadata: {
			cebMauritius: {
				reference,
				closingDateText,
				remarks,
				documentLinks,
			},
		},
	};
}

export function parseCebMauritiusTendersHtml(html: string): OpportunityData[] {
	const seen = new Set<string>();
	const opportunities: OpportunityData[] = [];
	for (const block of tenderBlocks(html)) {
		const opportunity = opportunityFromBlock(block);
		if (!opportunity?.sourceId || seen.has(opportunity.sourceId)) continue;
		seen.add(opportunity.sourceId);
		opportunities.push(opportunity);
	}
	return opportunities;
}

async function fetchCebTenders(sourceUrl: string): Promise<OpportunityData[]> {
	const response = await fetch(sourceUrl || CEB_MAURITIUS_TENDERS_URL, {
		signal: AbortSignal.timeout(20000),
		headers: {
			"Accept": "text/html,application/xhtml+xml",
			"User-Agent": "Mozilla/5.0 (compatible; LindelaOpportunityDiscovery/1.0; +https://lindela.io)",
		},
	});
	if (!response.ok) {
		throw new Error(`CEB Mauritius tenders fetch failed: ${response.status} ${response.statusText}`);
	}
	return parseCebMauritiusTendersHtml(await response.text());
}

export const cebMauritiusParser: TenderParser = {
	sourceId: "ceb_mauritius",
	name: "Mauritius CEB Public Tenders",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			if (input.html || input.markdown) {
				return { opportunities: parseCebMauritiusTendersHtml(input.html || input.markdown || "") };
			}
			return { opportunities: await fetchCebTenders(input.url || CEB_MAURITIUS_TENDERS_URL) };
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || CEB_MAURITIUS_TENDERS_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(cebMauritiusParser);
