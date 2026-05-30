import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const TETRA_TECH_AU_PARTNER_URL = "https://intdev.tetratech.com.au/partner-with-us/";
const ACCORDION_TITLE_PATTERN = /<a\b[^>]*class=["'][^"']*elementor-accordion-title[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;

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

function absoluteUrl(href: string | undefined, sourceUrl: string): string | undefined {
	if (!href) return undefined;
	try {
		const url = new URL(decodeHtmlEntities(href), sourceUrl);
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

function parseNamedDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	const months: Record<string, number> = {
		january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
		july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
	};
	const dayMonthYear = value.match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/);
	if (dayMonthYear) {
		const month = months[dayMonthYear[2].toLowerCase()];
		if (month !== undefined) return new Date(Date.UTC(Number(dayMonthYear[3]), month, Number(dayMonthYear[1])));
	}
	const monthDayYear = value.match(/\b([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\b/);
	if (monthDayYear) {
		const month = months[monthDayYear[1].toLowerCase()];
		if (month !== undefined) return new Date(Date.UTC(Number(monthDayYear[3]), month, Number(monthDayYear[2])));
	}
	return undefined;
}

function parseTetraTechDeadline(text: string): Date | undefined {
	const candidates = [
		/\bClosing Date and Time\s*:\s*([A-Za-z]+day,?\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
		/\bClosing Date\s*:\s*([A-Za-z]+day,?\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
		/\bDeadline\s*:\s*([A-Za-z]+day,?\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
		/\b([A-Za-z]+day,?\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/i,
		/\b([A-Za-z]+\s+\d{1,2},\s+\d{4})\b/i,
	];
	for (const pattern of candidates) {
		const match = text.match(pattern);
		const dateText = match?.[2] ?? match?.[1];
		const parsed = parseNamedDate(dateText) ?? parseDate(dateText);
		if (parsed) return parsed;
	}
	return undefined;
}

function inferOpportunityType(text: string): OpportunityData["opportunityType"] {
	const normalized = text.toLowerCase();
	if (/\beoi\b|expression of interest/.test(normalized)) return "eoi";
	if (/\brfp\b|request for proposals?/.test(normalized)) return "rfp";
	if (/\brft\b|request for tender/.test(normalized)) return "tender";
	return "tender";
}

function firstDocumentUrl(block: string, sourceUrl: string): string | undefined {
	for (const match of block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
		const href = decodeHtmlEntities(match[1] ?? "");
		const anchorText = stripHtml(match[2] ?? "");
		if (/\.(?:pdf|docx?|xlsx?|zip)(?:[?#].*)?$/i.test(href)
			|| /\b(?:rfp|rft|eoi|tender|request for|terms of reference|download)\b/i.test(anchorText)) {
			return absoluteUrl(href, sourceUrl);
		}
	}
	return undefined;
}

function noticeIdFromTitle(title: string): string | undefined {
	return title.match(/\b(?:RFP|RFT|RFQ|EOI)[- ][A-Z0-9-]{3,}\b/i)?.[0];
}

function accordionEntries(content: string): Array<{ title: string; body: string }> {
	const matches = [...content.matchAll(ACCORDION_TITLE_PATTERN)];
	return matches.map((match, index) => {
		const start = (match.index ?? 0) + match[0].length;
		const end = matches[index + 1]?.index ?? content.length;
		return {
			title: stripHtml(match[1]),
			body: content.slice(start, end),
		};
	});
}

function parseTetraTechIntdev(content: string | undefined, sourceUrl: string, now = new Date()): OpportunityData[] {
	if (!content?.trim()) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const entry of accordionEntries(content)) {
		const bodyText = stripHtml(entry.body);
		if (entry.title.length < 8 || !/\b(?:rfp|rft|rfq|eoi|tender|request for|procurement|closing date)\b/i.test(`${entry.title} ${bodyText}`)) continue;

		const deadline = parseTetraTechDeadline(bodyText);
		if (isExpired(deadline, now)) continue;

		const noticeId = cleanText(noticeIdFromTitle(entry.title)) || undefined;
		const sourceId = `tetra-tech-intdev-${slugify(noticeId ?? entry.title) || "tender"}`;
		if (seen.has(sourceId)) continue;
		seen.add(sourceId);

		const documentUrl = firstDocumentUrl(entry.body, sourceUrl);
		opportunities.push({
			title: entry.title,
			source: "tetra_tech_intdev",
			sourceId,
			noticeId,
			organization: "Tetra Tech International Development",
			category: "Tetra Tech International Development tender",
			countryRegion: sourceUrl.includes("tetratech.com.au") ? "Asia-Pacific / Indo-Pacific" : "Global",
			opportunityType: inferOpportunityType(`${entry.title} ${bodyText}`),
			deadline,
			portalUrl: sourceUrl,
			documentUrl: documentUrl ?? sourceUrl,
			rfpLink: documentUrl ?? sourceUrl,
			projectSummary: [
				"Tetra Tech International Development tender opportunity.",
				deadline ? `Closing date: ${deadline.toISOString().slice(0, 10)}.` : undefined,
				bodyText ? bodyText.slice(0, 700) : undefined,
			].filter(Boolean).join(" "),
			tags: ["tetra-tech-intdev", "donor-implementer", "source-scrape", "source-documents"],
			metadata: {
				tetraTechIntdev: {
					sourcePage: sourceUrl,
					noticeId,
				},
			},
		});
	}

	return opportunities;
}

export const tetraTechIntdevParser: TenderParser = {
	sourceId: "tetra_tech_intdev",
	name: "Tetra Tech International Development Tenders",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseTetraTechIntdev(input.html ?? input.markdown, input.url || TETRA_TECH_AU_PARTNER_URL),
		};
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || TETRA_TECH_AU_PARTNER_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(tetraTechIntdevParser);
