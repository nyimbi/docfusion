import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const JHPIEGO_WORK_WITH_US_URL = "https://jhpiego.org/work-with-us/";

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
		.replace(/&nbsp;/g, " ");
}

function stripHtml(value: string | undefined): string {
	if (!value) return "";
	return cleanText(decodeHtmlEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/p>|<\/li>|<\/div>|<\/td>|<\/h[1-6]>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
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

function cellContent(row: string, classFragment: string): string | undefined {
	const pattern = new RegExp(`<td\\b[^>]*class=["'][^"']*${classFragment}[^"']*["'][^>]*>([\\s\\S]*?)<\\/td>`, "i");
	const cell = row.match(pattern)?.[1];
	const datetime = cell?.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i)?.[1];
	return stripHtml(datetime ?? cell);
}

function tableRows(content: string): string[] {
	return [...content.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
		.map((match) => match[1] ?? "")
		.filter((row) => /class=["'][^"']*title[^"']*["']/i.test(row));
}

function inferOpportunityType(text: string): OpportunityData["opportunityType"] {
	const normalized = text.toLowerCase();
	if (/\beoi\b|expression of interest/.test(normalized)) return "eoi";
	if (/\brfq\b|request for quotation/.test(normalized)) return "tender";
	if (/\brfp\b|request for proposals?/.test(normalized)) return "rfp";
	return "tender";
}

function parseJhpiegoRequests(content: string | undefined, sourceUrl: string, now = new Date()): OpportunityData[] {
	if (!content?.trim()) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const row of tableRows(content)) {
		const noticeId = cellContent(row, "title");
		const description = cellContent(row, "description");
		const closeDateText = cellContent(row, "close-date");
		const postDateText = cellContent(row, "post-date");
		const location = cellContent(row, "location");
		if (!noticeId || !description) continue;

		const deadline = parseDate(closeDateText);
		if (isExpired(deadline, now)) continue;

		const publishedDate = parseDate(postDateText);
		const title = `${noticeId}: ${description}`;
		const sourceId = `jhpiego-${slugify(noticeId) || slugify(title)}`;
		if (seen.has(sourceId)) continue;
		seen.add(sourceId);

		opportunities.push({
			title,
			source: "jhpiego",
			sourceId,
			noticeId,
			organization: "Jhpiego",
			category: "Jhpiego request opportunity",
			countryRegion: location,
			opportunityType: inferOpportunityType(`${noticeId} ${description}`),
			deadline,
			publishedDate,
			portalUrl: sourceUrl,
			documentUrl: sourceUrl,
			rfpLink: sourceUrl,
			projectSummary: [
				`Jhpiego request opportunity: ${description}.`,
				location ? `Location: ${location}.` : undefined,
				deadline ? `Close date: ${deadline.toISOString().slice(0, 10)}.` : undefined,
			].filter(Boolean).join(" "),
			tags: ["jhpiego", "donor-implementer", "source-scrape"],
			metadata: {
				jhpiego: {
					sourcePage: sourceUrl,
					noticeId,
					postDate: postDateText,
					closeDate: closeDateText,
					location,
				},
			},
		});
	}

	return opportunities;
}

export const jhpiegoParser: TenderParser = {
	sourceId: "jhpiego",
	name: "Jhpiego Work With Us",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseJhpiegoRequests(input.html ?? input.markdown, input.url || JHPIEGO_WORK_WITH_US_URL),
		};
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || JHPIEGO_WORK_WITH_US_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(jhpiegoParser);
