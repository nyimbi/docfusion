import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const CPBN_BASE_URL = "https://www.cpbn.com.na";
export const CPBN_NAMIBIA_OPEN_BIDS_URL = `${CPBN_BASE_URL}/index/external/2`;

type CpbnDocumentRequest = {
	label: string;
	url: string;
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
	return cleanText(decodeEntities(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ")));
}

function tableRows(html: string): string[] {
	return [...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
}

function absoluteCpbnUrl(rawUrl: string | undefined): string | undefined {
	const cleaned = decodeEntities(rawUrl ?? "").trim();
	if (!cleaned) return undefined;
	try {
		return new URL(cleaned, CPBN_BASE_URL).toString();
	} catch {
		return undefined;
	}
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCpbnDate(value: string): Date | undefined {
	const cleaned = cleanText(value);
	if (!cleaned) return undefined;
	const match = /(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+),?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/i.exec(cleaned);
	if (!match) {
		const parsed = Date.parse(cleaned.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1"));
		return Number.isNaN(parsed) ? undefined : new Date(parsed);
	}
	const months: Record<string, number> = {
		january: 0,
		february: 1,
		march: 2,
		april: 3,
		may: 4,
		june: 5,
		july: 6,
		august: 7,
		september: 8,
		october: 9,
		november: 10,
		december: 11,
	};
	const month = months[match[2].toLowerCase()];
	if (month === undefined) return undefined;
	const day = Number(match[1]);
	const year = Number(match[3]);
	const hasTime = match[4] !== undefined;
	const hour = Number(match[4] ?? 0);
	const minute = Number(match[5] ?? 0);
	if (![day, year, hour, minute].every(Number.isFinite)) return undefined;
	return hasTime
		? new Date(Date.UTC(year, month, day, hour - 2, minute))
		: new Date(Date.UTC(year, month, day));
}

function inferOpportunityType(title: string): OpportunityData["opportunityType"] {
	const haystack = title.toLowerCase();
	if (/\b(eoi|expression of interest)\b/.test(haystack)) return "eoi";
	if (/\b(rfp|request for proposal|consultancy|consulting|consultant)\b/.test(haystack)) return "rfp";
	return "tender";
}

function titleAndPortal(rowHtml: string): { title: string; portalUrl: string; bidId?: string } | undefined {
	const match = /<a\b[^>]*href=["']([^"']*\/index\/bid\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i.exec(rowHtml);
	if (!match) return undefined;
	const portalUrl = absoluteCpbnUrl(match[1]);
	const title = stripHtml(match[3] ?? "");
	if (!portalUrl || !title) return undefined;
	return { title, portalUrl, bidId: match[2] };
}

function fieldAfterLabel(rowHtml: string, label: string): string {
	const pattern = new RegExp(`<strong>\\s*${escapeRegExp(label)}\\s*:<\\/strong>\\s*([^|<]+)`, "i");
	return stripHtml(pattern.exec(rowHtml)?.[1] ?? "");
}

function documentRequests(rowHtml: string): CpbnDocumentRequest[] {
	const requests: CpbnDocumentRequest[] = [];
	const matches = rowHtml.matchAll(/openModalRemoteContent\(["']([^"']+)["']\)[\s\S]*?<\/span>\s*&nbsp;([^<]+)/gi);
	for (const match of matches) {
		const url = absoluteCpbnUrl(match[1]);
		const label = stripHtml(match[2] ?? "");
		if (!url || !label) continue;
		requests.push({ label, url });
	}
	return requests;
}

function normalizeTitle(title: string, referenceNumber: string): string {
	if (!referenceNumber) return title;
	return cleanText(title.replace(new RegExp(`\\s*:?\\s*${escapeRegExp(referenceNumber)}\\s*$`, "i"), ""));
}

function sourceIdFor(bidId: string | undefined, referenceNumber: string, title: string): string {
	if (bidId) return `cpbn-${bidId}`;
	if (referenceNumber) {
		return `cpbn-${referenceNumber.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
	}
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 90);
	return `cpbn-${slug || "open-bid"}`;
}

function opportunityFromRow(rowHtml: string): OpportunityData | undefined {
	const linkedTitle = titleAndPortal(rowHtml);
	if (!linkedTitle) return undefined;
	const referenceNumber = fieldAfterLabel(rowHtml, "Reference number");
	const deadlineText = fieldAfterLabel(rowHtml, "Closing Date and Time");
	const documents = documentRequests(rowHtml);
	const title = normalizeTitle(linkedTitle.title, referenceNumber);

	return {
		title,
		source: "cpbn_namibia",
		sourceId: sourceIdFor(linkedTitle.bidId, referenceNumber, title),
		noticeId: referenceNumber || linkedTitle.bidId,
		organization: "Central Procurement Board of Namibia",
		countryRegion: "Namibia",
		category: "CPBN open bid",
		opportunityType: inferOpportunityType(title),
		deadline: parseCpbnDate(deadlineText),
		portalUrl: linkedTitle.portalUrl,
		rfpLink: linkedTitle.portalUrl,
		projectSummary: [
			referenceNumber ? `Reference number: ${referenceNumber}` : undefined,
			deadlineText ? `Closing date and time: ${deadlineText}` : undefined,
			documents.length > 0 ? `Available document request links: ${documents.map((document) => document.label).join("; ")}` : undefined,
		].filter(Boolean).join("; "),
		submissionMethod: "Submit through the Central Procurement Board of Namibia bid process.",
		tags: ["cpbn", "namibia", "national-procurement", "open-bids"],
		metadata: {
			cpbnNamibia: {
				bidId: linkedTitle.bidId,
				referenceNumber,
				deadlineText,
				documentRequests: documents,
			},
		},
	};
}

export function parseCpbnNamibiaOpenBidsHtml(html: string): OpportunityData[] {
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

async function fetchCpbnOpenBids(sourceUrl: string): Promise<string> {
	const response = await fetch(sourceUrl || CPBN_NAMIBIA_OPEN_BIDS_URL, {
		signal: AbortSignal.timeout(20000),
		headers: {
			"Accept": "text/html,application/xhtml+xml",
			"User-Agent": "Mozilla/5.0 (compatible; LindelaOpportunityDiscovery/1.0; +https://lindela.io)",
		},
	});
	if (!response.ok) {
		throw new Error(`CPBN Namibia open bids fetch failed: ${response.status} ${response.statusText}`);
	}
	return response.text();
}

export const cpbnNamibiaParser: TenderParser = {
	sourceId: "cpbn_namibia",
	name: "Namibia CPBN Open Bids",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			const html = input.html || input.markdown || await fetchCpbnOpenBids(input.url || CPBN_NAMIBIA_OPEN_BIDS_URL);
			return { opportunities: parseCpbnNamibiaOpenBidsHtml(html) };
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || CPBN_NAMIBIA_OPEN_BIDS_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(cpbnNamibiaParser);

export default cpbnNamibiaParser;
