import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

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
		.replace(/&rsquo;/g, "'")
		.replace(/&lsquo;/g, "'")
		.replace(/&ldquo;/g, "\"")
		.replace(/&rdquo;/g, "\"");
}

function stripHtml(value: string | undefined): string {
	if (!value) return "";
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

function fieldContent(row: string, classFragment: string): string | undefined {
	const classPattern = new RegExp(`class=["'][^"']*${classFragment}[^"']*["']`, "i");
	const classMatch = classPattern.exec(row);
	if (!classMatch?.index) return undefined;

	const fieldStart = row.lastIndexOf("<div", classMatch.index);
	const start = fieldStart >= 0 ? fieldStart : classMatch.index;
	const nextFieldMatch = /<div\b[^>]*class=["'][^"']*\bviews-field\b/i.exec(row.slice(classMatch.index + 1));
	const end = nextFieldMatch?.index === undefined
		? row.length
		: classMatch.index + 1 + nextFieldMatch.index;
	const segment = row.slice(start, end);
	const contents = [...segment.matchAll(/<(?:span|div)\b[^>]*class=["'][^"']*field-content[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div)>/gi)]
		.map((match) => stripHtml(match[1]))
		.filter(Boolean);
	return contents[0];
}

function referenceFrom(row: string): string | undefined {
	return fieldContent(row, "views-field-field-reference-no-")
		|| stripHtml(row.match(/\b((?:RFP|RFQ|EOI|RFI|ITT)\d{2}-\d{3,5})\b/i)?.[1]);
}

function statusFrom(row: string): string | undefined {
	return fieldContent(row, "views-field-field-tender-grant-status");
}

function isInactiveStatus(status: string | undefined): boolean {
	return /\b(?:awarded|cancelled|canceled|closed|withdrawn|unsuccessful)\b/i.test(status ?? "");
}

function dateFromTime(row: string, label: "Posting date" | "Closing Date"): Date | undefined {
	const pattern = new RegExp(`${label}:\\s*<time\\b[^>]*datetime=["']([^"']+)["'][^>]*>`, "i");
	const explicit = row.match(pattern)?.[1];
	if (explicit) return parseDate(explicit);
	const textPattern = new RegExp(`${label}:\\s*([^<\\n]+)`, "i");
	return parseDate(textPattern.exec(stripHtml(row))?.[1]);
}

function opportunityType(reference: string | undefined, title: string): OpportunityData["opportunityType"] {
	const normalized = `${reference ?? ""} ${title}`.toLowerCase();
	if (/\beoi\b|expression of interest/.test(normalized)) return "eoi";
	if (/\brfp\b|request for proposals?/.test(normalized)) return "rfp";
	return "tender";
}

function sourceIdFrom(reference: string | undefined, portalUrl: string | undefined, title: string): string {
	const raw = reference || portalUrl?.split("/").filter(Boolean).pop() || title;
	const slug = raw
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 90);
	return `spc-${slug || "tender"}`;
}

function extractTenderRows(content: string): string[] {
	return content
		.split(/<div\b[^>]*class=["'][^"']*\bviews-row\b[^"']*["'][^>]*>/i)
		.slice(1);
}

export function parseSpcProcurement(content: string | undefined, sourceUrl: string): OpportunityData[] {
	if (!content?.trim()) return [];
	const opportunities: OpportunityData[] = [];

	for (const row of extractTenderRows(content)) {
		const link = row.match(/<a\b[^>]*href=["']([^"']*\/procurement\/tenders\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
		const portalUrl = absoluteUrl(link?.[1], sourceUrl);
		const title = stripHtml(link?.[2]);
		if (!portalUrl || !title) continue;

		const status = statusFrom(row);
		if (isInactiveStatus(status)) continue;

		const reference = referenceFrom(row);
		const deadline = dateFromTime(row, "Closing Date");
		const publishedDate = dateFromTime(row, "Posting date");
		const countryRegion = fieldContent(row, "views-field-field-country-for-deliverables");
		const projectUnit = fieldContent(row, "views-field-field-division");
		const tenderCategory = fieldContent(row, "views-field-field-tender-category");

		opportunities.push({
			title,
			source: "spc",
			sourceId: sourceIdFrom(reference, portalUrl, title),
			noticeId: reference,
			organization: "The Pacific Community",
			category: tenderCategory ? `SPC ${tenderCategory}` : "SPC procurement",
			countryRegion,
			opportunityType: opportunityType(reference, title),
			deadline,
			publishedDate,
			portalUrl,
			documentUrl: portalUrl,
			rfpLink: portalUrl,
			projectSummary: [
				reference ? `Reference: ${reference}.` : undefined,
				status ? `Status: ${status}.` : undefined,
				projectUnit ? `Project/Unit: ${projectUnit}.` : undefined,
				tenderCategory ? `Category: ${tenderCategory}.` : undefined,
				countryRegion ? `Country for deliverables: ${countryRegion}.` : undefined,
			].filter(Boolean).join(" "),
			tags: ["spc", "pacific-community", "regional-procurement", "source-scrape", "source-documents"],
			metadata: {
				spc: {
					sourcePage: sourceUrl,
					detailUrl: portalUrl,
					reference,
					status,
					projectUnit,
					category: tenderCategory,
				},
			},
		});
	}

	return opportunities;
}

export const spcParser: TenderParser = {
	sourceId: "spc",
	name: "Pacific Community Procurement",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseSpcProcurement(input.html ?? input.markdown, input.url),
		};
	},

	getPageUrl(baseUrl: string, page: number): string {
		const url = new URL(baseUrl);
		if (page > 1) url.searchParams.set("page", String(page - 1));
		return url.toString();
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(spcParser);
