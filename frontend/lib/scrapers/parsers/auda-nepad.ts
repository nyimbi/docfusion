import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

export const AUDA_NEPAD_TENDERS_URL = "https://www.nepad.org/tenders";

type AudaNepadDocumentLink = {
	label?: string;
	url: string;
};

type AudaNepadOpportunity = OpportunityData & {
	portalUrl: string;
	metadata: {
		audaNepad: {
			sourceUrl: string;
			deadlineText?: string;
			contactEmail?: string;
			documentLinks: AudaNepadDocumentLink[];
		};
	};
};

function decodeEntities(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, codepoint: string) => String.fromCodePoint(Number(codepoint)))
		.replace(/&#x([0-9a-f]+);/gi, (_, codepoint: string) => String.fromCodePoint(Number.parseInt(codepoint, 16)))
		.replace(/&nbsp;|&#160;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, "\"")
		.replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi, "-");
}

function stripHtml(value: string | undefined): string {
	if (!value) return "";
	return cleanText(decodeEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>|<\/span>|<\/a>|<\/time>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function attrValue(attributes: string | undefined, name: string): string | undefined {
	const match = new RegExp(`${name}=["']([^"']+)["']`, "i").exec(attributes ?? "");
	return match?.[1] ? decodeEntities(match[1]).trim() : undefined;
}

function absoluteAudaNepadUrl(rawUrl: string | undefined, sourceUrl = AUDA_NEPAD_TENDERS_URL): string | undefined {
	const cleaned = decodeEntities(rawUrl ?? "").trim();
	if (!cleaned || /^javascript:/i.test(cleaned) || /^mailto:/i.test(cleaned)) return undefined;
	try {
		const url = new URL(cleaned, sourceUrl);
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
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 100);
}

function monthNumber(value: string | undefined): number | undefined {
	const normalized = (value ?? "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/\.$/, "");
	const months: Record<string, number> = {
		january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
		may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
		september: 8, sept: 8, sep: 8, october: 9, oct: 9, november: 10, nov: 10,
		december: 11, dec: 11,
	};
	return months[normalized];
}

function parseAudaNepadDate(value: string | undefined): Date | undefined {
	const cleaned = stripHtml(value)
		.replace(/(\d{1,2})(?:st|nd|rd|th)\b/gi, "$1")
		.replace(/\s+/g, " ")
		.trim();
	if (!cleaned || cleaned === "00Z") return undefined;

	const iso = /\b(\d{4})-(\d{2})-(\d{2})/.exec(cleaned);
	if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0));

	const monthDayYear = /\b([A-Za-z.]+)\s+(\d{1,2}),?\s+(\d{4})\b/i.exec(cleaned);
	if (monthDayYear) {
		const month = monthNumber(monthDayYear[1]);
		if (month !== undefined) return new Date(Date.UTC(Number(monthDayYear[3]), month, Number(monthDayYear[2]), 12, 0, 0));
	}

	const dayMonthYear = /\b(\d{1,2})\s+([A-Za-z.]+)\s+(\d{4})\b/i.exec(cleaned);
	if (dayMonthYear) {
		const month = monthNumber(dayMonthYear[2]);
		if (month !== undefined) return new Date(Date.UTC(Number(dayMonthYear[3]), month, Number(dayMonthYear[1]), 12, 0, 0));
	}

	const parsed = new Date(cleaned);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function startOfUtcDay(value: Date): number {
	return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function isExpired(deadline: Date | undefined, now: Date): boolean {
	return Boolean(deadline && startOfUtcDay(deadline) < startOfUtcDay(now));
}

function isDocumentUrl(url: string): boolean {
	try {
		const pathname = new URL(url).pathname;
		return /\/file-download\/download\/public\/|\/sites\/default\/files\/|\.(?:pdf|docx?|xlsx?|zip)(?:$|[?#])/i.test(pathname);
	} catch {
		return /\/file-download\/download\/public\/|\.(?:pdf|docx?|xlsx?|zip)(?:$|[?#])/i.test(url);
	}
}

function collectDocumentLinks(html: string, sourceUrl: string): AudaNepadDocumentLink[] {
	const links: AudaNepadDocumentLink[] = [];
	const seen = new Set<string>();
	for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
		const url = absoluteAudaNepadUrl(attrValue(match[1], "href"), sourceUrl);
		if (!url || seen.has(url) || !isDocumentUrl(url)) continue;
		seen.add(url);
		const label = attrValue(match[1], "title") || stripHtml(match[2]) || undefined;
		links.push({ label, url });
	}
	return links;
}

function extractViewsRows(html: string): string[] {
	const starts = [...html.matchAll(/<div\b[^>]*class=["'][^"']*\bviews-row\b[^"']*["'][^>]*>/gi)]
		.map((match) => match.index)
		.filter((index): index is number => typeof index === "number");
	return starts.map((start, index) => {
		const next = starts[index + 1];
		const footer = html.indexOf("<footer", start);
		const end = next ?? (footer > start ? footer : html.length);
		return html.slice(start, end);
	});
}

function titleFromRow(row: string): string {
	const fieldTitle = /<h3\b[^>]*class=["'][^"']*\bviews-field-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i.exec(row)?.[1];
	const heading = fieldTitle ?? /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(row)?.[1];
	return stripHtml(heading);
}

function deadlineFromRow(row: string): { date?: Date; text?: string } {
	const timeText = stripHtml(/<time\b[^>]*>([\s\S]*?)<\/time>/i.exec(row)?.[1]);
	const deadlineText = timeText || stripHtml(/Deadline:\s*([^\n<]+)/i.exec(row)?.[1]) || undefined;
	return {
		date: parseAudaNepadDate(deadlineText),
		text: deadlineText,
	};
}

function summaryFromRow(row: string): string | undefined {
	const body = /<div\b[^>]*class=["'][^"']*\bdetail-body\b[^"']*["'][^>]*>([\s\S]*?)(?=<div\b[^>]*class=["'][^"']*\bviews-field\b|$)/i.exec(row)?.[1];
	return stripHtml(body ?? row).slice(0, 1200) || undefined;
}

function contactEmailFrom(value: string | undefined): string | undefined {
	return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(value ?? "")?.[0];
}

function inferOpportunityType(title: string, summary: string | undefined): OpportunityData["opportunityType"] {
	const haystack = `${title} ${summary ?? ""}`.toLowerCase();
	if (/\b(eoi|expression of interest)\b/.test(haystack)) return "eoi";
	if (/\brfp\b|request for proposals?/.test(haystack)) return "rfp";
	return "tender";
}

function inferCategory(title: string, summary: string | undefined): string {
	const haystack = `${title} ${summary ?? ""}`.toLowerCase();
	if (/\b(eoi|expression of interest)\b/.test(haystack)) return "Expression of interest";
	if (/\brfp\b|request for proposals?/.test(haystack)) return "Request for proposal";
	if (/consultancy|consultant/.test(haystack)) return "Consultancy services";
	return "Tender notice";
}

function opportunityFromFields(
	fields: {
		title: string;
		deadline?: Date;
		deadlineText?: string;
		documentLinks: AudaNepadDocumentLink[];
		summary?: string;
	},
	sourceUrl: string
): AudaNepadOpportunity {
	const contactEmail = contactEmailFrom(fields.summary);
	const primaryDocument = fields.documentLinks[0]?.url;
	return {
		title: fields.title,
		source: "auda_nepad",
		sourceId: `auda-nepad-${slugify(fields.title) || "tender"}`,
		organization: "African Union Development Agency (AUDA-NEPAD)",
		countryRegion: "Africa",
		category: inferCategory(fields.title, fields.summary),
		opportunityType: inferOpportunityType(fields.title, fields.summary),
		deadline: fields.deadline,
		portalUrl: sourceUrl,
		documentUrl: primaryDocument ?? sourceUrl,
		rfpLink: primaryDocument ?? sourceUrl,
		projectSummary: [
			fields.deadlineText ? `Deadline: ${fields.deadlineText}.` : undefined,
			fields.summary,
			fields.documentLinks.length > 0 ? `${fields.documentLinks.length} linked source document(s) found.` : undefined,
		].filter(Boolean).join(" "),
		submissionMethod: contactEmail
			? `Use the AUDA-NEPAD tender notice instructions; submission/contact email: ${contactEmail}.`
			: "Use the AUDA-NEPAD tender notice and linked source documents for submission instructions.",
		tags: ["auda-nepad", "african-union", "africa", "source-documents"],
		metadata: {
			audaNepad: {
				sourceUrl,
				deadlineText: fields.deadlineText,
				contactEmail,
				documentLinks: fields.documentLinks,
			},
		},
	};
}

export function parseAudaNepadTendersHtml(
	html: string,
	sourceUrl = AUDA_NEPAD_TENDERS_URL,
	now = new Date()
): AudaNepadOpportunity[] {
	const opportunities: AudaNepadOpportunity[] = [];
	const seen = new Set<string>();
	for (const row of extractViewsRows(html)) {
		const title = titleFromRow(row);
		if (!title || seen.has(title)) continue;
		const deadline = deadlineFromRow(row);
		if (isExpired(deadline.date, now)) continue;
		const documentLinks = collectDocumentLinks(row, sourceUrl);
		const summary = summaryFromRow(row);
		seen.add(title);
		opportunities.push(opportunityFromFields({
			title,
			deadline: deadline.date,
			deadlineText: deadline.text,
			documentLinks,
			summary,
		}, sourceUrl));
	}
	return opportunities;
}

function collectMarkdownDocumentLinks(markdown: string, sourceUrl: string): AudaNepadDocumentLink[] {
	const links: AudaNepadDocumentLink[] = [];
	const seen = new Set<string>();
	for (const match of markdown.matchAll(/\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g)) {
		const url = absoluteAudaNepadUrl(match[2], sourceUrl);
		if (!url || seen.has(url) || !isDocumentUrl(url)) continue;
		seen.add(url);
		links.push({ label: cleanText(match[3] || match[1]) || undefined, url });
	}
	return links;
}

export function parseAudaNepadTendersMarkdown(
	markdown: string,
	sourceUrl = AUDA_NEPAD_TENDERS_URL,
	now = new Date()
): AudaNepadOpportunity[] {
	const sections = markdown
		.split(/\n(?=#{2,4}\s+)/)
		.map((section) => section.trim())
		.filter(Boolean);
	const opportunities: AudaNepadOpportunity[] = [];
	const seen = new Set<string>();

	for (const section of sections) {
		const title = cleanText(section.split("\n")[0]?.replace(/^#{2,4}\s*/, "") ?? "");
		const deadlineText = /Deadline:\s*([^\n]+)/i.exec(section)?.[1]?.trim();
		if (!title || !deadlineText || seen.has(title)) continue;
		const deadline = parseAudaNepadDate(deadlineText);
		if (isExpired(deadline, now)) continue;
		seen.add(title);
		opportunities.push(opportunityFromFields({
			title,
			deadline,
			deadlineText,
			documentLinks: collectMarkdownDocumentLinks(section, sourceUrl),
			summary: cleanText(section.replace(/^#{2,4}\s*[^\n]+\n?/, "")).slice(0, 1200) || undefined,
		}, sourceUrl));
	}
	return opportunities;
}

export const audaNepadParser: TenderParser = {
	sourceId: "auda_nepad",
	name: "AUDA-NEPAD Tenders",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		const htmlOpportunities = parseAudaNepadTendersHtml(input.html ?? "", input.url);
		if (htmlOpportunities.length > 0) return { opportunities: htmlOpportunities };
		return { opportunities: parseAudaNepadTendersMarkdown(input.markdown ?? "", input.url) };
	},

	getPageUrl(baseUrl: string, page: number): string {
		if (page <= 1) return baseUrl || AUDA_NEPAD_TENDERS_URL;
		const url = new URL(baseUrl || AUDA_NEPAD_TENDERS_URL);
		url.searchParams.set("page", String(page - 1));
		url.hash = "";
		return url.toString();
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(audaNepadParser);
