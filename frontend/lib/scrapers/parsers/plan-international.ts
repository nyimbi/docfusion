import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const HEADING_PATTERN = /<h3\b[^>]*class=["'][^"']*wp-block-heading[^"']*["'][^>]*>([\s\S]*?)<\/h3>/gi;

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
		.replace(/&aacute;/g, "á")
		.replace(/&eacute;/g, "é")
		.replace(/&iacute;/g, "í")
		.replace(/&oacute;/g, "ó")
		.replace(/&uacute;/g, "ú")
		.replace(/&ntilde;/g, "ñ");
}

function stripHtml(value: string): string {
	return cleanText(decodeHtmlEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
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

function compactSummary(block: string): string | undefined {
	const paragraphs = [...block.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
		.map((match) => stripHtml(match[1] ?? ""))
		.filter((text) => text.length > 20 && !/^download$/i.test(text));
	const summary = paragraphs.slice(0, 3).join(" ");
	return summary || undefined;
}

function firstDownloadUrl(block: string, sourceUrl: string): string | undefined {
	const downloadAnchor = block.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*(?:<[^>]+>\s*)*Download\s*(?:<\/[^>]+>\s*)*<\/a>/i)?.[1]
		?? block.match(/<a\b[^>]*href=["']([^"']+\.(?:zip|pdf|docx?|xlsx?)(?:\?[^"']*)?)["'][^>]*>/i)?.[1];
	return absoluteUrl(downloadAnchor, sourceUrl);
}

function referenceFrom(title: string, blockText: string): string | undefined {
	return title.match(/\b(?:RFQ|RFP|RFI|RF1|ITT|EOI|LC)\s+[A-Z0-9-]+/i)?.[0]
		?? blockText.match(/\b(?:RFQ|RFP|RFI|RF1|ITT|EOI|LC)\s+[A-Z0-9-]+/i)?.[0]
		?? title.match(/\bFY\d{2}-\d{3,4}\b/i)?.[0]
		?? blockText.match(/\bFY\d{2}-\d{3,4}\b/i)?.[0];
}

function deadlineFrom(blockText: string): Date | undefined {
	const explicitDate = blockText.match(/(\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4})/i)?.[1];
	return parseDate(explicitDate ?? blockText);
}

function inferOpportunityType(title: string, blockText: string): OpportunityData["opportunityType"] {
	const normalized = `${title} ${blockText}`.toLowerCase();
	if (/\brfi\b|\brf1\b|request for information/.test(normalized)) return "tender";
	if (/\brfp\b|request for proposals?/.test(normalized)) return "rfp";
	return "tender";
}

function normalizeForSearch(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();
}

function isTenderTitle(title: string): boolean {
	const normalized = normalizeForSearch(title);
	return title.length >= 8
		&& normalized !== "calls for tender"
		&& /\b(?:rfq|rfp|rfi|rf1|itt|eoi|tender|proposal|quotation|bid|licitacion)\b/i.test(normalized);
}

function sourceIdFrom(reference: string | undefined, title: string): string {
	const slug = (reference ?? title)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
	return `plan-international-${slug || "tender"}`;
}

function parsePlanInternational(content: string | undefined, sourceUrl: string): OpportunityData[] {
	if (!content) return [];
	const opportunities: OpportunityData[] = [];
	const headings = [...content.matchAll(HEADING_PATTERN)]
		.map((match) => ({
			title: stripHtml(match[1] ?? ""),
			start: match.index ?? 0,
			end: (match.index ?? 0) + match[0].length,
		}))
		.filter((heading) => heading.title.length > 0);

	for (const [index, heading] of headings.entries()) {
		const title = heading.title;
		if (!isTenderTitle(title)) continue;

		const nextStart = headings[index + 1]?.start ?? content.length;
		const block = content.slice(heading.end, nextStart);
		const blockText = stripHtml(block);
		const reference = referenceFrom(title, blockText);
		const documentUrl = firstDownloadUrl(block, sourceUrl);

		opportunities.push({
			title,
			source: "plan_international",
			sourceId: sourceIdFrom(reference, title),
			organization: "Plan International",
			category: "Plan International tender",
			opportunityType: inferOpportunityType(title, blockText),
			deadline: deadlineFrom(blockText),
			portalUrl: sourceUrl,
			documentUrl,
			rfpLink: documentUrl ?? sourceUrl,
			projectSummary: compactSummary(block),
			tags: ["plan-international", "ngo", "source-scrape"],
			metadata: {
				planInternational: {
					sourcePage: sourceUrl,
					reference,
					downloadUrl: documentUrl,
				},
			},
		});
	}

	return opportunities;
}

export const planInternationalParser: TenderParser = {
	sourceId: "plan_international",
	name: "Plan International Calls for Tender",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parsePlanInternational(input.html ?? input.markdown, input.url),
		};
	},

	getPageUrl(baseUrl: string, page: number): string {
		const url = new URL(baseUrl);
		if (page > 1) url.searchParams.set("page", String(page));
		return url.toString();
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(planInternationalParser);
