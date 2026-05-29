import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const IOM_BASE_URL = "https://www.iom.int";
const IOM_PROCUREMENT_URL = `${IOM_BASE_URL}/procurement-opportunities`;
const ROW_PATTERN = /<ul\b[^>]*class=["'][^"']*\btable-row\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi;
const TITLE_LINK_PATTERN = /<h2\b[^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i;
const REFERENCE_PATTERN = /<h3\b[^>]*class=["'][^"']*\blabel\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i;
const ATTACHMENT_BLOCK_PATTERN = /<div\b[^>]*data-preamble=["']Attachment["'][^>]*>([\s\S]*?)<\/div>/i;
const LINK_PATTERN = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const DETAIL_PATTERN = /<span\b[^>]*data-preamble=["']([^"']+)["'][^>]*class=["'][^"']*\bdata\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;
const DOCUMENT_PATTERN = /\.(pdf|docx?|xlsx?)(?:[?#]|$)/i;

type IomAttachment = {
	label: string;
	url: string;
	score: number;
};

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

function normalizeIomUrl(rawUrl: string, baseUrl = IOM_PROCUREMENT_URL): string | undefined {
	try {
		const parsed = new URL(decodeHtmlEntities(rawUrl).trim(), baseUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return undefined;
	}
}

function extractDetails(rowHtml: string): Record<string, string> {
	const details: Record<string, string> = {};
	for (const match of rowHtml.matchAll(DETAIL_PATTERN)) {
		const label = cleanText(match[1]).toLowerCase();
		const value = stripHtml(match[2]);
		if (label && value) details[label] = value;
	}
	return details;
}

function scoreAttachment(label: string, url: string): number {
	const haystack = `${label} ${url}`.toLowerCase();
	let score = 0;
	if (/\b(rfp|request[-\s]+for[-\s]+proposal)\b/.test(haystack)) score += 20;
	if (/\b(rfq|request[-\s]+for[-\s]+quotation)\b/.test(haystack)) score += 14;
	if (/\b(itb|invitation[-\s]+to[-\s]+bid)\b/.test(haystack)) score += 12;
	if (/\b(eoi|expression[-\s]+of[-\s]+interest|cei)\b/.test(haystack)) score += 12;
	if (/\b(tor|terms[-\s]+of[-\s]+reference|scope[-\s]+of[-\s]+work)\b/.test(haystack)) score += 10;
	if (/\.docx?(?:[?#]|$)/i.test(url)) score += 4;
	if (/\.pdf(?:[?#]|$)/i.test(url)) score += 3;
	if (/\b(supplier|vendor|code[-\s]+of[-\s]+conduct|declaration|price[-\s]+list|form[-\s]+i|guide)\b/.test(haystack)) score -= 8;
	if (/\.xlsx?(?:[?#]|$)/i.test(url)) score -= 2;
	return score;
}

function extractAttachments(rowHtml: string): IomAttachment[] {
	const attachmentBlock = rowHtml.match(ATTACHMENT_BLOCK_PATTERN)?.[1] ?? rowHtml;
	const attachments = new Map<string, IomAttachment>();
	for (const match of attachmentBlock.matchAll(LINK_PATTERN)) {
		const url = normalizeIomUrl(match[1]);
		if (!url || !DOCUMENT_PATTERN.test(url)) continue;
		const label = stripHtml(match[2]) || url.split("/").pop() || "IOM procurement attachment";
		const score = scoreAttachment(label, url);
		const existing = attachments.get(url);
		if (!existing || score > existing.score) {
			attachments.set(url, { label, url, score });
		}
	}
	return [...attachments.values()].sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
}

function sourceIdFromReference(reference: string, portalUrl: string): string {
	const slug = (reference || portalUrl)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 90);
	return `iom-${slug || "procurement"}`;
}

function inferOpportunityType(title: string, reference: string, attachments: IomAttachment[]): OpportunityData["opportunityType"] {
	const haystack = `${title} ${reference} ${attachments.map((attachment) => attachment.label).join(" ")}`.toLowerCase();
	if (/\b(eoi|expression of interest|cei)\b/.test(haystack)) return "eoi";
	if (/\b(rfp|request for proposal)\b/.test(haystack)) return "rfp";
	return "tender";
}

function cleanSummary(rowHtml: string): string | undefined {
	const attachmentBlock = rowHtml.match(ATTACHMENT_BLOCK_PATTERN)?.[1] ?? "";
	const withoutLinks = attachmentBlock.replace(LINK_PATTERN, " ");
	const paragraphs = [...withoutLinks.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
		.map((match) => stripHtml(match[1]))
		.filter((text) => text && !/^brief (project )?description$/i.test(text))
		.slice(0, 3);
	return cleanText(paragraphs.join(" ")).slice(0, 1800) || undefined;
}

export function parseIomProcurementHtml(html: string | undefined, sourceUrl = IOM_PROCUREMENT_URL): OpportunityData[] {
	if (!html) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const match of html.matchAll(ROW_PATTERN)) {
		const rowHtml = match[1] ?? "";
		const titleMatch = rowHtml.match(TITLE_LINK_PATTERN);
		const portalUrl = titleMatch?.[1] ? normalizeIomUrl(titleMatch[1], sourceUrl) : undefined;
		const title = stripHtml(titleMatch?.[2]);
		if (!portalUrl || !title || seen.has(portalUrl)) continue;

		const reference = stripHtml(rowHtml.match(REFERENCE_PATTERN)?.[1]);
		const details = extractDetails(rowHtml);
		const attachments = extractAttachments(rowHtml);
		const primaryAttachment = attachments.find((attachment) => attachment.score > 0) ?? attachments[0];
		const deadline = parseDate(details["closing date"]);
		const publishedDate = parseDate(details["publication date"]);
		const sourceId = sourceIdFromReference(reference, portalUrl);
		seen.add(portalUrl);

		opportunities.push({
			title,
			source: "iom",
			sourceId,
			noticeId: reference || sourceId,
			organization: "International Organization for Migration",
			countryRegion: details.country,
			category: details.category || "IOM procurement",
			opportunityType: inferOpportunityType(title, reference, attachments),
			publishedDate,
			deadline,
			portalUrl,
			documentUrl: primaryAttachment?.url ?? portalUrl,
			rfpLink: primaryAttachment?.url ?? portalUrl,
			projectSummary: cleanSummary(rowHtml) ?? `${title}.`,
			submissionMethod: "Review the IOM procurement notice and attached solicitation documents for submission instructions.",
			tags: ["iom", "un-procurement", "source-scrape"],
			metadata: {
				iom: {
					sourceUrl,
					reference,
					attachments: attachments.map(({ label, url, score }) => ({ label, url, score })),
				},
			},
		});
	}

	return opportunities;
}

async function fetchIomProcurementHtml(sourceUrl: string): Promise<string> {
	const response = await fetch(sourceUrl || IOM_PROCUREMENT_URL, {
		headers: {
			Accept: "text/html,application/xhtml+xml",
			"User-Agent": "DocFusionRfpSourceCollector/1.0",
		},
	});
	if (!response.ok) {
		throw new Error(`IOM procurement page returned HTTP ${response.status}`);
	}
	return await response.text();
}

export const iomParser: TenderParser = {
	sourceId: "iom",
	name: "IOM Procurement Opportunities",
	requiresJavascript: false,
	async parse(content: ParseInput): Promise<ParseResult> {
		try {
			const sourceUrl = content.url || IOM_PROCUREMENT_URL;
			const html = content.html ?? content.markdown ?? await fetchIomProcurementHtml(sourceUrl);
			return {
				opportunities: parseIomProcurementHtml(html, sourceUrl),
			};
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch IOM procurement opportunities",
			};
		}
	},
	getPageUrl(baseUrl: string, page: number): string {
		if (page <= 1) return baseUrl;
		const url = new URL(baseUrl, IOM_PROCUREMENT_URL);
		url.searchParams.set("page", String(page));
		return url.toString();
	},
	hasNextPage(): boolean {
		return false;
	},
};

registerParser(iomParser);

export default iomParser;
