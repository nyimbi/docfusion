import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const ENABEL_PUBLIC_PROCUREMENT_URL = "https://www.enabel.be/public-procurement/";
const ENABEL_CARD_PATTERN = /<div\b[^>]*class=["'][^"']*\bcard--tenders\b[^"']*["'][^>]*>([\s\S]*?)(?=<div\b[^>]*class=["'][^"']*\bcard--tenders\b|<\/section>|$)/gi;
const DOCUMENT_LINK_PATTERN = /\.(?:pdf|docx?|xlsx?|xls|zip)(?:[?#].*)?$/i;

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, codepoint: string) => String.fromCodePoint(Number(codepoint)))
		.replace(/&#x([0-9a-f]+);/gi, (_, codepoint: string) => String.fromCodePoint(Number.parseInt(codepoint, 16)))
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, "\"")
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&nbsp;/g, " ")
		.replace(/&ndash;/g, "-")
		.replace(/&mdash;/g, "-");
}

function stripHtml(value: string): string {
	return cleanText(decodeHtmlEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>|<\/ul>|<\/ol>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function absoluteUrl(rawUrl: string | undefined, sourceUrl: string): string | undefined {
	if (!rawUrl) return undefined;
	try {
		const url = new URL(decodeHtmlEntities(rawUrl), sourceUrl);
		if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
		url.hash = "";
		return url.toString();
	} catch {
		return undefined;
	}
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 90);
}

function utcStartOfDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isExpired(deadline: Date | undefined, now = new Date()): boolean {
	if (!deadline) return false;
	return deadline.getTime() < utcStartOfDay(now).getTime();
}

function labelValue(block: string, label: string): string | undefined {
	const pattern = new RegExp(`<strong>\\s*${label}\\s*:?\\s*<\\/strong>\\s*([\\s\\S]*?)(?:<\\/p>|<br\\s*\\/?>|$)`, "i");
	const value = stripHtml(block.match(pattern)?.[1] ?? "");
	return value || undefined;
}

function parseClosingDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	const cleaned = value
		.replace(/\b\d{1,2}:\d{2}\b/g, " ")
		.replace(/\b(?:CET|CEST|EAT|GMT|UTC)\b/gi, " ")
		.replace(/\s+/g, " ")
		.trim();
	const dateCandidate = cleaned.match(/\b(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/)?.[1]
		?? cleaned.match(/\b([A-Za-z]+\s+\d{1,2},\s+\d{4})\b/)?.[1]
		?? cleaned;
	return parseDate(dateCandidate);
}

function titleParts(rawTitle: string): { reference?: string; title: string } {
	const normalized = rawTitle.replace(/\s*[–—]\s*/g, " - ").replace(/\s+/g, " ").trim();
	const match = normalized.match(/^([A-Z]{2,}\d{2,}[A-Z0-9-]*)\s+-\s+(.+)$/i);
	if (!match) return { title: normalized };
	return {
		reference: match[1],
		title: match[2].trim(),
	};
}

function extractRawTitle(block: string): string | undefined {
	const title = stripHtml(block.match(/<p\b[^>]*class=["'][^"']*\bh5\b[^"']*["'][^>]*>[\s\S]*?<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
	return title.length >= 8 ? title : undefined;
}

function extractDescription(block: string): string | undefined {
	const description = stripHtml(block.match(/<strong>\s*Description\s*:\s*<\/strong>\s*(?:<\/p>)?([\s\S]*?)(?=<p>\s*<strong>\s*Attachments\s*:|<p>\s*<strong>\s*Applicable legislation\s*:|$)/i)?.[1] ?? "");
	if (description.length > 30) return description;
	return undefined;
}

function extractDocumentLinks(block: string, sourceUrl: string): Array<{ url: string; label?: string }> {
	const links: Array<{ url: string; label?: string }> = [];
	const seen = new Set<string>();
	for (const match of block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
		const label = stripHtml(match[2] ?? "");
		const href = decodeHtmlEntities(match[1] ?? "");
		if (!DOCUMENT_LINK_PATTERN.test(href)) continue;
		const url = absoluteUrl(href, sourceUrl);
		if (!url || seen.has(url)) continue;
		seen.add(url);
		links.push({
			url,
			...(label ? { label } : {}),
		});
	}
	return links;
}

function isGrantSource(sourceUrl: string): boolean {
	try {
		return new URL(sourceUrl).pathname.startsWith("/grants");
	} catch {
		return false;
	}
}

function opportunityType(sourceUrl: string): OpportunityData["opportunityType"] {
	return isGrantSource(sourceUrl) ? "grant" : "tender";
}

function parseEnabelCards(content: string | undefined, sourceUrl: string, now = new Date()): OpportunityData[] {
	if (!content) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const match of content.matchAll(ENABEL_CARD_PATTERN)) {
		const block = match[0];
		const rawTitle = extractRawTitle(block);
		if (!rawTitle) continue;
		const { reference, title } = titleParts(rawTitle);
		const status = labelValue(block, "Status");
		if (!status || !/^open\b/i.test(status)) continue;
		const deadline = parseClosingDate(labelValue(block, "Closing date"));
		if (!deadline || isExpired(deadline, now)) continue;
		const documentLinks = extractDocumentLinks(block, sourceUrl);
		const sourceId = `enabel-${slugify(reference ?? title) || "opportunity"}`;
		if (seen.has(sourceId)) continue;
		seen.add(sourceId);

		const country = labelValue(block, "Country");
		const applicableLegislation = labelValue(block, "Applicable legislation");
		const documentUrl = documentLinks[0]?.url ?? sourceUrl;

		opportunities.push({
			title,
			source: "enabel",
			sourceId,
			noticeId: reference,
			organization: "Enabel",
			category: isGrantSource(sourceUrl) ? "Enabel grant" : "Enabel public procurement",
			opportunityType: opportunityType(sourceUrl),
			countryRegion: country,
			deadline,
			portalUrl: sourceUrl,
			documentUrl,
			rfpLink: documentUrl,
			projectSummary: extractDescription(block) ?? "Enabel open procurement or grant opportunity.",
			tags: ["enabel", "bilateral-donor", "source-scrape", "source-documents"],
			metadata: {
				enabel: {
					sourcePage: sourceUrl,
					reference,
					status,
					applicableLegislation,
					documentLinks,
				},
			},
		});
	}

	return opportunities;
}

export const enabelParser: TenderParser = {
	sourceId: "enabel",
	name: "Enabel Public Procurement and Grants",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseEnabelCards(input.html ?? input.markdown, input.url || ENABEL_PUBLIC_PROCUREMENT_URL),
		};
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || ENABEL_PUBLIC_PROCUREMENT_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(enabelParser);
