import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const RTI_CURRENT_OPPORTUNITIES_URL = "https://www.rti.org/current-opportunities";
const RTI_REQUEST_MARKER = String.raw`<p\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<strong>\s*Request for Quote\/Proposal(?:\s*\([^<]*\))?\s*<\/strong>`;
const RTI_ENTRY_PATTERN = new RegExp(`${RTI_REQUEST_MARKER}[\\s\\S]*?(?=${RTI_REQUEST_MARKER}|<h3\\b[^>]*>\\s*Open solicitations|$)`, "gi");
const FIELD_LABELS = [
	"Title",
	"Project",
	"Solicitation Number",
	"RFP/Q Number",
	"Date Proposal Due",
	"Date Applications Due",
	"Closing Date",
	"Date Response Posted",
	"Submit Proposal to",
	"Submit CV",
	"Attachment",
	"Attachments",
	"Statement of Work",
];
const FIELD_LOOKAHEAD = FIELD_LABELS
	.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
	.join("|");

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, codepoint: string) => String.fromCodePoint(Number(codepoint)))
		.replace(/&#x([0-9a-f]+);/gi, (_, codepoint: string) => String.fromCodePoint(Number.parseInt(codepoint, 16)))
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

function absoluteUrl(href: string | undefined, sourceUrl: string): string | undefined {
	if (!href) return undefined;
	try {
		return new URL(decodeHtmlEntities(href), sourceUrl).toString();
	} catch {
		return undefined;
	}
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

function utcStartOfDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isExpired(deadline: Date | undefined, now = new Date()): boolean {
	if (!deadline) return false;
	return deadline.getTime() < utcStartOfDay(now).getTime();
}

function fieldValue(text: string, labels: string[]): string | undefined {
	for (const label of labels) {
		const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const match = text.match(new RegExp(`\\b${escapedLabel}\\s*:\\s*([\\s\\S]*?)(?=\\b(?:${FIELD_LOOKAHEAD})\\s*:|$)`, "i"));
		const value = cleanText(match?.[1]);
		if (value) return value;
	}
	return undefined;
}

function parseNamedDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	const months: Record<string, number> = {
		january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
		july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
	};
	const dayMonthYear = value.match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/);
	if (dayMonthYear) {
		const month = months[dayMonthYear[2].toLowerCase()];
		if (month !== undefined) {
			return new Date(Date.UTC(Number(dayMonthYear[3]), month, Number(dayMonthYear[1])));
		}
	}
	const monthDayYear = value.match(/\b([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\b/);
	if (monthDayYear) {
		const month = months[monthDayYear[1].toLowerCase()];
		if (month !== undefined) {
			return new Date(Date.UTC(Number(monthDayYear[3]), month, Number(monthDayYear[2])));
		}
	}
	return undefined;
}

function parseRtiDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	const firstDate = value.match(/\b([A-Za-z]+day,\s*)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/)?.[2]
		?? value.match(/\b([A-Za-z]+\s+\d{1,2},\s+\d{4})\b/)?.[1]
		?? value.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
	return parseNamedDate(firstDate ?? value) ?? parseDate(firstDate ?? value);
}

function inferOpportunityType(text: string): OpportunityData["opportunityType"] {
	const normalized = text.toLowerCase();
	if (/\beoi\b|expression of interest/.test(normalized)) return "eoi";
	if (/\brfp\b|request for proposals?/.test(normalized)) return "rfp";
	return "tender";
}

function firstDocumentUrl(block: string, sourceUrl: string): string | undefined {
	for (const match of block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
		const href = decodeHtmlEntities(match[1] ?? "");
		const anchorText = stripHtml(match[2] ?? "");
		if (/\.(?:pdf|docx?|xlsx?)(?:[?#].*)?$/i.test(href) || /\b(?:attachment|rfp|rfq|sow|statement of work|scope of work)\b/i.test(anchorText)) {
			return absoluteUrl(href, sourceUrl);
		}
	}
	return undefined;
}

function parseRtiCurrentOpportunities(content: string | undefined, sourceUrl: string, now = new Date()): OpportunityData[] {
	if (!content) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const match of content.matchAll(RTI_ENTRY_PATTERN)) {
		const block = match[0];
		const text = stripHtml(block);
		const title = fieldValue(text, ["Title"]);
		if (!title || title.length < 8) continue;

		const project = fieldValue(text, ["Project"]);
		const noticeId = cleanText(fieldValue(text, ["Solicitation Number", "RFP/Q Number"]))
			|| slugify(title);
		const sourceId = `rti-${slugify(noticeId || title)}`;
		if (seen.has(sourceId)) continue;

		const deadline = parseRtiDate(fieldValue(text, ["Date Proposal Due", "Date Applications Due", "Closing Date"]));
		if (isExpired(deadline, now)) continue;

		const documentUrl = firstDocumentUrl(block, sourceUrl);
		seen.add(sourceId);
		opportunities.push({
			title,
			source: "rti",
			sourceId,
			noticeId,
			organization: "RTI International",
			category: "RTI current opportunities",
			opportunityType: inferOpportunityType(`${title} ${noticeId}`),
			deadline,
			portalUrl: sourceUrl,
			documentUrl,
			rfpLink: documentUrl ?? sourceUrl,
			projectSummary: [
				project ? `Project: ${project}.` : undefined,
				deadline ? `Deadline: ${deadline.toISOString().slice(0, 10)}.` : undefined,
			].filter(Boolean).join(" ") || "RTI current opportunity.",
			tags: ["rti", "donor-implementer", "source-scrape"],
			metadata: {
				rti: {
					sourcePage: sourceUrl,
					project,
					noticeId,
				},
			},
		});
	}

	return opportunities;
}

export const rtiParser: TenderParser = {
	sourceId: "rti",
	name: "RTI Current Opportunities",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseRtiCurrentOpportunities(input.html ?? input.markdown, input.url || RTI_CURRENT_OPPORTUNITIES_URL),
		};
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || RTI_CURRENT_OPPORTUNITIES_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(rtiParser);
