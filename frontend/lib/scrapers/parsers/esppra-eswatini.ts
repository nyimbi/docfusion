import https from "node:https";

import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const ESPPRA_BASE_URL = "https://esppra.co.sz";
export const ESPPRA_TENDER_URL = `${ESPPRA_BASE_URL}/sppra/tender.php`;
const DEFAULT_MAX_PAGES = 4;
const MAX_PAGES = 8;

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
		.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
		.replace(/<style\b[\s\S]*?<\/style>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function absoluteEsppraUrl(rawUrl: string | undefined): string | undefined {
	const cleaned = decodeEntities(rawUrl ?? "").trim();
	if (!cleaned) return undefined;
	try {
		const parsed = new URL(cleaned, `${ESPPRA_BASE_URL}/sppra/`);
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return undefined;
	}
}

function jobBoxes(html: string): string[] {
	return [...html.matchAll(/<div\b[^>]*class=["'][^"']*\blist-item\b[^"']*\bjob-box\b[^"']*["'][^>]*>[\s\S]*?<\/div>/gi)]
		.map((match) => match[0]);
}

function paragraphs(html: string): string[] {
	return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
		.map((match) => stripHtml(match[1]));
}

function textAfterLabel(values: string[], label: string): string {
	const lowerLabel = label.toLowerCase();
	for (const value of values) {
		const normalized = value.replace(/\s+/g, " ").trim();
		if (!normalized.toLowerCase().startsWith(lowerLabel)) continue;
		return cleanText(normalized.slice(label.length).replace(/^:/, ""));
	}
	return "";
}

function parseEsppraDate(value: string): Date | undefined {
	const cleaned = value
		.replace(/^\w+\s+/i, "")
		.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1")
		.replace(/\s+/g, " ")
		.trim();
	const match = /^(\d{1,2})\s+([a-z]+)\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(cleaned);
	if (!match) {
		const parsed = Date.parse(cleaned);
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
	let hour = Number(match[4]);
	if (match[6].toLowerCase() === "pm" && hour < 12) hour += 12;
	if (match[6].toLowerCase() === "am" && hour === 12) hour = 0;
	const day = Number(match[1]);
	const year = Number(match[3]);
	const minute = Number(match[5]);
	if (![day, year, hour, minute].every(Number.isFinite)) return undefined;
	return new Date(Date.UTC(year, month, day, hour - 2, minute));
}

function inferOpportunityType(title: string, procurementMethod: string): OpportunityData["opportunityType"] {
	const haystack = `${title} ${procurementMethod}`.toLowerCase();
	if (/\b(expression of interest|eoi)\b/.test(haystack)) return "eoi";
	if (/\b(request for proposal|rfp|consultancy|consulting|consultant)\b/.test(haystack)) return "rfp";
	if (/\bquotation|rfq\b/.test(haystack)) return "tender";
	return "tender";
}

function sourceIdFor(downloadId: string | undefined, reference: string, title: string): string {
	if (downloadId) return `esppra-${downloadId}`;
	const raw = reference || title;
	const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
	return `esppra-${slug || "tender"}`;
}

function opportunityFromJobBox(boxHtml: string): OpportunityData | undefined {
	const title = stripHtml(boxHtml.match(/<h5\b[^>]*>([\s\S]*?)<\/h5>/i)?.[1] ?? "");
	const values = paragraphs(boxHtml);
	const organization = values[0];
	const reference = values[1] && !/^procurement method:/i.test(values[1]) ? values[1] : "";
	const procurementMethod = textAfterLabel(values, "Procurement Method");
	const uploadDateText = textAfterLabel(values, "Tender Upload Date");
	const deadlineText = textAfterLabel(values, "Submission Deadline");
	const documentMatch = /<a\b[^>]*id=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*>\s*Download Tender\s*<\/a>/i.exec(boxHtml)
		?? /<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Download Tender\s*<\/a>/i.exec(boxHtml);
	const downloadId = documentMatch?.length === 3 ? documentMatch[1] : undefined;
	const documentUrl = absoluteEsppraUrl(documentMatch?.length === 3 ? documentMatch[2] : documentMatch?.[1]);
	if (!title || !documentUrl) return undefined;

	return {
		title,
		source: "esppra_eswatini",
		sourceId: sourceIdFor(downloadId, reference, title),
		noticeId: reference || downloadId,
		organization: organization || "ESPPRA",
		countryRegion: "Eswatini",
		category: procurementMethod || "ESPPRA tender",
		opportunityType: inferOpportunityType(title, procurementMethod),
		deadline: parseEsppraDate(deadlineText),
		publishedDate: parseEsppraDate(uploadDateText),
		portalUrl: ESPPRA_TENDER_URL,
		documentUrl,
		rfpLink: documentUrl,
		projectSummary: [
			reference ? `Reference: ${reference}` : undefined,
			procurementMethod ? `Procurement method: ${procurementMethod}` : undefined,
			deadlineText ? `Submission deadline: ${deadlineText}` : undefined,
		].filter(Boolean).join("; "),
		submissionMethod: "Use the ESPPRA tender notice and linked tender document for submission instructions.",
		tags: ["esppra", "eswatini", "national-procurement", "direct-documents", "source-api"],
		metadata: {
			esppraEswatini: {
				downloadId,
				reference,
				procurementMethod,
				uploadDateText,
				deadlineText,
			},
		},
	};
}

export function parseEsppraTenderHtml(html: string): OpportunityData[] {
	const seen = new Set<string>();
	const opportunities: OpportunityData[] = [];
	for (const box of jobBoxes(html)) {
		const opportunity = opportunityFromJobBox(box);
		if (!opportunity?.sourceId || seen.has(opportunity.sourceId)) continue;
		seen.add(opportunity.sourceId);
		opportunities.push(opportunity);
	}
	return opportunities;
}

function configuredMaxPages(): number {
	const parsed = Number(process.env.ESPPRA_MAX_PAGES ?? DEFAULT_MAX_PAGES);
	if (!Number.isFinite(parsed)) return DEFAULT_MAX_PAGES;
	return Math.min(MAX_PAGES, Math.max(1, Math.trunc(parsed)));
}

async function fetchTextWithInsecureTlsFallback(url: string): Promise<string> {
	try {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(20000),
			headers: {
				Accept: "text/html,application/xhtml+xml",
				"User-Agent": "Mozilla/5.0 (compatible; LindelaOpportunityDiscovery/1.0; +https://lindela.io)",
			},
		});
		if (!response.ok) throw new Error(`ESPPRA tender fetch failed: ${response.status} ${response.statusText}`);
		return await response.text();
	} catch (error) {
		return fetchTextWithNodeHttps(url, error instanceof Error ? error.message : String(error));
	}
}

function fetchTextWithNodeHttps(url: string, fetchError: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const request = https.get(url, {
			headers: {
				Accept: "text/html,application/xhtml+xml",
				"User-Agent": "Mozilla/5.0 (compatible; LindelaOpportunityDiscovery/1.0; +https://lindela.io)",
			},
			rejectUnauthorized: false,
			timeout: 20000,
		}, (response) => {
			const chunks: Buffer[] = [];
			response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
			response.on("end", () => {
				const status = response.statusCode ?? 0;
				if (status < 200 || status >= 300) {
					reject(new Error(`ESPPRA tender fetch failed after TLS fallback: ${status}; initial fetch: ${fetchError}`));
					return;
				}
				resolve(Buffer.concat(chunks).toString("utf8"));
			});
		});
		request.on("timeout", () => {
			request.destroy(new Error("ESPPRA tender fetch timed out"));
		});
		request.on("error", reject);
	});
}

async function fetchEsppraTenders(sourceUrl: string): Promise<OpportunityData[]> {
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();
	for (let page = 1; page <= configuredMaxPages(); page++) {
		const html = await fetchTextWithInsecureTlsFallback(esppraPageUrl(sourceUrl, page));
		for (const opportunity of parseEsppraTenderHtml(html)) {
			if (!opportunity.sourceId || seen.has(opportunity.sourceId)) continue;
			seen.add(opportunity.sourceId);
			opportunities.push(opportunity);
		}
		if (!hasEsppraNextPage(html, page)) break;
	}
	return opportunities;
}

function esppraPageUrl(baseUrl: string, page: number): string {
	const url = new URL(baseUrl || ESPPRA_TENDER_URL, ESPPRA_TENDER_URL);
	if (page <= 1) {
		url.searchParams.delete("Page");
	} else {
		url.searchParams.set("Page", String(page));
	}
	return url.toString();
}

function hasEsppraNextPage(html: string, currentPage: number): boolean {
	const pattern = new RegExp(`tender\\.php\\?Page=${currentPage + 1}(?:&|['"])`, "i");
	return pattern.test(html);
}

export const esppraEswatiniParser: TenderParser = {
	sourceId: "esppra_eswatini",
	name: "ESPPRA Eswatini Tender Opportunities",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			const opportunities = input.html || input.markdown
				? parseEsppraTenderHtml(input.html ?? input.markdown ?? "")
				: await fetchEsppraTenders(input.url || ESPPRA_TENDER_URL);
			return { opportunities };
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	},

	getPageUrl(baseUrl: string, page: number): string {
		return esppraPageUrl(baseUrl || ESPPRA_TENDER_URL, page);
	},

	hasNextPage(input: ParseInput, currentPage: number): boolean {
		return hasEsppraNextPage(input.html ?? input.markdown ?? "", currentPage);
	},
};

registerParser(esppraEswatiniParser);

export default esppraEswatiniParser;
