import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const FHI360_SOLICITATIONS_BASE_URL = "https://solicitations.fhi360.org/Solicitation.aspx";
const ENTRY_SEPARATOR_PATTERN = /<hr\s*\/?>/i;
const DOCUMENT_LINK_PATTERN = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

type Fhi360SolicitationKind = "RFP" | "RFQ" | "RFA";

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, codepoint: string) => String.fromCodePoint(Number(codepoint)))
		.replace(/&#x([0-9a-f]+);/gi, (_, codepoint: string) => String.fromCodePoint(Number.parseInt(codepoint, 16)))
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, "\"")
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'");
}

function stripHtml(value: string): string {
	return cleanText(decodeHtmlEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 90);
}

function absoluteFhi360Url(href: string | undefined, sourceUrl: string): string | undefined {
	if (!href) return undefined;
	try {
		const decoded = decodeHtmlEntities(href);
		const base = decoded.startsWith("/Files/")
			? FHI360_SOLICITATIONS_BASE_URL
			: sourceUrl;
		return new URL(decoded, base).toString();
	} catch {
		return undefined;
	}
}

function utcStartOfDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isExpired(deadline: Date | undefined, now = new Date()): boolean {
	if (!deadline) return false;
	return deadline.getTime() < utcStartOfDay(now).getTime();
}

function parseFhi360Date(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	const normalized = value.replace(/\s+/g, " ").trim();
	const match = normalized.match(/\b(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})\b/);
	if (!match) return undefined;
	const months: Record<string, number> = {
		january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
		july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
		jan: 0, feb: 1, mar: 2, apr: 3, jun: 5,
		jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
	};
	const month = months[match[2].toLowerCase()];
	if (month === undefined) return undefined;
	return new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
}

function spanValue(block: string, label: "Title" | "Number" | "Issue" | "Close"): string | undefined {
	const match = block.match(new RegExp(`<span\\b[^>]*id=["']MainContent_lv(?:RFP|RFQ|RFA)_lbl${label}_\\d+["'][^>]*>([\\s\\S]*?)<\\/span>`, "i"));
	return cleanText(stripHtml(match?.[1] ?? "")) || undefined;
}

function kindFromBlock(block: string): Fhi360SolicitationKind | undefined {
	return block.match(/MainContent_lv(RFP|RFQ|RFA)_lblTitle_\d+/i)?.[1]?.toUpperCase() as Fhi360SolicitationKind | undefined;
}

function opportunityTypeFor(kind: Fhi360SolicitationKind): OpportunityData["opportunityType"] {
	if (kind === "RFA") return "grant";
	if (kind === "RFP") return "rfp";
	return "tender";
}

function categoryFor(kind: Fhi360SolicitationKind): string {
	if (kind === "RFA") return "FHI 360 requests for applications";
	if (kind === "RFQ") return "FHI 360 requests for quotes";
	return "FHI 360 requests for proposals";
}

function documentLinks(block: string, sourceUrl: string): Array<{ label?: string; url: string }> {
	const links: Array<{ label?: string; url: string }> = [];
	for (const match of block.matchAll(DOCUMENT_LINK_PATTERN)) {
		const href = match[1] ?? "";
		const label = stripHtml(match[2] ?? "");
		if (!/\.(?:pdf|docx?|xlsx?)(?:[?#].*)?$/i.test(href)) continue;
		const url = absoluteFhi360Url(href, sourceUrl);
		if (!url) continue;
		links.push({
			label: label || undefined,
			url,
		});
	}
	return links;
}

function primaryDocumentUrl(links: Array<{ label?: string; url: string }>): string | undefined {
	return links.find((link) => /\.(?:pdf|docx?)(?:[?#].*)?$/i.test(link.url))?.url
		?? links[0]?.url;
}

function parseFhi360Solicitations(content: string | undefined, sourceUrl: string, now = new Date()): OpportunityData[] {
	if (!content) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const block of content.split(ENTRY_SEPARATOR_PATTERN)) {
		const kind = kindFromBlock(block);
		if (!kind) continue;

		const title = spanValue(block, "Title");
		if (!title || title.length < 8) continue;

		const noticeId = spanValue(block, "Number") ?? slugify(title);
		const deadline = parseFhi360Date(spanValue(block, "Close"));
		if (isExpired(deadline, now)) continue;

		const sourceId = `fhi360-${slugify(noticeId || title)}`;
		if (seen.has(sourceId)) continue;

		const docs = documentLinks(block, sourceUrl);
		const documentUrl = primaryDocumentUrl(docs);
		const publishedDate = parseFhi360Date(spanValue(block, "Issue"));
		seen.add(sourceId);
		opportunities.push({
			title,
			source: "fhi360",
			sourceId,
			noticeId,
			organization: "FHI 360",
			category: categoryFor(kind),
			opportunityType: opportunityTypeFor(kind),
			deadline,
			publishedDate,
			portalUrl: sourceUrl,
			documentUrl,
			rfpLink: documentUrl ?? sourceUrl,
			projectSummary: [
				`FHI 360 ${kind} solicitation.`,
				deadline ? `Closing date: ${deadline.toISOString().slice(0, 10)}.` : undefined,
			].filter(Boolean).join(" "),
			tags: ["fhi360", "donor-implementer", "source-scrape", "source-documents"],
			metadata: {
				fhi360: {
					sourcePage: sourceUrl,
					kind,
					noticeId,
					documentLinks: docs,
				},
			},
		});
	}

	return opportunities;
}

export const fhi360Parser: TenderParser = {
	sourceId: "fhi360",
	name: "FHI 360 Solicitations",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseFhi360Solicitations(
				input.html ?? input.markdown,
				input.url || FHI360_SOLICITATIONS_BASE_URL
			),
		};
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || FHI360_SOLICITATIONS_BASE_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(fhi360Parser);
